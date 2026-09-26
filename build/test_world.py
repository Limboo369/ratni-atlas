"""World map test: the page served over http with dist/data/svijet/ (real data, or `python build/fake_world.py`).
Start screen map switch (phone), a game on the world, an era the world does not have yet, online lobby with the
world (the guest downloads it before the host can start, both stay in lockstep), and no world when /data is missing.
   python build/test_world.py"""
import asyncio, functools, http.server, os, socket, subprocess, sys, threading, time
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = R + 'build/shots/'
os.makedirs(OUT, exist_ok=True)
LEAF = open(R + 'package/dist/leaflet.js').read()
fails = []


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    assert os.path.exists(R + 'dist/data/svijet/map.json'), 'no world data: run build/make.py (or build/fake_world.py)'
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=R + 'dist'))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def start_relay(port):
    srv = subprocess.Popen(['node', R + 'deploy/game/server.js'], env={**os.environ, 'PORT': str(port)},
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for _ in range(100):
        try:
            socket.create_connection(('127.0.0.1', port), timeout=0.2).close()
            return srv
        except OSError:
            time.sleep(0.1)
    raise RuntimeError('relay did not start')


async def main():
    http_srv = serve()
    URL = f'http://127.0.0.1:{http_srv.server_address[1]}/test.html'
    WS = free_port()
    relay = start_relay(WS)
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])

        async def page(name, block=()):
            ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
            await ctx.add_init_script(f"window.RA_WS = 'ws://127.0.0.1:{WS}/ws'")
            pg = await ctx.new_page()
            pg.set_default_timeout(90_000)
            pg.on('pageerror', lambda e: errs.append(f'{name} PAGEERROR: {e}'))

            async def route(r):
                u = r.request.url
                if 'leaflet' in u and u.endswith('.js'):
                    await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
                elif any(k in u for k in block):
                    await r.fulfill(status=404, body='')
                elif u.startswith('http://127.0.0.1'):
                    await r.continue_()
                else:
                    await r.abort()
            await pg.route('**/*', route)
            await pg.goto(URL)
            await pg.wait_for_function('document.getElementById("loading").hidden', timeout=60000)
            return pg

        # 1. start screen: the world shows up (probe), switching loads it behind the loading screen
        A = await page('A')
        await A.wait_for_selector('#mapSeg button[data-v="svijet"]:not([hidden])', timeout=10000)
        check(await A.is_visible('#mapField'), 'map field visible when the server has the world')
        await A.fill('#nameIn', 'Darko')
        await A.click('#eraSeg button[data-v="danas"]')
        t0 = time.time()
        await A.click('#mapSeg button[data-v="svijet"]')
        await A.wait_for_function('window.__ra.map.id === "svijet" && document.getElementById("loading").hidden')
        await A.wait_for_function('document.getElementById("startScreen").classList.contains("command-world")')
        check(await A.evaluate('() => { const c=document.getElementById("atlasCanvas"); return c.width > c.height && document.getElementById("atlasRegion").textContent === "SVIJET"; }'), 'launcher atlas follows the world map geometry')
        print(f'world loaded in {time.time() - t0:.1f} s')
        st = await A.evaluate('''() => ({ regs: [...document.querySelectorAll('#regSeg button')].map(b => b.dataset.v + ':' + b.textContent),
            aria: document.getElementById('map').getAttribute('aria-label'), tag: document.querySelector('#startScreen .tagline').textContent,
            eras: [...document.querySelectorAll('#eraSeg button')].filter(b => !b.disabled).map(b => b.dataset.v), set: window.__ra.ui.settings.map })''')
        print('world start screen', st)
        th = await A.evaluate('() => [...document.querySelectorAll("#mapSeg button")].filter(b => !b.hidden).map(b => b.dataset.v)')
        check(th == ['svijet', 'evropa', 'bliski', 'afrika', 'azija', 'sam', 'jam', 'okeanija'], f'parts of the world in one list, Evropa among them: {th}')
        check(await A.evaluate('document.getElementById("regField").hidden'), 'no "part of Evropa" field on the world')
        check(st['aria'] == 'Karta svijeta' and 'svijet' in st['tag'], 'map texts follow the map')
        await A.screenshot(path=OUT + 'world_1_start.png')
        # a historical era on the world (build/svijet/era_ww1.json): downloaded on choice, world blurb, countries counted
        await A.click('#eraSeg button[data-v="ww1"]')
        await A.wait_for_function('!!window.__ra.maps.svijet.eras.ww1', timeout=30000)
        await A.wait_for_timeout(300)
        st = await A.evaluate('() => [document.getElementById("eraNote").textContent, document.querySelector("#mapSeg button[data-v=svijet] small").textContent]')
        check(st[0].startswith('Svijet 1914') and st[1].split()[0].isdigit() and int(st[1].split()[0]) > 0, f'1914 on the world: {st}')
        # the old eras have states on every continent (the Americas and Oceania in the year 100 too)
        await A.click('#eraSeg button[data-v="rim"]')
        await A.wait_for_function('!!window.__ra.maps.svijet.eras.rim', timeout=30000)
        await A.click('#mapSeg button[data-v="sam"]')
        await A.wait_for_function('/\\d+ država/.test(document.querySelector("#mapSeg button[data-v=okeanija] small").textContent)', timeout=30000)
        st = await A.evaluate('() => [window.__ra.ui.settings.era, ...["sam", "jam", "okeanija", "afrika"].map(r => parseInt(document.querySelector(`#mapSeg button[data-v=${r}] small`).textContent))]')
        check(st[0] == 'rim' and all(n >= 5 for n in st[1:]), f'year 100: states in the Americas, Oceania, Africa {st}')
        await A.screenshot(path=OUT + 'world_1b_theatre.png')
        # a part of the world without (enough) states in an era: that era is off there, and the choice moves to the nearest era
        await A.evaluate('() => { const ui = window.__ra.ui; ui._rc["svijet|okeanija|rim|" + ui.settings.start] = 1; }')
        await A.click('#mapSeg button[data-v="okeanija"]')
        await A.wait_for_function('document.querySelector("#eraSeg button[data-v=rim]").disabled', timeout=30000)
        st = await A.evaluate('() => [window.__ra.ui.settings.region, window.__ra.ui.settings.era]')
        check(st == ['okeanija', 'srednji'], f'an era without states is off, the choice moves to the nearest one {st}')
        await A.click('#mapSeg button[data-v="svijet"]')
        await A.click('#eraSeg button[data-v="danas"]')

        # 2. a game on the whole world (borders start)
        await A.click('#configBtn')
        await A.click('#startSeg button[data-v="granice"]')
        await A.click('#gmSeg button[data-v="klasik"]')
        await A.click('#configDone')
        await A.click('#goBtn')
        await A.wait_for_timeout(900)
        info = await A.evaluate('() => { const G = window.__ra.G; return { map: G.map.id, nations: G.P.filter(p => p && p.type === "nation").length, land: G.map.landCount, players: G.P.length - 1 }; }')
        print('world game', info)
        check(info['map'] == 'svijet' and info['nations'] > 0, 'game runs on the world map')
        check(info['players'] <= 250, 'at most 250 players')
        pid = await A.evaluate('() => window.__ra.G.P.find(p => p && p.type === "nation").id')
        await A.select_option('#natSel', str(pid))
        await A.wait_for_timeout(600)
        await A.click('#startBtn')
        await A.wait_for_timeout(800)
        check(await A.evaluate('() => window.__ra.G.state') == 'play', 'world game started')
        t0 = time.time()
        await A.evaluate('() => { const G = window.__ra.G; for (let i = 0; i < 300; i++) G.step(); }')
        print(f'300 ticks on the world: {time.time() - t0:.1f} s, tick', await A.evaluate('() => window.__ra.G.tick'))
        # real-area weights (meta.areaWeight): the players' areas, kept as cells change hands, add up to the owned area
        aw = await A.evaluate('''() => { const G = window.__ra.G, m = G.map; let own = 0, sum = 0;
            for (let c = 0; c < m.N; c++) if (G.owner[c]) own += m.aw[c];
            for (const p of G.P) if (p) sum += p.area;
            return { on: !!m.meta.areaWeight, top: m.aw[0], mid: m.aw[(m.H >> 1) * m.W], own, sum }; }''')
        print('area weights', aw)
        check(aw['own'] == aw['sum'] and (not aw['on'] or aw['top'] < aw['mid']), 'area weights: poles count less, player areas add up')
        await A.wait_for_timeout(600)
        await A.screenshot(path=OUT + 'world_2_game.png')
        await A.evaluate('() => window.__ra.ui.menu()')
        await A.wait_for_timeout(300)
        menu = await A.evaluate('() => document.getElementById("sheet").textContent')
        check('Cijeli svijet' in menu, 'menu names the map')
        await A.evaluate('() => { window.__ra.ui.closeSheet(); window.__ra.showStart(); }')
        await A.wait_for_timeout(500)
        check(await A.evaluate('() => window.__ra.map.id') == 'svijet', 'back on the start screen: still the world')
        await A.click('#mapSeg button[data-v="evropa"]')
        await A.wait_for_timeout(500)
        st = await A.evaluate('() => [window.__ra.map.id, [...document.querySelectorAll("#regSeg button")].map(b => b.dataset.v)]')
        check(st[0] == 'evropa' and 'balkan' in st[1] and 'afrika' not in st[1], f'back to Europe: {st}')
        await A.context.close()

        # 3. an era the world does not have yet: button disabled, the start screen falls back to one it has
        E = await page('E', block=('/era_rim.json',))
        await E.wait_for_selector('#mapSeg button[data-v="svijet"]:not([hidden])', timeout=10000)
        await E.click('#eraSeg button[data-v="rim"]')
        await E.click('#mapSeg button[data-v="svijet"]')
        await E.wait_for_function('window.__ra.map.id === "svijet" && document.getElementById("loading").hidden')
        st = await E.evaluate('() => [window.__ra.ui.settings.era, document.querySelector("#eraSeg button[data-v=rim]").disabled, window.__ra.mapOK.svijet]')
        check(st == ['danas', True, True], f'missing era: fallback to danas, Rim disabled, world kept ({st})')
        await E.screenshot(path=OUT + 'world_3_no_era.png')
        await E.context.close()

        # 4. online: the host picks the world in the lobby, the guest downloads it before the game can start
        H = await page('H')
        G2 = await page('G')
        await H.fill('#nameIn', 'Darko')
        await G2.fill('#nameIn', 'Marko')
        await H.wait_for_selector('#mapSeg button[data-v="svijet"]:not([hidden])', timeout=10000)
        await H.wait_for_function('window.__ra.net.status === "ready"', timeout=10000)
        await H.click('#sideSeg [data-v="online"]')
        await H.click('#onlineToggle')
        await H.click('[data-on="host"]')
        await H.wait_for_function('window.__ra.net.code', timeout=10000)
        await H.click('#lEraSeg button[data-v="danas"]')
        await H.click('#lStartSeg button[data-v="granice"]')
        await H.click('#lMapSeg button[data-v="svijet"]')
        code = await H.evaluate('() => window.__ra.net.code')
        await G2.wait_for_function('window.__ra.net.status === "ready"', timeout=10000)
        await G2.click('#sideSeg [data-v="online"]')
        await G2.click('#onlineToggle')
        await G2.fill('#codeIn', code)
        await G2.click('[data-on="code"]')
        await G2.wait_for_selector('#lobbyScreen:not([hidden])', timeout=10000)
        await G2.wait_for_function('window.__ra.maps.svijet && window.__ra.net.pres.ld === "svijet:danas"', timeout=60000)
        await H.wait_for_function('!document.getElementById("lobbyGo").disabled', timeout=20000)
        check(True, 'guest downloaded the world, host can start')
        await H.screenshot(path=OUT + 'world_4_lobby_host.png')
        await G2.screenshot(path=OUT + 'world_4_lobby_guest.png')
        await H.click('#lobbyGo')
        await H.wait_for_function('window.__ra.G && window.__ra.G.online', timeout=30000)
        await G2.wait_for_function('window.__ra.G && window.__ra.G.online', timeout=30000)
        maps = [await pg.evaluate('() => window.__ra.G.map.id') for pg in (H, G2)]
        check(maps == ['svijet', 'svijet'], f'online game on the world on both devices {maps}')
        await asyncio.sleep(4)
        await H.evaluate('() => { window.__ra.paused = true; }')
        for _ in range(80):
            ta, tb = [await pg.evaluate('() => window.__ra.G.tick') for pg in (H, G2)]
            if ta == tb:
                break
            await asyncio.sleep(0.15)
        ha, hb = [await pg.evaluate('() => [window.__ra.G.tick, window.__ra.G.hash()]') for pg in (H, G2)]
        check(ha == hb and ha[0] > 0, f'lockstep on the world: {ha} vs {hb}')
        await G2.screenshot(path=OUT + 'world_5_online_guest.png')
        await H.context.close()
        await G2.context.close()

        # 5. no /data on the server (or the claude.ai artifact): only Europe
        N = await page('N', block=('/data/',))
        await N.wait_for_timeout(1500)
        st = await N.evaluate('() => [document.querySelector("#mapSeg button[data-v=svijet]").hidden, document.getElementById("mapField").hidden, window.__ra.mapOK.svijet]')
        check(st == [True, True, False], f'world hidden without /data ({st})')
        await b.close()
    relay.terminate()
    http_srv.shutdown()
    for e in errs:
        print('ERR', e)
    check(not errs, 'no page errors')
    print('\nFAILS:', len(fails))
    sys.exit(1 if fails else 0)


asyncio.run(main())

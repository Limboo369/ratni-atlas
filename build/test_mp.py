"""Online test: two browser sessions joined through the real relay (deploy/game/server.js).
Checks lobby → start, lockstep sync (identical hashes), commands from both players, alliance between humans,
co-op / versus modes, and the host taking over for a guest who leaves."""
import asyncio, sys, json, time
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

R = ROOT
OUT = R + 'build/shots/'
os.makedirs(OUT, exist_ok=True)
LEAF = open(R + 'package/dist/leaflet.js').read()
MODE = sys.argv[1] if len(sys.argv) > 1 else 'vs'
REGION = sys.argv[2] if len(sys.argv) > 2 else 'balkan'
fails = []


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


PORT = 8799


def start_relay():
    """The real online relay (deploy/game/server.js); the page connects to it through window.RA_WS."""
    import subprocess, socket
    srv = subprocess.Popen(['node', R + 'deploy/game/server.js'], env={**os.environ, 'PORT': str(PORT)},
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for _ in range(100):
        try:
            socket.create_connection(('127.0.0.1', PORT), timeout=0.2).close()
            return srv
        except OSError:
            time.sleep(0.1)
    raise RuntimeError('relay did not start')


async def main():
    srv = start_relay()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pages = {}
        ctxs = {}
        errs = []
        for name in ('Darko', 'Marko', 'Ana'):
            ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
            await ctx.add_init_script(f"window.RA_WS = 'ws://127.0.0.1:{PORT}/ws'")
            page = await ctx.new_page()
            page.set_default_timeout(90_000)  # CI (GitHub runner, swiftshader) crta sporo
            page.on('pageerror', lambda e, n=name: errs.append(f'{n} PAGEERROR: {e}'))
            page.on('console', lambda m, n=name: errs.append(f'{n}: {m.text}') if m.type == 'error' and 'ERR_FAILED' not in m.text else None)

            async def route(r):
                u = r.request.url
                if 'leaflet' in u and u.endswith('.js'):
                    await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
                elif u.startswith('file://'):
                    await r.continue_()
                else:
                    await r.abort()
            await page.route('**/*', route)
            pages[name] = page
            ctxs[name] = ctx
        A, B, C = pages['Darko'], pages['Marko'], pages['Ana']
        for pg in (A, B, C):
            await pg.goto('file://' + R + 'dist/test.html')
        for pg in (A, B, C):
            await pg.wait_for_function('document.getElementById("loading").hidden', timeout=60000)
        await A.fill('#nameIn', 'Darko')
        await B.fill('#nameIn', 'Marko')
        await asyncio.sleep(1.2)
        st = await A.evaluate('() => window.__ra.net.status')
        check(st == 'ready', f'room connected ({st})')
        await A.screenshot(path=OUT + 'mp_1_start.png')

        # host opens a room, guest joins
        await A.click('[data-on="host"]')
        await asyncio.sleep(0.8)
        await B.wait_for_selector('#joinBanner [data-on]', timeout=5000)
        await B.screenshot(path=OUT + 'mp_2_joinbtn.png')
        await B.click('#joinBanner [data-on]')
        await asyncio.sleep(1.0)
        # settings + picks
        await A.click(f'#lRegSeg button[data-v="{REGION}"]')
        await A.click(f'#modeSeg button[data-v="{MODE}"]')
        await asyncio.sleep(0.6)
        await A.select_option('#lobbyNat', 'BIH')
        await B.select_option('#lobbyNat', 'SRB')
        await asyncio.sleep(1.0)
        mem = await A.evaluate('() => window.__ra.net.members().map(m => m.name + ":" + m.pick)')
        check(mem == ['Darko:BIH', 'Marko:SRB'], f'lobby members {mem}')
        await A.screenshot(path=OUT + 'mp_3_lobby_host.png')
        await B.screenshot(path=OUT + 'mp_3_lobby_guest.png')

        await A.click('#lobbyGo')
        await asyncio.sleep(2.0)
        info = []
        for pg in (A, B):
            info.append(await pg.evaluate('''() => { const G = window.__ra.G; return { online: !!G.online, me: G.me && G.me.name, humans: G.humans.map(h => h.nick + '@' + h.name), tick: G.tick, team: G.me && G.me.team, seedOk: !!window.__ra.net.st }; }'''))
        print('A', info[0]); print('B', info[1])
        check(info[0]['online'] and info[1]['online'], 'both games online')
        check(info[0]['me'] == 'Bosna i Hercegovina' and info[1]['me'] == 'Srbija', 'each player controls own country')
        check(info[0]['humans'] == info[1]['humans'], 'same players on both devices')
        await A.evaluate('window.__ra.setSpeed(3)')
        # diagnostics: tick rate & frame rate of both devices
        fps_js = '() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); })'
        t0 = [await A.evaluate('() => window.__ra.G.tick'), await B.evaluate('() => window.__ra.G.tick')]
        fa, fb = await asyncio.gather(A.evaluate(fps_js), B.evaluate(fps_js))
        t1 = [await A.evaluate('() => window.__ra.G.tick'), await B.evaluate('() => window.__ra.G.tick')]
        w = await A.evaluate('() => [window.__ra.net.waiting, window.__ra.net.guestInfo[1].t, window.__ra.simMs]')
        print(f'DIAG fps A={fa} B={fb} ticks/2s A={t1[0]-t0[0]} B={t1[1]-t0[1]} host waiting/guestT/simMs={w}')

        async def act(pg, kind, args):
            await pg.evaluate(f'() => window.__ra.ui.act({json.dumps(kind)}, {json.dumps(args)})')

        async def sync_check(label):
            # freeze the host, let the guest catch up, compare the whole game state
            await A.evaluate('() => { window.__ra.paused = true; }')
            for _ in range(80):
                ta = await A.evaluate('() => window.__ra.G.tick')
                tb = await B.evaluate('() => window.__ra.G.tick')
                if ta == tb:
                    break
                await asyncio.sleep(0.15)
            ha = await A.evaluate('() => [window.__ra.G.tick, window.__ra.G.hash()]')
            hb = await B.evaluate('() => [window.__ra.G.tick, window.__ra.G.hash()]')
            check(ha == hb, f'{label}: same tick & state hash {ha} vs {hb}')
            await A.evaluate('() => { window.__ra.paused = false; }')

        # peace: both expand into free land
        for k in range(5):
            for pg in (A, B):
                await pg.evaluate('''() => { const G = window.__ra.G, me = G.me, W = G.map.W; let best = -1;
                    for (let i = 0; i < me.tiles && best < 0; i += 7) { const c = me.cells[i]; for (const n of [c-1, c+1, c-W, c+W]) if (G.map.land[n] && !G.owner[n]) { best = n; break; } }
                    if (best >= 0) window.__ra.ui.act('atk', [best, 0.4]); }''')
            await asyncio.sleep(1.5)
        await sync_check('after expansion')

        # a third player watches the running game (before the test hands out gold outside the command log): replays the server's log from tick 0 and stays in sync
        await C.wait_for_selector('[data-watch]', timeout=10000)
        await C.click('[data-watch]', timeout=15000)
        await A.evaluate('() => { window.__ra.paused = true; }')
        for _ in range(240):
            if await C.evaluate('() => !!(window.__ra.G && window.__ra.G.online) && window.__ra.G.tick') == await A.evaluate('() => window.__ra.G.tick'):
                break
            await asyncio.sleep(0.25)
        ha = await A.evaluate('() => [window.__ra.G.tick, window.__ra.G.hash()]')
        hc = await C.evaluate('() => [window.__ra.G.tick, window.__ra.G.hash(), window.__ra.net.role, !!window.__ra.G.me]')
        check(hc[:2] == ha and hc[2] == 'spec' and not hc[3], f'spectator replays the game in sync {ha} vs {hc}')
        await C.screenshot(path=OUT + 'mp_5_spectator.png')
        await A.evaluate('() => { window.__ra.paused = false; }')
        await A.screenshot(path=OUT + 'mp_4_host_play.png')
        await B.screenshot(path=OUT + 'mp_4_guest_play.png')

        # economy & military commands from both players. Test gold is given to every human on both devices
        # at the same tick (host paused, guest caught up), so the two games stay identical.
        await A.evaluate('() => { window.__ra.paused = true; }')
        for _ in range(80):
            if await A.evaluate('() => window.__ra.G.tick') == await B.evaluate('() => window.__ra.G.tick'):
                break
            await asyncio.sleep(0.15)
        for pg in (A, B):
            await pg.evaluate('() => { for (const h of window.__ra.G.humans) h.gold += 3e6; }')
        await A.evaluate('() => { window.__ra.paused = false; }')
        await asyncio.sleep(0.5)
        for pg in (A, B):
            await pg.evaluate('''() => { const G = window.__ra.G, me = G.me; const c = me.cells[Math.floor(me.tiles / 2)]; window.__ra.ui.act('build', ['city', c]); window.__ra.ui.act('mob', []); }''')
        await asyncio.sleep(2.5)
        await sync_check('after build + mobilize')
        # wait for the end of the peace (host at 3x)
        for _ in range(60):
            t = await A.evaluate('() => window.__ra.G.tick - window.__ra.G.peaceUntil')
            if t > 5:
                break
            await asyncio.sleep(0.5)
        if MODE == 'vs':
            # the guest proposes an alliance to the host, the host accepts
            await act(B, 'aReq', [await A.evaluate('() => window.__ra.G.me.id')])
            await asyncio.sleep(1.5)
            offers = await A.evaluate('() => window.__ra.G.allyReqs.filter(r => r.to === window.__ra.G.me.id).length')
            check(offers == 1, f'host sees the guest\'s alliance offer ({offers})')
            await asyncio.sleep(0.8)
            await A.screenshot(path=OUT + 'mp_5_offer.png')
            await act(A, 'aRes', [await B.evaluate('() => window.__ra.G.me.id'), 1])
            await asyncio.sleep(1.5)
            al = await B.evaluate('() => window.__ra.G.me.allies.has(window.__ra.G.humans[0].id)')
            check(al, 'humans became allies on the guest device too')
        else:
            team = await B.evaluate('() => window.__ra.G.sameTeam(window.__ra.G.humans[0], window.__ra.G.humans[1])')
            check(team, 'co-op: both players in one team')
        # attacks from both sides against AI neighbours
        for pg in (A, B):
            await pg.evaluate('''() => { const G = window.__ra.G, me = G.me; const nb = me.nbCache || new Map();
                for (const [id] of nb) { const o = G.P[id]; if (o && !o.human && !G.isFriendly(me, o)) { window.__ra.ui.act('atk', [o.cells[0], 0.3]); break; } } }''')
        await asyncio.sleep(3)
        await sync_check('after attacks')

        d = [await pg.evaluate('() => window.__ra.net.desync') for pg in (A, B)]
        check(d == [-1, -1], f'no desync reported {d}')

        # a dropped connection (phone switching networks) must not cost the guest their country
        await B.evaluate('() => window.__ra.net.room.kick()')
        await asyncio.sleep(4)
        ai = await A.evaluate('() => !!window.__ra.G.humans[1].ai')
        check(not ai, 'guest reconnected after a dropped connection (no takeover)')
        await sync_check('after reconnect')

        # the guest leaves: the host's computer takes over the guest's country
        await ctxs['Marko'].close()
        for _ in range(60):  # relay grace 5 s + takeover after 8 s; slow CI needs more
            await asyncio.sleep(0.5)
            ai = await A.evaluate('() => !!window.__ra.G.humans[1].ai')
            if ai:
                break
        check(ai, 'guest left → computer took over the country')
        await A.screenshot(path=OUT + 'mp_6_left.png')
        print('\n'.join(errs[:20]) or 'no page errors')
        if errs:
            fails.append('page errors')
        await b.close()
    srv.terminate()
    out = srv.communicate()[0]
    check('too big' not in out, 'presence stayed under 4 KiB')
    print('FAILS:', fails if fails else 'none')

asyncio.run(main())
sys.exit(1 if fails else 0)

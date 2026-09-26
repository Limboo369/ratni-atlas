"""Conquest League in the browser against the real game server (ratings in memory, no accounts API here):
Online → Conquest League → Find match on two browsers, the pick/ban sheet (pick, ban, lock), the reveal draws from the
picks, both land in the same league game (players only, their own states), a surrender vote ends it and the winner's
rating goes up. The server side in detail: build/test_league.js.
python3 build/test_league.py"""
import asyncio, os, socket, subprocess, sys, tempfile, time
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
LEAF = open(R + 'package/dist/leaflet.js').read()
fails = []
_s = socket.socket()
_s.bind(('127.0.0.1', 0))
PORT = _s.getsockname()[1]
_s.close()
DATA = tempfile.mkdtemp(prefix='league-')


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


def start_server():
    srv = subprocess.Popen(['node', R + 'deploy/game/server.js'], env={**os.environ, 'PORT': str(PORT), 'LONG_DIR': DATA, 'LEAGUE_PICK_S': '20', 'LEAGUE_WAIT': '3'},
                           stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    for _ in range(100):
        try:
            socket.create_connection(('127.0.0.1', PORT), timeout=0.2).close()
            return srv
        except OSError:
            time.sleep(0.1)
    raise RuntimeError('server did not start')


async def page_for(b, name, errs):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
    await ctx.add_init_script(f"window.RA_WS = 'ws://127.0.0.1:{PORT}/ws'")
    pg = await ctx.new_page()
    pg.set_default_timeout(60_000)
    pg.on('pageerror', lambda e: errs.append(f'{name}: {e}'))

    async def route(r):
        u = r.request.url
        if 'leaflet' in u and u.endswith('.js'):
            await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
        elif u.startswith('file://'):
            await r.continue_()
        else:
            await r.abort()
    await pg.route('**/*', route)
    await pg.goto('file://' + R + 'dist/test.html')
    await pg.wait_for_function('document.getElementById("loading").hidden', timeout=60000)
    await pg.fill('#nameIn', name)
    return ctx, pg


async def main():
    srv = start_server()
    time.sleep(2)  # the server's simulation boots
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        _, A = await page_for(b, 'Darko', errs)
        _, B = await page_for(b, 'Marko', errs)
        for pg in (A, B):
            await pg.click('#sideSeg [data-v="online"]')
            await pg.click('#leagueBtn')
            await pg.wait_for_selector('#lgSheet', state='attached')
            await pg.wait_for_function('window.__ra.league && window.__ra.league.elo', timeout=10000)
        txt = await A.evaluate('document.getElementById("sheet").textContent')
        check('Blitz 1v1' in txt and 'ELO 500' in txt and 'Unranked' in txt, 'the league sheet: my ladder, ELO 500, placement')
        await A.click('#lgFind')
        await A.wait_for_function('window.__ra.league.queue', timeout=10000)
        check('Tražim' in await A.evaluate('document.getElementById("lgFind").textContent'), 'Find match: searching…')
        await B.click('#lgFind')
        for pg in (A, B):
            await pg.wait_for_selector('#lgPick', state='attached', timeout=15000)
        # Darko: Evropa + WW2 picked, the world banned; Marko: Evropa + WW2 picked, Afrika banned
        for pg, ban in ((A, 'svijet'), (B, 'afrika')):
            await pg.click('.lg-chip[data-k="map"][data-v="evropa"]')
            await pg.click(f'.lg-chip[data-k="map"][data-v="{ban}"]')
            await pg.click(f'.lg-chip[data-k="map"][data-v="{ban}"]')
            await pg.click('.lg-chip[data-k="era"][data-v="ww2"]')
        st = await A.evaluate('[...document.querySelectorAll(".lg-chip")].filter(e => e.classList.contains("pick") || e.classList.contains("ban")).map(e => e.dataset.v + ":" + e.className.split(" ").pop())')
        check('evropa:pick' in st and 'svijet:ban' in st and 'ww2:pick' in st, f'pick/ban chips: once = pick, twice = ban {st}')
        await A.click('#lgLock')
        await B.click('#lgLock')
        await A.wait_for_selector('#lgReveal', state='attached', timeout=15000)
        rv = await A.evaluate('window.__ra.league.reveal.chosen')
        check(rv == {'map': 'evropa', 'era': 'ww2'}, f'the reveal: the draw lands on the only pick nobody banned {rv}')
        for pg in (A, B):
            await pg.wait_for_function('window.__ra.G && window.__ra.G.opts.league === 1 && window.__ra.G.me && !window.__ra.long.replaying', timeout=60000)
        info = await A.evaluate('(() => { const G = window.__ra.G; return [G.P.filter(p => p && p.alive).length, G.P.filter(p => p && p.alive).every(p => p.human), G.me.nick, G.me.team, G.me.tiles]; })()')
        check(info[0] == 2 and info[1] and info[2] == 'Darko' and info[4] < 60, f'the league game: only the two players, mine from a small field {info}')
        await A.wait_for_function('window.__ra.G.tick > 5', timeout=30000)
        await A.evaluate("window.__ra.ui.act('surr', [])")
        await B.wait_for_function('window.__ra.G.state === "over"', timeout=30000)
        await B.wait_for_function('window.__ra.league.elo.b1.elo !== 500', timeout=30000)
        eb = await B.evaluate('window.__ra.league.elo.b1')
        toast = await B.evaluate('document.body.textContent')
        check(eb['elo'] == 520 and 'pobjeda' in toast and '+20' in toast, f'surrender → Marko wins, ELO 520 (+20) {eb}')
        check(not errs, f'no page errors {errs[:3]}')
        await b.close()
    srv.terminate()
    print('\n' + ('ALL OK' if not fails else f'{len(fails)} FAILED: {fails}'))
    sys.exit(1 if fails else 0)


asyncio.run(main())

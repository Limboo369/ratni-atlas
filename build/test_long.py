"""Long games (days) against the real server (deploy/game/server.js + long.js) with a fast clock:
create a game, take over a state, play, a second player joins through the code and replays the record to the same
game (identical hashes), the first one leaves (the computer takes over) and comes back (the state is theirs again),
and the record survives a server restart.
python3 build/test_long.py"""
import asyncio, os, socket, subprocess, sys, tempfile, time
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
LEAF = open(R + 'package/dist/leaflet.js').read()
fails = []
_s = socket.socket()
_s.bind(('127.0.0.1', 0))
PORT = _s.getsockname()[1]
_s.close()
DATA = tempfile.mkdtemp(prefix='long-')


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


def start_server():
    srv = subprocess.Popen(['node', R + 'deploy/game/server.js'], env={**os.environ, 'PORT': str(PORT), 'LONG_DIR': DATA, 'LONG_TICK_MS': '250'},
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for _ in range(100):
        try:
            socket.create_connection(('127.0.0.1', PORT), timeout=0.2).close()
            return srv
        except OSError:
            time.sleep(0.1)
    raise RuntimeError('server did not start')


async def page_for(b, name, errs, uid=None):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
    await ctx.add_init_script(f"window.RA_WS = 'ws://127.0.0.1:{PORT}/ws'" + (f"; localStorage.setItem('ra_uid', '{uid}')" if uid else ''))
    pg = await ctx.new_page()
    pg.set_default_timeout(90_000)
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

# take the biggest free state from the pick sheet
TAKE = '''() => { const b = document.querySelector('#sheet [data-take]'); if (!b) return -1; b.click(); return +b.dataset.take; }'''
HASHES = '''() => { const G = window.__ra.G; if (G._hh) return true; G._hh = {}; const s = G.step.bind(G); G.step = () => { s(); G._hh[G.tick] = G.hash(); }; return true; }'''


async def main():
    srv = start_server()
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctxA, A = await page_for(b, 'Darko', errs)
        await A.evaluate('''() => { Object.assign(window.__ra.ui.settings, { pace: 'custom', cPace: 'focus', map: 'evropa', region: 'balkan', era: 'danas', gm: 'klasik', difficulty: 'lako', peace: 0 }); window.__ra.long.create(); }''')
        await A.wait_for_function('window.__ra.G && window.__ra.G.long && !window.__ra.long.replaying && document.querySelector("#sheet [data-take]")', timeout=60000)
        code = await A.evaluate('window.__ra.long.code')
        check(len(code) == 6, f'a long game is created: {code}')
        ta = await A.evaluate(TAKE)
        await A.wait_for_function(f'window.__ra.G.me && window.__ra.G.me.id === {ta}', timeout=20000)
        check(True, f'Darko takes over a state ({await A.evaluate("window.__ra.G.me.name")})')
        await A.evaluate(HASHES)
        # a command goes through the server and runs at the stamped tick
        await A.evaluate('''() => { const G = window.__ra.G, me = G.me, W = G.map.W; for (let i = 0; i < me.tiles; i++) { const c = me.cells[i]; for (const n of [c - 1, c + 1, c - W, c + W]) { const o = G.P[G.owner[n]]; if (o && o !== me && o.type === 'nation') { window.__ra.ui.act('atk', [n, 0.2, 0]); return; } } } }''')
        await A.wait_for_function('window.__ra.G.attacks.some(a => !a.done && a.a === window.__ra.G.me.id) || window.__ra.G.feed.some(f => f.t === "war" && f.a === window.__ra.G.me.id)', timeout=20000)
        check(True, 'the attack command is run by the server clock')
        # the server plays the same game itself (deploy/game/simhost.js): its checksum matches this device's
        await asyncio.sleep(3)
        await A.evaluate("() => { window.__ra.long.simSt = undefined; window.__ra.long.ws.send(JSON.stringify({ sim: 1 })); }")
        await A.wait_for_function('window.__ra.long.simSt !== undefined', timeout=30000)
        # the device may be a little behind the server: wait until it has played the server's tick
        await A.wait_for_function('() => { const st = window.__ra.long.simSt; return !st || window.__ra.G.tick > st.tick; }', timeout=30000)
        sv = await A.evaluate('() => { const st = window.__ra.long.simSt, h = window.__ra.G._hh; return st ? [st.tick, st.hash, h[st.tick]] : null; }')
        check(sv and sv[0] > 0 and sv[1] == sv[2], f'the server simulates the same game (tick, server hash, device hash) {sv}')
        # Marko opens the same game: replays it and takes another state
        ctxB, B = await page_for(b, 'Marko', errs)
        await B.evaluate(f"window.__ra.long.open('{code}')")
        await B.wait_for_function('window.__ra.G && window.__ra.G.long && !window.__ra.long.replaying && document.querySelector("#sheet [data-take]")', timeout=60000)
        tb = await B.evaluate(TAKE)
        await B.wait_for_function(f'window.__ra.G.me && window.__ra.G.me.id === {tb}', timeout=20000)
        await B.evaluate(HASHES)
        for _ in range(40):  # both devices have played the same ticks for a while (a slow machine needs longer)
            await asyncio.sleep(0.5)
            if await B.evaluate('Object.keys(window.__ra.G._hh).length') >= 12:
                break
        cmp = await A.evaluate('''(hb) => { const h = window.__ra.G._hh; const common = Object.keys(hb).filter((t) => h[t] !== undefined); return [common.length, common.filter((t) => h[t] !== hb[t]).length]; }''', await B.evaluate('window.__ra.G._hh'))
        check(cmp[0] >= 5 and cmp[1] == 0, f'both devices play the same game (ticks compared {cmp[0]}, different {cmp[1]})')
        hum = await B.evaluate(f'() => {{ const G = window.__ra.G; return [G.P[{ta}].human, G.P[{ta}].nick, G.P[{tb}].human]; }}')
        check(hum[0] and hum[1] == 'Darko' and hum[2], f'Marko sees Darko in the game {hum}')
        # Darko leaves: the computer plays his state
        uid = await A.evaluate("localStorage.getItem('ra_uid')")
        await ctxA.close()
        await B.wait_for_function(f'!!window.__ra.G.P[{ta}].ai', timeout=20000)
        check(True, 'Darko left: the computer takes over his state')
        # Darko comes back (his browser keeps the same id): his state is his again
        ctxA2, A2 = await page_for(b, 'Darko', errs, uid)
        await A2.evaluate(f"window.__ra.long.open('{code}')")
        await A2.wait_for_function(f'window.__ra.G && window.__ra.G.long && !window.__ra.long.replaying && window.__ra.G.me && window.__ra.G.me.id === {ta}', timeout=60000)
        await B.wait_for_function(f'!window.__ra.G.P[{ta}].ai', timeout=20000)
        check(True, 'Darko is back: the same state, the computer let go')
        # Focus: the main menu keeps the game ("Nastavi Focus igru"), coming back shows "Dok te nije bilo"
        fe = await A2.evaluate(f"RA.focusGet('{code}')")
        check(fe and fe.get('title') and fe.get('snap'), f'the game is in my Focus list: {fe and fe.get("title")}')
        await A2.click('#menuBtn')
        await A2.click('#sheet [data-m="home"]')
        await A2.wait_for_function('!document.getElementById("startScreen").hidden && !document.getElementById("focusBtn").hidden', timeout=20000)
        await B.wait_for_function(f'!!window.__ra.G.P[{ta}].ai', timeout=20000)
        check(True, 'Glavni meni: the game goes on (computer), the start screen offers "Nastavi Focus igru"')
        await asyncio.sleep(7)
        await A2.click('#focusBtn')
        await A2.wait_for_function('document.getElementById("sheet").textContent.includes("Dok te nije bilo")', timeout=60000)
        rep = await A2.evaluate('document.getElementById("sheet").textContent')
        check('Teritorija' in rep and 'Vojska' in rep, 'back in the game: the "Dok te nije bilo" report')
        await A2.evaluate('window.__ra.ui.closeSheet()')
        # "Napusti igru": two warnings, then the progress is gone for good
        await A2.click('#menuBtn')
        await A2.click('#sheet [data-m="leave"]')
        await A2.click('#sheet [data-y]')
        await A2.wait_for_function('document.getElementById("sheet").textContent.includes("Sigurno")', timeout=5000)
        check(True, 'leaving asks twice')
        await A2.click('#sheet [data-y]')
        await A2.wait_for_function('!document.getElementById("startScreen").hidden', timeout=20000)
        gone = await A2.evaluate(f"[document.getElementById('focusBtn').hidden, !RA.focusGet('{code}')]")
        await B.wait_for_function(f'!!window.__ra.G.P[{ta}].ai', timeout=20000)
        await A2.evaluate(f"window.__ra.long.open('{code}')")
        await A2.wait_for_function('window.__ra.G && window.__ra.G.long && !window.__ra.long.replaying && document.querySelector("#sheet [data-take]")', timeout=60000)
        mine = await A2.evaluate(f'[window.__ra.long.you, window.__ra.G.me && window.__ra.G.me.id === {ta}]')
        check(gone == [True, True] and mine[0] == -1 and not mine[1], f'after "Napusti" the game is off my list and my seat is gone {gone} {mine}')
        await ctxA2.close()
        # the server restarts: the record is on disk
        srv.terminate()
        srv.wait(5)
        files = os.listdir(DATA)
        check(any(f == code + '.json' for f in files), f'the game is saved on disk ({files})')
        srv = start_server()
        ctxC, C = await page_for(b, 'Ana', errs)
        await C.evaluate(f"window.__ra.long.open('{code}')")
        await C.wait_for_function('window.__ra.G && window.__ra.G.long && !window.__ra.long.replaying', timeout=60000)
        seen = await C.evaluate(f'() => {{ const G = window.__ra.G; return [G.P[{ta}].nick, G.P[{tb}].nick, G.tick]; }}')
        check(seen[0] == 'Darko' and seen[1] == 'Marko' and seen[2] > 20, f'after a server restart the game goes on {seen}')
        # Focus from the start screen: ~7 days turns the clock 7× slower
        ctxD, D = await page_for(b, 'Vedad', errs)
        await D.click('#paceSeg [data-v=focus]')
        await D.click('#daysSeg [data-v="7"]')
        await D.click('#goBtn')
        await D.click('#sheet [data-y]')
        await D.wait_for_function('window.__ra.long.rec', timeout=60000)
        tm = await D.evaluate('[window.__ra.long.rec.tickMs, window.__ra.long.rec.set.days]')
        check(tm == [250 * 7, 7], f'Focus ~7 days: the clock is 7x slower {tm}')
        check(not errs, f'no page errors {errs[:3]}')
        await b.close()
    srv.terminate()
    print('\n' + ('ALL OK' if not fails else f'{len(fails)} FAILED: {fails}'))
    sys.exit(1 if fails else 0)


asyncio.run(main())

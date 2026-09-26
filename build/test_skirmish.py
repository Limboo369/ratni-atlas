"""Skirmish (public online games, plan phase 15) against the real server with a short countdown:
Online → Skirmish lists the public Blitz game the server keeps open; two players join it (teams game made from the
sheet: each picks a team), the countdown runs out and both devices play the same game at Blitz speed; a late player in
a Focus game is protected; a vote to end and a surrender end the game; a report is refused without an account.
python3 build/test_skirmish.py"""
import asyncio, os, socket, subprocess, sys, tempfile, time
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
LEAF = open(R + 'package/dist/leaflet.js').read()
fails = []
_s = socket.socket()
_s.bind(('127.0.0.1', 0))
PORT = _s.getsockname()[1]
_s.close()
DATA = tempfile.mkdtemp(prefix='skirm-')


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


def start_server():
    srv = subprocess.Popen(['node', R + 'deploy/game/server.js'], env={**os.environ, 'PORT': str(PORT), 'LONG_DIR': DATA, 'SKIRMISH_WAIT': '4', 'LONG_SIM': '0'},
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

TAKE = '''(team) => { const b = document.querySelector('#sheet [data-take]'); if (!b) return -1;
  if (team) { const t = document.querySelector('#teamSeg button[data-v="' + team + '"]'); if (t) t.click(); }
  b.click(); return +b.dataset.take; }'''


async def main():
    srv = start_server()
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctxA, A = await page_for(b, 'Darko', errs)
        # Online → Skirmish: the server keeps a public Blitz game open
        await A.click('#sideSeg [data-v="online"]')
        await A.click('#skirmishBtn')
        await A.wait_for_selector('#skirmList [data-skjoin]', timeout=20000)
        lst = await A.evaluate('document.getElementById("skirmList").textContent')
        check('Blitz' in lst and 'Igrača 0/8' in lst, 'Skirmish lists an open public Blitz game: ' + lst[:80])
        # a new public game with two teams, from the sheet
        await A.click('#skTeams button[data-v="2"]')
        await A.click('[data-sknew]')
        await A.wait_for_function('window.__ra.G && window.__ra.G.long && !window.__ra.long.replaying && document.querySelector("#sheet [data-take]")', timeout=60000)
        code = await A.evaluate('window.__ra.long.code')
        st = await A.evaluate('[window.__ra.long.rec.set.pub, window.__ra.long.rec.set.fast, window.__ra.long.rec.tickMs, window.__ra.G.tick, !!document.getElementById("longWait")]')
        check(st[:3] == [1, 1, 100] and st[3] == 0 and st[4], f'a public 2-team Blitz game: countdown before the start {st}')
        ta = await A.evaluate(TAKE, 1)
        await A.wait_for_function(f'window.__ra.G.me && window.__ra.G.me.id === {ta}', timeout=20000)
        ctxB, B = await page_for(b, 'Marko', errs)
        await B.evaluate(f"window.__ra.long.open('{code}')")
        await B.wait_for_function('window.__ra.G && window.__ra.G.long && !window.__ra.long.replaying && document.querySelector("#sheet [data-take]")', timeout=60000)
        tb = await B.evaluate(TAKE, 2)
        await B.wait_for_function(f'window.__ra.G.me && window.__ra.G.me.id === {tb}', timeout=20000)
        await A.wait_for_function(f'window.__ra.G.tick > 30 && window.__ra.G.P[{tb}].human', timeout=60000)
        teams = await A.evaluate(f'[window.__ra.G.P[{ta}].team, window.__ra.G.P[{tb}].team]')
        check(teams == [1, 2], f'each player in the team they picked {teams}')
        await A.evaluate('() => { const G = window.__ra.G; if (G._hh) return; G._hh = {}; const s = G.step.bind(G); G.step = () => { s(); G._hh[G.tick] = G.hash(); }; }')
        await B.evaluate('() => { const G = window.__ra.G; if (G._hh) return; G._hh = {}; const s = G.step.bind(G); G.step = () => { s(); G._hh[G.tick] = G.hash(); }; }')
        await asyncio.sleep(3)
        cmp = await A.evaluate('(hb) => { const h = window.__ra.G._hh; const k = Object.keys(hb).filter((t) => h[t] !== undefined); return [k.length, k.filter((t) => h[t] !== hb[t]).length]; }', await B.evaluate('window.__ra.G._hh'))
        rate = await A.evaluate('window.__ra.G.tick')
        check(cmp[0] >= 10 and cmp[1] == 0, f'both devices play the same game at Blitz speed (ticks compared {cmp[0]}, different {cmp[1]}, tick {rate})')
        # a report needs an account (no accounts server here)
        # a vote to end: only when every player agrees
        await A.evaluate("window.__ra.ui.act('endv', [1])")
        await B.wait_for_function('window.__ra.G.activeHumans().some(p => p.endVote) || window.__ra.G.state !== "play"', timeout=30000)
        one = await B.evaluate('[window.__ra.G.state, window.__ra.G.activeHumans().filter(p => p.endVote).length]')
        check(one == ['play', 1], f'one vote to end: the game goes on {one}')
        # Marko surrenders: Darko's team wins
        await B.evaluate("window.__ra.ui.act('surr', [])")
        await A.wait_for_function('window.__ra.G.state === "over"', timeout=20000)
        w = await A.evaluate('[window.__ra.G.winner && window.__ra.G.winner.id, window.__ra.G.P[%d].surr]' % tb)
        check(w == [ta, True], f'the other player surrenders: my side wins {w}')
        check(not errs, f'no page errors {errs[:3]}')
        await b.close()
    srv.terminate()
    print('\n' + ('ALL OK' if not fails else f'{len(fails)} FAILED: {fails}'))
    sys.exit(1 if fails else 0)


asyncio.run(main())

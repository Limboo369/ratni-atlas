"""Account UI test: Google sign-in on the start screen, name, stays signed in after a reload, logout.
The page and /api/ come from `node build/api_fixture.js serve` (real API + PostgreSQL, fake Google keys);
Google's GSI script is replaced by a stub whose button hands the page a token signed by the fake Google.
python3 build/test_account.py"""
import asyncio, json, os, subprocess, sys
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


GSI = '''window.google = { accounts: { id: {
  initialize(o) { window.__gsi = o; },
  renderButton(el) { const b = document.createElement('button'); b.id = 'fakeGoogle'; b.textContent = 'Nastavi s Google-om';
    b.onclick = () => window.__gsi.callback({ credential: window.__TOK }); el.appendChild(b); },
  disableAutoSelect() {},
} } };'''


async def main():
    fx = subprocess.Popen(['node', R + 'build/api_fixture.js', 'serve'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    info = json.loads(fx.stdout.readline())
    url, tok = info['url'], info['tokens']
    # the online relay that wants an account (as on the server): it asks /api/me about the session cookie
    import socket
    s_ = socket.socket(); s_.bind(('127.0.0.1', 0)); wsport = s_.getsockname()[1]; s_.close()
    relay = subprocess.Popen(['node', R + 'deploy/game/server.js'], env={**os.environ, 'PORT': str(wsport), 'API_URL': url, 'REQUIRE_LOGIN': '1', 'LONG_SIM': '0', 'LONG_DIR': '/tmp/ra-acc-long'}, stdout=subprocess.DEVNULL)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            ctx = await b.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=2, is_mobile=True, has_touch=True)
            page = await ctx.new_page()
            page.set_default_timeout(60_000)
            errs = []
            page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))

            async def route(r):
                u = r.request.url
                if u.startswith('https://accounts.google.com/gsi/client'):
                    await r.fulfill(status=200, content_type='application/javascript', body=GSI)
                elif 'leaflet' in u and u.endswith('.js'):
                    await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
                elif u.startswith(url) or u.startswith('file://'):
                    await r.continue_()
                else:
                    await r.abort()
            await ctx.route('**/*', route)
            await ctx.add_init_script(f"window.RA_WS = 'ws://127.0.0.1:{wsport}/ws'")
            WS_TRY = '''() => new Promise((ok) => { const w = new WebSocket(window.RA_WS + '?room=acct42'); w.onopen = () => w.send(JSON.stringify({ hello: {} }));
              w.onmessage = (e) => { ok('all:' + JSON.parse(e.data).t); w.close(); }; w.onclose = (e) => ok('close:' + e.code); setTimeout(() => ok('timeout'), 8000); })'''

            async def ev(js):
                return await page.evaluate(js)

            async def load(u):
                await page.goto(u)
                await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)

            # without our server (file://) there is no account button
            await load('file://' + R + 'dist/test.html')
            await page.wait_for_timeout(500)
            check(await ev('document.getElementById("accountBtn").hidden'), 'no account button without the accounts server')

            await load(url + '/')
            await page.wait_for_function('!document.getElementById("accountBtn").hidden', timeout=10_000)
            check(not await ev('document.getElementById("accountBtn").classList.contains("on")'), 'account button shown, signed out')
            check(await ev('!document.getElementById("profileBtn").hidden && document.getElementById("profileBtn").textContent.includes("Prijava")'), 'start screen: "Prijava" button')
            # online needs an account: the relay closes a signed-out socket (4401), the page asks to sign in first
            check(await ev(WS_TRY) == 'close:4401', 'signed out: the online server refuses a room (4401)')
            await page.click('#sideSeg [data-v="online"]')
            await page.click('#onlineToggle')
            await page.wait_for_selector('#fakeGoogle')
            check(await ev('document.getElementById("onlineBox").hidden'), 'Online → Privatna soba signed out: the sign-in sheet instead of the room')
            await ev('window.__ra.ui.closeSheet()')
            await page.click('#profileBtn')
            await page.wait_for_selector('#fakeGoogle')
            check(await ev('window.__gsi && window.__gsi.client_id') == 'test-client.apps.googleusercontent.com', 'Google sign-in set up with the client id from the server')
            await page.screenshot(path=OUT + 'account_1_signin.png')

            # a token Google didn't sign is refused
            await ev(f'window.__TOK = {json.dumps(tok["evil"])}')
            await page.click('#fakeGoogle')
            await page.wait_for_timeout(800)
            check(not await ev('document.getElementById("accountBtn").classList.contains("on")'), 'forged token: still signed out')

            await ev(f'window.__TOK = {json.dumps(tok["darko"])}')
            await page.click('#fakeGoogle')
            await page.wait_for_function('document.getElementById("accountBtn").classList.contains("on")', timeout=10_000)
            check(True, 'signed in with Google')
            check(await ev(WS_TRY) == 'all:all', 'signed in: the online server lets me into a room')
            check(await ev('document.getElementById("nameIn").value') == 'Darko', 'account name fills the empty name field')
            await page.wait_for_selector('#accName')
            check(await ev('document.getElementById("accName").value') == 'Darko', 'the open sheet switches to the account view')
            await page.screenshot(path=OUT + 'account_2_signed_in.png')
            ow = await ev('() => { const s = document.getElementById("sheet"); return [s.scrollWidth, s.clientWidth, document.documentElement.scrollWidth, innerWidth]; }')
            check(ow[0] <= ow[1] + 1 and ow[2] <= ow[3] + 1, f'account sheet fits a 375 px phone {ow}')

            await page.fill('#accName', 'Vojvoda')
            await page.click('#accSave')
            await page.wait_for_function('document.getElementById("nameIn").value === "Vojvoda"', timeout=10_000)
            check(True, 'new name saved to the account and the name field')

            # a finished game goes to the account: play a short single-player game on the Balkans and win it
            await ev('window.__ra.ui.closeSheet()')
            await ev('() => { const ui = window.__ra.ui; ui.settings.region = "balkan"; ui.settings.start = "granice"; ui.settings.era = "danas"; ui.noTips = true; }')
            await page.click('#onlineToggle')
            check(await ev('!document.getElementById("onlineBox").hidden'), 'signed in: Online → Privatna soba opens the room box')
            await page.click('#onlineToggle')
            await page.click('#sideSeg [data-v="solo"]')
            await page.click('#goBtn')
            await page.wait_for_function('window.__ra.G && window.__ra.G.state === "spawn" || !document.getElementById("spawnBar").hidden', timeout=30_000)
            await ev('() => { const G = window.__ra.G; const n = G.P.find(p => p && p.iso === "BIH") || G.P.find(p => p && p.type === "nation"); window.__ra.ui.pickNation(String(n.id)); }')
            await page.wait_for_timeout(300)
            await page.click('#startBtn')
            await ev('() => { const a = window.__ra, G = a.G; a.paused = true; for (let i = 0; i < 700; i++) G.step(); G.winner = G.me; G.state = "over"; a.gameOver("over"); }')
            await page.wait_for_function('[...document.querySelectorAll("#toasts .toast")].some(t => t.textContent.includes("Prva pobjeda"))', timeout=15_000)
            check(True, 'winning a game unlocks "Prva pobjeda" (toast)')
            check(await ev('!document.getElementById("endScreen").hidden'), 'end screen shown')
            check(await ev('!document.getElementById("contBtn").hidden'), 'winner may continue the game ("Nastavi igru")')
            await page.click('#contBtn')
            cont = await ev('() => { const a = window.__ra; return [a.G.state, document.getElementById("endScreen").hidden, a.G.continued]; }')
            check(cont == ['play', True, True], f'game continues after the win {cont}')
            n_sent = await ev('() => { const a = window.__ra, G = a.G; G.state = "over"; a.gameOver("over"); return [a.ui.account.sent.size, document.getElementById("contBtn").hidden]; }')
            check(n_sent == [1, True], f'the same game is sent once; no second "continue" {n_sent}')
            await ev('window.__ra.showStart()')
            await page.wait_for_function('document.getElementById("profileBtn").textContent.includes("Vojvoda")', timeout=10_000)
            check(True, 'start screen: profile button with my name')
            await page.click('#profileBtn')
            await page.wait_for_selector('.acc-grid')
            await page.wait_for_selector('.hist li.w')
            rank = await ev('document.getElementById("accRank").textContent')
            check('Vojnik' in rank and 'Kaplar' in rank, 'status: ' + rank)
            await page.click('#embBtn')
            await page.click('[data-emb="kruna"]')
            await page.wait_for_function('window.__ra.ui.account.user.icon === "kruna"', timeout=10_000)
            check(await ev('document.querySelector("#accountBtn .emb") !== null && document.querySelector("#profileBtn .emb") !== null'), 'new emblem on the start screen buttons')
            await page.wait_for_selector('.hist li.w')
            st = await ev('window.__ra.ui.account.stats.stats')
            check(st['games'] == 1 and st['wins'] == 1 and st['fastest'] >= 60, f'account stats: {st["games"]} game, {st["wins"]} win, {st["fastest"]} s')
            on = await ev('[...document.querySelectorAll(".ach.on b")].map(b => b.textContent)')
            check('Prva pobjeda' in on, 'unlocked achievements highlighted: ' + ', '.join(on))
            await page.screenshot(path=OUT + 'account_3_stats.png')
            ow = await ev('() => { const s = document.getElementById("sheet"); return [s.scrollWidth, s.clientWidth]; }')
            check(ow[0] <= ow[1] + 1, f'stats sheet fits a 375 px phone {ow}')
            await page.click('#accTop')
            await page.wait_for_selector('.top-list li.me')
            first = await ev('document.querySelector(".top-list li").textContent')
            check('Vojvoda' in first, 'leaderboard: me first: ' + first)
            await page.screenshot(path=OUT + 'account_4_top.png')
            await page.click('#topSeg button[data-v="online"]')
            await page.wait_for_function('document.getElementById("topList").textContent.includes("Budi prvi")', timeout=10_000)
            check(True, 'online leaderboard empty (no online wins yet)')
            await ev('window.__ra.ui.closeSheet()')

            # a reload keeps the session (HttpOnly cookie)
            await load(url + '/')
            try:
                await page.wait_for_function('document.getElementById("accountBtn").classList.contains("on")', timeout=15_000)
            except Exception:
                diag = await ev('fetch("/api/me").then(async r => r.status + " " + await r.text()).catch(e => "fetch failed: " + e)')
                cookies = [c['name'] + ' path=' + c['path'] + ' domain=' + c['domain'] for c in await ctx.cookies()]
                print('DIAG reload: /api/me ->', diag[:300], '| cookies:', cookies, '| account.ok =', await ev('window.__ra.ui.account.ok'))
            me = await ev('window.__ra.ui.account.user')
            check(me and me['name'] == 'Vojvoda', 'still signed in after a reload: ' + str(me and me['name']))

            await page.click('#accountBtn')
            await page.wait_for_selector('#accOut')
            await page.click('#accOut')
            await page.wait_for_function('!document.getElementById("accountBtn").classList.contains("on")', timeout=10_000)
            await load(url + '/')
            await page.wait_for_function('!document.getElementById("accountBtn").hidden', timeout=10_000)
            check(not await ev('document.getElementById("accountBtn").classList.contains("on")'), 'signed out after a reload')
            check(not errs, 'no page errors ' + str(errs[:3]))
            await b.close()
    finally:
        relay.terminate()
        fx.stdin.close()
        fx.wait(timeout=20)
    print('FAILS:', fails or 'none')
    sys.exit(1 if fails else 0)


asyncio.run(main())

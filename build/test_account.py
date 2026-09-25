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
            await page.click('#accountBtn')
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

            # a reload keeps the session (HttpOnly cookie)
            await load(url + '/')
            await page.wait_for_function('document.getElementById("accountBtn").classList.contains("on")', timeout=10_000)
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
        fx.stdin.close()
        fx.wait(timeout=20)
    print('FAILS:', fails or 'none')
    sys.exit(1 if fails else 0)


asyncio.run(main())

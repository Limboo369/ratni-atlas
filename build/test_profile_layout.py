"""Profile presentation with deterministic API fixtures; real auth remains in test_account.py.
Checks the expanded launcher, long names, profile edits and leaderboard at small and large sizes.
"""
import asyncio, functools, http.server, json, threading
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'build/shots'
LEAF = (ROOT / 'package/dist/leaflet.js').read_text()

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

async def main():
    OUT.mkdir(exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            for width, height in [(1440, 1000), (375, 812), (320, 680), (844, 390)]:
                ctx = await browser.new_context(viewport={'width': width, 'height': height}, has_touch=width < 600)
                pg = await ctx.new_page()
                pg.set_default_timeout(60000)
                errors = []
                pg.on('pageerror', lambda e: errors.append(str(e)))
                user = {'id': '1', 'name': 'Aleksandar Veliki', 'email': 'komandant@example.com', 'icon': 'orao', 'since': '2026-09-01'}
                stats = {'stats': {'games': 32, 'wins': 18, 'onlineWins': 7, 'peak': 84.5, 'fastest': 784, 'kills': 67, 'cities': 142, 'secs': 42700,
                                  'rank': {'title': 'Narednik', 'level': 4, 'min': 10, 'next': {'title': 'Poručnik', 'wins': 25}}},
                         'achievements': [{'name': n, 'desc': d, 'at': a} for n, d, a in [
                             ('Prva pobjeda', 'Završi svoju prvu pobjedničku operaciju.', '2026-09-01'),
                             ('Graditelj carstva', 'Preuzmi kontrolu nad 50 gradova.', '2026-09-02'),
                             ('Svjetska sila', 'Osvoji više od 70% svijeta.', None),
                             ('Gospodar historije', 'Pobijedi u svakom od sedam doba.', None)]],
                         'recent': [{'region': 'balkan', 'map': 'evropa', 'era': 'danas', 'won': won, 'at': '2026-09-25T10:00:00Z', 'secs': 1420, 'peak': 72.5} for won in [True, False, True]]}
                async def route(r):
                    u = r.request.url
                    if '/api/' in u:
                        if '/api/me' in u: data = {'user': None, 'google': ''}
                        elif '/api/stats' in u: data = stats
                        elif '/api/top' in u: data = {'rows': [{'rank': 1, 'name': user['name'], 'icon': user['icon'], 'wins': 18, 'games': 32, 'online': 7, 'me': True}], 'me': None}
                        elif '/api/name' in u:
                            user['name'] = r.request.post_data_json['name']
                            data = {'user': user}
                        elif '/api/icon' in u:
                            user['icon'] = r.request.post_data_json['icon']
                            data = {'user': user}
                        else: data = {'ok': True}
                        await r.fulfill(status=200, content_type='application/json', body=json.dumps(data))
                    elif 'leaflet' in u and u.endswith('.js'):
                        await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
                    elif u.startswith('http://127.0.0.1'): await r.continue_()
                    else: await r.abort()
                await pg.route('**/*', route)
                await pg.goto(f'http://127.0.0.1:{server.server_address[1]}/test.html')
                await pg.wait_for_function('window.__ra && document.getElementById("loading").hidden && !document.getElementById("profileBtn").hidden')
                await pg.wait_for_selector('#mapSeg [data-v="svijet"]:not([hidden])')
                assert await pg.locator('#startScreen').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
                await pg.screenshot(path=str(OUT / f'refresh-menu-{width}.png'))
                await pg.click('#profileBtn')
                await pg.wait_for_selector('.signin-hero')
                assert await pg.locator('#sheet').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
                if width in [1440, 375]: await pg.screenshot(path=str(OUT / f'refresh-signin-{width}.png'))
                await pg.evaluate('(u)=>window.__ra.ui.account.set(u)', user)
                await pg.wait_for_selector('.acc-grid')
                assert await pg.locator('#sheet').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
                assert await pg.locator('.ach.on').count() == 2
                if width in [1440, 375]: await pg.screenshot(path=str(OUT / f'refresh-profile-{width}.png'))
                await pg.click('#embBtn')
                await pg.click('[data-emb="kruna"]')
                await pg.wait_for_function('window.__ra.ui.account.user.icon==="kruna"')
                await pg.fill('#accName', 'Komandant Test')
                await pg.click('#accSave')
                await pg.wait_for_function('document.getElementById("nameIn").value==="Komandant Test"')
                await pg.click('#accTop')
                await pg.wait_for_selector('.top-list li.me')
                assert await pg.locator('#sheet').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
                if width == 1440: await pg.screenshot(path=str(OUT / 'refresh-leaderboard.png'))
                await pg.click('#topBack')
                await pg.wait_for_selector('#accOut')
                await pg.click('#accOut')
                await pg.wait_for_selector('.signin-hero')
                await pg.click('.sh-close')
                await pg.click('#leaderboardBtn')
                await pg.wait_for_selector('#topSeg')
                assert not errors, errors
                print('PASS profile layout', width, height, flush=True)
                await ctx.close()
            await browser.close()
    finally:
        server.shutdown()

asyncio.run(main())

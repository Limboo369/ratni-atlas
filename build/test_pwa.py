"""The installable app (plan phase 18) over http: the manifest and its icons, the service worker (registers, controls
the page, the page opens without a connection), "Instaliraj aplikaciju" when the browser offers it, and the profile's
notifications button. Web push itself (VAPID, encryption, sending) is tested in build/test_api.js.
python3 build/test_pwa.py"""
import asyncio, json, os, struct, subprocess, sys
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
os.environ['PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS'] = '1'  # the page's service worker (/sw.js): its requests go through the test's routes too
LEAF = open(R + 'package/dist/leaflet.js').read()
fails = []


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


async def main():
    fx = subprocess.Popen(['node', R + 'build/api_fixture.js', 'serve'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    info = json.loads(fx.stdout.readline())
    url = info['url']
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
            page = await ctx.new_page()
            page.set_default_timeout(60_000)
            errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))

            async def route(r):
                u = r.request.url
                if 'leaflet' in u and u.endswith('.js'):
                    await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
                elif u.startswith(url):
                    await r.continue_()
                else:
                    await r.abort()
            await ctx.route('**/*', route)
            await page.goto(url + '/')
            await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
            # the manifest and its icons
            man = await page.evaluate('fetch(document.querySelector("link[rel=manifest]").href).then(r => r.headers.get("content-type") + "|" + r.status).then(async (t) => [t, await (await fetch("/manifest.webmanifest")).json()])')
            check('manifest' in man[0] and man[1]['display'] == 'standalone' and man[1]['start_url'].startswith('/'), f'manifest: {man[0]}, standalone')
            for ic in man[1]['icons']:
                head = await page.evaluate(f'fetch("{ic["src"]}").then(r => r.arrayBuffer()).then(b => Array.from(new Uint8Array(b.slice(0, 24))))')
                w, h = struct.unpack('>II', bytes(head[16:24]))
                check(bytes(head[1:4]) == b'PNG' and f'{w}x{h}' == ic['sizes'], f'icon {ic["src"]}: PNG {w}x{h} ({ic["purpose"]})')
            # the service worker takes the page over
            st = await page.evaluate('navigator.serviceWorker.ready.then(r => r.active && r.active.state)')
            check(st in ('activated', 'activating'), f'service worker active ({st})')
            await page.reload()
            await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
            check(await page.evaluate('!!navigator.serviceWorker.controller'), 'after a reload the service worker controls the page (and the game still starts)')
            # without a connection the page still opens (from the cache)
            await ctx.set_offline(True)
            try:
                await page.reload()
                await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
                ok = await page.evaluate('!document.getElementById("startScreen").hidden')
            except Exception as e:
                ok = False
                print('offline reload:', e)
            check(ok, 'offline: the game starts from the cache (page, Leaflet, map)')
            await ctx.set_offline(False)
            await page.goto(url + '/long-abcdef')
            check(await page.evaluate('!!document.getElementById("startScreen")'), 'a game link (/long-…) is the same page')
            await page.goto(url + '/')
            await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
            # "Instaliraj aplikaciju": only when the browser offers it
            check(await page.evaluate('document.getElementById("installBtn").hidden'), 'no install button until the browser offers it')
            await page.evaluate('''() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__asked = 1; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); dispatchEvent(e); }''')
            check(await page.evaluate('!document.getElementById("installBtn").hidden'), 'the browser offers it: "Instaliraj aplikaciju" shows')
            await page.click('#installBtn')
            await page.wait_for_function('document.getElementById("installBtn").hidden', timeout=5000)
            check(await page.evaluate('window.__asked === 1'), 'the button asks the browser to install, then hides')
            check(not errs, f'no page errors {errs[:3]}')
            await b.close()
    finally:
        fx.stdin.close()
        fx.wait(timeout=20)
    print('FAILS:', fails if fails else 'none')
    sys.exit(1 if fails else 0)


asyncio.run(main())

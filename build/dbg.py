import asyncio, sys, json
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root
R = ROOT
LEAF = open(R + 'package/dist/leaflet.js').read()
async def main():
    js = open(sys.argv[1]).read()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = await (await b.new_context(viewport={'width': 800, 'height': 700})).new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: print('console:', m.text) if m.type in ('log', 'error') else None)
        async def route(r):
            u = r.request.url
            if 'leaflet' in u and u.endswith('.js'):
                await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
            elif u.startswith('file://'):
                await r.continue_()
            else:
                await r.abort()
        await page.route('**/*', route)
        await page.goto('file://' + R + 'dist/test.html')
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=90000)
        r = await page.evaluate(js)
        print(json.dumps(r, ensure_ascii=False, indent=1)[:6000])
        print('errors:', errs[:5])
        await b.close()
asyncio.run(main())

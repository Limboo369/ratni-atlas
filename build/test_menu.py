import asyncio
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root
R = ROOT
LEAF = open(R + 'package/dist/leaflet.js').read()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        async def route(r):
            u = r.request.url
            if 'leaflet' in u and u.endswith('.js'): await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await page.route('**/*', route)
        await page.goto('file://' + R + 'dist/test.html')
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=60000)
        await page.click('#goBtn')
        await page.evaluate('''() => { const a = window.__ra; const c = a.map.cities.find(c => c.name === 'Sarajevo').c; a.ui.onTap(L.latLng(...a.map.latLngOfCell(c)), {x: 100, y: 100}); }''')
        await page.click('#startBtn')
        await page.wait_for_timeout(1500)
        await page.click('#menuBtn')
        await page.wait_for_timeout(1200)
        await page.screenshot(path=R + 'build/shots/phone_menu2.png')
        await page.evaluate('window.__ra.ui.howTo()')
        await page.wait_for_timeout(1200)
        await page.screenshot(path=R + 'build/shots/phone_howto.png')
        await b.close()
asyncio.run(main())

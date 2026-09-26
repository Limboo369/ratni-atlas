"""Launcher regression: real touch/keyboard flows, overflow, saved settings and decorative motion."""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'build' / 'shots'
OUT.mkdir(exist_ok=True)
LEAF = (ROOT / 'package/dist/leaflet.js').read_text()

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for width, height in [(1440,900), (1920,1080), (1024,768), (375,812), (320,680), (844,390)]:
            ctx = await browser.new_context(viewport={'width':width, 'height':height}, is_mobile=width<600, has_touch=width<600, device_scale_factor=1)
            page = await ctx.new_page()
            page.set_default_timeout(60000)
            errors=[]
            page.on('pageerror', lambda e: errors.append(str(e)))
            async def route(r):
                if 'leaflet' in r.request.url and r.request.url.endswith('.js'):
                    await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
                elif r.request.url.startswith('file://'): await r.continue_()
                else: await r.abort()
            await page.route('**/*', route)
            await page.goto((ROOT/'dist/test.html').as_uri())
            await page.wait_for_function('window.__ra && document.getElementById("loading").hidden')
            await page.wait_for_timeout(400)
            # No horizontal scrolling or clipped controls at desktop, portrait and landscape widths.
            metrics=await page.evaluate('''() => { const e=document.getElementById('startScreen'); return {width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,content:e.scrollHeight,canvas:!!document.getElementById('atlasCanvas').getContext('2d')}; }''')
            assert metrics['scroll'] <= metrics['width']+1, (width, metrics)
            await page.screenshot(path=str(OUT/f'launcher_{width}x{height}.png'))
            print('checking', width, height, 'settings', flush=True)
            await page.fill('#nameIn', 'Test Komandant')
            await page.click('#eraSeg [data-v="rim"]')
            await page.click('#paceSeg [data-v="custom"]')  # Make your choice opens the dialog with every rule
            print('dialog opened', width, flush=True)
            assert await page.locator('#operationDialog').evaluate('(e)=>e.open')
            await page.click('#startSeg [data-v="slobodno"]')
            assert await page.locator('#csField').is_visible()
            await page.click('#regSeg [data-v="balkan"]')
            await page.click('#gmSeg [data-v="br"]')
            await page.click('#diffSeg [data-v="tesko"]')
            await page.click('#peaceSeg [data-v="180"]')
            # Native dialog interactions are checked below; capture the launcher at each size.
            await page.click('#configDone')
            assert await page.locator('#operationSummary').inner_text() == 'Balkan · Battle royale · Teško'
            await page.click('#configBtn')
            await page.keyboard.press('Escape')
            assert not await page.locator('#operationDialog').evaluate('(e)=>e.open')
            assert await page.locator('#configBtn').evaluate('(e)=>document.activeElement===e')
            await page.click('#howBtn')
            assert await page.locator('#sheetWrap').is_visible()
            await page.locator('#sheet .sh-close').click()
            await page.click('#sideSeg [data-v="online"]')
            await page.click('#onlineToggle')
            assert await page.locator('#onlineBox').is_visible()
            await page.click('#onlineToggle')
            await page.click('#sideSeg [data-v="solo"]')
            await page.click('#motionBtn')
            assert await page.locator('#startScreen').evaluate('(e)=>e.classList.contains("command-still")')
            await page.emulate_media(reduced_motion='reduce')
            await page.wait_for_function('document.getElementById("motionBtn").disabled')
            await page.click('#goBtn')
            await page.wait_for_selector('#spawnBar', state='visible')
            settings = await page.evaluate('''() => ({era:__ra.G.era,region:__ra.ui.settings.region,gm:__ra.ui.settings.gm,name:__ra.ui.settings.name,peace:__ra.ui.settings.peace})''')
            assert settings == dict(era='rim',region='balkan',gm='br',name='Test Komandant',peace=180), settings
            assert not errors, errors
            print('PASS',width,height,json.dumps(metrics),settings,flush=True)
            await ctx.close()
        await browser.close()

asyncio.run(main())

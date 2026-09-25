"""Tactical HUD geometry, touch targets and modal keyboard ownership on real game state."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'build/shots'
LEAF = (ROOT / 'package/dist/leaflet.js').read_text()

async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for width, height in [(1440,900), (375,812), (320,680), (844,390), (700,900)]:
            ctx = await browser.new_context(viewport={'width':width,'height':height}, has_touch=width<600)
            pg = await ctx.new_page()
            pg.set_default_timeout(60000)
            errors=[]
            pg.on('pageerror',lambda e:errors.append(str(e)))
            async def route(r):
                if 'leaflet' in r.request.url and r.request.url.endswith('.js'):
                    await r.fulfill(status=200,content_type='application/javascript',body=LEAF)
                elif r.request.url.startswith('file://'): await r.continue_()
                else: await r.abort()
            await pg.route('**/*',route)
            await pg.goto((ROOT/'dist/test.html').as_uri())
            await pg.wait_for_function('window.__ra && document.getElementById("loading").hidden')
            await pg.evaluate('''() => { const u=__ra.ui; u.noTips=true; u.settings.region='balkan'; u.settings.start='granice'; }''')
            await pg.click('#goBtn')
            await pg.wait_for_selector('#spawnBar')
            await pg.evaluate('''() => { const G=__ra.G; __ra.ui.pickNation(String(G.P.find(p=>p&&p.iso==='BIH').id)); }''')
            await pg.click('#startBtn')
            await pg.evaluate('''() => { __ra.paused=true; __ra.updatePauseBtn(); __ra.ui.updateHud(); }''')
            await pg.wait_for_selector('#hud')
            geometry=await pg.evaluate('''() => {
              const ids=['hud','dock','aArmy','aBuild','aLand','aStrike','aDiplo','speedBtn','pauseBtn','menuBtn'];
              return ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();
                const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                return {id,inside:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,
                  overflow:e.scrollWidth>e.clientWidth+1,hit:e.contains(hit)};});
            }''')
            assert all(x['inside'] and not x['overflow'] for x in geometry),geometry
            assert all(x['hit'] for x in geometry if x['id'] not in ['hud','dock']),geometry
            assert 'Bosna' in await pg.locator('#hNation').inner_text()
            print('HUD fits',width,height,flush=True)
            if width in [1440,375]: await pg.screenshot(path=str(OUT/f'tactical-hud-{width}.png'))
            await pg.click('#aArmy')
            assert await pg.locator('#sheetTitle').inner_text()=='Vojska'
            assert await pg.locator('#map').evaluate('(e)=>e.inert')
            await pg.keyboard.press('b')
            assert await pg.locator('#sheetTitle').inner_text()=='Vojska'
            await pg.keyboard.press('Shift+Tab')
            assert await pg.locator('#sheet').evaluate('(e)=>e.contains(document.activeElement)')
            await pg.keyboard.press('Escape')
            assert await pg.locator('#aArmy').evaluate('(e)=>document.activeElement===e')
            assert not await pg.locator('#map').evaluate('(e)=>e.inert')
            await pg.click('#aBuild')
            await pg.wait_for_selector('#sheet [data-t]')
            assert await pg.locator('#sheet').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
            if width in [1440,375]: await pg.screenshot(path=str(OUT/f'tactical-build-{width}.png'))
            await pg.keyboard.press('Escape')
            await pg.click('#aDiplo')
            assert await pg.locator('#sheet').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
            await pg.keyboard.press('Escape')
            # The new online message control must also fit when it becomes visible.
            await pg.evaluate('''() => { __ra.G.online=true; document.getElementById('chatBtn').hidden=false; }''')
            if width > 560:
                assert await pg.locator('#chatBtn').evaluate('''e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}''')
                await pg.click('#chatBtn')
            else:
                await pg.evaluate('__ra.ui.quickSheet()')
            await pg.wait_for_selector('.qm-grid')
            assert await pg.locator('#sheet').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
            await pg.keyboard.press('Escape')
            await pg.evaluate('''() => { __ra.G.online=false; document.getElementById('chatBtn').hidden=true; }''')
            await pg.locator('#ratio').focus()
            old=await pg.locator('#ratio').input_value()
            await pg.keyboard.press('ArrowRight')
            assert int(await pg.locator('#ratio').input_value())==int(old)+5
            # Profile text fields also own Escape and restore focus to the launcher control.
            await pg.evaluate('''() => { __ra.showStart(); const a=__ra.ui.account; a.ok=true; a.set(null); }''')
            await pg.click('#profileBtn')
            await pg.keyboard.press('Escape')
            assert await pg.locator('#profileBtn').evaluate('(e)=>document.activeElement===e')
            assert not errors,errors
            print('PASS tactical layout',width,height,flush=True)
            await ctx.close()
        await browser.close()

asyncio.run(main())

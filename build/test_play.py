"""Smoke test: load page, start a game as a phone, play a bit, screenshot."""
import asyncio, sys, time, json
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

R = ROOT
OUT = R + 'build/shots/'
import os
os.makedirs(OUT, exist_ok=True)
LEAF = open(R + 'package/dist/leaflet.js').read()


async def main(mode):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        if mode == 'phone':
            ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
        else:
            ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
        page = await ctx.new_page()
        errs = []
        page.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))

        async def route(r):
            u = r.request.url
            if 'leaflet' in u and u.endswith('.js'):
                await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
            elif u.startswith('file://'):
                await r.continue_()
            else:
                await r.abort()
        await page.route('**/*', route)
        t0 = time.time()
        await page.goto('file://' + R + 'dist/test.html')
        await page.wait_for_function('document.getElementById("loading") && document.getElementById("loading").hidden', timeout=60000)
        print('loaded in', round(time.time() - t0, 2), 's')
        await page.wait_for_timeout(1500)
        await page.screenshot(path=OUT + f'{mode}_1_start.png')
        # start a game
        await page.fill('#nameIn', 'Darko')
        await page.click('#goBtn')
        await page.wait_for_timeout(800)
        await page.screenshot(path=OUT + f'{mode}_2_spawn.png')
        # tap near Sarajevo
        pt = await page.evaluate('''() => { const a = window.__ra; const p = a.lmap.latLngToContainerPoint([44.3, 17.6]); return [p.x, p.y]; }''')
        if mode == 'phone':
            await page.touchscreen.tap(pt[0], pt[1])
        else:
            await page.mouse.click(pt[0], pt[1])
        await page.wait_for_timeout(600)
        await page.screenshot(path=OUT + f'{mode}_3_picked.png')
        print('spawn text:', await page.inner_text('#spawnText'))
        await page.click('#startBtn')
        await page.wait_for_timeout(1800)
        await page.screenshot(path=OUT + f'{mode}_4_started.png')
        # expand toward a point west of spawn
        async def tap_ll(lat, lng):
            pt = await page.evaluate(f'() => {{ const p = window.__ra.lmap.latLngToContainerPoint([{lat}, {lng}]); return [p.x, p.y]; }}')
            if mode == 'phone':
                await page.touchscreen.tap(pt[0], pt[1])
            else:
                await page.mouse.click(pt[0], pt[1])
        await tap_ll(44.0, 16.5)
        await page.evaluate('window.__ra.setSpeed(3)')
        for i in range(6):
            await page.wait_for_timeout(2500)
            await tap_ll(44.2 + (i % 3) * 0.4, 16.0 + i * 0.6)
        await page.screenshot(path=OUT + f'{mode}_5_playing.png')
        stats = await page.evaluate('''() => { const a = window.__ra, G = a.G; return {tick: G.tick, tiles: G.me.tiles, troops: Math.round(G.me.troops), gold: Math.round(G.me.gold), attacks: G.attacks.filter(x=>!x.done).length, sim: a.simMs, alive: G.P.filter(p=>p&&p.alive).length}; }''')
        print('stats', stats)
        # open context sheet with long press equivalent (contextmenu)
        await page.evaluate('''() => { const a = window.__ra; a.ui.cellSheet(a.G.me.capital); }''')
        await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + f'{mode}_6_sheet.png')
        await page.evaluate('window.__ra.ui.closeSheet()')
        # zoom in near player
        await page.evaluate('''() => { const a = window.__ra; a.lmap.setView(a.map.latLngOfCell(a.G.me.capital), 6.3); }''')
        await page.wait_for_timeout(1500)
        await page.screenshot(path=OUT + f'{mode}_7_zoom.png')
        print('\n'.join(errs[:30]) or 'no console errors')
        await b.close()

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'phone'))

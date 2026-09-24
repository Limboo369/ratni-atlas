"""UI screens: sheets, alliance prompt, nuke, end screen."""
import asyncio, sys
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root
R = ROOT
OUT = R + 'build/shots/'
os.makedirs(OUT, exist_ok=True)
LEAF = open(R + 'package/dist/leaflet.js').read()

async def main(mode):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        if mode == 'phone':
            ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
        else:
            ctx = await b.new_context(viewport={'width': 1400, 'height': 900})
        page = await ctx.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
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
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=60000)
        await page.click('#goBtn')
        await page.evaluate('''() => { const a = window.__ra; const c = a.map.cities.find(c => c.name === 'Zagreb').c; a.ui.onTap(L.latLng(...a.map.latLngOfCell(c)), {x: 100, y: 100}); }''')
        await page.click('#startBtn')
        await page.evaluate('window.__ra.setSpeed(3)')
        await page.wait_for_timeout(9000)
        # give gold and silo to test sheets
        await page.evaluate('''() => { const a = window.__ra, G = a.G, me = G.me; me.gold = 9e6; 
           const c = me.cells[Math.floor(me.tiles/2)]; const s = G.build(me.id, 'silo', c); if (typeof s === 'object') { s.doneAt = G.tick; } 
           const c2 = me.cells[Math.floor(me.tiles/3)]; G.build(me.id, 'fort', c2); }''')
        await page.wait_for_timeout(500)
        await page.evaluate('window.__ra.ui.buildSheet()')
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + f'{mode}_ui_build.png')
        await page.evaluate('window.__ra.ui.closeSheet(); window.__ra.ui.diploSheet()')
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + f'{mode}_ui_diplo.png')
        await page.evaluate('window.__ra.ui.closeSheet(); window.__ra.ui.nukeSheet()')
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + f'{mode}_ui_nuke.png')
        await page.evaluate('window.__ra.ui.closeSheet();')
        # enemy info sheet (a neighbour's cell)
        await page.evaluate('''() => { const a = window.__ra, G = a.G, me = G.me; const info = RA.AI.scan(G, me); const oid = [...info.nb.keys()][0]; if (oid) { const o = G.P[oid]; a.ui.cellSheet(o.cells[0]); } }''')
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + f'{mode}_ui_enemy.png')
        await page.evaluate('window.__ra.ui.closeSheet();')
        # AI alliance request to me
        await page.evaluate('''() => { const a = window.__ra, G = a.G, me = G.me; const o = G.P.find(p => p && p.alive && p.type === 'nation' && p.allies.size < 2); G.allyReqs.push({from: o.id, to: me.id, exp: G.tick + 200}); }''')
        await page.wait_for_timeout(900)
        # launch a nuke at a neighbour
        await page.evaluate('''() => { const a = window.__ra, G = a.G, me = G.me; const info = RA.AI.scan(G, me); const oid = [...info.nb.keys()].find(id => G.P[id].type === 'nation') || [...info.nb.keys()][0]; const o = G.P[oid]; const r = G.launchNuke(me.id, 'atom', o.cells[Math.floor(o.tiles/2)]); window.__nk = typeof r === 'object' ? 'ok' : r; }''')
        print('nuke:', await page.evaluate('window.__nk'))
        await page.wait_for_timeout(2500)
        await page.screenshot(path=OUT + f'{mode}_ui_missile.png')
        await page.wait_for_timeout(4000)
        await page.screenshot(path=OUT + f'{mode}_ui_blast.png')
        await page.evaluate('window.__ra.ui.menu()')
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + f'{mode}_ui_menu.png')
        await page.evaluate('window.__ra.ui.closeSheet();')
        # force win -> end screen
        await page.evaluate('''() => { const a = window.__ra, G = a.G; G.winner = G.me; G.state = 'over'; G._history(); G.event('over', 'x', G.me.id); }''')
        await page.wait_for_timeout(800)
        await page.screenshot(path=OUT + f'{mode}_ui_end.png')
        print('\n'.join(errs[:20]) or 'no errors')
        await b.close()
asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'phone'))

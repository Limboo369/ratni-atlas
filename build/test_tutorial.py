"""Tutorial test: the start-screen button starts a guided Balkans game; every step waits for the real action.
python3 build/test_tutorial.py [phone|desktop]"""
import asyncio, os, sys
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = R + 'build/shots/'
os.makedirs(OUT, exist_ok=True)
LEAF = open(R + 'package/dist/leaflet.js').read()
MODE = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
fails = []


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await (b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True) if MODE == 'phone' else b.new_context(viewport={'width': 1400, 'height': 900}))
        page = await ctx.new_page()
        page.set_default_timeout(60_000)
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))

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
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
        ev = page.evaluate

        async def step():
            return await ev('() => document.getElementById("tutCard").hidden ? null : document.getElementById("tutStep").textContent')

        async def wait_step(n):
            try:
                await page.wait_for_function(f'document.getElementById("tutStep").textContent.startsWith("{n}/")', timeout=15_000)
            except Exception:
                pass
            return await step()

        check(await ev('document.getElementById("tutBtn").classList.contains("fresh")'), 'first visit: the tutorial button is marked')
        await page.click('#tutBtn')
        await page.wait_for_function('window.__ra.G && window.__ra.G.state === "spawn"', timeout=30_000)
        s = await ev('() => { const G = window.__ra.G; return [G.map.region && G.map.region.id, G.opts.difficulty, G.opts.era, G.peaceUntil]; }')
        check(s[0] == 'balkan' and s[1] == 'lako' and s[2] == 'danas', f'tutorial game: Balkans, easy, today {s}')
        check(await step() == '1/8', 'step 1: pick a state')
        await page.screenshot(path=OUT + f'tut_{MODE}_1.png')
        await ev('() => { const G = window.__ra.G, n = G.P.find(p => p && p.iso === "BIH") || G.P.find(p => p && p.type === "nation"); window.__ra.ui.pickNation(String(n.id)); }')
        await page.wait_for_timeout(300)
        await page.click('#startBtn')
        check(await wait_step(2) == '2/8', 'step 2 after start (HUD)')
        await page.click('#tutNext')
        check(await wait_step(3) == '3/8', 'step 3: expand into free land')
        await ev('() => { const G = window.__ra.G, me = G.me, i = RA.AI.scan(G, me); if (i.neutralCell >= 0) window.__ra.ui.act("atk", [i.neutralCell, 0.3, 0]); else me.tiles *= 1; }')
        check(await wait_step(4) == '4/8', 'step 4 after taking free land (slider)')
        await page.click('#tutNext')
        check(await wait_step(5) == '5/8', 'step 5: build')
        await page.screenshot(path=OUT + f'tut_{MODE}_5.png')
        await ev('''() => { const G = window.__ra.G, me = G.me; me.gold = 5e6; for (const t of ['city', 'barracks']) { const c = me.cells.find(c => typeof G.canBuild(me, t, c) === 'number'); if (c !== undefined) { window.__ra.ui.act('build', [t, c]); break; } } }''')
        check(await wait_step(6) == '6/8', 'step 6 after building (alliances)')
        await page.click('#aDiplo')
        check(await wait_step(7) == '7/8', 'step 7 after opening Savezi (directed attack)')
        await ev('window.__ra.ui.closeSheet()')
        await ev('''() => { const G = window.__ra.G, me = G.me; G.peaceUntil = G.tick; me.troops = Math.max(me.troops, 200000);
            const nbNation = () => [...RA.AI.scan(G, me).nb.keys()].find(id => G.P[id] && G.P[id].type === 'nation' && !G.isFriendly(me, G.P[id]));
            // from a capital: grow into free land until a state is next door
            for (let k = 0; k < 40 && !nbNation(); k++) { const i = RA.AI.scan(G, me); if (i.neutralCell >= 0) G.cmdAttack(me.id, i.neutralCell, 0.5, 0); for (let t = 0; t < 60; t++) G.step(); me.troops = Math.max(me.troops, 200000); }
            const id = nbNation();
            const T = G.P[id]; window.__ra.ui.act('atk', [T.cells[T.tiles >> 1], 0.3, 1]); }''')
        check(await wait_step(8) == '8/8', 'step 8 after a directed attack')
        await page.screenshot(path=OUT + f'tut_{MODE}_8.png')
        await page.click('#tutNext')
        await page.wait_for_timeout(300)
        done = await ev('() => [document.getElementById("tutCard").hidden, localStorage.getItem("ra_tut_done"), !!window.__ra.ui.tut]')
        check(done == [True, '1', False], f'tutorial finished and remembered {done}')
        check(not errs, 'no page errors ' + str(errs[:3]))
        await b.close()
    print('FAILS:', fails or 'none')
    sys.exit(1 if fails else 0)


asyncio.run(main())

"""Campaign: a new dynasty (home Sarajevo), the first mission in Rome's era with the state that holds the home, the
goal met (+XP, stars), the tech tree bought and applied in the next mission, a failed mission, progress kept after a
reload, and the "survive" mission's coalition.
python3 build/test_campaign.py [desktop|phone]"""
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
        page.set_default_timeout(90_000)
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
        await page.click('#campBtn')
        await page.wait_for_selector('[data-home="sarajevo"]')
        await page.fill('#campName', 'Kotromanić')
        await page.click('[data-home="sarajevo"]')
        await page.wait_for_selector('[data-mis="0"]')
        txt = await ev('document.getElementById("sheet").textContent')
        check('Kotromanić' in txt and 'Uspon' in txt and 'Krune i mačevi' in txt, 'the campaign screen: the dynasty, chapter I open, chapter II locked')
        await page.screenshot(path=OUT + f'camp_{MODE}.png')
        await page.click('[data-mis="0"]')
        await page.wait_for_function('window.__ra.G && window.__ra.G.opts.camp && window.__ra.G.state === "play" && window.__ra.G.me', timeout=60_000)
        s = await ev('() => { const G = window.__ra.G; return [G.era, G.map.region && G.map.region.id, G.me.name, G.opts.camp.type, !!G.camp]; }')
        check(s[0] == 'rim' and s[3] == 'expand' and s[4], f'mission 1: Rome, the state that holds Sarajevo {s}')
        await page.wait_for_function('document.querySelector("#status .pill.goal")', timeout=15_000)
        check(True, 'the goal is on the screen: ' + await ev('document.querySelector("#status .pill.goal").textContent'))
        # the goal is met
        await ev('() => { const G = window.__ra.G; G.camp.share0 = 0.0001; }')
        await page.wait_for_function('document.getElementById("sheet").textContent.includes("Misija uspješna")', timeout=15_000)
        c = await ev('JSON.parse(localStorage.getItem("ra_campaign"))')
        check(c['xp'] >= 80 and c['done'].get('0', 0) >= 1, f'success: XP {c["xp"]}, stars {c["done"]}')
        await page.click('#sheet [data-camp]')
        await page.wait_for_selector('[data-tree="eco"]')
        await page.click('[data-tree="eco"]')
        await page.wait_for_function('JSON.parse(localStorage.getItem("ra_campaign")).tree.eco === 1')
        check(True, 'the tech tree: Ekonomija level 1')
        await page.click('[data-mis="1"]')
        await page.wait_for_function('window.__ra.G && window.__ra.G.opts.camp && window.__ra.G.opts.camp.mid === 1 && window.__ra.G.me', timeout=60_000)
        bg = await ev('window.__ra.G.me.bGold')
        check(abs(bg - 1.06) < 1e-9, f'the dynasty\'s upgrade applies in the mission (gold ×{bg})')
        # a failed mission: the player's state falls
        await ev('() => { const G = window.__ra.G; G._kill(G.me); }')
        await page.wait_for_function('document.getElementById("sheet").textContent.includes("neuspješna")', timeout=15_000)
        check(True, 'a lost mission ends with "Misija neuspješna" and a retry')
        # progress survives a reload; the survive mission sets a coalition
        await page.reload()
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
        await ev('() => { const c = JSON.parse(localStorage.getItem("ra_campaign")); for (let i = 0; i < 7; i++) c.done[i] = 1; localStorage.setItem("ra_campaign", JSON.stringify(c)); window.__ra.ui.camp = null; }')
        await page.click('#campBtn')
        await page.wait_for_selector('[data-mis="7"]')
        await page.click('[data-mis="7"]')
        await page.wait_for_function('window.__ra.G && window.__ra.G.opts.camp && window.__ra.G.opts.camp.mid === 7 && window.__ra.G.me', timeout=60_000)
        sv = await ev('() => { const G = window.__ra.G, me = G.me; const nb = G.P.filter(o => o && o.alive && o !== me && o.type === "nation" && G.hasBorderWith(me, o.id)); return [me.ae, nb.length, nb.every(o => o.rel[me.id] <= -90)]; }')
        check(sv[0] >= 50 and sv[2], f'"survive": the neighbours gang up (ae {sv[0]}, {sv[1]} neighbours hostile)')
        check(not errs, f'no page errors {errs[:3]}')
        await b.close()
    print('\n' + ('ALL OK' if not fails else f'{len(fails)} FAILED: {fails}'))
    sys.exit(1 if fails else 0)


asyncio.run(main())

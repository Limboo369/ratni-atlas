"""Community market (plan phase 19) in the browser with the real API (PostgreSQL, fake Google sign-in):
the editor on the map (a new state with its capital, painting by dragging, rename, colour, a player slot, undo),
publishing, the market list, playing the scenario (only the named state can be taken, it has the edited borders),
the scenario link and the draft kept in the browser.
python3 build/test_market.py"""
import asyncio, json, os, subprocess, sys
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
os.environ['PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS'] = '1'  # the page's service worker: its requests go through the routes too
LEAF = open(R + 'package/dist/leaflet.js').read()
fails = []


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


GSI = '''window.google = { accounts: { id: {
  initialize(o) { window.__gsi = o; },
  renderButton(el) { const b = document.createElement('button'); b.id = 'fakeGoogle'; b.textContent = 'Nastavi s Google-om';
    b.onclick = () => window.__gsi.callback({ credential: window.__TOK }); el.appendChild(b); },
  disableAutoSelect() {},
} } };'''


async def main():
    fx = subprocess.Popen(['node', R + 'build/api_fixture.js', 'serve'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    info = json.loads(fx.stdout.readline())
    url, tok = info['url'], info['tokens']
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
                if u.startswith('https://accounts.google.com/gsi/client'):
                    await r.fulfill(status=200, content_type='application/javascript', body=GSI)
                elif 'leaflet' in u and u.endswith('.js'):
                    await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
                elif u.startswith(url):
                    await r.continue_()
                else:
                    await r.abort()
            await ctx.route('**/*', route)
            ev = page.evaluate
            await page.goto(url + '/')
            await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
            await page.wait_for_function('!document.getElementById("accountBtn").hidden', timeout=10_000)
            await page.click('#profileBtn')
            await page.wait_for_selector('#fakeGoogle')
            await ev(f'window.__TOK = {json.dumps(tok["darko"])}')
            await page.click('#fakeGoogle')
            await page.wait_for_function('document.getElementById("accountBtn").classList.contains("on")', timeout=10_000)
            await ev('window.__ra.ui.closeSheet()')
            # the editor on the start screen's map: Balkan, 1938
            await ev("(() => { const s = window.__ra.ui.settings; s.map = 'evropa'; s.region = 'balkan'; s.era = 'ww2'; })()")
            await page.click('#marketBtn')
            await page.wait_for_selector('#marketSheet', state='attached')
            await page.click('#mkNew')
            await page.wait_for_selector('#edPanel')
            check(await ev('window.__ra.ui.editor && window.__ra.G.map.region.id === "balkan"'), 'the editor opens on the chosen map (Balkan, 1938)')

            async def at(cell):
                return await ev(f'(() => {{ const a = window.__ra, ll = a.map.latLngOfCell({cell}), p = a.lmap.latLngToContainerPoint(ll), r = a.lmap.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }})()')
            # a new state: its capital on the biggest state's land, then paint by dragging from it
            info0 = await ev('''(() => { const G = window.__ra.G; const big = G.P.filter(p => p && p.alive && p.nation).sort((a, b) => b.tiles - a.tiles)[0];
                const c = big.capital, W = G.map.W; return [big.id, c, W, big.tiles]; })()''')
            bigId, cap, W = info0[0], info0[1], info0[2]
            await page.click('#edTool button[data-v="new"]')
            x, y = await at(cap)
            await page.mouse.click(x, y)
            await page.wait_for_function('window.__ra.ui.editor.added === 1')
            nid = await ev('window.__ra.ui.editor.sel')
            x2, y2 = await at(cap + 6)
            await page.mouse.move(x, y)
            await page.mouse.down()
            for i in range(1, 7):
                await page.mouse.move(x + (x2 - x) * i / 6, y + (y2 - y) * i / 6)
            await page.mouse.up()
            tiles = await ev(f'window.__ra.G.P[{nid}].tiles')
            check(tiles > 9, f'a new state on the map, painted by dragging ({tiles} cells)')
            await page.fill('#edName', 'Hercegovina')
            await page.dispatch_event('#edName', 'change')
            await ev("(() => { const c = document.getElementById('edColor'); c.value = '#aa3355'; c.dispatchEvent(new Event('input')); })()")
            await page.check('#edSlot')
            # undo: one more stroke, then take it back
            before = await ev(f'window.__ra.G.P[{nid}].tiles')
            await page.mouse.click(*(await at(cap - 8 * W)))
            await page.click('#edUndo')
            check(await ev(f'window.__ra.G.P[{nid}].tiles') == before, 'undo takes the last stroke back')
            await page.fill('#edTitle', 'Hercegovina 1938')
            await page.dispatch_event('#edTitle', 'input')
            await page.wait_for_timeout(1800)
            check(await ev('!!localStorage.getItem("ra_scen_draft")'), 'the draft is kept in the browser')
            await page.click('#edPub')
            await page.wait_for_function('window.__ra.ui.editor.meta.code', timeout=10_000)
            code = await ev('window.__ra.ui.editor.meta.code')
            check(len(code) == 8 and not await ev('localStorage.getItem("ra_scen_draft")'), f'published ({code}), the draft is cleared')
            await page.click('#edExit')
            await page.wait_for_function('!document.getElementById("startScreen").hidden && !document.getElementById("edPanel")')
            # the market lists it; play it
            await page.click('#marketBtn')
            await page.wait_for_selector(f'[data-mkplay="{code}"]')
            txt = await ev('document.getElementById("mkList").textContent')
            check('Hercegovina 1938' in txt and 'Darko' in txt, 'the market lists the scenario with its author')
            await page.click(f'[data-mkplay="{code}"]')
            await page.wait_for_function('window.__ra.G && window.__ra.G.state === "spawn" && window.__ra.G.rec && window.__ra.G.rec.set.scen', timeout=30_000)
            g = await ev('(() => { const G = window.__ra.G, h = G.P.find(p => p && p.name === "Hercegovina"); return [!!h, h && h.tiles, h && h.hex, h && h.capital]; })()')
            check(g[0] and g[1] == tiles and g[2] == '#aa3355', f'the game has the scenario: Hercegovina with {g[1]} cells, its colour')
            # only the named state can be taken
            bigCap = await ev('window.__ra.G.P.filter(p => p && p.alive && p.nation && p.name !== "Hercegovina").sort((a, b) => b.tiles - a.tiles)[0].capital')
            await page.mouse.click(*(await at(bigCap)))
            await page.wait_for_timeout(500)
            check(not await ev('!!window.__ra.G.me'), 'a state the scenario does not name cannot be taken')
            await page.mouse.click(*(await at(g[3])))
            await page.wait_for_function('window.__ra.G.me && window.__ra.G.me.name === "Hercegovina"', timeout=10_000)
            check(True, 'the named state is mine')
            # the link /scenario-<code>
            await page.goto(url + '/scenario-' + code)
            await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
            await page.wait_for_selector('#scPlay', timeout=15_000)
            check('Hercegovina 1938' in await ev('document.getElementById("sheet").textContent'), 'the scenario link opens it')
            check(not errs, f'no page errors {errs[:3]}')
            await b.close()
    finally:
        fx.stdin.close()
        fx.wait(timeout=20)
    print('FAILS:', fails if fails else 'none')
    sys.exit(1 if fails else 0)


asyncio.run(main())

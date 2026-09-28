"""Every icon the game draws, as 256×256 PNG (transparent) in one folder, named as in the game, for painters.
   python3 build/export_icons.py [out_dir]  → ui/<name>.png + .svg (buttons, menus), map/<era>/<name>.png (buildings,
   units, ships, trains… drawn in a neutral blue; in the game they take the owner's colour)."""
import asyncio, base64, os, sys
from playwright.async_api import async_playwright
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = sys.argv[1] if len(sys.argv) > 1 else R + 'dist/icons_export/'
LEAF = open(R + 'package/dist/leaflet.js').read()
MODELS = ['city', 'factory', 'market', 'barracks', 'fort', 'port', 'airport', 'hangar', 'silo', 'siege', 'sam', 'dome', 'eye',
          'inf', 'cav', 'tank', 'art', 'ship', 'sub', 'train', 'cart', 'trade', 'missile', 'zeppelin', 'fighter', 'bomber', 'drone']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page()
        async def route(r):
            u = r.request.url
            if 'leaflet' in u and u.endswith('.js'): await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.goto('file://' + R + 'dist/test.html')
        await pg.wait_for_function('document.getElementById("loading").hidden', timeout=60000)
        ui = await pg.evaluate('''async () => { const out = {};
          for (const [n, d] of Object.entries(RA.ICONS)) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
            const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
            await img.decode(); const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(img, 0, 0);
            out[n] = [svg, c.toDataURL()]; }
          return out; }''')
        os.makedirs(OUT + 'ui', exist_ok=True)
        for n, (svg, png) in ui.items():
            open(OUT + f'ui/{n}.svg', 'w').write(svg)
            open(OUT + f'ui/{n}.png', 'wb').write(base64.b64decode(png.split(',')[1]))
        eras = await pg.evaluate('RA.ERAS.map(e => e.id)')
        n = 0
        for era in eras:
            got = await pg.evaluate(f'''(M) => {{ RA.applyEra('{era}'); const out = {{}};
              for (const t of M) {{ const c = RA.Models.render(t, '#3f7fd6', 256), d = c.getContext('2d').getImageData(0, 0, 256, 256).data;
                let any = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) {{ any = 1; break; }}
                if (any) out[t] = c.toDataURL(); }}
              return out; }}''', MODELS)
            os.makedirs(OUT + f'map/{era}', exist_ok=True)
            for t, png in got.items():
                open(OUT + f'map/{era}/{t}.png', 'wb').write(base64.b64decode(png.split(',')[1]))
                n += 1
        print(len(ui), 'ui icons,', n, 'map models in', OUT)
        await b.close()
asyncio.run(main())

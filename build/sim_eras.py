"""Long AI-only runs per era (human seat played by the AI): game length, winner, weapons used."""
import asyncio, sys, json
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root
R = ROOT
LEAF = open(R + 'package/dist/leaflet.js').read()
JS = r'''
async ([era, start, gm, region, pick, maxMin, seed, diff]) => {
  const a = window.__ra;
  const G = RA.newGame(RA.regionMap(RA.eraMap(a.map, era, start), region), { seed, difficulty: diff, cityStates: 50, peace: 60, era, start, gm });
  a.setGame(G);
  const n = G.P.find(p => p && p.type === 'nation' && p.iso === pick) || G.P.find(p => p && p.type === 'nation');
  RA.placeHuman(G, n.nation.c, 'Test');
  RA.startGame(G);
  RA.AI.init(G, G.me);
  const seen = { build: {}, rec: {}, mis: {} };
  const ob = G.build.bind(G); G.build = (pid, t, c) => { const r = ob(pid, t, c); if (typeof r === 'object') seen.build[t] = (seen.build[t] || 0) + 1; return r; };
  const orc = G.recruitUnit.bind(G); G.recruitUnit = (pid, t, c) => { const r = orc(pid, t, c); if (typeof r === 'object') seen.rec[t] = (seen.rec[t] || 0) + 1; return r; };
  const om = G.launchMissile.bind(G); G.launchMissile = (pid, t, c) => { const r = om(pid, t, c); if (typeof r === 'object') seen.mis[t] = (seen.mis[t] || 0) + 1; return r; };
  const mins = [];
  let meDied = null;
  while (G.state === 'play' && G.tick < maxMin * 600) {
    G.step();
    if (G.me && !G.me.alive && meDied === null) meDied = +(G.tick / 600).toFixed(1);
    if (G.tick % 1200 === 0) {
      const al = G.alivePlayers().sort((x, y) => y.area - x.area);
      mins.push(`${G.tick / 600}m: ${al.length} alive, lead ${al[0].name.slice(0, 14)} ${(al[0].area / G.landTotal() * 100).toFixed(0)}%, me ${(G.me.area / G.landTotal() * 100).toFixed(1)}%` + (G.zone ? ` zone ${G.zone.state}/${G.zone.phase} r${G.zone.r.toFixed(0)}` : ''));
      await new Promise(r => setTimeout(r, 0));
    }
  }
  return { era, start, gm, region, min: +(G.tick / 600).toFixed(1), winner: G.winner ? G.winner.name : null, meDied, seen, mins };
}
'''
async def main():
    runs = [a.split(':') for a in sys.argv[1:]]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = await (await b.new_context(viewport={'width': 800, 'height': 700})).new_page()
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
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=90000)
        for era, start, gm, region, pick, maxmin, seed, diff in runs:
            r = await page.evaluate(JS, [era, start, gm, region, pick, int(maxmin), int(seed), diff])
            print(json.dumps({k: v for k, v in r.items() if k != 'mins'}, ensure_ascii=False))
            for m in r['mins']:
                print('   ', m)
        print('errors:', errs[:5])
        await b.close()
asyncio.run(main())

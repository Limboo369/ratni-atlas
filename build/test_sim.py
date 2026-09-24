"""Headless balance/perf run: AI-only game(s) stepped as fast as possible inside the page."""
import asyncio, sys, json
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

R = ROOT
LEAF = open(R + 'package/dist/leaflet.js').read()

JS = r'''
async (args) => {
  const a = window.__ra;
  const [diff, cs, maxMin, seed, withHuman, region, peace] = args;
  const gm = RA.regionMap(a.map, region);
  const G = RA.newGame(gm, { seed, difficulty: diff, cityStates: cs, peace });
  if (withHuman) {
    // a "human" driven by the AI to test the player path (uses AI.think)
    const n = G.P.find(p => p && p.type === 'nation' && p.iso === 'BIH') || G.P.find(p => p && p.type === 'nation');
    RA.placeHuman(G, n.nation.c, 'Test');
    RA.AI.init(G, G.me);
  }
  const firstWar = { t: -1 };
  const origLA = G.launchAttack.bind(G);
  G.launchAttack = (...x) => { const r = origLA(...x); if (r && x[1] && firstWar.t < 0) firstWar.t = G.tick; return r; };
  RA.startGame(G);
  a.G = G; a.attractMode = false;
  const out = { mins: [], tickMs: [], maxTick: 0 };
  let nukes = 0, boats = 0, allies = 0;
  const origNuke = G.launchMissile.bind(G); const mk = {}; G.launchMissile = (...x) => { const r = origNuke(...x); if (typeof r === 'object') { nukes++; mk[x[1]] = (mk[x[1]]||0)+1; } return r; }; out.mk = mk;
  const origBoat = G.launchBoat.bind(G); G.launchBoat = (...x) => { const r = origBoat(...x); if (typeof r === 'object') boats++; return r; };
  const origAlly = G.makeAlliance.bind(G); G.makeAlliance = (...x) => { allies++; return origAlly(...x); };
  let t0 = performance.now();
  let chunkMax = 0;
  while (G.state === 'play' && G.tick < maxMin * 600) {
    const s = performance.now();
    G.step();
    const d = performance.now() - s;
    if (d > chunkMax) chunkMax = d;
    if (G.tick % 600 === 0) {
      const alive = G.P.filter(p => p && p.alive && p.spawned);
      const nat = alive.filter(p => p.type !== 'bot');
      const lead = alive.sort((x, y) => y.tiles - x.tiles)[0];
      const owned = alive.reduce((s, p) => s + p.tiles, 0);
      out.mins.push({ m: G.tick / 600, lead: lead.name, share: +(lead.tiles / G.landTotal() * 100).toFixed(1), owned: +(owned / G.landTotal() * 100).toFixed(1), nations: nat.length, alive: alive.length, attacks: G.attacks.filter(x => !x.done).length, structs: G.structs.filter(s => !s.dead).length, units: G.units.filter(u => !u.dead).length, trains: G.trains.length, planes: G.planes.length, win: +G.wLevel.toFixed(2), me: G.me ? +(G.me.tiles / G.landTotal() * 100).toFixed(1) : null, top: alive.slice(0,3).map(p => p.name.slice(0,6)+':'+(p.troops/p.maxT).toFixed(2)+'/'+G.attacks.filter(x=>!x.done&&x.a===p.id).length+'/'+p.allies.size), msPerTick: +((performance.now() - t0) / 600).toFixed(2), maxTick: +chunkMax.toFixed(1) });
      t0 = performance.now(); chunkMax = 0;
      await new Promise(r => setTimeout(r, 0));
    }
  }
  const kinds = {}; for (const s of G.structs) kinds[s.type] = (kinds[s.type] || 0) + 1;
  out.end = { tick: G.tick, min: +(G.tick / 600).toFixed(1), winner: G.winner ? G.winner.name : null, nukes, boats, allies, built: kinds, mirvs: G.mirvCount, firstWarTick: firstWar.t, trades: G.P.filter(p => p && p.trade).reduce((s, p) => s + p.trade.size, 0) / 2, region: gm.region ? gm.region.name : 'Evropa' };
  G.state = 'over';
  return out;
}
'''


async def main():
    diff = sys.argv[1] if len(sys.argv) > 1 else 'srednje'
    cs = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    maxmin = int(sys.argv[3]) if len(sys.argv) > 3 else 40
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else 777
    human = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    region = sys.argv[6] if len(sys.argv) > 6 else 'evropa'
    peace = int(sys.argv[7]) if len(sys.argv) > 7 else 60
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 800, 'height': 700})
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
        res = await page.evaluate(JS, [diff, cs, maxmin, seed, human, region, peace])
        for m in res['mins']:
            print(m)
        print('END', res['end'], 'missiles', res.get('mk'))
        print('\n'.join(errs[:20]) or 'no errors')
        await b.close()

asyncio.run(main())

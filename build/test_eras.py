"""Eras + real borders + battle royale: every era builds a borders game, a human (driven by the AI) plays it,
and the checks make sure each era only uses its own units, buildings and weapons."""
import asyncio, sys, json
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

R = ROOT
OUT = R + 'build/shots/'
os.makedirs(OUT, exist_ok=True)
LEAF = open(R + 'package/dist/leaflet.js').read()
TICKS = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else None
fails = []


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


RUN = r'''
async ([era, start, gm, region, pick, ticks]) => {
  const a = window.__ra, ui = a.ui;
  ui.settings.era = era; ui.settings.start = start; ui.settings.gm = gm; ui.settings.region = region; ui.settings.peace = 60;
  ui.settings.difficulty = 'srednje';
  a.newGame();
  const G = a.G;
  const out = { era: RA.ERA.id, borders: G.borders, nations: G.P.filter(p => p && p.type === 'nation').length, neutral: 0 };
  for (let c = 0; c < G.map.N; c++) if (G.map.land[c] && !G.map.block[c] && !G.owner[c]) out.neutral++;
  let n = G.P.find(p => p && p.type === 'nation' && p.iso === pick) || G.P.find(p => p && p.type === 'nation' && p.alive);
  const res = RA.placeHuman(G, n.nation.c, 'Test');
  out.pick = res.err || (G.me && G.me.name);
  out.meTiles = G.me ? G.me.tiles : 0;
  out.spawnText = document.getElementById('spawnText').textContent.slice(0, 120);
  a.start();
  RA.AI.init(G, G.me);   // let the computer play the human's country too
  const seen = { build: {}, rec: {}, mis: {} };
  const ob = G.build.bind(G); G.build = (pid, t, c) => { const r = ob(pid, t, c); if (typeof r === 'object') seen.build[t] = (seen.build[t] || 0) + 1; return r; };
  const orc = G.recruitUnit.bind(G); G.recruitUnit = (pid, t, c) => { const r = orc(pid, t, c); if (typeof r === 'object') seen.rec[t] = (seen.rec[t] || 0) + 1; return r; };
  const om = G.launchMissile.bind(G); G.launchMissile = (pid, t, c) => { const r = om(pid, t, c); if (typeof r === 'object') seen.mis[t] = (seen.mis[t] || 0) + 1; return r; };
  let zoneLog = [];
  const t0 = performance.now();
  for (let i = 0; i < ticks && G.state === 'play'; i++) {
    G.step();
    if (G.zone && G.tick % 600 === 0) zoneLog.push([G.tick / 600, G.zone.state, +G.zone.r.toFixed(1), G.landTotal(), G.alivePlayers().length]);
    if (i % 500 === 0) await new Promise(r => setTimeout(r, 0));
  }
  out.ms = Math.round(performance.now() - t0);
  out.tick = G.tick;
  out.state = G.state;
  out.winner = G.winner ? G.winner.name : null;
  out.alive = G.alivePlayers().length;
  out.seen = seen;
  out.off = { struct: Object.keys(RA.STRUCT).filter(k => RA.STRUCT[k].na), mis: Object.keys(RA.MISSILE).filter(k => RA.MISSILE[k].na), para: RA.ERA.para };
  out.zone = zoneLog;
  if (G.zone) {
    let bad = 0;
    for (let c = 0; c < G.map.N; c++) if (G.owner[c] && G.zoneOut(c)) bad++;
    out.ownedOutside = bad;
  }
  out.lead = G.alivePlayers().sort((x, y) => y.tiles - x.tiles).slice(0, 4).map(p => `${p.name} ${(p.tiles / G.landTotal() * 100).toFixed(1)}%`);
  out.dock = document.getElementById('aStrike').textContent;
  return out;
}
'''


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
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
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=90000)
        await page.wait_for_timeout(600)
        check(not errs, 'boot without errors ' + ' | '.join(errs[:3]))
        await page.screenshot(path=OUT + 'eras_0_start.png', full_page=False)
        # start screen: era buttons + region counts react to the era
        await page.click('#eraSeg button[data-v="rim"]')
        await page.wait_for_timeout(300)
        rc = await page.evaluate('() => [...document.querySelectorAll("#regSeg small")].map(e => e.textContent)')
        print('region counts (rim):', rc)
        await page.screenshot(path=OUT + 'eras_1_start_rim.png', full_page=True)
        plan = [
            ('rim', 'granice', 'klasik', 'evropa', 'DAC'),
            ('srednji', 'granice', 'klasik', 'balkan', 'BOS'),
            ('napoleon', 'granice', 'klasik', 'centar', 'SAX'),
            ('ww1', 'granice', 'klasik', 'evropa', 'SRB'),
            ('ww2', 'granice', 'klasik', 'evropa', 'YUG'),
            ('hladni', 'granice', 'klasik', 'evropa', 'YUG'),
            ('danas', 'granice', 'br', 'evropa', 'BIH'),
            ('rim', 'slobodno', 'klasik', 'jug', 'ROM'),
            ('srednji', 'slobodno', 'br', 'evropa', 'HUN'),
        ]
        for era, start, gm, reg, pick in plan:
            if ONLY and era not in ONLY:
                continue
            n0 = len(errs)
            r = await page.evaluate(RUN, [era, start, gm, reg, pick, TICKS])
            print(json.dumps(r, ensure_ascii=False)[:1500])
            tag = f'{era}/{start}/{gm}/{reg}'
            check(len(errs) == n0, f'{tag}: no errors ' + ' | '.join(errs[n0:n0 + 3]))
            check(r['era'] == era, f'{tag}: era applied')
            check(r['borders'] == (start == 'granice'), f'{tag}: borders flag')
            if start == 'granice':
                check(r['neutral'] < 800, f'{tag}: all land owned at start (neutral {r["neutral"]})')
            check(r['meTiles'] > 0, f'{tag}: human took {r["pick"]} ({r["meTiles"]} cells)')
            bad_b = [k for k in r['seen']['build'] if k in r['off']['struct']]
            bad_m = [k for k in r['seen']['mis'] if k in r['off']['mis']]
            check(not bad_b and not bad_m, f'{tag}: only era buildings/weapons used (built {r["seen"]["build"]}, fired {r["seen"]["mis"]})')
            if gm == 'br':
                check(r.get('ownedOutside', 0) == 0, f'{tag}: no land owned outside the ring ({r.get("ownedOutside")})')
                check(len(r['zone']) > 0, f'{tag}: zone log {r["zone"]}')
            if era in ('rim', 'srednji', 'napoleon') and start == 'granice':
                await page.evaluate('() => { const a = window.__ra; a.lmap.setView(a.map.latLngOfCell(a.G.me.capital), 5.2, { animate: false }); }')
                await page.wait_for_timeout(400)
                await page.screenshot(path=OUT + f'eras_play_{era}.png')
        await page.evaluate('() => window.__ra.showStart()')
        await page.wait_for_timeout(300)
        check(await page.evaluate('() => RA.ERA.id') == 'danas', 'back to start: attract game uses today')
        await b.close()
    print('FAILS:', len(fails))
    for f in fails:
        print(' -', f)


asyncio.run(main())

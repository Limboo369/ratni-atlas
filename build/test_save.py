"""Save and continue ("Nastavi igru"): play a single-player game with a few commands, reload the page, continue from the
start screen and check that the replayed game is exactly the same (tick + G.hash()), then that it plays on.
python3 build/test_save.py [klasik|granice]"""
import asyncio, os, sys
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = R + 'build/shots/'
os.makedirs(OUT, exist_ok=True)
LEAF = open(R + 'package/dist/leaflet.js').read()
fails = []
START = sys.argv[1] if len(sys.argv) > 1 else 'klasik'


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


# a few ticks, then an attack on a neighbour's border cell (or free land), repeated; returns [tick, hash, commands]
PLAY = '''(rounds) => {
  const app = window.__ra, G = app.G, ui = app.ui, me = G.me, map = G.map;
  app.paused = true;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < 40 && G.state === 'play'; i++) G.step();
    let tgt = -1;
    for (let c = 0; c < G.owner.length && tgt < 0; c++) {
      if (G.owner[c] !== me.id) continue;
      const W = map.W; for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < G.owner.length) if (map.land[n] && G.owner[n] !== me.id && !map.block[n]) { tgt = n; break; }
    }
    if (tgt >= 0) ui.act('atk', [tgt, 0.12, r % 2]);
  }
  return [G.tick, G.hash(), G.rec.cmds.length, G.state, me.alive, Math.round(me.area / G.landTotal() * 100)];
}'''


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 1400, 'height': 900})
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
        check(await ev('document.getElementById("resumeBtn").hidden'), 'no save yet: no "Nastavi igru"')

        await ev('''() => { const ui = window.__ra.ui; Object.assign(ui.settings, { map: 'evropa', region: 'balkan', era: 'danas', start: '%s', gm: 'klasik', difficulty: 'lako', peace: 180 }); window.__ra.newGame(); }''' % START)
        await page.wait_for_function('window.__ra.G && window.__ra.G.state === "spawn"', timeout=30_000)
        # two picks (the second one moves the player): both are replayed
        await ev('''() => { const G = window.__ra.G, ui = window.__ra.ui, ns = G.P.filter(p => p && p.type === 'nation' && p.alive).sort((x, y) => x.area - y.area);
          ui.pickNation(String(ns[0].id)); ui.pickNation(String(ns[ns.length - 1].id)); window.__ra.start(); }''')
        # tax (plan 33): the gold in the top bar opens the economy sheet
        await ev('window.__ra.paused = true')
        await page.click('.stat.gold')
        await page.wait_for_selector('#taxSeg button[data-v="4"]')
        g0 = await ev('() => { const G = window.__ra.G; G.step(); return G.me.goldRate; }')
        await page.click('#taxSeg button[data-v="4"]')
        t = await ev('() => { const G = window.__ra.G; G.step(); return [G.me.tax, G.me.goldRate, document.querySelector("#taxSeg button[data-v=\\"4\\"]").getAttribute("aria-pressed")]; }')
        check(t[0] == 4 and t[1] > g0 * 1.3 and t[2] == 'true', f'tax "Vrlo visok": more gold {g0:.0f} -> {t[1]:.0f}/s {t}')
        await page.keyboard.press('Escape')
        # aggressive expansion (plan 36): a conqueror becomes the coalition's target, the AI refuses to ally with it
        ae = await ev('''() => { const G = window.__ra.G, me = G.me, C = RA.CFG;
          const ai = G.P.find(p => p && p.alive && p.type === 'nation' && p !== me);
          const lead = G.leader && G.leader.share > 0.3;
          G.addAE(me, C.AE_COALITION + 5);
          const warned = G.events.some(e => e.kind === 'bad' && /udružuju/.test(e.text));
          const r = [RA.AI.menace(G) === me || lead, RA.AI.considerAlliance(G, ai, me), warned];
          for (let i = 0; i < 3000; i++) me.ae *= C.AE_DECAY;
          G._menaceT = -1;
          r.push(RA.AI.menace(G) !== me, Math.round(me.ae));
          G.addAE(me, -me.ae);
          return r; }''')
        check(ae[0] and ae[1] is False and ae[2] and ae[3], f'aggressive expansion: coalition target, no alliance, warned, fades {ae}')
        a = await ev(PLAY, 40)
        check(a[2] >= 6 and a[3] == 'play' and a[4], f'commands recorded, still playing: {a[2:]}')
        await ev('window.__ra.autosave(true)')
        saved = await ev('() => { const s = JSON.parse(localStorage.getItem("ra_save")); return s && [s.tick, s.rec.picks.length, s.meta.where]; }')
        check(saved and saved[0] == a[0] and saved[1] == 2, f'saved in this browser: {saved}')

        await page.reload()
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=60_000)
        await page.wait_for_function('!document.getElementById("resumeBtn").hidden', timeout=10_000)
        txt = await ev('document.getElementById("resumeBtn").textContent')
        check('Nastavi igru' in txt and 'Balkan' in txt, f'start screen offers the saved game: {txt!r}')
        await page.screenshot(path=OUT + 'save_start.png')
        await page.click('#resumeBtn')
        await page.wait_for_function('window.__ra.G && window.__ra.G.rec && !window.__ra.replaying && document.getElementById("loading").hidden && document.getElementById("startScreen").hidden', timeout=60_000)
        c = await ev('() => { const G = window.__ra.G; return [G.tick, G.hash(), G.rec.cmds.length, window.__ra.paused, G.state]; }')
        check(c[0] == a[0], f'same tick after replay: {c[0]} vs {a[0]}')
        check(c[1] == a[1], f'same game after replay (hash {c[1]} vs {a[1]})')
        check(c[3] is True and c[4] == 'play', f'continued paused, in play: {c[3:]}')
        check(await ev('window.__ra.G.me.tax') == 4, 'the tax level comes back with the saved game')
        await page.screenshot(path=OUT + 'save_resumed.png')
        # plays on and keeps recording into the same save
        d = await ev(PLAY, 2)
        check(d[0] > a[0] and d[2] >= c[2], f'plays on after continue: tick {d[0]}, commands {d[2]}')
        await ev('window.__ra.autosave(true)')
        t2 = await ev('JSON.parse(localStorage.getItem("ra_save")).tick')
        check(t2 == d[0], 'the save follows the continued game')
        # leaving to the start screen keeps the save; losing drops it
        await ev('window.__ra.showStart()')
        await page.wait_for_function('!document.getElementById("resumeBtn").hidden', timeout=10_000)
        check(True, 'after leaving the game the start screen offers it again')
        await page.click('#resumeBtn')
        await page.wait_for_function('window.__ra.G && window.__ra.G.rec && !window.__ra.replaying && document.getElementById("loading").hidden && document.getElementById("startScreen").hidden', timeout=60_000)
        await ev('() => { const G = window.__ra.G; G.me.alive = false; window.__ra.gameOver("lost"); }')
        check(await ev('localStorage.getItem("ra_save") === null'), 'a lost game is no longer offered')
        check(not errs, f'no page errors {errs[:3]}')
        await b.close()
    print('\n' + ('ALL OK' if not fails else f'{len(fails)} FAILED: {fails}'))
    sys.exit(1 if fails else 0)


asyncio.run(main())

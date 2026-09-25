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


async def shot(page, name):
    # screenshots only help debugging: a slow CI renderer must not fail the test
    try:
        await page.screenshot(path=OUT + name, timeout=15_000)
    except Exception as e:
        print('     (no screenshot ' + name + ': ' + str(e).splitlines()[0] + ')')


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
        await shot(page, 'save_start.png')
        await page.click('#resumeBtn')
        await page.wait_for_function('window.__ra.G && window.__ra.G.rec && !window.__ra.replaying && document.getElementById("loading").hidden && document.getElementById("startScreen").hidden', timeout=60_000)
        c = await ev('() => { const G = window.__ra.G; return [G.tick, G.hash(), G.rec.cmds.length, window.__ra.paused, G.state]; }')
        check(c[0] == a[0], f'same tick after replay: {c[0]} vs {a[0]}')
        check(c[1] == a[1], f'same game after replay (hash {c[1]} vs {a[1]})')
        check(c[3] is True and c[4] == 'play', f'continued paused, in play: {c[3:]}')
        check(await ev('window.__ra.G.me.tax') == 4, 'the tax level comes back with the saved game')
        await shot(page, 'save_resumed.png')
        # plays on and keeps recording into the same save
        d = await ev(PLAY, 2)
        check(d[0] > a[0] and d[2] >= c[2], f'plays on after continue: tick {d[0]}, commands {d[2]}')
        # vassals (plan 40): a weak neighbour accepts, pays tribute, fights at your side; "Oslobodi" lets it go
        vid = await ev('''() => { const G = window.__ra.G, me = G.me;
          me.troops = Math.max(me.troops, 500000);
          const nb = G.P.filter(o => o && o.alive && o !== me && !o.human && G.hasBorderWith(me, o.id) && !me.allies.has(o.id)).sort((x, y) => (x.type === 'nation' ? 0 : 1) - (y.type === 'nation' ? 0 : 1) || x.area - y.area);
          const o = nb[0] || null;
          if (o && o.area > me.area * RA.CFG.VASSAL_AREA) RA.CFG.VASSAL_AREA = 99; // the test's own game: land alone must not block
          if (!o) return -1;
          o.troops = Math.min(o.troops, me.troops * 0.05);
          return o.id; }''')
        check(vid > 0, f'a weak neighbour to offer vassalage to: {vid}')
        if vid > 0:
            await page.keyboard.press('s')
            await page.wait_for_selector(f'[data-do="vas:{vid}"]')
            await page.click(f'[data-do="vas:{vid}"]')
            for _ in range(6):
                if await ev(f'window.__ra.G.P[{vid}].lord') == await ev('window.__ra.G.me.id'):
                    break
                await ev(f'() => {{ window.__ra.G.P[{vid}].troops = 10; window.__ra.ui.act("vas", [{vid}]); }}')
            v = await ev(f'''() => {{ const G = window.__ra.G, me = G.me, o = G.P[{vid}];
              const r = [o.lord === me.id, me.allies.get(o.id) === Infinity, G.allyCount(me), G.requestAlliance(o.id, G.P.find(x => x && x.alive && x !== me && x !== o && x.type === 'nation').id)];
              for (let i = 0; i < 120; i++) G.step();
              r.push(Math.round(me.tributeRate || 0), Math.round(o.tribute || 0));
              return r; }}''')
            check(v[0] and v[1] and v[2] == 0 and 'vazal' in str(v[3]).lower() and v[4] > 0 and v[5] > 0, f'vassal: permanent, not counted, no other alliances, tribute flows {v}')
            await page.wait_for_timeout(200)
            await ev('window.__ra.ui.diploSheet(true)')
            txt = await ev('document.getElementById("sheet").textContent')
            check('vazal · danak' in txt and 'Oslobodi' in txt, 'Savezi shows the vassal with its tribute and "Oslobodi"')
            await page.click(f'[data-do="brk:{vid}"]')
            await page.click('#sheet [data-y]')
            f = await ev(f'() => {{ const G = window.__ra.G, me = G.me, o = G.P[{vid}]; return [o.lord, me.allies.has(o.id), me.traitorUntil > G.tick]; }}')
            check(f[0] == 0 and not f[1] and not f[2], f'"Oslobodi" frees the vassal without betrayal {f}')
            await page.keyboard.press('Escape')
        # loans with collateral (plan 34): borrow, repay; an unpaid loan hands the pledge to the lender
        lid = await ev('''() => { const G = window.__ra.G, me = G.me;
          const nb = G.P.filter(o => o && o.alive && o !== me && o.type === 'nation' && o.ai && !G.atWar(me, o) && !me.allies.has(o.id));
          for (const o of nb) { o.gold = Math.max(o.gold, 5e7); o.rel[me.id] = 90; }
          return nb.length ? nb[0].id : -1; }''')
        if lid < 0:
            check(False, 'a state to borrow from')
        else:
            await ev(f'() => {{ const me = window.__ra.G.me, o = window.__ra.G.P[{lid}]; if (!me.nbCache || !me.nbCache.has(o.id)) me.trade.add(o.id), o.trade.add(me.id); }}')
            await page.keyboard.press('z')
            await page.wait_for_selector(f'[data-loan="{lid}:0"]')
            g0 = await ev('window.__ra.G.me.gold')
            await page.click(f'[data-loan="{lid}:0"]')
            for _ in range(8):
                if await ev('window.__ra.G.loans.length'):
                    break
                await ev(f'window.__ra.ui.act("loan", [{lid}, 0])')
            ln = await ev('() => { const G = window.__ra.G, l = G.loans[0]; return l ? [l.amount, l.owed, l.cells.length, G.me.gold] : null; }')
            check(ln and ln[3] >= g0 + ln[0] - 1 and ln[1] > ln[0] and ln[2] > 0, f'loan taken: gold {g0:.0f} -> {ln and ln[3]:.0f}, {ln}')
            await ev('window.__ra.ui.econSheet(true)')
            txt = await ev('document.getElementById("sheet").textContent')
            check('duguješ' in txt and 'Vrati' in txt, 'Ekonomija lists the loan with "Vrati"')
            await ev('window.__ra.G.me.gold = Math.max(window.__ra.G.me.gold, window.__ra.G.loans[0].owed + 1)')
            await page.click('[data-pay]')
            check(await ev('window.__ra.G.loans.length') == 0, 'the loan is repaid')
            # a second loan, left unpaid: the pledge goes to the lender when it is due
            for _ in range(8):
                if await ev('window.__ra.G.loans.length'):
                    break
                await ev(f'window.__ra.ui.act("loan", [{lid}, 1])')
            q = await ev('''() => { const G = window.__ra.G, me = G.me, l = G.loans[0];
              if (!l) return null;
              const mine = Array.from(l.cells).filter(c => G.owner[c] === me.id).length;
              // Isolate maturity from eight minutes of unrelated AI wars: a defeated lender
              // legitimately forgives its loans, and conquered collateral is no longer ours.
              me.gold = 0;
              G._loans();
              const pending = G.loans.includes(l) && Array.from(l.cells).every(c => G.owner[c] === me.id);
              l.due = G.tick;
              G._loans();
              const theirs = Array.from(l.cells).filter(c => G.owner[c] === l.from).length;
              return [mine, theirs, G.loans.length, pending]; }''')
            check(q and q[3] and q[2] == 0 and q[1] == q[0] and q[1] > 0, f'unpaid: the pledged land goes to the lender {q}')
            await page.keyboard.press('Escape')
        await ev('window.__ra.autosave(true)')
        t2 = await ev('JSON.parse(localStorage.getItem("ra_save")).tick')
        check(t2 == await ev('window.__ra.G.tick') and t2 >= d[0], 'the save follows the continued game')
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

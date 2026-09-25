"""End-to-end UI test for v0.3: start screen (region + peace), how-to over start screen, nation picker, peace rule,
attack chips + retreat, units (recruit / select / move), diplomacy offers (alliance vs trade), missile aiming preview, end screen."""
import asyncio, sys, json
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

R = ROOT
OUT = R + 'build/shots/'
os.makedirs(OUT, exist_ok=True)
LEAF = open(R + 'package/dist/leaflet.js').read()
MODE = sys.argv[1] if len(sys.argv) > 1 else 'phone'
REGION = sys.argv[2] if len(sys.argv) > 2 else 'balkan'
fails = []


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        if MODE == 'phone':
            ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, is_mobile=True, has_touch=True)
        else:
            ctx = await b.new_context(viewport={'width': 1400, 'height': 900})
        page = await ctx.new_page()
        page.set_default_timeout(90_000)  # CI (GitHub runner, swiftshader) crta sporo; screenshot usred partije zna preći 30 s
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
        await page.wait_for_timeout(800)

        async def ev(js):
            return await page.evaluate(js)

        async def tap_xy(x, y):
            if MODE == 'phone':
                await page.touchscreen.tap(x, y)
            else:
                await page.mouse.click(x, y)

        async def tap_cell(c):
            pt = await ev(f'() => {{ const a = window.__ra; const p = a.lmap.latLngToContainerPoint(a.map.latLngOfCell({c})); return [p.x, p.y]; }}')
            await tap_xy(pt[0], pt[1])

        async def steps(n):
            await ev(f'() => {{ const G = window.__ra.G; for (let i = 0; i < {n}; i++) G.step(); }}')
            await page.wait_for_timeout(250)

        # 1. start screen with region picker
        await page.screenshot(path=OUT + f'{MODE}_v3_1_start.png')
        # 2. "Kako se igra" from the start screen must be visible on top
        await page.click('#howBtn')
        await page.wait_for_timeout(500)
        top = await ev('() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight - 120); return !!(e && e.closest("#sheet")); }')
        check(top, 'how-to sheet is on top of the start screen')
        await page.screenshot(path=OUT + f'{MODE}_v3_2_howto.png')
        await ev('window.__ra.ui.closeSheet()')

        # 3. region + peace, then spawn by picking a nation from the list
        await page.fill('#nameIn', 'Darko')
        await page.click('#eraSeg button[data-v="danas"]')
        await page.click('#configBtn')
        await page.click('#startSeg button[data-v="slobodno"]')
        await page.click('#gmSeg button[data-v="klasik"]')
        await page.click(f'#regSeg button[data-v="{REGION}"]')
        await page.click('#peaceSeg button[data-v="60"]')
        await page.click('#configDone')
        await page.click('#goBtn')
        await page.wait_for_timeout(900)
        info = await ev('() => { const G = window.__ra.G; return { region: G.map.region && G.map.region.name, nations: G.P.filter(p => p && p.type === "nation").map(p => p.iso), land: G.map.landCount, peace: G.peaceUntil }; }')
        print('game', info)
        check(REGION == 'evropa' or info['region'] is not None, 'region map active')
        iso = 'BIH' if 'BIH' in info['nations'] else info['nations'][0]
        pid = await ev(f'() => window.__ra.G.P.find(p => p && p.iso === "{iso}").id')
        await page.select_option('#natSel', str(pid))
        await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + f'{MODE}_v3_3_spawn.png')
        check(await ev('() => !document.getElementById("startBtn").disabled'), 'nation picked from list enables start')
        # outside the region is refused
        if info['region']:
            bad = await ev('() => { const G = window.__ra.G; for (let c = 0; c < G.map.N; c++) if (G.map.block[c] && window.__ra.map.land[c]) return c; return -1; }')
            r = await ev(f'() => RA.placeHuman(window.__ra.G, {bad}, "x")')
            check('err' in r, 'spawn outside the region is refused: ' + str(r.get('err')))
            await ev(f'() => window.__ra.ui.pickNation("{pid}")')
        # This test fast-forwards a minute of play; queued tutorial toasts would cover map tap targets.
        await ev('() => { window.__ra.ui.noTips = true; }')
        await page.click('#startBtn')
        await page.wait_for_timeout(1200)

        # 4. peace: attacking a state is refused, free land is fine
        other = await ev('() => { const G = window.__ra.G, me = G.me; const o = G.P.find(p => p && p.alive && p.type === "nation" && p !== me); return o.cells[0]; }')
        r = await ev(f'() => window.__ra.G.cmdAttack(window.__ra.G.me.id, {other}, 0.3)')
        check('err' in r and 'Mirno doba' in r['err'], 'attack on a state refused in peace: ' + str(r.get('err', r))[:70])
        pill = await ev('() => document.getElementById("status").textContent')
        check('Mirno doba' in pill, 'peace pill shown: ' + pill)
        await page.screenshot(path=OUT + f'{MODE}_v3_4_peace.png')
        # expand a few times into free land during the peace
        for k in range(4):
            await ev('''() => { const G = window.__ra.G, me = G.me; const info = RA.AI.scan(G, me); if (info.neutralCell >= 0) G.cmdAttack(me.id, info.neutralCell, 0.35); }''')
            await steps(120)
        # 5. after the peace: attack a neighbour, see the chip, retreat with the ✕
        await steps(max(0, info['peace'] - await ev('() => window.__ra.G.tick') + 5))
        nb = await ev('''() => { const G = window.__ra.G, me = G.me; const info = RA.AI.scan(G, me); const ids = [...info.nb.keys()].filter(id => !me.allies.has(id)); if (!ids.length) return null; const o = G.P[ids[0]]; const c = RA.AI.borderCellFacing(G, o, me.id); return { id: o.id, name: o.name, cell: c >= 0 ? c : o.cells[0] }; }''')
        print('neighbour', nb)
        if nb:
            await ev('window.__ra.ui.closeSheet(); window.__ra.ui.setMode(null)')
            await ev(f'() => window.__ra.lmap.setView(window.__ra.map.latLngOfCell({nb["cell"]}), 7)')
            await page.wait_for_timeout(400)
            await tap_cell(nb['cell'])
            await ev('() => { window.__ra.paused = true; }')  # freeze the sim so a counter-attack can't cancel ours mid-test
            try:  # the tap reaches the game a few hundred ms later on the CI runner
                await page.wait_for_function('window.__ra.G.attacks.some(a => !a.done && a.a === window.__ra.G.me.id && a.t > 0)', timeout=10_000)
            except Exception:
                pass
            # a border cell is small: the tap may land on the next state's cell, which is still a tap on a neighbour
            hit = await ev('() => window.__ra.G.attacks.filter(a => !a.done && a.a === window.__ra.G.me.id && a.t > 0).map(a => a.t)')
            check(len(hit) == 1, f'tap on neighbour launches an attack (targets {hit}, aimed at {nb["id"]})')
            try:  # chips redraw in the render loop; one frame can take > 300 ms on the CI runner
                await page.wait_for_function('document.querySelectorAll("#attBar .achip.out").length > 0', timeout=15_000)
            except Exception:
                pass
            chips = await ev('() => document.querySelectorAll("#attBar .achip.out").length')
            check(chips >= 1, f'attack chip shown ({chips})')
            try:
                await page.wait_for_function('document.querySelector("#feed .kf.war.mine") && document.querySelector("#dlogList li.war")', timeout=10_000)
            except Exception:
                pass
            kf = await ev('() => [document.querySelector("#feed .kf.war.mine")?.textContent, document.querySelector("#dlogList li.war")?.textContent]')
            check(bool(kf[0]) and bool(kf[1]), f'kill feed and diplomacy log show my war {kf}')
            await page.screenshot(path=OUT + f'{MODE}_v3_5_chips.png')
            before = await ev('() => window.__ra.G.me.troops')
            await page.click('#attBar .achip.out .x')
            await page.wait_for_timeout(300)
            after = await ev('() => window.__ra.G.me.troops')
            n_att = await ev('() => window.__ra.G.attacks.filter(a => !a.done && a.a === window.__ra.G.me.id && a.t > 0).length')
            check(n_att == 0 and after > before, f'retreat returns troops ({round(before)} -> {round(after)})')
            # the checks below need a big, hostile neighbour: pick the largest one that is alive and not an ally
            await ev('''() => { window.__pickNb = () => { const G = window.__ra.G, me = G.me;
                const ids = [...RA.AI.scan(G, me).nb.keys()].filter(id => { const o = G.P[id]; return o && o.alive && o.type !== 'bot' && !G.isFriendly(me, o); });
                ids.sort((a, b) => G.P[b].tiles - G.P[a].tiles); return ids[0]; }; }''')
            nb['id'] = await ev('() => window.__pickNb()')
            # directed attack: only the corridor from the nearest border to the tapped point is taken, then the army comes home
            d = await ev(f'''() => {{ const G = window.__ra.G, me = G.me, T = G.P[{nb["id"]}];
                me.troops = Math.max(me.troops, 150000);
                let far = -1, fd = -1; const W = G.map.W, cap = T.capital;
                const tgt = cap >= 0 && G.owner[cap] === T.id ? cap : T.cells[T.tiles >> 1];
                const before = G.owner.slice(), tiles0 = T.tiles;
                const others = G.attacks.filter(a => !a.done && a.a === me.id).map(a => [a.t, !!a.corr, !!a.only, a.via && a.via.length]);
                const r = G.exec(me.id, 'atk', [tgt, 0.4, 1]);
                const att = r && r.att; if (!att || !att.corr) return {{ err: JSON.stringify(r && (r.err || r.ok)) }};
                const k = att.corr; let n = 0;
                while (!att.done && n < 4000) {{ G.step(); n++; }}
                let taken = 0, outside = 0;
                // outside the corridor only pockets the thrust cut off (a surrounded enclave falls by the enclave rule): they no longer touch T
                const touchesT = (c) => {{ const x = c % W, o = G.owner; return (x > 0 && o[c - 1] === T.id) || (x < W - 1 && o[c + 1] === T.id) || o[c - W] === T.id || o[c + W] === T.id; }};
                for (let c = 0; c < G.map.N; c++) if (before[c] === T.id && G.owner[c] === me.id) {{ taken++; if (!G._inCorr(k, c) && touchesT(c)) outside++; }}
                // an arrow drawn from one of my cells: the corridor starts there
                let from = -1; for (let i = 0; i < me.tiles && from < 0; i++) {{ const c = me.cells[i], x = c % W;
                    if ((x > 0 && G.owner[c - 1] === T.id) || (x < W - 1 && G.owner[c + 1] === T.id)) from = c; }}
                const tgt2 = G.owner[tgt] === T.id ? tgt : T.cells[T.tiles >> 1]; // the first thrust may have taken tgt
                const fr = G.exec(me.id, 'atk', [tgt2, 0.1, 1, from]);
                const fromOk = !!(fr && fr.att && fr.att.corr && fr.att.corr.sx === from % W && fr.att.corr.sy === ((from / W) | 0));
                const all = G.exec(me.id, 'atk', [tgt2, 0.2, 0]);
                return {{ taken, outside, tiles0, alive: T.alive, done: att.done, ticks: n, r: Math.round(Math.sqrt(k.r2)), whole: !!(all && all.att && !all.att.corr), fromOk, others, allies: [...me.allies.keys()] }}; }}''')
            print('directed attack', d)
            check(d.get('taken', 0) > 0 and d.get('outside', 1) == 0, f'directed attack takes only its corridor ({d})')
            check(d.get('done') and d.get('alive') and d.get('taken', 0) < d.get('tiles0', 0), 'the directed attack ends by itself; the rest of the state stays')
            check(d.get('whole'), '"Napadni cijelu granicu" is a whole-border attack')
            check(d.get('fromOk'), 'an arrow drawn from my own cell starts the corridor there')
            await ev('() => { const G = window.__ra.G; for (const a of G.attacks) if (!a.done && a.a === G.me.id) G.retreat(a.id); }')
            nb['id'] = await ev('() => window.__pickNb()')
            # "Vrati granice": the neighbour takes some of my land; one click on the chip takes back only that land
            lost = await ev(f'''() => {{ const G = window.__ra.G, me = G.me, T = G.P[{nb["id"]}];
                for (const a of G.attacks) if (!a.done && (a.a === me.id || a.t === me.id)) a.done = true;
                T.troops = Math.max(T.troops, 400000); const before = G.owner.slice();
                const att = G.launchAttack(T.id, me.id, 300000, me.capital);
                for (let i = 0; i < 40 && !att.done; i++) G.step();
                G._endAttack(att, 0);
                window.__before2 = before;
                const m = G.lostTo(me).get(T.id); return m ? m.length : 0; }}''')
            try:
                await page.wait_for_selector('#attBar .achip.back', timeout=10_000)
            except Exception:
                pass
            await page.screenshot(path=OUT + f'{MODE}_v3_5c_back.png')
            has = await ev('() => !!document.querySelector("#attBar .achip.back")')
            check(lost >= 3 and has, f'land taken from me -> "Vrati" chip ({lost} cells)')
            if has:
                await ev(f'() => {{ const G = window.__ra.G; G.me.troops = Math.max(G.me.troops, 300000); G.P[{nb["id"]}].troops = 20000; }}')
                await ev('() => { window.__ra.ui.ratio = 1; }')
                # the chip of this neighbour (other states at war with me may have taken land too)
                await ev(f'() => {{ const el = [...document.querySelectorAll("#attBar .achip.back")].find(e => e._it && e._it.who === {nb["id"]}); (el || document.querySelector("#attBar .achip.back")).click(); }}')
                await page.wait_for_timeout(300)
                back = await ev(f'''() => {{ const G = window.__ra.G, me = G.me, T = G.P[{nb["id"]}], B = window.__before2;
                    const att = G.attacks.find(a => !a.done && a.only && a.a === me.id); if (!att) return {{ err: 'no reclaim attack' }};
                    for (let i = 0; i < 3000 && !att.done; i++) G.step();
                    let extra = 0; for (let c = 0; c < G.map.N; c++) if (B[c] === T.id && G.owner[c] === me.id) extra++;
                    const m = G.lostTo(me).get(T.id); return {{ left: m ? m.length : 0, extra, done: att.done }}; }}''')
                print('reclaim', back)
                await ev('() => { window.__ra.ui.ratio = 0.3; }')
                check(back.get('done') and back.get('extra') == 0 and back.get('left', 99) <= lost // 4, f'"Vrati granice" retakes only the lost land ({back}, lost {lost})')
            # right of passage: a military ally's border with a third state is a front for my attacks on it
            via = await ev('''() => { const G = window.__ra.G, me = G.me;
                for (const a of G.attacks) if (!a.done && a.a === me.id) a.done = true;
                const nbs = [...RA.AI.scan(G, me).nb.keys()].map(id => G.P[id]).filter(o => o.type === 'nation');
                for (const O of nbs) for (const T of G.P) {
                  if (!T || !T.alive || T === me || T === O || T.type !== 'nation' || G.hasBorderWith(me, T.id) || !G.hasBorderWith(O, T.id) || me.allies.has(T.id) || O.allies.has(T.id)) continue;
                  G.makeAlliance(me, O); me.troops = Math.max(me.troops, 300000); T.troops = Math.min(T.troops, 30000);
                  const before = T.tiles, r = G.cmdAttack(me.id, T.cells[T.tiles >> 1], 0.5, 1);
                  if (!r.att) return { err: r.err, T: T.name, O: O.name };
                  for (let i = 0; i < 400 && !r.att.done; i++) G.step();
                  const res = { T: T.name, O: O.name, lost: before - T.tiles, via: r.att.via && r.att.via.length };
                  G.breakAlliance(me.id, O.id, false); // the next checks attack this neighbour again
                  return res;
                }
                return { skip: true }; }''')
            print('passage', via)
            check(via.get('skip') or (via.get('lost', 0) > 0 and via.get('via')), f'attack through an ally\'s land (right of passage) {via}')
            nb['id'] = await ev('() => window.__pickNb()')
            if MODE != 'phone':
                # desktop: right button + drag from my land to the neighbour draws the arrow and launches the directed attack
                pts = await ev(f'''() => {{ const a = window.__ra, G = a.G, me = G.me, T = G.P[{nb["id"]}], W = G.map.W;
                    const tgt = T.capital >= 0 && G.owner[T.capital] === T.id ? T.capital : T.cells[T.tiles >> 1];
                    let from = -1, bd = 1e18; const tx = tgt % W, ty = (tgt / W) | 0;
                    for (let i = 0; i < me.tiles; i++) {{ const c = me.cells[i], dx = c % W - tx, dy = ((c / W) | 0) - ty, d = dx * dx + dy * dy; if (d < bd && d > 64) {{ bd = d; from = c; }} }}
                    const mid = a.map.latLngOfCell(from), ll = a.map.latLngOfCell(tgt);
                    a.lmap.fitBounds(L.latLngBounds([mid, ll]).pad(0.4), {{ animate: false }});
                    const p0 = a.lmap.latLngToContainerPoint(mid), p1 = a.lmap.latLngToContainerPoint(ll);
                    const r = a.lmap.getContainer().getBoundingClientRect();
                    return [r.left + p0.x, r.top + p0.y, r.left + p1.x, r.top + p1.y]; }}''')
                await page.wait_for_timeout(300)
                # panels over the map (news, log, chips) would catch the mouse: out of the way for this check
                await ev('() => { for (const id of ["feed", "dlog", "attBar", "toasts", "board"]) document.getElementById(id).style.visibility = "hidden"; }')
                n0 = await ev('() => window.__ra.G.attacks.filter(a => !a.done && a.a === window.__ra.G.me.id && a.corr).length')
                await page.mouse.move(pts[0], pts[1])
                await page.mouse.down(button='right')
                await page.mouse.move((pts[0] + pts[2]) / 2, (pts[1] + pts[3]) / 2, steps=5)
                await page.mouse.move(pts[2], pts[3], steps=5)
                arrow = await ev('() => window.__ra.ui.arrow && window.__ra.ui.arrow.ok')
                if not arrow:
                    print('arrow state', await ev('() => JSON.stringify(window.__ra.ui.arrow)'), pts)
                await page.screenshot(path=OUT + f'{MODE}_v3_5b_arrow.png')
                await page.mouse.up(button='right')
                await page.wait_for_timeout(300)
                n1 = await ev('() => window.__ra.G.attacks.filter(a => !a.done && a.a === window.__ra.G.me.id && a.corr).length')
                sheet = await ev('() => !document.getElementById("sheetWrap").hidden')
                check(arrow and n1 == n0 + 1 and not sheet, f'right-drag draws an arrow and launches a directed attack (arrow {arrow}, attacks {n0}->{n1}, menu {sheet})')
                await ev('() => { const G = window.__ra.G; for (const a of G.attacks) if (!a.done && a.a === G.me.id) G.retreat(a.id); }')
                # a right click without a drag still opens the menu of that spot
                await page.mouse.click(pts[2], pts[3], button='right')
                await page.wait_for_timeout(400)
                check(await ev('() => !document.getElementById("sheetWrap").hidden'), 'right click (no drag) opens the spot menu')
                await ev('() => { for (const id of ["feed", "dlog", "attBar", "toasts", "board"]) document.getElementById(id).style.visibility = ""; }')
                await ev('window.__ra.ui.closeSheet()')
            await ev('() => { window.__ra.paused = false; }')

        # 6. units: recruit infantry at the border, select it by tapping, move it
        await ev('() => { const me = window.__ra.G.me; me.gold = 5e6; me.troops = Math.max(me.troops, 120000); }')
        await ev('window.__ra.ui.armySheet()')
        await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + f'{MODE}_v3_6_army.png')
        await page.click('[data-rec="inf"]')
        # a cell deep in my land (a border cell can be taken in the wars the checks above started)
        bc = await ev('''() => { const G = window.__ra.G, me = G.me; for (const a of G.attacks) if (!a.done && a.t === me.id) a.done = true;
            return me.capital >= 0 && G.owner[me.capital] === me.id ? me.capital : me.cells[me.tiles >> 1]; }''')
        await ev(f'() => window.__ra.lmap.setView(window.__ra.map.latLngOfCell({bc}), 6.4)')
        await page.wait_for_timeout(300)
        await tap_cell(bc)
        await page.wait_for_timeout(300)
        nu = await ev('() => window.__ra.G.me.units.length')
        check(nu == 1, 'infantry recruited by tapping')
        await steps(40)
        await page.wait_for_timeout(300)
        await ev('() => { document.getElementById("toasts").innerHTML = ""; window.__ra.ui.reqToasts.clear(); }')  # offer cards would catch the tap
        upt = await ev('() => { const a = window.__ra, u = a.G.me.units[0]; if (!u) return null; const v = a.terr.view(); return [v.ox + u.x * v.cell, v.oy + u.y * v.cell]; }')
        if upt:
            await tap_xy(upt[0], upt[1])
            await page.wait_for_timeout(300)
            sel = await ev('() => { const m = window.__ra.ui.mode; return m && m.kind; }')
            if sel != 'unit':
                print('unit tap debug', upt, await ev(f'() => {{ const e = document.elementFromPoint({upt[0]}, {upt[1]}); return e ? (e.id || e.className || e.tagName) + " in " + (e.closest("[id]") || {{}}).id : null; }}'), await ev('() => window.__ra.G.me.units.length'))
            check(sel == 'unit', 'tapping my unit selects it')
            await page.screenshot(path=OUT + f'{MODE}_v3_7_unit.png')
            cap = await ev('() => window.__ra.G.me.capital')
            await tap_cell(cap)
            await page.wait_for_timeout(200)
            anchor = await ev('() => { const u = window.__ra.G.me.units[0]; return u ? u.anchor : -2; }')
            if anchor == -2:
                print('SKIP unit move: the unit was destroyed in the war going on')
            else:
                check(anchor == cap or anchor >= 0, 'unit got a new position')
        # 7. diplomacy: alliance offer and trade offer are separate
        # Keep the two injected offers stable while the UI responds on a slow renderer.
        offer = await ev('''() => { const app = window.__ra, G = app.G, me = G.me; app.paused = true;
            G.allyReqs = G.allyReqs.filter(r => r.to !== me.id); G.tradeReqs = G.tradeReqs.filter(r => r.to !== me.id);
            const os = G.P.filter(p => p && p.alive && p.type === 'nation' && p !== me && !me.allies.has(p.id) && !me.trade.has(p.id));
            // the AI makes its own alliances: an offer from a nation already at the limit is (rightly) refused on accept
            const a = os.find(p => G.allyCount(p) < RA.CFG.ALLY_MAX) || os[0], t = os.find(p => p !== a && p.trade.size < RA.CFG.TRADE_MAX) || os.find(p => p !== a) || a; G.allyReqs.push({from: a.id, to: me.id, exp: G.tick + 300}); G.tradeReqs.push({from: t.id, to: me.id, exp: G.tick + 300}); return {a: a.id, t: t.id}; }''')
        try:
            await page.wait_for_function('document.getElementById("diploBdg").textContent === "2"', timeout=10000)
        except Exception:
            pass
        badge = await ev('() => document.getElementById("diploBdg").textContent')
        check(badge == '2', f'diplomacy badge shows 2 offers (got {badge})')
        await page.screenshot(path=OUT + f'{MODE}_v3_8_offers.png')
        await page.click('#aDiplo')
        await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + f'{MODE}_v3_9_diplo.png')
        await page.click(f'[data-do="accT:{offer["t"]}"]')
        try:
            await page.wait_for_function(f'window.__ra.G.me.trade.has({offer["t"]})', timeout=5000)
        except Exception:
            pass
        check(await ev(f'() => window.__ra.G.me.trade.has({offer["t"]})'), 'trade offer accepted from the sheet')
        check(not await ev(f'() => window.__ra.G.me.allies.has({offer["t"]}) && {offer["t"]} !== {offer["a"]}'), 'trade does not create a military alliance')
        await page.click(f'[data-do="accA:{offer["a"]}"]')
        try:
            await page.wait_for_function(f'window.__ra.G.me.allies.has({offer["a"]})', timeout=5000)
        except Exception:
            pass
        check(await ev(f'() => window.__ra.G.me.allies.has({offer["a"]})'), 'military alliance accepted')
        await page.screenshot(path=OUT + f'{MODE}_v3_10_diplo2.png')
        # reopening/redrawing the sheet must not stack click handlers (they doubled per click and froze the browser)
        calls = await ev('''() => { const ui = window.__ra.ui;
            for (let i = 0; i < 6; i++) { ui.closeSheet(); ui.diploSheet(); ui.diploSheet(true); }
            let n = 0; ui.diploAct = () => { n++; };
            document.querySelector('#sheet [data-do^="show:"]').click(); delete ui.diploAct; return n; }''')
        check(calls == 1, f'one click on the diplomacy sheet runs one action (got {calls})')
        await ev('window.__ra.ui.closeSheet()')
        await ev('() => { window.__ra.paused = false; }')

        # 8. missiles: aim shows the blast radius, "Lansiraj" fires
        tgt = await ev('''() => { const G = window.__ra.G, me = G.me; me.gold = 3e7;
             const c = me.cells.find(c => typeof G.canBuild(me, 'silo', c) === 'number');
             if (c === undefined) throw new Error('No buildable silo cell in the test fixture');
             const s = G.build(me.id, 'silo', c);
             if (!s || typeof s !== 'object') throw new Error('Silo fixture failed: ' + s);
             s.doneAt = G.tick + 1; G.step(); G.step();
             const o = G.P.find(p => p && p.alive && p !== me && p.type === 'nation' && !me.allies.has(p.id) && p.tiles > 30); return o.cells[Math.floor(o.tiles / 2)]; }''')
        await ev('window.__ra.ui.strikeSheet()')
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + f'{MODE}_v3_11_strike.png')
        await page.click('[data-m="atom"]')
        await ev(f'() => window.__ra.lmap.setView(window.__ra.map.latLngOfCell({tgt}), 5.6)')
        await page.wait_for_timeout(300)
        await tap_cell(tgt)
        await page.wait_for_timeout(400)
        aim = await ev('() => window.__ra.ui.mode && window.__ra.ui.mode.aim')
        check(aim is not None and aim >= 0, 'first tap aims (no launch yet)')
        check(await ev('() => window.__ra.G.missiles.length') == 0, 'nothing launched while aiming')
        await page.screenshot(path=OUT + f'{MODE}_v3_12_aim.png')
        await page.click('#modeExtra')
        await page.wait_for_timeout(300)
        check(await ev('() => window.__ra.G.missiles.filter(m => !m.done).length') == 1, 'Lansiraj fires the bomb')
        await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT + f'{MODE}_v3_13_flight.png')

        # 9. long-press menu on own land, menu -> how-to, end screen
        await ev('() => window.__ra.ui.cellSheet(window.__ra.G.me.capital)')
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + f'{MODE}_v3_14_cell.png')
        await ev('window.__ra.ui.closeSheet()')
        await page.click('#menuBtn')
        await page.wait_for_timeout(300)
        # sound: the audio context started with the first click, the era's music pad plays; the menu switches work
        au = await ev('() => { const A = window.__ra.ui.audio; return [!!A.ctx, !!A.pad, A.era, A.s.sfx, A.s.music]; }')
        await page.click('[data-m="music"]')
        await page.wait_for_timeout(200)
        off = await ev('() => window.__ra.ui.audio.s.music')
        await page.click('[data-m="music"]')
        await page.wait_for_timeout(200)
        check(au[0] and au[1] and au[2] == 'danas' and off is False and await ev('() => window.__ra.ui.audio.s.music'), f'sound starts on the first click, era music, switch in the menu {au}')
        # colour-blind mode from the menu: the palette changes, neighbours differ, off restores the colours
        orig = await ev('() => window.__ra.G.P.filter(p => p).map(p => p.hex).join()')
        await page.click('[data-m="cb"]')
        await page.wait_for_timeout(200)
        cb = await ev('''() => { const G = window.__ra.G, own = G.owner, W = G.map.W; let same = 0, pairs = 0;
            for (let c = 0; c + 1 < G.map.N; c++) { const a = own[c], b = own[c + 1]; if (a && b && a !== b && (c + 1) % W) { pairs++; if (G.P[a].hex === G.P[b].hex) same++; } }
            return { same, pairs, pal: G.P.filter(p => p && p.alive).every(p => RA.CB_PALETTE.includes(p.hex)) }; }''')
        await page.click('[data-m="cb"]')
        await page.wait_for_timeout(200)
        back = await ev('() => window.__ra.G.P.filter(p => p).map(p => p.hex).join()')
        check(cb['pal'] and cb['same'] == 0 and cb['pairs'] > 0 and back == orig, f'colour-blind mode: safe palette, neighbours differ, off restores {cb}')
        await page.click('[data-m="how"]')  # the menu is open again after a switch
        await page.wait_for_timeout(300)
        check(await ev('() => !!document.querySelector("#sheet .howto")'), 'how-to opens from the in-game menu')
        await ev('window.__ra.ui.closeSheet()')
        await ev('''() => { const G = window.__ra.G; G.winner = G.me; G.state = 'over'; G._history(); G.event('over', 'x', G.me.id); }''')
        await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + f'{MODE}_v3_15_end.png')
        # rematch: same settings and country, straight into a new game
        iso0 = await ev('() => { const me = window.__ra.G.me; return me.took ? me.took.iso : null; }')
        g0 = await ev('() => window.__ra.G.gid')
        await page.click('#rematchBtn')
        try:
            await page.wait_for_function(f'window.__ra.G.gid !== {json.dumps(g0)} && window.__ra.G.state === "play"', timeout=30_000)
        except Exception:
            pass
        rm = await ev('() => { const G = window.__ra.G; return [G.state, G.me && G.me.took ? G.me.took.iso : null, document.getElementById("endScreen").hidden]; }')
        check(rm == ['play', iso0, True], f'rematch starts a new game with the same country {rm} (was {iso0})')
        print('\n'.join(errs[:20]) or 'no page errors')
        if errs:
            fails.append('page errors')
        await b.close()
    print('FAILS:', fails if fails else 'none')

asyncio.run(main())
sys.exit(1 if fails else 0)

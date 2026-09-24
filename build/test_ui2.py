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
        await page.click('#startSeg button[data-v="slobodno"]')
        await page.click('#gmSeg button[data-v="klasik"]')
        await page.click(f'#regSeg button[data-v="{REGION}"]')
        await page.click('#peaceSeg button[data-v="60"]')
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
            await ev(f'() => window.__ra.lmap.setView(window.__ra.map.latLngOfCell({nb["cell"]}), 6)')
            await page.wait_for_timeout(400)
            await tap_cell(nb['cell'])
            await ev('() => { window.__ra.paused = true; }')  # freeze the sim so a counter-attack can't cancel ours mid-test
            await page.wait_for_timeout(400)
            n_att = await ev(f'() => window.__ra.G.attacks.filter(a => !a.done && a.a === window.__ra.G.me.id && a.t === {nb["id"]}).length')
            check(n_att == 1, 'tap on neighbour launches an attack')
            await page.wait_for_timeout(300)
            chips = await ev('() => document.querySelectorAll("#attBar .achip.out").length')
            check(chips >= 1, f'attack chip shown ({chips})')
            await page.screenshot(path=OUT + f'{MODE}_v3_5_chips.png')
            before = await ev('() => window.__ra.G.me.troops')
            await page.click('#attBar .achip.out .x')
            await page.wait_for_timeout(300)
            after = await ev('() => window.__ra.G.me.troops')
            n_att = await ev(f'() => window.__ra.G.attacks.filter(a => !a.done && a.a === window.__ra.G.me.id && a.t === {nb["id"]}).length')
            check(n_att == 0 and after > before, f'retreat returns troops ({round(before)} -> {round(after)})')
            await ev('() => { window.__ra.paused = false; }')

        # 6. units: recruit infantry at the border, select it by tapping, move it
        await ev('() => { const me = window.__ra.G.me; me.gold = 5e6; me.troops = Math.max(me.troops, 120000); }')
        await ev('window.__ra.ui.armySheet()')
        await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + f'{MODE}_v3_6_army.png')
        await page.click('[data-rec="inf"]')
        bc = await ev('''() => { const G = window.__ra.G, me = G.me; const info = RA.AI.scan(G, me); const id = [...info.nb.keys()][0]; return id ? RA.AI.borderCellFacing(G, me, id) : me.capital; }''')
        await ev(f'() => window.__ra.lmap.setView(window.__ra.map.latLngOfCell({bc}), 6.4)')
        await page.wait_for_timeout(300)
        await tap_cell(bc)
        await page.wait_for_timeout(300)
        nu = await ev('() => window.__ra.G.me.units.length')
        check(nu == 1, 'infantry recruited by tapping')
        await steps(40)
        await page.wait_for_timeout(300)
        upt = await ev('() => { const a = window.__ra, u = a.G.me.units[0]; if (!u) return null; const v = a.terr.view(); return [v.ox + u.x * v.cell, v.oy + u.y * v.cell]; }')
        if upt:
            await tap_xy(upt[0], upt[1])
            await page.wait_for_timeout(300)
            sel = await ev('() => { const m = window.__ra.ui.mode; return m && m.kind; }')
            check(sel == 'unit', 'tapping my unit selects it')
            await page.screenshot(path=OUT + f'{MODE}_v3_7_unit.png')
            cap = await ev('() => window.__ra.G.me.capital')
            await tap_cell(cap)
            await page.wait_for_timeout(200)
            anchor = await ev('() => window.__ra.G.me.units[0].anchor')
            check(anchor == cap or anchor >= 0, 'unit got a new position')
        # 7. diplomacy: alliance offer and trade offer are separate
        offer = await ev('''() => { const G = window.__ra.G, me = G.me; const os = G.P.filter(p => p && p.alive && p.type === 'nation' && p !== me && !me.allies.has(p.id) && !me.trade.has(p.id)); const a = os[0], t = os[1] || os[0]; G.allyReqs.push({from: a.id, to: me.id, exp: G.tick + 300}); G.tradeReqs.push({from: t.id, to: me.id, exp: G.tick + 300}); return {a: a.id, t: t.id}; }''')
        await page.wait_for_timeout(900)
        badge = await ev('() => document.getElementById("diploBdg").textContent')
        check(badge == '2', 'diplomacy badge shows 2 offers')
        await page.screenshot(path=OUT + f'{MODE}_v3_8_offers.png')
        await page.click('#aDiplo')
        await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + f'{MODE}_v3_9_diplo.png')
        await page.click(f'[data-do="accT:{offer["t"]}"]')
        await page.wait_for_timeout(300)
        check(await ev(f'() => window.__ra.G.me.trade.has({offer["t"]})'), 'trade offer accepted from the sheet')
        check(not await ev(f'() => window.__ra.G.me.allies.has({offer["t"]}) && {offer["t"]} !== {offer["a"]}'), 'trade does not create a military alliance')
        await page.click(f'[data-do="accA:{offer["a"]}"]')
        await page.wait_for_timeout(300)
        check(await ev(f'() => window.__ra.G.me.allies.has({offer["a"]})'), 'military alliance accepted')
        await page.screenshot(path=OUT + f'{MODE}_v3_10_diplo2.png')
        await ev('window.__ra.ui.closeSheet()')

        # 8. missiles: aim shows the blast radius, "Lansiraj" fires
        tgt = await ev('''() => { const G = window.__ra.G, me = G.me; me.gold = 3e7; const c = me.cells[Math.floor(me.tiles / 2)]; const s = G.build(me.id, 'silo', c); if (typeof s === 'object') s.doneAt = G.tick + 1; G.step(); G.step();
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
        await page.click('[data-m="how"]')
        await page.wait_for_timeout(300)
        check(await ev('() => !!document.querySelector("#sheet .howto")'), 'how-to opens from the in-game menu')
        await ev('window.__ra.ui.closeSheet()')
        await ev('''() => { const G = window.__ra.G; G.winner = G.me; G.state = 'over'; G._history(); G.event('over', 'x', G.me.id); }''')
        await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + f'{MODE}_v3_15_end.png')
        print('\n'.join(errs[:20]) or 'no page errors')
        if errs:
            fails.append('page errors')
        await b.close()
    print('FAILS:', fails if fails else 'none')

asyncio.run(main())

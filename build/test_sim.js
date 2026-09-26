/* Simulation rules without a browser (fast): straits and canals.
   node build/test_sim.js */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..') + '/';
global.window = global;
global.Image = class {
  set src(v) {
    setTimeout(() => this.onload && this.onload(), 0);
  }
};
(0, eval)(fs.readFileSync(R + 'build/mapdata.js', 'utf8'));
(0, eval)(fs.readFileSync(R + 'build/eradata.js', 'utf8'));
const files = fs.readdirSync(R + 'src').filter((f) => /^0[0-4].*\.js$/.test(f)).sort();
new Function(files.map((f) => fs.readFileSync(R + 'src/' + f, 'utf8').replace("'use strict';", '')).join('\n'))();

const fails = [];
const check = (ok, msg) => {
  console.log((ok ? 'OK   ' : 'FAIL ') + msg);
  if (!ok) fails.push(msg);
};

(async () => {
  const m = await RA.loadMap();
  m.eras = await RA.loadEras(window.ERADATA, m.N);
  const G = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 7, difficulty: 'srednje', cityStates: 0, peace: 60, era: 'danas', start: 'granice', gm: 'klasik' });
  const iso = (k) => G.P.find((p) => p && p.iso === k);
  const TUR = iso('TUR'), UKR = iso('UKR'), GRC = iso('GRC'), ROU = iso('ROU');
  RA.placeHuman(G, TUR.nation.c, 'Test');
  RA.startGame(G);
  const me = G.me, cell = (lat, lon) => m.cellOfLatLng(lat, lon);
  G.step();
  for (let i = 0; i < 10; i++) G.step();
  const tur = G.straits.find((s) => s.id === 'tur');
  check(G.straits.length >= 6, `Europe has its straits: ${G.straits.map((s) => s.id)}`);
  check(tur && tur.holder === me.id, 'Turkey holds both shores of the Bosporus and the Dardanelles');
  const gib = G.straits.find((s) => s.id === 'gib');
  check(gib && gib.holder === 0, 'nobody holds both shores of Gibraltar (Spain and Morocco)');
  // the Black Sea is part of the world ocean now (the grid had closed the Bosporus)
  const black = cell(43, 34), aegean = cell(38.5, 25);
  check(G.wroot[m.wcomp[black]] === G.wroot[m.wcomp[aegean]], 'the Black Sea and the Aegean are one sea');
  // a Greek landing on the Ukrainian coast needs the Bosporus
  const odessa = cell(46.5, 30.7);
  let tgt = -1;
  for (let d = 0; d < 400 && tgt < 0; d++) for (const c of [odessa + d, odessa - d]) if (tgt < 0 && m.land[c] && m.coast[c] && G.owner[c] === UKR.id) tgt = c;
  const open = G.findBoatPath(GRC.id, tgt);
  check(open && open.path, 'open: Greece can sail to Ukraine through the straits');
  check(G.exec(GRC.id, 'str', [tur.i, 1]) !== null && !tur.closed, 'only the holder may close it');
  const r = G.exec(me.id, 'str', [tur.i, 1]);
  check(r && r.closed && tur.closed === me.id, 'Turkey closes the straits');
  check(G.findBoatPath(GRC.id, tgt) === null || G.findBoatPath(GRC.id, tgt) === 'far', 'closed: no Greek fleet reaches the Black Sea');
  check(G.findBoatPath(ROU.id, tgt) && G.findBoatPath(ROU.id, tgt).path, 'closed: Romania (inside the Black Sea) still sails there');
  check(me.ae >= RA.CFG.AE_STRAIT && GRC.rel[me.id] < 0, `closing is aggression and angers others (ae ${me.ae.toFixed(0)}, Greece ${GRC.rel[me.id].toFixed(0)})`);
  G.makeAlliance(me, GRC);
  check(G.findBoatPath(GRC.id, tgt) && G.findBoatPath(GRC.id, tgt).path, 'an ally of the closer passes');
  G.breakAlliance(me.id, GRC.id, false);
  const rel0 = GRC.rel[me.id];
  for (let i = 0; i < 300; i++) G.step();
  check(GRC.rel[me.id] < rel0 || GRC.rel[me.id] <= -99, 'the longer it stays shut, the angrier the seafarers');
  // lose a shore: the strait opens by itself
  for (const c of tur.a) if (G.owner[c] === me.id) G.setOwner(c, GRC.id);
  for (let i = 0; i < 10; i++) G.step();
  check(!tur.closed && tur.holder !== me.id, 'losing a shore reopens the strait');
  // determinism: the same game twice gives the same state
  const run = () => {
    const H = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 3, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'danas', start: 'granice', gm: 'klasik' });
    RA.placeHuman(H, H.P.find((p) => p && p.iso === 'TUR').nation.c, 'T');
    RA.startGame(H);
    for (let i = 0; i < 600; i++) {
      if (i === 50) H.exec(H.me.id, 'str', [0, 1]);
      H.step();
    }
    return H.hash();
  };
  check(run() === run(), 'straits keep the game deterministic');

  // the world: its grid had closed Gibraltar (the Mediterranean was a lake); canals exist from the era they were dug
  const w = await RA.loadMap(JSON.parse(fs.readFileSync(R + 'build/svijet/map.json', 'utf8')));
  const E = {};
  for (const f of fs.readdirSync(R + 'build/svijet')) if (/^era_(rim|danas)\.json$/.test(f)) E[f.slice(4, -5)] = JSON.parse(fs.readFileSync(R + 'build/svijet/' + f, 'utf8'));
  w.eras = await RA.loadEras(E, w.N);
  const WG = RA.newGame(RA.eraMap(w, 'danas', 'granice'), { seed: 5, difficulty: 'srednje', cityStates: 0, peace: 60, era: 'danas', start: 'granice', gm: 'klasik' });
  const sea = (la, lo) => WG.wroot[w.wcomp[w.cellOfLatLng(la, lo)]];
  check(sea(37, 3) === sea(36, -9) && sea(43, 34) === sea(36, -9) && sea(46, 36.5) === sea(36, -9), 'world: the Mediterranean, the Black Sea and Azov reach the ocean');
  const ids = WG.straits.map((s) => s.id);
  check(['gib', 'tur', 'sue', 'pan', 'mal', 'hor', 'bab'].every((k) => ids.includes(k)), `world straits today: ${ids}`);
  const RG = RA.newGame(RA.eraMap(w, 'rim', 'granice'), { seed: 5, difficulty: 'srednje', cityStates: 0, peace: 60, era: 'rim', start: 'granice', gm: 'klasik' });
  const rids = RG.straits.map((s) => s.id);
  check(!rids.includes('sue') && !rids.includes('pan') && rids.includes('gib'), `no canals in Rome's time: ${rids}`);
  const EG = RA.newGame(RA.eraMap(w, 'danas', 'granice'), { seed: 5, difficulty: 'srednje', cityStates: 0, peace: 60, era: 'danas', start: 'granice', gm: 'klasik' });
  EG._stepStraits();
  const sue = EG.straits.find((s) => s.id === 'sue'), egy = EG.P[sue.holder];
  check(egy && egy.iso === 'EGY', `Egypt holds the Suez canal (${egy && egy.name})`);

  // resources (option): everyone has at least one kind, nobody all three; buying from a partner; missing costs more
  const RG2 = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 11, difficulty: 'srednje', cityStates: 0, peace: 60, era: 'danas', start: 'granice', gm: 'klasik', res: true });
  RA.placeHuman(RG2, RG2.P.find((p) => p && p.iso === 'SRB').nation.c, 'Test');
  RA.startGame(RG2);
  const nats = RG2.P.filter((p) => p && p.alive && p.type !== 'bot');
  const kinds = (p) => p.res.filter((n) => n > 0).length;
  check(RG2.deps.length > 40 && nats.every((p) => kinds(p) >= 1 && kinds(p) <= 2), `resources: every state has 1–2 kinds (${RG2.deps.length} deposits)`);
  const noRes = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 11, difficulty: 'srednje', cityStates: 0, peace: 60, era: 'danas', start: 'granice', gm: 'klasik' });
  check(!noRes.deps && noRes.hasRes(noRes.P.find((p) => p && p.type === 'nation'), 2), 'resources off: no deposits, nothing is missing');
  const sr = RG2.me, miss = [0, 1, 2].find((k) => !sr.res[k]);
  const seller = RG2.P.find((p) => p && p.alive && p !== sr && p.type === 'nation' && p.res[miss] > 0);
  check(typeof RG2.exec(sr.id, 'buy', [miss, seller.id]) === 'string', 'buying needs a trade agreement');
  RG2.makeTrade(sr, seller);
  const unitBefore = RG2.unitCost(sr, 'inf'), structBefore = RG2.structCost(sr, 'fort');
  const rb = RG2.exec(sr.id, 'buy', [miss, seller.id]);
  check(rb && rb.sid === seller.id && RG2.hasRes(sr, miss), `bought ${RA.resKind(miss, 'danas').name} from ${seller.name}`);
  if (miss === 1) check(RG2.unitCost(sr, 'inf') < unitBefore, 'with metal units are cheaper');
  if (miss === 2) check(RG2.structCost(sr, 'fort') < structBefore, 'with fuel buildings are cheaper');
  const g0 = seller.gold;
  for (let i = 0; i < 100; i++) RG2.step();
  check(seller.gold > g0 && sr.resFee > 0, `the seller earns (${Math.round(sr.resFee)}/s from ${sr.name})`);
  RG2.cancelTrade(sr.id, seller.id);
  for (let i = 0; i < 25; i++) RG2.step();
  check(!sr.imp[miss], 'ending the trade agreement ends the purchase');
  const bought = RG2.P.filter((p) => p && p.alive && p.ai && p.imp && p.imp.some((x) => x)).length;
  for (let i = 0; i < 1200; i++) RG2.step();
  const bought2 = RG2.P.filter((p) => p && p.alive && p.ai && p.imp && p.imp.some((x) => x)).length;
  check(bought2 > 0, `the computer buys what it lacks from partners (${bought} → ${bought2} states)`);
  const runR = () => {
    const H = RA.newGame(RA.eraMap(m, 'ww1', 'granice'), { seed: 4, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'ww1', start: 'granice', gm: 'klasik', res: true });
    RA.placeHuman(H, H.P.find((p) => p && p.type === 'nation').nation.c, 'T');
    RA.startGame(H);
    for (let i = 0; i < 900; i++) H.step();
    return H.hash();
  };
  check(runR() === runR(), 'resources keep the game deterministic');

  // stronger nukes + the iron dome (plan 37, 50)
  const NG = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 21, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'danas', start: 'granice', gm: 'klasik' });
  const FRA = NG.P.find((p) => p && p.iso === 'FRA'), DEU = NG.P.find((p) => p && p.iso === 'DEU');
  RA.placeHuman(NG, FRA.nation.c, 'Test');
  RA.startGame(NG);
  const A = NG.me, V = DEU;
  const spot = (p) => { for (let i = 0; i < p.tiles; i++) { const c = p.cells[(i * 7919) % p.tiles]; if (typeof NG.canBuild(p, 'silo', c) === 'number') return c; } return -1; };
  A.gold = V.gold = 5e7;
  NG.build(A.id, 'silo', spot(A));
  const dc = (() => { for (let i = 0; i < V.tiles; i++) { const c = V.cells[(i * 7919) % V.tiles]; if (typeof NG.canBuild(V, 'dome', c) === 'number') return c; } return -1; })();
  const ds = NG.build(V.id, 'dome', dc);
  check(ds && ds.type === 'dome', 'Germany builds an iron dome');
  for (let i = 0; i < 100; i++) NG.step();
  for (const s of NG.structs) if (s.type === 'sam') s.dead = true; // no air defence in the way
  const at0 = A.troops, vt0 = V.troops, capC = NG.cities.find((ct) => ct.owner === V.id && ct.tier >= 2);
  const tier0 = capC ? capC.tier : -1;
  const before = NG.missiles.length;
  const mm = NG.exec(A.id, 'mis', ['atom', capC ? capC.c : V.capital]);
  const auto = NG.missiles.filter((x) => x.auto && x.owner === V.id);
  check(mm && typeof mm === 'object' && auto.length === 1 && auto[0].c === A.capital, `the dome answers at once: an atomic bomb flies at ${A.name}'s capital`);
  for (let i = 0; i < 200 && NG.missiles.some((x) => !x.done); i++) NG.step();
  check(V.troops < vt0 * 0.8 && V.crisisUntil > NG.tick, `a nuke hurts more: −${Math.round((1 - V.troops / vt0) * 100)}% army and an economic crisis`);
  if (capC) check(capC.tier < tier0, `a city in the core drops a level (${capC.name} ${tier0} → ${capC.tier})`);
  check(A.troops < at0 * 0.85 && A.crisisUntil > 0, `the retaliation lands on the attacker (−${Math.round((1 - A.troops / at0) * 100)}% army)`);
  // nuclear spam (plan 22): each launch within NUKE_COOL makes the next one dearer; later the price is normal again
  const base = RA.MISSILE.atom.cost, c1 = NG.missileCost('atom', A);
  check(Math.abs(c1 - base * (1 + RA.CFG.NUKE_UP)) < 2 && A.nukeUntil > NG.tick, `after a nuclear launch the next atomic bomb costs more (${base} → ${c1})`);
  const V2 = V.alive ? V : NG.P.find((p) => p && p.alive && p !== A && p.type === 'nation');
  for (const s of NG.structs) if (s.owner === A.id && s.type === 'silo') s.cd = 0;
  NG.exec(A.id, 'mis', ['atom', V2.cells[0]]);
  check(A.nukeN === 2 && Math.abs(NG.missileCost('atom', A) - base * (1 + 2 * RA.CFG.NUKE_UP)) < 2, `a second one right after: ×${NG.nukeMul(A).toFixed(1)}`);
  while (NG.tick < A.nukeUntil) NG.step();
  check(NG.missileCost('atom', A) === base, 'the price is normal again after the cool-down');

  // the navy (plan 20): a warship from a port blockades an enemy port and sinks its landing boats
  const SG = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 31, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'danas', start: 'granice', gm: 'klasik' });
  const ITA = SG.P.find((p) => p && p.iso === 'ITA'), ALB = SG.P.find((p) => p && p.iso === 'ALB');
  RA.placeHuman(SG, ITA.nation.c, 'Test');
  RA.startGame(SG);
  const I = SG.me;
  I.gold = ALB.gold = 5e7;
  I.troops = Math.max(I.troops, 400000);
  const portAt = (p, pred) => { for (let i = 0; i < p.tiles; i++) { const c = p.cells[(i * 104729) % p.tiles]; if (m.coast[c] && (!pred || pred(c)) && typeof SG.canBuild(p, 'port', c) === 'number') return c; } return -1; };
  const W = m.W;
  SG.build(I.id, 'port', portAt(I, (c) => c % W > 250)); // the Adriatic side
  const ap = SG.build(ALB.id, 'port', portAt(ALB));
  for (let i = 0; i < 60; i++) SG.step();
  const shr = SG.exec(I.id, 'rec', ['ship', I.capital]);
  const ship = I.units.find((u) => u.type === 'ship');
  check(shr && ship && !m.land[(ship.y | 0) * W + (ship.x | 0)], `a warship is launched at sea (${RA.UNIT.ship.name})`);
  check(SG.exec(I.id, 'mv', [ship.id, I.capital]) !== true, 'a ship cannot be sent onto land');
  const aw = SG._portWater(ap);
  check(SG.exec(I.id, 'mv', [ship.id, aw]) === true, 'sent to the Albanian port');
  for (let i = 0; i < 900 && (ship.path || SG.tick < 100); i++) SG.step();
  for (let i = 0; i < 20; i++) SG.step();
  check(ap.blocked === I.id && ALB.portsOff >= 1, `the Albanian port is blockaded (ship ${RA.dist(ship.x - ap.x, ship.y - ap.y).toFixed(1)} cells away)`);
  // an Albanian landing near the ship is sunk
  const boatsBefore = ALB.boats;
  let tgt2 = -1;
  for (let i = 0; i < I.tiles && tgt2 < 0; i++) { const c = I.cells[i]; if (m.coast[c] && RA.dist((c % W) - ship.x, ((c / W) | 0) - ship.y) < 12) tgt2 = c; }
  const lb = tgt2 >= 0 ? SG.launchBoat(ALB.id, tgt2, 20000) : null;
  for (let i = 0; i < 60; i++) SG.step();
  check(lb && typeof lb === 'object' && lb.done, 'the warship sinks an enemy landing in range');
  // a submarine is unseen until a warship comes near
  const sub = { dead: false, type: 'sub', owner: ALB.id, x: ship.x + 20, y: ship.y };
  check(!SG.subSeen(sub, I.id), 'a far submarine is hidden');
  sub.x = ship.x + 3;
  check(SG.subSeen(sub, I.id), 'a near submarine is seen');

  // the air force and drones (plan 21, 22)
  const AG = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 41, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'danas', start: 'granice', gm: 'klasik' });
  RA.applyEra('danas');
  const POL = AG.P.find((p) => p && p.iso === 'POL'), BLR = AG.P.find((p) => p && p.iso === 'BLR');
  RA.placeHuman(AG, POL.nation.c, 'Test');
  RA.startGame(AG);
  for (const p of AG.P) if (p) p.ai = null; // no computer wars: only what the test does
  const Pm = AG.me;
  Pm.gold = BLR.gold = 5e7;
  const site = (p, t) => { for (let i = 0; i < p.tiles; i++) { const c = p.cells[(i * 7919) % p.tiles]; if (typeof AG.canBuild(p, t, c) === 'number') return c; } return -1; };
  const pap0 = AG.build(Pm.id, 'airport', site(Pm, 'airport'));
  // the Belarusian airport as close to the Polish one as it can be
  const near3 = BLR.cells.slice(0, BLR.tiles).filter((c) => typeof AG.canBuild(BLR, 'airport', c) === 'number').sort((a, b) => RA.dist((a % W) - pap0.x, ((a / W) | 0) - pap0.y) - RA.dist((b % W) - pap0.x, ((b / W) | 0) - pap0.y));
  const bap = AG.build(BLR.id, 'airport', near3[0]);
  for (let i = 0; i < 80; i++) AG.step();
  for (const st of AG.structs) if (st.type === 'sam') st.dead = true;
  check(AG.exec(Pm.id, 'air', ['bomber']).type === 'bomber' && AG.exec(Pm.id, 'air', ['fighter']).type === 'fighter', 'bomber and fighter squadrons bought at the airport');
  check(typeof AG.exec(Pm.id, 'bomb', [BLR.capital]) === 'string', 'a new squadron is not ready yet');
  for (let i = 0; i < RA.CFG.AIR_READY + 5; i++) AG.step();
  // a raid on a Belarusian cell near the border (no fighters there)
  const pap = AG.structs.find((x) => x.type === 'airport' && x.owner === Pm.id);
  let tgt3 = -1, td = 1e9;
  for (let i = 0; i < BLR.tiles; i++) { const c = BLR.cells[i], d = RA.dist((c % W) - pap.x, ((c / W) | 0) - pap.y); if (d < td && RA.dist((c % W) - bap.x, ((c / W) | 0) - bap.y) > RA.CFG.FIGHT_R + 2) { td = d; tgt3 = c; } }
  BLR.growPause = AG.tick + 2000; // its army doesn't grow meanwhile: only the raid changes it
  BLR.troops = Math.min(BLR.troops, BLR.maxT);
  const bt0 = BLR.troops;
  const br = AG.exec(Pm.id, 'bomb', [tgt3]);
  check(br && typeof br === 'object', `the bombers take off (${typeof br === 'string' ? br : 'ok'})`);
  for (let i = 0; i < 80; i++) AG.step();
  check(BLR.troops < bt0 && !AG.planes.some((x) => !x.done && x.kind === 'bomb'), `the raid hits the army (−${RA.fmt(bt0 - BLR.troops)})`);
  // fighters guard the sky around their airport
  AG.exec(BLR.id, 'air', ['fighter']);
  for (let i = 0; i < RA.CFG.AIR_READY + 5; i++) AG.step();
  Pm.air.find((q) => q.type === 'bomber').readyAt = 0;
  Pm.air.find((q) => q.type === 'fighter').readyAt = 1e9; // no escort this time
  const hit0 = RA.CFG.FIGHT_HIT;
  RA.CFG.FIGHT_HIT = 1;
  const nearAp = BLR.cells.find((c) => RA.dist((c % W) - bap.x, ((c / W) | 0) - bap.y) < 4);
  const br2 = AG.bombRaid(Pm.id, nearAp);
  for (let i = 0; i < 200; i++) AG.step();
  RA.CFG.FIGHT_HIT = hit0;
  check(typeof br2 === 'object' && !Pm.air.some((q) => q.type === 'bomber'), `enemy fighters shoot the bombers down over their airport (${typeof br2 === 'string' ? br2 : 'flew'}, airports ${RA.dist(pap.x - bap.x, pap.y - bap.y).toFixed(0)} apart)`);
  // drones: from your border, a few at a time
  const d1 = AG.exec(Pm.id, 'mis', ['drone', tgt3]);
  check(d1 && typeof d1 === 'object' && d1.kind === 'drone' && AG.owner[(d1.sy | 0) * W + (d1.sx | 0)] === Pm.id, 'a kamikaze drone starts from your own land');
  check(typeof AG.exec(Pm.id, 'mis', ['drone', BLR.cells[BLR.tiles - 1]]) === 'string' || RA.dist((BLR.cells[BLR.tiles - 1] % W) - (tgt3 % W), 0) < 40, 'drones have a range');
  for (let i = 0; i < 5; i++) AG.exec(Pm.id, 'mis', ['drone', tgt3]);
  check(typeof AG.exec(Pm.id, 'mis', ['drone', tgt3]) === 'string', `at most ${RA.CFG.DRONE_MAX} drones in the air`);
  for (let i = 0; i < 80; i++) AG.step();
  check(!Pm.drones, 'drones land and free their slots');

  // DEFCON mode (plan 48): stages on a clock, the clock's end decides by cities and people
  const DG = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 51, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'danas', start: 'granice', gm: 'defcon' });
  RA.applyEra('danas');
  RA.placeHuman(DG, DG.P.find((p) => p && p.iso === 'FRA').nation.c, 'Test');
  RA.startGame(DG);
  const D = DG.me, DE = DG.P.find((p) => p && p.iso === 'DEU');
  D.gold = 5e7;
  const deC = DE.cells[0];
  const stage = [];
  for (const [t, lvl] of [[10, 5], [1810, 4], [3610, 3], [5410, 2], [7210, 1]]) {
    while (DG.tick < t && DG.state === 'play') DG.step();
    stage.push(DG.defcon() === lvl);
  }
  check(stage.every(Boolean), `DEFCON 5 → 1 every 3 minutes (${stage})`);
  const DG2 = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 52, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'danas', start: 'granice', gm: 'defcon' });
  RA.placeHuman(DG2, DG2.P.find((p) => p && p.iso === 'FRA').nation.c, 'Test');
  RA.startGame(DG2);
  DG2.me.gold = 5e7;
  const tgtD = DG2.P.find((p) => p && p.iso === 'DEU').cells[0];
  check(/DEFCON 5/.test(DG2.defconErr('land')) && /DEFCON 5/.test(DG2.exec(DG2.me.id, 'mis', ['rocket', tgtD])) && /DEFCON/.test(DG2.boatErr(DG2.launchBoat(DG2.me.id, tgtD, 1000))), 'at DEFCON 5 no attacks, strikes or landings');
  while (DG2.tick < 5410) DG2.step();
  check(!DG2.defconErr('conv') && /DEFCON 2/.test(DG2.defconErr('nuke')), 'DEFCON 2: rockets yes, nukes not yet');
  while (DG2.state === 'play' && DG2.tick < RA.CFG.DEFCON_END + 20) DG2.step();
  check(DG2.state === 'over' && DG2.winner && DG2.tick <= RA.CFG.DEFCON_END + 20, `the clock ends it: ${DG2.winner && DG2.winner.name} (${DG2.winner && DG2.defconScore(DG2.winner)} points)`);
  // the tech tree (opts.tree) and the "no nukes" rule (Make your choice)
  const TG = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 61, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'danas', start: 'granice', gm: 'klasik', tree: true, noNuke: true });
  RA.placeHuman(TG, TG.P.find((p) => p && p.iso === 'FRA').nation.c, 'Test');
  RA.startGame(TG);
  const T = TG.me, DEt = TG.P.find((p) => p && p.iso === 'DEU');
  T.gold = 1e7;
  const relT = DEt.rel[T.id], goldT = T.gold;
  const r1 = TG.exec(T.id, 'tech', ['eco']), r2 = TG.exec(T.id, 'tech', ['eco']), r3 = TG.exec(T.id, 'tech', ['dip']), r4 = TG.exec(T.id, 'tech', ['sci']);
  check(r1.lv === 1 && r2.lv === 2 && T.tech.eco === 2 && Math.abs(T.bGold - 1.16) < 1e-9 && Math.abs(T.bCost - 0.94) < 1e-9, `tech: economy 2 = +16% gold, science 1 = 6% cheaper (${T.bGold}, ${T.bCost})`);
  check(goldT - T.gold === 200000 + 400000 + 200000 + 200000 && DEt.rel[T.id] >= Math.min(100, relT + 9.9), 'tech: levels cost 200k, 400k …; diplomacy warms the others');
  for (let i = 0; i < 5; i++) TG.exec(T.id, 'tech', ['mil']);
  check(/najvišem/.test(TG.exec(T.id, 'tech', ['mil'])) && /Nepoznata/.test(TG.exec(T.id, 'tech', ['xyz'])), 'tech: five levels at most, unknown branches refused');
  TG.me.gold = 0;
  check(/treba/.test(TG.exec(T.id, 'tech', ['eco'])), 'tech: not without gold');
  const noTree = RA.newGame(RA.eraMap(m, 'danas', 'granice'), { seed: 61, difficulty: 'srednje', cityStates: 0, peace: 0, era: 'danas', start: 'granice', gm: 'klasik' });
  RA.placeHuman(noTree, noTree.P.find((p) => p && p.iso === 'FRA').nation.c, 'Test');
  RA.startGame(noTree);
  noTree.me.gold = 1e7;
  check(/nije uključeno/.test(noTree.exec(noTree.me.id, 'tech', ['eco'])), 'no tech tree in a Blitz game');
  T.gold = 5e7;
  check(/isključeno/.test(TG.launchMissile(T.id, 'atom', DEt.cells[0])), 'no nukes: an atomic bomb is refused');
  for (let i = 0; i < 3000; i++) TG.step();
  const aiTech = TG.P.filter((p) => p && p.alive && !p.human && p.tech).length;
  check(aiTech > 0 && TG.P.every((p) => !p || !p.stats || !p.stats.nukes), `the computer researches too (${aiTech} states), and nobody nukes`);
  // the server steps many Focus games in one process (deploy/game/simhost.js), switching the era tables between them:
  // a game stepped between steps of another era's game must stay the same as the game alone
  const rec = (code, era, seed) => ({ code, seed, set: { map: 'evropa', reg: 'balkan', era, gm: 'klasik', dif: 'srednje', cs: 0, peace: 0, res: 1, tree: 1, nn: 0 } });
  RA.applyEra('rim');
  const A1 = RA.longGame(m, rec('aaaaaa', 'rim', 9));
  RA.applyEra('ww1');
  const B1 = RA.longGame(m, rec('bbbbbb', 'ww1', 4));
  for (let i = 0; i < 400; i++) {
    RA.applyEra('rim');
    A1.step();
    RA.applyEra('ww1');
    B1.step();
  }
  RA.applyEra('rim');
  const A2 = RA.longGame(m, rec('aaaaaa', 'rim', 9));
  for (let i = 0; i < 400; i++) A2.step();
  check(A1.hash() === A2.hash() && A1.tick === A2.tick, `a Focus game on the server: interleaved with another era = alone (${A1.hash()} / ${A2.hash()})`);
  console.log('FAILS:', fails.length ? fails : 'none');
  process.exit(fails.length ? 1 : 0);
})();

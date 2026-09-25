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
  console.log('FAILS:', fails.length ? fails : 'none');
  process.exit(fails.length ? 1 : 0);
})();

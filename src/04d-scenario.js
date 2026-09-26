'use strict';
/* Community market scenarios (plan phase 19). A scenario is a change of an era's real borders, made in the editor
   (src/09i-editor.js) and kept on the account (deploy/api/market.js):
   {v: 1, title, desc, map, reg, era, k0, paint: [[cell, len, k], …], nat: {k: {n, c}}, add: [{n, c, cap}], slots: [k],
    rules: {peace, res, tree, nn}}
   - paint: runs of cells that belong to polity k (0 = free land) instead of the era's owner;
   - nat: a new name (n) or colour (c) for an era polity; add: new states, polity k = k0 + 1 + index, capital cell cap;
   - k0: the era's polity count when it was made (if the era data grows, new states keep their own keys);
   - slots: the states a player may take (empty = any).
   RA.scenMap(eraMap, S) is the era map with the scenario applied; the game is then built as a borders game, the same
   on every device. */
RA.SCEN_MAX_ADD = 40;

RA.scenMap = function (em, S) {
  const W = em.W, N = em.N;
  const m = Object.create(em);
  m.scen = true;
  const K0 = em.nations.length, shift = K0 - (S.k0 | 0); // era data with more polities than when it was made
  const key = (k) => (k > (S.k0 | 0) ? k + shift : k);
  const own = new em.eraOwn.constructor(em.eraOwn);
  for (const r of Array.isArray(S.paint) ? S.paint : []) {
    const [s, len, k] = r;
    if (!Number.isInteger(s) || !Number.isInteger(len) || !Number.isInteger(k) || s < 0 || len < 1 || k < 0 || k > 255) continue;
    const kk = key(k);
    for (let c = s; c < Math.min(N, s + len); c++) if (em.land[c]) own[c] = kk;
  }
  m.eraOwn = own;
  const nat = S.nat && typeof S.nat === 'object' ? S.nat : {};
  const col = (c, d) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : d);
  const nm = (n, d) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 30) : d);
  const nations = em.nations.map((n) => {
    const o = nat[n.k];
    return o ? Object.assign({}, n, { name: nm(o.n, n.name), color: col(o.c, n.color) }) : n;
  });
  (Array.isArray(S.add) ? S.add : []).slice(0, RA.SCEN_MAX_ADD).forEach((a, i) => {
    const k = K0 + 1 + i;
    if (k > 255 || !a) return;
    const c = Number.isInteger(a.cap) && a.cap >= 0 && a.cap < N ? a.cap : 0;
    const ct = em.cityAt[c] >= 0 ? em.cities[em.cityAt[c]] : null;
    nations.push({ iso: 'S' + (i + 1), name: nm(a.n, 'Nova država ' + (i + 1)), color: col(a.c, '#888888'), x: c % W, y: (c / W) | 0, c, capital: ct ? ct.name : nm(a.n, ''), k });
  });
  // every state keeps a capital on its own land (its biggest city there, else any of its cells); states without land go
  const cnt = new Int32Array(256), any = new Int32Array(256).fill(-1);
  for (let c = 0; c < N; c++) {
    const k = own[c];
    if (!k || !em.land[c]) continue;
    cnt[k]++;
    if (any[k] < 0) any[k] = c;
  }
  const best = new Map();
  for (const ct of em.cities) {
    const k = own[ct.c];
    if (!k) continue;
    const b = best.get(k);
    if (!b || ct.tier > b.tier || (ct.tier === b.tier && ct.pop > b.pop)) best.set(k, ct);
  }
  m.nations = nations.filter((n) => cnt[n.k] > 0).map((n) => {
    if (own[n.c] === n.k) return n;
    const ct = best.get(n.k), c = ct ? ct.c : any[n.k];
    return Object.assign({}, n, { c, x: c % W, y: (c / W) | 0, capital: ct ? ct.name : n.capital });
  });
  m.scenSlots = (Array.isArray(S.slots) ? S.slots : []).filter(Number.isInteger).map(key);
  return m;
};

/* the scenario of a game: the era map, the scenario, the region */
RA.scenGameMap = function (base, S) {
  return RA.regionMap(RA.scenMap(RA.eraMap(base, S.era, 'granice'), S), S.reg);
};

/* the scenario from an edited game (the editor's G on the scenario's map): what differs from the era's borders */
RA.scenDiff = function (G, em, meta) {
  const map = G.map, N = map.N, own = em.eraOwn, K0 = em.nations.length;
  const kOf = (pid) => (pid && G.P[pid] && G.P[pid].nation ? G.P[pid].nation.k : 0);
  const paint = [];
  let run = null;
  for (let c = 0; c < N; c++) {
    let k = -1;
    if (map.land[c] && !(map.block && map.block[c])) {
      const kn = kOf(G.owner[c]);
      if (kn !== own[c]) k = kn;
    }
    if (k >= 0 && run && run[2] === k && run[0] + run[1] === c) run[1]++;
    else if (k >= 0) paint.push((run = [c, 1, k]));
    else run = null;
  }
  const nat = {}, add = [];
  const base = new Map(em.nations.map((n) => [n.k, n]));
  for (const p of G.P) {
    if (!p || !p.nation) continue;
    const k = p.nation.k;
    if (k > K0) add[k - K0 - 1] = { n: p.name, c: p.hex, cap: p.nation.c };
    else {
      const n = base.get(k);
      if (!n) continue;
      const o = {};
      if (p.name !== n.name) o.n = p.name;
      if (p.hex.toLowerCase() !== String(n.color).toLowerCase()) o.c = p.hex;
      if (o.n || o.c) nat[k] = o;
    }
  }
  for (let i = 0; i < add.length; i++) if (!add[i]) add[i] = { n: 'Nova država ' + (i + 1), c: '#888888', cap: 0 };
  return Object.assign({ v: 1, k0: K0, paint, nat, add }, meta);
};

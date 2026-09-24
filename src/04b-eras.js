'use strict';
/* Ratni Atlas — historical eras. Each era has its own borders (build/eras.py), city names, units, buildings and
   strike weapons. RA.applyEra() swaps the global unit/building/weapon tables (one game runs at a time, and in an
   online game every device applies the same era). */

RA.MISSILE.rocket2 = { name: 'Teška raketa', kind: 'conv', cost: 300000, r: 4, speed: 3.0, cd: 70, na: true, desc: '' };
RA.MISSILE_ORDER = ['rocket', 'rocket2', 'emp', 'atom', 'hydro', 'mirv'];
RA.UNIT.inf.needs = null;
RA.UNIT.tank.needs = 'factory';
RA.UNIT.art.needs = 'factory';
RA.UNIT.tank.pl = true;
RA.UNIT.tank.sym = 'tank';
RA.UNIT.inf.sym = 'inf';
RA.UNIT.art.sym = 'art';

(function () {
  const copy = (o) => {
    const r = {};
    for (const k in o) r[k] = Object.assign({}, o[k]);
    return r;
  };
  RA.BASE = { UNIT: copy(RA.UNIT), STRUCT: copy(RA.STRUCT), MISSILE: copy(RA.MISSILE), STRUCT_ORDER: RA.STRUCT_ORDER.slice(), CFG: Object.assign({}, RA.CFG) };
})();

RA.ERAS = [
  {
    id: 'rim', name: 'Antički Rim', sub: '100. godina', short: 'Rim',
    blurb: 'Rimsko carstvo protiv germanskih, sarmatskih i keltskih plemena. Legije, konjica, strijelci i opsadne sprave — bez baruta, aviona i bombi.',
    strikeTab: 'Opsada', strikeIcon: 'siege', road: true, para: false,
    units: {
      inf: { name: 'Legija', desc: 'Čvrsta odbrana granice u krugu od 6 polja.' },
      tank: { name: 'Konjica', pl: false, sym: 'cav', needs: 'barracks', desc: 'Brzi proboj: tvoji napadi pored konjice su jeftiniji i brži.' },
      art: { name: 'Strijelci', pl: true, needs: null, range: 8, desc: 'Gađaju neprijateljske jedinice i vojsku do 8 polja. Drže se iza linije.' },
    },
    structs: {
      factory: { name: 'Tržnica', short: 'Tržnica', icon: 'market', cost: (n) => Math.min(1.5e6, 150000 * RA.dpow(2, n)), desc: 'Karavani do tvojih gradova (18 polja) donose zlato.' },
      barracks: { name: 'Vojni logor', short: 'Logor', desc: '+160k kapaciteta vojske i +2 mjesta za jedinice. Potreban za konjicu.' },
      fort: { name: 'Kastrum', short: 'Kastrum', desc: 'Utvrđeni logor: napadači u krugu od 8 polja gube 3× više vojske i sporiji su.' },
      silo: { name: 'Opsadna radionica', short: 'Opsada', icon: 'siege', cost: () => 180000, time: 45, desc: 'Gradi onagre: kamenje na neprijatelja do 16 polja daleko.' },
      sam: false, airport: false,
    },
    missiles: {
      rocket: { name: 'Onager', icon: 'siege', r: 2, range: 16, cost: 45000, speed: 1.2, cd: 50, desc: 'Kamenje do 16 polja od radionice: ruši zgrade, ranjava jedinice i vojsku.' },
      rocket2: false, emp: false, atom: false, hydro: false, mirv: false,
    },
  },
  {
    id: 'srednji', name: 'Srednji vijek', sub: '1400. godina', short: 'Srednji vijek',
    blurb: 'Kraljevina Bosna, Srpska despotovina, Ugarska, Venecija, Osmanlije, Sveto Rimsko Carstvo… Vitezovi, strijelci, trebušei i prve bombarde.',
    strikeTab: 'Opsada', strikeIcon: 'siege', road: true, para: false,
    units: {
      inf: { name: 'Pješaci', pl: true, desc: 'Kopljanici čvrsto drže granicu u krugu od 6 polja.' },
      tank: { name: 'Vitezovi', pl: true, sym: 'cav', needs: 'barracks', desc: 'Oklopna konjica: tvoji napadi pored vitezova su jeftiniji i brži.' },
      art: { name: 'Strijelci', pl: true, needs: null, range: 9, desc: 'Samostreličari gađaju jedinice i vojsku do 9 polja.' },
    },
    structs: {
      factory: { name: 'Tržnica', short: 'Tržnica', icon: 'market', cost: (n) => Math.min(1.5e6, 150000 * RA.dpow(2, n)), desc: 'Karavani do tvojih gradova (18 polja) donose zlato.' },
      barracks: { name: 'Kasarna', desc: '+160k kapaciteta vojske i +2 mjesta za jedinice. Potrebna za vitezove.' },
      fort: { name: 'Tvrđava', short: 'Tvrđava', desc: 'Zamak: napadači u krugu od 8 polja gube 3× više vojske i sporiji su.' },
      silo: { name: 'Opsadna radionica', short: 'Opsada', icon: 'siege', cost: () => 220000, time: 50, desc: 'Trebušei i bombarde: udari na neprijatelja do 24 polja daleko.' },
      sam: false, airport: false,
    },
    missiles: {
      rocket: { name: 'Trebušet', icon: 'siege', r: 2, range: 18, cost: 50000, speed: 1.3, cd: 50, desc: 'Teško kamenje do 18 polja: ruši zgrade, ranjava jedinice i vojsku.' },
      rocket2: { name: 'Bombarda', icon: 'siege', na: false, r: 3, range: 24, cost: 140000, speed: 1.8, cd: 70, desc: 'Prvi topovi: jači udar (krug 3 polja) do 24 polja daleko.' },
      emp: false, atom: false, hydro: false, mirv: false,
    },
  },
  {
    id: 'napoleon', name: 'Napoleonovo doba', sub: '1815. godina', short: 'Napoleon',
    blurb: 'Carstva i kraljevine poslije Napoleona, desetine njemačkih i italijanskih država. Mušketari, konjica, topovi i Kongreveove rakete.',
    strikeTab: 'Rakete', strikeIcon: 'rocket', road: true, para: false,
    units: {
      inf: { name: 'Pješadija', desc: 'Mušketari čvrsto drže granicu u krugu od 6 polja.' },
      tank: { name: 'Konjica', pl: false, sym: 'cav', needs: 'barracks', desc: 'Husari i kirasiri: tvoji napadi pored konjice su jeftiniji i brži.' },
      art: { name: 'Topovi', pl: true, needs: 'factory', range: 12, desc: 'Gađaju neprijateljske jedinice i vojsku do 12 polja. Traže manufakturu.' },
    },
    structs: {
      factory: { name: 'Manufaktura', short: 'Manufaktura', desc: 'Kočije do tvojih gradova (18 polja) donose zlato. Potrebna za topove.' },
      barracks: { desc: '+160k kapaciteta vojske i +2 mjesta za jedinice. Potrebna za konjicu.' },
      silo: { name: 'Raketna baterija', short: 'Baterija', cost: () => 350000, time: 60, desc: 'Kongreveove rakete: udar do 40 polja daleko.' },
      sam: false, airport: false,
    },
    missiles: {
      rocket: { name: 'Kongreveova raketa', r: 3, range: 40, cost: 80000, speed: 2.4, cd: 45, desc: 'Neprecizna ali strašna: udar u krugu 3 polja, do 40 polja od baterije.' },
      rocket2: false, emp: false, atom: false, hydro: false, mirv: false,
    },
  },
  {
    id: 'ww1', name: 'Prvi svjetski rat', sub: '1914. godina', short: '1914.',
    blurb: 'Antanta protiv Centralnih sila: Austro-Ugarska, Njemačko i Rusko carstvo, Srbija, Osmanlije… Rovovi, teška artiljerija, prvi tenkovi i cepelini.',
    strikeTab: 'Udari', strikeIcon: 'zeppelin', road: false, para: false,
    units: {
      tank: { name: 'Tenkovi', desc: 'Prvi tenkovi (od 1916.): tvoji napadi pored njih su jeftiniji i brži. Traže fabriku.' },
      art: { desc: 'Teška artiljerija gađa jedinice i vojsku do 12 polja. Traži fabriku.' },
    },
    structs: {
      fort: { name: 'Rovovi i utvrde', short: 'Rovovi' },
      silo: { name: 'Hangar za cepeline', short: 'Hangar', icon: 'hangar', cost: () => 500000, time: 70, desc: 'Cepelini i teški topovi: udari do 120 polja daleko.' },
      sam: { name: 'Protivavionski topovi', short: 'PA topovi', desc: 'Obaraju cepeline koji ciljaju u krugu od 28 polja.' },
      airport: false,
    },
    missiles: {
      rocket: { name: 'Debela Berta', icon: 'rocket', r: 3, range: 30, cost: 110000, speed: 2.6, cd: 40, desc: 'Najveći top rata: udar u krugu 3 polja do 30 polja daleko.' },
      rocket2: { name: 'Cepelin', icon: 'zeppelin', na: false, r: 4, range: 120, cost: 260000, speed: 1.1, cd: 90, desc: 'Vazdušni brod bombarduje metu (krug 4 polja) do 120 polja daleko. Spor — PA topovi ga mogu oboriti.' },
      emp: false, atom: false, hydro: false, mirv: false,
    },
  },
  {
    id: 'ww2', name: 'Drugi svjetski rat', sub: '1938. godina', short: '1938.',
    blurb: 'Evropa uoči rata: Njemačka, SSSR, Italija, Kraljevina Jugoslavija… Tenkovi, avioni i padobranci, V-2 rakete — a atomska bomba stiže tek od 10. minute.',
    strikeTab: 'Rakete', strikeIcon: 'rocket', road: false, para: true,
    units: {},
    structs: {
      silo: { name: 'Raketna baza', short: 'Baza', desc: 'Lansira V-2 rakete, a od 10. minute i atomsku bombu.' },
      sam: { name: 'Protivavionska odbrana', short: 'PAO', desc: 'Obara neprijateljske rakete i avione koji ciljaju u krugu od 28 polja.' },
    },
    missiles: {
      rocket: { name: 'V-2 raketa', desc: 'Prva balistička raketa: ruši zgrade, uništava jedinice i ubija vojsku.' },
      atom: { from: 6000, desc: 'Razvoj traje: dostupna od 10. minute. Briše teritoriju, sve zgrade i jedinice u krugu od 9 polja.' },
      rocket2: false, emp: false, hydro: false, mirv: false,
    },
  },
  {
    id: 'hladni', name: 'Hladni rat', sub: '1960. godina', short: 'Hladni rat',
    blurb: 'NATO i Varšavski pakt: dvije Njemačke, SSSR, Jugoslavija između blokova. Tenkovi, padobranci, balističke rakete i hidrogenske bombe.',
    strikeTab: 'Rakete', strikeIcon: 'rocket', road: false, para: true,
    units: {},
    structs: {},
    missiles: { rocket2: false, emp: false },
  },
  {
    id: 'danas', name: 'Danas', sub: 'današnje granice', short: 'Danas',
    blurb: 'Današnja Evropa. Sve jedinice i oružje: rakete, EMP, atomske i hidrogenske bombe, MIRV.',
    strikeTab: 'Rakete', strikeIcon: 'rocket', road: false, para: true,
    units: {}, structs: {}, missiles: {},
  },
];
RA.eraById = (id) => RA.ERAS.find((e) => e.id === id) || RA.ERAS[RA.ERAS.length - 1];

RA.applyEra = function (id) {
  const E = RA.eraById(id);
  if (RA.ERA === E) return E;
  RA.ERA = E;
  const merge = (base, over) => {
    const out = {};
    for (const k in base) {
      const o = over && over[k];
      out[k] = Object.assign({}, base[k], o === false ? { na: true } : o || {});
    }
    return out;
  };
  RA.UNIT = merge(RA.BASE.UNIT, E.units);
  RA.STRUCT = merge(RA.BASE.STRUCT, E.structs);
  RA.MISSILE = merge(RA.BASE.MISSILE, E.missiles);
  RA.NUKE = RA.MISSILE;
  RA.STRUCT_ORDER = RA.BASE.STRUCT_ORDER.filter((k) => !RA.STRUCT[k].na);
  for (const k in RA.UNIT) {
    const U = RA.UNIT[k];
    U.lost = `${U.name} ${U.pl ? 'su uništeni' : 'je uništena'}`;
  }
  RA.UNIT_TXT = {};
  for (const k in RA.UNIT) {
    const U = RA.UNIT[k];
    RA.UNIT_TXT[k] = { gone: `${U.name} ${U.pl ? 'su raspušteni' : 'je raspuštena'}`, move: `${U.name} ${U.pl ? 'kreću' : 'kreće'} na novi položaj` };
  }
  return E;
};
RA.missileTypes = () => RA.MISSILE_ORDER.filter((t) => !RA.MISSILE[t].na);
RA.missileIcon = (t) => {
  const M = RA.MISSILE[t];
  return M.icon || (M.kind === 'emp' ? 'emp' : M.kind === 'conv' ? 'rocket' : 'nuke');
};

/* ---------------- era borders (decoded once at boot) ---------------- */
RA.ERA_DATA = {};
RA.loadEras = async function () {
  const D = window.ERADATA || {};
  for (const id of Object.keys(D)) {
    const e = D[id];
    RA.ERA_DATA[id] = { pol: e.pol, own: await RA.inflate(e.own), ren: e.ren || {} };
  }
};

/* The map of one era: its polities as nations, renamed cities (+ historical capitals that are not modern cities),
   capital-tier cities where that era had its capitals. The modern game with a free start is the plain base map. */
RA._eraMaps = new Map();
RA.eraMap = function (base, id, start) {
  const E = RA.ERA_DATA[id];
  if (!E || (id === 'danas' && start !== 'granice')) return base;
  // cached per era (maps are read-only; a game resets its cities' owners when it starts)
  const key = id + '|' + (id === 'danas' ? 'granice' : 'x');
  const hit = RA._eraMaps.get(key);
  if (hit && hit.__base === base) return hit;
  const m = Object.create(base);
  m.__base = base;
  RA._eraMaps.set(key, m);
  const W = base.W, N = base.N;
  m.era = id;
  m.eraOwn = E.own;
  const cities = base.cities.map((c) => Object.assign({}, c, { name: E.ren[c.name] || c.name, owner: 0, tier: c.tier === 3 ? 2 : c.tier }));
  const cityAt = new Int16Array(N).fill(-1);
  cities.forEach((c) => (cityAt[c.c] = c.i));
  const nations = [];
  E.pol.forEach((p, i) => {
    const k = i + 1;
    const c0 = p.y * W + p.x;
    // the capital: a city of this polity within 2 cells, else a new city on the capital cell
    let cap = null, bd = 99;
    for (const ct of cities) {
      const d = Math.max(Math.abs(ct.x - p.x), Math.abs(ct.y - p.y));
      if (d <= 2 && d < bd && E.own[ct.c] === k) {
        bd = d;
        cap = ct;
      }
    }
    if (!cap && p.cap && p.cap !== '—' && base.land[c0] && cityAt[c0] < 0) {
      cap = { i: cities.length, name: p.cap, x: p.x, y: p.y, c: c0, tier: 3, pop: 0, rank: 5, iso: p.k, owner: 0, era: true };
      cities.push(cap);
      cityAt[c0] = cap.i;
    }
    if (cap) {
      cap.tier = 3;
      if (p.cap && p.cap !== '—') cap.name = p.cap;
    }
    nations.push({ iso: p.k, name: p.n, x: cap ? cap.x : p.x, y: cap ? cap.y : p.y, c: cap ? cap.c : c0, color: p.c, capital: cap ? cap.name : p.cap, k });
  });
  m.cities = cities;
  m.cityAt = cityAt;
  // urban defence zones for this era's cities
  const urban = new Int16Array(N).fill(-1);
  for (const c of cities.slice().sort((a, b) => a.tier - b.tier)) {
    const r = [0, 2, 3, 4][c.tier];
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        const x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= W || y >= base.H) continue;
        const q = y * W + x;
        if (base.land[q]) urban[q] = c.i;
      }
  }
  m.urban = urban;
  m.nations = nations;
  m.cityStates = base.cityStates.map((s) => Object.assign({}, s, { name: E.ren[s.name] || s.name }));
  return m;
};

/* nations of an era map that play inside a region polygon (enough land there), capitals moved inside if needed */
RA.eraRegionNations = function (base, inside, minCells) {
  const own = base.eraOwn, N = base.N, W = base.W;
  const K = base.nations.length + 1;
  const cnt = new Int32Array(K), sx = new Float64Array(K), sy = new Float64Array(K);
  for (let c = 0; c < N; c++) {
    if (!inside(c)) continue;
    const k = own[c];
    if (!k) continue;
    cnt[k]++;
    sx[k] += c % W;
    sy[k] += (c / W) | 0;
  }
  const out = [];
  for (const n of base.nations) {
    if (cnt[n.k] < minCells) continue;
    if (inside(n.c)) {
      out.push(n);
      continue;
    }
    // biggest city of this polity inside the region, else its cell closest to the in-region centroid
    let best = null;
    for (const ct of base.cities) {
      if (own[ct.c] !== n.k || !inside(ct.c)) continue;
      if (!best || ct.tier > best.tier || (ct.tier === best.tier && ct.pop > best.pop)) best = ct;
    }
    if (best) {
      out.push(Object.assign({}, n, { c: best.c, x: best.x, y: best.y, capital: best.name }));
      continue;
    }
    const mx = sx[n.k] / cnt[n.k], my = sy[n.k] / cnt[n.k];
    let bc = -1, bd = 1e18;
    for (let c = 0; c < N; c++) {
      if (own[c] !== n.k || !inside(c)) continue;
      const d = ((c % W) - mx) ** 2 + (((c / W) | 0) - my) ** 2;
      if (d < bd) {
        bd = d;
        bc = c;
      }
    }
    if (bc >= 0) out.push(Object.assign({}, n, { c: bc, x: bc % W, y: (bc / W) | 0, capital: n.capital }));
  }
  return out;
};

/* borders start: a human takes over a whole country (all of its land, army and treasury) */
RA.takeBorders = function (G, p, n) {
  const cells = Array.from(n.cells.subarray(0, n.tiles));
  for (const c of cells) G.setOwner(c, p.id);
  n.alive = false;
  n.spawned = false;
  G.replaced.push(n);
  p.alive = true;
  p.spawned = p.tiles > 0;
  p.name = n.name;
  p.iso = n.iso;
  p.took = n;
  p.nation = n.nation;
  p.capital = n.capital;
  p.capCity = n.capCity;
  p.troops = Math.max(25000, n.troops);
  p.gold = n.gold;
};
RA.giveBack = function (G, p) {
  const n = p.took;
  if (!n) return;
  const cells = Array.from(p.cells.subarray(0, p.tiles));
  for (const c of cells) G.setOwner(c, n.id);
  n.alive = true;
  n.spawned = n.tiles > 0;
  G.replaced = G.replaced.filter((r) => r !== n);
  p.took = null;
  p.spawned = false;
};

RA.applyEra('danas');

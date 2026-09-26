'use strict';
/* Ratni Atlas — historical eras. Each era has its own borders (build/eras.py), city names, units, buildings and
   strike weapons. RA.applyEra() swaps the global unit/building/weapon tables (one game runs at a time, and in an
   online game every device applies the same era). */

RA.MISSILE.rocket2 = { name: RA.t("Heavy missile"), kind: 'conv', cost: 300000, r: 4, speed: 3.0, cd: 70, na: true, desc: '' };
RA.MISSILE_ORDER = ['drone', 'hdrone', 'rocket', 'rocket2', 'emp', 'atom', 'hydro', 'mirv'];
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
    id: 'rim', name: RA.t("Ancient Rome"), sub: RA.t("Year 100"), short: RA.t("Rome"),
    blurb: RA.t("The Roman Empire against Germanic, Sarmatian and Celtic tribes. Legions, cavalry, archers and siege engines — no gunpowder, planes or bombs."),
    blurbW: RA.t("The world around the year 100: Rome, Parthia, China's Han dynasty, the Kushans and the tribes around them. Legions, cavalry, archers and siege engines — no gunpowder, planes or bombs."),
    strikeTab: RA.t("Siege"), strikeIcon: 'siege', road: true, para: false,
    units: {
      inf: { name: RA.t("Legion"), desc: RA.t("A solid border defence within 6 cells.") },
      tank: { name: RA.t("Cavalry"), pl: false, sym: 'cav', needs: 'barracks', desc: RA.t("Fast breakthroughs: your attacks next to cavalry are cheaper and faster.") },
      art: { name: RA.t("Archers"), pl: true, needs: null, range: 8, desc: RA.t("Shoot at enemy units and troops up to 8 cells away. They stay behind the line.") },
      ship: { name: RA.t("Trireme"), m: false, range: 5, desc: RA.t("A war galley: sinks landings and trade ships, blockades ports and attacks the coast up to 5 cells.") },
      sub: { name: RA.t("Liburna"), sub: false, range: 5, speed: 0.6, desc: RA.t("A fast galley: hunts landings and trade ships up to 5 cells away.") },
    },
    structs: {
      factory: { name: RA.t("Market"), short: RA.t("Market"), icon: 'market', cost: (n) => Math.min(1.5e6, 150000 * RA.dpow(2, n)), desc: RA.t("Caravans to your cities (18 cells) bring gold.") },
      barracks: { name: RA.t("Military camp"), short: RA.t("Camp"), desc: RA.t("+160k army capacity and +2 unit slots. Needed for cavalry.") },
      fort: { name: RA.t("Castrum"), short: RA.t("Castrum"), desc: RA.t("A fortified camp: attackers within 8 cells lose 3× more troops and are slower.") },
      silo: { name: RA.t("Siege workshop"), short: RA.t("Siege"), icon: 'siege', cost: () => 180000, time: 45, desc: RA.t("Builds onagers: stones at the enemy up to 16 cells away.") },
      sam: false, airport: false, dome: false,
    },
    missiles: {
      rocket: { name: RA.t("Onager"), icon: 'siege', r: 2, range: 16, cost: 45000, speed: 1.2, cd: 50, desc: RA.t("Stones up to 16 cells from the workshop: destroy buildings, wound units and troops.") },
      rocket2: false, emp: false, atom: false, hydro: false, mirv: false, drone: false, hdrone: false,
    },
  },
  {
    id: 'srednji', name: RA.t("Middle Ages"), sub: RA.t("Year 1400"), short: RA.t("Middle Ages"),
    blurb: RA.t("The Kingdom of Bosnia, the Serbian Despotate, Hungary, Venice, the Ottomans, the Holy Roman Empire… Knights, archers, trebuchets and the first bombards."),
    blurbW: RA.t("The world around 1400: the Timurids, Ming China, the Mamluks, the Ottomans, European kingdoms, the Aztecs and the Inca. Knights, archers, trebuchets and the first bombards."),
    strikeTab: RA.t("Siege"), strikeIcon: 'siege', road: true, para: false,
    units: {
      inf: { name: RA.t("Foot soldiers"), pl: true, desc: RA.t("Spearmen hold the border firmly within 6 cells.") },
      tank: { name: RA.t("Knights"), pl: true, sym: 'cav', needs: 'barracks', desc: RA.t("Armoured cavalry: your attacks next to knights are cheaper and faster.") },
      art: { name: RA.t("Archers"), pl: true, needs: null, range: 9, desc: RA.t("Crossbowmen shoot at units and troops up to 9 cells away.") },
      ship: { name: RA.t("Carrack"), m: false, range: 6, desc: RA.t("A sailing warship: sinks landings and trade ships, blockades ports and attacks the coast up to 6 cells.") },
      sub: { name: RA.t("Galley"), sub: false, range: 5, speed: 0.6, desc: RA.t("A fast rowed galley: hunts landings and trade ships up to 5 cells away.") },
    },
    structs: {
      factory: { name: RA.t("Market"), short: RA.t("Market"), icon: 'market', cost: (n) => Math.min(1.5e6, 150000 * RA.dpow(2, n)), desc: RA.t("Caravans to your cities (18 cells) bring gold.") },
      barracks: { name: RA.t("Barracks"), desc: RA.t("+160k army capacity and +2 unit slots. Needed for knights.") },
      fort: { name: RA.t("Castle"), short: RA.t("Castle"), desc: RA.t("Castle: attackers within 8 cells lose 3× more troops and are slower.") },
      silo: { name: RA.t("Siege workshop"), short: RA.t("Siege"), icon: 'siege', cost: () => 220000, time: 50, desc: RA.t("Trebuchets and bombards: strikes on the enemy up to 24 cells away.") },
      sam: false, airport: false, dome: false,
    },
    missiles: {
      rocket: { name: RA.t("Trebuchet"), icon: 'siege', r: 2, range: 18, cost: 50000, speed: 1.3, cd: 50, desc: RA.t("Heavy stones up to 18 cells: destroy buildings, wound units and troops.") },
      rocket2: { name: RA.t("Bombard"), icon: 'siege', na: false, r: 3, range: 24, cost: 140000, speed: 1.8, cd: 70, desc: RA.t("The first cannons: a stronger strike (3-cell radius) up to 24 cells away.") },
      emp: false, atom: false, hydro: false, mirv: false, drone: false, hdrone: false,
    },
  },
  {
    id: 'napoleon', name: RA.t("Napoleonic era"), sub: RA.t("Year 1815"), short: RA.t("Napoleon"),
    blurb: RA.t("Empires and kingdoms after Napoleon, dozens of German and Italian states. Musketeers, cavalry, cannons and Congreve rockets."),
    blurbW: RA.t("The world after Napoleon: Britain, Russia, the Ottomans, Qing China, the young American republics. Musketeers, cavalry, cannons and Congreve rockets."),
    strikeTab: RA.t("Rockets"), strikeIcon: 'rocket', road: true, para: false,
    units: {
      inf: { name: RA.t("Infantry"), desc: RA.t("Musketeers hold the border firmly within 6 cells.") },
      tank: { name: RA.t("Cavalry"), pl: false, sym: 'cav', needs: 'barracks', desc: RA.t("Hussars and cuirassiers: your attacks next to cavalry are cheaper and faster.") },
      art: { name: RA.t("Cannons"), pl: true, needs: 'factory', range: 12, desc: RA.t("Shoot at enemy units and troops up to 12 cells away. Need a manufactory.") },
      ship: { name: RA.t("Ship of the line"), range: 7, desc: RA.t("A 74-gun ship: sinks landings and trade ships, blockades ports and shells the coast up to 7 cells.") },
      sub: { name: RA.t("Frigate"), sub: false, range: 6, speed: 0.62, desc: RA.t("A fast frigate: hunts landings and trade ships up to 6 cells away.") },
    },
    structs: {
      factory: { name: RA.t("Manufactory"), short: RA.t("Manufactory"), desc: RA.t("Coaches to your cities (18 cells) bring gold. Needed for cannons.") },
      barracks: { desc: RA.t("+160k army capacity and +2 unit slots. Needed for cavalry.{=2}") },
      silo: { name: RA.t("Rocket battery"), short: RA.t("Battery"), cost: () => 350000, time: 60, desc: RA.t("Congreve rockets: strikes up to 40 cells away.") },
      sam: false, airport: false, dome: false,
    },
    missiles: {
      rocket: { name: RA.t("Congreve rocket"), r: 3, range: 40, cost: 80000, speed: 2.4, cd: 45, desc: RA.t("Inaccurate but terrifying: a 3-cell strike up to 40 cells from the battery.") },
      rocket2: false, emp: false, atom: false, hydro: false, mirv: false, drone: false, hdrone: false,
    },
  },
  {
    id: 'ww1', name: RA.t("World War I"), sub: RA.t("Year 1914"), short: '1914.',
    blurb: RA.t("The Entente against the Central Powers: Austria-Hungary, the German and Russian empires, Serbia, the Ottomans… Trenches, heavy artillery, the first tanks and zeppelins."),
    blurbW: RA.t("The world in 1914: the colonial empires of Britain, France and Germany, the Russian and Ottoman empires, the USA, Japan, China… Trenches, heavy artillery, the first tanks and zeppelins."),
    strikeTab: RA.t("Strikes"), strikeIcon: 'zeppelin', road: false, para: false,
    units: {
      tank: { name: RA.t("Tanks"), desc: RA.t("The first tanks (from 1916): your attacks next to them are cheaper and faster. Need a factory.") },
      art: { desc: RA.t("Heavy artillery hits units and troops up to 12 cells away. Needs a factory.") },
      ship: { name: RA.t("Dreadnought"), desc: RA.t("A battleship: sinks landings, trade ships and warships, blockades ports and shells the coast up to 8 cells.") },
    },
    structs: {
      fort: { name: RA.t("Trenches and forts"), short: RA.t("Trenches") },
      silo: { name: RA.t("Zeppelin hangar"), short: RA.t("Hangar"), icon: 'hangar', cost: () => 500000, time: 70, desc: RA.t("Zeppelins and heavy guns: strikes up to 120 cells away.") },
      sam: { name: RA.t("Anti-aircraft guns"), short: RA.t("AA guns"), desc: RA.t("Shoot down zeppelins aimed within 28 cells.") },
      airport: false, dome: false,
    },
    missiles: {
      rocket: { name: RA.t("Big Bertha"), icon: 'rocket', r: 3, range: 30, cost: 110000, speed: 2.6, cd: 40, desc: RA.t("The war's biggest gun: a 3-cell strike up to 30 cells away.") },
      rocket2: { name: RA.t("Zeppelin"), icon: 'zeppelin', na: false, r: 4, range: 120, cost: 260000, speed: 1.1, cd: 90, desc: RA.t("An airship bombs a target (4-cell radius) up to 120 cells away. Slow — AA guns can shoot it down.") },
      emp: false, atom: false, hydro: false, mirv: false, drone: false, hdrone: false,
    },
  },
  {
    id: 'ww2', name: RA.t("World War II"), sub: RA.t("Year 1938"), short: '1938.',
    blurb: RA.t("Europe on the eve of war: Germany, the USSR, Italy, the Kingdom of Yugoslavia… Tanks, planes and paratroopers, V-2 rockets — and the atomic bomb only from minute 10."),
    blurbW: RA.t("The world on the eve of war: Germany, the USSR, Japan, the USA, the British and French empires… Tanks, planes and paratroopers, V-2 rockets — and the atomic bomb only from minute 10."),
    strikeTab: RA.t("Rockets"), strikeIcon: 'rocket', road: false, para: true,
    units: { ship: { name: RA.t("Battleship") } },
    structs: {
      silo: { name: RA.t("Rocket base"), short: RA.t("Base"), desc: RA.t("Launches V-2 rockets, and from minute 10 the atomic bomb.") },
      sam: { name: RA.t("Anti-aircraft defence"), short: 'PAO', desc: RA.t("Shoots down enemy missiles and planes aimed within 28 cells.") },
    },
    missiles: {
      rocket: { name: RA.t("V-2 rocket"), desc: RA.t("The first ballistic missile: destroys buildings and units and kills troops.") },
      atom: { from: 6000, desc: RA.t("In development: available from minute 10. Wipes out land, every building and unit within 9 cells.") },
      rocket2: false, emp: false, hydro: false, mirv: false, drone: false, hdrone: false,
    },
  },
  {
    id: 'hladni', name: RA.t("Cold War"), sub: RA.t("Year 1960"), short: RA.t("Cold War"),
    blurb: RA.t("NATO and the Warsaw Pact: two Germanys, the USSR, Yugoslavia between the blocs. Tanks, paratroopers, ballistic missiles and hydrogen bombs."),
    blurbW: RA.t("The USA and the USSR divide the world: NATO, the Warsaw Pact, China, the non-aligned and colonies on the eve of independence. Tanks, paratroopers, ballistic missiles and hydrogen bombs."),
    strikeTab: RA.t("Rockets"), strikeIcon: 'rocket', road: false, para: true,
    units: { ship: { name: RA.t("Destroyer") } },
    structs: {},
    missiles: { rocket2: false, emp: false, drone: false, hdrone: false },
  },
  {
    id: 'danas', name: RA.t("Today"), sub: RA.t("today's borders"), short: RA.t("Today"),
    blurb: RA.t("Today's Europe. Every unit and weapon: missiles, EMP, atomic and hydrogen bombs, MIRV."),
    blurbW: RA.t("Today's world. Every unit and weapon: missiles, EMP, atomic and hydrogen bombs, MIRV."),
    strikeTab: RA.t("Rockets"), strikeIcon: 'rocket', road: false, para: true,
    units: { ship: { name: RA.t("Destroyer") }, sub: { name: RA.t("Nuclear submarine") } }, structs: {}, missiles: {},
  },
];
RA.eraById = (id) => RA.ERAS.find((e) => e.id === id) || RA.ERAS[RA.ERAS.length - 1];
/* the era's short description on a map: blurb is written for Europe, blurbW for the world */
RA.eraBlurb = (E, mapId) => (mapId === 'svijet' && E.blurbW) || E.blurb;

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
    U.lost = U.naval ? (U.m ? RA.t("{0} was sunk", U.name) : RA.t("{0} was sunk{=2}", U.name)) : U.pl ? RA.t("{0} were destroyed", U.name) : RA.t("{0} was destroyed", U.name);
  }
  RA.UNIT_TXT = {};
  for (const k in RA.UNIT) {
    const U = RA.UNIT[k];
    RA.UNIT_TXT[k] = U.naval
      ? { gone: U.m ? RA.t("{0} was decommissioned", U.name) : RA.t("{0} was decommissioned{=2}", U.name), move: RA.t("{0} sails to a new position", U.name) }
      : U.pl ? { gone: RA.t("{0} were disbanded", U.name), move: RA.t("{0} move to a new position", U.name) } : { gone: RA.t("{0} was disbanded", U.name), move: RA.t("{0} moves to a new position", U.name) };
  }
  return E;
};
RA.missileTypes = () => RA.MISSILE_ORDER.filter((t) => !RA.MISSILE[t].na);
RA.missileIcon = (t) => {
  const M = RA.MISSILE[t];
  return M.icon || (M.kind === 'emp' ? 'emp' : M.kind === 'conv' ? 'rocket' : 'nuke');
};

/* ---------------- era borders ---------------- */
/* Europe: all eras are embedded and decoded at boot (map.eras = RA.loadEras()).
   Other maps (map.lazyEras): era_<id>.json is fetched and decoded when that era is chosen; two stay decoded. */
const eraOf = async (e, N) => {
  const own = await RA.inflate(e.own);
  if (own.length !== N) throw new Error('era/grid mismatch');
  return { pol: e.pol, own, ren: e.ren || {} };
};
RA.loadEras = async function (D, N) {
  const out = {};
  for (const id of Object.keys(D || {})) out[id] = await eraOf(D[id], N);
  return out;
};
RA.eraReady = (map, id) => !map.lazyEras || !!map.eras[id];
RA.loadEra = function (map, id) {
  if (RA.eraReady(map, id)) return Promise.resolve();
  if (map.eraOK && !map.eraOK[id]) return Promise.reject(new Error('no-era'));
  const L = (map._eraLoads = map._eraLoads || {});
  return (L[id] = L[id] || RA.fetchJSON(RA.DATA_URL + map.id + '/era_' + id + '.json')
    .then((e) => eraOf(e, map.N))
    .then((E) => {
      map.eras[id] = E;
      const ks = Object.keys(map.eras);
      if (ks.length > 2) delete map.eras[ks[0]]; // ~1 MB per decoded world era
    })
    .finally(() => delete L[id]));
};

/* The map of one era: its polities as nations, renamed cities (+ historical capitals that are not modern cities),
   capital-tier cities where that era had its capitals. The modern game with a free start is the plain base map
   (except on maps whose nations always come from the era rasters). */
RA._eraMaps = new Map();
RA.eraMap = function (base, id, start) {
  const E = (base.eras || {})[id];
  if (!E || (id === 'danas' && start !== 'granice' && !base.eraNations)) return base;
  // cached per map and era (maps are read-only; a game resets its cities' owners when it starts)
  const key = base.id + '|' + id;
  const hit = RA._eraMaps.get(key);
  if (hit && hit.__base === base && hit.eraOwn === E.own) return hit;
  // only this map's era maps stay (a world era map holds ~5 MB), and of a lazily loaded map only one
  for (const [k, v] of RA._eraMaps) if (v.__base !== base || base.lazyEras) RA._eraMaps.delete(k);
  const m = Object.create(base);
  m.__base = base;
  RA._eraMaps.set(key, m);
  const W = base.W, N = base.N;
  m.era = id;
  m.eraOwn = E.own;
  const cities = base.cities.map((c) => Object.assign({}, c, { name: E.ren[c.raw] ? RA.tn(E.ren[c.raw]) : c.name, owner: 0, tier: c.tier === 3 ? 2 : c.tier }));
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
      cap = { i: cities.length, name: RA.tn(p.cap), raw: p.cap, x: p.x, y: p.y, c: c0, tier: 3, pop: 0, rank: 5, iso: p.k, owner: 0, era: true };
      cities.push(cap);
      cityAt[c0] = cap.i;
    }
    if (cap) {
      cap.tier = 3;
      if (p.cap && p.cap !== '—') cap.name = RA.tn(p.cap);
    }
    nations.push({ iso: p.k, name: RA.tn(p.n), x: cap ? cap.x : p.x, y: cap ? cap.y : p.y, c: cap ? cap.c : c0, color: p.c, capital: cap ? cap.name : RA.tn(p.cap), k });
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
  m.cityStates = base.cityStates.map((s) => Object.assign({}, s, { name: E.ren[s.raw] ? RA.tn(E.ren[s.raw]) : s.name }));
  return m;
};

/* nations of an era map that play inside a region polygon (enough land there), capitals moved inside if needed.
   c0..c1: the cell range that holds the region (its bounding rows), so small regions of a big map scan less */
RA.eraRegionNations = function (base, inside, minCells, c0 = 0, c1 = base.N) {
  const own = base.eraOwn, W = base.W;
  const K = base.nations.reduce((a, n) => Math.max(a, n.k), 0) + 1; // a scenario's states may skip keys
  const cnt = new Int32Array(K), sx = new Float64Array(K), sy = new Float64Array(K);
  for (let c = c0; c < c1; c++) {
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
    for (let c = c0; c < c1; c++) {
      if (own[c] !== n.k || !inside(c)) continue;
      const dx = (c % W) - mx, dy = ((c / W) | 0) - my;
      const d = dx * dx + dy * dy;
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

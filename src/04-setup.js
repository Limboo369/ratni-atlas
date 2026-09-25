'use strict';
/* Game setup: nations at real capitals, city-states at real towns, human spawn / nation takeover */

RA.ME_COLOR = '#2f7bff';
RA.SLOT_COLORS = ['#2f7bff', '#ff4fc3', '#ffd23f', '#6ee05a'];

RA.addHuman = function (G, name, color) {
  const p = G.addPlayer({ name: name || 'Ti', type: 'human', color: color || RA.ME_COLOR });
  p.nick = name || 'Ti';
  p.troops = 25000;
  p.gold = 60000;
  G.humans = (G.humans || []).concat([p]);
  return p;
};
/* a human takes over a nation (its land start, capital and name) */
RA.takeOverNation = function (G, p, n) {
  G.unspawn(n);
  n.alive = false;
  G.replaced.push(n);
  p.name = n.name;
  p.iso = n.iso;
  p.took = n;
  G.spawnDisk(p, n.nation.c, 3);
  p.capCity = n.capCity;
  p.troops = 25000;
};
/* permanent military alliance for a co-op team (never expires, cannot be broken, doesn't use alliance slots) */
RA.makeTeam = function (G, list, team) {
  for (const a of list) {
    a.team = team;
    for (const b of list) {
      if (a === b) continue;
      a.allies.set(b.id, Infinity);
      a.rel[b.id] = 100;
    }
  }
  G.alliancesChanged = true;
};
/* the same game on every device of an online room: same seed, same settings, humans in slot order */
RA.setupOnline = function (baseMap, st, mySlot) {
  const set = st.set;
  const era = set.era || 'danas', start = set.st || 'slobodno';
  const gm = RA.regionMap(RA.eraMap(baseMap, era, start), set.reg);
  const G = RA.newGame(gm, { seed: st.seed, difficulty: set.dif, cityStates: set.cs, peace: set.peace, era, start, gm: set.gm, res: set.res === 1 });
  G.online = true;
  G.humans = [];
  st.slots.forEach((sl, i) => {
    const p = RA.addHuman(G, sl.name, RA.SLOT_COLORS[i % RA.SLOT_COLORS.length]);
    p.slot = i;
    const n = G.P.find((q) => q && q.type === 'nation' && q.alive && q.iso === sl.iso) || G.P.find((q) => q && q.type === 'nation' && q.alive);
    if (n) {
      if (G.borders) RA.takeBorders(G, p, n);
      else RA.takeOverNation(G, p, n);
    }
  });
  if (set.mode === 'coop') RA.makeTeam(G, G.humans, 1);
  RA.startGame(G);
  G.me = G.humans[mySlot] || null;
  return G;
};

/* The maps: Europe is embedded in the page; the world is fetched from our server (data/svijet/) on first use. */
RA.MAPS = [
  { id: 'evropa', name: 'Evropa', sub: 'detaljno', all: 'Cijela Evropa', aria: 'Karta Evrope', load: 'Učitavam kartu Evrope…',
    tag: 'Osvajaj Evropu na stvarnoj karti — grad po grad, preko rijeka i planina.',
    winter: 'Zima na sjeveru', winterHow: 'sjever (iznad ~51°)' },
  { id: 'svijet', name: 'Svijet', sub: 'svi kontinenti', all: 'Cijeli svijet', aria: 'Karta svijeta', load: 'Učitavam kartu svijeta…',
    tag: 'Osvajaj cijeli svijet na stvarnoj karti — kontinent po kontinent, preko okeana.',
    winter: 'Zima na dalekom sjeveru', winterHow: 'daleki sjever svijeta (iznad ~51° sjeverne širine: Kanada, sjever Evrope, Rusija)' },
];
RA.mapInfo = (id) => RA.MAPS.find((m) => m.id === id) || RA.MAPS[0];
/* what a device must have downloaded to play a room's game (lobby presence ld) */
RA.mapKey = (set) => RA.mapInfo(set.map).id + ':' + RA.eraById(set.era).id;

/* Playable regions: a polygon (lon, lat) roughly following coasts and borders + the nations that play there.
   Cells outside the polygon are blocked (not conquerable, boats can't sail there). A listed nation whose real
   capital lies outside the region starts from its biggest city inside it. Regions without a nation list (the
   world) take every country with enough land inside from the era raster. The first region of a map is all of it. */
RA.REGIONS = [
  { id: 'evropa', name: 'Cijela Evropa' },
  { id: 'balkan', name: 'Balkan', nations: ['SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'ALB', 'MKD', 'GRC', 'BGR', 'ROU', 'MDA', 'HUN'],
    poly: [[13.1, 46.6], [14.6, 46.75], [16.1, 47.2], [17.1, 48.0], [22.9, 48.2], [26.6, 48.4], [28.5, 48.6], [30.3, 46.8], [30.3, 45.0], [30.0, 42.0],
      [29.6, 41.3], [27.0, 40.0], [26.7, 38.3], [27.9, 36.6], [28.4, 35.8], [28.4, 34.6], [19.0, 34.6], [19.0, 40.3], [12.9, 45.3]] },
  { id: 'zapad', name: 'Zapadna Evropa', nations: ['PRT', 'ESP', 'FRA', 'GBR', 'IRL', 'NLD', 'BEL', 'CHE', 'DEU'],
    poly: [[-11.0, 36.0], [-5.4, 36.0], [-2.0, 36.6], [1.0, 38.5], [4.5, 39.8], [9.7, 41.3], [9.7, 43.4], [7.5, 43.8], [7.0, 45.9], [10.5, 46.4],
      [12.2, 47.6], [12.2, 54.5], [8.6, 54.9], [4.0, 57.5], [0.0, 61.2], [-11.0, 61.2]] },
  { id: 'centar', name: 'Srednja Evropa', nations: ['DEU', 'POL', 'CZE', 'SVK', 'AUT', 'HUN', 'CHE', 'SVN', 'HRV', 'NLD', 'BEL', 'DNK'],
    poly: [[2.5, 51.1], [3.2, 50.7], [4.2, 50.0], [5.8, 49.5], [6.5, 49.2], [8.2, 49.0], [7.6, 47.6], [5.9, 47.3], [6.0, 46.2], [6.9, 45.9], [8.9, 45.85],
      [10.5, 46.5], [12.3, 46.6], [13.0, 45.6], [13.2, 45.0], [19.1, 45.0], [18.9, 45.9], [20.3, 46.1], [21.2, 46.2], [21.7, 46.9], [22.9, 48.1],
      [22.6, 49.0], [24.2, 50.5], [23.6, 52.8], [22.8, 54.4], [19.6, 54.5], [14.8, 54.3], [14.8, 55.3], [12.75, 55.3], [12.75, 56.1], [10.7, 57.9],
      [8.0, 57.2], [7.8, 55.0], [7.0, 53.7], [4.6, 53.2], [3.3, 51.4]] },
  { id: 'sjever', name: 'Sjever i Baltik', nations: ['NOR', 'SWE', 'FIN', 'DNK', 'EST', 'LVA', 'LTU', 'RUS'],
    poly: [[4.0, 57.8], [4.0, 63.0], [12.0, 71.3], [32.5, 71.3], [32.5, 58.0], [28.2, 56.1], [26.8, 55.3], [25.8, 54.8], [25.6, 54.2], [23.5, 53.9],
      [22.8, 54.4], [19.6, 54.5], [14.8, 54.3], [12.0, 54.3], [9.8, 54.6], [8.3, 54.9], [7.8, 55.1], [7.8, 57.2]] },
  { id: 'istok', name: 'Istočna Evropa', nations: ['UKR', 'BLR', 'RUS', 'POL', 'LTU', 'LVA', 'EST', 'FIN', 'MDA', 'ROU'],
    poly: [[14.2, 55.0], [20.8, 55.0], [20.8, 61.0], [41.0, 61.0], [41.0, 43.3], [36.5, 44.2], [33.0, 44.2], [29.5, 44.0], [28.6, 43.7], [27.0, 44.1],
      [26.0, 43.9], [24.0, 43.7], [22.7, 44.5], [21.4, 45.2], [20.3, 46.1], [21.2, 46.4], [21.7, 47.0], [22.1, 47.6], [22.9, 48.1], [22.2, 48.4],
      [22.6, 49.1], [18.8, 49.5], [16.0, 50.6], [14.8, 50.9], [14.7, 52.1], [14.2, 53.3]] },
  { id: 'jug', name: 'Mediteran', nations: ['PRT', 'ESP', 'FRA', 'ITA', 'SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'ALB', 'MKD', 'GRC', 'BGR', 'TUR', 'CYP', 'MAR', 'DZA', 'TUN', 'SYR'],
    poly: [[-11.0, 33.0], [36.8, 33.0], [36.8, 42.0], [31.0, 43.0], [28.6, 43.7], [27.0, 44.1], [26.0, 43.9], [24.0, 43.7], [22.7, 44.5], [21.4, 45.2],
      [19.0, 45.9], [16.5, 46.5], [13.0, 46.5], [9.0, 46.0], [7.0, 45.9], [4.5, 45.9], [0.0, 44.2], [-11.0, 44.2]] },
].map((r) => Object.assign(r, { map: 'evropa' })).concat([
  { id: 'svijet', name: 'Cijeli svijet' },
  { id: 'bliski', name: 'Bliski istok i Mediteran',
    poly: [[-10, 29], [-10, 44.5], [3, 44.5], [15, 47], [30, 46.5], [41, 44.5], [50, 45], [63, 42], [63, 23], [57, 12], [43, 11], [34.5, 28], [32, 30], [10, 28]] },
  { id: 'afrika', name: 'Afrika', poly: [[-19, 37], [-6, 36.2], [11, 38], [32.3, 31.6], [34.3, 29.5], [43.2, 12.6], [52, 12.5], [52, -36], [-19, -36]] },
  { id: 'azija', name: 'Azija',
    poly: [[26, 36], [26, 42], [40, 42], [40, 50], [60, 50], [60, 72], [180, 72], [180, 60], [165, 50], [150, 30], [155, -11], [95, -11], [75, 5], [60, 22], [48, 12], [43.5, 12.5], [34.5, 28], [34.5, 36]] },
  { id: 'sam', name: 'Sjeverna Amerika', poly: [[-180, 72], [-12, 72], [-12, 58], [-50, 45], [-58, 10], [-77, 7.5], [-83, 7], [-120, 20], [-180, 50]] },
  { id: 'jam', name: 'Južna Amerika', poly: [[-82, 13], [-58, 13], [-34, -5], [-34, -56], [-82, -56]] },
  { id: 'okeanija', name: 'Okeanija', poly: [[110, -20], [112, -9], [130, -9], [140, -1], [180, 0], [180, -50], [110, -50]] },
].map((r) => Object.assign(r, { map: 'svijet' })));
for (const r of RA.REGIONS) {
  if (!r.poly) continue;
  const lons = r.poly.map((q) => q[0]), lats = r.poly.map((q) => q[1]);
  r.box = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]; // the cell range is clamped to the grid in regionMask
}
RA.regionsOf = (mapId) => RA.REGIONS.filter((r) => r.map === mapId);
/* the start screen's "part of the world": Evropa is its own detailed map (with its own parts), the rest are regions
   of the world map. Settings keep map + region as before (saves, online lobby). */
RA.THEATRES = [
  { id: 'svijet', map: 'svijet', region: 'svijet', name: 'Cijeli svijet' },
  { id: 'evropa', map: 'evropa', region: null, name: 'Evropa' },
  { id: 'bliski', map: 'svijet', region: 'bliski', name: 'Bliski istok i Mediteran' },
  { id: 'afrika', map: 'svijet', region: 'afrika', name: 'Afrika' },
  { id: 'azija', map: 'svijet', region: 'azija', name: 'Azija' },
  { id: 'sam', map: 'svijet', region: 'sam', name: 'Sjeverna Amerika' },
  { id: 'jam', map: 'svijet', region: 'jam', name: 'Južna Amerika' },
  { id: 'okeanija', map: 'svijet', region: 'okeanija', name: 'Okeanija' },
];
RA.theatreOf = (s) => (s.map === 'evropa' ? 'evropa' : s.region);
RA.regionOf = (base, id) => RA.REGIONS.find((r) => r.id === id && r.map === base.id);
RA.pointInPoly = function (x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/* The cells of a region (block = 1 outside), cached per map: it does not depend on the era, and the start screen
   counts countries of every region on each tap. Only the current map's masks are kept (1 byte per cell each). */
RA._regMasks = new Map();
RA.regionMask = function (base, R) {
  const key = base.id + '|' + R.id;
  const hit = RA._regMasks.get(key);
  if (hit && hit.land === base.land) return hit;
  for (const [k, v] of RA._regMasks) if (v.land !== base.land) RA._regMasks.delete(k);
  const W = base.W, H = base.H, N = base.N;
  // polygon in normalized Mercator, so the cell mask matches the outline drawn on the map exactly
  const mp = R.poly.map(([lon, lat]) => [RA.snap(RA.lonToX(lon), 1e-10), RA.snap(RA.latToY(lat), 1e-10)]);
  const gx = (lon) => (RA.lonToX(lon) - base.X0) / base.CELL;
  const gy = (lat) => (RA.latToY(lat) - base.Y0) / base.CELL;
  const x0 = Math.max(0, Math.floor(gx(R.box[0])) - 2), x1 = Math.min(W - 1, Math.ceil(gx(R.box[2])) + 2);
  const y0 = Math.max(0, Math.floor(gy(R.box[3])) - 2), y1 = Math.min(H - 1, Math.ceil(gy(R.box[1])) + 2);
  const block = new Uint8Array(N).fill(1);
  let cnt = 0, area = 0;
  for (let y = y0; y <= y1; y++) {
    const cy = base.Y0 + (y + 0.5) * base.CELL;
    for (let x = x0; x <= x1; x++) {
      if (!RA.pointInPoly(base.X0 + (x + 0.5) * base.CELL, cy, mp)) continue;
      const c = y * W + x;
      block[c] = 0;
      if (base.land[c]) {
        cnt++;
        area += base.aw[c];
      }
    }
  }
  const K = { land: base.land, block, cnt, area, mp, c0: Math.max(0, y0) * W, c1: Math.min(N, (y1 + 1) * W) };
  RA._regMasks.set(key, K);
  return K;
};
/* the nations that play in a region (without building the region's map: the start screen and the lobby list them) */
RA.regionNations = function (base, id) {
  const R = RA.regionOf(base, id);
  if (!R || !R.poly) return base.nations;
  const K = RA.regionMask(base, R), land = base.land, block = K.block;
  return RA._regionNats(base, R, K, (c) => !block[c] && land[c]);
};
RA._regionNats = function (base, R, K, inside) {
  if (base.eraOwn) return RA.eraRegionNations(base, inside, 40, K.c0, K.c1);
  if (!R.nations) return base.nations.filter((n) => inside(n.c)); // era raster not loaded (should not happen)
  const nats = [];
  for (const iso of R.nations) {
    const n = base.nations.find((q) => q.iso === iso);
    if (!n) continue;
    if (inside(n.c)) {
      nats.push(n);
      continue;
    }
    let best = null;
    for (const ct of base.cities) {
      if (ct.iso !== iso || !inside(ct.c)) continue;
      if (!best || ct.tier > best.tier || (ct.tier === best.tier && ct.pop > best.pop)) best = ct;
    }
    if (best) nats.push(Object.assign({}, n, { c: best.c, x: best.x, y: best.y, capital: best.name }));
  }
  return nats;
};

RA.regionMap = function (base, id) {
  const R = RA.regionOf(base, id);
  if (!R || !R.poly) return base;
  const N = base.N;
  const K = RA.regionMask(base, R);
  const m = Object.create(base); // same geometry, own land/coast masks; the block mask is shared (read-only)
  m.land = new Uint8Array(N);
  m.coast = new Uint8Array(N);
  m.block = K.block;
  for (let c = K.c0; c < K.c1; c++) {
    if (K.block[c] || !base.land[c]) continue;
    m.land[c] = 1;
    m.coast[c] = base.coast[c];
  }
  const cnt = K.cnt;
  m.landCount = cnt;
  m.landArea = K.area;
  // smaller maps: wars between states move slower so a regional game still lasts ~10+ minutes
  m.pace = RA.clamp(RA.dpow(base.landCount / Math.max(1, cnt), 0.3), 1, 2.5);
  const inside = (c) => !m.block[c] && m.land[c];
  m.region = { id: R.id, name: R.name, box: R.box, mpoly: K.mp };
  const nats = RA._regionNats(base, R, K, inside);
  m.nations = nats;
  // city-states: the usual ones inside the region, topped up with real towns so small regions stay lively
  const cs = base.cityStates.filter((s) => inside(s.c));
  const want = Math.round(cnt / 2200) + 2;
  const far = (x, y, list, d) => list.every((q) => (q.x - x) ** 2 + (q.y - y) ** 2 >= d * d);
  const towns = base.cities.filter((ct) => ct.tier <= 2 && inside(ct.c)).sort((a, b) => b.pop - a.pop);
  for (const ct of towns) {
    if (cs.length >= want) break;
    if (!far(ct.x, ct.y, nats, 10) || !far(ct.x, ct.y, cs, 7)) continue;
    cs.push({ name: ct.name, x: ct.x, y: ct.y, c: ct.c });
  }
  m.cityStates = cs;
  return m;
};

RA.newGame = function (map, opts) {
  RA.applyEra(opts.era || 'danas');
  const G = new RA.Game(map, opts);
  G.coastList = [];
  for (let i = 0; i < map.N; i++) if (map.coast[i]) G.coastList.push(i);
  const startGold = 60000;
  // "granice": every country starts with its real borders of the chosen era (no free land, no city-states)
  const borders = (G.borders = opts.start === 'granice' && !!map.eraOwn);
  for (const n of map.nations) {
    const p = G.addPlayer({ name: n.name, type: 'nation', color: n.color, iso: n.iso });
    if (!p) break; // at most 250 players (8-bit owner ids); the build keeps an era under 190 polities
    p.nation = n;
    p.capCity = map.cityAt[n.c];
    if (!borders) G.spawnDisk(p, n.c, 3);
    p.troops = 25000 * G.diff.start;
    p.gold = startGold;
    RA.AI.init(G, p);
  }
  if (borders) {
    const byK = [];
    for (const p of G.P) if (p && p.nation) byK[p.nation.k] = p;
    const own = map.eraOwn, land = map.land, block = map.block;
    for (let c = 0; c < map.N; c++) {
      if (!land[c] || block[c]) continue;
      const p = byK[own[c]];
      if (p) G.setOwner(c, p.id);
    }
    for (const p of G.P) {
      if (!p || !p.nation) continue;
      p.spawned = p.tiles > 0;
      p.capital = p.nation.c;
      let ci = map.cityAt[p.nation.c];
      if (ci < 0 || G.cities[ci].owner !== p.id) {
        ci = -1;
        for (const ct of G.cities) if (ct.owner === p.id && (ci < 0 || ct.tier > G.cities[ci].tier || (ct.tier === G.cities[ci].tier && ct.pop > G.cities[ci].pop))) ci = ct.i;
      }
      p.capCity = ci;
      p.maxT = G.computeMax(p);
      // a giant (Rome, Russia) starts with a smaller share of its huge army, so it cannot overrun everyone in minutes
      p.troops = p.maxT * 0.4 * RA.clamp(0.12 / Math.max(0.001, (p.area / map.landArea) * G.shareK()), 0.45, 1);
      p.gold = 100000;
    }
    G.replaced = [];
    return G;
  }
  // city-states: shuffled real towns
  const cs = map.cityStates.slice();
  for (let i = cs.length - 1; i > 0; i--) {
    const j = Math.floor(G.rng() * (i + 1));
    [cs[i], cs[j]] = [cs[j], cs[i]];
  }
  // regional maps get a proportional number of city-states
  // (and never more than the 250 player ids leave, with a seat kept for every possible human)
  const k = Math.min(Math.round((opts.cityStates || 0) * (map.region ? Math.min(1, map.landCount / 110000) : 1)), cs.length, 250 - (G.P.length - 1) - RA.SLOT_COLORS.length);
  for (let i = 0; i < k; i++) {
    const s = cs[i];
    const h = G.rng();
    const rgb = hsl(h, 0.16 + G.rng() * 0.1, 0.5 + G.rng() * 0.12);
    const p = G.addPlayer({ name: s.name, type: 'bot', color: RA.rgbToHex(rgb) });
    if (!p) break;
    p.capCity = map.cityAt[s.c];
    G.spawnDisk(p, s.c, 2);
    p.troops = 9000;
    RA.AI.init(G, p);
  }
  G.replaced = [];
  return G;

  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return [f(0), f(8), f(4)];
  }
};

/* Place (or move) the human. Tapping near a nation's capital takes that nation over. */
RA.placeHuman = function (G, cell, name, inner) {
  const map = G.map, W = map.W;
  if (!inner) (G.picks || (G.picks = [])).push(cell); // a saved game repeats every pick (09b-save.js)
  if (cell >= 0 && map.block[cell]) return { err: 'To je izvan odabrane regije — izaberi mjesto unutar žutog okvira.' };
  if (cell < 0 || !map.land[cell]) return { err: G.borders ? 'Dodirni državu na kopnu.' : 'Izaberi kopno.' };
  if (G.borders) {
    // real borders: you take over a whole country
    if (G.me && G.owner[cell] === G.me.id) return { ok: true, took: G.me.took };
    const n = G.owner[cell] ? G.P[G.owner[cell]] : null;
    if (!n || n.type !== 'nation') return { err: 'Tu nema države — dodirni obojenu teritoriju.' };
    if (G.me) RA.giveBack(G, G.me);
    else G.me = RA.addHuman(G, name, RA.ME_COLOR);
    G.me.nick = name || 'Ti';
    RA.takeBorders(G, G.me, n);
    return { ok: true, took: n };
  }
  // restore anything replaced by a previous pick
  if (G.me) {
    G.unspawn(G.me);
    for (const r of G.replaced) {
      r.alive = true;
      G.spawnDisk(r, r.nation ? r.nation.c : r.capital, r.type === 'bot' ? 2 : 3);
    }
    G.replaced = [];
  }
  const cx = cell % W, cy = (cell / W) | 0;
  let take = null, bd = 1e9;
  for (const p of G.P) {
    if (!p || p.type !== 'nation' || !p.alive) continue;
    const d = RA.dist(p.nation.x - cx, p.nation.y - cy);
    if (d < 11 && d < bd) {
      bd = d;
      take = p;
    }
  }
  if (!G.me) G.me = RA.addHuman(G, name, RA.ME_COLOR);
  const me = G.me;
  me.alive = true;
  let center = cell;
  if (take) {
    G.unspawn(take);
    take.alive = false;
    G.replaced.push(take);
    me.name = take.name;
    me.iso = take.iso;
    me.took = take;
    center = take.nation.c;
  } else {
    me.name = name || 'Ti';
    me.nick = name || 'Ti';
    me.took = null;
    // push away city-states that are too close
    for (const p of G.P) {
      if (!p || p === me || !p.alive || p.type !== 'bot') continue;
      const pc = p.capital;
      if (RA.dist((pc % W) - cx, ((pc / W) | 0) - cy) < 9) {
        G.unspawn(p);
        p.alive = false;
        G.replaced.push(p);
      }
    }
    // must not sit on top of a nation's start
    if (G.owner[cell] && G.P[G.owner[cell]].type === 'nation') {
      return RA.placeHuman(G, G.P[G.owner[cell]].nation.c, name, true);
    }
  }
  const n = G.spawnDisk(me, center, 3);
  if (!n) return { err: 'Tu nema slobodnog kopna.' };
  // capital: the nation's capital, otherwise the nearest real city inside the start area
  me.capCity = -1;
  if (take) me.capCity = take.capCity;
  else {
    let bd = 1e9;
    for (const ct of G.cities) {
      const d = RA.dist(ct.x - (center % W), ct.y - ((center / W) | 0));
      if (d <= 3.5 && d < bd && G.owner[ct.c] === me.id) {
        bd = d;
        me.capCity = ct.i;
      }
    }
  }
  me.troops = 25000;
  return { ok: true, took: take };
};

/* typical army density (troops per cell) of an average nation on a map with this much land per nation */
RA.typicalDensity = function (landPerNation) {
  const n = Math.max(50, landPerNation);
  return (2 * (RA.dpow(n * 3, 0.56) * 1100 + 50000)) / n;
};

RA.startGame = function (G) {
  // anything replaced stays out of the game
  for (const r of G.replaced) {
    r.alive = false;
    r.spawned = false;
  }
  // denser maps (small regions) get proportionally dearer attacks, so defence keeps the same edge as on the full map
  const nations = G.P.filter((p) => p && p.alive && p.spawned && p.type !== 'bot').length;
  const ref = RA.typicalDensity(162857 / 43);
  G.densScale = RA.clamp(RA.typicalDensity(G.map.landCount / Math.max(1, nations)) / ref, 1, 3);
  if (G.borders) G.densScale *= 1.6;
  G.humans = G.P.filter((p) => p && p.human);
  if (G.opts.gm === 'br') G.zoneInit();
  if (G.opts.res) G.resInit(); // resources and trade (02g-resources.js)
  if (G.opts.camp) G.campSetup(); // a campaign mission (02j-campaign.js)
  G.state = 'play';
  G._history();
};

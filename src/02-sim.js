'use strict';
/* Ratni Atlas — deterministic territory simulation (10 ticks = 1 s at 1x speed) */

RA.CFG = {
  TICK_MS: 100,
  K: 3.2, // one cell ~ several "classic" pixels: scales per-cell attack costs
  NEUTRAL_SLOW: 3.0,
  WIN_SHARE: 0.7,
  ALLY_MAX: 2,
  ALLY_DUR: 3000, // 5 min
  ALLY_REQ_DUR: 200,
  TRAITOR_DUR: 300,
  RECLAIM_TICKS: 1800, // "Vrati granice": land taken from a player in the last 3 minutes can be won back in one move
  BOAT_MAX: 3,
  BOAT_SPEED: 1.15, // cells per tick
  BOAT_RANGE: 800, // longest sea voyage in cells (BFS steps): farther is 'predaleko'
  SEA_CELLS: 300000, // a sea search (boats, trade routes) gives up after this many water cells (big maps)
  FORT_R: 8,
  SAM_R: 28,
  SILO_CD: 100,
  SAM_CD: 75,
  STRUCT_MIN_DIST: 4,
  CITY_T: [0, 12000, 25000, 40000],
  CITY_G: [0, 5, 10, 16],
  PORT_G: 30,
  BARRACKS_T: 160000,
  PEACE: 600, // opening peace: no attacks between states for the first minute
  CITY_BUILT_T: 90000,
  CITY_BUILT_G: 8,
  // aggressive expansion (plan 36): counts states, not land; new war on a state +AE_WAR, a state conquered +AE_FALL;
  // fades (half-life ~4.6 min); from AE_COALITION the computer's states gang up on you
  AE_WAR: 5,
  AE_FALL: 12,
  AE_DECAY: 0.99975,
  AE_COALITION: 50,
  NUKE_CRISIS: 300, // a nuclear hit: 30 s of economic crisis for the target (a minute made games drag on)
  INTEREST: 0.01 / 600, // on a player's saved gold, per tick (1% a minute), at most a quarter of the income
};
/* tax (plan 33): more gold ↔ slower army growth; every state starts at 'Srednji' */
RA.TAX = [
  { name: 'Vrlo nizak', g: 0.6, grow: 1.22 },
  { name: 'Nizak', g: 0.8, grow: 1.1 },
  { name: 'Srednji', g: 1, grow: 1 },
  { name: 'Visok', g: 1.22, grow: 0.86 },
  { name: 'Vrlo visok', g: 1.45, grow: 0.7 },
];

RA.STRUCT = {
  barracks: { name: 'Kasarna', short: 'Kasarna', cost: (n) => Math.min(1.6e6, 125000 * RA.dpow(2, n)), time: 30,
    desc: '+160k maksimalne vojske. Gradi kad si blizu granice kapaciteta.' },
  fort: { name: 'Utvrda', short: 'Utvrda', cost: (n) => Math.min(300000, 60000 * (n + 1)), time: 40,
    desc: 'Napadači u krugu od 8 polja gube 3× više vojske i sporiji su.' },
  port: { name: 'Luka', short: 'Luka', cost: (n) => Math.min(1.5e6, 150000 * RA.dpow(2, n)), time: 50, coastal: true,
    desc: '+300 zlata/s. Gradi se samo na obali.' },
  silo: { name: 'Raketni silos', short: 'Silos', cost: () => 1000000, time: 90,
    desc: 'Omogućava lansiranje nuklearnih bombi.' },
  sam: { name: 'PVO štit', short: 'PVO', cost: (n) => Math.min(3e6, 1200000 * (n + 1)), time: 80,
    desc: 'Obara neprijateljske rakete koje ciljaju u krugu od 28 polja.' },
};
RA.NUKE = {
  atom: { name: 'Atomska bomba', cost: 750000, r1: 5, r2: 9, speed: 3.0 },
  hydro: { name: 'Hidrogenska bomba', cost: 4000000, r1: 13, r2: 19, speed: 2.4 },
};
RA.DIFF = {
  lako: { label: 'Lako', grace: 1500, maxT: 0.6, grow: 0.86, start: 0.6, rate: [80, 120], trig: [0.64, 0.74], nukeAfter: 9000, build: 0.6 },
  srednje: { label: 'Srednje', grace: 900, maxT: 0.82, grow: 0.95, start: 0.8, rate: [55, 85], trig: [0.56, 0.66], nukeAfter: 6000, build: 0.85 },
  tesko: { label: 'Teško', grace: 300, maxT: 1.0, grow: 1.0, start: 1.0, rate: [36, 60], trig: [0.5, 0.6], nukeAfter: 4200, build: 1.0 },
};

RA.Game = class Game {
  constructor(map, opts) {
    this.map = map;
    this.opts = opts;
    this.diff = RA.DIFF[opts.difficulty] || RA.DIFF.srednje;
    this.rng = RA.rng(opts.seed || 12345);
    const N = map.N;
    this.owner = new Uint8Array(N);
    this.cellPos = new Int32Array(N).fill(-1);
    this.fallout = new Uint8Array(N);
    this.falloutList = new RA.IntList(1024);
    this.falloutCount = 0;
    this.falloutDirty = false;
    this.capTick = new Uint8Array(N);
    this.dirty = new RA.IntList(4096);
    this.dirtyFlag = new Uint8Array(N);
    this.inHeap = new Int32Array(N);
    this.structAt = new Int32Array(N).fill(-1);
    this.stamp = new Uint32Array(N);
    this.stampGen = 1;
    this.bfsPrev = new Int32Array(N);
    this.queue = new Int32Array(N);
    this.P = [null];
    this.attacks = [];
    this.boats = [];
    this.missiles = [];
    this.structs = [];
    this.units = [];
    this.planes = [];
    this.trains = [];
    this.mirvCount = 0;
    this.wLevel = 0;
    this.cityNameIdx = 0;
    this.events = [];
    this.feed = []; // world news for the UI (kill feed + diplomacy log): {t, a, b, tick}; never read by the sim
    this.loans = []; // {id, from, to, amount, owed, due, cells} (02c-diplomacy.js)
    this.loanSeq = 0;
    this._warAt = new Map(); // 'a:b' -> tick of the last "war" news between them
    this.fx = []; // visual events for renderer (explosions etc.)
    this.pings = []; // map pings for allies {pid, c, k, tick} (k: RA.PINGS index); the UI shows those of friends
    this.chat = []; // quick messages for allies {pid, m, tick} (m: RA.QUICK_MSGS index)
    this.allyReqs = []; // {from,to,exp}
    this.tradeReqs = [];
    this.tships = [];
    this.tick = 0;
    this.peaceUntil = opts.peace !== undefined ? Math.round(opts.peace * 10) : RA.CFG.PEACE;
    this.era = opts.era || 'danas';
    this.borders = false;
    this.zone = null; // battle royale ring (02e-zone.js)
    this.straitsInit(); // straits and canals (02f-straits.js)
    this.pace = map.pace || 1;
    this.densScale = 1;
    this.state = 'spawn';
    this.nextId = 1;
    this.hist = [];
    this.winner = null;
    this.me = null;
    this.encIdx = 1;
    this.cities = map.cities;
    this.cities.forEach((c) => (c.owner = 0));
  }

  /* ---------------- players ---------------- */
  addPlayer(o) {
    const id = this.P.length;
    if (id > 250) return null;
    const p = {
      id, name: o.name, type: o.type, human: o.type === 'human', team: 0, nick: '', hex: o.color, rgb: RA.hexToRgb(o.color), iso: o.iso || null,
      alive: true, spawned: false, troops: 0, gold: 0, tiles: 0, area: 0, cells: new Int32Array(256), maxT: 1,
      cityT: 0, cityG: 0, nCity: [0, 0, 0, 0],
      n: { barracks: 0, fort: 0, port: 0, silo: 0, sam: 0, airport: 0, city: 0, factory: 0, dome: 0 },
      built: { barracks: 0, fort: 0, port: 0, silo: 0, sam: 0, airport: 0, city: 0, factory: 0, dome: 0 },
      forts: [], bcities: [], units: [], portsOff: 0, mobReady: 0, growPause: 0, crisisUntil: 0, tax: 2, interest: 0, ae: 0, aeWarn: false, lord: 0, tribute: 0, capCity: -1,
      goldRate: 0, growRate: 0, trade: new Set(), nbCache: null, tradeRate: 0, tradeLand: 0, allies: new Map(), traitorUntil: -1, rel: new Float32Array(256), boats: 0,
      lastAttackedBy: 0, attackedAt: -9999, changed: true, peak: 0, capital: -1,
      stats: { conquered: 0, citiesTaken: 0, nukes: 0, kills: 0 }, deathTick: -1, labelCell: -1, ai: null,
    };
    this.P.push(p);
    return p;
  }
  inPeace() {
    return this.tick < this.peaceUntil;
  }
  peaceLeft() {
    return Math.max(0, Math.ceil((this.peaceUntil - this.tick) / 10));
  }
  isFriendly(a, b) {
    return a === b || (a && b && a.allies.has(b.id));
  }
  /* military alliances that count against the limit (a co-op team partner does not) */
  allyCount(p) {
    let n = 0;
    for (const id of p.allies.keys()) if (!(p.team && this.P[id].team === p.team) && p.lord !== id && this.P[id].lord !== p.id) n++; // vassals don't count
    return n;
  }
  sameTeam(a, b) {
    return !!(a && b && a.team && a.team === b.team);
  }
  alivePlayers() {
    return this.P.filter((p) => p && p.alive && p.spawned);
  }

  /* ---------------- cell ownership ---------------- */
  _addCell(p, c) {
    if (p.tiles === p.cells.length) {
      const b = new Int32Array(p.cells.length * 2);
      b.set(p.cells);
      p.cells = b;
    }
    this.cellPos[c] = p.tiles;
    p.cells[p.tiles++] = c;
    p.area += this.map.aw[c];
  }
  _removeCell(p, c) {
    const i = this.cellPos[c];
    const last = p.cells[--p.tiles];
    p.cells[i] = last;
    this.cellPos[last] = i;
    this.cellPos[c] = -1;
    p.area -= this.map.aw[c];
  }
  setOwner(c, pid) {
    const old = this.owner[c];
    if (old === pid) return;
    const P = this.P;
    if (old) {
      this._removeCell(P[old], c);
      P[old].changed = true;
      // a human remembers what was taken from them (for "Vrati granice")
      if (pid && P[old].human) (P[old].lost || (P[old].lost = new Map())).set(c, this.tick);
    }
    if (pid && P[pid].lost) P[pid].lost.delete(c);
    this.owner[c] = pid;
    if (pid) {
      const np = P[pid];
      this._addCell(np, c);
      if (np.area > np.peak) np.peak = np.area;
    }
    this.capTick[c] = this.tick & 255;
    if (!this.dirtyFlag[c]) {
      this.dirtyFlag[c] = 1;
      this.dirty.push(c);
    }
    const ci = this.map.cityAt[c];
    if (ci >= 0) this._cityChange(this.cities[ci], old, pid);
    const si = this.structAt[c];
    if (si >= 0) this._structCaptured(si, pid);
  }
  _cityChange(city, from, to) {
    const T = RA.CFG.CITY_T[city.tier], Gd = RA.CFG.CITY_G[city.tier];
    const P = this.P;
    if (from) {
      P[from].cityT -= T;
      P[from].cityG -= Gd;
      P[from].nCity[city.tier]--;
    }
    city.owner = to;
    if (from && P[from].capCity === city.i && this.state === 'play') this._capitalFell(P[from], to ? P[to] : null, city);
    if (to) {
      P[to].cityT += T;
      P[to].cityG += Gd;
      P[to].nCity[city.tier]++;
      if (this.state === 'play' && from !== to) {
        P[to].stats.citiesTaken++;
        if (city.tier >= 1) this.tell(P[to], 'good', `Osvojen grad: ${city.name}!`, to, city.c);
        if (from) this.tell(P[from], 'bad', `Izgubljen grad: ${city.name} (${P[to].name})`, from, city.c);
      }
    }
  }

  neighbors4(c, out) {
    const W = this.map.W, N = this.map.N;
    let n = 0;
    const x = c % W;
    if (x > 0) out[n++] = c - 1;
    if (x < W - 1) out[n++] = c + 1;
    if (c >= W) out[n++] = c - W;
    if (c < N - W) out[n++] = c + W;
    return n;
  }

  /* ---------------- spawning ---------------- */
  spawnDisk(p, center, r) {
    const W = this.map.W, H = this.map.H;
    const cx = center % W, cy = (center / W) | 0;
    let n = 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const c = y * W + x;
        if (!this.map.land[c] || this.owner[c]) continue;
        this.setOwner(c, p.id);
        n++;
      }
    p.spawned = n > 0;
    p.capital = center;
    return n;
  }
  unspawn(p) {
    const cells = Array.from(p.cells.subarray(0, p.tiles));
    cells.forEach((c) => this.setOwner(c, 0));
    p.spawned = false;
  }

  /* ---------------- economy ---------------- */
  /* a player's land in average cells: its real area (map.aw) scaled so the whole map keeps its cell count */
  landCells(p) {
    return (p.area * this.map.landCount) / this.map.landArea;
  }
  /* shares of the map are measured against the win target: on a map won with less land (meta.winShare) a share
     counts for more, so the rules against a giant (start army, attack cost from 35%, AI coalitions) start earlier */
  shareK() {
    const M = this.map.region ? {} : this.map.meta || {};
    return M.winShare > 0 ? RA.CFG.WIN_SHARE / M.winShare : 1;
  }
  computeMax(p) {
    const land = 2 * (RA.dpow(this.landCells(p) * 3, 0.56) * 1100 + 50000);
    // cities add at most half of the land-based army, so a city-rich empire cannot snowball
    const base = land + Math.min(p.cityT, land * 0.5) + p.n.barracks * RA.CFG.BARRACKS_T + p.n.city * RA.CFG.CITY_BUILT_T;
    if (p.type === 'bot') return base / 3;
    if (p.type === 'nation') return base * this.diff.maxT;
    return base;
  }
  economy(p) {
    const maxT = (p.maxT = this.computeMax(p));
    const tk = this.tick;
    let add = (10 + RA.dpow(Math.max(0, p.troops), 0.73) / 4) * (1 - p.troops / maxT);
    add *= 1 + 0.04 * Math.min(10, p.n.city);
    if (p.type === 'bot') add *= 0.5;
    else if (p.type === 'nation') add *= this.diff.grow;
    if (p.crisisUntil > tk) add *= 0.7;
    const tax = RA.TAX[p.tax] || RA.TAX[2];
    if (add > 0) add *= tax.grow;
    if (add > 0 && this.deps && !this.hasRes(p, 0)) add *= RA.CFG.RES_FOOD; // no grain
    if (p.growPause > tk && add > 0) add = 0;
    if (p.troops > maxT) add = -(p.troops - maxT) * (p.growPause > tk ? 0.0025 : 0.01);
    p.troops = Math.max(0, p.troops + add);
    if (p.ae > 0.05) {
      p.ae *= RA.CFG.AE_DECAY;
      if (p.aeWarn && p.ae < RA.CFG.AE_COALITION * 0.75) {
        p.aeWarn = false;
        this.tell(p, 'good', 'Svijet se smirio: koalicija protiv tebe se raspada.', p.id);
      }
    } else p.ae = 0;
    let g = 70 + Math.sqrt(p.tiles) * 1.2 + p.cityG + (p.n.port - p.portsOff) * RA.CFG.PORT_G + p.n.city * RA.CFG.CITY_BUILT_G;
    if (p.type === 'bot') g *= 0.4;
    if (p.crisisUntil > tk) g *= 0.5;
    g *= tax.g;
    if (p.imp && (p.imp[0] || p.imp[1] || p.imp[2])) g = this._payRes(p, g); // bought resources
    // interest on a player's saved gold, capped at a quarter of the income (saving helps, never beats owning land);
    // the computer spends as it goes, and interest made its wars drag on
    const it = p.human && p.gold > 0 ? Math.min(p.gold * RA.CFG.INTEREST, g * 0.25) : 0;
    p.interest = it * 10;
    if (p.lord) {
      // a vassal's tribute
      const t = g * RA.CFG.TRIBUTE, L = this.P[p.lord];
      g -= t;
      L.gold += t;
      L.tributeIn = (L.tributeIn || 0) + t;
      p.tribute = t * 10;
    }
    p.gold += g + it;
    p.goldRate = (g + it) * 10 + (p.trainRate || 0) + (p.tradeRate || 0) + (p.tributeRate || 0) + (p.resRateIn || 0);
    p.growRate = add * 10;
  }

  /* ---------------- events ---------------- */
  /* UI messages. `to` = the human player who should see it (0 = every human). The sim never reads them. */
  event(kind, text, pid, cell, to) {
    this.events.push({ kind, text, pid: pid || 0, cell: cell === undefined ? -1 : cell, tick: this.tick, to: to || 0 });
  }
  tell(p, kind, text, pid, cell) {
    if (p && p.human) this.event(kind, text, pid, cell, p.id);
  }
  tellAll(kind, text, pid, cell) {
    this.event(kind, text, pid, cell, 0);
  }
  /* world news between two states (city-states left out): war, fall, ally, break, ally-end, trade */
  news(t, a, b, x) {
    const A = this.P[a], B = b ? this.P[b] : null;
    if (!A || A.type === 'bot' || (B && B.type === 'bot')) return;
    if (this.feed.length > 200) this.feed.splice(0, 100);
    this.feed.push({ t, a, b: b || 0, tick: this.tick, x });
  }

  /* ---------------- attacks ---------------- */
  hasBorderWith(p, tid) {
    // does player p touch owner tid (0 = neutral land) by land?
    const own = this.owner, land = this.map.land, W = this.map.W, N = this.map.N;
    const cells = p.cells;
    for (let i = 0; i < p.tiles; i++) {
      const c = cells[i];
      const x = c % W;
      if (x > 0 && land[c - 1] && own[c - 1] === tid) return true;
      if (x < W - 1 && land[c + 1] && own[c + 1] === tid) return true;
      if (c >= W && land[c - W] && own[c - W] === tid) return true;
      if (c < N - W && land[c + W] && own[c + W] === tid) return true;
    }
    return false;
  }

  /* dir: a directed attack (a player's tap on a state): it starts from the own border cell nearest to the focus and
     only takes a corridor from there to the focus plus a disc around it (width grows with the troops sent), then the
     rest of the army comes home. Without dir the whole common border is the front (the AI, "cijela granica"). */
  launchAttack(aid, tid, troops, focusCell, sourceCell, dir, from, only) {
    const A = this.P[aid];
    if (!A || !A.alive || aid === tid) return null;
    const T = tid ? this.P[tid] : null;
    if (T && (!T.alive || this.isFriendly(A, T))) return null;
    if (T && this.tick < this.peaceUntil) return null;
    troops = Math.floor(Math.min(troops, sourceCell >= 0 ? troops : A.troops));
    if (troops < 1) return null;
    if (!(sourceCell >= 0)) A.troops -= troops;
    sourceCell = sourceCell >= 0 ? sourceCell : -1;

    // opposing attacks cancel out
    if (T && sourceCell < 0) {
      for (const o of this.attacks) {
        if (o.done || o.a !== tid || o.t !== aid || o.boat) continue;
        if (o.troops > troops) {
          o.troops -= troops;
          return o;
        }
        troops -= o.troops;
        o.troops = 0;
        o.done = true;
      }
      if (troops < 1) return null;
    }
    // a directed attack: its own corridor (never merged: two taps are two thrusts)
    let corr = null;
    if (dir && T && sourceCell < 0 && focusCell >= 0) corr = this._corridor(A, T, focusCell, troops, from);
    // merge with existing land attack on same target
    if (sourceCell < 0 && !corr && !only) {
      for (const o of this.attacks) {
        if (!o.done && o.a === aid && o.t === tid && !o.boat && !o.corr && !o.only) {
          o.troops += troops;
          if (focusCell >= 0) o.focus = focusCell;
          o.fresh = true;
          return o;
        }
      }
    }
    const att = {
      id: this.nextId++, a: aid, t: tid, troops, start: troops, heap: new RA.Heap(512), pending: 0,
      focus: focusCell >= 0 ? focusCell : -1, done: false, boat: sourceCell >= 0, src: sourceCell, fresh: true, began: this.tick,
      corr,
      only: only || null, // "Vrati granice": only these cells (the land tid took from aid)
      via: T && A.human && sourceCell < 0 ? this._viaOf(A, T) : null, // right of passage: allies whose border with T is a front too
    };
    this.attacks.push(att);
    if (sourceCell >= 0) {
      this._push(att, sourceCell, -1, -1);
    } else {
      this._refill(att);
    }
    if (T) {
      if (A.trade.has(T.id)) this.cancelTrade(A.id, T.id, 'rat');
      this._callAllies(A, T);
      T.rel[aid] = Math.max(-100, T.rel[aid] - (T.type === 'nation' ? 30 : 15));
      T.lastAttackedBy = aid;
      T.attackedAt = this.tick;
      // cancel pending alliance requests between them
      this.allyReqs = this.allyReqs.filter((r) => !((r.from === aid && r.to === tid) || (r.from === tid && r.to === aid)));
      if (!att.boat) this.tell(T, 'bad', `${A.name} te napada!`, aid, focusCell);
      // news: a new war (not every thrust): once per pair per minute
      const wk = aid + ':' + tid, last = this._warAt.get(wk);
      if (last === undefined || this.tick - last > 600) this.news('war', aid, tid);
      if (T.type === 'nation' && A.type !== 'bot' && (last === undefined || this.tick - last > 3000)) this.addAE(A, RA.CFG.AE_WAR);
      this._warAt.set(wk, this.tick);
    }
    return att;
  }

  /* right of passage (a human's military allies): allies that touch T and are not T's allies; their border with T
     is a front for A's attacks on T (the land taken becomes A's) */
  _viaOf(A, T) {
    const via = [];
    for (const oid of A.allies.keys()) {
      const O = this.P[oid];
      if (O && O.alive && O !== T && !O.allies.has(T.id) && this.hasBorderWith(O, T.id)) via.push(oid);
    }
    return via.length ? via : null;
  }
  /* the corridor of a directed attack: from the own border cell (next to T) nearest to the focus to the focus;
     from = an own cell the player drew the arrow from (desktop right-drag): the corridor starts there if it crosses
     the common border, else the nearest border cell is used */
  _corridor(A, T, focus, troops, from) {
    const own = this.owner, W = this.map.W, N = this.map.N, cells = A.cells;
    const fx = focus % W, fy = (focus / W) | 0;
    const dens = Math.max(1, T.troops / Math.max(1, T.tiles));
    const r = RA.clamp(Math.sqrt(troops / dens) * 0.45, 3, 14);
    const edge = (c) => {
      const x = c % W;
      return (x > 0 && own[c - 1] === T.id) || (x < W - 1 && own[c + 1] === T.id) || (c >= W && own[c - W] === T.id) || (c < N - W && own[c + W] === T.id);
    };
    if (from >= 0 && own[from] === A.id) {
      const k = { sx: from % W, sy: (from / W) | 0, fx, fy, r2: r * r, e2: r * r * 2.56 };
      for (let i = 0; i < A.tiles; i++) if (edge(cells[i]) && this._inCorr(k, cells[i])) return k;
    }
    let best = -1, bd = Infinity;
    const via = A.human ? this._viaOf(A, T) : null;
    const froms = via ? [A].concat(via.map((id) => this.P[id])) : [A];
    for (const F of froms)
    for (let i = 0, cs = F.cells; i < F.tiles; i++) {
      const c = cs[i];
      if (!edge(c)) continue;
      const dx = (c % W) - fx, dy = ((c / W) | 0) - fy, d = dx * dx + dy * dy;
      if (d < bd || (d === bd && c < best)) (bd = d), (best = c);
    }
    if (best < 0) return null;
    // width: how many of T's cells the troops are worth (T's army spread over its land)
    return { sx: best % W, sy: (best / W) | 0, fx, fy, r2: r * r, e2: r * r * 2.56 };
  }
  /* is a cell inside a directed attack's corridor (segment start-focus within r, or within 1.6 r of the focus) */
  _inCorr(k, c) {
    const W = this.map.W, x = c % W, y = (c / W) | 0;
    const ex = x - k.fx, ey = y - k.fy;
    if (ex * ex + ey * ey <= k.e2) return true;
    const vx = k.fx - k.sx, vy = k.fy - k.sy, L = vx * vx + vy * vy;
    let t = L > 0 ? ((x - k.sx) * vx + (y - k.sy) * vy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - (k.sx + t * vx), dy = y - (k.sy + t * vy);
    return dx * dx + dy * dy <= k.r2;
  }

  /* Frontier priority = arrival time (Dijkstra-like): parent's time + travel cost of this cell.
     Plains are quick, hills/mountains/rivers slow, a smooth noise field makes fronts organic,
     and the focus point pulls the front towards where the player tapped. */
  _push(att, c, base, parent) {
    if (this.zone && this.zoneOut(c)) return;
    if (att.corr && !this._inCorr(att.corr, c)) return;
    if (att.only && !att.only.has(c)) return;
    const own = this.owner, W = this.map.W, N = this.map.N;
    let k = 0;
    const x = c % W;
    if (x > 0 && own[c - 1] === att.a) k++;
    if (x < W - 1 && own[c + 1] === att.a) k++;
    if (c >= W && own[c - W] === att.a) k++;
    if (c < N - W && own[c + W] === att.a) k++;
    const t = this.map.terr[c];
    let mag = t === 1 ? 1 : t === 2 ? 1.8 : 2.8;
    if (this.map.river[c]) mag += 1.1;
    let cost = (0.55 + this.map.noise[c] * 1.9 + this.rng() * 0.45) * mag;
    if (k >= 3) cost *= 0.15;
    else if (k === 2) cost *= 0.5;
    let pri = (base === undefined || base === null ? this.tick : base) + cost;
    if (att.focus >= 0) {
      const fx = att.focus % W, fy = (att.focus / W) | 0;
      const d = RA.dist(x - fx, ((c / W) | 0) - fy);
      const dp = parent >= 0 ? RA.dist((parent % W) - fx, ((parent / W) | 0) - fy) : 0;
      pri += (parent >= 0 ? d - dp : d * 0.08) * 0.62;
    }
    if (base === -1) pri = -1;
    if (this.inHeap[c] !== att.id) {
      this.inHeap[c] = att.id;
      att.pending++;
    }
    att.heap.push(c, pri);
  }

  _refill(att) {
    const A = this.P[att.a];
    const own = this.owner, land = this.map.land, W = this.map.W, N = this.map.N;
    const tid = att.t;
    const h = att.heap;
    for (let i = 0; i < h.n; i++) if (this.inHeap[h.v[i]] === att.id) this.inHeap[h.v[i]] = 0;
    h.clear();
    att.pending = 0;
    const froms = att.via ? [A].concat(att.via.map((id) => this.P[id]).filter((o) => o && o.alive)) : [A];
    for (const F of froms)
    for (let i = 0, cells = F.cells; i < F.tiles; i++) {
      const c = cells[i];
      const x = c % W;
      if (x > 0 && land[c - 1] && own[c - 1] === tid && this.inHeap[c - 1] !== att.id) this._push(att, c - 1, null, -1);
      if (x < W - 1 && land[c + 1] && own[c + 1] === tid && this.inHeap[c + 1] !== att.id) this._push(att, c + 1, null, -1);
      if (c >= W && land[c - W] && own[c - W] === tid && this.inHeap[c - W] !== att.id) this._push(att, c - W, null, -1);
      if (c < N - W && land[c + W] && own[c + W] === tid && this.inHeap[c + W] !== att.id) this._push(att, c + W, null, -1);
    }
    // reset stamps for next refill
    return att.heap.size > 0;
  }

  fortified(T, c) {
    if (!T.forts.length) return false;
    const W = this.map.W;
    const x = c % W, y = (c / W) | 0;
    const R2 = RA.CFG.FORT_R * RA.CFG.FORT_R;
    for (const f of T.forts) {
      if (f.empUntil > this.tick) continue;
      const dx = f.x - x, dy = f.y - y;
      if (dx * dx + dy * dy <= R2) return true;
    }
    return false;
  }

  _stepAttack(att) {
    const A = this.P[att.a];
    const T = att.t ? this.P[att.t] : null;
    if (!A.alive) {
      att.done = true;
      return;
    }
    if (T && (!T.alive || this.isFriendly(A, T))) {
      this._endAttack(att, 0);
      return;
    }
    const own = this.owner, land = this.map.land, terr = this.map.terr, river = this.map.river, W = this.map.W, N = this.map.N;
    const fall = this.fallout;
    const front = Math.max(1, att.pending) + this.rng.int(0, 4);
    let budget = 1;
    let guard = 0;
    const traitor = T && T.traitorUntil > this.tick;
    while (budget > 0 && guard++ < 900) {
      if (att.troops < 1) {
        att.done = true;
        return;
      }
      if (att.heap.size === 0) {
        if (!this._refill(att)) {
          this._endAttack(att, 0);
          return;
        }
      }
      const pc = Math.max(this.tick - 30, att.heap.p[0]);
      const c = att.heap.pop();
      if (this.inHeap[c] === att.id) {
        this.inHeap[c] = 0;
        att.pending--;
      }
      if (own[c] !== att.t || !land[c]) continue;
      if (this.zone && this.zoneOut(c)) continue;
      const x = c % W;
      if (!att.boat || att.src !== c) {
        const V = att.via, ok = (o) => o === att.a || (V !== null && V.includes(o));
        if (!((x > 0 && ok(own[c - 1])) || (x < W - 1 && ok(own[c + 1])) || (c >= W && ok(own[c - W])) || (c < N - W && ok(own[c + W])))) continue;
      }
      // cost model
      const t = terr[c];
      let mag = t === 1 ? 80 : t === 2 ? 100 : 125;
      let spd = t === 1 ? 16.5 : t === 2 ? 21 : 27;
      if (river[c]) {
        mag *= 1.3;
        spd *= 1.35;
      }
      if (fall[c]) {
        const f = 1 + (fall[c] / 255) * 3;
        mag *= f;
        spd *= f;
      }
      if (this.wLevel > 0 && this.isSnow(c)) {
        mag *= 1 + 0.6 * this.wLevel;
        spd *= 1 + 0.9 * this.wLevel;
      }
      let lossA, lossD = 0, frac;
      if (!T) {
        lossA = (mag * RA.CFG.K) / (A.type === 'bot' ? 10 : 5);
        frac = (RA.clamp((2000 * spd) / att.troops, 5, 100) / (front * 2)) * RA.CFG.NEUTRAL_SLOW;
      } else {
        if (this.fortified(T, c)) {
          mag *= 3.2;
          spd *= 2.4;
        }
        const ui = this.map.urban[c];
        if (ui >= 0) {
          const ct = this.cities[ui];
          if (ct.owner === att.t) {
            const f = 1 + 0.45 * ct.tier;
            mag *= f;
            spd *= f;
          }
        } else if (T.bcities.length) {
          const cx0 = c % W, cy0 = (c / W) | 0;
          for (const bc of T.bcities) {
            if ((bc.x - cx0) * (bc.x - cx0) + (bc.y - cy0) * (bc.y - cy0) <= 7) {
              mag *= 1.45;
              spd *= 1.45;
              break;
            }
          }
        }
        if (T.units.length || A.units.length) {
          this.unitMods(A, T, c, att.troops);
          mag *= this._umMag;
          spd *= this._umSpd;
        }
        const ratio = T.troops / Math.max(1, att.troops);
        const dens = T.troops / Math.max(1, T.tiles);
        let lm = traitor ? 0.5 : 1;
        if (T.type === 'bot' && A.type !== 'bot') lm *= 0.7;
        // whoever holds more than 35% of the map pays more for every further conquest (no runaway winner)
        const L = this.leader;
        if (L && L.id === A.id && L.share > 0.35) lm *= 1 + (L.share - 0.35) * 2;
        lossA = mag * RA.clamp(ratio, 0.7, 2) * (0.463 * RA.CFG.K * this.densScale + 0.0078 * dens) * lm;
        lossD = dens;
        frac = (((RA.clamp(ratio, 0.82, 7.5) * Math.max(1, ratio / 20)) / 8.5) * spd * (traitor ? 0.8 : 1) * this.pace) / front;
      }
      if (lossA > att.troops) {
        att.troops = 0;
        att.done = true;
        return;
      }
      att.troops -= lossA;
      budget -= frac;
      if (T) T.troops = Math.max(0, T.troops - lossD);
      this.setOwner(c, att.a);
      A.stats.conquered++;
      // push neighbours owned by target
      if (x > 0 && land[c - 1] && own[c - 1] === att.t) this._push(att, c - 1, pc, c);
      if (x < W - 1 && land[c + 1] && own[c + 1] === att.t) this._push(att, c + 1, pc, c);
      if (c >= W && land[c - W] && own[c - W] === att.t) this._push(att, c - W, pc, c);
      if (c < N - W && land[c + W] && own[c + W] === att.t) this._push(att, c + W, pc, c);
      if (T && T.tiles > 0 && T.tiles < 9) {
        this._annihilate(T, A);
        this._endAttack(att, 0);
        return;
      }
    }
  }

  _annihilate(T, A) {
    const cells = Array.from(T.cells.subarray(0, T.tiles));
    for (const c of cells) this.setOwner(c, A.id);
    A.troops += T.troops * 0.5;
    A.gold += T.human ? T.gold / 2 : T.gold;
    T.gold = 0;
    T.troops = 0;
  }

  _endAttack(att, malus) {
    if (att.done) return;
    att.done = true;
    const A = this.P[att.a];
    if (A && A.alive) A.troops += att.troops * (1 - malus);
    att.troops = 0;
  }
  retreat(attId) {
    const att = this.attacks.find((a) => a.id === attId && !a.done);
    if (!att) return;
    this._endAttack(att, att.t ? 0.25 : 0);
  }

  /* ---------------- boats ---------------- */
  findBoatPath(pid, tgt) {
    // BFS over water from target coast towards any water cell next to pid's land (null: no way, 'far': too far)
    const map = this.map, W = map.W, H = map.H, N = map.N, land = map.land, own = this.owner, block = map.block, stc = this.stc;
    const seen = this.stamp, gen = ++this.stampGen, prev = this.bfsPrev, q = this.queue;
    const maxD = RA.CFG.BOAT_RANGE, maxN = RA.CFG.SEA_CELLS;
    let qh = 0, qt = 0, depth = 0, layer = 0;
    const tx = tgt % W, ty = (tgt / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx, y = ty + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const c = y * W + x;
        if (land[c] || block[c] || seen[c] === gen) continue;
        seen[c] = gen;
        prev[c] = -1;
        q[qt++] = c;
      }
    // a coast on another sea (lake, closed basin) cannot be reached: skip the search (on a big map it floods an ocean)
    if (!this._sharesWater(pid, q, qt)) return null;
    layer = qt;
    while (qh < qt) {
      if (qh === layer) {
        if (++depth > maxD || qt > maxN) return 'far';
        layer = qt;
      }
      const c = q[qh++];
      const x = c % W, y = (c / W) | 0;
      // departure check
      let dep = -1;
      if (x > 0 && land[c - 1] && own[c - 1] === pid) dep = c - 1;
      else if (x < W - 1 && land[c + 1] && own[c + 1] === pid) dep = c + 1;
      else if (y > 0 && land[c - W] && own[c - W] === pid) dep = c - W;
      else if (y < H - 1 && land[c + W] && own[c + W] === pid) dep = c + W;
      if (dep >= 0) {
        const path = [];
        let k = c;
        while (k !== -1) {
          path.push(k);
          k = prev[k];
        }
        return { path, dep };
      }
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (block[n] || seen[n] === gen || !(stc[n] ? this.seaFor(n, pid) : !land[n])) continue;
          if (dx && dy && (!this.seaFor(y * W + nx, pid) || !this.seaFor(ny * W + x, pid))) continue;
          seen[n] = gen;
          prev[n] = c;
          q[qt++] = n;
        }
    }
    return null;
  }
  /* does player pid own land next to one of the water components of these start cells? (4-connected components:
     the boat search never crosses between them either) */
  _sharesWater(pid, cells, n) {
    const map = this.map, W = map.W, H = map.H, wr = this.wroot, land = map.land;
    const want = new Set(), wcomp = map.wcomp; // water components joined by straits are one sea (wroot)
    const wc = (k) => (wcomp[k] >= 0 ? wr[wcomp[k]] : -1);
    for (let i = 0; i < n; i++) if (wcomp[cells[i]] >= 0) want.add(wc(cells[i]));
    const p = this.P[pid];
    for (let i = 0; i < p.tiles; i++) {
      const c = p.cells[i];
      const x = c % W, y = (c / W) | 0;
      if ((x > 0 && !land[c - 1] && want.has(wc(c - 1))) || (x < W - 1 && !land[c + 1] && want.has(wc(c + 1))) || (y > 0 && !land[c - W] && want.has(wc(c - W))) || (y < H - 1 && !land[c + W] && want.has(wc(c + W)))) return true;
    }
    return false;
  }

  launchBoat(pid, tgtCell, troops) {
    const p = this.P[pid];
    if (!p || !p.alive) return 'dead';
    if (!this.map.land[tgtCell]) return 'water';
    if (!this.map.coast[tgtCell]) return 'nocoast';
    if (this.zone && this.zoneOut(tgtCell)) return 'zone';
    if (this.owner[tgtCell] === pid) return 'own';
    const tp = this.P[this.owner[tgtCell]];
    if (tp && this.isFriendly(p, tp)) return 'ally';
    if (tp && this.tick < this.peaceUntil) return 'peace';
    if (p.boats >= RA.CFG.BOAT_MAX) return 'max';
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 50) return 'troops';
    const r = this.findBoatPath(pid, tgtCell);
    if (!r) return 'nopath';
    if (r === 'far') return 'far';
    p.troops -= troops;
    p.boats++;
    const path = r.path;
    const b = { id: this.nextId++, owner: pid, troops, path, pos: 0, tgt: tgtCell, dep: r.dep, done: false, born: this.tick };
    this.boats.push(b);
    if (tp) this.tell(tp, 'bad', `${p.name} šalje desant na tvoju obalu!`, pid, tgtCell);
    if (tp) {
      tp.rel[pid] = Math.max(-100, tp.rel[pid] - 20);
    }
    return b;
  }

  _stepBoat(b) {
    const p = this.P[b.owner];
    if (!p.alive) {
      b.done = true;
      return;
    }
    b.pos += RA.CFG.BOAT_SPEED;
    if (b.pos >= b.path.length - 1) {
      b.done = true;
      p.boats--;
      const o = this.owner[b.tgt];
      if (o === b.owner) {
        p.troops += b.troops;
        return;
      }
      const T = o ? this.P[o] : null;
      if (this.zone && this.zoneOut(b.tgt)) {
        p.troops += b.troops;
        this.tell(p, 'info', 'Obala je u međuvremenu progutala radioaktivna zona — desant se vratio kući.', o, b.tgt);
        return;
      }
      if (T && (this.isFriendly(p, T) || this.tick < this.peaceUntil)) {
        p.troops += b.troops;
        if (!this.isFriendly(p, T)) this.tell(p, 'info', 'Mirno doba — obala je u međuvremenu zauzeta, desant se vratio kući.', o, b.tgt);
        return;
      }
      this.launchAttack(b.owner, o, b.troops, b.tgt, b.tgt);
      if (T) this.tell(T, 'bad', `${p.name} se iskrcao na tvoju obalu!`, b.owner, b.tgt);
    }
  }

  /* ---------------- structures ---------------- */
  structCost(p, type) {
    const c = RA.STRUCT[type].cost(p.built[type]);
    return this.deps && !this.hasRes(p, 2) ? Math.round(c * RA.CFG.RES_DEAR) : c; // no fuel
  }
  canBuild(p, type, c) {
    const map = this.map;
    if (RA.STRUCT[type].na) return 'To se u ovom dobu ne gradi.';
    if (c < 0 || this.owner[c] !== p.id) return 'Moraš graditi na svojoj teritoriji.';
    if (!map.land[c]) return 'Ne može na vodi.';
    if (this.fallout[c] > 20) return 'Teren je radioaktivan.';
    if (RA.STRUCT[type].coastal && !map.coast[c]) {
      // allow within 1 cell of coast
      const W = map.W;
      let ok = false;
      for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < map.N && map.coast[n] && this.owner[n] === p.id) ok = n;
      if (ok === false) return 'Luka mora biti na obali.';
      c = ok;
    }
    const W = map.W, H = map.H, x = c % W, y = (c / W) | 0, R = RA.CFG.STRUCT_MIN_DIST;
    // spacing: look at the cells around (structAt), not at every building on the map
    for (let dy = 1 - R; dy < R; dy++)
      for (let dx = 1 - R; dx < R; dx++) {
        const sx = x + dx, sy = y + dy;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H || dx * dx + dy * dy >= R * R) continue;
        const si = this.structAt[sy * W + sx];
        if (si >= 0 && !this.structs[si].dead) return 'Preblizu drugoj zgradi.';
      }
    if (type === 'city') {
      for (const ct of this.cities) if ((ct.x - x) * (ct.x - x) + (ct.y - y) * (ct.y - y) < 25) return 'Preblizu postojećem gradu.';
    }
    if (p.gold < this.structCost(p, type)) return 'Nemaš dovoljno zlata.';
    return c;
  }
  build(pid, type, c) {
    const p = this.P[pid];
    const r = this.canBuild(p, type, c);
    if (typeof r === 'string') return r;
    c = r;
    const cost = this.structCost(p, type);
    p.gold -= cost;
    p.built[type]++;
    const W = this.map.W;
    const s = { id: this.structs.length, type, owner: pid, c, x: c % W, y: (c / W) | 0, doneAt: this.tick + RA.STRUCT[type].time, ready: false, cd: 0, dead: false, empUntil: 0 };
    if (type === 'city') s.name = RA.CITY_NAMES[this.cityNameIdx++ % RA.CITY_NAMES.length];
    this.structs.push(s);
    this.structAt[c] = s.id;
    return s;
  }
  _structCaptured(si, pid) {
    const s = this.structs[si];
    if (s.dead) return;
    const old = this.P[s.owner];
    if (s.ready) {
      old.n[s.type]--;
      if (s.type === 'fort') old.forts = old.forts.filter((f) => f !== s);
      if (s.type === 'city') old.bcities = old.bcities.filter((f) => f !== s);
    }
    old.built[s.type] = Math.max(0, old.built[s.type] - 1);
    if (!pid || s.type === 'fort' || !s.ready) {
      s.dead = true;
      this.structAt[s.c] = -1;
      return;
    }
    s.owner = pid;
    const np = this.P[pid];
    np.n[s.type]++;
    np.built[s.type]++;
    if (s.type === 'city') np.bcities.push(s);
    s.linksAt = 0;
    this.tell(np, 'good', `Zarobio si: ${s.type === 'city' ? 'grad ' + s.name : RA.STRUCT[s.type].name}`, pid, s.c);
    this.tell(old, 'bad', `Izgubio si: ${s.type === 'city' ? 'grad ' + s.name : RA.STRUCT[s.type].name}`, pid, s.c);
  }
  _destroyStruct(s) {
    if (s.dead) return;
    const p = this.P[s.owner];
    if (s.ready) {
      p.n[s.type]--;
      if (s.type === 'fort') p.forts = p.forts.filter((f) => f !== s);
      if (s.type === 'city') p.bcities = p.bcities.filter((f) => f !== s);
    }
    p.built[s.type] = Math.max(0, p.built[s.type] - 1);
    s.dead = true;
    this.structAt[s.c] = -1;
  }

  _decayFallout() {
    if (!this.falloutCount) return;
    const L = this.falloutList, f = this.fallout;
    let w = 0;
    for (let i = 0; i < L.n; i++) {
      const c = L.a[i];
      const v = f[c] - 3; // ~85 s from the core of a blast
      if (v <= 0) {
        f[c] = 0;
        this.falloutCount -= this.map.aw[c];
      } else {
        f[c] = v;
        L.a[w++] = c;
      }
    }
    L.n = w;
    this.falloutDirty = true;
  }

  /* ---------------- diplomacy ---------------- */
  requestAlliance(fromId, toId) {
    const a = this.P[fromId], b = this.P[toId];
    if (!a || !b || !a.alive || !b.alive || a === b) return 'Nevažeći igrač.';
    if (a.allies.has(toId)) return 'Već ste saveznici.';
    if (a.lord || b.lord) return a.lord ? 'Vazal ne sklapa saveze.' : `${b.name} je vazal (${this.P[b.lord].name}) — ne sklapa saveze.`;
    if (this.allyCount(a) >= RA.CFG.ALLY_MAX) return `Možeš imati najviše ${RA.CFG.ALLY_MAX} saveza.`;
    if (this.allyCount(b) >= RA.CFG.ALLY_MAX) return `${b.name} već ima ${RA.CFG.ALLY_MAX} saveza.`;
    if (this.allyReqs.some((r) => r.from === fromId && r.to === toId)) return 'Zahtjev je već poslan.';
    if (b.human && !b.ai) {
      this.allyReqs.push({ from: fromId, to: toId, exp: this.tick + RA.CFG.ALLY_REQ_DUR });
      this.tell(b, 'offer', `${a.name} nudi vojni savez.`, fromId, a.capital);
      return true;
    }
    const ok = RA.AI.considerAlliance(this, b, a);
    if (ok) {
      this.makeAlliance(a, b);
      return true;
    }
    this.tell(a, 'info', `Ponuda za vojni savez odbijena (${b.name}).`, toId, b.capital);
    b.rel[fromId] = Math.min(100, b.rel[fromId] + 3);
    return 'declined';
  }
  respondAlliance(fromId, toId, accept) {
    const i = this.allyReqs.findIndex((r) => r.from === fromId && r.to === toId);
    if (i < 0) return;
    this.allyReqs.splice(i, 1);
    const a = this.P[fromId], b = this.P[toId];
    if (!accept) {
      a.rel[toId] = Math.max(-100, a.rel[toId] - 10);
      this.tell(a, 'info', `Ponuda za vojni savez odbijena (${b.name}).`, toId, b.capital);
      return;
    }
    if (this.allyCount(a) >= RA.CFG.ALLY_MAX || this.allyCount(b) >= RA.CFG.ALLY_MAX) {
      this.tell(a, 'info', 'Savez nije moguć — dostignut limit saveza.', toId);
      this.tell(b, 'info', 'Savez nije moguć — dostignut limit saveza.', fromId);
      return;
    }
    this.makeAlliance(a, b);
  }
  makeAlliance(a, b) {
    const exp = this.tick + RA.CFG.ALLY_DUR;
    a.allies.set(b.id, exp);
    b.allies.set(a.id, exp);
    a.rel[b.id] = Math.min(100, a.rel[b.id] + 30);
    b.rel[a.id] = Math.min(100, b.rel[a.id] + 30);
    for (const att of this.attacks) {
      if (att.done) continue;
      if ((att.a === a.id && att.t === b.id) || (att.a === b.id && att.t === a.id)) this._endAttack(att, 0);
    }
    this.allyReqs = this.allyReqs.filter((r) => !((r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id)));
    this.news('ally', a.id, b.id);
    this.tell(a, 'good', `Vojni savez sklopljen: ${b.name} (5 min).`, b.id, b.capital);
    this.tell(b, 'good', `Vojni savez sklopljen: ${a.name} (5 min).`, a.id, a.capital);
    this.alliancesChanged = true;
  }
  breakAlliance(aid, bid, betrayal) {
    const a = this.P[aid], b = this.P[bid];
    if (!a.allies.has(bid) || this.sameTeam(a, b)) return;
    if (b.lord === aid) return this.freeVassal(b, 'free'); // the lord lets its vassal go (no betrayal)
    if (a.lord === bid) return this.freeVassal(a, 'rebel');
    a.allies.delete(bid);
    b.allies.delete(aid);
    this.alliancesChanged = true;
    if (betrayal !== false) {
      this.news('break', aid, bid);
      if (!(b.traitorUntil > this.tick)) a.traitorUntil = this.tick + RA.CFG.TRAITOR_DUR;
      b.rel[aid] = -100;
      for (const o of this.P) if (o && o.alive && o !== a && o !== b && !o.human) o.rel[aid] = Math.max(-100, o.rel[aid] - 35);
      this.tell(b, 'bad', `${a.name} te je izdao!`, aid, a.capital);
      this.tell(a, 'bad', `Izdaja! Raskinuo si savez (${b.name}). Odbrana ti je prepolovljena 30 s.`, bid);
    }
  }
  extendAlliance(aid, bid) {
    const a = this.P[aid], b = this.P[bid];
    if (!a.allies.has(bid)) return 'Niste saveznici.';
    if (this.sameTeam(a, b) || a.lord === bid || b.lord === aid) return true;
    const ok = !b.ai ? true : RA.AI.considerExtension(this, b, a);
    if (!ok) return `${b.name} ne želi produžiti savez.`;
    const exp = this.tick + RA.CFG.ALLY_DUR;
    a.allies.set(bid, exp);
    b.allies.set(aid, exp);
    return true;
  }
  _expireAlliances() {
    for (const p of this.P) {
      if (!p || !p.alive) continue;
      if (p.traitorUntil > this.tick - 10 && p.traitorUntil <= this.tick) this.alliancesChanged = true; // traitor stripes end
      if (p.lost && this.tick % 50 === 0) for (const [c, t] of p.lost) if (t < this.tick - RA.CFG.RECLAIM_TICKS) p.lost.delete(c);
      for (const [oid, exp] of p.allies) {
        if (exp <= this.tick) {
          p.allies.delete(oid);
          this.P[oid].allies.delete(p.id);
          this.alliancesChanged = true;
          if (p.id < oid) this.news('allyEnd', p.id, oid);
          this.tell(p, 'info', `Vojni savez je istekao: ${this.P[oid].name}.`, oid);
          this.tell(this.P[oid], 'info', `Vojni savez je istekao: ${p.name}.`, p.id);
        }
      }
    }
    this.allyReqs = this.allyReqs.filter((r) => r.exp > this.tick && this.P[r.from].alive && this.P[r.to].alive);
  }

  /* ---------------- enclaves ---------------- */
  _checkEnclaves(p) {
    if (!p.alive || p.tiles < 2) return;
    const own = this.owner, land = this.map.land, W = this.map.W, N = this.map.N;
    const seen = this.stamp, gen = ++this.stampGen, q = this.queue;
    const comps = [];
    for (let i = 0; i < p.tiles; i++) {
      const s = p.cells[i];
      if (seen[s] === gen) continue;
      let qh = 0, qt = 0;
      const start = comps.length ? comps[comps.length - 1].end : 0;
      // store component cells after previous in the queue array
      q[start] = s;
      seen[s] = gen;
      qt = start + 1;
      qh = start;
      let other = -1; // -1 none, >0 single owner, -2 mixed / neutral land
      while (qh < qt) {
        const c = q[qh++];
        const x = c % W;
        for (let k = 0; k < 4; k++) {
          const n = k === 0 ? (x > 0 ? c - 1 : -1) : k === 1 ? (x < W - 1 ? c + 1 : -1) : k === 2 ? (c >= W ? c - W : -1) : c < N - W ? c + W : -1;
          if (n < 0) continue;
          if (own[n] === p.id) {
            if (seen[n] !== gen) {
              seen[n] = gen;
              q[qt++] = n;
            }
          } else if (land[n]) {
            const o = own[n];
            if (!o) other = -2;
            else if (other === -1) other = o;
            else if (other !== o) other = -2;
          }
        }
      }
      comps.push({ start, end: qt, other });
      if (comps.length > 400) break;
    }
    if (comps.length < 2) return;
    let big = comps[0];
    for (const cp of comps) if (cp.end - cp.start > big.end - big.start) big = cp;
    for (const cp of comps) {
      if (cp === big || cp.other <= 0) continue;
      const X = this.P[cp.other];
      if (!X || !X.alive || this.isFriendly(X, p)) continue;
      const size = cp.end - cp.start;
      if (size > 400) continue;
      // a landing or paratroopers still fighting there, or the country's own exclave in a borders game
      if (this.attacks.some((a) => !a.done && a.a === p.id && a.t === X.id)) continue;
      if (this.borders && p.nation && this.map.eraOwn && this.map.eraOwn[q[cp.start]] === p.nation.k) continue;
      const cells = Array.from(q.subarray(cp.start, cp.end));
      for (const c of cells) this.setOwner(c, X.id);
    }
  }

  /* ---------------- main tick ---------------- */
  step() {
    if (this.state !== 'play') return;
    this.tick++;
    if (this.tick === this.peaceUntil) this.tellAll('info', '⚔ Mirno doba je završeno — od sada su dozvoljeni napadi na države!');
    this._season();
    const P = this.P;
    for (let i = 1; i < P.length; i++) {
      const p = P[i];
      if (!p.alive || !p.spawned) continue;
      this.economy(p);
    }
    // attacks (rotate start index for fairness)
    const A = this.attacks;
    if (A.length) {
      const off = this.tick % A.length;
      for (let k = 0; k < A.length; k++) {
        const att = A[(k + off) % A.length];
        if (!att.done) this._stepAttack(att);
      }
      if (this.tick % 20 === 0) this.attacks = A.filter((a) => !a.done);
    }
    for (const b of this.boats) if (!b.done) this._stepBoat(b);
    if (this.tick % 20 === 0) this.boats = this.boats.filter((b) => !b.done);
    for (const m of this.missiles) if (!m.done) this._stepMissile(m);
    if (this.zone) this._stepZone();
    this._stepPlanes();
    this._stepUnits();
    this._stepTrains();
    this._stepTrade();
    if (this.tick % 20 === 0) this.missiles = this.missiles.filter((m) => !m.done);
    // construction
    for (const s of this.structs) {
      if (!s.dead && !s.ready && this.tick >= s.doneAt) {
        s.ready = true;
        const p = P[s.owner];
        p.n[s.type]++;
        if (s.type === 'fort') p.forts.push(s);
        if (s.type === 'city') p.bcities.push(s);
        this.tell(p, 'good', s.type === 'city' ? `Osnovan je grad ${s.name}.` : `${RA.STRUCT[s.type].name}: izgradnja završena.`, p.id, s.c);
      }
    }
    if (this.tick % 10 === 0) {
      this._expireAlliances();
      this._vassals();
      this._loans();
      this._stepStraits();
      if (this.tick % 20 === 0) this._stepAir();
      if (this.deps && this.tick % RA.CFG.RES_EVERY === 0) this._stepRes();
      this._decayFallout();
    }
    // enclave check: one player per tick
    for (let k = 0; k < 3; k++) {
      this.encIdx = (this.encIdx % (P.length - 1)) + 1;
      const p = P[this.encIdx];
      if (p && p.alive && p.changed) {
        p.changed = false;
        this._checkEnclaves(p);
        break;
      }
    }
    // deaths
    for (let i = 1; i < P.length; i++) {
      const p = P[i];
      if (p.alive && p.spawned && p.tiles === 0) this._kill(p);
    }
    // AI
    for (let i = 1; i < P.length; i++) {
      const p = P[i];
      if (p.alive && p.ai && this.tick >= p.ai.next) RA.AI.think(this, p);
    }
    if (this.tick % 50 === 0) this._history();
    if (this.tick % 10 === 0) {
      this._updateLeader();
      this._checkWin();
    }
  }

  _kill(p) {
    p.alive = false;
    p.deathTick = this.tick;
    p.troops = 0;
    for (const oid of p.allies.keys()) this.P[oid].allies.delete(p.id);
    p.allies.clear();
    p.lord = 0;
    for (const v of this.P) if (v && v.lord === p.id) v.lord = 0; // its vassals are free
    this.alliancesChanged = true;
    for (const att of this.attacks) if (att.a === p.id) att.done = true;
    for (const b of this.boats) if (b.owner === p.id) b.done = true;
    for (const u of p.units.slice()) this._removeUnit(u);
    for (const id of [...p.trade]) this.cancelTrade(p.id, id, 'država je pala');
    const killer = p.lastAttackedBy ? this.P[p.lastAttackedBy] : null;
    if (killer) killer.stats.kills++;
    if (killer && killer.alive && p.type === 'nation' && killer.type !== 'bot') this.addAE(killer, RA.CFG.AE_FALL);
    if (p.human) {
      this.tell(p, 'bad', 'Tvoja država je pala.', p.id);
      this.tell(p, 'lost', 'Poražen si.', p.id);
      for (const h of this.P) if (h && h.human && h !== p && h.alive) this.tell(h, 'bad', `Pao je igrač ${p.nick || p.name}${killer ? ' (osvajač: ' + killer.name + ')' : ''}.`, p.id);
    }
    this.news('fall', killer ? killer.id : p.id, killer ? p.id : 0); // shown in the kill feed (no toast for others)
  }

  addAE(p, v) {
    p.ae = Math.min(100, p.ae + v);
    if (!p.aeWarn && p.ae >= RA.CFG.AE_COALITION) {
      p.aeWarn = true;
      this.tell(p, 'bad', 'Tvoje širenje plaši svijet: države se udružuju protiv tebe. Ljutnja vremenom opada.', p.id);
    }
  }
  _updateLeader() {
    let best = null;
    for (const p of this.P) if (p && p.alive && p.spawned && (!best || p.area > best.area)) best = p;
    this.leader = best ? { id: best.id, share: (best.area / this.landTotal()) * this.shareK() } : null;
  }
  /* land still in play, as area (map.aw); shares are p.area / landTotal() */
  landTotal() {
    return this.map.landArea - this.falloutCount - (this.zone ? this.zone.deadLand : 0);
  }
  /* share of the real land needed to win: 70% on every map and region, all game long (Darko, 25. 9.: no lower
     target on the world, no overtime drop — the winner may play on to 100% instead, "Nastavi igru") */
  winShare() {
    return RA.CFG.WIN_SHARE;
  }
  _history() {
    const snap = { t: this.tick, v: {} };
    for (const p of this.P) if (p && p.spawned && (p.alive || p.deathTick > this.tick - 60)) snap.v[p.id] = p.area;
    this.hist.push(snap);
  }
  _checkWin() {
    if (this.winner && !this.continued) return;
    const tot = this.landTotal();
    // sides: a co-op team plays as one side
    const sides = new Map();
    for (const p of this.P) {
      if (!p || !p.alive || !p.spawned) continue;
      const k = p.team ? -p.team : p.id;
      let sd = sides.get(k);
      if (!sd) sides.set(k, (sd = { area: 0, best: null, real: false }));
      sd.area += p.area;
      if (!sd.best || p.area > sd.best.area) sd.best = p;
      if (p.type !== 'bot') sd.real = true;
    }
    let best = null, realSides = 0;
    for (const sd of sides.values()) {
      if (sd.real) realSides++;
      if (!best || sd.area > best.area) best = sd;
    }
    if (!best) return;
    // the winner chose "Nastavi igru": the game ends for good when one side is left
    if (this.continued) {
      if (sides.size === 1) {
        this.state = 'over';
        this._history();
        this.tellAll('over', `Osvojeno sve: ${best.best.name}`, best.best.id);
      }
      return;
    }
    if (best.area / tot >= this.winShare() || (realSides === 1 && best.real)) {
      this.winner = best.best;
      this.state = 'over';
      this._history();
      this.tellAll('over', `Pobjednik: ${best.best.name}`, best.best.id);
    }
  }
  /* checksum of the whole game, compared between devices in online play */
  hash() {
    let h = 2166136261;
    const own = this.owner;
    for (let i = 0; i < own.length; i++) h = Math.imul(h ^ own[i], 16777619);
    for (const p of this.P) {
      if (!p) continue;
      h = Math.imul(h ^ (p.troops | 0), 16777619);
      h = Math.imul(h ^ (p.gold | 0), 16777619);
      h = Math.imul(h ^ p.allies.size ^ (p.trade.size << 4) ^ (p.alive ? 256 : 0), 16777619);
    }
    h = Math.imul(h ^ (this.units.length + this.structs.length * 31 + this.attacks.length * 1021 + this.missiles.length * 7919), 16777619);
    return h >>> 0;
  }

  /* ---------------- player commands ---------------- */
  /* land X took from p in the last minutes and still holds: Map X -> [cells] */
  lostTo(p) {
    const out = new Map();
    if (!p.lost) return out;
    const lim = this.tick - RA.CFG.RECLAIM_TICKS, own = this.owner;
    for (const [c, t] of p.lost) {
      const o = own[c];
      if (t < lim || !o || o === p.id) continue;
      let a = out.get(o);
      if (!a) out.set(o, (a = []));
      a.push(c);
    }
    return out;
  }
  /* "Vrati granice": a counter-attack only on the land X recently took from p, until the old border is back */
  cmdReclaim(pid, xid, ratio) {
    const p = this.P[pid], X = this.P[xid];
    if (!p || !p.alive) return 'Nisi u igri.';
    if (!X || !X.alive || X === p) return 'Nevažeći igrač.';
    if (this.isFriendly(p, X)) return `${X.name} ti je saveznik.`;
    if (this.tick < this.peaceUntil) return 'Mirno doba.';
    const cells = this.lostTo(p).get(xid);
    if (!cells || !cells.length) return `${X.name} ti nije ništa oteo u zadnje 3 minute.`;
    if (!this.hasBorderWith(p, xid)) return `Nemaš granicu s tom državom (${X.name}).`;
    const troops = p.troops * ratio;
    if (troops < 1) return 'Nemaš dovoljno vojske.';
    const a = this.launchAttack(pid, xid, troops, cells[cells.length - 1], -1, false, -1, new Set(cells));
    return a ? { att: a, n: cells.length } : 'Napad nije moguć.';
  }
  cmdAttack(pid, c, ratio, dir, from) {
    const p = this.P[pid];
    if (!p || !p.alive) return { err: 'Nisi u igri.' };
    if (c < 0 || !this.map.land[c]) return { err: 'To je voda. Dodirni kopno ili obalu.' };
    if (this.zone && this.zoneOut(c)) return { err: 'To je u radioaktivnoj zoni — tamo se više ne može.' };
    const tid = this.owner[c];
    if (tid === pid) return { own: true };
    const T = tid ? this.P[tid] : null;
    if (T && this.isFriendly(p, T)) return { err: `${T.name} ti je saveznik.` };
    if (T && this.tick < this.peaceUntil) return { err: `Mirno doba: napadi na države počinju za ${this.peaceLeft()} s. Do tada zauzimaj slobodnu zemlju i sklapaj saveze.` };
    const troops = p.troops * ratio;
    if (troops < 1) return { err: 'Nemaš dovoljno vojske.' };
    if (this.hasBorderWith(p, tid) || (T && p.human && this._viaOf(p, T))) {
      const a = this.launchAttack(pid, tid, troops, c, -1, !!dir, from);
      return a ? { ok: 'land', att: a } : { err: 'Napad nije moguć.' };
    }
    if (this.map.coast[c]) {
      const r = this.launchBoat(pid, c, troops);
      if (typeof r === 'object') return { ok: 'boat', boat: r };
      return { err: this.boatErr(r) };
    }
    return { err: T ? `Nemaš kopnenu granicu s tom državom (${T.name}), ni preko vojnog saveznika. Pošalji brod na obalu.` : 'Nemaš pristup tom području. Pošalji brod na obalu.' };
  }
  boatErr(r) {
    return ({
      max: `Najviše ${RA.CFG.BOAT_MAX} broda istovremeno.`,
      nopath: 'Nema morskog puta do te obale.',
      far: `Predaleko — brod plovi najviše ${RA.CFG.BOAT_RANGE} polja.`,
      nocoast: 'Brod može pristati samo na obalu.',
      water: 'Dodirni obalu, ne more.',
      own: 'To je tvoja obala.',
      ally: 'To je obala saveznika.',
      troops: 'Premalo vojske za desant.',
      peace: 'Mirno doba — brodom zasad možeš samo na slobodnu obalu.',
      zone: 'Ta obala je u radioaktivnoj zoni.',
      dead: 'Nisi u igri.',
    })[r] || 'Brod ne može isploviti.';
  }
};

'use strict';
/* Ratni Atlas — military layer: border units (infantry, tanks, artillery), missiles (rocket, EMP,
   atom, hydrogen, MIRV), paratroopers, mobilisation, northern winter, capital crisis. */

Object.assign(RA.CFG, {
  UNIT_BASE_CAP: 3,
  UNIT_PER_BARRACKS: 2,
  PARA_RANGE: 42,
  PARA_GOLD: 60000,
  PARA_CD: 180,
  PARA_SPEED: 3.2,
  MOB_CD: 2400,
  MOB_SHARE: 0.3,
  MOB_PAUSE: 450,
  WINTER_CYCLE: 2400, // a winter every 4 minutes...
  WINTER_LEN: 600, // ...lasting 1 minute
  WINTER_LAT: 51.5,
  CRISIS_DUR: 600,
  EMP_DUR: 350,
});

RA.STRUCT.silo.cost = () => 800000;
RA.STRUCT.silo.desc = 'Lansira rakete, EMP i nuklearne bombe. Više silosa = brža paljba.';
RA.STRUCT.barracks.desc = '+160k kapaciteta vojske i +2 mjesta za vojne jedinice.';
RA.STRUCT.city = {
  name: 'Grad', short: 'Grad', cost: (n) => Math.min(2e6, 150000 * RA.dpow(2, n)), time: 40,
  desc: 'Novi grad: +90k kapaciteta vojske, +80 zlata/s, brži rast vojske i jača odbrana oko njega.',
};
RA.STRUCT.factory = {
  name: 'Fabrika', short: 'Fabrika', cost: (n) => Math.min(2e6, 200000 * RA.dpow(2, n)), time: 60,
  desc: 'Pruge do tvojih gradova (18 polja) — vozovi donose zlato. Potrebna za tenkove i artiljeriju.',
};
/* the iron dome (plan 50): automatic retaliation — when somebody launches a nuclear weapon at you, every ready dome
   fires an atomic bomb at their country (the capital first, then their biggest cities) */
RA.STRUCT.dome = {
  name: 'Gvozdena kupola', short: 'Kupola', icon: 'dome', cost: (n) => Math.min(7.5e6, 2500000 * (n + 1)), time: 90,
  desc: 'Automatski uzvrat: kad neko lansira nuklearku na tebe, svaka spremna kupola ispali atomsku bombu na njegovu prijestolnicu i gradove. Puni se 60 s.',
};
RA.CFG.DOME_CD = 600;
RA.STRUCT_ORDER = ['city', 'factory', 'barracks', 'port', 'fort', 'sam', 'silo', 'dome', 'airport'];
RA.CITY_NAMES = ['Novigrad', 'Zlatograd', 'Belograd', 'Kamengrad', 'Svetigrad', 'Jezerograd', 'Brdovac', 'Orlovac', 'Hrastovac',
  'Bukovac', 'Javorje', 'Vidikovac', 'Zorograd', 'Sunčanik', 'Gorograd', 'Riječac', 'Mirograd', 'Slavograd', 'Dubravac', 'Lipovac',
  'Borovo Polje', 'Srebrnik', 'Kosovac', 'Vjetrograd', 'Plavnica', 'Zelengrad', 'Tvrđavac', 'Stijena', 'Dolina', 'Sokolac Novi'];
Object.assign(RA.CFG, { TRAIN_RANGE: 18, TRAIN_EVERY: 140, TRAIN_SPEED: 0.55 });
RA.STRUCT.airport = {
  name: 'Aerodrom', short: 'Aerodrom', cost: (n) => Math.min(1.6e6, 400000 * (n + 1)), time: 70,
  desc: 'Padobranski desant bilo gdje na kopnu, do 42 polja od aerodroma.',
};

RA.UNIT = {
  inf: {
    name: 'Pješadija', gold: 90000, troops: 12000, hp: 100, r: 6, ro: 4, def: 2.0, defSpd: 1.7, off: 0.86, offSpd: 0.9,
    speed: 0.22, deploy: 25, dmg: 2.4, lost: 'Pješadija je uništena', desc: 'Jeftina, čvrsta odbrana granice u krugu od 6 polja.',
  },
  tank: {
    name: 'Tenkovi', gold: 320000, troops: 20000, hp: 170, r: 5, ro: 6, def: 2.2, defSpd: 1.8, off: 0.58, offSpd: 0.6,
    speed: 0.42, deploy: 45, dmg: 1.5, lost: 'Tenkovi su uništeni', desc: 'Proboj: tvoji napadi pored tenkova su upola jeftiniji i brži. Brzo prate front.',
  },
  art: {
    name: 'Artiljerija', gold: 220000, troops: 8000, hp: 70, r: 4, ro: 10, def: 1.35, defSpd: 1.25, off: 0.8, offSpd: 0.88,
    speed: 0.16, deploy: 35, dmg: 3.6, range: 12, fireCd: 25, lost: 'Artiljerija je uništena', desc: 'Gađa neprijateljske jedinice i vojsku do 12 polja. Drži se iza linije.',
  },
};

/* the navy (plan 20): two ships per era, built at a port, sailing wherever the player sends them (sea only).
   The warship sinks landing boats, trade ships and warships, blockades enemy ports (no income, no trade) and shells
   the coast; the raider (a submarine from 1914: unseen until an enemy warship is near) hunts boats and trade ships. */
Object.assign(RA.UNIT, {
  ship: {
    name: 'Ratni brod', m: true, naval: true, needs: 'port', gold: 380000, troops: 6000, hp: 200, r: 0, ro: 0, def: 1, defSpd: 1, off: 1, offSpd: 1,
    speed: 0.55, deploy: 40, dmg: 0, range: 8, fireCd: 22, lost: 'Ratni brod je potopljen',
    desc: 'Plovi morem: potapa desante, trgovačke i ratne brodove, blokira neprijateljske luke i gađa obalu do 8 polja.',
  },
  sub: {
    name: 'Podmornica', naval: true, sub: true, needs: 'port', gold: 280000, troops: 4000, hp: 110, r: 0, ro: 0, def: 1, defSpd: 1, off: 1, offSpd: 1,
    speed: 0.5, deploy: 40, dmg: 0, range: 6, fireCd: 16, lost: 'Podmornica je potopljena',
    desc: 'Nevidljiva dok joj neprijateljski ratni brod ne priđe: lovi desante i trgovačke brodove do 6 polja.',
  },
});
Object.assign(RA.CFG, { NAVY_BLOCK_R: 7, SUB_SEEN_R: 5 });

RA.MISSILE = {
  rocket: { name: 'Raketa', kind: 'conv', cost: 150000, r: 3, speed: 3.8, cd: 45,
    desc: 'Precizan udar: ruši zgrade, uništava jedinice i ubija vojsku. Bez radijacije.' },
  emp: { name: 'EMP bomba', kind: 'emp', cost: 900000, r: 14, speed: 3.2, cd: 100,
    desc: 'Gasi sve zgrade i jedinice u krugu od 14 polja na 35 s (i tvoje!).' },
  atom: { name: 'Atomska bomba', kind: 'nuke', cost: 750000, r1: 5, r2: 9, speed: 3.0, cd: 100, kill: 4, shock: 0.12,
    desc: 'Briše teritoriju, sve zgrade i jedinice u krugu od 9 polja i lomi vojsku mete.' },
  hydro: { name: 'Hidrogenska bomba', kind: 'nuke', cost: 4000000, r1: 13, r2: 19, speed: 2.4, cd: 100, kill: 5, shock: 0.22,
    desc: 'Ogromna eksplozija (19 polja). Meta gubi velik dio vojske.' },
  mirv: { name: 'MIRV', kind: 'mirv', cost: 12000000, heads: 12, spread: 55, speed: 2.2, cd: 150,
    desc: '12 bojevih glava po teritoriji mete. Pogađa samo nju. Cijena raste sa svakim MIRV-om.' },
  warhead: { name: 'Bojeva glava', kind: 'nuke', cost: 0, r1: 3, r2: 6, speed: 4, cd: 0, kill: 4, shock: 0.02, hidden: true },
};
RA.NUKE = RA.MISSILE;

(function (P) {
  /* ---------------- helpers ---------------- */
  P.hostile = function (a, bid) {
    return bid && bid !== a.id && !a.allies.has(bid);
  };
  /* nuclear spam costs more (plan 22): every nuclear launch within NUKE_COOL of the last one makes the next NUKE_UP dearer;
     the price is normal again NUKE_COOL after the last launch (1,5 min in Blitz; in Focus the same game time) */
  P.nukeMul = function (p) {
    return p && p.nukeUntil > this.tick ? 1 + RA.CFG.NUKE_UP * p.nukeN : 1;
  };
  P.missileCost = function (type, p) {
    const M = RA.MISSILE[type];
    let c = type === 'mirv' ? M.cost + 4000000 * (this.mirvCount || 0) : M.cost;
    if (M.kind === 'nuke' || M.kind === 'mirv') c *= this.nukeMul(p);
    const k = (p && p.bCost) || 1;
    return Math.round((p && this.deps && !this.hasRes(p, 2) ? c * RA.CFG.RES_DEAR : c) * k); // no fuel: dearer
  };
  P.winterLevel = function () {
    const C = RA.CFG;
    const t = this.tick % C.WINTER_CYCLE;
    const start = C.WINTER_CYCLE - C.WINTER_LEN;
    if (t < start) return 0;
    const k = t - start;
    return Math.min(1, k / 100, (C.WINTER_LEN - k) / 100);
  };
  P.snowRow = function (x) {
    return this.map.snowY + 3 * RA.dsin(x * 0.07) + 2 * RA.dsin(x * 0.19 + 1.3);
  };
  P.isSnow = function (c) {
    const W = this.map.W;
    return ((c / W) | 0) < this.snowRow(c % W);
  };
  P._season = function () {
    const C = RA.CFG;
    this.wLevel = this.winterLevel();
    const t = this.tick % C.WINTER_CYCLE;
    const start = C.WINTER_CYCLE - C.WINTER_LEN;
    if (t === start - 300) this.tellAll('info', '❄ Zima stiže na sjever za 30 s — napadi preko snijega biće sporiji i skuplji.');
    if (t === start) this.tellAll('info', '❄ Zima je na sjeveru! Napadi preko snijega su sporiji, jedinice se teže kreću.');
    if (t === 0 && this.tick > 0) this.tellAll('info', 'Proljeće — snijeg se otopio.');
  };

  /* ---------------- units ---------------- */
  P.unitCap = function (p) {
    return RA.CFG.UNIT_BASE_CAP + RA.CFG.UNIT_PER_BARRACKS * p.n.barracks;
  };
  P.recruitUnit = function (pid, type, c) {
    const p = this.P[pid], U = RA.UNIT[type];
    if (!p || !p.alive) return 'Nisi u igri.';
    if (c < 0 || this.owner[c] !== pid) return 'Jedinicu postavi na svoju teritoriju (najbolje uz granicu).';
    const cap = this.unitCap(p);
    if (p.units.length >= cap) return `Limit jedinica je ${cap}. Svaka kasarna daje još ${RA.CFG.UNIT_PER_BARRACKS}.`;
    if (U.na) return 'Ta jedinica ne postoji u ovom dobu.';
    if (U.needs && !p.n[U.needs]) return `${U.name} ${U.pl ? 'traže' : 'traži'} zgradu: ${RA.STRUCT[U.needs].name}.`;
    const gold = this.unitCost(p, type);
    if (p.gold < gold) return 'Nemaš dovoljno zlata.';
    if (p.troops < U.troops * 1.2) return 'Nemaš dovoljno vojnika za tu jedinicu.';
    if (U.naval) {
      // ships are launched at your port nearest to the tapped place
      c = this._portLaunch(p, c);
      if (c < 0) return 'Treba ti spremna luka na moru.';
    }
    p.gold -= gold;
    p.troops -= U.troops;
    const W = this.map.W;
    const u = {
      id: this.nextId++, type, owner: pid, x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5, anchor: c, hp: U.hp,
      ready: this.tick + U.deploy, path: null, pi: 0, empUntil: 0, lastHit: -999, fireAt: 0, dead: false, retargetNow: true,
    };
    this.units.push(u);
    p.units.push(u);
    return u;
  };
  /* the water cell next to p's ready port nearest to c (where a new ship is launched) */
  P._portLaunch = function (p, c) {
    const W = this.map.W, cx = c % W, cy = (c / W) | 0;
    let best = -1, bd = 1e9;
    for (const s of this.structs) {
      if (s.dead || !s.ready || s.type !== 'port' || s.owner !== p.id) continue;
      const w = this._portWater(s);
      if (w < 0) continue;
      const d = RA.dist(s.x - cx, s.y - cy);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    return best;
  };
  P.moveUnit = function (pid, uid, c) {
    const p = this.P[pid];
    const u = p && p.units.find((x) => x.id === uid);
    if (!u) return 'Jedinica ne postoji.';
    if (RA.UNIT[u.type].naval) {
      if (c < 0 || !this.seaFor(c, pid) || this.map.block[c]) return 'Brod plovi samo morem — dodirni more.';
      u.anchor = c;
      u.retargetNow = true;
      return true;
    }
    if (c < 0 || this.owner[c] !== pid) return 'Jedinicu možeš poslati samo na svoju teritoriju — sama će pratiti front.';
    u.anchor = c;
    u.retargetNow = true;
    return true;
  };
  P.disbandUnit = function (pid, uid) {
    const p = this.P[pid];
    const u = p && p.units.find((x) => x.id === uid);
    if (!u) return;
    p.troops += RA.UNIT[u.type].troops * 0.6;
    this._removeUnit(u);
  };
  P._removeUnit = function (u) {
    if (u.dead) return;
    u.dead = true;
    const p = this.P[u.owner];
    p.units = p.units.filter((x) => x !== u);
  };
  P._unitDied = function (u, why) {
    const p = this.P[u.owner];
    this._removeUnit(u);
    this.fx.push({ kind: 'unitdead', x: u.x, y: u.y, tick: this.tick });
    const W = this.map.W;
    const c = (u.y | 0) * W + (u.x | 0);
    this.tell(p, 'bad', `${RA.UNIT[u.type].lost}${why ? ' (' + why + ')' : ''}.`, p.id, c);
  };
  P._friendlyCell = function (p, c) {
    const o = this.owner[c];
    return o === p.id || (o && p.allies.has(o));
  };
  /* BFS from start through cells accepted by `pass`, returns first cell satisfying `goal` (and fills bfsPrev) */
  P._bfs = function (start, pass, goal, limit) {
    const W = this.map.W, N = this.map.N;
    const seen = this.stamp, gen = ++this.stampGen, prev = this.bfsPrev, q = this.queue;
    let qh = 0, qt = 0;
    q[qt++] = start;
    seen[start] = gen;
    prev[start] = -1;
    while (qh < qt && qt < limit) {
      const c = q[qh++];
      if (goal(c)) return c;
      const x = c % W;
      const nb0 = x > 0 ? c - 1 : -1, nb1 = x < W - 1 ? c + 1 : -1, nb2 = c >= W ? c - W : -1, nb3 = c < N - W ? c + W : -1;
      for (let k = 0; k < 4; k++) {
        const n = k === 0 ? nb0 : k === 1 ? nb1 : k === 2 ? nb2 : nb3;
        if (n < 0 || seen[n] === gen || !pass(n)) continue;
        seen[n] = gen;
        prev[n] = c;
        q[qt++] = n;
      }
    }
    return -1;
  };
  P._retarget = function (u, escape) {
    const p = this.P[u.owner];
    const map = this.map, W = map.W, N = map.N, own = this.owner, land = map.land;
    const cur = (u.y | 0) * W + (u.x | 0);
    if (escape) {
      const f = this._bfs(cur, (c) => land[c], (c) => this._friendlyCell(p, c), 700);
      if (f < 0) {
        u.hp = 0;
        u.why = 'opkoljena';
        return;
      }
      u.path = [f];
      u.pi = 0;
      return;
    }
    const start = own[u.anchor] === p.id ? u.anchor : cur;
    const hostileAdj = (c) => {
      const x = c % W;
      const a = x > 0 ? own[c - 1] : 0, b = x < W - 1 ? own[c + 1] : 0, d = c >= W ? own[c - W] : 0, e = c < N - W ? own[c + W] : 0;
      return this.hostile(p, a) || this.hostile(p, b) || this.hostile(p, d) || this.hostile(p, e);
    };
    let dest = this._bfs(start, (c) => own[c] === p.id, hostileAdj, 1800);
    if (dest >= 0 && u.type === 'art') {
      // artillery stays two cells behind the line
      const pr = this.bfsPrev;
      if (pr[dest] >= 0) dest = pr[dest];
      if (pr[dest] >= 0) dest = pr[dest];
    }
    if (dest < 0) dest = own[start] === p.id ? start : cur;
    const dx = (dest % W) + 0.5 - u.x, dy = ((dest / W) | 0) + 0.5 - u.y;
    const dist = RA.dist(dx, dy);
    if (dist < 0.6) {
      u.path = null;
      return;
    }
    // straight line if it stays on friendly land, otherwise walk the BFS path
    let clear = true;
    const steps = Math.ceil(dist * 2);
    for (let i = 1; i <= steps && clear; i++) {
      const sx = u.x + (dx * i) / steps, sy = u.y + (dy * i) / steps;
      if (!this._friendlyCell(p, (sy | 0) * W + (sx | 0))) clear = false;
    }
    if (clear) {
      u.path = [dest];
      u.pi = 0;
      return;
    }
    const got = this._bfs(cur, (c) => this._friendlyCell(p, c), (c) => c === dest, 3000);
    if (got < 0) {
      u.path = null;
      return;
    }
    const path = [];
    for (let k = got; k !== -1 && path.length < 400; k = this.bfsPrev[k]) path.push(k);
    path.reverse();
    u.path = path;
    u.pi = 1;
  };
  P._stepUnits = function () {
    const tk = this.tick, W = this.map.W;
    const wl = this.wLevel || 0;
    for (const u of this.units) {
      if (u.dead) continue;
      const p = this.P[u.owner];
      if (!p.alive) {
        this._removeUnit(u);
        continue;
      }
      const U = RA.UNIT[u.type];
      const c = (u.y | 0) * W + (u.x | 0);
      if (U.naval) {
        this._stepShip(u, U, p, c);
        continue;
      }
      const friendly = this._friendlyCell(p, c);
      if (!friendly) {
        u.hp -= 1.4;
        u.lastHit = tk;
      }
      if (u.hp <= 0) {
        this._unitDied(u, u.why || (friendly ? '' : 'pregažena'));
        continue;
      }
      if (tk < u.ready || u.empUntil > tk) continue;
      if (!friendly && (tk + u.id) % 5 === 0) this._retarget(u, true);
      else if (u.retargetNow || (tk + u.id) % 20 === 0) {
        u.retargetNow = false;
        this._retarget(u, false);
      }
      if (u.path && u.pi < u.path.length) {
        let step = U.speed * (wl > 0 && this.isSnow(c) ? 1 - 0.45 * wl : 1);
        while (step > 0 && u.pi < u.path.length) {
          const tc = u.path[u.pi];
          const tx = (tc % W) + 0.5, ty = ((tc / W) | 0) + 0.5;
          const ddx = tx - u.x, ddy = ty - u.y, d = RA.dist(ddx, ddy);
          if (d <= step) {
            u.x = tx;
            u.y = ty;
            step -= d;
            u.pi++;
          } else {
            u.x += (ddx / d) * step;
            u.y += (ddy / d) * step;
            step = 0;
          }
        }
      }
      if (tk - u.lastHit > 60 && u.hp < U.hp) u.hp = Math.min(U.hp, u.hp + 0.12);
      if (u.type === 'art' && tk >= u.fireAt) this._artFire(u);
    }
    if (tk % 20 === 0) this.units = this.units.filter((u) => !u.dead);
    if (tk % 10 === 0) {
      // EMP'd ports stop paying
      for (const p of this.P) if (p) p.portsOff = 0;
      for (const s of this.structs) if (!s.dead && s.ready && s.type === 'port' && s.empUntil > tk) this.P[s.owner].portsOff++;
      this._blockades();
    }
  };
  /* ---------------- the navy ---------------- */
  P._stepShip = function (u, U, p, c) {
    const tk = this.tick, W = this.map.W;
    if (u.hp <= 0) {
      this._unitDied(u, u.why || 'potopljen');
      return;
    }
    if (tk < u.ready || u.empUntil > tk) return;
    // sail to the anchor (a water cell) along the sea
    if (u.retargetNow || (!u.path && u.anchor !== c && (tk + u.id) % 20 === 0)) {
      u.retargetNow = false;
      u.path = null;
      if (u.anchor !== c && this.seaFor(u.anchor, p.id)) {
        const got = this._bfs(c, (n) => this.seaFor(n, p.id) && !this.map.block[n], (n) => n === u.anchor, 60000);
        if (got >= 0) {
          const path = [];
          for (let k = got; k !== -1 && path.length < 2000; k = this.bfsPrev[k]) path.push(k);
          path.reverse();
          u.path = path;
          u.pi = 1;
        }
      }
    }
    if (u.path && u.pi < u.path.length) {
      let step = U.speed;
      while (step > 0 && u.pi < u.path.length) {
        const tc = u.path[u.pi];
        const tx = (tc % W) + 0.5, ty = ((tc / W) | 0) + 0.5;
        const ddx = tx - u.x, ddy = ty - u.y, d = RA.dist(ddx, ddy);
        if (d <= step) {
          u.x = tx;
          u.y = ty;
          step -= d;
          u.pi++;
        } else {
          u.x += (ddx / d) * step;
          u.y += (ddy / d) * step;
          step = 0;
        }
      }
      if (u.pi >= u.path.length) u.path = null;
    }
    if (tk - u.lastHit > 60 && u.hp < U.hp) u.hp = Math.min(U.hp, u.hp + 0.2);
    if (tk >= (u.fireAt || 0)) this._shipFire(u, U, p);
  };
  /* can an enemy of this submarine see it? (a hostile warship or port near it) */
  P.subSeen = function (u, by) {
    const R = RA.CFG.SUB_SEEN_R, R2 = R * R;
    for (const e of this.units) if (!e.dead && e.type === 'ship' && e.owner === by && (e.x - u.x) * (e.x - u.x) + (e.y - u.y) * (e.y - u.y) <= R2) return true;
    return false;
  };
  P._shipFire = function (u, U, p) {
    const tk = this.tick, W = this.map.W, R2 = U.range * U.range;
    u.fireAt = tk + U.fireCd;
    if (this.defcon() > RA.DEFCON_NEED.sea) return; // DEFCON: warships hold fire until DEFCON 3
    const near = (x, y) => (x - u.x) * (x - u.x) + (y - u.y) * (y - u.y) <= R2;
    const hit = (x, y) => this.fx.push({ kind: 'shell', sx: u.x, sy: u.y, x, y, tick: tk });
    // 1. enemy ships (a raider only fights raiders; nobody sees a submarine from afar)
    let best = null, bd = 1e9;
    for (const e of this.units) {
      if (e.dead || !this.hostile(p, e.owner)) continue;
      const E = RA.UNIT[e.type];
      if (!E.naval || (U.sub && e.type === 'ship') || (E.sub && !this.subSeen(e, u.owner))) continue;
      const d2 = (e.x - u.x) * (e.x - u.x) + (e.y - u.y) * (e.y - u.y);
      if (d2 <= R2 && d2 < bd) {
        bd = d2;
        best = e;
      }
    }
    if (best) {
      best.hp -= U.sub ? 18 : 26;
      best.lastHit = tk;
      hit(best.x, best.y);
      return;
    }
    // 2. landing boats, 3. trade ships
    for (const b of this.boats) {
      if (b.done || !this.hostile(p, b.owner)) continue;
      const bc = b.path[Math.min(b.path.length - 1, Math.floor(b.pos))];
      const x = (bc % W) + 0.5, y = ((bc / W) | 0) + 0.5;
      if (!near(x, y)) continue;
      b.done = true;
      this.P[b.owner].boats--;
      hit(x, y);
      this.tell(this.P[b.owner], 'bad', `${U.name} (${p.name}) je potopio tvoj desant.`, p.id, bc);
      this.tell(p, 'good', `${U.name}: potopljen desant (${this.P[b.owner].name}).`, b.owner, bc);
      return;
    }
    for (const s of this.tships) {
      if (s.done || !this.hostile(p, s.owner)) continue;
      const k = Math.min(s.path.length - 1, Math.floor(s.pos || 0)), sc = s.path[k];
      const x = (sc % W) + 0.5, y = ((sc / W) | 0) + 0.5;
      if (!near(x, y)) continue;
      s.done = true;
      hit(x, y);
      p.gold += 20000; // the cargo
      return;
    }
    if (U.sub) return;
    // 4. the warship shells the coast: enemy units, else the army on a coastal cell
    for (const e of this.units) {
      if (e.dead || RA.UNIT[e.type].naval || !this.hostile(p, e.owner) || !near(e.x, e.y)) continue;
      e.hp -= e.type === 'tank' ? 9 : 14;
      e.lastHit = tk;
      hit(e.x, e.y);
      return;
    }
    const H = this.map.H, coast = this.map.coast;
    for (let k = 0; k < 12; k++) {
      const dx = Math.round((this.rng() * 2 - 1) * U.range), dy = Math.round((this.rng() * 2 - 1) * U.range);
      if (dx * dx + dy * dy > R2) continue;
      const x = (u.x | 0) + dx, y = (u.y | 0) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const c = y * W + x;
      const o = this.owner[c];
      if (!coast[c] || !this.hostile(p, o)) continue;
      const v = this.P[o];
      v.troops = Math.max(0, v.troops - Math.min(v.troops * 0.003, (v.troops / Math.max(1, v.tiles)) * 5));
      hit(x + 0.5, y + 0.5);
      return;
    }
  };
  /* ports within reach of a hostile warship are blockaded (no gold, no trade ships) */
  P._blockades = function () {
    const R = RA.CFG.NAVY_BLOCK_R, R2 = R * R, tk = this.tick;
    if (this.defcon() > RA.DEFCON_NEED.sea) return; // DEFCON: no blockades before DEFCON 3
    const ships = this.units.filter((u) => !u.dead && u.type === 'ship' && u.ready <= tk);
    for (const s of this.structs) {
      if (s.dead || !s.ready || s.type !== 'port') continue;
      const o = this.P[s.owner];
      let by = 0;
      for (const u of ships) if (this.hostile(o, u.owner) && (u.x - s.x - 0.5) * (u.x - s.x - 0.5) + (u.y - s.y - 0.5) * (u.y - s.y - 0.5) <= R2) {
        by = u.owner;
        break;
      }
      if (by && !s.blocked && s.empUntil <= tk) this.tell(o, 'bad', `Luka je u blokadi (${this.P[by].name}): ne donosi zlato ni trgovinu.`, by, s.c);
      s.blocked = by;
      if (by && s.empUntil <= tk) o.portsOff++; // (an EMP'd port is already off)
    }
  };
  P._artFire = function (u) {
    const U = RA.UNIT.art, tk = this.tick, W = this.map.W, H = this.map.H;
    u.fireAt = tk + U.fireCd;
    const p = this.P[u.owner];
    const R2 = U.range * U.range;
    let best = null, bd = 1e9;
    for (const e of this.units) {
      if (e.dead || e.owner === u.owner || !this.hostile(p, e.owner) || (RA.UNIT[e.type].sub && !this.subSeen(e, u.owner))) continue;
      const d2 = (e.x - u.x) * (e.x - u.x) + (e.y - u.y) * (e.y - u.y);
      if (d2 <= R2 && d2 < bd) {
        bd = d2;
        best = e;
      }
    }
    if (best) {
      best.hp -= best.type === 'tank' ? 10 : 16;
      best.lastHit = tk;
      this.fx.push({ kind: 'shell', sx: u.x, sy: u.y, x: best.x, y: best.y, tick: tk });
      return;
    }
    for (let k = 0; k < 16; k++) {
      const dx = Math.round((this.rng() * 2 - 1) * U.range), dy = Math.round((this.rng() * 2 - 1) * U.range);
      if (dx * dx + dy * dy > R2) continue;
      const x = (u.x | 0) + dx, y = (u.y | 0) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const c = y * W + x;
      const o = this.owner[c];
      if (!this.hostile(p, o)) continue;
      const v = this.P[o];
      const kill = Math.min(v.troops * 0.004, (v.troops / Math.max(1, v.tiles)) * 6);
      v.troops = Math.max(0, v.troops - kill);
      this.fx.push({ kind: 'shell', sx: u.x, sy: u.y, x: x + 0.5, y: y + 0.5, tick: tk });
      return;
    }
  };
  /* attack modifiers from units around cell c: defender units harden it (and get hurt), attacker units spearhead */
  P.unitMods = function (A, T, c, attTroops) {
    let mag = 1, spd = 1;
    const W = this.map.W, tk = this.tick;
    const x = (c % W) + 0.5, y = ((c / W) | 0) + 0.5;
    if (T && T.units.length) {
      let best = 0, bestS = 1, n = 0;
      const press = RA.clamp(attTroops / Math.max(1, T.troops), 0.5, 3);
      for (const u of T.units) {
        if (u.dead || u.ready > tk || u.empUntil > tk) continue;
        const U = RA.UNIT[u.type];
        if (U.naval) continue;
        const dx = u.x - x, dy = u.y - y;
        if (dx * dx + dy * dy > U.r * U.r) continue;
        n++;
        if (U.def > best) {
          best = U.def;
          bestS = U.defSpd;
        }
        u.hp -= U.dmg * press;
        u.lastHit = tk;
      }
      if (n) {
        mag *= best + 0.12 * Math.min(2, n - 1);
        spd *= bestS + 0.08 * Math.min(2, n - 1);
      }
    }
    if (A.units.length) {
      let om = 1, os = 1;
      for (const u of A.units) {
        if (u.dead || u.ready > tk || u.empUntil > tk) continue;
        const U = RA.UNIT[u.type];
        if (U.naval) continue;
        const dx = u.x - x, dy = u.y - y;
        if (dx * dx + dy * dy > U.ro * U.ro) continue;
        if (U.off < om) {
          om = U.off;
          os = U.offSpd;
        }
      }
      mag *= om;
      spd *= os;
    }
    this._umMag = mag;
    this._umSpd = spd;
  };

  /* ---------------- mobilisation ---------------- */
  P.mobilize = function (pid) {
    const p = this.P[pid];
    if (!p || !p.alive) return 'Nisi u igri.';
    if (this.tick < (p.mobReady || 0)) return `Mobilizacija će biti spremna za ${RA.dur(p.mobReady - this.tick)}.`;
    const add = p.maxT * RA.CFG.MOB_SHARE;
    p.troops += add;
    p.mobReady = this.tick + RA.CFG.MOB_CD;
    p.growPause = this.tick + RA.CFG.MOB_PAUSE;
    this.tell(p, 'good', `Mobilizacija! +${RA.fmt(add)} vojnika. Iskoristi ih brzo — rast vojske stoji 45 s.`, pid);
    return add;
  };

  /* ---------------- capital crisis ---------------- */
  P._capitalFell = function (v, by, city) {
    const lossT = v.troops * 0.25;
    v.troops -= lossT;
    const plunder = v.gold * 0.3;
    v.gold -= plunder;
    if (by) by.gold += plunder;
    v.crisisUntil = this.tick + RA.CFG.CRISIS_DUR;
    this.mark('cap', by ? by.id : 0, v.id);
    let best = null;
    for (const ct of this.cities) {
      if (ct.owner !== v.id || ct === city) continue;
      if (!best || ct.tier > best.tier || (ct.tier === best.tier && ct.pop > best.pop)) best = ct;
    }
    v.capCity = best ? best.i : -1;
    if (best) v.capital = best.c;
    this.tell(v, 'bad', `Pala je tvoja prijestolnica ${city.name}! Kriza 60 s: −25% vojske, pola prihoda.${best ? ' Nova prijestolnica: ' + best.name + '.' : ''}`, by ? by.id : 0, city.c);
    if (by) this.tell(by, 'good', `Zauzeta prijestolnica: ${city.name}! Plijen ${RA.fmt(plunder)} zlata — ${v.name} je u krizi.`, v.id, city.c);
  };

  /* ---------------- missiles ---------------- */
  /* the launcher that would fire at cell c: nearest own ready one within the weapon's range (any = ignore reload) */
  P.strikeSilo = function (p, type, c, any) {
    const M = RA.MISSILE[type], W = this.map.W, tk = this.tick;
    const tx = c % W, ty = (c / W) | 0;
    let best = null, bd = 1e9;
    for (const s of this.structs) {
      if (s.dead || !s.ready || s.owner !== p.id || s.type !== 'silo') continue;
      if (!any && (s.cd > tk || s.empUntil > tk)) continue;
      const d = RA.dist(s.x - tx, s.y - ty);
      if (M.range && d > M.range) continue;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    this._strikeDist = bd;
    return best;
  };
  P.launchMissile = function (pid, type, c) {
    const p = this.P[pid];
    const M = RA.MISSILE[type];
    if (!p || !p.alive || !M) return 'Nisi u igri.';
    if (M.na) return 'To oružje ne postoji u ovom dobu.';
    if (c < 0) return 'Nevažeća meta.';
    if (this.opts.noNuke && (M.kind === 'nuke' || M.kind === 'mirv')) return 'Nuklearno oružje je isključeno u ovoj igri.';
    const de = this.defconErr(M.kind === 'nuke' || M.kind === 'mirv' ? 'nuke' : 'conv');
    if (de) return de;
    if (this.tick < this.peaceUntil) return `Mirno doba — udari su dozvoljeni za ${this.peaceLeft()}.`;
    if (M.from && this.tick < M.from) return `${M.name}: razvoj još traje — dostupna od ${Math.round(M.from / 600)}. minute (još ${RA.dur(M.from - this.tick)}).`;
    const cost = this.missileCost(type, p);
    if (p.gold < cost) return 'Nemaš dovoljno zlata.';
    if (M.kind === 'drone') return this._launchDrone(p, type, M, c, cost);
    const W = this.map.W, tk = this.tick;
    const tx = c % W, ty = (c / W) | 0;
    const best = this.strikeSilo(p, type, c, false);
    const bd = this._strikeDist;
    const SN = RA.STRUCT.silo.name;
    if (!best) {
      if (!p.n.silo) return `Treba ti zgrada: ${SN}.`;
      if (M.range && !this.strikeSilo(p, type, c, true)) return `Meta je izvan dometa: ${M.range} polja od zgrade ${SN}.`;
      return `Zgrada ${SN} se puni (ili je pod EMP-om) — pričekaj.`;
    }
    p.gold -= cost;
    best.cd = tk + M.cd;
    if (type === 'mirv') this.mirvCount = (this.mirvCount || 0) + 1;
    const dur = Math.max(18, Math.round(bd / M.speed));
    const victimId = this.owner[c];
    const m = { id: this.nextId++, owner: pid, type, kind: M.kind, sx: best.x + 0.5, sy: best.y + 0.5, tx: tx + 0.5, ty: ty + 0.5, c, t: 0, dur, sam: null, samAt: 2, done: false, victim: victimId };
    if (M.kind !== 'mirv') this._assignSam(m, p);
    this.missiles.push(m);
    if (M.kind === 'nuke' || M.kind === 'mirv') {
      p.stats.nukes++;
      this.mark('nuke', pid, victimId || 0);
      p.nukeN = (p.nukeUntil > this.tick ? p.nukeN : 0) + 1;
      p.nukeUntil = this.tick + RA.CFG.NUKE_COOL;
    }
    const victim = victimId ? this.P[victimId] : null;
    if (victim && (M.kind === 'nuke' || M.kind === 'mirv') && !this.isFriendly(victim, p)) this._retaliate(victim, p);
    if (victim && victim.human) {
      const msg = { conv: `💥 ${M.name} — udar na tvoju teritoriju (${p.name})!`, emp: `⚡ EMP leti na tebe (${p.name})!`, nuke: `☢ ${M.name} leti na tebe (${p.name})! Krug udara je označen crveno.`, mirv: `☢☢ MIRV leti na tebe (${p.name})!` }[M.kind];
      this.tell(victim, 'bad', msg, pid, c);
    }
    const hate = { conv: [20, 1], emp: [25, 3], nuke: [60, 8], mirv: [100, 20] }[M.kind];
    for (const o of this.P) if (o && o.alive && o.id !== pid) this.relTo(o, pid, Math.max(-100, o.rel[pid] - (victim === o ? hate[0] : hate[1])), M.kind === 'nuke' || M.kind === 'mirv' ? 'nuke' : 'strike');
    return m;
  };
  P.launchNuke = P.launchMissile;
  P._launchDrone = function (p, type, M, c, cost) {
    const W = this.map.W;
    if ((p.drones || 0) >= RA.CFG.DRONE_MAX) return `Najviše ${RA.CFG.DRONE_MAX} drona u zraku odjednom.`;
    const src = this._droneSource(p, c);
    if (src < 0) return 'Nemaš odakle lansirati dron.';
    const sx = (src % W) + 0.5, sy = ((src / W) | 0) + 0.5, tx = (c % W) + 0.5, ty = ((c / W) | 0) + 0.5;
    const d = RA.dist(tx - sx, ty - sy);
    if (d > M.range) return `Meta je predaleko: ${M.name} leti do ${M.range} polja od tvoje granice.`;
    p.gold -= cost;
    p.drones = (p.drones || 0) + 1;
    const victimId = this.owner[c];
    const m = { id: this.nextId++, owner: p.id, type, kind: 'drone', sx, sy, tx, ty, c, t: 0, dur: Math.max(10, Math.round(d / M.speed)), sam: null, samAt: 2, done: false, victim: victimId };
    this._assignSam(m, p);
    this.missiles.push(m);
    if (victimId && victimId !== p.id) this.relTo(this.P[victimId], p.id, Math.max(-100, this.P[victimId].rel[p.id] - 6), 'strike');
    return m;
  };
  /* the victim's iron domes answer a nuclear launch: one atomic bomb per ready dome, at the attacker's capital first */
  P._retaliate = function (V, A) {
    const M = RA.MISSILE.atom, tk = this.tick;
    if (M.na || (M.from && tk < M.from) || !A.alive) return;
    const domes = this.structs.filter((s) => !s.dead && s.ready && s.type === 'dome' && s.owner === V.id && s.cd <= tk && s.empUntil <= tk);
    if (!domes.length) return;
    const W = this.map.W;
    const cities = this.cities.filter((ct) => ct.owner === A.id && ct.c !== A.capital).sort((a, b) => b.tier - a.tier || b.pop - a.pop || a.c - b.c);
    const targets = [A.capital, ...cities.map((ct) => ct.c)].filter((c) => c >= 0 && this.owner[c] === A.id);
    if (!targets.length) return;
    domes.forEach((d, i) => {
      const c = targets[i % targets.length], tx = c % W, ty = (c / W) | 0;
      const dist = RA.dist(tx - d.x, ty - d.y);
      const m = { id: this.nextId++, owner: V.id, type: 'atom', kind: 'nuke', sx: d.x + 0.5, sy: d.y + 0.5, tx: tx + 0.5, ty: ty + 0.5, c, t: 0, dur: Math.max(18, Math.round(dist / M.speed)), sam: null, samAt: 2, done: false, victim: A.id, auto: true };
      this._assignSam(m, V);
      this.missiles.push(m);
      d.cd = tk + RA.CFG.DOME_CD;
      V.stats.nukes++;
    });
    this.tell(V, 'good', `Gvozdena kupola uzvraća: ${domes.length} ${domes.length === 1 ? 'atomska bomba leti' : 'atomske bombe lete'} na ${A.name}!`, A.id, A.capital);
    this.tell(A, 'bad', `☢ ${V.name} automatski uzvraća (gvozdena kupola): ${domes.length} ${domes.length === 1 ? 'atomska bomba leti' : 'atomske bombe lete'} na tebe!`, V.id, A.capital);
    this.news('dome', V.id, A.id);
  };
  P._assignSam = function (m, p) {
    const tk = this.tick;
    const tx = m.tx - 0.5, ty = m.ty - 0.5;
    for (const s of this.structs) {
      if (s.dead || !s.ready || s.type !== 'sam' || s.cd > tk || s.empUntil > tk) continue;
      if (s.owner === p.id || this.isFriendly(this.P[s.owner], p)) continue;
      if (RA.dist(s.x - tx, s.y - ty) <= RA.CFG.SAM_R) {
        m.sam = s;
        m.samAt = m.kind === 'warhead' ? 0.55 : 0.62 + this.rng() * 0.2;
        // a nuclear salvo (several launches in a row): air defence reloads twice as fast
        s.cd = tk + ((m.kind === 'nuke' || m.kind === 'mirv') && p.nukeN > 1 && p.nukeUntil > tk ? RA.CFG.SAM_CD >> 1 : RA.CFG.SAM_CD);
        return true;
      }
    }
    return false;
  };
  P._stepMissile = function (m) {
    m.t += 1 / m.dur;
    if (m.kind === 'drone' && (m.t >= 1 || (m.sam && m.t >= m.samAt))) this.P[m.owner].drones = Math.max(0, (this.P[m.owner].drones || 1) - 1);
    if (m.sam && m.t >= m.samAt) {
      m.done = true;
      this.fx.push({ kind: 'intercept', x: m.sx + (m.tx - m.sx) * m.t, y: m.sy + (m.ty - m.sy) * m.t, sx: m.sam.x + 0.5, sy: m.sam.y + 0.5, tick: this.tick });
      const vo = this.P[m.sam.owner];
      if (m.kind === 'warhead') {
        this._mirvHead(m, null);
        this.tell(vo, 'good', 'PVO je oborio bojevu glavu!', vo.id, m.sam.c);
        return;
      }
      this.tell(vo, 'good', `${RA.STRUCT.sam.name} — oboren projektil: ${RA.MISSILE[m.type].name}!`, vo.id, m.sam.c);
      this.tell(this.P[m.owner], 'bad', `Projektil je oborio PVO (${vo.name}).`, vo.id, m.c);
      return;
    }
    if (m.t >= 1) {
      m.done = true;
      if (m.kind === 'nuke' || m.kind === 'warhead') this._detonate(m);
      else if (m.kind === 'conv') this._detonateConv(m);
      else if (m.kind === 'emp') this._detonateEmp(m);
      else if (m.kind === 'mirv') this._splitMirv(m);
      else if (m.kind === 'drone') this._droneHit(m);
    }
  };
  P._blastAssets = function (cx, cy, r, skipOwner, onlyOwner, unitDmg) {
    // destroys structures, damages/destroys units and sinks boats in radius r. Returns counts by owner.
    const res = new Map();
    const add = (o, k) => {
      const e = res.get(o) || { structs: 0, units: 0 };
      e[k]++;
      res.set(o, e);
    };
    for (const s of this.structs) {
      if (s.dead || s.owner === skipOwner || (onlyOwner && s.owner !== onlyOwner)) continue;
      if (RA.dist(s.x + 0.5 - cx, s.y + 0.5 - cy) <= r) {
        add(s.owner, 'structs');
        this._destroyStruct(s);
      }
    }
    for (const u of this.units) {
      if (u.dead || u.owner === skipOwner || (onlyOwner && u.owner !== onlyOwner)) continue;
      if (RA.dist(u.x - cx, u.y - cy) <= r + 0.5) {
        u.hp -= unitDmg * (u.type === 'tank' ? 0.65 : 1);
        u.lastHit = this.tick;
        if (u.hp <= 0) {
          add(u.owner, 'units');
          this._unitDied(u, 'bombardovana');
        }
      }
    }
    const W = this.map.W;
    for (const b of this.boats) {
      if (b.done || b.owner === skipOwner || (onlyOwner && b.owner !== onlyOwner)) continue;
      const bc = b.path[Math.min(b.path.length - 1, Math.floor(b.pos))];
      if (RA.dist((bc % W) + 0.5 - cx, ((bc / W) | 0) + 0.5 - cy) <= r) {
        b.done = true;
        this.P[b.owner].boats--;
      }
    }
    return res;
  };
  P._detonate = function (m) {
    const nk = RA.MISSILE[m.type];
    const map = this.map, W = map.W, H = map.H;
    const cx = Math.floor(m.tx), cy = Math.floor(m.ty);
    const only = m.kind === 'warhead' ? m.victim : 0;
    const lost = new Map();
    const attacker = this.P[m.owner];
    // cities in the core of the blast drop a level (their owner loses that much army room and gold)
    const C = RA.CFG, P = this.P;
    let razed = 0;
    for (const ct of this.cities) {
      if (ct.tier < 1 || (only && ct.owner !== only) || RA.dist(ct.x - cx, ct.y - cy) > nk.r1 + 0.5) continue;
      const o = ct.owner, t = ct.tier;
      if (o) {
        P[o].cityT -= C.CITY_T[t] - C.CITY_T[t - 1];
        P[o].cityG -= C.CITY_G[t] - C.CITY_G[t - 1];
        P[o].nCity[t]--;
        P[o].nCity[t - 1]++;
      }
      ct.tier = t - 1;
      razed++;
    }
    for (let dy = -nk.r2; dy <= nk.r2; dy++)
      for (let dx = -nk.r2; dx <= nk.r2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > nk.r2) continue;
        const c = y * W + x;
        if (!map.land[c]) continue;
        const o = this.owner[c];
        if (only && o !== only) continue;
        const hit = d <= nk.r1 || this.rng() < (1 - (d - nk.r1) / (nk.r2 - nk.r1)) * 0.85;
        if (!hit) continue;
        if (o) {
          lost.set(o, (lost.get(o) || 0) + 1);
          this.setOwner(c, 0);
        }
        const f = Math.round(255 * (d <= nk.r1 ? 1 : 0.75));
        if (!this.fallout[c]) {
          this.falloutList.push(c);
          this.falloutCount += map.aw[c]; // area, like landTotal()
        }
        this.fallout[c] = Math.max(this.fallout[c], f);
        this.falloutDirty = true;
      }
    // every structure, unit and boat in the blast is gone
    const assets = this._blastAssets(cx + 0.5, cy + 0.5, nk.r2 + 1, 0, only, 9999);
    const victims = new Set([...lost.keys(), ...assets.keys()]);
    let main = null;
    for (const o of victims) {
      const v = this.P[o];
      const n = lost.get(o) || 0;
      const a = assets.get(o) || { structs: 0, units: 0 };
      let kill = 0;
      if (o !== m.owner && (n || a.structs || a.units)) {
        const dens = v.troops / Math.max(1, v.tiles + n);
        kill = Math.min(v.troops * 0.75, n * dens * nk.kill + v.troops * nk.shock * 1.5);
        v.troops = Math.max(0, v.troops - kill);
        // an economic blow: 30 s of crisis (half the gold, slower army growth)
        if (m.kind !== 'warhead' && n >= 4) v.crisisUntil = Math.max(v.crisisUntil, this.tick + RA.CFG.NUKE_CRISIS);
      }
      const rep = { v, n, kill, structs: a.structs, units: a.units };
      if (o !== m.owner && (!main || n > main.n)) main = rep;
      if (o !== m.owner && this.isFriendly(attacker, v) && (n >= 5 || a.structs || a.units)) this.breakAlliance(m.owner, o, true);
      if (m.kind === 'warhead') this._mirvAcc(m, rep);
      else if (o !== m.owner) this.tell(v, 'bad', `☢ Nuklearni udar! Izgubio si ${n} polja, ${RA.fmt(kill)} vojske${rep.structs ? ', ' + rep.structs + ' zgrada' : ''}${rep.units ? ', ' + rep.units + ' jedinica' : ''}${razed && o === this.owner[m.c] ? ', gradovi su razoreni' : ''}${n >= 4 ? ' — privreda u krizi 30 s' : ''}.`, m.owner, m.c);
    }
    if (m.kind === 'warhead') this._mirvHead(m, true);
    else if (attacker.human) {
      if (main) this.tell(attacker, 'good', `☢ Pogodak! ${main.v.name}: −${RA.fmt(main.kill)} vojske, ${main.n} polja, ${main.structs} zgrada${main.units ? ', ' + main.units + ' jedinica' : ''} uništeno.`, main.v.id, m.c);
      else this.tell(attacker, 'info', 'Bomba je pala na pustu zemlju.', attacker.id, m.c);
    }
    this.fx.push({ kind: 'nuke', x: m.tx, y: m.ty, r: nk.r2, type: m.type, tick: this.tick });
  };
  P._detonateConv = function (m) {
    const M = RA.MISSILE[m.type] || RA.MISSILE.rocket;
    const map = this.map, W = map.W, H = map.H;
    const cx = Math.floor(m.tx), cy = Math.floor(m.ty);
    const attacker = this.P[m.owner];
    const cnt = new Map();
    for (let dy = -M.r; dy <= M.r; dy++)
      for (let dx = -M.r; dx <= M.r; dx++) {
        if (dx * dx + dy * dy > M.r * M.r + 1) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const o = this.owner[y * W + x];
        if (o && o !== m.owner) cnt.set(o, (cnt.get(o) || 0) + 1);
      }
    const assets = this._blastAssets(cx + 0.5, cy + 0.5, M.r + 0.5, m.owner, 0, 95);
    let main = null;
    for (const o of new Set([...cnt.keys(), ...assets.keys()])) {
      const v = this.P[o];
      const n = cnt.get(o) || 0;
      const kill = Math.min(v.troops * 0.25, n * (v.troops / Math.max(1, v.tiles)) * 3);
      v.troops = Math.max(0, v.troops - kill);
      const a = assets.get(o) || { structs: 0, units: 0 };
      const rep = { v, kill, structs: a.structs, units: a.units };
      if (!main || kill > main.kill) main = rep;
      if (this.isFriendly(attacker, v) && (a.structs || a.units || kill > 0)) this.breakAlliance(m.owner, o, true);
      this.tell(v, 'bad', `💥 Udar (${M.name}): −${RA.fmt(kill)} vojske${a.structs ? ', ' + a.structs + ' zgrada' : ''}${a.units ? ', ' + a.units + ' jedinica' : ''}.`, m.owner, m.c);
    }
    if (attacker.human) {
      if (main) this.tell(attacker, 'good', `Pogodak (${M.name}) — ${main.v.name}: −${RA.fmt(main.kill)} vojske${main.structs ? ', ' + main.structs + ' zgrada' : ''}${main.units ? ', ' + main.units + ' jedinica' : ''}.`, main.v.id, m.c);
      else this.tell(attacker, 'info', `${M.name}: udar u prazno, ništa vrijedno nije pogođeno.`, attacker.id, m.c);
    }
    this.fx.push({ kind: 'conv', x: m.tx, y: m.ty, r: M.r + 0.5, tick: this.tick });
  };
  P._detonateEmp = function (m) {
    const R = RA.MISSILE.emp.r, tk = this.tick;
    const cx = m.tx, cy = m.ty;
    let ns = 0, nu = 0;
    const hit = new Set();
    for (const s of this.structs) {
      if (s.dead || !s.ready) continue;
      if (RA.dist(s.x + 0.5 - cx, s.y + 0.5 - cy) <= R) {
        s.empUntil = tk + RA.CFG.EMP_DUR;
        if (s.owner !== m.owner) ns++;
        hit.add(s.owner);
      }
    }
    for (const u of this.units) {
      if (u.dead) continue;
      if (RA.dist(u.x - cx, u.y - cy) <= R) {
        u.empUntil = tk + RA.CFG.EMP_DUR;
        if (u.owner !== m.owner) nu++;
        hit.add(u.owner);
      }
    }
    for (const o of hit) {
      const v = this.P[o];
      if (o !== m.owner) this.tell(v, 'bad', '⚡ EMP! Zgrade i jedinice u tom području ne rade 35 s.', m.owner, m.c);
      if (o !== m.owner && this.isFriendly(this.P[m.owner], v)) this.breakAlliance(m.owner, o, true);
    }
    this.tell(this.P[m.owner], 'good', `⚡ EMP: ugašeno ${ns} zgrada i ${nu} jedinica na 35 s.`, m.owner, m.c);
    this.fx.push({ kind: 'emp', x: cx, y: cy, r: R, tick: tk });
  };
  P._splitMirv = function (m) {
    const M = RA.MISSILE.mirv;
    const W = this.map.W;
    let vid = m.victim && this.P[m.victim].alive ? m.victim : this.owner[m.c];
    const v = vid ? this.P[vid] : null;
    this.fx.push({ kind: 'mirvsplit', x: m.tx, y: m.ty, tick: this.tick });
    if (!v || !v.alive || vid === m.owner) return;
    const cx = m.tx, cy = m.ty;
    const picks = [];
    for (let k = 0; k < 4000 && picks.length < M.heads; k++) {
      const c = v.cells[Math.floor(this.rng() * v.tiles)];
      const x = (c % W) + 0.5, y = ((c / W) | 0) + 0.5;
      if (RA.dist(x - cx, y - cy) > M.spread) continue;
      if (picks.some((q) => RA.dist(q[0] - x, q[1] - y) < 7)) continue;
      picks.push([x, y, c]);
    }
    this._mirvRep = this._mirvRep || {};
    this._mirvRep[m.id] = { left: picks.length, v, n: 0, kill: 0, structs: 0, units: 0, owner: m.owner, c: m.c };
    const p = this.P[m.owner];
    for (const [x, y, c] of picks) {
      const w = { id: this.nextId++, owner: m.owner, type: 'warhead', kind: 'warhead', sx: cx, sy: cy, tx: x, ty: y, c, t: 0, dur: 10 + Math.floor(this.rng() * 10), sam: null, samAt: 2, done: false, victim: vid, parent: m.id };
      this._assignSam(w, p);
      this.missiles.push(w);
    }
    this.tell(v, 'bad', `☢☢ MIRV se rasprsnuo iznad tvoje zemlje — ${picks.length} bojevih glava!`, m.owner, m.c);
  };
  P._mirvAcc = function (m, rep) {
    const R = this._mirvRep && this._mirvRep[m.parent];
    if (!R || rep.v !== R.v) return;
    R.n += rep.n;
    R.kill += rep.kill;
    R.structs += rep.structs;
    R.units += rep.units;
  };
  P._mirvHead = function (m) {
    const R = this._mirvRep && this._mirvRep[m.parent];
    if (!R) return;
    R.left--;
    if (R.left > 0) return;
    delete this._mirvRep[m.parent];
    const o = this.P[R.owner];
    this.tell(o, 'good', `☢☢ MIRV je pogodio metu (${R.v.name}): −${R.n} polja, −${RA.fmt(R.kill)} vojske, uništeno ${R.structs} zgrada i ${R.units} jedinica.`, R.v.id, R.c);
    this.tell(R.v, 'bad', `☢☢ MIRV: izgubio si ${R.n} polja, ${RA.fmt(R.kill)} vojske i ${R.structs} zgrada.`, R.owner, R.c);
  };

  /* ---------------- factories & trains ---------------- */
  P.factoryLinks = function (s) {
    if (s.linksAt && this.tick - s.linksAt < 20) return s.links;
    const R = RA.CFG.TRAIN_RANGE, out = [];
    for (const ct of this.cities) if (ct.owner === s.owner && RA.dist(ct.x - s.x, ct.y - s.y) <= R) out.push({ x: ct.x, y: ct.y, c: ct.c, gold: [0, 5000, 7500, 10000][ct.tier] });
    for (const b of this.structs) if (!b.dead && b.ready && b.owner === s.owner && b.type === 'city' && RA.dist(b.x - s.x, b.y - s.y) <= R) out.push({ x: b.x, y: b.y, c: b.c, gold: 6000 });
    s.links = out;
    s.linksAt = this.tick;
    return out;
  };
  P._stepTrains = function () {
    const tk = this.tick;
    for (const s of this.structs) {
      if (s.dead || !s.ready || s.type !== 'factory' || s.empUntil > tk || tk < (s.nextTrain || 0)) continue;
      const dests = this.factoryLinks(s);
      s.nextTrain = tk + Math.round(RA.CFG.TRAIN_EVERY / (1 + 0.12 * Math.min(10, dests.length))) + Math.floor(this.rng() * 30);
      if (!dests.length) continue;
      s.rr = ((s.rr || 0) + 1) % dests.length;
      const d = dests[s.rr];
      const dist = RA.dist(d.x - s.x, d.y - s.y);
      this.trains.push({ id: this.nextId++, owner: s.owner, sx: s.x + 0.5, sy: s.y + 0.5, tx: d.x + 0.5, ty: d.y + 0.5, dc: d.c, gold: d.gold, t: 0, dur: Math.max(8, Math.round(dist / RA.CFG.TRAIN_SPEED)), done: false });
    }
    for (const tr of this.trains) {
      if (tr.done) continue;
      tr.t += 1 / tr.dur;
      if (tr.t < 1) continue;
      tr.done = true;
      const p = this.P[tr.owner];
      if (!p.alive || this.owner[tr.dc] !== tr.owner) continue;
      const g = tr.gold * (p.crisisUntil > tk ? 0.5 : 1);
      p.gold += g;
      p.trainAcc = (p.trainAcc || 0) + g;
      if (p.human) this.fx.push({ kind: 'coin', x: tr.tx, y: tr.ty, v: g, tick: tk, pid: p.id });
    }
    if (tk % 20 === 0) this.trains = this.trains.filter((t) => !t.done);
    if (tk % 100 === 0) {
      // smoothed train income per second for the HUD
      for (const p of this.P) {
        if (!p) continue;
        p.trainRate = (p.trainRate || 0) * 0.5 + ((p.trainAcc || 0) / 10) * 0.5;
        p.trainAcc = 0;
      }
    }
  };

  /* ---------------- paratroopers ---------------- */
  P.paraAirport = function (p, c) {
    const W = this.map.W, tk = this.tick;
    const tx = c % W, ty = (c / W) | 0;
    let best = null, bd = 1e9;
    for (const s of this.structs) {
      if (s.dead || !s.ready || s.owner !== p.id || s.type !== 'airport' || s.cd > tk || s.empUntil > tk) continue;
      const d = RA.dist(s.x - tx, s.y - ty);
      if (d <= RA.CFG.PARA_RANGE && d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };
  P.launchPara = function (pid, c, troops) {
    const p = this.P[pid];
    if (!p || !p.alive) return 'Nisi u igri.';
    if (!RA.ERA.para || RA.STRUCT.airport.na) return 'U ovom dobu nema padobranaca.';
    if (this.defconErr('air')) return this.defconErr('air');
    if (c < 0 || !this.map.land[c]) return 'Padobranci skaču samo na kopno.';
    if (this.zone && this.zoneOut(c)) return 'To je u radioaktivnoj zoni.';
    const o = this.owner[c];
    if (o === pid) return 'To je tvoja teritorija.';
    if (o && this.isFriendly(p, this.P[o])) return 'To je teritorija saveznika.';
    if (o && this.tick < this.peaceUntil) return 'Mirno doba — padobranci zasad smiju samo na slobodnu zemlju.';
    if (!p.n.airport) return 'Treba ti aerodrom.';
    const ap = this.paraAirport(p, c);
    if (!ap) return `Nijedan spreman aerodrom nije u dometu (${RA.CFG.PARA_RANGE} polja).`;
    if (p.gold < RA.CFG.PARA_GOLD) return `Padobranski desant košta ${RA.fmt(RA.CFG.PARA_GOLD)} zlata.`;
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 500) return 'Premalo vojske za desant.';
    p.troops -= troops;
    p.gold -= RA.CFG.PARA_GOLD;
    ap.cd = this.tick + RA.CFG.PARA_CD;
    const W = this.map.W;
    const tx = (c % W) + 0.5, ty = ((c / W) | 0) + 0.5;
    const pl = { id: this.nextId++, owner: pid, sx: ap.x + 0.5, sy: ap.y + 0.5, tx, ty, c, t: 0, dur: Math.max(15, Math.round(RA.dist(tx - ap.x, ty - ap.y) / RA.CFG.PARA_SPEED)), troops, sam: null, samAt: 2, done: false };
    this._assignSam(pl, p);
    this.planes.push(pl);
    const victim = o ? this.P[o] : null;
    if (victim) this.tell(victim, 'bad', `🪂 ${p.name} spušta padobrance iza tvojih linija!`, pid, c);
    if (victim) this.relTo(victim, pid, Math.max(-100, victim.rel[pid] - 20), 'para');
    return pl;
  };
  P._stepPlanes = function () {
    for (const pl of this.planes) {
      if (pl.done) continue;
      pl.t += 1 / pl.dur;
      const p = this.P[pl.owner];
      if (pl.sam && pl.t >= pl.samAt) {
        pl.done = true;
        this.fx.push({ kind: 'intercept', x: pl.sx + (pl.tx - pl.sx) * pl.t, y: pl.sy + (pl.ty - pl.sy) * pl.t, sx: pl.sam.x + 0.5, sy: pl.sam.y + 0.5, tick: this.tick });
        if (pl.kind === 'bomb') {
          p.air = (p.air || []).filter((e) => e.id !== pl.sq);
          this.tell(p, 'bad', 'PVO je oborio tvoje bombardere.', pl.sam.owner, pl.c);
          this.tell(this.P[pl.sam.owner], 'good', 'PVO je oborio neprijateljske bombardere!', pl.owner, pl.c);
          continue;
        }
        this.tell(p, 'bad', `PVO je oborio tvoj avion — izgubljeno ${RA.fmt(pl.troops)} padobranaca.`, pl.sam.owner, pl.c);
        this.tell(this.P[pl.sam.owner], 'good', 'PVO je oborio neprijateljski avion s padobrancima!', pl.owner, pl.c);
        continue;
      }
      // enemy fighters meet it over the target area
      if (!pl.fought && pl.t >= 0.6 && this._dogfight(pl)) continue;
      if (pl.t < 1) continue;
      pl.done = true;
      if (pl.kind === 'bomb') {
        if (p.alive) this._bombHit(pl);
        continue;
      }
      this.fx.push({ kind: 'para', x: pl.tx, y: pl.ty, tick: this.tick });
      if (!p.alive) continue;
      const o = this.owner[pl.c];
      if (o === pl.owner || (this.zone && this.zoneOut(pl.c)) || (o && (this.isFriendly(p, this.P[o]) || this.tick < this.peaceUntil))) {
        p.troops += pl.troops;
        continue;
      }
      this.launchAttack(pl.owner, o, pl.troops, pl.c, pl.c);
      if (o) this.tell(this.P[o], 'bad', `🪂 Padobranci su se spustili na tvoju zemlju (${p.name})!`, pl.owner, pl.c);
    }
    if (this.tick % 20 === 0) this.planes = this.planes.filter((x) => !x.done);
  };
})(RA.Game.prototype);

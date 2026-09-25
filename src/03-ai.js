'use strict';
/* Ratni Atlas — AI for nations (personalities) and city-states.
   Design rule: the AI chooses targets by opportunity and grudges, never by "is it the human". */

RA.PERS = {
  osvajac: { label: 'Osvajač', trig: -0.06, reserve: -0.05, boat: 1.4, fort: 0.6, port: 0.6, nuke: 1.4 },
  trgovac: { label: 'Trgovac', trig: 0.06, reserve: 0.05, boat: 0.8, fort: 0.9, port: 2.0, nuke: 0.7 },
  graditelj: { label: 'Graditelj', trig: 0.02, reserve: 0.08, boat: 0.7, fort: 1.8, port: 1.0, nuke: 1.0 },
};

RA.AI = {
  init(G, p) {
    const r = G.rng;
    const pk = r.pick(Object.keys(RA.PERS));
    const pers = RA.PERS[pk];
    const d = G.diff;
    p.ai = {
      next: G.tick + r.int(3, 30),
      rate: p.type === 'bot' ? [60, 100] : d.rate,
      pers: pk,
      trig: r.int(d.trig[0] * 100, d.trig[1] * 100) / 100 + (p.type === 'bot' ? 0 : pers.trig),
      reserve: r.int(28, 38) / 100 + (p.type === 'bot' ? 0 : pers.reserve),
      expand: r.int(10, 20) / 100,
      lastBoat: -9999,
      lastNuke: -9999,
      lastProposal: -9999,
      thinks: 0,
    };
  },

  scan(G, p) {
    const own = G.owner, land = G.map.land, coast = G.map.coast, W = G.map.W, N = G.map.N;
    const nb = new Map();
    let neutral = 0, coastN = 0, neutralCell = -1;
    const cells = p.cells, pid = p.id;
    for (let i = 0; i < p.tiles; i++) {
      const c = cells[i];
      if (coast[c]) coastN++;
      const x = c % W;
      for (let k = 0; k < 4; k++) {
        const n = k === 0 ? (x > 0 ? c - 1 : -1) : k === 1 ? (x < W - 1 ? c + 1 : -1) : k === 2 ? (c >= W ? c - W : -1) : c < N - W ? c + W : -1;
        if (n < 0 || !land[n]) continue;
        const o = own[n];
        if (o === pid) continue;
        if (!o) {
          if (G.zone && G.zoneOut(n)) continue;
          neutral++;
          if (neutralCell < 0 || G.rng() < 0.02) neutralCell = n;
        } else nb.set(o, (nb.get(o) || 0) + 1);
      }
    }
    return { nb, neutral, neutralCell, coast: coastN };
  },

  think(G, p) {
    const ai = p.ai;
    ai.next = G.tick + G.rng.int(ai.rate[0], ai.rate[1]);
    ai.thinks++;
    if (!p.alive || p.tiles === 0) return;
    for (let i = 0; i < G.P.length; i++) p.rel[i] *= 0.985;
    // aggressive expansion: every state grows cold towards a conqueror (the more states it swallowed, the colder)
    if (p.type === 'nation') {
      for (const o of G.P) if (o && o !== p && o.alive && o.ae > 25 && !p.allies.has(o.id)) p.rel[o.id] = Math.max(-100, p.rel[o.id] - (o.ae - 25) * 0.05);
    }
    const info = RA.AI.scan(G, p);
    p.nbCache = info.nb;
    if (p.type === 'bot') return RA.AI.thinkBot(G, p, info);

    const peace = G.tick < G.peaceUntil;
    RA.AI.diplomacy(G, p, info);
    RA.AI.maybeBuild(G, p, info);
    RA.AI.maybeRecruit(G, p, info);
    if (!peace) {
      RA.AI.maybeStrike(G, p, info);
      RA.AI.maybeNuke(G, p, info);
    }

    const ratio = p.troops / p.maxT;
    // emergency mobilisation when under heavy attack
    if (G.tick - p.attackedAt < 40 && ratio < 0.28 && G.tick >= p.mobReady && G.tick > 900) G.mobilize(p.id);
    // military alliance duty: strike the ally's enemy, or send troops if we can't reach it
    const h = ai.help;
    if (h) {
      const X = G.P[h.target], F = G.P[h.forId];
      if (G.tick > h.until || !X || !X.alive || !F || !F.alive || !G.isFriendly(p, F) || G.isFriendly(p, X) || (X.human && G.tick < G.diff.grace)) ai.help = null;
      else if (info.nb.has(X.id) && ratio > 0.22) {
        G.launchAttack(p.id, X.id, p.troops * 0.35, RA.AI.focusOn(G, p, X));
        G.tell(F, 'ally', `Saveznik ti pomaže: ${p.name} napada neprijatelja (${X.name})!`, p.id, p.capital);
        ai.help = null;
        return;
      } else if (!h.donated && ratio > 0.3) {
        h.donated = true;
        G.donateTroops(p.id, F.id, p.troops * 0.15);
      } else if (h.asked && F.human && !h.told) {
        h.told = true;
        G.tell(F, 'info', `${p.name} nema granicu s neprijateljem (${X.name}) i ne može poslati više pomoći.`, p.id);
      }
    }
    let active = 0;
    for (const a of G.attacks) if (!a.done && a.a === p.id) active++;
    if (active >= 3) return;

    // counter-attack whoever hit us recently
    if (p.lastAttackedBy && G.tick - p.attackedAt < 90 && ratio > 0.3) {
      const X = G.P[p.lastAttackedBy];
      if (X && X.alive && !G.isFriendly(p, X) && info.nb.has(X.id) && p.troops > X.troops * 0.45 && !(X.human && G.tick < G.diff.grace)) {
        G.launchAttack(p.id, X.id, p.troops * 0.35, RA.AI.focusOn(G, p, X));
        return;
      }
    }
    // expand into free land (aim for free cities)
    if (info.neutral > 0 && ratio > ai.expand) {
      const focus = RA.AI.freeCityFocus(G, p) ;
      G.launchAttack(p.id, 0, p.troops * (0.3 + G.rng() * 0.25), focus >= 0 ? focus : info.neutralCell);
      return;
    }
    // war
    if (ratio >= ai.trig && info.nb.size) {
      const tgt = RA.AI.pickTarget(G, p, info);
      if (tgt) {
        const troops = p.troops - ai.reserve * p.maxT;
        if (troops > p.troops * 0.15) {
          G.launchAttack(p.id, tgt.id, troops, RA.AI.focusOn(G, p, tgt));
          return;
        }
      }
    }
    // saturated army and no good target: hit the weakest non-allied neighbour anyway
    if (!peace && ratio >= 0.9 && info.nb.size) {
      let weak = null;
      for (const [oid] of info.nb) {
        const o = G.P[oid];
        if (!o.alive || G.isFriendly(p, o) || (o.human && G.tick < G.diff.grace) || RA.AI.spare(G, p, o)) continue;
        if (o.troops < p.troops * 0.8 && (!weak || o.troops < weak.troops)) weak = o;
      }
      if (weak) {
        G.launchAttack(p.id, weak.id, p.troops * 0.5, RA.AI.focusOn(G, p, weak));
        return;
      }
    }
    // naval landings
    const pers = RA.PERS[ai.pers];
    const isolated = [...info.nb.keys()].every((id) => G.isFriendly(p, G.P[id])) && info.neutral === 0;
    if (info.coast && p.boats < 2 && G.tick - ai.lastBoat > 160 && ratio > 0.42 && (isolated || ratio > 0.9 || G.rng() < 0.05 * pers.boat)) {
      RA.AI.boatAttack(G, p, 0.3);
      return;
    }
    if (!peace && RA.ERA.para && p.n.airport && ratio > 0.5 && G.tick - (ai.lastPara || -9999) > 450 && G.rng() < (isolated ? 0.5 : 0.18)) RA.AI.paraAttack(G, p);
  },

  thinkBot(G, p, info) {
    const ratio = p.troops / p.maxT;
    if (info.neutral > 0 && ratio > 0.15) {
      G.launchAttack(p.id, 0, p.troops * 0.35, info.neutralCell);
      return;
    }
    if (G.rng() < 0.35 && info.nb.size && G.tick >= G.peaceUntil) {
      let best = null;
      for (const [oid] of info.nb) {
        const o = G.P[oid];
        if (!o.alive || G.isFriendly(p, o)) continue;
        if (o.troops < p.troops * 1.1 && (!best || o.troops < best.troops)) best = o;
      }
      if (best && ratio > 0.4) G.launchAttack(p.id, best.id, p.troops * 0.25, -1);
    }
  },

  focusOn(G, p, T) {
    // nearest enemy city to our capital, else -1 (attack spreads along the whole front)
    let best = -1, bd = 1e9;
    const W = G.map.W;
    const px = p.capital % W, py = (p.capital / W) | 0;
    for (const c of G.cities) {
      if (c.owner !== T.id) continue;
      const d = (c.x - px) * (c.x - px) + (c.y - py) * (c.y - py);
      if (d < bd) {
        bd = d;
        best = c.c;
      }
    }
    return bd < 90 * 90 ? best : -1;
  },

  freeCityFocus(G, p) {
    let best = -1, bd = 1e9;
    const W = G.map.W, land = G.map.land;
    const px = p.capital % W, py = (p.capital / W) | 0;
    for (const c of G.cities) {
      if (c.owner !== 0 || !land[c.c] || (G.zone && G.zoneOut(c.c))) continue;
      const d = (c.x - px) * (c.x - px) + (c.y - py) * (c.y - py);
      if (d < bd) {
        bd = d;
        best = c.c;
      }
    }
    return bd < 45 * 45 ? best : -1;
  },

  /* borders game: small states get 3 minutes after the peace before the AI picks on them (unless they hit first) */
  spare(G, p, o) {
    return G.borders && o.type === 'nation' && o.peak < G.map.landArea * 0.005 && G.tick < G.peaceUntil + 1800 && p.lastAttackedBy !== o.id;
  },
  pickTarget(G, p, info) {
    if (G.tick < G.peaceUntil) return null;
    let best = null, bs = 0;
    for (const [oid, border] of info.nb) {
      const o = G.P[oid];
      if (!o.alive || G.isFriendly(p, o)) continue;
      if (o.human && G.tick < G.diff.grace) continue; // newcomer grace period
      const strength = p.troops / Math.max(1, o.troops);
      const hate = Math.max(0, -p.rel[oid]) / 50;
      // balance of power: everybody leans on a runaway leader (human or AI alike)
      const Ld = G.leader;
      const hegemon = Ld && Ld.id === oid && Ld.id !== p.id && Ld.share > 0.26 ? Ld.share : 0;
      if (strength < 1.3 && hate < 1.2 && !(hegemon && strength > 0.12)) continue;
      if (RA.AI.spare(G, p, o)) continue;
      let s = strength * (1 + Math.min(border, 200) / 150) * (1 + hate);
      if (hegemon) s *= 1.6 + (hegemon - 0.26) * 8;
      if (o.type === 'bot') s *= 1.5;
      if (o.traitorUntil > G.tick) s *= 1.6;
      if (p.trade.has(oid)) s *= 0.55;
      if (G.zone && G.zone.state !== 'final') s *= G.zoneSafe(o.capital) ? 1.5 : 0.75;
      // opportunism: someone else is already fighting them
      if (G.attacks.some((a) => !a.done && a.t === oid && a.a !== p.id)) s *= 1.25;
      s *= 0.8 + G.rng() * 0.4;
      if (s > bs) {
        bs = s;
        best = o;
      }
    }
    return best;
  },

  boatAttack(G, p, share) {
    const W = G.map.W;
    const px = p.capital % W, py = (p.capital / W) | 0;
    const pick = RA.AI.coastNear(G, px, py, 170);
    let best = -1, bs = -1;
    for (let k = 0; k < 40; k++) {
      const c = pick();
      if (c < 0) break;
      const o = G.owner[c];
      if (o === p.id) continue;
      if (G.zone && (G.zoneOut(c) || !G.zoneSafe(c))) continue;
      const O = o ? G.P[o] : null;
      if (O && (G.isFriendly(p, O) || G.tick < G.peaceUntil)) continue;
      const d = RA.dist((c % W) - px, ((c / W) | 0) - py);
      if (d > 170) continue;
      let s = 200 - d;
      if (!O) s *= 1.6;
      else if (O.troops > p.troops) s *= 0.3;
      else if (O.type === 'bot') s *= 1.3;
      if (s > bs) {
        bs = s;
        best = c;
      }
    }
    if (best < 0) return;
    const r = G.launchBoat(p.id, best, p.troops * share);
    if (typeof r === 'object') p.ai.lastBoat = G.tick;
    else p.ai.lastBoat = G.tick - 100; // retry a bit later
  },
  /* random coast cells to try a landing on. Small maps (Europe): any coast cell, most are within reach. Big maps
     (the world): only the coast in the box R around (px, py) — rows of the sorted coast list, found by binary search */
  coastNear(G, px, py, R) {
    const L = G.coastList, W = G.map.W, H = G.map.H;
    if ((2 * R + 1) * (2 * R + 1) * 4 >= G.map.N) return () => (L.length ? L[Math.floor(G.rng() * L.length)] : -1);
    const lo = (v) => {
      let a = 0, b = L.length;
      while (a < b) {
        const m = (a + b) >> 1;
        if (L[m] < v) a = m + 1;
        else b = m;
      }
      return a;
    };
    const x0 = Math.max(0, px - R), x1 = Math.min(W - 1, px + R);
    const st = [], acc = [];
    let tot = 0;
    for (let y = Math.max(0, py - R); y <= Math.min(H - 1, py + R); y++) {
      const a = lo(y * W + x0), b = lo(y * W + x1 + 1);
      if (b <= a) continue;
      st.push(a - tot);
      tot += b - a;
      acc.push(tot);
    }
    return () => {
      if (!tot) return -1;
      const r = Math.floor(G.rng() * tot);
      let a = 0, b = acc.length - 1;
      while (a < b) {
        const m = (a + b) >> 1;
        if (acc[m] > r) b = m;
        else a = m + 1;
      }
      return L[st[a] + r];
    };
  },

  sampleCell(G, p, pred, tries) {
    for (let k = 0; k < tries; k++) {
      const c = p.cells[Math.floor(G.rng() * p.tiles)];
      if (pred(c)) return c;
    }
    return -1;
  },
  interior(G, p, c) {
    const own = G.owner, W = G.map.W;
    return own[c - 1] === p.id && own[c + 1] === p.id && own[c - W] === p.id && own[c + W] === p.id && own[c - 2 * W] === p.id && own[c + 2 * W] === p.id;
  },

  maybeBuild(G, p, info) {
    if (G.tick < 120 || p.tiles < 30) return;
    if (G.rng() > G.diff.build) return;
    const pers = RA.PERS[p.ai.pers];
    const ratio = p.troops / p.maxT;
    const cost = (t) => G.structCost(p, t);
    const place = (type, pred) => {
      const c = RA.AI.sampleCell(G, p, (c) => pred(c) && typeof G.canBuild(p, type, c) === 'number', 60);
      if (c >= 0) G.build(p.id, type, c);
      return c >= 0;
    };
    // threatened by a stronger neighbour? fortify that border
    let threat = null;
    for (const [oid, border] of info.nb) {
      const o = G.P[oid];
      if (G.isFriendly(p, o) || border < 6) continue;
      if (o.troops > p.troops * 1.25 && (!threat || o.troops > threat.troops)) threat = o;
    }
    if (threat && p.built.fort < 2 + Math.round(pers.fort) && p.gold >= cost('fort') && G.rng() < 0.5 * pers.fort) {
      const W = G.map.W, own = G.owner, tid = threat.id;
      if (place('fort', (c) => own[c - 1] === tid || own[c + 1] === tid || own[c - W] === tid || own[c + W] === tid || own[c - 2] === tid || own[c + 2] === tid)) return;
    }
    if (info.coast > 0 && p.built.port < Math.round(1 + pers.port) && p.gold >= cost('port') && G.rng() < 0.35 * pers.port) {
      if (place('port', (c) => G.map.coast[c])) return;
    }
    if (ratio > 0.72 && p.built.barracks < 7 && p.gold >= cost('barracks')) {
      if (place('barracks', (c) => RA.AI.interior(G, p, c))) return;
    }
    // economy: new cities and factories (builders and traders love them)
    const eco = p.ai.pers === 'osvajac' ? 0.5 : 1.2;
    if (p.built.city < 6 && p.tiles > 150 && p.gold >= cost('city') * 1.15 && G.rng() < 0.4 * eco) {
      if (place('city', (c) => RA.AI.interior(G, p, c))) return;
    }
    if (p.built.factory < 3 && p.tiles > 250 && p.gold >= cost('factory') * 1.2 && G.rng() < 0.35 * eco) {
      const W = G.map.W;
      const nearCities = (c) => {
        let k = 0;
        for (const ct of G.cities) if (ct.owner === p.id && RA.dist(ct.x - (c % W), ct.y - ((c / W) | 0)) <= RA.CFG.TRAIN_RANGE) k++;
        return k >= 2;
      };
      if (place('factory', (c) => nearCities(c) && RA.AI.interior(G, p, c))) return;
    }
    const S = RA.STRUCT;
    if (!S.airport.na && !p.built.airport && G.tick > 2400 && p.tiles > 400 && p.gold >= cost('airport') * 1.3 && G.rng() < 0.18 * pers.boat) {
      if (place('airport', (c) => RA.AI.interior(G, p, c))) return;
    }
    if (!S.silo.na) {
      const nukes = !RA.MISSILE.atom.na;
      if (nukes) {
        if (G.tick > G.diff.nukeAfter * 0.7 && !p.built.silo && p.gold >= 1.25e6 && G.rng() < 0.5 * pers.nuke && p.tiles > 400) {
          if (place('silo', (c) => RA.AI.interior(G, p, c))) return;
        }
      } else if (G.tick > 1500 && p.built.silo < (p.tiles > 3000 ? 2 : 1) && p.gold >= cost('silo') * 1.4 && G.rng() < 0.3 * pers.nuke && p.tiles > 150) {
        // siege workshops / batteries / hangars have a short range: build them near the front
        const e = RA.AI.frontEnemy(G, p, info);
        const W = G.map.W, own = G.owner;
        const nearFront = (c) => {
          if (!e) return true;
          for (let k = 0; k < 6; k++) {
            const d = (k + 3) * 2;
            if (own[c - d] === e.id || own[c + d] === e.id || own[c - d * W] === e.id || own[c + d * W] === e.id) return true;
          }
          return false;
        };
        if (place('silo', (c) => nearFront(c) && RA.AI.interior(G, p, c))) return;
      }
    }
    // missile defence once somebody has silos
    const enemySilos = !S.sam.na && G.structs.some((s) => !s.dead && s.type === 'silo' && s.owner !== p.id);
    if (enemySilos && p.built.sam < 2 && p.gold >= cost('sam') && p.tiles > 500 && G.rng() < 0.45) {
      const W = G.map.W, cx = p.capital % W, cy = (p.capital / W) | 0;
      const nearCap = (c) => RA.dist((c % W) - cx, ((c / W) | 0) - cy) < 22;
      if (!place('sam', (c) => nearCap(c) && RA.AI.interior(G, p, c))) place('sam', (c) => RA.AI.interior(G, p, c));
    }
  },

  // pick the neighbour we are most worried about (or fighting)
  frontEnemy(G, p, info) {
    let best = null, bs = 0;
    for (const [oid, border] of info.nb) {
      const o = G.P[oid];
      if (!o.alive || G.isFriendly(p, o)) continue;
      let s = (o.troops / Math.max(1, p.troops)) * Math.min(border, 120);
      if (o.id === p.lastAttackedBy && G.tick - p.attackedAt < 300) s *= 3;
      if (G.attacks.some((a) => !a.done && a.a === p.id && a.t === oid)) s *= 2;
      if (s > bs) {
        bs = s;
        best = o;
      }
    }
    return best;
  },
  borderCellFacing(G, p, eid) {
    const own = G.owner, W = G.map.W;
    return RA.AI.sampleCell(G, p, (c) => own[c - 1] === eid || own[c + 1] === eid || own[c - W] === eid || own[c + W] === eid, 160);
  },

  maybeRecruit(G, p, info) {
    if (G.tick < 500 || p.tiles < 60) return;
    if (p.units.length >= G.unitCap(p)) return;
    if (G.rng() > 0.55 * G.diff.build) return;
    const enemy = RA.AI.frontEnemy(G, p, info);
    if (!enemy) return;
    const U = RA.UNIT;
    const can = (t) => !U[t].na && (!U[t].needs || p.n[U[t].needs]);
    let type = null;
    const r = G.rng();
    if (can('tank') && p.gold >= U.tank.gold * 1.2 && p.troops > U.tank.troops * 4 && (p.ai.pers === 'osvajac' ? r < 0.6 : r < 0.3)) type = 'tank';
    else if (can('art') && p.gold >= U.art.gold * 1.2 && p.troops > U.art.troops * 4 && r < 0.55) type = 'art';
    else if (can('inf') && p.gold >= U.inf.gold * 1.1 && p.troops > U.inf.troops * 4) type = 'inf';
    if (!type) return;
    const c = RA.AI.borderCellFacing(G, p, enemy.id);
    if (c >= 0) G.recruitUnit(p.id, type, c);
  },

  // conventional rockets at enemy units/forts on our border, EMP before a big push
  maybeStrike(G, p, info) {
    if (!p.n.silo || G.tick < 1200) return;
    const tk = G.tick;
    const types = ['rocket', 'rocket2'].filter((t) => !RA.MISSILE[t].na);
    const type = types.length > 1 && p.gold >= RA.MISSILE[types[1]].cost * 1.6 && G.rng() < 0.4 ? types[1] : types[0];
    if (type && p.gold >= RA.MISSILE[type].cost * 1.6 && tk - (p.ai.lastRocket || -9999) > 260 && G.rng() < 0.5) {
      // enemy units, then forts / air defence, then (short-range siege weapons) the enemy's border army
      const W = G.map.W;
      const cands = [];
      for (const u of G.units) {
        if (u.dead || !info.nb.has(u.owner) || G.isFriendly(p, G.P[u.owner])) continue;
        cands.push((u.y | 0) * W + (u.x | 0));
      }
      for (const s of G.structs) {
        if (s.dead || !s.ready || !info.nb.has(s.owner) || G.isFriendly(p, G.P[s.owner]) || (s.type !== 'fort' && s.type !== 'sam' && s.type !== 'silo')) continue;
        cands.push(s.c);
      }
      if (!cands.length && RA.MISSILE[type].range) {
        const e = RA.AI.frontEnemy(G, p, info);
        if (e) for (let k = 0; k < 12; k++) cands.push(e.cells[Math.floor(G.rng() * e.tiles)]);
      }
      for (const c of cands) {
        if (!G.strikeSilo(p, type, c, false) || G._strikeDist > 150) continue;
        const r = G.launchMissile(p.id, type, c);
        if (typeof r === 'object') {
          p.ai.lastRocket = tk;
          return;
        }
        break;
      }
    }
    if (!RA.MISSILE.emp.na && p.gold >= RA.MISSILE.emp.cost * 1.5 && tk - (p.ai.lastEmp || -9999) > 1200 && G.rng() < 0.2) {
      const e = RA.AI.frontEnemy(G, p, info);
      if (!e) return;
      const W = G.map.W;
      const units = G.units.filter((u) => !u.dead && u.owner === e.id);
      const forts = G.structs.filter((s) => !s.dead && s.ready && s.owner === e.id && (s.type === 'fort' || s.type === 'sam'));
      if (units.length + forts.length >= 3) {
        const a = units[0] || forts[0];
        const c = a.c !== undefined ? a.c : (a.y | 0) * W + (a.x | 0);
        const r = G.launchMissile(p.id, 'emp', c);
        if (typeof r === 'object') {
          p.ai.lastEmp = tk;
          G.launchAttack(p.id, e.id, p.troops * 0.5, c);
        }
      }
    }
  },

  paraAttack(G, p) {
    if (!RA.ERA.para) return;
    const tgt = RA.AI.pickTarget(G, p, RA.AI.scan(G, p));
    let victim = tgt;
    if (!victim) {
      let bd = 1e9;
      for (const o of G.P) {
        if (!o || !o.alive || o === p || G.isFriendly(p, o)) continue;
        if (o.human && G.tick < G.diff.grace) continue;
        if (o.troops < bd) {
          bd = o.troops;
          victim = o;
        }
      }
    }
    if (!victim) return;
    for (let k = 0; k < 30; k++) {
      const c = victim.cells[Math.floor(G.rng() * victim.tiles)];
      if (G.paraAirport(p, c)) {
        const r = G.launchPara(p.id, c, p.troops * 0.25);
        if (typeof r === 'object') p.ai.lastPara = G.tick;
        return;
      }
    }
    p.ai.lastPara = G.tick - 200;
  },

  maybeNuke(G, p, info) {
    const MI = RA.MISSILE;
    if (MI.atom.na || (MI.atom.from && G.tick < MI.atom.from)) return;
    if (G.tick < G.diff.nukeAfter || !p.n.silo) return;
    if (p.gold < RA.MISSILE.atom.cost * 1.15 || G.tick - p.ai.lastNuke < 900) return;
    const pers = RA.PERS[p.ai.pers];
    if (G.rng() > 0.35 * pers.nuke) return;
    // target: leader (if much bigger than us) or the most hated strong neighbour
    let tgt = null, ts = 0;
    for (const o of G.P) {
      if (!o || !o.alive || o === p || G.isFriendly(p, o) || o.type === 'bot') continue;
      let s = o.tiles / Math.max(1, p.tiles) + Math.max(0, -p.rel[o.id]) / 40;
      if (info.nb.has(o.id)) s *= 1.3;
      if (s > ts) {
        ts = s;
        tgt = o;
      }
    }
    if (!tgt || ts < 1.1) return;
    if (!MI.mirv.na && p.gold >= G.missileCost('mirv') * 1.05 && G.tick > G.diff.nukeAfter * 2 && G.leader && G.leader.id === tgt.id) {
      const c = tgt.cells[Math.floor(G.rng() * tgt.tiles)];
      const r = G.launchMissile(p.id, 'mirv', c);
      if (typeof r === 'object') {
        p.ai.lastNuke = G.tick;
        return;
      }
    }
    const type = !MI.hydro.na && p.gold >= MI.hydro.cost && G.tick > G.diff.nukeAfter * 1.6 ? 'hydro' : 'atom';
    const nk = RA.MISSILE[type];
    // aim at one of their best cities, avoiding our own land
    const W = G.map.W;
    const cands = G.cities.filter((c) => c.owner === tgt.id).sort((a, b) => b.tier - a.tier || b.pop - a.pop).slice(0, 6);
    if (!cands.length) {
      const c = tgt.cells[Math.floor(G.rng() * tgt.tiles)];
      cands.push({ c, x: c % W, y: (c / W) | 0 });
    }
    for (const cand of cands) {
      let mine = 0, tot = 0;
      for (let dy = -nk.r2; dy <= nk.r2; dy += 2)
        for (let dx = -nk.r2; dx <= nk.r2; dx += 2) {
          const x = cand.x + dx, y = cand.y + dy;
          if (x < 0 || y < 0 || x >= W || y >= G.map.H) continue;
          const o = G.owner[y * W + x];
          if (!o) continue;
          tot++;
          if (o === p.id || G.isFriendly(p, G.P[o])) mine++;
        }
      if (tot && mine / tot < 0.08) {
        const r = G.launchMissile(p.id, type, cand.c);
        if (typeof r === 'object') p.ai.lastNuke = G.tick;
        return;
      }
    }
  },

  diplomacy(G, p, info) {
    // renew AI-AI alliances, occasional betrayal, occasional proposals
    const hemmed = info.neutral === 0 && [...info.nb.keys()].every((id) => G.isFriendly(p, G.P[id]));
    const peace = G.tick < G.peaceUntil;
    for (const [oid, exp] of p.allies) {
      const o = G.P[oid];
      if (!peace && hemmed && p.troops / p.maxT > 0.85 && !o.human && info.nb.has(oid) && G.rng() < (p.ai.pers === 'osvajac' ? 0.25 : 0.1)) {
        G.breakAlliance(p.id, oid, true);
        G.launchAttack(p.id, oid, p.troops * 0.5, RA.AI.focusOn(G, p, o));
        return;
      }
      if (exp - G.tick < 400 && !o.human && p.rel[oid] > -5 && G.rng() < (hemmed ? 0.25 : 0.7)) {
        p.allies.set(oid, G.tick + RA.CFG.ALLY_DUR);
        o.allies.set(p.id, G.tick + RA.CFG.ALLY_DUR);
      }
      if (!peace && p.ai.pers === 'osvajac' && G.tick > 3000 && info.nb.has(oid) && o.troops < p.troops * 0.35 && G.rng() < 0.04) {
        G.breakAlliance(p.id, oid, true);
        G.launchAttack(p.id, oid, p.troops * 0.5, RA.AI.focusOn(G, p, o));
        return;
      }
    }
    // trade deals: traders chase them, everybody likes some
    if (p.trade.size < (p.ai.pers === 'trgovac' ? 4 : 2) && G.tick > 150 && G.tick - (p.ai.lastTradeAsk || -9999) > 900 && G.rng() < (peace ? 0.4 : 0.25)) {
      p.ai.lastTradeAsk = G.tick;
      let best = null, bs = -1e9;
      for (const o of G.P) {
        if (!o || !o.alive || o === p || o.type === 'bot' || p.trade.has(o.id) || o.trade.size >= RA.CFG.TRADE_MAX) continue;
        if (o.human && G.tick < 250) continue;
        const sea = p.n.port && o.n.port;
        const land = info.nb.has(o.id);
        if (!sea && !land) continue;
        const sc = p.rel[o.id] + (land ? 8 : 0) + G.rng() * 15;
        if (sc > bs) {
          bs = sc;
          best = o;
        }
      }
      if (best && bs > -10) G.requestTrade(p.id, best.id);
    }
    const Ld = RA.AI.menace(G);
    if (Ld && Ld.id !== p.id && p.allies.has(Ld.id) && G.rng() < 0.3) {
      // nobody stays allied with a hegemon (or a runaway conqueror) for long
      G.breakAlliance(p.id, Ld.id, false);
      p.rel[Ld.id] = Math.min(p.rel[Ld.id], -20);
    }
    if (G.allyCount(p) >= RA.CFG.ALLY_MAX || G.tick - p.ai.lastProposal < 700 || G.tick < 180) return;
    // threatened -> look for a partner among neighbours that is not the threat
    let threat = null;
    for (const [oid] of info.nb) {
      const o = G.P[oid];
      if (!G.isFriendly(p, o) && o.troops > p.troops * 1.4 && o.type !== 'bot') threat = o;
    }
    if (Ld && Ld.id !== p.id && info.nb.has(Ld.id)) threat = Ld;
    if (!threat && G.rng() > (peace ? 0.25 : 0.08)) return;
    let best = null, bs = -1e9;
    for (const [oid] of info.nb) {
      const o = G.P[oid];
      if (o === threat || G.isFriendly(p, o) || o.type === 'bot' || G.allyCount(o) >= RA.CFG.ALLY_MAX) continue;
      if (o.traitorUntil > G.tick) continue;
      const s = p.rel[oid] + (threat && info.nb.has(threat.id) ? 10 : 0) + G.rng() * 10;
      if (s > bs) {
        bs = s;
        best = o;
      }
    }
    if (best && bs > -20) {
      p.ai.lastProposal = G.tick;
      G.requestAlliance(p.id, best.id);
    }
  },

  /* the state the others gang up on: the hegemon (over 30% of the land) or the most aggressive conqueror */
  menace(G) {
    if (G._menaceT === G.tick) return G._menace;
    const Ld = G.leader;
    let m = Ld && Ld.share > 0.3 ? G.P[Ld.id] : null;
    if (!m) {
      let best = RA.CFG.AE_COALITION;
      for (const o of G.P) if (o && o.alive && o.type !== 'bot' && o.ae >= best) {
        best = o.ae;
        m = o;
      }
    }
    G._menaceT = G.tick;
    G._menace = m;
    return m;
  },
  considerAlliance(G, me, other) {
    if (G.allyCount(me) >= RA.CFG.ALLY_MAX || G.allyCount(other) >= RA.CFG.ALLY_MAX) return false;
    if (other.traitorUntil > G.tick) return false;
    const M = RA.AI.menace(G);
    if (M && M.id === other.id && me.type !== 'bot') return false; // nobody helps the hegemon or the conqueror
    if (M && M.id !== other.id && M.id !== me.id) return me.rel[other.id] > -40; // coalition
    const rel = me.rel[other.id];
    if (rel < -30) return false;
    if (me.type === 'bot') return G.rng() < 0.85;
    // shared enemy?
    let common = false;
    for (const a of G.attacks) {
      if (a.done || !a.t) continue;
      if (a.t === me.id && a.a !== other.id && other.rel[a.a] < -10) common = true;
    }
    const s = rel / 45 + RA.clamp(other.troops / Math.max(1, me.troops) - 1, -1, 1.2) * 0.55 + (common ? 0.6 : 0) + (G.rng() - 0.5) * 0.7;
    return s > 0.05;
  },
  considerTrade(G, me, other) {
    if (me.trade.size >= RA.CFG.TRADE_MAX || other.trade.size >= RA.CFG.TRADE_MAX) return false;
    if (G.atWar(me, other)) return false;
    if (me.type === 'bot') return G.rng() < 0.7;
    const rel = me.rel[other.id];
    const bonus = me.ai && me.ai.pers === 'trgovac' ? 0.35 : 0;
    return rel > -25 && G.rng() < 0.55 + bonus + rel / 100;
  },
  considerExtension(G, me, other) {
    return me.rel[other.id] > -10 && !(other.traitorUntil > G.tick);
  },
};

'use strict';
/* Ratni Atlas — two kinds of pacts:
   - trgovinski sporazum (trade): trade ships between ports + land trade across a shared border; both earn gold
   - vojni savez (military alliance, max 2): no attacks between members, and members help each other in war */

Object.assign(RA.CFG, {
  TRADE_MAX: 5,
  TRADE_EVERY: 220,
  TRADE_SHIP_SPEED: 0.9,
  TRADE_LAND_G: 30,
  HELP_WINDOW: 300,
  VASSAL_MAX: 3,
  VASSAL_TROOPS: 0.4, // a vassal-to-be has at most this share of your army…
  VASSAL_AREA: 0.5, // …and of your land
  TRIBUTE: 0.3, // share of a vassal's gold income that goes to its lord
});

(function (P) {
  P.atWar = function (a, b) {
    for (const att of this.attacks) if (!att.done && ((att.a === a.id && att.t === b.id) || (att.a === b.id && att.t === a.id))) return true;
    return false;
  };

  /* ---------------- trade agreements ---------------- */
  P.requestTrade = function (fromId, toId) {
    const a = this.P[fromId], b = this.P[toId];
    const MAX = RA.CFG.TRADE_MAX;
    if (!a || !b || !a.alive || !b.alive || a === b) return 'Nevažeći igrač.';
    if (a.trade.has(toId)) return 'Već imate trgovinski savez.';
    if (a.trade.size >= MAX) return `Najviše ${MAX} trgovinskih saveza.`;
    if (b.trade.size >= MAX) return `${b.name} već ima ${MAX} trgovinskih saveza.`;
    if (this.atWar(a, b)) return 'Ne možete trgovati dok ratujete.';
    if (this.tradeReqs.some((r) => r.from === fromId && r.to === toId)) return 'Ponuda je već poslana.';
    if (b.human && !b.ai) {
      this.tradeReqs.push({ from: fromId, to: toId, exp: this.tick + RA.CFG.ALLY_REQ_DUR });
      return true;
    }
    if (RA.AI.considerTrade(this, b, a)) {
      this.makeTrade(a, b);
      return true;
    }
    this.tell(a, 'info', `${b.name} ne želi trgovati s tobom.`, toId, b.capital);
    return 'declined';
  };
  P.respondTrade = function (fromId, toId, accept) {
    const i = this.tradeReqs.findIndex((r) => r.from === fromId && r.to === toId);
    if (i < 0) return;
    this.tradeReqs.splice(i, 1);
    const a = this.P[fromId], b = this.P[toId];
    if (!accept) {
      a.rel[toId] = Math.max(-100, a.rel[toId] - 5);
      this.tell(a, 'info', `Ponuda za trgovinski savez odbijena (${b.name}).`, toId, b.capital);
      return;
    }
    if (a.trade.size >= RA.CFG.TRADE_MAX || b.trade.size >= RA.CFG.TRADE_MAX) return;
    this.makeTrade(a, b);
  };
  P.makeTrade = function (a, b) {
    a.trade.add(b.id);
    b.trade.add(a.id);
    this.news('trade', a.id, b.id);
    a.rel[b.id] = Math.min(100, a.rel[b.id] + 12);
    b.rel[a.id] = Math.min(100, b.rel[a.id] + 12);
    this.tradeReqs = this.tradeReqs.filter((r) => !((r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id)));
    this.tell(a, 'good', `Trgovinski savez sklopljen: ${b.name} — brodovi i karavani donose zlato objema stranama.`, b.id, b.capital);
    this.tell(b, 'good', `Trgovinski savez sklopljen: ${a.name} — brodovi i karavani donose zlato objema stranama.`, a.id, a.capital);
  };
  P.cancelTrade = function (aid, bid, why) {
    const a = this.P[aid], b = this.P[bid];
    if (!a.trade.has(bid)) return;
    a.trade.delete(bid);
    b.trade.delete(aid);
    b.rel[aid] = Math.max(-100, b.rel[aid] - 10);
    for (const s of this.tships) if (!s.done && ((s.owner === aid && s.partner === bid) || (s.owner === bid && s.partner === aid))) s.done = true;
    this.tell(a, 'info', `Trgovinski savez je prekinut: ${b.name}${why ? ' (' + why + ')' : ''}.`, b.id);
    this.tell(b, 'info', `Trgovinski savez je prekinut: ${a.name}${why ? ' (' + why + ')' : ''}.`, a.id);
  };
  P._portWater = function (s) {
    const map = this.map, W = map.W, H = map.H;
    const x0 = s.c % W, y0 = (s.c / W) | 0;
    for (let r = 1; r <= 2; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = x0 + dx, y = y0 + dy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const c = y * W + x;
          if (!map.land[c] && !map.block[c] && map.wsize[map.wcomp[c]] > 30) return c;
        }
    return -1;
  };
  P._tradePath = function (sa, sb) {
    this.tradePaths = this.tradePaths || new Map();
    const key = sa.id < sb.id ? sa.id + ':' + sb.id : sb.id + ':' + sa.id;
    if (this.tradePaths.has(key)) {
      const p = this.tradePaths.get(key);
      if (!p) return null;
      return p.a === sa.id ? p.path : p.rev;
    }
    const wa = this._portWater(sa), wb = this._portWater(sb);
    const map = this.map;
    if (wa < 0 || wb < 0 || map.wcomp[wa] !== map.wcomp[wb]) {
      this.tradePaths.set(key, null);
      return null;
    }
    const W = map.W, H = map.H, land = map.land, block = map.block;
    const seen = this.stamp, gen = ++this.stampGen, prev = this.bfsPrev, q = this.queue;
    let qh = 0, qt = 0, found = false;
    q[qt++] = wa;
    seen[wa] = gen;
    prev[wa] = -1;
    while (qh < qt && qt < RA.CFG.SEA_CELLS) {
      // (on a big map two far ports would flood an ocean: past SEA_CELLS the route counts as none)
      const c = q[qh++];
      if (c === wb) {
        found = true;
        break;
      }
      const x = c % W, y = (c / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (land[n] || block[n] || seen[n] === gen) continue;
          if (dx && dy && (land[y * W + nx] || land[ny * W + x])) continue;
          seen[n] = gen;
          prev[n] = c;
          q[qt++] = n;
        }
    }
    if (!found) {
      this.tradePaths.set(key, null);
      return null;
    }
    const path = [];
    for (let k = wb; k !== -1; k = prev[k]) path.push(k);
    path.reverse();
    const rec = { a: sa.id, path, rev: path.slice().reverse() };
    this.tradePaths.set(key, rec);
    return rec.a === sa.id ? rec.path : rec.rev;
  };
  P._stepTrade = function () {
    const tk = this.tick;
    // trade ships leave ports towards partners' ports
    for (const s of this.structs) {
      if (s.dead || !s.ready || s.type !== 'port' || s.empUntil > tk || tk < (s.nextTrade || 0)) continue;
      s.nextTrade = tk + RA.CFG.TRADE_EVERY + Math.floor(this.rng() * 60);
      const p = this.P[s.owner];
      if (!p.trade.size) continue;
      const cands = [];
      for (const t of this.structs) {
        if (t.dead || !t.ready || t.type !== 'port' || t.empUntil > tk || !p.trade.has(t.owner)) continue;
        cands.push(t);
      }
      for (let k = 0; k < 3 && cands.length; k++) {
        const t = cands[Math.floor(this.rng() * cands.length)];
        const path = this._tradePath(s, t);
        if (!path || path.length < 3) continue;
        this.tships.push({ id: this.nextId++, owner: s.owner, partner: t.owner, path, pos: 0, gold: 2500 + 40 * Math.min(path.length, 1000), done: false });
        break;
      }
    }
    for (const sh of this.tships) {
      if (sh.done) continue;
      sh.pos += RA.CFG.TRADE_SHIP_SPEED;
      if (sh.pos < sh.path.length - 1) continue;
      sh.done = true;
      const a = this.P[sh.owner], b = this.P[sh.partner];
      if (!a.alive || !b.alive || !a.trade.has(b.id)) continue;
      a.gold += sh.gold;
      b.gold += sh.gold;
      a.tradeAcc = (a.tradeAcc || 0) + sh.gold;
      b.tradeAcc = (b.tradeAcc || 0) + sh.gold;
      const W = this.map.W;
      const end = sh.path[sh.path.length - 1];
      for (const h of [a, b]) if (h.human) this.fx.push({ kind: 'coin', x: (end % W) + 0.5, y: ((end / W) | 0) + 0.5, v: sh.gold, tick: tk, pid: h.id });
    }
    if (tk % 20 === 0) this.tships = this.tships.filter((x) => !x.done);
    // land trade across shared borders (neighbour lists refreshed by the AI scan / UI scan)
    if (tk % 10 === 0) {
      for (const p of this.P) {
        if (!p || !p.alive || !p.trade.size) continue;
        let k = 0;
        for (const id of p.trade) if (p.nbCache && p.nbCache.has(id)) k++;
        p.tradeLand = k;
        const g = RA.CFG.TRADE_LAND_G * 10 * k;
        p.gold += g;
        p.tradeAcc = (p.tradeAcc || 0) + g;
      }
    }
    if (tk % 100 === 0) {
      for (const p of this.P) {
        if (!p) continue;
        p.tradeRate = (p.tradeRate || 0) * 0.5 + ((p.tradeAcc || 0) / 10) * 0.5;
        p.tradeAcc = 0;
        p.tributeRate = (p.tributeRate || 0) * 0.5 + ((p.tributeIn || 0) / 10) * 0.5; // a lord's tribute, per second
        p.tributeIn = 0;
      }
    }
    if (tk % 30 === 0) for (const h of this.P) if (h && h.human && h.alive && !h.ai) h.nbCache = RA.AI.scan(this, h).nb;
    this.tradeReqs = this.tradeReqs.filter((r) => r.exp > tk && this.P[r.from].alive && this.P[r.to].alive);
  };

  /* ---------------- military help ---------------- */
  P.donateTroops = function (fromId, toId, amount) {
    const a = this.P[fromId], b = this.P[toId];
    if (!a || !b || !a.alive || !b.alive) return 'Nevažeći igrač.';
    if (!a.allies.has(toId)) return 'Vojsku možeš slati samo vojnom savezniku.';
    const amt = Math.floor(Math.min(amount, a.troops * 0.9));
    if (amt < 100) return 'Premalo vojske.';
    a.troops -= amt;
    b.troops += amt;
    b.rel[fromId] = Math.min(100, b.rel[fromId] + 10);
    this.tell(b, 'good', `${a.name} ti šalje ${RA.fmt(amt)} vojske.`, fromId, a.capital);
    this.fx.push({ kind: 'donate', from: a.capital, to: b.capital, tick: this.tick });
    return amt;
  };
  // who is `p` currently fighting hardest?
  P.mainEnemy = function (p) {
    let best = null, bt = 0;
    for (const att of this.attacks) {
      if (att.done || !att.t) continue;
      if (att.a === p.id && att.troops > bt && this.P[att.t].alive && !this.isFriendly(p, this.P[att.t])) {
        bt = att.troops;
        best = this.P[att.t];
      }
      if (att.t === p.id && att.troops * 1.2 > bt && this.P[att.a].alive && !this.isFriendly(p, this.P[att.a])) {
        bt = att.troops * 1.2;
        best = this.P[att.a];
      }
    }
    if (!best && p.lastAttackedBy && this.tick - p.attackedAt < 600) {
      const x = this.P[p.lastAttackedBy];
      if (x && x.alive && !this.isFriendly(p, x)) best = x;
    }
    return best;
  };
  P.requestHelp = function (fromId, allyId) {
    const a = this.P[fromId], L = this.P[allyId];
    if (!a || !L || !a.allies.has(allyId)) return 'To nije tvoj vojni saveznik.';
    if (this.tick < this.peaceUntil) return 'Mirno doba — još niko ne ratuje.';
    const enemy = this.mainEnemy(a);
    if (!enemy) return 'Trenutno ne ratuješ ni s kim.';
    if (!L.ai) {
      // a human ally just gets the call
      this.tell(L, 'ally', `${a.nick || a.name} traži pomoć! Neprijatelj: ${enemy.name}.`, a.id, enemy.capital);
      return enemy;
    }
    if (L.ai.helpAsked && this.tick - L.ai.helpAsked < 300) return `${L.name} je već pozvan u pomoć — pričekaj malo.`;
    L.ai.helpAsked = this.tick;
    L.ai.help = { target: enemy.id, forId: fromId, until: this.tick + RA.CFG.HELP_WINDOW, donated: false, asked: true };
    L.ai.next = Math.min(L.ai.next, this.tick + 5);
    return enemy;
  };
  // called when an attack starts: allies of the victim get ready to help; allies of the attacker may join
  /* ---------------- vassals (plan 40) ----------------
     A weak computer state can become your vassal instead of being conquered: a permanent alliance (not counted in the
     limit) — it fights at your side and pays tribute (TRIBUTE of its gold income). It breaks free when its lord gets
     weaker than it, or when the lord releases it (Raskini). Humans are never vassals. */
  P.vassalErr = function (a, b) {
    const C = RA.CFG;
    if (!a || !b || !a.alive || !b.alive || a === b) return 'Nevažeći igrač.';
    if (b.human && !b.ai) return 'Igrač ne može biti vazal.';
    if (b.lord === a.id) return `${b.name} ti je već vazal.`;
    if (b.lord) return `${b.name} je već vazal (${this.P[b.lord].name}).`;
    if (a.lord) return 'Vazal ne može imati vazale.';
    if (this.vassalsOf(b).length) return `${b.name} ima svoje vazale.`;
    if (this.vassalsOf(a).length >= C.VASSAL_MAX) return `Najviše ${C.VASSAL_MAX} vazala.`;
    if (this.sameTeam(a, b)) return 'To je tvoj tim.';
    if (!this.atWar(a, b) && !this.hasBorderWith(a, b.id)) return `${b.name} ti nije susjed.`;
    if (b.troops > a.troops * C.VASSAL_TROOPS || b.area > a.area * C.VASSAL_AREA) return `${b.name} je prejak/a za vazala: treba imati najviše ${Math.round(C.VASSAL_TROOPS * 100)}% tvoje vojske i ${Math.round(C.VASSAL_AREA * 100)}% zemlje.`;
    return '';
  };
  P.vassalsOf = function (p) {
    return this.P.filter((o) => o && o.alive && o.lord === p.id);
  };
  P.offerVassal = function (aid, bid) {
    const a = this.P[aid], b = this.P[bid];
    const err = this.vassalErr(a, b);
    if (err) return err;
    // the weaker and the more beaten, the likelier it bows; a state at war with you gives in easier
    const ratio = b.troops / Math.max(1, a.troops);
    const chance = RA.clamp((RA.CFG.VASSAL_TROOPS + 0.05 - ratio) * 2.5 + (this.atWar(a, b) ? 0.3 : 0) + b.rel[aid] / 200, 0, 0.95);
    if (b.type === 'bot' || this.rng() < chance) {
      this.makeVassal(a, b);
      return true;
    }
    b.rel[aid] = Math.max(-100, b.rel[aid] - 10);
    this.tell(a, 'info', `${b.name} odbija da ti bude vazal. Oslabi je još pa pokušaj ponovo.`, bid, b.capital);
    return 'declined';
  };
  P.makeVassal = function (a, b) {
    // the vassal gives up its other alliances and its wars with the lord
    for (const oid of [...b.allies.keys()]) if (oid !== a.id) this.breakAlliance(b.id, oid, false);
    for (const att of this.attacks) {
      if (att.done) continue;
      if ((att.a === a.id && att.t === b.id) || (att.a === b.id && att.t === a.id)) this._endAttack(att, 0);
    }
    b.lord = a.id;
    a.allies.set(b.id, Infinity);
    b.allies.set(a.id, Infinity);
    b.rel[a.id] = Math.max(b.rel[a.id], 20);
    this.allyReqs = this.allyReqs.filter((r) => r.from !== b.id && r.to !== b.id);
    this.addAE(a, RA.CFG.AE_WAR);
    this.news('vassal', a.id, b.id);
    this.alliancesChanged = true;
    this.tell(a, 'good', `${b.name} je sada tvoj vazal: plaća danak i bori se uz tebe.`, b.id, b.capital);
  };
  P.freeVassal = function (b, why) {
    const a = this.P[b.lord];
    b.lord = 0;
    if (!a) return;
    a.allies.delete(b.id);
    b.allies.delete(a.id);
    this.alliancesChanged = true;
    if (why === 'rebel') {
      b.rel[a.id] = Math.min(b.rel[a.id], -30);
      this.news('rebel', b.id, a.id);
      this.tell(a, 'bad', `${b.name} se oslobodio/la tvoje vlasti — više nisi dovoljno jak.`, b.id, b.capital);
    } else if (why === 'free') this.tell(a, 'info', `${b.name} više nije tvoj vazal.`, b.id, b.capital);
  };
  P._vassals = function () {
    for (const b of this.P) {
      if (!b || !b.lord || !b.alive) continue;
      const a = this.P[b.lord];
      if (!a || !a.alive) this.freeVassal(b);
      else if (a.troops < b.troops * 1.1 && b.area * 1.2 > a.area * RA.CFG.VASSAL_AREA) this.freeVassal(b, 'rebel');
    }
  };

  P._callAllies = function (A, T) {
    const tk = this.tick;
    for (const lid of T.allies.keys()) {
      const L = this.P[lid];
      if (!L || !L.alive || !L.ai || L === A || L.allies.has(A.id)) continue;
      if (L.ai.help && L.ai.help.until > tk && L.ai.help.forId === T.id) continue;
      L.ai.help = { target: A.id, forId: T.id, until: tk + RA.CFG.HELP_WINDOW, donated: false };
    }
    for (const lid of A.allies.keys()) {
      const L = this.P[lid];
      if (!L || !L.alive || !L.ai || L === T || L.allies.has(T.id)) continue;
      if (L.ai.help && L.ai.help.until > tk) continue;
      if (A.human || this.rng() < 0.4) L.ai.help = { target: T.id, forId: A.id, until: tk + RA.CFG.HELP_WINDOW, donated: true, join: true };
    }
  };
})(RA.Game.prototype);

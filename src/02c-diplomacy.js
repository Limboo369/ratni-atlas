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
  // loans (plan 34): from a computer state; sizes = seconds of your income; collateral = share of your land
  LOAN_SECS: [60, 120, 240],
  LOAN_PLEDGE: [0.08, 0.15, 0.25],
  LOAN_RATE: 0.2, // to repay: the amount + 20%
  LOAN_DUE: 3000, // 5 min
  LOAN_MAX: 2,
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
    if (!a || !b || !a.alive || !b.alive || a === b) return RA.t("Invalid player.");
    if (a.trade.has(toId)) return RA.t("You already have a trade pact.");
    if (a.trade.size >= MAX) return RA.t("At most {0} trade pacts.", MAX);
    if (b.trade.size >= MAX) return RA.t("{0} already has {1} trade pacts.", b.name, MAX);
    if (this.atWar(a, b)) return RA.t("You can't trade while at war.");
    if (this.tradeReqs.some((r) => r.from === fromId && r.to === toId)) return RA.t("Offer already sent.");
    if (b.human && !b.ai) {
      this.tradeReqs.push({ from: fromId, to: toId, exp: this.tick + RA.CFG.ALLY_REQ_DUR });
      return true;
    }
    if (RA.AI.considerTrade(this, b, a)) {
      this.makeTrade(a, b);
      return true;
    }
    this.tell(a, 'info', RA.t("{0} doesn't want to trade with you.", b.name), toId, b.capital);
    return 'declined';
  };
  P.respondTrade = function (fromId, toId, accept) {
    const i = this.tradeReqs.findIndex((r) => r.from === fromId && r.to === toId);
    if (i < 0) return;
    this.tradeReqs.splice(i, 1);
    const a = this.P[fromId], b = this.P[toId];
    if (!accept) {
      this.relTo(a, toId, Math.max(-100, a.rel[toId] - 5), 'tdecl');
      this.tell(a, 'info', RA.t("Trade pact offer declined ({0}).", b.name), toId, b.capital);
      return;
    }
    if (a.trade.size >= RA.CFG.TRADE_MAX || b.trade.size >= RA.CFG.TRADE_MAX) return;
    this.makeTrade(a, b);
  };
  P.makeTrade = function (a, b) {
    a.trade.add(b.id);
    b.trade.add(a.id);
    this.news('trade', a.id, b.id);
    this.relTo(a, b.id, Math.min(100, a.rel[b.id] + 12), 'trade');
    this.relTo(b, a.id, Math.min(100, b.rel[a.id] + 12), 'trade');
    this.tradeReqs = this.tradeReqs.filter((r) => !((r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id)));
    this.tell(a, 'good', RA.t("Trade pact made: {0} — ships and caravans bring gold to both sides.", b.name), b.id, b.capital);
    this.tell(b, 'good', RA.t("Trade pact made: {0} — ships and caravans bring gold to both sides.", a.name), a.id, a.capital);
  };
  P.cancelTrade = function (aid, bid, why) {
    const a = this.P[aid], b = this.P[bid];
    if (!a.trade.has(bid)) return;
    a.trade.delete(bid);
    b.trade.delete(aid);
    this.relTo(b, aid, Math.max(-100, b.rel[aid] - 10), 'tcancel');
    for (const s of this.tships) if (!s.done && ((s.owner === aid && s.partner === bid) || (s.owner === bid && s.partner === aid))) s.done = true;
    this.tell(a, 'info', RA.t("Trade pact ended: {0}{1}.", b.name, why ? ' (' + why + ')' : ''), b.id);
    this.tell(b, 'info', RA.t("Trade pact ended: {0}{1}.", a.name, why ? ' (' + why + ')' : ''), a.id);
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
    // a closed strait lets only the closer's friends through, so the way out and the way back may differ
    const oneWay = this.straits.some((s) => s.closed);
    const key = oneWay ? sa.id + '>' + sb.id : sa.id < sb.id ? sa.id + ':' + sb.id : sb.id + ':' + sa.id;
    if (this.tradePaths.has(key)) {
      const p = this.tradePaths.get(key);
      if (!p) return null;
      return p.a === sa.id ? p.path : p.rev;
    }
    const wa = this._portWater(sa), wb = this._portWater(sb);
    const map = this.map;
    if (wa < 0 || wb < 0 || this.wroot[map.wcomp[wa]] !== this.wroot[map.wcomp[wb]]) {
      this.tradePaths.set(key, null);
      return null;
    }
    const W = map.W, H = map.H, land = map.land, block = map.block, stc = this.stc, own = sa.owner;
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
          if (block[n] || seen[n] === gen || !(stc[n] ? this.seaFor(n, own) : !land[n])) continue;
          if (dx && dy && (!this.seaFor(y * W + nx, own) || !this.seaFor(ny * W + x, own))) continue;
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
      if (s.dead || !s.ready || s.type !== 'port' || s.empUntil > tk || s.blocked || tk < (s.nextTrade || 0)) continue;
      s.nextTrade = tk + Math.max(1, Math.round((RA.CFG.TRADE_EVERY / RA.lvf(s, 0.35) + Math.floor(this.rng() * 60)) / this.rtK()));
      const p = this.P[s.owner];
      if (!p.trade.size) continue;
      const cands = [];
      for (const t of this.structs) {
        if (t.dead || !t.ready || t.type !== 'port' || t.empUntil > tk || t.blocked || !p.trade.has(t.owner)) continue;
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
      sh.pos += RA.CFG.TRADE_SHIP_SPEED * this.rtK(); // Focus: the normal speed in real time
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
        p.resRateIn = (p.resRateIn || 0) * 0.5 + ((p.resIn || 0) / 10) * 0.5; // sold resources, per second
        p.resIn = 0;
      }
    }
    if (tk % 30 === 0) for (const h of this.P) if (h && h.human && h.alive && !h.ai) h.nbCache = RA.AI.scan(this, h).nb;
    this.tradeReqs = this.tradeReqs.filter((r) => r.exp > tk && this.P[r.from].alive && this.P[r.to].alive);
  };

  /* ---------------- military help ---------------- */
  P.donateTroops = function (fromId, toId, amount) {
    const a = this.P[fromId], b = this.P[toId];
    if (!a || !b || !a.alive || !b.alive) return RA.t("Invalid player.");
    if (!a.allies.has(toId)) return RA.t("You can send troops only to a military ally.");
    const amt = Math.floor(Math.min(amount, a.troops * 0.9));
    if (amt < 100) return RA.t("Too few troops.");
    a.troops -= amt;
    b.troops += amt;
    this.relTo(b, fromId, Math.min(100, b.rel[fromId] + 10), 'gift');
    this.tell(b, 'good', RA.t("{0} sends you {1} troops.", a.name, RA.fmt(amt)), fromId, a.capital);
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
    if (!a || !L || !a.allies.has(allyId)) return RA.t("That's not your military ally.");
    if (this.tick < this.peaceUntil) return RA.t("Peace time — nobody is at war yet.");
    const enemy = this.mainEnemy(a);
    if (!enemy) return RA.t("You are not at war with anyone right now.");
    if (!L.ai) {
      // a human ally just gets the call
      this.tell(L, 'ally', RA.t("{0} asks for help! Enemy: {1}.", a.nick || a.name, enemy.name), a.id, enemy.capital);
      return enemy;
    }
    if (L.ai.helpAsked && this.tick - L.ai.helpAsked < 300) return RA.t("{0} was already asked for help — wait a little.", L.name);
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
    if (!a || !b || !a.alive || !b.alive || a === b) return RA.t("Invalid player.");
    if (b.human && !b.ai) return RA.t("A player can't be a vassal.");
    if (this.opts.league) return RA.t("No vassals in the league.");
    if (b.lord === a.id) return RA.t("{0} is already your vassal.", b.name);
    if (b.lord) return RA.t("{0} is already a vassal ({1}).", b.name, this.P[b.lord].name);
    if (a.lord) return RA.t("A vassal can't have vassals.");
    if (this.vassalsOf(b).length) return RA.t("{0} has vassals of its own.", b.name);
    if (this.vassalsOf(a).length >= C.VASSAL_MAX) return RA.t("At most {0} vassals.", C.VASSAL_MAX);
    if (this.sameTeam(a, b)) return RA.t("That's your team.");
    if (!this.atWar(a, b) && !this.hasBorderWith(a, b.id)) return RA.t("{0} is not your neighbour.", b.name);
    if (b.troops > a.troops * C.VASSAL_TROOPS || b.area > a.area * C.VASSAL_AREA) return RA.t("{0} is too strong to be a vassal: it may have at most {1}% of your troops and {2}% of your land.", b.name, Math.round(C.VASSAL_TROOPS * 100), Math.round(C.VASSAL_AREA * 100));
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
    this.relTo(b, aid, Math.max(-100, b.rel[aid] - 10), 'vdecl');
    this.tell(a, 'info', RA.t("{0} refuses to be your vassal. Weaken it more and try again.", b.name), bid, b.capital);
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
    this.relTo(b, a.id, Math.max(b.rel[a.id], 20), 'vassal');
    this.allyReqs = this.allyReqs.filter((r) => r.from !== b.id && r.to !== b.id);
    this.addAE(a, RA.CFG.AE_WAR);
    this.news('vassal', a.id, b.id);
    this.alliancesChanged = true;
    this.tell(a, 'good', RA.t("{0} is now your vassal: it pays tribute and fights at your side.", b.name), b.id, b.capital);
  };
  P.freeVassal = function (b, why) {
    const a = this.P[b.lord];
    b.lord = 0;
    if (!a) return;
    a.allies.delete(b.id);
    b.allies.delete(a.id);
    this.alliancesChanged = true;
    if (why === 'rebel') {
      this.relTo(b, a.id, Math.min(b.rel[a.id], -30), 'rebel');
      this.news('rebel', b.id, a.id);
      this.tell(a, 'bad', RA.t("{0} has broken free of your rule — you are no longer strong enough.", b.name), b.id, b.capital);
    } else if (why === 'free') this.tell(a, 'info', RA.t("{0} is no longer your vassal.", b.name), b.id, b.capital);
  };
  P._vassals = function () {
    for (const b of this.P) {
      if (!b || !b.lord || !b.alive) continue;
      const a = this.P[b.lord];
      if (!a || !a.alive) this.freeVassal(b);
      else if (a.troops < b.troops * 1.1 && b.area * 1.2 > a.area * RA.CFG.VASSAL_AREA) this.freeVassal(b, 'rebel');
    }
  };

  /* ---------------- loans with collateral (plan 34) ----------------
     A computer state lends you gold; part of your land nearest to it is the pledge (marked on the map). Repay the
     amount + LOAN_RATE within LOAN_DUE (it is taken automatically when due, if you have the gold) — otherwise the
     pledged land still yours goes to the lender. */
  P.loanOffer = function (p, L, size) {
    const C = RA.CFG, secs = C.LOAN_SECS[size];
    const amount = Math.round(Math.max(20000, ((p.goldRate || 0) - (p.tributeRate || 0)) * secs) / 1000) * 1000;
    return { amount, owed: Math.round(amount * (1 + C.LOAN_RATE)), cells: Math.max(1, Math.round(p.tiles * C.LOAN_PLEDGE[size])) };
  };
  P.loanErr = function (p, L, size) {
    const C = RA.CFG;
    if (!p || !L || !p.alive || !L.alive || p === L) return RA.t("Invalid player.");
    if (!Number.isInteger(size) || size < 0 || size >= C.LOAN_SECS.length) return RA.t("Invalid loan.");
    if (L.human && !L.ai) return RA.t("Only computer states give loans.");
    if (L.type === 'bot') return RA.t("A city-state doesn't have that much gold.");
    const mine = this.loans.filter((l) => l.to === p.id);
    if (mine.some((l) => l.from === L.id)) return RA.t("You already owe {0}.", L.name);
    if (mine.length >= C.LOAN_MAX) return RA.t("At most {0} loans at once.", C.LOAN_MAX);
    if (this.atWar(p, L)) return RA.t("No loans while you are at war.");
    if (p.tiles < 12) return RA.t("Not enough land to pledge.");
    const o = this.loanOffer(p, L, size);
    if (L.gold < o.amount * 1.2) return RA.t("{0} doesn't have that much gold.", L.name);
    return '';
  };
  P.requestLoan = function (pid, lid, size) {
    const p = this.P[pid], L = this.P[lid];
    const err = this.loanErr(p, L, size);
    if (err) return err;
    const o = this.loanOffer(p, L, size);
    // the lender trusts friends and trade partners; a trader likes to lend
    const trust = L.rel[pid] / 100 + (L.trade.has(pid) ? 0.25 : 0) + (L.allies.has(pid) ? 0.3 : 0) + (L.ai && L.ai.pers === 'trgovac' ? 0.2 : 0);
    if (L.rel[pid] < -15 || this.rng() > 0.6 + trust) {
      this.tell(p, 'info', RA.t("{0} won't give you a loan.", L.name), lid, L.capital);
      return 'declined';
    }
    // the pledge: your land nearest to the lender (never your capital)
    const W = this.map.W, lx = L.capital % W, ly = (L.capital / W) | 0;
    const cand = [];
    for (let i = 0; i < p.tiles; i++) {
      const c = p.cells[i];
      if (c === p.capital) continue;
      const dx = (c % W) - lx, dy = ((c / W) | 0) - ly;
      cand.push([dx * dx + dy * dy, c]);
    }
    cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cells = Int32Array.from(cand.slice(0, o.cells), (x) => x[1]);
    L.gold -= o.amount;
    p.gold += o.amount;
    const loan = { id: ++this.loanSeq, from: lid, to: pid, amount: o.amount, owed: o.owed, due: this.tick + RA.CFG.LOAN_DUE, cells };
    this.loans.push(loan);
    this.tell(p, 'good', RA.t("Loan from {0}: +{1} gold. Repay {2} within {3} min, or {4} takes the pledged land ({5} cells).", L.name, RA.fmt(o.amount), RA.fmt(o.owed), Math.round(RA.CFG.LOAN_DUE / 600), L.name, cells.length), lid, L.capital);
    return { loan: loan.id, amount: o.amount };
  };
  P.repayLoan = function (pid, id, auto) {
    const i = this.loans.findIndex((l) => l.id === id && l.to === pid);
    if (i < 0) return RA.t("No such loan.");
    const l = this.loans[i], p = this.P[pid], L = this.P[l.from];
    if (p.gold < l.owed) return RA.t("You need {0} gold.", RA.fmt(l.owed));
    p.gold -= l.owed;
    if (L && L.alive) {
      L.gold += l.owed;
      this.relTo(L, pid, Math.min(100, L.rel[pid] + 10), 'loan');
    }
    this.loans.splice(i, 1);
    this.tell(p, 'good', auto ? RA.t("Due date: loan repaid ({0}, {1} gold). The pledge is free.", L ? L.name : '', RA.fmt(l.owed)) : RA.t("Loan repaid ({0}, {1} gold). The pledge is free.", L ? L.name : '', RA.fmt(l.owed)), l.from);
    return true;
  };
  P._loans = function () {
    for (let i = this.loans.length - 1; i >= 0; i--) {
      const l = this.loans[i], p = this.P[l.to], L = this.P[l.from];
      if (!p.alive || !L || !L.alive) {
        this.loans.splice(i, 1);
        if (p.alive) this.tell(p, 'info', RA.t("The debt is gone: {0} has fallen.", L ? L.name : RA.t("state")), l.from);
        continue;
      }
      if (l.due > this.tick) continue;
      if (this.repayLoan(p.id, l.id, true) === true) continue;
      // not paid: the pledged land that is still yours goes to the lender
      let n = 0;
      for (const c of l.cells) if (this.owner[c] === p.id && c !== p.capital) {
        this.setOwner(c, L.id);
        n++;
      }
      this.loans.splice(i, 1);
      this.relTo(L, p.id, Math.max(-100, L.rel[p.id] - 25), 'pledge');
      this.news('pledge', L.id, p.id);
      this.tell(p, 'bad', RA.t("You didn't repay the loan: {0} takes the pledged land ({1} cells).", L.name, n), L.id, L.capital);
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

'use strict';
/* Offers and demands between states (plan 15): "Zahtijevaj" what the other state has and "Nudim" what I give — gold,
   an army (only between military allies), a city with its land, a resource (their supply for a while) or opening a
   closed strait. The other side accepts, refuses or makes a counter-offer (more gold, another resource, …) until they
   agree. A computer state answers at once from what the deal is worth to it and what it thinks of you.
   A bundle is {g: gold, t: troops, c: city index (-1 none), r: resource slot (-1), s: strait index (-1)}. */
Object.assign(RA.CFG, {
  OFFER_TTL: 1200, // ticks an offer waits for an answer
  OFFER_MAX: 3, // pending offers per sender
  RES_GIFT: 3000, // ticks a resource given in a deal is supplied
  DEAL_R: 3, // cells around a city that go with it
});

(function (P) {
  const EMPTY = { g: 0, t: 0, c: -1, r: -1, s: -1 };
  /* args from other devices: numbers in range, anything else dropped */
  P.offerClean = function (b) {
    b = b && typeof b === 'object' ? b : {};
    const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
    return { g: int(b.g, 0, 1e10, 0), t: int(b.t, 0, 1e10, 0), c: int(b.c, 0, this.cities.length - 1, -1), r: int(b.r, 0, 2, -1), s: int(b.s, 0, (this.straits || []).length - 1, -1) };
  };
  P.offerEmpty = (b) => !b.g && !b.t && b.c < 0 && b.r < 0 && b.s < 0;
  /* can `from` give bundle b to `to` now? null or the reason why not */
  P.offerErr = function (from, to, b) {
    if (b.g && from.gold < b.g) return RA.t("{0} doesn't have {1} gold.", from.name, RA.fmt(b.g));
    if (b.t && !from.allies.has(to.id)) return RA.t("Only a military ally can send troops.");
    if (b.t && from.troops * 0.9 < b.t) return RA.t("{0} doesn't have that many troops.", from.name);
    if (b.c >= 0) {
      const ct = this.cities[b.c];
      if (!ct || ct.owner !== from.id) return RA.t("That city isn't theirs.");
      if (from.capCity === ct.i) return RA.t("A capital can't be given away.");
    }
    if (b.r >= 0 && (!this.deps || !from.res || !from.res[b.r])) return RA.t("{0} doesn't have that resource.", from.name);
    if (b.s >= 0) {
      const st = this.straits[b.s];
      if (!st || st.closed !== from.id) return RA.t("{0} hasn't closed that strait.", from.name);
    }
    return null;
  };
  /* what a bundle is worth (in gold) */
  P.offerValue = function (b) {
    let v = b.g + b.t * 1.5 + (b.r >= 0 ? 150000 : 0) + (b.s >= 0 ? 200000 : 0);
    if (b.c >= 0) {
      const ct = this.cities[b.c];
      v += 250000 * (1 + (ct ? ct.tier : 0)) + this._dealCells(b.c, ct ? ct.owner : 0).length * 3000;
    }
    return v;
  };
  /* the land that goes with a city: its owner's cells within DEAL_R of it */
  P._dealCells = function (ci, owner) {
    const ct = this.cities[ci], W = this.map.W, R = RA.CFG.DEAL_R, out = [];
    if (!ct || !owner) return out;
    const x0 = ct.c % W, y0 = (ct.c / W) | 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || x >= W || y < 0 || y >= this.map.H) continue;
      const c = y * W + x;
      if (this.owner[c] === owner) out.push(c);
    }
    return out;
  };
  P._dealGive = function (from, to, b) {
    if (b.g) {
      from.gold -= b.g;
      to.gold += b.g;
    }
    if (b.t) {
      from.troops -= b.t;
      to.troops += b.t;
    }
    if (b.c >= 0) for (const c of this._dealCells(b.c, from.id)) this.setOwner(c, to.id);
    if (b.r >= 0) (to.giftRes || (to.giftRes = [0, 0, 0]))[b.r] = this.tick + RA.CFG.RES_GIFT;
    if (b.s >= 0) this._setStrait(this.straits[b.s], 0);
  };
  /* a new offer from pid: give = what pid gives, want = what pid demands */
  P.makeOffer = function (pid, to, give, want, round) {
    const p = this.P[pid], q = this.P[to];
    if (!q || !q.alive || q === p || q.type === 'bot') return RA.t("Invalid state.");
    give = this.offerClean(give);
    want = this.offerClean(want);
    if (this.offerEmpty(give) && this.offerEmpty(want)) return RA.t("Choose what you demand or offer.");
    const e = this.offerErr(p, q, give) || this.offerErr(q, p, want);
    if (e) return e;
    if (this.offers.filter((o) => o.from === pid).length >= RA.CFG.OFFER_MAX) return RA.t("You are already waiting for an answer to three offers.");
    this.offers = this.offers.filter((o) => !(o.from === pid && o.to === to));
    const o = { id: this.nextId++, from: pid, to, give, want, tick: this.tick, round: round || 1 };
    if (q.ai && !q.human) return this._aiAnswer(o);
    this.offers.push(o);
    this.tell(q, 'info', RA.t("{0} sends you an offer (Alliances → Offers).", p.name), pid, p.capital);
    return { st: 'sent', id: o.id };
  };
  /* the computer's answer: accept, a counter-offer (it asks for more gold) or no */
  P._aiAnswer = function (o) {
    const p = this.P[o.from], q = this.P[o.to];
    const rel = q.rel[p.id];
    const need = this.offerValue(o.want) * (1.15 - rel * 0.003); // what it gives, weighted by what it thinks of you
    const get = this.offerValue(o.give);
    if (rel < -40) return this._offerEnd(o, 'no', RA.t("{0} won't even talk to you.", q.name));
    if (get >= need) return this._offerDeal(o);
    const more = Math.ceil((need - get) / 1000) * 1000;
    if (o.round < 3 && p.gold >= o.give.g + more) {
      // a counter-offer: the same deal for more of your gold
      const c = { id: this.nextId++, from: q.id, to: p.id, give: o.want, want: Object.assign({}, o.give, { g: o.give.g + more }), tick: this.tick, round: o.round + 1 };
      this.offers.push(c);
      this.tell(p, 'info', RA.t("{0} wants {1} more gold for that deal (Alliances → Offers).", q.name, RA.fmt(more)), q.id, q.capital);
      return { st: 'counter', id: c.id, more };
    }
    return this._offerEnd(o, 'no', RA.t("{0} declines the offer — it's not enough for them.", q.name));
  };
  P._offerEnd = function (o, st, msg) {
    this.offers = this.offers.filter((x) => x.id !== o.id);
    const p = this.P[o.from];
    if (p && p.human && msg) this.tell(p, 'info', msg, o.to);
    return { st, id: o.id };
  };
  P._offerDeal = function (o) {
    const p = this.P[o.from], q = this.P[o.to];
    const e = this.offerErr(p, q, o.give) || this.offerErr(q, p, o.want);
    if (e) return this._offerEnd(o, 'no', RA.t("Deal failed: {0}", e));
    this._dealGive(p, q, o.give);
    this._dealGive(q, p, o.want);
    this.offers = this.offers.filter((x) => x.id !== o.id);
    this.relTo(p, q.id, Math.min(100, p.rel[q.id] + 5), 'deal');
    this.relTo(q, p.id, Math.min(100, q.rel[p.id] + 5), 'deal');
    this.news('deal', p.id, q.id);
    for (const x of [p, q]) if (x.human) this.tell(x, 'good', `Dogovor: ${p.name} i ${q.name}.`, x === p ? q.id : p.id);
    return { st: 'deal', id: o.id };
  };
  /* the answer to an offer made to pid: yes / no / counter (give, want of the counter-offer from pid) */
  P.answerOffer = function (pid, id, ans, give, want) {
    const o = this.offers.find((x) => x.id === id && x.to === pid);
    if (!o) return RA.t("That offer is no longer valid.");
    if (ans === 'yes') return this._offerDeal(o);
    if (ans === 'no') {
      this.offers = this.offers.filter((x) => x.id !== id);
      this.relTo(this.P[o.from], pid, this.P[o.from].rel[pid] - 2, 'tdecl');
      if (this.P[o.from].human) this.tell(this.P[o.from], 'info', RA.t("{0} declines your offer.", this.P[pid].name), pid);
      return { st: 'no' };
    }
    if (ans === 'counter') {
      this.offers = this.offers.filter((x) => x.id !== id);
      return this.makeOffer(pid, o.from, give, want, o.round + 1);
    }
    return RA.t("Invalid answer.");
  };
  P._stepOffers = function () {
    if (this.offers.length && this.tick % 50 === 0) this.offers = this.offers.filter((o) => this.tick - o.tick < RA.CFG.OFFER_TTL && this.P[o.from].alive && this.P[o.to].alive);
  };
  P.offerText = function (b) {
    const out = [];
    if (b.g) out.push(RA.t("{0} gold", RA.fmt(b.g)));
    if (b.t) out.push(RA.t("{0} troops", RA.fmt(b.t)));
    if (b.c >= 0) out.push(RA.t("the city of {0} with its surroundings", this.cities[b.c] ? this.cities[b.c].name : '?'));
    if (b.r >= 0) out.push(RA.t("{0} (5 min)", RA.resKind(b.r, this.era).name));
    if (b.s >= 0) out.push(RA.t("opening: {0}", this.straits[b.s] ? this.straits[b.s].name : RA.t("strait")));
    return out.join(', ') || RA.t("nothing");
  };
  P.EMPTY_OFFER = EMPTY;
})(RA.Game.prototype);

'use strict';
/* Weapons research (Darko, 27. 9.; with the tech tree, opts.tree — Focus has it): pay gold, wait while it is researched,
   then a weapon is better for the rest of the game. One research at a time; command 'rsch' [key].
   The combat code asks: G.wRange / G.wRad / G.droneMul / G.samR / G.samCd / G.unitSpd / G.armor. */
RA.RSCH = {
  drone: { name: 'Dronovi', icon: 'drone', max: 3, desc: '+25% štete dronova po nivou' },
  range: { name: 'Domet', icon: 'rocket', max: 3, desc: '+20% dometa raketa i dronova po nivou' },
  blast: { name: 'Razorna moć', icon: 'nuke', max: 2, desc: '+1 polje kruga udara raketa i dronova lovaca' },
  sam: { name: 'Protivvazdušna odbrana', icon: 'sam', max: 3, desc: '+20% dometa i 15% brže punjenje PVO po nivou' },
  armor: { name: 'Oklop', icon: 'tank', max: 3, desc: 'jedinice gube 12% manje snage u borbi i od udara po nivou' },
  speed: { name: 'Pokretljivost', icon: 'send', max: 3, desc: 'jedinice se kreću 15% brže po nivou' },
};
RA.RSCH_ORDER = ['drone', 'range', 'blast', 'sam', 'armor', 'speed'];
Object.assign(RA.CFG, {
  RSCH_COST: 150000, // × 2^level
  RSCH_SECS: 60, // × (level + 1): seconds of research (Focus: real seconds; otherwise ×10 ticks)
});

(function (P) {
  P.rsLv = function (p, k) {
    return (p && p.rs && p.rs[k]) | 0;
  };
  P.rsCost = function (p, k) {
    return Math.round(RA.CFG.RSCH_COST * RA.dpow(2, this.rsLv(p, k)) * (p.bCost || 1));
  };
  /* how long research of the next level takes, in the game's clock (Focus seconds, else ticks) */
  P.rsTime = function (p, k) {
    const secs = RA.CFG.RSCH_SECS * (this.rsLv(p, k) + 1);
    return this.sub ? secs : secs * 10;
  };
  P.startResearch = function (pid, k) {
    const p = this.P[pid], R = RA.RSCH[k];
    if (!this.opts.tree) return 'Istraživanje je uz stablo tehnologija — nije uključeno u ovoj igri.';
    if (!p || !p.alive) return 'Nisi u igri.';
    if (!R) return 'Nepoznato istraživanje.';
    if (p.rsBusy) return `Već istražuješ: ${RA.RSCH[p.rsBusy.k].name}.`;
    const lv = this.rsLv(p, k);
    if (lv >= R.max) return `${R.name} je već na najvišem nivou.`;
    const cost = this.rsCost(p, k);
    if (p.gold < cost) return `Za ${R.name} ${lv + 1} treba ${RA.fmt(cost)} zlata.`;
    p.gold -= cost;
    p.rsBusy = { k, lv: lv + 1, from: this.clock(), done: this.clock() + this.rsTime(p, k) };
    return { k, lv: lv + 1, done: p.rsBusy.done };
  };
  /* research that is done (every second in Focus, every tick otherwise) */
  P._stepResearch = function () {
    const now = this.clock();
    for (const p of this.P) {
      if (!p || !p.rsBusy || p.rsBusy.done > now) continue;
      const { k, lv } = p.rsBusy;
      (p.rs || (p.rs = {}))[k] = lv;
      p.rsBusy = null;
      this.tell(p, 'good', `Istraženo: ${RA.RSCH[k].name} ${lv} (${RA.RSCH[k].desc}).`, p.id);
    }
  };
  // what the research changes
  P.wRange = function (p, type) {
    const M = RA.MISSILE[type];
    return M.range ? M.range * (1 + 0.2 * this.rsLv(p, 'range')) : 0;
  };
  P.wRad = function (p, type) {
    return RA.MISSILE[type].r + this.rsLv(p, 'blast');
  };
  P.droneMul = function (p) {
    return 1 + 0.25 * this.rsLv(p, 'drone');
  };
  P.samR = function (owner) {
    return RA.CFG.SAM_R * (1 + 0.2 * this.rsLv(owner, 'sam'));
  };
  P.samCd = function (owner, cd) {
    return Math.round(cd * (1 - 0.15 * this.rsLv(owner, 'sam')));
  };
  P.unitSpd = function (owner) {
    return 1 + 0.15 * this.rsLv(owner, 'speed');
  };
  P.armor = function (owner) {
    return 1 - 0.12 * this.rsLv(owner, 'armor');
  };
})(RA.Game.prototype);

/* the computer researches too, now and then, with spare gold */
RA.AI.maybeResearch = function (G, p) {
  if (!G.opts.tree || p.rsBusy || G.rng() > 0.05) return;
  const ks = RA.RSCH_ORDER.filter((k) => G.rsLv(p, k) < RA.RSCH[k].max);
  if (!ks.length) return;
  const k = ks[Math.floor(G.rng() * ks.length)];
  if (p.gold >= G.rsCost(p, k) * 1.5) G.startResearch(p.id, k);
};

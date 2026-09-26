'use strict';
/* Weapons research (Darko, 27. 9.; with the tech tree, opts.tree — Focus has it): pay gold, wait while it is researched,
   then a weapon is better for the rest of the game. One research at a time; command 'rsch' [key].
   The combat code asks: G.wRange / G.wRad / G.droneMul / G.samR / G.samCd / G.unitSpd / G.armor. */
RA.RSCH = {
  drone: { name: RA.t("Drones"), icon: 'drone', max: 3, desc: RA.t("+25% drone damage per level") },
  range: { name: RA.t("Range"), icon: 'rocket', max: 3, desc: RA.t("+20% missile and drone range per level") },
  blast: { name: RA.t("Blast power"), icon: 'nuke', max: 2, desc: RA.t("+1 cell of blast radius for missiles and hunter drones") },
  sam: { name: RA.t("Air defence{=2}"), icon: 'sam', max: 3, desc: RA.t("+20% range and 15% faster air-defence reload per level") },
  armor: { name: RA.t("Armour"), icon: 'tank', max: 3, desc: RA.t("units lose 12% less strength in battle and from strikes per level") },
  speed: { name: RA.t("Mobility"), icon: 'send', max: 3, desc: RA.t("units move 15% faster per level") },
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
    if (!this.opts.tree) return RA.t("Research comes with the tech tree — it is off in this game.");
    if (!p || !p.alive) return RA.t("You are not in the game.");
    if (!R) return RA.t("Unknown research.");
    if (p.rsBusy) return RA.t("Already researching: {0}.", RA.RSCH[p.rsBusy.k].name);
    const lv = this.rsLv(p, k);
    if (lv >= R.max) return RA.t("{0} is already at the top level.", R.name);
    const cost = this.rsCost(p, k);
    if (p.gold < cost) return RA.t("{0} {1} needs {2} gold.", R.name, lv + 1, RA.fmt(cost));
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
      this.tell(p, 'good', RA.t("Researched: {0} {1} ({2}).", RA.RSCH[k].name, lv, RA.RSCH[k].desc), p.id);
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

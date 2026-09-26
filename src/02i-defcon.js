'use strict';
/* DEFCON mode (plan 48, opts.gm === 'defcon'): five stages on a clock, each unlocking more:
   DEFCON 5 building and alliances, no attacks on states → 4 land attacks → 3 sea and air (landings, paratroopers,
   warships, bombers) → 2 conventional strikes (rockets, EMP, drones) → 1 nuclear weapons.
   When the clock runs out the winner is who kept the most cities and people (not just land); 70% of the land still
   wins at once. Nuclear missiles in flight are shown to everyone anyway (radar). */
Object.assign(RA.CFG, {
  DEFCON_STEP: 1800, // 3 min per stage
  DEFCON_END: 15000, // 25 min
});
RA.DEFCON_NAMES = { 5: RA.t("building and alliances"), 4: RA.t("land attacks"), 3: RA.t("sea and air"), 2: RA.t("missiles"), 1: RA.t("nukes") };
RA.DEFCON_NEED = { land: 4, sea: 3, air: 3, conv: 2, nuke: 1 };

(function (P) {
  /* the stage now: 5…1 (0 = not a DEFCON game) */
  P.defcon = function () {
    if (this.opts.gm !== 'defcon') return 0;
    return Math.max(1, 5 - Math.floor(this.tick / RA.CFG.DEFCON_STEP));
  };
  /* '' when allowed, else why not (what: land, sea, air, conv, nuke) */
  P.defconErr = function (what) {
    const d = this.defcon(), need = RA.DEFCON_NEED[what];
    if (!d || d <= need) return '';
    const at = (5 - need) * RA.CFG.DEFCON_STEP;
    const txt = { land: RA.t("Attacks on states"), sea: RA.t("Ships and landings"), air: RA.t("Air force and paratroopers"), conv: RA.t("Missile strikes"), nuke: RA.t("Nuclear weapons") }[what];
    return RA.t("DEFCON {0}: {1} are allowed from DEFCON {2} (in {3}).", d, txt, need, RA.dur(at - this.tick));
  };
  /* what a state kept: its cities (bigger count more) and the cities it built */
  P.defconScore = function (p) {
    let s = 0;
    for (const ct of this.cities) if (ct.owner === p.id) s += (ct.tier + 1) * 10 + Math.round((ct.pop || 0) / 50000);
    return s + (p.bcities ? p.bcities.length * 10 : 0);
  };
  /* the clock ran out: the best score wins (a co-op team counts together) */
  P._defconEnd = function () {
    if (this.opts.gm !== 'defcon' || this.state !== 'play' || this.continued || this.tick < RA.CFG.DEFCON_END) return;
    let best = null, bs = -1;
    const sides = new Map();
    for (const p of this.P) {
      if (!p || !p.alive || !p.spawned || p.type === 'bot') continue;
      const k = p.team ? -p.team : p.id;
      const sd = sides.get(k) || { s: 0, best: null };
      sd.s += this.defconScore(p);
      if (!sd.best || p.area > sd.best.area) sd.best = p;
      sides.set(k, sd);
    }
    for (const sd of sides.values()) if (sd.s > bs) {
      bs = sd.s;
      best = sd.best;
    }
    if (!best) return;
    this.winner = best;
    this.state = 'over';
    this._history();
    this.tellAll('over', RA.t("DEFCON — time is up. Winner by cities and population: {0} ({1} points)", best.name, bs), best.id);
  };
})(RA.Game.prototype);

'use strict';
/* Building levels (Darko, 27. 9.): a ready building can be upgraded to level 2 and 3 (it keeps working meanwhile).
   Command 'up' [building id]. Price: its base price × 1.5 × the level it has; time: its build time × that level.
   What a level adds (RA.UP_DESC): cities and ports more gold (and cities army), barracks army and one more unit slot,
   factories faster trains, silos / domes / air defence / airfields faster reload, forts a wider ring, the intelligence
   agency one more agent. p.lvx[type] = the extra levels of p's ready buildings of that type. */
RA.UP_MAX = 3;
RA.UP_DESC = {
  city: RA.t("+50% gold and army capacity of this city per level"),
  port: RA.t("+50% gold from this port and faster trade ships per level"),
  barracks: RA.t("+50% army capacity and +1 unit slot per level"),
  factory: RA.t("Trains 35% more often per level"),
  silo: RA.t("Reloads 30% faster per level"),
  dome: RA.t("Reloads 30% faster per level"),
  sam: RA.t("Reloads 30% faster per level"),
  airport: RA.t("Paratroopers and planes ready 30% faster per level"),
  fort: RA.t("The defended ring is 25% wider per level"),
  intel: RA.t("+1 agent per level"),
};
(function (P) {
  const lvf = (s, k) => 1 + k * (((s && s.lv) || 1) - 1); // the level factor of one building
  RA.lvf = lvf;
  P.lvx = function (p, type) {
    return (p && p.lvx && p.lvx[type]) | 0;
  };
  P._lvAdd = function (p, type, d) {
    if (!p) return;
    const L = p.lvx || (p.lvx = {});
    L[type] = Math.max(0, (L[type] | 0) + d);
  };
  P.upCost = function (p, s) {
    return Math.round(RA.STRUCT[s.type].cost(0) * 1.5 * (s.lv || 1) * (p.bCost || 1));
  };
  P.upgrade = function (pid, sid) {
    const p = this.P[pid], s = Number.isInteger(sid) ? this.structs[sid] : null;
    if (!p || !p.alive) return RA.t("You are not in the game.");
    if (!s || s.dead || s.owner !== pid) return RA.t("That is not your building.");
    if (!RA.UP_DESC[s.type]) return RA.t("This building has no levels.");
    if (!s.ready) return RA.t("First let it finish.");
    if (s.upTo) return RA.t("It is being upgraded already.");
    if ((s.lv || 1) >= RA.UP_MAX) return RA.t("It is at the top level.");
    const cost = this.upCost(p, s);
    if (p.gold < cost) return RA.t("The upgrade costs {0} gold.", RA.fmt(cost));
    p.gold -= cost;
    s.upTo = (s.lv || 1) + 1;
    const time = RA.STRUCT[s.type].time * (s.lv || 1);
    if (this.sub) s.upSt = this.st + Math.max(1, Math.ceil(time * RA.CFG.FOCUS_BUILD));
    else s.upAt = this.tick + time;
    return { up: s.id, lv: s.upTo };
  };
  /* upgrades that are done (with construction: every second in Focus, every tick otherwise) */
  P._stepUpgrade = function () {
    for (const s of this.structs) {
      if (!s.upTo || s.dead || (s.upSt ? this.st < s.upSt : this.tick < s.upAt)) continue;
      s.lv = s.upTo;
      s.upTo = 0;
      s.upSt = s.upAt = 0;
      const p = this.P[s.owner];
      this._lvAdd(p, s.type, 1);
      this.tell(p, 'good', RA.t("{0} upgraded to level {1}.", s.type === 'city' ? s.name : RA.STRUCT[s.type].name, s.lv), p.id, s.c);
    }
  };
})(RA.Game.prototype);

/* the computer upgrades now and then, when it has gold to spare */
RA.AI.maybeUpgrade = function (G, p) {
  if (G.rng() > 0.01 || p.gold < 1.5e6) return;
  const own = G.structs.filter((s) => !s.dead && s.ready && s.owner === p.id && !s.upTo && (s.lv || 1) < RA.UP_MAX && RA.UP_DESC[s.type]);
  if (!own.length) return;
  const s = own[Math.floor(G.rng() * own.length)];
  if (p.gold > G.upCost(p, s) * 3) G.upgrade(p.id, s.id);
};

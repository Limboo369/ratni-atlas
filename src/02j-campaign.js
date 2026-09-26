'use strict';
/* Campaign (plan 56) — the simulation side: a mission's setup and the dynasty's lasting upgrades.
   opts.camp = { type, bonus: {mil, eco, dip, sci} } (levels 0…5 of the tech tree); the UI (08k-campaign.js) checks
   the goal. Everything here happens at the game's start from the game's own state, so a saved mission replays the same. */
RA.CAMP_TREE = {
  mil: { name: 'Vojska', desc: '+5% rasta vojske i +10% početne vojske po nivou' },
  eco: { name: 'Ekonomija', desc: '+6% zlata po nivou' },
  dip: { name: 'Diplomatija', desc: 'države te na početku više vole (+8 po nivou), lakši savezi' },
  sci: { name: 'Nauka', desc: 'zgrade, jedinice i rakete 5% jeftinije po nivou' },
};

(function (P) {
  /* at the start: the dynasty's upgrades on the player, and what the mission needs (target, enemies) */
  P.campSetup = function () {
    const c = this.opts.camp, me = this.me;
    if (!c || !me) return;
    const b = c.bonus || {}, lv = (k) => Math.max(0, Math.min(5, b[k] | 0));
    me.bGold = 1 + 0.06 * lv('eco');
    me.bGrow = 1 + 0.05 * lv('mil');
    me.bCost = 1 - 0.05 * lv('sci');
    me.troops *= 1 + 0.1 * lv('mil');
    for (const o of this.P) if (o && o !== me && o.rel) this.relTo(o, me.id, Math.min(100, o.rel[me.id] + 8 * lv('dip')), 'tech');
    // neighbours at the start, weakest and strongest
    const nb = this.P.filter((o) => o && o.alive && o !== me && o.type === 'nation' && this.hasBorderWith(me, o.id)).sort((x, y) => x.area - y.area || x.id - y.id);
    const all = this.P.filter((o) => o && o.alive && o !== me && o.type === 'nation').sort((x, y) => x.area - y.area || x.id - y.id);
    const pool = nb.length ? nb : all;
    this.camp = { type: c.type, target: 0, t0: this.tick, share0: me.area / this.landTotal(), cities0: this.campCities(me) };
    if (!pool.length) return;
    if (c.type === 'conquerWeak') this.camp.target = pool[0].id;
    if (c.type === 'conquerStrong' || c.type === 'defend') this.camp.target = pool[pool.length - 1].id;
    const T = this.P[this.camp.target];
    if (c.type === 'defend' && T) {
      // a stronger enemy wants your capital
      T.troops *= 1.8;
      this.relTo(T, me.id, -100, 'camp');
    }
    if (c.type === 'survive') {
      // every neighbour gangs up on you (as on a runaway conqueror)
      for (const o of pool) this.relTo(o, me.id, -100, 'camp');
      me.ae = 100;
      me.aeWarn = true;
    }
  };
  P.campCities = function (p) {
    let n = 0;
    for (const ct of this.cities) if (ct.owner === p.id && ct.tier >= 1) n++;
    return n + (p.bcities ? p.bcities.length : 0);
  };
})(RA.Game.prototype);

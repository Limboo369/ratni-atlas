'use strict';
/* Production queue (Darko, 27. 9.): order units ahead; each comes out as soon as there is gold, troops and a free unit
   slot — even while you are away in Focus. A new land unit goes to the border facing the state you are at war with
   (the one with most attacks between you), otherwise next to the capital; a ship leaves the port nearest the capital.
   Command 'queue' [type, +1 | -1 | 0 (clear)]; p.queue = [types], first in first out, at most QUEUE_MAX. */
RA.CFG.QUEUE_MAX = 10;
(function (P) {
  P.queueCmd = function (pid, type, d) {
    const p = this.P[pid];
    if (!p || !p.alive) return RA.t("You are not in the game.");
    const q = p.queue || (p.queue = []);
    if (d === 0) {
      q.length = 0;
      return { queue: 0 };
    }
    if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(RA.UNIT, type) || RA.UNIT[type].na) return RA.t("Unknown unit.");
    if (d < 0) {
      const i = q.lastIndexOf(type);
      if (i >= 0) q.splice(i, 1);
      return { queue: q.length };
    }
    if (q.length >= RA.CFG.QUEUE_MAX) return RA.t("The queue is full ({0}).", RA.CFG.QUEUE_MAX);
    q.push(type);
    return { queue: q.length, type };
  };
  /* where the next unit of p goes */
  P._queueCell = function (p, type) {
    if (RA.UNIT[type].naval) return p.capital;
    const tally = new Map();
    for (const a of this.attacks) {
      if (a.done) continue;
      const o = a.a === p.id ? a.t : a.t === p.id ? a.a : 0;
      if (o && this.P[o] && this.P[o].alive && !this.isFriendly(p, this.P[o])) tally.set(o, (tally.get(o) || 0) + 1);
    }
    let foe = 0, best = 0;
    for (const [o, n] of tally) if (n > best || (n === best && o < foe)) (best = n), (foe = o);
    if (foe) {
      const c = RA.AI.borderCellFacing(this, p, foe);
      if (c >= 0) return c;
    }
    return p.capital >= 0 && this.owner[p.capital] === p.id ? p.capital : p.tiles ? p.cells[0] : -1;
  };
  /* every second in Focus, every second of ticks otherwise */
  P._stepQueue = function () {
    if (!this.sub && this.tick % 10) return;
    for (const p of this.P) {
      if (!p || !p.alive || !p.queue || !p.queue.length) continue;
      const type = p.queue[0], U = RA.UNIT[type];
      if (U.na) {
        p.queue.shift();
        continue;
      }
      if (p.units.length >= this.unitCap(p) || (U.needs && !p.n[U.needs]) || p.gold < this.unitCost(p, type) || p.troops < U.troops * 1.2) continue;
      const c = this._queueCell(p, type);
      const u = c >= 0 ? this.recruitUnit(p.id, type, c) : null;
      if (u && typeof u === 'object') {
        p.queue.shift();
        this.tell(p, 'good', RA.t("From the production queue: {0}{1}.", U.name, p.queue.length ? RA.t(" ({0} more in the queue)", p.queue.length) : ''), p.id, c);
      }
    }
  };
})(RA.Game.prototype);

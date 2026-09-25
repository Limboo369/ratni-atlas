'use strict';
/* Resources and trade (plan 12 + 35), an option of the game (opts.res; off = the quick casual game as before).
   Three kinds per era: food (grain), metal (iron, from 1914 steel) and fuel (wood, 1815 coal, from 1914 oil), from
   deposits at real places (RA.DEPOSITS, src/01b-deposits.js). Every state starts with at least one kind and none with
   all three. Nothing is ever blocked without a resource, it is only dearer or slower:
   no food → the army grows slower; no metal → units cost more; no fuel → buildings and missiles cost more.
   No exchange: a trade partner that has a kind sells it to you directly, for a share of your gold income for as long
   as you buy (the more deposits it has, the cheaper). */
RA.RES = [
  { id: 'food', icon: 'wheat', lack: 'vojska raste 15% sporije' },
  { id: 'metal', icon: 'ore', lack: 'jedinice su 30% skuplje' },
  { id: 'fuel', icon: 'fuel', lack: 'zgrade i rakete su 30% skuplje' },
];
Object.assign(RA.CFG, {
  RES_FOOD: 0.85, // army growth without food
  RES_DEAR: 1.3, // units without metal, buildings and missiles without fuel
  RES_EVERY: 20, // ticks between recounts of deposits and imports
});
/* the kind of a slot in an era: its name and which deposits count */
RA.resKind = function (slot, era) {
  const i = Math.max(0, RA.ERAS.findIndex((e) => e.id === era)), steel = i >= 3;
  if (slot === 0) return { dep: 'food', name: 'Žito' };
  if (slot === 1) return { dep: 'iron', name: steel ? 'Čelik' : 'Željezo' };
  return i <= 1 ? { dep: 'wood', name: 'Drvo' } : i === 2 ? { dep: 'coal', name: 'Ugalj' } : { dep: 'oil', name: 'Nafta' };
};

(function (P) {
  /* place the deposits of this game (at the start, when every state has its land) and balance them */
  P.resInit = function () {
    const map = this.map, N = map.N, D = RA.DEPOSITS[map.id] || {};
    this.depAt = new Uint8Array(N); // cell -> slot + 1
    this.deps = [];
    for (let s = 0; s < 3; s++) {
      for (const c of D[RA.resKind(s, this.era).dep] || []) {
        if (c < N && map.land[c] && !map.block[c] && !this.depAt[c]) {
          this.depAt[c] = s + 1;
          this.deps.push(c);
        }
      }
    }
    const players = this.P.filter((p) => p && p.alive && p.spawned && p.type !== 'bot');
    for (const p of players) {
      this._resCount(p);
      const have = p.res.filter((n) => n > 0).length;
      if (have === 0 && p.tiles > 1) {
        // at least one: a deposit of the kind that is rarest on the map, somewhere in its land
        const tot = [0, 0, 0];
        for (const c of this.deps) tot[this.depAt[c] - 1]++;
        const s = tot.indexOf(Math.min(...tot));
        let c = p.cells[Math.floor(this.rng() * p.tiles)];
        if (c === p.capital) c = p.cells[(this.cellPos[c] + 1) % p.tiles];
        if (!this.depAt[c]) {
          this.depAt[c] = s + 1;
          this.deps.push(c);
        }
      } else if (have === 3) {
        // never all three: it loses the kind it has least of (it can buy it)
        const s = p.res.indexOf(Math.min(...p.res));
        for (let i = 0; i < p.tiles; i++) if (this.depAt[p.cells[i]] === s + 1) this.depAt[p.cells[i]] = 0;
      }
    }
    this.deps = this.deps.filter((c) => this.depAt[c]).sort((a, b) => a - b);
    for (const p of this.P) if (p) this._resCount(p);
  };
  P._resCount = function (p) {
    const r = [0, 0, 0];
    const own = this.owner;
    if (this.deps) for (const c of this.deps) if (own[c] === p.id) r[this.depAt[c] - 1]++;
    p.res = r;
    if (!p.imp) p.imp = [0, 0, 0];
  };
  /* does p have this kind: its own deposit or a purchase */
  P.hasRes = function (p, s) {
    return !this.opts.res || !p.res || p.res[s] > 0 || p.imp[s] > 0;
  };
  /* the share of the buyer's gold income a seller asks for one kind */
  P.resRate = function (seller, s) {
    return 0.06 + 0.12 / Math.max(1, seller.res[s]);
  };
  P.unitCost = function (p, type) {
    const g = RA.UNIT[type].gold;
    return p && !this.hasRes(p, 1) ? Math.round(g * RA.CFG.RES_DEAR) : g;
  };
  P.buyRes = function (pid, s, sid) {
    const p = this.P[pid];
    if (!this.opts.res) return 'Resursi nisu uključeni u ovoj igri.';
    if (!Number.isInteger(s) || s < 0 || s > 2) return 'Nevažeći resurs.';
    const name = RA.resKind(s, this.era).name;
    if (!sid) {
      if (p.imp[s]) this.tell(p, 'info', `Više ne kupuješ: ${name}.`, p.imp[s]);
      p.imp[s] = 0;
      return true;
    }
    const q = this.P[sid];
    if (!q || !q.alive || q === p) return 'Nevažeći igrač.';
    if (!p.trade.has(sid)) return `Za kupovinu treba trgovinski savez (${q.name}).`;
    if (!q.res || !q.res[s]) return `${q.name} nema: ${name}.`;
    if (p.res[s]) return `Već imaš svoje: ${name}.`;
    p.imp[s] = sid;
    this.tell(p, 'good', `Kupuješ ${name} od ${q.name}: ${Math.round(this.resRate(q, s) * 100)}% tvog prihoda dok kupuješ.`, sid, q.capital);
    return { s, sid };
  };
  /* recount deposits, drop purchases that no longer work */
  P._stepRes = function () {
    for (const p of this.P) {
      if (!p || !p.alive || !p.res) continue;
      this._resCount(p);
      for (let s = 0; s < 3; s++) {
        const sid = p.imp[s];
        if (!sid) continue;
        const q = this.P[sid];
        let why = '';
        if (p.res[s]) why = 'imaš svoje';
        else if (!q || !q.alive) why = 'prodavac je pao';
        else if (!p.trade.has(sid)) why = 'nema više trgovinskog saveza';
        else if (!q.res[s]) why = 'prodavac ga više nema';
        if (why) {
          p.imp[s] = 0;
          this.tell(p, 'info', `Kupovina prekinuta (${RA.resKind(s, this.era).name}): ${why}.`, sid);
        }
      }
    }
  };
  /* pay the sellers out of this tick's income g; returns what is left of g */
  P._payRes = function (p, g) {
    let fee = 0;
    for (let s = 0; s < 3; s++) {
      const sid = p.imp[s];
      if (!sid) continue;
      const q = this.P[sid], f = g * this.resRate(q, s);
      q.gold += f;
      q.resIn = (q.resIn || 0) + f;
      fee += f;
    }
    p.resFee = fee * 10;
    return g - fee;
  };
})(RA.Game.prototype);

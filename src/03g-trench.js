'use strict';
/* Trenches (Darko, 27. 9.): dig a line along the border with one state. Attackers crossing a trench cell lose more and
   are slower (less than a fort's ring, but along a whole stretch of border). A trench belongs to the land it is on:
   when that cell is lost the trench there is gone.
   Command 'dig' [cell of my land at the border]: the trench follows my border cells that touch the same neighbour,
   up to TRENCH_LEN cells from the tapped one (at most TRENCH_CELLS per dig), paid per cell, ready after TRENCH_SECS.
   A state may hold at most TRENCH_MAX trench cells. G.trench[c]: 0 none, 1 being dug, 2 ready. */
Object.assign(RA.CFG, {
  TRENCH_LEN: 14,
  TRENCH_CELLS: 30,
  TRENCH_MAX: 120,
  TRENCH_GOLD: 5000, // per cell
  TRENCH_SECS: 30,
  TRENCH_MAG: 1.8, // attackers' losses on a trench cell ×
  TRENCH_SPD: 1.6, // …and their slowness ×
});
(function (P) {
  P.trenchOf = function (c) {
    return this.trench ? this.trench[c] : 0;
  };
  /* the neighbouring state along whose border c lies (the one touching c), 0 if none */
  P._borderFoe = function (p, c) {
    const W = this.map.W, own = this.owner, x = c % W;
    for (const n of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W]) {
      if (n < 0 || n >= this.map.N) continue;
      const o = own[n];
      if (o && o !== p.id && this.map.land[n]) return o;
    }
    return 0;
  };
  P.dig = function (pid, c) {
    const p = this.P[pid], C = RA.CFG, map = this.map, W = map.W, own = this.owner;
    if (!p || !p.alive) return RA.t("You are not in the game.");
    if (c < 0 || own[c] !== pid) return RA.t("Tap your own land at the border.");
    const foe = this._borderFoe(p, c);
    if (!foe) return RA.t("Trenches go along a border with another state — tap your land right at it.");
    if (!this.trench) this.trench = new Uint8Array(map.N);
    const have = (p.trenchN | 0);
    if (have >= C.TRENCH_MAX) return RA.t("You have the most trenches already ({0} cells).", C.TRENCH_MAX);
    // my border cells touching foe, reachable from c along such cells, near c
    const cx = c % W, cy = (c / W) | 0, touches = (n) => this._borderFoe(p, n) === foe || [n - 1, n + 1, n - W, n + W].some((m) => m >= 0 && m < map.N && own[m] === foe);
    const seen = new Set([c]), q = [c], cells = [];
    while (q.length && cells.length < C.TRENCH_CELLS) {
      const k = q.shift();
      if (!this.trench[k]) cells.push(k);
      const kx = k % W;
      for (const n of [kx > 0 ? k - 1 : -1, kx < W - 1 ? k + 1 : -1, k - W, k + W, k - W - 1, k - W + 1, k + W - 1, k + W + 1]) {
        if (n < 0 || n >= map.N || seen.has(n) || own[n] !== pid || !map.land[n]) continue;
        const nx = n % W, ny = (n / W) | 0;
        if (Math.abs(nx - kx) > 1 || (nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) > C.TRENCH_LEN * C.TRENCH_LEN || !touches(n)) continue;
        seen.add(n);
        q.push(n);
      }
    }
    const n = Math.min(cells.length, C.TRENCH_MAX - have);
    if (!n) return RA.t("This stretch of border has trenches already.");
    const cost = Math.round(n * C.TRENCH_GOLD * (p.bCost || 1));
    if (p.gold < cost) return RA.t("Trenches here ({0} cells) cost {1} gold.", n, RA.fmt(cost));
    p.gold -= cost;
    p.trenchN = have + n;
    const use = cells.slice(0, n);
    for (const k of use) this.trench[k] = 1;
    (this.trenchCells || (this.trenchCells = [])).push(...use); // for drawing (cells whose trench is gone are skipped)
    (this.trenchJobs || (this.trenchJobs = [])).push({ pid, cells: use, at: this.clock() + (this.sub ? C.TRENCH_SECS : C.TRENCH_SECS * 10) });
    return { dig: n, foe, cost };
  };
  /* trenches that are dug (with construction) */
  P._stepTrench = function () {
    if (!this.trenchJobs || !this.trenchJobs.length) return;
    const now = this.clock();
    this.trenchJobs = this.trenchJobs.filter((j) => {
      if (j.at > now) return true;
      let k = 0;
      for (const c of j.cells) if (this.trench[c] === 1 && this.owner[c] === j.pid) (this.trench[c] = 2), k++;
      if (k) this.tell(this.P[j.pid], 'good', RA.t("Trenches dug ({0} cells).", k), j.pid, j.cells[0]);
      return false;
    });
  };
  /* a cell changes hands: its trench is gone */
  P._trenchLost = function (c, old) {
    if (!this.trench || !this.trench[c]) return;
    this.trench[c] = 0;
    if (old && this.P[old]) this.P[old].trenchN = Math.max(0, (this.P[old].trenchN | 0) - 1);
  };
})(RA.Game.prototype);

/* the computer digs in along the border of a state that attacks it, now and then, when it has gold */
RA.AI.maybeTrench = function (G, p) {
  if (G.rng() > 0.01 || p.gold < 1e6 || (p.trenchN | 0) >= RA.CFG.TRENCH_MAX / 2) return;
  const foe = p.lastAttackedBy && G.tick - p.attackedAt < 300 ? G.P[p.lastAttackedBy] : null;
  if (!foe || !foe.alive || foe.type === 'bot') return;
  const c = RA.AI.borderCellFacing(G, p, foe.id);
  if (c >= 0) G.dig(p.id, c);
};

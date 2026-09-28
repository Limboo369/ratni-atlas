'use strict';
/* Presentation only: connected earthworks, with lighter dashed excavation.
   Read the live cell state; never modify simulation arrays from the renderer. */
RA.Trenches = {
  draw(ctx, G, cell, gx, gy, inView) {
    if (!G.trenchCells || !G.trench || cell < 1.2) return;
    const W = G.map.W, N = G.map.N, owner = G.owner;
    const cells = new Set(G.trenchCells.filter(c => G.trench[c] && owner[c]));
    const visible = new Set();
    for (const c of cells) {
      const x = c % W, y = (c / W) | 0;
      if (inView(gx(x + .5), gy(y + .5), cell * 2) && !RA.Clouds.hidden(G, x, y)) visible.add(c);
    }
    const ready = new Path2D(), digging = new Path2D(), timbers = new Path2D();
    const same = (a, b) => b >= 0 && b < N && cells.has(b) && owner[a] === owner[b];
    const segment = (path, x, y, ex, ey, seed, detail) => {
      const dx = ex - x, dy = ey - y, len = Math.hypot(dx, dy);
      if (!len) return;
      const nx = -dy / len, ny = dx / len;
      const bend = cell >= 9 ? Math.min(cell * .18, 4) * (seed % 2 ? 1 : -1) : 0;
      path.moveTo(x, y);
      path.lineTo(x + dx * .3, y + dy * .3);
      path.lineTo(x + dx * .3 + nx * bend, y + dy * .3 + ny * bend);
      path.lineTo(x + dx * .7 + nx * bend, y + dy * .7 + ny * bend);
      path.lineTo(x + dx * .7, y + dy * .7);
      path.lineTo(ex, ey);
      if (detail && cell >= 9) {
        const mx = x + dx * .5 + nx * bend, my = y + dy * .5 + ny * bend;
        const r = Math.min(cell * .12, 2.5);
        timbers.moveTo(mx - nx * r, my - ny * r);
        timbers.lineTo(mx + nx * r, my + ny * r);
      }
    };
    for (const c of visible) {
      const cx = c % W, cy = (c / W) | 0, x = gx(cx + .5), y = gy(cy + .5);
      const built = G.trench[c] === 2, path = built ? ready : digging;
      let linked = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || cx + dx < 0 || cx + dx >= W) continue;
        const n = c + dy * W + dx;
        if (!same(c, n) || !visible.has(n)) continue;
        // A diagonal bridges a staircase only when no orthogonal link exists.
        if (dx && dy && (same(c, c + dx) || same(c, c + dy * W))) continue;
        segment(path, x, y, x + dx * cell * .5, y + dy * cell * .5, Math.min(c, n), built);
        linked = true;
      }
      if (!linked) {
        const vertical = [cx ? c - 1 : -1, cx < W - 1 ? c + 1 : -1].some(n => n >= 0 && n < N && owner[n] && owner[n] !== owner[c]);
        const d = cell * .4;
        segment(path, x - (vertical ? 0 : d), y - (vertical ? d : 0), x + (vertical ? 0 : d), y + (vertical ? d : 0), c, built);
      }
    }
    const width = RA.clamp(cell * .52, 2.8, 12);
    ctx.save();
    ctx.lineJoin = 'miter'; ctx.lineCap = 'butt'; ctx.miterLimit = 2;
    ctx.setLineDash([]);
    // Dark outer edge, earthen parapets, then the recessed channel.
    ctx.strokeStyle = '#332d23'; ctx.lineWidth = width + 1.4; ctx.stroke(ready);
    ctx.strokeStyle = '#ac9467'; ctx.lineWidth = width; ctx.stroke(ready);
    ctx.strokeStyle = '#292821'; ctx.lineWidth = Math.max(1.1, width * .44); ctx.stroke(ready);
    ctx.strokeStyle = '#c6ad7c'; ctx.lineWidth = .8; ctx.stroke(timbers);
    // Construction is a dashed survey/excavation line, never a finished dark channel.
    ctx.setLineDash([Math.max(3, cell * .35), Math.max(2, cell * .2)]);
    ctx.strokeStyle = 'rgba(38,34,27,.75)'; ctx.lineWidth = Math.max(2.5, width * .75); ctx.stroke(digging);
    ctx.strokeStyle = '#d2b878'; ctx.lineWidth = Math.max(1, width * .3); ctx.stroke(digging);
    ctx.restore();
  },
};

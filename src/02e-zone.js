'use strict';
/* Ratni Atlas — battle royale: a radioactive ring closes in on a random spot; everything outside it is lost for
   good. Pure integer/IEEE math on grid coordinates, so every device of an online game shrinks it identically. */

Object.assign(RA.CFG, {
  BR_DELAY: 900, // first shrink starts 90 s after the opening peace
  BR_SHRINK: 450, // a shrink lasts 45 s...
  BR_HOLD: 450, // ...then the ring holds 45 s
  BR_PHASES: 6,
  BR_FACTOR: 0.6,
  BR_MIN_R: 9,
});
RA.dcos = (a) => RA.dsin(a + 1.5707963267948966);

(function (P) {
  P.zoneInit = function () {
    const map = this.map, W = map.W, N = map.N;
    const land = [];
    let sx = 0, sy = 0;
    for (let c = 0; c < N; c++) {
      if (!map.land[c] || map.block[c]) continue;
      land.push(c);
      sx += c % W;
      sy += (c / W) | 0;
    }
    this.zoneLand = Int32Array.from(land);
    const cx = RA.snap(sx / land.length + 0.5, 1e-6), cy = RA.snap(sy / land.length + 0.5, 1e-6);
    let r = 0;
    for (const c of land) {
      const d = RA.dist((c % W) + 0.5 - cx, ((c / W) | 0) + 0.5 - cy);
      if (d > r) r = d;
    }
    r = Math.ceil(r + 1);
    // a big map (the world) shrinks and holds longer: about a tick per cell of the first radius, so the edge never
    // outruns the fronts (Europe, r ≈ 440, keeps 45 s)
    const shrinkT = Math.max(RA.CFG.BR_SHRINK, r), holdT = Math.max(RA.CFG.BR_HOLD, r);
    this.zone = { cx, cy, r, fx: cx, fy: cy, fr: r, tx: cx, ty: cy, tr: r, t0: 0, phase: 0, state: 'wait', shrinkAt: this.peaceUntil + RA.CFG.BR_DELAY, deadLand: 0, shrinkT, holdT };
    this._zoneNext();
  };
  /* next target ring: smaller, entirely inside the current one, centred on playable land if possible */
  P._zoneNext = function () {
    const Z = this.zone, C = RA.CFG, map = this.map, W = map.W, H = map.H;
    const tr = Math.max(C.BR_MIN_R, RA.snap(Z.r * C.BR_FACTOR, 1e-6));
    let best = null;
    for (let k = 0; k < 16; k++) {
      const a = this.rng() * 6.283185307179586;
      const d = this.rng() * Math.max(0, Z.r - tr) * 0.85;
      const x = RA.snap(Z.cx + d * RA.dcos(a), 1e-6), y = RA.snap(Z.cy + d * RA.dsin(a), 1e-6);
      const ix = Math.floor(x), iy = Math.floor(y);
      const onLand = ix >= 0 && iy >= 0 && ix < W && iy < H && map.land[iy * W + ix] && !map.block[iy * W + ix];
      if (!best || onLand) best = [x, y];
      if (onLand) break;
    }
    Z.tx = best[0];
    Z.ty = best[1];
    Z.tr = tr;
  };
  P.zoneOut = function (c) {
    const Z = this.zone, W = this.map.W;
    const dx = (c % W) + 0.5 - Z.cx, dy = ((c / W) | 0) + 0.5 - Z.cy;
    return dx * dx + dy * dy > Z.r * Z.r;
  };
  /* is cell c inside the ring the zone is heading to? (AI: move there) */
  P.zoneSafe = function (c) {
    const Z = this.zone, W = this.map.W;
    const dx = (c % W) + 0.5 - Z.tx, dy = ((c / W) | 0) + 0.5 - Z.ty;
    return dx * dx + dy * dy <= Z.tr * Z.tr;
  };
  P._stepZone = function () {
    const Z = this.zone, C = RA.CFG, tk = this.tick;
    if (Z.state === 'wait' || Z.state === 'hold') {
      if (tk === Z.shrinkAt - 200) this.tellAll('info', '☢ Radioaktivna zona se sužava za 20 s — pomjeri se prema bijelom krugu.');
      if (tk >= Z.shrinkAt) {
        Z.state = 'shrink';
        Z.fx = Z.cx;
        Z.fy = Z.cy;
        Z.fr = Z.r;
        Z.t0 = tk;
        this.tellAll('bad', `☢ Zona se sužava (${Z.phase + 1}/${C.BR_PHASES})! Sve izvan kruga propada.`);
      }
      return;
    }
    if (Z.state !== 'shrink') return;
    const f = Math.min(1, (tk - Z.t0) / Z.shrinkT);
    Z.cx = RA.snap(Z.fx + (Z.tx - Z.fx) * f, 1e-6);
    Z.cy = RA.snap(Z.fy + (Z.ty - Z.fy) * f, 1e-6);
    Z.r = RA.snap(Z.fr + (Z.tr - Z.fr) * f, 1e-6);
    if ((tk - Z.t0) % 5 === 0 || f >= 1) this._zoneBurn();
    if (f >= 1) {
      Z.phase++;
      Z.shrinkAt = tk + Z.holdT;
      if (Z.phase >= C.BR_PHASES) {
        Z.state = 'final';
        Z.tx = Z.cx;
        Z.ty = Z.cy;
        Z.tr = Z.r;
        this.tellAll('info', '☢ Posljednji krug — zona se više ne sužava. Pobjeđuje ko ostane.');
      } else {
        Z.state = 'hold';
        this._zoneNext();
      }
    }
  };
  /* land outside the ring is lost (with the troops standing on it) */
  P._zoneBurn = function () {
    const Z = this.zone, W = this.map.W, r2 = Z.r * Z.r;
    const cx = Z.cx, cy = Z.cy;
    for (const p of this.P) {
      if (!p || !p.alive || !p.tiles) continue;
      const dens = p.troops / p.tiles;
      let lost = 0;
      for (let i = p.tiles - 1; i >= 0; i--) {
        const c = p.cells[i];
        const dx = (c % W) + 0.5 - cx, dy = ((c / W) | 0) + 0.5 - cy;
        if (dx * dx + dy * dy > r2) {
          this.setOwner(c, 0);
          lost++;
        }
      }
      if (lost) {
        p.troops = Math.max(0, p.troops - dens * lost * 1.2);
        if (!p.zoneWarned || this.tick - p.zoneWarned > 150) {
          p.zoneWarned = this.tick;
          this.tell(p, 'bad', `☢ Zona ti je progutala ${lost} polja i vojsku na njima — bježi prema sredini!`, p.id);
        }
      }
    }
    let inside = 0;
    const L = this.zoneLand;
    for (let i = 0; i < L.length; i++) {
      const c = L[i];
      const dx = (c % W) + 0.5 - cx, dy = ((c / W) | 0) + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) inside++;
    }
    Z.deadLand = L.length - inside;
  };
})(RA.Game.prototype);

'use strict';
/* Render-only poses. Replays/network retain exact coordinates. Hit testing uses these poses too. */
RA.UnitMotion = class {
  constructor() { this.poses = new WeakMap(); }
  get(u) { return this.poses.get(u) || u; }
  sample(u, W, now, duration, snap) {
    let p = this.poses.get(u);
    const next = u.path && u.pi < u.path.length ? u.path[u.pi] : -1;
    const aim = next < 0 ? null : Math.atan2(((next / W) | 0) + .5 - u.y, next % W + .5 - u.x);
    if (!p || snap || now - p.last > 500 || Math.hypot(u.x-p.tx,u.y-p.ty)>4) {
      p = { x:u.x, y:u.y, fx:u.x, fy:u.y, tx:u.x, ty:u.y, at:now, last:now, angle:aim ?? (p ? p.angle : -.35), duration };
      this.poses.set(u,p);return p;
    }
    const t = RA.clamp((now-p.at)/p.duration,0,1);
    p.x=p.fx+(p.tx-p.fx)*t;p.y=p.fy+(p.ty-p.fy)*t;
    if(u.x!==p.tx || u.y!==p.ty) {
      p.fx=p.x;p.fy=p.y;p.tx=u.x;p.ty=u.y;p.at=now;p.duration=duration;
    }
    if(aim!==null) {
      const delta=Math.atan2(Math.sin(aim-p.angle),Math.cos(aim-p.angle));
      p.angle+=delta*(1-Math.exp(-Math.max(0,now-p.last)/85));
    }
    p.last=now;return p;
  }
};
RA.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

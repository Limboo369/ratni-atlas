'use strict';
/* Ratni Atlas — shared helpers */
const RA = (window.RA = {});

RA.rng = function (seed) {
  let a = seed >>> 0;
  const f = function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
};

/* min-heap of int32 values keyed by float priority */
class Heap {
  constructor(cap = 256) {
    this.v = new Int32Array(cap);
    this.p = new Float64Array(cap);
    this.n = 0;
  }
  push(val, pri) {
    if (this.n === this.v.length) this._grow();
    const v = this.v, p = this.p;
    let i = this.n++;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= pri) break;
      v[i] = v[par];
      p[i] = p[par];
      i = par;
    }
    v[i] = val;
    p[i] = pri;
  }
  pop() {
    const v = this.v, p = this.p;
    const top = v[0];
    const n = --this.n;
    if (n > 0) {
      const lv = v[n], lp = p[n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && p[r] < p[l] ? r : l;
        if (p[c] >= lp) break;
        v[i] = v[c];
        p[i] = p[c];
        i = c;
      }
      v[i] = lv;
      p[i] = lp;
    }
    return top;
  }
  _grow() {
    const nv = new Int32Array(this.v.length * 2);
    nv.set(this.v);
    this.v = nv;
    const np = new Float64Array(this.p.length * 2);
    np.set(this.p);
    this.p = np;
  }
  clear() {
    this.n = 0;
  }
  get size() {
    return this.n;
  }
}
RA.Heap = Heap;

/* growable int list */
class IntList {
  constructor(cap = 64) {
    this.a = new Int32Array(cap);
    this.n = 0;
  }
  push(x) {
    if (this.n === this.a.length) {
      const b = new Int32Array(this.a.length * 2);
      b.set(this.a);
      this.a = b;
    }
    this.a[this.n++] = x;
  }
  clear() {
    this.n = 0;
  }
}
RA.IntList = IntList;

RA.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
RA.lerp = (a, b, t) => a + (b - a) * t;

RA.fmt = function (n) {
  n = Math.max(0, n);
  if (n < 1000) return String(Math.floor(n));
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace('.', ',') + 'k';
  return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace('.', ',') + 'M';
};
RA.fmtTime = function (sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
};
RA.hexToRgb = function (h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
RA.rgbToHex = function (c) {
  return '#' + c.map((v) => Math.round(RA.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
};
RA.shade = function (rgb, k) {
  // k<0 darken, k>0 lighten
  return rgb.map((v) => (k < 0 ? v * (1 + k) : v + (255 - v) * k));
};
RA.esc = function (s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
};

/* normalized web-mercator helpers */
RA.lonToX = (lon) => (lon + 180) / 360;
RA.latToY = function (lat) {
  lat = RA.clamp(lat, -85.05, 85.05);
  const r = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI) / 2;
};
RA.xToLon = (x) => x * 360 - 180;
RA.yToLat = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

/* ---------- deterministic math for the simulation ----------
   Online games run the same simulation on every device (lockstep), so the sim must produce bit-identical
   results on every JS engine. + - * / and Math.sqrt are exactly rounded by IEEE-754; Math.pow/hypot/sin/log
   are not guaranteed, so the sim uses these replacements built only from exact operations. */
RA.dist = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
RA.LN2 = 0.6931471805599453;
RA.dlog = function (x) {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  let e = 0;
  while (x >= 2) {
    x *= 0.5;
    e++;
  }
  while (x < 1) {
    x *= 2;
    e--;
  }
  // x in [1,2): ln x = 2 atanh(s), s = (x-1)/(x+1) <= 1/3
  const s = (x - 1) / (x + 1), s2 = s * s;
  let term = s, sum = s;
  for (let k = 3; k < 40; k += 2) {
    term *= s2;
    const t = term / k;
    sum += t;
    if (t < 1e-17) break;
  }
  return e * RA.LN2 + 2 * sum;
};
RA.dexp = function (z) {
  if (z > 700) return Infinity;
  if (z < -700) return 0;
  const k = Math.round(z / RA.LN2);
  const r = z - k * RA.LN2;
  let term = 1, sum = 1;
  for (let i = 1; i < 30; i++) {
    term = (term * r) / i;
    sum += term;
    if (Math.abs(term) < 1e-17) break;
  }
  let m = sum;
  if (k > 0) for (let i = 0; i < k; i++) m *= 2;
  else for (let i = 0; i < -k; i++) m *= 0.5;
  return m;
};
RA.dpow = (x, y) => (x <= 0 ? (x === 0 ? 0 : NaN) : RA.dexp(y * RA.dlog(x)));
RA.dsin = function (x) {
  const TWO_PI = 6.283185307179586;
  x -= TWO_PI * Math.round(x / TWO_PI); // [-pi, pi]
  const x2 = x * x;
  let term = x, sum = x;
  for (let i = 1; i < 14; i++) {
    term = (-term * x2) / ((2 * i) * (2 * i + 1));
    sum += term;
  }
  return sum;
};
/* snap a float to a grid so values computed with engine-specific Math (map projection) agree everywhere */
RA.snap = (v, q) => Math.round(v / q) * q;

'use strict';
/* Territory overlay: WebGL fragment shader draws smooth, anti-aliased borders between owners
   (bilinear owner-weight contouring), so the grid never reads as pixels at any zoom. */

RA.TerritoryLayer = L.Layer.extend({
  initialize(map) {
    this.gm = map; // game map
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.hi = 0;
    this.ok = false;
  },
  onAdd(lmap) {
    this.lmap = lmap;
    const c = (this.canvas = L.DomUtil.create('canvas', 'ra-terr'));
    c.style.position = 'absolute';
    c.style.pointerEvents = 'none';
    lmap.getPane('territory').appendChild(c);
    const gl = (this.gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false }));
    if (!gl) {
      this.ok = false;
      return;
    }
    this._initGL();
    this._resize();
    lmap.on('resize', this._resize, this);
    this.ok = true;
    // phones drop GL contexts when the app is backgrounded: rebuild on restore
    c.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ok = false;
    });
    c.addEventListener('webglcontextrestored', () => {
      this._initGL();
      this.ok = true;
      if (this.G) this.reset(this.G);
    });
  },
  onRemove(lmap) {
    lmap.off('resize', this._resize, this);
    this.canvas.remove();
  },
  _resize() {
    const s = this.lmap.getSize();
    this.w = s.x;
    this.h = s.y;
    this.canvas.width = Math.round(s.x * this.dpr);
    this.canvas.height = Math.round(s.y * this.dpr);
    this.canvas.style.width = s.x + 'px';
    this.canvas.style.height = s.y + 'px';
    this.dirtyView = true;
  },
  _initGL() {
    const gl = this.gl, M = this.gm;
    const vs = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;
    const fs = `
precision highp float;
uniform sampler2D uOwner; uniform sampler2D uFall; uniform sampler2D uPal;
uniform vec2 uGrid; uniform vec2 uOrigin;
uniform float uCellPx; uniform float uCanvasH; uniform float uDpr; uniform float uTick; uniform float uHi;
uniform float uSnow; uniform float uSnowY;
vec4 tex(vec2 cell){ return texture2D(uOwner, (cell + 0.5) / uGrid); }
float flashOf(float a){ float age = mod(uTick - floor(a * 255.0 + 0.5) + 256.0, 256.0); return age < 9.0 ? (1.0 - age / 9.0) : 0.0; }
void main(){
  vec2 cp = vec2(gl_FragCoord.x, uCanvasH - gl_FragCoord.y) / uDpr;
  vec2 g = (cp - uOrigin) / uCellPx;
  if (g.x < -1.0 || g.y < -1.0 || g.x > uGrid.x + 1.0 || g.y > uGrid.y + 1.0) { gl_FragColor = vec4(0.0); return; }
  vec2 p = g - 0.5; vec2 b = floor(p); vec2 f = p - b;
  vec4 t0 = tex(b), t1 = tex(b + vec2(1.0,0.0)), t2 = tex(b + vec2(0.0,1.0)), t3 = tex(b + vec2(1.0,1.0));
  float o0 = floor(t0.r * 255.0 + 0.5), o1 = floor(t1.r * 255.0 + 0.5), o2 = floor(t2.r * 255.0 + 0.5), o3 = floor(t3.r * 255.0 + 0.5);
  float w0 = (1.0-f.x)*(1.0-f.y), w1 = f.x*(1.0-f.y), w2 = (1.0-f.x)*f.y, w3 = f.x*f.y;
  float s0 = w0 + (o1==o0?w1:0.0) + (o2==o0?w2:0.0) + (o3==o0?w3:0.0);
  float s1 = w1 + (o0==o1?w0:0.0) + (o2==o1?w2:0.0) + (o3==o1?w3:0.0);
  float s2 = w2 + (o0==o2?w0:0.0) + (o1==o2?w1:0.0) + (o3==o2?w3:0.0);
  float s3 = w3 + (o0==o3?w0:0.0) + (o1==o3?w1:0.0) + (o2==o3?w2:0.0);
  float best = o0; float bw = s0;
  if (s1 > bw) { best = o1; bw = s1; }
  if (s2 > bw) { best = o2; bw = s2; }
  if (s3 > bw) { best = o3; bw = s3; }
  float other = 0.0;
  if (o0 != best) other = max(other, s0);
  if (o1 != best) other = max(other, s1);
  if (o2 != best) other = max(other, s2);
  if (o3 != best) other = max(other, s3);
  float dpx = (bw - other) * 0.5 * uCellPx;
  vec4 outc = vec4(0.0);
  if (best > 0.5) {
    vec4 pal = texture2D(uPal, vec2((best + 0.5) / 256.0, 0.5));
    float flags = floor(pal.a * 255.0 + 0.5);
    float isMe = mod(flags, 2.0);
    float isAlly = mod(floor(flags / 2.0), 2.0);
    float isTraitor = mod(floor(flags / 4.0), 2.0);
    float hi = abs(best - uHi) < 0.5 ? 1.0 : 0.0;
    vec3 col = pal.rgb;
    float fillA = 0.40 + 0.10 * isMe + 0.16 * hi;
    float flash = (o0 == best ? w0 * flashOf(t0.a) : 0.0) + (o1 == best ? w1 * flashOf(t1.a) : 0.0) + (o2 == best ? w2 * flashOf(t2.a) : 0.0) + (o3 == best ? w3 * flashOf(t3.a) : 0.0);
    flash = min(1.0, flash / max(0.001, bw));
    col = mix(col, vec3(1.0), 0.4 * flash);
    fillA += 0.22 * flash;
    if (isAlly > 0.5) { float st = step(0.55, fract((cp.x + cp.y) / 10.0)); fillA += 0.12 * st - 0.05; }
    if (isTraitor > 0.5) { float st = step(0.5, fract((cp.x - cp.y) / 8.0)); col = mix(col, vec3(0.08), 0.3 * st); }
    float bwid = isMe > 0.5 ? 2.6 : 1.5;
    bwid = min(bwid, 0.42 * uCellPx);
    float edge = 1.0 - smoothstep(bwid - 0.7, bwid + 0.7, dpx);
    vec3 bcol = isMe > 0.5 ? mix(col, vec3(1.0), 0.6) : col * 0.52;
    float a = mix(fillA, 0.95, edge);
    col = mix(col, bcol, edge);
    outc = vec4(col * a, a);
  }
  if (uSnow > 0.001) {
    // winter: snow north of the (wavy) snow line, drawn under the territory colours
    float line = uSnowY + 3.0 * sin(g.x * 0.07) + 2.0 * sin(g.x * 0.19 + 1.3);
    float sn = (1.0 - smoothstep(line - 3.0, line + 1.0, g.y)) * uSnow;
    float grain = fract(sin(dot(floor(cp / 2.0), vec2(41.3, 17.7))) * 9431.7);
    float sa = sn * (0.42 + 0.12 * grain);
    vec3 sc = vec3(0.95, 0.97, 1.0);
    outc = vec4(outc.rgb + sc * sa * (1.0 - outc.a), outc.a + sa * (1.0 - outc.a));
  }
  float fall = texture2D(uFall, g / uGrid).r;
  if (fall > 0.03) {
    float n = fract(sin(dot(floor(cp / 3.0), vec2(12.9898, 78.233))) * 43758.5453);
    float fa = min(0.85, fall * (0.42 + 0.3 * n));
    vec3 fc = mix(vec3(0.62, 0.78, 0.12), vec3(0.95, 0.95, 0.35), n);
    outc = vec4(fc * fa + outc.rgb * (1.0 - fa), fa + outc.a * (1.0 - fa));
  }
  gl_FragColor = outc;
}`;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = (this.prog = gl.createProgram());
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    ['uOwner', 'uFall', 'uPal', 'uGrid', 'uOrigin', 'uCellPx', 'uCanvasH', 'uDpr', 'uTick', 'uHi', 'uSnow', 'uSnowY'].forEach((n) => (this.u[n] = gl.getUniformLocation(pr, n)));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const tex = (unit, filter) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tOwner = tex(0, gl.NEAREST);
    this.ownerData = new Uint8Array(M.N * 2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, M.W, M.H, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, this.ownerData);
    this.tFall = tex(1, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, M.W, M.H, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(M.N));
    this.tPal = tex(2, gl.NEAREST);
    this.palData = new Uint8Array(256 * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.palData);
    gl.uniform1i(this.u.uOwner, 0);
    gl.uniform1i(this.u.uFall, 1);
    gl.uniform1i(this.u.uPal, 2);
    gl.uniform2f(this.u.uGrid, M.W, M.H);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.corner = L.latLng(RA.yToLat(M.Y0), RA.xToLon(M.X0));
  },

  /* another map (Europe <-> world): textures for its grid, in the same GL context (browsers cap the contexts) */
  setMap(M) {
    if (this.gm === M) return;
    this.gm = M;
    this.G = null;
    if (!this.gl || this.gl.isContextLost()) return;
    const gl = this.gl;
    for (const t of [this.tOwner, this.tFall, this.tPal]) gl.deleteTexture(t);
    gl.deleteProgram(this.prog);
    this.ok = Math.max(M.W, M.H) <= gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (this.ok) this._initGL();
    this.dirtyView = true;
  },
  /* full reset for a new game */
  reset(G) {
    this.G = G;
    if (!this.ok) return;
    const gl = this.gl, M = this.gm;
    this.ownerData.fill(0);
    for (let c = 0; c < M.N; c++) {
      const o = G.owner[c];
      if (!o) continue;
      this.ownerData[2 * c] = o;
      for (let k = M.mirOff[c]; k < M.mirOff[c + 1]; k++) this.ownerData[2 * M.mirList[k]] = o;
    }
    G.dirty.clear();
    G.dirtyFlag.fill(0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tOwner);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, M.W, M.H, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, this.ownerData);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tFall);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, M.W, M.H, gl.LUMINANCE, gl.UNSIGNED_BYTE, G.fallout);
    this.updatePalette();
    this.dirtyView = true;
  },
  updatePalette() {
    const G = this.G;
    if (!G || !this.ok) return;
    const d = this.palData;
    d.fill(0);
    const me = G.me;
    for (const p of G.P) {
      if (!p) continue;
      let f = 0;
      if (p === me) f |= 1;
      if (me && me.allies.has(p.id)) f |= 2;
      if (p.traitorUntil > G.tick) f |= 4;
      d[p.id * 4] = p.rgb[0];
      d[p.id * 4 + 1] = p.rgb[1];
      d[p.id * 4 + 2] = p.rgb[2];
      d[p.id * 4 + 3] = f;
    }
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.tPal);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, d);
    this.dirtyView = true;
  },
  sync() {
    const G = this.G;
    if (!G || !this.ok) return;
    const M = this.gm, W = M.W, gl = this.gl;
    const L = G.dirty;
    if (L.n) {
      let r0 = 1e9, r1 = -1;
      const od = this.ownerData, own = G.owner, cap = G.capTick, off = M.mirOff, lst = M.mirList;
      for (let i = 0; i < L.n; i++) {
        const c = L.a[i];
        G.dirtyFlag[c] = 0;
        const o = own[c], t = cap[c];
        od[2 * c] = o;
        od[2 * c + 1] = t;
        const row = (c / W) | 0;
        if (row < r0) r0 = row;
        if (row > r1) r1 = row;
        for (let k = off[c]; k < off[c + 1]; k++) {
          const m = lst[k];
          od[2 * m] = o;
          od[2 * m + 1] = t;
          const mr = (m / W) | 0;
          if (mr < r0) r0 = mr;
          if (mr > r1) r1 = mr;
        }
      }
      L.clear();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tOwner);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r0, W, r1 - r0 + 1, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, od.subarray(r0 * W * 2, (r1 + 1) * W * 2));
      this.dirtyView = true;
      this.lastChange = performance.now();
    }
    if (G.falloutDirty) {
      G.falloutDirty = false;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tFall);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, M.W, M.H, gl.LUMINANCE, gl.UNSIGNED_BYTE, G.fallout);
      this.dirtyView = true;
    }
    if (G.alliancesChanged) {
      G.alliancesChanged = false;
      this.updatePalette();
    }
  },
  setHighlight(pid) {
    if (this.hi !== pid) {
      this.hi = pid;
      this.dirtyView = true;
    }
  },
  view() {
    const lm = this.lmap;
    const o = lm.latLngToContainerPoint(this.corner);
    const cellPx = lm.options.crs.scale(lm.getZoom()) * this.gm.CELL;
    return { ox: o.x, oy: o.y, cell: cellPx };
  },
  draw(force) {
    if (!this.ok || !this.G) return;
    const now = performance.now();
    const flashing = (this.lastChange && now - this.lastChange < 1100) || (this.G.wLevel > 0 && this.G.wLevel < 1);
    if (!this.dirtyView && !force && !flashing) return;
    this.dirtyView = false;
    const gl = this.gl, lm = this.lmap;
    L.DomUtil.setPosition(this.canvas, lm.containerPointToLayerPoint([0, 0]));
    const v = this.view();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.u.uOrigin, v.ox, v.oy);
    gl.uniform1f(this.u.uCellPx, v.cell);
    gl.uniform1f(this.u.uCanvasH, this.canvas.height);
    gl.uniform1f(this.u.uDpr, this.dpr);
    gl.uniform1f(this.u.uTick, this.G.tick & 255);
    gl.uniform1f(this.u.uHi, this.hi || 0);
    gl.uniform1f(this.u.uSnow, this.G.wLevel || 0);
    gl.uniform1f(this.u.uSnowY, this.gm.snowY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },
});

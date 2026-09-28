'use strict';
/* Clouds (Darko, 27. 9.): soft, slowly drifting clouds instead of a hard line around the playable region, and in Focus
   the fog of war — foreign land far from yours stays under clouds until you look: your land, your allies' land and
   RA.FOG_NEAR cells around them, your units, states your agents scouted (03d-intel.js) and the places your drones and
   missiles hit (for RA.FOG_REVEAL_MS) are clear. Under the clouds foreign units, buildings and army numbers are hidden.
   Drawing only: the simulation knows nothing about it. */
RA.FOG_NEAR = 10; // cells around my (and my allies') land
RA.FOG_UNIT = 8;
RA.FOG_HIT = 12;
RA.FOG_REVEAL_MS = 120000;
RA.Clouds = (function () {
  const B = 4; // cells per mask block
  let tex = null;
  /* a tileable cloud texture: value noise, a few octaves, soft white billows on grey */
  const texture = () => {
    if (tex) return tex;
    const N = 256, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d'), img = x.createImageData(N, N);
    const oct = [4, 8, 16, 32].map((g) => {
      const v = new Float32Array(g * g);
      for (let i = 0; i < v.length; i++) v[i] = Math.random();
      return { g, v };
    });
    const sm = (t) => t * t * (3 - 2 * t);
    for (let py = 0; py < N; py++)
      for (let px = 0; px < N; px++) {
        let n = 0, amp = 1, tot = 0;
        for (const o of oct) {
          const fx = (px / N) * o.g, fy = (py / N) * o.g, x0 = Math.floor(fx), y0 = Math.floor(fy);
          const tx = sm(fx - x0), ty = sm(fy - y0), g = o.g, v = o.v;
          const a = v[(y0 % g) * g + (x0 % g)], b = v[(y0 % g) * g + ((x0 + 1) % g)];
          const cc = v[((y0 + 1) % g) * g + (x0 % g)], d = v[((y0 + 1) % g) * g + ((x0 + 1) % g)];
          n += amp * (a + (b - a) * tx + (cc - a + (a - b + d - cc) * tx) * ty);
          tot += amp;
          amp *= 0.55;
        }
        n /= tot;
        const k = (py * N + px) * 4, l = Math.max(0, Math.min(1, (n - 0.3) * 2.2));
        img.data[k] = 214 + 36 * l;
        img.data[k + 1] = 220 + 32 * l;
        img.data[k + 2] = 226 + 28 * l;
        img.data[k + 3] = 255 * (0.35 + 0.65 * l);
      }
    x.putImageData(img, 0, 0);
    return (tex = c);
  };

  const st = { key: '', mask: null, vis: null, gw: 0, gh: 0, fogAt: 0, fog: false, reveal: new Map(), off: null, ms: null };

  /* is the fog of war on in this game (Focus, for a player of it) */
  const fogOn = (G) => !!(G && (RA.FOG_TEST || (G.long && G.sub)) && G.me && G.state === 'play' && !G.rp); // RA.FOG_TEST: tests

  /* the fog grid: 1 = clear block */
  const updateFog = (G, now) => {
    const W = G.map.W, H = G.map.H, gw = Math.ceil(W / B), gh = Math.ceil(H / B), me = G.me;
    const v = new Uint8Array(gw * gh);
    const mark = (cx, cy, r) => {
      const bx0 = Math.max(0, Math.floor((cx - r) / B)), bx1 = Math.min(gw - 1, Math.floor((cx + r) / B));
      const by0 = Math.max(0, Math.floor((cy - r) / B)), by1 = Math.min(gh - 1, Math.floor((cy + r) / B));
      for (let by = by0; by <= by1; by++)
        for (let bx = bx0; bx <= bx1; bx++) {
          const dx = bx * B + B / 2 - cx, dy = by * B + B / 2 - cy;
          if (dx * dx + dy * dy <= (r + B) * (r + B)) v[by * gw + bx] = 1;
        }
    };
    // my land and my friends' land, then a ring around it (a block dilation)
    const own = new Uint8Array(gw * gh);
    for (const p of G.P) {
      if (!p || !p.alive || !(p === me || G.isFriendly(me, p) || G.intelSeen(me, p))) continue;
      for (let i = 0; i < p.tiles; i++) {
        const c = p.cells[i];
        own[(((c / W) | 0) / B | 0) * gw + ((c % W) / B | 0)] = 1;
      }
    }
    const R = Math.ceil(RA.FOG_NEAR / B);
    const tmp = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        let f = 0;
        for (let k = Math.max(0, x - R); k <= Math.min(gw - 1, x + R) && !f; k++) f = own[y * gw + k];
        tmp[y * gw + x] = f;
      }
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        let f = 0;
        for (let k = Math.max(0, y - R); k <= Math.min(gh - 1, y + R) && !f; k++) f = tmp[k * gw + x];
        if (f) v[y * gw + x] = 1;
      }
    for (const u of me.units) if (!u.dead) mark(u.x, u.y, RA.FOG_UNIT);
    // where my drones and missiles fly and hit
    for (const m of G.missiles) if (m.owner === me.id && !m.done) st.reveal.set(m.c, now + RA.FOG_REVEAL_MS);
    for (const [c, until] of st.reveal) {
      if (until < now) st.reveal.delete(c);
      else mark(c % W, (c / W) | 0, RA.FOG_HIT);
    }
    st.vis = v;
    st.gw = gw;
    st.gh = gh;
  };

  /* the mask (alpha = how clear) at block resolution: outside the region and under the fog nothing is clear.
     It is cut out of a fully clouded layer (destination-out), so its edges and the blur never let the dark page
     background show through (Darko 28. 9.: a black frame when zoomed out) */
  const buildMask = (G) => {
    const map = G.map, W = map.W, H = map.H, gw = Math.ceil(W / B), gh = Math.ceil(H / B);
    const c = st.mask || document.createElement('canvas'), P = 2; // P blocks of cloud all around (no clear seam)
    c.width = gw + 2 * P;
    c.height = gh + 2 * P;
    const x = c.getContext('2d'), img = x.createImageData(c.width, c.height), blk = map.block;
    for (let by = 0; by < gh; by++)
      for (let bx = 0; bx < gw; bx++) {
        let a = 0;
        if (map.region) {
          // a block is outside the region when most of its cells are
          let n = 0, t = 0;
          for (let y = by * B; y < Math.min(H, by * B + B); y++) for (let xx = bx * B; xx < Math.min(W, bx * B + B); xx++) (t++, blk[y * W + xx] && n++);
          if (n * 2 > t) a = 255;
        }
        if (!a && st.fog && st.vis && !st.vis[by * gw + bx]) a = 255; // land and sea alike (thinner over the sea showed as dark smudges)
        img.data[((by + P) * c.width + bx + P) * 4 + 3] = 255 - a;
      }
    x.putImageData(img, 0, 0);
    st.mask = c;
  };

  return {
    /* is a place (grid x, y) under the fog of war (foreign things there are not drawn) */
    hidden(G, x, y) {
      if (!st.fog || !st.vis || !G || G !== st.G) return false;
      const bx = (x / B) | 0, by = (y / B) | 0;
      return bx >= 0 && by >= 0 && bx < st.gw && by < st.gh && !st.vis[by * st.gw + bx];
    },
    draw(ctx, G, v, w, h, now) {
      if (!G || !G.map) return;
      const fog = fogOn(G);
      if (!G.map.region && !fog) return (st.fog = false);
      if (fog && (now - st.fogAt > 1000 || st.G !== G)) {
        st.fogAt = now;
        updateFog(G, now);
        st.key = '';
      }
      st.fog = fog;
      st.G = G;
      const key = G.map.id + '|' + (G.map.region ? G.map.region.id : '') + '|' + fog + '|' + st.fogAt;
      if (key !== st.key) {
        buildMask(G);
        st.key = key;
      }
      const s = 0.4, ow = Math.ceil(w * s), oh = Math.ceil(h * s); // clouds are soft: a small canvas is enough
      const off = st.off || (st.off = document.createElement('canvas'));
      const ms = st.ms || (st.ms = document.createElement('canvas'));
      if (off.width !== ow || off.height !== oh) (off.width = ms.width = ow), (off.height = ms.height = oh);
      // where the clouds are: everywhere, minus the clear parts of the mask (softened by a blur that scales with
      // the blocks, so zoomed out the clear land stays clear instead of being smeared into the clouds)
      const mc = ms.getContext('2d');
      mc.setTransform(1, 0, 0, 1, 0, 0);
      mc.globalCompositeOperation = 'source-over';
      mc.clearRect(0, 0, ow, oh);
      mc.fillStyle = '#000';
      mc.fillRect(0, 0, ow, oh);
      const x0 = v.ox * s, y0 = v.oy * s, gw = G.map.W * v.cell * s, gh = G.map.H * v.cell * s;
      const bw = gw / (st.mask.width - 4), bh = gh / (st.mask.height - 4); // one mask block on the screen
      mc.globalCompositeOperation = 'destination-out';
      mc.imageSmoothingEnabled = true;
      mc.filter = `blur(${Math.max(0.5, Math.min(6, bw * 0.8)).toFixed(1)}px)`;
      mc.drawImage(st.mask, x0 - 2 * bw, y0 - 2 * bh, gw + 4 * bw, gh + 4 * bh);
      mc.filter = 'none';
      mc.globalCompositeOperation = 'source-over';
      // the clouds: a grey base and drifting billows (two layers at different speeds), anchored to the map
      const oc = off.getContext('2d');
      oc.setTransform(1, 0, 0, 1, 0, 0);
      oc.globalCompositeOperation = 'source-over';
      oc.clearRect(0, 0, ow, oh);
      oc.fillStyle = 'rgba(122,134,144,0.97)';
      oc.fillRect(0, 0, ow, oh);
      const T = texture(), pat = oc.createPattern(T, 'repeat'), t = now / 1000;
      for (const [sp, sc, al] of [[4, 1.3, 1], [7, 0.8, 0.7]]) {
        oc.save();
        oc.globalAlpha = al;
        oc.translate(((x0 + t * sp) % (256 * sc)) - 256 * sc, ((y0 + t * sp * 0.35) % (256 * sc)) - 256 * sc);
        oc.scale(sc, sc);
        oc.fillStyle = pat;
        oc.fillRect(0, 0, ow / sc + 1024, oh / sc + 1024);
        oc.restore();
      }
      oc.globalCompositeOperation = 'destination-in';
      oc.drawImage(ms, 0, 0);
      oc.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, w, h);
      ctx.restore();
    },
    /* does the page need to redraw often (the clouds drift) */
    active(G) {
      return !!(G && G.map && (G.map.region || fogOn(G)));
    },
  };
})();

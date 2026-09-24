'use strict';
/* Decodes window.MAPDATA (Natural Earth vectors, terrain grid, relief) into runtime structures */

RA.inflate = async function (b64) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (typeof DecompressionStream === 'undefined') throw new Error('no-decompression');
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
};

RA.loadMap = async function () {
  const D = window.MAPDATA;
  const M = D.meta;
  const W = M.W, H = M.H, N = W * H;
  const raw = await RA.inflate(D.grid);

  const map = {
    W, H, N,
    X0: M.X0, Y0: M.Y0, CELL: M.CELL,
    X1: M.X0 + W * M.CELL, Y1: M.Y0 + H * M.CELL,
    terr: new Uint8Array(N), // 0 water, 1 plain, 2 hill, 3 mountain
    river: new Uint8Array(N),
    land: new Uint8Array(N),
    coast: new Uint8Array(N), // land touching sea (4-neighbour)
    wcomp: new Int32Array(N).fill(-1), // water component id
    wsize: [],
    mirror: new Int32Array(N).fill(-1), // water cell -> land cell whose owner it mirrors (render only)
    block: new Uint8Array(N), // 1 = outside the playable region (regional maps)
    region: null,
    landCount: 0,
    meta: M,
  };
  for (let i = 0; i < N; i++) {
    const v = raw[i];
    map.terr[i] = v & 3;
    map.river[i] = (v >> 2) & 1;
    if (v & 3) {
      map.land[i] = 1;
      map.landCount++;
    }
  }

  // water components (4-connected)
  const q = new Int32Array(N);
  let comp = 0;
  for (let i = 0; i < N; i++) {
    if (map.land[i] || map.wcomp[i] >= 0) continue;
    let qh = 0, qt = 0;
    q[qt++] = i;
    map.wcomp[i] = comp;
    while (qh < qt) {
      const c = q[qh++];
      const x = c % W, y = (c / W) | 0;
      if (x > 0 && !map.land[c - 1] && map.wcomp[c - 1] < 0) { map.wcomp[c - 1] = comp; q[qt++] = c - 1; }
      if (x < W - 1 && !map.land[c + 1] && map.wcomp[c + 1] < 0) { map.wcomp[c + 1] = comp; q[qt++] = c + 1; }
      if (y > 0 && !map.land[c - W] && map.wcomp[c - W] < 0) { map.wcomp[c - W] = comp; q[qt++] = c - W; }
      if (y < H - 1 && !map.land[c + W] && map.wcomp[c + W] < 0) { map.wcomp[c + W] = comp; q[qt++] = c + W; }
    }
    map.wsize.push(qt);
    comp++;
  }

  // coast (touching navigable water: component bigger than 30 cells) + mirror for rendering
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    if (map.land[i]) {
      let c = 0;
      if (x > 0 && !map.land[i - 1] && map.wsize[map.wcomp[i - 1]] > 30) c = 1;
      else if (x < W - 1 && !map.land[i + 1] && map.wsize[map.wcomp[i + 1]] > 30) c = 1;
      else if (y > 0 && !map.land[i - W] && map.wsize[map.wcomp[i - W]] > 30) c = 1;
      else if (y < H - 1 && !map.land[i + W] && map.wsize[map.wcomp[i + W]] > 30) c = 1;
      map.coast[i] = c;
    } else {
      // pick a land neighbour to mirror (prefer orthogonal)
      const cand = [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1];
      const ok = [x > 0, x < W - 1, y > 0, y < H - 1, x > 0 && y > 0, x < W - 1 && y > 0, x > 0 && y < H - 1, x < W - 1 && y < H - 1];
      for (let k = 0; k < 8; k++) {
        if (ok[k] && map.land[cand[k]]) {
          map.mirror[i] = cand[k];
          break;
        }
      }
    }
  }
  // CSR: land cell -> mirrored water cells
  const cnt = new Int32Array(N + 1);
  for (let i = 0; i < N; i++) if (map.mirror[i] >= 0) cnt[map.mirror[i] + 1]++;
  for (let i = 0; i < N; i++) cnt[i + 1] += cnt[i];
  const list = new Int32Array(cnt[N]);
  const fill = cnt.slice(0, N);
  for (let i = 0; i < N; i++) if (map.mirror[i] >= 0) list[fill[map.mirror[i]]++] = i;
  map.mirOff = cnt;
  map.mirList = list;

  // static value-noise field: makes fronts organic instead of square
  map.noise = new Float32Array(N);
  const nr = RA.rng(4242);
  for (const [scale, amp] of [[11, 0.65], [5, 0.35]]) {
    const gw = Math.ceil(W / scale) + 2, gh = Math.ceil(H / scale) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = nr();
    for (let y = 0; y < H; y++) {
      const fy = y / scale, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < W; x++) {
        const fx = x / scale, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
        const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
        map.noise[y * W + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
      }
    }
  }

  map.cellAt = function (nx, ny) {
    const x = Math.floor((nx - map.X0) / map.CELL), y = Math.floor((ny - map.Y0) / map.CELL);
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    return y * W + x;
  };
  map.snowY = RA.snap((RA.latToY(51.5) - map.Y0) / map.CELL, 1e-6); // winter snow line (grid row) around 51.5°N, snapped for lockstep
  map.cellOfLatLng = (lat, lng) => map.cellAt(RA.lonToX(lng), RA.latToY(lat));
  map.cellCenter = (c) => [map.X0 + ((c % W) + 0.5) * map.CELL, map.Y0 + (((c / W) | 0) + 0.5) * map.CELL];
  map.latLngOfCell = function (c) {
    const p = map.cellCenter(c);
    return [RA.yToLat(p[1]), RA.xToLon(p[0])];
  };
  map.latLngOfXY = (gx, gy) => [RA.yToLat(map.Y0 + gy * map.CELL), RA.xToLon(map.X0 + gx * map.CELL)];

  // vectors
  map.vec = {};
  const QX0 = M.QX0, QX1 = M.QX1, QY0 = M.QY0, QY1 = M.QY1;
  const sx = (QX1 - QX0) / 65535, sy = (QY1 - QY0) / 65535;
  const keys = Object.keys(D.vec);
  const bufs = await Promise.all(keys.map((k) => RA.inflate(D.vec[k])));
  keys.forEach((k, ki) => {
    const b = bufs[ki];
    let p = 0;
    const rd = () => {
      let r = 0, s = 0, byte;
      do {
        byte = b[p++];
        r |= (byte & 0x7f) << s;
        s += 7;
      } while (byte & 0x80);
      return r >>> 0;
    };
    const unz = (v) => (v >>> 1) ^ -(v & 1);
    const nr = rd();
    const rings = [];
    const bbox = new Float32Array(nr * 4);
    for (let r = 0; r < nr; r++) {
      const np = rd();
      const arr = new Float32Array(np * 2);
      let x = 0, y = 0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (let i = 0; i < np; i++) {
        x += unz(rd());
        y += unz(rd());
        const fx = QX0 + x * sx, fy = QY0 + y * sy;
        arr[2 * i] = fx;
        arr[2 * i + 1] = fy;
        if (fx < minx) minx = fx;
        if (fx > maxx) maxx = fx;
        if (fy < miny) miny = fy;
        if (fy > maxy) maxy = fy;
      }
      rings.push(arr);
      bbox[4 * r] = minx; bbox[4 * r + 1] = miny; bbox[4 * r + 2] = maxx; bbox[4 * r + 3] = maxy;
    }
    map.vec[k] = { rings, bbox };
  });

  // relief image
  map.relief = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = 'data:image/jpeg;base64,' + D.relief;
  });

  // cities
  map.cities = D.cities.map((c, i) => ({
    i, name: c.n, x: c.x, y: c.y, c: c.y * W + c.x, tier: c.t, pop: c.p, rank: c.r, iso: c.iso, owner: 0,
  }));
  map.cityAt = new Int16Array(N).fill(-1);
  map.cities.forEach((c) => (map.cityAt[c.c] = c.i));
  // urban defence zones: cells around a real city are harder to take while its owner holds the city
  map.urban = new Int16Array(N).fill(-1);
  for (const c of map.cities.slice().sort((a, b) => a.tier - b.tier)) {
    const r = [0, 2, 3, 4][c.tier];
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        const x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const k = y * W + x;
        if (map.land[k]) map.urban[k] = c.i;
      }
  }
  map.nations = D.nations.map((n) => ({ iso: n.iso, name: n.n, x: n.x, y: n.y, c: n.y * W + n.x, color: n.c, capital: n.cap }));
  map.cityStates = D.cs.map((s) => ({ name: s.n, x: s.x, y: s.y, c: s.y * W + s.x }));
  map.seas = D.seas.map((s) => ({ name: s.n, x: RA.lonToX(s.lon), y: RA.latToY(s.lat), rank: s.r }));
  return map;
};

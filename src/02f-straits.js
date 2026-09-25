'use strict';
/* Straits and canals (plan 17). A strait is a line of grid cells that ships may cross — also where the coarse grid
   shows land (the Bosporus, the Dardanelles and Kerch are narrower than a cell) — plus its two shores. Whoever holds
   both shores (most of the land around each) may close it: then only their own and their allies' ships pass. Closing
   angers every state that sails those seas (the more the longer it stays shut) and counts as aggression.
   Lines are grid coordinates [x, y] per map (computed once from lat/lon, so every device gets the same cells);
   `from`: the first era it exists in (canals). */
RA.STRAITS = {
  evropa: [
    { id: 'tur', name: 'Bosfor i Dardaneli', lines: [[[366, 532], [366, 535], [364, 538]], [[352, 544], [347, 547], [343, 550]]], a: [[362, 537], [345, 547]], b: [[371, 538], [349, 551]] },
    { id: 'gib', name: 'Gibraltar', lines: [[[49, 590], [49, 600]]], a: [[50, 591]], b: [[49, 600]] },
    { id: 'dan', name: 'Danski moreuzi', lines: [[[214, 328], [222, 328]], [[199, 338], [206, 338]], [[190, 336], [194, 336]]], a: [[213, 330]], b: [[224, 331]] },
    { id: 'otr', name: 'Otranto', lines: [[[270, 553], [285, 545]]], a: [[270, 552]], b: [[285, 545]] },
    { id: 'mes', name: 'Mesina', lines: [[[243, 571], [248, 571]]], a: [[244, 573]], b: [[247, 569]] },
    { id: 'ker', name: 'Kerč', lines: [[[438, 480], [438, 487]]], a: [[435, 483]], b: [[441, 484]] },
  ],
  // the world grid had closed Gibraltar, the Bosporus, the Dardanelles and Kerch too (the Mediterranean was a lake)
  svijet: [
    { id: 'tur', name: 'Bosfor i Dardaneli', lines: [[[929, 267], [928, 269]], [[915, 271], [921, 271]]], a: [[926, 268], [917, 272]], b: [[931, 269], [918, 270]] },
    { id: 'gib', name: 'Gibraltar', lines: [[[775, 295], [775, 299]]], a: [[775, 294]], b: [[775, 299]] },
    { id: 'dan', name: 'Danski moreuzi', lines: [[[845, 171], [850, 171]]], a: [[845, 170]], b: [[851, 172]] },
    { id: 'otr', name: 'Otranto', lines: [[[881, 273], [886, 273]]], a: [[880, 273]], b: [[886, 272]] },
    { id: 'mes', name: 'Mesina', lines: [[[869, 284], [869, 287]]], a: [[868, 286]], b: [[870, 285]] },
    { id: 'ker', name: 'Kerč', lines: [[[962, 241], [962, 245]]], a: [[960, 243]], b: [[964, 243]] },
    { id: 'hor', name: 'Hormuški moreuz', lines: [[[1051, 350], [1055, 345]]], a: [[1049, 349]], b: [[1055, 343]] },
    { id: 'bab', name: 'Bab el-Mandeb', lines: [[[990, 413], [994, 410]]], a: [[989, 413]], b: [[995, 412]] },
    { id: 'mal', name: 'Malajski moreuz', lines: [[[1245, 458], [1254, 458]]], a: [[1244, 459]], b: [[1255, 457]] },
    { id: 'sue', name: 'Suecki kanal', from: 'ww1', lines: [[[943, 322], [945, 332]]], a: [[942, 325]], b: [[947, 329]] },
    { id: 'pan', name: 'Panamski kanal', from: 'ww1', lines: [[[445, 426], [447, 429]]], a: [[444, 428]], b: [[448, 427]] },
  ],
};

(function (P) {
  /* cells of a thick line (Bresenham, then every cell within 1 of it) */
  function lineCells(W, H, pts, out) {
    for (let k = 1; k < pts.length; k++) {
      let [x0, y0] = pts[k - 1];
      const [x1, y1] = pts[k];
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            const x = x0 + ox, y = y0 + oy;
            if (x >= 0 && y >= 0 && x < W && y < H) out.add(y * W + x);
          }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    }
  }
  /* set up this game's straits: G.stc (cell -> strait index + 1), G.straits (runtime state), map water links */
  P.straitsInit = function () {
    const map = this.map, W = map.W, H = map.H, defs = RA.STRAITS[map.id] || [];
    this.stc = new Uint8Array(map.N);
    this.straits = [];
    this.straitVer = 0;
    const eraIdx = RA.ERAS.findIndex((e) => e.id === (this.opts.era || 'danas'));
    // water components joined by a strait count as one sea (trade routes, boats)
    const root = map.wsize.map((_, i) => i);
    const find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
    for (const d of defs) {
      if (d.from && eraIdx < RA.ERAS.findIndex((e) => e.id === d.from)) continue;
      const cells = new Set();
      for (const l of d.lines) lineCells(W, H, l, cells);
      const list = [...cells].filter((c) => !map.block[c]).sort((a, b) => a - b);
      if (!list.length) continue;
      // the water the strait touches
      const comps = new Set();
      for (const c of list) {
        const x = c % W, y = (c / W) | 0;
        for (const n of [c, x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, y > 0 ? c - W : -1, y < H - 1 ? c + W : -1]) if (n >= 0 && !map.land[n] && map.wcomp[n] >= 0) comps.add(map.wcomp[n]);
      }
      // its shores: land cells within 3 of each anchor
      const shore = (anchors) => {
        const out = [];
        for (const [ax, ay] of anchors)
          for (let y = ay - 3; y <= ay + 3; y++)
            for (let x = ax - 3; x <= ax + 3; x++) {
              if (x < 0 || y < 0 || x >= W || y >= H) continue;
              const c = y * W + x;
              if (map.land[c] && !map.block[c] && !out.includes(c)) out.push(c);
            }
        return out;
      };
      const a = shore(d.a), b = shore(d.b);
      if (!a.length || !b.length) continue; // a region without both shores: no strait
      const idx = this.straits.length, cs = [...comps];
      for (const c of list) if (!this.stc[c]) this.stc[c] = idx + 1;
      for (let i = 1; i < cs.length; i++) root[find(cs[i])] = find(cs[0]);
      this.straits.push({ i: idx, id: d.id, name: d.name, lines: d.lines, cells: list, a, b, holder: 0, closed: 0, since: 0 });
    }
    this.wroot = map.wsize.map((_, i) => find(i));
  };
  /* is this cell open water for a ship of player pid? (land straits are water; a closed strait only for friends) */
  P.seaFor = function (c, pid) {
    const s = this.stc[c];
    if (!s) return !this.map.land[c];
    const st = this.straits[s - 1];
    if (!st.closed) return true;
    const p = this.P[pid], q = this.P[st.closed];
    return !!(p && q && (p === q || p.allies.has(q.id)));
  };
  /* who holds both shores (most of the land around each): that player may close the strait */
  P._straitHolder = function (st) {
    const own = this.owner, best = (cells) => {
      const n = new Map();
      for (const c of cells) if (own[c]) n.set(own[c], (n.get(own[c]) || 0) + 1);
      for (const [pid, k] of n) if (k * 5 >= cells.length * 3) return pid; // 60%
      return 0;
    };
    const ha = best(st.a);
    return ha && ha === best(st.b) ? ha : 0;
  };
  P._stepStraits = function () {
    for (const st of this.straits) {
      const h = this._straitHolder(st);
      if (h !== st.holder) {
        st.holder = h;
        if (st.closed && st.closed !== h) this._setStrait(st, 0, 'lost');
      }
      if (!st.closed) continue;
      // every 10 s shut: the states that sail these seas get angrier (the more ports, the angrier)
      if ((this.tick - st.since) % 100 === 0) {
        const cl = this.P[st.closed];
        for (const o of this.P) {
          if (!o || !o.alive || o === cl || o.type === 'bot' || cl.allies.has(o.id)) continue;
          const hurt = Math.min(3, o.n.port) + (o.trade.size ? 1 : 0);
          if (hurt) o.rel[cl.id] = Math.max(-100, o.rel[cl.id] - hurt);
        }
      }
    }
  };
  P._setStrait = function (st, pid, why) {
    st.closed = pid;
    st.since = this.tick;
    this.straitVer++;
    if (this.tradePaths) this.tradePaths.clear();
    const H = this.P[st.holder];
    if (pid) {
      this.news('strait', pid, 0, st.name);
      this.addAE(this.P[pid], RA.CFG.AE_STRAIT);
      for (const o of this.P) if (o && o.alive && o.id !== pid && !o.human && o.type !== 'bot' && !o.allies.has(pid)) o.rel[pid] = Math.max(-100, o.rel[pid] - 15);
      for (const h of this.P) if (h && h.human && h.alive && h.id !== pid) this.tell(h, 'bad', `${this.P[pid].name} je zatvorio/la ${st.name} za tuđe brodove.`, pid, st.cells[0]);
    } else if (why === 'lost') {
      for (const h of this.P) if (h && h.human && h.alive) this.tell(h, 'info', `${st.name} je ponovo otvoren${H ? ' (novi vlasnik obala: ' + H.name + ')' : ''}.`, 0, st.cells[0]);
    } else {
      if (H) this.news('straitOpen', H.id, 0, st.name);
    }
  };
  /* the holder opens or closes a strait (command 'str') */
  P.cmdStrait = function (pid, i, close) {
    const st = this.straits[i];
    if (!st) return 'Nema tog moreuza.';
    if (st.holder !== pid) return `Moraš držati obje obale (${st.name}).`;
    if (!!st.closed === close) return null;
    this._setStrait(st, close ? pid : 0);
    return { name: st.name, closed: close };
  };
})(RA.Game.prototype);

RA.CFG.AE_STRAIT = 15; // closing a strait is aggression, like attacking a state

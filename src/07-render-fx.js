'use strict';
/* 2D overlay: city markers & labels, sea names, territory names, structures, boats, missiles, blasts */

RA.FONT_UI = '"IBM Plex Sans Condensed", "Roboto Condensed", "Arial Narrow", system-ui, sans-serif';
RA.FONT_D = '"Big Shoulders Display", "Oswald", "Arial Narrow", Impact, sans-serif';

RA.FxLayer = L.Layer.extend({
  initialize(map) {
    this.gm = map;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.showCities = true;
  },
  onAdd(lmap) {
    this.lmap = lmap;
    const c = (this.canvas = L.DomUtil.create('canvas', 'ra-fx'));
    c.style.position = 'absolute';
    c.style.pointerEvents = 'none';
    lmap.getPane('fx').appendChild(c);
    this.ctx = c.getContext('2d');
    this._resize();
    lmap.on('resize', this._resize, this);
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
  },

  draw(G, v, ui) {
    const lm = this.lmap, ctx = this.ctx, dpr = this.dpr;
    L.DomUtil.setPosition(this.canvas, lm.containerPointToLayerPoint([0, 0]));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!G) return;
    const M = this.gm, W = M.W;
    const z = lm.getZoom();
    const S = lm.options.crs.scale(z); // px per normalized unit
    const po = lm.latLngToContainerPoint(L.latLng(RA.yToLat(M.Y0), RA.xToLon(M.X0)));
    const cell = v.cell;
    const gx = (x) => v.ox + x * cell, gy = (y) => v.oy + y * cell;
    const nx = (x) => po.x + (x - M.X0) * S, ny = (y) => po.y + (y - M.Y0) * S;
    const inView = (x, y, m) => x > -m && y > -m && x < this.w + m && y < this.h + m;
    const now = performance.now();
    const placed = [];
    const free = (x, y, w, h) => {
      for (const r of placed) if (x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]) return false;
      placed.push([x, y, w, h]);
      return true;
    };
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // playable region: veil everything outside the polygon ------------------------
    const reg = G.map.region;
    const blk = G.map.block;
    if (reg) {
      const pts = reg.mpoly.map((q) => [nx(q[0]), ny(q[1])]);
      ctx.beginPath();
      ctx.rect(-20, -20, this.w + 40, this.h + 40);
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = 'rgba(12,17,22,0.6)';
      ctx.fill('evenodd');
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = 'rgba(242,177,52,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // battle royale: everything outside the ring is dead; the dashed ring is where the zone goes next
    if (G.zone) {
      const Z = G.zone;
      const zx = gx(Z.cx), zy = gy(Z.cy), zr = Z.r * cell;
      ctx.beginPath();
      ctx.rect(-20, -20, this.w + 40, this.h + 40);
      ctx.moveTo(zx + zr, zy);
      ctx.arc(zx, zy, zr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(96,14,30,0.34)';
      ctx.fill('evenodd');
      ctx.beginPath();
      ctx.arc(zx, zy, zr, 0, Math.PI * 2);
      ctx.strokeStyle = Z.state === 'shrink' ? 'rgba(255,70,70,0.95)' : 'rgba(255,110,90,0.85)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (Z.state !== 'final' && (Z.tr !== Z.r || Z.tx !== Z.cx)) {
        ctx.beginPath();
        ctx.arc(gx(Z.tx), gy(Z.ty), Z.tr * cell, 0, Math.PI * 2);
        ctx.setLineDash([9, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // sea names --------------------------------------------------------------
    const seaRank = z < 3.6 ? 1 : z < 4.6 ? 2 : 3;
    ctx.textAlign = 'center';
    for (const s of M.seas) {
      if (s.rank > seaRank) continue;
      if (reg) {
        const sc = M.cellAt(s.x, s.y);
        if (sc < 0 || blk[sc]) continue;
      }
      const x = nx(s.x), y = ny(s.y);
      if (!inView(x, y, 80)) continue;
      const fs = s.rank === 1 ? 13 : 11.5;
      ctx.font = `italic 500 ${fs}px ${RA.FONT_UI}`;
      const txt = s.name.toUpperCase().split('').join(' ');
      ctx.fillStyle = 'rgba(176,207,209,0.72)';
      ctx.fillText(txt, x, y);
      const tw = ctx.measureText(txt).width;
      placed.push([x - tw / 2, y - fs / 2, tw, fs]);
    }

    // territory names (big players first) -------------------------------------
    const labels = ui.labels || [];
    ctx.textAlign = 'center';
    for (const L0 of labels) {
      const p = G.P[L0.id];
      if (!p || !p.alive) continue;
      const span = Math.sqrt(p.tiles) * cell; // rough territory width in px
      const isMe = p.type === 'me';
      let fs = Math.min(25, span * 0.18);
      if (isMe) fs = Math.max(fs, 11);
      if (fs < 9) continue;
      const x = gx(L0.x + 0.5), y = gy(L0.y + 0.5);
      if (!inView(x, y, 160)) continue;
      const name = p.name;
      ctx.font = `600 ${fs}px ${RA.FONT_UI}`;
      let tw = ctx.measureText(name).width;
      if (tw > span * 1.1 && !(isMe && fs <= 12)) {
        fs = Math.max(isMe ? 11 : 0, (fs * span * 1.1) / tw);
        if (fs < 9) continue;
        ctx.font = `600 ${fs}px ${RA.FONT_UI}`;
        tw = ctx.measureText(name).width;
      }
      if (!free(x - tw / 2, y - fs * 0.6, tw, fs * 1.75)) continue;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(228,236,223,0.72)';
      ctx.fillStyle = p.type === 'me' ? '#0a3a9e' : '#141a20';
      ctx.strokeText(name, x, y);
      ctx.fillText(name, x, y);
      const fs2 = Math.max(9, fs * 0.46);
      ctx.font = `600 ${fs2}px ${RA.FONT_UI}`;
      const tt = RA.fmt(p.troops);
      ctx.lineWidth = 2.5;
      ctx.strokeText(tt, x, y + fs * 0.72);
      ctx.fillStyle = 'rgba(20,26,32,0.85)';
      ctx.fillText(tt, x, y + fs * 0.72);
    }

    // cities -------------------------------------------------------------------
    if (this.showCities) {
      const minTier = z < 3.9 ? 3 : z < 4.9 ? 2 : 1;
      ctx.textAlign = 'left';
      const cs = ui.citiesSorted || M.cities;
      for (const c of cs) {
        if (c.tier < minTier) continue;
        if (reg && blk[c.c]) continue;
        const x = gx(c.x + 0.5), y = gy(c.y + 0.5);
        if (!inView(x, y, 40)) continue;
        const o = c.owner ? G.P[c.owner] : null;
        const r = c.tier === 3 ? 4.2 : c.tier === 2 ? 3.4 : 2.6;
        ctx.beginPath();
        if (c.tier === 3) ctx.rect(x - r, y - r, r * 2, r * 2);
        else ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = o ? o.hex : '#5a5f66';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = o && o === G.me ? '#ffffff' : 'rgba(20,24,28,0.9)';
        ctx.stroke();
        if (c.tier === 3) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
        }
        const fs = c.tier === 3 ? 12 : c.tier === 2 ? 11.5 : 10.5;
        ctx.font = `${c.tier === 3 ? 600 : 500} ${fs}px ${RA.FONT_UI}`;
        const tw = ctx.measureText(c.name).width;
        if (!free(x + r + 3, y - fs / 2, tw, fs)) continue;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(246,247,242,0.85)';
        ctx.strokeText(c.name, x + r + 3, y);
        ctx.fillStyle = '#20252b';
        ctx.fillText(c.name, x + r + 3, y);
      }
    }

    // railways & trains (factories) ---------------------------------------------
    const alpha = ui.alpha || 0;
    const road = RA.ERA && RA.ERA.road;
    if (cell >= 1.1) {
      ctx.lineCap = 'butt';
      for (const s of G.structs) {
        if (s.dead || !s.ready || s.type !== 'factory' || !s.links) continue;
        const fx0 = gx(s.x + 0.5), fy0 = gy(s.y + 0.5);
        for (const d of s.links) {
          const x1 = gx(d.x + 0.5), y1 = gy(d.y + 0.5);
          if (!inView((fx0 + x1) / 2, (fy0 + y1) / 2, Math.abs(x1 - fx0) + Math.abs(y1 - fy0) + 20)) continue;
          ctx.beginPath();
          ctx.moveTo(fx0, fy0);
          ctx.lineTo(x1, y1);
          if (road) {
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = 'rgba(120,86,50,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
            continue;
          }
          ctx.strokeStyle = 'rgba(40,36,34,0.55)';
          ctx.lineWidth = 3.2;
          ctx.stroke();
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = 'rgba(245,240,230,0.9)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      for (const tr of G.trains) {
        if (tr.done) continue;
        const t = Math.min(1, tr.t + alpha / tr.dur);
        const x = gx(tr.sx + (tr.tx - tr.sx) * t), y = gy(tr.sy + (tr.ty - tr.sy) * t);
        if (!inView(x, y, 20)) continue;
        const ang = Math.atan2(tr.ty - tr.sy, tr.tx - tr.sx);
        RA.Models.draw(ctx, road ? 'cart' : 'train', x, y, RA.clamp(cell * 2.2, 18, 32), G.P[tr.owner].hex, ang);
      }
    }

    // structures ----------------------------------------------------------------
    const ss = RA.clamp(cell * 1.8, 12, 25);
    for (const s of G.structs) {
      if (s.dead) continue;
      const x = gx(s.x + 0.5), y = gy(s.y + 0.5);
      if (!inView(x, y, 30)) continue;
      const o = G.P[s.owner];
      ctx.globalAlpha = s.ready ? 1 : 0.55;
      RA.drawStructIcon(ctx, RA.STRUCT[s.type].icon || s.type, x, y, s.type === 'city' ? ss * 1.15 : ss, o.hex);
      ctx.globalAlpha = 1;
      if (s.type === 'city' && this.showCities && cell >= 1.2) {
        ctx.font = `600 11px ${RA.FONT_UI}`;
        ctx.textAlign = 'left';
        const tw = ctx.measureText(s.name).width;
        if (free(x + ss * 0.7, y - 6, tw, 12)) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(246,247,242,0.85)';
          ctx.strokeText(s.name, x + ss * 0.7, y);
          ctx.fillStyle = '#20252b';
          ctx.fillText(s.name, x + ss * 0.7, y);
        }
      }
      if (s.empUntil > G.tick) RA.drawZap(ctx, x, y, ss, now);
      if (!s.ready) {
        const t = 1 - (s.doneAt - G.tick) / RA.STRUCT[s.type].time;
        ctx.beginPath();
        ctx.arc(x, y, ss * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * RA.clamp(t, 0, 1));
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if ((s.type === 'silo' || s.type === 'sam' || s.type === 'airport') && s.cd > G.tick && s.owner === (G.me && G.me.id)) {
        const cd = s.type === 'silo' ? RA.CFG.SILO_CD : s.type === 'sam' ? RA.CFG.SAM_CD : RA.CFG.PARA_CD;
        const t = 1 - (s.cd - G.tick) / cd;
        ctx.beginPath();
        ctx.arc(x, y, ss * 0.78, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
        ctx.strokeStyle = '#f2b134';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (ui.selStruct === s.type && s.owner === (G.me && G.me.id)) {
        // show ranges while placing similar buildings
      }
    }
    // targeting overlays: my airports' reach (paratroopers), hostile air defence (missiles & planes)
    if (ui.mode && (ui.mode.kind === 'para' || ui.mode.kind === 'missile') && G.me) {
      ctx.lineWidth = 1.5;
      for (const s of G.structs) {
        if (s.dead || !s.ready) continue;
        const mineAp = ui.mode.kind === 'para' && s.type === 'airport' && s.owner === G.me.id;
        const enemySam = s.type === 'sam' && s.owner !== G.me.id && !G.me.allies.has(s.owner);
        if (!mineAp && !enemySam) continue;
        const R = (mineAp ? RA.CFG.PARA_RANGE : RA.CFG.SAM_R) * cell;
        ctx.beginPath();
        ctx.arc(gx(s.x + 0.5), gy(s.y + 0.5), R, 0, Math.PI * 2);
        ctx.setLineDash(mineAp ? [6, 5] : [4, 4]);
        ctx.strokeStyle = mineAp ? 'rgba(255,255,255,0.8)' : 'rgba(255,93,93,0.75)';
        ctx.stroke();
        if (enemySam) {
          ctx.fillStyle = 'rgba(255,93,93,0.07)';
          ctx.fill();
        }
      }
      ctx.setLineDash([]);
    }
    // short-range weapons (siege engines, guns): show how far each of my launchers reaches
    if (ui.mode && ui.mode.kind === 'missile' && G.me && RA.MISSILE[ui.mode.type].range) {
      const R = RA.MISSILE[ui.mode.type].range * cell;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      for (const s of G.structs) {
        if (s.dead || !s.ready || s.owner !== G.me.id || s.type !== 'silo') continue;
        ctx.beginPath();
        ctx.arc(gx(s.x + 0.5), gy(s.y + 0.5), R, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
      }
      ctx.setLineDash([]);
    }
    // missile aim preview: exact blast area before launch + path from the silo that will fire
    if (ui.mode && ui.mode.kind === 'missile' && ui.mode.aim >= 0 && G.me) {
      const M = RA.MISSILE[ui.mode.type];
      const ax = (ui.mode.aim % W) + 0.5, ay = ((ui.mode.aim / W) | 0) + 0.5;
      const x = gx(ax), y = gy(ay);
      let silo = null, bd = 1e9;
      for (const s of G.structs) {
        if (s.dead || !s.ready || s.owner !== G.me.id || s.type !== 'silo') continue;
        const d0 = Math.hypot(s.x + 0.5 - ax, s.y + 0.5 - ay);
        if (M.range && d0 > M.range) continue;
        const d = d0 + (s.cd > G.tick || s.empUntil > G.tick ? 1e4 : 0);
        if (d < bd) {
          bd = d;
          silo = s;
        }
      }
      if (silo) {
        const sx = gx(silo.x + 0.5), sy = gy(silo.y + 0.5);
        const h = Math.min(160, Math.hypot(x - sx, y - sy) * 0.35);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + x) / 2, (sy + y) / 2 - h * 2, x, y);
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      RA.drawBlast(ctx, M, x, y, cell, now, -1);
    }
    // ranges for my forts/SAMs while in build mode
    if (ui.mode && ui.mode.kind === 'build' && (ui.mode.type === 'fort' || ui.mode.type === 'sam')) {
      const R = ui.mode.type === 'fort' ? RA.CFG.FORT_R : RA.CFG.SAM_R;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      for (const s of G.structs) {
        if (s.dead || s.type !== ui.mode.type || s.owner !== G.me.id) continue;
        ctx.beginPath();
        ctx.arc(gx(s.x + 0.5), gy(s.y + 0.5), R * cell, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // military units (era-aware battlefield miniatures) ------------------------------------------
    const me = G.me;
    const uw = RA.unitSize(cell);
    const selId = ui.mode && ui.mode.kind === 'unit' ? ui.mode.id : -1;
    for (const u of G.units) {
      if (u.dead) continue;
      const mine = me && u.owner === me.id;
      if (!mine && cell < 1.15) continue;
      const x = gx(u.x), y = gy(u.y);
      if (!inView(x, y, 40)) continue;
      const U = RA.UNIT[u.type];
      if (u.id === selId || (mine && ui.mode && (ui.mode.kind === 'recruit' || ui.mode.kind === 'unit'))) {
        ctx.beginPath();
        ctx.arc(x, y, U.r * cell, 0, Math.PI * 2);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = u.id === selId ? 'rgba(242,177,52,0.95)' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = u.id === selId ? 2 : 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
        if (u.type === 'art') {
          ctx.beginPath();
          ctx.arc(x, y, U.range * cell, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,120,90,0.45)';
          ctx.stroke();
        }
      }
      const moving = u.path && u.pi < u.path.length;
      const next = moving ? u.path[u.pi] : -1;
      const angle = moving ? Math.atan2(((next / W) | 0) + .5 - u.y, (next % W) + .5 - u.x) : -.35;
      if (u.id === selId && moving) {
        ctx.save();ctx.beginPath();ctx.moveTo(x,y);
        for(let i=u.pi;i<u.path.length;i++) ctx.lineTo(gx((u.path[i]%W)+.5),gy(((u.path[i]/W)|0)+.5));
        ctx.strokeStyle='rgba(238,213,156,.75)';ctx.lineWidth=1.5;ctx.setLineDash([4,6]);ctx.stroke();ctx.restore();
      }
      RA.drawUnit(ctx, U.sym || u.type, x, y, uw, G.P[u.owner].hex, mine, u.hp / U.hp, u.ready > G.tick, u.empUntil > G.tick, u.id === selId, now, angle, moving, G.tick-u.lastHit<15);
    }

    // straits: a dotted line where ships pass; red and solid when closed ------------------------------------------
    if (G.straits && G.straits.length) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const st of G.straits) {
        const C = st.closed ? G.P[st.closed] : null;
        ctx.strokeStyle = C ? 'rgba(255,80,70,0.9)' : 'rgba(170,215,255,0.55)';
        ctx.lineWidth = Math.max(1.5, cell * (C ? 0.6 : 0.3));
        ctx.setLineDash(C ? [] : [Math.max(2, cell * 0.5), Math.max(3, cell * 0.8)]);
        ctx.beginPath();
        for (const l of st.lines) l.forEach(([x, y], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, gx(x + 0.5), gy(y + 0.5)));
        ctx.stroke();
        if (cell >= 5) {
          const [x, y] = st.lines[0][0], lx = gx(x + 0.5) + 8, ly = gy(y + 0.5) - 8;
          if (inView(lx, ly, 60)) {
            ctx.setLineDash([]);
            ctx.font = '600 11px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.65)';
            const t = st.name + (C ? ' · zatvoren' : '');
            ctx.strokeText(t, lx, ly);
            ctx.fillStyle = C ? '#ff8f86' : '#cfe6ff';
            ctx.fillText(t, lx, ly);
          }
        }
      }
      ctx.restore();
    }

    // my pledged land (loans): hatched in the lender's colour ------------------------------------------------
    if (G.me && G.loans.length) {
      ctx.save();
      ctx.lineWidth = Math.max(1, cell * 0.12);
      for (const l of G.loans) {
        if (l.to !== G.me.id) continue;
        ctx.strokeStyle = G.P[l.from].hex;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        for (const c of l.cells) {
          if (G.owner[c] !== G.me.id) continue;
          const x = gx(c % W), y = gy((c / W) | 0);
          if (!inView(x, y, cell)) continue;
          ctx.moveTo(x, y + cell);
          ctx.lineTo(x + cell, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // pings of me and my allies (6 s) ------------------------------------------------------------------------
    if (G.me && G.pings.length) {
      for (const g of G.pings) {
        const age = (G.tick - g.tick) / 10;
        if (age > 6 || age < 0 || (g.pid !== G.me.id && !G.isFriendly(G.me, G.P[g.pid]))) continue;
        const P = RA.PINGS[g.k], x = gx((g.c % W) + 0.5), y = gy(((g.c / W) | 0) + 0.5);
        if (!inView(x, y, 40)) continue;
        const ph = (now / 900) % 1;
        ctx.save();
        ctx.strokeStyle = P.color;
        ctx.globalAlpha = 1 - ph;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 8 + ph * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 7, y - 14);
        ctx.arc(x, y - 16, 7, Math.PI * 0.8, Math.PI * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        const who = G.P[g.pid], label = `${P.name}${g.pid !== G.me.id && who ? ' · ' + (who.nick || who.name) : ''}`;
        ctx.strokeText(label, x, y - 28);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, y - 28);
        ctx.restore();
      }
    }

    // the arrow being drawn with the right mouse button (desktop) ----------------------------------------------
    const ar = ui.arrow;
    if (ar && ar.s >= 0 && ar.e >= 0) {
      const sx = gx((ar.s % W) + 0.5), sy = gy(((ar.s / W) | 0) + 0.5), ex = gx((ar.e % W) + 0.5), ey = gy(((ar.e / W) | 0) + 0.5);
      const ang = Math.atan2(ey - sy, ex - sx), len = Math.hypot(ex - sx, ey - sy), head = Math.min(22, Math.max(10, len * 0.25));
      if (len > 6) {
        const col = ar.ok ? 'rgba(255,214,102,0.95)' : 'rgba(255,110,110,0.9)';
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = col;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex - Math.cos(ang) * head * 0.6, ey - Math.sin(ang) * head * 0.6);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(ang - 0.45) * head, ey - Math.sin(ang - 0.45) * head);
        ctx.lineTo(ex - Math.cos(ang + 0.45) * head, ey - Math.sin(ang + 0.45) * head);
        ctx.closePath();
        ctx.fill();
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        const label = ar.ok ? `${ar.name} · ${Math.round(ui.ratio * 100)}%` : ar.why;
        ctx.strokeText(label, ex, ey - head - 6);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, ex, ey - head - 6);
        ctx.restore();
      }
    }

    // my attack focus markers ---------------------------------------------------
    if (G.me) {
      for (const a of G.attacks) {
        if (a.done || a.a !== G.me.id || a.focus < 0) continue;
        const x = gx((a.focus % W) + 0.5), y = gy(((a.focus / W) | 0) + 0.5);
        const k = a.corr;
        if (k) {
          // a directed attack: a translucent band as wide as its corridor and an arrow from the border to the target
          const sx = gx(k.sx + 0.5), sy = gy(k.sy + 0.5);
          const cw = Math.abs(gx(k.sx + 1) - gx(k.sx)), bw = Math.max(6, Math.sqrt(k.r2) * 2 * cw);
          const ang = Math.atan2(y - sy, x - sx), len = Math.hypot(x - sx, y - sy);
          if (len > 4 && (inView(sx, sy, bw) || inView(x, y, bw))) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(255,255,255,0.10)';
            ctx.lineWidth = bw;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(x, y);
            ctx.stroke();
            const head = Math.min(18, Math.max(9, len * 0.3));
            const ex = x - Math.cos(ang) * head * 0.6, ey = y - Math.sin(ang) * head * 0.6;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 3;
            ctx.setLineDash([7, 5]);
            ctx.lineDashOffset = -((now / 40) % 12);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - Math.cos(ang - 0.45) * head, y - Math.sin(ang - 0.45) * head);
            ctx.lineTo(x - Math.cos(ang + 0.45) * head, y - Math.sin(ang + 0.45) * head);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          continue;
        }
        if (!inView(x, y, 20)) continue;
        const ph = (now / 600) % 1;
        ctx.beginPath();
        ctx.arc(x, y, 5 + ph * 9, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - ph)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.stroke();
      }
    }

    // boats -------------------------------------------------------------------------
    for (const b of G.boats) {
      if (b.done) continue;
      const pos = Math.min(b.path.length - 1, b.pos + alpha * RA.CFG.BOAT_SPEED);
      const i0 = Math.floor(pos), i1 = Math.min(b.path.length - 1, i0 + 1), f = pos - i0;
      const c0 = b.path[i0], c1 = b.path[i1];
      const x0 = (c0 % W) + 0.5, y0 = ((c0 / W) | 0) + 0.5, x1 = (c1 % W) + 0.5, y1 = ((c1 / W) | 0) + 0.5;
      const x = gx(x0 + (x1 - x0) * f), y = gy(y0 + (y1 - y0) * f);
      if (!inView(x, y, 30)) continue;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const o = G.P[b.owner];
      const k = RA.clamp(cell * 1.2, 8, 15);
      RA.drawShip(ctx, 'boat', x, y, k * 2.4, o.hex, ang, now);
      if (cell > 2.5 || b.owner === (G.me && G.me.id)) {
        ctx.font = `600 10px ${RA.FONT_UI}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        const t = RA.fmt(b.troops);
        ctx.strokeText(t, x, y - k - 6);
        ctx.fillStyle = '#10151a';
        ctx.fillText(t, x, y - k - 6);
      }
    }

    // trade ships ------------------------------------------------------------------
    for (const sh of G.tships) {
      if (sh.done) continue;
      const pos = Math.min(sh.path.length - 1, sh.pos + alpha * RA.CFG.TRADE_SHIP_SPEED);
      const i0 = Math.floor(pos), i1 = Math.min(sh.path.length - 1, i0 + 1), f = pos - i0;
      const c0 = sh.path[i0], c1 = sh.path[i1];
      const x0 = (c0 % W) + 0.5, y0 = ((c0 / W) | 0) + 0.5, x1 = (c1 % W) + 0.5, y1 = ((c1 / W) | 0) + 0.5;
      const x = gx(x0 + (x1 - x0) * f), y = gy(y0 + (y1 - y0) * f);
      if (!inView(x, y, 20)) continue;
      RA.drawShip(ctx, 'trade', x, y, RA.clamp(cell * 2.5, 18, 30), G.P[sh.owner].hex, Math.atan2(y1-y0,x1-x0), now);
    }

    // paratrooper planes ----------------------------------------------------------
    for (const pl of G.planes) {
      if (pl.done) continue;
      const t = Math.min(1, pl.t + alpha / pl.dur);
      const x = gx(pl.sx + (pl.tx - pl.sx) * t), y = gy(pl.sy + (pl.ty - pl.sy) * t);
      if (!inView(x, y, 30)) continue;
      const ang = Math.atan2(pl.ty - pl.sy, pl.tx - pl.sx);
      RA.drawPlane(ctx, x, y, ang, G.P[pl.owner].hex);
      ctx.beginPath();
      ctx.arc(gx(pl.tx), gy(pl.ty), 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // missiles -----------------------------------------------------------------
    for (const m of G.missiles) {
      if (m.done) continue;
      const M = RA.MISSILE[m.type];
      const t = Math.min(1, m.t + alpha / m.dur);
      const sx = gx(m.sx), sy = gy(m.sy), tx = gx(m.tx), ty = gy(m.ty);
      const dist = Math.hypot(tx - sx, ty - sy);
      const hmax = m.kind === 'warhead' ? Math.min(40, dist * 0.3) : Math.min(220, dist * (m.kind === 'conv' ? 0.3 : 0.45));
      const P = (u) => [sx + (tx - sx) * u, sy + (ty - sy) * u - Math.sin(Math.PI * u) * hmax];
      // target zone: the exact blast area, visible from the moment of launch
      if (m.kind === 'warhead') {
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(4, M.r2 * cell), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,70,50,0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,70,50,0.7)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (!m.sam || m.t < m.samAt) {
        RA.drawBlast(ctx, M, tx, ty, cell, now, Math.max(0, ((1 - t) * m.dur) / 10));
      }
      // trail
      ctx.beginPath();
      const u0 = Math.max(0, t - (m.kind === 'warhead' ? 0.4 : 0.25));
      for (let k = 0; k <= 14; k++) {
        const u = u0 + ((t - u0) * k) / 14;
        const q = P(u);
        if (k === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      }
      const h = P(t);
      if (M.icon === 'siege' || M.icon === 'zeppelin') {
        if (M.icon === 'siege') {
          ctx.strokeStyle = 'rgba(90,80,70,0.45)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(h[0], h[1], 3.6, 0, Math.PI * 2);
          ctx.fillStyle = '#3b342d';
          ctx.fill();
          ctx.strokeStyle = '#d8d0c4';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          const zp = [sx + (tx - sx) * t, sy + (ty - sy) * t - Math.min(30, dist * 0.08)];
          RA.Models.draw(ctx,'zeppelin',zp[0],zp[1],32,G.P[m.owner].hex,Math.atan2(ty-sy,tx-sx));
        }
        continue;
      }
      ctx.strokeStyle = m.kind === 'conv' ? 'rgba(200,200,200,0.75)' : m.kind === 'emp' ? 'rgba(170,215,255,0.85)' : 'rgba(255,240,220,0.8)';
      ctx.lineWidth = m.kind === 'mirv' ? 3.2 : m.kind === 'warhead' || m.kind === 'conv' ? 1.6 : 2.2;
      ctx.stroke();
      const hr = m.kind === 'mirv' ? 13 : m.kind === 'warhead' || m.kind === 'conv' ? 6 : 10;
      const gr = ctx.createRadialGradient(h[0], h[1], 0, h[0], h[1], hr);
      if (m.kind === 'emp') {
        gr.addColorStop(0, 'rgba(235,248,255,1)');
        gr.addColorStop(0.45, 'rgba(90,170,255,0.85)');
        gr.addColorStop(1, 'rgba(60,120,255,0)');
      } else {
        gr.addColorStop(0, 'rgba(255,255,230,1)');
        gr.addColorStop(0.4, 'rgba(255,170,60,0.85)');
        gr.addColorStop(1, 'rgba(255,90,30,0)');
      }
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(h[0], h[1], hr, 0, Math.PI * 2);
      ctx.fill();
      const tail = P(Math.max(0,t-.01));
      RA.Models.draw(ctx,'missile',h[0],h[1],m.kind==='mirv'?22:16,G.P[m.owner].hex,Math.atan2(h[1]-tail[1],h[0]-tail[0]));
    }

    // blasts & interceptions ------------------------------------------------------
    const fxs = ui.fxList || [];
    for (const e of fxs) {
      const age = (now - e.t0) / 1000;
      if (e.kind === 'nuke') {
        const x = gx(e.x), y = gy(e.y), R = e.r * cell;
        if (age < 0.5) {
          const k = age / 0.5;
          ctx.beginPath();
          ctx.arc(x, y, R * (0.3 + 0.8 * k), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,${Math.round(250 - 120 * k)},${Math.round(200 - 180 * k)},${0.9 * (1 - k * 0.4)})`;
          ctx.fill();
        }
        const k2 = Math.min(1, age / 2.6);
        ctx.beginPath();
        ctx.arc(x, y, R * (0.6 + 1.1 * k2), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,220,180,${0.8 * (1 - k2)})`;
        ctx.lineWidth = 3 + 6 * (1 - k2);
        ctx.stroke();
        if (age < 1.6) {
          ctx.beginPath();
          ctx.arc(x, y, R * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(60,30,20,${0.35 * (1 - age / 1.6)})`;
          ctx.fill();
        }
      } else if (e.kind === 'conv') {
        const x = gx(e.x), y = gy(e.y), R = Math.max(10, e.r * cell);
        RA.drawImpact(ctx,x,y,R,age);
      } else if (e.kind === 'emp') {
        const x = gx(e.x), y = gy(e.y), R = e.r * cell;
        const k = Math.min(1, age / 1.6);
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const rr = R * (0.2 + 0.9 * k) * (1 + 0.06 * Math.sin(a * 9 + now / 60));
          if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.strokeStyle = `rgba(120,200,255,${0.95 * (1 - k)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = `rgba(100,170,255,${0.18 * (1 - k)})`;
        ctx.fill();
      } else if (e.kind === 'mirvsplit') {
        const x = gx(e.x), y = gy(e.y);
        const k = Math.min(1, age / 0.8);
        ctx.beginPath();
        ctx.arc(x, y, 8 + 30 * k, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (e.kind === 'shell') {
        const k = Math.min(1, age / 0.55);
        const x0 = gx(e.sx), y0 = gy(e.sy), x1 = gx(e.x), y1 = gy(e.y);
        if (k < 1) {
          const hx = x0 + (x1 - x0) * k, hy = y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * Math.min(40, Math.hypot(x1 - x0, y1 - y0) * 0.35);
          ctx.beginPath();
          ctx.arc(hx, hy, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#2a2622';
          ctx.fill();
        } else if (age < 1.1) {
          RA.drawImpact(ctx,x1,y1,13,age-.55);
        }
      } else if (e.kind === 'unitdead') {
        const x = gx(e.x), y = gy(e.y);
        RA.drawImpact(ctx,x,y,20,age);
      } else if (e.kind === 'para') {
        const x = gx(e.x), y = gy(e.y);
        const k = Math.min(1, age / 1.4);
        for (let i = 0; i < 5; i++) {
          const px = x + Math.cos(i * 1.3) * 12, py = y - 26 * (1 - k) + Math.sin(i * 2.1) * 6;
          ctx.beginPath();
          ctx.arc(px, py - 5, 4, Math.PI, 0);
          ctx.fillStyle = `rgba(255,255,255,${1 - k * 0.7})`;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(px - 4, py - 5); ctx.lineTo(px, py); ctx.lineTo(px + 4, py - 5);
          ctx.strokeStyle = `rgba(30,30,30,${1 - k * 0.7})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else if (e.kind === 'donate') {
        const k = Math.min(1, age / 1.5);
        const a0 = e.from, a1 = e.to;
        const x0 = gx((a0 % W) + 0.5), y0 = gy(((a0 / W) | 0) + 0.5), x1 = gx((a1 % W) + 0.5), y1 = gy(((a1 / W) | 0) + 0.5);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
        ctx.strokeStyle = `rgba(62,199,194,${0.9 * (1 - k * 0.6)})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (e.kind === 'coin') {
        const x = gx(e.x), y = gy(e.y) - 10 - age * 18;
        const a = Math.max(0, 1 - age / 1.4);
        if (a > 0) {
          ctx.font = `700 11px ${RA.FONT_UI}`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = `rgba(20,20,20,${0.6 * a})`;
          ctx.strokeText('+' + RA.fmt(e.v), x, y);
          ctx.fillStyle = `rgba(255,214,90,${a})`;
          ctx.fillText('+' + RA.fmt(e.v), x, y);
        }
      } else if (e.kind === 'intercept') {
        const x = gx(e.x), y = gy(e.y);
        const k = Math.min(1, age / 0.9);
        ctx.beginPath();
        ctx.moveTo(gx(e.sx), gy(e.sy));
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(160,230,255,${0.8 * (1 - k)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 6 + 18 * k, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,245,255,${1 - k})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // spawn phase markers ----------------------------------------------------------
    if (G.state === 'spawn') {
      const ph = (now / 900) % 1;
      for (const p of G.P) {
        if (!p || !p.alive || !p.spawned || p.type !== 'nation') continue;
        const c = p.nation.c;
        const x = gx((c % W) + 0.5), y = gy(((c / W) | 0) + 0.5);
        if (!inView(x, y, 30)) continue;
        ctx.beginPath();
        ctx.arc(x, y, 7 + ph * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(20,24,30,${0.55 * (1 - ph)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (G.me && G.me.spawned) {
        const c = G.me.capital;
        const x = gx((c % W) + 0.5), y = gy(((c / W) | 0) + 0.5);
        ctx.beginPath();
        ctx.arc(x, y, 10 + ph * 16, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(47,123,255,${1 - ph})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    // tap feedback
    if (ui.pingState && now - ui.pingState.t0 < 600) {
      const k = (now - ui.pingState.t0) / 600;
      ctx.beginPath();
      ctx.arc(ui.pingState.x, ui.pingState.y, 6 + 22 * k, 0, Math.PI * 2);
      ctx.strokeStyle = ui.pingState.bad ? `rgba(255,93,93,${1 - k})` : `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  },
});

/* blast area of a missile type at screen point (x,y): filled zone, outer/inner rings, pulse, crosshair.
   secs >= 0 adds a countdown label (in flight); secs < 0 = aiming preview */
RA.drawBlast = function (ctx, M, x, y, cell, now, secs) {
  const col = M.kind === 'emp' ? '110,180,255' : M.kind === 'conv' ? '255,160,60' : '255,64,48';
  const outer = Math.max(6, (M.kind === 'nuke' ? M.r2 : M.kind === 'mirv' ? M.spread : M.r) * cell);
  const inner = M.kind === 'nuke' ? M.r1 * cell : 0;
  const ph = (now / 900) % 1;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, outer, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${col},${M.kind === 'mirv' ? 0.07 : 0.17})`;
  ctx.fill();
  ctx.setLineDash([8, 5]);
  ctx.lineDashOffset = -now / 60;
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = `rgba(${col},0.95)`;
  ctx.stroke();
  ctx.setLineDash([]);
  if (inner > 2) {
    ctx.beginPath();
    ctx.arc(x, y, inner, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${col},0.2)`;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `rgba(${col},0.9)`;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, outer * (0.15 + 0.85 * ph), 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(${col},${0.55 * (1 - ph)})`;
  ctx.stroke();
  const k = 7;
  ctx.beginPath();
  ctx.moveTo(x - k, y); ctx.lineTo(x + k, y); ctx.moveTo(x, y - k); ctx.lineTo(x, y + k);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  const label = secs >= 0 ? `${M.name} · ${Math.ceil(secs)} s` : `${M.name} · ${M.kind === 'nuke' ? M.r2 : M.kind === 'mirv' ? M.spread : M.r} polja`;
  ctx.font = `700 11.5px ${RA.FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const ly = y - Math.min(outer, 120) - 5;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(12,16,20,0.85)';
  ctx.strokeText(label, x, ly);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, x, ly);
  ctx.textBaseline = 'middle';
  ctx.restore();
};

RA.drawZap = function (ctx, x, y, s, now) {
  const f = Math.sin(now / 90) > -0.2;
  if (!f) return;
  ctx.save();
  ctx.strokeStyle = '#8fd1ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.15, y - s * 0.6);
  ctx.lineTo(x + s * 0.1, y - s * 0.1);
  ctx.lineTo(x - s * 0.1, y - s * 0.05);
  ctx.lineTo(x + s * 0.15, y + s * 0.55);
  ctx.stroke();
  ctx.restore();
};

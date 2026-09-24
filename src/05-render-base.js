'use strict';
/* Basemap: two Leaflet canvas GridLayers rendered from Natural Earth vectors.
   - land layer (below territories): hypsometric relief inside the playable area
   - sea layer (above territories): sea/lakes cut out along the real coastline, rivers, borders
   The territory overlay sits between them, so real coastlines clip territory colours exactly. */

RA.MAPSTYLE = {
  sea: '#8db6ca',
  seaGlow: 'rgba(226,242,247,0.55)',
  lake: '#98c1d3',
  river1: '#5f93b3',
  river2: '#7aa8c3',
  coast: 'rgba(33,72,95,0.55)',
  border: 'rgba(62,52,84,0.42)',
  oobLand: '#cfcfc6',
  veil: 'rgba(23,33,43,0.30)',
};

RA.makeBaseLayers = function (map) {
  const S = RA.MAPSTYLE;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const V = map.vec;

  function lodKey(z) {
    return z < 4.6 ? 'z3' : z < 6.6 ? 'z5' : 'z7';
  }

  // path builders ---------------------------------------------------------
  function fillRings(ctx, layer, tb, T) {
    const { rings, bbox } = layer;
    const x0 = tb[0], y0 = tb[1], x1 = tb[2], y1 = tb[3];
    for (let r = 0; r < rings.length; r++) {
      if (bbox[4 * r] > x1 || bbox[4 * r + 2] < x0 || bbox[4 * r + 1] > y1 || bbox[4 * r + 3] < y0) continue;
      const a = rings[r];
      let lx = NaN, ly = NaN, first = true;
      for (let i = 0; i < a.length; i += 2) {
        // clamp far-away points to the padded tile box: keeps the fill exact inside the box
        let x = a[i], y = a[i + 1];
        x = x < x0 ? x0 : x > x1 ? x1 : x;
        y = y < y0 ? y0 : y > y1 ? y1 : y;
        const px = (x - T.ox) * T.s, py = (y - T.oy) * T.s;
        if (px === lx && py === ly) continue;
        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else ctx.lineTo(px, py);
        lx = px;
        ly = py;
      }
      ctx.closePath();
    }
  }
  function strokeLines(ctx, layer, tb, T, closed) {
    const { rings, bbox } = layer;
    const x0 = tb[0], y0 = tb[1], x1 = tb[2], y1 = tb[3];
    for (let r = 0; r < rings.length; r++) {
      if (bbox[4 * r] > x1 || bbox[4 * r + 2] < x0 || bbox[4 * r + 1] > y1 || bbox[4 * r + 3] < y0) continue;
      const a = rings[r];
      const n = a.length;
      let pen = false, px0 = a[0], py0 = a[1];
      const lim = closed ? n + 2 : n;
      for (let i = 2; i < lim; i += 2) {
        const j = i % n;
        const x = a[j], y = a[j + 1];
        // segment fully outside on one side -> skip
        if ((x < x0 && px0 < x0) || (x > x1 && px0 > x1) || (y < y0 && py0 < y0) || (y > y1 && py0 > y1)) {
          pen = false;
        } else {
          if (!pen) {
            ctx.moveTo((px0 - T.ox) * T.s, (py0 - T.oy) * T.s);
            pen = true;
          }
          ctx.lineTo((x - T.ox) * T.s, (y - T.oy) * T.s);
        }
        px0 = x;
        py0 = y;
      }
    }
  }
  function tileFrame(coords, size) {
    const n = Math.pow(2, coords.z);
    const span = 1 / n;
    const ox = coords.x * span, oy = coords.y * span;
    const s = size / span; // px per normalized unit
    return { ox, oy, s, span, z: coords.z };
  }

  // land layer -------------------------------------------------------------
  const LandLayer = L.GridLayer.extend({
    createTile(coords) {
      const size = this.getTileSize().x;
      const px = Math.round(size * dpr);
      const c = document.createElement('canvas');
      c.width = c.height = px;
      const ctx = c.getContext('2d');
      const T = tileFrame(coords, px);
      ctx.fillStyle = S.oobLand;
      ctx.fillRect(0, 0, px, px);
      // relief inside the playable rectangle
      const gx0 = Math.max(T.ox, map.X0), gy0 = Math.max(T.oy, map.Y0);
      const gx1 = Math.min(T.ox + T.span, map.X1), gy1 = Math.min(T.oy + T.span, map.Y1);
      if (gx1 > gx0 && gy1 > gy0) {
        const img = map.relief;
        const k = img.width / (map.X1 - map.X0);
        const sx = (gx0 - map.X0) * k, sy = (gy0 - map.Y0) * (img.height / (map.Y1 - map.Y0));
        const sw = (gx1 - gx0) * k, sh = (gy1 - gy0) * (img.height / (map.Y1 - map.Y0));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, (gx0 - T.ox) * T.s, (gy0 - T.oy) * T.s, (gx1 - gx0) * T.s, (gy1 - gy0) * T.s);
      }
      return c;
    },
  });

  // sea + lines layer -----------------------------------------------------
  const SeaLayer = L.GridLayer.extend({
    createTile(coords) {
      const size = this.getTileSize().x;
      const px = Math.round(size * dpr);
      const c = document.createElement('canvas');
      c.width = c.height = px;
      const ctx = c.getContext('2d');
      const T = tileFrame(coords, px);
      const z = coords.z;
      const lod = lodKey(z);
      const pad = T.span * 0.06;
      const tb = [T.ox - pad, T.oy - pad, T.ox + T.span + pad, T.oy + T.span + pad];
      const land = V['land_' + lod], lakes = V['lake_' + lod];
      const zf = Math.pow(1.35, z - 5); // line width scaling with zoom

      // sea
      ctx.fillStyle = S.sea;
      ctx.fillRect(0, 0, px, px);
      // shallow-water glow along coasts
      ctx.lineJoin = 'round';
      ctx.strokeStyle = S.seaGlow;
      ctx.lineWidth = Math.max(2, 7 * zf) * dpr;
      ctx.beginPath();
      strokeLines(ctx, land, tb, T, true);
      ctx.stroke();
      // cut out land
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      fillRings(ctx, land, tb, T);
      ctx.fill('nonzero');
      ctx.globalCompositeOperation = 'source-over';
      // lakes
      ctx.fillStyle = S.lake;
      ctx.beginPath();
      fillRings(ctx, lakes, tb, T);
      ctx.fill('nonzero');
      // rivers
      ctx.lineCap = 'round';
      if (z >= 5.5) {
        ctx.strokeStyle = S.river2;
        ctx.lineWidth = Math.max(0.6, 0.8 * zf) * dpr;
        ctx.beginPath();
        strokeLines(ctx, V.riv2_z7, tb, T, false);
        ctx.stroke();
      }
      ctx.strokeStyle = S.river1;
      ctx.lineWidth = Math.max(0.9, 1.35 * zf) * dpr;
      ctx.beginPath();
      strokeLines(ctx, z < 5.5 ? V.riv1_z3 : V.riv1_z7, tb, T, false);
      ctx.stroke();
      // lake + sea outlines
      ctx.strokeStyle = S.coast;
      ctx.lineWidth = Math.max(0.6, 0.75 * Math.sqrt(zf)) * dpr;
      ctx.beginPath();
      strokeLines(ctx, land, tb, T, true);
      strokeLines(ctx, lakes, tb, T, true);
      ctx.stroke();
      // country borders (real, for orientation only)
      ctx.strokeStyle = S.border;
      ctx.lineWidth = Math.max(0.6, 0.9 * Math.sqrt(zf)) * dpr;
      ctx.setLineDash([4 * dpr, 3 * dpr]);
      ctx.beginPath();
      strokeLines(ctx, z < 5.5 ? V.bord_z3 : V.bord_z7, tb, T, false);
      ctx.stroke();
      ctx.setLineDash([]);
      // veil outside the playable rectangle
      const gx0 = (map.X0 - T.ox) * T.s, gy0 = (map.Y0 - T.oy) * T.s, gx1 = (map.X1 - T.ox) * T.s, gy1 = (map.Y1 - T.oy) * T.s;
      if (gx0 > 0 || gy0 > 0 || gx1 < px || gy1 < px) {
        ctx.fillStyle = S.veil;
        ctx.beginPath();
        ctx.rect(0, 0, px, px);
        ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0);
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(20,30,40,0.55)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
        ctx.setLineDash([]);
      }
      return c;
    },
  });

  return {
    land: new LandLayer({ tileSize: 256, pane: 'tilePane', keepBuffer: 3, updateWhenZooming: false, noWrap: true }),
    sea: new SeaLayer({ tileSize: 256, pane: 'sea', keepBuffer: 3, updateWhenZooming: false, noWrap: true }),
  };
};

'use strict';
/* Overtake launcher: presentation only. Uses the existing map/era data and UI settings.
   The atlas is rasterized once per selection and composited in CSS 3D; no extra CDN,
   image asset, WebGL context, animation loop or simulation mutation is required. */
RA.CommandScreen = class {
  constructor(ui) {
    this.ui = ui;
    this.$ = ui.$;
    this.screen = this.$('startScreen');
    this.dialog = this.$('operationDialog');
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motion = !this.reduced.matches;
    try { if (localStorage.getItem('ra_menu_motion') === 'off') this.motion = false; } catch (_) {}
    this.decorateEras();
    this.$('configBtn').onclick = () => this.dialog.showModal();
    for (const id of ['configClose', 'configDone']) this.$(id).onclick = () => this.dialog.close();
    this.dialog.addEventListener('click', (e) => {
      const b = this.dialog.getBoundingClientRect();
      if (e.target === this.dialog && (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)) this.dialog.close();
    });
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    this.$('onlineToggle').onclick = () => {
      const box = this.$('onlineBox');
      box.hidden = !box.hidden;
      this.$('onlineToggle').setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden) box.scrollIntoView({ block: 'nearest', behavior: this.motion ? 'smooth' : 'instant' });
    };
    this.$('creditsBtn').onclick = () => ui.openSheet(ui.head('O igri i izvori karte') + '<div class="howto"><p><strong>Overtake</strong> — strateška igra osvajanja Evrope i svijeta kroz sedam historijskih doba.</p><p>Karta: Natural Earth (javno vlasništvo). Historijske granice: historical-basemaps, A. Ourednik (GPL-3.0). Reljef: NASA. Motor karte: Leaflet.</p><p>Verzija 0.5 · doba i battle royale.</p></div>');
    this.$('motionBtn').onclick = () => {
      this.motion = !this.motion;
      try { localStorage.setItem('ra_menu_motion', this.motion ? 'on' : 'off'); } catch (_) {}
      this.applyMotion();
    };
    this.reduced.addEventListener('change', () => {
      if (this.reduced.matches) this.motion = false;
      this.applyMotion();
    });
    const full = this.$('fullscreenBtn');
    full.hidden = !document.fullscreenEnabled;
    full.onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (_) { full.hidden = true; }
    };
    document.addEventListener('fullscreenchange', () => {
      const label = document.fullscreenElement ? 'Izađi iz cijelog ekrana' : 'Cijeli ekran';
      full.setAttribute('aria-label', label);
      full.title = label;
    });
    this.screen.addEventListener('pointermove', (e) => {
      if (!this.motion || this.reduced.matches || e.pointerType !== 'mouse' || window.innerWidth < 761) return;
      const scene = this.$('atlasScene');
      scene.style.setProperty('--atlas-x', ((e.clientX / window.innerWidth - .5) * 14).toFixed(1) + 'px');
      scene.style.setProperty('--atlas-y', ((e.clientY / window.innerHeight - .5) * 9).toFixed(1) + 'px');
    });
    this.screen.addEventListener('pointerleave', () => {
      this.$('atlasScene').style.setProperty('--atlas-x', '0px');
      this.$('atlasScene').style.setProperty('--atlas-y', '0px');
    });
    // Hidden screens and background tabs stop every decorative CSS animation.
    this.visibility = new MutationObserver(() => {
      if (this.screen.hidden && this.dialog.open) this.dialog.close();
      this.applyMotion();
      if (!this.screen.hidden) this.refresh();
    });
    this.visibility.observe(this.screen, { attributes: true, attributeFilter: ['hidden'] });
    this.dialogVisibility = new MutationObserver(() => this.applyMotion());
    this.dialogVisibility.observe(this.dialog, { attributes: true, attributeFilter: ['open'] });
    document.addEventListener('visibilitychange', () => this.applyMotion());
    this.applyMotion();
    this.refresh();
  }

  applyMotion() {
    const still = !this.motion || this.reduced.matches || this.screen.hidden || this.dialog.open || document.hidden;
    this.screen.classList.toggle('command-still', still);
    const b = this.$('motionBtn'), active = this.motion && !this.reduced.matches;
    b.setAttribute('aria-pressed', String(active));
    b.setAttribute('aria-label', active ? 'Isključi animacije' : 'Uključi animacije');
    b.title = this.reduced.matches ? 'Smanjene animacije prema postavkama uređaja' : b.getAttribute('aria-label');
    b.disabled = this.reduced.matches;
    b.innerHTML = RA.icon(active ? 'pause' : 'play');
  }

  decorateEras() {
    const motifs = [
      '<path d="M5 21h14M7 19V8a5 5 0 0 1 10 0v11M7 12h10M12 12v7M5 9V6a7 7 0 0 1 14 0v3"/>',
      '<path d="M3 21V8h4V4h3v4h4V4h3v4h4v13H3ZM10 21v-6h4v6M3 12h18"/>',
      '<path d="M3 18h18L18 9l-6 3-6-3-3 9ZM7 20h10M12 3v6M9 6h6"/>',
      RA.ICONS.art, RA.ICONS.tank, RA.ICONS.rocket, RA.ICONS.locate,
    ];
    this.$('eraSeg').querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-label', RA.ERAS[i].name + ', ' + RA.ERAS[i].sub);
      b.insertAdjacentHTML('beforeend', `<span class="era-number" aria-hidden="true">0${i + 1}</span><svg class="era-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${motifs[i]}</svg>`);
    });
  }

  refresh() {
    const s = this.ui.settings;
    // Lobby settings can change while the launcher is hidden. Reflect them on return.
    for (const [id, value] of [['mapSeg', s.map], ['eraSeg', s.era], ['startSeg', s.start], ['gmSeg', s.gm], ['diffSeg', s.difficulty], ['peaceSeg', String(s.peace)], ['csSeg', String(s.cityStates)]]) {
      this.$(id).querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === value)));
    }
    const reg = RA.regionsOf(s.map).find((r) => r.id === s.region);
    const region = s.region === s.map || !reg ? RA.mapInfo(s.map).name : reg.name;
    this.$('operationSummary').textContent = `${region} · ${s.gm === 'br' ? 'Battle royale' : 'Klasično'} · ${{lako:'Lako',srednje:'Srednje',tesko:'Teško'}[s.difficulty] || 'Srednje'}`;
    this.$('atlasRegion').textContent = region.toUpperCase();
    const map = this.ui.app.maps[s.map];
    if (!map) return; // The map loader calls startNotes/refresh again when the data arrives.
    const key = map.id + '|' + s.era + '|' + s.region + '|' + !!map.eras[s.era];
    if (key !== this.atlasKey) {
      this.atlasKey = key;
      cancelAnimationFrame(this.drawRequest);
      this.drawRequest = requestAnimationFrame(() => this.drawAtlas());
    }
  }

  drawAtlas() {
    const map = this.ui.app.maps[this.ui.settings.map], canvas = this.$('atlasCanvas');
    if (!map) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // the CSS backdrop remains usable without canvas
    const world = map.id === 'svijet';
    this.screen.classList.toggle('command-world', world);
    this.screen.style.setProperty('--atlas-aspect', String(map.W / map.H));
    canvas.width = world ? 1536 : 960;
    canvas.height = Math.round(canvas.width * map.H / map.W);
    const w = canvas.width, h = canvas.height;
    this.$('atlasSignals').setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.$('atlasCoordinate').innerHTML = world ? 'N 00° 00′ &nbsp; E 00° 00′<span>02 / SVIJET</span>' : 'N 48° 51′ &nbsp; E 02° 21′<span>01 / EVROPA</span>';
    const px = (x) => (x - map.X0) / (map.X1 - map.X0) * w;
    const py = (y) => (y - map.Y0) / (map.Y1 - map.Y0) * h;
    const pathFor = (layer, close) => {
      const path = new Path2D();
      if (!layer) return path;
      for (const a of layer.rings) {
        path.moveTo(px(a[0]), py(a[1]));
        for (let i = 2; i < a.length; i += 2) path.lineTo(px(a[i]), py(a[i+1]));
        if (close) path.closePath();
      }
      return path;
    };
    const land = pathFor(map.vec.land_z5, true);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.clip(land, 'evenodd');
    ctx.fillStyle = '#2f4249';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = .3;
    ctx.filter = 'grayscale(1) contrast(1.6)';
    ctx.drawImage(map.relief, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(10,30,40,.4)';
    ctx.fillRect(0, 0, w, h);

    const era = map.eras[this.ui.settings.era];
    const reg = RA.REGIONS.find((r) => r.id === this.ui.settings.region);
    if (era) {
      // Real era ownership outlines. The red wash is a visual accent, never a player selection.
      const tint = document.createElement('canvas');
      tint.width = map.W; tint.height = map.H;
      const tc = tint.getContext('2d'), img = tc.createImageData(map.W, map.H);
      const focus = reg.poly || RA.REGIONS.find((r) => r.id === 'balkan').poly;
      const poly = focus.map(([lon, lat]) => [RA.lonToX(lon), RA.latToY(lat)]);
      for (let y = 0; y < map.H; y++) {
        for (let x = 0; x < map.W; x++) {
          const c = y * map.W + x;
          if (!map.land[c]) continue;
          const v = era.own[c], k = c * 4;
          const border = v && ((x && era.own[c-1] !== v) || (y && era.own[c-map.W] !== v));
          const hot = RA.pointInPoly(map.X0 + x * map.CELL, map.Y0 + y * map.CELL, poly);
          img.data[k] = hot ? (border ? 255 : 209) : 162;
          img.data[k+1] = hot ? (border ? 154 : 79) : 188;
          img.data[k+2] = hot ? (border ? 121 : 66) : 192;
          img.data[k+3] = border ? (hot ? 200 : 110) : hot ? 120 : (v % 4) * 8;
        }
      }
      tc.putImageData(img, 0, 0);
      ctx.drawImage(tint, 0, 0, w, h);
    }
    // A restrained coordinate grid reads as a physical strategic atlas.
    ctx.strokeStyle = 'rgba(193,220,230,.055)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 64) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
    for (let y = 0; y < h; y += 64) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();
    const light = ctx.createLinearGradient(0, 0, w, h);
    light.addColorStop(0, 'rgba(133,177,192,.13)'); light.addColorStop(.6, 'rgba(2,12,18,0)'); light.addColorStop(1, 'rgba(2,9,14,.35)');
    ctx.fillStyle = light; ctx.fillRect(0,0,w,h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(165,194,202,.48)'; ctx.lineWidth = 1.25; ctx.stroke(land);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(pathFor(map.vec.lake_z5, true), 'evenodd');
    ctx.globalCompositeOperation = 'source-over';

    const at = (lon,lat) => [px(RA.lonToX(lon)), py(RA.latToY(lat))];
    const cities = world ? [[-74,40.71], [-46.63,-23.55], [18.42,-33.93], [18.42,43.85], [77.2,28.61], [139.69,35.68]] : [[2.35,48.85], [13.4,52.52], [12.5,41.9], [18.42,43.85], [28.98,41.01], [21.01,52.23]];
    const points = cities.map(([lon,lat]) => at(lon,lat));
    const [sx,sy] = points[3];
    const route = points.filter((_,i) => i !== 3).map(([x,y]) => `<path class="atlas-route" d="M${sx},${sy} Q${(sx+x)/2},${Math.min(sy,y)-100} ${x},${y}" stroke="#e49075" stroke-width="1.4" opacity=".45"/>`).join('');
    const nodes = points.map(([x,y],i) => `<g><circle cx="${x}" cy="${y}" r="${i===3?10:4}" fill="#ffb490"/><circle cx="${x}" cy="${y}" r="${i===3?23:12}" stroke="#ffac83" opacity=".5"/>${i===3?`<circle class="atlas-beacon" cx="${x}" cy="${y}" r="38" stroke="#ff9b79" stroke-width="2"/>`:''}</g>`).join('');
    this.$('atlasSignals').innerHTML = route + nodes;
  }
};

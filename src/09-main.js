'use strict';
/* Ratni Atlas — boot, Leaflet map, game loop */

RA.App = class {
  constructor() {
    this.speed = 1;
    this.paused = false;
    this.sheetPaused = false;
    this.acc = 0;
    this.G = null;
    this.frame = this.frame.bind(this);
  }

  async boot() {
    const msg = document.getElementById('loadMsg');
    try {
      const eu = await RA.loadMap();
      eu.eras = await RA.loadEras(window.ERADATA, eu.N);
      this.maps = { evropa: eu }; // other maps (the world) are fetched from our server when chosen
      this.map = eu; // the map shown now (layers are built for it)
    } catch (e) {
      msg.textContent = e && e.message === 'no-decompression' ? 'Preglednik je prestar za ovu igru. Ažuriraj Chrome/Safari.' : 'Greška pri učitavanju karte: ' + (e && e.message);
      console.error(e);
      return;
    }
    this.initLeaflet();
    this.ui = new RA.UI(this);
    this.net = new RA.Net(this);
    this.ui.initOnline();
    this.net.init();
    this.long = new RA.Long(this); // long games (09c-long.js)
    const lm = /^\/long-([a-z0-9]{6})\/?$/.exec(location.pathname);
    if (lm) setTimeout(() => this.long.open(lm[1]), 0);
    this.attract();
    this.showStart();
    document.getElementById('loading').hidden = true;
    requestAnimationFrame(this.frame);
    window.__ra = this; // debug handle
    this.probeMaps();
    // "Nastavi igru": save the single-player game now and then, and whenever the page is hidden or closed
    setInterval(() => this.autosave(), 20000);
    document.addEventListener('visibilitychange', () => document.hidden && this.autosave(true));
    window.addEventListener('pagehide', () => this.autosave(true));
  }

  /* ---------------- maps ---------------- */
  /* which other maps our server has (HEAD request; none on file:// or in the claude.ai artifact) */
  probeMaps() {
    this.mapOK = { evropa: true };
    for (const m of RA.MAPS) {
      if (this.mapOK[m.id]) continue;
      const done = (ok) => {
        this.mapOK[m.id] = ok;
        this.ui.mapsChanged(m.id);
      };
      if (!RA.DATA_URL) done(false);
      else RA.hasFile(RA.DATA_URL + m.id + '/map.json').then(done);
    }
  }
  mapReady(id, era) {
    const m = this.maps[id];
    return !!m && RA.eraReady(m, RA.eraById(era).id);
  }
  /* fetch + decode a map and one of its eras (cached; one download at a time per map) */
  ensureMap(id, era) {
    const P = (this._mapP = this._mapP || {});
    const got = this.maps[id]
      ? Promise.resolve(this.maps[id])
      : (P[id] = P[id] || RA.fetchMap(id, (n, tot) => this.loadProgress(id, n, tot)).then((m) => (this.maps[id] = m)).finally(() => delete P[id]));
    return got.then((m) => RA.loadEra(m, RA.eraById(era).id).then(() => m));
  }
  loadProgress(id, n, tot) {
    const base = RA.mapInfo(id).load;
    const txt = n < 0 ? base.replace('Učitavam', 'Pripremam') : n > 0 ? `${base} ${tot ? Math.round((n / tot) * 100) + '%' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB'}` : base;
    document.getElementById('loadMsg').textContent = txt;
  }
  /* run fn once the map and era are there (at once for Europe); loading shows the full-screen loading overlay */
  withMap(id, era, fn) {
    if (this.mapReady(id, era)) {
      fn();
      return Promise.resolve(true);
    }
    const ov = document.getElementById('loading');
    this.loadProgress(id, 0);
    ov.hidden = false;
    return this.ensureMap(id, era).then(
      () => {
        ov.hidden = true;
        fn();
        return true;
      },
      (e) => {
        ov.hidden = true;
        console.warn('map', id, e);
        if (e && e.message === 'no-era') this.ui.eraMissing(id, RA.eraById(era).id);
        else this.ui.mapFailed(id);
        return false;
      }
    );
  }
  /* start screen: show this map (the background game runs on it) */
  useMap(id) {
    const s = this.ui.settings;
    return this.withMap(id, s.era, () => {
      if (s.map !== id) return; // switched again while loading
      this.setMap(this.maps[id]);
      this.attract();
      this.fitMap();
      this.ui.startNotes();
    });
  }
  /* layers, bounds and zoom for another map's geometry */
  setMap(M) {
    if (this.map === M) return;
    this.map = M;
    const land = this.lmap.hasLayer(this.base.land);
    this.base.land.remove();
    this.base.sea.remove();
    this.addBase(M, land);
    this.terr.setMap(M);
    this.fx.gm = M;
    this.mapBounds(M);
    this.ui.applyMapUI();
  }
  addBase(M, withLand) {
    const base = (this.base = RA.makeBaseLayers(M));
    const rb = L.latLngBounds([[M.meta.RLAT0, M.meta.RLON0], [M.meta.RLAT1, M.meta.RLON1]]);
    base.land.options.bounds = rb;
    base.sea.options.bounds = rb;
    if (withLand) base.land.addTo(this.lmap);
    base.sea.addTo(this.lmap);
  }
  mapBounds(M) {
    const me = M.meta, lm = this.lmap;
    this.defBounds = M.id === 'evropa' ? L.latLngBounds([[4, -45], [83, 75]]) : L.latLngBounds([[me.RLAT0, me.RLON0], [me.RLAT1, me.RLON1]]).pad(0.08);
    lm.setMinZoom(me.minZoom != null ? me.minZoom : 2);
    lm.setMaxZoom(me.maxZoom != null ? me.maxZoom : 9.5);
    lm.setMaxBounds(this.defBounds);
    // zooms in the code are tuned for Europe's cells: on a map with bigger cells the same view is a bit farther out
    this.zoomOff = Math.log2(this.maps.evropa.CELL / M.CELL);
  }
  zoomAt(z) {
    return z + (this.zoomOff || 0);
  }

  initLeaflet() {
    const M = this.map;
    const lmap = (this.lmap = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 110,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      bounceAtZoomLimits: false,
      maxBoundsViscosity: 0.85,
      inertiaDeceleration: 2600,
      tapTolerance: 14,
    }));
    lmap.attributionControl.setPrefix(false);
    L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 100 }).addTo(lmap);
    lmap.attributionControl.addAttribution('Natural Earth · NASA · <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    const pane = (name, z) => {
      const p = lmap.createPane(name);
      p.style.zIndex = z;
      p.style.pointerEvents = 'none';
      return p;
    };
    pane('territory', 350);
    pane('sea', 400);
    pane('fx', 450);
    this.mapBounds(M);
    this.addBase(M, true);
    this.terr = new RA.TerritoryLayer(M);
    this.terr.addTo(lmap);
    if (!this.terr.ok) {
      document.getElementById('loadMsg').textContent = 'Ovaj uređaj ne podržava WebGL.';
    }
    this.fx = new RA.FxLayer(M);
    this.fx.addTo(lmap);
    lmap.on('move zoom resize viewreset', () => {
      this.terr.dirtyView = true;
      this.viewMoved = true;
    });
    // OpenStreetMap tiles work only outside Claude's sandbox (on our own domain / app). Probe once.
    this.osmOK = false;
    const probe = new Image();
    probe.onload = () => (this.osmOK = true);
    probe.src = 'https://tile.openstreetmap.org/2/2/1.png';
    lmap.on('click', (e) => this.ui.onTap(e.latlng, e.containerPoint));
    // desktop: right button + drag from own land draws the arrow of a directed attack; a right click without a drag
    // (and a long touch) opens the menu of that spot. Some systems fire contextmenu on the press, others on release.
    const box = lmap.getContainer();
    let rd = null, eatCtx = false; // eatCtx: the contextmenu of a finished drag (released before it came)
    const cpOf = (e) => {
      const r = box.getBoundingClientRect();
      return L.point(e.clientX - r.left, e.clientY - r.top);
    };
    box.addEventListener('mousedown', (e) => {
      if (e.button !== 2) return;
      rd = { p0: cpOf(e), moved: false, long: null };
      eatCtx = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!rd) return;
      const p = cpOf(e);
      if (!rd.moved && p.distanceTo(rd.p0) > 10) rd.moved = true;
      if (rd.moved) this.ui.arrowDrag(lmap.containerPointToLatLng(rd.p0), lmap.containerPointToLatLng(p));
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 2 || !rd) return;
      const r = rd;
      rd = null;
      if (r.moved) {
        eatCtx = true;
        setTimeout(() => (eatCtx = false), 400);
        this.ui.arrowDrop();
      } else if (r.long) this.ui.onLong(r.long.ll, r.long.cp);
    });
    lmap.on('mousemove', (e) => (this.ui.mouseLL = e.latlng)); // tipka G: ping where the mouse is
    lmap.on('contextmenu', (e) => {
      if (e.originalEvent) e.originalEvent.preventDefault();
      if (eatCtx) return void (eatCtx = false);
      if (rd) {
        if (!rd.moved) rd.long = { ll: e.latlng, cp: e.containerPoint };
        return;
      }
      this.ui.onLong(e.latlng, e.containerPoint);
    });
    this.fitMap();
  }
  setOSM(on) {
    if (on && !this.osmOK) return false;
    if (on) {
      if (!this.osm) {
        this.osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        });
      }
      this.base.land.remove();
      this.osm.addTo(this.lmap);
    } else if (this.osm) {
      this.osm.remove();
      this.base.land.addTo(this.lmap);
    }
    this.osmOn = on;
    return true;
  }
  fitBox(box, padBottom) {
    const b = L.latLngBounds([[box[1], box[0]], [box[3], box[2]]]);
    this.lmap.fitBounds(b, { paddingTopLeft: [8, 60], paddingBottomRight: [8, padBottom || 20], animate: false });
  }
  fitMap(padBottom) {
    const M = this.map.meta;
    const b = L.latLngBounds([[M.LAT0 + 1, M.LON0], [M.LAT1 - 1.5, M.LON1]]);
    this.lmap.fitBounds(b, { paddingTopLeft: [8, 60], paddingBottomRight: [8, padBottom || 20], animate: false });
  }

  /* the game being shown (and its era's names and city list for the renderer) */
  setGame(G) {
    RA.TICK_REAL = G && G.long && this.long && this.long.rec ? this.long.rec.tickMs : 100; // Focus: timers in real time
    this.G = G;
    this.ui.audio.setEra(G.era || 'danas');
    this.ui.feedReset();
    this.ui.rulersReset();
    RA.applyEra(G.era);
    if (this.ui.settings.cb) RA.applyColorblind(G, true);
    this.ui.citiesSorted = G.cities.slice().sort((a, b) => b.tier - a.tier || b.pop - a.pop);
    this.ui.applyEraUI();
  }
  attract() {
    const G = RA.newGame(this.map, { seed: (Math.random() * 1e9) | 0, difficulty: 'srednje', cityStates: 30 });
    RA.startGame(G);
    this.setGame(G);
    this.attractMode = true;
    this.speed = 2;
    this.terr.reset(G);
    this.ui && (this.ui.fxList = []);
  }
  showStart() {
    const ui = this.ui;
    if (this.long && this.long.rec) {
      this.long.snap(); // the Focus game stays in "Nastavi Focus igru"
      this.long.close();
      if (/^\/long-/.test(location.pathname)) history.replaceState(null, '', '/');
    }
    this.autosave(true); // leaving a game: keep it for "Nastavi igru"
    if (ui.tut) ui.tut.end(false);
    if (this.net && (this.net.inGame || this.net.role)) this.net.endGame();
    document.getElementById('lobbyScreen').hidden = true;
    ui.closeSheet();
    ui.setMode(null);
    ui.showPlayUI(false);
    ui.spawnUI(false);
    document.getElementById('toasts').innerHTML = '';
    ui.reqToasts.clear();
    document.getElementById('endScreen').hidden = true;
    const want = this.maps[ui.settings.map] || this.maps.evropa;
    if (want !== this.map) {
      this.setMap(want);
      this.attractMode = false;
    }
    if (!this.attractMode) {
      this.lmap.setMaxBounds(this.defBounds);
      this.attract();
      this.fitMap();
    }
    this.paused = false;
    ui.syncStart();
    ui.resumeOffer();
    document.getElementById('startScreen').hidden = false;
  }
  newGame(over) {
    const s = Object.assign(this.ui.playSet(), over || {}); // the mode's rules (Blitz preset or Make your choice)
    if (!this.mapReady(s.map, s.era)) return this.withMap(s.map, s.era, () => this.newGame(over));
    this.setMap(this.maps[s.map]);
    document.getElementById('startScreen').hidden = true;
    const gm = RA.regionMap(RA.eraMap(this.map, s.era, s.start), s.region);
    RA.ME_COLOR = RA.PLAYER_COLORS.includes(s.color) ? s.color : RA.PLAYER_COLORS[0];
    const seed = (Math.random() * 1e9) | 0;
    const G = RA.newGame(gm, { seed, difficulty: s.difficulty, cityStates: s.cityStates, peace: s.peace, era: s.era, start: s.start, gm: s.gm, res: !!s.res, tree: !!s.tree, noNuke: !!s.noNuke });
    G.gid = 's' + Math.random().toString(36).slice(2, 12); // this game on the player's account (results)
    // the record of this game for "Nastavi igru": settings + seed + spawn + every command at its tick (09b-save.js)
    G.rec = { v: 1, build: RA.BUILD, gid: G.gid, set: { map: s.map, region: s.region, era: s.era, start: s.start, gm: s.gm, difficulty: s.difficulty, cityStates: s.cityStates, peace: s.peace, res: !!s.res, tree: !!s.tree, noNuke: !!s.noNuke, seed, color: RA.ME_COLOR }, picks: [], name: '', cmds: [] };
    this.setGame(G);
    this.attractMode = false;
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    this.ui.watching = false;
    this.ui.tipsShown = new Set();
    this.ui.fxList = [];
    this.terr.reset(G);
    this.ui.spawnUI(true);
    this.updateSpeedBtn();
    const pb = (document.getElementById('spawnBar').offsetHeight || 190) + 24;
    if (gm.region) {
      const bx = gm.region.box;
      this.lmap.setMaxBounds(L.latLngBounds([[bx[1], bx[0]], [bx[3], bx[2]]]).pad(0.7));
      this.fitBox(bx, pb);
    } else {
      this.lmap.setMaxBounds(this.defBounds);
      this.fitMap(pb);
    }
  }
  start() {
    const G = this.G;
    if (!G.me || !G.me.spawned) return;
    if (G.rec) {
      G.rec.picks = (G.picks || []).slice();
      G.rec.name = this.ui.settings.name || 'Ti';
    }
    RA.startGame(G);
    if (this.ui.settings.cb) RA.applyColorblind(G, true); // the player's own colour too
    this.terr.updatePalette();
    this.ui.spawnUI(false);
    this.ui.showPlayUI(true);
    this.updateSpeedBtn();
    this.updatePauseBtn();
    const ll = this.map.latLngOfCell(G.me.capital);
    this.lmap.flyTo(ll, Math.max(this.lmap.getZoom(), this.zoomAt(4.9)), { duration: 1.1 });
  }
  /* an online game: identical on every device (seed, settings, players), stepped in lockstep by RA.Net */
  /* "Igraj odmah" (plan 16, solo): Blitz on the chosen map and era, real borders, a random state, no choices */
  quickGame() {
    const s = this.ui.settings;
    this.newGame(Object.assign({}, RA.MODES.blitz.rules, { start: 'granice', difficulty: 'srednje', gm: 'klasik' }));
    const go = () => {
      const G = this.G;
      if (!G || G.state !== 'spawn') return setTimeout(go, 100); // the map may still be loading
      const ns = G.P.filter((p) => p && p.type === 'nation' && p.alive && p.tiles > 20);
      const n = ns[Math.floor(Math.random() * ns.length)];
      if (!n) return;
      this.ui.pickNation(String(n.id));
      this.start();
    };
    setTimeout(go, 0);
    return s;
  }
  startOnline(st, mySlot) {
    // the host's settings are untrusted: a known map (old builds had none: Europe) and a known era
    const set = st.set || {};
    const id = RA.MAPS.some((m) => m.id === set.map) ? set.map : 'evropa', era = RA.eraById(set.era).id;
    if (!this.mapReady(id, era)) {
      this.withMap(id, era, () => {
        if (this.net.st === st && this.net.inGame) this.startOnline(st, mySlot);
      }).then((ok) => {
        if (ok || !this.net.inGame) return;
        this.ui.toast('bad', 'Karta ove igre se ne može učitati — online igra nije moguća.', { ms: 6000 });
        this.showStart();
      });
      return;
    }
    this.setMap(this.maps[id]);
    const G = RA.setupOnline(this.map, st, mySlot);
    G.gid = 'o' + (this.net.gid || Math.random().toString(36).slice(2, 10));
    this.setGame(G);
    this.attractMode = false;
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    const ui = this.ui;
    ui.watching = false;
    ui.tipsShown = new Set();
    ui.fxList = [];
    ui.closeSheet();
    ui.setMode(null);
    document.getElementById('startScreen').hidden = true;
    document.getElementById('lobbyScreen').hidden = true;
    ui.spawnUI(false);
    this.terr.reset(G);
    this.terr.updatePalette();
    ui.showPlayUI(true);
    this.updateSpeedBtn();
    this.updatePauseBtn();
    const reg = G.map.region;
    this.lmap.setMaxBounds(reg ? L.latLngBounds([[reg.box[1], reg.box[0]], [reg.box[3], reg.box[2]]]).pad(0.7) : this.defBounds);
    if (G.me) this.lmap.setView(this.map.latLngOfCell(G.me.capital), this.zoomAt(5), { animate: false });
    const others = G.humans.filter((p) => p !== G.me).map((p) => p.nick).join(', ');
    ui.toast('good', `Online igra je počela — ${st.set.mode === 'coop' ? 'zajedno s: ' : 'protiv: '}${RA.esc(others)}.`, { ms: 6000 });
  }
  gameOver(kind) {
    if (this.attractMode) {
      this.attract();
      return;
    }
    this.ui.account.report(this.G, kind);
    const C = this.G.opts.camp;
    if (C && C.type !== 'free' && !this.ui.campOver) return void this.ui.campTick(); // a campaign mission ends in its own window
    this.autosave(); // lost, or won without playing on: the save goes
    if (kind === 'lost' && this.ui.watching) return;
    this.ui.closeSheet();
    this.ui.setMode(null);
    this.ui.showEnd(kind);
  }

  cycleSpeed() {
    if (this.guestLocked()) return;
    this.setSpeed(this.speed >= 3 ? 1 : this.speed + 1);
  }
  /* in an online game only the host controls time */
  guestLocked() {
    const net = this.net;
    if (this.G && this.G.long) {
      this.ui.toast('info', 'U dugoj igri vrijeme teče na serveru: jedan potez svakih nekoliko sekundi.');
      return true;
    }
    if (this.G && this.G.online && net && net.inGame && net.role !== 'host') {
      this.ui.toast('info', 'Brzinu i pauzu kontroliše domaćin igre.');
      return true;
    }
    return false;
  }
  setSpeed(s) {
    this.speed = s;
    this.updateSpeedBtn();
  }
  updateSpeedBtn() {
    document.getElementById('speedBtn').textContent = this.speed + '×';
  }
  togglePause() {
    if (this.guestLocked()) return;
    this.paused = !this.paused;
    this.updatePauseBtn();
  }
  updatePauseBtn() {
    const b = document.getElementById('pauseBtn');
    b.innerHTML = RA.icon(this.paused ? 'play' : 'pause');
    b.setAttribute('aria-label', this.paused ? 'Nastavi' : 'Pauza');
  }
  sheetPause(on) {
    // a shared online world never pauses because one player opened a menu
    this.sheetPaused = on && !(this.G && this.G.online);
  }

  frame(now) {
    requestAnimationFrame(this.frame);
    try {
      this.frameBody(now);
    } catch (e) {
      console.error(e);
    }
  }
  frameBody(now) {
    const dt = Math.min(250, now - (this.last || now));
    this.last = now;
    const G = this.G;
    const net = this.net;
    // The opaque launcher has its own atlas. Do not run or draw the hidden demo
    // behind it; the real single-player / online loop below is unchanged.
    if (this.replaying || (this.attractMode && !document.getElementById('startScreen').hidden)) {
      this.acc = 0;
      return;
    }
    if (G && G.long) {
      // a long game: the server's clock (09c-long.js)
      this.long.frame();
      this.ui.alpha = 0;
    } else if (G && G.online && net && net.inGame) {
      // online: lockstep — the host is the clock, guests replay up to the host's tick
      const t0 = performance.now();
      if (net.role === 'host' && net.catchUp > G.tick) {
        let n = 0;
        while (G.state === 'play' && G.tick < net.catchUp && n < 60) {
          net.applyTick(G.tick + 1);
          G.step();
          net.afterStep();
          n++;
          if (performance.now() - t0 > 40) break;
        }
        if (G.state !== 'play') net.catchUp = 0;
      } else if (net.role === 'host') {
        if (G.state === 'play') {
          net.hostPoll();
          if (!this.paused) {
            this.acc += dt * this.speed;
            const maxSteps = 3 + this.speed * 2;
            let n = 0;
            while (this.acc >= RA.CFG.TICK_MS && n < maxSteps) {
              if (!net.canAdvance(G.tick)) {
                this.acc = Math.min(this.acc, RA.CFG.TICK_MS);
                break;
              }
              net.applyTick(G.tick + 1);
              G.step();
              net.afterStep();
              this.acc -= RA.CFG.TICK_MS;
              n++;
              if (G.state !== 'play' || performance.now() - t0 > 45) break;
            }
            if (n >= maxSteps) this.acc = Math.min(this.acc, RA.CFG.TICK_MS);
          }
        }
        net.hostPublish();
      } else {
        net.guestPoll();
        if (this.speed !== net.hostSp) this.setSpeed(net.hostSp);
        if (this.paused !== net.hostPz) {
          this.paused = net.hostPz;
          this.updatePauseBtn();
        }
        // catch up quickly when behind (time-boxed below), otherwise follow the host smoothly
        const lag = net.hostT - G.tick;
        const maxN = lag > 6 ? 60 : 3;
        let n = 0;
        while (G.state === 'play' && G.tick < net.hostT && n < maxN) {
          net.applyTick(G.tick + 1);
          G.step();
          net.afterStep();
          n++;
          if (performance.now() - t0 > 40) break;
        }
        net.guestPublish();
      }
      this.ui.alpha = 0;
      this.simMs = performance.now() - t0;
    } else if (G && G.state === 'play' && !this.paused && !this.sheetPaused) {
      this.acc += dt * this.speed;
      const maxSteps = 3 + this.speed * 2;
      let n = 0;
      const t0 = performance.now();
      while (this.acc >= RA.CFG.TICK_MS && n < maxSteps) {
        G.step();
        this.acc -= RA.CFG.TICK_MS;
        n++;
        if (performance.now() - t0 > 45) {
          this.acc = Math.min(this.acc, RA.CFG.TICK_MS);
          break;
        }
      }
      if (n >= maxSteps) this.acc = Math.min(this.acc, RA.CFG.TICK_MS);
      this.ui.alpha = this.acc / RA.CFG.TICK_MS;
      this.simMs = performance.now() - t0;
    } else this.ui.alpha = 0;
    if (G) {
      if (this.attractMode) {
        G.events.length = 0;
        if (G.state === 'over') this.attract();
      }
      this.terr.sync();
      const moving = this.viewMoved;
      this.viewMoved = false;
      if (moving || now - (this.lastT || 0) > 32) {
        this.terr.draw(moving);
        this.lastT = now;
      }
      const ui = this.ui;
      const anim = moving || G.state === 'spawn' || G.boats.length || G.missiles.length || G.units.length || G.trains.length || G.planes.length || G.tships.length || (ui.mode && (ui.mode.aim >= 0 || ui.mode.kind === 'unit')) || ui.fxList.length || G.pings.some((g) => G.tick - g.tick < 60) || (ui.pingState && now - ui.pingState.t0 < 700) || (G.me && G.attacks.some((a) => !a.done && a.a === G.me.id && a.focus >= 0));
      // Cached models follow display cadence on desktop; retain the phone frame budget.
      const fxInterval = anim ? (this.fx.w > 900 && this.simMs < 12 ? 16 : 30) : 200;
      if (moving || now - (this.lastF || 0) >= fxInterval) {
        this.fx.draw(G, this.terr.view(), ui);
        this.lastF = now;
      }
      ui.frame(now);
    }
  }
};

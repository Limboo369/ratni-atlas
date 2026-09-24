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
      this.map = await RA.loadMap();
      await RA.loadEras();
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
    this.attract();
    this.showStart();
    document.getElementById('loading').hidden = true;
    requestAnimationFrame(this.frame);
    window.__ra = this; // debug handle
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
      minZoom: 2,
      maxZoom: 9.5,
      bounceAtZoomLimits: false,
      maxBounds: (this.defBounds = L.latLngBounds([[4, -45], [83, 75]])),
      maxBoundsViscosity: 0.85,
      inertiaDeceleration: 2600,
      tapTolerance: 14,
    }));
    lmap.attributionControl.setPrefix(false);
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
    const base = (this.base = RA.makeBaseLayers(M));
    const rb = L.latLngBounds([[M.meta.RLAT0, M.meta.RLON0], [M.meta.RLAT1, M.meta.RLON1]]);
    base.land.options.bounds = rb;
    base.sea.options.bounds = rb;
    base.land.addTo(lmap);
    base.sea.addTo(lmap);
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
    lmap.on('contextmenu', (e) => {
      if (e.originalEvent) e.originalEvent.preventDefault();
      this.ui.onLong(e.latlng, e.containerPoint);
    });
    this.fitEurope();
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
  fitEurope(padBottom) {
    const M = this.map.meta;
    const b = L.latLngBounds([[M.LAT0 + 1, M.LON0], [M.LAT1 - 1.5, M.LON1]]);
    this.lmap.fitBounds(b, { paddingTopLeft: [8, 60], paddingBottomRight: [8, padBottom || 20], animate: false });
  }

  /* the game being shown (and its era's names and city list for the renderer) */
  setGame(G) {
    this.G = G;
    RA.applyEra(G.era);
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
    if (this.net && (this.net.inGame || this.net.role)) this.net.endGame();
    document.getElementById('lobbyScreen').hidden = true;
    ui.closeSheet();
    ui.setMode(null);
    ui.showPlayUI(false);
    ui.spawnUI(false);
    document.getElementById('toasts').innerHTML = '';
    ui.reqToasts.clear();
    document.getElementById('endScreen').hidden = true;
    if (!this.attractMode) {
      this.lmap.setMaxBounds(this.defBounds);
      this.attract();
      this.fitEurope();
    }
    this.paused = false;
    document.getElementById('startScreen').hidden = false;
  }
  newGame() {
    const s = this.ui.settings;
    document.getElementById('startScreen').hidden = true;
    const gm = RA.regionMap(RA.eraMap(this.map, s.era, s.start), s.region);
    const G = RA.newGame(gm, { seed: (Math.random() * 1e9) | 0, difficulty: s.difficulty, cityStates: s.cityStates, peace: s.peace, era: s.era, start: s.start, gm: s.gm });
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
      this.fitEurope(pb);
    }
  }
  start() {
    const G = this.G;
    if (!G.me || !G.me.spawned) return;
    RA.startGame(G);
    this.terr.updatePalette();
    this.ui.spawnUI(false);
    this.ui.showPlayUI(true);
    this.updateSpeedBtn();
    this.updatePauseBtn();
    const ll = this.map.latLngOfCell(G.me.capital);
    this.lmap.flyTo(ll, Math.max(this.lmap.getZoom(), 4.9), { duration: 1.1 });
  }
  /* an online game: identical on every device (seed, settings, players), stepped in lockstep by RA.Net */
  startOnline(st, mySlot) {
    const G = RA.setupOnline(this.map, st, mySlot);
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
    if (G.me) this.lmap.setView(this.map.latLngOfCell(G.me.capital), 5, { animate: false });
    const others = G.humans.filter((p) => p !== G.me).map((p) => p.nick).join(', ');
    ui.toast('good', `Online igra je počela — ${st.set.mode === 'coop' ? 'zajedno s: ' : 'protiv: '}${RA.esc(others)}.`, { ms: 6000 });
  }
  gameOver(kind) {
    if (this.attractMode) {
      this.attract();
      return;
    }
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
    const dt = Math.min(250, now - (this.last || now));
    this.last = now;
    const G = this.G;
    const net = this.net;
    if (G && G.online && net && net.inGame) {
      // online: lockstep — the host is the clock, guests replay up to the host's tick
      const t0 = performance.now();
      if (net.role === 'host') {
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
      const anim = moving || G.state === 'spawn' || G.boats.length || G.missiles.length || G.units.length || G.trains.length || G.planes.length || G.tships.length || (ui.mode && (ui.mode.aim >= 0 || ui.mode.kind === 'unit')) || ui.fxList.length || (ui.pingState && now - ui.pingState.t0 < 700) || (G.me && G.attacks.some((a) => !a.done && a.a === G.me.id && a.focus >= 0));
      if (moving || now - (this.lastF || 0) > (anim ? 30 : 200)) {
        this.fx.draw(G, this.terr.view(), ui);
        this.lastF = now;
      }
      ui.frame(now);
    }
    requestAnimationFrame(this.frame);
  }
};

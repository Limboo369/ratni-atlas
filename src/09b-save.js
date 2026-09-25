'use strict';
/* "Snimi i nastavi" (plan phase 6): a single-player game is saved as its record — settings, seed, spawn and every
   command with its tick (G.rec, filled by app.newGame / app.start / ui.act). The simulation is deterministic (online
   play relies on it), so replaying the record rebuilds the game exactly; that takes seconds, not a snapshot of MBs.
   The save lives in this browser (localStorage 'ra_save') and, when signed in, on the account (/api/save), so a game
   started on one computer continues on another. One save: the latest single-player game. */
RA.SAVE_KEY = 'ra_save';
Object.assign(RA.App.prototype, {
  /* the current game as a save, or null when there is nothing to keep */
  saveData() {
    const G = this.G, me = G && G.me;
    if (!G || !G.rec || G.online || this.attractMode || this.ui.tut || this.replaying || !me || !G.rec.picks.length || G.state === 'spawn') return null;
    if (!me.alive || (G.state === 'over' && !G.continued)) return null;
    const s = G.rec.set, reg = RA.REGIONS.find((r) => r.id === s.region && r.map === s.map);
    return {
      rec: G.rec,
      tick: G.tick,
      at: Date.now(),
      meta: {
        where: s.region === s.map || !reg ? RA.mapInfo(s.map).all || RA.mapInfo(s.map).name : reg.name,
        era: RA.eraById(s.era).short,
        who: me.name,
        secs: Math.round(G.tick / 10),
        land: Math.round((me.area / G.landTotal()) * 1000) / 10,
      },
    };
  },
  /* every 20 s in a game, and when the page is hidden or closed; the account copy at most once a minute */
  autosave(force) {
    const sv = this.saveData(), G = this.G;
    if (!sv) {
      // a finished single-player game (lost, or won without playing on) needs no "Nastavi"
      if (G && G.rec && !G.online && !this.attractMode && G.me && (!G.me.alive || (G.state === 'over' && !G.continued))) this.dropSave(G.rec.gid);
      return;
    }
    try {
      localStorage.setItem(RA.SAVE_KEY, JSON.stringify(sv));
    } catch (_) {}
    const acc = this.ui.account;
    if (acc && acc.user && (force || !this._upAt || Date.now() - this._upAt > 60000)) {
      this._upAt = Date.now();
      const body = JSON.stringify(sv);
      // keepalive (survives closing the tab) only allows small bodies; a long game goes as a normal request
      fetch('/api/save', { method: 'POST', credentials: 'same-origin', keepalive: body.length < 60000, headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    }
  },
  dropSave(gid) {
    try {
      const old = JSON.parse(localStorage.getItem(RA.SAVE_KEY) || 'null');
      if (old && (!gid || old.rec.gid === gid)) localStorage.removeItem(RA.SAVE_KEY);
    } catch (_) {}
    const acc = this.ui.account;
    if (acc && acc.user && this._dropped !== gid) {
      this._dropped = gid;
      fetch('/api/save/delete', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gid }) }).catch(() => {});
    }
    this.ui.resumeOffer && this.ui.resumeOffer();
  },
  /* the newest save: this browser's or the account's */
  async findSave() {
    let local = null, remote = null;
    try {
      local = JSON.parse(localStorage.getItem(RA.SAVE_KEY) || 'null');
    } catch (_) {}
    const acc = this.ui.account;
    if (acc && acc.user) {
      try {
        const r = await fetch('/api/save', { credentials: 'same-origin' });
        if (r.ok) remote = (await r.json()).save;
      } catch (_) {}
    }
    const ok = (s) => s && s.rec && s.rec.v === 1 && Array.isArray(s.rec.cmds) && Array.isArray(s.rec.picks) && s.rec.picks.length && s.rec.set;
    if (!ok(local)) local = null;
    if (!ok(remote)) remote = null;
    return !local ? remote : !remote ? local : remote.at > local.at ? remote : local;
  },
  /* rebuild a saved game: same map, seed and spawn, then replay the commands up to the saved tick (with progress) */
  resumeSave(sv) {
    const r = sv.rec, s = r.set, ui = this.ui;
    if (!this.mapReady(s.map, s.era)) return this.withMap(s.map, s.era, () => this.resumeSave(sv));
    this.setMap(this.maps[s.map]);
    document.getElementById('startScreen').hidden = true;
    const gm = RA.regionMap(RA.eraMap(this.map, s.era, s.start), s.region);
    RA.ME_COLOR = s.color || RA.PLAYER_COLORS[0];
    const G = RA.newGame(gm, { seed: s.seed, difficulty: s.difficulty, cityStates: s.cityStates, peace: s.peace, era: s.era, start: s.start, gm: s.gm, res: !!s.res, camp: s.camp });
    G.gid = r.gid;
    G.rec = r; // the game goes on recording into the same record
    this.setGame(G);
    this.attractMode = false;
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    ui.watching = false;
    ui.fxList = [];
    ui.campOver = false;
    for (const c of r.picks) RA.placeHuman(G, c, r.name);
    if (!G.me || !G.me.spawned) {
      ui.toast('bad', 'Sačuvana igra se ne može obnoviti.', { ms: 6000 });
      this.dropSave(r.gid);
      return this.showStart();
    }
    RA.startGame(G);
    if (ui.settings.cb) RA.applyColorblind(G, true);
    if (r.build !== RA.BUILD) ui.toast('info', 'Igra je u međuvremenu ažurirana — nastavak može malo odstupati od onoga što si ostavio.', { ms: 7000 });
    // replay in slices so the page stays alive; the loading screen shows how far it is
    const ov = document.getElementById('loading'), msg = document.getElementById('loadMsg');
    ov.hidden = false;
    this.replaying = true;
    const cmds = r.cmds, target = sv.tick, me = G.me;
    let ci = 0;
    while (ci < cmds.length && cmds[ci][0] < G.tick) ci++;
    const slice = () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 60) {
        if (r.cont === G.tick && G.state === 'over') {
          G.continued = true;
          G.state = 'play';
        }
        while (ci < cmds.length && cmds[ci][0] === G.tick) {
          const c = cmds[ci++];
          G.exec(me.id, c[1], c[2]);
        }
        if (G.tick >= target || G.state !== 'play') return done();
        G.step();
      }
      msg.textContent = `Nastavljam sačuvanu igru… ${Math.round((G.tick / Math.max(1, target)) * 100)}%`;
      setTimeout(slice, 0);
    };
    const done = () => {
      this.replaying = false;
      G.events.length = 0;
      G.fx.length = 0;
      ui.feedReset();
      ui.feedSeen = G.feed.length;
      ui.chatSeen = G.chat.length;
      ui.pingSeen = G.pings.length;
      this.terr.reset(G);
      this.terr.updatePalette();
      ov.hidden = true;
      ui.spawnUI(false);
      ui.showPlayUI(true);
      this.updateSpeedBtn();
      this.paused = true; // wait for the player: nothing happens behind their back
      this.updatePauseBtn();
      if (gm.region) {
        const bx = gm.region.box;
        this.lmap.setMaxBounds(L.latLngBounds([[bx[1], bx[0]], [bx[3], bx[2]]]).pad(0.7));
      } else this.lmap.setMaxBounds(this.defBounds);
      if (me.alive && me.capital >= 0) this.lmap.setView(this.map.latLngOfCell(me.capital), this.zoomAt(4.9), { animate: false });
      ui.toast('good', `Igra nastavljena (${RA.fmtTime(G.tick / 10)}). Pauzirano — pritisni ▶ ili razmak kad budeš spreman.`, { ms: 7000 });
    };
    slice();
  },
});

Object.assign(RA.UI.prototype, {
  /* the start screen's "Nastavi igru" button (a save in this browser or on the account) */
  async resumeOffer() {
    const b = this.$('resumeBtn');
    const sv = await this.app.findSave();
    this.resumeSv = sv;
    b.hidden = !sv;
    if (!sv) return;
    const m = sv.meta || {};
    b.innerHTML = `<span class="t">Nastavi igru</span><span class="d">${RA.esc(m.who || '')} · ${RA.esc(m.where || '')} · ${RA.esc(m.era || '')} · ${RA.fmtTime(m.secs || 0)} · ${String(m.land || 0).replace('.', ',')}%</span>`;
  },
});

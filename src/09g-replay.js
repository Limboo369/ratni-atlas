'use strict';
/* Replay (plan phase 17): the server keeps the record of every finished online game (Skirmish, Conquest League, Focus;
   deploy/game/long.js, /ws?replay=<code>, 30 days). The page rebuilds the game from the record and plays it at
   1–16× with pause and a time line (seeking back replays from the start). Opened from the profile's history, the
   league's match history or the link /replay-<code>.
   Stable hooks for the look (Codex C7): #replayBar, #rpPlay, #rpSpeed button[data-v], #rpSeek, #rpTime, #rpExit. */
RA.RP_SPEEDS = [1, 4, 8, 16];

Object.assign(RA.App.prototype, {
  replayOpen(code) {
    const url = this.net && this.net.wsUrl;
    if (!url) return this.ui.toast('info', RA.t("Replays work on war.deovilab.com."), { ms: 4000 });
    if (!/^[a-z0-9]{6}$/.test(code || '')) return;
    const ws = new WebSocket(url + '?replay=' + code);
    const ov = document.getElementById('loading');
    ov.hidden = false;
    document.getElementById('loadMsg').textContent = RA.t("Loading replay…");
    let got = false;
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      got = true;
      if (m.t === 'replay' && m.rec && m.rec.set) return this.replayStart(m.rec);
      ov.hidden = true;
      this.ui.toast('bad', RA.esc(RA.t(String(m.e || "Replay not available."))), { ms: 6000 });
    };
    ws.onclose = () => {
      if (got) return;
      ov.hidden = true;
      this.ui.toast('bad', RA.t("The replay server is not available."), { ms: 5000 });
    };
  },
  /* build the game at tick 0 (the same as every player's device had it) */
  replayBuild(rec) {
    const G = RA.longGame(this.map, rec);
    G.long = false; // not following a server clock: the replay bar drives the time
    G.rp = { rec, q: rec.cmds.slice(), end: rec.over && rec.over.tick ? rec.over.tick : rec.cmds.length ? rec.cmds[rec.cmds.length - 1][0] + 50 : 0 };
    G.gid = ''; // a replay reports no result
    return G;
  },
  replayStart(rec) {
    const s = rec.set, ui = this.ui;
    if (!this.mapReady(s.map, s.era)) return this.withMap(s.map, s.era, () => this.replayStart(rec));
    if (this.long && this.long.rec) this.long.close();
    this.setMap(this.maps[s.map]);
    document.getElementById('startScreen').hidden = true;
    document.getElementById('lobbyScreen').hidden = true;
    document.getElementById('endScreen').hidden = true;
    const G = this.replayBuild(rec);
    this.setGame(G);
    this.attractMode = false;
    this.paused = false;
    this.speed = 4;
    ui.watching = true;
    ui.fxList = [];
    ui.closeSheet();
    ui.spawnUI(false);
    ui.showPlayUI(true);
    this.terr.reset(G);
    this.terr.updatePalette();
    document.getElementById('loading').hidden = true;
    const gm = G.map;
    if (gm.region) {
      const bx = gm.region.box;
      this.lmap.setMaxBounds(L.latLngBounds([[bx[1], bx[0]], [bx[3], bx[2]]]).pad(0.7));
      this.lmap.fitBounds(L.latLngBounds([[bx[1], bx[0]], [bx[3], bx[2]]]));
    } else this.lmap.setMaxBounds(this.defBounds);
    if (/^https?:$/.test(location.protocol)) history.replaceState(null, '', '/replay-' + rec.code);
    const who = (rec.slots || []).map((x) => x.name).filter(Boolean);
    ui.toast('info', RA.t("Replay {0}{1}", s.lg ? RA.t("league {0}v{1}", s.lg, s.lg) : s.fast ? RA.t("Skirmish games") : RA.t("Focus games"), who.length ? ': ' + who.map(RA.esc).join(', ') : ''), { ms: 6000 });
    ui.replayBar();
  },
  /* one tick of the replay: the record's commands of this tick, then the step */
  replayStep(G) {
    const q = G.rp.q;
    while (q.length && q[0][0] <= G.clock()) RA.longApply(G, q.shift());
    if (G.state === 'play') G.step(); // a command may have ended the game (a surrender) before this tick's step
  },
  /* jump to a tick: forward from here, or back = the game again from tick 0 (time-sliced, with the loading bar) */
  replaySeek(t) {
    let G = this.G;
    if (!G || !G.rp) return;
    t = Math.max(0, Math.min(G.rp.end, t | 0));
    if (t < G.clock()) {
      G = this.replayBuild(G.rp.rec);
      this.setGame(G);
      this.terr.reset(G);
    }
    const ov = document.getElementById('loading'), msg = document.getElementById('loadMsg');
    this.replaying = true;
    ov.hidden = false;
    const slice = () => {
      if (this.G !== G) return;
      const t0 = performance.now();
      while (G.clock() < t && G.state === 'play' && performance.now() - t0 < 60) this.replayStep(G);
      if (G.clock() >= t) while (G.rp.q.length && G.rp.q[0][0] <= G.clock()) RA.longApply(G, G.rp.q.shift()); // this tick's commands too
      if (G.clock() < t && G.state === 'play') {
        msg.textContent = RA.t("Seeking… {0}%", Math.round((G.clock() / Math.max(1, t)) * 100));
        return setTimeout(slice, 0);
      }
      this.replaying = false;
      G.events.length = 0;
      G.fx.length = 0;
      this.ui.feedReset();
      this.ui.feedSeen = G.feed.length;
      this.terr.reset(G);
      this.terr.updatePalette();
      ov.hidden = true;
    };
    slice();
  },
  replayExit() {
    const b = document.getElementById('replayBar');
    if (b) b.remove();
    clearInterval(this.ui._rpIv);
    if (/^\/replay-/.test(location.pathname)) history.replaceState(null, '', '/');
    this.showStart();
  },
});

Object.assign(RA.UI.prototype, {
  /* the replay controls: play/pause, 1/4/8/16×, the time line, exit */
  replayBar() {
    const app = this.app;
    let b = document.getElementById('replayBar');
    if (b) b.remove();
    b = document.createElement('div');
    b.id = 'replayBar';
    b.className = 'replay-bar';
    b.innerHTML = RA.t("<button class=\"btn\" id=\"rpPlay\" aria-label=\"Pause\">{0}</button>\n      <div class=\"seg\" id=\"rpSpeed\">{1}</div>\n      <input type=\"range\" id=\"rpSeek\" min=\"0\" max=\"{2}\" value=\"0\" step=\"1\" aria-label=\"Replay time\">\n      <span id=\"rpTime\">0:00</span>\n      <button class=\"btn\" id=\"rpExit\">Exit</button>", RA.icon('pause'), RA.RP_SPEEDS.map((v) => `<button data-v="${v}" aria-pressed="${v === app.speed}">${v}×</button>`).join(''), app.G.rp.end);
    document.body.appendChild(b);
    const play = b.querySelector('#rpPlay'), seek = b.querySelector('#rpSeek'), time = b.querySelector('#rpTime');
    const syncPlay = () => {
      play.innerHTML = RA.icon(app.paused ? 'play' : 'pause');
      play.setAttribute('aria-label', app.paused ? RA.t("Resume") : RA.t("Pause"));
    };
    play.onclick = () => {
      app.paused = !app.paused;
      syncPlay();
    };
    b.querySelectorAll('#rpSpeed button').forEach((x) => (x.onclick = () => {
      app.speed = +x.dataset.v;
      b.querySelectorAll('#rpSpeed button').forEach((y) => y.setAttribute('aria-pressed', String(y === x)));
    }));
    let dragging = false;
    seek.oninput = () => (dragging = true);
    seek.onchange = () => {
      dragging = false;
      app.replaySeek(+seek.value);
    };
    b.querySelector('#rpExit').onclick = () => app.replayExit();
    clearInterval(this._rpIv);
    this._rpIv = setInterval(() => {
      const G = app.G;
      if (!G || !G.rp || !document.getElementById('replayBar')) {
        clearInterval(this._rpIv);
        if (!(G && G.rp)) b.remove();
        return;
      }
      if (!dragging) seek.value = G.clock();
      const r = G.rp.rec, secs = (G.clock() * r.tickMs) / 1000, all = (G.rp.end * r.tickMs) / 1000;
      time.textContent = `${RA.fmtTime(secs)} / ${RA.fmtTime(all)}`;
      if (G.state !== 'play' || G.clock() >= G.rp.end) (app.paused = true), syncPlay();
    }, 250);
  },
});

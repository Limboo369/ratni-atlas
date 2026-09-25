'use strict';
/* Long games (plan 60, server side: deploy/game/long.js). The game is a record — settings, seed and every command
   with its tick — kept by the server, whose clock turns one tick every few seconds (a game lasts days). Opening the
   game's link (/long-<code>) replays the record up to the server's tick (deterministic simulation), then follows the
   clock; your commands go to the server, which stamps them with the current tick for everyone.
   You play by taking over a computer state ('join'); while you're away the computer plays it ('ai'). */
RA.Long = class {
  constructor(app) {
    this.app = app;
    this.ws = null;
    this.rec = null;
    this.T = 0;
    this.you = -1;
    this.queue = []; // entries not applied yet: [tick, slot, kind, args]
    this.known = 0; // entries of the record received so far
    this.code = '';
  }
  get url() {
    return this.app.net && this.app.net.wsUrl;
  }
  uid() {
    let u = '';
    try {
      u = localStorage.getItem('ra_uid') || '';
    } catch (_) {}
    if (!/^[A-Za-z0-9]{12,40}$/.test(u)) {
      const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      u = '';
      for (let i = 0; i < 24; i++) u += a[(Math.random() * a.length) | 0];
      try {
        localStorage.setItem('ra_uid', u);
      } catch (_) {}
    }
    return u;
  }
  name() {
    const inp = document.getElementById('nameIn');
    return ((inp && inp.value) || this.app.ui.settings.name || '').trim().slice(0, 18) || 'Igrač';
  }
  /* a new long game with the start screen's settings */
  create() {
    const s = this.app.ui.settings;
    const set = { map: s.map, reg: s.region, era: s.era, gm: s.gm === 'br' ? 'klasik' : s.gm, dif: s.difficulty, cs: s.cityStates, peace: s.peace, res: s.res ? 1 : 0 };
    this.connect('new', { create: { set, name: this.name(), uid: this.uid() } });
  }
  open(code) {
    this.connect(code, { hello: { name: this.name(), uid: this.uid() } });
  }
  connect(code, first) {
    if (!this.url) return this.app.ui.toast('bad', 'Duga igra radi samo na war.deovilab.com.', { ms: 5000 });
    this.close();
    this.code = code === 'new' ? '' : code;
    this.first = first;
    this.tries = 0;
    this.dial(code);
  }
  dial(code) {
    const ws = new WebSocket(this.url + '?long=' + code);
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      ws.send(JSON.stringify(this.code ? { hello: this.first.hello || { name: this.name(), uid: this.uid() } } : this.first));
    };
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      this.onMsg(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.closed) return;
      // the connection dropped: try again (the game goes on on the server)
      if (++this.tries > 20) return this.app.ui.toast('bad', 'Veza sa serverom duge igre je prekinuta.', { ms: 6000 });
      setTimeout(() => this.ws === ws && !this.closed && this.dial(this.code), Math.min(15000, 1000 * this.tries));
    };
  }
  close() {
    this.closed = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
    }
    this.ws = null;
    this.closed = false;
    this.rec = null;
    this.queue = [];
    this.known = 0;
  }
  send(kind, args) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ c: [kind, args] }));
  }
  join(id) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ join: [id, this.name()] }));
  }
  onMsg(m) {
    const ui = this.app.ui;
    if (m.t === 'err') {
      ui.toast('bad', RA.esc(String(m.e || 'Greška duge igre.')), { ms: 6000 });
      if (!this.rec) this.app.showStart();
      return;
    }
    if (m.t === 'T') this.T = Math.max(this.T, m.T | 0);
    else if (m.t === 'you') this.you = m.you;
    else if (m.t === 'c') this.addEntry(m.e);
    else if (m.t === 'rec') {
      this.T = m.T | 0;
      this.you = m.you;
      if (this.rec && this.rec.code === m.rec.code) {
        // a reconnect: only what we missed
        for (const e of m.rec.cmds.slice(this.known)) this.addEntry(e);
        this.rec.slots = m.rec.slots;
        return;
      }
      this.rec = m.rec;
      this.code = m.rec.code;
      this.queue = m.rec.cmds.slice();
      this.known = m.rec.cmds.length;
      if (/^https?:$/.test(location.protocol)) history.replaceState(null, '', '/long-' + this.code);
      this.app.startLong(this);
    }
  }
  addEntry(e) {
    if (!Array.isArray(e) || !Number.isInteger(e[0])) return;
    this.known++;
    this.queue.push(e);
  }
  /* apply the entries of this tick (before stepping) */
  applyDue(G) {
    const q = this.queue;
    while (q.length && q[0][0] <= G.tick) {
      const e = q.shift();
      if (e[0] < G.tick) {
        // a command for a tick we already played: this device fell out of step — replay from the start
        this.app.ui.toast('info', 'Usklađujem igru sa serverom…', { ms: 3000 });
        setTimeout(() => this.open(this.code), 300);
        return false;
      }
      this.apply(G, e);
    }
    return true;
  }
  apply(G, e) {
    const [, slot, kind, args] = e, ui = this.app.ui;
    if (kind === 'join') {
      const p = RA.longJoin(G, slot, args[0], args[1]);
      if (p && slot === this.you && !this.replaying) this.app.longJoined(p);
      return;
    }
    const pid = G.slotPid[slot];
    if (!pid) return;
    const r = G.exec(pid, kind, Array.isArray(args) ? args : []);
    if (!this.replaying && G.me && pid === G.me.id && kind !== 'ai' && kind !== 'back') ui.afterAct(kind, args, r);
  }
  /* live: follow the server's clock, one tick behind (a command is stamped with the server's current tick) */
  frame() {
    const G = this.app.G;
    if (!G || !G.long || this.replaying) return;
    const t0 = performance.now();
    while (G.state === 'play' && G.tick < this.T - 1 && performance.now() - t0 < 30) {
      if (!this.applyDue(G)) return;
      G.step();
    }
  }
};

/* a player takes over a computer state (deterministic: every device does the same at the same tick) */
RA.longJoin = function (G, slot, id, name) {
  const p = Number.isInteger(id) ? G.P[id] : null;
  const had = G.P[G.slotPid[slot]];
  if (!p || !p.alive || p.human || p.type !== 'nation' || (had && had.alive)) return null;
  p.human = true;
  p.ai = null;
  p.slot = slot;
  p.nick = RA.Net.str(name, 'Igrač');
  G.slotPid[slot] = p.id;
  if (!G.humans.includes(p)) G.humans.push(p);
  return p;
};

Object.assign(RA.App.prototype, {
  /* build the long game from its record and replay it up to the server's clock */
  startLong(LG) {
    const r = LG.rec, s = r.set, ui = this.ui;
    if (!this.mapReady(s.map, s.era)) return this.withMap(s.map, s.era, () => this.startLong(LG));
    this.setMap(this.maps[s.map]);
    document.getElementById('startScreen').hidden = true;
    document.getElementById('lobbyScreen').hidden = true;
    const gm = RA.regionMap(RA.eraMap(this.map, s.era, 'granice'), s.reg);
    const G = RA.newGame(gm, { seed: r.seed, difficulty: s.dif, cityStates: s.cs, peace: s.peace, era: s.era, start: 'granice', gm: s.gm, res: s.res === 1 });
    RA.startGame(G);
    G.online = true;
    G.long = true;
    G.slotPid = [];
    G.gid = 'l' + r.code;
    this.setGame(G);
    this.attractMode = false;
    this.speed = 1;
    this.paused = false;
    ui.watching = true;
    ui.fxList = [];
    ui.closeSheet();
    ui.spawnUI(false);
    const ov = document.getElementById('loading'), msg = document.getElementById('loadMsg');
    ov.hidden = false;
    LG.replaying = true;
    const slice = () => {
      if (this.G !== G) return;
      const t0 = performance.now();
      while (performance.now() - t0 < 60) {
        if (G.tick >= LG.T - 1 || G.state !== 'play') return done();
        if (!LG.applyDue(G)) return;
        G.step();
      }
      msg.textContent = `Duga igra: sustižem server… ${Math.round((G.tick / Math.max(1, LG.T - 1)) * 100)}%`;
      setTimeout(slice, 0);
    };
    const done = () => {
      LG.replaying = false;
      LG.applyDue(G);
      G.events.length = 0;
      G.fx.length = 0;
      ui.feedReset();
      ui.feedSeen = G.feed.length;
      ui.chatSeen = G.chat.length;
      ui.pingSeen = G.pings.length;
      this.terr.reset(G);
      this.terr.updatePalette();
      ov.hidden = true;
      if (gm.region) {
        const bx = gm.region.box;
        this.lmap.setMaxBounds(L.latLngBounds([[bx[1], bx[0]], [bx[3], bx[2]]]).pad(0.7));
      } else this.lmap.setMaxBounds(this.defBounds);
      const mine = G.P[G.slotPid[LG.you]];
      if (mine && mine.alive) this.longJoined(mine);
      else ui.longPick();
      ui.toast('info', `Duga igra: 1 potez svakih ${Math.round(r.tickMs / 1000)} s — igra teče i kad nisi tu. Link: <b>${RA.esc(location.origin + '/long-' + r.code)}</b>`, { ms: 9000 });
    };
    slice();
  },
  longJoined(p) {
    const G = this.G, ui = this.ui;
    G.me = p;
    ui.watching = false;
    ui.closeSheet();
    ui.showPlayUI(true);
    this.updateSpeedBtn();
    this.updatePauseBtn();
    this.terr.updatePalette();
    if (p.capital >= 0) this.lmap.setView(this.map.latLngOfCell(p.capital), this.zoomAt(4.9), { animate: false });
  },
});

Object.assign(RA.UI.prototype, {
  /* not playing yet (or my state fell): choose a computer state to take over */
  longPick() {
    const G = this.G, L = this.app.long;
    if (!G || !G.long) return;
    const nats = G.P.filter((p) => p && p.alive && p.type === 'nation' && !p.human).sort((a, b) => b.area - a.area);
    const humans = G.P.filter((p) => p && p.alive && p.human);
    let h = this.head('Duga igra', `Potez svakih ${Math.round(L.rec.tickMs / 1000)} s · igrača ${humans.length} · tik ${G.tick}`);
    h += `<p class="explain">Izaberi državu kojom upravlja kompjuter i preuzmi je. Kad zatvoriš igru, kompjuter igra za tebe dok se ne vratiš (preko istog linka).</p>`;
    h += `<div class="btns"><button class="btn" data-copy><span class="t">Kopiraj link igre</span><br><span class="d">${RA.esc(location.origin + '/long-' + L.code)}</span></button></div><div class="list">`;
    for (const p of nats.slice(0, 40)) h += `<div class="prow wide"><span class="sw" style="background:${p.hex}"></span><div class="pn"><div class="nm">${RA.esc(p.name)}</div><div class="d">${((p.area / G.landTotal()) * 100).toFixed(1).replace('.', ',')}% kopna · vojska ${RA.fmt(p.troops)}</div></div><div class="bb">${this.mini('Preuzmi', `data-take="${p.id}"`, 'ok')}</div></div>`;
    h += '</div>';
    if (humans.length) h += `<p class="note">Igrači: ${humans.map((p) => RA.esc(p.nick || p.name) + ' (' + RA.esc(p.name) + ')').join(', ')}</p>`;
    this.openSheet(h, (s) => {
      s.querySelectorAll('[data-take]').forEach((b) => (b.onclick = () => {
        L.join(+b.dataset.take);
        this.toast('info', 'Preuzimaš državu — potvrda stiže sa sljedećim potezom servera.', { ms: 4000 });
        b.disabled = true;
      }));
      const c = s.querySelector('[data-copy]');
      if (c) c.onclick = () => {
        try {
          navigator.clipboard.writeText(location.origin + '/long-' + L.code);
          this.toast('good', 'Link je kopiran.');
        } catch (_) {}
      };
    });
  },
});

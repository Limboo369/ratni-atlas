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
    addEventListener('pagehide', () => this.rec && this.snap());
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
    return ((inp && inp.value) || this.app.ui.settings.name || '').trim().slice(0, 18) || RA.t("Player");
  }
  /* a new long game with the start screen's settings */
  create(extra) {
    const s = this.app.ui.playSet(); // Focus preset or Make your choice
    const set = Object.assign({ map: s.map, reg: s.region, era: s.era, gm: s.gm === 'br' ? 'klasik' : s.gm, dif: s.difficulty, cs: s.cityStates, peace: s.peace, res: s.res ? 1 : 0, tree: s.tree ? 1 : 0, nn: s.noNuke ? 1 : 0, days: [1, 3, 7].includes(s.days) ? s.days : 1 }, extra || {});
    this.connect('new', { create: { set, name: this.name(), uid: this.uid() } });
  }
  open(code) {
    this.connect(code, { hello: { name: this.name(), uid: this.uid() } });
  }
  connect(code, first) {
    if (!this.url) return this.app.ui.toast('bad', RA.t("Focus games only work on war.deovilab.com."), { ms: 5000 });
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
      if (++this.tries > 20) return this.app.ui.toast('bad', RA.t("The connection to the Focus game server was lost."), { ms: 6000 });
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
  /* leave for good: my seat goes to the computer and can't be taken back (the progress is gone) */
  leave() {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ leave: 1 }));
    RA.focusDrop(this.code);
    this.left = this.code; // no snapshot may put it back
  }
  join(id, team) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ join: [id, this.name(), team | 0] }));
  }
  onMsg(m) {
    const ui = this.app.ui;
    if (m.t === 'err') {
      ui.toast('bad', RA.esc(RA.t(String(m.e || "Focus game error."))), { ms: 6000 });
      if (m.gone && this.code) RA.focusDrop(this.code);
      if (!this.rec) this.app.showStart();
      return;
    }
    if (m.t === 'lg') return ui.leagueResult(m); // Conquest League: my new rating
    if (m.t === 'sim') this.simSt = m.st; // the server's own simulation (tick, checksum), asked with {sim: 1}
    else if (m.t === 'T') this.T = Math.max(this.T, m.T | 0);
    else if (m.t === 'you') this.you = m.you;
    else if (m.t === 'c') this.addEntry(m.e);
    else if (m.t === 'rec') {
      this.T = m.T | 0;
      this.you = m.you;
      this.startAt = Date.now() + (m.wait || 0); // a public game waits for its countdown
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
      if (!m.rec.set.fast && !RA.focusGet(this.code) && this.you >= 0) RA.focusPut(this.code, {});
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
    while (q.length && q[0][0] <= G.clock()) {
      const e = q.shift();
      if (e[0] < G.clock()) {
        // a command for a tick we already played: this device fell out of step — replay from the start
        this.app.ui.toast('info', RA.t("Syncing the game with the server…"), { ms: 3000 });
        setTimeout(() => this.open(this.code), 300);
        return false;
      }
      this.apply(G, e);
    }
    return true;
  }
  apply(G, e) {
    const [, slot, kind, args] = e, ui = this.app.ui;
    const o = RA.longApply(G, e);
    if (o.joined && slot === this.you && !this.replaying) this.app.longJoined(o.joined);
    if (!this.replaying && o.pid && G.me && o.pid === G.me.id && kind !== 'ai' && kind !== 'back') ui.afterAct(kind, args, o.r);
  }
  /* live: follow the server's clock, one tick behind (a command is stamped with the server's current tick) */
  frame() {
    const G = this.app.G;
    if (!G || !G.long || this.replaying) return;
    const t0 = performance.now();
    while (G.state === 'play' && G.clock() < this.T - 1 && performance.now() - t0 < 30) {
      if (!this.applyDue(G)) return;
      G.step();
    }
    if (G.state === 'over' && !G.continued) RA.focusDrop(this.code); // the game is finished: nothing to continue
    else if (!this.rec.set.fast && t0 - (this.snapAt || 0) > 10000) {
      this.snapAt = t0;
      this.snap();
    }
  }
  /* what my state looks like now, for "Dok te nije bilo" next time */
  snap() {
    const G = this.app.G, me = G && G.me;
    if (!G || !G.long || !me || !me.alive || this.replaying || this.left === this.code) return;
    RA.focusPut(this.code, { tick: G.tick, snap: RA.focusSnap(G, me) });
  }
};

/* my Focus games in this browser (localStorage ra_focus): code, title, last snapshot of my state.
   A game stays here until it is finished or I leave it ("Napusti"); closing the tab or the main menu keeps it. */
RA.focusList = function () {
  try {
    const l = JSON.parse(localStorage.getItem('ra_focus') || '[]');
    return Array.isArray(l) ? l.filter((e) => e && /^[a-z0-9]{6}$/.test(e.code)) : [];
  } catch (_) {
    return [];
  }
};
RA.focusSet = function (l) {
  try {
    localStorage.setItem('ra_focus', JSON.stringify(l.slice(0, 12)));
  } catch (_) {}
};
RA.focusGet = (code) => RA.focusList().find((e) => e.code === code);
RA.focusPut = function (code, patch) {
  const l = RA.focusList(), i = l.findIndex((e) => e.code === code);
  const e = Object.assign(i >= 0 ? l[i] : { code }, patch, { at: Date.now() });
  if (i >= 0) l.splice(i, 1);
  l.unshift(e);
  RA.focusSet(l);
  if (RA.focusHook) RA.focusHook(code, e);
};
RA.focusDrop = function (code) {
  RA.focusSet(RA.focusList().filter((e) => e.code !== code));
  if (RA.focusHook) RA.focusHook(code, null);
};
RA.focusSnap = function (G, p) {
  let cities = 0;
  for (const ct of G.cities) if (ct.owner === p.id && ct.tier >= 1) cities++;
  return { share: p.area / G.landTotal(), cities: cities + (p.bcities ? p.bcities.length : 0), troops: Math.round(p.troops), gold: Math.round(p.gold), allies: p.allies.size };
};

Object.assign(RA.App.prototype, {
  /* build the long game from its record and replay it up to the server's clock */
  startLong(LG) {
    const r = LG.rec, s = r.set, ui = this.ui;
    if (!this.mapReady(s.map, s.era)) return this.withMap(s.map, s.era, () => this.startLong(LG));
    this.setMap(this.maps[s.map]);
    document.getElementById('startScreen').hidden = true;
    document.getElementById('lobbyScreen').hidden = true;
    const G = RA.longGame(this.map, r);
    const gm = G.map;
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
        if (G.clock() >= LG.T - 1 || G.state !== 'play') return done();
        if (!LG.applyDue(G)) return;
        G.step();
      }
      msg.textContent = RA.t("Focus: catching up with the server… {0}%", Math.round((G.clock() / Math.max(1, LG.T - 1)) * 100));
      setTimeout(slice, 0);
    };
    const done = () => {
      LG.replaying = false;
      LG.applyDue(G);
      this.long.missed = G.events.slice(-600); // what happened while the page caught up: for "While you were away"
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
      const was = RA.focusGet(r.code);
      if (mine && mine.alive) {
        this.longJoined(mine);
        if (was && was.snap && G.tick - was.tick > 20) ui.focusReport(was, r);
      } else if (r.set.lg) ui.toast('info', RA.t("You are watching a league match."), { ms: 4000 });
      else ui.longPick();
      if (r.set.lg && LG.startAt > Date.now()) ui.toast('info', RA.t("Conquest League {0}v{1}: starts in {2} s — destroy the enemy team.", r.set.lg, r.set.lg, Math.ceil((LG.startAt - Date.now()) / 1000)), { ms: 6000 });
      if (G.state === 'over' && !G.continued) RA.focusDrop(r.code);
      if (!r.set.fast) ui.toast('info', RA.t("Focus: gold and orders every second, armies move every {0} s — the game goes on while you're away. Link: <b>{1}</b>", Math.round((r.tickMs * (r.sub || 1)) / 1000), RA.esc(location.origin + '/long-' + r.code)), { ms: 9000 });
    };
    slice();
  },
  longJoined(p) {
    const G = this.G, ui = this.ui, s = this.long.rec.set;
    G.me = p;
    this.long.left = '';
    if (s.fast) return this.longShow(p); // Skirmish: no Focus list
    const reg = RA.REGIONS.find((x) => x.id === s.reg && x.map === s.map);
    RA.focusPut(this.long.code, { title: `${p.name} · ${reg ? reg.name : RA.mapInfo(s.map).all} · ${RA.eraById(s.era).short}`, days: s.days || 1, tick: G.tick, snap: RA.focusSnap(G, p) });
    this.longShow(p);
  },
  longShow(p) {
    const G = this.G, ui = this.ui;
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
  /* "Dok te nije bilo": what happened to my state since I last looked (the record replays the same game) */
  focusReport(was, r) {
    const G = this.G, me = G.me, a = was.snap, b = RA.focusSnap(G, me);
    const secs = ((G.tick - was.tick) * r.tickMs * (r.sub || 1)) / 1000;
    const pc = (v) => (v * 100).toFixed(1).replace('.', RA.DEC) + '%';
    // four tiles: where I stand now and how it changed
    const tile = (label, x, y, f) => `<div><span>${label}</span><strong>${f(y)}</strong><small class="${y > x ? 'pos' : y < x ? 'neg' : ''}">${y > x ? '▲ ' : y < x ? '▼ ' : ''}${f(x)} →</small></div>`;
    let h = this.head(RA.t("While you were away"), RA.t("{0} of real time · {1} moves · the computer led {2}", RA.fmtTime(secs), G.tick - was.tick, RA.esc(me.name)));
    h += `<div class="economy-overview report-tiles">${tile(RA.t("Territory"), a.share, b.share, pc)}${tile(RA.t("Cities"), a.cities, b.cities, String)}${tile(RA.t("Army"), a.troops, b.troops, RA.fmt)}${tile(RA.t("Gold"), a.gold, b.gold, RA.fmt)}</div>`;
    // my news, in two groups; the first few shown, the rest folded away
    const mine = ((this.app.long && this.app.long.missed) || []).filter((e) => e.to === me.id && e.tick > was.tick && e.text);
    const group = (title, list, cls) => {
      if (!list.length) return '';
      const row = (e) => `<li class="${cls}">${RA.esc(e.text)}</li>`;
      const top = list.slice(-5).reverse(), rest = list.slice(0, -5).reverse();
      return `<div class="sec-t">${title} · ${list.length}</div><ul class="report-list">${top.map(row).join('')}</ul>` + (rest.length ? `<details class="report-more"><summary>${RA.t("{0} more", rest.length)}</summary><ul class="report-list">${rest.map(row).join('')}</ul></details>` : '');
    };
    h += group(RA.t("Setbacks"), mine.filter((e) => e.kind === 'bad'), 'neg') + group(RA.t("Successes"), mine.filter((e) => e.kind === 'good'), 'pos');
    // the world: wars on me, states that fell, alliances
    const F = G.feed.filter((f) => f.tick > was.tick);
    const nm = (id) => this.feedName(id);
    const wars = F.filter((f) => f.t === 'war' && (f.a === me.id || f.b === me.id));
    const fell = F.filter((f) => f.t === 'fall');
    const allies = F.filter((f) => (f.t === 'ally' || f.t === 'break') && (f.a === me.id || f.b === me.id));
    const world = [];
    if (wars.length) world.push(RA.t("Wars with you: {0}", wars.map((f) => nm(f.a === me.id ? f.b : f.a)).join(', ')));
    if (allies.length) world.push(RA.t("Alliances: {0}", allies.map((f) => (f.t === 'ally' ? '🤝 ' : '✂ ') + nm(f.a === me.id ? f.b : f.a)).join(', ')));
    if (fell.length) world.push(RA.t("States that fell: {0}", fell.slice(-8).map((f) => nm(f.b || f.a)).join(', ')));
    const otherWars = F.filter((f) => f.t === 'war' && f.a !== me.id && f.b !== me.id).length;
    if (otherWars) world.push(RA.t("{0} other wars started", otherWars));
    h += `<div class="sec-t">${RA.t("The world")}</div>` + (world.length ? `<ul class="report-list">${world.map((t) => `<li>${t}</li>`).join('')}</ul>` : RA.t("<p class=\"note\">No wars or alliances with your state in the meantime.</p>"));
    // the ranking now: the top five and me
    const L = G.P.filter((p) => p && p.alive && p.type !== 'bot').sort((x, y) => y.area - x.area);
    const myRank = L.indexOf(me) + 1, land = G.landTotal();
    const rows = L.slice(0, 5).map((p, i) => `<li class="${p === me ? 'me' : ''}"><b>${i + 1}.</b> ${nm(p.id)} <span>${pc(p.area / land)}</span></li>`);
    if (myRank > 5) rows.push(`<li class="me"><b>${myRank}.</b> ${nm(me.id)} <span>${pc(me.area / land)}</span></li>`);
    h += `<div class="sec-t">${RA.t("Ranking now")}</div><ol class="report-rank">${rows.join('')}</ol>`;
    h += RA.t("<div class=\"btns\"><button class=\"btn primary\" data-ok><span class=\"t\">Continue</span></button></div>");
    this.openSheet(h, (s) => (s.querySelector('[data-ok]').onclick = () => this.closeSheet()));
  },
  /* signed in: my Focus games also live on the account (plan 3) — every change goes there (a snapshot at most once a
     minute), and the start screen merges the account's list with this browser's */
  focusAccount() {
    const A = this.account, sent = (this._focusSent = this._focusSent || {});
    RA.focusHook = (code, e) => {
      if (!A || !A.user) return;
      if (e && Date.now() - (sent[code] || 0) < 60000 && !e.title) return;
      sent[code] = Date.now();
      A.api('POST', '/api/focus', e ? Object.assign({}, e) : { code, drop: 1 }).catch(() => {});
    };
    if (!A || !A.user || Date.now() - (this._focusGot || 0) < 30000) return;
    this._focusGot = Date.now();
    A.api('GET', '/api/focus').then((j) => {
      const l = RA.focusList();
      let changed = false;
      for (const g of j.games || []) {
        const i = l.findIndex((e) => e.code === g.code);
        if (i < 0) l.push(g), (changed = true);
        else if ((g.at || 0) > (l[i].at || 0)) (l[i] = Object.assign(l[i], g)), (changed = true);
      }
      if (changed) {
        RA.focusSet(l.sort((a, b) => (b.at || 0) - (a.at || 0)));
        this.focusOffer();
      }
    }, () => {});
  },
  /* the start screen's "Nastavi Focus igru" (my Focus games in this browser and, signed in, on the account) */
  focusOffer() {
    this.focusAccount();
    const b = this.$('focusBtn'), l = RA.focusList(), net = this.app.net;
    b.hidden = !l.length || !(net && net.wsUrl);
    if (b.hidden) return;
    const e = l[0];
    b.innerHTML = RA.t("<span class=\"t\">Continue Focus game{0}</span><span class=\"d\">{1} · ~{2} {3}</span>", l.length > 1 ? ` (${l.length})` : '', RA.esc(e.title || 'Focus · ' + e.code), e.days || 1, (e.days || 1) === 1 ? RA.t('day') : RA.t('days'));
    b.onclick = () => {
      this.settings.name = this.$('nameIn').value.trim().slice(0, 18);
      this._save();
      if (l.length === 1) return this.app.long.open(e.code);
      let h = this.head(RA.t("Your Focus games"), RA.t("Games go on while you're away — the computer leads your state")) + '<div class="list focus-games">';
      for (const x of l) h += RA.t("<div class=\"prow wide\"><div class=\"pn\"><div class=\"nm\">{0}</div><div class=\"d\">~{1} {2} · last seen {3}</div></div><div class=\"bb\">{4}</div></div>", RA.esc(x.title || x.code), x.days || 1, (x.days || 1) === 1 ? RA.t('day') : RA.t('days'), new Date(x.at || 0).toLocaleString(RA.LOCALE), this.mini(RA.t("Continue"), `data-fo="${x.code}"`, 'ok'));
      this.openSheet(h + '</div>', (s) => s.querySelectorAll('[data-fo]').forEach((q) => (q.onclick = () => {
        this.closeSheet();
        this.app.long.open(q.dataset.fo);
      })));
    };
  },
  /* not playing yet (or my state fell): choose a computer state to take over */
  longPick() {
    const G = this.G, L = this.app.long;
    if (!G || !G.long) return;
    const nats = G.P.filter((p) => p && p.alive && p.type === 'nation' && !p.human).sort((a, b) => b.area - a.area);
    const humans = G.P.filter((p) => p && p.alive && p.human);
    const set = L.rec.set, fast = set.fast === 1, T = set.teams || '0';
    const wait = Math.max(0, Math.ceil(((L.startAt || 0) - Date.now()) / 1000));
    let h = this.head(fast ? RA.t("Skirmish") : RA.t("Focus game"), fast ? RA.t("Public game · {0} players{1}", humans.length, wait ? RA.t(" · starts in <span id=\"longWait\">{0}</span> s", wait) : RA.t(" · running for {0}", RA.fmtTime(G.tick / 10))) : RA.t("Armies move every {0} s · {1} players · tick {2}", Math.round((L.rec.tickMs * (L.rec.sub || 1)) / 1000), humans.length, G.tick));
    h += fast ? RA.t("<p class=\"explain\">Pick a state and take it over. The computer leads the other states; whoever comes later takes one of them.</p>") : RA.t("<p class=\"explain\">Pick a state led by the computer and take it over. When you close the game, the computer plays for you until you return (through the same link).</p>");
    // teams: pick one (the smaller one first); humans vs states: everybody on the players' team
    let team = 1;
    if (T === '2' || T === '3') {
      const n = +T, cnt = (t) => humans.filter((p) => p.team === t).length;
      for (let t = 2; t <= n; t++) if (cnt(t) < cnt(team)) team = t;
      h += RA.t("<div class=\"field\"><span class=\"lab\">Your team</span><div class=\"seg\" id=\"teamSeg\">{0}</div></div>", Array.from({ length: n }, (_, i) => RA.t("<button data-v=\"{0}\" aria-pressed=\"{1}\">Team {2} · {3}</button>", i + 1, i + 1 === team, i + 1, cnt(i + 1))).join(''));
    } else if (T === 'hvs') h += RA.t("<p class=\"note\">Humans against states: all players are one team.</p>");
    h += RA.t("<div class=\"btns\"><button class=\"btn\" data-copy><span class=\"t\">Copy game link</span><br><span class=\"d\">{0}</span></button></div><div class=\"list\">", RA.esc(location.origin + '/long-' + L.code));
    for (const p of nats.slice(0, 40)) h += RA.t("<div class=\"prow wide\"><span class=\"sw\" style=\"background:{0}\"></span><div class=\"pn\"><div class=\"nm\">{1}</div><div class=\"d\">{2}% of the land · army {3}</div></div><div class=\"bb\">{4}</div></div>", p.hex, RA.esc(p.name), ((p.area / G.landTotal()) * 100).toFixed(1).replace('.', RA.DEC), RA.fmt(p.troops), this.mini(RA.t("Take over"), `data-take="${p.id}"`, 'ok'));
    h += '</div>';
    if (humans.length) h += RA.t("<p class=\"note\">Players: {0}</p>", humans.map((p) => RA.esc(p.nick || p.name) + ' (' + RA.esc(p.name) + ')').join(', '));
    this.openSheet(h, (s) => {
      s.querySelectorAll('#teamSeg button').forEach((b) => (b.onclick = () => {
        team = +b.dataset.v;
        s.querySelectorAll('#teamSeg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }));
      if (wait) {
        clearInterval(this._waitIv);
        this._waitIv = setInterval(() => {
          const el = document.getElementById('longWait');
          if (!el) return clearInterval(this._waitIv);
          el.textContent = Math.max(0, Math.ceil(((L.startAt || 0) - Date.now()) / 1000));
        }, 500);
      }
      s.querySelectorAll('[data-take]').forEach((b) => (b.onclick = () => {
        L.join(+b.dataset.take, team);
        this.toast('info', RA.t("Taking over the state — confirmation comes with the server's next move."), { ms: 4000 });
        b.disabled = true;
      }));
      const c = s.querySelector('[data-copy]');
      if (c) c.onclick = () => {
        try {
          navigator.clipboard.writeText(location.origin + '/long-' + L.code);
          this.toast('good', RA.t("Link copied."));
        } catch (_) {}
      };
    });
  },
});

'use strict';
/* Ratni Atlas — online lobby: the "play with a friend" box on the start screen and the room screen */

Object.assign(RA.UI.prototype, {
  initOnline() {
    const $ = this.$, s = this.settings;
    this.lobbySet = { map: s.map, reg: s.region, dif: s.difficulty, peace: s.peace, cs: s.cityStates, mode: s.mode === 'vs' ? 'vs' : 'coop', era: s.era, st: s.start, gm: s.gm, res: s.res ? 1 : 0, tree: s.tree ? 1 : 0, nn: s.noNuke ? 1 : 0 };
    this.natCache = {};
    $('lMapSeg').innerHTML = RA.MAPS.map((m) => `<button data-v="${m.id}" aria-pressed="false"${m.id === 'evropa' ? '' : ' hidden'}>${RA.esc(m.name)}<small>${RA.esc(m.sub)}</small></button>`).join('');
    this.lobbyRegs();
    $('lEraSeg').innerHTML = RA.ERAS.map((e) => `<button data-v="${e.id}" aria-pressed="false">${RA.esc(e.short)}<small>${RA.esc(e.sub)}</small></button>`).join('');
    const upd = (k, conv) => (v) => {
      this.lobbySet[k] = conv ? conv(v) : v;
      if (k === 'map') {
        // another map: its regions (all of it by default)
        s.map = v;
        this.fixRegion();
        this.lobbySet.reg = s.region;
        this.lobbyRegs();
      }
      if (k === 'reg') s.region = v;
      if (k === 'dif') s.difficulty = v;
      if (k === 'peace') s.peace = +v;
      if (k === 'mode') s.mode = v;
      if (k === 'era') s.era = v;
      if (k === 'st') s.start = v;
      if (k === 'gm') s.gm = v;
      this._save();
      this.app.net.setSettings(this.lobbySet);
      this.renderLobby();
    };
    this._seg('lMapSeg', this.lobbySet.map, upd('map'));
    this._seg('lEraSeg', this.lobbySet.era, upd('era'));
    this._seg('lStartSeg', this.lobbySet.st, upd('st'));
    this._seg('lGmSeg', this.lobbySet.gm, upd('gm'));
    $('lRegSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this._press('lRegSeg', b.dataset.v);
      upd('reg')(b.dataset.v);
    });
    this._seg('modeSeg', this.lobbySet.mode, upd('mode'));
    this._seg('lDiffSeg', this.lobbySet.dif, upd('dif'));
    this._seg('lPeaceSeg', String(this.lobbySet.peace), upd('peace', Number));
    $('lobbyNat').onchange = () => this.app.net.setPick($('lobbyNat').value);
    $('lobbyGo').onclick = () => {
      const L = this.lobbySet;
      const nats = this.regionNations(L);
      const r = !nats ? RA.t("The map is still loading…") : !this.lobbyReady(L) ? RA.t("Waiting for everyone to load the map.") : this.app.net.start(Object.assign({}, L), nats);
      if (typeof r === 'string') this.toast('info', RA.esc(r));
    };
    $('lobbyShare').onclick = async () => {
      const url = this.app.net.link();
      try {
        if (navigator.share) return await navigator.share({ title: 'Overtake', text: RA.t("Play Overtake with me:"), url });
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
      try {
        await navigator.clipboard.writeText(url);
        this.toast('good', RA.t("Link copied — send it to a friend."));
      } catch (e) {
        this.toast('info', RA.t("Copy the link above and send it to a friend."));
      }
    };
    $('lobbyLeave').onclick = () => {
      this.app.net.leave();
      $('lobbyScreen').hidden = true;
      $('startScreen').hidden = false;
      this.syncStart();
    };
    $('startScreen').addEventListener('click', (e) => {
      const w = e.target.closest('[data-watch]');
      if (w)
        this.app.net.watch(w.dataset.watch).then((ok) => {
          if (!ok) this.toast('info', RA.t("That game can't be watched any more."));
        });
      const b = e.target.closest('[data-on]');
      if (!b) return;
      const net = this.app.net;
      this.settings.name = $('nameIn').value.trim().slice(0, 18);
      this._save();
      if (b.dataset.on === 'code') {
        const m = /(?:game-)?([a-z0-9]{6})\s*$/i.exec($('codeIn').value.trim());
        if (!m) return this.toast('info', RA.t("Type the game code (6 characters) or paste the link a friend sent you."));
        net.enterRoom(m[1].toLowerCase(), true);
        return;
      }
      if (b.dataset.on === 'close') return net.closeRoom();
      if (b.dataset.on === 'host') {
        this.lobbySet.map = this.settings.map;
        this.lobbyRegs();
        this.lobbySet.reg = this.settings.region;
        this.lobbySet.dif = this.settings.difficulty;
        const R = this.playSet(); // the mode's rules (online is always Blitz pace)
        this.lobbySet.peace = R.peace;
        this.lobbySet.cs = this.settings.cityStates;
        this.lobbySet.era = this.settings.era;
        this.lobbySet.st = this.settings.start;
        this.lobbySet.gm = this.settings.gm;
        this.lobbySet.res = R.res ? 1 : 0;
        this.lobbySet.tree = R.tree ? 1 : 0;
        this.lobbySet.nn = R.noNuke ? 1 : 0;
        for (const [id, v] of [['lMapSeg', this.lobbySet.map], ['lEraSeg', this.lobbySet.era], ['lStartSeg', this.lobbySet.st], ['lGmSeg', this.lobbySet.gm], ['lRegSeg', this.lobbySet.reg]]) this._press(id, v);
        net.host(Object.assign({}, this.lobbySet));
      } else net.join(b.dataset.on);
      $('startScreen').hidden = true;
      $('lobbyScreen').hidden = false;
      this.renderLobby();
    });
    this.app.net.onChange(() => this.renderOnline());
    this.renderOnline();
  },
  /* the host's region buttons: the regions of the lobby's map */
  lobbyRegs() {
    const L = this.lobbySet;
    const regs = RA.regionsOf(L.map);
    if (!regs.some((r) => r.id === L.reg)) L.reg = regs[0].id;
    this.$('lRegSeg').innerHTML = regs.map((r) => `<button data-v="${r.id}" aria-pressed="${r.id === L.reg}">${RA.esc(r.name)}</button>`).join('');
  },
  /* nations a region starts with in an era (names sorted), cached; null while the map (or era) is still loading */
  regionNations(set) {
    const map = RA.mapInfo(set.map).id, era = RA.eraById(set.era).id, st = set.st || 'slobodno';
    const key = `${map}|${set.reg}|${era}|${st}`;
    if (!this.natCache[key]) {
      if (!this.app.mapReady(map, era)) return null;
      const nats = RA.regionNations(RA.eraMap(this.app.maps[map], era, st), set.reg);
      this.natCache[key] = nats.map((n) => ({ iso: n.iso, name: n.name, capital: n.capital })).sort((a, b) => a.name.localeCompare(b.name, RA.LOCALE));
    }
    return this.natCache[key];
  },
  /* everyone in the lobby has the map and era of the game (Europe is in the page: always) */
  lobbyReady(set) {
    const key = RA.mapKey(set);
    return RA.mapInfo(set.map).id === 'evropa' || this.app.net.members().every((m) => m.ld === key);
  },
  showLobby(set) {
    const $ = this.$;
    if (set && typeof set === 'object') Object.assign(this.lobbySet, set);
    $('startScreen').hidden = true;
    $('lobbyScreen').hidden = false;
    this.renderLobby();
  },
  /* our own server: every game is a room with its own link */
  renderOnlineOwn() {
    const net = this.app.net, $ = this.$;
    let h = '', txt = '';
    if (!net.code) {
      txt = RA.t("Create a game and send the link to a friend. Every game has its own link: your friend joins through it, and you come back to the game if you close the page.");
      h = RA.t("<button class=\"btn\" data-on=\"host\">{0}<span><span class=\"t\">Create a game</span><br><span class=\"d\">You are the host: you pick the map and the game type</span></span></button>", RA.icon('flag'))
        + RA.t("<div class=\"code-row\"><input id=\"codeIn\" aria-label=\"Game code or link\" class=\"sel\" maxlength=\"60\" placeholder=\"game code or link\" autocomplete=\"off\" autocapitalize=\"off\"><button class=\"btn good\" data-on=\"code\">Join</button></div>");
    } else if (net.status !== 'ready') {
      txt = RA.t("Connecting to the game…");
    } else if (!net.role) {
      const hosts = net.others().filter((p) => p.presence && p.presence.r === 'h');
      const lobby = hosts.find((p) => p.presence.ph === 'lobby');
      const play = hosts.find((p) => p.presence.ph === 'play');
      if (lobby && lobby.presence.v !== RA.BUILD) txt = RA.t("This game was made on another version of the game — reload the page (both you and the host).");
      else if (lobby && net.arriving) {
        net.arriving = false;
        net.join(lobby.peer);
        this.showLobby();
        return;
      } else if (play && play.presence.v === RA.BUILD) {
        txt = RA.t("The game is in progress (host: {0}). You can watch it live.", RA.esc(RA.Net.str(play.presence.n, RA.t("player"))));
        h = RA.t("<button class=\"btn\" data-watch=\"{0}\">{1}<span><span class=\"t\">Watch the game</span><br><span class=\"d\">See everything that happens, without playing</span></span></button>", RA.esc(play.peer), RA.icon('flag'));
      } else if (performance.now() - net.arrivedAt > 2500) txt = RA.t("This game doesn't exist or is over.");
      else txt = RA.t("Looking for the game…");
      h += RA.t("<button class=\"btn\" data-on=\"close\">Back</button>");
    }
    $('joinBanner').hidden = true;
    return { h, txt };
  },
  renderOnline() {
    const net = this.app.net, $ = this.$;
    if (!net) return;
    const note = $('onlineNote'), btns = $('onlineBtns');
    let h = '', txt = '';
    if (net.own) {
      const r = this.renderOnlineOwn();
      if (!r) return;
      ({ h, txt } = r);
      if (net.code && !net.role && net.status === 'ready' && performance.now() - net.arrivedAt <= 2600) setTimeout(() => net.changed(), 700);
    } else if (net.status === 'unavailable') {
      txt = RA.t("Start an online game on war.deovilab.com. Create a game and send its link to a friend.");
    } else if (net.status !== 'ready') {
      txt = RA.t("Connecting to the online server…");
    } else {
      const others = net.others();
      const lobbies = net.openLobbies();
      txt = others.length
        ? RA.t("On the page right now: {0}.", others.map((p) => RA.esc(RA.Net.str(p.presence && p.presence.n, RA.t("player")))).join(', '))
        : RA.t("You are alone here right now. When a friend opens war.deovilab.com, they will show up here.");
      for (const p of lobbies) h += RA.t("<button class=\"btn good\" data-on=\"{0}\">{1}<span><span class=\"t\">Join: {2}</span><br><span class=\"d\">The room is open — go in and pick a state</span></span></button>", RA.esc(p.peer), RA.icon('ally'), RA.esc(p.presence.n || RA.t("player")));
      // a friend who just opened the link sees the invitation at the top of the screen
      const banner = lobbies.map((p) => RA.t("<button class=\"btn primary\" data-on=\"{0}\">{1}<span><span class=\"t\">{2} is waiting for you in an online room</span><br><span class=\"d\">Tap to join</span></span></button>", RA.esc(p.peer), RA.icon('ally'), RA.esc(p.presence.n || RA.t("Friend")))).join('');
      // compare with what we rendered last (innerHTML never reads back identical), so buttons are not replaced under a finger
      if (this._bannerH !== banner) $('joinBanner').innerHTML = this._bannerH = banner;
      $('joinBanner').hidden = !lobbies.length;
      // games in progress (same build): watch them live
      for (const p of others.filter((q) => q.presence && q.presence.r === 'h' && q.presence.ph === 'play' && q.presence.v === RA.BUILD))
        h += RA.t("<button class=\"btn\" data-watch=\"{0}\">{1}<span><span class=\"t\">Watch: {2}</span><br><span class=\"d\">The game is in progress — you watch live</span></span></button>", RA.esc(p.peer), RA.icon('flag'), RA.esc(p.presence.n || RA.t("game")));
      h += RA.t("<button class=\"btn\" data-on=\"host\">{0}<span><span class=\"t\">Create a room</span><br><span class=\"d\">You are the host: you pick the map and the game type</span></span></button>", RA.icon('flag'));
    }
    if (this._noteH !== txt) note.innerHTML = this._noteH = txt;
    if (this._onlineH !== h) btns.innerHTML = this._onlineH = h;
    if (net.code && !net.role) {
      this.settings.side = 'online';
      this.sideShow();
      $('onlineBox').hidden = false;
      $('onlineToggle').setAttribute('aria-expanded', 'true');
    }
    if (net.role === 'guest') net.pollStart();
    if (net.phase === 'lobby' && !$('lobbyScreen').hidden) this.renderLobby();
  },
  /* a long game with the start screen's settings (the map, part, era, mode and difficulty) */
  confirmLong() {
    const s = this.settings, reg = RA.REGIONS.find((r) => r.id === s.region && r.map === s.map);
    this.confirm(RA.t("Create a Focus game?"), RA.t("{0} · {1}{2}. The game runs on the server even when you are away (then the computer plays your state) and lasts until someone wins. You get a link — send it to friends (up to 8 players); you come back through it too.", reg ? reg.name : RA.mapInfo(s.map).all, RA.eraById(s.era).name, s.gm === 'defcon' ? ' · DEFCON' : ''), RA.t("Create"), () => this.app.long.create());
  },
  renderLobby() {
    const net = this.app.net, $ = this.$;
    if (!net || net.phase !== 'lobby') return;
    const isHost = net.role === 'host';
    const hp = net.hostPresence();
    if (!isHost && (!hp || hp.g !== net.gid || hp.r !== 'h')) {
      // the host closed the room
      net.leave();
      $('lobbyScreen').hidden = true;
      $('startScreen').hidden = false;
      this.toast('info', RA.t("The host closed the room."));
      return;
    }
    const set = isHost ? this.lobbySet : (hp && hp.set) || this.lobbySet;
    // the game's map: download it now (a guest as soon as the host picks it), then tell the others (ld)
    const mapId = RA.mapInfo(set.map).id, era = RA.eraById(set.era).id, key = RA.mapKey(set);
    const loaded = this.app.mapReady(mapId, era);
    if (loaded && net.pres.ld !== key) net.publish({ ld: key });
    if (!loaded && this._lobbyLoad !== key && this._lobbyFail !== key) {
      this._lobbyLoad = key;
      this.app.ensureMap(mapId, era).then(
        () => this.renderLobby(),
        (e) => {
          this._lobbyFail = key; // once: renderLobby runs on every change in the room
          if (e && e.message === 'no-era') this.eraMissing(mapId, era); // the host picks another era
          else this.toast('bad', RA.t("{0} can't be loaded — check your connection and join again.", RA.esc(RA.mapInfo(mapId).aria)));
        }
      ).finally(() => (this._lobbyLoad = null));
    }
    const mem = net.members();
    const hostName = mem[0] ? mem[0].name : RA.t("host");
    $('lobbySub').textContent = isHost
      ? (net.own ? RA.t("You are the host. Send the game link to a friend — when they open it, they show up here.") : RA.t("You are the host. Your friend opens the same link and picks “Join”."))
      : RA.t("Host: {0}. The host picks the settings.", hostName);
    $('lobbyLinkRow').hidden = !net.code;
    if (net.code && $('lobbyLink').textContent !== net.link()) $('lobbyLink').textContent = net.link();
    const nats = this.regionNations(set) || [];
    const natName = (iso) => (nats.find((n) => n.iso === iso) || {}).name;
    const far = mapId !== 'evropa';
    $('lobbyPlayers').innerHTML = mem.map((m, i) => `<div class="prow"><span class="sw" style="background:${RA.SLOT_COLORS[i]}"></span><div class="pn"><div class="nm">${RA.esc(m.name)}${m.isMe ? RA.t(" <span class=\"tag\">you</span>") : ''}${i === 0 ? RA.t(" <span class=\"tag tr\">host</span>") : ''}</div><div class="d">${far && m.ld !== key ? RA.t("loading the map…") : m.pick && natName(m.pick) ? RA.esc(natName(m.pick)) : RA.t("state: random")}</div></div><div></div></div>`).join('')
      + (mem.length < 2 ? RA.t("<p class=\"note\" style=\"margin:2px\">Waiting for a friend…</p>") : '');
    // my country
    const sel = $('lobbyNat');
    const opts = RA.t("<option value=\"\">Random</option>") + nats.map((n) => `<option value="${n.iso}">${RA.esc(n.name)} — ${RA.esc(n.capital)}</option>`).join('');
    const natKey = `${key}|${set.reg}|${set.st}|${nats.length}`;
    if (sel.dataset.reg !== natKey) {
      sel.innerHTML = opts;
      sel.dataset.reg = natKey;
      if (net.pick && !nats.some((n) => n.iso === net.pick)) net.setPick('');
    }
    sel.value = net.pick || '';
    $('lobbyHost').hidden = !isHost;
    const lm = this.app.maps[mapId];
    for (const b of $('lEraSeg').querySelectorAll('button')) b.disabled = !!(lm && lm.eraOK && !lm.eraOK[b.dataset.v]);
    const reg = RA.regionsOf(mapId).find((r) => r.id === set.reg);
    const E = RA.eraById(set.era);
    const summary = RA.t("{0} ({1}) · {2}{3} · {4} · {5} · peace time {6} · {7}", E.name, E.sub, set.st === 'granice' ? RA.t("real borders") : RA.t("from the capital"), set.gm === 'br' ? RA.t(" · battle royale") : set.gm === 'defcon' ? ' · DEFCON' : '', reg ? reg.name : RA.mapInfo(mapId).all, RA.DIFF[set.dif] ? RA.DIFF[set.dif].label : '', set.peace ? Math.round(set.peace / 60) + RA.t(" min") : RA.t("none"), set.mode === 'vs' ? RA.t("against each other") : RA.t("together against everyone"));
    const ready = loaded && this.lobbyReady(set);
    $('lobbyInfo').innerHTML = !loaded
      ? RA.esc(RA.mapInfo(mapId).load)
      : isHost
      ? (ready ? RA.t("When everyone has picked a state, press “Start game”. A state can't be taken twice.") : RA.t("Waiting for everyone to load the map…"))
      : RA.t("{0}<br>Waiting for the host to start the game…", RA.esc(summary));
    $('lobbyGo').hidden = !isHost;
    $('lobbyGo').disabled = mem.length < 2 || !ready;
    $('lobbyCount').textContent = RA.t("{0}/4 players", mem.length);
  },
});

'use strict';
/* Ratni Atlas — online lobby: the "play with a friend" box on the start screen and the room screen */

Object.assign(RA.UI.prototype, {
  initOnline() {
    const $ = this.$, s = this.settings;
    this.lobbySet = { map: s.map, reg: s.region, dif: s.difficulty, peace: s.peace, cs: s.cityStates, mode: s.mode === 'vs' ? 'vs' : 'coop', era: s.era, st: s.start, gm: s.gm };
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
      const r = !nats ? 'Karta se još učitava…' : !this.lobbyReady(L) ? 'Čeka se da svi učitaju kartu.' : this.app.net.start(Object.assign({}, L), nats);
      if (typeof r === 'string') this.toast('info', RA.esc(r));
    };
    $('lobbyShare').onclick = async () => {
      const url = this.app.net.link();
      try {
        if (navigator.share) return await navigator.share({ title: 'Overtake', text: 'Igraj sa mnom Overtake:', url });
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
      try {
        await navigator.clipboard.writeText(url);
        this.toast('good', 'Link je kopiran — pošalji ga prijatelju.');
      } catch (e) {
        this.toast('info', 'Kopiraj link iznad i pošalji ga prijatelju.');
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
          if (!ok) this.toast('info', 'Ta igra se više ne može gledati.');
        });
      const b = e.target.closest('[data-on]');
      if (!b) return;
      const net = this.app.net;
      this.settings.name = $('nameIn').value.trim().slice(0, 18);
      this._save();
      if (b.dataset.on === 'code') {
        const m = /(?:game-)?([a-z0-9]{6})\s*$/i.exec($('codeIn').value.trim());
        if (!m) return this.toast('info', 'Upiši kod igre (6 znakova) ili zalijepi link koji ti je poslao prijatelj.');
        net.enterRoom(m[1].toLowerCase(), true);
        return;
      }
      if (b.dataset.on === 'close') return net.closeRoom();
      if (b.dataset.on === 'host') {
        this.lobbySet.map = this.settings.map;
        this.lobbyRegs();
        this.lobbySet.reg = this.settings.region;
        this.lobbySet.dif = this.settings.difficulty;
        this.lobbySet.peace = this.settings.peace;
        this.lobbySet.cs = this.settings.cityStates;
        this.lobbySet.era = this.settings.era;
        this.lobbySet.st = this.settings.start;
        this.lobbySet.gm = this.settings.gm;
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
      this.natCache[key] = nats.map((n) => ({ iso: n.iso, name: n.name, capital: n.capital })).sort((a, b) => a.name.localeCompare(b.name, 'bs'));
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
      txt = 'Napravi igru i pošalji link prijatelju. Svaka igra ima svoj link: preko njega se prijatelj priključuje, a ti se vraćaš u igru ako zatvoriš stranicu.';
      h = `<button class="btn" data-on="host">${RA.icon('flag')}<span><span class="t">Napravi igru</span><br><span class="d">Ti si domaćin: biraš kartu i način igre</span></span></button>`
        + `<div class="code-row"><input id="codeIn" class="sel" maxlength="60" placeholder="kod ili link igre" autocomplete="off" autocapitalize="off"><button class="btn good" data-on="code">Uđi</button></div>`;
    } else if (net.status !== 'ready') {
      txt = 'Povezujem se s igrom…';
    } else if (!net.role) {
      const hosts = net.others().filter((p) => p.presence && p.presence.r === 'h');
      const lobby = hosts.find((p) => p.presence.ph === 'lobby');
      const play = hosts.find((p) => p.presence.ph === 'play');
      if (lobby && lobby.presence.v !== RA.BUILD) txt = 'Ova igra je napravljena na drugoj verziji igre — osvježi stranicu (i ti i domaćin).';
      else if (lobby && net.arriving) {
        net.arriving = false;
        net.join(lobby.peer);
        this.showLobby();
        return;
      } else if (play && play.presence.v === RA.BUILD) {
        txt = `Igra je u toku (domaćin: ${RA.esc(RA.Net.str(play.presence.n, 'igrač'))}). Možeš je gledati uživo.`;
        h = `<button class="btn" data-watch="${RA.esc(play.peer)}">${RA.icon('flag')}<span><span class="t">Gledaj igru</span><br><span class="d">Vidiš sve što se dešava, bez igranja</span></span></button>`;
      } else if (performance.now() - net.arrivedAt > 2500) txt = 'Ova igra ne postoji ili je završena.';
      else txt = 'Tražim igru…';
      h += `<button class="btn" data-on="close">Nazad</button>`;
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
      txt = 'Online igra radi na war.deovilab.com: otvori stranicu, prijatelj otvori istu, pa se ovdje pojavi soba.';
    } else if (net.status !== 'ready') {
      txt = 'Povezujem se s online serverom…';
    } else {
      const others = net.others();
      const lobbies = net.openLobbies();
      txt = others.length
        ? `Na stranici su sada: ${others.map((p) => RA.esc(RA.Net.str(p.presence && p.presence.n, 'igrač'))).join(', ')}.`
        : 'Trenutno si sam ovdje. Kad prijatelj otvori war.deovilab.com, pojaviće se ovdje.';
      for (const p of lobbies) h += `<button class="btn good" data-on="${RA.esc(p.peer)}">${RA.icon('ally')}<span><span class="t">Pridruži se: ${RA.esc(p.presence.n || 'igrač')}</span><br><span class="d">Soba je otvorena — uđi i izaberi državu</span></span></button>`;
      // a friend who just opened the link sees the invitation at the top of the screen
      const banner = lobbies.map((p) => `<button class="btn primary" data-on="${RA.esc(p.peer)}">${RA.icon('ally')}<span><span class="t">${RA.esc(p.presence.n || 'Prijatelj')} te čeka u online sobi</span><br><span class="d">Dodirni da se pridružiš</span></span></button>`).join('');
      // compare with what we rendered last (innerHTML never reads back identical), so buttons are not replaced under a finger
      if (this._bannerH !== banner) $('joinBanner').innerHTML = this._bannerH = banner;
      $('joinBanner').hidden = !lobbies.length;
      // games in progress (same build): watch them live
      for (const p of others.filter((q) => q.presence && q.presence.r === 'h' && q.presence.ph === 'play' && q.presence.v === RA.BUILD))
        h += `<button class="btn" data-watch="${RA.esc(p.peer)}">${RA.icon('flag')}<span><span class="t">Gledaj: ${RA.esc(p.presence.n || 'igra')}</span><br><span class="d">Igra je u toku — gledaš uživo</span></span></button>`;
      h += `<button class="btn" data-on="host">${RA.icon('flag')}<span><span class="t">Napravi sobu</span><br><span class="d">Ti si domaćin: biraš kartu i način igre</span></span></button>`;
    }
    if (this._noteH !== txt) note.innerHTML = this._noteH = txt;
    if (this._onlineH !== h) btns.innerHTML = this._onlineH = h;
    if (net.role === 'guest') net.pollStart();
    if (net.phase === 'lobby' && !$('lobbyScreen').hidden) this.renderLobby();
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
      this.toast('info', 'Domaćin je zatvorio sobu.');
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
          else this.toast('bad', `${RA.esc(RA.mapInfo(mapId).aria)} se ne može učitati — provjeri vezu i uđi ponovo.`);
        }
      ).finally(() => (this._lobbyLoad = null));
    }
    const mem = net.members();
    const hostName = mem[0] ? mem[0].name : 'domaćin';
    $('lobbySub').textContent = isHost
      ? (net.own ? 'Ti si domaćin. Pošalji link igre prijatelju — kad ga otvori, pojaviće se ovdje.' : 'Ti si domaćin. Prijatelj otvara isti link i bira „Pridruži se”.')
      : `Domaćin: ${hostName}. Postavke bira domaćin.`;
    $('lobbyLinkRow').hidden = !net.code;
    if (net.code && $('lobbyLink').textContent !== net.link()) $('lobbyLink').textContent = net.link();
    const nats = this.regionNations(set) || [];
    const natName = (iso) => (nats.find((n) => n.iso === iso) || {}).name;
    const far = mapId !== 'evropa';
    $('lobbyPlayers').innerHTML = mem.map((m, i) => `<div class="prow"><span class="sw" style="background:${RA.SLOT_COLORS[i]}"></span><div class="pn"><div class="nm">${RA.esc(m.name)}${m.isMe ? ' <span class="tag">ti</span>' : ''}${i === 0 ? ' <span class="tag tr">domaćin</span>' : ''}</div><div class="d">${far && m.ld !== key ? 'učitava kartu…' : m.pick && natName(m.pick) ? RA.esc(natName(m.pick)) : 'država: nasumično'}</div></div><div></div></div>`).join('')
      + (mem.length < 2 ? '<p class="note" style="margin:2px">Čeka se prijatelj…</p>' : '');
    // my country
    const sel = $('lobbyNat');
    const opts = '<option value="">Nasumično</option>' + nats.map((n) => `<option value="${n.iso}">${RA.esc(n.name)} — ${RA.esc(n.capital)}</option>`).join('');
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
    const summary = `${E.name} (${E.sub}) · ${set.st === 'granice' ? 'stvarne granice' : 'od prijestolnice'}${set.gm === 'br' ? ' · battle royale' : ''} · ${reg ? reg.name : RA.mapInfo(mapId).all} · ${RA.DIFF[set.dif] ? RA.DIFF[set.dif].label : ''} · mirno doba ${set.peace ? Math.round(set.peace / 60) + ' min' : 'bez'} · ${set.mode === 'vs' ? 'jedan protiv drugog' : 'zajedno protiv svih'}`;
    const ready = loaded && this.lobbyReady(set);
    $('lobbyInfo').innerHTML = !loaded
      ? RA.esc(RA.mapInfo(mapId).load)
      : isHost
      ? (ready ? `Kad svi izaberu države, pritisni „Počni igru”. Ista država se ne može uzeti dvaput.` : 'Čeka se da svi učitaju kartu…')
      : `${RA.esc(summary)}<br>Čeka se da domaćin pokrene igru…`;
    $('lobbyGo').hidden = !isHost;
    $('lobbyGo').disabled = mem.length < 2 || !ready;
    $('lobbyCount').textContent = `${mem.length}/4 igrača`;
  },
});

'use strict';
/* Ratni Atlas — online lobby: the "play with a friend" box on the start screen and the room screen */

Object.assign(RA.UI.prototype, {
  initOnline() {
    const $ = this.$, s = this.settings;
    this.lobbySet = { reg: s.region, dif: s.difficulty, peace: s.peace, cs: s.cityStates, mode: s.mode === 'vs' ? 'vs' : 'coop', era: s.era, st: s.start, gm: s.gm };
    this.natCache = {};
    $('lRegSeg').innerHTML = RA.REGIONS.map((r) => `<button data-v="${r.id}" aria-pressed="false">${RA.esc(r.name)}</button>`).join('');
    $('lEraSeg').innerHTML = RA.ERAS.map((e) => `<button data-v="${e.id}" aria-pressed="false">${RA.esc(e.short)}<small>${RA.esc(e.sub)}</small></button>`).join('');
    const upd = (k, conv) => (v) => {
      this.lobbySet[k] = conv ? conv(v) : v;
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
    this._seg('lEraSeg', this.lobbySet.era, upd('era'));
    this._seg('lStartSeg', this.lobbySet.st, upd('st'));
    this._seg('lGmSeg', this.lobbySet.gm, upd('gm'));
    this._seg('lRegSeg', this.lobbySet.reg, upd('reg'));
    this._seg('modeSeg', this.lobbySet.mode, upd('mode'));
    this._seg('lDiffSeg', this.lobbySet.dif, upd('dif'));
    this._seg('lPeaceSeg', String(this.lobbySet.peace), upd('peace', Number));
    $('lobbyNat').onchange = () => this.app.net.setPick($('lobbyNat').value);
    $('lobbyGo').onclick = () => {
      const L = this.lobbySet;
      const r = this.app.net.start(Object.assign({}, L), this.regionNations(L.reg, L.era, L.st));
      if (typeof r === 'string') this.toast('info', RA.esc(r));
    };
    $('lobbyLeave').onclick = () => {
      this.app.net.leave();
      $('lobbyScreen').hidden = true;
      $('startScreen').hidden = false;
    };
    $('startScreen').addEventListener('click', (e) => {
      const b = e.target.closest('[data-on]');
      if (!b) return;
      const net = this.app.net;
      this.settings.name = $('nameIn').value.trim().slice(0, 18);
      this._save();
      if (b.dataset.on === 'host') {
        this.lobbySet.reg = this.settings.region;
        this.lobbySet.dif = this.settings.difficulty;
        this.lobbySet.peace = this.settings.peace;
        this.lobbySet.cs = this.settings.cityStates;
        this.lobbySet.era = this.settings.era;
        this.lobbySet.st = this.settings.start;
        this.lobbySet.gm = this.settings.gm;
        for (const [id, v] of [['lEraSeg', this.lobbySet.era], ['lStartSeg', this.lobbySet.st], ['lGmSeg', this.lobbySet.gm], ['lRegSeg', this.lobbySet.reg]])
          $(id).querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
        net.host(Object.assign({}, this.lobbySet));
      } else net.join(b.dataset.on);
      $('startScreen').hidden = true;
      $('lobbyScreen').hidden = false;
      this.renderLobby();
    });
    this.app.net.onChange(() => this.renderOnline());
    this.renderOnline();
  },
  /* nations a region starts with in an era (names sorted), cached */
  regionNations(reg, era, st) {
    era = era || 'danas';
    st = st || 'slobodno';
    const key = `${reg}|${era}|${st}`;
    if (!this.natCache[key]) {
      const m = RA.regionMap(RA.eraMap(this.app.map, era, st), reg);
      this.natCache[key] = m.nations.map((n) => ({ iso: n.iso, name: n.name, capital: n.capital })).sort((a, b) => a.name.localeCompare(b.name, 'bs'));
    }
    return this.natCache[key];
  },
  renderOnline() {
    const net = this.app.net, $ = this.$;
    if (!net) return;
    const note = $('onlineNote'), btns = $('onlineBtns');
    let h = '', txt = '';
    if (net.status === 'unavailable') {
      txt = 'Online igra radi na war.deovilab.com: otvori stranicu, prijatelj otvori istu, pa se ovdje pojavi soba.';
    } else if (net.status !== 'ready') {
      txt = 'Povezujem se s online serverom…';
    } else {
      const others = net.others();
      const lobbies = net.openLobbies();
      txt = others.length
        ? `Na stranici su sada: ${others.map((p) => RA.esc((p.presence && p.presence.n) || 'igrač')).join(', ')}.`
        : 'Trenutno si sam ovdje. Kad prijatelj otvori war.deovilab.com, pojaviće se ovdje.';
      for (const p of lobbies) h += `<button class="btn good" data-on="${RA.esc(p.peer)}">${RA.icon('ally')}<span><span class="t">Pridruži se: ${RA.esc(p.presence.n || 'igrač')}</span><br><span class="d">Soba je otvorena — uđi i izaberi državu</span></span></button>`;
      // a friend who just opened the link sees the invitation at the top of the screen
      const banner = lobbies.map((p) => `<button class="btn primary" data-on="${RA.esc(p.peer)}">${RA.icon('ally')}<span><span class="t">${RA.esc(p.presence.n || 'Prijatelj')} te čeka u online sobi</span><br><span class="d">Dodirni da se pridružiš</span></span></button>`).join('');
      if ($('joinBanner').innerHTML !== banner) $('joinBanner').innerHTML = banner;
      $('joinBanner').hidden = !lobbies.length;
      h += `<button class="btn" data-on="host">${RA.icon('flag')}<span><span class="t">Napravi sobu</span><br><span class="d">Ti si domaćin: biraš kartu i način igre</span></span></button>`;
    }
    note.innerHTML = txt;
    if (btns.innerHTML !== h) btns.innerHTML = h;
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
    const mem = net.members();
    const hostName = mem[0] ? mem[0].name : 'domaćin';
    $('lobbySub').textContent = isHost
      ? 'Ti si domaćin. Prijatelj otvara isti link i bira „Pridruži se”.'
      : `Domaćin: ${hostName}. Postavke bira domaćin.`;
    const nats = this.regionNations(set.reg, set.era, set.st);
    const natName = (iso) => (nats.find((n) => n.iso === iso) || {}).name;
    $('lobbyPlayers').innerHTML = mem.map((m, i) => `<div class="prow"><span class="sw" style="background:${RA.SLOT_COLORS[i]}"></span><div class="pn"><div class="nm">${RA.esc(m.name)}${m.isMe ? ' <span class="tag">ti</span>' : ''}${i === 0 ? ' <span class="tag tr">domaćin</span>' : ''}</div><div class="d">${m.pick && natName(m.pick) ? RA.esc(natName(m.pick)) : 'država: nasumično'}</div></div><div></div></div>`).join('')
      + (mem.length < 2 ? '<p class="note" style="margin:2px">Čeka se prijatelj…</p>' : '');
    // my country
    const sel = $('lobbyNat');
    const opts = '<option value="">Nasumično</option>' + nats.map((n) => `<option value="${n.iso}">${RA.esc(n.name)} — ${RA.esc(n.capital)}</option>`).join('');
    const natKey = `${set.reg}|${set.era}|${set.st}`;
    if (sel.dataset.reg !== natKey) {
      sel.innerHTML = opts;
      sel.dataset.reg = natKey;
      if (net.pick && !nats.some((n) => n.iso === net.pick)) net.setPick('');
    }
    sel.value = net.pick || '';
    $('lobbyHost').hidden = !isHost;
    const reg = RA.REGIONS.find((r) => r.id === set.reg);
    const E = RA.eraById(set.era);
    const summary = `${E.name} (${E.sub}) · ${set.st === 'granice' ? 'stvarne granice' : 'od prijestolnice'}${set.gm === 'br' ? ' · battle royale' : ''} · ${reg ? reg.name : 'Evropa'} · ${RA.DIFF[set.dif] ? RA.DIFF[set.dif].label : ''} · mirno doba ${set.peace ? Math.round(set.peace / 60) + ' min' : 'bez'} · ${set.mode === 'vs' ? 'jedan protiv drugog' : 'zajedno protiv svih'}`;
    $('lobbyInfo').innerHTML = isHost
      ? `Kad svi izaberu države, pritisni „Počni igru”. Ista država se ne može uzeti dvaput.`
      : `${RA.esc(summary)}<br>Čeka se da domaćin pokrene igru…`;
    $('lobbyGo').hidden = !isHost;
    $('lobbyGo').disabled = mem.length < 2;
    $('lobbyCount').textContent = `${mem.length}/4 igrača`;
  },
});

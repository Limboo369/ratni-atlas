'use strict';
/* Ratni Atlas — interface core: HUD, dock, status pills, attack chips, toasts, offers, modes, map input.
   The sheets (army, build, landing, missiles, diplomacy, map-cell menu, how-to, end screen) live in 08b-ui-sheets.js */

RA.ICONS = {
  fuel: '<path d="M3 21V4h11v17M2 21h13M6 7h5v5H6zM14 13h3v5a2 2 0 0 0 4 0V8l-4-4M19 6v5h2"/>',
  ore: '<path d="m3 15 5-9 7-3 6 9-4 9H7zM8 6l4 7 9-1M3 15l9-2 5 8M12 13l3-10"/>',
  wheat: '<path d="M12 22V3M12 9C7 9 5 6 5 3c5 0 7 3 7 6ZM12 15c-5 0-7-3-7-6 5 0 7 3 7 6ZM12 12c5 0 7-3 7-6-5 0-7 3-7 6ZM12 18c5 0 7-3 7-6-5 0-7 3-7 6Z"/>',
  drone: '<path d="M8 9h8v6H8zM8 9L4 5M16 9l4-4M8 15l-4 4M16 15l4 4M2 5h4M18 5h4M2 19h4M18 19h4"/>',
  sub: '<rect x="2" y="11" width="20" height="9" rx="4.5"/><path d="M9 11V7h6v4M12 7V3h4M6 15.5h.1M11 15.5h.1M16 15.5h.1"/>',
  ship: '<path d="M2 14h20l-4 6H6zM6 14V9h10v5M10 9V5h4v4M12 5V2M16 11h5"/>',
  dome: '<path d="M2 15a10 10 0 0 1 20 0M7 15c0-13 10-13 10 0M4 9h16M2 15h20v6H2zM10 21v-3h4v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
  build: '<path d="M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5"/>',
  boat: '<path d="M3 16l2 4h14l2-4H3zM12 3v11M12 4l6 8h-6"/>',
  ally: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
  nuke: '<path fill="currentColor" stroke="none" d="M10.40 9.23L7.25 3.77A9.5 9.5 0 0 1 16.75 3.77L13.60 9.23A3.2 3.2 0 0 0 10.40 9.23ZM15.20 12.00L21.50 12.00A9.5 9.5 0 0 1 16.75 20.23L13.60 14.77A3.2 3.2 0 0 0 15.20 12.00ZM10.40 14.77L7.25 20.23A9.5 9.5 0 0 1 2.50 12.00L8.80 12.00A3.2 3.2 0 0 0 10.40 14.77Z"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4l12 8-12 8z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  barracks: '<path d="M2 10l10-6 10 6M4 10h16v11H4zM9 21v-7h6v7M6 13h.1M18 13h.1M12 4V1h5v3h-5"/>',
  fort: '<path d="M3 21V4h3v3h3V4h6v3h3V4h3v17H3M9 21v-5a3 3 0 0 1 6 0v5M6 11h.1M18 11h.1"/>',
  port: '<path d="M2 21h20M3 21v-9h7v9M14 21V3h8M14 3l-6 6h14M20 9v7l-2 2-2-2M6 16h.1"/>',
  silo: '<path d="M3 21h18M7 21V8l5-6 5 6v13M7 12h10M7 15l-4 6M17 15l4 6M10 18v3M14 18v3"/>',
  sam: '<path d="M3 21h18v-4H3zM6 17l5-13 3-2 1 4-5 11M13 17l4-10 3-2 1 4-3 8M4 15V6M2 6h4"/>',
  city: '<path d="M2 21h20M3 21V10h5M8 21V3h8v18M16 12h5v9M11 7h2M11 11h2M11 15h2M5 14h.1M19 16h.1"/>',
  factory: '<path d="M2 21V11l6-4v4l6-4v4h8v10H2M17 11V3h4v8M6 16h2M12 16h2M18 16h.1"/>',
  airport: '<path d="M10.6 3.6a1.4 1.4 0 0 1 2.8 0V9l7.6 4.6v2.1l-7.6-2.3v4.4l2.1 1.6v1.7L12 20.1l-3.5 1v-1.7l2.1-1.6v-4.4L3 15.7v-2.1L10.6 9z"/>',
  attack: '<path d="M4 20L20 4M14 4h6v6M4 14l6 6"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  army: '<path d="M6 10V9a6 6 0 0 1 12 0v1M4 10h16M8 10v3a4 4 0 0 0 8 0v-3M3 22v-2a4 4 0 0 1 4-4l5 3 5-3a4 4 0 0 1 4 4v2M12 3v3M12 19v3"/>',
  inf: '<path d="M5 12V9a7 7 0 0 1 14 0v3M3 12h18M7 12v3a5 5 0 0 0 10 0v-3M8 21l4-2 4 2M12 2v5"/>',
  tank: '<rect x="2" y="14" width="20" height="7" rx="3.5"/><path d="M5 14v-4h13l3 4M8 10V6h7l3 4M17 7h6M6 17.5h.1M12 17.5h.1M18 17.5h.1"/>',
  art: '<circle cx="9" cy="17" r="4"/><path d="M9 17l6-8 5-3 2 3-7 4M6 14l-3-2M12 18l8 3M15 9l-3-2"/>',
  rocket: '<path d="M12 2.5c2.6 2.2 4 5.4 4 9.2V17H8v-5.3c0-3.8 1.4-7 4-9.2z"/><path d="M8 12.5l-3 3.2V19l3-2M16 12.5l3 3.2V19l-3-2M10.5 20.5h3"/>',
  emp: '<path d="M13 2L5 13.5h6L10 22l8-11.5h-6z"/>',
  para: '<path d="M3 10.5a9 6.5 0 0 1 18 0"/><path d="M3 10.5l9 8.5 9-8.5M8.5 10.5L12 19l3.5-8.5"/>',
  cav: '<path d="M5 21v-5l5-6-2-3 4-2 2-3 2 5 5 4-2 4-5-2-1 8M5 21h12M15 9h.1"/>',
  siege: '<path d="M3 20h18M5.5 20l2.5-6h8l2.5 6M9 14l8.5-9"/><circle cx="18.2" cy="4.4" r="1.9"/>',
  market: '<path d="M3 10l3-6h12l3 6M4 10v10h16V10M3 10h18M10 20v-5h4v5"/>',
  hangar: '<path d="M3 20v-8a9 9 0 0 1 18 0v8M3 20h18M8 20v-6h8v6"/>',
  zeppelin: '<ellipse cx="11" cy="10" rx="8.5" ry="4.2"/><path d="M19.5 10l2.5-3v6zM9 14.2h4v2.8H9z"/>',
  zone: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.5"/><circle cx="12" cy="12" r="3"/>',
  trade: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  mob: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M19 8v6M16 11h6"/>',
  retreat: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  send: '<path d="M4 12h14M13 6l6 6-6 6"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.3 3 5.3V19h9v-3.2c1.7-1 3-2.7 3-5.3A7.5 7.5 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="15" cy="11" r="1.6" fill="currentColor"/><path d="M10.5 19v2M13.5 19v2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
};
/* game modes (start screen): Blitz and Focus fix the rules, Make your choice leaves them to the player */
RA.MODES = {
  blitz: { name: RA.t("Blitz"), rules: { pace: 'blitz', tree: false, res: false, noNuke: false, peace: 60 },
    note: RA.t("Blitz: a quick, direct match — no tech tree or resources, 1 min of peace, all weapons allowed.") },
  focus: { name: RA.t("Focus"), rules: { pace: 'focus', tree: true, res: true, noNuke: false, peace: 180 },
    note: RA.t("Focus: the game lasts days and goes on while you're away (the computer leads your state). Tech tree, resources and trade, a longer peace time; when you come back, a report of what happened.") },
  custom: { name: 'Make your choice', rules: null, note: '' },
};
RA.icon = (n, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''} aria-hidden="true">${RA.ICONS[n] || ''}</svg>`;

/* the page's own text (src/body.html is in English) in the player's language: text nodes and labels found in RA.SR */
RA.trDom = function (root) {
  if (RA.LANG === 'en' || !root) return;
  document.documentElement.lang = RA.LANG;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const k = n.nodeValue.trim();
    if (k && Object.prototype.hasOwnProperty.call(RA.SR, k)) n.nodeValue = n.nodeValue.replace(k, RA.SR[k]);
  }
  for (const a of ['placeholder', 'title', 'aria-label'])
    for (const el of root.querySelectorAll('[' + a + ']')) {
      const v = el.getAttribute(a);
      if (Object.prototype.hasOwnProperty.call(RA.SR, v)) el.setAttribute(a, RA.SR[v]);
    }
};

RA.phone = () => !!(window.matchMedia && matchMedia('(max-width: 760px)').matches);

RA.TERR_NAME = [RA.t("sea"), RA.t("plains"), RA.t("hills"), RA.t("mountains")];

RA.UI = class {
  constructor(app) {
    this.app = app;
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    this.ratio = 0.3;
    this.mode = null;
    this.labels = [];
    this.fxList = [];
    this.alpha = 0;
    this.lastHud = 0;
    this.lastBoard = 0;
    this.lastLabels = 0;
    this.tipsShown = new Set();
    this.reqToasts = new Map();
    this.chips = new Map();
    this.statusKey = '';
    document.querySelectorAll('[data-ic]').forEach((el) => (el.outerHTML = RA.icon(el.dataset.ic)));
    $('pauseBtn').innerHTML = RA.icon('pause');
    $('menuBtn').innerHTML = RA.icon('menu');
    $('meBtn').innerHTML = RA.icon('locate');
    $('meBtn').onclick = () => {
      const me = this.G && this.G.me;
      if (me && me.alive) this.focusPlayer(me.id);
    };

    // settings (remembered per viewer)
    this.settings = { name: '', difficulty: 'srednje', cityStates: 50, map: 'evropa', region: 'evropa', peace: 60, era: 'danas', start: 'granice', gm: 'klasik' };
    try {
      const s = JSON.parse(localStorage.getItem('ra_settings') || '{}');
      Object.assign(this.settings, s);
    } catch (e) {}
    if (!RA.MAPS.some((m) => m.id === this.settings.map)) this.settings.map = 'evropa';
    this.fixRegion();
    if (!RA.ERAS.some((e) => e.id === this.settings.era)) this.settings.era = 'danas';
    if (this.settings.start !== 'slobodno') this.settings.start = 'granice';
    if (this.settings.gm !== 'br' && this.settings.gm !== 'defcon') this.settings.gm = 'klasik';
    $('nameIn').value = this.settings.name || '';
    // the map: Europe is always there; the world only on our own server (probed at boot, see mapsChanged)
    // where to play: Evropa and the parts of the world in one list (world ones appear once the world map is there)
    $('mapSeg').innerHTML = RA.THEATRES.map((t) => `<button data-v="${t.id}" aria-pressed="false"${t.map === 'evropa' ? '' : ' hidden'}>${RA.esc(t.name)}<small></small></button>`).join('');
    this._seg('mapSeg', RA.theatreOf(this.settings), (v) => this.pickTheatre(v));
    $('eraSeg').innerHTML = RA.ERAS.map((e) => `<button data-v="${e.id}" aria-pressed="false">${RA.esc(e.short)}<small>${RA.esc(e.sub)}</small></button>`).join('');
    this._seg('eraSeg', this.settings.era, (v) => {
      this.settings.era = v;
      this.startNotes();
    });
    this._seg('startSeg', this.settings.start, (v) => {
      this.settings.start = v;
      this.startNotes();
    });
    this._seg('gmSeg', this.settings.gm, (v) => {
      this.settings.gm = v;
      this.startNotes();
    });
    this._seg('regSeg', this.settings.region, (v) => {
      this.settings.region = v;
      if (this.settings.map === 'evropa') this.settings.euRegion = v; // remembered when coming back to Evropa
      this.previewRegion(v);
    });
    this.startNotes();
    this._seg('diffSeg', this.settings.difficulty, (v) => (this.settings.difficulty = v));
    this._seg('peaceSeg', String(this.settings.peace), (v) => {
      this.settings.peace = +v;
      this.paceShow();
    });
    this._seg('csSeg', String(this.settings.cityStates), (v) => (this.settings.cityStates = +v));
    this._seg('resSeg', this.settings.res ? '1' : '0', (v) => {
      this.settings.res = v === '1';
      this.paceShow();
    });
    $('colorSeg').innerHTML = RA.PLAYER_COLORS.map((c) => `<button data-v="${c}" aria-pressed="false" aria-label="Boja ${c}" style="--sw:${c}"><span></span></button>`).join('');
    this._seg('colorSeg', RA.PLAYER_COLORS.includes(this.settings.color) ? this.settings.color : RA.PLAYER_COLORS[0], (v) => (this.settings.color = v));
    this._seg('cbSeg', this.settings.cb ? '1' : '0', (v) => this.setColorblind(v === '1'));

    // the game's mode: Blitz and Focus are presets of the rules, "Make your choice" lets you set every rule
    // (map, era, start, game type and difficulty are yours in every mode); see RA.MODES and playSet()
    this._seg('paceSeg', RA.MODES[this.settings.pace] ? this.settings.pace : 'blitz', (v) => {
      this.settings.pace = v;
      this.paceShow();
      if (v === 'custom') this.$('operationDialog').showModal();
    });
    // Conqueror (solo) or Online (Conquest League, Skirmish, private rooms): what the start screen shows
    this._seg('sideSeg', this.settings.side === 'online' ? 'online' : 'solo', (v) => {
      this.settings.side = v;
      this.sideShow();
    });
    this.sideShow();
    addEventListener('ra-login', () => {
      if (this.app.net) this.app.net.leave();
      this.app.showStart();
      this.needAccount(() => {});
    });
    $('leagueBtn').onclick = () => this.needAccount(() => this.leagueSheet());
    $('skirmishBtn').onclick = () => this.needAccount(() => this.skirmishSheet());
    $('marketBtn').onclick = () => this.marketSheet(); // Community market (09i-editor.js): browsing and playing need no account
    this._seg('daysSeg', String([1, 3, 7].includes(this.settings.days) ? this.settings.days : 1), (v) => (this.settings.days = +v));
    this._seg('cPaceSeg', this.settings.cPace === 'focus' ? 'focus' : 'blitz', (v) => {
      this.settings.cPace = v;
      this.paceShow();
    });
    this._seg('treeSeg', this.settings.tree ? '1' : '0', (v) => {
      this.settings.tree = v === '1';
      this.paceShow();
    });
    this._seg('nukeSeg', this.settings.noNuke ? '1' : '0', (v) => {
      this.settings.noNuke = v === '1';
      this.paceShow();
    });
    this.paceShow();
    $('goBtn').onclick = () => {
      this.settings.name = $('nameIn').value.trim().slice(0, 18);
      this._save();
      if (this.playSet().pace === 'focus') this.confirmLong();
      else app.newGame();
    };
    $('quickBtn').onclick = () => {
      this.settings.name = $('nameIn').value.trim().slice(0, 18);
      this._save();
      app.quickGame();
    };
    $('resumeBtn').onclick = () => {
      if (!this.resumeSv) return;
      this.settings.name = $('nameIn').value.trim().slice(0, 18);
      this._save();
      app.resumeSave(this.resumeSv);
    };
    $('howBtn').onclick = () => this.howTo();
    $('tutBtn').onclick = () => this.startTutorial();
    $('campBtn').onclick = () => {
      this.settings.name = $('nameIn').value.trim().slice(0, 18);
      this._save();
      this.campaignSheet();
    };
    $('campBigBtn').onclick = () => $('campBtn').onclick(); // the campaign, big on the Conqueror side
    try {
      if (!localStorage.getItem('ra_tut_done')) $('tutBtn').classList.add('fresh');
    } catch (_) {}
    $('startBtn').onclick = () => app.start();
    $('natSel').onchange = () => this.pickNation($('natSel').value);
    $('againBtn').onclick = () => {
      $('endScreen').hidden = true;
      app.showStart();
    };
    $('contBtn').onclick = () => {
      const G = this.G;
      if (!G || G.online || G.state !== 'over') return;
      G.continued = true;
      G.state = 'play';
      if (G.rec) G.rec.cont = G.tick;
      $('endScreen').hidden = true;
      this.toast('good', RA.t("The game goes on. When you are alone on the map, the game is over."), { ms: 5000 });
    };
    $('rematchBtn').onclick = () => this.rematch();
    $('watchBtn').onclick = () => {
      $('endScreen').hidden = true;
      this.watching = true;
    };
    const r = $('ratio');
    r.value = Math.round(this.ratio * 100);
    const onRatio = () => {
      this.ratio = r.value / 100;
      r.style.setProperty('--p', ((r.value - 5) / 95) * 100 + '%');
      this.updateRatio();
    };
    r.addEventListener('input', onRatio);
    onRatio();
    $('speedBtn').onclick = () => app.cycleSpeed();
    $('pauseBtn').onclick = () => app.togglePause();
    $('menuBtn').onclick = () => this.menu();
    const gs = $('hGold').closest('.stat');
    gs.tabIndex = 0;
    gs.setAttribute('role', 'button');
    gs.title = RA.t("Economy: tax and interest (Z)");
    gs.onclick = () => this.econSheet();
    gs.onkeydown = (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), e.stopPropagation(), this.econSheet());
    $('chatBtn').innerHTML = RA.icon('chat');
    $('chatBtn').onclick = () => this.quickSheet();
    const modal = (kinds, open) => () => {
      if (this.mode && kinds.includes(this.mode.kind)) this.setMode(null);
      else open();
    };
    $('aArmy').onclick = modal(['recruit', 'unit'], () => this.armySheet());
    $('aBuild').onclick = modal(['build'], () => this.buildSheet());
    $('aLand').onclick = modal(['boat', 'para', 'bomb'], () => this.landSheet());
    $('aStrike').onclick = modal(['missile'], () => this.strikeSheet());
    $('aDiplo').onclick = () => this.diploSheet();
    $('modeCancel').onclick = () => this.setMode(null);
    $('modeExtra').onclick = () => this.modeExtra();
    $('dlogToggle').onclick = () => {
      const d = $('dlog');
      d.classList.toggle('collapsed');
      $('dlogToggle').textContent = d.classList.contains('collapsed') ? '▸' : '▾';
      if (!d.classList.contains('collapsed')) {
        $('dlogNew').hidden = true;
        $('dlogNew').textContent = '0';
        $('dlogList').scrollTop = $('dlogList').scrollHeight;
      }
    };
    if (window.innerWidth < 760) {
      $('dlog').classList.add('collapsed');
      $('dlogToggle').textContent = '▸';
    }
    $('boardToggle').onclick = () => {
      $('board').classList.toggle('collapsed');
      $('boardToggle').textContent = $('board').classList.contains('collapsed') ? '▸' : '▾';
    };
    $('boardList').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (li) this.focusPlayer(+li.dataset.id);
    });
    $('attBar').addEventListener('click', (e) => {
      const chip = e.target.closest('.achip');
      if (!chip || !chip._it) return;
      const it = chip._it;
      if (e.target.closest('.x')) this.retreatAtt(it.id);
      else if (it.kind === 'back') this.act('rcl', [it.who, this.ratio]);
      else if (it.cell >= 0) this.flyToCell(it.cell);
    });
    $('sheetWrap').addEventListener('click', (e) => {
      if (e.target.id === 'sheetWrap') this.closeSheet();
    });
    // Modal input owns its keys, including Escape from a text field and Tab at either end.
    $('sheet').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.closeSheet(); return; }
      if (e.key === 'Tab') {
        const items = [...$('sheet').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')].filter((el) => el.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === $('sheet'))) { e.preventDefault(); if (last) last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); if (first) first.focus(); }
      }
    }, true);
    document.addEventListener('keydown', (e) => this.onKey(e));
    if (window.innerWidth < 560) {
      $('board').classList.add('collapsed');
      $('boardToggle').textContent = '▸';
    }
    const root = document.documentElement.style;
    const ro = new ResizeObserver(() => {
      root.setProperty('--dock-h', ($('dock').hidden ? 0 : innerHeight - $('dock').getBoundingClientRect().top) + 'px');
      root.setProperty('--hud-h', ($('hud').hidden ? 0 : $('hud').getBoundingClientRect().bottom) + 'px');
      root.setProperty('--st-h', ($('status').offsetHeight ? $('status').offsetHeight + 6 : 0) + 'px');
      root.setProperty('--feed-h', ($('feed').offsetHeight ? $('feed').offsetHeight + 6 : 0) + 'px');
    });
    ro.observe($('feed'));
    ro.observe($('dock'));
    ro.observe($('hud'));
    ro.observe($('status'));
    this.command = new RA.CommandScreen(this);
    this.account = new RA.Account(this);
    this.audio = new RA.Audio();
  }
  /* start screen buttons after the lobby changed the settings (and the map shown behind it) */
  syncStart() {
    const s = this.settings;
    for (const [id, v] of [['mapSeg', RA.theatreOf(s)], ['eraSeg', s.era], ['startSeg', s.start], ['gmSeg', s.gm], ['diffSeg', s.difficulty], ['peaceSeg', String(s.peace)], ['resSeg', s.res ? '1' : '0']]) this._press(id, v);
    this.startNotes();
    if (this.app.map.id !== s.map && this.app.mapOK && this.app.mapOK[s.map]) this.app.useMap(s.map);
  }
  /* the region must belong to the chosen map (else: all of that map) */
  /* start screen: a part of the world was picked */
  pickTheatre(v) {
    const T = RA.THEATRES.find((t) => t.id === v);
    if (!T) return;
    const s = this.settings, was = s.map;
    s.map = T.map;
    s.region = T.region || s.euRegion || 'evropa';
    this.fixRegion();
    this.startNotes();
    if (was !== s.map || this.app.map.id !== s.map) this.app.useMap(s.map);
    else this.previewRegion(s.region);
  }
  fixRegion() {
    const s = this.settings;
    if (!RA.regionsOf(s.map).some((r) => r.id === s.region)) s.region = RA.regionsOf(s.map)[0].id;
  }
  /* start screen: region buttons with the number of countries of the chosen era, and short explanations */
  startNotes() {
    const s = this.settings, $ = this.$;
    const E = RA.eraById(s.era);
    const m = this.app.maps && this.app.maps[s.map];
    const ready = !!m && RA.eraReady(m, E.id);
    // a world era not downloaded yet: '…' until it is
    if (m && !ready) RA.loadEra(m, E.id).then(() => this.startNotes(), () => {});
    // eras: the map must have them, and a part of the world needs at least 2 states in that era (world eras are
    // small files: all of them are fetched for the counts)
    const th = RA.theatreOf(s), few = {};
    if (m && m.lazyEras) this.eraCounts(m);
    for (const b of $('eraSeg').querySelectorAll('button')) {
      const e = b.dataset.v;
      const n = m && s.map !== 'evropa' ? this.regionCount(m, s.region, e, s.start, true) : null;
      few[e] = n !== null && n < 2;
      b.disabled = !!(m && m.eraOK && !m.eraOK[e]) || few[e];
      b.title = few[e] ? RA.t("{0} doesn't have enough states in this era", RA.THEATRES.find((t) => t.id === th).name) : '';
    }
    if (few[E.id]) {
      // the chosen era has (almost) no states here: the nearest era that has (later first)
      const i0 = RA.ERAS.findIndex((x) => x.id === E.id), ok = (x) => x && !few[x.id] && (!m.eraOK || m.eraOK[x.id]);
      let alt = null;
      for (let d = 1; d < RA.ERAS.length && !alt; d++) alt = [RA.ERAS[i0 + d], RA.ERAS[i0 - d]].find(ok) || null;
      if (alt && alt.id !== s.era) {
        s.era = alt.id;
        this._press('eraSeg', alt.id);
        this._save();
        return this.startNotes();
      }
    }
    // the part-of-world buttons show how many states they have in the chosen era
    for (const b of $('mapSeg').querySelectorAll('button')) {
      const T = RA.THEATRES.find((t) => t.id === b.dataset.v), M = this.app.maps && this.app.maps[T.map];
      const n = M ? this.regionCount(M, T.region || T.map, E.id, s.start, true) : null;
      // always clickable: picking a part without states in this era moves the era (below)
      b.querySelector('small').textContent = n == null ? '' : n ? RA.t("{0} states", n) : RA.t("not in this era");
    }
    this._press('mapSeg', th);
    // the "part of Evropa" field (Balkan, Zapadna…) only for Evropa: a world part is already the region
    $('regField').hidden = s.map !== 'evropa';
    $('regSeg').innerHTML = RA.regionsOf(s.map).map((r) => {
      const n = ready ? this.regionCount(m, r.id, s.era, s.start) : null;
      return RA.t("<button data-v=\"{0}\" aria-pressed=\"{1}\"{2}>{3}<small>{4} states</small></button>", r.id, r.id === s.region, n === 0 ? ' disabled' : '', RA.esc(r.name), n == null ? '…' : n);
    }).join('');
    $('eraNote').textContent = RA.eraBlurb(E, s.map);
    $('csField').hidden = s.start === 'granice';
    $('modeNote').textContent = (s.start === 'granice'
      ? RA.t("Real borders: every state starts with its land from that era — you pick one and lead it. ")
      : RA.t("From the capital: states start from a small circle around their capital, the rest is free land. "))
      + (s.gm === 'br' ? RA.t("Battle royale: a radioactive zone shrinks towards a random point — everything outside the circle is lost.") : '')
      + (s.gm === 'defcon' ? RA.t("DEFCON: five phases of 3 minutes — 5 building and alliances, 4 land attacks, 3 sea and air, 2 missiles, 1 nukes. After 25 minutes whoever has the most cities and population wins.") : '');
    if (this.command) this.command.refresh();
  }
  /* number of states of a region in an era (cached); known=true: only if counted already or the era is decoded */
  regionCount(m, reg, era, start, known) {
    const key = `${m.id}|${reg}|${era}|${start}`;
    this._rc = this._rc || {};
    if (this._rc[key] == null) {
      if (known && !RA.eraReady(m, era)) return null;
      this._rc[key] = RA.regionNations(RA.eraMap(m, era, start), reg).length;
    }
    return this._rc[key];
  }
  /* a lazily loaded map (the world) keeps only ~2 decoded eras: to count states per region in every era, fetch them
     one at a time, count all regions, and drop each again unless it is the chosen one */
  eraCounts(m) {
    const start = this.settings.start;
    this._rc = this._rc || {};
    const todo = RA.ERAS.map((e) => e.id).filter((e) => (!m.eraOK || m.eraOK[e]) && this._rc[`${m.id}|${m.id}|${e}|${start}`] == null);
    if (!todo.length || this._counting) return;
    this._counting = true;
    const next = () => {
      const e = todo.shift();
      if (!e) {
        this._counting = false;
        this.startNotes();
        return;
      }
      const had = !!m.eras[e];
      RA.loadEra(m, e)
        .then(() => {
          for (const r of RA.regionsOf(m.id)) this.regionCount(m, r.id, e, start);
          if (!had && e !== this.settings.era) delete m.eras[e];
        }, () => {})
        .then(next);
    };
    next();
  }
  /* boot probe: a map our server has shows up on the start screen (and in the lobby) */
  mapsChanged(id) {
    const ok = this.app.mapOK[id];
    this.showMap(id, ok);
    const s = this.settings;
    if (s.map !== id) return;
    if (ok) this.app.useMap(id);
    else this.mapFailed(id);
  }
  /* the map could not be loaded (offline, or the page is not on our server): back to Europe */
  mapFailed(id) {
    this.app.mapOK[id] = false;
    this.$('mapNote').hidden = false;
    this.showMap(id, false);
    this.$('mapNote').textContent = RA.t("{0} can't be loaded now (no connection, or the page isn't on war.deovilab.com) — you play on the map of Europe.", RA.mapInfo(id).aria);
    const s = this.settings;
    if (s.map === id) {
      s.map = 'evropa';
      this.fixRegion();
      this._press('mapSeg', 'evropa');
      this._save();
      this.startNotes();
      this.app.useMap('evropa');
    }
  }
  /* the map is there but not this era yet (the world gets its historical borders later): its latest era instead */
  eraMissing(id, era) {
    const m = this.app.maps[id], alt = m && m.eraOK && [...RA.ERAS].reverse().find((e) => m.eraOK[e.id]);
    if (!alt) return this.mapFailed(id);
    const s = this.settings, L = this.lobbySet, net = this.app.net;
    let changed = false;
    if (s.map === id && s.era === era) {
      s.era = alt.id;
      this._press('eraSeg', alt.id);
      this._save();
      this.startNotes();
      if (!this.$('startScreen').hidden) this.app.useMap(id);
      changed = true;
    }
    if (net && net.role === 'host' && net.phase === 'lobby' && L && L.map === id && L.era === era) {
      L.era = alt.id;
      this._press('lEraSeg', alt.id);
      net.setSettings(L);
      this.renderLobby();
      changed = true;
    }
    if (changed) this.toast('info', RA.t("This map isn't ready for the era “{0}” yet — “{1}” was chosen.", RA.esc(RA.eraById(era).short), RA.esc(alt.short)));
  }
  /* a map's button on the start screen and in the lobby; the "Karta" fields show only when there is a choice */
  showMap(id, ok) {
    for (const b of this.$('mapSeg').querySelectorAll('button')) if (RA.THEATRES.find((t) => t.id === b.dataset.v).map === id) b.hidden = !ok;
    const lb = this.$('lMapSeg').querySelector(`[data-v="${id}"]`);
    if (lb) lb.hidden = !ok;
    const many = RA.MAPS.some((m) => m.id !== 'evropa' && this.app.mapOK && this.app.mapOK[m.id]);
    this.$('mapField').hidden = !many && this.$('mapNote').hidden;
    this.$('lMapField').hidden = !many;
  }
  /* texts that name the map (screen reader label, tagline) */
  applyMapUI() {
    const I = RA.mapInfo(this.app.map.id);
    this.$('map').setAttribute('aria-label', I.aria);
    document.querySelector('#startScreen .tagline').textContent = I.tag;
  }
  /* dock labels of the current era (siege engines, zeppelins, rockets) */
  applyEraUI() {
    const E = RA.ERA;
    this.$('aStrike').innerHTML = `${RA.icon(E.strikeIcon)}<span>${RA.esc(E.strikeTab)}</span>`;
  }
  sideShow() {
    const on = this.settings.side === 'online';
    this.$('startScreen').classList.toggle('side-online', on);
    this._press('sideSeg', on ? 'online' : 'solo');
  }
  /* online needs an account (when this site has one): sign in first, then go on */
  needAccount(fn) {
    const A = this.account;
    if (!A || !A.ok || A.user) return fn();
    A.sheet();
    A.after = fn; // after sheet(): opening the profile by itself forgets it
    this.toast('info', RA.t("Sign in (Google) to play online. The whole game against the computer works without an account."), { ms: 6000 });
  }
  /* the rules a new game gets: the mode's preset, or (Make your choice) the player's own */
  playSet() {
    const s = this.settings, M = RA.MODES[s.pace] || RA.MODES.blitz;
    if (!M.rules) return Object.assign({}, s, { pace: s.cPace === 'focus' ? 'focus' : 'blitz' });
    return Object.assign({}, s, M.rules);
  }
  paceShow() {
    const s = this.settings, P = this.playSet(), f = P.pace === 'focus', M = RA.MODES[s.pace] || RA.MODES.blitz;
    this.$('paceDays').hidden = !f;
    this.$('goBtn').firstElementChild.textContent = f ? RA.t("Start a Focus game") : RA.t("Start the conquest");
    const custom = s.pace === 'custom';
    this.$('operationDialog').classList.toggle('preset', !custom);
    const rules = RA.t("{0} · tree {1} · resources {2} · nukes {3} · peace {4}", f ? RA.t("Focus") : RA.t("Blitz"), P.tree ? RA.t('yes') : RA.t('no'), P.res ? RA.t('yes') : RA.t('no'), P.noNuke ? RA.t('no') : RA.t('yes'), P.peace ? Math.round(P.peace / 60) + RA.t(" min") : RA.t("none"));
    this.$('paceNote').innerHTML = custom ? RA.t("<b>Your rules:</b> {0} — <button class=\"linkish\" id=\"paceEdit\">change</button>", rules) : RA.esc(M.note);
    const pe = this.$('paceEdit');
    if (pe) pe.onclick = () => this.$('operationDialog').showModal();
    this.$('rulesNote').innerHTML = RA.t("{0}: {1}. You set your own rules in <b>Make your choice</b> mode.", RA.esc(M.name), RA.esc(rules));
  }
  _save() {
    if (this.command) this.command.refresh();
    try {
      localStorage.setItem('ra_settings', JSON.stringify(this.settings));
    } catch (e) {}
  }
  _press(id, v) {
    this.$(id).querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  }
  _seg(id, val, cb) {
    const el = this.$(id);
    const set = (v) => this._press(id, v);
    set(val);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      set(b.dataset.v);
      cb(b.dataset.v);
      this._save();
    });
  }
  previewRegion(id) {
    const R = RA.regionsOf(this.app.map.id).find((r) => r.id === id);
    const lm = this.app.lmap;
    if (!lm) return;
    if (R && R.box) lm.flyToBounds([[R.box[1], R.box[0]], [R.box[3], R.box[2]]], { duration: 0.8 });
    else this.app.fitMap();
  }

  get G() {
    return this.app.G;
  }

  /* ---------------- screens ---------------- */
  showPlayUI(on) {
    ['hud', 'dock', 'board', 'meBtn'].forEach((id) => (this.$(id).hidden = !on));
    this.$('chatBtn').hidden = !(on && this.G && this.G.online);
    if (!on) {
      this.$('dlog').hidden = true;
      this.$('feed').innerHTML = '';
      this.$('modeBar').hidden = true;
      this.$('attBar').hidden = true;
      this.$('status').innerHTML = '';
      this.statusKey = '';
      this.$('attBar').innerHTML = '';
      this.chips.clear();
    }
    const root = document.documentElement.style;
    root.setProperty('--dock-h', on ? (innerHeight - this.$('dock').getBoundingClientRect().top) + 'px' : '0px');
    root.setProperty('--hud-h', on ? this.$('hud').getBoundingClientRect().bottom + 'px' : '0px');
    root.setProperty('--att-h', '0px');
  }
  spawnUI(on) {
    this.$('spawnBar').hidden = !on;
    if (!on) return;
    const G = this.G;
    this.$('startBtn').disabled = true;
    const reg = G.map.region;
    const E = RA.ERA;
    this.$('spawnText').innerHTML = G.borders
      ? RA.t("<b>{0}</b> ({1}): tap a state on the map or pick it from the list — you take over all its land, army and gold.", RA.esc(E.name), RA.esc(E.sub))
      : RA.t("Tap anywhere on land{0} or pick a state. Tapping a <b>capital</b> (small square) takes over the whole state.", reg ? RA.t(" inside the yellow frame") : '');
    const nats = G.P.filter((p) => p && p.type === 'nation').sort((a, b) => a.name.localeCompare(b.name, RA.LOCALE));
    this.$('natSel').innerHTML = `<option value="">${G.borders ? RA.t("Pick a state") : RA.t("Take over a state")}… (${nats.length})</option>` + nats.map((p) => `<option value="${p.id}">${RA.esc(p.name)} — ${RA.esc(p.nation.capital)}</option>`).join('');
  }
  pickNation(v) {
    const G = this.G;
    if (!G || G.state !== 'spawn' || !v) return;
    const p = G.P[+v];
    if (!p || !p.nation) return;
    if (G.me && G.me.took === p) return;
    const res = RA.placeHuman(G, p.nation.c, this.settings.name || RA.t("You"));
    if (res.err) {
      this.toast('info', RA.esc(res.err));
      return;
    }
    this.spawnPicked(res);
    this.app.terr.updatePalette();
    this.flyVisible(G.map.latLngOfCell(p.nation.c), Math.max(this.app.lmap.getZoom(), this.app.zoomAt(4.6)));
  }
  /* fly so that a point ends up in the middle of the map area left free by the bottom bars */
  flyVisible(ll, z) {
    const lm = this.app.lmap;
    const bar = this.$('spawnBar');
    const bottom = !bar.hidden ? bar.offsetHeight + 12 : (this.$('dock').hidden ? 0 : this.$('dock').offsetHeight);
    const p = lm.project(L.latLng(ll), z).add([0, bottom / 2]);
    lm.flyTo(lm.unproject(p, z), z, { duration: 0.7 });
  }
  spawnPicked(res) {
    const me = this.G.me;
    this.$('startBtn').disabled = false;
    const near = this.nearestCityName(me.capital);
    this.$('natSel').value = res.took ? String(res.took.id) : '';
    const pct = ((me.area / this.G.landTotal()) * 100).toFixed(1).replace('.', ',');
    this.$('spawnText').innerHTML = this.G.borders && res.took
      ? RA.t("You play as <span class=\"pick\">{0}</span> ({1}) — {2}% of the land, {3} troops. You can pick another state or start.", RA.esc(res.took.name), RA.esc(res.took.nation.capital), pct, RA.fmt(me.troops))
      : res.took
      ? RA.t("You take over <span class=\"pick\">{0}</span> ({1}). You can pick another spot or start.", RA.esc(res.took.name), RA.esc(res.took.nation.capital))
      : RA.t("You start at: <span class=\"pick\">{0}</span>. You can pick another spot or start.", RA.esc(near || RA.t("unknown place")));
  }
  nearestCityName(c) {
    const G = this.G, W = G.map.W, land = G.map.land;
    const x = c % W, y = (c / W) | 0;
    let best = null, bd = 1e9;
    for (const ct of G.cities) {
      if (!land[ct.c]) continue;
      const d = (ct.x - x) ** 2 + (ct.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = ct;
      }
    }
    return best && bd < 30 * 30 ? best.name : null;
  }

  /* ---------------- per-frame ---------------- */
  frame(now) {
    const G = this.G;
    if (!G) return;
    if (G.events.length) {
      for (const e of G.events) this.onEvent(e);
      G.events.length = 0;
    }
    this.feedUpdate(now);
    this.rulerTick(now);
    if (now - (this.campAt || 0) > 1000) {
      this.campAt = now;
      this.campTick();
    }
    if (this.tut) this.tut.update();
    if (G.fx.length) {
      for (const f of G.fx) if (!f.pid || (G.me && f.pid === G.me.id)) this.fxList.push(Object.assign({ t0: now }, f));
      if (!this.app.attractMode) for (const f of G.fx) {
        if (f.kind === 'nuke') this.audio.play('nuke', 400);
        else if (f.kind === 'conv' || f.kind === 'emp') this.audio.play('boom', 250);
        else if (f.kind === 'intercept') this.audio.play('rocket', 300);
      }
      G.fx.length = 0;
    }
    if (this.fxList.length) this.fxList = this.fxList.filter((f) => now - f.t0 < 3200);
    if (now - this.lastLabels > (G.state === 'spawn' ? 250 : 900)) {
      this.lastLabels = now;
      this.computeLabels();
    }
    if (G.state === 'play' || G.state === 'over') {
      if (now - this.lastHud > 150) {
        this.lastHud = now;
        this.updateHud();
        this.updateChips();
        this.updateStatus();
      }
      if (now - this.lastBoard > 600) {
        this.lastBoard = now;
        this.updateBoard();
        this.updateRequests();
        this.tips();
        if (this.mode && this.mode.kind === 'unit' && !this.selUnit()) this.setMode(null);
        if (this.mode && this.mode.kind === 'group' && this.groupUnits().length !== this.mode.ids.length) this.setMode(this.groupUnits().length ? Object.assign({}, this.mode, { ids: this.groupUnits().map((u) => u.id) }) : null);
      }
    }
  }

  computeLabels() {
    const G = this.G, W = G.map.W, own = G.owner;
    const out = [];
    for (const p of G.P) {
      if (!p || !p.alive || !p.spawned || p.tiles < 10) continue;
      const n = Math.min(p.tiles, 400);
      let sx = 0, sy = 0;
      const step = Math.max(1, Math.floor(p.tiles / n));
      for (let k = 0, i = 0; k < n; k++, i += step) {
        const c = p.cells[i % p.tiles];
        sx += c % W;
        sy += (c / W) | 0;
      }
      const mx = sx / n, my = sy / n;
      let best = -1, bd = 1e18;
      for (let k = 0, i = 0; k < n; k++, i += step) {
        const c = p.cells[i % p.tiles];
        const x = c % W, y = (c / W) | 0;
        let d = (x - mx) ** 2 + (y - my) ** 2;
        if (own[c - 2] !== p.id || own[c + 2] !== p.id || own[c - 2 * W] !== p.id || own[c + 2 * W] !== p.id) d *= 4;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (best >= 0) out.push({ id: p.id, x: best % W, y: (best / W) | 0, tiles: p.tiles });
    }
    out.sort((a, b) => b.tiles - a.tiles);
    this.labels = out;
  }

  updateHud() {
    const G = this.G, me = G.me, $ = this.$;
    if (!me) return;
    $('hNation').textContent = me.name;
    $('hNation').title = me.name;
    $('hEra').textContent = RA.ERA.short + (G.online ? ' · ONLINE' : G.dynasty ? ' · DINASTIJA ' + G.dynasty.toUpperCase() : ' · OPERACIJA');
    $('hObjective').style.width = RA.clamp(me.area / G.landTotal() / G.winShare() * 100, 0, 100) + '%';
    $('hTroops').textContent = RA.fmt(me.troops);
    const r = me.troops / Math.max(1, me.maxT);
    const bar = $('hBar');
    bar.querySelector('.fill').style.width = RA.clamp(r * 100, 0, 100) + '%';
    bar.classList.toggle('sweet', r >= 0.32 && r <= 0.54);
    $('hTroopsSub').textContent = `/ ${RA.fmt(me.maxT)}  ${me.growRate >= 0 ? '+' : '−'}${RA.fmt(Math.abs(me.growRate || 0))}/s`;
    $('hGold').textContent = RA.fmt(me.gold);
    $('hGoldSub').textContent = `+${RA.fmt(me.goldRate || 0)}/s`;
    const land = (me.area / G.landTotal()) * 100;
    $('hLand').textContent = (land < 10 ? land.toFixed(1) : land.toFixed(0)).replace('.', ',') + '%';
    $('clock').textContent = RA.TICK_REAL > 100 ? RA.dur(G.tick) : RA.fmtTime(G.tick / 10);
    this.updateRatio();
    $('aStrike').classList.toggle('dim', !me.n.silo);
    // nuclear spam: a bar on the strikes button runs out until the price is normal again
    const nk = me.nukeUntil > G.tick ? (me.nukeUntil - G.tick) / RA.CFG.NUKE_COOL : 0;
    $('aStrike').style.setProperty('--nuke', nk.toFixed(3));
    $('aStrike').classList.toggle('nuke-hot', nk > 0);
  }
  updateRatio() {
    const G = this.G;
    const me = G && G.me;
    const t = me ? RA.fmt(me.troops * this.ratio) : '';
    this.$('ratioVal').innerHTML = `<b>${Math.round(this.ratio * 100)}%</b>${t ? ' · ' + t : ''}`;
  }
  updateBoard() {
    const G = this.G;
    const tot = G.landTotal();
    const alive = G.P.filter((p) => p && p.alive && p.spawned).sort((a, b) => b.area - a.area);
    const me = G.me;
    const rank = alive.indexOf(me) + 1;
    this.$('hRank').textContent = me && me.alive ? RA.t("goal {0}% · #{1}/{2}", Math.round(G.winShare() * 100), rank, alive.length) : RA.t("defeated");
    let rows = alive.slice(0, 6);
    if (me && me.alive && rank > 6) rows = rows.slice(0, 5).concat([me]);
    this.$('boardHead').textContent = me && me.alive ? RA.t("Standings · #{0}", rank) : RA.t("Standings");
    this.$('boardList').innerHTML = rows
      .map((p) => {
        const i = alive.indexOf(p) + 1;
        const pc = (p.area / tot) * 100;
        const mk = me && p !== me ? (me.allies.has(p.id) ? ' ⛨' : '') + (me.trade.has(p.id) ? ' ⇄' : '') : '';
        const nm = G.online && p.human ? `${p.nick} · ${p.name}` : p.name;
        return `<li data-id="${p.id}" class="${p === me ? 'me' : ''}"><span class="rk">${i}</span><span class="sw" style="background:${p.hex}"></span><span class="nm">${RA.esc(nm)}${mk}</span><span class="pc">${pc.toFixed(1).replace('.', ',')}%</span></li>`;
      })
      .join('');
  }
  focusPlayer(pid) {
    const G = this.G;
    const L0 = this.labels.find((l) => l.id === pid);
    const p = G.P[pid];
    let ll = null;
    if (L0) ll = G.map.latLngOfXY(L0.x + 0.5, L0.y + 0.5);
    else if (p && p.tiles) ll = G.map.latLngOfCell(p.cells[0]);
    if (!ll) return;
    this.app.lmap.flyTo(ll, Math.max(this.app.lmap.getZoom(), this.app.zoomAt(5)), { duration: 0.8 });
    this.app.terr.setHighlight(pid);
    clearTimeout(this._hiT);
    this._hiT = setTimeout(() => this.app.terr.setHighlight(0), 2200);
  }
  flyToCell(c, z) {
    this.app.lmap.flyTo(this.G.map.latLngOfCell(c), Math.max(this.app.lmap.getZoom(), this.app.zoomAt(z || 5.2)), { duration: 0.7 });
  }

  /* ---------------- toasts & sim events ---------------- */
  toast(kind, html, opts = {}) {
    const box = this.$('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `<span class="dot"></span><div>${html}</div>`;
    box.prepend(el);
    while (box.children.length > 5) {
      const last = box.lastChild;
      for (const [k, v] of this.reqToasts) if (v === last) this.reqToasts.delete(k);
      last.remove();
    }
    // a plain message never catches a tap meant for the map (on a phone the toasts cover part of it)
    if (!(opts.cell >= 0) && !el.querySelector('button, a')) el.classList.add('pass');
    if (opts.cell >= 0) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.flyToCell(opts.cell);
      });
    }
    if (!opts.sticky) {
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 320);
      }, opts.ms || 4200);
    }
    return el;
  }
  onEvent(e) {
    const me = this.G && this.G.me;
    if (e.to && (!me || e.to !== me.id)) return; // meant for another player
    if (e.kind === 'over' || e.kind === 'lost') {
      this.app.gameOver(e.kind);
      return;
    }
    // sounds for what happens to me
    const A = this.audio, t = e.text || '';
    // (the texts are in the player's language: English or Serbian)
    if (/flying at you|a strike on your land|leti na tebe|udar na tvoju/.test(t)) A.play(/☢/.test(t) ? 'siren' : 'rocket', 1500);
    else if (/is attacking you!|te napada/.test(t)) A.play('alarm', 4000);
    else if (/^(City captured|Osvojen grad)/.test(t)) A.play('city', 600);
    else if (/^(City lost|Izgubljen grad)|^Your capital .* has fallen|Pala je tvoja prijestolnica/.test(t)) A.play('loss', 800);
    else if (e.kind === 'offer' || e.kind === 'ally') A.play('msg', 1000);
    if (e.kind === 'offer') return; // shown as an offer toast with buttons
    // on a phone the news would cover half of the map (Darko, 27. 9.): only offers pop up there; the rest stays in the logs
    if (RA.phone()) return;
    this.toast(e.kind, RA.esc(e.text), { cell: e.cell, ms: e.kind === 'bad' ? 5200 : 4200 });
    if (e.kind === 'bad' && navigator.vibrate) {
      try {
        navigator.vibrate(30);
      } catch (x) {}
    }
  }
  /* incoming offers: military alliance and trade agreement are different pacts */
  updateRequests() {
    const G = this.G, me = G.me;
    if (!me) return;
    const live = new Set();
    const add = (r, kind) => {
      if (r.to !== me.id) return;
      const key = kind + ':' + r.from;
      live.add(key);
      if (this.reqToasts.has(key)) return;
      const a = G.P[r.from];
      const who = a.human && G.online ? `${a.nick} (${a.name})` : a.name;
      const txt = kind === 'A'
        ? RA.t("<b>{0}</b> offers a <b>military alliance</b> (5 min): you don't attack each other and help each other in war.", RA.esc(who))
        : RA.t("<b>{0}</b> offers a <b>trade pact</b>: gold for both sides, no duties in war.", RA.esc(who));
      const el = this.toast(kind === 'A' ? 'ally' : 'good', RA.t("{0}<div class=\"acts\"><button class=\"yes\">Accept</button><button class=\"no\">Decline</button></div>", txt), { sticky: true, cell: a.capital });
      const done = (yes) => {
        this.act(kind === 'A' ? 'aRes' : 'tRes', [r.from, yes ? 1 : 0]);
        el.remove();
        this.reqToasts.delete(key);
        this.updateRequests();
      };
      el.querySelector('.yes').onclick = () => done(true);
      el.querySelector('.no').onclick = () => done(false);
      this.reqToasts.set(key, el);
    };
    for (const r of G.allyReqs) add(r, 'A');
    for (const r of G.tradeReqs) add(r, 'T');
    for (const [k, el] of this.reqToasts) {
      if (!live.has(k)) {
        el.remove();
        this.reqToasts.delete(k);
      }
    }
    const n = live.size;
    const b = this.$('diploBdg');
    b.hidden = !n;
    b.textContent = n;
  }

  /* ---------------- active attacks bar (with retreat) ---------------- */
  updateChips() {
    const G = this.G, me = G.me, bar = this.$('attBar');
    const items = [];
    if (me && me.alive && G.state === 'play') {
      for (const a of G.attacks) if (!a.done && a.troops >= 1 && a.a === me.id) items.push({ k: 'a' + a.id, kind: 'out', id: a.id, who: a.t, n: a.troops, cell: a.focus, o: 0 });
      for (const b of G.boats) if (!b.done && b.owner === me.id) items.push({ k: 'b' + b.id, kind: 'boat', who: G.owner[b.tgt], n: b.troops, cell: b.tgt, o: 1 });
      for (const pl of G.planes) if (!pl.done && pl.owner === me.id) items.push({ k: 'p' + pl.id, kind: 'para', who: G.owner[pl.c], n: pl.troops, cell: pl.c, o: 1 });
      for (const a of G.attacks) if (!a.done && a.troops >= 1 && a.t === me.id) items.push({ k: 'i' + a.id, kind: 'in', id: a.id, who: a.a, n: a.troops, cell: a.focus, o: 2 });
      // "Vrati granice": land a state took from me lately (counted twice a second), unless I am already taking it back
      const now = performance.now();
      if (!this._lost || now - this._lost.t > 500) this._lost = { t: now, m: G.lostTo(me) };
      for (const [x, cells] of this._lost.m) {
        const X = G.P[x];
        if (cells.length < 3 || !X || !X.alive || G.isFriendly(me, X) || G.attacks.some((a) => !a.done && a.only && a.a === me.id && a.t === x)) continue;
        items.push({ k: 'r' + x, kind: 'back', who: x, n: cells.length, cell: cells[cells.length - 1], o: 3 });
      }
    }
    const show = items.slice(0, 10);
    const keep = new Set(show.map((i) => i.k));
    for (const [k, el] of this.chips) {
      if (!keep.has(k)) {
        el.remove();
        this.chips.delete(k);
      }
    }
    for (const it of show) {
      let el = this.chips.get(it.k);
      if (!el) {
        el = document.createElement('div');
        el.className = 'achip ' + it.kind + (it.kind === 'out' ? ' can' : '');
        el.style.order = it.o;
        const ic = it.kind === 'boat' ? 'boat' : it.kind === 'para' ? 'para' : it.kind === 'back' ? 'retreat' : 'attack';
        el.innerHTML = `${RA.icon(ic)}<span class="sw"></span><span class="nm"></span><span class="tr"></span>${it.kind === 'out' ? `<button class="x" aria-label="Obustavi napad">${RA.icon('close')}</button>` : ''}`;
        el.title = it.kind === 'in' ? RA.t("Attack on you") : it.kind === 'out' ? RA.t("Your attack — ✕ stops it") : it.kind === 'back' ? RA.t("Retake: a counter-attack only on the land this state recently took from you") : RA.t("Landing under way");
        bar.appendChild(el);
        this.chips.set(it.k, el);
        el._sw = el.querySelector('.sw');
        el._nm = el.querySelector('.nm');
        el._tr = el.querySelector('.tr');
      }
      el._it = it;
      const O = it.who ? G.P[it.who] : null;
      const col = O ? O.hex : '#8d969c';
      const nm = O ? O.name : RA.t("Free land");
      const tr = it.kind === 'back' ? RA.t("Retake {0} cells", it.n) : RA.fmt(it.n);
      if (el._col !== col) el._sw.style.background = el._col = col;
      if (el._nm.textContent !== nm) el._nm.textContent = nm;
      if (el._tr.textContent !== tr) el._tr.textContent = tr;
    }
    const vis = show.length > 0;
    if (bar.hidden === vis) {
      bar.hidden = !vis;
      document.documentElement.style.setProperty('--att-h', vis ? '46px' : '0px');
    }
  }
  retreatAtt(id) {
    const G = this.G, me = G.me;
    const a = G.attacks.find((x) => x.id === id && !x.done);
    if (!a || !me || a.a !== me.id) return;
    this.act('ret', [id]);
    this.updateChips();
  }

  /* ---------------- actions ----------------
     Every state change goes through act(): single player executes it now, an online game sends it to the
     room and every device executes it at the same tick. afterAct() reports the result to the player who did it. */
  act(kind, args) {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    const net = this.app.net;
    if (G.long) {
      this.app.long.send(kind, JSON.parse(JSON.stringify(args || []))); // the server stamps it with its tick
      return;
    }
    if (G.online && net) {
      net.issue(kind, args || []);
      return;
    }
    if (G.rec) G.rec.cmds.push([G.tick, kind, JSON.parse(JSON.stringify(args || []))]); // for "Nastavi igru"
    this.afterAct(kind, args || [], G.exec(me.id, kind, args || []));
  }
  afterAct(kind, a, r) {
    const G = this.G, me = G.me;
    const say = (k, t) => this.toast(k, t);
    const err = (r2) => typeof r2 === 'string' && r2 !== 'declined';
    if (kind === 'atk') {
      if (r && r.own) {
        if (!this.ownHint) {
          this.ownHint = true;
          this.toast('tip', RA.t("That's your own land. A long press (or right click) opens building and units for that spot."), { ms: 5000 });
        }
      } else if (r && r.err) say('info', RA.esc(r.err));
      else if (r && r.ok === 'boat') say('good', RA.t("Landing under sail: {0} troops.", RA.fmt(r.boat.troops)));
    } else if (kind === 'boat') {
      if (r && typeof r === 'object') say('good', RA.t("Landing under sail: {0} troops.", RA.fmt(r.troops)));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'para') {
      if (r && typeof r === 'object') say('good', RA.t("A plane with {0} paratroopers took off.", RA.fmt(r.troops)));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'build') {
      if (r && typeof r === 'object') {
        const S = RA.STRUCT[r.type];
        say('good', r.type === 'city' ? RA.t("A new city is being built: {0} ({1} s).", RA.esc(r.name), Math.round(S.time / 10)) : RA.t("Building: {0} ({1} s).", S.name, Math.round(S.time / 10)));
      } else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'rec') {
      if (r && typeof r === 'object') say('good', RA.UNIT[r.type].naval ? RA.t("{0} is sailing out of the port ({1} s). Tap it, then the sea, to send it.", RA.UNIT[r.type].name, Math.round(RA.UNIT[r.type].deploy / 10), RA.UNIT[r.type].m ? 'ga' : 'je', RA.UNIT[r.type].m ? 'ga' : 'je') : RA.t("{0}: deploying ({1} s), then it follows the front by itself.", RA.UNIT[r.type].name, Math.round(RA.UNIT[r.type].deploy / 10)));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'mv') {
      if (r === true) {
        const u = me.units.find((x) => x.id === a[0]);
        if (u) this.toast('info', `${RA.UNIT_TXT[u.type].move}.`, { ms: 2500 });
      } else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'dis') {
      if (r && r.type) say('info', RA.t("{0} — {1} troops return to the reserve.", RA.UNIT_TXT[r.type].gone, RA.fmt(RA.UNIT[r.type].troops * 0.6)));
    } else if (kind === 'mis') {
      if (r && typeof r === 'object') {
        const O = r.victim ? G.P[r.victim] : null;
        say('info', O && O !== me ? RA.t("{0} is on its way to: {1}!", RA.MISSILE[r.type].name, RA.esc(O.name)) : RA.t("{0} is on its way!", RA.MISSILE[r.type].name));
      } else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'mob') {
      if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'ret') {
      if (r && typeof r === 'object') {
        const T = r.t ? G.P[r.t] : null;
        say('info', T ? RA.t("Attack on {0} stopped — {1} troops returned (25% lost in the retreat).", RA.esc(T.name), RA.fmt(r.back)) : RA.t("Attack on free land stopped — {0} troops returned.", RA.fmt(r.back)));
      }
    } else if (kind === 'air') {
      if (r && typeof r === 'object') say('good', RA.t("{0}: a new squadron, ready in {1} s.", RA.airName(r.type), Math.round(RA.CFG.AIR_READY / 10)));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'bomb') {
      if (r && typeof r === 'object') say('good', RA.t("{0} took off.", RA.airName('bomber')));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'offer' || kind === 'offerRes') {
      if (r && r.st === 'sent') say('good', RA.t("Offer sent — waiting for an answer (Alliances → Offers)."));
      else if (r && r.st === 'deal') say('good', RA.t("Deal!"));
      else if (err(r)) say('info', RA.esc(r));
      if (!this.$('sheetWrap').hidden && this.$('sheet').querySelector('#dealSheet')) this.closeSheet();
    } else if (kind === 'rsch') {
      if (r && r.k) say('good', RA.t("Research started: {0} {1}.", RA.RSCH[r.k].name, r.lv));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'buy') {
      if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'str') {
      if (r && typeof r === 'object') say(r.closed ? 'bad' : 'good', RA.t("The {0} is {1}.", RA.esc(r.name), r.closed ? RA.t("closed to foreign ships") : RA.t("open again")));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'loan' || kind === 'pay') {
      if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'vas') {
      if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'tax') {
      if (r && typeof r === 'object') say('info', `Porez: ${RA.TAX[r.tax].name}.`);
    } else if (kind === 'rcl') {
      if (r && typeof r === 'object') say('good', RA.t("Retaking: {0} troops go for {1} lost cells ({2}).", RA.fmt(r.att.troops), r.n, RA.esc(G.P[a[0]].name)));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'aReq' || kind === 'tReq') {
      const O = G.P[a[0]];
      if (err(r)) say('info', RA.esc(r));
      else if (r === true && O && O.human && !O.ai) say('info', RA.t("Offer sent — waiting for an answer ({0}).", RA.esc(O.nick || O.name)));
    } else if (kind === 'ext') {
      const O = G.P[a[0]];
      say(r === true ? 'good' : 'info', r === true ? RA.t("Military alliance extended by 5 min ({0}).", RA.esc(O.name)) : RA.esc(r));
    } else if (kind === 'give') {
      const O = G.P[a[0]];
      if (typeof r === 'number') say('good', RA.t("{0} troops sent to an ally ({1}).", RA.fmt(r), RA.esc(O.name)));
      else if (err(r)) say('info', RA.esc(r));
    } else if (kind === 'help') {
      const O = G.P[a[0]];
      if (r && typeof r === 'object') say('ally', RA.t("Call for help sent ({0}) — enemy: {1}.", RA.esc(O.name), RA.esc(r.name)));
      else if (err(r)) say('info', RA.esc(r));
    }
    this.rulerAfterAct(kind, a, r);
    this.updateRequests();
    if (this.redraw && !this.$('sheetWrap').hidden) this.redraw();
  }

  /* ---------------- status pills ---------------- */
  updateStatus() {
    const G = this.G, me = G.me, C = RA.CFG, tk = G.tick;
    const pills = [];
    const T = (t) => RA.dur(Math.max(0, t));
    if (me && me.alive && G.state === 'play') {
      if (G.opts.camp && G.opts.camp.type !== 'free' && this.campProg) pills.push(['goal', `🎯 ${this.campProg}`]);
      if (G.long && this.app.long.rec && this.app.long.rec.set.fast) pills.push(['calm', RA.t("Skirmish · {0} players", G.humans.filter((p) => p.alive && !p.surr).length)]);
      else if (G.long && this.app.long.rec) pills.push(['calm', RA.t("Focus · armies move every {0} s · {1} players", Math.round(this.app.long.rec.tickMs / 1000), G.humans.filter((p) => p.alive).length)]);
      const dc = G.defcon();
      if (dc) {
        const next = (6 - dc) * C.DEFCON_STEP;
        pills.push([dc <= 2 ? 'zone' : 'zone soon', `DEFCON ${dc} · ${RA.DEFCON_NAMES[dc]}${dc > 1 ? RA.t(" · DEFCON {0} in {1}", dc - 1, T(next - tk)) : RA.t(" · ends in {0}", T(C.DEFCON_END - tk))}`]);
        pills.push(['calm', RA.t("Cities and population: {0} points", G.defconScore(me))]);
      } else if (tk < G.peaceUntil) pills.push(['calm', RA.t("☮ Peace time · {0}", T(G.peaceUntil - tk))]);
      else if (tk < G.diff.grace) pills.push(['calm', RA.t("Newcomer protection · {0}", T(G.diff.grace - tk))]);
      const t = tk % C.WINTER_CYCLE, start = C.WINTER_CYCLE - C.WINTER_LEN;
      if (t >= start) pills.push(['winter', `❄ ${RA.mapInfo(G.map.id).winter} · ${T(C.WINTER_CYCLE - t)}`]);
      else if (start - t <= 300) pills.push(['winter soon', RA.t("❄ Winter in {0}", T(start - t))]);
      const Z = G.zone;
      if (Z) {
        if (Z.state === 'shrink') pills.push(['zone', RA.t("☢ Zone shrinking · {0}", T(Z.t0 + Z.shrinkT - tk))]);
        else if (Z.state === 'final') pills.push(['zone soon', RA.t("☢ Last circle")]);
        else pills.push(['zone soon', RA.t("☢ Zone {0}/{1} in {2}", Z.phase + 1, C.BR_PHASES, T(Z.shrinkAt - tk))]);
      }
      const A = RA.MISSILE.atom;
      if (!A.na && A.from && tk < A.from && tk > A.from - 1800) pills.push(['calm', RA.t("☢ Atomic bomb in {0}", T(A.from - tk))]);
      if (me.crisisUntil > tk) pills.push(['bad', RA.t("Capital crisis · {0}", T(me.crisisUntil - tk))]);
      if (me.traitorUntil > tk) pills.push(['bad', `Izdajnik: pola odbrane · ${T(me.traitorUntil - tk)}`]);
      if (me.growPause > tk) pills.push(['mob', RA.t("Mobilisation: no growth · {0}", T(me.growPause - tk))]);
    }
    const net = this.app.net;
    if (G.online && net && net.inGame) {
      const others = G.humans.filter((p) => p !== me);
      const gone = (p) => net.role === 'host' ? net.guestInfo[p.slot] && (net.guestInfo[p.slot].goneAt || net.guestInfo[p.slot].ai) : net.hostGoneAt && p.slot === 0;
      for (const p of others) pills.push([gone(p) ? 'bad' : 'mob', `${gone(p) ? '⚠' : '●'} ${p.nick}${!p.alive ? ' (pao)' : ''}`]);
      if (net.role === 'host' && net.waiting) pills.push(['calm', RA.t("Waiting for a friend…")]);
      if (net.role === 'guest' && net.hostPz) pills.push(['calm', RA.t("Paused (host)")]);
    }
    const key = pills.map((p) => p.join(':')).join('|');
    if (key === this.statusKey) return;
    this.statusKey = key;
    this.$('status').innerHTML = pills.map(([c, t]) => `<span class="pill ${c}">${RA.esc(t)}</span>`).join('');
  }

  tips() {
    const G = this.G;
    if (!G.me || !G.me.alive || this.noTips) return;
    const t = G.tick / 10;
    const peace = G.peaceUntil / 10;
    const U = RA.UNIT, S = RA.STRUCT;
    const T = [
      [1, G.borders
        ? (peace > 0 ? RA.t("Peace time ({0} s): nobody may attack states. Build, make alliances (the “Alliances” button) and get your army ready along the border.", Math.round(peace)) : RA.t("Click the part of a neighbouring state you want: the army goes from the nearest border straight there and takes only that part. On a computer, drag an arrow with the right mouse button for an exact direction. An attack along the whole border: right click / long press → “Attack the whole border”."))
        : peace > 0
        ? RA.t("Peace time ({0} s): nobody may attack states. Take as much free (grey) land as you can and make military and trade alliances (the “Alliances” button).", Math.round(peace))
        : RA.t("Tap grey, free land to expand. The front moves towards the spot you tap.")],
      [9, G.borders ? RA.t("The attack heads for the point you tap, and the “Attack strength” slider sets how many troops you send.") : RA.t("Tap free land to expand — the front heads for the point you tap. The slider sets how many troops you send.")],
      [22, RA.t("The army grows fastest when the bar is in the green zone (about 42% of capacity). Don't keep it full.")],
      [45, RA.t("Active attacks are above the bottom bar. ✕ stops an attack and brings the troops back (from a state, with a 25% loss).")],
      [70, RA.t("A long press (or right click) on the map opens a menu for that spot: building, units, alliances, {0}.", RA.ERA.strikeTab.toLowerCase())],
      [100, RA.t("Army → {0} and {1}: place them along the border — they follow the front and make breakthroughs harder.", U.inf.name, U.tank.name)],
      [140, RA.ERA.road ? RA.t("Build Cities and {0}: caravans carry gold from your cities.", S.factory.name === RA.t("Market") ? RA.t("Markets") : RA.t("Manufactories")) : RA.t("Build Cities and Factories: a factory links cities by rail, and trains bring gold.")],
      [185, RA.t("Military alliance = common defence and help in war. Trade pact = only gold. Both are under “Alliances”.")],
      [230, RA.t("In winter snow covers the north: attacks over snow are slower and costlier.")],
    ];
    for (const [at, txt] of T) {
      if (t >= at && !this.tipsShown.has(at)) {
        this.tipsShown.add(at);
        if (at === 9 && peace <= 0) continue; // same as the first tip
        this.toast('tip', txt, { ms: 8000 });
        break;
      }
    }
  }

  /* ---------------- modes ---------------- */
  selUnit() {
    const G = this.G, m = this.mode;
    if (!m || m.kind !== 'unit' || !G.me) return null;
    return G.me.units.find((u) => u.id === m.id && !u.dead) || null;
  }
  /* a group of my units (long press on a unit, then taps on more): mode {kind: 'group', ids, move} */
  groupUnits() {
    const G = this.G, m = this.mode;
    if (!m || m.kind !== 'group' || !G.me) return [];
    return G.me.units.filter((u) => !u.dead && m.ids.includes(u.id));
  }
  groupStart(u) {
    const m = this.mode;
    const ids = m && m.kind === 'unit' && m.id !== u.id ? [m.id, u.id] : [u.id];
    this.setMode({ kind: 'group', ids, move: false });
  }
  /* where unit u goes when sent to cell c: my nearest land, or the sea for a ship (-1: nowhere) */
  unitTarget(u, c) {
    const G = this.G, me = G.me;
    if (c < 0) return -1;
    if (RA.UNIT[u.type].naval) return G.seaFor(c, me.id) ? c : G._bfs(c, () => true, (n) => G.seaFor(n, me.id) && !G.map.block[n], 400);
    return this.nearestOwn(c, 4000);
  }
  /* send the group to c in a line across the way they go (the order along the line kept, so nobody crosses) */
  groupMove(us, c) {
    const G = this.G, W = G.map.W, tx = c % W, ty = (c / W) | 0;
    let cx = 0, cy = 0;
    for (const u of us) (cx += u.x), (cy += u.y);
    cx /= us.length;
    cy /= us.length;
    let dx = tx - cx, dy = ty - cy;
    const d = Math.hypot(dx, dy);
    if (d < 1) (dx = 0), (dy = 1);
    else (dx /= d), (dy /= d);
    const px = -dy, py = dx, gap = 3;
    const order = us.slice().sort((a, b) => (a.x - cx) * px + (a.y - cy) * py - ((b.x - cx) * px + (b.y - cy) * py));
    let sent = 0;
    order.forEach((u, i) => {
      const k = (i - (order.length - 1) / 2) * gap;
      const x = Math.round(tx + px * k), y = Math.round(ty + py * k);
      const cell = x >= 0 && y >= 0 && x < W && y < G.map.H ? y * W + x : c;
      const t = this.unitTarget(u, cell) >= 0 ? this.unitTarget(u, cell) : this.unitTarget(u, c);
      if (t >= 0) this.act('mv', [u.id, t]), sent++;
    });
    return sent;
  }
  setMode(m) {
    this.mode = m;
    document.getElementById('app').classList.toggle('aiming', !!m); // taps go through toasts to the map (style.css)
    const bar = this.$('modeBar');
    ['aArmy', 'aBuild', 'aLand', 'aStrike'].forEach((id) => this.$(id).classList.remove('on'));
    const ex = this.$('modeExtra');
    ex.hidden = true;
    ex.classList.remove('fire');
    if (!m) {
      bar.hidden = true;
      return;
    }
    let txt = '', btn = null;
    if (m.kind === 'build') {
      txt = m.type === 'city' ? RA.t("Tap your land (at least 5 cells from other cities): a new city") : RA.t("Tap your land: {0}", RA.STRUCT[m.type].name);
      btn = 'aBuild';
    } else if (m.kind === 'boat') {
      txt = RA.t("Tap a foreign or free coast — the ship sails there");
      btn = 'aLand';
    } else if (m.kind === 'para') {
      txt = RA.t("Tap a target for paratroopers (up to {0} cells from an airfield)", RA.CFG.PARA_RANGE);
      btn = 'aLand';
    } else if (m.kind === 'missile') {
      const G = this.G, M = RA.MISSILE[m.type];
      const rad = M.kind === 'nuke' ? M.r2 : M.kind === 'mirv' ? M.spread : M.r;
      if (m.aim >= 0) {
        const O = G.owner[m.aim] ? G.P[G.owner[m.aim]] : null;
        const who = O ? (O === G.me ? RA.t("YOUR land!") : O.name + (G.me.allies.has(O.id) ? ' (saveznik!)' : '')) : RA.t("free land");
        const far = M.range && !G.strikeSilo(G.me, m.type, m.aim, true);
        txt = RA.t("{0} → {1} · {2}-cell radius · {3}{4}{5}", M.name, who, rad, RA.fmt(G.missileCost(m.type, G.me)), far ? RA.t(" · OUT OF RANGE ({0} cells)", M.range) : '', this.samCovers(m.aim) ? RA.t(" · {0} can shoot it down", RA.STRUCT.sam.short || RA.t("air defence")) : '');
        ex.textContent = RA.t("Launch");
        ex.classList.add('fire');
        ex.hidden = false;
      } else txt = RA.t("{0}{1} ({2}-cell radius{3})", m.fired ? RA.t("{0} sent · tap the next target or Cancel — ", m.fired) : RA.t("Tap a target: "), M.name, rad, M.range ? RA.t(", range {0} cells", M.range) : '');
      btn = 'aStrike';
    } else if (m.kind === 'bomb') {
      txt = RA.t("Tap enemy land: {0}", RA.airName('bomber'));
      btn = 'aLand';
    } else if (m.kind === 'recruit') {
      txt = RA.t("Tap your land near the border: {0}", RA.UNIT[m.type].name);
      btn = 'aArmy';
    } else if (m.kind === 'group') {
      const us = this.groupUnits();
      if (!us.length) {
        this.mode = null;
        bar.hidden = true;
        return;
      }
      txt = m.move ? RA.t("Tap where the {0} units should go — they line up there", us.length) : RA.t("{0} units selected · tap more units, then Move", us.length);
      if (!m.move) {
        ex.textContent = RA.t("Move ({0})", us.length);
        ex.hidden = false;
      }
      btn = 'aArmy';
    } else if (m.kind === 'unit') {
      const u = this.selUnit();
      if (!u) {
        this.mode = null;
        bar.hidden = true;
        return;
      }
      const U = RA.UNIT[u.type];
      txt = RA.t("{0} · {1}% — tap {2}", U.name, Math.round((u.hp / U.hp) * 100), U.naval ? RA.t("the sea") : RA.t("new position"));
      ex.textContent = RA.t("Disband");
      ex.hidden = false;
      btn = 'aArmy';
    }
    if (btn) this.$(btn).classList.add('on');
    this.$('modeText').textContent = txt;
    bar.hidden = false;
  }
  /* is this cell inside a ready hostile air-defence umbrella? */
  samCovers(c) {
    const G = this.G, me = G.me, W = G.map.W, tk = G.tick;
    const x = c % W, y = (c / W) | 0;
    return G.structs.some((s) => !s.dead && s.ready && s.type === 'sam' && s.owner !== me.id && !G.isFriendly(G.P[s.owner], me) && s.cd <= tk && s.empUntil <= tk && Math.hypot(s.x - x, s.y - y) <= G.samR(G.P[s.owner]));
  }
  aimMissile(type, c) {
    const G = this.G, me = G.me;
    const O = G.owner[c] ? G.P[G.owner[c]] : null;
    if (type === 'mirv' && (!O || O === me)) {
      this.toast('info', RA.t("A MIRV targets a state — tap foreign land."));
      return;
    }
    this.setMode({ kind: 'missile', type, aim: c, fired: (this.mode && this.mode.fired) || 0 });
  }
  modeExtra() {
    const m = this.mode;
    if (m && m.kind === 'group') return this.setMode(Object.assign({}, m, { move: true }));
    if (m && m.kind === 'missile' && m.aim >= 0) {
      this.fireMissile(m.type, m.aim);
      return;
    }
    const u = this.selUnit();
    if (u) this.act('dis', [u.id]);
    this.setMode(null);
  }

  /* ---------------- map input ---------------- */
  cellFromLatLng(ll) {
    return this.G.map.cellOfLatLng(ll.lat, ll.lng);
  }
  ping(cp, bad) {
    if (cp) this.pingState = { x: cp.x, y: cp.y, t0: performance.now(), bad };
  }
  /* Match the model footprint; retain a minimum touch target on phones. */
  unitAt(cp) {
    const G = this.G, me = G.me;
    if (!me || !me.units.length || !cp) return null;
    const v = this.app.terr.view();
    const uw = RA.unitSize(v.cell);
    const R = Math.max(22, uw * 0.72);
    let best = null, bd = R * R;
    for (const u of me.units) {
      if (u.dead) continue;
      const pose = this.app.fx.unitMotion ? this.app.fx.unitMotion.get(u) : u;
      const dx = v.ox + pose.x * v.cell - cp.x, dy = v.oy + pose.y * v.cell - cp.y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }
  /* nearest cell of mine to c (search radius grows with limit) */
  nearestOwn(c, limit) {
    const G = this.G, me = G.me;
    if (c < 0) return -1;
    if (G.owner[c] === me.id) return c;
    return G._bfs(c, () => true, (n) => G.owner[n] === me.id, limit || 1500);
  }
  onTap(ll, cp) {
    const G = this.G;
    if (!G) return;
    if (this.eatTap) return void (this.eatTap = false); // the click that ends a long press
    const c = this.cellFromLatLng(ll);
    if (this.editor) return this.editor.tap(c); // the scenario editor (09i-editor.js)
    if (G.state === 'spawn') {
      const res = RA.placeHuman(G, c, this.settings.name || RA.t("You"));
      if (res.err) {
        this.toast('info', RA.esc(res.err));
        this.ping(cp, true);
        return;
      }
      this.ping(cp, false);
      this.spawnPicked(res);
      this.app.terr.updatePalette();
      return;
    }
    if (G.state !== 'play' || !G.me || !G.me.alive) return;
    const me = G.me;
    const m = this.mode;
    // group: tapping my units adds / removes them until Move is pressed
    if (m && m.kind === 'group' && !m.move) {
      const u = this.unitAt(cp);
      if (u) {
        const ids = m.ids.includes(u.id) ? m.ids.filter((i) => i !== u.id) : m.ids.concat(u.id);
        this.setMode(ids.length ? Object.assign({}, m, { ids }) : null);
      } else this.toast('info', RA.t("Tap your units to add them, then press Move."));
      return;
    }
    // tapping one of my units selects it (tap again to deselect)
    if (!m || m.kind === 'unit') {
      const u = this.unitAt(cp);
      if (u) {
        if (m && m.id === u.id) this.setMode(null);
        else this.setMode({ kind: 'unit', id: u.id });
        return;
      }
    }
    if (m) {
      this.modeTap(m, c, cp);
      return;
    }
    if (c >= 0 && G.owner[c] === me.id) {
      this.afterAct('atk', [c], { own: true });
      return;
    }
    if (c < 0 || !G.map.land[c]) {
      this.toast('info', G.map.block[c] ? RA.t("That's outside the chosen region.") : RA.t("That's water. Tap land or a coast."));
      this.ping(cp, true);
      return;
    }
    this.ping(cp, false);
    // a state: a directed thrust from the nearest border to this point; free land: the whole border expands
    this.act('atk', [c, this.ratio, G.owner[c] ? 1 : 0]);
  }
  modeTap(m, c, cp) {
    const G = this.G, me = G.me;
    const fail = (msg) => {
      this.toast('info', RA.esc(msg));
      this.ping(cp, true);
    };
    if (c < 0) return fail(RA.t("Off the map."));
    if (G.map.block[c]) return fail(RA.t("That's outside the chosen region."));
    if (m.kind === 'build') {
      let cc = c;
      if (G.owner[c] !== me.id) {
        const n = this.nearestOwn(c, 40);
        if (n >= 0) cc = n;
      }
      const why = G.canBuild(me, m.type, cc);
      if (typeof why === 'string') return fail(why);
      this.ping(cp, false);
      this.act('build', [m.type, cc]);
      this.setMode(null);
    } else if (m.kind === 'boat') {
      if (!G.map.coast[c]) return fail(G.boatErr(G.map.land[c] ? 'nocoast' : 'water'));
      this.ping(cp, false);
      this.act('boat', [c, this.ratio]);
      this.setMode(null);
    } else if (m.kind === 'para') {
      this.ping(cp, false);
      this.act('para', [c, this.ratio]);
      this.setMode(null);
    } else if (m.kind === 'missile') {
      // first tap aims (blast radius is drawn on the map), a second tap on the same spot or "Lansiraj" fires
      const W = G.map.W;
      // a drone flies at once on a tap (no aiming step), so a swarm is a few quick taps
      if (RA.MISSILE[m.type].kind === 'drone') {
        if (this.fireMissile(m.type, c)) this.ping(cp, false);
        else this.ping(cp, true);
      } else if (m.aim >= 0 && RA.dist((m.aim % W) - (c % W), ((m.aim / W) | 0) - ((c / W) | 0)) <= 1.5) {
        if (this.fireMissile(m.type, m.aim)) this.ping(cp, false);
        else this.ping(cp, true);
      } else this.aimMissile(m.type, c);
    } else if (m.kind === 'bomb') {
      this.ping(cp, false);
      this.act('bomb', [c]);
      this.setMode({ kind: 'bomb', fired: (m.fired || 0) + 1 }); // the next target, until "Odustani"
    } else if (m.kind === 'recruit') {
      const cc = this.nearestOwn(c, 300);
      if (cc < 0) return fail(RA.t("Place the unit on your own land (best near the border)."));
      const why = this.unitWhy(m.type);
      if (why) return fail(why);
      this.ping(cp, false);
      this.act('rec', [m.type, cc]);
      this.setMode(null);
    } else if (m.kind === 'group') {
      const us = this.groupUnits();
      if (!us.length) return this.setMode(null);
      if (!this.groupMove(us, c)) return fail(RA.t("None of your land nearby."));
      this.ping(cp, false);
      this.setMode(null);
    } else if (m.kind === 'unit') {
      const u = this.selUnit();
      if (!u) return this.setMode(null);
      if (RA.UNIT[u.type].naval) {
        // a ship: the sea cell tapped (or the nearest one)
        const w = c < 0 ? -1 : G.seaFor(c, me.id) ? c : G._bfs(c, () => true, (n) => G.seaFor(n, me.id) && !G.map.block[n], 400);
        if (w < 0) return fail(RA.t("Ships sail only on the sea — tap the sea."));
        this.ping(cp, false);
        this.act('mv', [u.id, w]);
        this.setMode(null);
        return;
      }
      const cc = this.nearestOwn(c, 4000);
      if (cc < 0) return fail(RA.t("None of your land nearby."));
      this.ping(cp, false);
      this.act('mv', [u.id, cc]);
      this.setMode(null);
    }
  }
  /* desktop arrow (right-drag): from my land to a state's land = a directed attack along that line */
  arrowDrag(ll0, ll1) {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return (this.arrow = null);
    const s = this.cellFromLatLng(ll0), e = this.cellFromLatLng(ll1);
    const T = e >= 0 ? G.P[G.owner[e]] : null;
    const why = s < 0 || G.owner[s] !== me.id ? RA.t("Drag the arrow from your own land.")
      : !T || T === me ? RA.t("Drag to another state.")
      : G.isFriendly(me, T) ? RA.t("{0} is your ally.", T.name)
      : G.tick < G.peaceUntil ? RA.t("Peace time for another {0}.", G.peaceLeft())
      : !G.hasBorderWith(me, T.id) && !G._viaOf(me, T) ? RA.t("You have no land border with that state ({0}), not even through an ally.", T.name) : '';
    this.arrow = { s, e, ok: !why, why, name: T && T !== me ? T.name : '' };
  }
  arrowDrop() {
    const a = this.arrow;
    this.arrow = null;
    if (!a) return;
    if (!a.ok) {
      this.toast('info', RA.esc(a.why));
      return;
    }
    this.act('atk', [a.e, this.ratio, 1, a.s]);
  }
  onLong(ll, cp) {
    const G = this.G;
    if (!G || G.state !== 'play') return;
    // a long press on one of my units starts a group (then taps add more units, Move sends them)
    const u = G.me && G.me.alive && this.unitAt(cp);
    if (u) return this.groupStart(u);
    this.cellSheet(this.cellFromLatLng(ll));
  }
  onKey(e) {
    const G = this.G;
    if (e.target && ((e.target.tagName === 'INPUT' && e.target.type === 'text') || e.target.tagName === 'SELECT')) return;
    if (e.key === 'Escape') {
      if (!this.$('sheetWrap').hidden) this.closeSheet();
      else this.setMode(null);
      return;
    }
    if (!this.$('sheetWrap').hidden) return;
    if (!G || G.state !== 'play' || !G.me) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      this.app.togglePause();
    } else if (k === '1' || k === '2' || k === '3') {
      if (!this.app.guestLocked()) this.app.setSpeed(+k);
    }
    else if (k === 'q' || k === 'e') {
      const r = this.$('ratio');
      r.value = RA.clamp(+r.value + (k === 'e' ? 5 : -5), 5, 100);
      r.dispatchEvent(new Event('input'));
    } else if (k === 'v') this.armySheet();
    else if (k === 'b') this.buildSheet();
    else if (k === 'd') this.setMode({ kind: 'boat' });
    else if (k === 'p' && RA.ERA.para && G.me.n.airport) this.setMode({ kind: 'para' });
    else if (k === 'r') this.strikeSheet();
    else if (k === 's') this.diploSheet();
    else if (k === 'l') {
      this.showAllies = !this.showAllies;
      this.toast('info', this.showAllies ? RA.t("Alliances on the map: green line military, blue trade pact (L turns it off).") : RA.t("Alliances on the map off."), { ms: 3000 });
    }
    else if (k === 't' && this.G.online) this.quickSheet();
    else if (k === 'g' && this.G.online && this.mouseLL) this.act('png', [this.cellFromLatLng(this.mouseLL), 0]);
    else if (k === 'm') this.act('mob', []);
    else if (k === 'z') this.econSheet();
    else if (k === 'a' && RA.airOn() && G.me.n.airport) this.landSheet();
  }

  /* ---------------- sheet helpers ---------------- */
  openSheet(html, onBind, keepScroll, redraw) {
    if (keepScroll && this.sheetDrag) return;
    this.sheetDrag = null;
    this.redraw = redraw || null;
    const s = this.$('sheet');
    const wasOpen = !this.$('sheetWrap').hidden;
    const focusedId = wasOpen && s.contains(document.activeElement) ? document.activeElement.id : '';
    if (!wasOpen) {
      this.sheetFocus = document.activeElement;
      this.sheetInert = [...this.$('app').children].filter((el) => el !== this.$('sheetWrap')).map((el) => [el, el.inert]);
      for (const [el] of this.sheetInert) el.inert = true;
    }
    const top = keepScroll && wasOpen ? s.scrollTop : 0;
    s.style.translate = '';
    s.classList.remove('sheet-dragging');
    s.innerHTML = `<button class="grab" aria-label="${RA.t("Drag down or press to close")}"></button>` + html;
    s.querySelector('.grab').onclick = () => this.closeSheet();
    this.bindSheetDrag(s);
    s.onclick = null; // a delegated handler belongs to one sheet only (bindDiplo)
    this.$('sheetWrap').hidden = false;
    s.scrollTop = top;
    const cl = s.querySelector('.sh-close');
    if (cl) cl.onclick = () => this.closeSheet();
    if (onBind) onBind(s);
    s.tabIndex = -1;
    const restore = focusedId && document.getElementById(focusedId);
    if (restore && s.contains(restore)) restore.focus({ preventScroll: true });
    else if (!keepScroll || !wasOpen) (cl || s).focus({ preventScroll: true });
    this.app.sheetPause(true);
  }
  closeSheet() {
    this.sheetDrag = null;
    this.$('sheet').style.translate = '';
    this.$('sheet').classList.remove('sheet-dragging');
    this.redraw = null;
    this.$('sheetWrap').hidden = true;
    this.$('sheet').innerHTML = '';
    this.$('sheet').onclick = null;
    if (this.sheetInert) for (const [el, inert] of this.sheetInert) el.inert = inert;
    this.sheetInert = null;
    if (this.sheetFocus && this.sheetFocus.isConnected && this.sheetFocus.getClientRects().length) this.sheetFocus.focus({ preventScroll: true });
    this.sheetFocus = null;
    this.app.sheetPause(false);
  }
  bindSheetDrag(s) {
    if (s.dataset.dragBound) return;
    s.dataset.dragBound = '1';
    s.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.button !== 0) return;
      const grip = e.target.closest('.grab');
      if (!grip && (!e.target.closest('.sh-head') || e.target.closest('button,input,select,a,textarea'))) return;
      this.sheetDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, dy: 0, grip: !!grip };
      s.setPointerCapture(e.pointerId);
    });
    s.addEventListener('pointermove', (e) => {
      const d = this.sheetDrag;
      if (!d || d.id !== e.pointerId) return;
      d.dy = Math.max(0, e.clientY - d.y);
      if (d.dy < 5 && !s.classList.contains('sheet-dragging')) return;
      s.classList.add('sheet-dragging');
      s.style.translate = `0 ${d.dy}px`;
    });
    const end = (e) => {
      const d = this.sheetDrag;
      if (!d || d.id !== e.pointerId) return;
      this.sheetDrag = null;
      if (s.hasPointerCapture(e.pointerId)) s.releasePointerCapture(e.pointerId);
      s.classList.remove('sheet-dragging');
      s.style.translate = '';
      if (e.type === 'pointerup' && ((d.dy > 72 && d.dy > Math.abs(e.clientX - d.x)) || (d.grip && d.dy < 5 && Math.abs(e.clientX - d.x) < 5))) this.closeSheet();
    };
    s.addEventListener('pointerup', end);
    s.addEventListener('pointercancel', end);
    s.addEventListener('lostpointercapture', end);
  }
  head(title, meta, color) {
    return `<div class="sh-head">${color ? `<span class="chip" style="background:${color}"></span>` : ''}<div><h2 id="sheetTitle">${RA.esc(title)}</h2>${meta ? `<div class="meta">${meta}</div>` : ''}</div><button class="sh-close" aria-label="${RA.t("Close")}">${RA.icon('close')}</button></div>`;
  }
  relLabel(v) {
    if (v <= -35) return RA.t("<span class=\"rel hos\">Hostile</span>");
    if (v < -8) return RA.t("<span class=\"rel hos\">Cold</span>");
    if (v > 25) return RA.t("<span class=\"rel fr\">Friendly</span>");
    return RA.t("<span class=\"rel\">Neutral</span>");
  }
  /* a big sheet button; t/d/r are HTML */
  btn(o) {
    return `<button class="btn ${o.cls || ''}" ${o.attrs || ''} ${o.dis ? 'disabled' : ''}>${o.model ? RA.Models.preview(o.model, this.G.me.hex) : o.icon ? RA.icon(o.icon) : ''}<span><span class="t">${o.t}</span>${o.d ? `<br><span class="d">${o.d}</span>` : ''}</span>${o.r ? `<span class="r">${o.r}</span>` : ''}</button>`;
  }
  mini(label, attrs, cls, dis, icon) {
    return `<button class="mini ${cls || ''}" ${attrs} ${dis ? 'disabled' : ''}>${icon ? RA.icon(icon) : ''}${label}</button>`;
  }
};

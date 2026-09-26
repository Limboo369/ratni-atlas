'use strict';
/* Campaign (plan 56): your dynasty from Rome to today. You choose a home (a city) and a name; in every era you rule
   the state that holds your home. 7 chapters × 10 missions (expand, cities, gold, alliances, conquer, defend the
   capital, survive a coalition, win the region…), harder chapter by chapter; missions give experience (XP) for the
   dynasty's tech tree (army, economy, diplomacy, science), whose upgrades last through all eras. Between missions:
   free play in the chapter's era. Progress: localStorage 'ra_campaign' and, signed in, the account (/api/campaign). */
RA.CAMP_HOMES = [
  { id: 'sarajevo', name: 'Sarajevo', map: 'evropa', ll: [43.86, 18.41] }, { id: 'beograd', name: 'Beograd', map: 'evropa', ll: [44.82, 20.46] },
  { id: 'zagreb', name: 'Zagreb', map: 'evropa', ll: [45.81, 15.98] }, { id: 'bec', name: 'Beč', map: 'evropa', ll: [48.21, 16.37] },
  { id: 'budimpesta', name: 'Budimpešta', map: 'evropa', ll: [47.5, 19.04] }, { id: 'rim', name: 'Rim', map: 'evropa', ll: [41.9, 12.5] },
  { id: 'atina', name: 'Atina', map: 'evropa', ll: [37.98, 23.73] }, { id: 'istanbul', name: 'Istanbul', map: 'evropa', ll: [41.01, 28.97] },
  { id: 'pariz', name: 'Pariz', map: 'evropa', ll: [48.86, 2.35] }, { id: 'london', name: 'London', map: 'evropa', ll: [51.5, -0.12] },
  { id: 'berlin', name: 'Berlin', map: 'evropa', ll: [52.52, 13.4] }, { id: 'madrid', name: 'Madrid', map: 'evropa', ll: [40.42, -3.7] },
  { id: 'varsava', name: 'Varšava', map: 'evropa', ll: [52.23, 21.01] }, { id: 'stokholm', name: 'Stokholm', map: 'evropa', ll: [59.33, 18.07] },
  { id: 'moskva', name: 'Moskva', map: 'evropa', ll: [55.75, 37.62] },
  { id: 'kairo', name: 'Kairo', map: 'svijet', ll: [30.04, 31.24] }, { id: 'teheran', name: 'Teheran', map: 'svijet', ll: [35.69, 51.39] },
  { id: 'delhi', name: 'Delhi', map: 'svijet', ll: [28.61, 77.21] }, { id: 'peking', name: 'Peking', map: 'svijet', ll: [39.9, 116.4] },
  { id: 'tokio', name: 'Tokio', map: 'svijet', ll: [35.68, 139.69] }, { id: 'vasington', name: 'Vašington', map: 'svijet', ll: [38.9, -77.04] },
  { id: 'meksiko', name: 'Meksiko', map: 'svijet', ll: [19.43, -99.13] }, { id: 'buenosaires', name: 'Buenos Aires', map: 'svijet', ll: [-34.6, -58.38] },
  { id: 'lagos', name: 'Lagos', map: 'svijet', ll: [6.52, 3.38] },
];
/* the ten missions of a chapter (the same kinds in every era, harder each chapter); par = minutes for 3 stars */
RA.CAMP_KINDS = [
  { type: 'expand', par: 8 }, { type: 'cities', par: 10 }, { type: 'gold', par: 8 }, { type: 'allies', par: 8 }, { type: 'conquerWeak', par: 12 },
  { type: 'defend', par: 8 }, { type: 'conquerStrong', par: 18 }, { type: 'survive', par: 10 }, { type: 'expand40', par: 20 }, { type: 'win', par: 30 },
];
RA.CAMPAIGN = [
  { era: 'rim', name: 'I. Uspon', diff: 'lako', intro: 'Rimsko doba. Tvoja porodica drži malo zemlje i mnogo ambicija.',
    titles: ['Prve međe', 'Grad na brdu', 'Blago za legije', 'Savez plemena', 'Mali susjed', 'Opsada prijestolnice', 'Veliki rival', 'Sva plemena protiv nas', 'Pola regije', 'Gospodar regije'] },
  { era: 'srednji', name: 'II. Krune i mačevi', diff: 'lako', intro: 'Srednji vijek. Dinastija nosi krunu — sad je treba sačuvati.',
    titles: ['Nova feuda', 'Tvrđave i trgovišta', 'Kraljevska riznica', 'Vazali i saveznici', 'Pohod na komšiju', 'Zidine drže', 'Kruna protiv krune', 'Križari na vratima', 'Carstvo u nastajanju', 'Kralj kraljeva'] },
  { era: 'napoleon', name: 'III. Doba revolucija', diff: 'srednje', intro: '1815. Carstva se ruše, granice se crtaju iznova.',
    titles: ['Nove granice', 'Manufakture', 'Ratna blagajna', 'Kongres saveznika', 'Brzi pohod', 'Odbrana prijestolnice', 'Bitka naroda', 'Koalicija protiv nas', 'Dominacija', 'Car Evrope'] },
  { era: 'ww1', name: 'IV. Veliki rat', diff: 'srednje', intro: '1914. Rovovi, cepelini i prvi tenkovi.',
    titles: ['Mobilizacija', 'Industrija rata', 'Ratni zajmovi', 'Antanta ili sila', 'Ultimatum', 'Nijedan korak nazad', 'Proboj fronta', 'Svi frontovi', 'Pobjeda na istoku', 'Mir po našim uslovima'] },
  { era: 'ww2', name: 'V. Svjetski požar', diff: 'srednje', intro: '1938. Avioni, tenkovi i atom na horizontu.',
    titles: ['Lebensraum komšija', 'Fabrike rade', 'Zlato za front', 'Osovina i saveznici', 'Munjeviti rat', 'Opsada', 'Glavni neprijatelj', 'Cijeli kontinent protiv nas', 'Tvrđava kontinent', 'Kraj rata'] },
  { era: 'hladni', name: 'VI. Hladni rat', diff: 'tesko', intro: '1960. Blokovi, rakete i ravnoteža straha.',
    titles: ['Zona uticaja', 'Petogodišnji plan', 'Svemirski budžet', 'Pakt', 'Posrednički rat', 'Kriza oko prijestolnice', 'Supersila protiv supersile', 'Svi protiv bloka', 'Hegemonija', 'Kraj hladnog rata'] },
  { era: 'danas', name: 'VII. Novi svijet', diff: 'tesko', intro: 'Danas. Dronovi, sankcije i stare granice u novom ruhu.',
    titles: ['Nova politika', 'Pametni gradovi', 'Fond budućnosti', 'Savez sigurnosti', 'Specijalna operacija', 'Protivvazdušni štit', 'Veliki igrač', 'Sankcije i blokade', 'Regionalna sila', 'Dinastija zauvijek'] },
];
RA.campMission = (ch, i) => ({ id: ch * 10 + i, ch, i, ...RA.CAMP_KINDS[i], title: RA.CAMPAIGN[ch].titles[i], era: RA.CAMPAIGN[ch].era, diff: RA.CAMPAIGN[ch].diff });
RA.campGoalText = function (m) {
  return {
    expand: 'Proširi svoju zemlju za 60% (bar 5 poena udjela regije).',
    cities: 'Imaj 3 grada više nego na početku (osvoji ih ili izgradi).',
    gold: 'Skupi veliku riznicu (cilj vidiš gore na ekranu).',
    allies: 'Imaj istovremeno 2 vojna i 2 trgovinska saveza.',
    conquerWeak: 'Pokori najslabijeg susjeda (označen je na početku).',
    defend: 'Najjači susjed ide na tvoju prijestolnicu: sačuvaj je 8 minuta.',
    conquerStrong: 'Pokori najjačeg susjeda.',
    survive: 'Svi susjedi su se udružili protiv tebe: preživi 10 minuta.',
    expand40: 'Drži 40% kopna regije.',
    win: 'Pobijedi: 70% kopna regije.',
  }[m.type];
};

Object.assign(RA.UI.prototype, {
  campLoad() {
    if (this.camp) return this.camp;
    try {
      this.camp = JSON.parse(localStorage.getItem('ra_campaign') || 'null');
    } catch (_) {}
    return this.camp;
  },
  campSave() {
    const c = this.camp;
    if (!c) return;
    c.at = Date.now();
    try {
      localStorage.setItem('ra_campaign', JSON.stringify(c));
    } catch (_) {}
    const acc = this.account;
    if (acc && acc.user) fetch('/api/campaign', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) }).catch(() => {});
  },
  /* the account's copy wins when it is newer (another computer) */
  async campSync() {
    const acc = this.account;
    if (!acc || !acc.user) return;
    try {
      const r = await fetch('/api/campaign', { credentials: 'same-origin' });
      const j = r.ok ? await r.json() : null;
      const c = j && j.campaign;
      if (c && c.home && (!this.campLoad() || (c.at || 0) > (this.camp.at || 0))) {
        this.camp = c;
        try {
          localStorage.setItem('ra_campaign', JSON.stringify(c));
        } catch (_) {}
      }
    } catch (_) {}
  },
  campXpFree(c) {
    const spent = Object.values(c.tree).reduce((n, l) => n + (150 * l * (l + 1)) / 2, 0);
    return c.xp - spent;
  },
  /* the campaign screen: new campaign (home + dynasty), or chapters, missions and the tech tree */
  async campaignSheet() {
    await this.campSync();
    const c = this.campLoad();
    if (!c || !c.home) return this.campNew();
    const home = RA.CAMP_HOMES.find((h) => h.id === c.home) || RA.CAMP_HOMES[0];
    const free = this.campXpFree(c), done = c.done || {};
    let h = this.head(`Kampanja: dinastija ${c.name}`, `Dom: ${RA.esc(home.name)} · iskustvo ${c.xp} (slobodno ${free}) · misija ${Object.keys(done).length}/70`);
    h += `<span class="campaign-marker" hidden></span><div class="dynasty-banner"><div class="dynasty-seal" aria-hidden="true">${RA.icon('flag')}</div><div><span>NASLIJEĐE KROZ SEDAM DOBA</span><h3>${RA.esc(c.name)}</h3><p>${RA.esc(home.name)} · ${Object.keys(done).length} od 70 misija završeno</p></div><div class="dynasty-xp"><b>${free}</b><span>slobodno XP</span></div></div>`;
    if (home.map !== 'evropa'  && !(this.app.mapOK && this.app.mapOK[home.map])) h += '<p class="note"><b>Karta svijeta</b> se učitava sa servera (war.deovilab.com).</p>';
    h += '<div class="sec-t">Tehnološko stablo dinastije</div><p class="explain">Iskustvo iz misija ulažeš ovdje; poboljšanja važe u svim dobima.</p><div class="research-grid">';
    for (const [k, T] of Object.entries(RA.CAMP_TREE)) {
      const l = c.tree[k] || 0, cost = 150 * (l + 1);
      h += `<article class="research-card" data-branch="${k}"><div class="research-heading"><i>${RA.icon(({mil:'army',eco:'market',dip:'ally',sci:'factory'})[k])}</i><span>${T.name}<small>Nivo ${l} / 5</small></span></div>${this.techProgress(l)}<p>${T.desc}</p>${l<5 ? this.mini(`Unaprijedi · ${cost} XP`, `data-tree="${k}"`, 'ok', free<cost) : '<span class="research-max">Potpuno razvijeno</span>'}</article>`;
    }
    h += '</div>';
    RA.CAMPAIGN.forEach((ch, ci) => {
      const open = ci === 0 || done[ci * 10 - 1] !== undefined;
      h += `<div class="campaign-chapter${open?'':' is-locked'}"><span class="chapter-number">${String(ci+1).padStart(2,'0')}</span><div><h3>${RA.esc(ch.name)}</h3><span>${RA.esc(RA.eraById(ch.era).name)}</span></div><small>${open?'Otključano':'Zaključano'}</small></div>`;
      if (!open) return;
      h += `<p class="explain">${RA.esc(ch.intro)}</p><div class="list">`;
      for (let i = 0; i < 10; i++) {
        const m = RA.campMission(ci, i), st = done[m.id], avail = i === 0 ? true : done[m.id - 1] !== undefined;
        const stars = st !== undefined ? '★'.repeat(st) + '☆'.repeat(3 - st) : '';
        h += `<div class="camp-row${avail ? '' : ' locked'}"><span class="mission-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div><div class="cr-t">${RA.esc(m.title)} ${stars ? `<span class="cr-s">${stars}</span>` : ''}</div><div class="cr-d">${RA.esc(RA.campGoalText(m))}</div></div><div class="cr-b">${avail ? this.mini(st !== undefined ? 'Ponovi' : 'Igraj', `data-mis="${m.id}"`, st !== undefined ? '' : 'ok') : '🔒'}</div></div>`;
      }
      h += `</div><div class="btns">${this.btn({ icon: 'flag', attrs: `data-free="${ci}"`, t: 'Slobodna igra u ovom dobu', d: 'Bez cilja, s poboljšanjima dinastije' })}</div>`;
    });
    h += `<p class="note"><button class="mini warn" data-reset>Nova kampanja</button></p>`;
    this.openSheet(h, (s) => {
      s.querySelectorAll('[data-tree]').forEach((b) => (b.onclick = () => {
        const k = b.dataset.tree, l = c.tree[k] || 0;
        if (this.campXpFree(c) < 150 * (l + 1) || l >= 5) return;
        c.tree[k] = l + 1;
        this.campSave();
        this.campaignSheet();
      }));
      s.querySelectorAll('[data-mis]').forEach((b) => (b.onclick = () => this.campPlay(+b.dataset.mis)));
      s.querySelectorAll('[data-free]').forEach((b) => (b.onclick = () => this.campPlay(-1 - +b.dataset.free)));
      const r = s.querySelector('[data-reset]');
      if (r) r.onclick = () => this.confirm('Nova kampanja?', 'Sav napredak ove dinastije se briše.', 'Obriši i počni', () => {
        this.camp = null;
        try {
          localStorage.removeItem('ra_campaign');
        } catch (_) {}
        this.campNew();
      });
    });
  },
  campNew() {
    const world = !!(this.app.mapOK && this.app.mapOK.svijet);
    let h = this.head('Nova kampanja', 'Tvoja dinastija od Rima do danas') + '<span class="campaign-marker" hidden></span>';
    h += '<p class="explain">Izaberi dom dinastije: u svakom dobu vodiš državu koja drži taj grad. Sedam poglavlja po deset misija; iskustvo ulažeš u tehnološko stablo.</p>';
    h += `<div class="field"><span class="lab">Ime dinastije</span><input type="text" id="campName" class="sel" maxlength="18" value="${RA.esc(this.settings.name || 'Kotromanić')}"></div>`;
    const col0 = RA.PLAYER_COLORS.includes(this.settings.color) ? this.settings.color : RA.PLAYER_COLORS[0];
    h += `<div class="field"><span class="lab">Boja dinastije (ista u svakom dobu)</span><div class="seg wrap swatches" id="campColor">${RA.PLAYER_COLORS.map((c) => `<button data-v="${c}" aria-pressed="${c === col0}" aria-label="Boja ${c}" style="--sw:${c}"><span></span></button>`).join('')}</div></div>`;
    h += '<div class="sec-t">Dom dinastije</div><div class="campaign-homes qm-grid">';
    for (const hm of RA.CAMP_HOMES) {
      const ok = hm.map === 'evropa' || world;
      h += `<button class="btn" data-home="${hm.id}" ${ok ? '' : 'disabled title="Karta svijeta je samo na war.deovilab.com"'}><span class="t">${RA.esc(hm.name)}</span>${hm.map === 'svijet' ? '<br><span class="d">svijet</span>' : ''}</button>`;
    }
    h += '</div>';
    let col = col0;
    this.openSheet(h, (s) => {
      s.querySelectorAll('#campColor button').forEach((b) => (b.onclick = () => {
        col = b.dataset.v;
        s.querySelectorAll('#campColor button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }));
      s.querySelectorAll('[data-home]').forEach((b) => (b.onclick = () => {
      const nm = (s.querySelector('#campName').value || '').trim().slice(0, 18) || 'Kotromanić';
      this.camp = { v: 1, home: b.dataset.home, name: nm, color: col, xp: 0, tree: { mil: 0, eco: 0, dip: 0, sci: 0 }, done: {} };
      this.campSave();
      this.campaignSheet();
    }));
    });
  },
  /* the ruler of the dynasty in this mission: "Kotromanić VII" (one more for every mission finished) */
  campRuler(c) {
    const n = Object.keys(c.done || {}).length + 1;
    const rom = (v) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [k, r]) => {
      while (v >= k) (s += r), (v -= k);
      return s;
    }, '');
    return `${c.name} ${rom(n)}`;
  },
  /* the region of the home: the smallest part of the map that contains it */
  campRegion(map, cell) {
    const regs = RA.regionsOf(map.id).filter((r) => r.poly);
    let best = null, bestN = 1e18;
    for (const r of regs) {
      const gm = RA.regionMap(map, r.id);
      if (gm.block[cell]) continue;
      const n = r.box ? (r.box[2] - r.box[0]) * (r.box[3] - r.box[1]) : 1e9;
      if (n < bestN) {
        bestN = n;
        best = r.id;
      }
    }
    return best || map.id;
  },
  /* play mission id (or free play: -1 - chapter) */
  campPlay(id) {
    const c = this.campLoad(), home = RA.CAMP_HOMES.find((h) => h.id === c.home);
    const ch = id >= 0 ? Math.floor(id / 10) : -1 - id, m = id >= 0 ? RA.campMission(ch, id % 10) : { id, ch, type: 'free', era: RA.CAMPAIGN[ch].era, diff: RA.CAMPAIGN[ch].diff, title: 'Slobodna igra' };
    const app = this.app;
    this.closeSheet();
    if (!app.mapReady(home.map, m.era)) return app.withMap(home.map, m.era, () => this.campPlay(id));
    app.startMission(home, m, c);
  },
  /* every second in a mission: the goal's progress, success or failure */
  campTick() {
    const G = this.G, me = G && G.me, C = G && G.opts.camp;
    if (!C || C.type === 'free' || !G.camp || !me || this.campOver || G.state === 'spawn') return;
    const mins = (G.tick - G.camp.t0) / 600, share = me.area / G.landTotal(), T = G.P[G.camp.target];
    let ok = false, fail = !me.alive, prog = '';
    switch (C.type) {
      case 'expand': {
        const goal = Math.min(0.69, Math.max(G.camp.share0 * 1.6, G.camp.share0 + 0.05)); // a big state: +5 points, never past victory
        ok = share >= goal;
        prog = `${(share * 100).toFixed(1)}% / ${(goal * 100).toFixed(1)}% kopna`;
        break;
      }
      case 'expand40':
        ok = share >= 0.4;
        prog = `${(share * 100).toFixed(1)}% / 40% kopna`;
        break;
      case 'cities': {
        const n = G.campCities(me), goal = G.camp.cities0 + 3;
        ok = n >= goal;
        prog = `${n} / ${goal} gradova`;
        break;
      }
      case 'gold': {
        if (!G.camp.goldGoal) G.camp.goldGoal = Math.round(Math.max(600000, (me.goldRate || 1000) * 150) / 10000) * 10000;
        ok = me.gold >= G.camp.goldGoal;
        prog = `${RA.fmt(me.gold)} / ${RA.fmt(G.camp.goldGoal)} zlata`;
        break;
      }
      case 'allies': {
        const a = G.allyCount(me), t = me.trade.size;
        ok = a >= 2 && t >= 2;
        prog = `vojni ${a}/2 · trgovinski ${t}/2`;
        break;
      }
      case 'conquerWeak':
      case 'conquerStrong':
        ok = !T || !T.alive;
        prog = T ? `${T.name}: ${((T.area / G.landTotal()) * 100).toFixed(1)}% kopna` : '';
        break;
      case 'defend': {
        const cap = me.capCity >= 0 ? G.cities[me.capCity] : null;
        fail = fail || (cap && cap.owner !== me.id);
        ok = !fail && mins >= 8;
        prog = `prijestolnica drži · ${RA.fmtTime(Math.max(0, (8 - mins) * 60))}`;
        break;
      }
      case 'survive':
        ok = me.alive && mins >= 10;
        prog = `preživi još ${RA.fmtTime(Math.max(0, (10 - mins) * 60))}`;
        break;
      case 'win':
        ok = G.winner === me;
        prog = `${(share * 100).toFixed(1)}% / 70% kopna`;
        break;
    }
    if (G.winner === me) ok = true;
    if (G.state === 'over' && G.winner !== me && !ok) fail = true;
    this.campProg = prog;
    if (ok) this.campEnd(true, mins);
    else if (fail) this.campEnd(false, mins);
  },
  campEnd(won, mins) {
    const G = this.G, C = G.opts.camp, c = this.campLoad();
    this.campOver = true;
    this.app.paused = true;
    this.app.updatePauseBtn();
    this.app.dropSave(G.rec && G.rec.gid);
    const m = RA.campMission(Math.floor(C.mid / 10), C.mid % 10);
    let h;
    if (won) {
      const stars = mins <= m.par ? 3 : mins <= m.par * 1.6 ? 2 : 1;
      const first = c.done[m.id] === undefined, xp = first ? (80 + 25 * m.ch) * stars : Math.max(0, stars - (c.done[m.id] || 0)) * (80 + 25 * m.ch);
      c.done[m.id] = Math.max(c.done[m.id] || 0, stars);
      c.xp += xp;
      this.campSave();
      this.audio.play('win');
      h = this.head('Misija uspješna!', `${RA.esc(m.title)} · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${RA.fmtTime(mins * 60)}`) + `<p class="explain">Dinastija ${RA.esc(c.name)} dobija <b>+${xp} iskustva</b>. ${m.i === 9 ? 'Poglavlje je završeno — otvoreno je sljedeće doba!' : ''}</p>`;
    } else {
      this.audio.play('lose');
      h = this.head('Misija neuspješna', RA.esc(m.title)) + '<p class="explain">Pokušaj ponovo — možda s drugačijom strategijom ili nakon ulaganja u stablo.</p>';
    }
    h += `<div class="btns">${this.btn({ icon: 'flag', cls: 'primary', attrs: 'data-camp', t: 'Kampanja', d: 'Poglavlja, misije i stablo' })}${won ? this.btn({ icon: 'play', attrs: 'data-cont', t: 'Nastavi igrati ovu kartu', d: 'Bez cilja' }) : this.btn({ icon: 'play', attrs: 'data-retry', t: 'Pokušaj ponovo' })}</div>`;
    this.openSheet(h, (s) => {
      s.querySelector('[data-camp]').onclick = () => {
        this.app.showStart();
        this.campaignSheet();
      };
      const cn = s.querySelector('[data-cont]');
      if (cn) cn.onclick = () => {
        G.opts.camp.type = 'free';
        this.closeSheet();
        this.app.paused = false;
        this.app.updatePauseBtn();
      };
      const rt = s.querySelector('[data-retry]');
      if (rt) rt.onclick = () => this.campPlay(m.id);
    });
  },
});

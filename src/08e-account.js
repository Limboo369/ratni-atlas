'use strict';
/* Overtake account and player profile: Google sign-in through the accounts API (deploy/api, /api/ on our own server),
   then a profile with emblem, name, status (rank by wins), statistics, achievements, match history and leaderboard.
   Only on our server: on file:// or a host without /api/me the account buttons stay hidden and nothing else changes.
   Google Identity Services is loaded only when the player opens the sign-in sheet. */

// profile emblems (ids must match ICONS in deploy/api/server.js); 'google' = the Google profile picture
RA.EMBLEMS = {
  stit: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 7v10M8 11h8"/>',
  mac: '<path d="M19 3l-9.5 9.5M19 3h-4M19 3v4M9.5 12.5l-3 3M5 14l5 5M4.5 19.5l2-2"/>',
  kruna: '<path d="M3.5 18h17M4.5 18L3 8l5 4 4-7 4 7 5-4-1.5 10"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/>',
  orao: '<path d="M12 7c-1.4 0-2.3 1-2.3 2.3L3 7.5l2.6 4.3L3 13.7h5l1.2 3L12 20l2.8-3.3 1.2-3h5l-2.6-1.9L21 7.5l-6.7 1.8C14.3 8 13.4 7 12 7z"/>',
  tvrdjava: '<path d="M4 21V9h3V6h2v3h2V6h2v3h2V6h2v3h3v12zM10 21v-4a2 2 0 0 1 4 0v4"/>',
  sidro: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M4 13a8 8 0 0 0 16 0"/>',
  tenk: '<path d="M3 16h18l-2 4H5zM6 16v-4h10v4M16 13.5h5"/>',
  raketa: '<path d="M12 2.5c2.6 2.2 4 5.4 4 9.2V17H8v-5.3c0-3.8 1.4-7 4-9.2z"/><path d="M8 12.5l-3 3.2V19l3-2M16 12.5l3 3.2V19l-3-2M10.5 20.5h3"/>',
  zastava: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  zvijezda: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  kaciga: '<path d="M4 16a8 8 0 0 1 16 0zM2.5 16h19M12 8V4.5"/>',
  avion: '<path d="M10.6 3.6a1.4 1.4 0 0 1 2.8 0V9l7.6 4.6v2.1l-7.6-2.3v4.4l2.1 1.6v1.7L12 20.1l-3.5 1v-1.7l2.1-1.6v-4.4L3 15.7v-2.1L10.6 9z"/>',
  atom: '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"/>',
};
RA.emblem = (who, cls) => {
  const c = 'emb' + (cls ? ' ' + cls : '');
  if (who && who.icon === 'google' && /^https:\/\//.test(who.pic || '')) return `<span class="${c}"><img src="${RA.esc(who.pic)}" alt="" referrerpolicy="no-referrer" loading="lazy"></span>`;
  const d = RA.EMBLEMS[(who && who.icon) || 'stit'] || RA.EMBLEMS.stit;
  return `<span class="${c}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg></span>`;
};

RA.Account = class {
  constructor(ui) {
    this.ui = ui;
    this.user = null;
    this.google = '';
    this.ok = false; // an accounts server answered
    this.gsiInit = false;
    this.sent = new Set(); // game ids already reported
    this.stats = null;
    const b = ui.$('accountBtn');
    b.innerHTML = RA.icon('user');
    b.onclick = () => this.sheet();
    ui.$('profileBtn').onclick = () => this.sheet();
    ui.$('leaderboardBtn').onclick = () => this.topSheet('wins');
    if (/^https?:$/.test(location.protocol)) this.load();
  }

  async api(method, path, body) {
    const r = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let j = null;
    try {
      j = await r.json();
    } catch (_) {}
    if (!r.ok || !j) throw new Error((j && j.e) || `Server za naloge ne odgovara (${r.status}).`);
    return j;
  }

  async load(tries = 3) {
    try {
      const j = await this.api('GET', '/api/me');
      this.ok = true;
      this.google = j.google || '';
      this.set(j.user);
    } catch (e) {
      // no accounts server here (file://, older deploy): the game works as before; a flaky network gets two more tries
      if (tries > 1 && !/404/.test(e.message)) setTimeout(() => this.load(tries - 1), 3000);
    }
  }

  set(u) {
    const ui = this.ui;
    if ((u && u.id) !== (this.user && this.user.id)) this.stats = null;
    this.user = u || null;
    const b = ui.$('accountBtn'), pb = ui.$('profileBtn');
    b.hidden = pb.hidden = !this.ok;
    ui.$('leaderboardBtn').hidden = !this.ok;
    b.classList.toggle('on', !!u);
    const label = u ? `Profil: ${u.name}` : 'Prijava';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = u ? RA.emblem(u) : RA.icon('user');
    pb.innerHTML = u ? `${RA.emblem(u)}<span>${RA.esc(u.name)}</span>` : `${RA.icon('user')}<span>Prijava</span>`;
    pb.setAttribute('aria-label', u ? `Otvori profil: ${u.name}` : 'Prijava i profil');
    // the account name fills the name field, unless the player already typed one
    if (u && !ui.settings.name) {
      ui.settings.name = u.name;
      ui.$('nameIn').value = u.name;
      ui._save();
    }
    if (this.open()) this.sheet(true);
    if (ui.resumeOffer) ui.resumeOffer(); // the account may hold a saved game
  }

  open() {
    return !this.ui.$('sheetWrap').hidden && !!this.ui.$('sheet').querySelector('#accSheet');
  }

  /* Google Identity Services, loaded once */
  gsi() {
    if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
    if (!this.gsiLoading) {
      this.gsiLoading = new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = ok;
        s.onerror = () => {
          this.gsiLoading = null;
          fail(new Error('Ne mogu učitati Google prijavu. Provjeri internet vezu.'));
        };
        document.head.appendChild(s);
      });
    }
    return this.gsiLoading;
  }

  async googleButton(slot, note) {
    if (!this.google) {
      note.textContent = 'Google prijava još nije podešena na serveru.';
      return;
    }
    note.textContent = 'Učitavam Google prijavu…';
    try {
      await this.gsi();
    } catch (e) {
      note.textContent = e.message;
      return;
    }
    if (!slot.isConnected) return;
    if (!this.gsiInit) {
      google.accounts.id.initialize({
        client_id: this.google,
        callback: (r) => this.login(r.credential),
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      this.gsiInit = true;
    }
    note.textContent = '';
    google.accounts.id.renderButton(slot, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      locale: 'bs',
      width: Math.max(220, Math.min(320, slot.clientWidth || 300)),
    });
  }

  async login(credential) {
    const ui = this.ui;
    try {
      const j = await this.api('POST', '/api/login', { credential });
      this.set(j.user);
      ui.toast('good', `Prijavljen si kao ${RA.esc(j.user.name)}.`);
    } catch (e) {
      ui.toast('info', RA.esc(e.message));
    }
  }

  async logout() {
    try {
      await this.api('POST', '/api/logout', {});
    } catch (_) {}
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    this.set(null);
    this.ui.toast('info', 'Odjavljen si.');
  }

  /* a finished game → the account (once per game); new achievements pop up as toasts */
  async report(G, kind) {
    const me = G && G.me;
    if (!this.user || !me || !G.gid || this.sent.has(G.gid)) return;
    this.sent.add(G.gid);
    const net = this.ui.app.net, set = G.online && net && net.st ? net.st.set : null;
    const won = !!(G.winner && (G.winner === me || G.sameTeam(G.winner, me)));
    const body = {
      gid: G.gid,
      online: !!G.online,
      mode: G.online ? (set && set.mode === 'coop' ? 'coop' : 'vs') : 'solo',
      map: G.map.id,
      region: G.map.region ? G.map.region.id : G.map.id,
      era: G.opts.era || 'danas',
      gm: G.opts.gm || 'klasik',
      start: G.opts.start || 'slobodno',
      difficulty: G.opts.difficulty || 'srednje',
      won: won && kind !== 'lost',
      secs: Math.round(G.tick / 10),
      peak: Math.round((me.peak / G.map.landArea) * 1000) / 10,
      cities: me.stats.citiesTaken,
      kills: me.stats.kills,
      conquered: me.stats.conquered,
      nukes: me.stats.nukes,
      players: G.humans ? G.humans.length : 1,
    };
    try {
      const j = await this.api('POST', '/api/result', body);
      this.stats = null;
      (j.fresh || []).forEach((a, i) => setTimeout(() => this.ui.toast('good', `<b>Dostignuće:</b> ${RA.esc(a.name)} — ${RA.esc(a.desc)}`, { ms: 6000 }), 600 + i * 900));
    } catch (e) {
      if (!/Prekratka/.test(e.message)) this.ui.toast('info', 'Rezultat nije sačuvan na nalogu: ' + RA.esc(e.message));
    }
  }

  /* ---------------- profile ---------------- */
  gameLine(r) {
    const reg = RA.REGIONS.find((x) => x.id === r.region && x.map === r.map);
    const where = r.region === r.map || !reg ? RA.mapInfo(r.map).all || RA.mapInfo(r.map).name : reg.name;
    const how = [RA.eraById(r.era).short, r.online ? (r.mode === 'coop' ? 'online tim' : 'online 1 na 1') : '', r.gm === 'br' ? 'battle royale' : '', r.difficulty === 'tesko' ? 'teško' : r.difficulty === 'lako' ? 'lako' : ''].filter(Boolean).join(' · ');
    const d = new Date(r.at), pad = (n) => String(n).padStart(2, '0');
    const when = `${d.getDate()}. ${d.getMonth() + 1}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `<li class="${r.won ? 'w' : 'l'}"><span class="res">${r.won ? 'Pobjeda' : 'Poraz'}</span><span class="what"><b>${RA.esc(where)}</b><small>${RA.esc(how)}</small></span><span class="num">${RA.fmtTime(r.secs)}<small>${String(Math.round(r.peak * 10) / 10).replace('.', ',')}% · ${when}</small></span></li>`;
  }
  fillStats(s, j) {
    const st = j.stats, rk = st.rank, pct = (v) => String(v).replace('.', ',') + '%';
    const cell = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const put = (id, h) => {
      const el = s.querySelector(id);
      if (el) el.innerHTML = h;
    };
    const need = rk.next ? rk.next.wins - st.wins : 0;
    put('#accRank', `<b>${RA.esc(rk.title)}</b> · nivo ${rk.level}${rk.next ? `<div class="bar"><i style="width:${Math.round(((st.wins - rk.min) / Math.max(1, rk.next.wins - rk.min)) * 100)}%"></i></div><small>Još ${need} ${need === 1 ? 'pobjeda' : need < 5 ? 'pobjede' : 'pobjeda'} do čina ${RA.esc(rk.next.title)}</small>` : '<small>Najviši čin</small>'}`);
    put('#accStats', `<div class="acc-grid">${cell('Partija', st.games)}${cell('Pobjeda', st.wins)}${cell('Uspješnost', st.games ? Math.round((st.wins / st.games) * 100) + '%' : '—')}${cell('Online pobjeda', st.onlineWins)}${cell('Najveće carstvo', pct(st.peak))}${cell('Najbrža pobjeda', st.fastest ? RA.fmtTime(st.fastest) : '—')}${cell('Uništeno država', st.kills)}${cell('Osvojeno gradova', st.cities)}${cell('Vrijeme u igri', st.secs >= 3600 ? `${Math.floor(st.secs / 3600)} h ${Math.floor((st.secs % 3600) / 60)} min` : `${Math.floor(st.secs / 60)} min`)}</div>`);
    const got = j.achievements.filter((a) => a.at).length;
    put('#accAchT', `Dostignuća · ${got}/${j.achievements.length}`);
    put('#accAch', j.achievements.map((a) => `<div class="ach${a.at ? ' on' : ''}"><i class="ach-mark" aria-hidden="true">${RA.icon(a.at ? 'check' : 'lock')}</i><div><b>${RA.esc(a.name)}</b><span>${RA.esc(a.desc)}</span><small>${a.at ? 'OTKLJUČANO' : 'ZAKLJUČANO'}</small></div></div>`).join(''));
    put('#accHist', j.recent.length ? `<ol class="hist">${j.recent.map((r) => this.gameLine(r)).join('')}</ol>` : '<p class="note">Još nema završenih partija. Odigraj jednu do kraja — pobjeda ili poraz se ovdje upisuju.</p>');
  }
  async loadStats(s) {
    if (this.stats) this.fillStats(s, this.stats);
    try {
      this.stats = await this.api('GET', '/api/stats');
      if (s.isConnected && s.querySelector('#accStats')) this.fillStats(s, this.stats);
    } catch (e) {
      const el = s.querySelector('#accStats');
      if (el && !this.stats) el.innerHTML = `<p class="note">${RA.esc(e.message)}</p>`;
    }
  }

  /* leaderboard: most wins, or most online wins */
  async topSheet(by) {
    const ui = this.ui;
    let h = '<div id="accSheet" class="dossier-marker leaderboard-marker"></div>' + ui.head('Ljestvica komandanata', 'POREDAK · OVERTAKE');
    h += `<div class="seg" id="topSeg"><button data-v="wins" aria-pressed="${by !== 'online'}">Pobjede</button><button data-v="online" aria-pressed="${by === 'online'}">Online pobjede</button></div>
      <div id="topList"><p class="note">Učitavam…</p></div>
      <div class="btns" style="margin-top:14px"><button class="btn" id="topBack"><span class="t">${this.user ? 'Nazad na profil' : 'Nazad'}</span></button></div>`;
    ui.openSheet(h, (s) => {
      s.querySelectorAll('#topSeg button').forEach((b) => (b.onclick = () => this.topSheet(b.dataset.v)));
      s.querySelector('#topBack').onclick = () => this.sheet();
    });
    const box = ui.$('sheet').querySelector('#topList');
    try {
      const j = await this.api('GET', '/api/top?by=' + (by === 'online' ? 'online' : 'wins'));
      if (!box.isConnected) return;
      const row = (r) => `<li class="${r.me ? 'me' : ''}"><span class="rk">${r.rank}.</span>${RA.emblem(r, 'sm')}<span class="nm">${RA.esc(r.name)}</span><span class="sc">${by === 'online' ? r.online : r.wins}<small>${by === 'online' ? ' online' : ` / ${r.games}`}</small></span></li>`;
      box.innerHTML = j.rows.length
        ? `<ol class="top-list">${j.rows.map(row).join('')}</ol>${j.me && !j.rows.some((r) => r.me) ? `<ol class="top-list mine">${row(j.me)}</ol>` : ''}`
        : '<p class="note">Još niko nema pobjedu. Budi prvi!</p>';
      if (!this.user) box.insertAdjacentHTML('beforeend', '<p class="note">Prijavi se da se i tvoje pobjede računaju.</p>');
    } catch (e) {
      if (box.isConnected) box.innerHTML = `<p class="note">${RA.esc(e.message)}</p>`;
    }
  }

  sheet(keep) {
    const ui = this.ui, u = this.user;
    if (!u) {
      const h = `<div id="accSheet" class="dossier-marker signin-marker"></div>${ui.head('Tvoja historija počinje ovdje.', 'PROFIL KOMANDANTA')}
        <div class="signin-hero">${RA.emblem({icon:'orao'}, 'lg')}<p>Svaka pobjeda ostavlja trag.</p><span>Sačuvaj napredak i nastavi na bilo kojem uređaju.</span></div>
        <div class="signin-features"><div>${RA.icon('army')}<b>Izgradi svoj ugled</b><span>Činovi i lični grb</span></div><div>${RA.icon('star')}<b>Zabilježi pobjede</b><span>Statistika i dostignuća</span></div><div>${RA.icon('globe')}<b>Zauzmi svoje mjesto</b><span>Svjetska ljestvica</span></div></div>
        <div class="signin-action"><div class="gsi-slot" id="gsiSlot"></div><p class="note" id="accNote" aria-live="polite"></p><p>Igraj i bez prijave. Tvoj izbor.</p></div>
        <button class="btn" id="accTop"><span class="t">Pogledaj ljestvicu</span><span class="r" aria-hidden="true">↗</span></button>
        <p class="account-privacy">Google dijeli ime, e-mail i sliku profila. Nalog možeš obrisati u postavkama profila.</p>`;
      ui.openSheet(h, (s) => {
        s.querySelector('#accTop').onclick = () => this.topSheet('wins');
        this.googleButton(s.querySelector('#gsiSlot'), s.querySelector('#accNote'));
      }, keep);
      return;
    }
    const since = u.since ? new Date(u.since) : null;
    const embs = (u.pic ? ['google'] : []).concat(Object.keys(RA.EMBLEMS));
    const h = `<div id="accSheet" class="dossier-marker profile-marker"></div>${ui.head('Dosje komandanta', 'TVOJA HISTORIJA · TVOJE POBJEDE')}
      <div class="prof-card">
        <button class="prof-emb" id="embBtn" aria-label="Promijeni ikonicu" aria-expanded="false">${RA.emblem(u, 'lg')}<i>${RA.icon('edit')}</i></button>
        <div class="prof-main"><span class="dossier-eyebrow">KOMANDANT</span><div class="prof-name">${RA.esc(u.name)}</div><div class="prof-rank" id="accRank"><small>Učitavam…</small></div>${since ? `<small class="prof-since">Član od ${since.getDate()}. ${since.getMonth() + 1}. ${since.getFullYear()}.</small>` : ''}</div>
      </div>
      <div class="emb-pick" id="embPick" hidden>${embs.map((id) => `<button data-emb="${id}" aria-pressed="${id === u.icon}" aria-label="Ikonica ${id}">${RA.emblem({ icon: id, pic: u.pic })}</button>`).join('')}</div>
      <div id="accStats"><p class="note">Učitavam statistiku…</p></div>
      <div class="dossier-columns"><section class="dossier-achievements"><div class="sec-t" id="accAchT">Dostignuća</div><div class="ach-list" id="accAch"></div></section>
      <section class="dossier-history"><div class="sec-t">Posljednje operacije</div><div id="accHist"></div></section></div>
      <div class="account-settings"><div class="sec-t">Postavke profila</div><p class="note">${RA.esc(u.email)}</p><div class="field acc-name"><label class="lab" for="accName">Ime u igri</label>
        <div class="acc-row"><input type="text" id="accName" maxlength="18" value="${RA.esc(u.name)}" autocomplete="nickname" spellcheck="false"><button class="btn good" id="accSave"><span class="t">Sačuvaj</span></button></div></div>
      <p class="note" id="accNote" aria-live="polite"></p>
      </div>
      <div class="btns" style="margin-top:14px">
        <button class="btn" id="accTop"><span class="t">Ljestvica</span></button>
        <button class="btn" id="accOut"><span class="t">Odjavi se</span></button>
        <button class="btn danger" id="accDel"><span class="t">Obriši nalog</span></button>
      </div>`;
    ui.openSheet(h, (s) => {
      const note = s.querySelector('#accNote');
      s.querySelector('#accTop').onclick = () => this.topSheet('wins');
      this.loadStats(s);
      const pick = s.querySelector('#embPick'), eb = s.querySelector('#embBtn');
      eb.onclick = () => {
        pick.hidden = !pick.hidden;
        eb.setAttribute('aria-expanded', String(!pick.hidden));
      };
      pick.querySelectorAll('[data-emb]').forEach((b) => (b.onclick = async () => {
        try {
          const j = await this.api('POST', '/api/icon', { icon: b.dataset.emb });
          this.set(j.user);
        } catch (e) {
          note.textContent = e.message;
        }
      }));
      const inp = s.querySelector('#accName');
      const save = async () => {
        try {
          const j = await this.api('POST', '/api/name', { name: inp.value });
          ui.settings.name = j.user.name;
          ui.$('nameIn').value = j.user.name;
          ui._save();
          this.set(j.user);
          ui.toast('good', 'Ime sačuvano.');
        } catch (e) {
          note.textContent = e.message;
        }
      };
      s.querySelector('#accSave').onclick = save;
      inp.onkeydown = (e) => {
        e.stopPropagation(); // game hotkeys must not fire while typing
        if (e.key === 'Enter') save();
      };
      s.querySelector('#accOut').onclick = () => this.logout();
      s.querySelector('#accDel').onclick = () => ui.confirm('Obrisati nalog?', 'Brišu se nalog, statistike, dostignuća i historija partija. Ne može se vratiti.', 'Obriši', async () => {
        try {
          await this.api('POST', '/api/delete', {});
          this.set(null);
          ui.toast('info', 'Nalog je obrisan.');
        } catch (e) {
          ui.toast('info', RA.esc(e.message));
        }
      });
    }, keep);
  }
};

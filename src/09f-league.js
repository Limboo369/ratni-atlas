'use strict';
/* Conquest League (plan phase 16; server: deploy/game/league.js, ratings: deploy/api/league.js).
   Online → Conquest League: Blitz or Focus, 1v1 / 2v2 / 5v5, Find match alone or with a party. A match opens the
   secret pick/ban (2 maps + 2 eras picked and 1 of each banned per team), the reveal draws from the picks nobody banned,
   then the game starts: only players, from small fields, win by eliminating the other team.
   Stable hooks for the look (Codex C6): #lgSheet, #lgMode, #lgSize, #lgFind, #lgParty, .lg-tier.lg-<rank>, #lgPick,
   .lg-chip[data-k][data-v].pick|.ban, #lgLock, #lgReveal, .lg-chip.draw, .lg-chip.won, #lgTop, #lgHist. */
RA.LG_TIERS = [[800, 'Overlord'], [600, 'Emperor'], [450, 'Warlord'], [300, 'Vanguard'], [0, 'Raider']];
RA.lgTier = (e) => (!e || e.games < 5 ? 'Unranked' : RA.LG_TIERS.find((t) => e.elo >= t[0])[1]);
RA.lgName = (l) => `${l[0] === 'f' ? 'Focus' : 'Blitz'} ${l[1]}v${l[1]}`;
RA.lgMapName = (id) => (RA.THEATRES.find((t) => t.id === id) || { name: id }).name;

RA.League = class {
  constructor(app) {
    this.app = app;
    this.ws = null;
    this.elo = null;
    this.party = null;
    this.queue = null;
    this.match = null;
    this.mine = null; // my team's pick (what I send)
    this.mate = null; // a teammate's pick
    this.reveal = null;
    this.m = 'b';
    this.n = 1;
  }
  get url() {
    return this.app.net && this.app.net.wsUrl;
  }
  connect() {
    if (this.ws && this.ws.readyState <= 1) return;
    const ws = new WebSocket(this.url + '?league=1');
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ hello: { name: this.app.long.name(), uid: this.app.long.uid() } }));
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      this.onMsg(m);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.queue = null;
      if (ev.code === 4401) dispatchEvent(new Event('ra-login'));
      this.app.ui.leagueRefresh();
    };
  }
  send(m) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
  }
  onMsg(m) {
    const ui = this.app.ui;
    if (m.t === 'err') return ui.toast('bad', RA.esc(String(m.e || 'Greška lige.')), { ms: 5000 });
    if (m.t === 'hi') (this.elo = m.elo), (this.me = m.me);
    else if (m.t === 'party') this.party = m;
    else if (m.t === 'queue') this.queue = m.l ? m : null;
    else if (m.t === 'match') {
      this.queue = null;
      this.match = m;
      this.mine = { maps: [], eras: [], bm: '', be: '' };
      this.mate = null;
      this.reveal = null;
      this.matchEnd = Date.now() + m.secs * 1000;
      return ui.leaguePick();
    } else if (m.t === 'tpick') {
      this.mate = m;
      return ui.leaguePickDraw();
    } else if (m.t === 'reveal') {
      this.reveal = m;
      return ui.leagueReveal();
    }
    ui.leagueRefresh();
  }
  pick(lock) {
    this.send({ pick: Object.assign({}, this.mine, { lock: lock ? 1 : 0 }) });
  }
};

Object.assign(RA.UI.prototype, {
  leagueSheet() {
    const app = this.app;
    if (!app.net || !app.net.wsUrl) return this.toast('info', 'Conquest League radi na war.deovilab.com.', { ms: 4000 });
    const L = (app.league = app.league || new RA.League(app));
    L.connect();
    const l = L.m + L.n, e = L.elo && L.elo[l], tier = RA.lgTier(e);
    let h = '<div id="lgSheet"></div>' + this.head('Conquest League', 'Rangirane partije · samo igrači · pobjeda uništenjem protivnika');
    h += `<div class="field"><span class="lab">Mod</span><div class="seg" id="lgMode"><button data-v="b" aria-pressed="${L.m === 'b'}">Blitz</button><button data-v="f" aria-pressed="${L.m === 'f'}">Focus</button></div></div>`;
    h += `<div class="field"><span class="lab">Veličina</span><div class="seg" id="lgSize">${[1, 2, 5].map((n) => `<button data-v="${n}" aria-pressed="${L.n === n}">${n}v${n}</button>`).join('')}</div></div>`;
    h += `<div class="list"><div class="prow wide"><span class="lg-tier lg-${tier.toLowerCase()}">${tier}</span><div class="pn"><div class="nm">${RA.lgName(l)} · ELO ${e ? e.elo : 500}</div><div class="d">${e && e.games >= 5 ? `${e.games} partija` : `Kvalifikacije: ${e ? e.games : 0}/5 partija`}</div></div></div></div>`;
    // party
    const P = L.party;
    h += '<div class="sec-t">Party</div><div id="lgParty">';
    if (P) {
      h += `<p class="explain">Kod partyja: <b>${RA.esc(P.code)}</b> — prijatelj ga upiše pod „Uđi u party”.${P.lead !== L.me ? ' Traženje pokreće vođa.' : ''}</p><div class="list">${P.members.map((x) => `<div class="prow wide"><div class="pn"><div class="nm">${RA.esc(x.name)}${x.id === P.lead ? ' · vođa' : ''}</div></div></div>`).join('')}</div>`;
      h += `<div class="btns"><button class="btn" data-lgp="leave"><span class="t">Napusti party</span></button></div>`;
    } else {
      h += `<div class="btns"><button class="btn" data-lgp="new"><span class="t">Napravi party</span><br><span class="d">Igraj s prijateljima u istom timu (razlika ELO najviše 250)</span></button></div>
        <div class="field"><span class="lab">Uđi u party</span><input id="lgCode" maxlength="6" placeholder="kod" autocomplete="off"> ${this.mini('Uđi', 'data-lgp="join"', 'ok')}</div>`;
    }
    h += '</div>';
    const Q = L.queue;
    h += `<div class="btns"><button class="btn primary" id="lgFind"><span class="t">${Q ? 'Otkaži traženje' : 'Find match'}</span><br><span class="d">${Q ? `Tražim ${RA.lgName(Q.l)}… <span id="lgWait">0:00</span>` : `${RA.lgName(l)}${P ? ' · party ' + P.members.length : ' · sam'}`}</span></button></div>`;
    const acct = this.account && this.account.ok;
    if (acct) h += `<div class="btns"><button class="btn" id="lgTop"><span class="t">Svjetska ljestvica</span><br><span class="d">Top 100 po ljestvici</span></button><button class="btn" id="lgHist"><span class="t">Historija partija</span><br><span class="d">Moji ligaški mečevi</span></button></div>`;
    h += `<p class="note">Pick/ban: svaki tim tajno bira 2 mape i 2 doba i banuje po jedno; računar izvlači između izabranih. Blitz: tim ispod 10% zemlje igrača 60 s kapitulira; poslije 45 min pobjeđuje tim s više zemlje. Predaja: 4 od 5 glasova; u 5v5 i izbacivanje (4 glasa). Napuštanje gubi ELO. Rankovi: Raider · Vanguard · Warlord · Emperor · Overlord.</p>`;
    this.openSheet(h, (s) => {
      for (const [id, k] of [['lgMode', 'm'], ['lgSize', 'n']]) s.querySelectorAll(`#${id} button`).forEach((b) => (b.onclick = () => {
        L[k] = k === 'n' ? +b.dataset.v : b.dataset.v;
        this.leagueSheet();
      }));
      s.querySelectorAll('[data-lgp]').forEach((b) => (b.onclick = () => {
        const v = b.dataset.lgp;
        if (v === 'new') L.send({ party: 'new' });
        else if (v === 'leave') {
          L.send({ party: '' });
          L.party = null;
          this.leagueSheet();
        } else {
          const c = (s.querySelector('#lgCode').value || '').trim().toLowerCase();
          if (/^[a-z0-9]{6}$/.test(c)) L.send({ party: c });
          else this.toast('bad', 'Kod partyja ima 6 znakova.');
        }
      }));
      s.querySelector('#lgFind').onclick = () => {
        if (L.queue) {
          L.send({ unqueue: 1 });
          L.queue = null;
          return this.leagueSheet();
        }
        L.send({ queue: { m: L.m, n: L.n } });
      };
      const t = s.querySelector('#lgTop'), hi = s.querySelector('#lgHist');
      if (t) t.onclick = () => this.leagueTop(l);
      if (hi) hi.onclick = () => this.leagueHistory();
      clearInterval(this._lgIv);
      if (Q) this._lgIv = setInterval(() => {
        const w = document.getElementById('lgWait');
        if (!w) return clearInterval(this._lgIv);
        w.textContent = RA.fmtTime((Date.now() - Q.since) / 1000);
      }, 500);
    });
  },
  /* the league sheet redraws itself on news from the server while it is open */
  leagueRefresh() {
    if (document.getElementById('lgSheet')) this.leagueSheet();
  },
  /* pick/ban: a chip cycles none → pick (2 at most) → ban (1) → none */
  leaguePick() {
    const L = this.app.league, M = L.match;
    const teams = M.teams.map((t, i) => `<b>${i + 1 === M.team ? 'Tvoj tim' : 'Protivnici'}:</b> ${t.map((p) => `${RA.esc(p.name)} (${p.elo})`).join(', ')}`).join('<br>');
    let h = '<div id="lgPick"></div>' + this.head('Pick & ban', `${RA.lgName(M.l)} · još <span id="lgPickT">${M.secs}</span> s`);
    h += `<p class="explain">${teams}</p><p class="note">Dodirni: jednom = biraš (najviše 2), dvaput = banuješ (1), triput = poništi. Protivnik ne vidi tvoj izbor dok računar ne izvuče.</p><div id="lgPickBody"></div>`;
    h += '<div class="btns"><button class="btn primary" id="lgLock"><span class="t">Potvrdi izbor</span></button></div>';
    this.openSheet(h, (s) => {
      this.leaguePickDraw();
      s.querySelector('#lgLock').onclick = () => {
        L.pick(true);
        L.locked = true;
        this.leaguePickDraw();
      };
      clearInterval(this._lgIv);
      this._lgIv = setInterval(() => {
        const t = document.getElementById('lgPickT');
        if (!t) return clearInterval(this._lgIv);
        t.textContent = Math.max(0, Math.ceil((L.matchEnd - Date.now()) / 1000));
      }, 300);
    });
    L.locked = false;
  },
  leaguePickDraw() {
    const L = this.app.league, M = L.match, box = document.getElementById('lgPickBody');
    if (!box || !M) return;
    const my = L.mine, mate = L.mate && L.mate.pick;
    // a teammate's newer pick is the team's pick: show it and keep it
    if (mate && !L.locked) Object.assign(my, { maps: mate.maps.slice(), eras: mate.eras.slice(), bm: mate.bm, be: mate.be }), (L.mate.pick = null);
    const chip = (k, v, name) => {
      const list = k === 'map' ? my.maps : my.eras, ban = k === 'map' ? my.bm : my.be;
      const st = list.includes(v) ? 'pick' : ban === v ? 'ban' : '';
      return `<button class="lg-chip ${st}" data-k="${k}" data-v="${v}">${st === 'pick' ? '✓ ' : st === 'ban' ? '✕ ' : ''}${RA.esc(name)}</button>`;
    };
    let h = `<div class="sec-t">Mape (izabrano ${my.maps.length}/2, ban ${my.bm ? 1 : 0}/1)</div><div class="lg-chips">${M.pool.maps.map((v) => chip('map', v, RA.lgMapName(v))).join('')}</div>`;
    h += `<div class="sec-t">Doba (izabrano ${my.eras.length}/2, ban ${my.be ? 1 : 0}/1)</div><div class="lg-chips">${M.pool.eras.map((v) => chip('era', v, RA.eraById(v).short)).join('')}</div>`;
    if (L.mate) h += `<p class="note">Saigrač ${RA.esc(L.mate.by)} je mijenjao izbor tima.</p>`;
    if (L.locked) h += '<p class="note">Potvrđeno — čekam protivnike.</p>';
    box.innerHTML = h;
    box.querySelectorAll('.lg-chip').forEach((b) => (b.onclick = () => {
      if (L.locked) return;
      const k = b.dataset.k, v = b.dataset.v, lk = k === 'map' ? 'maps' : 'eras', bk = k === 'map' ? 'bm' : 'be';
      if (my[lk].includes(v)) {
        my[lk] = my[lk].filter((x) => x !== v);
        if (!my[bk]) my[bk] = v;
      } else if (my[bk] === v) my[bk] = '';
      else if (my[lk].length < 2) my[lk].push(v);
      else if (!my[bk]) my[bk] = v;
      else return this.toast('info', 'Već si izabrao/la 2 i banovao/la 1 — dodirni jedno da ga poništiš.');
      L.pick(false);
      this.leaguePickDraw();
    }));
  },
  /* the reveal: both teams' picks and bans, then the draw lands on the chosen map and era */
  leagueReveal() {
    const L = this.app.league, R = L.reveal, M = L.match;
    const side = (t) => {
      const p = R.picks[t];
      return `<div class="prow wide"><div class="pn"><div class="nm">${M && t === M.team ? 'Tvoj tim' : 'Protivnici'}</div><div class="d">Mape: ${p.maps.map(RA.lgMapName).join(', ') || '—'} · ban ${p.bm ? RA.lgMapName(p.bm) : '—'}<br>Doba: ${p.eras.map((e) => RA.eraById(e).short).join(', ') || '—'} · ban ${p.be ? RA.eraById(p.be).short : '—'}</div></div></div>`;
    };
    const cands = (k) => {
      const all = [...R.picks[1][k === 'map' ? 'maps' : 'eras'], ...R.picks[2][k === 'map' ? 'maps' : 'eras']].filter((x) => !R.bans[k === 'map' ? 'maps' : 'eras'].includes(x));
      return [...new Set(all.length ? all : [k === 'map' ? R.chosen.map : R.chosen.era])];
    };
    const cm = cands('map'), ce = cands('era');
    let h = '<div id="lgReveal"></div>' + this.head('Računar izvlači', 'Između izabranih mapa i doba koje niko nije banovao');
    h += `<div class="list">${side(1)}${side(2)}</div>`;
    h += `<div class="lg-chips" id="lgDrawMap">${cm.map((v) => `<span class="lg-chip" data-v="${v}">${RA.esc(RA.lgMapName(v))}</span>`).join('')}</div>`;
    h += `<div class="lg-chips" id="lgDrawEra">${ce.map((v) => `<span class="lg-chip" data-v="${v}">${RA.esc(RA.eraById(v).short)}</span>`).join('')}</div>`;
    h += '<p class="note" id="lgDrawNote">…</p>';
    this.openSheet(h, (s) => {
      let i = 0;
      const spin = (id, list, win, step) => {
        const els = s.querySelectorAll(`#${id} .lg-chip`);
        els.forEach((e) => e.classList.remove('draw'));
        const j = step < 14 ? step % list.length : list.indexOf(win);
        if (els[j]) els[j].classList.add(step < 14 ? 'draw' : 'won');
      };
      clearInterval(this._lgIv);
      this._lgIv = setInterval(() => {
        if (!document.getElementById('lgReveal')) return clearInterval(this._lgIv);
        spin('lgDrawMap', cm, R.chosen.map, i);
        spin('lgDrawEra', ce, R.chosen.era, i + 3);
        if (++i > 14) {
          clearInterval(this._lgIv);
          document.getElementById('lgDrawNote').innerHTML = `<b>${RA.esc(RA.lgMapName(R.chosen.map))} · ${RA.esc(RA.eraById(R.chosen.era).short)}</b> — igra počinje…`;
          setTimeout(() => {
            L.match = null;
            this.closeSheet();
            this.app.long.open(R.code);
          }, 1500);
        }
      }, 160);
    });
  },
  /* the result of my league game (the server's simulation decided it) */
  leagueResult(m) {
    const L = this.app.league, G = this.G, me = G && G.me;
    const id = Object.keys(m.res).find((k) => this._lgMine(k));
    const r = id ? m.res[id] : null;
    if (L && L.elo && r) L.elo[m.l] = Object.assign({}, L.elo[m.l], { elo: r.elo, games: ((L.elo[m.l] || {}).games || 0) + 1 });
    if (r) this.toast(r.won ? 'good' : 'bad', `${RA.lgName(m.l)}: ${r.won ? 'pobjeda' : r.left ? 'napustio/la si partiju' : 'poraz'} · ELO ${r.elo} (${r.delta >= 0 ? '+' : ''}${r.delta})`, { ms: 9000 });
    else if (me) this.toast('info', `Liga: rezultat je upisan (${RA.lgName(m.l)}).`, { ms: 5000 });
  },
  _lgMine(k) {
    const A = this.account;
    return (A && A.user && String(A.user.id) === k) || k === 'dev' + this.app.long.uid();
  },
  leagueTop(l) {
    const A = this.account;
    const tabs = ['b1', 'b2', 'b5', 'f1', 'f2', 'f5'].map((x) => `<button data-v="${x}" aria-pressed="${x === l}">${RA.lgName(x)}</button>`).join('');
    A.api('GET', '/api/league/top?l=' + l).then((j) => {
      let h = this.head('Svjetska ljestvica', `${RA.lgName(l)} · top 100 (poslije 5 kvalifikacionih partija)`) + `<div class="seg wrap" id="lgTopSeg">${tabs}</div><div class="list">`;
      const row = (r) => `<div class="prow wide"><div class="pn"><div class="nm">${r.rank}. ${RA.esc(r.name)}</div><div class="d"><span class="lg-tier lg-${r.tier.toLowerCase()}">${r.tier}</span> · ELO ${r.elo} · ${r.wins}/${r.games} pobjeda</div></div></div>`;
      h += j.rows.length ? j.rows.map(row).join('') : '<p class="note">Još niko nije završio kvalifikacije na ovoj ljestvici.</p>';
      h += '</div>' + (j.me && j.me.rank > 100 ? `<div class="sec-t">Ti</div><div class="list">${row(j.me)}</div>` : '');
      this.openSheet(h, (s) => s.querySelectorAll('#lgTopSeg button').forEach((b) => (b.onclick = () => this.leagueTop(b.dataset.v))));
    }, (e) => this.toast('bad', RA.esc(e.message)));
  },
  leagueHistory() {
    this.account.api('GET', '/api/league/history').then((j) => {
      const W = { elim: 'uništenje', cap: 'kapitulacija', time: '45 min', surr: 'predaja', vote: 'glasanje' };
      let h = this.head('Historija partija', 'Tvoji ligaški mečevi (zadnjih 30)') + '<div class="list">';
      h += j.games.length ? j.games.map((g) => `<div class="prow wide"><div class="pn"><div class="nm">${g.won ? 'Pobjeda' : g.left ? 'Napušteno' : 'Poraz'} · ${RA.lgName(g.l)} · ${g.delta >= 0 ? '+' : ''}${g.delta} (${g.elo})</div><div class="d">${RA.esc(RA.lgMapName(g.map))} · ${RA.esc(RA.eraById(g.era).short)} · ${W[g.why] || ''} · ${RA.fmtTime(g.secs)} · ${new Date(g.at).toLocaleString('bs')}<br>${g.teams.map((t) => t.map((p) => (p.me ? '<b>' + RA.esc(p.name) + '</b>' : RA.esc(p.name))).join(', ')).join(' vs ')}</div></div></div>`).join('') : '<p class="note">Još nemaš ligaških partija.</p>';
      this.openSheet(h + '</div>');
    }, (e) => this.toast('bad', RA.esc(e.message)));
  },
});

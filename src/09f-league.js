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
    this.connection = 'connecting';
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
      this.connection = ev.code === 4401 ? 'auth' : 'offline';
      this.app.ui.leagueRefresh();
    };
  }
  send(m) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
  }
  onMsg(m) {
    const ui = this.app.ui;
    if (m.t === 'err') return ui.toast('bad', RA.esc(RA.t(String(m.e || "League error."))), { ms: 5000 });
    if (m.t === 'hi') (this.elo = m.elo), (this.me = m.me), (this.connection = 'ready');
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
  leagueSheet(refresh = false) {
    const app = this.app;
    if (!app.net || !app.net.wsUrl) return this.toast('info', RA.t("Conquest League works on war.deovilab.com."), { ms: 4000 });
    const L = (app.league = app.league || new RA.League(app));
    if (!refresh) L.connect();
    const l = L.m + L.n, e = L.elo && L.elo[l], tier = RA.lgTier(e);
    let h = '<div id="lgSheet"></div>' + this.head(RA.t("Conquest League"), RA.t("Ranked matches · players only · win by destroying the enemy"));
    if (L.connection === 'auth' || L.connection === 'offline') {
      h += `<p class="note" role="status">${RA.t(L.connection === 'auth' ? 'Your session needs to be checked. Sign in again to play.' : 'The connection was interrupted. Try again.')}</p><button class="btn" id="lgRetry">${RA.t(L.connection === 'auth' ? 'Sign in' : 'Try again')}</button>`;
    } else if (L.connection === 'connecting') h += `<p class="note" role="status">${RA.t('Connecting…')}</p>`;
    h += RA.t("<div class=\"field\"><span class=\"lab\">Mode</span><div class=\"seg\" id=\"lgMode\"><button data-v=\"b\" aria-pressed=\"{0}\">Blitz</button><button data-v=\"f\" aria-pressed=\"{1}\">Focus</button></div></div>", L.m === 'b', L.m === 'f');
    h += RA.t("<div class=\"field\"><span class=\"lab\">Size</span><div class=\"seg\" id=\"lgSize\">{0}</div></div>", [1, 2, 5].map((n) => `<button data-v="${n}" aria-pressed="${L.n === n}">${n}v${n}</button>`).join(''));
    h += `<div class="list"><div class="prow wide"><span class="lg-tier lg-${tier.toLowerCase()}">${tier}</span><div class="pn"><div class="nm">${RA.lgName(l)} · ELO ${e ? e.elo : 500}</div><div class="d">${e && e.games >= 5 ? RA.t("{0} matches", e.games) : RA.t("Qualifiers: {0}/5 matches", e ? e.games : 0)}</div></div></div></div>`;
    // party
    const P = L.party;
    h += RA.t("<div class=\"sec-t\">Party</div><div id=\"lgParty\">");
    if (P) {
      h += RA.t("<p class=\"explain\">Party code: <b>{0}</b> — a friend enters it under “Join a party”.{1}</p><div class=\"list\">{2}</div>", RA.esc(P.code), P.lead !== L.me ? RA.t(" The leader starts the search.") : '', P.members.map((x) => `<div class="prow wide"><div class="pn"><div class="nm">${RA.esc(x.name)}${x.id === P.lead ? RA.t(" · leader") : ''}</div></div></div>`).join(''));
      h += RA.t("<div class=\"btns\"><button class=\"btn\" data-lgp=\"leave\"><span class=\"t\">Leave party</span></button></div>");
    } else {
      h += RA.t("<div class=\"btns\"><button class=\"btn\" data-lgp=\"new\"><span class=\"t\">Create party</span><br><span class=\"d\">Play with friends on the same team (ELO difference at most 250)</span></button></div>\n        <div class=\"field\"><span class=\"lab\">Join a party</span><div class=\"code-row\"><input id=\"lgCode\" maxlength=\"6\" placeholder=\"party code\" autocomplete=\"off\">{0}</div></div>", this.mini(RA.t("Join"), 'data-lgp="join"', 'ok'));
    }
    h += '</div>';
    const Q = L.queue;
    h += `<div class="btns"><button class="btn primary" id="lgFind"><span class="t">${Q ? RA.t("Cancel search") : 'Find match'}</span><br><span class="d">${Q ? RA.t("Searching {0}… <span id=\"lgWait\">0:00</span>", RA.lgName(Q.l)) : `${RA.lgName(l)}${P ? RA.t(" · party ") + P.members.length : RA.t(" · solo")}`}</span></button></div>`;
    const acct = this.account && this.account.ok;
    if (acct) h += RA.t("<div class=\"btns\"><button class=\"btn\" id=\"lgTop\"><span class=\"t\">World ladder</span><br><span class=\"d\">Top 100 on the ladder</span></button><button class=\"btn\" id=\"lgHist\"><span class=\"t\">Match history</span><br><span class=\"d\">My league matches</span></button></div>");
    h += RA.t("<p class=\"note\">Pick/ban: each team secretly picks 2 maps and 2 ages and bans one of each; the computer draws from the picks. Blitz: a team under 10% of the players' land for 60 s capitulates; after 45 min the team with more land wins. Surrender: 4 of 5 votes; in 5v5 also kick (4 votes). Leaving loses ELO. Ranks: Raider · Vanguard · Warlord · Emperor · Overlord.</p>");
    this.openSheet(h, (s) => {
      const retry = s.querySelector('#lgRetry');
      if (retry) retry.onclick = async () => {
        if (L.connection === 'auth' && this.account) {
          retry.disabled = true;
          await this.account.load(1);
          if (!this.account.user) { this.account.sheet(); this.account.after = () => this.leagueSheet(); return; }
        }
        this.leagueSheet();
      };
      s.querySelectorAll('#lgFind,[data-lgp]').forEach((b) => b.disabled = L.connection !== 'ready');
      for (const [id, k] of [['lgMode', 'm'], ['lgSize', 'n']]) s.querySelectorAll(`#${id} button`).forEach((b) => (b.onclick = () => {
        L[k] = k === 'n' ? +b.dataset.v : b.dataset.v;
        this.leagueSheet(true);
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
          else this.toast('bad', RA.t("A party code has 6 characters."));
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
    }, refresh);
  },
  /* the league sheet redraws itself on news from the server while it is open */
  leagueRefresh() {
    if (document.getElementById('lgSheet')) this.leagueSheet(true);
  },
  /* pick/ban: a chip cycles none → pick (2 at most) → ban (1) → none */
  leaguePick() {
    const L = this.app.league, M = L.match;
    const teams = M.teams.map((t, i) => `<b>${i + 1 === M.team ? RA.t("Your team") : RA.t("Opponents")}:</b> ${t.map((p) => `${RA.esc(p.name)} (${p.elo})`).join(', ')}`).join('<br>');
    let h = '<div id="lgPick"></div>' + this.head('Pick & ban', RA.t("{0} · <span id=\"lgPickT\">{1}</span> s left", RA.lgName(M.l), M.secs));
    h += RA.t("<p class=\"explain\">{0}</p><p class=\"note\">Tap: once = pick (at most 2), twice = ban (1), three times = clear. The opponent doesn't see your choice until the computer draws.</p><div id=\"lgPickBody\"></div>", teams);
    h += RA.t("<div class=\"btns\"><button class=\"btn primary\" id=\"lgLock\"><span class=\"t\">Confirm choice</span></button></div>");
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
    let h = RA.t("<div class=\"sec-t\">Maps (picked {0}/2, ban {1}/1)</div><div class=\"lg-chips\">{2}</div>", my.maps.length, my.bm ? 1 : 0, M.pool.maps.map((v) => chip('map', v, RA.lgMapName(v))).join(''));
    h += RA.t("<div class=\"sec-t\">Ages (picked {0}/2, ban {1}/1)</div><div class=\"lg-chips\">{2}</div>", my.eras.length, my.be ? 1 : 0, M.pool.eras.map((v) => chip('era', v, RA.eraById(v).short)).join(''));
    if (L.mate) h += RA.t("<p class=\"note\">Teammate {0} changed the team's choice.</p>", RA.esc(L.mate.by));
    if (L.locked) h += RA.t("<p class=\"note\">Confirmed — waiting for the opponents.</p>");
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
      else return this.toast('info', RA.t("You have already picked 2 and banned 1 — tap one to clear it."));
      L.pick(false);
      this.leaguePickDraw();
    }));
  },
  /* the reveal: both teams' picks and bans, then the draw lands on the chosen map and era */
  leagueReveal() {
    const L = this.app.league, R = L.reveal, M = L.match;
    const side = (t) => {
      const p = R.picks[t];
      return RA.t("<div class=\"prow wide\"><div class=\"pn\"><div class=\"nm\">{0}</div><div class=\"d\">Maps: {1} · ban {2}<br>Ages: {3} · ban {4}</div></div></div>", M && t === M.team ? RA.t("Your team") : RA.t("Opponents"), p.maps.map(RA.lgMapName).join(', ') || '—', p.bm ? RA.lgMapName(p.bm) : '—', p.eras.map((e) => RA.eraById(e).short).join(', ') || '—', p.be ? RA.eraById(p.be).short : '—');
    };
    const cands = (k) => {
      const all = [...R.picks[1][k === 'map' ? 'maps' : 'eras'], ...R.picks[2][k === 'map' ? 'maps' : 'eras']].filter((x) => !R.bans[k === 'map' ? 'maps' : 'eras'].includes(x));
      return [...new Set(all.length ? all : [k === 'map' ? R.chosen.map : R.chosen.era])];
    };
    const cm = cands('map'), ce = cands('era');
    let h = '<div id="lgReveal"></div>' + this.head(RA.t("The computer draws"), RA.t("From the maps and ages that nobody banned"));
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
        const frame = RA.motionPreference.matches ? 14 : i;
        spin('lgDrawMap', cm, R.chosen.map, frame);
        spin('lgDrawEra', ce, R.chosen.era, frame + 3);
        if (++i > 14) {
          clearInterval(this._lgIv);
          document.getElementById('lgDrawNote').innerHTML = RA.t("<b>{0} · {1}</b> — the game is starting…", RA.esc(RA.lgMapName(R.chosen.map)), RA.esc(RA.eraById(R.chosen.era).short));
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
    if (r) this.toast(r.won ? 'good' : 'bad', `${RA.lgName(m.l)}: ${r.won ? RA.t("victory") : r.left ? RA.t("you left the match") : RA.t("defeat")} · ELO ${r.elo} (${r.delta >= 0 ? '+' : ''}${r.delta})`, { ms: 9000 });
    else if (me) this.toast('info', RA.t("League: the result is recorded ({0}).", RA.lgName(m.l)), { ms: 5000 });
  },
  _lgMine(k) {
    const A = this.account;
    return (A && A.user && String(A.user.id) === k) || k === 'dev' + this.app.long.uid();
  },
  leagueTop(l) {
    const A = this.account;
    const tabs = ['b1', 'b2', 'b5', 'f1', 'f2', 'f5'].map((x) => `<button data-v="${x}" aria-pressed="${x === l}">${RA.lgName(x)}</button>`).join('');
    A.api('GET', '/api/league/top?l=' + l).then((j) => {
      let h = this.head(RA.t("World ladder"), RA.t("{0} · top 100 (after 5 qualifying matches)", RA.lgName(l))) + `<div class="seg wrap" id="lgTopSeg">${tabs}</div><div class="list">`;
      const row = (r) => RA.t("<div class=\"prow wide\"><div class=\"pn\"><div class=\"nm\">{0}. {1}</div><div class=\"d\"><span class=\"lg-tier lg-{2}\">{3}</span> · ELO {4} · {5}/{6} wins</div></div></div>", r.rank, RA.esc(r.name), r.tier.toLowerCase(), r.tier, r.elo, r.wins, r.games);
      h += j.rows.length ? j.rows.map(row).join('') : RA.t("<p class=\"note\">Nobody has finished the qualifiers on this ladder yet.</p>");
      h += '</div>' + (j.me && j.me.rank > 100 ? `<div class="sec-t">${RA.t("You")}</div><div class="list">${row(j.me)}</div>` : '');
      this.openSheet(h, (s) => s.querySelectorAll('#lgTopSeg button').forEach((b) => (b.onclick = () => this.leagueTop(b.dataset.v))));
    }, (e) => this.toast('bad', RA.esc(e.message)));
  },
  leagueHistory() {
    this.account.api('GET', '/api/league/history').then((j) => {
      const W = { elim: RA.t("destruction"), cap: RA.t("capitulation"), time: '45 min', surr: RA.t("surrender"), vote: RA.t("vote") };
      let h = '<div id="lgHistory"></div>' + this.head(RA.t("Match history"), RA.t("Your league matches (last 30)")) + '<div class="list">';
      h += j.games.length ? j.games.map((g) => `<div class="prow wide"><div class="pn"><div class="nm">${g.won ? RA.t("Victory") : g.left ? RA.t("Abandoned") : RA.t("Defeat")} · ${RA.lgName(g.l)} · ${g.delta >= 0 ? '+' : ''}${g.delta} (${g.elo})</div><div class="d">${RA.esc(RA.lgMapName(g.map))} · ${RA.esc(RA.eraById(g.era).short)} · ${W[g.why] || ''} · ${RA.fmtTime(g.secs)} · ${new Date(g.at).toLocaleString(RA.LOCALE)}<br>${g.teams.map((t) => t.map((p) => (p.me ? '<b>' + RA.esc(p.name) + '</b>' : RA.esc(p.name))).join(', ')).join(' vs ')}</div></div><div class="bb">${this.mini('Replay', `data-rp="${g.code}"`, 'ok')}</div></div>`).join('') : RA.t("<p class=\"note\">You have no league matches yet.</p>");
      this.openSheet(h + '</div>', (s) => s.querySelectorAll('[data-rp]').forEach((b) => (b.onclick = () => {
        this.closeSheet();
        this.app.replayOpen(b.dataset.rp);
      })));
    }, (e) => this.toast('bad', RA.esc(e.message)));
  },
});

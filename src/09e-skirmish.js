'use strict';
/* Skirmish (plan phase 15): public online games with people. The server keeps them like Focus games (deploy/game/long.js)
   but at Blitz speed, with a countdown before the start; the other states are the computer's and whoever comes later
   takes one of them. Online → Skirmish lists the open games (/ws?lobby=1) and makes a new public one from the start
   screen's settings (Blitz / Focus / Make your choice) plus teams. */
Object.assign(RA.UI.prototype, {
  skirmishSheet() {
    const net = this.app.net;
    if (!net || !net.wsUrl) return this.toast('info', RA.t("Skirmish works on war.deovilab.com."), { ms: 4000 });
    const S = (this.skirm = this.skirm || { teams: '0', aw: 0 });
    let h = '<div id="skirmSheet"></div>' + this.head(RA.t("Skirmish"), RA.t("Public games with people · the computer leads the other states"));
    h += RA.t("<div class=\"sec-t\">Open games</div><div class=\"list\" id=\"skirmList\"><p class=\"note\">Looking for games…</p></div>");
    h += RA.t("<div class=\"sec-t\">Create a public game</div><p class=\"explain\">Settings from the start screen ({0}, map, age, rules), plus:</p>", RA.esc(this.playSet().pace === 'focus' ? RA.t("Focus") : RA.t("Blitz")));
    h += RA.t("<div class=\"field\"><span class=\"lab\">Teams</span><div class=\"seg wrap\" id=\"skTeams\">{0}</div></div>", [['0', RA.t("Free for all")], ['2', RA.t("2 teams")], ['3', RA.t("3 teams")], ['hvs', RA.t("Humans vs states")]].map(([v, t]) => `<button data-v="${v}" aria-pressed="${S.teams === v}">${t}</button>`).join(''));
    h += RA.t("<div class=\"field\"><span class=\"lab\">Allies win together</span><div class=\"seg\" id=\"skAw\"><button data-v=\"0\" aria-pressed=\"{0}\">No</button><button data-v=\"1\" aria-pressed=\"{1}\">Yes</button></div></div>", !S.aw, !!S.aw);
    h += RA.t("<div class=\"btns\"><button class=\"btn primary\" data-sknew><span class=\"t\">Create public game</span><br><span class=\"d\">Starts in 60 s — others join while you wait</span></button></div>");
    this.openSheet(h, (s) => {
      for (const [id, k] of [['skTeams', 'teams'], ['skAw', 'aw']]) s.querySelectorAll(`#${id} button`).forEach((b) => (b.onclick = () => {
        S[k] = k === 'aw' ? +b.dataset.v : b.dataset.v;
        s.querySelectorAll(`#${id} button`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }));
      s.querySelector('[data-sknew]').onclick = () => {
        this.skirmishClose();
        this.closeSheet();
        this.app.long.create({ pub: 1, fast: this.playSet().pace === 'focus' ? 0 : 1, teams: S.teams, aw: S.aw });
      };
      this.skirmishListen();
    });
  },
  /* the lobby socket: the list of public games every 2 s while the sheet is open */
  skirmishListen() {
    this.skirmishClose();
    const ws = new WebSocket(this.app.net.wsUrl + '?lobby=1');
    this.skirmWs = ws;
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      const box = document.getElementById('skirmList');
      if (!box || !document.getElementById('skirmSheet')) return this.skirmishClose();
      if (m.t === 'list') box.innerHTML = this.skirmishRows(m.games || []);
      box.querySelectorAll('[data-skjoin]').forEach((b) => (b.onclick = () => {
        this.skirmishClose();
        this.closeSheet();
        this.app.long.open(b.dataset.skjoin);
      }));
    };
  },
  skirmishClose() {
    if (this.skirmWs) {
      try {
        this.skirmWs.close();
      } catch (_) {}
      this.skirmWs = null;
    }
  },
  skirmishRows(games) {
    if (!games.length) return RA.t("<p class=\"note\">No open games — create one.</p>");
    const TN = { 0: RA.t("free for all"), 2: RA.t("2 teams"), 3: RA.t("3 teams"), hvs: RA.t("humans vs states") };
    return games.map((g) => {
      const s = g.set, reg = RA.REGIONS.find((r) => r.id === s.reg && r.map === s.map);
      const when = g.wait > 0 ? RA.t("starts in {0} s", Math.ceil(g.wait / 1000)) : RA.t("running for {0}", g.tickMs <= 100 ? RA.fmtTime(g.tick / 10) : Math.round((g.tick * g.tickMs) / 60000) + ' min');
      const d = `${s.fast ? RA.t("Blitz") : RA.t("Focus")} · ${RA.esc(reg ? reg.name : RA.mapInfo(s.map).all)} · ${RA.esc(RA.eraById(s.era).short)} · ${TN[s.teams] || ''} · ${when}`;
      return RA.t("<div class=\"prow wide\"><div class=\"pn\"><div class=\"nm\">Players {0}/{1}</div><div class=\"d\">{2}</div></div><div class=\"bb\">{3}</div></div>", g.humans, g.max, d, this.mini(RA.t("Join"), `data-skjoin="${g.code}"`, 'ok', g.humans >= g.max));
    }).join('');
  },
  /* report a player (plan 25): teaming, a rude name, cheating — the owner sees the reports */
  reportSheet(O) {
    const G = this.G, L = this.app.long;
    let h = this.head(`Prijavi: ${RA.esc(O.nick || O.name)}`, RA.t("The report goes to the game's administrator"));
    h += '<div class="btns">' + [['team', RA.t("Teaming in a free-for-all game")], ['name', RA.t("Offensive name")], ['cheat', RA.t("Cheating")], ['grief', RA.t("Deliberately ruining the game")]].map(([k, t]) => this.btn({ attrs: `data-rep="${k}"`, t })).join('') + '</div>';
    this.openSheet(h, (s) => s.querySelectorAll('[data-rep]').forEach((b) => (b.onclick = () => {
      const A = this.account;
      const body = { game: (L && L.code) || G.gid || '', name: String(O.nick || O.name).slice(0, 30), reason: b.dataset.rep };
      (A && A.user ? A.api('POST', '/api/report', body) : Promise.reject(new Error(RA.t("Reporting requires an account.")))).then(
        () => this.toast('good', RA.t("Report sent. Thank you!")),
        (e) => this.toast('bad', RA.esc(e.message))
      );
      this.closeSheet();
    })));
  },
});

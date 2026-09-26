'use strict';
/* Skirmish (plan phase 15): public online games with people. The server keeps them like Focus games (deploy/game/long.js)
   but at Blitz speed, with a countdown before the start; the other states are the computer's and whoever comes later
   takes one of them. Online → Skirmish lists the open games (/ws?lobby=1) and makes a new public one from the start
   screen's settings (Blitz / Focus / Make your choice) plus teams. */
Object.assign(RA.UI.prototype, {
  skirmishSheet() {
    const net = this.app.net;
    if (!net || !net.wsUrl) return this.toast('info', 'Skirmish radi na war.deovilab.com.', { ms: 4000 });
    const S = (this.skirm = this.skirm || { teams: '0', aw: 0 });
    let h = '<div id="skirmSheet"></div>' + this.head('Skirmish', 'Javne igre s ljudima · ostale države vodi kompjuter');
    h += '<div class="sec-t">Otvorene igre</div><div class="list" id="skirmList"><p class="note">Tražim igre…</p></div>';
    h += `<div class="sec-t">Napravi javnu igru</div><p class="explain">Postavke s početnog ekrana (${RA.esc(this.playSet().pace === 'focus' ? 'Focus' : 'Blitz')}, mapa, doba, pravila), plus:</p>`;
    h += `<div class="field"><span class="lab">Timovi</span><div class="seg wrap" id="skTeams">${[['0', 'Svako za sebe'], ['2', '2 tima'], ['3', '3 tima'], ['hvs', 'Ljudi protiv država']].map(([v, t]) => `<button data-v="${v}" aria-pressed="${S.teams === v}">${t}</button>`).join('')}</div></div>`;
    h += `<div class="field"><span class="lab">Saveznici pobjeđuju zajedno</span><div class="seg" id="skAw"><button data-v="0" aria-pressed="${!S.aw}">Ne</button><button data-v="1" aria-pressed="${!!S.aw}">Da</button></div></div>`;
    h += '<div class="btns"><button class="btn primary" data-sknew><span class="t">Napravi javnu igru</span><br><span class="d">Počinje za 60 s — dok čekaš, drugi ulaze</span></button></div>';
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
    if (!games.length) return '<p class="note">Nema otvorenih igara — napravi jednu.</p>';
    const TN = { 0: 'svako za sebe', 2: '2 tima', 3: '3 tima', hvs: 'ljudi protiv država' };
    return games.map((g) => {
      const s = g.set, reg = RA.REGIONS.find((r) => r.id === s.reg && r.map === s.map);
      const when = g.wait > 0 ? `počinje za ${Math.ceil(g.wait / 1000)} s` : `traje ${g.tickMs <= 100 ? RA.fmtTime(g.tick / 10) : Math.round((g.tick * g.tickMs) / 60000) + ' min'}`;
      const d = `${s.fast ? 'Blitz' : 'Focus'} · ${RA.esc(reg ? reg.name : RA.mapInfo(s.map).all)} · ${RA.esc(RA.eraById(s.era).short)} · ${TN[s.teams] || ''} · ${when}`;
      return `<div class="prow wide"><div class="pn"><div class="nm">Igrača ${g.humans}/${g.max}</div><div class="d">${d}</div></div><div class="bb">${this.mini('Uđi', `data-skjoin="${g.code}"`, 'ok', g.humans >= g.max)}</div></div>`;
    }).join('');
  },
  /* report a player (plan 25): teaming, a rude name, cheating — the owner sees the reports */
  reportSheet(O) {
    const G = this.G, L = this.app.long;
    let h = this.head(`Prijavi: ${RA.esc(O.nick || O.name)}`, 'Prijava ide administratoru igre');
    h += '<div class="btns">' + [['team', 'Timovanje u igri svako za sebe'], ['name', 'Uvredljivo ime'], ['cheat', 'Varanje'], ['grief', 'Namjerno kvari igru']].map(([k, t]) => this.btn({ attrs: `data-rep="${k}"`, t })).join('') + '</div>';
    this.openSheet(h, (s) => s.querySelectorAll('[data-rep]').forEach((b) => (b.onclick = () => {
      const A = this.account;
      const body = { game: (L && L.code) || G.gid || '', name: String(O.nick || O.name).slice(0, 30), reason: b.dataset.rep };
      (A && A.user ? A.api('POST', '/api/report', body) : Promise.reject(new Error('Prijava traži nalog.'))).then(
        () => this.toast('good', 'Prijava je poslana. Hvala!'),
        (e) => this.toast('bad', RA.esc(e.message))
      );
      this.closeSheet();
    })));
  },
});

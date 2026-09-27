'use strict';
/* Campaign (plan 56): your dynasty from Rome to today. You choose a home (a city) and a name; in every era you rule
   the state that holds your home. 7 chapters × 10 missions (expand, cities, gold, alliances, conquer, defend the
   capital, survive a coalition, win the region…), harder chapter by chapter; missions give experience (XP) for the
   dynasty's tech tree (army, economy, diplomacy, science), whose upgrades last through all eras. Between missions:
   free play in the chapter's era. Progress: localStorage 'ra_campaign' and, signed in, the account (/api/campaign). */
RA.CAMP_HOMES = [
  { id: 'sarajevo', name: RA.t("Sarajevo"), map: 'evropa', ll: [43.86, 18.41] }, { id: 'beograd', name: RA.t("Belgrade"), map: 'evropa', ll: [44.82, 20.46] },
  { id: 'zagreb', name: RA.t("Zagreb"), map: 'evropa', ll: [45.81, 15.98] }, { id: 'bec', name: RA.t("Vienna"), map: 'evropa', ll: [48.21, 16.37] },
  { id: 'budimpesta', name: RA.t("Budapest"), map: 'evropa', ll: [47.5, 19.04] }, { id: 'rim', name: RA.t("Rome"), map: 'evropa', ll: [41.9, 12.5] },
  { id: 'atina', name: RA.t("Athens"), map: 'evropa', ll: [37.98, 23.73] }, { id: 'istanbul', name: RA.t("Istanbul"), map: 'evropa', ll: [41.01, 28.97] },
  { id: 'pariz', name: RA.t("Paris"), map: 'evropa', ll: [48.86, 2.35] }, { id: 'london', name: RA.t("London"), map: 'evropa', ll: [51.5, -0.12] },
  { id: 'berlin', name: RA.t("Berlin"), map: 'evropa', ll: [52.52, 13.4] }, { id: 'madrid', name: RA.t("Madrid"), map: 'evropa', ll: [40.42, -3.7] },
  { id: 'varsava', name: RA.t("Warsaw"), map: 'evropa', ll: [52.23, 21.01] }, { id: 'stokholm', name: RA.t("Stockholm"), map: 'evropa', ll: [59.33, 18.07] },
  { id: 'moskva', name: RA.t("Moscow"), map: 'evropa', ll: [55.75, 37.62] },
  { id: 'kairo', name: RA.t("Cairo"), map: 'svijet', ll: [30.04, 31.24] }, { id: 'teheran', name: RA.t("Tehran"), map: 'svijet', ll: [35.69, 51.39] },
  { id: 'delhi', name: RA.t("Delhi"), map: 'svijet', ll: [28.61, 77.21] }, { id: 'peking', name: RA.t("Beijing"), map: 'svijet', ll: [39.9, 116.4] },
  { id: 'tokio', name: RA.t("Tokyo"), map: 'svijet', ll: [35.68, 139.69] }, { id: 'vasington', name: RA.t("Washington"), map: 'svijet', ll: [38.9, -77.04] },
  { id: 'meksiko', name: RA.t("Mexico City"), map: 'svijet', ll: [19.43, -99.13] }, { id: 'buenosaires', name: RA.t("Buenos Aires"), map: 'svijet', ll: [-34.6, -58.38] },
  { id: 'lagos', name: RA.t("Lagos"), map: 'svijet', ll: [6.52, 3.38] },
];
/* the ten missions of a chapter (the same kinds in every era, harder each chapter); par = minutes for 3 stars */
RA.CAMP_KINDS = [
  { type: 'expand', par: 8 }, { type: 'cities', par: 10 }, { type: 'gold', par: 8 }, { type: 'allies', par: 8 }, { type: 'conquerWeak', par: 12 },
  { type: 'defend', par: 8 }, { type: 'conquerStrong', par: 18 }, { type: 'survive', par: 10 }, { type: 'expand40', par: 20 }, { type: 'win', par: 30 },
];
RA.CAMPAIGN = [
  { era: 'rim', name: RA.t("I. The rise"), diff: 'lako', intro: RA.t("The Roman age. Your family holds little land and much ambition."),
    titles: [RA.t("First boundaries"), RA.t("City on the hill"), RA.t("Treasure for the legions"), RA.t("Alliance of tribes"), RA.t("The small neighbour"), RA.t("Siege of the capital"), RA.t("The great rival"), RA.t("All tribes against us"), RA.t("Half the region"), RA.t("Master of the region")] },
  { era: 'srednji', name: RA.t("II. Crowns and swords"), diff: 'lako', intro: RA.t("The Middle Ages. The dynasty wears a crown — now it must keep it."),
    titles: [RA.t("A new fief"), RA.t("Fortresses and market towns"), RA.t("The royal treasury"), RA.t("Vassals and allies"), RA.t("March on the neighbour"), RA.t("The walls hold"), RA.t("Crown against crown"), RA.t("Crusaders at the gates"), RA.t("An empire in the making"), RA.t("King of kings")] },
  { era: 'napoleon', name: RA.t("III. The age of revolutions"), diff: 'srednje', intro: RA.t("1815. Empires fall, borders are drawn anew."),
    titles: [RA.t("New borders"), RA.t("Manufactories"), RA.t("The war chest"), RA.t("Congress of allies"), RA.t("A swift campaign"), RA.t("Defend the capital"), RA.t("Battle of the Nations"), RA.t("A coalition against us"), RA.t("Domination"), RA.t("Emperor of Europe")] },
  { era: 'ww1', name: RA.t("IV. The Great War"), diff: 'srednje', intro: RA.t("1914. Trenches, zeppelins and the first tanks."),
    titles: [RA.t("Mobilisation"), RA.t("War industry"), RA.t("War loans"), RA.t("Entente or Central Powers"), RA.t("Ultimatum"), RA.t("Not one step back"), RA.t("Breaking the front"), RA.t("All fronts"), RA.t("Victory in the east"), RA.t("Peace on our terms")] },
  { era: 'ww2', name: RA.t("V. World on fire"), diff: 'srednje', intro: RA.t("1938. Planes, tanks and the atom on the horizon."),
    titles: [RA.t("The neighbour's living space"), RA.t("The factories are running"), RA.t("Gold for the front"), RA.t("Axis and Allies"), RA.t("Blitzkrieg"), RA.t("The siege"), RA.t("The main enemy"), RA.t("The whole continent against us"), RA.t("Fortress continent"), RA.t("End of the war")] },
  { era: 'hladni', name: RA.t("VI. The Cold War"), diff: 'tesko', intro: RA.t("1960. Blocs, missiles and the balance of terror."),
    titles: [RA.t("Sphere of influence"), RA.t("Five-year plan"), RA.t("Space budget"), RA.t("The pact"), RA.t("Proxy war"), RA.t("Crisis over the capital"), RA.t("Superpower against superpower"), RA.t("Everyone against the bloc"), RA.t("Hegemony"), RA.t("End of the Cold War")] },
  { era: 'danas', name: RA.t("VII. A new world"), diff: 'tesko', intro: RA.t("Today. Drones, sanctions and old borders in new clothes."),
    titles: [RA.t("New politics"), RA.t("Smart cities"), RA.t("Fund for the future"), RA.t("Security alliance"), RA.t("Special operation"), RA.t("Air defence shield"), RA.t("The big player"), RA.t("Sanctions and blockades"), RA.t("Regional power"), RA.t("A dynasty forever")] },
];
RA.campMission = (ch, i) => ({ id: ch * 10 + i, ch, i, ...RA.CAMP_KINDS[i], title: RA.CAMPAIGN[ch].titles[i], era: RA.CAMPAIGN[ch].era, diff: RA.CAMPAIGN[ch].diff });
RA.campGoalText = function (m) {
  return {
    expand: RA.t("Grow your land by 60% (at least 5 points of the region's share)."),
    cities: RA.t("Have 3 more cities than at the start (conquer or build them)."),
    gold: RA.t("Gather a big treasury (the goal is shown at the top of the screen)."),
    allies: RA.t("Have 2 military and 2 trade alliances at the same time."),
    conquerWeak: RA.t("Conquer the weakest neighbour (marked at the start)."),
    defend: RA.t("The strongest neighbour is going for your capital: hold it for 8 minutes."),
    conquerStrong: RA.t("Conquer the strongest neighbour."),
    survive: RA.t("All your neighbours have joined forces against you: survive 10 minutes."),
    expand40: RA.t("Hold 40% of the region's land."),
    win: RA.t("Win: 70% of the region's land."),
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
    let h = this.head(RA.t("Campaign: the {0} dynasty", c.name), RA.t("Home: {0} · experience {1} ({2} free) · missions {3}/70", RA.esc(home.name), c.xp, free, Object.keys(done).length));
    h += RA.t("<span class=\"campaign-marker\" hidden></span><div class=\"dynasty-banner\"><div class=\"dynasty-seal\" aria-hidden=\"true\">{0}</div><div><span>A LEGACY THROUGH SEVEN AGES</span><h3>{1}</h3><p>{2} · {3} of 70 missions completed</p></div><div class=\"dynasty-xp\"><b>{4}</b><span>free XP</span></div></div>", RA.icon('flag'), RA.esc(c.name), RA.esc(home.name), Object.keys(done).length, free);
    if (home.map !== 'evropa'  && !(this.app.mapOK && this.app.mapOK[home.map])) h += RA.t("<p class=\"note\">The <b>world map</b> is loaded from the server (war.deovilab.com).</p>");
    h += RA.t("<div class=\"sec-t\">Dynasty tech tree</div><p class=\"explain\">Invest the experience from missions here; upgrades apply in every age.</p><div class=\"research-grid\">");
    for (const [k, T] of Object.entries(RA.CAMP_TREE)) {
      const l = c.tree[k] || 0, cost = 150 * (l + 1);
      h += RA.t("<article class=\"research-card\" data-branch=\"{0}\"><div class=\"research-heading\"><i>{1}</i><span>{2}<small>Level {3} / 5</small></span></div>{4}<p>{5}</p>{6}</article>", k, RA.icon(({mil:'army',eco:'market',dip:'ally',sci:'factory'})[k]), T.name, l, this.techProgress(l), T.desc, l<5 ? this.mini(RA.t("Upgrade · {0} XP", cost), `data-tree="${k}"`, 'ok', free<cost) : RA.t("<span class=\"research-max\">Fully developed</span>"));
    }
    h += '</div>';
    RA.CAMPAIGN.forEach((ch, ci) => {
      const open = ci === 0 || done[ci * 10 - 1] !== undefined;
      h += `<div class="campaign-chapter${open?'':' is-locked'}"><span class="chapter-number">${String(ci+1).padStart(2,'0')}</span><div><h3>${RA.esc(ch.name)}</h3><span>${RA.esc(RA.eraById(ch.era).name)}</span></div><small>${open?RA.t("Unlocked"):RA.t("Locked")}</small></div>`;
      if (!open) return;
      h += `<p class="explain">${RA.esc(ch.intro)}</p><div class="list">`;
      for (let i = 0; i < 10; i++) {
        const m = RA.campMission(ci, i), st = done[m.id], avail = i === 0 ? true : done[m.id - 1] !== undefined;
        const stars = st !== undefined ? '★'.repeat(st) + '☆'.repeat(3 - st) : '';
        h += `<div class="camp-row${avail ? '' : ' locked'}"><span class="mission-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div><div class="cr-t">${RA.esc(m.title)} ${stars ? `<span class="cr-s">${stars}</span>` : ''}</div><div class="cr-d">${RA.esc(RA.campGoalText(m))}</div></div><div class="cr-b">${avail ? this.mini(st !== undefined ? RA.t("Replay") : RA.t("Play"), `data-mis="${m.id}"`, st !== undefined ? '' : 'ok') : '🔒'}</div></div>`;
      }
      h += `</div><div class="btns">${this.btn({ icon: 'flag', attrs: `data-free="${ci}"`, t: RA.t("Free play in this age"), d: RA.t("No goal, with the dynasty's upgrades") })}</div>`;
    });
    h += RA.t("<p class=\"note\"><button class=\"mini warn\" data-reset>New campaign</button></p>");
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
      if (r) r.onclick = () => this.confirm(RA.t("New campaign?"), RA.t("All progress of this dynasty will be deleted."), RA.t("Delete and start"), () => {
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
    let h = this.head(RA.t("New campaign"), RA.t("Your dynasty from Rome to today")) + '<span class="campaign-marker" hidden></span>';
    h += RA.t("<p class=\"explain\">Choose your dynasty's home: in every age you lead the state that holds that city. Seven chapters of ten missions; invest experience in the tech tree.</p>");
    h += RA.t("<div class=\"field\"><span class=\"lab\">Dynasty name</span><input type=\"text\" id=\"campName\" class=\"sel\" maxlength=\"18\" value=\"{0}\"></div>", RA.esc(this.settings.name || 'Kotromanić'));
    const col0 = RA.PLAYER_COLORS.includes(this.settings.color) ? this.settings.color : RA.PLAYER_COLORS[0];
    h += RA.t("<div class=\"field\"><span class=\"lab\">Dynasty colour (the same in every age)</span><div class=\"seg wrap swatches\" id=\"campColor\">{0}</div></div>", RA.PLAYER_COLORS.map((c) => `<button data-v="${c}" aria-pressed="${c === col0}" aria-label="Boja ${c}" style="--sw:${c}"><span></span></button>`).join(''));
    h += RA.t("<div class=\"sec-t\">Dynasty home</div><div class=\"campaign-homes qm-grid\">");
    for (const hm of RA.CAMP_HOMES) {
      const ok = hm.map === 'evropa' || world;
      h += `<button class="btn" data-home="${hm.id}" ${ok ? '' : RA.t("disabled title=\"The world map is only on war.deovilab.com\"")}><span class="t">${RA.esc(hm.name)}</span>${hm.map === 'svijet' ? RA.t("<br><span class=\"d\">world</span>") : ''}</button>`;
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
    const ch = id >= 0 ? Math.floor(id / 10) : -1 - id, m = id >= 0 ? RA.campMission(ch, id % 10) : { id, ch, type: 'free', era: RA.CAMPAIGN[ch].era, diff: RA.CAMPAIGN[ch].diff, title: RA.t("Free play") };
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
        prog = RA.t("{0}% / {1}% of the land", (share * 100).toFixed(1), (goal * 100).toFixed(1));
        break;
      }
      case 'expand40':
        ok = share >= 0.4;
        prog = RA.t("{0}% / 40% of the land", (share * 100).toFixed(1));
        break;
      case 'cities': {
        const n = G.campCities(me), goal = G.camp.cities0 + 3;
        ok = n >= goal;
        prog = RA.t("{0} / {1} cities", n, goal);
        break;
      }
      case 'gold': {
        if (!G.camp.goldGoal) G.camp.goldGoal = Math.round(Math.max(600000, (me.goldRate || 1000) * 150) / 10000) * 10000;
        ok = me.gold >= G.camp.goldGoal;
        prog = RA.t("{0} / {1} gold", RA.fmt(me.gold), RA.fmt(G.camp.goldGoal));
        break;
      }
      case 'allies': {
        const a = G.allyCount(me), t = me.trade.size;
        ok = a >= 2 && t >= 2;
        prog = RA.t("military {0}/2 · trade {1}/2", a, t);
        break;
      }
      case 'conquerWeak':
      case 'conquerStrong':
        ok = !T || !T.alive;
        prog = T ? RA.t("{0}: {1}% of the land", T.name, ((T.area / G.landTotal()) * 100).toFixed(1)) : '';
        break;
      case 'defend': {
        const cap = me.capCity >= 0 ? G.cities[me.capCity] : null;
        fail = fail || (cap && cap.owner !== me.id);
        ok = !fail && mins >= 8;
        prog = RA.t("capital holds · {0}", RA.fmtTime(Math.max(0, (8 - mins) * 60)));
        break;
      }
      case 'survive':
        ok = me.alive && mins >= 10;
        prog = RA.t("survive {0} more", RA.fmtTime(Math.max(0, (10 - mins) * 60)));
        break;
      case 'win':
        ok = G.winner === me;
        prog = RA.t("{0}% / 70% of the land", (share * 100).toFixed(1));
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
      h = this.head(RA.t("Mission accomplished!"), `${RA.esc(m.title)} · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${RA.fmtTime(mins * 60)}`) + RA.t("<p class=\"explain\">The {0} dynasty gains <b>+{1} experience</b>. {2}</p>", RA.esc(c.name), xp, m.i === 9 ? RA.t("Chapter complete — the next age is open!") : '');
    } else {
      this.audio.play('lose');
      h = this.head(RA.t("Mission failed"), RA.esc(m.title)) + RA.t("<p class=\"explain\">Try again — maybe with a different strategy or after investing in the tree.</p>");
    }
    h += `<div class="btns">${this.btn({ icon: 'flag', cls: 'primary', attrs: 'data-camp', t: RA.t("Campaign"), d: RA.t("Chapters, missions and the tree") })}${won ? this.btn({ icon: 'play', attrs: 'data-cont', t: RA.t("Keep playing this map"), d: RA.t("No goal") }) : this.btn({ icon: 'play', attrs: 'data-retry', t: RA.t("Try again") })}</div>`;
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

'use strict';
/* Ratni Atlas — bottom sheets: army, build, landing, missiles, diplomacy, map-cell menu, menu, how-to, end screen */

/* key moments on the end-of-game chart (G.marks) */
RA.MARKS = {
  war: { s: '⚔', c: '#ff6b6b', n: RA.t("war") }, ally: { s: '⛨', c: '#6fdc8c', n: RA.t("alliance") }, break: { s: '✂', c: '#ffb04a', n: RA.t("betrayal") },
  cap: { s: '♛', c: '#f2c14e', n: RA.t("capital fell") }, fall: { s: '☠', c: '#b9c3cc', n: RA.t("state fell") }, nuke: { s: '☢', c: '#ff3df0', n: RA.t("nuke") },
};
/* reasons of a state's opinion of you (keys of G.relTo) */
RA.WHY = {
  atk: RA.t("attacks on them"), boat: RA.t("a landing on their coast"), offer: RA.t("you offered an alliance"), decl: RA.t("you declined their alliance"), ally: RA.t("military alliance"),
  betray: RA.t("you betrayed them"), traitor: RA.t("you betrayed an ally"), nuke: RA.t("nukes"), strike: RA.t("missile strikes"), para: RA.t("paratroopers on their land"),
  tdecl: RA.t("you declined trade"), trade: RA.t("trade pact"), tcancel: RA.t("you stopped trading"), gift: RA.t("you sent them troops"), vdecl: RA.t("you asked them to be a vassal"),
  vassal: RA.t("vassal"), rebel: RA.t("a revolt against you"), loan: RA.t("you repaid a loan"), pledge: RA.t("you didn't repay a loan"), strait: RA.t("a closed strait"), bomb: RA.t("bombing"),
  hegemon: RA.t("you are too strong"), spy: RA.t("your agent was caught"), deal: RA.t("deals"), ae: RA.t("aggressive expansion"), tech: RA.t("diplomacy (research)"), camp: RA.t("campaign mission"),
};

Object.assign(RA.UI.prototype, {
  /* why a unit can't be recruited right now ('' = ok) */
  unitWhy(type) {
    const G = this.G, me = G.me, U = RA.UNIT[type];
    const cap = G.unitCap(me);
    if (me.units.length >= cap) return RA.t("Limit of {0} units — every barracks adds {1}", cap, RA.CFG.UNIT_PER_BARRACKS);
    if (U.na) return RA.t("Doesn't exist in this era");
    if (U.needs && !me.n[U.needs]) return RA.t("Needs a building: {0}", RA.STRUCT[U.needs].name);
    if (U.naval && G._portLaunch(me, me.capital) < 0) return RA.t("You need a ready port on the sea");
    if (me.gold < G.unitCost(me, type)) return RA.t("Not enough gold{=2}");
    if (me.troops < U.troops * 1.2) return RA.t("Too few troops");
    return '';
  },
  unitStatus(u) {
    const tk = this.G.tick;
    if (u.ready > tk) return RA.t("deploying");
    if (u.empUntil > tk) return RA.t("EMP — out of action");
    if (tk - u.lastHit < 20) return RA.t("in combat");
    if (u.path && u.pi < u.path.length) return RA.t("moving");
    return RA.t("in position");
  },

  /* ---------------- army ---------------- */
  armySheet(keep) {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    if (this.mode && (this.mode.kind === 'recruit' || this.mode.kind === 'unit')) this.setMode(null);
    const C = RA.CFG, tk = G.tick, cap = G.unitCap(me);
    let h = this.head(RA.t("Army"), RA.t("Units {0}/{1} · troops {2} · gold {3}", me.units.length, cap, RA.fmt(me.troops), RA.fmt(me.gold)));
    const ready = tk >= me.mobReady;
    const add = me.maxT * C.MOB_SHARE;
    h += '<div class="btns">' + this.btn({
      icon: 'mob', cls: ready ? 'primary' : '', attrs: 'data-mob', dis: !ready,
      t: RA.t("Mobilisation"),
      d: ready ? RA.t("Instantly +{0} troops. Army growth then stops for 45 s.", RA.fmt(add)) : RA.t("Ready again in {0}", RA.dur(me.mobReady - tk)),
      r: '+' + RA.fmt(add),
    }) + '</div>';
    h += RA.t("<div class=\"sec-t\">Recruit a unit</div><p class=\"explain\">Place it along the border — it follows the front by itself. It makes enemy breakthroughs harder and your attacks nearby cheaper.</p><div class=\"btns\">");
    for (const type of ['inf', 'tank', 'art', 'ship', 'sub']) {
      const U = RA.UNIT[type];
      if (U.na) continue;
      if (type === 'ship') h += RA.t("</div><div class=\"sec-t\">Navy</div><p class=\"explain\">Ships sail out of your port. Tap a ship, then the sea, to send it. A warship blockades enemy ports nearby and shells the coast.</p><div class=\"btns\">");
      const why = this.unitWhy(type);
      h += this.btn({
        model: U.sym || type, cls: 'model-btn', icon: U.sym || type, attrs: `data-rec="${type}"`, dis: !!why,
        t: U.name, d: RA.esc(why || U.desc),
        r: RA.t("{0}<small>−{1} troops</small>", RA.fmt(G.unitCost(me, type)), RA.fmt(U.troops)),
      });
    }
    // the production queue: units come out by themselves when there is gold, troops and a free slot
    const Q = me.queue || [], qt = ['inf', 'tank', 'art', 'ship', 'sub'].filter((t) => !RA.UNIT[t].na);
    h += RA.t("</div><div class=\"sec-t\">Production queue ({0}/{1})</div><p class=\"explain\">Order ahead: each unit comes out as soon as there is gold, troops and a free slot (also while you're away) and goes to the border facing your enemy.</p>", Q.length, RA.CFG.QUEUE_MAX);
    h += `<div class="queue-row">${Q.length ? Q.map((t) => `<span class="chip-q">${RA.icon(RA.UNIT[t].sym || t)}${RA.esc(RA.UNIT[t].name)}</span>`).join('') : RA.t("<span class=\"note\">Empty.</span>")}</div>`;
    h += `<div class="queue-row">${qt.map((t) => this.mini('+ ' + RA.esc(RA.UNIT[t].name), `data-q="${t}"`, 'ok', Q.length >= RA.CFG.QUEUE_MAX)).join('')}${Q.length ? this.mini(RA.t("Clear"), 'data-qclear', 'warn') : ''}</div>`;
    h += RA.t("<div class=\"sec-t\">Your units</div>");
    if (!me.units.length) h += RA.t("<p class=\"note\" style=\"margin-top:0\">You have no units yet.</p>");
    else {
      h += '<div class="list">';
      for (const u of me.units) {
        const U = RA.UNIT[u.type];
        h += RA.t("<div class=\"prow hasu\"><span class=\"sw u\">{0}</span><div class=\"pn\" data-sel=\"{1}\"><div class=\"nm\">{2}</div><div class=\"d\">{3}% strength · {4}</div></div><div class=\"bb\">{5}{6}</div></div>", RA.Models.preview(U.sym || u.type, me.hex), u.id, U.name, Math.round((u.hp / U.hp) * 100), this.unitStatus(u), this.mini(RA.t("Show"), `data-sel="${u.id}"`, '', false, 'eye'), this.mini(RA.t("Disband"), `data-dis="${u.id}"`, 'warn'));
      }
      h += '</div>';
    }
    const needs = ['inf', 'tank', 'art'].map((t) => RA.UNIT[t]).filter((U) => !U.na && U.needs).map((U) => `${U.name} ${U.pl ? RA.t("need") : RA.t("needs")}: ${RA.STRUCT[U.needs].name}`).join('. ');
    h += RA.t("<p class=\"note\">Limit: {0} + {1} per “{2}”. {3}Tap your unit on the map, then a new spot, to move it. Disbanding returns 60% of the troops.</p>", C.UNIT_BASE_CAP, C.UNIT_PER_BARRACKS, RA.STRUCT.barracks.name, needs ? needs + '. ' : '');
    this.openSheet(h, (s) => {
      const mb = s.querySelector('[data-mob]');
      if (mb) mb.onclick = () => {
        this.closeSheet();
        this.act('mob', []);
      };
      s.querySelectorAll('[data-rec]').forEach((b) => (b.onclick = () => {
        this.closeSheet();
        // a ship needs no place: it leaves the port nearest to the capital (or tap near another port)
        if (RA.UNIT[b.dataset.rec].naval) this.act('rec', [b.dataset.rec, me.capital]);
        else this.setMode({ kind: 'recruit', type: b.dataset.rec });
      }));
      s.querySelectorAll('[data-sel]').forEach((b) => (b.onclick = () => {
        const u = me.units.find((x) => x.id === +b.dataset.sel);
        this.closeSheet();
        if (!u) return;
        this.app.lmap.flyTo(G.map.latLngOfXY(u.x, u.y), Math.max(this.app.lmap.getZoom(), this.app.zoomAt(5.6)), { duration: 0.7 });
        this.setMode({ kind: 'unit', id: u.id });
      }));
      s.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => {
        this.act('queue', [b.dataset.q, 1]);
        setTimeout(() => this.armySheet(true), G.online || G.long ? 1200 : 30);
      }));
      const qc = s.querySelector('[data-qclear]');
      if (qc) qc.onclick = () => {
        this.act('queue', ['', 0]);
        setTimeout(() => this.armySheet(true), G.online || G.long ? 1200 : 30);
      };
      s.querySelectorAll('[data-dis]').forEach((b) => (b.onclick = () => {
        const u = me.units.find((x) => x.id === +b.dataset.dis);
        if (!u) return;
        this.act('dis', [u.id]);
      }));
    }, keep, () => this.armySheet(true));
  },

  /* ---------------- build ---------------- */
  buildSheet() {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    if (this.mode && this.mode.kind === 'build') this.setMode(null);
    let h = this.head(RA.t("Build"), RA.t("Gold {0} · the price rises with every building of the same type", RA.fmt(me.gold)));
    h += '<div class="btns">';
    for (const t of RA.STRUCT_ORDER) {
      const S = RA.STRUCT[t];
      if (S.tree && !G.opts.tree) continue; // the intelligence agency comes with the tech tree
      const cost = G.structCost(me, t);
      h += this.btn({
        model: S.icon || t, cls: 'model-btn', icon: S.icon || t, attrs: `data-t="${t}"`, dis: me.gold < cost,
        t: `${S.name} <span class="d">(${me.n[t]})</span>`, d: RA.esc(S.desc), r: RA.fmt(cost),
      });
    }
    const C = RA.CFG, trenchCost = Math.round(C.TRENCH_GOLD * (me.bCost || 1));
    let ready = 0, digging = 0;
    for (const c of new Set(G.trenchCells || [])) if (G.owner[c] === me.id) {
      if (G.trench[c] === 2) ready++;
      else if (G.trench[c] === 1) digging++;
    }
    const reason = ready + digging >= C.TRENCH_MAX ? RA.t("Trench limit reached") : me.gold < trenchCost ? RA.t("Not enough gold for one section") : '';
    h += `<button class="btn trench-build" data-trench ${reason ? 'disabled' : ''}>
      <svg class="trench-preview" viewBox="0 0 80 64" fill="none" aria-hidden="true">
        <path d="M5 43h15V26h20v13h19V22h16" stroke="#302a20" stroke-width="14" stroke-linejoin="round"/>
        <path d="M5 43h15V26h20v13h19V22h16" stroke="#ac9467" stroke-width="11" stroke-linejoin="round"/>
        <path d="M5 43h15V26h20v13h19V22h16" stroke="#252720" stroke-width="5" stroke-linejoin="round"/>
        <path d="M18 34h4m6-10v4m10 3h4m6 6v4m9-13h4m7-8v4" stroke="#d5bd8e" stroke-width="1.5"/>
      </svg>
      <span class="trench-copy"><span class="t">${RA.t("Trenches")}</span>
        <span class="d">${RA.t("Tap your side of a border to dig a connected defensive line.")}</span>
        <span class="trench-meta"><b>${RA.t("{0}/cell", RA.fmt(trenchCost))}</b><span>${RA.t("Ready in {0} s", C.TRENCH_SECS)}</span></span>
        <span class="trench-state">${reason || RA.t("Ready {0} · digging {1} · limit {2}", ready, digging, C.TRENCH_MAX)}</span>
      </span>
    </button>`;
    h += RA.t("</div><p class=\"note\">After choosing, tap a spot on your land. Buildings must be at least 4 cells apart, and a new city at least 5 cells from existing cities.</p>");
    this.openSheet(h, (s) => {
      s.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => {
        this.closeSheet();
        this.setMode({ kind: 'build', type: b.dataset.t });
      }));
      const tb = s.querySelector('[data-trench]');
      if (tb) tb.onclick = () => (this.closeSheet(), this.setMode({ kind: 'trench' }));
    });
  },

  /* ---------------- landings: boats & paratroopers ---------------- */
  readyAirports() {
    const G = this.G, me = G.me, tk = G.tick;
    const all = G.structs.filter((s) => !s.dead && s.ready && s.owner === me.id && s.type === 'airport');
    return { all: all.length, ready: all.filter((s) => s.cd <= tk && s.empUntil <= tk).length };
  },
  landSheet() {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    if (!me.n.airport || !RA.ERA.para) {
      this.setMode({ kind: 'boat' });
      if (!this.paraHint && RA.ERA.para) {
        this.paraHint = true;
        this.toast('tip', RA.t("With an airfield (Build → Airfield) you also get paratroop drops here."), { ms: 5000 });
      }
      return;
    }
    const C = RA.CFG, ap = this.readyAirports();
    const troops = RA.fmt(me.troops * this.ratio);
    let h = this.head(RA.t("Landing"), RA.t("Ships {0}/{1} · ready airfields {2}/{3}", me.boats, C.BOAT_MAX, ap.ready, ap.all));
    h += '<div class="btns">';
    h += this.btn({ model: 'boat', cls: 'model-btn', icon: 'boat', attrs: 'data-l="boat"', dis: me.boats >= C.BOAT_MAX, t: RA.t("By ship"), d: RA.t("Tap a foreign or free coast. The ship sails around the land."), r: troops });
    h += this.btn({
      model: 'plane', cls: 'model-btn', icon: 'para', attrs: 'data-l="para"', dis: !ap.ready || me.gold < C.PARA_GOLD, t: RA.t("Paratroopers"),
      d: ap.ready ? RA.t("Jump up to {0} cells from an airfield · {1} gold · air defence can shoot them down", C.PARA_RANGE, RA.fmt(C.PARA_GOLD)) : RA.t("The airfields are reloading — wait"),
      r: troops,
    });
    h += RA.t("</div><p class=\"note\">You send {0}% of your troops (the “Attack strength” slider).</p>", Math.round(this.ratio * 100));
    h += this.airHtml();
    this.openSheet(h, (s) => {
      s.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => {
        this.closeSheet();
        this.setMode({ kind: b.dataset.l });
      }));
      s.querySelectorAll('[data-air]').forEach((b) => (b.onclick = () => this.act('air', [b.dataset.air])));
      const bb = s.querySelector('[data-bomb]');
      if (bb) bb.onclick = () => {
        this.closeSheet();
        this.setMode({ kind: 'bomb' });
      };
    }, true, () => this.landSheet());
  },
  /* the air force: squadrons at your airports, buy more, send the bombers (tipka A) */
  airHtml() {
    const G = this.G, me = G.me, C = RA.CFG, tk = G.tick;
    if (!RA.airOn()) return '';
    const sq = me.air || [], aps = G.airportsOf(me).length;
    const cnt = (k) => sq.filter((q) => q.type === k).length, rdy = (k) => sq.filter((q) => q.type === k && q.readyAt <= tk).length;
    let h = RA.t("<div class=\"sec-t\">Air force · key A</div><p class=\"explain\">Squadrons wait at the airfield (at most {0} of each type per airfield). Fighters shoot down enemy planes over places up to {1} cells from the airfield and escort yours; air defence shoots down everything.</p><div class=\"btns\">", C.AIR_PER_AIRPORT, C.FIGHT_R);
    for (const k of ['fighter', 'bomber']) {
      const A = RA.AIR[k], full = cnt(k) >= aps * C.AIR_PER_AIRPORT;
      h += this.btn({ model: 'plane', cls: 'model-btn', icon: 'para', attrs: `data-air="${k}"`, dis: full || me.gold < A.cost, t: RA.t("{0} · {1}/{2} ready", RA.airName(k), rdy(k), cnt(k)), d: full ? RA.t("The airfields are full — build another one.") : A.desc, r: RA.fmt(A.cost) });
    }
    h += this.btn({ icon: 'attack', cls: 'primary', attrs: 'data-bomb', dis: !rdy('bomber') || G.inPeace(), t: RA.t("Bomb"), d: rdy('bomber') ? RA.t("Tap enemy land up to {0} cells from an airfield.", C.BOMB_RANGE) : cnt('bomber') ? RA.t("The bombers are in the air or reloading.") : RA.t("Buy bombers first.") });
    return h + '</div>';
  },

  /* ---------------- missiles ---------------- */
  strikeSheet() {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    if (this.mode && this.mode.kind === 'missile') this.setMode(null);
    const tk = G.tick;
    const SN = RA.STRUCT.silo;
    const silos = G.structs.filter((s) => !s.dead && s.ready && s.owner === me.id && s.type === 'silo');
    const ready = silos.filter((s) => s.cd <= tk && s.empUntil <= tk).length;
    let h = this.head(RA.ERA.strikeTab, silos.length ? RA.t("{0}: {1} · {2} ready · gold {3}", SN.name, silos.length, ready, RA.fmt(me.gold)) : RA.t("You need a building: {0}", SN.name));
    h += '<div class="btns">';
    if (!me.n.silo) {
      const cost = G.structCost(me, 'silo');
      h += this.btn({ icon: SN.icon || 'silo', cls: 'primary', attrs: 'data-silo', dis: me.gold < cost, t: RA.t("Build: {0}", SN.name), d: me.gold >= cost ? RA.t("Then tap a spot on your land") : RA.t("Not enough gold"), r: RA.fmt(cost) });
    }
    const peace = G.inPeace();
    for (const t of RA.missileTypes()) {
      const M = RA.MISSILE[t];
      if (G.opts.noNuke && (M.kind === 'nuke' || M.kind === 'mirv')) continue;
      const cost = G.missileCost(t, me);
      const wait = M.from && tk < M.from;
      h += this.btn({
        model: M.kind === 'drone' ? (M.hunt ? 'hunter-drone' : 'drone') : M.icon === 'siege' ? 'siege' : M.icon === 'zeppelin' ? 'zeppelin' : 'missile', icon: RA.missileIcon(t), cls: M.kind === 'conv' ? 'model-btn' : 'model-btn danger', attrs: `data-m="${t}"`,
        dis: (!me.n.silo && M.kind !== 'drone') || me.gold < cost || peace || wait, t: M.name,
        d: RA.esc(wait ? RA.t("In development — available in {0}.", RA.dur(M.from - tk)) : M.desc) + (M.range ? RA.t(" <b>Range {0} cells.</b>", M.range) : '') + this.nukeBar(M), r: RA.fmt(cost),
      });
    }
    const sam = RA.STRUCT.sam;
    h += RA.t("</div><p class=\"note\">{0}The first tap on the map aims and shows the blast area, the second tap (or “Launch”) fires. Drones fly on every tap.{1}{2}{3}</p>", peace ? RA.t("<b>Peace time:</b> strikes are allowed in {0}. ", G.peaceLeft()) : '', RA.missileTypes().some((t) => RA.MISSILE[t].range) ? RA.t(" White circles show the range of your buildings — build them closer to the front.") : '', sam.na ? '' : RA.t(" An enemy “{0}” shoots down missiles within {1} cells (red circles while aiming).", sam.name, RA.CFG.SAM_R), RA.MISSILE.atom.na ? '' : RA.t(" Nukes sour relations with everyone; an ally you hit breaks the alliance."));
    this.openSheet(h, (s) => {
      const b = s.querySelector('[data-silo]');
      if (b) b.onclick = () => {
        this.closeSheet();
        this.setMode({ kind: 'build', type: 'silo' });
      };
      s.querySelectorAll('[data-m]').forEach((b2) => (b2.onclick = () => {
        this.closeSheet();
        this.setMode({ kind: 'missile', type: b2.dataset.m });
      }));
    });
  },
  fireMissile(type, c) {
    const G = this.G, me = G.me, M = RA.MISSILE[type];
    const O = G.owner[c] ? G.P[G.owner[c]] : null;
    if (type === 'mirv' && (!O || O === me)) {
      this.toast('info', RA.t("A MIRV targets a state — tap foreign land."));
      return false;
    }
    if (G.inPeace()) {
      this.toast('info', RA.t("Peace time — strikes are allowed in {0}.", G.peaceLeft()));
      return false;
    }
    if (M.range && M.kind !== 'drone' && !G.strikeSilo(me, type, c, true)) {
      this.toast('info', RA.t("Target out of range ({0} cells from a {1}). Build closer to the front.", M.range, RA.STRUCT.silo.name));
      return false;
    }
    if (me.gold < G.missileCost(type, me)) {
      this.toast('info', RA.t("Not enough gold."));
      return false;
    }
    this.act('mis', [type, c]);
    // the strike mode stays: tap the next target (4 drones for a tank = 4 taps), "Odustani" ends it (Darko, 27. 9.)
    this.setMode({ kind: 'missile', type, aim: -1, fired: ((this.mode && this.mode.fired) || 0) + 1 });
    return true;
  },
  confirm(title, text, yes, fn) {
    const h = this.head(title, '') + RA.t("<p class=\"note\" style=\"margin-top:-4px;font-size:14px;color:#c9d4dc\">{0}</p><div class=\"btns\" style=\"margin-top:14px\"><button class=\"btn danger\" data-y><span class=\"t\">{1}</span></button><button class=\"btn\" data-n><span class=\"t\">Cancel</span></button></div>", RA.esc(text), RA.esc(yes));
    this.openSheet(h, (s) => {
      s.querySelector('[data-y]').onclick = () => {
        this.closeSheet();
        fn();
      };
      s.querySelector('[data-n]').onclick = () => this.closeSheet();
    });
  },

  /* ---------------- diplomacy: military alliances vs trade agreements ---------------- */
  diploButtons(O, full) {
    const G = this.G, me = G.me, C = RA.CFG;
    const b = [];
    const team = G.sameTeam(me, O);
    if (me.allies.has(O.id)) {
      if (full) {
        b.push(this.mini(RA.t("Send {0}% of troops", Math.round(this.ratio * 100)), `data-do="send:${O.id}"`, 'ok', me.troops < 200, 'send'));
        b.push(this.mini(RA.t("Ask for help"), `data-do="help:${O.id}"`, '', false, 'flag'));
      }
      if (O.lord === me.id) b.push(this.mini(RA.t("Release"), `data-do="brk:${O.id}"`, 'warn'));
      else if (!team && me.lord !== O.id) {
        b.push(this.mini(RA.t("Extend"), `data-do="ext:${O.id}"`));
        b.push(this.mini(RA.t("Break"), `data-do="brk:${O.id}"`, 'warn'));
      }
    } else {
      const why = G.allyCount(me) >= C.ALLY_MAX ? 'limit' : G.allyCount(O) >= C.ALLY_MAX ? 'puno' : '';
      if (!O.lord) b.push(this.mini(RA.t("Military alliance"), `data-do="propA:${O.id}"`, '', !!why || !!me.lord || G.allyReqs.some((r) => r.from === me.id && r.to === O.id), 'ally'));
      // a weak neighbour (or a beaten enemy) can become a vassal instead of being conquered
      if (!(O.human && !O.ai) && !G.vassalErr(me, O)) b.push(this.mini(RA.t("Vassal"), `data-do="vas:${O.id}"`, 'ok', false, 'flag'));
    }
    if (O.type !== 'bot') b.push(this.mini(RA.t("Negotiate"), `data-do="deal:${O.id}"`, '', false, 'trade'));
    if (G.opts.tree && me.n.intel && O.type !== 'bot' && !G.isFriendly(me, O)) b.push(this.mini(RA.t("Intelligence"), `data-do="spy:${O.id}"`, '', false, 'eye'));
    if (G.online && O.human && O !== me) b.push(this.mini(RA.t("Report"), `data-do="rep:${O.id}"`, 'warn'));
    // Conquest League 5v5: vote to kick a teammate (4 of the other 4; the computer takes the state)
    if (G.opts.league === 5 && me && O.human && O !== me && O.team === me.team && !O.kicked) b.push(this.mini(me.kickVote === O.id ? RA.t("Voted") : RA.t("Kick"), `data-do="kick:${O.id}"`, 'warn', me.kickVote === O.id));
    if (me.trade.has(O.id)) b.push(this.mini(RA.t("Stop trade"), `data-do="endT:${O.id}"`, 'warn'));
    else b.push(this.mini(RA.t("Trade"), `data-do="propT:${O.id}"`, '', me.trade.size >= C.TRADE_MAX || O.trade.size >= C.TRADE_MAX || G.atWar(me, O), 'trade'));
    return b.join('');
  },
  diploAct(act, id) {
    if (act === 'chat') return this.quickSheet();
    if (act === 'offY' || act === 'offN') return this.act('offerRes', [id, act === 'offY' ? 'yes' : 'no']);
    if (act === 'offC') {
      const o = this.G.offers.find((x) => x.id === id);
      // a counter-offer: I give what they asked for and ask for what they offered — then change it
      return o && this.dealSheet(o.from, { give: o.want, want: o.give, reply: o.id });
    }
    if (act === 'deal') return this.dealSheet(id);
    if (act === 'spy') return this.intelSheet(id);
    if (act === 'rep') return this.reportSheet(this.G.P[id]);
    if (act === 'kick') return this.confirm(RA.t("Kick {0}?", RA.esc(this.G.P[id].nick || this.G.P[id].name)), RA.t("You vote to kick them from the team. When 4 teammates vote, the computer takes over the state."), RA.t("Vote"), () => this.act('kick', [id]));
    const G = this.G, me = G.me, O = G.P[id];
    if (!me || !O) return;
    const map = { accA: ['aRes', [id, 1]], decA: ['aRes', [id, 0]], accT: ['tRes', [id, 1]], decT: ['tRes', [id, 0]], propA: ['aReq', [id]], propT: ['tReq', [id]], send: ['give', [id, this.ratio]], help: ['help', [id]], vas: ['vas', [id]], ext: ['ext', [id]], endT: ['tEnd', [id]] };
    if (act === 'show') {
      this.closeSheet();
      this.focusPlayer(id);
      return;
    }
    if (act === 'brk' && O.lord === me.id) {
      this.confirm(RA.t("Release the vassal ({0})?", O.name), RA.t("It no longer pays you tribute or fights at your side. It's not a betrayal."), RA.t("Release"), () => this.act('brk', [id]));
      return;
    }
    if (act === 'brk') {
      this.confirm(RA.t("Break the military alliance ({0})?", O.name), RA.t("That's a betrayal: your defence is halved for 30 seconds, and the other states trust you less."), RA.t("Break the alliance"), () => this.act('brk', [id]));
      return;
    }
    if (map[act]) this.act(map[act][0], map[act][1]);
  },
  bindDiplo(s) {
    // onclick, not addEventListener: #sheet outlives every redraw, and stacked listeners doubled each click
    s.onclick = (e) => {
      const b = e.target.closest('[data-do]');
      if (!b || b.disabled) return;
      const [act, id] = b.dataset.do.split(':');
      this.diploAct(act, +id);
    };
  },
  diploSheet(keep) {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    const C = RA.CFG, tk = G.tick;
    const row = (o, meta, buttons, wide) => `<div class="prow${wide ? ' wide' : ''}"><span class="sw" style="background:${o.hex}"></span><div class="pn" data-do="show:${o.id}"><div class="nm">${RA.esc(o.name)}</div><div class="d">${meta}</div></div><div class="bb">${buttons}</div></div>`;
    let h = this.head(RA.t("Alliances"), RA.t("Military {0}/{1} · trade {2}/{3} · +{4}/s from trade", G.allyCount(me), C.ALLY_MAX, me.trade.size, C.TRADE_MAX, RA.fmt(me.tradeRate || 0)));
    const ae = Math.round(me.ae || 0);
    h += RA.t("<p class=\"explain\">Aggressive expansion: <b{0}>{1}/100</b>. It rises with every state you attack and conquer (the number of states, not the area) and fades with time. From {2} computer states avoid you, break alliances with you and join forces against you.</p>", ae >= C.AE_COALITION ? ' class="neg"' : '', ae, C.AE_COALITION);
    if (G.online) h += `<div class="btns" style="margin-bottom:10px">${this.btn({ icon: 'chat', attrs: 'data-do="chat:0"', t: RA.t("Quick messages to allies"), d: RA.t("Messages and emoji your allies and team see (key T)") })}</div>`;
    // offers
    const offers = G.allyReqs.filter((r) => r.to === me.id).map((r) => ['A', r]).concat(G.tradeReqs.filter((r) => r.to === me.id).map((r) => ['T', r]));
    if (offers.length) {
      h += RA.t("<div class=\"sec-t\">Offers</div><div class=\"list\">");
      for (const [k, r] of offers) {
        const o = G.P[r.from];
        h += row(o, k === 'A' ? RA.t("offers a <b>military alliance</b>") : RA.t("offers a <b>trade pact</b>"), this.mini(RA.t("Accept"), `data-do="acc${k}:${o.id}"`, 'ok') + this.mini(RA.t("Decline"), `data-do="dec${k}:${o.id}"`));
      }
      h += '</div>';
    }
    // offers and demands from other states (02l-offers.js)
    const deals = G.offers.filter((o) => o.to === me.id);
    if (deals.length) {
      h += RA.t("<div class=\"sec-t\">Deal offers</div><div class=\"list\">");
      for (const d of deals) {
        const o = G.P[d.from];
        h += row(o, RA.t("gives: <b>{0}</b><br>wants: <b>{1}</b>", RA.esc(G.offerText(d.give)), RA.esc(G.offerText(d.want))), this.mini(RA.t("Accept"), `data-do="offY:${d.id}"`, 'ok') + this.mini(RA.t("Counter-offer"), `data-do="offC:${d.id}"`) + this.mini(RA.t("Decline"), `data-do="offN:${d.id}"`), true);
      }
      h += '</div>';
    }
    // military alliances
    h += RA.t("<div class=\"sec-t\">Military alliances · {0}/{1}</div><p class=\"explain\">You don't attack each other. When someone attacks you, your allies strike at them or send you troops. Lasts 5 min, can be extended.</p>", G.allyCount(me), C.ALLY_MAX);
    if (!me.allies.size) h += RA.t("<p class=\"note\" style=\"margin-top:0\">You have no military allies.</p>");
    else {
      h += '<div class="list">';
      for (const [oid, exp] of me.allies) {
        const o = G.P[oid];
        const kind = o.lord === me.id ? RA.t("<span class=\"tag al\">vassal · tribute +{0}/s</span>", RA.fmt(o.tribute || 0)) : me.lord === oid ? RA.t("<span class=\"tag al\">your overlord · you pay tribute</span>") : isFinite(exp) ? RA.t("expires in ") + RA.fmtTime(Math.max(0, (exp - tk) / 10)) : RA.t("<span class=\"tag al\">team · permanent alliance</span>");
        h += row(o, RA.t("{0} · army {1}{2}", kind, RA.fmt(o.troops), o.trade && me.trade.has(oid) ? RA.t(" · <span class=\"tag tr\">⇄ trade</span>") : ''), this.diploButtons(o, true), true);
      }
      h += '</div>';
    }
    // trade agreements
    h += RA.t("<div class=\"sec-t\">Trade pacts · {0}/{1}</div><p class=\"explain\">Trade ships between your ports and trade across a shared border bring gold to both sides. No duty to help in war. An attack ends the trade.</p>", me.trade.size, C.TRADE_MAX);
    if (!me.trade.size) h += RA.t("<p class=\"note\" style=\"margin-top:0\">You have no trade pacts. Sea trade needs ports; neighbours can also trade over land.</p>");
    else {
      h += '<div class="list">';
      for (const oid of me.trade) {
        const o = G.P[oid];
        const land = me.nbCache && me.nbCache.has(oid);
        const via = [land ? RA.t("by land") : '', me.n.port && o.n.port ? RA.t("by sea") : ''].filter(Boolean).join(RA.t(" and ")) || RA.t("no route — ports or a border needed");
        const rs = G.deps && o.res ? RA.t(" · has: ") + ([0, 1, 2].filter((s) => o.res[s]).map((s) => `${RA.resKind(s, G.era).name} ${Math.round(G.resRate(o, s) * 100)}%`).join(', ') || RA.t("nothing")) : '';
        h += row(o, RA.t("trade: {0}{1}", via, rs), this.mini(RA.t("Stop"), `data-do="endT:${oid}"`, 'warn'));
      }
      h += '</div>';
    }
    // everybody else
    const nb = me.nbCache || new Map();
    const others = G.P.filter((o) => o && o.alive && o.spawned && o !== me && (o.type !== 'bot' || nb.has(o.id)))
      .sort((a, b) => (nb.has(b.id) ? 1 : 0) - (nb.has(a.id) ? 1 : 0) || b.tiles - a.tiles)
      .slice(0, 24);
    h += RA.t("<div class=\"sec-t\">States</div><div class=\"list\">");
    for (const o of others) {
      const tags = (o.lord ? RA.t("<span class=\"tag al\">vassal: {0}</span>", RA.esc(G.P[o.lord].name)) : me.allies.has(o.id) ? RA.t("<span class=\"tag al\">⛨ alliance</span>") : '') + (me.trade.has(o.id) ? RA.t("<span class=\"tag tr\">⇄ trade</span>") : '');
      const meta = RA.t("{0}{1}army {2}{3}", o.ai ? this.relLabel(o.rel[me.id]) + ' · ' : '', nb.has(o.id) ? RA.t("neighbour · ") : '', RA.fmt(o.troops), tags);
      h += row(o, meta, this.diploButtons(o, false), true);
    }
    h += '</div>';
    h += RA.t("<p class=\"note\">Vassal: a weak state (at most {0}% of your troops and {1}% of your land), a neighbour or an enemy at war, may agree to be your vassal instead of being conquered — it pays {2}% of its income and fights at your side; at most {3}. If you weaken, it breaks free.</p>", Math.round(C.VASSAL_TROOPS * 100), Math.round(C.VASSAL_AREA * 100), Math.round(C.TRIBUTE * 100), C.VASSAL_MAX);
    h += RA.t("<p class=\"note\">At most {0} military alliances and {1} trade pacts. Betraying an ally = 30 s of halved defence and a bad name with everyone.</p>", C.ALLY_MAX, C.TRADE_MAX);
    this.openSheet(h, (s) => this.bindDiplo(s), keep, () => this.diploSheet(true));
  },

  /* ---------------- long-press menu for one map cell ---------------- */
  cellSheet(c, keep) {
    const G = this.G, map = G.map, me = G.me;
    if (c < 0 || !me || !me.alive) return;
    if (map.block[c]) {
      this.toast('info', RA.t("That's outside the chosen region."));
      return;
    }
    if (!map.land[c]) {
      this.toast('info', RA.t("Sea. For a landing pick “Landing”, then tap the coast."));
      return;
    }
    const W = map.W, C = RA.CFG, tk = G.tick;
    const cx = c % W, cy = (c / W) | 0;
    const ci = map.cityAt[c];
    let city = ci >= 0 ? map.cities[ci] : null;
    if (!city) for (const ct of G.cities) if (Math.abs(ct.x - cx) <= 2 && Math.abs(ct.y - cy) <= 2) city = ct;
    const terr = RA.TERR_NAME[map.terr[c]] + (map.river[c] ? RA.t(" · river") : '') + (map.coast[c] ? RA.t(" · coast") : '');
    const cityLine = city ? `${city.tier === 3 ? RA.t("Capital") : city.tier === 2 ? RA.t("Metropolis") : RA.t("City")} ${RA.esc(city.name)} · ` : '';
    const oid = G.owner[c];
    const O = oid ? G.P[oid] : null;
    const pct = (p) => ((p.area / G.landTotal()) * 100).toFixed(1).replace('.', RA.DEC) + '%';
    const unitsNear = G.units.filter((u) => !u.dead && Math.hypot(u.x - cx - 0.5, u.y - cy - 0.5) <= 4);
    const unitLine = unitsNear.length ? RA.t("<p class=\"explain\">Units here: {0}</p>", unitsNear.map((u) => `${RA.UNIT[u.type].name} (${RA.esc(G.P[u.owner].name)}, ${Math.round((u.hp / RA.UNIT[u.type].hp) * 100)}%)`).join(', ')) : '';
    let h = '';
    if (O === me) {
      h += this.head(RA.t("Your land"), cityLine + terr, me.hex) + unitLine;
      // my buildings here: level and upgrade (03f-upgrade.js)
      const mine = G.structs.filter((s) => !s.dead && s.owner === me.id && Math.abs(s.x - cx) <= 3 && Math.abs(s.y - cy) <= 3 && RA.UP_DESC[s.type]);
      if (mine.length) {
        h += RA.t("<div class=\"sec-t\">Your buildings here</div><div class=\"list\">");
        for (const s of mine) {
          const lv = s.lv || 1, cost = G.upCost(me, s);
          const st = !s.ready ? RA.t("under construction") : s.upTo ? RA.t("upgrading to level {0}", s.upTo) : lv >= RA.UP_MAX ? RA.t("top level") : RA.UP_DESC[s.type];
          const b = s.ready && !s.upTo && lv < RA.UP_MAX ? this.mini(RA.t("Level {0} · {1}", lv + 1, RA.fmt(cost)), `data-up="${s.id}"`, 'ok', me.gold < cost) : '';
          h += `<div class="prow wide building-upgrade"><div class="pn"><div class="nm">${RA.esc(s.type === 'city' ? s.name : RA.STRUCT[s.type].name)} · ${RA.t("level {0}", lv)}</div><div class="d">${RA.esc(st)}</div></div><div class="bb">${b}</div></div>`;
        }
        h += '</div>';
      }
      h += RA.t("<div class=\"sec-t\">Build here</div><div class=\"grid2\">");
      for (const t of RA.STRUCT_ORDER) {
        const S = RA.STRUCT[t];
        if (S.tree && !G.opts.tree) continue;
        const why = G.canBuild(me, t, c);
        const ok = typeof why === 'number';
        h += this.btn({ icon: S.icon || t, attrs: `data-build="${t}"`, dis: !ok, t: S.short || S.name, d: ok ? RA.fmt(G.structCost(me, t)) : RA.esc(why.replace(/\.$/, '')) });
      }
      h += RA.t("</div><div class=\"sec-t\">Place a unit here</div><div class=\"grid2\">");
      for (const t of ['inf', 'tank', 'art']) {
        const U = RA.UNIT[t];
        if (U.na) continue;
        const why = this.unitWhy(t);
        h += this.btn({ icon: U.sym || t, attrs: `data-unit="${t}"`, dis: !!why, t: U.name, d: why ? RA.esc(why) : `${RA.fmt(U.gold)} · −${RA.fmt(U.troops)}` });
      }
      h += '</div>';
      this.openSheet(h, (s) => {
        s.querySelectorAll('[data-build]').forEach((b) => (b.onclick = () => {
          this.closeSheet();
          this.act('build', [b.dataset.build, c]);
        }));
        s.querySelectorAll('[data-unit]').forEach((b) => (b.onclick = () => {
          this.closeSheet();
          this.act('rec', [b.dataset.unit, c]);
        }));
        s.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => {
          this.act('up', [+b.dataset.up]);
          setTimeout(() => this.cellSheet(c, true), G.online || G.long ? 1200 : 30);
        }));
      }, keep);
      return;
    }
    const troopsTxt = RA.fmt(me.troops * this.ratio);
    const peace = G.inPeace();
    const acts = [];
    const myAtt = G.attacks.find((a) => !a.done && a.a === me.id && a.t === oid);
    if (!O) {
      h += this.head(RA.t("Free land"), cityLine + terr) + unitLine;
      acts.push(this.btn({ icon: 'attack', cls: 'primary', attrs: 'data-act="attack"', t: RA.t("Expand here"), d: RA.t("The front heads for this point"), r: troopsTxt }));
    } else {
      const ally = me.allies.has(O.id);
      const kind = O.type === 'nation' ? RA.t("State · {0}", RA.PERS[O.ai.pers].label) : O.type === 'bot' ? RA.t("City-state") : RA.t("Player");
      const traitor = O.traitorUntil > tk ? RA.t(" · <b style=\"color:#ffb3b3\">traitor</b>") : '';
      h += this.head(O.name, `${kind}${traitor} · ${cityLine}${terr}`, O.hex);
      const cities = O.nCity[1] + O.nCity[2] + O.nCity[3] + O.n.city;
      h += RA.t("<div class=\"kv\"><div><div class=\"k\">Army</div><div class=\"v\">{0}</div></div><div><div class=\"k\">Land</div><div class=\"v\">{1}</div></div><div><div class=\"k\">Cities</div><div class=\"v\">{2}</div></div></div>", RA.fmt(O.troops), pct(O), cities);
      const tags = (ally ? RA.t(" · <span class=\"tag al\">⛨ military alliance</span>") : '') + (me.trade.has(O.id) ? RA.t(" · <span class=\"tag tr\">⇄ trade</span>") : '');
      if (O.ai) h += RA.t("<p class=\"explain\">Attitude towards you: {0}{1} · units: {2}</p>", this.relLabel(O.rel[me.id]), tags, O.units.length) + this.whyHtml(O);
      h += unitLine;
      if (!ally) {
        acts.push(this.btn({
          icon: 'attack', cls: 'primary', attrs: 'data-act="attack"', dis: peace,
          t: O ? RA.t("Attack this part") : RA.t("Take"), d: peace && O ? RA.t("Peace time — attacks in {0}", G.peaceLeft()) : O ? RA.t("{0}% of troops · from the nearest border to this point", Math.round(this.ratio * 100)) : RA.t("{0}% of troops, expanding towards this point", Math.round(this.ratio * 100)), r: troopsTxt,
        }));
        if (O) acts.push(this.btn({
          icon: 'attack', attrs: 'data-act="attackAll"', dis: peace,
          t: RA.t("Attack the whole border"), d: RA.t("{0}% of troops · a front wherever you touch this state", Math.round(this.ratio * 100)), r: troopsTxt,
        }));
      }
    }
    if (myAtt) acts.push(this.btn({ icon: 'retreat', attrs: 'data-act="retreat"', t: RA.t("Stop the attack"), d: RA.t("{0} troops in the attack · {1} come back", RA.fmt(myAtt.troops), O ? '75%' : RA.t("all")) }));
    if (map.coast[c] && (!O || !me.allies.has(O.id))) {
      acts.push(this.btn({ icon: 'boat', attrs: 'data-act="boat"', dis: me.boats >= C.BOAT_MAX || (O && peace), t: RA.t("A landing by ship on this coast"), d: RA.t("Ships: {0}/{1}", me.boats, C.BOAT_MAX), r: troopsTxt }));
    }
    if (RA.ERA.para && me.n.airport && (!O || !me.allies.has(O.id))) {
      const ap = G.paraAirport(me, c);
      acts.push(this.btn({ icon: 'para', attrs: 'data-act="para"', dis: !ap || me.gold < C.PARA_GOLD || (O && peace), t: RA.t("Paratroopers here"), d: ap ? RA.t("{0} gold · {1}% of troops", RA.fmt(C.PARA_GOLD), Math.round(this.ratio * 100)) : RA.t("No ready airfield in range ({0} cells)", C.PARA_RANGE), r: troopsTxt }));
    }
    h += `<div class="btns">${acts.join('')}</div>`;
    if (G.online) h += RA.t("<div class=\"sec-t\">Mark for allies</div><div class=\"grid2\">{0}</div>", RA.PINGS.map((P, i) => this.btn({ icon: P.icon, attrs: `data-ping="${i}"`, t: P.name, d: RA.t("map ping") })).join(''));
    if (O && O.type === 'nation' && !O.human) {
      const ru = RA.rulerOf(G, O);
      h += `<div class="ruler-row"><span class="rb-face">${RA.rulerPortrait(ru.kind, O.hex, O.rel[me.id] < -35, ru.seed)}</span><div><b>${RA.esc(ru.title)} ${RA.esc(ru.name)}</b><br><span class="d">${this.relLabel(O.rel[me.id])}</span></div></div>`;
    }
    if (O && O.type !== 'me') h += RA.t("<div class=\"sec-t\">Relations</div><div class=\"bb\" style=\"display:flex;flex-wrap:wrap;gap:6px\">{0}</div>", this.diploButtons(O, true));
    if (me.n.silo) {
      h += RA.t("<div class=\"sec-t\">{0} at this point</div><div class=\"grid2\">", RA.esc(RA.ERA.strikeTab));
      for (const t of RA.missileTypes()) {
        if (t === 'mirv' && !O) continue;
        const M = RA.MISSILE[t];
        const cost = G.missileCost(t, me);
        const far = M.range && !G.strikeSilo(me, t, c, true);
        const wait = M.from && tk < M.from;
        h += this.btn({ icon: RA.missileIcon(t), cls: M.kind === 'conv' ? '' : 'danger', attrs: `data-nuke="${t}"`, dis: me.gold < cost || peace || far || wait, t: M.name, d: far ? RA.t("out of range") : wait ? RA.t("in development") : RA.fmt(cost) });
      }
      h += '</div>';
    }
    this.openSheet(h, (s) => {
      const on = (sel, fn) => {
        const b = s.querySelector(sel);
        if (b) b.onclick = fn;
      };
      on('[data-act=attack]', () => {
        this.closeSheet();
        this.act('atk', [c, this.ratio, O ? 1 : 0]);
      });
      s.querySelectorAll('[data-ping]').forEach((b) => (b.onclick = () => {
        this.closeSheet();
        this.act('png', [c, +b.dataset.ping]);
      }));
      on('[data-act=attackAll]', () => {
        this.closeSheet();
        this.act('atk', [c, this.ratio, 0]);
      });
      on('[data-act=retreat]', () => {
        this.closeSheet();
        if (myAtt) this.retreatAtt(myAtt.id);
      });
      on('[data-act=boat]', () => {
        this.closeSheet();
        this.act('boat', [c, this.ratio]);
      });
      on('[data-act=para]', () => {
        this.closeSheet();
        this.act('para', [c, this.ratio]);
      });
      s.querySelectorAll('[data-nuke]').forEach((b) => (b.onclick = () => {
        this.closeSheet();
        this.aimMissile(b.dataset.nuke, c); // shows the blast radius; "Lansiraj" fires
      }));
      this.bindDiplo(s);
    }, keep, () => this.cellSheet(c, true));
  },

  stanceName() {
    const st = this.G.me && this.G.me.stance, T = st && this.G.P[st.t];
    return !st ? RA.t("like the computer") : st.k === 'def' ? RA.t("defend") : st.k === 'eco' ? RA.t("build the economy") : RA.t("attack {0}", T ? T.name : '');
  },
  /* Focus: orders for the computer while I'm away (command 'stance') */
  stanceSheet() {
    const G = this.G, me = G.me;
    if (!me) return;
    const cur = me.stance ? me.stance.k : 'auto';
    const opt = (k, t, d) => this.btn({ attrs: `data-st="${k}"`, cls: cur === k ? 'primary' : '', t, d });
    let h = this.head(RA.t("While I'm away"), RA.t("When you close the game, the computer plays your state by this order")) + '<div class="btns">';
    h += opt('auto', RA.t("Like the computer"), RA.t("Decides by itself: expands, goes to war, makes alliances"));
    h += opt('def', RA.t("Defend"), RA.t("No new wars: forts and air defence, strikes back only when attacked, accepts alliances"));
    h += opt('eco', RA.t("Build the economy"), RA.t("No new wars: cities, factories and ports, expands onto free land"));
    h += RA.t("</div><div class=\"sec-t\">Attack a state</div><div class=\"list\">");
    // my neighbours (no RA.AI.scan here: it draws from the game's random numbers)
    const W = G.map.W, ids = new Set();
    for (let i = 0; i < me.tiles; i++) {
      const c = me.cells[i];
      for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < G.map.N && G.owner[n] && G.owner[n] !== me.id) ids.add(G.owner[n]);
    }
    const nb = [...ids].map((id) => G.P[id]).filter((o) => o && o.alive && o.type !== 'bot' && !G.isFriendly(me, o));
    for (const o of nb) h += RA.t("<div class=\"prow wide\"><span class=\"sw\" style=\"background:{0}\"></span><div class=\"pn\"><div class=\"nm\">{1}</div><div class=\"d\">army {2}</div></div><div class=\"bb\">{3}</div></div>", o.hex, RA.esc(o.name), RA.fmt(o.troops), this.mini(me.stance && me.stance.t === o.id ? RA.t("Selected") : RA.t("Attack"), `data-st="atk:${o.id}"`, 'warn'));
    if (!nb.length) h += RA.t("<p class=\"note\">You have no neighbour you are not allied with.</p>");
    this.openSheet(h + '</div>', (s) => s.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => {
      const [k, t] = b.dataset.st.split(':');
      this.act('stance', k === 'atk' ? [k, +t] : [k]);
      this.toast('good', RA.t("While you're away: {0}.", k === 'auto' ? RA.t("like the computer") : k === 'def' ? RA.t("defend") : k === 'eco' ? RA.t("build the economy") : RA.t("attack ") + G.P[+t].name));
      this.closeSheet();
    })));
  },
  /* nuclear spam: how much dearer the next one is and until when (a bar that runs out) */
  nukeBar(M) {
    const G = this.G, me = G.me;
    if ((M.kind !== 'nuke' && M.kind !== 'mirv') || !(me.nukeUntil > G.tick)) return '';
    const left = me.nukeUntil - G.tick, pct = Math.round((left / RA.CFG.NUKE_COOL) * 100);
    return RA.t("<span class=\"nuke-bar\" title=\"The price returns to normal\"><i style=\"width:{0}%\"></i></span><span class=\"nuke-up\">Dearer ×{1} · normal price in {2}</span>", pct, G.nukeMul(me).toFixed(1).replace('.', RA.DEC), RA.dur(left));
  },
  /* offers and demands (plan 15): "Zahtijevam" from them, "Nudim" from me; pre = a counter-offer to fill in */
  dealSheet(oid, pre) {
    const G = this.G, me = G.me, O = G.P[oid];
    if (!me || !O || !O.alive) return;
    const E = { g: 0, t: 0, c: -1, r: -1, s: -1 };
    const want = Object.assign({}, E, pre && pre.want), give = Object.assign({}, E, pre && pre.give);
    const allied = me.allies.has(O.id);
    const side = (P, b, k) => {
      const cities = G.cities.filter((c) => c.owner === P.id && c.i !== P.capCity).sort((a, b2) => b2.tier - a.tier).slice(0, 40);
      const res = G.deps && P.res ? [0, 1, 2].filter((s) => P.res[s]) : [];
      const sts = (G.straits || []).map((st, i) => [st, i]).filter(([st]) => st.closed === P.id);
      let h = `<div class="deal-side"><div class="sec-t">${k === 'want' ? RA.t("I demand from: {0}", RA.esc(P.name)) : RA.t("I offer")}</div>`;
      h += RA.t("<label class=\"deal-row\">Gold<input type=\"number\" min=\"0\" step=\"10000\" data-k=\"{0}.g\" value=\"{1}\" placeholder=\"0\"><small>has {2}</small></label>", k, b.g || '', RA.fmt(P.gold));
      if (allied) h += RA.t("<label class=\"deal-row\">Troops<input type=\"number\" min=\"0\" step=\"1000\" data-k=\"{0}.t\" value=\"{1}\" placeholder=\"0\"><small>has {2}</small></label>", k, b.t || '', RA.fmt(P.troops));
      h += RA.t("<label class=\"deal-row\">City<select data-k=\"{0}.c\"><option value=\"-1\">—</option>{1}</select></label>", k, cities.map((c) => `<option value="${c.i}"${c.i === b.c ? ' selected' : ''}>${RA.esc(c.name)}${c.tier ? ' ' + '★'.repeat(c.tier) : ''}</option>`).join(''));
      if (res.length) h += RA.t("<label class=\"deal-row\">Resource<select data-k=\"{0}.r\"><option value=\"-1\">—</option>{1}</select></label>", k, res.map((s) => `<option value="${s}"${s === b.r ? ' selected' : ''}>${RA.resKind(s, G.era).name} (5 min)</option>`).join(''));
      if (sts.length) h += RA.t("<label class=\"deal-row\">Strait<select data-k=\"{0}.s\"><option value=\"-1\">—</option>{1}</select></label>", k, sts.map(([st, i]) => RA.t("<option value=\"{0}\"{1}>open the {2}</option>", i, i === b.s ? ' selected' : '', RA.esc(st.name))).join(''));
      return h + '</div>';
    };
    let h = '<div id="dealSheet"></div>' + this.head(pre && pre.reply ? RA.t("Counter-offer") : RA.t("Negotiations"), `${RA.esc(O.name)} · ${O.ai && !O.human ? RA.t("the computer answers at once: accepts, asks for more or declines") : RA.t("a player: accepts, declines or makes a counter-offer")}`, O.hex);
    h += `<div class="deal-grid">${side(O, want, 'want')}${side(me, give, 'give')}</div>`;
    if (!allied) h += RA.t("<p class=\"note\">You can exchange troops only as military allies. A city goes with its surroundings (3 cells); a capital can't be given.</p>");
    h += `<div class="btns"><button class="btn primary" data-send><span class="t">${pre && pre.reply ? RA.t("Send the counter-offer") : RA.t("Send the offer")}</span></button></div>`;
    this.openSheet(h, (s) => {
      s.querySelector('[data-send]').onclick = () => {
        const b = { want: Object.assign({}, E), give: Object.assign({}, E) };
        s.querySelectorAll('[data-k]').forEach((el) => {
          const [k, f] = el.dataset.k.split('.');
          const v = Math.floor(+el.value || 0);
          b[k][f] = f === 'g' || f === 't' ? Math.max(0, v) : v;
        });
        if (pre && pre.reply) this.act('offerRes', [pre.reply, 'counter', b.give, b.want]);
        else this.act('offer', [O.id, b.give, b.want]);
      };
    });
  },
  /* why a computer state likes or hates me (O.why[me.id], filled by G.relTo), and whom it is allied with */
  whyHtml(O) {
    const G = this.G, me = G.me;
    const r = (O.why && O.why[me.id]) || {};
    const rows = Object.keys(r).map((k) => [k, Math.round(r[k])]).filter((x) => x[1]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);
    let h = '';
    if (rows.length) h += `<div class="why-list">${rows.map(([k, v]) => `<span class="why ${v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : '−'}${Math.abs(v)} ${RA.esc(RA.WHY[k] || k)}</span>`).join('')}</div>`;
    const al = [...O.allies.keys()].map((id) => G.P[id]).filter((q) => q && q.alive);
    if (al.length) h += RA.t("<p class=\"note\">Allies: {0} · key L: alliances on the map</p>", al.map((q) => `<b style="color:${q.hex}">${RA.esc(q === me ? RA.t("you") : q.name)}</b>`).join(', '));
    return h;
  },
  /* quick messages to allies and team (online) */
  /* the economy: tax (more gold ↔ slower army growth) and interest on saved gold; tap the gold in the top bar or Z */
  econSheet(keep) {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    const T = RA.TAX, cur = RA.TAX[me.tax] || T[2], pct = (v) => (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%';
    const h = this.head(RA.t("Economy"), RA.t("Treasury · development · trade")) +
      RA.t("<div class=\"economy-overview\"><div><span>Treasury</span><strong>{0}</strong><small>gold available</small></div><div><span>Income</span><strong>+{1}</strong><small>gold / second</small></div><div><span>Army</span><strong>{2}{3}</strong><small>troops / second</small></div></div>", RA.fmt(me.gold), RA.fmt(me.goldRate || 0), me.growRate >= 0 ? '+' : '−', RA.fmt(Math.abs(me.growRate || 0))) +
      RA.t("<div class=\"field\"><span class=\"lab\">Tax: {0}</span><div class=\"seg wrap\" id=\"taxSeg\" role=\"group\" aria-label=\"Tax\">{1}</div>\n      <p class=\"note\">Higher tax: more gold, but the army grows more slowly. Lower: the army grows faster, less gold.<br>Now: gold {2}, army growth {3}.</p></div>\n      <div class=\"field\"><span class=\"lab\">Interest</span><p class=\"note\">Saved gold earns 1% a minute, at most a quarter of your income. Now: <b>+{4}/s</b>.</p></div>", RA.esc(cur.name), T.map((t, i) => `<button data-v="${i}" aria-pressed="${i === me.tax}">${RA.esc(t.name)}</button>`).join(''), cur.g === 1 ? RA.t("normal") : pct(cur.g), cur.grow === 1 ? RA.t("normal{=2}") : pct(cur.grow), RA.fmt(me.interest || 0)) +
      this.resHtml() + this.loanHtml() + this.straitHtml() +
      (G.opts.tree ? RA.t("<div class=\"btns\"><button class=\"btn\" data-intel>{0}<span><span class=\"t\">Intelligence agency</span><br><span class=\"d\">{1}</span></span></button></div>", RA.icon('eye'), me.n.intel ? RA.t("Agents: {0}/{1}", G.intelOf(me).agents.length, RA.CFG.INTEL_MAX) : RA.t("Not built yet (Build)")) : '');
    this.openSheet(this.techHtml(h), (s) => {
      s.querySelectorAll('[data-tech]').forEach((b) => (b.onclick = () => {
        this.act('tech', [b.dataset.tech]);
        if (G.online || G.long) setTimeout(() => this.econSheet(true), 400);
      }));
      s.querySelectorAll('[data-intel]').forEach((b) => (b.onclick = () => this.intelSheet()));
      s.querySelectorAll('[data-rsch]').forEach((b) => (b.onclick = () => {
        this.act('rsch', [b.dataset.rsch]);
        setTimeout(() => this.econSheet(true), G.online || G.long ? 1200 : 50);
      }));
      s.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
        const [k, sid] = b.dataset.buy.split(':').map(Number);
        this.act('buy', [k, sid]);
        if (G.online) setTimeout(() => this.econSheet(true), 400);
      }));
      s.querySelectorAll('[data-str]').forEach((b) => (b.onclick = () => {
        const [i, v] = b.dataset.str.split(':').map(Number);
        const go = () => {
          this.act('str', [i, v]);
          if (G.online) setTimeout(() => this.econSheet(true), 400);
        };
        if (v) this.confirm(RA.t("Close the {0}?", G.straits[i].name), RA.t("Only your ships and your allies' pass. Everyone who sails those seas gets angry (more the longer it lasts), and it counts as aggression: alone against everyone — a coalition; with strong allies you can hold out."), RA.t("Close"), go);
        else go();
      }));
      s.querySelectorAll('#taxSeg button').forEach((b) => (b.onclick = () => {
        this.act('tax', [+b.dataset.v]);
        if (G.online) setTimeout(() => this.econSheet(true), 400); // offline: afterAct redraws
      }));
      s.querySelectorAll('[data-loan]').forEach((b) => (b.onclick = () => {
        const [lid, size] = b.dataset.loan.split(':').map(Number);
        this.act('loan', [lid, size]);
        if (G.online) setTimeout(() => this.econSheet(true), 400);
      }));
      s.querySelectorAll('[data-pay]').forEach((b) => (b.onclick = () => {
        this.act('pay', [+b.dataset.pay]);
        if (G.online) setTimeout(() => this.econSheet(true), 400);
      }));
    }, keep, () => this.econSheet(true));
  },
  /* the tech tree of this game (opts.tree), put right under the sheet's head */
  techHtml(h) {
    const G = this.G, me = G.me;
    if (!G.opts.tree) return h;
    let t = RA.t("<div class=\"sec-t\">Tech tree</div><p class=\"explain\">Research for gold: every branch has 5 levels, each level costs twice as much. Lasts until the end of the game.</p><div class=\"research-grid\">");
    for (const k of RA.TECH_ORDER) {
      const T = RA.TECH[k], lv = G.techLv(me, k), cost = G.techCost(me, k), max = lv >= RA.TECH_MAX;
      t += RA.t("<article class=\"research-card\" data-branch=\"{0}\"><div class=\"research-heading\"><i>{1}</i><span>{2}<small>Level {3} / {4}</small></span></div>{5}<p>{6}</p>{7}</article>", k, RA.icon(T.icon), T.name, lv, RA.TECH_MAX, this.techProgress(lv), RA.esc(T.desc), max ? RA.t("<span class=\"research-max\">Fully developed</span>") : this.mini(RA.t("Research · {0}", RA.fmt(cost)), RA.t("data-tech=\"{0}\" aria-label=\"Research {1}, level {2}, {3} gold\"", k, T.name, lv+1, RA.fmt(cost)), 'ok', me.gold < cost));
    }
    t += '</div>';
    // weapons research (03c-research.js): one at a time, it takes a while
    const B = me.rsBusy, left = B ? B.done - G.clock() : 0, secs = G.sub ? left : left / 10;
    t += RA.t("<div class=\"sec-t\">Weapons research</div><p class=\"explain\">Pay and wait: the weapon is better for the rest of the game. One research at a time.{0}</p><div class=\"research-grid\" id=\"rschGrid\">", B ? RA.t(" Now: <b>{0} {1}</b> — {2} to go.", RA.esc(RA.RSCH[B.k].name), B.lv, RA.fmtTime(Math.max(0, secs))) : '');
    for (const k of RA.RSCH_ORDER) {
      const R = RA.RSCH[k], lv = G.rsLv(me, k), cost = G.rsCost(me, k), max = lv >= R.max, busy = B && B.k === k;
      const dur = G.sub ? G.rsTime(me, k) : G.rsTime(me, k) / 10;
      const percent = busy ? Math.round(Math.max(0, Math.min(1, (G.clock() - B.from) / Math.max(1, B.done - B.from))) * 100) : 0;
      const reason = !max && !busy ? (B ? RA.t('Another research is in progress') : me.gold < cost ? RA.t('Need {0} more gold', RA.fmt(cost - me.gold)) : '') : '';
      const progress = this.techProgress(lv, R.max);
      const active = busy ? `<div class="research-active"><div><span>${RA.t('Researching…')}</span><b>${RA.fmtTime(Math.max(0, secs))}</b></div><progress max="100" value="${percent}" aria-label="${RA.esc(R.name)}">${percent}%</progress><small>${RA.t('{0}% complete', percent)}</small></div>` : '';
      const action = max ? RA.t('<span class="research-max">Fully developed</span>') : busy ? active : this.mini(RA.t('Research · {0} · {1}', RA.fmt(cost), RA.fmtTime(dur)), `data-rsch="${k}"`, 'ok', me.gold < cost || !!B);

      t += RA.t("<article class=\"research-card\" data-rsch-card=\"{0}\"><div class=\"research-heading\"><i>{1}</i><span>{2}<small>Level {3} / {4}</small></span></div><p>{5}</p>{6}</article>", k, RA.icon(R.icon), R.name, lv, R.max, RA.esc(R.desc), progress + action + (reason ? `<small class="research-reason">${reason}</small>` : ''));
    }
    t += '</div>';
    const i = h.indexOf('<div class="field">');
    return i < 0 ? h + t : h.slice(0, i) + t + h.slice(i);
  },
  techProgress(level, max = 5) {
    return `<div class="research-progress" role="img" aria-label="${RA.t('Level {0} of {1}', level, max)}">${Array.from({length:max},(_,i)=>`<i class="${i<level?'earned':i===level?'next':''}"></i>`).join('')}</div>`;
  },
  /* resources: what you have, buy, or miss (and what missing costs you); partners' offers with their prices */
  resHtml() {
    const G = this.G, me = G.me;
    if (!G.deps || !me.res) return '';
    let h = RA.t("<div class=\"sec-t\">Resources</div><p class=\"explain\">Without resources nothing is forbidden, just dearer or slower. What you lack you buy from a trade partner for part of your income while you buy (whoever has more deposits sells cheaper).</p><div class=\"list\">");
    for (let s = 0; s < 3; s++) {
      const K = RA.resKind(s, G.era), sid = me.imp[s], q = G.P[sid];
      let d, bb = '';
      if (me.res[s]) d = RA.t("<span class=\"pos\">you have it</span> · {0} {1}", me.res[s], me.res[s] === 1 ? RA.t("deposit") : RA.t("deposits"));
      else if (sid && q) {
        d = RA.t("you buy from {0} · {1}% of income", RA.esc(q.name), Math.round(G.resRate(q, s) * 100));
        bb = this.mini(RA.t("Stop"), `data-buy="${s}:0"`, 'warn');
      } else {
        d = RA.t("<span class=\"neg\">you lack it</span> — {0}", RA.RES[s].lack);
        const sellers = [...me.trade].map((id) => G.P[id]).filter((o) => o && o.alive && o.res && o.res[s]).sort((a, b) => G.resRate(a, s) - G.resRate(b, s));
        bb = sellers.slice(0, 3).map((o) => this.mini(`${RA.esc(o.name)} ${Math.round(G.resRate(o, s) * 100)}%`, `data-buy="${s}:${o.id}"`)).join('');
        if (!sellers.length) d += RA.t("<br>No trade partner has it — make a trade pact (Alliances).");
      }
      h += `<div class="prow wide"><span class="sw res-${RA.RES[s].id}"></span><div class="pn"><div class="nm">${K.name}</div><div class="d">${d}</div></div><div class="bb">${bb}</div></div>`;
    }
    if (me.resRateIn) h += RA.t("<p class=\"note\">You sell to others: +{0}/s.</p>", RA.fmt(me.resRateIn));
    return h + '</div>';
  },
  /* straits: who holds them; the holder of both shores may close one for foreign ships */
  straitHtml() {
    const G = this.G, me = G.me;
    if (!G.straits.length) return '';
    let h = RA.t("<div class=\"sec-t\">Straits</div><p class=\"explain\">Whoever holds both shores of a strait can close it to foreign ships (landings and trade). Only their ships and their allies' pass.</p><div class=\"list\">");
    for (const st of G.straits) {
      const H = G.P[st.holder], C = G.P[st.closed];
      const d = C ? RA.t("<span class=\"neg\">closed</span> · {0}", RA.esc(C.name)) : H ? RA.t("open · both shores held by {0}", RA.esc(H.name)) : RA.t("open · the shores are held by different states");
      const btn = st.holder === me.id ? this.mini(st.closed ? RA.t("Open") : RA.t("Close"), `data-str="${st.i}:${st.closed ? 0 : 1}"`, st.closed ? 'ok' : 'warn') : '';
      h += `<div class="prow wide"><span class="sw" style="background:${C ? C.hex : H ? H.hex : '#6f8190'}"></span><div class="pn"><div class="nm">${RA.esc(st.name)}</div><div class="d">${d}</div></div><div class="bb">${btn}</div></div>`;
    }
    return h + '</div>';
  },
  /* loans: the open ones (repay) and who would lend (neighbours and partners with gold) */
  loanHtml() {
    const G = this.G, me = G.me, C = RA.CFG;
    let h = RA.t("<div class=\"sec-t\">Loans</div><p class=\"explain\">A computer state lends you gold; the part of your land nearest to it is the pledge (hatched on the map). You repay the amount + {0}% within {1} min — at the due date it's taken only if you have the gold. Don't repay → the pledge is theirs.</p>", Math.round(C.LOAN_RATE * 100), Math.round(C.LOAN_DUE / 600));
    const mine = G.loans.filter((l) => l.to === me.id);
    if (mine.length) {
      h += '<div class="list">';
      for (const l of mine) {
        const L = G.P[l.from];
        h += RA.t("<div class=\"prow wide\"><span class=\"sw\" style=\"background:{0}\"></span><div class=\"pn\"><div class=\"nm\">{1}</div><div class=\"d\">you owe <b>{2}</b> · due {3} · pledge {4} cells</div></div><div class=\"bb\">{5}</div></div>", L.hex, RA.esc(L.name), RA.fmt(l.owed), RA.dur(l.due - G.tick), l.cells.length, this.mini(RA.t("Repay"), `data-pay="${l.id}"`, 'ok', me.gold < l.owed));
      }
      h += '</div>';
    }
    if (mine.length >= C.LOAN_MAX) return h;
    const nb = me.nbCache || new Map();
    const lenders = G.P.filter((o) => o && o.alive && o !== me && o.type === 'nation' && o.ai && (nb.has(o.id) || me.trade.has(o.id) || me.allies.has(o.id)) && !mine.some((l) => l.from === o.id))
      .sort((a, b) => b.gold - a.gold).slice(0, 5);
    if (!lenders.length) return h + RA.t("<p class=\"note\">Nobody to lend you money: loans come from neighbours, trade partners and allies.</p>");
    h += '<div class="list">';
    for (const L of lenders) {
      const bs = C.LOAN_SECS.map((_, k) => {
        const o = G.loanOffer(me, L, k), err = G.loanErr(me, L, k);
        return this.mini(`${RA.fmt(o.amount)}`, RA.t("data-loan=\"{0}:{1}\" title=\"{2}\"", L.id, k, RA.esc(err || RA.t("You repay {0}; pledge {1} cells", RA.fmt(o.owed), o.cells))), '', !!err);
      }).join('');
      h += RA.t("<div class=\"prow wide\"><span class=\"sw\" style=\"background:{0}\"></span><div class=\"pn\"><div class=\"nm\">{1}</div><div class=\"d\">{2} · gold {3}{4}</div></div><div class=\"bb\">{5}</div></div>", L.hex, RA.esc(L.name), this.relLabel(L.rel[me.id]), RA.fmt(L.gold), G.atWar(me, L) ? RA.t(" · at war") : '', bs);
    }
    return h + RA.t("</div><p class=\"note\">Pledge: ") + C.LOAN_PLEDGE.map((v) => Math.round(v * 100) + '%').join(' / ') + RA.t(" of your land for a small / medium / large loan.</p>");
  },
  quickSheet() {
    const G = this.G;
    if (!G || !G.me || G.state !== 'play') return;
    const h = this.head(RA.t("Quick messages"), RA.t("Your allies and team see them · key T")) + RA.t("<div class=\"qm-grid\">{0}</div>\n      <p class=\"note\">Map ping: right click (long press) on a spot → “Mark for allies”, or key G at the mouse position.</p>", RA.QUICK_MSGS.map((m, i) => `<button class="btn" data-qm="${i}"><span class="t">${RA.esc(m)}</span></button>`).join(''));
    this.openSheet(h, (s) => s.querySelectorAll('[data-qm]').forEach((b) => (b.onclick = () => {
      this.closeSheet();
      this.act('qm', [+b.dataset.qm]);
    })));
  },

  /* ---------------- menu & rules ---------------- */
  menu() {
    const app = this.app, G = this.G;
    const reg = G.map.region;
    let h = this.head(RA.t("Menu"), RA.t("{0} · {1}{2} · {3} · time {4}", RA.esc(RA.ERA.name), RA.esc(reg ? reg.name : RA.mapInfo(G.map.id).all), G.zone ? RA.t(" · battle royale") : '', RA.DIFF[G.opts.difficulty] ? RA.DIFF[G.opts.difficulty].label : '', RA.dur(G.tick)));
    h += RA.t("<div class=\"btns\">\n      <button class=\"btn primary\" data-m=\"resume\"><span class=\"t\">Resume</span></button>\n      <button class=\"btn\" data-m=\"how\"><span class=\"t\">How to play</span></button>\n      <button class=\"btn\" data-m=\"cities\"><span class=\"t\">City names</span><span class=\"r\" style=\"font-size:14px\">{0}</span></button>\n      <button class=\"btn\" data-m=\"osm\" {1}><span><span class=\"t\">Base map: {2}</span><br><span class=\"d\">{3}</span></span></button>\n      <button class=\"btn\" data-m=\"tips\"><span class=\"t\">Tips during the game</span><span class=\"r\" style=\"font-size:14px\">{4}</span></button>\n      <button class=\"btn\" data-m=\"cb\"><span class=\"t\">Colour-blind mode</span><span class=\"r\" style=\"font-size:14px\">{5}</span></button>\n      <button class=\"btn\" data-m=\"sfx\"><span class=\"t\">Sound effects</span><span class=\"r\" style=\"font-size:14px\">{6}</span></button>\n      <button class=\"btn\" data-m=\"music\"><span class=\"t\">Music</span><span class=\"r\" style=\"font-size:14px\">{7}</span></button>\n      <button class=\"btn\" data-m=\"rulers\"><span class=\"t\">Rulers' comments</span><span class=\"r\" style=\"font-size:14px\">{8}</span></button>\n      {9}\n      {10}\n    </div>\n    <p class=\"note\">Keys: Space pause · 1–3 speed · Q/E attack strength · V army · B build · D landing · P paratroopers · R missiles · S alliances · L alliances on the map · M mobilisation · Esc cancel.</p>", app.fx.showCities ? RA.t("On") : RA.t("Off"), app.osmOK ? '' : 'disabled', app.osmOn ? 'OpenStreetMap' : RA.t("Atlas (built in)"), app.osmOK ? RA.t("Tap to change") : RA.t("The base map isn't available right now. The built-in atlas is ready to play."), this.noTips ? RA.t("Off") : RA.t("On"), this.settings.cb ? RA.t("On") : RA.t("Off"), this.audio.s.sfx ? RA.t("On") : RA.t("Off"), this.audio.s.music ? RA.t("On") : RA.t("Off"), this.settings.rulers === false ? RA.t("Off") : RA.t("On"), G.online && G.me && !G.me.surr && (!G.long || G.opts.league || (this.app.long.rec && this.app.long.rec.set.fast)) ? (() => {
        const hs = G.activeHumans(), v = hs.filter((p) => p.endVote).length;
        const lt = G.opts.league ? G.lgTeam(G.me.team).filter((p) => p.alive && !p.kicked) : null;
        return RA.t("<button class=\"btn\" data-m=\"endv\"><span><span class=\"t\">{0}</span><br><span class=\"d\">Votes {1}/{2} — when everyone votes, {3} wins</span></span></button>\n        <button class=\"btn danger\" data-m=\"surr\" {4}><span><span class=\"t\">{5}</span><br><span class=\"d\">{6}</span></span></button>", G.me.endVote ? RA.t("Withdraw the vote to end") : RA.t("Offer to end the game"), v, hs.length, G.opts.league ? RA.t("the team with more land") : RA.t("whoever has the most land"), G.me.surrVote ? 'disabled' : '', lt ? (G.me.surrVote ? RA.t("You voted to surrender") : RA.t("Vote to surrender")) : RA.t("Surrender"), lt ? RA.t("The team surrenders when {0} of {1} vote (now {2})", G.lgNeed(lt.length), lt.length, lt.filter((p) => p.surrVote).length) : RA.t("The computer takes your state, the game is lost"));
      })() : '', G.long && !(this.app.long.rec && this.app.long.rec.set.fast) ? RA.t("<button class=\"btn\" data-m=\"stance\"><span><span class=\"t\">While I'm away: {0}</span><br><span class=\"d\">What the computer does with your state when you close the game</span></span></button>\n      <button class=\"btn\" data-m=\"home\"><span><span class=\"t\">Main menu</span><br><span class=\"d\">The game goes on, the computer plays your state — come back with “Continue Focus game”</span></span></button>\n      <button class=\"btn danger\" data-m=\"leave\"><span><span class=\"t\">Leave the game</span><br><span class=\"d\">For good — your progress in this Focus game is deleted</span></span></button>", RA.esc(this.stanceName())) : `<button class="btn danger" data-m="new"><span><span class="t">${G.online ? RA.t("Leave the online game") : RA.t("New game")}</span><br><span class="d">${G.opts.league ? RA.t("The computer takes your state — leaving a league game costs ELO") : G.online ? RA.t("The computer takes your state") : RA.t("The current game is ended")}</span></span></button>`);
    this.openSheet(h, (s) => {
      s.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
        const m = b.dataset.m;
        if (m === 'resume') this.closeSheet();
        else if (m === 'how') this.howTo();
        else if (m === 'osm') {
          app.setOSM(!app.osmOn);
          this.closeSheet();
        } else if (m === 'cities') {
          app.fx.showCities = !app.fx.showCities;
          this.closeSheet();
        } else if (m === 'cb') {
          this.setColorblind(!this.settings.cb);
          this.menu();
        } else if (m === 'rulers') {
          this.settings.rulers = this.settings.rulers === false;
          this._save();
          if (!this.settings.rulers) this.$('rulerBubble').hidden = true;
          this.menu();
        } else if (m === 'sfx' || m === 'music') {
          this.audio.toggle(m);
          this.menu();
        } else if (m === 'tips') {
          this.noTips = !this.noTips;
          this.closeSheet();
        } else if (m === 'endv') {
          this.act('endv', [G.me.endVote ? 0 : 1]);
          this.closeSheet();
        } else if (m === 'surr') {
          if (G.opts.league) this.confirm(RA.t("Vote to surrender?"), RA.t("The team surrenders when {0} players vote; then the game is lost for the whole team.", G.lgNeed(G.lgTeam(G.me.team).filter((p) => p.alive && !p.kicked).length)), RA.t("Vote"), () => this.act('surr', []));
          else this.confirm(RA.t("Surrender?"), RA.t("The computer takes your state and the game counts as lost."), RA.t("Surrender"), () => this.act('surr', []));
        } else if (m === 'stance') {
          this.stanceSheet();
        } else if (m === 'home') {
          app.long.snap();
          app.showStart();
        } else if (m === 'leave') {
          this.confirm(RA.t("Leave the Focus game?"), RA.t("Your state goes to the computer for good and you can't come back to it. All your progress in this game is deleted."), RA.t("Leave"), () =>
            setTimeout(() => this.confirm(RA.t("Sure? This can't be undone."), RA.t("Last check: the progress of the Focus game ({0}) will be deleted. If you just want a break, pick “Main menu” — the game waits for you.", G.me ? G.me.name : ''), RA.t("Yes, delete the progress"), () => {
              app.long.leave();
              app.showStart();
            }), 50));
        } else if (m === 'new') {
          if (G.opts.league) this.confirm(RA.t("Leave the league game?"), RA.t("The computer takes your state and you lose ELO as if your team had lost. You can search for a new match right away."), RA.t("Leave"), () => {
            app.long.leave();
            app.showStart();
          });
          else if (G.online) this.confirm(RA.t("Leave the online game?"), app.net && app.net.role === 'host' ? RA.t("You are the host: when you leave, the game stops for your friend too.") : RA.t("The computer takes your state, and your friend plays on."), RA.t("Leave"), () => app.showStart());
          else this.confirm(RA.t("End the game?"), RA.t("You start again with new settings."), RA.t("New game"), () => app.showStart());
        }
      }));
    });
  },

  howTo() {
    const C = RA.CFG, M = this.app.map, I = RA.mapInfo(M.id);
    // the same rules as G.winShare() / G.shareK(): the giant rule starts earlier on a map with meta.winShare (the world)
    const mm = (RA.regionOf(M, this.settings.region) || {}).poly ? {} : M.meta;
    const k = mm.winShare > 0 ? C.WIN_SHARE / mm.winShare : 1, pc = (v) => Math.round(v / k);
    const win = Math.round(C.WIN_SHARE * 100);
    const eras = RA.ERAS.map((e) => `<li><b>${RA.esc(e.name)}</b> (${RA.esc(e.sub)}) — ${RA.esc(RA.eraBlurb(e, M.id))}</li>`).join('');
    const h = this.head(RA.t("How to play"), RA.t("Overtake — the rules in short")) + RA.t("<div class=\"howto\">\n      <h4>Goal</h4><p>Take {0}% of the land of the chosen part of the map or be the last state standing. When you win you can play on and conquer everything. Whoever holds more than {1}% of the map pays more for every new conquest.</p>\n      <h4>Modes</h4><ul>\n        <li><b>Blitz</b>: a quick game (20–40 min), no tech tree or resources, 1 min of peace.</li>\n        <li><b>Focus</b>: the game lasts days (~1, 3 or 7) on the server and runs even while you are away — the computer plays your state. Gold and orders come every second, armies move slowly. Tech tree, weapons research, resources and trade, a longer peace time. The main menu keeps the game (<i>Continue Focus game</i>), and when you come back you see what happened. <i>Leave the game</i> deletes your progress for good.</li>\n        <li><b>Make your choice</b>: you pick the pace, the tech tree, resources, nuclear weapons and peace time yourself.</li></ul>\n      <h4>Eras</h4><p>On the start screen you pick the period you fight in. Every era has its own borders, cities, units, buildings and weapons:</p><ul>{2}</ul>\n      <h4>Start</h4><ul>\n        <li><b>Real borders</b>: every state starts with its land from that era. Tap a state or pick it from the list — you get its land, army and gold.</li>\n        <li><b>From the capital</b>: states start from a small circle around their capital, the rest is free (grey) land and city-states.</li>\n        <li>The first minute (adjustable) is <b>peace time</b>: nobody may attack states — build, take free land, make alliances.</li></ul>\n      <h4>Battle royale</h4><p>After peace time and another 90 s a radioactive zone starts shrinking towards a random point ({3} circles). The white dashed circle shows where it's going. Everything outside the red circle is lost — the land and the troops on it. Whoever is left wins.</p>\n      <h4>Expanding and attacking</h4><ul>\n        <li><b>Tap</b> free land or a neighbour — you send as many troops as the <b>Attack strength</b> slider shows.</li>\n        <li><b>Directed attack</b>: tapping a neighbouring state sends troops from your nearest border straight to that spot (an arrow on the map) — only that part is taken, then the rest of the troops come back. The more troops you send, the wider the corridor.</li>\n        <li>On a computer: <b>drag an arrow with the right mouse button</b> from your land to the target — the attack goes exactly that way.</li>\n        <li>A front along the whole border with a state: long press (right click) on it → <b>Attack the whole border</b>. Free land is always taken along the whole border.</li>\n        <li><b>Retake</b>: when a state takes your land, a yellow “Retake N cells” button appears in the attack bar — one click sends a counter-attack only on that land (taken in the last 3 minutes), without going further.</li>\n        <li><b>Right of passage</b>: a military ally lets you through its land — you can attack a state bordering it even if you have no border with it.</li>\n        <li>Rivers, hills, mountains and cities slow the attacker down.</li>\n        <li>Active attacks are above the bottom bar. <b>✕</b> stops an attack and brings the troops back (an attack on a state: 25% is lost in the retreat).</li></ul>\n      <h4>Army and gold</h4><ul>\n        <li>The army grows by itself, fastest around <b>42%</b> of capacity (the green zone on the bar).</li>\n        <li><b>Mobilisation</b> (Army): instantly +30% of capacity, but growth stops for 45 s. Once every 4 minutes.</li>\n        <li>Gold comes from land, cities, ports, trains or caravans and trade.</li>\n        <li><b>Navy</b> (Army): two ships per era, from your port. Tap a ship, then the sea. A warship sinks landings and trade ships, blockades enemy ports nearby (no gold, no trade) and shells the coast; the other ship hunts landings and trade ships (the submarine from 1914 is invisible until a warship comes close).</li>\n        <li><b>Air force</b> (from 1938, Landing or key A): fighters guard the sky around the airfield and escort your planes, bombers destroy buildings, units and troops up to 70 cells from the airfield. <b>Drones</b> (today, Missiles): cheap, fly straight from your border — kamikaze or unit hunter; every tap sends one until you cancel.</li>\n        <li><b>Iron Dome</b> (a building, from 1938): when someone launches a nuke at you, every ready dome fires an atomic bomb at their capital and cities by itself.</li>\n        <li><b>Resources</b> (an option in the settings): grain, metal and fuel at real deposits (signs on the map). Without them everything is dearer or slower; what you lack you buy from a trade partner (Economy).</li>\n        <li><b>Straits</b> (Economy): whoever holds both shores can close a strait to foreign ships. Everyone who sails there gets angry — closing is aggression.</li>\n        <li><b>Loan</b> (Economy: click the gold or Z): a computer state lends you gold, part of your land is the pledge (hatched). Don't repay in time → the pledge is theirs.</li>\n        <li><b>Vassal</b> (Alliances menu): you can make a weak neighbouring state your vassal instead of conquering it — it pays you tribute and fights at your side. If you weaken, it breaks free.</li>\n        <li><b>Aggressive expansion</b> (Alliances menu): every state you attack and subdue angers the others. Too many conquests at once → computer states join forces against you. The anger fades with time.</li>\n        <li><b>Tax</b> (click the gold at the top or key Z): a higher tax gives more gold, but the army grows more slowly. Saved gold earns a little interest.</li></ul>\n      <h4>Units</h4><ul>\n        <li>Three kinds in every era (e.g. legion, cavalry and archers in Rome; infantry, tanks and artillery today): the first holds the border firmly, the second makes your attacks faster and cheaper, the third hits the enemy from afar.</li>\n        <li>Units follow the border by themselves. Tap your unit, then a new spot, to move it. A surrounded unit is lost.</li></ul>\n      <h4>Building</h4><ul>\n        <li><b>City</b>: troops, gold and defence. <b>Factory</b> (a market or manufactory in older eras): a route to your cities within 18 cells — trains or caravans bring gold.</li>\n        <li><b>Barracks</b> (+troops, +2 units), <b>Fort</b>, <b>Port</b>, and depending on the era <b>Airfield</b> (paratroopers), <b>Missile silo</b> or siege workshop, <b>Air defence</b>.</li></ul>\n      <h4>Sea and air</h4><p>A landing by ship on any coast (at most {4} ships). From 1938 paratroopers jump up to {5} cells from an airfield; air defence can shoot them down.</p>\n      <h4>Strikes and bombs</h4><ul>\n        <li>In older eras onagers, trebuchets, bombards, rockets and cannons only reach their <b>range</b> (white circles while aiming) — build them near the front.</li>\n        <li>1914: Big Bertha and zeppelins. 1938: V-2 rockets, and the atomic bomb only from minute 10. Cold War and today: everything up to the hydrogen bomb and MIRV.</li>\n        <li>The <b>atomic</b> and <b>hydrogen</b> bomb wipe out land, destroy EVERY building and unit in the circle and kill a large part of the target's army.</li></ul>\n      <h4>Alliances</h4><ul>\n        <li><b>Military alliance</b> (at most {6}, lasts 5 min): you don't attack each other, and your allies help you when someone attacks you. You can send them troops and ask for help.</li>\n        <li><b>Trade pact</b> (at most {7}): trade ships between ports and trade across a border bring gold to both sides — no duties in war.</li>\n        <li>Betraying an ally = 30 s of halved defence and a bad name with everyone.</li></ul>\n      <h4>Winter and capitals</h4><p>Every 4 minutes {8} is covered with snow for 1 minute: attacks and units are slower there. Losing your capital means a crisis: −25% troops, half income for 60 s and loot for the conqueror.</p>\n      <h4>Online with a friend</h4><p>Both open war.deovilab.com; one presses “Create a room”, the other “Join”. The host picks the era, the map and the type: <b>together against everyone</b> (a permanent alliance, you share the win) or <b>against each other</b>, with battle royale if you like. The host controls speed and pause.</p>\n      <h4>Controls</h4><p>One finger: move · two fingers: zoom · long press (right click): menu for that spot. You can pause and speed up the game (1×–3×).</p>\n    </div>", win, pc(35), eras, C.BR_PHASES, C.BOAT_MAX, C.PARA_RANGE, C.ALLY_MAX, C.TRADE_MAX, RA.esc(I.winterHow));
    this.openSheet(h);
  },

  /* ---------------- end screen ---------------- */
  showEnd(kind) {
    const G = this.G, me = G.me;
    const $ = this.$;
    const won = !!(G.winner && me && (G.winner === me || G.sameTeam(G.winner, me)));
    $('endTitle').textContent = won ? RA.t("Victory") : kind === 'lost' ? RA.t("Defeat") : RA.t("Game over");
    $('endTitle').classList.toggle('win', !!won);
    const where = G.map.region ? G.map.region.name : RA.mapInfo(G.map.id).name;
    $('endSub').textContent = won
      ? (G.winner !== me ? RA.t("Your team conquered: {0} ({1}).", where, RA.dur(G.tick)) : RA.t("Conquered: {0}, in {1}.", where, RA.dur(G.tick)))
      : kind === 'lost'
      ? RA.t("Your state fell after {0}.", RA.dur(G.tick))
      : RA.t("The winner is {0} ({1}).", G.winner ? G.winner.name : RA.t("someone else"), where);
    const peak = me ? ((me.peak / G.map.landArea) * 100).toFixed(1).replace('.', RA.DEC) : '0';
    $('endStats').innerHTML = RA.t("<div><div class=\"k\">Peak</div><div class=\"v\">{0}%</div></div><div><div class=\"k\">Cities conquered</div><div class=\"v\">{1}</div></div><div><div class=\"k\">States destroyed</div><div class=\"v\">{2}</div></div>", peak, me ? me.stats.citiesTaken : 0, me ? me.stats.kills : 0);
    $('endTime').textContent = RA.dur(G.tick);
    $('watchBtn').hidden = !!(G.state === 'over');
    // single player: the winner may play on to 100% (online needs every device to agree: later)
    $('contBtn').hidden = !(won && G.state === 'over' && !G.online && !G.continued);
    $('rematchBtn').hidden = !!G.online;
    $('endScreen').hidden = false;
    this.audio.play(won ? 'win' : 'lose', 3000);
    requestAnimationFrame(() => this.drawChart());
  },
  drawChart() {
    const G = this.G, cv = this.$('chart');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const H = G.hist;
    if (H.length < 2) return;
    const tot = G.map.landArea;
    const ids = G.P.filter((p) => p && p.spawned && p.type !== 'bot').sort((a, b) => b.peak - a.peak).slice(0, 6).map((p) => p.id);
    if (G.me && !ids.includes(G.me.id)) ids.push(G.me.id);
    let maxV = 4;
    for (const s of H) for (const id of ids) maxV = Math.max(maxV, ((s.v[id] || 0) / tot) * 100);
    const step = [1, 2, 5, 10, 20, 25].find((st) => maxV / st <= 5) || 25;
    maxV = Math.min(100, Math.ceil(maxV / step) * step);
    const pl = 34, pr = 10, pt = 8, pb = 20;
    const X = (i) => pl + (i / (H.length - 1)) * (w - pl - pr);
    const Y = (v) => pt + (1 - v / maxV) * (h - pt - pb);
    ctx.font = `11px ${RA.FONT_UI}`;
    ctx.fillStyle = '#98a6b3';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= maxV + 0.001; v += step) {
      ctx.beginPath();
      ctx.moveTo(pl, Y(v));
      ctx.lineTo(w - pr, Y(v));
      ctx.stroke();
      ctx.fillText(v + '%', pl - 6, Y(v));
    }
    ctx.textBaseline = 'top';
    const dur = H[H.length - 1].t / 10;
    for (let k = 0; k <= 3; k++) {
      ctx.textAlign = k === 0 ? 'left' : k === 3 ? 'right' : 'center';
      ctx.fillText(RA.TICK_REAL > 100 ? RA.dur((dur * 10 * k) / 3) : RA.fmtTime((dur * k) / 3), X(((H.length - 1) * k) / 3), h - pb + 5);
    }
    if (maxV >= 70) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(242,177,52,0.6)';
      ctx.beginPath();
      ctx.moveTo(pl, Y(70));
      ctx.lineTo(w - pr, Y(70));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const legend = [];
    for (const id of ids.slice().reverse()) {
      const p = G.P[id];
      ctx.beginPath();
      H.forEach((s, i) => {
        const v = ((s.v[id] || 0) / tot) * 100;
        if (i === 0) ctx.moveTo(X(i), Y(v));
        else ctx.lineTo(X(i), Y(v));
      });
      ctx.strokeStyle = p.hex;
      ctx.lineWidth = p === G.me ? 3 : 1.6;
      ctx.stroke();
      legend.unshift(`<span><i style="background:${p.hex}"></i>${RA.esc(p.name)}${p === G.me ? RA.t(" (you)") : ''}</span>`);
    }
    // key moments (plan 23): my wars, alliances and betrayals, fallen capitals and states, nuclear launches
    const me = G.me, end = H[H.length - 1].t || 1, M = RA.MARKS;
    const mine = (k) => me && (k.a === me.id || k.b === me.id);
    const shown = (G.marks || []).filter((k) => M[k.t] && (mine(k) || k.t === 'fall' || k.t === 'nuke'));
    const XT = (t) => pl + (Math.min(t, end) / end) * (w - pl - pr);
    let lastX = -99;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `12px ${RA.FONT_UI}`;
    for (const k of shown) {
      const x = XT(k.tick);
      if (x - lastX < 9) continue; // too close to the last one
      lastX = x;
      ctx.strokeStyle = M[k.t].c;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(x, pt);
      ctx.lineTo(x, h - pb);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = M[k.t].c;
      ctx.fillText(M[k.t].s, x, pt + 6);
    }
    const kinds = [...new Set(shown.map((k) => k.t))];
    if (kinds.length) legend.push(`<span class="mk">${kinds.map((t) => `<b style="color:${M[t].c}">${M[t].s}</b> ${M[t].n}`).join(' · ')}</span>`);
    this.$('legend').innerHTML = legend.join('');
  },
});

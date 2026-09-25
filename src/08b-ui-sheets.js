'use strict';
/* Ratni Atlas — bottom sheets: army, build, landing, missiles, diplomacy, map-cell menu, menu, how-to, end screen */

Object.assign(RA.UI.prototype, {
  /* why a unit can't be recruited right now ('' = ok) */
  unitWhy(type) {
    const G = this.G, me = G.me, U = RA.UNIT[type];
    const cap = G.unitCap(me);
    if (me.units.length >= cap) return `Limit ${cap} jedinica — svaka kasarna daje još ${RA.CFG.UNIT_PER_BARRACKS}`;
    if (U.na) return 'Ne postoji u ovom dobu';
    if (U.needs && !me.n[U.needs]) return `Treba zgrada: ${RA.STRUCT[U.needs].name}`;
    if (U.naval && G._portLaunch(me, me.capital) < 0) return 'Treba ti spremna luka na moru';
    if (me.gold < G.unitCost(me, type)) return 'Nemaš dovoljno zlata';
    if (me.troops < U.troops * 1.2) return 'Premalo vojnika';
    return '';
  },
  unitStatus(u) {
    const tk = this.G.tick;
    if (u.ready > tk) return 'raspoređuje se';
    if (u.empUntil > tk) return 'EMP — ne radi';
    if (tk - u.lastHit < 20) return 'u borbi';
    if (u.path && u.pi < u.path.length) return 'u pokretu';
    return 'na položaju';
  },

  /* ---------------- army ---------------- */
  armySheet(keep) {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    if (this.mode && (this.mode.kind === 'recruit' || this.mode.kind === 'unit')) this.setMode(null);
    const C = RA.CFG, tk = G.tick, cap = G.unitCap(me);
    let h = this.head('Vojska', `Jedinica ${me.units.length}/${cap} · vojnika ${RA.fmt(me.troops)} · zlato ${RA.fmt(me.gold)}`);
    const ready = tk >= me.mobReady;
    const add = me.maxT * C.MOB_SHARE;
    h += '<div class="btns">' + this.btn({
      icon: 'mob', cls: ready ? 'primary' : '', attrs: 'data-mob', dis: !ready,
      t: 'Mobilizacija',
      d: ready ? `Odmah +${RA.fmt(add)} vojnika. Rast vojske zatim stoji 45 s.` : `Ponovo spremna za ${RA.fmtTime((me.mobReady - tk) / 10)}`,
      r: '+' + RA.fmt(add),
    }) + '</div>';
    h += '<div class="sec-t">Regrutuj jedinicu</div><p class="explain">Postavi je uz granicu — sama prati front. Neprijatelju otežava proboj, a tvoje napade u blizini čini jeftinijim.</p><div class="btns">';
    for (const type of ['inf', 'tank', 'art', 'ship', 'sub']) {
      const U = RA.UNIT[type];
      if (U.na) continue;
      if (type === 'ship') h += '</div><div class="sec-t">Mornarica</div><p class="explain">Brodovi isplovljavaju iz tvoje luke. Dodirni brod pa more da ga pošalješ. Ratni brod blokira neprijateljske luke u blizini i gađa obalu.</p><div class="btns">';
      const why = this.unitWhy(type);
      h += this.btn({
        model: U.sym || type, cls: 'model-btn', icon: U.sym || type, attrs: `data-rec="${type}"`, dis: !!why,
        t: U.name, d: RA.esc(why || U.desc),
        r: `${RA.fmt(G.unitCost(me, type))}<small>−${RA.fmt(U.troops)} vojnika</small>`,
      });
    }
    h += '</div><div class="sec-t">Tvoje jedinice</div>';
    if (!me.units.length) h += '<p class="note" style="margin-top:0">Još nemaš jedinica.</p>';
    else {
      h += '<div class="list">';
      for (const u of me.units) {
        const U = RA.UNIT[u.type];
        h += `<div class="prow hasu"><span class="sw u">${RA.Models.preview(U.sym || u.type, me.hex)}</span><div class="pn" data-sel="${u.id}"><div class="nm">${U.name}</div><div class="d">${Math.round((u.hp / U.hp) * 100)}% snage · ${this.unitStatus(u)}</div></div><div class="bb">${this.mini('Prikaži', `data-sel="${u.id}"`, '', false, 'eye')}${this.mini('Raspusti', `data-dis="${u.id}"`, 'warn')}</div></div>`;
      }
      h += '</div>';
    }
    const needs = ['inf', 'tank', 'art'].map((t) => RA.UNIT[t]).filter((U) => !U.na && U.needs).map((U) => `${U.name} ${U.pl ? 'traže' : 'traži'}: ${RA.STRUCT[U.needs].name}`).join('. ');
    h += `<p class="note">Limit: ${C.UNIT_BASE_CAP} + ${C.UNIT_PER_BARRACKS} po zgradi „${RA.STRUCT.barracks.name}”. ${needs ? needs + '. ' : ''}Dodirni svoju jedinicu na mapi pa novo mjesto da je premjestiš. Raspuštanjem se vraća 60% vojnika.</p>`;
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
    let h = this.head('Gradnja', `Zlato ${RA.fmt(me.gold)} · cijena raste sa svakom zgradom istog tipa`);
    h += '<div class="btns">';
    for (const t of RA.STRUCT_ORDER) {
      const S = RA.STRUCT[t];
      const cost = G.structCost(me, t);
      h += this.btn({
        model: S.icon || t, cls: 'model-btn', icon: S.icon || t, attrs: `data-t="${t}"`, dis: me.gold < cost,
        t: `${S.name} <span class="d">(${me.n[t]})</span>`, d: RA.esc(S.desc), r: RA.fmt(cost),
      });
    }
    h += '</div><p class="note">Poslije izbora dodirni mjesto na svojoj teritoriji. Zgrade moraju biti bar 4 polja jedna od druge, a novi grad bar 5 polja od postojećih gradova.</p>';
    this.openSheet(h, (s) => {
      s.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => {
        this.closeSheet();
        this.setMode({ kind: 'build', type: b.dataset.t });
      }));
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
        this.toast('tip', 'Sa aerodromom (Gradi → Aerodrom) ovdje dobijaš i padobranski desant.', { ms: 5000 });
      }
      return;
    }
    const C = RA.CFG, ap = this.readyAirports();
    const troops = RA.fmt(me.troops * this.ratio);
    let h = this.head('Desant', `Brodova ${me.boats}/${C.BOAT_MAX} · spremnih aerodroma ${ap.ready}/${ap.all}`);
    h += '<div class="btns">';
    h += this.btn({ model: 'boat', cls: 'model-btn', icon: 'boat', attrs: 'data-l="boat"', dis: me.boats >= C.BOAT_MAX, t: 'Brodom', d: 'Dodirni tuđu ili slobodnu obalu. Brod plovi oko kopna.', r: troops });
    h += this.btn({
      model: 'plane', cls: 'model-btn', icon: 'para', attrs: 'data-l="para"', dis: !ap.ready || me.gold < C.PARA_GOLD, t: 'Padobranci',
      d: ap.ready ? `Skok do ${C.PARA_RANGE} polja od aerodroma · ${RA.fmt(C.PARA_GOLD)} zlata · PVO ih može oboriti` : 'Aerodromi se pune — pričekaj',
      r: troops,
    });
    h += `</div><p class="note">Šalješ ${Math.round(this.ratio * 100)}% vojske (klizač „Snaga napada”).</p>`;
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
    let h = `<div class="sec-t">Avijacija · tipka A</div><p class="explain">Eskadrile čekaju na aerodromu (najviše ${C.AIR_PER_AIRPORT} svake vrste po aerodromu). Lovci obaraju neprijateljske avione iznad mjesta do ${C.FIGHT_R} polja od aerodroma i prate tvoje; PVO obara sve.</p><div class="btns">`;
    for (const k of ['fighter', 'bomber']) {
      const A = RA.AIR[k], full = cnt(k) >= aps * C.AIR_PER_AIRPORT;
      h += this.btn({ model: 'plane', cls: 'model-btn', icon: 'para', attrs: `data-air="${k}"`, dis: full || me.gold < A.cost, t: `${RA.airName(k)} · ${rdy(k)}/${cnt(k)} spremno`, d: full ? 'Aerodromi su puni — izgradi još jedan.' : A.desc, r: RA.fmt(A.cost) });
    }
    h += this.btn({ icon: 'attack', cls: 'primary', attrs: 'data-bomb', dis: !rdy('bomber') || G.inPeace(), t: 'Bombarduj', d: rdy('bomber') ? `Dodirni neprijateljsku zemlju do ${C.BOMB_RANGE} polja od aerodroma.` : cnt('bomber') ? 'Bombarderi su u zraku ili se pune.' : 'Prvo kupi bombardere.' });
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
    let h = this.head(RA.ERA.strikeTab, silos.length ? `${SN.name}: ${silos.length} · spremnih ${ready} · zlato ${RA.fmt(me.gold)}` : `Treba ti zgrada: ${SN.name}`);
    h += '<div class="btns">';
    if (!me.n.silo) {
      const cost = G.structCost(me, 'silo');
      h += this.btn({ icon: SN.icon || 'silo', cls: 'primary', attrs: 'data-silo', dis: me.gold < cost, t: `Izgradi: ${SN.name}`, d: me.gold >= cost ? 'Zatim dodirni mjesto na svojoj teritoriji' : 'Nedovoljno zlata', r: RA.fmt(cost) });
    }
    const peace = G.inPeace();
    for (const t of RA.missileTypes()) {
      const M = RA.MISSILE[t];
      const cost = G.missileCost(t, me);
      const wait = M.from && tk < M.from;
      h += this.btn({
        model: M.icon === 'siege' ? 'siege' : M.icon === 'zeppelin' ? 'zeppelin' : 'missile', icon: RA.missileIcon(t), cls: M.kind === 'conv' ? 'model-btn' : 'model-btn danger', attrs: `data-m="${t}"`,
        dis: (!me.n.silo && M.kind !== 'drone') || me.gold < cost || peace || wait, t: M.name,
        d: RA.esc(wait ? `Razvoj traje — dostupna za ${RA.fmtTime((M.from - tk) / 10)}.` : M.desc) + (M.range ? ` <b>Domet ${M.range} polja.</b>` : ''), r: RA.fmt(cost),
      });
    }
    const sam = RA.STRUCT.sam;
    h += `</div><p class="note">${peace ? `<b>Mirno doba:</b> udari su dozvoljeni za ${G.peaceLeft()} s. ` : ''}Prvi dodir na mapu nišani i pokazuje krug udara, drugi dodir (ili „Lansiraj”) ispaljuje.${RA.missileTypes().some((t) => RA.MISSILE[t].range) ? ' Bijeli krugovi pokazuju domet tvojih zgrada — gradi ih bliže frontu.' : ''}${sam.na ? '' : ` Neprijateljska „${sam.name}” obara projektile u krugu od ${RA.CFG.SAM_R} polja (crveni krugovi pri ciljanju).`}${RA.MISSILE.atom.na ? '' : ' Nuklearke kvare odnose sa svima; pogođeni saveznik raskida savez.'}</p>`;
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
      this.toast('info', 'MIRV cilja državu — dodirni tuđu teritoriju.');
      return false;
    }
    if (G.inPeace()) {
      this.toast('info', `Mirno doba — udari su dozvoljeni za ${G.peaceLeft()} s.`);
      return false;
    }
    if (M.range && M.kind !== 'drone' && !G.strikeSilo(me, type, c, true)) {
      this.toast('info', `Meta je izvan dometa (${M.range} polja od zgrade ${RA.STRUCT.silo.name}). Gradi bliže frontu.`);
      return false;
    }
    if (me.gold < G.missileCost(type, me)) {
      this.toast('info', 'Nemaš dovoljno zlata.');
      return false;
    }
    this.act('mis', [type, c]);
    this.setMode(null);
    return true;
  },
  confirm(title, text, yes, fn) {
    const h = this.head(title, '') + `<p class="note" style="margin-top:-4px;font-size:14px;color:#c9d4dc">${RA.esc(text)}</p><div class="btns" style="margin-top:14px"><button class="btn danger" data-y><span class="t">${RA.esc(yes)}</span></button><button class="btn" data-n><span class="t">Odustani</span></button></div>`;
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
        b.push(this.mini(`Pošalji ${Math.round(this.ratio * 100)}% vojske`, `data-do="send:${O.id}"`, 'ok', me.troops < 200, 'send'));
        b.push(this.mini('Traži pomoć', `data-do="help:${O.id}"`, '', false, 'flag'));
      }
      if (O.lord === me.id) b.push(this.mini('Oslobodi', `data-do="brk:${O.id}"`, 'warn'));
      else if (!team && me.lord !== O.id) {
        b.push(this.mini('Produži', `data-do="ext:${O.id}"`));
        b.push(this.mini('Raskini', `data-do="brk:${O.id}"`, 'warn'));
      }
    } else {
      const why = G.allyCount(me) >= C.ALLY_MAX ? 'limit' : G.allyCount(O) >= C.ALLY_MAX ? 'puno' : '';
      if (!O.lord) b.push(this.mini('Vojni savez', `data-do="propA:${O.id}"`, '', !!why || !!me.lord || G.allyReqs.some((r) => r.from === me.id && r.to === O.id), 'ally'));
      // a weak neighbour (or a beaten enemy) can become a vassal instead of being conquered
      if (!(O.human && !O.ai) && !G.vassalErr(me, O)) b.push(this.mini('Vazal', `data-do="vas:${O.id}"`, 'ok', false, 'flag'));
    }
    if (me.trade.has(O.id)) b.push(this.mini('Prekini trgovinu', `data-do="endT:${O.id}"`, 'warn'));
    else b.push(this.mini('Trgovina', `data-do="propT:${O.id}"`, '', me.trade.size >= C.TRADE_MAX || O.trade.size >= C.TRADE_MAX || G.atWar(me, O), 'trade'));
    return b.join('');
  },
  diploAct(act, id) {
    if (act === 'chat') return this.quickSheet();
    const G = this.G, me = G.me, O = G.P[id];
    if (!me || !O) return;
    const map = { accA: ['aRes', [id, 1]], decA: ['aRes', [id, 0]], accT: ['tRes', [id, 1]], decT: ['tRes', [id, 0]], propA: ['aReq', [id]], propT: ['tReq', [id]], send: ['give', [id, this.ratio]], help: ['help', [id]], vas: ['vas', [id]], ext: ['ext', [id]], endT: ['tEnd', [id]] };
    if (act === 'show') {
      this.closeSheet();
      this.focusPlayer(id);
      return;
    }
    if (act === 'brk' && O.lord === me.id) {
      this.confirm(`Osloboditi vazala (${O.name})?`, 'Više ti ne plaća danak i ne bori se uz tebe. Nije izdaja.', 'Oslobodi', () => this.act('brk', [id]));
      return;
    }
    if (act === 'brk') {
      this.confirm(`Raskinuti vojni savez (${O.name})?`, 'To je izdaja: 30 sekundi imaš prepolovljenu odbranu, a ostale države ti manje vjeruju.', 'Raskini savez', () => this.act('brk', [id]));
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
    let h = this.head('Savezi', `Vojni ${G.allyCount(me)}/${C.ALLY_MAX} · trgovinski ${me.trade.size}/${C.TRADE_MAX} · +${RA.fmt(me.tradeRate || 0)}/s od trgovine`);
    const ae = Math.round(me.ae || 0);
    h += `<p class="explain">Agresivna ekspanzija: <b${ae >= C.AE_COALITION ? ' class="neg"' : ''}>${ae}/100</b>. Raste sa svakom napadnutom i pokorenom državom (broj država, ne površina), vremenom opada. Od ${C.AE_COALITION} kompjuterske države te izbjegavaju, raskidaju saveze s tobom i udružuju se protiv tebe.</p>`;
    if (G.online) h += `<div class="btns" style="margin-bottom:10px">${this.btn({ icon: 'chat', attrs: 'data-do="chat:0"', t: 'Brze poruke saveznicima', d: 'Poruke i emoji koje vide saveznici i tim (tipka T)' })}</div>`;
    // offers
    const offers = G.allyReqs.filter((r) => r.to === me.id).map((r) => ['A', r]).concat(G.tradeReqs.filter((r) => r.to === me.id).map((r) => ['T', r]));
    if (offers.length) {
      h += '<div class="sec-t">Ponude</div><div class="list">';
      for (const [k, r] of offers) {
        const o = G.P[r.from];
        h += row(o, k === 'A' ? 'nudi <b>vojni savez</b>' : 'nudi <b>trgovinski savez</b>', this.mini('Prihvati', `data-do="acc${k}:${o.id}"`, 'ok') + this.mini('Odbij', `data-do="dec${k}:${o.id}"`));
      }
      h += '</div>';
    }
    // military alliances
    h += `<div class="sec-t">Vojni savezi · ${G.allyCount(me)}/${C.ALLY_MAX}</div><p class="explain">Ne napadate se. Kad te neko napadne, saveznici udaraju na njega ili ti šalju vojsku. Traje 5 min, može se produžiti.</p>`;
    if (!me.allies.size) h += '<p class="note" style="margin-top:0">Nemaš vojnih saveznika.</p>';
    else {
      h += '<div class="list">';
      for (const [oid, exp] of me.allies) {
        const o = G.P[oid];
        const kind = o.lord === me.id ? `<span class="tag al">vazal · danak +${RA.fmt(o.tribute || 0)}/s</span>` : me.lord === oid ? '<span class="tag al">tvoj gospodar · daješ danak</span>' : isFinite(exp) ? 'ističe za ' + RA.fmtTime(Math.max(0, (exp - tk) / 10)) : '<span class="tag al">tim · stalni savez</span>';
        h += row(o, `${kind} · vojska ${RA.fmt(o.troops)}${o.trade && me.trade.has(oid) ? ' · <span class="tag tr">⇄ trgovina</span>' : ''}`, this.diploButtons(o, true), true);
      }
      h += '</div>';
    }
    // trade agreements
    h += `<div class="sec-t">Trgovinski savezi · ${me.trade.size}/${C.TRADE_MAX}</div><p class="explain">Trgovački brodovi između vaših luka i trgovina preko zajedničke granice donose zlato objema stranama. Nema obaveze pomoći u ratu. Napad prekida trgovinu.</p>`;
    if (!me.trade.size) h += '<p class="note" style="margin-top:0">Nemaš trgovinskih saveza. Za pomorsku trgovinu trebate luke; susjedi mogu trgovati i kopnom.</p>';
    else {
      h += '<div class="list">';
      for (const oid of me.trade) {
        const o = G.P[oid];
        const land = me.nbCache && me.nbCache.has(oid);
        const via = [land ? 'kopnom' : '', me.n.port && o.n.port ? 'morem' : ''].filter(Boolean).join(' i ') || 'nema puta — trebaju luke ili granica';
        const rs = G.deps && o.res ? ' · ima: ' + ([0, 1, 2].filter((s) => o.res[s]).map((s) => `${RA.resKind(s, G.era).name} ${Math.round(G.resRate(o, s) * 100)}%`).join(', ') || 'ništa') : '';
        h += row(o, `trgovina: ${via}${rs}`, this.mini('Prekini', `data-do="endT:${oid}"`, 'warn'));
      }
      h += '</div>';
    }
    // everybody else
    const nb = me.nbCache || new Map();
    const others = G.P.filter((o) => o && o.alive && o.spawned && o !== me && (o.type !== 'bot' || nb.has(o.id)))
      .sort((a, b) => (nb.has(b.id) ? 1 : 0) - (nb.has(a.id) ? 1 : 0) || b.tiles - a.tiles)
      .slice(0, 24);
    h += '<div class="sec-t">Države</div><div class="list">';
    for (const o of others) {
      const tags = (o.lord ? `<span class="tag al">vazal: ${RA.esc(G.P[o.lord].name)}</span>` : me.allies.has(o.id) ? '<span class="tag al">⛨ savez</span>' : '') + (me.trade.has(o.id) ? '<span class="tag tr">⇄ trgovina</span>' : '');
      const meta = `${o.ai ? this.relLabel(o.rel[me.id]) + ' · ' : ''}${nb.has(o.id) ? 'susjed · ' : ''}vojska ${RA.fmt(o.troops)}${tags}`;
      h += row(o, meta, this.diploButtons(o, false), true);
    }
    h += '</div>';
    h += `<p class="note">Vazal: slaba država (najviše ${Math.round(C.VASSAL_TROOPS * 100)}% tvoje vojske i ${Math.round(C.VASSAL_AREA * 100)}% zemlje), susjed ili protivnik u ratu, može pristati da ti bude vazal umjesto da je osvojiš — plaća ${Math.round(C.TRIBUTE * 100)}% prihoda i bori se uz tebe; najviše ${C.VASSAL_MAX}. Ako oslabiš, oslobodi se.</p>`;
    h += `<p class="note">Najviše ${C.ALLY_MAX} vojna i ${C.TRADE_MAX} trgovinskih saveza. Izdaja saveznika = 30 s prepolovljene odbrane i loš ugled kod svih.</p>`;
    this.openSheet(h, (s) => this.bindDiplo(s), keep, () => this.diploSheet(true));
  },

  /* ---------------- long-press menu for one map cell ---------------- */
  cellSheet(c, keep) {
    const G = this.G, map = G.map, me = G.me;
    if (c < 0 || !me || !me.alive) return;
    if (map.block[c]) {
      this.toast('info', 'To je izvan odabrane regije.');
      return;
    }
    if (!map.land[c]) {
      this.toast('info', 'More. Za desant izaberi „Desant” pa dodirni obalu.');
      return;
    }
    const W = map.W, C = RA.CFG, tk = G.tick;
    const cx = c % W, cy = (c / W) | 0;
    const ci = map.cityAt[c];
    let city = ci >= 0 ? map.cities[ci] : null;
    if (!city) for (const ct of G.cities) if (Math.abs(ct.x - cx) <= 2 && Math.abs(ct.y - cy) <= 2) city = ct;
    const terr = RA.TERR_NAME[map.terr[c]] + (map.river[c] ? ' · rijeka' : '') + (map.coast[c] ? ' · obala' : '');
    const cityLine = city ? `${city.tier === 3 ? 'Prijestolnica' : city.tier === 2 ? 'Metropola' : 'Grad'} ${RA.esc(city.name)} · ` : '';
    const oid = G.owner[c];
    const O = oid ? G.P[oid] : null;
    const pct = (p) => ((p.area / G.landTotal()) * 100).toFixed(1).replace('.', ',') + '%';
    const unitsNear = G.units.filter((u) => !u.dead && Math.hypot(u.x - cx - 0.5, u.y - cy - 0.5) <= 4);
    const unitLine = unitsNear.length ? `<p class="explain">Jedinice ovdje: ${unitsNear.map((u) => `${RA.UNIT[u.type].name} (${RA.esc(G.P[u.owner].name)}, ${Math.round((u.hp / RA.UNIT[u.type].hp) * 100)}%)`).join(', ')}</p>` : '';
    let h = '';
    if (O === me) {
      h += this.head('Tvoja teritorija', cityLine + terr, me.hex) + unitLine;
      h += '<div class="sec-t">Gradi ovdje</div><div class="grid2">';
      for (const t of RA.STRUCT_ORDER) {
        const S = RA.STRUCT[t];
        const why = G.canBuild(me, t, c);
        const ok = typeof why === 'number';
        h += this.btn({ icon: S.icon || t, attrs: `data-build="${t}"`, dis: !ok, t: S.short || S.name, d: ok ? RA.fmt(G.structCost(me, t)) : RA.esc(why.replace(/\.$/, '')) });
      }
      h += '</div><div class="sec-t">Postavi jedinicu ovdje</div><div class="grid2">';
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
      }, keep);
      return;
    }
    const troopsTxt = RA.fmt(me.troops * this.ratio);
    const peace = G.inPeace();
    const acts = [];
    const myAtt = G.attacks.find((a) => !a.done && a.a === me.id && a.t === oid);
    if (!O) {
      h += this.head('Slobodna zemlja', cityLine + terr) + unitLine;
      acts.push(this.btn({ icon: 'attack', cls: 'primary', attrs: 'data-act="attack"', t: 'Širi se ovamo', d: 'Front kreće prema ovoj tački', r: troopsTxt }));
    } else {
      const ally = me.allies.has(O.id);
      const kind = O.type === 'nation' ? `Država · ${RA.PERS[O.ai.pers].label}` : O.type === 'bot' ? 'Grad-država' : 'Igrač';
      const traitor = O.traitorUntil > tk ? ' · <b style="color:#ffb3b3">izdajnik</b>' : '';
      h += this.head(O.name, `${kind}${traitor} · ${cityLine}${terr}`, O.hex);
      const cities = O.nCity[1] + O.nCity[2] + O.nCity[3] + O.n.city;
      h += `<div class="kv"><div><div class="k">Vojska</div><div class="v">${RA.fmt(O.troops)}</div></div><div><div class="k">Kopno</div><div class="v">${pct(O)}</div></div><div><div class="k">Gradovi</div><div class="v">${cities}</div></div></div>`;
      const tags = (ally ? ' · <span class="tag al">⛨ vojni savez</span>' : '') + (me.trade.has(O.id) ? ' · <span class="tag tr">⇄ trgovina</span>' : '');
      if (O.ai) h += `<p class="explain">Stav prema tebi: ${this.relLabel(O.rel[me.id])}${tags} · jedinica: ${O.units.length}</p>`;
      h += unitLine;
      if (!ally) {
        acts.push(this.btn({
          icon: 'attack', cls: 'primary', attrs: 'data-act="attack"', dis: peace,
          t: O ? 'Napadni ovaj dio' : 'Zauzmi', d: peace && O ? `Mirno doba — napadi za ${G.peaceLeft()} s` : O ? `${Math.round(this.ratio * 100)}% vojske · s najbliže granice do ove tačke` : `${Math.round(this.ratio * 100)}% vojske, širenje prema ovoj tački`, r: troopsTxt,
        }));
        if (O) acts.push(this.btn({
          icon: 'attack', attrs: 'data-act="attackAll"', dis: peace,
          t: 'Napadni cijelu granicu', d: `${Math.round(this.ratio * 100)}% vojske · front na svakom dodiru s ovom državom`, r: troopsTxt,
        }));
      }
    }
    if (myAtt) acts.push(this.btn({ icon: 'retreat', attrs: 'data-act="retreat"', t: 'Obustavi napad', d: `U napadu je ${RA.fmt(myAtt.troops)} vojnika · vraća se ${O ? '75%' : 'sve'}` }));
    if (map.coast[c] && (!O || !me.allies.has(O.id))) {
      acts.push(this.btn({ icon: 'boat', attrs: 'data-act="boat"', dis: me.boats >= C.BOAT_MAX || (O && peace), t: 'Desant brodom na ovu obalu', d: `Brodovi: ${me.boats}/${C.BOAT_MAX}`, r: troopsTxt }));
    }
    if (RA.ERA.para && me.n.airport && (!O || !me.allies.has(O.id))) {
      const ap = G.paraAirport(me, c);
      acts.push(this.btn({ icon: 'para', attrs: 'data-act="para"', dis: !ap || me.gold < C.PARA_GOLD || (O && peace), t: 'Padobranci ovdje', d: ap ? `${RA.fmt(C.PARA_GOLD)} zlata · ${Math.round(this.ratio * 100)}% vojske` : `Nijedan spreman aerodrom u dometu (${C.PARA_RANGE} polja)`, r: troopsTxt }));
    }
    h += `<div class="btns">${acts.join('')}</div>`;
    if (G.online) h += `<div class="sec-t">Označi za saveznike</div><div class="grid2">${RA.PINGS.map((P, i) => this.btn({ icon: P.icon, attrs: `data-ping="${i}"`, t: P.name, d: 'ping na karti' })).join('')}</div>`;
    if (O && O.type !== 'me') h += `<div class="sec-t">Odnosi</div><div class="bb" style="display:flex;flex-wrap:wrap;gap:6px">${this.diploButtons(O, true)}</div>`;
    if (me.n.silo) {
      h += `<div class="sec-t">${RA.esc(RA.ERA.strikeTab)} na ovu tačku</div><div class="grid2">`;
      for (const t of RA.missileTypes()) {
        if (t === 'mirv' && !O) continue;
        const M = RA.MISSILE[t];
        const cost = G.missileCost(t, me);
        const far = M.range && !G.strikeSilo(me, t, c, true);
        const wait = M.from && tk < M.from;
        h += this.btn({ icon: RA.missileIcon(t), cls: M.kind === 'conv' ? '' : 'danger', attrs: `data-nuke="${t}"`, dis: me.gold < cost || peace || far || wait, t: M.name, d: far ? 'izvan dometa' : wait ? 'razvoj traje' : RA.fmt(cost) });
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

  /* quick messages to allies and team (online) */
  /* the economy: tax (more gold ↔ slower army growth) and interest on saved gold; tap the gold in the top bar or Z */
  econSheet(keep) {
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play') return;
    const T = RA.TAX, cur = RA.TAX[me.tax] || T[2], pct = (v) => (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%';
    const h = this.head('Ekonomija', `Zlato ${RA.fmt(me.gold)} · +${RA.fmt(me.goldRate || 0)}/s · vojska ${me.growRate >= 0 ? '+' : '−'}${RA.fmt(Math.abs(me.growRate || 0))}/s`) +
      `<div class="field"><span class="lab">Porez: ${RA.esc(cur.name)}</span><div class="seg wrap" id="taxSeg" role="group" aria-label="Porez">${T.map((t, i) => `<button data-v="${i}" aria-pressed="${i === me.tax}">${RA.esc(t.name)}</button>`).join('')}</div>
      <p class="note">Viši porez: više zlata, ali vojska sporije raste. Niži: vojska brže raste, zlata manje.<br>Sada: zlato ${cur.g === 1 ? 'normalno' : pct(cur.g)}, rast vojske ${cur.grow === 1 ? 'normalan' : pct(cur.grow)}.</p></div>
      <div class="field"><span class="lab">Kamata</span><p class="note">Ušteđeno zlato donosi 1% u minuti, najviše četvrtinu tvog prihoda. Sada: <b>+${RA.fmt(me.interest || 0)}/s</b>.</p></div>` +
      this.resHtml() + this.loanHtml() + this.straitHtml();
    this.openSheet(h, (s) => {
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
        if (v) this.confirm(`Zatvoriti ${G.straits[i].name}?`, 'Prolaze samo tvoji i savezniči brodovi. Svi koji plove tim morima se ljute (sve više što duže traje), a to je i agresija: sam protiv svih — koalicija; s jakim saveznicima možeš izdržati.', 'Zatvori', go);
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
  /* resources: what you have, buy, or miss (and what missing costs you); partners' offers with their prices */
  resHtml() {
    const G = this.G, me = G.me;
    if (!G.deps || !me.res) return '';
    let h = '<div class="sec-t">Resursi</div><p class="explain">Bez resursa ništa nije zabranjeno, samo skuplje ili sporije. Što nemaš, kupuješ od trgovinskog partnera za dio svog prihoda dok kupuješ (ko ima više nalazišta, prodaje jeftinije).</p><div class="list">';
    for (let s = 0; s < 3; s++) {
      const K = RA.resKind(s, G.era), sid = me.imp[s], q = G.P[sid];
      let d, bb = '';
      if (me.res[s]) d = `<span class="pos">imaš</span> · ${me.res[s]} ${me.res[s] === 1 ? 'nalazište' : 'nalazišta'}`;
      else if (sid && q) {
        d = `kupuješ od ${RA.esc(q.name)} · ${Math.round(G.resRate(q, s) * 100)}% prihoda`;
        bb = this.mini('Prekini', `data-buy="${s}:0"`, 'warn');
      } else {
        d = `<span class="neg">nemaš</span> — ${RA.RES[s].lack}`;
        const sellers = [...me.trade].map((id) => G.P[id]).filter((o) => o && o.alive && o.res && o.res[s]).sort((a, b) => G.resRate(a, s) - G.resRate(b, s));
        bb = sellers.slice(0, 3).map((o) => this.mini(`${RA.esc(o.name)} ${Math.round(G.resRate(o, s) * 100)}%`, `data-buy="${s}:${o.id}"`)).join('');
        if (!sellers.length) d += '<br>Nijedan trgovinski partner ga nema — sklopi trgovinski savez (Savezi).';
      }
      h += `<div class="prow wide"><span class="sw res-${RA.RES[s].id}"></span><div class="pn"><div class="nm">${K.name}</div><div class="d">${d}</div></div><div class="bb">${bb}</div></div>`;
    }
    if (me.resRateIn) h += `<p class="note">Prodaješ drugima: +${RA.fmt(me.resRateIn)}/s.</p>`;
    return h + '</div>';
  },
  /* straits: who holds them; the holder of both shores may close one for foreign ships */
  straitHtml() {
    const G = this.G, me = G.me;
    if (!G.straits.length) return '';
    let h = '<div class="sec-t">Moreuzi</div><p class="explain">Ko drži obje obale moreuza može ga zatvoriti za tuđe brodove (desanti i trgovina). Prolaze samo njegovi i savezniči brodovi.</p><div class="list">';
    for (const st of G.straits) {
      const H = G.P[st.holder], C = G.P[st.closed];
      const d = C ? `<span class="neg">zatvoren</span> · ${RA.esc(C.name)}` : H ? `otvoren · obje obale drži ${RA.esc(H.name)}` : 'otvoren · obale drže različite države';
      const btn = st.holder === me.id ? this.mini(st.closed ? 'Otvori' : 'Zatvori', `data-str="${st.i}:${st.closed ? 0 : 1}"`, st.closed ? 'ok' : 'warn') : '';
      h += `<div class="prow wide"><span class="sw" style="background:${C ? C.hex : H ? H.hex : '#6f8190'}"></span><div class="pn"><div class="nm">${RA.esc(st.name)}</div><div class="d">${d}</div></div><div class="bb">${btn}</div></div>`;
    }
    return h + '</div>';
  },
  /* loans: the open ones (repay) and who would lend (neighbours and partners with gold) */
  loanHtml() {
    const G = this.G, me = G.me, C = RA.CFG;
    let h = `<div class="sec-t">Zajmovi</div><p class="explain">Država kompjutera ti posudi zlato; dio tvoje zemlje najbliži njoj je zalog (šrafirano na karti). Vraćaš iznos + ${Math.round(C.LOAN_RATE * 100)}% za ${Math.round(C.LOAN_DUE / 600)} min — kad dođe rok, uzima se samo ako imaš zlata. Ne vratiš → zalog je njen.</p>`;
    const mine = G.loans.filter((l) => l.to === me.id);
    if (mine.length) {
      h += '<div class="list">';
      for (const l of mine) {
        const L = G.P[l.from];
        h += `<div class="prow wide"><span class="sw" style="background:${L.hex}"></span><div class="pn"><div class="nm">${RA.esc(L.name)}</div><div class="d">duguješ <b>${RA.fmt(l.owed)}</b> · rok ${RA.fmtTime(Math.max(0, (l.due - G.tick) / 10))} · zalog ${l.cells.length} polja</div></div><div class="bb">${this.mini('Vrati', `data-pay="${l.id}"`, 'ok', me.gold < l.owed)}</div></div>`;
      }
      h += '</div>';
    }
    if (mine.length >= C.LOAN_MAX) return h;
    const nb = me.nbCache || new Map();
    const lenders = G.P.filter((o) => o && o.alive && o !== me && o.type === 'nation' && o.ai && (nb.has(o.id) || me.trade.has(o.id) || me.allies.has(o.id)) && !mine.some((l) => l.from === o.id))
      .sort((a, b) => b.gold - a.gold).slice(0, 5);
    if (!lenders.length) return h + '<p class="note">Nema ko da ti posudi: zajam daju susjedi, trgovinski partneri i saveznici.</p>';
    h += '<div class="list">';
    for (const L of lenders) {
      const bs = C.LOAN_SECS.map((_, k) => {
        const o = G.loanOffer(me, L, k), err = G.loanErr(me, L, k);
        return this.mini(`${RA.fmt(o.amount)}`, `data-loan="${L.id}:${k}" title="${RA.esc(err || `Vraćaš ${RA.fmt(o.owed)}; zalog ${o.cells} polja`)}"`, '', !!err);
      }).join('');
      h += `<div class="prow wide"><span class="sw" style="background:${L.hex}"></span><div class="pn"><div class="nm">${RA.esc(L.name)}</div><div class="d">${this.relLabel(L.rel[me.id])} · zlato ${RA.fmt(L.gold)}${G.atWar(me, L) ? ' · u ratu' : ''}</div></div><div class="bb">${bs}</div></div>`;
    }
    return h + '</div><p class="note">Zalog: ' + C.LOAN_PLEDGE.map((v) => Math.round(v * 100) + '%').join(' / ') + ' tvoje zemlje za mali / srednji / veliki zajam.</p>';
  },
  quickSheet() {
    const G = this.G;
    if (!G || !G.me || G.state !== 'play') return;
    const h = this.head('Brze poruke', 'Vide ih tvoji saveznici i tim · tipka T') + `<div class="qm-grid">${RA.QUICK_MSGS.map((m, i) => `<button class="btn" data-qm="${i}"><span class="t">${RA.esc(m)}</span></button>`).join('')}</div>
      <p class="note">Ping na karti: desni klik (dugi dodir) na mjesto → „Označi za saveznike”, ili tipka G na mjestu miša.</p>`;
    this.openSheet(h, (s) => s.querySelectorAll('[data-qm]').forEach((b) => (b.onclick = () => {
      this.closeSheet();
      this.act('qm', [+b.dataset.qm]);
    })));
  },

  /* ---------------- menu & rules ---------------- */
  menu() {
    const app = this.app, G = this.G;
    const reg = G.map.region;
    let h = this.head('Meni', `${RA.esc(RA.ERA.name)} · ${RA.esc(reg ? reg.name : RA.mapInfo(G.map.id).all)}${G.zone ? ' · battle royale' : ''} · ${RA.DIFF[G.opts.difficulty] ? RA.DIFF[G.opts.difficulty].label : ''} · vrijeme ${RA.fmtTime(G.tick / 10)}`);
    h += `<div class="btns">
      <button class="btn primary" data-m="resume"><span class="t">Nastavi</span></button>
      <button class="btn" data-m="how"><span class="t">Kako se igra</span></button>
      <button class="btn" data-m="cities"><span class="t">Imena gradova</span><span class="r" style="font-size:14px">${app.fx.showCities ? 'Uključeno' : 'Isključeno'}</span></button>
      <button class="btn" data-m="osm" ${app.osmOK ? '' : 'disabled'}><span><span class="t">Podloga: ${app.osmOn ? 'OpenStreetMap' : 'Atlas (ugrađena)'}</span><br><span class="d">${app.osmOK ? 'Dodirni za promjenu' : 'OpenStreetMap pločice rade kad igru hostamo na vlastitoj adresi — Claude pregled blokira vanjske slike.'}</span></span></button>
      <button class="btn" data-m="tips"><span class="t">Savjeti tokom igre</span><span class="r" style="font-size:14px">${this.noTips ? 'Isključeno' : 'Uključeno'}</span></button>
      <button class="btn" data-m="cb"><span class="t">Mod za daltoniste</span><span class="r" style="font-size:14px">${this.settings.cb ? 'Uključeno' : 'Isključeno'}</span></button>
      <button class="btn" data-m="sfx"><span class="t">Zvučni efekti</span><span class="r" style="font-size:14px">${this.audio.s.sfx ? 'Uključeno' : 'Isključeno'}</span></button>
      <button class="btn" data-m="music"><span class="t">Muzika</span><span class="r" style="font-size:14px">${this.audio.s.music ? 'Uključeno' : 'Isključeno'}</span></button>
      <button class="btn danger" data-m="new"><span><span class="t">${G.online ? 'Napusti online igru' : 'Nova igra'}</span><br><span class="d">${G.online ? 'Tvoju državu preuzima kompjuter' : 'Trenutna partija se prekida'}</span></span></button>
    </div>
    <p class="note">Tipke: Space pauza · 1–3 brzina · Q/E snaga napada · V vojska · B gradnja · D desant · P padobranci · R rakete · S savezi · M mobilizacija · Esc odustani.</p>`;
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
        } else if (m === 'sfx' || m === 'music') {
          this.audio.toggle(m);
          this.menu();
        } else if (m === 'tips') {
          this.noTips = !this.noTips;
          this.closeSheet();
        } else if (m === 'new') {
          if (G.online) this.confirm('Napustiti online igru?', app.net && app.net.role === 'host' ? 'Ti si domaćin: kad izađeš, igra staje i za prijatelja.' : 'Tvoju državu preuzima kompjuter, a prijatelj nastavlja.', 'Napusti', () => app.showStart());
          else this.confirm('Prekinuti partiju?', 'Počinješ ispočetka sa novim postavkama.', 'Nova igra', () => app.showStart());
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
    const h = this.head('Kako se igra', 'Overtake — pravila ukratko') + `<div class="howto">
      <h4>Cilj</h4><p>Zauzmi ${win}% kopna odabranog dijela karte ili ostani posljednja država. Kad pobijediš, možeš nastaviti igru i osvojiti sve. Ko drži više od ${pc(35)}% karte, plaća svako novo osvajanje skuplje.</p>
      <h4>Doba</h4><p>Na početnom ekranu biraš period u kojem se boriš. Svako doba ima svoje granice, gradove, jedinice, zgrade i oružje:</p><ul>${eras}</ul>
      <h4>Početak</h4><ul>
        <li><b>Stvarne granice</b>: sve države kreću sa svojom teritorijom iz tog doba. Dodirni državu ili je izaberi sa spiska — dobijaš njenu zemlju, vojsku i zlato.</li>
        <li><b>Od prijestolnice</b>: države kreću od malog kruga oko glavnog grada, a ostalo je slobodna (siva) zemlja i gradovi-države.</li>
        <li>Prvi minut (podesivo) je <b>mirno doba</b>: niko ne smije napadati države — gradi, zauzimaj slobodnu zemlju, sklapaj saveze.</li></ul>
      <h4>Battle royale</h4><p>Poslije mirnog doba i još 90 s radioaktivna zona počinje da se sužava prema nasumičnoj tački (${C.BR_PHASES} krugova). Bijeli isprekidani krug pokazuje kuda ide. Sve izvan crvenog kruga propada — i zemlja i vojska na njoj. Pobjeđuje ko ostane.</p>
      <h4>Širenje i napad</h4><ul>
        <li><b>Dodirni</b> slobodno kopno ili susjeda — šalješ onoliko vojske koliko pokazuje klizač <b>Snaga napada</b>.</li>
        <li><b>Usmjereni napad</b>: dodir na susjednu državu šalje vojsku s tvoje najbliže granice pravo do tog mjesta (strelica na karti) — osvaja se samo taj dio, pa se ostatak vojske vraća. Što više vojske pošalješ, to je koridor širi.</li>
        <li>Na računaru: <b>desnim dugmetom miša povuci strelicu</b> od svoje teritorije do cilja — napad ide baš tim pravcem.</li>
        <li>Front na cijeloj granici s državom: dugi pritisak (desni klik) na nju → <b>Napadni cijelu granicu</b>. Slobodno kopno se uvijek zauzima s cijele granice.</li>
        <li><b>Vrati granice</b>: kad ti neka država otme zemlju, u traci napada se pojavi žuto dugme „Vrati N polja” — jedan klik šalje kontranapad samo na tu zemlju (oteto u zadnje 3 minute), bez širenja dalje.</li>
        <li><b>Pravo prolaza</b>: vojni saveznik te pušta preko svoje zemlje — državu koja graniči s njim možeš napasti i ako ti s njom nemaš granicu.</li>
        <li>Rijeke, brda, planine i gradovi usporavaju napadača.</li>
        <li>Aktivni napadi su iznad donje trake. <b>✕</b> obustavlja napad i vraća vojsku (napad na državu: 25% se izgubi u povlačenju).</li></ul>
      <h4>Vojska i zlato</h4><ul>
        <li>Vojska raste sama, najbrže oko <b>42%</b> kapaciteta (zelena zona na traci).</li>
        <li><b>Mobilizacija</b> (Vojska): odmah +30% kapaciteta, ali rast stoji 45 s. Jednom u 4 minute.</li>
        <li>Zlato donose teritorija, gradovi, luke, vozovi ili karavani i trgovina.</li>
        <li><b>Mornarica</b> (Vojska): dva broda po dobu, iz tvoje luke. Dodirni brod pa more. Ratni brod potapa desante i trgovačke brodove, blokira neprijateljske luke u blizini (bez zlata i trgovine) i gađa obalu; drugi brod lovi desante i trgovačke brodove (podmornica od 1914. je nevidljiva dok joj ratni brod ne priđe).</li>
        <li><b>Avijacija</b> (od 1938., Desant ili tipka A): lovci brane nebo oko aerodroma i prate tvoje avione, bombarderi ruše zgrade, jedinice i vojsku do 70 polja od aerodroma. <b>Dronovi</b> (danas, Rakete): jeftini, lete pravo s tvoje granice — kamikaza ili lovac na jedinice.</li>
        <li><b>Gvozdena kupola</b> (zgrada, od 1938.): kad neko lansira nuklearku na tebe, svaka spremna kupola sama ispali atomsku bombu na njegovu prijestolnicu i gradove.</li>
        <li><b>Resursi</b> (opcija u postavkama): žito, metal i gorivo na stvarnim nalazištima (znakovi na karti). Bez njih je sve skuplje ili sporije; što nemaš, kupiš od trgovinskog partnera (Ekonomija).</li>
        <li><b>Moreuzi</b> (Ekonomija): ko drži obje obale može zatvoriti moreuz za tuđe brodove. Svi koji tuda plove se ljute — zatvaranje je agresija.</li>
        <li><b>Zajam</b> (Ekonomija: klik na zlato ili Z): država kompjutera ti posudi zlato, dio tvoje zemlje je zalog (šrafirano). Ne vratiš na vrijeme → zalog je njen.</li>
        <li><b>Vazal</b> (meni Savezi): slabu susjednu državu možeš učiniti vazalom umjesto da je osvojiš — plaća ti danak i bori se uz tebe. Ako oslabiš, oslobodi se.</li>
        <li><b>Agresivna ekspanzija</b> (meni Savezi): svaka napadnuta i pokorena država ljuti ostale. Previše osvajanja odjednom → kompjuterske države se udružuju protiv tebe. Ljutnja vremenom opada.</li>
        <li><b>Porez</b> (klik na zlato gore ili tipka Z): viši porez daje više zlata, ali vojska sporije raste. Ušteđeno zlato donosi malu kamatu.</li></ul>
      <h4>Jedinice</h4><ul>
        <li>Tri vrste u svakom dobu (npr. legija, konjica i strijelci u Rimu; pješadija, tenkovi i artiljerija danas): prva čvrsto brani granicu, druga ubrzava i pojeftinjuje tvoje napade, treća gađa neprijatelja iz daljine.</li>
        <li>Jedinice same prate granicu. Dodirni svoju jedinicu pa novo mjesto da je premjestiš. Opkoljena jedinica propada.</li></ul>
      <h4>Gradnja</h4><ul>
        <li><b>Grad</b>: vojska, zlato i odbrana. <b>Fabrika</b> (u starim dobima tržnica ili manufaktura): put do tvojih gradova u krugu 18 polja — vozovi ili karavani donose zlato.</li>
        <li><b>Kasarna</b> (+vojska, +2 jedinice), <b>Utvrda</b>, <b>Luka</b>, a zavisno od doba i <b>Aerodrom</b> (padobranci), <b>Raketni silos</b> ili opsadna radionica, <b>PVO</b>.</li></ul>
      <h4>More i zrak</h4><p>Desant brodom na bilo koju obalu (najviše ${C.BOAT_MAX} broda). Od 1938. padobranci skaču do ${C.PARA_RANGE} polja od aerodroma; PVO ih može oboriti.</p>
      <h4>Udari i bombe</h4><ul>
        <li>U starim dobima onageri, trebušei, bombarde, rakete i topovi gađaju samo do svog <b>dometa</b> (bijeli krugovi pri ciljanju) — gradi ih blizu fronta.</li>
        <li>1914: Debela Berta i cepelini. 1938: V-2 rakete, a atomska bomba tek od 10. minute. Hladni rat i danas: sve do hidrogenske bombe i MIRV-a.</li>
        <li><b>Atomska</b> i <b>hidrogenska</b> bomba brišu teritoriju, uništavaju SVE zgrade i jedinice u krugu i ubijaju velik dio vojske mete.</li></ul>
      <h4>Savezi</h4><ul>
        <li><b>Vojni savez</b> (najviše ${C.ALLY_MAX}, traje 5 min): ne napadate se, a saveznici ti pomažu kad te neko napadne. Možeš im slati vojsku i tražiti pomoć.</li>
        <li><b>Trgovinski savez</b> (najviše ${C.TRADE_MAX}): trgovački brodovi između luka i trgovina preko granice donose zlato objema stranama — bez obaveza u ratu.</li>
        <li>Izdaja saveznika = 30 s prepolovljene odbrane i loš ugled kod svih.</li></ul>
      <h4>Zima i prijestolnice</h4><p>Svake 4 minute ${RA.esc(I.winterHow)} prekrije snijeg na 1 minut: napadi i jedinice su tamo sporiji. Pad prijestolnice znači krizu: −25% vojske, pola prihoda 60 s i plijen za osvajača.</p>
      <h4>Online s prijateljem</h4><p>Oboje otvorite war.deovilab.com; jedan pritisne „Napravi sobu”, drugi „Pridruži se”. Domaćin bira doba, kartu i način: <b>zajedno protiv svih</b> (stalni savez, dijelite pobjedu) ili <b>jedan protiv drugog</b>, uz battle royale ako želite. Brzinu i pauzu kontroliše domaćin.</p>
      <h4>Kontrole</h4><p>Jedan prst: pomjeranje · dva prsta: zum · dugi pritisak (desni klik): meni za to mjesto. Igru možeš pauzirati i ubrzati (1×–3×).</p>
    </div>`;
    this.openSheet(h);
  },

  /* ---------------- end screen ---------------- */
  showEnd(kind) {
    const G = this.G, me = G.me;
    const $ = this.$;
    const won = !!(G.winner && me && (G.winner === me || G.sameTeam(G.winner, me)));
    $('endTitle').textContent = won ? 'Pobjeda' : kind === 'lost' ? 'Poraz' : 'Kraj igre';
    $('endTitle').classList.toggle('win', !!won);
    const where = G.map.region ? G.map.region.name : RA.mapInfo(G.map.id).name;
    $('endSub').textContent = won
      ? (G.winner !== me ? `Vaš tim je osvojio: ${where} (${RA.fmtTime(G.tick / 10)}).` : `Osvojeno: ${where}, za ${RA.fmtTime(G.tick / 10)}.`)
      : kind === 'lost'
      ? `Tvoja država je pala poslije ${RA.fmtTime(G.tick / 10)}.`
      : `Pobjednik je ${G.winner ? G.winner.name : 'neko drugi'} (${where}).`;
    const peak = me ? ((me.peak / G.map.landArea) * 100).toFixed(1).replace('.', ',') : '0';
    $('endStats').innerHTML = `<div><div class="k">Vrhunac</div><div class="v">${peak}%</div></div><div><div class="k">Gradova osvojeno</div><div class="v">${me ? me.stats.citiesTaken : 0}</div></div><div><div class="k">Uništeno država</div><div class="v">${me ? me.stats.kills : 0}</div></div>`;
    $('endTime').textContent = RA.fmtTime(G.tick / 10);
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
      ctx.fillText(RA.fmtTime((dur * k) / 3), X(((H.length - 1) * k) / 3), h - pb + 5);
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
      legend.unshift(`<span><i style="background:${p.hex}"></i>${RA.esc(p.name)}${p === G.me ? ' (ti)' : ''}</span>`);
    }
    this.$('legend').innerHTML = legend.join('');
  },
});

'use strict';
/* Community market (plan phase 19): make a scenario in the editor, keep it on the account, publish it, play other
   people's. Sim side: src/04d-scenario.js; server: deploy/api/market.js; link /scenario-<code>.
   The editor is a borders game that never starts: the map shows it with the normal renderer, painting sets owners
   (G.setOwner) and saving keeps only what differs from the era (RA.scenDiff).
   Stable hooks for the look (Codex C8): #marketBtn, #marketSheet, #mkTabs, #mkQ, #mkList, #mkNew, [data-mkplay],
   [data-mkedit], [data-mklike], [data-mkdel]; the editor panel #edPanel (.ed-panel) with #edTool, #edBrush, #edState,
   #edName, #edColor, #edSlot, #edUndo, #edSave, #edPub, #edTry, #edExit, #edTitle, #edDesc, #edRules. */
RA.ED_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#f1c40f', '#7f8c8d', '#e84393', '#6c5ce7'];

RA.Editor = class {
  constructor(app, G, em, S, meta) {
    this.app = app;
    this.G = G;
    this.em = em; // the era map without the scenario (what the difference is taken against)
    this.meta = meta; // {code, title, desc, pub}
    this.tool = 'paint';
    this.brush = 3;
    this.sel = 0; // the selected state (player id), 0 = free land
    this.slots = new Set((S && S.slots) || []);
    this.rules = Object.assign({ peace: 60, res: 0, tree: 0, nn: 0 }, (S && S.rules) || {});
    this.undo = [];
    this.stroke = null;
    this.added = G.P.filter((p) => p && p.nation && p.nation.k > em.nations.length).length;
  }
  land(c) {
    const m = this.G.map;
    return c >= 0 && m.land[c] && !(m.block && m.block[c]);
  }
  /* paint a disk of the brush around cell c with the selected state */
  paint(c) {
    const G = this.G, W = G.map.W, r = this.brush - 1, x0 = c % W, y0 = (c / W) | 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r) continue;
        const x = x0 + dx, y = y0 + dy;
        if (x < 0 || y < 0 || x >= W || y >= G.map.H) continue;
        const q = y * W + x;
        if (!this.land(q) || G.owner[q] === this.sel) continue;
        if (this.stroke) this.stroke.push([q, G.owner[q]]);
        G.setOwner(q, this.sel);
      }
    this.dirty();
  }
  tap(c) {
    const G = this.G, ui = this.app.ui;
    if (!this.land(c)) return ui.toast('info', RA.t("That is not land in this region."));
    if (this.tool === 'pick') {
      this.sel = G.owner[c];
      this.tool = 'paint';
      return ui.editorPanel();
    }
    if (this.tool === 'new') {
      const K0 = this.em.nations.length, k = K0 + 1 + this.added;
      if (k > 255 || this.added >= RA.SCEN_MAX_ADD || G.P.length > 250) return ui.toast('bad', RA.t("No more new states are possible."));
      const color = RA.ED_COLORS[this.added % RA.ED_COLORS.length], name = RA.t("New state ") + (this.added + 1);
      const p = G.addPlayer({ name, type: 'nation', color, iso: 'S' + (this.added + 1) });
      p.nation = { k, c, x: c % G.map.W, y: (c / G.map.W) | 0, name, color, capital: '', iso: p.iso };
      p.capital = c;
      p.spawned = true;
      this.added++;
      this.sel = p.id;
      this.tool = 'paint';
      this.stroke = [];
      this.paint(c);
      this.endStroke();
      this.app.terr.updatePalette();
      ui.toast('good', RA.t("New state — give it a name and a colour, then paint its land."));
      return ui.editorPanel();
    }
    if (this.tool === 'paint') {
      this.stroke = [];
      this.paint(c);
      this.endStroke();
    }
  }
  endStroke() {
    if (this.stroke && this.stroke.length) this.undo.push(this.stroke);
    if (this.undo.length > 50) this.undo.shift();
    this.stroke = null;
  }
  undoLast() {
    const s = this.undo.pop();
    if (!s) return;
    for (let i = s.length - 1; i >= 0; i--) this.G.setOwner(s[i][0], s[i][1]);
    this.dirty();
  }
  dirty() {
    clearTimeout(this._dt);
    this._dt = setTimeout(() => this.keepDraft(), 1500);
  }
  scen() {
    const G = this.G, S = G.map.region ? G.map.region.id : this.meta.reg;
    return RA.scenDiff(G, this.em, { map: this.meta.map, reg: this.meta.reg || S, era: this.meta.era, slots: [...this.slots].map((id) => G.P[id] && G.P[id].nation && G.P[id].nation.k).filter(Boolean), rules: this.rules });
  }
  /* the draft stays in this browser (localStorage ra_scen_draft) until it is saved */
  keepDraft() {
    try {
      localStorage.setItem('ra_scen_draft', JSON.stringify({ meta: this.meta, data: this.scen(), at: Date.now() }));
    } catch (_) {}
  }
};

Object.assign(RA.App.prototype, {
  /* open the editor on a scenario (or a new one from the start screen's map, region and era) */
  editorOpen(S, meta) {
    const ui = this.ui, st = ui.settings;
    meta = Object.assign({ code: '', title: '', desc: '', pub: false }, meta || {});
    S = S || { map: st.map, reg: st.region, era: st.era };
    meta.map = S.map;
    meta.reg = S.reg;
    meta.era = S.era;
    if (!this.mapReady(S.map, S.era)) return this.withMap(S.map, S.era, () => this.editorOpen(S, meta));
    this.setMap(this.maps[S.map]);
    document.getElementById('startScreen').hidden = true;
    const em = RA.eraMap(this.map, S.era, 'granice');
    const gm = RA.scenGameMap(this.map, Object.assign({ k0: em.nations.length }, S));
    const G = RA.newGame(gm, { seed: 1, difficulty: 'srednje', cityStates: 0, era: S.era, start: 'granice', gm: 'klasik' });
    G.gid = '';
    this.setGame(G);
    this.attractMode = false;
    this.paused = true;
    ui.watching = true;
    ui.closeSheet();
    ui.spawnUI(false);
    ui.showPlayUI(false);
    this.terr.reset(G);
    this.terr.updatePalette();
    // the slots saved as polity keys → the states of this map
    const E = (ui.editor = new RA.Editor(this, G, em, S, meta));
    const keys = new Set((S.slots || []).map(Number));
    E.slots = new Set(G.P.filter((p) => p && p.nation && keys.has(p.nation.k)).map((p) => p.id));
    if (gm.region) {
      const bx = gm.region.box;
      this.lmap.setMaxBounds(L.latLngBounds([[bx[1], bx[0]], [bx[3], bx[2]]]).pad(0.7));
      this.fitBox(bx, 0);
    } else {
      this.lmap.setMaxBounds(this.defBounds);
      this.fitMap(0);
    }
    this.editorMouse(true);
    ui.editorPanel();
  },
  /* painting by dragging (the map moves only with the "Pomjeri kartu" tool) */
  editorMouse(on) {
    const lm = this.lmap;
    if (this._edH) {
      lm.off('mousedown', this._edH.down);
      lm.off('mousemove', this._edH.move);
      lm.off('mouseup', this._edH.up);
      this._edH = null;
    }
    lm.dragging.enable();
    if (!on) return;
    let down = false;
    const E = () => this.ui.editor;
    this._edH = {
      down: (e) => {
        if (!E() || E().tool !== 'paint' || (e.originalEvent && e.originalEvent.button !== 0)) return;
        down = true;
        E().stroke = [];
        E().paint(this.ui.cellFromLatLng(e.latlng));
      },
      move: (e) => {
        if (down && E() && E().stroke) E().paint(this.ui.cellFromLatLng(e.latlng));
      },
      up: () => {
        if (down && E()) E().endStroke();
        down = false;
      },
    };
    lm.on('mousedown', this._edH.down);
    lm.on('mousemove', this._edH.move);
    lm.on('mouseup', this._edH.up);
    this.editorDrag();
  },
  editorDrag() {
    const E = this.ui.editor;
    if (E && E.tool === 'paint') this.lmap.dragging.disable();
    else this.lmap.dragging.enable();
  },
  editorClose() {
    const E = this.ui.editor;
    if (E) E.keepDraft();
    this.ui.editor = null;
    this.editorMouse(false);
    const p = document.getElementById('edPanel');
    if (p) p.remove();
    this.showStart();
  },
  /* play a scenario (single player): its map, era, borders and rules */
  scenPlay(S, title, code) {
    const R = S.rules || {};
    if (code) RA.scenPlayed(this, code);
    this.newGame({ map: S.map, region: S.reg, era: S.era, start: 'granice', scen: S, scenTitle: title || RA.t("Scenario"), peace: R.peace != null ? R.peace : 60, res: !!R.res, tree: !!R.tree, noNuke: !!R.nn });
    this.ui.toast('info', RA.t("Scenario “{0}” — pick a state{1}.", RA.esc(title || RA.t("untitled")), S.slots && S.slots.length ? RA.t(" (only those the scenario offers)") : ''), { ms: 6000 });
  },
  scenOpen(code) {
    const A = this.ui.account;
    const get = A && A.ok ? A.api('GET', '/api/scen/get?code=' + code) : fetch('/api/scen/get?code=' + code).then((r) => r.json());
    get.then((j) => {
      if (!j || !j.scen) throw new Error((j && j.e && RA.t(String(j.e))) || RA.t("That scenario does not exist."));
      this.ui.scenSheet(j.scen);
    }).catch((e) => this.ui.toast('bad', RA.esc(e.message), { ms: 5000 }));
  },
});
RA.scenPlayed = (app, code) => {
  try {
    fetch('/api/scen/play', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }).catch(() => {});
  } catch (_) {}
};

Object.assign(RA.UI.prototype, {
  /* Community market: public scenarios (newest / best), mine, search; make a new one */
  marketSheet(tab) {
    const A = this.account, api = A && A.ok;
    tab = tab || this._mkTab || 'new';
    this._mkTab = tab;
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem('ra_scen_draft') || 'null');
    } catch (_) {}
    let h = '<div id="marketSheet"></div>' + this.head(RA.t("Community market"), RA.t("Players' scenarios: play others', make your own"));
    h += RA.t("<div class=\"btns\"><button class=\"btn primary\" id=\"mkNew\"><span class=\"t\">Create scenario</span><br><span class=\"d\">Map and age from the start screen — repaint borders, new states, player slots</span></button>{0}</div>", draft ? RA.t("<button class=\"btn\" id=\"mkDraft\"><span class=\"t\">Continue editing</span><br><span class=\"d\">{0} · {1}</span></button>", RA.esc(draft.meta.title || RA.t("Draft")), new Date(draft.at).toLocaleString(RA.LOCALE)) : '');
    if (!api) h += RA.t("<p class=\"note\">The market works on war.deovilab.com (published scenarios are on the server).</p>");
    else {
      h += RA.t("<div class=\"seg\" id=\"mkTabs\"><button data-v=\"new\" aria-pressed=\"{0}\">Newest</button><button data-v=\"top\" aria-pressed=\"{1}\">Best</button><button data-v=\"mine\" aria-pressed=\"{2}\">Mine</button></div>", tab === 'new', tab === 'top', tab === 'mine');
      h += RA.t("<div class=\"field\"><input id=\"mkQ\" placeholder=\"Search by title\" maxlength=\"40\" value=\"{0}\"></div><div class=\"list\" id=\"mkList\"><p class=\"note\">Loading…</p></div>", RA.esc(this._mkQ || ''));
    }
    this.openSheet(h, (s) => {
      s.querySelector('#mkNew').onclick = () => this.app.editorOpen();
      const d = s.querySelector('#mkDraft');
      if (d) d.onclick = () => this.app.editorOpen(draft.data, draft.meta);
      if (!api) return;
      s.querySelectorAll('#mkTabs button').forEach((b) => (b.onclick = () => (b.dataset.v === 'mine' ? this.needAccount(() => this.marketSheet('mine')) : this.marketSheet(b.dataset.v))));
      const q = s.querySelector('#mkQ');
      q.onchange = () => {
        this._mkQ = q.value.trim();
        this.marketList(s, tab);
      };
      this.marketList(s, tab);
    });
  },
  marketList(s, tab) {
    const A = this.account, box = s.querySelector('#mkList');
    const qs = tab === 'mine' ? 'mine=1' : 'sort=' + tab;
    A.api('GET', `/api/scen/list?${qs}&q=${encodeURIComponent(this._mkQ || '')}`).then((j) => {
      if (!box.isConnected) return;
      const where = (x) => {
        const reg = RA.REGIONS.find((r) => r.id === x.reg && r.map === x.map);
        return `${reg ? reg.name : RA.mapInfo(x.map).all} · ${RA.eraById(x.era).short}`;
      };
      box.innerHTML = j.rows.length ? j.rows.map((x) => `<div class="prow wide"><div class="pn"><div class="nm">${RA.esc(x.title)}${x.pub ? '' : RA.t(" · <i>draft</i>")}</div><div class="d">${RA.esc(where(x))} · ${RA.esc(x.author)} · ▶ ${x.plays} · ♥ ${x.likes}${x.desc ? '<br>' + RA.esc(x.desc) : ''}</div></div><div class="bb">${this.mini(RA.t("Play"), `data-mkplay="${x.code}"`, 'ok')}${tab === 'mine' ? this.mini(RA.t("Edit"), `data-mkedit="${x.code}"`) + this.mini(RA.t("Delete"), `data-mkdel="${x.code}"`, 'warn') : x.pub ? this.mini(x.liked ? '♥' : '♡', `data-mklike="${x.code}" data-on="${x.liked ? 0 : 1}"`) : ''}</div></div>`).join('') : `<p class="note">${tab === 'mine' ? RA.t("You have no scenarios yet — make the first one.") : RA.t("No published scenarios yet.")}</p>`;
      const get = (code) => A.api('GET', '/api/scen/get?code=' + code).then((r) => r.scen);
      box.querySelectorAll('[data-mkplay]').forEach((b) => (b.onclick = () => get(b.dataset.mkplay).then((sc) => {
        this.closeSheet();
        this.app.scenPlay(sc.data, sc.title, sc.pub ? sc.code : '');
      }, (e) => this.toast('bad', RA.esc(e.message)))));
      box.querySelectorAll('[data-mkedit]').forEach((b) => (b.onclick = () => get(b.dataset.mkedit).then((sc) => this.app.editorOpen(sc.data, { code: sc.code, title: sc.title, desc: sc.desc, pub: sc.pub }))));
      box.querySelectorAll('[data-mklike]').forEach((b) => (b.onclick = () => this.needAccount(() => A.api('POST', '/api/scen/like', { code: b.dataset.mklike, on: +b.dataset.on }).then(() => this.marketList(s, tab), (e) => this.toast('bad', RA.esc(e.message))))));
      box.querySelectorAll('[data-mkdel]').forEach((b) => (b.onclick = () => this.confirm(RA.t("Delete the scenario?"), RA.t("The scenario is also removed from the market."), RA.t("Delete"), () => A.api('POST', '/api/scen/delete', { code: b.dataset.mkdel }).then(() => this.marketSheet('mine')))));
    }, (e) => (box.innerHTML = `<p class="note">${RA.esc(e.message)}</p>`));
  },
  /* one scenario (from a link /scenario-<code>) */
  scenSheet(sc) {
    let h = this.head(RA.esc(sc.title), RA.t("Scenario · {0} · ▶ {1} · ♥ {2}", RA.esc(sc.author), sc.plays, sc.likes));
    if (sc.desc) h += `<p class="explain">${RA.esc(sc.desc)}</p>`;
    h += RA.t("<div class=\"btns\"><button class=\"btn primary\" id=\"scPlay\"><span class=\"t\">Play</span></button><button class=\"btn\" id=\"scCopy\"><span class=\"t\">Copy link</span></button></div>");
    this.openSheet(h, (s) => {
      s.querySelector('#scPlay').onclick = () => {
        this.closeSheet();
        this.app.scenPlay(sc.data, sc.title, sc.pub ? sc.code : '');
      };
      s.querySelector('#scCopy').onclick = () => {
        try {
          navigator.clipboard.writeText(location.origin + '/scenario-' + sc.code);
          this.toast('good', RA.t("Link copied."));
        } catch (_) {}
      };
    });
  },
  /* the editor's panel (not a modal sheet: the map stays usable) */
  editorPanel() {
    const E = this.editor, G = E && E.G;
    if (!E) return;
    let p = document.getElementById('edPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'edPanel';
      p.className = 'ed-panel';
      document.body.appendChild(p);
    }
    const states = G.P.filter((q) => q && q.nation && (q.alive || q.nation.k > E.em.nations.length)).sort((a, b) => a.name.localeCompare(b.name, RA.LOCALE));
    const S = G.P[E.sel];
    const tools = [['paint', RA.t("Brush")], ['pick', RA.t("Take a state")], ['new', RA.t("New state")], ['move', RA.t("Move the map")]];
    p.innerHTML = RA.t("<div class=\"ed-head\"><b>Scenario editor</b><button class=\"mini\" id=\"edMin\">{0}</button></div>\n      <div class=\"ed-body\"{1}>\n      <input id=\"edTitle\" maxlength=\"60\" placeholder=\"Scenario title\" value=\"{2}\">\n      <textarea id=\"edDesc\" maxlength=\"400\" rows=\"2\" placeholder=\"Description (what the goal is, who against whom)\">{3}</textarea>\n      <div class=\"seg wrap\" id=\"edTool\">{4}</div>\n      <div class=\"seg\" id=\"edBrush\">{5}</div>\n      <label class=\"lab\">Painting</label>\n      <select id=\"edState\"><option value=\"0\"{6}>— Free land —</option>{7}</select>\n      {8}\n      <p class=\"note\">{9}</p>\n      <div class=\"ed-row\" id=\"edRules\"><label>Peace <input type=\"number\" id=\"edPeace\" min=\"0\" max=\"600\" step=\"10\" value=\"{10}\"> s</label>\n        <label><input type=\"checkbox\" id=\"edRes\"{11}> Resources</label><label><input type=\"checkbox\" id=\"edTree\"{12}> Tree</label><label><input type=\"checkbox\" id=\"edNn\"{13}> No nukes</label></div>\n      <div class=\"ed-btns\"><button class=\"mini\" id=\"edUndo\"{14}>Undo</button><button class=\"mini\" id=\"edTry\">Try it</button><button class=\"mini ok\" id=\"edSave\">Save</button><button class=\"mini ok\" id=\"edPub\">{15}</button><button class=\"mini warn\" id=\"edExit\">Exit</button></div>\n      </div>", this._edMin ? '▸' : '▾', this._edMin ? ' hidden' : '', RA.esc(E.meta.title), RA.esc(E.meta.desc), tools.map(([v, t]) => `<button data-v="${v}" aria-pressed="${E.tool === v}">${t}</button>`).join(''), [1, 3, 6].map((v) => RA.t("<button data-v=\"{0}\" aria-pressed=\"{1}\">Brush {2}</button>", v, E.brush === v, v)).join(''), E.sel ? '' : ' selected', states.map((q) => `<option value="${q.id}"${q.id === E.sel ? ' selected' : ''}>${RA.esc(q.name)}${E.slots.has(q.id) ? ' ★' : ''}</option>`).join(''), S ? RA.t("<div class=\"ed-row\"><input id=\"edName\" maxlength=\"30\" value=\"{0}\"><input type=\"color\" id=\"edColor\" value=\"{1}\"></div>\n      <label class=\"ed-check\"><input type=\"checkbox\" id=\"edSlot\"{2}> A player can take this state (★)</label>", RA.esc(S.name), S.hex, E.slots.has(S.id) ? ' checked' : '') : RA.t("<p class=\"note\">Free land: nobody holds it at the start.</p>"), E.slots.size ? RA.t("The player picks among {0} marked (★).", E.slots.size) : RA.t("No ★: the player can take any state."), E.rules.peace, E.rules.res ? ' checked' : '', E.rules.tree ? ' checked' : '', E.rules.nn ? ' checked' : '', E.undo.length ? '' : ' disabled', E.meta.pub ? RA.t("Published ✓") : RA.t("Publish"));
    const $ = (id) => p.querySelector('#' + id);
    $('edMin').onclick = () => {
      this._edMin = !this._edMin;
      this.editorPanel();
    };
    if (this._edMin) return;
    $('edTitle').oninput = () => (E.meta.title = $('edTitle').value);
    $('edDesc').oninput = () => (E.meta.desc = $('edDesc').value);
    p.querySelectorAll('#edTool button').forEach((b) => (b.onclick = () => {
      E.tool = b.dataset.v;
      this.app.editorDrag();
      if (E.tool === 'new') this.toast('info', RA.t("Tap the map where the new state's capital is."));
      if (E.tool === 'pick') this.toast('info', RA.t("Tap a state on the map."));
      this.editorPanel();
    }));
    p.querySelectorAll('#edBrush button').forEach((b) => (b.onclick = () => {
      E.brush = +b.dataset.v;
      this.editorPanel();
    }));
    $('edState').onchange = () => {
      E.sel = +$('edState').value;
      if (E.tool !== 'paint') (E.tool = 'paint'), this.app.editorDrag();
      this.editorPanel();
    };
    if (S) {
      $('edName').onchange = () => {
        S.name = $('edName').value.trim().slice(0, 30) || S.name;
        S.changed = true;
        E.dirty();
        this.editorPanel();
      };
      $('edColor').oninput = () => {
        S.hex = $('edColor').value;
        S.rgb = RA.hexToRgb(S.hex);
        this.app.terr.updatePalette();
        E.dirty();
      };
      $('edSlot').onchange = () => {
        if ($('edSlot').checked) E.slots.add(S.id);
        else E.slots.delete(S.id);
        E.dirty();
        this.editorPanel();
      };
    }
    const rule = () => {
      E.rules = { peace: Math.max(0, Math.min(600, +$('edPeace').value | 0)), res: $('edRes').checked ? 1 : 0, tree: $('edTree').checked ? 1 : 0, nn: $('edNn').checked ? 1 : 0 };
      E.dirty();
    };
    ['edPeace', 'edRes', 'edTree', 'edNn'].forEach((id) => ($(id).onchange = rule));
    $('edUndo').onclick = () => {
      E.undoLast();
      this.editorPanel();
    };
    $('edTry').onclick = () => {
      const sc = E.scen();
      E.keepDraft();
      this.editor = null;
      this.app.editorMouse(false);
      p.remove();
      this.app.scenPlay(sc, E.meta.title || RA.t("Draft"));
    };
    const save = (pub) => this.needAccount(() => {
      if ((E.meta.title || '').trim().length < 3) return this.toast('bad', RA.t("Give the scenario a title (at least 3 letters)."));
      this.account.api('POST', '/api/scen/save', { code: E.meta.code || undefined, title: E.meta.title, desc: E.meta.desc, pub: pub || E.meta.pub, data: E.scen() }).then((j) => {
        E.meta.code = j.code;
        if (pub) E.meta.pub = true;
        try {
          localStorage.removeItem('ra_scen_draft');
        } catch (_) {}
        this.toast('good', pub ? RA.t("Published on the market. Link: <b>{0}</b>", RA.esc(location.origin + '/scenario-' + j.code)) : RA.t("Saved to your account."), { ms: 7000 });
        this.editorPanel();
      }, (e) => this.toast('bad', RA.esc(e.message), { ms: 6000 }));
    });
    $('edSave').onclick = () => save(false);
    $('edPub').onclick = () => save(true);
    $('edExit').onclick = () => this.app.editorClose();
  },
});

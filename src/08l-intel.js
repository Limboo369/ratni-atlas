'use strict';
/* The intelligence agency sheet (sim: 03d-intel.js): my agents (recruit, train, what each is doing) and, opened from a
   state's sheet, the missions against that state with their odds. */
Object.assign(RA.UI.prototype, {
  intelSecs(until) {
    const G = this.G, d = Math.max(0, until - G.clock());
    return G.sub ? d : d / 10;
  },
  intelSheet(tid, keep) {
    const G = this.G, me = G && G.me, C = RA.CFG;
    if (!me || G.state !== 'play') return;
    const T = tid ? G.P[tid] : null;
    let h = this.head(RA.t("Intelligence agency"), T ? RA.t("Missions against {0}", RA.esc(T.name)) : RA.t("Agents, training and missions"), T && T.hex);
    if (!G.opts.tree) return this.openSheet(h + RA.t("<p class=\"note\">The intelligence agency comes with the tech tree — it is off in this game.</p>"));
    if (!me.n.intel) {
      h += RA.t("<p class=\"explain\">Build an <b>intelligence agency</b> (Build, one per state). Then recruit agents, train them and send them to scout, sabotage or steal research.</p>");
      return this.openSheet(h);
    }
    const I = G.intelOf(me), now = G.clock();
    const state = (x) => (x.busy <= now ? RA.t("ready") : x.job === 'rec' ? RA.t("recruiting · {0}", RA.fmtTime(this.intelSecs(x.busy))) : x.job === 'train' ? RA.t("training to level {0} · {1}", x.lv + 1, RA.fmtTime(this.intelSecs(x.busy))) : x.job === 'spy' ? RA.t("on a mission ({0}) · {1}", RA.esc(RA.INTEL_OPS[x.mission.kind].name + ' — ' + G.P[x.mission.t].name), RA.fmtTime(this.intelSecs(x.busy))) : RA.t("resting · {0}", RA.fmtTime(this.intelSecs(x.busy))));
    h += RA.t("<div class=\"sec-t\">Agents ({0}/{1})</div><div class=\"list\">", I.agents.length, G.intelMax(me)).replace('<div class="list">', '<div class="research-grid">');
    for (const x of I.agents) {
      const cost = Math.round(C.INTEL_TRAIN * RA.dpow(2, x.lv) * (me.bCost || 1));
      const tr = x.lv < 3 ? this.mini(RA.t("Train · {0}", RA.fmt(cost)), `data-itrain="${x.id}"`, 'ok', x.busy > now || me.gold < cost) : RA.t("<span class=\"research-max\">Fully trained</span>");
      h += `<article class="research-card"><div class="research-heading"><i>${RA.icon('user')}</i><span>${RA.t("Agent {0}", x.id)}<small>${RA.t("Level {0} / 3", x.lv)}</small></span></div><p>${state(x)}</p>${tr}</article>`;
    }
    const rc = Math.round(C.INTEL_REC * (me.bCost || 1));
    h += '</div><div class="btns">' + this.btn({ icon: 'user', attrs: 'data-irec', dis: I.agents.length >= G.intelMax(me) || me.gold < rc, t: RA.t("Recruit an agent"), d: RA.t("Ready in {0} s", C.INTEL_REC_SECS), r: RA.fmt(rc) }) + '</div>';
    if (T) {
      const ready = I.agents.filter((x) => x.busy <= now).sort((a, b) => b.lv - a.lv)[0];
      h += RA.t("<div class=\"sec-t\">Missions against {0}</div>", RA.esc(T.name));
      if (!ready) h += RA.t("<p class=\"note\">No agent is ready now.</p>");
      else {
        const pc = (op) => Math.round(G.intelOdds(me, T, ready.lv, op) * 100) + '%';
        h += RA.t("<p class=\"explain\">Agent {0} (level {1}) goes. The higher the level, the better the odds; their own agency and missions against them in the last 10 min make it harder.</p>", ready.id, ready.lv) + '<div class="btns">';
        h += this.btn({ icon: 'eye', attrs: `data-ispy="scout"`, t: RA.INTEL_OPS.scout.name, d: RA.INTEL_OPS.scout.desc, r: pc('scout') });
        const canSteal = RA.RSCH_ORDER.some((k) => G.rsLv(T, k) > G.rsLv(me, k));
        h += this.btn({ icon: 'factory', attrs: `data-ispy="steal"`, dis: !canSteal && G.intelSeen(me, T), t: RA.INTEL_OPS.steal.name, d: RA.INTEL_OPS.steal.desc, r: pc('steal') });
        h += '</div>' + RA.t("<div class=\"sec-t\">Sabotage · {0}</div><p class=\"note\">{1}</p><div class=\"btns\">", pc('sab'), RA.INTEL_OPS.sab.desc);
        for (const k of RA.INTEL_SAB) {
          if (!T.n[k] || RA.STRUCT[k].na) continue;
          h += this.btn({ model: RA.STRUCT[k].icon || k, cls: 'model-btn', attrs: `data-ispy="sab:${k}"`, t: `${RA.esc(RA.STRUCT[k].name)} <span class="d">(${T.n[k]})</span>`, d: '' });
        }
        h += '</div>';
      }
      if (G.intelSeen(me, T)) {
        const rs = RA.RSCH_ORDER.filter((k) => G.rsLv(T, k)).map((k) => RA.RSCH[k].name + ' ' + G.rsLv(T, k)).join(', ') || RA.t("none");
        const bs = RA.STRUCT_ORDER.filter((k) => T.n[k]).map((k) => RA.STRUCT[k].name + ' ' + T.n[k]).join(', ');
        h += RA.t("<div class=\"sec-t\">Latest report</div><p class=\"note\">Army {0} · gold {1} · agents {2}<br>Buildings: {3}<br>Research: {4}</p>", RA.fmt(T.troops), RA.fmt(T.gold), T.intel ? T.intel.agents.length : 0, RA.esc(bs), RA.esc(rs));
      }
    } else {
      // send an agent: pick a state (neighbours first); training raises an agent's level and its odds
      const nb = me.nbCache || new Map();
      const L = G.P.filter((o) => o && o.alive && o.spawned && o !== me && o.type !== 'bot').sort((a, b) => (nb.has(b.id) ? 1 : 0) - (nb.has(a.id) ? 1 : 0) || b.tiles - a.tiles).slice(0, 24);
      h += RA.t("<div class=\"sec-t\">Send an agent</div><p class=\"explain\">Pick a state, then the mission: scout (see its army, gold, buildings and research, and lift the fog over it), sabotage a building or steal research. <b>Train</b> an agent above to raise its level: every level +17% odds.</p>") + '<div class="list">';
      for (const o of L) h += `<div class="prow wide"><span class="sw" style="background:${o.hex}"></span><div class="pn"><div class="nm">${RA.esc(o.name)}</div><div class="d">${nb.has(o.id) ? RA.t("neighbour · ") : ''}${RA.t("army {0}", RA.fmt(o.troops))}${G.intelSeen(me, o) ? RA.t(" · scouted") : ''}</div></div><div class="bb">${this.mini(RA.t("Missions"), `data-ito="${o.id}"`, 'ok')}</div></div>`;
      h += '</div>' + RA.t("<p class=\"note\">At most {0} agents (+1 per agency level); after a mission an agent rests 1 min; a caught agent is lost and the state trusts you less.</p>", C.INTEL_MAX);
    }
    this.openSheet(h, (s) => {
      const again = () => setTimeout(() => this.intelSheet(tid, true), G.online || G.long ? 1200 : 60);
      const q = (sel, fn) => s.querySelectorAll(sel).forEach((b) => (b.onclick = () => (fn(b), again())));
      s.querySelectorAll('[data-ito]').forEach((b) => (b.onclick = () => this.intelSheet(+b.dataset.ito)));
      q('[data-irec]', () => this.act('intel', ['rec']));
      q('[data-itrain]', (b) => this.act('intel', ['train', +b.dataset.itrain]));
      q('[data-ispy]', (b) => {
        const ready = G.intelOf(me).agents.filter((x) => x.busy <= G.clock()).sort((a, c) => c.lv - a.lv)[0];
        const [kind, what] = b.dataset.ispy.split(':');
        if (ready) this.act('intel', ['spy', ready.id, tid, kind, what || '']);
      });
    }, keep);
  },
});

'use strict';
/* Intelligence agency (Darko, 27. 9.; with the tech tree, opts.tree — Focus has it): one building per state, up to
   INTEL_MAX agents. An agent is recruited, can be trained (levels 0–3: better odds, costs gold and time) and is sent on
   a mission against a state: scout (its army, gold and research), sabotage (one kind of building stops working for a
   while) or steal research (one level of a weapon research it has and you don't). A mission takes time; then it
   succeeds or the agent is caught (lost, and the state trusts you less).
   Balance, so a big agency is strong but never decides a war alone:
   - at most INTEL_MAX agents, each resting INTEL_REST after a mission;
   - every mission against a state raises its alert for 10 min (each one −8% for the next, up to −24%);
   - a state with its own agency catches more agents (counter-intelligence, −20%);
   - a sabotaged building is immune for INTEL_IMMUNE after it works again.
   Command 'intel' [op, …]: ['rec'], ['train', agentId], ['spy', agentId, targetId, 'scout' | 'sab' | 'steal', buildingType]. */
RA.STRUCT.intel = {
  name: RA.t("Intelligence agency"), short: RA.t("Intelligence"), icon: 'eye', cost: () => 600000, time: 60, tree: true,
  desc: RA.t("Recruit and train agents: scout a state, sabotage its buildings or steal its research. One per state."),
};
RA.STRUCT_ORDER.push('intel');
Object.assign(RA.CFG, {
  INTEL_MAX: 3, // agents
  INTEL_REC: 120000, // gold for a new agent
  INTEL_REC_SECS: 30,
  INTEL_TRAIN: 100000, // × 2^level
  INTEL_TRAIN_SECS: 60, // × (level + 1)
  INTEL_MISSION_SECS: 30,
  INTEL_REST: 60, // seconds after a mission
  INTEL_SAB_SECS: 180, // a sabotaged building is off this long…
  INTEL_IMMUNE: 300, // …and then immune this long
  INTEL_SCOUT_SECS: 600, // a scout report stays fresh
  INTEL_ALERT_SECS: 600,
});
RA.INTEL_OPS = {
  scout: { name: RA.t("Scout"), desc: RA.t("Their army, gold, buildings and research (for 10 min)."), bonus: 0.2 },
  sab: { name: RA.t("Sabotage"), desc: RA.t("One of their buildings of that kind stops working for 3 min."), bonus: 0 },
  steal: { name: RA.t("Steal research"), desc: RA.t("One level of a weapon research they have and you don't."), bonus: -0.1 },
};
RA.INTEL_SAB = ['factory', 'silo', 'dome', 'sam', 'airport', 'port', 'barracks', 'fort', 'intel'];

(function (P) {
  const secs = (G, n) => (G.sub ? n : n * 10); // the game's clock: seconds in Focus, ticks otherwise
  P.intelOf = function (p) {
    return p.intel || (p.intel = { agents: [], next: 1, alert: [], seen: {} });
  };
  /* agents p may have: INTEL_MAX, +1 per level of the agency (03f-upgrade.js) */
  P.intelMax = function (p) {
    return RA.CFG.INTEL_MAX + this.lvx(p, 'intel');
  };
  /* the odds of an agent of p against t (0.05–0.95) */
  P.intelOdds = function (p, t, lv, op) {
    const now = this.clock(), I = t.intel;
    const alert = I ? I.alert.filter((x) => x > now).length : 0;
    let c = 0.4 + 0.17 * lv + ((RA.INTEL_OPS[op] && RA.INTEL_OPS[op].bonus) || 0) - 0.08 * Math.min(3, alert) - (t.n.intel ? 0.2 : 0);
    return Math.max(0.05, Math.min(0.95, c));
  };
  P.intelCmd = function (pid, a) {
    const p = this.P[pid], C = RA.CFG, now = this.clock();
    if (!this.opts.tree) return RA.t("The intelligence agency comes with the tech tree — it is off in this game.");
    if (!p || !p.alive) return RA.t("You are not in the game.");
    if (!p.n.intel) return RA.t("First build an intelligence agency.");
    const I = this.intelOf(p), op = a[0];
    const ag = (id) => I.agents.find((x) => x.id === (id | 0));
    if (op === 'rec') {
      const max = this.intelMax(p);
      if (I.agents.length >= max) return RA.t("You have the most agents already ({0}).", max);
      const cost = Math.round(C.INTEL_REC * (p.bCost || 1));
      if (p.gold < cost) return RA.t("A new agent costs {0} gold.", RA.fmt(cost));
      p.gold -= cost;
      const x = { id: I.next++, lv: 0, busy: now + secs(this, C.INTEL_REC_SECS), job: 'rec' };
      I.agents.push(x);
      return { rec: x.id };
    }
    if (op === 'train') {
      const x = ag(a[1]);
      if (!x) return RA.t("No such agent.");
      if (x.busy > now) return RA.t("The agent is busy.");
      if (x.lv >= 3) return RA.t("The agent is fully trained.");
      const cost = Math.round(C.INTEL_TRAIN * RA.dpow(2, x.lv) * (p.bCost || 1));
      if (p.gold < cost) return RA.t("Training costs {0} gold.", RA.fmt(cost));
      p.gold -= cost;
      x.job = 'train';
      x.busy = now + secs(this, C.INTEL_TRAIN_SECS * (x.lv + 1));
      return { train: x.id, lv: x.lv + 1 };
    }
    if (op === 'spy') {
      const x = ag(a[1]), t = this.P[a[2] | 0], kind = a[3];
      if (!x) return RA.t("No such agent.");
      if (x.busy > now) return RA.t("The agent is busy.");
      if (!t || !t.alive || t === p || t.type === 'bot') return RA.t("Pick a state.");
      if (!Object.prototype.hasOwnProperty.call(RA.INTEL_OPS, kind)) return RA.t("Unknown mission.");
      if (this.isFriendly(p, t)) return RA.t("Not against your allies.");
      if (this.shieldErr) {
        const sh = this.shieldErr(p, t);
        if (sh) return sh;
      }
      if (kind === 'sab' && !(RA.INTEL_SAB.includes(a[4]) && t.n[a[4]])) return RA.t("They have no such building.");
      if (kind === 'steal' && !RA.RSCH_ORDER.some((k) => this.rsLv(t, k) > this.rsLv(p, k))) return RA.t("They have no research you don't.");
      x.job = 'spy';
      x.mission = { t: t.id, kind, what: kind === 'sab' ? a[4] : '' };
      x.busy = now + secs(this, C.INTEL_MISSION_SECS);
      return { spy: x.id, t: t.id, kind };
    }
    return RA.t("Unknown order.");
  };
  /* missions that end now (every second in Focus, every tick otherwise) */
  P._stepIntel = function () {
    const now = this.clock(), C = RA.CFG;
    for (const p of this.P) {
      if (!p || !p.intel) continue;
      const I = p.intel;
      if (!p.alive || !p.n.intel) {
        if (I.agents.length && !p.n.intel && p.alive) {
          I.agents = []; // the agency is gone (captured, bombed): so are the agents
          this.tell(p, 'bad', RA.t("Your intelligence agency is gone — and its agents with it."), p.id);
        }
        continue;
      }
      for (const x of I.agents.slice()) {
        if (!x.job || x.busy > now) continue;
        const job = x.job;
        x.job = '';
        if (job === 'rec') this.tell(p, 'good', RA.t("A new agent is ready."), p.id);
        else if (job === 'train') {
          x.lv++;
          this.tell(p, 'good', RA.t("Agent training done: level {0}.", x.lv), p.id);
        } else if (job === 'spy') this._intelEnd(p, x);
      }
    }
  };
  P._intelEnd = function (p, x) {
    const m = x.mission, t = this.P[m.t], C = RA.CFG, now = this.clock();
    x.mission = null;
    x.busy = now + secs(this, C.INTEL_REST);
    x.job = 'rest';
    if (!t || !t.alive) return this.tell(p, 'info', RA.t("The mission ended: the state is gone."), p.id);
    const odds = this.intelOdds(p, t, x.lv, m.kind), ok = this.rng() < odds;
    const TI = this.intelOf(t);
    TI.alert.push(now + secs(this, C.INTEL_ALERT_SECS));
    TI.alert = TI.alert.filter((v) => v > now);
    if (!ok) {
      p.intel.agents = p.intel.agents.filter((y) => y !== x);
      this.relTo(t, p.id, Math.max(-100, t.rel[p.id] - 25), 'spy');
      this.tell(p, 'bad', RA.t("Your agent was caught in {0}.", t.name), t.id, t.capital);
      this.tell(t, 'good', RA.t("Counter-intelligence caught an agent of {0}.", p.name), p.id);
      return;
    }
    if (m.kind === 'scout') {
      p.intel.seen[t.id] = now + secs(this, C.INTEL_SCOUT_SECS);
      const rs = RA.RSCH_ORDER.filter((k) => this.rsLv(t, k)).map((k) => RA.RSCH[k].name + ' ' + this.rsLv(t, k)).join(', ') || RA.t("none");
      this.tell(p, 'good', RA.t("Intel on {0}: army {1}, gold {2}, research: {3}.", t.name, RA.fmt(t.troops), RA.fmt(t.gold), rs), t.id, t.capital);
    } else if (m.kind === 'sab') {
      // in world ticks (buildings work on the world clock): 3 min in a Blitz game; in Focus 60 world steps
      // (5 / 15 / 35 min in a game of 1 / 3 / 7 days), immune 100 steps after
      const tk = this.tick, dur = this.sub ? 60 : C.INTEL_SAB_SECS * 10, imm = this.sub ? 100 : C.INTEL_IMMUNE * 10;
      const cand = this.structs.filter((s) => !s.dead && s.ready && s.owner === t.id && s.type === m.what && s.empUntil <= tk && !((s.sabImmune || 0) > tk));
      if (!cand.length) return this.tell(p, 'info', RA.t("Your agent found no {0} to sabotage in {1} (all guarded).", RA.STRUCT[m.what].name, t.name), t.id);
      const s = cand[Math.floor(this.rng() * cand.length)];
      s.empUntil = tk + dur;
      s.sabImmune = tk + dur + imm;
      this.tell(p, 'good', RA.t("Sabotage in {0}: their {1} is out of action.", t.name, RA.STRUCT[s.type].name), t.id, s.c);
      this.tell(t, 'bad', RA.t("Sabotage! Your {0} is out of action for a while.", RA.STRUCT[s.type].name), 0, s.c);
    } else if (m.kind === 'steal') {
      const ks = RA.RSCH_ORDER.filter((k) => this.rsLv(t, k) > this.rsLv(p, k));
      if (!ks.length) return this.tell(p, 'info', RA.t("Your agent found nothing new in {0}.", t.name), t.id);
      const k = ks[Math.floor(this.rng() * ks.length)];
      (p.rs || (p.rs = {}))[k] = this.rsLv(p, k) + 1;
      this.tell(p, 'good', RA.t("Stolen from {0}: {1} {2}.", t.name, RA.RSCH[k].name, p.rs[k]), t.id);
      this.tell(t, 'bad', RA.t("Someone stole your research ({0}).", RA.RSCH[k].name), 0);
    }
  };
  /* is a scout report on t fresh? */
  P.intelSeen = function (p, t) {
    return !!(p && p.intel && t && p.intel.seen[t.id] > this.clock());
  };
})(RA.Game.prototype);

/* the computer: builds an agency now and then (rich, with the tech tree), keeps agents, and at war sabotages the
   enemy's silos, domes and air defence */
RA.AI.maybeIntel = function (G, p) {
  if (!G.opts.tree || G.rng() > 0.02) return;
  if (!p.n.intel) {
    if (!p.built.intel && p.gold > 3e6 && p.tiles > 400) {
      const c = p.capital >= 0 && G.owner[p.capital] === p.id ? G._bfs(p.capital, (n) => G.owner[n] === p.id, (n) => typeof G.canBuild(p, 'intel', n) === 'number', 300) : -1;
      if (c >= 0) G.build(p.id, 'intel', c);
    }
    return;
  }
  const I = G.intelOf(p), now = G.clock();
  if (I.agents.length < 2 && p.gold > 1e6) return void G.intelCmd(p.id, ['rec']);
  const x = I.agents.find((a) => a.busy <= now);
  if (!x) return;
  if (x.lv < 2 && p.gold > 2e6) return void G.intelCmd(p.id, ['train', x.id]);
  const foe = G.P.find((q) => q && q.alive && q !== p && q.type !== 'bot' && !G.isFriendly(p, q) && G.attacks.some((a) => !a.done && ((a.a === p.id && a.t === q.id) || (a.a === q.id && a.t === p.id))));
  if (!foe) return;
  const what = ['silo', 'dome', 'sam', 'airport', 'factory'].find((k) => foe.n[k]);
  if (what) G.intelCmd(p.id, ['spy', x.id, foe.id, 'sab', what]);
};

'use strict';
/* A Focus (long) game from its record — shared by the page (09c-long.js) and the server, which runs the same
   simulation (deploy/game/simhost.js) so it knows the game's state without trusting any player. */

/* the game at tick 0: settings + seed (the map is the era/region map of `base`) */
RA.longGame = function (base, rec) {
  const s = rec.set, lg = [1, 2, 5].includes(s.lg) ? s.lg : 0;
  const start = lg ? 'slobodno' : 'granice';
  const gm = RA.regionMap(RA.eraMap(base, s.era, start), s.reg);
  const G = RA.newGame(gm, { seed: rec.seed, difficulty: s.dif, cityStates: lg ? 0 : s.cs, peace: s.peace, era: s.era, start, gm: s.gm, res: s.res === 1, tree: s.tree === 1, noNuke: s.nn === 1, teams: lg ? '0' : s.teams || '0', allyWin: s.aw === 1, fast: s.fast === 1, days: s.days || 1, league: lg });
  RA.startGame(G);
  if (lg) RA.leagueSetup(G, rec.slots);
  G.online = true;
  G.long = true;
  G.slotPid = [];
  G.gid = 'l' + rec.code;
  if (lg) G.slotPid = G.humans.map((p) => p.id);
  return G;
};

/* Conquest League (plan phase 16): only the matched players, each from a small field at a real capital, teammates
   side by side and the two teams facing each other; every other state leaves the map. The seats (rec.slots: name,
   team) are fixed when the match is made; until a player connects the computer plays their state. */
RA.LG_COLORS = [['#2f7bff', '#3ec7c2', '#6ee05a', '#8fb8ff', '#1fa37a'], ['#ff4f4f', '#ff9f1c', '#ff4fc3', '#ffd23f', '#b061ff']];
RA.leagueSetup = function (G, slots) {
  const n = slots.length, W = G.map.W;
  const nats = G.P.filter((p) => p && p.type === 'nation' && p.alive && p.spawned && p.nation);
  const xy = (p) => [p.nation.c % W, (p.nation.c / W) | 0];
  const d = (a, b) => {
    const [ax, ay] = xy(a), [bx, by] = xy(b);
    return RA.dist(ax - bx, ay - by);
  };
  // a cluster of capitals around a random one, at least SP cells apart (less when the map is crowded)
  const a0 = nats[Math.floor(G.rng() * nats.length)];
  const byD = nats.slice().sort((a, b) => d(a0, a) - d(a0, b) || a.id - b.id);
  let pick = [];
  for (const SP of [16, 12, 8, 4, 0]) {
    pick = [];
    for (const q of byD) if (pick.length < n && pick.every((r) => d(r, q) >= SP)) pick.push(q);
    if (pick.length >= n) break;
  }
  // the two halves along the cluster's longer side: one team each
  const xs = pick.map((p) => xy(p)[0]), ys = pick.map((p) => xy(p)[1]);
  const k = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 0 : 1;
  pick.sort((a, b) => xy(a)[k] - xy(b)[k] || a.id - b.id);
  const half = [pick.slice(0, Math.ceil(pick.length / 2)), pick.slice(Math.ceil(pick.length / 2))];
  const used = [0, 0];
  G.humans = [];
  slots.forEach((sl, i) => {
    const t = sl.team === 2 ? 2 : 1;
    const nat = half[t - 1][used[t - 1]++] || pick.find((q) => q.alive);
    const p = RA.addHuman(G, typeof sl.name === 'string' ? sl.name.slice(0, 18) : 'Igrač', RA.LG_COLORS[t - 1][(used[t - 1] - 1) % 5]);
    p.slot = i;
    p.team = t;
    if (nat) RA.takeOverNation(G, p, nat);
    RA.AI.init(G, p); // the computer plays it until the player connects ('back')
  });
  for (const p of G.P) if (p && !p.human && (p.alive || p.spawned)) {
    G.unspawn(p);
    p.alive = false;
    p.spawned = false;
  }
  for (const t of [1, 2]) RA.makeTeam(G, G.humans.filter((p) => p.team === t), t);
};

/* a player takes over a computer state (deterministic: every device does the same at the same tick) */
RA.longJoin = function (G, slot, id, name, team) {
  const p = Number.isInteger(id) ? G.P[id] : null;
  const had = G.P[G.slotPid[slot]];
  if (!p || !p.alive || p.human || p.type !== 'nation' || (had && had.alive)) return null;
  p.human = true;
  p.ai = null;
  p.slot = slot;
  p.nick = typeof name === 'string' && name ? name.slice(0, 18) : 'Igrač';
  G.slotPid[slot] = p.id;
  if (!G.humans.includes(p)) G.humans.push(p);
  // a late player in a Focus game (plan 21): up to ~3 h safe from other players (until it attacks one), and gold and an
  // army to catch up with a game that has been running
  if (!G.opts.fast && G.tick > 600) {
    p.shieldUntil = G.tick + Math.round(2160 / (G.opts.days || 1));
    p.gold += Math.min(2e6, G.tick * 40);
    const ns = G.P.filter((q) => q && q.alive && q.type === 'nation' && q !== p);
    const avg = ns.reduce((a, q) => a + q.troops, 0) / Math.max(1, ns.length);
    p.troops = Math.max(p.troops, Math.min(p.maxT || Infinity, avg * 0.8));
    G.tell(p, 'good', `Kasni ulazak: zaštita od napada igrača ${RA.dur(p.shieldUntil - G.tick)} (dok ne napadneš igrača) i pomoć od ${RA.fmt(Math.min(2e6, G.tick * 40))} zlata.`, p.id);
  }
  // teams (Skirmish): humans vs states = one team of all players; 2 / 3 teams = the team the player chose
  const T = G.opts.teams;
  if (T && T !== '0') {
    const n = T === 'hvs' ? 1 : +T;
    p.team = T === 'hvs' ? 1 : Number.isInteger(team) && team >= 1 && team <= n ? team : 1;
    RA.makeTeam(G, G.humans.filter((h) => h.alive && h.team === p.team), p.team);
  }
  return p;
};

/* one entry of the record [tick, slot, kind, args]: {pid, joined, r} (joined: the state taken over) */
RA.longApply = function (G, e) {
  const [, slot, kind, args] = e;
  if (kind === 'join') return { pid: 0, joined: RA.longJoin(G, slot, args[0], args[1], args[2]) };
  const pid = G.slotPid[slot];
  if (!pid) return { pid: 0 };
  return { pid, r: G.exec(pid, kind, Array.isArray(args) ? args : []) };
};

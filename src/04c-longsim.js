'use strict';
/* A Focus (long) game from its record — shared by the page (09c-long.js) and the server, which runs the same
   simulation (deploy/game/simhost.js) so it knows the game's state without trusting any player. */

/* the game at tick 0: settings + seed (the map is the era/region map of `base`) */
RA.longGame = function (base, rec) {
  const s = rec.set;
  const gm = RA.regionMap(RA.eraMap(base, s.era, 'granice'), s.reg);
  const G = RA.newGame(gm, { seed: rec.seed, difficulty: s.dif, cityStates: s.cs, peace: s.peace, era: s.era, start: 'granice', gm: s.gm, res: s.res === 1, tree: s.tree === 1, noNuke: s.nn === 1, teams: s.teams || '0', allyWin: s.aw === 1, fast: s.fast === 1, days: s.days || 1 });
  RA.startGame(G);
  G.online = true;
  G.long = true;
  G.slotPid = [];
  G.gid = 'l' + rec.code;
  return G;
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

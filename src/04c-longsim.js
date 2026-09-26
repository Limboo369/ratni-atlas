'use strict';
/* A Focus (long) game from its record — shared by the page (09c-long.js) and the server, which runs the same
   simulation (deploy/game/simhost.js) so it knows the game's state without trusting any player. */

/* the game at tick 0: settings + seed (the map is the era/region map of `base`) */
RA.longGame = function (base, rec) {
  const s = rec.set;
  const gm = RA.regionMap(RA.eraMap(base, s.era, 'granice'), s.reg);
  const G = RA.newGame(gm, { seed: rec.seed, difficulty: s.dif, cityStates: s.cs, peace: s.peace, era: s.era, start: 'granice', gm: s.gm, res: s.res === 1, tree: s.tree === 1, noNuke: s.nn === 1 });
  RA.startGame(G);
  G.online = true;
  G.long = true;
  G.slotPid = [];
  G.gid = 'l' + rec.code;
  return G;
};

/* a player takes over a computer state (deterministic: every device does the same at the same tick) */
RA.longJoin = function (G, slot, id, name) {
  const p = Number.isInteger(id) ? G.P[id] : null;
  const had = G.P[G.slotPid[slot]];
  if (!p || !p.alive || p.human || p.type !== 'nation' || (had && had.alive)) return null;
  p.human = true;
  p.ai = null;
  p.slot = slot;
  p.nick = typeof name === 'string' && name ? name.slice(0, 18) : 'Igrač';
  G.slotPid[slot] = p.id;
  if (!G.humans.includes(p)) G.humans.push(p);
  return p;
};

/* one entry of the record [tick, slot, kind, args]: {pid, joined, r} (joined: the state taken over) */
RA.longApply = function (G, e) {
  const [, slot, kind, args] = e;
  if (kind === 'join') return { pid: 0, joined: RA.longJoin(G, slot, args[0], args[1]) };
  const pid = G.slotPid[slot];
  if (!pid) return { pid: 0 };
  return { pid, r: G.exec(pid, kind, Array.isArray(args) ? args : []) };
};

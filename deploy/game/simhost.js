'use strict';
/* The server's own simulation (plan phase 12): a worker thread that plays every Focus game with the same code as the
   page (dist/sim/sim.js = src/00–04, built by build/make.py), in step with the game's clock. So the server knows each
   game's state without trusting any player: the winner, the moment it ends, events for notifications (later) and a
   checksum to compare with the players' devices.

   RA.applyEra swaps the global unit/building tables, so games are stepped one at a time, each after its own era.

   parent → worker: {add: rec} · {c: [code, entry]} · {drop: code} · {ask: [id, code]}
   worker → parent: {ready} · {st: {code, tick, hash, over, winner}} (on ask and when a game ends) · {err: text} */
const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const pick = (...dirs) => dirs.find((d) => d && fs.existsSync(path.join(d, 'sim.js')));
const SIM = pick(process.env.SIM_DIR, path.join(__dirname, 'sim'), path.join(__dirname, '../../dist/sim'));
const DATA = [process.env.SIM_DATA, path.join(__dirname, 'data'), path.join(__dirname, '../../dist/data')].find((d) => d && fs.existsSync(d));
const BUDGET = 40; // ms of stepping per game per turn of the loop

global.window = global;
// the map loader decodes images for the page's terrain layer; the simulation needs none of it
global.Image = class {
  set src(v) {
    setTimeout(() => this.onload && this.onload(), 0);
  }
};
let RA = null;
const maps = {}; // id → base map (Europe is embedded, the world is read from DATA)
const games = new Map(); // code → {rec, G, queue, era, T, over}

async function boot() {
  if (!SIM) throw new Error('no dist/sim (run build/make.py)');
  for (const f of ['mapdata.js', 'eradata.js']) (0, eval)(fs.readFileSync(path.join(SIM, f), 'utf8'));
  new Function(fs.readFileSync(path.join(SIM, 'sim.js'), 'utf8'))();
  RA = global.RA;
  // the world map and its eras come from files instead of HTTP
  RA.DATA_URL = '/data/';
  const file = (url) => path.join(DATA || '', url.replace(/^\/data\//, ''));
  RA.fetchJSON = async (url) => JSON.parse(fs.readFileSync(file(url), 'utf8'));
  RA.hasFile = async (url) => !!DATA && fs.existsSync(file(url));
  const eu = await RA.loadMap();
  eu.eras = await RA.loadEras(global.ERADATA, eu.N);
  maps.evropa = eu;
}

async function mapFor(set) {
  const id = RA.MAPS.some((m) => m.id === set.map) ? set.map : 'evropa';
  if (!maps[id]) maps[id] = await RA.fetchMap(id);
  const m = maps[id];
  await RA.loadEra(m, RA.eraById(set.era).id);
  return m;
}

async function add(rec) {
  if (games.has(rec.code)) return;
  const g = { rec, G: null, queue: rec.cmds.slice(), era: RA.eraById(rec.set.era).id, over: false, loading: true };
  games.set(rec.code, g);
  try {
    const base = await mapFor(rec.set);
    RA.applyEra(g.era);
    g.G = RA.longGame(base, rec);
  } catch (e) {
    parentPort.postMessage({ err: `${rec.code}: ${e.message}` });
    games.delete(rec.code);
    return;
  }
  g.loading = false;
}

const tickOf = (rec) => Math.floor((Date.now() - rec.start) / rec.tickMs);
function status(g) {
  const G = g.G;
  return { code: g.rec.code, tick: G ? G.tick : 0, hash: G ? G.hash() : 0, over: !!g.over, winner: G && G.winner ? G.winner.id : 0, lg: G && G.lgWin ? G.lgWin : null, kicked: G && G.opts.league ? G.humans.filter((p) => p.kicked).map((p) => p.slot) : [] };
}
/* play one game up to one tick behind its clock (like the page), for at most BUDGET ms */
function advance(g) {
  const G = g.G;
  if (!G || g.over) return;
  RA.applyEra(g.era);
  const T = tickOf(g.rec), t0 = Date.now();
  while (G.state === 'play' && G.tick < T - 1 && Date.now() - t0 < BUDGET) {
    const q = g.queue;
    while (q.length && q[0][0] <= G.tick) RA.longApply(G, q.shift());
    G.step();
  }
  if (G.state === 'over' && !g.over) {
    g.over = true;
    parentPort.postMessage({ st: status(g) });
  }
}

let busy = false;
function loop() {
  if (busy) return;
  busy = true;
  try {
    for (const g of games.values()) if (!g.loading) advance(g);
  } catch (e) {
    parentPort.postMessage({ err: e.stack || e.message });
  }
  busy = false;
}

parentPort.on('message', (m) => {
  if (!RA) return;
  if (m.add) add(m.add);
  else if (m.c) {
    const g = games.get(m.c[0]);
    if (g) g.queue.push(m.c[1]);
  } else if (m.drop) games.delete(m.drop);
  else if (m.ask) {
    const g = games.get(m.ask[1]);
    if (g && !g.loading) advance(g); // as far as the clock allows, so the answer is current
    parentPort.postMessage({ id: m.ask[0], st: g && g.G ? status(g) : null });
  }
});

boot().then(
  () => {
    setInterval(loop, 250);
    parentPort.postMessage({ ready: true });
  },
  (e) => parentPort.postMessage({ err: 'sim boot: ' + e.message, dead: true })
);

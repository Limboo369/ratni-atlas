'use strict';
/* Conquest League on the real game server (deploy/game/server.js + league.js + long.js + the server's simulation),
   without a browser: the queue, 1v1 match, secret pick/ban and the draw, both players land in the same game with
   fixed seats, a surrender ends it and the ratings change; parties (together in one team, only the leader queues,
   too big for the size). Ratings in memory here (no accounts API); the API's side is in test_api.js.
   node build/test_league.js   (needs python3 build/make.py first: dist/sim) */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const R = path.join(__dirname, '..');
const WebSocket = require(path.join(R, 'deploy/game/node_modules/ws'));

const fails = [];
const check = (ok, msg) => {
  console.log((ok ? 'OK   ' : 'FAIL ') + msg);
  if (!ok) fails.push(msg);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => ok(p));
  });
});

/* a socket that remembers every message; wait(pred) resolves with the first matching one (seen or future) */
function client(url) {
  const ws = new WebSocket(url);
  const got = [], waits = [];
  ws.on('message', (b) => {
    const m = JSON.parse(b);
    got.push(m);
    for (const w of waits.slice()) if (w.f(m)) {
      waits.splice(waits.indexOf(w), 1);
      w.ok(m);
    }
  });
  const c = {
    ws, got,
    open: new Promise((ok, no) => (ws.on('open', ok), ws.on('error', no))),
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (f, ms = 20000, what = '') => {
      const hit = got.find(f);
      if (hit) return Promise.resolve(hit);
      return new Promise((ok, no) => {
        const w = { f, ok };
        waits.push(w);
        setTimeout(() => (waits.includes(w) ? (waits.splice(waits.indexOf(w), 1), no(new Error('timeout ' + what))) : 0), ms);
      });
    },
  };
  return c;
}

(async () => {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'league-'));
  const srv = spawn('node', [path.join(R, 'deploy/game/server.js')], { env: { ...process.env, PORT: String(port), LONG_DIR: dir, LEAGUE_PICK_S: '4', LEAGUE_WAIT: '2' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  srv.stdout.on('data', (b) => (log += b));
  srv.stderr.on('data', (b) => (log += b));
  for (let i = 0; i < 100; i++) {
    try {
      await new Promise((ok, no) => net.connect(port, '127.0.0.1').on('connect', function () {
        this.end();
        ok();
      }).on('error', no));
      break;
    } catch {
      await sleep(100);
    }
  }
  for (let i = 0; i < 100 && !/simulation ready/.test(log); i++) await sleep(100);
  const U = `ws://127.0.0.1:${port}/ws`;
  const uid = (n) => ('u' + n).padEnd(16, '0');
  const lobby = async (name) => {
    const c = client(U + '?league=1');
    await c.open;
    c.send({ hello: { name, uid: uid(name) } });
    await c.wait((m) => m.t === 'hi', 10000, 'hi');
    return c;
  };
  try {
    // 1v1 Blitz: queue, match, secret pick/ban, the draw
    const A = await lobby('Darko'), B = await lobby('Marko');
    const hi = A.got.find((m) => m.t === 'hi');
    check(hi.elo && hi.elo.b1.elo === 500, 'league: my ratings on hello (start 500)');
    A.send({ queue: { m: 'b', n: 1 } });
    await A.wait((m) => m.t === 'queue' && m.l === 'b1', 5000, 'queued');
    B.send({ queue: { m: 'b', n: 1 } });
    const ma = await A.wait((m) => m.t === 'match', 5000, 'match A'), mb = await B.wait((m) => m.t === 'match', 5000, 'match B');
    check(ma.id === mb.id && ma.team !== mb.team && ma.pool.maps.length === 7 && ma.pool.eras.length === 7, `1v1: a match, one team each, pool 7 maps + 7 eras (${ma.teams.map((t) => t.map((p) => p.name))})`);
    A.send({ pick: { maps: ['evropa', 'afrika'], eras: ['ww2', 'danas'], bm: 'svijet', be: 'rim', lock: 1 } });
    await sleep(300);
    check(!B.got.some((m) => m.t === 'tpick'), 'pick/ban: the other team does not see my picks');
    B.send({ pick: { maps: ['evropa', 'afrika'], eras: ['ww2', 'ww1'], bm: 'afrika', be: 'danas', lock: 1 } });
    const ra = await A.wait((m) => m.t === 'reveal', 8000, 'reveal'), rb = await B.wait((m) => m.t === 'reveal', 8000, 'reveal B');
    check(ra.code === rb.code && ra.chosen.map === 'evropa' && ['ww2', 'ww1'].includes(ra.chosen.era), `the draw: from the picks nobody banned (${JSON.stringify(ra.chosen)}, bans ${JSON.stringify(ra.bans)})`);
    check(ra.picks[1].maps.length === 2 && ra.picks[2].bm === 'afrika', 'the reveal shows both teams’ picks and bans (for the animation)');
    // both land in the same game, seats fixed
    const LA = client(U + '?long=' + ra.code), LB = client(U + '?long=' + ra.code);
    await Promise.all([LA.open, LB.open]);
    LA.send({ hello: { name: 'Darko', uid: uid('Darko') } });
    LB.send({ hello: { name: 'Marko', uid: uid('Marko') } });
    const recA = await LA.wait((m) => m.t === 'rec'), recB = await LB.wait((m) => m.t === 'rec');
    check(recA.you >= 0 && recB.you >= 0 && recA.you !== recB.you && recA.rec.set.lg === 1 && recA.rec.slots.every((s) => s.team), `the game: my seat is ready (slots ${recA.you}/${recB.you}), league settings ${JSON.stringify(recA.rec.set.lg)}`);
    LA.send({ join: [5, 'X'] });
    await LA.wait((m) => m.t === 'err', 3000, 'join refused').then(() => check(true, 'league: no taking over other states'), () => check(false, 'league: no taking over other states'));
    const C = client(U + '?long=' + ra.code);
    await C.open;
    C.send({ hello: { name: 'Gost', uid: uid('Gost') } });
    check((await C.wait((m) => m.t === 'rec')).you === -1, 'someone else only watches');
    await sleep(Math.max(0, recA.wait) + 1500);
    // Darko surrenders: Marko's team wins, ratings change (memory here)
    const aTeam = recA.rec.slots[recA.you].team;
    LA.send({ c: ['surr', []] });
    const lg = await LB.wait((m) => m.t === 'lg', 30000, 'result');
    const me = lg.res[recA.rec.slots[recA.you].name === 'Darko' ? 'dev' + uid('Darko') : ''] || lg.res['dev' + uid('Darko')];
    check(lg.l === 'b1' && me && me.delta === -20 && lg.res['dev' + uid('Marko')].delta === 20 && aTeam, `surrender → the server's simulation ends the game, ELO −20 / +20 (${JSON.stringify(lg.res)})`);
    const A2 = await lobby('Darko');
    const hi2 = A2.got.filter((m) => m.t === 'hi').pop();
    check(hi2.elo.b1.elo === 480 && hi2.elo.b1.games === 1 && hi2.elo.b2.games === 0, `the new rating on the next visit (${JSON.stringify(hi2.elo.b1)}), ladders separate`);
    for (const c of [A, B, LA, LB, C, A2]) c.ws.close();

    // parties: together in one team; only the leader queues; too big for the size
    const P1 = await lobby('Ana'), P2 = await lobby('Ivo'), S1 = await lobby('Edo'), S2 = await lobby('Lea');
    P1.send({ party: 'new' });
    const pt = await P1.wait((m) => m.t === 'party', 5000, 'party');
    P2.send({ party: pt.code });
    await P2.wait((m) => m.t === 'party' && m.members.length === 2, 5000, 'party 2');
    await P1.wait((m) => m.t === 'party' && m.members.length === 2, 5000, 'party 2 lead');
    check(true, `party ${pt.code}: two players`);
    P2.send({ queue: { m: 'b', n: 2 } });
    check(/vođa/.test((await P2.wait((m) => m.t === 'err', 5000, 'not lead')).e), 'only the party leader starts the search');
    P1.send({ queue: { m: 'b', n: 1 } });
    check(/najviše 1/.test((await P1.wait((m) => m.t === 'err' && /najviše/.test(m.e), 5000, 'too big')).e), 'a party of 2 cannot search 1v1');
    P1.send({ queue: { m: 'b', n: 2 } });
    await P2.wait((m) => m.t === 'queue' && m.l === 'b2', 5000, 'party queued');
    S1.send({ queue: { m: 'b', n: 2 } });
    S2.send({ queue: { m: 'b', n: 2 } });
    const m1 = await P1.wait((m) => m.t === 'match', 8000, 'match 2v2'), m2 = await P2.wait((m) => m.t === 'match', 8000, 'match 2v2 b');
    const s1 = await S1.wait((m) => m.t === 'match', 8000, 'match s1'), s2 = await S2.wait((m) => m.t === 'match', 8000, 'match s2');
    check(m1.team === m2.team && s1.team === s2.team && s1.team !== m1.team, `2v2: the party plays together, the two solo players against it (${m1.teams.map((t) => t.map((p) => p.name).join('+')).join(' vs ')})`);
    P1.send({ pick: { maps: ['okeanija', 'jam'], eras: ['rim', 'ww1'], bm: 'evropa', be: 'danas' } });
    const tp = await P2.wait((m) => m.t === 'tpick', 5000, 'teammate pick');
    await sleep(300);
    check(tp.pick.maps[0] === 'okeanija' && tp.by === 'Ana' && !S1.got.some((m) => m.t === 'tpick') && !S2.got.some((m) => m.t === 'tpick'), 'my teammate sees my picks, the other team does not');
    const rv = await S1.wait((m) => m.t === 'reveal', 10000, 'reveal 2v2 at the deadline');
    check(['okeanija', 'jam'].includes(rv.chosen.map) && ['rim', 'ww1'].includes(rv.chosen.era), `no lock from one team: the reveal comes at the deadline, drawn from the picks (${JSON.stringify(rv.chosen)})`);
    for (const c of [P1, P2, S1, S2]) c.ws.close();
  } catch (e) {
    check(false, 'error: ' + e.message);
  } finally {
    srv.kill();
  }
  if (fails.length) console.log('server log:\n' + log.slice(-2000));
  console.log('FAILS:', fails.length ? fails : 'none');
  process.exit(fails.length ? 1 : 0);
})();

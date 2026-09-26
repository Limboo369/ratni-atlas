'use strict';
/* Long games (plan 60): a game that lasts days and goes on while you're away.
   The server is only the clock and the archive: a game is its record (settings, seed, every command with its tick),
   kept on disk (LONG_DIR). The clock turns one tick every TICK_MS (50× slower than a normal game). Every browser that
   comes replays the record up to the current tick (the simulation is deterministic) and then follows the clock.
   A player takes over a computer state ('join'); when their last tab closes the computer plays for them ('ai'),
   when they come back it's theirs again ('back').

   /ws?long=new   client → {create: {set, name, uid}}
   /ws?long=<code> client → {hello: {name, uid}}
   then            client → {c: [kind, args]} (a command of my state) · {join: [stateId]} (take over a state)
   server → {t:'rec', rec: {code, set, seed, tickMs, start, slots: [{name}], cmds}, T, you} · {t:'c', e: [tick, slot, kind, args]}
            · {t:'T', T} (every tick) · {t:'err', e} */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.LONG_DIR || path.join(__dirname, 'long-data');
const TICK_MS = +process.env.LONG_TICK_MS || 5000;
// Skirmish (public online games, plan phase 15): the same server clock at Blitz speed, a countdown before the start
const FAST_MS = +process.env.LONG_FAST_MS || 100;
const WAIT_S = +process.env.SKIRMISH_WAIT || 60;
const MAX_GAMES = 300, MAX_SLOTS = 8, MAX_BYTES = 4e6, IDLE_DAYS = 30;
const KINDS = new Set(['atk', 'boat', 'para', 'build', 'rec', 'mv', 'dis', 'mis', 'mob', 'ret', 'aReq', 'aRes', 'tReq', 'tRes', 'ext', 'brk', 'tEnd', 'give', 'help', 'rcl', 'png', 'qm', 'tax', 'vas', 'loan', 'pay', 'str', 'buy', 'air', 'bomb', 'tech', 'stance', 'offer', 'offerRes', 'surr', 'endv', 'kick']);
const SET_KEYS = { map: /^[a-z]{2,12}$/, reg: /^[a-z0-9_-]{2,24}$/, era: /^[a-z0-9]{2,12}$/, gm: /^[a-z]{2,8}$/, dif: /^[a-z]{3,8}$/ };

const games = new Map(); // code → {rec, file, socks: Set, bytes, dirty}
try {
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of fs.readdirSync(DIR)) {
    if (!/^[a-z0-9]{6}\.json$/.test(f)) continue;
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      games.set(rec.code, { rec, socks: new Set(), bytes: JSON.stringify(rec.cmds).length, dirty: false });
    } catch (e) {
      console.warn('long: bad file', f, e.message);
    }
  }
} catch (e) {
  console.warn('long: no storage', e.message);
}
console.log(`long games: ${games.size} loaded from ${DIR}`);

/* the server's own simulation of every game (simhost.js, a worker thread): the state without trusting any player */
let sim = null, simReady = false, askId = 0;
const asks = new Map();
if (process.env.LONG_SIM !== '0') {
  try {
    const { Worker } = require('worker_threads');
    sim = new Worker(path.join(__dirname, 'simhost.js'));
    sim.on('message', (m) => {
      if (m.ready) {
        simReady = true;
        for (const gm of games.values()) sim.postMessage({ add: gm.rec });
        console.log('long: simulation ready');
      }
      if (m.err) console.warn('long sim:', m.err);
      if (m.dead) sim = null;
      if (m.id && asks.has(m.id)) {
        asks.get(m.id)(m.st);
        asks.delete(m.id);
      } else if (m.st && m.st.over) {
        const gm = games.get(m.st.code);
        if (gm && !gm.rec.over) {
          gm.rec.over = { tick: m.st.tick, winner: m.st.winner, lg: m.st.lg || undefined };
          save(gm);
          // Conquest League: the ratings change (league.js), everyone in the game hears it
          if (hooks.over) Promise.resolve(hooks.over(gm, m.st)).then((res) => {
            if (!res) return;
            save(gm);
            cast(gm, { t: 'lg', res, l: gm.rec.league.l });
          }, (e) => console.warn('long over hook', e.message));
        }
      }
    });
    sim.on('error', (e) => {
      console.warn('long sim died:', e.message);
      sim = null;
    });
  } catch (e) {
    console.warn('long: no simulation', e.message);
  }
}
const hooks = { over: null }; // over(gm, st): a game ended (league.js)
const simSend = (m) => sim && simReady && sim.postMessage(m);
function simAsk(code) {
  if (!sim || !simReady) return Promise.resolve(null);
  const id = ++askId;
  return new Promise((ok) => {
    asks.set(id, ok);
    sim.postMessage({ ask: [id, code] });
    setTimeout(() => asks.has(id) && (asks.delete(id), ok(null)), 10000);
  });
}

const tickOf = (rec) => Math.max(0, Math.floor((Date.now() - rec.start) / rec.tickMs));
const pub = (rec) => ({ code: rec.code, set: rec.set, seed: rec.seed, tickMs: rec.tickMs, start: rec.start, slots: rec.slots.map((s) => (s.team ? { name: s.name, team: s.team } : { name: s.name })), cmds: rec.cmds, league: rec.league ? { l: rec.league.l, res: rec.league.res } : undefined });
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, n) : '');
function save(gm) {
  gm.dirty = true;
  if (gm.timer) return;
  gm.timer = setTimeout(() => {
    gm.timer = null;
    if (!gm.dirty) return;
    gm.dirty = false;
    const f = path.join(DIR, gm.rec.code + '.json');
    fs.writeFile(f + '.tmp', JSON.stringify(gm.rec), (e) => (e ? console.warn('long save', e.message) : fs.rename(f + '.tmp', f, () => {})));
  }, 1500);
}
function cast(gm, msg) {
  const s = JSON.stringify(msg);
  for (const ws of gm.socks) if (ws.readyState === 1) ws.send(s);
}
/* an entry of the record, at the current tick */
function add(gm, slot, kind, args) {
  const e = [tickOf(gm.rec), slot, kind, args];
  const b = JSON.stringify(e).length;
  if (gm.bytes + b > MAX_BYTES) return false;
  gm.bytes += b;
  gm.rec.cmds.push(e);
  simSend({ c: [gm.rec.code, e] });
  gm.rec.seen = Date.now();
  save(gm);
  cast(gm, { t: 'c', e });
  return true;
}
function cleanSet(s) {
  const out = {};
  if (!s || typeof s !== 'object') return null;
  for (const [k, re] of Object.entries(SET_KEYS)) {
    if (typeof s[k] !== 'string' || !re.test(s[k])) return null;
    out[k] = s[k];
  }
  out.cs = Math.max(0, Math.min(50, s.cs | 0));
  out.peace = Math.max(0, Math.min(600, s.peace | 0));
  out.res = s.res === 1 ? 1 : 0;
  out.tree = s.tree === 1 ? 1 : 0;
  out.nn = s.nn === 1 ? 1 : 0;
  out.days = [1, 3, 7].includes(s.days) ? s.days : 1; // Focus: ~1, 3 or 7 days (the clock turns slower)
  out.pub = s.pub === 1 ? 1 : 0; // listed in Skirmish
  out.fast = s.fast === 1 ? 1 : 0; // Blitz speed (else Focus days)
  out.teams = ['0', '2', '3', 'hvs'].includes(s.teams) ? s.teams : '0'; // free for all, 2 or 3 teams, humans vs states
  out.aw = s.aw === 1 ? 1 : 0; // allies (players) win together
  return out;
}

function newCode() {
  let code;
  do code = crypto.randomBytes(6).toString('base64').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 6);
  while (code.length < 6 || games.has(code));
  return code;
}
function newGame(set) {
  const now = Date.now();
  const rec = { code: newCode(), set, seed: crypto.randomInt(1, 1e9), tickMs: set.fast ? FAST_MS : TICK_MS * set.days, start: now + (set.pub ? WAIT_S * 1000 : 0), slots: [], cmds: [], created: now, seen: now };
  const g = { rec, socks: new Set(), bytes: 2, dirty: false };
  games.set(rec.code, g);
  simSend({ add: rec });
  save(g);
  return g;
}

/* Conquest League (league.js): a game with its seats fixed (players only, two teams); the countdown starts after the
   pick/ban reveal */
function newLeague(set, slots, meta, waitMs) {
  const now = Date.now();
  const rec = { code: newCode(), set, seed: crypto.randomInt(1, 1e9), tickMs: set.fast ? FAST_MS : TICK_MS * set.days, start: now + waitMs, slots: slots.map((s) => ({ ...s, awayAt: now })), cmds: [], created: now, seen: now, league: meta };
  const g = { rec, socks: new Set(), bytes: 2, dirty: false };
  games.set(rec.code, g);
  simSend({ add: rec });
  save(g);
  return g;
}

/* Skirmish lobby (/ws?lobby=1): the public games, every 2 s; while somebody looks, there is always a Blitz game to join */
const lobbies = new Set();
const ERAS = ['danas', 'ww2', 'ww1', 'napoleon', 'hladni', 'srednji', 'rim'];
function publicList() {
  const out = [];
  for (const gm of games.values()) {
    const r = gm.rec;
    if (!r.set.pub || r.over) continue;
    out.push({ code: r.code, set: r.set, humans: r.slots.filter((s) => s.uid).length, max: MAX_SLOTS, tick: tickOf(r), wait: Math.max(0, r.start - Date.now()), tickMs: r.tickMs });
  }
  return out.sort((a, b) => b.wait - a.wait || a.tick - b.tick);
}
function ensurePublic() {
  const open = publicList().some((g) => g.set.fast && g.humans < g.max && g.tick < 3000);
  if (open || games.size >= MAX_GAMES) return;
  const era = ERAS[crypto.randomInt(0, ERAS.length)];
  newGame({ map: 'evropa', reg: 'evropa', era, gm: 'klasik', dif: 'srednje', cs: 0, peace: 60, res: 0, tree: 0, nn: 0, days: 1, pub: 1, fast: 1, teams: '0', aw: 0 });
}
function lobby(ws) {
  lobbies.add(ws);
  const tell = () => {
    ensurePublic();
    if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'list', games: publicList() }));
  };
  tell();
  const iv = setInterval(tell, 2000);
  ws.on('close', () => {
    clearInterval(iv);
    lobbies.delete(ws);
  });
  ws.on('message', () => {});
}

/* one connection; q = the URL's search params */
function handle(ws, q, account) {
  const want = q.get('long');
  let gm = null, uid = '', browserUid = '', slot = -1, n = 0, t0 = Date.now(), starting = false;
  const bye = setTimeout(() => !gm && ws.terminate(), 8000);
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  function enter(g, name) {
    clearTimeout(bye);
    gm = g;
    gm.socks.add(ws);
    slot = gm.rec.slots.findIndex((s) => s.uid === uid);
    if (slot < 0 && uid !== browserUid && browserUid) {
      // my seat from before I signed in (this browser): it moves to my account
      slot = gm.rec.slots.findIndex((s) => s.uid === browserUid);
      if (slot >= 0) gm.rec.slots[slot].uid = uid;
    }
    if (slot >= 0) {
      const s = gm.rec.slots[slot];
      if (name) s.name = name;
      if (s.away) {
        s.away = false;
        add(gm, slot, 'back', []);
      }
    }
    gm.rec.seen = Date.now();
    save(gm);
    send({ t: 'rec', rec: pub(gm.rec), T: tickOf(gm.rec), you: slot, wait: Math.max(0, gm.rec.start - Date.now()) });
  }
  ws.on('message', (buf) => {
    if (Date.now() - t0 > 1000) (t0 = Date.now()), (n = 0);
    if (++n > 8) return ws.terminate();
    let m;
    try {
      m = JSON.parse(buf);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (!gm) {
      const h = m.create || m.hello;
      if (!h || typeof h.uid !== 'string' || !/^[A-Za-z0-9]{12,40}$/.test(h.uid)) return ws.terminate();
      if (starting) return;
      starting = true;
      // signed in: the seat belongs to the account (the same state from every computer); else to this browser
      return void (account ? account() : Promise.resolve('')).then((acct) => {
        if (ws.readyState !== 1) return;
        uid = acct ? 'acct' + acct : h.uid;
        browserUid = h.uid;
        first(m, h);
      });
    }
    onCmd(m);
  });
  function first(m, h) {
    {
      const name = str(h.name, 18) || 'Igrač';
      if (m.create && want === 'new') {
        const set = cleanSet(m.create.set);
        if (!set) return send({ t: 'err', e: 'Nevažeće postavke.' });
        if (games.size >= MAX_GAMES) return send({ t: 'err', e: 'Server ima previše Focus igara — pokušaj kasnije.' });
        let code;
        do code = crypto.randomBytes(6).toString('base64').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 6);
        while (code.length < 6 || games.has(code));
        return enter(newGame(set), name);
      }
      const g = /^[a-z0-9]{6}$/.test(want || '') && games.get(want);
      if (!g) return send({ t: 'err', e: 'Ta Focus igra ne postoji (ili je istekla).', gone: 1 });
      return enter(g, name);
    }
  }
  function onCmd(m) {
    if (Array.isArray(m.join)) {
      // take over a computer state: a new seat, or my seat again after my state fell
      const id = m.join[0];
      if (!Number.isInteger(id) || id < 1 || id > 4000) return;
      if (gm.rec.league) return send({ t: 'err', e: 'U ligi su mjesta određena prije igre.' });
      if (slot < 0) {
        if (gm.rec.slots.length >= MAX_SLOTS) return send({ t: 'err', e: `Igra je puna (${MAX_SLOTS} igrača).` });
        gm.rec.slots.push({ uid, name: str(m.join[1], 18) || 'Igrač', away: false });
        slot = gm.rec.slots.length - 1;
      }
      add(gm, slot, 'join', [id, gm.rec.slots[slot].name, Number.isInteger(m.join[2]) && m.join[2] >= 0 && m.join[2] <= 3 ? m.join[2] : 0]);
      return send({ t: 'you', you: slot });
    }
    if (m.sim === 1) {
      // the server's own state of the game (tick and checksum), for checking a device against it
      simAsk(gm.rec.code).then((st) => send({ t: 'sim', st }));
      return;
    }
    if (m.leave === 1 && slot >= 0) {
      // leaving for good: the computer keeps the state and nobody can come back to this seat
      const s = gm.rec.slots[slot];
      s.uid = '';
      s.away = true;
      s.awayAt = Date.now();
      if (gm.rec.league) s.left = true; // the league: leaving loses ELO (you can search again at once)
      add(gm, slot, 'ai', []);
      slot = -1;
      return send({ t: 'you', you: -1 });
    }
    if (Array.isArray(m.c) && slot >= 0) {
      const [kind, args] = m.c;
      if (!KINDS.has(kind) || !Array.isArray(args) || JSON.stringify(args).length > 300) return;
      add(gm, slot, kind, args);
    }
  }
  ws.on('close', () => {
    clearTimeout(bye);
    if (!gm) return;
    gm.socks.delete(ws);
    // my last tab closed: the computer plays for me until I'm back
    if (slot >= 0 && ![...gm.socks].some((s) => s._uid === uid)) {
      const s = gm.rec.slots[slot];
      if (s && !s.away) {
        s.away = true;
        s.awayAt = Date.now();
        add(gm, slot, 'ai', []);
      }
    }
  });
  ws.on('error', () => {});
  Object.defineProperty(ws, '_uid', { get: () => uid });
}

// the clock: everyone hears each new tick; old games are dropped
setInterval(() => {
  for (const gm of games.values()) {
    const T = tickOf(gm.rec);
    if (T !== gm.lastT && gm.socks.size) cast(gm, { t: 'T', T });
    gm.lastT = T;
  }
}, Math.min(1000, FAST_MS));
// public Blitz games: gone 10 min after the end, or when nobody is in them any more
setInterval(() => {
  const now = Date.now();
  for (const [code, gm] of games) {
    const r = gm.rec;
    if (!r.set.fast || gm.socks.size) continue;
    const idle = now - (r.seen || r.created);
    if ((r.over && idle > 600e3) || (r.start < now && idle > 1800e3)) {
      games.delete(code);
      simSend({ drop: code });
      fs.unlink(path.join(DIR, code + '.json'), () => {});
    }
  }
}, 60e3);
setInterval(() => {
  const old = Date.now() - IDLE_DAYS * 86400e3;
  for (const [code, gm] of games) if ((gm.rec.seen || gm.rec.created) < old && !gm.socks.size) {
    games.delete(code);
    simSend({ drop: code });
    fs.unlink(path.join(DIR, code + '.json'), () => {});
  }
}, 3600e3);

/* write every game with unsaved changes now (on shutdown) */
function flush() {
  for (const gm of games.values()) {
    if (!gm.dirty) continue;
    gm.dirty = false;
    clearTimeout(gm.timer);
    gm.timer = null;
    try {
      fs.writeFileSync(path.join(DIR, gm.rec.code + '.json'), JSON.stringify(gm.rec));
    } catch (e) {
      console.warn('long flush', e.message);
    }
  }
}

module.exports = { handle, lobby, games, flush, TICK_MS, simAsk, newLeague, hooks };

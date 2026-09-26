'use strict';
/* Overtake online relay. Same shape as the claude.ai "room" the game was built on: everyone in a room has a
   presence object; a client sends shallow patches (null deletes a key) and every other client gets them.
   The lockstep protocol itself lives in the game (src/09a-net.js); this server only relays presence and keeps a
   copy of each running game's command log (for spectators and for guests who fell behind).

   Rooms are private: the room name is the code the host shares (/ws?room=<code>).
   client → server  {hello: {id, key}} first (resume my seat, or empty) · {p: patch, full?: 1} · {log: gameId, host, from}
   server → client  {t:'all', me, key, peers:{id: presence}, you: my last presence} after hello · {t:'p', id, p, full?} · {t:'x', id}
                    · {t:'log', g, st, log} · {t:'err', e}
   A reconnect with the id + key (HMAC of the id) from 'all' keeps the id and gets its last presence back (for
   KEEP ms after leaving), so a player can reload the page or come back later to the same seat in the same game.
   A peer is announced gone only after GRACE ms without a socket. */
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const long = require('./long'); // long games (days): /ws?long=<code>
const league = require('./league'); // Conquest League: /ws?league=1

const PORT = +process.env.PORT || 8080;
const SECRET = process.env.WS_SECRET || crypto.randomBytes(16).toString('hex');
const ORIGINS = (process.env.ORIGINS || '').split(',').filter(Boolean); // empty: any origin (local tests)
const MAX_PRES = 4096; // bytes of JSON per presence, as on claude.ai
const GRACE = 5000; // must stay below the game's 8 s takeover
const RATE = 80; // presence messages per second per socket
const PER_IP = 12, MAX_SOCKETS = 3000, MAX_ROOM = 12;
const MAX_LOG_BYTES = 1.5e6, MAX_GAMES = 400;
const KEEP = 10 * 60 * 1000; // how long a departed player's presence and a host's game log are kept for a return
const SLOW = 512 * 1024; // a peer this far behind on reading is dropped instead of buffered

// Online needs an account (plan phase 12): with REQUIRE_LOGIN=1 a room's hello waits for the accounts API to know the
// session cookie; without it the socket is closed with 4401 (the page then asks to sign in). Long games (Focus, solo
// against the computer) stay open to everyone.
const API = process.env.API_URL || '';
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === '1' && !!API;
const who = new Map(); // session token → {id, t}
/* the account id behind the request's session cookie ('' = not signed in, or no accounts API here) */
async function accountOf(req) {
  const m = API && /(?:^|;\s*)ot=([A-Za-z0-9_-]{10,200})/.exec(req.headers.cookie || '');
  if (!m) return '';
  const c = who.get(m[1]);
  if (c && Date.now() - c.t < 300000) return c.id;
  let id = '';
  try {
    const r = await fetch(API + '/api/me', { headers: { cookie: 'ot=' + m[1] }, signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    id = j && j.user ? String(j.user.id) : '';
  } catch (e) {
    console.warn('login check', e.message);
  }
  if (who.size > 5000) who.clear();
  who.set(m[1], { id, t: Date.now() });
  return id;
}
const signedIn = async (req) => !!(await accountOf(req));

const sign = (id) => crypto.createHmac('sha256', SECRET).update(id).digest('base64url').slice(0, 16);
const validKey = (id, key) => {
  const a = Buffer.from(sign(id)), b = Buffer.from(typeof key === 'string' ? key : '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const rooms = new Map(); // code → Map(id → {ws, pres, bye})
const games = new Map(); // 'hostId:gameId' → {host, g, st, log, bytes}
const perIp = new Map();
const left = new Map(); // 'room:id' → {pres, t}: players who left recently

function send(ws, s) {
  if (ws.readyState !== 1) return;
  if (ws.bufferedAmount > SLOW) return ws.terminate();
  ws.send(s);
}
// ponytail: broadcast to the whole room is O(peers²); rooms are private and capped at MAX_ROOM
function cast(room, from, msg) {
  const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
  for (const [id, p] of room) if (id !== from && p.ws) send(p.ws, s);
}

// keep a copy of every running game's command log, so anyone in the room can replay it from tick 0
function record(id, pres) {
  for (const [k, gm] of games) if (gm.host === id && (gm.g !== pres.g || pres.ph !== 'play')) games.delete(k);
  if (pres.r !== 'h' || pres.ph !== 'play' || typeof pres.g !== 'string' || !pres.st) return;
  const key = id + ':' + pres.g; // keyed by host too: nobody else can claim a game id they saw in the room
  let gm = games.get(key);
  if (!gm) {
    if (games.size >= MAX_GAMES) return;
    games.set(key, (gm = { host: id, g: pres.g, st: pres.st, log: [], bytes: 0 }));
  }
  gm.leftAt = 0;
  if (!Array.isArray(pres.c)) return;
  for (const e of pres.c) {
    if (!Array.isArray(e) || e[0] !== gm.log.length) continue;
    const b = JSON.stringify(e).length;
    if (gm.bytes + b > MAX_LOG_BYTES) break;
    gm.bytes += b;
    gm.log.push(e);
  }
}

const wss = new WebSocketServer({
  port: PORT,
  path: '/ws',
  maxPayload: 8192,
  verifyClient: ({ origin }) => !ORIGINS.length || ORIGINS.includes(origin),
});
wss.on('connection', (ws, req) => {
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  if (wss.clients.size > MAX_SOCKETS || (perIp.get(ip) || 0) >= PER_IP) return ws.close(1013, 'busy');
  perIp.set(ip, (perIp.get(ip) || 0) + 1);
  const q = new URL(req.url, 'http://x').searchParams;
  if (q.has('lobby')) {
    ws.on('close', () => {
      const c = (perIp.get(ip) || 1) - 1;
      if (c > 0) perIp.set(ip, c);
      else perIp.delete(ip);
    });
    return long.lobby(ws); // Skirmish: the list of public games
  }
  if (q.has('league')) {
    ws.alive = true;
    ws.on('pong', () => (ws.alive = true));
    ws.on('close', () => {
      const c = (perIp.get(ip) || 1) - 1;
      if (c > 0) perIp.set(ip, c);
      else perIp.delete(ip);
    });
    return league.handle(ws, q, () => accountOf(req)); // Conquest League: queue, party, pick/ban
  }
  if (q.has('long')) {
    ws.alive = true;
    ws.on('pong', () => (ws.alive = true));
    ws.on('close', () => {
      const c = (perIp.get(ip) || 1) - 1;
      if (c > 0) perIp.set(ip, c);
      else perIp.delete(ip);
    });
    return long.handle(ws, q, () => accountOf(req)); // signed in: my Focus seats follow my account
  }
  const name = /^[a-z0-9]{4,16}$/.test(q.get('room') || '') ? q.get('room') : '';
  let id = '', me = null, room = null;
  const gate = REQUIRE_LOGIN ? signedIn(req) : null;
  const helloTimer = setTimeout(() => ws.terminate(), 5000);

  function hello(h) {
    clearTimeout(helloTimer);
    if (!rooms.has(name)) rooms.set(name, new Map());
    room = rooms.get(name);
    id = h && typeof h.id === 'string' && /^[0-9a-f]{10}$/.test(h.id) && validKey(h.id, h.key) ? h.id : '';
    if (!id && room.size >= MAX_ROOM) return ws.close(1013, 'full');
    if (!id) id = crypto.randomBytes(5).toString('hex');
    me = room.get(id);
    if (me) {
      clearTimeout(me.bye);
      if (me.ws && me.ws !== ws) {
        me.ws.removeAllListeners('close');
        me.ws.terminate();
      }
      me.ws = ws;
    } else {
      const back = left.get(name + ':' + id);
      left.delete(name + ':' + id);
      room.set(id, (me = { ws, pres: back ? back.pres : Object.create(null), bye: null }));
    }
    const peers = {};
    for (const [k, p] of room) if (k !== id) peers[k] = p.pres;
    send(ws, JSON.stringify({ t: 'all', me: id, key: sign(id), peers, you: me.pres }));
  }

  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  let n = 0, t0 = Date.now(), lastLog = 0;
  ws.on('message', (buf) => {
    if (Date.now() - t0 > 1000) (t0 = Date.now()), (n = 0);
    if (++n > RATE) return ws.terminate();
    let m;
    try {
      m = JSON.parse(buf);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (!me && name && m.hello !== undefined && gate) return void gate.then((ok) => (ok ? !me && hello(m.hello) : ws.close(4401, 'login')));
    if (!me) return name && m.hello !== undefined ? hello(m.hello) : undefined;
    if (typeof m.log === 'string') {
      if (Date.now() - lastLog < 2000) return;
      lastLog = Date.now();
      const gm = games.get(String(m.host) + ':' + m.log), from = Number.isInteger(m.from) && m.from > 0 ? m.from : 0;
      return send(ws, JSON.stringify(gm ? { t: 'log', g: m.log, st: gm.st, log: gm.log.slice(from) } : { t: 'log', g: m.log, st: null, log: [] }));
    }
    const patch = m.p;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
    const keys = Object.keys(patch);
    if (keys.some((k) => BAD_KEYS.has(k))) return;
    const next = m.full ? Object.create(null) : Object.assign(Object.create(null), me.pres);
    for (const k of keys) {
      if (patch[k] === null) delete next[k];
      else next[k] = patch[k];
    }
    const out = JSON.stringify(m.full ? { t: 'p', id, p: next, full: 1 } : { t: 'p', id, p: patch });
    if (Buffer.byteLength(JSON.stringify(next)) > MAX_PRES || out.length > MAX_PRES + 200) {
      console.warn('presence too big', id);
      return send(ws, '{"t":"err","e":"big"}');
    }
    me.pres = next;
    record(id, next);
    cast(room, id, out);
  });
  ws.on('close', () => {
    clearTimeout(helloTimer);
    const c = (perIp.get(ip) || 1) - 1;
    if (c > 0) perIp.set(ip, c);
    else perIp.delete(ip);
    if (!me || me.ws !== ws) return;
    me.ws = null;
    me.bye = setTimeout(() => {
      room.delete(id);
      if (left.size < 20000) left.set(name + ':' + id, { pres: me.pres, t: Date.now() });
      for (const gm of games.values()) if (gm.host === id) gm.leftAt = Date.now();
      cast(room, id, { t: 'x', id });
      if (!room.size) rooms.delete(name);
    }, GRACE);
  });
  ws.on('error', () => {});
  if (!name) ws.close(1008, 'room');
});

setInterval(() => {
  const old = Date.now() - KEEP;
  for (const [k, v] of left) if (v.t < old) left.delete(k);
  for (const [k, gm] of games) if (gm.leftAt && gm.leftAt < old) games.delete(k);
  for (const ws of wss.clients) {
    if (!ws.alive) ws.terminate();
    else {
      ws.alive = false;
      ws.ping();
    }
  }
}, 5000);

process.on('SIGTERM', () => {
  long.flush(); // long games are on disk before we go
  wss.close(() => process.exit(0));
  for (const ws of wss.clients) ws.terminate();
  setTimeout(() => process.exit(0), 2000).unref();
});
console.log(`relay on :${PORT}/ws`);

'use strict';
/* Overtake online relay. Same shape as the claude.ai "room" the game was built on: everyone in a room has a
   presence object; a client sends shallow patches (null deletes a key) and every other client gets them.
   The lockstep protocol itself lives in the game (src/09a-net.js); this server only relays presence.

   client → server  {p: patch, full?: 1} · {log: gameId, host: hostPeerId, from}
   server → client  {t:'all', me, key, peers:{id: presence}} on (re)connect · {t:'p', id, p, full?} · {t:'x', id} · {t:'err', e}
                    · {t:'log', g, st, log} (the host's whole command log from 'from': spectators, guests who fell behind)
   Ids are assigned here; a reconnect with ?id=&key= (HMAC of the id) keeps the id, so a phone that switches
   networks keeps its seat. A peer is announced gone only after GRACE ms without a socket. */
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT = +process.env.PORT || 8080;
const SECRET = process.env.WS_SECRET || crypto.randomBytes(16).toString('hex');
const MAX_PRES = 4096; // bytes of JSON per presence, as on claude.ai
const GRACE = 5000; // must stay below the game's 8 s takeover
const RATE = 80; // messages per second per socket

const sign = (id) => crypto.createHmac('sha256', SECRET).update(id).digest('base64url').slice(0, 16);
const validKey = (id, key) => {
  const a = Buffer.from(sign(id)), b = Buffer.from(String(key || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const rooms = new Map(); // name → Map(id → {ws, pres, bye})
const games = new Map(); // 'hostId:gameId' → {host, g, st, log}: copied from the host's presence (st at start, then c entries in order)
const MAX_LOG = 100000;

// keep a copy of every running game's command log, so anyone can replay it from tick 0
function record(id, pres) {
  for (const [k, gm] of games) if (gm.host === id && (gm.g !== pres.g || pres.ph !== 'play')) games.delete(k);
  if (pres.r !== 'h' || pres.ph !== 'play' || typeof pres.g !== 'string' || !pres.st) return;
  const key = id + ':' + pres.g; // keyed by host too: nobody else can claim a game id they saw in a lobby
  let gm = games.get(key);
  if (!gm) games.set(key, (gm = { host: id, g: pres.g, st: pres.st, log: [] }));
  if (!Array.isArray(pres.c)) return;
  for (const e of pres.c) if (Array.isArray(e) && e[0] === gm.log.length && gm.log.length < MAX_LOG) gm.log.push(e);
}

// ponytail: broadcast to the whole room is O(peers²); filter by game id once the hall gets busy
function cast(room, from, msg) {
  const s = JSON.stringify(msg);
  for (const [id, p] of room) if (id !== from && p.ws && p.ws.readyState === 1) p.ws.send(s);
}

const wss = new WebSocketServer({ port: PORT, path: '/ws', maxPayload: 8192 });
wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const name = /^[a-z0-9]{1,16}$/.test(q.get('room') || '') ? q.get('room') : 'hall';
  if (!rooms.has(name)) rooms.set(name, new Map());
  const room = rooms.get(name);
  let id = q.get('id') || '';
  if (!/^[0-9a-f]{10}$/.test(id) || !validKey(id, q.get('key'))) id = crypto.randomBytes(5).toString('hex');
  let me = room.get(id);
  if (me) {
    clearTimeout(me.bye);
    if (me.ws && me.ws !== ws) {
      me.ws.removeAllListeners('close');
      me.ws.terminate();
    }
    me.ws = ws;
  } else room.set(id, (me = { ws, pres: {}, bye: null }));

  const peers = {};
  for (const [k, p] of room) if (k !== id) peers[k] = p.pres;
  ws.send(JSON.stringify({ t: 'all', me: id, key: sign(id), peers }));

  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  let n = 0, t0 = Date.now();
  ws.on('message', (buf) => {
    if (Date.now() - t0 > 1000) (t0 = Date.now()), (n = 0);
    if (++n > RATE) return ws.terminate();
    let m;
    try {
      m = JSON.parse(buf);
    } catch {
      return;
    }
    if (m && typeof m.log === 'string') {
      const gm = games.get(String(m.host) + ':' + m.log), from = Number.isInteger(m.from) && m.from > 0 ? m.from : 0;
      return ws.send(JSON.stringify(gm ? { t: 'log', g: m.log, st: gm.st, log: gm.log.slice(from) } : { t: 'log', g: m.log, st: null, log: [] }));
    }
    const patch = m && m.p;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
    const next = m.full ? {} : Object.assign({}, me.pres);
    for (const k of Object.keys(patch)) {
      if (patch[k] === null) delete next[k];
      else next[k] = patch[k];
    }
    if (Buffer.byteLength(JSON.stringify(next)) > MAX_PRES) {
      console.warn('presence too big', id);
      return ws.send('{"t":"err","e":"big"}');
    }
    me.pres = next;
    record(id, next);
    cast(room, id, m.full ? { t: 'p', id, p: next, full: 1 } : { t: 'p', id, p: patch });
  });
  ws.on('close', () => {
    if (me.ws !== ws) return;
    me.ws = null;
    me.bye = setTimeout(() => {
      room.delete(id);
      record(id, {});
      cast(room, id, { t: 'x', id });
      if (!room.size) rooms.delete(name);
    }, GRACE);
  });
  ws.on('error', () => {});
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) ws.terminate();
    else {
      ws.alive = false;
      ws.ping();
    }
  }
}, 5000);

console.log(`relay on :${PORT}/ws`);

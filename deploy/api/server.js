'use strict';
/* Overtake accounts API (service `api` in deploy/compose.yml, behind /api/ on the same domain as the game).
   Sign-in with Google: the page gets an ID token from Google Identity Services and posts it here; the token is
   verified against Google's public keys (RS256, aud = our client id), the account is created or found by the
   Google `sub`, and the browser gets an HttpOnly session cookie. The database is PostgreSQL (service `db`);
   connection settings come from the standard PG* variables.

   GET  /api/me      → {google: clientId, user: {id, name, email, pic} | null}
   POST /api/login   {credential}  → {user}      (sets the session cookie)
   POST /api/logout  → {ok}                     (clears it)
   POST /api/name    {name} → {user}
   POST /api/icon    {icon} → {user}            (one of ICONS)
   POST /api/delete  → {ok}                     (deletes the account and everything on it)
   GET  /api/health  → {ok}
   Results, statistics, achievements and the leaderboard: stats.js.
   Every POST must be JSON from an allowed origin (ORIGINS), which together with SameSite=Lax stops CSRF. */
const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = +process.env.PORT || 8081;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CERTS_URL = process.env.GOOGLE_CERTS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
const ORIGINS = (process.env.ORIGINS || '').split(',').filter(Boolean); // empty: any origin (local tests)
const SECURE = process.env.COOKIE_SECURE !== '0';
const COOKIE = 'ot';
const SESSION_DAYS = 90;
const MAX_BODY = 64 * 1024;
const BIG_BODY = { '/api/save': 1024 * 1024 }; // a saved game: its settings and every command
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const db = new Pool({ max: 8, idleTimeoutMillis: 30000 });
db.on('error', (e) => console.error('db', e.message));

const SCHEMA = [
  `create table if not exists users (
     id bigserial primary key,
     google_sub text unique,
     email text,
     name text not null,
     pic text,
     created timestamptz not null default now(),
     seen timestamptz not null default now())`,
  `create table if not exists sessions (
     hash bytea primary key,
     user_id bigint not null references users(id) on delete cascade,
     created timestamptz not null default now(),
     seen timestamptz not null default now())`,
  'create index if not exists sessions_user on sessions(user_id)',
  'alter table users add column if not exists icon text',
];
// profile emblems the page can draw (src/08e-account.js RA.EMBLEMS); 'google' = the Google profile picture
const ICONS = new Set(['google', 'stit', 'mac', 'kruna', 'orao', 'tvrdjava', 'sidro', 'tenk', 'raketa', 'zastava', 'zvijezda', 'kaciga', 'avion', 'atom']);

/* ---------------- Google ID token ---------------- */
let certs = null, certsAt = 0;
async function googleKeys(force) {
  if (certs && !force && Date.now() < certs.exp) return certs.keys;
  if (force && Date.now() - certsAt < 60000) return certs ? certs.keys : new Map(); // unknown kid: refetch once a minute at most
  certsAt = Date.now();
  const r = await fetch(CERTS_URL);
  if (!r.ok) throw new Error('certs ' + r.status);
  const j = await r.json();
  const age = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  const keys = new Map();
  for (const k of j.keys || []) if (k.kty === 'RSA' && k.kid) keys.set(k.kid, crypto.createPublicKey({ key: k, format: 'jwk' }));
  certs = { keys, exp: Date.now() + Math.min(age ? +age[1] : 3600, 86400) * 1000 };
  return keys;
}
const part = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
async function verifyGoogle(tok) {
  const p = typeof tok === 'string' && tok.length < 4096 ? tok.split('.') : [];
  if (p.length !== 3) throw new Error('format');
  const head = part(p[0]), c = part(p[1]);
  if (head.alg !== 'RS256' || typeof head.kid !== 'string') throw new Error('alg');
  let key = (await googleKeys()).get(head.kid);
  if (!key) key = (await googleKeys(true)).get(head.kid);
  if (!key) throw new Error('kid');
  if (!crypto.verify('RSA-SHA256', Buffer.from(p[0] + '.' + p[1]), key, Buffer.from(p[2], 'base64url'))) throw new Error('signature');
  const now = Date.now() / 1000;
  if (!ISSUERS.has(c.iss)) throw new Error('iss');
  if (!CLIENT_ID || c.aud !== CLIENT_ID) throw new Error('aud');
  if (!(c.exp > now - 60) || (c.iat && c.iat > now + 300)) throw new Error('exp');
  if (typeof c.sub !== 'string' || !c.sub) throw new Error('sub');
  return c;
}

/* ---------------- helpers ---------------- */
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const sha = (s) => crypto.createHash('sha256').update(s).digest();
const pub = (u) => u && { id: String(u.id), name: u.name, email: u.email || '', pic: u.pic || '', icon: u.icon || (u.pic ? 'google' : 'stit'), since: u.created };

function send(res, code, body, headers) {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(s), ...headers });
  res.end(s);
}
function cookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;
}
function readToken(req) {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]{20,64})').exec(req.headers.cookie || '');
  return m ? m[1] : '';
}
function body(req, max) {
  const MAX = max || MAX_BODY;
  return new Promise((ok, fail) => {
    let n = 0;
    const chunks = [];
    const big = () => Object.assign(new Error('big'), { code: 413 });
    if (+req.headers['content-length'] > MAX) return fail(big());
    req.on('data', (b) => {
      n += b.length;
      if (n > 4 * MAX) req.destroy(); // still streaming long after the limit: drop it
      else if (n <= MAX) chunks.push(b);
    });
    req.on('end', () => {
      if (n > MAX) return fail(big());
      try {
        ok(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {});
      } catch {
        fail(Object.assign(new Error('json'), { code: 400 }));
      }
    });
    req.on('error', fail);
  });
}

// requests per minute per IP; login has its own, smaller budget
const hits = new Map();
function limited(ip, kind, max) {
  const k = kind + ip, now = Date.now();
  let h = hits.get(k);
  if (!h || now - h.t > 60000) hits.set(k, (h = { t: now, n: 0 }));
  return ++h.n > max;
}
setInterval(() => {
  const old = Date.now() - 60000;
  for (const [k, h] of hits) if (h.t < old) hits.delete(k);
}, 60000).unref();

async function sessionUser(req) {
  const tok = readToken(req);
  if (!tok) return null;
  const h = sha(tok);
  const r = await db.query(
    `select u.* from sessions s join users u on u.id = s.user_id where s.hash = $1 and s.seen > now() - make_interval(days => $2)`, [h, SESSION_DAYS]);
  if (!r.rows.length) return null;
  db.query(`update sessions set seen = now() where hash = $1 and seen < now() - interval '1 day'`, [h]).catch(() => {});
  return r.rows[0];
}

/* ---------------- routes ---------------- */
const routes = {
  'GET /api/health': async () => {
    await db.query('select 1');
    return { ok: true };
  },
  'GET /api/me': async (req) => ({ google: CLIENT_ID, user: pub(await sessionUser(req)) }),
  'POST /api/login': async (req, b, res) => {
    let c;
    try {
      c = await verifyGoogle(b.credential);
    } catch (e) {
      console.warn('login refused:', e.message);
      return [401, { e: 'Google prijava nije uspjela. Pokušaj ponovo.' }];
    }
    const name = clean(c.given_name || c.name || (c.email || '').split('@')[0], 18) || 'Komandant';
    const r = await db.query(
      `insert into users (google_sub, email, name, pic) values ($1, $2, $3, $4)
       on conflict (google_sub) do update set email = excluded.email, pic = excluded.pic, seen = now()
       returning *`, [c.sub, clean(c.email, 200), name, /^https:\/\/[^\s"'<>]{1,500}$/.test(c.picture || '') ? c.picture : null]);
    const u = r.rows[0], tok = crypto.randomBytes(32).toString('base64url');
    await db.query('insert into sessions (hash, user_id) values ($1, $2)', [sha(tok), u.id]);
    await db.query(`delete from sessions where user_id = $1 and seen < now() - make_interval(days => $2)`, [u.id, SESSION_DAYS]);
    res.setHeader('Set-Cookie', cookie(tok, SESSION_DAYS * 86400));
    return { user: pub(u) };
  },
  'POST /api/logout': async (req, b, res) => {
    const tok = readToken(req);
    if (tok) await db.query('delete from sessions where hash = $1', [sha(tok)]);
    res.setHeader('Set-Cookie', cookie('', 0));
    return { ok: true };
  },
  'POST /api/name': async (req, b) => {
    const u = await sessionUser(req);
    if (!u) return [401, { e: 'Nisi prijavljen.' }];
    const name = clean(b.name, 18);
    if (name.length < 2) return [400, { e: 'Ime treba bar 2 slova.' }];
    const r = await db.query('update users set name = $1 where id = $2 returning *', [name, u.id]);
    return { user: pub(r.rows[0]) };
  },
  'POST /api/icon': async (req, b) => {
    const u = await sessionUser(req);
    if (!u) return [401, { e: 'Nisi prijavljen.' }];
    if (typeof b.icon !== 'string' || !ICONS.has(b.icon) || (b.icon === 'google' && !u.pic)) return [400, { e: 'Nepoznata ikonica.' }];
    const r = await db.query('update users set icon = $1 where id = $2 returning *', [b.icon, u.id]);
    return { user: pub(r.rows[0]) };
  },
  'POST /api/delete': async (req, b, res) => {
    const u = await sessionUser(req);
    if (!u) return [401, { e: 'Nisi prijavljen.' }];
    await db.query('delete from users where id = $1', [u.id]);
    res.setHeader('Set-Cookie', cookie('', 0));
    return { ok: true };
  },
};

const stats = require('./stats')(db, sessionUser);
SCHEMA.push(...stats.SCHEMA);
Object.assign(routes, stats.routes);

const server = http.createServer(async (req, res) => {
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  const path = (req.url || '').split('?')[0];
  const fn = routes[req.method + ' ' + path];
  try {
    if (!fn) return send(res, 404, { e: 'nema' });
    if (limited(ip, 'all', 120) || (path === '/api/login' && limited(ip, 'login', 10))) return send(res, 429, { e: 'Previše zahtjeva, sačekaj minut.' });
    let b = {};
    if (req.method === 'POST') {
      const origin = req.headers.origin || '';
      if (ORIGINS.length && !ORIGINS.includes(origin)) return send(res, 403, { e: 'origin' });
      if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return send(res, 415, { e: 'json' });
      b = await body(req, BIG_BODY[path]);
      if (!b || typeof b !== 'object' || Array.isArray(b)) return send(res, 400, { e: 'json' });
    }
    const out = await fn(req, b, res);
    if (Array.isArray(out)) send(res, out[0], out[1]);
    else send(res, 200, out);
  } catch (e) {
    if (e.code === 413 || e.code === 400) return send(res, e.code, { e: e.message }, { Connection: 'close' });
    console.error(req.method, path, e);
    if (!res.headersSent) send(res, 500, { e: 'Greška na serveru.' });
  }
});

async function start() {
  for (let i = 0; ; i++) {
    try {
      for (const q of SCHEMA) await db.query(q);
      break;
    } catch (e) {
      if (i >= 30) throw e;
      console.warn('waiting for the database:', e.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!CLIENT_ID) console.warn('GOOGLE_CLIENT_ID is not set: Google sign-in is off');
  server.listen(PORT, () => console.log(`api on :${PORT}`));
}
process.on('SIGTERM', () => server.close(() => db.end().then(() => process.exit(0))));
start().catch((e) => {
  console.error(e);
  process.exit(1);
});

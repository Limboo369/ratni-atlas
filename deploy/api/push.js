'use strict';
/* Web push notifications (plan phase 18), without extra packages: VAPID (RFC 8292, ES256 JWT) and the aes128gcm
   payload encryption (RFC 8291) with node's crypto. The VAPID key pair is made once and kept in the database (table kv),
   so there is nothing to configure and it survives redeploys (and is in the daily backup).
   GET  /api/push/key           → {key}  (the public key for pushManager.subscribe)
   POST /api/push/sub   {sub}   → {ok}   (signed in; sub = PushSubscription JSON; at most 5 per account)
   POST /api/push/unsub {endpoint} → {ok}
   internal (game server): POST /int/push {users: [id], title, body, url, tag} → {sent, gone} */
const crypto = require('crypto');

// push services of the browsers (a subscription's endpoint must be one of them: nothing else is ever fetched)
const HOSTS = (process.env.PUSH_HOSTS || 'fcm.googleapis.com,updates.push.services.mozilla.com,web.push.apple.com,notify.windows.com').split(',').filter(Boolean);
const SUBJECT = process.env.PUSH_SUBJECT || 'https://war.deovilab.com';
const b64 = (b) => Buffer.from(b).toString('base64url');
const unb64 = (s) => Buffer.from(String(s || ''), 'base64url');

const SCHEMA = [
  'create table if not exists kv (k text primary key, v text not null)',
  `create table if not exists push_subs (
     endpoint text primary key,
     user_id bigint not null references users(id) on delete cascade,
     p256dh text not null,
     auth text not null,
     at timestamptz not null default now())`,
  'create index if not exists push_subs_user on push_subs(user_id)',
];

function okEndpoint(u) {
  try {
    const x = new URL(u);
    const host = x.hostname;
    const allowed = HOSTS.some((h) => host === h || host.endsWith('.' + h));
    return allowed && (x.protocol === 'https:' || (process.env.PUSH_ALLOW_HTTP === '1' && x.protocol === 'http:')) && u.length < 1000;
  } catch {
    return false;
  }
}

/* the encrypted body for one subscription (RFC 8291, one record) */
function encrypt(payload, p256dh, auth) {
  const ua = unb64(p256dh), secret = unb64(auth);
  if (ua.length !== 65 || secret.length < 16) throw new Error('bad keys');
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const as = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(ua);
  const salt = crypto.randomBytes(16);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, secret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([as.length]), as, body]);
}

module.exports = function pushRoutes(db, sessionUser) {
  let keys = null; // {pub: raw public key (base64url), priv: KeyObject}
  async function vapid() {
    if (keys) return keys;
    let r = await db.query("select v from kv where k = 'vapid'");
    if (!r.rows.length) {
      const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      await db.query("insert into kv (k, v) values ('vapid', $1) on conflict (k) do nothing", [JSON.stringify(privateKey.export({ format: 'jwk' }))]);
      r = await db.query("select v from kv where k = 'vapid'");
    }
    const jwk = JSON.parse(r.rows[0].v);
    keys = { pub: b64(Buffer.concat([Buffer.from([4]), unb64(jwk.x), unb64(jwk.y)])), priv: crypto.createPrivateKey({ key: jwk, format: 'jwk' }) };
    return keys;
  }
  function jwt(aud, k) {
    const h = b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const c = b64(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT }));
    const sig = crypto.sign('sha256', Buffer.from(h + '.' + c), { key: k.priv, dsaEncoding: 'ieee-p1363' });
    return h + '.' + c + '.' + b64(sig);
  }
  async function sendOne(sub, payload) {
    const k = await vapid();
    const body = encrypt(payload, sub.p256dh, sub.auth);
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { TTL: '86400', Urgency: 'normal', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: `vapid t=${jwt(new URL(sub.endpoint).origin, k)}, k=${k.pub}` },
      body,
      signal: AbortSignal.timeout(10000),
    });
    return r.status;
  }
  return {
    SCHEMA,
    encrypt,
    routes: {
      'GET /api/push/key': async () => ({ key: (await vapid()).pub }),
      'POST /api/push/sub': async (req, b) => {
        const u = await sessionUser(req);
        if (!u) return [401, { e: 'Nisi prijavljen.' }];
        const s = b.sub || {};
        const p = s.keys && typeof s.keys.p256dh === 'string' ? s.keys.p256dh : '', a = s.keys && typeof s.keys.auth === 'string' ? s.keys.auth : '';
        if (typeof s.endpoint !== 'string' || !okEndpoint(s.endpoint) || unb64(p).length !== 65 || unb64(a).length < 16 || p.length > 200 || a.length > 60) return [400, { e: 'Nevažeća pretplata.' }];
        await db.query(
          `insert into push_subs (endpoint, user_id, p256dh, auth) values ($1, $2, $3, $4)
           on conflict (endpoint) do update set user_id = $2, p256dh = $3, auth = $4, at = now()`, [s.endpoint, u.id, p, a]);
        // at most 5 devices per account: the oldest go
        await db.query('delete from push_subs where user_id = $1 and endpoint not in (select endpoint from push_subs where user_id = $1 order by at desc limit 5)', [u.id]);
        return { ok: true };
      },
      'POST /api/push/unsub': async (req, b) => {
        const u = await sessionUser(req);
        if (!u) return [401, { e: 'Nisi prijavljen.' }];
        await db.query('delete from push_subs where user_id = $1 and endpoint = $2', [u.id, String(b.endpoint || '')]);
        return { ok: true };
      },
    },
    internal: {
      'POST /int/push': async (req, b) => {
        const ids = (Array.isArray(b.users) ? b.users : []).filter((x) => /^\d{1,15}$/.test(String(x))).map(String).slice(0, 10);
        if (!ids.length) return { sent: 0, gone: 0 };
        const payload = JSON.stringify({ title: String(b.title || 'Overtake').slice(0, 60), body: String(b.body || '').slice(0, 200), url: /^\/[a-z0-9/_-]{0,40}$/.test(b.url || '') ? b.url : '/', tag: String(b.tag || '').slice(0, 32) });
        const subs = (await db.query('select * from push_subs where user_id = any($1::bigint[])', [ids])).rows;
        let sent = 0, gone = 0;
        await Promise.all(subs.map(async (s) => {
          try {
            const st = await sendOne(s, payload);
            if (st === 404 || st === 410) {
              gone++;
              await db.query('delete from push_subs where endpoint = $1', [s.endpoint]);
            } else if (st < 300) sent++;
            else console.warn('push', st, new URL(s.endpoint).host);
          } catch (e) {
            console.warn('push', e.message);
          }
        }));
        return { sent, gone };
      },
    },
  };
};
module.exports.encrypt = encrypt;

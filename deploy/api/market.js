'use strict';
/* Community market (plan phase 19): scenarios made in the editor (src/09i-editor.js), kept on the author's account,
   public ones listed for everybody (browsing and playing need no account).
   POST /api/scen/save   {code?, title, desc, pub, data} → {code}     (signed in; code = update my own)
   GET  /api/scen/list?sort=new|top&mine=1&q= → {rows: [{code, title, desc, map, reg, era, author, plays, likes, pub, at, liked}]}
   GET  /api/scen/get?code= → {scen: {code, title, desc, author, plays, likes, data, mine}}   (public, or my own)
   POST /api/scen/play   {code} → {ok}   (counts a play, once per hour per IP)
   POST /api/scen/like   {code, on} → {likes}
   POST /api/scen/delete {code} → {ok}   (my own) */
const crypto = require('crypto');

const MAX_DATA = 400 * 1024;
const PER_USER = 50;
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

const SCHEMA = [
  `create table if not exists scenarios (
     id bigserial primary key,
     code text unique not null,
     user_id bigint not null references users(id) on delete cascade,
     title text not null,
     descr text not null default '',
     map text not null,
     reg text not null,
     era text not null,
     pub boolean not null default false,
     plays integer not null default 0,
     likes integer not null default 0,
     data text not null,
     created timestamptz not null default now(),
     updated timestamptz not null default now())`,
  'create index if not exists scenarios_pub on scenarios(pub, updated desc)',
  'create index if not exists scenarios_user on scenarios(user_id, updated desc)',
  `create table if not exists scenario_likes (
     scenario_id bigint not null references scenarios(id) on delete cascade,
     user_id bigint not null references users(id) on delete cascade,
     primary key (scenario_id, user_id))`,
];

/* a scenario's data: only the known fields, in range (the page and the game build maps from it) */
function cleanData(d) {
  if (!d || typeof d !== 'object') return null;
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!/^[a-z]{2,12}$/.test(d.map || '') || !/^[a-z0-9_-]{2,24}$/.test(d.reg || '') || !/^[a-z0-9]{2,12}$/.test(d.era || '')) return null;
  if (!int(d.k0, 1, 255) || !Array.isArray(d.paint) || d.paint.length > 60000) return null;
  const paint = [];
  for (const r of d.paint) {
    if (!Array.isArray(r) || !int(r[0], 0, 5e6) || !int(r[1], 1, 5e6) || !int(r[2], 0, 255)) return null;
    paint.push([r[0], r[1], r[2]]);
  }
  const col = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined);
  const nat = {};
  for (const [k, o] of Object.entries(d.nat && typeof d.nat === 'object' ? d.nat : {})) {
    if (!/^\d{1,3}$/.test(k) || !o || typeof o !== 'object') continue;
    const x = {};
    if (o.n) x.n = clean(o.n, 30);
    if (col(o.c)) x.c = col(o.c);
    nat[k] = x;
  }
  const add = (Array.isArray(d.add) ? d.add : []).slice(0, 40).map((a) => ({ n: clean(a && a.n, 30) || 'Nova država', c: col(a && a.c) || '#888888', cap: a && int(a.cap, 0, 5e6) ? a.cap : 0 }));
  const slots = (Array.isArray(d.slots) ? d.slots : []).filter((k) => int(k, 1, 255)).slice(0, 255);
  const R = d.rules && typeof d.rules === 'object' ? d.rules : {};
  const rules = { peace: int(R.peace, 0, 600) ? R.peace : 60, res: R.res ? 1 : 0, tree: R.tree ? 1 : 0, nn: R.nn ? 1 : 0 };
  return { v: 1, map: d.map, reg: d.reg, era: d.era, k0: d.k0, paint, nat, add, slots, rules };
}

module.exports = function marketRoutes(db, sessionUser) {
  const q = (req) => new URL(req.url, 'http://x').searchParams;
  const played = new Map(); // ip|code → time
  async function find(code) {
    if (!/^[a-z0-9]{8}$/.test(code || '')) return null;
    const r = await db.query('select s.*, u.name author from scenarios s join users u on u.id = s.user_id where s.code = $1', [code]);
    return r.rows[0] || null;
  }
  return {
    SCHEMA,
    cleanData,
    routes: {
      'POST /api/scen/save': async (req, b) => {
        const u = await sessionUser(req);
        if (!u) return [401, { e: 'Za objavu scenarija prijavi se.' }];
        const data = cleanData(b.data);
        if (!data) return [400, { e: 'Scenarij nije ispravan.' }];
        const title = clean(b.title, 60);
        if (title.length < 3) return [400, { e: 'Naslov treba bar 3 slova.' }];
        const txt = JSON.stringify(data);
        if (txt.length > MAX_DATA) return [413, { e: 'Scenarij je prevelik.' }];
        const args = [title, clean(b.desc, 400), data.map, data.reg, data.era, !!b.pub, txt];
        if (b.code) {
          const s = await find(b.code);
          if (!s || String(s.user_id) !== String(u.id)) return [404, { e: 'Taj scenarij nije tvoj.' }];
          await db.query('update scenarios set title = $1, descr = $2, map = $3, reg = $4, era = $5, pub = $6, data = $7, updated = now() where id = $8', [...args, s.id]);
          return { code: s.code };
        }
        const n = await db.query('select count(*)::int n from scenarios where user_id = $1', [u.id]);
        if (n.rows[0].n >= PER_USER) return [400, { e: `Najviše ${PER_USER} scenarija po nalogu.` }];
        const code = crypto.randomBytes(8).toString('base64').replace(/[^a-z0-9]/gi, '').toLowerCase().padEnd(8, '0').slice(0, 8);
        await db.query('insert into scenarios (code, user_id, title, descr, map, reg, era, pub, data) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [code, u.id, ...args]);
        return { code };
      },
      'GET /api/scen/list': async (req) => {
        const p = q(req), u = await sessionUser(req);
        const mine = p.get('mine') === '1';
        if (mine && !u) return [401, { e: 'Nisi prijavljen.' }];
        const order = p.get('sort') === 'top' ? 'likes desc, plays desc, updated desc' : 'updated desc';
        const text = clean(p.get('q'), 40);
        const r = await db.query(
          `select s.code, s.title, s.descr, s.map, s.reg, s.era, s.plays, s.likes, s.pub, s.updated at, u.name author,
                  ${u ? 'exists(select 1 from scenario_likes l where l.scenario_id = s.id and l.user_id = $2)' : 'false'} liked
             from scenarios s join users u on u.id = s.user_id
            where ${mine ? 's.user_id = $2' : 's.pub'} and ($1 = '' or s.title ilike '%' || $1 || '%')
            order by ${order} limit 60`, u ? [text, u.id] : [text]);
        return { rows: r.rows.map((x) => ({ code: x.code, title: x.title, desc: x.descr, map: x.map, reg: x.reg, era: x.era, plays: x.plays, likes: x.likes, pub: x.pub, at: x.at, author: x.author, liked: x.liked })) };
      },
      'GET /api/scen/get': async (req) => {
        const s = await find(q(req).get('code'));
        const u = s && !s.pub ? await sessionUser(req) : null;
        if (!s || (!s.pub && (!u || String(u.id) !== String(s.user_id)))) return [404, { e: 'Taj scenarij ne postoji (ili nije objavljen).' }];
        const me = s.pub ? await sessionUser(req) : u;
        return { scen: { code: s.code, title: s.title, desc: s.descr, author: s.author, plays: s.plays, likes: s.likes, pub: s.pub, data: JSON.parse(s.data), mine: !!me && String(me.id) === String(s.user_id) } };
      },
      'POST /api/scen/play': async (req, b) => {
        const s = await find(b.code);
        if (!s || !s.pub) return { ok: false };
        const k = String(req.headers['x-real-ip'] || req.socket.remoteAddress) + '|' + s.code;
        if (Date.now() - (played.get(k) || 0) > 3600e3) {
          played.set(k, Date.now());
          if (played.size > 20000) played.clear();
          await db.query('update scenarios set plays = plays + 1 where id = $1', [s.id]);
        }
        return { ok: true };
      },
      'POST /api/scen/like': async (req, b) => {
        const u = await sessionUser(req);
        if (!u) return [401, { e: 'Za sviđanje se prijavi.' }];
        const s = await find(b.code);
        if (!s || !s.pub) return [404, { e: 'Nema tog scenarija.' }];
        if (b.on) await db.query('insert into scenario_likes (scenario_id, user_id) values ($1, $2) on conflict do nothing', [s.id, u.id]);
        else await db.query('delete from scenario_likes where scenario_id = $1 and user_id = $2', [s.id, u.id]);
        const r = await db.query('update scenarios set likes = (select count(*) from scenario_likes where scenario_id = $1) where id = $1 returning likes', [s.id]);
        return { likes: r.rows[0].likes };
      },
      'POST /api/scen/delete': async (req, b) => {
        const u = await sessionUser(req);
        if (!u) return [401, { e: 'Nisi prijavljen.' }];
        await db.query('delete from scenarios where code = $1 and user_id = $2', [String(b.code || ''), u.id]);
        return { ok: true };
      },
    },
  };
};

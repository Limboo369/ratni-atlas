'use strict';
/* Results, statistics, achievements and the leaderboard (routes mounted by server.js).
   A finished game is reported by the player's own page (POST /api/result), once per game id; the server keeps the row,
   derives the achievements from the rows (so they can't be granted separately) and ranks players by wins.
   Results are self-reported: sanity limits below, and a per-day cap; server-side replay of online games can come later.

   POST /api/result {gid, online, mode, map, region, era, gm, start, difficulty, won, secs, peak, cities, kills, conquered, nukes, players}
                    → {stats, fresh: [achievement]}   (fresh = unlocked by this game)
   GET  /api/stats  → {stats (with rank: {title, level, next}), achievements: [{id, name, desc, at}], recent: [last 20 results]}
   GET  /api/top?by=wins|online → {rows: [{rank, name, wins, games, online}], me: row | null} */

const ERAS = ['rim', 'srednji', 'napoleon', 'ww1', 'ww2', 'hladni', 'danas'];
const PER_DAY = 60;

const SCHEMA = [
  `create table if not exists results (
     id bigserial primary key,
     user_id bigint not null references users(id) on delete cascade,
     gid text not null,
     at timestamptz not null default now(),
     online boolean not null,
     mode text not null,
     map text not null,
     region text not null,
     era text not null,
     gm text not null,
     start text not null,
     difficulty text not null,
     won boolean not null,
     secs integer not null,
     peak real not null,
     cities integer not null,
     kills integer not null,
     conquered integer not null,
     nukes integer not null,
     players integer not null,
     unique (user_id, gid))`,
  'create index if not exists results_user_at on results(user_id, at desc)',
  `create table if not exists achievements (
     user_id bigint not null references users(id) on delete cascade,
     id text not null,
     at timestamptz not null default now(),
     primary key (user_id, id))`,
];

/* r = this game, s = totals over all the player's games (after this one) */
const ACHIEVEMENTS = [
  { id: 'prva', name: 'Prva pobjeda', desc: 'Pobijedi u bilo kojoj partiji.', ok: (r, s) => s.wins >= 1 },
  { id: 'vojskovodja', name: 'Vojskovođa', desc: 'Pobijedi 5 puta.', ok: (r, s) => s.wins >= 5 },
  { id: 'osvajac', name: 'Osvajač', desc: 'Pobijedi 25 puta.', ok: (r, s) => s.wins >= 25 },
  { id: 'veteran', name: 'Veteran', desc: 'Odigraj 10 partija do kraja.', ok: (r, s) => s.games >= 10 },
  { id: 'munja', name: 'Munjeviti rat', desc: 'Pobijedi za manje od 10 minuta.', ok: (r) => r.won && r.secs < 600 },
  { id: 'tesko', name: 'Protiv svih izgleda', desc: 'Pobijedi na težini Teško.', ok: (r) => r.won && r.difficulty === 'tesko' },
  { id: 'evropa', name: 'Gospodar Evrope', desc: 'Pobijedi na cijeloj karti Evrope.', ok: (r) => r.won && r.map === 'evropa' && r.region === 'evropa' },
  { id: 'svijet', name: 'Gospodar svijeta', desc: 'Pobijedi na cijeloj karti svijeta.', ok: (r) => r.won && r.map === 'svijet' && r.region === 'svijet' },
  { id: 'royale', name: 'Posljednji preživjeli', desc: 'Pobijedi u battle royale.', ok: (r) => r.won && r.gm === 'br' },
  { id: 'online', name: 'Prva online pobjeda', desc: 'Pobijedi u online igri.', ok: (r) => r.won && r.online },
  { id: 'rame', name: 'Rame uz rame', desc: 'Pobijedi zajedno s prijateljem (online tim).', ok: (r) => r.won && r.online && r.mode === 'coop' },
  { id: 'duel', name: 'Dvoboj', desc: 'Pobijedi prijatelja u online igri jedan protiv drugog.', ok: (r) => r.won && r.online && r.mode === 'vs' },
  { id: 'dugme', name: 'Crveno dugme', desc: 'Lansiraj nuklearnu bombu.', ok: (r) => r.nukes >= 1 },
  { id: 'rusitelj', name: 'Rušitelj carstava', desc: 'Uništi 5 država u jednoj partiji.', ok: (r) => r.kills >= 5 },
  { id: 'opsada', name: 'Majstor opsade', desc: 'Osvoji 20 gradova u jednoj partiji.', ok: (r) => r.cities >= 20 },
  { id: 'carstvo', name: 'Carstvo', desc: 'Drži 50% karte u jednom trenutku.', ok: (r) => r.peak >= 50 },
  { id: 'maraton', name: 'Dugi rat', desc: 'Odigraj partiju dužu od 45 minuta.', ok: (r) => r.secs >= 2700 },
  { id: 'doba', name: 'Kroz sva doba', desc: 'Pobijedi u svih 7 historijskih doba.', ok: (r, s) => s.eras >= ERAS.length },
];

// status by wins: title now and the next one
const RANKS = [[0, 'Regrut'], [1, 'Vojnik'], [3, 'Kaplar'], [6, 'Narednik'], [10, 'Poručnik'], [15, 'Kapetan'], [25, 'Major'], [40, 'Pukovnik'], [60, 'General'], [100, 'Maršal']];
function rankOf(wins) {
  let i = 0;
  while (i + 1 < RANKS.length && wins >= RANKS[i + 1][0]) i++;
  const next = RANKS[i + 1];
  return { title: RANKS[i][1], level: i + 1, min: RANKS[i][0], next: next ? { title: next[1], wins: next[0] } : null };
}

const WORD = /^[a-z0-9_-]{1,24}$/;
const int = (v, max) => (Number.isFinite(+v) ? Math.max(0, Math.min(max, Math.round(+v))) : 0);

/* checks one reported result; returns the clean row or an error text */
function cleanResult(b) {
  if (typeof b.gid !== 'string' || !/^[A-Za-z0-9_:-]{4,64}$/.test(b.gid)) return 'Nevažeća igra.';
  const r = { gid: b.gid, online: b.online === true, won: b.won === true };
  for (const k of ['mode', 'map', 'region', 'era', 'gm', 'start', 'difficulty']) {
    if (typeof b[k] !== 'string' || !WORD.test(b[k])) return 'Nevažeći podaci igre.';
    r[k] = b[k];
  }
  if (!ERAS.includes(r.era)) return 'Nevažeće doba.';
  r.secs = int(b.secs, 7 * 86400);
  if (r.secs < 30) return 'Prekratka partija.';
  if (r.won && r.secs < 60) return 'Prekratka partija.';
  r.peak = Math.max(0, Math.min(100, Number.isFinite(+b.peak) ? +b.peak : 0));
  r.cities = int(b.cities, 5000);
  r.kills = int(b.kills, 1000);
  r.conquered = int(b.conquered, 1000);
  r.nukes = int(b.nukes, 1000);
  r.players = Math.max(1, int(b.players, 64));
  return r;
}

async function totals(db, uid) {
  const q = await db.query(
    `select count(*)::int games,
            count(*) filter (where won)::int wins,
            count(*) filter (where won and online)::int online_wins,
            count(*) filter (where online)::int online_games,
            coalesce(max(peak), 0)::real peak,
            coalesce(sum(kills), 0)::int kills,
            coalesce(sum(cities), 0)::int cities,
            coalesce(sum(nukes), 0)::int nukes,
            coalesce(sum(secs), 0)::int secs,
            min(secs) filter (where won)::int fastest,
            count(distinct era) filter (where won)::int eras
       from results where user_id = $1`, [uid]);
  return q.rows[0];
}
const pubStats = (s) => ({ rank: rankOf(s.wins), games: s.games, wins: s.wins, onlineWins: s.online_wins, onlineGames: s.online_games, peak: Math.round(s.peak * 10) / 10, kills: s.kills, cities: s.cities, nukes: s.nukes, secs: s.secs, fastest: s.fastest, eras: s.eras });
const pubAch = (a, at) => ({ id: a.id, name: a.name, desc: a.desc, at: at || null });

module.exports = function statsRoutes(db, sessionUser) {
  let topCache = new Map();
  return {
    SCHEMA,
    routes: {
      'POST /api/result': async (req, b) => {
        const u = await sessionUser(req);
        if (!u) return [401, { e: 'Nisi prijavljen.' }];
        const r = cleanResult(b);
        if (typeof r === 'string') return [400, { e: r }];
        const day = await db.query(`select count(*)::int n from results where user_id = $1 and at > now() - interval '1 day'`, [u.id]);
        if (day.rows[0].n >= PER_DAY) return [429, { e: 'Previše partija danas.' }];
        const ins = await db.query(
          `insert into results (user_id, gid, online, mode, map, region, era, gm, start, difficulty, won, secs, peak, cities, kills, conquered, nukes, players)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           on conflict (user_id, gid) do nothing returning id`,
          [u.id, r.gid, r.online, r.mode, r.map, r.region, r.era, r.gm, r.start, r.difficulty, r.won, r.secs, r.peak, r.cities, r.kills, r.conquered, r.nukes, r.players]);
        const s = await totals(db, u.id);
        if (!ins.rows.length) return { stats: pubStats(s), fresh: [], dup: true };
        const hit = ACHIEVEMENTS.filter((a) => a.ok(r, s));
        let fresh = [];
        if (hit.length) {
          const q = await db.query(
            `insert into achievements (user_id, id) select $1, unnest($2::text[]) on conflict do nothing returning id`, [u.id, hit.map((a) => a.id)]);
          const got = new Set(q.rows.map((x) => x.id));
          fresh = hit.filter((a) => got.has(a.id)).map((a) => pubAch(a, new Date().toISOString()));
        }
        topCache = new Map();
        return { stats: pubStats(s), fresh };
      },
      'GET /api/stats': async (req) => {
        const u = await sessionUser(req);
        if (!u) return [401, { e: 'Nisi prijavljen.' }];
        const [s, a, recent] = await Promise.all([
          totals(db, u.id),
          db.query('select id, at from achievements where user_id = $1', [u.id]),
          db.query(`select at, online, mode, map, region, era, gm, start, difficulty, won, secs, peak, cities, kills, nukes, players from results where user_id = $1 order by at desc limit 20`, [u.id]),
        ]);
        const have = new Map(a.rows.map((x) => [x.id, x.at]));
        return {
          stats: pubStats(s),
          achievements: ACHIEVEMENTS.map((x) => pubAch(x, have.get(x.id))),
          recent: recent.rows,
        };
      },
      'GET /api/top': async (req) => {
        const by = new URL(req.url, 'http://x').searchParams.get('by') === 'online' ? 'online' : 'wins';
        let t = topCache.get(by);
        if (!t || Date.now() - t.at > 30000) {
          const order = by === 'online' ? 'online desc, wins desc, games asc' : 'wins desc, online desc, games asc';
          const q = await db.query(
            `select rank() over (order by ${order})::int rank, id, name, icon, pic, wins, games, online from (
               select u.id, u.name, u.icon, u.pic, count(*) filter (where r.won)::int wins, count(*)::int games,
                      count(*) filter (where r.won and r.online)::int online
                 from results r join users u on u.id = r.user_id group by u.id) x
              where ${by === 'online' ? 'online' : 'wins'} > 0 order by rank, name limit 500`);
          topCache.set(by, (t = { at: Date.now(), rows: q.rows }));
        }
        const u = await sessionUser(req);
        const row = (x) => ({ rank: x.rank, name: x.name, icon: x.icon || (x.pic ? 'google' : 'stit'), pic: x.pic || '', wins: x.wins, games: x.games, online: x.online, me: !!(u && String(x.id) === String(u.id)) });
        const me = u ? t.rows.find((x) => String(x.id) === String(u.id)) : null;
        return { by, rows: t.rows.slice(0, 20).map(row), me: me ? row(me) : null };
      },
    },
  };
};
module.exports.ACHIEVEMENTS = ACHIEVEMENTS;

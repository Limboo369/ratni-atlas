'use strict';
/* Conquest League (plan phase 16): ELO on 6 ladders — Blitz / Focus × 1v1, 2v2, 5v5 (b1 b2 b5 f1 f2 f5).
   Start 500, never under 100; the first 5 games are placement (K = 40), then K = 24. Every player gets their own
   points: expectation = 1 / (1 + 10^((opponents' average − my ELO) / 400)), change = K × (result − expectation).
   A player who left (or was kicked) loses as if their team lost. Ranks: Raider 100–299 · Vanguard 300–449 ·
   Warlord 450–599 · Emperor 600–799 · Overlord 800+.

   Results come only from the game server (its own simulation decides the winner), on the internal port that is not
   published outside the compose network (server.js, INT_PORT):
   POST /int/league/elo    {ids, l} → {elo: {id: {elo, games, name}}}
   POST /int/league/result {code, l, winner, why, secs, map, era, teams: [[{id, left}], [...]]} → {res: {id: {elo, delta}}}
   Public:
   GET  /api/league          → {me: {b1: {elo, games, wins, rank}, …} | null}
   GET  /api/league/top?l=b1 → {l, rows: [{rank, name, icon, elo, games, wins, tier}] (top 100), me}
   GET  /api/league/history  → {games: [last 30 of mine]} */
const LADDERS = ['b1', 'b2', 'b5', 'f1', 'f2', 'f5'];
const START = 500, FLOOR = 100, PLACEMENT = 5;
const TIERS = [[800, 'Overlord'], [600, 'Emperor'], [450, 'Warlord'], [300, 'Vanguard'], [0, 'Raider']];
const tier = (elo, games) => (games < PLACEMENT ? 'Unranked' : TIERS.find((t) => elo >= t[0])[1]);

/* the new ratings: teams = [[{id, elo, games, left}], [...]], winner = 1 or 2 */
function rate(teams, winner) {
  const avg = (t) => t.reduce((s, p) => s + p.elo, 0) / Math.max(1, t.length);
  const out = {};
  teams.forEach((team, i) => {
    const opp = avg(teams[1 - i]);
    for (const p of team) {
      const E = 1 / (1 + Math.pow(10, (opp - p.elo) / 400));
      const S = winner === i + 1 && !p.left ? 1 : 0;
      const K = p.games < PLACEMENT ? 40 : 24;
      const elo = Math.max(FLOOR, Math.round(p.elo + K * (S - E)));
      out[p.id] = { elo, delta: elo - p.elo, won: S === 1, left: !!p.left };
    }
  });
  return out;
}

const SCHEMA = [
  `create table if not exists league (
     user_id bigint not null references users(id) on delete cascade,
     ladder text not null,
     elo integer not null default ${START},
     games integer not null default 0,
     wins integer not null default 0,
     leaves integer not null default 0,
     at timestamptz not null default now(),
     primary key (user_id, ladder))`,
  'create index if not exists league_top on league(ladder, elo desc)',
  `create table if not exists league_games (
     id bigserial primary key,
     code text unique not null,
     ladder text not null,
     at timestamptz not null default now(),
     data text not null)`,
  `create table if not exists league_players (
     game_id bigint not null references league_games(id) on delete cascade,
     user_id bigint not null references users(id) on delete cascade,
     primary key (game_id, user_id))`,
  'create index if not exists league_players_user on league_players(user_id, game_id desc)',
];

module.exports = function leagueRoutes(db, sessionUser) {
  async function elos(ids, l) {
    const q = await db.query(
      `select u.id, u.name, coalesce(g.elo, ${START}) elo, coalesce(g.games, 0) games
         from users u left join league g on g.user_id = u.id and g.ladder = $2 where u.id = any($1::bigint[])`, [ids, l]);
    const out = {};
    for (const r of q.rows) out[r.id] = { elo: r.elo, games: r.games, name: r.name };
    return out;
  }
  const ids = (a) => (Array.isArray(a) ? a.filter((x) => /^\d{1,15}$/.test(String(x))).map(String).slice(0, 10) : []);
  return {
    SCHEMA,
    internal: {
      'POST /int/league/elo': async (req, b) => {
        if (!LADDERS.includes(b.l)) return [400, { e: 'ladder' }];
        return { elo: await elos(ids(b.ids), b.l) };
      },
      'POST /int/league/result': async (req, b) => {
        if (!LADDERS.includes(b.l) || typeof b.code !== 'string' || !/^[a-z0-9]{6}$/.test(b.code)) return [400, { e: 'bad' }];
        if (![1, 2].includes(b.winner) || !Array.isArray(b.teams) || b.teams.length !== 2) return [400, { e: 'bad' }];
        const dup = await db.query('select data from league_games where code = $1', [b.code]);
        if (dup.rows.length) return { res: JSON.parse(dup.rows[0].data).res, dup: true };
        const all = b.teams.flat().map((p) => p && String(p.id));
        const cur = await elos(ids(all), b.l);
        const teams = b.teams.map((t) => (Array.isArray(t) ? t : []).filter((p) => p && cur[p.id]).map((p) => ({ id: String(p.id), left: !!p.left, ...cur[p.id] })));
        if (!teams[0].length || !teams[1].length) return [400, { e: 'players' }];
        const res = rate(teams, b.winner);
        const data = {
          l: b.l, winner: b.winner, why: String(b.why || '').slice(0, 8), secs: Math.max(0, b.secs | 0), map: String(b.map || '').slice(0, 24), era: String(b.era || '').slice(0, 12),
          teams: teams.map((t) => t.map((p) => ({ id: p.id, name: p.name, elo: p.elo, delta: res[p.id].delta, left: p.left }))), res,
        };
        const c = await db.connect();
        try {
          await c.query('begin');
          const g = await c.query('insert into league_games (code, ladder, data) values ($1, $2, $3) on conflict (code) do nothing returning id', [b.code, b.l, JSON.stringify(data)]);
          if (!g.rows.length) {
            await c.query('rollback');
            return { res, dup: true };
          }
          for (const [id, r] of Object.entries(res)) {
            await c.query(
              `insert into league (user_id, ladder, elo, games, wins, leaves, at) values ($1, $2, $3, 1, $4, $5, now())
               on conflict (user_id, ladder) do update set elo = $3, games = league.games + 1, wins = league.wins + $4, leaves = league.leaves + $5, at = now()`,
              [id, b.l, r.elo, r.won ? 1 : 0, r.left ? 1 : 0]);
            await c.query('insert into league_players (game_id, user_id) values ($1, $2) on conflict do nothing', [g.rows[0].id, id]);
          }
          await c.query('commit');
        } catch (e) {
          await c.query('rollback').catch(() => {});
          throw e;
        } finally {
          c.release();
        }
        return { res };
      },
    },
    routes: {
      'GET /api/league': async (req) => {
        const u = await sessionUser(req);
        if (!u) return { me: null };
        const q = await db.query('select ladder, elo, games, wins from league where user_id = $1', [u.id]);
        const me = {};
        for (const l of LADDERS) me[l] = { elo: START, games: 0, wins: 0, rank: tier(START, 0) };
        for (const r of q.rows) me[r.ladder] = { elo: r.elo, games: r.games, wins: r.wins, rank: tier(r.elo, r.games) };
        return { me };
      },
      'GET /api/league/top': async (req) => {
        const l = new URL(req.url, 'http://x').searchParams.get('l');
        if (!LADDERS.includes(l)) return [400, { e: 'Nepoznata ljestvica.' }];
        // world ranking: the top 100 players who finished their placement games
        const q = await db.query(
          `select g.user_id, u.name, u.icon, u.pic, g.elo, g.games, g.wins, rank() over (order by g.elo desc, g.wins desc) rk
             from league g join users u on u.id = g.user_id where g.ladder = $1 and g.games >= ${PLACEMENT}
            order by g.elo desc, g.wins desc limit 100`, [l]);
        const row = (r) => ({ rank: +r.rk, name: r.name, icon: r.icon || (r.pic ? 'google' : 'stit'), elo: r.elo, games: r.games, wins: r.wins, tier: tier(r.elo, r.games) });
        const u = await sessionUser(req);
        let me = null;
        if (u) {
          const m = await db.query(
            `select * from (select g.user_id, u.name, u.icon, u.pic, g.elo, g.games, g.wins, rank() over (order by g.elo desc, g.wins desc) rk
               from league g join users u on u.id = g.user_id where g.ladder = $1 and g.games >= ${PLACEMENT}) t where user_id = $2`, [l, u.id]);
          if (m.rows.length) me = row(m.rows[0]);
        }
        return { l, rows: q.rows.map(row), me };
      },
      'GET /api/league/history': async (req) => {
        const u = await sessionUser(req);
        if (!u) return [401, { e: 'Nisi prijavljen.' }];
        const q = await db.query(
          `select g.code, g.ladder, g.at, g.data from league_players p join league_games g on g.id = p.game_id
            where p.user_id = $1 order by g.id desc limit 30`, [u.id]);
        return {
          games: q.rows.map((r) => {
            const d = JSON.parse(r.data), mine = d.res[u.id] || {};
            return { code: r.code, l: r.ladder, at: r.at, won: !!mine.won, delta: mine.delta || 0, elo: mine.elo || 0, left: !!mine.left, why: d.why, secs: d.secs, map: d.map, era: d.era,
              teams: d.teams.map((t) => t.map((p) => ({ name: p.name, delta: p.delta, me: p.id === String(u.id) }))), winner: d.winner };
          }),
        };
      },
    },
  };
};
module.exports.rate = rate;
module.exports.tier = tier;
module.exports.LADDERS = LADDERS;

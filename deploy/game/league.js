'use strict';
/* Conquest League (plan phase 16): the queue, parties, the secret pick/ban and the result.
   /ws?league=1 (an account is required; without the accounts API — tests, a local run — the browser's id stands in)
   client → {hello: {name, uid}} · {party: 'new' | code | ''} · {queue: {m: 'b'|'f', n: 1|2|5}} · {unqueue: 1}
            · {pick: {maps: [a, b], eras: [a, b], bm, be, lock}}
   server → {t: 'hi', me, elo: {b1: {elo, games}, …}} · {t: 'party', code, lead, members: [{id, name}]}
            · {t: 'queue', l, since} | {t: 'queue', l: null} · {t: 'match', id, l, team, teams, pool, secs}
            · {t: 'tpick', pick, by} (only my team) · {t: 'reveal', picks, bans, chosen, code, at} · {t: 'err', e}
   A match: two teams of n players, parties stay together, ELO close (the window widens while waiting). Each team picks
   2 maps and 2 eras and bans one of each, unseen by the other team; the computer draws from the picks nobody banned.
   The game is a long game (long.js) with fixed seats; when the server's simulation ends it, the ratings change
   (the accounts API on its internal port, or in memory without it). */
const crypto = require('crypto');
const long = require('./long');

const API_INT = process.env.API_INT || '';
const PICK_S = +process.env.LEAGUE_PICK_S || 25;
const WAIT_S = +process.env.LEAGUE_WAIT || 12; // after the reveal: the draw animation, then the countdown
const SPREAD = 250; // a party's ELO spread at most
const AWAY_LEFT = 5 * 60e3; // away this long when the game ends = left
// the pool (plan: the whole world + 6 continents, 7 eras): [id, map, region]
const MAPS = [['svijet', 'svijet', 'svijet'], ['evropa', 'evropa', 'evropa'], ['afrika', 'svijet', 'afrika'], ['azija', 'svijet', 'azija'], ['sam', 'svijet', 'sam'], ['jam', 'svijet', 'jam'], ['okeanija', 'svijet', 'okeanija']];
const ERAS = ['rim', 'srednji', 'napoleon', 'ww1', 'ww2', 'hladni', 'danas'];
const SIZES = [1, 2, 5];

/* ---------------- ratings: the accounts API, or memory ---------------- */
const mem = new Map(); // 'id|l' → {elo, games}
function rate(teams, winner) {
  const avg = (t) => t.reduce((s, p) => s + p.elo, 0) / Math.max(1, t.length);
  const out = {};
  teams.forEach((team, i) => {
    const opp = avg(teams[1 - i]);
    for (const p of team) {
      const E = 1 / (1 + Math.pow(10, (opp - p.elo) / 400));
      const S = winner === i + 1 && !p.left ? 1 : 0;
      const elo = Math.max(100, Math.round(p.elo + (p.games < 5 ? 40 : 24) * (S - E)));
      out[p.id] = { elo, delta: elo - p.elo, won: S === 1, left: !!p.left };
    }
  });
  return out;
}
async function intPost(p, body) {
  const r = await fetch(API_INT + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(p + ' ' + r.status);
  return r.json();
}
async function elos(ids, l) {
  if (API_INT && ids.every((id) => /^\d+$/.test(id))) return (await intPost('/int/league/elo', { ids, l })).elo;
  const out = {};
  for (const id of ids) out[id] = Object.assign({ elo: 500, games: 0 }, mem.get(id + '|' + l));
  return out;
}
const done = new Map(); // code → result (memory mode: once per game)
async function report(res) {
  if (API_INT && res.teams.flat().every((p) => /^\d+$/.test(p.id))) return (await intPost('/int/league/result', res)).res;
  if (done.has(res.code)) return done.get(res.code);
  const cur = await elos(res.teams.flat().map((p) => p.id), res.l);
  const out = rate(res.teams.map((t) => t.map((p) => ({ ...p, ...cur[p.id] }))), res.winner);
  for (const [id, r] of Object.entries(out)) {
    const k = id + '|' + res.l, o = mem.get(k) || { elo: 500, games: 0 };
    mem.set(k, { elo: r.elo, games: o.games + 1 });
  }
  done.set(res.code, out);
  return out;
}

/* ---------------- players, parties, queues, matches ---------------- */
const players = new Map(); // id → {id, name, ws, party, match}
const parties = new Map(); // code → {code, lead, members: [id]}
const queues = new Map(); // ladder → [{ids, since, avg, elos}]
const matches = new Map(); // id → {id, l, n, teams: [[id]], picks: {1, 2}, until, timer}
const send = (id, m) => {
  const p = players.get(id);
  if (p && p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(m));
};
const code6 = () => crypto.randomBytes(6).toString('base64').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 6).padEnd(6, 'x');
function partyOf(id) {
  const p = players.get(id);
  return p && p.party ? parties.get(p.party) : null;
}
function partyCast(pt) {
  const m = { t: 'party', code: pt.code, lead: pt.lead, members: pt.members.map((id) => ({ id, name: (players.get(id) || {}).name || '?' })) };
  for (const id of pt.members) send(id, m);
}
function leaveParty(id) {
  const pt = partyOf(id);
  const p = players.get(id);
  if (p) p.party = '';
  if (!pt) return;
  unqueue(pt.members);
  pt.members = pt.members.filter((x) => x !== id);
  if (!pt.members.length) return parties.delete(pt.code);
  if (pt.lead === id) pt.lead = pt.members[0];
  partyCast(pt);
}
/* take out of the queue every entry with any of these players */
function unqueue(ids) {
  for (const [l, q] of queues) {
    const keep = q.filter((e) => !e.ids.some((x) => ids.includes(x)));
    for (const e of q) if (!keep.includes(e)) for (const x of e.ids) send(x, { t: 'queue', l: null });
    queues.set(l, keep);
  }
}
async function enqueue(id, m, n) {
  const l = m + n, pt = partyOf(id);
  const ids = pt ? pt.members.slice() : [id];
  if (pt && pt.lead !== id) return send(id, { t: 'err', e: 'Traženje pokreće vođa partyja.' });
  if (ids.length > n) return send(id, { t: 'err', e: `Party ima ${ids.length} igrača — za ${n}v${n} najviše ${n}.` });
  if (ids.some((x) => (players.get(x) || {}).match)) return send(id, { t: 'err', e: 'Neko iz partyja je već u meču.' });
  let el;
  try {
    el = await elos(ids, l);
  } catch (e) {
    console.warn('league elo', e.message);
    return send(id, { t: 'err', e: 'Liga trenutno ne radi — pokušaj malo kasnije.' });
  }
  const v = ids.map((x) => (el[x] || { elo: 500 }).elo);
  if (Math.max(...v) - Math.min(...v) > SPREAD) return send(id, { t: 'err', e: `U partyju razlika ELO smije biti najviše ${SPREAD} (sada ${Math.max(...v) - Math.min(...v)}).` });
  unqueue(ids);
  const e = { ids, since: Date.now(), avg: v.reduce((a, b) => a + b, 0) / v.length, elos: el };
  if (!queues.has(l)) queues.set(l, []);
  queues.get(l).push(e);
  for (const x of ids) send(x, { t: 'queue', l, since: e.since });
}
/* the matchmaker: from the longest waiting, two teams of n with close ELO (parties together) */
function matchmake() {
  const now = Date.now();
  for (const [l, q] of queues) {
    const n = +l.slice(1);
    if (q.reduce((s, e) => s + e.ids.length, 0) < 2 * n) continue;
    q.sort((a, b) => a.since - b.since);
    for (const seed of q) {
      const win = Math.min(2000, 150 + ((now - seed.since) / 1000) * 10);
      const cands = q.filter((e) => e !== seed && Math.abs(e.avg - seed.avg) <= win).sort((a, b) => Math.abs(a.avg - seed.avg) - Math.abs(b.avg - seed.avg));
      const T = [[seed], []], size = [seed.ids.length, 0], sum = [seed.avg * seed.ids.length, 0];
      for (const e of cands) {
        const k = e.ids.length;
        const fit = [0, 1].filter((t) => size[t] + k <= n);
        if (!fit.length) continue;
        const t = fit.length === 2 ? (sum[0] <= sum[1] ? 0 : 1) : fit[0];
        T[t].push(e);
        size[t] += k;
        sum[t] += e.avg * k;
        if (size[0] === n && size[1] === n) break;
      }
      if (size[0] !== n || size[1] !== n) continue;
      queues.set(l, q.filter((e) => !T[0].includes(e) && !T[1].includes(e)));
      startMatch(l, n, T.map((es) => es.flatMap((e) => e.ids.map((id) => ({ id, elo: (e.elos[id] || { elo: 500 }).elo })))));
      break;
    }
  }
}
function startMatch(l, n, teams) {
  const id = code6();
  const M = { id, l, n, teams, picks: { 1: null, 2: null }, until: Date.now() + PICK_S * 1000 };
  matches.set(id, M);
  const pubT = teams.map((t) => t.map((p) => ({ name: (players.get(p.id) || {}).name || '?', elo: p.elo })));
  teams.forEach((t, i) => t.forEach((p) => {
    const pl = players.get(p.id);
    if (pl) pl.match = id;
    send(p.id, { t: 'match', id, l, team: i + 1, teams: pubT, pool: { maps: MAPS.map((m) => m[0]), eras: ERAS }, secs: PICK_S });
  }));
  M.timer = setTimeout(() => resolve(M), PICK_S * 1000);
}
function teamOf(M, id) {
  return M.teams[0].some((p) => p.id === id) ? 1 : M.teams[1].some((p) => p.id === id) ? 2 : 0;
}
function onPick(id, k) {
  const pl = players.get(id), M = pl && matches.get(pl.match);
  if (!M || !k || typeof k !== 'object') return;
  const t = teamOf(M, id);
  const two = (a, pool) => (Array.isArray(a) ? [...new Set(a.filter((x) => pool.includes(x)))].slice(0, 2) : []);
  const mp = MAPS.map((m) => m[0]);
  const pick = { maps: two(k.maps, mp), eras: two(k.eras, ERAS), bm: mp.includes(k.bm) ? k.bm : '', be: ERAS.includes(k.be) ? k.be : '', lock: k.lock === 1 };
  M.picks[t] = pick;
  // only my team sees it
  for (const p of M.teams[t - 1]) if (p.id !== id) send(p.id, { t: 'tpick', pick, by: pl.name });
  if (M.picks[1] && M.picks[1].lock && M.picks[2] && M.picks[2].lock) resolve(M);
}
function draw(picks, bans, pool) {
  let c = picks.filter((x) => !bans.includes(x));
  if (!c.length) c = pool.filter((x) => !bans.includes(x));
  return c[crypto.randomInt(0, c.length)];
}
function resolve(M) {
  if (!matches.has(M.id)) return;
  clearTimeout(M.timer);
  matches.delete(M.id);
  const P = [M.picks[1] || { maps: [], eras: [], bm: '', be: '' }, M.picks[2] || { maps: [], eras: [], bm: '', be: '' }];
  const bans = { maps: [P[0].bm, P[1].bm].filter(Boolean), eras: [P[0].be, P[1].be].filter(Boolean) };
  const map = draw([...P[0].maps, ...P[1].maps], bans.maps, MAPS.map((m) => m[0])), era = draw([...P[0].eras, ...P[1].eras], bans.eras, ERAS);
  const mm = MAPS.find((m) => m[0] === map), blitz = M.l[0] === 'b';
  const set = { map: mm[1], reg: mm[2], era, gm: 'klasik', dif: 'srednje', cs: 0, peace: blitz ? 60 : 180, res: blitz ? 0 : 1, tree: blitz ? 0 : 1, nn: 0, days: 1, pub: 0, fast: blitz ? 1 : 0, teams: '0', aw: 0, lg: M.n };
  const slots = [];
  M.teams.forEach((t, i) => t.forEach((p) => {
    const pl = players.get(p.id);
    slots.push({ uid: /^\d+$/.test(p.id) ? 'acct' + p.id : p.id.replace(/^dev/, ''), lid: p.id, name: (pl && pl.name) || 'Igrač', team: i + 1, away: true });
  }));
  const gm = long.newLeague(set, slots, { l: M.l, match: M.id }, WAIT_S * 1000);
  const msg = { t: 'reveal', picks: { 1: P[0], 2: P[1] }, bans, chosen: { map, era }, code: gm.rec.code, at: gm.rec.start };
  for (const t of M.teams) for (const p of t) {
    const pl = players.get(p.id);
    if (pl) pl.match = '';
    send(p.id, msg);
  }
}
/* the long game ended (the server's simulation): the result for the ratings */
long.hooks.over = async (gm, st) => {
  const rec = gm.rec, lg = rec.league;
  if (!lg || lg.res || !st.lg) return null;
  const kicked = st.kicked || [], now = Date.now();
  const teams = [[], []];
  rec.slots.forEach((s, i) => {
    const left = !!s.left || kicked.includes(i) || (s.away && now - (s.awayAt || now) > AWAY_LEFT);
    teams[s.team - 1].push({ id: s.lid, left });
  });
  const res = { code: rec.code, l: lg.l, winner: st.lg.team, why: st.lg.why, secs: Math.round(st.tick / 10), map: rec.set.reg, era: rec.set.era, teams };
  try {
    lg.res = await report(res);
  } catch (e) {
    console.warn('league result', rec.code, e.message);
    return null;
  }
  return lg.res;
};

setInterval(matchmake, 1000);

/* one connection to the league lobby */
function handle(ws, q, account) {
  let id = '';
  const bye = setTimeout(() => !id && ws.terminate(), 8000);
  let n = 0, t0 = Date.now();
  ws.on('message', async (buf) => {
    if (Date.now() - t0 > 1000) (t0 = Date.now()), (n = 0);
    if (++n > 10) return ws.terminate();
    let m;
    try {
      m = JSON.parse(buf);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (!id) {
      const h = m.hello;
      if (!h || typeof h.uid !== 'string' || !/^[A-Za-z0-9]{12,40}$/.test(h.uid) || ws._hello) return;
      ws._hello = true;
      const acct = await account();
      if (ws.readyState !== 1) return;
      if (!acct && API_INT) return ws.close(4401, 'login');
      id = acct || 'dev' + h.uid;
      clearTimeout(bye);
      const old = players.get(id);
      if (old && old.ws && old.ws !== ws) old.ws.close(4000, 'other tab');
      const pl = Object.assign(old || { id, party: '', match: '' }, { ws, name: (typeof h.name === 'string' && h.name.replace(/[\u0000-\u001f<>]/g, '').slice(0, 18)) || 'Igrač' });
      players.set(id, pl);
      let el = {};
      try {
        const ls = ['b1', 'b2', 'b5', 'f1', 'f2', 'f5'];
        const all = await Promise.all(ls.map((l) => elos([id], l)));
        ls.forEach((l, i) => (el[l] = all[i][id]));
        if (el.b1 && el.b1.name) pl.name = el.b1.name;
      } catch (e) {
        el = null;
      }
      send(id, { t: 'hi', me: id, name: pl.name, elo: el });
      const pt = partyOf(id);
      if (pt) partyCast(pt);
      return;
    }
    if (typeof m.party === 'string') {
      if (m.party === '') return leaveParty(id);
      if (m.party === 'new') {
        leaveParty(id);
        const pt = { code: code6(), lead: id, members: [id] };
        parties.set(pt.code, pt);
        players.get(id).party = pt.code;
        return partyCast(pt);
      }
      const pt = parties.get(m.party);
      if (!pt) return send(id, { t: 'err', e: 'Taj party više ne postoji.' });
      if (pt.members.includes(id)) return partyCast(pt);
      if (pt.members.length >= 5) return send(id, { t: 'err', e: 'Party je pun (5).' });
      leaveParty(id);
      unqueue(pt.members);
      pt.members.push(id);
      players.get(id).party = pt.code;
      return partyCast(pt);
    }
    if (m.queue && typeof m.queue === 'object') {
      const mode = m.queue.m === 'f' ? 'f' : 'b', size = SIZES.includes(m.queue.n) ? m.queue.n : 1;
      return enqueue(id, mode, size);
    }
    if (m.unqueue) return unqueue([id]);
    if (m.pick) return onPick(id, m.pick);
  });
  ws.on('close', () => {
    clearTimeout(bye);
    const pl = id && players.get(id);
    if (!pl || pl.ws !== ws) return;
    pl.ws = null;
    unqueue([id]);
    // gone for a minute: out of the party too
    setTimeout(() => {
      const p = players.get(id);
      if (p && !p.ws) {
        leaveParty(id);
        if (!p.match) players.delete(id);
      }
    }, 60e3);
  });
  ws.on('error', () => {});
}

module.exports = { handle, MAPS, ERAS };

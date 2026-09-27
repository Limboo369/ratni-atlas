'use strict';
/* Accounts API test (deploy/api/server.js) against a real PostgreSQL and a fake Google key server.
   Database: the PG* variables when PGHOST is set (CI service), otherwise a throwaway local cluster (initdb).
   node build/test_api.js */
const path = require('path');
const { startApi, token, evil, CLIENT_ID } = require(path.join(__dirname, 'api_fixture.js'));

const ORIGIN = 'http://game.test';
const fails = [];
const check = (ok, msg) => {
  console.log((ok ? 'OK   ' : 'FAIL ') + msg);
  if (!ok) fails.push(msg);
};

async function main() {
  // web push: the fake push service below is on 127.0.0.1 (plain http, only in tests)
  Object.assign(process.env, { PUSH_HOSTS: '127.0.0.1,fcm.googleapis.com', PUSH_ALLOW_HTTP: '1' });
  const f = await startApi(ORIGIN);
  const base = f.base;
  let jar = '';
  async function call(method, p, body, o = {}) {
    const headers = { 'x-real-ip': '10.0.0.1', ...(o.headers || {}) };
    if (method === 'POST') {
      if (!('origin' in headers)) headers.origin = ORIGIN;
      if (!('content-type' in headers)) headers['content-type'] = 'application/json';
    }
    if (o.cookie !== undefined ? o.cookie : jar) headers.cookie = o.cookie !== undefined ? o.cookie : jar;
    const r = await fetch(base + p, { method, headers, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body || {})) : undefined });
    const sc = r.headers.get('set-cookie');
    if (sc && o.keep !== false) jar = sc.split(';')[0];
    let j = null;
    try {
      j = await r.json();
    } catch {}
    return { status: r.status, j, sc };
  }

  try {
    let r = await call('GET', '/api/health');
    check(r.status === 200, 'health answers with the database up');
    r = await call('GET', '/api/me');
    check(r.status === 200 && r.j.user === null && r.j.google === CLIENT_ID, 'signed out: no user, client id for the page');

    // refused before any token check
    r = await call('POST', '/api/login', { credential: token() }, { headers: { origin: 'https://evil.test' } });
    check(r.status === 403, 'login from another origin refused (CSRF)');
    r = await call('POST', '/api/login', { credential: token() }, { headers: { 'content-type': 'text/plain' } });
    check(r.status === 415, 'login that is not JSON refused');
    r = await call('POST', '/api/login', '{"credential":"' + 'x'.repeat(70000) + '"}');
    check(r.status === 413, 'oversized body refused');

    // bad tokens
    const bad = [
      ['foreign signing key', token({}, { key: evil })],
      ['unknown key id', token({}, { kid: 'nope' })],
      ['another app (aud)', token({ aud: 'other.apps.googleusercontent.com' })],
      ['wrong issuer', token({ iss: 'https://evil.test' })],
      ['expired', token({ exp: Math.floor(Date.now() / 1000) - 600 })],
      ['alg none', token({}, { alg: 'none' })],
      ['garbage', 'a.b.c'],
    ];
    for (const [what, t] of bad) {
      r = await call('POST', '/api/login', { credential: t }, { keep: false, headers: { 'x-real-ip': '10.0.0.2' } });
      check(r.status === 401 && !r.sc, 'refused token: ' + what);
    }
    let codes = [];
    for (let i = 0; i < 11; i++) codes.push((await call('POST', '/api/login', { credential: 'a.b.c' }, { keep: false, headers: { 'x-real-ip': '10.0.0.3' } })).status);
    check(codes[9] === 401 && codes[10] === 429, 'more than 10 logins a minute from one address refused: ' + codes.slice(8).join(','));

    // good login
    r = await call('POST', '/api/login', { credential: token() });
    check(r.status === 200 && r.j.user && r.j.user.name === 'Darko', 'login with a valid Google token');
    check(/HttpOnly/.test(r.sc) && /SameSite=Lax/.test(r.sc) && /Max-Age=\d{6,}/.test(r.sc), 'session cookie is HttpOnly, SameSite=Lax, long-lived: ' + (r.sc || '').replace(/ot=[^;]+/, 'ot=…'));
    const id = r.j.user && r.j.user.id, cookie1 = jar;
    r = await call('GET', '/api/me');
    check(r.j.user && r.j.user.id === id && r.j.user.email === 'darko@example.com', 'the cookie signs the page in');
    r = await call('GET', '/api/me', null, { cookie: 'ot=' + 'A'.repeat(43) });
    check(r.j.user === null, 'a made-up session token is nobody');

    // name
    r = await call('POST', '/api/name', { name: '  Vojvoda <b>Darko</b>  ' });
    check(r.status === 200 && r.j.user.name === 'Vojvoda bDarko/b', 'rename, cleaned: ' + (r.j.user && r.j.user.name));
    check(r.j.user && r.j.user.icon === 'stit' && r.j.user.since, 'default emblem without a Google picture; member since');
    r = await call('POST', '/api/icon', { icon: 'kruna' });
    check(r.status === 200 && r.j.user.icon === 'kruna', 'emblem changed');
    r = await call('POST', '/api/icon', { icon: 'google' });
    check(r.status === 400, 'Google picture as emblem refused when there is none');
    r = await call('POST', '/api/icon', { icon: '<svg>' });
    check(r.status === 400, 'unknown emblem refused');
    r = await call('POST', '/api/name', { name: 'x' });
    check(r.status === 400, 'one-letter name refused');
    r = await call('POST', '/api/name', { name: 'Tuđin' }, { cookie: '' });
    check(r.status === 401, 'rename without a session refused');

    // second device: same Google account → same user, own name kept
    r = await call('POST', '/api/login', { credential: token({ given_name: 'Drugo' }) });
    check(r.j.user && r.j.user.id === id && r.j.user.name === 'Vojvoda bDarko/b', 'second device gets the same account and keeps the chosen name');
    const cookie2 = jar;
    check(cookie1 !== cookie2, 'each device has its own session');

    // logout ends only that session
    r = await call('POST', '/api/logout', {});
    check(r.status === 200 && /Max-Age=0/.test(r.sc), 'logout clears the cookie');
    r = await call('GET', '/api/me', null, { cookie: cookie2 });
    check(r.j.user === null, 'logged-out session no longer works');
    r = await call('GET', '/api/me', null, { cookie: cookie1 });
    check(r.j.user && r.j.user.id === id, 'the other device stays signed in');

    // another person
    r = await call('POST', '/api/login', { credential: token({ sub: '2002', given_name: 'Ana', email: 'ana@example.com' }) });
    check(r.j.user && r.j.user.id !== id && r.j.user.name === 'Ana', 'another Google account is another user');
    const cookieAna = jar;

    // results, statistics, achievements, leaderboard
    const game = (o) => ({ gid: 'g' + Math.random().toString(36).slice(2, 10), online: false, mode: 'solo', map: 'evropa', region: 'balkan', era: 'danas', gm: 'klasik', start: 'granice', difficulty: 'srednje', won: false, secs: 900, peak: 20, cities: 3, kills: 1, conquered: 2, nukes: 0, players: 1, ...o });
    jar = cookie1;
    r = await call('POST', '/api/result', game(), { cookie: '' });
    check(r.status === 401, 'result without a session refused');
    r = await call('POST', '/api/result', game({ era: 'marsovci' }));
    check(r.status === 400, 'result with an unknown era refused');
    r = await call('POST', '/api/result', game({ won: true, secs: 20 }));
    check(r.status === 400, 'a 20-second win refused');
    r = await call('POST', '/api/result', game({ region: 'x y' }));
    check(r.status === 400, 'result with a bad region name refused');
    r = await call('POST', '/api/result', game());
    check(r.status === 200 && r.j.stats.games === 1 && r.j.stats.wins === 0 && r.j.fresh.length === 0, 'a lost game is counted, no achievement');
    const win = game({ won: true, secs: 500, difficulty: 'tesko', nukes: 1, peak: 72.46, cities: 25 });
    r = await call('POST', '/api/result', win);
    const got = (r.j.fresh || []).map((a) => a.id).sort().join(',');
    check(r.status === 200 && r.j.stats.wins === 1 && got === 'carstvo,dugme,munja,opsada,prva,tesko', 'a win unlocks the right achievements: ' + got);
    r = await call('POST', '/api/result', win);
    check(r.status === 200 && r.j.dup && r.j.stats.games === 2 && r.j.fresh.length === 0, 'the same game reported twice counts once');
    r = await call('POST', '/api/result', game({ won: true, online: true, mode: 'coop', map: 'svijet', region: 'svijet', gm: 'br', players: 2 }));
    check(r.j.fresh && r.j.fresh.map((a) => a.id).sort().join(',') === 'online,rame,royale,svijet', 'online co-op battle royale win on the world: ' + (r.j.fresh || []).map((a) => a.id));
    r = await call('GET', '/api/stats');
    const st = r.j.stats || {};
    check(st.games === 3 && st.wins === 2 && st.onlineWins === 1 && st.fastest === 500 && st.peak === 72.5 && st.nukes === 1, 'totals: ' + JSON.stringify(st));
    check(st.rank && st.rank.title === 'Private' && st.rank.next.title === 'Corporal' && st.rank.next.wins === 3, 'status from wins: ' + JSON.stringify(st.rank));
    check(r.j.achievements.length >= 15 && r.j.achievements.filter((a) => a.at).length === 10 && r.j.achievements.every((a) => a.name && a.desc), 'achievement list with names and unlock dates');
    check(r.j.recent.length === 3 && r.j.recent[0].online === true, 'recent games, newest first');
    // Ana: one plain win
    r = await call('POST', '/api/result', game({ won: true }), { cookie: cookieAna });
    r = await call('GET', '/api/top');
    const top = r.j.rows || [];
    check(top.length === 2 && top[0].name === 'Vojvoda bDarko/b' && top[0].icon === 'kruna' && top[0].wins === 2 && top[0].me && top[1].name === 'Ana' && top[1].rank === 2 && !top[1].me, 'leaderboard by wins, my row marked');
    r = await call('GET', '/api/top?by=online', null, { cookie: cookieAna });
    check(r.j.rows.length === 1 && r.j.rows[0].online === 1 && r.j.me === null, 'online leaderboard lists only online winners');
    r = await call('GET', '/api/top', null, { cookie: '' });
    check(r.status === 200 && r.j.rows.length === 2 && r.j.me === null, 'leaderboard is public');

    // "Nastavi igru" on another computer: one saved game per account
    const sv = (o = {}) => ({ rec: { v: 1, gid: 'sabc123', set: { map: 'evropa' }, picks: [5], cmds: [[3, 'atk', [7, 0.2, 0]]], ...o }, tick: 480, at: Date.now(), meta: { where: 'Balkan', who: '<b>x</b>', land: 12.5, secs: 48 } });
    r = await call('GET', '/api/save', null, { cookie: cookieAna });
    check(r.status === 200 && r.j.save === null, 'no saved game yet');
    r = await call('POST', '/api/save', sv(), { cookie: '' });
    check(r.status === 401, 'saving needs sign-in');
    r = await call('POST', '/api/save', sv({ gid: 'x; drop' }), { cookie: cookieAna });
    check(r.status === 400, 'a bad save is refused');
    r = await call('POST', '/api/save', sv({ cmds: Array.from({ length: 12000 }, (_, i) => [i, 'atk', [123456, 0.25, 1, 654321]]) }), { cookie: cookieAna });
    check(r.status === 200, 'a long game (12000 commands, above the normal body limit) is saved');
    r = await call('GET', '/api/save', null, { cookie: cookieAna });
    check(r.j.save && r.j.save.rec.cmds.length === 12000 && r.j.save.tick === 480 && r.j.save.meta.where === 'Balkan', 'the saved game comes back');
    // the server answers 413 and closes before the client has sent it all: the client sees either (EPIPE/reset)
    r = await call('POST', '/api/save', sv({ cmds: Array.from({ length: 60000 }, (_, i) => [i, 'atk', [123456, 0.25, 1, 654321]]) }), { cookie: cookieAna }).catch((e) => ({ status: 'reset', e }));
    check(r.status === 413 || r.status === 'reset', 'a save over 1 MB is refused');
    r = await call('GET', '/api/save', null, { cookie: cookieAna });
    check(r.j.save && r.j.save.rec.cmds.length === 12000, 'the refused save left the old one alone');
    r = await call('GET', '/api/save');
    check(r.j.save === null, "another player does not see Ana's save");
    r = await call('POST', '/api/save/delete', { gid: 'sother' }, { cookie: cookieAna });
    r = await call('GET', '/api/save', null, { cookie: cookieAna });
    check(!!r.j.save, 'deleting another game id keeps the save');
    r = await call('POST', '/api/save/delete', { gid: 'sabc123' }, { cookie: cookieAna });
    r = await call('GET', '/api/save', null, { cookie: cookieAna });
    check(r.status === 200 && r.j.save === null, 'the finished game is deleted');

    // the campaign's progress follows the account
    r = await call('POST', '/api/campaign', { home: 'sarajevo', name: 'Kotromanić', xp: 320, tree: { mil: 1 }, done: { 0: 3, 1: 2 }, at: 5 }, { cookie: cookieAna });
    check(r.status === 200, 'campaign progress saved');
    r = await call('GET', '/api/campaign', null, { cookie: cookieAna });
    check(r.j.campaign && r.j.campaign.home === 'sarajevo' && r.j.campaign.xp === 320 && r.j.campaign.done[0] === 3, 'campaign progress comes back');
    r = await call('POST', '/api/campaign', { home: '../x', tree: {}, done: {} }, { cookie: cookieAna });
    check(r.status === 400, 'a bad campaign is refused');
    r = await call('POST', '/api/campaign', { home: 'sarajevo', name: 'K', color: '#ff4fc3', xp: 1, tree: {}, done: {} }, { cookie: cookieAna });
    r = await call('GET', '/api/campaign', null, { cookie: cookieAna });
    check(r.j.campaign.color === '#ff4fc3', 'the dynasty colour is kept');
    // reporting a player (plan 25)
    r = await call('POST', '/api/report', { game: 'abc123', name: 'Zločko', reason: 'team' }, { cookie: cookieAna });
    check(r.status === 200, 'a player can be reported');
    r = await call('POST', '/api/report', { game: 'abc123', name: 'X', reason: 'spam' }, { cookie: cookieAna });
    check(r.status === 400, 'an unknown report reason is refused');
    r = await call('POST', '/api/report', { game: 'abc123', name: 'X', reason: 'team' }, { cookie: '' });
    check(r.status === 401, 'reporting needs an account');
    // my Focus games on the account (plan 3)
    r = await call('POST', '/api/focus', { code: 'abc123', title: 'Srbija · Balkan · Danas', days: 3, tick: 900, at: 7, snap: { share: 0.12, cities: 4, troops: 5e5, gold: 1e5, allies: 1 } }, { cookie: cookieAna });
    check(r.status === 200, 'a Focus game saved on the account');
    r = await call('GET', '/api/focus', null, { cookie: cookieAna });
    check(r.j.games.length === 1 && r.j.games[0].code === 'abc123' && r.j.games[0].days === 3 && r.j.games[0].snap.cities === 4, 'my Focus games come back (on any computer)');
    r = await call('POST', '/api/focus', { code: '../x' }, { cookie: cookieAna });
    check(r.status === 400, 'a bad Focus code is refused');
    r = await call('POST', '/api/focus', { code: 'abc123', drop: 1 }, { cookie: cookieAna });
    r = await call('GET', '/api/focus', null, { cookie: cookieAna });
    check(r.j.games.length === 0, 'a left or finished Focus game is gone from the account');
    r = await call('GET', '/api/focus', null, { cookie: '' });
    check(r.status === 401, 'Focus list: only signed in');

    // Conquest League (plan phase 16): ratings on the internal port only, per-player ELO, top 100, history
    {
      const anaId = (await call('GET', '/api/me', null, { cookie: cookieAna })).j.user.id;
      const int = async (p, b) => {
        const x = await fetch(f.int + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
        return { status: x.status, j: await x.json().catch(() => null) };
      };
      r = await call('POST', '/int/league/result', {});
      check(r.status === 404, 'league results are not reachable on the public port');
      r = await int('/int/league/elo', { ids: [id, anaId], l: 'b1' });
      check(r.j.elo[id].elo === 500 && r.j.elo[anaId].games === 0, 'league: everybody starts at 500');
      const res = { code: 'lgaaa1', l: 'b1', winner: 1, why: 'elim', secs: 900, map: 'evropa', era: 'ww2', teams: [[{ id }], [{ id: anaId }]] };
      r = await int('/int/league/result', res);
      check(r.j.res[id].delta === 20 && r.j.res[anaId].delta === -20 && r.j.res[id].elo === 520, `league: placement K=40, equal players ±20 (${JSON.stringify(r.j.res)})`);
      r = await int('/int/league/result', res);
      check(r.j.dup && r.j.res[id].elo === 520, 'league: the same game counts once');
      for (let i = 2; i <= 5; i++) await int('/int/league/result', { ...res, code: 'lgaaa' + i });
      r = await int('/int/league/elo', { ids: [id, anaId], l: 'b1' });
      const e5 = r.j.elo[id].elo;
      r = await int('/int/league/result', { ...res, code: 'lgaab6', winner: 2 });
      const up = r.j.res[anaId].delta, down = r.j.res[id].delta;
      check(r.j.res[id].elo === e5 + down && up > 12 && down < -12 && Math.abs(down) < 24, `league: after placement K=24, the favourite loses more (${down}), the underdog wins more (${up})`);
      r = await int('/int/league/result', { ...res, code: 'lgaab7', winner: 1, teams: [[{ id, left: true }], [{ id: anaId }]] });
      check(r.j.res[id].delta < 0, 'league: a player who left loses ELO even when the team won');
      r = await call('GET', '/api/league/top?l=b1', null, { cookie: cookie1 });
      check(r.j.rows.length === 2 && /Darko/.test(r.j.rows[0].name) && r.j.rows[0].rank === 1 && ['Warlord', 'Emperor'].includes(r.j.rows[0].tier) && r.j.me && r.j.me.rank === 1, `league: world ranking ${JSON.stringify(r.j.rows[0])}`);
      r = await call('GET', '/api/league/top?l=f5');
      check(r.j.rows.length === 0, 'league: every ladder separate');
      r = await call('GET', '/api/league', null, { cookie: cookieAna });
      check(r.j.me.b1.games === 7 && r.j.me.b1.rank !== 'Unranked' && r.j.me.b5.rank === 'Unranked', `league: my ladders ${JSON.stringify(r.j.me.b1)}`);
      // a match filled by the computer (Darko 27. 9.): only the player counts, full ELO
      r = await int('/int/league/result', { code: 'lgbot1', l: 'b2', winner: 1, why: 'elim', secs: 600, map: 'evropa', era: 'ww2', teams: [[{ id }], [{ id: 'bot:abc123', bot: true, elo: 500, name: 'Brenna (AI)' }]] });
      check(r.status === 200 && r.j.res[id] && r.j.res[id].delta === 20 && Object.keys(r.j.res).length === 1, `league: against the computer full ELO, the computer is not saved (${JSON.stringify(r.j.res)})`);
      r = await int('/int/league/result', { code: 'lgbot2', l: 'b2', winner: 1, teams: [[{ id: 'bot:aaa', bot: true, elo: 500 }], [{ id: 'bot:bbb', bot: true, elo: 500 }]] });
      check(r.status === 400, 'league: a game of computers only is refused');
      r = await call('GET', '/api/league/history', null, { cookie: cookieAna });
      check(r.j.games.length === 7 && r.j.games[0].code === 'lgaab7' && !r.j.games[0].won && r.j.games[1].won && r.j.games[0].teams[1][0].me, 'league: match history (newest first)');
      const floor = await int('/int/league/elo', { ids: [anaId], l: 'b1' });
      check(floor.j.elo[anaId].elo >= 100, 'league: ELO never under 100');
    }

    // web push (plan phase 18): VAPID key, subscriptions, the encrypted message a push service gets
    {
      const crypto = require('crypto'), http = require('http');
      const got = [];
      const ps = http.createServer((q, res) => {
        const ch = [];
        q.on('data', (b) => ch.push(b));
        q.on('end', () => {
          got.push({ url: q.url, h: q.headers, body: Buffer.concat(ch) });
          res.writeHead(q.url.includes('gone') ? 410 : 201).end();
        });
      });
      await new Promise((ok) => ps.listen(0, '127.0.0.1', ok));
      const ep = `http://127.0.0.1:${ps.address().port}/push/`;
      r = await call('GET', '/api/push/key');
      const key = r.j.key;
      check(Buffer.from(key, 'base64url').length === 65, 'push: the public VAPID key');
      r = await call('GET', '/api/push/key');
      check(r.j.key === key, 'push: the key stays the same (kept in the database)');
      const ua = crypto.createECDH('prime256v1');
      ua.generateKeys();
      const auth = crypto.randomBytes(16);
      const sub = (e) => ({ sub: { endpoint: e, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } });
      r = await call('POST', '/api/push/sub', sub(ep + 'ana1'), { cookie: '' });
      check(r.status === 401, 'push: subscribing needs an account');
      r = await call('POST', '/api/push/sub', sub('https://evil.test/x'), { cookie: cookieAna });
      check(r.status === 400, 'push: only the browsers’ push services');
      r = await call('POST', '/api/push/sub', sub(ep + 'ana1'), { cookie: cookieAna });
      check(r.status === 200, 'push: subscribed');
      await call('POST', '/api/push/sub', sub(ep + 'gone1'), { cookie: cookieAna });
      const anaId = (await call('GET', '/api/me', null, { cookie: cookieAna })).j.user.id;
      const x = await fetch(f.int + '/int/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ users: [anaId], title: 'Overtake', body: 'Srbija ti je objavila rat.', url: '/long-abcdef', tag: 'abcdef' }) });
      const xr = await x.json();
      check(xr.sent === 1 && xr.gone === 1, `push: sent to the device, a dead subscription removed ${JSON.stringify(xr)}`);
      const m = got.find((g) => g.url.endsWith('ana1'));
      // what the browser does: check the VAPID signature, decrypt (RFC 8291)
      const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(m.h.authorization) || [];
      const [h64, c64, s64] = t.split('.');
      const raw = Buffer.from(k, 'base64url');
      const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
      const claims = JSON.parse(Buffer.from(c64, 'base64url'));
      check(k === key && crypto.verify('sha256', Buffer.from(h64 + '.' + c64), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s64, 'base64url')) && claims.aud === new URL(ep).origin && claims.exp > Date.now() / 1000, 'push: VAPID signature and audience are right');
      const b = m.body, salt = b.subarray(0, 16), idlen = b[20], as = b.subarray(21, 21 + idlen), ct = b.subarray(21 + idlen);
      const shared = ua.computeSecret(as);
      const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as]), 32));
      const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
      const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
      const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
      d.setAuthTag(ct.subarray(ct.length - 16));
      const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
      const msg = JSON.parse(plain.subarray(0, plain.length - 1));
      check(m.h['content-encoding'] === 'aes128gcm' && plain[plain.length - 1] === 2 && msg.body === 'Srbija ti je objavila rat.' && msg.url === '/long-abcdef', `push: the message decrypts on the device ${JSON.stringify(msg)}`);
      got.length = 0;
      await fetch(f.int + '/int/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ users: [anaId], body: 'x' }) });
      check(got.length === 1, 'push: the dead subscription is not used again');
      await call('POST', '/api/push/unsub', { endpoint: ep + 'ana1' }, { cookie: cookieAna });
      got.length = 0;
      const y = await (await fetch(f.int + '/int/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ users: [anaId], body: 'x' }) })).json();
      check(y.sent === 0 && got.length === 0, 'push: unsubscribed, nothing sent');
      ps.close();
    }

    // Community market (plan phase 19)
    {
      const data = { map: 'evropa', reg: 'balkan', era: 'ww2', k0: 40, paint: [[1000, 20, 3], [5000, 5, 41]], nat: { 3: { n: 'Nova <b>Srbija</b>', c: '#123456' } }, add: [{ n: 'Hercegovina', c: '#abcdef', cap: 5000 }], slots: [41], rules: { peace: 30, res: 1 } };
      r = await call('POST', '/api/scen/save', { title: 'Balkan 1941', data, pub: true }, { cookie: '' });
      check(r.status === 401, 'market: publishing needs an account');
      r = await call('POST', '/api/scen/save', { title: 'Balkan 1941', data: { ...data, paint: [['x']] }, pub: true }, { cookie: cookieAna });
      check(r.status === 400, 'market: a broken scenario is refused');
      r = await call('POST', '/api/scen/save', { title: 'Balkan 1941', desc: 'Ko drži Hercegovinu?', data, pub: true }, { cookie: cookieAna });
      const code = r.j.code;
      check(r.status === 200 && /^[a-z0-9]{8}$/.test(code), 'market: published ' + code);
      r = await call('POST', '/api/scen/save', { title: 'Moj nacrt', data, pub: false }, { cookie: cookieAna });
      const draft = r.j.code;
      r = await call('GET', '/api/scen/list', null, { cookie: '' });
      check(r.j.rows.some((x) => x.code === code && x.author && x.plays === 0) && !r.j.rows.some((x) => x.code === draft), 'market: everybody sees the public one, not the draft');
      r = await call('GET', '/api/scen/list?mine=1', null, { cookie: cookieAna });
      check(r.j.rows.length === 2, 'market: my scenarios, drafts too');
      r = await call('GET', '/api/scen/get?code=' + code, null, { cookie: '' });
      check(r.j.scen.data.nat[3].n === 'Nova bSrbija/b' && r.j.scen.data.add[0].n === 'Hercegovina' && r.j.scen.data.rules.res === 1 && !r.j.scen.mine, 'market: the scenario comes back cleaned (no markup)');
      r = await call('GET', '/api/scen/get?code=' + draft, null, { cookie: '' });
      check(r.status === 404, 'market: somebody else’s draft stays private');
      r = await call('POST', '/api/scen/save', { code, title: 'Tuđe', data, pub: true }, { cookie: cookie1 });
      check(r.status === 404, 'market: nobody else can change it');
      await call('POST', '/api/scen/play', { code }, { cookie: '' });
      await call('POST', '/api/scen/play', { code }, { cookie: '' });
      r = await call('POST', '/api/scen/like', { code, on: 1 }, { cookie: cookie1 });
      check(r.j.likes === 1, 'market: a like');
      r = await call('GET', '/api/scen/list?sort=top', null, { cookie: cookie1 });
      const row = r.j.rows.find((x) => x.code === code);
      check(row.plays === 1 && row.likes === 1 && row.liked, 'market: plays counted once, likes, "liked" for me');
      r = await call('GET', '/api/scen/list?q=1941', null, { cookie: '' });
      check(r.j.rows.length === 1, 'market: search by title');
      await call('POST', '/api/scen/delete', { code }, { cookie: cookie1 });
      r = await call('GET', '/api/scen/get?code=' + code, null, { cookie: '' });
      check(r.status === 200, 'market: only the author deletes');
      await call('POST', '/api/scen/delete', { code }, { cookie: cookieAna });
      r = await call('GET', '/api/scen/get?code=' + code, null, { cookie: '' });
      check(r.status === 404, 'market: the author deleted it');
    }

    // delete account
    jar = cookie1;
    r = await call('POST', '/api/delete', {});
    check(r.status === 200, 'account deleted');
    r = await call('GET', '/api/me', null, { cookie: cookie1 });
    check(r.j.user === null, 'sessions of a deleted account are gone');
    r = await call('POST', '/api/login', { credential: token() });
    check(r.j.user && r.j.user.id !== id && r.j.user.name === 'Darko', 'signing in again after delete starts a fresh account');
  } finally {
    await f.stop();
  }
  if (f.stderr.trim()) console.log('api stderr (last lines):\n' + f.stderr.trim().split('\n').slice(-8).join('\n'));
  console.log('FAILS:', fails.length ? fails : 'none');
  process.exit(fails.length ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

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

'use strict';
/* Test fixture for the accounts API: a PostgreSQL database (the PG* variables when PGHOST is set, e.g. the CI service;
   otherwise a throwaway local cluster via initdb), a fake Google key server and deploy/api/server.js on a free port.
   Used by build/test_api.js; `node build/api_fixture.js serve` also serves dist/ with /api/ proxied on one origin,
   prints {"url", "tokens"} on one line for build/test_account.py and runs until stdin closes. */
const { spawn, execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const R = path.join(__dirname, '..');
const { Client } = require(path.join(R, 'deploy/api/node_modules/pg'));
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => {
  const s = http.createServer().listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => ok(p));
  });
});

// a throwaway cluster (initdb refuses root, so run it as `postgres` then)
async function localCluster() {
  const bin = ['17', '16', '15', '14'].map((v) => `/usr/lib/postgresql/${v}/bin`).find((d) => fs.existsSync(d + '/initdb'));
  if (!bin) throw new Error('no PostgreSQL: set PGHOST/PGUSER/PGPASSWORD or install postgresql');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otpg-'));
  const root = process.getuid && process.getuid() === 0;
  const as = (cmd, args, opt) => (root ? ['runuser', ['-u', 'postgres', '--', cmd, ...args], opt] : [cmd, args, opt]);
  if (root) execFileSync('chown', ['postgres', dir]);
  execFileSync(...as(bin + '/initdb', ['-D', dir + '/d', '-U', 'postgres', '--auth=trust', '-E', 'UTF8'], { stdio: 'ignore' }));
  const port = await freePort();
  const pg = spawn(...as(bin + '/postgres', ['-D', dir + '/d', '-p', String(port), '-k', dir, '-c', 'listen_addresses=127.0.0.1'], { stdio: 'ignore' }));
  Object.assign(process.env, { PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'postgres', PGDATABASE: 'postgres' });
  delete process.env.PGPASSWORD;
  for (let i = 0; i < 50; i++) {
    const c = new Client();
    try {
      await c.connect();
      await c.end();
      return () => {
        pg.kill('SIGINT');
        setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 1500).unref();
      };
    } catch {
      await sleep(200);
    }
  }
  throw new Error('local PostgreSQL did not start');
}

// fake Google: `good` is served as the JWKS, `evil` is a key Google doesn't know
const good = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const evil = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
function token(claims, o = {}) {
  const now = Math.floor(Date.now() / 1000);
  const c = { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '1001', email: 'darko@example.com', given_name: 'Darko', name: 'Darko D', iat: now, exp: now + 3600, ...claims };
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const data = enc({ alg: o.alg || 'RS256', kid: o.kid || 'k1', typ: 'JWT' }) + '.' + enc(c);
  return data + '.' + crypto.sign('RSA-SHA256', Buffer.from(data), (o.key || good).privateKey).toString('base64url');
}

/* start everything; origins: the ORIGINS the API accepts for POSTs */
async function startApi(origins, log) {
  const stopPg = process.env.PGHOST ? null : await localCluster();
  const dbName = 'ot_test_' + crypto.randomBytes(4).toString('hex');
  const admin = new Client();
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  const jwk = { ...good.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
  const certs = http.createServer((q, s) => {
    s.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' });
    s.end(JSON.stringify({ keys: [jwk] }));
  });
  const certPort = await freePort();
  certs.listen(certPort, '127.0.0.1');
  const port = await freePort(), intPort = await freePort();
  const api = spawn('node', [path.join(R, 'deploy/api/server.js')], {
    env: { ...process.env, PGDATABASE: dbName, PORT: String(port), INT_PORT: String(intPort), GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CERTS_URL: `http://127.0.0.1:${certPort}/certs`, ORIGINS: origins, COOKIE_SECURE: '0' },
    stdio: ['ignore', log || 'inherit', 'pipe'],
  });
  const f = { port, base: `http://127.0.0.1:${port}`, int: `http://127.0.0.1:${intPort}`, db: dbName, stderr: '', token, evil, CLIENT_ID };
  api.stderr.on('data', (b) => {
    f.stderr += b;
    if (log === 'ignore') process.stderr.write(b); // serve mode: the browser test shows API errors
  });
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(f.base + '/api/health')).ok) break;
    } catch {}
    if (api.exitCode !== null) throw new Error('api exited: ' + f.stderr);
    await sleep(100);
  }
  f.stop = async () => {
    api.kill();
    certs.close();
    await sleep(300);
    await admin.query(`drop database if exists ${dbName} with (force)`).catch(() => {});
    await admin.end();
    if (stopPg) stopPg();
  };
  return f;
}

/* dist/ plus /api/ proxied to the API, on one origin (like nginx on the server) */
async function serve() {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const f = await startApi(url, 'ignore');
  const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'application/javascript' };
  const web = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      const p = http.request({ host: '127.0.0.1', port: f.port, path: req.url, method: req.method, headers: { ...req.headers, 'x-real-ip': '127.0.0.1' } }, (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      });
      p.on('error', () => res.writeHead(502).end());
      return req.pipe(p);
    }
    let file = path.join(R, 'dist', decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(path.join(R, 'dist')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(R, 'dist/test.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  web.listen(port, '127.0.0.1');
  const tokens = { darko: token(), ana: token({ sub: '2002', given_name: 'Ana', email: 'ana@example.com' }), evil: token({}, { key: evil }) };
  process.stdout.write(JSON.stringify({ url, tokens, api: f.base, int: f.int }) + '\n');
  process.stdin.resume();
  process.stdin.on('end', async () => {
    web.close();
    await f.stop();
    process.exit(0);
  });
}

module.exports = { startApi, token, evil, CLIENT_ID };
if (require.main === module && process.argv[2] === 'serve') serve().catch((e) => {
  console.error(e);
  process.exit(1);
});

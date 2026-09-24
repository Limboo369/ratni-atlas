# Overtake — pravila za sve agente (Claude Code, Codex)

Browser territory-conquest strategy game (OpenFront.io-style, made better) on a real map of Europe.
Game name **Overtake** (logo: "Over" in the text color, "take" in red `var(--danger)`); the repository stays `ratni-atlas`.
Owner: **Darko** (Bosnia). Talk to him in **Bosnian, ijekavica**, short and concrete. All in-game text is Bosnian (ijekavica).
He plays and tests mostly on an **Android phone** — every screen must work at phone width (375 px).

Who does what: **Codex** — visuals and graphics (UI look, CSS, icons, illustrations, map styling).
**Claude Code** — game logic, AI, online play, server and deploy. Either may touch any file; git keeps it in sync.

## Git (automatically, without asking)

GitHub `Limboo369/ratni-atlas`, branch `main`, is the only source of code. Darko works from several computers.
- Before starting: `git pull --rebase`.
- After every finished and tested change: commit + `git push`. Never leave unpushed work. Never force-push.
- Push rejected → `git pull --rebase`, resolve, push again.
- Codex cloud tasks: open a PR against `main`; merging it publishes the game.

## Publishing

Push to `main` touching `src/`, `build/`, `package/` or `deploy/` → GitHub Actions (`.github/workflows/deploy.yml`) runs the
tests, then builds `dist/test.html` and publishes it as `index.html` on **https://war.deovilab.com**. Nothing else is needed.
Never SSH to the server and never put server credentials anywhere; they live only in GitHub Secrets.

Graphics: prefer inline SVG / CSS inside `src/` — the game is built into one HTML file. If image files are really needed,
say so first: asset delivery (build + deploy + tests) is not wired up yet.

## Server (Contabo, Ubuntu 24.04, shared by several apps on *.deovilab.com)

`deovilab.com` itself is used elsewhere — only subdomains point to this server.
- Host nginx terminates HTTPS (Let's Encrypt, auto-renew) per subdomain and proxies to `127.0.0.1:<port>`.
- Every app is a Docker Compose project in `/srv/apps/<app>`; its ports must be published on 127.0.0.1 only (enforced by
  `deovilab-deploy`).
- `server/setup.sh` (base: SSH key-only, ufw 22/80/443, fail2ban, auto updates, Docker, nginx defaults) runs from
  `.github/workflows/setup.yml` on every push to `server/**`; it is idempotent.
- `server/deploy.sh` is installed as `deovilab-deploy <app> <domain> <port>`: `docker compose up`, certificate, nginx site.
- `.github/workflows/audit.yml` prints the server state (read only).
- Secrets: `SERVER_IP`, `SERVER_SSH_KEY` (root, key only — password login is off), `SERVER_HOST_KEY` (pinned; workflows
  use `StrictHostKeyChecking yes`). Server-side steps are serialized with `flock /run/deovilab.lock`.

| App | Domain | Port | Source |
| --- | --- | --- | --- |
| war | war.deovilab.com | 8101 | this repo, `deploy/compose.yml` |

New app (any repo): a `compose.yml` publishing only `127.0.0.1:<free port>` (deovilab-deploy refuses anything else,
because Docker bypasses ufw), the three secrets above, a deploy workflow that rsyncs to `/srv/apps/<app>/` and runs `deovilab-deploy`, and a DNS A record `<sub>.deovilab.com → server IP` (Darko, Porkbun).
Add the row to the table.

Online play: `deploy/game/server.js` (Node + `ws`, service `game` in the `war` compose project, behind `/ws`) relays
presence per private room; `src/09a-net.js` keeps the lockstep protocol. Every game has its own link `/game-<code>`
(invite + come back to the same seat after a reload; the server keeps a player's presence and the game's command log
for 10 min). Spectators replay the server's log. Presence from other players is untrusted (`RA.Net.str`, `G.exec`).

## Layout

| Path | What |
| --- | --- |
| `src/*.js` | Game code. Concatenated in **filename order** into one function by `build/make.py` (`00-util` … `09a-net`). |
| `src/body.html`, `src/style.css` | Markup and styles. |
| `build/make.py` | Builds `dist/ratni-atlas.html` (artifact body) and `dist/test.html` (standalone page; published as `index.html`). |
| `build/prep.py`, `build/world.py` | Map data from Natural Earth → `build/mapdata_core.json`, `build/mapdata.js` (grid 480×632, lon −11…41, lat 33…71.3). |
| `build/eras.py` | Historical borders per era → `build/eradata.js` (polities, capitals, city renames, owner raster). |
| `build/svijet/` | World map (`prep.py svijet`, `world.py svijet`, `eras.py --map svijet`; Bosnian names in `build/names_bs.py`): `map.json` + `era_<id>.json`, served from `/data/svijet/` and loaded only when the player picks Svijet. |
| `scripts/fetch_data.sh` | Downloads the raw GeoJSON sources into `data/` (not in git). |
| `build/test_*.py`, `build/sim_eras.py` | Playwright tests and AI balance runs (Leaflet served from `package/dist/leaflet.js`). |
| `build/sim_node.js` | Fast AI-only balance runs in node: `node build/sim_node.js era:start:gm:region:maxMin:seed:diff[:pick]`. |
| `deploy/` | Docker Compose project of the game on the server (`public/` is filled by the deploy workflow). |
| `server/` | Server setup and the `deovilab-deploy` helper. |

Build: `python3 build/make.py` (on Windows: `python -X utf8 build/make.py`).
Rebuild era data: `scripts/fetch_data.sh && python3 build/eras.py`.

## Rules that keep the game correct

- **Deterministic simulation** (10 ticks/s) — online play is lockstep. In sim code never use `Math.random`, `Math.pow`,
  `Math.hypot`, trig or `Date`; use `G.rng`, `RA.dpow`, `RA.dist`, `RA.dsin`/`RA.dcos`, `RA.snap`.
- **Every human action goes through `G.exec(pid, kind, args)`** (`src/02d-commands.js`); UI calls `ui.act(kind, args)`.
  Args from other devices are validated there.
- **Eras** (`src/04b-eras.js`): `RA.applyEra(id)` swaps `RA.UNIT` / `RA.STRUCT` / `RA.MISSILE`. Unavailable entries are
  flagged **`na: true`** — never `off` (`off` is the units' offense multiplier).
- Battle royale ring: `src/02e-zone.js` (`G.zone`, `G.zoneOut(c)`).
- Borders start: `RA.eraMap` + `RA.regionMap` + `RA.newGame(..., {start: 'granice'})`; the human takes a whole country
  with `RA.takeBorders`.
- Internal names stay as they are (`RA` namespace, storage keys, room ids, file names) — renaming them breaks saves and online play.

## Tests (CI runs `make.py`, `test_ui2.py`, `test_mp.py` and `test_world.py` before every publish; a failed check blocks it)

```
python3 build/make.py
python3 build/test_ui2.py phone balkan     # single player, end to end
python3 build/test_mp.py                   # three browsers + the real relay: lockstep, spectator, come-back
python3 build/test_world.py                # world map over http: switch, regions, play, online on the world
python3 build/test_eras.py 1200            # every era + battle royale
python3 build/sim_eras.py rim:granice:klasik:evropa:DAC:30:11:srednje   # AI balance run
```

## Open work (v0.5)

- Online test of eras + battle royale (`test_mp.py` with era settings).
- World: Russia is inflated by the Mercator grid (29% of land cells) and wins most world games; world games can stall at ~33% (many players).
- World: only 'danas' exists; historical world eras (era_<id>.json) come next.

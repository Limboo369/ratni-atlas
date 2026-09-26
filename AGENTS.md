# Overtake — pravila za sve agente (Claude Code, Codex)

Browser territory-conquest strategy game (OpenFront.io-style, made better) on a real map of Europe.
Game name **Overtake** (logo: "Over" in the text color, "take" in red `var(--danger)`); the repository stays `ratni-atlas`.
Owner: **Darko** (Bosnia). Talk to him in **Bosnian, ijekavica**, short and concrete. All in-game text is Bosnian (ijekavica).
The game is played **mostly on a computer** (desktop browser, mouse and keyboard): design and polish for that first.
It must still work well on an **Android phone** — every screen must also work at phone width (375 px).

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

Campaign: `src/08k-campaign.js` (screen, missions, goals; progress in localStorage `ra_campaign` and `/api/campaign`),
`src/09d-campaign-app.js` (starting a mission), `src/02j-campaign.js` (sim: `opts.camp` sets the mission up and applies
the dynasty's tree bonuses `p.bGold`, `p.bGrow`, `p.bCost`).

Game modes (start screen `#paceSeg`, `settings.pace`, `RA.MODES` in `src/08-ui.js`): **Blitz** and **Focus** are presets of
the rules (tempo, tech tree, resources, nukes, peace); **Make your choice** (`pace: 'custom'`) lets the player set them all
in the operation dialog (`cPace`, `tree`, `noNuke`, `res`, `peace`). Map, era, start, game type and difficulty are free in
every mode. Every new game takes its rules from `ui.playSet()`. Focus creates a long game (below) of ~1/3/7 days
(`settings.days` → `set.days`, the clock is `LONG_TICK_MS × days`). My Focus games are listed in localStorage `ra_focus`
("Nastavi Focus igru"; the main menu or closing the tab keeps them, a finished game drops out); "Napusti igru" asks twice,
then sends `{leave: 1}` (the server clears the seat's uid, the computer keeps the state). Coming back shows "Dok te nije
bilo" (`ui.focusReport`, from the last snapshot of my state).
Tech tree (`opts.tree`, `src/03b-tech.js`): command `'tech'` (eco/mil/sci/dip, 5 levels, 200k × 2^level), multiplies
`p.bGold`/`p.bGrow`/`p.bCost` on top of the campaign's bonuses; the AI researches too. `opts.noNuke` refuses nuclear weapons.
Start screen: `#sideSeg` = **Conqueror** (solo, `.solo-only`: modes, campaign, tutorial; no account needed) or **Online**
(`.online-only`: `#leagueBtn` Conquest League, `#skirmishBtn` Skirmish — both still to come — and `#onlineToggle` private
room). Online needs an account: `ui.needAccount(fn)` opens the sign-in sheet first; the relay (`REQUIRE_LOGIN=1`,
`API_URL`) asks `/api/me` about the `ot` cookie before a room's hello and closes a signed-out socket with 4401.
The server plays every Focus game itself: `deploy/game/simhost.js` (worker thread) runs `dist/sim/sim.js` (= `src/00–04`,
built by `make.py`) with the same `RA.longGame` / `RA.longApply` (`src/04c-longsim.js`) as the page, game by game after
`RA.applyEra`; it records the end (`rec.over`) and answers `{sim: 1}` with the tick and checksum. So `src/00–04` must stay
browser-free (no DOM) — it runs in node too.
Opinions remember their reasons: change `o.rel[id]` only through `G.relTo(o, id, value, why)` (reasons in `o.why`, labels
`RA.WHY`, shown in the country sheet). Timers people read go through `RA.dur(ticks)` (real time in Focus: `RA.TICK_REAL`).
Focus orders while away: command `'stance'` (`p.stance`: def / eco / atk + target; the AI follows it when it plays a
human's state). Signed in, a Focus seat belongs to the account (`acct<id>`, resolved by the relay from the `ot` cookie) and
the list of my Focus games is on the account (`/api/focus`).
Offers and demands (`src/02l-offers.js`): commands `'offer'` [to, give, want] and `'offerRes'` [id, yes|no|counter, give,
want]; a bundle is {g gold, t troops (allies only), c city index (with its land), r resource slot (supply for a while,
`p.giftRes`), s strait index (open it)}; a computer state answers at once (accept, counter for more gold, refuse).
Long games (days): `deploy/game/long.js` (same server, `/ws?long=<code>`, link `/long-<code>`) is only the clock (one tick
every `LONG_TICK_MS`, 5 s) and the archive (settings, seed, every command with its tick; files in the `longgames`
volume); `src/09c-long.js` replays the record to the server's tick and follows it. A player takes over a computer state
('join'); their last tab closing hands it to the computer ('ai'), coming back returns it ('back').

Accounts: `deploy/api/server.js` (Node + `pg`, service `api`, behind `/api/`) with PostgreSQL (service `db`, volume
`pgdata`; daily `pg_dump` by service `backup` into `/srv/backups/war`, kept 14 days). Sign-in with Google only: the page
(`src/08e-account.js`) loads Google Identity Services when the account sheet opens and posts the ID token to `/api/login`;
the API checks it against Google's keys (RS256, `aud` = `GOOGLE_CLIENT_ID` in `deploy/compose.yml`) and sets an HttpOnly
session cookie `ot` (90 days). The Google Cloud client must list `https://war.deovilab.com` as an authorized JavaScript
origin. The database password lives only in `/srv/apps/war/db.env` on the server (made by the deploy workflow once).
Without `/api/` (file://, tests) the account button stays hidden and the game works as before.
Save and continue (`src/09b-save.js`): a single-player game is kept as its record (`G.rec`: settings, seed, spawn picks,
every `ui.act` command with its tick) in localStorage `ra_save` and, signed in, `/api/save`; resuming replays it, so the
sim must stay deterministic and every player action must go through `ui.act`.
Profile, results, achievements and leaderboard: `deploy/api/stats.js` (the page reports each finished game once, by
`G.gid`; achievements and rank are derived on the server from the results; results are self-reported, so only sanity
limits apply). Emblem ids are shared by `RA.EMBLEMS` (`src/08e-account.js`) and `ICONS` (`deploy/api/server.js`).

## Layout

| Path | What |
| --- | --- |
| `src/*.js` | Game code. Concatenated in **filename order** into one function by `build/make.py` (`00-util` … `09a-net`). |
| `src/body.html`, `src/style.css` | Markup and styles. |
| `build/make.py` | Builds `dist/ratni-atlas.html` (artifact body) and `dist/test.html` (standalone page; published as `index.html`). |
| `build/prep.py`, `build/world.py` | Map data from Natural Earth → `build/mapdata_core.json`, `build/mapdata.js` (grid 480×632, lon −11…41, lat 33…71.3). |
| `build/eras.py` | Historical borders per era → `build/eradata.js` (polities, capitals, city renames, owner raster). |
| `build/svijet/` | World map (`prep.py svijet`, `world.py svijet`, `eras.py --map svijet --era <id>` or `--era all`; Bosnian names in `build/names_bs.py`): `map.json` + `era_<id>.json`, served from `/data/svijet/` and loaded only when the player picks Svijet. |
| `build/eras_world/` | One table per world era (`<id>.py`: polities, capitals, paints, renames); format and workflow in its `README.md`. |
| `build/deposits.js` | Resource deposits at real places (lat/lon lists) → `src/01b-deposits.js` in grid cells per map (`node build/deposits.js`). |
| `scripts/fetch_data.sh` | Downloads the raw GeoJSON sources into `data/` (not in git). |
| `build/test_*.py`, `build/sim_eras.py` | Playwright tests and AI balance runs (Leaflet served from `package/dist/leaflet.js`). |
| `build/sim_node.js` | Fast AI-only balance runs in node: `node build/sim_node.js era:start:gm:region:maxMin:seed:diff[:pick]`. |
| `deploy/` | Docker Compose project of the game on the server (`public/` is filled by the deploy workflow): `game/` relay, `api/` accounts, `nginx.conf`. |
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
- Resources (option `opts.res`): `src/02g-resources.js` (`G.deps`, `p.res`, `p.imp`; `G.hasRes`, `G.unitCost`, `G.structCost`,
  `G.missileCost(type, p)` — always pass the player, never `G.me`, in sim/AI code).
- Straits and canals: `src/02f-straits.js` (`RA.STRAITS[mapId]`, lines in grid cells; ships cross them even where the grid
  shows land; `G.seaFor(c, pid)` in every sea search; seas joined by straits share `G.wroot`).
- Land shares (win, leader, army cap) use real area: `p.area` / `G.landTotal()`, cell weights `map.aw` (1 in Europe; on the
  Mercator world `meta.areaWeight` ∝ cos² lat). Winning is always 70% of the land (`G.winShare()`, no overtime drop; the
  winner may play on, `G.continued`); only the anti-giant rules scale with `meta.winShare` (`G.shareK()`).
- World era tables may `SPLIT` one huge dataset culture area between several polities (nearest anchor, noisy borders);
  polity keys must be unique per era (Europe's keys are in the same table).
- Borders start: `RA.eraMap` + `RA.regionMap` + `RA.newGame(..., {start: 'granice'})`; the human takes a whole country
  with `RA.takeBorders`.
- Internal names stay as they are (`RA` namespace, storage keys, room ids, file names) — renaming them breaks saves and online play.

## Tests (CI runs `make.py`, `test_ui2.py` (phone and desktop), `test_mp.py`, `test_world.py`, `test_api.js`, `test_account.py` and `test_tutorial.py` before every publish; a failed check blocks it)

```
python3 build/make.py
python3 build/test_ui2.py phone balkan     # single player, end to end (also `desktop balkan`: the right-drag attack arrow)
python3 build/test_mp.py                   # three browsers + the real relay: lockstep, spectator, come-back
python3 build/test_long.py                 # long games (days): real server with a fast clock, join, leave, come back, restart
python3 build/test_campaign.py desktop     # campaign: dynasty, mission, XP, tech tree, failure, survive (also `phone`)
python3 build/test_world.py                # world map over http: switch, regions, play, online on the world
node build/test_sim.js                     # sim rules without a browser: straits and canals, determinism
python3 build/test_save.py klasik          # save + reload + "Nastavi igru": the replayed game is identical (also `granice`)
node build/test_api.js                     # accounts API: Google token checks, sessions, rename, delete (real PostgreSQL)
python3 build/test_account.py              # sign-in on the start screen (fake Google), reload keeps the session, logout
python3 build/test_tutorial.py desktop     # the guided tutorial, step by step (also `phone`)
python3 build/test_eras.py 1200            # every era + battle royale
python3 build/sim_eras.py rim:granice:klasik:evropa:DAC:30:11:srednje   # AI balance run
```

## Open work (v0.5)

- Online test of eras + battle royale (`test_mp.py` with era settings).
- World eras: sparse datasets (Americas/Siberia in 100 and 1400) leave free land; keep NEAR_MAX small there (see build/eras_world/srednji.py).

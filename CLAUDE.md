# Ratni Atlas — notes for Claude

Browser territory-conquest strategy game (OpenFront.io-style, made better) on a real map of Europe.
Owner: **Darko** (Bosnia). Talk to him in **Bosnian, ijekavica**, short and concrete. All in-game text is Bosnian (ijekavica).
He plays and tests mostly on an **Android phone** — every screen must work at phone width.

- Living plan with all his decisions (items 1–67 from the ideas list, UI/UX, server): https://claude.ai/code/artifact/165734ed-94a2-469d-9c8f-fcf9cc122ce7
  (snapshot in `docs/PLAN.md`). Do not add things he rejected there.
- Current public build: private claude.ai artifact https://claude.ai/artifact/978GoCbiKGTJjrKhQnrwoS (v0.4). Republish the same URL, never a new one.
- Next step agreed with Darko: own server (Contabo VPS + his domain). Claude cloud sessions cannot reach arbitrary hosts
  (SSH and unknown HTTPS are blocked by the egress proxy), so the server is set up and deployed through **GitHub Actions**
  from this repository; server credentials live only in GitHub Secrets, never in chat.

## Git (automatski, bez pitanja)

Darko radi s više računara; GitHub (`Limboo369/ratni-atlas`, `main`) je jedini izvor koda.
- Na početku sesije: `git pull --ff-only` (hook u `.claude/settings.json` to radi sam; ako padne, riješi prije rada).
- Nakon svake završene i testirane promjene: commit + `git push`, bez pitanja. Nikad ne ostavljaj nepushane promjene na kraju odgovora.

## Server (postavljen 2026-09-24)

https://war.deovilab.com — Contabo, Ubuntu 24.04, Nginx + Let's Encrypt, ufw (22/80/443), fail2ban, SSH samo ključem.
- `server/setup.sh` ← `.github/workflows/setup.yml` (ručno, smije se ponavljati).
- `.github/workflows/deploy.yml`: svaki push u `src/` ili `build/` na `main` gradi `dist/test.html` i šalje ga kao `index.html`.
- Tajne: `SERVER_IP`, `SERVER_SSH_KEY` (lozinka za SSH više ne radi); varijabla `DOMAIN`.
- Online igra (`09a-net.js`) koristi claude.ai sobu pa na domenu ne radi dok ne napravimo vlastiti game server (sljedeći korak).

## Layout

| Path | What |
| --- | --- |
| `src/*.js` | Game code. Concatenated in **filename order** into one function by `build/make.py` (`00-util` … `09a-net`). |
| `src/body.html`, `src/style.css` | Markup and styles. |
| `build/make.py` | Builds `dist/ratni-atlas.html` (artifact body) and `dist/test.html` (standalone page for tests). |
| `build/prep.py`, `build/world.py` | Map data from Natural Earth → `build/mapdata_core.json`, `build/mapdata.js` (grid 480×632, lon −11…41, lat 33…71.3). |
| `build/eras.py` | Historical borders per era → `build/eradata.js` (polities, capitals, city renames, owner raster). Previews in `build/shots/era_*.png`. |
| `scripts/fetch_data.sh` | Downloads the raw GeoJSON sources into `data/` (not in git). |
| `build/test_*.py`, `build/sim_eras.py` | Playwright tests and AI balance runs (Leaflet served from `package/dist/leaflet.js`). |

Build: `python3 build/make.py`. Rebuild era data: `scripts/fetch_data.sh && python3 build/eras.py`.

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

## Tests (run before publishing)

```
python3 build/make.py
python3 build/test_ui2.py phone balkan     # single player, end to end
python3 build/test_eras.py 1200            # every era + battle royale
python3 build/test_mp.py                   # two browsers, online lockstep (mock room)
python3 build/sim_eras.py rim:granice:klasik:evropa:DAC:30:11:srednje   # AI balance run
```

## Open work (v0.5)

- Balance: Rome (AI) wins in ~5 min; small states die in the first minutes of a borders game; 1914 games last ~10 min.
- Online test of eras + battle royale (`test_mp.py` with era settings).
- Then deploy to the new server.

# World era tables

One file per era of the world map: `<eraId>.py` (ids as in `src/04b-eras.js`: rim, srednji, napoleon, ww1, ww2, hladni, danas).
`python build/eras.py --map svijet --era <id>` (or `--era all`) turns it into `build/svijet/era_<id>.json`
(`{pol: [{k, n, x, y, cap, c}], own, ren}`) and the preview `build/shots/world_<id>.png`. The game offers an era on the
world only when its json exists. Europe's tables stay in `build/eras.py` (→ `build/eradata.js`).

## Format

```python
SRC = 'hist/world_1914.geojson'         # historical-basemaps year in data/ (or 'ne' = Natural Earth today)
POLITIES = [                             # (key, Bosnian name, dataset NAMEs, (lon, lat, capital name))
    ('RUS', 'Rusko carstvo', ['Russian Empire', 'Russia', 'Finland'], (30.32, 59.94, 'Petrograd')),
]
PAINT = [('GRC', [(lon, lat), ...])]    # optional: polygon painted over the dataset (key None = free land)
RENAMES = {'Istanbul': 'Carigrad'}      # optional: map city name today -> name in that era
NEUTRAL = ['Some feature']               # optional: dataset NAMEs that stay free land on purpose
```
Optional too: `UNMATCHED` ('neutral' default), `NEAR_MAX` (4), `TINY`, `DISPUTED` (see `danas.py`).

Rules the build applies:
- A feature joins the polity that lists its NAME. A **colony** (a feature whose SUBJECTO is a listed name, e.g. SUBJECTO
  'France') joins its empire automatically, unless its own NAME is listed as a polity. So list SUBJECTO names
  ('Russia', 'Italy', 'United Kingdom') with the empire, and give a colony or dominion its own entry to split it off.
- Named features no polity takes are **free land** (printed as `unmatched (free land): …` — check that list).
- Unnamed bits and land the dataset misses: whole islands/gaps within 4 cells of a polity go to the nearest one, the rest is free.
- At most **190 polities** per era; polities under 4 cells merge into a neighbour. Colours are picked so neighbours differ.

## Workflow for a new era

1. `python build/hist_scan.py --map svijet 1938` lists every feature on the world grid (cells, NAME, SUBJECTO, PARTOF,
   centroid); `python build/hist_preview.py --map svijet 1938` draws them (`build/shots/hist_svijet_1938.png`).
2. Map the NAMEs to polities: independent states and empires (colonies follow by SUBJECTO), dominions/big colonies as
   their own polity where that makes a better game. Europe's polities use the same keys and names as Europe's table in
   `build/eras.py`; elsewhere ISO3-like keys.
3. Bosnian names in **ijekavica** (period names: 'Rusko carstvo', 'Perzija', 'Sijam'), capital of that year with its
   lon/lat (a name that is no modern city on the map becomes a new city there). City names: `build/names_bs.py`.
4. Fix dataset errors with `PAINT` (e.g. 1914: Corsica is Italian in the dataset).
5. Build, then **look at** `build/shots/world_<id>.png`: wrong owners, stripes/bands, missing land, colours.
6. Commit the table and `build/svijet/era_<id>.json`; `python build/make.py && python build/test_world.py`.

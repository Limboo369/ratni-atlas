# Ratni Atlas

Strateška igra osvajanja teritorije na stvarnoj karti Evrope (u pregledniku, prilagođeno telefonu).
Doba od Rima do danas, klasična igra i battle royale, igra protiv AI i online.

- Plan razvoja (sve odluke): https://claude.ai/code/artifact/165734ed-94a2-469d-9c8f-fcf9cc122ce7 — kopija u `docs/PLAN.md`
- Upute za Claude sesije: `CLAUDE.md`

## Pokretanje

```
python3 build/make.py          # napravi dist/ratni-atlas.html
```

Sirovi podaci za karte (nisu u repozitoriju): `scripts/fetch_data.sh`, pa `python3 build/prep.py`, `python3 build/world.py`, `python3 build/eras.py`.

Izvori karata: Natural Earth (javno dobro), historical-basemaps — A. Ourednik (GPL-3.0).

#!/usr/bin/env bash
# Downloads the raw map sources used by build/prep.py, build/world.py and build/eras.py.
# Natural Earth: public domain. historical-basemaps (A. Ourednik): GPL-3.0.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/hist
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_10m_land ne_10m_minor_islands ne_10m_lakes ne_10m_rivers_lake_centerlines ne_10m_rivers_europe \
         ne_10m_admin_0_boundary_lines_land ne_10m_populated_places_simple ne_10m_geography_marine_polys ne_50m_admin_0_countries; do
  [ -s "data/$f.geojson" ] || curl -fsSL -o "data/$f.geojson" "$NE/$f.geojson"
done
HB=https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson
for y in 100 1400 1815 1914 1938 1960; do
  [ -s "data/hist/world_$y.geojson" ] || curl -fsSL -o "data/hist/world_$y.geojson" "$HB/world_$y.geojson"
done
echo "data ready"

"""Scan historical-basemaps years: which dataset features cover how many land cells of the game grid.
   hist_scan.py 1914 [1938 ...]               Europe grid
   hist_scan.py --map svijet 1914 [...]       whole world (bbox from the map's meta)
Columns: cells | NAME | SUBJECTO | PARTOF | centroid lon,lat. Map NAMEs to polities in build/eras_world/<era>.py."""
import json, math, sys
import numpy as np
import eras as E  # reads --map from sys.argv: grid, land mask and the rasterizer (antimeridian-safe)

W, H, X0, Y0, CELL = E.W, E.H, E.X0, E.Y0, E.CELL
land = E.LAND


def raster(year):
    """-> (features [(props, polys)] in draw order, int raster of 1-based feature indices)"""
    fs = json.load(open(E.D + f'hist/world_{year}.geojson', encoding='utf-8'))['features']
    return E.raster_features([(f['properties'], E.polys_of(f['geometry'])) for f in fs])


if __name__ == '__main__':
    for year in [a for a in sys.argv[1:] if a.isdigit()]:
        feats, arr = raster(year)
        own = np.where(land, arr, 0)
        cnt = np.bincount(own.ravel(), minlength=len(feats) + 1)
        tot = int(land.sum())
        unc = int((land & (arr == 0)).sum())
        print(f'=== {year}: features {len(feats)}, land {tot}, uncovered {unc} ({unc*100/tot:.1f}%)')
        rows = []
        ys, xs = np.indices((H, W))
        for idx, (pr, polys) in enumerate(feats):
            n = int(cnt[idx + 1])
            if n > 0:
                m = own == idx + 1
                cx, cy = xs[m].mean(), ys[m].mean()
                gx = X0 + (cx + 0.5) * CELL; gy = Y0 + (cy + 0.5) * CELL
                lon = gx * 360 - 180; lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy))))
                rows.append((n, pr.get('NAME'), pr.get('SUBJECTO'), pr.get('PARTOF'), f'{lon:6.1f},{lat:5.1f}'))
        rows.sort(key=lambda r: -r[0])
        for r in rows:
            print(f'{r[0]:7d}  {r[1]!s:34.34} | {r[2]!s:26.26} | {r[3]!s:20.20} | {r[4]}')

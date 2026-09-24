"""Scan historical-basemaps years: which polities cover how many land cells of the game grid."""
import json, math, sys, base64, zlib
import numpy as np
from PIL import Image, ImageDraw
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

B = ROOT + 'build/'
D = ROOT + 'data/hist/'
core = json.load(open(B + 'mapdata_core.json'))
M = core['meta']
W, H, X0, Y0, CELL = M['W'], M['H'], M['X0'], M['Y0'], M['CELL']
grid = np.frombuffer(zlib.decompress(base64.b64decode(core['grid'])), np.uint8).reshape(H, W)
land = (grid & 3) != 0


def px(lon, lat):
    x = (lon + 180.0) / 360.0
    lat = max(min(lat, 85.0), -85.0)
    r = math.radians(lat)
    y = (1 - math.log(math.tan(math.pi / 4 + r / 2)) / math.pi) / 2
    return ((x - X0) / CELL, (y - Y0) / CELL)


def rings(geom):
    t = geom['type']
    if t == 'Polygon':
        return [geom['coordinates']]
    if t == 'MultiPolygon':
        return geom['coordinates']
    return []


def raster(year):
    fs = json.load(open(D + f'world_{year}.geojson'))['features']
    feats = []
    for i, f in enumerate(fs):
        pr = f['properties']
        polys = rings(f['geometry'])
        # quick bbox filter to the game area
        keep = []
        for poly in polys:
            ext = poly[0]
            lons = [p[0] for p in ext]
            lats = [p[1] for p in ext]
            if max(lons) < -12 or min(lons) > 42 or max(lats) < 32 or min(lats) > 72:
                continue
            keep.append(poly)
        if keep:
            feats.append((i, pr, keep))
    img = Image.new('I', (W, H), 0)
    dr = ImageDraw.Draw(img)
    # big polygons first, small ones on top (enclaves)
    def area(polys):
        a = 0
        for poly in polys:
            e = poly[0]
            s = 0
            for k in range(len(e) - 1):
                s += e[k][0] * e[k + 1][1] - e[k + 1][0] * e[k][1]
            a += abs(s) / 2
        return a
    feats.sort(key=lambda t: -area(t[2]))
    for idx, (i, pr, polys) in enumerate(feats):
        for poly in polys:
            pts = [px(p[0], p[1]) for p in poly[0]]
            if len(pts) >= 3:
                dr.polygon(pts, fill=idx + 1)
            for hole in poly[1:]:
                hp = [px(p[0], p[1]) for p in hole]
                if len(hp) >= 3:
                    dr.polygon(hp, fill=0)
    arr = np.asarray(img, dtype=np.int32).copy()
    return feats, arr


if __name__ == '__main__':
    for year in sys.argv[1:]:
        feats, arr = raster(year)
        own = np.where(land, arr, 0)
        cnt = np.bincount(own.ravel(), minlength=len(feats) + 1)
        tot = int(land.sum())
        unc = int((land & (arr == 0)).sum())
        print(f'=== {year}: features {len(feats)}, land {tot}, uncovered {unc} ({unc*100/tot:.1f}%)')
        rows = []
        ys, xs = np.indices((H, W))
        for idx, (i, pr, polys) in enumerate(feats):
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

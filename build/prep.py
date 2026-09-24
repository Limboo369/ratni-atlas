"""Build map data for Ratni Atlas from Natural Earth (public domain) + NASA-derived elevation.

Outputs build/mapdata.js  (window.MAPDATA = {...})
"""
import json, math, base64, zlib, io, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import shape, box, mapping, Polygon, MultiPolygon, LineString, MultiLineString, GeometryCollection
from shapely.ops import transform, unary_union
from shapely import simplify
from shapely.geometry.polygon import orient
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

D = ROOT + 'data/'
OUT = ROOT + 'build/'

# ---------------- extents ----------------
LON0, LON1 = -11.0, 41.0          # game grid
LAT0, LAT1 = 33.0, 71.3
RLON0, RLON1 = -20.0, 50.0        # render extent (vector data kept for panning margins)
RLAT0, RLAT1 = 28.0, 74.0
W = int(sys.argv[1]) if len(sys.argv) > 1 else 520
SS = 4                            # supersampling for land coverage


def nx(lon):
    return (lon + 180.0) / 360.0


def ny(lat):
    lat = max(min(lat, 85.05), -85.05)
    r = math.radians(lat)
    return (1 - math.log(math.tan(math.pi / 4 + r / 2)) / math.pi) / 2


X0, X1 = nx(LON0), nx(LON1)
Y0 = ny(LAT1)
CELL = (X1 - X0) / W
H = int(math.ceil((ny(LAT0) - Y0) / CELL))
Y1 = Y0 + H * CELL
print('grid', W, H, W * H, 'cell(normalized)', CELL)

# quantisation box for vectors (render extent)
QX0, QX1 = nx(RLON0), nx(RLON1)
QY0, QY1 = ny(RLAT1), ny(RLAT0)


def proj(x, y, z=None):
    # lon/lat arrays -> normalized mercator
    xs = (np.asarray(x) + 180.0) / 360.0
    lat = np.clip(np.asarray(y), -85.05, 85.05)
    ys = (1 - np.log(np.tan(np.pi / 4 + np.radians(lat) / 2)) / np.pi) / 2
    return xs, ys


def load(name):
    with open(D + name + '.geojson') as f:
        return json.load(f)['features']


rbox = box(RLON0, RLAT0, RLON1, RLAT1)


def clipgeom(g):
    try:
        if not g.is_valid:
            g = g.buffer(0)
        return g.intersection(rbox)
    except Exception as e:
        print('clip fail', e)
        return None


def polys_of(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, (MultiPolygon, GeometryCollection)):
        out = []
        for gg in g.geoms:
            out += polys_of(gg)
        return out
    return []


def lines_of(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    if isinstance(g, (MultiLineString, GeometryCollection)):
        out = []
        for gg in g.geoms:
            out += lines_of(gg)
        return out
    return []


# ---------------- land ----------------
land_polys = []
for f in load('ne_10m_land') + load('ne_10m_minor_islands'):
    g = clipgeom(shape(f['geometry']))
    land_polys += polys_of(g)
land_polys = [transform(proj, p) for p in land_polys]
print('land polys', len(land_polys), 'verts', sum(len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors) for p in land_polys))

lake_polys = []
lake_meta = []
for f in load('ne_10m_lakes'):
    g = clipgeom(shape(f['geometry']))
    ps = polys_of(g)
    for p in ps:
        lake_polys.append(transform(proj, p))
        lake_meta.append(f['properties'].get('scalerank', 5))
print('lakes', len(lake_polys))

# ---------------- rasterise grid ----------------
def to_px(coords, scale):
    c = np.asarray(coords)
    px = (c[:, 0] - X0) / CELL * scale
    py = (c[:, 1] - Y0) / CELL * scale
    return list(zip(px.tolist(), py.tolist()))


def raster(polys, scale, holes=True, img=None, val=255):
    if img is None:
        img = Image.new('L', (W * scale, H * scale), 0)
    dr = ImageDraw.Draw(img)
    for p in polys:
        dr.polygon(to_px(p.exterior.coords, scale), fill=val)
        if holes:
            for r in p.interiors:
                dr.polygon(to_px(r.coords, scale), fill=0 if val else 255)
    return img

hi = raster(land_polys, SS)
# big lakes become water in the grid (scalerank <= 7 or area big)
big_lakes = [p for p, sr in zip(lake_polys, lake_meta) if p.area / (CELL * CELL) > 6]
print('big lakes', len(big_lakes))
hi = raster(big_lakes, SS, holes=False, img=hi, val=0)
cov = np.asarray(hi, dtype=np.float32).reshape(H, SS, W, SS).mean(axis=(1, 3)) / 255.0
land = cov >= 0.5
print('land cells', int(land.sum()), 'of', W * H, f'{land.mean()*100:.1f}%')

# remove tiny land specks (< 3 cells) and tiny water holes (< 3 cells) for cleaner play
def components(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    cur = 0
    sizes = [0]
    m = mask.copy()
    for y0 in range(h):
        row = m[y0]
        for x0 in np.nonzero(row & (lab[y0] == 0))[0]:
            if lab[y0, x0]:
                continue
            cur += 1
            stack = [(y0, x0)]
            lab[y0, x0] = cur
            n = 0
            while stack:
                y, x = stack.pop()
                n += 1
                for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = cur
                        stack.append((yy, xx))
            sizes.append(n)
    return lab, np.array(sizes)

lab, sizes = components(land)
small = sizes < 4
small[0] = False
land[small[lab]] = False
labw, sizesw = components(~land)
smallw = sizesw < 4
smallw[0] = False
land[smallw[labw]] = True
print('land cells after cleanup', int(land.sum()))

# ---------------- elevation / terrain ----------------
elev_img = Image.open(D + 'elev_bump_4k.jpg').convert('L')
EA = np.asarray(elev_img, dtype=np.float32)
EH, EW = EA.shape


def cell_lonlat(ix, iy):
    x = X0 + (ix + 0.5) * CELL
    y = Y0 + (iy + 0.5) * CELL
    lon = x * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y))))
    return lon, lat


def sample_elev(lon, lat):
    fx = (lon + 180) / 360 * EW - 0.5
    fy = (90 - lat) / 180 * EH - 0.5
    x0 = np.floor(fx).astype(int); y0 = np.floor(fy).astype(int)
    tx = fx - x0; ty = fy - y0
    x0 = np.clip(x0, 0, EW - 2); y0 = np.clip(y0, 0, EH - 2)
    a = EA[y0, x0] * (1 - tx) + EA[y0, x0 + 1] * tx
    b = EA[y0 + 1, x0] * (1 - tx) + EA[y0 + 1, x0 + 1] * tx
    return a * (1 - ty) + b * ty

iy, ix = np.mgrid[0:H, 0:W]
gx = X0 + (ix + 0.5) * CELL
gy = Y0 + (iy + 0.5) * CELL
glon = gx * 360 - 180
glat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * gy))))
elev = sample_elev(glon, glat)

T_WATER, T_PLAIN, T_HILL, T_MOUNT = 0, 1, 2, 3
terrain = np.full((H, W), T_PLAIN, np.uint8)
terrain[elev >= 45] = T_HILL
terrain[elev >= 74] = T_MOUNT
terrain[~land] = T_WATER
for t, n in ((1, 'plain'), (2, 'hill'), (3, 'mount')):
    print(n, int((terrain == t).sum()))

# ---------------- rivers ----------------
river_lines = []  # (geom_normalized, scalerank, name)
for src in ('ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe'):
    for f in load(src):
        pr = f['properties']
        if pr.get('featurecla', '') not in ('River', 'River (Intermittent)', 'Lake Centerline', 'Canal'):
            pass
        g = clipgeom(shape(f['geometry']))
        for l in lines_of(g):
            river_lines.append((transform(proj, l), int(pr.get('scalerank', 9) or 9), pr.get('name') or '', src))
print('river lines', len(river_lines))

# gameplay rivers: major ones (scalerank <= 6 from the global centerlines set)
riv_img = Image.new('L', (W, H), 0)
dr = ImageDraw.Draw(riv_img)
for l, sr, nm, src in river_lines:
    if src == 'ne_10m_rivers_lake_centerlines' and sr <= 6:
        pts = to_px(l.coords, 1)
        dr.line(pts, fill=255, width=1)
river = (np.asarray(riv_img) > 0) & land
print('river cells', int(river.sum()))

# ---------------- borders (render only) ----------------
border_lines = []
for f in load('ne_10m_admin_0_boundary_lines_land'):
    g = clipgeom(shape(f['geometry']))
    for l in lines_of(g):
        border_lines.append(transform(proj, l))
print('border lines', len(border_lines))

# ---------------- cities ----------------
cities = []
for f in load('ne_10m_populated_places_simple'):
    p = f['properties']
    lon, lat = f['geometry']['coordinates']
    if not (LON0 + 0.2 < lon < LON1 - 0.2 and LAT0 + 0.2 < lat < LAT1 - 0.2):
        continue
    pop = int(p.get('pop_max') or 0)
    cap = p.get('featurecla', '') == 'Admin-0 capital' or (p.get('adm0cap') or 0) == 1
    cities.append(dict(name=p.get('name'), ascii=p.get('nameascii'), country=p.get('adm0name'), iso=p.get('adm0_a3') or p.get('sov_a3'),
                       lon=lon, lat=lat, pop=pop, cap=bool(cap), rank=int(p.get('scalerank', 10)), fc=p.get('featurecla')))
print('cities in bbox', len(cities))
with open(OUT + 'cities_raw.json', 'w') as f:
    json.dump(cities, f, ensure_ascii=False)

# ---------------- encoding helpers ----------------
def zz(v):
    return (v << 1) ^ (v >> 31)


def varint(out, v):
    while v >= 0x80:
        out.append((v & 0x7f) | 0x80)
        v >>= 7
    out.append(v)


def qx(x):
    return int(round((x - QX0) / (QX1 - QX0) * 65535))


def qy(y):
    return int(round((y - QY0) / (QY1 - QY0) * 65535))


def enc_rings(rings):
    """rings: list of coordinate arrays (normalized). returns base64 of varint stream: nRings, then per ring nPts, x0,y0 deltas"""
    out = bytearray()
    varint(out, len(rings))
    for r in rings:
        pts = [(qx(x), qy(y)) for x, y in r]
        # drop consecutive duplicates after quantisation
        dd = [pts[0]]
        for p in pts[1:]:
            if p != dd[-1]:
                dd.append(p)
        varint(out, len(dd))
        px, py = 0, 0
        for x, y in dd:
            varint(out, zz(x - px)); varint(out, zz(y - py))
            px, py = x, y
    return base64.b64encode(zlib.compress(bytes(out), 9)).decode()


def poly_rings(p, tol):
    q = simplify(p, tol, preserve_topology=True) if tol > 0 else p
    out = []
    for pp in polys_of(q):
        pp = orient(pp, 1.0)
        if pp.area < (tol * tol * 4 if tol > 0 else 0):
            continue
        ext = list(pp.exterior.coords)
        if len(ext) >= 4:
            out.append(('e', ext))
        for r in pp.interiors:
            if len(r.coords) >= 4:
                out.append(('h', list(r.coords)))
    return out

# LOD tolerances in normalized units (~0.6 px at the given zoom)
def tol_at(z):
    return 0.6 / (256 * 2 ** z)

LODS = [('z3', tol_at(3.5)), ('z5', tol_at(5.5)), ('z7', tol_at(7.5))]

vec = {}
for name, tol in LODS:
    rings = []
    for p in land_polys:
        for kind, r in poly_rings(p, tol):
            rings.append(r)  # evenodd fill handles holes
    vec['land_' + name] = enc_rings(rings)
    lrings = []
    for p in lake_polys:
        for kind, r in poly_rings(p, tol):
            lrings.append(r)
    vec['lake_' + name] = enc_rings(lrings)
    print(name, 'land rings', len(rings), 'pts', sum(len(r) for r in rings), 'lake rings', len(lrings))

# rivers: two classes by zoom visibility
def line_list(lines, tol):
    out = []
    for l in lines:
        q = simplify(l, tol) if tol > 0 else l
        for ll in lines_of(q):
            c = list(ll.coords)
            if len(c) >= 2:
                out.append(c)
    return out

riv_major = [l for l, sr, nm, src in river_lines if src == 'ne_10m_rivers_lake_centerlines' and sr <= 6]
riv_minor = [l for l, sr, nm, src in river_lines if not (src == 'ne_10m_rivers_lake_centerlines' and sr <= 6) and sr <= 11]
vec['riv1_z3'] = enc_rings(line_list(riv_major, tol_at(3.5)))
vec['riv1_z7'] = enc_rings(line_list(riv_major, tol_at(7)))
vec['riv2_z7'] = enc_rings(line_list(riv_minor, tol_at(7)))
vec['bord_z3'] = enc_rings(line_list(border_lines, tol_at(3.5)))
vec['bord_z7'] = enc_rings(line_list(border_lines, tol_at(7)))
for k, v in vec.items():
    print(k, len(v))

# ---------------- relief image (mercator, grid-aligned, 2x) ----------------
RS = 2
riy, rix = np.mgrid[0:H * RS, 0:W * RS]
rgx = X0 + (rix + 0.5) * CELL / RS
rgy = Y0 + (riy + 0.5) * CELL / RS
rlon = rgx * 360 - 180
rlat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * rgy))))
relev = sample_elev(rlon, rlat)
def blur(a, n=1):
    for _ in range(n):
        a = (np.roll(a, 1, 0) + np.roll(a, -1, 0) + 2 * a) / 4
        a = (np.roll(a, 1, 1) + np.roll(a, -1, 1) + 2 * a) / 4
    return a
relev_raw = relev.astype(np.float32)
relev = blur(relev_raw, 8)
# hillshade (computed on a heavily smoothed surface; JPEG/8-bit terracing in the source would otherwise dominate)
dzdx = np.gradient(relev, axis=1)
dzdy = np.gradient(relev, axis=0)
az = math.radians(315); alt = math.radians(42)
zf = 0.7
slope = np.arctan(zf * np.hypot(dzdx, dzdy))
aspect = np.arctan2(-dzdx, dzdy)
shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect - math.pi / 2)
shade = np.clip(shade, 0, 1)
flat = math.sin(alt)
# hypsometric tint (land colour ramp) -- sage lowlands -> olive -> ochre -> stone
stops = [(20, (205, 214, 188)), (32, (212, 216, 186)), (45, (220, 214, 180)), (60, (206, 190, 158)), (80, (182, 168, 146)), (110, (196, 190, 184)), (140, (236, 234, 230))]
def ramp(v):
    v = np.asarray(v)
    out = np.zeros(v.shape + (3,), np.float32)
    xs = [s[0] for s in stops]
    for c in range(3):
        out[..., c] = np.interp(v, xs, [s[1][c] for s in stops])
    return out
col = ramp(blur(relev_raw, 3))
strength = np.clip((relev - 30) / 25.0, 0, 1) ** 1.2
k = (shade - flat) * 1.1 * strength
col = np.where(k[..., None] < 0, col * (1 + k[..., None] * 0.6), col + (255 - col) * k[..., None] * 0.45)
col = np.clip(col, 0, 255).astype(np.uint8)
rel = Image.fromarray(col, 'RGB')
buf = io.BytesIO(); rel.save(buf, 'JPEG', quality=82, optimize=True, progressive=True)
relief_b64 = base64.b64encode(buf.getvalue()).decode()
rel.save(OUT + 'relief_preview.jpg', quality=85)
print('relief jpg bytes', len(buf.getvalue()))

# ---------------- grid encoding ----------------
flags = terrain.copy()
flags[river] |= 4 << 0  # bit2 = river  (terrain uses bits 0-1)
raw = flags.astype(np.uint8).tobytes()
grid_b64 = base64.b64encode(zlib.compress(raw, 9)).decode()
print('grid bytes compressed', len(grid_b64))

# preview
pv = np.zeros((H, W, 3), np.uint8)
pv[terrain == 0] = (70, 110, 150)
pv[terrain == 1] = (190, 205, 160)
pv[terrain == 2] = (170, 150, 110)
pv[terrain == 3] = (120, 110, 100)
pv[river] = (40, 90, 200)
Image.fromarray(pv).resize((W * 2, H * 2), Image.NEAREST).save(OUT + 'grid_preview.png')

meta = dict(W=W, H=H, X0=X0, Y0=Y0, CELL=CELL, QX0=QX0, QX1=QX1, QY0=QY0, QY1=QY1,
            LON0=LON0, LON1=LON1, LAT0=LAT0, LAT1=LAT1, RLON0=RLON0, RLON1=RLON1, RLAT0=RLAT0, RLAT1=RLAT1, RS=RS)
with open(OUT + 'mapdata_core.json', 'w') as f:
    json.dump(dict(meta=meta, grid=grid_b64, vec=vec, relief=relief_b64), f)
print('done')

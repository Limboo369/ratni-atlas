"""Cities, nations, city-states and sea labels.
world.py [evropa]  -> build/mapdata.js      (window.MAPDATA, inlined into the page)
world.py svijet    -> build/svijet/map.json (same object, fetched from /data/svijet/map.json)"""
import json, math, colorsys, random, sys
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

B = ROOT + 'build/'
WORLD = (sys.argv[1] if len(sys.argv) > 1 else 'evropa') == 'svijet'
SRC = B + 'svijet/' if WORLD else B
core = json.load(open(SRC + ('core.json' if WORLD else 'mapdata_core.json'), encoding='utf-8'))
M = core['meta']
W, H, X0, Y0, CELL = M['W'], M['H'], M['X0'], M['Y0'], M['CELL']
import base64, zlib
grid = bytearray(zlib.decompress(base64.b64decode(core['grid'])))


def cell_of(lon, lat):
    x = (lon + 180) / 360
    r = math.radians(lat)
    y = (1 - math.log(math.tan(math.pi / 4 + r / 2)) / math.pi) / 2
    return int((x - X0) / CELL), int((y - Y0) / CELL)


def is_land(ix, iy):
    return 0 <= ix < W and 0 <= iy < H and (grid[iy * W + ix] & 3) != 0


def snap(lon, lat, rmax=4):
    ix, iy = cell_of(lon, lat)
    if is_land(ix, iy):
        return ix, iy
    best = None
    for r in range(1, rmax + 1):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if is_land(ix + dx, iy + dy):
                    d = dx * dx + dy * dy
                    if best is None or d < best[0]:
                        best = (d, ix + dx, iy + dy)
        if best:
            return best[1], best[2]
    return None

# Bosnian exonyms for well-known cities (everything else keeps its Natural Earth name)
EXO = {
    'Algiers': 'Alžir', 'Athens': 'Atina', 'Belgrade': 'Beograd', 'Brussels': 'Brisel', 'Bucharest': 'Bukurešt',
    'Budapest': 'Budimpešta', 'Chișinău': 'Kišinjev', 'Kyiv': 'Kijev', 'København': 'Kopenhagen', 'Lisbon': 'Lisabon',
    'London': 'London', 'Moscow': 'Moskva', 'Nicosia': 'Nikozija', 'Paris': 'Pariz', 'Prague': 'Prag', 'Rome': 'Rim',
    'Skopje': 'Skoplje', 'Sofia': 'Sofija', 'Stockholm': 'Stokholm', 'Tallinn': 'Talin', 'Vienna': 'Beč', 'Warsaw': 'Varšava',
    'Damascus': 'Damask', 'Beirut': 'Bejrut', 'Pristina': 'Priština', 'Tirana': 'Tirana', 'Bern': 'Bern',
    'Barcelona': 'Barcelona', 'Cologne': 'Keln', 'Munich': 'Minhen', 'Milan': 'Milano', 'Naples': 'Napulj', 'Turin': 'Torino',
    'Florence': 'Firenca', 'Genoa': 'Đenova', 'Venice': 'Venecija', 'Geneva': 'Ženeva', 'Zürich': 'Cirih', 'Nürnberg': 'Nirnberg',
    'Göteborg': 'Geteborg', 'St.  Petersburg': 'Sankt Peterburg', 'St. Petersburg': 'Sankt Peterburg', 'Odessa': 'Odesa',
    'Kharkiv': 'Harkiv', 'Kraków': 'Krakov', 'Wrocław': 'Vroclav', 'Łódź': 'Lođ', 'Gdańsk': 'Gdanjsk', 'Poznań': 'Poznanj',
    'The Hague': 'Hag', 'Antwerpen': 'Antverpen', 'Seville': 'Sevilja', 'Valencia': 'Valensija', 'Zaragoza': 'Saragosa',
    'Málaga': 'Malaga', 'Porto': 'Porto', 'Marseille': 'Marselj', 'Lyon': 'Lion', 'Toulouse': 'Tuluz', 'Bordeaux': 'Bordo',
    'Nice': 'Nica', 'Lille': 'Lil', 'Edinburgh': 'Edinburg', 'Thessaloniki': 'Solun', 'İzmir': 'Izmir', 'Istanbul': 'Istanbul',
    'Ṭarābulus': 'Tripoli', 'Casablanca': 'Kazablanka', 'Fez': 'Fes', 'Tangier': 'Tanger', 'Hanover': 'Hanover',
    'Frankfurt': 'Frankfurt', 'Leipzig': 'Lajpcig', 'Dresden': 'Drezden', 'Stuttgart': 'Štutgart', 'Düsseldorf': 'Diseldorf',
    'Dnipro': 'Dnjepar', 'Zaporizhzhya': 'Zaporožje', 'Lviv': 'Lavov', 'Rostov': 'Rostov na Donu', 'Voronezh': 'Voronjež',
    'Niš': 'Niš', 'Timișoara': 'Temišvar', 'Cluj-Napoca': 'Kluž', 'Szeged': 'Segedin', 'Pécs': 'Pečuh', 'Trieste': 'Trst',
    'Rijeka': 'Rijeka', 'Shkodër': 'Skadar', 'Durrës': 'Drač', 'Maribor': 'Maribor', 'Klagenfurt': 'Celovec',
    'Bratislava': 'Bratislava', 'Vilnius': 'Vilnjus', 'Minsk': 'Minsk', 'Riga': 'Riga', 'Helsinki': 'Helsinki',
    'Dublin': 'Dablin', 'Amsterdam': 'Amsterdam', 'Rotterdam': 'Roterdam', 'Hamburg': 'Hamburg', 'Bremen': 'Bremen',
    'Aleppo': 'Alep', 'Homs': 'Homs', 'Oran': 'Oran', 'Constantine': 'Konstantin', 'Tunis': 'Tunis', 'Rabat': 'Rabat',
    'Ankara': 'Ankara', 'Bursa': 'Bursa', 'Palermo': 'Palermo', 'Bari': 'Bari', 'Catania': 'Katanija', 'Salerno': 'Salerno',
    'Pec': 'Peć', 'Prizren': 'Prizren', 'Kragujevac': 'Kragujevac', 'Čačak': 'Čačak', 'Bitola': 'Bitolj', 'Vlorë': 'Valona',
    'Liège': 'Lijež', 'Saarbrücken': 'Sarbriken', 'Wiesbaden': 'Vizbaden', 'Mannheim': 'Manhajm', 'Basel': 'Bazel',
    'Luxembourg': 'Luksemburg', 'Sarajevo': 'Sarajevo', 'Zagreb': 'Zagreb', 'Ljubljana': 'Ljubljana', 'Podgorica': 'Podgorica',
}

EXCLUDE = {'Andorra', 'Monaco', 'San Marino', 'Vaduz', 'Vatican City', 'Valletta', 'Southend-on-Sea', 'Icel', 'Bytom', 'Gliwice',
           'Wuppertal', 'Bonn', 'Bradford', 'Duisburg', 'Essen', 'Tarsus', 'Blida', 'Kenitra', 'Salé'}
NOT_CAPITAL = {'Pristina', 'Luxembourg'}
EXTRA = {'Mostar', 'Tuzla', 'Zenica', 'Banja Luka', 'Split', 'Novi Sad', 'Niš', 'Rijeka', 'Kragujevac', 'Osijek', 'Zadar',
         'Maribor', 'Bitola', 'Shkodër', 'Durrës', 'Prizren', 'Pec', 'Timișoara', 'Cluj-Napoca', 'Szeged', 'Pécs', 'Trieste',
         'Bihać', 'Prijedor', 'Brčko', 'Bijeljina', 'Doboj', 'Nikšić', 'Dubrovnik', 'Pula', 'Subotica', 'Varna', 'Plovdiv',
         'Constanța', 'Iași', 'Brașov', 'Graz', 'Innsbruck', 'Salzburg', 'Linz', 'Venice', 'Bologna', 'Verona', 'Aberdeen',
         'Bergen', 'Trondheim', 'Tromsø', 'Umeå', 'Oulu', 'Tampere', 'Turku', 'Kaunas', 'Tartu', 'Murmansk', 'Arkhangelsk',
         'Petrozavodsk', 'Smolensk', 'Kaliningrad', 'Brest', 'Gomel', 'Ajaccio', 'Cagliari', 'Iráklion', 'Patra', 'Larissa',
         'Heraklion', 'Reykjavík', 'Cork', 'Belfast', 'Inverness', 'Nantes', 'Rennes', 'Strasbourg', 'Montpellier', 'Palma',
         'Valladolid', 'Coimbra', 'Faro', 'Granada', 'Murcia', 'La Coruña', 'Oviedo', 'Burgas', 'Ruse', 'Galați', 'Chernivtsi',
         'Uzhhorod', 'Košice', 'Brno', 'Ostrava', 'Debrecen', 'Miskolc', 'Győr', 'Szczecin', 'Lublin', 'Białystok', 'Kiel',
         'Rostock', 'Aarhus', 'Aalborg', 'Malmö', 'Luleå', 'Sevastopol', 'Simferopol', 'Samsun', 'Trabzon', 'Antalya', 'Konya'}

raw = json.load(open(SRC + 'cities_raw.json', encoding='utf-8'))


def rgb(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))


def hdist(a, b):
    d = abs(a[0] - b[0]); d = min(d, 1 - d)
    return d * 3 + abs(a[2] - b[2]) * 1.2 + abs(a[1] - b[1]) * 0.5


def assign_colors(nations, near_r, fall, adj=None):
    """greedy max hue distance from nearby nations (by capital distance, or adj: iso -> neighbour isos, where a colour
    may repeat beyond the neighbours' neighbours)"""
    PLAYER_HUE = 0.60  # player is electric blue
    cands = []
    for i in range(72):
        h = (i / 72.0)
        if abs(h - PLAYER_HUE) < 0.085 or abs(h - PLAYER_HUE) > 0.915:
            continue
        for s, l in ((0.62, 0.50), (0.55, 0.42), (0.70, 0.58)):
            cands.append((h, s, l))
    rng = random.Random(7)
    assigned = []
    order = sorted(nations, key=lambda n: (-len(adj[n['iso']]), n['iso']) if adj else (n['x'] - W / 2) ** 2 + (n['y'] - H / 2) ** 2)
    for nat in order:
        if adj:  # neighbours count fully, their neighbours half
            nb = adj[nat['iso']]
            used = [a for a in assigned if a[0]['iso'] in nb or any(a[0]['iso'] in adj[k] for k in nb)]
            near = [(a[0], a[1], 1 if a[0]['iso'] in nb else 2) for a in used]
        else:
            near = [a + (1 + math.hypot(a[0]['x'] - nat['x'], a[0]['y'] - nat['y']) / fall,) for a in assigned
                    if (a[0]['x'] - nat['x']) ** 2 + (a[0]['y'] - nat['y']) ** 2 < near_r ** 2]
            used = assigned
        best, bs = None, -1
        for c in cands:
            if any(c == a[1] for a in used):
                continue
            sc = min([hdist(c, a[1]) / a[2] for a in near] or [9])
            sc += rng.random() * 0.02
            if sc > bs:
                best, bs = c, sc
        assigned.append((nat, best))
        nat['c'] = rgb(*best)


def city_states(cities, nations, d_cap, d_cs):
    capcells = [(n['x'], n['y']) for n in nations]
    cs = []
    for c in sorted(cities, key=lambda c: -c['p']):
        if c['t'] == 3:
            continue
        if min((c['x'] - x) ** 2 + (c['y'] - y) ** 2 for x, y in capcells) < d_cap ** 2:
            continue
        if any((c['x'] - o['x']) ** 2 + (c['y'] - o['y']) ** 2 < d_cs ** 2 for o in cs):
            continue
        cs.append(dict(n=c['n'], x=c['x'], y=c['y']))
    print('city-state candidates', len(cs))
    return cs


# ---------------- whole world (world.py svijet) ----------------
NEUTRAL = {'KOS', 'CYN', 'SAH', 'SOL', 'KAS'}  # disputed: free land at the start (Taiwan plays as a normal country)
CAPITAL = {'BOL': 'La Paz', 'CIV': 'Yamoussoukro', 'MMR': 'Naypyidaw', 'ZAF': 'Pretoria', 'GRL': 'Nuuk', 'SDS': 'Juba',
           'PSX': 'Ramallah', 'TZA': 'Dodoma', 'BEN': 'Porto-Novo'}
ISO_FIX = {'SSD': 'SDS'}                      # populated places use another code than the countries
MIN_CELLS, MAX_POL = 8, 190                   # smaller countries are free land; owner is Uint8 with 250 players incl. city-states
POP_MIN, MAX_RANK, CLASH, SPARSE_POP, SPARSE_R = 1500000, 5, 3, 300000, 25  # big cities (rank > 5: suburbs), then empty regions
SEAS_W = [
    ('Tihi okean', -140, 8, 1), ('Tihi okean', 165, 22, 1), ('Atlantski okean', -40, 28, 1), ('Atlantski okean', -18, -22, 1),
    ('Indijski okean', 78, -18, 1),
    ('Sredozemno more', 17.0, 34.6, 2), ('Crno more', 34.0, 43.3, 2), ('Karipsko more', -75, 15, 2), ('Meksički zaljev', -90, 25, 2),
    ('Arapsko more', 64, 15, 2), ('Bengalski zaljev', 88, 15, 2), ('Južno kinesko more', 114, 13, 2),
    ('Istočno kinesko more', 126, 29, 2), ('Japansko more', 135, 40.5, 2), ('Ohotsko more', 150, 55, 2),
    ('Beringovo more', -176, 57, 2), ('Crveno more', 38.5, 20, 2), ('Perzijski zaljev', 51.5, 27, 2), ('Hudsonov zaljev', -85, 59, 2),
    ('Koralno more', 155, -17, 2), ('Tasmanovo more', 161, -38, 2), ('Gvinejski zaljev', 3, 2, 2), ('Aljaski zaljev', -145, 56, 2),
    ('Filipinsko more', 132, 20, 2), ('Labradorsko more', -54, 59, 2), ('Norveško more', 3.0, 66.0, 2), ('Sjeverno more', 3.3, 56.3, 2),
    ('Baltičko more', 19.2, 56.7, 2), ('Barentsovo more', 40, 71, 2), ('Veliki australski zaljev', 130, -36, 2),
    ('Kaspijsko jezero', 50.5, 42.0, 3), ('Mozambički kanal', 41, -18, 3), ('Arafursko more', 135, -9.5, 3),
    ('Timorsko more', 126, -11.5, 3), ('Javansko more', 111, -5, 3), ('Žuto more', 123, 35.5, 3), ('Andamansko more', 96, 11, 3),
    ('Adenski zaljev', 48, 12.5, 3), ('Kalifornijski zaljev', -110.5, 26.5, 3), ('Tajlandski zaljev', 101.5, 10, 3),
    ('Biskajski zaljev', -4.8, 45.3, 3), ('Jadransko more', 15.4, 43.0, 3), ('Egejsko more', 25.0, 38.7, 3),
    ('Tirensko more', 12.1, 39.9, 3), ('Jonsko more', 18.6, 38.4, 3), ('Botnički zaljev', 20.6, 62.4, 3), ('Bijelo more', 38.3, 65.6, 3),
]


def build_world():
    import numpy as np
    from PIL import Image, ImageDraw
    import names_bs
    exo = dict(EXO, **names_bs.CITIES)
    LAND = (np.frombuffer(bytes(grid), np.uint8).reshape(H, W) & 3) != 0

    def gxy(lon, lat):
        r = math.radians(max(min(lat, 85.0), -85.0))
        return ((lon + 180.0) / 360.0 - X0) / CELL, ((1 - math.log(math.tan(math.pi / 4 + r / 2)) / math.pi) / 2 - Y0) / CELL

    # countries on the grid, drawn like build/eras.py does (big first, enclaves on top)
    feats = []
    for f in json.load(open(ROOT + 'data/ne_50m_admin_0_countries.geojson', encoding='utf-8'))['features']:
        g = f['geometry']
        polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        polys = [p for p in polys if max(q[1] for q in p[0]) > M['LAT0'] - 1 and min(q[1] for q in p[0]) < M['LAT1'] + 1]
        wide = [p for p in polys if max(q[0] for q in p[0]) - min(q[0] for q in p[0]) > 180]
        assert not wide, 'ring across the antimeridian: ' + f['properties']['ADM0_A3']
        if polys:
            area = sum(abs(sum(e[k][0] * e[k + 1][1] - e[k + 1][0] * e[k][1] for k in range(len(e) - 1))) / 2 for e in (p[0] for p in polys))
            feats.append((f['properties'], polys, area))
    feats.sort(key=lambda t: -t[2])
    img = Image.new('I', (W, H), 0)
    dr = ImageDraw.Draw(img)
    for i, (pr, polys, _) in enumerate(feats):
        for poly in polys:
            dr.polygon([gxy(*q[:2]) for q in poly[0]], fill=i + 1)
            for hole in poly[1:]:
                dr.polygon([gxy(*q[:2]) for q in hole], fill=0)
    fid = np.where(LAND, np.asarray(img, dtype=np.int32), 0)
    cnt = np.bincount(fid.ravel(), minlength=len(feats) + 1)

    cand, missing = [], []
    for i, (pr, polys, _) in enumerate(feats):
        a3 = pr['ADM0_A3']
        if a3 in NEUTRAL or a3 == 'ATA' or (pr['HOMEPART'] != 1 and a3 not in ('GRL', 'PSX')):
            continue  # dependencies (and disputed areas) are free land
        if a3 not in names_bs.COUNTRIES:
            missing.append(a3 + ' ' + pr['NAME'])
        cand.append((int(cnt[i + 1]), a3, pr, i + 1))
    if missing:
        sys.exit('build/names_bs.py: nema bosanskog imena za ' + ', '.join(missing))
    cand.sort(key=lambda t: (-t[0], t[1]))
    small = [t for t in cand if t[0] < MIN_CELLS] + [t for t in cand if t[0] >= MIN_CELLS][MAX_POL:]
    cand = [t for t in cand if t[0] >= MIN_CELLS][:MAX_POL]
    print('countries', len(cand), 'free land (small):', ' '.join(f'{t[1]}:{t[0]}' for t in small))

    def iso_of(c):
        return ISO_FIX.get(c['iso'], c['iso'])

    def fid_at(lon, lat):
        ix, iy = cell_of(lon, lat)
        return fid[iy, ix] if 0 <= ix < W and 0 <= iy < H else 0

    def snap_own(lon, lat, fi):
        ix, iy = cell_of(lon, lat)
        ys, xs = np.nonzero(fid == fi)
        d = (xs - ix) ** 2 + (ys - iy) ** 2
        k = int(np.argmin(d))
        return (int(xs[k]), int(ys[k])) if d[k] <= 36 else None

    nations, capkeys = [], {}
    for n_cells, a3, pr, fi in cand:
        caps = [c for c in raw if iso_of(c) == a3 and (c['name'] == CAPITAL[a3] if a3 in CAPITAL else c['cap'])]
        # no capital in the data (or not on the country's own cells): the biggest own city, else the label point
        own = [c for c in raw if fid_at(c['lon'], c['lat']) == fi]
        cap, s = None, None
        for c in sorted(caps, key=lambda c: -c['pop']) + sorted(own, key=lambda c: -c['pop']):
            s = snap_own(c['lon'], c['lat'], fi)
            if s:
                cap = c
                break
        if not s:  # capital off the grid's land (small islands): its name at the label point
            cap = max(caps, key=lambda c: c['pop']) if caps else None
            s = snap_own(pr['LABEL_X'], pr['LABEL_Y'], fi)
        if not s:
            ys, xs = np.nonzero(fid == fi)
            s = int(xs[len(xs) // 2]), int(ys[len(ys) // 2])
        if cap:
            assert (cap['name'], cap['lon'], cap['lat']) not in capkeys, 'two countries share a capital: ' + a3
            capkeys[(cap['name'], cap['lon'], cap['lat'])] = s
        else:
            print('  no capital city', a3)
        nations.append(dict(iso=a3, n=names_bs.COUNTRIES[a3], x=s[0], y=s[1], cap=exo.get(cap['name'], cap['name']) if cap else '—'))

    cities = []

    def add(c, s, tier):
        cities.append(dict(n=exo.get(c['name'], c['name']), x=s[0], y=s[1], lon=round(c['lon'], 3), lat=round(c['lat'], 3), p=c['pop'],
                           t=tier, iso=iso_of(c), r=c['rank']))

    key = lambda c: (c['name'], c['lon'], c['lat'])
    for c in sorted(raw, key=lambda c: (-(key(c) in capkeys), -c['pop'], c['name'])):
        if key(c) in capkeys:
            add(c, capkeys[key(c)], 3)
            continue
        if c['pop'] < POP_MIN or c['rank'] > MAX_RANK:
            continue
        s = snap(c['lon'], c['lat'])
        if s and not any(abs(o['x'] - s[0]) + abs(o['y'] - s[1]) <= CLASH for o in cities):
            add(c, s, 2 if c['pop'] >= 1000000 else 1)
    # empty regions (Siberia, Sahara, Amazon, outback) get their biggest town
    for c in sorted(raw, key=lambda c: (-c['pop'], c['name'])):
        if c['pop'] < SPARSE_POP:
            break
        s = snap(c['lon'], c['lat'])
        if s and not any((o['x'] - s[0]) ** 2 + (o['y'] - s[1]) ** 2 < SPARSE_R ** 2 for o in cities):
            add(c, s, 2 if c['pop'] >= 1000000 else 1)
    print('cities kept', len(cities), 'caps', sum(1 for c in cities if c['t'] == 3))
    seas = [dict(n=n, lon=lo, lat=la, r=r) for n, lo, la, r in SEAS_W]

    # neighbours for the colours: land borders and sea gaps up to 32 cells
    num = np.zeros(len(feats) + 1, np.int64)
    for k, t in enumerate(cand):
        num[t[3]] = k + 1
    own = num[fid]
    codes = []
    for d in (1, 2, 4, 8, 16, 32):
        for a, b in ((own[:, :-d], own[:, d:]), (own[:-d], own[d:])):
            m = (a > 0) & (b > 0) & (a != b)
            codes.append(np.unique(a[m] * 1000 + b[m]))
    adj = {n['iso']: set() for n in nations}
    for code in np.unique(np.concatenate(codes)).tolist():
        i, j = nations[code // 1000 - 1]['iso'], nations[code % 1000 - 1]['iso']
        adj[i].add(j)
        adj[j].add(i)
    return cities, nations, seas, adj


if WORLD:
    cities, nations, seas, adj = build_world()
    assign_colors(nations, 0, 0, adj=adj)
    cs = city_states(cities, nations, 13, 15)
    M = dict(M, id='svijet', name='Cijeli svijet', lods=['z1', 'z3', 'z5'], minZoom=0.5, maxZoom=8, winShare=0.55, overtimeMin=20,
             areaWeight=True)  # Mercator: cells near the poles count less (src/01-data.js map.aw)
    out = dict(meta=M, grid=core['grid'], vec=core['vec'], relief=core['relief'], cities=cities, nations=nations, cs=cs, seas=seas)
    js = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    with open(SRC + 'map.json', 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print('map.json bytes', len(js.encode()), 'nations', len(nations), 'cities', len(cities))
    sys.exit()

seen = set()
cities = []
for c in sorted(raw, key=lambda c: (-int(c['cap']), -c['pop'])):
    nm = c['name']
    if nm in EXCLUDE:
        continue
    cap = c['cap'] and nm not in NOT_CAPITAL
    keep = cap or c['pop'] >= 700000 or nm in EXTRA or (c['pop'] >= 350000 and c['rank'] <= 5)
    if not keep:
        continue
    s = snap(c['lon'], c['lat'])
    if s is None:
        continue
    key = (nm, round(c['lon'], 1))
    if key in seen:
        continue
    # avoid two cities on (almost) the same cell: keep the bigger one
    clash = [o for o in cities if abs(o['x'] - s[0]) + abs(o['y'] - s[1]) <= 2]
    if clash:
        continue
    seen.add(key)
    tier = 3 if cap else (2 if c['pop'] >= 1000000 else 1)
    cities.append(dict(n=EXO.get(nm, nm), x=s[0], y=s[1], lon=round(c['lon'], 3), lat=round(c['lat'], 3), p=c['pop'], t=tier,
                       iso=c['iso'], r=c['rank']))
print('cities kept', len(cities), 'caps', sum(1 for c in cities if c['t'] == 3), 'metro', sum(1 for c in cities if c['t'] == 2))

# ---------------- nations ----------------
# iso3, Bosnian name, capital (Natural Earth name), personality
NATIONS = [
    ('PRT', 'Portugal', 'Lisbon'), ('ESP', 'Španija', 'Madrid'), ('FRA', 'Francuska', 'Paris'), ('GBR', 'Britanija', 'London'),
    ('IRL', 'Irska', 'Dublin'), ('NOR', 'Norveška', 'Oslo'), ('SWE', 'Švedska', 'Stockholm'), ('FIN', 'Finska', 'Helsinki'),
    ('DNK', 'Danska', 'København'), ('NLD', 'Holandija', 'Amsterdam'), ('BEL', 'Belgija', 'Brussels'), ('DEU', 'Njemačka', 'Berlin'),
    ('CHE', 'Švicarska', 'Bern'), ('AUT', 'Austrija', 'Vienna'), ('ITA', 'Italija', 'Rome'), ('CZE', 'Češka', 'Prague'),
    ('POL', 'Poljska', 'Warsaw'), ('HUN', 'Mađarska', 'Budapest'), ('SVN', 'Slovenija', 'Ljubljana'), ('HRV', 'Hrvatska', 'Zagreb'),
    ('BIH', 'Bosna i Hercegovina', 'Sarajevo'), ('SRB', 'Srbija', 'Belgrade'), ('MNE', 'Crna Gora', 'Podgorica'),
    ('ALB', 'Albanija', 'Tirana'), ('MKD', 'Sjeverna Makedonija', 'Skopje'), ('GRC', 'Grčka', 'Athens'), ('BGR', 'Bugarska', 'Sofia'),
    ('ROU', 'Rumunija', 'Bucharest'), ('MDA', 'Moldavija', 'Chișinău'), ('UKR', 'Ukrajina', 'Kyiv'), ('BLR', 'Bjelorusija', 'Minsk'),
    ('LTU', 'Litvanija', 'Vilnius'), ('LVA', 'Latvija', 'Riga'), ('EST', 'Estonija', 'Tallinn'), ('RUS', 'Rusija', 'Moscow'),
    ('TUR', 'Turska', 'Ankara'), ('MAR', 'Maroko', 'Rabat'), ('DZA', 'Alžir', 'Algiers'), ('TUN', 'Tunis', 'Tunis'),
    ('SVK', 'Slovačka', 'Bratislava'), ('SYR', 'Sirija', 'Damascus'), ('CYP', 'Kipar', 'Nicosia'),
]
bycap = {}
for c in raw:
    if c['cap'] or c['name'] in ('Pristina',):
        bycap[c['name']] = c
nations = []
for iso, name, capn in NATIONS:
    c = bycap.get(capn)
    if not c:
        print('missing capital', capn)
        continue
    s = snap(c['lon'], c['lat'], 6)
    if not s:
        print('capital not on land', capn)
        continue
    nations.append(dict(iso=iso, n=name, x=s[0], y=s[1], cap=EXO.get(capn, capn)))
print('nations', len(nations))

assign_colors(nations, 120, 60)

# ---------------- city states (bots) ----------------
cs = city_states(cities, nations, 26, 30)

SEAS = [
    ('Atlantski okean', -9.2, 47.8, 1), ('Biskajski zaljev', -4.8, 45.3, 2), ('Sjeverno more', 3.3, 56.3, 1),
    ('Norveško more', 3.0, 66.0, 1), ('Baltičko more', 19.2, 56.7, 1), ('Botnički zaljev', 20.6, 62.4, 2),
    ('Sredozemno more', 17.0, 34.6, 1), ('Tirensko more', 12.1, 39.9, 2), ('Jadransko more', 15.4, 43.0, 1),
    ('Jonsko more', 18.6, 38.4, 2), ('Egejsko more', 25.0, 38.7, 2), ('Crno more', 34.0, 43.3, 1),
    ('Azovsko more', 36.6, 46.1, 3), ('Irsko more', -5.0, 53.8, 3), ('Lamanš', -2.6, 50.0, 3),
    ('Ligursko more', 8.6, 43.4, 3), ('Balearsko more', 2.6, 40.2, 3), ('Finski zaljev', 26.2, 59.8, 3),
    ('Levantsko more', 32.0, 34.2, 3), ('Bijelo more', 38.3, 65.6, 3), ('Barentsovo more', 33.0, 70.4, 2),
    ('Mramorno more', 28.1, 40.75, 3), ('Kaspijsko jezero', 50.0, 42.0, 3),
]
seas = [dict(n=n, lon=lo, lat=la, r=r) for n, lo, la, r in SEAS]
M = dict(M, id='evropa', name='Evropa', lods=['z3', 'z5', 'z7'])

out = dict(meta=M, grid=core['grid'], vec=core['vec'], relief=core['relief'], cities=cities, nations=nations, cs=cs, seas=seas)
js = 'window.MAPDATA=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(B + 'mapdata.js', 'w').write(js)
print('mapdata.js bytes', len(js.encode()))
for n in nations:
    print(n['iso'], n['n'], n['c'], n['x'], n['y'])

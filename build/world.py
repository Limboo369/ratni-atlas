"""Cities, nations, city-states and sea labels -> build/mapdata.js"""
import json, math, colorsys, random
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

B = ROOT + 'build/'
core = json.load(open(B + 'mapdata_core.json'))
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

raw = json.load(open(B + 'cities_raw.json'))
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

# colour assignment: greedy max hue distance from nearby nations
PLAYER_HUE = 0.60  # player is electric blue
cands = []
for i in range(72):
    h = (i / 72.0)
    if abs(h - PLAYER_HUE) < 0.085 or abs(h - PLAYER_HUE) > 0.915:
        continue
    for s, l in ((0.62, 0.50), (0.55, 0.42), (0.70, 0.58)):
        cands.append((h, s, l))


def rgb(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))


def hdist(a, b):
    d = abs(a[0] - b[0]); d = min(d, 1 - d)
    return d * 3 + abs(a[2] - b[2]) * 1.2 + abs(a[1] - b[1]) * 0.5

rng = random.Random(7)
assigned = []
for nat in sorted(nations, key=lambda n: (n['x'] - W / 2) ** 2 + (n['y'] - H / 2) ** 2):
    near = [a for a in assigned if (a[0]['x'] - nat['x']) ** 2 + (a[0]['y'] - nat['y']) ** 2 < 120 ** 2]
    best, bs = None, -1
    for c in cands:
        if any(c == a[1] for a in assigned):
            continue
        sc = min([hdist(c, a[1]) / (1 + math.hypot(a[0]['x'] - nat['x'], a[0]['y'] - nat['y']) / 60) for a in near] or [9])
        sc += rng.random() * 0.02
        if sc > bs:
            best, bs = c, sc
    assigned.append((nat, best))
    nat['c'] = rgb(*best)

# ---------------- city states (bots) ----------------
capcells = [(n['x'], n['y']) for n in nations]
cs = []
for c in sorted(cities, key=lambda c: -c['p']):
    if c['t'] == 3:
        continue
    if min((c['x'] - x) ** 2 + (c['y'] - y) ** 2 for x, y in capcells) < 26 ** 2:
        continue
    if any((c['x'] - o['x']) ** 2 + (c['y'] - o['y']) ** 2 < 30 ** 2 for o in cs):
        continue
    cs.append(dict(n=c['n'], x=c['x'], y=c['y']))
print('city-state candidates', len(cs))

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

out = dict(meta=M, grid=core['grid'], vec=core['vec'], relief=core['relief'], cities=cities, nations=nations, cs=cs, seas=seas)
js = 'window.MAPDATA=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(B + 'mapdata.js', 'w').write(js)
print('mapdata.js bytes', len(js.encode()))
for n in nations:
    print(n['iso'], n['n'], n['c'], n['x'], n['y'])

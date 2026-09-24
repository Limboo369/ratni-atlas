"""Historical borders for Ratni Atlas eras -> build/eradata.js

Sources: historical-basemaps by A. Ourednik (GPL-3.0) for past years, Natural Earth (public domain) for today.
Each era: polities with Bosnian names, capitals, and an owner raster on the game grid.
Pipeline per era: dataset polygons -> polity by NAME, manual paint fixes, tribal fill anchors for unnamed areas,
gap fill (nearest polity), sliver cleanup, tiny polities merged, capitals snapped, colours assigned.
"""
import json, math, base64, zlib, colorsys, random, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

B = ROOT + 'build/'
D = ROOT + 'data/'
core = json.load(open(B + 'mapdata_core.json'))
M = core['meta']
W, H, X0, Y0, CELL = M['W'], M['H'], M['X0'], M['Y0'], M['CELL']
grid = np.frombuffer(zlib.decompress(base64.b64decode(core['grid'])), np.uint8).reshape(H, W)
LAND = (grid & 3) != 0
MD = json.loads(open(B + 'mapdata.js').read()[len('window.MAPDATA='):].rstrip().rstrip(';'))
CITIES = MD['cities']
NATIONS = MD['nations']


def gxy(lon, lat):
    x = (lon + 180.0) / 360.0
    lat = max(min(lat, 85.0), -85.0)
    r = math.radians(lat)
    y = (1 - math.log(math.tan(math.pi / 4 + r / 2)) / math.pi) / 2
    return ((x - X0) / CELL, (y - Y0) / CELL)


def polys_of(geom):
    t = geom['type']
    if t == 'Polygon':
        return [geom['coordinates']]
    if t == 'MultiPolygon':
        return geom['coordinates']
    return []


def area_ll(polys):
    a = 0
    for poly in polys:
        e = poly[0]
        s = 0
        for k in range(len(e) - 1):
            s += e[k][0] * e[k + 1][1] - e[k + 1][0] * e[k][1]
        a += abs(s) / 2
    return a


def raster_features(features):
    """features: list of (props, polys). Returns (feature list in draw order, int raster of 1-based indices)."""
    feats = []
    for pr, polys in features:
        keep = []
        for poly in polys:
            ext = poly[0]
            lons = [p[0] for p in ext]
            lats = [p[1] for p in ext]
            if max(lons) < -12 or min(lons) > 42 or max(lats) < 32 or min(lats) > 72:
                continue
            keep.append(poly)
        if keep:
            feats.append((pr, keep))
    feats.sort(key=lambda t: -area_ll(t[1]))  # big first, small (enclaves) on top
    img = Image.new('I', (W, H), 0)
    dr = ImageDraw.Draw(img)
    for idx, (pr, polys) in enumerate(feats):
        for poly in polys:
            pts = [gxy(p[0], p[1]) for p in poly[0]]
            if len(pts) >= 3:
                dr.polygon(pts, fill=idx + 1)
            for hole in poly[1:]:
                hp = [gxy(p[0], p[1]) for p in hole]
                if len(hp) >= 3:
                    dr.polygon(hp, fill=0)
    return feats, np.asarray(img, dtype=np.int32).copy()


def paint_mask(poly_ll):
    img = Image.new('L', (W, H), 0)
    ImageDraw.Draw(img).polygon([gxy(lo, la) for lo, la in poly_ll], fill=1)
    return np.asarray(img, dtype=bool)


def cell_of(lon, lat):
    x, y = gxy(lon, lat)
    return int(y), int(x)


# ---------------------------------------------------------------------------------------------------------
# Era definitions. Polity: key, Bosnian name, dataset names, capital (lon, lat, name or None), extras:
#   fill=[(lon,lat),...] anchors that claim unnamed/unmatched areas (nearest anchor wins)
# paint: list of (key or None, polygon) applied after the dataset (None = neutral land)
# ---------------------------------------------------------------------------------------------------------
ERAS = []

ERAS.append(dict(
    id='rim', src='hist/world_100.geojson',
    pol=[
        ('ROM', 'Rimsko carstvo', ['Roman Empire', 'Dumonii'], (12.48, 41.90, 'Roma')),
        ('DAC', 'Dakija', ['Dacia'], (23.31, 45.62, 'Sarmizegetusa')),
        ('MAR', 'Markomansko kraljevstvo', ['Boihaenum'], (17.2, 49.0, None)),
        ('BOS', 'Bosporsko kraljevstvo', ['Bosporian Kingdom'], (36.47, 45.35, 'Pantikapej')),
        ('SKI', 'Skitija', ['Scythians'], (34.1, 44.95, 'Skitski Neapolj')),
        ('ALA', 'Pleme Alana', ['Alans'], (40.0, 44.8, None)),
        ('KAL', 'Kaledonija', [], (-4.2, 56.6, None), dict(fill=[(-4.3, 56.9)])),
        ('HIB', 'Hibernija', [], (-7.6, 53.4, None), dict(fill=[(-8.0, 53.3)])),
        ('FRI', 'Pleme Frizijaca', [], (6.6, 53.1, None), dict(fill=[(6.6, 53.0)])),
        ('HER', 'Pleme Heruska', [], (9.9, 52.1, None), dict(fill=[(9.9, 51.8)])),
        ('ANG', 'Pleme Angla', [], (9.4, 55.9, None), dict(fill=[(9.3, 56.0)])),
        ('SVE', 'Pleme Sveva', [], (12.9, 52.3, None), dict(fill=[(12.9, 52.1)])),
        ('VAN', 'Pleme Vandala', [], (17.0, 51.1, None), dict(fill=[(16.9, 51.0)])),
        ('GOT', 'Pleme Gota', [], (18.7, 53.7, None), dict(fill=[(18.9, 53.7)])),
        ('EST', 'Pleme Esta', [], (22.6, 55.3, None), dict(fill=[(22.8, 55.4)])),
        ('SVI', 'Pleme Sviona', [], (17.0, 59.8, None), dict(fill=[(16.5, 60.4), (10.5, 61.5)])),
        ('GAU', 'Pleme Gauta', [], (13.4, 58.0, None), dict(fill=[(13.6, 57.6), (8.0, 58.8)])),
        ('LAP', 'Laponija', [], (24.0, 67.3, None), dict(fill=[(22.5, 67.5), (16.0, 68.0)])),
        ('FEN', 'Pleme Fena', [], (29.5, 62.2, None), dict(fill=[(28.5, 62.3), (36.0, 64.5)])),
        ('VEN', 'Pleme Veneda', [], (27.0, 53.3, None), dict(fill=[(26.5, 53.4)])),
        ('BUD', 'Pleme Budina', [], (36.5, 55.8, None), dict(fill=[(36.5, 56.0), (39.0, 59.5)])),
        ('SAR', 'Sarmatija', [], (31.5, 48.6, None), dict(fill=[(31.0, 48.8)])),
        ('JAZ', 'Pleme Jaziga', [], (20.2, 46.9, None), dict(fill=[(20.3, 46.9)])),
        ('ROX', 'Pleme Roksolana', [], (37.8, 49.6, None), dict(fill=[(38.0, 49.8)])),
        ('GET', 'Getulija', [], (3.5, 33.6, None), dict(fill=[(3.0, 33.4), (9.0, 33.5), (-3.0, 33.4)])),
    ],
    # everything the dataset calls a "culture" or leaves unnamed is split between the tribal anchors
    unmatched='fill',
    ren={'Rim': 'Roma', 'London': 'Londinijum', 'Pariz': 'Lutecija', 'Lion': 'Lugdunum', 'Marselj': 'Masilija', 'Bordo': 'Burdigala',
         'Tuluz': 'Toloza', 'Nica': 'Nikeja', 'Keln': 'Kolonija', 'Strasbourg': 'Argentorat', 'Trst': 'Tergeste', 'Milano': 'Mediolanum',
         'Torino': 'Taurinum', 'Bologna': 'Bononija', 'Firenca': 'Florencija', 'Napulj': 'Neapolis', 'Salerno': 'Salernum', 'Palermo': 'Panorm',
         'Katanija': 'Katana', 'Cagliari': 'Karalis', 'Venecija': 'Altinum', 'Beč': 'Vindobona', 'Budimpešta': 'Akvinkum', 'Beograd': 'Singidunum',
         'Niš': 'Naisus', 'Sofija': 'Serdika', 'Istanbul': 'Bizant', 'Solun': 'Tesalonika', 'Atina': 'Atena', 'Patra': 'Patre', 'Larissa': 'Larisa',
         'Skoplje': 'Skupi', 'Drač': 'Dirahij', 'Split': 'Salona', 'Zadar': 'Jader', 'Pula': 'Pola', 'Rijeka': 'Tarsatika', 'Zagreb': 'Andautonija',
         'Ljubljana': 'Emona', 'Osijek': 'Mursa', 'Plovdiv': 'Filipopolj', 'Varna': 'Odesos', 'Constanța': 'Tomis', 'Barcelona': 'Barcino',
         'Valensija': 'Valentija', 'Sevilja': 'Hispalis', 'Lisabon': 'Olisipo', 'Porto': 'Portus Kale', 'Braga': 'Brakara', 'Coimbra': 'Eminij',
         'La Coruña': 'Brigantijum', 'Faro': 'Osonoba', 'Tanger': 'Tingis', 'Fes': 'Volubilis', 'Rabat': 'Sala', 'Alžir': 'Ikozijum',
         'Konstantin': 'Cirta', 'Annaba': 'Hipon', 'Tunis': 'Kartagina', 'Izmir': 'Smirna', 'Ankara': 'Ankira', 'Bursa': 'Pruza', 'Konya': 'Ikonij',
         'Antalya': 'Atalija', 'Trabzon': 'Trapezunt', 'Samsun': 'Amis', 'Bejrut': 'Berit', 'Alep': 'Beroja', 'Homs': 'Emesa', 'Sevastopol': 'Hersones',
         'Simferopol': 'Skitski Neapolj', 'Rostov na Donu': 'Tanais', 'Odesa': 'Olbija', 'Newcastle': 'Pons Elije', 'Manchester': 'Mamucij',
         'Dablin': 'Eblana', 'Salzburg': 'Juvavum', 'Linz': 'Lentija', 'Bazel': 'Augusta Raurika', 'Ženeva': 'Genava', 'Cirih': 'Turikum',
         'Mostar': 'Mostar', 'Maribor': 'Poetovij', 'Győr': 'Arabona', 'Pečuh': 'Sopijane', 'Sarajevo': 'Akve S.', 'Dubrovnik': 'Epidaur',
         'Bitolj': 'Herakleja', 'Kluž': 'Napoka'},
))

ERAS.append(dict(
    id='srednji', src='hist/world_1400.geojson',
    pol=[
        ('KAL', 'Kalmarska unija', ['Kalmar Union'], (12.57, 55.68, 'Kopenhagen'), dict(fill=[(20.5, 67.8), (15.0, 68.0)])),
        ('NOV', 'Novgorodska republika', ['Novgorod'], (31.27, 58.52, 'Novgorod'), dict(fill=[(33.0, 67.2), (29.0, 68.8)])),
        ('ZLH', 'Zlatna horda', ['Blue Horde'], (39.4, 47.1, 'Azak')),
        ('MOS', 'Moskovska kneževina', [], (37.62, 55.75, 'Moskva')),
        ('POL', 'Poljsko-litvanska unija', ['Poland-Lithuania'], (19.94, 50.06, 'Krakov')),
        ('TEU', 'Teutonski red', ['Teutonic Knights'], (19.03, 54.04, 'Marijenburg')),
        ('HRE', 'Sveto Rimsko Carstvo', ['Holy Roman Empire'], (14.42, 50.09, 'Prag')),
        ('HUN', 'Kraljevina Ugarska', ['Kingdom of Hungary'], (19.04, 47.50, 'Budim')),
        ('BOS', 'Kraljevina Bosna', ['Bosnia'], (18.26, 44.13, 'Bobovac')),
        ('SRB', 'Srpska despotovina', [], (21.33, 43.58, 'Kruševac')),
        ('ZET', 'Zeta', [], (19.51, 42.07, 'Skadar')),
        ('ALB', 'Albanske kneževine', [], (19.79, 41.51, 'Kruja')),
        ('EPI', 'Epirska despotovina', [], (20.85, 39.67, 'Janjina')),
        ('BYZ', 'Bizantsko carstvo', [], (28.98, 41.01, 'Konstantinopolj')),
        ('OTT', 'Osmansko carstvo', ['Ottoman Empire', 'Bulgar Khanate', 'Beylik of Aydin', 'Byzantine Empire'], (26.56, 41.68, 'Edirne')),
        ('WAL', 'Vlaška', ['Principality of Wallachia'], (25.45, 44.93, 'Trgovište')),
        ('MOL', 'Moldavija', ['Moldova'], (26.25, 47.65, 'Sučava')),
        ('KAR', 'Karamanski bejlik', ['Seljuk Caliphate'], (32.49, 37.87, 'Konja')),
        ('TRE', 'Trapezuntsko carstvo', ['Trebizond'], (39.72, 41.00, 'Trapezunt')),
        ('TIM', 'Timuridsko carstvo', ['Timurid Empire'], (40.2, 37.2, None)),
        ('MAM', 'Mamelučki sultanat', ['Mamluke Sultanate'], (36.30, 33.51, 'Damask'), dict(fill=[(39.0, 33.6)])),
        ('CAS', 'Kastilja', ['Castile'], (-4.02, 39.86, 'Toledo')),
        ('ARA', 'Aragon', ['Aragón'], (-0.88, 41.65, 'Saragosa')),
        ('POR', 'Portugal', ['Portugal'], (-9.14, 38.72, 'Lisabon')),
        ('NAV', 'Navara', ['Navarre'], (-1.64, 42.82, 'Pamplona')),
        ('GRA', 'Granadski emirat', ['Granada'], (-3.60, 37.18, 'Granada')),
        ('FRA', 'Francuska', ['France'], (2.35, 48.86, 'Pariz')),
        ('BRE', 'Bretanja', ['Britany'], (-1.55, 47.22, 'Nant')),
        ('ENG', 'Engleska', ['English territory'], (-0.13, 51.50, 'London')),
        ('SCO', 'Škotska', ['Scotland'], (-3.19, 55.95, 'Edinburg')),
        ('IRL', 'Irska kraljevstva', [], (-8.5, 53.0, None)),
        ('PAP', 'Papinska država', ['Papal States'], (12.48, 41.90, 'Rim')),
        ('NAP', 'Napuljsko kraljevstvo', ['Sicily'], (14.25, 40.85, 'Napulj')),
        ('SIC', 'Kraljevina Sicilija', [], (13.36, 38.12, 'Palermo')),
        ('SAR', 'Sardinija', ['Sardinia'], (8.59, 39.90, 'Oristano')),
        ('GEN', 'Republika Đenova', ['Corsica'], (8.93, 44.41, 'Đenova')),
        ('MIL', 'Milansko vojvodstvo', [], (9.19, 45.46, 'Milano')),
        ('FIR', 'Firentinska republika', [], (11.25, 43.77, 'Firenca')),
        ('VEN', 'Mletačka republika', ['Venice'], (12.34, 45.44, 'Venecija')),
        ('CYP', 'Kiparsko kraljevstvo', ['Cyprus'], (33.36, 35.17, 'Nikozija')),
        ('HAF', 'Hafsidski sultanat', ['Hafsid Caliphate'], (10.18, 36.80, 'Tunis')),
        ('MRN', 'Marinidski sultanat', ['Morocco'], (-5.00, 34.03, 'Fes')),
    ],
    paint=[
        ('MOS', [(33.6, 54.2), (33.8, 57.3), (36.5, 58.2), (41.0, 58.3), (41.0, 54.6), (38.6, 53.7), (35.4, 53.8)]),
        ('SRB', [(19.3, 44.85), (20.4, 44.95), (21.4, 44.7), (22.6, 44.3), (22.5, 43.4), (21.9, 42.55), (20.6, 42.25), (20.0, 42.75), (19.55, 43.3), (19.45, 44.2)]),
        ('BOS', [(15.75, 45.2), (16.9, 45.25), (18.0, 45.1), (19.0, 44.9), (19.4, 44.3), (19.5, 43.4), (19.2, 43.1), (18.6, 42.6), (17.8, 42.9), (17.25, 43.4), (16.4, 44.0), (15.8, 44.6)]),
        ('ZET', [(18.55, 42.45), (18.95, 42.95), (19.6, 42.9), (19.85, 42.3), (19.45, 41.85), (18.95, 42.05)]),
        ('ALB', [(19.3, 41.9), (19.6, 42.1), (20.35, 42.05), (20.6, 41.1), (20.3, 40.35), (19.9, 39.95), (19.3, 40.4), (19.4, 41.4)]),
        ('EPI', [(19.9, 39.95), (20.3, 40.35), (21.1, 40.0), (21.35, 39.1), (20.7, 38.85), (20.2, 39.3)]),
        ('BYZ', [(28.45, 40.95), (28.45, 41.5), (29.1, 41.25), (29.05, 41.0)]),
        ('BYZ', [(21.1, 37.9), (21.3, 38.35), (22.9, 38.1), (23.3, 37.5), (23.2, 36.4), (22.4, 36.4), (21.6, 36.7)]),
        ('VEN', [(23.5, 35.2), (23.5, 35.7), (26.3, 35.4), (26.3, 34.9), (24.5, 34.9)]),
        ('VEN', [(11.9, 45.2), (12.0, 45.95), (12.6, 46.15), (13.05, 45.75), (12.6, 45.2)]),
        ('MIL', [(8.5, 44.85), (8.5, 46.2), (9.5, 46.45), (10.6, 46.05), (11.2, 45.3), (10.5, 44.75), (9.2, 44.6)]),
        ('FIR', [(10.2, 43.4), (10.3, 44.3), (11.4, 44.2), (12.3, 43.8), (11.8, 43.0), (10.6, 42.9)]),
        ('GEN', [(7.6, 43.8), (7.6, 44.45), (9.9, 44.5), (10.0, 44.05), (8.3, 43.85)]),
        ('SIC', [(12.3, 37.5), (12.3, 38.35), (15.55, 38.35), (15.4, 37.9), (15.7, 37.0), (15.3, 36.6), (14.7, 36.6)]),
        ('IRL', [(-10.6, 51.4), (-10.6, 55.45), (-6.2, 55.45), (-5.4, 54.5), (-5.9, 53.5), (-6.0, 52.0), (-6.3, 51.4)]),
        ('ENG', [(-6.95, 53.2), (-6.95, 53.95), (-6.0, 53.95), (-6.0, 53.2)]),
    ],
    unmatched='fill',
    ren={'Istanbul': 'Konstantinopolj', 'Izmir': 'Smirna', 'Kaliningrad': 'Kenigsberg', 'Gdanjsk': 'Dancig', 'Sankt Peterburg': 'Orešek',
         'Turku': 'Abo', 'Talin': 'Reval', 'Tartu': 'Dorpat', 'Bratislava': 'Požun', 'Budimpešta': 'Budim', 'Sarajevo': 'Vrhbosna',
         'Tuzla': 'Soli', 'Podgorica': 'Ribnica', 'Kazablanka': 'Anfa', 'Trabzon': 'Trapezunt', 'Konya': 'Konja', 'Oslo': 'Oslo'},
))

ERAS.append(dict(
    id='napoleon', src='hist/world_1815.geojson',
    pol=[
        ('RUS', 'Rusko carstvo', ['Russian Empire'], (30.32, 59.94, 'Sankt Peterburg')),
        ('SWN', 'Švedska i Norveška', ['Sweden–Norway'], (18.07, 59.33, 'Stokholm')),
        ('OTT', 'Osmansko carstvo', ['Ottoman Empire'], (28.98, 41.01, 'Carigrad')),
        ('AUT', 'Austrijsko carstvo', ['Austrian Empire', 'Venetia', 'Lombardy', 'Modena', 'Parma'], (16.37, 48.21, 'Beč')),
        ('FRA', 'Francuska', ['France'], (2.35, 48.86, 'Pariz')),
        ('ESP', 'Španija', ['Spain'], (-3.70, 40.42, 'Madrid')),
        ('GBR', 'Ujedinjeno Kraljevstvo', ['United Kingdom of Great Britain and Ireland'], (-0.13, 51.50, 'London')),
        ('PRU', 'Pruska', ['Prussia'], (13.40, 52.52, 'Berlin')),
        ('ALG', 'Alžirski dejlik', ['Algiers'], (3.06, 36.75, 'Alžir')),
        ('MOR', 'Maroko', ['Morocco'], (-5.00, 34.03, 'Fes')),
        ('BAV', 'Bavarska', ['Bavaria', 'Palatinate'], (11.58, 48.14, 'Minhen')),
        ('SIC', 'Kraljevina Dvije Sicilije', ['Kingdom of the Two Sicilies'], (14.25, 40.85, 'Napulj')),
        ('POR', 'Portugal', ['Portugal'], (-9.14, 38.72, 'Lisabon')),
        ('TUN', 'Tuniski bejlik', ['Tunis'], (10.18, 36.80, 'Tunis')),
        ('DEN', 'Danska', ['Denmark', 'Holstein', 'Schleswig'], (12.57, 55.68, 'Kopenhagen')),
        ('HAN', 'Hanover', ['Hanover'], (9.73, 52.37, 'Hanover')),
        ('NED', 'Nizozemska', ['United Kingdom of Netherlands', 'Luxembourg'], (4.90, 52.37, 'Amsterdam')),
        ('SAR', 'Kraljevina Sardinija', ['Kingdom of Sardinia'], (7.69, 45.07, 'Torino')),
        ('SUI', 'Švicarska', ['Switzerland'], (7.45, 46.95, 'Bern')),
        ('PAP', 'Papinska država', ['Papal States'], (12.48, 41.90, 'Rim')),
        ('SAX', 'Saksonija', ['Saxony'], (13.74, 51.05, 'Drezden')),
        ('TOS', 'Toskana', ['Tuscany', 'Lucca'], (11.25, 43.77, 'Firenca')),
        ('THU', 'Tiringija', ['Thuringia', 'Anhalt'], (11.33, 50.98, 'Vajmar')),
        ('MEC', 'Meklenburg', ['Mecklenburg-Schwerin', 'Mecklenburg-Strelitz'], (11.41, 53.63, 'Šverin')),
        ('WUR', 'Virtemberg', ['Württemberg'], (9.18, 48.78, 'Štutgart')),
        ('BAD', 'Baden', ['Baden'], (8.40, 49.01, 'Karlsrue')),
        ('HES', 'Hesen', ['Electoral Hesse', 'Grand Duchy of Hesse', 'Nassau', 'Waldeck', 'Lippe-Detmold'], (9.49, 51.31, 'Kasel')),
        ('OLD', 'Oldenburg', ['Oldenburg', 'Brunswick'], (8.21, 53.14, 'Oldenburg')),
        ('KRA', 'Slobodni grad Krakov', ['Republic of Kraków'], (19.94, 50.06, 'Krakov')),
    ],
    unmatched='near',
    ren={'Istanbul': 'Carigrad', 'Kaliningrad': 'Kenigsberg', 'Gdanjsk': 'Dancig', 'Oslo': 'Kristijanija', 'Talin': 'Reval', 'Tartu': 'Dorpat',
         'Bratislava': 'Požun'},
))

ERAS.append(dict(
    id='ww1', src='hist/world_1914.geojson',
    pol=[
        ('RUS', 'Rusko carstvo', ['Russian Empire', 'Finland', 'Georgia'], (30.32, 59.94, 'Petrograd')),
        ('SWE', 'Švedska', ['Sweden'], (18.07, 59.33, 'Stokholm')),
        ('NOR', 'Norveška', ['Norway'], (10.75, 59.91, 'Kristijanija')),
        ('AUH', 'Austro-Ugarska', ['Austro-Hungarian Empire'], (16.37, 48.21, 'Beč')),
        ('GER', 'Njemačko carstvo', ['German Empire'], (13.40, 52.52, 'Berlin')),
        ('OTT', 'Osmansko carstvo', ['Ottoman Empire', 'Arabia (Nejd)'], (28.98, 41.01, 'Carigrad')),
        ('FRA', 'Francuska', ['France', 'Algeria', 'Tunisia', 'Morocco'], (2.35, 48.86, 'Pariz')),
        ('GBR', 'Ujedinjeno Kraljevstvo', ['United Kingdom of Great Britain and Ireland'], (-0.13, 51.50, 'London')),
        ('ESP', 'Španija', ['Spain', 'Spanish Morocco'], (-3.70, 40.42, 'Madrid')),
        ('ITA', 'Kraljevina Italija', ['Kingdom of Italy'], (12.48, 41.90, 'Rim')),
        ('ROU', 'Rumunija', ['Romania'], (26.10, 44.43, 'Bukurešt')),
        ('BGR', 'Bugarska', ['Bulgaria'], (23.32, 42.70, 'Sofija')),
        ('SRB', 'Srbija', ['Serbia'], (20.46, 44.82, 'Beograd')),
        ('GRC', 'Grčka', ['Greece'], (23.73, 37.98, 'Atina')),
        ('POR', 'Portugal', ['Portugal'], (-9.14, 38.72, 'Lisabon')),
        ('DEN', 'Danska', ['Denmark'], (12.57, 55.68, 'Kopenhagen')),
        ('SUI', 'Švicarska', ['Switzerland'], (7.45, 46.95, 'Bern')),
        ('NED', 'Holandija', ['Netherlands'], (4.90, 52.37, 'Amsterdam')),
        ('BEL', 'Belgija', ['Belgium'], (4.35, 50.85, 'Brisel')),
        ('ALB', 'Albanija', ['Albania'], (19.45, 41.32, 'Drač')),
        ('MNE', 'Crna Gora', ['Montenegro'], (18.92, 42.39, 'Cetinje')),
        ('LUX', 'Luksemburg', ['Luxembourg'], (6.13, 49.61, 'Luksemburg')),
    ],
    paint=[('GRC', [(23.5, 35.2), (23.5, 35.7), (26.3, 35.4), (26.3, 34.9), (24.5, 34.9)])],
    unmatched='near',
    ren={'Istanbul': 'Carigrad', 'Kaliningrad': 'Kenigsberg', 'Gdanjsk': 'Dancig', 'Oslo': 'Kristijanija', 'Talin': 'Reval',
         'Sankt Peterburg': 'Petrograd', 'Bratislava': 'Požun', 'Tartu': 'Dorpat'},
))

ERAS.append(dict(
    id='ww2', src='hist/world_1938.geojson',
    pol=[
        ('SSR', 'SSSR', ['USSR', 'Armenia'], (37.62, 55.75, 'Moskva')),
        ('GER', 'Njemačka', ['Germany'], (13.40, 52.52, 'Berlin')),
        ('FRA', 'Francuska', ['France', 'Algeria (France)', 'Morocco (France)', 'Tunisia', 'Syria (France)'], (2.35, 48.86, 'Pariz')),
        ('GBR', 'Ujedinjeno Kraljevstvo', ['United Kingdom'], (-0.13, 51.50, 'London')),
        ('ITA', 'Italija', ['Italy'], (12.48, 41.90, 'Rim')),
        ('POL', 'Poljska', ['Poland'], (21.01, 52.23, 'Varšava')),
        ('SWE', 'Švedska', ['Sweden'], (18.07, 59.33, 'Stokholm')),
        ('FIN', 'Finska', ['Finland'], (24.94, 60.17, 'Helsinki')),
        ('NOR', 'Norveška', ['Norway'], (10.75, 59.91, 'Oslo')),
        ('ESP', 'Španija', ['Spain'], (-3.70, 40.42, 'Madrid')),
        ('TUR', 'Turska', ['Turkey'], (32.86, 39.93, 'Ankara')),
        ('ROU', 'Rumunija', ['Romania'], (26.10, 44.43, 'Bukurešt')),
        ('YUG', 'Kraljevina Jugoslavija', ['Yugoslavia'], (20.46, 44.82, 'Beograd')),
        ('HUN', 'Mađarska', ['Hungary'], (19.04, 47.50, 'Budimpešta')),
        ('GRC', 'Grčka', ['Greece'], (23.73, 37.98, 'Atina')),
        ('CSK', 'Čehoslovačka', ['Czechoslovakia'], (14.42, 50.09, 'Prag')),
        ('BGR', 'Bugarska', ['Bulgaria'], (23.32, 42.70, 'Sofija')),
        ('LVA', 'Latvija', ['Latvia'], (24.11, 56.95, 'Riga')),
        ('LTU', 'Litvanija', ['Lithuania'], (23.90, 54.90, 'Kaunas')),
        ('EST', 'Estonija', ['Estonia'], (24.75, 59.44, 'Talin')),
        ('IRL', 'Irska', ['Ireland'], (-6.26, 53.35, 'Dablin')),
        ('POR', 'Portugal', ['Portugal'], (-9.14, 38.72, 'Lisabon')),
        ('DEN', 'Danska', ['Denmark'], (12.57, 55.68, 'Kopenhagen')),
        ('SUI', 'Švicarska', ['Switzerland'], (7.45, 46.95, 'Bern')),
        ('NED', 'Holandija', ['Netherlands'], (4.90, 52.37, 'Amsterdam')),
        ('BEL', 'Belgija', ['Belgium'], (4.35, 50.85, 'Brisel')),
        ('ALB', 'Albanija', ['Albania'], (19.82, 41.33, 'Tirana')),
        ('IRQ', 'Irak', ['Mesopotamia (GB)'], (40.2, 33.4, None)),
        ('LUX', 'Luksemburg', ['Luxembourg'], (6.13, 49.61, 'Luksemburg')),
    ],
    unmatched='near',
    ren={'Kaliningrad': 'Kenigsberg', 'Gdanjsk': 'Dancig', 'Sankt Peterburg': 'Lenjingrad', 'Donetsk': 'Staljino', 'Dnjepar': 'Dnjepropetrovsk',
         'Tver': 'Kalinjin', 'Vilnjus': 'Vilno', 'Lavov': 'Lavov', 'Oslo': 'Oslo'},
))

ERAS.append(dict(
    id='hladni', src='hist/world_1960.geojson',
    pol=[
        ('SSR', 'SSSR', ['USSR'], (37.62, 55.75, 'Moskva')),
        ('FRG', 'Zapadna Njemačka', ['West Germany'], (7.10, 50.73, 'Bon')),
        ('GDR', 'Istočna Njemačka', ['East Germany'], (13.40, 52.52, 'Berlin')),
        ('FRA', 'Francuska', ['France', 'Algeria'], (2.35, 48.86, 'Pariz')),
        ('GBR', 'Ujedinjeno Kraljevstvo', ['United Kingdom'], (-0.13, 51.50, 'London')),
        ('ITA', 'Italija', ['Italy'], (12.48, 41.90, 'Rim')),
        ('POL', 'Poljska', ['Poland'], (21.01, 52.23, 'Varšava')),
        ('SWE', 'Švedska', ['Sweden'], (18.07, 59.33, 'Stokholm')),
        ('FIN', 'Finska', ['Finland'], (24.94, 60.17, 'Helsinki')),
        ('NOR', 'Norveška', ['Norway'], (10.75, 59.91, 'Oslo')),
        ('ESP', 'Španija', ['Spain'], (-3.70, 40.42, 'Madrid')),
        ('TUR', 'Turska', ['Turkey'], (32.86, 39.93, 'Ankara')),
        ('ROU', 'Rumunija', ['Romania'], (26.10, 44.43, 'Bukurešt')),
        ('YUG', 'Jugoslavija', ['Yugoslavia'], (20.46, 44.82, 'Beograd')),
        ('CSK', 'Čehoslovačka', ['Czechoslovakia'], (14.42, 50.09, 'Prag')),
        ('HUN', 'Mađarska', ['Hungary'], (19.04, 47.50, 'Budimpešta')),
        ('BGR', 'Bugarska', ['Bulgaria'], (23.32, 42.70, 'Sofija')),
        ('GRC', 'Grčka', ['Greece'], (23.73, 37.98, 'Atina')),
        ('AUT', 'Austrija', ['Austria'], (16.37, 48.21, 'Beč')),
        ('SYR', 'Sirija', ['Syria'], (36.30, 33.51, 'Damask')),
        ('MAR', 'Maroko', ['Morocco'], (-6.84, 34.02, 'Rabat')),
        ('IRL', 'Irska', ['Ireland'], (-6.26, 53.35, 'Dablin')),
        ('TUN', 'Tunis', ['Tunisia'], (10.18, 36.80, 'Tunis')),
        ('POR', 'Portugal', ['Portugal'], (-9.14, 38.72, 'Lisabon')),
        ('DEN', 'Danska', ['Denmark'], (12.57, 55.68, 'Kopenhagen')),
        ('SUI', 'Švicarska', ['Switzerland'], (7.45, 46.95, 'Bern')),
        ('NED', 'Holandija', ['Netherlands'], (4.90, 52.37, 'Amsterdam')),
        ('BEL', 'Belgija', ['Belgium'], (4.35, 50.85, 'Brisel')),
        ('ALB', 'Albanija', ['Albania'], (19.82, 41.33, 'Tirana')),
        ('IRQ', 'Irak', ['Iraq'], (40.2, 33.4, None)),
        ('LBN', 'Liban', ['Lebanon'], (35.50, 33.89, 'Bejrut')),
        ('CYP', 'Kipar', ['Cyprus'], (33.36, 35.17, 'Nikozija')),
        ('LUX', 'Luksemburg', ['Luxembourg'], (6.13, 49.61, 'Luksemburg')),
    ],
    unmatched='near',
    ren={'Sankt Peterburg': 'Lenjingrad', 'Donetsk': 'Staljino', 'Dnjepar': 'Dnjepropetrovsk', 'Tver': 'Kalinjin', 'Podgorica': 'Titograd'},
))

# today: Natural Earth countries; disputed areas start as free land
DANAS_EXTRA = {'LUX': ('Luksemburg', (6.13, 49.61, 'Luksemburg')), 'LBN': ('Liban', (35.50, 33.89, 'Bejrut')), 'GEO': ('Gruzija', None),
               'IRQ': ('Irak', None), 'LBY': ('Libija', None), 'ISR': ('Izrael', None), 'JOR': ('Jordan', None)}
ERAS.append(dict(id='danas', src='ne', unmatched='near', ren={}, tiny='neutral',
                 paint=[(None, [(32.3, 45.35), (33.1, 46.15), (33.75, 46.25), (34.6, 46.2), (35.35, 45.4), (36.7, 45.55), (36.75, 44.9),
                                (35.5, 44.3), (33.3, 44.3)])]))

MIN_POL = 40      # smaller polities are merged into a neighbour
SLIVER = 10       # disconnected land pieces smaller than this (touching others) join their neighbour


def build_era(E):
    land = LAND.copy()
    if E['src'] == 'ne':
        fs = json.load(open(D + 'ne_50m_admin_0_countries.geojson'))['features']
        feats, arr = raster_features([(f['properties'], polys_of(f['geometry'])) for f in fs])
        nat = {n['iso']: n for n in NATIONS}
        pol = []
        for n in NATIONS:
            pol.append((n['iso'], n['n'], [n['iso']], None, dict(cell=(n['y'], n['x']), capName=n['cap'], color=n['c'])))
        for k, (nm, cap) in DANAS_EXTRA.items():
            pol.append((k, nm, [k], cap))
        keyname = lambda pr: pr.get('ADM0_A3')
        neutral_keys = {'KOS', 'CYN'}
    else:
        fs = json.load(open(D + E['src']))['features']
        feats, arr = raster_features([(f['properties'], polys_of(f['geometry'])) for f in fs])
        pol = E['pol']
        keyname = lambda pr: (pr.get('NAME') or '').strip() or (pr.get('SUBJECTO') or '').strip() or None
        neutral_keys = set()
    P = []
    for t in pol:
        key, name, hb, cap = t[:4]
        ex = t[4] if len(t) > 4 else {}
        P.append(dict(k=key, n=name, hb=hb, cap=cap, fill=ex.get('fill', []), cell=ex.get('cell'), capName=ex.get('capName'), color=ex.get('color')))
    idx_of = {p['k']: i + 1 for i, p in enumerate(P)}
    by_name = {}
    for i, p in enumerate(P):
        for nm in p['hb']:
            by_name[nm] = i + 1
    # 1) dataset features -> polity
    fmap = np.zeros(len(feats) + 1, np.int32)
    fstate = np.zeros(len(feats) + 1, np.int8)  # 0 none, 1 matched, 2 unmatched feature, 3 neutral feature
    for fi, (pr, polys) in enumerate(feats):
        kn = keyname(pr)
        if kn in by_name:
            fmap[fi + 1] = by_name[kn]
            fstate[fi + 1] = 1
        elif kn in neutral_keys:
            fstate[fi + 1] = 3
        else:
            fstate[fi + 1] = 2
    own = np.where(land, fmap[arr], 0).astype(np.int32)
    state = np.where(land, fstate[arr], 0)
    locked = np.zeros((H, W), bool)  # neutral on purpose
    locked |= land & (state == 3)
    # 2) manual paint
    for key, poly in E.get('paint', []):
        m = paint_mask(poly) & land
        if key is None:
            own[m] = 0
            locked |= m
            state[m] = 3
        else:
            own[m] = idx_of[key]
            state[m] = 1
    # 3) tribal anchors claim unmatched / unnamed areas
    anchors = []
    for i, p in enumerate(P):
        for lo, la in p['fill']:
            y, x = gxy(lo, la)[1], gxy(lo, la)[0]
            anchors.append((x, y, i + 1))
    if anchors:
        todo = land & (own == 0) & ~locked & (state == 2)
        ys, xs = np.nonzero(todo)
        if len(ys):
            A = np.array([[a[0], a[1]] for a in anchors])
            d = np.sqrt((xs[:, None] - A[None, :, 0]) ** 2 + (ys[:, None] - A[None, :, 1]) ** 2)
            rs = np.random.RandomState(5)
            fields = []
            for k in range(len(anchors)):
                f = ndimage.gaussian_filter(rs.randn(H, W), 9)
                fields.append(f / (f.std() + 1e-9))
            d = d + np.stack([f[ys, xs] for f in fields], axis=1) * 9.0
            best = np.argmin(d, axis=1)
            own[ys, xs] = np.array([a[2] for a in anchors])[best]
    # 4) everything else on land: nearest polity
    todo = land & (own == 0) & ~locked
    if todo.any():
        _, (iy, ix) = ndimage.distance_transform_edt(own == 0, return_indices=True)
        own[todo] = own[iy[todo], ix[todo]]
    # 5) sliver cleanup (twice)
    for _ in range(2):
        for pi in range(1, len(P) + 1):
            m = own == pi
            if not m.any():
                continue
            lab, n = ndimage.label(m)
            if n <= 1:
                continue
            sizes = ndimage.sum(m, lab, range(1, n + 1))
            for ci, sz in enumerate(sizes):
                if sz >= SLIVER:
                    continue
                comp = lab == ci + 1
                ring = ndimage.binary_dilation(comp) & ~comp & land
                nb = own[ring]
                nb = nb[(nb != pi) & (nb != 0)]
                if len(nb):
                    own[comp] = np.bincount(nb).argmax()
    # 6) tiny polities -> biggest neighbour
    changed = True
    while changed:
        changed = False
        cnt = np.bincount(own.ravel(), minlength=len(P) + 1)
        for pi in range(1, len(P) + 1):
            if 0 < cnt[pi] < MIN_POL:
                m = own == pi
                ring = ndimage.binary_dilation(m, iterations=2) & ~m & land
                nb = own[ring]
                nb = nb[(nb != pi) & (nb != 0)]
                if E.get('tiny') == 'neutral':
                    tgt = 0
                elif len(nb):
                    tgt = np.bincount(nb).argmax()
                else:
                    _, (iy, ix) = ndimage.distance_transform_edt(~((own != 0) & (own != pi)), return_indices=True)
                    ys, xs = np.nonzero(m)
                    tgt = own[iy[ys[0], xs[0]], ix[ys[0], xs[0]]]
                print(f'  merge tiny {P[pi-1]["k"]} ({cnt[pi]}) -> {P[tgt-1]["k"] if tgt else "-"}')
                own[m] = tgt
                changed = True
                break
    cnt = np.bincount(own.ravel(), minlength=len(P) + 1)
    # 7) capitals
    city_cells = {(c['y'], c['x']): c for c in CITIES}
    out = []
    remap = np.zeros(len(P) + 1, np.int32)
    ys_all, xs_all = np.indices((H, W))
    for pi, p in enumerate(P, start=1):
        if cnt[pi] == 0:
            continue
        m = own == pi
        cap_name = p['capName']
        if p['cell']:
            cy, cx = p['cell']
        elif p['cap']:
            cy, cx = cell_of(p['cap'][0], p['cap'][1])
            cap_name = p['cap'][2]
        else:
            cy = cx = -1
        ok = 0 <= cy < H and 0 <= cx < W and own[cy, cx] == pi
        if not ok and cy >= 0:
            best = None
            for r in range(1, 7):
                for dy in range(-r, r + 1):
                    for dx in range(-r, r + 1):
                        y, x = cy + dy, cx + dx
                        if 0 <= y < H and 0 <= x < W and own[y, x] == pi:
                            d = dx * dx + dy * dy
                            if best is None or d < best[0]:
                                best = (d, y, x)
                if best:
                    break
            if best:
                cy, cx, ok = best[1], best[2], True
        if not ok:
            # biggest own city, else the most interior cell near the centroid
            cs = [c for c in CITIES if own[c['y'], c['x']] == pi]
            if cs:
                c = max(cs, key=lambda c: (c['t'], c['p']))
                cy, cx = c['y'], c['x']
            else:
                dist = ndimage.distance_transform_edt(m)
                my, mx = ys_all[m].mean(), xs_all[m].mean()
                score = np.where(m, dist - 0.05 * np.hypot(ys_all - my, xs_all - mx), -1e9)
                cy, cx = np.unravel_index(np.argmax(score), score.shape)
                cy, cx = int(cy), int(cx)
            cap_name = None if not p['cap'] or not ok else cap_name
        if not cap_name:
            # nearest map city name inside the polity
            cs = [c for c in CITIES if own[c['y'], c['x']] == pi]
            if cs:
                c = min(cs, key=lambda c: (c['x'] - cx) ** 2 + (c['y'] - cy) ** 2)
                cap_name = E['ren'].get(c['n'], c['n'])
            else:
                cap_name = '—'
        remap[pi] = len(out) + 1
        out.append(dict(k=p['k'], n=p['n'], x=int(cx), y=int(cy), cap=cap_name, cells=int(cnt[pi]), color=p['color']))
    own = remap[own]
    return out, own


def assign_colors(pols, seed):
    PLAYER_HUE = 0.60
    cands = []
    for i in range(72):
        h = i / 72.0
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

    def hls_of(hexc):
        r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        return (h, s, l)
    rng = random.Random(seed)
    assigned = []
    fixed = [p for p in pols if p['color']]
    for p in fixed:
        assigned.append((p, hls_of(p['color'])))
    for p in sorted([p for p in pols if not p['color']], key=lambda p: (p['x'] - W / 2) ** 2 + (p['y'] - H / 2) ** 2):
        near = [a for a in assigned if (a[0]['x'] - p['x']) ** 2 + (a[0]['y'] - p['y']) ** 2 < 140 ** 2]
        best, bs = None, -1
        for c in cands:
            if any(c == a[1] for a in assigned):
                continue
            sc = min([hdist(c, a[1]) / (1 + math.hypot(a[0]['x'] - p['x'], a[0]['y'] - p['y']) / 60) for a in near] or [9])
            sc += rng.random() * 0.02
            if sc > bs:
                best, bs = c, sc
        assigned.append((p, best))
        p['color'] = rgb(*best)


def preview(E, pols, own):
    img = np.zeros((H, W, 3), np.uint8)
    img[:] = (40, 60, 90)
    lut = np.array([(235, 235, 235)] + [tuple(int(p['color'][i:i + 2], 16) for i in (1, 3, 5)) for p in pols], np.uint8)
    img[LAND] = lut[own][LAND]
    im = Image.fromarray(img).resize((W * 2, H * 2), Image.NEAREST)
    dr = ImageDraw.Draw(im)
    for p in pols:
        if p['cells'] < 60:
            continue
        x, y = p['x'] * 2, p['y'] * 2
        dr.rectangle([x - 3, y - 3, x + 3, y + 3], fill=(0, 0, 0))
        dr.text((x + 5, y - 6), p['n'][:24], fill=(0, 0, 0))
    os.makedirs(B + 'shots', exist_ok=True)
    im.save(B + f'shots/era_{E["id"]}.png')


def main():
    only = set(sys.argv[1:])
    out = {}
    for i, E in enumerate(ERAS):
        if only and E['id'] not in only:
            continue
        print('era', E['id'])
        pols, own = build_era(E)
        assign_colors(pols, 11 + i)
        preview(E, pols, own)
        own8 = own.astype(np.uint8)
        assert own.max() < 250
        b64 = base64.b64encode(zlib.compress(own8.tobytes(), 9)).decode()
        out[E['id']] = dict(pol=[dict(k=p['k'], n=p['n'], x=p['x'], y=p['y'], cap=p['cap'], c=p['color']) for p in pols], own=b64, ren=E['ren'])
        print(f'  polities {len(pols)}  bytes {len(b64)}  neutral land {int((LAND & (own == 0)).sum())}')
        for p in sorted(pols, key=lambda p: -p['cells']):
            print(f'    {p["k"]:4} {p["n"]:28} {p["cells"]:6} cap {p["cap"]}')
    if not only:
        js = 'window.ERADATA=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
        open(B + 'eradata.js', 'w').write(js)
        print('eradata.js bytes', len(js.encode()))


if __name__ == '__main__':
    main()

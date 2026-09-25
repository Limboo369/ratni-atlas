"""World 1815, after the Congress of Vienna (historical-basemaps world_1815).
Europe: same keys and names as the Europe map's napoleon table in build/eras.py (28 polities, unchanged there); a few of
them (GBR, ESP, POR, NED) gain overseas hb entries here that don't exist on the Europe grid.
India: British East India Company gets its own polity 'Britanska Indija' (BIN) rather than folding into GBR - in 1815 it
was still a chartered company, not the Crown (British Raj starts only in 1858), and splitting it off keeps the tiny home
isles readable next to a subcontinent-sized territory. Canada is likewise its own polity (CAN): the dataset's Canada
feature isn't SUBJECTO-tagged to Britain, and Quebec/York were governed separately from London anyway.
Spanish America: kept at the dataset's own viceroyalty granularity (Nova Spanija/Peru/Nova Granada/Rio de la Plata) rather
than one blob or a dozen future republics - Chile, Bolivia, Ecuador, Venezuela etc. don't exist as separate borders yet.
Sikh Empire has no dataset feature (the basemap folds Punjab into the EIC polygon) so it's carved out with PAINT.
Durrani succession Afghanistan, Sokoto (dataset: 'Fulani Empire') and Ashanti (dataset: 'Asante') use the dataset's own
single-feature borders. Central Asia's two dataset blobs (Turan + the Kazakh/Bukharan khanates) merge into one polity -
neither was a unified state, splitting them wouldn't be more correct. Minor African/Pacific/Siberian 'culture' and tribal
features (Aboriginal Australian groups, Zulu/Xhosa/Buganda/Bunyoro/..., Somalia, Pampas/Patagonian hunter-gatherers) stay
free land, as instructed - inventing 40 tribal micro-states would swamp the 190-polity cap for no gameplay gain."""
SRC = 'hist/world_1815.geojson'

POLITIES = [
    # --- Europe: identical key + name to build/eras.py's napoleon table ---
    ('RUS', 'Rusko carstvo', ['Russian Empire'], (30.32, 59.94, 'Sankt Peterburg')),
    ('SWN', 'Švedska i Norveška', ['Sweden–Norway'], (18.07, 59.33, 'Stokholm')),
    ('OTT', 'Osmansko carstvo', ['Ottoman Empire'], (28.98, 41.01, 'Carigrad')),
    ('AUT', 'Austrijsko carstvo', ['Austrian Empire', 'Venetia', 'Lombardy', 'Modena', 'Parma'], (16.37, 48.21, 'Beč')),
    ('FRA', 'Francuska', ['France', 'Guadeloupe'], (2.35, 48.86, 'Pariz')),
    ('ESP', 'Španija', ['Spain', 'Philippines', 'Guanches'], (-3.70, 40.42, 'Madrid')),
    ('GBR', 'Ujedinjeno Kraljevstvo', ['United Kingdom of Great Britain and Ireland', 'United Kingdom', 'New South Wales',
                                       'Cape Colony', 'Sierra Leone', 'Ceylon', 'Trinidad'], (-0.13, 51.50, 'London')),
    ('PRU', 'Pruska', ['Prussia'], (13.40, 52.52, 'Berlin')),
    ('ALG', 'Alžirski dejlik', ['Algiers'], (3.06, 36.75, 'Alžir')),
    ('MOR', 'Maroko', ['Morocco'], (-5.00, 34.03, 'Fes')),
    ('BAV', 'Bavarska', ['Bavaria', 'Palatinate'], (11.58, 48.14, 'Minhen')),
    ('SIC', 'Kraljevina Dvije Sicilije', ['Kingdom of the Two Sicilies'], (14.25, 40.85, 'Napulj')),
    ('POR', 'Portugal', ['Portugal', 'Angola', 'Portuguese East Africa', 'Portuguese Guinea', 'Goa'], (-9.14, 38.72, 'Lisabon')),
    ('TUN', 'Tuniski bejlik', ['Tunis'], (10.18, 36.80, 'Tunis')),
    ('DEN', 'Danska', ['Denmark', 'Holstein', 'Schleswig'], (12.57, 55.68, 'Kopenhagen')),
    ('HAN', 'Hanover', ['Hanover'], (9.73, 52.37, 'Hanover')),
    ('NED', 'Nizozemska', ['United Kingdom of Netherlands', 'Luxembourg', 'Dutch East Indies', 'Netherlands Antilles', 'Guiana'],
     (4.90, 52.37, 'Amsterdam')),
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
    # --- The Americas ---
    ('USA', 'Sjedinjene Američke Države', ['United States'], (-77.04, 38.90, 'Vašington')),
    ('CAN', 'Kanada', ['Canada'], (-71.21, 46.81, 'Kvebek')),
    ('NSP', 'Nova Španija', ['Viceroyalty of New Spain'], (-99.13, 19.43, 'Meksiko')),
    ('NGR', 'Nova Granada', ['Viceroyalty of New Granada'], (-74.07, 4.71, 'Bogota')),
    ('PER', 'Potkraljevstvo Peru', ['Viceroyalty of Peru'], (-77.04, -12.05, 'Lima')),
    ('RPL', 'Ujedinjene provincije Rio de la Plate', ['United Provinces of the Río de la Plata'], (-58.38, -34.60, 'Buenos Ajres')),
    ('PRY', 'Paragvaj', ['Paraguay'], (-57.58, -25.26, 'Asunsion')),
    ('BRA', 'Portugalski Brazil', ['Viceroyalty of Brazil'], (-43.17, -22.91, 'Rio de Žaneiro')),
    ('HTI', 'Haiti', ['Haiti'], (-72.34, 18.54, 'Port o Prens')),
    ('HAW', 'Havajsko kraljevstvo', ['Kingdom of Hawaii'], (-157.86, 21.31, 'Honolulu')),
    # --- Africa ---
    ('EGY', 'Egipat', ['Egypt'], (31.24, 30.04, 'Kairo')),
    ('TRP', 'Tripolitanija', ['Tripolitania', 'Cyrenaica'], (13.19, 32.88, 'Tripoli')),
    ('SOK', 'Sokotski kalifat', ['Fulani Empire'], (5.82, 13.06, 'Sokoto')),
    ('ASA', 'Ašantsko carstvo', ['Asante'], (-1.62, 6.69, 'Kumasi')),
    ('FAN', 'Fantski savez', ['Fante'], (-1.25, 5.11, None)),
    ('OYO', 'Carstvo Ojo', ['Oyo'], (4.18, 8.15, None)),
    ('KBR', 'Kanem-Bornu', ['Kanem-Bornu'], (13.15, 12.93, None)),
    ('KAA', 'Kaarta', ['Kaarta'], (-9.5, 14.5, None)),
    ('MSI', 'Mosijske države', ['Mossi States'], (-1.5, 12.3, None)),
    ('ETH', 'Etiopija', ['Ethiopia'], (38.74, 9.03, 'Adis Abeba')),
    ('MAD', 'Merinsko kraljevstvo', ['Merina Kingdom'], (47.53, -18.88, 'Antananarivo')),
    ('KON', 'Kraljevstvo Kongo', ['Congo'], (15.75, -6.27, None)),
    # --- Middle East and Central Asia ---
    ('NJD', 'Emirat Nedžd', ['Nejd'], (46.72, 24.63, 'Rijad')),
    ('OMA', 'Oman', ['Oman', 'Zanzibar'], (58.59, 23.61, 'Maskat')),
    ('YEM', 'Jemen', ['Yemen'], (44.21, 15.35, 'Sana')),
    ('IRN', 'Perzija', ['Persia'], (51.39, 35.69, 'Teheran')),
    ('AFG', 'Durranijsko carstvo', ['Afghanistan'], (69.17, 34.53, 'Kabul')),
    ('BUK', 'Srednjoazijski hanati', ['Turan', 'central Asian khanates'], (64.42, 39.77, 'Buhara')),
    ('SIK', 'Sikhsko carstvo', [], (74.34, 31.55, 'Lahor')),
    # --- South, South-East and East Asia ---
    ('BIN', 'Britanska Indija', ['British East India Company'], (88.36, 22.57, 'Kalkuta')),
    ('MAR', 'Maratska konfederacija', ['Maratha Confederacy'], (73.86, 18.52, 'Puna')),
    ('MYS', 'Majsur', ['Mysore (Indian princely state)'], (76.65, 12.31, 'Majsur')),
    ('OUD', 'Audh', ['Oudh'], (81.23, 26.85, 'Laknau')),
    ('TRV', 'Travankor', ['Travancore'], (76.57, 8.81, 'Trivandrum')),
    ('SKK', 'Sikim', ['Sikkim (Indian princely state)'], (88.53, 27.33, None)),
    ('NPL', 'Nepal', ['Nepal'], (85.32, 27.71, 'Katmandu')),
    ('BTN', 'Butan', ['Bhutan'], (89.86, 27.58, 'Punaka')),
    ('ASM', 'Asam', ['Assam'], (94.90, 26.75, None)),
    ('BUR', 'Burma', ['Burma', 'Arakan'], (96.10, 21.98, 'Ava')),
    ('SIA', 'Sijam', ['Rattanakosin Kingdom'], (100.50, 13.75, 'Bangkok')),
    ('KHM', 'Kambodža', ['Cambodia'], (104.85, 11.56, None)),
    ('VNM', 'Vijetnam', ['Annam', 'Cochin China'], (107.58, 16.47, 'Hue')),
    ('MLY', 'Malaja', ['Malaya'], (102.25, 4.20, None)),
    ('BRU', 'Brunej', ['Brunei'], (114.94, 4.94, None)),
    ('KOR', 'Koreja', ['Korea'], (126.98, 37.57, 'Seul')),
    ('JPN', 'Japan', ['Japan'], (139.69, 35.69, 'Edo')),
    ('CHN', 'Carstvo Ćing', ['Manchu Empire', 'Hong Kong'], (116.40, 39.90, 'Peking')),
]

PAINT = [
    # Sikh Empire (Ranjit Singh): no dataset feature - the basemap folds Punjab into the EIC polygon. Rough 1815 borders:
    # Sutlej river in the east (Cis-Sutlej states are British-protected), short of Multan/Kashmir/Peshawar (taken later).
    ('SIK', [(73.0, 29.3), (73.0, 32.0), (74.3, 33.8), (76.5, 32.2), (75.8, 29.8)]),
    # Dataset error: a second feature literally NAMEd 'Dutch East Indies' (SUBJECTO 'Netherlands') sits in South Africa,
    # not Indonesia - a stale VOC-era polygon for the Cape that the source never updated for 1815 (Britain held it from
    # 1806, confirmed at the Congress of Vienna). Without this paint it wrongly joins NED. Repaint it into GBR's Cape
    # Colony (convex hull of the actual polygon, so it doesn't reach into free Xhosa land further east).
    ('GBR', [(17.43, -30.57), (18.34, -32.34), (22.59, -34.13), (23.19, -34.24), (24.59, -34.36), (25.52, -34.17),
             (25.57, -34.14), (25.62, -33.92), (25.63, -32.38), (22.03, -31.17), (21.44, -30.99)]),
]

RENAMES = {
    # as on the Europe map
    'Istanbul': 'Carigrad', 'Kaliningrad': 'Kenigsberg', 'Gdanjsk': 'Dancig', 'Oslo': 'Kristijanija', 'Talin': 'Reval',
    'Tartu': 'Dorpat', 'Bratislava': 'Požun',
    # period-accurate elsewhere (same name in 1815 as in 1914, so safe to reuse) - no anachronistic modern renames added
    'Ankara': 'Angora', 'Izmir': 'Smirna', 'Tbilisi': 'Tiflis', 'Nju Delhi': 'Delhi', 'Mumbaj': 'Bombaj', 'Čenaj': 'Madras',
    'Jangon': 'Rangun',
}

# tribal / hunter-gatherer 'culture' features the dataset happens to name - stay free land on purpose, not invented states
NEUTRAL = ['Pampas cultures', 'Patagonian shellfish and marine mammal hunters', 'Shuar', 'Somalia']

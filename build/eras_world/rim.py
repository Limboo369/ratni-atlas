"""World year 100 (historical-basemaps world_100, Roman era). Europe uses the same table as the Europe map's rim
era in build/eras.py (same keys/names for Rome, Dacia, the Bosporan kingdom, the Scythians, the Alans and the
Marcomanni) plus the Old World's other great powers of the time. Most of the dataset outside these is unnamed or a
'culture'/hunter-gatherer label (no state) and stays free land; the small Germanic/Baltic/Sarmatian tribes that the
Europe map fills in with hand-placed anchors are not (there is no safe way to bound that fill to Europe alone on a
world-wide grid), so that land shows as free/neutral here instead — see the report for details."""
SRC = 'hist/world_100.geojson'

POLITIES = [
    # Europe, same keys/names as build/eras.py's 'rim' era
    ('ROM', 'Rimsko carstvo', ['Roman Empire', 'Dumonii'], (12.48, 41.90, 'Roma')),
    ('DAC', 'Dakija', ['Dacia'], (23.31, 45.62, 'Sarmizegetusa')),
    ('MAR', 'Markomansko kraljevstvo', ['Boihaenum'], (17.2, 49.0, None)),
    ('BOS', 'Bosporsko kraljevstvo', ['Bosporian Kingdom'], (36.47, 45.35, 'Pantikapej')),
    ('SKI', 'Skitija', ['Scythians'], (34.1, 44.95, 'Skitski Neapolj')),
    ('ALA', 'Pleme Alana', ['Alans'], (40.0, 44.8, None)),
    # the rest of the Old World
    ('PAR', 'Partsko carstvo', ['Parthian Empire'], (44.58, 33.09, 'Ktesifon')),
    ('KUS', 'Kušansko carstvo', ['Kushan Empire', 'Suren Kingdom'], (71.58, 34.01, 'Purušapura')),
    ('HAN', 'Carstvo Han', ['Han'], (112.47, 34.62, 'Luojang')),
    ('SJO', 'Južni Sjongnu', ['Southern Xiongnu'], (102.2, 41.3, 'Ordos')),
    ('SAK', 'Kraljevstvo Saka', ['Saka Kingdom'], (73.0, 25.7, None)),
    ('ARM', 'Jermenija', ['Armenia'], (44.55, 39.95, 'Artašat')),
    ('AKS', 'Aksumsko kraljevstvo', ['Axum'], (38.72, 14.13, 'Aksum')),
    ('MER', 'Meroitsko kraljevstvo', ['Meroe'], (33.75, 16.94, 'Meroe')),
    ('BLE', 'Pleme Blemija', ['Blemmyes'], (35.1, 22.2, 'Talmis')),
    ('NAB', 'Nabatejsko kraljevstvo', ['Nabatean Kingdom'], (35.44, 30.33, 'Petra')),
    ('HIM', 'Himjarsko kraljevstvo', ['Himyarite Kingdom'], (44.24, 14.22, 'Zafar')),
    ('HAD', 'Hadramaut', ['Hadramaut'], (51.2, 16.7, 'Šabwa')),
    ('SAT', 'Satavahansko carstvo', ['Satavahanihara'], (75.38, 19.48, 'Pratišthana')),
    ('KLG', 'Kalinga', ['Kalinga'], (83.9, 18.3, 'Dantapura')),
    ('HIN', 'Hinduistička kraljevstva', ['Hindu kingdoms'], (82.9, 26.3, 'Pataliputra')),
    ('SIM', 'Simhala', ['Simhala'], (80.40, 8.35, 'Anuradhapura')),
    ('KOG', 'Kogurjo', ['Koguryo'], (126.15, 41.13, 'Gungnae')),
    ('PAE', 'Pekče', ['Paekche'], (127.05, 37.5, 'Viresong')),
    ('SIL', 'Silla', ['Silla'], (129.22, 35.84, 'Kjongdžu')),
    ('GAY', 'Gaja', ['Gaya'], (128.75, 35.23, 'Kimhe')),
    # Africa beyond Rome: the dataset's two huge culture areas split between several tribal polities (SPLIT below)
    ('GAR', 'Garamanti', [], (14.43, 26.35, 'Garama')),
    ('SEN', 'Plemena Senegambije', [], (-14.4, 13.6, 'Sine-Salum')),
    ('DJE', 'Džene-Dženo', [], (-4.55, 13.9, 'Džene')),
    ('NOK', 'Kultura Nok', [], (8.0, 9.5, 'Nok')),
    ('SAO', 'Kultura Sao', [], (15.0, 12.0, 'Sao')),
    ('DAR', 'Plemena Darfura', [], (24.9, 13.6, 'Džebel Mara')),
    ('KOI', 'Kojsani', [], (21.74, -18.75, 'Tsodilo')),
    ('BNT', 'Bantu plemena', [], (26.4, -8.6, 'Upemba')),
    ('KON', 'Plemena Konga', [], (18.0, -1.0, 'Ekvatorija')),
    ('KSS', 'Kušitski stočari', [], (36.5, -3.0, 'Engaruka')),
    ('ZAM', 'Plemena Zambezija', [], (31.0, -17.5, 'Mapungubve')),
    # the Americas: the dataset's named cultures as tribal polities (only the Maya and Teotihuacan were states) ---------
    ('MAY', 'Maje', ['Maya chiefdoms and states'], (-89.62, 17.22, 'Tikal')),
    ('TEO', 'Teotihuakan', ['Teotihuacan'], (-98.84, 19.69, 'Teotihuakan')),
    ('ZAP', 'Zapoteci', ['Monte Albán'], (-96.77, 17.04, 'Monte Alban')),
    ('HOP', 'Kultura Hopvel', ['Hopewell Culture'], (-82.98, 39.33, 'Čilikot')),
    ('SWC', 'Kultura Svift Krik', ['Swift Creek Culture', 'Porter', 'Copena', 'Miller', 'Glades Culture'], (-84.93, 31.47, 'Kolomoki')),
    ('MRK', 'Kultura Marksvil', ['Marksville Culture', 'Fourche Maline Culture', 'Mill Creek Culture'], (-92.05, 31.12, 'Marksvil')),
    ('PPN', 'Plemena Velikih jezera', ['Point Peninsula', 'Saugeen Complex', 'Couture Complex', 'Goodall Focus'], (-76.2, 43.4, 'Point Peninsula')),
    ('LAU', 'Kultura Lorel', ['Laurel complex'], (-93.7, 48.6, 'Rejni River')),
    ('PLS', 'Plemena sjevernih ravnica', [], (-101.4, 47.3, 'Najf River')),
    ('PLJ', 'Plemena južnih ravnica', [], (-101.9, 35.6, 'Alibejts')),
    ('DES', 'Plemena pustinje', ['Desert hunter-gatherers'], (-109.5, 36.1, 'Kanjon de Šej')),
    ('PLT', 'Plemena visoravni', ['Plateau fichers and hunter gatherers'], (-120.9, 45.65, 'Selajlo')),
    ('PAC', 'Plemena pacifičke obale', ['North American Pacific foraging, hunting and fishing peoples'], (-124.6, 48.15, 'Ozet')),
    ('MOC', 'Moče', ['Moche'], (-78.99, -8.13, 'Moče')),
    ('NAS', 'Naska', ['Nazca'], (-75.13, -14.83, 'Kavači')),
    ('AND', 'Andska plemena', ['Andean hunter-gatherers'], (-70.0, -32.6, 'Akonkagva')),
    ('PAM', 'Plemena pampe', ['Pampas cultures'], (-65.2, -36.9, 'Salinas')),
    ('AMG', 'Plemena gornje Amazone', [], (-64.7, -3.35, 'Tefe')),
    ('AMD', 'Plemena donje Amazone', [], (-51.0, -2.0, 'Marajo')),
    ('CHA', 'Plemena Čaka', [], (-60.5, -22.5, 'Čako')),
    ('CER', 'Plemena Cerada', [], (-43.9, -19.6, 'Lagoa Santa')),
    ('PAT', 'Patagonci', ['Patagonian shellfish and marine mammal hunters'], (-69.7, -52.1, 'Pali Aike')),
    ('SAM', 'Sambakiji', ['Shellfish gatherers'], (-48.8, -26.9, 'Sambaki')),
    ('KRB', 'Karipska plemena', ['Caribbean hunter-gatherers'], (-62.2, 8.7, 'Barankas')),
    # Oceania: the one aboriginal area split into regions, Tasmania, New Guinea (no feature: PAINT) ---------------------
    ('ARA', 'Arande', [], (131.04, -25.34, 'Uluru')),
    ('KIM', 'Plemena Kimberlija', [], (125.5, -17.5, 'Kimberli')),
    ('ARN', 'Plemena Arnhema', [], (132.9, -12.4, 'Ubir')),
    ('KVI', 'Plemena Kvinslenda', [], (144.2, -15.9, 'Kvinkan')),
    ('MUR', 'Plemena rijeke Marej', [], (143.0, -33.7, 'Mungo')),
    ('ZAU', 'Plemena zapada', [], (117.5, -29.5, 'Vadžuk')),
    ('TAS', 'Tasmanci', ['Tasmanian hunter-gatherers'], (145.8, -42.4, 'Kutikina')),
    ('PAP', 'Papuanska plemena', [], (144.33, -5.78, 'Kuk')),
]

# the dataset's culture areas are continent-sized: shared between several tribal polities (nearest anchor)
SPLIT = {
    'West African cereal farmers': [('SEN', (-13.0, 13.5)), ('DJE', (-4.5, 14.0)), ('NOK', (8.0, 9.5)), ('SAO', (15.0, 11.0)), ('DAR', (25.0, 12.0))],
    'Khoisan': [('KOI', (21.0, -24.0)), ('BNT', (25.0, -9.0)), ('KON', (18.0, -1.0)), ('KSS', (36.0, -3.0)), ('ZAM', (31.0, -17.0))],
    'Plain bison hunters': [('PLS', (-101.0, 46.5)), ('PLJ', (-100.0, 35.5))],
    'Plain-Pottery culture': [('PLS', (-101.0, 46.5))],
    'Amazon hunter-gatherers': [('AMG', (-68.0, -5.0)), ('AMD', (-53.0, -4.0))],
    'Savanna hunter-gatherers': [('CHA', (-60.5, -22.5)), ('CER', (-46.0, -14.0))],
    'Australian aboriginal hunter-gatherers': [('ARA', (133.0, -24.0)), ('KIM', (124.0, -18.0)), ('ARN', (134.0, -14.0)),
                                               ('KVI', (144.5, -20.0)), ('MUR', (144.0, -33.5)), ('ZAU', (118.0, -29.0))],
}
PAINT = [
    ('GAR', [(10.5, 27.5), (12.0, 28.8), (15.5, 28.6), (17.5, 27.0), (17.2, 24.5), (14.5, 23.2), (11.5, 23.8), (10.0, 25.5)]),
    ('PAP', [(131.0, -0.3), (151.0, -0.3), (151.0, -10.8), (146.0, -10.8), (144.5, -9.6), (141.5, -9.6), (141.0, -9.1), (131.0, -9.1)]),
]

RENAMES = {
    # as on the Europe map (only the ones that are also world-map city names)
    'Rim': 'Roma', 'London': 'Londinijum', 'Pariz': 'Lutecija', 'Milano': 'Mediolanum', 'Firenca': 'Florencija',
    'Napulj': 'Neapolis', 'Beč': 'Vindobona', 'Budimpešta': 'Akvinkum', 'Beograd': 'Singidunum', 'Sofija': 'Serdika',
    'Istanbul': 'Bizant', 'Atina': 'Atena', 'Skoplje': 'Skupi', 'Zagreb': 'Andautonija', 'Ljubljana': 'Emona',
    'Barcelona': 'Barcino', 'Valensija': 'Valentija', 'Lisabon': 'Olisipo', 'Rabat': 'Sala', 'Alžir': 'Ikozijum',
    'Tunis': 'Kartagina', 'Izmir': 'Smirna', 'Ankara': 'Ankira', 'Bejrut': 'Berit', 'Alep': 'Beroja',
    'Sevastopol': 'Hersones', 'Dablin': 'Eblana', 'Sarajevo': 'Akve S.',
}

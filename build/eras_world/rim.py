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

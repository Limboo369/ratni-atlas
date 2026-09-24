"""World 1914, on the eve of the First World War (historical-basemaps world_1914).
Empires keep their colonies (automatic by SUBJECTO, or listed by name below). The dominions (Kanada, Njufaundlend,
Australija, Novi Zeland, Južnoafrička Unija) are polities of their own; British India is part of the British Empire.
Europe: same keys and names as the Europe map's ww1 table in build/eras.py (Britain is 'Britansko carstvo' here)."""
SRC = 'hist/world_1914.geojson'

POLITIES = [
    # Europe (as on the Europe map) + their empires
    ('RUS', 'Rusko carstvo', ['Russian Empire', 'Russia', 'Finland', 'Georgia', 'Azerbaijan', 'Armenia'], (30.32, 59.94, 'Petrograd')),
    ('SWE', 'Švedska', ['Sweden'], (18.07, 59.33, 'Stokholm')),
    ('NOR', 'Norveška', ['Norway'], (10.75, 59.91, 'Kristijanija')),
    ('AUH', 'Austro-Ugarska', ['Austro-Hungarian Empire'], (16.37, 48.21, 'Beč')),
    ('GER', 'Njemačko carstvo', ['German Empire', 'German South-West Africa', 'Kamerun', 'Togoland', 'Papua New Guinea', 'Samoa'],
     (13.40, 52.52, 'Berlin')),
    ('OTT', 'Osmansko carstvo', ['Ottoman Empire'], (28.98, 41.01, 'Carigrad')),
    ('FRA', 'Francuska', ['France', 'Algeria', 'Tunisia', 'Morocco', 'French Guiana', 'Guadeloupe'], (2.35, 48.86, 'Pariz')),
    ('GBR', 'Britansko carstvo', ['United Kingdom of Great Britain and Ireland', 'United Kingdom', 'British Raj', 'Malta', 'Malaya',
                                  'Ceylon', 'Guyana', 'Belize', 'Sierra Leone', 'Gambia, The', 'Uganda', 'Swaziland', 'Lesotho',
                                  'Kuwait', 'Qatar', 'Brunei', 'Fiji'], (-0.13, 51.50, 'London')),
    ('ESP', 'Španija', ['Spain', 'Spanish Morocco', 'Rio De Oro', 'Equatorial Guinea'], (-3.70, 40.42, 'Madrid')),
    ('ITA', 'Kraljevina Italija', ['Kingdom of Italy', 'Italy'], (12.48, 41.90, 'Rim')),
    ('ROU', 'Rumunija', ['Romania'], (26.10, 44.43, 'Bukurešt')),
    ('BGR', 'Bugarska', ['Bulgaria'], (23.32, 42.70, 'Sofija')),
    ('SRB', 'Srbija', ['Serbia'], (20.46, 44.82, 'Beograd')),
    ('GRC', 'Grčka', ['Greece'], (23.73, 37.98, 'Atina')),
    ('POR', 'Portugal', ['Portugal', 'Portuguese Guinea'], (-9.14, 38.72, 'Lisabon')),
    ('DEN', 'Danska', ['Denmark', 'Iceland'], (12.57, 55.68, 'Kopenhagen')),
    ('SUI', 'Švicarska', ['Switzerland'], (7.45, 46.95, 'Bern')),
    ('NED', 'Holandija', ['Netherlands', 'Netherlands Indies', 'Suriname'], (4.90, 52.37, 'Amsterdam')),
    ('BEL', 'Belgija', ['Belgium'], (4.35, 50.85, 'Brisel')),
    ('ALB', 'Albanija', ['Albania'], (19.45, 41.32, 'Drač')),
    ('MNE', 'Crna Gora', ['Montenegro'], (18.92, 42.39, 'Cetinje')),
    ('LUX', 'Luksemburg', ['Luxembourg'], (6.13, 49.61, 'Luksemburg')),
    # Asia
    ('NJD', 'Emirat Nedžd', ['Arabia (Nejd)'], (46.72, 24.63, 'Rijad')),
    ('IRN', 'Perzija', ['Persia'], (51.39, 35.69, 'Teheran')),
    ('AFG', 'Afganistan', ['Afghanistan'], (69.17, 34.53, 'Kabul')),
    ('NPL', 'Nepal', ['Nepal'], (85.32, 27.71, 'Katmandu')),
    ('BTN', 'Butan', ['Bhutan'], (89.86, 27.58, 'Punaka')),
    ('TIB', 'Tibet', ['Tibet'], (91.13, 29.65, 'Lasa')),
    ('MNG', 'Mongolija', ['Mongolia'], (106.91, 47.92, 'Urga')),
    ('CHN', 'Republika Kina', ['Manchu Empire', 'Xinjiang'], (116.40, 39.90, 'Peking')),
    ('JPN', 'Japansko carstvo', ['Empire of Japan'], (139.69, 35.69, 'Tokio')),
    ('SIA', 'Sijam', ['Rattanakosin Kingdom'], (100.50, 13.75, 'Bangkok')),
    # Africa
    ('ETH', 'Etiopsko carstvo', ['Abyssinia'], (38.74, 9.03, 'Adis Abeba')),
    ('LBR', 'Liberija', ['Liberia'], (-10.80, 6.30, 'Monrovija')),
    ('ZAF', 'Južnoafrička Unija', ['South Africa'], (28.19, -25.75, 'Pretorija')),
    # the Americas
    ('USA', 'Sjedinjene Američke Države', ['United States', 'Puerto Rico', 'Philippines'], (-77.04, 38.90, 'Vašington')),
    ('CAN', 'Kanada', ['Canada'], (-75.70, 45.42, 'Otava')),
    ('NFL', 'Njufaundlend', [], (-52.71, 47.56, 'Sent Džons')),
    ('MEX', 'Meksiko', ['Mexico'], (-99.13, 19.43, 'Meksiko')),
    ('GTM', 'Gvatemala', ['Guatemala'], (-90.51, 14.64, 'Gvatemala')),
    ('HND', 'Honduras', ['Honduras'], (-87.21, 14.07, 'Tegusigalpa')),
    ('SLV', 'Salvador', ['El Salvador'], (-89.19, 13.69, 'San Salvador')),
    ('NIC', 'Nikaragva', ['Nicaragua'], (-86.25, 12.13, 'Managva')),
    ('CRI', 'Kostarika', ['Costa Rica'], (-84.09, 9.93, 'San Hose')),
    ('PAN', 'Panama', ['Panama'], (-79.52, 8.98, 'Panama')),
    ('CUB', 'Kuba', ['Cuba'], (-82.37, 23.11, 'Havana')),
    ('HTI', 'Haiti', ['Haiti'], (-72.34, 18.54, 'Port o Prens')),
    ('DOM', 'Dominikanska Republika', ['Dominican Republic'], (-69.93, 18.47, 'Santo Domingo')),
    ('COL', 'Kolumbija', ['Colombia'], (-74.07, 4.71, 'Bogota')),
    ('VEN', 'Venecuela', ['Venezuela'], (-66.90, 10.49, 'Karakas')),
    ('ECU', 'Ekvador', ['Ecuador'], (-78.47, -0.18, 'Kito')),
    ('PER', 'Peru', ['Peru'], (-77.04, -12.05, 'Lima')),
    ('BRA', 'Brazil', ['Brazil'], (-43.17, -22.91, 'Rio de Žaneiro')),
    ('BOL', 'Bolivija', ['Bolivia'], (-68.15, -16.50, 'La Paz')),
    ('CHL', 'Čile', ['Chile'], (-70.65, -33.45, 'Santiago')),
    ('ARG', 'Argentina', ['Argentina'], (-58.38, -34.60, 'Buenos Ajres')),
    ('PRY', 'Paragvaj', ['Paraguay'], (-57.58, -25.26, 'Asunsion')),
    ('URY', 'Urugvaj', ['Uruguay'], (-56.16, -34.90, 'Montevideo')),
    # Oceania
    ('AUS', 'Australija', ['Australia'], (144.96, -37.81, 'Melburn')),
    ('NZL', 'Novi Zeland', ['New Zealand'], (174.78, -41.29, 'Velington')),
]

PAINT = [
    ('GRC', [(23.5, 35.2), (23.5, 35.7), (26.3, 35.4), (26.3, 34.9), (24.5, 34.9)]),             # Crete (as on the Europe map)
    ('GRC', [(25.8, 38.95), (25.8, 39.45), (26.45, 39.45), (26.55, 38.95)]),                      # Lesbos
    ('GRC', [(25.8, 38.1), (25.8, 38.65), (26.2, 38.65), (26.2, 38.1)]),                          # Chios
    ('ITA', [(27.65, 35.85), (27.65, 36.5), (28.3, 36.5), (28.3, 35.85)]),                        # Rhodes (Dodecanese)
    ('FRA', [(8.4, 41.36), (8.4, 43.1), (9.7, 43.1), (9.7, 41.36)]),                              # Corsica (the dataset has it Italian)
    ('POR', [(125.1, -8.1), (127.5, -8.1), (127.5, -8.9), (126.0, -9.6), (125.0, -9.45)]),       # Portuguese Timor
    ('GBR', [(55.9, 25.5), (55.9, 26.5), (56.6, 26.5), (56.6, 25.5)]),                            # Musandam: Oman, not Nejd
    ('NFL', [(-59.8, 47.4), (-59.4, 48.5), (-58.9, 49.3), (-58.4, 50.2), (-57.9, 50.95), (-57.3, 51.3), (-56.5, 51.5),
             (-55.9, 51.75), (-55.0, 51.8), (-52.4, 49.5), (-52.4, 46.4), (-56.2, 46.4), (-58.6, 47.1)]),  # Newfoundland island
    ('AUS', [(141.0, -5.0), (144.0, -6.0), (147.0, -8.0), (155.0, -8.0), (155.0, -12.0), (141.0, -12.0)]),  # Papua (Australian)
    ('USA', [(-160.5, 18.8), (-160.5, 22.4), (-154.5, 22.4), (-154.5, 18.8)]),                    # Hawaii
]

RENAMES = {
    # as on the Europe map
    'Istanbul': 'Carigrad', 'Kaliningrad': 'Kenigsberg', 'Gdanjsk': 'Dancig', 'Oslo': 'Kristijanija', 'Talin': 'Reval',
    'Sankt Peterburg': 'Petrograd', 'Bratislava': 'Požun', 'Tartu': 'Dorpat',
    # the rest of the world
    'Ankara': 'Angora', 'Izmir': 'Smirna', 'Tbilisi': 'Tiflis', 'Volgograd': 'Caricin', 'Harkiv': 'Harkov', 'Kirov': 'Vjatka',
    'Novosibirsk': 'Novonikolajevsk', 'Krasnodar': 'Jekaterinodar', 'Astana': 'Akmolinsk', 'Biškek': 'Pišpek', 'Kizilorda': 'Perovsk',
    'Ulan Bator': 'Urga', 'Šenjang': 'Mukden', 'Guangdžou': 'Kanton', 'Dalijan': 'Dairen', 'Urumči': 'Dihua',
    'Nju Delhi': 'Delhi', 'Mumbaj': 'Bombaj', 'Čenaj': 'Madras', 'Islamabad': 'Ravalpindi', 'Jangon': 'Rangun', 'Nejpjido': 'Pjinmana',
    'Ho Ši Min': 'Sajgon', 'Džakarta': 'Batavija', 'Kinšasa': 'Leopoldvil', 'Harare': 'Solsberi', 'Maputo': 'Lourenso Markes',
    'Ndžamena': 'Fort Lami', 'Gaborone': 'Gaberones', 'Brazilija': 'Planaltina',
}

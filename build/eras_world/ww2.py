"""World 1938, on the eve of the Second World War (historical-basemaps world_1938). Empires keep their colonies
(automatic by SUBJECTO where the dataset tags it that way, or listed by name below where it does not -- much of Africa
and the Middle East in this dataset carries its own name as SUBJECTO even though it was still a colony/mandate then).
Manchukuo (Japanese puppet state in Manchuria) has no feature of its own in the dataset -- painted over China.
Europe: same keys and names as the Europe map's ww2 table in build/eras.py."""
SRC = 'hist/world_1938.geojson'

POLITIES = [
    # Europe (as on the Europe map) + their empires and colonies
    ('SSR', 'SSSR', ['USSR', 'Armenia'], (37.62, 55.75, 'Moskva')),
    ('GER', 'Njemačka', ['Germany'], (13.40, 52.52, 'Berlin')),
    ('FRA', 'Francuska', ['France', 'French West Africa', 'French Equatorial Africa', 'Algeria (France)',
                          'Morocco (France)', 'Tunisia', 'French Cameroons', 'Madagascar (France)', 'Congo (France)',
                          'Syria (France)', 'French Indo-China', 'Cambodia', 'Cochin China', 'Laos', 'French Guiana',
                          'French Somaliland', 'Guadeloupe', 'Martinique', 'New Caledonia', 'New Hebrides', 'Togo'],
     (2.35, 48.86, 'Pariz')),
    ('GBR', 'Ujedinjeno Kraljevstvo', ['United Kingdom', 'British Raj', 'Ceylon', 'Malaysia', 'Guyana', 'Fiji', 'Brunei',
                                       'Belize', 'Trinidad', 'Bahamas', 'Jamaica', 'Kuwait', 'Qatar', 'Trucial Oman',
                                       'Muscat and Oman', 'Mandatory Palestine (GB)', 'Israel', 'Jordan', 'Sudan',
                                       'Malawi', 'Gambia, The', 'India'],
     (-0.13, 51.50, 'London')),
    ('ITA', 'Italija', ['Italy', 'Eritrea (Italy)', 'Ethiopia (Italy)', 'Italian Somaliland', 'Libya'], (12.48, 41.90, 'Rim')),
    ('POL', 'Poljska', ['Poland'], (21.01, 52.23, 'Varšava')),
    ('SWE', 'Švedska', ['Sweden'], (18.07, 59.33, 'Stokholm')),
    ('FIN', 'Finska', ['Finland'], (24.94, 60.17, 'Helsinki')),
    ('NOR', 'Norveška', ['Norway'], (10.75, 59.91, 'Oslo')),
    ('ESP', 'Španija', ['Spain', 'Spanish Sahara', 'Rio De Oro', 'Equatorial Guinea'], (-3.70, 40.42, 'Madrid')),
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
    ('POR', 'Portugal', ['Portugal', 'Angola (Portugal)', 'Mozambique (Portugal)', 'Guinea-Bissau'], (-9.14, 38.72, 'Lisabon')),
    ('DEN', 'Danska', ['Denmark'], (12.57, 55.68, 'Kopenhagen')),
    ('SUI', 'Švicarska', ['Switzerland'], (7.45, 46.95, 'Bern')),
    ('NED', 'Holandija', ['Netherlands', 'Dutch East Indies', 'Suriname'], (4.90, 52.37, 'Amsterdam')),
    ('BEL', 'Belgija', ['Belgium', 'Belgian Congo', 'Rwanda (Belgium)', 'Burundi'], (4.35, 50.85, 'Brisel')),
    ('ALB', 'Albanija', ['Albania'], (19.82, 41.33, 'Tirana')),
    ('IRQ', 'Irak', ['Mesopotamia (GB)'], (40.2, 33.4, None)),
    ('LUX', 'Luksemburg', ['Luxembourg'], (6.13, 49.61, 'Luksemburg')),
    # Asia
    ('MAN', 'Mandžukuo', [], (125.32, 43.88, 'Šinđing')),                # painted, see PAINT
    ('CHN', 'Republika Kina', ['Chinese warlords', 'Xinjiang'], (106.55, 29.56, 'Čongking')),
    ('JPN', 'Japansko carstvo', ['Empire of Japan', 'Saipan'], (139.69, 35.69, 'Tokio')),
    ('MNG', 'Mongolija', ['Mongolia'], (106.91, 47.92, 'Ulan Bator')),
    ('TIB', 'Tibet', ['Tibet'], (91.13, 29.65, 'Lasa')),
    ('AFG', 'Afganistan', ['Afghanistan'], (69.17, 34.53, 'Kabul')),
    ('NPL', 'Nepal', ['Nepal'], (85.32, 27.71, 'Katmandu')),
    ('BTN', 'Butan', ['Bhutan'], (89.86, 27.58, 'Punaka')),
    ('IRN', 'Iran', ['Iran'], (51.39, 35.69, 'Teheran')),
    ('SAU', 'Saudijska Arabija', ['Saudi Arabia', 'Hejaz', 'Hail', "Emirate of Bin Shal'an"], (46.72, 24.63, 'Rijad')),
    ('YEM', 'Jemen', ['Yemen'], (44.21, 15.35, 'Sana')),
    ('SIA', 'Sijam', ['Siam'], (100.50, 13.75, 'Bangkok')),
    # Africa
    ('EGY', 'Egipat', ['Egypt'], (31.24, 30.04, 'Kairo')),
    ('LBR', 'Liberija', ['Liberia'], (-10.80, 6.30, 'Monrovija')),
    ('ZAF', 'Južnoafrička Unija', ['Union of South Africa'], (28.19, -25.75, 'Pretorija')),
    # the Americas
    ('USA', 'Sjedinjene Američke Države', ['United States', 'Philippines', 'Puerto Rico', 'Guam'], (-77.04, 38.90, 'Vašington')),
    ('CAN', 'Kanada', ['Canada'], (-75.70, 45.42, 'Otava')),
    ('NFL', 'Njufaundlend', ['Dominion of Newfoundland'], (-52.71, 47.56, 'Sent Džons')),
    ('MEX', 'Meksiko', ['Mexico'], (-99.13, 19.43, 'Meksiko')),
    ('GTM', 'Gvatemala', ['Guatemala'], (-90.51, 14.64, 'Gvatemala')),
    ('HND', 'Honduras', ['Honduras'], (-87.21, 14.07, 'Tegusigalpa')),
    ('SLV', 'Salvador', ['El Salvador'], (-89.19, 13.69, 'San Salvador')),
    ('NIC', 'Nikaragva', ['Nicaragua'], (-86.25, 12.13, 'Managva')),
    ('CRI', 'Kostarika', ['Costa Rica'], (-84.09, 9.93, 'San Hose')),
    ('PAN', 'Panama', ['Panama'], (-79.52, 8.98, 'Panama')),
    ('CUB', 'Kuba', ['Cuba'], (-82.37, 23.11, 'Havana')),
    ('HTI', 'Haiti', ['Haiti'], (-72.34, 18.54, 'Port o Prens')),
    ('DOM', 'Dominikanska Republika', ['Dominican Republic'], (-69.93, 18.47, 'Sijudad Truhiljo')),
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
    ('NZL', 'Novi Zeland', ['New Zealand', 'Samoa'], (174.78, -41.29, 'Velington')),
]

PAINT = [
    ('GRC', [(23.5, 35.2), (23.5, 35.7), (26.3, 35.4), (26.3, 34.9), (24.5, 34.9)]),             # Crete (as on the Europe map)
    ('GRC', [(25.8, 38.95), (25.8, 39.45), (26.45, 39.45), (26.55, 38.95)]),                      # Lesbos
    ('GRC', [(25.8, 38.1), (25.8, 38.65), (26.2, 38.65), (26.2, 38.1)]),                          # Chios
    ('ITA', [(27.65, 35.85), (27.65, 36.5), (28.3, 36.5), (28.3, 35.85)]),                        # Rhodes (Dodecanese)
    ('FRA', [(8.4, 41.36), (8.4, 43.1), (9.7, 43.1), (9.7, 41.36)]),                              # Corsica
    ('AUS', [(141.0, -5.0), (144.0, -6.0), (147.0, -8.0), (155.0, -8.0), (155.0, -12.0), (141.0, -12.0)]),  # Papua
    ('USA', [(-160.5, 18.8), (-160.5, 22.4), (-154.5, 22.4), (-154.5, 18.8)]),                    # Hawaii
    # Manchukuo: the three north-eastern provinces + Jehol (dataset has no feature of its own -- carved out of China)
    ('MAN', [(120.0, 53.6), (126.7, 53.3), (130.8, 48.4), (131.6, 45.2), (130.4, 42.4), (126.4, 40.8),
             (122.3, 40.6), (118.9, 41.0), (115.3, 42.4), (114.8, 44.6), (116.5, 45.6), (117.7, 49.4)]),
]

RENAMES = {
    # as on the Europe map
    'Kaliningrad': 'Kenigsberg', 'Gdanjsk': 'Dancig', 'Sankt Peterburg': 'Lenjingrad', 'Donetsk': 'Staljino',
    'Dnjepar': 'Dnjepropetrovsk', 'Tver': 'Kalinjin', 'Vilnjus': 'Vilno',
    # the rest of the world
    'Ankara': 'Angora', 'Tbilisi': 'Tiflis', 'Harkiv': 'Harkov', 'Kirov': 'Vjatka', 'Novosibirsk': 'Novonikolajevsk',
    'Krasnodar': 'Jekaterinodar', 'Astana': 'Akmolinsk', 'Biškek': 'Pišpek', 'Kizilorda': 'Perovsk',
    'Ulan Bator': 'Urga', 'Šenjang': 'Mukden', 'Guangdžou': 'Kanton', 'Dalijan': 'Dairen', 'Urumči': 'Dihua',
    'Nju Delhi': 'Delhi', 'Mumbaj': 'Bombaj', 'Čenaj': 'Madras', 'Islamabad': 'Ravalpindi', 'Jangon': 'Rangun',
    'Nejpjido': 'Pjinmana', 'Ho Ši Min': 'Sajgon', 'Džakarta': 'Batavija', 'Kinšasa': 'Leopoldvil',
    'Harare': 'Solsberi', 'Maputo': 'Lourenso Markes', 'Ndžamena': 'Fort Lami', 'Gaborone': 'Gaberones',
    'Brazilija': 'Planaltina',
}

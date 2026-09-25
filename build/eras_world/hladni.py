"""World 1960, height of the Cold War and the 'Year of Africa' (historical-basemaps world_1960). Unlike the 1914/1938
datasets, this one's SUBJECTO is almost always the feature's own name (colonies already show their post-independence
shape) -- so colonial status here is assigned by hand from what was still true on 31.12.1960, not read off the data.
Still colonies then: French Algeria, French Guiana, French Somaliland (Djibouti); Portuguese Angola, Mozambique,
Portuguese Guinea; Spanish Sahara, Spanish Guinea; Belgian-trust Rwanda/Burundi (Congo-Leopoldville itself was already
independent since June 1960); Dutch Suriname; British East/Central Africa (Kenya, Uganda, Tanganyika, the two
Rhodesias, Nyasaland), the Gulf protectorates, and assorted smaller colonies (see the GBR list). Vietnam is one
feature in the dataset but was two states after the 1954 Geneva line -- split by PAINT at the 17th parallel. Tibet was
annexed by China in 1950-51. Europe: same keys and names as the Europe map's hladni table in build/eras.py."""
SRC = 'hist/world_1960.geojson'

POLITIES = [
    # Europe (as on the Europe map) + remaining colonies
    ('SSR', 'SSSR', ['USSR'], (37.62, 55.75, 'Moskva')),
    ('FRG', 'Zapadna Njemačka', ['West Germany'], (7.10, 50.73, 'Bon')),
    ('GDR', 'Istočna Njemačka', ['East Germany'], (13.40, 52.52, 'Berlin')),
    ('FRA', 'Francuska', ['France', 'Algeria', 'French Guiana', 'Djibouti'], (2.35, 48.86, 'Pariz')),
    ('GBR', 'Ujedinjeno Kraljevstvo', ['United Kingdom', 'Kenya', 'Uganda', "Tanzania, United Republic of", 'Zambia',
                                       'Zimbabwe', 'Malawi', 'Botswana', 'Lesotho', 'Swaziland', 'Guyana', 'Belize',
                                       'Sierra Leone', 'Gambia, The', 'Brunei', 'Trinidad', 'Jamaica', 'Bahamas',
                                       'Fiji', 'Kuwait', 'Qatar', 'United Arab Emirates', 'Oman'], (-0.13, 51.50, 'London')),
    ('ITA', 'Italija', ['Italy'], (12.48, 41.90, 'Rim')),
    ('POL', 'Poljska', ['Poland'], (21.01, 52.23, 'Varšava')),
    ('SWE', 'Švedska', ['Sweden'], (18.07, 59.33, 'Stokholm')),
    ('FIN', 'Finska', ['Finland'], (24.94, 60.17, 'Helsinki')),
    ('NOR', 'Norveška', ['Norway'], (10.75, 59.91, 'Oslo')),
    ('ESP', 'Španija', ['Spain', 'Western Sahara', 'Equatorial Guinea'], (-3.70, 40.42, 'Madrid')),
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
    ('POR', 'Portugal', ['Portugal', 'Angola', 'Mozambique', 'Guinea-Bissau'], (-9.14, 38.72, 'Lisabon')),
    ('DEN', 'Danska', ['Denmark', 'Greenland'], (12.57, 55.68, 'Kopenhagen')),
    ('ISL', 'Island', ['Iceland'], (-21.94, 64.15, 'Rejkjavik')),
    ('SUI', 'Švicarska', ['Switzerland'], (7.45, 46.95, 'Bern')),
    ('NED', 'Holandija', ['Netherlands', 'Suriname'], (4.90, 52.37, 'Amsterdam')),
    ('BEL', 'Belgija', ['Belgium', 'Rwanda', 'Burundi'], (4.35, 50.85, 'Brisel')),
    ('ALB', 'Albanija', ['Albania'], (19.82, 41.33, 'Tirana')),
    ('IRQ', 'Irak', ['Iraq'], (40.2, 33.4, None)),
    ('LBN', 'Liban', ['Lebanon'], (35.50, 33.89, 'Bejrut')),
    ('CYP', 'Kipar', ['Cyprus'], (33.36, 35.17, 'Nikozija')),
    ('LUX', 'Luksemburg', ['Luxembourg'], (6.13, 49.61, 'Luksemburg')),
    # Asia
    ('CHN', 'NR Kina', ['China', 'Tibet'], (116.40, 39.90, 'Peking')),
    ('TWN', 'Tajvan', ['Taiwan'], (121.56, 25.03, 'Tajpej')),
    ('MNG', 'Mongolija', ['Mongolia'], (106.91, 47.92, 'Ulan Bator')),
    ('AFG', 'Afganistan', ['Afghanistan'], (69.17, 34.53, 'Kabul')),
    ('NPL', 'Nepal', ['Nepal'], (85.32, 27.71, 'Katmandu')),
    ('BTN', 'Butan', ['Bhutan'], (89.86, 27.58, 'Punaka')),
    ('IRN', 'Iran', ['Iran'], (51.39, 35.69, 'Teheran')),
    ('PAK', 'Pakistan', ['Pakistan'], (67.01, 24.86, 'Karači')),
    ('IND', 'Indija', ['India'], (77.21, 28.61, 'Nju Delhi')),
    ('LKA', 'Cejlon', ['Sri Lanka'], (79.86, 6.93, 'Kolombo')),
    ('BUR', 'Burma', ['Burma'], (96.16, 16.80, 'Jangon')),
    ('THA', 'Tajland', ['Thailand'], (100.50, 13.75, 'Bangkok')),
    ('LAO', 'Laos', ['Laos'], (102.60, 17.97, 'Vijentijan')),
    ('KHM', 'Kambodža', ['Cambodia'], (104.92, 11.56, 'Pnom Pen')),
    ('VNM', 'Sjeverni Vijetnam', ['Vietnam'], (105.85, 21.03, 'Hanoj')),
    ('VNS', 'Južni Vijetnam', [], (106.63, 10.82, None)),                # painted, see PAINT (cap: Sajgon, RENAMES)
    ('MYS', 'Malezija', ['Malaysia'], (101.69, 3.14, 'Kuala Lumpur')),
    ('PHL', 'Filipini', ['Philippines'], (120.98, 14.60, 'Manila')),
    ('IDN', 'Indonezija', ['Indonesia'], (106.85, -6.21, 'Džakarta')),
    ('JPN', 'Japan', ['Japan'], (139.69, 35.69, 'Tokio')),
    ('PRK', 'Sjeverna Koreja', ["Korea, Democratic People's Republic of"], (125.75, 39.02, 'Pjongjang')),
    ('KOR', 'Južna Koreja', ['Korea, Republic of'], (126.98, 37.57, 'Seul')),
    ('SAU', 'Saudijska Arabija', ['Saudi Arabia'], (46.72, 24.63, 'Rijad')),
    ('YEM', 'Jemen', ['Yemen'], (44.21, 15.35, 'Sana')),
    ('ISR', 'Izrael', ['Israel'], (35.22, 31.77, 'Jerusalim')),
    ('JOR', 'Jordan', ['Jordan'], (35.93, 31.95, 'Aman')),
    # Africa
    ('EGY', 'Egipat', ['Egypt'], (31.24, 30.04, 'Kairo')),
    ('LBY', 'Libija', ['Libya'], (13.19, 32.89, 'Tripoli')),
    ('SDN', 'Sudan', ['Sudan'], (32.53, 15.60, 'Kartum')),
    ('ETH', 'Etiopija', ['Ethiopia', 'Eritrea'], (38.74, 9.03, 'Adis Abeba')),
    ('SOM', 'Somalija', ['Somalia'], (45.32, 2.04, 'Mogadiš')),
    ('LBR', 'Liberija', ['Liberia'], (-10.80, 6.30, 'Monrovija')),
    ('GHA', 'Gana', ['Ghana'], (-0.19, 5.60, 'Akra')),
    ('GIN', 'Gvineja', ['Guinea'], (-13.68, 9.51, 'Konakri')),
    ('CIV', 'Obala Slonovače', ['Ivory Coast'], (-4.03, 5.32, 'Abidžan')),
    ('MLI', 'Mali', ['Mali'], (-8.00, 12.65, 'Bamako')),
    ('SEN', 'Senegal', ['Senegal'], (-17.45, 14.69, 'Dakar')),
    ('MRT', 'Mauritanija', ['Mauritania'], (-15.98, 18.09, 'Nuakšot')),
    ('NER', 'Niger', ['Niger'], (2.11, 13.51, 'Niamej')),
    ('TCD', 'Čad', ['Chad'], (15.03, 12.11, None)),                     # cap: Fort Lami (RENAMES)
    ('CMR', 'Kamerun', ['Cameroon'], (11.52, 3.87, 'Jaunde')),
    ('GAB', 'Gabon', ['Gabon'], (9.45, 0.39, 'Librevil')),
    ('COG', 'Kongo (Brazavil)', ['Congo'], (15.28, -4.26, 'Brazavil')),
    ('COD', 'Kongo (Leopoldvil)', ['Zaire'], (15.27, -4.44, None)),      # cap: Leopoldvil (RENAMES)
    ('CAF', 'Centralnoafrička Republika', ['Central African Republic'], (18.56, 4.37, 'Bangi')),
    ('BFA', 'Gornja Volta', ['Burkina Faso'], (-1.53, 12.37, 'Vagadugu')),
    ('TGO', 'Togo', ['Togo'], (1.22, 6.13, 'Lome')),
    ('BEN', 'Dahomej', ['Benin'], (2.61, 6.50, 'Porto Novo')),
    ('NGA', 'Nigerija', ['Nigeria'], (3.38, 6.45, 'Lagos')),
    ('MDG', 'Madagaskar', ['Madagascar'], (47.52, -18.88, 'Antananarivo')),
    ('ZAF', 'Južnoafrička Unija', ['South Africa', 'Namibia'], (28.19, -25.75, 'Pretorija')),
    # the Americas
    ('USA', 'Sjedinjene Američke Države', ['United States', 'Puerto Rico'], (-77.04, 38.90, 'Vašington')),
    ('CAN', 'Kanada', ['Canada'], (-75.70, 45.42, 'Otava')),
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
    ('AUS', 'Australija', ['Australia', 'Papua New Guinea'], (144.96, -37.81, 'Melburn')),
    ('NZL', 'Novi Zeland', ['New Zealand', 'Samoa'], (174.78, -41.29, 'Velington')),
]

PAINT = [
    ('GRC', [(23.5, 35.2), (23.5, 35.7), (26.3, 35.4), (26.3, 34.9), (24.5, 34.9)]),             # Crete
    ('GRC', [(25.8, 38.95), (25.8, 39.45), (26.45, 39.45), (26.55, 38.95)]),                      # Lesbos
    ('GRC', [(25.8, 38.1), (25.8, 38.65), (26.2, 38.65), (26.2, 38.1)]),                          # Chios
    ('GRC', [(27.65, 35.85), (27.65, 36.5), (28.3, 36.5), (28.3, 35.85)]),                        # Rhodes: Italy -> Greece 1947
    ('FRA', [(8.4, 41.36), (8.4, 43.1), (9.7, 43.1), (9.7, 41.36)]),                              # Corsica
    ('USA', [(-160.5, 18.8), (-160.5, 22.4), (-154.5, 22.4), (-154.5, 18.8)]),                    # Hawaii
    # Vietnam: one dataset feature, split at the 17th parallel (1954 Geneva line) into North/South (the painted
    # shape follows Vietnam's own coastline south of 17N -- not a bounding box -- so it doesn't eat Laos/Cambodia)
    ('VNS', [(107.11, 16.95), (107.81, 16.28), (108.1, 16.25), (108.92, 14.79), (109.31, 12.91), (109.07, 12.49),
              (109.06, 11.59), (108.7, 11.15), (108.16, 10.97), (107.41, 10.37), (106.77, 10.64), (106.75, 10.07),
              (106.48, 9.55), (106.23, 9.55), (105.03, 8.52), (104.74, 8.49), (104.98, 9.98), (104.39, 10.31),
              (105.49, 10.89), (106.03, 10.8), (106.09, 11.01), (105.74, 11.39), (105.84, 11.58), (107.21, 12.23),
              (107.48, 12.58), (107.51, 13.42), (107.3, 14.18), (107.43, 15.26), (107.1, 15.67), (107.11, 16.17),
              (106.25, 17.0)]),
]

RENAMES = {
    # as on the Europe map's hladni table
    'Sankt Peterburg': 'Lenjingrad', 'Donetsk': 'Staljino', 'Dnjepar': 'Dnjepropetrovsk', 'Tver': 'Kalinjin', 'Podgorica': 'Titograd',
    # the rest of the world
    'Jangon': 'Rangun', 'Ndžamena': 'Fort Lami', 'Ho Ši Min': 'Sajgon', 'Kinšasa': 'Leopoldvil',
    'Harare': 'Solsberi', 'Maputo': 'Lourenso Markes', 'Mumbaj': 'Bombaj', 'Čenaj': 'Madras',
}

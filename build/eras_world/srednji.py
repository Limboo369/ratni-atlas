"""World 1400, high medieval (historical-basemaps world_1400). Europe: identical keys/names/paint to the Europe map's
srednji table in build/eras.py (copied verbatim) -- the same dataset feature needs the same disambiguation on both maps.
Dataset quirks fixed with PAINT: 'Great Khanate' is one blob spanning Mongolia+Manchuria+China+Korea (not updated for
the Ming/Joseon split) -- carved into Mongolija/Mingska Kina/Koreja. The Aztec confederation (1428) and the Inca Empire
(post-1438) did not exist yet in 1400 -- Astečki savez and Kraljevstvo Cusco are small painted city-states, matching
Darko's plan (docs/PLAN.md: "Ming, Mali i Asteci 1400."). Chola/Pandya (dataset labels, both long absorbed by 1400) ->
Vijayanagara. Kediri (a Majapahit province by 1400) -> Majapahit. Srivijaya+Aceh (Srivijaya fell in the 1300s) ->
Samudera Pasai, the real dominant Sumatran sultanate of the era."""
SRC = 'hist/world_1400.geojson'
NEAR_MAX = 0.5  # the dataset leaves big true voids (interior Americas) uncovered by any feature; default 4 let one
                # touching component bleed a small polity across a whole continent (component-min-distance gate, not per-pixel)

POLITIES = [
    # Europe (as on the Europe map's srednji table) -----------------------------------------------------------------
    ('KAL', 'Kalmarska unija', ['Kalmar Union'], (12.57, 55.68, 'Kopenhagen'), dict(fill=[(20.5, 67.8), (15.0, 68.0)])),
    ('NOV', 'Novgorodska republika', ['Novgorod'], (31.27, 58.52, 'Novgorod'), dict(fill=[(33.0, 67.2), (29.0, 68.8)])),
    ('ZLH', 'Zlatna horda', ['Blue Horde', 'White Horde'], (39.4, 47.1, 'Azak')),
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
    # Caucasus / Central Asia / Middle East --------------------------------------------------------------------------
    ('GEO', 'Gruzija', ['Georgia'], (44.79, 41.72, 'Tbilisi')),
    ('YEM', 'Jemen', ['Yemen', 'Hadramaut'], (44.02, 13.58, 'Taiz')),
    ('OMA', 'Oman', ['Muscat'], (57.53, 22.93, 'Nizva')),
    # South & East Asia -----------------------------------------------------------------------------------------------
    ('DEL', 'Delhijski sultanat', ['Sultanate of Delhi'], (77.23, 28.61, 'Delhi')),
    ('VJN', 'Vijayanagara', ['Chola Empire', 'Pandya state'], (76.46, 15.33, 'Vidžajanagar')),
    ('ORI', 'Orisa', ['Orissa'], (85.88, 20.47, 'Katak')),
    ('LKA', 'Sinhalsko kraljevstvo', ['Sinhalese kingdom'], (80.57, 7.16, 'Gampola')),
    ('KSH', 'Kašmir', ['Kashmir and Ladakh'], (74.80, 34.08, 'Srinagar')),
    ('CHN', 'Mingska Kina', [], (118.78, 32.06, 'Nanjing')),
    ('KOR', 'Koreja', [], (127.0, 37.57, 'Hanseong')),
    ('MNG', 'Mongolija', ['Great Khanate'], (102.85, 47.20, 'Karakorum')),
    ('JPN', 'Japan', ['Shogun Japan (Kamakura)'], (135.77, 35.01, 'Kjoto')),
    ('AVA', 'Kraljevstvo Ava', ['Pagan'], (95.99, 21.85, 'Ava')),
    ('AYU', 'Ajutaja', ['Ayutthaya'], (100.56, 14.35, 'Ajutaja')),
    ('SUK', 'Sukhotaj', ['Sukhothai'], (99.82, 17.02, 'Sukhotaj')),
    ('KHM', 'Khmersko carstvo', ['Khmer Empire'], (103.86, 13.41, 'Angkor')),
    ('CHA', 'Čampa', ['Champa'], (109.22, 13.98, None)),
    ('DVT', 'Dai Viet', ['Đại Việt'], (105.85, 21.03, 'Thang Long')),
    ('MJP', 'Majapahit', ['Kediri'], (112.5, -7.55, 'Trowulan')),
    ('PAS', 'Samudera Pasai', ['Srivijaya Empire', 'Aceh'], (97.13, 5.24, 'Pasai')),
    # Africa -----------------------------------------------------------------------------------------------------------
    ('ETH', 'Etiopija', ['Ethiopia'], (39.5, 9.7, None)),
    ('IFT', 'Sultanat Ifat', ['Shoa'], (42.7, 10.6, None)),
    ('MLI', 'Carstvo Mali', ['Mali'], (-9.14, 11.35, 'Niani')),
    ('KAN', 'Kanem-Bornu', ['Kanem-Bornu'], (14.47, 12.87, 'Njimi')),
    ('ALW', 'Alva', ['Alwa'], (32.62, 15.55, 'Soba')),
    ('SWA', 'Svahilski gradovi', ['Islamic city-states'], (39.51, -8.98, 'Kilva')),
    ('GZW', 'Veliki Zimbabve', ['Great Zimbabwe'], (30.93, -20.27, None)),
    ('BEN', 'Kraljevstvo Benin', ['Benin'], (5.62, 6.34, 'Benin')),
    # the Americas -------------------------------------------------------------------------------------------------------
    ('AZT', 'Astečki savez', [], (-99.13, 19.43, 'Tenočtitlan')),
    ('CUS', 'Kraljevstvo Cusco', [], (-71.98, -13.53, 'Cusco')),
    ('ZAP', 'Zapotečko carstvo', ['Zapotec Empire'], (-96.76, 16.97, 'Zaačila')),
    ('MIX', 'Mikstečko carstvo', ['Mixtec Empire'], (-97.27, 17.23, 'Tilantongo')),
    ('MAY', 'Majanski gradovi', ['Maya city-states'], (-88.6, 19.4, None)),
    ('CHM', 'Carstvo Čimu', ['Chimú Empire'], (-79.08, -8.11, 'Čan Čan')),
    ('AYM', 'Ajmarska kraljevstva', ['Aymara kingdoms'], (-69.1, -20.2, None)),
    # Oceania --------------------------------------------------------------------------------------------------------------
    ('TON', 'Tongansko carstvo', ['Tuʻi Tonga Empire'], (-175.15, -21.13, 'Mua')),
]

PAINT = [
    # Europe (as on the Europe map's srednji table) -----------------------------------------------------------------
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
    # East Asia: the dataset's 'Great Khanate' is one blob (Mongolia+Manchuria+China+Korea, not split for 1400) --------
    ('CHN', [(100, 40), (110, 42), (117, 41.5), (122, 41.5), (124, 40.5), (122.5, 34), (121, 28), (119, 24),
              (110, 21), (100, 22), (97, 27), (100, 34)]),
    ('KOR', [(124, 43), (130.5, 43), (130.5, 38.3), (129.4, 35.0), (126.0, 34.0), (124.5, 37.5), (124.3, 40)]),
    # the Americas: the Aztec confederation (1428) and the Inca Empire proper (post-1438) did not exist yet in 1400 --
    ('AZT', [(-99.4, 19.65), (-98.85, 19.65), (-98.85, 19.0), (-99.4, 19.0)]),
    ('CUS', [(-72.3, -13.0), (-71.5, -13.0), (-71.5, -13.8), (-72.3, -13.8)]),
]

RENAMES = {
    # as on the Europe map
    'Istanbul': 'Konstantinopolj', 'Izmir': 'Smirna', 'Kaliningrad': 'Kenigsberg', 'Gdanjsk': 'Dancig', 'Sankt Peterburg': 'Orešek',
    'Turku': 'Abo', 'Talin': 'Reval', 'Tartu': 'Dorpat', 'Bratislava': 'Požun', 'Budimpešta': 'Budim', 'Sarajevo': 'Vrhbosna',
    'Tuzla': 'Soli', 'Podgorica': 'Ribnica', 'Kazablanka': 'Anfa', 'Trabzon': 'Trapezunt', 'Konya': 'Konja', 'Oslo': 'Oslo',
}

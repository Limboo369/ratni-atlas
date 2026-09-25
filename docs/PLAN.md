# Overtake — plan razvoja

Ovaj fajl je od 24. 9. 2026. glavni plan (stari živi dokument na claude.ai se više ne ažurira). Igra: https://war.deovilab.com

## Gdje smo sada

v0.5 (doba, battle royale) je objavljena na https://war.deovilab.com pod imenom Overtake. Server, domen, Docker i automatska objava su gotovi. Online igra na domenu čeka vlastiti game server; ostaje i balans.

| Dio v0.5 | Šta radi |
| --- | --- |
| 7 doba | Rim (100.), srednji vijek (1400.), Napoleon (1815.), 1914., 1938., Hladni rat (1960.), danas — svako sa svojim granicama, gradovima, prijestolnicama, jedinicama, zgradama i oružjem |
| Početak | Stvarne granice (biraš državu i dobiješ cijelu njenu teritoriju) ili od prijestolnice (klasično širenje) |
| Battle royale | Radioaktivna zona u 6 krugova sužava se prema nasumičnoj tački; radi i online |
| Online lobi | Domaćin bira doba, početak i battle royale |

Prije objave:

- Popravljeno: greška zbog koje se u v0.5 jedinice nisu mogle regrutovati.
- Balans: Rimsko carstvo (AI) pobijedi za oko 5 min; u stvarnim granicama male države nestanu u prvim minutama; partija 1914. traje oko 10 min.
- Sporne teritorije danas (Kosovo, Krim, Sjeverni Kipar) počinju kao slobodna zemlja — nijedna država ih ne dobija na startu.
- Granice: historical-basemaps (A. Ourednik, GPL-3.0) i Natural Earth; srednjovjekovni Balkan (Bosna, Srbija, Zeta, Albanija, Epir) ručno ispravljen.
- Kod ide u privatni GitHub repozitorij — odatle se radi s bilo kojeg uređaja.

## Prvi korak: server

Prije novih funkcija postavljamo Contabo server: igra na tvom domenu, vlastiti online server umjesto claude.ai sobe, te nalozi i baza za dostignuća, statistike i sačuvane igre.

| Dio | Prijedlog |
| --- | --- |
| Sistem | Ubuntu 24.04 LTS |
| Web | Nginx + HTTPS (Let's Encrypt, automatsko obnavljanje) |
| Igra | Statične datoteke na https://tvoj-domen |
| Game server | Node.js + WebSocket: sobe, lockstep relej, gledaoci, duge igre |
| Baza | PostgreSQL: nalozi, statistike, dostignuća, sačuvane igre |
| Kod | Privatni GitHub repozitorij; objava na server automatski preko GitHub Actions |
| Sigurnost | SSH samo ključem, firewall (22/80/443), fail2ban, automatske zakrpe, dnevni backup baze |

Kod živi na GitHubu, ne na nekom računaru: radiš s bilo kojeg računara ili telefona, a server se sam ažurira iz repozitorija.

- Privatni GitHub repozitorij ratni-atlas je jedini trajni izvor koda.
- Rad s bilo kojeg uređaja: sesija na claude.ai/code povezana s tim repozitorijem uzme kod, uradi posao i pošalje promjene nazad.
- Server: GitHub Actions se spaja na server i pokreće skripte iz repozitorija — postavljanje servera i svaka nova verzija idu tim putem. Claude okruženje ne može direktno do servera, a tvoj poslovni računar nam ne treba.

Koraci:

1. Ti: na GitHubu napravi prazan privatni repozitorij ratni-atlas.
2. Ti: preuzmi ratni-atlas.zip iz ovog razgovora, raspakuj ga i prevuci sve fajlove na stranicu repozitorija (link „uploading an existing file“) → Commit changes. Lokalnu kopiju onda obriši.
3. Ti: na claude.ai/code poveži GitHub, daj pristup repozitoriju ratni-atlas i otvori sesiju za njega — od tada radimo tamo, s bilo kojeg računara ili telefona.
4. Ti: u repozitoriju (Settings → Secrets and variables → Actions) dodaj IP servera i root lozinku kao tajne — šifrovano na GitHubu, nikad u chatu.
5. Ti: kod registrara domena postavi A zapis na IP servera.
6. Ja: GitHub Actions i skripte: zaštita servera (SSH ključ, firewall, fail2ban), Nginx, HTTPS i prva objava igre.
7. Ja: game server + baza, nalozi, online preko vlastitog servera.

Lozinku servera ne šalji u chat — ide samo u GitHub Secrets. Domen mi možeš napisati.

## Načini igre i karte

Battle royale i doba su gotovi; ostaju nove karte, DEFCON mod, duga igra kroz dane i kampanja.

| # | Ideja | Odluka i detalji |
| --- | --- | --- |
| 2 | Battle royale | Gotovo (v0.5): zasebni način igre, zona se sužava u 6 krugova. |
| 5 + 6 | Stvarne granice + historijski periodi | Gotovo (v0.5): biraš doba; od doba zavise jedinice, zgrade i oružje (Rim bez baruta i aviona, 1938. tenkovi, avioni i atomska bomba). |
| 19 | Nove karte | Što više karata. Prijedlog: svijet, detaljni Balkan, Mediteran i Bliski istok, Sjeverna i Južna Amerika, Afrika, Azija. Treba uopštiti pripremu karte (Natural Earth za sve kontinente). |
| 48 | DEFCON mod | Zaseban način igre (razrada ispod). |
| 56 | Kampanja | Maksimalno razrađena, oko 100 sati (razrada ispod). |
| 60 | Duga igra kroz dane | Strategija, ne priča: partija traje danima, igra se na serveru i dok nisi tu, ima snimi i nastavi; sporija od običnog online moda. |

DEFCON mod — prijedlog:

- Pet faza, svaka otključava više: DEFCON 5 gradnja i savezi bez napada → 4 kopneni napadi → 3 more i zrak → 2 konvencionalne rakete → 1 nuklearke.
- Faze se mijenjaju na vrijeme (npr. svake 3 min); status DEFCON-a stalno na ekranu.
- Pobjeđuje ko ima najviše preživjelih gradova i stanovništva kad sat istekne (npr. 25 min) — nije dovoljno samo osvajati.
- PVO i gvozdena kupola ovdje su ključni; nuklearke u letu vidljive svima (radar).

Kampanja (~100 sati) — prijedlog:

- Sedam poglavlja po dobima (Rim → danas), svako s oko 10 misija i slobodnom igrom između; tvoja država i dinastija prolaze kroz vrijeme.
- Razvoj: iskustvo i zlato ulažeš u tehnološko stablo (vojska, ekonomija, diplomatija, nauka); otključavaš jedinice, zgrade i oružje doba te trajna poboljšanja koja prelaze u sljedeće doba.
- Misije: odbrani prijestolnicu, osvoji region, preživi koaliciju, ekonomski cilj; težina raste.
- Snimi i nastavi (lokalno i na nalogu). Prvo pravim punu verziju, pa korigujemo.

## Cijeli svijet (novo)

Pored Evrope, cijela karta svijeta. Sve što se tiče teritorija radi i na Evropi i na svijetu.

| Dio | Evropa (sada) | Svijet (dodaje se) |
| --- | --- | --- |
| Karta | mreža 480×632, lon −11…41, lat 33…71 | svjetska mreža bez Antarktika; izbor karte Evropa / Svijet |
| Dijelovi karte | Balkan, Zapadna, Srednja, Sjever i Baltik… | + Bliski istok i Mediteran, Afrika, Azija, Sjeverna Amerika, Južna Amerika, Okeanija (to su i „nove karte“ iz tačke 19) |
| Učitavanje | sve u jednoj datoteci | karta svijeta se učitava sa servera tek kad je izabereš, da telefon ne skida sve odjednom |
| Doba | 7 doba s evropskim granicama | istih 7 doba s granicama cijelog svijeta (Han Kina i Partija uz Rim; Ming, Mali i Asteci 1400.; kolonije 1914. …) |
| Države | 46 | oko 200 danas; mikrodržave spojene ili slobodna zemlja, da AI i telefon izdrže |
| More | kratki desanti | okeani: brodovi putuju duže, luke i mornarica važnije |
| Moreuzi i kanali | Bosfor, Gibraltar, danski, Otranto, Mesina, Kerč | + Suecki i Panamski kanal (od kad postoje), Malaka, Hormuz, Bab el-Mandeb |
| Resursi | nalazišta u Evropi | nalazišta na cijelom svijetu, isto pravilo: svako ima bar jedan, niko sve |
| Sporne teritorije | Kosovo, Krim, Sjeverni Kipar | + Tajvan, Zapadna Sahara, Kašmir… (slobodna zemlja na startu) |
| Battle royale | zona preko Evrope | zona preko izabranog dijela svijeta |
| Vladari | evropske titule | + šah, kan, šogun, maharadža… (izmišljena imena) |
| Kampanja | Evropa kroz doba | poglavlja po cijelom svijetu |

## Vojska i borba

Sve ostaje jednostavno za igru: najviše dvije-tri nove stvari po oblasti, bez dugih objašnjenja.

| # | Ideja | Odluka i detalji |
| --- | --- | --- |
| 20 | Ratna mornarica | Da, ali malo opcija: dvije vrste broda po dobu (npr. ratni brod i podmornica; u Rimu galije). Napadaju desantne i trgovačke brodove, blokiraju luke, gađaju obalu. |
| 21 | Avijacija | Da: lovac (obara avione i štiti nebo) i bombarder (gađa zgrade, jedinice i vojsku), s aerodroma; samo u dobima s avionima. |
| 22 | Dronovi | Da, pažljivo zbog brzine igre: samo u dobu „danas", najviše nekoliko po igraču, let pravom linijom bez traženja puta, crtaju se kao grupa. Kamikaza dron (jeftin mali udar) i dron za napad na jedinice. |
| 28 | Usmjereni napad | Gotovo (25. 9.): dodir/klik na državu šalje vojsku s najbliže granice do te tačke — osvaja se samo koridor (širina raste s vojskom) i krug oko cilja, pa se vojska vraća; strelica na karti. Napad na cijeloj granici: dugi pritisak / desni klik → „Napadni cijelu granicu". |
| 30 | Dugme „Vrati granice" | Gotovo (25. 9.): kad ti država otme zemlju, u traci napada je žuto dugme „Vrati N polja" — kontranapad samo na zemlju otetu u zadnje 3 minute, bez širenja dalje. |
| 37 | Nuklearke | Bez kazne tipa hitne koalicije (u multiplayeru prevelika kazna). Umjesto toga nuklearke treba pojačati — sada nisu dovoljno isplative. |
| 50 | Gvozdena kupola i automatski uzvrat | Umjesto mrtve ruke: kupuje se; mreža od više nuklearnih postrojenja po tvojoj teritoriji. Kad neko lansira nuklearku na tebe, tvoje nuklearke automatski idu na njegovu državu — prvo glavni grad, pa dalje. |

Kako pojačati nuklearke (prijedlog za balans):

- Veći gubitak vojske mete i rušenje gradova u krugu (grad pada na manji nivo).
- Ekonomski udar: meta gubi dio prihoda 60 s.
- Radijacija duže traje i jače usporava napade.
- Cijena i vrijeme punjenja silosa pregledati nakon testova.

## Ekonomija, trgovina i diplomatija

Najveća nova cjelina su resursi s trgovinom — kao opcija, da ostane i brza casual igra.

Resursi i trgovina (12 + 35):

- Opcija u postavkama: Resursi uključeno / isključeno (casual ili strateški). Radi u oba početka: od prijestolnice (biraš dio karte) i stvarne granice (biraš državu).
- Resursi na stvarnim mjestima, ali balansirano: svaka država ima bar jedan, nijedna nema sve. Ne mora savršeno, ali bez „jedna ima sve, druga ništa".
- Tri-četiri resursa po dobu (prijedlog): antika i srednji vijek žito, željezo, drvo; 1815. žito, željezo, ugalj; od 1914. žito, čelik, nafta.
- Bez resursa se ne blokira ništa, samo je skuplje ili sporije (npr. tenkovi i avioni bez nafte, rast vojske bez žita).
- Nema berze. Kad s nekim imaš trgovinski savez, odmah vidiš njegove resurse i cijene i kupuješ direktno (npr. naftu). Drugi partner može imati povoljniju cijenu. Igra ostaje brza.

| # | Ideja | Odluka i detalji |
| --- | --- | --- |
| 17 | Moreuzi | Da: ko drži obje obale (Bosfor/Dardaneli, Gibraltar, danski moreuzi, Otranto, Mesina, Kerč) može ga zatvoriti za tuđe brodove. AI se ljuti kao na nuklearku; ljutnja raste s tim koliko im trgovine tu prolazi. Sam i zatvoriš → koalicija protiv tebe; s jakim saveznicima → možeš izdržati. |
| 33 | Porez i kamata | Da: klizač poreza (više zlata ↔ sporiji rast vojske) i mala kamata na ušteđeno zlato. |
| 34 | Zajmovi | Da, od drugih država: kad tražiš zajam, igra odmah predloži dio tvoje teritorije u zalog (označen na mapi). Ne vratiš zlato na vrijeme → taj dio ide njima. |
| 36 | Agresivna ekspanzija | Da, s balansom: ljutnja raste s brojem napadnutih i pokorenih država, ne samo s teritorijom — jedna velika država nije isto što i pet malih iste površine. Vremenom opada; visoka ljutnja → AI koalicija. |
| 40 | Vazali | Da: slabu državu možeš učiniti vazalom umjesto da je osvojiš — plaća danak i bori se uz tebe. |
| 43 | Pravo prolaza | Gotovo za kopnene napade (25. 9.): granica vojnog saveznika s trećom državom je i tvoj front (ako saveznik nije i njen saveznik); osvojena zemlja je tvoja. Desanti preko saveznika: kasnije. Poklanjanje gradova — ne. |

## Vladari s komentarima

Potrebno je 21 portret (3 za svako od 7 doba); ako želiš i ljute verzije, još 21.

- Na teritoriji države povremeno iskače glava vladara s oblačićem i komentariše: ljut je kad ga napadneš, opsuje te, hvali savez, paniči kad gubi, a nekad samo lupa gluposti. Nema pisanja poruka s njima (46).
- Veliki pool: cilj 400+ replika (oko 40 situacija × 10 replika). Blage psovke i uvrede mogu; bez mržnje i uvreda na nacionalnoj osnovi.
- Vladari su izmišljeni likovi s titulom i imenom po dobu (npr. „Car Aurelijan"), ne stvarni političari — ne stavljamo izmišljene uvrede u usta stvarnim ljudima.

| Doba | Tri portreta |
| --- | --- |
| Rim | imperator, plemenski poglavica, kraljica plemena |
| Srednji vijek | kralj, sultan, knez |
| 1815. | car, kralj, kraljica |
| 1914. | car, general, premijer |
| 1938. | maršal, kralj, predsjednik |
| Hladni rat | generalni sekretar, predsjednik, general |
| Danas | predsjednik, predsjednica, premijer |

Format slika: kvadratne, najmanje 512×512 px, lice u sredini, jednostavna pozadina, PNG ili JPG. Mogu biti ilustracije ili AI slike izmišljenih lica.

## Online, napredak i doživljaj

Ovo zavisi od servera i naloga, pa dolazi odmah poslije postavljanja servera.

| # | Ideja | Odluka i detalji |
| --- | --- | --- |
| 57 | Brze poruke i ping | Gotovo (25. 9.), online: desni klik / dugi dodir na mjesto → „Označi za saveznike" (napadni ovdje, pomoć, opasnost, idem tamo) ili tipka G na mjestu miša; 16 gotovih poruka i emoji (dugme poruka, tipka T, meni Savezi). Vide saveznici i tim: pulsirajući znak na karti 6 s, red u dnevniku desno, poruka kao obavještenje. Kružni meni: kasnije (izgled, Codex). |
| 58 | Gledalac | Da: uđeš u sobu samo da gledaš partiju uživo. |
| 59 | Statistike i ljestvica | Da, po nalogu: pobjede, porazi, najveće carstvo, nuklearke; rang za online igre. |
| 61 | Dostignuća | Da, čuvaju se na nalogu svakog igrača (server + domen). |
| 63 | Snimi i nastavi | Da, za offline igru (isti sistem kao duge igre iz tačke 60). |
| 64 | Zvuk i muzika | Gotovo (25. 9.), sintetizovano u pregledniku (bez fajlova): klik, uzbuna kad te napadnu, osvojen / izgubljen grad, raketa, eksplozija, nuklearka i sirena, poruka, pobjeda, poraz; tiha muzika po dobu (svako doba svoj akord i boja). Meni → Zvučni efekti / Muzika. Prava muzika (snimljena): kasnije, ako želiš. |
| 66 | Interaktivni tutorijal | Da: igra te vodi kroz prvu partiju korak po korak. |
| 67 | Sitnice | Da: dugme za revanš, izbor boje i grba, mod za daltoniste. |

## UI/UX: nove ikonice

Sadašnji apstraktni simboli (NATO pravougaonici, geometrijski oblici zgrada) mijenjaju se prepoznatljivim sličicama — tenk mora ličiti na tenk.

| Grupa | Ikonice |
| --- | --- |
| Jedinice | vojnik (pješadija), tenk, top, konjanik, strijelac, legionar, vitez |
| Zgrade | grad, kasarna, tvrđava, luka (sidro), fabrika (dimnjak), aerodrom, silos s raketom, PVO, gvozdena kupola, opsadna radionica, tržnica |
| Zrak i more | lovac, bombarder, avion s padobrancima, dron, ratni brod, podmornica, trgovački brod, cepelin |
| Udari | raketa, atomska bomba, kamen za katapult |

- Jedan stil: ravne siluete, boja vlasnika + bijeli obrub, čitljivo na telefonu (najmanje 24 px).
- Iste ikonice na mapi i u menijima; varijante po dobu (legionar umjesto vojnika u Rimu).
- Uz to pregled cijelog izgleda na telefonu: donja traka, prozori, stanje napada.

## Odbijeno

Ovo ne ulazi u igru (brojevi iz liste ideja):

1 Sat sudnjeg dana · 3 Zombi mod · 4 Kralj brda · 7 Timovi AI država · 8 Nasumični modifikatori · 9 Bodovi i dnevni izazov · 10 Više načina pobjede · 11 Regionalni bonusi · 13 Teren · 14 Godišnja doba i vrijeme · 15 Prirodne katastrofe · 16 Magla rata · 18 Znamenitosti · 23 Veteranstvo · 24 General · 25 Moći komandanta · 26 Doktrine · 27 Nacionalne posebnosti · 29 Opkoljavanje · 31 Plaćenici · 38 Moral i ustanci · 39 Mirovni ugovor · 41 Kongres Evrope · 42 Sankcije i embargo · 44 Špijuni · 47 Sat Armagedona · 49 Nuklearna zima · 51 Cunami · 52 Događaji s odlukom · 53 Ratne novine · 54 Kartice · 55 Tajne misije · 62 Timelapse · 65 Atmosfera (kamera, dan i noć).

Zamijenjeno nečim drugim: 32 tehnologije kao in-game vještine (umjesto toga otključavanje po dobu) · 35 berza (cijene u trgovini) · 37 hitne koalicije (jače nuklearke) · 43 poklanjanje gradova (samo pravo prolaza) · 46 pisanje s AI vođama (samo komentari) · 50 mrtva ruka (gvozdena kupola).

Platforma (25. 9.): igra se prvenstveno na računaru — sve se prvo pravi i dotjeruje za računar (miš, tastatura, širok ekran), a telefon mora i dalje dobro raditi.

## Redoslijed rada

Svijet dolazi prije ekonomije, vojske i kampanje: resursi, moreuzi, mornarica i kampanja zavise od geografije, pa se tako rade jednom za obje karte. Nove ikonice i portrete radi Codex (vizuali); logiku, server i sve ostalo Claude.

| Faza | Šta | Stanje |
| --- | --- | --- |
| 1 | Server i domen, Docker, HTTPS, automatska objava s testovima | gotovo |
| 2 | Balans v0.5: Rim, male države u stvarnim granicama, dužina partije 1914. | gotovo: Rim pobjeđuje ~1/3 partija (15–30 min), partije 15–33 min |
| 3 | Vlastiti online server (Node + WebSocket u Dockeru): online na war.deovilab.com, gledaoci; svaka igra ima svoj link (war.deovilab.com/game-k3x9pq) za poziv prijatelja i povratak u igru nakon zatvaranja stranice ili pada veze | u toku |
| 4 | Cijeli svijet: karta, doba, dijelovi svijeta, učitavanje sa servera | gotovo: 168 država danas, svih 7 doba na svijetu (Rim 26 · 1400. 78 · 1815. 76 · 1914. 60 · 1938. 69 · 1960. 109 država), 7 regija, balans po stvarnoj površini, online |
| 5 | Brze stvari: usmjereni napad, vrati granice, pravo prolaza, ping i brze poruke, zvuk i muzika, sitnice, tutorijal | |
| 6 | Nalozi i baza (PostgreSQL): prijava preko Google-a (rezerva: e-mail), tvoje igre vezane za nalog (nastavi igru s bilo kojeg uređaja), statistike i ljestvica, dostignuća, snimi i nastavi | u toku: gotovi baza, Google prijava, profil (ime, ikonica, čin po pobjedama, statistike, uspješnost, 18 dostignuća, historija zadnjih 20 partija), ljestvica; slijede snimi i nastavi, igre vezane za nalog |
| 7 | Ekonomija i diplomatija: resursi i trgovina (opcija), porez i kamata, zajmovi sa zalogom, agresivna ekspanzija, vazali, moreuzi i kanali | |
| 8 | Vojska: mornarica, avijacija, dronovi, jače nuklearke, gvozdena kupola | |
| 9 | Vladari s komentarima (portreti: Codex) | |
| 10 | DEFCON mod, duge igre kroz dane | |
| 11 | Kampanja (~100 h, cijeli svijet) | |

## Dodano 25. 9.

| Šta | Odluka | Stanje |
| --- | --- | --- |
| Nastavi igru poslije pobjede | Pobjednik se proglasi na 70% (kao sada), a na prozoru pobjede je i „Nastavi igru" — igra dalje do kraja (dok ne ostane sam na karti); pobjeda ostaje zapisana | gotovo za igru protiv kompjutera; online treba zajedničku komandu za sve uređaje |
| Profil igrača | Na početnom ekranu, poslije prijave: ime, ikonica (grb ili Google slika), čin, statistike, uspješnost, dostignuća, historija partija, ljestvica | gotovo |
| Izbornik karte | Evropa nije posebna karta u izborniku nego jedna od regija: Cijeli svijet, Evropa, Bliski istok i Mediteran, Afrika, Azija, Amerike, Okeanija; ispod se bira doba. Doba za sve kontinente i cijeli svijet | izbornik gotov (uz svaki dio broj država u izabranom dobu; doba bez bar 2 države se isključi, a izbor pređe na najbliže doba). Dijelovi Evrope (Balkan…) su u postavkama. Slijedi: dopuniti stara doba država (Rim: Amerike i Okeanija 0, Afrika 5; 1400.: Okeanija 0, Amerike 4 i 2) i isti izbornik u online lobiju |
| Pobjeda na 70% | Na svakoj karti i dijelu karte pobjeda je na 70% kopna, bez spuštanja praga s vremenom (svijet je imao 55% i pad do 40%) | gotovo; „Nastavi igru" radi protiv kompjutera, online slijedi |
| Stara doba na svim kontinentima | Rim i 1400. imaju države i plemena u Americi, Africi i Okeaniji (Maje, Teotihuakan, Moče, Hopvel, Kongo, Mali, Maori, Aboridžini po oblastima…) | gotovo za Rim i 1400.; 1815. Okeanija (2) i Amerike (9 i 6) se mogu dopuniti |
| Traka resursa dolje | Gornja traka (zlato, vojska, zemlja…) ide dolje i uklapa se s donjim dugmadima | izgled: Codex; Claude pomaže s rasporedom |
| Traka događaja (kao u Counter-Strikeu) | Gore lijevo kratki redovi „Srbija (ikonica) Albanija": samo pad države i napad na državu, ne osvajanje gradova | gotovo (Claude, 08f-feed.js); Codex može dotjerati izgled |
| Dnevnik diplomatije | Desno, kao chat: ko je kome objavio rat, ko je s kim sklopio ili raskinuo savez | gotovo (dole desno, klik na red vodi do države; na telefonu skupljen) |
| Mikrodržave | Svijet danas ima 168 država na karti: 29 najmanjih (Malta, Singapur, Bahrein, Monako, San Marino, Vatikan, Andora, Lihtenštajn, Maldivi, Mauricijus, Sejšeli, karipska i pacifička ostrva…) manje su od 8 polja mreže (polje ≈ 25 × 25 km), pa su slobodna zemlja; Grenland i Tajvan su posebno | ako želiš svih 195: dodati ih kao male države (gradove-države) na njihovom polju |

## Otvorena pitanja

Dok ne kažeš drugačije, radim po pretpostavci u zagradi.

- [x] Domen: war.deovilab.com (Porkbun); server Ubuntu 24.04.
- [x] GitHub repozitorij i automatska objava.
- [x] Nove karte: prvo cijeli svijet.
- [x] Prijava: Google (odlučeno 24. 9.); rezerva e-mail. Client ID dobijen 25. 9. (u `deploy/compose.yml`); u Google Cloud konzoli mora biti dozvoljen origin https://war.deovilab.com.
- [ ] Gvozdena kupola (pretpostavka: automatski uzvraća, a nuklearke u letu obara PVO).
- [ ] Kampanja (pretpostavka: jedna država i dinastija kroz sva doba, kako piše gore).
- [ ] Portreti (pretpostavka: izmišljeni vladari).

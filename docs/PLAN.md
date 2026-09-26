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
| 66 | Interaktivni tutorijal | Gotovo (25. 9.): dugme „Tutorijal" na početnom ekranu — laka partija na Balkanu, 8 koraka (izbor, traka, širenje, snaga napada, gradnja, savezi, usmjereni napad, Vrati granice); svaki korak čeka da ga stvarno uradiš, dugme na koje se odnosi svijetli. |
| 67 | Sitnice | Gotovo (25. 9.): Revanš na kraju igre (iste postavke i država, odmah u igru); Tvoja boja (10 boja u postavkama); Mod za daltoniste (paleta Okabe-Ito, susjedi nikad iste boje; postavke i meni u igri). Grb je u profilu. Online: boja i revanš kasnije. |

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
| 5 | Brze stvari: usmjereni napad, vrati granice, pravo prolaza, ping i brze poruke, zvuk i muzika, sitnice, tutorijal | gotovo |
| 6 | Nalozi i baza (PostgreSQL): prijava preko Google-a (rezerva: e-mail), tvoje igre vezane za nalog (nastavi igru s bilo kojeg uređaja), statistike i ljestvica, dostignuća, snimi i nastavi | gotovo za igru protiv kompjutera: baza, Google prijava, profil (ime, ikonica, čin po pobjedama, statistike, uspješnost, 18 dostignuća, historija zadnjih 20 partija), ljestvica; snimi i nastavi (igra se snima sama svakih 20 s i kad zatvoriš stranicu, u pregledniku i na nalogu; „Nastavi igru" na početnom ekranu, i na drugom računaru kad si prijavljen; igra se obnavlja ponovnim odigravanjem tvojih komandi, pa je identična). Online igre se ne snimaju (server čuva igru 10 min za povratak) |
| 7 | Ekonomija i diplomatija: resursi i trgovina (opcija), porez i kamata, zajmovi sa zalogom, agresivna ekspanzija, vazali, moreuzi i kanali | gotovo: porez i kamata gotovi (klik na zlato ili Z: 5 nivoa poreza, zlato −40%…+45% ↔ rast vojske +22%…−30%; kamata 1%/min na ušteđeno zlato, najviše ¼ prihoda, samo za igrače — kod kompjutera je produžavala ratove); agresivna ekspanzija gotova (+5 za novi rat s državom, +12 za pokorenu državu, poluživot ~4,6 min; od 25 države hlade odnose, od 50 koalicija: niko ti ne daje savez, saveznici raskidaju; vrijedi i za kompjuter, partije na 10 seedova ~3 min duže); vazali gotovi (meni Savezi → Vazal: susjed ili protivnik u ratu s najviše 40% tvoje vojske i 50% zemlje; stalni savez van limita, danak 30% prihoda, bori se uz tebe; najviše 3; oslobodi se kad oslabiš ispod 1,1× njegove vojske, „Oslobodi“ nije izdaja; kompjuter za sada ne pravi vazale). zajmovi gotovi (Ekonomija: od susjeda, trgovinskih partnera i saveznika kompjutera; mali/srednji/veliki = 1/2/4 min tvog prihoda, vraća se +20% za 5 min, zalog 8/15/25% tvoje zemlje najbliže zajmodavcu, šrafiran na karti; rok: uzima se zlato ako ga imaš, inače zalog; najviše 2). moreuzi gotovi za Evropu (Bosfor i Dardaneli, Gibraltar, Danski moreuzi, Otranto, Mesina, Kerč; na mreži su Bosfor, Dardaneli i Kerč bili kopno, pa Crno i Azovsko more nisu bili spojeni sa Sredozemljem — sada jesu; ko drži ≥60% obje obale zatvara ga u Ekonomiji, prolaze samo njegovi i savezniči brodovi, +15 agresivnosti, ljutnja raste svakih 10 s prema broju luka; izgubljena obala ga otvara; na karti isprekidana linija, crvena kad je zatvoren). Svijet: isti moreuzi + Hormuški, Bab el-Mandeb, Malajski, a od 1914. Suecki i Panamski kanal (na mreži svijeta je Gibraltar bio kopno, pa je Sredozemlje bilo jezero — sada je spojeno s okeanom). Resursi i trgovina gotovi (opcija u postavkama operacije, i online): žito, metal (željezo → od 1914. čelik), gorivo (drvo → 1815. ugalj → od 1914. nafta) na ~80 stvarnih nalazišta u Evropi i ~240 na svijetu (build/deposits.js); svako ima bar jednu vrstu, niko sve tri; bez žita vojska raste 15% sporije, bez metala jedinice +30%, bez goriva zgrade i rakete +30%; kupuje se od trgovinskog partnera za 6–18% prihoda (ko ima više nalazišta, jeftiniji); kompjuter kupuje što mu fali; rombovi na karti. **Faza 7 gotova.** |
| 8 | Vojska: mornarica, avijacija, dronovi, jače nuklearke, gvozdena kupola | gotovo: jače nuklearke gotove (meta gubi više vojske — do 75%, gradovi u središtu padaju za nivo, 30 s krize privrede; radijacija traje ~85 s umjesto ~50 s i jače usporava napade; 60 s krize je partije produžavalo preko 40 min). Gvozdena kupola gotova (zgrada od 1938., 2,5 mil.: kad neko lansira nuklearku ili MIRV na tebe, svaka spremna kupola odmah ispali atomsku bombu na njegovu prijestolnicu pa najveće gradove; puni se 60 s; kompjuter je gradi i rjeđe gađa državu s kupolom; ikonu kupole treba nacrtati — Codex). Mornarica gotova (Vojska → Mornarica, iz luke; dodirni brod pa more): ratni brod (Trirema, Karaka, Linijski brod, Drednot, Bojni brod, Razarač) potapa desante, trgovačke i ratne brodove, blokira neprijateljske luke u krugu od 7 polja (bez zlata i trgovine) i gađa obalu; lovac (Liburna, Galija, Fregata, od 1914. Podmornica — nevidljiva dok joj ratni brod ne priđe na 5 polja) lovi desante i trgovačke brodove; kompjuter gradi brodove u ratu i šalje ih na neprijateljske luke. Modeli brodova su privremeni — Codex. Avijacija gotova (od 1938., Desant → Avijacija ili tipka A): eskadrile lovaca i bombardera na aerodromu (najviše 2 svake vrste po aerodromu); lovci obaraju neprijateljske bombardere i padobrance iznad mjesta do 22 polja od svog aerodroma (65%, s pratnjom upola manje), bombarderi lete do 70 polja, ruše zgrade, jedinice i vojsku u krugu 2 polja i vraćaju se (35 s); kompjuter ih kupuje i koristi. Dronovi gotovi (samo danas, u Raketama, bez silosa): kamikaza dron (45k, krug 1, do 45 polja od granice) i dron lovac (110k, udara jedinice u krugu 3, do 60 polja), leti pravo, najviše 6 u zraku, crta se kao grupa; PVO ih obara. Usput popravljen cepelin (1914.): komanda ga je odbijala. **Faza 8 gotova** (ikone kupole i modeli brodova/aviona — Codex) |
| 9 | Vladari s komentarima (portreti: Codex) | gotovo (Claude, jednostavan dizajn — Codex može dotjerati): svaka država kompjutera ima izmišljenog vladara (titula po dobu i dijelu svijeta — imperator, poglavica, kraljica, kralj, sultan, knez, car, šogun, maharadža, šah, kan, general, premijer, maršal, generalni sekretar, predsjednik/predsjednica — i ime) i jednostavan nacrtani portret (SVG, 3 vrste po dobu, miran i ljut). Oblačić s portretom iskače nad njegovom zemljom: 403 replike u 32 situacije (napad, izdaja, savez, trgovina, odbijanje, vazal, pobuna, zajam, zalog, nuklearka, kupola, moreuz, blokada, bombarderi, koalicija, skoro pobjeđuješ, hvalisanje, ruganje, panika, pad države, mirno doba gotovo, gluposti…). Najviše jedan oblačić svakih 9 s; Meni → Komentari vladara; vladar i u meniju države. |
| 10 | DEFCON mod, duge igre kroz dane | gotovo: DEFCON gotov (Način igre → DEFCON, i online): 5 faza po 3 min — 5 gradnja i savezi, 4 kopneni napadi, 3 more i zrak (desanti, padobranci, ratni brodovi i blokade, bombarderi), 2 rakete, EMP i dronovi, 1 nuklearke; stalno na ekranu faza, odbrojavanje i tvoji bodovi; poslije 25 min pobjeđuje ko ima najviše gradova i stanovništva (70% kopna i dalje odmah pobjeđuje); nuklearke u letu vide svi. Duge igre gotove: S prijateljem → Duga igra (danima) napravi igru s postavkama s početnog ekrana; server okreće jedan potez svakih 5 s (50× sporije, obična partija ~1 dan), čuva zapis na disku (preživi restart i objavu); link /long-<kod>; do 8 igrača, svako preuzme državu kompjutera; dok nisi tu, kompjuter vodi tvoju državu, kad se vratiš opet je tvoja; ko uđe kasnije, igra se sama odigra do trenutnog poteza. **Faza 10 gotova.** |
| 11 | Kampanja (~100 h, cijeli svijet) | gotova prva puna verzija (dizajn jednostavan): početni ekran → Kampanja; biraš dom dinastije (15 gradova u Evropi, 9 na svijetu) i ime; 7 poglavlja po dobima × 10 misija (proširi se, gradovi, riznica, savezi, pokori najslabijeg/najjačeg susjeda, odbrani prijestolnicu 8 min, preživi koaliciju 10 min, 40% regije, pobjeda) u regiji doma, sa državom koja drži dom u tom dobu; težina raste po poglavljima (lako → teško); 1–3 zvjezdice po vremenu, iskustvo za tehnološko stablo (vojska, ekonomija, diplomatija, nauka, po 5 nivoa) koje važi u svim dobima; slobodna igra u svakom dobu; napredak u pregledniku i na nalogu (/api/campaign); misija se snima i nastavlja kao obična igra. 70 misija ≈ 25–35 h; može se dopuniti posebnim misijama po dobu |

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

## Odluke 26. 9. (istraživanje, `docs/ISTRAZIVANJE.md`, poglavlje 8)

| Br | Stavka | Odluka |
| --- | --- | --- |
| 1 | Obavještenja (web push) | da |
| 2 | Naredbe za odsustvo | da, samo Focus |
| 3 | Focus igre na nalogu | da |
| 4 | Zašto me voli / mrzi | da, + na karti ko je s kim u savezu |
| 5 | Javna igra | = **Casual** u Online (ne miješati s rankedom) |
| 6 | Formiranje država | ne |
| 7 | Vrijeme u satima (Focus) | da |
| 8 | Online | početni ekran: **Online** ili **Conqueror** (solo). Online = **Casual** (Blitz / Focus / Make your choice, javne sobe, timovi, privatna soba po linku) i **Conquest League** (ranked) |
| 9 | Predaja, Ponudi kraj, vote kick | da (Casual i Conquest League); vote kick samo 5v5 (4 od 5, kao CS2), kikovanog mijenja računar; predaja u ligi 4 od 5 |
| 10 | Identitet dinastije | da |
| 11 | Replay | da: profil → historija partija → Replay |
| 12 | Kartica za dijeljenje | ne |
| 13 | Klanovi | ne |
| 14 | Ljestvica | samo liga: world ranking, top 100 za 1v1, 2v2, 5v5 (posebno Blitz i Focus) |
| 15 | Ponuda i potražnja | da, ručno: u meniju države **Zahtijevaj** (novac, vojska samo saveznik, zemlja, resurs, otvaranje moreuza/kanala…) i **Nudim** (novac, vojska, zemlja, resurs); druga strana prihvata, odbija ili pravi protivponudu (više novca, drugi resurs…), dok se ne dogovore |
| 16 | Igraj odmah | da, samo solo |
| 17 | Editor scenarija | da, zove se **Community market**: praviš i objavljuješ scenarije, igraš tuđe |
| 18 | Jači trenuci | ne |
| 19 | Pametnija izdaja kompjutera | da |
| 20 | Pobjeda saveza | da; u ligi pobjeda = uništiti sve protivnike (za Blitz ligu treba pravilo kraja — otvoreno pitanje) |
| 21 | Kasni ulazak u Focus | otvoreno (prijedlog: zaštita dok prvi put ne napadneš čovjeka, najviše 3 h, + dotacija zlata i vojske) |
| 22 | Nuklearke bez spama | da, tajmer ~50% kraći od prvog prijedloga (Blitz 1,5 min; Focus se razvuče s igrom); traka na ikoni do povratka cijene |
| 23 | Ključni trenuci na grafiku | da |
| 24 | Aplikacija (PWA) | da, instalira se kao prava aplikacija |
| 25 | Prijava igrača + nalog | da; nalog obavezan za Online (Casual, liga, privatna soba); cijeli solo radi bez naloga |

**Conquest League (ranked)**: biraš Blitz ili Focus i 1v1, 2v2 ili 5v5; **Find match** sam ili s prijateljima (party).
ELO: start 500, najniže 100; prvih 5 partija „Unranked“ (K = 40), zatim K = 24; 6 odvojenih ljestvica (3 veličine × Blitz/Focus).
Timovi: raspodjela po prosjeku, a **svako dobija svoje bodove**: očekivanje igrača = 1 / (1 + 10^((prosjek protivnika −
njegov ELO)/400)), promjena = K × (rezultat − očekivanje) — jači igrač u slabijem timu dobija manje i gubi više (party
najviše ±250 ELO razlike, protiv „dizanja“ prijatelja). Rankovi: **Raider** 100–299 · **Vanguard** 300–449 · **Warlord**
450–599 · **Emperor** 600–799 · **Overlord** 800+. Napuštanje: gubiš ELO, bez zabrane traženja. Pick/ban: bazen cijeli svijet
+ 6 kontinenata i 7 doba; svaki tim tajno bira 2 i banuje 1 (i mapu i doba), računar bira između odabranih, animirano.
Samo igrači, start od malih polja (od prijestolnice, bez država kompjutera).

## Plan faza 12–19: Claude i Codex

Pravilo rada: **Claude** pravi logiku, server i jednostavan ekran koji radi (postojeće klase, nove stvari dobiju stalne
`id` / `data-` oznake zapisane ovdje); **Codex** radi izgled prethodne faze dok Claude radi sljedeću — tako ne diraju iste
fajlove u isto vrijeme (Codex: `style.css`, izgled u `body.html` i ikone; Claude: `src/0[0-4]*`, `src/09*`, `deploy/`).
Codex radi preko PR-a na `main`; poslije svake faze Claude upiše „Za Codex“ u ovu tabelu.

| Faza | Claude (logika, server) | Codex (izgled) u isto vrijeme |
| --- | --- | --- |
| 12 | **Temelj**: server sam vrti simulaciju Focus i online igara (isti kod `src/00–04` u nodeu) → pošten rezultat (ELO se ne može lažirati), događaji za obavještenja; nalog obavezan za Online; skelet novog početnog ekrana (Online / Conqueror, prazna dugmad s oznakama) | C1: rank značke (5, SVG), logo Conquest League, ikona aplikacije; dotjerivanje Focus izvještaja, modova i stabla |
| 13 | **Brze stvari**: 2 naredbe za odsustvo, 3 Focus na nalogu, 4 razlozi odnosa + linije saveza (tipka L), 7 vrijeme u satima, 10 dinastija, 16 Igraj odmah, 19 izdaja, 22 nuklearke + traka, 23 oznake na grafiku | C2: novi početni ekran Online / Conqueror (na Claudeov skelet) |
| 14 | **Ponuda i potražnja** (15): komande `offer`/`counter`/`accept`, kompjuter procjenjuje ponude po vrijednosti | C3: izgled faze 13 (razlozi odnosa, linije saveza, traka nuklearke, grafik, meni „Dok me nema“, lista Focus igara) |
| 15 | **Casual online**: javne sobe (Blitz / Focus / Make your choice), timovi 2v2, 3v3, ljudi protiv država, privatna soba, 9 predaja i ponudi kraj, 20 pobjeda saveza, 25 prijava igrača, 21 kasni ulazak (kad odlučiš) | C4: prozor pregovora (faza 14) |
| 16 | **Conquest League**: ELO i 6 ljestvica, red za traženje i party, pick/ban (logika i tajnost na serveru), start od malih polja, pobjeda uništenjem, vote kick 5v5, predaja 4/5, world ranking top 100, historija partija | C5: Casual ekrani (lobi, traženje, timovi) |
| 17 | **Replay** (11): server čuva zapis svake online i ligaške partije; profil → historija → Replay (4–16×) | C6: liga: ekran traženja, **animacija pick/ban**, rank u profilu, ljestvica |
| 18 | **Aplikacija + obavještenja** (24 + 1): manifest, service worker, instalacija, web push iz servera (ključevi u GitHub Secrets) | C7: kontrole replaya, dugme i ekran instalacije, podešavanja obavještenja |
| 19 | **Community market** (17): editor scenarija (doba, karta, granice, mjesta za igrače), objava na nalogu, pregled i igranje tuđih | C8: izgled editora i marketa |

Zašto ovim redom: faza 12 je temelj za ligu (pošten rezultat) i obavještenja; brze stvari (13) odmah poboljšavaju igru i
daju Codexu posao; pregovori (14) trebaju i Casual i ligi; Casual (15) postavlja sobe i timove na kojima liga (16) stoji;
replay (17) koristi zapise iz lige; obavještenja (18) koriste serversku simulaciju iz 12; market (19) je najveći i
najmanje hitan.

## Otvorena pitanja

Dok ne kažeš drugačije, radim po pretpostavci u zagradi.

- [x] Domen: war.deovilab.com (Porkbun); server Ubuntu 24.04.
- [x] GitHub repozitorij i automatska objava.
- [x] Nove karte: prvo cijeli svijet.
- [x] Prijava: Google (odlučeno 24. 9.); rezerva e-mail. Client ID dobijen 25. 9. (u `deploy/compose.yml`); u Google Cloud konzoli mora biti dozvoljen origin https://war.deovilab.com.
- [x] Gvozdena kupola: automatski uzvraća, a nuklearke u letu obara PVO (kao i do sada).
- [x] Kampanja: jedna dinastija kroz sva doba (dom = grad; u svakom dobu država koja ga drži).
- [x] Portreti: izmišljeni vladari (za sada jednostavni SVG portreti, Codex ih može zamijeniti).

'use strict';
/* Rulers with comments (plan phase 9): every computer state has an invented ruler (a title and a name that fit its era
   and part of the world, never a real politician) and a simple drawn portrait (3 kinds per era, calm and angry).
   Now and then the ruler's head pops up on its land with a speech bubble: angry when you attack, swearing, praising an
   alliance, panicking when losing, gloating, or just talking nonsense. Mild insults, never about nationality.
   UI only: the simulation never reads any of it (online players may see different lines). */

/* ---------------- who rules: title, name, portrait kind ---------------- */
RA.RULER_KINDS = {
  rim: [{ t: 'Imperator', k: 'laurel' }, { t: 'Poglavica', k: 'chief' }, { t: 'Kraljica', k: 'queen', f: 1 }],
  srednji: [{ t: 'Kralj', k: 'crown' }, { t: 'Sultan', k: 'turban' }, { t: 'Knez', k: 'fur' }],
  napoleon: [{ t: 'Car', k: 'bicorne' }, { t: 'Kralj', k: 'crown' }, { t: 'Kraljica', k: 'queen', f: 1 }],
  ww1: [{ t: 'Car', k: 'helmet' }, { t: 'General', k: 'cap' }, { t: 'Premijer', k: 'suit' }],
  ww2: [{ t: 'Maršal', k: 'cap' }, { t: 'Kralj', k: 'crown' }, { t: 'Predsjednik', k: 'suit' }],
  hladni: [{ t: 'Generalni sekretar', k: 'suit' }, { t: 'Predsjednik', k: 'suit' }, { t: 'General', k: 'cap' }],
  danas: [{ t: 'Predsjednik', k: 'suit' }, { t: 'Predsjednica', k: 'suitf', f: 1 }, { t: 'Premijer', k: 'suit' }],
};
/* titles of other parts of the world in the older eras (by the capital's place) */
RA.rulerTitle = function (era, lat, lon, base) {
  const old = ['rim', 'srednji', 'napoleon'].includes(era);
  if (!old && era !== 'ww1') return base;
  if (lon > 128 && lat > 30 && lat < 46) return { t: era === 'ww1' ? 'Car' : 'Šogun', k: 'kabuto' };
  if (lon > 98 && lat > 18) return { t: 'Car', k: 'crown' };
  if (lon > 66 && lon < 92 && lat < 32) return { t: 'Maharadža', k: 'turban' };
  if (lon > 44 && lon < 64 && lat > 24 && lat < 40) return { t: 'Šah', k: 'turban' };
  if (lon > 52 && lat >= 40) return { t: 'Kan', k: 'fur' };
  if (lat < 36 && lat > 12 && lon > -18 && lon < 60 && old) return { t: 'Sultan', k: 'turban' };
  if (lon < -30 && old) return { t: 'Poglavica', k: 'chief' };
  if (lat < 12 && lon > -20 && lon < 52 && old) return { t: 'Kralj', k: 'chief' };
  return base;
};
RA.RULER_NAMES = {
  rim: { m: ['Aurelijan', 'Valerijan', 'Kasije', 'Marcijan', 'Flavije', 'Septimije', 'Klaudije', 'Oktavijan', 'Tercije', 'Brenos', 'Vercingetor', 'Budimir', 'Ambriks', 'Tarkvinije'], f: ['Livija', 'Julija', 'Hortenzija', 'Boudika', 'Teuta', 'Agripina'] },
  srednji: { m: ['Radoslav', 'Otokar', 'Bela', 'Tvrtko', 'Ladislav', 'Gundomir', 'Hildebrand', 'Bolesko', 'Rodrigo', 'Almerik', 'Svjetoslav', 'Kasim', 'Murad', 'Dragoljub', 'Branimir', 'Ingvar', 'Leopold', 'Selim'], f: ['Jelena', 'Katarina', 'Margareta', 'Izabela'] },
  napoleon: { m: ['Fridrih', 'Ferdinand', 'Aleksije', 'Maksimilijan', 'Ludvig', 'Gustav', 'Albert', 'Konstantin', 'Oskar', 'Milorad', 'Emanuel'], f: ['Karolina', 'Leopoldina', 'Viktorija', 'Hortenzija', 'Amalija', 'Luiza'] },
  ww1: { m: ['Vilhelm', 'Konrad', 'Nikola', 'Albert', 'Herbert', 'Radomir', 'Gerhard', 'Ferdinand', 'Artur', 'Emil', 'Stjepan', 'Ottokar', 'Klement'], f: ['Marija', 'Aleksandra'] },
  ww2: { m: ['Vukašin', 'Hartmut', 'Leonid', 'Edgar', 'Bruno', 'Aleksandar', 'Gaston', 'Umberto', 'Kasimir', 'Sigmund', 'Tihomir', 'Oswald'], f: ['Vilhelmina', 'Elizabeta'] },
  hladni: { m: ['Boris', 'Hubert', 'Miroslav', 'Arnold', 'Vadim', 'Richard', 'Stanko', 'Lothar', 'Evgenij', 'Clarence', 'Radovan', 'Gunther'], f: ['Golda', 'Indira'] },
  danas: { m: ['Marko', 'Lukas', 'Tomas', 'Viktor', 'Damir', 'Pavel', 'Emir', 'Filip', 'Oliver', 'Stefan', 'Jonas', 'Adrian'], f: ['Elena', 'Ana', 'Mira', 'Sofija', 'Ingrid', 'Lucija', 'Nora', 'Klara'] },
};
RA.RULER_SURNAMES = ['Gromovnik', 'Veliki', 'Mudri', 'Hrabri', 'Brzi', 'Tvrdi', 'Kovač', 'Orlović', 'Vuković', 'Stein', 'Ferro', 'Dubois', 'Novak', 'Kranjc', 'Ivanović', 'Bauer', 'Rossi', 'Lindqvist', 'Horvat', 'Petrović', 'Moreau', 'Zorić'];

/* ---------------- lines: {ja} = the ruler's state, {ti} = your state, {on} = another state ---------------- */
RA.RULER_LINES = {
  greet: [
    'Dobrodošao u komšiluk, {ti}. Drži se svoje strane granice.', 'Novi susjed? Nadam se da znaš kuhati bolje nego ratovati.', 'Pozdrav od {ja}! Ne diraj nam granicu i bićemo najbolji prijatelji.',
    'Aha, {ti}. Čuo sam za vas. Ništa dobro, doduše.', 'Mir i trgovina, {ti}? Ili ćemo odmah na mačeve?', 'Ja sam ovdje glavni. Ti si tu samo u prolazu.',
    'Moji savjetnici kažu da ste opasni. Ja kažem da ste mali.', 'Neka ti je sa srećom, susjede. Trebaće ti.', 'Vidim te na karti, {ti}. Stalno te vidim.',
    'Donio sam ti poklon: prazno obećanje. Kao i uvijek.', 'Lijepa vam je prijestolnica. Bila bi i ljepša pod mojom zastavom.', 'Ne brini, {ti}, ja sam miroljubiv. Uglavnom.',
  ],
  attacked: [
    '{ti}! Izdajice jedna podla!', 'Napadaš MENE? Ti, s onom vojskom od papira?', 'Ovo ćeš platiti, {ti}. Sa kamatom.', 'Mislio sam da si pametniji. Pogriješio sam.',
    'Moji generali te već crtaju na zidu za pikado!', 'Sramota! Ni pozdrav prije rata?', 'Bježi s moje zemlje, ološu!', 'Vi ste obični razbojnici, {ti}!',
    'Dobro. Hoćeš rat? Imaćeš rat.', 'Ko te je naučio ratovati, kokoš?', 'Pisaću o ovome u historijskim knjigama. Ružno ću te nacrtati.', 'Ovo nije fer! Ja sam htio prvi!',
    'Nosi se! Nosi se s mojih polja!', 'Majko mila, pa ti stvarno napadaš!', 'Svi na granicu! Svi! I kuhar!',
  ],
  taunt: [
    'Tvoja zemlja je lijepa, {ti}. Biće još ljepša kad bude moja.', 'Iznenađenje! Nisi valjda mislio da ću čekati?', 'Ništa lično, {ti}. Samo mi treba još malo zemlje.',
    'Predaj se odmah i poštedjeću ti kozu.', 'Moji vojnici su dosadni. Ti si im zabava.', 'Kucam, kucam! Ko je? Rat!', 'Hvala na gostoprimstvu, {ti}. Ostaćemo malo duže.',
    'Tvoja vojska je smiješna. Moja se već smije.', 'Pripremi ključeve grada, stižemo!', 'Ovo je samo zagrijavanje.', 'Trebao si graditi utvrde umjesto spomenika.',
    'Izvini, ruka mi je sama krenula prema tvojoj granici.',
  ],
  losing: [
    'Pomoć! Ko god čuje, pomoć!', 'Ovo nije poraz. Ovo je... taktičko povlačenje. Brzo povlačenje.', 'Savjetnici, pakujte kofere! I moje krune!', 'Nismo gotovi! Samo smo malo... manji.',
    'Zašto mi to radiš, {ti}? Šta sam ti skrivio?', 'Dobro, dobro, predomislio sam se. Mir? Molim?', 'Ovo će mi pokvariti ugled kod komšija.', 'Treba mi hitno čudo. Ili dva.',
    'Sve je u redu. Ništa nije u redu.', 'Moja karta se smanjuje! Neko je sakrio pola države!', 'Ako padnem, pašću s dostojanstvom. Ili vrišteći.', 'Zovite saveznike! Ima li nas još saveznika?',
  ],
  fallen: [
    'Ovo još nije kraj, {ti}! ...Dobro, jeste.', 'Zapamtićeš me! Ili bar moj grob.', 'Moji potomci će se vratiti. Negdje. Nekad.', 'Prokleti bili, {ti}, i tvoja karta!',
    'Samo sam htio malo mira i kolača...', 'Uzmi sve, ali ostavi mi pjesmu o meni.', 'Idem u egzil. Neko ima ljepše vrijeme od ovoga.', 'Pobijedio si. Nemoj se previše radovati, ružno ti stoji.',
    'Istorija će reći da sam bio u pravu.', 'Čuvaj mi palatu. I nahrani mačku.',
  ],
  conquest: [
    '{on} više ne postoji. Ko je sljedeći?', 'Još jedna zastava za moju zbirku!', 'Ha! {on} je pao kao kula od karata.', 'Karta je sada ljepša. Više moje boje.',
    'Pobjeda! Slavimo tri dana, pa opet u rat.', 'Neka ovo bude pouka svima!', 'Kome treba diplomatija kad imaš vojsku?', '{on} je bio slab. Svi ste slabi.',
  ],
  ally: [
    'Savez s {ti}! Zajedno smo nepobjedivi. Barem na papiru.', 'Dobro došli u savez, prijatelji! Vi čuvate lijevi bok, mi desni.', 'Savez je sklopljen. Ne zaboravi, ja sam stariji partner.',
    'Zajedno ćemo im pokazati!', 'Ruke uvis za savez! Pa ruke na oružje.', 'Neka se neprijatelji tresu! Ili bar malo drhte.', 'Pošten savez, pošteni ljudi. Uglavnom.',
    'Od danas smo braća po oružju. I po zlatu, nadam se.', 'Konačno neko pametan u komšiluku!', 'Ovo pečatim krunom i dobrom rakijom.',
  ],
  allyEnd: [
    'Savez je istekao. Bilo je lijepo dok je trajalo.', 'Ugovor je istekao, {ti}. Produži ako me voliš.', 'Kraj saveza. Ništa lično, ali pazi na granicu.',
    'Istekao savez? Nisam ni primijetio. Dobro, jesam.', 'Hvala za saradnju. Račun stiže poštom.',
  ],
  betrayed: [
    'IZDAJICE! Pljujem na tvoj savez!', 'Znao sam da ti ne treba vjerovati, {ti}!', 'Juda u kruni! Eto šta si!', 'Nož u leđa! Od saveznika! Sramota!',
    'Nikad ti ovo neću oprostiti. Ni moji unuci.', 'Zmijo jedna otrovna!', 'A ja ti poslao poklone za praznike...', 'Svi će znati šta si uradio, {ti}. Svi!',
    'Ovo je najgori dan mog vladanja.', 'Zapisujem te u crnu knjigu. Velikim slovima.',
  ],
  betrayer: [
    'Oprosti, {ti}. Posao je posao.', 'Savez? Kakav savez? Ne sjećam se.', 'Ništa lično, samo ti je zemlja bila preblizu.', 'Pročitaj sitna slova ugovora, prijatelju.',
    'Uvijek sam više volio sebe nego tebe.', 'Bilo je zabavno dok je trajalo. Za mene.',
  ],
  trade: [
    'Trgovina! Moje zlato voli tvoje zlato.', 'Dobar posao, {ti}. Ti dobijaš robu, ja dobijam više robe.', 'Brodovi plove, kese se pune. Lijep dan.',
    'Kupuj, prodaj, ne ratuj. Barem ne danas.', 'Moji trgovci te već vole. Moji generali manje.', 'Trgovački savez! Neka teče zlato!', 'Pošalji nam malo začina, mi šaljemo malo poreza.',
    'Pare vole mir. Ja volim pare.',
  ],
  refuse: [
    'Savez s tobom? Radije bih se oženio kozom.', 'Ne, hvala. Imam ukusa.', 'Hmm... ne. Pitaj ponovo za sto godina.', 'Moji savjetnici su se smijali tri sata na tvoju ponudu.',
    'Odbijeno. Ali cijenim hrabrost.', 'Ti i ja? Nikad!', 'Probaj opet kad budeš veći.', 'Poruka primljena, pročitana i spaljena.',
    'Ne vjerujem ti ni koliko mogu baciti tvog ambasadora.', 'Neee. Mada ti je lijep šešir.',
  ],
  refuseVassal: [
    'Ja? Tvoj vazal? Prije ću pojesti svoju krunu!', 'Klečati pred tobom? Nikad!', 'Slobodni smo i ostaćemo slobodni!', 'Pokušaj ponovo kad mi ostane samo jedan grad.',
    'Vazal? Zvuči kao bolest.', 'Imam ja ponos, {ti}. Malo, ali imam.',
  ],
  vassal: [
    'Dobro, {ti}... Klanjam se. Nerado.', 'Evo ti danak. Guši se njime.', 'Služiću ti. Za sada.', 'Bolje vazal nego mrtav, kažu.',
    'Ovo je najtužniji dan moje dinastije.', 'Primi naš danak i ostavi nam bar himnu.',
  ],
  rebel: [
    'Slobodni smo! Nosi svoj danak, {ti}!', 'Tvoje vrijeme je prošlo. Moje tek dolazi!', 'Više ti ne klečimo!', 'Ha! Oslabio si. Mi nismo.',
    'Lanci su pukli! Živjela sloboda!', 'Hvala na godinama služenja. Nimalo.',
  ],
  loan: [
    'Evo zlata, {ti}. Vrati na vrijeme ili ćemo razgovarati drugačije.', 'Posudba je posudba. Kamata je ljubav.', 'Dobro, posudiću ti. Ali pazim ja na tvoj zalog.',
    'Zlato ide tebi, zemlja možda meni. Vidjećemo.', 'Ne zaboravi rok. Ja nikad ne zaboravljam.',
  ],
  refuseLoan: [
    'Zajam? Tebi? Ha!', 'Moja riznica nije milostinja.', 'Vrati prvo ono što si ukrao, pa pričaj o zajmu.', 'Nemam para. Za tebe.',
  ],
  pledge: [
    'Rok je prošao, {ti}. Zalog je moj!', 'Dug je dug. Hvala na zemlji!', 'Trebao si čitati ugovor. Sada je ovo moje.', 'Kamata se plaća zemljom, prijatelju.',
  ],
  nuked: [
    'Ti si LUDAK, {ti}! Luđak s atomskom bombom!', 'Moji gradovi! Gore moji gradovi!', 'Ovo je zločin! Cijeli svijet te gleda!', 'Nuklearka?! Ozbiljno?!',
    'Kunem se, osvetiću se. Iz podruma, ali osvetiću se.', 'Ostaće samo pepeo i tvoja sramota!', 'Nemaš ti srca, {ti}. Samo silos.', 'Svi u bunker! Svi!',
  ],
  nukeThreat: [
    'Pogledaj u nebo, {ti}. Stiže ti poklon.', 'Imao si priliku za mir.', 'Ovo je za moje gradove!', 'Neka svijet vidi ko je ovdje glavni.',
    'Nije ništa lično. Samo radioaktivno.',
  ],
  dome: [
    'Kupola radi! Evo ti nazad tvoja bomba!', 'Mislio si da sam bez odbrane? Ha!', 'Udariš li mene, gori i tvoja kuća.', 'Automatski uzvrat. Automatska sramota za tebe.',
  ],
  strait: [
    'Zatvorio si moreuz?! Moji trgovci plaču!', 'Otvori moreuz, {ti}, ili ćemo ga otvoriti topovima!', 'Ko ti je dao more? More je svačije!', 'Blokada? Ovo je piratstvo!',
  ],
  blockade: [
    'Moja luka je u blokadi! Skloni te brodove!', 'Tvoji brodovi smrde po barutu i bezobrazluku.', 'Ribari mi ne mogu ni na pecanje! Sramota!',
  ],
  bombed: [
    'Bombarderi iznad moje prijestolnice?! Oborite ih!', 'Avioni! Sa neba! Kakva nepristojnost!', 'Tvoji piloti su gori od tvojih generala.',
  ],
  coalition: [
    'Dosta je bilo, {ti}! Svi zajedno protiv tebe!', 'Tvoja glad za zemljom nas je ujedinila.', 'Koalicija je sklopljena. Tvoji dani su odbrojani.', 'Previše si progutao, {ti}. Vrijeme je da povratiš.',
    'Cijeli kontinent se udružuje. Čestitam, to je tvoja zasluga.', 'Ne može jedan sam pojesti cijelu tortu!',
  ],
  nearWin: [
    'Neko zaustavite {ti}! Uzima sve!', '{ti} je blizu pobjede. Možda je vrijeme za panike.', 'Ne sviđa mi se kako izgleda ova karta.', 'Još malo i svi ćemo govoriti kako {ti} kaže.',
    'Ujedinimo se! Sad ili nikad!', 'Kako smo pustili da {ti} toliko naraste?',
  ],
  boast: [
    'Pogledaj kartu. Vidiš onu veliku mrlju? To sam ja.', 'Ja sam najveći, najjači i najskromniji.', 'Kleknite, male države!', 'Uskoro ću trebati veću kartu.',
    'Zlato, vojska, zemlja — imam sve. Osim dosade.', 'Svako jutro se probudim i osvojim nešto.',
  ],
  weak: [
    'Ti si ta mala država? Mislio sam da je mrlja na karti.', 'Tvoja vojska stane u jednu kočiju.', 'Slatko. Imaš i zastavu?', 'Ne brini, {ti}, neću te napasti. Nisi vrijedan truda.',
  ],
  peaceOver: [
    'Mirno doba je gotovo. Pazi se, {ti}.', 'Kraj mira! Konačno!', 'Sad počinje prava igra.', 'Oštrite mačeve, mir je istekao.',
    'Nadam se da si se dobro odmorio. Više nećeš.',
  ],
  help: [
    'Stižem, saveznice! Drži se!', 'Neprijatelj tvog prijatelja je moj neprijatelj. Ili tako nešto.', 'Šaljem vojsku! I sendviče!', 'Niko ne dira mog saveznika!',
  ],
  nonsense: [
    'Da li je neko vidio moju krunu? Bila je tu maločas.', 'Danas sam donio zakon protiv ponedjeljka.', 'Moj konj bi bio bolji vladar od pola ovih ovdje.', 'Zašto je more slano? Istražiti! Hitno!',
    'Moji astrolozi kažu da će sutra biti srijeda.', 'Uveo sam porez na pjevanje pod tušem.', 'Kad sam bio mlad, granice su bile ravnije.', 'Nekad mi se čini da me neko pomjera po karti.',
    'Proglasio sam današnji dan praznikom kolača.', 'Moj dvorski luda kaže da sam ja dvorska luda.', 'Probao sam osvojiti mjesec. Previsoko.', 'Ne mogu zaspati od silnih dugmadi na mapi.',
    'Je li ovo potez ili sam kliknuo slučajno?', 'Moja mačka je glavni savjetnik. Ima bolje ideje.', 'Ko je izmislio zimu? Hoću njegovu adresu.', 'Kažu da je pametan vladar tih vladar. Ja nisam tih.',
    'Planiram rat. Ili ručak. Još ne znam.', 'Sreo sam jednog kartografa. Rekao je da sam okrugao.', 'Dvor je hladan. Treba nam veći kamin. I veća država.', 'Pitao sam narod šta želi. Rekli su "manje pitanja".',
    'Najbolja strategija je sakriti se iza planine. Ako je imaš.', 'Danas sam naučio novu riječ: "blokada". Zvuči ukusno.', 'Neka mi neko objasni šta je "tutorijal".', 'Zlato ne raste na drveću. Provjerio sam.',
  ],
  angryHuman: [
    'Opet ti, {ti}? Zar nemaš pametnijeg posla?', 'Tvoje lice mi se ne sviđa. Ni tvoje granice.', 'Bez uvrede, {ti}, ali ti si budala.', 'Čuvaj se, {ti}. Pamtim sve.',
    'Moja baka bi bolje vodila tvoju državu.', 'Da si pola pametan koliko si drzak...',
  ],
};

/* ---------------- a simple portrait (SVG): head, headwear by kind, calm or angry ---------------- */
RA.rulerPortrait = function (kind, color, angry, seed) {
  const skin = ['#f1c9a5', '#e0ac85', '#c68b61', '#9b6a45', '#6f4a33'][seed % 5];
  const hair = ['#2b2118', '#5a3a22', '#8b6b3e', '#c9c2b8', '#1c1c1c'][(seed >> 3) % 5];
  const f = kind === 'queen' || kind === 'suitf';
  let hat = '', body = `<path d="M14 64 Q32 44 50 64 Z" fill="${color}"/>`;
  switch (kind) {
    case 'laurel': hat = `<path d="M18 22 Q32 10 46 22" stroke="#6d9b3f" stroke-width="4" fill="none" stroke-dasharray="3 2"/>`; body = `<path d="M14 64 Q32 44 50 64 Z" fill="#e8e2d0"/><path d="M20 58 L38 48 L44 62" stroke="${color}" stroke-width="4" fill="none"/>`; break;
    case 'crown': hat = `<path d="M20 20 L22 9 L27 16 L32 7 L37 16 L42 9 L44 20 Z" fill="#e3b53c" stroke="#8a6a17"/>`; break;
    case 'queen': hat = `<path d="M22 18 L24 10 L28 15 L32 8 L36 15 L40 10 L42 18 Z" fill="#e3b53c" stroke="#8a6a17"/>`; break;
    case 'turban': hat = `<ellipse cx="32" cy="17" rx="15" ry="9" fill="#f2efe6" stroke="#bfb6a0"/><circle cx="32" cy="14" r="2.5" fill="${color}"/>`; break;
    case 'fur': hat = `<rect x="18" y="10" width="28" height="11" rx="5" fill="#6b4a2e"/><rect x="21" y="6" width="22" height="7" rx="3" fill="${color}"/>`; break;
    case 'chief': hat = `<path d="M18 20 L14 6 M24 18 L22 3 M32 17 L32 1 M40 18 L42 3 M46 20 L50 6" stroke="${color}" stroke-width="3"/>`; break;
    case 'bicorne': hat = `<path d="M12 20 Q32 2 52 20 Q32 14 12 20 Z" fill="#1d1d24"/><circle cx="32" cy="14" r="2.5" fill="${color}"/>`; body = `<path d="M14 64 Q32 44 50 64 Z" fill="#23304a"/><path d="M24 54 H40" stroke="#e3b53c" stroke-width="3"/>`; break;
    case 'helmet': hat = `<path d="M18 22 Q32 4 46 22 Z" fill="#3c3c3c"/><path d="M32 6 V0" stroke="#bcbcbc" stroke-width="3"/>`; body = `<path d="M14 64 Q32 44 50 64 Z" fill="#4a5a3a"/>`; break;
    case 'kabuto': hat = `<path d="M16 22 Q32 6 48 22 Z" fill="#2a2a2a"/><path d="M22 10 L32 2 L42 10" stroke="#e3b53c" stroke-width="3" fill="none"/>`; break;
    case 'cap': hat = `<path d="M17 18 Q32 8 47 18 L47 21 L17 21 Z" fill="#3d4a33"/><rect x="15" y="20" width="22" height="3" rx="1" fill="#1e2318"/><circle cx="32" cy="15" r="2.5" fill="${color}"/>`; body = `<path d="M14 64 Q32 44 50 64 Z" fill="#4b5a3c"/><circle cx="24" cy="56" r="2" fill="#e3b53c"/><circle cx="40" cy="56" r="2" fill="#e3b53c"/>`; break;
    case 'suit': case 'suitf': body = `<path d="M14 64 Q32 44 50 64 Z" fill="#2a3340"/><path d="M29 50 L32 58 L35 50 Z" fill="${color}"/>`; break;
  }
  const hairEl = f ? `<path d="M19 30 Q16 14 32 12 Q48 14 45 30 L47 42 Q40 36 44 28 Q32 18 20 28 Q24 36 17 42 Z" fill="${hair}"/>` : kind === 'suit' || kind === 'cap' || kind === 'helmet' ? `<path d="M20 24 Q32 12 44 24 L44 20 Q32 10 20 20 Z" fill="${hair}"/>` : '';
  const brow = angry ? '<path d="M23 25 L29 28 M41 25 L35 28" stroke="#2a1d14" stroke-width="2"/>' : '<path d="M23 26 Q26 24 29 26 M35 26 Q38 24 41 26" stroke="#2a1d14" stroke-width="1.6" fill="none"/>';
  const mouth = angry ? '<path d="M26 40 Q32 35 38 40" stroke="#6b2b22" stroke-width="2.2" fill="none"/>' : '<path d="M26 37 Q32 42 38 37" stroke="#6b2b22" stroke-width="2" fill="none"/>';
  const beard = !f && seed % 3 === 0 ? `<path d="M22 36 Q32 50 42 36 Q40 44 32 46 Q24 44 22 36 Z" fill="${hair}"/>` : '';
  const cheeks = angry ? '<circle cx="24" cy="35" r="3" fill="#e0685a" opacity=".45"/><circle cx="40" cy="35" r="3" fill="#e0685a" opacity=".45"/>' : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="10" fill="${angry ? '#4a2323' : '#1f2a33'}"/>${body}${hairEl}<ellipse cx="32" cy="31" rx="12" ry="14" fill="${skin}"/>${beard}${brow}<circle cx="27" cy="30" r="1.7" fill="#1a1a1a"/><circle cx="37" cy="30" r="1.7" fill="#1a1a1a"/>${mouth}${cheeks}${hat}</svg>`;
};

/* ---------------- the ruler of a state (stable for the game: from its id, key and era) ---------------- */
RA.rulerOf = function (G, p) {
  if (p._ruler) return p._ruler;
  const era = G.era || 'danas', kinds = RA.RULER_KINDS[era] || RA.RULER_KINDS.danas;
  const key = (p.iso || p.name || '') + ':' + p.id;
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  let base = kinds[h % kinds.length];
  if (p.capital >= 0) {
    const ll = G.map.latLngOfCell(p.capital);
    base = RA.rulerTitle(era, ll[0], ll[1], base);
  }
  const pool = RA.RULER_NAMES[era] || RA.RULER_NAMES.danas, names = base.f ? pool.f : pool.m;
  let name = names[(h >>> 4) % names.length];
  if (['danas', 'hladni', 'ww2', 'ww1'].includes(era)) name += ' ' + RA.RULER_SURNAMES[(h >>> 9) % RA.RULER_SURNAMES.length];
  else if ((h >>> 7) % 3 === 0) name += ' ' + ['II.', 'III.', 'IV.', 'Veliki', 'Mudri', 'Strašni', 'Crveni'][(h >>> 11) % 7];
  return (p._ruler = { title: base.t, kind: base.k, name, seed: h });
};

/* ---------------- speech bubbles on the map ---------------- */
Object.assign(RA.UI.prototype, {
  rulersReset() {
    this.rl = { next: 0, per: new Map(), missiles: new Set(), aeWarn: false, nearWin: false, peace: false, greet: false, chatterAt: 0, panic: new Set() };
    const box = this.$('rulerBubble');
    if (box) box.hidden = true;
  },
  /* say(pid, situation, {on, force}) — a line from that state's ruler, if the player wants comments and it's not too soon */
  rulerSay(pid, sit, o = {}) {
    const G = this.G, me = G && G.me, p = G && G.P[pid];
    if (!p || !p.alive && sit !== 'fallen' || p.human || !me || this.app.attractMode || this.settings.rulers === false) return false;
    const R = this.rl || (this.rulersReset(), this.rl), now = performance.now();
    if (!o.force && now < R.next) return false;
    if (now < (R.per.get(pid) || 0) && !o.force) return false;
    const pool = RA.RULER_LINES[sit];
    if (!pool) return false;
    const ru = RA.rulerOf(G, p);
    const i = (Math.random() * pool.length) | 0;
    const txt = pool[i].replace(/\{ja\}/g, p.name).replace(/\{ti\}/g, me.name).replace(/\{on\}/g, o.on ? G.P[o.on].name : 'neko');
    const angry = /attacked|betrayed|nuked|refuse|strait|blockade|bombed|coalition|angryHuman|losing|fallen|rebel|pledge|refuseLoan|refuseVassal/.test(sit);
    R.next = now + 9000;
    R.per.set(pid, now + 35000);
    this.rulerShow(p, ru, txt, angry, o.cell);
    return true;
  },
  rulerShow(p, ru, txt, angry, cell) {
    const box = this.$('rulerBubble');
    if (!box) return;
    box.innerHTML = `<div class="rb-face">${RA.rulerPortrait(ru.kind, p.hex, angry, ru.seed)}</div><div class="rb-body"><div class="rb-who"><b>${RA.esc(ru.title)} ${RA.esc(ru.name)}</b><span style="--c:${p.hex}">${RA.esc(p.name)}</span></div><div class="rb-text">${RA.esc(txt)}</div></div>`;
    box.classList.toggle('angry', !!angry);
    box.hidden = false;
    box._cell = cell >= 0 ? cell : p.capital >= 0 ? p.capital : p.tiles ? p.cells[0] : -1;
    box._until = performance.now() + Math.max(5000, 2600 + txt.length * 55);
    // no click: the bubble sits over the state's land, where the player aims attacks (pointer-events: none)
    this.rulerPlace();
    if (this.audio) this.audio.play('msg', 1500);
  },
  /* keep the bubble over the state's land (clamped to the screen), hide it when its time is up */
  rulerPlace() {
    const box = this.$('rulerBubble');
    if (!box || box.hidden) return;
    if (performance.now() > box._until || !this.G) {
      box.hidden = true;
      return;
    }
    const c = box._cell;
    if (c < 0) return;
    const pt = this.app.lmap.latLngToContainerPoint(this.G.map.latLngOfCell(c));
    const w = box.offsetWidth || 280, h = box.offsetHeight || 80;
    const W = window.innerWidth, H = window.innerHeight;
    const hud = this.$('hud'), top = hud && !hud.hidden ? hud.getBoundingClientRect().bottom + 8 : 70;
    const x = Math.max(8, Math.min(W - w - 8, pt.x - 30)), y = Math.max(top, Math.min(H - h - 150, pt.y - h - 14));
    box.style.left = Math.round(x) + 'px';
    box.style.top = Math.round(y) + 'px';
  },
  /* news from the sim (G.feed) that a ruler has an opinion about */
  rulerNews(n) {
    const G = this.G, me = G.me;
    if (!me || this.app.attractMode) return;
    const mine = n.a === me.id || n.b === me.id;
    const other = n.a === me.id ? n.b : n.a;
    switch (n.t) {
      case 'war':
        if (n.a === me.id) this.rulerSay(n.b, 'attacked');
        else if (n.b === me.id) this.rulerSay(n.a, Math.random() < 0.8 ? 'taunt' : 'angryHuman');
        break;
      case 'fall':
        if (n.a === me.id && n.b) this.rulerSay(n.b, 'fallen', { force: true, cell: G.P[n.b].capital });
        else if (n.b && !mine && Math.random() < 0.3) this.rulerSay(n.a, 'conquest', { on: n.b });
        break;
      case 'ally':
        if (mine) this.rulerSay(other, 'ally');
        break;
      case 'allyEnd':
        if (mine) this.rulerSay(other, 'allyEnd');
        break;
      case 'break':
        if (n.a === me.id) this.rulerSay(n.b, 'betrayed', { force: true });
        else if (n.b === me.id) this.rulerSay(n.a, 'betrayer', { force: true });
        break;
      case 'trade':
        if (mine) this.rulerSay(other, 'trade');
        break;
      case 'vassal':
        if (n.a === me.id) this.rulerSay(n.b, 'vassal', { force: true });
        break;
      case 'rebel':
        if (n.b === me.id) this.rulerSay(n.a, 'rebel', { force: true });
        break;
      case 'pledge':
        if (n.b === me.id) this.rulerSay(n.a, 'pledge', { force: true });
        break;
      case 'dome':
        if (n.b === me.id) this.rulerSay(n.a, 'dome', { force: true });
        break;
      case 'strait':
        if (n.a === me.id) {
          const nb = ((this.rl && this.rl.nb) || [...(me.nbCache || new Map()).keys()]).filter((id) => G.P[id] && !G.P[id].human && G.P[id].type === 'nation');
          if (nb.length) this.rulerSay(nb[(Math.random() * nb.length) | 0], 'strait');
        }
        break;
    }
  },
  /* after my own actions: refusals, loans */
  rulerAfterAct(kind, a, r) {
    if (r === 'declined') {
      if (kind === 'aReq' || kind === 'tReq') this.rulerSay(a[0], 'refuse', { force: true });
      else if (kind === 'vas') this.rulerSay(a[0], 'refuseVassal', { force: true });
      else if (kind === 'loan') this.rulerSay(a[0], 'refuseLoan', { force: true });
    } else if (kind === 'loan' && r && typeof r === 'object') this.rulerSay(a[0], 'loan', { force: true });
    else if (kind === 'help' && r && typeof r === 'object') this.rulerSay(a[0], 'help');
  },
  /* every frame: the bubble follows the map; every 2 s: situations that build up over time */
  rulerTick(now) {
    this.rulerPlace();
    const G = this.G, me = G && G.me;
    if (!me || G.state !== 'play' || this.app.attractMode || this.settings.rulers === false) return;
    const R = this.rl || (this.rulersReset(), this.rl);
    if (now - (R.lastCheck || 0) < 2000) return;
    R.lastCheck = now;
    // my neighbours (the player has no AI scan: look at the borders, cached for 10 s)
    if (!R.nb || now - R.nbAt > 10000) {
      R.nbAt = now;
      R.nb = me.nbCache ? [...me.nbCache.keys()] : G.P.filter((p) => p && p.alive && p !== me && p.type === 'nation' && G.hasBorderWith(me, p.id)).map((p) => p.id);
    }
    const nb = R.nb.map((id) => G.P[id]).filter((p) => p && p.alive && !p.human && p.type === 'nation');
    const pick = (list) => list[(Math.random() * list.length) | 0];
    // hello from a neighbour a few seconds in
    if (!R.greet && G.tick > 60) {
      // a neighbour, or else the nearest state
      const W = G.map.W, mc = me.capital >= 0 ? me.capital : me.cells[0];
      const d = (p) => RA.dist((p.capital % W) - (mc % W), ((p.capital / W) | 0) - ((mc / W) | 0));
      const near = nb.length ? nb : G.P.filter((p) => p && p.alive && !p.human && p.type === 'nation' && p.capital >= 0).sort((a, b) => d(a) - d(b)).slice(0, 3);
      R.greet = true;
      if (near.length) return void this.rulerSay(pick(near).id, 'greet');
    }
    // the peace is over
    if (!R.peace && G.peaceUntil && G.tick >= G.peaceUntil && G.tick < G.peaceUntil + 50 && nb.length) {
      R.peace = true;
      return void this.rulerSay(pick(nb).id, 'peaceOver');
    }
    // nuclear launches: at me (threat) or by me (horror)
    for (const m of G.missiles) {
      if (m.done || R.missiles.has(m.id) || (m.kind !== 'nuke' && m.kind !== 'mirv')) continue;
      R.missiles.add(m.id);
      if (m.owner === me.id && m.victim && G.P[m.victim]) return void this.rulerSay(m.victim, 'nuked', { force: true });
      if (m.victim === me.id && !m.auto) return void this.rulerSay(m.owner, 'nukeThreat', { force: true });
    }
    // bombers over someone's land / my ships blockading its port
    for (const pl of G.planes) if (!pl.done && pl.kind === 'bomb' && pl.owner === me.id && !R.missiles.has('b' + pl.id)) {
      R.missiles.add('b' + pl.id);
      return void this.rulerSay(G.owner[pl.c], 'bombed');
    }
    if (G.tick % 50 < 20) for (const s of G.structs) if (s.blocked === me.id && !s.dead && !R.missiles.has('p' + s.id)) {
      R.missiles.add('p' + s.id);
      return void this.rulerSay(s.owner, 'blockade', { cell: s.c });
    }
    // aggressive expansion: the coalition speaks up once
    if (!R.aeWarn && me.ae >= RA.CFG.AE_COALITION && nb.length) {
      R.aeWarn = true;
      return void this.rulerSay(pick(nb).id, 'coalition');
    }
    if (me.ae < RA.CFG.AE_COALITION * 0.75) R.aeWarn = false;
    // I'm close to winning
    const share = me.area / G.landTotal();
    if (!R.nearWin && share >= G.winShare() * 0.8 && G.state === 'play' && !G.continued) {
      const others = G.P.filter((p) => p && p.alive && !p.human && p.type === 'nation');
      if (others.length) {
        R.nearWin = true;
        return void this.rulerSay(pick(others).id, 'nearWin');
      }
    }
    // a state I'm beating panics (lost half of its best size, last hit by me)
    for (const p of nb) if (p.lastAttackedBy === me.id && p.peak && p.area < p.peak * 0.5 && !R.panic.has(p.id)) {
      R.panic.add(p.id);
      return void this.rulerSay(p.id, 'losing');
    }
    // now and then: the leader boasts, a big neighbour mocks me, somebody talks nonsense
    if (now - R.chatterAt < 50000) return;
    R.chatterAt = now;
    const L = G.leader && G.P[G.leader.id];
    const r = Math.random();
    if (L && !L.human && L.alive && G.leader.share > 0.2 && r < 0.3) return void this.rulerSay(L.id, 'boast');
    const big = nb.filter((p) => p.area > me.area * 4);
    if (big.length && r < 0.5) return void this.rulerSay(pick(big).id, 'weak');
    const vis = nb.length ? nb : G.P.filter((p) => p && p.alive && !p.human && p.type === 'nation');
    if (vis.length) this.rulerSay(pick(vis).id, 'nonsense');
  },
});
RA.rulerLineCount = () => Object.values(RA.RULER_LINES).reduce((n, a) => n + a.length, 0);

/* more lines (the plan asks for 400+) */
(function (more) {
  for (const k in more) RA.RULER_LINES[k] = (RA.RULER_LINES[k] || []).concat(more[k]);
})({
  greet: ['Zdravo, komšija! Tvoja zastava je... zanimljiva.', 'Ako trebaš soli, pitaj. Ako trebaš zemlje, ne pitaj.', 'Mi smo mirna država. Imamo samo malo previše topova.', 'Dobrodošao! Pravila su jednostavna: moje je moje.', 'Pozdravljam te u ime naroda, vojske i moje mame.', 'Neka naše granice budu duge, a naši ratovi kratki.'],
  attacked: ['Ti si zmija, {ti}! Zmija s krunom!', 'Moje selo! Moje krave! Moje sve!', 'Ovo je objava rata? Mogao si bar poslati pismo.', 'Nikad ti ovo neću zaboraviti. Imam dobro pamćenje i lošu narav.', 'Topovi, na položaj! Kuhari, za topove!', 'Tvoji vojnici gaze moj travnjak!', 'Čekaj samo da mi dođe pojačanje, {ti}!', 'Napad bez upozorenja? Ima li u tebe imalo stida?', 'Moj narod će pjevati pjesme o tvojoj sramoti!', 'Hoćeš borbu? Dobićeš je. Na moj teren, po mojim pravilima!'],
  taunt: ['Tvoje granice su mi uvijek bile sumnjive.', 'Moji generali su se dosađivali. Sad ne.', 'Dolazimo po tvoje zlato. I tvoje krave.', 'Nemoj se ljutiti, samo pomjeramo granicu malo tvojim putem.', 'Tvoje utvrde su od pijeska, {ti}.', 'Evo nas! Iznenađenje!', 'Pravila su jednostavna: ko jači, taj kači.', 'Kako se kaže "predaja" na tvom jeziku?'],
  losing: ['Moja riznica je prazna, moja vojska još praznija.', 'Da li je kasno da se predomislim oko ovog rata?', 'Ko je rekao da će ovo biti lako? Otpustite ga!', 'Bježimo! Mislim... preraspoređujemo se!', 'Moji generali su nestali. Zajedno s konjima.', 'Ako me neko traži, u podrumu sam.', 'Molim za primirje! Molim za bilo šta!', 'Gubimo, ali gubimo sa stilom.'],
  fallen: ['Neka zemlja pamti da sam bio ovdje.', 'Vratiću se kao duh i plašiću ti konje.', 'Sve prolazi. Nažalost, i ja.', 'Poklanjam ti svoje dugove. Uživaj.', 'Nisam poražen. Samo sam u pauzi. Trajnoj.'],
  conquest: ['Sljedeći na listi... da vidim... svi.', 'Moja karta je sve šira, moj osmijeh isto.', 'Dobro jutro, nova provincijo!', '{on} je sada samo fusnota u mojoj historiji.', 'Nema više {on}. Ima više mene.'],
  ally: ['S ovim savezom idemo daleko. Ili bar do granice.', 'Pola mojih topova je sad i tvoje. Pola.', 'Nikad nisam imao boljeg saveznika. Doduše, nikad nisam ni imao saveznika.', 'Savez! Neka se tresu komšije!', 'Zajedno do pobjede! Ti prvi, naravno.'],
  betrayed: ['Mislio sam da smo prijatelji! Glupi ja!', 'Tvoja riječ vrijedi manje od moje stare čizme.', 'Kajaćeš se, {ti}! Kajaćeš se gorko!', 'Pokazao si pravo lice. Ružno je.', 'Izdao si me, a ja sam ti dao najbolje mjesto na gozbi!'],
  trade: ['Trgovina cvjeta! A i moji porezi.', 'Tvoja roba je dobra, cijena još bolja. Za mene.', 'Neka karavani idu i neka ne staju!', 'Zlato je najbolji diplomata.', 'Ti prodaješ, ja kupujem, a obojica se smiješimo.'],
  refuse: ['Savez s tobom? Nisam toliko očajan. Još.', 'Vrati se kad budeš ozbiljna država.', 'Moj astrolog kaže: ne.', 'Hvala, ali već imam dovoljno problema.', 'Nije do tebe, do mene je. Ma do tebe je.', 'Tvoja ponuda je smiješnija od mog dvorskog lude.'],
  vassal: ['Dobro, dobro. Evo ti ključevi. Pazi, onaj od podruma zapinje.', 'Moja kruna je sad malo manja. I malo tužnija.', 'Služim ti, ali ne očekuj osmijehe.'],
  rebel: ['Dosta je bilo tvog danka!', 'Naša zastava opet vijori sama!', 'Hvala na lekciji. Sad ćeš ti učiti od nas.'],
  nuked: ['Nebo gori! Zašto nebo gori?!', 'Ti si čudovište, {ti}! Pravo čudovište!', 'Neka ti je savjest lagana kao moj pepeo.', 'Radijacija u mojoj prijestolnici! Ko će sad ovo očistiti?!'],
  coalition: ['Svi su protiv tebe, {ti}. I to s razlogom.', 'Pohlepa je grijeh, a ti si veliki grješnik.', 'Neka svaki grad digne zastavu protiv {ti}!'],
  nearWin: ['{ti} je skoro pojeo cijelu kartu! Neko nek zovne pomoć!', 'Ako {ti} pobijedi, ja idem u penziju.', 'Ovo je kraj slobodnog svijeta! Ili bar našeg dvora.'],
  boast: ['Moja vojska je toliko velika da je ne mogu ni prebrojati. Neko je broji umjesto mene.', 'Kad ja kihnem, tri države se prehlade.', 'Ja ne osvajam države. Države dolaze meni.', 'Istorija će me voljeti. Ja ću se pobrinuti za to.'],
  weak: ['Kako se zove tvoja država? Ima li je na karti?', 'Imaš lijepu malu vojsku. Kao igračke.', 'Tvoja prijestolnica je manja od mog dvorišta.'],
  help: ['Evo nas, prijatelju! Ko te dira?', 'Moja vojska kreće! Polako, ali kreće.', 'Tvoji neprijatelji su moji neprijatelji. Danas.'],
  nonsense: ['Uveo sam dan bez zakona. Bilo je haotično. Ponovićemo.', 'Na mom dvoru je zabranjeno reći "karta" naglas.', 'Moji savjetnici se svađaju oko boje zastave. Već treću sedmicu.', 'Danas sam osvojio jednu livadu. Ispostavilo se da je moja.', 'Naredio sam da se planine malo spuste. Ne slušaju.', 'Pisao sam pjesmu o sebi. Remek-djelo.', 'Moj narod traži hljeb. Dao sam im bolje: parolu!', 'Imam novi plan: prvo ručak, pa sve ostalo.', 'Nekad bih samo da budem obični seljak. Pa se sjetim da seljaci ne jedu kolače.', 'Neko mi je ukrao granični kamen! Opet!', 'Kad sam bio dijete, htio sam biti kartograf. Sad sam predmet karte.', 'Savjetnik me pitao šta je strategija. Rekao sam: pobijediti.', 'Da li se more vidi iz svemira? Hitno istražiti!', 'Moj kuhar kaže da je rat kao gulaš: treba vremena.', 'Zabranio sam kišu. Pada i dalje. Uvodim porez na kišu.', 'Danas je dobar dan za nešto veliko. Možda drijemež.'],
  angryHuman: ['Tvoji potezi su kao tvoje brkove: loši.', 'Idi igraj se negdje drugo, {ti}.', 'Nije ovo pijaca, {ti}! Ovo je ozbiljan rat!', 'Pametnjakoviću, vidim šta radiš.', 'Imaš sreće što sam danas dobre volje. Nisam.'],
  peaceOver: ['Zvono je zazvonilo. Na bojno polje!', 'Mir je bio lijep. Dosadan, ali lijep.', 'Konačno! Moji topovi su se već ukiselili.'],
  strait: ['Zatvoren moreuz, zatvoreno srce!', 'Tvoji brodovi, tvoja pravila? Nećemo tako.', 'Ribe se žale. I moji trgovci.'],
  dome: ['Iznenađenje! I ja imam dugme.', 'Pucaš na mene? Evo ti isto.'],
  loan: ['Posudio sam ti zlato. I strpljenje. Oba su ograničena.', 'Zajam je tvoj, zalog je moj ako zakasniš.'],
  pledge: ['Ugovor je ugovor, {ti}. Hvala na zemlji!', 'Dug si platio zemljom. Loša kamata za tebe.'],
  blockade: ['Moji mornari umiru od dosade u luci!', 'Sklanjaj brodove ili ćemo ih potopiti kamenjem!'],
  bombed: ['Nebo više nije sigurno! Kakvo vrijeme!', 'Opet avioni! Kao muhe, samo gore.'],
  refuseVassal: ['Prije ću se zakopati s krunom na glavi!', 'Tvoj vazal? Moja baka bi se prevrnula u grobu.'],
  refuseLoan: ['Kasa je zatvorena. Za tebe posebno.', 'Idi posudi od nekog glupljeg.'],
  betrayer: ['Savezi su kao hljeb — brzo se ustajale.', 'Rekao sam da smo prijatelji. Nisam rekao koliko dugo.'],
  allyEnd: ['Bilo je lijepo, ali sve lijepo kratko traje.'],
});
(function (more) {
  for (const k in more) RA.RULER_LINES[k] = RA.RULER_LINES[k].concat(more[k]);
})({
  nonsense: ['Moja kruna je malo tijesna. Znak da mi raste pamet.', 'Juče sam izgubio bitku. Protiv komarca.', 'Proglasio sam sebe najljepšim vladarom. Jednoglasno.', 'Da imam flotu, plovio bih. Imam flotu. Ne znam plivati.', 'Ne vjerujem geografima. Sve im je okruglo.', 'Moji špijuni su se izgubili. Ko špijunira špijune?', 'Kupio sam novu zastavu. Ista kao stara, samo skuplja.', 'Pitam se da li i drugi vladari pričaju sami sa sobom.'],
  attacked: ['Neka zvone sva zvona! Neprijatelj je na granici!', 'Ovo je lopovluk, a ti si lopov!', 'Da sam znao, zazidao bih granicu.', 'Moja krv ključa, {ti}! Doslovno!'],
  taunt: ['Tvoja karta će uskoro biti moja karta.', 'Brže predaj ključeve, žurim na ručak.', 'Tvoji vojnici bježe brže od mojih konja.', 'Znaš šta kažu: najbolja odbrana je moj napad.'],
  greet: ['Lijep dan za dobre komšijske odnose. Dok traje.', 'Nadam se da voliš mir. Ja volim tvoju zemlju.', 'Komšija! Posudi mi malo zlata, vratiću. Možda.', 'Neka naše vojske gledaju jedna drugu samo izdaleka.'],
  losing: ['Da li iko prodaje sreću? Plaćam zlatom.', 'Zovite čarobnjaka! Nemamo čarobnjaka? Zovite bilo koga!', 'Ovo je samo loš dan. Loša sedmica. Loša godina.'],
  boast: ['Kad sam ja na karti, ostali su samo ukras.', 'Jutros sam osvojio grad prije doručka.', 'Moja zastava vijori na tri mora. Uskoro četiri.'],
  weak: ['Ti si mali, ali si bar šarmantan.', 'Tvoja vojska ne bi uplašila ni moje guske.'],
  ally: ['Rukovanje, zastave, zdravica! Savez je tu.', 'Neka naš savez traje duže od mojih obećanja.'],
  trade: ['Tvoje zlato mi je uvijek dobrodošlo.', 'Robu šaljem, račun ne zaboravljam.'],
  conquest: ['Karta je sada preglednija. Manje država, više mene.'],
});

'use strict';
/* Rulers with comments (plan phase 9): every computer state has an invented ruler (a title and a name that fit its era
   and part of the world, never a real politician) and a simple drawn portrait (3 kinds per era, calm and angry).
   Now and then the ruler's head pops up on its land with a speech bubble: angry when you attack, swearing, praising an
   alliance, panicking when losing, gloating, or just talking nonsense. Mild insults, never about nationality.
   UI only: the simulation never reads any of it (online players may see different lines). */

/* ---------------- who rules: title, name, portrait kind ---------------- */
RA.RULER_KINDS = {
  rim: [{ t: RA.t("Imperator"), k: 'laurel' }, { t: RA.t("Chief"), k: 'chief' }, { t: RA.t("Queen"), k: 'queen', f: 1 }],
  srednji: [{ t: RA.t("King"), k: 'crown' }, { t: RA.t("Sultan"), k: 'turban' }, { t: RA.t("Prince"), k: 'fur' }],
  napoleon: [{ t: RA.t("Emperor"), k: 'bicorne' }, { t: RA.t("King"), k: 'crown' }, { t: RA.t("Queen"), k: 'queen', f: 1 }],
  ww1: [{ t: RA.t("Emperor"), k: 'helmet' }, { t: RA.t("General"), k: 'cap' }, { t: RA.t("Prime Minister"), k: 'suit' }],
  ww2: [{ t: RA.t("Marshal"), k: 'cap' }, { t: RA.t("King"), k: 'crown' }, { t: RA.t("President{=2}"), k: 'suit' }],
  hladni: [{ t: RA.t("General Secretary"), k: 'suit' }, { t: RA.t("President{=2}"), k: 'suit' }, { t: RA.t("General"), k: 'cap' }],
  danas: [{ t: RA.t("President{=2}"), k: 'suit' }, { t: RA.t("President"), k: 'suitf', f: 1 }, { t: RA.t("Prime Minister"), k: 'suit' }],
};
/* titles of other parts of the world in the older eras (by the capital's place) */
RA.rulerTitle = function (era, lat, lon, base) {
  const old = ['rim', 'srednji', 'napoleon'].includes(era);
  if (!old && era !== 'ww1') return base;
  if (lon > 128 && lat > 30 && lat < 46) return { t: era === 'ww1' ? RA.t("Emperor") : RA.t("Shogun"), k: 'kabuto' };
  if (lon > 98 && lat > 18) return { t: RA.t("Emperor"), k: 'crown' };
  if (lon > 66 && lon < 92 && lat < 32) return { t: RA.t("Maharaja"), k: 'turban' };
  if (lon > 44 && lon < 64 && lat > 24 && lat < 40) return { t: RA.t("Shah"), k: 'turban' };
  if (lon > 52 && lat >= 40) return { t: RA.t("Khan"), k: 'fur' };
  if (lat < 36 && lat > 12 && lon > -18 && lon < 60 && old) return { t: RA.t("Sultan"), k: 'turban' };
  if (lon < -30 && old) return { t: RA.t("Chief"), k: 'chief' };
  if (lat < 12 && lon > -20 && lon < 52 && old) return { t: RA.t("King"), k: 'chief' };
  return base;
};
RA.RULER_NAMES = {
  rim: { m: [RA.t("Aurelian"), RA.t("Valerian"), RA.t("Cassius"), RA.t("Marcian"), RA.t("Flavius"), RA.t("Septimius"), RA.t("Claudius"), RA.t("Octavian"), RA.t("Tertius"), RA.t("Brennos"), RA.t("Vercingetorix"), RA.t("Budimir"), RA.t("Ambrix"), RA.t("Tarquinius")], f: [RA.t("Livia"), RA.t("Julia"), RA.t("Hortensia"), RA.t("Boudica"), RA.t("Teuta"), RA.t("Agrippina")] },
  srednji: { m: [RA.t("Radoslav"), RA.t("Otakar"), RA.t("Béla"), RA.t("Tvrtko"), RA.t("Ladislaus"), RA.t("Gundomir"), RA.t("Hildebrand"), RA.t("Boleslaw"), RA.t("Rodrigo"), RA.t("Almeric"), RA.t("Sviatoslav"), RA.t("Qasim"), RA.t("Murad"), RA.t("Dragoljub"), RA.t("Branimir"), RA.t("Ingvar"), RA.t("Leopold"), RA.t("Selim")], f: [RA.t("Helena"), RA.t("Catherine"), RA.t("Margaret"), RA.t("Isabella")] },
  napoleon: { m: [RA.t("Frederick"), RA.t("Ferdinand"), RA.t("Alexios"), RA.t("Maximilian"), RA.t("Ludwig"), RA.t("Gustav"), RA.t("Albert"), RA.t("Constantine"), RA.t("Oscar"), RA.t("Milorad"), RA.t("Emmanuel")], f: [RA.t("Caroline"), RA.t("Leopoldina"), RA.t("Victoria"), RA.t("Hortensia"), RA.t("Amalia"), RA.t("Louise")] },
  ww1: { m: [RA.t("Wilhelm"), RA.t("Konrad"), RA.t("Nicholas"), RA.t("Albert"), RA.t("Herbert"), RA.t("Radomir"), RA.t("Gerhard"), RA.t("Ferdinand"), RA.t("Arthur"), RA.t("Emil"), RA.t("Stephen"), RA.t("Ottokar"), RA.t("Clement")], f: [RA.t("Maria"), RA.t("Alexandra")] },
  ww2: { m: [RA.t("Vukašin"), RA.t("Hartmut"), RA.t("Leonid"), RA.t("Edgar"), RA.t("Bruno"), RA.t("Alexander"), RA.t("Gaston"), RA.t("Umberto"), RA.t("Casimir"), RA.t("Sigmund"), RA.t("Tihomir"), RA.t("Oswald")], f: [RA.t("Wilhelmina"), RA.t("Elizabeth")] },
  hladni: { m: [RA.t("Boris"), RA.t("Hubert"), RA.t("Miroslav"), RA.t("Arnold"), RA.t("Vadim"), RA.t("Richard"), RA.t("Stanko"), RA.t("Lothar"), RA.t("Evgeny"), RA.t("Clarence"), RA.t("Radovan"), RA.t("Gunther")], f: [RA.t("Golda"), RA.t("Indira")] },
  danas: { m: [RA.t("Marko"), RA.t("Lukas"), RA.t("Tomas"), RA.t("Viktor"), RA.t("Damir"), RA.t("Pavel"), RA.t("Emir"), RA.t("Philip"), RA.t("Oliver"), RA.t("Stefan"), RA.t("Jonas"), RA.t("Adrian")], f: [RA.t("Elena"), RA.t("Anna"), RA.t("Mira"), RA.t("Sofia"), RA.t("Ingrid"), RA.t("Lucia"), RA.t("Nora"), RA.t("Clara")] },
};
RA.RULER_SURNAMES = [RA.t("the Thunderer"), RA.t("the Great"), RA.t("the Wise"), RA.t("the Brave"), RA.t("the Swift"), RA.t("the Stern"), RA.t("Kovač"), RA.t("Orlović"), RA.t("Vuković"), RA.t("Stein"), RA.t("Ferro"), RA.t("Dubois"), RA.t("Novak"), RA.t("Kranjc"), RA.t("Ivanović"), RA.t("Bauer"), RA.t("Rossi"), RA.t("Lindqvist"), RA.t("Horvat"), RA.t("Petrović"), RA.t("Moreau"), RA.t("Zorić")];

/* ---------------- lines: {ja} = the ruler's state, {ti} = your state, {on} = another state ---------------- */
RA.RULER_LINES = {
  greet: [
    RA.t("Welcome to the neighbourhood, {ti}. Stay on your side of the border."), RA.t("A new neighbour? I hope you cook better than you fight."), RA.t("Greetings from {ja}! Leave our border alone and we'll be best friends."),
    RA.t("Ah, {ti}. I've heard of you. Nothing good, mind you."), RA.t("Peace and trade, {ti}? Or shall we go straight to swords?"), RA.t("I'm in charge here. You're just passing through."),
    RA.t("My advisers say you're dangerous. I say you're small."), RA.t("Good luck, neighbour. You'll need it."), RA.t("I see you on the map, {ti}. I always see you."),
    RA.t("I brought you a gift: an empty promise. As always."), RA.t("Lovely capital you have. It would be lovelier under my flag."), RA.t("Don't worry, {ti}, I'm peaceful. Mostly."),
  ],
  attacked: [
    RA.t("{ti}! You vile traitor!"), RA.t("You attack ME? You, with that paper army?"), RA.t("You'll pay for this, {ti}. With interest."), RA.t("I thought you were smarter. I was wrong."),
    RA.t("My generals are already drawing you on the dartboard!"), RA.t("Shameful! Not even a hello before a war?"), RA.t("Get off my land, you scoundrel!"), RA.t("You are common bandits, {ti}!"),
    RA.t("Fine. You want war? You'll get war."), RA.t("Who taught you to fight, a chicken?"), RA.t("I'll write about this in the history books. And draw you ugly."), RA.t("This isn't fair! I wanted to go first!"),
    RA.t("Go away! Get off my fields!"), RA.t("Good heavens, you're really attacking!"), RA.t("Everyone to the border! Everyone! The cook too!"),
  ],
  taunt: [
    RA.t("Your land is beautiful, {ti}. It'll be even prettier when it's mine."), RA.t("Surprise! You didn't think I'd wait, did you?"), RA.t("Nothing personal, {ti}. I just need a bit more land."),
    RA.t("Surrender now and I'll spare your goat."), RA.t("My soldiers are bored. You're their entertainment."), RA.t("Knock, knock! Who's there? War!"), RA.t("Thanks for the hospitality, {ti}. We'll be staying a little longer."),
    RA.t("Your army is laughable. Mine is already laughing."), RA.t("Get the city keys ready, we're coming!"), RA.t("This is just the warm-up."), RA.t("You should have built forts instead of monuments."),
    RA.t("Sorry, my hand just drifted toward your border."),
  ],
  losing: [
    RA.t("Help! Anyone who hears this, help!"), RA.t("This isn't a defeat. It's a... tactical retreat. A fast retreat."), RA.t("Advisers, pack the suitcases! And my crowns!"), RA.t("We're not finished! We're just a bit... smaller."),
    RA.t("Why are you doing this to me, {ti}? What did I ever do to you?"), RA.t("Fine, fine, I've changed my mind. Peace? Please?"), RA.t("This will ruin my reputation with the neighbours."), RA.t("I need a miracle, urgently. Or two."),
    RA.t("Everything is fine. Nothing is fine."), RA.t("My map is shrinking! Someone hid half of my country!"), RA.t("If I fall, I'll fall with dignity. Or screaming."), RA.t("Call the allies! Do we still have any allies?"),
  ],
  fallen: [
    RA.t("This isn't over, {ti}! ...Fine, it is."), RA.t("You'll remember me! Or at least my grave."), RA.t("My descendants will return. Somewhere. Someday."), RA.t("Curse you, {ti}, and your map!"),
    RA.t("I only wanted a little peace and some cake..."), RA.t("Take everything, but leave me the song about me."), RA.t("I'm going into exile. Somewhere with better weather than this."), RA.t("You won. Don't gloat too much, it doesn't suit you."),
    RA.t("History will say I was right."), RA.t("Look after my palace. And feed the cat."),
  ],
  conquest: [
    RA.t("{on} is no more. Who's next?"), RA.t("Another flag for my collection!"), RA.t("Ha! {on} fell like a house of cards."), RA.t("The map looks nicer now. More of my colour."),
    RA.t("Victory! Three days of celebration, then back to war."), RA.t("Let this be a lesson to everyone!"), RA.t("Who needs diplomacy when you have an army?"), RA.t("{on} was weak. You're all weak."),
  ],
  ally: [
    RA.t("An alliance with {ti}! Together we're invincible. On paper, at least."), RA.t("Welcome to the alliance, friends! You guard the left flank, we'll take the right."), RA.t("The alliance is sealed. Don't forget, I'm the senior partner."),
    RA.t("Together we'll show them!"), RA.t("Hands up for the alliance! Then hands on the weapons."), RA.t("Let our enemies tremble! Or at least shiver a bit."), RA.t("An honest alliance, honest people. Mostly."),
    RA.t("From today we're brothers in arms. And in gold, I hope."), RA.t("Finally someone smart in the neighbourhood!"), RA.t("I seal this with my crown and a good brandy."),
  ],
  allyEnd: [
    RA.t("The alliance has expired. It was nice while it lasted."), RA.t("The treaty has expired, {ti}. Renew it if you love me."), RA.t("End of the alliance. Nothing personal, but watch the border."),
    RA.t("The alliance expired? I didn't even notice. Fine, I did."), RA.t("Thanks for the cooperation. The bill is in the post."),
  ],
  betrayed: [
    RA.t("TRAITOR! I spit on your alliance!"), RA.t("I knew I shouldn't trust you, {ti}!"), RA.t("A Judas in a crown! That's what you are!"), RA.t("A knife in the back! From an ally! Shameful!"),
    RA.t("I'll never forgive you for this. Neither will my grandchildren."), RA.t("You poisonous snake!"), RA.t("And I sent you holiday presents..."), RA.t("Everyone will know what you did, {ti}. Everyone!"),
    RA.t("This is the worst day of my reign."), RA.t("I'm writing you into my black book. In capital letters."),
  ],
  betrayer: [
    RA.t("Sorry, {ti}. Business is business."), RA.t("Alliance? What alliance? I don't remember."), RA.t("Nothing personal, your land was just too close."), RA.t("Read the small print of the treaty, my friend."),
    RA.t("I always liked myself more than you."), RA.t("It was fun while it lasted. For me."),
  ],
  trade: [
    RA.t("Trade! My gold loves your gold."), RA.t("Good deal, {ti}. You get goods, I get more goods."), RA.t("Ships are sailing, purses are filling. Lovely day."),
    RA.t("Buy, sell, don't fight. At least not today."), RA.t("My merchants already love you. My generals, less so."), RA.t("A trade pact! Let the gold flow!"), RA.t("Send us some spices, we'll send you some taxes."),
    RA.t("Money loves peace. I love money."),
  ],
  refuse: [
    RA.t("An alliance with you? I'd rather marry a goat."), RA.t("No, thanks. I have taste."), RA.t("Hmm... no. Ask again in a hundred years."), RA.t("My advisers laughed at your offer for three hours."),
    RA.t("Refused. But I admire the courage."), RA.t("You and me? Never!"), RA.t("Try again when you're bigger."), RA.t("Message received, read and burned."),
    RA.t("I trust you as far as I can throw your ambassador."), RA.t("Nooo. Nice hat though."),
  ],
  refuseVassal: [
    RA.t("Me? Your vassal? I'd sooner eat my crown!"), RA.t("Kneel before you? Never!"), RA.t("We are free and we'll stay free!"), RA.t("Try again when I have only one city left."),
    RA.t("Vassal? Sounds like a disease."), RA.t("I have my pride, {ti}. A little, but I have it."),
  ],
  vassal: [
    RA.t("Fine, {ti}... I bow. Reluctantly."), RA.t("Here's your tribute. Choke on it."), RA.t("I'll serve you. For now."), RA.t("Better a vassal than dead, they say."),
    RA.t("This is the saddest day of my dynasty."), RA.t("Take our tribute and at least leave us our anthem."),
  ],
  rebel: [
    RA.t("We're free! Keep your tribute, {ti}!"), RA.t("Your time is over. Mine is just beginning!"), RA.t("We kneel to you no more!"), RA.t("Ha! You've grown weak. We haven't."),
    RA.t("The chains are broken! Long live freedom!"), RA.t("Thanks for the years of service. Not really."),
  ],
  loan: [
    RA.t("Here's the gold, {ti}. Pay it back on time or we'll talk differently."), RA.t("A loan is a loan. Interest is love."), RA.t("Fine, I'll lend it to you. But I'm keeping an eye on your collateral."),
    RA.t("Gold goes to you, land maybe to me. We'll see."), RA.t("Don't forget the deadline. I never forget."),
  ],
  refuseLoan: [
    RA.t("A loan? For you? Ha!"), RA.t("My treasury isn't a charity."), RA.t("First return what you stole, then talk about loans."), RA.t("I have no money. For you."),
  ],
  pledge: [
    RA.t("The deadline has passed, {ti}. The collateral is mine!"), RA.t("A debt is a debt. Thanks for the land!"), RA.t("You should have read the contract. Now this is mine."), RA.t("Interest is paid in land, my friend."),
  ],
  nuked: [
    RA.t("You're a MADMAN, {ti}! A madman with an atomic bomb!"), RA.t("My cities! My cities are burning!"), RA.t("This is a crime! The whole world is watching you!"), RA.t("A nuke?! Seriously?!"),
    RA.t("I swear I'll get revenge. From the basement, but I will."), RA.t("Only ashes and your shame will remain!"), RA.t("You have no heart, {ti}. Only a silo."), RA.t("Everyone into the bunker! Everyone!"),
  ],
  nukeThreat: [
    RA.t("Look at the sky, {ti}. A gift is on its way."), RA.t("You had a chance at peace."), RA.t("This is for my cities!"), RA.t("Let the world see who's in charge here."),
    RA.t("It's nothing personal. Just radioactive."),
  ],
  dome: [
    RA.t("The dome works! Here's your bomb back!"), RA.t("You thought I had no defences? Ha!"), RA.t("Hit me and your house burns too."), RA.t("Automatic retaliation. Automatic shame for you."),
  ],
  strait: [
    RA.t("You closed the strait?! My merchants are crying!"), RA.t("Open the strait, {ti}, or we'll open it with cannons!"), RA.t("Who gave you the sea? The sea belongs to everyone!"), RA.t("A blockade? This is piracy!"),
  ],
  blockade: [
    RA.t("My port is blockaded! Move those ships!"), RA.t("Your ships smell of gunpowder and bad manners."), RA.t("My fishermen can't even go fishing! Shameful!"),
  ],
  bombed: [
    RA.t("Bombers over my capital?! Shoot them down!"), RA.t("Planes! From the sky! How rude!"), RA.t("Your pilots are worse than your generals."),
  ],
  coalition: [
    RA.t("Enough, {ti}! All of us together against you!"), RA.t("Your hunger for land has united us."), RA.t("The coalition is formed. Your days are numbered."), RA.t("You've swallowed too much, {ti}. Time to cough it up."),
    RA.t("The whole continent is joining forces. Congratulations, that's your doing."), RA.t("One can't eat the whole cake alone!"),
  ],
  nearWin: [
    RA.t("Somebody stop {ti}! They're taking everything!"), RA.t("{ti} is close to victory. Maybe it's time to panic."), RA.t("I don't like the look of this map."), RA.t("A little more and we'll all be saying what {ti} tells us to."),
    RA.t("Let's unite! Now or never!"), RA.t("How did we let {ti} grow so big?"),
  ],
  boast: [
    RA.t("Look at the map. See that big blob? That's me."), RA.t("I am the biggest, the strongest and the most modest."), RA.t("Kneel, little states!"), RA.t("Soon I'll need a bigger map."),
    RA.t("Gold, army, land — I have it all. Except boredom."), RA.t("Every morning I wake up and conquer something."),
  ],
  weak: [
    RA.t("You're that little state? I thought you were a smudge on the map."), RA.t("Your army fits in a single carriage."), RA.t("Cute. Do you have a flag too?"), RA.t("Don't worry, {ti}, I won't attack you. You're not worth the trouble."),
  ],
  peaceOver: [
    RA.t("The peace is over. Watch yourself, {ti}."), RA.t("The end of peace! At last!"), RA.t("Now the real game begins."), RA.t("Sharpen the swords, the peace has run out."),
    RA.t("I hope you rested well. You won't anymore."),
  ],
  help: [
    RA.t("I'm coming, ally! Hold on!"), RA.t("The enemy of my friend is my enemy. Or something like that."), RA.t("Sending the army! And sandwiches!"), RA.t("Nobody touches my ally!"),
  ],
  nonsense: [
    RA.t("Has anyone seen my crown? It was here a moment ago."), RA.t("Today I passed a law against Mondays."), RA.t("My horse would be a better ruler than half of the people here."), RA.t("Why is the sea salty? Investigate! Urgently!"),
    RA.t("My astrologers say tomorrow will be Wednesday."), RA.t("I introduced a tax on singing in the shower."), RA.t("When I was young, borders were straighter."), RA.t("Sometimes I feel like someone is moving me around the map."),
    RA.t("I have declared today a holiday of cakes."), RA.t("My court jester says I'm the court jester."), RA.t("I tried to conquer the moon. Too high."), RA.t("I can't sleep with all these buttons on the map."),
    RA.t("Was that a move or did I click by accident?"), RA.t("My cat is my chief adviser. She has better ideas."), RA.t("Who invented winter? I want their address."), RA.t("They say a wise ruler is a quiet ruler. I'm not quiet."),
    RA.t("I'm planning a war. Or lunch. I haven't decided."), RA.t("I met a cartographer. He said I was round."), RA.t("The court is cold. We need a bigger fireplace. And a bigger country."), RA.t("I asked the people what they want. They said \"fewer questions\"."),
    RA.t("The best strategy is to hide behind a mountain. If you have one."), RA.t("Today I learned a new word: \"blockade\". Sounds tasty."), RA.t("Can someone explain to me what a \"tutorial\" is?"), RA.t("Gold doesn't grow on trees. I checked."),
  ],
  angryHuman: [
    RA.t("You again, {ti}? Don't you have anything better to do?"), RA.t("I don't like your face. Or your borders."), RA.t("No offence, {ti}, but you're a fool."), RA.t("Watch out, {ti}. I remember everything."),
    RA.t("My grandmother would run your country better."), RA.t("If you were half as smart as you are cheeky..."),
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
  else if ((h >>> 7) % 3 === 0) name += ' ' + ['II.', 'III.', 'IV.', RA.t("the Great"), RA.t("the Wise"), RA.t("the Terrible"), RA.t("the Red")][(h >>> 11) % 7];
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
    const txt = pool[i].replace(/\{ja\}/g, p.name).replace(/\{ti\}/g, me.name).replace(/\{on\}/g, o.on ? G.P[o.on].name : RA.t("someone"));
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
  greet: [RA.t("Hello, neighbour! Your flag is... interesting."), RA.t("If you need salt, ask. If you need land, don't."), RA.t("We are a peaceful country. We just have slightly too many cannons."), RA.t("Welcome! The rules are simple: what's mine is mine."), RA.t("I greet you in the name of the people, the army and my mother."), RA.t("May our borders be long and our wars short.")],
  attacked: [RA.t("You're a snake, {ti}! A snake with a crown!"), RA.t("My village! My cows! My everything!"), RA.t("This is a declaration of war? You could at least have sent a letter."), RA.t("I'll never forget this. I have a good memory and a bad temper."), RA.t("Cannons, take positions! Cooks, to the cannons!"), RA.t("Your soldiers are trampling my lawn!"), RA.t("Just wait until my reinforcements arrive, {ti}!"), RA.t("Attacking without warning? Have you no shame at all?"), RA.t("My people will sing songs about your disgrace!"), RA.t("You want a fight? You'll get one. On my ground, by my rules!")],
  taunt: [RA.t("I always found your borders suspicious."), RA.t("My generals were bored. Not anymore."), RA.t("We're coming for your gold. And your cows."), RA.t("Don't be angry, we're just moving the border a little your way."), RA.t("Your forts are made of sand, {ti}."), RA.t("Here we are! Surprise!"), RA.t("The rules are simple: might makes right."), RA.t("How do you say \"surrender\" in your language?")],
  losing: [RA.t("My treasury is empty, my army even emptier."), RA.t("Is it too late to change my mind about this war?"), RA.t("Who said this would be easy? Fire him!"), RA.t("Run! I mean... we're redeploying!"), RA.t("My generals have vanished. Along with the horses."), RA.t("If anyone needs me, I'm in the basement."), RA.t("I beg for a truce! I beg for anything!"), RA.t("We're losing, but we're losing in style.")],
  fallen: [RA.t("Let the land remember I was here."), RA.t("I'll come back as a ghost and scare your horses."), RA.t("All things pass. Sadly, me too."), RA.t("I leave you my debts. Enjoy."), RA.t("I'm not defeated. I'm just on a break. A permanent one.")],
  conquest: [RA.t("Next on the list... let me see... everyone."), RA.t("My map keeps getting wider, and so does my smile."), RA.t("Good morning, new province!"), RA.t("{on} is now just a footnote in my history."), RA.t("No more {on}. More of me.")],
  ally: [RA.t("With this alliance we'll go far. Or at least to the border."), RA.t("Half of my cannons are yours now. Half."), RA.t("I've never had a better ally. Then again, I've never had an ally."), RA.t("An alliance! Let the neighbours tremble!"), RA.t("Together to victory! You first, of course.")],
  betrayed: [RA.t("I thought we were friends! Silly me!"), RA.t("Your word is worth less than my old boot."), RA.t("You'll regret this, {ti}! You'll regret it bitterly!"), RA.t("You've shown your true face. It's ugly."), RA.t("You betrayed me, and I gave you the best seat at the feast!")],
  trade: [RA.t("Trade is booming! And so are my taxes."), RA.t("Your goods are good, the price even better. For me."), RA.t("Let the caravans roll and never stop!"), RA.t("Gold is the best diplomat."), RA.t("You sell, I buy, and we both smile.")],
  refuse: [RA.t("An alliance with you? I'm not that desperate. Yet."), RA.t("Come back when you're a serious country."), RA.t("My astrologer says: no."), RA.t("Thanks, but I have enough problems already."), RA.t("It's not you, it's me. Actually, it's you."), RA.t("Your offer is funnier than my court jester.")],
  vassal: [RA.t("Fine, fine. Here are the keys. Careful, the cellar one sticks."), RA.t("My crown is a bit smaller now. And a bit sadder."), RA.t("I serve you, but don't expect smiles.")],
  rebel: [RA.t("Enough of your tribute!"), RA.t("Our flag flies alone again!"), RA.t("Thanks for the lesson. Now you'll learn from us.")],
  nuked: [RA.t("The sky is on fire! Why is the sky on fire?!"), RA.t("You're a monster, {ti}! A real monster!"), RA.t("May your conscience be as light as my ashes."), RA.t("Radiation in my capital! Who's going to clean this up now?!")],
  coalition: [RA.t("Everyone is against you, {ti}. And for good reason."), RA.t("Greed is a sin, and you are a great sinner."), RA.t("Let every city raise a flag against {ti}!")],
  nearWin: [RA.t("{ti} has almost eaten the whole map! Somebody call for help!"), RA.t("If {ti} wins, I'm retiring."), RA.t("This is the end of the free world! Or at least of our court.")],
  boast: [RA.t("My army is so big I can't even count it. Someone counts it for me."), RA.t("When I sneeze, three countries catch a cold."), RA.t("I don't conquer countries. Countries come to me."), RA.t("History will love me. I'll make sure of it.")],
  weak: [RA.t("What's your country called? Is it even on the map?"), RA.t("You have a nice little army. Like toys."), RA.t("Your capital is smaller than my courtyard.")],
  help: [RA.t("Here we are, friend! Who's bothering you?"), RA.t("My army is on the move! Slowly, but moving."), RA.t("Your enemies are my enemies. Today.")],
  nonsense: [RA.t("I introduced a day without laws. It was chaos. We'll do it again."), RA.t("At my court it's forbidden to say \"map\" out loud."), RA.t("My advisers are arguing about the colour of the flag. Third week now."), RA.t("Today I conquered a meadow. It turned out to be mine."), RA.t("I ordered the mountains to lower themselves a bit. They don't listen."), RA.t("I wrote a poem about myself. A masterpiece."), RA.t("My people ask for bread. I gave them something better: a slogan!"), RA.t("I have a new plan: lunch first, then everything else."), RA.t("Sometimes I wish I were a simple peasant. Then I remember peasants don't eat cake."), RA.t("Someone stole my boundary stone! Again!"), RA.t("As a child I wanted to be a cartographer. Now I'm on the map."), RA.t("An adviser asked me what strategy is. I said: winning."), RA.t("Can the sea be seen from space? Investigate urgently!"), RA.t("My cook says war is like goulash: it takes time."), RA.t("I banned rain. It keeps falling. I'm introducing a rain tax."), RA.t("Today is a good day for something big. Maybe a nap.")],
  angryHuman: [RA.t("Your moves are like your moustache: bad."), RA.t("Go play somewhere else, {ti}."), RA.t("This isn't a market, {ti}! This is a serious war!"), RA.t("Smart-aleck, I see what you're doing."), RA.t("You're lucky I'm in a good mood today. I'm not.")],
  peaceOver: [RA.t("The bell has rung. To the battlefield!"), RA.t("Peace was nice. Boring, but nice."), RA.t("Finally! My cannons were getting rusty.")],
  strait: [RA.t("Closed strait, closed heart!"), RA.t("Your ships, your rules? Not like that."), RA.t("The fish are complaining. So are my merchants.")],
  dome: [RA.t("Surprise! I have a button too."), RA.t("You're shooting at me? Here's the same back.")],
  loan: [RA.t("I lent you gold. And patience. Both are limited."), RA.t("The loan is yours, the collateral is mine if you're late.")],
  pledge: [RA.t("A contract is a contract, {ti}. Thanks for the land!"), RA.t("You paid your debt in land. Bad interest for you.")],
  blockade: [RA.t("My sailors are dying of boredom in port!"), RA.t("Move those ships or we'll sink them with rocks!")],
  bombed: [RA.t("The sky isn't safe anymore! What weather!"), RA.t("Planes again! Like flies, only higher.")],
  refuseVassal: [RA.t("I'd sooner be buried with my crown on!"), RA.t("Your vassal? My grandmother would turn in her grave.")],
  refuseLoan: [RA.t("The till is closed. Especially for you."), RA.t("Go borrow from someone dumber.")],
  betrayer: [RA.t("Alliances are like bread — they go stale fast."), RA.t("I said we were friends. I didn't say for how long.")],
  allyEnd: [RA.t("It was nice, but all nice things are short.")],
});
(function (more) {
  for (const k in more) RA.RULER_LINES[k] = RA.RULER_LINES[k].concat(more[k]);
})({
  nonsense: [RA.t("My crown is a bit tight. A sign my brain is growing."), RA.t("Yesterday I lost a battle. Against a mosquito."), RA.t("I declared myself the most handsome ruler. Unanimously."), RA.t("If I had a fleet, I'd sail. I have a fleet. I can't swim."), RA.t("I don't trust geographers. Everything is round to them."), RA.t("My spies got lost. Who spies on the spies?"), RA.t("I bought a new flag. Same as the old one, just more expensive."), RA.t("I wonder if other rulers talk to themselves too.")],
  attacked: [RA.t("Ring all the bells! The enemy is at the border!"), RA.t("This is theft, and you are a thief!"), RA.t("Had I known, I'd have walled up the border."), RA.t("My blood is boiling, {ti}! Literally!")],
  taunt: [RA.t("Your map will soon be my map."), RA.t("Hand over the keys faster, I'm late for lunch."), RA.t("Your soldiers run faster than my horses."), RA.t("You know what they say: the best defence is my attack.")],
  greet: [RA.t("A fine day for good neighbourly relations. While it lasts."), RA.t("I hope you love peace. I love your land."), RA.t("Neighbour! Lend me some gold, I'll pay it back. Maybe."), RA.t("May our armies look at each other only from afar.")],
  losing: [RA.t("Does anyone sell luck? I'll pay in gold."), RA.t("Call the wizard! We don't have a wizard? Call anyone!"), RA.t("It's just a bad day. A bad week. A bad year.")],
  boast: [RA.t("When I'm on the map, the others are just decoration."), RA.t("This morning I conquered a city before breakfast."), RA.t("My flag flies over three seas. Soon four.")],
  weak: [RA.t("You're small, but at least you're charming."), RA.t("Your army wouldn't scare even my geese.")],
  ally: [RA.t("Handshakes, flags, a toast! The alliance is here."), RA.t("May our alliance last longer than my promises.")],
  trade: [RA.t("Your gold is always welcome here."), RA.t("I send the goods, I never forget the bill.")],
  conquest: [RA.t("The map is tidier now. Fewer countries, more of me.")],
});

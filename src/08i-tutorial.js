'use strict';
/* Interactive tutorial (plan item 66): a guided first game on the Balkans (easy, 3 minutes of peace). A card shows
   one step at a time and waits until the player really does it; the button or area the step is about glows. */
RA.TUTORIAL = [
  { t: 'Dobro došao, komandante! Izaberi odakle krećeš: klikni mjesto na karti ili državu sa spiska dole, pa pritisni „Kreni”.', glow: 'spawnBar',
    done: (G) => G.state === 'play' && G.me },
  { t: 'Gore su tvoja vojska, zlato i udio kopna. Vojska raste sama — najbrže kad je oko zelene oznake na traci. Pobjeđuješ sa 70% kopna.', glow: 'hud', next: true },
  { t: 'Sada je mirno doba: niko ne smije napadati države. Klikni sivu, slobodnu zemlju pored svoje granice da se širiš.',
    done: (G, T) => G.attacks.some((a) => a.a === G.me.id && a.t === 0) || G.me.tiles > T.tiles0 * 1.03 },
  { t: 'Klizač „Snaga napada” (tipke Q i E) određuje koliko vojske šalješ. Što više pošalješ, to brže osvajaš — ali ti ostaje manje za odbranu.', glow: 'ratio', next: true },
  { t: 'Otvori „Gradi” (tipka B) i postavi grad ili kasarnu na svojoj zemlji. Gradovi donose zlato i vojsku, kasarne jedinice.', glow: 'aBuild',
    done: (G, T) => G.structs.some((s) => s.owner === G.me.id && s.id >= T.structs0) },
  { t: 'Otvori „Savezi” (tipka S): tu sklapaš vojne i trgovinske saveze. Saveznik te brani i pušta preko svoje zemlje.', glow: 'aDiplo',
    done: (G, T, ui) => !!ui.$('sheet').querySelector('[data-do^="show:"]') },
  { t: 'Kad mirno doba prođe (možeš ubrzati igru dugmetom 1×/2×/3×), klikni dio susjedne države: vojska ide s tvoje najbliže granice pravo tamo i osvaja samo taj dio. Na računaru možeš i povući strelicu desnim dugmetom miša.', glow: 'speedBtn',
    done: (G) => G.attacks.some((a) => a.a === G.me.id && a.t > 0 && a.corr) },
  { t: 'Odlično! Ako ti neko otme zemlju, žuto dugme „Vrati” u traci napada vraća je jednim klikom. Desni klik (dugi dodir) na bilo koje mjesto otvara sve opcije za njega. Sretno!', next: 'Završi' },
];
RA.Tutorial = class {
  constructor(ui) {
    this.ui = ui;
    this.i = 0;
    this.card = ui.$('tutCard');
    this.card.hidden = false;
    this.card.querySelector('#tutSkip').onclick = () => this.end(false);
    this.card.querySelector('#tutNext').onclick = () => this.go(this.i + 1);
    this.go(0);
  }
  go(i) {
    const ui = this.ui, G = ui.G, S = RA.TUTORIAL[i];
    if (this.glowEl) this.glowEl.classList.remove('tut-glow');
    if (!S) return this.end(true);
    this.i = i;
    if (G && G.me) {
      this.tiles0 = G.me.tiles;
      this.structs0 = G.structs.length;
    }
    this.card.querySelector('#tutStep').textContent = `${i + 1}/${RA.TUTORIAL.length}`;
    this.card.querySelector('#tutText').textContent = S.t;
    const nb = this.card.querySelector('#tutNext');
    nb.hidden = !S.next;
    nb.textContent = typeof S.next === 'string' ? S.next : 'Dalje';
    this.glowEl = S.glow ? ui.$(S.glow) : null;
    if (this.glowEl) this.glowEl.classList.add('tut-glow');
  }
  update() {
    const ui = this.ui, G = ui.G, S = RA.TUTORIAL[this.i];
    if (!G || !S || !S.done) return;
    if (S.done(G, this, ui)) this.go(this.i + 1);
  }
  end(done) {
    if (this.glowEl) this.glowEl.classList.remove('tut-glow');
    this.card.hidden = true;
    this.ui.tut = null;
    try {
      localStorage.setItem('ra_tut_done', '1');
    } catch (_) {}
    if (done) this.ui.toast('good', 'Tutorijal je završen. Igra se nastavlja — osvoji 70% kopna!', { ms: 6000 });
  }
};
Object.assign(RA.UI.prototype, {
  /* a fresh easy game on the Balkans for the tutorial; the player's own settings stay as they were */
  startTutorial() {
    const s = this.settings, keep = Object.assign({}, s);
    Object.assign(s, { map: 'evropa', region: 'balkan', era: 'danas', start: 'slobodno', gm: 'klasik', difficulty: 'lako', peace: 180, cityStates: 25 });
    if (this.tut) this.tut.end(false);
    this.app.newGame();
    Object.assign(s, keep);
    this.noTips = true; // the tutorial card replaces the tips
    this.tut = new RA.Tutorial(this);
  },
});

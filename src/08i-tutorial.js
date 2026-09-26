'use strict';
/* Interactive tutorial (plan item 66): a guided first game on the Balkans (easy, 3 minutes of peace). A card shows
   one step at a time and waits until the player really does it; the button or area the step is about glows. */
RA.TUTORIAL = [
  { t: RA.t("Welcome, commander! Choose where you start: click a spot on the map or a state from the list below, then press “Start”."), glow: 'spawnBar',
    done: (G) => G.state === 'play' && G.me },
  { t: RA.t("At the top are your army, gold and share of the land. The army grows by itself — fastest around the green mark on the bar. You win with 70% of the land."), glow: 'hud', next: true },
  { t: RA.t("It's peace time now: nobody may attack states. Click the grey, free land next to your border to expand."),
    done: (G, T) => G.attacks.some((a) => a.a === G.me.id && a.t === 0) || G.me.tiles > T.tiles0 * 1.03 },
  { t: RA.t("The “Attack strength” slider (keys Q and E) sets how many troops you send. The more you send, the faster you conquer — but the less is left for defence."), glow: 'ratio', next: true },
  { t: RA.t("Open “Build” (key B) and place a city or barracks on your land. Cities bring gold and troops, barracks bring units."), glow: 'aBuild',
    done: (G, T) => G.structs.some((s) => s.owner === G.me.id && s.id >= T.structs0) },
  { t: RA.t("Open “Alliances” (key S): that's where you make military and trade alliances. An ally defends you and lets you through its land."), glow: 'aDiplo',
    done: (G, T, ui) => !!ui.$('sheet').querySelector('[data-do^="show:"]') },
  { t: RA.t("When peace time is over (you can speed the game up with the 1×/2×/3× button), click part of a neighbouring state: the army goes from your nearest border straight there and takes only that part. On a computer you can also drag an arrow with the right mouse button."), glow: 'speedBtn',
    done: (G) => G.attacks.some((a) => a.a === G.me.id && a.t > 0 && a.corr) },
  { t: RA.t("Great! If someone takes your land, the yellow “Retake” button in the attack bar takes it back in one click. A right click (long press) on any spot opens every option for it. Good luck!"), next: RA.t("Finish") },
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
    nb.textContent = typeof S.next === 'string' ? S.next : RA.t("Next");
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
    if (done) this.ui.toast('good', RA.t("The tutorial is over. The game goes on — conquer 70% of the land!"), { ms: 6000 });
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

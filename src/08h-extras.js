'use strict';
/* Small things from plan item 67: your own colour, a colour-blind mode and the rematch button. */

// your colour on the map (single player; online games keep the slot colours)
RA.PLAYER_COLORS = ['#2f7bff', '#ff4fc3', '#ffd23f', '#6ee05a', '#ff7a2f', '#9b5cff', '#1fd1c1', '#ff3b4e', '#f4f4f4', '#a8ff3c'];

/* colour-blind mode: every state gets a colour from a palette that people with red-green (and blue-yellow) colour
   blindness tell apart — Okabe-Ito plus darker / lighter versions, neighbours never the same. Visual only (the sim and
   online play never read colours); on/off at any time. */
RA.CB_PALETTE = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999',
  '#8a5f00', '#a9dcf7', '#00553e', '#f7f1a6', '#003f63', '#f2a37a', '#e9bcd7', '#5c5c5c'];
RA.applyColorblind = function (G, on) {
  for (const p of G.P) {
    if (!p) continue;
    if (p.hex0 === undefined) p.hex0 = p.hex;
    if (!on) p.hex = p.hex0;
  }
  if (on) {
    // who touches whom (right and down neighbours on the grid)
    const own = G.owner, W = G.map.W, N = G.map.N, adj = new Map();
    const link = (a, b) => {
      if (!a || !b || a === b) return;
      (adj.get(a) || adj.set(a, new Set()).get(a)).add(b);
      (adj.get(b) || adj.set(b, new Set()).get(b)).add(a);
    };
    for (let c = 0; c < N; c++) {
      const o = own[c];
      if (!o) continue;
      if ((c + 1) % W) link(o, own[c + 1]);
      if (c + W < N) link(o, own[c + W]);
    }
    const order = G.P.filter((p) => p).sort((a, b) => b.tiles - a.tiles);
    const pal = RA.CB_PALETTE;
    for (const p of order) {
      const used = new Set();
      for (const q of adj.get(p.id) || []) if (G.P[q] && G.P[q].cbDone === G) used.add(G.P[q].hex);
      // the player: always the first colour free among blue / orange / yellow (easy to find on the map)
      let hex = p === G.me ? ['#0072B2', '#E69F00', '#F0E442'].find((h) => !used.has(h)) : null;
      if (!hex) hex = pal.find((h) => !used.has(h)) || pal[p.id % pal.length];
      p.hex = hex;
      p.cbDone = G;
    }
  }
  for (const p of G.P) if (p) p.rgb = RA.hexToRgb(p.hex);
};

Object.assign(RA.UI.prototype, {
  setColorblind(on) {
    this.settings.cb = !!on;
    this._save();
    if (this.G) {
      RA.applyColorblind(this.G, this.settings.cb);
      this.app.terr.updatePalette();
    }
  },
  /* rematch: the same settings and the same country, straight into the game */
  rematch() {
    const app = this.app, G = this.G, me = G && G.me;
    const iso = me && me.took ? me.took.iso : null, cell = me ? me.capital : -1;
    this.$('endScreen').hidden = true;
    app.newGame();
    const go = () => {
      const G2 = this.G;
      if (!G2 || G2.state !== 'spawn') return setTimeout(go, 200); // the map may still be loading
      const n = iso && G2.P.find((p) => p && p.alive && p.type === 'nation' && p.iso === iso);
      if (n) this.pickNation(String(n.id));
      else if (cell >= 0) RA.placeHuman(G2, cell, this.settings.name || 'Ti');
      if (G2.me && G2.me.spawned) app.start();
    };
    go();
  },
});

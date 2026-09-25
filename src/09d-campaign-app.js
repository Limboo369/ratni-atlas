'use strict';
/* Campaign (08k-campaign.js): starting a mission (after RA.App exists, 09-main.js). */
Object.assign(RA.App.prototype, {
  /* a campaign mission: the home's region and era; you take the state that holds your home */
  startMission(home, m, c) {
    const ui = this.ui, map = this.maps[home.map];
    this.setMap(map);
    document.getElementById('startScreen').hidden = true;
    const cell = map.cellOfLatLng(home.ll[0], home.ll[1]);
    const region = ui.campRegion(map, cell);
    const set = { map: home.map, region, era: m.era, start: 'granice', gm: 'klasik', difficulty: m.diff, cityStates: 25, peace: 60, res: false };
    const gm = RA.regionMap(RA.eraMap(map, m.era, 'granice'), region);
    RA.ME_COLOR = RA.PLAYER_COLORS[0];
    const seed = (Math.random() * 1e9) | 0;
    const camp = { type: m.type, mid: m.id, bonus: Object.assign({}, c.tree) };
    const G = RA.newGame(gm, { seed, difficulty: set.difficulty, cityStates: set.cityStates, peace: set.peace, era: set.era, start: 'granice', gm: 'klasik', camp });
    G.gid = 'c' + Math.random().toString(36).slice(2, 12);
    G.rec = { v: 1, build: RA.BUILD, gid: G.gid, set: Object.assign({}, set, { seed, color: RA.ME_COLOR, camp }), picks: [], name: '', cmds: [] };
    this.setGame(G);
    this.attractMode = false;
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    ui.watching = false;
    ui.fxList = [];
    ui.campOver = false;
    this.terr.reset(G);
    // the state that holds the home (or, if the home is free land in that era, the nearest state)
    let tgt = G.owner[cell] && G.P[G.owner[cell]].type === 'nation' ? G.owner[cell] : 0;
    if (!tgt) {
      const W = map.W;
      let bd = 1e9;
      for (const p of G.P) if (p && p.type === 'nation' && p.alive) {
        const d = RA.dist((p.nation.c % W) - (cell % W), ((p.nation.c / W) | 0) - ((cell / W) | 0));
        if (d < bd) {
          bd = d;
          tgt = p.id;
        }
      }
    }
    RA.placeHuman(G, tgt ? G.P[tgt].nation.c : cell, c.name);
    if (!G.me) return ui.toast('bad', 'Dom dinastije nije na karti ovog doba.', { ms: 5000 });
    ui.settings.name = ui.settings.name || c.name;
    this.start();
    const T = G.camp && G.P[G.camp.target];
    ui.toast('info', `<b>${RA.esc(m.title)}</b> — ${RA.esc(m.type === 'free' ? 'slobodna igra' : RA.campGoalText(m))}${T ? ` Cilj: <b>${RA.esc(T.name)}</b>.` : ''}`, { ms: 9000, cell: T ? T.capital : -1 });
    if (gm.region) {
      const bx = gm.region.box;
      this.lmap.setMaxBounds(L.latLngBounds([[bx[1], bx[0]], [bx[3], bx[2]]]).pad(0.7));
    }
  },
});

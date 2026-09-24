/* Fast AI-only balance runs in node (no browser): about 10x faster than build/sim_eras.py.
   node build/sim_node.js era:start:gm:region:maxMin:seed:diff[:pick] ...
   e.g. node build/sim_node.js rim:granice:klasik:evropa:30:11:srednje ww1:granice:klasik:evropa:40:11:srednje:SRB
   Prints game length, winner, and how many states are alive 3 min after the 1 min peace. */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..') + '/';
global.window = global;
global.Image = class {
  set src(v) {
    setTimeout(() => this.onload && this.onload(), 0);
  }
};
(0, eval)(fs.readFileSync(R + 'build/mapdata.js', 'utf8'));
(0, eval)(fs.readFileSync(R + 'build/eradata.js', 'utf8'));
const files = ['00-util', '01-data', '02-sim', '02b-military', '02c-diplomacy', '02d-commands', '02e-zone', '03-ai', '04-setup', '04b-eras'];
new Function(files.map((f) => fs.readFileSync(R + 'src/' + f + '.js', 'utf8').replace("'use strict';", '')).join('\n'))();

(async () => {
  const map = await RA.loadMap();
  await RA.loadEras();
  for (const r of process.argv.slice(2)) {
    const [era, start, gm, region, maxMin, seed, diff, pick] = r.split(':');
    const G = RA.newGame(RA.regionMap(RA.eraMap(map, era, start), region), { seed: +seed, difficulty: diff || 'srednje', cityStates: 50, peace: 60, era, start, gm });
    const n = G.P.find((p) => p && p.type === 'nation' && p.iso === pick) || G.P.find((p) => p && p.type === 'nation');
    RA.placeHuman(G, n.nation.c, 'Test');
    RA.startGame(G);
    RA.AI.init(G, G.me);
    const nat = G.alivePlayers().length;
    let at4 = null;
    const lead = [];
    const t0 = Date.now();
    while (G.state === 'play' && G.tick < +maxMin * 600) {
      G.step();
      if (G.tick === 2400) at4 = G.alivePlayers().length;
      if (G.tick % 1800 === 0) {
        const al = G.alivePlayers().sort((x, y) => y.tiles - x.tiles);
        lead.push(`${G.tick / 600}m:${al[0].iso || al[0].name.slice(0, 8)} ${((al[0].tiles / G.landTotal()) * 100).toFixed(0)}%/${al.length}`);
      }
    }
    const w = G.winner ? G.winner.iso || G.winner.name : '-';
    console.log(`${r.padEnd(40)} ${(G.tick / 600).toFixed(1)} min, winner ${w}, alive ${nat}->${at4} at 4 min, me ${G.me.alive ? 'alive' : 'dead'} | ${lead.join(' ')} | ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
})();

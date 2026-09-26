'use strict';
/* The tech tree inside a game (option opts.tree; Focus has it, Blitz not, "Make your choice" either way).
   Four branches of five levels, bought with gold during the game (command 'tech'); the same branches as the
   campaign's dynasty tree (RA.CAMP_TREE), which is bought with XP between missions and stacks with this one.
   Every level multiplies p.bGold / p.bGrow / p.bCost (read by the economy and the costs), diplomacy warms every state. */
RA.TECH = {
  eco: { name: 'Ekonomija', icon: 'market', step: 0.08, desc: '+8% zlata po nivou' },
  mil: { name: 'Vojska', icon: 'army', step: 0.06, desc: '+6% rasta vojske po nivou' },
  sci: { name: 'Nauka', icon: 'factory', step: 0.06, desc: 'zgrade, jedinice i rakete 6% jeftinije po nivou' },
  dip: { name: 'Diplomatija', icon: 'ally', step: 10, desc: 'sve države te vole više (+10 po nivou)' },
};
RA.TECH_ORDER = ['eco', 'mil', 'sci', 'dip'];
RA.TECH_MAX = 5;

(function (P) {
  P.techLv = function (p, k) {
    return (p.tech && p.tech[k]) | 0;
  };
  P.techCost = function (p, k) {
    return 200000 * RA.dpow(2, this.techLv(p, k));
  };
  P.buyTech = function (pid, k) {
    const p = this.P[pid], T = RA.TECH[k];
    if (!this.opts.tree) return 'Stablo tehnologija nije uključeno u ovoj igri.';
    if (!p || !p.alive) return 'Nisi u igri.';
    if (!T) return 'Nepoznata grana.';
    const lv = this.techLv(p, k);
    if (lv >= RA.TECH_MAX) return `${T.name} je već na najvišem nivou.`;
    const cost = this.techCost(p, k);
    if (p.gold < cost) return `Za ${T.name} ${lv + 1} treba ${RA.fmt(cost)} zlata.`;
    p.gold -= cost;
    if (!p.tech) p.tech = { eco: 0, mil: 0, sci: 0, dip: 0 };
    p.tech[k] = lv + 1;
    if (k === 'eco') p.bGold = ((p.bGold || 1) * (1 + T.step * (lv + 1))) / (1 + T.step * lv);
    else if (k === 'mil') p.bGrow = ((p.bGrow || 1) * (1 + T.step * (lv + 1))) / (1 + T.step * lv);
    else if (k === 'sci') p.bCost = ((p.bCost || 1) * (1 - T.step * (lv + 1))) / (1 - T.step * lv);
    else for (const o of this.P) if (o && o !== p && o.rel) this.relTo(o, p.id, Math.min(100, o.rel[p.id] + T.step), 'tech');
    if (p.human) this.tell(p, 'good', `Istraženo: ${T.name} ${lv + 1} (${T.desc}).`);
    return { k, lv: lv + 1 };
  };
})(RA.Game.prototype);

/* the computer researches too: with spare gold, the cheapest branch it likes (economy first when it is poor) */
RA.AI.maybeTech = function (G, p) {
  if (G.rng() > 0.08) return;
  let best = null, bc = Infinity;
  for (const k of RA.TECH_ORDER) {
    if (G.techLv(p, k) >= RA.TECH_MAX) continue;
    const c = G.techCost(p, k) * (k === 'eco' ? 0.8 : k === 'dip' ? 1.3 : 1);
    if (c < bc) (bc = c), (best = k);
  }
  if (best && p.gold >= G.techCost(p, best) * 1.3) G.buyTech(p.id, best);
};

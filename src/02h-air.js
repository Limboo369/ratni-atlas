'use strict';
/* Air force (plan 21) and drones (plan 22).
   Squadrons are bought at an airport (eras with aircraft) and wait there: a fighter guards the sky around its airport
   (it intercepts enemy bombers and paratroopers flying at targets near it; your own ready fighter escorts your
   planes and halves that chance), a bomber flies a mission at a place in range, bombs buildings, units and the army
   there and comes back. Drones ("danas" only) are cheap missiles launched from your own border in a straight line:
   the kamikaze drone hits a small spot, the hunter drone hits units; a few per player at a time. */
RA.AIR = {
  fighter: { name: 'Lovci', cost: 300000, desc: 'Brane nebo oko aerodroma: obaraju neprijateljske bombardere i avione s padobrancima; prate tvoje avione.' },
  bomber: { name: 'Bombarderi', cost: 450000, desc: 'Let na metu do 70 polja od aerodroma: ruše zgrade, jedinice i vojsku u krugu 2 polja, pa se vraćaju.' },
};
Object.assign(RA.CFG, {
  AIR_PER_AIRPORT: 2, // squadrons of each kind per airport
  AIR_READY: 150, // a new squadron gets ready
  BOMB_RANGE: 70,
  BOMB_SPEED: 2.4,
  BOMB_CD: 350, // after coming back
  BOMB_R: 2,
  FIGHT_R: 22, // a fighter guards targets this close to its airport
  FIGHT_CD: 150,
  FIGHT_HIT: 0.65,
  DRONE_MAX: 6, // drones in the air per player
});
Object.assign(RA.MISSILE, {
  drone: { name: 'Kamikaza dron', kind: 'drone', cost: 45000, r: 1, range: 45, speed: 1.4, cd: 0, icon: 'drone',
    desc: 'Jeftin mali udar (krug 1 polja) do 45 polja od tvoje granice. Leti pravo — PVO ga može oboriti.' },
  hdrone: { name: 'Dron lovac', kind: 'drone', hunt: true, cost: 110000, r: 3, range: 60, speed: 1.8, cd: 0, icon: 'drone',
    desc: 'Napada neprijateljske jedinice u krugu 3 polja, do 60 polja od tvoje granice.' },
});
RA.airOn = () => !RA.STRUCT.airport.na && !!RA.ERA.para;
/* the era's names of the two squadrons */
RA.airName = (k) => {
  const e = RA.ERA ? RA.ERA.id : 'danas';
  if (k === 'fighter') return e === 'ww2' ? 'Lovci' : e === 'hladni' ? 'Mlazni lovci' : 'Višenamjenski lovci';
  return e === 'danas' ? 'Strateški bombarderi' : 'Bombarderi';
};

(function (P) {
  P.airportsOf = function (p) {
    return this.structs.filter((s) => !s.dead && s.ready && s.type === 'airport' && s.owner === p.id);
  };
  P.buyAir = function (pid, type) {
    const p = this.P[pid], A = RA.AIR[type];
    if (!A || !Object.prototype.hasOwnProperty.call(RA.AIR, type)) return 'Nepoznata vrsta aviona.';
    if (!RA.airOn()) return 'U ovom dobu nema vojnih aviona.';
    const aps = this.airportsOf(p);
    if (!aps.length) return 'Treba ti aerodrom.';
    const sq = p.air || (p.air = []);
    const have = sq.filter((q) => q.type === type).length;
    if (have >= aps.length * RA.CFG.AIR_PER_AIRPORT) return `Najviše ${RA.CFG.AIR_PER_AIRPORT} po aerodromu — izgradi još jedan aerodrom.`;
    if (p.gold < A.cost) return 'Nemaš dovoljno zlata.';
    p.gold -= A.cost;
    // the airport with the fewest squadrons
    const load = (s) => sq.filter((q) => q.base === s.id).length;
    const base = aps.slice().sort((a, b) => load(a) - load(b) || a.id - b.id)[0];
    const q = { id: this.nextId++, type, base: base.id, readyAt: this.tick + RA.CFG.AIR_READY };
    sq.push(q);
    return { type, id: q.id };
  };
  /* a bomber mission at cell c */
  P.bombRaid = function (pid, c) {
    const p = this.P[pid];
    if (!RA.airOn()) return 'U ovom dobu nema vojnih aviona.';
    if (c < 0 || !this.map.land[c]) return 'Bombarduje se samo kopno.';
    const o = this.owner[c];
    if (!o || o === pid || this.isFriendly(p, this.P[o])) return 'Izaberi neprijateljsku teritoriju.';
    if (this.tick < this.peaceUntil) return `Mirno doba — napadi su dozvoljeni za ${this.peaceLeft()} s.`;
    if (this.defconErr('air')) return this.defconErr('air');
    const W = this.map.W, tx = c % W, ty = (c / W) | 0, tk = this.tick;
    let best = null, bd = 1e9, base = null;
    for (const q of p.air || []) {
      if (q.type !== 'bomber' || q.readyAt > tk) continue;
      const s = this.structs[q.base];
      if (!s || s.dead || s.owner !== pid || s.empUntil > tk) continue;
      const d = RA.dist(s.x - tx, s.y - ty);
      if (d <= RA.CFG.BOMB_RANGE && d < bd) {
        bd = d;
        best = q;
        base = s;
      }
    }
    if (!best) return (p.air || []).some((q) => q.type === 'bomber') ? `Nijedan spreman bombarder u dometu (${RA.CFG.BOMB_RANGE} polja od aerodroma).` : 'Nemaš bombardera (Desant → Avijacija).';
    const dur = Math.max(15, Math.round(bd / RA.CFG.BOMB_SPEED));
    best.readyAt = Infinity; // in the air
    const pl = { id: this.nextId++, kind: 'bomb', sq: best.id, owner: pid, sx: base.x + 0.5, sy: base.y + 0.5, tx: tx + 0.5, ty: ty + 0.5, c, t: 0, dur, troops: 0, sam: null, samAt: 2, done: false, from: base.id };
    this._assignSam(pl, p);
    this.planes.push(pl);
    const V = this.P[o];
    V.rel[pid] = Math.max(-100, V.rel[pid] - 15);
    this.tell(V, 'bad', `✈ Bombarderi (${p.name}) lete na tvoju zemlju!`, pid, c);
    return { sq: best.id };
  };
  /* enemy fighters near the target try to shoot a plane down (once per flight) */
  P._dogfight = function (pl) {
    pl.fought = true;
    const p = this.P[pl.owner], tk = this.tick, W = this.map.W;
    const R = RA.CFG.FIGHT_R;
    for (const o of this.P) {
      if (!o || !o.alive || !o.air || o === p || !this.hostile(p, o.id)) continue;
      for (const q of o.air) {
        if (q.type !== 'fighter' || q.readyAt > tk) continue;
        const s = this.structs[q.base];
        if (!s || s.dead || s.owner !== o.id || s.empUntil > tk || RA.dist(s.x - (pl.c % W), s.y - ((pl.c / W) | 0)) > R) continue;
        q.readyAt = tk + RA.CFG.FIGHT_CD;
        // an escort (a ready fighter of the attacker at the airport the plane came from) halves the chance
        const esc = (p.air || []).find((e) => e.type === 'fighter' && e.readyAt <= tk && e.base === pl.from);
        if (esc) esc.readyAt = tk + RA.CFG.FIGHT_CD;
        if (this.rng() < RA.CFG.FIGHT_HIT * (esc ? 0.5 : 1)) {
          pl.done = true;
          this.fx.push({ kind: 'intercept', x: pl.sx + (pl.tx - pl.sx) * pl.t, y: pl.sy + (pl.ty - pl.sy) * pl.t, sx: s.x + 0.5, sy: s.y + 0.5, tick: tk });
          if (pl.kind === 'bomb') p.air = p.air.filter((e) => e.id !== pl.sq);
          this.tell(p, 'bad', pl.kind === 'bomb' ? `Lovci (${o.name}) su oborili tvoje bombardere.` : `Lovci (${o.name}) su oborili tvoj avion — izgubljeno ${RA.fmt(pl.troops)} padobranaca.`, o.id, pl.c);
          this.tell(o, 'good', `Tvoji lovci su oborili neprijateljski ${pl.kind === 'bomb' ? 'bombarder' : 'avion s padobrancima'} (${p.name})!`, p.id, pl.c);
          return true;
        }
        this.tell(o, 'info', `Tvoji lovci nisu uspjeli oboriti neprijateljski avion${esc ? ' (imao je pratnju)' : ''}.`, p.id, pl.c);
        return false;
      }
    }
    return false;
  };
  P._bombHit = function (pl) {
    const p = this.P[pl.owner], W = this.map.W, H = this.map.H, R = RA.CFG.BOMB_R;
    const q = (p.air || []).find((e) => e.id === pl.sq);
    if (q) q.readyAt = this.tick + pl.dur + RA.CFG.BOMB_CD; // flies home, refuels
    const cx = Math.floor(pl.tx), cy = Math.floor(pl.ty);
    const cnt = new Map();
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R + 1) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const o = this.owner[y * W + x];
        if (o && o !== pl.owner && this.hostile(p, o)) cnt.set(o, (cnt.get(o) || 0) + 1);
      }
    let assets = new Map();
    const tgt = this.owner[pl.c];
    if (tgt && this.hostile(p, tgt)) assets = this._blastAssets(cx + 0.5, cy + 0.5, R + 0.5, pl.owner, tgt, 80);
    let msg = '';
    for (const o of new Set([...cnt.keys(), ...assets.keys()])) {
      const v = this.P[o], n = cnt.get(o) || 0, a = assets.get(o) || { structs: 0, units: 0 };
      const kill = Math.min(v.troops * 0.15, n * (v.troops / Math.max(1, v.tiles)) * 2.5);
      v.troops = Math.max(0, v.troops - kill);
      this.tell(v, 'bad', `✈ Bombardovanje (${p.name}): −${RA.fmt(kill)} vojske${a.structs ? ', ' + a.structs + ' zgrada' : ''}${a.units ? ', ' + a.units + ' jedinica' : ''}.`, p.id, pl.c);
      if (o === tgt) msg = `${v.name}: −${RA.fmt(kill)} vojske${a.structs ? ', ' + a.structs + ' zgrada' : ''}${a.units ? ', ' + a.units + ' jedinica' : ''}`;
    }
    this.tell(p, msg ? 'good' : 'info', msg ? `✈ Bombarderi su pogodili metu — ${msg}.` : '✈ Bombarderi nisu našli ništa vrijedno na meti.', tgt || p.id, pl.c);
    this.fx.push({ kind: 'conv', x: pl.tx, y: pl.ty, r: R + 0.5, tick: this.tick });
  };
  /* squadrons whose airport was lost go down with it */
  P._stepAir = function () {
    for (const p of this.P) {
      if (!p || !p.air || !p.air.length) continue;
      const before = p.air.length;
      p.air = p.air.filter((q) => {
        const s = this.structs[q.base];
        if (s && !s.dead && s.owner === p.id) return true;
        if (q.readyAt === Infinity) return true; // in the air: lands elsewhere
        return false;
      });
      if (p.air.length < before) {
        // a squadron in the air whose airport fell moves to another airport
        this.tell(p, 'bad', `Izgubio si ${before - p.air.length} ${before - p.air.length === 1 ? 'eskadrilu' : 'eskadrile'} s aerodromom.`, p.id);
      }
      const aps = this.airportsOf(p);
      for (const q of p.air) {
        const s = this.structs[q.base];
        if ((!s || s.dead || s.owner !== p.id) && aps.length) q.base = aps[0].id;
      }
      if (!aps.length) p.air = p.air.filter((q) => q.readyAt === Infinity);
    }
  };
  /* drones: launched from your land nearest to the target, straight there */
  P._droneSource = function (p, c) {
    const W = this.map.W, tx = c % W, ty = (c / W) | 0;
    let best = -1, bd = 1e9;
    for (let i = 0; i < p.tiles; i++) {
      const k = p.cells[i], dx = (k % W) - tx, dy = ((k / W) | 0) - ty, d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  };
  P._droneHit = function (m) {
    const M = RA.MISSILE[m.type];
    if (!M.hunt) return this._detonateConv(m);
    // hunter drone: enemy units in reach
    const p = this.P[m.owner], R2 = (M.r + 0.5) * (M.r + 0.5);
    let n = 0;
    for (const u of this.units) {
      if (u.dead || !this.hostile(p, u.owner) || (u.x - m.tx) * (u.x - m.tx) + (u.y - m.ty) * (u.y - m.ty) > R2) continue;
      u.hp -= 90;
      u.lastHit = this.tick;
      n++;
      if (u.hp <= 0) this._unitDied(u, 'dron');
    }
    this.tell(p, n ? 'good' : 'info', n ? `Dron lovac je pogodio ${n} ${n === 1 ? 'jedinicu' : 'jedinice'}.` : 'Dron lovac nije našao jedinice na meti.', p.id, m.c);
    this.fx.push({ kind: 'conv', x: m.tx, y: m.ty, r: M.r, tick: this.tick });
  };
})(RA.Game.prototype);

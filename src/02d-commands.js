'use strict';
/* Ratni Atlas — player commands. Every human action goes through G.exec(pid, kind, args), so an online game
   can replay exactly the same inputs on every device (lockstep). Args come from other players' devices:
   they are validated here and never trusted. */

RA.CMD_KINDS = ['atk', 'boat', 'para', 'build', 'rec', 'mv', 'dis', 'mis', 'mob', 'ret', 'aReq', 'aRes', 'tReq', 'tRes', 'ext', 'brk', 'tEnd', 'give', 'help', 'ai', 'back'];

(function (P) {
  P.exec = function (pid, kind, a) {
    const p = this.P[pid];
    if (!p || !p.alive) return 'Nisi u igri.';
    a = Array.isArray(a) ? a : [];
    const N = this.map.N;
    const cell = (v) => (Number.isInteger(v) && v >= 0 && v < N ? v : -1);
    const ratio = (v) => (typeof v === 'number' && isFinite(v) ? RA.clamp(v, 0.01, 1) : 0.3);
    const player = (v) => (Number.isInteger(v) && v > 0 && v < this.P.length && this.P[v] ? v : 0);
    const id = (v) => (Number.isInteger(v) ? v : -1);
    switch (kind) {
      case 'atk':
        // a[2] 1: directed (a corridor to the cell); a[3]: the own cell the arrow was drawn from (optional)
        return this.cmdAttack(pid, cell(a[0]), ratio(a[1]), a[2] === 1, a.length > 3 ? cell(a[3]) : -1);
      case 'boat': {
        const r = this.launchBoat(pid, cell(a[0]), p.troops * ratio(a[1]));
        return typeof r === 'object' ? r : this.boatErr(r);
      }
      case 'para':
        return this.launchPara(pid, cell(a[0]), p.troops * ratio(a[1]));
      case 'build':
        // own keys only: 'toString', '__proto__' … from another device must not reach the build code
        if (typeof a[0] !== 'string' || !Object.prototype.hasOwnProperty.call(RA.STRUCT, a[0])) return 'Nepoznata zgrada.';
        return this.build(pid, a[0], cell(a[1]));
      case 'rec':
        if (typeof a[0] !== 'string' || !Object.prototype.hasOwnProperty.call(RA.UNIT, a[0])) return 'Nepoznata jedinica.';
        return this.recruitUnit(pid, a[0], cell(a[1]));
      case 'mv':
        return this.moveUnit(pid, id(a[0]), cell(a[1]));
      case 'dis': {
        const u = p.units.find((x) => x.id === id(a[0]));
        if (!u) return 'Jedinica ne postoji.';
        this.disbandUnit(pid, u.id);
        return { type: u.type };
      }
      case 'mis':
        if (!['rocket', 'emp', 'atom', 'hydro', 'mirv'].includes(a[0])) return 'Nepoznata raketa.';
        if (cell(a[1]) < 0) return 'Nevažeća meta.';
        return this.launchMissile(pid, a[0], a[1]);
      case 'mob':
        return this.mobilize(pid);
      case 'ret': {
        const att = this.attacks.find((x) => x.id === id(a[0]) && !x.done);
        if (!att || att.a !== pid) return null;
        const res = { back: att.troops * (att.t ? 0.75 : 1), t: att.t };
        this.retreat(att.id);
        return res;
      }
      case 'aReq':
        return player(a[0]) ? this.requestAlliance(pid, a[0]) : 'Nevažeći igrač.';
      case 'aRes':
        if (player(a[0])) this.respondAlliance(a[0], pid, !!a[1]);
        return null;
      case 'tReq':
        return player(a[0]) ? this.requestTrade(pid, a[0]) : 'Nevažeći igrač.';
      case 'tRes':
        if (player(a[0])) this.respondTrade(a[0], pid, !!a[1]);
        return null;
      case 'ext':
        return player(a[0]) ? this.extendAlliance(pid, a[0]) : 'Nevažeći igrač.';
      case 'brk':
        if (player(a[0])) this.breakAlliance(pid, a[0], true);
        return null;
      case 'tEnd':
        if (player(a[0])) this.cancelTrade(pid, a[0]);
        return null;
      case 'give':
        return player(a[0]) ? this.donateTroops(pid, a[0], p.troops * ratio(a[1])) : 'Nevažeći igrač.';
      case 'help':
        return player(a[0]) ? this.requestHelp(pid, a[0]) : 'Nevažeći igrač.';
      case 'ai':
        // a player who left an online game: the computer takes over their country
        if (!p.ai) {
          RA.AI.init(this, p);
          this.allyReqs = this.allyReqs.filter((r) => r.to !== pid);
          this.tradeReqs = this.tradeReqs.filter((r) => r.to !== pid);
        }
        return true;
      case 'back':
        // that player came back to the online game: their country is theirs again
        if (p.human) p.ai = null;
        return true;
    }
    return 'Nepoznata naredba.';
  };
})(RA.Game.prototype);

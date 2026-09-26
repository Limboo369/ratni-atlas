'use strict';
/* Ratni Atlas — player commands. Every human action goes through G.exec(pid, kind, args), so an online game
   can replay exactly the same inputs on every device (lockstep). Args come from other players' devices:
   they are validated here and never trusted. */

RA.CMD_KINDS = ['atk', 'boat', 'para', 'build', 'rec', 'mv', 'dis', 'mis', 'mob', 'ret', 'aReq', 'aRes', 'tReq', 'tRes', 'ext', 'brk', 'tEnd', 'give', 'help', 'ai', 'back', 'rcl', 'png', 'qm', 'tax', 'vas', 'loan', 'pay', 'str', 'buy', 'air', 'bomb', 'tech', 'stance', 'offer', 'offerRes', 'surr', 'endv'];
/* pings on the map and quick messages, seen by the sender's allies and team (plan item 57) */
RA.PINGS = [
  { name: 'Napadni ovdje', icon: 'attack', color: '#ff5d5d' },
  { name: 'Pomoć ovdje', icon: 'flag', color: '#3ec7c2' },
  { name: 'Opasnost', icon: 'emp', color: '#f2b134' },
  { name: 'Idem tamo', icon: 'send', color: '#8fb8ff' },
];
RA.QUICK_MSGS = ['Napadam!', 'Treba mi pomoć!', 'Pazi, napadaju nas!', 'Idem tamo.', 'Čekaj, spremam vojsku.', 'Hajmo zajedno na njih!',
  'Hvala!', 'Izvini.', 'Dobra igra!', '👍', '😂', '😡', '🔥', '💣', '🤝', '👀'];

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
        if (!['rocket', 'rocket2', 'emp', 'atom', 'hydro', 'mirv', 'drone', 'hdrone'].includes(a[0])) return 'Nepoznata raketa.';
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
      case 'png': {
        // one ping a second at most per player (and one message, below)
        const c = cell(a[0]), k = Number.isInteger(a[1]) && a[1] >= 0 && a[1] < RA.PINGS.length ? a[1] : -1;
        if (c < 0 || k < 0) return 'Nevažeći ping.';
        if (p.lastPing > this.tick - 10) return null;
        p.lastPing = this.tick;
        this.pings.push({ pid, c, k, tick: this.tick });
        if (this.pings.length > 60) this.pings.splice(0, 30);
        return true;
      }
      case 'qm': {
        const m = Number.isInteger(a[0]) && a[0] >= 0 && a[0] < RA.QUICK_MSGS.length ? a[0] : -1;
        if (m < 0) return 'Nevažeća poruka.';
        if (p.lastMsg > this.tick - 10) return null;
        p.lastMsg = this.tick;
        this.chat.push({ pid, m, tick: this.tick });
        if (this.chat.length > 60) this.chat.splice(0, 30);
        return true;
      }
      case 'air':
        return typeof a[0] === 'string' ? this.buyAir(pid, a[0]) : 'Nepoznata vrsta aviona.';
      case 'bomb':
        return this.bombRaid(pid, cell(a[0]));
      case 'surr':
        // surrender (online): the computer takes my state, I have lost
        if (!this.online || p.surr) return 'Predaja je samo u online igri.';
        p.surr = true;
        if (!p.ai) RA.AI.init(this, p);
        this.tellAll('info', `${p.nick || p.name} se predao/la.`, pid);
        return { surr: true };
      case 'endv':
        // a vote to end the game (online): when every player still in it agrees, the biggest side wins now
        if (!this.online) return 'Samo u online igri.';
        p.endVote = a[0] !== 0;
        this._endVotes();
        return { endv: p.endVote };
      case 'offer':
        // offers and demands (02l-offers.js): [to, what I give, what I want]
        return player(a[0]) ? this.makeOffer(pid, a[0], a[1], a[2]) : 'Nevažeća država.';
      case 'offerRes':
        return this.answerOffer(pid, id(a[0]), a[1], a[2], a[3]);
      case 'stance':
        // orders for the computer while I'm away (Focus): auto | def | eco | atk + target
        if (!['auto', 'def', 'eco', 'atk'].includes(a[0])) return 'Nevažeća naredba.';
        if (a[0] === 'atk' && !player(a[1])) return 'Izaberi državu za napad.';
        p.stance = a[0] === 'auto' ? null : { k: a[0], t: a[0] === 'atk' ? a[1] : 0 };
        return { stance: a[0] };
      case 'tech':
        return typeof a[0] === 'string' && RA.TECH_ORDER.includes(a[0]) ? this.buyTech(pid, a[0]) : 'Nepoznata grana.';
      case 'buy':
        return this.buyRes(pid, Number.isInteger(a[0]) ? a[0] : -1, player(a[1]));
      case 'str':
        return this.cmdStrait(pid, Number.isInteger(a[0]) ? a[0] : -1, a[1] === 1);
      case 'loan':
        return player(a[0]) ? this.requestLoan(pid, a[0], a[1]) : 'Nevažeći igrač.';
      case 'pay':
        return this.repayLoan(pid, id(a[0]));
      case 'vas':
        return player(a[0]) ? this.offerVassal(pid, a[0]) : 'Nevažeći igrač.';
      case 'tax':
        if (!Number.isInteger(a[0]) || a[0] < 0 || a[0] >= RA.TAX.length) return 'Nevažeći porez.';
        p.tax = a[0];
        return { tax: a[0] };
      case 'rcl':
        return this.cmdReclaim(pid, player(a[0]), ratio(a[1]));
      case 'back':
        // that player came back to the online game: their country is theirs again
        if (p.human) p.ai = null;
        return true;
    }
    return 'Nepoznata naredba.';
  };
})(RA.Game.prototype);

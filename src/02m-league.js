'use strict';
/* Conquest League rules (plan phase 16): two teams of players only (1v1, 2v2, 5v5), no computer states, start from
   small fields. A team wins when every opponent is gone. Blitz: a team under 10% of the players' land for 60 s
   capitulates; after 45 min the team with more land wins (warning at 35 min). Surrender and vote kick (5v5) are team
   votes: 4 of 5 (in 1v1 one, in 2v2 both). A kicked player's state is played by the computer.
   opts.league = team size (1, 2 or 5); the teams are p.team 1 and 2. */
Object.assign(RA.CFG, {
  LG_CAP: 0.1, // a team under this share of the players' land…
  LG_CAP_T: 600, // …for this many ticks capitulates (Blitz)
  LG_END: 27000, // Blitz: 45 min, then the team with more land wins
  LG_WARN: 21000, // warning at 35 min
});

(function (P) {
  /* the players of a team (every one, kicked and fallen too) */
  P.lgTeam = function (t) {
    return (this.humans || []).filter((p) => p.team === t);
  };
  /* votes a team needs: 4 of 5, both of 2, the one of 1 */
  P.lgNeed = function (n) {
    return Math.max(1, Math.ceil(n * 0.8));
  };
  P.lgSurr = function (p) {
    if (p.surrVote) return 'Već si glasao/la za predaju.';
    p.surrVote = true;
    const team = this.lgTeam(p.team).filter((q) => q.alive && !q.kicked);
    const votes = team.filter((q) => q.surrVote).length, need = this.lgNeed(team.length);
    for (const q of team) this.tell(q, 'info', `${p.nick || p.name} glasa za predaju (${votes}/${need}).`, p.id);
    if (votes >= need) {
      for (const q of this.lgTeam(p.team)) q.surr = true;
      this._lgEnd(3 - p.team, 'surr');
    }
    return { surr: votes >= need, votes, need };
  };
  /* vote kick (5v5 only): the other players of the team vote; 4 votes (or all of them, when fewer are left) */
  P.lgKick = function (p, tid) {
    const t = this.P[tid];
    if (this.opts.league !== 5) return 'Izbacivanje glasanjem je samo u 5v5.';
    if (!t || t === p || !t.human || t.team !== p.team || !t.alive) return 'Izaberi igrača iz svog tima.';
    if (t.kicked) return 'Već je izbačen/a.';
    p.kickVote = tid;
    const voters = this.lgTeam(p.team).filter((q) => q.alive && !q.kicked && q !== t);
    const votes = voters.filter((q) => q.kickVote === tid).length, need = Math.min(4, voters.length);
    for (const q of voters) this.tell(q, 'info', `Glasanje: izbaciti ${t.nick || t.name}? (${votes}/${need})`, t.id);
    if (votes >= need) {
      t.kicked = true;
      if (!t.ai) RA.AI.init(this, t);
      for (const q of voters) if (q.kickVote === tid) q.kickVote = 0;
      this.tell(t, 'bad', 'Tim te je izbacio iz igre — tvoju državu vodi kompjuter.', t.id);
      this.tellAll('info', `${t.nick || t.name} je izbačen/a glasanjem tima; državu vodi kompjuter.`, t.id);
    }
    return { kicked: !!t.kicked, votes, need };
  };
  /* land of each team (1, 2) */
  P._lgArea = function () {
    const a = [0, 0, 0];
    for (const p of this.humans || []) if (p.alive && (p.team === 1 || p.team === 2)) a[p.team] += p.area;
    return a;
  };
  /* every 10 ticks, instead of the usual win check */
  P._stepLeague = function () {
    if (this.state !== 'play') return;
    const L = this.lg || (this.lg = { low: [0, 0, 0], warned: false });
    const up = [0, 0, 0];
    for (const p of this.humans || []) if (p.alive && !p.surr) up[p.team] = 1;
    // a team is gone: the other one wins
    if (!up[1] || !up[2]) return this._lgEnd(up[1] ? 1 : 2, 'elim');
    if (!this.opts.fast || this.tick < this.peaceUntil) return;
    const a = this._lgArea(), tot = a[1] + a[2], C = RA.CFG;
    for (const t of [1, 2]) {
      if (tot > 0 && a[t] / tot < C.LG_CAP) {
        if (!L.low[t]) {
          L.low[t] = this.tick;
          for (const q of this.lgTeam(t)) this.tell(q, 'bad', `Tvoj tim ima manje od ${Math.round(C.LG_CAP * 100)}% zemlje igrača: za ${RA.dur(C.LG_CAP_T)} kapitulira ako se ne oporavi.`, q.id);
        } else if (this.tick - L.low[t] >= C.LG_CAP_T) return this._lgEnd(3 - t, 'cap');
      } else L.low[t] = 0;
    }
    if (!L.warned && this.tick >= C.LG_WARN) {
      L.warned = true;
      this.tellAll('info', `Još ${RA.dur(C.LG_END - C.LG_WARN)}: tada pobjeđuje tim s više zemlje.`, 0);
    }
    if (this.tick >= C.LG_END) this._lgEnd(a[1] > a[2] ? 1 : a[2] > a[1] ? 2 : this._lgTroops(1) >= this._lgTroops(2) ? 1 : 2, 'time');
  };
  P._lgTroops = function (t) {
    return this.lgTeam(t).reduce((s, p) => s + (p.alive ? p.troops : 0), 0);
  };
  P._lgEnd = function (team, why) {
    if (this.state !== 'play') return;
    const best = this.lgTeam(team).filter((p) => p.alive).sort((a, b) => b.area - a.area)[0] || this.lgTeam(team)[0];
    this.lgWin = { team, why };
    this.winner = best || null;
    this.state = 'over';
    this._history();
    const W = { elim: 'protivnici su uništeni', cap: 'protivnički tim je kapitulirao', time: 'više zemlje nakon 45 min', surr: 'protivnički tim se predao', vote: 'glasanje za kraj' };
    this.tellAll('over', `Pobjeđuje tim ${team} — ${W[why] || ''}.`, best ? best.id : 0);
  };
})(RA.Game.prototype);

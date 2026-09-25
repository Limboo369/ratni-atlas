'use strict';
/* World news on the map (G.feed, filled by G.news in the sim):
   - top left, the kill feed (as in Counter-Strike): "Srbija ⚔ Albanija" when a war starts, "Srbija ☠ Albanija" when a
     state falls — nothing about single cities;
   - bottom right, the diplomacy log (like a chat): wars, alliances made / broken / expired, trade agreements.
   A row is clickable: the map flies to the second state (the one attacked, fallen, …). */
Object.assign(RA.UI.prototype, {
  feedReset() {
    this.feedSeen = 0;
    this.$('feed').innerHTML = '';
    this.$('dlogList').innerHTML = '';
    this.$('dlog').hidden = true;
  },
  feedName(id) {
    const p = this.G.P[id];
    if (!p) return '';
    const me = this.G.me && p === this.G.me;
    return `<span class="fn${me ? ' me' : ''}" style="--c:${p.hex}">${RA.esc(p.human && this.G.online ? p.nick || p.name : p.name)}</span>`;
  },
  feedUpdate(now) {
    const G = this.G, F = G.feed;
    if (this.feedSeen > F.length) this.feedSeen = 0; // the sim trimmed its list
    if (this.app.attractMode) return void (this.feedSeen = F.length); // the start screen's background game
    for (; this.feedSeen < F.length; this.feedSeen++) this.feedAdd(F[this.feedSeen], now);
    // kill feed rows fade after 9 s, at most 5 on screen
    const box = this.$('feed');
    for (const el of [...box.children]) if (now - el._t > 9000 && !el.classList.contains('out')) {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }
  },
  feedAdd(n, now) {
    const G = this.G, A = this.feedName(n.a), B = n.b ? this.feedName(n.b) : '';
    const mine = G.me && (n.a === G.me.id || n.b === G.me.id);
    const focus = n.b || n.a;
    // kill feed: wars and falls
    if (n.t === 'war' || n.t === 'fall') {
      const box = this.$('feed');
      const el = document.createElement('div');
      el.className = 'kf ' + n.t + (mine ? ' mine' : '');
      el.innerHTML = n.t === 'fall' && !n.b ? `${RA.icon('skull')}${A}` : `${A}${RA.icon(n.t === 'war' ? 'attack' : 'skull')}${B}`;
      el._t = now;
      el.onclick = () => this.focusPlayer(focus);
      box.appendChild(el);
      while (box.children.length > 5) box.firstElementChild.remove();
    }
    // diplomacy log
    const txt = {
      war: `${A} napada ${B}`,
      fall: n.b ? `${B} je pala — osvojio ${A}` : `${A} je pala`,
      ally: `${A} i ${B} sklopili vojni savez`,
      break: `${A} izdao saveznika ${B}`,
      allyEnd: `Istekao savez: ${A} i ${B}`,
      trade: `${A} i ${B} trguju`,
    }[n.t];
    if (!txt) return;
    const list = this.$('dlogList');
    const li = document.createElement('li');
    li.className = n.t + (mine ? ' mine' : '');
    li.innerHTML = `<time>${RA.fmtTime(n.tick / 10)}</time><span>${txt}</span>`;
    li.onclick = () => this.focusPlayer(focus);
    const stick = list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
    list.appendChild(li);
    while (list.children.length > 60) list.firstElementChild.remove();
    if (stick) list.scrollTop = list.scrollHeight;
    this.$('dlog').hidden = false;
    const cnt = this.$('dlogNew');
    if (this.$('dlog').classList.contains('collapsed')) {
      cnt.textContent = String((+cnt.textContent || 0) + 1);
      cnt.hidden = false;
    }
  },
});

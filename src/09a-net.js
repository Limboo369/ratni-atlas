'use strict';
/* Ratni Atlas — online play through the artifact "room" (everyone who has this page open right now).

   Lockstep: every device runs the same deterministic simulation from the same seed; only player commands travel.
   The host is the clock: it steps the game in real time, gives every command an execution tick and publishes
   { T: its current tick, c: recent command log } in its presence. Guests step up to T, executing the log's
   commands at exactly those ticks, and put their own commands in their presence for the host to schedule.
   Presence is used (not events) because the platform keeps it current for everyone, lets anyone in the room
   set it, and hands the latest state to newcomers; each object carries whole state, so a dropped update is
   healed by the next one.

   Host presence:  { v, r:'h', n, g, ph:'lobby'|'play', set, pk, sl:[peer], st, T, c:[[i,e,slot,kind,seq,...args]], sp, pz, ds }
   Guest presence: { v, r:'g', n, g, pk, q:[[seq,kind,...args]], ak, t, hs:[tick,hash] }
   Both, in the lobby: ld = '<map>:<era>' once that map and era are downloaded (the host starts when all have it)
   Spectator:      { v, r:'s', n, g }

   On our own server (war.deovilab.com) every game is a private room with its own link /game-<code>: the host
   shares it, friends join through it, and anyone who closes the page comes back through it to the same seat.
   Presence written by other people is untrusted: read names with RA.Net.str(). */

const PEER_STR = (v, d) => (typeof v === 'string' ? v.slice(0, 18) : d);

RA.Net = class {
  constructor(app) {
    this.app = app;
    this.room = null;
    this.status = 'off'; // off | connecting | ready | unavailable
    this.pres = {};
    this.listeners = new Set();
    this.code = null; // our own server: the current game's room code
    this.wsUrl = '';
    this.reset();
  }
  static str(v, d) {
    return PEER_STR(v, d);
  }
  reset() {
    this.role = null; // 'host' | 'guest' | 'spec' (watching someone else's game)
    this.logReq = false;
    this.gid = null;
    this.phase = 'idle'; // idle | lobby | play
    this.inGame = false;
    this.log = [];
    this.ptr = 0;
    this.slots = [];
    this.mySlot = -1;
    this.st = null;
    this.hostT = 0;
    this.hostSp = 1;
    this.hostPz = false;
    this.seq = 0;
    this.q = [];
    this.lastSeq = [];
    this.guestInfo = [];
    this.myHashes = new Map();
    this.desync = -1;
    this.hostGoneAt = 0;
    this.hostGone = false;
    this.lastPub = '';
    this.catchUp = 0; // host who came back: replay the log up to this tick before running the clock again
  }

  /* ---------- connection ---------- */
  async init() {
    try {
      const url = window.RA_WS || (/^https?:$/.test(location.protocol) ? location.origin.replace(/^http/, 'ws') + '/ws' : '');
      const claudeRoom = window.claude && typeof window.claude.use === 'function';
      if (!claudeRoom && !url) return this.setStatus('unavailable');
      this.setStatus('connecting');
      if (!claudeRoom) {
        this.wsUrl = url;
        this.setStatus('ready');
        const m = /^\/game-([a-z0-9]{6})\/?$/.exec(location.pathname);
        if (m) this.enterRoom(m[1], true);
        return;
      }
      const room = await window.claude.use('room');
      if (!room) return this.setStatus('unavailable');
      this.room = room;
      room.onPeers(() => this.changed(), () => this.setStatus('unavailable'));
      room.onConnection((c) => {
        this.connected = c;
        this.changed();
      });
      this.setStatus('ready');
      this.publish({ v: RA.BUILD, n: this.myName() });
    } catch (e) {
      this.setStatus('unavailable');
    }
  }
  /* ---------- game rooms on our own server ---------- */
  get own() {
    return !!this.wsUrl;
  }
  newCode() {
    const a = 'abcdefghjkmnpqrstuvwxyz23456789';
    let c = '';
    for (let i = 0; i < 6; i++) c += a[(Math.random() * a.length) | 0];
    return c;
  }
  link() {
    return this.code ? location.origin + '/game-' + this.code : '';
  }
  /* connect to one game's room; arriving = opened through the game's link (join, come back or watch) */
  enterRoom(code, arriving) {
    if (!this.own) return;
    if (this.room && this.room.close) this.room.close();
    this.code = code;
    this.arriving = !!arriving;
    this.arrivedAt = performance.now();
    this.pres = {};
    let creds = null;
    try {
      creds = JSON.parse(localStorage.getItem('ra_game_' + code) || 'null');
    } catch (e) {}
    const room = RA.wsRoom(
      this.wsUrl + '?room=' + code,
      creds,
      (id, key) => {
        try {
          localStorage.setItem('ra_game_' + code, JSON.stringify({ id, key }));
        } catch (e) {}
      },
      (prev) => this.comeBack(prev)
    );
    this.room = room;
    room.onPeers(() => this.changed());
    room.onConnection((c) => {
      this.connected = c;
      this.setStatus(c ? 'ready' : 'connecting');
    });
    this.setStatus('connecting');
    if (/^https?:$/.test(location.protocol) && location.pathname !== '/game-' + code) history.replaceState(null, '', '/game-' + code);
    this.publish({ v: RA.BUILD, n: this.myName() });
  }
  closeRoom() {
    if (!this.own) return;
    if (this.room && this.room.close) this.room.close();
    this.room = null;
    this.code = null;
    this.arriving = false;
    this.setStatus('ready');
    if (/^https?:$/.test(location.protocol) && location.pathname !== '/') history.replaceState(null, '', '/');
  }
  /* a reloaded page (or a player coming back later) gets what it had published: continue from there */
  async comeBack(prev) {
    this.pres = Object.assign({}, prev, this.pres);
    const me = this.myPeer();
    if (prev.r === 'h' && prev.ph === 'lobby' && typeof prev.g === 'string') {
      this.role = 'host';
      this.gid = prev.g;
      this.phase = 'lobby';
      this.slots = Array.isArray(prev.sl) ? prev.sl : [me];
      this.app.ui.showLobby(prev.set);
    } else if (prev.r === 'h' && prev.ph === 'play' && prev.st && typeof prev.g === 'string') {
      const r = await this.room.log(prev.g, me, 0);
      if (!r || !r.st) return this.leave();
      this.reset();
      this.role = 'host';
      this.gid = prev.g;
      this.st = r.st;
      this.slots = r.st.slots.map((s) => s.peer);
      this.log = r.log;
      this.phase = 'play';
      this.mySlot = 0;
      this.lastSeq = this.slots.map((x, s) => this.maxSeq(s));
      this.guestInfo = this.slots.map(() => ({ t: 0, ak: 0, goneAt: 0, stallAt: 0, ai: false }));
      this.catchUp = Number.isInteger(prev.T) ? prev.T : 0;
      this.inGame = true;
      this.app.startOnline(r.st, 0);
      this.app.ui.toast('good', 'Vratio si se u svoju igru.');
    } else if (prev.r === 'g' && typeof prev.g === 'string') {
      const host = this.others().find((p) => p.presence && p.presence.r === 'h' && p.presence.g === prev.g);
      if (!host) return this.leave();
      if (host.presence.ph === 'lobby') {
        this.role = 'guest';
        this.gid = prev.g;
        this.hostPeer = host.peer;
        this.phase = 'lobby';
        this.app.ui.showLobby();
        return;
      }
      const st = host.presence.st;
      const slot = st && Array.isArray(st.slots) ? st.slots.findIndex((s) => s.peer === me) : -1;
      if (slot < 0) return this.leave();
      const r = await this.room.log(prev.g, host.peer, 0);
      if (!r || !r.st) return this.leave();
      this.reset();
      this.role = 'guest';
      this.gid = prev.g;
      this.hostPeer = host.peer;
      this.st = r.st;
      this.log = r.log;
      this.phase = 'play';
      this.mySlot = slot;
      this.seq = Math.max(this.maxSeq(slot), ...(Array.isArray(prev.q) ? prev.q.map((c) => (Array.isArray(c) && Number.isInteger(c[0]) ? c[0] : 0)) : [0]));
      this.inGame = true;
      this.publish({ r: 'g', g: this.gid, q: [], ak: this.log.length, t: 0, hs: null });
      this.app.startOnline(r.st, slot);
      this.app.ui.toast('good', 'Vratio si se u igru — sustižem ostale…');
    } else if (prev.r === 's' && typeof prev.g === 'string') {
      const host = this.others().find((p) => p.presence && p.presence.r === 'h' && p.presence.g === prev.g);
      if (host) this.watch(host.peer);
    }
    this.changed();
  }
  /* highest command number of a slot in the log (so commands after a come-back are not taken as old) */
  maxSeq(slot) {
    let m = 0;
    for (const e of this.log) if (e[2] === slot && e[4] > m) m = e[4];
    return m;
  }
  setStatus(s) {
    this.status = s;
    this.changed();
  }
  onChange(fn) {
    this.listeners.add(fn);
  }
  changed() {
    if (this._chgQueued) return;
    this._chgQueued = true;
    requestAnimationFrame(() => {
      this._chgQueued = false;
      for (const fn of this.listeners) fn();
    });
  }
  myName() {
    const s = this.app.ui && this.app.ui.settings;
    return PEER_STR(s && s.name, '') || 'Igrač';
  }
  peers() {
    return this.room ? this.room.peers() : [];
  }
  myPeer() {
    const me = this.peers().find((p) => p.isMe && p.sameTab);
    return me ? me.peer : null;
  }
  peerBy(label) {
    return this.peers().find((p) => p.peer === label) || null;
  }
  publish(patch) {
    if (!this.room) return;
    Object.assign(this.pres, patch);
    for (const k of Object.keys(patch)) if (patch[k] === null) delete this.pres[k];
    this.room.presence(patch).catch(() => {});
  }
  /* people in the room besides me, with a readable name */
  others() {
    return this.peers().filter((p) => !(p.isMe && p.sameTab) && p.kind === 'viewer');
  }
  openLobbies() {
    // same build only: different code would desync
    return this.others().filter((p) => p.presence && p.presence.r === 'h' && p.presence.ph === 'lobby' && p.presence.g && p.presence.v === RA.BUILD);
  }

  /* ---------- lobby ---------- */
  host(set) {
    if (this.own) this.enterRoom(this.newCode());
    if (!this.room) return;
    this.reset();
    this.role = 'host';
    this.gid = Math.random().toString(36).slice(2, 10);
    this.phase = 'lobby';
    this.slots = [this.myPeer()];
    this.publish({ r: 'h', n: this.myName(), g: this.gid, ph: 'lobby', set, pk: this.pick || '', sl: this.slots, st: null, T: null, c: null, sp: null, pz: null, ds: null, q: null, ak: null, t: null, hs: null });
    this.changed();
  }
  join(hostPeer) {
    const h = this.peerBy(hostPeer);
    if (!h || !h.presence || h.presence.r !== 'h') return;
    this.reset();
    this.role = 'guest';
    this.gid = h.presence.g;
    this.hostPeer = hostPeer;
    this.phase = 'lobby';
    this.publish({ r: 'g', n: this.myName(), g: this.gid, pk: this.pick || '', q: [], ak: 0, t: 0, hs: null, ph: null, set: null, sl: null, st: null, T: null, c: null, sp: null, pz: null, ds: null });
    this.changed();
  }
  leave() {
    this.reset();
    this.publish({ r: null, g: null, ph: null, set: null, sl: null, st: null, T: null, c: null, sp: null, pz: null, ds: null, q: null, ak: null, t: null, hs: null, pk: null });
    this.closeRoom();
    this.changed();
  }
  setPick(iso) {
    this.pick = iso || '';
    if (this.role) this.publish({ pk: this.pick });
    this.changed();
  }
  setSettings(set) {
    if (this.role === 'host' && this.phase === 'lobby') this.publish({ set });
    this.changed();
  }
  hostPresence() {
    if (this.role === 'host') return this.pres;
    const h = this.peerBy(this.hostPeer);
    return h ? h.presence : null;
  }
  /* lobby members in slot order: [{peer, name, pick, isMe}] */
  members() {
    if (!this.room || !this.role) return [];
    if (this.role === 'host') {
      // admit guests who joined my lobby, keep slot order stable, drop those who left
      const guests = this.others().filter((p) => p.presence && p.presence.r === 'g' && p.presence.g === this.gid);
      const alive = new Set(guests.map((p) => p.peer));
      const mine = this.myPeer();
      let slots = this.slots.filter((x, i) => i === 0 || alive.has(x));
      if (mine) slots[0] = mine;
      for (const p of guests) if (!slots.includes(p.peer) && slots.length < 4) slots.push(p.peer);
      if (slots.join() !== this.slots.join()) {
        this.slots = slots;
        this.publish({ sl: slots });
      }
    }
    const hp = this.hostPresence();
    const sl = (hp && hp.sl) || [];
    return sl.map((peer) => {
      const p = this.peerBy(peer);
      const isMe = !!(p && p.isMe && p.sameTab);
      const pr = isMe ? this.pres : (p && p.presence) || {};
      return { peer, name: PEER_STR(pr.n, '') || 'Igrač', pick: PEER_STR(pr.pk, ''), ld: typeof pr.ld === 'string' ? pr.ld.slice(0, 40) : '', isMe, here: !!p };
    });
  }
  /* host: start the game for everyone in the lobby */
  start(set, nations) {
    const mem = this.members();
    if (mem.length < 2) return 'Čeka se bar jedan prijatelj.';
    // unique countries: first come keeps its pick, others get a free random one
    const used = new Set();
    const free = nations.map((n) => n.iso);
    const slots = mem.map((m) => ({ peer: String(m.peer), name: m.name, iso: '' }));
    slots.forEach((s, i) => {
      const want = mem[i].pick;
      if (want && free.includes(want) && !used.has(want)) {
        s.iso = want;
        used.add(want);
      }
    });
    for (const s of slots) {
      if (s.iso) continue;
      const left = free.filter((iso) => !used.has(iso));
      s.iso = left[Math.floor(Math.random() * left.length)] || '';
      used.add(s.iso);
    }
    const st = { seed: (Math.random() * 1e9) | 0, set, slots, gid: this.gid };
    this.st = st;
    this.phase = 'play';
    this.log = [];
    this.ptr = 0;
    this.lastSeq = slots.map(() => 0);
    this.guestInfo = slots.map(() => ({ t: 0, ak: 0, goneAt: 0, stallAt: 0, ai: false }));
    this.publish({ ph: 'play', st, T: 0, c: [], sp: 1, pz: false, ds: null });
    this.mySlot = 0;
    this.inGame = true;
    this.app.startOnline(st, 0);
    this.changed();
    return true;
  }
  /* watch a running game: the server has the host's whole command log, so the game replays from tick 0 */
  async watch(hostPeer) {
    const h = this.peerBy(hostPeer);
    if (!h || !h.presence || h.presence.ph !== 'play' || !this.room || !this.room.log) return false;
    const r = await this.room.log(h.presence.g, hostPeer, 0);
    if (!r || !r.st) return false;
    this.reset();
    this.role = 'spec';
    this.hostPeer = hostPeer;
    this.gid = h.presence.g;
    this.st = r.st;
    this.log = r.log;
    this.phase = 'play';
    this.mySlot = -1;
    this.inGame = true;
    this.publish({ r: 's', n: this.myName(), g: this.gid });
    this.app.startOnline(r.st, -1);
    this.app.ui.watching = true;
    this.changed();
    return true;
  }
  /* guest or spectator: the host's presence only carries the recent log; fetch a gap from the server */
  fillGap() {
    if (this.logReq || !this.room || !this.room.log) return;
    this.logReq = true;
    const from = this.log.length, gid = this.gid;
    this.room.log(gid, this.hostPeer, from).then((r) => {
      this.logReq = false;
      if (!r || this.gid !== gid) return;
      for (const e of r.log) if (Array.isArray(e) && e[0] === this.log.length) this.log.push(e);
    });
  }
  /* guest: has the host started a game that includes me? */
  pollStart() {
    if (this.role !== 'guest' || this.phase !== 'lobby') return;
    const hp = this.hostPresence();
    if (!hp || hp.g !== this.gid || hp.ph !== 'play' || !hp.st || !Array.isArray(hp.st.slots)) return;
    const me = this.myPeer();
    const slot = hp.st.slots.findIndex((s) => s && s.peer === me);
    if (slot < 0) return;
    this.st = hp.st;
    this.phase = 'play';
    this.mySlot = slot;
    this.log = [];
    this.ptr = 0;
    this.hostT = 0;
    this.inGame = true;
    this.app.startOnline(hp.st, slot);
    this.changed();
  }

  /* ---------- in game ---------- */
  /* a command from this device */
  issue(kind, args) {
    const G = this.app.G;
    if (!this.inGame || !G || this.role === 'spec') return;
    if (this.role === 'host') this.schedule(this.mySlot, kind, args, 0);
    else {
      this.seq++;
      this.q.push([this.seq, kind].concat(args));
      if (this.q.length > 24) this.q.shift();
      this.publish({ q: this.q });
    }
  }
  schedule(slot, kind, args, seq) {
    const G = this.app.G;
    this.log.push([this.log.length, G.tick + 1, slot, kind, seq].concat(args));
  }
  /* execute every logged command due at tick t (called right before G.step() produces tick t) */
  applyTick(t) {
    const G = this.app.G, log = this.log;
    while (this.ptr < log.length) {
      const e = log[this.ptr];
      if (e[1] > t) break;
      this.ptr++;
      if (e[1] < t) {
        // arrived too late to replay in step: the games may diverge; the hash check will tell
        this.desync = this.desync < 0 ? G.tick : this.desync;
      }
      const p = G.humans[e[2]];
      if (!p) continue;
      const r = G.exec(p.id, e[3], e.slice(5));
      if (e[2] === this.mySlot) this.app.ui.afterAct(e[3], e.slice(5), r);
    }
  }
  afterStep() {
    const G = this.app.G;
    if (G.tick % 100 === 0) {
      const h = G.hash();
      if (this.role === 'host') {
        this.myHashes.set(G.tick, h);
        if (this.myHashes.size > 40) this.myHashes.delete(this.myHashes.keys().next().value);
      } else if (this.role === 'guest') this.publish({ hs: [G.tick, h], t: G.tick });
    }
  }
  /* host: read guests' commands and progress */
  hostPoll() {
    const G = this.app.G;
    const st = this.st;
    for (let s = 1; s < st.slots.length; s++) {
      const gi = this.guestInfo[s];
      const peer = this.peerBy(st.slots[s].peer);
      if (gi.ai) {
        // came back through the game's link: give them their country back
        const pr = peer && peer.presence;
        if (pr && pr.r === 'g' && pr.g === this.gid && Number.isInteger(pr.t)) {
          gi.ai = false;
          gi.goneAt = gi.stallAt = 0;
          gi.t = pr.t;
          this.schedule(s, 'back', [], 0);
          this.app.ui.toast('good', `${RA.esc(st.slots[s].name)} se vratio u igru.`);
        }
        continue;
      }
      // closed the page, or left the game through the menu (still on the page, but no longer in this game)
      if (!peer || !peer.presence || peer.presence.g !== this.gid) {
        if (!gi.goneAt) gi.goneAt = performance.now();
        else if (performance.now() - gi.goneAt > 8000) {
          // gone for good: the computer takes over their country
          gi.ai = true;
          this.schedule(s, 'ai', [], 0);
          this.app.ui.toast('bad', `${RA.esc(st.slots[s].name)} je napustio igru — kompjuter preuzima njegovu državu.`);
        }
        continue;
      }
      gi.goneAt = 0;
      const pr = peer.presence || {};
      if (Array.isArray(pr.q)) {
        for (const c of pr.q) {
          if (!Array.isArray(c) || !Number.isInteger(c[0]) || c[0] <= this.lastSeq[s] || !RA.CMD_KINDS.includes(c[1]) || c[1] === 'ai') continue;
          this.lastSeq[s] = c[0];
          this.schedule(s, c[1], c.slice(2, 8), c[0]);
        }
      }
      if (Number.isInteger(pr.t)) {
        if (pr.t !== gi.t) gi.stallAt = 0;
        gi.t = pr.t;
      }
      if (Number.isInteger(pr.ak)) gi.ak = pr.ak;
      if (Array.isArray(pr.hs) && this.myHashes.has(pr.hs[0]) && this.myHashes.get(pr.hs[0]) !== pr.hs[1] && this.desync < 0) {
        this.desync = pr.hs[0];
        this.publish({ ds: pr.hs[0] });
        this.app.ui.toast('bad', 'Upozorenje: igre na vašim uređajima su se razišle. Rezultati se mogu razlikovati — najbolje je početi novu partiju.');
      }
    }
    this.waiting = false;
  }
  /* host: may the clock advance past tick t? (don't run away from a slow guest) */
  canAdvance(t) {
    const st = this.st;
    for (let s = 1; s < st.slots.length; s++) {
      const gi = this.guestInfo[s];
      if (gi.ai || gi.goneAt) continue;
      if (t - gi.t > 30) {
        // still connected but not moving (phone in the pocket, frozen tab): after 30 s the computer plays for them
        if (!gi.stallAt) gi.stallAt = performance.now();
        else if (performance.now() - gi.stallAt > 30000) {
          gi.ai = true;
          this.schedule(s, 'ai', [], 0);
          this.app.ui.toast('bad', `${RA.esc(st.slots[s].name)} ne odgovara — kompjuter igra umjesto njega dok se ne vrati.`);
          continue;
        }
        this.waiting = true;
        return false;
      }
    }
    return true;
  }
  hostPublish() {
    const G = this.app.G;
    let from = this.log.length;
    for (let s = 1; s < this.st.slots.length; s++) {
      const gi = this.guestInfo[s];
      if (!gi.ai) from = Math.min(from, gi.ak);
    }
    from = Math.max(from, this.log.length - 60); // presence must stay under 4 KiB
    const c = this.log.slice(from);
    const sp = this.app.speed, pz = !!this.app.paused;
    const key = G.tick + ':' + this.log.length + ':' + from + ':' + sp + ':' + pz;
    if (key === this.lastPub) return;
    this.lastPub = key;
    this.publish({ T: G.tick, c, sp, pz });
  }
  /* guest: read the host's clock and command log */
  guestPoll() {
    const hp = this.hostPresence();
    if (!hp || hp.g !== this.gid || hp.ph !== 'play') {
      if (!this.hostGoneAt) this.hostGoneAt = performance.now();
      else if (!this.hostGone && performance.now() - this.hostGoneAt > 8000) {
        this.hostGone = true;
        this.app.ui.toast('bad', 'Domaćin je napustio igru — partija je stala. Meni → Nova igra.', { sticky: true });
      }
      return;
    }
    this.hostGoneAt = 0;
    if (this.hostGone) {
      this.hostGone = false;
      this.app.ui.toast('good', 'Domaćin se vratio — igra se nastavlja.');
    }
    if (Array.isArray(hp.c)) {
      if (hp.c.length && Array.isArray(hp.c[0]) && hp.c[0][0] > this.log.length) this.fillGap();
      for (const e of hp.c) {
        if (!Array.isArray(e) || e[0] !== this.log.length) continue;
        if (!Number.isInteger(e[1]) || !Number.isInteger(e[2]) || !RA.CMD_KINDS.includes(e[3])) continue;
        this.log.push(e);
      }
      // my commands the host has taken: drop them from my queue
      let taken = 0;
      for (const e of this.log.slice(-120)) if (e[2] === this.mySlot && e[4] > taken) taken = e[4];
      if (taken && this.q.length && this.q[0][0] <= taken) {
        this.q = this.q.filter((c) => c[0] > taken);
        this.publish({ q: this.q });
      }
    }
    // only step as far as every command up to that tick is known
    if (Number.isInteger(hp.T)) {
      const lastE = this.log.length ? this.log[this.log.length - 1][1] : 0;
      this.hostT = hp.T;
      if (Array.isArray(hp.c) && hp.c.length && hp.c[hp.c.length - 1][0] >= this.log.length) this.hostT = Math.min(hp.T, lastE - 1);
    }
    this.hostSp = hp.sp || 1;
    this.hostPz = !!hp.pz;
    if (Number.isInteger(hp.ds) && this.desync < 0) {
      this.desync = hp.ds;
      this.app.ui.toast('bad', 'Upozorenje: igre na vašim uređajima su se razišle. Rezultati se mogu razlikovati — najbolje je početi novu partiju.');
    }
  }
  guestPublish() {
    if (this.role === 'spec') return;
    const G = this.app.G;
    const key = G.tick + ':' + this.log.length;
    if (key === this.lastPub) return;
    this.lastPub = key;
    this.publish({ t: G.tick, ak: this.log.length });
  }
  endGame() {
    // back to the start screen: the game is over (on our own server its room closes too)
    this.inGame = false;
    this.phase = 'idle';
    const keep = this.role;
    this.role = null;
    if (keep) this.publish({ r: null, g: null, ph: null, set: null, sl: null, st: null, T: null, c: null, sp: null, pz: null, ds: null, q: null, ak: null, t: null, hs: null });
    this.closeRoom();
    this.changed();
  }
};

/* Our own relay (deploy/game/server.js) behind the same four methods as the claude.ai room, so RA.Net above
   does not care which one it talks to. One room = one game code. Reconnects by itself and keeps its peer id
   (id + key from the server, also saved per game so a reloaded page gets its seat back).
   creds: {id, key} from an earlier visit · onCreds(id, key) · onBack(presence I had when I left) */
RA.wsRoom = function (url, creds, onCreds, onBack) {
  let me = '', key = '', ws = null, up = false, peers = [], closed = false, first = true;
  if (creds && typeof creds.id === 'string' && typeof creds.key === 'string') (me = creds.id), (key = creds.key);
  let mine = {};
  const pres = new Map(), PL = new Set(), CL = new Set(), logWait = [];
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const emit = () => {
    peers = [...pres].map(([peer, presence]) => ({ peer, presence, isMe: peer === me, sameTab: peer === me, kind: 'viewer' }));
    for (const f of PL) f({ peers });
  };
  const conn = (c) => {
    up = c;
    for (const f of CL) f(c);
  };
  const open = () => {
    if (closed) return;
    ws = new WebSocket(url);
    ws.onopen = () => ws.send(JSON.stringify({ hello: { id: me, key } }));
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'all') {
        me = String(m.me);
        key = String(m.key);
        if (onCreds) onCreds(me, key);
        pres.clear();
        for (const k in obj(m.peers)) pres.set(k, obj(m.peers[k]));
        // a fresh page coming back to its seat: take over what it had published before
        const you = obj(m.you);
        if (first && Object.keys(you).length) mine = Object.assign({}, you, mine);
        pres.set(me, mine);
        ws.send(JSON.stringify({ p: mine, full: 1 }));
        emit(); // the peer list must be current before anyone reads it (come-back looks for the host)
        conn(true);
        const back = first && Object.keys(you).length && onBack;
        first = false;
        if (back) onBack(you);
        return;
      } else if (m.t === 'p') {
        const p = m.full ? {} : Object.assign({}, pres.get(m.id));
        for (const k in obj(m.p)) {
          if (m.p[k] === null) delete p[k];
          else p[k] = m.p[k];
        }
        pres.set(String(m.id), p);
      } else if (m.t === 'x') pres.delete(m.id);
      else if (m.t === 'log') {
        const i = logWait.findIndex((w) => w.g === m.g);
        if (i >= 0) logWait.splice(i, 1)[0].res({ st: m.st, log: Array.isArray(m.log) ? m.log : [] });
        return;
      } else return;
      emit();
    };
    ws.onclose = () => {
      if (up) conn(false);
      if (!closed) setTimeout(open, 1500);
    };
  };
  open();
  return {
    peers: () => peers,
    presence(patch) {
      for (const k in patch) {
        if (patch[k] === null) delete mine[k];
        else mine[k] = patch[k];
      }
      if (up && ws.readyState === 1) ws.send(JSON.stringify({ p: patch }));
      return Promise.resolve();
    },
    log(g, host, from) {
      if (!up || ws.readyState !== 1) return Promise.resolve(null);
      return new Promise((res) => {
        logWait.push({ g, res });
        ws.send(JSON.stringify({ log: g, host, from }));
        setTimeout(() => res(null), 8000);
      });
    },
    onPeers(f) {
      PL.add(f);
      return () => PL.delete(f);
    },
    onConnection(f) {
      CL.add(f);
      return () => CL.delete(f);
    },
    close() {
      closed = true;
      if (ws) ws.close();
    },
    kick: () => ws.close(), // test hook: simulates a dropped connection
  };
};

'use strict';
/* Sound effects and music, synthesized with Web Audio (no sound files). The audio context starts on the first
   click / touch (browsers allow no sound before that). Settings per viewer in localStorage 'ra_audio'.
   Effects: click, attack alarm, city won / lost, rocket, explosion, nuclear siren, message, win, defeat.
   Music: a quiet generative pad per era (a slow chord loop in the era's mode). */
RA.Audio = class {
  constructor() {
    this.s = { sfx: true, music: true, vol: 0.7 };
    try {
      Object.assign(this.s, JSON.parse(localStorage.getItem('ra_audio') || '{}'));
    } catch (_) {}
    this.ctx = null;
    this.last = {};
    this.era = null;
    const start = () => {
      this.unlock();
      window.removeEventListener('pointerdown', start, true);
      window.removeEventListener('keydown', start, true);
    };
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('keydown', start, true);
    // a soft click for every button press
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('button, .btn, .achip, .kf')) this.play('click');
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }
  save() {
    try {
      localStorage.setItem('ra_audio', JSON.stringify(this.s));
    } catch (_) {}
  }
  unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (_) {
      return;
    }
    const c = this.ctx;
    this.out = c.createGain();
    this.out.gain.value = this.s.vol;
    this.out.connect(c.destination);
    this.fxBus = c.createGain();
    this.fxBus.gain.value = this.s.sfx ? 1 : 0;
    this.fxBus.connect(this.out);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = this.s.music ? 0.22 : 0;
    this.musicBus.connect(this.out);
    // one second of white noise, reused by explosions and drums
    const n = c.sampleRate;
    this.noise = c.createBuffer(1, n, n);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    if (this.era) this.setEra(this.era, true);
  }
  toggle(k) {
    this.s[k] = !this.s[k];
    this.save();
    if (!this.ctx) return this.s[k];
    const t = this.ctx.currentTime;
    if (k === 'sfx') this.fxBus.gain.setTargetAtTime(this.s.sfx ? 1 : 0, t, 0.05);
    if (k === 'music') this.musicBus.gain.setTargetAtTime(this.s.music ? 0.22 : 0, t, 0.4);
    return this.s[k];
  }

  /* ---------------- effects ---------------- */
  tone(f, dur, type, vol, when, slide) {
    const c = this.ctx, t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.fxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  burst(dur, freq, vol, when, q) {
    const c = this.ctx, t = c.currentTime + (when || 0);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq / 8), t + dur);
    f.Q.value = q || 0.7;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.fxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
  /* name: click · alarm · city · loss · rocket · boom · nuke · siren · msg · win · lose; gap: min ms between repeats */
  play(name, gap) {
    if (!this.ctx || !this.s.sfx) return;
    const now = performance.now(), min = gap === undefined ? 90 : gap;
    if (now - (this.last[name] || 0) < min) return;
    this.last[name] = now;
    switch (name) {
      case 'click': return this.tone(660, 0.06, 'triangle', 0.05);
      case 'alarm': this.tone(220, 0.18, 'square', 0.07); return this.tone(165, 0.26, 'square', 0.07, 0.2);
      case 'city': this.tone(784, 0.35, 'sine', 0.12); this.tone(1047, 0.45, 'sine', 0.1, 0.09); return this.tone(1319, 0.6, 'sine', 0.08, 0.18);
      case 'loss': this.tone(392, 0.4, 'triangle', 0.1); return this.tone(311, 0.6, 'triangle', 0.1, 0.18);
      case 'rocket': return this.burst(0.5, 2400, 0.25);
      case 'boom': this.burst(0.9, 900, 0.6); return this.tone(70, 0.8, 'sine', 0.35, 0, 35);
      case 'nuke': this.burst(2.6, 1400, 0.9); this.tone(48, 2.4, 'sine', 0.5, 0, 24); return this.burst(1.8, 300, 0.5, 0.35);
      case 'siren': for (let i = 0; i < 3; i++) this.tone(520, 0.7, 'sawtooth', 0.06, i * 0.8, 880); return;
      case 'msg': this.tone(988, 0.12, 'sine', 0.1); return this.tone(1319, 0.16, 'sine', 0.08, 0.08);
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, i * 0.14)); return this.tone(1047, 1.2, 'sine', 0.1, 0.6);
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.11, i * 0.22)); return;
    }
  }

  /* ---------------- music: a slow pad per era ---------------- */
  setEra(id, force) {
    if (this.era === id && !force) return;
    this.era = id;
    if (!this.ctx) return;
    if (this.pad) {
      const old = this.pad;
      old.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.8);
      setTimeout(() => old.oscs.forEach((o) => o.stop()), 4000);
      clearInterval(old.timer);
    }
    // root (Hz), chord steps (semitones from root: a slow four-chord loop), wave, filter
    const M = {
      rim: [110, [[0, 7, 12], [5, 12, 17], [3, 10, 15], [7, 14, 19]], 'triangle', 900],
      srednji: [98, [[0, 7, 12], [0, 5, 12], [-2, 5, 10], [0, 7, 12]], 'triangle', 800],
      napoleon: [98, [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], 'sawtooth', 700],
      ww1: [87, [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 11, 14]], 'sawtooth', 600],
      ww2: [82, [[0, 3, 7], [-4, 0, 3], [5, 8, 12], [7, 10, 14]], 'sawtooth', 650],
      hladni: [73, [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]], 'square', 500],
      danas: [110, [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], 'sawtooth', 1100],
    }[id] || [110, [[0, 7, 12]], 'triangle', 800];
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = M[3];
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.25, c.currentTime, 2);
    f.connect(g).connect(this.musicBus);
    const oscs = [0, 1, 2].map(() => {
      const o = c.createOscillator();
      o.type = M[2];
      o.detune.value = (Math.random() - 0.5) * 12;
      o.connect(f);
      o.start();
      return o;
    });
    let i = 0;
    const step = () => {
      const ch = M[1][i++ % M[1].length], t = c.currentTime;
      ch.forEach((s, k) => oscs[k].frequency.setTargetAtTime(M[0] * Math.pow(2, s / 12), t, 0.6));
    };
    step();
    this.pad = { g, oscs, timer: setInterval(step, 6000) };
  }
};

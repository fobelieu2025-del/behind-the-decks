// Behind the Decks: audio.js
// The sound of the analog setup, built with the Web Audio API.
// Each turntable plays a track into a mixer channel. Every channel has trim, a four-band EQ and a fader,
// then the crossfader, then the master level. The CUE buttons tap a channel for the headphones.
// With the headphones plugged in, the CUE / MASTER knob blends what is cued with the main mix, and the
// headphone level sets how loud that is. A browser has one output, so while the headphones are plugged
// in that output carries the headphone mix, and while they are out it carries the speakers.
//
// The songs are the files in assets/audio, listed with their tempo and waveform in assets/tracks.json.

export const BPM = 122;

// knob value (0 to 1, middle at 0.5) -> gain in dB for the EQ: down to a full cut, up to +6 dB
export const eqDb = (v) => (Math.abs(v - 0.5) < 0.03 ? 0 : v < 0.5 ? (v < 0.03 ? -60 : -26 * (1 - v / 0.5)) : 6 * ((v - 0.5) / 0.5));

export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const api = { supported: !!AC, on: false, ctx: null, phonesPlugged: false };
  if (!AC) return api;
  let ctx = null, ch = [], xf = [], master, cueBus, phonesGain, speakerGain, out;
  const state = { master: 0.6, mix: 0.5, level: 0.4, cross: 0.5, curve: 0, split: false, plugged: false, cueOn: [false, false, false, false] };

  // helpers for the SOUND COLOR FX branches
  let noiseNode = null;
  const cfxImpulse = () => { const n = Math.floor(ctx.sampleRate * 1.8), b = ctx.createBuffer(2, n, ctx.sampleRate); for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.4); } return b; };
  const cfxCrush = () => { const n = 4096, c = new Float32Array(n), L = 5; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.round(x * L) / L; } return c; };
  const cfxNoise = () => { if (!noiseNode) { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseNode = ctx.createBufferSource(); noiseNode.buffer = b; noiseNode.loop = true; noiseNode.start(); } return noiseNode; };

  function build() {
    ctx = new AC();
    api.ctx = ctx;
    master = ctx.createGain(); cueBus = ctx.createGain(); phonesGain = ctx.createGain(); speakerGain = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -6; comp.ratio.value = 6;
    out = ctx.createGain(); out.gain.value = 0.9;
    master.connect(speakerGain); speakerGain.connect(comp);
    phonesGain.connect(comp); comp.connect(out); out.connect(ctx.destination);
    api.analyser = ctx.createAnalyser(); api.analyser.fftSize = 4096; out.connect(api.analyser); const mute = ctx.createGain(); mute.gain.value = 0; api.analyser.connect(mute); mute.connect(ctx.destination);
    const phMaster = ctx.createGain(), phCue = ctx.createGain(), phMasterPan = ctx.createStereoPanner(), phCuePan = ctx.createStereoPanner();
    master.connect(phMaster); phMaster.connect(phMasterPan); phMasterPan.connect(phonesGain);
    cueBus.connect(phCue); phCue.connect(phCuePan); phCuePan.connect(phonesGain);
    api._phMaster = phMaster; api._phCue = phCue; api._phMasterPan = phMasterPan; api._phCuePan = phCuePan; api.master = master; api.speaker = speakerGain;
    for (let i = 0; i < 4; i++) {
      const c = {};
      c.gate = ctx.createGain(); c.gate.gain.value = 0;
      c.trim = ctx.createGain();
      c.lo = ctx.createBiquadFilter(); c.lo.type = 'lowshelf'; c.lo.frequency.value = 100;
      c.lm = ctx.createBiquadFilter(); c.lm.type = 'peaking'; c.lm.frequency.value = 420; c.lm.Q.value = 0.8;
      c.hm = ctx.createBiquadFilter(); c.hm.type = 'peaking'; c.hm.frequency.value = 2400; c.hm.Q.value = 0.8;
      c.hi = ctx.createBiquadFilter(); c.hi.type = 'highshelf'; c.hi.frequency.value = 8000;
      c.fader = ctx.createGain(); c.cross = ctx.createGain(); c.cue = ctx.createGain(); c.cue.gain.value = 0;
      c.gate.connect(c.trim); c.trim.connect(c.lo); c.lo.connect(c.lm); c.lm.connect(c.hm); c.hm.connect(c.hi);
      // the colour filter of the channel (a low-pass when turned left, a high-pass when turned right), after the EQ
      c.colLp = ctx.createBiquadFilter(); c.colLp.type = 'lowpass'; c.colLp.frequency.value = 20000; c.colLp.Q.value = 0.9;
      c.colHp = ctx.createBiquadFilter(); c.colHp.type = 'highpass'; c.colHp.frequency.value = 20; c.colHp.Q.value = 0.9;
      c.hi.connect(c.colLp); c.colLp.connect(c.colHp); c.colHp.connect(c.fader); c.fader.connect(c.cross);
      // SOUND COLOR FX: five more effects beside the filter. Each one is a parallel branch (space, dub echo, crush, sweep, noise)
      // that is mixed back in before the fader. The colour knob sets how much of the chosen effect there is.
      c.cdry = ctx.createGain(); c.colHp.disconnect(c.fader); c.colHp.connect(c.cdry); c.cdry.connect(c.fader);
      c.cSpace = ctx.createConvolver(); c.cSpace.buffer = cfxImpulse(); c.gSpace = ctx.createGain(); c.gSpace.gain.value = 0;
      c.colHp.connect(c.cSpace); c.cSpace.connect(c.gSpace); c.gSpace.connect(c.fader);
      c.cEcho = ctx.createDelay(1.5); c.cEcho.delayTime.value = 0.375; c.cFb = ctx.createGain(); c.cFb.gain.value = 0.5; c.gEcho = ctx.createGain(); c.gEcho.gain.value = 0;
      c.colHp.connect(c.cEcho); c.cEcho.connect(c.cFb); c.cFb.connect(c.cEcho); c.cEcho.connect(c.gEcho); c.gEcho.connect(c.fader);
      c.cCrush = ctx.createWaveShaper(); c.cCrush.curve = cfxCrush(); c.gCrush = ctx.createGain(); c.gCrush.gain.value = 0;
      c.colHp.connect(c.cCrush); c.cCrush.connect(c.gCrush); c.gCrush.connect(c.fader);
      c.cSweep = ctx.createBiquadFilter(); c.cSweep.type = 'bandpass'; c.cSweep.Q.value = 3.5; c.gSweep = ctx.createGain(); c.gSweep.gain.value = 0;
      c.colHp.connect(c.cSweep); c.cSweep.connect(c.gSweep); c.gSweep.connect(c.fader);
      c.cNoise = ctx.createBiquadFilter(); c.cNoise.type = 'bandpass'; c.cNoise.Q.value = 0.7; c.gNoise = ctx.createGain(); c.gNoise.gain.value = 0;
      cfxNoise().connect(c.cNoise); c.cNoise.connect(c.gNoise); c.gNoise.connect(c.fader);
      // after the crossfader a channel goes straight to the master, or through one of the two filter modules
      c.direct = ctx.createGain(); c.toF = [ctx.createGain(), ctx.createGain()];
      c.cross.connect(c.direct); c.direct.connect(master);
      c.toBeat = ctx.createGain(); c.toBeat.gain.value = 0; c.cross.connect(c.toBeat);     // the send to the Beat FX unit
      c.toF.forEach((g, k) => { g.gain.value = 0; c.cross.connect(g); });
      c.colHp.connect(c.cue); c.cue.connect(cueBus);                 // the CUE tap comes before the fader
      ch.push(c);
    }
    // the two filter modules of the analog mixer: each one filters the channels sent to it, then joins the master
    api.fx = [0, 1].map((k) => {
      const f = { type: 'lpf' };
      f.in = ctx.createGain(); f.dry = ctx.createGain(); f.wet = ctx.createGain(); f.wet.gain.value = 0;
      f.b1 = ctx.createBiquadFilter(); f.b2 = ctx.createBiquadFilter();
      f.lfo = ctx.createOscillator(); f.lfo.type = 'sine'; f.lfo.frequency.value = 1; f.depth = ctx.createGain(); f.depth.gain.value = 0;
      f.lfo.connect(f.depth); f.depth.connect(f.b1.detune); f.depth.connect(f.b2.detune); f.lfo.start();
      f.in.connect(f.dry); f.dry.connect(master); f.in.connect(f.b1); f.b1.connect(f.b2); f.b2.connect(f.wet); f.wet.connect(master);
      ch.forEach((c) => c.toF[k].connect(f.in));
      return f;
    });
    // the Beat FX unit: the sent channels pass three frequency bands, then one effect, and the result joins the master
    {
      const B = api.beatfxNodes = { in: ctx.createGain(), out: ctx.createGain() };
      B.out.gain.value = 0; B.out.connect(master);
      B.bands = [['lowpass', 300, 0.7], ['bandpass', 1200, 0.5], ['highpass', 3000, 0.7]].map(([type, f, q]) => { const g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; ch.forEach((c) => c.toBeat.connect(fl)); fl.connect(g); g.connect(B.in); return g; });
      const tap = (to, k) => { const g = ctx.createGain(); g.gain.value = 0; B.in.connect(g); g.connect(to); return g; };
      B.delay = ctx.createDelay(2.5); B.fb = ctx.createGain(); B.delay.connect(B.fb); B.fb.connect(B.delay);
      const dSend = tap(B.delay); B.delay.connect(B.out);
      const imp = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.2), ctx.sampleRate);
      for (let c2 = 0; c2 < 2; c2++) { const d = imp.getChannelData(c2); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6); }
      B.conv = ctx.createConvolver(); B.conv.buffer = imp; const rSend = tap(B.conv); B.conv.connect(B.out);
      B.fl = ctx.createDelay(0.05); B.fl.delayTime.value = 0.004; B.flLfo = ctx.createOscillator(); B.flDepth = ctx.createGain(); B.flDepth.gain.value = 0.0025; B.flLfo.connect(B.flDepth); B.flDepth.connect(B.fl.delayTime); B.flLfo.start();
      const fSend = tap(B.fl); B.fl.connect(B.out);
      B.gate = ctx.createGain(); B.gate.gain.value = 0.5; B.gLfo = ctx.createOscillator(); B.gLfo.type = 'square'; B.gDepth = ctx.createGain(); B.gDepth.gain.value = 0.5; B.gLfo.connect(B.gDepth); B.gDepth.connect(B.gate.gain); B.gLfo.start();
      const tSend = tap(B.gate); B.gate.connect(B.out);
      B.sends = [dSend, dSend, rSend, fSend, tSend];            // echo, delay, reverb, flanger, transformer
    }
    // one slot for each turntable: the song on it, and where in the song the stylus is
    api.slots = [0, 1].map(() => ({ rec: null, buffer: null, src: null, pos: 0, last: 0, loading: false, ended: false, loop: null }));
    apply();
  }

  function apply() {
    if (!ctx) return;
    const now = ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, now, 0.02);
    master.gain.value = 0.15 + 1.1 * state.master * state.master;
    const mx = state.mix, lv = state.level;
    // CUE / MASTER: all the way left is cue only, all the way right is master only
    api._phCue.gain.value = Math.cos(mx * Math.PI / 2);
    api._phMaster.gain.value = state.masterCue ? 1 : Math.sin(mx * Math.PI / 2);
    // SPLIT CUE: the cued channels go to the left ear only and the master mix to the right ear only
    api._phCuePan.pan.value = state.split ? -1 : 0; api._phMasterPan.pan.value = state.split ? 1 : 0;
    phonesGain.gain.value = state.plugged ? 1.6 * lv * lv : 0;
    speakerGain.gain.value = state.plugged ? 0 : 1;
    void set;
  }

  // The crossfader curve. Assign 0 = side A (left), 1 = thru, 2 = side B (right).
  // Smooth (curve 0): a gradual blend over the whole travel. Sharp (curve 1): full volume until the very end, then a quick cut (for scratching).
  api.xgain = (assign, x, curve) => {
    if (assign === 1) return 1;
    const t = assign === 0 ? x : 1 - x;                         // how far the fader has moved away from this channel's side
    return curve ? Math.max(0, Math.min(1, (1 - t) / 0.07)) : Math.cos(t * Math.PI / 2);
  };
  // channel: { trim, hi, hm, lm, lo, fader, assign (0 left, 1 thru, 2 right), cue }
  api.channel = (i, p) => {
    if (!ctx || !ch[i]) return;
    const c = ch[i], now = ctx.currentTime, set = (par, v) => par.setTargetAtTime(v, now, 0.015);
    set(c.trim.gain, Math.pow(10, ((p.trim - 0.5) * 24) / 20));
    set(c.lo.gain, eqDb(p.lo)); set(c.lm.gain, eqDb(p.lm)); set(c.hm.gain, eqDb(p.hm)); set(c.hi.gain, eqDb(p.hi));
    set(c.fader.gain, p.fader * p.fader);
    const side = api.xgain(p.assign, state.cross, state.curve);
    set(c.cross.gain, side);
    set(c.cue.gain, p.cue ? 1 : 0);
    const f = p.filter || 0;
    set(c.direct.gain, f ? 0 : 1); set(c.toF[0].gain, f === 1 ? 1 : 0); set(c.toF[1].gain, f === 2 ? 1 : 0);
    // colour knob: 0.5 is flat; left closes a low-pass, right closes a high-pass from the bottom
    const v = p.color == null ? 0.5 : p.color;
    const fx = p.cfx == null ? 5 : p.cfx;                     // 0 space, 1 dub echo, 2 crush, 3 sweep, 4 noise, 5 filter
    const amt = Math.min(1, Math.max(0, (Math.abs(v - 0.5) - 0.03) / 0.47));
    if (fx === 5) {
      set(c.colLp.frequency, v >= 0.47 ? 20000 : 20000 * Math.pow(100 / 20000, (0.47 - v) / 0.47));
      set(c.colHp.frequency, v <= 0.53 ? 20 : 20 * Math.pow(400, (v - 0.53) / 0.47));
    } else { set(c.colLp.frequency, 20000); set(c.colHp.frequency, 20); }
    set(c.gSpace.gain, fx === 0 ? amt * 1.1 : 0);
    set(c.gEcho.gain, fx === 1 ? amt * 0.9 : 0);
    set(c.gCrush.gain, fx === 2 ? amt : 0);
    const sw = fx === 3 ? Math.min(1, amt * 3) : 0;
    set(c.gSweep.gain, sw * 1.6); set(c.cSweep.frequency, 150 * Math.pow(60, v));
    set(c.gNoise.gain, fx === 4 ? amt * 0.35 : 0); set(c.cNoise.frequency, v < 0.5 ? 700 : 6000);
    set(c.cdry.gain, fx === 2 ? 1 - amt : fx === 3 ? 1 - sw : 1);
  };
  // one filter module: { on, type: 'hpf' | 'bpf' | 'lpf', freq (0 to 1), res (0 to 1), lfoOn, lfoDepth (0 to 1), x2, bpm }
  // HPF and BPF start low and climb as the knob is turned up. LPF starts wide open and closes as the knob is turned up.
  api.filter = (k, p) => {
    if (!ctx || !api.fx || !api.fx[k]) return;
    const f = api.fx[k], now = ctx.currentTime, set = (par, v) => par.setTargetAtTime(v, now, 0.02);
    const v = Math.min(1, Math.max(0, p.freq));
    let hz, type;
    let hz2 = 0;
    if (p.type === 'hbp') { type = 'highpass+bandpass'; hz = 20 * Math.pow(8000 / 20, v); hz2 = 100 * Math.pow(8000 / 100, v); }
    else if (p.type === 'hpf') { type = 'highpass'; hz = 20 * Math.pow(8000 / 20, v); }
    else if (p.type === 'bpf') { type = 'bandpass'; hz = 100 * Math.pow(8000 / 100, v); }
    else { type = 'lowpass'; hz = 20000 * Math.pow(80 / 20000, v); }
    if (f.type !== type) { if (type === 'highpass+bandpass') { f.b1.type = 'highpass'; f.b2.type = 'bandpass'; } else { f.b1.type = type; f.b2.type = type === 'bandpass' ? 'allpass' : type; } f.type = type; }
    const q = 0.707 + p.res * (type === 'bandpass' ? 6 : 9);
    set(f.b1.frequency, hz); set(f.b2.frequency, hz2 || hz); set(f.b1.Q, q); set(f.b2.Q, hz2 ? 0.9 + p.res * 5 : 0.707);
    // the LFO sweeps the filter once every two beats of the song that is playing (twice as fast with X2)
    const rate = Math.max(0.2, (p.bpm || BPM) / 60 / 2) * (p.x2 ? 2 : 1);
    set(f.lfo.frequency, rate);
    set(f.depth.gain, p.on && p.lfoOn ? p.lfoDepth * 2400 : 0);     // up to two octaves up and down
    set(f.wet.gain, p.on ? 1 : 0); set(f.dry.gain, p.on ? 0 : 1);
  };
  api.mixer = (p) => { Object.assign(state, p); apply(); };
  // Beat FX: p = { on, effect 0 to 4, beat (seconds), depth 0 to 1, chans [4 booleans], bands [3 booleans] }
  api.beatfx = (p) => {
    const B = api.beatfxNodes; if (!ctx || !B) return;
    const now = ctx.currentTime, set = (par, v) => par.setTargetAtTime(v, now, 0.03);
    ch.forEach((c, i) => set(c.toBeat.gain, p.on && p.chans[i] ? 1 : 0));
    B.bands.forEach((g, i) => set(g.gain, p.bands[i] ? 1 : 0));
    B.sends.forEach((g, k) => set(g.gain, p.effect === k ? 1 : 0));
    const t = Math.min(2, Math.max(0.02, p.beat));
    set(B.delay.delayTime, t);
    set(B.fb.gain, p.effect === 0 ? 0.35 + 0.45 * p.depth : 0.25);
    set(B.flLfo.frequency, Math.max(0.1, 0.5 / Math.max(0.25, p.beat)));
    set(B.gLfo.frequency, Math.max(0.5, 1 / Math.max(0.05, p.beat)));
    set(B.gDepth.gain, 0.5); set(B.gate.gain, 0.5);
    set(B.out.gain, p.on ? (p.effect === 2 ? 1.4 : 0.9) * (0.15 + 0.85 * p.depth) : 0);
  };
  api.seek = (d, t) => { const D = api.slots && api.slots[d]; if (!D) return; D.pos = Math.max(0, D.buffer ? Math.min(D.buffer.duration - 0.2, t) : t); D.ended = false; stopSrc(D); };
  api.loop = (d, lp) => { const D = api.slots && api.slots[d]; if (!D) return; D.loop = lp; if (D.src) { D.src.loop = !!lp; if (lp) { D.src.loopStart = lp.a; D.src.loopEnd = lp.b; } } };
  // the songs: assets/tracks.json lists them (title, tempo, waveform); the mp3 is fetched and decoded when a record is put on a deck
  const cache = new Map();
  api.tracks = null;
  api.tracksReady = fetch('assets/tracks.json').then((r) => r.json()).then((t) => { api.tracks = t; return t; }).catch(() => null);
  async function bufferFor(idx) {
    if (cache.has(idx)) return cache.get(idx);
    const t = (await api.tracksReady) || [];
    const track = t.find((m) => m.id === idx);
    if (!track) return null;
    const p = fetch(track.file).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab));
    cache.set(idx, p);
    return p;
  }
  // put the song of a record on a turntable (null takes it off)
  api.setTrack = (d, id) => {
    const D = api.slots && api.slots[d]; if (!D) return;
    stopSrc(D); D.rec = id; D.buffer = null; D.pos = 0; D.ended = false;
    if (id == null || !ctx) return;
    D.loading = true;
    bufferFor(id).then((b) => { if (D.rec === id) { D.buffer = b; D.loading = false; } });
    if (cache.size > 3) { const keep = new Set(api.slots.map((x) => x.rec)); for (const k of cache.keys()) if (!keep.has(k)) cache.delete(k); }
  };
  function stopSrc(D) {
    if (!D.src) return;
    try { D.src.stop(ctx.currentTime + 0.05); } catch (e) { /* already stopped */ }
    D.src = null;
  }
  // called every frame for each turntable: p = { audible, rate, reset }. Returns the position in the song (seconds).
  api.deck = (d, channel, p) => {
    const D = api.slots && api.slots[d];
    if (!ctx || !D) return 0;
    const now = ctx.currentTime, dt = Math.min(1.5, Math.max(0, now - D.last)); D.last = now;
    const c = ch[channel]; if (!c) return D.pos;
    if (D.src) D.pos += dt * D.src.playbackRate.value;
    if (D.loop && D.pos >= D.loop.b && D.src) D.pos = D.loop.a + ((D.pos - D.loop.b) % Math.max(0.05, D.loop.b - D.loop.a));
    if (p.reset) { D.pos = 0; D.ended = false; }
    const want = p.audible && D.buffer && !D.ended;
    if (want && !D.src) {
      const s = ctx.createBufferSource(); s.buffer = D.buffer; s.connect(c.gate);
      if (D.loop) { s.loop = true; s.loopStart = D.loop.a; s.loopEnd = D.loop.b; }
      s.start(0, Math.min(D.pos, D.buffer.duration - 0.01)); D.src = s;
    } else if (!want && D.src) stopSrc(D);
    if (D.src) D.src.playbackRate.setTargetAtTime(Math.max(0.05, p.rate), now, 0.05);
    c.gate.gain.setTargetAtTime(want ? 1 : 0, now, 0.03);
    if (D.buffer && D.pos >= D.buffer.duration - 0.05) { D.ended = true; stopSrc(D); }
    return D.pos;
  };
  api.slot = (d) => (api.slots ? api.slots[d] : null);
  api.start = async () => { if (!ctx) build(); if (ctx.state === 'suspended') await ctx.resume(); api.on = true; apply(); };
  api.stop = () => { api.on = false; if (ctx && ctx.state === 'running') ctx.suspend(); };
  return api;
}

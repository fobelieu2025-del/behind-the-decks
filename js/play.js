// Behind the Decks: play.js
// Two optional modes for the analog page.
//   PLAY mode : the visitor can turn the knobs, push the buttons, flip the switches and drag the faders
//               of the mixer, and start the turntables. Nothing makes a sound yet; the lights react.
//   DJ mode   : a self-running demo. Both records start, the meters move with a beat, the booth
//               monitors pump and the camera drifts slowly round the setup.
// The two modes are separate switches on purpose, so they can be compared (and merged later).

import { rig } from './models.js';
import { RECORDS } from './records.js';
import { createAudio } from './audio.js';
import { tickDeck, speedFactor, skateIsOff, SKATE_NORMAL, SKATE_MAX, PITCH_GEOM, PITCH_RANGE, ARM_DROP } from './rig.js';

export function createPlay(ctx) {
  const { THREE, scene, canvas, camera, controls, devices, pickMeshes, meshOwner, getState, say, onChange } = ctx;
  const mixer = Object.values(devices).find((d) => d.def && (d.def.build === 'xone' || d.def.build === 'djm')) || null;
  const decks = Object.values(devices).filter((d) => d.deck);              // turntables
  const cdjs = Object.values(devices).filter((d) => d.def && d.def.build === 'cdj');   // media players
  const players = [...decks, ...cdjs];
  const usbDev = devices.usb || null;
  const K = (d) => d.deck || d.cd;                                          // the state of a turntable or a media player
  const monitors = ['monL', 'monR'].map((id) => devices[id]).filter(Boolean);
  const available = !!mixer;

  const api = { available, playOn: false, djOn: false, soundOn: false, audio: null, update() {}, get active() { return this.playOn; } };
  if (!available) return api;

  // Which mixer channel each turntable is plugged into: the left one in channel 2, the right one in channel 3
  const deckChannel = new Map();
  const sorted = players.slice().sort((a, b) => a.holder.position.x - b.holder.position.x);
  sorted.forEach((d, i) => deckChannel.set(d, i === 0 ? 1 : 2));

  rig.controls.forEach((c) => { if (c.type === 'knob') { c.set(0.5); c.init = 0.5; } });   // every mixer knob starts (and resets to) straight up, so the default is easy to recognise
  const faders = rig.controls.filter((c) => c.name === 'xi_fader');           // channels 1 to 4, left to right
  const chMeters = rig.meters.filter((m) => m.name === 'xi_meter');
  const mMeters = rig.meters.filter((m) => m.name === 'xi_mmeter');
  const mix1 = rig.controls.find((c) => c.name === 'xi_mix1');
  const cues = rig.controls.filter((c) => c.name === 'xi_cue' || c.name === 'xi_mcue');
  const byName = (n) => rig.controls.filter((c) => c.name === n);
  const DETENT = new Set(['xi_hi', 'xi_hm', 'xi_lm', 'xi_lo', 'dj_color']);
  const A = { trim: byName('xi_trim'), hi: byName('xi_hi'), hm: byName('xi_hm'), lm: byName('xi_lm'), lo: byName('xi_lo'), cue: byName('xi_cue'), xassign: byName('xi_xassign'), fassign: byName('xi_assign'), color: byName('dj_color') };
  // the two filter modules of the analog mixer: the left one is filter 1, the right one filter 2
  const FM = [0, 1].map((m) => { const pick = (n) => byName(n).filter((c) => (c.x < 330 ? 0 : 1) === m)[0]; return { on: pick('xi_fon'), hpf: pick('xi_hpf'), bpf: pick('xi_bpf'), lpf: pick('xi_lpf'), freq: pick('xi_freq'), res: pick('xi_res'), lfoOn: pick('xi_lfoon'), lfod: pick('xi_lfod'), x2: pick('xi_x2') }; });
  const hasFilters = !!(FM[0].freq && FM[1].freq);
  const xfade = rig.controls.find((c) => c.name === 'xi_xfader');
  rig.controls.filter((c) => c.name === 'xi_fader').forEach((f) => { f.set(0); f.init = 0; });         // every channel fader starts down: the room is silent until one goes up
  const xcurve = rig.controls.find((c) => c.name === 'xi_xcurve'), splitBtn = rig.controls.find((c) => c.name === 'xi_split');
  const cuemix = rig.controls.find((c) => c.name === 'xi_cuemix'), plevel = rig.controls.find((c) => c.name === 'xi_plevel');
  const audio = createAudio();
  api.audio = audio;
  const disp = { ch: [0, 0, 0, 0], l: 0, r: 0 };

  // control -> readable name, taken from the explanation of the part
  const meshControl = new Map();
  [mixer, ...cdjs].forEach((dv) => {
    const R = dv === mixer ? rig : dv.model.userData.rig;
    R.controls.forEach((c) => { c.R = R; c.dev = dv; c.objs.forEach((o) => o.traverse((m) => { if (m.isMesh) meshControl.set(m, c); })); });
  });
  const partDefOf = (c) => {
    const dv = c.dev || mixer;
    let f = null; c.objs[0].traverse((m) => { if (m.isMesh && !f) f = m; });
    const id = dv.meshPart.get(f);
    return id ? dv.parts[id].def : null;
  };
  const firstSentence = (t) => { const m = /^.*?[.!?](\s|$)/.exec(t || ''); return m ? m[0].trim() : (t || ''); };
  const nameOf = (c) => {
    const dv = c.dev || mixer;
    let f = null; c.objs[0].traverse((m) => { if (m.isMesh && !f) f = m; });
    const part = dv.meshPart.get(f);
    return part ? dv.parts[part].def.name : 'Control';
  };


  /* ---------- the media players (digital page) ---------- */
  cdjs.forEach((dv) => {
    const R = dv.model.userData.rig, ctl = (n) => R.controls.filter((c) => c.name === n);
    dv.cd = {
      dev: dv, R, record: null, on: false, leverUp: false, skipping: false, liftAngle: ARM_DROP, spin: 0, songPos: 0, trackDur: 0,
      playing: false, factor: 1, usb: false, sel: 0, shown: null, lastDraw: 0, resetNext: false,
      browse: ctl('cj_browse')[0], tempo: ctl('cj_tempo')[0], play: ctl('cj_play')[0], jog: R.controls.find((c) => c.type === 'jog'),
      takeReset() { const r = this.resetNext; this.resetNext = false; return r; }
    };
  });
  const waveCache = new Map();
  function infoFor(idx) {
    const rec = RECORDS[idx], t = audio.tracks && audio.tracks.find((x) => x.id === rec.id);
    let wave = null;
    if (t && t.wave) { wave = waveCache.get(t.id); if (!wave) { const bin = atob(t.wave); wave = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) wave[i] = bin.charCodeAt(i); waveCache.set(t.id, wave); } }
    return { title: rec.title, artist: rec.artist, dur: t ? t.duration : 0, bpm: t ? t.bpm : 0, baseBpm: t ? t.bpm : 0, firstBeat: t ? t.firstBeat : 0, barBeat: t ? (t.barBeat || 0) : 0, wave, fps: t ? t.fps : 60 };
  }
  cdjs.forEach((dv) => Object.assign(dv.cd, { cue: 0, hot: Array(8).fill(null), mem: [], loop: null, slip: false, slipRef: null, quant: false, sync: false, master: false, delArmed: false, span: 0.12, rangeIdx: 0 }));

  /* ---------- the media players' buttons: cue, hot cues, loops, slip, quantize, sync, master, range, search ---------- */
  const slotIdx = (dv) => sorted.indexOf(dv);
  const trackOf = (cd) => (audio.tracks && cd.record != null ? audio.tracks.find((x) => x.id === RECORDS[cd.record].id) : null);
  const beatLen = (cd) => { const t = trackOf(cd); return 60 / (t && t.bpm ? t.bpm : 120); };
  const lamp = (c, on) => { if (c && c.on !== on) c.toggle(); };
  const firstBeat = (cd) => { const t = trackOf(cd); return t && t.firstBeat ? t.firstBeat : 0; };
  const snapT = (cd, t) => { if (!cd.quant) return t; const bl = beatLen(cd), fb = firstBeat(cd); return Math.max(0, fb + Math.round((t - fb) / bl) * bl); };
  const loopBtn = (cd, i) => cd.R.controls.filter((x) => x.name === 'cj_loop')[i];
  const padBtn = (cd, i) => cd.R.controls.filter((x) => x.name === 'cj_pad')[i];
  const cdAll = (cd, n) => cd.R.controls.filter((x) => x.name === n);
  const seekTo = (cd, t) => { const d = trackOf(cd); const tt = Math.max(0, Math.min(d ? d.duration - 0.3 : t, t)); audio.seek(slotIdx(cd.dev), tt); cd.songPos = tt; };
  function applyLoop(cd) {
    const lp = cd.loop;
    audio.loop(slotIdx(cd.dev), lp && lp.active && lp.b != null ? { a: lp.a, b: lp.b } : null);
    lamp(loopBtn(cd, 0), !!lp);
    lamp(loopBtn(cd, 1), !!(lp && lp.b != null));
    lamp(loopBtn(cd, 2), !!(lp && lp.active));
  }
  function exitLoop(cd) {
    if (!cd.loop || !cd.loop.active) return;
    cd.loop.active = false; applyLoop(cd);
    if (cd.slip && cd.slipRef) { seekTo(cd, cd.slipRef.pos + (performance.now() - cd.slipRef.t) / 1000 * cd.factor); cd.slipRef = null; say('Slip: the song carries on from where it would have been, as if the loop had never happened.'); }
  }
  function startLoop(cd, a, b) {
    cd.loop = { a, b, active: true };
    if (cd.slip) cd.slipRef = { pos: cd.songPos, t: performance.now() };
    applyLoop(cd);
  }
  function resetCdState(cd) {
    cd.cue = 0; cd.hot.fill(null); cd.mem.length = 0; cd.loop = null; cd.slipRef = null; cd.delArmed = false;
    audio.loop(slotIdx(cd.dev), null);
    cd.R.controls.forEach((x) => { if (x.name === 'cj_pad' || x.name === 'cj_loop' || x.name === 'cj_delete') lamp(x, false); });
  }
  function loadSong(cd, idx) {
    resetCdState(cd);
    cd.record = idx; cd.on = false; cd.resetNext = true; cd.shown = null;
    say(`“${RECORDS[idx].title}” loaded. Press play when the beat is where you want it.`);
  }
  const RANGES = [0.06, 0.10, 0.16];
  function cdExtra(c, cd, n, release) {
    const idx = cdAll(cd, n).indexOf(c), loaded = cd.record != null;
    const need = () => { if (!loaded) { say('Load a song first: plug in the USB drive, turn the rotary selector and press it.'); release(); return false; } return true; };
    if (n === 'cj_pad') {
      if (!need()) { lamp(c, false); return true; }
      const name = 'ABCDEFGH'[idx];
      if (cd.delArmed) { cd.hot[idx] = null; lamp(c, false); cdAll(cd, 'cj_delete').forEach((d) => lamp(d, false)); cd.delArmed = false; say(`Hot cue ${name} deleted.`); return true; }
      if (cd.hot[idx] == null) { cd.hot[idx] = snapT(cd, cd.songPos); lamp(c, true); say(`Hot cue ${name} stored at this point of the song. Press it again any time to jump back here.`); }
      else { seekTo(cd, cd.hot[idx]); lamp(c, true); say(`Jumped to hot cue ${name}.`); }
      return true;
    }
    if (n === 'cj_delete') {
      cd.delArmed = c.on; cdAll(cd, 'cj_delete').forEach((d) => lamp(d, cd.delArmed));
      say(cd.delArmed ? 'Delete is armed: press a hot cue pad to erase it. Press delete again to cancel.' : 'Delete cancelled.');
      return true;
    }
    if (n === 'cj_loop') {
      if (!need()) return true;
      const bl = beatLen(cd);
      if (idx === 0) { cd.loop = { a: snapT(cd, cd.songPos), b: null, active: false }; applyLoop(cd); say('Loop in point set. Press OUT at the end of the part you want to repeat.'); }
      else if (idx === 1) {
        if (!cd.loop || cd.loop.b != null && cd.loop.active) { cd.loop = { a: snapT(cd, cd.songPos), b: null, active: false }; }
        if (cd.loop.b == null) { let b = snapT(cd, cd.songPos); if (b - cd.loop.a < 0.05) b = cd.loop.a + bl; startLoop(cd, cd.loop.a, b); say('Looping. The part between IN and OUT repeats until you press RELOOP/EXIT.'); }
      }
      else if (idx === 2) {
        if (cd.loop && cd.loop.active) { exitLoop(cd); say('Loop released: the song carries on.'); }
        else if (cd.loop && cd.loop.b != null) { cd.loop.active = true; applyLoop(cd); seekTo(cd, cd.loop.a); say('Reloop: back into the last loop.'); }
        else say('No loop stored yet. Press IN and OUT, or one of the beat loop buttons.');
      }
      else if (idx === 3 || idx === 4) { const beats = idx === 3 ? 4 : 8; release(); startLoop(cd, snapT(cd, cd.songPos), snapT(cd, cd.songPos) + beats * bl); say(`${beats}-beat loop started.`); }
      else if (idx === 5 || idx === 6) {
        release();
        if (!cd.loop || cd.loop.b == null) { say('There is no loop to change. Start one first.'); return true; }
        const len = (cd.loop.b - cd.loop.a) * (idx === 5 ? 0.5 : 2);
        cd.loop.b = cd.loop.a + Math.max(bl / 16, len); cd.loop.active = true; applyLoop(cd);
        say(idx === 5 ? 'Loop halved: it repeats twice as fast.' : 'Loop doubled: it repeats half as fast.');
      }
      return true;
    }
    if (n === 'cj_memory') { release(); if (!need()) return true; if (cd.mem.length < 10) cd.mem.push(snapT(cd, cd.songPos)); say(`Memory point stored (${cd.mem.length}). Use the call arrows to jump between stored points.`); return true; }
    if (n === 'cj_call') {
      release(); if (!need()) return true;
      const pts = [...cd.mem, ...cd.hot.filter((x) => x != null)].sort((a, b) => a - b);
      if (!pts.length) { say('No stored points yet. Press MEMORY or a hot cue pad first.'); return true; }
      const t = cd.songPos, to = idx === 0 ? pts.filter((p) => p < t - 0.4).pop() : pts.find((p) => p > t + 0.4);
      if (to == null) say('There is no stored point in that direction.'); else { seekTo(cd, to); say('Jumped to a stored point.'); }
      return true;
    }
    if (n === 'cj_slip') { cd.slip = c.on; say(c.on ? 'Slip on: if you loop or scratch, the song keeps running underneath and carries on from where it would have been.' : 'Slip off.'); return true; }
    if (n === 'cj_quantize') { cd.quant = c.on; say(c.on ? 'Quantize on: cue points and loops snap to the beat.' : 'Quantize off.'); return true; }
    if (n === 'cj_sync') {
      cd.sync = c.on;
      if (c.on) { const m = masterCd(); if (!m || m === cd || !trackOf(m) || !trackOf(cd)) { say('Sync is on. It matches this song to the master player as soon as a second song is playing.'); } else say('Sync on: this song now follows the master player’s tempo.'); }
      else say('Sync off: the tempo slider is yours again.');
      return true;
    }
    if (n === 'cj_master') {
      if (!c.on) { lamp(c, true); say('This player stays the master until it stops or is faded out. To hand over sooner, press MASTER on the other player.'); return true; }
      if (c.on) { cdjs.forEach((o) => { o.cd.master = o === cd.dev; if (o !== cd.dev) lamp(cdAll(o.cd, 'cj_master')[0], false); }); say('This player is the master: the other player’s SYNC follows its tempo.'); }
      else { cd.master = false; say('Master off.'); }
      return true;
    }
    if (n === 'cj_range') {
      cd.rangeIdx = (cd.rangeIdx + 1) % RANGES.length; cd.span = RANGES[cd.rangeIdx] * 2; release();
      say(`Tempo range: plus or minus ${Math.round(RANGES[cd.rangeIdx] * 100)} percent. ${cd.rangeIdx === 0 ? 'This is the default, and the most precise: the slider moves the speed in small steps.' : 'A wider range changes the speed faster, but is less precise.'}`);
      return true;
    }
    if (n === 'cj_temporeset') { release(); cd.tempo.set(0.5); cd.sync = false; lamp(cdAll(cd, 'cj_sync')[0], false); say('Tempo back to the original speed of the song.'); return true; }
    if (n === 'cj_jogmode') { cdAll(cd, 'cj_jogmode').forEach((o) => lamp(o, o === c)); say(idx === 0 ? 'Vinyl mode: the jog wheel would act like a record under your hand.' : 'CDJ mode: the jog wheel only nudges the speed.'); return true; }
    if (n === 'cj_tsearch') {
      release(); if (!usbReady()) { say('No drive plugged in.'); return true; }
      if (!loaded) { say('Load a song first.'); return true; }
      if (idx === 0) { if (cd.songPos > 2) { seekTo(cd, 0); say('Back to the start of the song.'); } else loadSong(cd, (cd.record + RECORDS.length - 1) % RECORDS.length); }
      else loadSong(cd, (cd.record + 1) % RECORDS.length);
      return true;
    }
    if (n === 'cj_search') { release(); if (!need()) return true; seekTo(cd, cd.songPos + (idx === 0 ? -8 : 8)); say(idx === 0 ? 'Searched backwards.' : 'Searched forwards.'); return true; }
    return false;
  }
  const masterCd = () => { const m = cdjs.find((o) => o.cd.master); if (m) return m; return cdjs.find((o) => o.cd.playing) || null; };
  // The first player to start playing becomes the master. When it stops, runs out or is faded out while the other one is playing, the other takes over.
  function autoMaster() {
    const live = cdjs.filter((o) => o.cd.record != null && o.cd.playing);
    const audible = (o) => { const f = faders[deckChannel.get(o)]; return !f || f.value > 0.05; };
    const m = cdjs.find((o) => o.cd.master);
    const setM = (o) => cdjs.forEach((x) => { x.cd.master = x === o; const b = cdAll(x.cd, 'cj_master')[0]; if (b && b.on !== (x === o)) lamp(b, x === o); });
    if (m) {
      const gone = !live.includes(m) || (!audible(m) && live.some((o) => o !== m && audible(o)));
      const next = live.find((o) => o !== m && audible(o)) || live.find((o) => o !== m);
      if (gone && next) setM(next);
    } else if (live.length) setM(live.find(audible) || live[0]);
  }
  function tickCdjExtra(dv) {
    const cd = dv.cd;
    cdAll(cd, 'cj_loop').forEach((o) => { if (!o.on) lamp(o, true); });          // the loop buttons are always lit; they never light up when pressed
    if (cd.sync) {
      const m = masterCd();
      if (m && m !== dv && trackOf(m) && trackOf(cd) && m.cd.record != null) {
        const want = (trackOf(m).bpm * m.cd.factor) / trackOf(cd).bpm;
        cd.tempo.set(Math.max(0, Math.min(1, 0.5 - (want - 1) / cd.span)));
      }
    }
  }

  function tickCdj(dv, dt) {
    const cd = dv.cd, scr = cd.R.screen, base = 100 / 3 / 60;
    const tv = cd.tempo.value;
    tickCdjExtra(dv);
    cd.factor = 1 - (cd.tempo.value - 0.5) * cd.span;       // pulled down = faster, pushed up = slower, like the real slider
    cd.spin = cd.on && cd.record != null ? base * cd.factor : 0;
    cd.playing = cd.spin > 0;
    if (cd.play && cd.play.on !== cd.playing) cd.play.toggle();
    const n = RECORDS.length;
    cd.sel = Math.round(cd.browse.value * (n - 1));
    const want = cd.record != null ? 'track' + cd.record : usbReady() ? 'list' + cd.sel : 'none';
    if (want !== cd.shown) {
      cd.shown = want;
      if (cd.record != null) scr.set(infoFor(cd.record));
      else if (usbReady()) scr.setList(RECORDS.map((r) => r.title), cd.sel);
      else scr.set(null);
    }
    cd.lastDraw += dt;
    if (cd.record != null && cd.lastDraw > 0.1) {
      cd.lastDraw = 0;
      if (scr.state.info) { scr.state.info.bpm = scr.state.info.baseBpm * cd.factor; if (!scr.state.info.wave) { const f = infoFor(cd.record); if (f.wave) scr.state.info = f; } }
      scr.tick(cd.songPos);
    }
  }
  const slotWorld = (dv) => { const R = dv.cd.R; return dv.model.localToWorld(new THREE.Vector3(R.WX(R.usbSlot.x), 0, R.WZ(R.usbSlot.y))); };
  const usb = { dev: usbDev, drag: null, at: null, anim: null, home: usbDev ? { pos: usbDev.holder.position.clone(), rotY: usbDev.holder.rotation.y } : null, over: null };
  // the height of the top of a media player at its USB slot, found once by looking straight down at it
  const topRay = new THREE.Raycaster();
  function slotTop(dv) {
    if (dv.cd.top != null) return dv.cd.top;
    const s = slotWorld(dv), ms = [];
    dv.model.updateWorldMatrix(true, true);
    dv.model.traverse((o) => { if (o.isMesh) ms.push(o); });
    topRay.set(new THREE.Vector3(s.x, 6, s.z), new THREE.Vector3(0, -1, 0));
    const hit = topRay.intersectObjects(ms, false)[0];
    dv.cd.top = hit ? hit.point.y : 0.5;
    return dv.cd.top;
  }
  const USB_TIP = 0.3;                                          // the metal plug reaches this far below the drive's origin
  const qHome = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, usb.home.rotY, 0));
  const qUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 2));   // standing upright, plug pointing down
  function usbPose(dv) { const s = slotWorld(dv); return { pos: new THREE.Vector3(s.x, slotTop(dv) + USB_TIP + 0.01, s.z), rot: new THREE.Euler(0, Math.PI / 2, Math.PI / 2) }; }
  // while the drive is being used it is drawn in front of the controllers, so it is never hidden behind a knob or a screen
  function usbOnTop(on) {
    if (!usb.dev) return;
    usb.dev.holder.traverse((o) => { if (o.isMesh) { o.renderOrder = on ? 50 : 0; [].concat(o.material).forEach((m) => { m.depthTest = !on; m.needsUpdate = true; }); } });
  }
  function usbNearest(px, pz) {
    let best = null, bd = 1e9;
    cdjs.forEach((dv) => { const s = slotWorld(dv); const d = Math.hypot(s.x - px, s.z - pz); if (d < bd) { bd = d; best = dv; } });
    return { best, bd };
  }
  function usbMove(pos, rot, instant, via) {
    const h = usb.dev.holder;
    if (instant) { h.position.copy(pos); h.rotation.copy(rot); usb.anim = null; return; }
    usb.anim = { t: 0, dur: 0.45, p0: h.position.clone(), p1: pos, q0: new THREE.Quaternion().setFromEuler(h.rotation), q1: new THREE.Quaternion().setFromEuler(rot), via: via || null };
  }
  // the two players are joined by a link cable, so a drive in either one can be browsed from both
  const usbReady = () => cdjs.some((o) => o.cd.usb);
  function unloadAll() { cdjs.forEach((o) => { o.cd.record = null; o.cd.on = false; o.cd.shown = null; o.cd.resetNext = true; resetCdState(o.cd); }); }
  // The drive comes out while a song is playing: like the real thing, the player keeps going in an EMERGENCY LOOP of 16 bars
  // (the next 16 bars from this moment) instead of stopping dead. A player that was not playing simply unloads.
  function pullDrive() {
    let any = false;
    cdjs.forEach((o) => {
      const cd = o.cd;
      if (cd.record != null && cd.playing) {
        any = true;
        const bl = beatLen(cd), slot = audio.slot(slotIdx(cd.dev)), len = slot && slot.buffer ? slot.buffer.duration : Infinity;
        const a = Math.max(0, Math.min(cd.songPos, len - 64 * bl - 0.5));
        cd.loop = { a, b: Math.min(len - 0.3, a + 64 * bl), active: true }; cd.emergency = true; applyLoop(cd);
      } else { cd.record = null; cd.on = false; cd.shown = null; cd.resetNext = true; resetCdState(cd); }
    });
    return any;
  }
  function ejectUsb(cd, quiet) {
    const wasHere = usb.at === cd.dev;
    if (wasHere && usb.dev) {
      cd.usb = false; const emergency = quiet ? (unloadAll(), false) : pullDrive(); usb.at = null; usbOnTop(true);
      const h = usb.dev.holder, up = new THREE.Vector3(h.position.x, h.position.y + 0.7, h.position.z);
      usbMove(new THREE.Vector3(usb.home.pos.x, 0, usb.home.pos.z), new THREE.Euler(0, usb.home.rotY, 0), false, up);
      if (usb.anim) usb.anim.dur = 0.9;
      if (!quiet) say(emergency ? 'The drive came out while a song was playing, so the player goes into an emergency loop of 16 bars. Put the drive back to carry on.' : 'The song is unloaded and the USB drive comes out.');
      return;
    }
    cd.record = null; cd.on = false; cd.shown = null; cd.resetNext = true;
    if (!quiet) say(usbReady() ? 'The song is unloaded from this player. The drive stays in the other player; eject there to take it out.' : 'There is no drive in the players.');
  }
  function cdPress(c) {
    const cd = c.dev.cd, n = c.name;
    const release = () => setTimeout(() => { if (c.on) c.toggle(); }, 180);
    if (n === 'cj_play') {
      if (cd.record == null) { say(usbReady() ? 'No song loaded yet. Turn the rotary selector to choose a song, then press it.' : 'No song loaded. Drag the USB drive onto this player first.'); if (c.on !== cd.playing) c.toggle(); return; }
      cd.on = !cd.on;
      say(cd.on ? 'Playing. Raise the channel fader on the mixer, and turn Sound on, to hear it.' : 'Paused. The song keeps its place.');
      return;
    }
    if (n === 'cj_cue') {
      release();
      if (cd.record == null) { say('No song loaded.'); return; }
      if (cd.on || Math.abs(cd.songPos - cd.cue) > 0.25) {
        if (cd.on) { cd.on = false; seekTo(cd, cd.cue); say('Back to the cue point, paused. Press play to start again from there.'); return; }
        cd.cue = snapT(cd, cd.songPos); say('Cue point set here. Next time you press CUE while playing, the song jumps back to this spot.'); return;
      }
      say('Already at the cue point. Press play to start from here.');
      return;
    }
    if (n === 'cj_browse') {
      if (cd.record != null) {                 // back to the song list, to choose a different song
        const was = cd.record, n = RECORDS.length;
        resetCdState(cd); cd.on = false; cd.record = null; cd.shown = null; cd.resetNext = true;
        if (cd.browse && n > 1) cd.browse.set(was / (n - 1));
        say('Back to the song list. Turn the selector to choose a different song, then press it to load it.');
        return;
      }
      if (!usbReady()) { say('No drive plugged in. Drag the USB drive onto either player.'); return; }
      loadSong(cd, cd.sel);
      return;
    }
    if (n === 'cj_eject') { release(); ejectUsb(cd); return; }
    if (cdExtra(c, cd, n, release)) return;
    say(describe(c));
  }
  function usbAt(e) {
    const st = getState();
    if (!usb.dev || !cdjs.length || !api.playOn || st.explaining || st.state === 'part') return false;
    setRay(e);
    const first = ray.intersectObjects(pickMeshes, false)[0];
    if (first && meshOwner.get(first.object) === usb.dev.id) return true;
    if (usb.at) return false;                       // when it is plugged in, only the drive itself counts, so nearby buttons stay easy to press
    const p = new THREE.Vector3();
    const c = usb.dev.holder.position;
    return !!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2), p) && Math.hypot(p.x - c.x + 0.3 * Math.cos(usb.dev.holder.rotation.y), p.z - c.z - 0.3 * Math.sin(usb.dev.holder.rotation.y)) < 0.3 && !(first && meshOwner.get(first.object) !== usb.dev.id && first.point.y > 0.9);
  }

  /* ---------- pointer handling ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();

  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }

  // What is under the pointer, if it is something the visitor can play with
  function target(e) {
    const st = getState();
    if (!api.playOn || st.explaining || st.state === 'part') return null;   // while learning, a click explains
    setRay(e);
    const hits = ray.intersectObjects(pickMeshes, false);
    if (!hits.length) return null;
    const m = hits[0].object;
    const dev = devices[meshOwner.get(m)];
    if (!dev) return null;
    { const c = meshControl.get(m); if (c) return { kind: 'mixer', c, name: nameOf(c) }; if (dev === mixer || dev.cd) return null; }
    if (dev.deck) {
      const dk = dev.deck, part = dev.meshPart.get(m);
      if (part === 'power') return { kind: 'deck', dev, act: 'power', name: dk.powerOn ? 'Power: on' : 'Power: off', how: 'Click to turn' };
      if (part === 'startstop') return { kind: 'deck', dev, act: 'start', name: dk.on ? 'Stop the turntable' : 'Start the turntable', how: 'Click' };
      if (part === 'cue') return { kind: 'deck', dev, act: 'lever', name: 'Cueing lever', how: dk.leverUp ? 'Click to lower the arm' : 'Click to lift the arm' };
      if (part === 'speed') { const is33 = m.name.startsWith('polySurface13'); return { kind: 'deck', dev, act: is33 ? '33' : '45', name: is33 ? '33 rpm' : '45 rpm', how: 'Click' }; }
      if (part === 'light') return { kind: 'deck', dev, act: 'lamp', name: 'Target light', how: dk.lampUp ? 'Click to push it down' : 'Click to pop it up' };
      if (part === 'pitch') return { kind: 'deck', dev, act: 'pitch', name: 'Pitch fader', how: 'Drag to slide', drag: true };
      if (part === 'antiskate') return { kind: 'deck', dev, act: 'skate', name: 'Anti-skating dial', how: 'Drag to turn · double-click to reset', drag: true };
    }
    return null;
  }

  /* ---------- the records: take one out of the bag, carry it, put it on a turntable ---------- */
  const bagDev = Object.values(devices).find((d) => d.def && d.def.build === 'bag') || null;
  const records = [];
  if (bagDev) bagDev.meshes.forEach((m) => { if (m.userData.record != null) records[m.userData.record] = { mesh: m, idx: m.userData.record, root: m.parent, where: 'bag' }; });
  const recMeshes = records.map((r) => r.mesh);
  // The order of the records in the bag, front to back. Taking one out closes the gap; a record that comes
  // back always goes to the back of the bag, like the back of a queue.
  const queue = records.map((r) => r.idx);
  const BAG_LIFTS = [0.0, 0.08, -0.04, 0.12, 0.02, -0.02, 0.06];
  const slotPos = (k) => new THREE.Vector3(0, 1.62 + (BAG_LIFTS[k] || 0), 0.1 - k * 0.1);
  function layoutBag() {
    queue.forEach((idx, k) => { records[idx].mesh.userData.home.pos.copy(slotPos(k)); });
  }
  const leaveQueue = (rec) => { const k = queue.indexOf(rec.idx); if (k >= 0) { queue.splice(k, 1); layoutBag(); } };
  const joinQueue = (rec) => { if (!queue.includes(rec.idx)) { queue.push(rec.idx); layoutBag(); } };
  const REC_FLAT = 13.9;                                     // a record is 20 units wide in the turntable model, 1.4 across in the bag
  const Y_AXIS_UP = new THREE.Quaternion();                  // flat
  const Y_UPRIGHT = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));   // standing, like in the bag
  const tweens = [];
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const tmpV = new THREE.Vector3();

  function fly(rec, pos, quat, scale, dur, done, via) {
    const m = rec.mesh;
    scene.attach(m);
    const from = { p: m.position.clone(), q: m.quaternion.clone(), s: m.scale.x };
    rec.where = 'fly';
    tweens.push({ m, from, to: { p: pos, q: quat, s: scale }, t: 0, dur, done, via });
  }
  function homeOf(rec) {
    const h = rec.mesh.userData.home;
    const wp = rec.root.localToWorld(h.pos.clone());
    const wq = rec.root.getWorldQuaternion(new THREE.Quaternion()).multiply(h.quat);
    return { p: wp, q: wq, s: rec.root.getWorldScale(tmpV).x };
  }
  function sendHome(rec, instant) {
    decks.forEach((d) => { if (d.deck.record === rec.idx) d.deck.record = null; });
    joinQueue(rec);                                          // back of the queue
    const h = homeOf(rec);
    const finish = () => { rec.root.attach(rec.mesh); rec.mesh.position.copy(rec.mesh.userData.home.pos); rec.mesh.quaternion.copy(rec.mesh.userData.home.quat); rec.mesh.scale.set(1, 1, 1); rec.where = 'bag'; };
    if (instant) { tweens.splice(0, tweens.length, ...tweens.filter((t) => t.m !== rec.mesh)); finish(); } else { const above = h.p.clone(); above.y += 2.1 * h.s; fly(rec, h.p, h.q, h.s, 1.0, finish, above); }   // over the bag, then down into its slot
  }
  function landOn(rec, dev, instant, done) {
    const dk = dev.deck;
    if (dk.record != null && dk.record !== rec.idx) sendHome(records[dk.record], instant);
    decks.forEach((d) => { if (d.deck.record === rec.idx) d.deck.record = null; });
    dk.record = rec.idx;
    const top = dk.platter.localToWorld(new THREE.Vector3(0, 17.05, 0));
    const wq = dk.platter.getWorldQuaternion(new THREE.Quaternion());
    const ws = dk.platter.getWorldScale(tmpV).x * REC_FLAT;
    const finish = () => { dk.platter.attach(rec.mesh); rec.mesh.position.set(0, 17.05, 0); rec.mesh.quaternion.identity(); rec.mesh.scale.setScalar(REC_FLAT); rec.where = dev.id; if (done) done(); };
    if (instant) finish(); else fly(rec, top, wq, ws, 0.5, finish);
  }
  const platterCentre = (dev) => dev.deck.platter.getWorldPosition(new THREE.Vector3());
  function nearestDeck(x, z) {
    let best = null, bd = Infinity;
    decks.forEach((d) => { const c = platterCentre(d); const dd = Math.hypot(c.x - x, c.z - z); if (dd < bd) { bd = dd; best = d; } });
    return { dev: best, dist: bd };
  }

  /* ---------- the headphones: drag them to the jack on the mixer to plug them in ---------- */
  const phonesDev = devices.headphones || null;
  const hp = { dev: phonesDev, plugged: false, drag: null, cable: null, last: null };
  const jackWorld = () => { const j = rig.jack || { x: 571, y: 625 }; return rig.root.localToWorld(new THREE.Vector3(rig.WX(j.x), 0.05, rig.WZ(j.y))); };
  if (phonesDev) { hp.home = { pos: phonesDev.holder.position.clone(), rotY: phonesDev.holder.rotation.y }; }
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.6 });
  // the 6.3 mm plug stands in the socket on the mixer: a steel tip pushed down into it, a black body above
  const plugMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.45, metalness: 0.25 });
  const plugSteel = new THREE.MeshStandardMaterial({ color: 0xc4c8d0, roughness: 0.25, metalness: 1 });
  function makePlug() {
    const g = new THREE.Group(), sc = 0.65 * (rig.root.getWorldScale(new THREE.Vector3()).x || 1);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * sc, 0.03 * sc, 0.1 * sc, 16), plugSteel);
    tip.position.y = 0.05 * sc;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * sc, 0.05 * sc, 0.2 * sc, 18), plugSteel);
    sleeve.position.y = 0.2 * sc;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * sc, 0.06 * sc, 0.3 * sc, 18), plugMat);
    body.position.y = 0.45 * sc;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * sc, 0.055 * sc, 0.16 * sc, 12), plugMat);
    neck.position.y = 0.68 * sc;
    g.add(tip, sleeve, body, neck);
    g.traverse((o) => { o.userData.noPick = true; o.castShadow = true; });
    g.userData.top = 0.76 * sc;
    return g;
  }
  function drawCable() {
    if (!hp.dev) return;
    const j = jackWorld(), h = hp.dev.holder.position;
    const key = `${h.x.toFixed(3)},${h.z.toFixed(3)}`;
    if (hp.last === key && hp.cable) return;
    hp.last = key;
    if (!hp.plug) { hp.plug = makePlug(); scene.add(hp.plug); }
    const sc = rig.root.getWorldScale(new THREE.Vector3()).x || 1;
    hp.plug.position.set(j.x, j.y - 0.04 * sc, j.z);                    // pushed down into the socket
    const top = j.clone(); top.y = j.y - 0.04 * sc + hp.plug.userData.top;
    const end = new THREE.Vector3(h.x, 0.12, h.z);
    // The cable never goes through the mixer: it rises from the plug, lies over the panel to the front edge, hangs down over it,
    // runs along the table in front of the equipment and ends at the headphones.
    if (!hp.fronts) {
      hp.fronts = { mix: new THREE.Box3().setFromObject(mixer.holder) };
      const all = new THREE.Box3(); [mixer, ...players].forEach((d) => all.union(new THREE.Box3().setFromObject(d.holder)));
      hp.fronts.all = all;
    }
    const mb = hp.fronts.mix, ab = hp.fronts.all;
    const lift = mb.max.y + 0.05;                                         // just above the tallest knob
    const dropZ = mb.max.z + 0.12, runZ = ab.max.z + 0.35, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const pts = [top.clone(), V(j.x, top.y + 0.1 * sc, j.z + 0.02), V(j.x, lift, j.z + (dropZ - j.z) * 0.35), V(j.x, lift, mb.max.z - 0.02), V(j.x, lift - 0.12, dropZ), V(j.x, 0.05, dropZ + 0.1), V(j.x, 0.03, Math.max(dropZ + 0.2, runZ - 0.2)), V(j.x + 0.25, 0.03, runZ)];
    const lastX = Math.max(j.x + 0.5, end.x);
    if (lastX > j.x + 0.5) pts.push(V(j.x + (lastX - j.x) * 0.5, 0.03, runZ));
    if (Math.abs(h.x - pts[pts.length - 1].x) > 0.3) pts.push(V(h.x, 0.03, runZ));
    pts.push(end);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    if (hp.cable) { scene.remove(hp.cable); hp.cable.geometry.dispose(); }
    hp.cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.018, 6, false), cableMat);
    hp.cable.userData.noPick = true; scene.add(hp.cable);
  }
  function setPlugged(on) {
    hp.plugged = on;
    if (!on && hp.cable) { scene.remove(hp.cable); hp.cable.geometry.dispose(); hp.cable = null; hp.last = null; }
    if (!on && hp.plug) { scene.remove(hp.plug); hp.plug = null; }
    audio.mixer({ plugged: on });
  }
  function phonesAt(e) {
    const st = getState();
    if (!hp.dev || !api.playOn || st.explaining || st.state === 'part') return false;
    setRay(e);
    // the headphones are thin, so count a drag that starts close to them (seen from above) as touching them
    const first = ray.intersectObjects(pickMeshes, false)[0];
    if (first && meshOwner.get(first.object) === hp.dev.id) return true;
    const c = hp.dev.holder.position, p = new THREE.Vector3();
    if (first && meshOwner.get(first.object) !== hp.dev.id && first.object.userData.record == null && first.distance < 0) return false;
    return !!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), p) && Math.hypot(p.x - c.x, p.z - c.z) < 0.55 && !(first && meshOwner.get(first.object) !== hp.dev.id && first.point.y > 0.9);
  }
  function plugTween(to) {
    const h = hp.dev.holder, from = h.position.clone();
    tweens.push({ m: { position: h.position, quaternion: new THREE.Quaternion(), scale: { setScalar() {} }, isFake: true }, from: { p: from, q: new THREE.Quaternion(), s: 1 }, to: { p: to, q: new THREE.Quaternion(), s: 1 }, t: 0, dur: 0.5, done: null, fake: true });
  }

  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.15);
  const dragPt = new THREE.Vector3();
  let rdrag = null;

  function recordAt(e) {
    const st = getState();
    if (!records.length || !api.playOn || st.explaining || st.state === 'part') return null;
    setRay(e);
    const hit = ray.intersectObjects(pickMeshes, false)[0];
    return hit && hit.object.userData.record != null ? records[hit.object.userData.record] : null;
  }
  function moveRecord(e) {
    setRay(e);
    if (!ray.ray.intersectPlane(dragPlane, dragPt)) return;
    const { dev, dist } = nearestDeck(dragPt.x, dragPt.z);
    const t = dev ? smooth(3.6, 1.1, dist) : 0;                 // the closer to a turntable, the flatter the record lies
    const m = rdrag.rec.mesh;
    const topY = dev ? platterCentre(dev).y + 17.05 * dev.deck.platter.getWorldScale(tmpV).x : 1.2;
    // leaving the bag: the record first slides straight up out of its slot, then travels out over the front of the bag
    const o = rdrag.origin, sB = rdrag.s;
    if (!rdrag.off) rdrag.off = { x: dragPt.x - o.x, z: dragPt.z - o.z };
    const px = dragPt.x - rdrag.off.x, pz = dragPt.z - rdrag.off.z, dd = Math.hypot(px - o.x, pz - o.z);
    const lift = smooth(0, 0.9 * sB, dd), out = smooth(0.5 * sB, 2.6 * sB, dd), settle = smooth(2.2 * sB, 4.6 * sB, dd);
    const bx = o.x + (dragPt.x - o.x) * out, bz = o.z + (dragPt.z - o.z) * out;
    const by = (o.y + 2.1 * sB * lift) * (1 - settle) + 1.9 * settle;
    m.position.set(bx, by + (topY + 0.12 - by) * t, bz);
    m.quaternion.slerpQuaternions(Y_UPRIGHT, Y_AXIS_UP, t);
    m.scale.setScalar(1 + (dev ? (dev.deck.platter.getWorldScale(tmpV).x * REC_FLAT - 1) * t : 0));
    rdrag.over = dist < 1.7 ? dev : null;
  }
  function recordDown(e, rec) {
    if (rec.where !== 'bag') {
      const dev = devices[rec.where];
      if (dev && dev.deck && (dev.deck.on || dev.deck.spin > 0.05)) { say('Stop the turntable before lifting the record off it.'); return true; }
      if (dev && dev.deck) dev.deck.record = null;
    }
    if (rec.where === 'bag') leaveQueue(rec);
    const org = rec.where === 'bag' ? rec.mesh.getWorldPosition(new THREE.Vector3()) : null;
    scene.attach(rec.mesh);
    tweens.splice(0, tweens.length, ...tweens.filter((t) => t.m !== rec.mesh));
    rdrag = { rec, over: null, origin: org, s: rec.root.getWorldScale(new THREE.Vector3()).x || 1 };
    if (api.onGrab) api.onGrab(true);                      // the camera pulls back so both turntables are in view
    if (!rdrag.origin) { rdrag.origin = rec.mesh.getWorldPosition(new THREE.Vector3()); rdrag.s = 0.01; }
    rec.where = 'drag';
    moveRecord(e);
    say(`${RECORDS[rec.idx].title} taken out. Carry it to a turntable and let go.`);
    return true;
  }
  function recordUp() {
    const d = rdrag; rdrag = null;
    if (api.onGrab) api.onGrab(false);
    if (d.over) {
      landOn(d.rec, d.over, false, () => say(`${RECORDS[d.rec.idx].title} is on the ${d.over.label.toLowerCase().includes('left') ? 'left' : 'right'} turntable.`));
    } else { sendHome(d.rec, false); say('The record goes back into the bag.'); }
    onChange();
  }

  let drag = null, selected = null;

  function localPoint(e, R = rig) {                       // the point of the mixer surface under the pointer, in photo pixels
    setRay(e);
    const wy = R.root.getWorldPosition(new THREE.Vector3()).y + 0.05 * mixer.k;
    plane.constant = -wy;
    if (!ray.ray.intersectPlane(plane, hitPoint)) return null;
    const l = R.root.worldToLocal(hitPoint.clone());
    return R.toPx(l.x, l.z);
  }

  function describe(c) {
    const base = describeBase(c);
    if (c.type === 'button') return base;                                   // buttons already carry their explanation
    const d = partDefOf(c);
    return d && d.what && !(c.dev && c.dev.cd && c.type === 'jog') ? `${base}. ${firstSentence(d.what)}` : base;
  }
  function describeBase(c) {
    if (c.type === 'knob' || c.type === 'fader' || c.type === 'xfader') return `${nameOf(c)}: ${Math.round(c.value * 100)} percent`;
    if (c.type === 'switch' && c.vertical) return `${nameOf(c)}: ${c.pos === 0 ? 'off (up)' : 'on (down)'}`;
    if (c.type === 'switch') return `${nameOf(c)}: ${['to the left', 'in the middle', 'to the right'][c.pos]}`;
    { const d = partDefOf(c); return `${nameOf(c)}: ${c.on ? 'on' : 'off'}.${d && d.what ? ' ' + firstSentence(d.what) : ''}`; }
  }

  function press(c, combo) {
    c.toggle();
    if (c.name === 'xi_hpf' || c.name === 'xi_bpf' || c.name === 'xi_lpf') {            // one filter type at a time, except HPF + BPF together (hold Shift, or press and hold, on the second one)
      if (!c.on) c.toggle();
      const isF = (o) => o.name === 'xi_hpf' || o.name === 'xi_bpf' || o.name === 'xi_lpf';
      rig.controls.forEach((o) => {
        if (o === c || !isF(o) || (o.x < 330) !== (c.x < 330) || !o.on) return;
        const keep = combo && c.name !== 'xi_lpf' && o.name !== 'xi_lpf';
        if (!keep) o.toggle();
      });
      const both = rig.controls.filter((o) => (o.name === 'xi_hpf' || o.name === 'xi_bpf') && (o.x < 330) === (c.x < 330) && o.on).length === 2;
      if (both) { say('High-pass and band-pass together: the bass is cut away and the sound is squeezed into a narrow band. The knob moves both upwards. Press either one on its own to go back to a single filter.'); return; }
      say({ xi_hpf: 'High-pass filter: the knob removes the bass, more and more as you turn it up.', xi_bpf: 'Band-pass filter: only a narrow band of the sound passes, and the knob moves that band upwards.', xi_lpf: 'Low-pass filter: the filter starts fully open and the knob closes it, taking away the highs first. It cannot be combined with the others.' }[c.name] + (c.name === 'xi_lpf' ? '' : ' Tip: hold Shift (or press and hold) on the other of HPF and BPF to use both together.'));
      return;
    }
    if (c.name === 'xi_xcurve') { say(c.on ? 'Sharp crossfader curve: a channel stays at full volume until the crossfader is almost at the other end, then it is cut. This is the scratching curve.' : 'Smooth crossfader curve: the two sides blend gradually across the whole travel.'); return; }
    if (c.name === 'xi_split') { say(c.on ? 'Split cue on: the cued channels go to your left ear and the master mix to your right ear. Plug in the headphones to hear it.' : 'Split cue off: cue and master are blended in both ears again.'); return; }
    if (c.name === 'xi_cue') { const n = A.cue.indexOf(c) + 1; say(c.on ? `Channel ${n} cue on: you hear it in the headphones, whatever the fader does. ${hp.plugged ? '' : 'Plug in the headphones to hear it.'}` : `Channel ${n} cue off.`); cueLink(); return; }
    cueLink();
    if (c.dev && c.dev.cd) { cdPress(c); return; }
    if (c.dev === mixer && mixerPress(c)) return;
    say(describe(c));
  }

  // A switch has three places: left, middle, right. Pushing its left side moves it left (or back to the middle
  // if it is already there); pushing its right side does the same on the right.
  function flip(c, e) {
    const p = c.vertical ? null : localPoint(e, c.R);
    if (p && Math.abs(p.x - c.x) > 0.8) c.setPos(p.x < c.x ? (c.pos === 0 ? 1 : 0) : (c.pos === 2 ? 1 : 2));
    else c.toggle();
    cueLink();
    if (c.name === 'xi_xassign') { const n = A.xassign.indexOf(c) + 1; say(c.pos === 0 ? `Channel ${n} assigned to crossfader side A: pushing the crossfader towards B fades it out.` : c.pos === 2 ? `Channel ${n} assigned to crossfader side B: pushing the crossfader towards A fades it out.` : `Channel ${n} set to THRU: the crossfader does not affect it.`); return; }
    say(describe(c));
  }

  // clicking (or dragging along) the thin song-position strip on a media player's display jumps there, like touching the overview on a real CDJ
  let stripCd = null;
  function stripSeek(e, cdFixed) {
    const st = getState();
    if (st.explaining || st.state === 'part') return false;
    setRay(e);
    const list = cdFixed ? [cdFixed] : cdjs.map((d) => d.cd);
    for (const cd of list) {
      const mesh = cd.R.displayMesh, info = cd.R.screen && cd.R.screen.state.info;
      if (!mesh || !info || !info.dur) continue;
      const h = ray.intersectObject(mesh, false)[0];
      if (!h || !h.uv) continue;
      const x = h.uv.x * 960, y = (1 - h.uv.y) * 540;
      if (!cdFixed && (y < 416 || y > 480 || x < 14 || x > 946)) continue;
      const f = Math.max(0, Math.min(1, (x - 22) / (960 - 44)));
      seekTo(cd, f * info.dur);
      if (!cdFixed) { stripCd = cd; say('Jumped to that point of the song. On a real player you touch the thin overview of the track like this.'); }
      return true;
    }
    return false;
  }
  window.addEventListener('pointermove', (e) => { if (stripCd) stripSeek(e, stripCd); });
  window.addEventListener('pointerup', () => { stripCd = null; });
  window.addEventListener('pointercancel', () => { stripCd = null; });

  function onDown(e) {
    if (!api.playOn || e.button > 0) return;
    const rec = recordAt(e);
    if (rec) {
      e.stopImmediatePropagation(); e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      recordDown(e, rec);
      return;
    }
    if (stripSeek(e)) { e.stopImmediatePropagation(); e.preventDefault(); canvas.setPointerCapture(e.pointerId); return; }
    if (usbAt(e)) {
      e.stopImmediatePropagation(); e.preventDefault();
      if (usb.at) { say('The drive is seated in the slot and does not move when you click it. Press the EJECT button on the media player to release it, like on a real player.'); return; }
      canvas.setPointerCapture(e.pointerId);
      const h = usb.dev.holder; setRay(e);
      const p0 = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6), p0);
      usb.drag = { dx: h.position.x - p0.x, dz: h.position.z - p0.z, px: p0.x, pz: p0.z, f: usb.at ? 1 : 0 }; usb.anim = null;
      usbOnTop(true);
      if (usb.at) { const was = usb.at.cd; was.usb = false; const emergency = pullDrive(); usb.at = null; say(emergency ? 'USB drive pulled out while a song was playing: the player keeps going in an emergency loop of 16 bars. Plug the drive back in to carry on.' : 'USB drive pulled out. The song is unloaded from both players.'); }
      else say('USB drive picked up. Carry it to the USB slot of a media player and let go.');
      return;
    }
    if (phonesAt(e)) {
      e.stopImmediatePropagation(); e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const h = hp.dev.holder;
      setRay(e);
      const p0 = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), p0);
      hp.drag = { dx: h.position.x - p0.x, dz: h.position.z - p0.z, over: false };
      if (api.onGrab) api.onGrab(true, 'phones');
      tweens.splice(0, tweens.length, ...tweens.filter((t) => !t.fake));
      if (hp.plugged) { setPlugged(false); say('Headphones unplugged. The sound is back on the speakers.'); }
      else say('Headphones picked up. Carry them to the jack on the mixer, at the front right, and let go.');
      return;
    }
    const t = target(e);
    if (!t) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    selected = t.kind === 'mixer' ? t.c : null;
    if (t.kind === 'deck') {
      drag = { deck: t, x0: e.clientX, y0: e.clientY, moved: false, v0: t.dev.deck.skateValue };
      if (t.act === 'pitch') { const z = deckZ(e, t.dev); drag.grab = z == null ? 0 : z - (PITCH_GEOM.z0 + t.dev.deck.pitchValue * PITCH_GEOM.travel); }
      return;
    }
    const c = t.c;
    drag = { c, x0: e.clientX, y0: e.clientY, v0: c.value, moved: false, t0: performance.now() };
    if (c.type === 'fader' || c.type === 'xfader') {
      const p = localPoint(e, c.R);
      drag.grab = p ? (c.type === 'fader' ? p.y - c.y : p.x - c.x) : 0;
    }
  }

  function onMove(e) {
    if (rdrag) { moveRecord(e); return; }
    if (usb.drag) {
      setRay(e);
      const p = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6), p)) {
        usb.drag.px = p.x; usb.drag.pz = p.z;               // the update loop moves and tips the drive
      }
      return;
    }
    if (hp.drag) {
      setRay(e);
      const p = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), p)) {
        const h = hp.dev.holder; h.position.set(p.x + hp.drag.dx, 0.35, p.z + hp.drag.dz);
        const j = jackWorld(); hp.drag.over = Math.hypot(j.x - p.x, j.z - p.z) < 1.1;
      }
      return;
    }
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true;
    if (drag.deck) {
      if (!drag.moved || !drag.deck.drag) return;
      const t = drag.deck, dk = t.dev.deck;
      if (t.act === 'pitch') {
        const z = deckZ(e, t.dev);
        if (z != null) {
          let v = Math.max(-1, Math.min(1, (z - drag.grab - PITCH_GEOM.z0) / PITCH_GEOM.travel));
          if (Math.abs(v) < 0.04) v = 0;                                  // a click at the middle, like the real fader
          dk.pitchValue = v;
        }
      } else if (t.act === 'skate') {
        dk.skateValue = Math.max(0, Math.min(SKATE_MAX, drag.v0 + ((drag.y0 - e.clientY) + (e.clientX - drag.x0)) / 90));
        if (Math.abs(dk.skateValue - SKATE_NORMAL) < 0.08) dk.skateValue = SKATE_NORMAL;
      }
      return;
    }
    const c = drag.c;
    if (!c || !drag.moved) return;
    if (c.type === 'knob') {
      c.set(drag.v0 + ((drag.y0 - e.clientY) + (e.clientX - drag.x0) * 0.5) / 170);
      if (DETENT.has(c.name) && Math.abs(c.value - 0.5) < 0.04) c.set(0.5);       // EQ and colour knobs click into the centre position, as they do on a real mixer
    } else if (c.type === 'fader') {
      const p = localPoint(e, c.R);
      if (p) { c.set(1 - (p.y - drag.grab - c.lo) / (c.hi - c.lo)); if (c.name === 'cj_tempo' && Math.abs(c.value - 0.5) < 0.015) c.set(0.5); }       // the tempo slider clicks into place at zero
    } else if (c.type === 'xfader') {
      const p = localPoint(e, c.R);
      if (p) c.set((p.x - drag.grab - c.lo) / (c.hi - c.lo));
    }
  }

  function onUp(e) {
    if (rdrag) { try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* released */ } recordUp(); return; }
    if (usb.drag) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* released */ }
      usb.drag = null;
      if (usb.over) {
        const dv = usb.over; usb.over = null; usb.at = dv; dv.cd.usb = true; dv.cd.shown = null; cdjs.forEach((o) => { if (o.cd.emergency) { o.cd.emergency = false; exitLoop(o.cd); } }); cdjs.forEach((o) => { o.cd.shown = null; });
        const pose = usbPose(dv); usbMove(pose.pos, pose.rot);
        say('USB drive plugged in. Turn the rotary selector to choose a song, then press it to load.');
      } else { const h = usb.dev.holder; usbMove(new THREE.Vector3(h.position.x, 0, h.position.z), new THREE.Euler(0, usb.home.rotY, 0)); say('USB drive put down.'); }
      onChange();
      return;
    }
    if (hp.drag) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* released */ }
      const d = hp.drag; hp.drag = null;
      const h = hp.dev.holder;
      if (api.onGrab) api.onGrab(false, 'phones');
      if (d.over) {
        const j = jackWorld();
        plugTween(new THREE.Vector3(j.x + 0.9, 0, j.z + 1.0));
        setPlugged(true);
        say(audio.on ? 'Headphones plugged in. You now hear the headphone mix: the CUE / MASTER knob blends the cued channels with the main mix, and the level knob sets the volume.' : 'Headphones plugged in. Turn Sound on to hear them.');
      } else { plugTween(new THREE.Vector3(h.position.x, 0, h.position.z)); say('Headphones put down.'); }
      onChange();
      return;
    }
    if (!drag) return;
    const d = drag; drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    if (d.deck) {
      if (d.moved && d.deck.drag) { say(deckReadout(d.deck)); onChange(); } else if (!d.moved && !d.deck.drag) deckAction(d.deck);
      return;
    }
    if (d.moved) { say(describe(d.c)); return; }
    if (d.c.type === 'switch') { flip(d.c, e); return; }
    if (d.c.type === 'knob' && d.c.dev && d.c.dev.cd) { cdPress(d.c); return; }
    if (d.c.type === 'button' || d.c.type === 'tap') press(d.c, e.shiftKey || performance.now() - (d.t0 || 0) > 500);
  }

  // the point of the deck surface under the pointer, as a position along the pitch fader (model units)
  const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pv = new THREE.Vector3();
  function deckZ(e, dev) {
    setRay(e);
    const m = dev.deck.model;
    pl.constant = -(m.getWorldPosition(new THREE.Vector3()).y + 16.4 * m.scale.y);
    if (!ray.ray.intersectPlane(pl, pv)) return null;
    return m.worldToLocal(pv.clone()).z;
  }

  const pct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * PITCH_RANGE * 100).toFixed(1)} percent`;
  function deckReadout(t) {
    const dk = t.dev.deck;
    if (t.act === 'pitch') return `Pitch fader: ${pct(dk.pitchValue)}. ${dk.pitchValue > 0 ? 'The record runs faster.' : dk.pitchValue < 0 ? 'The record runs slower.' : 'Normal speed.'}`;
    return skateIsOff(dk)
      ? `Anti-skating is at ${dk.skateValue.toFixed(1)} grams, far from the stylus pressure of ${SKATE_NORMAL.toFixed(1)} grams. The stylus will skip.`
      : `Anti-skating at ${dk.skateValue.toFixed(1)} grams, matching the stylus pressure.`;
  }

  function deckAction(t) {
    const dk = t.dev.deck;
    if (t.act === 'power') {
      dk.powerOn = !dk.powerOn;
      if (dk.powerOn) dk.rpm = 100 / 3;                       // the real deck always starts at 33
      say(dk.powerOn ? 'Power on. The blue lamp lights and the speed is set to 33 rpm.' : 'Power off. The platter coasts to a stop.');
    } else if (!dk.powerOn && t.act !== 'lamp') {
      say('The turntable is switched off. Turn the power knob first.');
    } else if (t.act === 'start') {
      dk.on = !dk.on; dk.leverUp = false;
      say(dk.on ? (dk.record == null ? 'Turntable started, but there is no record on it yet. Take one out of the vinyl bag and put it on the platter.' : 'Turntable started. The platter speeds up and the arm swings onto the record.') : 'Turntable stopped. The arm lifts and the platter slows down.');
    } else if (t.act === 'lever') {
      dk.leverUp = !dk.leverUp;
      say(dk.leverUp ? 'The arm is lifted off the record.' : 'The arm is lowered onto the record.');
    } else if (t.act === 'lamp') {
      dk.lampUp = !dk.lampUp;
      say(dk.lampUp ? (dk.powerOn ? 'The target light pops up and shines a red light on the stylus.' : 'The target light pops up, but it needs the power on to light.') : 'The target light is pushed back down into the turntable.');
    } else {
      dk.rpm = t.act === '45' ? 45 : 100 / 3;
      say(`Speed set to ${t.act} rpm.`);
    }
    onChange();
  }

  // Double-click the anti-skating dial to put it back
  canvas.addEventListener('dblclick', (e) => {
    const t = target(e);
    if (t && t.kind === 'deck' && t.act === 'skate') { t.dev.deck.skateValue = SKATE_NORMAL; say('Anti-skating reset to normal.'); onChange(); }
  });
  const resetBtn = document.getElementById('dial-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => { decks.forEach((d) => { d.deck.skateValue = SKATE_NORMAL; }); say('Anti-skating reset to normal. The record can play again.'); onChange(); });

  canvas.addEventListener('pointerdown', onDown, true);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { drag = null; usb.drag = null; if (rdrag) recordUp(); if (hp.drag) { hp.drag = null; hp.dev.holder.position.y = 0; if (api.onGrab) api.onGrab(false, 'phones'); } });

  // Hover: say what the control is and how to use it
  function hoverInfo(e) {
    if (!api.playOn || (e.pointerType && e.pointerType !== 'mouse') || e.buttons) return null;
    if (usbAt(e)) return { name: 'USB drive', small: usb.at ? 'Press EJECT on the player to release it' : 'Drag it onto a media player' };
    if (phonesAt(e)) return { name: 'Headphones', small: hp.plugged ? 'Drag to unplug' : 'Drag to the mixer jack to plug in' };
    const rec = recordAt(e);
    if (rec) return { name: `${RECORDS[rec.idx].title} · ${RECORDS[rec.idx].artist}`, small: rec.where === 'bag' ? 'Drag it onto a turntable' : 'Drag it off to move it' };
    const t = target(e);
    if (!t) return null;
    if (t.kind === 'deck') return { name: t.name, small: t.how };
    const c = t.c;
    const how = c.type === 'knob' ? 'Drag up or down to turn' : c.type === 'fader' || c.type === 'xfader' ? 'Drag to slide' : c.type === 'switch' ? 'Click the left or right side' : 'Click to press';
    return { name: t.name, small: how };
  }
  api.hoverInfo = hoverInfo;

  // Keyboard: with a control chosen, the arrow keys move it and Enter or Space presses it
  canvas.addEventListener('keydown', (e) => {
    if (!api.playOn || !selected) return;
    const c = selected;
    let used = true;
    if ((c.type === 'knob' || c.type === 'fader' || c.type === 'xfader') && (e.key === 'ArrowUp' || e.key === 'ArrowRight')) c.set(c.value + 0.05);
    else if ((c.type === 'knob' || c.type === 'fader' || c.type === 'xfader') && (e.key === 'ArrowDown' || e.key === 'ArrowLeft')) c.set(c.value - 0.05);
    else if (e.key === 'Enter' || e.key === ' ') { if (c.type !== 'knob' && c.type !== 'fader' && c.type !== 'xfader') c.toggle(); else used = false; }
    else if (e.key === 'Escape') { selected = null; say('Control released. The arrow keys turn the camera again.'); e.stopPropagation(); }
    else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); cueLink(); say(describe(c)); }
  }, true);

  // Pressing a CUE button lights the CUE ACTIVE lamp beside the headphone section
  /* ---------- the digital mixer's extra buttons and the Beat FX unit ---------- */
  const FX = { on: byName('dj_fxon')[0], sel: byName('dj_fxsel')[0], time: byName('dj_fxtime')[0], depth: byName('dj_fxdepth')[0], beat: byName('dj_beat'), freq: byName('dj_fxfreq'), chsel: byName('dj_chsel'),
    tap: byName('dj_tap')[0], auto: byName('dj_autotap')[0], quant: byName('dj_quantize')[0], colorfx: byName('dj_colorfx'), mcue: byName('dj_mastercue'), cueb: byName('dj_cueb') };
  const hasBeatFx = !!(FX.on && FX.time && FX.depth && FX.sel);
  const FX_NAMES = ['ECHO', 'DELAY', 'REVERB', 'FLANGER', 'TRANS'];
  const BEATS = [0.25, 0.5, 0.75, 1, 2, 4, 8], beatLabel = (b) => (b === 0.25 ? '1/4' : b === 0.5 ? '1/2' : b === 0.75 ? '3/4' : String(b));
  const taps = []; let fxSig = '';
  const timeBeats = () => 0.25 * Math.pow(32, FX.time ? FX.time.value : 0.3);
  const nearestBeat = (b) => BEATS.reduce((p, q, i) => (Math.abs(Math.log(q / b)) < Math.abs(Math.log(BEATS[p] / b)) ? i : p), 0);
  const fxBpm = () => {
    if (FX.auto && FX.auto.value > 0.5 && taps.bpm) return taps.bpm;
    const pl = players.find((d) => K(d).playing); const t = pl && audio.tracks && audio.tracks.find((x) => x.id === RECORDS[K(pl).record].id);
    return t ? t.bpm * (pl.cd ? pl.cd.factor : speedFactor(pl.deck)) : 120;
  };
  function mixerPress(c) {
    const n = c.name, idx = byName(n).indexOf(c);
    if (n === 'dj_fxon') { say(c.on ? (FX.chsel.slice(0, 4).some((b) => b.on) || FX.chsel[5].on || FX.chsel[6].on ? `Beat FX on: ${FX_NAMES[Math.min(4, Math.floor(FX.sel.value * 5))]}. Turn LEVEL/DEPTH to hear more of it.` : 'Beat FX on, but no channel is selected. Press a CH SELECT button (1 to 4) to send a channel through it.') : 'Beat FX off.'); return true; }
    if (n === 'dj_beat') { const i = nearestBeat(timeBeats()), j = Math.max(0, Math.min(BEATS.length - 1, i + (idx === 0 ? -1 : 1))); FX.time.set(Math.log(BEATS[j] / 0.25) / Math.log(32)); setTimeout(() => { if (c.on) c.toggle(); }, 160); say(`Beat length: ${beatLabel(BEATS[j])} of a beat.`); return true; }
    if (n === 'dj_tap') {
      const now = performance.now(); if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
      taps.push(now); if (taps.length > 5) taps.shift();
      if (taps.length >= 2) { const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); taps.bpm = Math.max(60, Math.min(200, 60000 / iv)); if (FX.auto) FX.auto.set(1); say(`Tap tempo: ${taps.bpm.toFixed(1)} beats per minute. The effect now follows your taps.`); }
      else say('Tap the button in time with the music, at least twice.');
      setTimeout(() => { if (c.on) c.toggle(); }, 140); return true;
    }
    if (n === 'dj_chsel') { say(`${['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4', 'Microphone', 'Crossfader side A', 'Crossfader side B', 'Master'][idx] || 'Channel'} ${c.on ? 'sent through' : 'taken out of'} the Beat FX.${idx === 4 || idx === 7 ? ' (Not available in this demo.)' : ''}`); return true; }
    if (n === 'dj_fxfreq') { say(`${['Low', 'Mid', 'High'][idx]} frequencies ${c.on ? 'go' : 'no longer go'} into the effect.`); return true; }
    if (n === 'dj_colorfx') {
      if (!c.on) { say('Sound Color FX off: the COLOR knobs do nothing now. Press one of the effect buttons to choose an effect again.'); return true; }   // pressing the lit one switches it off
      FX.colorfx.forEach((o) => { if (o !== c) lamp(o, false); });                // only one effect is active at a time
      say([
        'SPACE: a reverb. Turn a COLOR knob either way and that channel is washed into a hall of echoes; the further you turn, the more.',
        'DUB ECHO: repeating echoes that fade away. Turn a COLOR knob either way to send more of the channel into the echo.',
        'CRUSH: the sound is crushed into a rough, digital grit. Turn a COLOR knob either way for more.',
        'SWEEP: only a narrow band of the sound is let through, and the COLOR knob sweeps that band from low (left) to high (right).',
        'NOISE: hiss is added to the channel. To the left it is a low rumble, to the right a bright hiss.',
        'FILTER: the classic one. Turn left for a low-pass (the highs close), right for a high-pass (the bass goes).'
      ][FX.colorfx.indexOf(c)] + ' (Simplified versions of the real effects.)'); return true;
    }
    if (n === 'dj_mastercue') { FX.mcue.forEach((o) => lamp(o, c.on)); say(c.on ? 'Master cue on: the headphones carry the master mix as well as your cue channels.' : 'Master cue off.'); return true; }
    if (n === 'dj_cueb') { say(c.on ? 'Channel cue for headphones B: you hear this channel in the headphones.' : 'Channel cue off.'); return true; }
    return false;
  }
  function updateBeatFx() {
    if (!hasBeatFx) return;
    const effect = Math.min(4, Math.floor(FX.sel.value * 5)), beats = timeBeats(), bpm = fxBpm();
    const cf = (side) => A.xassign.map((x, i) => (x && x.pos === side ? i : -1)).filter((i) => i >= 0);
    const chans = [0, 1, 2, 3].map((i) => !!(FX.chsel[i] && FX.chsel[i].on) || (FX.chsel[5] && FX.chsel[5].on && cf(0).includes(i)) || (FX.chsel[6] && FX.chsel[6].on && cf(2).includes(i)));
    const bands = [0, 1, 2].map((i) => (FX.freq[i] ? FX.freq[i].on : true));
    audio.beatfx({ on: FX.on.on, effect, beat: beats * 60 / bpm, depth: Math.max(0, Math.min(1, FX.depth.value)), chans, bands });
    const bi = nearestBeat(beats), lab = [BEATS[bi - 1], BEATS[bi], BEATS[bi + 1]].map((b) => (b == null ? '' : beatLabel(b)));
    const st = { quant: !!(FX.quant && FX.quant.on), bpm, tap: !!(FX.auto && FX.auto.value > 0.5 && taps.bpm), name: FX_NAMES[effect], on: FX.on.on, labels: lab, depth: Math.max(0, Math.min(1, FX.depth.value)), bands: ['LOW', 'MID', 'HIGH'].filter((_, i) => bands[i]).join(' · ') || 'NO BAND',
      chans: chans.map((x, i) => (x ? i + 1 : 0)).filter(Boolean).map((i) => 'CH' + i).join(' ') };
    const sig = JSON.stringify(st, (k, v) => (k === 'bpm' ? Math.round(v * 10) : k === 'depth' ? Math.round(v * 50) : v));
    if (sig !== fxSig && rig.fxScreen) { fxSig = sig; rig.fxScreen.draw(st); }
  }
  function cueLink() {
    if (rig.cueActive) rig.cueActive.material.emissiveIntensity = cues.some((c) => c.on) ? 1.6 : 0.1;
  }
  cueLink();

  /* ---------- the two modes ---------- */
  // Back to the settings the setup had when the page loaded
  api.resetAll = () => {
    rig.reset();
    decks.forEach((d) => {
      const k = d.deck;
      k.on = false; k.powerOn = false; k.lampUp = false; k.leverUp = false; k.rpm = 100 / 3; k.pitchValue = 0; k.skateValue = SKATE_NORMAL;
      d.deckStartAt = null;
    });
    records.forEach((r) => sendHome(r, true));
    cdjs.forEach((d) => { ejectUsb(d.cd, true); d.cd.R.reset(); d.cd.songPos = 0; Object.assign(d.cd, { rangeIdx: 0, span: 0.12, sync: false, master: false, slip: false, quant: false }); });
    if (hp.dev) { setPlugged(false); hp.dev.holder.position.copy(hp.home.pos); }
    cueLink();
    onChange();
  };
  // "Default settings" for the part of the setup the camera is looking at: the mixer, one media player or one turntable.
  // The USB drive, the headphones and the records are never moved.
  api.resetView = (id) => {
    const dv = devices[id];
    const rewindCd = (cd) => { resetCdState(cd); cd.on = false; if (cd.record != null) seekTo(cd, 0); };
    if (!dv) return null;
    if (dv === mixer) {
      rig.reset(); cueLink();
      cdjs.forEach((d) => rewindCd(d.cd));
      onChange();
      return cdjs.length ? 'The mixer is back to its default settings, and the songs are back at the start.' : 'The mixer is back to its default settings.';
    }
    if (dv.cd) {
      const cd = dv.cd;
      rewindCd(cd); cd.R.reset();
      Object.assign(cd, { rangeIdx: 0, span: 0.12, sync: false, master: false, slip: false, quant: false, factor: 1 });
      onChange();
      return cd.record != null ? 'This media player is back to its default settings, and its song is back at the start.' : 'This media player is back to its default settings.';
    }
    if (dv.deck) {
      const k = dv.deck;
      k.leverUp = true; k.rewind = true; k.pitchValue = 0; k.skateValue = SKATE_NORMAL; k.rpm = 100 / 3;
      onChange();
      return 'This turntable is back to its default settings: the arm is lifted off, and the record starts again from the beginning.';
    }
    return null;
  };
  api.setPlay = (on) => {
    api.playOn = on;
    if (!on) { drag = null; selected = null; api.phonesHome(); }
    api.setSound(on);                                  // the sound comes on with Play mode, and goes off with it
    onChange();
  };
  // the headphones go back to where they started (unplugged), so they are in the right place for Explain mode
  api.pullDrive = pullDrive;
  api.phonesHome = () => {
    if (!hp.dev) return;
    hp.drag = null; setPlugged(false);
    const h = hp.dev.holder;
    if (h.position.distanceTo(hp.home.pos) > 0.02) plugTween(hp.home.pos.clone());
    h.rotation.y = hp.home.rotY;
  };
  api.setSound = (on) => {
    api.soundOn = on;
    if (on) audio.start().then(() => say(hp.plugged ? 'Sound on, in the headphones.' : 'Sound on.')).catch(() => say('The browser did not allow sound.')); else audio.stop();
    onChange();
  };
  api.setDj = (on) => {
    api.djOn = on;
    decks.forEach((d, i) => { if (on) { d.deckStartAt = performance.now() + i * 3500; } else { d.deckStartAt = null; d.deck.on = false; d.deck.lampUp = false; } });
    if (!on) controls.autoRotate = false;
    onChange();
  };

  /* ---------- every frame ---------- */
  const BPM = 122;
  let beatPhase = 0;
  let drift = false, lastPump = 0;

  /* ---------- beat-matching hint: an arrow beside the pitch fader of the record that has to speed up or slow down ---------- */
  // It never shows the tempo itself, only which way to move the fader to bring this record in time with the one that was
  // playing first (the "master"). A green ring appears when the two are in time, so it stays a game of listening.
  const viewerEl = canvas.parentElement;
  const hintEls = new Map();
  let masterDeck = null, matchedNow = false;
  const faderInfo = (d) => {                                   // where the fader cap is, and which way is "faster"
    const box = new THREE.Box3();
    if (d.deck) { box.setFromObject(d.deck.pitchCap); const par = d.deck.pitchCap.parent; return { pos: box.getCenter(new THREE.Vector3()), dir: new THREE.Vector3(0, 0, 1).transformDirection(par.matrixWorld) }; }
    const c = d.cd.tempo; if (!c) return null;
    box.makeEmpty(); c.objs.forEach((o) => box.expandByObject(o));
    if (!d.cd.tdir) {
      const v0 = c.value, at = (v) => { c.set(v); d.model.updateWorldMatrix(true, true); const b = new THREE.Box3(); c.objs.forEach((o) => b.expandByObject(o)); return b.getCenter(new THREE.Vector3()); };
      const p1 = at(0.2), p2 = at(0.8); c.set(v0); d.model.updateWorldMatrix(true, true);
      d.cd.tdir = p2.sub(p1).normalize();
      box.makeEmpty(); c.objs.forEach((o) => box.expandByObject(o));
    }
    return { pos: box.getCenter(new THREE.Vector3()), dir: d.cd.tdir };
  };
  function updateHints() {
    const st = getState();
    const live = players.filter((d) => K(d).record != null && K(d).playing);
    if (masterDeck && !live.includes(masterDeck)) masterDeck = null;
    const cm = live.find((d) => d.cd && d.cd.master); if (cm) masterDeck = cm;
    if (!masterDeck && live.length) masterDeck = live[0];
    const cv = canvas.getBoundingClientRect(), vr = viewerEl.getBoundingClientRect();
    matchedNow = false;
    players.forEach((d) => {
      let el = hintEls.get(d);
      if (!el) { el = document.createElement('div'); el.className = 'pitch-hint'; el.hidden = true; el.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="17" class="ph-ring"/><path class="ph-arrow" d="M20 8 L31 24 H24 V32 H16 V24 H9 Z"/><path class="ph-tick" d="M11 21 l6 6 12-14"/></svg>'; viewerEl.appendChild(el); hintEls.set(d, el); }
      // the arrow appears as soon as a second record or song is loaded (before it plays), so the speed can be matched first
      const show = api.playOn && !st.explaining && st.state !== 'part' && masterDeck && live.includes(masterDeck) && K(d).record != null && d !== masterDeck;
      if (!show) { el.hidden = true; return; }
      const trk = (x) => audio.tracks && audio.tracks.find((q) => q.id === RECORDS[K(x).record].id);
      const tm = trk(masterDeck), td = trk(d), fi = faderInfo(d);
      if (!tm || !td || !fi) { el.hidden = true; return; }
      const fm = masterDeck.cd ? masterDeck.cd.factor : speedFactor(masterDeck.deck), fd = d.cd ? d.cd.factor : speedFactor(d.deck);
      const want = (tm.bpm * fm) / td.bpm, diff = (want - fd) / fd;             // how far this record is from being in time
      const fast = diff > 0;                                                    // it needs to run faster
      const sgn = d.cd ? (fast ? -1 : 1) : (fast ? 1 : -1);       // on the media players, down is faster
      const p = fi.pos.clone().project(camera), q = fi.pos.clone().addScaledVector(fi.dir, sgn * 0.5).project(camera);
      const ax = (p.x + 1) / 2 * cv.width + cv.left - vr.left, ay = (1 - p.y) / 2 * cv.height + cv.top - vr.top;
      const ang = fast ? 180 : 0;   // always: arrow down = this song has to go faster, arrow up = slower (the faders run up and down the screen, and down is faster on both players)
      const ok = Math.abs(diff) < 0.002, big = Math.abs(diff) > 0.03;
      if (ok) matchedNow = true;
      el.hidden = false; el.classList.toggle('ok', ok); el.classList.toggle('big', big);
      el.style.left = (ax + 34) + 'px'; el.style.top = ay + 'px';
      el.querySelector('.ph-arrow').style.transform = `rotate(${ang}deg)`;
      el.title = ok ? 'In time with the other record' : (fast ? 'Move the fader this way to speed this record up' : 'Move the fader this way to slow this record down');
    });
  }

  /* ---------- what the guided DJ demo needs to know, and where things are ---------- */
  const centreOf = (objs) => { const b = new THREE.Box3(); objs.forEach((o) => b.expandByObject(o)); return b.getCenter(new THREE.Vector3()); };
  api.demo = {
    decks: players,
    K,
    channelOf: (d) => deckChannel.get(d),
    usbAt: () => (usb.at ? usb.at.id : null),
    fader: (ch) => (faders[ch] ? faders[ch].value : 0),
    phonesHome: () => api.phonesHome(),
    // "match it for me": set the tempo of a player so that it is exactly in time with the one that is playing
    autoMatch: (d) => {
      const m = masterDeck;
      if (!m || !d || m === d || m.cd && m.cd.record == null) return false;
      const trk = (x) => audio.tracks && audio.tracks.find((q) => q.id === RECORDS[K(x).record].id);
      const tm = trk(m), td = trk(d); if (!tm || !td) return false;
      const want = (tm.bpm * (m.cd ? m.cd.factor : speedFactor(m.deck))) / td.bpm;
      if (d.cd) {
        while (Math.abs(want - 1) > RANGES[d.cd.rangeIdx] && d.cd.rangeIdx < RANGES.length - 1) { d.cd.rangeIdx++; d.cd.span = RANGES[d.cd.rangeIdx] * 2; }
        d.cd.sync = true; const sb = cdAll(d.cd, 'cj_sync')[0]; if (sb) lamp(sb, true);     // the real SYNC button does the work
        d.cd.tempo.set(Math.max(0, Math.min(1, 0.5 - (want - 1) / d.cd.span)));
      } else d.deck.pitchValue = Math.max(-1, Math.min(1, (want - 1) / PITCH_RANGE));
      return true;
    },
    faderDown: () => { faders.forEach((f) => f.set(0)); },
    restart: (d) => { if (d.cd && d.cd.record != null) { seekTo(d.cd, 0); d.cd.on = true; } },
    plugged: () => hp.plugged,
    lo: (ch) => (A.lo[ch] ? A.lo[ch].value : 0.5),
    loopOn: (d) => !!(d.cd && d.cd.loop && d.cd.loop.active),
    cueOn: (ch) => !!(A.cue[ch] && A.cue[ch].on),
    bagUsed: () => queue.length,
    xfade: () => (xfade ? xfade.value : 0.5),
    matched: () => matchedNow,
    hasUsb: () => !!usbDev,
    home: () => (api.demo.hasUsb() ? 'digital' : 'analog'),
    target(kind, id, name) {
      const dv = id ? devices[id] : null;
      if (kind === 'usb' && usbDev) return usbDev.holder.position.clone().setY(0.4);
      if (kind === 'slot' && dv && dv.cd) return slotWorld(dv).setY(slotTop(dv) + 0.15);
      if (kind === 'bagrec' && records.length) { const f = queue.length ? records[queue[0]] : null; return f ? f.mesh.getWorldPosition(new THREE.Vector3()) : null; }
      if (kind === 'platter' && dv && dv.deck) return platterCentre(dv).setY(0.8);
      if (kind === 'control' && dv && dv.cd) { const c = dv.cd.R.controls.find((x) => x.name === name); return c ? centreOf(c.objs) : null; }
      if (kind === 'phones' && hp.dev && !hp.plugged) return hp.dev.holder.position.clone().setY(0.4);
      if (kind === 'jack') return jackWorld().setY(0.4);
      if (kind === 'lo') return A.lo[id] ? centreOf(A.lo[id].objs) : null;
      if (kind === 'loopbtn' && dv && dv.cd) { const c = cdAll(dv.cd, 'cj_loop')[Number(name)]; return c ? centreOf(c.objs) : null; }
      if (kind === 'cue') return A.cue[id] ? centreOf(A.cue[id].objs) : null;
      if (kind === 'fader') return faders[id] ? centreOf(faders[id].objs) : null;
      if (kind === 'xfader') return xfade ? centreOf(xfade.objs) : null;
      if (kind === 'power' && dv && dv.deck) return dv.deck.power ? centreOf([dv.deck.power]) : null;
      return null;
    },
    dragging: () => !!(usb.drag || rdrag),
    bagId: () => (bagDev ? bagDev.id : null),
    onDeck: (id) => (devices[id] && devices[id].deck ? devices[id].deck.record : null)
  };
  api.update = (t, dt) => {
    updateHints();
    // the second record joins a few seconds after the first
    decks.forEach((d) => { if (api.djOn && d.deckStartAt && performance.now() >= d.deckStartAt) {
        d.deckStartAt = null;
        const go = () => { const k = d.deck; if (!api.djOn) return; k.powerOn = true; k.rpm = 100 / 3; k.lampUp = true; k.on = true; k.leverUp = false; };
        if (d.deck.record == null) {
          const free = queue.length ? records[queue[0]] : null;           // the front record of the bag
          if (free) leaveQueue(free);
          if (free) landOn(free, d, false, go); else go();
        } else go();
      }
      tickDeck(d.deck, dt, t);
    });
    autoMaster();
    cdjs.forEach((d) => tickCdj(d, dt));
    if (usb.anim) { const a = usb.anim; a.t = Math.min(1, a.t + dt / a.dur); const k = ease(a.t); const h = usb.dev.holder; if (a.via) { if (a.t < 0.5) h.position.lerpVectors(a.p0, a.via, ease(a.t * 2)); else h.position.lerpVectors(a.via, a.p1, ease(a.t * 2 - 1)); } else h.position.lerpVectors(a.p0, a.p1, k); h.quaternion.slerpQuaternions(a.q0, a.q1, k); if (a.t >= 1) { usb.anim = null; usbOnTop(false); } }
    // the drive in the hand: tips from lying flat to standing upright as it nears a USB slot
    if (usb.drag) {
      const d = usb.drag, h = usb.dev.holder, { best, bd } = usbNearest(d.px, d.pz);
      usb.over = bd < 1.3 ? best : null;
      const ft = bd < 1.3 ? Math.min(1, (1.3 - bd) / 0.9) : 0, sm = ft * ft * (3 - 2 * ft);
      d.f += (sm - d.f) * Math.min(1, dt * 9);
      const s = best ? slotWorld(best) : null, top = best ? slotTop(best) : 0.5;
      let x = d.px + d.dx, z = d.pz + d.dz;
      if (s) { x += (s.x - x) * d.f * 0.8; z += (s.z - z) * d.f * 0.8; }
      h.position.set(x, 0.9 + (top + USB_TIP + 0.3 - 0.9) * d.f, z);
      h.quaternion.slerpQuaternions(qHome(), qUp, d.f);
    }
    // the sound: every control of the mixer feeds the audio engine
    if (audio.on) {
      updateBeatFx();
      audio.mixer({ masterCue: FX.mcue.some((b) => b.on) });
      for (let i = 0; i < 4; i++) {
        audio.channel(i, { trim: A.trim[i] ? A.trim[i].value : 0.5, hi: A.hi[i].value, hm: A.hm[i].value, lm: A.lm[i] ? A.lm[i].value : 0.5, lo: A.lo[i].value,
          fader: faders[i] ? faders[i].value : 0.7, assign: A.xassign[i] ? A.xassign[i].pos : 1, cue: (A.cue[i] ? A.cue[i].on : false) || !!(FX.cueb[i] && FX.cueb[i].on),
          filter: A.fassign[i] ? [1, 0, 2][A.fassign[i].pos] : 0, color: A.color[i] ? A.color[i].value : 0.5, cfx: FX.colorfx.length ? FX.colorfx.findIndex((b) => b.on) : undefined });
      }
      if (hasFilters) {
        const pl = players.find((d) => K(d).playing), t = pl && audio.tracks && audio.tracks.find((x) => x.id === RECORDS[K(pl).record].id);
        const bpm = t ? t.bpm * (pl.cd ? pl.cd.factor : speedFactor(pl.deck)) : 0;
        FM.forEach((m, k) => audio.filter(k, { on: m.on.on, type: m.hpf.on && m.bpf.on ? 'hbp' : m.hpf.on ? 'hpf' : m.bpf.on ? 'bpf' : 'lpf', freq: m.freq.value, res: m.res.value, lfoOn: m.lfoOn.on, lfoDepth: m.lfod.value, x2: m.x2.on, bpm }));
      }
      audio.mixer({ master: mix1 ? mix1.value : 0.6, cross: xfade ? xfade.value : 0.5, mix: cuemix ? cuemix.value : 0.5, level: plevel ? plevel.value : 0.4, curve: xcurve && xcurve.on ? 1 : 0, split: !!(splitBtn && splitBtn.on) });
      sorted.forEach((d, i) => {
        const k = K(d), base = 100 / 3 / 60;
        if (d.sndRecord !== k.record) {
          d.sndRecord = k.record;
          audio.setTrack(i, k.record == null ? null : RECORDS[k.record].id);
          if (k.record != null) say(`Loading “${RECORDS[k.record].title}”…`);
        }
        k.songPos = audio.deck(i, deckChannel.get(d), { audible: k.record != null && k.on && !k.leverUp && !k.skipping && k.liftAngle > ARM_DROP * 0.5, rate: k.spin / base, reset: d.cd ? k.takeReset() : (k.rewind ? (k.rewind = false, true) : !k.on && (audio.slot(i) || {}).ended === true) });   // a stopped record keeps its place; a finished one starts again from the beginning
        const slot = audio.slot(i);
        if (slot && slot.buffer && !d.readySaid && k.record != null) { d.readySaid = true; say(d.cd ? `“${RECORDS[k.record].title}” is loaded. Press play, with the channel fader up, to hear it.` : `“${RECORDS[k.record].title}” is ready. Start the turntable, with the channel fader up, to hear it.`); }
        if (k.record == null || d.sndRecord !== d.readyFor) { d.readySaid = false; d.readyFor = d.sndRecord; }
        if (slot && slot.buffer) k.trackDur = slot.buffer.duration; else if (k.record == null) k.trackDur = 0;
        if (slot && slot.ended && k.on) { k.on = false; say(`“${RECORDS[k.record].title}” has finished.`); }
      });
    }
    if (hp.plugged && hp.dev) drawCable();
    // records standing in the bag slide to their place in the queue
    records.forEach((r) => { if (r.where === 'bag') { r.mesh.position.lerp(r.mesh.userData.home.pos, 1 - Math.exp(-dt * 9)); } });
    // records in flight
    for (let i = tweens.length - 1; i >= 0; i--) {
      const w = tweens[i];
      w.t = Math.min(1, w.t + dt / w.dur);
      const k = ease(w.t);
      if (w.via) { if (w.t < 0.55) w.m.position.lerpVectors(w.from.p, w.via, ease(w.t / 0.55)); else w.m.position.lerpVectors(w.via, w.to.p, ease((w.t - 0.55) / 0.45)); } else { w.m.position.lerpVectors(w.from.p, w.to.p, k); w.m.position.y += Math.sin(k * Math.PI) * 0.45; }
      w.m.quaternion.slerpQuaternions(w.from.q, w.to.q, k);
      w.m.scale.setScalar(w.from.s + (w.to.s - w.from.s) * k);
      if (w.t >= 1) { tweens.splice(i, 1); if (w.done) w.done(); }
    }

    // meters: nothing lights unless a record is playing, then each channel follows its fader
    const playing = players.filter((d) => K(d).playing);
    const rate = playing.length ? playing.reduce((a, d) => a + (d.cd ? d.cd.factor : speedFactor(d.deck)), 0) / playing.length : 1;
    beatPhase = (beatPhase + (dt * BPM) / 60 * rate) % 1;
    const beat = Math.exp(-beatPhase * 5.5);
    const level = [0, 0, 0, 0];
    players.forEach((d) => {
      const ch = deckChannel.get(d);
      if (!K(d).playing) return;
      const wobble = 0.08 * Math.sin(t * 9.1 + ch * 2.1) + 0.05 * Math.sin(t * 23.7 + ch);
      const src = 0.62 + 0.3 * beat + wobble;
      // the crossfader: a channel assigned to one side is cut when the crossfader is pushed to the other side
      const asg = A.xassign[ch] ? A.xassign[ch].pos : 1, xv = xfade ? xfade.value : 0.5;
      const xg = audio.xgain(asg, xv, xcurve && xcurve.on ? 1 : 0);
      level[ch] = Math.max(0, Math.min(1, src * (faders[ch] ? faders[ch].value : 0.7) * xg));
    });
    for (let i = 0; i < 4; i++) {
      const rate = level[i] > disp.ch[i] ? 40 : 5;
      disp.ch[i] += (level[i] - disp.ch[i]) * (1 - Math.exp(-dt * rate));
      if (chMeters[i]) rig.setMeter(chMeters[i], disp.ch[i]);
    }
    const total = Math.min(1, (level[0] + level[1] + level[2] + level[3]) * 0.8 * (0.4 + 0.9 * (mix1 ? mix1.value : 0.7)));
    const tl = total * (0.96 + 0.04 * Math.sin(t * 7.3)), tr = total * (0.96 + 0.04 * Math.sin(t * 6.1 + 1));
    disp.l += (tl - disp.l) * (1 - Math.exp(-dt * (tl > disp.l ? 40 : 5)));
    disp.r += (tr - disp.r) * (1 - Math.exp(-dt * (tr > disp.r ? 40 : 5)));
    if (mMeters[0]) rig.setMeter(mMeters[0], disp.l);
    if (mMeters[1]) rig.setMeter(mMeters[1], disp.r);

    // booth monitors pump with the kick while a record plays in DJ mode
    // the speakers only move when sound really reaches them: a record is playing, its channel fader is up
    // and the master level is up. Fader down (or master down) means no pumping, like the real thing.
    const reach = Math.min(1, total * 1.5);
    const pump = (api.djOn || api.playOn) ? beat * reach : 0;
    monitors.forEach((m) => { const s = 1 + 0.02 * pump; m.group.scale.set(s, s, s); });
    if (ctx.rim) ctx.rim.intensity = 0.5 + 0.7 * pump;

    if (resetBtn) { const off = api.playOn && decks.some((d) => Math.abs(d.deck.skateValue - SKATE_NORMAL) > 0.05); if (resetBtn.hidden === off) resetBtn.hidden = !off; resetBtn.classList.toggle('is-alert', decks.some((d) => d.deck.skipping)); }

    // a slow drift round the setup, only while the whole setup is in view and the visitor is not touching it
    const st = getState();
    const want = api.djOn && st.state === 'overview' && !st.busy && !st.pointerDown;
    if (want !== drift) { drift = want; controls.autoRotate = want; if (want) controls.autoRotateSpeed = 0.45; }
  };

  return api;
}

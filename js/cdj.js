// Behind the Decks: cdj.js
// A digital media player (the kind that stands either side of the mixer in a club), drawn in code in the
// same style as the two mixers: a printed black panel, and a real mesh for every button, knob, pad and the
// jog wheel. It carries no brand name, model number or logo. Each player has its own registry of controls
// (group.userData.rig), because the digital page has two of them.
//
// Layout units: the face is 800 x 1100, with the front edge (where the DJ stands) at the bottom.

import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeKit, finishRig, clamp01 } from './kit.js';

const FW = 800, FH = 1100;
const XW = 2.4, XD = XW * FH / FW, XH = 0.8;
const PX = XW / FW;
const WX = (x) => x * PX - XW / 2, WZ = (y) => y * PX - XD / 2;
const JOG = { x: 400, y: 753 };
const BODY_Y0 = 71;                                  // the main body starts here; the screen unit stands out behind it
const SLAB = { x1: 118, x2: 681, y2: 375, hB: 0.34, hF: 0.12 };
const K1 = 1.1142;                                   // reference photo pixels to layout units
const ph = (x, y) => [(x - 435) * K1, (y - 103) * 1.1122];
export const CDJ_SIZE = { XW, XD, XH };

// the screen: drawn on its own canvas so it can show the loaded track (title, time, tempo and a waveform)
function makeScreen(THREE) {
  const W = 960, H = 540;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const state = { info: null, pos: 0, list: null };
  const draw = () => {
    c.fillStyle = '#05080b'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#0d141b'; c.fillRect(0, 0, W, 56);
    c.fillStyle = '#8fa0ad'; c.font = '600 24px Inter, Arial, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText('USB', 22, 28);
    const info = state.info;
    if (!info && state.list) {
      c.fillStyle = '#8fa0ad'; c.font = '600 22px Inter, Arial, sans-serif'; c.textAlign = 'left'; c.fillText('Choose a song: turn the rotary selector, then press it', 120, 28);
      const items = state.list.items, sel = state.list.sel, rows = 6, first = Math.max(0, Math.min(items.length - rows, sel - 2));
      for (let r = 0; r < rows && first + r < items.length; r++) {
        const y = 66 + r * 62, on = first + r === sel;
        c.fillStyle = on ? '#14495a' : '#0b1116'; c.fillRect(14, y, W - 28, 54);
        if (on) { c.fillStyle = '#62d6f5'; c.fillRect(14, y, 6, 54); }
        c.fillStyle = on ? '#ffffff' : '#9fb0bc'; c.textAlign = 'left'; c.font = `${on ? 700 : 500} 28px Inter, Arial, sans-serif`; c.fillText(items[first + r], 36, y + 28);
      }
      return;
    }
    if (!info) {
      c.fillStyle = '#62d6f5'; c.textAlign = 'center'; c.font = '700 44px Inter, Arial, sans-serif'; c.fillText('NO TRACK LOADED', W / 2, 200);
      c.fillStyle = '#8fa0ad'; c.font = '500 26px Inter, Arial, sans-serif'; c.fillText('Plug in the USB drive, then choose a song', W / 2, 262);
      return;
    }
    c.fillStyle = '#eef6ff'; c.textAlign = 'left'; c.font = '700 34px Inter, Arial, sans-serif'; c.fillText(info.title, 22, 90);
    c.fillStyle = '#8fa0ad'; c.font = '500 24px Inter, Arial, sans-serif'; c.fillText(info.artist, 22, 126);
    const t = Math.max(0, state.pos || 0), left = Math.max(0, (info.dur || 0) - t);
    const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    c.textAlign = 'right'; c.fillStyle = '#eef6ff'; c.font = '700 54px Inter, Arial, sans-serif'; c.fillText('-' + mmss(left), W - 22, 98);
    c.fillStyle = '#e8d9a8'; c.font = '600 26px Inter, Arial, sans-serif'; c.fillText(info.bpm ? `${info.bpm.toFixed(1)} BPM` : '', W - 22, 140);
    // waveform: the whole track in a thin strip, and the part around the playhead large
    const wave = info.wave, n = wave ? wave.length / 3 : 0;
    if (n) {
      const at = Math.floor(t * (info.fps || 60));
      const span = 300, mid = 300, hMax = 120;
      for (let x = 0; x < W; x++) {
        const fr = at + Math.round((x - W / 2) * span / W * 1); if (fr < 0 || fr >= n) continue; const f = fr;
        const lo = wave[f * 3] / 255, mi = wave[f * 3 + 1] / 255, hi = wave[f * 3 + 2] / 255;
        c.fillStyle = '#2c6cff'; c.fillRect(x, mid - lo * hMax, 1, lo * hMax * 2);
        c.fillStyle = '#f0a030'; c.fillRect(x, mid - mi * hMax * 0.7, 1, mi * hMax * 1.4);
        c.fillStyle = '#eef6ff'; c.fillRect(x, mid - hi * hMax * 0.4, 1, hi * hMax * 0.8);
      }
      // beatgrid: one line per beat (the first beat of every bar is brighter), fixed to the song so it scrolls with the waveform
      if (info.baseBpm && info.firstBeat != null) {
        const fps = info.fps || 60, bl = 60 / info.baseBpm, pxPerS = W / span * fps;
        const k0 = Math.ceil((t - (W / 2) / pxPerS - info.firstBeat) / bl), k1 = Math.floor((t + (W / 2) / pxPerS - info.firstBeat) / bl);
        for (let k = k0; k <= k1; k++) {
          if (k < 0) continue;
          const x = Math.round(W / 2 + (info.firstBeat + k * bl - t) * pxPerS), bar = (k - (info.barBeat || 0)) % 4 === 0;
          c.fillStyle = bar ? '#ff3b30' : 'rgba(255,255,255,0.5)'; c.fillRect(x - (bar ? 1 : 0), bar ? 164 : 176, bar ? 3 : 2, bar ? 272 : 248);
        }
      }
      c.fillStyle = '#ffffff'; c.fillRect(W / 2 - 1, 156, 3, 288);
      // overview strip
      c.fillStyle = '#10181f'; c.fillRect(22, 430, W - 44, 36);
      for (let x = 0; x < W - 44; x++) {
        const f = Math.min(n - 1, Math.floor(x / (W - 44) * n));
        const v = Math.max(wave[f * 3] / 255, wave[f * 3 + 1] / 255) * 16;
        c.fillStyle = '#4a82d8'; c.fillRect(22 + x, 448 - v, 1, v * 2);
      }
      c.fillStyle = '#ffffff'; c.fillRect(22 + (t / Math.max(1, info.dur)) * (W - 44) - 1, 426, 3, 44);
    }
  };
  draw();
  return { canvas: cv, tex, state, draw, set(info) { state.info = info; state.list = null; draw(); tex.needsUpdate = true; }, setList(items, sel) { state.info = null; state.list = { items, sel }; draw(); tex.needsUpdate = true; }, tick(pos) { state.pos = pos; draw(); tex.needsUpdate = true; } };
}

export function cdj(THREE) {
  const g = new THREE.Group();
  const R = { controls: [], leds: [], meters: [], root: g, cueActive: null, toPx: null, WX, WZ, PX, jack: null, jog: null, screen: null, blinkers: [], usbSlot: null };
  g.userData.rig = R;
  R.toPx = (lx, lz) => ({ x: (lx + XW / 2) / PX, y: (lz + XD / 2) / PX });
  const S = 2048 / FW, cx = (x) => x * S, cy = (y) => y * S;
  const PADHEX = [0xe0402f, 0x3ab8ff, 0xc8e000, 0x9a6cff, 0x3fb35d, 0xf0a030, 0x3a7cff, 0xe8d900];
  const PADX = (i) => 154.3 + 70.2 * i, PADY = (408 - 0) ;
  const SLOPE = Math.atan((SLAB.hB - SLAB.hF) / (SLAB.y2 * PX));
  const hAt = (y) => SLAB.hB - (SLAB.hB - SLAB.hF) * (y / SLAB.y2);   // height of the sloping screen unit at a layout y

  // ---------- printed panel (only the main body: the screen unit has its own texture) ----------
  const panel = canvasTexture(THREE, 2048, Math.round(FH * S), (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const grd = c.createLinearGradient(0, cy(BODY_Y0), 0, h); grd.addColorStop(0, '#1d2025'); grd.addColorStop(1, '#14161a');
    c.fillStyle = grd; c.beginPath(); c.roundRect(0, cy(BODY_Y0), w, h - cy(BODY_Y0), 10); c.fill();
    const INK = '#e8ebef', DIM = '#a9b1ba';
    const t = (txt, x, y, size = 9, col = INK, align = 'center', weight = 600) => { c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.font = `${weight} ${size * S}px Inter, Arial, sans-serif`; c.fillText(txt, cx(x), cy(y)); };
    const T = (txt, px, py, size, col, align, weight) => { const [x, y] = ph(px, py); t(txt, x, y, size, col, align, weight); };
    const ln = (pts, col = INK, lw = 1.1) => { c.strokeStyle = col; c.lineWidth = lw * S; c.lineCap = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(cx(x), cy(y)) : c.moveTo(cx(x), cy(y)))); c.stroke(); };
    const LN = (pts, col, lw) => ln(pts.map(([px, py]) => ph(px, py)), col, lw);
    const rr = (x1, y1, x2, y2, r, fill, stroke, lw = 1) => { c.beginPath(); c.roundRect(cx(x1), cy(y1), (x2 - x1) * S, (y2 - y1) * S, r * S); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw * S; c.stroke(); } };
    const RR = (px1, py1, px2, py2, r, fill, stroke, lw) => { const [a, b] = ph(px1, py1), [d, e] = ph(px2, py2); rr(a, b, d, e, r, fill, stroke, lw); };
    const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx(x), cy(y), r * S, 0, Math.PI * 2); c.fill(); };
    // faint brushed-metal lines
    c.strokeStyle = 'rgba(255,255,255,0.03)'; c.lineWidth = 1;
    for (let y = cy(BODY_Y0); y < h; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    // a lighter edge around the face
    rr(3, BODY_Y0 + 3, 797, 1097, 8, null, 'rgba(255,255,255,0.08)', 1.5);

    // media slots
    RR(449, 178, 497, 224, 4, '#050607', '#4b535c', 1.4); c.fillStyle = '#2f7cff'; { const [a, b] = ph(453, 214); c.fillRect(cx(a), cy(b), 40 * S, 5 * S); }
    T('USB STOP', 516, 205, 5.6, DIM); T('5V 2A', 472, 232, 5, DIM);
    RR(449, 262, 528, 306, 4, '#050607', '#4b535c', 1.4); T('SD', 497, 322, 7, DIM);
    // time mode / auto cue, slip / quantize
    T('TIME', 462, 346, 5.4, DIM); T('MODE', 462, 355, 5.4, DIM); T('AUTO', 521, 346, 5.4, DIM); T('CUE', 521, 355, 5.4, DIM);
    T('SLIP', 467, 428, 5.4, DIM); T('QUANTIZE', 512, 428, 5.4, DIM);
    // hot cue: coloured bars under each pad
    T('HOT CUE', 794, 450, 6.4, INK, 'center', 700);
    for (let i = 0; i < 8; i++) {
      const col = '#' + PADHEX[i].toString(16).padStart(6, '0');
      T('ABCDEFGH'[i], 566 + i * 63, 463, 6.5, DIM);
      const x = PADX(i), y = PADY + 20;
      rr(x - 26, y, x + 26, y + 4, 2, col);
    }
    LN([[542, 450], [750, 450]], '#808890', 0.8); LN([[838, 450], [1046, 450]], '#808890', 0.8);
    // loop section
    T('CALL / DELETE', 472, 449, 5.2, DIM);
    T('IN/CUE', 472, 498, 6, INK); T('OUT', 527, 498, 6, INK); T('RELOOP/EXIT', 594, 498, 6, INK);
    LN([[622, 524], [650, 524]], DIM, 0.8); T('LOOP', 661, 524, 6.4, INK, 'left');
    T('IN ADJUST', 472, 552, 4.6, DIM); T('OUT ADJUST', 527, 552, 4.6, DIM);
    T('1/2X', 472, 603, 4.8, DIM); T('2X', 527, 603, 4.8, DIM); T('BEAT LOOP', 594, 582, 6, INK); LN([[498, 582], [572, 582]], DIM, 0.8);
    T('BEAT', 492, 628, 5.4, INK); T('JUMP', 492, 637, 5.4, INK);
    // call / delete / memory
    T('CUE/LOOP', 913, 497, 5.2, INK); T('CALL', 913, 506, 5.2, INK); T('DELETE', 980, 498, 5.4, INK); T('MEMORY', 1020, 498, 5.4, INK);
    // vinyl speed, jog mode, jog adjust
    T('VINYL SPEED ADJ.', 1093, 436, 5.2, INK); T('TOUCH / BRAKE', 1093, 445, 4.4, DIM);
    T('VINYL', 1075, 515, 4.6, '#62d6f5'); T('CDJ', 1075, 531, 4.6, '#c8e000'); T('JOG', 1115, 515, 4.8, INK); T('MODE', 1115, 524, 4.8, INK);
    T('JOG ADJUST', 992, 563, 5.4, INK); T('LIGHT', 976, 612, 4.4, DIM); T('HEAVY', 1010, 612, 4.4, DIM);
    // sync
    LN([[1060, 560], [1066, 560]], DIM, 0.8); T('INST. DOUBLES', 1100, 560, 5, INK);
    T('BEAT SYNC', 1072, 610, 4.6, DIM); T('MASTER', 1115, 610, 4.6, DIM); T('KEY SYNC', 1094, 644, 4.6, DIM);
    T('TEMPO', 1094, 673, 5.2, INK); T('±6 / ±10 / ±16 / WIDE', 1094, 681, 3.8, DIM);
    T('MASTER', 1094, 722, 5.2, INK); T('TEMPO', 1094, 731, 5.2, INK);
    // direction and search
    T('DIRECTION', 474, 676, 5.6, INK); T('SLIP REV', 514, 694, 4.8, INK); T('FWD', 514, 707, 4.8, INK); T('REV', 514, 721, 4.8, '#e0402f');
    T('TRACK SEARCH', 493, 762, 5.6, INK); T('SEARCH', 493, 820, 5.6, INK);
    T('PLAY / PAUSE', 494, 985, 6, INK, 'center', 700);
    // jog wheel text
    T('REV', 615, 979, 5.8, DIM); T('FWD', 972, 979, 5.8, DIM);
    // tempo slider
    T('TEMPO', 1094, 1041, 6.4, INK, 'center', 700);
    const [fx] = ph(1062, 0);
    for (let k = 0; k <= 12; k++) { const [, y] = ph(0, 782 + k * 21.5); ln([[fx + 2, y], [fx + 6 + (k % 6 === 0 ? 4 : 0), y]], INK, 0.8); }
    T('+', 1062, 1025, 8, INK); T('0', 1062, 915, 6, INK); T('-', 1062, 790, 8, INK);
    T('TEMPO', 1026, 940, 4.6, DIM); T('RESET', 1026, 947, 4.6, DIM);
    // screws
    [[16, BODY_Y0 + 14], [784, BODY_Y0 + 14], [16, 1084], [784, 1084]].forEach(([x, y]) => { dot(x, y, 4.2, '#0a0b0d'); dot(x, y, 2.6, '#2b3239'); });
  });
  panel.anisotropy = 16;

  const chassis = new THREE.MeshStandardMaterial({ color: 0x131519, roughness: 0.45, metalness: 0.6 });
  const BH = XH - 0.18, BD = (FH - BODY_Y0) * PX;                       // the body, and below it the feet
  const body = new THREE.Mesh(new RoundedBoxGeometry(XW, BH, BD, 3, 0.05), chassis);
  body.position.set(0, -BH / 2, WZ(BODY_Y0) + BD / 2); body.name = 'cj_body'; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xaab0b8, roughness: 0.28, metalness: 1 });
  [[70, 160], [730, 160], [70, 1030], [730, 1030]].forEach(([x, y]) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.18, 32), chrome);
    f.position.set(WX(x), -BH - 0.09, WZ(y)); f.name = 'cj_body'; f.castShadow = true; g.add(f);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(XW, XD), new THREE.MeshStandardMaterial({ map: panel, roughness: 0.5, metalness: 0.35, transparent: true, alphaTest: 0.5 }));
  plate.rotation.x = -Math.PI / 2; plate.position.y = 0.002; plate.name = 'cj_plate'; plate.receiveShadow = true; g.add(plate);

  const { u, dark, metal, col, glow, add, knob, button, pad, small, led, toggle, fader } = makeKit(THREE, g, WX, WZ, PX, R, R.blinkers);
  const P = (px, py) => ph(px, py);                               // photo position to layout position
  const kn = (n, px, py, rphoto, ang) => { const [x, y] = P(px, py); knob(n, x, y, rphoto * K1 / 0.78, ang); };
  const bt = (n, px, py, rphoto, light, k) => { const [x, y] = P(px, py); button(n, x, y, rphoto * K1, light, k); };
  const pd = (n, px, py, w, h, hex, lit, capHex) => { const [x, y] = P(px, py); pad(n, x, y, w * K1, h * K1, hex, lit, capHex); };

  // ---------- the screen unit: a sloping slab that stands out behind the body ----------
  {
    const W = (SLAB.x2 - SLAB.x1) * PX, D = SLAB.y2 * PX;
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(D, 0); shape.lineTo(D, SLAB.hF); shape.lineTo(0, SLAB.hB); shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2); geo.translate(W / 2, 0, 0);
    const slab = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.3, metalness: 0.6 }));
    slab.position.set(WX((SLAB.x1 + SLAB.x2) / 2), 0, WZ(0)); slab.name = 'cj_body'; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    // the printed top of the unit
    const topTex = canvasTexture(THREE, 1690, 1125, (c, w, h) => {
      const k = w / (SLAB.x2 - SLAB.x1);
      c.fillStyle = '#101216'; c.fillRect(0, 0, w, h);
      const T = (txt, x, y, size, color) => { c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `600 ${size * k}px Inter, Arial, sans-serif`; c.fillText(txt, (x - SLAB.x1) * k, y * k); };
      const names = ['SOURCE', 'BROWSE', 'TAG LIST', 'PLAYLIST', 'SEARCH', 'MENU'];
      names.forEach((s, i) => { const x = 180.5 + 87.7 * i; T(s, x, 52 + 18, 6.4, i === 0 || i === 5 ? '#e8ebef' : '#62d6f5'); });
      c.strokeStyle = '#2a2f36'; c.lineWidth = 2 * k; c.beginPath(); c.roundRect((158 - SLAB.x1) * k, 86 * k, 483 * k, 266 * k, 8 * k); c.stroke();
      c.fillStyle = '#080a0d'; c.beginPath(); c.roundRect((158 - SLAB.x1) * k, 86 * k, 483 * k, 266 * k, 8 * k); c.fill();
      c.strokeStyle = '#62d6f5'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo((340 - SLAB.x1) * k, 6 * k); c.lineTo((460 - SLAB.x1) * k, 6 * k); c.stroke();
    });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D / Math.cos(SLOPE)), new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35, metalness: 0.3 }));
    top.rotation.x = -Math.PI / 2 + SLOPE; top.name = 'cj_body';
    top.position.set(WX((SLAB.x1 + SLAB.x2) / 2), (SLAB.hB + SLAB.hF) / 2 + 0.002, WZ(SLAB.y2 / 2)); top.receiveShadow = true; g.add(top);
    // the live screen
    const screen = makeScreen(THREE); R.screen = screen;
    const sw = 483 * K1 / K1 * PX, sh = 266 * PX / Math.cos(SLOPE);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshStandardMaterial({ map: screen.tex, emissive: 0xffffff, emissiveMap: screen.tex, emissiveIntensity: 0.9, roughness: 0.3 }));
    scr.rotation.x = -Math.PI / 2 + SLOPE; scr.name = 'cj_display';
    scr.position.set(WX(400), hAt(219) + 0.005, WZ(219)); g.add(scr); R.displayMesh = scr;
    // the six buttons along the top edge
    for (let i = 0; i < 6; i++) {
      const x = 180.5 + 87.7 * i, y = 52;
      const m = new THREE.Mesh(new RoundedBoxGeometry(78 * PX, 0.045, 20 * PX, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x1d2229, roughness: 0.4, metalness: 0.3 }));
      m.rotation.x = SLOPE; m.name = 'cj_nav'; m.castShadow = true;
      m.position.set(WX(x), hAt(y) + 0.02, WZ(y)); g.add(m);
      R.controls.push({ type: 'button', name: 'cj_nav', x, y, objs: [m], cap: m, capY: m.position.y, on: false, leds: [], tint: true });
    }
  }

  // media slots: a dark slot with a metal lip, the USB one lit blue
  {
    const slot = (x1, y1, x2, y2, usb) => {
      const [a, b] = P(x1, y1), [d, e] = P(x2, y2);
      add(new THREE.Mesh(new THREE.BoxGeometry(u(d - a), 0.02, u(e - b)), dark), 'cj_media', (a + d) / 2, (b + e) / 2, 0.012);
      add(new THREE.Mesh(new THREE.BoxGeometry(u(d - a) - 0.02, 0.03, 0.012), usb ? glow(0x2f7cff, 1.1) : metal), 'cj_media', (a + d) / 2, b + 4, 0.02);
      return [(a + d) / 2, (b + e) / 2];
    };
    const [ux, uy] = slot(449, 178, 497, 224, true); slot(449, 262, 528, 306, false);
    R.usbSlot = { x: ux, y: uy };
  }
  bt('cj_eject', 518, 240, 9);

  // browsing: the rotary selector and four buttons sit on a small block attached to the side of the screen unit, at the same slope
  {
    const y1 = 96, y2 = 335, x1 = 683, x2 = 778;
    const W = (x2 - x1) * PX, D = (y2 - y1) * PX;
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(D, 0); sh.lineTo(D, hAt(y2)); sh.lineTo(0, hAt(y1)); sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false }); geo.rotateY(-Math.PI / 2); geo.translate(W / 2, 0, 0);
    const blk = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.35, metalness: 0.55 }));
    blk.position.set(WX((x1 + x2) / 2), 0, WZ(y1)); blk.name = 'cj_body'; blk.castShadow = true; blk.receiveShadow = true; g.add(blk);
    const first = R.controls.length, extra = [];
    { const [x, y] = P(1080, 293); extra.push({ m: add(new THREE.Mesh(new THREE.CylinderGeometry(u(46), u(46), 0.03, 40), metal), 'cj_browse', x, y, 0.015), x, y }); }
    kn('cj_browse', 1080, 293, 28, 2.356);
    pd('cj_back', 1060, 224, 34, 30); pd('cj_tagtrack', 1096, 224, 34, 30);
    pd('cj_trackfilter', 1060, 360, 34, 30); pd('cj_shortcut', 1095, 360, 34, 30);
    // lift each of them onto the slope: a tilted group at the control's place, holding its meshes
    const items = R.controls.slice(first).map((ct) => ({ x: ct.x, y: ct.y, objs: ct.objs })).concat(extra.map((e) => ({ x: e.x, y: e.y, objs: [e.m] })));
    items.forEach((it) => {
      const grp = new THREE.Group(); grp.position.set(WX(it.x), hAt(it.y), WZ(it.y)); grp.rotation.x = SLOPE; g.add(grp);
      it.objs.forEach((o) => { o.position.x -= grp.position.x; o.position.z -= grp.position.z; grp.add(o); });
    });
  }
  bt('cj_timemode', 488, 358, 14);
  pd('cj_slip', 467, 402, 34, 18, 0xe0402f, false, 0x6b1b1b); pd('cj_quantize', 510, 402, 34, 18, 0xe0402f, false, 0x6b1b1b);

  // hot cue pads: dark pads with a coloured bar printed underneath; they light up when pressed
  PADHEX.forEach((hex, i) => { const x = PADX(i), y = PADY; pad('cj_pad', x, y, 52, 24, hex, false, 0x14161a); });
  pd('cj_delete', 475, 472, 40, 28);
  bt('cj_loop', 472, 525, 17, 0xf0a030, 1.5); bt('cj_loop', 527, 525, 17, 0xf0a030, 1.5); bt('cj_loop', 594, 525, 16);
  bt('cj_loop', 472, 582, 13, 0xf0a030, 0.9); bt('cj_loop', 527, 582, 13, 0xf0a030, 0.9);
  pd('cj_loop', 471, 632, 34, 22); pd('cj_loop', 527, 632, 34, 22);
  bt('cj_call', 894, 523, 11); bt('cj_call', 933, 523, 11); bt('cj_delete', 980, 523, 13); bt('cj_memory', 1020, 523, 11);
  kn('cj_vinylspeed', 1092, 470, 24, 0);
  pd('cj_jogmode', 1075, 523, 28, 20, 0x3a9cff, true, 0x14161a); pd('cj_jogmode', 1115, 523, 28, 20);
  kn('cj_jogadjust', 992, 590, 18, 0);
  pd('cj_sync', 1072, 588, 28, 20); pd('cj_master', 1115, 588, 28, 20, 0xf0a030, true, 0x14161a); pd('cj_keysync', 1094, 625, 30, 18, 0x3a9cff, false, 0x14161a);
  bt('cj_range', 1094, 697, 9); bt('cj_mastertempo', 1094, 748, 10, 0xe0402f, 1.4);
  // direction slide switch
  { const [x, y] = P(475, 708); toggle('cj_direction', x, y, 0); }
  bt('cj_tsearch', 471, 790, 17); bt('cj_tsearch', 515, 790, 17); bt('cj_search', 471, 848, 17); bt('cj_search', 515, 848, 17);
  bt('cj_cue', 494, 932, 39); bt('cj_play', 494, 1032, 39);
  R.controls.filter((ct) => ct.name === 'cj_cue' || ct.name === 'cj_play').forEach((ct) => { ct.ringAlways = true; ct.ring.visible = true; });   // the orange and green rings are always lit
  bt('cj_temporeset', 1026, 915, 12);
  { const [x] = P(1095, 0); const [, y1] = P(0, 782), [, y2] = P(0, 1050), [, yc] = P(0, 915); fader('cj_tslot', 'cj_tempo', x, y1, y2, yc, 56, 0.10); }

  // the jog wheel: a metal rim, a turning top (glossy centre and a dimpled ring) and a small round display
  {
    const jog = new THREE.Group(); jog.name = 'cj_jog';
    const RIM = 272, TOPR = 262;
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xa6adb6, roughness: 0.28, metalness: 1 });
    const ring = add(new THREE.Mesh(new THREE.CylinderGeometry(u(RIM), u(RIM), 0.09, 72), ringMat), 'cj_jogring', JOG.x, JOG.y, 0.045);
    const topTex = canvasTexture(THREE, 1536, 1536, (c, w, h) => {
      const m = w / 2;
      c.fillStyle = '#17191d'; c.fillRect(0, 0, w, h);
      // glossy black centre with a soft reflection
      const gc = c.createRadialGradient(m - 120, m - 160, 20, m, m, m * 0.78); gc.addColorStop(0, '#2a2d33'); gc.addColorStop(0.5, '#0a0b0d'); gc.addColorStop(1, '#050506');
      c.fillStyle = gc; c.beginPath(); c.arc(m, m, m * 0.775, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 2;
      for (let r = 0.2; r < 0.76; r += 0.02) { c.beginPath(); c.arc(m, m, r * m, 0, Math.PI * 2); c.stroke(); }
      // the ring with its dimples
      c.fillStyle = '#25282d'; c.beginPath(); c.arc(m, m, m * 0.99, 0, Math.PI * 2); c.arc(m, m, m * 0.78, 0, Math.PI * 2, true); c.fill();
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * Math.PI * 2, rr = m * 0.885;
        const dx = m + Math.cos(a) * rr, dy = m + Math.sin(a) * rr;
        c.save(); c.translate(dx, dy); c.rotate(a);
        const g2 = c.createRadialGradient(-6, -6, 2, 0, 0, 60); g2.addColorStop(0, '#0d0e10'); g2.addColorStop(0.7, '#1c1e22'); g2.addColorStop(1, '#383c43');
        c.fillStyle = g2; c.beginPath(); c.ellipse(0, 0, 42, 58, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      // the position marker
      c.fillStyle = '#f2f4f7'; c.beginPath(); c.arc(m, m * 0.30, 16, 0, Math.PI * 2); c.fill();
    });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(u(TOPR), u(TOPR), 0.03, 72), [new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.3, metalness: 0.35 }), new THREE.MeshStandardMaterial({ color: 0x15171b })]);
    top.name = 'cj_jog'; top.castShadow = true; top.receiveShadow = true;
    top.position.set(0, 0.105, 0); jog.add(top);
    jog.position.set(WX(JOG.x), 0, WZ(JOG.y)); g.add(jog);
    // the round display in the middle: a blue arc, a white ring and a red ring around the cover picture
    const dTex = canvasTexture(THREE, 512, 512, (c, w, h) => {
      const m = w / 2; c.fillStyle = '#06080b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#06080b'; c.beginPath(); c.arc(m, m, m, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2f7cff'; c.lineWidth = 46; c.beginPath(); c.arc(m, m, m * 0.84, Math.PI * 0.62, Math.PI * 1.38); c.stroke();
      c.beginPath(); c.arc(m, m, m * 0.84, -Math.PI * 0.38, Math.PI * 0.38); c.stroke();
      c.strokeStyle = '#f2f4f7'; c.lineWidth = 30; c.beginPath(); c.arc(m, m, m * 0.6, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#e0402f'; c.lineWidth = 26; c.beginPath(); c.arc(m, m, m * 0.44, 0, Math.PI * 2); c.stroke();
      const gr = c.createLinearGradient(m - 80, m - 80, m + 80, m + 80); gr.addColorStop(0, '#ff5aa0'); gr.addColorStop(1, '#ffb23f');
      c.fillStyle = gr; c.beginPath(); c.arc(m, m, m * 0.32, 0, Math.PI * 2); c.fill();
    });
    const dispMat = [new THREE.MeshStandardMaterial({ color: 0x05080b }), new THREE.MeshStandardMaterial({ map: dTex, emissive: 0xffffff, emissiveMap: dTex, emissiveIntensity: 0.55, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: 0x05080b })];
    const cd = add(new THREE.Mesh(new THREE.CylinderGeometry(u(82), u(82), 0.02, 48), dispMat), 'cj_jogdisplay', JOG.x, JOG.y, 0.13); cd.userData.noSpin = true;
    R.jog = jog;
    R.controls.push({ type: 'jog', name: 'cj_jog', x: JOG.x, y: JOG.y, objs: [top, ring], jog, spin: 0 });
  }

  // the back: line out and the connections (the back of the body, under the screen unit)
  {
    const K = XW / 960, RX = (x) => XW / 2 - x * K, RY = (y) => -y * K, BZ = WZ(BODY_Y0);
    const tex = canvasTexture(THREE, 1920, 480, (c, w, h) => {
      c.fillStyle = '#0d0d10'; c.fillRect(0, 0, w, h);
      const F = 2; c.fillStyle = '#f2f2f2';
      const T = (txt, x, y, size, align = 'center') => { c.font = `700 ${size * F}px Inter, Arial, sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(txt, x * F, y * F); };
      T('AUDIO OUT', 480, 40, 12); T('R', 440, 80, 9); T('L', 520, 80, 9);
      T('DIGITAL OUT', 700, 40, 10); T('LINK', 250, 40, 11); T('AC IN', 870, 40, 10);
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(XW, BH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 }));
    back.rotation.y = Math.PI; back.position.set(0, -BH / 2, BZ - 0.003); back.name = 'cj_body'; g.add(back);
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a84e, metalness: 0.9, roughness: 0.3 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, metalness: 0.9, roughness: 0.32 });
    const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.8 });
    const grey = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6, metalness: 0.2 });
    const cyl = (r, depth, mat, name, x, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * K, r * K, depth, 24), mat); m.rotation.x = Math.PI / 2; m.position.set(RX(x), RY(y), BZ - depth / 2); m.name = name; m.castShadow = true; g.add(m); return m; };
    [440, 520].forEach((x) => { cyl(15, 0.05, gold, 'cr_out', x, 130); cyl(9, 0.052, black, 'cr_out', x, 130); cyl(2.4, 0.05, gold, 'cr_out', x, 130); });
    cyl(14, 0.05, steel, 'cr_digital', 700, 130); cyl(9, 0.052, black, 'cr_digital', 700, 130);
    cyl(16, 0.05, grey, 'cr_link', 250, 130); cyl(10, 0.052, black, 'cr_link', 250, 130);
    const mains = new THREE.Mesh(new THREE.BoxGeometry(70 * K, 36 * K, 0.05), grey); mains.position.set(RX(870), RY(130), BZ - 0.025); mains.name = 'cr_mains'; g.add(mains);
  }

  finishRig(R);
  return g;
}

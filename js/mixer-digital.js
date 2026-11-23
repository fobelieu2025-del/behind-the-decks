// Behind the Decks: mixer-digital.js
// The four-channel digital club mixer of the digital page, drawn in code from reference photos of a current
// four-channel club mixer: a black face with white printing, USB ports and microphone section on the left,
// four channels (input selector, trim, three EQ knobs, colour knob, cue buttons, fader), the master and booth
// section, and the Beat FX section with its small screen and touch strip on the right. It carries no brand
// name, model number or logo. Every control is its own mesh, named by what it does, so content.js can describe
// it. The names that start with "xi_" are the ones the sound engine listens to.

import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, rig, clamp01, makeKit, finishRig } from './kit.js';

// The layout is measured on the reference photo (top view): the face runs from x 372 to 1232 and y 187 to 1082.
const OX = 372, OY = 187;
const FW = 860, FH = 895;                           // the face of the mixer, in layout units
const XW = 3.3, XD = XW * FH / FW, XH = 0.8;        // width, depth and height in scene units
const PX = XW / FW;                                 // scene units per layout unit
const WX = (x) => x * PX - XW / 2, WZ = (y) => y * PX - XD / 2;
const CHX = [632, 723, 814, 905];                   // x centre of the four channels (photo position)
const METER_Y = Array.from({ length: 12 }, (_, i) => 316 + i * 18.55);
const FADE_Y1 = 788, FADE_Y2 = 932;

export function djm(THREE) {
  const g = new THREE.Group();
  rig.controls.length = 0; rig.leds.length = 0; rig.meters.length = 0; rig.root = g; rig.cueActive = null;
  rig.toPx = (lx, lz) => ({ x: (lx + XW / 2) / PX, y: (lz + XD / 2) / PX });
  rig.WX = WX; rig.WZ = WZ; rig.PX = PX; rig.jack = { x: 529 - OX, y: 1000 - OY };
  const S = 2560 / FW;
  const cx = (x) => (x - OX) * S, cy = (y) => (y - OY) * S;         // the printing is positioned with photo coordinates

  // ---------- printed panel ----------
  const panel = canvasTexture(THREE, 2560, Math.round(FH * S), (c, w, h) => {
    const rr = (x1, y1, x2, y2, r, fill, stroke, lw = 1) => {
      c.beginPath(); c.roundRect(cx(x1), cy(y1), (x2 - x1) * S, (y2 - y1) * S, r * S);
      if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw * S; c.stroke(); }
    };
    const grd = c.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#15171b'); grd.addColorStop(1, '#101215');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.025)'; c.lineWidth = 1; for (let y = 0; y < h; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    const INK = '#eceff3', DIM = '#b4bbc4';
    const t = (txt, x, y, size = 10, col = INK, align = 'center', weight = 600) => { c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.font = `${weight} ${size * S}px Inter, Arial, sans-serif`; c.fillText(txt, cx(x), cy(y)); };
    const ln = (pts, col = INK, lw = 1.1) => { c.strokeStyle = col; c.lineWidth = lw * S; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(cx(x), cy(y)) : c.moveTo(cx(x), cy(y)))); c.stroke(); };
    const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx(x), cy(y), r * S, 0, Math.PI * 2); c.fill(); };
    const dashes = (x, y, r, col = '#f2f4f7') => { c.strokeStyle = col; c.lineWidth = 2.6 * S; c.setLineDash([3.4 * S, 2.8 * S]); c.beginPath(); c.arc(cx(x), cy(y), r * S, 135 * Math.PI / 180, 405 * Math.PI / 180); c.stroke(); c.setLineDash([]); };
    const ticks = (x, y, r, n = 11, col = DIM) => {
      c.strokeStyle = col; c.lineWidth = 1.1 * S;
      for (let i = 0; i < n; i++) { const a = (135 + 270 * i / (n - 1)) * Math.PI / 180; c.beginPath(); c.moveTo(cx(x + Math.cos(a) * r), cy(y + Math.sin(a) * r)); c.lineTo(cx(x + Math.cos(a) * (r + 4)), cy(y + Math.sin(a) * (r + 4))); c.stroke(); }
    };
    const arcLabels = (x, y, r, labels, size = 5.4, col = DIM) => labels.forEach((s, i) => { const a = (135 + 270 * i / (labels.length - 1)) * Math.PI / 180; t(s, x + Math.cos(a) * r, y + Math.sin(a) * r, size, col); });
    const bracket = (x1, y1, x2, y2, label, size = 8) => {            // a frame with its title sitting in a gap of the top line
      const half = label.length * size * 0.36 + 5, mid = (x1 + x2) / 2;
      ln([[x1 + 6, y1], [x1, y1], [x1, y2], [x2, y2], [x2, y1], [x2 - 6, y1]], '#d8dde3', 1);
      ln([[x1 + 6, y1], [mid - half, y1]], '#d8dde3', 1); ln([[mid + half, y1], [x2 - 6, y1]], '#d8dde3', 1);
      t(label, mid, y1, size, INK, 'center', 700);
    };
    // the panel splits
    [[478, 300, 478, 1075], [581, 205, 581, 1075], [952, 205, 952, 1075], [1050, 205, 1050, 345]].forEach(([a, b, d, e]) => ln([[a, b], [d, e]], 'rgba(235,240,245,0.35)', 0.9));
    ln([[1050, 345], [1218, 345]], 'rgba(235,240,245,0.35)', 0.9);

    // ----- left: USB, microphone, headphones A -----
    t('USB', 476, 215, 8, INK, 'center', 700);
    [[393, 462, 'A'], [490, 560, 'B']].forEach(([x1, x2, n]) => { rr(x1, 243, x2, 281, 4, '#050506', '#59636d', 1); rr(x1 + 2, 277, x2 - 2, 281, 2, '#2f7cff'); t(n, (x1 + x2) / 2, 237, 6.4, DIM, 'center', 700); });
    t('LEVEL', 460, 364, 5.4, DIM); t('1', 400, 332, 6.4, INK, 'center', 700); t('2', 400, 382, 6.4, INK, 'center', 700);
    ticks(427, 339, 25, 11); ticks(427, 389, 25, 11);
    t('EQ', 462, 472, 6.4, INK, 'center', 700); t('HI', 396, 440, 6, INK, 'center', 700); t('LOW', 392, 498, 6, INK, 'center', 700);
    ticks(427, 447, 25, 11); ticks(427, 497, 25, 11);
    t('TALKOVER', 427, 535, 6.2, INK, 'center', 700);
    t('MIC FX', 427, 583, 6.4, INK, 'center', 700);
    t('PARAMETER', 427, 725, 5.4, DIM); ticks(427, 752, 25, 11);
    t('MIC REVERB', 427, 802, 6.4, INK, 'center', 700); t('PARAMETER', 427, 852, 5.4, DIM); ticks(427, 877, 25, 11);
    t('BEAT FX', 427, 930, 4.8, DIM);
    t('MIC', 427, 972, 6.4, INK, 'center', 700); t('PUSH TO TALK', 427, 982, 4.4, DIM);
    // second column
    t('MIC 1 PHANTOM', 529, 323, 4.8, DIM); t('BLUETOOTH', 529, 372, 4.8, DIM); t('PAIRING', 529, 380, 4.4, DIM);
    t('MIDI', 529, 425, 5, DIM); t('ON/OFF', 529, 432, 4.4, DIM); t('MIDI', 529, 470, 5, DIM); t('START/STOP', 529, 477, 4.4, DIM);
    bracket(487, 506, 573, 774, 'SOUND COLOR FX', 6.4);
    t('CENTER LOCK', 529, 524, 5, INK); t('OFF', 507, 541, 4.4, DIM); t('ON', 553, 541, 4.4, DIM);
    [['SPACE', 507, 606], ['DUB ECHO', 551, 606], ['CRUSH', 507, 649], ['SWEEP', 551, 649], ['NOISE', 507, 692], ['FILTER', 551, 692]].forEach(([s, x, y]) => t(s, x, y + 17, 4.4, INK));
    t('PARAMETER', 529, 726, 5.4, DIM); ticks(529, 752, 25, 11);
    bracket(487, 788, 573, 1030, 'HEADPHONES A', 6.2);
    t('LINK', 507, 806, 4.4, INK); t('CUE', 507, 812, 4.4, INK); t('MONO', 551, 806, 4.4, INK); t('SPLIT', 551, 812, 4.4, INK);
    t('MIX', 529, 855, 5.4, DIM); t('CUE', 500, 898, 4.6, DIM); t('MASTER', 560, 898, 4.6, DIM); ticks(529, 877, 25, 11);
    t('LEVEL', 529, 913, 5.4, DIM); ticks(529, 935, 25, 11); t('PHONES A', 529, 1020, 5, DIM);

    // ----- the four channels -----
    [[CHX[0] + 45.5], [CHX[1] + 45.5], [CHX[2] + 45.5]].forEach(([x]) => ln([[x, 205], [x, 1070]], 'rgba(235,240,245,0.3)', 0.8));
    CHX.forEach((x, i) => {
      t(String(i + 1), x - 28, 302, 13, INK, 'center', 800);
      arcLabels(x, 266, 29, ['DIGITAL', 'LINE', 'PHONO'], 4.4); arcLabels(x, 266, 26, ['B', 'A', ''], 3.6);
      t('TRIM', x + 2, 304, 5.2, DIM); ticks(x, 330, 20, 11); t('-∞', x - 14, 347, 4.4, DIM); t('+9', x + 14, 347, 4.4, DIM);
      [['EQ/', 'ISO', 'HI', 395], ['', '', 'MID', 463], ['', '', 'LOW', 531]].forEach(([a, b, lab, y]) => { t(lab, x - 4, y - 27, 5.6, INK, 'center', 700); dashes(x, y, 25); t('-26', x - 16, y + 25, 4.2, DIM); t('+6', x + 16, y + 25, 4.2, DIM); });
      t('COLOR', x, 590, 6.4, INK, 'center', 700); ticks(x, 628, 32, 15); t('LOW', x - 24, 662, 4.6, DIM); t('HI', x + 24, 662, 4.6, DIM);
      t('A', x - 17, 688, 5, INK, 'center', 700); t('B', x + 23, 688, 5, INK, 'center', 700); t('BEAT FX', x + 4, 750, 4.4, DIM);
      for (let k = 0; k < 11; k++) { const y = FADE_Y1 + 6 + k * ((FADE_Y2 - FADE_Y1 - 12) / 10); ln([[x + 30, y], [x + 38, y]], '#e6e9ed', 0.9); if (k % 2 === 0) t(String(10 - k), x + 45, y, 4.4, DIM); }
      t('A', x - 24, 975, 5.4, INK, 'center', 700); t('THRU', x, 975, 4.2, INK); t('B', x + 24, 975, 5.4, INK, 'center', 700);
    });
    t('CROSSFADER ASSIGN', 767, 996, 4.8, DIM); ln([[585, 990], [700, 990]], 'rgba(235,240,245,0.45)', 0.8); ln([[835, 990], [945, 990]], 'rgba(235,240,245,0.45)', 0.8);
    // the crossfader
    t('◀A', 683, 1035, 9, INK, 'center', 700); t('B▶', 855, 1035, 9, INK, 'center', 700);
    ln([[712, 1022], [712, 1048]], DIM, 0.8); ln([[822, 1022], [822, 1048]], DIM, 0.8);
    t('CROSSFADER', 767, 1070, 4.4, DIM);

    // ----- master and booth -----
    t('MASTER', 1002, 215, 6.4, INK, 'center', 700); t('LEVEL', 1002, 224, 4.8, DIM); ticks(1002, 253, 26, 11);
    t('L', 983, 303, 5.2, DIM, 'center', 700); t('R', 1026, 303, 5.2, DIM, 'center', 700);
    t('CLIP', 1004, 296, 4, '#e0402f');
    t('BOOTH EQ', 1002, 538, 5, INK, 'center', 700); t('HI', 981, 560, 4.6, INK); t('LOW', 981, 604, 4.6, INK); t('BOOTH', 1002, 630, 4.6, INK); t('LEVEL', 1002, 638, 4.6, INK);
    ticks(1002, 558, 20, 9); ticks(1002, 603, 20, 9); ticks(1002, 652, 20, 9);
    t('A', 987, 690, 4.8, INK, 'center', 700); t('B', 1027, 690, 4.8, INK, 'center', 700);
    bracket(962, 765, 1044, 905, 'HEADPHONES B', 5.4);
    t('LINK CUE', 990, 785, 4, INK); t('MONO SPLIT', 1028, 785, 4, INK); t('MIX', 1003, 810, 4.8, DIM); t('CUE', 985, 838, 4.2, DIM); t('MASTER', 1024, 838, 4.2, DIM);
    t('LEVEL', 1003, 862, 4.8, DIM); ticks(1003, 880, 20, 9);
    t('EQ CURVE', 1003, 915, 4.4, DIM); t('ISO', 983, 928, 4.6, INK); t('EQ', 1023, 928, 4.6, INK);
    t('CH FADER', 1003, 955, 4.4, DIM); t('CROSSFADER', 1003, 997, 4.4, DIM);
    [[985, 975], [1003, 975], [1021, 975]].forEach(([x, y], k) => ln([[x - 5, y + 3 - k], [x + 5, y - 3 + k]], INK, 0.9));
    [[985, 1019], [1003, 1019], [1021, 1019]].forEach(([x, y], k) => ln([[x - 5, y + 3], [x - 2 + k, y - 3], [x + 5, y + 3]], INK, 0.9));

    // ----- multi I/O and Beat FX -----
    t('MULTI I/O', 1140, 217, 6.4, INK, 'center', 700);
    t('SEND CH', 1078, 244, 4.4, DIM); t('INSERT SOURCE', 1138, 243, 4, DIM); t('SEND LEVEL', 1078, 300, 4.4, DIM); t('INSERT', 1136, 300, 4.6, INK);
    ticks(1078, 264, 18, 9); ticks(1078, 322, 18, 9);
    t('BEAT FX', 1137, 355, 6.4, INK, 'center', 700);
    // the small screen
    rr(1063, 366, 1211, 490, 5, '#06090c', '#59636d', 1);
    t('QUANTIZE', 1086, 389, 4.4, '#e0402f'); t('120.0', 1170, 391, 11, '#eef6ff', 'center', 700); t('BPM', 1199, 395, 3.8, DIM);
    t('MOBIUS', 1137, 404, 9, '#eef6ff', 'center', 700);
    rr(1070, 414, 1204, 430, 2, '#0b1218'); rr(1117, 414, 1156, 430, 2, '#f4f6f8'); t('1/2', 1095, 422, 5.4, DIM); t('1', 1137, 422, 5.4, '#050607', 'center', 700); t('2', 1180, 422, 5.4, DIM);
    rr(1070, 438, 1204, 450, 2, '#6a3cff'); t('X-PAD', 1137, 444, 4.2, '#eef6ff', 'center', 700);
    rr(1070, 456, 1204, 482, 2, '#0b1218'); ['∏', '⋀', '⋀'].forEach((s, k) => t(s, 1090 + k * 45, 470, 8, DIM));
    t('X-PAD', 1137, 499, 5, INK, 'center', 700);
    rr(1066, 507, 1209, 536, 6, '#0b1217', '#2f7f95', 1.2);
    t('BEAT', 1137, 566, 5.4, INK, 'center', 700);
    t('AUTO', 1097, 590, 4, INK); t('/TAP', 1097, 597, 4, INK); t('QUANTIZE', 1177, 590, 4, INK); t('UTILITY', 1177, 624, 3.6, DIM);
    t('FX FREQUENCY', 1137, 637, 5, DIM);
    t('CH SELECT', 1137, 790, 5, DIM);
    ['1', '2', '3', '4'].forEach((s, k) => t(s, 1085 + k * 34, 751, 5.8, INK, 'center', 700));
    ['MIC', 'CF.A', 'CF.B', 'MST'].forEach((s, k) => t(s, 1085 + k * 34, 828, 4.4, INK));
    t('TIME', 1137, 848, 6, INK, 'center', 700); ticks(1137, 873, 22, 11);
    t('LEVEL/DEPTH', 1137, 915, 5.4, INK, 'center', 700); ticks(1137, 943, 22, 11);
    t('MIN', 1112, 965, 4, DIM); t('MAX', 1164, 965, 4, DIM);
    t('ON/OFF', 1137, 1055, 5.4, INK, 'center', 700);
    // screws
    [[394, 207], [1214, 207], [394, 1062], [1214, 1062], [631, 207], [631, 1008], [952, 1008]].forEach(([x, y]) => { dot(x, y, 3.8, '#08090b'); dot(x, y, 2.4, '#2a3037'); });
  });
  panel.anisotropy = 16;

  const chassis = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.5, metalness: 0.6 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(XW, XH, XD, 3, 0.05), chassis);
  body.position.y = -XH / 2; body.name = 'dj_body'; body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(XW, XD), new THREE.MeshStandardMaterial({ map: panel, roughness: 0.5, metalness: 0.25 }));
  plate.rotation.x = -Math.PI / 2; plate.position.y = 0.002; plate.name = 'dj_plate'; plate.receiveShadow = true;
  g.add(plate);
  // the aerial standing at the back left corner
  {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 12), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.5 }));
    ant.position.set(WX(426 - OX), 0.31, WZ(8)); ant.name = 'dj_body'; ant.castShadow = true; g.add(ant);
    const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.5 }));
    nub.position.set(WX(426 - OX), 0.04, WZ(8)); nub.name = 'dj_body'; g.add(nub);
  }

  const { u, dark, metal, col, glow, add, knob, button, pad, small, led, toggle, fader, ledColumn } = makeKit(THREE, g, WX, WZ, PX);
  // everything below is placed with photo coordinates
  const SK = 0.8, SB = 0.72;                                     // the knobs and buttons are drawn a little smaller than the first version
  const kn = (n, x, y, rphoto, ang) => knob(n, x - OX, y - OY, rphoto * SK / 0.78, ang);
  const bt = (n, x, y, r, light, k) => button(n, x - OX, y - OY, r * SB, light, k);
  const pd = (n, x, y, w, h, hex, lit, capHex) => pad(n, x - OX, y - OY, w * SB, h * SB, hex, lit, capHex);
  const zone = (name, x1, y1, x2, y2) => {                        // an invisible pad over a printed area, so it can be pointed at
    const m = new THREE.Mesh(new THREE.BoxGeometry(u(x2 - x1), 0.02, u(y2 - y1)), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    return add(m, name, (x1 + x2) / 2 - OX, (y1 + y2) / 2 - OY, 0.012);
  };
  const A = (n) => (n % 2 ? 0.2 : -0.15);                          // a little variety in where the pointers rest
  const BLUE = 0x3a9cff, AMB = 0xf0a030, SOFT = 0x5a626c;

  // ---- left: USB ports, microphone, headphones A ----
  zone('dj_usb', 393, 243, 462, 281); zone('dj_usb', 490, 243, 560, 281);
  kn('dj_miclevel', 427, 339, 22, -0.4); kn('dj_miclevel', 427, 389, 22, -0.6);
  kn('dj_miceq', 427, 447, 22, 0); kn('dj_miceq', 427, 497, 22, 0);
  bt('dj_talkover', 427, 555, 15, 0xe0402f, 1.3);
  [606, 649, 692].forEach((y) => pd('dj_micfx', 427, y, 32, 20, BLUE, true, 0x161f30));
  kn('dj_micparam', 427, 752, 22, 0.2);
  pd('dj_micreverb', 427, 824, 32, 20, BLUE, true, 0x161f30);
  kn('dj_micparam2', 427, 877, 22, -0.2);
  bt('dj_micon', 427, 998, 17, BLUE, 1.5);
  bt('dj_phantom', 529, 338, 11, 0xe0402f, 1.3); pd('dj_bluetooth', 529, 391, 26, 16, BLUE, true, 0x161f30); pd('dj_midi', 529, 447, 26, 16, BLUE, false, 0x161f30); pd('dj_midistart', 529, 490, 26, 16, BLUE, false, 0x161f30);
  toggle('dj_lock', 529 - OX, 563 - OY, 1);
  [[507, 606], [551, 606], [507, 649], [551, 649], [507, 692], [551, 692]].forEach(([x, y], k) => pd('dj_colorfx', x, y, 32, 20, 0xe6edf7, k === 5, SOFT));
  kn('dj_colorparam', 529, 752, 22, 0);
  pd('dj_linkcue', 507, 824, 28, 18, AMB, false, 0x30251a); pd('dj_monosplit', 551, 824, 28, 18, AMB, false, 0x30251a);
  kn('xi_cuemix', 529, 877, 22, 0.5); kn('xi_plevel', 529, 935, 22, -0.4);
  add(new THREE.Mesh(new THREE.CylinderGeometry(u(14), u(14), 0.045, 24), new THREE.MeshStandardMaterial({ color: 0xc9a84e, metalness: 0.9, roughness: 0.3 })), 'xi_jack', 529 - OX, 1000 - OY, 0.022);
  add(new THREE.Mesh(new THREE.CylinderGeometry(u(7), u(7), 0.05, 16), dark), 'xi_jack', 529 - OX, 1000 - OY, 0.026);

  // ---- the four channels ----
  CHX.forEach((x, i) => {
    kn('dj_input', x, 266, 17, [0.55, 0.15, 0.15, -0.15][i]);
    kn('xi_trim', x, 330, 20, [0.3, 0, 0.4, -0.1][i]);
    kn('xi_hi', x, 395, 22, [-0.1, 0.2, -0.1, 0.1][i]); kn('xi_hm', x, 463, 22, [0.05, -0.15, 0.1, 0.2][i]); kn('xi_lo', x, 531, 22, [0.1, 0.05, -0.05, 0.1][i]);
    kn('dj_color', x, 628, 27, A(i) * 0.5);
    pd('xi_cue', x - 17, 704, 33, 19, 0xff8a2a, false, 0x3b2716); pd('dj_cueb', x + 23, 704, 33, 19, 0xff8a2a, false, 0x3b2716);
    led('dj_fxled', x + 4 - OX, 736 - OY, BLUE, i === 1 ? 1.5 : 0.25, 4);
    ledColumn('xi_meter', x - 33 - OX, METER_Y.map((y) => y - OY), [5, 4, 2, 5][i], 8);
    toggle('xi_xassign', x - OX, 957 - OY, 0);
    fader('xi_fslot', 'xi_fader', x - OX, FADE_Y1 - OY, FADE_Y2 - OY, [850, 835, 880, 845][i] - OY, 44, 0.10);
  });

  // ---- crossfader ----
  {
    const cxp = 767 - OX, cyp = 1035 - OY;
    add(new THREE.Mesh(new THREE.BoxGeometry(u(120), 0.012, u(7)), dark), 'xi_xslot', cxp, cyp, 0.006);
    add(new THREE.Mesh(new THREE.BoxGeometry(u(120), 0.016, 0.011), metal), 'xi_xslot', cxp, cyp, 0.018);
    const xc1 = add(new THREE.Mesh(new RoundedBoxGeometry(u(26), 0.1, 0.17, 2, 0.02), col(0x121418, 0.35)), 'xi_xfader', cxp, cyp, 0.06);
    const xc2 = add(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.104, 0.17), col(0xf4f5f8, 0.4)), 'xi_xfader', cxp, cyp, 0.062);
    rig.controls.push({ type: 'xfader', name: 'xi_xfader', x: cxp, y: cyp, objs: [xc1, xc2], lo: cxp - 45, hi: cxp + 45, value: 0.5,
      set(v) { this.value = clamp01(v); this.x = this.lo + this.value * (this.hi - this.lo); xc1.position.x = xc2.position.x = WX(this.x); } });
  }

  // ---- master and booth ----
  kn('xi_mix1', 1002, 253, 24, 0.6);
  ledColumn('xi_mmeter', 983 - OX, METER_Y.map((y) => y - OY), 6, 8); ledColumn('xi_mmeter', 1026 - OX, METER_Y.map((y) => y - OY), 6, 8);
  led('dj_clip', 1004 - OX, 288 - OY, 0xe0402f, 0.15, 4);
  kn('dj_boothhi', 1002, 558, 18, 0); kn('dj_boothlo', 1002, 603, 18, 0); kn('dj_boothlevel', 1002, 652, 20, 0.3);
  pd('dj_mastercue', 987, 704, 33, 19, 0xff8a2a, true, 0x3b2716); pd('dj_mastercue', 1027, 704, 33, 19, 0xff8a2a, false, 0x3b2716);
  pd('dj_linkcue', 990, 780, 26, 16, AMB, false, 0x30251a); pd('dj_monosplit', 1028, 780, 26, 16, AMB, false, 0x30251a);
  kn('dj_mixb', 1003, 826, 18, 0.5); kn('dj_levelb', 1003, 880, 18, -0.4);
  toggle('dj_eqcurve', 1003 - OX, 928 - OY, 0); toggle('dj_chcurve', 1003 - OX, 970 - OY, 0); toggle('dj_xcurve', 1003 - OX, 1012 - OY, 0);

  // ---- multi I/O and Beat FX ----
  kn('dj_sendch', 1078, 264, 18, 0); kn('dj_sendlevel', 1078, 322, 18, -0.5);
  bt('dj_insert', 1136, 322, 11, BLUE, 1.3); toggle('dj_insertsrc', 1138 - OX, 262 - OY, 0);
  zone('dj_fxscreen', 1063, 366, 1211, 490);
  // the Beat FX screen is a live canvas: effect name, tempo, beat length and depth follow the controls
  {
    const cv = document.createElement('canvas'); cv.width = 592; cv.height = 496;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const x = cv.getContext('2d');
    const draw = (st) => {
      x.clearRect(0, 0, 592, 496);
      x.fillStyle = '#06090c'; x.strokeStyle = '#59636d'; x.lineWidth = 4; x.beginPath(); x.roundRect(2, 2, 588, 492, 20); x.fill(); x.stroke();
      x.textBaseline = 'middle';
      x.textAlign = 'left'; x.fillStyle = st.quant ? '#e0402f' : '#3a1a18'; x.font = '700 22px Inter, Arial, sans-serif'; x.fillText('QUANTIZE', 28, 44);
      x.textAlign = 'right'; x.fillStyle = '#eef6ff'; x.font = '700 50px Inter, Arial, sans-serif'; x.fillText(st.bpm.toFixed(1), 520, 46);
      x.fillStyle = '#7c8794'; x.font = '600 18px Inter, Arial, sans-serif'; x.fillText(st.tap ? 'TAP' : 'BPM', 568, 52);
      x.textAlign = 'center'; x.fillStyle = st.on ? '#eef6ff' : '#8a94a1'; x.font = '700 46px Inter, Arial, sans-serif'; x.fillText(st.name, 296, 120);
      // beat length: the one before, the current one and the one after
      const labels = st.labels;
      [0, 1, 2].forEach((k) => {
        const bx = 24 + k * 180, w = 160;
        x.fillStyle = k === 1 ? '#f4f6f8' : '#0b1218'; x.beginPath(); x.roundRect(bx, 164, w, 62, 10); x.fill();
        x.fillStyle = k === 1 ? '#050607' : '#7c8794'; x.font = `700 ${k === 1 ? 36 : 28}px Inter, Arial, sans-serif`; x.fillText(labels[k], bx + w / 2, 196);
      });
      x.fillStyle = '#0b1218'; x.beginPath(); x.roundRect(24, 262, 544, 54, 10); x.fill();
      x.fillStyle = st.on ? '#8a5cff' : '#4a3a86'; x.beginPath(); x.roundRect(24, 262, Math.max(14, 544 * st.depth), 54, 10); x.fill();
      x.fillStyle = '#eef6ff'; x.font = '700 22px Inter, Arial, sans-serif'; x.fillText(st.on ? 'ON' : 'OFF', 296, 290);
      x.fillStyle = '#0b1218'; x.beginPath(); x.roundRect(24, 346, 544, 120, 10); x.fill();
      x.fillStyle = '#7c8794'; x.font = '600 20px Inter, Arial, sans-serif'; x.fillText(st.bands, 296, 372);
      x.fillStyle = st.chans ? '#9fd7ff' : '#5a6672'; x.font = '600 22px Inter, Arial, sans-serif'; x.fillText(st.chans || 'choose a channel', 296, 426);
      tex.needsUpdate = true;
    };
    draw({ quant: false, bpm: 120, tap: false, name: 'ECHO', on: false, labels: ['1/2', '1', '2'], depth: 0.5, bands: 'LOW · MID · HIGH', chans: '' });
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(u(148), u(124)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    sc.rotation.x = -Math.PI / 2; sc.position.set(WX((1063 + 1211) / 2 - OX), 0.006, WZ((366 + 490) / 2 - OY)); sc.name = 'dj_fxscreen'; sc.userData.fxDraw = draw;
    g.add(sc); rig.fxScreen = { draw };
  }
  add(new THREE.Mesh(new RoundedBoxGeometry(u(143), 0.035, u(29), 2, 0.012), glow(0x14586a, 0.3)), 'dj_xpad', 1137 - OX, 521 - OY, 0.018);
  pd('dj_beat', 1100, 566, 30, 18); pd('dj_beat', 1175, 566, 30, 18);
  kn('dj_autotap', 1097, 606, 10, 0);
  bt('dj_tap', 1137, 603, 15, 0x3fb35d, 1.4); bt('dj_quantize', 1177, 606, 9, 0xe0402f, 1.4);
  pd('dj_fxfreq', 1096, 655, 32, 20, BLUE, true, 0x161f30); pd('dj_fxfreq', 1137, 655, 32, 20, BLUE, true, 0x161f30); pd('dj_fxfreq', 1178, 655, 32, 20, BLUE, true, 0x161f30);
  kn('dj_fxsel', 1136, 708, 24, 0.1);
  [0, 1, 2, 3].forEach((k) => pd('dj_chsel', 1085 + k * 34, 771, 28, 18, BLUE, true, 0x161f30));
  [0, 1, 2, 3].forEach((k) => pd('dj_chsel', 1085 + k * 34, 810, 28, 18, BLUE, true, 0x161f30));
  kn('dj_fxtime', 1137, 873, 20, 0.1); kn('dj_fxdepth', 1137, 943, 22, -0.4);
  bt('dj_fxon', 1137, 1020, 26, BLUE, 1.6);

  // ---- the back: the connections ----
  {
    const K = XW / 1120, RX = (x) => XW / 2 - x * K, RY = (y) => -y * K, BZ = -XD / 2;
    const CHR = [[4, 150], [3, 285], [2, 420], [1, 555]];             // channel number and x, seen from behind
    const tex = canvasTexture(THREE, 2240, 544, (c, w, h) => {
      c.fillStyle = '#0d0d10'; c.fillRect(0, 0, w, h);
      const F = 2; c.fillStyle = '#f2f2f2'; c.strokeStyle = '#f2f2f2'; c.lineWidth = 1.4 * F;
      const T = (txt, x, y, size, align = 'center', bold = true) => { c.font = `${bold ? 700 : 500} ${size * F}px Inter, Arial, sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(txt, x * F, y * F); };
      CHR.forEach(([n, x]) => {
        T('CH ' + n, x, 22, 12);
        T('L', x - 24, 66, 8); T('LINE', x, 66, 8); T('R', x + 24, 66, 8);
        T('L', x - 24, 138, 8); T('PHONO', x, 138, 8); T('R', x + 24, 138, 8);
        T('DIGITAL CH IN', x, 206, 7); c.strokeRect((x - 22) * F, 214 * F, 44 * F, 20 * F);
      });
      T('BOOTH', 796, 176, 10); T('L', 762, 196, 8); T('R', 830, 196, 8);
      T('MASTER 1', 960, 40, 10); T('L', 930, 66, 8); T('R', 990, 66, 8);
      T('MASTER 2', 1062, 40, 10); T('L', 1040, 66, 8); T('R', 1085, 66, 8);
      T('MIC 1', 760, 40, 10); T('MIC 2', 850, 40, 10); T('MULTI I/O', 960, 176, 8); T('AC IN', 1060, 176, 9);
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(XW, XH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 }));
    back.rotation.y = Math.PI; back.position.set(0, -XH / 2, BZ - 0.003); back.name = 'dj_back';
    g.add(back);
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a84e, metalness: 0.9, roughness: 0.3 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, metalness: 0.9, roughness: 0.32 });
    const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.8 });
    const grey = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6, metalness: 0.2 });
    const cyl = (r, depth, mat, name, x, y) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * K, r * K, depth, 24), mat);
      m.rotation.x = Math.PI / 2; m.position.set(RX(x), RY(y), BZ - depth / 2); m.name = name; m.castShadow = true; g.add(m); return m;
    };
    const rca = (name, x, y) => { cyl(15, 0.05, gold, name, x, y); cyl(9, 0.052, black, name, x, y); cyl(2.4, 0.05, gold, name, x, y); };
    const trs = (name, x, y) => { cyl(15, 0.05, steel, name, x, y); cyl(8.5, 0.052, black, name, x, y); };
    const xlr = (name, x, y) => { cyl(30, 0.06, steel, name, x, y); cyl(26, 0.062, black, name, x, y); [[-8, 5], [8, 5], [0, -8]].forEach(([dx, dy]) => cyl(3, 0.058, steel, name, x + dx, y + dy)); };
    CHR.forEach(([n, x]) => {
      rca('xr_line', x - 24, 90); rca('xr_line', x + 24, 90);
      rca('xr_phono', x - 24, 162); rca('xr_phono', x + 24, 162);
      cyl(16, 0.04, grey, 'xr_digital', x, 224);
    });
    trs('xr_booth', 762, 222); trs('xr_booth', 830, 222);
    xlr('xr_master', 930, 105); xlr('xr_master', 990, 105);
    rca('xr_master2', 1040, 95); rca('xr_master2', 1085, 95);
    xlr('xr_mic', 760, 105); xlr('xr_mic', 850, 105);
    const mains = new THREE.Mesh(new THREE.BoxGeometry(80 * K, 40 * K, 0.05), grey); mains.position.set(RX(1060), RY(225), BZ - 0.025); mains.name = 'xr_mains'; g.add(mains);
  }

  finishRig(rig, { allOff: true });   // every button starts switched off, so nothing is confusing at first glance
  return g;
}

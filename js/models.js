// Behind the Decks: models.js
// Two objects that are drawn in code instead of loaded from a file: a USB drive and a
// vinyl record bag. Every picture on their surfaces (the fabric, the record grooves,
// the sleeve artwork) is drawn here too, so nothing in this file comes from anyone else's work.

import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RECORDS } from './records.js';
import { canvasTexture, blinkers, rig, clamp01, makeKit, finishRig } from './kit.js';
import { djm } from './mixer-digital.js';
import { cdj } from './cdj.js';
export { blinkers, rig };


function named(mesh, name) { mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

/* ---------------- USB drive ---------------- */
function usb(THREE) {
  const g = new THREE.Group();
  const body = named(new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.12, 0.34, 3, 0.04), new THREE.MeshStandardMaterial({ color: 0x1b1e25, metalness: 0.3, roughness: 0.45 })), 'usb_body');
  body.position.set(0.3, 0.06, 0);
  const stripe = named(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.004, 0.09), new THREE.MeshStandardMaterial({ color: 0x1b8aa6, roughness: 0.5 })), 'usb_body');
  stripe.position.set(0.3, 0.122, 0);
  const plug = named(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.24), new THREE.MeshStandardMaterial({ color: 0xc4c8d0, metalness: 1, roughness: 0.25 })), 'usb_plug');
  plug.position.set(-0.15, 0.06, 0);
  g.add(body, stripe, plug);
  return g;
}

/* ---------------- Vinyl bag ---------------- */
function bag(THREE) {
  const g = new THREE.Group();
  const R = 1.4;                                   // a 12 inch record is about 2.8 units across

  // Canvas fabric, drawn on a texture
  const fabric = canvasTexture(THREE, 512, 512, (x, w, h) => {
    x.fillStyle = '#1b1e25'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,0.045)'; x.lineWidth = 1;
    for (let i = -h; i < w; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); }
    for (let i = 0; i < w + h; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i - h, h); x.stroke(); }
    x.strokeStyle = 'rgba(98,214,245,0.5)'; x.lineWidth = 3; x.setLineDash([10, 8]);
    x.strokeRect(70, 250, w - 140, 190);                           // the stitched front pocket
    x.setLineDash([]);
  });
  const cloth = new THREE.MeshStandardMaterial({ map: fabric, roughness: 0.95, metalness: 0 });
  const body = named(new THREE.Mesh(new RoundedBoxGeometry(3.5, 2.2, 1.3, 4, 0.12), cloth), 'bag_body');
  body.position.y = 1.1;
  g.add(body);

  // Carry handle: a band of webbing over the top
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.5, 2.15, 0.1), new THREE.Vector3(-1.2, 3.9, 0.1), new THREE.Vector3(0, 4.6, 0.1),
    new THREE.Vector3(1.2, 3.9, 0.1), new THREE.Vector3(1.5, 2.15, 0.1)
  ]);
  const handle = named(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.07, 8, false), new THREE.MeshStandardMaterial({ color: 0x2a2e37, roughness: 0.85 })), 'bag_handle');
  g.add(handle);

  // Records standing in the bag, edge up. Each one has its own label, so it can be told apart and taken out.
  const side = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.5, metalness: 0.1 });
  const drawFace = (x, w, h, rec, img) => {
    x.fillStyle = '#060709'; x.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, rr = w / 2;
    for (let r = 0.36; r < 0.97; r += 0.011) {
      x.strokeStyle = `rgba(255,255,255,${0.03 + 0.05 * ((r * 97) % 1)})`;
      x.lineWidth = 1.2;
      x.beginPath(); x.arc(cx, cy, r * rr, 0, Math.PI * 2); x.stroke();
    }
    x.save(); x.beginPath(); x.arc(cx, cy, 0.3 * rr, 0, Math.PI * 2); x.clip();
    if (img) x.drawImage(img, cx - 0.3 * rr, cy - 0.3 * rr, 0.6 * rr, 0.6 * rr);
    else {
      x.fillStyle = '#f4f4f1'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#16181d'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 ${0.045 * w}px Inter, Arial, sans-serif`; x.fillText(rec.title.toUpperCase(), cx, cy - 0.07 * rr);
      x.font = `500 ${0.035 * w}px Inter, Arial, sans-serif`; x.fillText(rec.artist, cx, cy + 0.07 * rr);
    }
    x.restore();
    x.fillStyle = '#d9dbe0'; x.beginPath(); x.arc(cx, cy, 0.03 * rr, 0, Math.PI * 2); x.fill();
  };
  const faceFor = (rec, i) => {
    const map = canvasTexture(THREE, 1024, 1024, (x, w, h) => drawFace(x, w, h, rec, null));
    if (rec.cover) {
      const img = new Image();
      img.onload = () => { const c = map.image; drawFace(c.getContext('2d'), c.width, c.height, rec, img); map.needsUpdate = true; };
      img.src = rec.cover;
    }
    return new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1, map });
  };
  const lifts = [0.0, 0.08, -0.04, 0.12, 0.02, -0.02, 0.06];
  RECORDS.forEach((rec, i) => {
    const face = faceFor(rec, i);
    const d = named(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.02, 96), [side, face, face]), 'bag_disc');
    d.rotation.x = Math.PI / 2;
    d.position.set(0, 1.62 + (lifts[i] || 0), 0.1 - i * 0.1);   // record 0 stands at the front of the bag, the last one at the back
    d.userData.record = i;
    d.userData.home = { pos: d.position.clone(), quat: d.quaternion.clone() };
    g.add(d);
  });

  // One record pulled up a little in its sleeve, so the artwork shows
  const art = canvasTexture(THREE, 512, 512, (x, w, h) => {
    x.fillStyle = '#232731'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(98,214,245,0.6)'; x.lineWidth = 4;
    x.beginPath(); x.arc(w / 2, h / 2, 150, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 2;
    x.beginPath(); x.arc(w / 2, h / 2, 205, 0, Math.PI * 2); x.stroke();
  });
  const sleeve = named(new THREE.Mesh(new THREE.BoxGeometry(2.95, 2.95, 0.035), new THREE.MeshStandardMaterial({ map: art, roughness: 0.8 })), 'bag_sleeve');
  sleeve.position.set(0, 1.95, -0.62);
  g.add(sleeve);
  return g;
}


/* ---------------- Six-channel analogue club mixer (a look-alike drawn in code) ----------------
   Seen from above: the DJ stands at the front (+z). Every position below was measured in pixels from one
   top-down product photo of a six-channel club mixer (the face of the mixer is 600 x 675 px in that photo),
   so the layout, the printed labels and the scales follow the real panel. Each control is its own mesh,
   named by what it is ("xi_eq", "xi_fader" ...), so content.js can describe it. The panel is drawn with
   the canvas and carries no brand name, model number or logo. */
const FX0 = 44, FY0 = 35, FW = 600, FH = 675;         // the face of the mixer in the photo
const XW = 3.3, XD = XW * FH / FW, XH = 0.8;          // width, depth and height in scene units
const PX = XW / FW;                                   // scene units per photo pixel
const WX = (x) => (x - FX0) * PX - XW / 2, WZ = (y) => (y - FY0) * PX - XD / 2;
const CH = [251, 318, 385, 451];                      // x of the four channel strips (knob centres)
const MICX = [86, 129];                               // x of the two mic / return strips
const EQY = [235, 278, 322, 366];                     // y of HI, HM, LM, LO
const FADE_TOP = 492, FADE_BOT = 632;                 // channel fader slots
const LED_Y = Array.from({ length: 9 }, (_, i) => 492 + i * 9.4);


// The parts every drawn mixer is made of: knobs, push buttons, small buttons, lights, switches, faders and light columns.
function xone(THREE) {
  const g = new THREE.Group();
  rig.controls.length = 0; rig.leds.length = 0; rig.meters.length = 0; rig.root = g; rig.cueActive = null;
  rig.toPx = (lx, lz) => ({ x: (lx + XW / 2) / PX + FX0, y: (lz + XD / 2) / PX + FY0 }); rig.WX = WX; rig.WZ = WZ; rig.PX = PX; rig.jack = { x: 571, y: 625 };
  const S = 2048 / FW;                                 // canvas pixels per photo pixel
  const cx = (x) => (x - FX0) * S, cy = (y) => (y - FY0) * S;

  // ---------- printed top panel ----------
  const panel = canvasTexture(THREE, 2048, Math.round(FH * S), (c, w, h) => {
    const rr = (x1, y1, x2, y2, r, fill) => { c.fillStyle = fill; c.beginPath(); c.roundRect(cx(x1), cy(y1), (x2 - x1) * S, (y2 - y1) * S, r * S); c.fill(); };
    const grd = c.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#4c5862'); grd.addColorStop(1, '#434e58');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
    rr(51, 59, 158, 686, 5, '#0a0a0c');                       // black mic / return panel
    rr(552, 56, 622, 689, 5, '#0a0a0c');                      // black master / monitor panel
    const INK = '#e8ebef', DIM = '#b9c0c8';
    const t = (txt, x, y, size = 6, col = INK, align = 'center', weight = 600) => { c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.font = `${weight} ${size * S}px Inter, Arial, sans-serif`; c.fillText(txt, cx(x), cy(y)); };
    const tv = (txt, x, y, size = 6, col = INK) => { c.save(); c.translate(cx(x), cy(y)); c.rotate(-Math.PI / 2); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `600 ${size * S}px Inter, Arial, sans-serif`; c.fillText(txt, 0, 0); c.restore(); };
    const ln = (pts, col = INK, lw = 0.9) => { c.strokeStyle = col; c.lineWidth = lw * S; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(cx(x), cy(y)) : c.moveTo(cx(x), cy(y)))); c.stroke(); };
    const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx(x), cy(y), r * S, 0, Math.PI * 2); c.fill(); };
    const ticks = (x, y, r, n = 9, col = INK, a0 = 135, a1 = 405) => { // short radial ticks round a knob
      c.strokeStyle = col; c.lineWidth = 0.7 * S;
      for (let i = 0; i < n; i++) { const a = (a0 + (a1 - a0) * i / (n - 1)) * Math.PI / 180; c.beginPath(); c.moveTo(cx(x + Math.cos(a) * r), cy(y + Math.sin(a) * r)); c.lineTo(cx(x + Math.cos(a) * (r + 3)), cy(y + Math.sin(a) * (r + 3))); c.stroke(); }
    };
    // the printed scale round a small knob: a few tick marks and the minimum and maximum values
    const dial = (x, y, r, mn, mx, col = INK) => {
      c.strokeStyle = col; c.lineWidth = 0.7 * S;
      [135, 180, 225, 315, 360, 405].forEach((deg) => { const a = deg * Math.PI / 180; c.beginPath(); c.moveTo(cx(x + Math.cos(a) * r), cy(y + Math.sin(a) * r)); c.lineTo(cx(x + Math.cos(a) * (r + 3.2)), cy(y + Math.sin(a) * (r + 3.2))); c.stroke(); });
      t(mn, x - 13, y + 14, 3.8, col); t(mx, x + 11, y + 14, 3.8, col);
    };
    const dashes = (x, y, r) => { c.strokeStyle = '#f2f4f7'; c.lineWidth = 2.2 * S; c.setLineDash([2.6 * S, 2.2 * S]); c.beginPath(); c.arc(cx(x), cy(y), r * S, 135 * Math.PI / 180, 405 * Math.PI / 180); c.stroke(); c.setLineDash([]); };
    const wave = (x, y, kind) => { // little filter-shape icons: high pass, band pass, low pass
      const p = kind === 'hp' ? [[x - 6, y + 4], [x - 1, y + 4], [x + 2, y - 3], [x + 7, y - 3]] : kind === 'bp' ? [[x - 7, y + 4], [x - 3, y + 4], [x - 1, y - 3], [x + 1, y - 3], [x + 3, y + 4], [x + 7, y + 4]] : [[x - 6, y - 3], [x - 1, y - 3], [x + 2, y + 4], [x + 7, y + 4]];
      ln(p, INK, 0.8);
    };

    // strip dividers
    [279, 345, 411].forEach((x) => ln([[x, 58], [x, 645]], 'rgba(235,240,245,0.38)', 0.8));

    // ----- the four channel strips -----
    CH.forEach((x, i) => {
      [[80, 105, 'AUX', '1'], [129, 153, 'AUX', '2']].forEach(([ky, py, a, n]) => {
        t(a, x - 21, ky - 7, 4.6, DIM); t(n, x - 21, ky - 1, 4.6, DIM); dial(x, ky, 12, '∞', '+6', DIM);
        ln([[x - 22, ky + 5], [x - 22, py], [x - 13, py]], DIM, 0.7); t('PRE', x + 9, py + 1, 4.6, DIM, 'left');
      });
      dot(x - 24, 172, 3.2, i === 1 || i === 2 ? '#c8d23a' : '#e0402f');
      t('PH', x + 15, 169, 4.6, DIM, 'left'); t('LN', x + 15, 176, 4.6, DIM, 'left');
      t('LEVEL', x - 20, 187, 4.6, DIM); dial(x, 200, 12, '∞', '+10', DIM);
      [['HI', '-∞'], ['HM', '-30'], ['LM', '-30'], ['LO', '-∞']].forEach(([lab, mn], k) => {
        const y = EQY[k], ex = x - 3;
        t(lab, ex - 20, y - 15, 5.2, INK); dashes(ex, y, 17); t(mn, ex - 11, y + 18, 4.4, DIM); t('+6', ex + 11, y + 18, 4.4, DIM);
      });
      // filter and crossfader assign rows, with their printed 1 / 2 and X / Y
      t('1', x - 22, 397, 5.4, INK); t('2', x + 12, 397, 5.4, INK); t('OFF', x - 5, 409, 4, DIM);
      t('X', x - 22, 423, 5.4, INK); t('Y', x + 12, 423, 5.4, INK); t('OFF', x - 5, 435, 4, DIM);
      t('CUE', x + 7, 463, 4.4, INK, 'left'); t(String(i + 1), x - 4, 478, 9, INK, 'center', 700);
      LED_Y.forEach((y, k) => t(['+10', '+6', '+3', '0', '-3', '-6', '-10', '-15', '-20'][k], x - 24.5, y, 3.6, DIM));
      for (let k = 0; k < 8; k++) ln([[x - 7, 499 + k * 17], [x + 3, 499 + k * 17]], '#e6e9ed', 0.9);
      t('8', x - 4, 616, 5, INK);
    });
    t('FILTER', 279, 397, 5.4, INK); t('FILTER', 411, 397, 5.4, INK); t('XFADE', 279, 423, 5.4, INK); t('XFADE', 409, 423, 5.4, INK);

    // ----- mic / return strips (black panel) -----
    MICX.forEach((x, i) => {
      [[80, 105, '1'], [127, 155, '2']].forEach(([ky, py, n]) => {
        t('AUX', x - 22, ky - 8, 4.4, INK); t(n, x - 22, ky - 2, 4.4, INK); dial(x, ky, 12, '∞', '+6', INK);
        ln([[x - 23, ky + 4], [x - 23, py], [x - 16, py]], INK, 0.7); t('PRE', x - 1, py + 1, 4.2, INK, 'left');
      });
      c.fillStyle = INK; c.fillRect(cx(x + 3), cy(167.6), 2.4 * S, 2.4 * S); c.fillRect(cx(x + 3), cy(174.6), 2.4 * S, 2.4 * S);
      t('MIC', x + 7, 169, 4.2, INK, 'left'); t('RTN', x + 7, 176, 4.2, INK, 'left');
      t('LEVEL', x - 20, 188, 4.4, INK); dial(x, 200, 12, '∞', '+10', INK);
      [['HI', 235], ['HM', 272], ['LM', 309], ['LO', 346]].forEach(([lab, y]) => {
        t(lab, x - 21, y - 14, 4.8, INK); dashes(x, y, 17); t('-15', x - 11, y + 18, 4, INK); t('+15', x + 11, y + 18, 4, INK);
      });
      t('CUE', x + 12, 374, 4.4, INK, 'left');
      t('DUCK', x - 1, 408, 4.8, INK); t('OFF', x + 15, 421, 4.2, INK); t('ON', x - 1, 434, 4.2, INK);
      dot(x - 13, 455, 3.2, '#8a9a3a'); t('ON', x + 3, 453, 4, INK, 'left'); t('PK', x + 3, 460, 4, INK, 'left');
      for (let k = 0; k < 7; k++) ln([[x - 14, 500 + k * 17], [x - 6, 500 + k * 17]], INK, 0.9);
      t('8', x - 8, 612, 4.4, INK); t(String(i + 1), x - (i ? 1 : 0) - 4, 471, 9, INK, 'center', 700);
    });
    t('MIC / RTN', 107, 471, 5.6, INK);

    // ----- the two filter modules: every label sits inside its frame -----
    const frame = (x1, y1, x2, y2, side) => { ln(side === 'L' ? [[x1, y1 + 8], [x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y2 - 8]] : [[x2, y1 + 8], [x2, y1], [x1, y1], [x1, y2], [x2, y2], [x2, y2 - 8]], '#eef1f4', 0.9); };
    [[161, 'L'], [484, 'R']].forEach(([f1, side]) => {
      const f2 = f1 + 59 + (side === 'R' ? 3 : 0), bx = f1 + 18, lx = f1 + 33, ix = f1 + 43, kx = f1 + 29, lbx = f1 + 33;
      frame(f1, 158, f2, 397, side); frame(f1, 410, f2, 684, side);
      t('LFO', kx, 172, 8, INK, 'center', 700); ticks(kx, 197, 13, 11, INK);
      t('MIN', kx - 13, 216, 3.8, INK); t('MAX', kx + 13, 216, 3.8, INK);
      dot(bx - 9, 234, 2.6, '#e0402f'); t('LFO', lx, 231, 3.8, INK, 'left'); t('ON', lx, 237, 3.8, INK, 'left');
      dot(bx - 9, 268, 2.4, '#7a1f19'); t('X2', lx, 265, 3.8, INK, 'left'); t('TEMPO', lx, 271, 3.8, INK, 'left');
      t('TAP', lx + 3, 304, 5, INK, 'left', 700);
      t('RES', kx, 332, 5, INK, 'center', 700); ticks(kx, 356, 13, 9, INK); t('MILD', kx - 13, 374, 3.8, INK); t('WILD', kx + 13, 374, 3.8, INK);
      t('FILTER ' + (side === 'L' ? 1 : 2), kx, 423, 6.4, INK, 'center', 700);
      if (side === 'L') { t('VCF TO', lx, 447, 3.6, INK, 'left'); t('XFADE', lx, 453, 3.6, INK, 'left'); }
      else { t('VCF', lx, 441, 3.6, INK, 'left'); t('LINK 2-1', lx, 447, 3.6, INK, 'left'); t('VCF TO', lx, 459, 3.6, INK, 'left'); t('XFADE', lx, 465, 3.6, INK, 'left'); }
      [['HPF', 490, 'hp'], ['BPF', 523, 'bp'], ['LPF', 556, 'lp']].forEach(([lab, y, k]) => { t(lab, lbx, y - 5, 4.4, INK, 'left', 700); wave(lbx + 7, y + 6, k); });
      t('FREQ', f1 + 13, 614, 4.4, INK, 'center', 700);
      [[-15, 3, 1.3], [-12, -9, 1.6], [-2, -16, 1.9], [9, -14, 2.3], [16, -5, 2.7], [16, 8, 3.1]].forEach(([dx, dy, r]) => dot(kx + 2 + dx, 597 + dy, r, '#f1f3f6'));
      t('FILTER ON', kx, 631, 4.8, INK, 'center', 700);
    });
    // tempo
    t('TEMPO ADJ', 497, 63, 3.8, INK); t('MIN', 492, 94, 3.8, INK); t('MAX', 540, 94, 3.8, INK); ticks(518, 80, 13, 9, INK); t('START/STOP', 510, 108, 4, INK);
    // crossfader recess
    ln([[252, 656], [432, 656], [432, 696], [252, 696], [252, 656]], 'rgba(235,240,245,0.45)', 0.7);
    t('X', 259, 675, 7, INK, 'center', 700); t('Y', 424, 675, 7, INK, 'center', 700);
    t('XFADE CURVE', 234, 691, 3.6, INK); t('CH CURVE', 471, 691, 3.8, INK);
    ln([[459, 674], [462, 668]], INK, 0.8); ln([[464, 674], [468, 668]], INK, 0.8); ln([[470, 674], [475, 668]], INK, 0.8);
    [330, 340, 350, 360].forEach((x, k) => { t(String(k + 1), x, 646, 3.4, INK); dot(x, 652, 2.2, '#3fb35d'); });

    // ----- right black panel: knobs and labels kept inside the brackets -----
    const KX = 579.5, BR = 607, BBX = 566.5, BLX = 574;
    LED_Y.forEach((_, k) => t(['+10', '+6', '+3', '0', '-3', '-6', '-10', '-15', '-20'][k], 580.5, 82 + k * 10, 3.2, DIM));
    t('L', 568.5, 175, 4, INK); t('R', 592.5, 175, 4, INK); t('MIX', 610, 175, 3.6, INK);
    t('CUE', 568.5, 184, 3.4, INK); t('PRG', 580.5, 184, 3.4, INK); t('SPLIT', 598.5, 184, 3.4, INK);
    [[230, 'MIX 1', 249], [277, 'MIX 2', 296]].forEach(([y, lab, ly]) => { ticks(KX, y, 12, 11, INK); t(lab, KX, ly, 4, INK); });
    // bracket with its title sitting in a gap of the line
    const bracket = (y1, y2, lab) => {
      const half = lab.length * 4.8 * 0.62 / 2 + 3.5, mid = (y1 + y2) / 2;
      ln([[BR - 4, y1], [BR, y1], [BR, mid - half]], INK, 0.9); ln([[BR, mid + half], [BR, y2], [BR - 4, y2]], INK, 0.9);
      tv(lab, BR, mid, 4.8);
    };
    bracket(212, 306, 'MASTER');
    t('MONO', BLX, 319, 4, INK, 'left'); ticks(KX, 348, 12, 11, INK); t('MUTE', BLX + 6.5, 383, 4, INK, 'left');
    bracket(312, 396, 'BOOTH');
    dot(BBX, 407, 3, '#e0402f'); t('CUE ACTIVE', BLX, 407, 3.8, INK, 'left');
    [['POST EQ', 425], ['SPLIT CUE', 444], ['AUX 1', 463], ['AUX 2', 482]].forEach(([lab, y]) => t(lab, BLX, y, 3.8, INK, 'left'));
    ticks(KX, 518, 12, 11, INK); t('CUE', 565.5, 535, 3.8, INK); t('ADD MIX', 594.5, 535, 3.8, INK);
    ticks(KX, 561, 12, 11, INK); t('LEVEL', KX, 579, 4, INK);
    bracket(402, 590, 'MONITOR');
    // headphone symbol inside its own small box
    ln([[590, 612], [618, 612], [618, 652], [590, 652], [590, 612]], INK, 0.9);
    c.strokeStyle = INK; c.lineWidth = 0.9 * S; c.beginPath(); c.arc(cx(604), cy(634), 6 * S, Math.PI, 0); c.stroke();
    c.fillStyle = INK; c.fillRect(cx(597.2), cy(634), 2.8 * S, 6 * S); c.fillRect(cx(608), cy(634), 2.8 * S, 6 * S);
    // screws
    [[157, 48], [156, 695], [636, 147], [634, 597], [530, 698], [98, 696], [536, 48]].forEach(([x, y]) => { dot(x, y, 3.4, '#1b1f24'); dot(x, y, 2.2, '#2d343b'); });
  });
  panel.anisotropy = 16;

  const chassis = new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: 0.55, metalness: 0.6 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(XW, XH, XD, 3, 0.05), chassis);
  body.position.y = -XH / 2; body.name = 'xi_body'; body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(XW, XD), new THREE.MeshStandardMaterial({ map: panel, roughness: 0.6, metalness: 0.22 }));
  plate.rotation.x = -Math.PI / 2; plate.position.y = 0.002; plate.name = 'xi_plate'; plate.receiveShadow = true;
  g.add(plate);

  const { u, dark, metal, col, glow, add, knob, button, small, led, toggle, fader, ledColumn } = makeKit(THREE, g, WX, WZ, PX);

  // mic / return strips: their own controls, separate from the four main channels
  MICX.forEach((x, i) => {
    [80, 127].forEach((y, k) => { knob('xi_maux', x, y, 12, 0.3 * (k + i - 0.5)); small('xi_maux', x - 9, k ? 155 : 105, 5.5); });
    small('xi_minput', x - 9, 172, 7.3); led('xi_minput', x - 20, 172, i ? 0x5a3a3a : 0xff3b2a, i ? 0.3 : 1.1); knob('xi_mlevel', x, 200, 12);
    ['xi_mhi', 'xi_mhm', 'xi_mlm', 'xi_mlo'].forEach((n, k) => knob(n, x, [235, 272, 309, 346][k], 15.5, -0.2 + 0.1 * i));
    button('xi_mcue', x, 374, 9.5); led('xi_mcue', x - 15, 374, i ? 0xff3b2a : 0xa02a20, i ? 1.0 : 0.8);
    toggle('xi_mduck', x, 422, 1); led('xi_led', x - 13, 455, 0xc8d23a);
    fader('xi_mslot', 'xi_mfader', x - 2, 487, 620, 535, 26);
  });

  // channels 1 to 4
  CH.forEach((x, i) => {
    knob('xi_aux1', x, 80, 12.5, [0.15, 0.4, -0.2, 0][i]); small('xi_pre', x - 5, 105, 7);
    knob('xi_aux2', x, 129, 12.5, [-0.25, 0.1, 0.2, 0.05][i]); small('xi_pre', x - 5, 153, 7);
    small('xi_input', x - 5, 172, 9); led('xi_input', x - 24, 172, i === 1 || i === 2 ? 0xc8d23a : 0xe0402f);
    knob('xi_trim', x, 200, 12.5, [0.3, 0, 0.4, -0.1][i]);
    ['xi_hi', 'xi_hm', 'xi_lm', 'xi_lo'].forEach((n, k) => knob(n, x - 3, EQY[k], 15.5, [[-0.1, 0.2, -0.1, 0.1], [0.05, -0.15, 0.1, 0.2], [0, 0.1, 0.2, -0.2], [0.1, 0.05, -0.05, 0.1]][i][k]));
    toggle('xi_assign', x - 5, 397, 0); toggle('xi_xassign', x - 5, 423, 0);
    button('xi_cue', x - 8, 452, 12);
    fader('xi_fslot', 'xi_fader', x + 11, FADE_TOP, FADE_BOT, [560, 547, 585, 555][i], 44, 0.088);
    ledColumn('xi_meter', x - 16, LED_Y, [5, 4, 2, 5][i]);
  });

  // the two filter modules (the left one is filter 1, the right one filter 2), laid out to match the frames
  [[161, -1], [484, 1]].forEach(([f1, side], m) => {
    const bx = f1 + 18, kx = f1 + 29;
    knob('xi_lfod', kx, 197, 15, 0.4 * side * -1);
    small('xi_lfoon', bx + 4, 234, 7); led('xi_lfoon', bx - 9, 234, 0xe0402f);
    small('xi_x2', bx + 4, 268, 7); led('xi_x2', bx - 9, 268, 0x8a241c, 0.8);
    button('xi_tap', bx + 2, 302, 14, 0xe0402f, 1.5);
    knob('xi_res', kx, 356, 15, 0.5 * side);
    if (m) { small('xi_vlink', bx + 4, 444, 6.5); led('xi_vlink', bx - 9, 444, 0xe0402f, 0.9); small('xi_vx', bx + 4, 462, 6.5); led('xi_vx', bx - 9, 462, 0xe0402f, 1.4); }
    else { small('xi_vx', bx + 4, 450, 6.5); led('xi_vx', bx - 9, 450, 0xe0402f, 0.9); }
    button('xi_hpf', bx - 1, 490, 10.5); button('xi_bpf', bx - 1, 523, 10.5); button('xi_lpf', bx - 1, 556, 10.5, 0xf0a030, 2);
    knob('xi_freq', kx + 2, 597, 17, 0.6 * side);
    button('xi_fon', kx, 658, 13);
  });
  knob('xi_tempo', 518, 80, 14, -0.9); button('xi_startstop', 508, 127, 15);

  // crossfader and its curve controls
  add(new THREE.Mesh(new THREE.BoxGeometry(u(140), 0.012, u(6)), dark), 'xi_xslot', 341, 675, 0.006);
  add(new THREE.Mesh(new THREE.BoxGeometry(u(140), 0.016, 0.011), metal), 'xi_xslot', 341, 675, 0.018);
  const xc1 = add(new THREE.Mesh(new RoundedBoxGeometry(u(16), 0.1, 0.3, 2, 0.02), col(0x121418, 0.35)), 'xi_xfader', 341, 675, 0.06);
  const xc2 = add(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.104, 0.3), col(0xf4f5f8, 0.4)), 'xi_xfader', 341, 675, 0.062);
  rig.controls.push({ type: 'xfader', name: 'xi_xfader', x: 341, y: 675, objs: [xc1, xc2], lo: 279, hi: 403, value: 0.5,
    set(v) { this.value = clamp01(v); this.x = this.lo + this.value * (this.hi - this.lo); xc1.position.x = xc2.position.x = WX(this.x); } });
  small('xi_xcurve', 233, 667, 9);
  toggle('xi_chcurve', 470, 662, 0);

  // right-hand panel, positions match the printed brackets
  const mys = Array.from({ length: 9 }, (_, i) => 82 + i * 10);
  ledColumn('xi_mmeter', 568.5, mys, 6, 4); ledColumn('xi_mmeter', 592.5, mys, 6, 4);
  knob('xi_mix1', 579.5, 230, 12.5, 0.6); knob('xi_mix2', 579.5, 277, 12.5, 0.2);
  small('xi_mono', 566.5, 319, 7); knob('xi_booth', 579.5, 348, 12.5, 0.4); small('xi_mute', 572, 383, 7.5); led('xi_mute', 558.5, 383, 0xe0402f);
  led('xi_led', 566.5, 407, 0xe0402f, 1.6);
  small('xi_posteq', 566.5, 425, 7); small('xi_split', 566.5, 444, 7); small('xi_aux1m', 566.5, 463, 7); small('xi_aux2m', 566.5, 482, 7);
  knob('xi_cuemix', 579.5, 518, 12.5, 0.5); knob('xi_plevel', 579.5, 561, 12.5, -0.4);
  add(new THREE.Mesh(new THREE.CylinderGeometry(u(9), u(9), 0.045, 24), metal), 'xi_jack', 571, 625, 0.022);
  add(new THREE.Mesh(new THREE.CylinderGeometry(u(4.5), u(4.5), 0.05, 16), dark), 'xi_jack', 571, 625, 0.026);
  add(new THREE.Mesh(new THREE.CylinderGeometry(u(4), u(4), 0.04, 16), metal), 'xi_jack', 571, 660, 0.02);

  // ---- The back panel: the connections, drawn from a photo of the back of a six-channel club mixer ----
  {
    const K = XW / 1120, RX = (x) => XW / 2 - (x - 88) * K, RY = (y) => -(y - 278) * K, BZ = -XD / 2;
    const tex = canvasTexture(THREE, 2240, 550, (c, w, h) => {
      c.fillStyle = '#0d0d10'; c.fillRect(0, 0, w, h);
      const F = 2, X = (x) => (x - 88) * F, Y = (y) => (y - 278) * F;
      c.fillStyle = '#f2f2f2'; c.strokeStyle = '#f2f2f2'; c.lineWidth = 1.4 * F;
      const T = (txt, x, y, size, align = 'center', bold = true) => { c.font = `${bold ? 700 : 500} ${size * F}px Inter, Arial, sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(txt, X(x), Y(y)); };
      const V = (txt, x, y, size) => { c.save(); c.translate(X(x), Y(y)); c.rotate(-Math.PI / 2); c.font = `700 ${size * F}px Inter, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 0, 0); c.restore(); };
      const L = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke(); };
      [[4, 430], [3, 555], [2, 680], [1, 805]].forEach(([n, cx]) => {
        T('L', cx - 27, 296, 11); T('PHONO', cx, 296, 11); T('R', cx + 27, 296, 11);
        T('L', cx - 27, 392, 11); T('LINE', cx, 392, 11); T('R', cx + 27, 392, 11);
        V('INPUT', cx - 56, 343, 11); T(String(n), cx - 56, 322, 15);
        L([[cx - 8, 312], [cx + 8, 312], [cx + 8, 324], [cx - 8, 324], [cx - 8, 312]]);
      });
      T('MIDI OUT', 328, 392, 9);
      T('BOOTH', 432, 405, 10); T('L', 372, 405, 10); T('R', 492, 405, 10);
      T('MIX 2', 570, 405, 10); T('L', 508, 405, 10); T('R', 628, 405, 10);
      T('LEFT', 492, 462, 11); T('RIGHT', 602, 462, 11); T('MIX 1', 548, 497, 12);
      T('RECORD', 692, 440, 10); T('L', 664, 472, 10); T('R', 664, 520, 10);
      T('AUX 2', 778, 424, 11); T('AUX 1', 849, 424, 11);
      T('L', 752, 448, 9); T('R', 752, 520, 9); T('L', 823, 448, 9); T('R', 823, 520, 9);
      T('ON/OFF', 1055, 352, 8); T('CLEAN', 1033, 376, 7.5); T('FEED', 1033, 386, 7.5); T('ON/OFF', 1133, 352, 8); T('CLEAN', 1111, 376, 7.5); T('FEED', 1111, 386, 7.5);
      T('MIC 2', 1025, 436, 13, 'left'); T('MIC 1', 1165, 436, 13, 'left');
      T('RTN 2', 1030, 484, 12, 'left'); T('RTN 1', 1170, 484, 12, 'left');
      T('L/M', 930, 505, 9); T('R', 1043, 505, 9); T('L/M', 1062, 505, 9); T('R', 1176, 505, 9);
      L([[920, 530], [1058, 530]]); L([[1052, 530], [1052, 480]]);
      T('OFF', 142, 452, 8); T('ON', 142, 497, 8); T('0', 128, 458, 7); T('I', 128, 482, 7);
      T('AC MAINS IN', 290, 524, 7); T('100-240V   50/60Hz   35W', 290, 535, 7, 'center', false);
      T('FUSE', 405, 468, 8); T('T500mA L 250V 20mm', 410, 540, 7, 'center', false);
      c.lineWidth = 1.2 * F;                                              // the earth symbol under the ground terminal
      L([[900, 343], [900, 352]]); L([[888, 352], [912, 352]]); L([[892, 357], [908, 357]]); L([[896, 362], [904, 362]]);
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(XW, XH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 }));
    plate.rotation.y = Math.PI; plate.position.set(0, -XH / 2, BZ - 0.003); plate.name = 'xi_back';
    g.add(plate);
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a84e, metalness: 0.9, roughness: 0.3 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, metalness: 0.9, roughness: 0.32 });
    const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.8 });
    const grey = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6, metalness: 0.2 });
    const red = new THREE.MeshStandardMaterial({ color: 0xd22a22, roughness: 0.5 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.5 });
    const cyl = (r, depth, mat, name, x, y, off = 0) => {            // a short cylinder standing out from the back
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * K, r * K, depth, 24), mat);
      m.rotation.x = Math.PI / 2; m.position.set(RX(x), RY(y), BZ - depth / 2 - off); m.name = name; m.castShadow = true; g.add(m); return m;
    };
    const box = (w, hh, depth, mat, name, x, y, off = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * K, hh * K, depth), mat);
      m.position.set(RX(x), RY(y), BZ - depth / 2 - off); m.name = name; m.castShadow = true; g.add(m); return m;
    };
    const rca = (name, x, y, mat = gold) => { cyl(17, 0.05, mat, name, x, y); cyl(10, 0.052, black, name, x, y); cyl(2.5, 0.05, mat, name, x, y, 0.004); };
    const trs = (name, x, y) => { cyl(17, 0.05, steel, name, x, y); cyl(9.5, 0.052, black, name, x, y); };
    const xlr = (name, x, y) => {
      cyl(33, 0.06, steel, name, x, y); cyl(29, 0.062, black, name, x, y);
      [[-9, 6], [9, 6], [0, -9]].forEach(([dx, dy]) => cyl(3.4, 0.058, steel, name, x + dx, y + dy));
    };
    [430, 555, 680, 805].forEach((cx) => {
      rca('xr_phono', cx - 27, 318); rca('xr_phono', cx + 27, 318);
      rca('xr_line', cx - 27, 368); rca('xr_line', cx + 27, 368);
      cyl(5, 0.03, steel, 'xr_gnd', cx, 343);                         // the little earth screw of the phono pair
    });
    cyl(23, 0.07, steel, 'xr_gnd', 900, 318); cyl(15, 0.1, grey, 'xr_gnd', 900, 318); cyl(5, 0.14, steel, 'xr_gnd', 900, 318);
    cyl(27, 0.05, grey, 'xr_midi', 328, 350);                         // MIDI out: a round socket with five pins
    cyl(21, 0.052, black, 'xr_midi', 328, 350);
    [-14, -7, 0, 7, 14].forEach((d, i) => cyl(2.4, 0.05, steel, 'xr_midi', 328 + d, 350 + (i % 2 ? 5 : 0) - 4));
    trs('xr_booth', 398, 422); trs('xr_booth', 466, 422);
    trs('xr_mix2', 535, 422); trs('xr_mix2', 603, 422);
    xlr('xr_mix1', 492, 497); xlr('xr_mix1', 602, 497);
    rca('xr_rec', 692, 472, white); rca('xr_rec', 692, 520, red);
    trs('xr_aux2', 778, 448); trs('xr_aux2', 778, 520);
    trs('xr_aux1', 849, 448); trs('xr_aux1', 849, 520);
    xlr('xr_mic', 972, 435); xlr('xr_mic', 1112, 435);
    trs('xr_rtn', 948, 520); trs('xr_rtn', 1020, 520); trs('xr_rtn', 1078, 520); trs('xr_rtn', 1150, 520);
    box(14, 14, 0.04, white, 'xr_clean', 1055, 372); box(14, 14, 0.04, white, 'xr_clean', 1133, 372);
    box(105, 72, 0.05, grey, 'xr_mains', 292, 474); box(70, 40, 0.056, black, 'xr_mains', 292, 474);   // the mains inlet
    cyl(22, 0.05, grey, 'xr_mains', 410, 498); cyl(16, 0.054, black, 'xr_mains', 410, 498);             // the fuse holder
    cyl(17, 0.06, grey, 'xr_pswitch', 175, 472); cyl(12, 0.07, black, 'xr_pswitch', 175, 472);         // the power switch
  }

  finishRig();
  return g;
}

export function buildProcedural(THREE, kind) {
  if (kind === 'xone') return xone(THREE);
  if (kind === 'djm') return djm(THREE);
  if (kind === 'cdj') return cdj(THREE);
  if (kind === 'usb') return usb(THREE);
  if (kind === 'bag') return bag(THREE);
  throw new Error('Unknown model: ' + kind);
}

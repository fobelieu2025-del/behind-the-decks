// Behind the Decks: kit.js
// The shared parts for the two mixers drawn in code (the six-channel club mixer on the analog page and the
// four-channel digital mixer on the digital page): knobs, push buttons, lights, switches, faders and meter
// columns. Everything the visitor can play with is entered in rig.controls, so Play mode can move it.

import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function canvasTexture(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const blinkers = [];                         // glowing rings that flash on the beat, like the tap button of the real mixer
// Everything the visitor can play with on the mixer (Play mode). Filled in while the mixer is built.
export const rig = { controls: [], leds: [], meters: [], root: null, cueActive: null, toPx: null, WX: null, WZ: null, PX: 0, jack: null };
export const clamp01 = (v) => Math.min(1, Math.max(0, v));                         // glowing rings that flash on the beat, like the tap button of the real mixer

// Each one is also entered in rig.controls, so Play mode can move it.
export function makeKit(THREE, g, WX, WZ, PX, R = rig, blink = blinkers) {
  // ---------- controls ----------
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.38, metalness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb4b8c2, roughness: 0.28, metalness: 1 });
  const cache = {};
  const col = (hex, rough = 0.45) => (cache[hex] ||= new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.2 }));
  const glow = (hex, k = 1) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.5 });
  const add = (mesh, name, x, y, h) => { mesh.name = name; mesh.position.set(WX(x), h, WZ(y)); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const u = (px) => px * PX;                                  // photo pixels to scene units

  // knob: black, with a white pointer line. The EQ knob is 14.2 mm across at the base and 19.6 mm tall, which is
  // about 24 px wide in the photo; the other knobs are scaled from it, so rpx is their size in the old estimate.
  const KNOB = 0.78;
  const knob = (name, x, y, rpx = 15.5, ang = 0) => {
    const r = u(rpx * KNOB), h = 2 * r * (19.6 / 14.2), pg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.84, r, h, 32), dark);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.012, 32), col(0x15171b, 0.3));
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.01, r * 0.8), col(0xf4f5f8, 0.4));
    body.position.y = h / 2; top.position.y = h + 0.004; tick.position.set(0, h + 0.012, -r * 0.4);
    pg.add(body, top, tick); pg.rotation.y = ang; pg.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    pg.position.set(WX(x), 0, WZ(y)); g.add(pg);
    pg.traverse((o) => { if (o.isMesh) o.name = name; }); pg.name = name;
    const span = 4.712;                                     // the printed scale runs over 270 degrees
    R.controls.push({ type: 'knob', name, x, y, objs: [pg], value: clamp01(0.5 - ang / span),
      set(v) { this.value = clamp01(v); pg.rotation.y = -(this.value - 0.5) * span; } });
  };
  // push button: silver ring, black cap and an optional glowing ring
  const button = (name, x, y, rpx = 16, light = 0, k = 1.2) => {
    const r = u(rpx);
    const base = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 28), metal), name, x, y, 0.015);
    const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.76, r * 0.8, 0.07, 28), dark.clone()), name, x, y, 0.045);
    const hex = light || (name === 'cj_play' ? 0x3fb35d : name === 'cj_cue' ? 0xff6a2a : name === 'xi_cue' || name === 'xi_mcue' ? 0xff6a2a : name === 'xi_startstop' ? 0xe0402f : name === 'xi_fon' ? 0x3a9cff : 0xf0a030);
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.011, 8, 32), glow(hex, light ? k : 1.7)), name, x, y, 0.032);
    ring.rotation.x = Math.PI / 2; ring.visible = !!light;
    if (name === 'xi_tap') blink.push(ring);
    R.controls.push({ type: name === 'xi_tap' ? 'tap' : 'button', name, x, y, objs: [base, cap, ring], cap, ring, hex, capHex: dark.color.getHex(), capY: 0.045, on: !!light, leds: [] });
  };
  // rectangular push button (cue buttons, pads): a frame, a cap in its own colour and an optional glowing frame
  const pad = (name, x, y, w, h, hex = 0xf0a030, lit = false, capHex = 0x0b0c0f, k = 1.5) => {
    const base = add(new THREE.Mesh(new RoundedBoxGeometry(u(w) + 0.02, 0.03, u(h) + 0.02, 2, 0.008), metal), name, x, y, 0.015);
    const cap = add(new THREE.Mesh(new RoundedBoxGeometry(u(w), 0.06, u(h), 2, 0.01), new THREE.MeshStandardMaterial({ color: capHex, roughness: 0.4, metalness: 0.25 })), name, x, y, 0.045);
    const ring = add(new THREE.Mesh(new THREE.BoxGeometry(u(w) + 0.034, 0.012, u(h) + 0.034), glow(hex, k)), name, x, y, 0.028);
    ring.visible = lit;
    R.controls.push({ type: 'button', name, x, y, objs: [base, cap, ring], cap, ring, hex, capHex, capY: 0.045, on: lit, leds: [] });
  };
  const small = (name, x, y, rpx = 8) => {
    const r = u(rpx), m = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.045, 20), dark.clone()), name, x, y, 0.022);
    R.controls.push({ type: 'button', name, x, y, objs: [m], cap: m, capY: 0.022, on: false, leds: [], tint: true });
    return m;
  };
  const led = (name, x, y, hex, k = 1.4, rpx = 2.6) => {
    const m = add(new THREE.Mesh(new THREE.CylinderGeometry(u(rpx), u(rpx), 0.014, 14), glow(hex, k)), name, x, y, 0.008);
    R.leds.push({ name, x, y, mesh: m, k, on: k >= 0.5 });
    if (name === 'xi_led' && x === 566.5) R.cueActive = m;
    return m;
  };
  const toggle = (name, x, y, vertical = 0) => {
    const base = add(new THREE.Mesh(new THREE.CylinderGeometry(u(5), u(5), 0.03, 16), metal), name, x, y, 0.015);
    // the lever turns about its foot, so the base stays put and only the top swings from side to side
    const hinge = new THREE.Group();
    hinge.position.set(WX(x), 0.03, WZ(y));
    g.add(hinge);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.12, 10), metal);
    stick.name = name; stick.position.y = 0.06; stick.castShadow = true;
    hinge.add(stick);
    const ctl = { type: 'switch', name, x, y, objs: [base, stick], hinge, pos: vertical ? 0 : 1, dir: 1, leds: [], vertical: !!vertical,
      // a vertical switch only moves up (off) and down (on), towards the viewer
      setPos(i) { this.pos = i; if (this.vertical) hinge.rotation.x = (i - 1) * 0.5; else hinge.rotation.z = (1 - i) * 0.5; } };
    if (vertical) ctl.setPos(0);
    R.controls.push(ctl);
  };
  const fader = (slotName, capName, x, y1, y2, capY, wide = 22, len = 0.19) => {
    add(new THREE.Mesh(new THREE.BoxGeometry(u(5), 0.012, u(y2 - y1)), dark), slotName, x, (y1 + y2) / 2, 0.006);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.016, u(y2 - y1) - 0.04), metal), slotName, x, (y1 + y2) / 2, 0.018);
    const c1 = add(new THREE.Mesh(new RoundedBoxGeometry(u(wide), 0.1, len, 2, 0.02), col(0x121418, 0.35)), capName, x, capY, 0.06);
    const c2 = add(new THREE.Mesh(new THREE.BoxGeometry(u(wide), 0.104, 0.016), col(0xf4f5f8, 0.4)), capName, x, capY, 0.062);
    const lo = y1 + len / 2 / PX, hi = y2 - len / 2 / PX;   // the cap stays inside the slot
    R.controls.push({ type: 'fader', name: capName, x, y: capY, objs: [c1, c2], lo, hi, value: clamp01(1 - (capY - lo) / (hi - lo)),
      set(v) { this.value = clamp01(v); this.y = lo + (1 - this.value) * (hi - lo); c1.position.z = c2.position.z = WZ(this.y); } });
  };
  const ledColumn = (name, x, ys, lit, size = 4.6) => {
    const meshes = [];
    ys.forEach((y, i) => {
      const hex = i === 0 ? 0xe0402f : i < 4 ? 0xe8d9a8 : 0x3fb35d;
      const mm = add(new THREE.Mesh(new THREE.BoxGeometry(u(size), 0.012, u(size * 0.85)), glow(hex, 0.015)), name, x, y, 0.008);
      mm.userData.hex = hex; mm.material.color.setHex(0x16191e);
      meshes.push(mm);
    });
    R.meters.push({ name, x, meshes, shown: 0 });   // dark until a record is playing
  };
  return { u, dark, metal, col, glow, add, knob, button, pad, small, led, toggle, fader, ledColumn };
}

// Called once a mixer is built: connects each light to its button, gives every control its behaviour and records the factory setting.
export function finishRig(R = rig, opts = {}) {
  // ---- Play mode: link each light to the button beside it, and give every control its behaviour ----
  R.leds.forEach((l) => {
    let best = null, bd = 0.14 / (R.PX || 0.0055);          // within about 14 cm-hundredths of a unit
    R.controls.forEach((c) => {
      if (c.name !== l.name || !(c.type === 'button' || c.type === 'switch')) return;
      const d = Math.hypot(c.x - l.x, c.y - l.y);
      if (d < bd) { bd = d; best = c; }
    });
    if (best) { best.leds.push(l); l.owner = best; }
  });
  const paint = (c) => {
    if (c.type === 'button' || c.type === 'tap') {
      if (c.cap) c.cap.position.y = c.capY - (c.on && c.type === 'button' ? 0.012 : 0);
      if (c.ring && c.type === 'button') {
        if (c.ringAlways) c.ring.visible = true;
        else if (c.hex != null) {                     // the button itself lights in its own colour; the frame around it stays dark
          c.ring.visible = false;
          const m = c.cap.material;
          m.color.setHex(c.on ? c.hex : c.capHex); m.emissive.setHex(c.hex); m.emissiveIntensity = c.on ? 0.85 : 0;
        } else c.ring.visible = c.on;
      }
      if (c.tint) c.cap.material.color.setHex(c.on ? 0x2c4650 : 0x0b0c0f);
      c.leds.forEach((l) => { l.mesh.material.emissiveIntensity = c.on ? l.k : 0.1; });
    }
  };
  R.controls.forEach((c) => {
    if (c.type === 'button') { if (opts.allOff) { c.on = false; c.leds.forEach((l) => { l.on = false; }); } else if (c.leds.length) c.on = c.leds.some((l) => l.on); c.toggle = () => { c.on = !c.on; paint(c); }; paint(c); }
    if (c.type === 'tap') c.toggle = () => {};
    if (c.type === 'switch') {
      c.toggle = c.vertical ? () => c.setPos(c.pos === 0 ? 2 : 0) : () => { const n = c.pos + c.dir; c.dir = n <= 0 || n >= 2 ? -c.dir : c.dir; c.setPos(n); };
    }
    if (c.set) c.set(c.value);
    c.init = c.type === 'button' ? c.on : c.type === 'switch' ? (c.vertical ? 0 : 1) : c.value;      // the factory setting
  });
  // put every control back the way it was when the page loaded
  R.reset = () => {
    R.controls.forEach((c) => {
      if (c.type === 'button') { c.on = c.init; paint(c); }
      else if (c.type === 'switch') { c.dir = 1; c.setPos(c.init); }
      else if (c.set) c.set(c.init);
    });
  };
  // meters: level from 0 to 1 lights that many of the nine lights, counted from the bottom
  R.setMeter = (m, level) => {
    const n = Math.round(clamp01(level) * m.meshes.length);
    if (n === m.shown) return;
    m.shown = n;
    m.meshes.forEach((mesh, i) => { const on = m.meshes.length - 1 - i < n; mesh.material.emissiveIntensity = on ? 1.4 : 0.015; mesh.material.color.setHex(on ? mesh.userData.hex : 0x16191e); });
  };
}

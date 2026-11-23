// Behind the Decks: setup.js
// Builds a whole DJ setup from the models, lets the visitor look around it, zoom into one
// device, hover over its controls and open a split-screen explanation of each one.
//
// HOW IT IS ORGANISED
//   1. SCENE      : renderer, lights, camera, the table
//   2. BUILDING   : loading the models and turning each device into parts that can be found
//   3. STATES     : "overview" (whole setup) -> "device" (zoomed in) -> "part" (panel open)
//   4. INTERACTION: hover, click, keyboard, camera moves

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DEVICES, SCENES } from './content.js';
import { buildProcedural, blinkers, rig } from './models.js';
import { rigTurntable } from './rig.js';
import { addCables } from './cables.js';
import { createPlay } from './play.js';
import { createDemo } from './demo.js';

const page = SCENES[document.body.dataset.page] ? document.body.dataset.page : 'digital';
const SCENE_DEF = SCENES[page];

/* ============================================================
   1. SCENE
   ============================================================ */
const ACCENT = new THREE.Color(0x62d6f5);
const BG = 0x090a0d;
const FOV = 32;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const viewer = $('viewer');
const stage = $('stage');
const panel = $('panel');
const chipsEl = $('chips');
const tooltip = $('tooltip');
const statusEl = $('status');
const loadingEl = $('loading');
const hintEl = $('hint');
const backBtn = $('back');

let renderer, scene, camera, controls, keyLight, rimLight;
let webgl = true;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
  webgl = false;
  $('nogl').hidden = false;
}

if (webgl) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;      // lets a highlight be cut to a box (used by the headphones)

  scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.castShadow = true;
  const lowQuality = new URLSearchParams(location.search).has('lowq');   // used only for automated tests
  const shadowSize = lowQuality ? 512 : window.matchMedia('(max-width: 820px)').matches ? 2048 : 4096;
  keyLight.shadow.mapSize.set(shadowSize, shadowSize);
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.012;
  scene.add(keyLight, keyLight.target);

  const rim = new THREE.DirectionalLight(ACCENT, 0.5);
  rim.position.set(6, 5, -9);
  scene.add(rim);
  rimLight = rim;

  camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 300);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.5;
}

/* ============================================================
   2. BUILDING
   ============================================================ */
const loader = new GLTFLoader();
const fileCache = {};
const progress = {};

function loadFile(url) {
  if (!fileCache[url]) {
    fileCache[url] = loader.loadAsync(url, (e) => {
      progress[url] = e;
      let loadedB = 0, totalB = 0;
      Object.values(progress).forEach((p) => { loadedB += p.loaded; totalB += p.total || p.loaded; });
      if (totalB) loadingEl.textContent = `Loading 3D models… ${Math.round((loadedB / totalB) * 100)}%`;
    });
  }
  return fileCache[url];
}

const devices = {};          // id -> built device
const order = [];            // ids in the order of the scene (only devices that can be clicked)
const pickMeshes = [];       // every mesh the pointer can hit
const meshOwner = new Map(); // mesh -> device id

function makeGlowMaterial(extra) {
  return new THREE.MeshBasicMaterial({
    color: ACCENT, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra
  });
}

function glowOn(obj, material) {
  const glow = new THREE.Mesh(obj.geometry, material);
  glow.renderOrder = 5;
  glow.visible = false;
  obj.add(glow);
  return glow;
}

// Shift a measured shape to a second copy of the same device
function shifted(shape, ox, oz) {
  const s = shape.slice();
  if (s[0] === 'c' || s[0] === 'a') { s[1] += ox; s[2] += oz; }
  else if (s[0] === 'r') { s[1] += ox; s[3] += ox; s[2] += oz; s[4] += oz; }
  else if (s[0] === 'b') { s[1] += ox; s[4] += ox; s[3] += oz; s[6] += oz; }
  return s;
}

// The height of the model's surface at a spot, found by dropping a ray from above
function surfaceY(group, meshes, lx, lz) {
  const origin = group.localToWorld(new THREE.Vector3(lx, 60, lz));
  const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObjects(meshes, false);
  return hit.length ? group.worldToLocal(hit[0].point.clone()).y : null;
}

function buildDecal(group, meshes, shape, k) {
  // A flat glowing shape laid on top of a region of the model
  const kind = shape[0];
  let geo, cx, cz, samples;
  if (kind === 'c') {
    const [, x, z, r] = shape;
    cx = x * k; cz = z * k;
    geo = new THREE.CircleGeometry(r * k, 48);
    samples = [[cx, cz]];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      samples.push([cx + Math.cos(a) * r * k * 0.85, cz + Math.sin(a) * r * k * 0.85]);
    }
  } else if (kind === 'a') {
    const [, x, z, r1, r2] = shape;
    cx = x * k; cz = z * k;
    geo = new THREE.RingGeometry(r1 * k, r2 * k, 96);
    samples = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rm = ((r1 + r2) / 2) * k;
      samples.push([cx + Math.cos(a) * rm, cz + Math.sin(a) * rm]);
    }
  } else {
    const [, x1, z1, x2, z2] = shape;
    cx = ((x1 + x2) / 2) * k; cz = ((z1 + z2) / 2) * k;
    geo = new THREE.PlaneGeometry(Math.abs(x2 - x1) * k, Math.abs(z2 - z1) * k);
    samples = [[cx, cz]];
    [[x1, z1], [x2, z1], [x1, z2], [x2, z2]].forEach(([px, pz]) => samples.push([(cx + px * k) / 2, (cz + pz * k) / 2]));
  }
  const ys = samples.map(([sx, sz]) => surfaceY(group, meshes, sx, sz)).filter((v) => v !== null);
  const y = (ys.length ? Math.max(...ys) : 0) + 0.004;
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: ACCENT, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, y, cz);
  mesh.renderOrder = 5;
  mesh.visible = false;
  return mesh;
}

function inShape(shape, k, p) {
  // p is a point in the device's own measuring frame
  if (shape[0] === 'c') return Math.hypot(p.x - shape[1] * k, p.z - shape[2] * k) <= shape[3] * k;
  if (shape[0] === 'a') {
    const d = Math.hypot(p.x - shape[1] * k, p.z - shape[2] * k);
    return d >= shape[3] * k && d <= shape[4] * k;
  }
  if (shape[0] === 'b') {
    const [, x1, y1, z1, x2, y2, z2] = shape;
    return p.x >= x1 * k && p.x <= x2 * k && p.y >= y1 * k && p.y <= y2 * k && p.z >= z1 * k && p.z <= z2 * k;
  }
  const [, x1, z1, x2, z2] = shape;
  return p.x >= Math.min(x1, x2) * k && p.x <= Math.max(x1, x2) * k && p.z >= Math.min(z1, z2) * k && p.z <= Math.max(z1, z2) * k;
}

function shapeArea(shape, k) {
  if (shape[0] === 'c') return Math.PI * shape[3] ** 2 * k * k;
  if (shape[0] === 'a') return Math.PI * (shape[4] ** 2 - shape[3] ** 2) * k * k;
  if (shape[0] === 'b') return Math.abs((shape[4] - shape[1]) * (shape[6] - shape[3])) * k * k;
  return Math.abs((shape[3] - shape[1]) * (shape[4] - shape[2])) * k * k;
}

function boxClipPlanes(group, shape, k) {
  const [, x1, y1, z1, x2, y2, z2] = shape;
  const planes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -x1 * k), new THREE.Plane(new THREE.Vector3(-1, 0, 0), x2 * k),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -y1 * k), new THREE.Plane(new THREE.Vector3(0, -1, 0), y2 * k),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -z1 * k), new THREE.Plane(new THREE.Vector3(0, 0, -1), z2 * k)
  ];
  planes.forEach((p) => p.applyMatrix4(group.matrixWorld));
  return planes;
}

async function buildDevice(spec) {
  const def = DEVICES[spec.dev];
  const include = spec.include || def.include;
  const k = def.k || 1;

  let model;
  if (def.build) {
    model = buildProcedural(THREE, def.build);
  } else {
    const gltf = await loadFile(def.file);
    model = gltf.scene.clone(true);
    if (include) {
      const drop = [];
      model.traverse((o) => { if (o.isMesh && !o.name.includes(include)) drop.push(o); });
      drop.forEach((o) => o.removeFromParent());
    }
  }
  const deck = spec.dev === 'turntable' && !spec.decor ? rigTurntable(THREE, model) : null;   // platter and tonearm can move

  const holder = new THREE.Group();     // placed on the table
  const group = new THREE.Group();      // the measuring frame: lifted and centred
  model.scale.multiplyScalar(k);
  group.add(model);
  holder.add(group);
  scene.add(holder);

  group.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(group);
  if (def.lift !== false) group.position.y = -box.min.y;
  if (def.center) {
    const c = box.getCenter(new THREE.Vector3());
    group.position.x = -c.x;
    group.position.z = -c.z;
  }
  group.updateMatrixWorld(true);

  const meshes = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    o.castShadow = true;
    o.receiveShadow = true;
  });

  const dev = {
    id: spec.id, spec, def, k, holder, group, meshes, model,
    label: spec.label || def.label,
    summary: def.summary,
    decor: !!spec.decor,
    parts: {}, partList: [], meshPart: new Map(), glows: [], hasBoxes: false, deck
  };

  // Highlight for the whole device (shown when the pointer is over it from the overview)
  if (!dev.decor) {
    meshes.forEach((m) => { dev.glows.push(glowOn(m, makeGlowMaterial())); });
  }

  const ox = spec.origin ? spec.origin[0] : 0;
  const oz = spec.origin ? spec.origin[1] : 0;
  const boxClips = [];

  (dev.decor ? [] : def.parts).forEach((p) => {
    const rt = { def: p, decals: [], objs: [], shapes: [], priority: Infinity };

    // Pieces of the model: each gets a glowing copy laid exactly on top of it.
    (p.meshes || []).forEach((name) => {
      const found = meshes.filter((m) => m.name === name);      // several pieces can share a name
      if (!found.length) { console.warn('Mesh not found:', name); return; }
      found.forEach((obj) => {
        rt.objs.push(obj);
        dev.meshPart.set(obj, p.id);
        rt.decals.push(glowOn(obj, makeGlowMaterial()));
      });
      rt.priority = Math.min(rt.priority, 0);
    });

    // Measured areas on the top of the model: a flat glowing shape laid on the surface.
    (p.regions || []).forEach((raw) => {
      const shape = shifted(raw, ox, oz);
      rt.shapes.push(shape);
      const decal = buildDecal(group, meshes, shape, k);
      group.add(decal);
      rt.decals.push(decal);
      rt.priority = Math.min(rt.priority, shapeArea(shape, k));
    });

    // Blocks of 3D space: the model is highlighted only inside the block.
    (p.boxes || []).forEach((raw) => {
      const shape = shifted(raw, ox, oz);
      rt.shapes.push(shape);
      dev.hasBoxes = true;
      meshes.forEach((m) => {
        const mat = makeGlowMaterial();
        const glow = glowOn(m, mat);
        boxClips.push({ mat, shape });
        rt.decals.push(glow);
      });
      rt.priority = Math.min(rt.priority, shapeArea(shape, k));
    });

    dev.parts[p.id] = rt;
    dev.partList.push(p);
  });

  // Place it on the table
  if (spec.at) holder.position.set(spec.at[0], 0, spec.at[1]);
  holder.rotation.y = spec.rotY || 0;
  holder.updateMatrixWorld(true);
  boxClips.forEach(({ mat, shape }) => { mat.clippingPlanes = boxClipPlanes(group, shape, k); });

  // Measurements in the world, for the camera
  dev.box = new THREE.Box3();
  meshes.forEach((m) => dev.box.expandByObject(m));
  const size = dev.box.getSize(new THREE.Vector3());
  const c = dev.box.getCenter(new THREE.Vector3());
  dev.size = size;
  dev.unit = Math.max(size.x, size.z);
  const az = THREE.MathUtils.radToDeg(spec.rotY || 0) - 8;
  const el = 52, rad = THREE.MathUtils.degToRad(el);
  dev.focus = {
    t: [c.x, dev.box.min.y + size.y * 0.35, c.z],
    w: Math.max(Math.max(size.x, size.z * 0.9) * 1.25, 3.2),
    h: Math.max((size.z * Math.sin(rad) + size.y * Math.cos(rad)) * 1.35, 2.2),
    el, az
  };

  // The level meters are rows of tiny lights with gaps between them. Make the whole column count as the part, so that a
  // click or hover anywhere between the little squares still finds it (one box per column of lights).
  Object.values(dev.parts).forEach((rt) => {
    if (!/meter/i.test(rt.def.id) || !rt.objs.length) return;
    const boxes = rt.objs.map((o) => new THREE.Box3().setFromObject(o).expandByScalar(0.012 * dev.unit));
    const merged = [];
    boxes.forEach((bx) => {
      const hit = merged.find((m) => m.intersectsBox(bx));
      if (hit) hit.union(bx); else merged.push(bx.clone());
    });
    for (let again = true; again;) { again = false; for (let i = 0; i < merged.length && !again; i++) for (let j = i + 1; j < merged.length; j++) if (merged[i].intersectsBox(merged[j])) { merged[i].union(merged[j]); merged.splice(j, 1); again = true; break; } }
    merged.forEach((m) => {
      const lo = group.worldToLocal(m.min.clone()), hi = group.worldToLocal(m.max.clone());
      rt.shapes.push(['b', Math.min(lo.x, hi.x) / k, Math.min(lo.y, hi.y) / k - 0.05, Math.min(lo.z, hi.z) / k, Math.max(lo.x, hi.x) / k, Math.max(lo.y, hi.y) / k + 0.2, Math.max(lo.z, hi.z) / k]);
    });
  });
  Object.values(dev.parts).forEach((rt) => {
    const b = new THREE.Box3();
    rt.objs.forEach((o) => b.expandByObject(o));
    rt.decals.forEach((d) => { if (!d.parent || d.parent === group) b.expandByObject(d); });
    rt.shapes.forEach((s) => {
      if (s[0] !== 'b') return;
      for (const x of [s[1], s[4]]) for (const y of [s[2], s[5]]) for (const z of [s[3], s[6]]) {
        b.expandByPoint(group.localToWorld(new THREE.Vector3(x * k, y * k, z * k)));
      }
    });
    const s = b.getSize(new THREE.Vector3());
    const pc = b.getCenter(new THREE.Vector3());
    const ext = Math.max(s.x, s.z, s.y) * 1.4 + 0.13 * dev.unit;
    rt.focus = { t: [pc.x, pc.y, pc.z], w: ext, h: ext, el: dev.spec.dev === 'headphones' ? 18 : 50, az };
  });

  if (!dev.decor) {
    meshes.forEach((m) => { pickMeshes.push(m); meshOwner.set(m, dev.id); });
    order.push(dev.id);
  }
  devices[spec.id] = dev;
  return dev;
}

function buildTable() {
  const all = new THREE.Box3();
  Object.values(devices).forEach((d) => { if (!d.decor) all.union(d.box); });
  const size = all.getSize(new THREE.Vector3());
  const c = all.getCenter(new THREE.Vector3());

  // Centre everything on the main devices if the scene names them, so extras at the sides don't pull it off-centre
  const mid = new THREE.Box3();
  (SCENE_DEF.focus || []).forEach((id) => { if (devices[id]) mid.union(devices[id].box); });
  const cx = mid.isEmpty() ? c.x : (mid.min.x + mid.max.x) / 2;
  const halfW = mid.isEmpty() ? size.x / 2 : Math.max(all.max.x - cx, cx - all.min.x);

  const slab = new THREE.Mesh(
    new RoundedBoxGeometry(halfW * 2 + 2.4, 0.5, Math.max(size.z, 4) + 2.2, 4, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.92, metalness: 0 })
  );
  slab.position.set(cx, -0.25 - 0.006, c.z + 0.2);
  slab.receiveShadow = true;
  scene.add(slab);

  // Light and shadow follow the size of the setup
  const width = halfW * 2;
  const half = Math.max(width, size.z) * 0.62 + 2;
  keyLight.position.set(cx - width * 0.25, width * 0.75, c.z + width * 0.45);
  keyLight.target.position.set(cx, 0, c.z);
  const sc = keyLight.shadow.camera;
  sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 0.5; sc.far = width * 3;
  sc.updateProjectionMatrix();

  birds = {                                   // Play mode: looking down on the whole setup, so every control is in reach
    t: [cx, 0.2, c.z + 0.35],
    w: width * (page === 'analog' ? 1.18 : 0.8),
    h: size.z * 0.3 + 0.4,
    el: 78, az: 0
  };
  overview = {
    t: [cx, 0.4, c.z + 0.2],
    w: width * 1.3,
    h: size.z * 1.05 + 1.6,
    el: 32, az: -6
  };
  controls.minDistance = 1.2;
  controls.maxDistance = Math.max(width, 10) * 2.4;
}

/* ============================================================
   3. STATES  overview -> device -> part
   ============================================================ */
let overview = null;
let birds = null;
let playView = null;           // Play mode: the stop the camera is at (a device, or a pair of things that go together)
let playStops = [];
// The same close view as Explain mode, so every button can be seen. A few stops frame two things that work together
// (the record bag and the left turntable, the USB drive and the left media player).
function viewFrame(key = playView) {
  // a key can name several things at once, joined with '+' (the DJ mode uses this to pan out to two devices)
  const ids = String(key).includes('+') ? String(key).split('+') : [key, { bag: 'ttL', usb: 'cdjL' }[key]].filter(Boolean);
  key = ids[0];
  const d = devices[key];
  if (!d) return birds;
  const group = ids.map((i) => devices[i]).filter(Boolean);
  if (group.length > 1) {
    const b = group.reduce((acc, o) => acc.union(o.box), group[0].box.clone()), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    // anything that includes the record bag is seen at a slight angle, so the records can be picked out of it
    const tilt = ids.includes('bag');
    return { t: [c.x, b.min.y + sz.y * 0.3, c.z + (tilt ? 0.35 : 0)], w: Math.max(sz.x, sz.z * 0.9) * 1.2 + 0.6, h: sz.z * 1.18 + (tilt ? 1.1 : 0.7), el: tilt ? 58 : 86, az: 0 };
  }
  // straight down from above, so every button on a deck or the mixer can be reached
  const f = d.focus, sz = d.box.getSize(new THREE.Vector3()), c = d.box.getCenter(new THREE.Vector3());
  if (key === 'headphones') return { ...f, el: 80, az: 0 };
  return { t: [c.x, d.box.min.y + sz.y * 0.5, c.z + 0.08], w: Math.max(sz.x * 1.1, 3.2), h: Math.max(sz.z * 1.16 + 0.3, 2.2), el: 86, az: 0 };
}
let state = 'overview';
let activeDev = null;       // id of the device that is zoomed in on
let selected = null;        // id of the selected part
let hoverDev = null;        // id of a device being hovered (from the overview, or another device)
let hoverPart = null;
let anim = null;
let userMoved = false;
let play = null;
let pointerIsDown = false;
const explaining = () => document.body.classList.contains('explain-on');
const playing = () => !!(play && play.playOn && !explaining());   // Play mode, and not also learning

function frameFor(def, aspect) {
  // Work out where the camera must stand so that a w x h area fills the view
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const dist = Math.max(def.h / (2 * tan), def.w / (2 * tan * aspect));
  const el = THREE.MathUtils.degToRad(def.el);
  const az = THREE.MathUtils.degToRad(def.az);
  const target = new THREE.Vector3(...def.t);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return { target, pos: target.clone().addScaledVector(dir, dist) };
}

function viewerAspect(open) {
  const r = stage.getBoundingClientRect();
  if (!open) return r.width / r.height;
  const mobile = window.matchMedia('(max-width: 820px)').matches;
  return mobile ? r.width / (r.height / 2.1) : (r.width * (1.45 / 2.45)) / r.height;
}

function flyTo(f, instant, duration) {
  if (!webgl) return;
  if (reduceMotion || instant) {
    anim = null;
    camera.position.copy(f.pos);
    controls.target.copy(f.target);
    controls.enabled = true;
    controls.update();
    return;
  }
  anim = {
    fromP: camera.position.clone(), fromT: controls.target.clone(),
    toP: f.pos, toT: f.target, t0: 0, dur: duration || 1000
  };
  controls.enabled = false;
}

function stopAuto() {
  if (controls) controls.autoRotate = false;
}

// A highlight that is switched off is hidden completely, so it costs nothing to draw
function setOpacity(list, v) { list.forEach((d) => { d.material.opacity = v; d.visible = v > 0; }); }

function refreshGlow() {
  Object.values(devices).forEach((d) => {
    // Device outline: only from the overview, or when the pointer is over a different device
    const lit = d.id === hoverDev && d.id !== activeDev;
    setOpacity(d.glows, lit ? 0.16 : 0);
    Object.keys(d.parts).forEach((pid) => {
      const on = d.id === activeDev;
      const level = on && pid === selected ? 0.36 : on && pid === hoverPart ? 0.2 : 0;
      setOpacity(d.parts[pid].decals, level);
    });
  });
  chipsEl.querySelectorAll('.chip').forEach((chip) => {
    const key = chip.dataset.key;
    const isSel = state === 'part' ? key === selected : false;
    const isHover = state === 'overview' ? key === hoverDev : key === hoverPart;
    chip.setAttribute('aria-pressed', isSel ? 'true' : 'false');
    chip.classList.toggle('is-hover', isHover && !isSel);
  });
}

function setHover(devId, partId) {
  if (hoverDev === devId && hoverPart === partId) return;
  hoverDev = devId;
  hoverPart = partId;
  refreshGlow();
}

/* ---- Picking: which device and which part is under the pointer? ---- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmp = new THREE.Vector3();

function pick(e) {
  if (!webgl) return null;
  const rect = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickMeshes, false);
  if (!hits.length) return null;
  const devId = meshOwner.get(hits[0].object);
  if (state === 'overview' || devId !== activeDev) return { dev: devId, part: null };

  // Zoomed in on this device: find the part. Look at the nearest surface, plus anything lying
  // on exactly the same surface (for example a record resting on a platter).
  const dev = devices[devId];
  const limit = hits[0].distance + 0.004 * dev.unit;
  const candidates = [];
  for (const h of hits) {
    if (h.distance > limit) break;
    if (meshOwner.get(h.object) !== devId) continue;
    const byPiece = dev.meshPart.get(h.object);
    if (byPiece) return { dev: devId, part: byPiece };
    tmp.copy(h.point);
    dev.group.worldToLocal(tmp);
    const flat = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).y >= 0.3 : true;
    candidates.push({ p: tmp.clone(), flat });
  }
  let best = null;
  for (const c of candidates) {
    for (const part of dev.partList) {
      const rt = dev.parts[part.id];
      const ok = rt.shapes.some((s) => (s[0] === 'b' ? true : c.flat) && inShape(s, dev.k, c.p));
      if (ok && (!best || rt.priority < best.pri)) best = { id: part.id, pri: rt.priority };
    }
    if (best) break;
  }
  return { dev: devId, part: best ? best.id : null };
}

/* ---- Panel ---- */
function fillPanel(id) {
  const dev = devices[activeDev];
  const parts = dev.partList;
  const i = parts.findIndex((p) => p.id === id);
  const p = parts[i];
  $('panel-device').textContent = dev.spec && (dev.spec.dev === 'turntable' || dev.spec.dev === 'cdj') ? dev.label.replace(/\s*\((left|right)\)/i, '') : dev.label;
  $('panel-title').textContent = p.name;
  $('panel-what').textContent = p.what;
  $('panel-use').textContent = p.use;
  $('panel-crowd').textContent = p.crowd;
  $('panel-count').textContent = `${i + 1} / ${parts.length}`;
  const links = $('panel-links');
  links.textContent = '';
  (p.links || []).forEach((l) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = l.url; a.textContent = l.label; a.target = '_blank'; a.rel = 'noopener';
    li.appendChild(a); links.appendChild(li);
  });
  $('panel-links-block').hidden = !(p.links && p.links.length);
}

function setHint() {
  if (playing()) {
    hintEl.textContent = 'Play mode: drag knobs up or down, drag faders, the USB drive, records and headphones, click buttons. Use the arrows at the sides to move to the next device.';
    hintEl.classList.toggle('is-faded', state === 'part');
    return;
  }
  if (false) {
    hintEl.textContent = state === 'overview'
      ? (page === 'digital' ? 'Play mode: click the mixer or a media player to zoom in, then drag the knobs and faders, click the buttons.' : 'Play mode: click the mixer or a turntable to zoom in, then drag the knobs and faders, click the buttons.')
      : state === 'device' ? (page === 'digital' ? 'Play mode: drag knobs up or down, drag faders, click buttons. On a media player, drag the USB drive onto it, choose a song with the rotary selector and press PLAY.' : 'Play mode: drag knobs up or down, drag faders, click buttons and switches. On a turntable, press START/STOP.') : '';
    hintEl.classList.toggle('is-faded', state === 'part');
    return;
  }
  if (state === 'overview') {
    hintEl.textContent = 'Click a device to zoom in · Drag to rotate · Scroll to zoom';
  } else if (state === 'device') {
    const d = devices[activeDev];
    hintEl.textContent = `${d.label}. ${d.summary} Hover over a control and click it to learn more.`;
  }
  hintEl.classList.toggle('is-faded', state === 'part');
}

function buildChips() {
  chipsEl.textContent = '';
  const add = (key, text, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.key = key;
    b.textContent = text;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', onClick);
    const set = (on) => (state === 'overview' ? setHover(on ? key : null, null) : setHover(activeDev, on ? key : null));
    b.addEventListener('mouseenter', () => set(true));
    b.addEventListener('mouseleave', () => set(false));
    b.addEventListener('focus', () => set(true));
    b.addEventListener('blur', () => set(false));
    chipsEl.appendChild(b);
  };
  if (state === 'overview') {
    chipsEl.setAttribute('aria-label', 'Devices in the setup');
    order.forEach((id) => add(id, devices[id].label, () => { if (!playing()) enterDevice(id); }));
  } else {
    chipsEl.setAttribute('aria-label', `Parts of the ${devices[activeDev].label.toLowerCase()}`);
    devices[activeDev].partList.forEach((p) => add(p.id, p.name, () => selectPart(p.id)));
  }
  chipsEl.scrollLeft = 0;
}

function enterOverview(instant, returnFocusTo) {
  const wasPanel = state === 'part';
  const prev = activeDev;
  state = 'overview';
  activeDev = null;
  selected = null;
  hoverDev = hoverPart = null;
  stage.classList.remove('open');
  panel.inert = true;
  backBtn.hidden = true;
  buildChips();
  refreshGlow();
  setHint();
  if (webgl) flyTo(frameFor(playing() && birds ? viewFrame() : overview, viewerAspect(false)), instant);
  statusEl.textContent = 'Showing the whole setup.';
  if (returnFocusTo && prev) { const chip = chipsEl.querySelector(`[data-key="${prev}"]`); if (chip) chip.focus(); }
  return wasPanel;
}

function enterDevice(id, keepFocus) {
  const dev = devices[id];
  if (!dev) return;
  state = 'device';
  activeDev = id;
  selected = null;
  hoverDev = hoverPart = null;
  stage.classList.remove('open');
  panel.inert = true;
  backBtn.hidden = false;
  stopAuto();
  buildChips();
  refreshGlow();
  setHint();
  if (webgl) flyTo(frameFor(dev.focus, viewerAspect(false)));
  statusEl.textContent = `${dev.label}. ${dev.partList.length} parts to explore.`;
  tooltip.hidden = true;
  if (keepFocus) { const chip = chipsEl.querySelector(`[data-key="${keepFocus}"]`); if (chip) chip.focus(); }
}

function selectPart(id) {
  const dev = devices[activeDev];
  if (!dev || !dev.parts[id]) return;
  state = 'part';
  selected = id;
  fillPanel(id);
  stage.classList.add('open');
  panel.inert = false;
  stopAuto();
  setHint();
  refreshGlow();
  if (webgl) flyTo(frameFor(dev.parts[id].focus, viewerAspect(true)));
  statusEl.textContent = `${dev.parts[id].def.name} selected. Details are open.`;
}

function closePanel(returnFocus) {
  if (state !== 'part') return;
  const was = selected;
  enterDevice(activeDev, returnFocus ? was : null);
  statusEl.textContent = 'Details closed.';
}

function stepPart(dir) {
  const parts = devices[activeDev].partList;
  const i = parts.findIndex((p) => p.id === selected);
  selectPart(parts[(i + dir + parts.length) % parts.length].id);
}

function goBack() {
  if (state === 'part') closePanel(false);
  else if (state === 'device') enterOverview(false, true);
}

/* ============================================================
   4. INTERACTION
   ============================================================ */
if (webgl) {
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; pointerIsDown = true; stopAuto(); userMoved = true; });
  window.addEventListener('pointerup', () => { pointerIsDown = false; });
  window.addEventListener('pointercancel', () => { pointerIsDown = false; });
  canvas.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const hit = pick(e);
      if (hit) {
        if (playing()) { /* Play mode: the click works the control, the camera stays above the setup */ }
        else if (hit.dev !== activeDev) enterDevice(hit.dev);
        else if (hit.part && !playing()) selectPart(hit.part);   // in Play mode a click works the control instead
      }
    }
    down = null;
  });
  // Picking tests every triangle under the pointer, so it runs at most once per frame
  let moveEvent = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.buttons) { tooltip.hidden = true; return; }
    if (!moveEvent) requestAnimationFrame(() => { const ev = moveEvent; moveEvent = null; onHover(ev); });
    moveEvent = e;
  });
  function onHover(e) {
    if (playing()) {
      const info = play.hoverInfo(e);
      if (info) {
        canvas.classList.add('is-hover');
        const r = viewer.getBoundingClientRect();
        tooltip.textContent = '';
        tooltip.append(info.name);
        const small = document.createElement('small');
        small.textContent = info.small;
        tooltip.append(small);
        tooltip.style.left = `${e.clientX - r.left + 14}px`;
        tooltip.style.top = `${e.clientY - r.top + 14}px`;
        tooltip.hidden = false;
        return;
      }
    }
    const hit = pick(e);
    const overOther = hit && hit.dev !== activeDev;
    // While playing, only whole devices are highlighted; the parts are highlighted only when learning
    setHover(hit && !playing() ? hit.dev : null, hit && !playing() ? hit.part : null);
    const target = hit && !playing() && (overOther ? { name: devices[hit.dev].label, small: 'Click to zoom in' } :
      hit.part && !playing() ? { name: devices[hit.dev].parts[hit.part].def.name, small: 'Click to learn more' } : null);
    canvas.classList.toggle('is-hover', !!target);
    if (target) {
      const r = viewer.getBoundingClientRect();
      tooltip.textContent = '';
      tooltip.append(target.name);
      const small = document.createElement('small');
      small.textContent = target.small;
      tooltip.append(small);
      tooltip.style.left = `${e.clientX - r.left + 14}px`;
      tooltip.style.top = `${e.clientY - r.top + 14}px`;
      tooltip.hidden = false;
    } else {
      tooltip.hidden = true;
    }
  }
  canvas.addEventListener('pointerleave', () => { setHover(null, null); tooltip.hidden = true; canvas.classList.remove('is-hover'); });

  // Keyboard: arrows rotate, + and - zoom (when the canvas has focus)
  canvas.addEventListener('keydown', (e) => {
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    let used = true;
    if (e.key === 'ArrowLeft') sph.theta -= 0.14;
    else if (e.key === 'ArrowRight') sph.theta += 0.14;
    else if (e.key === 'ArrowUp') sph.phi = clamp(sph.phi - 0.1, 0.15, Math.PI / 2 - 0.04);
    else if (e.key === 'ArrowDown') sph.phi = clamp(sph.phi + 0.1, 0.15, Math.PI / 2 - 0.04);
    else if (e.key === '+' || e.key === '=') sph.radius = clamp(sph.radius * 0.9, controls.minDistance, controls.maxDistance);
    else if (e.key === '-' || e.key === '_') sph.radius = clamp(sph.radius * 1.1, controls.minDistance, controls.maxDistance);
    else used = false;
    if (used) {
      e.preventDefault();
      stopAuto();
      off.setFromSpherical(sph);
      camera.position.copy(controls.target).add(off);
      controls.update();
    }
  });
  controls.addEventListener('start', stopAuto);
}

$('panel-close').addEventListener('click', () => closePanel(true));
$('prev').addEventListener('click', () => stepPart(-1));
$('next').addEventListener('click', () => stepPart(1));
backBtn.addEventListener('click', goBack);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state !== 'overview') goBack(); });

$('mode-toggle').addEventListener('click', () => {
  const on = $('mode-toggle').getAttribute('aria-pressed') !== 'true';
  $('mode-toggle').setAttribute('aria-pressed', on ? 'true' : 'false');
  document.body.classList.toggle('explain-on', on);
  if (on && window.__demoOff) window.__demoOff();
  setHint();
  if (play && play.playOn) setHover(null, null);
  // leaving Explain mode while Play mode is on: glide straight back to the bird's-eye view of the current device
  if (!on && play && play.playOn && webgl) {
    if (state === 'part') closePanel(false);
    if (state === 'device') enterOverview(false, false);
    else if (state === 'overview') flyTo(frameFor(viewFrame(), viewerAspect(false)), false, 1000);
  }
});

/* ---- Size and render loop ---- */
function resize() {
  if (!webgl) return;
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
if (webgl) new ResizeObserver(resize).observe(viewer);

let lastFrame = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const nowMs = performance.now();
  const dt = Math.min(0.1, (nowMs - lastFrame) / 1000);
  lastFrame = nowMs;
  if (play) play.update(nowMs / 1000, dt);
  if (anim) {
    anim.t0 = (anim.t0 || 0) + dt * 1000;                     // the clock only counts frames that were drawn (and never more than 0.1 s per frame), so a slow frame never makes the camera jump
    const k = ease(Math.min(1, anim.t0 / anim.dur));
    camera.position.lerpVectors(anim.fromP, anim.toP, k);
    controls.target.lerpVectors(anim.fromT, anim.toT, k);
    if (k >= 1) { anim = null; controls.enabled = true; }
  }
  controls.update();
  // Flash the tap-button rings on the beat (120 beats per minute); with reduced motion they stay lit
  if (blinkers.length) {
    const on = reduceMotion || ((performance.now() / 1000) % 1) < 0.4;
    for (const b of blinkers) b.material.emissiveIntensity = on ? 2 : 0.12;
  }
  renderer.render(scene, camera);
}

// The home page leaves a note in the browser's session storage when a button is clicked
let arriving = false;
try {
  arriving = !reduceMotion && sessionStorage.getItem('deck-arriving') === '1';
  sessionStorage.removeItem('deck-arriving');
} catch (err) { /* storage not available: no entrance animation */ }
if (arriving) document.body.classList.add('arriving');

/* ---- Play mode and DJ mode (analog page only) ---- */
function setupModes() {
  play = createPlay({
    THREE, scene, canvas, camera, controls, devices, pickMeshes, meshOwner, rim: rimLight,
    getState: () => ({ state, activeDev, busy: !!anim, pointerDown: pointerIsDown, explaining: explaining() }),
    say: (text) => { statusEl.textContent = text; },
    onChange: () => { setHint(); }
  });
  if (play.available) { const mx = Object.values(devices).find((d) => d.def && (d.def.build === 'xone' || d.def.build === 'djm')); if (mx) addCables(THREE, scene, devices, rig.root, mx, mx.def.build === 'djm' ? { decks: ['cdjL', 'cdjR'], input: 'xr_line' } : {}); }
  if (new URLSearchParams(location.search).has('lowq')) window.__dbg = { devices, camera, rig, play };   // for automated tests only
  if (!play.available) return;
  const bar = $('mode-bar');
  if (bar) bar.hidden = false;
  const bind = (id, apply, label) => {
    const b = $(id);
    if (!b) return;
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) stopAuto();                          // any mode stops the slow spin
      apply(on);
      statusEl.textContent = `${label} ${on ? 'on' : 'off'}.`;
    });
  };
  // Play mode needs room: on a phone held upright, ask the visitor to turn it sideways
  const rotateNote = document.createElement('div');
  rotateNote.className = 'rotate-note'; rotateNote.hidden = true;
  rotateNote.innerHTML = '<p><strong>Turn your phone sideways</strong><br>Play mode needs a wide screen to reach the controls.</p>';
  document.getElementById('viewer').appendChild(rotateNote);
  const portraitPhone = window.matchMedia('(orientation: portrait) and (max-width: 820px)');
  const shortScreen = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
  let barAutoHidden = false;
  const updateRotate = () => {
    rotateNote.hidden = !(playing() && portraitPhone.matches);
    // a phone held sideways has little height: tuck the top bar away so the setup gets the whole screen
    if (playing() && shortScreen.matches && !barAutoHidden) { const hb = document.getElementById('bar-hide'); if (hb && !document.body.classList.contains('bar-hidden')) { hb.click(); barAutoHidden = true; } }
    // keep the whole setup in view when the screen turns or the bar goes away
    if (playing() && state === 'overview' && webgl && birds) setTimeout(() => flyTo(frameFor(viewFrame(), viewerAspect(false)), true), 350);
  };
  shortScreen.addEventListener('change', updateRotate);
  window.addEventListener('resize', updateRotate);
  portraitPhone.addEventListener('change', updateRotate);
  bind('play-toggle', (on) => {
    if (!on && window.__demoOff) window.__demoOff();
    if (on && state === 'part') closePanel(false);
    play.setPlay(on);                                // Play mode also switches the sound on
    updateRotate();
    if (on && state === 'device') enterOverview(false, false);
    else if (webgl && state === 'overview') flyTo(frameFor(on && birds ? viewFrame() : overview, viewerAspect(false)));
    if (on) { setHint(); refreshGlow(); }
    syncPlayUi();
  }, 'Play mode');
  // the guided DJ demo
  const demoBtn = $('demo-toggle');
  let demo = null;
  if (demoBtn && play.demo) {
    const viewerEl = document.getElementById('viewer');
    demo = createDemo({ THREE, camera, canvas, viewer: viewerEl, play, page, say: (m) => { statusEl.textContent = m; }, goTo: (id) => goView(id) });
    const setDemo = (on) => {
      demoBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      document.body.classList.toggle('demo-on', on);
      statusEl.textContent = on ? 'DJ mode on.' : 'DJ mode off.';
      if (on) {
        stopAuto();
        if (explaining()) document.getElementById('mode-toggle').click();
        const pt = document.getElementById('play-toggle');
        if (pt.getAttribute('aria-pressed') !== 'true') pt.click();
        demo.start();
      } else demo.stop();
    };
    demoBtn.addEventListener('click', () => setDemo(demoBtn.getAttribute('aria-pressed') !== 'true'));
    demo.onEnd = () => setDemo(false);
    window.__demoOff = () => { if (demo.active) setDemo(false); };
    window.__demo = demo;
  }
  // moving around in Play mode: a ringed arrow at each side takes the camera to the next device, so everything can be reached
  const sx = (d) => (devices[d] ? devices[d].holder.position.x : 0);
  playStops = [...(SCENE_DEF.focus || []), ...['bag', 'usb', 'headphones']].filter((id) => devices[id] && !devices[id].decor).sort((p, q) => sx(p) - sx(q));
  const nameOf = (id) => ({ bag: 'Record bag', usb: 'USB drive', headphones: 'Headphones', mixer: 'Mixer' }[id] || (devices[id].label || id).replace(/\s*\((left|right)\)/i, (m, s) => ' · ' + s));
  const mkArrow = (dir) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'play-arrow ' + (dir < 0 ? 'prev' : 'next'); b.hidden = true;
    b.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '"/></svg>';
    b.addEventListener('click', () => goStop(playStops.indexOf(playView) + dir));
    document.getElementById('viewer').appendChild(b);
    return b;
  };
  const prevB = mkArrow(-1), nextB = mkArrow(1);
  const views = document.createElement('p');
  views.className = 'play-views'; views.hidden = true; views.setAttribute('aria-live', 'polite');
  document.getElementById('viewer').appendChild(views);
  const paintStops = () => {
    const i = playStops.indexOf(String(playView).split('+')[0]);
    views.textContent = String(playView).includes('+') ? String(playView).split('+').map(nameOf).join(' + ') : nameOf(playView || playStops[0]);
    const prev = playStops[i - 1], next = playStops[i + 1];
    prevB.disabled = !prev; nextB.disabled = !next;
    prevB.title = prev ? 'Go to: ' + nameOf(prev) : ''; nextB.title = next ? 'Go to: ' + nameOf(next) : '';
    prevB.setAttribute('aria-label', prev ? 'Go to ' + nameOf(prev) : 'No device further left');
    nextB.setAttribute('aria-label', next ? 'Go to ' + nameOf(next) : 'No device further right');
  };
  // DJ mode can ask for a view that frames several devices at once ('bag+ttR' ...)
  function goView(key) {
    if (!String(key).includes('+')) { const n = playStops.indexOf(key); if (n >= 0) goStop(n); return; }
    playView = key; paintStops();
    if (webgl && state === 'overview') flyTo(frameFor(viewFrame(key), viewerAspect(false)), false, 1100);
  }
  function goStop(i) {
    const id = playStops[i];
    if (!id) return;
    playView = id;
    paintStops();
    if (webgl && state === 'overview') flyTo(frameFor(viewFrame(), viewerAspect(false)), false, 900);
    statusEl.textContent = `${nameOf(id)}. Use the arrows at the sides to move to the next device. The controls work.`;
  }
  // Picking up a record: pull back so both turntables are in view (the record can go on either one), then return to where we were
  const wideKey = ['bag', 'ttL', 'mixer', 'ttR'].filter((i) => devices[i]).join('+');
  let regrab = 0;
  const phonesKey = ['ttL', 'cdjL', 'mixer', 'ttR', 'cdjR', 'headphones'].filter((i) => devices[i]).join('+');
  play.onGrab = (on, what) => {
    clearTimeout(regrab);
    if (what === 'phones') {                      // headphones in hand: pull back so the mixer and the headphones are both in view, then go in on the mixer
      if (!webgl || !playing() || state !== 'overview' || !devices.headphones || (String(playView).includes('+') && String(playView).includes('headphones'))) return;
      if (on) { if (String(playView) !== phonesKey) flyTo(frameFor(viewFrame(phonesKey), viewerAspect(false)), false, 900); }
      else regrab = setTimeout(() => { if (playing() && state === 'overview') goView('mixer'); }, 1100);
      return;
    }
    if (!webgl || !playing() || state !== 'overview' || !devices.bag || wideKey.split('+').length < 3) return;
    if (on) { if (String(playView) !== wideKey) flyTo(frameFor(viewFrame(wideKey), viewerAspect(false)), false, 900); }
    else regrab = setTimeout(() => { if (playing() && state === 'overview') flyTo(frameFor(viewFrame(), viewerAspect(false)), false, 1000); }, 900);
  };
  window.__playViews = { go: goStop, stops: playStops };
  playView = playStops.includes('mixer') ? 'mixer' : playStops[0];
  paintStops();
  const syncPlayUi = () => {
    const on = playing();
    views.hidden = prevB.hidden = nextB.hidden = !on;
    const d = $('defaults-btn'); if (d) d.hidden = !on;
  };
  new MutationObserver(syncPlayUi).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const reset = $('defaults-btn');
  if (reset) reset.addEventListener('click', () => {
    const id = String(playView).split('+')[0];
    const msg = play.resetView ? play.resetView(id) : null;
    statusEl.textContent = msg || 'Nothing to reset in this view. Go to the mixer, a media player or a turntable to put it back to its default settings.';
  });
}

async function start() {
  if (!webgl) {
    // No 3D support: show the devices and their parts as a plain reading list
    loadingEl.hidden = true;
    SCENE_DEF.items.filter((s) => !s.decor).forEach((s) => {
      const d = DEVICES[s.dev];
      devices[s.id] = { id: s.id, label: s.label || d.label, summary: d.summary, partList: d.parts, parts: {}, decor: false };
      d.parts.forEach((p) => { devices[s.id].parts[p.id] = { def: p, decals: [] }; });
      order.push(s.id);
    });
    buildChips();
    return;
  }
  resize();
  loop();
  try {
    for (const spec of SCENE_DEF.items) await buildDevice(spec);
    buildTable();
    resize();
    setupModes();
    enterOverview(true);
    controls.autoRotate = !reduceMotion && !userMoved;
    loadingEl.hidden = true;
    if (arriving) {
      // Arriving from the home page: the camera starts far back and moves in to the setup
      const f = frameFor(overview, viewerAspect(false));
      camera.position.copy(f.target).addScaledVector(f.pos.clone().sub(f.target), 2.8);
      camera.position.y += 1.5;
      controls.update();
      flyTo(f, false, 2600);
      requestAnimationFrame(() => document.body.classList.remove('arriving'));
    }
    document.documentElement.dataset.ready = page;
  } catch (err) {
    console.error(err);
    loadingEl.hidden = false;
    loadingEl.textContent = 'The 3D models could not be loaded. Check your connection and try again.';
    document.body.classList.remove('arriving');
  }
}

if (webgl) { document.documentElement.dataset.state = 'loading'; }
/* ---------- hide the top bar (for a clean, immersive view) ---------- */
{
  const actions = document.getElementById('subbar-r');
  const hideBtn = document.createElement('button');
  hideBtn.type = 'button'; hideBtn.id = 'bar-hide'; hideBtn.className = 'btn btn-sm';
  hideBtn.title = 'Hide this bar for a clean view (press H to bring it back)'; hideBtn.textContent = 'Hide bar';
  if (actions) actions.appendChild(hideBtn);
  const showBtn = document.createElement('button');
  showBtn.type = 'button'; showBtn.id = 'bar-show'; showBtn.className = 'btn bar-show'; showBtn.hidden = true;
  showBtn.textContent = 'Show menu'; showBtn.title = 'Bring the top bar back (H)';
  document.body.appendChild(showBtn);
  const setBar = (hidden) => {
    document.body.classList.toggle('bar-hidden', hidden);
    showBtn.hidden = !hidden;
    statusEl.textContent = hidden ? 'Top bar hidden. Press H or use the Show menu button to bring it back.' : 'Top bar shown.';
  };
  hideBtn.addEventListener('click', () => setBar(true));
  showBtn.addEventListener('click', () => setBar(false));
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) setBar(!document.body.classList.contains('bar-hidden'));
  });
}

/* ---------- left alone for a while: go back to the slowly spinning welcome view ---------- */
{
  const params = new URLSearchParams(location.search);
  const IDLE_MS = (Number(params.get('idle')) || 300) * 1000;               // five minutes (?idle=seconds is for testing)
  let last = Date.now(), done = false;
  const touch = () => { last = Date.now(); done = false; };
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
  setInterval(() => {
    if (done || !webgl || !controls || Date.now() - last < IDLE_MS) return;
    done = true;
    for (const id of ['play-toggle', 'mode-toggle']) { const b = document.getElementById(id); if (b && b.getAttribute('aria-pressed') === 'true') b.click(); }
    if (play && play.resetAll) play.resetAll();
    if (state === 'part') closePanel(false);
    enterOverview(false, false);
    userMoved = false;
    if (!reduceMotion) setTimeout(() => { controls.autoRotate = true; }, 1300);
    statusEl.textContent = 'Back to the start view.';
  }, 5000);
}

start();

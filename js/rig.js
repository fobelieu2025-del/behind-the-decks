// Behind the Decks: rig.js
// Makes the turntable model move. The model comes as one piece, so the parts that must move
// (platter and record, tonearm, power knob, pitch fader, anti-skating dial, the pop-up lamp) are moved
// into their own groups, each one turning or sliding around its real pivot. All numbers are in the
// model's own units (the model is 64 wide).

const D = Math.PI / 180;
const PLATTER_AXIS = [-6.495, 0, 0.05];       // the spindle
const ARM_PIVOT = [22.2, 19.5, -19.7];        // the base of the tonearm
const ARM_TO_NEEDLE = [-7.7, 39.5];           // from the pivot to the stylus, seen from above (x, z)
const POWER_AT = [-29.2, 0, 15.6];            // power knob
const ANTISKATE_AT = [26.1, 0, -12.2];        // anti-skating dial
const LAMP_AT = [5.8, 15.07, 22.3];           // the pop-up stylus lamp
const PITCH_Z0 = 9.86, PITCH_TRAVEL = 6.2;    // the pitch fader cap: its middle and how far it can slide

export const GROOVE_START = -14 * D;          // the arm swings this far to reach the outer groove
export const GROOVE_END = -26 * D;            // and this far at the end of the record
export const ARM_DROP = 2.8 * D;              // how far the arm tips down to put the stylus in the groove
export const PITCH_RANGE = 0.08;              // plus or minus 8 percent
export const SKATE_NORMAL = 2.0;              // anti-skating is set to match the stylus pressure, in grams
export const SKATE_TOLERANCE = 0.9;           // how far from normal before the stylus starts to skip
export const SKATE_MAX = 3.0;

export function rigTurntable(THREE, model) {
  model.updateMatrixWorld(true);
  const named = (n) => { let hit = null; model.traverse((o) => { if (o.isMesh && o.name === n) hit = o; }); return hit; };
  const group = (pos, names, parent = model) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    parent.add(g);
    names.forEach((n) => { const m = named(n); if (m) g.attach(m); });
    return g;
  };

  const platter = group(PLATTER_AXIS, ['table_sm_tt_sp_mat_0', 'table_sm_metal_mat_0', 'table_sm_turn_plade_mat_0']);

  const yaw = new THREE.Group();               // swings the arm over the record
  yaw.position.set(...ARM_PIVOT);
  const lift = new THREE.Group();              // tips the arm down onto the record
  yaw.add(lift);
  model.add(yaw);
  ['arm_msh_metal_mat_0', 'arm_msh_phongE4_0', 'needle_system_msh_needle_mat_0', 'needle_msh_metal_mat1_0'].forEach((n) => { const m = named(n); if (m) lift.attach(m); });
  const len = Math.hypot(...ARM_TO_NEEDLE);
  const axis = new THREE.Vector3(ARM_TO_NEEDLE[1] / len, 0, -ARM_TO_NEEDLE[0] / len).normalize();

  const power = group(POWER_AT, ['polySurface15_phongE7_0', 'polySurface15_metal_mat_0', 'polySurface15_body_top_mat_0']);
  const skate = group(ANTISKATE_AT, ['polySurface18_phongE4_0', 'polySurface18_body_top_mat_0']);
  const pitch = group([0, 0, 0], ['speed_sm_metal_mat_0']);
  // The target light. The model has it as one piece with its base, so it is rebuilt: a base ring that stays in
  // the deck, and a metal rod that slides up out of it. The red light shines out of a slot in the rod itself.
  const LAMP = 'polySurface11_metal_mat_0';
  const lampOld = named(LAMP);
  const lampMat = lampOld ? lampOld.material : new THREE.MeshStandardMaterial({ color: 0xb4b8c2, metalness: 1, roughness: 0.3 });
  if (lampOld) lampOld.removeFromParent();
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(1.93, 1.93, 0.3, 40), lampMat);
  lampBase.name = LAMP; lampBase.position.set(LAMP_AT[0], LAMP_AT[1] + 0.15, LAMP_AT[2]); model.add(lampBase);
  const lamp = new THREE.Group();
  lamp.position.set(...LAMP_AT); model.add(lamp);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 3.9, 36), lampMat);
  rod.name = LAMP; rod.position.y = 1.95; lamp.add(rod);

  // little lights: the pilot / strobe lamp by the power knob, two speed lamps and the lamp bulb
  const emissive = (hex, r) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshStandardMaterial({ color: 0x151515, emissive: hex, emissiveIntensity: 0 }));
    m.userData.noPick = true;
    return m;
  };
  const strobe = emissive(0x4aa8ff, 0.38); strobe.position.set(-24.6, 15.45, 17.2); model.add(strobe);
  const lamp33 = emissive(0x4aa8ff, 0.32); lamp33.position.set(-21.65, 15.4, 21.7); model.add(lamp33);
  const lamp45 = emissive(0x4aa8ff, 0.32); lamp45.position.set(-18.1, 15.4, 21.7); model.add(lamp45);
  // the slot in the side of the rod, facing the stylus, with the red light glowing inside it
  const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.9, 4, 14), new THREE.MeshStandardMaterial({ color: 0x2a0b08, emissive: 0xff2a18, emissiveIntensity: 0, roughness: 0.4 }));
  bulb.scale.z = 0.25; bulb.position.set(0, 2.55, -1.2); bulb.userData.noPick = true; bulb.raycast = () => {}; lamp.add(bulb);
  const spot = new THREE.SpotLight(0xff2a18, 0, 1.4, 0.55, 0.85, 1.6);   // red light on the stylus
  spot.position.set(0, 2.55, -1.0);
  lamp.add(spot);
  const aim = new THREE.Object3D();
  aim.position.set(5.2 - LAMP_AT[0], 16.9 - LAMP_AT[1], 16.7 - LAMP_AT[2]);
  lamp.add(aim);
  spot.target = aim;

  // printed words on the buttons (flat planes just above them, that never take a click)
  const label = (txt, x1, z1, x2, z2, y, fit = 0.8) => {
    const w = x2 - x1, h = z2 - z1, cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = Math.max(64, Math.round(512 * h / w));
    const c = cvs.getContext('2d');
    c.fillStyle = '#f2f4f7'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let size = cvs.height * fit; c.font = `700 ${size}px Inter, Arial, sans-serif`;
    while (c.measureText(txt).width > cvs.width * 0.9 && size > 8) { size -= 2; c.font = `700 ${size}px Inter, Arial, sans-serif`; }
    c.fillText(txt, cvs.width / 2, cvs.height / 2 + size * 0.04);
    const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); m.raycast = () => {}; m.userData.noPick = true; model.add(m);
  };
  label('START/STOP', -30.09, 19.25, -24.46, 23.39, 15.35, 0.34);
  label('33 RPM', -23.23, 22.51, -20.07, 23.36, 15.29, 0.62);
  label('45 RPM', -19.71, 22.51, -16.56, 23.36, 15.29, 0.62);

  return {
    model, platter, yaw, lift, axis, power: power, skate, pitchCap: pitch, lampGroup: lamp,
    strobe, lamp33, lamp45, bulb, spot,
    // state, changed by the visitor
    powerOn: false,       // the power knob
    on: false,            // the start button has been pressed
    leverUp: false,       // the cueing lever holds the arm off the record
    lampUp: false,        // the stylus lamp is popped up
    rpm: 100 / 3,
    pitchValue: 0,        // -1 to 1 (plus or minus 8 percent)
    skateValue: SKATE_NORMAL,
    songPos: 0, trackDur: 0,   // where the stylus is in the song, and how long the song is (seconds)
    record: null,         // the number of the record from the bag that lies on the platter
    // state, worked out every frame
    spin: 0, yawAngle: 0, liftAngle: 0, progress: 0, knobAngle: 0, skateAngle: 0, lampRise: 0, hop: 0,
    skipping: false,
    playing: false        // the record is turning and the stylus is in the groove
  };
}

export const speedFactor = (deck) => 1 + deck.pitchValue * PITCH_RANGE;
export const skateIsOff = (deck) => Math.abs(deck.skateValue - SKATE_NORMAL) > SKATE_TOLERANCE;

const ease = (cur, goal, dt, rate) => cur + (goal - cur) * (1 - Math.exp(-dt * rate));

// Called every frame. dt is the time since the last frame in seconds, t is the clock in seconds.
export function tickDeck(deck, dt, t) {
  if (!deck.powerOn) { deck.on = false; deck.lampUp = false; }

  // the platter
  const goal = deck.on ? (deck.rpm / 60) * speedFactor(deck) : 0;
  deck.spin = ease(deck.spin, goal, dt, deck.on ? 3.2 : deck.powerOn ? 1.1 : 0.45);   // quick start, slow wind-down
  if (deck.spin < 0.0005) deck.spin = 0;
  deck.platter.rotation.y -= deck.spin * Math.PI * 2 * dt;                           // clockwise seen from above

  // the tonearm
  deck.skipping = deck.on && skateIsOff(deck);
  const wantDown = deck.on && !deck.leverUp;
  const grooveYaw = GROOVE_START + (GROOVE_END - GROOVE_START) * deck.progress;
  const atGroove = Math.abs(deck.yawAngle - grooveYaw) < 0.012;
  let yawGoal;
  if (deck.on) yawGoal = deck.leverUp && deck.liftAngle > 0.01 ? deck.yawAngle : grooveYaw;
  else yawGoal = deck.liftAngle > 0.008 ? deck.yawAngle : 0;                           // lift first, then swing home
  deck.yawAngle = ease(deck.yawAngle, yawGoal, dt, 2.6);
  const liftGoal = wantDown && atGroove ? ARM_DROP : 0;
  deck.liftAngle = ease(deck.liftAngle, liftGoal, dt, liftGoal ? 7 : 6);

  // a wrong anti-skating setting makes the stylus hop in the groove
  deck.hop = ease(deck.hop, deck.skipping && deck.liftAngle > 0.02 ? 1 : 0, dt, 8);
  const jitter = deck.hop * (Math.max(0, Math.sin(t * 17)) * 0.022 - 0.003);

  deck.playing = deck.on && deck.record != null && !deck.skipping && deck.liftAngle > ARM_DROP * 0.9 && deck.spin > (deck.rpm / 60) * speedFactor(deck) * 0.9;
  if (deck.trackDur > 0) deck.progress = Math.min(1, deck.songPos / deck.trackDur);   // the stylus works inwards as the song plays
  else if (deck.playing) deck.progress = Math.min(1, deck.progress + dt / 150);
  if (!deck.on && deck.spin === 0) { deck.progress = 0; deck.songPos = 0; }

  deck.yaw.rotation.y = deck.yawAngle;
  deck.lift.quaternion.setFromAxisAngle(deck.axis, Math.max(0, deck.liftAngle - jitter));

  // the power knob turns a quarter turn clockwise to switch on
  deck.knobAngle = ease(deck.knobAngle, deck.powerOn ? -80 * D : 0, dt, 10);
  deck.power.rotation.y = deck.knobAngle;

  // the anti-skating dial
  const goalSkate = ((deck.skateValue / SKATE_MAX) - 0.5) * 300 * D * -1;
  deck.skateAngle = ease(deck.skateAngle, goalSkate, dt, 14);
  deck.skate.rotation.y = deck.skateAngle;

  // the pitch fader cap
  deck.pitchCap.position.z = deck.pitchValue * PITCH_TRAVEL;

  // the pop-up stylus lamp
  deck.lampRise = ease(deck.lampRise, deck.lampUp ? 1 : 0, dt, 9);
  deck.lampGroup.position.y = 15.07 - 3.62 * (1 - deck.lampRise);
  const lit = deck.lampUp && deck.powerOn && deck.lampRise > 0.85;
  deck.bulb.material.emissiveIntensity = lit ? 3.2 : 0;
  deck.spot.intensity = lit ? 9 : 0;

  // pilot and speed lamps
  deck.strobe.material.emissiveIntensity = deck.powerOn ? 2.4 : 0;
  deck.lamp33.material.emissiveIntensity = deck.powerOn && deck.rpm < 40 ? 2.2 : 0;
  deck.lamp45.material.emissiveIntensity = deck.powerOn && deck.rpm >= 40 ? 2.2 : 0;
}

export const PITCH_GEOM = { z0: PITCH_Z0, travel: PITCH_TRAVEL };

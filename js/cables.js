// Behind the Decks: cables.js
// Draws the cables of the analog setup: each turntable plugs into its phono inputs on the back of the
// mixer, and the booth outputs go to the two booth monitors. Cables run out of the back of the mixer, down
// to the table and along it in neat parallel lines, then up to the back of the device. Nothing here can be
// clicked; the cables are only there so the setup looks like a real one.

export function addCables(THREE, scene, devices, rigRoot, mixerDev, opts = {}) {
  const cables = new THREE.Group();
  cables.name = 'cables';
  scene.add(cables);
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.55, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.3, metalness: 0.85 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc23a2d, roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.5 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  rigRoot.updateWorldMatrix(true, true);

  // the sockets on the back of the mixer, found by name, left to right
  const socket = (name) => {
    const seen = new Map();
    rigRoot.traverse((o) => {
      if (o.isMesh && o.name === name) {
        const p = o.getWorldPosition(V(0, 0, 0)), k = p.x.toFixed(2) + ',' + p.y.toFixed(2);
        if (!seen.has(k)) seen.set(k, p);
      }
    });
    return [...seen.values()].sort((a, b) => a.x - b.x);
  };
  const phono = socket(opts.input || 'xr_phono'), booth = socket('xr_booth');
  const boxOf = (dev) => new THREE.Box3().setFromObject(dev.holder);

  // A cable. points[0] is the centre of the socket it plugs into on the back of the mixer; the plug sits on the
  // socket, pointing straight out of the back, so it really is pushed in. The far end gets a smaller plug too.
  function run(points, plugColor, radius = 0.022) {
    const a = points[0].clone();
    const PL = 0.16, PR = 0.056;                                           // plug length and radius
    const dirOut = V(0, 0, -1);
    const out = a.clone().addScaledVector(dirOut, PL);
    const pts = [out, ...points.slice(1)];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, radius, 8, false), black);
    tube.castShadow = true; tube.userData.noPick = true;
    cables.add(tube);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dirOut);
    const put = (geo, mat, at) => { const m = new THREE.Mesh(geo, mat); m.position.copy(at); m.quaternion.copy(q); m.userData.noPick = true; m.castShadow = true; cables.add(m); };
    put(new THREE.CylinderGeometry(PR, PR, PL * 0.62, 16), plugColor, a.clone().addScaledVector(dirOut, 0.015 + PL * 0.31));   // the plug body round the socket
    put(new THREE.CylinderGeometry(PR * 1.12, PR * 1.12, 0.02, 16), steel, a.clone().addScaledVector(dirOut, 0.012));          // its metal collar at the panel
    put(new THREE.CylinderGeometry(radius * 1.25, PR * 0.95, PL * 0.38, 12), plugColor, a.clone().addScaledVector(dirOut, 0.015 + PL * 0.81));   // the strain relief
    // far end: a short plug seated against the back of the device
    const e = points[points.length - 1], e0 = points[points.length - 2];
    const dir2 = e.clone().sub(e0).normalize();
    const q2 = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir2);
    const far = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.8, radius * 1.8, 0.1, 12), plugColor);
    far.position.copy(e).addScaledVector(dir2, -0.05); far.quaternion.copy(q2); far.userData.noPick = true; cables.add(far);
  }

  const tableY = 0.035;
  // a turntable feeds one channel: two cables (left and right) and a thin earth wire, all side by side
  const deckIds = (opts.decks || ['ttL', 'ttR']).filter((id) => devices[id]);
  deckIds.forEach((id, n) => {
    const b = boxOf(devices[id]), pair = [phono[n * 2 + 2], phono[n * 2 + 3]];   // channel 2 and 3 (the first pair is channel 1)
    if (!pair[0] || !pair[1]) return;
    const side = n === 0 ? -1 : 1;
    // the outputs on the back of the device, if it has sockets (the media players do): the cables plug into them
    const outs = [];
    devices[id].holder.traverse((o) => { if (o.isMesh && o.name === 'cr_out') { const p = o.getWorldPosition(V(0, 0, 0)); if (!outs.some((q) => Math.abs(q.x - p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01)) outs.push(p); } });
    outs.sort((a, b2) => a.x - b2.x);
    pair.forEach((j, k) => {
      const lane = 0.5 + 0.07 * k + 0.12 * n;                                    // each cable has its own lane behind the mixer
      const rowZ = Math.min(j.z, b.min.z) - lane;
      const sock = outs[k];
      const endX = sock ? sock.x : (b.min.x + b.max.x) / 2 + side * 0.15 + (k ? 0.08 : -0.08);
      const endY = sock ? sock.y : b.min.y + (b.max.y - b.min.y) * 0.28;
      const endZ = sock ? sock.z - 0.03 : b.min.z - 0.01;
      run([
        V(j.x, j.y, j.z),
        V(j.x, Math.max(tableY + 0.3, j.y * 0.5), j.z - 0.34),
        V(j.x + side * 0.15, tableY, rowZ),
        V((j.x + endX) / 2, tableY, rowZ),
        V(endX, tableY, rowZ + 0.02),
        V(endX, tableY + 0.06, b.min.z - 0.2),
        V(endX, endY, endZ)
      ], k ? white : red);
    });
  });

  // the link cable joins the LINK sockets of the two media players, so a USB drive in one is available to both
  {
    const ends = deckIds.map((id) => { let p = null; devices[id].holder.traverse((o) => { if (!p && o.isMesh && o.name === 'cr_link') p = o.getWorldPosition(V(0, 0, 0)); }); return p; });
    if (ends.length === 2 && ends[0] && ends[1]) {
      const [L, Rr] = ends[0].x < ends[1].x ? ends : [ends[1], ends[0]];
      const rz = Math.min(L.z, Rr.z) - 1.15;
      const blue = new THREE.MeshStandardMaterial({ color: 0x2a74c9, roughness: 0.5 });
      run([
        V(L.x, L.y, L.z),
        V(L.x, Math.max(tableY + 0.25, L.y * 0.5), L.z - 0.3),
        V(L.x + 0.15, tableY, rz),
        V((L.x + Rr.x) / 2, tableY, rz - 0.03),
        V(Rr.x - 0.15, tableY, rz),
        V(Rr.x, Math.max(tableY + 0.25, Rr.y * 0.5), Rr.z - 0.35),
        V(Rr.x, Rr.y, Rr.z - 0.02)
      ], blue, 0.016);
    }
  }

  // booth outputs: the two booth monitors
  ['monL', 'monR'].forEach((id, n) => {
    const dev = devices[id], j = booth[n];
    if (!dev || !j) return;
    const b = boxOf(dev), side = n === 0 ? -1 : 1;
    const rowZ = Math.min(j.z, b.max.z) - 0.9 - 0.1 * n;
    const endX = (b.min.x + b.max.x) / 2;
    const innerX = side < 0 ? b.max.x + 0.35 : b.min.x - 0.35;           // the cable passes the inner side of the speaker and goes round to its back
    run([
      V(j.x, j.y, j.z),
      V(j.x, Math.max(tableY + 0.3, j.y * 0.5), j.z - 0.34),
      V(j.x + side * 0.2, tableY, rowZ),
      V((j.x + innerX) / 2, tableY, rowZ - 0.05),
      V(innerX, tableY, Math.min(rowZ - 0.1, b.min.z - 0.1)),
      V((innerX + endX) / 2, tableY, b.min.z - 0.45),
      V(endX, tableY + 0.04, b.min.z - 0.26),
      V(endX, b.min.y + 0.12, b.min.z + 0.01)
    ], white, 0.02);
  });
  return cables;
}

// RENT RUNNER — city.js: builds Rent Harbor from scratch.
// A 400x400 grid city: harbor docks west, beach road south, neon market east,
// hills north, plaza center. Roads on a grid, buildings, palms, lamps, props.
const THREE = window.THREE;

export const CITY = { half: 200, roadGap: 40, block: 32 };

function mat(color, opts = {}) { return new THREE.MeshLambertMaterial({ color, ...opts }); }
function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
// Detail box: small architectural trim (parapets, balconies, props) that does
// NOT cast shadows — keeps the shadow pass cheap with ~100 detailed buildings.
function dbox(w, h, d, color, x, y, z, opts) {
  const m = box(w, h, d, color, x, y, z, opts);
  m.castShadow = false; return m;
}

// Canvas texture for race numbers / signs (drawn, not copied art).
// Textures are cached per (number, colors): dozens of cars share a few
// numbers, and duplicate 256px canvases cost frames under swiftshader.
const texCache = new Map();
function cached(key, make) {
  let t = texCache.get(key);
  if (!t) { t = make(); texCache.set(key, t); }
  return t;
}
export function numberTexture(num, bg = '#ff2d78', fg = '#ffffff') {
  return cached(`roundel|${num}|${bg}|${fg}`, () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = fg; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
    g.fillStyle = fg; g.font = '900 150px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(num), 128, 136);
    return new THREE.CanvasTexture(c);
  });
}
// Big rectangular rear number plate: faces straight back, so it reads
// square-on from a chase camera (the roof roundel foreshortens badly).
export function numberPlateTexture(num, bg = '#ff2d78', fg = '#ffffff') {
  return cached(`plate|${num}|${bg}|${fg}`, () => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(10, 10, 492, 236);
    g.fillStyle = fg; g.font = '900 180px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(num), 256, 136);
    return new THREE.CanvasTexture(c);
  });
}
export function signTexture(text, bg = '#0a1420', fg = '#00e5ff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 512, 96);
  g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(4, 4, 504, 88);
  g.fillStyle = fg; g.font = '900 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  return new THREE.CanvasTexture(c);
}

export function districtAt(x, z) {
  if (x < -120) return 'harbor';
  if (x < -40) return 'west';
  if (x > 120) return 'east';
  if (z > 120) return 'south';
  if (z < -120) return 'north';
  return 'center';
}
export const DISTRICT_LABEL = { west: 'DERMAGA BARAT', east: 'PASAR TIMUR', north: 'BUKIT NEON', south: 'PANTAI SENJA', center: 'ALUN-ALUN KOTA', harbor: 'PELABUHAN' };

// --- Car factory: modded sports cars, police cars, vans. Race numbers on ALL cars.
export function makeCar({ color = 0xff2d78, raceNumber = 7, police = false, van = false, spoiler = true } = {}) {
  const car = new THREE.Group();
  const bodyColor = police ? 0x11131a : color;
  const body = box(van ? 2.2 : 2.0, van ? 1.5 : 0.62, van ? 5.2 : 4.4, bodyColor, 0, 0.75, 0);
  car.add(body);
  const cabin = box(van ? 2.0 : 1.7, van ? 0.9 : 0.55, van ? 2.6 : 2.2, police ? 0x1c2233 : 0x101828, 0, van ? 1.9 : 1.3, van ? -0.4 : -0.2);
  car.add(cabin);
  // racing rims
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
  const wheelMat = mat(0x0a0a0a); const rimMat = mat(police ? 0x888888 : 0xffd23f, { emissive: 0x332200 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); car.add(w);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), rimMat);
    rim.rotation.z = Math.PI / 2; rim.position.set(wx, 0.38, wz); car.add(rim);
  }
  if (spoiler && !van) {
    const wing = box(1.9, 0.08, 0.5, 0x111111, 0, 1.25, -2.15); car.add(wing);
    car.add(box(0.08, 0.35, 0.08, 0x111111, -0.8, 1.05, -2.15));
    car.add(box(0.08, 0.35, 0.08, 0x111111, 0.8, 1.05, -2.15));
    // body kit: front splitter + side skirts
    car.add(box(2.05, 0.16, 0.5, 0x111111, 0, 0.32, 2.25));
    car.add(box(0.12, 0.14, 3.4, 0x111111, -1.02, 0.3, 0));
    car.add(box(0.12, 0.14, 3.4, 0x111111, 1.02, 0.3, 0));
  }
  // headlights + taillights
  const hl = mat(0xfff2b0, { emissive: 0xaa9900 });
  for (const sx of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.06), hl); h.position.set(sx, 0.8, 2.22); car.add(h); }
  const tl = mat(0xff2030, { emissive: 0x880000 });
  for (const sx of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), tl); h.position.set(sx, 0.8, -2.22); car.add(h); }
  // race number roundels on doors + roof (readable from chase cam)
  const tex = numberTexture(raceNumber, police ? '#0a4fd6' : '#ff2d78');
  const roundel = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  roundel.position.set(-1.02, 0.95, 0); roundel.rotation.y = -Math.PI / 2; car.add(roundel);
  const r2 = roundel.clone(); r2.position.x = 1.02; r2.rotation.y = Math.PI / 2; car.add(r2);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  roof.rotation.x = -Math.PI / 2; roof.position.set(0, van ? 2.37 : 1.6, -0.2); car.add(roof);
  // big rear number plate on the cabin's rear face — square-on to the
  // normal driving camera behind the car
  const plateTex = numberPlateTexture(raceNumber, police ? '#0a4fd6' : '#ff2d78');
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: plateTex }));
  plate.position.set(0, van ? 1.9 : 1.3, van ? -1.72 : -1.32);
  plate.rotation.y = Math.PI; car.add(plate);
  // same plate on the cabin's FRONT face (windshield banner): the chase
  // camera sits ahead of the car looking back, so this is the number the
  // chase shot actually sees square-on
  const frontPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: plateTex }));
  frontPlate.position.set(0, van ? 1.9 : 1.3, 0.92);
  car.add(frontPlate);
  if (police) {
    const bar = box(1.1, 0.16, 0.35, 0x222222, 0, van ? 2.42 : 1.66, -0.2); car.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
    red.position.set(-0.3, 1.78, -0.2); car.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    blue.position.set(0.3, 1.78, -0.2); car.add(blue);
    car.userData.lightRed = red; car.userData.lightBlue = blue;
    const stripe = box(2.02, 0.2, 4.42, 0xffffff, 0, 0.72, 0); car.add(stripe);
  }
  car.userData.isCar = true; car.userData.police = police;
  return car;
}

// --- Dimas on foot: teal jacket, pink cap, gold-chain, AK-47 clearly visible.
export function makePlayer() {
  const p = new THREE.Group();
  const skin = mat(0xc98d5f);
  const jacket = mat(0x0e7f7a); // teal courier jacket
  const pants = mat(0x1d2433);
  const torso = box(0.62, 0.75, 0.36, 0x0e7f7a, 0, 1.15, 0); p.add(torso);
  // gold tribal tattoo band across the back (black band + gold diamonds)
  const band = box(0.64, 0.16, 0.02, 0x111111, 0, 1.28, -0.19); p.add(band);
  for (const dx of [-0.18, 0, 0.18]) {
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mat(0xffd23f, { emissive: 0x664400 }));
    dia.position.set(dx, 1.28, -0.21); p.add(dia);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skin); head.position.set(0, 1.72, 0); p.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 16), mat(0xff5da2));
  cap.position.set(0, 1.9, 0); p.add(cap);
  const brim = box(0.3, 0.04, 0.22, 0xff5da2, 0, 1.86, 0.26); p.add(brim);
  // arms + legs
  const armL = box(0.18, 0.7, 0.18, 0x0e7f7a, -0.42, 1.15, 0); p.add(armL);
  const armR = box(0.18, 0.7, 0.18, 0x0e7f7a, 0.42, 1.15, 0); p.add(armR);
  p.add(box(0.22, 0.75, 0.22, 0x1d2433, -0.16, 0.38, 0));
  p.add(box(0.22, 0.75, 0.22, 0x1d2433, 0.16, 0.38, 0));
  // AK-47: big, dark, held across the chest — must read clearly on camera
  const gun = new THREE.Group();
  const gBody = box(0.09, 0.14, 0.95, 0x1a1a1a, 0, 0, 0); gun.add(gBody);
  gun.add(box(0.07, 0.1, 0.5, 0x6b4423, 0, -0.1, 0.28)); // wooden stock
  gun.add(box(0.06, 0.22, 0.08, 0x1a1a1a, 0, -0.16, 0.05)); // grip
  gun.add(box(0.05, 0.12, 0.3, 0x1a1a1a, 0, -0.12, -0.28)); // magazine (curved look)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), mat(0x222222));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.65); gun.add(barrel);
  gun.position.set(0.32, 1.3, 0.12); gun.rotation.y = -1.15; gun.scale.setScalar(1.25);
  p.add(gun); p.userData.gun = gun; p.userData.armR = armR;
  // muzzle flash anchor at barrel tip
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, -0.9); gun.add(muzzle);
  p.userData.muzzle = muzzle;
  p.userData.isPlayer = true;
  return p;
}

export function makePedestrian(color) {
  const g = new THREE.Group();
  g.add(box(0.55, 0.7, 0.32, color, 0, 1.1, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(0xd9a06b)); head.position.set(0, 1.65, 0); g.add(head);
  g.add(box(0.2, 0.7, 0.2, 0x222831, -0.14, 0.35, 0));
  g.add(box(0.2, 0.7, 0.2, 0x222831, 0.14, 0.35, 0));
  return g;
}

export function makeHelicopter() {
  const h = new THREE.Group();
  const body = box(2.2, 1.6, 4.6, 0x10141f, 0, 0, 0); h.add(body);
  const glass = box(1.9, 0.9, 1.2, 0x66ccff, 0, 0.25, 1.8, { emissive: 0x113344 }); h.add(glass);
  const tail = box(0.5, 0.5, 4.5, 0x10141f, 0, 0.3, -4.2); h.add(tail);
  const fin = box(0.15, 1.2, 0.8, 0xff2030, 0, 0.8, -6.2); h.add(fin);
  // big rotor + tail rotor
  const rotor = new THREE.Group();
  const blade = box(9.5, 0.06, 0.5, 0x222222, 0, 0, 0); rotor.add(blade);
  const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
  rotor.position.set(0, 1.0, 0); h.add(rotor); h.userData.rotor = rotor;
  const tailRotor = new THREE.Group();
  tailRotor.add(box(0.06, 2.2, 0.2, 0x333333, 0, 0, 0));
  tailRotor.position.set(0.35, 0.4, -6.2); h.add(tailRotor); h.userData.tailRotor = tailRotor;
  // searchlight cone (visible beam)
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 14, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  beam.rotation.x = Math.PI; beam.position.set(0, -7.5, 0); h.add(beam);
  // POLICE marking on the side
  const tex = signTexture('MODERATOR', '#10141f', '#ffffff');
  const side = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.64), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  side.position.set(-1.12, 0.1, 0); side.rotation.y = -Math.PI / 2; h.add(side);
  const side2 = side.clone(); side2.position.x = 1.12; side2.rotation.y = Math.PI / 2; h.add(side2);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
  lamp.position.set(0, -0.9, 1.5); h.add(lamp); h.userData.lamp = lamp;
  return h;
}

export function buildCity(scene) {
  const group = new THREE.Group();
  const colliders = []; // {x,z,r} circles + {minX,maxX,minZ,maxZ} boxes for buildings
  // sunset sky + fog
  scene.background = new THREE.Color(0x2b1055);
  scene.fog = new THREE.Fog(0x3a1a5e, 120, 420);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x1a1030, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a4d, 1.4); sun.position.set(-120, 90, 60);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220; sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  scene.add(sun);
  const neon = new THREE.PointLight(0xff2d78, 1.2, 90); neon.position.set(0, 18, 0); scene.add(neon);

  // ground: grass/concrete base, beach sand strip south, sea beyond
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), mat(0x2e4a2f));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(460, 46), mat(0xe8c98a));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 178); group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(460, 90), mat(0x0e5a7a, { emissive: 0x06283a }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.01, 245); group.add(sea);

  // roads: grid every 40 units + beach road + harbor road
  const roadMat = mat(0x23242c);
  const roads = [];
  for (let i = -4; i <= 4; i++) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(10, 400), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(i * 40, 0.05, 0); group.add(v); roads.push(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(400, 10), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.05, i * 40); group.add(h);
  }
  // road center dashes
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  for (let i = -4; i <= 4; i++) {
    for (let d = -180; d < 180; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(i * 40, 0.07, d); group.add(dash);
    }
  }
  // sidewalks around plaza
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(16, 24), mat(0x8a7a5a));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.06, 0); group.add(plaza);

  // --- 3D buildings: stepped towers with real depth ---
  // Each block gets a real building, not a flat box: a ground-floor podium
  // (shopfront or stone base), a main tower, a stepped-back upper tier,
  // parapet + roof props (water tank, AC unit, antenna), recessed windows
  // with real frames (instanced extruded frames + inset glass), balconies,
  // awnings and neon signs. Footprint + collider are identical to v1.1, so
  // streets, missions, minimap and gameplay are untouched.
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const palette = [0x5a4a8a, 0x8a4a6a, 0x3a6a8a, 0x7a5a3a, 0x4a7a5a, 0x8a3a4a, 0x39406a, 0x6a5a8a];
  const podiumTones = [0x3a3230, 0x2e2a33, 0x40342a, 0x33302e];
  const neonColors = [0xff2d78, 0x00e5ff, 0xffd23f, 0x7dff9a, 0xff7e47];
  const SHOPS = ['KEDAI KOPI', 'WARUNG 24J', 'BENGKEL', 'TOKO HP', 'LAUNDRY', 'BAKSO', 'NEON BAR', 'APOTEK', 'MART 24', 'FOTOKOPI'];
  const TOWER_SIGNS = ['HOTEL', 'KOSAN', 'NEON', 'BAR', 'INN'];
  // Window frame: extruded rectangle with a real hole — the glass plane sits
  // ~0.2 behind the frame front, so windows read as recessed, not stickers.
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-0.8, -0.95); frameShape.lineTo(0.8, -0.95); frameShape.lineTo(0.8, 0.95); frameShape.lineTo(-0.8, 0.95); frameShape.closePath();
  const frameHole = new THREE.Path();
  frameHole.moveTo(-0.58, -0.72); frameHole.lineTo(0.58, -0.72); frameHole.lineTo(0.58, 0.72); frameHole.lineTo(-0.58, 0.72); frameHole.closePath();
  frameShape.holes.push(frameHole);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.24, bevelEnabled: false });
  const winFrames = [], winGlass = [], winColors = [];
  const dummy = new THREE.Object3D();
  // (px,pz) = point on the wall, (nx,nz) = outward normal, rotY faces outward
  function addWindow(px, py, pz, nx, nz, rotY) {
    dummy.position.set(px + nx * 0.02, py, pz + nz * 0.02);
    dummy.rotation.set(0, rotY, 0); dummy.updateMatrix();
    winFrames.push(dummy.matrix.clone());
    dummy.position.set(px + nx * 0.04, py, pz + nz * 0.04);
    dummy.updateMatrix();
    winGlass.push(dummy.matrix.clone());
    const r = rnd();
    winColors.push(new THREE.Color(r < 0.34 ? 0xffe9a8 : r < 0.58 ? 0x9fd8ff : 0x1a2436));
  }
  // Window grid on one face of a box centered (cx,cz), size (fw x fd),
  // from y0 to y1. face: 0=+z, 1=-z, 2=+x, 3=-x. skip = fraction omitted.
  function windowFace(cx, cz, fw, fd, y0, y1, face, skip) {
    const faceW = face === 0 || face === 1 ? fw : fd;
    const cols = Math.max(1, Math.floor((faceW - 3) / 3.4));
    const x0 = -((cols - 1) * 3.4) / 2;
    for (let y = y0; y <= y1; y += 3.4) {
      for (let c = 0; c < cols; c++) {
        if (rnd() < skip) continue;
        const off = x0 + c * 3.4;
        if (face === 0) addWindow(cx + off, y, cz + fd / 2, 0, 1, 0);
        else if (face === 1) addWindow(cx + off, y, cz - fd / 2, 0, -1, Math.PI);
        else if (face === 2) addWindow(cx + fw / 2, y, cz + off, 1, 0, Math.PI / 2);
        else addWindow(cx - fw / 2, y, cz + off, -1, 0, -Math.PI / 2);
      }
    }
  }
  // buildings sit in block interiors BETWEEN roads (roads run on multiples of
  // 40, so block centers are at 20 + 40k) — never on a road or intersection.
  for (let bx = -5; bx <= 4; bx++) {
    for (let bz = -5; bz <= 4; bz++) {
      const cx = bx * 40 + 20 + (rnd() - 0.5) * 6;
      const cz = bz * 40 + 20 + (rnd() - 0.5) * 6;
      if (Math.abs(cx) < 28 && Math.abs(cz) < 28) continue; // keep the plaza open
      if (Math.abs(cx + 60) < 14 && Math.abs(cz + 60) < 14) continue; // safehouse block
      if (Math.abs(cx - 140) < 14 && Math.abs(cz - 40) < 14) continue; // corner shop block
      const w = 12 + rnd() * 10, d = 12 + rnd() * 10, h = 8 + rnd() * 26;
      const color = palette[Math.floor(rnd() * palette.length)];
      const glassTower = rnd() > 0.86;
      const podiumH = 3.4;
      // ground-floor podium (slightly proud of the tower above it)
      group.add(box(w, podiumH, d, podiumTones[Math.floor(rnd() * podiumTones.length)], cx, podiumH / 2, cz));
      // main tower, stepped in from the podium edge
      const tw = w - 1.5, td = d - 1.5, th = h - podiumH;
      group.add(box(tw, th, td, glassTower ? 0x2a4a6a : color, cx, podiumH + th / 2, cz, glassTower ? { emissive: 0x0a1a2a } : {}));
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      // stepped-back upper tier on the tower roof
      const hasTier = rnd() > 0.35;
      const tierH = hasTier ? 3 + rnd() * 5 : 0;
      const tierW = Math.max(6, tw - 4.5), tierD = Math.max(6, td - 4.5);
      let roofY = h, roofW = tw, roofD = td;
      if (hasTier) {
        const tierColor = new THREE.Color(color).offsetHSL(0, 0.02, 0.07).getHex();
        group.add(box(tierW, tierH, tierD, glassTower ? 0x2a4a6a : tierColor, cx, h + tierH / 2, cz, glassTower ? { emissive: 0x0a1a2a } : {}));
        for (let f = 0; f < 4; f++) windowFace(cx, cz, tierW, tierD, h + 1.9, h + tierH - 1.2, f, 0.6);
        roofY = h + tierH; roofW = tierW; roofD = tierD;
      }
      // parapet rim around the tower roof
      const trim = new THREE.Color(color).offsetHSL(0, 0, -0.06).getHex();
      const pt = 0.35, ph = 0.7;
      group.add(dbox(tw, ph, pt, trim, cx, h + ph / 2, cz + td / 2 - pt / 2));
      group.add(dbox(tw, ph, pt, trim, cx, h + ph / 2, cz - td / 2 + pt / 2));
      group.add(dbox(pt, ph, td, trim, cx + tw / 2 - pt / 2, h + ph / 2, cz));
      group.add(dbox(pt, ph, td, trim, cx - tw / 2 + pt / 2, h + ph / 2, cz));
      // roof props: water tank, AC unit, antenna on the top roof
      const nProps = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < nProps; i++) {
        const px = cx + (rnd() - 0.5) * (roofW - 4);
        const pz = cz + (rnd() - 0.5) * (roofD - 4);
        const kind = rnd();
        if (kind < 0.4) {
          // water tank: cylinder + cone cap on legs
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.0, 10), mat(0x8a7a5a));
          tank.position.set(px, roofY + 1.0, pz); group.add(tank);
          const cap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.8, 10), mat(0x6a5a3a));
          cap.position.set(px, roofY + 2.4, pz); group.add(cap);
          for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
            group.add(dbox(0.14, 0.8, 0.14, 0x333333, px + lx, roofY + 0.4, pz + lz));
          }
        } else if (kind < 0.75) {
          // AC unit + fan
          group.add(dbox(1.8, 0.9, 1.2, 0x9aa0a8, px, roofY + 0.45, pz));
          const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 12), mat(0x222831));
          fan.position.set(px, roofY + 0.95, pz); group.add(fan);
        } else {
          // antenna mast + red tip + crossbar
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 4.5, 6), mat(0x555555));
          mast.position.set(px, roofY + 2.25, pz); group.add(mast);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
          tip.position.set(px, roofY + 4.6, pz); group.add(tip);
          group.add(dbox(1.6, 0.08, 0.08, 0x555555, px, roofY + 3.6, pz));
        }
      }
      // recessed windows on all four tower faces
      for (let f = 0; f < 4; f++) windowFace(cx, cz, tw, td, podiumH + 1.9, h - 1.4, f, 0.45);
      // balconies on the front face, above the shopfront
      if (rnd() > 0.55) {
        const nBal = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < nBal; i++) {
          const rows = Math.max(1, Math.floor((h - podiumH - 5) / 3.4));
          const by = podiumH + 3.4 + Math.floor(rnd() * rows) * 3.4;
          const bxOff = (rnd() - 0.5) * (tw - 5);
          group.add(dbox(2.6, 0.18, 1.1, 0x6a6258, cx + bxOff, by, cz + td / 2 + 0.55));
          group.add(dbox(2.6, 0.9, 0.08, 0x222831, cx + bxOff, by + 0.55, cz + td / 2 + 1.06));
          group.add(dbox(0.08, 0.9, 1.0, 0x222831, cx + bxOff - 1.26, by + 0.55, cz + td / 2 + 0.58));
          group.add(dbox(0.08, 0.9, 1.0, 0x222831, cx + bxOff + 1.26, by + 0.55, cz + td / 2 + 0.58));
        }
      }
      // ground-floor shopfront: lit glass + mullions + awning + text sign
      if (rnd() > 0.5) {
        const sw = w * 0.72;
        group.add(dbox(sw, 2.3, 0.22, 0xffd9a0, cx, 1.55, cz + d / 2 + 0.08, { emissive: 0x664411 }));
        for (let m = -1; m <= 1; m++) group.add(dbox(0.12, 2.3, 0.3, 0x222831, cx + (m * sw) / 3, 1.55, cz + d / 2 + 0.1));
        const awn = dbox(sw + 0.6, 0.1, 1.4, neonColors[Math.floor(rnd() * neonColors.length)], cx, 3.15, cz + d / 2 + 0.7);
        awn.rotation.x = 0.35; group.add(awn);
        const shopName = SHOPS[Math.floor(rnd() * SHOPS.length)];
        const st = new THREE.Mesh(new THREE.PlaneGeometry(sw * 0.9, 0.85),
          new THREE.MeshBasicMaterial({ map: signTexture(shopName, '#0a1420', '#ffd23f'), transparent: true }));
        st.position.set(cx, podiumH + 0.55, cz + d / 2 + 0.12); group.add(st);
      }
      // neon sign: vertical bar on the side (as v1.1) + text sign on tall towers
      if (rnd() > 0.6) {
        const nc = neonColors[Math.floor(rnd() * neonColors.length)];
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 6), new THREE.MeshBasicMaterial({ color: nc }));
        sign.position.set(cx + w / 2 + 0.3, Math.min(h - 2, 12), cz); group.add(sign);
      }
      if (h > 20 && rnd() > 0.5) {
        const nc = neonColors[Math.floor(rnd() * neonColors.length)];
        const txt = TOWER_SIGNS[Math.floor(rnd() * TOWER_SIGNS.length)];
        const fg = '#' + nc.toString(16).padStart(6, '0');
        const ts = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3),
          new THREE.MeshBasicMaterial({ map: signTexture(txt, '#0a1420', fg), transparent: true }));
        ts.position.set(cx, h - 2.2, cz + td / 2 + 0.15); group.add(ts);
      }
    }
  }
  // one instanced draw for ALL window frames, one for ALL glass panes
  const frames = new THREE.InstancedMesh(frameGeo, mat(0x1c2233), winFrames.length);
  winFrames.forEach((m, i) => frames.setMatrixAt(i, m));
  frames.instanceMatrix.needsUpdate = true;
  group.add(frames);
  const glassGeo = new THREE.PlaneGeometry(1.16, 1.44);
  const glassMesh = new THREE.InstancedMesh(glassGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), winGlass.length);
  winGlass.forEach((m, i) => { glassMesh.setMatrixAt(i, m); glassMesh.setColorAt(i, winColors[i]); });
  glassMesh.instanceMatrix.needsUpdate = true;
  if (glassMesh.instanceColor) glassMesh.instanceColor.needsUpdate = true;
  group.add(glassMesh);
  // harbor: docks + containers + cranes (west edge)
  for (let i = 0; i < 6; i++) {
    const cont = box(10, 3, 3, [0xd64545, 0x2d7ad6, 0x45d67a, 0xd6a02d][i % 4], -185, 1.5, -120 + i * 34);
    group.add(cont); colliders.push({ minX: -190, maxX: -180, minZ: -121.5 + i * 34, maxZ: -118.5 + i * 34 });
  }
  for (const cz of [-90, 0, 90]) {
    const crane = new THREE.Group();
    crane.add(box(3, 42, 3, 0xd6a02d, 0, 21, 0));
    crane.add(box(26, 2.5, 2.5, 0xd6a02d, 8, 40, 0));
    crane.add(box(1, 9, 1, 0x333333, 18, 35, 0));
    crane.position.set(-175, 0, cz); group.add(crane);
  }
  // safehouse (player home) at (-60, -60): small house with pink roof
  const sh = new THREE.Group();
  sh.add(box(10, 5, 8, 0xe8dcc8, 0, 2.5, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3.5, 4), mat(0xff5da2));
  roof.position.set(0, 6.5, 0); roof.rotation.y = Math.PI / 4; sh.add(roof);
  const door = box(2, 3, 0.3, 0x3a2a1a, 0, 1.5, 4.1); sh.add(door);
  const sgn = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.4), new THREE.MeshBasicMaterial({ map: signTexture('SAFEHOUSE — DIMAS', '#10141f', '#ffd23f'), transparent: true }));
  sgn.position.set(0, 5.6, 4.15); sh.add(sgn);
  sh.position.set(-60, 0, -60); group.add(sh);
  colliders.push({ minX: -65, maxX: -55, minZ: -64, maxZ: -56 });

  // corner shop (mission drop) at (140, 40)
  const shop = new THREE.Group();
  shop.add(box(12, 6, 9, 0x2d7ad6, 0, 3, 0));
  const shopSign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.8), new THREE.MeshBasicMaterial({ map: signTexture('KEDAI SUDUT — CORNER SHOP', '#0a1420', '#7dff9a'), transparent: true }));
  shopSign.position.set(0, 6.8, 4.6); shop.add(shopSign);
  shop.position.set(140, 0, 40); group.add(shop);
  colliders.push({ minX: 134, maxX: 146, minZ: 35.5, maxZ: 44.5 });

  // palms along beach road + plaza
  const palmPositions = [];
  for (let x = -180; x <= 180; x += 18) palmPositions.push([x, 158]);
  for (let a = 0; a < 8; a++) palmPositions.push([Math.cos(a * 0.785) * 13, Math.sin(a * 0.785) * 13]);
  for (const [px, pz] of palmPositions) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 8), mat(0x6b4423));
    trunk.position.y = 3.5; trunk.rotation.z = (rnd() - 0.5) * 0.2; palm.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.5, 6), mat(0x2d8a4a));
      frond.position.set(Math.cos(f * 1.05) * 1.6, 7.2, Math.sin(f * 1.05) * 1.6);
      frond.rotation.z = Math.cos(f * 1.05) * 1.1; frond.rotation.x = -Math.sin(f * 1.05) * 1.1;
      palm.add(frond);
    }
    palm.position.set(px, 0, pz); group.add(palm);
  }
  // street lamps
  for (let i = -4; i <= 4; i++) {
    for (const z of [-160, -80, 0, 80, 160]) {
      const lamp = new THREE.Group();
      lamp.add(box(0.25, 6, 0.25, 0x222831, 0, 3, 0));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      bulb.position.set(0, 6.1, 0); lamp.add(bulb);
      lamp.position.set(i * 40 + 6, 0, z); group.add(lamp);
    }
  }
  scene.add(group);
  return { group, colliders };
}

// Simple collision resolve: push a circle out of building boxes.
export function collide(pos, radius, colliders) {
  for (const c of colliders) {
    if (c.minX === undefined) continue;
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius; pos.z = nz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
    }
  }
  pos.x = Math.max(-198, Math.min(198, pos.x));
  pos.z = Math.max(-198, Math.min(198, pos.z));
}

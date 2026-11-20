// RENT RUNNER v1 — main.js (part 1): boot, renderer, world, player, driving.
// Dimas, courier-agent of Rent Harbor, earns his rent one bounty at a time.
const THREE = window.THREE;
import { buildCity, makeCar, makePlayer, makePedestrian, collide, districtAt, CITY } from './city.js';
import { Traffic } from './traffic.js';
import { MissionManager, MISSION_SPOTS } from './missions.js';
import { Heli } from './heli.js';
import { ShotSystem } from './shots.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { T } from './i18n.js';

const canvas = document.getElementById('game-canvas');
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const AUTO = params.get('auto') === '1';

export const Game = {
  scene: null, camera: null, renderer: null, clock: null,
  player: null, playerVel: new THREE.Vector3(), heading: 0, pitch: 0,
  onFoot: true, car: null, carSpeed: 0, carHeading: 0,
  keys: {}, started: false, paused: false, dead: false,
  cash: 150, rent: 450, rentSeconds: 360, day: 1, clockMinutes: 17 * 60,
  health: 100, armor: false, ammoMag: 30, ammoReserve: 120,
  wanted: 0, wantedTimer: 0, heat: 0, lastCrimeAt: 0,
  policeCars: [], policePeds: [], roadblocks: [],
  traffic: null, missions: null, heli: null, shots: null, ui: null, audio: null,
  stats: { jobsDone: 0, shotsFired: 0, carsStolen: 0, racesWon: 0 },
  saveSlot: 1, camMode: 0, raceRivals: [], ambushAt: 0,
  errors: [],
};

window.addEventListener('error', (e) => { Game.errors.push(String(e.message || e.error)); });

function initRenderer() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  Game.renderer = renderer;
  Game.scene = new THREE.Scene();
  Game.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
  Game.clock = new THREE.Clock();
  addEventListener('resize', () => {
    Game.camera.aspect = innerWidth / innerHeight;
    Game.camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function initWorld() {
  const { colliders } = buildCity(Game.scene);
  Game.colliders = colliders;
  Game.traffic = new Traffic(Game.scene, colliders);
  Game.shots = new ShotSystem(Game.scene);
  Game.heli = new Heli(Game.scene);
  Game.missions = new MissionManager(Game);
  Game.ui = new UI(Game);
  Game.audio = new AudioEngine();

  // Dimas spawns at the safehouse
  Game.player = makePlayer();
  Game.player.position.set(-60, 0, -48);
  Game.scene.add(Game.player);

  // the player's starter car: modded teal sports car #7, parked by the safehouse
  Game.playerCar = makeCar({ color: 0x0e7f7a, raceNumber: 7, spoiler: true });
  Game.playerCar.position.set(-52, 0, -48);
  Game.playerCar.rotation.y = Math.PI / 2;
  Game.playerCar.userData.owned = true;
  Game.scene.add(Game.playerCar);

  // race rivals parked at the harbor start line
  for (let i = 0; i < 5; i++) {
    const rival = makeCar({ color: [0xff2d78, 0xffd23f, 0x00e5ff, 0x7dff9a, 0xff7e47][i], raceNumber: 11 + i * 9, spoiler: true });
    rival.position.set(-168 + i * 3.4, 0, 108 + (i % 2) * 4);
    rival.rotation.y = Math.PI;
    rival.visible = false;
    rival.userData.rival = true;
    Game.scene.add(rival);
    Game.raceRivals.push(rival);
  }
  // courier van for the heist mission
  Game.van = makeCar({ color: 0xd6a02d, raceNumber: 55, van: true, spoiler: false });
  Game.van.position.set(-178, 0, 40);
  Game.van.rotation.y = Math.PI / 2;
  Game.scene.add(Game.van);
}

// ---------- input ----------
function bindInput() {
  const down = (e) => {
    if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
    Game.keys[e.code] = true;
    if (!Game.started) return;
    if (e.code === 'KeyE') tryEnterCar();
    if (e.code === 'KeyR') reload();
    if (e.code === 'KeyM') cycleRadio();
    if (e.code === 'KeyC') Game.camMode = (Game.camMode + 1) % 3;
    if (e.code === 'KeyH') document.getElementById('hud').classList.toggle('hidden');
    if (e.code === 'Tab') toggleJobBoard();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyF') fireWeapon();
  };
  const up = (e) => { Game.keys[e.code] = false; };
  addEventListener('keydown', down);
  addEventListener('keyup', up);
  addEventListener('mousedown', (e) => { if (Game.started && !Game.paused && e.button === 0) fireWeapon(); });
  addEventListener('mousemove', (e) => {
    if (!Game.started || Game.paused) return;
    Game.heading -= e.movementX * 0.0032;
    Game.pitch = Math.max(-0.6, Math.min(0.5, Game.pitch - e.movementY * 0.002));
  });
  canvas.addEventListener('click', () => { if (Game.started) lockPointer(); });
  $('btn-new').addEventListener('click', () => startGame(true));
  $('btn-continue').addEventListener('click', () => startGame(false));
  $('btn-how').addEventListener('click', () => $('howto').classList.toggle('hidden'));
  $('job-close').addEventListener('click', toggleJobBoard);
  $('shop-close').addEventListener('click', () => { Game.ui.closeShop(); Game.paused = false; });
  $('pause-resume').addEventListener('click', togglePause);
  $('pause-save').addEventListener('click', () => { saveGame(Game.saveSlot); Game.ui.toast('GAME SAVED — SLOT ' + Game.saveSlot); });
  $('pause-quit').addEventListener('click', () => { Game.paused = false; $('pause').classList.add('hidden'); Game.ui.showMenu(); Game.started = false; });
  $('go-respawn').addEventListener('click', respawn);
  $('dlg-next').addEventListener('click', () => {});
}
const $ = (id) => document.getElementById(id);
function lockPointer() {
  if (!canvas.requestPointerLock) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

// ---------- game flow ----------
function startGame(fresh) {
  Game.audio.ensure();
  Game.audio.startRadio(0);
  Game.saveSlot = Game.ui.selectedSlot;
  if (fresh) {
    Game.cash = 150; Game.rent = 450; Game.rentSeconds = 360; Game.day = 1;
    Game.health = 100; Game.ammoMag = 30; Game.ammoReserve = 120;
    Game.wanted = 0; Game.stats = { jobsDone: 0, shotsFired: 0, carsStolen: 0, racesWon: 0 };
    Game.missions.reset();
    Game.player.position.set(-60, 0, -48);
    Game.heading = 0; Game.onFoot = true; Game.car = null;
  } else {
    const save = loadSlot(Game.saveSlot);
    if (save) applySave(save);
  }
  Game.started = true; Game.paused = false; Game.dead = false;
  Game.ui.hideMenu();
  Game.ui.setCash(Game.cash); Game.ui.setRent(Game.rent, Game.rentSeconds);
  Game.ui.setHealth(Game.health); Game.ui.setAmmo(Game.ammoMag, Game.ammoReserve);
  Game.ui.setWanted(Game.wanted); Game.ui.setRadio(T.radioStations[0].name, T.radioStations[0].tracks[0]);
  Game.ui.setMission(Game.missions.current(), 0);
  if (fresh) Game.ui.showDialogue(T.dialogue.intro, () => {});
  lockPointer();
}

function respawn() {
  $('gameover').classList.add('hidden');
  Game.cash = Math.max(0, Game.cash - 100);
  Game.health = 100; Game.wanted = 0; Game.dead = false;
  Game.player.position.set(-60, 0, -48);
  Game.heading = 0; Game.onFoot = true; Game.car = null;
  Game.player.visible = true;
  clearPolice();
  Game.ui.setCash(Game.cash); Game.ui.setHealth(100); Game.ui.setWanted(0);
  Game.ui.toast('BACK ON YOUR FEET — RENT STILL DUE');
}

function payRent() {
  if (Game.cash < Game.rent) { Game.ui.toast('NOT ENOUGH CASH — RENT IS $' + Game.rent); return false; }
  Game.cash -= Game.rent;
  Game.rentSeconds = 360; Game.day++;
  Game.rent = 450 + (Game.day - 1) * 75;
  Game.ui.setCash(Game.cash); Game.ui.setRent(Game.rent, Game.rentSeconds);
  Game.ui.showDialogue(T.dialogue.rentPaid, () => {});
  Game.audio.cash();
  return true;
}

// ---------- save / load (localStorage slots) ----------
export function saveGame(slot) {
  const data = {
    day: Game.day, cash: Game.cash, rent: Game.rent, rentSeconds: Game.rentSeconds,
    health: Game.health, ammoMag: Game.ammoMag, ammoReserve: Game.ammoReserve,
    jobIndex: Game.missions.index, jobsDone: Game.stats.jobsDone,
    wanted: Game.wanted, x: Game.player.position.x, z: Game.player.position.z,
    savedAt: Date.now(),
  };
  try { localStorage.setItem('rent-runner-slot-' + slot, JSON.stringify(data)); } catch (e) {}
  return data;
}
export function loadSlot(slot) {
  try { const raw = localStorage.getItem('rent-runner-slot-' + slot); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function applySave(s) {
  Game.day = s.day; Game.cash = s.cash; Game.rent = s.rent; Game.rentSeconds = s.rentSeconds;
  Game.health = s.health; Game.ammoMag = s.ammoMag; Game.ammoReserve = s.ammoReserve;
  Game.missions.index = s.jobIndex; Game.stats.jobsDone = s.jobsDone || 0;
  Game.wanted = s.wanted || 0;
  Game.player.position.set(s.x || -60, 0, s.z || -48);
  Game.ui.setCash(Game.cash); Game.ui.setHealth(Game.health);
}

// ---------- wanted / police ----------
function setWanted(level, reason) {
  Game.wanted = Math.max(0, Math.min(5, level));
  Game.wantedTimer = 0;
  Game.ui.setWanted(Game.wanted);
  if (reason) Game.ui.toast(reason);
  if (Game.wanted > 0) Game.audio.siren();
  spawnPoliceCars();
  if (Game.wanted >= 3) spawnRoadblocks();
  if (Game.wanted >= 4) Game.heli.place({ x: Game.player.position.x, z: Game.player.position.z, heading: Game.heading }, 14, -6);
  else Game.heli.hide();
}
function spawnPoliceCars() {
  clearPolice();
  const n = Math.min(4, Game.wanted);
  for (let i = 0; i < n; i++) {
    const pc = makeCar({ color: 0x11131a, raceNumber: 5 + i, police: true, spoiler: false });
    const a = (i / n) * Math.PI * 2;
    pc.position.set(Game.player.position.x + Math.cos(a) * 26, 0, Game.player.position.z + Math.sin(a) * 26);
    pc.userData.policeCar = true; pc.userData.speed = 0;
    Game.scene.add(pc); Game.policeCars.push(pc);
  }
  // foot officers at wanted 2+
  for (let i = 0; i < Math.max(0, Game.wanted - 1); i++) {
    const off = makePedestrian(0x10141f);
    off.position.set(Game.player.position.x + (Math.random() - 0.5) * 30, 0, Game.player.position.z + (Math.random() - 0.5) * 30);
    off.userData.officer = true; off.userData.hitRadius = 1.2; off.userData.hp = 3;
    Game.scene.add(off); Game.policePeds.push(off);
  }
}
function spawnRoadblocks() {
  for (const rb of Game.roadblocks) Game.scene.remove(rb);
  Game.roadblocks = [];
  if (Game.wanted < 3) return;
  for (let i = 0; i < 2; i++) {
    const block = new THREE.Group();
    for (let j = -1; j <= 1; j++) {
      const c = makeCar({ color: 0x11131a, raceNumber: 9, police: true, spoiler: false });
      c.position.set(j * 3.2, 0, 0); block.add(c);
    }
    const a = Math.random() * Math.PI * 2;
    block.position.set(Game.player.position.x + Math.cos(a) * 45, 0, Game.player.position.z + Math.sin(a) * 45);
    block.rotation.y = a;
    Game.scene.add(block); Game.roadblocks.push(block);
  }
}
function clearPolice() {
  for (const pc of Game.policeCars) Game.scene.remove(pc);
  for (const p of Game.policePeds) Game.scene.remove(p);
  for (const rb of Game.roadblocks) Game.scene.remove(rb);
  Game.policeCars = []; Game.policePeds = []; Game.roadblocks = [];
  Game.heli.hide();
}
function crime(level) {
  if (level > Game.wanted) setWanted(level);
  Game.lastCrimeAt = performance.now();
}

// ---------- driving / on-foot movement ----------
function nearestCar(maxDist) {
  let best = null; let bestD = maxDist;
  const cars = [...Game.traffic.cars, Game.playerCar, Game.van, ...Game.raceRivals.filter((r) => r.visible)];
  for (const c of cars) {
    const d = c.position.distanceTo(Game.player.position);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
function tryEnterCar() {
  if (!Game.onFoot) { exitCar(); return; }
  const car = nearestCar(4.5);
  if (!car) return;
  Game.onFoot = false; Game.car = car;
  Game.player.visible = false;
  Game.carHeading = car.rotation.y;
  Game.carSpeed = 0;
  Game.audio.engineStart(); Game.audio.startEngineLoop();
  if (!car.userData.owned && !car.userData.ambient) {
    Game.stats.carsStolen++; crime(2);
    Game.ui.toast('CARJACKED — the Moderators noticed!');
  } else if (car.userData.ambient) {
    Game.stats.carsStolen++; crime(1);
    Game.ui.toast('CAR TAKEN — keep it quiet');
  } else {
    Game.ui.toast('IN YOUR CAR — drive!');
  }
}
function exitCar() {
  if (!Game.car) return;
  Game.onFoot = true;
  Game.player.visible = true;
  const p = Game.car.position;
  Game.player.position.set(p.x + Math.sin(Game.carHeading + Math.PI / 2) * 2.5, 0, p.z + Math.cos(Game.carHeading + Math.PI / 2) * 2.5);
  Game.heading = Game.carHeading;
  Game.car = null; Game.carSpeed = 0;
  Game.audio.stopEngineLoop();
}
function updatePlayer(dt) {
  const sprint = Game.keys['ShiftLeft'] || Game.keys['ShiftRight'];
  const speed = sprint ? 9 : 5.5;
  let mx = 0, mz = 0;
  if (Game.keys['KeyW']) mz += 1;
  if (Game.keys['KeyS']) mz -= 1;
  if (Game.keys['KeyA']) mx -= 1;
  if (Game.keys['KeyD']) mx += 1;
  const len = Math.hypot(mx, mz) || 1;
  const fx = Math.sin(Game.heading), fz = Math.cos(Game.heading);
  const rx = Math.cos(Game.heading), rz = -Math.sin(Game.heading);
  Game.player.position.x += (fx * mz / len + rx * mx / len) * speed * dt;
  Game.player.position.z += (fz * mz / len + rz * mx / len) * speed * dt;
  collide(Game.player.position, 0.6, Game.colliders);
  Game.player.rotation.y = Game.heading;
  // walk bob + arm swing
  const moving = mx !== 0 || mz !== 0;
  const t = performance.now() / 1000;
  Game.player.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.08 : 0;
  if (Game.player.userData.armR) Game.player.userData.armR.rotation.x = moving ? Math.sin(t * 9) * 0.4 : 0;
  // safehouse / shop proximity prompts
  const dHome = Math.hypot(Game.player.position.x + 60, Game.player.position.z + 60);
  const dShop = Math.hypot(Game.player.position.x - 140, Game.player.position.z - 40);
  if (dHome < 6 && Game.keys['KeyE'] && !Game._homeUsed) { /* E is car-first; rent paid via pause menu + shop */ }
  if (dShop < 6) { /* shop opens with KeyQ */ }
  if (Game.keys['KeyQ']) { openShopPanel(); Game.keys['KeyQ'] = false; }
  return moving ? speed : 0;
}
function updateCar(dt) {
  const car = Game.car; if (!car) return 0;
  const fwd = (Game.keys['KeyW'] ? 1 : 0) - (Game.keys['KeyS'] ? 0.7 : 0);
  const steer = (Game.keys['KeyA'] ? 1 : 0) - (Game.keys['KeyD'] ? 1 : 0);
  const top = 34;
  Game.carSpeed += fwd * 22 * dt;
  Game.carSpeed -= Game.carSpeed * 0.6 * dt;
  if (fwd === 0) Game.carSpeed -= Math.sign(Game.carSpeed) * 4 * dt;
  Game.carSpeed = Math.max(-10, Math.min(top, Game.carSpeed));
  if (Math.abs(Game.carSpeed) > 0.5) Game.carHeading += steer * 1.9 * dt * Math.sign(Game.carSpeed);
  car.position.x += Math.sin(Game.carHeading) * Game.carSpeed * dt;
  car.position.z += Math.cos(Game.carHeading) * Game.carSpeed * dt;
  collide(car.position, 1.6, Game.colliders);
  car.rotation.y = Game.carHeading;
  // body roll + wheel spin feel
  car.rotation.z = -steer * 0.03 * Math.min(1, Math.abs(Game.carSpeed) / 10);
  Game.audio.setEngineRpm(Math.abs(Game.carSpeed) / top);
  // crash into traffic cars: slow down + spark sound
  for (const tc of Game.traffic.cars) {
    if (tc === car) continue;
    if (tc.position.distanceTo(car.position) < 3.4) {
      Game.carSpeed *= 0.4; Game.audio.crash();
      tc.position.x += (tc.position.x - car.position.x) * 0.2;
      tc.position.z += (tc.position.z - car.position.z) * 0.2;
    }
  }
  return Math.abs(Game.carSpeed) * 2.2; // mph-ish
}
function playerSpeed() {
  if (Game.car) return Math.abs(Game.carSpeed) * 2.2;
  return (Game.keys['KeyW'] || Game.keys['KeyA'] || Game.keys['KeyS'] || Game.keys['KeyD']) ? 6 : 0;
}

// ---------- combat ----------
function reload() {
  if (Game.ammoMag >= 30 || Game.ammoReserve <= 0) return;
  const need = 30 - Game.ammoMag;
  const take = Math.min(need, Game.ammoReserve);
  Game.ammoMag += take; Game.ammoReserve -= take;
  Game.ui.setAmmo(Game.ammoMag, Game.ammoReserve);
  Game.audio.click();
}
function fireWeapon() {
  if (!Game.started || Game.paused || Game.dead || !Game.onFoot) return;
  if (Game.ammoMag <= 0) { reload(); return; }
  Game.ammoMag--; Game.stats.shotsFired++;
  Game.ui.setAmmo(Game.ammoMag, Game.ammoReserve);
  Game.audio.shot();
  const muzzleWorld = new THREE.Vector3();
  Game.player.userData.muzzle.getWorldPosition(muzzleWorld);
  const dir = new THREE.Vector3(Math.sin(Game.heading), 0.05, Math.cos(Game.heading)).normalize();
  Game.shots.muzzleFlash(muzzleWorld);
  const targets = [...Game.policePeds, ...Game.policeCars];
  const { hit } = Game.shots.fire(muzzleWorld, dir, 60, targets);
  if (hit) {
    if (hit.userData.officer) {
      hit.userData.hp = (hit.userData.hp || 3) - 1;
      if (hit.userData.hp <= 0) {
        Game.scene.remove(hit);
        Game.policePeds = Game.policePeds.filter((p) => p !== hit);
        Game.addCash(25); Game.ui.toast('OFFICER DOWN — +$25');
      }
    } else if (hit.userData.policeCar) {
      hit.userData.hp = (hit.userData.hp || 4) - 1;
      if (hit.userData.hp <= 0) {
        Game.scene.remove(hit);
        Game.policeCars = Game.policeCars.filter((p) => p !== hit);
      }
    }
  }
  crime(Math.max(Game.wanted, 1));
}
function enemyFire(dt) {
  // officers shoot back when close and the player is wanted
  for (const off of [...Game.policePeds]) {
    const d = off.position.distanceTo(Game.player.position);
    if (d < 26 && Game.wanted > 0) {
      off.userData.cool = (off.userData.cool || 0) - dt;
      // officer walks toward the player
      const dir = Game.player.position.clone().sub(off.position).normalize();
      off.position.add(dir.clone().multiplyScalar(2.6 * dt));
      off.rotation.y = Math.atan2(dir.x, dir.z);
      if (off.userData.cool <= 0) {
        off.userData.cool = 1.4 + Math.random();
        const from = off.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        const to = Game.player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        Game.shots.tracer(from, to, 0xff5040);
        Game.audio.enemyShot();
        if (Math.random() < 0.4) damagePlayer(8);
      }
    }
  }
}
function damagePlayer(n) {
  if (Game.dead) return;
  if (Game.armor) n = Math.ceil(n / 2);
  Game.health -= n;
  Game.ui.setHealth(Game.health);
  Game.ui.damageFlash();
  if (Game.health <= 0) {
    Game.dead = true;
    Game.ui.toast('WASTED');
    $('go-title').textContent = 'WASTED';
    $('go-text').textContent = T.dialogue.wasted;
    $('gameover').classList.remove('hidden');
    Game.audio.stopEngineLoop();
  }
}

// ---------- races, ambush, rent clock ----------
Game.addCash = function (n) { Game.cash += n; Game.ui.setCash(Game.cash); };
Game.loadSlot = loadSlot;
Game.saveGame = saveGame;
Game.setWanted = setWanted;
Game.playerSpeed = playerSpeed;
Game.startRace = function (m, laps, rivals) {
  Game.ui.toast(`${m.name} — ${laps} LAPS, ${rivals} RIVALS. GO!`);
  Game.audio.horn();
  const n = Math.min(rivals, Game.raceRivals.length);
  for (let i = 0; i < n; i++) { Game.raceRivals[i].visible = true; Game.raceRivals[i].userData.rival = true; }
  // player needs a car: put them in their own car at the start line
  if (Game.onFoot) {
    Game.playerCar.position.set(-168, 0, 112);
    Game.playerCar.rotation.y = Math.PI;
    Game.playerCar.visible = true;
    Game.onFoot = false; Game.car = Game.playerCar; Game.player.visible = false;
    Game.carHeading = Math.PI; Game.carSpeed = 0;
    Game.audio.engineStart(); Game.audio.startEngineLoop();
  }
};
Game.endRace = function (win) {
  for (const r of Game.raceRivals) r.visible = false;
  if (win) { Game.stats.racesWon++; Game.ui.toast('RACE WON!'); Game.audio.cash(); }
};
Game.startAmbush = function () {
  Game.ui.toast('ENFORCERS AT THE SAFEHOUSE — HOLD THEM OFF!');
  setWanted(3, 'Landlord enforcers incoming!');
  for (let i = 0; i < 4; i++) {
    const off = makePedestrian(0x3a1a1a);
    off.position.set(-60 + (Math.random() - 0.5) * 24, 0, -60 + (Math.random() - 0.5) * 24);
    off.userData.officer = true; off.userData.hitRadius = 1.2; off.userData.hp = 3; off.userData.enforcer = true;
    Game.scene.add(off); Game.policePeds.push(off);
  }
  Game.ambushAt = performance.now();
};

function updatePolice(dt) {
  if (Game.wanted <= 0) return;
  // wanted cools off when the player breaks line of sight for a while
  Game.wantedTimer += dt;
  const nearest = Game.policeCars[0];
  const dist = nearest ? nearest.position.distanceTo(Game.player.position) : 999;
  if (Game.wantedTimer > 25 && dist > 60) {
    setWanted(Game.wanted - 1);
    Game.ui.toast('Heat cooling off…');
    Game.wantedTimer = 0;
    return;
  }
  // police cars chase the player (or the player's car)
  const target = Game.car ? Game.car.position : Game.player.position;
  for (const pc of Game.policeCars) {
    const dir = target.clone().sub(pc.position); dir.y = 0;
    const d = dir.length();
    if (d > 0.1) {
      const desired = Math.atan2(dir.x, dir.z);
      let diff = desired - pc.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pc.rotation.y += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      const sp = Math.min(26, 12 + Game.wanted * 3);
      pc.position.x += Math.sin(pc.rotation.y) * sp * dt;
      pc.position.z += Math.cos(pc.rotation.y) * sp * dt;
      // flashing light bar
      const on = Math.sin(performance.now() / 120) > 0;
      if (pc.userData.lightRed) pc.userData.lightRed.material.color.setHex(on ? 0xff2030 : 0x550000);
      if (pc.userData.lightBlue) pc.userData.lightBlue.material.color.setHex(on ? 0x2050ff : 0x000055);
      // ramming the player hurts
      if (d < 3.2) {
        if (Game.car) { Game.carSpeed *= 0.5; Game.audio.crash(); }
        else damagePlayer(6 * dt * 2);
      }
    }
  }
  if (Game.wanted >= 4) Game.heli.update(dt, performance.now() / 1000, { x: Game.player.position.x, z: Game.player.position.z, heading: Game.heading });
}

function updateRentClock(dt) {
  if (!Game.started || Game.paused || Game.dead) return;
  Game.rentSeconds -= dt;
  Game.clockMinutes += dt * 0.6; // game clock runs faster than real time
  if (Game.clockMinutes >= 24 * 60) Game.clockMinutes -= 24 * 60;
  if (Game.rentSeconds <= 0) {
    // evicted: lose the day, rent doubles as a penalty, back to safehouse
    Game.rentSeconds = 360;
    Game.cash = Math.max(0, Game.cash - 150);
    Game.day++;
    Game.ui.setCash(Game.cash);
    Game.ui.toast('EVICTED — the landlord took $150 and the day is gone');
    respawn();
  }
  Game.ui.setRent(Game.rent, Game.rentSeconds);
}

// ---------- camera ----------
function updateCamera(dt) {
  const cam = Game.camera;
  // chase screenshot: camera ahead of the car looking back, so the player car
  // AND the police cars behind it are in the same frame
  if (Game.shotCam === 'chase' && Game.car) {
    const cx = Game.car.position.x + Math.sin(Game.carHeading) * 10.5;
    const cz = Game.car.position.z + Math.cos(Game.carHeading) * 10.5;
    cam.position.lerp(new THREE.Vector3(cx, 3.4, cz), Math.min(1, dt * 6));
    cam.lookAt(Game.car.position.x - Math.sin(Game.carHeading) * 8, 1.5, Game.car.position.z - Math.cos(Game.carHeading) * 8);
    return;
  }
  if (!Game.onFoot && Game.car) {
    const back = 9 + Game.camMode * 3;
    const h = 3.6 + Game.camMode * 1.2;
    const cx = Game.car.position.x - Math.sin(Game.carHeading) * back;
    const cz = Game.car.position.z - Math.cos(Game.carHeading) * back;
    cam.position.lerp(new THREE.Vector3(cx, h, cz), Math.min(1, dt * 6));
    cam.lookAt(Game.car.position.x + Math.sin(Game.carHeading) * 8, 1.4, Game.car.position.z + Math.cos(Game.carHeading) * 8);
  } else {
    const dist = 7.5;
    const cx = Game.player.position.x - Math.sin(Game.heading) * dist * Math.cos(Game.pitch);
    const cz = Game.player.position.z - Math.cos(Game.heading) * dist * Math.cos(Game.pitch);
    const cy = 3.4 + Math.sin(Game.pitch) * 3;
    cam.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8));
    cam.lookAt(Game.player.position.x + Math.sin(Game.heading) * 4, 1.5, Game.player.position.z + Math.cos(Game.heading) * 4);
  }
}

// ---------- panels ----------
function toggleJobBoard() {
  const el = $('jobboard');
  if (el.classList.contains('hidden')) {
    const jobs = T.missions.map((m) => ({ ...m, taken: Game.missions.active && Game.missions.index === m.id - 1 }));
    Game.ui.openJobBoard(jobs, (m) => {
      Game.ui.closeJobBoard();
      Game.missions.startMission(m.id - 1);
    });
  } else Game.ui.closeJobBoard();
}
function openShopPanel() {
  if (!$('shop').classList.contains('hidden')) return;
  Game.paused = true;
  Game.ui.openShop(T.shopItems, Game.cash, (it) => {
    if (Game.cash < it.price) return;
    Game.cash -= it.price;
    if (it.id === 'medkit') Game.health = Math.min(100, Game.health + 50);
    if (it.id === 'armor') Game.armor = true;
    if (it.id === 'ammo') Game.ammoReserve += 120;
    if (it.id === 'snack') Game.health = Math.min(100, Game.health + 15);
    if (it.id === 'repair' && Game.car) Game.carSpeed = Game.carSpeed;
    Game.ui.setCash(Game.cash); Game.ui.setHealth(Game.health); Game.ui.setAmmo(Game.ammoMag, Game.ammoReserve);
    Game.audio.cash();
    Game.ui.toast(it.name.toUpperCase() + ' BOUGHT');
    Game.ui.closeShop(); Game.paused = false;
  });
}
function togglePause() {
  if (!Game.started) return;
  Game.paused = !Game.paused;
  $('pause').classList.toggle('hidden', !Game.paused);
}
function cycleRadio() {
  const s = Game.audio.nextStation();
  const st = T.radioStations[s];
  Game.ui.setRadio(st.name, st.tracks[0]);
  Game.ui.toast(st.name);
}

// ---------- main loop ----------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Game.clock.getDelta());
  const t = performance.now() / 1000;
  if (Game.started && !Game.paused && !Game.dead) {
    let speed = 0;
    if (Game.onFoot) speed = updatePlayer(dt);
    else speed = updateCar(dt);
    Game.traffic.update(dt, t, Game.player.position);
    Game.missions.update(dt, Game.onFoot ? Game.player.position : Game.car.position, !Game.onFoot);
    updatePolice(dt);
    enemyFire(dt);
    updateRentClock(dt);
    Game.shots.update(dt);
    // HUD refresh
    const pp = Game.onFoot ? Game.player.position : Game.car.position;
    const hh = Math.floor(Game.clockMinutes / 60) % 24;
    const mm = Math.floor(Game.clockMinutes % 60);
    Game.ui.setClock(Game.day, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, districtAt(pp.x, pp.z));
    Game.ui.setSpeed(speed, !Game.onFoot);
    const spot = Game.missions.active ? Game.missions.targetSpot() : null;
    Game.ui.drawMinimap({
      player: { x: pp.x, z: pp.z, heading: Game.heading },
      marker: spot,
      police: Game.policeCars.map((c) => ({ x: c.position.x, z: c.position.z })),
      heli: Game.heli.active ? { x: Game.heli.mesh.position.x, z: Game.heli.mesh.position.z } : null,
    });
    // rent payment: walk into the safehouse door and press R? No — pay at safehouse with KeyP? Use: near safehouse + cash, press KeyL.
    if (Game.keys['KeyL']) { Game.keys['KeyL'] = false; payRent(); }
    // mission-8 completion: ambush cleared + at safehouse
    if (Game.missions.active && Game.missions.current() && Game.missions.current().id === 8 && Game.missions.stage === 1) {
      if (Game.policePeds.length === 0) {
        Game.missions.complete(Game.missions.current());
        Game.ui.toast('ENFORCERS DOWN — NOW PAY THE RENT [L]');
      }
    }
    // shop / safehouse door hint
    const dShop = Math.hypot(pp.x - 140, pp.z - 40);
    if (dShop < 6) Game.ui.setObjective('Press Q to open the Corner Shop');
  }
  updateCamera(dt);
  Game.renderer.render(Game.scene, Game.camera);
}

// ---------- shot staging (for screenshots) ----------
function stageShot(name) {
  if (name === 'start') return; // menu is the shot
  startGame(true);
  Game.paused = false;
  // the intro dialogue would cover the scene in gameplay shots — hide it
  document.getElementById('dialogue').classList.add('hidden');
  if (name === 'play') {
    // Dimas on foot on open road x=40 (clear of plaza palms),
    // mid-firefight, heli BIG in front
    Game.player.position.set(40, 0, -20);
    Game.heading = 0; // facing +z down the open road x=0
    Game.onFoot = true; Game.player.visible = true;
    Game.car = null;
    setWanted(4, '');
    Game.heli.radius = 14; Game.heli.height = 7;
    Game.heli.angle = Math.PI / 2 - Game.heading; // orbit target stays in front
    Game.heli.place({ x: Game.player.position.x, z: Game.player.position.z, heading: Game.heading }, 12, -2);
    Game.heli.mesh.position.y = 7;
    // keep the chasing police cars at a ring ~20 m out so none blocks the camera
    Game.policeCars.forEach((pc, i) => {
      const a = (i / Game.policeCars.length) * Math.PI * 2 + 0.6;
      pc.position.set(Game.player.position.x + Math.cos(a) * 20, 0, Game.player.position.z + Math.sin(a) * 20);
      pc.rotation.y = a + Math.PI / 2;
    });
    // two officers shooting at Dimas so tracers fly
    for (let i = 0; i < 2; i++) {
      const off = makePedestrian(0x10141f);
      off.position.set(Game.player.position.x + 3 + i * 4, 0, Game.player.position.z + 13);
      off.userData.officer = true; off.userData.hitRadius = 1.2; off.userData.hp = 3;
      Game.scene.add(off); Game.policePeds.push(off);
    }
    setTimeout(() => { fireWeapon(); }, 400);
  }
  if (name === 'chase') {
    // race car #7 chased by police, wanted 3, roadblocks up — on open road x=40
    Game.playerCar.position.set(40, 0, -100);
    Game.playerCar.rotation.y = 0;
    Game.onFoot = false; Game.car = Game.playerCar; Game.player.visible = false;
    Game.carHeading = 0; Game.carSpeed = 20;
    Game.shotCam = 'chase';
    Game.audio.startEngineLoop();
    setWanted(3, '');
    // pull police cars in close behind the player's car (relative to the car)
    const cz0 = Game.playerCar.position.z;
    Game.policeCars.forEach((pc, i) => {
      pc.position.set(40 - 2.5 + i * 2.5, 0, cz0 - 14 - i * 4);
      pc.rotation.y = 0;
    });
  }
  if (name === 'mission') {
    Game.missions.startMission(0);
    Game.player.position.set(-158, 0, -40);
    Game.heading = -Math.PI / 2; // facing west toward Dock 7, marker ahead
    Game.ui.showDialogue([
      ['MARA — DISPATCHER', 'Dimas. The parcel is waiting at Dock 7 — grab it and run it to the Corner Shop on Pasar Timur. Rent is due tonight, so no detours.'],
      ['DIMAS', 'Dock 7, then the shop. One bounty at a time.'],
    ], () => {});
  }
}

// ---------- debug / QA API ----------
function exposeApi() {
  window.__RENT = {
    state: () => ({
      started: Game.started, paused: Game.paused, dead: Game.dead,
      cash: Game.cash, rent: Game.rent, rentSeconds: Math.round(Game.rentSeconds),
      day: Game.day, health: Game.health, wanted: Game.wanted,
      onFoot: Game.onFoot, jobIndex: Game.missions.index, jobsDone: Game.stats.jobsDone,
      missionActive: Game.missions.active, missionStage: Game.missions.stage, ammoMag: Game.ammoMag, ammoReserve: Game.ammoReserve,
      policeCars: Game.policeCars.length, officers: Game.policePeds.length,
      heliActive: Game.heli.active, roadblocks: Game.roadblocks.length,
      x: Math.round(Game.player.position.x), z: Math.round(Game.player.position.z),
      carSpeed: Math.round(Game.carSpeed || 0),
      errors: Game.errors,
    }),
    key: (code, down) => { Game.keys[code] = down; },
    start: () => startGame(true),
    payRent: () => payRent(),
    setWanted: (n) => setWanted(n),
    startMission: (i) => Game.missions.startMission(i),
    stageFirefight: () => {
      fireWeapon();
      for (const off of Game.policePeds) {
        const from = off.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        const to = Game.player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        Game.shots.tracer(from, to, 0xff5040);
      }
    },
    enterCar: () => tryEnterCar(),
    exitCar: () => exitCar(),
    fire: () => fireWeapon(),
    save: (slot) => saveGame(slot || 1),
    load: (slot) => loadSlot(slot || 1),
    damage: (n) => damagePlayer(n),
    stage: stageShot,
    Game,
  };
  window.__RENT_ERRORS = Game.errors;
}

// ---------- boot ----------
initRenderer();
initWorld();
bindInput();
exposeApi();
animate();
if (SHOT) {
  // auto-staging for screenshots: menu stays for 'start', otherwise play the scene
  if (SHOT !== 'start') {
    setTimeout(() => stageShot(SHOT), 600);
  }
}
Game.ui.refreshSlots();

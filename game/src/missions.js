// RENT RUNNER — missions.js: 8 story missions with stages, markers, races and heists.
// Each mission is a small state machine driven by the player reaching waypoints,
// winning a race, or surviving a shootout. All original story, all original names.
const THREE = window.THREE;
import { T } from './i18n.js';

export const MISSION_SPOTS = {
  dock7: { x: -178, z: -40, label: 'Dock 7' },
  shop: { x: 140, z: 48, label: 'Corner Shop' },
  harbor: { x: -160, z: 120, label: 'Harbor Gate' },
  stage: { x: 40, z: 168, label: 'Beach Stage' },
  garage: { x: 120, z: -140, label: 'Bukit Garage' },
  yard: { x: -40, z: 140, label: 'Repo Yard' },
  drop1: { x: 100, z: 100, label: 'Drop 1' },
  drop2: { x: -100, z: 100, label: 'Drop 2' },
  drop3: { x: 0, z: -160, label: 'Drop 3' },
  docks: { x: -178, z: 40, label: 'Courier Van' },
  safehouse: { x: -60, z: -52, label: 'Safehouse' },
};

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.index = 0; // 0-based into T.missions
    this.stage = 0; this.stageTotal = 2; this.active = false;
    this.dropsDone = 0; this.race = null; this.marker = null;
    this.markerMesh = this.makeMarker();
    game.scene.add(this.markerMesh);
    this.markerMesh.visible = false;
  }
  makeMarker() {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 }));
    cone.rotation.x = Math.PI; cone.position.y = 5; g.add(cone);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    return g;
  }
  current() { return T.missions[this.index]; }
  isDone() { return this.index >= T.missions.length; }
  startMission(i) {
    this.index = i; this.stage = 0; this.active = true; this.dropsDone = 0; this.race = null;
    const m = this.current();
    this.stageTotal = m.kind === 'delivery' && m.id === 5 ? 3 : (m.kind === 'race' ? 3 : 2);
    if (m.kind === 'race') this.stageTotal = m.id === 7 ? 4 : 3;
    this.game.ui.toast(`JOB ${m.id}/8 — ${m.name} · $${m.pay}`);
    this.game.ui.setMission(m, 0);
    this.game.audio.pickup();
    this.updateMarker();
  }
  targetSpot() {
    const m = this.current(); if (!m) return null;
    switch (m.id) {
      case 1: return this.stage === 0 ? MISSION_SPOTS.dock7 : MISSION_SPOTS.shop;
      case 2: return this.stage === 0 ? MISSION_SPOTS.harbor : MISSION_SPOTS.stage;
      case 3: return MISSION_SPOTS.harbor; // race start
      case 4: return this.stage === 0 ? MISSION_SPOTS.garage : MISSION_SPOTS.yard;
      case 5: return [MISSION_SPOTS.drop1, MISSION_SPOTS.drop2, MISSION_SPOTS.drop3][this.dropsDone] || MISSION_SPOTS.drop3;
      case 6: return this.stage === 0 ? MISSION_SPOTS.docks : MISSION_SPOTS.safehouse;
      case 7: return MISSION_SPOTS.harbor;
      case 8: return MISSION_SPOTS.safehouse;
      default: return null;
    }
  }
  updateMarker() {
    const spot = this.targetSpot();
    if (!spot || !this.active) { this.markerMesh.visible = false; return; }
    this.markerMesh.visible = true;
    this.markerMesh.position.set(spot.x, 0, spot.z);
  }
  // called every frame: proximity checks + race progress
  update(dt, playerPos, inCar) {
    if (!this.active || this.isDone()) return;
    const m = this.current();
    this.markerMesh.rotation.y += dt * 2;
    this.markerMesh.children[0].position.y = 5 + Math.sin(performance.now() / 300) * 0.5;
    if (this.race) { this.updateRace(dt); return; }
    const spot = this.targetSpot(); if (!spot) return;
    const dx = playerPos.x - spot.x, dz = playerPos.z - spot.z;
    if (dx * dx + dz * dz < 49) this.reachSpot(m);
  }
  reachSpot(m) {
    if (m.kind === 'race' && this.stage === 0) { this.beginRace(m); return; }
    if (m.id === 5) {
      this.dropsDone++; this.game.addCash(0);
      this.game.audio.pickup();
      this.game.ui.toast(`Drop ${this.dropsDone}/3 done`);
      if (this.dropsDone >= 3) return this.complete(m);
      this.updateMarker(); this.game.ui.setMission(m, this.dropsDone / 3); return;
    }
    if (m.id === 6 && this.stage === 0) {
      this.stage = 1;
      this.game.setWanted(3, 'Courier van hit — Moderators responding!');
      this.game.ui.toast('VAN TAKEN — LOSE THE HEAT, THEN GET HOME');
      this.game.ui.setMission(m, 0.5); this.updateMarker(); return;
    }
    if (m.id === 8 && this.stage === 0) {
      this.stage = 1;
      this.game.startAmbush();
      this.game.ui.setMission(m, 0.5); return;
    }
    if (m.id === 4 && this.stage === 0) {
      this.stage = 1; this.game.ui.toast('TARGET CAR SECURED — DELIVER TO THE YARD');
      this.game.ui.setMission(m, 0.5); this.updateMarker(); return;
    }
    if (m.id === 1 || m.id === 2) {
      if (this.stage === 0) { this.stage = 1; this.game.audio.pickup(); this.game.ui.setMission(m, 0.5); this.updateMarker(); return; }
    }
    return this.complete(m);
  }
  beginRace(m) {
    const laps = m.id === 7 ? 4 : 3;
    const rivals = m.id === 7 ? 5 : 3;
    this.race = { laps, lap: 1, rivals, progress: 0, total: 0, finished: false, raceTime: 0, rivalProgress: rivals * 0 };
    this.game.startRace(m, laps, rivals);
    this.game.ui.setMission(m, 0.05);
  }
  updateRace(dt) {
    const r = this.race; if (!r || r.finished) return;
    r.raceTime += dt;
    r.progress += dt * (this.game.playerSpeed() / 90);
    r.rivalProgress += dt * 0.055;
    const lapFrac = (r.progress % 1);
    this.game.ui.setMission(this.current(), Math.min(0.99, (r.lap - 1 + lapFrac) / r.laps));
    this.game.ui.setObjective(`Lap ${r.lap}/${r.laps} — You: ${(r.progress * 100).toFixed(0)}% · Rivals: ${(r.rivalProgress * 100).toFixed(0)}%`);
    if (r.progress >= r.lap) { r.lap++; this.game.audio.pickup(); this.game.ui.toast(r.lap > r.laps ? 'FINAL LAP!' : `LAP ${r.lap}/${r.laps}`); }
    if (r.progress >= r.laps) {
      r.finished = true;
      const win = r.progress >= r.rivalProgress;
      this.game.endRace(win);
      if (win) this.complete(this.current()); else { this.race = null; this.game.ui.toast('RACE LOST — try again from the job board'); this.active = false; this.markerMesh.visible = false; }
    }
  }
  complete(m) {
    this.active = false; this.race = null; this.markerMesh.visible = false;
    this.game.addCash(m.pay);
    this.game.audio.cash();
    this.game.ui.toast(`JOB DONE — +$${m.pay}`);
    this.game.stats.jobsDone++;
    this.index++;
    if (this.isDone()) {
      this.game.ui.setMission(null, 1);
      this.game.ui.setObjective('All 8 jobs done — Rent Harbor is yours, Dimas.');
      this.game.ui.toast('ALL 8 JOBS COMPLETE — RENT RUNNER!');
    } else {
      const next = this.current();
      this.game.ui.setMission(next, 0);
      this.game.ui.setObjective('Open the job board [TAB] to take the next bounty.');
    }
  }
  reset() { this.index = 0; this.stage = 0; this.active = false; this.race = null; this.dropsDone = 0; this.markerMesh.visible = false; }
}

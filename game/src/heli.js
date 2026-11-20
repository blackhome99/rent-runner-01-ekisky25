// RENT RUNNER — heli.js: the Moderator helicopter. Appears at wanted 4+,
// circles the player with a sweeping searchlight, and calls in ground units.
import { makeHelicopter } from './city.js';

export class Heli {
  constructor(scene) {
    this.scene = scene;
    this.mesh = makeHelicopter();
    this.mesh.visible = false;
    this.scene.add(this.mesh);
    this.active = false;
    this.angle = 0; this.radius = 26; this.height = 24;
    this.sweep = 0;
  }
  place(playerPos, ahead = 10, side = 0) {
    // Positioned in FRONT of the player so it is big and fully in frame.
    const fx = Math.sin(playerPos.heading || 0), fz = Math.cos(playerPos.heading || 0);
    const px = playerPos.x + fx * ahead - fz * side;
    const pz = playerPos.z + fz * ahead + fx * side;
    this.mesh.position.set(px, this.height, pz);
    this.mesh.lookAt(playerPos.x, 0, playerPos.z);
    this.mesh.visible = true; this.active = true;
  }
  hide() { this.mesh.visible = false; this.active = false; }
  update(dt, t, playerPos) {
    if (!this.active) return;
    this.angle += dt * 0.45;
    this.sweep += dt * 0.9;
    const tx = playerPos.x + Math.cos(this.angle) * this.radius;
    const tz = playerPos.z + Math.sin(this.angle) * this.radius;
    this.mesh.position.x += (tx - this.mesh.position.x) * Math.min(1, dt * 1.2);
    this.mesh.position.z += (tz - this.mesh.position.z) * Math.min(1, dt * 1.2);
    this.mesh.position.y = this.height + Math.sin(t * 1.3) * 1.5;
    this.mesh.lookAt(playerPos.x, 0, playerPos.z);
    this.mesh.userData.rotor.rotation.y += dt * 22;
    this.mesh.userData.tailRotor.rotation.z += dt * 30;
    // searchlight sweeps + lamp blink
    const lamp = this.mesh.userData.lamp;
    if (lamp) lamp.material.color.setHex(Math.sin(t * 8) > 0 ? 0xff2030 : 0xffffff);
    const beam = this.mesh.children.find((c) => c.geometry && c.geometry.type === 'ConeGeometry');
    if (beam) beam.rotation.z = Math.sin(this.sweep) * 0.5;
  }
}

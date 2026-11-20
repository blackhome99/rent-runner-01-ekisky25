// RENT RUNNER — shots.js: shooting, tracers, muzzle flashes, enemy fire.
// Visible tracer lines so every firefight reads on camera.
const THREE = window.THREE;

export class ShotSystem {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.flashes = [];
    this.bullets = [];
  }
  tracer(from, to, color = 0xffe9a8) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.28, max: 0.28 });
    return line;
  }
  muzzleFlash(at) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 1 }));
    flash.position.copy(at);
    this.scene.add(flash);
    this.flashes.push({ mesh: flash, life: 0.12, max: 0.12 });
    const light = new THREE.PointLight(0xffc860, 2.5, 12);
    light.position.copy(at); this.scene.add(light);
    this.flashes.push({ mesh: light, life: 0.1, max: 0.1, isLight: true });
  }
  // hitscan shot from the player toward a direction; returns what it hit.
  fire(from, dir, range, targets) {
    const end = from.clone().add(dir.clone().multiplyScalar(range));
    let hit = null; let best = range;
    for (const t of targets) {
      const to = t.position.clone().sub(from);
      const along = to.dot(dir);
      if (along < 0 || along > range) continue;
      const perp = to.clone().sub(dir.clone().multiplyScalar(along)).length();
      const radius = t.userData.hitRadius || 1.2;
      if (perp < radius && along < best) { best = along; hit = t; }
    }
    if (hit) end.copy(from.clone().add(dir.clone().multiplyScalar(best)));
    this.tracer(from, end);
    return { hit, dist: best };
  }
  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]; tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / tr.max);
      if (tr.life <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); tr.line.material.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.life -= dt;
      if (f.isLight) { f.mesh.intensity = Math.max(0, (f.life / f.max) * 2.5); }
      else f.mesh.material.opacity = Math.max(0, f.life / f.max);
      if (f.life <= 0) { this.scene.remove(f.mesh); if (!f.isLight) f.mesh.geometry.dispose(); this.flashes.splice(i, 1); }
    }
  }
}

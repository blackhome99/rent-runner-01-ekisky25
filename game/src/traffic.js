// RENT RUNNER — traffic.js: ambient traffic cars + pedestrians wandering Rent Harbor.
// Cars follow the road grid; pedestrians stroll the sidewalks.
import { makeCar, makePedestrian, CITY } from './city.js';

export class Traffic {
  constructor(scene, colliders) {
    this.scene = scene; this.cars = []; this.peds = [];
    this.colors = [0xff2d78, 0x00e5ff, 0xffd23f, 0x7dff9a, 0xff7e47, 0xc0c0d0, 0x8a4aff];
    for (let i = 0; i < 10; i++) this.spawnCar(i);
    for (let i = 0; i < 14; i++) this.spawnPed(i);
  }
  spawnCar(i) {
    const car = makeCar({ color: this.colors[i % this.colors.length], raceNumber: (i * 7 + 3) % 97 + 1, spoiler: i % 3 === 0 });
    const vertical = i % 2 === 0;
    const lane = (Math.floor(i / 2) % 9 - 4) * 40 + (vertical ? 2.5 : -2.5);
    car.position.set(vertical ? lane : (Math.random() - 0.5) * 320, 0, vertical ? (Math.random() - 0.5) * 320 : lane);
    car.rotation.y = vertical ? (i % 4 < 2 ? 0 : Math.PI) : (i % 4 < 2 ? Math.PI / 2 : -Math.PI / 2);
    car.userData.speed = 6 + Math.random() * 5;
    car.userData.vertical = vertical;
    car.userData.ambient = true;
    this.scene.add(car); this.cars.push(car);
  }
  spawnPed(i) {
    const ped = makePedestrian(this.colors[(i + 2) % this.colors.length]);
    ped.position.set((Math.random() - 0.5) * 300, 0, (Math.random() - 0.5) * 300);
    ped.userData.heading = Math.random() * Math.PI * 2;
    ped.userData.speed = 1 + Math.random() * 1.2;
    ped.userData.turnAt = 0;
    this.scene.add(ped); this.peds.push(ped);
  }
  update(dt, t, playerPos) {
    for (const car of this.cars) {
      const sp = car.userData.speed;
      // move along its facing direction
      const dir = car.userData.vertical ? (car.rotation.y === 0 ? -1 : 1) : (car.rotation.y === Math.PI / 2 ? 1 : -1);
      if (car.userData.vertical) car.position.z += dir * sp * dt; else car.position.x += dir * sp * dt;
      if (car.position.z > 195) car.position.z = -195;
      if (car.position.z < -195) car.position.z = 195;
      if (car.position.x > 195) car.position.x = -195;
      if (car.position.x < -195) car.position.x = 195;
    }
    for (const ped of this.peds) {
      if (t > ped.userData.turnAt) { ped.userData.heading = Math.random() * Math.PI * 2; ped.userData.turnAt = t + 4 + Math.random() * 6; }
      ped.position.x += Math.cos(ped.userData.heading) * ped.userData.speed * dt;
      ped.position.z += Math.sin(ped.userData.heading) * ped.userData.speed * dt;
      ped.position.x = Math.max(-190, Math.min(190, ped.position.x));
      ped.position.z = Math.max(-190, Math.min(190, ped.position.z));
      ped.rotation.y = -ped.userData.heading + Math.PI / 2;
      // little walk bob
      ped.position.y = Math.abs(Math.sin(t * 6 + ped.userData.speed * 10)) * 0.06;
    }
  }
}

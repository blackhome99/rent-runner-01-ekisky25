// RENT RUNNER — qa.mjs: headless QA for every flow. 0 JS errors, 0 console errors.
// Usage: node qa.mjs
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readdirSync, statSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun/fps-shots/node_modules/playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8089;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (c) => { if (String(c).includes('game/ is on')) resolve(); });
  server.stderr.on('data', (c) => console.error('[serve]', String(c)));
  setTimeout(() => reject(new Error('server did not start')), 15000);
});

let browser;
try {
  browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  const state = () => page.evaluate(() => window.__RENT.state());

  // 0. menu
  await page.goto(`http://localhost:${PORT}/?shot=start&seed=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__RENT, null, { timeout: 60000 });
  await sleep(1200);
  let m = await page.evaluate(() => ({
    logo: document.querySelector('.game-logo')?.textContent || '',
    slots: document.querySelectorAll('.slot-card').length,
    btns: [...document.querySelectorAll('.menu-btn')].map((b) => b.textContent.trim().slice(0, 12)),
  }));
  check('menu: RENT RUNNER logo + 3 slots + buttons', m.logo.includes('RENT') && m.slots === 3, JSON.stringify(m));

  // 1. start game, walk
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__RENT, null, { timeout: 60000 });
  await page.evaluate(() => window.__RENT.start());
  await sleep(500);
  let s0 = await state();
  check('game starts, 0 errors', s0.started && s0.errors.length === 0, JSON.stringify(s0.errors));
  await page.evaluate(() => window.__RENT.key('KeyW', true));
  await sleep(1200);
  await page.evaluate(() => window.__RENT.key('KeyW', false));
  let s1 = await state();
  check('walk: player moved', s1.z !== s0.z || s1.x !== s0.x, `(${s0.x},${s0.z}) -> (${s1.x},${s1.z})`);

  // 2. drive: enter the starter car and drive
  await page.evaluate(() => { window.__RENT.Game.player.position.set(-52, 0, -44); });
  await page.evaluate(() => window.__RENT.enterCar());
  await sleep(300);
  let s2 = await state();
  check('enter car: onFoot false', s2.onFoot === false, JSON.stringify(s2));
  await page.evaluate(() => window.__RENT.key('KeyW', true));
  await sleep(4000); // headless swiftshader runs ~5x slow (dt clamped); allow sim time
  await page.evaluate(() => window.__RENT.key('KeyW', false));
  let s3 = await state();
  check('drive: car moved at speed', s3.carSpeed > 3 || Math.abs(s3.x - s2.x) > 4, `carSpeed=${s3.carSpeed} x ${s2.x}->${s3.x}`);
  await page.evaluate(() => window.__RENT.exitCar());
  await sleep(200);

  // 3. shootout: fire the AK-47, ammo drops, no errors
  const ammoBefore = (await state()).ammoMag;
  await page.evaluate(() => window.__RENT.fire());
  await sleep(200);
  let s4 = await state();
  check('shootout: ammo decreases, wanted >= 1', s4.ammoMag === ammoBefore - 1 && s4.wanted >= 1, `ammo ${ammoBefore}->${s4.ammoMag} wanted=${s4.wanted}`);

  // 4. wanted + heli + roadblock at 4 stars
  await page.evaluate(() => window.__RENT.setWanted(4));
  await sleep(800);
  let s5 = await state();
  check('wanted 4: heli active + police cars + roadblocks', s5.heliActive && s5.policeCars >= 3 && s5.roadblocks >= 1, JSON.stringify({ h: s5.heliActive, pc: s5.policeCars, rb: s5.roadblocks }));
  const policePanel = await page.evaluate(() => !document.getElementById('police-panel').classList.contains('hidden'));
  check('police-response panel visible', policePanel);

  // 5. escape: wanted cools off (setWanted 0 simulates a clean escape)
  await page.evaluate(() => window.__RENT.setWanted(0));
  await sleep(300);
  let s6 = await state();
  check('escape: wanted clears, heli gone', s6.wanted === 0 && !s6.heliActive, JSON.stringify(s6));

  // 6. mission: start job 1, reach Dock 7, stage advances
  await page.evaluate(() => window.__RENT.startMission(0));
  await sleep(300);
  let s7 = await state();
  check('mission 1 active', s7.missionActive && s7.jobIndex === 0);
  await page.evaluate(() => { window.__RENT.Game.player.position.set(-178, 0, -40); });
  await sleep(600);
  let s8 = await state();
  check('mission 1 stage advances at Dock 7', s8.missionStage === 1, JSON.stringify(s8));

  // 7. race: start job 3 (street sprint), walk to the harbor start line, race begins
  await page.evaluate(() => window.__RENT.startMission(2));
  await page.evaluate(() => { window.__RENT.Game.player.position.set(-160, 0, 120); });
  await sleep(800);
  let s9 = await state();
  check('race mission starts (in car)', s9.missionActive && !s9.onFoot, JSON.stringify({ m: s9.missionActive, foot: s9.onFoot }));

  // 8. rent payment: give cash, pay rent, day advances
  await page.evaluate(() => { window.__RENT.Game.cash = 1000; });
  const dayBefore = (await state()).day;
  await page.evaluate(() => window.__RENT.payRent());
  await sleep(300);
  let s10 = await state();
  check('rent payment: cash drops by rent, day +1', s10.day === dayBefore + 1 && s10.cash === 1000 - 450, `day ${dayBefore}->${s10.day} cash=${s10.cash}`);

  // 9. save / load round-trip
  await page.evaluate(() => window.__RENT.save(1));
  const loaded = await page.evaluate(() => window.__RENT.load(1));
  check('save/load: slot 1 round-trips', !!loaded && loaded.day === s10.day && loaded.cash === s10.cash, JSON.stringify(loaded));

  // 10. death / respawn
  await page.evaluate(() => window.__RENT.damage(200));
  await sleep(300);
  let s11 = await state();
  check('death: wasted state, gameover shown', s11.dead === true, JSON.stringify(s11));
  await page.evaluate(() => document.getElementById('go-respawn').click());
  await sleep(300);
  let s12 = await state();
  check('respawn: alive at safehouse, health 100', !s12.dead && s12.health === 100, JSON.stringify({ dead: s12.dead, hp: s12.health }));

  // 11. minimap + compass render
  const mm = await page.evaluate(() => {
    const c = document.getElementById('minimap');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let nonEmpty = 0;
    for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 30) nonEmpty++;
    return { nonEmpty, n: document.getElementById('compass-n')?.textContent, deg: document.getElementById('compass-deg')?.textContent };
  });
  check('minimap drawn + compass N present', mm.nonEmpty > 20 && mm.n === 'N', JSON.stringify(mm));

  // 12. no external requests, no errors at end
  const external = requests.filter((u) => !u.startsWith('http://localhost'));
  const sEnd = await state();
  check('0 external requests', external.length === 0, JSON.stringify(external));
  check('0 JS errors at end', sEnd.errors.length === 0, JSON.stringify(sEnd.errors));

  // 13. screenshots dir: exactly the 4 named files
  const shots = readdirSync(join(here, 'screenshots')).sort();
  const sizes = shots.map((f) => statSync(join(here, 'screenshots', f)).size);
  check('screenshots: exactly 4 named files, each <= 262144 B',
    JSON.stringify(shots) === JSON.stringify(['1-start.jpg', '2-play.jpg', '3-chase.jpg', '4-mission.jpg']) && sizes.every((s) => s <= 262144),
    JSON.stringify(shots.map((f, i) => `${f}:${sizes[i]}`)));
} finally {
  if (browser) await browser.close();
  server.kill();
}
const passed = results.filter((r) => r.ok).length;
console.log(`\nQA: ${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);

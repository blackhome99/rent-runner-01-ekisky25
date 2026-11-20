// RENT RUNNER — shots.mjs: take the 4 screenshots headlessly with Playwright.
// Usage: node shots.mjs [start|play|chase|mission|all]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun/fps-shots/node_modules/playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const shotsDir = join(here, 'screenshots');
const PORT = 8087;

const ALL = [
  ['start', '1-start.jpg'],
  ['play', '2-play.jpg'],
  ['chase', '3-chase.jpg'],
  ['mission', '4-mission.jpg'],
];
const which = process.argv[2] || 'all';
const SHOTS = which === 'all' ? ALL : ALL.filter(([n]) => n === which);
if (!SHOTS.length) { console.error(`shots.mjs: unknown shot: ${which}`); process.exit(1); }

mkdirSync(shotsDir, { recursive: true });

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (chunk) => { if (String(chunk).includes('game/ is on')) resolve(); });
  server.stderr.on('data', (chunk) => console.error('[serve]', String(chunk)));
  setTimeout(() => reject(new Error('server did not start in time')), 15000);
});

let browser;
let hadError = false;
try {
  browser = await chromium.launch({
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (err) => { hadError = true; console.error('[pageerror]', err.message); });
  page.on('console', (msg) => { if (msg.type() === 'error') { hadError = true; console.error('[page console]', msg.text()); } });
  for (const [name, file] of SHOTS) {
    const query = `?shot=${name}&seed=1&auto=1`;
    await page.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => !!window.__RENT, null, { timeout: 60000 });
    if (name === 'start') {
      await page.waitForTimeout(2000);
    } else {
      await page.waitForFunction(() => window.__RENT && window.__RENT.state().started === true, null, { timeout: 60000 });
      if (name === 'play') {
        await page.waitForTimeout(900);
        await page.evaluate(() => window.__RENT.stageFirefight());
        await page.waitForTimeout(60);
      } else if (name === 'chase') {
        await page.evaluate(() => window.__RENT.key('KeyW', true));
        await page.waitForTimeout(700);
      } else {
        await page.waitForTimeout(900);
      }
    }
    const state = await page.evaluate(() => window.__RENT.state());
    console.log(`shot ${name}:`, JSON.stringify(state));
    await page.screenshot({ path: join(shotsDir, file), type: 'jpeg', quality: 82 });
    console.log(`saved ${file}`);
  }
  const external = requests.filter((u) => !u.startsWith('http://localhost'));
  console.log('external requests:', external.length, external);
  console.log('hadError:', hadError);
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(hadError ? 1 : 0);

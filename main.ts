// RENT RUNNER — main.ts: hands the entry in (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, three.js vendored under
// game/vendor/, no network request). This program copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json with the
// vendored make.fun library, exactly as the kit's starter does.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this script lives in — never
// process.cwd(): the grader runs `node /bot/main.ts` from an unknown cwd.
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// Screenshots: exactly the four named files, copied by name — never the whole
// directory, so a stray file in screenshots/ can never break the entry. Each
// file is checked for size here too, so a too-big JPEG fails loudly at build
// time instead of silently at the scorer.
const SHOTS = ['1-start.jpg', '2-play.jpg', '3-chase.jpg', '4-mission.jpg'];
mkdirSync(join(out, 'screenshots'), { recursive: true });
for (const name of SHOTS) {
  const src = join(here, 'screenshots', name);
  if (!existsSync(src)) throw new Error(`main.ts: missing screenshot ${name}`);
  copyFileSync(src, join(out, 'screenshots', name));
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`RENT RUNNER handed in to ${out}`);

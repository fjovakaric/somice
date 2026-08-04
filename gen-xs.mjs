#!/usr/bin/env node
// Generate somice/xs/<slug>.webp — small WebP variants of the soma cutouts, for
// the timeline pills/cards and the app loader hero. The 800px PNGs in small/ are
// ~90-400KB each and render at 15-48px on pills/cards and ~221px in the loader,
// so they're 15-50x oversized. Flat-vector somas compress to a few KB as WebP.
//
// Source: somice/small/*.png (800px transparent cutouts). Output: somice/xs/*.webp.
// Skips the 44 mp4/webm animation files in small/ (PNG only).
//
// Usage (run from anywhere; sharp resolves from the repo's node_modules):
//   node somice/gen-xs.mjs                 # 384px, quality 82, skip existing
//   node somice/gen-xs.mjs --size 256      # different edge size
//   node somice/gen-xs.mjs --quality 80    # different WebP quality
//   node somice/gen-xs.mjs --src original  # downscale from original/ instead
//   node somice/gen-xs.mjs --force         # overwrite existing xs/ files
//
// 384px keeps the loader hero (~221px @1x, ~442px @2x) crisp; pills/cards need
// far less. See docs/features/timeline-loader/plan.md.

import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// --- args --------------------------------------------------------------------
const argv = process.argv.slice(2);
const getArg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const SIZE = Number(getArg('size', 384));
const QUALITY = Number(getArg('quality', 82));
const SRC_NAME = getArg('src', 'small');
const FORCE = argv.includes('--force');

const SRC_DIR = join(HERE, SRC_NAME);
const OUT_DIR = join(HERE, 'xs');

if (!existsSync(SRC_DIR)) {
  console.error(`source folder not found: ${SRC_DIR}`);
  process.exit(1);
}
if (!Number.isFinite(SIZE) || SIZE < 16) {
  console.error(`bad --size: ${getArg('size', '')}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

// --- run ---------------------------------------------------------------------
const pngs = readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
console.log(
  `gen-xs: ${pngs.length} PNGs in ${SRC_NAME}/ -> ${SIZE}px WebP (q${QUALITY}) in xs/` +
  `${FORCE ? ' [force]' : ' [skip existing]'}`
);

let done = 0, skipped = 0, failed = 0, srcBytes = 0, outBytes = 0;

for (const file of pngs) {
  const slug = basename(file, '.png');
  const src = join(SRC_DIR, file);
  const out = join(OUT_DIR, `${slug}.webp`);

  if (!FORCE && existsSync(out)) { skipped++; continue; }

  try {
    // fit:inside preserves the square aspect and never upscales past the source;
    // alpha is kept so the cutout stays transparent.
    await sharp(src)
      .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY, alphaQuality: 100 })
      .toFile(out);
    srcBytes += statSync(src).size;
    outBytes += statSync(out).size;
    done++;
    if (done % 100 === 0) console.log(`  ...${done} written`);
  } catch (e) {
    failed++;
    console.warn(`  FAILED ${file}: ${e.message}`);
  }
}

const mb = (b) => (b / 1048576).toFixed(1);
console.log(
  `\ndone: ${done} written, ${skipped} skipped, ${failed} failed\n` +
  (done
    ? `source ${mb(srcBytes)} MB -> xs ${mb(outBytes)} MB ` +
      `(${(srcBytes / Math.max(outBytes, 1)).toFixed(1)}x smaller, avg ${(outBytes / done / 1024).toFixed(1)} KB/img)`
    : '')
);

#!/usr/bin/env node
// Generate somice/discoveries/{xs,thumb}/<slug>.webp from the 1024px cut-out masters in
// discoveries/original/. Sibling of gen-xs.mjs, with two edges because the app shows a
// discovery's art at two very different sizes:
//   xs    -> 512px  (the disc at the top of the discovery modal, up to 220px on screen)
//   thumb -> 128px  (the suggestion rows' thumbnails, 36px on screen)
// `type-<output>.png` masters are the twelve per-type emblems (the fallback for every
// discovery with no art of its own); everything else is one discovery by slug.
//
// Usage:
//   node somice/gen-discovery-xs.mjs            # skip existing
//   node somice/gen-discovery-xs.mjs --force    # rebuild everything
//   node somice/gen-discovery-xs.mjs --quality 80

import sharp from 'sharp'
import { readdirSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, 'discoveries')
const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const QUALITY = Number(arg('quality', 82))
const FORCE = argv.includes('--force')
const SIZES = { xs: 512, thumb: 128 }

const src = join(ROOT, 'original')
if (!existsSync(src)) { console.error(`not found: ${src}`); process.exit(1) }
const pngs = readdirSync(src).filter((f) => f.toLowerCase().endsWith('.png'))

let done = 0, skipped = 0, failed = 0, srcB = 0, outB = 0
for (const [edge, px] of Object.entries(SIZES)) {
  const out = join(ROOT, edge)
  mkdirSync(out, { recursive: true })
  for (const file of pngs) {
    const dst = join(out, `${basename(file, '.png')}.webp`)
    if (!FORCE && existsSync(dst)) { skipped++; continue }
    try {
      await sharp(join(src, file))
        .resize(px, px, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY, alphaQuality: 100 })
        .toFile(dst)
      srcB += statSync(join(src, file)).size; outB += statSync(dst).size; done++
    } catch (e) { failed++; console.warn(`  FAILED ${edge}/${file}: ${e.message}`) }
  }
}
const mb = (b) => (b / 1048576).toFixed(1)
console.log(`done: ${done} written, ${skipped} skipped, ${failed} failed`)
if (done) console.log(`original ${mb(srcB)} MB -> webp ${mb(outB)} MB (avg ${(outB / done / 1024).toFixed(1)} KB)`)

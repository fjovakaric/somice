#!/usr/bin/env node
// Generate somice/lifeforms/<world>/xs/<slug>-<view>.webp from the 1024px cutout masters in
// lifeforms/<world>/original/. Sibling of gen-xs.mjs, but per-world and view-aware.
//
// The two views are used at very different sizes in the app, so they get different edges:
//   -body  -> 640px  (the full creature, shown large on cards and detail views)
//   -head  -> 256px  (the wheel/roster node, never shown big)
//
// Usage:
//   node somice/gen-lifeform-xs.mjs                  # all worlds, skip existing
//   node somice/gen-lifeform-xs.mjs --force          # rebuild everything
//   node somice/gen-lifeform-xs.mjs --world cats     # one world only
//   node somice/gen-lifeform-xs.mjs --quality 80

import sharp from 'sharp'
import { readdirSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, 'lifeforms')
const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const QUALITY = Number(arg('quality', 82))
const ONLY = arg('world', null)
const FORCE = argv.includes('--force')
const SIZES = { body: 640, head: 256 }

if (!existsSync(ROOT)) { console.error(`not found: ${ROOT}`); process.exit(1) }
const worlds = readdirSync(ROOT).filter((w) => existsSync(join(ROOT, w, 'original')) && (!ONLY || w === ONLY))
if (!worlds.length) { console.error(ONLY ? `no such world: ${ONLY}` : 'no worlds found'); process.exit(1) }

let done = 0, skipped = 0, failed = 0, srcB = 0, outB = 0
for (const w of worlds) {
  const src = join(ROOT, w, 'original'), out = join(ROOT, w, 'xs')
  mkdirSync(out, { recursive: true })
  const pngs = readdirSync(src).filter((f) => f.toLowerCase().endsWith('.png'))
  let n = 0
  for (const file of pngs) {
    const slug = basename(file, '.png')
    const view = slug.endsWith('-head') ? 'head' : 'body'
    const dst = join(out, `${slug}.webp`)
    if (!FORCE && existsSync(dst)) { skipped++; continue }
    try {
      await sharp(join(src, file))
        .resize(SIZES[view], SIZES[view], { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY, alphaQuality: 100 })
        .toFile(dst)
      srcB += statSync(join(src, file)).size; outB += statSync(dst).size; done++; n++
    } catch (e) { failed++; console.warn(`  FAILED ${w}/${file}: ${e.message}`) }
  }
  console.log(`  ${w.padEnd(9)} ${String(n).padStart(3)} written`)
}
const mb = (b) => (b / 1048576).toFixed(1)
console.log(`\ndone: ${done} written, ${skipped} skipped, ${failed} failed`)
if (done) console.log(`original ${mb(srcB)} MB -> xs ${mb(outB)} MB (${(srcB / Math.max(outB, 1)).toFixed(1)}x smaller, avg ${(outB / done / 1024).toFixed(1)} KB)`)

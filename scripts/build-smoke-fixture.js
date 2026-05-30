#!/usr/bin/env node

/**
 * build-smoke-fixture.js — regenerate font-assets/_smoke/ (the Node text-test
 * fixture) locally from the downloaded WebP font-assets release.
 *
 * WHY THIS EXISTS
 *   Node has no WebP decoder, so the Node text tests load atlases as QOI. Rather
 *   than depend on a separate upstream "smoke zip" release artifact, we DERIVE
 *   the Node fixture from the standard WebP release — the same one the browser
 *   demo uses. The atlas WebP are lossless VP8L 1-bit coverage masks, so the
 *   WebP→QOI transcode is byte-exact. This makes vendor/bitmaptext-release.pin
 *   the single source of truth for BOTH browser (WebP) and Node (QOI) text
 *   assets, and removes the smoke-zip artifact + its separate download path.
 *
 * WHEN TO RUN  (authoring-time, maintainer only — the OUTPUT is committed)
 *   - after bumping the font-assets baseline, or
 *   - after editing font-assets/_smoke/smoke-set.json (the fixture spec).
 *   Review the diff, then commit. `npm test` / CI consume the committed files
 *   and never run this.
 *
 * PIPELINE  (mirrors upstream watch-font-assets.sh so output is byte-identical
 *            to what a release would ship)
 *   atlas:  font-assets/atlas-<id>.webp
 *             --[ dwebp -pam ]-->            raw RGBA
 *             --[ lib/QOIEncode {channels:4, colorspace:0} ]--> QOI bytes
 *             --[ base64 ]-->                BitmapText.a(d,"fam",sIdx,wIdx,size,"<b64>");
 *           (no trailing newline — the upstream pipeline terser-minifies these,
 *            which normalises quotes to " and strips the newline; we emit that
 *            form directly so there is no terser dependency.)
 *   bundle: font-assets/{metrics-bundle,positioning-bundle-density-N}.js
 *             --[ extract base64 → inflateRaw → JSON ]-->  full record set
 *             --[ filter to the spec's fonts ]-->          subset
 *             --[ deflateRaw level 9 → base64 ]-->         BitmapText.rBundle('<b64>');\n
 *                                                          BitmapText.pBundle(d,'<b64>');\n
 *           (bundles keep the build-smoke-set.js wrapper form: single quotes +
 *            trailing newline — they are written fresh, not terser-minified.)
 *
 * REQUIREMENTS
 *   - dwebp on PATH                 (`brew install webp`)
 *   - the full WebP release present (`npm run text:download-assets`).
 *     The release ships one monolithic font-assets-min.zip, not per-file
 *     assets, so there is nothing to fetch per-atlas; we read the unzipped set.
 *   - vendor/bitmaptext/lib/QOIEncode.js (present after any `npm run build`)
 *
 * Usage:
 *   node scripts/build-smoke-fixture.js
 *   node scripts/build-smoke-fixture.js --help
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FONT_ASSETS = path.join(PROJECT_ROOT, 'font-assets');
const SMOKE_DIR = path.join(FONT_ASSETS, '_smoke');
const SPEC_PATH = path.join(SMOKE_DIR, 'smoke-set.json');
const QOI_ENCODE_PATH = path.join(PROJECT_ROOT, 'vendor', 'bitmaptext', 'lib', 'QOIEncode.js');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    // The block comment above is the canonical reference; keep this terse.
    console.log('Regenerate font-assets/_smoke/ from the downloaded WebP release.');
    console.log('Usage: node scripts/build-smoke-fixture.js');
    console.log('Needs: dwebp (brew install webp), font-assets/ (npm run text:download-assets),');
    console.log('       vendor/bitmaptext/lib/QOIEncode.js (npm run build).');
    process.exit(0);
}

function fail(msg) {
    console.error(`build-smoke-fixture: ${msg}`);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Load QOIEncode in a vm sandbox (same loader pattern as upstream
// scripts/webp-to-qoi-converter.js — the lib is plain ES5 with no Node deps).
// ---------------------------------------------------------------------------
if (!fs.existsSync(QOI_ENCODE_PATH)) {
    fail(`QOIEncode.js not found at ${QOI_ENCODE_PATH}. Run \`npm run build\` first (it vendors lib/QOIEncode.js).`);
}
const qoiCtx = {
    console,
    TextEncoder: global.TextEncoder || require('util').TextEncoder,
    Uint8Array, Uint8ClampedArray, ArrayBuffer, Math, String, Object, Error,
    global: {},
};
vm.createContext(qoiCtx);
vm.runInContext(fs.readFileSync(QOI_ENCODE_PATH, 'utf8') + '\nglobal.QOIEncode = QOIEncode;', qoiCtx);
const QOIEncode = qoiCtx.global.QOIEncode;
if (typeof QOIEncode !== 'function') fail('QOIEncode failed to load.');

// dwebp probe (decode is via libwebp directly — no canvas premultiply round-trip).
if (spawnSync('dwebp', ['-version'], { encoding: 'utf8' }).status !== 0) {
    fail('dwebp not found in PATH. Install with: brew install webp');
}

// ---------------------------------------------------------------------------
// Spec → wanted atlases + per-density / metrics record keys
//   idString  : density-<d>-<family>-style-<style>-weight-<weight>-size-<size>
//   recordKey : family|styleIdx|weightIdx|size   (matches build-smoke-set.js)
// ---------------------------------------------------------------------------
if (!fs.existsSync(SPEC_PATH)) fail(`spec missing: ${SPEC_PATH}`);
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));

// "1"→"1-0", "16"→"16-0", "16.5"→"16-5" — the on-disk numeric encoding.
const fmtNum = (n) => {
    const i = Math.trunc(n);
    const frac = Math.round((n - i) * 10);
    return `${i}-${frac}`;
};
const styleToIdx = (s) => (s === 'normal' ? 0 : s === 'italic' ? 1 : 2);
const weightToIdx = (w) => (w === 'normal' ? 0 : w === 'bold' ? 1 : parseInt(w, 10));
const recordKey = (family, styleIdx, weightIdx, size) => `${family}|${styleIdx}|${weightIdx}|${size}`;

const wantedAtlases = [];               // { idString, density, family, styleIdx, weightIdx, size }
const wantedByDensity = new Map();      // density -> Set(recordKey)
const wantedMetrics = new Set();        // recordKey (density-agnostic)

for (const set of spec.fontSets) {
    for (const density of set.density) {
        for (const family of set.families) {
            for (const style of set.styles) {
                for (const weight of set.weights) {
                    for (const size of set.sizes) {
                        const styleIdx = styleToIdx(style);
                        const weightIdx = weightToIdx(weight);
                        const idString =
                            `density-${fmtNum(density)}-${family}` +
                            `-style-${style}-weight-${weight}-size-${fmtNum(size)}`;
                        wantedAtlases.push({ idString, density, family, styleIdx, weightIdx, size });
                        const key = recordKey(family, styleIdx, weightIdx, size);
                        wantedMetrics.add(key);
                        if (!wantedByDensity.has(density)) wantedByDensity.set(density, new Set());
                        wantedByDensity.get(density).add(key);
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Wipe the GENERATED files (keep smoke-set.json, the hand-maintained spec) so
// a removed font does not leave a stale atlas/bundle behind.
// ---------------------------------------------------------------------------
for (const f of fs.readdirSync(SMOKE_DIR)) {
    if (f === 'smoke-set.json') continue;
    if (/^atlas-.*-qoi\.js$/.test(f) || /^metrics-bundle\.js$/.test(f) || /^positioning-bundle-density-.*\.js$/.test(f)) {
        fs.unlinkSync(path.join(SMOKE_DIR, f));
    }
}

const missing = [];
const written = [];

// ---------------------------------------------------------------------------
// Atlases: WebP (lossless VP8L) → dwebp -pam → RGBA → QOIEncode → base64 shim.
// ---------------------------------------------------------------------------
for (const a of wantedAtlases) {
    const webpPath = path.join(FONT_ASSETS, `atlas-${a.idString}.webp`);
    if (!fs.existsSync(webpPath)) { missing.push(`atlas webp: ${path.basename(webpPath)}`); continue; }

    const dwebp = spawnSync('dwebp', ['-pam', webpPath, '-o', '-'],
        { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
    if (dwebp.status !== 0) {
        missing.push(`dwebp failed: ${path.basename(webpPath)} (${dwebp.stderr ? dwebp.stderr.toString() : 'unknown'})`);
        continue;
    }

    // Parse the PAM header (ASCII, terminated by "ENDHDR\n"); body is W*H*4 RGBA.
    const pam = dwebp.stdout;
    const term = Buffer.from('ENDHDR\n', 'ascii');
    const hdrEnd = pam.indexOf(term);
    if (hdrEnd < 0) { missing.push(`PAM header missing ENDHDR: ${path.basename(webpPath)}`); continue; }
    const bodyStart = hdrEnd + term.length;
    const hdr = pam.slice(0, hdrEnd).toString('ascii');
    const width = parseInt((hdr.match(/WIDTH (\d+)/) || [])[1], 10);
    const height = parseInt((hdr.match(/HEIGHT (\d+)/) || [])[1], 10);
    const expected = width * height * 4;
    if (!(width > 0) || !(height > 0) || pam.length - bodyStart !== expected) {
        missing.push(`PAM body length mismatch: ${path.basename(webpPath)}`);
        continue;
    }
    const rgba = new Uint8Array(pam.buffer, pam.byteOffset + bodyStart, expected);

    const qoi = QOIEncode(rgba, { width, height, channels: 4, colorspace: 0 });
    const b64 = Buffer.from(qoi).toString('base64');

    // Terser-minified form: double-quoted base64, NO trailing newline.
    const shim = `BitmapText.a(${a.density},"${a.family}",${a.styleIdx},${a.weightIdx},${a.size},"${b64}");`;
    const outName = `atlas-${a.idString}-qoi.js`;
    fs.writeFileSync(path.join(SMOKE_DIR, outName), shim);
    written.push(outName);
}

// ---------------------------------------------------------------------------
// Bundle subsets (records carry [family, styleIdx, weightIdx, size, ...]).
// inflateRaw the full bundle, keep the spec's records, deflateRaw (level 9) the
// subset. Wrapper form matches build-smoke-set.js: single quotes + trailing \n.
// ---------------------------------------------------------------------------
const keyOf = (rec) => recordKey(rec[0], rec[1], rec[2], rec[3]);
const decodeB64 = (b64) => JSON.parse(zlib.inflateRawSync(Buffer.from(b64, 'base64')).toString('utf8'));
const encodeObj = (obj) => zlib.deflateRawSync(Buffer.from(JSON.stringify(obj), 'utf8'), { level: 9 }).toString('base64');

// metrics-bundle.js: BitmapText.rBundle('<b64>');
{
    const src = path.join(FONT_ASSETS, 'metrics-bundle.js');
    if (!fs.existsSync(src)) {
        missing.push('metrics-bundle.js');
    } else {
        const m = fs.readFileSync(src, 'utf8').match(/rBundle\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/);
        if (!m) { missing.push('metrics-bundle.js: could not extract rBundle base64'); }
        else {
            const env = decodeB64(m[1]);
            const kept = env.records.filter(r => wantedMetrics.has(keyOf(r)));
            const found = new Set(kept.map(keyOf));
            for (const k of wantedMetrics) if (!found.has(k)) missing.push(`metrics record: ${k}`);
            const b64 = encodeObj({ formatVersion: env.formatVersion, records: kept });
            fs.writeFileSync(path.join(SMOKE_DIR, 'metrics-bundle.js'), `BitmapText.rBundle('${b64}');\n`);
            written.push(`metrics-bundle.js (${kept.length} records)`);
        }
    }
}

// positioning-bundle-density-<d>.js: BitmapText.pBundle(<d>,'<b64>');
for (const [density, wantedKeys] of wantedByDensity) {
    const src = path.join(FONT_ASSETS, `positioning-bundle-density-${density}.js`);
    if (!fs.existsSync(src)) { missing.push(`positioning-bundle-density-${density}.js`); continue; }
    const m = fs.readFileSync(src, 'utf8').match(/pBundle\(\s*([0-9.]+)\s*,\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/);
    if (!m) { missing.push(`positioning-bundle-density-${density}.js: could not extract pBundle base64`); continue; }
    const env = decodeB64(m[2]);
    const kept = env.records.filter(r => wantedKeys.has(keyOf(r)));
    const found = new Set(kept.map(keyOf));
    for (const k of wantedKeys) if (!found.has(k)) missing.push(`positioning d=${density} record: ${k}`);
    const b64 = encodeObj({ formatVersion: env.formatVersion, density: env.density, records: kept });
    const outName = `positioning-bundle-density-${density}.js`;
    fs.writeFileSync(path.join(SMOKE_DIR, outName), `BitmapText.pBundle(${env.density},'${b64}');\n`);
    written.push(`${outName} (${kept.length} records)`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (missing.length) {
    console.error('build-smoke-fixture: missing/failed items:');
    for (const x of missing) console.error(`  - ${x}`);
    console.error('Aborting. Ensure font-assets/ is the full release (npm run text:download-assets)');
    console.error('and that the spec only lists fonts present at the pinned baseline.');
    process.exit(1);
}

console.log('Regenerated font-assets/_smoke/ from the WebP release:');
for (const w of written) console.log(`  ${w}`);
console.log(`  (spec: ${path.relative(PROJECT_ROOT, SPEC_PATH)} — hand-maintained, left untouched)`);

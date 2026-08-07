// A/B sweep: hash the direct circle renders across a parameter grid.
// Covers fillCircle, strokeCircle (1px + thick), fillStrokeCircle — opaque and
// alpha — at integer / half-integer / fractional centers and radii, including
// partially off-surface geometry. NO clipping anywhere: the tier-0 wiring's
// contract is that unclipped output is byte-identical by construction, so run
// once at the pinned build (baseline) and once after a rasterizer change and
// diff the JSON to get the exact behavioral blast radius.
//
//   node debug/sweep-circle-hashes.js /tmp/baseline.json   (against old dist)
//   node debug/sweep-circle-hashes.js /tmp/after.json      (against new dist)
//   diff /tmp/baseline.json /tmp/after.json
//
// To run against a saved dist: SWCANVAS_DIST=/path/to/swcanvas.js node ...
const crypto = require('crypto');
const SWCanvas = require(process.env.SWCANVAS_DIST || '../dist/swcanvas.js');

const W = 70,
    H = 60;

function render(draw) {
    const canvas = SWCanvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, W, H);
    draw(ctx);
    const img = ctx.getImageData(0, 0, W, H);
    return crypto.createHash('sha256').update(Buffer.from(img.data.buffer)).digest('hex').slice(0, 16);
}

const out = {};
const centers = [
    [30, 30],
    [30.5, 30.5],
    [30.25, 29.75],
    [-4, 30], // partially off left (exercises span clamping)
    [30, 57] // partially off bottom
];
const radii = [1, 3, 8, 8.5, 12.75, 28];
const alphas = [1.0, 0.5];

for (const alpha of alphas) {
    const fillStyle = alpha === 1 ? 'rgb(255,0,0)' : 'rgba(255,0,0,0.5)';
    const strokeStyle = alpha === 1 ? 'rgb(0,0,255)' : 'rgba(0,0,255,0.5)';
    for (const [cx, cy] of centers) {
        for (const r of radii) {
            out[`fill_a${alpha}_c${cx},${cy}_r${r}`] = render(ctx => {
                ctx.fillStyle = fillStyle;
                ctx.fillCircle(cx, cy, r);
            });
            for (const lw of [1, 4, 6.5]) {
                out[`stroke_a${alpha}_c${cx},${cy}_r${r}_lw${lw}`] = render(ctx => {
                    ctx.strokeStyle = strokeStyle;
                    ctx.lineWidth = lw;
                    ctx.strokeCircle(cx, cy, r);
                });
            }
            out[`fillstroke_a${alpha}_c${cx},${cy}_r${r}`] = render(ctx => {
                ctx.fillStyle = fillStyle;
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = 4;
                ctx.fillStrokeCircle(cx, cy, r);
            });
        }
    }
}

const file = process.argv[2] || 'debug/sweep-circle-baseline.json';
require('fs').writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`wrote ${Object.keys(out).length} hashes to ${file}`);

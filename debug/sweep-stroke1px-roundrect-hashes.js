// A/B sweep: hash strokeRoundRect 1px renders across a parameter grid.
// Run once at the pinned build (baseline) and once after a rasterizer change;
// diff the JSON to get the exact behavioral blast radius.
const crypto = require('crypto');
const SWCanvas = require('../dist/swcanvas.js');

const out = {};
for (const alpha of [1.0, 0.5]) {
    for (const x of [10, 10.5, 10.25]) {
        for (const y of [8, 8.5]) {
            for (const [w, h] of [[28, 22], [29, 23], [9, 7], [60, 8]]) {
                for (const r of [1, 2, 3, 5, 10]) {
                    const canvas = SWCanvas.createCanvas(90, 60);
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, 90, 60);
                    ctx.strokeStyle = alpha === 1 ? 'rgb(255,0,0)' : 'rgba(255,0,0,0.5)';
                    ctx.lineWidth = 1;
                    ctx.strokeRoundRect(x, y, w, h, r);
                    const img = ctx.getImageData(0, 0, 90, 60);
                    const hash = crypto.createHash('sha256').update(Buffer.from(img.data.buffer)).digest('hex').slice(0, 16);
                    out[`a${alpha}_x${x}_y${y}_w${w}h${h}_r${r}`] = hash;
                }
            }
        }
    }
}
const file = process.argv[2] || 'debug/sweep-baseline.json';
require('fs').writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`wrote ${Object.keys(out).length} hashes to ${file}`);

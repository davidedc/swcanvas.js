// Probe 2: full-shape comparison — fast path (integer vs half-integer) vs the
// generic path pipeline (four arcs, Fizzygum-style) on the same geometry.
const SWCanvas = require('../dist/swcanvas.js');

function newCtx() {
    const canvas = SWCanvas.createCanvas(60, 50);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 60, 50);
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.lineWidth = 1;
    return ctx;
}

function dump(label, ctx) {
    const img = ctx.getImageData(0, 0, 60, 50);
    console.log(`\n${label}:`);
    for (let y = 4; y < 34; y++) {
        let row = '';
        for (let x = 6; x < 46; x++) {
            const i = (y * 60 + x) * 4;
            row += img.data[i] === 255 && img.data[i + 1] === 0 ? '#' : '.';
        }
        console.log(String(y).padStart(3) + ' ' + row);
    }
}

const r = 5;

// (a) fast path, integer geometry
let ctx = newCtx();
ctx.strokeRoundRect(10, 8, 28, 22, r);
dump('FAST integer (10, 8, 28, 22, r=5)', ctx);

// (b) fast path, half-integer geometry (crisp pixel-centered idiom)
ctx = newCtx();
ctx.strokeRoundRect(10.5, 8.5, 28, 22, r);
dump('FAST half-integer (10.5, 8.5, 28, 22, r=5)', ctx);

// (c) generic path pipeline, same half-integer geometry, Fizzygum's 4-arc idiom
ctx = newCtx();
ctx.beginPath();
const x = 10.5, y = 8.5, w = 28, h = 22;
ctx.arc(x + r, y + r, r, -Math.PI, -Math.PI / 2);
ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
ctx.closePath();
ctx.stroke();
dump('GENERIC 4-arc path, half-integer (same geometry)', ctx);

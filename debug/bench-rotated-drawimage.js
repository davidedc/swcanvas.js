#!/usr/bin/env node
// Micro-benchmark for the transformed-drawImage sampling change (NN -> bilinear
// on non-axis-aligned transforms). The direct-rendering perf cases never call
// drawImage, so benchmark-session.js is blind to this path by construction —
// this measures the rotated composite (a Fizzygum island drag's hot path)
// directly. Usage:
//   node debug/bench-rotated-drawimage.js [path-to-dist]   (default ../dist/swcanvas.js)
const path = require('path');
const distPath = process.argv[2] || path.join(__dirname, '..', 'dist', 'swcanvas.js');
const SWCanvas = require(path.resolve(distPath));

// island-composite-like workload: a 400x300 buffer warped onto an 800x600 surface
const SRCW = 400, SRCH = 300;
const src = SWCanvas.createCanvas(SRCW, SRCH);
const sctx = src.getContext('2d');
sctx.fillStyle = 'rgb(240,240,240)';
sctx.fillRect(0, 0, SRCW, SRCH);
sctx.fillStyle = 'rgb(70,130,210)';
for (let i = 0; i < 30; i++) sctx.fillRect((i * 37) % 350, (i * 53) % 260, 40, 30);

const dst = SWCanvas.createCanvas(800, 600);
const ctx = dst.getContext('2d');

function onceRotated(angle) {
  return function () {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 800, 600);
    ctx.translate(150.37, 60.61);
    ctx.rotate(angle);
    ctx.drawImage(src, 0, 0);
  };
}

// axis-aligned rect-scaled composite (Fizzygum's _compositeScaleOnly shape:
// identity-ish CTM, differing src/dst rects) — the D2 scale-smoothing hot path
function onceScaledRect(factor) {
  return function () {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 800, 600);
    ctx.drawImage(src, 0, 0, SRCW, SRCH, 20, 15,
      Math.round(SRCW * factor), Math.round(SRCH * factor));
  };
}

// warmup
for (let i = 0; i < 5; i++) onceRotated(Math.PI / 6)();
for (let i = 0; i < 5; i++) onceScaledRect(1.5)();

const RUNS = 30;
function bench(label, fn) {
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    const t1 = process.hrtime.bigint();
    times.push(Number(t1 - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(RUNS / 2)];
  console.log(label + ': median ' + median.toFixed(2) + ' ms  (min ' +
    times[0].toFixed(2) + ', max ' + times[RUNS - 1].toFixed(2) + ')');
  return median;
}

console.log('dist: ' + distPath);
bench('rotated 30 deg    (bilinear path)  ', onceRotated(Math.PI / 6));
bench('axis-aligned 0deg (step-1 NN path) ', onceRotated(0));
bench('scaled x2   rect  (island scale)   ', onceScaledRect(2));
bench('scaled x1.5 rect  (island scale)   ', onceScaledRect(1.5));
bench('scaled x0.5 rect  (downscale)      ', onceScaledRect(0.5));

/**
 * Node renderer for the fox scene (SW3D engine acceptance demo).
 *
 * Usage:
 *   node examples/3d-fox-node.js [output.png] [width] [height] [timeSeconds]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const SWCanvas = require('../dist/swcanvas.js');
const SW3D = require('./sw3d.js');
const GryphonModels = require('./gryphon-models.js');
const { makeFoxScene } = require('./3d-fox-scene.js');

const outPath = process.argv[2] || path.join(__dirname, '3d-fox.png');
const width = parseInt(process.argv[3], 10) || 800;
const height = parseInt(process.argv[4], 10) || 600;
const t = process.argv[5] !== undefined ? parseFloat(process.argv[5]) : 2.0;

const surface = SWCanvas.Core.Surface(width, height);
const depthBuffer = new SWCanvas.Core.DepthBuffer(width, height);
const scene = makeFoxScene(SWCanvas, SW3D, GryphonModels, width, height);

const tris = scene.render(surface, depthBuffer, t);
const pngData = SWCanvas.Core.PngEncoder.encode(surface);
fs.writeFileSync(outPath, Buffer.from(pngData));
console.log(`Wrote ${outPath} (${width}x${height}, ${tris} triangles at t=${t})`);

// Rough timing across an orbit (includes close passes with heavy clipping)
const FRAMES = 200;
const t0 = process.hrtime.bigint();
let total = 0;
for (let i = 0; i < FRAMES; i++) {
    total += scene.render(surface, depthBuffer, i / 20);
}
const t1 = process.hrtime.bigint();
const msPerFrame = Number(t1 - t0) / 1e6 / FRAMES;
console.log(
    `~${msPerFrame.toFixed(3)} ms/frame over ${FRAMES} frames (${width}x${height}, avg ${Math.round(total / FRAMES)} tris/frame)`
);

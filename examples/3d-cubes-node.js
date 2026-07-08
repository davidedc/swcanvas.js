/**
 * Node renderer for the interpenetrating-cubes 3D demo.
 *
 * Renders one frame of the DepthBuffer + Triangle3DOps demo scene to a PNG,
 * then reports a rough rasterization timing over a batch of frames.
 *
 * Usage:
 *   node examples/3d-cubes-node.js [output.png] [width] [height]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const SWCanvas = require('../dist/swcanvas.js');
const { makeCubesScene } = require('./3d-cubes-scene.js');

const outPath = process.argv[2] || path.join(__dirname, '3d-cubes.png');
const width = parseInt(process.argv[3], 10) || 800;
const height = parseInt(process.argv[4], 10) || 600;

const surface = SWCanvas.Core.Surface(width, height);
const depthBuffer = new SWCanvas.Core.DepthBuffer(width, height);
const scene = makeCubesScene(SWCanvas, width, height);

// Render the frame we save (angle chosen so the interpenetration is obvious)
scene.render(surface, depthBuffer, 0.9);

const pngData = SWCanvas.Core.PngEncoder.encode(surface);
fs.writeFileSync(outPath, Buffer.from(pngData));
console.log(`Wrote ${outPath} (${width}x${height})`);

// Rough timing: full frames (clear + transform + light + rasterize)
const FRAMES = 200;
const t0 = process.hrtime.bigint();
for (let i = 0; i < FRAMES; i++) {
    scene.render(surface, depthBuffer, i / 60);
}
const t1 = process.hrtime.bigint();
const msPerFrame = Number(t1 - t0) / 1e6 / FRAMES;
console.log(`~${msPerFrame.toFixed(3)} ms/frame over ${FRAMES} frames (${width}x${height}, 2 cubes)`);

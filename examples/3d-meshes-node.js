/**
 * Node witness for the SW3D mesh helpers and the two drawMesh gap fixes.
 *
 * Exercises SW3D.makeBoxMesh / makeSphereMesh and asserts:
 *   - gap 1 (bounding-sphere radius scaled by the model matrix): a unit box
 *     placed far off-axis is bounding-sphere rejected, but the SAME box under
 *     a 3x scale survives the reject and emits triangles;
 *   - gap 2 (winding preserved under a mirror / negative-determinant matrix):
 *     a box whose front face is red stays red when x-mirrored — without the
 *     fix the front face is wrongly culled and the blue back face shows through.
 *
 * Usage: node examples/3d-meshes-node.js   (exit 0 = all witnesses passed)
 */
'use strict';

const assert = require('assert');
const SWCanvas = require('../dist/swcanvas.js');
const SW3D = require('./sw3d.js');

const W = 120;
const H = 120;
const surface = SWCanvas.Core.Surface(W, H);
const depth = new SWCanvas.Core.DepthBuffer(W, H);
const engine = SW3D.makeEngine(SWCanvas, { width: W, height: H });
engine.setCamera([0, 0, -5], 0);

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function clear() {
    surface.data32.fill(engine.packColor(0, 0, 0)); // opaque black background
    depth.clear();
}

function centerPixel() {
    const i = ((H >> 1) * W + (W >> 1)) * 4;
    return [surface.data[i], surface.data[i + 1], surface.data[i + 2]];
}

// ---- gap 1: matrix-scaled bounding radius ------------------------------------
const box = SW3D.makeBoxMesh(1, [200, 200, 200]);
const SCALE3 = [3, 0, 0, 0, 3, 0, 0, 0, 3];

clear();
const emittedUnit = engine.drawMesh(surface, depth, box, [5, 0, 0], IDENTITY);
clear();
const emittedScaled = engine.drawMesh(surface, depth, box, [5, 0, 0], SCALE3);

assert.strictEqual(emittedUnit, 0, 'gap1: a unit box far off-axis must be bounding-sphere rejected');
assert.ok(emittedScaled > 0, 'gap1: the same box scaled 3x must survive the reject (radius scaled by the matrix)');
console.log(`gap1 OK: off-axis unit box emitted ${emittedUnit}, scaled box emitted ${emittedScaled}`);

// ---- gap 2: winding preserved under a mirror matrix --------------------------
// Front (-z) face red, the other five blue. The camera at [0,0,-5] looks along
// +z, so the -z face is the one facing the camera.
const CORNERS = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
];
const FACES = [
    [0, 3, 2, 1], // front (-z)
    [4, 5, 6, 7], // back  (+z)
    [0, 4, 7, 3], // left  (-x)
    [1, 2, 6, 5], // right (+x)
    [3, 7, 6, 2], // top   (+y)
    [0, 1, 5, 4] //  bottom (-y)
];
const RED = [230, 40, 40];
const BLUE = [40, 40, 230];
const positions = [];
for (let i = 0; i < CORNERS.length; i++) {
    positions.push(CORNERS[i][0] * 0.5, CORNERS[i][1] * 0.5, CORNERS[i][2] * 0.5);
}
const faces = FACES.map((v, idx) => ({ v: v, color: idx === 0 ? RED : BLUE }));
const colorBox = SW3D.makeMesh({ positions: positions, faces: faces });

clear();
engine.drawMesh(surface, depth, colorBox, [0, 0, 0], IDENTITY);
const pNormal = centerPixel();

clear();
const MIRROR_X = [-1, 0, 0, 0, 1, 0, 0, 0, 1];
engine.drawMesh(surface, depth, colorBox, [0, 0, 0], MIRROR_X);
const pMirror = centerPixel();

assert.ok(pNormal[0] > pNormal[2] + 20, `gap2: normal box centre should be red, got ${pNormal}`);
assert.ok(pMirror[0] > pMirror[2] + 20, `gap2: mirrored box centre must STAY red (outward winding preserved), got ${pMirror}`);
console.log(`gap2 OK: front face stays red under mirror (normal ${pNormal}, mirror ${pMirror})`);

// ---- sphere helper sanity ----------------------------------------------------
const sphere = SW3D.makeSphereMesh(0.6, 12, 8, [100, 200, 100]);
clear();
const sphereEmitted = engine.drawMesh(surface, depth, sphere, [0, 0, 0], IDENTITY);
clear();
const sphereMirrored = engine.drawMesh(surface, depth, sphere, [0, 0, 0], MIRROR_X);
assert.ok(sphereEmitted > 0, 'sphere: must emit triangles');
assert.ok(sphereMirrored > 0, 'sphere: must emit triangles under mirror too');
console.log(`sphere OK: emitted ${sphereEmitted} (normal), ${sphereMirrored} (mirror)`);

console.log('3d-meshes-node: all mesh-helper + gap witnesses passed');

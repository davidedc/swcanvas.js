/**
 * Node witness for the SW3D triangle-mesh path: makeTriMesh, drawTriMesh
 * (colour / id / depth modes, perspective and orthographic), resolve(), the
 * shadow transform, normal-cone culling and near-plane clipping.
 *
 * Asserts:
 *   - GL conventions: a counter-clockwise triangle on the camera's right
 *     appears on the right of the image and is front-facing; the clockwise
 *     copy is culled (drawn with cull 'none');
 *   - id mode packs (faceId << 6) | N.L, with N.L = 1 -> 63, -1 -> 0;
 *   - resolve maps ids to the palette's lit / shadow colours, fills the
 *     background, and outlines silhouettes; the night side of a spherical
 *     world takes the night colours;
 *   - a box above a ground plane casts a shadow (via an orthographic depth
 *     pass and shadowTransformTo) on the ground below it, and not elsewhere;
 *   - a mesh facing away is rejected whole by its normal cone;
 *   - a triangle crossing the near plane is clipped, not dropped;
 *   - a mirrored model keeps its front faces;
 *   - drawSprites: a card covers its (rotated) square, the mask cuts it,
 *     id mode stores the value and the normal's N.L, cull, depth test and
 *     push, orthographic size, mask levels, the set's bounding sphere;
 *     palette.noDepthEdges
 *     drops the outline
 *     between overlapping cards of one group;
 *   - drawDome paints a field on a sphere around the camera where it reaches
 *     the threshold, from the far side of the sphere, only on empty pixels;
 *   - resolve's surface option shades flagged entries per pixel from the
 *     surface point and the scene behind it, with no outline at their edges.
 * Writes examples/3d-trimesh.png (a small toon scene) for eyeballing.
 *
 * Usage: node examples/3d-trimesh-node.js [output.png]   (exit 0 = passed)
 */
'use strict';

globalThis.__SWCANVAS_DEBUG__ = true; // arm Triangle3DOps' vertex-contract assertions

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SWCanvas = require('../dist/swcanvas.js');
const SW3D = require('./sw3d.js');

const W = 96;
const H = 72;
const surface = SWCanvas.Core.Surface(W, H);
const depth = new SWCanvas.Core.DepthBuffer(W, H);
const ids = new Uint32Array(W * H);
const idTarget = { width: W, height: H, data32: ids };
const engine = SW3D.makeEngine(SWCanvas, { width: W, height: H, znear: 0.1, ambient: 0.3, diffuse: 0.7 });
const BLACK = engine.packColor(0, 0, 0);

function clearAll() {
    surface.data32.fill(BLACK);
    ids.fill(0);
    depth.clear();
}
function rgbAt(x, y) {
    const i = (y * W + x) * 4;
    return [surface.data[i], surface.data[i + 1], surface.data[i + 2]];
}
function countNonBlack(x0, x1) {
    let n = 0;
    for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) if (surface.data32[y * W + x] !== BLACK) n++;
    return n;
}

// ---- GL orientation and culling ---------------------------------------------
engine.setView(SW3D.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]));
engine.setLightDir([0, 0, 1]);
const RED = engine.packColor(255, 0, 0);
const ccwRight = SW3D.makeTriMesh({
    positions: [0.5, -0.5, 0, 1.5, -0.5, 0, 1, 0.5, 0], // CCW seen from +z (the camera)
    indices: [0, 1, 2],
    faceColors: new Uint32Array([RED])
});
const cwRight = SW3D.makeTriMesh({ positions: ccwRight.positions, indices: [0, 2, 1], faceColors: new Uint32Array([RED]) });

clearAll();
assert.strictEqual(engine.drawTriMesh(surface, depth, ccwRight, null), 1, 'CCW triangle facing the camera is drawn');
assert.ok(countNonBlack(W / 2, W) > 20 && countNonBlack(0, W / 2) === 0, 'a triangle at +x appears on the right');
const lit = rgbAt(Math.round(W / 2 + 1 * (H * 1.1) / 5), Math.round(H / 2 + 0.1 * (H * 1.1) / 5));
assert.deepStrictEqual(lit, [255, 0, 0], `facing the light -> full intensity, got ${lit}`);
clearAll();
assert.strictEqual(engine.drawTriMesh(surface, depth, cwRight, null), 0, 'CW triangle is back-facing and culled');
assert.strictEqual(engine.drawTriMesh(surface, depth, cwRight, null, { cull: 'none' }), 1, "cull 'none' draws it");
assert.strictEqual(engine.drawTriMesh(surface, depth, ccwRight, null, { cull: 'front' }), 0, "cull 'front' drops front faces");
console.log('orientation + culling OK');

// ---- mirrored model keeps front faces ------------------------------------------
clearAll();
const MIRROR_X = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
assert.strictEqual(engine.drawTriMesh(surface, depth, ccwRight, MIRROR_X), 1, 'mirrored front face is still front-facing');
assert.ok(countNonBlack(0, W / 2) > 20 && countNonBlack(W / 2, W) === 0, 'the mirrored triangle appears on the left');
console.log('mirror OK');

// ---- id mode ---------------------------------------------------------------------
const quadFront = SW3D.makeTriMesh({
    positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
    indices: [0, 1, 2, 0, 2, 3],
    faceIds: new Uint32Array([7, 7])
});
clearAll();
engine.setLightDir([0, 0, 1]); // toward the camera: N.L = 1
engine.drawTriMesh(idTarget, depth, quadFront, null, { mode: 'id' });
let centre = ids[(H >> 1) * W + (W >> 1)];
assert.strictEqual(centre >>> 6, 7, 'id mode stores the face id');
assert.strictEqual(centre & 63, 63, 'N.L = 1 quantizes to 63');
clearAll();
engine.setLightDir([0, 0, -1]); // behind the quad: N.L = -1
engine.drawTriMesh(idTarget, depth, quadFront, null, { mode: 'id' });
centre = ids[(H >> 1) * W + (W >> 1)];
assert.strictEqual(centre & 63, 0, 'N.L = -1 quantizes to 0');
console.log('id mode OK');

// ---- resolve: palette, background, outline ------------------------------------------
const palette = {
    lit: new Uint32Array(8).fill(engine.packColor(200, 180, 60)),
    shadow: new Uint32Array(8).fill(engine.packColor(100, 70, 30)),
    threshold: new Uint8Array(8).fill(40),
    group: new Int32Array(8)
};
const SKY = engine.packColor(120, 190, 255);
const INK = engine.packColor(20, 20, 30);
SW3D.resolve(surface, ids, depth, engine, { palette, background: SKY });
assert.deepStrictEqual(rgbAt(W >> 1, H >> 1), [100, 70, 30], 'unlit face -> shadow colour');
assert.deepStrictEqual(rgbAt(1, 1), [120, 190, 255], 'empty pixel -> background');
const night = { ...palette, night: new Uint32Array(8).fill(engine.packColor(20, 25, 50)) };
clearAll();
engine.setLightDir([0, 0, 1]);
engine.drawTriMesh(idTarget, depth, quadFront, null, { mode: 'id' });
SW3D.resolve(surface, ids, depth, engine, { palette, background: SKY, outline: { color: INK } });
assert.deepStrictEqual(rgbAt(W >> 1, H >> 1), [200, 180, 60], 'lit face -> lit colour');
let inkCount = 0;
for (let i = 0; i < W * H; i++) if (surface.data32[i] === INK) inkCount++;
assert.ok(inkCount > 40, `silhouette outline drawn (${inkCount} px)`);
// a wider outline: each edge pixel also marks the 2 before it in its row and column
SW3D.resolve(surface, ids, depth, engine, { palette, background: SKY, outline: { color: INK, width: 3 } });
let wideInk = 0;
for (let i = 0; i < W * H; i++) if (surface.data32[i] === INK) wideInk++;
assert.ok(wideInk > inkCount * 2.5 && wideInk < inkCount * 3.5, `outline width 3 (${wideInk} px, against ${inkCount})`);
// night on a spherical world: the lit quad (world z = 0) seen from a sphere centred at z = -10
// has the light below its horizon for dir -z, above it for +z
SW3D.resolve(surface, ids, depth, engine, { palette: night, background: SKY, night: { center: [0, 0, -10], dir: [0, 0, -1], below: 0 } });
assert.deepStrictEqual(rgbAt(W >> 1, H >> 1), [20, 25, 50], 'light below the local horizon -> night colour, even when lit');
SW3D.resolve(surface, ids, depth, engine, { palette: night, background: SKY, night: { center: [0, 0, -10], dir: [0, 0, 1], below: 0 } });
assert.deepStrictEqual(rgbAt(W >> 1, H >> 1), [200, 180, 60], 'light above the local horizon -> lit colour');
// exp2 fog: the quad is 5 units away; f = 1 - exp(-(0.1 * 5)^2) = 0.2212
SW3D.resolve(surface, ids, depth, engine, { palette, background: SKY, fog: { color: [0, 0, 255], density: 0.1 } });
const fogged = rgbAt(W >> 1, H >> 1);
const f = 1 - Math.exp(-0.25);
assert.deepStrictEqual(fogged, [Math.floor(200 * (1 - f)), Math.floor(180 * (1 - f)), Math.floor(60 + (255 - 60) * f)], `exp2 fog, got ${fogged}`);
// outline fading: at 5 units, fadeNear 3 / fadeFar 7 gives half-strength ink; fadeFar 4 gives none
SW3D.resolve(surface, ids, depth, engine, { palette, background: SKY, outline: { color: INK, fadeNear: 3, fadeFar: 7 } });
let halfInk = 0;
for (let i = 0; i < W * H; i++) {
    const c = surface.data32[i];
    if (Math.abs((c & 255) - 110) <= 1 && Math.abs(((c >>> 8) & 255) - 100) <= 1 && Math.abs(((c >>> 16) & 255) - 45) <= 1) halfInk++;
}
assert.ok(halfInk > 40, `half-faded outline (${halfInk} px)`);
SW3D.resolve(surface, ids, depth, engine, { palette, background: SKY, outline: { color: INK, fadeNear: 3, fadeFar: 4 } });
for (let i = 0; i < W * H; i++) assert.notStrictEqual(surface.data32[i], INK, 'no outline beyond fadeFar');
console.log('resolve OK (palette, night side, background, outline, width, fog, fading)');

// ---- shadow map: a box above a ground plane --------------------------------------------
function box(cx, cy, cz, h, id) {
    const p = [];
    for (const [x, y, z] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
        p.push(cx + x * h, cy + y * h, cz + z * h);
    }
    // CCW seen from outside
    const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]];
    const idx = [];
    for (const [a, b, c, d] of quads) idx.push(a, b, c, a, c, d);
    return SW3D.makeTriMesh({ positions: p, indices: idx, faceIds: new Uint32Array(12).fill(id) });
}
const ground = SW3D.makeTriMesh({
    positions: [-6, 0, -6, -6, 0, 6, 6, 0, 6, 6, 0, -6], // CCW seen from above
    indices: [0, 1, 2, 0, 2, 3],
    faceIds: new Uint32Array([1, 1])
});
const block = box(0, 1.5, 0, 0.5, 2);

const LIGHT_DIR = [0, 1, 0]; // straight down: the shadow lands right under the box
engine.setView(SW3D.lookAt([0, 6, 7], [0, 0, 0], [0, 1, 0]));
engine.setLightDir(LIGHT_DIR);
const light = SW3D.makeEngine(SWCanvas, { width: 64, height: 64, projection: 'orthographic', orthoHalfHeight: 6, orthoFar: 100 });
light.setView(SW3D.lookAt([0, 20, 0], [0, 0, 0], [0, 0, -1]));
const shadowDepth = new SWCanvas.Core.DepthBuffer(64, 64);
const shadowScratch = { width: 64, height: 64, data32: new Uint32Array(64 * 64) };
shadowDepth.clear();
light.drawTriMesh(shadowScratch, shadowDepth, ground, null, { mode: 'depth', cull: 'front' });
light.drawTriMesh(shadowScratch, shadowDepth, block, null, { mode: 'depth', cull: 'front' });

clearAll();
engine.drawTriMesh(idTarget, depth, ground, null, { mode: 'id' });
engine.drawTriMesh(idTarget, depth, block, null, { mode: 'id' });
const pal2 = {
    lit: new Uint32Array([0, engine.packColor(90, 200, 90), engine.packColor(230, 120, 60)]),
    shadow: new Uint32Array([0, engine.packColor(30, 90, 50), engine.packColor(120, 50, 30)]),
    threshold: new Uint8Array([0, 40, 40]),
    group: new Int32Array([0, 1, 2])
};
const shadow = { depth: shadowDepth, transform: engine.shadowTransformTo(light), bias: 0.05 };
SW3D.resolve(surface, ids, depth, engine, { palette: pal2, background: SKY, shadow });

// Project world points to find the pixels to check
function project(p) {
    const v = engine.getView();
    const x = v[0] * p[0] + v[1] * p[1] + v[2] * p[2] + v[3];
    const y = v[4] * p[0] + v[5] * p[1] + v[6] * p[2] + v[7];
    const z = v[8] * p[0] + v[9] * p[1] + v[10] * p[2] + v[11];
    return [Math.round(W / 2 + (x * engine.focal) / -z), Math.round(H / 2 - (y * engine.focal) / -z)];
}
const underBox = project([0, 0, 0.45]); // ground under the box, just in front of it (visible)
const awayFromBox = project([-4, 0, 3]);
assert.deepStrictEqual(rgbAt(...underBox), [30, 90, 50], `ground under the box is shadowed (pixel ${underBox})`);
assert.deepStrictEqual(rgbAt(...awayFromBox), [90, 200, 90], `ground away from the box is lit (pixel ${awayFromBox})`);
const boxTop = project([0, 2, 0]);
assert.deepStrictEqual(rgbAt(boxTop[0], boxTop[1] + 1), [230, 120, 60], 'the top of the box is lit (no self-shadow)');
console.log('shadow map OK');

// ---- normal cone ---------------------------------------------------------------------------
const patch = SW3D.makeTriMesh({
    positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0.2, -1, 1, 0.2],
    indices: [0, 1, 2, 0, 2, 3],
    faceIds: new Uint32Array([3, 3]),
    cone: true
});
assert.ok(patch.coneSin <= 1, 'a near-planar patch has a normal cone');
engine.setView(SW3D.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]));
clearAll();
assert.ok(engine.drawTriMesh(idTarget, depth, patch, null, { mode: 'id' }) > 0, 'patch facing the camera is drawn');
engine.setView(SW3D.lookAt([0, 0, -5], [0, 0, 0], [0, 1, 0]));
assert.strictEqual(engine.drawTriMesh(idTarget, depth, patch, null, { mode: 'id' }), 0, 'patch facing away is cone-rejected');
console.log('normal cone OK');

// ---- near-plane clipping ------------------------------------------------------------------
engine.setView(SW3D.lookAt([0, 0.5, 0], [0, 0.5, -1], [0, 1, 0]));
clearAll();
const emittedClip = engine.drawTriMesh(idTarget, depth, ground, null, { mode: 'id' });
assert.ok(emittedClip >= 2, `ground crossing the near plane is clipped and drawn (${emittedClip} tris)`);
let bottomRow = 0;
for (let x = 0; x < W; x++) if (ids[(H - 1) * W + x] !== 0) bottomRow++;
assert.strictEqual(bottomRow, W, 'the clipped ground reaches the bottom of the view');
console.log('near clipping OK');

// ---- sprites (point sprites cut out by a mask) -------------------------------------------
{
    engine.setView(SW3D.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]));
    engine.setLightDir([0, 0, 1]);
    const full = { width: 8, height: 8, data: new Uint8Array(64).fill(1) };
    const left = { width: 8, height: 8, data: new Uint8Array(64).map((_, i) => (i % 8 < 4 ? 1 : 0)) };
    const one = (o) => ({
        count: 1, positions: new Float32Array(o.p || [0, 0, 0]), size: new Float32Array([0.5]),
        angle: new Float32Array([o.angle || 0]), values: new Uint32Array([o.value || RED]),
        normals: new Float32Array(o.n || [0, 0, 1]), shape: o.shape ? new Uint8Array([o.shape]) : undefined
    });
    const R = 0.5 * engine.focal / 5; // screen half-size at distance 5
    const count = () => { let n = 0; for (let i = 0; i < W * H; i++) if (surface.data32[i] !== BLACK) n++; return n; };
    clearAll();
    assert.strictEqual(engine.drawSprites(surface, depth, one({}), { masks: [full] }), 1, 'a sprite in view is drawn');
    let n = count();
    assert.ok(Math.abs(n - 4 * R * R) < 4 * 2 * R, `a full mask covers its square (${n} px, expected ~${(4 * R * R).toFixed(0)})`);
    clearAll();
    engine.drawSprites(surface, depth, one({ angle: Math.PI / 4 }), { masks: [full] });
    assert.ok(Math.abs(count() - 4 * R * R) < 4 * 2 * R, 'a rotated square keeps its area');
    clearAll();
    engine.drawSprites(surface, depth, one({ shape: 1 }), { masks: [full, left] });
    assert.ok(countNonBlack(0, W / 2) > 20 && countNonBlack(W / 2 + 1, W) === 0, 'the mask cuts the card (left half only)');
    // id mode: N.L of the sprite's normal; cull by the normal
    clearAll();
    engine.drawSprites(idTarget, depth, one({ value: 9 }), { masks: [full], mode: 'id' });
    let c = ids[(H >> 1) * W + (W >> 1)];
    assert.strictEqual(c >>> 6, 9, 'id mode stores the value');
    assert.strictEqual(c & 63, 63, 'id mode stores the normal\'s N.L');
    assert.strictEqual(engine.drawSprites(idTarget, depth, one({ n: [0, 0, -1] }), { masks: [full], mode: 'id', cull: -0.3 }), 0, 'a sprite facing away is culled');
    // depth: behind the quad it is hidden; pushed toward the viewer it shows
    clearAll();
    engine.drawTriMesh(idTarget, depth, quadFront, null, { mode: 'id' });
    engine.drawSprites(idTarget, depth, one({ p: [0, 0, -0.3], value: 5 }), { masks: [full], mode: 'id' });
    assert.strictEqual(ids[(H >> 1) * W + (W >> 1)] >>> 6, 7, 'a sprite behind a surface is hidden');
    engine.drawSprites(idTarget, depth, one({ p: [0, 0, -0.3], value: 5 }), { masks: [full], mode: 'id', push: -0.5 });
    assert.strictEqual(ids[(H >> 1) * W + (W >> 1)] >>> 6, 5, 'push < 0 moves it in front');
    // orthographic: the size is in world units on the map
    const ortho = SW3D.makeEngine(SWCanvas, { width: 32, height: 32, projection: 'orthographic', orthoHalfHeight: 4, orthoFar: 50 });
    ortho.setView(SW3D.lookAt([0, 0, 10], [0, 0, 0], [0, 1, 0]));
    const od = new SWCanvas.Core.DepthBuffer(32, 32);
    ortho.drawSprites({ width: 32, height: 32, data32: new Uint32Array(1024) }, od, one({}), { masks: [full], mode: 'depth' });
    let on = 0;
    for (let i = 0; i < 1024; i++) if (od.data[i] > 0) on++;
    assert.strictEqual(on, 16, `orthographic: half-size 0.5 at 4 px/unit is 4x4 px (${on})`);
    // mask levels: halved down to 1x1; a full mask stays full; a small sprite uses a coarse level
    const chk = SW3D.makeSpriteMask(8, 8, new Uint8Array(64).map((_, i) => ((i % 8) + (i >> 3)) % 2));
    assert.deepStrictEqual(chk.levels.map(l => l.width), [8, 4, 2, 1], 'levels halve down to 1x1');
    assert.ok(SW3D.makeSpriteMask(8, 8, full.data).levels.every(l => l.data.every(v => v === 1)), 'a full mask stays full');
    clearAll();
    const leftLv = SW3D.makeSpriteMask(8, 8, left.data);
    engine.drawSprites(surface, depth, one({ shape: 1 }), { masks: [full, leftLv] });
    assert.ok(countNonBlack(0, W / 2) > 20 && countNonBlack(W / 2 + 1, W) === 0, 'a levelled mask cuts the same card');
    // a bounding sphere out of view skips the whole set; in view, it changes nothing
    clearAll();
    assert.strictEqual(engine.drawSprites(surface, depth, { ...one({}), center: [0, 0, 10], radius: 1 }, { masks: [full] }), 0, 'a set behind the camera is skipped whole');
    assert.strictEqual(engine.drawSprites(surface, depth, { ...one({}), center: [0, 0, 0], radius: 1 }, { masks: [full] }), 1, 'a set in view is drawn');
    assert.ok(Math.abs(count() - 4 * R * R) < 4 * 2 * R, 'and covers the same square');
}
// noDepthEdges: two sprites of one group at different depths, overlapping: an outline
// between them, unless the entry is flagged
{
    clearAll();
    const full = { width: 8, height: 8, data: new Uint8Array(64).fill(1) };
    const two = { count: 2, positions: new Float32Array([-0.3, 0, 0, 0.3, 0, 1.5]), size: new Float32Array([0.6, 0.4]),
        angle: new Float32Array(2), values: new Uint32Array([3, 3]), normals: new Float32Array([0, 0, 1, 0, 0, 1]) };
    engine.drawSprites(idTarget, depth, two, { masks: [full], mode: 'id' });
    const pal = { lit: new Uint32Array(8).fill(engine.packColor(60, 160, 90)), shadow: new Uint32Array(8).fill(engine.packColor(30, 80, 45)),
        threshold: new Uint8Array(8).fill(34), group: new Int32Array(8) };
    const inner = () => { let n = 0; for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x;
        if (surface.data32[i] === INK && ids[i] !== 0 && ids[i + 1] !== 0 && ids[i + W] !== 0) n++; } return n; };
    SW3D.resolve(surface, ids, depth, engine, { palette: pal, background: SKY, outline: { color: INK, depthRatio: 0.06 } });
    const withEdges = inner();
    SW3D.resolve(surface, ids, depth, engine, { palette: { ...pal, noDepthEdges: new Uint8Array(8).fill(1) }, background: SKY, outline: { color: INK, depthRatio: 0.06 } });
    assert.ok(withEdges > 5 && inner() === 0, `depth edges inside a group: ${withEdges} px, none when flagged`);
}
console.log('sprites OK (size, rotation, mask, levels, bounding sphere, id, cull, depth, push, orthographic, noDepthEdges)');

// ---- sky dome ------------------------------------------------------------------------------
{
    // a 16x16 field: 255 only around u = 0.5 (the +x side of the sphere) and only above the equator
    const field = { width: 16, height: 16, data: new Uint8Array(256).map((_, i) => ((i % 16) >= 6 && (i % 16) < 10 && (i >> 4) >= 8 ? 255 : 0)) };
    const rows = new Uint32Array(H).map((_, y) => engine.packColor(200, 210, y));
    const dome = { center: [0, 0, 0], radius: 50, field, threshold: 128, rows };
    const look = (dir) => { engine.setView(SW3D.lookAt([0, 0, 0], dir, Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])); ids.fill(0); surface.data32.fill(BLACK); };
    look([1, 0.3, 0]);
    let n = engine.drawDome(surface, ids, dome);
    assert.ok(n > 0 && surface.data32[(H >> 1) * W + (W >> 1)] === rows[H >> 1], `looking at +x, a little up: the field is painted, in the row's colour (${n} px)`);
    look([1, -0.3, 0]);
    assert.strictEqual(surface.data32[(H >> 1) * W + (W >> 1)], BLACK, 'below the equator: not painted');
    look([0, 0.3, -1]);
    assert.strictEqual(surface.data32[(H >> 1) * W + (W >> 1)], BLACK, 'toward -z (u = 0.75): not painted');
    look([1, 0.3, 0]);
    ids.fill(1);
    assert.strictEqual(engine.drawDome(surface, ids, dome), 0, 'pixels with something drawn are left alone');
    // off-centre camera: the far side of the sphere is what counts
    engine.setView(SW3D.lookAt([-30, 0, 0], [0, 10, 0], [0, 1, 0]));
    ids.fill(0); surface.data32.fill(BLACK);
    engine.drawDome(surface, ids, dome);
    assert.strictEqual(surface.data32[(H >> 1) * W + (W >> 1)], rows[H >> 1], 'from off-centre, the ray meets the +x side');
    engine.setView(SW3D.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]));
}
console.log('sky dome OK');

// ---- surfaces shaded per pixel (water) -------------------------------------------------------
{
    // the quad at z = 0 (entry 7), then a smaller one at z = 1 (entry 3) drawn after a copy of the depth
    const small = SW3D.makeTriMesh({
        positions: [-0.4, -0.4, 1, 0.4, -0.4, 1, 0.4, 0.4, 1, -0.4, 0.4, 1],
        indices: [0, 1, 2, 0, 2, 3],
        faceIds: new Uint32Array([3, 3])
    });
    clearAll();
    engine.setLightDir([0, 0, 1]);
    engine.drawTriMesh(idTarget, depth, quadFront, null, { mode: 'id' });
    const behind = new SWCanvas.Core.DepthBuffer(W, H);
    behind.data.set(depth.data);
    engine.drawTriMesh(idTarget, depth, small, null, { mode: 'id' });
    const entries = new Uint8Array(8);
    entries[3] = 1;
    // the shade: red = 100 x (distance from the surface to the scene behind), green = the entry
    const shade = (sx, sy, sz, wx, wy, wz, e) => engine.packColor(Math.round((wz - sz) * 100), e, 0);
    SW3D.resolve(surface, ids, depth, engine, { palette, background: SKY, outline: { color: INK }, surface: { entries, depth: behind, shade } });
    assert.deepStrictEqual(rgbAt(W >> 1, H >> 1), [100, 3, 0], 'the shade sees the surface 1 unit in front of the scene behind');
    // no outline on the surface, nor around it on the quad behind (same depth behind): only the big quad's silhouette
    let ring = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const id = ids[y * W + x];
        const nearSmall = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (ids[(y + dy) * W + x + dx] >>> 6) === 3);
        if (id !== 0 && nearSmall && surface.data32[y * W + x] === INK) ring++;
    }
    assert.strictEqual(ring, 0, 'no outline where the surface meets the scene behind it');
}
console.log('surface shading OK');

// ---- picture --------------------------------------------------------------------------------
const PW = 320, PH = 200;
const pic = SWCanvas.Core.Surface(PW, PH);
const picDepth = new SWCanvas.Core.DepthBuffer(PW, PH);
const picIds = new Uint32Array(PW * PH);
const cam = SW3D.makeEngine(SWCanvas, { width: PW, height: PH, znear: 0.1 });
cam.setView(SW3D.lookAt([5, 5, 8], [0, 0.8, 0], [0, 1, 0]));
const sun = [-0.7, 1, 0.25]; // from the left, so the shadows fall to the right, in view
cam.setLightDir(sun);
const sunCam = SW3D.makeEngine(SWCanvas, { width: 128, height: 128, projection: 'orthographic', orthoHalfHeight: 7, orthoFar: 100 });
sunCam.setView(SW3D.lookAt([-14, 20, 5], [0, 0, 0], [0, 1, 0]));
const sunDepth = new SWCanvas.Core.DepthBuffer(128, 128);
const sunScratch = { width: 128, height: 128, data32: new Uint32Array(128 * 128) };
const blocks = [box(0, 0.5, 0, 0.5, 2), box(1.6, 1.0, -1, 1.0, 3), box(-2, 0.35, 1.5, 0.35, 4)];
sunDepth.clear();
for (const m of [ground, ...blocks]) sunCam.drawTriMesh(sunScratch, sunDepth, m, null, { mode: 'depth', cull: 'front' });
picDepth.clear();
for (const m of [ground, ...blocks]) cam.drawTriMesh({ width: PW, height: PH, data32: picIds }, picDepth, m, null, { mode: 'id' });
const toon = {
    lit: new Uint32Array([0, cam.packColor(140, 200, 110), cam.packColor(240, 150, 70), cam.packColor(110, 150, 230), cam.packColor(240, 220, 120)]),
    shadow: new Uint32Array([0, cam.packColor(70, 120, 90), cam.packColor(140, 70, 50), cam.packColor(60, 70, 140), cam.packColor(140, 110, 60)]),
    threshold: new Uint8Array([0, 42, 42, 42, 42]),
    group: new Int32Array([0, 1, 2, 3, 4])
};
const sky = new Uint32Array(PH);
for (let y = 0; y < PH; y++) sky[y] = cam.packColor(150 + (y * 60) / PH, 200 + (y * 40) / PH, 255);
SW3D.resolve(pic, picIds, picDepth, cam, {
    palette: toon,
    background: sky,
    outline: { color: cam.packColor(30, 30, 45), depthRatio: 0.1 },
    fog: { color: [200, 230, 255], near: 9, far: 30 },
    shadow: { depth: sunDepth, transform: cam.shadowTransformTo(sunCam), bias: 0.05 }
});
const outPath = process.argv[2] || path.join(__dirname, '3d-trimesh.png');
fs.writeFileSync(outPath, Buffer.from(SWCanvas.Core.PngEncoder.encode(pic)));
console.log(`wrote ${outPath}`);

console.log('3d-trimesh-node: all triangle-mesh witnesses passed');

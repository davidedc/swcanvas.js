/**
 * Node witness for the 3D-core dist target (dist/swcanvas-3d-core.js).
 *
 * The point of this file is what it does NOT require: only the 3D-core bundle
 * and the SW3D engine layer — never dist/swcanvas.js. Any symbol that leaked
 * out of the core's dependency closure (something Surface/Texture3D/
 * Triangle3DOps reads that only the full bundle defines) ReferenceErrors here,
 * in this repo, instead of surfacing as a broken page in a consumer.
 *
 * It renders a lit box through SW3D and asserts non-empty output plus exact
 * spot-check pixels, so a silent rasterization change is caught too. Both the
 * unminified and the minified core are exercised — the minified one is what
 * consumers actually ship, so a mangling/dead-code-elimination fault must fail
 * here as well.
 *
 * Usage: node examples/3d-core-node.js   (exit 0 = all witnesses passed)
 */
'use strict';

const assert = require('assert');
const SW3D = require('./sw3d.js');

const W = 80;
const H = 80;

// The scene: one box, camera on -z looking along +z, default SW3D lighting.
// Faces are coloured so the visible (front, -z) face is unambiguous.
const CORNERS = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
];
const FACES = [
    [0, 3, 2, 1], // front (-z) — the one facing the camera
    [4, 5, 6, 7], // back  (+z)
    [0, 4, 7, 3], // left  (-x)
    [1, 2, 6, 5], // right (+x)
    [3, 7, 6, 2], // top   (+y)
    [0, 1, 5, 4] //  bottom (-y)
];
const FRONT_COLOR = [220, 60, 60];
const OTHER_COLOR = [60, 60, 220];

function renderWith(SWCanvas) {
    const surface = SWCanvas.Core.Surface(W, H);
    const depth = new SWCanvas.Core.DepthBuffer(W, H);
    const engine = SW3D.makeEngine(SWCanvas, { width: W, height: H });
    engine.setCamera([0, 0, -4], 0);

    surface.data32.fill(engine.packColor(0, 0, 0));
    depth.clear();

    const positions = [];
    for (const c of CORNERS) positions.push(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5);
    const faces = FACES.map((v, idx) => ({ v: v, color: idx === 0 ? FRONT_COLOR : OTHER_COLOR }));
    const box = SW3D.makeMesh({ positions: positions, faces: faces });

    const emitted = engine.drawMesh(surface, depth, box, [0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    return { surface: surface, emitted: emitted };
}

function pixelAt(surface, x, y) {
    const i = (y * W + x) * 4;
    return [surface.data[i], surface.data[i + 1], surface.data[i + 2], surface.data[i + 3]];
}

function nonBackgroundCount(surface) {
    let n = 0;
    for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        if (surface.data[o] !== 0 || surface.data[o + 1] !== 0 || surface.data[o + 2] !== 0) n++;
    }
    return n;
}

// Spot checks. Baked from a run that was verified pixel-identical (SHA-256 over
// the whole surface) against the SAME scene rendered by the FULL dist bundle —
// so these numbers pin the core target to full-bundle behaviour, not merely to
// its own past self. They cover the rasterizer and SW3D's Lambert lighting.
const EXPECTED_CENTRE = [167, 45, 45, 255]; // front face under Lambert shading
const EXPECTED_CORNER = [0, 0, 0, 255]; // background, outside the box silhouette
const EXPECTED_COVERED = 625; // painted pixels (the box silhouette)

function check(label, SWCanvas) {
    assert.ok(SWCanvas && SWCanvas.Core, `${label}: SWCanvas.Core must exist`);
    for (const member of ['Surface', 'Color', 'Validators', 'DepthBuffer', 'Texture3D', 'Triangle3DOps']) {
        assert.ok(SWCanvas.Core[member], `${label}: SWCanvas.Core.${member} must be exported`);
    }

    const { surface, emitted } = renderWith(SWCanvas);
    assert.ok(emitted > 0, `${label}: the box must emit triangles, got ${emitted}`);

    const covered = nonBackgroundCount(surface);
    assert.ok(covered > 0, `${label}: something must be painted`);

    const centre = pixelAt(surface, W >> 1, H >> 1);
    assert.deepStrictEqual(centre, EXPECTED_CENTRE, `${label}: centre pixel`);
    assert.deepStrictEqual(pixelAt(surface, 1, 1), EXPECTED_CORNER, `${label}: top-left corner must stay background`);
    assert.strictEqual(covered, EXPECTED_COVERED, `${label}: painted pixel count`);

    console.log(`${label} OK: emitted ${emitted} triangles, ${covered} painted pixels, centre ${centre}`);
}

check('3d-core (unminified)', require('../dist/swcanvas-3d-core.js'));
check('3d-core (minified)', require('../dist/swcanvas-3d-core.min.js'));

console.log('3d-core-node: all 3D-core witnesses passed');

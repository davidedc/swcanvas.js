// Test: fillStadium direct rendering - shape contract, clip equivalence, containment
// This file will be concatenated into the main test suite
//
// fillStadium(x, y, w, h) fills the box with its shorter axis fully rounded:
// two half-circle caps of radius min(w,h)/2 joined by a rectangular body,
// orientation implied by the longer axis. It exists because (a) the
// circle+rect composition double-blends its overlaps at alpha < 1, and (b)
// RoundedRectOpsAA at the degenerate radius loses the left/right apex columns
// of a HORIZONTAL stadium (its corner x-extents are edge-sampled; probed in
// debug/probe-stadium-roundrect-degenerate.js). Contract pinned here:
//   1. CRISP BOX: at integer geometry the fill covers EXACTLY [x,x+w)x[y,y+h),
//      both orientations, even and odd minor axis, symmetric in both axes.
//   2. CAPS ARE fillCircle's: a square stadium is byte-identical to the
//      inscribed fillCircle (both parities), and the pure cap rows of a
//      vertical stadium are byte-identical to the corresponding fillCircle rows.
//   3. ALPHA: single-blend everywhere (one span per row - no overlap).
//   4. TIER-0: under a rect clip, tier-0 output is byte-identical to the
//      forced-bitmask clip (two-identical-rects technique), with no leak.
//   5. TRANSFORMS: scaled user-space calls are byte-identical to the
//      equivalent device-space call; 90-degree axis-aligned rotation works
//      (a rotated stadium is a stadium with w/h swapped).
//   6. CONTAINMENT: partially off-surface stadiums paint nothing outside the
//      shape (spans are clamped - no wrapped writes).

test('Stadium fill - shape contract, clip equivalence, containment', () => {
    const W = 90;
    const H = 90;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function shapePixelSet(surface) {
        const set = new Set();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) {
                    set.add(y * W + x);
                }
            }
        }
        return set;
    }

    function bboxOf(set) {
        let x0 = Infinity,
            y0 = Infinity,
            x1 = -Infinity,
            y1 = -Infinity;
        for (const p of set) {
            const px = p % W;
            const py = (p - px) / W;
            if (px < x0) x0 = px;
            if (px > x1) x1 = px;
            if (py < y0) y0 = py;
            if (py > y1) y1 = py;
        }
        return { x0, y0, x1, y1 };
    }

    function assertBytesEqual(label, sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
            }
        }
    }

    // 1. Crisp box + symmetry, both orientations, both parities.
    for (const [x, y, w, h] of [
        [10, 5, 20, 60],
        [5, 25, 60, 20],
        [10, 5, 21, 61],
        [5, 25, 61, 21],
        [10, 10, 9, 40],
        [10, 20, 40, 8]
    ]) {
        const { surface, ctx } = newCtx();
        ctx.setFillStyle(255, 0, 0, 255);
        ctx.fillStadium(x, y, w, h);
        const set = shapePixelSet(surface);
        const b = bboxOf(set);
        if (b.x0 !== x || b.y0 !== y || b.x1 !== x + w - 1 || b.y1 !== y + h - 1) {
            throw new Error(
                `${w}x${h}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}], expected exactly ` +
                    `[${x}..${x + w - 1}]x[${y}..${y + h - 1}]`
            );
        }
        for (const p of set) {
            const px = p % W;
            const py = (p - px) / W;
            if (!set.has(py * W + (b.x0 + b.x1 - px))) {
                throw new Error(`${w}x${h}: (${px},${py}) breaks horizontal mirror symmetry`);
            }
            if (!set.has((b.y0 + b.y1 - py) * W + px)) {
                throw new Error(`${w}x${h}: (${px},${py}) breaks vertical mirror symmetry`);
            }
        }
        log(`  ${w}x${h}: exact box, symmetric`);
    }

    // 2a. Square stadium === inscribed fillCircle, both parities.
    for (const s of [24, 25]) {
        const a = newCtx();
        a.ctx.setFillStyle(255, 0, 0, 255);
        a.ctx.fillStadium(10, 10, s, s);
        const b = newCtx();
        b.ctx.setFillStyle(255, 0, 0, 255);
        b.ctx.fillCircle(10 + s / 2, 10 + s / 2, s / 2);
        assertBytesEqual(`square ${s}x${s} vs fillCircle`, a.surface, b.surface);
    }
    log('  square stadium === inscribed fillCircle (both parities)');

    // 2b. Pure cap rows of a vertical stadium === the same rows of fillCircle.
    {
        const a = newCtx();
        a.ctx.setFillStyle(255, 0, 0, 255);
        a.ctx.fillStadium(10, 5, 20, 60);
        const b = newCtx();
        b.ctx.setFillStyle(255, 0, 0, 255);
        b.ctx.fillCircle(20, 15, 10); // top cap circle: center (10+10, 5+10)
        // Rows strictly above the cap center's anchor row are pure cap rows.
        const capAnchorRow = Math.floor(15 - 0.5);
        for (let y = 5; y < capAnchorRow; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * a.surface.stride + x * 4;
                for (let c = 0; c < 4; c++) {
                    if (a.surface.data[o + c] !== b.surface.data[o + c]) {
                        throw new Error(`cap row ${y}: stadium differs from fillCircle at (${x},${y})`);
                    }
                }
            }
        }
        log('  vertical-stadium cap rows === fillCircle rows');
    }

    // 3. Alpha uniformity: one blended level only.
    for (const [w, h] of [
        [20, 60],
        [60, 20],
        [21, 61]
    ]) {
        const { surface, ctx } = newCtx();
        ctx.setFillStyle(255, 0, 0, 128);
        ctx.fillStadium(10, 10, w, h);
        const levels = new Set();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                if (surface.data[o + 1] !== 255) levels.add(surface.data[o + 1]);
            }
        }
        if (levels.size !== 1) {
            throw new Error(
                `${w}x${h} alpha: expected one blended level, got {${[...levels].sort((a, b) => a - b)}} - ` +
                    'double-blend detected'
            );
        }
    }
    log('  alpha: single-blend everywhere');

    // 4. Tier-0 === bitmask under a rect clip, no leak (test 049's technique).
    {
        const CLIP = { x: 14, y: 10, w: 30, h: 18 };
        function renderClipped(clipMode, drawFn) {
            const { surface, ctx } = newCtx();
            ctx.save();
            ctx.beginPath();
            ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
            if (clipMode === 'mask') {
                ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
            }
            ctx.clip();
            drawFn(ctx);
            ctx.restore();
            return surface;
        }
        for (const [label, draw] of [
            [
                'opaque vertical',
                (ctx) => {
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.fillStadium(20, 4, 16, 50);
                }
            ],
            [
                'semi horizontal',
                (ctx) => {
                    ctx.setFillStyle(0, 0, 255, 128);
                    ctx.fillStadium(4, 12, 60, 14);
                }
            ],
            [
                'opaque @scale2',
                (ctx) => {
                    ctx.scale(2, 2);
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.fillStadium(10, 2, 8, 25);
                }
            ]
        ]) {
            const tier0 = renderClipped('tier0', draw);
            const mask = renderClipped('mask', draw);
            assertBytesEqual(`clip ${label}: tier-0 vs bitmask`, tier0, mask);
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const o = y * tier0.stride + x * 4;
                    if (tier0.data[o] === 255 && tier0.data[o + 1] === 255 && tier0.data[o + 2] === 255) continue;
                    if (x < CLIP.x || x >= CLIP.x + CLIP.w || y < CLIP.y || y >= CLIP.y + CLIP.h) {
                        throw new Error(`clip ${label}: painted outside the clip rect at (${x},${y})`);
                    }
                }
            }
            log(`  clip ${label}: tier-0 === bitmask, no leak`);
        }
    }

    // 5. Transforms: pre-multiplication exact; 90-degree rotation swaps w/h.
    {
        const scaled = newCtx();
        scaled.ctx.save();
        scaled.ctx.translate(3, 2);
        scaled.ctx.scale(2, 2);
        scaled.ctx.setFillStyle(255, 0, 0, 255);
        scaled.ctx.fillStadium(4, 2, 10, 30);
        scaled.ctx.restore();
        const device = newCtx();
        device.ctx.setFillStyle(255, 0, 0, 255);
        device.ctx.fillStadium(11, 6, 20, 60);
        assertBytesEqual('translate+scale vs device', scaled.surface, device.surface);

        const rotated = newCtx();
        rotated.ctx.save();
        rotated.ctx.translate(45, 45);
        rotated.ctx.rotate(Math.PI / 2);
        rotated.ctx.translate(-45, -45);
        rotated.ctx.setFillStyle(255, 0, 0, 255);
        rotated.ctx.fillStadium(35, 15, 20, 60);
        rotated.ctx.restore();
        const swapped = newCtx();
        swapped.ctx.setFillStyle(255, 0, 0, 255);
        swapped.ctx.fillStadium(15, 35, 60, 20);
        assertBytesEqual('90-degree rotation vs swapped w/h', rotated.surface, swapped.surface);
        log('  transforms: pre-multiplication exact, 90-degree swap exact');
    }

    // 6. Off-surface containment: nothing painted outside the shape.
    for (const [label, x, y, w, h] of [
        ['off-left', -30, 30, 60, 20],
        ['off-right', 60, 30, 60, 20],
        ['off-top', 30, -30, 20, 60],
        ['off-bottom', 30, 60, 20, 60]
    ]) {
        const { surface, ctx } = newCtx();
        ctx.setFillStyle(255, 0, 0, 255);
        ctx.fillStadium(x, y, w, h);
        for (const p of shapePixelSet(surface)) {
            const px = p % W;
            const py = (p - px) / W;
            if (px < x || px >= x + w || py < y || py >= y + h) {
                throw new Error(`${label}: painted pixel (${px},${py}) outside the box - wrapped span write`);
            }
        }
        log(`  ${label}: contained`);
    }

    const showcase = newCtx();
    showcase.ctx.setFillStyle(0, 0, 255, 255);
    showcase.ctx.fillStadium(10, 10, 20, 70);
    showcase.ctx.setFillStyle(255, 0, 0, 255);
    showcase.ctx.fillStadium(40, 30, 45, 18);
    savePNG(showcase.surface, 'stadium-fill-contract.basic.png', 'vertical + horizontal stadium fills', SWCanvas);
});

// Test: fillCircle/strokeCircle direct rendering - crisp placement contract
// This file will be concatenated into the main test suite
//
// Pins the coordinate contract of the direct circle renderers (probed by
// debug/probe-circle-crisp.js while wiring the tier-0 clip path):
//   1. Crisp inscribed FILL idiom: fillCircle(x + s/2, y + s/2, s/2) at integer
//      x/y and even integer s covers EXACTLY the s-by-s pixel box [x, x+s) -
//      the spelling Fizzygum-style chrome uses to fill a circle into a widget
//      box. Symmetric in both axes, two colors only.
//   2. 1px STROKE center convention: the Bresenham stroke FLOORS the center, so
//      every fractional center spelling renders byte-identically to the integer
//      one, and the ring spans exactly (2r+1) pixels - one wider than the fill
//      (which floors cx - 0.5). This fill-vs-1px-stroke asymmetry is deliberate
//      and pinned here so a "harmonization" cannot slip in silently and churn
//      every existing consumer's pixels.
//   3. Ring quality: closed (every stroke pixel has >= 2 of 8 neighbors),
//      mirror-symmetric in both axes; semi-transparent rings blend every pixel
//      exactly once (single blended level - no overdraw, no gap-fills).
//   4. Thick STROKE shares the fill's center convention: at an integer center
//      with integral r + lw/2 the annulus covers exactly the 2*(r + lw/2) box.
//   5. Transform pre-multiplication is exact: a scaled user-space call is
//      byte-identical to the equivalent device-space call (the property that
//      makes the direct paths safe under translate+uniform-scale contexts).

test('Circle direct rendering - crisp placement contract', () => {
    const W = 60;
    const H = 60;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function shapePixelSet(surface) {
        // Any non-white pixel counts as shape coverage.
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

    function assertSymmetric(label, set, b) {
        for (const p of set) {
            const px = p % W;
            const py = (p - px) / W;
            if (!set.has(py * W + (b.x0 + b.x1 - px))) {
                throw new Error(`${label}: (${px},${py}) breaks horizontal mirror symmetry`);
            }
            if (!set.has((b.y0 + b.y1 - py) * W + px)) {
                throw new Error(`${label}: (${px},${py}) breaks vertical mirror symmetry`);
            }
        }
    }

    function assertBytesEqual(label, sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
            }
        }
    }

    // 1. Crisp inscribed-fill idiom: box (16,16) size 20 -> exactly [16..35]^2.
    for (const s of [4, 10, 20]) {
        const { surface, ctx } = newCtx();
        ctx.setFillStyle(255, 0, 0, 255);
        ctx.fillCircle(16 + s / 2, 16 + s / 2, s / 2);
        const set = shapePixelSet(surface);
        const b = bboxOf(set);
        if (b.x0 !== 16 || b.y0 !== 16 || b.x1 !== 16 + s - 1 || b.y1 !== 16 + s - 1) {
            throw new Error(
                `fill s=${s}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}], expected exactly [16..${16 + s - 1}]^2`
            );
        }
        assertSymmetric(`fill s=${s}`, set, b);
        log(`  fill s=${s}: covers exactly the ${s}x${s} box, symmetric`);
    }

    // 2+3. 1px stroke: floor convention, (2r+1) span, closed symmetric ring,
    //      fractional center spellings byte-identical to the integer one.
    for (const r of [3, 8, 12]) {
        const { surface, ctx } = newCtx();
        ctx.setStrokeStyle(255, 0, 0, 255);
        ctx.lineWidth = 1;
        ctx.strokeCircle(30, 30, r);
        const set = shapePixelSet(surface);
        const b = bboxOf(set);
        if (b.x0 !== 30 - r || b.y0 !== 30 - r || b.x1 !== 30 + r || b.y1 !== 30 + r) {
            throw new Error(
                `stroke1px r=${r}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}], ` +
                    `expected exactly [${30 - r}..${30 + r}]^2 (2r+1 span)`
            );
        }
        for (const p of set) {
            const px = p % W;
            const py = (p - px) / W;
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    if (set.has((py + dy) * W + (px + dx))) n++;
                }
            }
            if (n < 2) {
                throw new Error(`stroke1px r=${r}: ring pixel (${px},${py}) has ${n} neighbors - open ring`);
            }
        }
        assertSymmetric(`stroke1px r=${r}`, set, b);

        for (const [cx, cy] of [
            [30.5, 30.5],
            [30.25, 30.75]
        ]) {
            const alt = newCtx();
            alt.ctx.setStrokeStyle(255, 0, 0, 255);
            alt.ctx.lineWidth = 1;
            alt.ctx.strokeCircle(cx, cy, r);
            assertBytesEqual(`stroke1px r=${r} center (${cx},${cy}) vs integer`, surface, alt.surface);
        }
        log(`  stroke1px r=${r}: exact (2r+1) box, closed symmetric ring, center-spelling invariant`);
    }

    // 3b. Semi-transparent 1px ring blends every pixel exactly once.
    {
        const { surface, ctx } = newCtx();
        ctx.setStrokeStyle(255, 0, 0, 128);
        ctx.lineWidth = 1;
        ctx.strokeCircle(30, 30, 8);
        const levels = new Set();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                if (surface.data[o + 1] !== 255) levels.add(surface.data[o + 1]);
            }
        }
        if (levels.size !== 1) {
            throw new Error(
                `stroke1px alpha: expected one blended level, got {${[...levels].sort((a, b) => a - b)}} - ` +
                    'overdraw or gap-fill detected'
            );
        }
        log('  stroke1px alpha: uniform single-blend coverage (no overdraw)');
    }

    // 4. Thick stroke: integer center + integral r+lw/2 -> exact 2*(r+lw/2) box.
    {
        const r = 14,
            lw = 4,
            reach = r + lw / 2; // 16
        const { surface, ctx } = newCtx();
        ctx.setStrokeStyle(255, 0, 0, 255);
        ctx.lineWidth = lw;
        ctx.strokeCircle(30, 30, r);
        const set = shapePixelSet(surface);
        const b = bboxOf(set);
        if (b.x0 !== 30 - reach || b.y0 !== 30 - reach || b.x1 !== 30 + reach - 1 || b.y1 !== 30 + reach - 1) {
            throw new Error(
                `strokeThick r=${r} lw=${lw}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}], ` +
                    `expected exactly [${30 - reach}..${30 + reach - 1}]^2`
            );
        }
        assertSymmetric('strokeThick', set, b);
        log(`  strokeThick r=${r} lw=${lw}: exact ${2 * reach}x${2 * reach} annulus box, symmetric`);
    }

    // 5. Transform pre-multiplication is exact (fill and thick stroke).
    {
        const scaled = newCtx();
        scaled.ctx.save();
        scaled.ctx.scale(2, 2);
        scaled.ctx.setFillStyle(255, 0, 0, 255);
        scaled.ctx.fillCircle(15, 15, 5);
        scaled.ctx.restore();
        const device = newCtx();
        device.ctx.setFillStyle(255, 0, 0, 255);
        device.ctx.fillCircle(30, 30, 10);
        assertBytesEqual('fill scale(2) vs device', scaled.surface, device.surface);

        const scaledStroke = newCtx();
        scaledStroke.ctx.save();
        scaledStroke.ctx.translate(3, 2);
        scaledStroke.ctx.scale(2, 2);
        scaledStroke.ctx.setStrokeStyle(255, 0, 0, 255);
        scaledStroke.ctx.lineWidth = 2;
        scaledStroke.ctx.strokeCircle(12, 13, 7);
        scaledStroke.ctx.restore();
        const deviceStroke = newCtx();
        deviceStroke.ctx.setStrokeStyle(255, 0, 0, 255);
        deviceStroke.ctx.lineWidth = 4;
        deviceStroke.ctx.strokeCircle(27, 28, 14);
        assertBytesEqual('stroke translate+scale vs device', scaledStroke.surface, deviceStroke.surface);
        log('  transform pre-multiplication exact for fill and thick stroke');
    }

    const showcase = newCtx();
    showcase.ctx.setFillStyle(0, 0, 255, 255);
    showcase.ctx.fillCircle(20, 30, 10);
    showcase.ctx.setStrokeStyle(255, 0, 0, 255);
    showcase.ctx.lineWidth = 4;
    showcase.ctx.strokeCircle(42, 30, 12);
    savePNG(showcase.surface, 'circle-direct-crisp-contract.basic.png', 'crisp inscribed fill + thick annulus', SWCanvas);
});

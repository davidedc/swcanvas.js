// Test: fillCircle with an opaque Color under globalAlpha < 1 stays direct
// This file will be concatenated into the main test suite
//
// Regression guard. _fillCircleDirect's dispatch had a hole: isOpaqueColor
// requires globalAlpha >= 1, isSemiTransparentColor required paint a < 255 -
// an OPAQUE color at globalAlpha 0.5 satisfied neither and dropped to the
// generic fallback although CircleOps.fill_Alpha handles it exactly (every
// sibling entry - fillRect, fillRoundRect, fillArc, fillStadium - dispatches
// this case to its _Alpha renderer). Historically that fallback was also
// CTM-broken (see tests/core/059), which made this the most user-visible
// symptom of the pair: a plain solid-colour fillCircle at globalAlpha 0.5
// under translate(30,30) rendered 30px off. Contract pinned here:
//   1. STRUCTURAL: the case takes a direct path (no path-based rendering).
//   2. POSITION: under translate(30,30) the circle lands at (50,50).
//   3. ALPHA: globalAlpha is actually applied (a ~50/50 blend with the
//      background), byte-identical to the same draw at paint a=255 through
//      fill_Alpha semantics.

test('fillCircle opaque color + globalAlpha < 1 - direct fill_Alpha path', () => {
    const W = 100;
    const H = 100;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function bboxCenter(surface) {
        let x0 = Infinity,
            y0 = Infinity,
            x1 = -Infinity,
            y1 = -Infinity;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
            }
        }
        return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }

    // 1+2. Structural + position: opaque red at globalAlpha 0.5 under
    //      translate(30,30) stays direct and lands at (50,50).
    const { surface, ctx } = newCtx();
    SWCanvas.Core.Context2D.resetPathBasedFlag();
    ctx.save();
    ctx.translate(30, 30);
    ctx.globalAlpha = 0.5;
    ctx.setFillStyle(255, 0, 0, 255);
    ctx.fillCircle(20, 20, 10);
    ctx.restore();
    if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
        throw new Error('fillCircle opaque color + globalAlpha<1 fell to the path pipeline');
    }
    const c = bboxCenter(surface);
    if (Math.abs(c.cx - 50) > 2 || Math.abs(c.cy - 50) > 2) {
        throw new Error(`fillCircle @globalAlpha 0.5 + translate(30,30): center (${c.cx},${c.cy}), expected ~(50,50)`);
    }
    log(`  opaque color @globalAlpha 0.5: direct, center (${c.cx},${c.cy})`);

    // 3. Alpha applied: the center pixel is a ~50/50 red/white blend.
    const o = 50 * surface.stride + 50 * 4;
    const px = [surface.data[o], surface.data[o + 1], surface.data[o + 2]];
    if (px[0] !== 255 || Math.abs(px[1] - 127) > 3 || Math.abs(px[2] - 127) > 3) {
        throw new Error(`center pixel [${px}] is not a ~50/50 red/white blend (globalAlpha dropped?)`);
    }
    log(`  center pixel [${px}]: globalAlpha applied`);
});

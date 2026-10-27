// Test: strokeCircle / outerStrokeArc / fillOuterStrokeArc return at the entry
// for a NaN or infinite radius
// This file will be concatenated into the main test suite
//
// Each of the three entries opens with the same radius guard as fillCircle
// (non-positive, NaN and infinite radii draw nothing). Pinned through cases
// that FAIL without the guard instead of hanging:
//   1. outerStrokeArc and fillOuterStrokeArc with an infinite radius paint
//      nothing at lineWidth 2, 3 and 10 (unguarded, the thick arc paints a
//      wedge of the surface);
//   2. all three with a NaN radius under a non-uniform scale return before any
//      rendering: no pixel, and the generic pipeline is never entered
//      (unguarded, the NaN radius reaches the generic path).
// (lineWidth 1 and sub-pixel widths are left out on purpose: there an infinite
// radius never terminates the hairline walk unless the guard holds, so a
// regression would hang the suite instead of failing this test. strokeCircle
// paints nothing for an infinite radius at lineWidth >= 2 either way, so its
// guard is pinned through case 2.)

test('Stroke/arc entries: NaN and infinite radii return at the entry', () => {
    const SIZE = 72;
    const C = 36;
    const Ctx2D = SWCanvas.Core.Context2D;

    function render(draw, setup) {
        const surface = SWCanvas.Core.Surface(SIZE, SIZE);
        const ctx = new Ctx2D(surface);
        ctx.setFillStyle(0, 0, 255, 255);
        ctx.setStrokeStyle(255, 0, 0, 255);
        if (setup) setup(ctx);
        Ctx2D.resetPathBasedFlag();
        draw(ctx);
        let painted = 0;
        for (let i = 3; i < surface.data.length; i += 4) if (surface.data[i] !== 0) painted++;
        return { painted, pathBased: Ctx2D.wasPathBasedUsed() };
    }

    const ENTRIES = {
        strokeCircle: (ctx, r) => ctx.strokeCircle(C, C, r),
        outerStrokeArc: (ctx, r) => ctx.outerStrokeArc(C, C, r, 0, Math.PI * 1.5),
        fillOuterStrokeArc: (ctx, r) => ctx.fillOuterStrokeArc(C, C, r, 0, Math.PI * 1.5)
    };

    // 1. Infinite radius, thick strokes
    for (const name of ['outerStrokeArc', 'fillOuterStrokeArc']) {
        for (const lineWidth of [2, 3, 10]) {
            const result = render(ctx => ENTRIES[name](ctx, Infinity), ctx => {
                ctx.lineWidth = lineWidth;
            });
            assertEquals(result.painted, 0, `${name} radius Infinity, lineWidth ${lineWidth}: painted pixels`);
        }
    }

    // 2. NaN radius under a non-uniform scale: no pixel, no generic dispatch
    for (const name of Object.keys(ENTRIES)) {
        for (const lineWidth of [1, 2]) {
            const result = render(ctx => ENTRIES[name](ctx, NaN), ctx => {
                ctx.lineWidth = lineWidth;
                ctx.scale(2, 1);
            });
            assertEquals(result.painted, 0, `${name} radius NaN, lineWidth ${lineWidth}, scale(2, 1): painted pixels`);
            assertEquals(result.pathBased, false,
                `${name} radius NaN, lineWidth ${lineWidth}, scale(2, 1): entered the generic pipeline`);
        }
    }
    log('  NaN and infinite radii return at strokeCircle, outerStrokeArc and fillOuterStrokeArc');
});

// Test: roundRect radii-array collapse - the documented first-element-wins contract
// This file will be concatenated into the main test suite
//
// Contract pin for the 2026-08-13 radii decision (DIRECT-RENDERING-SUMMARY.MD
// §9 entry 11). The roundRect entries accept `number|number[]` radii; an array
// is collapsed FIRST-ELEMENT-WINS to one uniform radius (then integer-rounded
// and clamped by RoundedRectUtils.normalizeRadius). This is deliberately NOT
// HTML5 roundRect()'s per-corner semantics - and `[a, b]` must never be
// reinterpreted as per-corner radii or as rx/ry, which would silently CONFLICT
// with the spec meaning if per-corner support ever lands. Pinned here:
//   1. fillRoundRect with [12, 3] renders byte-identically to radius 12
//      (the trailing element is ignored, not averaged, not per-corner).
//   2. Same for strokeRoundRect and fillStrokeRoundRect.

test('roundRect radii array - first-element-wins collapse (documented contract)', () => {
    const W = 80;
    const H = 60;

    function render(draw) {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        ctx.setFillStyle(0, 128, 0, 255);
        ctx.setStrokeStyle(255, 0, 0, 255);
        ctx.lineWidth = 2;
        draw(ctx);
        return surface;
    }

    const CASES = [
        ['fillRoundRect', (r) => (ctx) => ctx.fillRoundRect(10, 10, 60, 40, r)],
        ['strokeRoundRect', (r) => (ctx) => ctx.strokeRoundRect(10, 10, 60, 40, r)],
        ['fillStrokeRoundRect', (r) => (ctx) => ctx.fillStrokeRoundRect(10, 10, 60, 40, r)]
    ];

    for (const [label, mk] of CASES) {
        const arr = render(mk([12, 3]));
        const scalar = render(mk(12));
        for (let i = 0; i < arr.data.length; i++) {
            if (arr.data[i] !== scalar.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(
                    `${label} radii [12,3] differs from radius 12 at ` +
                        `(${pixel % W},${Math.floor(pixel / W)}) - the first-element-wins collapse moved`
                );
            }
        }
        log(`  ${label}: [12,3] === 12 (first-element-wins)`);
    }
});

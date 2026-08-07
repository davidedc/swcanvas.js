// Test: fillStrokeCircle partially off-surface - span containment (no wrapped writes)
// This file will be concatenated into the main test suite
//
// CircleOps.fillStroke_Any used to hand SpanOps UNCLAMPED inner-circle span
// boundaries (its strokeThick_* siblings clamp theirs into the outer span).
// SpanOps does not clamp - callers must - so a circle partially off the left
// edge produced a NEGATIVE span start whose pixel index wrapped into the
// previous row: real memory corruption, silently painting stroke pixels into
// surface regions the circle never touches (132 corrupted pixels in the
// original repro). Contract pinned here:
//   1. CONTAINMENT: for a partially off-surface fillStrokeCircle, every
//      painted pixel lies within the circle's outer radius (+1px tolerance)
//      of its center - nothing anywhere else on the surface.
//   2. POSITION INVARIANCE: the on-surface part of an off-surface render is
//      byte-identical to the same window of the same circle rendered fully
//      on a wider surface (the renderer's arithmetic is translation-exact for
//      integer shifts, so clamping must only ever REMOVE pixels, never move
//      or add them).

test('Circle fillStroke off-surface - span containment and position invariance', () => {
    const W = 40;
    const H = 40;
    const R = 12;
    const LW = 4;

    function renderAt(width, cx, cy, semi) {
        const surface = SWCanvas.Core.Surface(width, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, width, H);
        ctx.setFillStyle(0, 0, 255, semi ? 128 : 255);
        ctx.setStrokeStyle(255, 0, 0, semi ? 128 : 255);
        ctx.lineWidth = LW;
        ctx.fillStrokeCircle(cx, cy, R);
        return surface;
    }

    const cases = [
        ['off-left', -10, 20],
        ['off-right', 45, 20],
        ['off-top', 20, -8],
        ['off-bottom', 20, 47]
    ];

    for (const semi of [false, true]) {
        const a = semi ? ' semi' : ' opaque';
        for (const [label, cx, cy] of cases) {
            const surface = renderAt(W, cx, cy, semi);

            // 1. Containment: painted pixels only within the outer radius.
            const maxDist = R + LW / 2 + 1.5;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const o = y * surface.stride + x * 4;
                    if (
                        surface.data[o] === 255 &&
                        surface.data[o + 1] === 255 &&
                        surface.data[o + 2] === 255
                    ) {
                        continue;
                    }
                    const dx = x - (cx - 0.5);
                    const dy = y - (cy - 0.5);
                    if (Math.sqrt(dx * dx + dy * dy) > maxDist) {
                        throw new Error(
                            `${label}${a}: painted pixel (${x},${y}) is outside the circle - wrapped span write`
                        );
                    }
                }
            }

            // 2. Position invariance for the horizontally-shifted cases: render
            //    the same circle fully on a 3x-wide surface, shifted +W, and
            //    byte-compare the corresponding window. (Vertical cases reuse
            //    the same span math per row, so the horizontal pair covers the
            //    clamped axis; the containment check above covers all four.)
            if (cy === 20) {
                const wide = renderAt(3 * W, cx + W, cy, semi);
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const so = y * surface.stride + x * 4;
                        const wo = y * wide.stride + (x + W) * 4;
                        for (let c = 0; c < 4; c++) {
                            if (surface.data[so + c] !== wide.data[wo + c]) {
                                throw new Error(
                                    `${label}${a}: visible pixels differ from the fully-on-surface render at (${x},${y})`
                                );
                            }
                        }
                    }
                }
            }

            log(`  ${label}${a}: contained, position-invariant`);
        }
    }

    const showcase = renderAt(W, -10, 20, false);
    savePNG(
        showcase,
        'circle-fillstroke-offsurface-containment.basic.png',
        'partially off-surface fillStrokeCircle - no wrapped spans',
        SWCanvas
    );
});

// Test: fillRect fully/partially off-surface - span containment (no wrapped writes)
// This file will be concatenated into the main test suite
//
// RectOpsAA.fill_AA_Opaq's no-clip fast path fills each row with
// TypedArray.fill(color, rowStart, rowStart + rowRight). rowRight comes from
// one-sided clamps (Math.min(right, cx1)), so a rect that lies FULLY LEFT of
// the surface keeps a NEGATIVE rowRight - and TypedArray.fill treats a
// negative end as length+end (it wraps), flooding every overlapping row from
// its start to near the END of the buffer (1987 of 2024 pixels in the
// original repro: a 4x43 rect at x=-85 on a 44x46 surface, reached in
// production through a translated shadow-scratch context whose damage window
// sat right of the icon art). Same class as test 052's fillStrokeCircle
// span-wrap. Contract pinned here:
//   1. A rect FULLY off-surface (any side, and diagonally) paints ZERO pixels
//      - including through a translated context, the production shape.
//   2. A rect PARTIALLY off-surface paints only inside its own bounds
//      (clamping only ever REMOVES pixels, never moves or adds them), and the
//      on-surface part is byte-identical to the same window of the same rect
//      rendered fully on a wider surface.
// Both opacity regimes are exercised: opaque hits the .fill fast path, alpha
// the per-pixel loop.

test('Rect fill off-surface - span containment and position invariance', () => {
    const W = 44;
    const H = 46;

    function freshSurface(width) {
        const surface = SWCanvas.Core.Surface(width, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, width, H);
        return [surface, ctx];
    }

    function countNonWhite(surface, width) {
        let n = 0;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < width; x++) {
                const o = y * surface.stride + x * 4;
                if (
                    surface.data[o] !== 255 ||
                    surface.data[o + 1] !== 255 ||
                    surface.data[o + 2] !== 255
                ) {
                    n++;
                }
            }
        }
        return n;
    }

    // 1. FULLY off-surface rects paint nothing.
    const offCases = [
        ['off-left', -85, -30, 4, 43],
        ['off-left-tall', -10, 0, 5, H],
        ['off-right', W + 3, 10, 6, 12],
        ['off-top', 10, -20, 12, 6],
        ['off-bottom', 10, H + 2, 12, 6],
        ['off-diagonal', -30, -30, 10, 10]
    ];
    for (const semi of [false, true]) {
        const a = semi ? ' semi' : ' opaque';
        for (const [label, x, y, w, h] of offCases) {
            const [surface, ctx] = freshSurface(W);
            ctx.setFillStyle(0, 0, 0, semi ? 128 : 255);
            ctx.fillRect(x, y, w, h);
            const painted = countNonWhite(surface, W);
            if (painted !== 0) {
                throw new Error(
                    `${label}${a}: fully off-surface fillRect painted ${painted} pixel(s) - wrapped span write`
                );
            }
        }
    }

    // 1b. The production shape: the same off-left rect reached through a
    // TRANSLATED context (the shadow-scratch scenario).
    {
        const [surface, ctx] = freshSurface(W);
        ctx.setFillStyle(0, 0, 0, 255);
        ctx.translate(-156, -248);
        ctx.fillRect(71, 218, 4, 43); // lands at (-85,-30) 4x43
        const painted = countNonWhite(surface, W);
        if (painted !== 0) {
            throw new Error(
                `translated off-left: fillRect painted ${painted} pixel(s) - wrapped span write`
            );
        }
    }

    // 2. PARTIALLY off-surface: containment within the rect's own bounds +
    //    position invariance against a fully-on-surface render.
    const partialCases = [
        ['partial-left', -6, 8, 14, 12],
        ['partial-right', W - 7, 20, 15, 9],
        ['partial-top', 6, -5, 10, 12],
        ['partial-bottom', 24, H - 4, 9, 10]
    ];
    for (const semi of [false, true]) {
        const a = semi ? ' semi' : ' opaque';
        for (const [label, x, y, w, h] of partialCases) {
            const [surface, ctx] = freshSurface(W);
            ctx.setFillStyle(0, 0, 0, semi ? 128 : 255);
            ctx.fillRect(x, y, w, h);
            for (let py = 0; py < H; py++) {
                for (let px = 0; px < W; px++) {
                    const o = py * surface.stride + px * 4;
                    const white =
                        surface.data[o] === 255 &&
                        surface.data[o + 1] === 255 &&
                        surface.data[o + 2] === 255;
                    if (white) continue;
                    if (px < x || px >= x + w || py < y || py >= y + h) {
                        throw new Error(
                            `${label}${a}: painted pixel (${px},${py}) outside the rect - wrapped span write`
                        );
                    }
                }
            }

            // Position invariance on a 3x-wide surface, rect shifted +W.
            const [wide, wctx] = freshSurface(3 * W);
            wctx.setFillStyle(0, 0, 0, semi ? 128 : 255);
            wctx.fillRect(x + W, y, w, h);
            for (let py = 0; py < H; py++) {
                for (let px = 0; px < W; px++) {
                    const o = py * surface.stride + px * 4;
                    const wo = py * wide.stride + (px + W) * 4;
                    for (let c = 0; c < 4; c++) {
                        if (surface.data[o + c] !== wide.data[wo + c]) {
                            throw new Error(
                                `${label}${a}: position invariance broken at (${px},${py}) channel ${c}`
                            );
                        }
                    }
                }
            }
        }
    }
});

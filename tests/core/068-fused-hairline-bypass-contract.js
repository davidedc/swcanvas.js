// Test: fused entries' stroke halves bypass the hairline faintness rule (pinned contract)
// This file will be concatenated into the main test suite
//
// Documented-decision guard, NOT a bug fix. The hairline rule (a sub-pixel
// stroke draws AT one pixel with the missing width taken out of the OPACITY -
// class-level doctrine in Context2D.js, pinned for the five STANDALONE stroke
// entries by tests/core/055) is DELIBERATELY not wired into the fused
// entries: fillStrokeRect, fillStrokeRoundRect, fillStrokeCircle and
// fillOuterStrokeArc pass raw globalAlpha into their fillStroke_* renderers,
// whose lineWidth <= 1 arms paint at FULL weight. Rationale (declared in the
// doctrine comment): no hairline caller exists on the fused surface, and
// wiring it would add a moving part to an untested surface for nobody. This
// test converts that declaration into a pinned contract so any future change
// is a conscious decision:
//   - the fused entry's sub-pixel stroke half paints PURE stroke colour
//     (full weight, zero faint pixels) - note the circle/arc fused rings can
//     be PARTIAL at sub-pixel widths (the degenerate annulus scan); the pin
//     is about WEIGHT, not coverage;
//   - the STANDALONE twin at the same width paints ONLY faint pixels
//     (the tests/core/055 rule).

test('Fused entries - stroke halves stay full-weight at sub-pixel widths', () => {
    const W = 90;
    const H = 90;

    function render(draw) {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        ctx.setFillStyle(0, 128, 0, 255);
        ctx.setStrokeStyle(255, 0, 0, 255);
        ctx.lineWidth = 0.5;
        draw(ctx);
        return surface;
    }

    // Classify red stroke pixels: pure = full-weight (255,0,0); faint = the
    // hairline rule's 0.5-alpha blend over white (255,~127,~127). Green fill
    // and white background match neither.
    function countStrokePixels(surface) {
        let pure = 0,
            faint = 0;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                const r = surface.data[o],
                    g = surface.data[o + 1],
                    b = surface.data[o + 2];
                if (r === 255 && g === 0 && b === 0) pure++;
                else if (r === 255 && g >= 100 && g <= 156 && b >= 100 && b <= 156) faint++;
            }
        }
        return { pure, faint };
    }

    const CASES = [
        ['fillStrokeRect', (ctx) => ctx.fillStrokeRect(20, 20, 40, 30), (ctx) => ctx.strokeRect(20, 20, 40, 30)],
        [
            'fillStrokeRoundRect',
            (ctx) => ctx.fillStrokeRoundRect(20, 20, 40, 30, 6),
            (ctx) => ctx.strokeRoundRect(20, 20, 40, 30, 6)
        ],
        ['fillStrokeCircle', (ctx) => ctx.fillStrokeCircle(45, 45, 18), (ctx) => ctx.strokeCircle(45, 45, 18)],
        [
            'fillOuterStrokeArc',
            (ctx) => ctx.fillOuterStrokeArc(45, 45, 18, Math.PI, 2 * Math.PI),
            (ctx) => ctx.outerStrokeArc(45, 45, 18, Math.PI, 2 * Math.PI)
        ]
    ];

    for (const [label, fused, standalone] of CASES) {
        const f = countStrokePixels(render(fused));
        if (f.pure === 0) {
            throw new Error(`${label}: no full-weight stroke pixels - the fused sub-pixel stroke vanished`);
        }
        if (f.faint !== 0) {
            throw new Error(
                `${label}: ${f.faint} faint stroke pixels - the hairline rule got wired into the fused ` +
                    `path; that contradicts the declared full-weight contract (update the doctrine + this pin together)`
            );
        }

        const s = countStrokePixels(render(standalone));
        if (s.pure !== 0 || s.faint === 0) {
            throw new Error(
                `${label} standalone twin: pure=${s.pure} faint=${s.faint} - ` +
                    `the standalone hairline faintness rule (tests/core/055) regressed`
            );
        }
        log(`  ${label}: fused ${f.pure} full-weight px / standalone ${s.faint} faint px`);
    }
});

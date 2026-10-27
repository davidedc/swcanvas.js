// Test: the direct circle FILL samples pixel centers - at every diameter, alignment and radius
// This file will be concatenated into the main test suite
//
// Pins the coverage rule of the direct circle fill (CircleOps header): a pixel is
// filled iff its center (x + 0.5, y + 0.5) lies STRICTLY inside the circle, so a
// center exactly on the boundary stays out on every side alike. The fixture spans
// what a narrow one misses - a fill that walks integer row offsets from a snapped
// center can agree with this rule at one alignment and diameter and still drop
// whole rows of pixels (or add stray ones) at the next:
//   - every diameter 1..40, at integer radii AND radii a quarter pixel larger;
//   - four centre alignments: pixel corner, pixel center, mixed, fractional;
//   - opaque (fill_Opaq) and translucent (fill_Alpha) paint;
//   - a uniform scale(2) context (the direct path pre-multiplies the CTM);
// and asserts that the fused entry's fill half (fillStrokeCircle with a transparent
// stroke) and a full-circle fillArc (delegated to the same renderer) paint the very
// same pixel set - one rule for every direct circle fill.
// Then: a NaN or infinite radius paints nothing (an infinite one would otherwise
// sample every pixel center as inside) on the three fill entries.

test('Circle fill - pixel-center coverage at every diameter, alignment and radius', () => {
    const W = 72;
    const H = 72;
    const C = 36;
    const TAU = Math.PI * 2;
    const ALIGNMENTS = [
        ['pixel corner', 0, 0],
        ['pixel center', 0.5, 0.5],
        ['mixed', 0, 0.5],
        ['fractional', 0.3, 0.7]
    ];

    function coverage(draw) {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        draw(ctx);
        const set = new Set();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (surface.data[y * surface.stride + x * 4 + 3] !== 0) set.add(y * W + x);
            }
        }
        return set;
    }

    function pixelCenterDisk(cx, cy, r) {
        const set = new Set();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const dx = x + 0.5 - cx;
                const dy = y + 0.5 - cy;
                if (dx * dx + dy * dy < r * r) set.add(y * W + x);
            }
        }
        return set;
    }

    function assertSameSet(label, got, want) {
        const missing = [];
        const extra = [];
        for (const p of want) if (!got.has(p)) missing.push(`(${p % W},${Math.floor(p / W)})`);
        for (const p of got) if (!want.has(p)) extra.push(`(${p % W},${Math.floor(p / W)})`);
        if (missing.length || extra.length) {
            throw new Error(
                `${label}: ${got.size} px, expected ${want.size} - missing [${missing.slice(0, 6).join(' ')}` +
                    `${missing.length > 6 ? ' ...' : ''}] extra [${extra.slice(0, 6).join(' ')}${extra.length > 6 ? ' ...' : ''}]`
            );
        }
    }

    const ENTRIES = [
        ['fillCircle opaque', (ctx, cx, cy, r) => {
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillCircle(cx, cy, r);
        }],
        ['fillCircle translucent', (ctx, cx, cy, r) => {
            ctx.setFillStyle(0, 0, 255, 128);
            ctx.fillCircle(cx, cy, r);
        }],
        ['fillStrokeCircle fill half', (ctx, cx, cy, r) => {
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.setStrokeStyle(0, 0, 0, 0);
            ctx.fillStrokeCircle(cx, cy, r);
        }],
        ['fillArc full circle', (ctx, cx, cy, r) => {
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillArc(cx, cy, r, 0, TAU);
        }]
    ];

    let cases = 0;
    for (const [alignName, ox, oy] of ALIGNMENTS) {
        for (const extra of [0, 0.25]) {
            for (let d = 1; d <= 40; d++) {
                const r = d / 2 + extra;
                const cx = C + ox;
                const cy = C + oy;
                const want = pixelCenterDisk(cx, cy, r);
                for (const [entryName, draw] of ENTRIES) {
                    assertSameSet(
                        `${entryName} r=${r} at ${alignName} (${cx},${cy})`,
                        coverage(ctx => draw(ctx, cx, cy, r)),
                        want
                    );
                    cases++;
                }
                // Under scale(2): the same device geometry from half-size user coordinates
                assertSameSet(
                    `fillCircle under scale(2) device r=${r} at ${alignName} (${cx},${cy})`,
                    coverage(ctx => {
                        ctx.scale(2, 2);
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.fillCircle(cx / 2, cy / 2, r / 2);
                    }),
                    want
                );
                cases++;
            }
        }
    }
    log(`  ${cases} renders: every direct circle fill entry paints exactly the pixel-center-sampled disk`);

    // Non-finite radii paint nothing. (strokeCircle / outerStrokeArc at lineWidth 1
    // are left out on purpose: an infinite radius there never terminates the
    // Bresenham walk unless the entry guard holds, so a regression would hang the
    // suite instead of failing this test.)
    const NONFINITE_ENTRIES = [
        ['fillCircle', (ctx, r) => ctx.fillCircle(C, C, r)],
        ['fillStrokeCircle', (ctx, r) => {
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 2;
            ctx.fillStrokeCircle(C, C, r);
        }],
        ['fillArc full circle', (ctx, r) => ctx.fillArc(C, C, r, 0, TAU)]
    ];
    for (const [entryName, draw] of NONFINITE_ENTRIES) {
        for (const r of [Infinity, NaN]) {
            let painted;
            try {
                painted = coverage(ctx => {
                    ctx.setFillStyle(0, 0, 255, 255);
                    draw(ctx, r);
                });
            } catch (e) {
                throw new Error(`${entryName} radius ${r}: threw "${e.message}" instead of drawing nothing`);
            }
            if (painted.size !== 0) {
                throw new Error(`${entryName} radius ${r}: painted ${painted.size} px, expected nothing`);
            }
        }
    }
    log('  NaN and infinite radii draw nothing on fillCircle, fillStrokeCircle and a full-circle fillArc');
});

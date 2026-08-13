// Test: fillRect dispatches to the generic pipeline under EVERY CTM (decision pin)
// This file will be concatenated into the main test suite
//
// DECISION RECORD PIN, not a bug guard. fillRect once had two direct fill arms
// (RectOpsAA for axis-aligned CTMs, RectOpsRot for tilted uniform-scale CTMs)
// and a rejected third (the general-affine quad arm - benchmarked at 0.99x-1.02x,
// dead parity, DIRECT-RENDERING-SUMMARY.MD §9 entry 10). The remaining two were
// then ALSO removed on benchmark evidence: disable-and-benchmark measured the
// generic pipeline's tier-0-wired solid span arm (PolygonFiller._fillPolygonsDirect)
// at parity for tilted fills (1.00-1.01x) and within 2-6% on small/mid
// alpha axis-aligned fills - a cost the owner explicitly accepted for one
// rect-fill implementation (§9 entries 15-16;
// plans/one-rect-fill-pipeline-and-fill-arm-removal.md). Rect FILLS are now
// uniformly generic across ALL CTM classes; the direct rect machinery lives on
// only in strokes and the fused fillStroke entries (out of scope, structural wins).
//
// This test pins the decision structurally: fillRect dispatches generic under
// every CTM class. If it starts failing, someone re-introduced a rect-fill
// fast path - do that only with fresh §2.1-grade benchmark evidence, and then
// update this pin and the §9 record together.

test('fillRect - dispatches generic under every CTM class (fill-arm-removal pin)', () => {
    const W = 100;
    const H = 60;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    const ALL_CTMS = [
        ['identity', (ctx) => {}],
        ['integer translate', (ctx) => ctx.translate(10, 5)],
        ['axis-aligned scale', (ctx) => ctx.scale(2, 1)],
        [
            '90-degree rotation',
            (ctx) => {
                ctx.translate(50, 30);
                ctx.rotate(Math.PI / 2);
            }
        ],
        [
            'tilted uniform scale',
            (ctx) => {
                ctx.translate(50, 30);
                ctx.rotate(0.5);
                ctx.scale(1.5, 1.5);
            }
        ],
        ['shear', (ctx) => ctx.transform(1, 0, 0.5, 1, 5, 0)],
        [
            'rotation + non-uniform scale',
            (ctx) => {
                ctx.translate(50, 30);
                ctx.rotate(0.5);
                ctx.scale(2, 1);
            }
        ]
    ];

    for (const [label, applyCtm] of ALL_CTMS) {
        for (const alpha of [255, 128]) {
            const { ctx } = newCtx();
            ctx.save();
            applyCtm(ctx);
            ctx.setFillStyle(255, 0, 0, alpha);
            SWCanvas.Core.Context2D.resetPathBasedFlag();
            ctx.fillRect(-10, -8, 20, 16);
            ctx.restore();
            if (!SWCanvas.Core.Context2D.wasPathBasedUsed()) {
                throw new Error(
                    `fillRect under ${label} (alpha ${alpha}) took a direct path - a rect-fill ` +
                        `fast path is back without the §9 fill-arm-removal record being revisited`
                );
            }
        }
        log(`  ${label}: generic (as decided)`);
    }
});

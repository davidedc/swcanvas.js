// Test: fillRect under GENERAL affine CTMs stays on the generic pipeline (decision pin)
// This file will be concatenated into the main test suite
//
// DECISION RECORD PIN, not a bug guard. A transformed rectangle is a convex
// parallelogram, and a direct quad arm (corner transform ->
// QuadScanOps.fillQuad) was implemented and benchmarked for the CTM class
// failing BOTH isAxisAligned and isUniformScale (shear, mirror-with-rotation,
// rotation + non-uniform scale). benchmark-session over the rect-affine perf
// cases measured NO win - 0.99x-1.02x across every size and opacity, dead
// parity: the generic pipeline's solid-fill span arm
// (PolygonFiller._fillPolygonsDirect, tier-0-wired) is already direct-grade
// for this workload, and even the tiny-shape per-call-overhead case showed
// nothing. Landing it would have added a new dispatch surface, a new
// UNWIRED-clip arm (fillQuad has no clipRect concept), and a rasterization-
// convention change on the moved fills, for zero measured benefit - so the
// extension was REJECTED ON EVIDENCE (DIRECT-RENDERING-SUMMARY.MD §9,
// 2026-08-13; perf case: tests/direct-rendering/perf-cases/rect-affine-perf.js).
//
// This test pins the decision structurally: general-affine fillRects dispatch
// to the generic pipeline. If it starts failing, someone re-introduced a
// general-affine direct arm - do that only with fresh benchmark evidence, and
// then update this pin and the §9 record together.

test('fillRect general-affine CTMs - stays generic (rejected-extension pin)', () => {
    const W = 100;
    const H = 60;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    const GENERAL_CTMS = [
        ['shear', (ctx) => ctx.transform(1, 0, 0.5, 1, 5, 0)],
        [
            'rotation + non-uniform scale',
            (ctx) => {
                ctx.translate(50, 30);
                ctx.rotate(0.5);
                ctx.scale(2, 1);
            }
        ],
        [
            'mirror + rotation',
            (ctx) => {
                ctx.translate(50, 30);
                ctx.rotate(0.3);
                ctx.scale(-1, 1);
            }
        ]
    ];

    for (const [label, applyCtm] of GENERAL_CTMS) {
        const { ctx } = newCtx();
        ctx.save();
        applyCtm(ctx);
        ctx.setFillStyle(255, 0, 0, 255);
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        ctx.fillRect(-10, -8, 20, 16);
        ctx.restore();
        if (!SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error(
                `fillRect under ${label} took a direct path - the rejected general-affine ` +
                    `extension is back without its §9 decision record being revisited`
            );
        }
        log(`  ${label}: generic (as decided)`);
    }

    // The two DIRECT classes stay direct (guards the decision's boundary):
    // axis-aligned 90-degree-rotated non-uniform, and tilted uniform.
    {
        const { ctx } = newCtx();
        ctx.save();
        ctx.translate(50, 30);
        ctx.rotate(Math.PI / 2);
        ctx.scale(2, 1);
        ctx.setFillStyle(255, 0, 0, 255);
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        ctx.fillRect(-10, -8, 20, 16);
        ctx.restore();
        if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error('90-rotated non-uniform fillRect fell to the generic pipeline (AA arm regressed)');
        }
        log('  90-degree-rotated non-uniform: still direct (AA arm)');
    }
    {
        const { ctx } = newCtx();
        ctx.save();
        ctx.translate(50, 30);
        ctx.rotate(0.5);
        ctx.scale(1.5, 1.5);
        ctx.setFillStyle(255, 0, 0, 255);
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        ctx.fillRect(-10, -8, 20, 16);
        ctx.restore();
        if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error('tilted uniform-scale fillRect fell to the generic pipeline (Rot arm regressed)');
        }
        log('  tilted uniform scale: still direct (Rot arm)');
    }
});

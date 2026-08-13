// Test: circle/arc/line generic fallbacks render correctly under a non-identity CTM
// This file will be concatenated into the main test suite
//
// Regression guard for the retired LEGACY fallback generation. The direct-shape
// entries (fillCircle, strokeCircle, fillStrokeCircle, fillArc, outerStrokeArc,
// fillOuterStrokeArc, strokeLine) fall back to the generic pipeline for
// gradient/pattern paints and non-source-over compositing. The legacy fallbacks
// built the current default path from already-DEVICE-space coordinates - but the
// default path bakes the live CTM into every point at build time, so the CTM was
// applied TWICE (an identity swap at some sites came after the bake and only
// prevented a third application). Under translate(30,30) a gradient
// fillCircle(20,20,10) rendered at center (80,80) instead of (50,50).
// The fallbacks now build an un-baked USER-space SWPath2D and pass it as an
// external path, so geometry and paint share one application of the CTM.
// Contract pinned here:
//   1. POSITION: gradient fillCircle under translate lands at the translated
//      center (not double-translated).
//   2. EQUIVALENCE: each entry's fallback renders byte-identically to the same
//      geometry drawn explicitly through an external SWPath2D under the same
//      CTM - gradient paints under translate+rotate for all seven entries, and
//      the non-source-over composite route for fillOuterStrokeArc.

test('Circle/arc/line generic fallbacks - correct geometry and paint under CTM', () => {
    const W = 120;
    const H = 100;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function gradient(ctx) {
        const g = ctx.createLinearGradient(10, 10, 50, 50);
        g.addColorStop(0, 'red');
        g.addColorStop(1, 'blue');
        return g;
    }

    function bbox(surface) {
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
        return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }

    function assertBytesEqual(label, sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
            }
        }
    }

    // 1. Position: gradient fillCircle(20,20,10) under translate(30,30) must
    //    land at (50,50). The legacy fallback double-applied the translate and
    //    drew at (80,80).
    {
        const { surface, ctx } = newCtx();
        ctx.save();
        ctx.translate(30, 30);
        ctx.setFillStyle(gradient(ctx));
        ctx.fillCircle(20, 20, 10);
        ctx.restore();
        const b = bbox(surface);
        if (Math.abs(b.cx - 50) > 2 || Math.abs(b.cy - 50) > 2) {
            throw new Error(
                `gradient fillCircle @translate(30,30): center (${b.cx},${b.cy}), ` +
                    `expected ~(50,50) (double-applied CTM lands at (80,80))`
            );
        }
        log(`  gradient fillCircle @translate(30,30): center (${b.cx},${b.cy})`);
    }

    // 2. Byte-equivalence with the explicit external-path render, under
    //    translate(10,6) + rotate(0.5), gradient paint (forces the fallback).
    const CASES = [
        [
            'fillCircle (gradient)',
            (ctx) => {
                ctx.setFillStyle(gradient(ctx));
                ctx.fillCircle(30, 40, 15);
            },
            (ctx) => {
                ctx.setFillStyle(gradient(ctx));
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 40, 15, 0, 2 * Math.PI);
                ctx.fill(p);
            }
        ],
        [
            'strokeCircle (gradient)',
            (ctx) => {
                ctx.setStrokeStyle(gradient(ctx));
                ctx.lineWidth = 3;
                ctx.strokeCircle(30, 40, 15);
            },
            (ctx) => {
                ctx.setStrokeStyle(gradient(ctx));
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 40, 15, 0, 2 * Math.PI);
                ctx.stroke(p);
            }
        ],
        [
            'fillStrokeCircle (gradient fill + gradient stroke)',
            (ctx) => {
                ctx.setFillStyle(gradient(ctx));
                ctx.setStrokeStyle(gradient(ctx));
                ctx.lineWidth = 3;
                ctx.fillStrokeCircle(30, 40, 15);
            },
            (ctx) => {
                ctx.setFillStyle(gradient(ctx));
                ctx.setStrokeStyle(gradient(ctx));
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 40, 15, 0, 2 * Math.PI);
                ctx.fill(p);
                ctx.stroke(p);
            }
        ],
        [
            'strokeLine (gradient)',
            (ctx) => {
                ctx.setStrokeStyle(gradient(ctx));
                ctx.lineWidth = 3;
                ctx.strokeLine(15, 20, 60, 55);
            },
            (ctx) => {
                ctx.setStrokeStyle(gradient(ctx));
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(15, 20);
                p.lineTo(60, 55);
                ctx.stroke(p);
            }
        ],
        [
            'fillArc (gradient)',
            (ctx) => {
                ctx.setFillStyle(gradient(ctx));
                ctx.fillArc(30, 40, 15, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setFillStyle(gradient(ctx));
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(30, 40);
                p.arc(30, 40, 15, 0.3, 2.2, false);
                p.closePath();
                ctx.fill(p);
            }
        ],
        [
            'outerStrokeArc (gradient)',
            (ctx) => {
                ctx.setStrokeStyle(gradient(ctx));
                ctx.lineWidth = 3;
                ctx.outerStrokeArc(30, 40, 15, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setStrokeStyle(gradient(ctx));
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 40, 15, 0.3, 2.2, false);
                ctx.stroke(p);
            }
        ],
        [
            'fillOuterStrokeArc (solid colors, xor composite)',
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                ctx.globalCompositeOperation = 'xor';
                ctx.fillOuterStrokeArc(30, 40, 15, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                ctx.globalCompositeOperation = 'xor';
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(30, 40);
                p.arc(30, 40, 15, 0.3, 2.2, false);
                p.closePath();
                ctx.fill(p);
                const sp = new SWCanvas.Core.SWPath2D();
                sp.arc(30, 40, 15, 0.3, 2.2, false);
                ctx.stroke(sp);
            }
        ]
    ];
    for (const [label, direct, generic] of CASES) {
        const a = newCtx();
        a.ctx.save();
        a.ctx.translate(10, 6);
        a.ctx.rotate(0.5);
        direct(a.ctx);
        a.ctx.restore();
        const b = newCtx();
        b.ctx.save();
        b.ctx.translate(10, 6);
        b.ctx.rotate(0.5);
        generic(b.ctx);
        b.ctx.restore();
        assertBytesEqual(`${label} @translate+rotate vs external path`, a.surface, b.surface);
        log(`  ${label} @translate+rotate: === external-path render`);
    }

    const showcase = newCtx();
    showcase.ctx.save();
    showcase.ctx.translate(30, 30);
    showcase.ctx.setFillStyle(gradient(showcase.ctx));
    showcase.ctx.fillCircle(20, 20, 10);
    showcase.ctx.restore();
    savePNG(
        showcase.surface,
        'circle-gradient-fallback-under-translate.basic.png',
        'gradient fillCircle under translate(30,30) - correct position',
        SWCanvas
    );
});

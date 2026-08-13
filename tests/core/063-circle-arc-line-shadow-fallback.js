// Test: circle/arc/line direct entries render ctx shadows via the generic fallback
// This file will be concatenated into the main test suite
//
// Regression guard. The rect/roundRect/stadium families gate direct rendering
// through _canUseDirectRendering, which contains _noShadow - but the circle,
// arc and line entries hand-roll their gates and were shadow-blind: the direct
// renderers cannot draw a ctx shadow (no shadow code exists in src/renderers/),
// so `shadowBlur = 5; fillCircle(...)` drew shadowless while the same state
// with fillRect(...) rendered the shadow. The hand-rolled gates now carry the
// _noShadow term, routing any active shadow to the (CTM-correct, tests/core/059)
// generic fallback. Contract pinned per entry, under a translated CTM:
//   1. the shadowed render is byte-identical to the same geometry drawn
//      explicitly through external SWPath2Ds with the same shadow state, and
//   2. the shadowed render differs from the shadowless one (the shadow is
//      actually there - pre-fix these were byte-identical).

test('Circle/arc/line entries - active shadow routes to generic fallback and renders', () => {
    const W = 120;
    const H = 110;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function setShadow(ctx) {
        ctx.setShadowColor(0, 0, 255, 255);
        ctx.setShadowBlur(0);
        ctx.setShadowOffsetX(8);
        ctx.setShadowOffsetY(8);
    }

    function bytesEqual(sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) return { equal: false, i };
        }
        return { equal: true };
    }

    // [label, direct draw, external-path reference draw]
    const CASES = [
        [
            'fillCircle',
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.fillCircle(30, 30, 10);
            },
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 30, 10, 0, 2 * Math.PI);
                ctx.fill(p);
            }
        ],
        [
            'strokeCircle',
            (ctx) => {
                ctx.setStrokeStyle(0, 128, 0, 255);
                ctx.lineWidth = 3;
                ctx.strokeCircle(30, 30, 10);
            },
            (ctx) => {
                ctx.setStrokeStyle(0, 128, 0, 255);
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 30, 10, 0, 2 * Math.PI);
                ctx.stroke(p);
            }
        ],
        [
            'fillStrokeCircle',
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(128, 0, 128, 255);
                ctx.lineWidth = 3;
                ctx.fillStrokeCircle(30, 30, 10);
            },
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(128, 0, 128, 255);
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 30, 10, 0, 2 * Math.PI);
                ctx.fill(p);
                ctx.stroke(p);
            }
        ],
        [
            'fillArc',
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.fillArc(30, 30, 14, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(30, 30);
                p.arc(30, 30, 14, 0.3, 2.2, false);
                p.closePath();
                ctx.fill(p);
            }
        ],
        [
            'outerStrokeArc',
            (ctx) => {
                ctx.setStrokeStyle(0, 128, 0, 255);
                ctx.lineWidth = 3;
                ctx.outerStrokeArc(30, 30, 14, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setStrokeStyle(0, 128, 0, 255);
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 30, 14, 0.3, 2.2, false);
                ctx.stroke(p);
            }
        ],
        [
            'fillOuterStrokeArc',
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(128, 0, 128, 255);
                ctx.lineWidth = 3;
                ctx.fillOuterStrokeArc(30, 30, 14, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(128, 0, 128, 255);
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(30, 30);
                p.arc(30, 30, 14, 0.3, 2.2, false);
                p.closePath();
                ctx.fill(p);
                const sp = new SWCanvas.Core.SWPath2D();
                sp.arc(30, 30, 14, 0.3, 2.2, false);
                ctx.stroke(sp);
            }
        ],
        [
            'strokeLine',
            (ctx) => {
                ctx.setStrokeStyle(0, 128, 0, 255);
                ctx.lineWidth = 3;
                ctx.strokeLine(15, 20, 60, 50);
            },
            (ctx) => {
                ctx.setStrokeStyle(0, 128, 0, 255);
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(15, 20);
                p.lineTo(60, 50);
                ctx.stroke(p);
            }
        ]
    ];

    for (const [label, direct, generic] of CASES) {
        // A: direct entry, shadow active.
        const a = newCtx();
        a.ctx.save();
        a.ctx.translate(10, 10);
        setShadow(a.ctx);
        direct(a.ctx);
        a.ctx.restore();

        // B: external-path reference, same shadow state.
        const b = newCtx();
        b.ctx.save();
        b.ctx.translate(10, 10);
        setShadow(b.ctx);
        generic(b.ctx);
        b.ctx.restore();

        // C: direct entry, no shadow.
        const c = newCtx();
        c.ctx.save();
        c.ctx.translate(10, 10);
        direct(c.ctx);
        c.ctx.restore();

        const ab = bytesEqual(a.surface, b.surface);
        if (!ab.equal) {
            const pixel = Math.floor(ab.i / 4);
            throw new Error(
                `${label} shadowed: differs from external-path render at (${pixel % W},${Math.floor(pixel / W)})`
            );
        }
        const ac = bytesEqual(a.surface, c.surface);
        if (ac.equal) {
            throw new Error(`${label}: shadowed render identical to shadowless render (shadow silently dropped)`);
        }
        log(`  ${label}: shadow renders, === external-path render`);
    }
});

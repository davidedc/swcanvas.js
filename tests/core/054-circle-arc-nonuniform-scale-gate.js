// Test: circle/arc direct entries under NON-uniform scale - gate to the generic pipeline
// This file will be concatenated into the main test suite
//
// The direct circle/arc paths scale their radius by the transform's uniform
// scale (a geometric mean). Ungated, a non-uniform transform therefore drew a
// CIRCLE of radius r*sqrt(sx*sy) where an ellipse of r*sx by r*sy belongs -
// silently, and diverging from what the same call renders through the generic
// path pipeline (and from the native-canvas polyfills, which are always
// shape-correct). The entries now gate on isUniformScale and route ineligible
// calls to an un-baked user-space SWPath2D under the CTM, mirroring
// fillRoundRect/fillStadium. Contract pinned here:
//   1. SHAPE: under scale(2,1), fillCircle covers an ellipse's bounding box
//      (~4r x 2r), not the old wrong circle's (~2.83r square).
//   2. EQUIVALENCE: each gated entry renders byte-identically to the same
//      geometry drawn explicitly through an external Path2D under the same
//      transform - fill, stroke, fillStroke, and the three arc entries.
//   3. UNIFORM UNAFFECTED: rotation + uniform scale still takes the direct
//      path (pinned structurally by the path-based-rendering flag).

test('Circle/arc direct rendering - non-uniform scale gates to generic pipeline', () => {
    const W = 120;
    const H = 80;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
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
        return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }

    function assertBytesEqual(label, sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
            }
        }
    }

    // 1. Shape: an ellipse's box, not the old circle's. r=15 under scale(2,1):
    //    ellipse box ~60x30; the ungated path drew ~42x42 (r*sqrt(2) circle).
    {
        const { surface, ctx } = newCtx();
        ctx.save();
        ctx.scale(2, 1);
        ctx.setFillStyle(255, 0, 0, 255);
        ctx.fillCircle(30, 40, 15);
        ctx.restore();
        const b = bbox(surface);
        if (Math.abs(b.w - 60) > 2 || Math.abs(b.h - 30) > 2) {
            throw new Error(`fillCircle @scale(2,1): bbox ${b.w}x${b.h}, expected ~60x30 (ellipse, not circle)`);
        }
        log(`  fillCircle @scale(2,1): ellipse box ${b.w}x${b.h}`);
    }

    // 2. Byte-equivalence with the explicit external-path render.
    const CASES = [
        [
            'fillCircle',
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.fillCircle(30, 40, 15);
            },
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 255);
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 40, 15, 0, 2 * Math.PI);
                ctx.fill(p);
            }
        ],
        [
            'strokeCircle',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                ctx.strokeCircle(30, 40, 15);
            },
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 40, 15, 0, 2 * Math.PI);
                ctx.stroke(p);
            }
        ],
        [
            'fillStrokeCircle',
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                ctx.fillStrokeCircle(30, 40, 15);
            },
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 40, 15, 0, 2 * Math.PI);
                ctx.fill(p);
                ctx.stroke(p);
            }
        ],
        [
            'fillArc',
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.fillArc(30, 40, 15, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(30, 40);
                p.arc(30, 40, 15, 0.3, 2.2, false);
                p.closePath();
                ctx.fill(p);
            }
        ],
        [
            'outerStrokeArc',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                ctx.outerStrokeArc(30, 40, 15, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(30, 40, 15, 0.3, 2.2, false);
                ctx.stroke(p);
            }
        ],
        [
            'fillOuterStrokeArc',
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
                ctx.fillOuterStrokeArc(30, 40, 15, 0.3, 2.2);
            },
            (ctx) => {
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
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
        a.ctx.scale(2, 1);
        direct(a.ctx);
        a.ctx.restore();
        const b = newCtx();
        b.ctx.save();
        b.ctx.scale(2, 1);
        generic(b.ctx);
        b.ctx.restore();
        assertBytesEqual(`${label} @scale(2,1) vs external path`, a.surface, b.surface);
        log(`  ${label} @scale(2,1): === external-path render`);
    }

    // 3. Rotation + uniform scale still goes direct.
    {
        const { ctx } = newCtx();
        // Reset AFTER the fixture background: fillRect is generic since the
        // fill-arm removal, so a pre-fixture reset would see ITS flag, not the
        // circle's.
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        ctx.save();
        ctx.translate(60, 40);
        ctx.rotate(0.5);
        ctx.scale(1.5, 1.5);
        ctx.setFillStyle(255, 0, 0, 255);
        ctx.fillCircle(0, 0, 10);
        ctx.restore();
        if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error('fillCircle under rotation+uniform scale fell to the path pipeline');
        }
        log('  rotation + uniform scale: still direct');
    }

    const showcase = newCtx();
    showcase.ctx.save();
    showcase.ctx.scale(2, 1);
    showcase.ctx.setFillStyle(0, 0, 255, 255);
    showcase.ctx.fillCircle(25, 40, 15);
    showcase.ctx.restore();
    savePNG(showcase.surface, 'circle-nonuniform-gate-ellipse.basic.png', 'fillCircle under scale(2,1) - correct ellipse', SWCanvas);
});

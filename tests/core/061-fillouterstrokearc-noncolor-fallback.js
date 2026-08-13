// Test: fillOuterStrokeArc falls back (not drops) gradient/pattern halves
// This file will be concatenated into the main test suite
//
// Regression guard. fillOuterStrokeArc's fallback tail reused hasFill/hasStroke,
// which embed `instanceof Color` - correct for the direct arm's null-paint
// slots, but as FALLBACK guards they silently dropped any non-Color half:
// gradient fill + solid stroke drew the stroke only, and gradient fill +
// gradient stroke drew NOTHING AT ALL. It was the only family member with this
// hole (fillStrokeCircle/fillStrokeRect/fillStrokeRoundRect decompose into
// single-purpose entries). The fallback now recomputes presence from paint
// existence. Contract pinned here: each mixed/non-Color paint combination
// renders byte-identically to the same geometry drawn explicitly through
// external SWPath2Ds under the same CTM - and actually renders (non-empty).

test('fillOuterStrokeArc - gradient/pattern halves fall back instead of dropping', () => {
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

    function nonWhiteCount(surface) {
        let n = 0;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) n++;
            }
        }
        return n;
    }

    function assertBytesEqual(label, sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
            }
        }
    }

    // Each case: [label, set fill style, set stroke style]. The reference
    // renders the same pie fill + outer-arc stroke through external paths.
    const CASES = [
        [
            'gradient fill + solid stroke',
            (ctx) => ctx.setFillStyle(gradient(ctx)),
            (ctx) => ctx.setStrokeStyle(255, 0, 0, 255)
        ],
        [
            'solid fill + gradient stroke',
            (ctx) => ctx.setFillStyle(0, 128, 0, 255),
            (ctx) => ctx.setStrokeStyle(gradient(ctx))
        ],
        [
            'gradient fill + gradient stroke',
            (ctx) => ctx.setFillStyle(gradient(ctx)),
            (ctx) => ctx.setStrokeStyle(gradient(ctx))
        ]
    ];

    for (const [label, setFill, setStroke] of CASES) {
        const a = newCtx();
        a.ctx.save();
        a.ctx.translate(10, 6);
        a.ctx.rotate(0.5);
        setFill(a.ctx);
        setStroke(a.ctx);
        a.ctx.lineWidth = 3;
        a.ctx.fillOuterStrokeArc(30, 40, 15, 0.3, 2.2);
        a.ctx.restore();

        const n = nonWhiteCount(a.surface);
        if (n === 0) {
            throw new Error(`fillOuterStrokeArc (${label}): drew NOTHING (non-Color half dropped)`);
        }

        const b = newCtx();
        b.ctx.save();
        b.ctx.translate(10, 6);
        b.ctx.rotate(0.5);
        setFill(b.ctx);
        setStroke(b.ctx);
        b.ctx.lineWidth = 3;
        const p = new SWCanvas.Core.SWPath2D();
        p.moveTo(30, 40);
        p.arc(30, 40, 15, 0.3, 2.2, false);
        p.closePath();
        b.ctx.fill(p);
        const sp = new SWCanvas.Core.SWPath2D();
        sp.arc(30, 40, 15, 0.3, 2.2, false);
        b.ctx.stroke(sp);
        b.ctx.restore();

        assertBytesEqual(`fillOuterStrokeArc (${label}) vs external paths`, a.surface, b.surface);
        log(`  ${label}: ${n}px, === external-path render`);
    }
});

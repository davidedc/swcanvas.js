// Test: setLineDash is honoured by the immediate-mode stroke entries
// This file will be concatenated into the main test suite
//
// Regression guard for the dash policy decision: dashed strokes GATE TO THE
// GENERIC PATH. The direct stroke renderers draw solid runs only and ignored
// lineDash entirely - and strokeRect was dash-blind on BOTH arms, because its
// generic fallback hand-built the stroke props and omitted the dash fields.
// Every direct stroke arm (strokeRect, strokeRoundRect, strokeCircle,
// outerStrokeArc, strokeLine, and the fused entries' stroke halves) now
// declines when a dash pattern is set, so setLineDash works uniformly across
// the immediate-mode API. Contract pinned here per entry:
//   1. the dashed render differs from the solid one (dash is actually applied),
//   2. the dashed render is byte-identical to the same geometry stroked
//      explicitly through an external SWPath2D (the generic reference), and
//   3. strokeRect's generic arm (gradient paint) is dashed too.

test('setLineDash - honoured by direct stroke entries via the generic path', () => {
    const W = 100;
    const H = 90;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function assertBytesEqual(label, sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
            }
        }
    }

    function bytesDiffer(sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) return true;
        }
        return false;
    }

    // [label, direct draw, external-path reference draw]
    const CASES = [
        [
            'strokeRect',
            (ctx) => ctx.strokeRect(15, 15, 50, 40),
            (ctx) => {
                const p = new SWCanvas.Core.SWPath2D();
                p.rect(15, 15, 50, 40);
                p.closePath();
                ctx.stroke(p);
            }
        ],
        [
            'strokeRoundRect',
            (ctx) => ctx.strokeRoundRect(15, 15, 50, 40, 8),
            null // no external-path twin builds identical geometry; differ-check only
        ],
        [
            'strokeCircle',
            (ctx) => ctx.strokeCircle(45, 40, 20),
            (ctx) => {
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(45, 40, 20, 0, 2 * Math.PI);
                ctx.stroke(p);
            }
        ],
        [
            'outerStrokeArc',
            (ctx) => ctx.outerStrokeArc(45, 40, 20, 0.3, 2.2),
            (ctx) => {
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(45, 40, 20, 0.3, 2.2, false);
                ctx.stroke(p);
            }
        ],
        [
            'strokeLine',
            (ctx) => ctx.strokeLine(10, 20, 85, 70),
            (ctx) => {
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(10, 20);
                p.lineTo(85, 70);
                ctx.stroke(p);
            }
        ]
    ];

    for (const [label, direct, generic] of CASES) {
        const solid = newCtx();
        solid.ctx.setStrokeStyle(255, 0, 0, 255);
        solid.ctx.lineWidth = 2;
        direct(solid.ctx);

        const dashed = newCtx();
        dashed.ctx.setStrokeStyle(255, 0, 0, 255);
        dashed.ctx.lineWidth = 2;
        dashed.ctx.setLineDash([5, 4]);
        direct(dashed.ctx);

        if (!bytesDiffer(dashed.surface, solid.surface)) {
            throw new Error(`${label}: dashed render identical to solid (lineDash ignored)`);
        }

        if (generic) {
            const ref = newCtx();
            ref.ctx.setStrokeStyle(255, 0, 0, 255);
            ref.ctx.lineWidth = 2;
            ref.ctx.setLineDash([5, 4]);
            generic(ref.ctx);
            assertBytesEqual(`${label} dashed vs external path`, dashed.surface, ref.surface);
            log(`  ${label}: dashed, === external-path render`);
        } else {
            log(`  ${label}: dashed (differs from solid)`);
        }
    }

    // 3. strokeRect's GENERIC arm (gradient paint) honours dash too - its
    //    fallback used to omit the dash fields from the stroke props.
    {
        const g = (ctx) => {
            const gr = ctx.createLinearGradient(10, 10, 70, 60);
            gr.addColorStop(0, 'red');
            gr.addColorStop(1, 'blue');
            return gr;
        };
        const solid = newCtx();
        solid.ctx.setStrokeStyle(g(solid.ctx));
        solid.ctx.lineWidth = 2;
        solid.ctx.strokeRect(15, 15, 50, 40);

        const dashed = newCtx();
        dashed.ctx.setStrokeStyle(g(dashed.ctx));
        dashed.ctx.lineWidth = 2;
        dashed.ctx.setLineDash([5, 4]);
        dashed.ctx.strokeRect(15, 15, 50, 40);

        if (!bytesDiffer(dashed.surface, solid.surface)) {
            throw new Error('gradient strokeRect: dashed render identical to solid (fallback drops dash props)');
        }
        log('  strokeRect generic arm (gradient): dashed');
    }
});

// Test: direct-shape entries validate/no-op consistently, whatever the paint
// This file will be concatenated into the main test suite
//
// Regression guard for the entry-consistency sweep. Previously fillRect,
// strokeRect and strokeLine had NO up-front validation, with three
// consequences: (a) negative-dimension strokeRect PAINTED STRAY PIXELS on the
// direct arm (19-21 px) while the generic arm threw; (b) bad arguments
// produced three different errors from three different layers depending on
// the paint source; (c) clearRect called transform.invert() unguarded and
// threw under a singular CTM where fill()/stroke() silently draw nothing.
// Separately, fully-transparent paint (a === 0) dispatched three different
// ways (rects: full generic pipeline; circles/lines: direct scan writing
// nothing; fillArc: early return). Contract now pinned:
//   1. Negative/zero dims draw NOTHING at fillRect/strokeRect (family
//      convention), no stray pixels, no paint-dependent throw.
//   2. Bad argument types throw the SAME message whatever the paint source.
//   3. clearRect under a singular CTM is a silent no-op.
//   4. Paint a === 0 / globalAlpha === 0 under source-over early-return at
//      every entry (structurally: no generic-pipeline dispatch) - but NOT
//      under other composite ops, which can make invisible paint visible.

test('Entry validation - dims, types, singular CTM, invisible-draw consistency', () => {
    const W = 60;
    const H = 60;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function gradient(ctx) {
        const g = ctx.createLinearGradient(0, 0, 40, 40);
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

    // 1a. Negative-dimension strokeRect: no stray pixels (was 19-21 px).
    {
        const { surface, ctx } = newCtx();
        ctx.setStrokeStyle(255, 0, 0, 255);
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, -20, 20);
        ctx.strokeRect(10, 10, 20, -20);
        const n = nonWhiteCount(surface);
        if (n !== 0) {
            throw new Error(`negative-dim strokeRect painted ${n} stray pixels`);
        }
        log('  negative-dim strokeRect: 0 pixels');
    }

    // 1b. Negative-dimension fillRect with a GRADIENT: no throw, no pixels
    //     (the generic arm used to throw where the direct arm no-opped).
    {
        const { surface, ctx } = newCtx();
        ctx.setFillStyle(gradient(ctx));
        ctx.fillRect(10, 10, -20, 20);
        if (nonWhiteCount(surface) !== 0) {
            throw new Error('negative-dim gradient fillRect drew pixels');
        }
        log('  negative-dim gradient fillRect: silent no-op (no throw)');
    }

    // 2. Same throw whatever the paint source.
    {
        const expectThrow = (label, fn, expected) => {
            let msg = null;
            try {
                fn();
            } catch (e) {
                msg = e.message;
            }
            if (msg !== expected) {
                throw new Error(`${label}: threw "${msg}", expected "${expected}"`);
            }
        };
        const a = newCtx();
        a.ctx.setFillStyle(255, 0, 0, 255);
        expectThrow('fillRect solid bad-x', () => a.ctx.fillRect('a', 0, 10, 10), 'Rectangle coordinates must be numbers');
        a.ctx.setFillStyle(gradient(a.ctx));
        expectThrow('fillRect gradient bad-x', () => a.ctx.fillRect('a', 0, 10, 10), 'Rectangle coordinates must be numbers');
        a.ctx.setStrokeStyle(255, 0, 0, 255);
        expectThrow('strokeLine solid bad-x', () => a.ctx.strokeLine('a', 0, 10, 10), 'Line coordinates must be numbers');
        a.ctx.setStrokeStyle(gradient(a.ctx));
        expectThrow('strokeLine gradient bad-x', () => a.ctx.strokeLine('a', 0, 10, 10), 'Line coordinates must be numbers');
        log('  bad-argument throws: paint-independent messages');
    }

    // 3. clearRect under a singular (non-invertible, non-axis-aligned) CTM:
    //    silent no-op, like fill()/stroke().
    {
        const { surface, ctx } = newCtx();
        ctx.setFillStyle(0, 128, 0, 255);
        ctx.fillRect(10, 10, 20, 20);
        const before = nonWhiteCount(surface);
        ctx.save();
        ctx.transform(1, 1, 1, 1, 0, 0); // det = 0, b/c nonzero -> inverse-transform loop
        ctx.clearRect(0, 0, 40, 40); // used to throw 'Transform2D matrix is not invertible'
        ctx.restore();
        if (nonWhiteCount(surface) !== before) {
            throw new Error('clearRect under singular CTM changed pixels');
        }
        log('  clearRect under singular CTM: silent no-op');
    }

    // 4a. Invisible draws early-return under source-over (structural: the
    //     generic pipeline is not dispatched).
    {
        const { surface, ctx } = newCtx();
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        ctx.setFillStyle(255, 0, 0, 0); // a = 0
        ctx.fillRect(5, 5, 20, 20);
        ctx.fillRoundRect(5, 30, 20, 15, 4);
        ctx.setStrokeStyle(0, 0, 255, 0); // a = 0
        ctx.strokeLine(5, 50, 40, 55);
        ctx.setFillStyle(gradient(ctx));
        ctx.globalAlpha = 0;
        ctx.fillRect(30, 5, 20, 20); // gradient at globalAlpha 0
        ctx.globalAlpha = 1;
        if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error('an invisible draw dispatched the generic pipeline instead of early-returning');
        }
        if (nonWhiteCount(surface) !== 0) {
            throw new Error('an invisible draw changed pixels');
        }
        log('  invisible draws (a=0 / globalAlpha=0): early return, no dispatch');
    }

    // 4b. ...but NOT under non-source-over composites (e.g. 'xor'), where
    //     transparent paint can have visible effects - those keep the
    //     generic pipeline.
    {
        const { ctx } = newCtx();
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        ctx.globalCompositeOperation = 'xor';
        ctx.setFillStyle(255, 0, 0, 0); // a = 0
        ctx.fillRect(5, 5, 20, 20);
        if (!SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error('a=0 draw under xor was skipped - the invisible-draw guard must be source-over only');
        }
        log('  a=0 under xor: still dispatched (guard is source-over-scoped)');
    }
});

// Test: an INVALID globalAlpha assignment is ignored, per the HTML5 spec
// This file will be concatenated into the main test suite
//
// Regression guard. globalAlpha used to be a PLAIN PUBLIC FIELD, so any value
// assigned to it was stored raw. The HTML5 spec is explicit: "if the given
// value is either infinite, NaN, or not in the range 0.0 to 1.0, then it must
// be ignored, without assigning a new value" - native canvas keeps the previous
// alpha. Storing it raw instead sent `undefined`/NaN straight into every
// downstream `(color.a / 255) * globalAlpha`, which went NaN, and a fill then
// covered ZERO pixels while its fillStyle, geometry, clip and CTM were all
// correct - painting nothing and throwing nothing.
//
// That was not hypothetical: Fizzygum shipped it. A widget's explicitly
// specified backgroundColor silently never painted, because a CoffeeScript
// constructor default left its backgroundTransparency nil and the paint did
// `ctx.globalAlpha = <nil>`. Native canvas ignored the assignment, so the bug
// was invisible on the native backend and only SWCanvas reproduced it - see
// Fizzygum docs/archive/dropped-background-fill-investigation.md.
//
// Contract pinned here:
//   1. undefined / NaN / Infinity / out-of-range assignments are IGNORED - the
//      previous alpha stands (readback AND painted pixels).
//   2. VALID assignments, including the boundaries 0 and 1, still take effect.
//   3. save()/restore() round-trips the alpha unchanged.

test('globalAlpha - invalid assignments are ignored (HTML5), valid ones apply', () => {
    const W = 20;
    const H = 20;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        return { surface, ctx };
    }

    function pixel(surface, x, y) {
        const o = y * surface.stride + x * 4;
        return [surface.data[o], surface.data[o + 1], surface.data[o + 2], surface.data[o + 3]];
    }

    // (1) Every invalid value leaves the alpha untouched AND still paints.
    //     The painted check is the one that matters: a readback-only assertion
    //     would pass even if the bad value had reached the renderers.
    const invalid = [undefined, NaN, Infinity, -Infinity, -0.5, 1.5, null, 'x', {}];
    for (const bad of invalid) {
        const { surface, ctx } = newCtx();
        ctx.setFillStyle(230, 230, 130, 255);
        ctx.globalAlpha = bad;
        if (ctx.globalAlpha !== 1) {
            throw new Error(`globalAlpha = ${String(bad)} was STORED (readback ${String(ctx.globalAlpha)}); spec says ignore it`);
        }
        ctx.fillRect(0, 0, W, H);
        const px = pixel(surface, 2, 2);
        if (px[0] !== 230 || px[1] !== 230 || px[2] !== 130 || px[3] !== 255) {
            throw new Error(`globalAlpha = ${String(bad)} then fillRect painted [${px}], expected [230,230,130,255]`);
        }
    }

    // (2) Valid values still apply, boundaries included.
    for (const good of [0, 0.5, 1]) {
        const { ctx } = newCtx();
        ctx.globalAlpha = good;
        if (ctx.globalAlpha !== good) {
            throw new Error(`globalAlpha = ${good} did not take effect (readback ${ctx.globalAlpha})`);
        }
    }

    // globalAlpha 0 under source-over must still draw nothing (the pre-existing
    // early-return contract, tests/core/064) - i.e. "ignore invalid" must not
    // have been implemented by clamping a bad value to something paintable.
    {
        const { surface, ctx } = newCtx();
        ctx.setFillStyle(230, 230, 130, 255);
        ctx.globalAlpha = 0;
        ctx.fillRect(0, 0, W, H);
        const px = pixel(surface, 2, 2);
        if (px[3] !== 0) {
            throw new Error(`globalAlpha 0 painted [${px}], expected a fully transparent pixel`);
        }
    }

    // (3) save()/restore() round-trips the alpha, and an invalid assignment
    //     made while saved does not corrupt what restore() brings back.
    {
        const { ctx } = newCtx();
        ctx.globalAlpha = 0.25;
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.globalAlpha = NaN; // ignored
        if (ctx.globalAlpha !== 0.75) {
            throw new Error(`NaN corrupted the saved-state alpha (readback ${ctx.globalAlpha})`);
        }
        ctx.restore();
        if (ctx.globalAlpha !== 0.25) {
            throw new Error(`restore() did not bring back globalAlpha 0.25 (readback ${ctx.globalAlpha})`);
        }
    }
});

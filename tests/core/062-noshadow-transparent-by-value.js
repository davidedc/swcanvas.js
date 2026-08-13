// Test: _noShadow tests shadow transparency by VALUE, not reference identity
// This file will be concatenated into the main test suite
//
// Regression guard (a de-pessimization, not a wrong-pixels bug). The cached
// _noShadow flag - consulted by every rect/roundRect/stadium direct-rendering
// gate - tested `shadowColor === Color.transparent` (reference identity),
// while ShadowPipeline.needsShadow tests `shadowColor.a > 0`. Every non-default
// route allocates a fresh Color (setShadowColor, the compat CSS parser), so the
// common "disable the shadow by colour, leave blur/offset set" idiom flipped
// _noShadow false and silently abandoned the whole family to the generic
// pipeline for a shadow that would never be drawn. The flag now checks
// `shadowColor.a === 0` - the exact negation of needsShadow. Contract:
//   1. STRUCTURAL: transparent shadow colour (fresh Color, a=0) with blur and
//      offsets set keeps fillRect/fillRoundRect on the direct path.
//   2. BYTE-IDENTITY: that state renders identically to the default no-shadow
//      state.
//   3. NOT OVERSHOT: a real (visible) shadow still leaves the direct path and
//      renders shadow pixels.

test('_noShadow - transparent shadow colour by value keeps direct paths', () => {
    const W = 80;
    const H = 80;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    // 1. Structural: invisible shadow (fresh transparent Color + blur/offsets)
    //    must not de-fast-path the rect family.
    {
        const { ctx } = newCtx();
        ctx.setShadowColor(0, 0, 0, 0); // fresh Color, not the Color.transparent instance
        ctx.setShadowBlur(5);
        ctx.setShadowOffsetX(3);
        ctx.setShadowOffsetY(3);
        ctx.setFillStyle(255, 0, 0, 255);
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        ctx.fillRect(20, 20, 30, 30);
        if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error('fillRect with an INVISIBLE shadow (a=0, blur/offsets set) fell to the generic pipeline');
        }
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        ctx.fillRoundRect(20, 55, 30, 20, 5);
        if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error('fillRoundRect with an INVISIBLE shadow fell to the generic pipeline');
        }
        log('  invisible shadow (value-transparent): rect family stays direct');
    }

    // 2. Byte-identity with the default no-shadow state.
    {
        const a = newCtx();
        a.ctx.setShadowColor(0, 0, 0, 0);
        a.ctx.setShadowBlur(5);
        a.ctx.setShadowOffsetX(3);
        a.ctx.setShadowOffsetY(3);
        a.ctx.setFillStyle(255, 0, 0, 255);
        a.ctx.fillRect(20, 20, 30, 30);

        const b = newCtx();
        b.ctx.setFillStyle(255, 0, 0, 255);
        b.ctx.fillRect(20, 20, 30, 30);

        for (let i = 0; i < a.surface.data.length; i++) {
            if (a.surface.data[i] !== b.surface.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(
                    `invisible-shadow render differs from no-shadow render at (${pixel % W},${Math.floor(pixel / W)})`
                );
            }
        }
        log('  invisible shadow === default no-shadow (byte-identical)');
    }

    // 3. Not overshot: a VISIBLE shadow still renders (via the generic path).
    {
        const { surface, ctx } = newCtx();
        ctx.setShadowColor(0, 0, 255, 255);
        ctx.setShadowBlur(0);
        ctx.setShadowOffsetX(6);
        ctx.setShadowOffsetY(6);
        ctx.setFillStyle(255, 0, 0, 255);
        ctx.fillRect(20, 20, 30, 30);
        // Sample inside the offset shadow band, outside the rect: (53, 53).
        const o = 53 * surface.stride + 53 * 4;
        const px = [surface.data[o], surface.data[o + 1], surface.data[o + 2]];
        if (px[0] === 255 && px[1] === 255 && px[2] === 255) {
            throw new Error('visible shadow did not render (over-widened _noShadow?)');
        }
        log(`  visible shadow still renders: shadow pixel [${px}]`);
    }
});

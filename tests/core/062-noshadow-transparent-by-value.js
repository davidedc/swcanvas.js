// Test: _noShadow tests shadow transparency by VALUE, not reference identity
// This file will be concatenated into the main test suite
//
// Regression guard (a de-pessimization, not a wrong-pixels bug). The cached
// _noShadow flag - consulted by the rect/roundRect/stadium direct-rendering
// gates of the era, and still by the stroke/fused/circle/arc gates - tested
// `shadowColor === Color.transparent` (reference identity), while
// ShadowPipeline.needsShadow tests `shadowColor.a > 0`. Every non-default
// route allocates a fresh Color (setShadowColor, the compat CSS parser), so the
// common "disable the shadow by colour, leave blur/offset set" idiom flipped
// _noShadow false and silently routed the draw through the shadow machinery
// for a shadow that would never be drawn. The flag now checks
// `shadowColor.a === 0` - the exact negation of needsShadow (§9 entry 5).
//
// HISTORY: this test originally ALSO pinned structurally that an invisible
// shadow kept fillRect/fillRoundRect on their direct fill arms. Those arms were
// removed by the fill-arm-removal campaign
// (plans/one-rect-fill-pipeline-and-fill-arm-removal.md) - rect-family FILLS
// are now uniformly generic, so the structural half became vacuous and was
// dropped. The BYTE-IDENTITY contract below is the surviving guard: however an
// invisible shadow is spelled, it must not change a single pixel - under
// either pipeline. (The _noShadow flag itself still gates the stroke, fused,
// circle and arc direct arms, where §9 entry 5's de-pessimization remains live.)
// Contract:
//   1. BYTE-IDENTITY: value-transparent shadow state (fresh Color a=0, blur and
//      offsets set) renders identically to the default no-shadow state.
//   2. NOT OVERSHOT: a real (visible) shadow still renders shadow pixels.

test('_noShadow - transparent shadow colour by value is a no-op on pixels', () => {
    const W = 80;
    const H = 80;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    // 1. Byte-identity with the default no-shadow state (fillRect + fillRoundRect).
    {
        const a = newCtx();
        a.ctx.setShadowColor(0, 0, 0, 0); // fresh Color, not the Color.transparent instance
        a.ctx.setShadowBlur(5);
        a.ctx.setShadowOffsetX(3);
        a.ctx.setShadowOffsetY(3);
        a.ctx.setFillStyle(255, 0, 0, 255);
        a.ctx.fillRect(20, 20, 30, 30);
        a.ctx.fillRoundRect(20, 55, 30, 20, 5);

        const b = newCtx();
        b.ctx.setFillStyle(255, 0, 0, 255);
        b.ctx.fillRect(20, 20, 30, 30);
        b.ctx.fillRoundRect(20, 55, 30, 20, 5);

        for (let i = 0; i < a.surface.data.length; i++) {
            if (a.surface.data[i] !== b.surface.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(
                    `invisible-shadow render differs from no-shadow render at (${pixel % W},${Math.floor(pixel / W)})`
                );
            }
        }
        log('  invisible shadow === default no-shadow (byte-identical, rect + roundRect)');
    }

    // 2. Not overshot: a VISIBLE shadow still renders.
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

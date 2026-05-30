// Test: HiDPI direct-blit fast path — density-2 text under an axis-aligned
// transform whose uniform scale equals the atlas density (ctx.scale(2,2) +
// textPixelDensity = 2). This is TextRenderer's generalized fast path: glyphs
// blit straight to the backing surface with NO intermediate buffer, the
// density-2 atlas keeping them crisp. The backing surface is sized at physical
// pixels (CSS × 2); drawing happens in CSS coords via the scaled CTM. The two
// lines cover an identity translate (e=f=0) and an integer CSS translate
// (which bakes to an even device-pixel offset via x + e/dpr).

registerVisualTest('text-hidpi-fast-path', {
    name: 'HiDPI text via density-2 direct-blit fast path (scale == density)',
    width: 200, height: 96,   // physical px (= 100 × 48 CSS at dpr 2)
    draw: function(canvas) {
        const dpr = 2;
        const ctx = canvas.getContext('2d');

        // White background over the full physical surface.
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 96);

        // HiDPI recipe: scale the CTM by dpr (so the rest of the drawing stays
        // in CSS pixels) and pick the matching atlas density. The net transform
        // is [2,0,0,2,e,f] → the direct-blit fast path fires.
        ctx.scale(dpr, dpr);
        ctx.textPixelDensity = dpr;
        ctx.font = '16px Arial';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'black';

        // Line 1: zero translate (e = f = 0).
        ctx.fillText('Hello', 6, 6);

        // Line 2: integer CSS translate → even device-pixel offset; exercises
        // the x + e/dpr coordinate baking in the fast path.
        ctx.save();
        ctx.translate(0, 22);
        ctx.fillText('World', 6, 6);
        ctx.restore();
    }
});

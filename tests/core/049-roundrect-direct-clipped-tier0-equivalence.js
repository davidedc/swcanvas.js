// Test: fillRoundRect/strokeRoundRect under a rect clip - tier-0 equals bitmask, no leaks
// This file will be concatenated into the main test suite
//
// The direct rounded-rect entry points take the tier-0 rectangular-clip route
// (clamp extents, no bitmask) when the active clip collapses to one axis-aligned
// rect. Contract pinned here, for fill and 1px/thick stroke, opaque and
// semi-transparent, at identity and scaled transforms:
//   1. tier-0 output is byte-identical to the same draw under a forced BITMASK
//      clip of the same region (a path of two identical rects defeats the
//      rect-detector but exposes the same pixels),
//   2. nothing is ever painted outside the clip rect,
//   3. the radius<1 fallback to RectOps (normalizeRadius rounds fractional radii
//      below 0.5 to zero) FORWARDS the clip - historically it dropped both clip
//      arguments and painted unclipped.

test('RoundRect direct rendering under rect clip - tier-0/bitmask equivalence', () => {
    const W = 90;
    const H = 60;
    const CLIP = { x: 14, y: 10, w: 30, h: 18 };

    function render(clipMode, drawFn) {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.beginPath();
        ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
        if (clipMode === 'mask') {
            // Second identical rect: same exposed pixels, but no longer a single
            // axis-aligned rect path, so the clip goes through the bitmask.
            ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
        }
        ctx.clip();
        drawFn(ctx);
        ctx.restore();
        return surface;
    }

    function firstPixelOutsideClip(surface) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                if (
                    surface.data[o] === 255 &&
                    surface.data[o + 1] === 255 &&
                    surface.data[o + 2] === 255
                ) {
                    continue;
                }
                if (x < CLIP.x || x >= CLIP.x + CLIP.w || y < CLIP.y || y >= CLIP.y + CLIP.h) {
                    return `(${x},${y})`;
                }
            }
        }
        return null;
    }

    function assertCase(label, drawFn) {
        const tier0 = render('tier0', drawFn);
        const mask = render('mask', drawFn);
        for (let i = 0; i < tier0.data.length; i++) {
            if (tier0.data[i] !== mask.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(
                    `${label}: tier-0 and bitmask clips differ at (${pixel % W},${Math.floor(pixel / W)})`
                );
            }
        }
        const leak = firstPixelOutsideClip(tier0);
        if (leak) {
            throw new Error(`${label}: painted outside the clip rect at ${leak}`);
        }
        log(`  ${label}: tier-0 === bitmask, no clip leak`);
    }

    for (const scaled of [false, true]) {
        // Under scale(2,2) the same device-space shape; 1px logical stroke becomes
        // the thick-stroke path, covering both stroke rasterizers.
        const g = scaled ? ' @scale2' : '';
        const geo = scaled ? [5, 4, 20, 14, 4] : [10, 8, 28, 22, 5];
        const [x, y, w, h, r] = geo;
        const pre = (ctx) => {
            if (scaled) ctx.scale(2, 2);
        };
        assertCase(`fill opaque${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillRoundRect(x, y, w, h, r);
        });
        assertCase(`fill semi${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 128);
            ctx.fillRoundRect(x, y, w, h, r);
        });
        assertCase(`stroke opaque${g}`, (ctx) => {
            pre(ctx);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 1;
            ctx.strokeRoundRect(x, y, w, h, r);
        });
        assertCase(`stroke semi${g}`, (ctx) => {
            pre(ctx);
            ctx.setStrokeStyle(255, 0, 0, 128);
            ctx.lineWidth = 1;
            ctx.strokeRoundRect(x, y, w, h, r);
        });
        // Fractional radius < 0.5 rounds to 0 inside the renderer -> RectOps
        // fallback; the clip must survive the hand-off.
        assertCase(`fill r=0.4 fallback${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillRoundRect(x, y, w, h, 0.4);
        });
        assertCase(`stroke r=0.4 fallback${g}`, (ctx) => {
            pre(ctx);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 1;
            ctx.strokeRoundRect(x, y, w, h, 0.4);
        });
        // Fused fill+stroke path (fillStroke_AA_Any) - tier-0-wired like its
        // siblings. The thick semi-transparent stroke case exercises the
        // fill-to-path-extent overlap mode; the r=0.4 case pins the RectOps
        // fallback hand-off, whose FILL half historically dropped the clip
        // args entirely and painted unclipped through a bitmask clip.
        assertCase(`fillStroke opaque${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 1;
            ctx.fillStrokeRoundRect(x, y, w, h, r);
        });
        assertCase(`fillStroke semi thick stroke${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.setStrokeStyle(255, 0, 0, 128);
            ctx.lineWidth = 3;
            ctx.fillStrokeRoundRect(x, y, w, h, r);
        });
        assertCase(`fillStroke r=0.4 fallback${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 1;
            ctx.fillStrokeRoundRect(x, y, w, h, 0.4);
        });
    }
});

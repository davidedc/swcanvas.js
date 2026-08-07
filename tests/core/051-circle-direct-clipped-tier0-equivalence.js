// Test: fillCircle/strokeCircle/fillStrokeCircle under a rect clip - tier-0 equals bitmask, no leaks
// This file will be concatenated into the main test suite
//
// The direct circle entry points take the tier-0 rectangular-clip route (clamp
// extents, no bitmask) when the active clip collapses to one axis-aligned rect
// - the same wiring fillRoundRect/strokeRoundRect got in 6b20dcc, pinned there
// by test 049. Contract pinned here, for fill, 1px stroke, thick stroke and
// the fused fillStroke path, opaque and semi-transparent, at identity and
// scaled transforms:
//   1. tier-0 output is byte-identical to the same draw under a forced BITMASK
//      clip of the same region (a path of two identical rects defeats the
//      rect-detector but exposes the same pixels),
//   2. nothing is ever painted outside the clip rect.

test('Circle direct rendering under rect clip - tier-0/bitmask equivalence', () => {
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
        // The circle crosses all four clip edges, so every span/plot is clamped.
        // Under scale(2,2) the same device-space geometry; the 1px logical
        // stroke becomes the thick-stroke path, covering both stroke
        // rasterizers from the same call site.
        const g = scaled ? ' @scale2' : '';
        const [cx, cy, r] = scaled ? [15, 10, 7] : [30, 20, 14];
        const pre = (ctx) => {
            if (scaled) ctx.scale(2, 2);
        };
        assertCase(`fill opaque${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillCircle(cx, cy, r);
        });
        assertCase(`fill semi${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 128);
            ctx.fillCircle(cx, cy, r);
        });
        assertCase(`stroke 1px opaque${g}`, (ctx) => {
            pre(ctx);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 1;
            ctx.strokeCircle(cx, cy, r);
        });
        assertCase(`stroke 1px semi${g}`, (ctx) => {
            pre(ctx);
            ctx.setStrokeStyle(255, 0, 0, 128);
            ctx.lineWidth = 1;
            ctx.strokeCircle(cx, cy, r);
        });
        assertCase(`stroke thick opaque${g}`, (ctx) => {
            pre(ctx);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 4;
            ctx.strokeCircle(cx, cy, r);
        });
        assertCase(`stroke thick semi${g}`, (ctx) => {
            pre(ctx);
            ctx.setStrokeStyle(255, 0, 0, 128);
            ctx.lineWidth = 4;
            ctx.strokeCircle(cx, cy, r);
        });
        assertCase(`fillStroke opaque${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 4;
            ctx.fillStrokeCircle(cx, cy, r);
        });
        assertCase(`fillStroke semi mix${g}`, (ctx) => {
            pre(ctx);
            ctx.setFillStyle(0, 0, 255, 128);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 4;
            ctx.fillStrokeCircle(cx, cy, r);
        });
    }
});

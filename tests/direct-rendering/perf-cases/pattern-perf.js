/**
 * Parametric Pattern Fill Performance Tests
 *
 * Generates performance tests covering:
 * - sw0 only (fills)
 * - 2 shape size categories (szM, szXL) - pattern cost is per pixel
 * - 4 operations, one per sampling arm of a pattern fill:
 *   - fill-identity:        'repeat' pattern at the identity CTM (the integer-
 *                           repeat fast path of a device-space wallpaper: one
 *                           texel per pixel, no transform per pixel) - the
 *                           control, which never resamples
 *   - fill-scaled:          under a non-integer scale (filtered: bilinear)
 *   - fill-rotated:         under a rotation (filtered: bilinear)
 *   - fill-scaled-nosmooth: fill-scaled with imageSmoothingEnabled false
 *                           (nearest-neighbour through the hoisted inverse)
 *
 * The tile is built ONCE per canvas kind - an SWCanvas context patterns an
 * SWCanvas source, a native context a native one - through the standard
 * putImageData, so the Node benchmark and both sides of the browser
 * comparison page sample the same opaque texels. The scaled and rotated
 * variants draw the same device-space rect sizes through the CTM.
 */

(function () {
    'use strict';

    const TILE = 32;
    const SCALE = 1.7; // non-integer: every sample interpolates
    const ROTATION = 0.5;

    const tilesByKind = { sw: null, native: null };

    function tileFor(ctx) {
        const kind = ctx._core ? 'sw' : 'native';
        if (tilesByKind[kind] === null) {
            const canvas = ctx._core
                ? SWCanvas.createCanvas(TILE, TILE)
                : Object.assign(document.createElement('canvas'), { width: TILE, height: TILE });
            const tileCtx = canvas.getContext('2d');
            const image = tileCtx.createImageData(TILE, TILE);
            const data = image.data;
            for (let y = 0; y < TILE; y++) {
                for (let x = 0; x < TILE; x++) {
                    const o = (y * TILE + x) * 4;
                    data[o] = Math.round((255 * x) / (TILE - 1));
                    data[o + 1] = Math.round((255 * y) / (TILE - 1));
                    data[o + 2] = (x ^ y) & 4 ? 200 : 60;
                    data[o + 3] = 255;
                }
            }
            tileCtx.putImageData(image, 0, 0);
            tilesByKind[kind] = canvas;
        }
        return tilesByKind[kind];
    }

    registerParametricPerfTests({
        baseId: 'pattern-perf',
        baseName: 'Pattern',
        // 'rects': the browser perf page lists tests by its five shape categories
        category: 'rects',
        strokeCategories: ['sw0'],
        sizeCategories: ['szM', 'szXL'],
        operations: ['fill-identity', 'fill-scaled', 'fill-rotated', 'fill-scaled-nosmooth'],

        /**
         * Draw function for pattern fill performance tests.
         * @param {CanvasRenderingContext2D} ctx - Canvas context
         * @param {number} instances - Number of rects to draw (0 = single for visual, >0 for perf)
         * @param {Object} params - { sizeSequence, operation }
         */
        drawFunction: function (ctx, instances, params) {
            const canvasWidth = ctx.canvas.width;
            const canvasHeight = ctx.canvas.height;
            const { sizeSequence, operation } = params;

            const isPerformanceRun = instances !== null && instances > 0;
            const numToDraw = isPerformanceRun ? instances : 1;

            const scaled = operation === 'fill-scaled' || operation === 'fill-scaled-nosmooth';
            const rotated = operation === 'fill-rotated';

            // save/restore: the smoothing flag and the transform must not leak
            // into the next test when a harness reuses one context.
            ctx.save();
            ctx.imageSmoothingEnabled = operation !== 'fill-scaled-nosmooth';
            // User-space frame: device rect sizes are the same in every variant.
            let unit = 1;
            if (scaled) {
                ctx.scale(SCALE, SCALE);
                unit = 1 / SCALE;
            } else if (rotated) {
                ctx.translate(canvasWidth / 2, canvasHeight / 2);
                ctx.rotate(ROTATION);
            }
            ctx.fillStyle = ctx.createPattern(tileFor(ctx), 'repeat');

            for (let i = 0; i < numToDraw; i++) {
                const idx = i % sizeSequence.length;
                const size = sizeSequence[idx];

                // Random aspect ratio (0.5 to 2.0) - seeded for reproducibility
                const aspectRatio = 0.5 + SeededRandom.getRandom() * 1.5;
                const width = size;
                const height = size / aspectRatio;

                const diagonal = Math.sqrt(width * width + height * height);
                const margin = Math.max(50, diagonal / 2);
                let centerX;
                let centerY;
                if (rotated) {
                    // Inside a disk around the rotation centre, so the rect stays on the canvas
                    const radius = Math.max(0, Math.min(canvasWidth, canvasHeight) / 2 - margin);
                    const r = radius * Math.sqrt(SeededRandom.getRandom());
                    const theta = SeededRandom.getRandom() * Math.PI * 2;
                    centerX = r * Math.cos(theta);
                    centerY = r * Math.sin(theta);
                } else {
                    centerX = (margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin)) * unit;
                    centerY = (margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin)) * unit;
                }
                const w = width * unit;
                const h = height * unit;
                ctx.fillRect(centerX - w / 2, centerY - h / 2, w, h);
            }

            ctx.restore();

            // Return null for performance runs
            return null;
        }
    });
})();

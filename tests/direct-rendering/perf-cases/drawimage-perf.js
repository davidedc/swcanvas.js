/**
 * Parametric drawImage Performance Tests
 *
 * Generates performance tests covering:
 * - sw0 only (drawImage has no stroke)
 * - 3 shape size categories (szS, szM, szXL) - the DESTINATION size
 * - 7 operations, one per sampling arm of Rasterizer._drawImageInternal:
 *   - blit-1to1:     same-size sub-rect at an integer position (nearest-
 *                    neighbour, step 1 - every plain blit: glyphs, back buffers)
 *   - up-nosmooth:   whole small image scaled up, imageSmoothingEnabled false
 *                    (nearest-neighbour)
 *   - up-whole:      whole small image scaled up (bilinear)
 *   - down-whole:    whole large image scaled down (bilinear)
 *   - up-subrect:    sub-rect of the large image scaled up 2.37x (bilinear)
 *   - down-subrect:  sub-rect of the large image scaled down 2.1x (bilinear)
 *   - rotated:       same-size sub-rect under a rotation (bilinear - the
 *                    path a rotated composite of an offscreen buffer takes)
 * The two nearest-neighbour arms are the controls for changes to the
 * bilinear arm (its tap/edge policy), which they never reach.
 *
 * Source images are built ONCE per canvas kind - an SWCanvas context draws
 * SWCanvas sources (drawn without a pixel copy), a native context native
 * ones - through the standard putImageData, so the Node benchmark and both
 * sides of the browser comparison page draw the same opaque texels. Every
 * source rect lies inside its image.
 */

(function () {
    'use strict';

    const SMALL_W = 12;
    const SMALL_H = 9;
    const LARGE_W = 1024;
    const LARGE_H = 1024;
    const UP_FACTOR = 2.37; // non-integer: every sample interpolates
    const DOWN_FACTOR = 2.1;

    const sourcesByKind = { sw: null, native: null };

    function makeSource(ctx, width, height) {
        const canvas = ctx._core
            ? SWCanvas.createCanvas(width, height)
            : Object.assign(document.createElement('canvas'), { width, height });
        const sourceCtx = canvas.getContext('2d');
        const image = sourceCtx.createImageData(width, height);
        const data = image.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const o = (y * width + x) * 4;
                data[o] = Math.round((255 * x) / (width - 1));
                data[o + 1] = Math.round((255 * y) / (height - 1));
                data[o + 2] = (x ^ y) & 8 ? 200 : 60;
                data[o + 3] = 255;
            }
        }
        sourceCtx.putImageData(image, 0, 0);
        return canvas;
    }

    function sourcesFor(ctx) {
        const kind = ctx._core ? 'sw' : 'native';
        if (sourcesByKind[kind] === null) {
            sourcesByKind[kind] = {
                small: makeSource(ctx, SMALL_W, SMALL_H),
                large: makeSource(ctx, LARGE_W, LARGE_H)
            };
        }
        return sourcesByKind[kind];
    }

    registerParametricPerfTests({
        baseId: 'drawimage-perf',
        baseName: 'drawImage',
        // 'rects': the browser perf page lists tests by its five shape categories
        category: 'rects',
        strokeCategories: ['sw0'],
        sizeCategories: ['szS', 'szM', 'szXL'],
        operations: ['blit-1to1', 'up-nosmooth', 'up-whole', 'down-whole', 'up-subrect', 'down-subrect', 'rotated'],

        /**
         * Draw function for drawImage performance tests.
         * @param {CanvasRenderingContext2D} ctx - Canvas context
         * @param {number} instances - Number of images to draw (0 = single for visual, >0 for perf)
         * @param {Object} params - { sizeSequence, operation }
         */
        drawFunction: function (ctx, instances, params) {
            const canvasWidth = ctx.canvas.width;
            const canvasHeight = ctx.canvas.height;
            const { sizeSequence, operation } = params;

            const isPerformanceRun = instances !== null && instances > 0;
            const numToDraw = isPerformanceRun ? instances : 1;

            const { small, large } = sourcesFor(ctx);

            // save/restore: the smoothing flag and the transform must not leak
            // into the next test when a harness reuses one context.
            ctx.save();
            ctx.imageSmoothingEnabled = operation !== 'up-nosmooth';

            for (let i = 0; i < numToDraw; i++) {
                const idx = i % sizeSequence.length;
                const width = sizeSequence[idx];
                // Aspect 0.75-1.33 keeps every scaled-down source rect inside the large image
                const height = width / (0.75 + SeededRandom.getRandom() * 0.58);

                const diagonal = Math.sqrt(width * width + height * height);
                const margin = Math.max(50, diagonal / 2);
                const centerX = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
                const centerY = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);
                const destX = centerX - width / 2;
                const destY = centerY - height / 2;
                // Sub-rect origin as a fraction of the room left in the large image
                const fx = SeededRandom.getRandom();
                const fy = SeededRandom.getRandom();

                if (operation === 'blit-1to1') {
                    const w = Math.max(1, Math.round(width));
                    const h = Math.max(1, Math.round(height));
                    const sx = Math.floor(fx * (LARGE_W - w));
                    const sy = Math.floor(fy * (LARGE_H - h));
                    ctx.drawImage(large, sx, sy, w, h, Math.round(destX), Math.round(destY), w, h);
                } else if (operation === 'up-nosmooth' || operation === 'up-whole') {
                    ctx.drawImage(small, destX, destY, width, height);
                } else if (operation === 'down-whole') {
                    ctx.drawImage(large, destX, destY, width, height);
                } else if (operation === 'up-subrect' || operation === 'down-subrect') {
                    const factor = operation === 'up-subrect' ? 1 / UP_FACTOR : DOWN_FACTOR;
                    const sw = width * factor;
                    const sh = height * factor;
                    const sx = fx * (LARGE_W - sw);
                    const sy = fy * (LARGE_H - sh);
                    ctx.drawImage(large, sx, sy, sw, sh, destX, destY, width, height);
                } else {
                    // rotated: avoid multiples of PI/2 so the transform is never axis-aligned
                    const angle = (SeededRandom.getRandom() * 0.9 + 0.05) * Math.PI * 2;
                    const sx = fx * (LARGE_W - width);
                    const sy = fy * (LARGE_H - height);
                    ctx.save();
                    ctx.translate(centerX, centerY);
                    ctx.rotate(angle);
                    ctx.drawImage(large, sx, sy, width, height, -width / 2, -height / 2, width, height);
                    ctx.restore();
                }
            }

            ctx.restore();

            // Return null for performance runs
            return null;
        }
    });
})();

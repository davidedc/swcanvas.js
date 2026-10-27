/**
 * Parametric Shadow Performance Tests
 *
 * Measures fills that cast a shadow - every such draw runs the shadow
 * pipeline (ShadowPipeline.renderWithShadow): the shape is drawn once into a
 * coverage buffer padded by the blur's reach, the buffer is blurred
 * (BoxBlur, three separable box passes), composited under the destination,
 * and the shape is drawn on top.
 *
 * Generates performance tests covering:
 * - sw0 only (opaque fills, no stroke)
 * - 2 shape size categories (szM, szXL)
 * - 6 operations: a filled rect and a filled rounded rect, each at shadow
 *   blur 0, 4 and 16. Every shadow is offset, so blur 0 runs the pipeline
 *   too (an unoffset, unblurred shadow is never drawn) and measures its
 *   fixed cost without the blur.
 */

(function () {
    'use strict';

    const SHADOW_OFFSET = 6;
    const BLUR_BY_OPERATION = {
        'rect-blur0': 0,
        'rect-blur4': 4,
        'rect-blur16': 16,
        'roundrect-blur0': 0,
        'roundrect-blur4': 4,
        'roundrect-blur16': 16
    };

    registerParametricPerfTests({
        baseId: 'shadow-perf',
        baseName: 'Shadow',
        category: 'rects',
        strokeCategories: ['sw0'],
        sizeCategories: ['szM', 'szXL'],
        operations: Object.keys(BLUR_BY_OPERATION),

        /**
         * Draw function for shadow performance tests.
         * @param {CanvasRenderingContext2D} ctx - Canvas context
         * @param {number} instances - Number of shapes to draw (0 = single for visual, >0 for perf)
         * @param {Object} params - { sizeSequence, operation }
         */
        drawFunction: function (ctx, instances, params) {
            const canvasWidth = ctx.canvas.width;
            const canvasHeight = ctx.canvas.height;
            const { sizeSequence, operation } = params;

            const isPerformanceRun = instances !== null && instances > 0;
            const numToDraw = isPerformanceRun ? instances : 1;
            const rounded = operation.startsWith('roundrect-');

            // save/restore: the shadow state must not leak into the next test
            // when a harness reuses one context.
            ctx.save();
            ctx.fillStyle = 'rgb(0, 0, 255)';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = BLUR_BY_OPERATION[operation];
            ctx.shadowOffsetX = SHADOW_OFFSET;
            ctx.shadowOffsetY = SHADOW_OFFSET;

            for (let i = 0; i < numToDraw; i++) {
                const idx = i % sizeSequence.length;
                const width = sizeSequence[idx];
                const height = width / (0.5 + SeededRandom.getRandom() * 1.5);

                const margin = Math.max(50, Math.max(width, height) / 2 + SHADOW_OFFSET + 16);
                const centerX = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
                const centerY = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);
                const rectX = centerX - width / 2;
                const rectY = centerY - height / 2;

                if (rounded) {
                    const cornerRadius = Math.min(width, height) * (0.1 + SeededRandom.getRandom() * 0.2);
                    ctx.fillRoundRect(rectX, rectY, width, height, cornerRadius);
                } else {
                    ctx.fillRect(rectX, rectY, width, height);
                }
            }

            ctx.restore();

            // Return null for performance runs
            return null;
        }
    });
})();

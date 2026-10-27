/**
 * Parametric Open-Polyline Stroke Performance Tests (caps and joins)
 *
 * Generates performance tests covering:
 * - 3 stroke width categories (swXXS, swS, swL)
 * - 2 shape size categories (szS, szL) - the polyline's segment scale
 * - 5 cap/join operations, opaque:
 *   - stroke-cap-round-join-round
 *   - stroke-cap-round-join-miter
 *   - stroke-cap-butt-join-round
 *   - stroke-cap-butt-join-miter (the HTML5 defaults - the control)
 *   - stroke-cap-square-join-bevel
 *
 * Each shape is ONE stroke() of an open 4-segment polyline whose heading
 * turns 40-140 degrees at every vertex, so every join and both caps are
 * generated and the caps' fans overlap the body. stroke() of a path always
 * takes the generic pipeline: StrokeGenerator.generateStrokePolygons ->
 * PolygonFiller.fillPolygons (nonzero).
 */

(function () {
    'use strict';

    const SEGMENTS = 4;

    registerParametricPerfTests({
        baseId: 'polyline-perf',
        baseName: 'Polyline',
        category: 'lines',
        strokeCategories: ['swXXS', 'swS', 'swL'],
        sizeCategories: ['szS', 'szL'],
        operations: [
            'stroke-cap-round-join-round',
            'stroke-cap-round-join-miter',
            'stroke-cap-butt-join-round',
            'stroke-cap-butt-join-miter',
            'stroke-cap-square-join-bevel'
        ],

        /**
         * Draw function for open-polyline stroke performance tests.
         * @param {CanvasRenderingContext2D} ctx - Canvas context
         * @param {number} instances - Number of polylines to draw (0 = single for visual, >0 for perf)
         * @param {Object} params - { sizeSequence, strokeSequence, fixedStrokeWidth, operation }
         */
        drawFunction: function (ctx, instances, params) {
            const canvasWidth = ctx.canvas.width;
            const canvasHeight = ctx.canvas.height;
            const { sizeSequence, strokeSequence, fixedStrokeWidth, operation } = params;

            const isPerformanceRun = instances !== null && instances > 0;
            const numToDraw = isPerformanceRun ? instances : 1;

            // 'stroke-cap-<cap>-join-<join>'
            const parts = operation.split('-');
            const lineCap = parts[2];
            const lineJoin = parts[4];

            // save/restore: lineCap/lineJoin must not leak into the next test
            // when a harness reuses one context.
            ctx.save();
            ctx.strokeStyle = 'rgb(255, 0, 0)';
            ctx.lineCap = lineCap;
            ctx.lineJoin = lineJoin;
            if (!strokeSequence) {
                ctx.lineWidth = fixedStrokeWidth;
            }

            // Get max stroke width for margin calculation
            const maxStrokeWidth =
                fixedStrokeWidth !== null
                    ? fixedStrokeWidth
                    : strokeSequence
                      ? Math.max(...strokeSequence.subarray(0, Math.min(numToDraw, strokeSequence.length)))
                      : 0;

            for (let i = 0; i < numToDraw; i++) {
                const idx = i % sizeSequence.length;
                const size = sizeSequence[idx];
                if (strokeSequence) {
                    ctx.lineWidth = strokeSequence[idx];
                }

                // SEGMENTS segments, each 0.2-0.3 x size long, keep every vertex
                // within 1.2 x size of the start point.
                const margin = Math.max(50, 1.2 * size + maxStrokeWidth);
                let x = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
                let y = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);
                let heading = SeededRandom.getRandom() * Math.PI * 2;

                ctx.beginPath();
                ctx.moveTo(x, y);
                for (let s = 0; s < SEGMENTS; s++) {
                    if (s > 0) {
                        // Turn 40-140 degrees, left or right
                        const turn = (40 + SeededRandom.getRandom() * 100) * (Math.PI / 180);
                        heading += SeededRandom.getRandom() < 0.5 ? turn : -turn;
                    }
                    const length = size * (0.2 + SeededRandom.getRandom() * 0.1);
                    x += Math.cos(heading) * length;
                    y += Math.sin(heading) * length;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            ctx.restore();

            // Return null for performance runs
            return null;
        }
    });
})();

/**
 * Parametric Horizontal Line Performance Tests
 *
 * Generates performance tests covering all combinations of:
 * - 9 stroke width categories (sw0, sw1px, swXXS-swXXL)
 * - 7 shape size categories (szXXS-szXXL) - used as line length
 * - 2 operations (stroke-opaque, stroke-semi)
 *
 * Skip logic:
 * - All stroke operations: Skip sw0
 *
 * Tests isolate SWCanvas horizontal line code paths:
 * - sw0: No-op (skipped for stroke)
 * - sw1px: Horizontal Bresenham (optimized y1 === y2 case)
 * - swXXS+: Thick horizontal line algorithms
 * - Semi-transparent: Alpha compositing code paths
 *
 * Horizontal lines have y1 === y2, enabling optimized axis-aligned code paths.
 */

registerParametricPerfTests({
    baseId: 'line-horiz-perf',
    baseName: 'Line Horiz',
    category: 'lines',
    operations: ['stroke-opaque', 'stroke-semi'],

    /**
     * Draw function for horizontal line performance tests.
     * Uses pre-computed coverage sequences for stratified sampling.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} instances - Number of shapes to draw (0 = single for visual, >0 for perf)
     * @param {Object} params - { sizeSequence, strokeSequence, fixedStrokeWidth, operation }
     */
    drawFunction: function(ctx, instances, params) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const { sizeSequence, strokeSequence, fixedStrokeWidth, operation } = params;

        const isPerformanceRun = instances !== null && instances > 0;
        const numToDraw = isPerformanceRun ? instances : 1;

        // Parse operation for transparency
        const strokeSemi = operation === 'stroke-semi';

        // Set up stroke style based on operation
        ctx.strokeStyle = strokeSemi ? 'rgba(255, 0, 0, 0.5)' : 'rgb(255, 0, 0)';

        for (let i = 0; i < numToDraw; i++) {
            // Get per-shape values from coverage sequences
            const idx = i % sizeSequence.length;
            const lineLength = sizeSequence[idx];
            const strokeWidth = strokeSequence ? strokeSequence[idx] : fixedStrokeWidth;

            // Set stroke width per-shape
            ctx.lineWidth = strokeWidth;

            // Get horizontal line endpoints (y1 === y2)
            const line = getHorizontalLineEndpoints(canvasWidth, canvasHeight, lineLength);

            // Draw line
            ctx.strokeLine(line.x1, line.y1, line.x2, line.y2);
        }

        // Return null for performance runs
        return null;
    }
});

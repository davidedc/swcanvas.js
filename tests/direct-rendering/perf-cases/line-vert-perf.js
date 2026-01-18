/**
 * Parametric Vertical Line Performance Tests
 *
 * Generates performance tests covering all combinations of:
 * - 9 stroke width categories (sw0, sw1px, swXXS-swXXL)
 * - 7 shape size categories (szXXS-szXXL) - used as line length
 * - 2 operations (stroke-opaque, stroke-semi)
 *
 * Skip logic:
 * - All stroke operations: Skip sw0
 *
 * Tests isolate SWCanvas vertical line code paths:
 * - sw0: No-op (skipped for stroke)
 * - sw1px: Vertical Bresenham (optimized x1 === x2 case)
 * - swXXS+: Thick vertical line algorithms
 * - Semi-transparent: Alpha compositing code paths
 *
 * Vertical lines have x1 === x2, enabling optimized axis-aligned code paths.
 */

registerParametricPerfTests({
    baseId: 'line-vert-perf',
    baseName: 'Line Vert',
    category: 'lines',
    operations: ['stroke-opaque', 'stroke-semi'],

    /**
     * Draw function for vertical line performance tests.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} instances - Number of shapes to draw (0 = single for visual, >0 for perf)
     * @param {Object} params - { strokeKey, sizeKey, operation }
     */
    drawFunction: function(ctx, instances, params) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const { strokeKey, sizeKey, operation } = params;

        const isPerformanceRun = instances !== null && instances > 0;
        const numToDraw = isPerformanceRun ? instances : 1;

        // Parse operation for transparency
        const strokeSemi = operation === 'stroke-semi';

        // Get stroke width from category
        const strokeWidth = getStrokeWidthFromCategory(strokeKey, Math.random);

        // Get line length from size category
        const lineLength = getShapeSizeFromCategory(sizeKey, Math.random);

        // Set up stroke style based on operation
        ctx.strokeStyle = strokeSemi ? 'rgba(255, 0, 0, 0.5)' : 'rgb(255, 0, 0)';
        ctx.lineWidth = strokeWidth;

        for (let i = 0; i < numToDraw; i++) {
            // Get vertical line endpoints (x1 === x2)
            const line = getVerticalLineEndpoints(canvasWidth, canvasHeight, lineLength);

            // Draw line
            ctx.strokeLine(line.x1, line.y1, line.x2, line.y2);
        }

        // Return null for performance runs
        return null;
    }
});

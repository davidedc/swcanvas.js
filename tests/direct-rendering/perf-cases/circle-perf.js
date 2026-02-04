/**
 * Parametric Circle Performance Tests
 *
 * Generates performance tests covering all combinations of:
 * - 9 stroke width categories (sw0, sw1px, swXXS-swXXL)
 * - 7 shape size categories (szXXS-szXXL) - used as diameter
 * - 8 operations (stroke/fill × opaque/semi, with independent transparency)
 *
 * Skip logic:
 * - fill-opaque/fill-semi: ONLY valid for sw0 (no stroke)
 * - All stroke operations: Skip sw0
 *
 * Tests isolate SWCanvas code paths:
 * - Fill: Midpoint circle fill algorithm
 * - sw0: No-op (skipped for stroke)
 * - sw1px: Bresenham circle stroke
 * - swXXS+: Thick stroke algorithms (annulus)
 * - Semi-transparent: Alpha compositing code paths
 */

registerParametricPerfTests({
    baseId: 'circle-perf',
    baseName: 'Circle',
    category: 'circles',
    operations: [
        'stroke-opaque',
        'stroke-semi',
        'fill-opaque',
        'fill-semi',
        'fill-opaque-stroke-opaque',
        'fill-semi-stroke-opaque',
        'fill-opaque-stroke-semi',
        'fill-semi-stroke-semi'
    ],

    /**
     * Draw function for circle performance tests.
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

        // Parse operation for fill/stroke and transparency
        const hasFill = operation.startsWith('fill');
        const hasStroke = operation.includes('stroke');
        const fillSemi = operation.includes('fill-semi');
        const strokeSemi = operation.includes('stroke-semi');

        // Set up styles based on operation
        if (hasFill) {
            ctx.fillStyle = fillSemi ? 'rgba(0, 0, 255, 0.5)' : 'rgb(0, 0, 255)';
        }
        if (hasStroke) {
            ctx.strokeStyle = strokeSemi ? 'rgba(255, 0, 0, 0.5)' : 'rgb(255, 0, 0)';
        }

        // Get max stroke width for margin calculation
        const maxStrokeWidth = fixedStrokeWidth !== null ? fixedStrokeWidth :
            (strokeSequence ? Math.max(...strokeSequence.subarray(0, Math.min(numToDraw, strokeSequence.length))) : 0);

        for (let i = 0; i < numToDraw; i++) {
            // Get per-shape values from coverage sequences
            const idx = i % sizeSequence.length;
            const diameter = sizeSequence[idx];
            const radius = diameter / 2;
            const strokeWidth = strokeSequence ? strokeSequence[idx] : fixedStrokeWidth;

            // Set stroke width per-shape if variable
            if (hasStroke && strokeSequence) {
                ctx.lineWidth = strokeWidth;
            } else if (hasStroke && i === 0) {
                ctx.lineWidth = fixedStrokeWidth;
            }

            // Random position with margin for shape + stroke
            // Use SeededRandom for reproducible positions across measurement runs
            const margin = Math.max(50, radius + maxStrokeWidth);
            const cx = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
            const cy = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);

            // Draw fill first, then stroke (standard Canvas order)
            if (hasFill) {
                ctx.fillCircle(cx, cy, radius);
            }
            if (hasStroke) {
                ctx.strokeCircle(cx, cy, radius);
            }
        }

        // Return null for performance runs
        return null;
    }
});

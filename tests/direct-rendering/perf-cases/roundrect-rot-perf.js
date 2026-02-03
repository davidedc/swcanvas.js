/**
 * Parametric Rotated Rounded Rectangle Performance Tests
 *
 * Generates performance tests covering all combinations of:
 * - 9 stroke width categories (sw0, sw1px, swXXS-swXXL)
 * - 7 shape size categories (szXXS-szXXL)
 * - 8 operations (stroke/fill × opaque/semi, with independent transparency)
 *
 * Skip logic:
 * - fill-opaque/fill-semi: ONLY valid for sw0 (no stroke)
 * - All stroke operations: Skip sw0
 *
 * Tests isolate SWCanvas code paths:
 * - Fill: RoundedRectOpsRot rotated fill (DDA/scanline algorithms)
 * - sw0: No-op (skipped for stroke)
 * - sw1px: Rotated Bresenham rounded rect stroke
 * - swXXS+: Rotated thick stroke algorithms via RoundedRectOpsRot
 * - Semi-transparent: Alpha compositing code paths
 *
 * Rotated means a rotation transform is applied before drawing.
 * This tests the RoundedRectOpsRot code path (DDA/scanline algorithms).
 */

registerParametricPerfTests({
    baseId: 'roundrect-rot-perf',
    baseName: 'RoundRect Rot',
    category: 'rounded-rects',
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
     * Draw function for rotated rounded rectangle performance tests.
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

        // Parse operation for fill/stroke and transparency
        const hasFill = operation.startsWith('fill');
        const hasStroke = operation.includes('stroke');
        const fillSemi = operation.includes('fill-semi');
        const strokeSemi = operation.includes('stroke-semi');

        // Use pre-computed values from params (same for all measurement runs)
        const strokeWidth = params.strokeWidth;
        const size = params.shapeSize;

        // Set up styles based on operation
        if (hasFill) {
            ctx.fillStyle = fillSemi ? 'rgba(0, 0, 255, 0.5)' : 'rgb(0, 0, 255)';
        }
        if (hasStroke) {
            ctx.strokeStyle = strokeSemi ? 'rgba(255, 0, 0, 0.5)' : 'rgb(255, 0, 0)';
            ctx.lineWidth = strokeWidth;
        }

        for (let i = 0; i < numToDraw; i++) {
            // Random position with margin for shape + stroke
            // Use larger margin for rotated shapes (diagonal can extend further)
            // Use SeededRandom for reproducible positions across measurement runs
            const diagonal = Math.sqrt(size * size * 2);
            const margin = Math.max(50, diagonal / 2 + strokeWidth);
            const centerX = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
            const centerY = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);

            // Random aspect ratio (0.5 to 2.0) - also seeded for reproducibility
            const aspectRatio = 0.5 + SeededRandom.getRandom() * 1.5;
            const width = size;
            const height = size / aspectRatio;

            // Corner radius: 10-30% of smaller dimension - also seeded
            const minDim = Math.min(width, height);
            const cornerRadius = minDim * (0.1 + SeededRandom.getRandom() * 0.2);

            // Random rotation angle (0 to 2π) - also seeded for reproducibility
            // Avoid exact multiples of π/2 to ensure we hit rotated code path
            const angle = (SeededRandom.getRandom() * 0.9 + 0.05) * Math.PI * 2;

            // Apply rotation transform around shape center
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle);

            // Draw fill first, then stroke (standard Canvas order)
            if (hasFill) {
                ctx.fillRoundRect(-width / 2, -height / 2, width, height, cornerRadius);
            }
            if (hasStroke) {
                ctx.strokeRoundRect(-width / 2, -height / 2, width, height, cornerRadius);
            }

            ctx.restore();
        }

        // Return null for performance runs
        return null;
    }
});

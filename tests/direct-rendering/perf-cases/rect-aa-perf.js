/**
 * Parametric Axis-Aligned Rectangle Performance Tests
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
 * - Fill: RectOpsAA direct rect fill (fast nested loops)
 * - sw0: No-op (skipped for stroke)
 * - sw1px: Bresenham rectangle stroke
 * - swXXS+: Thick stroke algorithms via RectOpsAA
 * - Semi-transparent: Alpha compositing code paths
 *
 * Axis-aligned means no rotation transform is applied.
 * This tests the RectOpsAA code path.
 */

registerParametricPerfTests({
    baseId: 'rect-aa-perf',
    baseName: 'Rect AA',
    category: 'rects',
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
     * Draw function for axis-aligned rectangle performance tests.
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

        // Get stroke width from category
        const strokeWidth = getStrokeWidthFromCategory(strokeKey, Math.random);

        // Get rectangle size from size category
        const size = getShapeSizeFromCategory(sizeKey, Math.random);

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
            const margin = Math.max(50, size / 2 + strokeWidth);
            const x = margin + Math.random() * (canvasWidth - 2 * margin);
            const y = margin + Math.random() * (canvasHeight - 2 * margin);

            // Random aspect ratio (0.5 to 2.0)
            const aspectRatio = 0.5 + Math.random() * 1.5;
            const width = size;
            const height = size / aspectRatio;

            // Draw axis-aligned rectangle centered at (x, y)
            // No rotation transform - uses RectOpsAA code path
            const rectX = x - width / 2;
            const rectY = y - height / 2;

            // Draw fill first, then stroke (standard Canvas order)
            if (hasFill) {
                ctx.fillRect(rectX, rectY, width, height);
            }
            if (hasStroke) {
                ctx.strokeRect(rectX, rectY, width, height);
            }
        }

        // Return null for performance runs
        return null;
    }
});

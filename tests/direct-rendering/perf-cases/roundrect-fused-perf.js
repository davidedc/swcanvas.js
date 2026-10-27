/**
 * Parametric Fused Fill+Stroke Rounded Rectangle Performance Tests
 *
 * Generates performance tests covering:
 * - 4 stroke width categories (sw1px, swXXS, swS, swL)
 * - 2 shape size categories (szM, szXL)
 * - 3 operations, each ONE fillStrokeRoundRect call (the fused entry point,
 *   which roundrect-aa-perf's fill-*-stroke-* operations never reach - they
 *   call fillRoundRect then strokeRoundRect):
 *   - fused-fill-opaque-stroke-opaque
 *   - fused-fill-semi-stroke-semi
 *   - fused-fill-opaque-stroke-opaque-leftedge: every rect straddles the
 *     canvas's left edge, so the stroke's outer left extent is at a negative
 *     device x on every row it covers
 *
 * Identity CTM, solid colours, source-over: the direct
 * RoundedRectOpsAA.fillStroke_AA_Any path (Context2D.fillStrokeRoundRect).
 */

registerParametricPerfTests({
    baseId: 'roundrect-fused-perf',
    baseName: 'RoundRect Fused',
    category: 'rounded-rects',
    strokeCategories: ['sw1px', 'swXXS', 'swS', 'swL'],
    sizeCategories: ['szM', 'szXL'],
    operations: [
        'fused-fill-opaque-stroke-opaque',
        'fused-fill-semi-stroke-semi',
        'fused-fill-opaque-stroke-opaque-leftedge'
    ],

    /**
     * Draw function for fused fill+stroke rounded rectangle performance tests.
     * Uses pre-computed coverage sequences for stratified sampling.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} instances - Number of shapes to draw (0 = single for visual, >0 for perf)
     * @param {Object} params - { sizeSequence, strokeSequence, fixedStrokeWidth, operation }
     */
    drawFunction: function (ctx, instances, params) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const { sizeSequence, strokeSequence, fixedStrokeWidth, operation } = params;

        const isPerformanceRun = instances !== null && instances > 0;
        const numToDraw = isPerformanceRun ? instances : 1;

        const semi = operation.includes('semi');
        const leftEdge = operation.endsWith('-leftedge');
        ctx.fillStyle = semi ? 'rgba(0, 0, 255, 0.5)' : 'rgb(0, 0, 255)';
        ctx.strokeStyle = semi ? 'rgba(255, 0, 0, 0.5)' : 'rgb(255, 0, 0)';
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
            // Get per-shape values from coverage sequences
            const idx = i % sizeSequence.length;
            const size = sizeSequence[idx];
            if (strokeSequence) {
                ctx.lineWidth = strokeSequence[idx];
            }

            // Random position with margin for shape + stroke - seeded for reproducibility
            const margin = Math.max(50, size / 2 + maxStrokeWidth);
            const x = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
            const y = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);

            // Random aspect ratio (0.5 to 2.0) - also seeded for reproducibility
            const aspectRatio = 0.5 + SeededRandom.getRandom() * 1.5;
            const width = size;
            const height = size / aspectRatio;

            // Corner radius: 10-30% of smaller dimension - also seeded
            const minDim = Math.min(width, height);
            const cornerRadius = minDim * (0.1 + SeededRandom.getRandom() * 0.2);

            // leftedge: 20-60% of the width hangs off the canvas's left edge
            const rectX = leftEdge ? -width * (0.2 + SeededRandom.getRandom() * 0.4) : x - width / 2;
            const rectY = y - height / 2;

            ctx.fillStrokeRoundRect(rectX, rectY, width, height, cornerRadius);
        }

        // Return null for performance runs
        return null;
    }
});

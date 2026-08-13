/**
 * Parametric General-Affine Rectangle Performance Tests
 *
 * Measures fillRect under a GENERAL affine CTM - rotation composed with a
 * NON-UNIFORM scale - the CTM class that fails both isAxisAligned and
 * isUniformScale. These draws run the GENERIC pipeline, deliberately: a
 * direct quad arm (corner transform -> QuadScanOps.fillQuad) was implemented
 * and benchmarked against this very case on 2026-08-13 and measured DEAD
 * PARITY (0.99x-1.02x at every size/opacity) - the generic solid-fill span
 * arm is already direct-grade - so the extension was rejected on evidence
 * (DIRECT-RENDERING-SUMMARY.MD §9; structural pin: tests/core/066). This
 * case stays as the measurement harness for any future re-attempt.
 *
 * Fill operations only: strokes under general affine CTMs stay on the
 * generic path DELIBERATELY (a non-uniform transform varies edge thickness
 * with direction; the generic stroker gives the HTML5-exact anisotropic
 * edges - §9 record), so a stroke case here would measure the generic
 * pipeline against itself.
 */

registerParametricPerfTests({
    baseId: 'rect-affine-perf',
    baseName: 'Rect Affine',
    category: 'rects',
    operations: ['fill-opaque', 'fill-semi'],

    /**
     * Draw function for general-affine rectangle performance tests.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} instances - Number of shapes to draw (0 = single for visual, >0 for perf)
     * @param {Object} params - { sizeSequence, strokeSequence, fixedStrokeWidth, operation }
     */
    drawFunction: function(ctx, instances, params) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const { sizeSequence, operation } = params;

        const isPerformanceRun = instances !== null && instances > 0;
        const numToDraw = isPerformanceRun ? instances : 1;

        const fillSemi = operation.includes('fill-semi');
        ctx.fillStyle = fillSemi ? 'rgba(0, 0, 255, 0.5)' : 'rgb(0, 0, 255)';

        for (let i = 0; i < numToDraw; i++) {
            const idx = i % sizeSequence.length;
            const size = sizeSequence[idx];

            // Random position with margin for the transformed shape.
            const diagonal = Math.sqrt(size * size * 2) * 2; // extra for the non-uniform stretch
            const margin = Math.max(50, diagonal / 2);
            const centerX = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
            const centerY = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);

            // Random aspect ratio - seeded for reproducibility.
            const aspectRatio = 0.5 + SeededRandom.getRandom() * 1.5;
            const width = size;
            const height = size / aspectRatio;

            // Rotation avoiding multiples of PI/2 (must NOT be axis-aligned)...
            const angle = (SeededRandom.getRandom() * 0.9 + 0.05) * Math.PI * 2;
            // ...composed with a non-uniform scale well away from uniform
            // (must fail isUniformScale) - together: the general-affine class.
            const scaleX = 1.3 + SeededRandom.getRandom() * 0.7;
            const scaleY = 0.4 + SeededRandom.getRandom() * 0.4;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle);
            ctx.scale(scaleX, scaleY);
            ctx.fillRect(-width / 2, -height / 2, width, height);
            ctx.restore();
        }

        return null;
    }
});

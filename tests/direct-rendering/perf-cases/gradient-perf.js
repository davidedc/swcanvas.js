/**
 * Parametric Gradient Fill Performance Tests
 *
 * Generates performance tests covering:
 * - sw0 only (fills)
 * - 2 shape size categories (szM, szXL) - gradient cost is per pixel
 * - 12 operations:
 *   - fillrect-solid, pathfill-solid: plain-colour controls (the hoisted
 *     solid span arm, which never evaluates a paint source)
 *   - fillrect-linear, fillrect-radial (concentric), fillrect-radial-focal
 *     (two circles, the inner one off-centre), fillrect-conic: identity CTM
 *   - fillrect-linear-scaled, fillrect-radial-scaled: under scale(2)
 *   - fillrect-linear-rotated, fillrect-radial-rotated: under a rotation
 *   - pathfill-linear, pathfill-radial: a hexagon path fill(), identity CTM
 *
 * One gradient per draw call spans the whole canvas, so every shape samples a
 * different stretch of it and the per-pixel paint evaluation dominates; the
 * scaled and rotated variants draw the SAME device-space picture through a
 * CTM. Colour stops are semi-transparent, as gradients usually are.
 */

(function () {
    'use strict';

    const SCALE = 2;
    const ROTATION = 0.5;

    function addStops(gradient) {
        gradient.addColorStop(0, 'rgba(255, 200, 0, 0.9)');
        gradient.addColorStop(0.5, 'rgb(200, 0, 120)');
        gradient.addColorStop(1, 'rgba(0, 80, 255, 0.4)');
        return gradient;
    }

    /**
     * The paint source for an operation, in the user space the shapes are
     * drawn in: a canvas-sized frame (w x h) centred on (cx, cy).
     */
    function paintFor(ctx, operation, cx, cy, w, h) {
        if (operation.endsWith('-solid')) {
            return 'rgb(0, 0, 255)';
        }
        const reach = Math.sqrt(w * w + h * h) / 2;
        if (operation.includes('linear')) {
            return addStops(ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2));
        }
        if (operation.includes('radial-focal')) {
            return addStops(ctx.createRadialGradient(cx - w * 0.1, cy - h * 0.1, reach * 0.02, cx, cy, reach));
        }
        if (operation.includes('radial')) {
            return addStops(ctx.createRadialGradient(cx, cy, reach * 0.02, cx, cy, reach));
        }
        return addStops(ctx.createConicGradient(0.3, cx, cy));
    }

    registerParametricPerfTests({
        baseId: 'gradient-perf',
        baseName: 'Gradient',
        // 'rects': the browser perf page lists tests by its five shape categories
        category: 'rects',
        strokeCategories: ['sw0'],
        sizeCategories: ['szM', 'szXL'],
        operations: [
            'fillrect-solid',
            'fillrect-linear',
            'fillrect-radial',
            'fillrect-radial-focal',
            'fillrect-conic',
            'fillrect-linear-scaled',
            'fillrect-radial-scaled',
            'fillrect-linear-rotated',
            'fillrect-radial-rotated',
            'pathfill-solid',
            'pathfill-linear',
            'pathfill-radial'
        ],

        /**
         * Draw function for gradient fill performance tests.
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

            const scaled = operation.endsWith('-scaled');
            const rotated = operation.endsWith('-rotated');
            const isPath = operation.startsWith('pathfill');

            // save/restore: the transform must not leak into the next test
            // when a harness reuses one context.
            ctx.save();
            // User-space frame: device geometry is the same in every variant.
            let unit = 1;
            let frameCx = canvasWidth / 2;
            let frameCy = canvasHeight / 2;
            if (scaled) {
                ctx.scale(SCALE, SCALE);
                unit = 1 / SCALE;
                frameCx /= SCALE;
                frameCy /= SCALE;
            } else if (rotated) {
                ctx.translate(frameCx, frameCy);
                ctx.rotate(ROTATION);
                frameCx = 0;
                frameCy = 0;
            }
            ctx.fillStyle = paintFor(ctx, operation, frameCx, frameCy, canvasWidth * unit, canvasHeight * unit);

            for (let i = 0; i < numToDraw; i++) {
                const idx = i % sizeSequence.length;
                const size = sizeSequence[idx];

                // Random aspect ratio (0.5 to 2.0) - seeded for reproducibility
                const aspectRatio = 0.5 + SeededRandom.getRandom() * 1.5;
                const width = size;
                const height = size / aspectRatio;

                const diagonal = Math.sqrt(width * width + height * height);
                const margin = Math.max(50, diagonal / 2);
                let centerX;
                let centerY;
                if (rotated) {
                    // Inside a disk around the rotation centre, so the shape stays on the canvas
                    const radius = Math.max(0, Math.min(canvasWidth, canvasHeight) / 2 - margin);
                    const r = radius * Math.sqrt(SeededRandom.getRandom());
                    const theta = SeededRandom.getRandom() * Math.PI * 2;
                    centerX = r * Math.cos(theta);
                    centerY = r * Math.sin(theta);
                } else {
                    centerX = (margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin)) * unit;
                    centerY = (margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin)) * unit;
                }
                const w = width * unit;
                const h = height * unit;

                if (isPath) {
                    // Hexagon inscribed in the w x h box
                    ctx.beginPath();
                    ctx.moveTo(centerX - w / 2, centerY);
                    ctx.lineTo(centerX - w / 4, centerY - h / 2);
                    ctx.lineTo(centerX + w / 4, centerY - h / 2);
                    ctx.lineTo(centerX + w / 2, centerY);
                    ctx.lineTo(centerX + w / 4, centerY + h / 2);
                    ctx.lineTo(centerX - w / 4, centerY + h / 2);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillRect(centerX - w / 2, centerY - h / 2, w, h);
                }
            }

            ctx.restore();

            // Return null for performance runs
            return null;
        }
    });
})();

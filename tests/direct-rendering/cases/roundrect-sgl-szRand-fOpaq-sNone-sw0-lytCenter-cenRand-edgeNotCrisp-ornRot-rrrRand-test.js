/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests opaque fill on a single rotated rounded rectangle with random parameters.
 *              Uses SeededRandom for reproducibility. Uses Context2D methods with transforms to test
 *              the dispatch to direct rendering (Edge Buffer Rasterization algorithm).
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|----------------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws a rotated rounded rectangle via transforms + fillRoundRect.
 * | Count                  | single         | Only 1 instance drawn for focused visual inspection.
 * | SizeCategory           | random         | Width/height randomly generated (40-120px range, constrained to canvas).
 * | FillStyle              | opaque         | Fill color is fixed opaque blue (0, 0, 255) for visual clarity.
 * | StrokeStyle            | none           | Fill-only test; no stroke is applied.
 * | StrokeThickness        | 0              | No stroke.
 * | Layout                 | center         | Shape is roughly centered on canvas.
 * | CenteredAt             | random         | Center has small random offset from canvas center.
 * | EdgeAlignment          | not-crisp      | Rotation makes pixel-aligned edges irrelevant; edges are inherently not crisp.
 * | Orientation            | rotated        | Random rotation angle (0 to 2π).
 * | ArcAngleExtent         | N/A            | Not an arc test.
 * | RoundRectRadius        | random         | Radius randomly generated (5 to min(w,h)/2).
 * | ContextScaling         | none           | No scaling applied.
 * | Clipped on shape       | none           | No clipping applied in this test.
 * | Clipped on shape count | n/a            | No clipping.
 * | Clipped on shape arrangement | n/a      | No clipping.
 * | Clipped on shape size  | n/a            | No clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 */

/**
 * @fileoverview Test definition for opaque fill on a single rotated rounded rectangle with random parameters.
 */

/**
 * Draws a single rotated rounded rectangle with opaque fill and random parameters.
 *
 * @param {CanvasRenderingContext2D | SWCanvasContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For visual regression (instances is null/0), 1 rectangle is drawn.
 * @returns {?{logs: string[], checkData: object}} Logs and data for checks.
 */
function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;

    let logs = [];
    let checkData = null;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Check for roundRect support (works for both SWCanvas and modern HTML5 Canvas)
    const hasFillRoundRect = typeof ctx.fillRoundRect === 'function';
    const hasRoundRect = typeof ctx.roundRect === 'function';

    if (!hasFillRoundRect && !hasRoundRect) {
        logs.push('Skipping test: requires roundRect support');
        return { logs, checkData: { skipped: true } };
    }

    // Helper function to draw a rotated rounded rect fill
    function drawRotatedRoundRectFill(context, centerX, centerY, w, h, r, angle, fillRgb) {
        context.save();
        context.translate(centerX, centerY);
        context.rotate(angle);
        context.fillStyle = fillRgb;

        if (typeof context.fillRoundRect === 'function') {
            // SWCanvas high-level API
            context.fillRoundRect(-w / 2, -h / 2, w, h, r);
        } else {
            // HTML5 Canvas fallback: roundRect + fill
            context.beginPath();
            context.roundRect(-w / 2, -h / 2, w, h, r);
            context.fill();
        }
        context.restore();
    }

    // Generate random parameters
    const width = 40 + Math.floor(SeededRandom.getRandom() * 100);
    const height = 40 + Math.floor(SeededRandom.getRandom() * 80);
    const maxRadius = Math.min(width, height) / 2;
    const radius = 5 + Math.floor(SeededRandom.getRandom() * (maxRadius - 5)); // 5 to maxRadius
    const rotation = SeededRandom.getRandom() * Math.PI * 2;  // 0 to 2π

    // Center roughly in canvas with small random offset (±30px)
    const cx = canvasWidth / 2 + (SeededRandom.getRandom() - 0.5) * 60;
    const cy = canvasHeight / 2 + (SeededRandom.getRandom() - 0.5) * 60;

    // Fixed opaque blue color for visual clarity
    const fillColor = { r: 0, g: 0, b: 255 };

    if (isPerformanceRun) {
        // For performance runs, draw many shapes with varying parameters
        for (let i = 0; i < instances; i++) {
            const w = 40 + Math.floor(SeededRandom.getRandom() * 80);
            const h = 40 + Math.floor(SeededRandom.getRandom() * 60);
            const r = 5 + Math.floor(SeededRandom.getRandom() * (Math.min(w, h) / 2 - 5));
            const angle = SeededRandom.getRandom() * Math.PI * 2;
            const offsetX = SeededRandom.getRandom() * canvasWidth;
            const offsetY = SeededRandom.getRandom() * canvasHeight;

            const fc = {
                r: Math.floor(SeededRandom.getRandom() * 200) + 55,
                g: Math.floor(SeededRandom.getRandom() * 200) + 55,
                b: Math.floor(SeededRandom.getRandom() * 200) + 55
            };

            drawRotatedRoundRectFill(
                ctx, offsetX, offsetY, w, h, r, angle,
                `rgb(${fc.r}, ${fc.g}, ${fc.b})`
            );
        }
        return null;
    }

    // Visual test: draw single shape with random parameters
    const angleDeg = Math.round(rotation * 180 / Math.PI);

    drawRotatedRoundRectFill(
        ctx, cx, cy, width, height, radius, rotation,
        `rgb(${fillColor.r}, ${fillColor.g}, ${fillColor.b})`
    );

    logs.push(`Shape: center=(${cx.toFixed(1)},${cy.toFixed(1)}), size=${width}x${height}, r=${radius}, angle=${angleDeg}°`);
    logs.push(`Color: rgb(${fillColor.r}, ${fillColor.g}, ${fillColor.b})`);

    // Calculate rough bounds for extremes check
    const hw = width / 2;
    const hh = height / 2;
    const diag = Math.sqrt(hw * hw + hh * hh);

    checkData = {
        shapeCount: 1,
        expectedMinX: Math.floor(cx - diag),
        expectedMaxX: Math.ceil(cx + diag),
        expectedMinY: Math.floor(cy - diag),
        expectedMaxY: Math.ceil(cy + diag)
    };

    return { logs, checkData };
}

// Register the test
registerDirectRenderingTest(
    'roundrect-sgl-szRand-fOpaq-sNone-sw0-lytCenter-cenRand-edgeNotCrisp-ornRot-rrrRand',
    drawTest,
    'rounded-rects',
    {
        extremes: false  // Rotated shapes have complex bounds, skip strict extremes check
    },
    {
        title: 'Single Rotated Rounded Rectangle - Opaque Fill (Random)',
        description: 'Tests high-level API rendering of opaque fill on a single rotated rounded rectangle using transforms and fillRoundRect.',
        displayName: 'Perf: Single Rotated RRect Opaque Fill (Random)'
    }
);

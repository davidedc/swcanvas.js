/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests 1px semi-transparent stroke on a single rotated rounded rectangle with random parameters.
 *              Uses SeededRandom for reproducibility. Uses Context2D methods with transforms to test
 *              the dispatch to direct rendering (hybrid algorithm with Set deduplication for alpha blending).
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|----------------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws a rotated rounded rectangle via transforms + strokeRoundRect.
 * | Count                  | single         | Only 1 instance drawn for focused visual inspection.
 * | SizeCategory           | random         | Width/height randomly generated (40-120px range, constrained to canvas).
 * | FillStyle              | none           | Stroke-only test; no fill is applied.
 * | StrokeStyle            | semi           | Stroke color is semi-transparent (alpha = 0.6) for testing alpha blending.
 * | StrokeThickness        | 1px            | Tests 1px stroke with Set deduplication for overdraw prevention.
 * | Layout                 | center         | Shape is roughly centered on canvas.
 * | CenteredAt             | random         | Center has small random offset from canvas center.
 * | EdgeAlignment          | not-crisp      | Rotation makes pixel-aligned edges irrelevant; edges are inherently not crisp.
 * | Orientation            | rotated        | Random rotation angle (0 to 2π).
 * | ArcAngleExtent         | N/A            | Not an arc test.
 * | RoundRectRadius        | random         | Radius randomly generated (5 to min(w,h)/2).
 * | ContextRotation        | none           | Rotation is passed directly to `strokeRotated()`, not via `ctx.rotate()`.
 * | ContextScaling         | none           | No scaling applied.
 * | Clipped on shape       | none           | No clipping applied in this test.
 * | Clipped on shape count | n/a            | No clipping.
 * | Clipped on shape arrangement | n/a      | No clipping.
 * | Clipped on shape size  | n/a            | No clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 */

/**
 * @fileoverview Test definition for 1px semi-transparent stroke on a single rotated rounded rectangle with random parameters.
 */

/**
 * Draws a single rotated rounded rectangle with 1px semi-transparent stroke and random parameters.
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
    const hasStrokeRoundRect = typeof ctx.strokeRoundRect === 'function';
    const hasRoundRect = typeof ctx.roundRect === 'function';

    if (!hasStrokeRoundRect && !hasRoundRect) {
        logs.push('Skipping test: requires roundRect support');
        return { logs, checkData: { skipped: true } };
    }

    // Helper function to draw a rotated rounded rect stroke with alpha
    function drawRotatedRoundRectStroke(context, centerX, centerY, w, h, r, angle, strokeRgb, alpha) {
        context.save();
        context.globalAlpha = alpha;
        context.translate(centerX, centerY);
        context.rotate(angle);
        context.strokeStyle = strokeRgb;
        context.lineWidth = 1;

        if (typeof context.strokeRoundRect === 'function') {
            // SWCanvas high-level API
            context.strokeRoundRect(-w / 2, -h / 2, w, h, r);
        } else {
            // HTML5 Canvas fallback: roundRect + stroke
            context.beginPath();
            context.roundRect(-w / 2, -h / 2, w, h, r);
            context.stroke();
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

    // Semi-transparent orange color for visual clarity
    const strokeColor = { r: 255, g: 128, b: 0 };
    const strokeAlpha = 0.6;

    if (isPerformanceRun) {
        // For performance runs, draw many shapes with varying parameters
        for (let i = 0; i < instances; i++) {
            const w = 40 + Math.floor(SeededRandom.getRandom() * 80);
            const h = 40 + Math.floor(SeededRandom.getRandom() * 60);
            const r = 5 + Math.floor(SeededRandom.getRandom() * (Math.min(w, h) / 2 - 5));
            const angle = SeededRandom.getRandom() * Math.PI * 2;
            const offsetX = SeededRandom.getRandom() * canvasWidth;
            const offsetY = SeededRandom.getRandom() * canvasHeight;
            const alpha = 0.3 + SeededRandom.getRandom() * 0.5;

            const sc = {
                r: Math.floor(SeededRandom.getRandom() * 200) + 55,
                g: Math.floor(SeededRandom.getRandom() * 200) + 55,
                b: Math.floor(SeededRandom.getRandom() * 200) + 55
            };

            drawRotatedRoundRectStroke(
                ctx, offsetX, offsetY, w, h, r, angle,
                `rgb(${sc.r}, ${sc.g}, ${sc.b})`, alpha
            );
        }
        return null;
    }

    // Visual test: draw single shape with random parameters
    const angleDeg = Math.round(rotation * 180 / Math.PI);

    drawRotatedRoundRectStroke(
        ctx, cx, cy, width, height, radius, rotation,
        `rgb(${strokeColor.r}, ${strokeColor.g}, ${strokeColor.b})`, strokeAlpha
    );

    logs.push(`Shape: center=(${cx.toFixed(1)},${cy.toFixed(1)}), size=${width}x${height}, r=${radius}, angle=${angleDeg}°`);
    logs.push(`Stroke: rgba(${strokeColor.r}, ${strokeColor.g}, ${strokeColor.b}, ${strokeAlpha}), lineWidth=1`);

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
    'roundrect-sgl-szRand-fNone-sSemi-sw1px-lytCenter-cenRand-edgeNotCrisp-ornRot-rrrRand',
    drawTest,
    'rounded-rects',
    {
        extremes: false,  // Rotated shapes have complex bounds, skip strict extremes check
        totalUniqueColors: 2,  // Background + single semi-transparent stroke color (no overdraw)
        shapeIntegrity: true
    },
    {
        title: 'Single Rotated Rounded Rectangle - 1px Semi-Transparent Stroke (Random)',
        description: 'Tests high-level API rendering of 1px semi-transparent stroke on a single rotated rounded rectangle using transforms and strokeRoundRect.',
        perfName: 'Perf: Single Rotated RRect 1px Alpha Stroke (Random)'
    }
);

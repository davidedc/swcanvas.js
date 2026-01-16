/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of multiple rotated rectangles with random positions, sizes, angles, strokes, and fills.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rectangles     | The test draws rectangles using `ctx.fillRect()` and `ctx.strokeRect()`.
 * | Count                  | multi-5        | The test draws 5 instances in visual regression mode, as defined by `numToDraw`.
 * | SizeCategory           | mixed          | The width and height are randomized in the range `[30, 130)`, which spans the S, M, and L size categories.
 * | FillStyle              | semitransparent| Fill alpha is randomized in the range `[100, 200]` (out of 255), which is always semi-transparent.
 * | StrokeStyle            | mixed          | Stroke alpha is randomized in the range `[200, 255]`, which includes both semi-transparent and fully opaque values.
 * | StrokeThickness        | 1px-10px       | The stroke width is randomized in the range `[1, 11)`, resulting in integer values from 1 to 10.
 * | Layout                 | spread         | The `getRandomPoint()` function is called for each of the 5 instances, spreading them across the canvas.
 * | CenteredAt             | random         | The geometric center of each rectangle is placed at a fully random point on the canvas.
 * | EdgeAlignment          | not-crisp      | The rectangles are rotated by a fully random angle, which prevents crisp edge alignment.
 * | Orientation            | random         | `ctx.rotate()` is used with a fully random angle for each instance.
 * | ArcAngleExtent         | N/A            | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | N/A            | This facet is not applicable to non-rounded rectangle shapes.
 * | ContextTranslation     | random         | `ctx.translate()` is called with a random (x, y) point for each rectangle's center.
 * | ContextRotation        | random         | `ctx.rotate()` is called with a random angle for each instance.
 * | ContextScaling         | none           | The `ctx.scale()` function is not used in this test.
 * | Clipped on shape       | none           | No clipping is applied in this test.
 * | Clipped on shape count | n/a            | No clipping is applied in this test.
 * | Clipped on shape arrangement | n/a      | No clipping is applied in this test.
 * | Clipped on shape size  | n/a            | No clipping is applied in this test.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * The test is designed to draw 5 instances in visual mode. In performance mode, it draws a variable number of instances and spreads them using `Math.random()` to avoid overdraw, which differs from the `SeededRandom`-based positioning in visual mode. The randomization ranges for colors, dimensions, and rotation are specific to this test's implementation.
 *
 */

/**
 * @fileoverview Test definition for multiple rotated rectangles with random parameters.
 *
 * Ported from Minimal-2D-Js-Software-Renderer for SWCanvas.
 */

/**
 * Draws multiple rotated rectangles with random parameters.
 *
 * @param {CanvasRenderingContext2D} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For this test, it dictates the number of rectangles drawn.
 *                  For visual regression (instances is null/0), 5 rectangles are drawn.
 * @returns {?{logs: string[]}} Logs for single-instance mode, or null for performance mode.
 *                   (No checkData as original test had no withExtremesCheck).
 */
function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 5; // Original test draws 5

    const logs = [];
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < numToDraw; i++) {
        // Preserve SeededRandom sequence from original addRotatedRectangles:
        // 1. center (via getRandomPoint which uses SeededRandom)
        const center = getRandomPoint(1, canvasWidth, canvasHeight);

        // 2. width
        const width = 30 + SeededRandom.getRandom() * 100;
        // 3. height
        const height = 30 + SeededRandom.getRandom() * 100;
        // 4. rotation
        const rotation = SeededRandom.getRandom() * Math.PI * 2;
        // 5. strokeWidth
        const strokeWidth = SeededRandom.getRandom() * 10 + 1;

        // 6. strokeColor (getRandomColor uses SeededRandom) - SWCanvas returns CSS strings directly
        const strokeColorStr = getRandomColor("mixed"); // Opaque or semi-transparent stroke
        // 7. fillColor (getRandomColor uses SeededRandom)
        const fillColorStr = getRandomColor("semitransparent");   // Semi-transparent fill

        let drawAtX = center.x;
        let drawAtY = center.y;

        if (isPerformanceRun) {
            // For performance, spread shapes widely using Math.random (does not affect SeededRandom sequence)
            drawAtX = Math.random() * canvasWidth;
            drawAtY = Math.random() * canvasHeight;
        }

        ctx.save();
        ctx.translate(drawAtX, drawAtY);
        ctx.rotate(rotation);

        // Draw relative to the new origin (0,0) which is the rectangle's center
        const rectX = -width / 2;
        const rectY = -height / 2;

        ctx.fillStyle = fillColorStr;
        ctx.fillRect(rectX, rectY, width, height);

        if (strokeWidth > 0) {
            ctx.strokeStyle = strokeColorStr;
            ctx.lineWidth = strokeWidth;
            ctx.strokeRect(rectX, rectY, width, height);
        }
        ctx.restore();

        if (!isPerformanceRun) {
            logs.push(`Rotated Rect ${i+1}: center=(${center.x.toFixed(1)},${center.y.toFixed(1)}), w=${width.toFixed(1)}, h=${height.toFixed(1)}, rot=${(rotation * 180 / Math.PI).toFixed(1)}deg, sw=${strokeWidth.toFixed(1)}`);
        }
    }

    if (isPerformanceRun) {
        return null;
    } else {
        // Original test did not have withExtremesCheck, so no checkData is returned.
        return { logs };
    }
}

// Register the test
registerDirectRenderingTest(
    'rect-m5-szMix-fSemi-sMix-sw1-10px-lytSpread-cenRand-edgeNotCrisp-ornRand-ctxTransRand-ctxRotRand-test',
    drawTest,
    'rectangles',
    {
        // No extremes check - original test had none
        // allowPathBasedRendering: false is the default - test MUST use direct rendering
    },
    {
        title: 'Rectangles: Rotated, Multiple, Variable Size & Params, Random Position & Rotation',
        description: 'Tests rendering of multiple rotated rectangles with random positions, sizes, angles, strokes, and fills.',
        perfName: 'Perf: Rects Rotated Multi Random'
    }
);

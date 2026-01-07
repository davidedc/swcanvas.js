/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of a single rotated rectangle with opaque stroke (exercises strokeRotated direct rendering).
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rectangles     | The test draws a rectangle using `ctx.fillRect()` and `ctx.strokeRect()`.
 * | Count                  | single         | The test draws a single rectangle instance.
 * | SizeCategory           | mixed          | The width and height are randomized in the range `[30, 130)`, which spans the S, M, and L size categories.
 * | FillStyle              | semitransparent| Fill alpha is randomized in the range `[100, 200]` (out of 255), which is always semi-transparent.
 * | StrokeStyle            | opaque         | Stroke uses `getRandomColor("opaque")` which generates fully opaque colors (alpha = 255).
 * | StrokeThickness        | 1px-10px       | The stroke width is randomized in the range `[1, 11)`, resulting in integer values from 1 to 10.
 * | Layout                 | random         | The `getRandomPoint()` function is called for placement at a random position on the canvas.
 * | CenteredAt             | random         | The geometric center of the rectangle is placed at a fully random point on the canvas.
 * | EdgeAlignment          | not-crisp      | The rectangle is rotated by a fully random angle, which prevents crisp edge alignment.
 * | Orientation            | random         | `ctx.rotate()` is used with a fully random angle.
 * | ArcAngleExtent         | N/A            | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | N/A            | This facet is not applicable to non-rounded rectangle shapes.
 * | ContextTranslation     | random         | `ctx.translate()` is called with a random (x, y) point for the rectangle's center.
 * | ContextRotation        | random         | `ctx.rotate()` is called with a random angle.
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
 * The randomization ranges for colors, dimensions, and rotation are specific to this test's implementation.
 * This is the opaque stroke variant of the rotated rectangle test.
 *
 */

/**
 * @fileoverview Test definition for a single rotated rectangle with opaque stroke.
 *
 * Exercises the RectOps.strokeRotated() direct rendering (opaque strokes).
 */

/**
 * Draws a single rotated rectangle with opaque stroke.
 *
 * @param {CanvasRenderingContext2D} ctx The rendering context.
 * @param {number} currentIterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For this test, it dictates the number of rectangles drawn.
 *                  For visual regression (instances is null/0), 1 rectangle is drawn.
 * @returns {?{logs: string[]}} Logs for single-instance mode, or null for performance mode.
 *                   (No checkData as original test had no withExtremesCheck).
 */
function drawTest(ctx, currentIterationNumber, instances = null) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 1; // Single rectangle for visual regression

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

        // 6. Standardized colors: opaque red stroke, semi-transparent blue fill
        const strokeColorStr = 'rgb(255, 0, 0)'; // Opaque red stroke
        // 7. fillColor
        const fillColorStr = 'rgba(0, 0, 255, 0.49)';   // Semi-transparent blue fill

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
            logs.push(`Rotated Rect: center=(${center.x.toFixed(1)},${center.y.toFixed(1)}), w=${width.toFixed(1)}, h=${height.toFixed(1)}, rot=${(rotation * 180 / Math.PI).toFixed(1)}deg, sw=${strokeWidth.toFixed(1)}`);
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
    'rect-sgl-szMix-fSemi-sOpaq-sw1-10px-lytRand-cenRand-edgeNotCrisp-ornRand-ctxTransRand-ctxRotRand-test',
    drawTest,
    'rectangles',
    {
        // No extremes check - original test had none
        // allowPathBasedRendering: false is the default - test MUST use direct rendering
        totalUniqueColors: 3,  // background + fill + stroke (opaque stroke overwrites, no blend color)
        strokePatternContinuity: true
    },
    {
        title: 'Rectangle: Rotated, Single, Opaque Stroke, Random Position & Rotation',
        description: 'Tests rendering of a single rotated rectangle with opaque stroke (exercises strokeRotated code path).',
        displayName: 'Perf: Rect Rotated Single Opaq Stroke'
    }
);

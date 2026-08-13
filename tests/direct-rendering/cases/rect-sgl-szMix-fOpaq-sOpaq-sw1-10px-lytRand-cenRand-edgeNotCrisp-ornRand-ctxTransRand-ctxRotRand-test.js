/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of a single rotated rectangle with opaque fill and opaque stroke (exercises fillRotated and strokeRotated direct rendering with opaque colors).
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rectangles     | The test draws a rectangle using `ctx.fillRect()` and `ctx.strokeRect()`.
 * | Count                  | single         | The test draws a single rectangle instance.
 * | SizeCategory           | mixed          | The width and height are randomized in the range `[30, 130)`, which spans the S, M, and L size categories.
 * | FillStyle              | opaque         | Fill uses `getRandomColor("opaque")` which generates fully opaque colors (alpha = 255).
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
 * This is the fully opaque variant of the rotated rectangle test (both fill and stroke opaque).
 * Tests RectOps.fillRotated() and RectOps.strokeRotated() with opaque colors.
 *
 */

/**
 * @fileoverview Test definition for a single rotated rectangle with opaque fill and stroke.
 *
 * Exercises the RectOps.fillRotated() and RectOps.strokeRotated() direct rendering with opaque colors.
 */

/**
 * Draws a single rotated rectangle with opaque fill and opaque stroke.
 *
 * @param {CanvasRenderingContext2D} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For this test, it dictates the number of rectangles drawn.
 *                  For visual regression (instances is null/0), 1 rectangle is drawn.
 * @returns {?{logs: string[]}} Logs for single-instance mode, or null for performance mode.
 */
function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 1; // Single rectangle for visual regression

    const logs = [];
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < numToDraw; i++) {
        // Preserve SeededRandom sequence:
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

        // 6. Standardized colors: opaque blue fill
        const fillColorStr = 'rgb(0, 0, 255)';
        // 7. Standardized colors: opaque red stroke
        const strokeColorStr = 'rgb(255, 0, 0)';

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
            logs.push(`Rotated Rect (Opaque): center=(${center.x.toFixed(1)},${center.y.toFixed(1)}), w=${width.toFixed(1)}, h=${height.toFixed(1)}, rot=${(rotation * 180 / Math.PI).toFixed(1)}deg, sw=${strokeWidth.toFixed(1)}`);
        }
    }

    if (isPerformanceRun) {
        return null;
    } else {
        return { logs };
    }
}

// Register the test
registerDirectRenderingTest(
    'rect-sgl-szMix-fOpaq-sOpaq-sw1-10px-lytRand-cenRand-edgeNotCrisp-ornRand-ctxTransRand-ctxRotRand',
    drawTest,
    'rectangles',
    {
        // No extremes check - rotated shapes have complex bounds
        totalUniqueColors: 3,  // background + opaque fill + opaque stroke (stroke overwrites fill at edges)
        shapeIntegrity: true,
        allowPathBasedRendering: true // rect FILLS are generic since the fill-arm removal (DIRECT-RENDERING-SUMMARY.MD §9 entries 15-16); strokes stay direct
    },
    {
        title: 'Rectangle: Rotated, Single, Opaque Fill + Opaque Stroke, Random Position & Rotation',
        description: 'Tests rendering of a single rotated rectangle with opaque fill and opaque stroke (exercises fillRotated and strokeRotated with opaque colors).',
    }
);

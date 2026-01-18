/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Test with 12 arcs, each at 90 degrees, using fixed parameters and a grid layout.
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs           | The test calls `ctx.outerStrokeArc` to draw arcs.
 * | Count                  | multi-12       | The test uses nested loops (4 stroke sizes * 3 radii) to draw exactly 12 arcs.
 * | SizeCategory           | mixed          | The radii used are `[20, 40, 60]`, which span size categories 'S' (16-39px) and 'M' (40-79px).
 * | FillStyle              | none           | No fill operation is performed; only `outerStrokeArc` is called.
 * | StrokeStyle            | opaque         | The stroke color alpha value is fixed at 255, making it fully opaque.
 * | StrokeThickness        | mixed          | The test uses a discrete set of stroke widths: `[1, 2, 3, 4]`.
 * | Layout                 | grid           | Arcs are positioned in a clear grid formation using `xOffset` and `yOffset` increments.
 * | CenteredAt             | grid           | The centers of the arcs are set to explicit integer coordinates, aligning them to the pixel grid.
 * | EdgeAlignment          | not-crisp      | No specific logic is used to align strokes to pixel boundaries, leading to anti-aliased edges.
 * | Orientation            | horizontal     | The `startAngle` for all arcs is fixed at 0, representing a consistent horizontal baseline.
 * | ArcAngleExtent         | 90-deg         | The angle extent is fixed at `Math.PI / 2`, which is 90 degrees.
 * | RoundRectRadius        | N/A            | This facet is not applicable to arc shapes.
 * | ContextTranslation     | none           | The test does not use `ctx.translate()`.
 * | ContextRotation        | none           | The test does not use `ctx.rotate()`.
 * | ContextScaling         | none           | The test does not use `ctx.scale()`.
 * | Clipped on shape       | none           | The test does not involve any clipping operations.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The visual regression mode uses a fixed stroke color of `rgba(200, 100, 100, 255)`.
 * - The performance mode (`isPerformanceRun = true`) uses different, fully randomized parameters for radius,
 *   stroke width, color, and position, which are not reflected in the facets for the visual test.
 *
 */

/**
 * @fileoverview Test definition for 90-degree arcs with various radii and stroke widths.
 */

/**
 * Draws 90-degree arcs.
 * In visual regression mode, it draws a fixed grid of 12 arcs.
 * In performance mode, it draws `instances` number of fully randomized 90-degree arcs.
 *
 * @param {CanvasRenderingContext2D | Context2D} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. For this test, it always draws
 *                  the predefined set of 12 arcs for visual regression. For performance, it draws `instances` arcs.
 * @returns {?{logs: string[]}} Logs for the visual regression run.
 */
function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDrawForPerf = isPerformanceRun ? instances : 0;
    let logs = [];

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    if (!isPerformanceRun) {
        // --- Visual Regression Mode: Draw the fixed grid of 12 arcs ---
        const strokeSizes = [1, 2, 3, 4];
        const radii = [20, 40, 60];
        let xOffset = 50;
        const fixedStrokeColorStr = 'rgb(255, 0, 0)';

        for (const strokeWidth of strokeSizes) {
            let yOffset = 40;
            for (const radius of radii) {
                const centerX = xOffset;
                const centerY = yOffset;
                const startAngleRad = 0; // 0 degrees
                const endAngleRad = Math.PI / 2;   // 90 degrees

                ctx.strokeStyle = fixedStrokeColorStr;
                ctx.lineWidth = strokeWidth;
                ctx.outerStrokeArc(centerX, centerY, radius, startAngleRad, endAngleRad, false);

                logs.push(
                    `\u25DC 90\u00B0 Arc (Fixed Grid): center=(${centerX},${centerY}), r=${radius}, sw=${strokeWidth}`
                );
                yOffset += radius * 2 + 10;
            }
            xOffset += 90;
        }
        return { logs };

    } else {
        // --- Performance Mode: Draw `numToDrawForPerf` randomized 90-degree arcs ---
        const quadrants = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2];

        for (let i = 0; i < numToDrawForPerf; i++) {
            // Each arc gets fully random parameters
            const radius = 10 + SeededRandom.getRandom() * 50; // Random radius 10-60
            const strokeWidth = 1 + SeededRandom.getRandom() * 4; // Random stroke width 1-5

            // Random starting quadrant for the 90-degree arc
            const startAngleRad = quadrants[Math.floor(SeededRandom.getRandom() * 4)];
            const endAngleRad = startAngleRad + Math.PI / 2;

            // Mixed transparency for stroke (50/50 opaque vs semi-transparent)
            const strokeIsOpaque = SeededRandom.getRandom() < 0.5;
            const strokeColorStr = strokeIsOpaque ? 'rgb(255, 0, 0)' : 'rgba(255, 0, 0, 0.49)';

            // Base position from SeededRandom
            let drawCenterX = SeededRandom.getRandom() * canvasWidth;
            let drawCenterY = SeededRandom.getRandom() * canvasHeight;

            // Additional large random offset for performance test spread (using Math.random)
            drawCenterX = Math.random() * canvasWidth;
            drawCenterY = Math.random() * canvasHeight;

            // Ensure it's somewhat on screen (simple clamp)
            drawCenterX = Math.max(radius + strokeWidth, Math.min(drawCenterX, canvasWidth - radius - strokeWidth));
            drawCenterY = Math.max(radius + strokeWidth, Math.min(drawCenterY, canvasHeight - radius - strokeWidth));

            ctx.strokeStyle = strokeColorStr;
            ctx.lineWidth = strokeWidth;
            ctx.outerStrokeArc(drawCenterX, drawCenterY, radius, startAngleRad, endAngleRad, false);
        }
        return null; // No logs for performance run
    }
}

// Register the test
registerDirectRenderingTest(
    'arc-m12-szMix-fNone-sOpaq-swMix-lytGrid-cenGrid-edgeNotCrisp-ornHoriz-arcADeg90-test',
    drawTest,
    'arcs',
    {
        // Default visual comparison - no allowPathBasedRendering means direct rendering required
    },
    {
        title: '90\u00B0 Arcs (Multiple, Fixed Params, Grid Layout)',
        description: 'Tests rendering of 90\u00B0 arcs with various fixed radii and stroke widths in a grid.',
    }
);

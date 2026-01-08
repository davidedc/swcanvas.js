/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Test with 5 arcs, all parameters fully randomized.
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs           | The test draws exclusively `arc` shapes using `ctx.fillOuterStrokeArc`.
 * | Count                  | multi-5        | The test draws 5 instances in a loop for the visual regression case.
 * | SizeCategory           | mixed          | The radius is randomized in `[15, 65)`, which spans the S and M size categories for circles.
 * | FillStyle              | opaque         | `fillStyle` is set via `getRandomColor()` which produces a fully opaque color. A fill is applied.
 * | StrokeStyle            | opaque         | `strokeStyle` is set via `getRandomColor()` which produces a fully opaque color. A stroke is applied.
 * | StrokeThickness        | 1px-10px       | `lineWidth` is randomized in the range `[1, 11)`, which is categorized as `1px-10px`.
 * | Layout                 | spread         | The 5 arcs are positioned randomly across the canvas using `getRandomPoint()` for each.
 * | CenteredAt             | random         | Arc centers are random floating-point coordinates with no snapping to a grid or pixel centers.
 * | EdgeAlignment          | not-crisp      | Use of random floating-point values for position, size, and stroke width without adjustment results in non-pixel-aligned edges.
 * | Orientation            | random         | Both the start angle and end angle of the arcs are randomized, resulting in random orientations.
 * | ArcAngleExtent         | randomized     | The arc's angular extent is randomized in the range `[90, 360)` degrees.
 * | RoundRectRadius        | N/A            | This facet is not applicable to `arc` shapes.
 * | ContextTranslation     | none           | The test code does not use `ctx.translate()`.
 * | ContextRotation        | none           | The test code does not use `ctx.rotate()`.
 * | ContextScaling         | none           | The test code does not use `ctx.scale()`.
 * | Clipped on shape       | none           | The test code does not use clipping.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * Specific randomization ranges for radius, start/end angles, stroke color. strokeWidth: SR.get()*10+1 => [1,11) => 1-10px. Arc radius [15,65) spans S,M circle categories.
 *
 */

/**
 * @fileoverview Test definition for multiple fully random arcs.
 */

/**
 * Draws multiple arcs with fully random parameters.
 *
 * @param {CanvasRenderingContext2D | Context2D} ctx The rendering context.
 * @param {number} currentIterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. For visual regression (instances is null/0), 5 arcs are drawn.
 * @returns {?{logs: string[]}} Logs for single-instance mode, or null for performance mode.
 */
function drawTest(ctx, currentIterationNumber, instances = null) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 5; // Original test draws 5

    let logs = [];

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < numToDraw; i++) {
        // Parameters from getRandomArc()
        // SeededRandom Call 1 & 2 (inside getRandomPoint for x, y)
        const center = getRandomPoint(1, canvasWidth, canvasHeight);
        // SeededRandom Call 3: radius
        const radius = 15 + SeededRandom.getRandom() * 50;
        // SeededRandom Call 4: startAngle (degrees)
        const startAngleDeg = SeededRandom.getRandom() * 360;
        // SeededRandom Call 5: endAngle (degrees, relative to start)
        const endAngleDeg = startAngleDeg + SeededRandom.getRandom() * 270 + 90;
        // SeededRandom Call 6: strokeWidth
        const strokeWidth = SeededRandom.getRandom() * 10 + 1;
        // SeededRandom Call 7: strokeColor
        const strokeColor = getRandomColor("mixed");
        // SeededRandom Call 8: fillColor
        const fillColor = getRandomColor("semitransparent");

        // Convert angles to radians for context arc methods
        const startAngleRad = startAngleDeg * Math.PI / 180;
        const endAngleRad = endAngleDeg * Math.PI / 180;

        let drawCenterX = center.x;
        let drawCenterY = center.y;

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;

        // Use fillOuterStrokeArc as both fill and stroke are defined with random colors
        ctx.fillOuterStrokeArc(drawCenterX, drawCenterY, radius, startAngleRad, endAngleRad, false);

        if (!isPerformanceRun) {
            logs.push(
                `RandArc ${i + 1}: center=(${center.x.toFixed(1)},${center.y.toFixed(1)}), r=${radius.toFixed(1)}, ang=(${startAngleDeg.toFixed(0)}\u00B0,${endAngleDeg.toFixed(0)}\u00B0), sw=${strokeWidth.toFixed(1)}`
            );
        }
    }

    if (isPerformanceRun) {
        return null;
    }
    return { logs };
}

// Register the test
registerDirectRenderingTest(
    'arc-m5-szMix-fSemi-sMix-sw1-10px-lytSpread-cenRand-edgeNotCrisp-ornRand-arcARand',
    drawTest,
    'arcs',
    {
        // Default visual comparison - no allowPathBasedRendering means direct rendering required
    },
    {
        title: 'Perf: Arc 5 Fully Random',
        displayName: 'Perf: Arc 5 Fully Random',
        description: 'Test with 5 arcs, all parameters fully randomized.'
    }
);

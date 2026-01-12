/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single randomly positioned circle with no stroke, random fill, and crisp rendering. The circle's radius and position are randomized within defined constraints.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test calls `ctx.fillCircle()` to draw the shape.
 * | Count                  | single         | The test logic is designed to draw one primary shape instance per iteration.
 * | SizeCategory           | mixed          | The radius is randomized in the range [10, 225], which spans the S, M, L, and XL size categories.
 * | FillStyle              | semitransparent| `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | none           | The `strokeWidth` variable is explicitly set to 0 and no stroke operation is performed.
 * | StrokeThickness        | none           | Consistent with `StrokeStyle: none`.
 * | Layout                 | random         | A single shape is placed at a random (x, y) position within calculated canvas margins.
 * | CenteredAt             | random         | The final center coordinates (x, y) are randomized, not snapped to a grid or pixel center.
 * | EdgeAlignment          | crisp          | The test explicitly calls `adjustDimensionsForCrispStrokeRendering()` to ensure sharp edges.
 * | Orientation            | N/A            | Not applicable for circles, which are rotationally symmetrical.
 * | ArcAngleExtent         | N/A            | Not applicable; this facet is for `arcs` only.
 * | RoundRectRadius        | N/A            | Not applicable; this facet is for `rounded-rects` only.
 * | ContextTranslation     | none           | The test does not call `ctx.translate()`.
 * | ContextRotation        | none           | The test does not call `ctx.rotate()`.
 * | ContextScaling         | none           | The test does not call `ctx.scale()`.
 * | Clipped on shape       | none           | No clipping region is defined or applied in this test.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The specific randomization range for the circle's radius is [10, 225].
 * - The fill color is randomized semitransparent.
 * - Uses SWCanvas direct API method `ctx.fillCircle()`.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-szMix-fSemi-sNone-lytRand-cenRand-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use calculateCircleTestParameters with random positioning
        const params = calculateCircleTestParameters({
            canvasWidth,
            canvasHeight,
            minRadius: 10,
            maxRadius: 225,
            hasStroke: false,  // No stroke
            randomPosition: true,  // Enable random positioning
            marginX: 10,
            marginY: 10
        });

        const { centerX, centerY, radius, finalDiameter, atPixel } = params;

        // Use standardized color: semitransparent blue fill (50% - original behavior)
        const fillColor = 'rgba(0, 0, 255, 0.49)';

        // Draw filled circle (no stroke) using Direct API for direct rendering
        ctx.fillStyle = fillColor;
        ctx.fillCircle(centerX, centerY, radius);

        return {
            logs: [`RandPos Circle (no stroke): center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}`],
            checkData: {
                leftX: Math.floor(centerX - radius),
                rightX: Math.floor(centerX + radius - 1),
                topY: Math.floor(centerY - radius),
                bottomY: Math.floor(centerY + radius - 1)
            }
        };
    },
    'circles',
    {
        extremes: { colorTolerance: 8, tolerance: 0.03 },
        noGapsInFillEdges: true,
        totalUniqueColors: 2,
        speckles: true,
        shapeIntegrity: { hasFill: true, hasStroke: false }
    },
    {
        title: 'Single Randomly Positioned Circle Without Stroke (Crisp)',
        description: 'Tests a single randomly positioned circle with no stroke, random fill, and crisp center.',
        displayName: 'Perf: Circle RandPos NoStroke Crisp'
    }
);

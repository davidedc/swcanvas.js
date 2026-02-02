/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single filled arc (no stroke) with random position and opaque color.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs               | The test focuses on rendering an arc.
 * | Count                  | single             | The test draws a single arc instance in its visual verification mode.
 * | SizeCategory           | mixed              | The radius is randomized in a range of [10, 225), spanning multiple size categories.
 * | FillStyle              | opaque             | `getRandomOpaqueColor()` is called for the fill.
 * | StrokeStyle            | none               | No stroke is applied.
 * | StrokeThickness        | N/A                | Not applicable as there is no stroke.
 * | Layout                 | random             | The arc is positioned randomly within canvas bounds.
 * | CenteredAt             | random             | Center coordinates are random floating-point values.
 * | EdgeAlignment          | crisp              | Crisp edge alignment is used.
 * | Orientation            | N/A                | Arc orientation determined by angle parameters.
 * | ArcAngleExtent         | >270°              | Gap < 90° ensures all cardinal points included for extremes check.
 * | RoundRectRadius        | N/A                | Not applicable to arcs.
 * | ContextTranslation     | none               | `ctx.translate()` is not used in this test.
 * | ContextRotation        | none               | `ctx.rotate()` is not used in this test.
 * | ContextScaling         | none               | `ctx.scale()` is not used in this test.
 * | Clipped on shape       | none               | No clipping path is defined or applied in this test.
 * | Clipped on shape count | n/a                | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a          | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a                | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a       | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The fill color is a randomized opaque color.
 * - Uses SWCanvas direct API method `ctx.fillArc()` for fill-only rendering.
 * - Gap positioned randomly within a single quadrant.
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fOpaq-sNone-lytRand-cenRand-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use calculateArcTestParams for proper setup with random position
        const params = calculateArcTestParams({
            canvasWidth,
            canvasHeight,
            minRadius: 10,
            maxRadius: 225,
            hasStroke: false,
            randomPosition: true,  // Random position
            marginX: 60,
            marginY: 60
        });

        const { centerX, centerY, radius, startAngle, endAngle, gapSizeDeg } = params;

        // Opaque blue fill
        const fillColor = 'rgb(0, 0, 255)';

        // Draw filled arc (no stroke)
        ctx.fillStyle = fillColor;
        ctx.fillArc(centerX, centerY, radius, startAngle, endAngle);

        return {
            logs: [`Arc: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, gap=${gapSizeDeg.toFixed(1)}°`],
            checkData: {
                leftX: Math.floor(centerX - radius),
                rightX: Math.floor(centerX + radius - 1),
                topY: Math.floor(centerY - radius),
                bottomY: Math.floor(centerY + radius - 1)
            }
        };
    },
    'arcs',
    {
        extremes: { alphaThreshold: 63 },
        totalUniqueColors: 2
    },
    {
        title: 'Single Filled Arc (No Stroke, Random Position)',
        description: 'Tests a single filled arc (no stroke) with random position and opaque color.',
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests fillArc with opaque color uses direct rendering (32-bit packed writes).
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs           | The test draws an arc using ctx.fillArc().
 * | Count                  | single         | The test draws one arc instance.
 * | SizeCategory           | mixed          | Radius is randomized 30-80px, spanning S (16-39) and M (40-79) categories.
 * | FillStyle              | opaque         | Fill color is 'rgb(0, 0, 255)' with full opacity.
 * | StrokeStyle            | none           | No stroke operation is performed.
 * | StrokeThickness        | N/A            | Not applicable as there is no stroke.
 * | Layout                 | centered       | The shape is positioned at the canvas center (randomPosition: false).
 * | CenteredAt             | random         | Center position is calculated by helper function with some randomization.
 * | EdgeAlignment          | crisp          | Integer coordinates used for center position.
 * | Orientation            | N/A            | Arc orientation determined by start/end angles.
 * | ArcAngleExtent         | >270°          | Arc extends more than 270 degrees with gap < 90 degrees.
 * | RoundRectRadius        | N/A            | Not applicable to arc shapes.
 * | ContextTranslation     | none           | The test does not use ctx.translate().
 * | ContextRotation        | none           | The test does not use ctx.rotate().
 * | ContextScaling         | none           | The test does not use ctx.scale().
 * | Clipped on shape       | none           | The test does not apply any clipping.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - Fill color is fixed opaque blue (rgb(0, 0, 255)).
 * - Arc gap is always within a single quadrant.
 * - Uses calculateArcTestParams helper for position/size calculation.
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fOpaq-sNone-lytCenter-cenRand-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use opaque blue fill color (required for direct rendering)
        const fillColor = 'rgb(0, 0, 255)';

        // Calculate arc parameters
        const params = calculateArcTestParams({
            canvasWidth,
            canvasHeight,
            minRadius: 30,
            maxRadius: 80,
            hasStroke: false,
            randomPosition: false
        });

        const { centerX, centerY, radius, startAngle, endAngle, gapSizeDeg } = params;

        // Draw filled arc using direct shape API
        ctx.fillStyle = fillColor;
        ctx.fillArc(centerX, centerY, radius, startAngle, endAngle);

        // Return check data - use calculateFilledCircleBounds since arc > 270° covers all extremes
        return {
            logs: [`Arc at (${centerX}, ${centerY}) radius ${radius} gap ${gapSizeDeg.toFixed(1)}° color ${fillColor}`],
            checkData: calculateFilledCircleBounds(centerX, centerY, radius)
        };
    },
    'arcs',
    {
        extremes: { alphaThreshold: 62, skipOnIterations: [228, 488] },
        totalUniqueColors: 2, // background + fill
        // Direct rendering is expected - no allowPathBasedRendering flag
    },
    {
        title: 'Filled Arc - Opaque Color (Direct Rendering)',
        description: 'Tests fillArc with opaque color uses direct 32-bit writes'
    }
);

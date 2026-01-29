/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests fillArc with semi-transparent color rendering.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs           | The test draws an arc using ctx.fillArc().
 * | Count                  | single         | The test draws one arc instance.
 * | SizeCategory           | mixed          | Radius is randomized 30-80px, spanning S (16-39) and M (40-79) categories.
 * | FillStyle              | semitransparent| Fill color is 'rgba(0, 0, 255, 0.49)' with ~50% opacity.
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
 * - Fill color is fixed semi-transparent blue (rgba(0, 0, 255, 0.49)).
 * - Arc gap is always within a single quadrant.
 * - Uses calculateArcTestParameters helper for position/size calculation.
 * - May use path-based rendering for semi-transparent colors (allowPathBasedRendering: true).
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fSemi-sNone-lytCenter-cenRand-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use semi-transparent blue fill color
        const fillColor = 'rgba(0, 0, 255, 0.49)';

        // Calculate arc parameters
        const params = calculateArcTestParameters({
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

        // Return check data
        return {
            logs: [`Arc at (${centerX}, ${centerY}) radius ${radius} gap ${gapSizeDeg.toFixed(1)}° color ${fillColor}`],
            checkData: {
                topY: Math.floor(centerY - radius),
                bottomY: Math.floor(centerY + radius),
                leftX: Math.floor(centerX - radius),
                rightX: Math.floor(centerX + radius)
            }
        };
    },
    'arcs',
    {
        extremes: { alphaThreshold: 30, skipOnIterations: [115, 179, 189, 204, 339, 362, 395, 408, 445, 484, 511, 513, 542, 588, 595, 597, 635, 636, 702, 750, 811, 821] },
        totalUniqueColors: 2, // background + fill (blended)
        allowPathBasedRendering: true // Semi-transparent may use path-based rendering
    },
    {
        title: 'Filled Arc - Semi-transparent Color',
        description: 'Tests fillArc with semi-transparent color rendering'
    }
);

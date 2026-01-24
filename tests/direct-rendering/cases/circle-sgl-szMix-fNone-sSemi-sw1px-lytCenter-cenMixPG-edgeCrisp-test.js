/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests crisp rendering of a single 1px semi-transparent red stroked circle with no fill, centered on canvas with randomly chosen pixel or grid centering.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws a circle using ctx.strokeCircle().
 * | Count                  | single         | The test draws one circle instance.
 * | SizeCategory           | mixed          | Radius randomized in [30, 80], spanning S, M, L categories.
 * | FillStyle              | none           | No fill is applied.
 * | StrokeStyle            | semi-transparent | Stroke color is rgba(255, 0, 0, 0.5) with 50% alpha.
 * | StrokeThickness        | 1px            | lineWidth is set to 1.
 * | Layout                 | centered       | Circle is positioned at canvas center.
 * | CenteredAt             | mixed P/G      | Centering randomly chosen via calculateCircleTestParameters.
 * | EdgeAlignment          | crisp          | Uses calculateCircleTestParameters for proper crisp positioning.
 * | Orientation            | N/A            | Circles are rotationally symmetric.
 * | ArcAngleExtent         | N/A            | Not applicable to full circles.
 * | RoundRectRadius        | N/A            | Not applicable to circles.
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
 * - Stroke color is fixed semi-transparent red (rgba(255, 0, 0, 0.5)).
 * - Tests direct CircleOps.stroke1pxAlpha() rendering path.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-szMix-fNone-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use calculateCircleTestParameters for proper crisp positioning and size variation
        const params = calculateCircleTestParameters({
            canvasWidth,
            canvasHeight,
            minRadius: 30,
            maxRadius: 80,
            hasStroke: true,
            minStrokeWidth: 1,
            maxStrokeWidth: 1,
            randomPosition: false
        });

        const { centerX, centerY, radius, atPixel } = params;

        // Semi-transparent stroke color (uses direct rendering with alpha blending)
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 1;

        ctx.strokeCircle(centerX, centerY, radius);

        return {
            logs: [`Semi-transparent 1px stroked circle at (${centerX}, ${centerY}) radius ${radius}, atPixel=${atPixel}`],
            checkData: {
                topY: Math.floor(centerY - radius),
                bottomY: Math.floor(centerY + radius),
                leftX: Math.floor(centerX - radius),
                rightX: Math.floor(centerX + radius)
            }
        };
    },
    'circles',
    {
        extremes: { colorTolerance: 8, tolerance: 0.03 },
        totalUniqueColors: 2,  // White background + one blended color
        shapeIntegrity: true,
        stroke8Connectivity: { color: [255, 128, 128], tolerance: 10 }
    },
    {
        title: 'Single 1px Semi-Transparent Stroked Circle (Crisp, Mixed P/G Centering)',
        description: 'Tests crisp rendering of a single 1px semi-transparent red stroked circle with no fill.',
    }
);

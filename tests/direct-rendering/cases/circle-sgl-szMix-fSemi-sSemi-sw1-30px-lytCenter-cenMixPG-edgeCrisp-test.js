/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single random circle with random params, crisp center (grid or pixel), stroke, and fill.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles            | The test focuses on rendering a circle.
 * | Count                  | single             | The test draws a single circle instance in its visual verification mode.
 * | SizeCategory           | mixed              | The radius is randomized in a range of [10, 225), which spans multiple T-shirt size categories (S, M, L, XL).
 * | FillStyle              | semitransparent    | `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | semitransparent    | `getRandomColor('semitransparent')` is called for the stroke.
 * | StrokeThickness        | 1px-30px           | Stroke width is randomized within calculateCircleTestParameters, resulting in a range of 1-30px.
 * | Layout                 | centered           | The circle's center coordinates are explicitly calculated to be at the canvas center.
 * | CenteredAt             | mixed-pixel-grid   | A random flag (`atPixel`) determines if the center is on a pixel (`*.5`) or grid (`integer`) line.
 * | EdgeAlignment          | crisp              | The `adjustDimensionsForCrispStrokeRendering()` function is explicitly called to ensure sharp edges.
 * | Orientation            | N/A                | Not applicable to circles, which are rotationally symmetrical.
 * | ArcAngleExtent         | N/A                | Not applicable to circles.
 * | RoundRectRadius        | N/A                | Not applicable to circles.
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
 * - The fill and stroke colors are randomized semitransparent colors.
 * - Uses SWCanvas direct API method `ctx.fillStrokeCircle()` for unified fill+stroke rendering.
 * - The stroke width's dependency on the circle's radius is handled by calculateCircleTestParameters.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-szMix-fSemi-sSemi-sw1-30px-lytCenter-cenMixPG-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use calculateCircleTestParameters for proper setup
        const params = calculateCircleTestParameters({
            canvasWidth,
            canvasHeight,
            minRadius: 10,
            maxRadius: 225,
            hasStroke: true,
            minStrokeWidth: 1,
            maxStrokeWidth: 30,
            randomPosition: false,  // Centered, not randomly positioned
            marginX: 10,
            marginY: 10
        });

        const { centerX, centerY, radius, strokeWidth, finalDiameter, atPixel } = params;

        // Use standardized colors: blue fill, red stroke (50% semitransparent - original behavior)
        const strokeColor = 'rgba(255, 0, 0, 0.49)';
        const fillColor = 'rgba(0, 0, 255, 0.49)';

        // Draw filled and stroked circle using unified Direct API
        // Using fillStrokeCircle ensures no gaps between fill and stroke
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.fillStrokeCircle(centerX, centerY, radius);

        return {
            logs: [`Circle: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}, centerType=${atPixel ? 'pixel' : 'grid'}`],
            checkData: {
                effectiveRadius: radius + strokeWidth / 2,
                leftX: Math.floor(centerX - radius - strokeWidth / 2),
                rightX: Math.floor(centerX + radius + strokeWidth / 2 - 1),
                topY: Math.floor(centerY - radius - strokeWidth / 2),
                bottomY: Math.floor(centerY + radius + strokeWidth / 2 - 1)
            }
        };
    },
    'circles',
    {
        extremes: { colorTolerance: 8, tolerance: 0.03 },
        noGapsInStrokeEdges: true,
        totalUniqueColors: 4,
        speckles: true,
        shapeIntegrity: true
    },
    {
        title: 'Single Random Circle (Crisp, Random Center Type)',
        description: 'Tests a single random circle with random params, crisp center (grid or pixel), stroke, and fill.',
        displayName: 'Perf: Circle SingleRand Crisp RandCenterType'
    }
);

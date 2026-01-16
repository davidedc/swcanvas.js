/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single random arc with random params, crisp center (grid or pixel), thin stroke (1-3px), and fill.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs               | The test focuses on rendering an arc.
 * | Count                  | single             | The test draws a single arc instance in its visual verification mode.
 * | SizeCategory           | mixed              | The radius is randomized in a range of [10, 180), which spans multiple T-shirt size categories (S, M, L).
 * | FillStyle              | opaque             | `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | opaque             | `getRandomColor('semitransparent')` is called for the stroke.
 * | StrokeThickness        | 1px-3px            | Thin stroke width is randomized within calculateArcTestParameters, resulting in a range of 1-3px.
 * | Layout                 | centered           | The arc's center coordinates are explicitly calculated to be at the canvas center.
 * | CenteredAt             | mixed-pixel-grid   | A random flag (`atPixel`) determines if the center is on a pixel (`*.5`) or grid (`integer`) line.
 * | EdgeAlignment          | crisp              | The `adjustDimensionsForCrispStrokeRendering()` function is explicitly called to ensure sharp edges.
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
 * - The fill and stroke colors are randomized semitransparent colors.
 * - Uses SWCanvas direct API method `ctx.fillOuterStrokeArc()` for unified fill+stroke rendering.
 * - Gap positioned randomly within a single quadrant.
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fSemi-sSemi-sw1-3px-lytCenter-cenMixPG-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use calculateArcTestParameters for proper setup
        const params = calculateArcTestParameters({
            canvasWidth,
            canvasHeight,
            minRadius: 10,
            maxRadius: 180,
            hasStroke: true,
            minStrokeWidth: 1,
            maxStrokeWidth: 3,
            randomPosition: false,  // Centered, not randomly positioned
            marginX: 10,
            marginY: 10
        });

        const { centerX, centerY, radius, strokeWidth, finalDiameter, atPixel, startAngle, endAngle, gapSizeDeg } = params;

        // Semitransparent blue fill and red stroke (50% - original behavior)
        const fillColor = 'rgba(0, 0, 255, 0.49)';
        const strokeColor = 'rgba(255, 0, 0, 0.49)';

        // Draw filled and stroked arc using unified Direct API
        // Using fillOuterStrokeArc ensures no gaps between fill and stroke
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle);

        return {
            logs: [`Arc: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}, gap=${gapSizeDeg.toFixed(1)}°, centerType=${atPixel ? 'pixel' : 'grid'}`],
            checkData: {
                effectiveRadius: radius + strokeWidth / 2,
                leftX: Math.floor(centerX - radius - strokeWidth / 2),
                rightX: Math.floor(centerX + radius + strokeWidth / 2 - 1),
                topY: Math.floor(centerY - radius - strokeWidth / 2),
                bottomY: Math.floor(centerY + radius + strokeWidth / 2 - 1)
            }
        };
    },
    'arcs',
    {
        extremes: { colorTolerance: 65, tolerance: 0.03 }, // arcs drawing in HTML5 Canvas are a bit funny
        noGapsInStrokeEdges: true,
        totalUniqueColors: 4,
        speckles: { maxSpeckles: 4 },
        shapeIntegrity: true
    },
    {
        title: 'Single Thin Stroked Arc (Crisp, Random Center Type)',
        description: 'Tests a single random arc with random params, crisp center (grid or pixel), thin stroke (1-3px), and fill.',
        perfName: 'Perf: Arc Thin Crisp RandCenterType'
    }
);

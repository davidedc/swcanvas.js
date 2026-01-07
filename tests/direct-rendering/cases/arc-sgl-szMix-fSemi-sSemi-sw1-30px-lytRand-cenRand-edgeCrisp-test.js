/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single semi-transparent filled and stroked arc with random position.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs               | The test focuses on rendering an arc.
 * | Count                  | single             | The test draws a single arc instance in its visual verification mode.
 * | SizeCategory           | mixed              | The radius is randomized in a range of [10, 225), spanning multiple size categories.
 * | FillStyle              | semitransparent    | `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | semitransparent    | `getRandomColor('semitransparent')` is called for the stroke.
 * | StrokeThickness        | 1px-30px           | Stroke width is randomized within calculateArcTestParameters.
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
 * - Both fill and stroke colors are randomized semitransparent colors.
 * - Uses SWCanvas direct API method `ctx.fillOuterStrokeArc()` for unified fill+stroke rendering.
 * - Gap positioned randomly within a single quadrant.
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fSemi-sSemi-sw1-30px-lytRand-cenRand-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use calculateArcTestParameters for proper setup with random position
        const params = calculateArcTestParameters({
            canvasWidth,
            canvasHeight,
            minRadius: 10,
            maxRadius: 225,
            hasStroke: true,
            minStrokeWidth: 1,
            maxStrokeWidth: 30,
            randomPosition: true,  // Random position
            marginX: 60,
            marginY: 60
        });

        const { centerX, centerY, radius, strokeWidth, startAngle, endAngle, gapSizeDeg } = params;

        // Semi-transparent blue fill and red stroke
        const fillColor = 'rgba(0, 0, 255, 0.49)';
        const strokeColor = 'rgba(255, 0, 0, 0.49)';

        // Draw filled and stroked arc
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle);

        return {
            logs: [`Arc: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}, gap=${gapSizeDeg.toFixed(1)}°`],
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
        extremes: { colorTolerance: 65, tolerance: 0.03 },
        totalUniqueColors: 4,
        speckles: { maxSpeckles: 4 },
        allowPathBasedRendering: true  // Semi-transparent may use path-based rendering
    },
    {
        title: 'Single Semi-transparent Arc (Random Position)',
        description: 'Tests a single semi-transparent filled and stroked arc with random position.',
        displayName: 'Perf: Arc Semi Random Pos'
    }
);

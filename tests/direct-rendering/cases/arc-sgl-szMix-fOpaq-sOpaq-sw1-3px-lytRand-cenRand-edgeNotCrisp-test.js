/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single arc with fill and thin stroke (1-3px), random position, and non-crisp edges.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs               | The test focuses on rendering an arc.
 * | Count                  | single             | The test draws a single arc instance in its visual verification mode.
 * | SizeCategory           | mixed              | The radius is randomized in a range spanning multiple size categories.
 * | FillStyle              | opaque             | `getRandomOpaqueColor()` is called for the fill.
 * | StrokeStyle            | opaque             | `getRandomOpaqueColor()` is called for the stroke.
 * | StrokeThickness        | 1px-3px            | Thin stroke width is randomized within the 1-3px range.
 * | Layout                 | random             | The arc is positioned randomly within canvas bounds.
 * | CenteredAt             | random             | Center coordinates are random floating-point values.
 * | EdgeAlignment          | not-crisp          | No crisp alignment adjustments are applied.
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
 * - Both fill and stroke colors are randomized opaque colors.
 * - Uses SWCanvas direct API method `ctx.fillOuterStrokeArc()` for unified fill+stroke rendering.
 * - Gap positioned randomly within a single quadrant.
 * - Non-crisp edges test sub-pixel rendering accuracy.
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fOpaq-sOpaq-sw1-3px-lytRand-cenRand-edgeNotCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Random center (not crisp-aligned)
        const marginX = 80;
        const marginY = 80;
        const centerX = marginX + SeededRandom.getRandom() * (canvasWidth - 2 * marginX);
        const centerY = marginY + SeededRandom.getRandom() * (canvasHeight - 2 * marginY);

        // Random radius and thin stroke width (1-3px)
        const radius = 20 + SeededRandom.getRandom() * 60;
        const strokeWidth = 1 + SeededRandom.getRandom() * 2;

        // Generate arc angles with gap constrained to single quadrant
        const { startAngle, endAngle, gapSizeDeg } = generateConstrainedArcAngles();

        // Opaque blue fill and opaque red stroke
        const fillColor = 'rgb(0, 0, 255)';
        const strokeColor = 'rgb(255, 0, 0)';

        // Draw filled and stroked arc (no crisp adjustment)
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle);

        return {
            logs: [`Arc: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}, gap=${gapSizeDeg.toFixed(1)}°`],
            checkData: {
                effectiveRadius: radius + strokeWidth / 2,
                ...calculateStrokedCircleBounds(centerX, centerY, radius, strokeWidth)
            }
        };
    },
    'arcs',
    {
        speckles: { maxSpeckles: 5 },
        shapeIntegrity: true
    },
    {
        title: 'Single Thin Arc (Not Crisp, Random Position)',
        description: 'Tests a single arc with fill and thin stroke (1-3px), random position, and non-crisp edges.',
    }
);

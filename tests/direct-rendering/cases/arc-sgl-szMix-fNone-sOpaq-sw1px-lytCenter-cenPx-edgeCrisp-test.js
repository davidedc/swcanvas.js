/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests crisp rendering of a single 1px red stroked arc, centered at a pixel center.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs           | The test draws an arc shape.
 * | Count                  | single         | The test draws a single instance of the shape in its primary visual mode.
 * | SizeCategory           | mixed          | The radius is randomized in the range [10, 74.5], which spans XS, S, and M size categories.
 * | FillStyle              | none           | No fill is applied; only a stroke operation is performed.
 * | StrokeStyle            | opaque         | The stroke color is explicitly set to be fully opaque (rgb(255, 0, 0)).
 * | StrokeThickness        | 1px            | The stroke width is hardcoded to 1 pixel.
 * | Layout                 | centered       | The shape is positioned at the canvas center.
 * | CenteredAt             | pixel          | The center coordinates are *.5 values, aligning the center to a pixel center.
 * | EdgeAlignment          | crisp          | The test uses `adjustDimensionsForCrispStrokeRendering` to ensure sharp edges.
 * | Orientation            | N/A            | Arc orientation determined by angle parameters.
 * | ArcAngleExtent         | >270°          | Gap < 90° ensures all cardinal points included for extremes check.
 * | RoundRectRadius        | N/A            | This facet is only applicable to rounded rectangle shapes.
 * | ContextTranslation     | none           | The test does not use `ctx.translate()`.
 * | ContextRotation        | none           | The test does not use `ctx.rotate()`.
 * | ContextScaling         | none           | The test does not use `ctx.scale()`.
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
 * - The specific stroke color is a fixed opaque red (rgb(255, 0, 0)).
 * - Gap positioned randomly within a single quadrant.
 * - Uses outerStrokeArc() API for arc outline stroke.
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-cenPx-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Pixel-centered (*.5 coordinates)
        const centerX = Math.floor(canvasWidth / 2) + 0.5;
        const centerY = Math.floor(canvasHeight / 2) + 0.5;

        // Random base diameter (20-149px spans S, M, L sizes)
        const baseDiameter = Math.floor(20 + SeededRandom.getRandom() * 130);

        // Adjust diameter for crisp 1px stroke at pixel center
        const adjusted = adjustDimensionsForCrispStrokeRendering(
            baseDiameter, baseDiameter, 1, { x: centerX, y: centerY }
        );
        const finalDiameter = adjusted.width;
        const radius = finalDiameter / 2;

        // Generate arc angles with gap constrained to single quadrant
        const { startAngle, endAngle, gapSizeDeg } = generateConstrainedArcAngles();

        // Draw 1px stroked arc (no fill)
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 1;
        ctx.outerStrokeArc(centerX, centerY, radius, startAngle, endAngle);

        return {
            logs: [`Stroked arc: center=(${centerX},${centerY}), diameter=${finalDiameter}, radius=${radius}, gap=${gapSizeDeg.toFixed(1)}°`],
            checkData: {
                // Bounds formula for pixel-centered arc
                leftX: centerX - radius - 0.5,
                rightX: centerX + radius - 0.5,
                topY: centerY - radius - 0.5,
                bottomY: centerY + radius - 0.5
            }
        };
    },
    'arcs',
    {
        extremes: { colorTolerance: 77, tolerance: 0.03 }, // HTML5Canvas arc draw is pretty bad, so we need to be lenient
        totalUniqueColors: 2,
        shapeIntegrity: true
    },
    {
        title: 'Single 1px Stroked Arc (Crisp, Centered at Pixel)',
        description: 'Tests crisp rendering of a single 1px red stroked arc, centered at a pixel center.',
        displayName: 'Perf: Arc 1px Crisp Pixel Center'
    }
);

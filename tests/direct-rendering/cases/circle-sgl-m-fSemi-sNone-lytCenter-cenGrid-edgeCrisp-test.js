/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests fillCircle with semi-transparent color uses direct Bresenham + alpha blending.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws a circle using ctx.fillCircle().
 * | Count                  | single         | The test draws one circle instance.
 * | SizeCategory           | m              | Radius is fixed at 60px, which falls in M (40-79) category.
 * | FillStyle              | semitransparent| Fill color is 'rgba(0, 0, 255, 0.49)' with ~50% opacity.
 * | StrokeStyle            | none           | No stroke operation is performed.
 * | StrokeThickness        | N/A            | Not applicable as there is no stroke.
 * | Layout                 | centered       | The shape is positioned at the canvas center.
 * | CenteredAt             | grid           | Center is at canvasWidth/2, canvasHeight/2 (may be half-pixel on odd canvas sizes).
 * | EdgeAlignment          | crisp          | Center coordinates are simple division results.
 * | Orientation            | N/A            | Circles are rotationally symmetric.
 * | ArcAngleExtent         | N/A            | Not applicable to full circles.
 * | RoundRectRadius        | N/A            | Not applicable to circle shapes.
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
 * - Uses direct rendering with Bresenham algorithm + alpha blending.
 * - Hardcoded radius of 60px and center at canvas center.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-m-fSemi-sNone-lytCenter-cenGrid-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use SEMI-TRANSPARENT fill color (uses direct rendering with alpha blending)
        ctx.fillStyle = 'rgba(0, 0, 255, 0.49)';

        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const radius = 60;

        ctx.fillCircle(centerX, centerY, radius);

        return {
            logs: [`Semi-transparent circle at (${centerX}, ${centerY}) radius ${radius}`],
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
        extremes: { tolerance: 0.05 },
        totalUniqueColors: 2,  // Exactly 2 colors: white background + one blended red (no overdraw)
        // Semi-transparent colors now use direct rendering with Bresenham + alpha blending
    },
    {
        title: 'Filled Circle - Semi-Transparent (Direct Rendering)',
        description: 'Tests fillCircle with alpha uses direct Bresenham + alpha blending'
    }
);

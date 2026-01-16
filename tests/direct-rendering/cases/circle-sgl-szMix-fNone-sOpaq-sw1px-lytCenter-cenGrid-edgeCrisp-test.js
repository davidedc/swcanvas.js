/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests crisp rendering of a single 1px red stroked circle, centered at a grid crossing.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws a circle shape.
 * | Count                  | single         | The test draws a single instance of the shape in its primary visual mode.
 * | SizeCategory           | mixed          | The radius is randomized in the range [10, 74.5], which spans XS, S, and M size categories.
 * | FillStyle              | none           | No fill is applied; only a stroke operation is performed.
 * | StrokeStyle            | opaque         | The stroke color is explicitly set to be fully opaque (rgb(255, 0, 0)).
 * | StrokeThickness        | 1px            | The stroke width is hardcoded to 1 pixel.
 * | Layout                 | centered       | The shape is positioned at the canvas center.
 * | CenteredAt             | grid           | The center coordinates are integers (Math.floor), aligning the center to a grid intersection.
 * | EdgeAlignment          | crisp          | The test uses `adjustDimensionsForCrispStrokeRendering` to ensure sharp edges.
 * | Orientation            | N/A            | Circles are rotationally symmetric, so orientation is not an applicable facet.
 * | ArcAngleExtent         | N/A            | This facet is only applicable to arc shapes.
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
 * - Uses HTML5 Canvas path API (beginPath, arc, stroke) rather than direct shape API.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-cenGrid-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Grid-aligned center (integer coordinates)
        const centerX = Math.floor(canvasWidth / 2);
        const centerY = Math.floor(canvasHeight / 2);

        // Random base diameter (20-149px spans S, M, L sizes)
        const baseDiameter = Math.floor(20 + SeededRandom.getRandom() * 130);

        // Adjust diameter for crisp 1px stroke at grid center
        const adjusted = adjustDimensionsForCrispStrokeRendering(
            baseDiameter, baseDiameter, 1, { x: centerX, y: centerY }
        );
        const finalDiameter = adjusted.width;
        const radius = finalDiameter / 2;

        // Draw 1px stroked circle (no fill)
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 1;
        ctx.strokeCircle(centerX, centerY, radius);

        return {
            logs: [`Stroked circle: center=(${centerX},${centerY}), diameter=${finalDiameter}, radius=${radius}`],
            checkData: {
                // Bounds formula for grid-centered circle
                leftX: centerX - radius - 0.5,
                rightX: centerX + radius - 0.5,
                topY: centerY - radius - 0.5,
                bottomY: centerY + radius - 0.5
            }
        };
    },
    'circles',
    {
        extremes: { colorTolerance: 8, tolerance: 0.03 },
        totalUniqueColors: 2,
        shapeIntegrity: true,
        stroke8Connectivity: { color: [255, 0, 0] }
    },
    {
        title: 'Single 1px Stroked Circle (Crisp, Centered at Grid)',
        description: 'Tests crisp rendering of a single 1px red stroked circle, centered at a grid crossing.',
        perfName: 'Perf: Circle 1px Crisp Grid Center'
    }
);

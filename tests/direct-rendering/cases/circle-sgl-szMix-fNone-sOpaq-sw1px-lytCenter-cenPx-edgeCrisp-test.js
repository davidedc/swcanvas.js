/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests crisp rendering of a single 1px red stroked circle, centered at a pixel center.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws a circle shape.
 * | Count                  | single         | The test draws a single shape instance in its primary visual mode.
 * | SizeCategory           | mixed          | The radius is randomized in a range of ~[10, 74.5], spanning the 'S' and 'M' size categories.
 * | FillStyle              | none           | The shape is not filled; only stroke is performed.
 * | StrokeStyle            | opaque         | The stroke color is explicitly set with a full alpha value (rgb(255, 0, 0)).
 * | StrokeThickness        | 1px            | The lineWidth is explicitly set to 1.
 * | Layout                 | centered       | The shape is positioned at the calculated center of the canvas.
 * | CenteredAt             | pixel          | The center coordinates are calculated as `floor(dimension / 2) + 0.5` to align with pixel centers.
 * | EdgeAlignment          | crisp          | The test uses `adjustDimensionsForCrispStrokeRendering` to ensure the final shape edges are sharp.
 * | Orientation            | N/A            | Not applicable for circles, which are rotationally symmetrical.
 * | ArcAngleExtent         | N/A            | Not applicable; this facet is for 'arc' shapes only.
 * | RoundRectRadius        | N/A            | Not applicable; this facet is for 'rounded-rect' shapes only.
 * | ContextTranslation     | none           | `ctx.translate()` is not used.
 * | ContextRotation        | none           | `ctx.rotate()` is not used.
 * | ContextScaling         | none           | `ctx.scale()` is not used.
 * | Clipped on shape       | none           | `ctx.clip()` is not used.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The stroke color is a fixed, opaque red (rgb(255, 0, 0)).
 * - Uses HTML5 Canvas path API (beginPath, arc, stroke) rather than direct shape API.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-cenPx-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Pixel-aligned center (*.5 coordinates)
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

        // Draw 1px stroked circle (no fill)
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 1;
        ctx.strokeCircle(centerX, centerY, radius);

        return {
            logs: [`Stroked circle: center=(${centerX},${centerY}), diameter=${finalDiameter}, radius=${radius}`],
            checkData: {
                // Bounds formula for pixel-centered circle
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
        title: 'Single 1px Stroked Circle (Crisp, Centered at Pixel)',
        description: 'Tests crisp rendering of a single 1px red stroked circle, centered at a pixel center.',
    }
);

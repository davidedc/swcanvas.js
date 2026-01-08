/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests multiple fillCircle calls with opaque colors all use direct rendering.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws circles using ctx.fillCircle().
 * | Count                  | multi-5        | The test draws 5 circles (numCircles = 5).
 * | SizeCategory           | mixed          | Radius is randomized 20-60px, spanning S (16-39) and M (40-79) categories.
 * | FillStyle              | opaque         | All circles use getRandomOpaqueColor() for fully opaque fills.
 * | StrokeStyle            | none           | No stroke operations are performed.
 * | StrokeThickness        | N/A            | Not applicable as there is no stroke.
 * | Layout                 | spread         | Circles are spread randomly across the canvas.
 * | CenteredAt             | random         | Positions use SeededRandom.getRandom() for random coordinates.
 * | EdgeAlignment          | not-crisp      | Random float coordinates, not aligned to pixel grid.
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
 * - Uses getRandomOpaqueColor() for varied but always opaque fill colors.
 * - Circles may overlap due to random positioning.
 * - No totalUniqueColors check due to unpredictable overlaps.
 *
 */

registerDirectRenderingTest(
    'circle-m5-szMix-fOpaq-sNone-lytSpread-cenRand-edgeNotCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        const circles = [];
        const numCircles = 5;

        for (let i = 0; i < numCircles; i++) {
            // Use opaque fill color
            const fillColor = getRandomOpaqueColor();

            // Random position and size
            const radius = 20 + Math.floor(SeededRandom.getRandom() * 40);
            const centerX = radius + SeededRandom.getRandom() * (canvasWidth - radius * 2);
            const centerY = radius + SeededRandom.getRandom() * (canvasHeight - radius * 2);

            ctx.fillStyle = fillColor;
            ctx.fillCircle(centerX, centerY, radius);

            circles.push({ centerX, centerY, radius, fillColor });
        }

        return {
            logs: circles.map(c => `Circle at (${c.centerX.toFixed(1)}, ${c.centerY.toFixed(1)}) r=${c.radius}`)
        };
    },
    'circles',
    {
        // No totalUniqueColors check - random colors and overlaps make exact count unpredictable
        // Direct rendering expected for all circles
    },
    {
        title: 'Multiple Filled Circles - Opaque Colors (Direct Rendering)',
        description: 'Tests multiple fillCircle calls use direct rendering'
    }
);

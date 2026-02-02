/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of 12 filled arcs (no stroke) with random positions and opaque colors.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs           | The test draws arcs using `ctx.fillArc()`.
 * | Count                  | multiple (12)  | The test draws 12 arc instances using a loop.
 * | SizeCategory           | mixed          | The radius is randomized in the range [8, 42], spanning multiple size categories.
 * | FillStyle              | opaque         | `getRandomOpaqueColor()` is called for the fill.
 * | StrokeStyle            | none           | No stroke is applied.
 * | StrokeThickness        | N/A            | Not applicable as there is no stroke.
 * | Layout                 | spread         | Arcs are positioned randomly across the canvas with 60px margins.
 * | CenteredAt             | random         | The final center coordinates are randomized via calculateArcTestParams.
 * | EdgeAlignment          | crisp          | calculateArcTestParams ensures proper pixel alignment.
 * | Orientation            | N/A            | Arc orientation determined by angle parameters.
 * | ArcAngleExtent         | >270°          | Gap < 90° ensures all cardinal points included for extremes check.
 * | RoundRectRadius        | N/A            | Not applicable to arcs.
 * | ContextTranslation     | none           | The test does not use `ctx.translate()`.
 * | ContextRotation        | none           | The test does not use `ctx.rotate()`.
 * | ContextScaling         | none           | The test does not use `ctx.scale()`.
 * | Clipped on shape       | none           | The test does not use clipping.
 * | Clipped on shape count | n/a            | No clipping is used.
 * | Clipped on shape arrangement| n/a       | No clipping is used.
 * | Clipped on shape size  | n/a            | No clipping is used.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - Uses SWCanvas direct API method `ctx.fillArc()` for fill-only rendering.
 * - Each arc is drawn with independently randomized parameters.
 * - Gap positioned randomly within a single quadrant for each arc.
 * - 60px margin from canvas edges for arc positioning.
 *
 */

registerDirectRenderingTest(
    'arc-m12-szMix-fOpaq-sNone-lytSpread-cenRand-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const numToDraw = 12;
        const logs = [];

        for (let i = 0; i < numToDraw; i++) {
            // Use calculateArcTestParams for each arc
            const params = calculateArcTestParams({
                canvasWidth,
                canvasHeight,
                minRadius: 8,
                maxRadius: 42,
                hasStroke: false,
                randomPosition: true,
                marginX: 60,
                marginY: 60
            });

            const { centerX, centerY, radius, startAngle, endAngle, gapSizeDeg } = params;

            // Get random opaque color
            const fillColor = getRandomOpaqueColor();

            // Draw filled arc (no stroke)
            ctx.fillStyle = fillColor;
            ctx.fillArc(centerX, centerY, radius, startAngle, endAngle);

            logs.push(`Arc ${i + 1}: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, gap=${gapSizeDeg.toFixed(1)}°`);
        }

        return { logs };
    },
    'arcs',
    {
        // Visual comparison only
    },
    {
        title: 'Multiple Filled Arcs (No Stroke, Random Positions)',
        description: 'Tests rendering of 12 filled arcs (no stroke) with random positions and opaque colors.'
    }
);

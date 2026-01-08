/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of 12 circles with no strokes, only fills, precise alignment, and random parameters/positions.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws circles using `ctx.fillCircle()`.
 * | Count                  | multiple (12)  | The test draws 12 circle instances using a loop.
 * | SizeCategory           | mixed          | The radius is randomized in the range [8, 42], spanning multiple size categories.
 * | FillStyle              | mixed          | `getRandomColor('mixed')` is called for the fill (opaque or semitransparent).
 * | StrokeStyle            | none           | No stroke operations are performed.
 * | StrokeThickness        | none           | Consistent with `StrokeStyle: none`.
 * | Layout                 | spread         | Circles are positioned randomly across the canvas with 60px margins.
 * | CenteredAt             | random         | The final center coordinates are randomized via calculateCircleTestParameters.
 * | EdgeAlignment          | crisp          | calculateCircleTestParameters ensures proper pixel alignment.
 * | Orientation            | N/A            | Not applicable to circles, which are rotationally symmetrical.
 * | ArcAngleExtent         | N/A            | Not applicable to circles.
 * | RoundRectRadius        | N/A            | Not applicable to circles.
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
 * - Uses SWCanvas direct API method `ctx.fillCircle()` for direct rendering.
 * - Each circle is drawn with independently randomized parameters.
 * - 60px margin from canvas edges for circle positioning.
 *
 */

registerDirectRenderingTest(
    'circle-m12-szMix-fMix-sNone-lytSpread-cenRand-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const numToDraw = 12;
        const logs = [];

        for (let i = 0; i < numToDraw; i++) {
            // Use calculateCircleTestParameters for each circle
            const params = calculateCircleTestParameters({
                canvasWidth,
                canvasHeight,
                minRadius: 8,
                maxRadius: 42,
                hasStroke: false,  // No stroke
                randomPosition: true,
                marginX: 60,
                marginY: 60
            });

            const { centerX, centerY, radius, finalDiameter, atPixel } = params;

            // Get random fill color (mixed - opaque or semitransparent)
            const fillColor = getRandomColor('mixed');

            // Draw filled circle (no stroke) using Direct API for direct rendering
            ctx.fillStyle = fillColor;
            ctx.fillCircle(centerX, centerY, radius);

            logs.push(`Circle ${i + 1}: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}`);
        }

        return { logs };
    },
    'circles',
    {
        // Visual comparison only - no specific checks
    },
    {
        title: 'Multiple Precise Fill-Only Circles (Random Params & Pos)',
        description: 'Tests rendering of 12 circles with no strokes, only fills, precise alignment, and random parameters/positions.'
    }
);

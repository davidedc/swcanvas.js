/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of 12 arcs with precise pixel alignment, varied strokes and fills, and random positions.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs           | The test draws arcs using `ctx.fillOuterStrokeArc()`.
 * | Count                  | multiple (12)  | The test draws 12 arc instances using a loop.
 * | SizeCategory           | mixed          | The radius is randomized in the range [8, 42], spanning multiple size categories.
 * | FillStyle              | semitransparent| `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | mixed          | `getRandomColor('mixed')` is called for the stroke.
 * | StrokeThickness        | 1px-4px        | `strokeWidth` is randomized between 1 and 4 via calculateArcTestParams.
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
 * - Uses SWCanvas direct API method `ctx.fillOuterStrokeArc()` for combined fill+stroke.
 * - Each arc is drawn with independently randomized parameters.
 * - Gap positioned randomly within a single quadrant for each arc.
 * - 60px margin from canvas edges for arc positioning.
 *
 */

registerDirectRenderingTest(
    'arc-m12-szMix-fSemi-sMix-sw1-4px-lytSpread-cenRand-edgeCrisp-test',
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
                hasStroke: true,
                minStrokeWidth: 1,
                maxStrokeWidth: 4,
                randomPosition: true,
                marginX: 60,
                marginY: 60
            });

            const { centerX, centerY, radius, strokeWidth, startAngle, endAngle, gapSizeDeg } = params;

            // Get random colors (mixed for stroke, semitransparent for fill)
            const strokeColor = getRandomColor('mixed');
            const fillColor = getRandomColor('semitransparent');

            // Draw filled and stroked arc using Direct API
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle);

            logs.push(`Arc ${i + 1}: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}, gap=${gapSizeDeg.toFixed(1)}°`);
        }

        return { logs };
    },
    'arcs',
    {
        // Visual comparison only - all stroke widths use direct rendering
    },
    {
        title: 'Multiple Precise Random Arcs (Stroked & Filled)',
        description: 'Tests rendering of 12 arcs with precise pixel alignment, varied strokes and fills, and random positions.'
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of 12 circles with precise pixel alignment, varied strokes and fills, and random positions. Each circle has randomized radius, position, stroke color/thickness, and fill color.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws circles using `ctx.fillStrokeCircle()`.
 * | Count                  | multiple (12)  | The test draws 12 circle instances using a loop.
 * | SizeCategory           | mixed          | The radius is randomized in the range [8, 42], spanning multiple size categories.
 * | FillStyle              | semitransparent| `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | mixed          | `getRandomColor('mixed')` is called for the stroke.
 * | StrokeThickness        | 1px-4px        | `strokeWidth` is randomized between 1 and 4 via calculateCircleTestParams.
 * | Layout                 | spread         | Circles are positioned randomly across the canvas with 60px margins.
 * | CenteredAt             | random         | The final center coordinates are randomized via calculateCircleTestParams.
 * | EdgeAlignment          | crisp          | calculateCircleTestParams ensures proper pixel alignment.
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
 * - Uses SWCanvas direct API method `ctx.fillStrokeCircle()` for combined fill+stroke.
 * - Each circle is drawn with independently randomized parameters.
 * - 60px margin from canvas edges for circle positioning.
 *
 */

registerDirectRenderingTest(
    'circle-m12-szMix-fSemi-sMix-sw1-4px-lytSpread-cenRand-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const numToDraw = 12;
        const logs = [];

        for (let i = 0; i < numToDraw; i++) {
            // Use calculateCircleTestParams for each circle
            const params = calculateCircleTestParams({
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

            const { centerX, centerY, radius, strokeWidth, finalDiameter, atPixel } = params;

            // Get random colors (mixed for stroke, semitransparent for fill)
            const strokeColor = getRandomColor('mixed');
            const fillColor = getRandomColor('semitransparent');

            // Draw filled and stroked circle using Direct API
            // Note: strokeCircle direct rendering supports all stroke widths
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.fillStrokeCircle(centerX, centerY, radius);

            logs.push(`Circle ${i + 1}: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}`);
        }

        return { logs };
    },
    'circles',
    {
        // Visual comparison only - all stroke widths use direct rendering
    },
    {
        title: 'Multiple Precise Random Circles (Stroked & Filled)',
        description: 'Tests rendering of 12 circles with precise pixel alignment, varied strokes and fills, and random positions.'
    }
);

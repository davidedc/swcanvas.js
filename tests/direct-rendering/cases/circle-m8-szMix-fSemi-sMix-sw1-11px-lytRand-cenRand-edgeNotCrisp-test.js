/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests 8 circles with all parameters fully randomized. No crisp alignment - uses floating-point random values for position, radius, and stroke.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws circles using `ctx.fillStrokeCircle()`.
 * | Count                  | multiple (8)   | The test draws 8 circle instances using a loop.
 * | SizeCategory           | mixed          | The radius is randomized in the range [15, 65], spanning multiple size categories.
 * | FillStyle              | semitransparent| `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | mixed          | `getRandomColor('mixed')` is called for the stroke.
 * | StrokeThickness        | 1px-11px       | `strokeWidth` is randomized as `SeededRandom.getRandom() * 10 + 1`.
 * | Layout                 | random         | Circles use `getRandomPoint()` for fully random placement with 1px margin.
 * | CenteredAt             | random         | The final center coordinates are fully randomized floating-point values.
 * | EdgeAlignment          | notCrisp       | No adjustDimensionsForCrispStrokeRendering() call; uses raw floating-point values.
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
 * - All parameters use floating-point random values without crisp alignment.
 * - Tests anti-aliased rendering with non-integer coordinates.
 *
 */

registerDirectRenderingTest(
    'circle-m8-szMix-fSemi-sMix-sw1-11px-lytRand-cenRand-edgeNotCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const numToDraw = 8;
        const logs = [];

        for (let i = 0; i < numToDraw; i++) {
            // Get random center point (no alignment)
            const center = getRandomPoint(1, canvasWidth, canvasHeight);

            // Random radius (15-65px)
            const radius = 15 + SeededRandom.getRandom() * 50;

            // Random stroke width (1-11px)
            const strokeWidth = SeededRandom.getRandom() * 10 + 1;

            // Get random colors (mixed for stroke, semitransparent for fill)
            const strokeColor = getRandomColor('mixed');
            const fillColor = getRandomColor('semitransparent');

            // Draw filled and stroked circle using Direct API
            // Note: strokeCircle direct rendering supports all stroke widths
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.fillStrokeCircle(center.x, center.y, radius);

            logs.push(`Circle ${i + 1}: center=(${center.x.toFixed(1)},${center.y.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}`);
        }

        return { logs };
    },
    'circles',
    {
        // Visual comparison only - all stroke widths use direct rendering
    },
    {
        title: 'Circle: 8 fully random',
        description: 'Performance of 8 fully random circles.'
    }
);

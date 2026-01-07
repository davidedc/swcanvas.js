/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single circle with all parameters fully randomized. No crisp alignment - uses floating-point random values for position, radius, and stroke.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws a circle using `ctx.fillStrokeCircle()`.
 * | Count                  | single         | The test draws a single circle instance.
 * | SizeCategory           | mixed          | The radius is randomized in the range [15, 65], spanning multiple size categories.
 * | FillStyle              | semitransparent| `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | semitransparent| `getRandomColor('semitransparent')` is called for the stroke.
 * | StrokeThickness        | 1px-11px       | `strokeWidth` is randomized as `SeededRandom.getRandom() * 10 + 1`.
 * | Layout                 | random         | Circle uses `getRandomPoint()` for fully random placement with 1px margin.
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
    'circle-sgl-szMix-fOpaq-sOpaq-sw1-10px-lytRand-cenRand-edgeNotCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const logs = [];

        // Get random center point (no alignment)
        const center = getRandomPoint(1, canvasWidth, canvasHeight);

        // Random radius (15-65px)
        const radius = 15 + SeededRandom.getRandom() * 50;

        // Random stroke width (1-11px)
        const strokeWidth = SeededRandom.getRandom() * 10 + 1;

        // Use standardized colors: blue fill, red stroke (50% semitransparent - original behavior)
        const strokeColor = 'rgba(255, 0, 0, 0.49)';
        const fillColor = 'rgba(0, 0, 255, 0.49)';

        // Draw filled and stroked circle using Direct API
        // Note: strokeCircle direct rendering supports all stroke widths
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.fillStrokeCircle(center.x, center.y, radius);

        logs.push(`FullyRandom Circle: center=(${center.x.toFixed(1)},${center.y.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}`);

        return { logs };
    },
    'circles',
    {
        totalUniqueColors: 4,
        noGapsInStrokeEdges: true,
        strokePatternContinuity: true
    },
    {
        title: 'Circle: fully random',
        description: 'Performance of a single fully random circle.'
    }
);

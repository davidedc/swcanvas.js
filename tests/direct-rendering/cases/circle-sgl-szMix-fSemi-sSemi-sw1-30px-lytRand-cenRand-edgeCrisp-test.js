/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single circle with fully randomized parameters for position, size, fill, and stroke. The final rendering is adjusted to ensure the circle's edges are crisp (pixel-aligned).
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws circles using `ctx.fillStrokeCircle()`.
 * | Count                  | single         | The test is designed to draw a single circle instance in its primary visual test mode.
 * | SizeCategory           | mixed          | The `baseRadius` is randomized in a range of [10, 224], spanning multiple size categories (XS-XL).
 * | FillStyle              | semitransparent | `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle            | semitransparent | `getRandomColor('semitransparent')` is called for the stroke.
 * | StrokeThickness        | 1px-30px       | `strokeWidth` is randomized between a minimum of 1 and a maximum of 30.
 * | Layout                 | random         | The circle's final `(centerX, centerY)` is randomized within the canvas boundaries.
 * | CenteredAt             | random         | The final center coordinates are determined by the random layout and are not snapped to a grid or pixel.
 * | EdgeAlignment          | crisp          | The code calls `adjustDimensionsForCrispStrokeRendering()` to ensure sharp edges.
 * | Orientation            | N/A            | Circles are rotationally symmetrical, so this facet is not applicable.
 * | ArcAngleExtent         | N/A            | This facet is not applicable to circles.
 * | RoundRectRadius        | N/A            | This facet is not applicable to circles.
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
 * - The `strokeWidth` is randomized from 1px up to a maximum of 30px, but it's also capped by the `baseRadius` of the circle.
 * - The final position is randomized within the canvas boundaries while respecting a 10px margin.
 * - Uses SWCanvas direct API method `ctx.fillStrokeCircle()` for unified fill+stroke rendering.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-szMix-fSemi-sSemi-sw1-30px-lytRand-cenRand-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use calculateCircleTestParameters with random positioning
        const params = calculateCircleTestParameters({
            canvasWidth,
            canvasHeight,
            minRadius: 10,
            maxRadius: 225,
            hasStroke: true,
            minStrokeWidth: 1,
            maxStrokeWidth: 30,
            randomPosition: true,  // Enable random positioning
            marginX: 10,
            marginY: 10
        });

        const { centerX, centerY, radius, strokeWidth, finalDiameter, atPixel } = params;

        // Use standardized colors: semi-transparent blue fill and red stroke
        const strokeColor = 'rgba(255, 0, 0, 0.49)';
        const fillColor = 'rgba(0, 0, 255, 0.49)';

        // Draw filled and stroked circle using unified Direct API
        // Using fillStrokeCircle ensures no gaps between fill and stroke
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.fillStrokeCircle(centerX, centerY, radius);

        return {
            logs: [`RandPos Circle: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth.toFixed(1)}`],
            checkData: {
                effectiveRadius: radius + strokeWidth / 2,
                leftX: Math.floor(centerX - radius - strokeWidth / 2),
                rightX: Math.floor(centerX + radius + strokeWidth / 2 - 1),
                topY: Math.floor(centerY - radius - strokeWidth / 2),
                bottomY: Math.floor(centerY + radius + strokeWidth / 2 - 1)
            }
        };
    },
    'circles',
    {
        extremes: { colorTolerance: 8, tolerance: 0.03 },
        noGapsInStrokeEdges: true,
        totalUniqueColors: 4,
        speckles: true,
        shapeIntegrity: true
    },
    {
        title: 'Single Randomly Positioned Circle with Stroke (Crisp)',
        description: 'Tests a single randomly positioned circle with random params, crisp stroke/fill.',
        perfName: 'Perf: Circle RandPos Crisp'
    }
);

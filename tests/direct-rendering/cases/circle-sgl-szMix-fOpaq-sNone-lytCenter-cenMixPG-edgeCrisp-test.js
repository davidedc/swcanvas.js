/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of a single circle with no stroke, only fill. The circle has randomized parameters for its radius and fill color. Its position is centered on the canvas, with the center's alignment randomly chosen to be either on the pixel grid (integer coordinates) or on the pixel center (*.5 coordinates) to test crisp rendering in both scenarios.
 *
 *
 * ---
 *
 * | Facet                        | Value              | Reason
 * |------------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category               | circles            | The test draws a circle using `ctx.fillCircle`.
 * | Count                        | single             | The test logic is designed to draw a single shape instance in its visual test mode.
 * | SizeCategory                 | mixed              | The radius is randomized in the range [10, 225), which spans multiple size categories (S, M, L, XL).
 * | FillStyle                    | semitransparent    | `getRandomColor('semitransparent')` is called for the fill.
 * | StrokeStyle                  | none               | The code explicitly sets `hasStroke = false`, and no stroke operation is performed.
 * | StrokeThickness              | none               | Follows from `StrokeStyle` being `none`.
 * | Layout                       | centered           | The circle's center is calculated relative to the canvas center, not at a random spread position.
 * | CenteredAt                   | mixed-pixel-grid   | The center is randomly chosen to be either on the pixel grid (e.g., (10, 20)) or on a pixel center (e.g., (10.5, 20.5)).
 * | EdgeAlignment                | crisp              | The code calls `adjustDimensionsForCrispStrokeRendering()` to ensure edges align with pixel boundaries.
 * | Orientation                  | N/A                | Not applicable to circles.
 * | ArcAngleExtent               | N/A                | Not applicable to circles.
 * | RoundRectRadius              | N/A                | Not applicable to rounded rectangles.
 * | ContextTranslation           | none               | The code does not call `ctx.translate()`.
 * | ContextRotation              | none               | The code does not call `ctx.rotate()`.
 * | ContextScaling               | none               | The code does not call `ctx.scale()`.
 * | Clipped on shape             | none               | The code does not call `ctx.clip()`.
 * | Clipped on shape count       | n/a                | No clipping is applied.
 * | Clipped on shape arrangement | n/a                | No clipping is applied.
 * | Clipped on shape size        | n/a                | No clipping is applied.
 * | Clipped on shape edge alignment | n/a             | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The specific randomization range for the radius is [10, 225).
 * - The fill color is randomized semitransparent.
 * - Uses SWCanvas direct API method `ctx.fillCircle()`.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-szMix-fOpaq-sNone-lytCenter-cenMixPG-edgeCrisp-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use calculateCircleTestParameters for proper setup
        const params = calculateCircleTestParameters({
            canvasWidth,
            canvasHeight,
            minRadius: 10,
            maxRadius: 225,
            hasStroke: false,  // No stroke
            randomPosition: false  // Centered, not randomly positioned
        });

        const { centerX, centerY, radius, finalDiameter, atPixel } = params;

        // Use standardized color: semitransparent blue fill (50% - original behavior)
        const fillColor = 'rgba(0, 0, 255, 0.49)';

        // Draw filled circle (no stroke) using Direct API for direct rendering
        ctx.fillStyle = fillColor;
        ctx.fillCircle(centerX, centerY, radius);

        return {
            logs: [`Circle (no stroke): center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, centerType=${atPixel ? 'pixel' : 'grid'}`],
            checkData: {
                leftX: Math.floor(centerX - radius),
                rightX: Math.floor(centerX + radius - 1),
                topY: Math.floor(centerY - radius),
                bottomY: Math.floor(centerY + radius - 1)
            }
        };
    },
    'circles',
    {
        extremes: { colorTolerance: 8, tolerance: 0.03 },
        noGapsInFillEdges: true,
        totalUniqueColors: 2,
        speckles: true
    },
    {
        title: 'Single Circle Without Stroke (Crisp, Random Center Type)',
        description: 'Tests rendering of a single circle with no stroke, only fill, random params, and crisp center (grid or pixel).',
        displayName: 'Perf: Circle NoStroke Crisp RandCenterType'
    }
);

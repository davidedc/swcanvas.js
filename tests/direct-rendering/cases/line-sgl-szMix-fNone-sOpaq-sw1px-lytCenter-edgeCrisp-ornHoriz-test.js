/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests crisp rendering of horizontal 1px line positioned between pixels.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | lines          | The test draws a line using ctx.strokeLine().
 * | Count                  | single         | The test draws one line instance.
 * | SizeCategory           | mixed          | Line length is randomized 20-149px, spanning S (16-39), M (40-79), and L (80-159) categories.
 * | FillStyle              | none           | Lines have no fill operation.
 * | StrokeStyle            | opaque         | Stroke color is 'rgb(255, 0, 0)' with full opacity.
 * | StrokeThickness        | 1px            | Line width is set to 1 pixel.
 * | Layout                 | centered       | The line is positioned at the vertical center of the canvas.
 * | CenteredAt             | N/A            | Lines use pixel-aligned positioning (+0.5 offset).
 * | EdgeAlignment          | crisp          | Uses +0.5 offset technique to ensure crisp 1px rendering.
 * | Orientation            | horizontal     | Line is drawn horizontally from left to right (or vice versa).
 * | ArcAngleExtent         | N/A            | Not applicable to line shapes.
 * | RoundRectRadius        | N/A            | Not applicable to line shapes.
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
 * - Stroke color is fixed opaque red (rgb(255, 0, 0)).
 * - Uses +0.5 pixel offset for crisp horizontal line rendering.
 * - Start/end points may be randomly swapped to test both drawing directions.
 *
 */

registerDirectRenderingTest(
    'line-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-edgeCrisp-ornHoriz',
    function drawTest(ctx, iterationNumber, instances) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Use positioning utility for consistent bounds calculation (single source of truth)
        const params = calculateLineTestParams({
            canvasWidth: width,
            canvasHeight: height,
            strokeWidth: 1,
            orientation: 'horizontal',
            minLength: 20,
            maxLength: 149
        });

        // Draw 1px opaque red horizontal line
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 1;
        ctx.strokeLine(params.x1, params.y1, params.x2, params.y2);

        return {
            logs: [`1px Red line from (${params.x1}, ${params.y1}) to (${params.x2}, ${params.y2}), length=${params.lineLength}px`],
            checkData: params.checkData
        };
    },
    'lines',
    {
        extremes: true,  // Exact match required for crisp pixel-positioned test
        // Direct rendering expected for 1px opaque line
    },
    {
        title: 'Lines: M-Size No-Fill 1px-Opaque-Stroke Crisp-Pixel-Pos Horizontal',
        description: 'Tests crisp rendering of horizontal 1px line centered between pixels'
    }
);

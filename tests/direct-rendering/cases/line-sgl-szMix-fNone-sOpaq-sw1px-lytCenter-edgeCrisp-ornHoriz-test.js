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

        // Crisp positioning: center Y between pixels (+ 0.5)
        // This ensures the 1px stroke fills exactly one pixel row
        const centerY = Math.floor(height / 2) + 0.5;

        // Random line length (spans S, M, L sizes: 20-149px)
        const lineLength = Math.floor(20 + SeededRandom.getRandom() * 130);
        const centerX = Math.floor(width / 2);
        const startX = Math.floor(centerX - lineLength / 2);
        const endX = startX + lineLength;

        // Randomly swap start/end for variety (tests both directions)
        let x1 = startX, x2 = endX;
        if (SeededRandom.getRandom() < 0.5) {
            [x1, x2] = [x2, x1];
        }

        // Draw 1px opaque red horizontal line
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 1;
        ctx.strokeLine(x1, centerY, x2, centerY);

        // For crisp horizontal lines, the stroke should occupy exactly one pixel row
        const pixelY = Math.floor(centerY);
        return {
            logs: [`1px Red line from (${x1}, ${centerY}) to (${x2}, ${centerY}), length=${lineLength}px`],
            checkData: {
                topY: pixelY,
                bottomY: pixelY,
                leftX: Math.min(x1, x2),
                rightX: Math.max(x1, x2) - 1  // Inclusive right bound
            }
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

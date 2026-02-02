/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests the crisp rendering of a single horizontal 2px line. The line has a fixed opaque red stroke, no fill, and is centered on the canvas at an integer Y-coordinate (grid line). Its length is randomized, spanning multiple t-shirt size categories (S, M, L).
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | line           | The test draws line primitives using `strokeLine` or `moveTo/lineTo`.
 * | Count                  | single         | The test's primary mode draws one instance per run.
 * | SizeCategory           | mixed          | The code `Math.floor(20 + SeededRandom.getRandom() * 130)` generates a length of [20, 149], which spans the S, M, and L size categories.
 * | FillStyle              | none           | `fillStyle` is explicitly set to transparent and no fill operation is performed.
 * | StrokeStyle            | opaque         | `strokeStyle` is set to `'rgb(255, 0, 0)'`, which is a fully opaque color.
 * | StrokeThickness        | 2px            | `lineWidth` is hardcoded to `2`.
 * | Layout                 | centered       | The line's start and end points are calculated relative to the canvas center.
 * | EdgeAlignment          | crisp          | The combination of a horizontal orientation, an even `lineWidth` (2px), and an integer Y-coordinate for the center ensures the stroke perfectly covers two pixel rows without anti-aliasing.
 * | Orientation            | horizontal     | The line is drawn with a constant Y-coordinate for both its start and end points.
 */

registerDirectRenderingTest(
    'line-sgl-szMix-fNone-sOpaq-sw2px-lytCenter-edgeCrisp-ornHoriz',
    function drawTest(ctx, iterationNumber, instances) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Use positioning utility for consistent bounds calculation (single source of truth)
        const params = calculateLineTestParams({
            canvasWidth: width,
            canvasHeight: height,
            strokeWidth: 2,
            orientation: 'horizontal',
            minLength: 20,
            maxLength: 149
        });

        // Draw 2px opaque red horizontal line
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 2;
        ctx.strokeLine(params.x1, params.y1, params.x2, params.y2);

        return {
            logs: [`2px Red line from (${params.x1}, ${params.y1}) to (${params.x2}, ${params.y2}), length=${params.lineLength}px`],
            checkData: params.checkData
        };
    },
    'lines',
    {
        extremes: { tolerance: 0.01 }  // Small tolerance for 2px line bounds
    },
    {
        title: 'Lines: M-Size No-Fill 2px-Opaque-Stroke Centered-At-Grid Horizontal',
        description: 'Tests crisp rendering of a horizontal 2px line centered at grid crossing using canvas code.',
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests the crisp rendering of a single, vertical 1px opaque red line. The line is centered on the canvas, and its length is randomized across S, M, and L size categories. Its horizontal position is set between pixels to test for correct pixel snapping.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | lines          | The test draws line primitives.
 * | Count                  | single         | The test draws a single line instance in its primary visual mode.
 * | SizeCategory           | mixed          | The line's length is randomized in the range `[20, 149]`, which spans the S `(16-39px)`, M `(40-79px)`, and L `(80-159px)` size categories.
 * | FillStyle              | none           | No fill is applied to the line; `ctx.fillStyle` is set to be fully transparent.
 * | StrokeStyle            | opaque         | The line is stroked with an opaque color (`rgb(255, 0, 0)`), which has an alpha of 1.0.
 * | StrokeThickness        | 1px            | `ctx.lineWidth` is explicitly set to `1`.
 * | Layout                 | centered       | The line's geometric center is positioned at the center of the canvas.
 * | CenteredAt             | N/A            | This facet is not applicable to lines, as their position is defined by endpoints, not a center point in the same way as circles or rectangles.
 * | EdgeAlignment          | crisp          | The line is vertical and its `x` coordinate is set to a `.5` value (`Math.floor(width / 2) + 0.5`), a key technique for ensuring a 1px vertical line renders crisply on a single column of pixels.
 * | Orientation            | vertical       | The line is drawn with identical start and end `x` coordinates.
 * | ArcAngleExtent         | N/A            | Not applicable to lines.
 * | RoundRectRadius        | N/A            | Not applicable to lines.
 * | ContextTranslation     | none           | The code does not use `ctx.translate()`.
 * | ContextRotation        | none           | The code does not use `ctx.rotate()`.
 * | ContextScaling         | none           | The code does not use `ctx.scale()`.
 * | Clipped on shape       | none           | The code does not use `ctx.clip()`.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * The stroke color is hardcoded to be opaque red (`rgb(255, 0, 0)`), which is more specific than the `sOpaq` facet value implies.
 *
 */

registerDirectRenderingTest(
    'line-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-edgeCrisp-ornVert',
    function drawTest(ctx, iterationNumber, instances) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Use positioning utility for consistent bounds calculation (single source of truth)
        const params = calculateLineTestParams({
            canvasWidth: width,
            canvasHeight: height,
            strokeWidth: 1,
            orientation: 'vertical',
            minLength: 20,
            maxLength: 149
        });

        // Draw 1px opaque red vertical line
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 1;
        ctx.strokeLine(params.x1, params.y1, params.x2, params.y2);

        return {
            logs: [`1px Red vertical line from (${params.x1}, ${params.y1}) to (${params.x2}, ${params.y2}), length=${params.lineLength}px`],
            checkData: params.checkData
        };
    },
    'lines',
    {
        extremes: true
    },
    {
        title: 'Lines: M-Size No-Fill 1px-Opaque-Stroke Crisp-Pixel-Pos Vertical',
        description: 'Tests crisp rendering of a vertical 1px line centered between pixels.',
    }
);

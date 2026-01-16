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

        // Crisp positioning: center X between pixels (+ 0.5)
        // This ensures the 1px stroke fills exactly one pixel column
        const centerX = Math.floor(width / 2) + 0.5;

        // Random line length (spans S, M, L sizes: 20-149px)
        const lineLength = Math.floor(20 + SeededRandom.getRandom() * 130);
        const centerY = Math.floor(height / 2);
        const startY = Math.floor(centerY - lineLength / 2);
        const endY = startY + lineLength;

        // Randomly swap start/end for variety (tests both directions)
        let y1 = startY, y2 = endY;
        if (SeededRandom.getRandom() < 0.5) {
            [y1, y2] = [y2, y1];
        }

        // Draw 1px opaque red vertical line
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 1;
        ctx.strokeLine(centerX, y1, centerX, y2);

        // For crisp vertical lines, the stroke should occupy exactly one pixel column
        const pixelX = Math.floor(centerX);
        return {
            logs: [`1px Red vertical line from (${centerX}, ${y1}) to (${centerX}, ${y2}), length=${lineLength}px`],
            checkData: {
                topY: Math.min(y1, y2),
                bottomY: Math.max(y1, y2) - 1,  // Inclusive bottom bound
                leftX: pixelX,
                rightX: pixelX
            }
        };
    },
    'lines',
    {
        extremes: true
    },
    {
        title: 'Lines: M-Size No-Fill 1px-Opaque-Stroke Crisp-Pixel-Pos Vertical',
        description: 'Tests crisp rendering of a vertical 1px line centered between pixels.',
        perfName: 'Perf: Lines M 1px Crisp Vertical'
    }
);

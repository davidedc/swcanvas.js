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

        // Crisp positioning for 2px line: center at grid crossing (integer Y)
        // This ensures the 2px stroke fills exactly two pixel rows (Y-1 and Y)
        const centerY = Math.floor(height / 2);

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

        // Draw 2px opaque red horizontal line
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 2;
        ctx.strokeLine(x1, centerY, x2, centerY);

        // For crisp 2px horizontal lines at grid crossing, stroke occupies two pixel rows
        const topPixelY = centerY - 1;
        const bottomPixelY = centerY;

        return {
            logs: [`2px Red line from (${x1}, ${centerY}) to (${x2}, ${centerY}), length=${lineLength}px`],
            checkData: {
                topY: topPixelY,
                bottomY: bottomPixelY,
                leftX: Math.min(x1, x2),
                rightX: Math.max(x1, x2) - 1  // Inclusive right bound
            }
        };
    },
    'lines',
    {
        extremes: { tolerance: 0.01 }  // Small tolerance for 2px line bounds
    },
    {
        title: 'Lines: M-Size No-Fill 2px-Opaque-Stroke Centered-At-Grid Horizontal',
        description: 'Tests crisp rendering of a horizontal 2px line centered at grid crossing using canvas code.',
        perfName: 'Perf: Lines M 2px Grid Horizontal'
    }
);

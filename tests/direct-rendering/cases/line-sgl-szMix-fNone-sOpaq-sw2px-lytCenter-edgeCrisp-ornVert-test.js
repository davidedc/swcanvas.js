/**
* TEST SUMMARY:
* =================
*
* Description: Tests crisp rendering of a single, vertical, 2px-thick opaque line centered on a grid line.
*
*
* ---
*
* | Facet                  | Value          | Reason
* |------------------------|----------------|-----------------------------------------------------------------------------------------------------
* | Shape category         | lines          | The code draws lines using `ctx.strokeLine`.
* | Count                  | single         | The default test case draws a single line instance.
* | SizeCategory           | mixed          | The line length is randomized in `[20, 149]`, which spans S (`16-39`), M (`40-79`), and L (`80-159`) size categories.
* | FillStyle              | none           | No fill is applied to the line.
* | StrokeStyle            | opaque         | The stroke is a solid, opaque red color (`rgb(255, 0, 0)`).
* | StrokeThickness        | 2px            | `ctx.lineWidth` is explicitly set to `2`.
* | Layout                 | centered       | The line is positioned relative to the canvas center.
* | CenteredAt             | N/A            | This facet is not applicable to lines as per the project's convention.
* | EdgeAlignment          | crisp          | The line has a 2px (even) width and is drawn on an integer x-coordinate, ensuring its edges align with pixel boundaries.
* | Orientation            | vertical       | The line is drawn with identical start and end x-coordinates.
* | ArcAngleExtent         | N/A            | Not an arc.
* | RoundRectRadius        | N/A            | Not a rounded rectangle.
* | ContextTranslation     | none           | `ctx.translate()` is not used.
* | ContextRotation        | none           | `ctx.rotate()` is not used.
* | ContextScaling         | none           | `ctx.scale()` is not used.
* | Clipped on shape       | none           | `ctx.clip()` is not used.
* | Clipped on shape count | n/a            | No clipping.
* | Clipped on shape arrangement | n/a      | No clipping.
* | Clipped on shape size  | n/a            | No clipping.
* | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
*
* ---
*
* UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
* ----------------------------------------------
* The stroke color is a fixed opaque red.
*
*/

registerDirectRenderingTest(
    'line-sgl-szMix-fNone-sOpaq-sw2px-lytCenter-edgeCrisp-ornVert',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        if (canvasWidth % 2 !== 0 || canvasHeight % 2 !== 0) {
            throw new Error("Canvas width and height must be even for this test.");
        }

        // Random line length (spans S, M, L sizes: 20-149px)
        const lineHeight = Math.floor(20 + SeededRandom.getRandom() * 130);

        // Center at grid crossing (integer coordinates)
        const centerX = Math.floor(canvasWidth / 2);
        const centerY = Math.floor(canvasHeight / 2);

        // Calculate start/end Y positions
        const topY = Math.floor(centerY - lineHeight / 2);
        const bottomY = topY + lineHeight;

        // For 2px line centered at integer X, it spans X-1 to X
        const leftPixelX = centerX - 1;
        const rightPixelX = centerX;

        // Randomly swap start/end for variety (tests both directions)
        let startY = topY, endY = bottomY;
        if (SeededRandom.getRandom() < 0.5) {
            [startY, endY] = [endY, startY];
        }

        // Draw 2px opaque red vertical line
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 2;
        ctx.strokeLine(centerX, startY, centerX, endY);

        return {
            logs: [`2px Red vertical line from (${centerX}, ${startY}) to (${centerX}, ${endY}), length=${lineHeight}px`],
            checkData: {
                leftX: leftPixelX,
                rightX: rightPixelX,
                topY: Math.min(startY, endY),
                bottomY: Math.max(startY, endY) - 1
            }
        };
    },
    'lines',
    {
        extremes: true
    },
    {
        title: 'Lines: M-Size No-Fill 2px-Opaque-Stroke Centered-At-Grid Vertical',
        description: 'Tests crisp rendering of a vertical 2px line centered at grid crossing.',
        perfName: 'Perf: Lines M 2px Grid Vertical'
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of a single 1px semi-transparent red diagonal line using the Bresenham algorithm with alpha blending.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | lines          | The test draws a line using ctx.strokeLine().
 * | Count                  | single         | The test draws one line instance.
 * | SizeCategory           | N/A            | Line spans from (30,30) to (canvas-30, canvas-30), fixed relative to canvas.
 * | FillStyle              | none           | Lines have no fill.
 * | StrokeStyle            | semi-transparent | Stroke color is rgba(255, 0, 0, 0.5) with 50% alpha.
 * | StrokeThickness        | 1px            | lineWidth is set to 1.
 * | Layout                 | N/A            | Fixed diagonal from top-left margin to bottom-right margin.
 * | CenteredAt             | N/A            | Not applicable to diagonal lines.
 * | EdgeAlignment          | N/A            | Diagonal lines cannot have perfectly crisp edges.
 * | Orientation            | diagonal       | Line drawn from (30,30) to (width-30, height-30).
 * | ArcAngleExtent         | N/A            | Not applicable to lines.
 * | RoundRectRadius        | N/A            | Not applicable to lines.
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
 * - Stroke color is fixed semi-transparent red (rgba(255, 0, 0, 0.5)).
 * - Tests direct LineOps.strokeDirect() Bresenham algorithm with alpha blending.
 * - Line uses 30px margin from canvas edges.
 *
 */

registerDirectRenderingTest(
    'line-sgl-fNone-sSemi-sw1px-ornDiag',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Semi-transparent stroke color (uses direct Bresenham with alpha blending)
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 1;

        // Draw a diagonal line to test Bresenham algorithm properly
        const margin = 30;
        const x1 = margin;
        const y1 = margin;
        const x2 = canvasWidth - margin;
        const y2 = canvasHeight - margin;

        ctx.strokeLine(x1, y1, x2, y2);

        return {
            logs: [`Semi-transparent 1px line from (${x1}, ${y1}) to (${x2}, ${y2})`],
            checkData: {
                topY: Math.min(y1, y2),
                bottomY: Math.max(y1, y2),
                leftX: Math.min(x1, x2),
                rightX: Math.max(x1, x2)
            }
        };
    },
    'lines',
    {
        totalUniqueColors: 2  // White background + one blended color
    },
    {
        title: 'Single 1px Semi-Transparent Diagonal Line (Bresenham Alpha)',
        description: 'Tests rendering of a single 1px semi-transparent red diagonal line using Bresenham algorithm.',
        perfName: 'Perf: Line 1px Semi-Trans Diagonal'
    }
);

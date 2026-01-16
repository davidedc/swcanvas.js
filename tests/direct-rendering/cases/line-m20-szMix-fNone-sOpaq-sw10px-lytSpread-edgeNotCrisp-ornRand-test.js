/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Renders 20 lines with 10px red opaque strokes at random positions and orientations. This test is used for both visual regression and performance measurement.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | lines          | The test draws lines using `ctx.strokeLine`.
 * | Count                  | multi-20       | The test is configured to draw 20 lines in its standard visual regression mode.
 * | SizeCategory           | mixed          | Line length is determined by two random points, resulting in a variable length that spans multiple size categories.
 * | FillStyle              | none           | `ctx.fillStyle` is set to `rgba(0,0,0,0)`, meaning no fill is applied.
 * | StrokeStyle            | opaque         | `ctx.strokeStyle` is set to `rgb(255,0,0)`, which is fully opaque.
 * | StrokeThickness        | 10px           | `ctx.lineWidth` is explicitly set to the constant value `10`.
 * | Layout                 | spread         | 20 lines are drawn, each with independently randomized start/end points, distributing them across the canvas.
 * | CenteredAt             | N/A            | This facet is not applicable for lines, which are defined by endpoints, not a geometric center.
 * | EdgeAlignment          | not-crisp      | The random start and end points result in angled lines that are inherently not pixel-aligned.
 * | Orientation            | random         | The orientation of each line is determined by its two random endpoints, resulting in random angles.
 * | ArcAngleExtent         | N/A            | Not an arc shape.
 * | RoundRectRadius        | N/A            | Not a rounded rectangle shape.
 * | ContextTranslation     | none           | The drawing context is not translated; no `ctx.translate()` is called.
 * | ContextRotation        | none           | The drawing context is not rotated; no `ctx.rotate()` is called.
 * | ContextScaling         | none           | The drawing context is not scaled; no `ctx.scale()` is called.
 * | Clipped on shape       | none           | No clipping region is defined or applied in this test.
 * | Clipped on shape count | n/a            | Not applicable as no clipping is used.
 * | Clipped on shape arrangement | n/a      | Not applicable as no clipping is used.
 * | Clipped on shape size  | n/a            | Not applicable as no clipping is used.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * The line length is randomized between 1 and ~301 pixels, which spans the XS, S, M, L, and XL size categories.
 * The position and orientation are fully randomized within the canvas bounds. The stroke color is fixed red.
 */

/**
 * Draws multiple 10px thick, red, opaque lines at random positions.
 */
function drawTest(ctx, iterationNumber, instances) {
    const initialCount = 20;
    const isPerformanceRun = instances !== null && instances > 0;
    const lineCount = isPerformanceRun ? instances : initialCount;

    let logs = isPerformanceRun ? null : [];

    // Set constant drawing properties
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.fillStyle = 'rgba(0,0,0,0)';

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < lineCount; i++) {
        const start = getRandomPoint(0, canvasWidth, canvasHeight, 0);
        const end = getRandomPoint(0, canvasWidth, canvasHeight, 0);

        ctx.strokeLine(start.x, start.y, end.x, end.y);

        if (!isPerformanceRun) {
            logs.push(`─ 10px Red line from (${start.x}, ${start.y}) to (${end.x}, ${end.y})`);
        }
    }

    if (!isPerformanceRun && logs.length === 0) {
        logs.push('No 10px red lines drawn.');
    }

    return logs && logs.length > 0 ? { logs } : null;
}

registerDirectRenderingTest(
    'line-m20-szMix-fNone-sOpaq-sw10px-lytSpread-edgeNotCrisp-ornRand',
    drawTest,
    'lines',
    {
    },
    {
        title: 'Lines: Multi-20 No-Fill 10px-Red-Opaque-Stroke Random-Pos Random-Orient',
        perfName: 'Perf: Lines Multi 10px Red Random',
        description: 'Performance test for rendering multiple (default 20, or N from harness) 10px red lines at random positions.'
    }
);

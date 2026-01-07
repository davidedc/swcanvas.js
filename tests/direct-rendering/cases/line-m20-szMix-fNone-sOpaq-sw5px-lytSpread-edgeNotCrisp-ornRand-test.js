/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Renders 20 lines with a 5px red opaque stroke at random positions and with random orientations.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | lines          | The test draws lines using `ctx.strokeLine`.
 * | Count                  | multi-20       | The test is configured to draw 20 lines in its default visual regression mode (`initialCount = 20`).
 * | SizeCategory           | mixed          | Line length is determined by two random points on the canvas, leading to a wide, unpredictable range of lengths that spans multiple size categories (XS to XL).
 * | FillStyle              | none           | Lines do not have a fill, and `ctx.fillStyle` is set to be fully transparent. Only a stroke operation is performed.
 * | StrokeStyle            | opaque         | The stroke color is explicitly set to `rgb(255,0,0)`, which is fully opaque.
 * | StrokeThickness        | 5px            | The context's `lineWidth` is hardcoded to 5.
 * | Layout                 | spread         | The start and end points for each of the 20 lines are chosen randomly, distributing them across the canvas.
 * | CenteredAt             | N/A            | This facet is not applicable to lines, as their primary anchor points are their ends, not a geometric center.
 * | EdgeAlignment          | not-crisp      | The line coordinates are random integers and the stroke width is odd (5px). No crisping logic is applied, so the final rendered edges are not guaranteed to align with pixel boundaries.
 * | Orientation            | random         | With both start and end points chosen randomly for each line, the resulting orientation is also random.
 * | ArcAngleExtent         | N/A            | Not applicable to lines.
 * | RoundRectRadius        | N/A            | Not applicable to lines.
 * | ContextTranslation     | none           | The test does not use `ctx.translate()`.
 * | ContextRotation        | none           | The test does not use `ctx.rotate()`.
 * | ContextScaling         | none           | The test does not use `ctx.scale()`.
 * | Clipped on shape       | none           | The test does not apply any clipping regions.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * The line length is randomized from 0 up to the canvas diagonal length. The stroke color is fixed to opaque red.
 *
 */

/**
 * Draws multiple 5px thick, red, opaque lines at random positions.
 */
function drawTest(ctx, currentIterationNumber, instances = null) {
    const initialCount = 20;
    const isPerformanceRun = instances !== null && instances > 0;
    const lineCount = isPerformanceRun ? instances : initialCount;

    let logs = isPerformanceRun ? null : [];

    // Set constant drawing properties
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.fillStyle = 'rgba(0,0,0,0)';

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < lineCount; i++) {
        const start = getRandomPoint(0, canvasWidth, canvasHeight, 0);
        const end = getRandomPoint(0, canvasWidth, canvasHeight, 0);

        ctx.strokeLine(start.x, start.y, end.x, end.y);

        if (!isPerformanceRun) {
            logs.push(`─ 5px Red line from (${start.x}, ${start.y}) to (${end.x}, ${end.y})`);
        }
    }

    if (!isPerformanceRun && logs.length === 0) {
        logs.push('No 5px red lines drawn.');
    }

    return logs && logs.length > 0 ? { logs } : null;
}

registerDirectRenderingTest(
    'line-m20-szMix-fNone-sOpaq-sw5px-lytSpread-edgeNotCrisp-ornRand',
    drawTest,
    'lines',
    {
    },
    {
        title: 'Lines: Multi-20 No-Fill 5px-Red-Opaque-Stroke Random-Pos Random-Orient',
        displayName: 'Perf: Lines Multi 5px Red Random',
        description: 'Performance test for rendering multiple (default 20, or N from harness) 5px red lines at random positions.'
    }
);

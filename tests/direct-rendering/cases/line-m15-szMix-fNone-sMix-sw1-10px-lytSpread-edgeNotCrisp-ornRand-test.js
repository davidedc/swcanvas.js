/**
 * TEST SUMMARY:
 * =================
 *
 * Description: 15 lines, no fill, random stroke, random positions, random orientations.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | lines          | The test draws lines using `ctx.strokeLine()`.
 * | Count                  | multi-15       | The test is configured to draw 15 lines in a loop for its visual regression mode.
 * | SizeCategory           | mixed          | Line start/end points are random within canvas bounds, so line length can vary greatly, spanning all size categories (XS-XL).
 * | FillStyle              | none           | The test only calls `ctx.strokeLine()` and does not use any fill operations.
 * | StrokeStyle            | mixed          | The stroke alpha is randomized in `[150, 255]`, resulting in both opaque (alpha=255) and semi-transparent strokes.
 * | StrokeThickness        | 1px-10px       | `ctx.lineWidth` is set to `Math.floor(SeededRandom.getRandom() * 10) + 1`, yielding an integer in the range [1, 10].
 * | Layout                 | spread         | Each line's start and end points are randomized independently, distributing them across the canvas.
 * | CenteredAt             | N/A            | This facet is not applicable to line primitives.
 * | EdgeAlignment          | not-crisp      | Line coordinates are fully random floating-point values with no logic to align them to pixel boundaries.
 * | Orientation            | random         | With both start and end points chosen randomly, the resulting line orientation is also random.
 * | ArcAngleExtent         | N/A            | This facet is only applicable to arc shapes.
 * | RoundRectRadius        | N/A            | This facet is only applicable to rounded rectangle shapes.
 * | ContextTranslation     | none           | The test code does not contain any calls to `ctx.translate()`.
 * | ContextRotation        | none           | The test code does not contain any calls to `ctx.rotate()`.
 * | ContextScaling         | none           | The test code does not contain any calls to `ctx.scale()`.
 * | Clipped on shape       | none           | The test code does not contain any calls to `ctx.clip()`.
 * | Clipped on shape count | n/a            | Clipping is not used in this test.
 * | Clipped on shape arrangement | n/a      | Clipping is not used in this test.
 * | Clipped on shape size  | n/a            | Clipping is not used in this test.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * Stroke color has randomized RGB values and an alpha randomized in the range [150, 255]. strokeWidth: floor(SR.get()*10)+1 => 1-10px. Line length [1,~301) spans XS,S,M,L,XL.
 *
 */

/**
 * Draws multiple lines with random properties (position, thickness, color).
 */
function drawTest(ctx, iterationNumber, instances) {
    const initialCount = 15;
    const isPerformanceRun = instances !== null && instances > 0;
    const lineCount = isPerformanceRun ? instances : initialCount;

    let logs = isPerformanceRun ? null : [];

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < lineCount; i++) {
        const start = getRandomPoint(null, canvasWidth, canvasHeight, 0);
        const end = getRandomPoint(null, canvasWidth, canvasHeight, 0);
        const thickness = Math.floor(SeededRandom.getRandom() * 10) + 1;
        const colorStr = getRandomColor('mixed');

        ctx.lineWidth = thickness;
        ctx.strokeStyle = colorStr;

        ctx.strokeLine(start.x, start.y, end.x, end.y);

        if (!isPerformanceRun) {
            logs.push(`─ Random Line from (${start.x.toFixed(1)}, ${start.y.toFixed(1)}) to (${end.x.toFixed(1)}, ${end.y.toFixed(1)}) thickness: ${thickness}, color: ${colorStr}`);
        }
    }

    if (!isPerformanceRun && logs.length === 0 && lineCount > 0) {
        logs.push('Attempted to draw random lines, but none were generated in the loop.');
    } else if (!isPerformanceRun && lineCount === 0) {
        logs.push('No random lines drawn (lineCount was 0).');
    }

    return logs && logs.length > 0 ? { logs } : null;
}

registerDirectRenderingTest(
    'line-m15-szMix-fNone-sMix-sw1-10px-lytSpread-edgeNotCrisp-ornRand',
    drawTest,
    'lines',
    {
    },
    {
        title: 'Lines: Multi-15 No-Fill Random-Stroke Random-Pos Random-Orient',
        displayName: 'Perf: Lines Multi Random Props',
        description: 'Performance test for rendering multiple (default 15, or N from harness) lines with random properties.'
    }
);

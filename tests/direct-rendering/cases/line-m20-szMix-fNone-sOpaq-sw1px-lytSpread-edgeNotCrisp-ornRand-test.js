/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of 20 red, 1px-thick lines. Each line has a randomly chosen start and end point, resulting in random positions, lengths, and orientations.
 *
 *
 * ---
 *
 * | Facet                        | Value          | Reason
 * |------------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category               | lines          | The test draws lines using `ctx.strokeLine` or `ctx.moveTo` and `ctx.lineTo`.
 * | Count                        | multi-20       | The script draws 20 lines in a loop.
 * | SizeCategory                 | mixed          | Line endpoints are randomized across the canvas, resulting in lengths that span multiple size categories.
 * | FillStyle                    | none           | The code sets `ctx.fillStyle` to be fully transparent `rgba(0, 0, 0, 0)` and no fill is applied.
 * | StrokeStyle                  | opaque         | `ctx.strokeStyle` is set to `'rgb(255, 0, 0)'`, which is a fully opaque red color.
 * | StrokeThickness              | 1px            | `ctx.lineWidth` is hardcoded to `1`.
 * | Layout                       | spread         | The test draws 20 lines with randomized start/end points, distributing them across the canvas.
 * | CenteredAt                   | N/A            | This facet is not applicable for line primitives.
 * | EdgeAlignment                | not-crisp      | Line endpoints are random floating-point coordinates, resulting in non-crisp, anti-aliased rendering.
 * | Orientation                  | random         | Both start and end points are chosen randomly, leading to random line orientations.
 * | ArcAngleExtent               | N/A            | This facet only applies to `arc` shapes.
 * | RoundRectRadius              | N/A            | This facet only applies to `rounded-rect` shapes.
 * | ContextTranslation           | none           | The test code does not contain any calls to `ctx.translate()`.
 * | ContextRotation              | none           | The test code does not contain any calls to `ctx.rotate()`.
 * | ContextScaling               | none           | The test code does not contain any calls to `ctx.scale()`.
 * | Clipped on shape             | none           | The test code does not contain any calls to `ctx.clip()`.
 * | Clipped on shape count       | n/a            | Not applicable as no clipping is performed.
 * | Clipped on shape arrangement | n/a            | Not applicable as no clipping is performed.
 * | Clipped on shape size        | n/a            | Not applicable as no clipping is performed.
 * | Clipped on shape edge alignment | n/a         | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * The line length is randomized, resulting in a range of approximately [1, ~301) pixels on a 300x150 canvas,
 * which spans all size categories from XS to XL. The position and orientation are also fully randomized for each line.
 *
 */

/**
 * @fileoverview Test definition for rendering 20 1px thick, red, opaque lines with random start/end points.
 */

/**
 * Draws 20 1px thick, red, opaque lines with random start/end points.
 *
 * @param {CanvasRenderingContext2D | CrispSwContext} ctx - The rendering context.
 * @param {number} iterationNumber - The current test iteration.
 * @param {?number} instances - Unused here; accepted for the standard direct-rendering drawTest(ctx, iterationNumber, instances) signature.
 * @returns {{ logs: string[] }} Log entries for visual test verification.
 */
function drawTest(ctx, iterationNumber, instances) {
    const currentCanvasWidth = ctx.canvas.width;
    const currentCanvasHeight = ctx.canvas.height;

    if (currentCanvasWidth % 2 !== 0 || currentCanvasHeight % 2 !== 0) {
        throw new Error("Canvas width and height must be even for this test.");
    }

    const numIterations = 20;
    const logs = [];

    // Assume SeededRandom is available globally and seeded externally by RenderTest.
    // Assume getRandomPoint is available globally (from scene-creation-utils.js).

    // Set fixed drawing properties
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(255, 0, 0)'; // Red
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // No fill

    for (let i = 0; i < numIterations; i++) {
        // getRandomPoint uses SeededRandom for reproducibility
        const start = getRandomPoint(0, currentCanvasWidth, currentCanvasHeight, 0);
        const end = getRandomPoint(0, currentCanvasWidth, currentCanvasHeight, 0);

        // Draw the line
        ctx.strokeLine(start.x, start.y, end.x, end.y);

        logs.push(`─ 1px Red line from (${start.x.toFixed(1)}, ${start.y.toFixed(1)}) to (${end.x.toFixed(1)}, ${end.y.toFixed(1)}) color: ${ctx.strokeStyle} thickness: ${ctx.lineWidth}`);
    }

    return { logs: logs };
}

// Register the test
registerDirectRenderingTest(
    'line-m20-szMix-fNone-sOpaq-sw1px-lytSpread-edgeNotCrisp-ornRand-test',
    drawTest,
    'lines',
    {
        //compare: { swTol: 0, refTol: 0, diffTol: 0 } // Default visual comparison
    },
    {
        title: 'Lines: Multi-20 No-Fill 1px-Red-Opaque-Stroke Random-Pos Random-Orient',
        description: 'Tests rendering of 20 red lines (1px width) with random positions/orientations using canvas code.',
    }
);

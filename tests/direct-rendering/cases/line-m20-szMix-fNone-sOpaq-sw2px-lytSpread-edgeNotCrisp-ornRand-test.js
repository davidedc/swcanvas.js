/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Renders 20 lines with a 2px red opaque stroke. The lines have random positions and orientations.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | lines          | The test draws primitives using `ctx.strokeLine()`.
 * | Count                  | multi-20       | The test is configured to draw 20 instances in its standard visual regression mode (`initialCount = 20`).
 * | SizeCategory           | mixed          | Line length is determined by two random points on the canvas, so it can span multiple size categories (XS-XL).
 * | FillStyle              | none           | `ctx.fillStyle` is explicitly set to be fully transparent (`rgba(0,0,0,0)`), and only a stroke operation is performed.
 * | StrokeStyle            | opaque         | `ctx.strokeStyle` is set to `'rgb(255,0,0)'`, which is fully opaque.
 * | StrokeThickness        | 2px            | `ctx.lineWidth` is hardcoded to `2`.
 * | Layout                 | spread         | Multiple lines are drawn with their start and end points chosen randomly, distributing them across the canvas.
 * | CenteredAt             | N/A            | This facet is not applicable to lines, which are defined by start and end points, not a center.
 * | EdgeAlignment          | not-crisp      | Lines are drawn at random (often oblique) angles, which inherently prevents crisp pixel grid alignment.
 * | Orientation            | random         | The line's orientation is determined by its two randomly selected endpoints, resulting in a random orientation.
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
 * Line length is randomized from 0 to the canvas diagonal length, spanning multiple size categories (XS-XL). Position and orientation are randomized.
 *
 */

/**
 * @fileoverview Test definition for rendering multiple (20 by default) 2px thick, red, opaque
 * lines with random start/end points. Supports a parameter to vary the number of instances.
 *
 * Guiding Principles for this function:
 * - General:
 *   - Canvas width and height must be even; an error is thrown otherwise.
 *   - The number of lines drawn can be controlled by the 'instances' parameter.
 * - Multiple Instances (when 'instances' parameter > 0):
 *   - No logging is performed, and the function returns `null`.
 *   - Each line's position is determined randomly using `getRandomPoint` (which relies on `SeededRandom`).
 * - Single Instance / Default Behavior (when 'instances' is null, 0, or negative):
 *   - If 'instances' is null (default), 20 lines are drawn, and logs are collected.
 *   - If 'instances' is 0 or negative, 1 line is drawn, and logs are collected (for a minimal single run).
 *   - `SeededRandom` (via `getRandomPoint`) is used for all random elements to ensure test reproducibility.
 *   - Returns { logs: string[] }.
 */

/**
 * Draws a specified number of 2px thick, red, opaque lines with random start/end points.
 *
 * @param {CanvasRenderingContext2D | SWContext} ctx - The rendering context.
 * @param {number} iterationNumber - The current test iteration.
 * @param {?number} instances - Number of lines to draw. If null, defaults to 20.
 *                              If > 0, this many lines are drawn without logging.
 *                              If 0 or negative, 1 line is drawn with logging.
 * @returns {?{ logs: string[] }} Log entries if not in multi-instance mode (instances > 0), otherwise null.
 */
function drawTest(ctx, iterationNumber, instances) {
    const currentCanvasWidth = ctx.canvas.width;
    const currentCanvasHeight = ctx.canvas.height;

    if (currentCanvasWidth % 2 !== 0 || currentCanvasHeight % 2 !== 0) {
        throw new Error("Canvas width and height must be even for this test.");
    }

    const isTrueMultiInstance = instances !== null && instances > 0;
    let numIterations;

    if (isTrueMultiInstance) {
        numIterations = instances;
    } else if (instances === null) {
        numIterations = 20; // Default original behavior
    } else { // instances <= 0
        numIterations = 1; // Minimal single run with logging
    }

    let logs = isTrueMultiInstance ? null : [];

    // Set fixed drawing properties
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(255, 0, 0)'; // Red
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // No fill

    for (let i = 0; i < numIterations; i++) {
        // getRandomPoint uses SeededRandom for reproducibility of base characteristics.
        const start = isTrueMultiInstance ?
            {
                x: Math.random() * currentCanvasWidth,
                y: Math.random() * currentCanvasHeight
            } :
            getRandomPoint(0, currentCanvasWidth, currentCanvasHeight, 0);

        const end = isTrueMultiInstance ?
            {
                x: Math.random() * currentCanvasWidth,
                y: Math.random() * currentCanvasHeight
            } :
            getRandomPoint(0, currentCanvasWidth, currentCanvasHeight, 0);

        // Draw the line
        ctx.strokeLine(start.x, start.y, end.x, end.y);

        if (!isTrueMultiInstance) {
            logs.push(`─ 2px Red line from (${start.x.toFixed(1)}, ${start.y.toFixed(1)}) to (${end.x.toFixed(1)}, ${end.y.toFixed(1)}) color: ${ctx.strokeStyle} thickness: ${ctx.lineWidth}`);
        }
    }

    if (isTrueMultiInstance) {
        return null;
    } else {
        return { logs: logs }; // No checkData in this specific test's original design
    }
}

// Register the test
registerDirectRenderingTest(
    'line-m20-szMix-fNone-sOpaq-sw2px-lytSpread-edgeNotCrisp-ornRand-test',
    drawTest,
    'lines',
    {
        //compare: { swTol: 0, refTol: 0, diffTol: 0 } // Default visual comparison
        // Now uses fast polygon scan algorithm for thick diagonal lines
    },
    {
        title: 'Lines: Multi-20 No-Fill 2px-Red-Opaque-Stroke Random-Pos Random-Orient',
        description: 'Tests rendering of 20 red lines (2px width) with random positions/orientations using canvas code.',
    }
);

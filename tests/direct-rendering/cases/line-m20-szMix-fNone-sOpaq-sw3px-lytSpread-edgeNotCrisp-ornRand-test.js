/**
* TEST SUMMARY:
* =================
*
* Description: Renders 20 lines with a 3px red opaque stroke. The position and orientation of each line are fully randomized.
*
*
* ---
*
* | Facet                  | Value          | Reason
* |------------------------|----------------|-----------------------------------------------------------------------------------------------------
* | Shape category         | lines          | The test draws line primitives using ctx.strokeLine().
* | Count                  | multi-20       | The test is configured to draw 20 lines in a standard visual test run (initialCount = 20).
* | SizeCategory           | mixed          | Line length is randomized from 0 to canvas diagonal, spanning multiple size categories (XS-XL).
* | FillStyle              | none           | The code explicitly sets fillStyle to transparent ('rgba(0,0,0,0)') and does not call fill methods.
* | StrokeStyle            | opaque         | The code sets strokeStyle to an opaque color ('rgb(255,0,0)').
* | StrokeThickness        | 3px            | The code hardcodes ctx.lineWidth = 3.
* | Layout                 | spread         | Each of the 20 lines has its start/end points randomized, spreading them across the canvas.
* | CenteredAt             | N/A            | This facet is not applicable to lines.
* | EdgeAlignment          | not-crisp      | Endpoints are random integers and lines are not axis-aligned; no specific crisping logic is applied.
* | Orientation            | random         | Both start and end points of each line are chosen randomly, resulting in random orientations.
* | ArcAngleExtent         | N/A            | This facet is not applicable to lines.
* | RoundRectRadius        | N/A            | This facet is not applicable to lines.
* | ContextTranslation     | none           | The code does not use ctx.translate().
* | ContextRotation        | none           | The code does not use ctx.rotate().
* | ContextScaling         | none           | The code does not use ctx.scale().
* | Clipped on shape       | none           | The code does not create or apply any clipping regions.
* | Clipped on shape count | n/a            | Not applicable as there is no clipping.
* | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
* | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
* | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
*
* ---
*
* UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
* ----------------------------------------------
* The primary uncaptured aspect is the specific randomization range for the line length. Since start and end points
* are chosen randomly anywhere on the canvas, the length can vary from 0 up to the canvas diagonal length, which
* is why SizeCategory is 'mixed'.
*
*/

/**
 * Draws multiple 3px thick, red, opaque lines at random positions.
 * The number of lines drawn depends on whether 'instances' (for performance mode)
 * or 'initialCount' (for visual regression mode) is active.
 *
 * @param {CanvasRenderingContext2D | SWContext} ctx - The rendering context.
 * @param {number} currentIterationNumber - The current test iteration (used by RenderTest for seeding).
 * @param {?number} instances - Optional. If provided and > 0, this many lines are drawn for performance testing.
 * @returns {?{ logs: string[] }} An object with logs, or null (especially in performance mode).
 */
function drawTest(ctx, currentIterationNumber, instances = null) {
    const initialCount = 20; // number of lines to draw for visual regression mode (i.e. not in performance mode)
    const isPerformanceRun = instances !== null && instances > 0;
    const lineCount = isPerformanceRun ? instances : initialCount;

    let logs = isPerformanceRun ? null : [];

    // Set constant drawing properties
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgb(255,0,0)'; // Opaque red in RGB format
    ctx.fillStyle = 'rgba(0,0,0,0)'; // No fill for lines

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < lineCount; i++) {
        // Use getRandomPoint with no margin to get points anywhere within canvas boundaries
        const start = getRandomPoint(0, canvasWidth, canvasHeight, 0);
        const end = getRandomPoint(0, canvasWidth, canvasHeight, 0);

        // Draw the line
        ctx.strokeLine(start.x, start.y, end.x, end.y);

        if (!isPerformanceRun) {
            logs.push(`─ 3px Red line from (${start.x.toFixed(1)}, ${start.y.toFixed(1)}) to (${end.x.toFixed(1)}, ${end.y.toFixed(1)})`);
        }
    }

    if (!isPerformanceRun && logs.length === 0) {
        logs.push('No 3px red lines drawn.');
    }

    return logs && logs.length > 0 ? { logs } : null;
}

// Register the test
registerDirectRenderingTest(
    'line-m20-szMix-fNone-sOpaq-sw3px-lytSpread-edgeNotCrisp-ornRand',
    drawTest,
    'lines',
    {
        // Visual comparison only - no specific checks
    },
    {
        title: 'Lines: Multi-20 No-Fill 3px-Red-Opaque-Stroke Random-Pos Random-Orient',
        displayName: 'Perf: Lines Multi 3px Red Random',
        description: 'Performance test for rendering multiple (default 20, or N from harness) 3px red lines at random positions.'
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single opaque fill+stroke rounded rectangle with PER-CORNER radii drawn under a quarter-turn CTM (90, 180 or 270 degrees). The axis-aligned direct arm draws the device-space box, so the corner radii must turn with it.
 *
 *
 * ---
 *
 * | Facet                  | Value               | Reason
 * |------------------------|---------------------|----------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | `rounded-rects`     | The test renders a rounded rectangle using `ctx.fillStrokeRoundRect()`.
 * | Count                  | `single`            | The test draws one shape instance in visual test mode.
 * | SizeCategory           | `mixed`             | Half-extents are randomized in [20, 79] / [16, 59], spanning S, M and L.
 * | FillStyle              | `opaque`            | Fill color is `rgb(0, 0, 255)`.
 * | StrokeStyle            | `opaque`            | Stroke color is `rgb(255, 0, 0)`.
 * | StrokeThickness        | `1-11px`            | Stroke width is an integer in [1, 11].
 * | Layout                 | `centered`          | The CTM translates the shape to the canvas center.
 * | CenteredAt             | `grid`              | The canvas center is a grid point (even canvas dimensions).
 * | EdgeAlignment          | `crisp`             | The box's sizes take the stroke width's parity, so every edge lands on the pixel grid.
 * | Orientation            | `square`            | The shape is axis-aligned in device space (the CTM is a quarter turn).
 * | ArcAngleExtent         | `N/A`               | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | `per-corner`        | A radii list is picked per iteration: rounded top/square bottom, one corner, a diagonal pair, three values, or four independent values (zeros included).
 * | ContextTranslation     | `none`              | (The translation to the canvas center is part of the fixed CTM, not a test variable.)
 * | ContextRotation        | `fixed`             | One of the quarter turns 90/180/270, set as an exact matrix (no trig noise).
 * | ContextScaling         | `none`              | The CTM has unit scale.
 * | Clipped on shape       | `none`              | The test code does not contain any calls to `ctx.clip()`.
 * | Clipped on shape count | `n/a`               | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | `n/a`         | Not applicable as there is no clipping.
 * | Clipped on shape size  | `n/a`               | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | `n/a`      | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The rotation is applied with setTransform(), so it is exact: the device-space geometry is the
 *   same crisp box an unrotated draw would produce, and the bounds check can be exact.
 */

/**
 * @fileoverview Test definition for a per-corner rounded rectangle under a quarter-turn CTM.
 */

/**
 * Draws a per-corner rounded rectangle under a quarter-turn CTM.
 *
 * @param {CanvasRenderingContext2D | SWCanvasContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness.
 * @returns {?{logs: string[], checkData: object}} Logs and check data for single-instance mode,
 *                  or null for performance mode.
 */
function drawTest(ctx, iterationNumber, instances) {
    // Seeded per-corner radii, cycling through the shapes per-corner callers use.
    // (Nested: case files share one global scope in the browser.)
    function pickCornerRadii(maxR) {
        const r = () => Math.round(SeededRandom.getRandom() * maxR);
        const pattern = Math.floor(SeededRandom.getRandom() * 5);
        if (pattern === 0) {
            const a = r();
            return [a, a, 0, 0]; // rounded top, square bottom (a window title bar)
        }
        if (pattern === 1) {
            const radii = [0, 0, 0, 0];
            radii[Math.floor(SeededRandom.getRandom() * 4)] = r(); // one rounded corner
            return radii;
        }
        if (pattern === 2) return [r(), r()]; // diagonal pairs
        if (pattern === 3) return [r(), r(), r()];
        return [0, 1, 2, 3].map(() => (SeededRandom.getRandom() < 0.3 ? 0 : r()));
    }

    // Exact quarter-turn matrices [a, b, c, d]: 90, 180, 270 degrees.
    const QUARTER_TURNS = [
        [0, 1, -1, 0],
        [-1, 0, 0, -1],
        [0, -1, 1, 0]
    ];

    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 1;

    let logs = [];
    let checkData = null;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < numToDraw; i++) {
        const lineWidth = 1 + Math.floor(SeededRandom.getRandom() * 11);
        // Sizes take the stroke width's parity: centred on the origin, the edges then sit
        // on half-pixels for odd strokes and on whole pixels for even ones (crisp both ways).
        const parity = lineWidth % 2;
        const width = 2 * (20 + Math.floor(SeededRandom.getRandom() * 60)) + parity;
        const height = 2 * (16 + Math.floor(SeededRandom.getRandom() * 44)) + parity;
        const turn = Math.floor(SeededRandom.getRandom() * 3);
        const radii = pickCornerRadii(Math.min(width, height) * 0.4);
        const [a, b, c, d] = QUARTER_TURNS[turn];

        let cx = Math.floor(canvasWidth / 2);
        let cy = Math.floor(canvasHeight / 2);
        if (isPerformanceRun && numToDraw > 1) {
            cx = Math.floor(Math.random() * canvasWidth);
            cy = Math.floor(Math.random() * canvasHeight);
        }

        ctx.save();
        ctx.setTransform(a, b, c, d, cx, cy);
        ctx.fillStyle = 'rgb(0, 0, 255)';
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = lineWidth;
        ctx.fillStrokeRoundRect(-width / 2, -height / 2, width, height, radii);
        ctx.restore();

        if (!isPerformanceRun && i === 0) {
            // A quarter turn of 90 or 270 degrees swaps the device-space extents.
            const deviceW = turn === 1 ? width : height;
            const deviceH = turn === 1 ? height : width;
            logs.push(
                `QuarterTurnPerCornerRRect: turn=${(turn + 1) * 90}deg, center=(${cx},${cy}), W/H=(${width},${height}), radii=${JSON.stringify(radii)}, sw=${lineWidth}`
            );
            checkData = calculateStrokedRectBounds(cx - deviceW / 2, cy - deviceH / 2, deviceW, deviceH, lineWidth);
        }
    }

    if (isPerformanceRun) {
        return null;
    }
    return { logs, checkData };
}

// Register the test
registerDirectRenderingTest(
    'roundrect-sgl-szMix-fOpaq-sOpaq-sw1-11px-lytCenter-cenGrid-edgeCrisp-ornAxial-rrrCorner-ctxRotFixed',
    drawTest,
    'rounded-rects',
    {
        extremes: true,
        totalUniqueColors: 3,
        speckles: { expected: 0 },
        shapeIntegrity: { hasFill: true, hasStroke: true }
    },
    {
        title: 'Single Per-Corner Rounded Rectangle Under a Quarter-Turn CTM (Opaque Fill & Stroke)',
        description: 'Tests that per-corner radii turn with the box when the axis-aligned direct arm draws a 90/180/270-degree rotated rounded rectangle.',
    }
);

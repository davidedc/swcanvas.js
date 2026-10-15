/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests the crisp rendering of a single, 1px red-stroked rounded rectangle with PER-CORNER radii, centered on a physical pixel's center coordinates.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws and registers itself as a 'rounded-rects' test.
 * | Count                  | single         | The test draws a single shape instance in its primary visual regression mode.
 * | SizeCategory           | mixed          | Base rect dimensions are randomized in [20, 149], spanning size categories S, M, and L.
 * | FillStyle              | none           | The test only calls `ctx.strokeRoundRect()` and does not apply a fill.
 * | StrokeStyle            | opaque         | The stroke color is hardcoded to `rgba(255,0,0,1)`, which is fully opaque.
 * | StrokeThickness        | 1px            | `ctx.lineWidth` is hardcoded to 1.
 * | Layout                 | centered       | The shape is positioned relative to the canvas center.
 * | CenteredAt             | pixel          | Center coordinates are calculated as `floor(dim / 2) + 0.5`.
 * | EdgeAlignment          | crisp          | The code explicitly uses `adjustDimensionsForCrispStrokeRendering()` to ensure sharp edges.
 * | Orientation            | square         | The rectangle is axis-aligned with no rotation.
 * | ArcAngleExtent         | N/A            | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | per-corner     | A radii list is picked per iteration: rounded top/square bottom, one corner, a diagonal pair, three values, or four independent values (zeros included).
 * | ContextTranslation     | none           | The test does not use `ctx.translate()`.
 * | ContextRotation        | none           | The test does not use `ctx.rotate()`.
 * | ContextScaling         | none           | The test does not use `ctx.scale()`.
 * | Clipped on shape       | none           | The test does not involve clipping.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The radii list form varies (1-4 entries), so the HTML5 list expansion is exercised too.
 * - Square (radius-0) corners are mixed with rounded ones: the ring must stay closed through both.
 */

/**
 * @fileoverview Test definition for a single 1px stroked per-corner rounded rectangle centered at a pixel.
 */

/**
 * Draws a single 1px stroked per-corner rounded rectangle, centered at a pixel.
 *
 * @param {CanvasRenderingContext2D | CrispSwContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness.
 * @returns {?{logs: string[], checkData: object}} Logs and data for checks for single-instance
 *                  mode, or null for performance mode.
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

    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 1;

    let logs = [];
    let checkData = null;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < numToDraw; i++) {
        const centerX = Math.floor(canvasWidth / 2) + 0.5;
        const centerY = Math.floor(canvasHeight / 2) + 0.5;

        const baseRectWidth = Math.floor(20 + SeededRandom.getRandom() * 130);
        const baseRectHeight = Math.floor(20 + SeededRandom.getRandom() * 130);

        // Adjust dimensions for a 1px stroke centered at the pixel center
        const adjusted = adjustDimensionsForCrispStrokeRendering(baseRectWidth, baseRectHeight, 1, { x: centerX, y: centerY });
        const finalRectWidth = adjusted.width;
        const finalRectHeight = adjusted.height;

        const radii = pickCornerRadii(Math.min(finalRectWidth, finalRectHeight) * 0.4);

        let geomX = centerX - finalRectWidth / 2;
        let geomY = centerY - finalRectHeight / 2;

        if (isPerformanceRun && numToDraw > 1) {
            geomX = Math.random() * Math.max(0, canvasWidth - finalRectWidth);
            geomY = Math.random() * Math.max(0, canvasHeight - finalRectHeight);
        }

        ctx.strokeStyle = 'rgba(255,0,0,1)';
        ctx.lineWidth = 1;

        ctx.strokeRoundRect(geomX, geomY, finalRectWidth, finalRectHeight, radii);

        if (!isPerformanceRun && i === 0) {
            logs.push(
                `PerCornerRRect Centered@Pixel: center=(${centerX},${centerY}), adj W/H=(${finalRectWidth},${finalRectHeight}), radii=${JSON.stringify(radii)}, geom=(${geomX.toFixed(1)},${geomY.toFixed(1)})`
            );
            checkData = calculateCrispStrokedRectBounds(geomX, geomY, finalRectWidth, finalRectHeight);
        }
    }

    if (isPerformanceRun) {
        return null;
    }
    return { logs, checkData };
}

// Register the test
registerDirectRenderingTest(
    'roundrect-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-cenPx-edgeCrisp-ornAxial-rrrCorner',
    drawTest,
    'rounded-rects',
    {
        extremes: true,
        stroke8Connectivity: { color: [255, 0, 0] },
        shapeIntegrity: true
    },
    {
        title: 'Single 1px Stroked Per-Corner Rounded Rectangle (Crisp, Centered at Pixel)',
        description: 'Tests crisp rendering of a single 1px red stroked rounded rectangle with per-corner radii (square corners included), centered at a pixel center.',
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests multiple axis-aligned fill+stroke rounded rectangles with PER-CORNER radii and random positions, sizes, strokes and colors.
 *
 *
 * ---
 *
 * | Facet                  | Value               | Reason
 * |------------------------|---------------------|----------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | `rounded-rects`     | The test renders rounded rectangles using `ctx.fillStrokeRoundRect()`.
 * | Count                  | `multi-8`           | The test draws 8 instances in visual test mode.
 * | SizeCategory           | `mixed`             | Widths/heights are randomized in [50, 60% of the canvas], spanning M, L, and XL.
 * | FillStyle              | `semitransparent`   | Fill colors come from `getRandomColor("semitransparent")`.
 * | StrokeStyle            | `mixed`             | Stroke colors come from `getRandomColor("mixed")` (opaque or semi-transparent).
 * | StrokeThickness        | `mixed`             | Stroke widths are even integers up to 10 (`calculateCrispRectTestParams`).
 * | Layout                 | `spread`            | Each rectangle gets a random offset of up to +/-50px from the canvas center.
 * | CenteredAt             | `mixed-pixel-grid`  | `calculateCrispRectTestParams()` picks grid or pixel centers.
 * | EdgeAlignment          | `crisp`             | `calculateCrispRectTestParams()` ensures sharp edges.
 * | Orientation            | `square`            | The rectangles are axis-aligned.
 * | ArcAngleExtent         | `N/A`               | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | `per-corner`        | Each rectangle picks a radii list: rounded top/square bottom, one corner, a diagonal pair, three values, or four independent values (zeros included).
 * | ContextTranslation     | `none`              | The test code does not contain any calls to `ctx.translate()`.
 * | ContextRotation        | `none`              | The test code does not contain any calls to `ctx.rotate()`.
 * | ContextScaling         | `none`              | The test code does not contain any calls to `ctx.scale()`.
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
 * - Overlapping shapes: this is a visual / performance case with no automated checks, like its uniform-radius sibling.
 */

/**
 * @fileoverview Test definition for multiple axis-aligned per-corner rounded rectangles with random parameters.
 */

/**
 * Draws multiple axis-aligned per-corner rounded rectangles with random parameters.
 *
 * @param {CanvasRenderingContext2D | SWCanvasContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For visual regression (instances is null/0), 8 rectangles are drawn.
 * @returns {?{logs: string[]}} Logs for single-instance mode, or null for performance mode.
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
    const numToDraw = isPerformanceRun ? instances : 8;

    let logs = [];

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < numToDraw; i++) {
        const placement = calculateCrispRectTestParams({
            canvasWidth,
            canvasHeight,
            minWidth: 50,
            maxWidth: canvasWidth * 0.6,
            minHeight: 50,
            maxHeight: canvasHeight * 0.6,
            maxStrokeWidth: 10,
            ensureEvenStroke: true,
            randomPosition: false // the random offset is applied below
        });
        const finalRectWidth = placement.adjustedDimensions.width;
        const finalRectHeight = placement.adjustedDimensions.height;
        const strokeWidth = placement.strokeWidth;

        const xOffset = Math.floor(SeededRandom.getRandom() * 100) - 50;
        const yOffset = Math.floor(SeededRandom.getRandom() * 100) - 50;
        const finalCenter = {
            x: placement.center.x + xOffset,
            y: placement.center.y + yOffset
        };

        const radii = pickCornerRadii(Math.min(finalRectWidth, finalRectHeight) * 0.4);
        const strokeColorStr = getRandomColor('mixed');
        const fillColorStr = getRandomColor('semitransparent');

        let geomX = finalCenter.x - finalRectWidth / 2;
        let geomY = finalCenter.y - finalRectHeight / 2;

        if (isPerformanceRun && numToDraw > 1) {
            geomX = Math.random() * Math.max(0, canvasWidth - finalRectWidth);
            geomY = Math.random() * Math.max(0, canvasHeight - finalRectHeight);
        } else if (!isPerformanceRun) {
            // Keep the shapes reasonably on canvas
            geomX = Math.max(0 - finalRectWidth / 4, Math.min(geomX, canvasWidth - (finalRectWidth * 3) / 4));
            geomY = Math.max(0 - finalRectHeight / 4, Math.min(geomY, canvasHeight - (finalRectHeight * 3) / 4));
        }

        ctx.fillStyle = fillColorStr;
        ctx.strokeStyle = strokeColorStr;
        ctx.lineWidth = strokeWidth;

        ctx.fillStrokeRoundRect(geomX, geomY, finalRectWidth, finalRectHeight, radii);

        if (!isPerformanceRun) {
            logs.push(
                `AxAlignedPerCornerRRect ${i + 1}: center=(${finalCenter.x.toFixed(1)},${finalCenter.y.toFixed(1)}), W/H=(${finalRectWidth},${finalRectHeight}), radii=${JSON.stringify(radii)}, sw=${strokeWidth.toFixed(1)}`
            );
        }
    }

    if (isPerformanceRun) {
        return null;
    }
    return { logs };
}

// Register the test
registerDirectRenderingTest(
    'roundrect-m8-szMix-fSemi-sMix-swMix-lytSpread-cenMixPG-edgeCrisp-ornAxial-rrrCorner',
    drawTest,
    'rounded-rects',
    {},
    {
        title: 'Axis-Aligned Per-Corner Rounded Rectangles (Multiple, Random Params)',
        description: 'Tests rendering of multiple axis-aligned rounded rectangles with per-corner radii and random positions, sizes, strokes and fills.',
    }
);

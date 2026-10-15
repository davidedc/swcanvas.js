/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single fill+stroke rounded rectangle with PER-CORNER radii, random even stroke widths and semi-transparent colors, centered crisply (grid or pixel). Exercises the fused direct arm's per-corner fill, outer and inner extents.
 *
 *
 * ---
 *
 * | Facet                  | Value               | Reason
 * |------------------------|---------------------|----------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | `rounded-rects`     | The test renders a rounded rectangle using `ctx.fillStrokeRoundRect()` (unified method to prevent speckles).
 * | Count                  | `single`            | The test logic draws only one shape instance in visual test mode.
 * | SizeCategory           | `mixed`             | The rectangle's width/height are randomized (e.g., from `50` to `~530px`), spanning M, L, and XL size categories.
 * | FillStyle              | `semitransparent`   | Fill color is `rgba(0, 0, 255, 0.49)`.
 * | StrokeStyle            | `semitransparent`   | Stroke color is `rgba(255, 0, 0, 0.49)`.
 * | StrokeThickness        | `mixed`             | Stroke width is randomized to be an even number between 2 and 42.
 * | Layout                 | `centered`          | The shape's position is calculated relative to the canvas center.
 * | CenteredAt             | `mixed-pixel-grid`  | The center has a 50% chance of being on a grid intersection or a pixel center.
 * | EdgeAlignment          | `crisp`             | The test uses `calculateCrispRectTestParams()` to ensure sharp edges.
 * | Orientation            | `square`            | The rectangle is always drawn axis-aligned with no rotation.
 * | ArcAngleExtent         | `N/A`               | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | `per-corner`        | A radii list is picked per iteration: rounded top/square bottom, one corner, a diagonal pair, three values, or four independent values (zeros included).
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
 * - The stroke width is randomized to be an even integer in the range [2, 42]; square corners get a
 *   square outer stroke corner, rounded ones the arc offset by half the stroke.
 */

/**
 * @fileoverview Test definition for a single centered per-corner rounded rectangle with semi-transparent stroke and fill.
 */

/**
 * Draws a single centered per-corner rounded rectangle with semi-transparent stroke and fill.
 *
 * @param {CanvasRenderingContext2D | SWCanvasContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness.
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
    const numToDraw = isPerformanceRun ? instances : 1;

    let logs = [];
    let checkData = null;

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
            maxStrokeWidth: 40,
            ensureEvenStroke: true,
            randomPosition: false // Centered positioning
        });
        const center = placement.center;
        const finalRectWidth = placement.adjustedDimensions.width;
        const finalRectHeight = placement.adjustedDimensions.height;
        const strokeWidth = placement.strokeWidth;

        // Standardized colors: semi-transparent red stroke, semi-transparent blue fill
        const strokeColorStr = 'rgba(255, 0, 0, 0.49)';
        const fillColorStr = 'rgba(0, 0, 255, 0.49)';
        const radii = pickCornerRadii(Math.min(finalRectWidth, finalRectHeight) * 0.4);

        let geomX = center.x - finalRectWidth / 2;
        let geomY = center.y - finalRectHeight / 2;

        if (isPerformanceRun && numToDraw > 1) {
            geomX = Math.random() * Math.max(0, canvasWidth - finalRectWidth);
            geomY = Math.random() * Math.max(0, canvasHeight - finalRectHeight);
        }

        ctx.fillStyle = fillColorStr;
        ctx.strokeStyle = strokeColorStr;
        ctx.lineWidth = strokeWidth;

        ctx.fillStrokeRoundRect(geomX, geomY, finalRectWidth, finalRectHeight, radii);

        if (!isPerformanceRun && i === 0) {
            logs.push(
                `TransparentPerCornerRRect: center=(${center.x.toFixed(1)},${center.y.toFixed(1)}), adjW/H=(${finalRectWidth},${finalRectHeight}), radii=${JSON.stringify(radii)}, sw=${strokeWidth.toFixed(1)}`
            );
            checkData = calculateStrokedRectBounds(geomX, geomY, finalRectWidth, finalRectHeight, strokeWidth);
        }
    }

    if (isPerformanceRun) {
        return null;
    }
    return { logs, checkData };
}

// Register the test
registerDirectRenderingTest(
    'roundrect-sgl-szMix-fSemi-sSemi-swMix-lytCenter-cenMixPG-edgeCrisp-ornAxial-rrrCorner',
    drawTest,
    'rounded-rects',
    {
        extremes: { colorTolerance: 8 },
        uniqueColors: {
            middleRow: { count: 4 },
            middleColumn: { count: 4 }
        },
        speckles: { expected: 0 },
        shapeIntegrity: { hasFill: true, hasStroke: true }
    },
    {
        title: 'Single Centered Per-Corner Rounded Rectangle (Semi-Transparent Stroke & Fill, Crisp Center)',
        description: 'Tests a single fill+stroke rounded rectangle with per-corner radii, random even stroke widths and semi-transparent colors, centered crisply (grid or pixel).',
    }
);

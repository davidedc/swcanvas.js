/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single rounded rectangle with random stroke widths and semi-transparent colors, centered crisply (grid or pixel).
 *
 *
 * ---
 *
 * | Facet                  | Value               | Reason
 * |------------------------|---------------------|----------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | `rounded-rects`     | The test renders a rounded rectangle using `ctx.fillStrokeRoundRect()` (unified method to prevent speckles).
 * | Count                  | `single`            | The test logic draws only one shape instance in visual test mode.
 * | SizeCategory           | `mixed`             | The rectangle's width/height are randomized (e.g., from `50` to `~530px`), spanning M, L, and XL size categories.
 * | FillStyle              | `semitransparent`   | Fill color is set with a random alpha between 50 and 150 (out of 255) using `getRandomColor("semitransparent-light")`.
 * | StrokeStyle            | `semitransparent`   | Stroke color is set with a random alpha between 50 and 150 (out of 255) using `getRandomColor("semitransparent-light")`.
 * | StrokeThickness        | `mixed`             | Stroke width is randomized to be an even number between 2 and 42. A discrete set of values is categorized as 'mixed'.
 * | Layout                 | `centered`          | The shape's position is calculated relative to the canvas center.
 * | CenteredAt             | `mixed-pixel-grid`  | The center has a 50% chance of being on a grid intersection (integer coordinates) or a pixel center (`*.5` coordinates).
 * | EdgeAlignment          | `crisp`             | The test uses the `adjustDimensionsForCrispStrokeRendering()` helper function to ensure sharp edges.
 * | Orientation            | `square`            | The rectangle is always drawn axis-aligned with no rotation.
 * | ArcAngleExtent         | `N/A`               | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | `randomized`        | The corner radius is randomized based on a fraction of the rectangle's dimensions.
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
 * - The stroke width is randomized to be an even integer in the range [2, 42].
 * - The rectangle's dimensions are randomized to be in the approximate range of [50, ~530] pixels.
 * - The corner radius is randomized based on the final, crisp-adjusted rectangle dimensions.
 *
 */

/**
 * @fileoverview Test definition for a single centered rounded rectangle with semi-transparent stroke and fill.
 */

/**
 * Draws a single centered rounded rectangle with semi-transparent stroke and fill.
 *
 * @param {CanvasRenderingContext2D | SWCanvasContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness.
 * @returns {?{logs: string[]}} Logs for single-instance mode, or null for performance mode.
 */
function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 1;

    let logs = [];

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Pre-condition check from original test
    if (canvasWidth % 2 !== 0 || canvasHeight % 2 !== 0) {
        const msg = 'Warning: Canvas dimensions are not even. Crisp rendering might be affected.';
        if (!isPerformanceRun) logs.push(msg);
    }

    for (let i = 0; i < numToDraw; i++) {
        // Calls 1-4 for SeededRandom happen inside calculateCrispFillAndStrokeRectParams
        const placement = calculateCrispFillAndStrokeRectParams({
            canvasWidth,
            canvasHeight,
            minWidth: 50,
            maxWidth: canvasWidth * 0.6,
            minHeight: 50,
            maxHeight: canvasHeight * 0.6,
            maxStrokeWidth: 40,        // Higher max stroke width for this test
            ensureEvenStroke: true,
            randomPosition: false      // Centered positioning
        });
        const center = placement.center;
        const finalRectWidth = placement.adjustedDimensions.width;
        const finalRectHeight = placement.adjustedDimensions.height;
        const strokeWidth = placement.strokeWidth;

        // Standardized colors: semi-transparent red stroke, semi-transparent blue fill
        const strokeColorStr = 'rgba(255, 0, 0, 0.49)';
        const fillColorStr = 'rgba(0, 0, 255, 0.49)';
        // SeededRandom Call 7: radius
        const radius = Math.round(SeededRandom.getRandom() * Math.min(finalRectWidth, finalRectHeight) * 0.2);

        let geomX = center.x - finalRectWidth / 2;
        let geomY = center.y - finalRectHeight / 2;

        if (isPerformanceRun && numToDraw > 1) {
            geomX = Math.random() * Math.max(0, canvasWidth - finalRectWidth);
            geomY = Math.random() * Math.max(0, canvasHeight - finalRectHeight);
        }

        ctx.fillStyle = fillColorStr;
        ctx.strokeStyle = strokeColorStr;
        ctx.lineWidth = strokeWidth;

        // Use unified fillStrokeRoundRect
        ctx.fillStrokeRoundRect(geomX, geomY, finalRectWidth, finalRectHeight, radius);

        if (!isPerformanceRun || i === 0) {
            const currentLogs = [
                `TransparentRRect: center=(${center.x.toFixed(1)},${center.y.toFixed(1)}), adjW/H=(${finalRectWidth},${finalRectHeight}), r=${radius}, sw=${strokeWidth.toFixed(1)}`
            ];
            if (i === 0) logs = logs.concat(currentLogs);
        }
    }

    if (isPerformanceRun) {
        return null;
    }
    return { logs };
}

// Register the test
registerDirectRenderingTest(
    'roundrect-sgl-szMix-fSemi-sSemi-swMix-lytCenter-cenMixPG-edgeCrisp-ornAxial-rrrRand',
    drawTest,
    'rounded-rects',
    {
        extremes: { colorTolerance: 8 },
        uniqueColors: {
            middleRow: { count: 4 },
            middleColumn: { count: 4 }
        },
        speckles: { expected: 0 }
    },
    {
        title: 'Single Centered Rounded Rectangle (Semi-Transparent Stroke & Fill, Crisp Center)',
        description: 'Tests a single rounded rectangle with random stroke widths and semi-transparent colors, centered crisply (grid or pixel).',
        displayName: 'Perf: RRect RandTrans Stroke/Fill CrispCenter'
    }
);

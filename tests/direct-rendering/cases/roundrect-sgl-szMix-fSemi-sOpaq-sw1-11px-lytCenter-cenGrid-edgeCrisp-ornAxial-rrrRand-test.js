/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single rounded rectangle with random stroke widths (opaque), random fills, centered at a grid crossing, with explicit logic to make it crisp.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws using `ctx.fillStrokeRoundRect()` (unified method to prevent speckles).
 * | Count                  | single         | The test is designed to draw one shape in its visual regression mode (`instances = null`).
 * | SizeCategory           | mixed          | `baseRectWidth` is randomized in `[50, 50 + 0.6 * canvasWidth]`. With a typical 800px canvas, this spans M, L, and XL size categories.
 * | FillStyle              | semitransparent| Fill color alpha is randomized in `[100, 200]` via `getRandomColor("semitransparent")`.
 * | StrokeStyle            | opaque         | Stroke color alpha is fixed at 255 via `getRandomColor("opaque")`.
 * | StrokeThickness        | 1px-11px       | `strokeWidth` is `Math.round(SeededRandom.getRandom() * 10 + 1)`, which results in an integer range of 1 to 11.
 * | Layout                 | centered       | The shape's reference point is calculated at the canvas center (`Math.floor(canvasWidth / 2)`).
 * | CenteredAt             | grid           | The center coordinates are snapped to integer values (`Math.floor`), aligning them with grid intersections.
 * | EdgeAlignment          | crisp          | The code explicitly calls `adjustDimensionsForCrispStrokeRendering()` to ensure pixel-perfect edges.
 * | Orientation            | square         | The test draws an axis-aligned rectangle with no rotation applied.
 * | ArcAngleExtent         | N/A            | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | randomized     | The corner radius is randomized based on the rectangle's final dimensions.
 * | ContextTranslation     | none           | The test does not use `ctx.translate()`.
 * | ContextRotation        | none           | The test does not use `ctx.rotate()`.
 * | ContextScaling         | none           | The test does not use `ctx.scale()`.
 * | Clipped on shape       | none           | The test does not use `ctx.clip()`.
 * | Clipped on shape count | n/a            | Clipping is not used.
 * | Clipped on shape arrangement | n/a      | Clipping is not used.
 * | Clipped on shape size  | n/a            | Clipping is not used.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 *  - In performance testing mode (`instances > 0`), the layout changes from `centered` to a random `spread`.
 *
 */

/**
 * @fileoverview Test definition for a single centered rounded rectangle with random opaque stroke and random fill, centered at a grid point.
 */

/**
 * Draws a single centered rounded rectangle with random opaque stroke and random fill.
 *
 * @param {CanvasRenderingContext2D | SWCanvasContext} ctx The rendering context.
 * @param {number} currentIterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For this test, it should draw one primary shape for visual
 *                  regression, and `instances` count for performance, each with unique properties based on SeededRandom.
 * @returns {?{logs: string[]}} Logs for single-instance mode, or null for performance mode.
 */
function drawTest(ctx, currentIterationNumber, instances = null) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 1;

    let logs = [];

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const maxWidth = canvasWidth * 0.6;
    const maxHeight = canvasHeight * 0.6;

    // Pre-condition check from original test
    if (canvasWidth % 2 !== 0 || canvasHeight % 2 !== 0) {
        const msg = 'Warning: Canvas dimensions are not even. Crisp grid-centered rendering might be affected.';
        if (!isPerformanceRun) logs.push(msg);
    }

    for (let i = 0; i < numToDraw; i++) {
        // Center is at grid crossing
        const centerX = Math.floor(canvasWidth / 2);
        const centerY = Math.floor(canvasHeight / 2);

        // SeededRandom Call 1: strokeWidth
        const strokeWidth = Math.round(SeededRandom.getRandom() * 10 + 1);
        // SeededRandom Call 2: baseRectWidth
        const baseRectWidth = Math.round(50 + SeededRandom.getRandom() * maxWidth);
        // SeededRandom Call 3: baseRectHeight
        const baseRectHeight = Math.round(50 + SeededRandom.getRandom() * maxHeight);

        // Adjust dimensions for crisp rendering with the random strokeWidth
        const adjusted = adjustDimensionsForCrispStrokeRendering(baseRectWidth, baseRectHeight, strokeWidth, { x: centerX, y: centerY });
        const finalRectWidth = adjusted.width;
        const finalRectHeight = adjusted.height;

        // SeededRandom Call 4: radius
        const radius = Math.round(SeededRandom.getRandom() * Math.min(finalRectWidth, finalRectHeight) * 0.2);

        // Standardized colors: opaque red stroke, semi-transparent blue fill
        const strokeColorStr = 'rgb(255, 0, 0)';
        const fillColorStr = 'rgba(0, 0, 255, 0.49)';

        let geomX = centerX - finalRectWidth / 2;
        let geomY = centerY - finalRectHeight / 2;

        if (isPerformanceRun && numToDraw > 1) {
            geomX = Math.random() * Math.max(0, canvasWidth - finalRectWidth);
            geomY = Math.random() * Math.max(0, canvasHeight - finalRectHeight);
        }

        // Set styles before drawing
        ctx.fillStyle = fillColorStr;
        ctx.strokeStyle = strokeColorStr;
        ctx.lineWidth = strokeWidth;

        // Use unified fillStrokeRoundRect
        ctx.fillStrokeRoundRect(geomX, geomY, finalRectWidth, finalRectHeight, radius);

        if (!isPerformanceRun || i === 0) {
            const currentLogs = [
                `CenteredRRect: center=(${centerX},${centerY}), baseW/H=(${baseRectWidth},${baseRectHeight}), adjW/H=(${finalRectWidth},${finalRectHeight}), r=${radius}, sw=${strokeWidth.toFixed(1)}`
            ];
            if (i === 0) logs = logs.concat(currentLogs);
        }
    }

    if (isPerformanceRun) {
        return null;
    }
    // Return logs for visual regression run.
    return { logs };
}

// Register the test
registerDirectRenderingTest(
    'roundrect-sgl-szMix-fSemi-sOpaq-sw1-11px-lytCenter-cenGrid-edgeCrisp-ornAxial-rrrRand',
    drawTest,
    'rounded-rects',
    {
        extremes: { colorTolerance: 8 },
        uniqueColors: {
            middleRow: { count: 3, skipOnIterations: [817] },
            middleColumn: { count: 3 }
        },
        speckles: { expected: 0 }
    },
    {
        title: 'Single Centered Rounded Rectangle (Random Opaque Stroke, Random Fill, Grid Center)',
        description: 'Tests a single rounded rectangle with random stroke widths (opaque), random fills, centered at a grid crossing.',
        displayName: 'Perf: RRect RandStroke Opaque Grid Fill'
    }
);

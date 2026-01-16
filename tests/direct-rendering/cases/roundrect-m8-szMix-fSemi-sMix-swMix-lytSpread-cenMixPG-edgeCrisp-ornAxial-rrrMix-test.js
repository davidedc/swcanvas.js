/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of 8 axis-aligned rounded rectangles. The test uses a helper function to ensure crisp rendering by adjusting dimensions and placing the shape's center on a grid or pixel-center boundary. Position, size, stroke, fill, and corner radii are all randomized.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws rounded rectangles using `ctx.fillStrokeRoundRect()` (unified method to prevent speckles).
 * | Count                  | multi-8        | The test draws 8 instances when not in performance mode.
 * | SizeCategory           | mixed          | Width/Height are randomized in a range of [50, ~530] which spans M, L, and XL size categories.
 * | FillStyle              | semitransparent| `getRandomColor("semitransparent")` is called for fill, which produces an alpha value in that range.
 * | StrokeStyle            | mixed          | `getRandomColor("mixed")` is called for stroke, producing alpha values that can be opaque (255) or semitransparent.
 * | StrokeThickness        | mixed          | `strokeWidth` is randomized to a discrete set of even integers: 2, 4, 6, 8, 10, 12.
 * | Layout                 | spread         | Positions are randomized within the canvas to distribute the shapes.
 * | CenteredAt             | mixed-pixel-grid | The `initialCenter` has a 50% chance of being on a pixel center (+0.5) or a grid integer coordinate.
 * | EdgeAlignment          | crisp          | The code explicitly calls `adjustDimensionsForCrispStrokeRendering()` to ensure crisp edges.
 * | Orientation            | square         | The test draws axis-aligned rectangles with no rotation.
 * | ArcAngleExtent         | N/A            | This facet is not applicable to rounded rectangles.
 * | RoundRectRadius        | mixed          | The corner radius is randomized based on the rectangle's randomized dimensions.
 * | ContextTranslation     | none           | `ctx.translate()` is not used.
 * | ContextRotation        | none           | `ctx.rotate()` is not used.
 * | ContextScaling         | none           | `ctx.scale()` is not used.
 * | Clipped on shape       | none           | `ctx.clip()` is not used.
 * | Clipped on shape count | n/a            | Clipping is not used.
 * | Clipped on shape arrangement | n/a      | Clipping is not used.
 * | Clipped on shape size  | n/a            | Clipping is not used.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The visual test (`!isPerformanceRun`) uses a combination of pre-calculated center + random offsets, whereas the performance-mode test uses `Math.random()` for layout, which is a slightly different `spread` logic.
 * - The stroke color alpha range of [200, 255] means strokes are either fully opaque or very close to it.
 * - The corner radius is specifically randomized as a factor of the shape's smaller dimension (`Math.min(finalRectWidth, finalRectHeight) * 0.2`).
 */
/**
 * @fileoverview Test definition for multiple axis-aligned rounded rectangles with random parameters.
 */

/**
 * Draws multiple axis-aligned rounded rectangles with random parameters.
 *
 * @param {CanvasRenderingContext2D | SWCanvasContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For visual regression (instances is null/0), 8 rectangles are drawn.
 * @returns {?{logs: string[]}} Logs for single-instance mode, or null for performance mode.
 */
function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 8; // Original test draws 8

    let logs = [];

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let i = 0; i < numToDraw; i++) {
        // Calls 1-4 for SeededRandom happen inside calculateCrispFillAndStrokeRectParams
        const placement = calculateCrispFillAndStrokeRectParams({
            canvasWidth,
            canvasHeight,
            minWidth: 50,
            maxWidth: canvasWidth * 0.6,
            minHeight: 50,
            maxHeight: canvasHeight * 0.6,
            maxStrokeWidth: 10,
            ensureEvenStroke: true,
            randomPosition: false  // We'll apply our own offset below
        });
        let currentCenter = placement.center; // This is the center *before* the per-instance random offset
        const finalRectWidth = placement.adjustedDimensions.width;
        const finalRectHeight = placement.adjustedDimensions.height;
        const strokeWidth = placement.strokeWidth;

        // SeededRandom Call 5: xOffset
        const xOffset = Math.floor(SeededRandom.getRandom() * 100) - 50;
        // SeededRandom Call 6: yOffset
        const yOffset = Math.floor(SeededRandom.getRandom() * 100) - 50;

        // Apply the random offset to get the final center for this specific rectangle
        const finalCenter = {
            x: currentCenter.x + xOffset,
            y: currentCenter.y + yOffset
        };

        // SeededRandom Call 7: radius
        const radius = Math.round(SeededRandom.getRandom() * Math.min(finalRectWidth, finalRectHeight) * 0.2);
        // SeededRandom Call 8: strokeColor (semi-transparent or also opaque)
        const strokeColorStr = getRandomColor("mixed");
        // SeededRandom Call 9: fillColor (semi-transparent)
        const fillColorStr = getRandomColor("semitransparent");

        let geomX = finalCenter.x - finalRectWidth / 2;
        let geomY = finalCenter.y - finalRectHeight / 2;

        // For performance mode, if drawing multiple instances, ensure the base properties are unique per instance (done by SR calls)
        // then spread them out using Math.random for position only for instances *after the first one for that frame*.
        if (isPerformanceRun && numToDraw > 1) { // Apply to all instances in perf run
            geomX = Math.random() * Math.max(0, canvasWidth - finalRectWidth);
            geomY = Math.random() * Math.max(0, canvasHeight - finalRectHeight);
        } else if (!isPerformanceRun) { // For visual regression (numToDraw = 8), ensure shapes are reasonably on canvas
            geomX = Math.max(0 - finalRectWidth / 4, Math.min(geomX, canvasWidth - finalRectWidth * 3 / 4));
            geomY = Math.max(0 - finalRectHeight / 4, Math.min(geomY, canvasHeight - finalRectHeight * 3 / 4));
        }

        ctx.fillStyle = fillColorStr;
        ctx.strokeStyle = strokeColorStr;
        ctx.lineWidth = strokeWidth;

        // Use unified fillStrokeRoundRect
        ctx.fillStrokeRoundRect(geomX, geomY, finalRectWidth, finalRectHeight, radius);

        if (!isPerformanceRun) {
            logs.push(
                `AxAlignedRRect ${i + 1}: center=(${finalCenter.x.toFixed(1)},${finalCenter.y.toFixed(1)}), W/H=(${finalRectWidth},${finalRectHeight}), r=${radius}, sw=${strokeWidth.toFixed(1)}`
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
    'roundrect-m8-szMix-fSemi-sMix-swMix-lytSpread-cenMixPG-edgeCrisp-ornAxial-rrrMix',
    drawTest,
    'rounded-rects',
    {},
    {
        title: 'Axis-Aligned Rounded Rectangles (Multiple, Random Params)',
        description: 'Tests rendering of multiple axis-aligned rounded rectangles with random positions, sizes, strokes, fills, and corner radii.',
        perfName: 'Perf: 8 AxAlign RRects RandParams'
    }
);

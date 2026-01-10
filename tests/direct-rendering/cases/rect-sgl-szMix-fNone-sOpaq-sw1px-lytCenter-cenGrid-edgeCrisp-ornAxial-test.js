/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of a single, axis-aligned rectangle with a 1px opaque red stroke and no fill. The rectangle has randomized dimensions but is explicitly centered on a grid-line intersection and adjusted to ensure its edges are rendered crisply.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rectangles     | The test draws a rectangle using `ctx.strokeRect()`.
 * | Count                  | single         | The test is designed to draw one rectangle instance in its primary visual regression mode.
 * | SizeCategory           | mixed          | The rectangle's width and height are randomized in the range `[20, 149]`, spanning S, M, and L categories.
 * | FillStyle              | none           | No fill is applied; `fillStyle` is set to be fully transparent and `fillRect()` is not called.
 * | StrokeStyle            | opaque         | `strokeStyle` is set to an opaque color (`rgb(255,0,0)`).
 * | StrokeThickness        | 1px            | `lineWidth` is explicitly set to `1`.
 * | Layout                 | centered       | The rectangle is positioned relative to the center of the canvas.
 * | CenteredAt             | grid           | The center coordinates are calculated to be even integers, aligning with grid line intersections.
 * | EdgeAlignment          | crisp          | The test uses the `adjustDimensionsForCrispStrokeRendering()` helper function to ensure sharp edges.
 * | Orientation            | square         | The rectangle is axis-aligned with no rotation applied.
 * | ArcAngleExtent         | N/A            | Not applicable for a rectangle shape.
 * | RoundRectRadius        | N/A            | Not applicable for a non-rounded rectangle.
 * | ContextTranslation     | none           | `ctx.translate()` is not used.
 * | ContextRotation        | none           | `ctx.rotate()` is not used.
 * | ContextScaling         | none           | `ctx.scale()` is not used.
 * | Clipped on shape       | none           | No clipping path is defined or applied in the test.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The test requires the canvas dimensions to be even numbers for its centering logic to work correctly.
 * - The stroke color is fixed to an explicit, non-random opaque red.
 *
 */
/**
 * @fileoverview
 * Test definition for rendering a single, small-to-medium sized, 1px thick, red, opaque stroked rectangle
 * with no fill, centered at a grid crossing, and with no rotation.
 *
 * Guiding Principles for this draw function:
 * - Reproducibility: Uses SeededRandom for all random elements.
 * - Crispness: Adapts logic for centering and dimension adjustment for crisp 1px stroke.
 * - Checks: Returns extremes data for `withExtremesCheck`.
 * - Pre-conditions: Checks for even canvas dimensions.
 */

/**
 * Draws a single 1px red-stroked rectangle, centered at a grid crossing.
 *
 * @param {CanvasRenderingContext2D | CrispSwContext} ctx - The rendering context.
 * @param {number} iterationNumber - The current test iteration (used by RenderTest for seeding).
 * @param {?number} instances - Optional. If > 0, draws multiple instances for performance (not primary use here).
 * @returns {?{ logs: string[], checkData: {leftX: number, rightX: number, topY: number, bottomY: number} }}
 *          Log entries and expected pixel extremes, or null if in multi-instance mode.
 */
function drawTest(ctx, iterationNumber, instances) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    if (canvasWidth % 2 !== 0 || canvasHeight % 2 !== 0) {
        throw new Error("Canvas width and height must be even for this test (required by centering logic).");
    }

    const isPerformanceRun = instances !== null && instances > 0;
    const numIterations = 1; // Focus on one precise rectangle
    const numRectsToDraw = isPerformanceRun ? instances : 1;

    let logs = isPerformanceRun ? null : [];
    let checkData = null; // Only to be populated for the single, non-performance run instance

    // --- Base calculations for the archetype rectangle (using SeededRandom for reproducibility) ---
    // Logic adapted from placeCloseToCenterAtGrid
    const cXBase = Math.floor(canvasWidth / 2);
    const cYBase = Math.floor(canvasHeight / 2);
    const baseCenterX = (cXBase % 2 === 0) ? cXBase : cXBase + 1;
    const baseCenterY = (cYBase % 2 === 0) ? cYBase : cYBase + 1;

    // Base Rectangle Dimensions (random but seeded)
    let initialRectWidth = Math.floor(20 + SeededRandom.getRandom() * 130);
    let initialRectHeight = Math.floor(20 + SeededRandom.getRandom() * 130);

    // Use adjustDimensionsForCrispStrokeRendering for the archetype
    const { width: archetypeRectWidth, height: archetypeRectHeight } = adjustDimensionsForCrispStrokeRendering(
        initialRectWidth,
        initialRectHeight,
        1, // strokeWidth
        { x: baseCenterX, y: baseCenterY } // center coordinates
    );

    // Calculate top-left for the archetype rectangle (relative to its center)
    const archetypeX = baseCenterX - archetypeRectWidth / 2;
    const archetypeY = baseCenterY - archetypeRectHeight / 2;
    // --- End base calculations ---

    // Set drawing properties once (they are constant for all instances)
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(255,0,0)'; // Red, Opaque
    ctx.fillStyle = 'rgba(0,0,0,0)';   // Transparent fill

    for (let i = 0; i < numRectsToDraw; i++) {
        let currentX = archetypeX;
        let currentY = archetypeY;
        let currentCenterX = baseCenterX; // For logging, if needed for this instance
        let currentCenterY = baseCenterY;

        if (isPerformanceRun && i > 0) { // Apply random offsets for subsequent instances in perf mode
            // Max offset should keep the shape mostly within canvas. Simplified for this example.
            const maxOffsetX = canvasWidth - archetypeRectWidth - 10; // 10px buffer
            const minOffsetX = 10;
            const maxOffsetY = canvasHeight - archetypeRectHeight - 10;
            const minOffsetY = 10;

            // Use Math.random() for offsets in perf mode for speed, reproducibility of offsets isn't paramount here.
            const offsetX = Math.floor(Math.random() * (maxOffsetX - minOffsetX + 1)) + minOffsetX - archetypeX;
            const offsetY = Math.floor(Math.random() * (maxOffsetY - minOffsetY + 1)) + minOffsetY - archetypeY;

            currentX += offsetX;
            currentY += offsetY;
            currentCenterX += offsetX; // Keep track of the effective center for this instance if logging was active
            currentCenterY += offsetY;
        } else if (!isPerformanceRun) {
            // This is the single instance for visual regression and checkData calculation
            // Log and set checkData only for this one instance.
            logs.push(`&#x25A1; 1px Red Stroked Rectangle at (${currentX.toFixed(1)}, ${currentY.toFixed(1)}), size ${archetypeRectWidth}x${archetypeRectHeight}, centered at (${currentCenterX.toFixed(1)}, ${currentCenterY.toFixed(1)})`);

            checkData = {
                leftX: Math.floor(currentX),
                rightX: Math.floor(currentX + archetypeRectWidth),
                topY: Math.floor(currentY),
                bottomY: Math.floor(currentY + archetypeRectHeight)
            };
        }

        // --- Single Drawing Block ---
        ctx.strokeRect(currentX, currentY, archetypeRectWidth, archetypeRectHeight);
        // --- End Single Drawing Block ---
    }

    if (isPerformanceRun) return null;
    // For non-performance run, checkData and logs for the single drawn instance are returned
    return { logs, checkData };
}

// Register the test
registerDirectRenderingTest(
    'rect-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-cenGrid-edgeCrisp-ornAxial',
    drawTest,
    'rectangles',
    {
        extremes: true,
        stroke8Connectivity: { color: [255, 0, 0] },
        shapeIntegrity: true
    },
    {
        title: 'Rectangles: S-Size No-Fill 1px-Red-Opaque-Stroke Centered-At-Grid No-Rotation',
        description: 'Tests a single 1px red stroked rectangle, centered on grid lines, with even dimensions.',
        displayName: 'Perf: Rect S 1px Red Centered Grid'
    }
);

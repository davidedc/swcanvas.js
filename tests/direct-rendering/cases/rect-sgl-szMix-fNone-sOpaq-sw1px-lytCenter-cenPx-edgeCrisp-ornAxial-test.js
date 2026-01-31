/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of a single 1px red stroked rectangle with no fill. The rectangle is centered at a pixel center (X.5, Y.5 coordinates) and its dimensions are adjusted to ensure crisp rendering.
 *
 *
 * ---
 *
 * | Facet                      | Value          | Reason
 * |----------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category             | rectangles     | The test calls `ctx.strokeRect`, which draws rectangles.
 * | Count                      | single         | The test draws a single rectangle in its visual test mode (`instances` is null).
 * | SizeCategory               | mixed          | Rectangle dimensions are randomized in the range `[20, 149]`, which spans S, M, and L categories.
 * | FillStyle                  | none           | `ctx.fillStyle` is set to be fully transparent and `fillRect` is not called.
 * | StrokeStyle                | opaque         | `ctx.strokeStyle` is set to `rgb(255,0,0)`, which is fully opaque red.
 * | StrokeThickness            | 1px            | `ctx.lineWidth` is hardcoded to `1`.
 * | Layout                     | centered       | The rectangle's archetype is positioned relative to the canvas center.
 * | CenteredAt                 | pixel          | The center coordinates are calculated as `floor(dimension/2) + 0.5`, aligning them to pixel centers.
 * | EdgeAlignment              | crisp          | The test uses a pixel-centered position and calls `adjustDimensionsForCrispStrokeRendering`.
 * | Orientation                | square         | The test draws an axis-aligned rectangle with no rotation.
 * | ArcAngleExtent             | N/A            | This facet only applies to `arc` shapes.
 * | RoundRectRadius            | N/A            | This facet only applies to `rounded-rect` shapes.
 * | ContextTranslation         | none           | The test does not call `ctx.translate()`.
 * | ContextRotation            | none           | The test does not call `ctx.rotate()`.
 * | ContextScaling             | none           | The test does not call `ctx.scale()`.
 * | Clipped on shape           | none           | The test does not call `ctx.clip()`.
 * | Clipped on shape count     | n/a            | No clipping is applied.
 * | Clipped on shape arrangement | n/a          | No clipping is applied.
 * | Clipped on shape size      | n/a            | No clipping is applied.
 * | Clipped on shape edge alignment | n/a       | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - The original filename suggests 'S-size', but the implementation randomizes dimensions across S, M, and L categories, so SizeCategory is correctly 'mixed'.
 * - Stroke color is fixed to opaque red.
 */

/**
 * @fileoverview
 * Test definition for rendering a single, small-to-medium sized, 1px thick, red, opaque stroked rectangle
 * with no fill, centered at a pixel center (X.5, Y.5 coordinates), and with no rotation.
 *
 * Guiding Principles for this draw function:
 * - Reproducibility: Uses SeededRandom for all random elements.
 * - Crispness: Center coordinates are X.5, Y.5. `adjustDimensionsForCrispStrokeRendering` is used.
 * - Checks: Returns extremes data for `withExtremesCheck`.
 * - Pre-conditions: Checks for even canvas dimensions (as original test did).
 */

/**
 * Draws a single 1px red-stroked rectangle, centered at a pixel center.
 *
 * @param {CanvasRenderingContext2D | CrispSwContext} ctx - The rendering context.
 * @param {number} iterationNumber - The current test iteration (used by RenderTest for seeding).
 * @param {?number} instances - Optional. If > 0, draws multiple instances for performance.
 * @returns {?{ logs: string[], checkData: {leftX: number, rightX: number, topY: number, bottomY: number} }}
 *          Log entries and expected pixel extremes, or null if in multi-instance mode.
 */
function drawTest(ctx, iterationNumber, instances) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    if (canvasWidth % 2 !== 0 || canvasHeight % 2 !== 0) {
        throw new Error("Canvas width and height must be even for this test (original test implies this dependency for predictable centering).");
    }

    const isPerformanceRun = instances !== null && instances > 0;
    const numRectsToDraw = isPerformanceRun ? instances : 1;

    let logs = isPerformanceRun ? null : [];
    let checkData = null;

    // --- Base calculations for the archetype rectangle (using SeededRandom for reproducibility) ---
    // Center is at pixel center (X.5, Y.5)
    const baseCenterX = Math.floor(canvasWidth / 2) + 0.5;
    const baseCenterY = Math.floor(canvasHeight / 2) + 0.5;

    // Base Rectangle Dimensions (random but seeded)
    let initialRectWidth = Math.floor(20 + SeededRandom.getRandom() * 130);
    let initialRectHeight = Math.floor(20 + SeededRandom.getRandom() * 130);

    // Use adjustDimensionsForCrispStrokeRendering for the archetype.
    // For center at X.5, Y.5 and 1px stroke (odd), dimensions should be even.
    const { width: archetypeRectWidth, height: archetypeRectHeight } = adjustDimensionsForCrispStrokeRendering(
        initialRectWidth,
        initialRectHeight,
        1, // strokeWidth
        { x: baseCenterX, y: baseCenterY } // center coordinates are X.5, Y.5
    );

    // Calculate top-left for the archetype rectangle (relative to its center)
    // If baseCenterX is X.5 and archetypeRectWidth is even, then archetypeX will be Y.5
    const archetypeX = baseCenterX - archetypeRectWidth / 2;
    const archetypeY = baseCenterY - archetypeRectHeight / 2;
    // --- End base calculations ---

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(255,0,0)'; // Red, Opaque
    ctx.fillStyle = 'rgba(0,0,0,0)';   // Transparent fill

    for (let i = 0; i < numRectsToDraw; i++) {
        let currentX = archetypeX;
        let currentY = archetypeY;
        let currentLogCenterX = baseCenterX; // For logging the original intended center
        let currentLogCenterY = baseCenterY;

        if (isPerformanceRun && i > 0) {
            // For performance, place the archetype at random top-left *.5 coordinates
            // to cover the whole canvas while maintaining the pixel-alignment characteristic.
            currentX = Math.floor(Math.random() * (canvasWidth - archetypeRectWidth)) + 0.5;
            currentY = Math.floor(Math.random() * (canvasHeight - archetypeRectHeight)) + 0.5;

            // For logging, the *intended* conceptual center of the offset shape might shift
            // This logging part is usually skipped in perf runs anyway but shown for completeness if it were active.
            // currentLogCenterX = currentX + archetypeRectWidth / 2;
            // currentLogCenterY = currentY + archetypeRectHeight / 2;
        } else if (!isPerformanceRun) {
            logs.push(`&#x25A1; 1px Red Stroked Rectangle at (${currentX.toFixed(1)}, ${currentY.toFixed(1)}), size ${archetypeRectWidth}x${archetypeRectHeight}, centered at (${baseCenterX.toFixed(1)}, ${baseCenterY.toFixed(1)})`);

            // Use centralized utility for bounds calculation (single source of truth)
            checkData = calculateCrispStrokeRectBounds(currentX, currentY, archetypeRectWidth, archetypeRectHeight);
        }

        ctx.strokeRect(currentX, currentY, archetypeRectWidth, archetypeRectHeight);
    }

    if (isPerformanceRun) return null;
    return { logs, checkData };
}

// Register the test
registerDirectRenderingTest(
    'rect-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-cenPx-edgeCrisp-ornAxial',
    drawTest,
    'rectangles',
    {
        extremes: true,
        stroke8Connectivity: { color: [255, 0, 0] },
        shapeIntegrity: true
    },
    {
        title: 'Rectangles: S-Size No-Fill 1px-Red-Opaque-Stroke Centered-At-Pixel No-Rotation',
        description: 'Tests a single 1px red stroked rectangle, centered at pixel centers (X.5,Y.5), with adjusted even dimensions.',
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single axis-aligned rectangle with random dimensions, stroke width, and semi-transparent colors, mimicking original low-level logic including color generation.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rectangles         | The code uses `fillRect` and `strokeRect` to draw rectangles.
 * | Count                  | single             | In visual test mode, the `for` loop is explicitly broken after one iteration, drawing a single shape.
 * | SizeCategory           | mixed              | The rectangle's dimensions are randomized in a `[20, 120]` pixel range, which spans S, M, and L categories.
 * | FillStyle              | semitransparent    | The fill color alpha is randomized in `[100, 200]` (out of 255), which is always semi-transparent.
 * | StrokeStyle            | mixed              | The stroke color alpha is randomized in `[200, 255]`, so it can be either semi-transparent or fully opaque.
 * | StrokeThickness        | mixed              | The stroke width is randomized to be one of the even numbers `{2, 4, 6, 8, 10, 12}`.
 * | Layout                 | random             | The single shape's final position is determined by applying a random offset from the canvas center.
 * | CenteredAt             | mixed-pixel-grid   | The code explicitly randomizes the geometric center between integer (`grid`) and half-pixel (`pixel`) coordinates.
 * | EdgeAlignment          | crisp              | The code makes an explicit call to `adjustDimensionsForCrispStrokeRendering()` to ensure sharp edges.
 * | Orientation            | square             | The test draws an axis-aligned rectangle with no rotation.
 * | ArcAngleExtent         | N/A                | Not applicable to rectangles.
 * | RoundRectRadius        | N/A                | Not applicable to non-rounded rectangles.
 * | ContextTranslation     | none               | No call to `ctx.translate()`.
 * | ContextRotation        | none               | No call to `ctx.rotate()`.
 * | ContextScaling         | none               | No call to `ctx.scale()`.
 * | Clipped on shape       | none               | No clipping is performed.
 * | Clipped on shape count | n/a                | No clipping is performed.
 * | Clipped on shape arrangement | n/a          | No clipping is performed.
 * | Clipped on shape size  | n/a                | No clipping is performed.
 * | Clipped on shape edge alignment | n/a       | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * Fill is semi-transparent (alpha 100-200). Stroke is mixed opaque/semi (alpha 200-255). EdgeAlignment is crisp via helper function.
 * CenteredAt is mixed-pixel-grid. strokeWidth is even numbers in [2,12]. Rect dims [20,120] span S,M,L categories.
 * In performance mode, positions are fully random across the canvas, overriding the `random` (offset-based) layout.
 */
/**
 * @fileoverview
 * Test definition for rendering a single, medium-sized, axis-aligned rectangle.
 * This version aims to replicate the logic from the original low-level test's
 * addAxisAlignedRectangles, including its direct use of getRandomColor.
 *
 * Guiding Principles for this draw function:
 * - Reproducibility: Uses SeededRandom for all random elements of the archetype.
 * - Properties: Derived from adapted logic of placeRoundedRectWithFillAndStrokeBothCrisp and addAxisAlignedRectangles.
 * - Checks: Returns extremes data for `withExtremesCheck`.
 * - Performance: Draws multiple instances at random positions in performance mode.
 */

// SWCanvas: getRandomColor returns CSS strings directly

/**
 * Draws a single axis-aligned rectangle based on original low-level test logic, or multiple for performance.
 *
 * @param {CanvasRenderingContext2D | CrispSwContext} ctx - The rendering context.
 * @param {number} iterationNumber - The current test iteration.
 * @param {?number} instances - Optional. If > 0, draws multiple instances for performance.
 * @returns {?{ logs: string[], checkData: object }} 
 *          Log entries and data for checks, or null if in multi-instance mode.
 */
function drawTest(ctx, iterationNumber, instances) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 1;

    let logs = isPerformanceRun ? null : [];
    let checkData = null; 


    for (let i = 0; i < numToDraw; i++) {
        // --- Generate ALL properties for EACH rectangle instance using SeededRandom ---
        const maxStrokeWidthRand = 10; // Max stroke width for randomization, as per original logic source
        let currentStrokeWidth = Math.round(SeededRandom.getRandom() * maxStrokeWidthRand + 1);
        currentStrokeWidth = currentStrokeWidth % 2 === 0 ? currentStrokeWidth : currentStrokeWidth + 1;

        let currentCenter = { x: canvasWidth / 2, y: canvasHeight / 2 };
        if (SeededRandom.getRandom() < 0.5) { // Randomize if center is on grid or pixel center
            currentCenter = { x: currentCenter.x + 0.5, y: currentCenter.y + 0.5 };
        }

        // M-size: 20-120px, as per performance test guidelines
        const minDimM = 20;
        const maxDimM = 120;
        let currentInitialRectWidth = Math.floor(minDimM + SeededRandom.getRandom() * (maxDimM - minDimM + 1));
        let currentInitialRectHeight = Math.floor(minDimM + SeededRandom.getRandom() * (maxDimM - minDimM + 1));

        const { 
            width: currentDrawWidth, 
            height: currentDrawHeight 
        } = adjustDimensionsForCrispStrokeRendering(currentInitialRectWidth, currentInitialRectHeight, currentStrokeWidth, currentCenter);

        // Apply random offsets to this instance's calculated center
        const xOffset = Math.floor(SeededRandom.getRandom() * 100) - 50;
        const yOffset = Math.floor(SeededRandom.getRandom() * 100) - 50;
        currentCenter.x += xOffset;
        currentCenter.y += yOffset;

        // Standardized colors: semi-transparent blue fill, mixed (50/50) red stroke
        const currentFillColor = 'rgba(0, 0, 255, 0.49)';
        const strokeIsOpaque = SeededRandom.getRandom() < 0.5;
        const currentStrokeColor = strokeIsOpaque ? 'rgb(255, 0, 0)' : 'rgba(255, 0, 0, 0.49)';
        // --- End property generation for this instance ---

        let finalDrawX = currentCenter.x - currentDrawWidth / 2;
        let finalDrawY = currentCenter.y - currentDrawHeight / 2;
        let centerForLog = { ...currentCenter };

        if (isPerformanceRun) {
            // Apply an additional large random offset for spread, using Math.random()
            // This offset is applied to the already SeededRandom-derived position of the rect's center
            finalDrawX = Math.floor(Math.random() * (canvasWidth - currentDrawWidth));
            finalDrawY = Math.floor(Math.random() * (canvasHeight - currentDrawHeight));
            // Update centerForLog if it were to be used in perf logs (not typical)
            centerForLog.x = finalDrawX + currentDrawWidth / 2;
            centerForLog.y = finalDrawY + currentDrawHeight / 2;
        }

        ctx.fillStyle = currentFillColor;
        ctx.fillRect(finalDrawX, finalDrawY, currentDrawWidth, currentDrawHeight);

        ctx.strokeStyle = currentStrokeColor;
        ctx.lineWidth = currentStrokeWidth;
        ctx.strokeRect(finalDrawX, finalDrawY, currentDrawWidth, currentDrawHeight);

        if (!isPerformanceRun) { // This will only be true for the first (and only) iteration when not in perf mode
            logs.push(`Drew Axis-Aligned Rectangle at (${finalDrawX.toFixed(1)},${finalDrawY.toFixed(1)}), size ${currentDrawWidth}x${currentDrawHeight}, stroke: ${currentStrokeWidth}px, center: (${centerForLog.x.toFixed(1)}, ${centerForLog.y.toFixed(1)}), fill: ${currentFillColor}, stroke: ${currentStrokeColor}`);
            
            const sw = currentStrokeWidth; 
            checkData = {
                leftX: finalDrawX - sw / 2,
                rightX: finalDrawX + currentDrawWidth + sw / 2 - 1, 
                topY: finalDrawY - sw / 2,
                bottomY: finalDrawY + currentDrawHeight + sw / 2 - 1  
            };
            // For non-performance mode, we only want one rectangle as per original test intent
            break; 
        }
    }

    if (isPerformanceRun && numToDraw > 0 && logs && logs.length > 0) {
      // Clear logs if it was a performance run with actual drawing, as per-instance logs are too verbose.
      // This condition is a bit defensive; logs should ideally be null from the start for perf runs.
      logs = null;
    }

    // If it wasn't a performance run, logs and checkData for the single drawn instance are returned.
    // If it was a performance run, logs would be null.
    return (logs || checkData) ? { logs, checkData } : null; 
}

// Register the test
registerDirectRenderingTest(
    'rect-sgl-szMix-fSemi-sMix-swMix-lytRand-cenMixPG-edgeCrisp-ornAxial-test',
    drawTest,
    'rectangles',
    {
        extremes: true,
        shapeIntegrity: true,
        allowPathBasedRendering: true // rect FILLS are generic since the fill-arm removal (DIRECT-RENDERING-SUMMARY.MD §9 entries 15-16); strokes stay direct
    },
    {
        title: 'Rectangles: M-Size Semi-Transparent Fill, Random Semi-Transparent Stroke, Random Position, No Rotation',
        description: 'Tests a single axis-aligned rectangle with random dimensions, stroke width, and semi-transparent colors, mimicking original low-level logic including color generation.',
    }
); 

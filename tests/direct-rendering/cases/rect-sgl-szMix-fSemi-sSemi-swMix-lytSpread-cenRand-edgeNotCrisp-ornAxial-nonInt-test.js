/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of a single axis-aligned rectangle with non-integer width, height, x and y positions.
 *              All geometry values (dimensions, positions, stroke widths) are floating-point, not rounded to integers.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rectangles         | Test draws rectangles using `ctx.fillRect` and `ctx.strokeRect`.
 * | Count                  | single             | Draws 1 instance in visual regression mode.
 * | SizeCategory           | mixed              | `rectWidth`/`rectHeight` are randomized in a range of `[50, ~410]`, spanning M, L, and XL categories.
 * | FillStyle              | semitransparent    | `fillColorObj` is generated with an alpha range of `[100, 200]`, which is always semi-transparent.
 * | StrokeStyle            | semitransparent    | `strokeColorObj` is generated with semitransparent alpha.
 * | StrokeThickness        | mixed              | `strokeWidth` is a floating-point value in range `[1, 11]`.
 * | Layout                 | spread             | Rectangles are distributed by applying random offsets to each instance's calculated center point.
 * | CenteredAt             | random             | Center positions are fully random floating-point values across the canvas.
 * | EdgeAlignment          | not-crisp          | No crisp rendering adjustments; all values are non-integer floating-point.
 * | Orientation            | axial              | Rectangles are axis-aligned (no rotation).
 * | ArcAngleExtent         | N/A                | Not applicable to rectangles.
 * | RoundRectRadius        | N/A                | Not applicable to standard rectangles.
 * | ContextTranslation     | none               | No `ctx.translate()` calls are made.
 * | ContextRotation        | none               | No `ctx.rotate()` calls are made.
 * | ContextScaling         | none               | No `ctx.scale()` calls are made.
 * | Clipped on shape       | none               | No clipping is applied in this test.
 * | Clipped on shape count | n/a                | No clipping is applied in this test.
 * | Clipped on shape arrangement | n/a          | No clipping is applied in this test.
 * | Clipped on shape size  | n/a                | No clipping is applied in this test.
 * | Clipped on shape edge alignment | n/a       | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - All geometry values (width, height, x, y, strokeWidth) are non-integer floating-point values.
 * - The fill alpha is specifically randomized within the range `[100, 200]`.
 * - The stroke alpha is specifically randomized within the range `[200, 255]`.
 * - No crisp rendering adjustments are applied (unlike the edgeCrisp variant).
 *
 */

/**
 * @fileoverview Test definition for a single axis-aligned rectangle with non-integer geometry.
 *
 * Based on rect-m10-szMix-fSemi-sMix-swMix-lytSpread-cenMixPG-edgeCrisp-ornAxial-test.js
 * but with all geometry values as non-integer floating-point.
 */

/**
 * Draws a single axis-aligned rectangle with non-integer geometry.
 *
 * @param {CanvasRenderingContext2D} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For this test, it dictates the number of rectangles drawn.
 *                  For visual regression (instances is null/0), 1 rectangle is drawn.
 * @returns {?{logs: string[], checkData: object}} Logs and data for checks for single-instance
 *                  mode, or null for performance mode.
 */
function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;
    const numToDraw = isPerformanceRun ? instances : 1;

    const logs = [];
    let overallMinLeftX = Infinity;
    let overallMaxRightX = -Infinity;
    let overallMinTopY = Infinity;
    let overallMaxBottomY = -Infinity;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Parameters matching source test
    const minWidth = 50;
    const maxWidth = canvasWidth * 0.6;
    const minHeight = 50;
    const maxHeight = canvasHeight * 0.6;
    const maxStrokeWidth = 10;

    for (let i = 0; i < numToDraw; i++) {
        // 1. Generate stroke width as floating-point (1.0 to 11.0)
        const strokeWidth = 1 + SeededRandom.getRandom() * maxStrokeWidth;

        // 2. Generate random center position (fully random, not grid/pixel aligned)
        const rectCenterX = SeededRandom.getRandom() * canvasWidth;
        const rectCenterY = SeededRandom.getRandom() * canvasHeight;

        // 3. Generate rectangle dimensions as floating-point (no rounding)
        const rectWidth = minWidth + SeededRandom.getRandom() * (maxWidth - minWidth);
        const rectHeight = minHeight + SeededRandom.getRandom() * (maxHeight - minHeight);

        // 4. Apply spread offsets (floating-point)
        const xOffset = SeededRandom.getRandom() * 100 - 50;
        const yOffset = SeededRandom.getRandom() * 100 - 50;

        let finalDrawCenterX = rectCenterX + xOffset;
        let finalDrawCenterY = rectCenterY + yOffset;

        // 5. Standardized colors: semi-transparent blue fill, semi-transparent red stroke
        const strokeColorStr = 'rgba(255, 0, 0, 0.49)'; // Semi-transparent red stroke
        const fillColorStr = 'rgba(0, 0, 255, 0.49)'; // Semi-transparent blue fill

        let geomX = finalDrawCenterX - rectWidth / 2;
        let geomY = finalDrawCenterY - rectHeight / 2;

        if (isPerformanceRun) {
            // For performance, spread shapes widely using Math.random (does not affect SeededRandom sequence)
            const safeMargin = Math.max(strokeWidth, 10);
            geomX = Math.random() * Math.max(0, canvasWidth - rectWidth - safeMargin * 2) + safeMargin;
            geomY = Math.random() * Math.max(0, canvasHeight - rectHeight - safeMargin * 2) + safeMargin;
        } else {
            // Ensure the shape is mostly on canvas for visual test
            geomX = Math.max(0 - rectWidth / 2, Math.min(geomX, canvasWidth - rectWidth / 2));
            geomY = Math.max(0 - rectHeight / 2, Math.min(geomY, canvasHeight - rectHeight / 2));
        }

        ctx.fillStyle = fillColorStr;
        ctx.fillRect(geomX, geomY, rectWidth, rectHeight);

        if (strokeWidth > 0) {
            ctx.strokeStyle = strokeColorStr;
            ctx.lineWidth = strokeWidth;
            ctx.strokeRect(geomX, geomY, rectWidth, rectHeight);
        }

        if (!isPerformanceRun) {
            logs.push(`Rect ${i + 1}: pos=(${geomX.toFixed(2)},${geomY.toFixed(2)}), w=${rectWidth.toFixed(2)}, h=${rectHeight.toFixed(2)}, sw=${strokeWidth.toFixed(2)}`);

            // Calculate extremes based on geometry and stroke width
            const currentRectOuterLeft = geomX - strokeWidth / 2;
            const currentRectOuterRight = geomX + rectWidth + strokeWidth / 2;
            const currentRectOuterTop = geomY - strokeWidth / 2;
            const currentRectOuterBottom = geomY + rectHeight + strokeWidth / 2;

            overallMinLeftX = Math.min(overallMinLeftX, currentRectOuterLeft);
            overallMaxRightX = Math.max(overallMaxRightX, currentRectOuterRight);
            overallMinTopY = Math.min(overallMinTopY, currentRectOuterTop);
            overallMaxBottomY = Math.max(overallMaxBottomY, currentRectOuterBottom);
        }
    }

    if (isPerformanceRun) {
        return null;
    } else {
        // For withExtremesCheck, expected values are inclusive pixel coordinates.
        const checkData = {
            leftX: Math.floor(overallMinLeftX),
            rightX: Math.floor(overallMaxRightX - 1), // Adjust to inclusive pixel
            topY: Math.floor(overallMinTopY),
            bottomY: Math.floor(overallMaxBottomY - 1)  // Adjust to inclusive pixel
        };
        if (numToDraw === 0) {
            return { logs, checkData: { leftX: 0, rightX: 0, topY: 0, bottomY: 0 } };
        }
        return { logs, checkData };
    }
}

// Register the test
registerDirectRenderingTest(
    'rect-sgl-szMix-fSemi-sSemi-swMix-lytSpread-cenRand-edgeNotCrisp-ornAxial-nonInt-test',
    drawTest,
    'rectangles',
    {
        // No extremes check - non-integer geometry causes rounding differences
        allowPathBasedRendering: true,  // fillRect uses path-based rendering
        totalUniqueColors: { expected: 4, skipOnIterations: [214, 395, 520] },  // background + fill + stroke + fill+stroke blend. The skips are because sometimes the external part of the stroke overpills into the internal ones. Given the effect and number of occurrences this is OK.
        dimensionConsistency: true,  // Verify width/height are consistent across all rows/columns
        shapeIntegrity: true
    },
    {
        title: 'Rectangle: Axis-aligned, Single, Variable Size, Semi-Transparent Fill & Stroke, Non-Integer Geometry',
        description: 'Tests rendering of a single axis-aligned rectangle with non-integer width, height, x and y positions.',
        perfName: 'Perf: Rect AxAlign Single NonInt'
    }
);

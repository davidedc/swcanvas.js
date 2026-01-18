/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests crisp rendering of a single 1px red stroked rounded rectangle, centered at a grid crossing.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws rounded rectangles.
 * | Count                  | single         | The test draws a single shape instance.
 * | SizeCategory           | mixed          | The base width/height are randomized in [20, 149], which spans S, M, and L size categories.
 * | FillStyle              | none           | The fill color is set to be fully transparent ('rgba(0,0,0,0)').
 * | StrokeStyle            | opaque         | The stroke color is explicitly set to be fully opaque ('rgba(255,0,0,1)').
 * | StrokeThickness        | 1px            | The lineWidth is explicitly set to 1.
 * | Layout                 | centered       | The shape is drawn relative to the canvas center.
 * | CenteredAt             | grid           | The center point is calculated using Math.floor(), resulting in integer coordinates.
 * | EdgeAlignment          | crisp          | The test uses the adjustDimensionsForCrispStrokeRendering() helper to ensure crisp edges.
 * | Orientation            | square         | The shape is drawn with its sides parallel to the canvas axes (axis-aligned).
 * | ArcAngleExtent         | N/A            | This facet is not applicable to rectangles.
 * | RoundRectRadius        | randomized     | The corner radius is randomized using SeededRandom.getRandom().
 * | ContextTranslation     | none           | The test does not use ctx.translate().
 * | ContextRotation        | none           | The test does not use ctx.rotate().
 * | ContextScaling         | none           | The test does not use ctx.scale().
 * | Clipped on shape       | none           | The test does not use clipping.
 * | Clipped on shape count | n/a            | N/A because no clipping is used.
 * | Clipped on shape arrangement | n/a      | N/A because no clipping is used.
 * | Clipped on shape size  | n/a            | N/A because no clipping is used.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * Stroke color is fixed opaque red. It is axis-aligned. Rectangle dimensions are randomized in the range [20, 149], spanning S, M, and L size categories.
 */

/**
 * @fileoverview Test definition for a single 1px stroked rounded rectangle centered at a grid point.
 */

/**
 * Draws a single 1px stroked rounded rectangle, centered at a grid point.
 *
 * @param {CanvasRenderingContext2D | CrispSwContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @returns {{logs: string[], checkData: object}} Logs and data for checks.
 */
function drawTest(ctx, iterationNumber) {
    const logs = [];
    let checkData = null;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Pre-condition check from original test
    if (canvasWidth % 2 !== 0 || canvasHeight % 2 !== 0) {
        logs.push('Warning: Canvas dimensions are not even. Crisp grid-centered rendering might be affected.');
    }

    // Determine center point (integer coordinates for grid centering)
    const centerX = Math.floor(canvasWidth / 2);
    const centerY = Math.floor(canvasHeight / 2);

    // SeededRandom Call 1: rectWidth base
    const baseRectWidth = Math.floor(20 + SeededRandom.getRandom() * 130);
    // SeededRandom Call 2: rectHeight base
    const baseRectHeight = Math.floor(20 + SeededRandom.getRandom() * 130);

    // Adjust dimensions for a 1px stroke centered at the grid point
    const adjusted = adjustDimensionsForCrispStrokeRendering(baseRectWidth, baseRectHeight, 1, { x: centerX, y: centerY });
    const finalRectWidth = adjusted.width;
    const finalRectHeight = adjusted.height;

    // SeededRandom Call 3: radius
    const radius = Math.round(SeededRandom.getRandom() * Math.min(finalRectWidth, finalRectHeight) * 0.2);

    const strokeColorStr = 'rgba(255,0,0,1)'; // Red, Opaque
    const fillColorStr = 'rgba(0,0,0,0)';   // Transparent

    const geomX = centerX - finalRectWidth / 2;
    const geomY = centerY - finalRectHeight / 2;

    ctx.fillStyle = fillColorStr;
    ctx.strokeStyle = strokeColorStr;
    ctx.lineWidth = 1;

    // Use direct rendering
    ctx.strokeRoundRect(geomX, geomY, finalRectWidth, finalRectHeight, radius);

    logs.push(`RoundedRect: center=(${centerX},${centerY}), base W/H=(${baseRectWidth},${baseRectHeight}), adj W/H=(${finalRectWidth},${finalRectHeight}), r=${radius}`);

    checkData = {
        leftX: Math.floor(geomX),
        rightX: Math.floor(geomX + finalRectWidth),
        topY: Math.floor(geomY),
        bottomY: Math.floor(geomY + finalRectHeight)
    };

    return { logs, checkData };
}

// Register the test
registerDirectRenderingTest(
    'roundrect-sgl-szMix-fNone-sOpaq-sw1px-lytCenter-cenGrid-edgeCrisp-ornAxial-rrrRand',
    drawTest,
    'rounded-rects',
    {
        extremes: true,
        stroke8Connectivity: { color: [255, 0, 0] },
        shapeIntegrity: true
    },
    {
        title: 'Single 1px Stroked Rounded Rectangle (Crisp, Centered at Grid)',
        description: 'Tests crisp rendering of a single 1px red stroked rounded rectangle, centered at a grid crossing.',
    }
);

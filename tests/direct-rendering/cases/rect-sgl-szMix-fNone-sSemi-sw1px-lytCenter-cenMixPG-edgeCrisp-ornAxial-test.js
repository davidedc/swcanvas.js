/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests crisp rendering of a single 1px semi-transparent red stroked rectangle with no fill, centered on canvas with independently randomized X/Y centering (pixel or grid).
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rectangles     | The test draws a rectangle using ctx.strokeRect().
 * | Count                  | single         | The test draws one rectangle instance.
 * | SizeCategory           | mixed          | Width/height randomized in [20, 149], spanning S, M, L categories.
 * | FillStyle              | none           | No fill is applied.
 * | StrokeStyle            | semi-transparent | Stroke color is rgba(255, 0, 0, 0.5) with 50% alpha.
 * | StrokeThickness        | 1px            | lineWidth is set to 1.
 * | Layout                 | centered       | Rectangle is positioned relative to canvas center.
 * | CenteredAt             | mixed P/G      | X and Y centering independently randomized (50% pixel, 50% grid).
 * | EdgeAlignment          | crisp          | Uses ensureHalfPoint() to ensure x,y at .5 for crisp 1px strokes.
 * | Orientation            | axial          | Rectangle is axis-aligned.
 * | ArcAngleExtent         | N/A            | Not applicable to rectangles.
 * | RoundRectRadius        | N/A            | Not applicable to non-rounded rectangles.
 * | ContextTranslation     | none           | The test does not use ctx.translate().
 * | ContextRotation        | none           | The test does not use ctx.rotate().
 * | ContextScaling         | none           | The test does not use ctx.scale().
 * | Clipped on shape       | none           | The test does not apply any clipping.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - Stroke color is fixed semi-transparent red (rgba(255, 0, 0, 0.5)).
 * - Tests direct RectOps.stroke1pxAlpha() rendering path.
 *
 */

registerDirectRenderingTest(
    'rect-sgl-szMix-fNone-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp-ornAxial',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Random integer dimensions (20-149px spans S, M, L sizes)
        const width = Math.floor(20 + SeededRandom.getRandom() * 130);
        const height = Math.floor(20 + SeededRandom.getRandom() * 130);

        // Generate varying center positions (for test variation)
        const centerX = Math.floor(canvasWidth / 2) + (SeededRandom.getRandom() < 0.5 ? 0.5 : 0);
        const centerY = Math.floor(canvasHeight / 2) + (SeededRandom.getRandom() < 0.5 ? 0.5 : 0);

        // Ensure x,y are at .5 for crisp 1px strokes
        const x = ensureHalfPoint(centerX - width / 2);
        const y = ensureHalfPoint(centerY - height / 2);

        // Semi-transparent stroke color (uses direct rendering with alpha blending)
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 1;

        ctx.strokeRect(x, y, width, height);

        return {
            logs: [`Semi-transparent 1px stroked rect at (${x}, ${y}) size ${width}x${height}`],
            checkData: calculateRectangleBounds(x, y, width, height, 1)
        };
    },
    'rectangles',
    {
        extremes: true,
        totalUniqueColors: 2,  // White background + one blended color (no overdraw at corners)
        shapeIntegrity: true,
        stroke8Connectivity: { color: [255, 128, 128], tolerance: 10 }
    },
    {
        title: 'Single 1px Semi-Transparent Stroked Rectangle (Crisp, Mixed P/G Centering)',
        description: 'Tests crisp rendering of a single 1px semi-transparent red stroked rectangle with no fill.',
    }
);

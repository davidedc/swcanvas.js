/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests crisp rendering of a single opaque blue filled rounded rectangle with no stroke, centered on canvas with independently randomized X/Y centering (pixel or grid).
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws a rounded rectangle using ctx.fillRoundRect().
 * | Count                  | single         | The test draws one rounded rectangle instance.
 * | SizeCategory           | mixed          | Width/height randomized in [40, 149], spanning S, M, L categories.
 * | FillStyle              | opaque         | Fill color is rgb(0, 0, 255), fully opaque.
 * | StrokeStyle            | none           | No stroke is applied.
 * | StrokeThickness        | N/A            | No stroke applied.
 * | Layout                 | centered       | Shape is positioned relative to canvas center.
 * | CenteredAt             | mixed P/G      | X and Y centering independently randomized (50% pixel, 50% grid).
 * | EdgeAlignment          | crisp          | Dimensions adjusted based on center type for crisp fill edges.
 * | Orientation            | axial          | Rectangle is axis-aligned.
 * | ArcAngleExtent         | N/A            | Not applicable to rectangles.
 * | RoundRectRadius        | randomized     | Corner radius is randomized (5-30% of smaller dimension).
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
 * - Fill color is fixed opaque blue (rgb(0, 0, 255)).
 * - Tests direct RoundedRectOps.fillOpaque() rendering path.
 * - Dimension parity adjusted: pixel center needs ODD width, grid center needs EVEN width.
 *
 */

registerDirectRenderingTest(
    'roundrect-sgl-szMix-fOpaq-sNone-lytCenter-cenMixPG-edgeCrisp-ornAxial-rrrRand',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Independently choose grid vs pixel centering for X and Y (50/50 each)
        const atPixelX = SeededRandom.getRandom() < 0.5;
        const atPixelY = SeededRandom.getRandom() < 0.5;

        const centerX = atPixelX
            ? Math.floor(canvasWidth / 2) + 0.5
            : Math.floor(canvasWidth / 2);
        const centerY = atPixelY
            ? Math.floor(canvasHeight / 2) + 0.5
            : Math.floor(canvasHeight / 2);

        // Random dimensions (40-149px spans S, M, L sizes)
        let rectWidth = Math.floor(40 + SeededRandom.getRandom() * 110);
        let rectHeight = Math.floor(40 + SeededRandom.getRandom() * 110);

        // Adjust dimensions for crisp fill edges:
        // For fills, x = centerX - width/2 must be integer
        // If centerX is .5 (pixel), width must be ODD → x = N.5 - odd/2 = integer
        // If centerX is integer (grid), width must be EVEN → x = N - even/2 = integer
        if (atPixelX) {
            if (rectWidth % 2 === 0) rectWidth++;  // Make odd for pixel center
        } else {
            if (rectWidth % 2 !== 0) rectWidth++;  // Make even for grid center
        }
        if (atPixelY) {
            if (rectHeight % 2 === 0) rectHeight++;  // Make odd for pixel center
        } else {
            if (rectHeight % 2 !== 0) rectHeight++;  // Make even for grid center
        }

        // Random corner radius (proportional to size, 5-30% of smaller dimension)
        const maxRadius = Math.min(rectWidth, rectHeight) * 0.3;
        const radius = Math.floor(5 + SeededRandom.getRandom() * (maxRadius - 5));

        const x = centerX - rectWidth / 2;
        const y = centerY - rectHeight / 2;

        // Opaque fill color (uses direct rendering)
        ctx.fillStyle = 'rgb(0, 0, 255)';

        // Use direct rendering method
        ctx.fillRoundRect(x, y, rectWidth, rectHeight, radius);

        return {
            logs: [`Opaque filled rounded rect at (${x}, ${y}) size ${rectWidth}x${rectHeight}, radius=${radius}, atPixelX=${atPixelX}, atPixelY=${atPixelY}`],
            checkData: {
                topY: y,
                bottomY: y + rectHeight - 1,
                leftX: x,
                rightX: x + rectWidth - 1
            }
        };
    },
    'rounded-rects',
    {
        extremes: true,
        totalUniqueColors: 2,  // White background + opaque blue
        shapeIntegrity: { hasFill: true, hasStroke: false }
    },
    {
        title: 'Single Opaque Filled Rounded Rectangle (Crisp, Mixed P/G Centering)',
        description: 'Tests crisp rendering of a single opaque blue filled rounded rectangle with no stroke.',
        displayName: 'Perf: RRect Opaque Fill Crisp MixPG'
    }
);

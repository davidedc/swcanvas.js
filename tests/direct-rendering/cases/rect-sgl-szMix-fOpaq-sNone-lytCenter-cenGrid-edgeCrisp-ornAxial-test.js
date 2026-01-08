/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests fillRect with opaque color rendering.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rectangles     | The test draws rectangles using ctx.fillRect().
 * | Count                  | single         | The test draws one rectangle in visual mode.
 * | SizeCategory           | mixed          | Width 50-150px, height 50-130px, spanning M (40-79) and L (80-159) categories.
 * | FillStyle              | opaque         | Fill color is 'rgb(0, 0, 255)' with full opacity.
 * | StrokeStyle            | none           | No stroke operation is performed.
 * | StrokeThickness        | N/A            | Not applicable as there is no stroke.
 * | Layout                 | centered       | The rectangle is positioned at the canvas center.
 * | CenteredAt             | grid           | Center calculated using Math.floor, resulting in integer coordinates.
 * | EdgeAlignment          | crisp          | Integer coordinates used for position.
 * | Orientation            | axial          | Rectangle is axis-aligned (not rotated).
 * | ArcAngleExtent         | N/A            | Not applicable to rectangle shapes.
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
 * - Fill color is fixed opaque blue (rgb(0, 0, 255)).
 * - Supports dual-mode: visual testing (instances=null) and performance testing (instances>0).
 * - Uses rasterizer path, not direct shape API.
 *
 */

registerDirectRenderingTest(
    'rect-sgl-szMix-fOpaq-sNone-lytCenter-cenGrid-edgeCrisp-ornAxial',
    function drawTest(ctx, iterationNumber, instances = null) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        const isPerformanceRun = instances !== null && instances > 0;
        const numToDraw = isPerformanceRun ? instances : 1;

        let logs = [];
        let checkData = null;

        for (let i = 0; i < numToDraw; i++) {
            // Use opaque blue fill color (standardized)
            ctx.fillStyle = 'rgb(0, 0, 255)';

            let rectWidth, rectHeight, x, y;

            if (isPerformanceRun && i > 0) {
                // Random dimensions and position for performance mode (spread shapes)
                rectWidth = 50 + Math.floor(Math.random() * 100);
                rectHeight = 50 + Math.floor(Math.random() * 80);
                x = Math.floor(Math.random() * Math.max(1, canvasWidth - rectWidth));
                y = Math.floor(Math.random() * Math.max(1, canvasHeight - rectHeight));
            } else {
                // Calculate rect parameters for visual test or first perf instance
                rectWidth = 50 + Math.floor(SeededRandom.getRandom() * 100);
                rectHeight = 50 + Math.floor(SeededRandom.getRandom() * 80);
                x = Math.floor((canvasWidth - rectWidth) / 2);
                y = Math.floor((canvasHeight - rectHeight) / 2);
            }

            // Draw filled rect
            ctx.fillRect(x, y, rectWidth, rectHeight);

            // Only collect logs and checkData for visual test mode
            if (!isPerformanceRun && i === 0) {
                logs.push(`Rect at (${x}, ${y}) size ${rectWidth}x${rectHeight}`);
                checkData = {
                    topY: y,
                    bottomY: y + rectHeight - 1,
                    leftX: x,
                    rightX: x + rectWidth - 1
                };
            }
        }

        // Return null for performance runs, object for visual tests
        if (isPerformanceRun) {
            return null;
        }
        return { logs, checkData };
    },
    'rects',
    {
        extremes: true,
        totalUniqueColors: 2
    },
    {
        title: 'Filled Rectangle - Opaque Color',
        description: 'Tests fillRect with opaque color',
        displayName: 'Perf: Rect Fill Opaque'
    }
);

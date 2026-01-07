/**
 * Test: Filled Rectangle with Opaque Color
 *
 * Tests that fillRect with an opaque color works correctly.
 * Note: fillRect uses the rasterizer path, not direct shape API,
 * but should still be performant.
 *
 * Supports dual-mode: visual testing (instances=null) and performance testing (instances>0).
 */

registerDirectRenderingTest(
    'rect-fill-opaque',
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

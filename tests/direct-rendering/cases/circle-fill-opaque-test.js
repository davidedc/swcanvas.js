/**
 * Test: Filled Circle with Opaque Color (Direct Rendering)
 *
 * Tests that fillCircle with an opaque color uses direct rendering
 * (32-bit packed writes, no path system).
 *
 * Supports dual-mode: visual testing (instances=null) and performance testing (instances>0).
 */

registerDirectRenderingTest(
    'circle-fill-opaque',
    function drawTest(ctx, iterationNumber, instances = null) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        const isPerformanceRun = instances !== null && instances > 0;
        const numToDraw = isPerformanceRun ? instances : 1;

        let logs = [];
        let checkData = null;

        for (let i = 0; i < numToDraw; i++) {
            // Use opaque fill color (required for direct rendering)
            const fillColor = 'rgb(0, 0, 255)';

            let centerX, centerY, radius;

            if (isPerformanceRun && i > 0) {
                // Random position for performance mode (spread shapes)
                radius = 30 + Math.random() * 50;
                centerX = radius + Math.random() * (canvasWidth - 2 * radius);
                centerY = radius + Math.random() * (canvasHeight - 2 * radius);
            } else {
                // Calculate circle parameters for visual test or first perf instance
                const params = calculateCircleTestParameters({
                    canvasWidth,
                    canvasHeight,
                    minRadius: 30,
                    maxRadius: 80,
                    hasStroke: false,
                    randomPosition: false
                });
                centerX = params.centerX;
                centerY = params.centerY;
                radius = params.radius;
            }

            // Draw filled circle using direct shape API
            ctx.fillStyle = fillColor;
            ctx.fillCircle(centerX, centerY, radius);

            // Only collect logs and checkData for visual test mode
            if (!isPerformanceRun && i === 0) {
                logs.push(`Circle at (${centerX}, ${centerY}) radius ${radius} color ${fillColor}`);
                checkData = {
                    topY: Math.floor(centerY - radius),
                    bottomY: Math.floor(centerY + radius),
                    leftX: Math.floor(centerX - radius),
                    rightX: Math.floor(centerX + radius)
                };
            }
        }

        // Return null for performance runs, object for visual tests
        if (isPerformanceRun) {
            return null;
        }
        return { logs, checkData };
    },
    'circles',
    {
        extremes: { colorTolerance: 8, tolerance: 0.05 },
        totalUniqueColors: 2, // background + fill
        // Direct rendering is expected - no allowPathBasedRendering flag
    },
    {
        title: 'Filled Circle - Opaque Color (Direct Rendering)',
        description: 'Tests fillCircle with opaque color uses direct 32-bit writes',
        displayName: 'Perf: Circle Fill Opaque'
    }
);

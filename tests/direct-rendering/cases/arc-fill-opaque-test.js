/**
 * Test: Filled Arc with Opaque Color (Direct Rendering)
 *
 * Tests that fillArc with an opaque color uses direct rendering
 * (32-bit packed writes, no path system).
 * Arc extends > 270 degrees with gap < 90 degrees within a single quadrant.
 */

registerDirectRenderingTest(
    'arc-fill-opaque',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use opaque blue fill color (required for direct rendering)
        const fillColor = 'rgb(0, 0, 255)';

        // Calculate arc parameters
        const params = calculateArcTestParameters({
            canvasWidth,
            canvasHeight,
            minRadius: 30,
            maxRadius: 80,
            hasStroke: false,
            randomPosition: false
        });

        const { centerX, centerY, radius, startAngle, endAngle, gapSizeDeg } = params;

        // Draw filled arc using direct shape API
        ctx.fillStyle = fillColor;
        ctx.fillArc(centerX, centerY, radius, startAngle, endAngle);

        // Return check data
        return {
            logs: [`Arc at (${centerX}, ${centerY}) radius ${radius} gap ${gapSizeDeg.toFixed(1)}° color ${fillColor}`],
            checkData: {
                topY: Math.floor(centerY - radius),
                bottomY: Math.floor(centerY + radius),
                leftX: Math.floor(centerX - radius),
                rightX: Math.floor(centerX + radius)
            }
        };
    },
    'arcs',
    {
        extremes: { colorTolerance: 36, tolerance: 0.03, skipOnIterations: [228, 488] },
        totalUniqueColors: 2, // background + fill
        // Direct rendering is expected - no allowPathBasedRendering flag
    },
    {
        title: 'Filled Arc - Opaque Color (Direct Rendering)',
        description: 'Tests fillArc with opaque color uses direct 32-bit writes'
    }
);

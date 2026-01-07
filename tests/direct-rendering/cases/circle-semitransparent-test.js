/**
 * Test: Filled Circle with Semi-Transparent Color
 *
 * Tests that fillCircle with semi-transparent color uses direct rendering
 * with Bresenham + alpha blending (not path-based rendering).
 */

registerDirectRenderingTest(
    'circle-fill-semitransparent',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Use SEMI-TRANSPARENT fill color (uses direct rendering with alpha blending)
        ctx.fillStyle = 'rgba(0, 0, 255, 0.49)';

        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const radius = 60;

        ctx.fillCircle(centerX, centerY, radius);

        return {
            logs: [`Semi-transparent circle at (${centerX}, ${centerY}) radius ${radius}`],
            checkData: {
                topY: Math.floor(centerY - radius),
                bottomY: Math.floor(centerY + radius),
                leftX: Math.floor(centerX - radius),
                rightX: Math.floor(centerX + radius)
            }
        };
    },
    'circles',
    {
        extremes: { tolerance: 0.05 },
        totalUniqueColors: 2,  // Exactly 2 colors: white background + one blended red (no overdraw)
        // Semi-transparent colors now use direct rendering with Bresenham + alpha blending
    },
    {
        title: 'Filled Circle - Semi-Transparent (Direct Rendering)',
        description: 'Tests fillCircle with alpha uses direct Bresenham + alpha blending'
    }
);

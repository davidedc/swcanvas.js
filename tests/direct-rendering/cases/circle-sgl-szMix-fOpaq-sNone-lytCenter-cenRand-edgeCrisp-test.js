/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests fillCircle with opaque color uses direct rendering (32-bit packed writes).
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | circles        | The test draws a circle using ctx.fillCircle().
 * | Count                  | single         | The test draws one circle instance in visual mode.
 * | SizeCategory           | mixed          | Radius is randomized 30-80px, spanning S (16-39) and M (40-79) categories.
 * | FillStyle              | opaque         | Fill color is 'rgb(0, 0, 255)' with full opacity.
 * | StrokeStyle            | none           | No stroke operation is performed.
 * | StrokeThickness        | N/A            | Not applicable as there is no stroke.
 * | Layout                 | centered       | The shape is positioned at the canvas center (randomPosition: false).
 * | CenteredAt             | random         | Center position is calculated by helper function with some randomization.
 * | EdgeAlignment          | crisp          | Integer coordinates used for center position.
 * | Orientation            | N/A            | Circles are rotationally symmetric.
 * | ArcAngleExtent         | N/A            | Not applicable to full circles.
 * | RoundRectRadius        | N/A            | Not applicable to circle shapes.
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
 * - Uses calculateCircleTestParameters helper for position/size calculation.
 *
 */

registerDirectRenderingTest(
    'circle-sgl-szMix-fOpaq-sNone-lytCenter-cenRand-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
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
        extremes: { alphaThreshold: 8 },
        totalUniqueColors: 2, // background + fill
        shapeIntegrity: { hasFill: true, hasStroke: false }
        // Direct rendering is expected - no allowPathBasedRendering flag
    },
    {
        title: 'Filled Circle - Opaque Color (Direct Rendering)',
        description: 'Tests fillCircle with opaque color uses direct 32-bit writes',
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a composed scene with 5 circles at corner and center positions using opaque colors.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | scene          | The test draws a composed multi-shape scene (5 circles arranged in a pattern).
 * | Count                  | multi-5        | The test draws 5 circles (4 corners + 1 center).
 * | SizeCategory           | mixed          | Corner circles have 30px radius (S), center circle has 50px radius (M).
 * | FillStyle              | opaque         | All shapes use getRandomOpaqueColor() for fully opaque fills.
 * | StrokeStyle            | none           | No stroke operations are performed.
 * | StrokeThickness        | N/A            | Not applicable as there is no stroke.
 * | Layout                 | spread         | Shapes are spread across the canvas at fixed corner and center positions.
 * | CenteredAt             | pixel          | Positions use explicit pixel coordinates (60, canvasWidth-60, etc.).
 * | EdgeAlignment          | crisp          | Integer coordinates used for all positions.
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
 * - Uses getRandomOpaqueColor() for varied but always opaque fill colors.
 * - Fixed layout pattern: 4 corner circles + 1 center circle.
 * - All shapes are circles (despite 'scene' category).
 *
 */

registerDirectRenderingTest(
    'scene-m5-fOpaq-sNone-lytSpread-cenPx-edgeCrisp',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Draw multiple shapes with opaque colors
        const shapes = [];

        // Circles in corners
        const cornerRadius = 30;
        const corners = [
            { x: 60, y: 60 },
            { x: canvasWidth - 60, y: 60 },
            { x: 60, y: canvasHeight - 60 },
            { x: canvasWidth - 60, y: canvasHeight - 60 }
        ];

        for (let i = 0; i < corners.length; i++) {
            ctx.fillStyle = getRandomOpaqueColor();
            ctx.fillCircle(corners[i].x, corners[i].y, cornerRadius);
            shapes.push({
                type: 'circle',
                x: corners[i].x,
                y: corners[i].y,
                radius: cornerRadius
            });
        }

        // Center circle
        const centerRadius = 50;
        ctx.fillStyle = getRandomOpaqueColor();
        ctx.fillCircle(canvasWidth / 2, canvasHeight / 2, centerRadius);
        shapes.push({
            type: 'circle',
            x: canvasWidth / 2,
            y: canvasHeight / 2,
            radius: centerRadius
        });

        // Calculate bounds using centralized utilities
        const allBounds = shapes.map(s => calculateCircleBounds(s.x, s.y, s.radius));
        const checkData = aggregateBounds(allBounds);

        return {
            logs: [`Drew ${shapes.length} shapes`],
            checkData
        };
    },
    'scene',
    {
        extremes: { tolerance: 0.05 },
        // All shapes use opaque colors - direct rendering expected
    },
    {
        title: 'Mixed Shapes Scene - Opaque Colors (Direct Rendering)',
        description: 'Tests scene with multiple shapes uses direct rendering'
    }
);

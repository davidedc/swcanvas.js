/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests rendering of single arcs with small angles (10-45 degrees) to verify proper handling of minimal arc extents.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs           | The test draws arc slices using fillOuterStrokeArc.
 * | Count                  | single         | The test draws one arc instance.
 * | SizeCategory           | mixed          | Radius randomized in [20, 80] range.
 * | FillStyle              | mixed          | Fill is randomly opaque, semitransparent, or none.
 * | StrokeStyle            | mixed          | Stroke is randomly opaque, semitransparent, or none (but at least one of fill/stroke).
 * | StrokeThickness        | mixed          | Stroke width randomized 1-6px.
 * | Layout                 | centered       | Arc center is at canvas center.
 * | CenteredAt             | mixed P/G      | X and Y centering independently randomized (50% pixel, 50% grid).
 * | EdgeAlignment          | crisp          | Uses pixel/grid centering for proper alignment.
 * | Orientation            | N/A            | Arc orientation determined by start angle.
 * | ArcAngleExtent         | small (10-45°) | Arc spans only 10-45 degrees, testing minimal extents.
 * | RoundRectRadius        | N/A            | Not applicable to arcs.
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
 * - Tests small arc angles (10-45 degrees) to validate handling of minimal arc extents.
 * - Start angle is randomized across full 360° range.
 * - Verifies ArcOps handles small angular spans correctly.
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fMix-sMix-swMix-lytCenter-cenMixPG-edgeCrisp-arcASmall',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Determine center type: pixel (*.5) or grid (integer)
        const atPixelX = SeededRandom.getRandom() < 0.5;
        const atPixelY = SeededRandom.getRandom() < 0.5;

        // Calculate center position
        const centerX = atPixelX
            ? Math.floor(canvasWidth / 2) + 0.5
            : Math.floor(canvasWidth / 2);
        const centerY = atPixelY
            ? Math.floor(canvasHeight / 2) + 0.5
            : Math.floor(canvasHeight / 2);

        // Random radius (20-80px)
        const radius = 20 + SeededRandom.getRandom() * 60;

        // Small arc angle: 10-45 degrees
        const arcAngleDeg = 10 + SeededRandom.getRandom() * 35;
        const arcAngleRad = arcAngleDeg * Math.PI / 180;

        // Random start angle (full 360°)
        const startAngle = SeededRandom.getRandom() * Math.PI * 2;
        const endAngle = startAngle + arcAngleRad;

        // Stroke width (1-6px)
        const strokeWidth = Math.floor(1 + SeededRandom.getRandom() * 6);

        // Determine fill/stroke modes (ensure at least one is present)
        const fillMode = SeededRandom.getRandom(); // 0-0.33: none, 0.33-0.66: semi, 0.66-1: opaque
        const strokeMode = SeededRandom.getRandom();

        let hasFill = fillMode > 0.33;
        let hasStroke = strokeMode > 0.33;

        // Ensure at least one of fill or stroke
        if (!hasFill && !hasStroke) {
            hasFill = true;
        }

        // Generate colors (standardized blue fill, red stroke)
        let fillColor = null;
        let strokeColor = null;
        let fillType = 'none';
        let strokeType = 'none';

        if (hasFill) {
            // Independent 50/50 choice for fill transparency
            const fillIsOpaque = SeededRandom.getRandom() < 0.5;
            fillType = fillIsOpaque ? 'opaque' : 'semitransparent';
            fillColor = fillIsOpaque ? 'rgb(0, 0, 255)' : 'rgba(0, 0, 255, 0.49)';
        }

        if (hasStroke) {
            // Independent 50/50 choice for stroke transparency
            const strokeIsOpaque = SeededRandom.getRandom() < 0.5;
            strokeType = strokeIsOpaque ? 'opaque' : 'semitransparent';
            strokeColor = strokeIsOpaque ? 'rgb(255, 0, 0)' : 'rgba(255, 0, 0, 0.49)';
        }

        // Draw the arc
        if (hasFill && hasStroke) {
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle);
        } else if (hasFill) {
            ctx.fillStyle = fillColor;
            ctx.fillArc(centerX, centerY, radius, startAngle, endAngle);
        } else if (hasStroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.outerStrokeArc(centerX, centerY, radius, startAngle, endAngle);
        }

        // Calculate expected bounds for the small arc
        // Note: bounds calculation for arcs is complex due to the angular span
        // For small arcs, the bounds are primarily determined by the start/end points
        const startX = centerX + radius * Math.cos(startAngle);
        const startY = centerY + radius * Math.sin(startAngle);
        const endX = centerX + radius * Math.cos(endAngle);
        const endY = centerY + radius * Math.sin(endAngle);

        const checkData = {
            leftX: Math.floor(Math.min(centerX, startX, endX) - (hasStroke ? strokeWidth : 0)),
            rightX: Math.ceil(Math.max(centerX, startX, endX) + (hasStroke ? strokeWidth : 0)),
            topY: Math.floor(Math.min(centerY, startY, endY) - (hasStroke ? strokeWidth : 0)),
            bottomY: Math.ceil(Math.max(centerY, startY, endY) + (hasStroke ? strokeWidth : 0))
        };

        return {
            logs: [`Small Arc: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, angle=${arcAngleDeg.toFixed(1)}°, start=${(startAngle * 180 / Math.PI).toFixed(1)}°, fill=${fillType}, stroke=${strokeType}, sw=${strokeWidth}`],
            checkData
        };
    },
    'arcs',
    {
        // No extremes check - small arcs have irregular bounds
        maxUniqueColors: 5  // background + fill + stroke + potential blends
    },
    {
        title: 'Single Small Angle Arc (10-45°, Mixed Fill/Stroke)',
        description: 'Tests rendering of single arcs with small angles (10-45 degrees) to verify proper handling of minimal arc extents.',
        perfName: 'Perf: Arc Small Angle 10-45deg'
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single 90-degree arc spanning one random quadrant with crisp stroke ends,
 *              mixed fill (opaque or semitransparent), and semitransparent 1px stroke.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | arcs               | The test focuses on rendering a 90-degree arc.
 * | Count                  | single             | The test draws a single arc instance.
 * | SizeCategory           | mixed              | The radius is randomized in a range of [20, 100], spanning multiple size categories.
 * | FillStyle              | mixed              | Fill is randomly opaque or semitransparent (50% chance each).
 * | StrokeStyle            | semitransparent    | Stroke color is semitransparent (alpha < 255).
 * | StrokeThickness        | 1px                | Fixed 1px stroke width for crisp rendering.
 * | Layout                 | centered           | The arc's center is at the canvas center.
 * | CenteredAt             | mixed-pixel-grid   | A random flag determines if center is on pixel (*.5) or grid (integer) line.
 * | EdgeAlignment          | crisp              | Diameter adjusted via `adjustDimensionsForCrispStrokeRendering()` for sharp edges.
 * | Orientation            | N/A                | Arc orientation determined by quadrant selection.
 * | ArcAngleExtent         | 90-deg             | Arc spans exactly 90 degrees (one quadrant).
 * | Quadrant               | random             | Randomly selects one of four quadrants: Q1 (0-90), Q2 (90-180), Q3 (180-270), Q4 (270-360). (In standard math Y-up: Q4, Q3, Q2, Q1 respectively.)
 * | RoundRectRadius        | N/A                | Not applicable to arcs.
 * | ContextTranslation     | none               | `ctx.translate()` is not used in this test.
 * | ContextRotation        | none               | `ctx.rotate()` is not used in this test.
 * | ContextScaling         | none               | `ctx.scale()` is not used in this test.
 * | Clipped on shape       | none               | No clipping path is defined or applied in this test.
 * | Clipped on shape count | n/a                | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a          | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a                | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a       | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - Uses SWCanvas direct API method `ctx.fillOuterStrokeArc()` for unified fill+stroke rendering.
 * - Extent check validates that arc bounds match between SWCanvas and HTML5 Canvas.
 * - The 90-degree arc only covers one quadrant, so extent bounds are quadrant-specific.
 *
 */

registerDirectRenderingTest(
    'arc-sgl-szMix-fMix-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp-arcADeg90-quadRand-test',
    function drawTest(ctx, iterationNumber, instances) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const strokeWidth = 1;

        // Use shared helper for crisp 90° arc parameters
        const params = calculate90DegQuadrantArcParams({
            canvasWidth,
            canvasHeight,
            minDiameter: 40,
            maxDiameter: 200,
            strokeWidth
        });

        const { centerX, centerY, radius, atPixel, quadrant, startAngle, endAngle, checkData } = params;

        // Generate mixed fill style (50/50 opaque vs semitransparent blue)
        const fillIsOpaque = SeededRandom.getRandom() < 0.5;
        const fillColor = fillIsOpaque ? 'rgb(0, 0, 255)' : 'rgba(0, 0, 255, 0.49)';
        const fillType = fillIsOpaque ? 'opaque' : 'semitransparent';

        // Semi-transparent red stroke
        const strokeColor = 'rgba(255, 0, 0, 0.49)';

        // Draw filled and stroked arc using unified Direct API
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle);

        return {
            logs: [`90deg Arc: center=(${centerX.toFixed(1)},${centerY.toFixed(1)}), r=${radius.toFixed(1)}, sw=${strokeWidth}, quadrant=${quadrant.name}, fillType=${fillType}, strokeType=semi, centerType=${atPixel ? 'pixel' : 'grid'}`],
            checkData
        };
    },
    'arcs',
    {
        extremes: { colorTolerance: 20, tolerance: 0.03 },
        maxUniqueColors: 4,  // background + fill + stroke + blend (may be fewer if colors overlap)
        speckles: { maxSpeckles: 4 }
    },
    {
        title: 'Single 90deg Arc (Crisp, Random Quadrant, Semi 1px Stroke)',
        description: 'Tests a single 90-degree arc spanning one random quadrant with crisp stroke ends, mixed fill (opaque or semitransparent), and semitransparent 1px stroke.',
    }
);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests 1px opaque stroke on rotated rounded rectangles using Context2D methods.
 *              Uses transforms + strokeRoundRect to test the dispatch to direct rendering
 *              (hybrid algorithm: 4 edges via LineOps + 4 corner arcs via ArcOps).
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|----------------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws rotated rounded rectangles via transforms + strokeRoundRect.
 * | Count                  | multi-12       | The test draws 12 instances covering various rotation angles, sizes, and radii.
 * | SizeCategory           | mixed          | Width/height range from 40-80px, spanning S (20-39px) and M (40-79px) size categories.
 * | FillStyle              | none           | Stroke-only test; no fill is applied.
 * | StrokeStyle            | opaque         | Stroke color is fixed opaque red (255, 0, 0, 255).
 * | StrokeThickness        | 1px            | Tests the 1px opaque stroke path.
 * | Layout                 | spread         | The 12 shapes are positioned across the canvas in a grid-like arrangement.
 * | CenteredAt             | mixed          | Center positions are fixed values covering various canvas regions.
 * | EdgeAlignment          | not-crisp      | Rotation makes pixel-aligned edges irrelevant; edges are inherently not crisp.
 * | Orientation            | rotated        | Tests various rotation angles: 15°, 30°, 36°, 45°, 60°, 90°.
 * | RoundRectRadius        | mixed          | Radii range from 0 (edge case) to 25px (large).
 * | ContextTranslation     | none           | Direct static method call bypasses Context2D transforms.
 * | ContextRotation        | none           | Rotation is passed directly to `strokeRotated()`, not via `ctx.rotate()`.
 * | ContextScaling         | none           | No scaling applied.
 * | Clipped on shape       | none           | No clipping applied in this test.
 * | Clipped on shape count | n/a            | No clipping.
 * | Clipped on shape arrangement | n/a      | No clipping.
 * | Clipped on shape size  | n/a            | No clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * Stroke color is fixed opaque red (255, 0, 0) rather than randomized.
 */

/**
 * @fileoverview Test definition for 1px opaque stroke rotated rounded rectangles.
 */

/**
 * @param {CanvasRenderingContext2D | SWCanvasContext} ctx The rendering context.
 * @param {number} iterationNumber The current test iteration (for seeding via RenderTest).
 * @param {?number} instances Optional: Number of instances to draw. Passed by the performance
 *                  testing harness. For visual regression (instances is null/0), 12 rectangles are drawn.
 * @returns {?{logs: string[], checkData: object}} Logs and data for checks.
 */
function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;

    let logs = [];
    let checkData = null;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Check for roundRect support (works for both SWCanvas and modern HTML5 Canvas)
    const hasStrokeRoundRect = typeof ctx.strokeRoundRect === 'function';
    const hasRoundRect = typeof ctx.roundRect === 'function';

    if (!hasStrokeRoundRect && !hasRoundRect) {
        logs.push('Skipping test: requires roundRect support');
        return { logs, checkData: { skipped: true } };
    }

    // Helper function to draw a rotated rounded rect stroke
    function drawRotatedRoundRectStroke(context, centerX, centerY, w, h, r, angle, strokeRgb) {
        context.save();
        context.translate(centerX, centerY);
        context.rotate(angle);
        context.strokeStyle = strokeRgb;
        context.lineWidth = 1;

        if (typeof context.strokeRoundRect === 'function') {
            // SWCanvas high-level API
            context.strokeRoundRect(-w / 2, -h / 2, w, h, r);
        } else {
            // HTML5 Canvas fallback: roundRect + stroke
            context.beginPath();
            context.roundRect(-w / 2, -h / 2, w, h, r);
            context.stroke();
        }
        context.restore();
    }

    // Test cases with various rotations, sizes, and radii (12 shapes total)
    const testCases = [
        // Row 1: Small shapes with different rotations
        { cx: 60, cy: 60, w: 60, h: 40, r: 8, angle: Math.PI / 12 },      // 15°
        { cx: 160, cy: 60, w: 60, h: 40, r: 8, angle: Math.PI / 6 },      // 30°
        { cx: 260, cy: 60, w: 60, h: 40, r: 8, angle: Math.PI / 4 },      // 45°
        { cx: 340, cy: 60, w: 60, h: 40, r: 8, angle: Math.PI / 3 },      // 60°

        // Row 2: Medium shapes with different radii
        { cx: 80, cy: 150, w: 80, h: 50, r: 5, angle: Math.PI / 5 },      // Small radius (36°)
        { cx: 200, cy: 150, w: 80, h: 50, r: 15, angle: Math.PI / 5 },    // Medium radius (36°)
        { cx: 320, cy: 150, w: 80, h: 50, r: 25, angle: Math.PI / 5 },    // Large radius (36°)

        // Row 3: Various aspect ratios
        { cx: 60, cy: 240, w: 80, h: 30, r: 10, angle: Math.PI / 4 },     // Wide (45°)
        { cx: 160, cy: 240, w: 40, h: 80, r: 10, angle: Math.PI / 4 },    // Tall (45°)
        { cx: 260, cy: 240, w: 60, h: 60, r: 15, angle: Math.PI / 4 },    // Square (45°)

        // Row 4: Edge cases
        { cx: 340, cy: 240, w: 60, h: 40, r: 0, angle: Math.PI / 4 },     // Zero radius (delegates to RectOps)
        { cx: 80, cy: 230, w: 60, h: 40, r: 20, angle: Math.PI / 2 },     // 90° rotation
    ];

    const strokeColor = 'rgb(255, 0, 0)';

    if (isPerformanceRun) {
        const numToDraw = instances;
        for (let i = 0; i < numToDraw; i++) {
            const tc = testCases[i % testCases.length];
            const offsetX = (i * 37) % canvasWidth;
            const offsetY = (i * 23) % canvasHeight;

            drawRotatedRoundRectStroke(
                ctx,
                tc.cx + offsetX,
                tc.cy + offsetY,
                tc.w, tc.h, tc.r,
                tc.angle,
                strokeColor
            );
        }
        return null;
    }

    // Visual test: draw all 12 test cases
    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const angleDeg = Math.round(tc.angle * 180 / Math.PI);

        drawRotatedRoundRectStroke(
            ctx,
            tc.cx, tc.cy,
            tc.w, tc.h, tc.r,
            tc.angle,
            strokeColor
        );

        logs.push(`Shape ${i + 1}: center=(${tc.cx},${tc.cy}), size=${tc.w}x${tc.h}, r=${tc.r}, angle=${angleDeg}°`);
    }

    // Calculate rough bounds for first shape for extremes check
    const firstCase = testCases[0];
    const hw = firstCase.w / 2;
    const hh = firstCase.h / 2;
    const diag = Math.sqrt(hw * hw + hh * hh);

    checkData = {
        shapeCount: testCases.length,
        expectedMinX: Math.floor(firstCase.cx - diag),
        expectedMaxX: Math.ceil(firstCase.cx + diag),
        expectedMinY: Math.floor(firstCase.cy - diag),
        expectedMaxY: Math.ceil(firstCase.cy + diag)
    };

    return { logs, checkData };
}

registerDirectRenderingTest(
    'roundrect-m12-szMix-fNone-sOpaq-sw1px-lytSpread-cenMix-edgeNotCrisp-ornRot-rrrMix',
    drawTest,
    'rounded-rects',
    {
        extremes: false  // Rotated shapes have complex bounds, skip strict extremes check
    },
    {
        title: '12 Rotated Rounded Rectangles - 1px Opaque Stroke',
        description: 'Tests high-level API rendering of 1px opaque stroke on rotated rounded rectangles using transforms and strokeRoundRect.',
        perfName: 'Perf: 12 Rotated RRects 1px Opaque'
    }
);

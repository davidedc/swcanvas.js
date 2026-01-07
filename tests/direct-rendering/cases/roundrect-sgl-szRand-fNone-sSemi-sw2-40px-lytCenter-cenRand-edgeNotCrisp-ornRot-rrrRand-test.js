/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests 5px semi-transparent stroke on a single rotated rounded rectangle.
 *              Uses SeededRandom for reproducibility. Uses Context2D methods with transforms to test
 *              the dispatch to direct rendering (Dual Edge Buffer algorithm with alpha blending).
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|----------------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws a rotated rounded rectangle via transforms + strokeRoundRect.
 * | Count                  | single         | Only 1 instance drawn for focused visual inspection.
 * | SizeCategory           | random         | Width/height randomly generated (60-140px range).
 * | FillStyle              | none           | Stroke-only test; no fill is applied.
 * | StrokeStyle            | semi           | Stroke color is semi-transparent (alpha = 0.6).
 * | StrokeThickness        | 2-40px         | Tests thick stroke with Dual Edge Buffer + alpha blending (random width).
 * | Layout                 | center         | Shape is roughly centered on canvas.
 * | CenteredAt             | random         | Center has small random offset from canvas center.
 * | EdgeAlignment          | not-crisp      | Rotation makes pixel-aligned edges irrelevant.
 * | Orientation            | rotated        | Random rotation angle (0 to 2π).
 * | RoundRectRadius        | random         | Radius randomly generated (8 to min(w,h)/2).
 */

function drawTest(ctx, currentIterationNumber, instances = null) {
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

    // Helper function to draw a rotated rounded rect stroke with alpha
    function drawRotatedRoundRectStroke(context, centerX, centerY, w, h, r, angle, strokeRgb, lineW, alpha) {
        context.save();
        context.globalAlpha = alpha;
        context.translate(centerX, centerY);
        context.rotate(angle);
        context.strokeStyle = strokeRgb;
        context.lineWidth = lineW;

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

    // Generate random parameters
    const width = 60 + Math.floor(SeededRandom.getRandom() * 80);
    const height = 60 + Math.floor(SeededRandom.getRandom() * 60);
    const maxRadius = Math.min(width, height) / 2;
    const radius = 8 + Math.floor(SeededRandom.getRandom() * (maxRadius - 8));
    const rotation = SeededRandom.getRandom() * Math.PI * 2;
    const lineWidth = 2 + Math.floor(SeededRandom.getRandom() * 39);

    const cx = canvasWidth / 2 + (SeededRandom.getRandom() - 0.5) * 40;
    const cy = canvasHeight / 2 + (SeededRandom.getRandom() - 0.5) * 40;

    const strokeColor = { r: 255, g: 0, b: 0 };
    const strokeAlpha = 0.49;

    if (isPerformanceRun) {
        for (let i = 0; i < instances; i++) {
            const w = 60 + Math.floor(SeededRandom.getRandom() * 60);
            const h = 60 + Math.floor(SeededRandom.getRandom() * 50);
            const r = 8 + Math.floor(SeededRandom.getRandom() * (Math.min(w, h) / 2 - 8));
            const angle = SeededRandom.getRandom() * Math.PI * 2;
            const offsetX = SeededRandom.getRandom() * canvasWidth;
            const offsetY = SeededRandom.getRandom() * canvasHeight;
            const lw = 3 + Math.floor(SeededRandom.getRandom() * 8);
            const alpha = 0.3 + SeededRandom.getRandom() * 0.5;

            const sc = {
                r: Math.floor(SeededRandom.getRandom() * 200) + 55,
                g: Math.floor(SeededRandom.getRandom() * 200) + 55,
                b: Math.floor(SeededRandom.getRandom() * 200) + 55
            };

            drawRotatedRoundRectStroke(
                ctx, offsetX, offsetY, w, h, r, angle,
                `rgb(${sc.r}, ${sc.g}, ${sc.b})`, lw, alpha
            );
        }
        return null;
    }

    const angleDeg = Math.round(rotation * 180 / Math.PI);

    drawRotatedRoundRectStroke(
        ctx, cx, cy, width, height, radius, rotation,
        `rgb(${strokeColor.r}, ${strokeColor.g}, ${strokeColor.b})`, lineWidth, strokeAlpha
    );

    logs.push(`Shape: center=(${cx.toFixed(1)},${cy.toFixed(1)}), size=${width}x${height}, r=${radius}, angle=${angleDeg}°`);
    logs.push(`Stroke: rgba(${strokeColor.r}, ${strokeColor.g}, ${strokeColor.b}, ${strokeAlpha}), lineWidth=${lineWidth}`);

    const hw = width / 2 + lineWidth;
    const hh = height / 2 + lineWidth;
    const diag = Math.sqrt(hw * hw + hh * hh);

    checkData = {
        shapeCount: 1,
        expectedMinX: Math.floor(cx - diag),
        expectedMaxX: Math.ceil(cx + diag),
        expectedMinY: Math.floor(cy - diag),
        expectedMaxY: Math.ceil(cy + diag)
    };

    return { logs, checkData };
}

registerDirectRenderingTest(
    'roundrect-sgl-szRand-fNone-sSemi-sw2-40px-lytCenter-cenRand-edgeNotCrisp-ornRot-rrrRand',
    drawTest,
    'rounded-rects',
    {
        extremes: false,
        totalUniqueColors: 2,  // Background + single semi-transparent stroke color (no overdraw)
        strokePatternContinuity: true
    },
    {
        title: 'Single Rotated Rounded Rectangle - 2-40px Semi-Transparent Stroke (Random)',
        description: 'Tests high-level API rendering of random 2-40px semi-transparent stroke on a single rotated rounded rectangle using transforms and strokeRoundRect.',
        displayName: 'Perf: Single Rotated RRect 2-40px Alpha Stroke (Random)'
    }
);

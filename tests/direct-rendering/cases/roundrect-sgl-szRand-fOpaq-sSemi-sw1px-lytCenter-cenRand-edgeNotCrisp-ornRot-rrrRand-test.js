/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests opaque fill + 1px semi-transparent stroke on a single rotated rounded rectangle.
 *              Uses SeededRandom for reproducibility. Uses high-level API (ctx.fillStrokeRoundRect)
 *              with transforms to test the combined fill+stroke rendering with alpha blending.
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|----------------------------------------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws a rotated rounded rectangle via transforms + fillStrokeRoundRect.
 * | Count                  | single         | Only 1 instance drawn for focused visual inspection.
 * | SizeCategory           | random         | Width/height randomly generated (60-140px range).
 * | FillStyle              | opaque         | Fill color is opaque green.
 * | StrokeStyle            | semi           | Stroke color is semi-transparent (alpha = 0.6) via rgba().
 * | StrokeThickness        | 1px            | Tests 1px semi-transparent stroke combined with fill.
 * | Layout                 | center         | Shape is roughly centered on canvas.
 * | CenteredAt             | random         | Center has small random offset from canvas center.
 * | EdgeAlignment          | not-crisp      | Rotation makes pixel-aligned edges irrelevant.
 * | Orientation            | rotated        | Random rotation angle (0 to 2pi).
 * | RoundRectRadius        | random         | Radius randomly generated (8 to min(w,h)/2).
 */

function drawTest(ctx, iterationNumber, instances) {
    const isPerformanceRun = instances !== null && instances > 0;

    let logs = [];
    let checkData = null;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Check for roundRect support (works for both SWCanvas and modern HTML5 Canvas)
    const hasFillAndStrokeRoundRect = typeof ctx.fillStrokeRoundRect === 'function';
    const hasRoundRect = typeof ctx.roundRect === 'function';

    if (!hasFillAndStrokeRoundRect && !hasRoundRect) {
        logs.push('Skipping test: requires roundRect support');
        return { logs, checkData: { skipped: true } };
    }

    // Generate random parameters
    const width = 60 + Math.floor(SeededRandom.getRandom() * 80);
    const height = 60 + Math.floor(SeededRandom.getRandom() * 60);
    const maxRadius = Math.min(width, height) / 2;
    const radius = 8 + Math.floor(SeededRandom.getRandom() * (maxRadius - 8));
    const rotation = SeededRandom.getRandom() * Math.PI * 2;
    const lineWidth = 1;

    const cx = canvasWidth / 2 + (SeededRandom.getRandom() - 0.5) * 40;
    const cy = canvasHeight / 2 + (SeededRandom.getRandom() - 0.5) * 40;

    const fillColor = { r: 0, g: 0, b: 255 };
    const strokeColor = { r: 255, g: 0, b: 0 };
    const strokeAlpha = 0.49;

    // Helper function to draw a single rotated rounded rect
    function drawRotatedRoundRect(context, centerX, centerY, w, h, r, angle, lw, fillRgb, strokeRgba) {
        context.save();
        context.translate(centerX, centerY);
        context.rotate(angle);
        context.fillStyle = fillRgb;
        context.strokeStyle = strokeRgba;
        context.lineWidth = lw;

        if (typeof context.fillStrokeRoundRect === 'function') {
            // SWCanvas high-level API
            context.fillStrokeRoundRect(-w / 2, -h / 2, w, h, r);
        } else {
            // HTML5 Canvas fallback: roundRect + fill + stroke
            context.beginPath();
            context.roundRect(-w / 2, -h / 2, w, h, r);
            context.fill();
            context.stroke();
        }
        context.restore();
    }

    if (isPerformanceRun) {
        for (let i = 0; i < instances; i++) {
            const w = 60 + Math.floor(SeededRandom.getRandom() * 60);
            const h = 60 + Math.floor(SeededRandom.getRandom() * 50);
            const r = 8 + Math.floor(SeededRandom.getRandom() * (Math.min(w, h) / 2 - 8));
            const angle = SeededRandom.getRandom() * Math.PI * 2;
            const offsetX = SeededRandom.getRandom() * canvasWidth;
            const offsetY = SeededRandom.getRandom() * canvasHeight;
            const alpha = 0.3 + SeededRandom.getRandom() * 0.5;

            const fc = {
                r: Math.floor(SeededRandom.getRandom() * 200) + 55,
                g: Math.floor(SeededRandom.getRandom() * 100) + 100,
                b: Math.floor(SeededRandom.getRandom() * 100) + 55
            };
            const sc = {
                r: Math.floor(SeededRandom.getRandom() * 100) + 55,
                g: Math.floor(SeededRandom.getRandom() * 100) + 55,
                b: Math.floor(SeededRandom.getRandom() * 200) + 55
            };

            drawRotatedRoundRect(
                ctx, offsetX, offsetY, w, h, r, angle, 1,
                `rgb(${fc.r}, ${fc.g}, ${fc.b})`,
                `rgba(${sc.r}, ${sc.g}, ${sc.b}, ${alpha})`
            );
        }
        return null;
    }

    const angleDeg = Math.round(rotation * 180 / Math.PI);

    // Draw with unified API - stroke alpha encoded in strokeStyle
    drawRotatedRoundRect(
        ctx, cx, cy, width, height, radius, rotation, lineWidth,
        `rgb(${fillColor.r}, ${fillColor.g}, ${fillColor.b})`,
        `rgba(${strokeColor.r}, ${strokeColor.g}, ${strokeColor.b}, ${strokeAlpha})`
    );

    logs.push(`Shape: center=(${cx.toFixed(1)},${cy.toFixed(1)}), size=${width}x${height}, r=${radius}, angle=${angleDeg}`);
    logs.push(`Fill: rgb(${fillColor.r}, ${fillColor.g}, ${fillColor.b})`);
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
    'roundrect-sgl-szRand-fOpaq-sSemi-sw1px-lytCenter-cenRand-edgeNotCrisp-ornRot-rrrRand',
    drawTest,
    'rounded-rects',
    {
        extremes: false,
        maxUniqueColors: 4, // some very rare test iterations have exactly 3 colors i.e. all the pixels of the stroke overlap the fill
        shapeIntegrity: { hasFill: true, hasStroke: true }
    },
    {
        title: 'Single Rotated Rounded Rectangle - Fill + 1px Semi-Transparent Stroke (Random)',
        description: 'Tests high-level API rendering of opaque fill and 1px semi-transparent stroke on a single rotated rounded rectangle using transforms and fillStrokeRoundRect.',
    }
);

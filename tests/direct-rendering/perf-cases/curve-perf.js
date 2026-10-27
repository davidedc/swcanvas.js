/**
 * Parametric Path-Curve Performance Tests (generic fill / clip / stroke of curves)
 *
 * Generates performance tests covering:
 * - fills (sw0) over 4 shape size categories (szS, szM, szL, szXL), opaque:
 *   - arc-fill: arc(0, 2pi) + fill()
 *   - ellipse-fill: a rotated ellipse() + fill()
 *   - cubic-fill: a closed blob of four bezierCurveTo() + fill()
 *   - roundrect-path-fill: roundRect() + fill()
 *   - roundrect-clip-fillrect: roundRect() + clip(), then fillRect() over its box
 *   - polygon-fill: a straight-edged hexagon + fill() (the control: no curve)
 * - strokes over 3 stroke width categories (swXXS, swS, swL) and 2 shape size
 *   categories (szS, szL), opaque:
 *   - arc-stroke: alternately a full circle and an open arc, arc() + stroke()
 *   - ellipse-stroke: a rotated ellipse() + stroke()
 *   - bezier-stroke: an open S-curve of two bezierCurveTo() + stroke()
 *
 * Every shape is built on the CURRENT path under the identity CTM, so it takes
 * the generic pipeline: the curve is flattened (Context2D's baked arcs and
 * PathFlattener's Bezier flattener), then PolygonFiller fills it (fill), builds
 * the clip mask from it (clip), or fills the polygons StrokeGenerator offsets
 * from it (stroke). No direct fill arm reaches these shapes.
 */

(function () {
    'use strict';

    const TAU = Math.PI * 2;

    function fillShape(ctx, operation, cx, cy, size) {
        const half = size / 2;
        ctx.beginPath();
        switch (operation) {
            case 'arc-fill':
                ctx.arc(cx, cy, half, 0, TAU);
                ctx.fill();
                return;
            case 'ellipse-fill': {
                // Minor axis 40-90% of the major one, any rotation
                const ry = half * (0.4 + SeededRandom.getRandom() * 0.5);
                ctx.ellipse(cx, cy, half, ry, SeededRandom.getRandom() * Math.PI, 0, TAU);
                ctx.fill();
                return;
            }
            case 'cubic-fill': {
                // Four cubic arcs through the box's edge midpoints, control points
                // pulled 40-70% of the way towards the corners: a closed blob.
                const k = 0.4 + SeededRandom.getRandom() * 0.3;
                const c = half * k;
                ctx.moveTo(cx + half, cy);
                ctx.bezierCurveTo(cx + half, cy + c, cx + c, cy + half, cx, cy + half);
                ctx.bezierCurveTo(cx - c, cy + half, cx - half, cy + c, cx - half, cy);
                ctx.bezierCurveTo(cx - half, cy - c, cx - c, cy - half, cx, cy - half);
                ctx.bezierCurveTo(cx + c, cy - half, cx + half, cy - c, cx + half, cy);
                ctx.closePath();
                ctx.fill();
                return;
            }
            case 'polygon-fill':
                // Hexagon inscribed in the size x size box
                ctx.moveTo(cx - half, cy);
                ctx.lineTo(cx - half / 2, cy - half);
                ctx.lineTo(cx + half / 2, cy - half);
                ctx.lineTo(cx + half, cy);
                ctx.lineTo(cx + half / 2, cy + half);
                ctx.lineTo(cx - half / 2, cy + half);
                ctx.closePath();
                ctx.fill();
                return;
        }
        // roundrect-path-fill / roundrect-clip-fillrect: aspect 0.5-2.0, radius
        // 10-50% of the shorter side (50% = a stadium)
        const aspectRatio = 0.5 + SeededRandom.getRandom() * 1.5;
        const w = size;
        const h = size / aspectRatio;
        const r = Math.min(w, h) * (0.1 + SeededRandom.getRandom() * 0.4);
        ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
        if (operation === 'roundrect-path-fill') {
            ctx.fill();
            return;
        }
        ctx.save();
        ctx.clip();
        ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
        ctx.restore();
    }

    function strokeShape(ctx, operation, cx, cy, size, i) {
        const half = size / 2;
        ctx.beginPath();
        if (operation === 'arc-stroke') {
            if (i % 2 === 0) {
                ctx.arc(cx, cy, half, 0, TAU);
            } else {
                // Open arc sweeping 0.5-1.75 turns of pi, from any start angle
                const start = SeededRandom.getRandom() * TAU;
                ctx.arc(cx, cy, half, start, start + Math.PI * (0.5 + SeededRandom.getRandom() * 1.25));
            }
        } else if (operation === 'ellipse-stroke') {
            const ry = half * (0.4 + SeededRandom.getRandom() * 0.5);
            ctx.ellipse(cx, cy, half, ry, SeededRandom.getRandom() * Math.PI, 0, TAU);
        } else {
            // bezier-stroke: an S-curve across the box, two cubics
            const s = SeededRandom.getRandom() < 0.5 ? 1 : -1;
            ctx.moveTo(cx - half, cy);
            ctx.bezierCurveTo(cx - half, cy - s * half, cx, cy - s * half, cx, cy);
            ctx.bezierCurveTo(cx, cy + s * half, cx + half, cy + s * half, cx + half, cy);
        }
        ctx.stroke();
    }

    /**
     * Draw function shared by both registrations.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} instances - Number of shapes to draw (0 = single for visual, >0 for perf)
     * @param {Object} params - { sizeSequence, strokeSequence, fixedStrokeWidth, operation }
     */
    function drawFunction(ctx, instances, params) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const { sizeSequence, strokeSequence, fixedStrokeWidth, operation } = params;

        const isPerformanceRun = instances !== null && instances > 0;
        const numToDraw = isPerformanceRun ? instances : 1;
        const isStroke = operation.endsWith('-stroke');

        ctx.fillStyle = 'rgb(0, 0, 255)';
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        if (isStroke && !strokeSequence) {
            ctx.lineWidth = fixedStrokeWidth;
        }

        // Get max stroke width for margin calculation
        const maxStrokeWidth = !isStroke
            ? 0
            : fixedStrokeWidth !== null
              ? fixedStrokeWidth
              : strokeSequence
                ? Math.max(...strokeSequence.subarray(0, Math.min(numToDraw, strokeSequence.length)))
                : 0;

        for (let i = 0; i < numToDraw; i++) {
            const idx = i % sizeSequence.length;
            const size = sizeSequence[idx];
            if (isStroke && strokeSequence) {
                ctx.lineWidth = strokeSequence[idx];
            }

            // Random position with margin for shape + stroke - seeded for reproducibility.
            // A rounded rect's long side reaches size, its short side size / 2.
            const margin = Math.max(50, size + maxStrokeWidth);
            const cx = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
            const cy = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);

            if (isStroke) {
                strokeShape(ctx, operation, cx, cy, size, i);
            } else {
                fillShape(ctx, operation, cx, cy, size);
            }
        }

        // Return null for performance runs
        return null;
    }

    registerParametricPerfTests({
        baseId: 'curve-perf',
        baseName: 'Curve',
        category: 'arcs',
        strokeCategories: ['sw0'],
        sizeCategories: ['szS', 'szM', 'szL', 'szXL'],
        operations: [
            'arc-fill',
            'ellipse-fill',
            'cubic-fill',
            'roundrect-path-fill',
            'roundrect-clip-fillrect',
            'polygon-fill'
        ],
        drawFunction: drawFunction
    });

    registerParametricPerfTests({
        baseId: 'curve-perf',
        baseName: 'Curve',
        category: 'arcs',
        strokeCategories: ['swXXS', 'swS', 'swL'],
        sizeCategories: ['szS', 'szL'],
        operations: ['arc-stroke', 'ellipse-stroke', 'bezier-stroke'],
        drawFunction: drawFunction
    });
})();

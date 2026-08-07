/**
 * StadiumOps - Static methods for optimized stadium (capsule) rendering
 * Follows CircleOps/PolygonFiller pattern with static methods.
 *
 * A stadium is the fill of a w-by-h box whose shorter axis is fully rounded:
 * two half-circle caps of radius min(w,h)/2 joined by a rectangular body.
 * Orientation is implied by the longer axis (h >= w: caps top/bottom;
 * w > h: caps left/right; w === h: the shape degenerates to a circle).
 *
 * Direct rendering is available exclusively via the dedicated Context2D
 * method: fillStadium(). There are deliberately NO stroke variants - the one
 * consumer (Fizzygum slider chrome) only fills; capability lands with callers.
 *
 * WHY NOT RoundedRectOpsAA AT r = min(w,h)/2: its corner rows compute x
 * extents with an edge-sampled ceil/floor convention (rows are center-
 * sampled). Normal rounded rects hide that behind their straight vertical
 * edges, but at the degenerate radius a horizontal stadium loses its left and
 * right apex columns (1px narrow on both sides - probed in
 * debug/probe-stadium-roundrect-degenerate.js). Changing that convention
 * would churn every existing rounded-rect consumer, so the stadium gets its
 * own renderer built on CircleOps.generateExtents - cap pixels match
 * fillCircle's crisp contract by construction (tests/core/053).
 *
 * WHY NOT fillCircle+fillRect+fillCircle COMPOSITION: at effectiveAlpha < 1
 * the overlap regions blend twice and darken. Here every row is exactly ONE
 * span - the union of the cap spans and the body strips - so coverage is
 * single-blend everywhere by construction.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha
 * Layer 1 (Primitives): fill_Opaq, fill_Alpha -> SpanOps + CircleOps.generateExtents
 *
 * NAMING PATTERN: {operation}_{opacity} (no orientation suffix - the row
 * union handles vertical, horizontal and square identically)
 */
class StadiumOps {
    /**
     * Per-row span geometry shared by fill_Opaq/fill_Alpha.
     *
     * The stadium is computed as the row-wise UNION of four intervals, all
     * expressed in the exact integer-anchor arithmetic of CircleOps.fill_*
     * (adjusted centers floor(c - 0.5), Bresenham extents, xOffset/yOffset
     * for .5 radii), so the caps are byte-identical to fillCircle output:
     *   - cap A circle span at this row (center x+r, y+r)
     *   - cap B circle span at this row (center x+w-r, y+h-r)
     *   - body strip 1: full circle width, rows between the cap center rows
     *   - body strip 2: columns between the cap center columns, every row
     * All four share interior columns, so the union is one contiguous span.
     *
     * @returns {object|null} geometry pack, or null for a degenerate box
     */
    static _rowGeometry(x, y, width, height) {
        const rectX = Math.floor(x);
        const rectY = Math.floor(y);
        const rectW = Math.floor(width);
        const rectH = Math.floor(height);
        if (rectW <= 0 || rectH <= 0) return null;

        const radius = Math.min(rectW, rectH) / 2;
        const extentData = CircleOps.generateExtents(radius);
        if (!extentData) return null;
        const { extents, intRadius, xOffset, yOffset } = extentData;

        return {
            rectX,
            rectY,
            rectW,
            rectH,
            extents,
            intRadius,
            xOffset,
            yOffset,
            // Adjusted cap centers (CircleOps.fill_* convention)
            capAX: Math.floor(rectX + radius - 0.5),
            capAY: Math.floor(rectY + radius - 0.5),
            capBX: Math.floor(rectX + rectW - radius - 0.5),
            capBY: Math.floor(rectY + rectH - radius - 0.5)
        };
    }

    /**
     * Extent (max relative x) of a cap circle at absolute row py, or -1 when
     * the row is outside the circle. Inverse of CircleOps.fill_*'s row
     * emission: bottom rows are adjCY + rel, top rows adjCY - rel - yOffset + 1.
     */
    static _capExtentAtRow(g, capCenterRow, py) {
        const rel = py >= capCenterRow ? py - capCenterRow : capCenterRow - g.yOffset + 1 - py;
        return rel >= 0 && rel <= g.intRadius ? g.extents[rel] : -1;
    }

    /**
     * Compute the single [left, right] span for row py (inclusive), or null
     * for an empty row. Pure integer-box geometry - the caller clamps to the
     * surface/clip rect.
     */
    static _spanAtRow(g, py) {
        let left = Infinity;
        let right = -Infinity;

        // Cap circles
        const eA = StadiumOps._capExtentAtRow(g, g.capAY, py);
        if (eA >= 0) {
            left = Math.min(left, g.capAX - eA - g.xOffset + 1);
            right = Math.max(right, g.capAX + eA);
        }
        const eB = StadiumOps._capExtentAtRow(g, g.capBY, py);
        if (eB >= 0) {
            left = Math.min(left, g.capBX - eB - g.xOffset + 1);
            right = Math.max(right, g.capBX + eB);
        }

        // Body strip 1: full circle width between the cap center rows
        if (py >= g.capAY && py <= g.capBY) {
            left = Math.min(left, g.capAX - g.intRadius - g.xOffset + 1);
            right = Math.max(right, g.capBX + g.intRadius);
        }

        // Body strip 2: columns between the cap center columns, every box row
        left = Math.min(left, g.capAX);
        right = Math.max(right, g.capBX);

        return left <= right ? { left, right } : null;
    }

    /**
     * Optimized opaque stadium fill: one span per row via SpanOps.
     * @param {Surface} surface - Target surface
     * @param {number} x - Box top-left X
     * @param {number} y - Box top-left Y
     * @param {number} width - Box width
     * @param {number} height - Box height
     * @param {Color} color - Fill color (must be opaque, alpha=255)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static fill_Opaq(surface, x, y, width, height, color, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        const g = StadiumOps._rowGeometry(x, y, width, height);
        if (!g) return;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Tier-0 rect clip bounds - see CircleOps.fill_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        const startY = Math.max(cy0, g.rectY);
        const endY = Math.min(cy1 - 1, g.rectY + g.rectH - 1);
        for (let py = startY; py <= endY; py++) {
            const span = StadiumOps._spanAtRow(g, py);
            if (!span) continue;
            const left = Math.max(cx0, span.left);
            const right = Math.min(cx1 - 1, span.right);
            if (left > right) continue;
            SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, left, py, right - left + 1, packedColor, clipBuffer);
        }
    }

    /**
     * Stadium fill with alpha blending: one span per row, so coverage is
     * single-blend everywhere (the property the circle+rect composition
     * cannot give).
     * @param {Surface} surface - Target surface
     * @param {number} x - Box top-left X
     * @param {number} y - Box top-left Y
     * @param {number} width - Box width
     * @param {number} height - Box height
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static fill_Alpha(surface, x, y, width, height, color, globalAlpha, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g_ = color.g,
            b = color.b;

        const g = StadiumOps._rowGeometry(x, y, width, height);
        if (!g) return;

        // Tier-0 rect clip bounds - see CircleOps.fill_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        const startY = Math.max(cy0, g.rectY);
        const endY = Math.min(cy1 - 1, g.rectY + g.rectH - 1);
        for (let py = startY; py <= endY; py++) {
            const span = StadiumOps._spanAtRow(g, py);
            if (!span) continue;
            const left = Math.max(cx0, span.left);
            const right = Math.min(cx1 - 1, span.right);
            if (left > right) continue;
            SpanOps.fill_Alpha(
                data,
                surfaceWidth,
                surfaceHeight,
                left,
                py,
                right - left + 1,
                r,
                g_,
                b,
                effectiveAlpha,
                invAlpha,
                clipBuffer
            );
        }
    }
}

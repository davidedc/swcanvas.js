/**
 * RoundedRectOpsAA - Static methods for optimized AXIS-ALIGNED rounded rectangle rendering
 * Follows the PolygonFiller/RectOpsAA/CircleOps/LineOps pattern.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * strokeRoundRect(), fillStrokeRoundRect(). Plain roundRect FILLS always take the
 * generic pipeline - the fill_AA_* statics were removed on parity evidence
 * (DIRECT-RENDERING-SUMMARY.MD §9 entries 15-16).
 *
 * Path-based rounded rectangles (beginPath() + roundRect() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * NOTE: Rotated rounded rectangle rendering is handled by RoundedRectOpsRot (called
 * directly by Context2D). This class only handles axis-aligned (AA) rounded rectangles.
 *
 * PER-CORNER RADII: every entry takes `radii` with HTML5 roundRect() semantics
 * (RoundedRectUtils.normalizeCornerRadii → integer [topLeft, topRight,
 * bottomRight, bottomLeft]), and every corner is rendered from its own radius
 * only: a corner of radius r is pixel-identical to the same corner of a
 * uniform-r rounded rect, and a radius-0 corner is square (the edges run into
 * it; thick strokes get a square outer corner, like strokeRect). Context2D
 * hands quarter-turned rects over with their corners already re-assigned to
 * device corners (RoundedRectUtils.deviceCornerRadii).
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Primitives - call SpanOps, fallback to RectOpsAA for radius=0):
 *   stroke1px_AA_Opaq                    → Direct pixel writes
 *   stroke1px_AA_Alpha                   → Inline BLEND_ALPHA marker
 *   strokeThick_AA_Opaq, strokeThick_AA_Alpha → SpanOps.fill_Opaq/fill_Alpha
 *
 * Layer 2 (Composites):
 *   fillStroke_AA_Any  → SpanOps.fill_Opaq/fill_Alpha (via renderFillSpan/renderStrokeSpan helpers)
 *
 * NAMING PATTERN: {operation}[Thickness]_{orientation}_{opacity}
 *   - Orientation: AA (axis-aligned)
 *   - Opacity: Opaq | Alpha | Any
 */
// Shared outputs of RoundedRectOpsAA._strokeEdgeRadii (no allocation per draw call).
const _rrOuterRadiiScratch = [0, 0, 0, 0];
const _rrInnerRadiiScratch = [0, 0, 0, 0];

class RoundedRectOpsAA {
    // =========================================================================
    // Private Static Helpers
    // =========================================================================

    /**
     * Calculate X extent for rounded corners at a given scanline Y. The left end of
     * the span follows the top-left corner's arc in its band, else the
     * bottom-left's; the right end the top-right's, else the bottom-right's (top
     * band first, as when the bands overlap after integer rounding). A radius-0
     * corner has no band, so its side runs straight to the rect's corner.
     *
     * An arc can MISS its own band row: a radius of 0.25px or less (only ever an
     * inner stroke edge, r - halfStroke, the stroke nearly swallowing the corner)
     * does not reach the row's pixel centers. The row counts as outside only when
     * BOTH ends miss - always the case for uniform radii, which keeps their
     * rendering exactly the historical one. A single missed end stops at the
     * arc's tangent column instead, so one tiny-radius corner cannot blank a
     * whole row of the hole next to differently-rounded corners.
     *
     * Both axes sample pixel CENTERS, as the polygon filler and CircleOps do: the
     * row is taken at py + 0.5 (dyL / dyR below), and a column x is inside iff its
     * center x + 0.5 lies in [left edge, right edge) of the shape on that row. So
     * the ring a thick stroke leaves (outer extent minus inner extent) is the exact
     * pixel-center coverage of the stroke, the same along a vertical side as along
     * the transposed horizontal one.
     *
     * A row with no columns (outside the shape, or both arcs missed) is the EMPTY
     * interval, rightX < leftX - never a marker coordinate: a legal extent can start
     * at any x, negative ones included (a shape past the surface's left edge), so
     * callers test rightX < leftX, never the sign of leftX. Every return is a fresh
     * { leftX, rightX } literal of that one shape, and should stay so: inlined, the
     * call's result can be scalar-replaced, so a row allocates nothing - a shared
     * empty constant would be a real heap object, and module-level output variables
     * measured slower on this per-row path.
     * @param {number} py - Scanline Y coordinate
     * @param {number} rectX - Rectangle left X
     * @param {number} rectW - Rectangle width
     * @param {number} rectY - Rectangle top Y
     * @param {number} rectH - Rectangle height
     * @param {number[]} radii - Corner radii [topLeft, topRight, bottomRight, bottomLeft]
     * @param {number} [epsilon=0] - Epsilon for inset calculation
     * @returns {{leftX: number, rightX: number}} The row's columns, inclusive (any x,
     *   negative included); rightX < leftX when the row has no columns
     * @private
     */
    static _getXExtent(py, rectX, rectW, rectY, rectH, radii, epsilon = 0) {
        if (py < rectY || py >= rectY + rectH) {
            return { leftX: 0, rightX: -1 };
        }
        const rTL = radii[0],
            rTR = radii[1],
            rBR = radii[2],
            rBL = radii[3];

        // The arc bounding each end on this row (radius 0: a straight side). Left: the
        // top-left arc, else the bottom-left; right: the top-right, else the bottom-right.
        let rL = 0,
            dyL = 0;
        if (py < rectY + rTL) {
            rL = rTL;
            dyL = rectY + rTL - py - 0.5;
        } else if (py >= rectY + rectH - rBL) {
            rL = rBL;
            dyL = py - (rectY + rectH - rBL) + 0.5;
        }
        let rR = 0,
            dyR = 0;
        if (py < rectY + rTR) {
            rR = rTR;
            dyR = rectY + rTR - py - 0.5;
        } else if (py >= rectY + rectH - rBR) {
            rR = rBR;
            dyR = py - (rectY + rectH - rBR) + 0.5;
        }

        let leftX = rectX,
            rightX = rectX + rectW - 1;
        let leftMissed = false,
            rightMissed = false,
            dxL = 0;
        if (rL > 0) {
            const dySquared = dyL * dyL,
                radiusSquared = rL * rL;
            leftMissed = dySquared >= radiusSquared;
            dxL = leftMissed ? 0 : Math.sqrt(radiusSquared - dySquared);
            leftX = Math.ceil(rectX + rL - dxL - 0.5 + epsilon);
        }
        if (rR > 0) {
            let dxR;
            if (rR === rL && dyR === dyL) {
                // Both ends on mirror-image arcs (always so for uniform radii): one sqrt.
                rightMissed = leftMissed;
                dxR = dxL;
            } else {
                const dySquared = dyR * dyR,
                    radiusSquared = rR * rR;
                rightMissed = dySquared >= radiusSquared;
                dxR = rightMissed ? 0 : Math.sqrt(radiusSquared - dySquared);
            }
            rightX = Math.ceil(rectX + rectW - rR + dxR - 0.5 - epsilon) - 1;
        }

        if (leftMissed && rightMissed) {
            return { leftX: 0, rightX: -1 };
        }
        return { leftX, rightX };
    }

    /**
     * Outer (stroke outer edge) and inner (stroke inner edge) corner radii for a
     * stroke of half-width `halfStroke` around path corners `radii`, written into
     * the shared _rrOuterRadiiScratch / _rrInnerRadiiScratch (no allocation per
     * draw call). A rounded corner's outer edge is its arc offset outward
     * (r + halfStroke); a square corner stays square on both edges.
     * @param {number[]} radii - Integer path radii [topLeft, topRight, bottomRight, bottomLeft]
     * @param {number} halfStroke - Half the stroke width
     * @private
     */
    static _strokeEdgeRadii(radii, halfStroke) {
        for (let i = 0; i < 4; i++) {
            const r = radii[i];
            _rrOuterRadiiScratch[i] = r > 0 ? r + halfStroke : 0;
            _rrInnerRadiiScratch[i] = Math.max(0, r - halfStroke);
        }
    }

    /**
     * Keep a 1px stroke's corner arcs inside its pixel frame. A corner arc of
     * radius r reaches r pixels in from its own sides, so one corner holding a
     * whole side (legal for per-corner radii: [w, 0, 0, 0]) can put its far
     * tangent pixel one past the frame once its radius is rounded. Uniform radii
     * never get there (r <= ~half a side), and are left untouched so their
     * rendering stays exactly the historical one.
     * @param {number[]} radii - Integer radii [topLeft, topRight, bottomRight, bottomLeft],
     *   clamped IN PLACE (normalizeCornerRadii's shared scratch)
     * @param {number} frameW - Frame width in pixels (rightX - leftX + 1)
     * @param {number} frameH - Frame height in pixels (bottomY - topY + 1)
     * @private
     */
    static _fitRadiiToFrame(radii, frameW, frameH) {
        if (radii[0] === radii[1] && radii[0] === radii[2] && radii[0] === radii[3]) return;
        const maxR = Math.max(0, Math.min(frameW, frameH) - 1);
        for (let i = 0; i < 4; i++) {
            if (radii[i] > maxR) radii[i] = maxR;
        }
    }

    // =========================================================================
    // Axis-Aligned Public Static Methods
    // =========================================================================

    /**
     * Direct rendering for 1px opaque stroke on axis-aligned rounded rectangle.
     * Uses direct pixel setting for corners via angle iteration and
     * horizontal/vertical line drawing for straight edges.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius, or a list of 1-4 corner radii
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static stroke1px_AA_Opaq(surface, x, y, width, height, radii, color, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Normalize radii
        const corners = RoundedRectUtils.normalizeCornerRadii(radii, width, height);

        // Fallback to RectOps when no corner is rounded (rounded rect becomes regular rect)
        if (corners[0] <= 0 && corners[1] <= 0 && corners[2] <= 0 && corners[3] <= 0) {
            RectOpsAA.stroke1px_AA_Opaq(surface, x, y, width, height, color, clipBuffer, clipRect);
            return;
        }

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Tier-0 rect clip bounds — see RectOpsAA.fill_AA_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        // Snap the stroke onto one device-pixel frame up front, and derive BOTH the
        // edge runs and the corner centers from it. Edges and corners must share one
        // frame: deriving the corners from the raw (possibly fractional) rect instead
        // lets the pixel-centered crisp spelling (x/y at *.5 — the standard HTML5
        // 1px-stroke idiom) land its corner arcs one pixel inside the snapped edge
        // lines, doubling pixels at the junctions. For integer input every frame value
        // equals the raw arithmetic it replaces, so that rendering is unchanged.
        const leftX = Math.floor(x);
        const topY = Math.floor(y);
        const rightX = Math.floor(x + width - 0.5);
        const bottomY = Math.floor(y + height - 0.5);
        RoundedRectOpsAA._fitRadiiToFrame(corners, rightX - leftX + 1, bottomY - topY + 1);
        const rTL = corners[0],
            rTR = corners[1],
            rBR = corners[2],
            rBL = corners[3];

        // Draw horizontal edges (top and bottom, excluding rounded corners; a
        // square corner's pixel is covered by the edges running into it)

        // Top edge
        if (topY >= cy0 && topY < cy1) {
            for (let xx = leftX + rTL; xx < rightX + 1 - rTR; xx++) {
                if (xx >= cx0 && xx < cx1) {
                    const pos = topY * surfaceWidth + xx;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }
        // Bottom edge
        if (bottomY >= cy0 && bottomY < cy1) {
            for (let xx = leftX + rBL; xx < rightX + 1 - rBR; xx++) {
                if (xx >= cx0 && xx < cx1) {
                    const pos = bottomY * surfaceWidth + xx;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }

        // Draw vertical edges (left and right, excluding rounded corners)

        // Left edge
        if (leftX >= cx0 && leftX < cx1) {
            for (let yy = topY + rTL; yy < bottomY + 1 - rBL; yy++) {
                if (yy >= cy0 && yy < cy1) {
                    const pos = yy * surfaceWidth + leftX;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }
        // Right edge
        if (rightX >= cx0 && rightX < cx1) {
            for (let yy = topY + rTR; yy < bottomY + 1 - rBR; yy++) {
                if (yy >= cy0 && yy < cy1) {
                    const pos = yy * surfaceWidth + rightX;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }

        // Draw corner arcs using angle iteration (Bresenham-style)
        // For a 1px stroke, we draw at radius - 0.5 to get proper pixel placement.
        // Each corner sweeps exactly one quadrant from startAngle, in a fixed 91-step
        // 1° iteration: a `angle <= endAngle` accumulation loop can skip the final
        // step to fp drift, and the quadrant endpoints are exactly the junction
        // pixels the edge runs above rely on. Math.cos/sin carry ~1e-16 noise at the
        // 90°-multiples (true value 0); with the integer frame-derived centers that
        // noise sits exactly on a floor() boundary and would shift the junction pixel
        // one unit — snap it to zero. A square (radius-0) corner has no arc.
        const drawCorner = (cx, cy, radius, startAngle) => {
            if (radius <= 0) return;
            const sr = radius - 0.5;
            for (let i = 0; i <= 90; i++) {
                const angle = startAngle + i * DEG_TO_RAD;
                let c = Math.cos(angle);
                let s = Math.sin(angle);
                if (Math.abs(c) < QUADRANT_TRIG_EPSILON) c = 0;
                if (Math.abs(s) < QUADRANT_TRIG_EPSILON) s = 0;
                const px = Math.floor(cx + sr * c);
                const py = Math.floor(cy + sr * s);
                if (px >= cx0 && px < cx1 && py >= cy0 && py < cy1) {
                    const pos = py * surfaceWidth + px;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        };

        // Top-left corner (180° to 270°)
        drawCorner(leftX + rTL, topY + rTL, rTL, Math.PI);
        // Top-right corner (270° to 360°)
        drawCorner(rightX + 1 - rTR, topY + rTR, rTR, THREE_HALF_PI);
        // Bottom-right corner (0° to 90°)
        drawCorner(rightX + 1 - rBR, bottomY + 1 - rBR, rBR, 0);
        // Bottom-left corner (90° to 180°)
        drawCorner(leftX + rBL, bottomY + 1 - rBL, rBL, HALF_PI);
    }

    /**
     * Direct rendering for 1px semi-transparent stroke on axis-aligned rounded rectangle.
     * Uses Set-based deduplication to prevent overdraw at edge-arc junctions.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius, or a list of 1-4 corner radii
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static stroke1px_AA_Alpha(
        surface,
        x,
        y,
        width,
        height,
        radii,
        color,
        globalAlpha,
        clipBuffer = null,
        clipRect = null
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Normalize radii
        const corners = RoundedRectUtils.normalizeCornerRadii(radii, width, height);

        // Fallback to RectOps when no corner is rounded (rounded rect becomes regular rect)
        if (corners[0] <= 0 && corners[1] <= 0 && corners[2] <= 0 && corners[3] <= 0) {
            RectOpsAA.stroke1px_AA_Alpha(surface, x, y, width, height, color, globalAlpha, clipBuffer, clipRect);
            return;
        }

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Tier-0 rect clip bounds — see RectOpsAA.fill_AA_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        // Snap the stroke onto one device-pixel frame up front, and derive the edge
        // runs AND the corner centers from it (same contract as stroke1px_AA_Opaq —
        // see the comment there). Sharing the frame matters even more here: the
        // shortened edges rely on the corners covering the junction pixels exactly,
        // so a corner center derived from a fractional raw rect does not just double
        // pixels — it leaves the junction pixels unpainted (visible gaps).
        const leftX = Math.floor(x);
        const topY = Math.floor(y);
        const rightX = Math.floor(x + width - 0.5);
        const bottomY = Math.floor(y + height - 0.5);
        RoundedRectOpsAA._fitRadiiToFrame(corners, rightX - leftX + 1, bottomY - topY + 1);
        const rTL = corners[0],
            rTR = corners[1],
            rBR = corners[2],
            rBL = corners[3];

        // Edge shortening strategy: shorten edges by 1 pixel at each end to avoid
        // junction overlap with corners. Corners naturally cover junction pixels.
        // This eliminates the need for a Set to prevent overdraw at junctions.
        // A square (radius-0) corner has no arc to cover its pixel, so ownership is
        // explicit there: the horizontal edge runs through it, the vertical edge
        // stops one short.

        // Helper to blend a pixel directly
        const blendPixel = (px, py) => {
            if (px < cx0 || px >= cx1 || py < cy0 || py >= cy1) return;
            const pixelIndex = py * surfaceWidth + px;
            if (clipBuffer) {
                const byteIndex = pixelIndex >> 3;
                const bitIndex = pixelIndex & 7;
                if (!(clipBuffer[byteIndex] & (1 << bitIndex))) return;
            }
            /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha)*/
        };

        // Draw horizontal edges (shortened by 1 pixel at each rounded end to avoid
        // junction overlap; running through a square corner's pixel)
        const topStart = rTL > 0 ? leftX + rTL + 1 : leftX; // Skip left junction pixel
        const topEnd = rTR > 0 ? rightX + 1 - rTR : rightX + 1; // Stop before right junction pixel
        for (let xx = topStart; xx < topEnd; xx++) {
            blendPixel(xx, topY);
        }
        const bottomStart = rBL > 0 ? leftX + rBL + 1 : leftX;
        const bottomEnd = rBR > 0 ? rightX + 1 - rBR : rightX + 1;
        for (let xx = bottomStart; xx < bottomEnd; xx++) {
            blendPixel(xx, bottomY);
        }

        // Draw vertical edges (shortened by 1 pixel at each end: at a rounded end the
        // corner arc owns the junction pixel, at a square end the horizontal edge does)
        const leftStart = topY + rTL + 1; // Skip top junction pixel
        const leftEnd = rBL > 0 ? bottomY + 1 - rBL : bottomY; // Stop before bottom junction pixel
        for (let yy = leftStart; yy < leftEnd; yy++) {
            blendPixel(leftX, yy);
        }
        const rightStart = topY + rTR + 1;
        const rightEnd = rBR > 0 ? bottomY + 1 - rBR : bottomY;
        for (let yy = rightStart; yy < rightEnd; yy++) {
            blendPixel(rightX, yy);
        }

        // Draw corner arcs with consecutive-duplicate tracking
        // Angle iteration can map multiple angles to the same pixel for small radii.
        // Since duplicates are always consecutive, tracking lastPos is sufficient.
        // Fixed 91-step quadrant sweep + quadrant-trig snap: see stroke1px_AA_Opaq —
        // here a missed quadrant endpoint is not overdraw slack but a junction GAP,
        // because the edges above deliberately stop one pixel short.
        const drawCorner = (cx, cy, radius, startAngle) => {
            if (radius <= 0) return;
            const sr = radius - 0.5;
            let lastPos = -1;
            for (let i = 0; i <= 90; i++) {
                const angle = startAngle + i * DEG_TO_RAD;
                let c = Math.cos(angle);
                let s = Math.sin(angle);
                if (Math.abs(c) < QUADRANT_TRIG_EPSILON) c = 0;
                if (Math.abs(s) < QUADRANT_TRIG_EPSILON) s = 0;
                const px = Math.floor(cx + sr * c);
                const py = Math.floor(cy + sr * s);
                if (px < cx0 || px >= cx1 || py < cy0 || py >= cy1) continue;
                const pos = py * surfaceWidth + px;
                if (pos === lastPos) continue; // Skip consecutive duplicate
                lastPos = pos;
                if (clipBuffer) {
                    const byteIndex = pos >> 3;
                    const bitIndex = pos & 7;
                    if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                }
                /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
            }
        };

        // Top-left corner (180° to 270°)
        drawCorner(leftX + rTL, topY + rTL, rTL, Math.PI);
        // Top-right corner (270° to 360°)
        drawCorner(rightX + 1 - rTR, topY + rTR, rTR, THREE_HALF_PI);
        // Bottom-right corner (0° to 90°)
        drawCorner(rightX + 1 - rBR, bottomY + 1 - rBR, rBR, 0);
        // Bottom-left corner (90° to 180°)
        drawCorner(leftX + rBL, bottomY + 1 - rBL, rBL, HALF_PI);
    }

    /**
     * Direct rendering for thick opaque stroke on axis-aligned rounded rectangle.
     * Uses scanline algorithm to fill the stroke region between inner and outer bounds.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static strokeThick_AA_Opaq(
        surface,
        x,
        y,
        width,
        height,
        radii,
        lineWidth,
        color,
        clipBuffer = null,
        clipRect = null
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Normalize radii
        const corners = RoundedRectUtils.normalizeCornerRadii(radii, width, height);

        // Fallback to RectOps when no corner is rounded (rounded rect becomes regular rect)
        if (corners[0] <= 0 && corners[1] <= 0 && corners[2] <= 0 && corners[3] <= 0) {
            RectOpsAA.strokeThick_AA_Opaq(surface, x, y, width, height, lineWidth, color, clipBuffer, clipRect);
            return;
        }

        const halfStroke = lineWidth / 2;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Tier-0 rect clip bounds — see RectOpsAA.fill_AA_Opaq. The inner (hole) extents get the
        // dual clamp below so the left/right stroke spans stay inside [cx0, cx1) even
        // when the clip rect cuts through the stroke band.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        // Calculate outer and inner bounds
        const outerX = Math.floor(x - halfStroke);
        const outerY = Math.floor(y - halfStroke);
        const outerW = Math.ceil(width + lineWidth);
        const outerH = Math.ceil(height + lineWidth);
        RoundedRectOpsAA._strokeEdgeRadii(corners, halfStroke);
        const outerRadii = _rrOuterRadiiScratch;

        const innerX = Math.floor(x + halfStroke);
        const innerY = Math.floor(y + halfStroke);
        const innerW = Math.floor(width - lineWidth);
        const innerH = Math.floor(height - lineWidth);
        const innerRadii = _rrInnerRadiiScratch;

        // For each scanline in the outer bounds
        for (let py = outerY; py < outerY + outerH; py++) {
            if (py < cy0 || py >= cy1) continue;

            // Get outer extent
            const outer = RoundedRectOpsAA._getXExtent(py, outerX, outerW, outerY, outerH, outerRadii);
            if (outer.rightX < outer.leftX) continue; // Outside outer bounds

            // Clamp outer to the clip frame (surface bounds when unclipped)
            const outerLeft = Math.max(cx0, outer.leftX);
            const outerRight = Math.min(cx1 - 1, outer.rightX);
            if (outerLeft > outerRight) continue;

            // Check if we're in the inner region (hollow part)
            if (innerW > 0 && innerH > 0 && py >= innerY && py < innerY + innerH) {
                const inner = RoundedRectOpsAA._getXExtent(py, innerX, innerW, innerY, innerH, innerRadii);

                if (inner.rightX >= inner.leftX) {
                    // Draw left and right stroke spans around the inner region.
                    // Dual clamp: the left span ends at innerLeft - 1 and the right span
                    // starts at innerRight + 1, so innerLeft must not exceed cx1 and
                    // innerRight must not fall below cx0 - 1 or a span would escape the
                    // clip frame on the far side of the hole.
                    const innerLeft = Math.min(cx1, Math.max(cx0, inner.leftX));
                    const innerRight = Math.max(cx0 - 1, Math.min(cx1 - 1, inner.rightX));

                    // Left span: from outerLeft to just before innerLeft
                    if (outerLeft < innerLeft) {
                        const leftSpanLength = innerLeft - outerLeft;
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            outerLeft,
                            py,
                            leftSpanLength,
                            packedColor,
                            clipBuffer
                        );
                    }

                    // Right span: from just after innerRight to outerRight
                    if (innerRight < outerRight) {
                        const rightSpanStart = innerRight + 1;
                        const rightSpanLength = outerRight - innerRight;
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            rightSpanStart,
                            py,
                            rightSpanLength,
                            packedColor,
                            clipBuffer
                        );
                    }
                } else {
                    // Inner region invalid at this Y, fill entire outer span
                    const spanLength = outerRight - outerLeft + 1;
                    SpanOps.fill_Opaq(
                        data32,
                        surfaceWidth,
                        surfaceHeight,
                        outerLeft,
                        py,
                        spanLength,
                        packedColor,
                        clipBuffer
                    );
                }
            } else {
                // Not in inner region, fill entire outer span
                const spanLength = outerRight - outerLeft + 1;
                SpanOps.fill_Opaq(
                    data32,
                    surfaceWidth,
                    surfaceHeight,
                    outerLeft,
                    py,
                    spanLength,
                    packedColor,
                    clipBuffer
                );
            }
        }
    }

    /**
     * Direct rendering for thick semi-transparent stroke on axis-aligned rounded rectangle.
     * Uses scanline algorithm with alpha blending.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static strokeThick_AA_Alpha(
        surface,
        x,
        y,
        width,
        height,
        radii,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer = null,
        clipRect = null
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Normalize radii
        const corners = RoundedRectUtils.normalizeCornerRadii(radii, width, height);

        // Fallback to RectOps when no corner is rounded (rounded rect becomes regular rect)
        if (corners[0] <= 0 && corners[1] <= 0 && corners[2] <= 0 && corners[3] <= 0) {
            RectOpsAA.strokeThick_AA_Alpha(
                surface,
                x,
                y,
                width,
                height,
                lineWidth,
                color,
                globalAlpha,
                clipBuffer,
                clipRect
            );
            return;
        }

        const halfStroke = lineWidth / 2;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Tier-0 rect clip bounds + inner dual clamp — see strokeThick_AA_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        // Calculate outer and inner bounds
        const outerX = Math.floor(x - halfStroke);
        const outerY = Math.floor(y - halfStroke);
        const outerW = Math.ceil(width + lineWidth);
        const outerH = Math.ceil(height + lineWidth);
        RoundedRectOpsAA._strokeEdgeRadii(corners, halfStroke);
        const outerRadii = _rrOuterRadiiScratch;

        const innerX = Math.floor(x + halfStroke);
        const innerY = Math.floor(y + halfStroke);
        const innerW = Math.floor(width - lineWidth);
        const innerH = Math.floor(height - lineWidth);
        const innerRadii = _rrInnerRadiiScratch;

        // For each scanline in the outer bounds
        for (let py = outerY; py < outerY + outerH; py++) {
            if (py < cy0 || py >= cy1) continue;

            const outer = RoundedRectOpsAA._getXExtent(py, outerX, outerW, outerY, outerH, outerRadii);
            if (outer.rightX < outer.leftX) continue;

            const outerLeft = Math.max(cx0, outer.leftX);
            const outerRight = Math.min(cx1 - 1, outer.rightX);
            if (outerLeft > outerRight) continue;

            if (innerW > 0 && innerH > 0 && py >= innerY && py < innerY + innerH) {
                const inner = RoundedRectOpsAA._getXExtent(py, innerX, innerW, innerY, innerH, innerRadii);

                if (inner.rightX >= inner.leftX) {
                    const innerLeft = Math.min(cx1, Math.max(cx0, inner.leftX));
                    const innerRight = Math.max(cx0 - 1, Math.min(cx1 - 1, inner.rightX));

                    if (outerLeft < innerLeft) {
                        const leftSpanLength = innerLeft - outerLeft;
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            outerLeft,
                            py,
                            leftSpanLength,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }

                    if (innerRight < outerRight) {
                        const rightSpanStart = innerRight + 1;
                        const rightSpanLength = outerRight - innerRight;
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            rightSpanStart,
                            py,
                            rightSpanLength,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }
                } else {
                    const spanLength = outerRight - outerLeft + 1;
                    SpanOps.fill_Alpha(
                        data,
                        surfaceWidth,
                        surfaceHeight,
                        outerLeft,
                        py,
                        spanLength,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            } else {
                const spanLength = outerRight - outerLeft + 1;
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    outerLeft,
                    py,
                    spanLength,
                    r,
                    g,
                    b,
                    effectiveAlpha,
                    invAlpha,
                    clipBuffer
                );
            }
        }
    }

    /**
     * Unified fill and stroke rendering for rounded rectangles.
     * Draws both in a single coordinated pass to prevent fill/stroke gaps (speckles).
     * Fill is rendered first, then stroke is rendered on top.
     *
     * Fill extent strategy (per scanline):
     * - Thick semi-transparent stroke (lineWidth > 1): Fill to PATH extent so stroke
     *   can blend on top, creating proper 3-color overlap (background, fill, fill+stroke)
     * - 1px or opaque stroke: Fill to INNER extent (no meaningful overlap area for 1px;
     *   opaque stroke covers fill anyway)
     *
     * Key insight: All corner arcs (fill, outer stroke, inner stroke) must use the SAME
     * corner center point, just with different radii. This ensures pixel-perfect alignment.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius, or a list of 1-4 corner radii
     * @param {number} lineWidth - Stroke width
     * @param {Color|null} fillColor - Fill color (null to skip fill)
     * @param {Color|null} strokeColor - Stroke color (null to skip stroke)
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static fillStroke_AA_Any(
        surface,
        x,
        y,
        width,
        height,
        radii,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer = null,
        clipRect = null
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        // Normalize radii
        const corners = RoundedRectUtils.normalizeCornerRadii(radii, width, height);

        // Fallback to separate methods when no corner is rounded. The clip args MUST
        // be forwarded on every hand-off (the fill half historically dropped them
        // and painted unclipped — the same clip-drop class the radius<1
        // fill/stroke fallbacks had).
        if (corners[0] <= 0 && corners[1] <= 0 && corners[2] <= 0 && corners[3] <= 0) {
            if (hasFill) {
                if (fillColor.a === 255 && globalAlpha >= 1.0) {
                    RectOpsAA.fill_AA_Opaq(surface, x, y, width, height, fillColor, clipBuffer, clipRect);
                } else {
                    RectOpsAA.fill_AA_Alpha(surface, x, y, width, height, fillColor, globalAlpha, clipBuffer, clipRect);
                }
            }
            if (hasStroke) {
                if (strokeColor.a === 255 && globalAlpha >= 1.0) {
                    RectOpsAA.strokeThick_AA_Opaq(
                        surface,
                        x,
                        y,
                        width,
                        height,
                        lineWidth,
                        strokeColor,
                        clipBuffer,
                        clipRect
                    );
                } else {
                    RectOpsAA.strokeThick_AA_Alpha(
                        surface,
                        x,
                        y,
                        width,
                        height,
                        lineWidth,
                        strokeColor,
                        globalAlpha,
                        clipBuffer,
                        clipRect
                    );
                }
            }
            return;
        }

        // Tier-0 rect clip bounds — see RectOpsAA.fill_AA_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        const halfStroke = lineWidth / 2;

        // Use PATH coordinates as reference for fill
        const pathX = Math.floor(x);
        const pathY = Math.floor(y);
        const pathW = Math.floor(width);
        const pathH = Math.floor(height);
        const pathRadii = corners;

        // Radii for different boundaries
        RoundedRectOpsAA._strokeEdgeRadii(pathRadii, halfStroke);
        const outerRadii = _rrOuterRadiiScratch; // Stroke outer edge
        const innerRadii = _rrInnerRadiiScratch; // Stroke inner edge

        // Calculate scan bounds - use original coordinates (not floored pathX/pathY)
        const scanMinY = Math.floor(y - halfStroke);
        const scanMaxY = Math.ceil(y + height + halfStroke);

        // Determine rendering modes
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;

        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Helper to render fill span via SpanOps
        const renderFillSpan = (startX, endX, py) => {
            if (startX > endX) return;
            const x0 = Math.max(cx0, startX);
            const x1 = Math.min(cx1 - 1, endX);
            if (x0 > x1) return;
            const spanLength = x1 - x0 + 1;

            if (fillIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, py, spanLength, fillPacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    x0,
                    py,
                    spanLength,
                    fillColor.r,
                    fillColor.g,
                    fillColor.b,
                    fillEffectiveAlpha,
                    fillInvAlpha,
                    clipBuffer
                );
            }
        };

        // Helper to render stroke span via SpanOps
        const renderStrokeSpan = (startX, endX, py) => {
            if (startX > endX) return;
            const x0 = Math.max(cx0, startX);
            const x1 = Math.min(cx1 - 1, endX);
            if (x0 > x1) return;
            const spanLength = x1 - x0 + 1;

            if (strokeIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, py, spanLength, strokePacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    x0,
                    py,
                    spanLength,
                    strokeColor.r,
                    strokeColor.g,
                    strokeColor.b,
                    strokeEffectiveAlpha,
                    strokeInvAlpha,
                    clipBuffer
                );
            }
        };

        // Calculate stroke bounds - use original coordinates (like strokeThick_AA_Opaq)
        // This avoids double-flooring which causes 1px shift when x/y have .5 fractional parts
        const outerRectX = Math.floor(x - halfStroke);
        const outerRectY = Math.floor(y - halfStroke);
        const outerRectW = Math.ceil(width + lineWidth);
        const outerRectH = Math.ceil(height + lineWidth);

        const innerRectX = Math.floor(x + halfStroke);
        const innerRectY = Math.floor(y + halfStroke);
        const innerRectW = Math.floor(width - lineWidth);
        const innerRectH = Math.floor(height - lineWidth);

        // Process each scanline in the scan bounds
        for (let py = scanMinY; py < scanMaxY; py++) {
            if (py < cy0 || py >= cy1) continue;

            // Get outer stroke extent - uses calculated bounds from original coordinates
            const outerExtent = hasStroke
                ? RoundedRectOpsAA._getXExtent(py, outerRectX, outerRectW, outerRectY, outerRectH, outerRadii, 0)
                : { leftX: 0, rightX: -1 };

            // Get inner stroke extent - uses calculated bounds from original coordinates
            const innerExtent =
                hasStroke && innerRectH > 0
                    ? RoundedRectOpsAA._getXExtent(py, innerRectX, innerRectW, innerRectY, innerRectH, innerRadii, 0)
                    : { leftX: 0, rightX: -1 };

            // Determine fill extent based on stroke transparency
            let fillExtent = { leftX: 0, rightX: -1 };
            if (hasFill) {
                if (hasStroke) {
                    // Check if stroke is semi-transparent (needs overlap blending)
                    const strokeIsSemiTransparent = strokeEffectiveAlpha < 1.0;

                    if (strokeIsSemiTransparent && lineWidth > 1) {
                        // Thick semi-transparent stroke: fill to PATH extent
                        // Stroke will blend ON TOP of this fill for correct alpha overlap color
                        fillExtent = RoundedRectOpsAA._getXExtent(
                            py,
                            pathX,
                            pathW,
                            pathY,
                            pathH,
                            pathRadii,
                            FILL_EPSILON
                        );
                    } else {
                        // Opaque OR 1px semi-transparent: fill to inner extent
                        // (1px has no visible overlap area; opaque stroke covers fill anyway)
                        if (innerExtent.rightX >= innerExtent.leftX) {
                            fillExtent.leftX = innerExtent.leftX;
                            fillExtent.rightX = innerExtent.rightX;
                        }
                    }
                } else {
                    // Fill-only: use standard fill extent calculation
                    fillExtent = RoundedRectOpsAA._getXExtent(py, pathX, pathW, pathY, pathH, pathRadii, FILL_EPSILON);
                }
            }

            // STEP 1: Render fill first (uses path extent or inner extent based on stroke type)
            if (hasFill && fillExtent.leftX <= fillExtent.rightX) {
                renderFillSpan(fillExtent.leftX, fillExtent.rightX, py);
            }

            // STEP 2: Render stroke on top (covers any micro-gaps at boundary)
            if (hasStroke && outerExtent.rightX >= outerExtent.leftX) {
                const outerLeft = Math.max(0, outerExtent.leftX);
                const outerRight = Math.min(surfaceWidth - 1, outerExtent.rightX);

                if (outerLeft <= outerRight) {
                    if (innerExtent.rightX >= innerExtent.leftX) {
                        // Has inner region - draw left and right stroke segments
                        const innerLeft = Math.max(0, innerExtent.leftX);
                        const innerRight = Math.min(surfaceWidth - 1, innerExtent.rightX);

                        // Left stroke segment
                        if (outerLeft < innerLeft) {
                            renderStrokeSpan(outerLeft, innerLeft - 1, py);
                        }

                        // Right stroke segment
                        if (innerRight < outerRight) {
                            renderStrokeSpan(innerRight + 1, outerRight, py);
                        }
                    } else {
                        // No inner region - fill entire stroke span
                        renderStrokeSpan(outerLeft, outerRight, py);
                    }
                }
            }
        }
    }
}

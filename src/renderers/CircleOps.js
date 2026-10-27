/**
 * CircleOps - Static methods for optimized circle rendering
 * Follows PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillCircle(), strokeCircle(), fillStrokeCircle()
 *
 * Path-based circles (beginPath() + arc() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * Coverage rule (fills): PIXEL-CENTER SAMPLING - a pixel is filled iff its
 * center (x + 0.5, y + 0.5) lies strictly inside the circle (row extents by
 * sqrt, contracted by FILL_EPSILON so a center on the boundary stays out).
 * fill_Opaq, fill_Alpha and fillStroke_Any's fill share that one rule, so a
 * fill is pixel-identical to the fill half of the fused entry. The 1px
 * strokes stay Bresenham rings (their own center convention - see
 * tests/core/050); thick strokes sample the closed annulus.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Primitives):
 *   fill_Opaq, fill_Alpha              → SpanOps.fill_Opaq/fill_Alpha
 *   stroke1px_Opaq                     → Direct pixel writes (opaque)
 *   stroke1px_Alpha                    → Inline BLEND_ALPHA marker
 *   strokeThick_Opaq                   → SpanOps.fill_Opaq
 *   strokeThick_Alpha                  → SpanOps.fill_Alpha
 *
 * Layer 2 (Composites):
 *   fillStroke_Any                     → SpanOps.fill_Opaq/fill_Alpha
 *
 * MEMORY OPTIMIZATIONS:
 * - stroke1px_Alpha uses conditional deduplication (no Set allocation)
 *   via x!=y + cardinal point checks to prevent overdraw
 *
 * NAMING PATTERN: {operation}[Thickness]_{opacity}
 *   - Opaq = Opaque only, Alpha = Semi-transparent, Any = Handles both
 *   - (No orientation suffix - circles are rotation-invariant)
 */
class CircleOps {
    // Per-row span scratch of the fills' two passes (fill_Opaq / fill_Alpha): grown on
    // demand, never shrunk, shared by every call
    static _spanStarts = new Int32Array(64);
    static _spanEnds = new Int32Array(64);

    /**
     * Grow the fills' span scratch to hold at least `rows` rows.
     * @param {number} rows - Rows needed
     * @private
     */
    static _growSpanScratch(rows) {
        let capacity = CircleOps._spanStarts.length * 2;
        while (capacity < rows) capacity *= 2;
        CircleOps._spanStarts = new Int32Array(capacity);
        CircleOps._spanEnds = new Int32Array(capacity);
    }

    /**
     * Opaque circle fill: pixel-center-sampled scanlines (class header), 32-bit packed writes
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Fill color (must be opaque, alpha=255)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static fill_Opaq(surface, cx, cy, radius, color, clipBuffer = null, clipRect = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Clip rect bounds: with no clipRect the defaults are the surface bounds, so
        // rendering without one is byte-identical by construction. Any clipBuffer
        // is still tested per pixel (by SpanOps), so the pixels written are
        // exactly mask ∧ rect (see Context2D._clipRectForDraw).
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : width;
        const cy1 = clipRect ? clipRect.y1 : height;

        // Pixel-center sampling (class header): row y's centers sit at
        // dy = y - cY from the center, and the row's span is the centers
        // strictly within xDist of cX. Same arithmetic as fillStroke_Any's fill.
        const cX = cx - 0.5;
        const cY = cy - 0.5;
        const radiusSquared = radius * radius;
        const minY = Math.max(cy0, Math.ceil(cY - radius));
        const maxY = Math.min(cy1 - 1, Math.floor(cY + radius));
        if (!(minY <= maxY)) return;
        // From here every row and span bound is held as an int32: the rows lie in the clip rect's
        // rows, and each span is clamped to its columns (one past either side when the row is
        // empty, which keeps startX > endX exactly when no column is inside)
        const firstRow = minY | 0;
        const lastRow = maxY | 0;

        // Two passes. First every row's span into the int32 scratch - rows are independent, so
        // their square roots and roundings pipeline, with no call between them - then the spans.
        const rows = lastRow - firstRow + 1;
        if (CircleOps._spanStarts.length < rows) CircleOps._growSpanScratch(rows);
        const starts = CircleOps._spanStarts;
        const ends = CircleOps._spanEnds;
        for (let i = 0; i < rows; i++) {
            const dy = firstRow + i - cY;
            const distSquared = radiusSquared - dy * dy;
            if (distSquared < 0) {
                starts[i] = 1;
                ends[i] = 0;
                continue;
            }
            const xDist = Math.sqrt(distSquared);
            starts[i] = Math.min(cx1, Math.max(cx0, Math.ceil(cX - xDist + FILL_EPSILON)));
            ends[i] = Math.max(cx0 - 1, Math.min(cx1 - 1, Math.floor(cX + xDist - FILL_EPSILON)));
        }
        for (let i = 0; i < rows; i++) {
            const startX = starts[i];
            const endX = ends[i];
            if (startX > endX) continue;
            SpanOps.fill_Opaq(data32, width, height, startX, firstRow + i, endX - startX + 1, packedColor, clipBuffer);
        }
    }

    /**
     * Circle fill with alpha blending: pixel-center-sampled scanlines (class header)
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static fill_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer = null, clipRect = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        // Calculate effective alpha (color alpha * global alpha)
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;

        const invAlpha = 1 - effectiveAlpha;
        const r = color.r;
        const g = color.g;
        const b = color.b;

        // Tier-0 rect clip bounds — see fill_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : width;
        const cy1 = clipRect ? clipRect.y1 : height;

        // Pixel-center sampling - see fill_Opaq.
        const cX = cx - 0.5;
        const cY = cy - 0.5;
        const radiusSquared = radius * radius;
        const minY = Math.max(cy0, Math.ceil(cY - radius));
        const maxY = Math.min(cy1 - 1, Math.floor(cY + radius));
        if (!(minY <= maxY)) return;
        // From here every row and span bound is held as an int32: the rows lie in the clip rect's
        // rows, and each span is clamped to its columns (one past either side when the row is
        // empty, which keeps startX > endX exactly when no column is inside)
        const firstRow = minY | 0;
        const lastRow = maxY | 0;

        // Two passes. First every row's span into the int32 scratch - rows are independent, so
        // their square roots and roundings pipeline, with no call between them - then the spans.
        const rows = lastRow - firstRow + 1;
        if (CircleOps._spanStarts.length < rows) CircleOps._growSpanScratch(rows);
        const starts = CircleOps._spanStarts;
        const ends = CircleOps._spanEnds;
        for (let i = 0; i < rows; i++) {
            const dy = firstRow + i - cY;
            const distSquared = radiusSquared - dy * dy;
            if (distSquared < 0) {
                starts[i] = 1;
                ends[i] = 0;
                continue;
            }
            const xDist = Math.sqrt(distSquared);
            starts[i] = Math.min(cx1, Math.max(cx0, Math.ceil(cX - xDist + FILL_EPSILON)));
            ends[i] = Math.max(cx0 - 1, Math.min(cx1 - 1, Math.floor(cX + xDist - FILL_EPSILON)));
        }
        for (let i = 0; i < rows; i++) {
            const startX = starts[i];
            const endX = ends[i];
            if (startX > endX) continue;
            SpanOps.fill_Alpha(
                data,
                width,
                height,
                startX,
                firstRow + i,
                endX - startX + 1,
                r,
                g,
                b,
                effectiveAlpha,
                invAlpha,
                clipBuffer
            );
        }
    }

    /**
     * Optimized 1px opaque circle stroke using Bresenham's algorithm
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static stroke1px_Opaq(surface, cx, cy, radius, color, clipBuffer = null, clipRect = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Tier-0 rect clip bounds — see fill_Opaq. The per-pixel plots below
        // bounds-check against these instead of the raw surface bounds.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : width;
        const cy1 = clipRect ? clipRect.y1 : height;

        // Center calculation for stroke (standard Bresenham approach)
        const cX = Math.floor(cx);
        const cY = Math.floor(cy);
        const intRadius = Math.floor(radius);

        if (intRadius < 0) return;

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            if (radius >= 0) {
                const px = Math.round(cx);
                const py = Math.round(cy);
                if (px >= cx0 && px < cx1 && py >= cy0 && py < cy1) {
                    const pos = py * width + px;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        data32[pos] = packedColor;
                    }
                }
            }
            return;
        }

        // Determine offsets for .5 radius case
        let xOffset = 0,
            yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        // Bresenham circle algorithm
        let x = 0;
        let y = intRadius;
        let d = 3 - 2 * intRadius;

        while (x <= y) {
            // Calculate 8 symmetric points with offsets for top/left halves
            // Note: Quadrant labels use screen coordinates (Y-down). In standard math (Y-up):
            // bottom-right = Q1, top-right = Q4, top-left = Q3, bottom-left = Q2
            const p1x = cX + x,
                p1y = cY + y; // bottom-right (math: Q1)
            const p2x = cX + y,
                p2y = cY + x; // bottom-right (math: Q1)
            const p3x = cX + y,
                p3y = cY - x - yOffset; // top-right (math: Q4)
            const p4x = cX + x,
                p4y = cY - y - yOffset; // top-right (math: Q4)
            const p5x = cX - x - xOffset,
                p5y = cY - y - yOffset; // top-left (math: Q3)
            const p6x = cX - y - xOffset,
                p6y = cY - x - yOffset; // top-left (math: Q3)
            const p7x = cX - y - xOffset,
                p7y = cY + x; // bottom-left (math: Q2)
            const p8x = cX - x - xOffset,
                p8y = cY + y; // bottom-left (math: Q2)

            // Plot points with bounds checking
            if (p1x >= cx0 && p1x < cx1 && p1y >= cy0 && p1y < cy1) {
                const pos = p1y * width + p1x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (x !== y && p2x >= cx0 && p2x < cx1 && p2y >= cy0 && p2y < cy1) {
                const pos = p2y * width + p2x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p3x >= cx0 && p3x < cx1 && p3y >= cy0 && p3y < cy1) {
                const pos = p3y * width + p3x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p4x >= cx0 && p4x < cx1 && p4y >= cy0 && p4y < cy1) {
                const pos = p4y * width + p4x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p5x >= cx0 && p5x < cx1 && p5y >= cy0 && p5y < cy1) {
                const pos = p5y * width + p5x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (x !== y && p6x >= cx0 && p6x < cx1 && p6y >= cy0 && p6y < cy1) {
                const pos = p6y * width + p6x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p7x >= cx0 && p7x < cx1 && p7y >= cy0 && p7y < cy1) {
                const pos = p7y * width + p7x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p8x >= cx0 && p8x < cx1 && p8y >= cy0 && p8y < cy1) {
                const pos = p8y * width + p8x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }

            // Update Bresenham state
            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }
    }

    /**
     * Optimized 1px semi-transparent circle stroke using Bresenham's algorithm
     * Uses Set to prevent overdraw for semi-transparent colors
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static stroke1px_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer = null, clipRect = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Tier-0 rect clip bounds — see fill_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : width;
        const cy1 = clipRect ? clipRect.y1 : height;

        // Center calculation for stroke (standard Bresenham approach)
        const cX = Math.floor(cx);
        const cY = Math.floor(cy);
        const intRadius = Math.floor(radius);

        if (intRadius < 0) return;

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            if (radius >= 0) {
                const px = Math.round(cx);
                const py = Math.round(cy);
                if (px >= cx0 && px < cx1 && py >= cy0 && py < cy1) {
                    const pos = py * width + px;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
            }
            return;
        }

        // Determine offsets for .5 radius case
        let xOffset = 0,
            yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        // Bresenham circle algorithm with conditional checks to prevent overdraw
        // (eliminates Set allocation by using geometric deduplication)
        let x = 0;
        let y = intRadius;
        let d = 3 - 2 * intRadius;

        while (x <= y) {
            // Calculate 8 symmetric points with offsets for top/left halves
            // Primary points (A, C, E, G) - always unique from each other
            // Note: Quadrant labels use screen coordinates (Y-down). In standard math (Y-up):
            // bottom-right = Q1, top-right = Q4, top-left = Q3, bottom-left = Q2
            const pAx = cX + x,
                pAy = cY + y; // bottom-right quadrant (math: Q1)
            const pCx = cX + y,
                pCy = cY - x - yOffset; // top-right quadrant (math: Q4)
            const pEx = cX - x - xOffset,
                pEy = cY - y - yOffset; // top-left quadrant (math: Q3)
            const pGx = cX - y - xOffset,
                pGy = cY + x; // bottom-left quadrant (math: Q2)

            // Swapped points (B, D, F, H) - duplicate primaries when x == y
            const pBx = cX + y,
                pBy = cY + x; // duplicates A when x == y
            const pDx = cX + x,
                pDy = cY - y - yOffset; // duplicates C when x == y
            const pFx = cX - y - xOffset,
                pFy = cY - x - yOffset; // duplicates E when x == y
            const pHx = cX - x - xOffset,
                pHy = cY + y; // duplicates G when x == y, also A when x == 0 && xOffset == 0

            // Draw primary points (always)
            if (pAx >= cx0 && pAx < cx1 && pAy >= cy0 && pAy < cy1) {
                const pos = pAy * width + pAx;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }
            if (pCx >= cx0 && pCx < cx1 && pCy >= cy0 && pCy < cy1) {
                const pos = pCy * width + pCx;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }
            if (pEx >= cx0 && pEx < cx1 && pEy >= cy0 && pEy < cy1) {
                const pos = pEy * width + pEx;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }
            if (pGx >= cx0 && pGx < cx1 && pGy >= cy0 && pGy < cy1) {
                const pos = pGy * width + pGx;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }

            // Draw swapped points only when x != y (they duplicate primaries on the diagonal)
            // Additional cardinal point checks: at x == 0, swapped points may duplicate primaries
            if (x !== y) {
                // B duplicates C at right cardinal when x == 0 && yOffset == 0
                if ((x !== 0 || yOffset !== 0) && pBx >= cx0 && pBx < cx1 && pBy >= cy0 && pBy < cy1) {
                    const pos = pBy * width + pBx;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
                // D duplicates E at top cardinal when x == 0 && xOffset == 0
                if ((x !== 0 || xOffset !== 0) && pDx >= cx0 && pDx < cx1 && pDy >= cy0 && pDy < cy1) {
                    const pos = pDy * width + pDx;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
                // F duplicates G at left cardinal when x == 0 && yOffset == 0
                if ((x !== 0 || yOffset !== 0) && pFx >= cx0 && pFx < cx1 && pFy >= cy0 && pFy < cy1) {
                    const pos = pFy * width + pFx;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
                // H duplicates A at bottom cardinal when x == 0 && xOffset == 0
                if ((x !== 0 || xOffset !== 0) && pHx >= cx0 && pHx < cx1 && pHy >= cy0 && pHy < cy1) {
                    const pos = pHy * width + pHx;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
            }

            // Update Bresenham state
            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }
    }

    /**
     * Unified fill and stroke rendering for circles.
     * This method draws both fill and stroke in a single coordinated pass,
     * ensuring no gaps between fill and stroke boundaries.
     *
     * Optimized circle fill+stroke approach using:
     * - Uses single floating-point center (cx - 0.5) for both operations
     * - Uses analytical boundary detection (sqrt-based) instead of Bresenham extents
     * - Uses epsilon contraction (FILL_EPSILON) on fill boundaries to prevent speckles
     * - Renders fill first, then stroke on top (stroke covers any micro-gaps)
     *
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius (path radius)
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color
     * @param {Color} strokeColor - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static fillStroke_Any(
        surface,
        cx,
        cy,
        radius,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer = null,
        clipRect = null
    ) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0;

        if (!hasFill && !hasStroke) return;

        // Tier-0 rect clip bounds — see fill_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : width;
        const cy1 = clipRect ? clipRect.y1 : height;

        // Single floating-point center for both fill and stroke
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate radii based on stroke width
        // The path radius is the center of the stroke
        // Inner radius = radius - lineWidth/2 (fill boundary / stroke inner edge)
        // Outer radius = radius + lineWidth/2 (stroke outer edge)
        // Fill extends to the path radius (center of stroke)
        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;
        const fillRadius = radius; // Path radius is the fill boundary

        // Calculate bounds (clamped to the surface/clip rect)
        const minY = Math.max(cy0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(cy1 - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(cx0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(cx1 - 1, Math.ceil(cX + outerRadius + 1));

        // Skip if completely outside canvas
        if (minY > maxY || minX > maxX) return;

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;
        const fillRadiusSquared = fillRadius * fillRadius;

        // Determine rendering mode for fill
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;

        // Determine rendering mode for stroke
        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSquared) continue;

            // Calculate outer circle X intersections (stroke outer boundary)
            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

            // Calculate fill boundaries if this row intersects the fill area
            let leftFillX = -1;
            let rightFillX = -1;
            const fillDistSquared = fillRadiusSquared - dySquared;
            if (hasFill && fillDistSquared >= 0) {
                const fillXDist = Math.sqrt(fillDistSquared);
                // Epsilon contraction to prevent speckles at boundary
                leftFillX = Math.max(minX, Math.ceil(cX - fillXDist + FILL_EPSILON));
                rightFillX = Math.min(maxX, Math.floor(cX + fillXDist - FILL_EPSILON));
            }

            // Calculate inner circle boundaries (stroke inner boundary).
            // Clamp into [outerLeftX, outerRightX] like strokeThick_Opaq does:
            // unclamped, a partially off-surface (or clipped) circle hands SpanOps
            // a span start/end outside the surface — SpanOps does NOT clamp, so a
            // negative start wraps into the previous row (memory corruption).
            let innerLeftX = outerRightX + 1; // Default: no inner circle intersection
            let innerRightX = outerLeftX - 1;
            if (innerRadius > 0 && dySquared <= innerRadiusSquared) {
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                innerLeftX = Math.min(outerRightX, Math.floor(cX - innerXDist));
                innerRightX = Math.max(outerLeftX, Math.ceil(cX + innerXDist));
            }

            // STEP 1: Render fill first (if this row intersects the fill circle) via SpanOps
            if (hasFill && leftFillX >= 0 && leftFillX <= rightFillX) {
                const fillSpanLength = rightFillX - leftFillX + 1;
                if (fillIsOpaque) {
                    SpanOps.fill_Opaq(data32, width, height, leftFillX, y, fillSpanLength, fillPacked, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        leftFillX,
                        y,
                        fillSpanLength,
                        fillColor.r,
                        fillColor.g,
                        fillColor.b,
                        fillEffectiveAlpha,
                        fillInvAlpha,
                        clipBuffer
                    );
                }
            }

            // STEP 2: Render stroke on top (covers any micro-gaps) via SpanOps
            if (hasStroke) {
                // Helper function to render a stroke segment via SpanOps
                const renderStrokeSegment = (startX, endX) => {
                    if (startX > endX) return;
                    const spanLength = endX - startX + 1;
                    if (strokeIsOpaque) {
                        SpanOps.fill_Opaq(data32, width, height, startX, y, spanLength, strokePacked, clipBuffer);
                    } else {
                        SpanOps.fill_Alpha(
                            data,
                            width,
                            height,
                            startX,
                            y,
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

                if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                    // No inner circle intersection - draw entire stroke span
                    renderStrokeSegment(outerLeftX, outerRightX);
                } else {
                    // Intersects both inner and outer circles - draw left and right segments
                    renderStrokeSegment(outerLeftX, innerLeftX);
                    renderStrokeSegment(innerRightX, outerRightX);
                }
            }
        }
    }

    /**
     * Optimized thick opaque stroke circle using scanline-based annulus rendering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static strokeThick_Opaq(surface, cx, cy, radius, lineWidth, color, clipBuffer = null, clipRect = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Tier-0 rect clip bounds — see fill_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : width;
        const cy1 = clipRect ? clipRect.y1 : height;

        // Calculate inner and outer radii for the stroke annulus
        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;

        // Use exact centers for Canvas coordinate alignment
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate bounds with safety margin (clamped to the surface/clip rect)
        const minY = Math.max(cy0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(cy1 - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(cx0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(cx1 - 1, Math.ceil(cX + outerRadius + 1));

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSquared) continue;

            // Calculate outer circle X intersections
            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

            // Case: No inner circle intersection (draw full span)
            if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                const spanLength = outerRightX - outerLeftX + 1;
                if (spanLength > 0) {
                    SpanOps.fill_Opaq(data32, width, height, outerLeftX, y, spanLength, packedColor, clipBuffer);
                }
            } else {
                // Case: Intersects both circles - draw left and right segments
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                const innerLeftX = Math.min(outerRightX, Math.floor(cX - innerXDist));
                const innerRightX = Math.max(outerLeftX, Math.ceil(cX + innerXDist));

                // Left segment via SpanOps
                const leftLen = innerLeftX - outerLeftX + 1;
                if (leftLen > 0) {
                    SpanOps.fill_Opaq(data32, width, height, outerLeftX, y, leftLen, packedColor, clipBuffer);
                }

                // Right segment via SpanOps
                const rightLen = outerRightX - innerRightX + 1;
                if (rightLen > 0) {
                    SpanOps.fill_Opaq(data32, width, height, innerRightX, y, rightLen, packedColor, clipBuffer);
                }
            }
        }
    }

    /**
     * Thick stroke circle with alpha blending
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     * @param {{x0,y0,x1,y1}|null} clipRect - Tier-0 rect clip (half-open, pre-clamped to surface)
     */
    static strokeThick_Alpha(
        surface,
        cx,
        cy,
        radius,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer = null,
        clipRect = null
    ) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Tier-0 rect clip bounds — see fill_Opaq.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : width;
        const cy1 = clipRect ? clipRect.y1 : height;

        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        const minY = Math.max(cy0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(cy1 - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(cx0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(cx1 - 1, Math.ceil(cX + outerRadius + 1));

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;

        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            if (dySquared > outerRadiusSquared) continue;

            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

            if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                // No inner circle intersection - draw full span via SpanOps
                const spanLength = outerRightX - outerLeftX + 1;
                if (spanLength > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        outerLeftX,
                        y,
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
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                const innerLeftX = Math.min(outerRightX, Math.floor(cX - innerXDist));
                const innerRightX = Math.max(outerLeftX, Math.ceil(cX + innerXDist));

                // Left segment via SpanOps
                const leftLen = innerLeftX - outerLeftX + 1;
                if (leftLen > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        outerLeftX,
                        y,
                        leftLen,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }

                // Right segment via SpanOps
                const rightLen = outerRightX - innerRightX + 1;
                if (rightLen > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        innerRightX,
                        y,
                        rightLen,
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
    }
}

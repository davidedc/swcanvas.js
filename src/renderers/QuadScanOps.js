/**
 * QuadScanOps - Static methods for quadrilateral scanline filling
 *
 * Specialized utility for filling 4-vertex convex shapes, sampling pixel centres exactly as
 * PolygonFiller does (so a direct thick line paints what stroke() of the same line paints).
 * Used by LineOps (thick diagonal lines) and RectOpsRot (semi-transparent strokes).
 *
 * NOT for general polygons - use PolygonFiller for arbitrary N-vertex shapes
 * with winding rules and paint source support.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Primitives):
 *   lineToQuad - Convert line + thickness to 4 corners
 *   fillQuad   - Scanline fill the quad (calls SpanOps for spans)
 */
class QuadScanOps {
    // Static pools - reused across calls to eliminate GC pressure
    static _edges = [
        { ux: 0, uy: 0, ly: 0, dx: 0, dy: 0 },
        { ux: 0, uy: 0, ly: 0, dx: 0, dy: 0 },
        { ux: 0, uy: 0, ly: 0, dx: 0, dy: 0 },
        { ux: 0, uy: 0, ly: 0, dx: 0, dy: 0 }
    ];
    static _edgeCount = 0;

    static _corners = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
    ];

    // Per-row span scratch of fillQuad's two passes: grown on demand, never shrunk, shared by
    // every call
    static _spanStarts = new Int32Array(64);
    static _spanEnds = new Int32Array(64);

    /**
     * Grow fillQuad's span scratch to hold at least `rows` rows.
     * @param {number} rows - Rows needed
     * @private
     */
    static _growSpanScratch(rows) {
        let capacity = QuadScanOps._spanStarts.length * 2;
        while (capacity < rows) capacity *= 2;
        QuadScanOps._spanStarts = new Int32Array(capacity);
        QuadScanOps._spanEnds = new Int32Array(capacity);
    }

    /**
     * Convert a line segment to a quadrilateral by adding perpendicular thickness.
     *
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} halfThickness - Half the stroke width
     * @returns {Object[]|null} 4 corner points [{x, y}, ...] or null for zero-length
     */
    static lineToQuad(x1, y1, x2, y2, halfThickness) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lineLength = Math.sqrt(dx * dx + dy * dy);

        if (lineLength === 0) {
            return null; // Caller handles zero-length case
        }

        const invLineLength = 1 / lineLength;
        const perpX = -dy * invLineLength;
        const perpY = dx * invLineLength;
        const perpXHalf = perpX * halfThickness;
        const perpYHalf = perpY * halfThickness;

        // Reuse static corner pool instead of allocating new objects
        const c = QuadScanOps._corners;
        c[0].x = x1 + perpXHalf;
        c[0].y = y1 + perpYHalf;
        c[1].x = x1 - perpXHalf;
        c[1].y = y1 - perpYHalf;
        c[2].x = x2 - perpXHalf;
        c[2].y = y2 - perpYHalf;
        c[3].x = x2 + perpXHalf;
        c[3].y = y2 + perpYHalf;
        return c;
    }

    /**
     * Scanline fill a quadrilateral defined by 4 corners.
     *
     * @param {Object[]} corners - 4 corner points [{x, y}, ...]
     * @param {Object} params - Rendering parameters
     * @param {Surface} params.surface - Target surface
     * @param {number} params.r - Red component (0-255)
     * @param {number} params.g - Green component (0-255)
     * @param {number} params.b - Blue component (0-255)
     * @param {boolean} params.isOpaque - Use 32-bit writes (true) or alpha blend (false)
     * @param {number} [params.packedColor] - Pre-packed color for opaque rendering
     * @param {number} [params.effectiveAlpha] - Effective alpha (0-1) for blending
     * @param {number} [params.invAlpha] - 1 - effectiveAlpha for blending
     * @param {Uint8Array|null} params.clipBuffer - Clip mask (CLIPPING: inline per-pixel or delegated to SpanOps depending on mode)
     * @param {Set|null} [params.collectTo] - Add rendered pixel positions to this Set
     * @param {Set|null} [params.skipFrom] - Skip pixels that are in this Set
     * @param {number} [ox=0] - Device column the corners are relative to (a device frame,
     *   PolygonFiller._toDeviceFrame): columns are counted from it
     * @param {number} [oy=0] - Device row the corners are relative to: row y is sampled at
     *   y - oy + 0.5 in the corners' frame
     */
    static fillQuad(corners, params, ox = 0, oy = 0) {
        const { surface, r, g, b, isOpaque, clipBuffer } = params;
        const packedColor = params.packedColor || 0;
        const effectiveAlpha = params.effectiveAlpha || 0;
        const invAlpha = params.invAlpha || 0;
        const collectTo = params.collectTo || null;
        const skipFrom = params.skipFrom || null;

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const data = surface.data;

        // Find bounding box (device rows)
        const minY = Math.max(0, oy + Math.floor(Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y)));
        const maxY = Math.min(
            height - 1,
            oy + Math.ceil(Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y))
        );

        // Each non-horizontal edge by its UPPER end and its differences - exactly what
        // PolygonFiller._scanRow interpolates with (no allocation)
        QuadScanOps._edgeCount = 0;
        for (let i = 0; i < 4; i++) {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];
            if (p1.y === p2.y) continue; // exactly horizontal, as PolygonFiller skips
            const edge = QuadScanOps._edges[QuadScanOps._edgeCount++];
            const upper = p2.y > p1.y ? p1 : p2;
            const lower = p2.y > p1.y ? p2 : p1;
            edge.ux = upper.x;
            edge.uy = upper.y;
            edge.ly = lower.y;
            edge.dx = lower.x - upper.x;
            edge.dy = lower.y - upper.y;
        }

        if (!(minY <= maxY)) return;
        const edges = QuadScanOps._edges;
        const edgeCount = QuadScanOps._edgeCount;

        // Determine rendering mode
        const usePerPixel = collectTo !== null || skipFrom !== null;

        // Two passes. First every row's span into the int32 scratch - rows are independent, so
        // their divisions pipeline, with no call between them - then the spans, row by row in
        // the same order. Scanlines are sampled at pixel centres (y + 0.5) with the half-open
        // [upper, lower) edge test, each crossing interpolated from the edge's upper end: the
        // quad paints exactly the pixels PolygonFiller paints for the same four corners (a
        // stroke() of the line). A row's span runs between its first two crossings in edge order.
        const rows = maxY - minY + 1;
        if (QuadScanOps._spanStarts.length < rows) QuadScanOps._growSpanScratch(rows);
        const starts = QuadScanOps._spanStarts;
        const ends = QuadScanOps._spanEnds;
        for (let i = 0; i < rows; i++) {
            const sample = minY + i - oy + 0.5;
            let crossings = 0;
            let x1i = 0;
            let x2i = 0;
            for (let e = 0; e < edgeCount; e++) {
                const edge = edges[e];
                if (sample >= edge.uy && sample < edge.ly) {
                    const x = edge.ux + ((sample - edge.uy) / edge.dy) * edge.dx;
                    if (crossings === 0) x1i = x;
                    else if (crossings === 1) x2i = x;
                    crossings++;
                }
            }
            // Pixel-centre columns, as PolygonFiller: a column x is in the span [min, max) iff
            // min <= x + 0.5 < max. A row with no column inside is stored as an empty span
            // (start > end), which also keeps every stored bound inside the int32 range.
            const leftX = Math.max(0, ox + Math.ceil(Math.min(x1i, x2i) - 0.5));
            const rightX = Math.min(width - 1, ox + Math.ceil(Math.max(x1i, x2i) - 0.5) - 1);
            if (crossings >= 2 && rightX >= leftX) {
                starts[i] = leftX;
                ends[i] = rightX;
            } else {
                starts[i] = 1;
                ends[i] = 0;
            }
        }

        for (let i = 0; i < rows; i++) {
            const leftX = starts[i];
            const rightX = ends[i];
            if (rightX < leftX) continue;
            const y = minY + i;
            const spanLength = rightX - leftX + 1;

            if (usePerPixel) {
                // Per-pixel mode for Set tracking
                for (let x = leftX; x <= rightX; x++) {
                    const pixelIndex = y * width + x;

                    // Skip if in skipFrom Set
                    if (skipFrom && skipFrom.has(pixelIndex)) continue;

                    // Add to collectTo Set
                    if (collectTo) collectTo.add(pixelIndex);

                    // Check clipping
                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }

                    // Render pixel
                    if (isOpaque) {
                        data32[pixelIndex] = packedColor;
                    } else {
                        /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
            } else {
                // Span mode using SpanOps (faster, no Set tracking)
                if (isOpaque) {
                    SpanOps.fill_Opaq(data32, width, height, leftX, y, spanLength, packedColor, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        leftX,
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
            }
        }
    }

    /**
     * Fill a square for zero-length line degeneration.
     *
     * @param {number} centerX - Center X
     * @param {number} centerY - Center Y
     * @param {number} halfSize - Half the square size (typically lineWidth / 2)
     * @param {Object} params - Same parameters as fillQuad (CLIPPING: inline per-pixel or delegated to SpanOps)
     * @param {number} [ox=0] - Device column the centre is relative to (as fillQuad)
     * @param {number} [oy=0] - Device row the centre is relative to
     */
    static fillSquare(centerX, centerY, halfSize, params, ox = 0, oy = 0) {
        const { surface, r, g, b, isOpaque, clipBuffer } = params;
        const packedColor = params.packedColor || 0;
        const effectiveAlpha = params.effectiveAlpha || 0;
        const invAlpha = params.invAlpha || 0;
        const collectTo = params.collectTo || null;
        const skipFrom = params.skipFrom || null;

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const data = surface.data;

        const usePerPixel = collectTo !== null || skipFrom !== null;

        // Calculate Y bounds using proper rounding
        const minY = Math.max(0, oy + Math.floor(centerY - halfSize));
        const maxY = Math.min(height - 1, oy + Math.ceil(centerY + halfSize));

        for (let y = minY; y <= maxY; y++) {
            // Half-open right edge (see fillQuad): the rightmost column is the
            // largest integer < the right edge = ceil(...) - 1, consistent with
            // leftX = ceil(min). The old floor(...) over-included the right
            // column by 1px at integer-aligned edges.
            const leftX = Math.max(0, ox + Math.ceil(centerX - halfSize));
            const rightX = Math.min(width - 1, ox + Math.ceil(centerX + halfSize) - 1);
            const spanLength = rightX - leftX + 1;

            if (spanLength <= 0) continue;

            if (usePerPixel) {
                // Per-pixel mode for Set tracking
                for (let x = leftX; x <= rightX; x++) {
                    const pixelIndex = y * width + x;

                    if (skipFrom && skipFrom.has(pixelIndex)) continue;
                    if (collectTo) collectTo.add(pixelIndex);

                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }

                    if (isOpaque) {
                        data32[pixelIndex] = packedColor;
                    } else {
                        /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
            } else {
                // Span mode using SpanOps
                if (isOpaque) {
                    SpanOps.fill_Opaq(data32, width, height, leftX, y, spanLength, packedColor, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        leftX,
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
            }
        }
    }
}

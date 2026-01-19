/**
 * QuadScanOps - Static methods for quadrilateral scanline filling
 *
 * Specialized utility for filling 4-vertex convex shapes using scanline DDA.
 * Used by LineOps (thick diagonal lines) and RectOpsRot (semi-transparent strokes).
 *
 * NOT for general polygons - use PolygonFiller for arbitrary N-vertex shapes
 * with winding rules and paint source support.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, PixelOps.blend_Alpha
 *
 * Layer 1 (Primitives):
 *   lineToQuad - Convert line + thickness to 4 corners
 *   fillQuad   - Scanline fill the quad (calls SpanOps or PixelOps for per-pixel)
 */
class QuadScanOps {
    // Static pools - reused across calls to eliminate GC pressure
    static _edges = [
        { p1: null, p2: null, invDeltaY: 0, deltaX: 0, slope: 0, currentX: 0 },
        { p1: null, p2: null, invDeltaY: 0, deltaX: 0, slope: 0, currentX: 0 },
        { p1: null, p2: null, invDeltaY: 0, deltaX: 0, slope: 0, currentX: 0 },
        { p1: null, p2: null, invDeltaY: 0, deltaX: 0, slope: 0, currentX: 0 }
    ];
    static _edgeCount = 0;

    static _corners = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
    ];

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
        c[0].x = x1 + perpXHalf; c[0].y = y1 + perpYHalf;
        c[1].x = x1 - perpXHalf; c[1].y = y1 - perpYHalf;
        c[2].x = x2 - perpXHalf; c[2].y = y2 - perpYHalf;
        c[3].x = x2 + perpXHalf; c[3].y = y2 + perpYHalf;
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
     * @param {number} [params.incomingAlpha] - Effective alpha (0-1) for blending
     * @param {number} [params.inverseIncomingAlpha] - 1 - incomingAlpha for blending
     * @param {Uint8Array|null} params.clipBuffer - Clip mask (CLIPPING: inline per-pixel or delegated to SpanOps depending on mode)
     * @param {Set|null} [params.collectTo] - Add rendered pixel positions to this Set
     * @param {Set|null} [params.skipFrom] - Skip pixels that are in this Set
     */
    static fillQuad(corners, params) {
        const { surface, r, g, b, isOpaque, clipBuffer } = params;
        const packedColor = params.packedColor || 0;
        const incomingAlpha = params.incomingAlpha || 0;
        const inverseIncomingAlpha = params.inverseIncomingAlpha || 0;
        const collectTo = params.collectTo || null;
        const skipFrom = params.skipFrom || null;

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const data = surface.data;

        // Find bounding box
        const minY = Math.max(0, Math.floor(Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y)));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y)));

        // Pre-compute edge data using static pool (no allocation)
        // Includes slope and initial currentX for incremental DDA
        QuadScanOps._edgeCount = 0;
        for (let i = 0; i < 4; i++) {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];

            if (p1.y !== p2.y) { // Skip horizontal edges
                const edge = QuadScanOps._edges[QuadScanOps._edgeCount++];
                edge.p1 = p1;
                edge.p2 = p2;
                edge.invDeltaY = 1 / (p2.y - p1.y);
                edge.deltaX = p2.x - p1.x;
                edge.slope = edge.deltaX * edge.invDeltaY;
                // Compute initial currentX at edge's first active scanline
                const edgeMinY = Math.min(p1.y, p2.y);
                const firstActiveY = Math.max(minY, Math.ceil(edgeMinY));
                edge.currentX = p1.x + (firstActiveY - p1.y) * edge.slope;
            }
        }

        // Determine rendering mode
        const usePerPixel = collectTo !== null || skipFrom !== null;
        const intersections = [];

        // Scanline fill with incremental DDA
        for (let y = minY; y <= maxY; y++) {
            intersections.length = 0;

            // Find x-intersections using incremental currentX
            for (let i = 0; i < QuadScanOps._edgeCount; i++) {
                const edge = QuadScanOps._edges[i];
                const p1 = edge.p1;
                const p2 = edge.p2;

                if ((y >= p1.y && y < p2.y) || (y >= p2.y && y < p1.y)) {
                    intersections.push(edge.currentX);
                    edge.currentX += edge.slope;  // Incremental update (was: t * deltaX)
                }
            }

            if (intersections.length === 1) {
                // Single intersection - draw one pixel (edge case)
                const x = intersections[0] | 0;
                if (x >= 0 && x < width) {
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
                        /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, incomingAlpha, inverseIncomingAlpha)*/
                    }
                }
            } else if (intersections.length >= 2) {
                // Two or more intersections - draw span between min and max
                const x1i = intersections[0];
                const x2i = intersections[1];
                const leftX = Math.max(0, Math.ceil(Math.min(x1i, x2i)));
                const rightX = Math.min(width - 1, Math.floor(Math.max(x1i, x2i)));
                const spanLength = rightX - leftX + 1;

                if (spanLength > 0) {
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
                                /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, incomingAlpha, inverseIncomingAlpha)*/
                            }
                        }
                    } else {
                        // Span mode using SpanOps (faster, no Set tracking)
                        if (isOpaque) {
                            SpanOps.fill_Opaq(data32, width, height, leftX, y, spanLength, packedColor, clipBuffer);
                        } else {
                            SpanOps.fill_Alpha(data, width, height, leftX, y, spanLength, r, g, b, incomingAlpha, inverseIncomingAlpha, clipBuffer);
                        }
                    }
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
     */
    static fillSquare(centerX, centerY, halfSize, params) {
        const { surface, r, g, b, isOpaque, clipBuffer } = params;
        const packedColor = params.packedColor || 0;
        const incomingAlpha = params.incomingAlpha || 0;
        const inverseIncomingAlpha = params.inverseIncomingAlpha || 0;
        const collectTo = params.collectTo || null;
        const skipFrom = params.skipFrom || null;

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const data = surface.data;

        const usePerPixel = collectTo !== null || skipFrom !== null;

        // Calculate Y bounds using proper rounding
        const minY = Math.max(0, Math.floor(centerY - halfSize));
        const maxY = Math.min(height - 1, Math.ceil(centerY + halfSize));

        for (let y = minY; y <= maxY; y++) {
            // Calculate X bounds using ceil/floor for consistency with fillQuad
            const leftX = Math.max(0, Math.ceil(centerX - halfSize));
            const rightX = Math.min(width - 1, Math.floor(centerX + halfSize));
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
                        /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, incomingAlpha, inverseIncomingAlpha)*/
                    }
                }
            } else {
                // Span mode using SpanOps
                if (isOpaque) {
                    SpanOps.fill_Opaq(data32, width, height, leftX, y, spanLength, packedColor, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(data, width, height, leftX, y, spanLength, r, g, b, incomingAlpha, inverseIncomingAlpha, clipBuffer);
                }
            }
        }
    }
}

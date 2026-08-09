/**
 * RectOpsRot - Static methods for rotated rectangle rendering
 *
 * This module handles all rotated (non-axis-aligned) rectangle rendering.
 * Called directly by Context2D for rotated operations.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): QuadScanOps.fillQuad, QuadScanOps.fillSquare
 *
 * Layer 1 (Primitives - do atomic rendering):
 *   fill_Rot_Any (scanline DDA via QuadScanOps)
 *   _stroke_Rot_Alpha (internal, uses QuadScanOps with Set tracking)
 *
 * Layer 2 (Composites - call other *Ops methods):
 *   stroke_Rot_Any       → LineOps.stroke_Any (for edges), _stroke_Rot_Alpha
 *   fillStroke_Rot_Any   → fill_Rot_Any + stroke_Rot_Any
 *
 * Helpers (private, used by rotated methods):
 *   _extendLine, _shortenLine, _blendPixelAlpha
 */
class RectOpsRot {
    // ========================================================================
    // PRIVATE HELPERS (used by rotated rendering)
    // ========================================================================

    /**
     * Extends a line segment by a given amount at both ends.
     * Used for proper miter joins at rectangle corners.
     * @param {Object} p1 - Start point {x, y}
     * @param {Object} p2 - End point {x, y}
     * @param {number} amount - Amount to extend at each end
     * @returns {Object} Extended line {start: {x, y}, end: {x, y}}
     * @private
     */
    static _extendLine(p1, p2, amount) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return { start: p1, end: p2 };

        const dirX = dx / len;
        const dirY = dy / len;

        return {
            start: { x: p1.x - dirX * amount, y: p1.y - dirY * amount },
            end: { x: p2.x + dirX * amount, y: p2.y + dirY * amount }
        };
    }

    /**
     * Shortens a line segment by a given amount at both ends.
     * Used for proper miter joins at rectangle corners.
     * @param {Object} p1 - Start point {x, y}
     * @param {Object} p2 - End point {x, y}
     * @param {number} amount - Amount to shorten at each end
     * @returns {Object} Shortened line {start: {x, y}, end: {x, y}}
     * @private
     */
    static _shortenLine(p1, p2, amount) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return { start: p1, end: p2 };

        const dirX = dx / len;
        const dirY = dy / len;

        return {
            start: { x: p1.x + dirX * amount, y: p1.y + dirY * amount },
            end: { x: p2.x - dirX * amount, y: p2.y - dirY * amount }
        };
    }

    /**
     * Blend a single pixel with alpha (with clipping check)
     * Used by _stroke_Rot_Alpha for overdraw prevention.
     * @param {Uint8Array|Uint8ClampedArray} data - Surface data array
     * @param {number} pos - Pixel position (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} effectiveAlpha - Effective alpha (0-1)
     * @param {number} invAlpha - 1 - effectiveAlpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     * @private
     */
    static _blendPixelAlpha(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer) {
        if (clipBuffer) {
            const byteIndex = pos >> 3;
            const bitIndex = pos & 7;
            if (!(clipBuffer[byteIndex] & (1 << bitIndex))) return;
        }
        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
    }

    /**
     * 1px stroke drawing each edge individually using DDA.
     * Uses edge-based DDA that matches fill boundary computation:
     * - Y-major edges (|dy| >= |dx|): step Y, compute X, floor
     * - X-major edges (|dx| > |dy|): step X, compute Y, floor
     * - Horizontal edges (dy=0): draw all pixels at floor(y)
     * @param {Surface} surface - Target surface
     * @param {Array} corners - 4 corner points [{x, y}, ...]
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     * @param {boolean} isOpaqueColor - True if color is fully opaque
     * @private
     */
    static _stroke_Rot_1px_DDA(surface, corners, color, globalAlpha, clipBuffer, isOpaqueColor) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const data = surface.data;

        const packedColor = isOpaqueColor ? Surface.packColor(color.r, color.g, color.b, 255) : 0;
        const r = color.r,
            g = color.g,
            b = color.b;
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        const invAlpha = 1 - effectiveAlpha;

        // Overdraw prevention (the §6.5 doctrine): the 4 edges are drawn as
        // independent closed intervals, so consecutive edges can land on the
        // same pixel at a shared corner — invisible when opaque (same value
        // written twice), a visibly darker dot once the stroke is translucent.
        // Each edge iterates min→max of its major coordinate, not p1→p2, so
        // the duplicate is NOT always adjacent in emission order and lastPos
        // tracking (the RoundedRectOpsRot idiom) is not sufficient — a seen-set
        // is. Alpha only: this path is cold (rotated + translucent + 1px) and
        // the opaque fast loops stay allocation-free and byte-identical.
        const seen = isOpaqueColor ? null : new Set();

        // Draw each of the 4 edges
        for (let i = 0; i < 4; i++) {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;

            if (dy === 0) {
                // Horizontal edge: draw all pixels at floor(y)
                const y = p1.y | 0;
                if (y < 0 || y >= height) continue;
                const xStart = Math.ceil(Math.min(p1.x, p2.x));
                const xEnd = Math.floor(Math.max(p1.x, p2.x));

                for (let x = xStart; x <= xEnd; x++) {
                    if (x < 0 || x >= width) continue;
                    const pixelIndex = y * width + x;
                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }
                    if (isOpaqueColor) {
                        data32[pixelIndex] = packedColor;
                    } else if (!seen.has(pixelIndex)) {
                        seen.add(pixelIndex);
                        RectOpsRot._blendPixelAlpha(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha, null);
                    }
                }
            } else if (Math.abs(dy) >= Math.abs(dx)) {
                // Y-major edge: step Y, compute X (matches fill DDA)
                const yStart = Math.ceil(Math.min(p1.y, p2.y));
                const yEnd = Math.floor(Math.max(p1.y, p2.y));
                const slope = dx / dy; // dX/dY

                for (let y = yStart; y <= yEnd; y++) {
                    if (y < 0 || y >= height) continue;
                    const x = (p1.x + (y - p1.y) * slope) | 0; // floor
                    if (x < 0 || x >= width) continue;

                    const pixelIndex = y * width + x;
                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }
                    if (isOpaqueColor) {
                        data32[pixelIndex] = packedColor;
                    } else if (!seen.has(pixelIndex)) {
                        seen.add(pixelIndex);
                        RectOpsRot._blendPixelAlpha(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha, null);
                    }
                }
            } else {
                // X-major edge: step X, compute Y
                const xStart = Math.ceil(Math.min(p1.x, p2.x));
                const xEnd = Math.floor(Math.max(p1.x, p2.x));
                const slope = dy / dx; // dY/dX

                for (let x = xStart; x <= xEnd; x++) {
                    if (x < 0 || x >= width) continue;
                    const y = (p1.y + (x - p1.x) * slope) | 0; // floor
                    if (y < 0 || y >= height) continue;

                    const pixelIndex = y * width + x;
                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }
                    if (isOpaqueColor) {
                        data32[pixelIndex] = packedColor;
                    } else if (!seen.has(pixelIndex)) {
                        seen.add(pixelIndex);
                        RectOpsRot._blendPixelAlpha(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha, null);
                    }
                }
            }
        }
    }

    // ========================================================================
    // ROTATED FILL IMPLEMENTATION
    // ========================================================================

    /**
     * Rotated rectangle fill using optimized scanline DDA algorithm.
     * Delegates to QuadScanOps.fillQuad for 5-10x faster rendering than edge functions.
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     */
    static fill_Rot_Any(surface, centerX, centerY, width, height, rotation, color, globalAlpha, clipBuffer) {
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;
        const isOpaque = effectiveAlpha >= 1.0;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Calculate 4 corners of the rotated rectangle
        // Use sub-pixel coordinates - QuadScanOps handles discretization via DDA
        // Edge-based DDA stroke uses same corner coordinates for consistent boundaries
        const corners = [
            { x: centerX + hw * cos - hh * sin, y: centerY + hw * sin + hh * cos },
            { x: centerX + hw * cos + hh * sin, y: centerY + hw * sin - hh * cos },
            { x: centerX - hw * cos + hh * sin, y: centerY - hw * sin - hh * cos },
            { x: centerX - hw * cos - hh * sin, y: centerY - hw * sin + hh * cos }
        ];

        // Delegate to optimized scanline algorithm
        QuadScanOps.fillQuad(corners, {
            surface,
            r,
            g,
            b,
            isOpaque,
            packedColor: isOpaque ? Surface.packColor(r, g, b, 255) : 0,
            effectiveAlpha,
            invAlpha,
            clipBuffer
        });
    }

    // ========================================================================
    // ROTATED STROKE IMPLEMENTATIONS
    // ========================================================================

    /**
     * Rotated rectangle stroke with alpha blending (no overdraw).
     * Uses QuadScanOps with Set tracking to prevent overdraw at corner regions.
     * Single-pass optimization: render short edges first (add to Set), then long edges (check Set).
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     */
    static _stroke_Rot_Alpha(
        surface,
        centerX,
        centerY,
        width,
        height,
        rotation,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer
    ) {
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;
        const halfStroke = lineWidth / 2;

        // Calculate 4 corners (same as stroke_Rot_Any)
        const corners = [
            { x: centerX - hw * cos - hh * sin, y: centerY - hw * sin + hh * cos },
            { x: centerX + hw * cos - hh * sin, y: centerY + hw * sin + hh * cos },
            { x: centerX + hw * cos + hh * sin, y: centerY + hw * sin - hh * cos },
            { x: centerX - hw * cos + hh * sin, y: centerY - hw * sin - hh * cos }
        ];

        // Determine which edge pair is shorter at runtime
        // Extended edges (0,2): approx width + lineWidth
        // Shortened edges (1,3): approx height - lineWidth
        const extendedLength = width + lineWidth;
        const shortenedLength = Math.max(0, height - lineWidth);

        const renderedPixels = new Set();

        // Common params for QuadScanOps
        const baseParams = {
            surface,
            r,
            g,
            b,
            isOpaque: false,
            effectiveAlpha,
            invAlpha,
            clipBuffer
        };

        // Helper to process a single edge using QuadScanOps
        const processEdge = (i, extend, renderFirst) => {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];
            const line = extend
                ? RectOpsRot._extendLine(p1, p2, halfStroke)
                : RectOpsRot._shortenLine(p1, p2, halfStroke);

            const quadCorners = QuadScanOps.lineToQuad(line.start.x, line.start.y, line.end.x, line.end.y, halfStroke);

            const params = {
                ...baseParams,
                collectTo: renderFirst ? renderedPixels : null,
                skipFrom: renderFirst ? null : renderedPixels
            };

            if (quadCorners === null) {
                // Zero-length edge - use fillSquare
                QuadScanOps.fillSquare(line.start.x, line.start.y, halfStroke, params);
            } else {
                QuadScanOps.fillQuad(quadCorners, params);
            }
        };

        if (shortenedLength <= extendedLength) {
            // Shortened edges are shorter: render+add first, then extended with check
            processEdge(1, false, true); // shortened
            processEdge(3, false, true); // shortened
            processEdge(0, true, false); // extended with check
            processEdge(2, true, false); // extended with check
        } else {
            // Extended edges are shorter: render+add first, then shortened with check
            processEdge(0, true, true); // extended
            processEdge(2, true, true); // extended
            processEdge(1, false, false); // shortened with check
            processEdge(3, false, false); // shortened with check
        }
    }

    /**
     * Rotated rectangle stroke using LineOps for edges.
     * Uses extend/shorten strategy for proper miter joins at corners.
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     */
    static stroke_Rot_Any(
        surface,
        centerX,
        centerY,
        width,
        height,
        rotation,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer
    ) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Calculate 4 corners
        const corners = [
            { x: centerX - hw * cos - hh * sin, y: centerY - hw * sin + hh * cos },
            { x: centerX + hw * cos - hh * sin, y: centerY + hw * sin + hh * cos },
            { x: centerX + hw * cos + hh * sin, y: centerY + hw * sin - hh * cos },
            { x: centerX - hw * cos + hh * sin, y: centerY - hw * sin - hh * cos }
        ];

        const isOpaqueColor = color.a === 255 && globalAlpha >= 1.0;
        const isSemiTransparentColor = !isOpaqueColor && color.a > 0;

        // Handle 1px strokes - use edge-based DDA that matches fill boundaries
        if (lineWidth <= 1) {
            // Use same corner order as fill_Rot_Any for consistent DDA processing
            const fillCorners = [
                { x: centerX + hw * cos - hh * sin, y: centerY + hw * sin + hh * cos },
                { x: centerX + hw * cos + hh * sin, y: centerY + hw * sin - hh * cos },
                { x: centerX - hw * cos + hh * sin, y: centerY - hw * sin - hh * cos },
                { x: centerX - hw * cos - hh * sin, y: centerY - hw * sin + hh * cos }
            ];
            RectOpsRot._stroke_Rot_1px_DDA(surface, fillCorners, color, globalAlpha, clipBuffer, isOpaqueColor);
            return;
        }

        // For thick semitransparent strokes, use Set-based approach to prevent overdraw
        if (isSemiTransparentColor) {
            return RectOpsRot._stroke_Rot_Alpha(
                surface,
                centerX,
                centerY,
                width,
                height,
                rotation,
                lineWidth,
                color,
                globalAlpha,
                clipBuffer
            );
        }

        // Handle thick opaque strokes using QuadScanOps directly for consistent rasterization.
        // This avoids axis-aligned detection in LineOps.stroke_Any which uses different
        // algorithms causing 1-pixel gaps at edge joints for nearly-axis-aligned rotations.
        const halfStroke = lineWidth / 2;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        const params = {
            surface,
            r: color.r,
            g: color.g,
            b: color.b,
            isOpaque: true,
            packedColor,
            effectiveAlpha: 0,
            invAlpha: 0,
            clipBuffer
        };

        const renderEdge = (p1, p2, extend) => {
            const line = extend
                ? RectOpsRot._extendLine(p1, p2, halfStroke)
                : RectOpsRot._shortenLine(p1, p2, halfStroke);

            const quadCorners = QuadScanOps.lineToQuad(line.start.x, line.start.y, line.end.x, line.end.y, halfStroke);

            if (quadCorners === null) {
                QuadScanOps.fillSquare(line.start.x, line.start.y, halfStroke, params);
            } else {
                QuadScanOps.fillQuad(quadCorners, params);
            }
        };

        // Extended edges (0→1, 2→3) form corner regions
        renderEdge(corners[0], corners[1], true);
        renderEdge(corners[2], corners[3], true);

        // Shortened edges (1→2, 3→0) fit between extended edges
        renderEdge(corners[1], corners[2], false);
        renderEdge(corners[3], corners[0], false);
    }

    // ========================================================================
    // COMBINED FILL+STROKE
    // ========================================================================

    /**
     * Fill and stroke a rotated rectangle in a single operation.
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} fillColor - Fill color (may be null)
     * @param {Color} strokeColor - Stroke color (may be null)
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     */
    static fillStroke_Rot_Any(
        surface,
        centerX,
        centerY,
        width,
        height,
        rotation,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer
    ) {
        // Fill first, then stroke on top
        if (fillColor && fillColor.a > 0) {
            RectOpsRot.fill_Rot_Any(
                surface,
                centerX,
                centerY,
                width,
                height,
                rotation,
                fillColor,
                globalAlpha,
                clipBuffer
            );
        }
        if (strokeColor && strokeColor.a > 0 && lineWidth > 0) {
            RectOpsRot.stroke_Rot_Any(
                surface,
                centerX,
                centerY,
                width,
                height,
                rotation,
                lineWidth,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
        }
    }
}

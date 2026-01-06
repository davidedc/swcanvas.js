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
     * @param {Uint8Array|null} clipBuffer - Clip mask buffer
     * @private
     */
    static _blendPixelAlpha(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer) {
        if (clipBuffer) {
            const byteIndex = pos >> 3;
            const bitIndex = pos & 7;
            if (!(clipBuffer[byteIndex] & (1 << bitIndex))) return;
        }
        const idx = pos * 4;
        const oldAlpha = data[idx + 3] / 255;
        const oldAlphaScaled = oldAlpha * invAlpha;
        const newAlpha = effectiveAlpha + oldAlphaScaled;
        if (newAlpha > 0) {
            const blendFactor = 1 / newAlpha;
            data[idx] = (r * effectiveAlpha + data[idx] * oldAlphaScaled) * blendFactor;
            data[idx + 1] = (g * effectiveAlpha + data[idx + 1] * oldAlphaScaled) * blendFactor;
            data[idx + 2] = (b * effectiveAlpha + data[idx + 2] * oldAlphaScaled) * blendFactor;
            data[idx + 3] = newAlpha * 255;
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
     * @param {Uint8Array|null} clipBuffer - Clip mask buffer
     */
    static fill_Rot_Any(surface, centerX, centerY, width, height, rotation, color, globalAlpha, clipBuffer) {
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;

        const r = color.r, g = color.g, b = color.b;
        const isOpaque = effectiveAlpha >= 1.0;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Calculate 4 corners of the rotated rectangle
        // Floor coordinates to match Bresenham rasterization used by stroke rendering
        const corners = [
            { x: Math.floor(centerX + hw * cos - hh * sin), y: Math.floor(centerY + hw * sin + hh * cos) },
            { x: Math.floor(centerX + hw * cos + hh * sin), y: Math.floor(centerY + hw * sin - hh * cos) },
            { x: Math.floor(centerX - hw * cos + hh * sin), y: Math.floor(centerY - hw * sin - hh * cos) },
            { x: Math.floor(centerX - hw * cos - hh * sin), y: Math.floor(centerY - hw * sin + hh * cos) }
        ];

        // Delegate to optimized scanline algorithm
        QuadScanOps.fillQuad(corners, {
            surface,
            r, g, b,
            isOpaque,
            packedColor: isOpaque ? Surface.packColor(r, g, b, 255) : 0,
            incomingAlpha: effectiveAlpha,
            inverseIncomingAlpha: 1 - effectiveAlpha,
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
     * @param {Uint8Array|null} clipBuffer - Clip mask buffer
     */
    static _stroke_Rot_Alpha(surface, centerX, centerY, width, height, rotation,
                              lineWidth, color, globalAlpha, clipBuffer) {
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

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
            r, g, b,
            isOpaque: false,
            incomingAlpha: effectiveAlpha,
            inverseIncomingAlpha: invAlpha,
            clipBuffer
        };

        // Helper to process a single edge using QuadScanOps
        const processEdge = (i, extend, renderFirst) => {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];
            const line = extend ? RectOpsRot._extendLine(p1, p2, halfStroke)
                                : RectOpsRot._shortenLine(p1, p2, halfStroke);

            const quadCorners = QuadScanOps.lineToQuad(
                line.start.x, line.start.y, line.end.x, line.end.y, halfStroke
            );

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
            processEdge(1, false, true);  // shortened
            processEdge(3, false, true);  // shortened
            processEdge(0, true, false);  // extended with check
            processEdge(2, true, false);  // extended with check
        } else {
            // Extended edges are shorter: render+add first, then shortened with check
            processEdge(0, true, true);   // extended
            processEdge(2, true, true);   // extended
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
     * @param {Uint8Array|null} clipBuffer - Clip mask buffer
     */
    static stroke_Rot_Any(surface, centerX, centerY, width, height, rotation, lineWidth, color, globalAlpha, clipBuffer) {
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

        // For thick semitransparent strokes, use Set-based approach to prevent overdraw
        if (lineWidth > 1 && isSemiTransparentColor) {
            return RectOpsRot._stroke_Rot_Alpha(surface, centerX, centerY, width, height,
                rotation, lineWidth, color, globalAlpha, clipBuffer);
        }

        // Handle 1px strokes (no corner adjustment needed - minimal overlap issue)
        if (lineWidth <= 1) {
            for (let i = 0; i < 4; i++) {
                const p1 = corners[i];
                const p2 = corners[(i + 1) % 4];

                LineOps.stroke_Any(
                    surface,
                    p1.x, p1.y,
                    p2.x, p2.y,
                    lineWidth,
                    color,
                    globalAlpha,
                    clipBuffer,
                    isOpaqueColor,
                    isSemiTransparentColor
                );
            }
            return;
        }

        // Handle thick opaque strokes using QuadScanOps directly for consistent rasterization.
        // This avoids axis-aligned detection in LineOps.stroke_Any which uses different
        // algorithms causing 1-pixel gaps at edge joints for nearly-axis-aligned rotations.
        const halfStroke = lineWidth / 2;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        const params = {
            surface,
            r: color.r, g: color.g, b: color.b,
            isOpaque: true,
            packedColor,
            incomingAlpha: 0,
            inverseIncomingAlpha: 0,
            clipBuffer
        };

        const renderEdge = (p1, p2, extend) => {
            const line = extend
                ? RectOpsRot._extendLine(p1, p2, halfStroke)
                : RectOpsRot._shortenLine(p1, p2, halfStroke);

            const quadCorners = QuadScanOps.lineToQuad(
                line.start.x, line.start.y, line.end.x, line.end.y, halfStroke
            );

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
     * @param {Uint8Array|null} clipBuffer - Clip mask buffer
     */
    static fillStroke_Rot_Any(surface, centerX, centerY, width, height, rotation,
                                lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer) {
        // Fill first, then stroke on top
        if (fillColor && fillColor.a > 0) {
            RectOpsRot.fill_Rot_Any(surface, centerX, centerY, width, height,
                               rotation, fillColor, globalAlpha, clipBuffer);
        }
        if (strokeColor && strokeColor.a > 0 && lineWidth > 0) {
            RectOpsRot.stroke_Rot_Any(surface, centerX, centerY, width, height,
                                 rotation, lineWidth, strokeColor, globalAlpha, clipBuffer);
        }
    }
}

/**
 * LineOps - Static methods for optimized line rendering
 * Follows PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * strokeLine()
 *
 * Path-based lines (beginPath() + moveTo() + lineTo() + stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers, QuadScanOps.fillQuad
 *
 * Layer 1 (Internal):
 *   _strokeThick_PolyScan → QuadScanOps.lineToQuad + QuadScanOps.fillQuad/fillSquare
 *
 * Layer 2 (Public dispatcher):
 *   stroke_Any → Bresenham (thin opaque), inline markers/SpanOps (thin alpha), SpanOps (thick AA), _strokeThick_PolyScan
 *
 * NAMING PATTERN: {operation}_{opacity}
 *   - Any = Handles all opacity/thickness cases (dispatcher)
 *   - (No orientation suffix - lines handle all angles)
 */
class LineOps {
    /**
     * Optimized line stroke - dispatches to appropriate rendering algorithm
     * @param {Surface} surface - Target surface
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} lineWidth - Stroke width
     * @param {Color} paintSource - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: inline per-pixel for Bresenham, delegated to SpanOps/QuadScanOps for spans)
     * @param {boolean} isOpaqueColor - True if color is opaque with full alpha
     * @param {boolean} isSemiTransparentColor - True if color needs alpha blending
     * @returns {boolean} True if direct rendering was used, false if path-based rendering needed
     */
    static stroke_Any(surface, x1, y1, x2, y2, lineWidth, paintSource, globalAlpha, clipBuffer, isOpaqueColor, isSemiTransparentColor) {
        const width = surface.width;
        const height = surface.height;

        if (isOpaqueColor && lineWidth <= THIN_LINE_THRESHOLD) {
            // Direct rendering for thin lines: Bresenham algorithm
            const packedColor = Surface.packColor(paintSource.r, paintSource.g, paintSource.b, 255);
            const data32 = surface.data32;

            let x1i = Math.floor(x1);
            let y1i = Math.floor(y1);
            let x2i = Math.floor(x2);
            let y2i = Math.floor(y2);

            // Shorten horizontal/vertical lines by 1 pixel to match HTML5 Canvas
            if (x1i === x2i) {
                if (y2i > y1i) y2i--; else y1i--;
            }
            if (y1i === y2i) {
                if (x2i > x1i) x2i--; else x1i--;
            }

            // Optimize thin horizontal lines: use span-based rendering
            if (y1i === y2i) {
                // Y bounds check - skip if entirely off-screen
                if (y1i < 0 || y1i >= height) return true;

                // X bounds clamping
                const leftX = Math.max(0, Math.min(x1i, x2i));
                const rightX = Math.min(width - 1, Math.max(x1i, x2i));
                if (leftX > rightX) return true;

                const spanLength = rightX - leftX + 1;
                SpanOps.fill_Opaq(data32, width, height, leftX, y1i, spanLength, packedColor, clipBuffer);
                return true;
            }

            let dx = Math.abs(x2i - x1i);
            let dy = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dx - dy;

            let x = x1i;
            let y = y1i;

            while (true) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const pixelIndex = y * width + x;

                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (clipBuffer[byteIndex] & (1 << bitIndex)) {
                            data32[pixelIndex] = packedColor;
                        }
                    } else {
                        data32[pixelIndex] = packedColor;
                    }
                }

                if (x === x2i && y === y2i) break;

                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y += sy;
                }
            }
            return true;
        } else if (isOpaqueColor) {
            // Direct rendering for thick axis-aligned lines: render as rectangle
            const x1i = Math.floor(x1);
            const y1i = Math.floor(y1);
            const x2i = Math.floor(x2);
            const y2i = Math.floor(y2);
            const data32 = surface.data32;

            if (y1i === y2i) {
                // Horizontal thick line - render as filled rectangle
                const halfWidth = lineWidth / 2;
                const topY = Math.floor(y1 - halfWidth);
                const bottomY = Math.floor(y1 + halfWidth);
                const leftX = Math.min(x1i, x2i);
                const rightX = Math.max(x1i, x2i);
                const packedColor = Surface.packColor(paintSource.r, paintSource.g, paintSource.b, 255);

                // Y bounds clamping for the loop
                const clampedTopY = Math.max(0, topY);
                const clampedBottomY = Math.min(height, bottomY);
                if (clampedTopY >= clampedBottomY) return true;

                // X bounds clamping
                const clampedLeftX = Math.max(0, leftX);
                const clampedRightX = Math.min(width - 1, rightX);
                if (clampedLeftX > clampedRightX) return true;

                const spanLength = clampedRightX - clampedLeftX + 1;
                for (let y = clampedTopY; y < clampedBottomY; y++) {
                    SpanOps.fill_Opaq(data32, width, height, clampedLeftX, y, spanLength, packedColor, clipBuffer);
                }
                return true;
            } else if (x1i === x2i) {
                // Vertical thick line - render as filled rectangle
                const halfWidth = lineWidth / 2;
                const leftX = Math.floor(x1 - halfWidth);
                const rightX = Math.floor(x1 + halfWidth);
                const topY = Math.min(y1i, y2i);
                const bottomY = Math.max(y1i, y2i);
                const packedColor = Surface.packColor(paintSource.r, paintSource.g, paintSource.b, 255);

                // Y bounds clamping for the loop
                const clampedTopY = Math.max(0, topY);
                const clampedBottomY = Math.min(height, bottomY);
                if (clampedTopY >= clampedBottomY) return true;

                // X bounds clamping (for span width)
                // Note: rightX - leftX is the span width (not +1) because leftX/rightX
                // are computed from floor(x - halfWidth) / floor(x + halfWidth)
                const clampedLeftX = Math.max(0, leftX);
                const clampedRightX = Math.min(width, rightX);  // Use width (not width-1) since rightX is already exclusive
                const spanLength = clampedRightX - clampedLeftX;
                if (spanLength <= 0) return true;

                for (let y = clampedTopY; y < clampedBottomY; y++) {
                    SpanOps.fill_Opaq(data32, width, height, clampedLeftX, y, spanLength, packedColor, clipBuffer);
                }
                return true;
            } else {
                // Non-axis-aligned thick line - use polygon scan algorithm
                LineOps._strokeThick_PolyScan(surface, x1, y1, x2, y2, lineWidth, paintSource, globalAlpha, clipBuffer, false);
                return true;
            }
        } else if (isSemiTransparentColor && lineWidth <= THIN_LINE_THRESHOLD) {
            // Direct rendering for thin semitransparent lines: Bresenham with alpha blending
            const data = surface.data;
            const effectiveAlpha = (paintSource.a / 255) * globalAlpha;
            // Note: No early return - already inside a conditional branch
            const invAlpha = 1 - effectiveAlpha;
            const r = paintSource.r, g = paintSource.g, b = paintSource.b;

            let x1i = Math.floor(x1);
            let y1i = Math.floor(y1);
            let x2i = Math.floor(x2);
            let y2i = Math.floor(y2);

            if (x1i === x2i) {
                if (y2i > y1i) y2i--; else y1i--;
            }
            if (y1i === y2i) {
                if (x2i > x1i) x2i--; else x1i--;
            }

            // Optimize thin horizontal lines: use span-based rendering
            if (y1i === y2i) {
                // Y bounds check - skip if entirely off-screen
                if (y1i < 0 || y1i >= height) return true;

                // X bounds clamping
                const leftX = Math.max(0, Math.min(x1i, x2i));
                const rightX = Math.min(width - 1, Math.max(x1i, x2i));
                if (leftX > rightX) return true;

                const spanLength = rightX - leftX + 1;
                SpanOps.fill_Alpha(data, width, height, leftX, y1i, spanLength, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
                return true;
            }

            let dx = Math.abs(x2i - x1i);
            let dy = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dx - dy;

            let x = x1i;
            let y = y1i;

            while (true) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const pixelIndex = y * width + x;
                    let drawPixel = true;

                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) {
                            drawPixel = false;
                        }
                    }

                    if (drawPixel) {
                        /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }

                if (x === x2i && y === y2i) break;

                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y += sy;
                }
            }
            return true;
        } else if (isSemiTransparentColor) {
            // Direct rendering for thick semitransparent lines: polygon scan with alpha blending
            LineOps._strokeThick_PolyScan(surface, x1, y1, x2, y2, lineWidth, paintSource, globalAlpha, clipBuffer, true);
            return true;
        }

        // No direct rendering available
        return false;
    }

    /**
     * Fast thick line rendering using polygon scanline algorithm.
     * Treats the thick line as a quadrilateral and fills it using QuadScanOps.
     * @param {Surface} surface - Target surface
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} lineWidth - Stroke width
     * @param {Color} paintSource - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps)
     * @param {boolean} useSemiTransparent - If true, use alpha blending
     */
    static _strokeThick_PolyScan(surface, x1, y1, x2, y2, lineWidth, paintSource, globalAlpha, clipBuffer, useSemiTransparent = false) {
        const r = paintSource.r, g = paintSource.g, b = paintSource.b;

        const isOpaque = !useSemiTransparent;
        const packedColor = isOpaque ? Surface.packColor(r, g, b, 255) : 0;
        const effectiveAlpha = useSemiTransparent ? (paintSource.a / 255) * globalAlpha : 0;
        const invAlpha = useSemiTransparent ? 1 - effectiveAlpha : 0;

        const halfThick = lineWidth * 0.5;
        const corners = QuadScanOps.lineToQuad(x1, y1, x2, y2, halfThick);

        const params = {
            surface,
            r, g, b,
            isOpaque,
            packedColor,
            effectiveAlpha,
            invAlpha,
            clipBuffer
        };

        if (corners === null) {
            // Zero-length line - draw a square
            QuadScanOps.fillSquare(x1, y1, halfThick, params);
        } else {
            QuadScanOps.fillQuad(corners, params);
        }
    }
}

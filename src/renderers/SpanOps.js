/**
 * SpanOps - Static utility methods for horizontal span filling
 * Used by all shape *Ops classes for optimized pixel rendering.
 * Follows PolygonFiller pattern with static methods.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): Depends on PixelOps for single-pixel blending.
 *   - Called by: RectOpsAA, RectOpsRot, CircleOps, LineOps, ArcOps,
 *                RoundedRectOpsAA, RoundedRectOpsRot
 *
 * CLIPPING CONTRACT:
 * ------------------
 * SpanOps IS RESPONSIBLE for clipping checks when clipBuffer is provided.
 * Callers MUST NOT pre-check clipping before calling SpanOps methods.
 * This is the PRIMARY clipping checkpoint for span-based rendering.
 *
 * Methods check each pixel against clipBuffer (with byte-skip optimization)
 * before writing. Passing clipBuffer=null disables clipping checks.
 *
 * NAMING PATTERN: {operation}_{opacity}
 *   - fill_Opaq: Opaque span fill (32-bit writes)
 *   - fill_Alpha: Semi-transparent span fill (calls PixelOps.blend_Alpha)
 */
class SpanOps {
    /**
     * Optimized horizontal span fill with 32-bit writes (opaque colors only)
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate
     * @param {number} y - Y coordinate of the span
     * @param {number} length - Length of the span in pixels
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here with byte-skip optimization)
     */
    static fill_Opaq(data32, surfaceWidth, surfaceHeight, startX, y, length, packedColor, clipBuffer) {
        // Y bounds check - use floor for consistent pixel alignment
        const yi = Math.floor(y);
        if (yi < 0 || yi >= surfaceHeight) return;

        // X clipping to surface bounds - use floor for consistent pixel alignment
        let x = Math.floor(startX);
        let len = length;
        if (x < 0) {
            len += x;
            x = 0;
        }
        if (x + len > surfaceWidth) {
            len = surfaceWidth - x;
        }
        if (len <= 0) return;

        let pixelIndex = yi * surfaceWidth + x;
        const endIndex = pixelIndex + len;

        if (clipBuffer) {
            // With clipping
            while (pixelIndex < endIndex) {
                const byteIndex = pixelIndex >> 3;

                // Skip fully clipped bytes
                if (clipBuffer[byteIndex] === 0) {
                    const nextByteBoundary = (byteIndex + 1) << 3;
                    pixelIndex = Math.min(nextByteBoundary, endIndex);
                    continue;
                }

                const bitIndex = pixelIndex & 7;
                if (clipBuffer[byteIndex] & (1 << bitIndex)) {
                    data32[pixelIndex] = packedColor;
                }
                pixelIndex++;
            }
        } else {
            // No clipping - optimized path
            for (; pixelIndex < endIndex; pixelIndex++) {
                data32[pixelIndex] = packedColor;
            }
        }
    }

    /**
     * Horizontal span fill with alpha blending (source-over)
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate
     * @param {number} y - Y coordinate of the span
     * @param {number} length - Length of the span in pixels
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1)
     * @param {number} invAlpha - Inverse alpha (1 - alpha)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here with byte-skip optimization)
     */
    static fill_Alpha(data, surfaceWidth, surfaceHeight, startX, y, length, r, g, b, alpha, invAlpha, clipBuffer) {
        // Y bounds check - use floor for consistent pixel alignment
        const yi = Math.floor(y);
        if (yi < 0 || yi >= surfaceHeight) return;

        // X clipping to surface bounds - use floor for consistent pixel alignment
        let x = Math.floor(startX);
        let len = length;
        if (x < 0) {
            len += x;
            x = 0;
        }
        if (x + len > surfaceWidth) {
            len = surfaceWidth - x;
        }
        if (len <= 0) return;

        const endX = x + len;
        const rowStart = yi * surfaceWidth;

        if (clipBuffer) {
            // With clipping - includes byte-skip optimization
            let px = x;
            while (px < endX) {
                const pixelIndex = rowStart + px;
                const byteIndex = pixelIndex >> 3;

                // Skip fully clipped bytes (8 pixels at a time)
                if (clipBuffer[byteIndex] === 0) {
                    const nextByteBoundary = (byteIndex + 1) << 3;
                    // Convert back to X coordinate with bounds check
                    px = Math.min(nextByteBoundary - rowStart, endX);
                    continue;
                }

                const bitOffset = pixelIndex & 7;
                if ((clipBuffer[byteIndex] & (1 << bitOffset)) !== 0) {
                    PixelOps.blend_Alpha(data, pixelIndex, r, g, b, alpha, invAlpha);
                }
                px++;
            }
        } else {
            // No clipping
            for (let px = x; px < endX; px++) {
                PixelOps.blend_Alpha(data, rowStart + px, r, g, b, alpha, invAlpha);
            }
        }
    }
}

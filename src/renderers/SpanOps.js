/**
 * SpanOps - Static utility methods for horizontal span filling
 * Used by all shape *Ops classes for optimized pixel rendering.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): Uses inline markers for pixel blending.
 *   - Called by: RectOpsAA, RectOpsRot, CircleOps, LineOps, ArcOps,
 *                RoundedRectOpsAA, RoundedRectOpsRot, QuadScanOps
 *
 * BOUNDS CONTRACT:
 * ----------------
 * SpanOps TRUSTS that callers provide valid coordinates:
 *   1. y must be in [0, surfaceHeight)
 *   2. startX must be in [0, surfaceWidth)
 *   3. startX + length must be <= surfaceWidth
 *   4. length must be > 0
 *
 * In development builds, assertions verify these invariants and throw
 * descriptive errors if violated. In production builds, assertions are
 * stripped for maximum performance.
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
 *   - fill_Alpha: Semi-transparent span fill (uses inline BLEND_ALPHA marker)
 */
class SpanOps {
    /**
     * Optimized horizontal span fill with 32-bit writes (opaque colors only)
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (must be >= 0)
     * @param {number} y - Y coordinate of the span (must be in [0, surfaceHeight))
     * @param {number} length - Length of the span in pixels (must be > 0, startX + length <= surfaceWidth)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here with byte-skip optimization)
     */
    static fill_Opaq(data32, surfaceWidth, surfaceHeight, startX, y, length, packedColor, clipBuffer) {
        if (IS_DEBUG) {
            const yi = Math.floor(y);
            const x = Math.floor(startX);
            if (yi < 0 || yi >= surfaceHeight) {
                throw new Error(
                    `SpanOps.fill_Opaq: y out of bounds: y=${y} (yi=${yi}), surfaceHeight=${surfaceHeight}`
                );
            }
            if (x < 0) {
                throw new Error(`SpanOps.fill_Opaq: startX out of bounds: startX=${startX} (x=${x}), must be >= 0`);
            }
            if (x + length > surfaceWidth) {
                throw new Error(
                    `SpanOps.fill_Opaq: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`SpanOps.fill_Opaq: invalid length: ${length}, must be > 0`);
            }
        }

        const yi = Math.floor(y);
        const x = Math.floor(startX);
        let pixelIndex = yi * surfaceWidth + x;
        const endIndex = pixelIndex + length;

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
            // No clipping - optimized path. The span is a contiguous run of one packed color,
            // so a single native TypedArray.fill beats a per-pixel JS loop for the hundreds-of-px
            // spans of window/panel fills (O1, docs/runtime-performance-optimization-plan.md §5B).
            // Byte-identical: same value written to the same [pixelIndex, endIndex) indices.
            data32.fill(packedColor, pixelIndex, endIndex);
        }
    }

    /**
     * Horizontal span fill with alpha blending (source-over)
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (must be >= 0)
     * @param {number} y - Y coordinate of the span (must be in [0, surfaceHeight))
     * @param {number} length - Length of the span in pixels (must be > 0, startX + length <= surfaceWidth)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1)
     * @param {number} invAlpha - Inverse alpha (1 - alpha)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here with byte-skip optimization)
     */
    static fill_Alpha(data, surfaceWidth, surfaceHeight, startX, y, length, r, g, b, alpha, invAlpha, clipBuffer) {
        if (IS_DEBUG) {
            const yi = Math.floor(y);
            const x = Math.floor(startX);
            if (yi < 0 || yi >= surfaceHeight) {
                throw new Error(
                    `SpanOps.fill_Alpha: y out of bounds: y=${y} (yi=${yi}), surfaceHeight=${surfaceHeight}`
                );
            }
            if (x < 0) {
                throw new Error(`SpanOps.fill_Alpha: startX out of bounds: startX=${startX} (x=${x}), must be >= 0`);
            }
            if (x + length > surfaceWidth) {
                throw new Error(
                    `SpanOps.fill_Alpha: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`SpanOps.fill_Alpha: invalid length: ${length}, must be > 0`);
            }
        }

        const yi = Math.floor(y);
        const x = Math.floor(startX);
        const endX = x + length;
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
                    /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, alpha, invAlpha)*/
                }
                px++;
            }
        } else {
            // No clipping
            for (let px = x; px < endX; px++) {
                const pixelIndex = rowStart + px;
                /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, alpha, invAlpha)*/
            }
        }
    }
}

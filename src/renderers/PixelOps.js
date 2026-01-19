/**
 * PixelOps - Static utility methods for single-pixel operations
 * Foundation layer for all pixel-level rendering.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer -1 (Foundation): This class is the deepest foundation layer.
 *   - No dependencies on other *Ops classes
 *   - Called by: SpanOps, QuadScanOps, CircleOps, LineOps, ArcOps,
 *                RoundedRectOpsAA, RoundedRectOpsRot
 *
 * NAMING PATTERN: {operation}_{opacity}
 *   - blend_Alpha: Single pixel alpha blending (source-over compositing)
 */
class PixelOps {
    /**
     * Blend a single pixel with source-over alpha compositing
     *
     * IMPORTANT: Caller is responsible for:
     *   1. Bounds checking (pixelIndex within surface)
     *   2. Clipping check (if clipBuffer exists)
     *
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1), pre-multiplied with globalAlpha
     * @param {number} invAlpha - Inverse alpha (1 - alpha), pre-computed for efficiency
     */
    static blend_Alpha(data, pixelIndex, r, g, b, alpha, invAlpha) {
        const offset = pixelIndex * 4;
        const dstA = data[offset + 3] / 255;
        const dstAScaled = dstA * invAlpha;
        const outA = alpha + dstAScaled;

        if (outA > 0) {
            const blendFactor = 1 / outA;
            data[offset]     = (r * alpha + data[offset] * dstAScaled) * blendFactor;
            data[offset + 1] = (g * alpha + data[offset + 1] * dstAScaled) * blendFactor;
            data[offset + 2] = (b * alpha + data[offset + 2] * dstAScaled) * blendFactor;
            data[offset + 3] = outA * 255;
        }
    }
}

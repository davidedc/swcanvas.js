/**
 * Level 0 (Base) Templates - Pixel Operations
 *
 * These templates do NOT include clipping logic.
 * Contract: Caller checks clipBuffer BEFORE the marker (for span-based rendering).
 *
 * Used by: Level 1 clipped templates via chained expansion
 */

const BASE_TEMPLATES = {
    /**
     * Porter-Duff source-over alpha blending for a single pixel.
     * Matches the hand-written inline code structure for optimal V8 optimization.
     *
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1), pre-multiplied with globalAlpha
     * @param {number} invAlpha - Inverse alpha (1 - alpha), pre-computed for efficiency
     */
    'BLEND_ALPHA': {
        params: ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha'],
        // No outer {} block - matches original hand-written inline code structure.
        // Use alpha directly 4 times (no caching) - all call sites pass simple variables.
        // No parentheses around pixelIndex - all call sites now pass simple variables.
        // No parentheses around invAlpha - all call sites pass simple variables.
        code: `const __off = {{pixelIndex}} * 4;
const __dstA = {{data}}[__off + 3] / 255;
const __dstAScaled = __dstA * {{invAlpha}};
const __outA = {{alpha}} + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    {{data}}[__off]     = ({{r}} * {{alpha}} + {{data}}[__off] * __dstAScaled) * __blend;
    {{data}}[__off + 1] = ({{g}} * {{alpha}} + {{data}}[__off + 1] * __dstAScaled) * __blend;
    {{data}}[__off + 2] = ({{b}} * {{alpha}} + {{data}}[__off + 2] * __dstAScaled) * __blend;
    {{data}}[__off + 3] = __outA * 255;
}`
    },

    /**
     * Direct 32-bit opaque pixel write.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     */
    'SET_OPAQUE': {
        params: ['data32', 'pixelIndex', 'packedColor'],
        code: `{{data32}}[{{pixelIndex}}] = {{packedColor}};`
    }
};

module.exports = BASE_TEMPLATES;

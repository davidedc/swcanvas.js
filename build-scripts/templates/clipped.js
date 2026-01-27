/**
 * Level 1 (Clipped) Templates - Pixel Operations with Clipping
 *
 * These templates include inline clipping check.
 * Contract: Bounds checking is caller's responsibility. Template only checks clipping.
 * Chain to: Level 0 base templates via nested markers
 *
 * Used by: Per-pixel loops where clipping cannot be hoisted to span level
 * Used by: Level 2 arc templates via chained expansion
 */

const CLIPPED_TEMPLATES = {
    /**
     * Direct 32-bit opaque pixel write with inline clipping check.
     * Use this in per-pixel loops where clipping cannot be hoisted to span level.
     *
     * Contract: Bounds checking is caller's responsibility. This template only checks clipping.
     * Uses chained expansion: references SET_OPAQUE template.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     */
    'SET_OPAQUE_CLIPPED': {
        params: ['data32', 'pixelIndex', 'packedColor', 'clipBuffer'],
        code: `if (!{{clipBuffer}} || ({{clipBuffer}}[{{pixelIndex}} >> 3] & (1 << ({{pixelIndex}} & 7)))) {
    /*@inline:SET_OPAQUE({{data32}}, {{pixelIndex}}, {{packedColor}})*/
}`
    },

    /**
     * Porter-Duff source-over alpha blending with inline clipping check.
     * Use this in per-pixel loops where clipping cannot be hoisted to span level.
     *
     * Contract: Bounds checking is caller's responsibility. This template only checks clipping.
     * Uses chained expansion: references BLEND_ALPHA template.
     *
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1), pre-multiplied with globalAlpha
     * @param {number} invAlpha - Inverse alpha (1 - alpha), pre-computed for efficiency
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     */
    'BLEND_ALPHA_CLIPPED': {
        params: ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha', 'clipBuffer'],
        code: `if (!{{clipBuffer}} || ({{clipBuffer}}[{{pixelIndex}} >> 3] & (1 << ({{pixelIndex}} & 7)))) {
    /*@inline:BLEND_ALPHA({{data}}, {{pixelIndex}}, {{r}}, {{g}}, {{b}}, {{alpha}}, {{invAlpha}})*/
}`
    }
};

module.exports = CLIPPED_TEMPLATES;

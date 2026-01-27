/**
 * Level 2 (Arc Fast) Templates - Arc Rendering with Fast Angle Checks
 *
 * These templates include:
 * - Cross-product angle range check (10-50x faster than atan2)
 * - Bounds checking (px, py within surface dimensions)
 * - Clipping check (via chained template)
 *
 * Contract: All checks are included. Computes pixelIndex internally.
 * Chain to: Level 1 clipped templates via nested markers
 *
 * Used by: Arc-specific per-pixel loops (Bresenham arc rendering)
 */

const ARC_TEMPLATES = {
    /**
     * Fast opaque pixel write for arc rendering using cross-product angle check + bounds + clipping.
     * Uses cross-product instead of atan2 for 10-50x faster angle checking.
     *
     * Cross-product logic: A point P is "left of" vector V if cross(V, P) >= 0
     * - afterStart = (startCos * py - startSin * px) >= 0
     * - beforeEnd = (endCos * py - endSin * px) <= 0
     * - Small arc (<180°): afterStart AND beforeEnd
     * - Large arc (>180°): afterStart OR beforeEnd
     *
     * Includes bounds checking (px, py, width, height) and computes pixelIndex internally.
     * Uses chained expansion: references SET_OPAQUE_CLIPPED template.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     * @param {number} dx - X offset from arc center (for angle check)
     * @param {number} dy - Y offset from arc center (for angle check)
     * @param {number} startCos - cos(startAngle), precomputed
     * @param {number} startSin - sin(startAngle), precomputed
     * @param {number} endCos - cos(endAngle), precomputed
     * @param {number} endSin - sin(endAngle), precomputed
     * @param {boolean} isLargeArc - True if arc spans > 180°
     * @param {number} px - Screen X coordinate
     * @param {number} py - Screen Y coordinate
     * @param {number} width - Surface width
     * @param {number} height - Surface height
     */
    'SET_OPAQUE_ARC_FAST_CLIPPED': {
        params: ['data32', 'packedColor', 'clipBuffer', 'dx', 'dy', 'startCos', 'startSin', 'endCos', 'endSin', 'isLargeArc', 'px', 'py', 'width', 'height'],
        code: `{
    const __afterStart = ({{startCos}} * {{dy}} - {{startSin}} * {{dx}}) >= 0;
    const __beforeEnd = ({{endCos}} * {{dy}} - {{endSin}} * {{dx}}) <= 0;
    const __inRange = {{isLargeArc}} ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && {{px}} >= 0 && {{px}} < {{width}} && {{py}} >= 0 && {{py}} < {{height}}) {
        const __pos = {{py}} * {{width}} + {{px}};
        /*@inline:SET_OPAQUE_CLIPPED({{data32}}, __pos, {{packedColor}}, {{clipBuffer}})*/
    }
}`
    },

    /**
     * Fast alpha blending for arc rendering using cross-product angle check + bounds + clipping.
     * Uses cross-product instead of atan2 for 10-50x faster angle checking.
     *
     * Includes bounds checking (px, py, width, height) and computes pixelIndex internally.
     * Uses chained expansion: references BLEND_ALPHA_CLIPPED template.
     *
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1)
     * @param {number} invAlpha - Inverse alpha (1 - alpha)
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     * @param {number} dx - X offset from arc center (for angle check)
     * @param {number} dy - Y offset from arc center (for angle check)
     * @param {number} startCos - cos(startAngle), precomputed
     * @param {number} startSin - sin(startAngle), precomputed
     * @param {number} endCos - cos(endAngle), precomputed
     * @param {number} endSin - sin(endAngle), precomputed
     * @param {boolean} isLargeArc - True if arc spans > 180°
     * @param {number} px - Screen X coordinate
     * @param {number} py - Screen Y coordinate
     * @param {number} width - Surface width
     * @param {number} height - Surface height
     */
    'BLEND_ALPHA_ARC_FAST_CLIPPED': {
        params: ['data', 'r', 'g', 'b', 'alpha', 'invAlpha', 'clipBuffer', 'dx', 'dy', 'startCos', 'startSin', 'endCos', 'endSin', 'isLargeArc', 'px', 'py', 'width', 'height'],
        code: `{
    const __afterStart = ({{startCos}} * {{dy}} - {{startSin}} * {{dx}}) >= 0;
    const __beforeEnd = ({{endCos}} * {{dy}} - {{endSin}} * {{dx}}) <= 0;
    const __inRange = {{isLargeArc}} ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && {{px}} >= 0 && {{px}} < {{width}} && {{py}} >= 0 && {{py}} < {{height}}) {
        const __pos = {{py}} * {{width}} + {{px}};
        /*@inline:BLEND_ALPHA_CLIPPED({{data}}, __pos, {{r}}, {{g}}, {{b}}, {{alpha}}, {{invAlpha}}, {{clipBuffer}})*/
    }
}`
    }
};

module.exports = ARC_TEMPLATES;

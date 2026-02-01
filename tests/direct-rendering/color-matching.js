/**
 * Color Matching Utilities
 *
 * Color comparison and pixel classification utilities for shape integrity checks.
 * Includes standard colors used in fill+stroke tests.
 *
 * @module color-matching
 */

// Standard colors for fill+stroke tests (from Color Standardization Guidelines)
const STANDARD_STROKE_COLOR = [255, 0, 0];  // Red
const STANDARD_FILL_COLOR = [0, 0, 255];    // Blue

/**
 * Compare two colors with tolerance.
 * For semi-transparent colors blended on transparent background,
 * use higher tolerance (30+) since RGB values shift during alpha blending.
 * @param {number[]} color1 - [r, g, b]
 * @param {number[]} color2 - [r, g, b]
 * @param {number} tolerance - Maximum allowed difference per channel (default: 30)
 * @returns {boolean} True if colors are within tolerance
 */
function colorsMatch(color1, color2, tolerance = 30) {
    const r1 = color1[0], g1 = color1[1], b1 = color1[2];
    const r2 = color2[0], g2 = color2[1], b2 = color2[2];
    return Math.abs(r1 - r2) <= tolerance &&
           Math.abs(g1 - g2) <= tolerance &&
           Math.abs(b1 - b2) <= tolerance;
}

/**
 * Classify a pixel as 'stroke', 'fill', or 'unknown' based on standard colors.
 * Works with both opaque and semi-transparent versions.
 * @param {number} r - Red component
 * @param {number} g - Green component
 * @param {number} b - Blue component
 * @param {number[]} strokeColor - [r, g, b] stroke color
 * @param {number[]} fillColor - [r, g, b] fill color
 * @param {number} tolerance - Color matching tolerance
 * @returns {string} 'stroke', 'fill', or 'unknown'
 */
function classifyPixel(r, g, b, strokeColor, fillColor, tolerance) {
    if (colorsMatch([r, g, b], strokeColor, tolerance)) return 'stroke';
    if (colorsMatch([r, g, b], fillColor, tolerance)) return 'fill';
    return 'unknown';
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STANDARD_STROKE_COLOR,
        STANDARD_FILL_COLOR,
        colorsMatch,
        classifyPixel
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.STANDARD_STROKE_COLOR = STANDARD_STROKE_COLOR;
    window.STANDARD_FILL_COLOR = STANDARD_FILL_COLOR;
    window.colorsMatch = colorsMatch;
    window.classifyPixel = classifyPixel;
}

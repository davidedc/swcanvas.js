/**
 * Random Test Value Generators
 *
 * Functions for generating random colors and points for test parameters.
 * All functions use SeededRandom for deterministic, reproducible values.
 *
 * @module random-test-values
 */

// Node.js: import SeededRandom (browser uses window.SeededRandom at call time)
let _nodeSeededRandom;
if (typeof module !== 'undefined' && module.exports) {
    _nodeSeededRandom = require('./seeded-random.js').SeededRandom;
}

// Helper to get SeededRandom (Node.js module or browser window)
function _getSeededRandom() {
    return _nodeSeededRandom || (typeof window !== 'undefined' && window.SeededRandom);
}

/**
 * Get a random color for testing
 * @param {string} mode - 'opaque', 'semitransparent', 'semitransparent-light',
 *                        'semitransparent-visible', 'mixed', or 'mixed-visible'
 *   - 'semitransparent-visible': Guarantees color remains visible on white background
 *     with colorTolerance up to ~15 (at least one channel is dark enough after blending)
 * @returns {string} CSS color string
 */
function getRandomColor(mode = 'opaque') {
    const SeededRandom = _getSeededRandom();
    const r = Math.floor(SeededRandom.getRandom() * 256);
    const g = Math.floor(SeededRandom.getRandom() * 256);
    const b = Math.floor(SeededRandom.getRandom() * 256);

    let alpha;
    switch (mode) {
        case 'opaque':
            return `rgb(${r}, ${g}, ${b})`;
        case 'semitransparent':
            // Alpha range 100-200 (out of 255) -> ~0.39-0.78
            alpha = (100 + Math.floor(SeededRandom.getRandom() * 101)) / 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        case 'semitransparent-light':
            // Alpha range 50-150 (out of 255) -> ~0.20-0.59
            alpha = (50 + Math.floor(SeededRandom.getRandom() * 101)) / 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        case 'mixed':
            // 50% chance opaque, 50% chance semitransparent
            if (SeededRandom.getRandom() < 0.5) {
                return `rgb(${r}, ${g}, ${b})`;
            } else {
                alpha = (100 + Math.floor(SeededRandom.getRandom() * 101)) / 255;
                return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
            }
        case 'semitransparent-visible':
            // Generates colors guaranteed to be visible on white background
            // with colorTolerance up to ~15
            // Ensures at least one channel is dark enough to remain visible after blending
            alpha = (100 + Math.floor(SeededRandom.getRandom() * 101)) / 255;  // 0.39-0.78

            // To guarantee visibility: at least one channel must be < 255 - tolerance/alpha
            // With tolerance=15 and alpha=0.39 (worst case): channel < 255 - 38.5 ≈ 216
            // We'll ensure the darkest channel is at most 200 for safety margin
            const maxForVisibility = 200;

            // Generate all three channels
            let rv = Math.floor(SeededRandom.getRandom() * 256);
            let gv = Math.floor(SeededRandom.getRandom() * 256);
            let bv = Math.floor(SeededRandom.getRandom() * 256);

            // Ensure at least one channel is dark enough
            const minChannel = Math.min(rv, gv, bv);
            if (minChannel > maxForVisibility) {
                // Pick a random channel to make dark
                const channelToFix = Math.floor(SeededRandom.getRandom() * 3);
                if (channelToFix === 0) rv = Math.floor(SeededRandom.getRandom() * (maxForVisibility + 1));
                else if (channelToFix === 1) gv = Math.floor(SeededRandom.getRandom() * (maxForVisibility + 1));
                else bv = Math.floor(SeededRandom.getRandom() * (maxForVisibility + 1));
            }

            return `rgba(${rv}, ${gv}, ${bv}, ${alpha.toFixed(2)})`;
        case 'mixed-visible':
            // 50% opaque, 50% semitransparent-visible
            if (SeededRandom.getRandom() < 0.5) {
                return `rgb(${r}, ${g}, ${b})`;
            } else {
                return getRandomColor('semitransparent-visible');
            }
        default:
            return `rgb(${r}, ${g}, ${b})`;
    }
}

/**
 * Get a random point within canvas bounds
 * @param {number} decimalPlaces - Number of decimal places (null for full precision)
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} margin - Margin from edges (default 100)
 * @returns {Object} Point with x, y coordinates
 */
function getRandomPoint(decimalPlaces = null, canvasWidth, canvasHeight, margin = 100) {
    const SeededRandom = _getSeededRandom();
    const x = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
    const y = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);

    if (decimalPlaces === null) {
        return { x, y };
    }

    return {
        x: Number(x.toFixed(decimalPlaces)),
        y: Number(y.toFixed(decimalPlaces))
    };
}

/**
 * Get a fully opaque random color
 * @returns {string} CSS color string
 */
function getRandomOpaqueColor() {
    const SeededRandom = _getSeededRandom();
    const r = Math.floor(100 + SeededRandom.getRandom() * 155);
    const g = Math.floor(100 + SeededRandom.getRandom() * 155);
    const b = Math.floor(100 + SeededRandom.getRandom() * 155);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get a fully opaque random color guaranteed to be visible on white background
 * with colorTolerance up to ~15 (at least one channel is dark enough)
 * @returns {string} CSS color string
 */
function getRandomOpaqueVisibleColor() {
    const SeededRandom = _getSeededRandom();
    // Generate channels in range 100-254
    let r = Math.floor(100 + SeededRandom.getRandom() * 155);
    let g = Math.floor(100 + SeededRandom.getRandom() * 155);
    let b = Math.floor(100 + SeededRandom.getRandom() * 155);

    // Ensure at least one channel is dark enough to be visible on white
    // With max 200, difference from white is at least 55 (well above typical tolerance 8-15)
    const maxForVisibility = 200;
    const minChannel = Math.min(r, g, b);

    if (minChannel > maxForVisibility) {
        // Pick a random channel to make darker
        const channelToFix = Math.floor(SeededRandom.getRandom() * 3);
        // Generate in range [100, maxForVisibility]
        const darkValue = Math.floor(100 + SeededRandom.getRandom() * (maxForVisibility - 100 + 1));
        if (channelToFix === 0) r = darkValue;
        else if (channelToFix === 1) g = darkValue;
        else b = darkValue;
    }

    return `rgb(${r}, ${g}, ${b})`;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getRandomColor,
        getRandomPoint,
        getRandomOpaqueColor,
        getRandomOpaqueVisibleColor
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.getRandomColor = getRandomColor;
    window.getRandomPoint = getRandomPoint;
    window.getRandomOpaqueColor = getRandomOpaqueColor;
    window.getRandomOpaqueVisibleColor = getRandomOpaqueVisibleColor;
}

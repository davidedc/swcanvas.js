/**
 * Performance Size Categories
 *
 * Configuration and getters for parametric performance tests.
 * Defines stroke width, shape size, and arc angle categories
 * used by /perf-cases/ tests.
 *
 * @module performance-size-categories
 */

/**
 * Performance test size categories for parametric benchmark generation.
 *
 * SWCanvas uses different algorithms based on stroke width:
 * - 0px: No-op (per HTML5 Canvas spec)
 * - 1px: Bresenham algorithm (fast, pixel-perfect)
 * - >1.5px: Thick stroke algorithms (SpanOps, QuadScanOps, annulus)
 *
 * Performance benchmarks must isolate these code paths.
 */
const PERF_SIZE_CATEGORIES = {
    /**
     * Stroke width categories (9 total)
     * - sw0: Zero stroke (no-op per HTML5 spec)
     * - sw1px: Bresenham 1px strokes
     * - swXXS-swXXL: Thick stroke algorithms
     */
    strokeWidth: {
        sw0:    { min: 0, max: 0, label: '0px (No Stroke)' },
        sw1px:  { min: 1, max: 1, label: '1px (Bresenham)' },
        swXXS:  { min: 2, max: 3, label: 'XXS Thick (2-3px)' },
        swXS:   { min: 3, max: 5, label: 'XS Thick (3-5px)' },
        swS:    { min: 5, max: 10, label: 'S Thick (5-10px)' },
        swM:    { min: 10, max: 20, label: 'M Thick (10-20px)' },
        swL:    { min: 20, max: 40, label: 'L Thick (20-40px)' },
        swXL:   { min: 40, max: 80, label: 'XL Thick (40-80px)' },
        swXXL:  { min: 80, max: 150, label: 'XXL Thick (80-150px)' }
    },

    /**
     * Shape size categories (7 total)
     * Applies to width/height for rectangles, diameter for circles
     */
    shapeSize: {
        szXXS:  { min: 2, max: 8, label: 'XXS (2-8px)' },
        szXS:   { min: 5, max: 15, label: 'XS (5-15px)' },
        szS:    { min: 16, max: 39, label: 'S (16-39px)' },
        szM:    { min: 40, max: 79, label: 'M (40-79px)' },
        szL:    { min: 80, max: 159, label: 'L (80-159px)' },
        szXL:   { min: 160, max: 300, label: 'XL (160-300px)' },
        szXXL:  { min: 300, max: 500, label: 'XXL (300-500px)' }
    },

    /**
     * Arc angle categories (4 total)
     * Controls the angular extent of arcs
     */
    arcAngle: {
        angS:   { min: 30, max: 90, label: 'Small (30-90°)' },
        angM:   { min: 90, max: 180, label: 'Medium (90-180°)' },
        angL:   { min: 180, max: 270, label: 'Large (180-270°)' },
        angXL:  { min: 270, max: 350, label: 'Nearly Full (270-350°)' }
    }
};

/**
 * Get a stroke width value from a category key.
 * @param {string} key - Stroke width category key (e.g., 'sw1px', 'swM')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @param {boolean} narrowRange - If true, use ±0.5% around middle of range (default: false)
 * @returns {number} Stroke width value
 */
function getStrokeWidthFromCategory(key, randomFn = Math.random, narrowRange = false) {
    const cat = PERF_SIZE_CATEGORIES.strokeWidth[key];
    if (!cat) throw new Error(`Unknown stroke width category: ${key}`);
    if (cat.min === cat.max) return cat.min;

    if (narrowRange) {
        // Use middle of range ±0.5%
        const middle = (cat.min + cat.max) / 2;
        const halfVariance = middle * 0.005;  // 0.5%
        return middle - halfVariance + randomFn() * (2 * halfVariance);
    }

    return cat.min + randomFn() * (cat.max - cat.min);
}

/**
 * Get a shape size value from a category key.
 * Returns a dimension value (width/height for rectangles, diameter for circles).
 * @param {string} key - Size category key (e.g., 'szS', 'szL')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @param {boolean} narrowRange - If true, use ±0.5% around middle of range (default: false)
 * @returns {number} Size value
 */
function getShapeSizeFromCategory(key, randomFn = Math.random, narrowRange = false) {
    const cat = PERF_SIZE_CATEGORIES.shapeSize[key];
    if (!cat) throw new Error(`Unknown shape size category: ${key}`);

    if (narrowRange) {
        // Use middle of range ±0.5%
        const middle = (cat.min + cat.max) / 2;
        const halfVariance = middle * 0.005;  // 0.5%
        return middle - halfVariance + randomFn() * (2 * halfVariance);
    }

    return cat.min + randomFn() * (cat.max - cat.min);
}

/**
 * Get a radius value from a shape size category.
 * Returns size / 2 for use with circles/arcs.
 * @param {string} key - Size category key (e.g., 'szS', 'szL')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @param {boolean} narrowRange - If true, use ±0.5% around middle of range (default: false)
 * @returns {number} Radius value
 */
function getRadiusFromShapeCategory(key, randomFn = Math.random, narrowRange = false) {
    return getShapeSizeFromCategory(key, randomFn, narrowRange) / 2;
}

/**
 * Get an arc angle (in radians) from an angle category key.
 * @param {string} key - Angle category key (e.g., 'angS', 'angM')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @param {boolean} narrowRange - If true, use ±0.5% around middle of range (default: false)
 * @returns {number} Angle in radians
 */
function getArcAngleFromCategory(key, randomFn = Math.random, narrowRange = false) {
    const cat = PERF_SIZE_CATEGORIES.arcAngle[key];
    if (!cat) throw new Error(`Unknown arc angle category: ${key}`);

    let degrees;
    if (narrowRange) {
        // Use middle of range ±0.5%
        const middle = (cat.min + cat.max) / 2;
        const halfVariance = middle * 0.005;  // 0.5%
        degrees = middle - halfVariance + randomFn() * (2 * halfVariance);
    } else {
        degrees = cat.min + randomFn() * (cat.max - cat.min);
    }

    return degrees * Math.PI / 180;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PERF_SIZE_CATEGORIES,
        getStrokeWidthFromCategory,
        getShapeSizeFromCategory,
        getRadiusFromShapeCategory,
        getArcAngleFromCategory
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.PERF_SIZE_CATEGORIES = PERF_SIZE_CATEGORIES;
    window.getStrokeWidthFromCategory = getStrokeWidthFromCategory;
    window.getShapeSizeFromCategory = getShapeSizeFromCategory;
    window.getRadiusFromShapeCategory = getRadiusFromShapeCategory;
    window.getArcAngleFromCategory = getArcAngleFromCategory;
}

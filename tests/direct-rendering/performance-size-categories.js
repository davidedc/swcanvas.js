/**
 * Performance Size Categories
 *
 * Configuration and getters for parametric performance tests.
 * Defines stroke width, shape size, and arc angle categories
 * used by /perf-cases/ tests.
 *
 * Also provides stratified coverage sequence generation for representative
 * benchmark sampling across the full range of each category.
 *
 * @module performance-size-categories
 */

/**
 * Create a seeded pseudo-random number generator.
 * Uses mulberry32 algorithm for simplicity and quality.
 * @param {number} seed - Initial seed
 * @returns {function} Function returning random number in [0, 1)
 */
function createSeededRandom(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * Generate a coverage sequence for uniform stratified sampling.
 *
 * This function creates a deterministic sequence that:
 * - Covers the FULL bracket range (representative sampling)
 * - Uses the same sequence for all sub-runs (maintains low CV)
 * - Interleaves strata so consecutive shapes have different sizes (breaks CPU caching)
 *
 * For a bracket like szL (80-159px) with 10 strata:
 *   Shape 0: stratum 0 (80-87px)  → e.g., 82px
 *   Shape 1: stratum 1 (88-95px)  → e.g., 93px
 *   Shape 2: stratum 2 (96-103px) → e.g., 101px
 *   ...
 *   Shape 10: stratum 0 again (different random within stratum)
 *
 * @param {number} seed - Deterministic seed for reproducibility
 * @param {number} count - Number of values to generate
 * @param {Object} bracket - { min, max } bracket definition
 * @param {number} [numStrata=10] - Number of strata to divide range into
 * @returns {Float32Array} Pre-computed sequence of values
 */
function generateCoverageSequence(seed, count, bracket, numStrata = 10) {
    const rng = createSeededRandom(seed);
    const values = new Float32Array(count);
    const range = bracket.max - bracket.min;

    for (let i = 0; i < count; i++) {
        // Shape i → stratum (i % numStrata)
        // Consecutive shapes have DIFFERENT sizes
        const stratum = i % numStrata;
        const stratumMin = bracket.min + (stratum / numStrata) * range;
        const stratumMax = bracket.min + ((stratum + 1) / numStrata) * range;
        values[i] = stratumMin + rng() * (stratumMax - stratumMin);
    }
    return values;
}

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
 * @returns {number} Stroke width value
 */
function getStrokeWidthFromCategory(key, randomFn = Math.random) {
    const cat = PERF_SIZE_CATEGORIES.strokeWidth[key];
    if (!cat) throw new Error(`Unknown stroke width category: ${key}`);
    if (cat.min === cat.max) return cat.min;

    return cat.min + randomFn() * (cat.max - cat.min);
}

/**
 * Get a shape size value from a category key.
 * Returns a dimension value (width/height for rectangles, diameter for circles).
 * @param {string} key - Size category key (e.g., 'szS', 'szL')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @returns {number} Size value
 */
function getShapeSizeFromCategory(key, randomFn = Math.random) {
    const cat = PERF_SIZE_CATEGORIES.shapeSize[key];
    if (!cat) throw new Error(`Unknown shape size category: ${key}`);

    return cat.min + randomFn() * (cat.max - cat.min);
}

/**
 * Get a radius value from a shape size category.
 * Returns size / 2 for use with circles/arcs.
 * @param {string} key - Size category key (e.g., 'szS', 'szL')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @returns {number} Radius value
 */
function getRadiusFromShapeCategory(key, randomFn = Math.random) {
    return getShapeSizeFromCategory(key, randomFn) / 2;
}

/**
 * Get an arc angle (in radians) from an angle category key.
 * @param {string} key - Angle category key (e.g., 'angS', 'angM')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @returns {number} Angle in radians
 */
function getArcAngleFromCategory(key, randomFn = Math.random) {
    const cat = PERF_SIZE_CATEGORIES.arcAngle[key];
    if (!cat) throw new Error(`Unknown arc angle category: ${key}`);

    const degrees = cat.min + randomFn() * (cat.max - cat.min);
    return degrees * Math.PI / 180;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PERF_SIZE_CATEGORIES,
        createSeededRandom,
        generateCoverageSequence,
        getStrokeWidthFromCategory,
        getShapeSizeFromCategory,
        getRadiusFromShapeCategory,
        getArcAngleFromCategory
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.PERF_SIZE_CATEGORIES = PERF_SIZE_CATEGORIES;
    window.createSeededRandom = createSeededRandom;
    window.generateCoverageSequence = generateCoverageSequence;
    window.getStrokeWidthFromCategory = getStrokeWidthFromCategory;
    window.getShapeSizeFromCategory = getShapeSizeFromCategory;
    window.getRadiusFromShapeCategory = getRadiusFromShapeCategory;
    window.getArcAngleFromCategory = getArcAngleFromCategory;
}

/**
 * Parametric Performance Test Generator for SWCanvas
 *
 * Generates performance benchmarks from a configuration, creating tests
 * for all combinations of stroke widths, shape sizes, and optionally arc angles.
 *
 * SWCanvas uses different algorithms based on stroke width:
 * - 0px: No-op (per HTML5 Canvas spec)
 * - 1px: Bresenham algorithm (fast, pixel-perfect)
 * - >1.5px: Thick stroke algorithms (SpanOps, QuadScanOps, annulus)
 *
 * This generator creates tests that isolate these code paths for benchmarking.
 */

/**
 * Register parametric performance tests based on configuration.
 *
 * @param {Object} config - Test configuration
 * @param {string} config.baseId - Base test ID (e.g., 'line-perf')
 * @param {string} config.baseName - Human-readable base name (e.g., 'Lines')
 * @param {string} config.category - Test category for grouping
 * @param {function} config.drawFunction - Drawing function (ctx, instances, params) => void
 * @param {string[]} config.operations - Array of operations: ['stroke'], ['fill'], or ['stroke', 'fill']
 * @param {boolean} [config.includeArcAngles=false] - Whether to iterate arc angle categories
 * @param {string[]} [config.strokeCategories] - Override default stroke categories
 * @param {string[]} [config.sizeCategories] - Override default size categories
 * @param {string[]} [config.angleCategories] - Override default arc angle categories
 *
 * The drawFunction receives:
 * - ctx: Canvas context
 * - instances: Number of shapes to draw (0 = single for visual, >0 for perf)
 * - params: Object with { strokeKey, sizeKey, angleKey, operation }
 */
function registerParametricPerfTests(config) {
    const {
        baseId,
        baseName,
        category,
        drawFunction,
        operations,
        includeArcAngles = false,
        strokeCategories = Object.keys(PERF_SIZE_CATEGORIES.strokeWidth),
        sizeCategories = Object.keys(PERF_SIZE_CATEGORIES.shapeSize),
        angleCategories = Object.keys(PERF_SIZE_CATEGORIES.arcAngle)
    } = config;

    // Get category labels for human-readable names
    const strokeLabels = PERF_SIZE_CATEGORIES.strokeWidth;
    const sizeLabels = PERF_SIZE_CATEGORIES.shapeSize;
    const angleLabels = PERF_SIZE_CATEGORIES.arcAngle;

    // Track how many tests are generated
    let testCount = 0;

    // Iterate all combinations
    for (const strokeKey of strokeCategories) {
        for (const sizeKey of sizeCategories) {
            const angleLoop = includeArcAngles ? angleCategories : [null];

            for (const angleKey of angleLoop) {
                for (const operation of operations) {
                    // Skip logic based on operation type and stroke width:
                    // - fill-opaque/fill-semi: ONLY valid for sw0 (no stroke to draw)
                    // - stroke-*: Skip sw0 (no stroke to draw)
                    // - fill-*-stroke-*: Skip sw0 (need stroke width > 0)
                    const isFillOnly = (operation === 'fill-opaque' || operation === 'fill-semi');
                    const hasStroke = operation.includes('stroke');

                    if (isFillOnly && strokeKey !== 'sw0') {
                        // Fill-only operations only make sense with sw0
                        continue;
                    }
                    if (hasStroke && strokeKey === 'sw0') {
                        // Any stroke operation requires sw > 0
                        continue;
                    }

                    // Build test ID
                    let testId = `${baseId}-${strokeKey}-${sizeKey}`;
                    if (angleKey) {
                        testId += `-${angleKey}`;
                    }
                    testId += `-${operation}`;

                    // Build human-readable perfName
                    const strokeLabel = strokeLabels[strokeKey].label;
                    const sizeLabel = sizeLabels[sizeKey].label;
                    // Convert operation to readable label (e.g., 'fill-opaque-stroke-semi' -> 'Fill Opaque+Stroke Semi')
                    const opLabel = operation
                        .split('-')
                        .map((part, i) => {
                            // Capitalize first letter of each part
                            const capitalized = part.charAt(0).toUpperCase() + part.slice(1);
                            // Add '+' before 'stroke' if it follows 'opaque' or 'semi'
                            if (part === 'stroke' && i > 0) {
                                return '+' + capitalized;
                            }
                            return capitalized;
                        })
                        .join(' ')
                        .replace(' +', '+'); // Clean up spacing around '+'
                    let perfName = `${baseName} ${opLabel}: ${strokeLabel}, ${sizeLabel}`;
                    if (angleKey) {
                        const angleLabel = angleLabels[angleKey].label;
                        perfName += `, ${angleLabel}`;
                    }

                    // Create params object for the draw function
                    const params = {
                        strokeKey,
                        sizeKey,
                        angleKey,
                        operation
                    };

                    // Create the draw function wrapper
                    const testDrawFunction = function(ctx, iterationNumber, instances) {
                        return drawFunction(ctx, instances, params);
                    };

                    // Register the test
                    registerDirectRenderingTest(
                        testId,
                        testDrawFunction,
                        category,
                        {}, // No visual checks for perf-only tests
                        {
                            perfName: perfName,
                            performanceTestSupported: true,
                            description: `Performance test: ${perfName}`,
                            strokeCategory: strokeKey,
                            sizeCategory: sizeKey,
                            angleCategory: angleKey,
                            operation: operation
                        }
                    );

                    testCount++;
                }
            }
        }
    }

    // Log registration summary
    if (typeof console !== 'undefined') {
        console.log(`[Perf Generator] Registered ${testCount} tests for ${baseName}`);
    }

    return testCount;
}

/**
 * Helper: Generate random position within canvas bounds.
 * Used by draw functions to spread shapes across canvas in performance mode.
 *
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} margin - Margin from edges
 * @returns {Object} { x, y }
 */
function getRandomPosition(canvasWidth, canvasHeight, margin = 50) {
    return {
        x: margin + Math.random() * (canvasWidth - 2 * margin),
        y: margin + Math.random() * (canvasHeight - 2 * margin)
    };
}

/**
 * Helper: Generate random line endpoints.
 * Used by line performance tests.
 *
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} length - Approximate line length
 * @returns {Object} { x1, y1, x2, y2 }
 */
function getRandomLineEndpoints(canvasWidth, canvasHeight, length) {
    const margin = Math.max(50, length / 2);
    const cx = margin + Math.random() * (canvasWidth - 2 * margin);
    const cy = margin + Math.random() * (canvasHeight - 2 * margin);
    const angle = Math.random() * Math.PI * 2;
    const halfLen = length / 2;

    return {
        x1: cx - Math.cos(angle) * halfLen,
        y1: cy - Math.sin(angle) * halfLen,
        x2: cx + Math.cos(angle) * halfLen,
        y2: cy + Math.sin(angle) * halfLen
    };
}

/**
 * Helper: Generate horizontal line endpoints (y1 === y2).
 * Used by horizontal line performance tests.
 *
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} length - Line length
 * @returns {Object} { x1, y1, x2, y2 }
 */
function getHorizontalLineEndpoints(canvasWidth, canvasHeight, length) {
    const margin = Math.max(50, length / 2);
    const cx = margin + Math.random() * (canvasWidth - 2 * margin);
    const cy = margin + Math.random() * (canvasHeight - 2 * margin);
    const halfLen = length / 2;

    return {
        x1: cx - halfLen,
        y1: cy,
        x2: cx + halfLen,
        y2: cy  // y1 === y2 for horizontal
    };
}

/**
 * Helper: Generate vertical line endpoints (x1 === x2).
 * Used by vertical line performance tests.
 *
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} length - Line length
 * @returns {Object} { x1, y1, x2, y2 }
 */
function getVerticalLineEndpoints(canvasWidth, canvasHeight, length) {
    const margin = Math.max(50, length / 2);
    const cx = margin + Math.random() * (canvasWidth - 2 * margin);
    const cy = margin + Math.random() * (canvasHeight - 2 * margin);
    const halfLen = length / 2;

    return {
        x1: cx,
        y1: cy - halfLen,
        x2: cx,  // x1 === x2 for vertical
        y2: cy + halfLen
    };
}

/**
 * Helper: Generate diagonal line endpoints (not horizontal or vertical).
 * Angles avoid 0°, 90°, 180°, 270° to ensure truly diagonal lines.
 * Used by diagonal line performance tests.
 *
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} length - Line length
 * @returns {Object} { x1, y1, x2, y2 }
 */
function getDiagonalLineEndpoints(canvasWidth, canvasHeight, length) {
    const margin = Math.max(50, length / 2);
    const cx = margin + Math.random() * (canvasWidth - 2 * margin);
    const cy = margin + Math.random() * (canvasHeight - 2 * margin);

    // Random angle avoiding 0, 90, 180, 270 degrees
    // Use angles in range [π/8, 3π/8] within each quadrant
    const quadrant = Math.floor(Math.random() * 4);
    const angleInQuadrant = (Math.PI / 8) + Math.random() * (Math.PI / 4);
    const angle = quadrant * (Math.PI / 2) + angleInQuadrant;

    const halfLen = length / 2;

    return {
        x1: cx - Math.cos(angle) * halfLen,
        y1: cy - Math.sin(angle) * halfLen,
        x2: cx + Math.cos(angle) * halfLen,
        y2: cy + Math.sin(angle) * halfLen
    };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        registerParametricPerfTests,
        getRandomPosition,
        getRandomLineEndpoints,
        getHorizontalLineEndpoints,
        getVerticalLineEndpoints,
        getDiagonalLineEndpoints
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.registerParametricPerfTests = registerParametricPerfTests;
    window.getRandomPosition = getRandomPosition;
    window.getRandomLineEndpoints = getRandomLineEndpoints;
    window.getHorizontalLineEndpoints = getHorizontalLineEndpoints;
    window.getVerticalLineEndpoints = getVerticalLineEndpoints;
    window.getDiagonalLineEndpoints = getDiagonalLineEndpoints;
}

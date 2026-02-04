/**
 * Direct Rendering Test Utilities for SWCanvas
 *
 * This file is a facade that imports and re-exports all utility modules
 * for backwards compatibility. Each module can also be imported directly
 * for more targeted imports.
 *
 * Modules:
 * - seeded-random.js: Deterministic random number generator
 * - random-test-values.js: Random color and point generators
 * - test-registry.js: Test registration and registries
 * - surface-analysis.js: Pixel-level surface analysis
 * - color-matching.js: Color comparison utilities
 * - stroke-continuity-1px.js: 1px stroke continuity checker
 * - shape-integrity-checker.js: Universal shape integrity validation
 * - validation-runner.js: Main validation orchestrator
 * - performance-size-categories.js: Performance test size configurations
 * - positioning-and-bounds.js: Positioning and bounds calculation utilities
 */

// Import all modules in Node.js
let seededRandom, randomTestValues, testRegistry, surfaceAnalysis, colorMatching,
    strokeContinuity, shapeIntegrityChecker, validationRunner, performanceSizeCategories,
    positioningAndBounds;

if (typeof module !== 'undefined' && module.exports) {
    seededRandom = require('./seeded-random.js');
    randomTestValues = require('./random-test-values.js');
    testRegistry = require('./test-registry.js');
    surfaceAnalysis = require('./surface-analysis.js');
    colorMatching = require('./color-matching.js');
    strokeContinuity = require('./stroke-continuity-1px.js');
    shapeIntegrityChecker = require('./shape-integrity-checker.js');
    validationRunner = require('./validation-runner.js');
    performanceSizeCategories = require('./performance-size-categories.js');
    positioningAndBounds = require('./positioning-and-bounds.js');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // From test-registry.js
        DIRECT_RENDERING_TESTS: testRegistry.DIRECT_RENDERING_TESTS,
        DIRECT_RENDERING_PERF_REGISTRY: testRegistry.DIRECT_RENDERING_PERF_REGISTRY,
        registerDirectRenderingTest: testRegistry.registerDirectRenderingTest,

        // From seeded-random.js
        SeededRandom: seededRandom.SeededRandom,

        // From random-test-values.js
        getRandomColor: randomTestValues.getRandomColor,
        getRandomOpaqueColor: randomTestValues.getRandomOpaqueColor,
        getRandomOpaqueVisibleColor: randomTestValues.getRandomOpaqueVisibleColor,
        getRandomPoint: randomTestValues.getRandomPoint,

        // From positioning-and-bounds.js (re-export all)
        ...positioningAndBounds,

        // From surface-analysis.js
        clampBoundsToCanvas: surfaceAnalysis.clampBoundsToCanvas,
        analyzeExtremes: surfaceAnalysis.analyzeExtremes,
        checkDimensionConsistency: surfaceAnalysis.checkDimensionConsistency,
        countUniqueColors: surfaceAnalysis.countUniqueColors,
        countUniqueColorsInMiddleRow: surfaceAnalysis.countUniqueColorsInMiddleRow,
        countUniqueColorsInMiddleColumn: surfaceAnalysis.countUniqueColorsInMiddleColumn,
        detectBackgroundColor: surfaceAnalysis.detectBackgroundColor,
        getAdjustedExpectedColorCount: surfaceAnalysis.getAdjustedExpectedColorCount,
        countSpeckles: surfaceAnalysis.countSpeckles,
        hasSpeckles: surfaceAnalysis.hasSpeckles,

        // From stroke-continuity-1px.js
        check1pxClosedStrokeContinuity: strokeContinuity.check1pxClosedStrokeContinuity,

        // From shape-integrity-checker.js
        checkShapeIntegrity: shapeIntegrityChecker.checkShapeIntegrity,

        // From validation-runner.js
        runValidationChecks: validationRunner.runValidationChecks,

        // From color-matching.js
        STANDARD_STROKE_COLOR: colorMatching.STANDARD_STROKE_COLOR,
        STANDARD_FILL_COLOR: colorMatching.STANDARD_FILL_COLOR,
        colorsMatch: colorMatching.colorsMatch,
        classifyPixel: colorMatching.classifyPixel,

        // From performance-size-categories.js
        PERF_SIZE_CATEGORIES: performanceSizeCategories.PERF_SIZE_CATEGORIES,
        createSeededRandom: performanceSizeCategories.createSeededRandom,
        generateCoverageSequence: performanceSizeCategories.generateCoverageSequence,
        getStrokeWidthFromCategory: performanceSizeCategories.getStrokeWidthFromCategory,
        getShapeSizeFromCategory: performanceSizeCategories.getShapeSizeFromCategory,
        getRadiusFromShapeCategory: performanceSizeCategories.getRadiusFromShapeCategory,
        getArcAngleFromCategory: performanceSizeCategories.getArcAngleFromCategory
    };
}

// Browser exports are handled by individual modules loaded via script tags.
// This file does not need browser-specific export code since each module
// exports its own functions to the window object.
//
// The HTML files should include the modules in dependency order:
// 1. seeded-random.js
// 2. random-test-values.js (depends on seeded-random)
// 3. test-registry.js
// 4. surface-analysis.js
// 5. color-matching.js
// 6. stroke-continuity-1px.js
// 7. shape-integrity-checker.js (depends on surface-analysis, color-matching)
// 8. validation-runner.js (depends on surface-analysis, stroke-continuity, shape-integrity)
// 9. performance-size-categories.js
// 10. positioning-and-bounds.js

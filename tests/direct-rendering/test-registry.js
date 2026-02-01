/**
 * Test Registry
 *
 * Global registries and registration function for direct rendering tests.
 *
 * @module test-registry
 */

// Test registry - stores all registered tests
const DIRECT_RENDERING_TESTS = [];

// Performance test registry - stores tests with perfName for performance testing
const DIRECT_RENDERING_PERF_REGISTRY = [];

/**
 * Register a direct rendering test
 * @param {string} name - Test name
 * @param {function} drawFunction - Function that draws the test
 * @param {string} category - Test category
 * @param {object} checks - Validation checks to perform
 * @param {object} metadata - Test metadata (include perfName for performance testing)
 */
function registerDirectRenderingTest(name, drawFunction, category, checks, metadata = {}) {
    DIRECT_RENDERING_TESTS.push({
        name,
        drawFunction,
        category,
        checks,
        metadata
    });

    // Also register for performance tests if performanceTestSupported is present
    // (only parametric tests in /perf-cases/ have this flag)
    if (metadata.performanceTestSupported) {
        DIRECT_RENDERING_PERF_REGISTRY.push({
            id: name,
            drawFunction: drawFunction,
            perfName: metadata.perfName,
            description: metadata.description || '',
            category: category,
            // Preserve full metadata for filtering (stroke/size/angle categories)
            metadata: metadata
        });
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DIRECT_RENDERING_TESTS,
        DIRECT_RENDERING_PERF_REGISTRY,
        registerDirectRenderingTest
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.DIRECT_RENDERING_TESTS = DIRECT_RENDERING_TESTS;
    window.DIRECT_RENDERING_PERF_REGISTRY = DIRECT_RENDERING_PERF_REGISTRY;
    window.registerDirectRenderingTest = registerDirectRenderingTest;
}

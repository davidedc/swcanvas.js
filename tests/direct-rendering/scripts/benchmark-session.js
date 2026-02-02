#!/usr/bin/env node
/**
 * Benchmark Session Orchestrator
 *
 * Manages a complete benchmarking session with:
 * - Warmup stabilization (adaptive JIT detection)
 * - Throttling detection (periodic reference benchmarks)
 * - Enhanced statistics (sample stddev, CI, Welch's t-test)
 * - Clean JSON output (directly to file, not stdout)
 *
 * This is the main entry point for shell scripts generated for benchmarking.
 *
 * Usage:
 *   node benchmark-session.js --output <output.json> [options]
 *
 * Options:
 *   --output <file>         Output JSON file (required)
 *   --filters <json>        Test filter configuration as JSON string
 *   --runs <N>              Number of measurement runs (default: 50)
 *   --shapes <N>            Shapes per run (default: 5000)
 *   --throttle-check        Enable throttle checking every 10 tests
 *   --warmup-stabilize      Use adaptive warmup stabilization
 *   --quiet                 Suppress progress output
 *   -h, --help              Show help message
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { execSync } = require('child_process');

// Import our new modules
const Statistics = require('../lib/statistics');
const ThrottleDetector = require('../lib/throttle-detector');
const WarmupStabilizer = require('../lib/warmup-stabilizer');

// Configuration defaults
const DEFAULT_SHAPES = 5000;
const DEFAULT_RUNS = 50;
const DEFAULT_WARMUP_MIN = 50;
const DEFAULT_WARMUP_MAX = 300;
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;
const THROTTLE_CHECK_INTERVAL = 10; // Check every 10 tests

// Parse command line arguments
const args = process.argv.slice(2);
let outputFile = null;
let filtersJson = null;
let shapesPerRun = DEFAULT_SHAPES;
let numRuns = DEFAULT_RUNS;
let enableThrottleCheck = false;
let enableWarmupStabilize = false;
let quietMode = false;

// Help text
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Benchmark Session Orchestrator

Manages a complete benchmarking session with enhanced statistics,
warmup stabilization, and throttle detection.

Usage: node benchmark-session.js --output <output.json> [options]

Options:
  --output <file>         Output JSON file (required)
  --filters <json>        Test filter configuration as JSON string
                          Example: '{"test":"arc","stroke":"sw1px"}'
  --runs <N>              Number of measurement runs (default: ${DEFAULT_RUNS})
  --shapes <N>            Shapes per run (default: ${DEFAULT_SHAPES})
  --throttle-check        Enable throttle checking every 10 tests
  --warmup-stabilize      Use adaptive warmup stabilization
  --quiet                 Suppress progress output
  -h, --help              Show this help message

Output Format:
  Produces JSON v2.0 format with:
  - Full metadata (git commit, timestamp, platform, config)
  - Throttling summary (if enabled)
  - Per-test statistics (mean, median, stddev, SEM, CI95, raw measurements)

Examples:
  # Basic run
  node benchmark-session.js --output baseline.json

  # With filters and enhanced features
  node benchmark-session.js \\
    --output baseline.json \\
    --filters '{"shape":"arc","stroke":"sw1px"}' \\
    --runs 50 \\
    --shapes 5000 \\
    --throttle-check \\
    --warmup-stabilize
`);
    process.exit(0);
}

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' && args[i + 1]) {
        outputFile = args[i + 1];
        i++;
    } else if (arg.startsWith('--output=')) {
        outputFile = arg.split('=')[1];
    } else if (arg === '--filters' && args[i + 1]) {
        filtersJson = args[i + 1];
        i++;
    } else if (arg.startsWith('--filters=')) {
        filtersJson = arg.split('=')[1];
    } else if (arg === '--runs' && args[i + 1]) {
        numRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--runs=')) {
        numRuns = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--shapes' && args[i + 1]) {
        shapesPerRun = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--shapes=')) {
        shapesPerRun = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--throttle-check') {
        enableThrottleCheck = true;
    } else if (arg === '--warmup-stabilize') {
        enableWarmupStabilize = true;
    } else if (arg === '--quiet' || arg === '-q') {
        quietMode = true;
    }
}

// Validate required arguments
if (!outputFile) {
    console.error('Error: --output file is required');
    console.error('Use --help for usage information');
    process.exit(1);
}

// Validate parameters
if (isNaN(shapesPerRun) || shapesPerRun < 1) shapesPerRun = DEFAULT_SHAPES;
if (isNaN(numRuns) || numRuns < 1) numRuns = DEFAULT_RUNS;

// Parse filters
let filters = {};
if (filtersJson) {
    try {
        filters = JSON.parse(filtersJson);
    } catch (e) {
        console.error(`Error parsing filters JSON: ${e.message}`);
        process.exit(1);
    }
}

// ============================================================================
// Load SWCanvas and test infrastructure
// ============================================================================

const minifiedPath = path.join(__dirname, '../../../dist/swcanvas.min.js');
if (!fs.existsSync(minifiedPath)) {
    console.error(
        '\x1b[31mError: Minified build not found at dist/swcanvas.min.js\x1b[0m'
    );
    console.error('Performance tests require the minified build for accurate results.');
    console.error('Run: npm run build:prod');
    process.exit(1);
}

const SWCanvas = require('../../../dist/swcanvas.min.js');

// Load test utilities
const {
    DIRECT_RENDERING_PERF_REGISTRY,
    SeededRandom,
    getRandomColor,
    getRandomOpaqueColor,
    getRandomOpaqueVisibleColor,
    getRandomPoint,
    calculateCenterAtPixel,
    calculateCenterAtGrid,
    adjustDimensionsForCrispStrokeRendering,
    roundPoint,
    ensureHalfPoint,
    adjustCenterForCrispStrokeRendering,
    calculateCrispRectTestParams,
    calculateCircleTestParams,
    calculateArcTestParams,
    calculate90DegArcTestParams,
    generateConstrainedArcAngles,
    registerDirectRenderingTest,
    PERF_SIZE_CATEGORIES,
    getStrokeWidthFromCategory,
    getShapeSizeFromCategory,
    getRadiusFromShapeCategory,
    getArcAngleFromCategory
} = require('../direct-rendering-test-utils.js');

// Load performance test generator
const {
    registerParametricPerfTests,
    getRandomPosition,
    getRandomLineEndpoints,
    getHorizontalLineEndpoints,
    getVerticalLineEndpoints,
    getDiagonalLineEndpoints
} = require('../performance-test-generator.js');

// Make utilities globally available for test files
global.SWCanvas = SWCanvas;
global.SeededRandom = SeededRandom;
global.getRandomColor = getRandomColor;
global.getRandomOpaqueColor = getRandomOpaqueColor;
global.getRandomOpaqueVisibleColor = getRandomOpaqueVisibleColor;
global.getRandomPoint = getRandomPoint;
global.calculateCenterAtPixel = calculateCenterAtPixel;
global.calculateCenterAtGrid = calculateCenterAtGrid;
global.adjustDimensionsForCrispStrokeRendering = adjustDimensionsForCrispStrokeRendering;
global.roundPoint = roundPoint;
global.ensureHalfPoint = ensureHalfPoint;
global.adjustCenterForCrispStrokeRendering = adjustCenterForCrispStrokeRendering;
global.calculateCrispRectTestParams = calculateCrispRectTestParams;
global.calculateCircleTestParams = calculateCircleTestParams;
global.calculateArcTestParams = calculateArcTestParams;
global.calculate90DegArcTestParams = calculate90DegArcTestParams;
global.generateConstrainedArcAngles = generateConstrainedArcAngles;
global.registerDirectRenderingTest = registerDirectRenderingTest;
global.PERF_SIZE_CATEGORIES = PERF_SIZE_CATEGORIES;
global.getStrokeWidthFromCategory = getStrokeWidthFromCategory;
global.getShapeSizeFromCategory = getShapeSizeFromCategory;
global.getRadiusFromShapeCategory = getRadiusFromShapeCategory;
global.getArcAngleFromCategory = getArcAngleFromCategory;
global.registerParametricPerfTests = registerParametricPerfTests;
global.getRandomPosition = getRandomPosition;
global.getRandomLineEndpoints = getRandomLineEndpoints;
global.getHorizontalLineEndpoints = getHorizontalLineEndpoints;
global.getVerticalLineEndpoints = getVerticalLineEndpoints;
global.getDiagonalLineEndpoints = getDiagonalLineEndpoints;

// ============================================================================
// Test loading and filtering
// ============================================================================

/**
 * Load all test case files to populate the registry.
 */
function loadTestCases() {
    const directories = [
        path.join(__dirname, '../cases'),
        path.join(__dirname, '../perf-cases')
    ];

    for (const dir of directories) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

        for (const file of files) {
            try {
                require(path.join(dir, file));
            } catch (e) {
                if (!quietMode) {
                    console.error(`Error loading test case ${file}: ${e.message}`);
                }
            }
        }
    }
}

/**
 * Filter tests based on provided filters.
 */
function filterTests(tests, filters) {
    let result = tests;

    if (filters.test) {
        const filterLower = filters.test.toLowerCase();
        result = result.filter(
            (t) =>
                t.id.toLowerCase().includes(filterLower) ||
                t.perfName.toLowerCase().includes(filterLower)
        );
    }

    if (filters.stroke) {
        result = result.filter(
            (t) => t.metadata && t.metadata.strokeCategory === filters.stroke
        );
    }

    if (filters.size) {
        result = result.filter(
            (t) => t.metadata && t.metadata.sizeCategory === filters.size
        );
    }

    if (filters.shape) {
        result = result.filter((t) => t.id.startsWith(filters.shape + '-'));
    }

    if (filters.op) {
        result = result.filter(
            (t) => t.metadata && t.metadata.operation === filters.op
        );
    }

    if (filters.orient) {
        result = result.filter((t) => {
            switch (filters.orient) {
                case 'aa':
                    return (
                        t.id.includes('-horiz-') ||
                        t.id.includes('-vert-') ||
                        t.id.includes('-aa-')
                    );
                case 'rot':
                    return t.id.includes('-diag-') || t.id.includes('-rot-');
                case 'horiz':
                    return t.id.includes('-horiz-');
                case 'vert':
                    return t.id.includes('-vert-');
                default:
                    return true;
            }
        });
    }

    if (filters.angle) {
        result = result.filter(
            (t) => t.metadata && t.metadata.angleCategory === filters.angle
        );
    }

    return result;
}

// ============================================================================
// Benchmark execution
// ============================================================================

/**
 * Run warmup with optional stabilization.
 */
function runWarmup(test, ctx, stabilizer) {
    if (stabilizer) {
        // Adaptive warmup using stabilization detection
        const runBatch = (batchSize) => {
            const startTime = performance.now();
            for (let i = 0; i < batchSize; i++) {
                SeededRandom.seedWithInteger(12345 + i);
                test.drawFunction(ctx, 0, 1);
            }
            return performance.now() - startTime;
        };

        return stabilizer.stabilize(runBatch);
    } else {
        // Fixed warmup (legacy behavior)
        const iterations = 100;
        for (let i = 0; i < iterations; i++) {
            SeededRandom.seedWithInteger(12345 + i);
            test.drawFunction(ctx, 0, 1);
        }
        return { iterations, stabilized: true, finalVariance: null };
    }
}

/**
 * Measure a single run of drawing shapeCount shapes.
 */
function measureRun(test, ctx, shapeCount, runIndex) {
    SeededRandom.seedWithInteger(12345 + runIndex);
    const startTime = performance.now();
    test.drawFunction(ctx, 0, shapeCount);
    return performance.now() - startTime;
}

/**
 * Run performance test for a single test.
 */
function runPerformanceTest(test, stabilizer) {
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.canvas = canvas;

    // Warmup phase
    const warmupResult = runWarmup(test, ctx, stabilizer);

    // Measurement phase - collect all raw measurements
    const measurements = [];
    for (let run = 0; run < numRuns; run++) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const elapsed = measureRun(test, ctx, shapesPerRun, run);
        measurements.push(elapsed);
    }

    // Calculate statistics using enhanced module
    const stats = Statistics.analyze(measurements);

    // Calculate derived metrics
    const shapesPerSecond = (shapesPerRun / stats.mean) * 1000;
    const microsecondsPerShape = (stats.mean / shapesPerRun) * 1000;

    return {
        test,
        measurements,
        statistics: stats,
        shapesPerSecond,
        microsecondsPerShape,
        warmup: warmupResult
    };
}

// ============================================================================
// Main execution
// ============================================================================

function main() {
    const startTime = Date.now();

    if (!quietMode) {
        console.log('\n=== SWCanvas Benchmark Session ===\n');
        console.log(`Output: ${outputFile}`);
        console.log(`Runs: ${numRuns}, Shapes/run: ${shapesPerRun}`);
        console.log(`Throttle check: ${enableThrottleCheck ? 'enabled' : 'disabled'}`);
        console.log(`Warmup stabilize: ${enableWarmupStabilize ? 'enabled' : 'disabled'}`);
        if (Object.keys(filters).length > 0) {
            console.log(`Filters: ${JSON.stringify(filters)}`);
        }
        console.log('');
    }

    // Load test cases
    loadTestCases();

    if (DIRECT_RENDERING_PERF_REGISTRY.length === 0) {
        console.error('No performance tests registered.');
        process.exit(1);
    }

    // Filter tests
    const testsToRun = filterTests(DIRECT_RENDERING_PERF_REGISTRY, filters);

    if (testsToRun.length === 0) {
        console.error('No tests match the specified filters.');
        process.exit(1);
    }

    if (!quietMode) {
        console.log(`Running ${testsToRun.length} test(s)...\n`);
    }

    // Initialize throttle detector
    let throttleDetector = null;
    if (enableThrottleCheck) {
        throttleDetector = new ThrottleDetector(SWCanvas);
        if (!quietMode) {
            console.log('Establishing throttle baseline...');
        }
        throttleDetector.establishBaseline();
    }

    // Initialize warmup stabilizer
    let warmupStabilizer = null;
    if (enableWarmupStabilize) {
        warmupStabilizer = new WarmupStabilizer({
            minIterations: DEFAULT_WARMUP_MIN,
            maxIterations: DEFAULT_WARMUP_MAX,
            stabilityThreshold: 0.05
        });
    }

    // Run tests
    const results = [];
    for (let i = 0; i < testsToRun.length; i++) {
        const test = testsToRun[i];

        if (!quietMode) {
            process.stdout.write(
                `[${i + 1}/${testsToRun.length}] ${test.perfName}... `
            );
        }

        const result = runPerformanceTest(test, warmupStabilizer);
        results.push(result);

        if (!quietMode) {
            console.log(
                `${formatNumber(result.shapesPerSecond)} shapes/sec ` +
                    `(stddev: ${result.statistics.stddevPercent.toFixed(1)}%)`
            );
        }

        // Periodic throttle check
        if (throttleDetector && (i + 1) % THROTTLE_CHECK_INTERVAL === 0) {
            const throttleResult = throttleDetector.checkThrottling(i);
            if (throttleResult.warning && !quietMode) {
                console.log(`  ${throttleResult.warning}`);
            }
        }
    }

    // Get git info
    let gitCommit = 'unknown';
    let gitBranch = 'unknown';
    try {
        gitCommit = execSync('git rev-parse --short HEAD', {
            encoding: 'utf8',
            cwd: path.join(__dirname, '../../..')
        }).trim();
        gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf8',
            cwd: path.join(__dirname, '../../..')
        }).trim();
    } catch (e) {
        // Git not available or not a repo
    }

    // Build output
    const output = {
        version: '2.0',
        metadata: {
            timestamp: new Date().toISOString(),
            gitCommit,
            gitBranch,
            nodeVersion: process.version,
            platform: `${process.platform} ${process.arch}`,
            config: {
                shapesPerRun,
                runs: numRuns,
                warmupStrategy: enableWarmupStabilize ? 'stabilized' : 'fixed',
                canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
            },
            filters: Object.keys(filters).length > 0 ? filters : undefined,
            duration: Date.now() - startTime
        },
        throttling: throttleDetector ? throttleDetector.getSummary() : null,
        results: results.map((r) => ({
            id: r.test.id,
            name: r.test.perfName,
            category: r.test.category,
            metadata: r.test.metadata || {},
            statistics: {
                n: r.statistics.n,
                mean: r.statistics.mean,
                median: r.statistics.median,
                stddev: r.statistics.stddev,
                stddevPercent: parseFloat(r.statistics.stddevPercent.toFixed(2)),
                sem: r.statistics.sem,
                semPercent: parseFloat(r.statistics.semPercent.toFixed(2)),
                ci95: {
                    low: r.statistics.ci95.low,
                    high: r.statistics.ci95.high
                },
                min: r.statistics.min,
                max: r.statistics.max,
                q1: r.statistics.q1,
                q3: r.statistics.q3,
                outliers: r.statistics.outliers,
                raw: r.statistics.raw // Preserve all measurements
            },
            shapesPerSec: Math.round(r.shapesPerSecond),
            usPerShape: parseFloat(r.microsecondsPerShape.toFixed(2)),
            warmup: r.warmup
                ? {
                      iterations: r.warmup.iterations,
                      stabilized: r.warmup.stabilized,
                      finalVariance: r.warmup.finalVariance
                  }
                : null
        }))
    };

    // Write output to file
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

    if (!quietMode) {
        console.log('\n' + '='.repeat(60));
        console.log('COMPLETE');
        console.log('='.repeat(60));
        console.log(`Tests run: ${results.length}`);
        console.log(`Output: ${outputFile}`);
        console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        if (throttleDetector) {
            const summary = throttleDetector.getSummary();
            console.log(
                `Throttling: ${summary.stable ? 'stable' : 'DETECTED'} ` +
                    `(max drift: ${summary.maxDriftPercent.toFixed(1)}%)`
            );
        }

        // High variance warnings
        const highVariance = results.filter(
            (r) => r.statistics.stddevPercent > 35
        );
        if (highVariance.length > 0) {
            console.log(
                `\n\x1b[33mWARNING: ${highVariance.length} test(s) with high variance (>35% StdDev)\x1b[0m`
            );
        }

        console.log('');
    }
}

function formatNumber(num, decimals = 0) {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

main();

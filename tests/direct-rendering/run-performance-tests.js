#!/usr/bin/env node
/**
 * Node.js Performance Test Runner for SWCanvas
 *
 * Measures SWCanvas direct rendering performance in isolation.
 * Unlike browser tests, this uses simple direct timing since SWCanvas
 * rendering is synchronous CPU-bound work.
 *
 * Usage: npm run test:direct-rendering:perf -- [options]
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Load SWCanvas
const SWCanvas = require('../../dist/swcanvas.js');

// Load test utilities
const {
    DIRECT_RENDERING_PERF_REGISTRY,
    SeededRandom,
    getRandomColor,
    getRandomOpaqueColor,
    getRandomOpaqueVisibleColor,
    getRandomPoint,
    placeCloseToCenterAtPixel,
    placeCloseToCenterAtGrid,
    adjustDimensionsForCrispStrokeRendering,
    roundPoint,
    ensureHalfPoint,
    adjustCenterForCrispStrokeRendering,
    calculateCrispFillAndStrokeRectParams,
    calculateCircleTestParameters,
    calculateArcTestParameters,
    calculate90DegQuadrantArcParams,
    generateConstrainedArcAngles,
    registerDirectRenderingTest
} = require('./direct-rendering-test-utils.js');

// Make utilities globally available for test files
global.SWCanvas = SWCanvas;
global.SeededRandom = SeededRandom;
global.getRandomColor = getRandomColor;
global.getRandomOpaqueColor = getRandomOpaqueColor;
global.getRandomOpaqueVisibleColor = getRandomOpaqueVisibleColor;
global.getRandomPoint = getRandomPoint;
global.placeCloseToCenterAtPixel = placeCloseToCenterAtPixel;
global.placeCloseToCenterAtGrid = placeCloseToCenterAtGrid;
global.adjustDimensionsForCrispStrokeRendering = adjustDimensionsForCrispStrokeRendering;
global.roundPoint = roundPoint;
global.ensureHalfPoint = ensureHalfPoint;
global.adjustCenterForCrispStrokeRendering = adjustCenterForCrispStrokeRendering;
global.calculateCrispFillAndStrokeRectParams = calculateCrispFillAndStrokeRectParams;
global.calculateCircleTestParameters = calculateCircleTestParameters;
global.calculateArcTestParameters = calculateArcTestParameters;
global.calculate90DegQuadrantArcParams = calculate90DegQuadrantArcParams;
global.generateConstrainedArcAngles = generateConstrainedArcAngles;
global.registerDirectRenderingTest = registerDirectRenderingTest;

// Configuration defaults
const DEFAULT_SHAPES = 1000;
const DEFAULT_WARMUP = 100;
const DEFAULT_RUNS = 5;
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 300;

// Parse command line arguments
const args = process.argv.slice(2);
let shapesPerRun = DEFAULT_SHAPES;
let warmupIterations = DEFAULT_WARMUP;
let numRuns = DEFAULT_RUNS;
let testFilter = null;
let quietMode = false;

// Help text
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
SWCanvas Performance Test Runner (Node.js)

Measures SWCanvas direct rendering performance using fixed iteration timing.

Usage: npm run test:direct-rendering:perf -- [options]

Options:
  -t, --test=<filter>     Filter tests by name or displayName substring
  -s, --shapes=<N>        Number of shapes per measurement run (default: ${DEFAULT_SHAPES})
  -w, --warmup=<N>        Warmup iterations (default: ${DEFAULT_WARMUP})
  -r, --runs=<N>          Number of measurement runs to average (default: ${DEFAULT_RUNS})
  -q, --quiet             Only show final summary (no per-test progress)
  -h, --help              Show this help message

Examples:
  npm run test:direct-rendering:perf                    # Run all performance tests
  npm run test:direct-rendering:perf -- -t line         # Filter to line tests
  npm run test:direct-rendering:perf -- -s 5000 -r 10   # 5000 shapes, 10 runs
  npm run test:direct-rendering:perf -- -q              # Quiet mode
`);
    process.exit(0);
}

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--shapes=')) {
        shapesPerRun = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-s' && args[i + 1]) {
        shapesPerRun = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--warmup=')) {
        warmupIterations = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-w' && args[i + 1]) {
        warmupIterations = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--runs=')) {
        numRuns = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-r' && args[i + 1]) {
        numRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--test=')) {
        testFilter = arg.split('=')[1];
    } else if (arg === '-t' && args[i + 1]) {
        testFilter = args[i + 1];
        i++;
    } else if (arg === '--quiet' || arg === '-q') {
        quietMode = true;
    }
}

// Validate parameters
if (isNaN(shapesPerRun) || shapesPerRun < 1) shapesPerRun = DEFAULT_SHAPES;
if (isNaN(warmupIterations) || warmupIterations < 0) warmupIterations = DEFAULT_WARMUP;
if (isNaN(numRuns) || numRuns < 1) numRuns = DEFAULT_RUNS;

/**
 * Load all test case files to populate the registry
 */
function loadTestCases() {
    const casesDir = path.join(__dirname, 'cases');

    if (!fs.existsSync(casesDir)) {
        console.log('No test cases directory found.');
        return;
    }

    const files = fs.readdirSync(casesDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
        try {
            require(path.join(casesDir, file));
        } catch (e) {
            console.error(`Error loading test case ${file}: ${e.message}`);
        }
    }
}

/**
 * Run warmup iterations to trigger JIT optimization
 */
function runWarmup(test, ctx, iterations) {
    for (let i = 0; i < iterations; i++) {
        // Seed for each iteration to ensure deterministic state
        SeededRandom.seedWithInteger(12345 + i);
        test.drawFunction(ctx, 0, 1);
    }
}

/**
 * Measure a single run of drawing shapeCount shapes
 * @returns {number} elapsed time in milliseconds
 */
function measureRun(test, ctx, shapeCount, runIndex) {
    // Seed for reproducibility (though performance mode uses Math.random())
    SeededRandom.seedWithInteger(12345 + runIndex);
    const startTime = performance.now();
    test.drawFunction(ctx, 0, shapeCount);
    const endTime = performance.now();
    return endTime - startTime;
}

/**
 * Calculate statistics from an array of measurements
 */
function calculateStats(measurements) {
    const n = measurements.length;
    const mean = measurements.reduce((a, b) => a + b, 0) / n;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    // Standard deviation
    const variance = measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stddev = Math.sqrt(variance);
    const stddevPercent = (stddev / mean) * 100;

    return { mean, min, max, stddev, stddevPercent };
}

/**
 * Format number with thousands separator
 */
function formatNumber(num, decimals = 0) {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Run performance test for a single test
 */
function runPerformanceTest(test) {
    // Create fresh canvas for this test
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.canvas = canvas;

    // Warmup phase
    runWarmup(test, ctx, warmupIterations);

    // Measurement phase
    const measurements = [];
    for (let run = 0; run < numRuns; run++) {
        // Clear canvas between runs
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const elapsed = measureRun(test, ctx, shapesPerRun, run);
        measurements.push(elapsed);
    }

    // Calculate statistics
    const stats = calculateStats(measurements);

    // Calculate derived metrics
    const shapesPerSecond = (shapesPerRun / stats.mean) * 1000;
    const microsecondsPerShape = (stats.mean / shapesPerRun) * 1000;

    const shapesPerSecondMin = (shapesPerRun / stats.max) * 1000;
    const shapesPerSecondMax = (shapesPerRun / stats.min) * 1000;

    const microsecondsPerShapeMin = (stats.min / shapesPerRun) * 1000;
    const microsecondsPerShapeMax = (stats.max / shapesPerRun) * 1000;

    return {
        test,
        measurements,
        stats,
        shapesPerSecond,
        shapesPerSecondMin,
        shapesPerSecondMax,
        microsecondsPerShape,
        microsecondsPerShapeMin,
        microsecondsPerShapeMax
    };
}

/**
 * Print results for a single test
 */
function printTestResult(result) {
    console.log(`\nTest: ${result.test.displayName}`);
    console.log(`  Category: ${result.test.category}`);
    console.log(`  Warmup: ${warmupIterations} iterations`);
    console.log(`  Measurement: ${formatNumber(shapesPerRun)} shapes x ${numRuns} runs`);
    console.log('');
    console.log('  Results:');
    console.log(`    Mean:    ${formatNumber(result.shapesPerSecond)} shapes/sec (${result.microsecondsPerShape.toFixed(1)} us/shape)`);
    console.log(`    Best:    ${formatNumber(result.shapesPerSecondMax)} shapes/sec (${result.microsecondsPerShapeMin.toFixed(1)} us/shape)`);
    console.log(`    Worst:   ${formatNumber(result.shapesPerSecondMin)} shapes/sec (${result.microsecondsPerShapeMax.toFixed(1)} us/shape)`);
    console.log(`    StdDev:  ${result.stats.stddevPercent.toFixed(1)}%`);
}

/**
 * Print summary table
 */
function printSummary(results) {
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    // Calculate column widths
    const maxNameLen = Math.max(
        'Test Name'.length,
        ...results.map(r => r.test.displayName.length)
    );

    // Header
    const nameHeader = 'Test Name'.padEnd(maxNameLen);
    console.log(`| ${nameHeader} | Shapes/sec |  us/shape | StdDev |`);
    console.log(`|${'-'.repeat(maxNameLen + 2)}|------------|-----------|--------|`);

    // Sort by shapes/sec (fastest first)
    const sorted = [...results].sort((a, b) => b.shapesPerSecond - a.shapesPerSecond);

    for (const r of sorted) {
        const name = r.test.displayName.padEnd(maxNameLen);
        const shapesPerSec = formatNumber(r.shapesPerSecond).padStart(10);
        const usPerShape = r.microsecondsPerShape.toFixed(1).padStart(9);
        const stddev = (r.stats.stddevPercent.toFixed(1) + '%').padStart(6);
        console.log(`| ${name} | ${shapesPerSec} | ${usPerShape} | ${stddev} |`);
    }

    console.log('='.repeat(80));
}

/**
 * Main entry point
 */
function main() {
    console.log('\n=== SWCanvas Performance Tests (Node.js) ===\n');
    console.log(`Configuration:`);
    console.log(`  Shapes per run: ${formatNumber(shapesPerRun)}`);
    console.log(`  Warmup iterations: ${formatNumber(warmupIterations)}`);
    console.log(`  Measurement runs: ${numRuns}`);
    console.log(`  Canvas size: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);

    // Load test case files
    loadTestCases();

    if (DIRECT_RENDERING_PERF_REGISTRY.length === 0) {
        console.log('\nNo performance tests registered.');
        console.log('Performance tests require displayName in metadata.');
        console.log('See tests/direct-rendering/README.md for details.');
        return;
    }

    // Filter tests if specified
    let testsToRun = DIRECT_RENDERING_PERF_REGISTRY;
    if (testFilter) {
        const filterLower = testFilter.toLowerCase();
        testsToRun = DIRECT_RENDERING_PERF_REGISTRY.filter(test =>
            test.id.toLowerCase().includes(filterLower) ||
            test.displayName.toLowerCase().includes(filterLower)
        );
        if (testsToRun.length === 0) {
            console.log(`\nNo tests match filter: "${testFilter}"`);
            console.log('Available performance tests:');
            DIRECT_RENDERING_PERF_REGISTRY.forEach(t =>
                console.log(`  - ${t.displayName} (${t.id})`)
            );
            process.exit(1);
        }
        console.log(`\nFilter "${testFilter}" matched ${testsToRun.length} test(s)`);
    }

    console.log(`\nRunning ${testsToRun.length} performance test(s)...\n`);

    // Run tests and collect results
    const results = [];

    for (const test of testsToRun) {
        if (!quietMode) {
            process.stdout.write(`Running: ${test.displayName}... `);
        }

        const result = runPerformanceTest(test);
        results.push(result);

        if (!quietMode) {
            console.log(`${formatNumber(result.shapesPerSecond)} shapes/sec`);
        }
    }

    // Print detailed results (unless quiet mode)
    if (!quietMode) {
        for (const result of results) {
            printTestResult(result);
        }
    }

    // Always print summary
    printSummary(results);

    console.log('\n\x1b[32mPerformance tests completed.\x1b[0m\n');
}

main();

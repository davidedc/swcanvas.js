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

// Performance tests require the minified build for accurate production-like benchmarks
const minifiedPath = path.join(__dirname, '../../dist/swcanvas.min.js');
if (!fs.existsSync(minifiedPath)) {
    console.error('\x1b[31mError: Minified build not found at dist/swcanvas.min.js\x1b[0m');
    console.error('Performance tests require the minified build for accurate results.');
    console.error('Run: npm run build:prod');
    process.exit(1);
}

// Load SWCanvas (minified build for accurate performance benchmarks)
const SWCanvas = require('../../dist/swcanvas.min.js');

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
    calculate90DegFillStrokeArcParams,
    generateConstrainedArcAngles,
    registerDirectRenderingTest,
    PERF_SIZE_CATEGORIES,
    getStrokeWidthFromCategory,
    getShapeSizeFromCategory,
    getRadiusFromShapeCategory,
    getArcAngleFromCategory
} = require('./direct-rendering-test-utils.js');

// Load performance test generator
const {
    registerParametricPerfTests,
    getRandomPosition,
    getRandomLineEndpoints,
    getHorizontalLineEndpoints,
    getVerticalLineEndpoints,
    getDiagonalLineEndpoints
} = require('./performance-test-generator.js');

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
global.calculate90DegFillStrokeArcParams = calculate90DegFillStrokeArcParams;
global.generateConstrainedArcAngles = generateConstrainedArcAngles;
global.registerDirectRenderingTest = registerDirectRenderingTest;
// Parametric performance test utilities
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

// Configuration defaults
const DEFAULT_SHAPES = 1000;
const DEFAULT_WARMUP = 100;
const DEFAULT_RUNS = 5;
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;

// Parse command line arguments
const args = process.argv.slice(2);
let shapesPerRun = DEFAULT_SHAPES;
let warmupIterations = DEFAULT_WARMUP;
let numRuns = DEFAULT_RUNS;
let testFilter = null;
let quietMode = false;
let strokeFilter = null;
let sizeFilter = null;
let operationFilter = null;
let orientationFilter = null;
let shapeFilter = null;
let angleFilter = null;
let listOnly = false;
let outputFormat = 'text'; // 'text', 'json', 'csv'
let compareBaseline = null;
let adaptiveRuns = false;

// Help text
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
SWCanvas Performance Test Runner (Node.js)

Measures SWCanvas direct rendering performance using fixed iteration timing.

Usage: npm run test:direct-rendering:perf -- [options]

Options:
  -t, --test=<filter>       Filter tests by name or perfName substring
  --stroke=<category>       Filter by stroke width category (sw0, sw1px, swXXS-swXXL)
  --size=<category>         Filter by shape size category (szXXS-szXXL)
  --shape=<type>            Filter by shape type (line, rect, circle, roundrect, arc)
  --orient=<orientation>    Filter by orientation (aa=axis-aligned, rot=rotated)
  --angle=<category>        Filter by arc angle category (angS, angM, angL, angXL)
  --op=<operation>          Filter by operation (see Operation Categories below)
  -s, --shapes=<N>          Number of shapes per measurement run (default: ${DEFAULT_SHAPES})
  -w, --warmup=<N>          Warmup iterations (default: ${DEFAULT_WARMUP})
  -r, --runs=<N>            Number of measurement runs to average (default: ${DEFAULT_RUNS})
  -q, --quiet               Only show final summary (no per-test progress)
  --list                    List matched tests without running them
  --json                    Output results in JSON format
  --csv                     Output results in CSV format
  --compare=<file>          Compare results against a JSON baseline file
  --adaptive-runs           Automatically increase runs for high-variance tests
  -h, --help                Show this help message

Stroke Categories:
  sw0     - 0px (No Stroke)
  sw1px   - 1px (Bresenham algorithm)
  swXXS   - XXS Thick (2-3px)
  swXS    - XS Thick (3-5px)
  swS     - S Thick (5-10px)
  swM     - M Thick (10-20px)
  swL     - L Thick (20-40px)
  swXL    - XL Thick (40-80px)
  swXXL   - XXL Thick (80-150px)

Size Categories:
  szXXS   - XXS (2-8px)
  szXS    - XS (5-15px)
  szS     - S (16-39px)
  szM     - M (40-79px)
  szL     - L (80-159px)
  szXL    - XL (160-300px)
  szXXL   - XXL (300-500px)

Shape Types:
  line      - Lines (horiz, vert, diag)
  rect      - Rectangles (AA and rotated)
  circle    - Circles
  roundrect - Rounded rectangles (AA and rotated)
  arc       - Arcs

Orientation Categories:
  aa      - Axis-Aligned (horiz lines, vert lines, AA rects/roundrects)
  rot     - Rotated/Diagonal (diag lines, rotated rects/roundrects)
  horiz   - Horizontal lines only
  vert    - Vertical lines only

Arc Angle Categories:
  angS    - Small (30-90°)
  angM    - Medium (90-180°)
  angL    - Large (180-270°)
  angXL   - Nearly Full (270-350°)

Operation Categories:
  stroke-opaque             - Stroke only, opaque
  stroke-semi               - Stroke only, semi-transparent
  fill-opaque               - Fill only, opaque (sw0 only)
  fill-semi                 - Fill only, semi-transparent (sw0 only)
  fill-opaque-stroke-opaque - Fill and stroke, both opaque
  fill-semi-stroke-opaque   - Fill semi, stroke opaque
  fill-opaque-stroke-semi   - Fill opaque, stroke semi
  fill-semi-stroke-semi     - Fill and stroke, both semi-transparent
  stroke                    - (legacy) matches any stroke operation
  fill                      - (legacy) matches any fill operation

Examples:
  npm run test:direct-rendering:perf                              # Run all performance tests
  npm run test:direct-rendering:perf -- -t line-horiz             # Filter to horizontal line tests
  npm run test:direct-rendering:perf -- --stroke sw1px            # Filter to 1px stroke tests
  npm run test:direct-rendering:perf -- --shape circle            # Circle tests only
  npm run test:direct-rendering:perf -- --shape arc --angle angS  # Arc tests with small angles
  npm run test:direct-rendering:perf -- --op stroke-opaque        # Opaque stroke tests
  npm run test:direct-rendering:perf -- --op fill                 # (legacy) Any fill operation
  npm run test:direct-rendering:perf -- --orient aa               # Axis-aligned tests
  npm run test:direct-rendering:perf -- -s 5000 -r 10             # 5000 shapes, 10 runs
  npm run test:direct-rendering:perf -- -q                        # Quiet mode
  npm run test:direct-rendering:perf -- --json                    # JSON output for scripting
  npm run test:direct-rendering:perf -- --csv                     # CSV output for spreadsheets
  npm run test:direct-rendering:perf -- --compare=baseline.json   # Compare against baseline
  npm run test:direct-rendering:perf -- --adaptive-runs           # Auto-adjust runs for stability
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
    } else if (arg.startsWith('--stroke=')) {
        strokeFilter = arg.split('=')[1];
    } else if (arg.startsWith('--size=')) {
        sizeFilter = arg.split('=')[1];
    } else if (arg.startsWith('--op=')) {
        operationFilter = arg.split('=')[1];
    } else if (arg.startsWith('--orient=')) {
        orientationFilter = arg.split('=')[1];
    } else if (arg.startsWith('--shape=')) {
        shapeFilter = arg.split('=')[1];
    } else if (arg.startsWith('--angle=')) {
        angleFilter = arg.split('=')[1];
    } else if (arg === '--quiet' || arg === '-q') {
        quietMode = true;
    } else if (arg === '--list') {
        listOnly = true;
    } else if (arg === '--json') {
        outputFormat = 'json';
    } else if (arg === '--csv') {
        outputFormat = 'csv';
    } else if (arg.startsWith('--compare=')) {
        compareBaseline = arg.split('=')[1];
    } else if (arg === '--compare' && args[i + 1]) {
        compareBaseline = args[i + 1];
        i++;
    } else if (arg === '--adaptive-runs') {
        adaptiveRuns = true;
    }
}

// Validate parameters
if (isNaN(shapesPerRun) || shapesPerRun < 1) shapesPerRun = DEFAULT_SHAPES;
if (isNaN(warmupIterations) || warmupIterations < 0) warmupIterations = DEFAULT_WARMUP;
if (isNaN(numRuns) || numRuns < 1) numRuns = DEFAULT_RUNS;

/**
 * Load all test case files to populate the registry.
 * Loads from both cases/ (dual-mode tests) and perf-cases/ (parametric perf tests).
 */
function loadTestCases() {
    const directories = [
        path.join(__dirname, 'cases'),      // Dual-mode tests with perfName
        path.join(__dirname, 'perf-cases')  // Parametric performance tests
    ];

    for (const dir of directories) {
        if (!fs.existsSync(dir)) {
            continue;
        }

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

        for (const file of files) {
            try {
                require(path.join(dir, file));
            } catch (e) {
                console.error(`Error loading test case ${file}: ${e.message}`);
            }
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
 * @param {Object} test - The test to run
 * @param {boolean} adaptive - Whether to use adaptive runs
 */
function runPerformanceTest(test, adaptive = false) {
    // Create fresh canvas for this test
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.canvas = canvas;

    // Warmup phase
    runWarmup(test, ctx, warmupIterations);

    // Determine number of runs
    let runsToUse = numRuns;

    if (adaptive) {
        // Start with 5 runs for adaptive mode
        runsToUse = 5;
    }

    // Measurement phase
    const measurements = [];
    for (let run = 0; run < runsToUse; run++) {
        // Clear canvas between runs
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const elapsed = measureRun(test, ctx, shapesPerRun, run);
        measurements.push(elapsed);
    }

    // Calculate initial statistics
    let stats = calculateStats(measurements);

    // Adaptive: increase runs if StdDev is high
    if (adaptive && stats.stddevPercent > 25 && runsToUse < 20) {
        // Extend to 20 runs
        for (let run = runsToUse; run < 20; run++) {
            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            const elapsed = measureRun(test, ctx, shapesPerRun, run);
            measurements.push(elapsed);
        }
        runsToUse = 20;
        stats = calculateStats(measurements);
    }

    if (adaptive && stats.stddevPercent > 35 && runsToUse < 40) {
        // Extend to 40 runs
        for (let run = runsToUse; run < 40; run++) {
            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            const elapsed = measureRun(test, ctx, shapesPerRun, run);
            measurements.push(elapsed);
        }
        runsToUse = 40;
        stats = calculateStats(measurements);
    }

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
        microsecondsPerShapeMax,
        actualRuns: runsToUse
    };
}

/**
 * Print results for a single test
 */
function printTestResult(result) {
    console.log(`\nTest: ${result.test.perfName}`);
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
 * Output results as JSON
 */
function outputJSON(results) {
    const gitCommit = (() => {
        try {
            const { execSync } = require('child_process');
            return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
        } catch (e) {
            return 'unknown';
        }
    })();

    const output = {
        metadata: {
            timestamp: new Date().toISOString(),
            gitCommit: gitCommit,
            config: {
                shapesPerRun: shapesPerRun,
                warmupIterations: warmupIterations,
                numRuns: numRuns,
                canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
            }
        },
        results: results.map(r => ({
            id: r.test.id,
            name: r.test.perfName,
            category: r.test.category,
            metadata: r.test.metadata || {},
            shapesPerSec: Math.round(r.shapesPerSecond),
            usPerShape: parseFloat(r.microsecondsPerShape.toFixed(2)),
            stddev: parseFloat(r.stats.stddevPercent.toFixed(1)),
            min: Math.round(r.shapesPerSecondMin),
            max: Math.round(r.shapesPerSecondMax)
        }))
    };

    console.log(JSON.stringify(output, null, 2));
}

/**
 * Output results as CSV
 */
function outputCSV(results) {
    // Header
    console.log('Test ID,Test Name,Category,Shapes/sec,us/shape,StdDev%,Min,Max');

    for (const r of results) {
        const row = [
            `"${r.test.id}"`,
            `"${r.test.perfName}"`,
            `"${r.test.category || ''}"`,
            Math.round(r.shapesPerSecond),
            r.microsecondsPerShape.toFixed(2),
            r.stats.stddevPercent.toFixed(1),
            Math.round(r.shapesPerSecondMin),
            Math.round(r.shapesPerSecondMax)
        ];
        console.log(row.join(','));
    }
}

/**
 * Load and compare against a baseline JSON file
 */
function loadBaseline(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        console.error(`Error loading baseline file: ${e.message}`);
        return null;
    }
}

/**
 * Compare current results against baseline and print comparison table
 */
function printComparison(results, baseline) {
    console.log('\n' + '='.repeat(100));
    console.log('COMPARISON WITH BASELINE');
    console.log('='.repeat(100));
    console.log(`Baseline: ${baseline.metadata.gitCommit} @ ${baseline.metadata.timestamp}`);
    console.log('');

    // Create lookup map from baseline
    const baselineMap = new Map();
    for (const b of baseline.results) {
        baselineMap.set(b.id, b);
    }

    const comparisons = [];
    let fasterCount = 0;
    let sameCount = 0;
    let slowerCount = 0;
    let regressionCount = 0;

    for (const r of results) {
        const b = baselineMap.get(r.test.id);
        if (!b) {
            continue; // Test not in baseline
        }

        const change = ((r.shapesPerSecond - b.shapesPerSec) / b.shapesPerSec) * 100;

        // Determine threshold based on operation type
        const isSemi = r.test.metadata?.operation?.includes('semi') || false;
        const threshold = isSemi ? 25 : 15;

        let classification;
        if (change > threshold) {
            classification = 'FASTER';
            fasterCount++;
        } else if (change < -2 * threshold) {
            classification = 'REGRESSION';
            regressionCount++;
        } else if (change < -threshold) {
            classification = 'SLOWER';
            slowerCount++;
        } else {
            classification = 'SAME';
            sameCount++;
        }

        comparisons.push({
            name: r.test.perfName,
            before: b.shapesPerSec,
            after: Math.round(r.shapesPerSecond),
            change: change,
            classification: classification
        });
    }

    // Print comparison table
    const maxNameLen = Math.max('Test Name'.length, ...comparisons.map(c => c.name.length));
    console.log(`| ${'Test Name'.padEnd(maxNameLen)} |     Before |      After |  Change | Status     |`);
    console.log(`|${'-'.repeat(maxNameLen + 2)}|------------|------------|---------|------------|`);

    // Sort by change (most regressed first)
    comparisons.sort((a, b) => a.change - b.change);

    for (const c of comparisons) {
        const name = c.name.padEnd(maxNameLen);
        const before = formatNumber(c.before).padStart(10);
        const after = formatNumber(c.after).padStart(10);
        const change = (c.change >= 0 ? '+' : '') + c.change.toFixed(1) + '%';
        const changeStr = change.padStart(7);

        // Color coding for terminal
        let statusStr;
        if (c.classification === 'FASTER') {
            statusStr = '\x1b[32mFASTER\x1b[0m     ';
        } else if (c.classification === 'REGRESSION') {
            statusStr = '\x1b[31mREGRESSION\x1b[0m ';
        } else if (c.classification === 'SLOWER') {
            statusStr = '\x1b[33mSLOWER\x1b[0m     ';
        } else {
            statusStr = 'SAME       ';
        }

        console.log(`| ${name} | ${before} | ${after} | ${changeStr} | ${statusStr}|`);
    }

    console.log('');
    console.log('Summary:');
    console.log(`  FASTER:     ${fasterCount}`);
    console.log(`  SAME:       ${sameCount}`);
    console.log(`  SLOWER:     ${slowerCount}`);
    console.log(`  REGRESSION: ${regressionCount}`);

    if (regressionCount > 0) {
        console.log('\n\x1b[31mWARNING: Regressions detected!\x1b[0m');
        return 1; // Exit code for CI
    }
    return 0;
}

/**
 * Print high-StdDev warnings
 */
function printHighStdDevWarnings(results) {
    const highVariance = results.filter(r => r.stats.stddevPercent > 35);

    if (highVariance.length > 0) {
        console.log('\n\x1b[33mWARNING: High variance detected in some tests:\x1b[0m');
        for (const r of highVariance) {
            console.log(`  - ${r.test.perfName}: ${r.stats.stddevPercent.toFixed(1)}% StdDev`);
        }
        console.log('\nConsider using --adaptive-runs or increasing -r for more reliable results.\n');
    }
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
        ...results.map(r => r.test.perfName.length)
    );

    // Header
    const nameHeader = 'Test Name'.padEnd(maxNameLen);
    console.log(`| ${nameHeader} | Shapes/sec |  us/shape | StdDev |`);
    console.log(`|${'-'.repeat(maxNameLen + 2)}|------------|-----------|--------|`);

    // Sort by shapes/sec (fastest first)
    const sorted = [...results].sort((a, b) => b.shapesPerSecond - a.shapesPerSecond);

    for (const r of sorted) {
        const name = r.test.perfName.padEnd(maxNameLen);
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
    // Suppress header for machine-readable formats
    const isHumanReadable = outputFormat === 'text';

    if (isHumanReadable) {
        console.log('\n=== SWCanvas Performance Tests (Node.js) ===\n');
        console.log(`Configuration:`);
        console.log(`  Shapes per run: ${formatNumber(shapesPerRun)}`);
        console.log(`  Warmup iterations: ${formatNumber(warmupIterations)}`);
        console.log(`  Measurement runs: ${adaptiveRuns ? 'adaptive (5-40)' : numRuns}`);
        console.log(`  Canvas size: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
        if (compareBaseline) {
            console.log(`  Comparing against: ${compareBaseline}`);
        }
    }

    // Load test case files
    loadTestCases();

    if (DIRECT_RENDERING_PERF_REGISTRY.length === 0) {
        console.log('\nNo performance tests registered.');
        console.log('Performance tests require perfName in metadata.');
        console.log('See tests/direct-rendering/README.md for details.');
        return;
    }

    // Filter tests if specified
    let testsToRun = DIRECT_RENDERING_PERF_REGISTRY;

    // Apply text filter
    if (testFilter) {
        const filterLower = testFilter.toLowerCase();
        testsToRun = testsToRun.filter(test =>
            test.id.toLowerCase().includes(filterLower) ||
            test.perfName.toLowerCase().includes(filterLower)
        );
    }

    // Apply stroke category filter
    if (strokeFilter) {
        testsToRun = testsToRun.filter(test =>
            test.metadata && test.metadata.strokeCategory === strokeFilter
        );
    }

    // Apply size category filter
    if (sizeFilter) {
        testsToRun = testsToRun.filter(test =>
            test.metadata && test.metadata.sizeCategory === sizeFilter
        );
    }

    // Apply operation filter (supports new 8-value system + legacy compatibility)
    if (operationFilter) {
        testsToRun = testsToRun.filter(test => {
            if (!test.metadata || !test.metadata.operation) return false;
            const op = test.metadata.operation;

            // Legacy compatibility
            if (operationFilter === 'stroke') {
                // Legacy 'stroke' matches any operation containing "stroke"
                return op.includes('stroke');
            }
            if (operationFilter === 'fill') {
                // Legacy 'fill' matches any operation starting with "fill"
                return op.startsWith('fill');
            }

            // Exact match for new operation names
            return op === operationFilter;
        });
    }

    // Apply orientation filter (semantic matching for lines and rects)
    if (orientationFilter) {
        testsToRun = testsToRun.filter(test => {
            // Semantic orientation matching:
            // - 'aa' matches: horiz lines, vert lines, -aa- rects/roundrects
            // - 'rot' matches: diag lines, -rot- rects/roundrects
            // - 'horiz' matches: only horiz lines
            // - 'vert' matches: only vert lines
            switch (orientationFilter) {
                case 'aa':
                    return test.id.includes('-horiz-') ||
                           test.id.includes('-vert-') ||
                           test.id.includes('-aa-');
                case 'rot':
                    return test.id.includes('-diag-') ||
                           test.id.includes('-rot-');
                case 'horiz':
                    return test.id.includes('-horiz-');
                case 'vert':
                    return test.id.includes('-vert-');
                default:
                    return true;
            }
        });
    }

    // Apply shape filter (matches test ID prefix)
    if (shapeFilter) {
        testsToRun = testsToRun.filter(test =>
            test.id.startsWith(shapeFilter + '-')
        );
    }

    // Apply angle filter (arcs only, matches metadata)
    if (angleFilter) {
        testsToRun = testsToRun.filter(test =>
            test.metadata && test.metadata.angleCategory === angleFilter
        );
    }

    // Show filter results
    const activeFilters = [];
    if (testFilter) activeFilters.push(`name="${testFilter}"`);
    if (strokeFilter) activeFilters.push(`stroke=${strokeFilter}`);
    if (sizeFilter) activeFilters.push(`size=${sizeFilter}`);
    if (shapeFilter) activeFilters.push(`shape=${shapeFilter}`);
    if (orientationFilter) activeFilters.push(`orient=${orientationFilter}`);
    if (angleFilter) activeFilters.push(`angle=${angleFilter}`);
    if (operationFilter) activeFilters.push(`op=${operationFilter}`);

    if (activeFilters.length > 0 && isHumanReadable) {
        console.log(`\nFilters: ${activeFilters.join(', ')}`);
    }

    if (testsToRun.length === 0) {
        if (isHumanReadable) {
            console.log(`\nNo tests match the specified filters.`);
            console.log('Available performance tests:');
            DIRECT_RENDERING_PERF_REGISTRY.slice(0, 20).forEach(t =>
                console.log(`  - ${t.perfName} (${t.id})`)
            );
            if (DIRECT_RENDERING_PERF_REGISTRY.length > 20) {
                console.log(`  ... and ${DIRECT_RENDERING_PERF_REGISTRY.length - 20} more`);
            }
        } else {
            // For JSON/CSV, output empty results
            if (outputFormat === 'json') {
                console.log(JSON.stringify({ metadata: {}, results: [], error: 'No tests matched filters' }, null, 2));
            } else if (outputFormat === 'csv') {
                console.log('Test ID,Test Name,Category,Shapes/sec,us/shape,StdDev%,Min,Max');
            }
        }
        process.exit(1);
    }

    if (activeFilters.length > 0 && isHumanReadable) {
        console.log(`Matched ${testsToRun.length} test(s)`);
    }

    // List mode - just show tests without running
    if (listOnly) {
        console.log(`\nMatched ${testsToRun.length} test(s):\n`);
        testsToRun.forEach((test, i) => {
            console.log(`  ${i + 1}. ${test.perfName || test.id}`);
        });
        console.log(`\nTotal: ${testsToRun.length} tests`);
        process.exit(0);
    }

    if (isHumanReadable) {
        console.log(`\nRunning ${testsToRun.length} performance test(s)...\n`);
    }

    // Run tests and collect results
    const results = [];

    for (const test of testsToRun) {
        if (!quietMode && isHumanReadable) {
            process.stdout.write(`Running: ${test.perfName}... `);
        }

        const result = runPerformanceTest(test, adaptiveRuns);
        results.push(result);

        if (!quietMode && isHumanReadable) {
            let runsInfo = '';
            if (adaptiveRuns && result.actualRuns !== numRuns) {
                runsInfo = ` (${result.actualRuns} runs)`;
            }
            console.log(`${formatNumber(result.shapesPerSecond)} shapes/sec${runsInfo}`);
        }
    }

    // Handle different output formats
    if (outputFormat === 'json') {
        outputJSON(results);
        return;
    }

    if (outputFormat === 'csv') {
        outputCSV(results);
        return;
    }

    // Text output mode
    // Print detailed results (unless quiet mode)
    if (!quietMode) {
        for (const result of results) {
            printTestResult(result);
        }
    }

    // Always print summary
    printSummary(results);

    // Print high StdDev warnings
    printHighStdDevWarnings(results);

    // Handle comparison mode
    let exitCode = 0;
    if (compareBaseline) {
        const baseline = loadBaseline(compareBaseline);
        if (baseline) {
            exitCode = printComparison(results, baseline);
        }
    }

    console.log('\n\x1b[32mPerformance tests completed.\x1b[0m\n');

    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}

main();

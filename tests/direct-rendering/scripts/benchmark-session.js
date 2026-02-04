#!/usr/bin/env node
/**
 * Benchmark Session Orchestrator
 *
 * Manages a complete benchmarking session using the statistical filtering approach:
 * - Time-based warmup (thermal steady state)
 * - Super-measurement architecture with sub-run stability detection
 * - Takes minimum time from stable measurement windows
 * - IQR-based outlier removal
 * - Enhanced statistics (sample stddev, CI, Welch's t-test)
 *
 * This approach achieves ~0.7-0.9% CV consistently, compared to 10-20% with
 * conventional approaches.
 *
 * Usage:
 *   node benchmark-session.js --output <output.json> [options]
 *
 * Options:
 *   --output <file>             Output JSON file (required)
 *   --filters <json>            Test filter configuration as JSON string
 *   --warmup-ms <N>             Warmup duration in ms (default: 3000)
 *   --super-measurements <N>    Number of data points per test (default: 30)
 *   --sub-runs <N>              Sub-runs per super-measurement (default: 5)
 *   --shapes <N>                Shapes per sub-run (default: 5000)
 *   --cv-threshold <N>          Max CV% to accept measurement (default: 5)
 *   --max-retries <N>           Retries for unstable measurements (default: 3)
 *   --cooldown <ms>             Delay between super-measurements (default: 100)
 *   --quiet                     Suppress progress output
 *   -h, --help                  Show help message
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { execSync } = require('child_process');

// Import statistics module
const Statistics = require('../lib/statistics');

// Configuration defaults
const DEFAULT_SHAPES = 5000;
const DEFAULT_WARMUP_MS = 3000;
const DEFAULT_SUPER_MEASUREMENTS = 30;
const DEFAULT_SUB_RUNS = 5;
const DEFAULT_CV_THRESHOLD = 5;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_COOLDOWN = 100;
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;

// Parse command line arguments
const args = process.argv.slice(2);
let outputFile = null;
let filtersJson = null;
let shapesPerRun = DEFAULT_SHAPES;
let warmupMs = DEFAULT_WARMUP_MS;
let superMeasurements = DEFAULT_SUPER_MEASUREMENTS;
let subRuns = DEFAULT_SUB_RUNS;
let cvThreshold = DEFAULT_CV_THRESHOLD;
let maxRetries = DEFAULT_MAX_RETRIES;
let cooldownMs = DEFAULT_COOLDOWN;
let quietMode = false;

// Position reproducibility options
let fixedPositionSeed = false;

// Outlier filtering options
let skipOutliers = false;
let madThreshold = 3.5;

// Help text
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Benchmark Session Orchestrator

Manages a complete benchmarking session using statistical filtering
to achieve reliable, low-variance measurements (~0.7-0.9% CV).

Usage: node benchmark-session.js --output <output.json> [options]

Options:
  --output <file>             Output JSON file (required)
  --filters <json>            Test filter configuration as JSON string
                              Include filters: test, stroke, size, shape, op, orient, angle
                              Exclude filters: excludeSize, excludeStroke, excludeAngle
                              Example: '{"shape":"arc","excludeSize":["szL","szXL","szXXL"]}'
  --warmup-ms <N>             Warmup duration in ms (default: ${DEFAULT_WARMUP_MS})
  --super-measurements <N>    Number of data points per test (default: ${DEFAULT_SUPER_MEASUREMENTS})
  --sub-runs <N>              Sub-runs per super-measurement (default: ${DEFAULT_SUB_RUNS})
  --shapes <N>                Shapes per sub-run (default: ${DEFAULT_SHAPES})
  --cv-threshold <N>          Max CV% to accept measurement (default: ${DEFAULT_CV_THRESHOLD})
  --max-retries <N>           Retries for unstable measurements (default: ${DEFAULT_MAX_RETRIES})
  --cooldown <ms>             Delay between super-measurements (default: ${DEFAULT_COOLDOWN})
  --quiet                     Suppress progress output
  -h, --help                  Show this help message

Position Reproducibility:
  --fixed-positions           Use identical positions for all measurement runs

Outlier Filtering:
  --skip-outliers             Enable MAD-based outlier filtering
  --mad-threshold <N>         Modified z-score threshold (default: 3.5)

Algorithm:
  1. Time-based warmup (default 3s) to reach thermal steady state
  2. For each super-measurement:
     a. Run ${DEFAULT_SUB_RUNS} sub-measurements
     b. Calculate CV of sub-measurements
     c. If CV > ${DEFAULT_CV_THRESHOLD}%: retry (system was unstable)
     d. If CV <= ${DEFAULT_CV_THRESHOLD}%: take minimum time as result
  3. Apply IQR-based outlier removal to final results
  4. Report statistics including trimmed mean and CV

This approach achieves ~0.7-0.9% CV consistently, enabling detection of
performance differences as small as 2-3%.

Examples:
  # Basic run
  node benchmark-session.js --output baseline.json

  # With filters
  node benchmark-session.js \\
    --output baseline.json \\
    --filters '{"shape":"arc","stroke":"sw1px"}'

  # Quick test (fewer measurements)
  node benchmark-session.js \\
    --output baseline.json \\
    --warmup-ms 2000 \\
    --super-measurements 20
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
    } else if ((arg === '--warmup-ms' || arg === '--warmup') && args[i + 1]) {
        warmupMs = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--warmup-ms=') || arg.startsWith('--warmup=')) {
        warmupMs = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--super-measurements' && args[i + 1]) {
        superMeasurements = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--super-measurements=')) {
        superMeasurements = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--sub-runs' && args[i + 1]) {
        subRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--sub-runs=')) {
        subRuns = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--shapes' && args[i + 1]) {
        shapesPerRun = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--shapes=')) {
        shapesPerRun = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--cv-threshold' && args[i + 1]) {
        cvThreshold = parseFloat(args[i + 1]);
        i++;
    } else if (arg.startsWith('--cv-threshold=')) {
        cvThreshold = parseFloat(arg.split('=')[1]);
    } else if (arg === '--max-retries' && args[i + 1]) {
        maxRetries = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--max-retries=')) {
        maxRetries = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--cooldown' && args[i + 1]) {
        cooldownMs = parseInt(args[i + 1], 10);
        i++;
    } else if (arg.startsWith('--cooldown=')) {
        cooldownMs = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--quiet' || arg === '-q') {
        quietMode = true;
    } else if (arg === '--fixed-positions') {
        fixedPositionSeed = true;
    } else if (arg === '--skip-outliers') {
        skipOutliers = true;
    } else if (arg === '--mad-threshold' && args[i + 1]) {
        madThreshold = parseFloat(args[i + 1]);
        i++;
    } else if (arg.startsWith('--mad-threshold=')) {
        madThreshold = parseFloat(arg.split('=')[1]);
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
if (isNaN(warmupMs) || warmupMs < 1) warmupMs = DEFAULT_WARMUP_MS;
if (isNaN(superMeasurements) || superMeasurements < 1) superMeasurements = DEFAULT_SUPER_MEASUREMENTS;
if (isNaN(subRuns) || subRuns < 1) subRuns = DEFAULT_SUB_RUNS;
if (isNaN(cvThreshold) || cvThreshold < 0) cvThreshold = DEFAULT_CV_THRESHOLD;
if (isNaN(maxRetries) || maxRetries < 0) maxRetries = DEFAULT_MAX_RETRIES;
if (isNaN(cooldownMs) || cooldownMs < 0) cooldownMs = DEFAULT_COOLDOWN;

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
    createSeededRandom,
    generateCoverageSequence,
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
global.createSeededRandom = createSeededRandom;
global.generateCoverageSequence = generateCoverageSequence;
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
// Helper Functions
// ============================================================================

/**
 * Busy-wait delay to keep CPU active (prevents sleep/throttling).
 */
function busyWait(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        // Busy wait
    }
}

/**
 * Format a number with locale separators.
 */
function formatNumber(num, decimals = 0) {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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

    // Exclusion filters
    if (filters.excludeSize) {
        const excludeList = Array.isArray(filters.excludeSize)
            ? filters.excludeSize
            : [filters.excludeSize];
        result = result.filter(
            (t) => !t.metadata || !excludeList.includes(t.metadata.sizeCategory)
        );
    }

    if (filters.excludeStroke) {
        const excludeList = Array.isArray(filters.excludeStroke)
            ? filters.excludeStroke
            : [filters.excludeStroke];
        result = result.filter(
            (t) => !t.metadata || !excludeList.includes(t.metadata.strokeCategory)
        );
    }

    if (filters.excludeAngle) {
        const excludeList = Array.isArray(filters.excludeAngle)
            ? filters.excludeAngle
            : [filters.excludeAngle];
        result = result.filter(
            (t) => !t.metadata || !excludeList.includes(t.metadata.angleCategory)
        );
    }

    return result;
}

// ============================================================================
// Benchmark execution using super-measurement approach
// ============================================================================

/**
 * Run a single sub-run: draw shapes and return elapsed time.
 */
function measureSubRun(test, ctx, shapeCount, runIndex) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const seed = fixedPositionSeed ? 12345 : (12345 + runIndex);
    SeededRandom.seedWithInteger(seed);
    const startTime = performance.now();
    test.drawFunction(ctx, 0, shapeCount);
    return performance.now() - startTime;
}

/**
 * Perform one super-measurement: multiple sub-runs with stability check.
 * Returns minimum time if stable, null if unstable.
 */
function measureSuper(test, ctx, shapeCount, numSubRuns, threshold, superIndex) {
    const subMeasurements = [];

    for (let i = 0; i < numSubRuns; i++) {
        const elapsed = measureSubRun(test, ctx, shapeCount, superIndex * numSubRuns + i);
        subMeasurements.push(elapsed);
    }

    // Calculate sub-run CV
    const cv = Statistics.calculateCV(subMeasurements);
    const isStable = cv <= threshold;
    const min = Math.min(...subMeasurements);
    const mean = subMeasurements.reduce((a, b) => a + b, 0) / subMeasurements.length;

    return {
        subMeasurements,
        mean,
        min,
        cv,
        stable: isStable
    };
}

/**
 * Run performance test for a single test using the super-measurement approach.
 */
function runPerformanceTest(test, statsOptions = {}) {
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.canvas = canvas;

    // Phase 1: Time-based warmup
    const warmupStart = performance.now();
    let warmupIterations = 0;

    while (performance.now() - warmupStart < warmupMs) {
        SeededRandom.seedWithInteger(12345 + warmupIterations);
        test.drawFunction(ctx, 0, 100); // Small batches during warmup
        warmupIterations++;
    }

    // Brief settle after warmup
    busyWait(200);

    // Phase 2: Super-measurement collection
    const acceptedMeasurements = [];
    let totalAttempts = 0;
    let totalRetries = 0;
    let forcedCount = 0;

    for (let i = 0; i < superMeasurements; i++) {
        let accepted = false;
        let retries = 0;
        let lastResult = null;

        while (!accepted && retries <= maxRetries) {
            totalAttempts++;
            const result = measureSuper(test, ctx, shapesPerRun, subRuns, cvThreshold, i);
            lastResult = result;

            if (result.stable) {
                acceptedMeasurements.push({
                    index: i,
                    bestTime: result.min,
                    meanTime: result.mean,
                    subRunCV: result.cv,
                    retries
                });
                accepted = true;
            } else {
                retries++;
                totalRetries++;
                busyWait(50); // Brief pause before retry
            }
        }

        if (!accepted) {
            // Max retries reached - take measurement anyway
            forcedCount++;
            acceptedMeasurements.push({
                index: i,
                bestTime: lastResult.min,
                meanTime: lastResult.mean,
                subRunCV: lastResult.cv,
                retries,
                forced: true
            });
        }

        // Cooldown between super-measurements
        if (cooldownMs > 0 && i < superMeasurements - 1) {
            busyWait(cooldownMs);
        }
    }

    // Phase 3: Analysis
    const bestTimes = acceptedMeasurements.map(m => m.bestTime);

    // Apply IQR-based outlier removal
    const outlierResult = Statistics.removeOutliersIQR(bestTimes);
    const trimmedTimes = outlierResult.cleaned;

    // Calculate statistics on trimmed data
    const stats = Statistics.analyze(trimmedTimes, statsOptions);

    // Also calculate raw stats for comparison
    const rawStats = Statistics.analyze(bestTimes, statsOptions);

    // Calculate derived metrics
    const shapesPerSecond = (shapesPerRun / stats.mean) * 1000;
    const microsecondsPerShape = (stats.mean / shapesPerRun) * 1000;

    return {
        test,
        measurements: bestTimes,
        trimmedMeasurements: trimmedTimes,
        statistics: stats,
        rawStatistics: rawStats,
        shapesPerSecond,
        microsecondsPerShape,
        warmup: {
            durationMs: warmupMs,
            iterations: warmupIterations
        },
        filtering: {
            totalAttempts,
            accepted: acceptedMeasurements.length,
            totalRetries,
            forcedCount,
            outlierCount: outlierResult.outlierCount,
            avgSubRunCV: acceptedMeasurements.reduce((s, m) => s + m.subRunCV, 0) / acceptedMeasurements.length
        }
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
        console.log(`Warmup: ${warmupMs}ms (time-based)`);
        console.log(`Super-measurements: ${superMeasurements}`);
        console.log(`Sub-runs: ${subRuns} per super-measurement`);
        console.log(`Shapes/run: ${shapesPerRun}`);
        console.log(`CV threshold: ${cvThreshold}%`);
        console.log(`Max retries: ${maxRetries}`);
        console.log(`Cooldown: ${cooldownMs}ms`);
        if (fixedPositionSeed) {
            console.log('Fixed positions: enabled');
        }
        if (skipOutliers) {
            console.log(`MAD outlier filtering: enabled (threshold: ${madThreshold})`);
        }
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

    // Run tests
    const results = [];
    for (let i = 0; i < testsToRun.length; i++) {
        const test = testsToRun[i];

        if (!quietMode) {
            process.stdout.write(
                `[${i + 1}/${testsToRun.length}] ${test.perfName}... `
            );
        }

        const result = runPerformanceTest(test, { skipOutliers, madThreshold });
        results.push(result);

        if (!quietMode) {
            const trimmedCV = result.statistics.stddevPercent;
            const rawCV = result.rawStatistics.stddevPercent;
            console.log(
                `${formatNumber(result.shapesPerSecond)} shapes/sec ` +
                `(CV: ${trimmedCV.toFixed(2)}%, raw: ${rawCV.toFixed(2)}%, ` +
                `outliers: ${result.filtering.outlierCount})`
            );
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
        version: '3.0',
        metadata: {
            timestamp: new Date().toISOString(),
            gitCommit,
            gitBranch,
            nodeVersion: process.version,
            platform: `${process.platform} ${process.arch}`,
            config: {
                warmupMs,
                superMeasurements,
                subRuns,
                shapesPerRun,
                cvThreshold,
                maxRetries,
                cooldownMs,
                canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
                positionReproducibility: {
                    fixedPositions: fixedPositionSeed
                },
                outlierFiltering: {
                    enabled: skipOutliers,
                    method: skipOutliers ? 'mad' : null,
                    threshold: skipOutliers ? madThreshold : null
                }
            },
            filters: Object.keys(filters).length > 0 ? filters : undefined,
            duration: Date.now() - startTime
        },
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
                raw: r.measurements,
                trimmed: r.trimmedMeasurements
            },
            rawStatistics: {
                n: r.rawStatistics.n,
                mean: r.rawStatistics.mean,
                stddevPercent: parseFloat(r.rawStatistics.stddevPercent.toFixed(2))
            },
            shapesPerSec: Math.round(r.shapesPerSecond),
            usPerShape: parseFloat(r.microsecondsPerShape.toFixed(2)),
            warmup: r.warmup,
            filtering: r.filtering
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

        // Summary statistics
        const avgCV = results.reduce((s, r) => s + r.statistics.stddevPercent, 0) / results.length;
        const avgRawCV = results.reduce((s, r) => s + r.rawStatistics.stddevPercent, 0) / results.length;
        console.log(`Average CV: ${avgCV.toFixed(2)}% (raw: ${avgRawCV.toFixed(2)}%)`);

        // High variance warnings
        const highVariance = results.filter((r) => r.statistics.stddevPercent > 5);
        if (highVariance.length > 0) {
            console.log(
                `\n\x1b[33mWARNING: ${highVariance.length} test(s) with CV > 5%\x1b[0m`
            );
        }

        console.log('');
    }
}

main();

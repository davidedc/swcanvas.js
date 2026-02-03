#!/usr/bin/env node
/**
 * JIT Warmup Curve Analyzer - Investigation Tool
 *
 * Profiles JIT optimization by measuring performance for each iteration
 * to identify where performance stabilizes. This helps determine:
 *
 * 1. How many warmup iterations are needed before measurements begin
 * 2. Whether JIT continues optimizing during measurement runs
 * 3. If there are multiple optimization tiers (V8 has several)
 *
 * Output includes:
 * - Performance for each iteration
 * - Rolling average to smooth noise
 * - Detected stabilization point
 * - Recommendation for warmup iterations
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

// Load SWCanvas
const minifiedPath = path.join(__dirname, '../../../dist/swcanvas.min.js');
if (!fs.existsSync(minifiedPath)) {
    console.error('\x1b[31mError: Minified build not found at dist/swcanvas.min.js\x1b[0m');
    console.error('Run: npm run build:prod');
    process.exit(1);
}

const SWCanvas = require(minifiedPath);

// Load test utilities
const {
    DIRECT_RENDERING_PERF_REGISTRY,
    SeededRandom,
    registerDirectRenderingTest,
    PERF_SIZE_CATEGORIES,
    getStrokeWidthFromCategory,
    getShapeSizeFromCategory,
    getRadiusFromShapeCategory,
    getArcAngleFromCategory
} = require('../direct-rendering-test-utils.js');

const { registerParametricPerfTests } = require('../performance-test-generator.js');

// Make utilities globally available for test files
global.SWCanvas = SWCanvas;
global.SeededRandom = SeededRandom;
global.registerDirectRenderingTest = registerDirectRenderingTest;
global.PERF_SIZE_CATEGORIES = PERF_SIZE_CATEGORIES;
global.getStrokeWidthFromCategory = getStrokeWidthFromCategory;
global.getShapeSizeFromCategory = getShapeSizeFromCategory;
global.getRadiusFromShapeCategory = getRadiusFromShapeCategory;
global.getArcAngleFromCategory = getArcAngleFromCategory;
global.registerParametricPerfTests = registerParametricPerfTests;

// Configuration
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;
const DEFAULT_ITERATIONS = 500;
const DEFAULT_SHAPES = 100;  // Smaller batch for granular measurement
const ROLLING_WINDOW = 20;   // Window for rolling average

// Parse command line arguments
const args = process.argv.slice(2);
let testId = null;
let numIterations = DEFAULT_ITERATIONS;
let shapesPerIteration = DEFAULT_SHAPES;
let outputFile = null;
let useReference = false;  // Use simple fillRect instead of a test

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--test-id' && args[i + 1]) {
        testId = args[i + 1];
        i++;
    } else if (arg === '--iterations' && args[i + 1]) {
        numIterations = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--shapes' && args[i + 1]) {
        shapesPerIteration = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--output' && args[i + 1]) {
        outputFile = args[i + 1];
        i++;
    } else if (arg === '--reference') {
        useReference = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
JIT Warmup Curve Analyzer - Investigation Tool

Profiles JIT optimization to determine proper warmup duration.

Usage: node jit-warmup-curve.js [options]

Options:
  --test-id <id>      Test ID to profile (required unless --reference)
  --reference         Use simple fillRect instead of a specific test
  --iterations <N>    Number of iterations to measure (default: ${DEFAULT_ITERATIONS})
  --shapes <N>        Shapes per iteration (default: ${DEFAULT_SHAPES})
  --output <file>     Output JSON to file
  --help, -h          Show this help

Examples:
  # Profile a specific test
  node jit-warmup-curve.js --test-id arc-stroke-opaque-sw1px-szXS-angSmall

  # Profile the reference benchmark (simplest case)
  node jit-warmup-curve.js --reference

Output:
  The tool will report:
  - Performance for each iteration
  - Rolling average
  - Estimated stabilization point
  - Recommended warmup iterations
`);
        process.exit(0);
    }
}

if (!testId && !useReference) {
    console.error('Error: --test-id is required (or use --reference)');
    console.error('Use --help for usage information');
    process.exit(1);
}

// Load test cases
function loadTestCases() {
    const directories = [
        path.join(__dirname, '../cases'),
        path.join(__dirname, '../perf-cases')
    ];

    for (const dir of directories) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                require(path.join(dir, file));
            } catch (e) {
                // Ignore load errors
            }
        }
    }
}

/**
 * Calculate rolling average.
 */
function calculateRollingAverage(values, windowSize) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = values.slice(start, i + 1);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        result.push(avg);
    }
    return result;
}

/**
 * Find stabilization point (where performance stops improving significantly).
 */
function findStabilizationPoint(rollingAvg, threshold = 0.02) {
    // Start from end and work backward to find where improvement began
    const final = rollingAvg[rollingAvg.length - 1];

    // Look for the first point (from the start) where we're within threshold of final
    for (let i = 0; i < rollingAvg.length; i++) {
        const diff = Math.abs(rollingAvg[i] - final) / final;
        if (diff < threshold) {
            return i;
        }
    }

    return rollingAvg.length - 1;  // Never stabilized
}

/**
 * Detect multiple optimization tiers (sudden improvements).
 */
function detectOptimizationTiers(values, rollingAvg) {
    const tiers = [];

    // Look for sudden jumps (>10% improvement over short window)
    for (let i = ROLLING_WINDOW; i < values.length - ROLLING_WINDOW; i++) {
        const before = rollingAvg[i - 5];
        const after = rollingAvg[i + 5];
        const improvement = (after - before) / before;

        if (improvement > 0.10) {  // 10% improvement
            tiers.push({
                iteration: i,
                improvementPercent: improvement * 100,
                before: before,
                after: after
            });
            i += ROLLING_WINDOW;  // Skip ahead to avoid detecting same tier multiple times
        }
    }

    return tiers;
}

/**
 * Main profiling function.
 */
function runProfile() {
    console.log('\n' + '='.repeat(70));
    console.log('JIT WARMUP CURVE ANALYZER - Investigation Tool');
    console.log('='.repeat(70));

    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.canvas = canvas;

    let test = null;
    let testDescription = '';

    if (useReference) {
        testDescription = 'Reference benchmark (fillRect)';
        ctx.fillStyle = 'rgb(128, 128, 128)';
    } else {
        loadTestCases();
        test = DIRECT_RENDERING_PERF_REGISTRY.find(t => t.id === testId);
        if (!test) {
            console.error(`Error: Test '${testId}' not found`);
            console.error('\nAvailable tests (first 10):');
            DIRECT_RENDERING_PERF_REGISTRY.slice(0, 10).forEach(t => {
                console.error(`  ${t.id}`);
            });
            if (DIRECT_RENDERING_PERF_REGISTRY.length > 10) {
                console.error(`  ... and ${DIRECT_RENDERING_PERF_REGISTRY.length - 10} more`);
            }
            process.exit(1);
        }
        testDescription = test.perfName || test.id;
    }

    console.log(`\nTest: ${testDescription}`);
    console.log(`Iterations: ${numIterations}`);
    console.log(`Shapes/iteration: ${shapesPerIteration}`);
    console.log('');

    // Measure each iteration
    console.log('Measuring iterations...');
    const measurements = [];  // Times in ms
    const shapesPerSec = []; // Performance in shapes/sec

    for (let iter = 0; iter < numIterations; iter++) {
        SeededRandom.seedWithInteger(12345 + iter);
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const start = performance.now();
        if (useReference) {
            for (let i = 0; i < shapesPerIteration; i++) {
                const x = (i * 37) % (CANVAS_WIDTH - 50);
                const y = (i * 23) % (CANVAS_HEIGHT - 50);
                ctx.fillRect(x, y, 50, 50);
            }
        } else {
            test.drawFunction(ctx, 0, shapesPerIteration);
        }
        const elapsed = performance.now() - start;

        measurements.push(elapsed);
        shapesPerSec.push((shapesPerIteration / elapsed) * 1000);

        if (iter % 50 === 0) {
            process.stdout.write('.');
        }
    }
    console.log(' done\n');

    // Calculate rolling averages
    const rollingAvg = calculateRollingAverage(shapesPerSec, ROLLING_WINDOW);

    // Find stabilization
    const stabilizationPoint = findStabilizationPoint(rollingAvg);

    // Detect optimization tiers
    const tiers = detectOptimizationTiers(shapesPerSec, rollingAvg);

    // Statistics
    const initialPerf = shapesPerSec.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const finalPerf = shapesPerSec.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const improvement = ((finalPerf - initialPerf) / initialPerf) * 100;

    // Results
    console.log('='.repeat(70));
    console.log('RESULTS');
    console.log('='.repeat(70));

    console.log('\nPerformance Evolution:');
    console.log(`  Initial (first 10):    ${initialPerf.toFixed(0)} shapes/sec`);
    console.log(`  Final (last 20):       ${finalPerf.toFixed(0)} shapes/sec`);
    console.log(`  Improvement:           ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`);

    console.log('\nStabilization:');
    console.log(`  Detected at iteration: ${stabilizationPoint}`);
    console.log(`  Threshold:             2% of final performance`);

    if (tiers.length > 0) {
        console.log('\nOptimization Tiers Detected:');
        tiers.forEach((tier, i) => {
            console.log(`  Tier ${i + 1} at iteration ${tier.iteration}: +${tier.improvementPercent.toFixed(1)}% improvement`);
        });
    } else {
        console.log('\nNo distinct optimization tiers detected (gradual warmup)');
    }

    // Sample output - show first 20, last 10
    console.log('\nSample Performance (shapes/sec):');
    console.log('  First 20 iterations:');
    for (let i = 0; i < Math.min(20, shapesPerSec.length); i++) {
        const bar = '|' + '='.repeat(Math.floor(shapesPerSec[i] / finalPerf * 20));
        console.log(`    ${String(i + 1).padStart(3)}: ${shapesPerSec[i].toFixed(0).padStart(10)} ${bar}`);
    }
    console.log('  ...');
    console.log('  Last 10 iterations:');
    for (let i = shapesPerSec.length - 10; i < shapesPerSec.length; i++) {
        const bar = '|' + '='.repeat(Math.floor(shapesPerSec[i] / finalPerf * 20));
        console.log(`    ${String(i + 1).padStart(3)}: ${shapesPerSec[i].toFixed(0).padStart(10)} ${bar}`);
    }

    // Recommendation
    console.log('\n' + '='.repeat(70));
    console.log('RECOMMENDATION');
    console.log('='.repeat(70));

    let recommendedWarmup;
    let confidence;

    if (improvement < 5) {
        recommendedWarmup = 50;
        confidence = 'HIGH';
        console.log('\n  Performance was already stable. JIT warmup needs are minimal.');
    } else if (stabilizationPoint < 100) {
        recommendedWarmup = Math.ceil(stabilizationPoint * 1.5);  // 50% safety margin
        confidence = 'HIGH';
        console.log(`\n  Quick stabilization detected. JIT warmup is straightforward.`);
    } else if (stabilizationPoint < 300) {
        recommendedWarmup = Math.ceil(stabilizationPoint * 1.5);
        confidence = 'MEDIUM';
        console.log(`\n  Moderate warmup needed. Consider increasing warmup iterations.`);
    } else {
        recommendedWarmup = 500;
        confidence = 'LOW';
        console.log(`\n  Extended warmup required. JIT may be reoptimizing during measurements.`);
    }

    console.log(`\n  Recommended warmup: ${recommendedWarmup} iterations`);
    console.log(`  Confidence: ${confidence}`);

    if (tiers.length > 0) {
        const lastTier = tiers[tiers.length - 1];
        console.log(`\n  NOTE: Last optimization tier detected at iteration ${lastTier.iteration}.`);
        console.log(`  Ensure warmup exceeds this point.`);
        if (lastTier.iteration > recommendedWarmup) {
            recommendedWarmup = lastTier.iteration + 50;
            console.log(`  Adjusted recommendation: ${recommendedWarmup} iterations`);
        }
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // JSON output
    if (outputFile) {
        const output = {
            timestamp: new Date().toISOString(),
            config: {
                testId: useReference ? 'reference' : testId,
                testDescription,
                numIterations,
                shapesPerIteration
            },
            evolution: {
                initialPerformance: initialPerf,
                finalPerformance: finalPerf,
                improvementPercent: improvement
            },
            stabilization: {
                iteration: stabilizationPoint,
                threshold: 0.02
            },
            tiers: tiers,
            recommendation: {
                warmupIterations: recommendedWarmup,
                confidence
            },
            raw: {
                measurements,
                shapesPerSec,
                rollingAverage: rollingAvg
            }
        };

        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`Results written to: ${outputFile}\n`);
    }

    return { stabilizationPoint, recommendedWarmup, improvement };
}

// Run
runProfile();

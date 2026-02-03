#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED - HISTORICAL REFERENCE ONLY
 *
 * This script was created during the variance investigation phase (Feb 2026).
 * It references code that has been removed:
 * - ThrottleDetector (lib/throttle-detector.js - deleted)
 * - Statistics.applyDriftCorrection() (removed from lib/statistics.js)
 *
 * The investigation concluded that drift detection was unreliable (8.84% stddev noise).
 * See PERFORMANCE-BENCHMARKING.md for the new statistical filtering approach.
 *
 * This script will NOT run successfully. Kept for historical reference only.
 *
 * ---
 *
 * Original description:
 *
 * Variance Analyzer
 *
 * Systematically tests each mitigation's effectiveness and analyzes
 * throttle detection reliability. This tool enables data-driven
 * optimization of benchmark configurations.
 *
 * Features:
 * 1. Runs minimal variance baseline first (establishes floor)
 * 2. Runs a selected test with each mitigation combination
 * 3. Calculates variance reduction from each mitigation
 * 4. Runs throttle detection under each configuration
 * 5. Analyzes whether detected throttling is real or noise
 * 6. Outputs structured JSON report with actionable recommendations
 *
 * Usage:
 *   node variance-analyzer.js --test-id <id> [options]
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
const Statistics = require('../lib/statistics');
const ThrottleDetector = require('../lib/throttle-detector');

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
const DEFAULT_RUNS = 50;
const DEFAULT_SHAPES = 500;
const BASELINE_SHAPES = 5000;
const BASELINE_RUNS = 50;

// Parse arguments
const args = process.argv.slice(2);
let testId = null;
let numRuns = DEFAULT_RUNS;
let shapesPerRun = DEFAULT_SHAPES;
let outputFile = null;
let quiet = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--test-id' && args[i + 1]) {
        testId = args[i + 1];
        i++;
    } else if (arg === '--runs' && args[i + 1]) {
        numRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--shapes' && args[i + 1]) {
        shapesPerRun = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--output' && args[i + 1]) {
        outputFile = args[i + 1];
        i++;
    } else if (arg === '--quiet' || arg === '-q') {
        quiet = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Variance Analyzer - Systematic mitigation effectiveness testing

Usage: node variance-analyzer.js --test-id <id> [options]

Options:
  --test-id <id>    Test ID to analyze (required)
  --runs <N>        Number of measurement runs per configuration (default: ${DEFAULT_RUNS})
  --shapes <N>      Shapes per run (default: ${DEFAULT_SHAPES})
  --output <file>   Output JSON report to file
  --quiet, -q       Suppress progress output
  --help, -h        Show this help message

Configurations tested:
  baseline      No mitigations (worst case)
  fixed-pos     --fixed-positions only
  outliers      --skip-outliers only
  pos+outliers  --fixed-positions --skip-outliers (combined)

The analyzer also tests throttle detection reliability under each
configuration to identify false positive warnings.
`);
        process.exit(0);
    }
}

if (!testId) {
    console.error('Error: --test-id is required');
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
 * Run minimal variance baseline (identical rectangles).
 */
function runMinimalBaseline() {
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 128)';

    // Warmup
    for (let w = 0; w < 10; w++) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        for (let i = 0; i < BASELINE_SHAPES; i++) {
            ctx.fillRect(100, 100, 50, 50);
        }
    }

    // Measurement
    const timings = [];
    for (let run = 0; run < BASELINE_RUNS; run++) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const start = performance.now();
        for (let i = 0; i < BASELINE_SHAPES; i++) {
            ctx.fillRect(100, 100, 50, 50);
        }
        timings.push(performance.now() - start);
    }

    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
    const variance = timings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / (timings.length - 1);
    const stddev = Math.sqrt(variance);
    const stddevPercent = (stddev / mean) * 100;
    const shapesPerSec = (BASELINE_SHAPES / mean) * 1000;

    let assessment;
    if (stddevPercent <= 2) {
        assessment = 'EXCELLENT';
    } else if (stddevPercent <= 5) {
        assessment = 'GOOD';
    } else if (stddevPercent <= 10) {
        assessment = 'MARGINAL';
    } else {
        assessment = 'POOR';
    }

    return {
        mean,
        stddev,
        stddevPercent,
        shapesPerSec: Math.round(shapesPerSec),
        assessment,
        runs: BASELINE_RUNS,
        shapes: BASELINE_SHAPES
    };
}

/**
 * Run a test with specific configuration options.
 */
function runTestWithConfig(test, config) {
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.canvas = canvas;

    const { fixedPositions, skipOutliers, madThreshold = 3.5 } = config;

    // Warmup
    for (let w = 0; w < 20; w++) {
        SeededRandom.seedWithInteger(12345 + w);
        test.drawFunction(ctx, 0, shapesPerRun);
    }

    // Measurement
    const measurements = [];
    for (let run = 0; run < numRuns; run++) {
        const seed = fixedPositions ? 12345 : (12345 + run);
        SeededRandom.seedWithInteger(seed);
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const start = performance.now();
        test.drawFunction(ctx, 0, shapesPerRun);
        measurements.push(performance.now() - start);
    }

    // Analyze with optional outlier filtering
    const stats = Statistics.analyze(measurements, { skipOutliers, madThreshold });

    return {
        measurements,
        stats,
        shapesPerSec: (shapesPerRun / stats.mean) * 1000
    };
}

/**
 * Run throttle detection simulation for a configuration.
 * Returns CV analysis to determine if throttle detection would be reliable.
 */
function analyzeThrottleReliability(config) {
    const { skipOutliers, madThreshold = 3.5 } = config;

    // Create throttle detector with matching configuration
    const detector = new ThrottleDetector(SWCanvas, {
        measurementRuns: numRuns,
        skipOutliers,
        madThreshold
    });

    // Establish baseline (this runs multiple measurements)
    const baselineResult = detector.establishBaseline();

    // Run a single check (simulates what happens during benchmark)
    const checkResult = detector.checkThrottling(1);

    // Analyze whether drift is real or noise
    const baselineCV = baselineResult.cvPercent;
    const checkCV = checkResult.measurementCVPercent;
    const reportedDrift = checkResult.driftPercent;

    // Drift is considered "real" if it exceeds 2x the measurement CV
    const driftIsSignificant = Math.abs(reportedDrift) > checkCV * 2;

    let assessment;
    if (baselineCV < 5 && checkCV < 5 && Math.abs(reportedDrift) < 3) {
        assessment = 'RELIABLE - low variance enables accurate throttle detection';
    } else if (baselineCV < 10 && checkCV < 10 && !driftIsSignificant) {
        assessment = 'ACCEPTABLE - moderate variance, drift within noise';
    } else if (driftIsSignificant && Math.abs(reportedDrift) > 10) {
        assessment = 'REAL_DRIFT - detected throttling appears genuine';
    } else {
        assessment = 'UNRELIABLE - high variance may cause false positive throttle warnings';
    }

    return {
        baselineCV,
        checkCV,
        reportedDrift,
        driftSignificant: driftIsSignificant,
        assessment
    };
}

/**
 * Main analysis function.
 */
async function analyze() {
    const startTime = Date.now();

    if (!quiet) {
        console.log('\n' + '='.repeat(60));
        console.log('VARIANCE ANALYZER');
        console.log('='.repeat(60));
        console.log(`Test ID: ${testId}`);
        console.log(`Runs: ${numRuns}, Shapes/run: ${shapesPerRun}`);
        console.log('');
    }

    // Load test cases
    loadTestCases();

    // Find the requested test
    const test = DIRECT_RENDERING_PERF_REGISTRY.find(t => t.id === testId);
    if (!test) {
        console.error(`Error: Test '${testId}' not found`);
        console.error('Available tests:');
        DIRECT_RENDERING_PERF_REGISTRY.slice(0, 10).forEach(t => {
            console.error(`  ${t.id}`);
        });
        if (DIRECT_RENDERING_PERF_REGISTRY.length > 10) {
            console.error(`  ... and ${DIRECT_RENDERING_PERF_REGISTRY.length - 10} more`);
        }
        process.exit(1);
    }

    if (!quiet) {
        console.log(`Test: ${test.perfName || test.id}`);
        console.log('');
    }

    // Step 1: Run minimal variance baseline
    if (!quiet) {
        console.log('Step 1: Minimal Variance Baseline...');
    }
    const minimalBaseline = runMinimalBaseline();
    if (!quiet) {
        console.log(`  StdDev: ${minimalBaseline.stddevPercent.toFixed(2)}% [${minimalBaseline.assessment}]`);
        console.log('');
    }

    // Step 2: Test each configuration
    const configurations = [
        { name: 'baseline', flags: { fixedPositions: false, skipOutliers: false } },
        { name: 'fixed-pos', flags: { fixedPositions: true, skipOutliers: false } },
        { name: 'outliers', flags: { fixedPositions: false, skipOutliers: true } },
        { name: 'pos+outliers', flags: { fixedPositions: true, skipOutliers: true } }
    ];

    const results = [];

    for (const config of configurations) {
        if (!quiet) {
            process.stdout.write(`Step 2: Testing '${config.name}'...`);
        }

        // Run test with this configuration
        const testResult = runTestWithConfig(test, config.flags);

        // Run throttle reliability analysis
        const throttleAnalysis = analyzeThrottleReliability(config.flags);

        results.push({
            name: config.name,
            flags: config.flags,
            runs: numRuns,
            mean: testResult.stats.mean,
            stddevPercent: testResult.stats.stddevPercent,
            shapesPerSec: Math.round(testResult.shapesPerSec),
            throttleAnalysis
        });

        if (!quiet) {
            console.log(` StdDev: ${testResult.stats.stddevPercent.toFixed(1)}%`);
        }
    }

    // Step 3: Analyze results
    const baselineResult = results.find(r => r.name === 'baseline');
    const bestResult = results.reduce((best, r) =>
        r.stddevPercent < best.stddevPercent ? r : best
    );

    // Calculate reduction percentages
    const reductions = {};
    for (const r of results) {
        if (r.name !== 'baseline') {
            const reduction = ((baselineResult.stddevPercent - r.stddevPercent) / baselineResult.stddevPercent) * 100;
            reductions[r.name] = `${reduction.toFixed(1)}%`;
        }
    }

    // Determine throttle reliability
    const bestThrottle = results.find(r => r.name === bestResult.name).throttleAnalysis;
    const baselineThrottle = baselineResult.throttleAnalysis;

    let throttleReliabilityAssessment;
    if (bestThrottle.baselineCV < 5) {
        throttleReliabilityAssessment = 'Reliable - throttle detection CV < 5%';
    } else if (bestThrottle.baselineCV < 10) {
        throttleReliabilityAssessment = 'Marginal - throttle detection CV 5-10%';
    } else {
        throttleReliabilityAssessment = 'Unreliable - throttle detection CV > 10%';
    }

    // Build recommendation
    let recommendation;
    if (bestResult.stddevPercent <= minimalBaseline.stddevPercent + 2) {
        recommendation = 'Variance is near theoretical minimum. No further optimization needed.';
    } else if (bestResult.name === 'pos+outliers') {
        recommendation = 'Use --fixed-positions --skip-outliers for best results.';
    } else if (bestResult.name === 'fixed-pos') {
        recommendation = 'Use --fixed-positions for best results.';
    } else {
        recommendation = 'Current mitigations provide limited benefit. Check for system-level issues.';
    }

    const analysis = {
        varianceFloor: minimalBaseline.stddevPercent,
        baselineVariance: baselineResult.stddevPercent,
        bestVariance: bestResult.stddevPercent,
        controllableVariance: baselineResult.stddevPercent - minimalBaseline.stddevPercent,
        reductionByMitigation: reductions,
        bestConfiguration: bestResult.name,
        throttleReliability: {
            baselineConfig: `${baselineThrottle.assessment} (CV: ${baselineThrottle.baselineCV.toFixed(1)}%)`,
            bestConfig: `${bestThrottle.assessment} (CV: ${bestThrottle.baselineCV.toFixed(1)}%)`,
            threshold: throttleReliabilityAssessment
        },
        recommendation
    };

    // Build full report
    const report = {
        timestamp: new Date().toISOString(),
        environment: {
            node: process.version,
            platform: `${process.platform} ${process.arch}`
        },
        minimalBaseline,
        testId,
        testName: test.perfName || test.id,
        configurations: results,
        analysis,
        duration: Date.now() - startTime
    };

    // Output
    if (!quiet) {
        console.log('');
        console.log('='.repeat(60));
        console.log('ANALYSIS SUMMARY');
        console.log('='.repeat(60));
        console.log(`Variance Floor (theoretical minimum): ${minimalBaseline.stddevPercent.toFixed(2)}%`);
        console.log(`Baseline Variance (no mitigations):   ${baselineResult.stddevPercent.toFixed(2)}%`);
        console.log(`Best Variance (${bestResult.name}):     ${bestResult.stddevPercent.toFixed(2)}%`);
        console.log(`Controllable Variance:                ${(baselineResult.stddevPercent - minimalBaseline.stddevPercent).toFixed(2)}%`);
        console.log('');
        console.log('Variance Reduction by Mitigation:');
        for (const [name, reduction] of Object.entries(reductions)) {
            console.log(`  ${name}: ${reduction}`);
        }
        console.log('');
        console.log('Throttle Detection Reliability:');
        console.log(`  Baseline config: ${baselineThrottle.baselineCV.toFixed(1)}% CV, drift ${baselineThrottle.reportedDrift.toFixed(1)}%`);
        console.log(`  Best config:     ${bestThrottle.baselineCV.toFixed(1)}% CV, drift ${bestThrottle.reportedDrift.toFixed(1)}%`);
        console.log(`  Assessment:      ${throttleReliabilityAssessment}`);
        console.log('');
        console.log('Recommendation:');
        console.log(`  ${recommendation}`);
        console.log('='.repeat(60));
    }

    // Write output if requested
    if (outputFile) {
        fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
        if (!quiet) {
            console.log(`\nReport written to: ${outputFile}`);
        }
    }

    return report;
}

// Run
analyze().catch(err => {
    console.error('Analysis failed:', err);
    process.exit(1);
});

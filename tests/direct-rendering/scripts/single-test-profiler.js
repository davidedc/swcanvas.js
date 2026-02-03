#!/usr/bin/env node
/**
 * Single Test Profiler - Investigation Tool
 *
 * Performs deep variance analysis on a single test by running 200+ measurements
 * and analyzing:
 * - Distribution shape (normal, skewed, multimodal)
 * - Time-series trends (drift, periodicity)
 * - Outlier patterns (isolated vs clustered)
 * - Variance decomposition (timing vs position variance)
 *
 * This helps understand WHY a test has high variance.
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
const DEFAULT_RUNS = 200;
const DEFAULT_SHAPES = 500;
const DEFAULT_WARMUP = 100;

// Parse command line arguments
const args = process.argv.slice(2);
let testId = null;
let numRuns = DEFAULT_RUNS;
let shapesPerRun = DEFAULT_SHAPES;
let warmupRuns = DEFAULT_WARMUP;
let outputFile = null;
let fixedPositions = false;
let forceGC = false;

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
    } else if (arg === '--warmup' && args[i + 1]) {
        warmupRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--output' && args[i + 1]) {
        outputFile = args[i + 1];
        i++;
    } else if (arg === '--fixed-positions') {
        fixedPositions = true;
    } else if (arg === '--force-gc') {
        forceGC = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Single Test Profiler - Investigation Tool

Deep variance analysis on a single test to understand variance sources.

Usage: node single-test-profiler.js --test-id <id> [options]

Options:
  --test-id <id>      Test ID to profile (required)
  --runs <N>          Number of measurement runs (default: ${DEFAULT_RUNS})
  --shapes <N>        Shapes per run (default: ${DEFAULT_SHAPES})
  --warmup <N>        Warmup runs before measurement (default: ${DEFAULT_WARMUP})
  --fixed-positions   Use same seed for all runs (isolates timing variance)
  --force-gc          Force GC before each run (requires --expose-gc)
  --output <file>     Output JSON to file
  --help, -h          Show this help

Analysis includes:
  - Distribution shape (normal, skewed, multimodal)
  - Time-series trends (drift, periodicity)
  - Outlier patterns (isolated vs clustered)
  - Variance decomposition (with --fixed-positions)

Example:
  # Basic profile
  node single-test-profiler.js --test-id arc-stroke-opaque-sw1px-szXS-angSmall

  # Isolate timing variance only
  node single-test-profiler.js --test-id arc-stroke-opaque-sw1px-szXS-angSmall --fixed-positions
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
 * Calculate comprehensive statistics.
 */
function calculateStats(measurements) {
    const n = measurements.length;
    const sorted = [...measurements].sort((a, b) => a - b);

    const mean = measurements.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0
        ? (sorted[n/2 - 1] + sorted[n/2]) / 2
        : sorted[Math.floor(n/2)];

    const variance = measurements.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / (n - 1);
    const stddev = Math.sqrt(variance);
    const cv = (stddev / mean) * 100;

    const min = sorted[0];
    const max = sorted[n - 1];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const p5 = sorted[Math.floor(n * 0.05)];
    const p95 = sorted[Math.floor(n * 0.95)];

    // Skewness
    const skewness = measurements.reduce((sum, m) =>
        sum + Math.pow((m - mean) / stddev, 3), 0) / n;

    // Kurtosis (excess kurtosis, normal = 0)
    const kurtosis = measurements.reduce((sum, m) =>
        sum + Math.pow((m - mean) / stddev, 4), 0) / n - 3;

    return {
        n, mean, median, stddev, cv, variance,
        min, max, q1, q3, iqr, p5, p95,
        skewness, kurtosis
    };
}

/**
 * Analyze distribution shape.
 */
function analyzeDistribution(measurements, stats) {
    let shape;
    let description;

    if (Math.abs(stats.skewness) < 0.5 && Math.abs(stats.kurtosis) < 1) {
        shape = 'normal';
        description = 'Approximately normal distribution - variance is random noise';
    } else if (stats.skewness > 0.5) {
        shape = 'right-skewed';
        description = 'Right-skewed (positive tail) - likely GC pauses or OS interrupts';
    } else if (stats.skewness < -0.5) {
        shape = 'left-skewed';
        description = 'Left-skewed (negative tail) - unusual, check for optimization effects';
    } else if (stats.kurtosis > 2) {
        shape = 'heavy-tailed';
        description = 'Heavy-tailed - high outlier rate, possibly multiple variance sources';
    } else {
        shape = 'unknown';
        description = 'Distribution shape unclear';
    }

    // Check for bimodality (simple approach: compare modes)
    const binCount = 20;
    const binWidth = (stats.max - stats.min) / binCount;
    const bins = new Array(binCount).fill(0);
    measurements.forEach(m => {
        const bin = Math.min(binCount - 1, Math.floor((m - stats.min) / binWidth));
        bins[bin]++;
    });

    // Find local maxima
    const localMaxima = [];
    for (let i = 1; i < bins.length - 1; i++) {
        if (bins[i] > bins[i-1] && bins[i] > bins[i+1] && bins[i] > measurements.length * 0.05) {
            localMaxima.push(i);
        }
    }

    const isMultimodal = localMaxima.length >= 2;
    if (isMultimodal) {
        shape = 'multimodal';
        description = `Multimodal (${localMaxima.length} modes) - suggests distinct performance states`;
    }

    return { shape, description, skewness: stats.skewness, kurtosis: stats.kurtosis, isMultimodal, bins };
}

/**
 * Analyze time-series for trends.
 */
function analyzeTimeSeries(measurements) {
    const n = measurements.length;

    // Linear regression for trend
    const xMean = (n - 1) / 2;
    const yMean = measurements.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (measurements[i] - yMean);
        denominator += Math.pow(i - xMean, 2);
    }
    const slope = numerator / denominator;
    const slopePercent = (slope * n / yMean) * 100;  // Total change as % of mean

    // Check for periodicity using autocorrelation
    const maxLag = Math.min(50, Math.floor(n / 4));
    const autocorrelations = [];
    for (let lag = 1; lag <= maxLag; lag++) {
        let sum = 0;
        for (let i = 0; i < n - lag; i++) {
            sum += (measurements[i] - yMean) * (measurements[i + lag] - yMean);
        }
        const variance = measurements.reduce((s, m) => s + Math.pow(m - yMean, 2), 0);
        autocorrelations.push({
            lag,
            correlation: sum / variance
        });
    }

    // Find significant autocorrelation (>0.3)
    const significantLags = autocorrelations.filter(a => Math.abs(a.correlation) > 0.3);

    return {
        trend: {
            slope,
            slopePercent,
            isTrending: Math.abs(slopePercent) > 2,
            direction: slopePercent > 0 ? 'increasing' : 'decreasing'
        },
        periodicity: {
            detected: significantLags.length > 0,
            significantLags: significantLags.map(a => a.lag),
            autocorrelations
        }
    };
}

/**
 * Analyze outliers in detail.
 */
function analyzeOutliers(measurements, stats) {
    const lowerBound = stats.q1 - 1.5 * stats.iqr;
    const upperBound = stats.q3 + 1.5 * stats.iqr;

    const outliers = [];
    measurements.forEach((m, i) => {
        if (m < lowerBound || m > upperBound) {
            outliers.push({
                index: i,
                value: m,
                deviationPercent: ((m - stats.mean) / stats.mean) * 100,
                type: m > upperBound ? 'high' : 'low'
            });
        }
    });

    // Check if outliers are clustered
    const clusterThreshold = 5;  // Within 5 runs of each other
    let clusters = 0;
    let inCluster = false;
    for (let i = 1; i < outliers.length; i++) {
        if (outliers[i].index - outliers[i-1].index <= clusterThreshold) {
            if (!inCluster) {
                clusters++;
                inCluster = true;
            }
        } else {
            inCluster = false;
        }
    }

    const isClustered = clusters >= 2;

    return {
        count: outliers.length,
        percentage: (outliers.length / measurements.length) * 100,
        outliers,
        isClustered,
        clusterCount: clusters,
        bounds: { lower: lowerBound, upper: upperBound },
        interpretation: isClustered
            ? 'Clustered outliers suggest periodic system interference (GC, scheduler)'
            : 'Isolated outliers suggest random noise'
    };
}

/**
 * Main profiling function.
 */
function runProfile() {
    console.log('\n' + '='.repeat(70));
    console.log('SINGLE TEST PROFILER - Investigation Tool');
    console.log('='.repeat(70));

    loadTestCases();

    const test = DIRECT_RENDERING_PERF_REGISTRY.find(t => t.id === testId);
    if (!test) {
        console.error(`Error: Test '${testId}' not found`);
        console.error('\nAvailable tests (first 10):');
        DIRECT_RENDERING_PERF_REGISTRY.slice(0, 10).forEach(t => {
            console.error(`  ${t.id}`);
        });
        process.exit(1);
    }

    console.log(`\nTest: ${test.perfName || test.id}`);
    console.log(`Runs: ${numRuns}`);
    console.log(`Shapes/run: ${shapesPerRun}`);
    console.log(`Warmup: ${warmupRuns} runs`);
    console.log(`Fixed positions: ${fixedPositions ? 'YES' : 'NO'}`);
    console.log(`Force GC: ${forceGC && global.gc ? 'YES' : 'NO'}`);
    console.log('');

    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.canvas = canvas;

    // Warmup
    console.log(`Warming up (${warmupRuns} runs)...`);
    for (let w = 0; w < warmupRuns; w++) {
        SeededRandom.seedWithInteger(12345 + w);
        test.drawFunction(ctx, 0, shapesPerRun);
    }
    console.log('done\n');

    // Measurement
    console.log(`Measuring (${numRuns} runs)...`);
    const measurements = [];

    for (let run = 0; run < numRuns; run++) {
        if (forceGC && global.gc) {
            global.gc();
        }

        const seed = fixedPositions ? 12345 : (12345 + run);
        SeededRandom.seedWithInteger(seed);
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const start = performance.now();
        test.drawFunction(ctx, 0, shapesPerRun);
        measurements.push(performance.now() - start);

        if (run % 20 === 0) {
            process.stdout.write('.');
        }
    }
    console.log(' done\n');

    // Analysis
    const stats = calculateStats(measurements);
    const distribution = analyzeDistribution(measurements, stats);
    const timeSeries = analyzeTimeSeries(measurements);
    const outlierAnalysis = analyzeOutliers(measurements, stats);

    const shapesPerSec = (shapesPerRun / stats.mean) * 1000;

    // Output
    console.log('='.repeat(70));
    console.log('RESULTS');
    console.log('='.repeat(70));

    console.log('\nCore Statistics:');
    console.log(`  Mean:        ${stats.mean.toFixed(4)} ms`);
    console.log(`  Median:      ${stats.median.toFixed(4)} ms`);
    console.log(`  StdDev:      ${stats.stddev.toFixed(4)} ms (${stats.cv.toFixed(2)}% CV)`);
    console.log(`  Range:       [${stats.min.toFixed(4)}, ${stats.max.toFixed(4)}] ms`);
    console.log(`  IQR:         [${stats.q1.toFixed(4)}, ${stats.q3.toFixed(4)}] ms`);
    console.log(`  Throughput:  ${shapesPerSec.toFixed(0)} shapes/sec`);

    console.log('\nDistribution Analysis:');
    console.log(`  Shape:       ${distribution.shape}`);
    console.log(`  Skewness:    ${distribution.skewness.toFixed(3)} (0 = symmetric)`);
    console.log(`  Kurtosis:    ${distribution.kurtosis.toFixed(3)} (0 = normal)`);
    console.log(`  Assessment:  ${distribution.description}`);

    console.log('\nTime-Series Analysis:');
    console.log(`  Trend:       ${timeSeries.trend.isTrending ? `${timeSeries.trend.slopePercent >= 0 ? '+' : ''}${timeSeries.trend.slopePercent.toFixed(2)}% over run` : 'No significant trend'}`);
    console.log(`  Periodicity: ${timeSeries.periodicity.detected ? `Detected at lags [${timeSeries.periodicity.significantLags.join(', ')}]` : 'Not detected'}`);

    console.log('\nOutlier Analysis:');
    console.log(`  Count:       ${outlierAnalysis.count} (${outlierAnalysis.percentage.toFixed(1)}%)`);
    console.log(`  Pattern:     ${outlierAnalysis.interpretation}`);
    if (outlierAnalysis.count > 0) {
        const highOutliers = outlierAnalysis.outliers.filter(o => o.type === 'high').length;
        const lowOutliers = outlierAnalysis.outliers.filter(o => o.type === 'low').length;
        console.log(`  Types:       ${highOutliers} high, ${lowOutliers} low`);
    }

    // Histogram (ASCII art)
    console.log('\nDistribution Histogram:');
    const maxBin = Math.max(...distribution.bins);
    const histWidth = 40;
    for (let i = 0; i < distribution.bins.length; i++) {
        const barLen = Math.round((distribution.bins[i] / maxBin) * histWidth);
        const bar = '='.repeat(barLen);
        const binStart = (stats.min + i * (stats.max - stats.min) / distribution.bins.length).toFixed(2);
        console.log(`  ${binStart.padStart(7)}ms |${bar}`);
    }

    // Diagnosis
    console.log('\n' + '='.repeat(70));
    console.log('DIAGNOSIS');
    console.log('='.repeat(70));

    const issues = [];

    if (stats.cv > 10) {
        issues.push({
            severity: 'HIGH',
            issue: `High variance (${stats.cv.toFixed(1)}% CV)`,
            cause: 'Multiple factors likely contributing',
            mitigation: 'Run minimal-reference-benchmark.js first to establish floor'
        });
    }

    if (distribution.shape === 'right-skewed') {
        issues.push({
            severity: 'MEDIUM',
            issue: 'Right-skewed distribution',
            cause: 'Likely GC pauses or OS interrupts',
            mitigation: 'Use --force-gc and --skip-outliers'
        });
    }

    if (distribution.isMultimodal) {
        issues.push({
            severity: 'HIGH',
            issue: 'Multimodal distribution',
            cause: 'Multiple distinct performance states (JIT, CPU frequency)',
            mitigation: 'Increase warmup, check CPU frequency scaling'
        });
    }

    if (timeSeries.trend.isTrending && Math.abs(timeSeries.trend.slopePercent) > 5) {
        issues.push({
            severity: 'MEDIUM',
            issue: `Performance drift (${timeSeries.trend.slopePercent.toFixed(1)}%)`,
            cause: timeSeries.trend.direction === 'increasing' ? 'Possible thermal throttling' : 'Possible JIT optimization',
            mitigation: 'Check throttle-stability-test.js, increase warmup'
        });
    }

    if (outlierAnalysis.isClustered) {
        issues.push({
            severity: 'MEDIUM',
            issue: 'Clustered outliers',
            cause: 'Periodic system interference',
            mitigation: 'Use --test-delay to space measurements'
        });
    }

    if (!fixedPositions && stats.cv > 5) {
        issues.push({
            severity: 'LOW',
            issue: 'Variable positions may contribute to variance',
            cause: 'Different random positions each run',
            mitigation: 'Re-run with --fixed-positions to isolate timing variance'
        });
    }

    if (issues.length === 0) {
        console.log('\n  No significant issues detected. Variance appears to be random noise.');
    } else {
        console.log('\nIdentified Issues:');
        issues.forEach((issue, i) => {
            const color = issue.severity === 'HIGH' ? '\x1b[31m' :
                issue.severity === 'MEDIUM' ? '\x1b[33m' : '\x1b[36m';
            console.log(`\n  ${i + 1}. ${color}[${issue.severity}]\x1b[0m ${issue.issue}`);
            console.log(`     Likely cause: ${issue.cause}`);
            console.log(`     Mitigation: ${issue.mitigation}`);
        });
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // JSON output
    if (outputFile) {
        const output = {
            timestamp: new Date().toISOString(),
            config: {
                testId,
                testName: test.perfName,
                numRuns,
                shapesPerRun,
                warmupRuns,
                fixedPositions,
                forceGC
            },
            statistics: stats,
            distribution,
            timeSeries,
            outliers: outlierAnalysis,
            shapesPerSec,
            diagnosis: issues,
            raw: measurements
        };

        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`Results written to: ${outputFile}\n`);
    }

    return { stats, issues };
}

// Run
runProfile();

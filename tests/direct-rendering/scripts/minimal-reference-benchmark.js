#!/usr/bin/env node
/**
 * Minimal Reference Benchmark - Investigation Tool
 *
 * Establishes the TRUE variance floor with extreme rigor:
 * - Massive warmup (10,000+ iterations) to ensure full JIT compilation
 * - Extended measurement runs (200+) for statistical significance
 * - Trend analysis to detect drift during measurement
 * - Detailed output for debugging measurement reliability
 *
 * This is the FIRST tool to run when investigating benchmark reliability.
 * If this shows high variance, no amount of framework fixes will help.
 *
 * Expected results:
 * - CV < 2%: Excellent - measurement system is sound
 * - CV 2-5%: Acceptable - some noise but usable
 * - CV 5-10%: Concerning - investigate system-level issues
 * - CV > 10%: Fundamental problem - cannot trust any measurements
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

// Configuration defaults - more aggressive than minimal-variance-baseline.js
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;
const DEFAULT_WARMUP = 10000;      // Much more warmup for full JIT
const DEFAULT_RUNS = 200;          // More runs for better statistics
const DEFAULT_SHAPES = 5000;       // Standard shapes per run

// Parse command line arguments
const args = process.argv.slice(2);
let warmupIterations = DEFAULT_WARMUP;
let numRuns = DEFAULT_RUNS;
let shapesPerRun = DEFAULT_SHAPES;
let outputFile = null;
let verbose = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--warmup' && args[i + 1]) {
        warmupIterations = parseInt(args[i + 1], 10);
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
    } else if (arg === '--verbose' || arg === '-v') {
        verbose = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Minimal Reference Benchmark - Investigation Tool

Establishes the TRUE variance floor with extreme rigor.
This is the FIRST tool to run when investigating benchmark reliability.

Usage: node minimal-reference-benchmark.js [options]

Options:
  --warmup <N>     Warmup iterations (default: ${DEFAULT_WARMUP})
  --runs <N>       Number of measurement runs (default: ${DEFAULT_RUNS})
  --shapes <N>     Shapes per run (default: ${DEFAULT_SHAPES})
  --output <file>  Output JSON to file
  --verbose, -v    Show every measurement
  --help, -h       Show this help

Expected CV results:
  < 2%:   EXCELLENT - measurement system is sound
  2-5%:   ACCEPTABLE - some noise but usable
  5-10%:  CONCERNING - investigate system-level issues
  > 10%:  FUNDAMENTAL PROBLEM - cannot trust measurements
`);
        process.exit(0);
    }
}

/**
 * Run a single measurement batch (shapes per run).
 * Uses identical operations at identical positions.
 */
function measureBatch(ctx, shapesCount) {
    const start = performance.now();
    for (let i = 0; i < shapesCount; i++) {
        // IDENTICAL operation at IDENTICAL position every time
        // This eliminates all algorithmic variance
        ctx.fillRect(100, 100, 50, 50);
    }
    return performance.now() - start;
}

/**
 * Calculate comprehensive statistics.
 */
function calculateStats(measurements) {
    const n = measurements.length;
    const sorted = [...measurements].sort((a, b) => a - b);

    // Central tendency
    const mean = measurements.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0
        ? (sorted[n/2 - 1] + sorted[n/2]) / 2
        : sorted[Math.floor(n/2)];

    // Dispersion (sample stddev with n-1)
    const variance = measurements.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / (n - 1);
    const stddev = Math.sqrt(variance);
    const cv = (stddev / mean) * 100;

    // Standard error
    const sem = stddev / Math.sqrt(n);
    const ci95 = 1.96 * sem;

    // Range and percentiles
    const min = sorted[0];
    const max = sorted[n - 1];
    const p5 = sorted[Math.floor(n * 0.05)];
    const p95 = sorted[Math.floor(n * 0.95)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    return {
        n, mean, median, stddev, cv, sem, ci95,
        min, max, p5, p95, q1, q3, iqr
    };
}

/**
 * Analyze trend over time (detect drift).
 */
function analyzeTrend(measurements) {
    const n = measurements.length;
    const quarterSize = Math.floor(n / 4);

    // Split into quarters
    const q1 = measurements.slice(0, quarterSize);
    const q2 = measurements.slice(quarterSize, 2 * quarterSize);
    const q3 = measurements.slice(2 * quarterSize, 3 * quarterSize);
    const q4 = measurements.slice(3 * quarterSize);

    const mean1 = q1.reduce((a, b) => a + b, 0) / q1.length;
    const mean2 = q2.reduce((a, b) => a + b, 0) / q2.length;
    const mean3 = q3.reduce((a, b) => a + b, 0) / q3.length;
    const mean4 = q4.reduce((a, b) => a + b, 0) / q4.length;

    // Linear regression to detect trend
    const xMean = (n - 1) / 2;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (measurements[i] - (q1.reduce((a,b)=>a+b,0)/q1.length + q4.reduce((a,b)=>a+b,0)/q4.length)/2);
        denominator += Math.pow(i - xMean, 2);
    }
    const slope = numerator / denominator;
    const slopePercent = (slope * n / mean1) * 100;

    // Drift from first to last quarter
    const drift = ((mean4 - mean1) / mean1) * 100;

    return {
        quarterMeans: [mean1, mean2, mean3, mean4],
        drift,
        slopePercent,
        isTrending: Math.abs(drift) > 2 // More than 2% drift is concerning
    };
}

/**
 * Detect outliers using IQR method.
 */
function detectOutliers(measurements, stats) {
    const lowerBound = stats.q1 - 1.5 * stats.iqr;
    const upperBound = stats.q3 + 1.5 * stats.iqr;

    const outlierIndices = [];
    measurements.forEach((m, i) => {
        if (m < lowerBound || m > upperBound) {
            outlierIndices.push(i);
        }
    });

    return {
        count: outlierIndices.length,
        indices: outlierIndices,
        lowerBound,
        upperBound,
        percentage: (outlierIndices.length / measurements.length) * 100
    };
}

/**
 * Main benchmark function.
 */
function runBenchmark() {
    console.log('\n' + '='.repeat(70));
    console.log('MINIMAL REFERENCE BENCHMARK - Investigation Tool');
    console.log('='.repeat(70));
    console.log(`\nConfiguration:`);
    console.log(`  Warmup:     ${warmupIterations.toLocaleString()} iterations`);
    console.log(`  Runs:       ${numRuns.toLocaleString()}`);
    console.log(`  Shapes/run: ${shapesPerRun.toLocaleString()}`);
    console.log(`  Operation:  fillRect(100, 100, 50, 50) - IDENTICAL every time`);
    console.log('');

    // Create canvas and context
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 128)';

    // Phase 1: Extensive warmup
    console.log(`Phase 1: Warming up (${warmupIterations.toLocaleString()} iterations)...`);
    const warmupStart = performance.now();
    for (let i = 0; i < warmupIterations; i++) {
        ctx.fillRect(100, 100, 50, 50);
        if (verbose && i % 1000 === 0) {
            process.stdout.write('.');
        }
    }
    const warmupTime = performance.now() - warmupStart;
    console.log(` done (${warmupTime.toFixed(0)}ms)`);

    // Brief pause to let system settle
    const settleMs = 100;
    console.log(`  Settling for ${settleMs}ms...`);
    const settleStart = Date.now();
    while (Date.now() - settleStart < settleMs) {
        // Busy wait to maintain CPU state
    }

    // Phase 2: Measurement
    console.log(`\nPhase 2: Measuring (${numRuns} runs)...`);
    const measurements = [];

    for (let run = 0; run < numRuns; run++) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const elapsed = measureBatch(ctx, shapesPerRun);
        measurements.push(elapsed);

        if (verbose) {
            console.log(`  Run ${run + 1}: ${elapsed.toFixed(3)}ms`);
        } else if (run % 20 === 0) {
            process.stdout.write('.');
        }
    }
    if (!verbose) console.log(' done');

    // Phase 3: Analysis
    console.log('\nPhase 3: Analysis...');

    const stats = calculateStats(measurements);
    const trend = analyzeTrend(measurements);
    const outliers = detectOutliers(measurements, stats);
    const shapesPerSec = (shapesPerRun / stats.mean) * 1000;

    // Assessment
    let assessment, assessmentCode;
    if (stats.cv <= 2) {
        assessment = 'EXCELLENT - Measurement system is sound';
        assessmentCode = 'excellent';
    } else if (stats.cv <= 5) {
        assessment = 'ACCEPTABLE - Some noise but usable';
        assessmentCode = 'acceptable';
    } else if (stats.cv <= 10) {
        assessment = 'CONCERNING - Investigate system-level issues';
        assessmentCode = 'concerning';
    } else {
        assessment = 'FUNDAMENTAL PROBLEM - Cannot trust measurements';
        assessmentCode = 'poor';
    }

    // Output
    console.log('\n' + '='.repeat(70));
    console.log('RESULTS');
    console.log('='.repeat(70));

    console.log('\nCore Statistics:');
    console.log(`  Mean:      ${stats.mean.toFixed(4)} ms`);
    console.log(`  Median:    ${stats.median.toFixed(4)} ms`);
    console.log(`  StdDev:    ${stats.stddev.toFixed(4)} ms`);
    console.log(`  CV:        ${stats.cv.toFixed(2)}%`);
    console.log(`  SEM:       ${stats.sem.toFixed(4)} ms`);
    console.log(`  95% CI:    ${stats.mean.toFixed(4)} +/- ${stats.ci95.toFixed(4)} ms`);

    console.log('\nRange & Percentiles:');
    console.log(`  Min:       ${stats.min.toFixed(4)} ms`);
    console.log(`  Max:       ${stats.max.toFixed(4)} ms`);
    console.log(`  Range:     ${(stats.max - stats.min).toFixed(4)} ms`);
    console.log(`  P5:        ${stats.p5.toFixed(4)} ms`);
    console.log(`  P95:       ${stats.p95.toFixed(4)} ms`);
    console.log(`  IQR:       ${stats.iqr.toFixed(4)} ms`);

    console.log('\nTrend Analysis (drift over time):');
    console.log(`  Q1 mean:   ${trend.quarterMeans[0].toFixed(4)} ms`);
    console.log(`  Q2 mean:   ${trend.quarterMeans[1].toFixed(4)} ms`);
    console.log(`  Q3 mean:   ${trend.quarterMeans[2].toFixed(4)} ms`);
    console.log(`  Q4 mean:   ${trend.quarterMeans[3].toFixed(4)} ms`);
    console.log(`  Drift:     ${trend.drift >= 0 ? '+' : ''}${trend.drift.toFixed(2)}% (first to last quarter)`);
    console.log(`  Trend:     ${trend.isTrending ? '\x1b[33mDRIFT DETECTED\x1b[0m' : 'Stable'}`);

    console.log('\nOutlier Analysis (IQR method):');
    console.log(`  Count:     ${outliers.count} (${outliers.percentage.toFixed(1)}%)`);
    console.log(`  Bounds:    [${outliers.lowerBound.toFixed(4)}, ${outliers.upperBound.toFixed(4)}] ms`);

    console.log('\nThroughput:');
    console.log(`  Shapes/sec: ${Math.round(shapesPerSec).toLocaleString()}`);

    console.log('\n' + '='.repeat(70));
    console.log('ASSESSMENT');
    console.log('='.repeat(70));

    const colorCode = {
        'excellent': '\x1b[32m',
        'acceptable': '\x1b[33m',
        'concerning': '\x1b[33m',
        'poor': '\x1b[31m'
    };
    console.log(`\n  ${colorCode[assessmentCode]}${assessment}\x1b[0m`);

    // Warnings
    const warnings = [];
    if (trend.isTrending) {
        warnings.push(`Drift of ${Math.abs(trend.drift).toFixed(1)}% detected over measurement period`);
    }
    if (outliers.percentage > 5) {
        warnings.push(`${outliers.percentage.toFixed(1)}% outliers detected - potential GC or OS interference`);
    }
    if (stats.cv > 5) {
        warnings.push(`High variance (${stats.cv.toFixed(1)}% CV) - check CPU frequency scaling, background processes`);
    }

    if (warnings.length > 0) {
        console.log('\nWarnings:');
        warnings.forEach(w => console.log(`  - ${w}`));
    }

    console.log('\n' + '='.repeat(70));
    console.log('This is the VARIANCE FLOOR - no benchmark can have lower variance.');
    console.log('If this test shows > 5% CV, investigate system-level issues first.');
    console.log('='.repeat(70) + '\n');

    // JSON output
    if (outputFile) {
        const output = {
            timestamp: new Date().toISOString(),
            config: {
                warmupIterations,
                numRuns,
                shapesPerRun,
                canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
                operation: 'fillRect(100, 100, 50, 50)'
            },
            statistics: {
                n: stats.n,
                mean: stats.mean,
                median: stats.median,
                stddev: stats.stddev,
                cv: stats.cv,
                sem: stats.sem,
                ci95Width: stats.ci95,
                min: stats.min,
                max: stats.max,
                p5: stats.p5,
                p95: stats.p95,
                q1: stats.q1,
                q3: stats.q3,
                iqr: stats.iqr,
                shapesPerSec: Math.round(shapesPerSec)
            },
            trend: {
                quarterMeans: trend.quarterMeans,
                driftPercent: trend.drift,
                slopePercent: trend.slopePercent,
                isTrending: trend.isTrending
            },
            outliers: {
                count: outliers.count,
                percentage: outliers.percentage,
                indices: outliers.indices,
                bounds: { lower: outliers.lowerBound, upper: outliers.upperBound }
            },
            assessment: {
                code: assessmentCode,
                message: assessment
            },
            warnings,
            raw: measurements
        };

        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`Results written to: ${outputFile}\n`);
    }

    return { stats, trend, outliers, assessment: assessmentCode };
}

// Run
runBenchmark();

#!/usr/bin/env node
/**
 * Filtered Best Benchmark
 *
 * Achieves low variance through statistical filtering:
 * - Takes multiple sub-measurements per data point
 * - Discards measurements where high CV indicates system instability
 * - Takes minimum (fastest) time as representative value
 * - Retries unstable measurements
 *
 * Usage:
 *   node filtered-best-benchmark.js [options]
 *
 * Options:
 *   --warmup <N>              Warmup iterations (default: 50000)
 *   --super-measurements <N>  Number of super-measurements (default: 50)
 *   --sub-runs <N>            Sub-runs per super-measurement (default: 5)
 *   --shapes <N>              Shapes per sub-run (default: 5000)
 *   --cv-threshold <N>        Max CV% to accept measurement (default: 5)
 *   --max-retries <N>         Retries for unstable measurements (default: 3)
 *   --cooldown <ms>           Delay between super-measurements (default: 100)
 *   --output <file>           Write results to JSON file
 *   --verbose, -v             Show detailed progress
 *   -h, --help                Show help
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

// ============================================================================
// Load SWCanvas
// ============================================================================

const minifiedPath = path.join(__dirname, '../../../dist/swcanvas.min.js');
if (!fs.existsSync(minifiedPath)) {
    console.error('\x1b[31mError: Minified build not found at dist/swcanvas.min.js\x1b[0m');
    console.error('Run: npm run build:prod');
    process.exit(1);
}

const SWCanvas = require(minifiedPath);

// ============================================================================
// Configuration
// ============================================================================

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;

// Defaults
const DEFAULT_WARMUP_MS = 3000;      // Time-based warmup (ms)
const DEFAULT_SUPER_MEASUREMENTS = 50;
const DEFAULT_SUB_RUNS = 5;
const DEFAULT_SHAPES = 5000;
const DEFAULT_CV_THRESHOLD = 5;      // Percent
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_COOLDOWN = 100;        // ms
const DEFAULT_TRIM_PERCENT = 10;     // Trim top/bottom N% for trimmed stats

// ============================================================================
// Argument Parsing
// ============================================================================

const args = process.argv.slice(2);
let warmupMs = DEFAULT_WARMUP_MS;
let superMeasurements = DEFAULT_SUPER_MEASUREMENTS;
let subRuns = DEFAULT_SUB_RUNS;
let shapesPerRun = DEFAULT_SHAPES;
let cvThreshold = DEFAULT_CV_THRESHOLD;
let maxRetries = DEFAULT_MAX_RETRIES;
let cooldownMs = DEFAULT_COOLDOWN;
let trimPercent = DEFAULT_TRIM_PERCENT;
let outputFile = null;
let verbose = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--warmup' || arg === '--warmup-ms') && args[i + 1]) {
        warmupMs = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--super-measurements' && args[i + 1]) {
        superMeasurements = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--sub-runs' && args[i + 1]) {
        subRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--shapes' && args[i + 1]) {
        shapesPerRun = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--cv-threshold' && args[i + 1]) {
        cvThreshold = parseFloat(args[i + 1]);
        i++;
    } else if (arg === '--max-retries' && args[i + 1]) {
        maxRetries = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--cooldown' && args[i + 1]) {
        cooldownMs = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--trim' && args[i + 1]) {
        trimPercent = parseFloat(args[i + 1]);
        i++;
    } else if (arg === '--output' && args[i + 1]) {
        outputFile = args[i + 1];
        i++;
    } else if (arg === '--verbose' || arg === '-v') {
        verbose = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Filtered Best Benchmark

Achieves low variance through statistical filtering:
- Time-based warmup to reach thermal steady state
- Takes multiple sub-measurements per data point
- Discards measurements where high CV indicates system instability
- Takes minimum (fastest) time as representative value
- Retries unstable measurements
- Applies trimmed statistics to remove outliers from final results

Usage: node filtered-best-benchmark.js [options]

Options:
  --warmup <ms>             Warmup duration in ms (default: ${DEFAULT_WARMUP_MS}ms = 3 seconds)
  --super-measurements <N>  Number of super-measurements (default: ${DEFAULT_SUPER_MEASUREMENTS})
  --sub-runs <N>            Sub-runs per super-measurement (default: ${DEFAULT_SUB_RUNS})
  --shapes <N>              Shapes per sub-run (default: ${DEFAULT_SHAPES})
  --cv-threshold <N>        Max CV% to accept measurement (default: ${DEFAULT_CV_THRESHOLD})
  --max-retries <N>         Retries for unstable measurements (default: ${DEFAULT_MAX_RETRIES})
  --cooldown <ms>           Delay between super-measurements (default: ${DEFAULT_COOLDOWN}ms)
  --trim <N>                Trim top/bottom N% for trimmed stats (default: ${DEFAULT_TRIM_PERCENT})
  --output <file>           Write results to JSON file
  --verbose, -v             Show detailed progress
  -h, --help                Show this help

Algorithm:
  1. Time-based warmup (${DEFAULT_WARMUP_MS}ms) to reach thermal steady state
  2. For each super-measurement:
     a. Run ${DEFAULT_SUB_RUNS} sub-measurements
     b. Calculate CV of sub-measurements
     c. If CV > ${DEFAULT_CV_THRESHOLD}%: retry (system was unstable)
     d. If CV <= ${DEFAULT_CV_THRESHOLD}%: take minimum time as result
  3. Apply IQR-based outlier removal to final results
  4. Report both raw and trimmed statistics

Example:
  # Quick test
  node filtered-best-benchmark.js --warmup 2000 --super-measurements 20

  # Full test with output
  node filtered-best-benchmark.js --output /tmp/filtered-bench.json
`);
        process.exit(0);
    }
}

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
 * Calculate statistics for an array of numbers.
 */
function calculateStats(measurements, trimPct = 0) {
    const n = measurements.length;
    if (n === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);

    // Central tendency
    const sum = measurements.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];

    // Dispersion (population stddev for sub-runs, sample stddev for final)
    const variance = measurements.reduce((s, m) => s + Math.pow(m - mean, 2), 0) / n;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? (stddev / mean) * 100 : 0;

    // Sample stddev (n-1) for confidence intervals
    const sampleVariance = n > 1
        ? measurements.reduce((s, m) => s + Math.pow(m - mean, 2), 0) / (n - 1)
        : 0;
    const sampleStddev = Math.sqrt(sampleVariance);
    const sem = n > 1 ? sampleStddev / Math.sqrt(n) : 0;
    const ci95 = 1.96 * sem;

    // Range and percentiles
    const min = sorted[0];
    const max = sorted[n - 1];
    const p5 = sorted[Math.floor(n * 0.05)] || min;
    const p95 = sorted[Math.floor(n * 0.95)] || max;
    const q1 = sorted[Math.floor(n * 0.25)] || min;
    const q3 = sorted[Math.floor(n * 0.75)] || max;
    const iqr = q3 - q1;

    // Trimmed statistics (remove outliers)
    let trimmedMean = mean;
    let trimmedCV = cv;
    let trimmedN = n;
    let outlierCount = 0;

    if (trimPct > 0 && n >= 10) {
        // IQR-based outlier removal
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        const inliers = measurements.filter(m => m >= lowerBound && m <= upperBound);
        outlierCount = n - inliers.length;

        if (inliers.length >= 5) {
            trimmedN = inliers.length;
            const trimmedSum = inliers.reduce((a, b) => a + b, 0);
            trimmedMean = trimmedSum / trimmedN;
            const trimmedVariance = inliers.reduce((s, m) => s + Math.pow(m - trimmedMean, 2), 0) / trimmedN;
            trimmedCV = trimmedMean > 0 ? (Math.sqrt(trimmedVariance) / trimmedMean) * 100 : 0;
        }
    }

    return {
        n, mean, median, stddev, cv, sem, ci95,
        min, max, p5, p95, q1, q3, iqr,
        sampleStddev,
        trimmedMean, trimmedCV, trimmedN, outlierCount
    };
}

/**
 * Detect drift in measurements (thermal throttling).
 * Returns slope of linear regression (ms per measurement).
 */
function detectDrift(measurements) {
    const n = measurements.length;
    if (n < 5) return { slope: 0, driftPercent: 0 };

    // Simple linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += measurements[i];
        sumXY += i * measurements[i];
        sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const meanY = sumY / n;
    const driftPercent = meanY > 0 ? (slope * n / meanY) * 100 : 0;

    return { slope, driftPercent };
}

/**
 * Format a number with locale separators.
 */
function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Format CV with color coding.
 */
function formatCV(cv) {
    const cvStr = cv.toFixed(2) + '%';
    if (cv <= 2) return `\x1b[32m${cvStr}\x1b[0m`;      // Green
    if (cv <= 5) return `\x1b[33m${cvStr}\x1b[0m`;      // Yellow
    return `\x1b[31m${cvStr}\x1b[0m`;                    // Red
}

// ============================================================================
// Measurement Functions
// ============================================================================

/**
 * Perform a single sub-run: render N shapes and return elapsed time.
 */
function measureSubRun(ctx, shapes) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const start = performance.now();
    for (let i = 0; i < shapes; i++) {
        // IDENTICAL operation at IDENTICAL position every time
        // This eliminates all algorithmic variance - only system variance remains
        ctx.fillRect(100, 100, 50, 50);
    }
    return performance.now() - start;
}

/**
 * Perform one super-measurement: multiple sub-runs with stability check.
 */
function measureSuper(ctx, shapes, numSubRuns, threshold) {
    const subMeasurements = [];

    for (let i = 0; i < numSubRuns; i++) {
        const elapsed = measureSubRun(ctx, shapes);
        subMeasurements.push(elapsed);
    }

    // Calculate sub-run statistics
    const stats = calculateStats(subMeasurements);
    const isStable = stats.cv <= threshold;

    return {
        subMeasurements,
        mean: stats.mean,
        min: stats.min,
        max: stats.max,
        cv: stats.cv,
        stable: isStable
    };
}

// ============================================================================
// Main Benchmark
// ============================================================================

function runBenchmark() {
    const benchmarkStartTime = performance.now();

    console.log('\n' + '='.repeat(70));
    console.log('FILTERED BEST BENCHMARK');
    console.log('='.repeat(70));

    console.log('\nConfiguration:');
    console.log(`  Warmup:             ${formatNumber(warmupMs)}ms (time-based)`);
    console.log(`  Super-measurements: ${formatNumber(superMeasurements)}`);
    console.log(`  Sub-runs:           ${subRuns} per super-measurement`);
    console.log(`  Shapes:             ${formatNumber(shapesPerRun)} per sub-run`);
    console.log(`  CV threshold:       ${cvThreshold}%`);
    console.log(`  Max retries:        ${maxRetries}`);
    console.log(`  Cooldown:           ${cooldownMs}ms`);
    console.log(`  Trim outliers:      ${trimPercent}% (IQR-based)`);
    console.log(`  Operation:          fillRect(100, 100, 50, 50) - IDENTICAL every time`);
    console.log('');

    // Create canvas and context
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 128)';

    // ========================================================================
    // Phase 1: Time-based Warmup (reach thermal steady state)
    // ========================================================================

    const phase1Start = performance.now();
    console.log(`Phase 1: Warming up for ${formatNumber(warmupMs)}ms (thermal steady state)...`);
    const warmupStart = performance.now();
    let warmupIterations = 0;

    // Run until time elapsed
    while (performance.now() - warmupStart < warmupMs) {
        // Do batches of 1000 to reduce time checks
        for (let j = 0; j < 1000; j++) {
            ctx.fillRect(100, 100, 50, 50);
        }
        warmupIterations += 1000;
    }

    const warmupTime = performance.now() - warmupStart;
    console.log(`  Done: ${formatNumber(warmupIterations)} iterations in ${warmupTime.toFixed(0)}ms`);
    console.log(`  Rate: ${formatNumber(Math.round(warmupIterations / warmupTime * 1000))} ops/sec`);

    // Brief settle after warmup
    console.log('  Settling (500ms)...');
    busyWait(500);
    const phase1Time = performance.now() - phase1Start;

    // ========================================================================
    // Phase 2: Measurement with Filtering
    // ========================================================================

    const phase2Start = performance.now();
    console.log(`\nPhase 2: Measuring (${superMeasurements} super-measurements)...`);

    const acceptedMeasurements = [];
    const allAttempts = [];  // For comparison stats
    let totalAttempts = 0;
    let totalRetries = 0;
    let maxRetriesReached = 0;

    for (let i = 0; i < superMeasurements; i++) {
        let accepted = false;
        let retries = 0;
        let lastResult = null;

        while (!accepted && retries <= maxRetries) {
            totalAttempts++;
            const result = measureSuper(ctx, shapesPerRun, subRuns, cvThreshold);
            lastResult = result;
            allAttempts.push(result);

            if (result.stable) {
                acceptedMeasurements.push({
                    index: i,
                    bestTime: result.min,
                    meanTime: result.mean,
                    subRunCV: result.cv,
                    subMeasurements: result.subMeasurements,
                    retries
                });
                accepted = true;

                if (verbose) {
                    console.log(`  [${i + 1}/${superMeasurements}] CV: ${result.cv.toFixed(2)}% \x1b[32m✓\x1b[0m (min: ${result.min.toFixed(3)}ms)`);
                } else if ((i + 1) % 10 === 0) {
                    process.stdout.write('.');
                }
            } else {
                retries++;
                totalRetries++;

                if (verbose) {
                    console.log(`  [${i + 1}/${superMeasurements}] CV: ${result.cv.toFixed(2)}% \x1b[31m✗\x1b[0m retry ${retries}/${maxRetries}`);
                }

                // Brief pause before retry
                busyWait(50);
            }
        }

        if (!accepted) {
            // Max retries reached - take the measurement anyway but flag it
            maxRetriesReached++;
            acceptedMeasurements.push({
                index: i,
                bestTime: lastResult.min,
                meanTime: lastResult.mean,
                subRunCV: lastResult.cv,
                subMeasurements: lastResult.subMeasurements,
                retries,
                forced: true  // Flag that this was forced after max retries
            });

            if (verbose) {
                console.log(`  [${i + 1}/${superMeasurements}] CV: ${lastResult.cv.toFixed(2)}% \x1b[33mFORCED\x1b[0m (max retries)`);
            }
        }

        // Cooldown between super-measurements
        if (cooldownMs > 0 && i < superMeasurements - 1) {
            busyWait(cooldownMs);
        }
    }

    if (!verbose) {
        console.log(' done');
    }
    const phase2Time = performance.now() - phase2Start;

    // ========================================================================
    // Phase 3: Analysis
    // ========================================================================

    const phase3Start = performance.now();
    console.log('\nPhase 3: Analysis...');

    // Statistics on filtered minimum times (with trimming)
    const bestTimes = acceptedMeasurements.map(m => m.bestTime);
    const finalStats = calculateStats(bestTimes, trimPercent);

    // Drift detection
    const driftInfo = detectDrift(bestTimes);

    // Statistics on raw mean times (for comparison)
    const allMeans = allAttempts.map(a => a.mean);
    const rawStats = calculateStats(allMeans);

    // Statistics on accepted mean times
    const acceptedMeans = acceptedMeasurements.map(m => m.meanTime);
    const acceptedMeanStats = calculateStats(acceptedMeans);

    // Filtering statistics
    const acceptedCount = acceptedMeasurements.length;
    const rejectedCount = totalAttempts - acceptedCount;
    const rejectionRate = (rejectedCount / totalAttempts) * 100;
    const avgSubRunCV = acceptedMeasurements.reduce((s, m) => s + m.subRunCV, 0) / acceptedCount;
    const forcedCount = acceptedMeasurements.filter(m => m.forced).length;

    // Throughput (use trimmed mean if available)
    const representativeTime = finalStats.trimmedN > 0 ? finalStats.trimmedMean : finalStats.mean;
    const shapesPerSec = (shapesPerRun / representativeTime) * 1000;

    // Assessment (use trimmed CV for evaluation)
    const assessCV = finalStats.trimmedCV > 0 ? finalStats.trimmedCV : finalStats.cv;
    let assessment, assessmentCode;
    if (assessCV <= 2) {
        assessment = 'EXCELLENT - Variance is highly reliable';
        assessmentCode = 'excellent';
    } else if (assessCV <= 3) {
        assessment = 'VERY GOOD - Variance is reliable for benchmarking';
        assessmentCode = 'very_good';
    } else if (assessCV <= 5) {
        assessment = 'ACCEPTABLE - Variance is usable';
        assessmentCode = 'acceptable';
    } else {
        assessment = 'CONCERNING - Variance is still high';
        assessmentCode = 'concerning';
    }

    // ========================================================================
    // Output Results
    // ========================================================================

    console.log('\n' + '='.repeat(70));
    console.log('RESULTS');
    console.log('='.repeat(70));

    console.log('\nFiltering Statistics:');
    console.log(`  Total attempts:         ${totalAttempts}`);
    console.log(`  Accepted:               ${acceptedCount} (${(acceptedCount / totalAttempts * 100).toFixed(1)}%)`);
    console.log(`  Rejected (retried):     ${rejectedCount} (${rejectionRate.toFixed(1)}%)`);
    console.log(`  Forced (max retries):   ${forcedCount}`);
    console.log(`  Avg retries/measure:    ${(totalRetries / superMeasurements).toFixed(2)}`);
    console.log(`  Avg sub-run CV:         ${avgSubRunCV.toFixed(2)}% (among accepted)`);

    console.log('\nRaw Statistics (filtered minimums):');
    console.log(`  N:           ${finalStats.n}`);
    console.log(`  Mean:        ${finalStats.mean.toFixed(4)} ms`);
    console.log(`  Median:      ${finalStats.median.toFixed(4)} ms`);
    console.log(`  StdDev:      ${finalStats.stddev.toFixed(4)} ms`);
    console.log(`  CV:          ${formatCV(finalStats.cv)}`);
    console.log(`  Range:       ${finalStats.min.toFixed(4)} - ${finalStats.max.toFixed(4)} ms`);

    if (finalStats.outlierCount > 0) {
        console.log('\nTrimmed Statistics (IQR outliers removed):');
        console.log(`  Outliers:    ${finalStats.outlierCount} removed`);
        console.log(`  N:           ${finalStats.trimmedN}`);
        console.log(`  Mean:        ${finalStats.trimmedMean.toFixed(4)} ms`);
        console.log(`  CV:          ${formatCV(finalStats.trimmedCV)}`);
    }

    console.log('\nDrift Analysis:');
    const driftDir = driftInfo.slope > 0 ? 'slowing' : 'speeding up';
    const driftColor = Math.abs(driftInfo.driftPercent) > 5 ? '\x1b[33m' : '\x1b[32m';
    console.log(`  Trend:       ${driftColor}${driftInfo.driftPercent.toFixed(1)}% (${driftDir})\x1b[0m`);
    if (Math.abs(driftInfo.driftPercent) > 10) {
        console.log(`  \x1b[33mNote: Significant drift detected - may indicate thermal throttling\x1b[0m`);
    }

    console.log('\nThroughput:');
    console.log(`  Shapes/sec:  ${formatNumber(Math.round(shapesPerSec))}`);

    // Comparison
    const finalCV = finalStats.trimmedCV > 0 ? finalStats.trimmedCV : finalStats.cv;
    const improvement = rawStats.cv > 0
        ? ((rawStats.cv - finalCV) / rawStats.cv) * 100
        : 0;

    console.log('\n' + '-'.repeat(70));
    console.log('COMPARISON');
    console.log('-'.repeat(70));
    console.log(`  Raw (all attempt means):      CV ${formatCV(rawStats.cv)}`);
    console.log(`  Filtered (stable minimums):   CV ${formatCV(finalStats.cv)}`);
    if (finalStats.outlierCount > 0) {
        console.log(`  Trimmed (outliers removed):   CV ${formatCV(finalStats.trimmedCV)}`);
    }
    console.log(`  Improvement vs raw:           ${improvement.toFixed(1)}% reduction`);

    console.log('\n' + '='.repeat(70));
    console.log('ASSESSMENT');
    console.log('='.repeat(70));

    const colorCode = {
        'excellent': '\x1b[32m',
        'very_good': '\x1b[32m',
        'acceptable': '\x1b[33m',
        'concerning': '\x1b[31m'
    };
    console.log(`\n  ${colorCode[assessmentCode]}${assessment}\x1b[0m`);

    // Warnings
    if (rejectionRate > 30) {
        console.log('\n\x1b[33mWARNING: High rejection rate (>' + rejectionRate.toFixed(0) + '%)');
        console.log('  - System may be under heavy load');
        console.log('  - Consider closing background applications');
        console.log('  - Running on AC power may help\x1b[0m');
    }

    if (forcedCount > superMeasurements * 0.1) {
        console.log('\n\x1b[33mWARNING: Many measurements hit max retries');
        console.log('  - System stability is poor');
        console.log('  - Consider increasing --max-retries or --cv-threshold\x1b[0m');
    }

    if (Math.abs(driftInfo.driftPercent) > 15) {
        console.log('\n\x1b[33mWARNING: Significant thermal drift detected');
        console.log('  - Performance changed by ' + Math.abs(driftInfo.driftPercent).toFixed(0) + '% during test');
        console.log('  - Try longer warmup (--warmup 5000) or shorter test');
        console.log('  - Ensure laptop is on AC power and well-ventilated\x1b[0m');
    }

    const phase3Time = performance.now() - phase3Start;
    const totalTime = performance.now() - benchmarkStartTime;

    // ========================================================================
    // Timing Summary
    // ========================================================================

    console.log('\n' + '-'.repeat(70));
    console.log('TIMING');
    console.log('-'.repeat(70));
    console.log(`  Phase 1 (warmup):     ${(phase1Time / 1000).toFixed(1)}s`);
    console.log(`  Phase 2 (measure):    ${(phase2Time / 1000).toFixed(1)}s`);
    console.log(`  Phase 3 (analysis):   ${phase3Time.toFixed(0)}ms`);
    console.log(`  Total:                ${(totalTime / 1000).toFixed(1)}s`);

    console.log('\n' + '='.repeat(70) + '\n');

    // ========================================================================
    // JSON Output
    // ========================================================================

    if (outputFile) {
        const output = {
            timestamp: new Date().toISOString(),
            config: {
                warmupMs,
                warmupIterations,
                superMeasurements,
                subRuns,
                shapesPerRun,
                cvThreshold,
                maxRetries,
                cooldownMs,
                trimPercent,
                canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
                operation: 'fillRect(100, 100, 50, 50)'
            },
            filtering: {
                totalAttempts,
                accepted: acceptedCount,
                rejected: rejectedCount,
                rejectionRate,
                forcedCount,
                avgRetriesPerMeasurement: totalRetries / superMeasurements,
                avgSubRunCV
            },
            statistics: {
                filtered: {
                    n: finalStats.n,
                    mean: finalStats.mean,
                    median: finalStats.median,
                    stddev: finalStats.stddev,
                    cv: finalStats.cv,
                    sem: finalStats.sem,
                    ci95: finalStats.ci95,
                    min: finalStats.min,
                    max: finalStats.max,
                    p5: finalStats.p5,
                    p95: finalStats.p95
                },
                trimmed: {
                    n: finalStats.trimmedN,
                    mean: finalStats.trimmedMean,
                    cv: finalStats.trimmedCV,
                    outlierCount: finalStats.outlierCount
                },
                raw: {
                    n: rawStats.n,
                    mean: rawStats.mean,
                    cv: rawStats.cv
                },
                drift: {
                    slope: driftInfo.slope,
                    driftPercent: driftInfo.driftPercent
                },
                improvementPercent: improvement
            },
            throughput: {
                shapesPerSec: Math.round(shapesPerSec)
            },
            assessment: {
                code: assessmentCode,
                message: assessment,
                evaluatedCV: assessCV
            },
            timing: {
                phase1Ms: phase1Time,
                phase2Ms: phase2Time,
                phase3Ms: phase3Time,
                totalMs: totalTime
            },
            measurements: acceptedMeasurements.map(m => ({
                index: m.index,
                bestTime: m.bestTime,
                meanTime: m.meanTime,
                subRunCV: m.subRunCV,
                retries: m.retries,
                forced: m.forced || false,
                subMeasurements: m.subMeasurements
            }))
        };

        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`Results written to: ${outputFile}\n`);
    }

    return { finalStats, rawStats, improvement, assessmentCode };
}

// ============================================================================
// Run
// ============================================================================

runBenchmark();

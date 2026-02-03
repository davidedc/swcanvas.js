#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED - HISTORICAL REFERENCE ONLY
 *
 * This script was created during the variance investigation phase (Feb 2026).
 * It references code that has been removed:
 * - ThrottleDetector (lib/throttle-detector.js - deleted)
 *
 * The investigation concluded that throttle detection was unreliable (8.84% stddev noise).
 * See PERFORMANCE-BENCHMARKING.md for the new statistical filtering approach.
 *
 * This script will NOT run successfully. Kept for historical reference only.
 *
 * ---
 *
 * Original description:
 *
 * Throttle Stability Test - Investigation Tool
 *
 * Tests whether the throttle detection system is reliable by:
 * 1. Establishing a baseline (same as production)
 * 2. Running 20+ consecutive throttle checks with NO tests in between
 * 3. Analyzing how much "drift" is reported when nothing has changed
 *
 * If the reported drift varies significantly when no real drift has occurred,
 * the throttle detection system is not reliable for correction purposes.
 *
 * Expected results:
 * - Drift stddev < 2%: Reliable throttle detection
 * - Drift stddev 2-5%: Marginal reliability
 * - Drift stddev > 5%: Unreliable - drift correction will add noise
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

// Configuration defaults
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;
const DEFAULT_REFERENCE_ITERATIONS = 5000;  // Match production
const DEFAULT_MEASUREMENT_RUNS = 50;        // Match production --runs
const DEFAULT_NUM_CHECKS = 20;              // How many throttle checks to run

// Parse command line arguments
const args = process.argv.slice(2);
let referenceIterations = DEFAULT_REFERENCE_ITERATIONS;
let measurementRuns = DEFAULT_MEASUREMENT_RUNS;
let numChecks = DEFAULT_NUM_CHECKS;
let outputFile = null;
let verbose = false;
let delayBetweenChecks = 0;  // Optional delay to simulate real session timing

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--iterations' && args[i + 1]) {
        referenceIterations = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--runs' && args[i + 1]) {
        measurementRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--checks' && args[i + 1]) {
        numChecks = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--delay' && args[i + 1]) {
        delayBetweenChecks = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--output' && args[i + 1]) {
        outputFile = args[i + 1];
        i++;
    } else if (arg === '--verbose' || arg === '-v') {
        verbose = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Throttle Stability Test - Investigation Tool

Tests whether the throttle detection system is reliable by running
consecutive throttle checks with NO tests in between.

Usage: node throttle-stability-test.js [options]

Options:
  --iterations <N>  Reference benchmark iterations (default: ${DEFAULT_REFERENCE_ITERATIONS})
  --runs <N>        Measurements per check (default: ${DEFAULT_MEASUREMENT_RUNS})
  --checks <N>      Number of throttle checks (default: ${DEFAULT_NUM_CHECKS})
  --delay <ms>      Delay between checks (default: 0)
  --output <file>   Output JSON to file
  --verbose, -v     Show detailed output per check
  --help, -h        Show this help

Expected drift stddev results:
  < 2%:  RELIABLE - throttle detection is trustworthy
  2-5%:  MARGINAL - some noise in detection
  > 5%:  UNRELIABLE - drift correction will add noise, not remove it
`);
        process.exit(0);
    }
}

/**
 * Run a single reference benchmark (same as ThrottleDetector).
 */
function runReferenceBenchmark() {
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 128)';

    const startTime = performance.now();
    for (let i = 0; i < referenceIterations; i++) {
        const x = (i * 37) % (CANVAS_WIDTH - 50);
        const y = (i * 23) % (CANVAS_HEIGHT - 50);
        ctx.fillRect(x, y, 50, 50);
    }
    const elapsed = performance.now() - startTime;
    return referenceIterations / (elapsed / 1000);  // shapes/sec
}

/**
 * Run multiple measurements and return stats.
 */
function runMeasurementSet() {
    const results = [];
    for (let i = 0; i < measurementRuns; i++) {
        results.push(runReferenceBenchmark());
    }

    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / results.length;
    const cv = Math.sqrt(variance) / mean;

    return {
        mean,
        cv,
        cvPercent: cv * 100,
        results
    };
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        // Busy wait to maintain CPU state
    }
}

/**
 * Main test function.
 */
function runTest() {
    console.log('\n' + '='.repeat(70));
    console.log('THROTTLE STABILITY TEST - Investigation Tool');
    console.log('='.repeat(70));
    console.log(`\nConfiguration:`);
    console.log(`  Reference iterations: ${referenceIterations.toLocaleString()}`);
    console.log(`  Measurements per check: ${measurementRuns}`);
    console.log(`  Number of checks: ${numChecks}`);
    console.log(`  Delay between checks: ${delayBetweenChecks}ms`);
    console.log('');

    // Phase 1: Establish baseline (warmup + measurement)
    console.log('Phase 1: Establishing baseline...');

    // Warmup
    console.log('  Warmup run...');
    runReferenceBenchmark();

    // Baseline measurement
    console.log(`  Measuring baseline (${measurementRuns} runs)...`);
    const baseline = runMeasurementSet();
    console.log(`  Baseline: ${baseline.mean.toFixed(0)} shapes/sec, CV: ${baseline.cvPercent.toFixed(1)}%`);

    // Phase 2: Run consecutive throttle checks
    console.log(`\nPhase 2: Running ${numChecks} consecutive throttle checks...`);
    console.log('  (No tests between checks - drift should be near zero)\n');

    const checks = [];
    for (let check = 0; check < numChecks; check++) {
        if (delayBetweenChecks > 0 && check > 0) {
            sleep(delayBetweenChecks);
        }

        const measurement = runMeasurementSet();
        const drift = (baseline.mean - measurement.mean) / baseline.mean;
        const driftPercent = drift * 100;

        checks.push({
            index: check + 1,
            performance: measurement.mean,
            cv: measurement.cvPercent,
            drift: drift,
            driftPercent: driftPercent
        });

        if (verbose) {
            console.log(`  Check ${check + 1}/${numChecks}: ${measurement.mean.toFixed(0)} shapes/sec, ` +
                `CV: ${measurement.cvPercent.toFixed(1)}%, drift: ${driftPercent >= 0 ? '+' : ''}${driftPercent.toFixed(2)}%`);
        } else {
            process.stdout.write('.');
        }
    }
    if (!verbose) console.log(' done');

    // Phase 3: Analyze drift stability
    console.log('\nPhase 3: Analysis...');

    const driftValues = checks.map(c => c.driftPercent);
    const meanDrift = driftValues.reduce((a, b) => a + b, 0) / driftValues.length;
    const driftVariance = driftValues.reduce((sum, d) => sum + Math.pow(d - meanDrift, 2), 0) / (driftValues.length - 1);
    const driftStddev = Math.sqrt(driftVariance);

    const minDrift = Math.min(...driftValues);
    const maxDrift = Math.max(...driftValues);
    const driftRange = maxDrift - minDrift;

    const perfValues = checks.map(c => c.performance);
    const meanPerf = perfValues.reduce((a, b) => a + b, 0) / perfValues.length;
    const perfVariance = perfValues.reduce((sum, p) => sum + Math.pow(p - meanPerf, 2), 0) / (perfValues.length - 1);
    const perfStddev = Math.sqrt(perfVariance);
    const perfCV = (perfStddev / meanPerf) * 100;

    // Assessment
    let assessment, assessmentCode;
    if (driftStddev < 2) {
        assessment = 'RELIABLE - Throttle detection can be trusted';
        assessmentCode = 'reliable';
    } else if (driftStddev < 5) {
        assessment = 'MARGINAL - Some noise in drift detection';
        assessmentCode = 'marginal';
    } else {
        assessment = 'UNRELIABLE - Drift correction will ADD noise, not remove it';
        assessmentCode = 'unreliable';
    }

    // Output
    console.log('\n' + '='.repeat(70));
    console.log('RESULTS');
    console.log('='.repeat(70));

    console.log('\nBaseline:');
    console.log(`  Performance:   ${baseline.mean.toFixed(0)} shapes/sec`);
    console.log(`  CV:            ${baseline.cvPercent.toFixed(1)}%`);

    console.log('\nThrottle Checks (across all checks):');
    console.log(`  Mean perf:     ${meanPerf.toFixed(0)} shapes/sec`);
    console.log(`  Perf CV:       ${perfCV.toFixed(2)}%`);

    console.log('\nDrift Measurements (key metric):');
    console.log(`  Mean drift:    ${meanDrift >= 0 ? '+' : ''}${meanDrift.toFixed(2)}%`);
    console.log(`  Drift StdDev:  ${driftStddev.toFixed(2)}%`);
    console.log(`  Min drift:     ${minDrift >= 0 ? '+' : ''}${minDrift.toFixed(2)}%`);
    console.log(`  Max drift:     ${maxDrift >= 0 ? '+' : ''}${maxDrift.toFixed(2)}%`);
    console.log(`  Drift range:   ${driftRange.toFixed(2)}%`);

    console.log('\nInterpretation:');
    console.log(`  If CPU was truly stable, drift should be ~0% with very low stddev.`);
    console.log(`  Drift stddev of ${driftStddev.toFixed(2)}% means the throttle detector`);
    console.log(`  could report drift values varying by +/- ${(2 * driftStddev).toFixed(2)}% (2 sigma) due to noise alone.`);

    console.log('\n' + '='.repeat(70));
    console.log('ASSESSMENT');
    console.log('='.repeat(70));

    const colorCode = {
        'reliable': '\x1b[32m',
        'marginal': '\x1b[33m',
        'unreliable': '\x1b[31m'
    };
    console.log(`\n  ${colorCode[assessmentCode]}${assessment}\x1b[0m`);

    // Warnings
    const warnings = [];
    if (Math.abs(meanDrift) > 2) {
        warnings.push(`Mean drift of ${Math.abs(meanDrift).toFixed(1)}% suggests actual thermal change during test`);
    }
    if (driftRange > 10) {
        warnings.push(`Drift range of ${driftRange.toFixed(1)}% indicates highly unstable detection`);
    }
    if (baseline.cvPercent > 10) {
        warnings.push(`High baseline CV (${baseline.cvPercent.toFixed(1)}%) - throttle detector is starting from noisy data`);
    }

    if (warnings.length > 0) {
        console.log('\nWarnings:');
        warnings.forEach(w => console.log(`  - ${w}`));
    }

    // Recommendation
    console.log('\nRecommendation:');
    if (assessmentCode === 'reliable') {
        console.log('  Drift correction can be used safely. The throttle detector provides');
        console.log('  stable measurements that accurately reflect CPU performance changes.');
    } else if (assessmentCode === 'marginal') {
        console.log('  Use drift correction with caution. Consider increasing measurement');
        console.log('  runs or using --skip-outliers to improve stability.');
    } else {
        console.log('  DO NOT use drift correction. The noise in drift detection exceeds');
        console.log('  the correction benefit. Use --no-drift-correction flag instead.');
        console.log('  Focus on improving measurement stability first.');
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // JSON output
    if (outputFile) {
        const output = {
            timestamp: new Date().toISOString(),
            config: {
                referenceIterations,
                measurementRuns,
                numChecks,
                delayBetweenChecks
            },
            baseline: {
                performance: baseline.mean,
                cv: baseline.cvPercent,
                raw: baseline.results
            },
            checks: checks,
            analysis: {
                meanPerformance: meanPerf,
                performanceCV: perfCV,
                meanDriftPercent: meanDrift,
                driftStddevPercent: driftStddev,
                minDriftPercent: minDrift,
                maxDriftPercent: maxDrift,
                driftRangePercent: driftRange
            },
            assessment: {
                code: assessmentCode,
                message: assessment
            },
            warnings
        };

        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`Results written to: ${outputFile}\n`);
    }

    return { assessmentCode, driftStddev };
}

// Run
runTest();

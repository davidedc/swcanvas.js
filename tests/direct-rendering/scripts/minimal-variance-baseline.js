#!/usr/bin/env node
/**
 * Minimal Variance Baseline
 *
 * Measures the theoretical minimum variance by rendering identical
 * rectangles at identical positions. This establishes the noise floor
 * that cannot be reduced through algorithmic changes.
 *
 * Use this to:
 * 1. Establish the variance floor for your system
 * 2. Verify that the measurement environment is stable
 * 3. Compare against actual benchmark variance to identify controllable sources
 *
 * Expected results:
 * - StdDev < 2%: Excellent measurement environment
 * - StdDev 2-5%: Acceptable, some system-level noise
 * - StdDev > 5%: System-level issues (CPU frequency, background processes, thermal)
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

// Configuration
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;
const DEFAULT_SHAPES_PER_RUN = 5000;
const DEFAULT_NUM_RUNS = 100;
const DEFAULT_WARMUP_RUNS = 10;

// Parse command line arguments
const args = process.argv.slice(2);
let shapesPerRun = DEFAULT_SHAPES_PER_RUN;
let numRuns = DEFAULT_NUM_RUNS;
let warmupRuns = DEFAULT_WARMUP_RUNS;
let outputJson = null;
let quiet = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--shapes' && args[i + 1]) {
        shapesPerRun = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--runs' && args[i + 1]) {
        numRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--warmup' && args[i + 1]) {
        warmupRuns = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--output' && args[i + 1]) {
        outputJson = args[i + 1];
        i++;
    } else if (arg === '--quiet' || arg === '-q') {
        quiet = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Minimal Variance Baseline - Establishes the measurement noise floor

Usage: node minimal-variance-baseline.js [options]

Options:
  --shapes <N>      Shapes per measurement run (default: ${DEFAULT_SHAPES_PER_RUN})
  --runs <N>        Number of measurement runs (default: ${DEFAULT_NUM_RUNS})
  --warmup <N>      Number of warmup runs (default: ${DEFAULT_WARMUP_RUNS})
  --output <file>   Output results as JSON to file
  --quiet, -q       Suppress progress output
  --help, -h        Show this help message

The baseline measures variance from:
- Timer resolution
- OS thread scheduling
- CPU frequency variations (non-thermal)
- Memory cache state

This is the FLOOR - any benchmark cannot have variance lower than this baseline.
`);
        process.exit(0);
    }
}

/**
 * Run the minimal variance baseline test.
 * Renders identical rectangles at identical positions to eliminate algorithmic variance.
 */
function runBaseline() {
    const canvas = SWCanvas.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 128)';

    // Warmup phase
    if (!quiet) {
        process.stdout.write(`Warmup (${warmupRuns} runs)...`);
    }
    for (let w = 0; w < warmupRuns; w++) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        for (let i = 0; i < shapesPerRun; i++) {
            ctx.fillRect(100, 100, 50, 50);  // IDENTICAL every time
        }
    }
    if (!quiet) {
        console.log(' done');
    }

    // Measurement phase
    const timings = [];
    if (!quiet) {
        process.stdout.write(`Measuring (${numRuns} runs)...`);
    }

    for (let run = 0; run < numRuns; run++) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const start = performance.now();
        for (let i = 0; i < shapesPerRun; i++) {
            ctx.fillRect(100, 100, 50, 50);  // IDENTICAL every time
        }
        timings.push(performance.now() - start);

        // Progress indicator
        if (!quiet && run % 10 === 0) {
            process.stdout.write('.');
        }
    }
    if (!quiet) {
        console.log(' done');
    }

    // Calculate statistics
    const n = timings.length;
    const mean = timings.reduce((a, b) => a + b, 0) / n;
    const variance = timings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / (n - 1);
    const stddev = Math.sqrt(variance);
    const stddevPercent = (stddev / mean) * 100;
    const shapesPerSec = (shapesPerRun / mean) * 1000;

    // Quartiles
    const sorted = [...timings].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[n - 1];
    const median = n % 2 === 0
        ? (sorted[n/2 - 1] + sorted[n/2]) / 2
        : sorted[Math.floor(n/2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    // Standard error and confidence interval
    const sem = stddev / Math.sqrt(n);
    const tValue = 1.984; // t-value for 95% CI with ~100 df
    const ci95Low = mean - tValue * sem;
    const ci95High = mean + tValue * sem;

    // Assessment
    let assessment;
    let assessmentCode;
    if (stddevPercent <= 2) {
        assessment = 'EXCELLENT - Stable measurement environment';
        assessmentCode = 'excellent';
    } else if (stddevPercent <= 5) {
        assessment = 'ACCEPTABLE - Minor system-level noise';
        assessmentCode = 'acceptable';
    } else if (stddevPercent <= 10) {
        assessment = 'MARGINAL - Significant system-level noise';
        assessmentCode = 'marginal';
    } else {
        assessment = 'POOR - Check CPU frequency scaling, background processes, thermal state';
        assessmentCode = 'poor';
    }

    const results = {
        timestamp: new Date().toISOString(),
        config: {
            shapesPerRun,
            numRuns,
            warmupRuns,
            canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
            testDescription: 'Identical 50x50 rect at (100,100) - no position/parameter variance'
        },
        statistics: {
            n,
            mean,
            median,
            stddev,
            stddevPercent,
            sem,
            semPercent: (sem / mean) * 100,
            ci95: { low: ci95Low, high: ci95High },
            min,
            max,
            q1,
            q3,
            iqr,
            shapesPerSec: Math.round(shapesPerSec)
        },
        assessment: {
            code: assessmentCode,
            message: assessment,
            varianceFloorEstimate: stddevPercent
        },
        raw: timings
    };

    // Output
    if (!quiet) {
        console.log('\n' + '='.repeat(60));
        console.log('MINIMAL VARIANCE BASELINE RESULTS');
        console.log('='.repeat(60));
        console.log(`Configuration: ${numRuns} runs, ${shapesPerRun} shapes/run`);
        console.log('Test: Identical 50x50 rectangle at (100,100)');
        console.log('');
        console.log('Statistics:');
        console.log(`  Mean:     ${mean.toFixed(3)} ms`);
        console.log(`  Median:   ${median.toFixed(3)} ms`);
        console.log(`  StdDev:   ${stddev.toFixed(3)} ms (${stddevPercent.toFixed(2)}%)`);
        console.log(`  SEM:      ${sem.toFixed(3)} ms (${((sem / mean) * 100).toFixed(2)}%)`);
        console.log(`  95% CI:   [${ci95Low.toFixed(3)}, ${ci95High.toFixed(3)}] ms`);
        console.log(`  Range:    [${min.toFixed(3)}, ${max.toFixed(3)}] ms`);
        console.log(`  IQR:      ${iqr.toFixed(3)} ms (Q1=${q1.toFixed(3)}, Q3=${q3.toFixed(3)})`);
        console.log('');
        console.log(`Throughput: ${Math.round(shapesPerSec).toLocaleString()} shapes/sec`);
        console.log('');
        console.log('Assessment:');
        if (assessmentCode === 'excellent') {
            console.log(`  \x1b[32m${assessment}\x1b[0m`);
        } else if (assessmentCode === 'acceptable') {
            console.log(`  \x1b[33m${assessment}\x1b[0m`);
        } else {
            console.log(`  \x1b[31m${assessment}\x1b[0m`);
        }
        console.log('');
        console.log('This variance floor is the MINIMUM achievable.');
        console.log('Benchmark variance above this indicates controllable sources.');
        console.log('='.repeat(60));
    }

    // Write JSON output if requested
    if (outputJson) {
        fs.writeFileSync(outputJson, JSON.stringify(results, null, 2));
        if (!quiet) {
            console.log(`\nResults written to: ${outputJson}`);
        }
    }

    return results;
}

// Run
runBaseline();

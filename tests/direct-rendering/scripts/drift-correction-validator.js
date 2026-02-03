#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED - HISTORICAL REFERENCE ONLY
 *
 * This script was created during the variance investigation phase (Feb 2026).
 * It references code that has been removed:
 * - Statistics.applyDriftCorrection() (removed from lib/statistics.js)
 *
 * The investigation concluded that drift correction was unreliable.
 * See PERFORMANCE-BENCHMARKING.md for the new statistical filtering approach.
 *
 * This script will NOT run successfully. Kept for historical reference only.
 *
 * ---
 *
 * Original description:
 *
 * Drift Correction Validator - Investigation Tool
 *
 * Traces through the drift correction formula step-by-step to validate
 * that the math is correct. This tool helps diagnose issues like the
 * observed "-65.1% correction" problem.
 *
 * The tool:
 * 1. Creates synthetic test data with known drift
 * 2. Traces through the correction calculation
 * 3. Verifies the output matches expectations
 * 4. Can also analyze real benchmark output files
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Load statistics module to test
const Statistics = require('../lib/statistics');

// Parse command line arguments
const args = process.argv.slice(2);
let analyzeFile = null;
let testIndex = null;
let verbose = true;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--analyze' && args[i + 1]) {
        analyzeFile = args[i + 1];
        i++;
    } else if (arg === '--test-index' && args[i + 1]) {
        testIndex = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Drift Correction Validator - Investigation Tool

Validates the drift correction formula by tracing through the math.

Usage: node drift-correction-validator.js [options]

Options:
  --analyze <file>    Analyze a benchmark output JSON file
  --test-index <N>    Focus on a specific test index (with --analyze)
  --help, -h          Show this help

Without options, runs synthetic validation tests.

With --analyze, examines real benchmark results to understand why
corrections may appear incorrect.
`);
        process.exit(0);
    }
}

/**
 * Test case 1: No drift - correction should have no effect
 */
function testNoDrift() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: No Drift (correction should be 1.0)');
    console.log('='.repeat(60));

    const measurements = [10, 10.1, 9.9, 10.05, 9.95];  // ~10ms average
    const testIdx = 5;
    const timeline = [
        { testIndex: 0, drift: 0 },
        { testIndex: 10, drift: 0 }
    ];

    console.log('\nInputs:');
    console.log(`  measurements: [${measurements.join(', ')}] ms`);
    console.log(`  testIndex: ${testIdx}`);
    console.log(`  timeline: testIndex 0 drift=0, testIndex 10 drift=0`);

    const result = Statistics.applyDriftCorrection(measurements, testIdx, timeline);

    console.log('\nResult:');
    console.log(`  interpolatedDrift: ${result.interpolatedDrift} (${result.interpolatedDriftPercent}%)`);
    console.log(`  correctionFactor: ${result.correctionFactor}`);
    console.log(`  corrected: [${result.corrected.map(v => v.toFixed(4)).join(', ')}] ms`);

    const pass = result.correctionFactor === 1.0;
    console.log(`\n  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: correctionFactor should be 1.0`);

    return pass;
}

/**
 * Test case 2: Positive drift (CPU throttled) - times should be reduced
 */
function testPositiveDrift() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Positive Drift (CPU throttled, times should reduce)');
    console.log('='.repeat(60));

    // If CPU is 10% slower, times are 11.1% longer
    // Expected: correction reduces times by ~10% to get baseline-equivalent
    const measurements = [11.11, 11.05, 11.15];  // ~11.1ms (throttled)
    const testIdx = 5;
    const timeline = [
        { testIndex: 0, drift: 0.10 },   // 10% drift at start
        { testIndex: 10, drift: 0.10 }   // 10% drift at end
    ];

    console.log('\nScenario:');
    console.log('  CPU is 10% slower (drift = 0.10)');
    console.log('  If baseline would be 10ms, throttled = 10ms / 0.9 = 11.11ms');
    console.log('  Correction should bring times back to ~10ms');

    console.log('\nInputs:');
    console.log(`  measurements: [${measurements.join(', ')}] ms`);
    console.log(`  testIndex: ${testIdx}`);
    console.log(`  timeline: testIndex 0 drift=0.10, testIndex 10 drift=0.10`);

    const result = Statistics.applyDriftCorrection(measurements, testIdx, timeline);

    console.log('\nResult:');
    console.log(`  interpolatedDrift: ${result.interpolatedDrift} (${result.interpolatedDriftPercent}%)`);
    console.log(`  correctionFactor: ${result.correctionFactor}`);
    console.log(`  corrected: [${result.corrected.map(v => v.toFixed(4)).join(', ')}] ms`);

    // Expected: correctionFactor = 1 - 0.10 = 0.90
    // Corrected times = 11.11 * 0.90 = 10.0
    const expectedFactor = 0.90;
    const expectedCorrected = 10.0;
    const actualFactor = result.correctionFactor;
    const actualCorrected = result.corrected[0];

    console.log('\nValidation:');
    console.log(`  Expected correctionFactor: ${expectedFactor}`);
    console.log(`  Actual correctionFactor: ${actualFactor}`);
    console.log(`  Expected corrected time: ~${expectedCorrected} ms`);
    console.log(`  Actual corrected time: ${actualCorrected.toFixed(2)} ms`);

    const passF = Math.abs(actualFactor - expectedFactor) < 0.001;
    const passT = Math.abs(actualCorrected - expectedCorrected) < 0.5;

    console.log(`\n  ${passF ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: correctionFactor = ${expectedFactor}`);
    console.log(`  ${passT ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: corrected time ~${expectedCorrected}ms`);

    // Now verify shapes/sec calculation
    console.log('\nShapes/sec implications:');
    const shapesPerRun = 500;
    const rawShapesPerSec = (shapesPerRun / 11.11) * 1000;
    const correctedShapesPerSec = (shapesPerRun / actualCorrected) * 1000;
    const changePct = ((correctedShapesPerSec - rawShapesPerSec) / rawShapesPerSec) * 100;

    console.log(`  Raw shapes/sec: ${rawShapesPerSec.toFixed(0)}`);
    console.log(`  Corrected shapes/sec: ${correctedShapesPerSec.toFixed(0)}`);
    console.log(`  Change: ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`);

    const passS = changePct > 0;  // Corrected should be HIGHER
    console.log(`\n  ${passS ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: Corrected shapes/sec should be HIGHER than raw`);

    return passF && passT && passS;
}

/**
 * Test case 3: Negative drift - should refuse to correct
 */
function testNegativeDrift() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Negative Drift (impossible, should refuse correction)');
    console.log('='.repeat(60));

    const measurements = [10, 10.1, 9.9];
    const testIdx = 5;
    const timeline = [
        { testIndex: 0, drift: -0.10 },   // Negative drift (impossible)
        { testIndex: 10, drift: -0.10 }
    ];

    console.log('\nScenario:');
    console.log('  Negative drift means CPU appears FASTER than baseline');
    console.log('  This is physically impossible for thermal throttling');
    console.log('  Should refuse to correct and flag as unreliable');

    const result = Statistics.applyDriftCorrection(measurements, testIdx, timeline);

    console.log('\nResult:');
    console.log(`  interpolatedDrift: ${result.interpolatedDrift} (${result.interpolatedDriftPercent}%)`);
    console.log(`  correctionFactor: ${result.correctionFactor}`);
    console.log(`  unreliable: ${result.unreliable}`);
    console.log(`  reason: ${result.reason || 'none'}`);

    const pass = result.unreliable === true && result.correctionFactor === 1.0;
    console.log(`\n  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: Should flag as unreliable with factor 1.0`);

    return pass;
}

/**
 * Test case 4: Linear interpolation between checkpoints
 */
function testInterpolation() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Linear Interpolation Between Checkpoints');
    console.log('='.repeat(60));

    const measurements = [10, 10, 10];
    const testIdx = 5;  // Halfway between 0 and 10
    const timeline = [
        { testIndex: 0, drift: 0 },      // No drift at start
        { testIndex: 10, drift: 0.20 }   // 20% drift at end
    ];

    console.log('\nScenario:');
    console.log('  Drift goes from 0% at testIndex 0 to 20% at testIndex 10');
    console.log('  At testIndex 5 (halfway), should interpolate to 10%');

    const result = Statistics.applyDriftCorrection(measurements, testIdx, timeline);

    console.log('\nResult:');
    console.log(`  interpolatedDrift: ${result.interpolatedDrift} (${result.interpolatedDriftPercent}%)`);
    console.log(`  correctionFactor: ${result.correctionFactor}`);

    const expectedDrift = 0.10;
    const expectedFactor = 0.90;

    const passD = Math.abs(result.interpolatedDrift - expectedDrift) < 0.001;
    const passF = Math.abs(result.correctionFactor - expectedFactor) < 0.001;

    console.log(`\n  ${passD ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: Interpolated drift should be 10%`);
    console.log(`  ${passF ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: Correction factor should be 0.90`);

    return passD && passF;
}

/**
 * Test case 5: High drift - should refuse correction
 */
function testHighDrift() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 5: High Drift (>25%, should refuse correction)');
    console.log('='.repeat(60));

    const measurements = [10, 10, 10];
    const testIdx = 5;
    const timeline = [
        { testIndex: 0, drift: 0.30 },   // 30% drift
        { testIndex: 10, drift: 0.30 }
    ];

    console.log('\nScenario:');
    console.log('  Drift of 30% exceeds the 25% reliability threshold');
    console.log('  Should refuse to correct');

    const result = Statistics.applyDriftCorrection(measurements, testIdx, timeline);

    console.log('\nResult:');
    console.log(`  interpolatedDrift: ${result.interpolatedDrift} (${result.interpolatedDriftPercent}%)`);
    console.log(`  unreliable: ${result.unreliable}`);
    console.log(`  reason: ${result.reason || 'none'}`);

    const pass = result.unreliable === true;
    console.log(`\n  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}: Should flag as unreliable`);

    return pass;
}

/**
 * Analyze a real benchmark output file.
 */
function analyzeRealFile(filePath, focusTestIndex) {
    console.log('\n' + '='.repeat(60));
    console.log('ANALYZING REAL BENCHMARK FILE');
    console.log('='.repeat(60));
    console.log(`\nFile: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        return false;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!data.throttling || !data.throttling.timeline) {
        console.log('\nNo throttle timeline found in file.');
        return true;
    }

    const timeline = data.throttling.timeline;
    console.log(`\nThrottle Timeline (${timeline.length} checkpoints):`);
    timeline.forEach((t, i) => {
        const drift = t.drift !== undefined ? t.drift : 0;
        console.log(`  ${i}: testIndex ${t.testIndex}, drift ${(drift * 100).toFixed(2)}%`);
    });

    // Find tests with drift correction
    const correctedTests = data.results.filter(r =>
        r.statistics && r.statistics.driftCorrection && r.statistics.driftCorrection.applied
    );

    console.log(`\nTests with drift correction: ${correctedTests.length}`);

    if (focusTestIndex !== null) {
        const test = data.results[focusTestIndex];
        if (!test) {
            console.error(`Test index ${focusTestIndex} not found`);
            return false;
        }
        analyzeTestResult(test, timeline, focusTestIndex);
    } else {
        // Find tests with unusual corrections
        const unusualTests = data.results.filter((r, idx) => {
            if (!r.correctedShapesPerSec) return false;
            const changePct = ((r.correctedShapesPerSec - r.shapesPerSec) / r.shapesPerSec) * 100;
            return changePct < -5;  // Corrected is significantly LOWER (suspicious)
        });

        if (unusualTests.length > 0) {
            console.log(`\nUnusual corrections (corrected < raw) found: ${unusualTests.length}`);
            unusualTests.slice(0, 3).forEach((test, i) => {
                const idx = data.results.indexOf(test);
                console.log(`\n--- Test ${idx}: ${test.name} ---`);
                analyzeTestResult(test, timeline, idx);
            });
        } else {
            console.log('\nNo unusual corrections found.');
        }
    }

    return true;
}

/**
 * Analyze a single test result.
 */
function analyzeTestResult(test, timeline, testIndex) {
    console.log(`  Raw shapes/sec: ${test.shapesPerSec}`);
    console.log(`  Corrected shapes/sec: ${test.correctedShapesPerSec || 'N/A'}`);

    if (test.correctedShapesPerSec) {
        const changePct = ((test.correctedShapesPerSec - test.shapesPerSec) / test.shapesPerSec) * 100;
        console.log(`  Change: ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`);

        if (changePct < 0) {
            console.log(`\n  \x1b[31mWARNING: Corrected value is LOWER than raw!\x1b[0m`);
            console.log('  This should only happen with negative drift (which should be rejected)');
        }
    }

    if (test.statistics && test.statistics.driftCorrection) {
        const dc = test.statistics.driftCorrection;
        console.log(`  Correction factor: ${dc.factor}`);
        console.log(`  Interpolated drift: ${dc.interpolatedDriftPercent}%`);

        // Verify the math
        const rawMean = test.statistics.mean;
        const correctedMean = test.statistics.correctedMean;
        const expectedCorrectedMean = rawMean * dc.factor;

        console.log(`\n  Verification:`);
        console.log(`    Raw mean: ${rawMean.toFixed(4)} ms`);
        console.log(`    Expected corrected mean: ${expectedCorrectedMean.toFixed(4)} ms`);
        console.log(`    Actual corrected mean: ${correctedMean ? correctedMean.toFixed(4) : 'N/A'} ms`);
    }

    // Manually re-run drift correction
    if (test.statistics && test.statistics.raw) {
        console.log('\n  Re-running drift correction:');
        const reResult = Statistics.applyDriftCorrection(
            test.statistics.raw,
            testIndex,
            timeline
        );
        console.log(`    Interpolated drift: ${reResult.interpolatedDriftPercent.toFixed(2)}%`);
        console.log(`    Correction factor: ${reResult.correctionFactor.toFixed(4)}`);
        console.log(`    Unreliable: ${reResult.unreliable || false}`);
        if (reResult.reason) {
            console.log(`    Reason: ${reResult.reason}`);
        }
    }
}

// Main
console.log('\n' + '='.repeat(60));
console.log('DRIFT CORRECTION VALIDATOR');
console.log('='.repeat(60));

if (analyzeFile) {
    analyzeRealFile(analyzeFile, testIndex);
} else {
    // Run synthetic tests
    const results = [];
    results.push(testNoDrift());
    results.push(testPositiveDrift());
    results.push(testNegativeDrift());
    results.push(testInterpolation());
    results.push(testHighDrift());

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    if (passed === total) {
        console.log(`\n  \x1b[32mAll ${total} tests passed!\x1b[0m`);
        console.log('\n  The drift correction formula is mathematically correct.');
        console.log('  If you see unexpected corrections in real benchmarks,');
        console.log('  the issue is likely in the drift MEASUREMENT, not the correction.');
    } else {
        console.log(`\n  \x1b[31m${passed}/${total} tests passed\x1b[0m`);
        console.log('\n  The drift correction formula has bugs.');
    }

    console.log('\n  To analyze real benchmark results:');
    console.log('    node drift-correction-validator.js --analyze <benchmark.json>');
    console.log('\n' + '='.repeat(60) + '\n');
}

#!/usr/bin/env node
/**
 * Direct Rendering Test Runner for SWCanvas
 *
 * Runs direct shape API tests and verifies direct rendering is used.
 */

const fs = require('fs');
const path = require('path');

// Check for --debug flag BEFORE loading SWCanvas (must be first)
const debugMode = process.argv.includes('--debug') || process.argv.includes('-d');
if (debugMode) {
    globalThis.__SWCANVAS_DEBUG__ = true;
    console.log('[Debug mode enabled - assertions active]');
}

// Load SWCanvas (after debug flag is set)
const SWCanvas = require('../../dist/swcanvas.js');

// Load test utilities
const {
    DIRECT_RENDERING_TESTS,
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
    calculateLineTestParameters,
    // Bounds calculation utilities
    calculateCircleBounds,
    calculateStrokedCircleBounds,
    calculateRectangleBounds,
    calculateFillRectBounds,
    calculateCrispStrokeRectBounds,
    calculateLineBounds,
    aggregateBounds,
    registerDirectRenderingTest,
    clampBoundsToCanvas,
    analyzeExtremes,
    detectBackgroundColor,
    countUniqueColors,
    countUniqueColorsInMiddleRow,
    countUniqueColorsInMiddleColumn,
    countSpeckles,
    hasSpeckles,
    runValidationChecks
} = require('./direct-rendering-test-utils.js');

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
global.calculateLineTestParameters = calculateLineTestParameters;
// Bounds calculation utilities
global.calculateCircleBounds = calculateCircleBounds;
global.calculateStrokedCircleBounds = calculateStrokedCircleBounds;
global.calculateRectangleBounds = calculateRectangleBounds;
global.calculateFillRectBounds = calculateFillRectBounds;
global.calculateCrispStrokeRectBounds = calculateCrispStrokeRectBounds;
global.calculateLineBounds = calculateLineBounds;
global.aggregateBounds = aggregateBounds;
global.registerDirectRenderingTest = registerDirectRenderingTest;
global.countUniqueColorsInMiddleRow = countUniqueColorsInMiddleRow;
global.countUniqueColorsInMiddleColumn = countUniqueColorsInMiddleColumn;
global.countSpeckles = countSpeckles;

// Parse command line arguments
const args = process.argv.slice(2);
let numIterations = 1;
let startIteration = 1;
let testFilter = null;
let showLogs = false;
let listOnly = false;

// Help text
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Direct Rendering Test Runner

Usage: npm run test:direct-rendering -- [options]

Options:
  -t, --test=<filter>     Filter tests by name substring
  -i, --iterations=<N>    Number of iterations to run (default: 1)
  -s, --start=<N>         Starting iteration number (default: 1)
  -l, --logs              Show test logs (verbose output)
  -d, --debug             Enable debug assertions (validates clipping contracts)
  --list                  List matched tests without running them
  -h, --help              Show this help message

Examples:
  npm run test:direct-rendering -- -t roundrect -i 1
    Run 1 iteration of all roundrect tests

  npm run test:direct-rendering -- -t circle -s 10 -i 1
    Run only iteration 10 of circle tests

  npm run test:direct-rendering -- -t circle -s 10 -i 1 -l
    Run only iteration 10 of circle tests with logs

  npm run test:direct-rendering -- -s 100 -i 5
    Run iterations 100-104 of all tests
`);
    process.exit(0);
}

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--iterations=')) {
        numIterations = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-i' && args[i + 1]) {
        numIterations = parseInt(args[i + 1], 10);
        i++; // Skip next arg
    } else if (arg.startsWith('--test=')) {
        testFilter = arg.split('=')[1];
    } else if (arg === '-t' && args[i + 1]) {
        testFilter = args[i + 1];
        i++; // Skip next arg
    } else if (arg.startsWith('--start=')) {
        startIteration = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-s' && args[i + 1]) {
        startIteration = parseInt(args[i + 1], 10);
        i++; // Skip next arg
    } else if (arg === '--logs' || arg === '-l') {
        showLogs = true;
    } else if (arg === '--list') {
        listOnly = true;
    }
}

if (isNaN(numIterations) || numIterations < 1) {
    numIterations = 1;
}
if (isNaN(startIteration) || startIteration < 1) {
    startIteration = 1;
}

// Test results
let passed = 0;
let failed = 0;
let warnings = 0;
const failures = [];
const knownFailures = [];

/**
 * Run a single test
 */
function runTest(test, iterationNumber = 1) {
    const { name, drawFunction, category, checks, metadata } = test;

    // Create canvas
    const canvas = SWCanvas.createCanvas(400, 300);
    const ctx = canvas.getContext('2d');

    // Add canvas reference for drawFunction
    ctx.canvas = canvas;

    // NOTE: No background fill - canvas starts transparent (alpha=0)
    // This matches browser test runner behavior for consistent gap detection.
    // The validation checks alpha=0 to detect gaps between fill and stroke.

    // Seed random for reproducibility - different seed per iteration
    SeededRandom.seedWithInteger(12345 + iterationNumber - 1);

    // Reset path-based rendering flag
    SWCanvas.Core.Context2D.resetPathBasedFlag();

    // Run the test's draw function
    let result;
    try {
        result = drawFunction(ctx, iterationNumber, null);
    } catch (e) {
        failed++;
        failures.push({
            name,
            title: metadata?.title,
            reason: `Exception during draw: ${e.message}`,
            iteration: iterationNumber
        });
        return false;
    }

    // Display test logs if enabled
    if (showLogs && result && result.logs && result.logs.length > 0) {
        console.log('  Test Logs:');
        result.logs.forEach(log => console.log(`    ${log}`));
    }

    // Check if direct rendering was used (this is the critical check)
    const pathBasedUsed = SWCanvas.Core.Context2D.wasPathBasedUsed();

    // Get surface for validation
    const surface = canvas._coreSurface;

    // Validate checks
    let testPassed = true;
    const issues = [];
    const knownFailureIssues = [];

    // Direct rendering check (unless explicitly allowed path-based)
    if (!checks.allowPathBasedRendering && pathBasedUsed) {
        testPassed = false;
        issues.push('Path-based rendering was used instead of direct rendering');
    }

    // Extremes check - compare SWCanvas rendered bounds vs checkData
    const checkData = result && result.checkData;
    if (checks.extremes && checkData) {
        const backgroundColor = detectBackgroundColor(surface);
        const swExtremes = analyzeExtremes(surface, backgroundColor, 0, 0);

        // Validate checkData has required bounds
        if (checkData.topY === undefined || checkData.bottomY === undefined ||
            checkData.leftX === undefined || checkData.rightX === undefined) {
            issues.push(`Extremes check enabled but checkData missing bounds`);
            testPassed = false;
        } else {
            // Clamp checkData to canvas bounds
            const expectedBounds = clampBoundsToCanvas(checkData, surface.width, surface.height);

            // Exact match required - SWCanvas has no anti-aliasing
            const boundsMatch =
                swExtremes.topY === expectedBounds.topY &&
                swExtremes.bottomY === expectedBounds.bottomY &&
                swExtremes.leftX === expectedBounds.leftX &&
                swExtremes.rightX === expectedBounds.rightX;

            if (!boundsMatch) {
                issues.push(`Extremes mismatch: ` +
                    `SW=[T:${swExtremes.topY} B:${swExtremes.bottomY} L:${swExtremes.leftX} R:${swExtremes.rightX}] ` +
                    `Expected=[T:${expectedBounds.topY} B:${expectedBounds.bottomY} L:${expectedBounds.leftX} R:${expectedBounds.rightX}]`);
                testPassed = false;
            }
        }
    } else if (checks.extremes && !checkData) {
        issues.push('Extremes check enabled but test returned no checkData');
        testPassed = false;
    }

    // Run shared validation checks (color counts, speckles, etc.)
    const validationResult = runValidationChecks(surface, checks, iterationNumber);
    if (!validationResult.passed) {
        testPassed = false;
        issues.push(...validationResult.issues);
    }
    knownFailureIssues.push(...validationResult.knownFailureIssues);

    if (testPassed && knownFailureIssues.length === 0) {
        passed++;
        console.log(`  \x1b[32m\u2713\x1b[0m ${name}`);
    } else if (testPassed && knownFailureIssues.length > 0) {
        // Passed but has known failures - show as warning
        passed++;
        warnings++;
        knownFailures.push({ name, title: metadata?.title, reason: knownFailureIssues.join('; '), iteration: iterationNumber });
        console.log(`  \x1b[33m\u26A0\x1b[0m ${name}`);
        knownFailureIssues.forEach(issue => console.log(`    - ${issue}`));
    } else {
        failed++;
        failures.push({ name, title: metadata?.title, reason: issues.join('; '), iteration: iterationNumber });
        console.log(`  \x1b[31m\u2717\x1b[0m ${name}`);
        issues.forEach(issue => console.log(`    - ${issue}`));
    }

    return testPassed;
}

/**
 * Load all test case files
 */
function loadTestCases() {
    const casesDir = path.join(__dirname, 'cases');

    if (!fs.existsSync(casesDir)) {
        console.log('No test cases directory found. Creating sample tests...');
        return;
    }

    const files = fs.readdirSync(casesDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
        try {
            require(path.join(casesDir, file));
        } catch (e) {
            console.error(`Error loading test case ${file}: ${e.message}`);
        }
    }
}

/**
 * Main entry point
 */
function main() {
    console.log('\n=== Direct Rendering Tests ===\n');

    // Load test case files
    loadTestCases();

    if (DIRECT_RENDERING_TESTS.length === 0) {
        console.log('No direct rendering tests registered.');
        console.log('Create test files in tests/direct-rendering/cases/');
        return;
    }

    // Filter tests if -t specified
    let testsToRun = DIRECT_RENDERING_TESTS;
    if (testFilter) {
        testsToRun = DIRECT_RENDERING_TESTS.filter(test =>
            test.name.includes(testFilter)
        );
        if (testsToRun.length === 0) {
            console.log(`No tests match filter: "${testFilter}"`);
            console.log('Available tests:');
            DIRECT_RENDERING_TESTS.forEach(t => console.log(`  - ${t.name}`));
            process.exit(1);
        }
        console.log(`Filter "${testFilter}" matched ${testsToRun.length} test(s)\n`);
    }

    // List mode - just show tests without running
    if (listOnly) {
        console.log(`\nMatched ${testsToRun.length} test(s):\n`);
        testsToRun.forEach((test, i) => {
            console.log(`  ${i + 1}. ${test.name}`);
        });
        console.log(`\nTotal: ${testsToRun.length} tests`);
        process.exit(0);
    }

    const totalRuns = testsToRun.length * numIterations;
    const endIteration = startIteration + numIterations - 1;
    if (startIteration > 1) {
        console.log(`Running ${testsToRun.length} tests x ${numIterations} iteration${numIterations > 1 ? 's' : ''} (${startIteration}-${endIteration}) = ${totalRuns} total runs...\n`);
    } else {
        console.log(`Running ${testsToRun.length} tests x ${numIterations} iteration${numIterations > 1 ? 's' : ''} = ${totalRuns} total runs...\n`);
    }

    // Group by category
    const categories = {};
    for (const test of testsToRun) {
        const cat = test.category || 'uncategorized';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(test);
    }

    // Run tests by category for each iteration
    for (let iter = startIteration; iter <= endIteration; iter++) {
        if (numIterations > 1) {
            console.log(`\n--- Iteration ${iter}/${endIteration} ---`);
        }

        for (const [category, tests] of Object.entries(categories)) {
            console.log(`\n${category.toUpperCase()}:`);
            for (const test of tests) {
                runTest(test, iter);
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed, ${warnings} warnings`);

    // Always list failures if any
    if (failed > 0) {
        console.log('\nFailed tests:');
        for (const { name, title, reason, iteration } of failures) {
            console.log(`  - ${name}${title ? ` (${title})` : ''} [iter ${iteration}]: ${reason}`);
        }
    }

    // Always list warnings if any
    if (knownFailures.length > 0) {
        console.log('\nWarnings (known failures, not blocking):');
        for (const { name, title, reason, iteration } of knownFailures) {
            console.log(`  - ${name}${title ? ` (${title})` : ''} [iter ${iteration}]: ${reason}`);
        }
    }

    if (failed > 0) {
        process.exit(1);
    } else {
        console.log('\n\x1b[32mAll direct rendering tests passed!\x1b[0m');
        process.exit(0);
    }
}

main();

#!/usr/bin/env node
/**
 * Generates a deterministic snapshot of all test positioning and checkData (logs and bounds).
 * Used to verify refactoring doesn't change any calculations.
 *
 * Usage: node generate-logs-and-bounds-snapshot.js [iterations] [--save-json]
 *
 * Options:
 *   iterations   Number of iterations per test (default: 100)
 *   --save-json  Also save full JSON data (WARNING: large files for high iterations)
 *
 * Examples:
 *   node generate-logs-and-bounds-snapshot.js 10 --save-json   # Quick debug with full data
 *   node generate-logs-and-bounds-snapshot.js 100 --save-json  # Standard run with data for debugging
 *   node generate-logs-and-bounds-snapshot.js 1000             # Full coverage, hashes only (recommended)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const saveJson = args.includes('--save-json');
const iterationsArg = args.find(arg => !arg.startsWith('--'));
const iterations = parseInt(iterationsArg) || 100;

// Load test utilities and expose as globals (test files expect this)
const testUtilsPath = path.join(__dirname, 'direct-rendering-test-utils.js');
const utils = require(testUtilsPath);

// Expose utilities as globals (test files use them without require)
global.DIRECT_RENDERING_TESTS = utils.DIRECT_RENDERING_TESTS;
global.DIRECT_RENDERING_PERF_REGISTRY = utils.DIRECT_RENDERING_PERF_REGISTRY;
global.SeededRandom = utils.SeededRandom;
global.getRandomColor = utils.getRandomColor;
global.getRandomOpaqueColor = utils.getRandomOpaqueColor;
global.getRandomOpaqueVisibleColor = utils.getRandomOpaqueVisibleColor;
global.getRandomPoint = utils.getRandomPoint;
global.placeCloseToCenterAtPixel = utils.placeCloseToCenterAtPixel;
global.placeCloseToCenterAtGrid = utils.placeCloseToCenterAtGrid;
global.adjustDimensionsForCrispStrokeRendering = utils.adjustDimensionsForCrispStrokeRendering;
global.roundPoint = utils.roundPoint;
global.ensureHalfPoint = utils.ensureHalfPoint;
global.adjustCenterForCrispStrokeRendering = utils.adjustCenterForCrispStrokeRendering;
global.calculateCrispFillAndStrokeRectParams = utils.calculateCrispFillAndStrokeRectParams;
global.calculateCircleTestParameters = utils.calculateCircleTestParameters;
global.calculateArcTestParameters = utils.calculateArcTestParameters;
global.calculate90DegFillStrokeArcParams = utils.calculate90DegFillStrokeArcParams;
global.generateConstrainedArcAngles = utils.generateConstrainedArcAngles;
global.calculateLineTestParameters = utils.calculateLineTestParameters;
global.calculateCircleBounds = utils.calculateCircleBounds;
global.calculateRectangleBounds = utils.calculateRectangleBounds;
global.calculateCrispStrokeRectBounds = utils.calculateCrispStrokeRectBounds;
global.calculateLineBounds = utils.calculateLineBounds;
global.aggregateBounds = utils.aggregateBounds;
global.registerDirectRenderingTest = utils.registerDirectRenderingTest;
global.clampBoundsToCanvas = utils.clampBoundsToCanvas;
global.analyzeExtremes = utils.analyzeExtremes;
global.PERF_SIZE_CATEGORIES = utils.PERF_SIZE_CATEGORIES;
global.getStrokeWidthFromCategory = utils.getStrokeWidthFromCategory;
global.getShapeSizeFromCategory = utils.getShapeSizeFromCategory;
global.getRadiusFromShapeCategory = utils.getRadiusFromShapeCategory;
global.getArcAngleFromCategory = utils.getArcAngleFromCategory;

// Load all test files
const casesDir = path.join(__dirname, 'cases');
const testFiles = fs.readdirSync(casesDir).filter(f => f.endsWith('-test.js'));

console.log(`Loading ${testFiles.length} test files...`);
for (const file of testFiles) {
    require(path.join(casesDir, file));
}

const { DIRECT_RENDERING_TESTS, SeededRandom } = utils;

console.log(`Found ${DIRECT_RENDERING_TESTS.length} registered tests`);
console.log(`Generating snapshot with ${iterations} iterations per test...`);
console.log(`Mode: ${saveJson ? 'Full JSON data' : 'Hashes only'}`);

// Create a mock context that captures drawing parameters
function createMockContext(width = 800, height = 600) {
    return {
        canvas: { width, height },
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        globalAlpha: 1,
        // Mock methods that tests might call - covers SWCanvas direct API
        fillCircle: () => {},
        strokeCircle: () => {},
        fillStrokeCircle: () => {},
        fillArc: () => {},
        strokeArc: () => {},
        fillStrokeArc: () => {},
        outerStrokeArc: () => {},
        fillOuterStrokeArc: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillStrokeRect: () => {},
        fillRoundRect: () => {},
        strokeRoundRect: () => {},
        fillStrokeRoundRect: () => {},
        strokeLine: () => {},
        // Standard Canvas API
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        clearRect: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
        putImageData: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        rect: () => {},
        quadraticCurveTo: () => {},
        bezierCurveTo: () => {},
        arcTo: () => {},
        ellipse: () => {},
        setTransform: () => {},
        resetTransform: () => {},
        clip: () => {},
        isPointInPath: () => false,
        isPointInStroke: () => false
    };
}

const snapshot = {
    generated: new Date().toISOString(),
    iterations: iterations,
    hasJsonData: saveJson,
    tests: {}
};

let processedCount = 0;

for (const test of DIRECT_RENDERING_TESTS) {
    const testData = [];

    for (let i = 1; i <= iterations; i++) {
        SeededRandom.seedWithInteger(i);
        const mockCtx = createMockContext();

        try {
            // Call the draw function (instances = null for visual mode)
            const result = test.drawFunction(mockCtx, i, null);

            if (result && result.checkData) {
                testData.push({
                    iteration: i,
                    checkData: result.checkData,
                    logs: result.logs || []
                });
            }
        } catch (error) {
            // Some tests might fail without proper context, skip them
            console.warn(`  Warning: Test "${test.name}" iteration ${i} threw: ${error.message}`);
        }
    }

    // Per-test hash (always computed)
    const testHash = crypto.createHash('sha256')
        .update(JSON.stringify(testData))
        .digest('hex')
        .substring(0, 16);

    snapshot.tests[test.name] = {
        hash: testHash,
        iterationsWithData: testData.length,
        // Only include full data if --save-json flag is set
        ...(saveJson && { data: testData })
    };

    processedCount++;
    if (processedCount % 10 === 0) {
        process.stdout.write(`\rProcessed ${processedCount}/${DIRECT_RENDERING_TESTS.length} tests...`);
    }
}

console.log(`\rProcessed ${processedCount}/${DIRECT_RENDERING_TESTS.length} tests.    `);

// Overall hash
const overallHash = crypto.createHash('sha256')
    .update(JSON.stringify(Object.fromEntries(
        Object.entries(snapshot.tests).map(([k, v]) => [k, v.hash])
    )))
    .digest('hex')
    .substring(0, 16);

snapshot.overallHash = overallHash;

// Save snapshot
const filename = saveJson ? 'snapshot-full.json' : 'snapshot-hashes.json';
const outputPath = path.join(__dirname, filename);
fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));

console.log(`\nSnapshot generated successfully!`);
console.log(`  Tests: ${Object.keys(snapshot.tests).length}`);
console.log(`  Iterations per test: ${iterations}`);
console.log(`  Mode: ${saveJson ? 'Full JSON data' : 'Hashes only'}`);
console.log(`  Overall hash: ${overallHash}`);
console.log(`  Saved to: ${filename}`);

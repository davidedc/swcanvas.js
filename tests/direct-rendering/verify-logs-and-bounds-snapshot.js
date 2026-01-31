#!/usr/bin/env node
/**
 * Verifies current test output matches the golden snapshot (logs and bounds).
 * Exit code 0 = match, 1 = mismatch
 *
 * Usage: node verify-logs-and-bounds-snapshot.js [snapshot-file]
 *
 * If a full JSON snapshot is provided, shows detailed diff on mismatch.
 * If a hashes-only snapshot is provided, just reports which tests differ.
 *
 * Examples:
 *   node verify-logs-and-bounds-snapshot.js                           # Uses default golden-hashes-100.json
 *   node verify-logs-and-bounds-snapshot.js snapshot-full.json        # Uses full JSON snapshot for detailed diff
 *   node verify-logs-and-bounds-snapshot.js golden-hashes-1000.json   # Uses 1000-iteration snapshot
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Parse arguments
const snapshotFile = process.argv[2] || 'golden-hashes-100.json';
const snapshotPath = path.join(__dirname, snapshotFile);

if (!fs.existsSync(snapshotPath)) {
    console.error(`Error: Snapshot file not found: ${snapshotPath}`);
    console.error(`\nTo create a golden snapshot, run:`);
    console.error(`  node generate-logs-and-bounds-snapshot.js 100`);
    console.error(`  cp snapshot-hashes.json golden-hashes-100.json`);
    process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
console.log(`Verifying against snapshot: ${snapshotFile}`);
console.log(`  Generated: ${snapshot.generated}`);
console.log(`  Iterations: ${snapshot.iterations}`);
console.log(`  Has full JSON data: ${snapshot.hasJsonData || false}`);
console.log();

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

for (const file of testFiles) {
    require(path.join(casesDir, file));
}

const { DIRECT_RENDERING_TESTS, SeededRandom } = utils;

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

// Generate current data for comparison
function generateCurrentData() {
    const currentData = { tests: {} };
    const iterations = snapshot.iterations;

    for (const test of DIRECT_RENDERING_TESTS) {
        const testData = [];

        for (let i = 1; i <= iterations; i++) {
            SeededRandom.seedWithInteger(i);
            const mockCtx = createMockContext();

            try {
                const result = test.drawFunction(mockCtx, i, null);

                if (result && result.checkData) {
                    testData.push({
                        iteration: i,
                        checkData: result.checkData,
                        logs: result.logs || []
                    });
                }
            } catch (error) {
                // Skip errors
            }
        }

        const testHash = crypto.createHash('sha256')
            .update(JSON.stringify(testData))
            .digest('hex')
            .substring(0, 16);

        currentData.tests[test.name] = {
            hash: testHash,
            data: testData
        };
    }

    return currentData;
}

console.log(`Generating current test data with ${snapshot.iterations} iterations...`);
const currentData = generateCurrentData();
console.log();

// Compare
let failures = 0;
let matched = 0;
let missing = 0;

for (const [testName, expected] of Object.entries(snapshot.tests)) {
    const actual = currentData.tests[testName];

    if (!actual) {
        console.error(`MISSING: ${testName} (test not found in current codebase)`);
        missing++;
        continue;
    }

    if (expected.hash !== actual.hash) {
        console.error(`MISMATCH: ${testName}`);
        console.error(`  Expected hash: ${expected.hash}`);
        console.error(`  Actual hash:   ${actual.hash}`);

        // If full JSON data is available in snapshot, show the first difference
        if (expected.data && actual.data) {
            for (let i = 0; i < Math.max(expected.data.length, actual.data.length); i++) {
                const exp = expected.data[i];
                const act = actual.data[i];

                if (!exp || !act) {
                    console.error(`  Data length differs: expected ${expected.data.length}, got ${actual.data.length}`);
                    break;
                }

                if (JSON.stringify(exp.checkData) !== JSON.stringify(act.checkData)) {
                    console.error(`  First diff at iteration ${exp.iteration}:`);
                    console.error(`    Expected checkData: ${JSON.stringify(exp.checkData)}`);
                    console.error(`    Actual checkData:   ${JSON.stringify(act.checkData)}`);
                    break;
                }
            }
        } else {
            console.error(`  (Run with --save-json snapshot for detailed diff)`);
        }
        console.error();
        failures++;
    } else {
        matched++;
    }
}

// Check for new tests not in snapshot
for (const testName of Object.keys(currentData.tests)) {
    if (!snapshot.tests[testName]) {
        console.log(`NEW: ${testName} (not in snapshot)`);
    }
}

console.log();
console.log('='.repeat(60));

if (failures === 0 && missing === 0) {
    console.log(`SUCCESS: All ${matched} tests match!`);
    console.log(`Overall hash: ${snapshot.overallHash}`);
    process.exit(0);
} else {
    console.error(`FAILED: ${failures} mismatch(es), ${missing} missing`);
    console.error(`        ${matched} test(s) matched`);
    process.exit(1);
}

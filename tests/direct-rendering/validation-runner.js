/**
 * Validation Runner
 *
 * Main entry point for running all validation checks on a surface.
 * Dispatches to appropriate validation functions based on check configuration.
 *
 * @module validation-runner
 */

// Node.js: import dependencies (browser uses window globals at call time)
let _nodeCountUniqueColors, _nodeCountUniqueColorsInMiddleRow, _nodeCountUniqueColorsInMiddleColumn;
let _nodeCountSpeckles, _nodeHasSpeckles, _nodeCheckDimensionConsistency, _nodeGetAdjustedExpectedColorCount;
let _nodeCheck1pxClosedStrokeContinuity, _nodeCheckShapeIntegrity;

if (typeof module !== 'undefined' && module.exports) {
    const surfaceAnalysis = require('./surface-analysis.js');
    const strokeContinuity = require('./stroke-continuity-1px.js');
    const shapeIntegrityChecker = require('./shape-integrity-checker.js');

    _nodeCountUniqueColors = surfaceAnalysis.countUniqueColors;
    _nodeCountUniqueColorsInMiddleRow = surfaceAnalysis.countUniqueColorsInMiddleRow;
    _nodeCountUniqueColorsInMiddleColumn = surfaceAnalysis.countUniqueColorsInMiddleColumn;
    _nodeCountSpeckles = surfaceAnalysis.countSpeckles;
    _nodeHasSpeckles = surfaceAnalysis.hasSpeckles;
    _nodeCheckDimensionConsistency = surfaceAnalysis.checkDimensionConsistency;
    _nodeGetAdjustedExpectedColorCount = surfaceAnalysis.getAdjustedExpectedColorCount;
    _nodeCheck1pxClosedStrokeContinuity = strokeContinuity.check1pxClosedStrokeContinuity;
    _nodeCheckShapeIntegrity = shapeIntegrityChecker.checkShapeIntegrity;
}

/**
 * Run all validation checks on a surface
 * Shared between Node.js and browser test runners for consistency.
 * @param {Object} surface - Surface with data, width, height, stride
 * @param {Object} checks - Checks configuration from test
 * @param {number} iterationNumber - Current iteration number (for skipOnIterations support)
 * @returns {Object} { passed: boolean, issues: string[], knownFailureIssues: string[] }
 */
function runValidationChecks(surface, checks, iterationNumber = 0) {
    const issues = [];
    const knownFailureIssues = [];

    // In browser, get dependencies from window at call time (all scripts loaded by then)
    const _countUniqueColors = _nodeCountUniqueColors || (typeof window !== 'undefined' && window.countUniqueColors);
    const _countUniqueColorsInMiddleRow = _nodeCountUniqueColorsInMiddleRow || (typeof window !== 'undefined' && window.countUniqueColorsInMiddleRow);
    const _countUniqueColorsInMiddleColumn = _nodeCountUniqueColorsInMiddleColumn || (typeof window !== 'undefined' && window.countUniqueColorsInMiddleColumn);
    const _countSpeckles = _nodeCountSpeckles || (typeof window !== 'undefined' && window.countSpeckles);
    const _hasSpeckles = _nodeHasSpeckles || (typeof window !== 'undefined' && window.hasSpeckles);
    const _checkDimensionConsistency = _nodeCheckDimensionConsistency || (typeof window !== 'undefined' && window.checkDimensionConsistency);
    const _getAdjustedExpectedColorCount = _nodeGetAdjustedExpectedColorCount || (typeof window !== 'undefined' && window.getAdjustedExpectedColorCount);
    const _check1pxClosedStrokeContinuity = _nodeCheck1pxClosedStrokeContinuity || (typeof window !== 'undefined' && window.check1pxClosedStrokeContinuity);
    const _checkShapeIntegrity = _nodeCheckShapeIntegrity || (typeof window !== 'undefined' && window.checkShapeIntegrity);

    // Total unique colors check (exactly N)
    if (checks.totalUniqueColors) {
        const isObject = typeof checks.totalUniqueColors === 'object';
        const expected = isObject ? checks.totalUniqueColors.expected : checks.totalUniqueColors;
        const skipIterations = (isObject && checks.totalUniqueColors.skipOnIterations) || [];

        if (!skipIterations.includes(iterationNumber)) {
            const actual = _countUniqueColors(surface);
            if (actual !== expected) {
                issues.push(`Unique colors: expected exactly ${expected}, got ${actual}`);
            }
        }
    }

    // Max unique colors check (at most N)
    if (checks.maxUniqueColors) {
        const actual = _countUniqueColors(surface);
        if (actual > checks.maxUniqueColors) {
            issues.push(`Unique colors: ${actual} exceeds maximum of ${checks.maxUniqueColors}`);
        }
    }

    // Middle row unique colors
    if (checks.uniqueColors && checks.uniqueColors.middleRow) {
        const skipIterations = checks.uniqueColors.middleRow.skipOnIterations || [];
        if (!skipIterations.includes(iterationNumber)) {
            const expected = _getAdjustedExpectedColorCount(checks.uniqueColors.middleRow.count, surface);
            const actual = _countUniqueColorsInMiddleRow(surface);
            if (actual !== expected) {
                issues.push(`Middle row unique colors: ${actual} (expected ${expected})`);
            }
        }
    }

    // Middle column unique colors
    if (checks.uniqueColors && checks.uniqueColors.middleColumn) {
        const skipIterations = checks.uniqueColors.middleColumn.skipOnIterations || [];
        if (!skipIterations.includes(iterationNumber)) {
            const expected = _getAdjustedExpectedColorCount(checks.uniqueColors.middleColumn.count, surface);
            const actual = _countUniqueColorsInMiddleColumn(surface);
            if (actual !== expected) {
                issues.push(`Middle column unique colors: ${actual} (expected ${expected})`);
            }
        }
    }

    // Speckle checks
    if (checks.speckles === true || (checks.speckles && typeof checks.speckles === 'object')) {
        const skipIterations = (typeof checks.speckles === 'object' && checks.speckles.skipOnIterations) || [];

        if (!skipIterations.includes(iterationNumber)) {
            const expected = (typeof checks.speckles === 'object' && checks.speckles.expected !== undefined)
                ? checks.speckles.expected : 0;
            const maxSpeckles = typeof checks.speckles === 'object' ? checks.speckles.maxSpeckles : undefined;
            const isKnownFailure = typeof checks.speckles === 'object' && checks.speckles.knownFailure === true;
            const speckleResult = _countSpeckles(surface);
            const speckleCount = speckleResult.count;

            const speckleCheckPassed = maxSpeckles !== undefined
                ? speckleCount <= maxSpeckles
                : speckleCount === expected;

            if (!speckleCheckPassed) {
                const firstInfo = speckleResult.firstSpeckle
                    ? ` (first at ${speckleResult.firstSpeckle.x},${speckleResult.firstSpeckle.y})`
                    : '';
                const expectedMsg = maxSpeckles !== undefined ? `≤${maxSpeckles}` : `${expected}`;
                const message = `Speckle count: ${speckleCount} (expected ${expectedMsg})${firstInfo}`;
                if (isKnownFailure) {
                    knownFailureIssues.push(message + ' [KNOWN]');
                } else {
                    issues.push(message);
                }
            }
        }
    } else if (checks.noSpeckles === true || checks.speckles === false) {
        if (_hasSpeckles(surface)) {
            issues.push('Unexpected speckles found');
        }
    }

    // Dimension consistency check (stroke width/height uniformity)
    if (checks.dimensionConsistency) {
        const result = _checkDimensionConsistency(surface);
        if (!result.widthConsistent || !result.heightConsistent) {
            issues.push(...result.issues);
        }
    }

    // 1px closed stroke 8-connectivity check
    // Config: stroke8Connectivity: { color: [r, g, b], tolerance?: number }
    // A continuous 1px stroke has every pixel with at least 2 neighbors (8-connectivity)
    // Pixels with 0 or 1 neighbors indicate gaps/discontinuities
    // NOTE: This check only works for 1px strokes.
    if (checks.stroke8Connectivity) {
        const config = checks.stroke8Connectivity;
        const [r, g, b] = config.color;
        const tolerance = config.tolerance || 0;
        const isKnownFailure = config.knownFailure === true;

        const result = _check1pxClosedStrokeContinuity(surface, r, g, b, tolerance);

        if (!result.continuous) {
            const firstGap = result.gaps[0];
            const firstInfo = firstGap
                ? ` (first at ${firstGap.x},${firstGap.y} with ${firstGap.neighbors} neighbor(s))`
                : '';
            const message = `Stroke 8-connectivity: ${result.gaps.length} pixel(s) with <2 neighbors${firstInfo}`;
            if (isKnownFailure) {
                knownFailureIssues.push(message + ' [KNOWN]');
            } else {
                issues.push(message);
            }
        }
    }

    // Shape integrity check (universal: stroke-only, fill-only, or fill+stroke)
    // Config: shapeIntegrity: true | { hasStroke?, hasFill?, verticalScan?, horizontalScan?,
    //         strokeColor?, fillColor?, colorTolerance?, knownFailure?, skipOnIterations? }
    // NOTE: Only works for closed convex shapes (circles, rectangles, rounded rects)
    if (checks.shapeIntegrity) {
        const config = typeof checks.shapeIntegrity === 'object'
            ? checks.shapeIntegrity
            : {};
        const isKnownFailure = config.knownFailure === true;
        const skipIterations = config.skipOnIterations || [];

        if (!skipIterations.includes(iterationNumber)) {
            const result = _checkShapeIntegrity(surface, {
                hasStroke: config.hasStroke !== false,
                hasFill: config.hasFill === true,
                verticalScan: config.verticalScan !== false,
                horizontalScan: config.horizontalScan !== false,
                strokeColor: config.strokeColor,
                fillColor: config.fillColor,
                colorTolerance: config.colorTolerance
            });

            if (!result.valid) {
                // Use appropriate label based on mode
                const hasStroke = config.hasStroke !== false;
                const hasFill = config.hasFill === true;
                let label;
                if (hasStroke && hasFill) {
                    label = 'Shape Boundary';
                } else if (hasStroke) {
                    label = 'Stroke Continuity';
                } else {
                    label = 'Fill Continuity';
                }

                for (const issue of result.issues) {
                    const message = `${label}: ${issue}`;
                    if (isKnownFailure) {
                        knownFailureIssues.push(message + ' [KNOWN]');
                    } else {
                        issues.push(message);
                    }
                }
            }
        }
    }

    return {
        passed: issues.length === 0,
        issues,
        knownFailureIssues
    };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runValidationChecks
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.runValidationChecks = runValidationChecks;
}

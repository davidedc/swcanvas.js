#!/usr/bin/env node
/**
 * Rendering Efficiency Analysis (Proximity-to-Optimal)
 *
 * Measures how close each shape renderer is to the theoretical performance floor
 * established by rect-AA regression. Rect-AA is the fastest possible renderer
 * that performs the same pixel work (fill, blend, clip) - it has zero per-scanline
 * shape computation, just straight span writes.
 *
 * The proximity metric:
 *   floor = a + b * estimated_pixels    (from rect-AA regression)
 *   proximity = floor / actual_time
 *
 *   proximity = 1.0  → at theoretical floor (no room to improve)
 *   proximity = 0.5  → 2x above floor (50% of time is shape overhead)
 *   proximity < 0.3  → significant optimization opportunity
 *
 * Usage:
 *   node analyze-efficiency.js --input <benchmark.json>
 *   node analyze-efficiency.js --input <benchmark.json> --format json --output <out.json>
 *   node analyze-efficiency.js --input <benchmark.json> --filter-shape circle
 *   node analyze-efficiency.js --before <before.json> --after <after.json>
 *
 * Options:
 *   --input <file>          Benchmark JSON from benchmark-session.js (required unless --before/--after)
 *   --before <file>         Before benchmark JSON (for comparison mode)
 *   --after <file>          After benchmark JSON (for comparison mode)
 *   --format <fmt>          Output format: console (default) or json
 *   --output <file>         Output file for JSON format
 *   --filter-shape <name>   Filter to specific shape prefix (e.g., circle, arc, rect-rot)
 *   --filter-op <op>        Filter to specific operation (e.g., fill-opaque, stroke-semi)
 *   --filter-size <sz>      Filter to specific size category (e.g., szM, szL)
 *   --min-r2 <value>        Minimum R² for regression validity (default: 0.90)
 *   -h, --help              Show help
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Import size category definitions
const { PERF_SIZE_CATEGORIES } = require('../performance-size-categories');

// Import statistics for before/after comparison
const Statistics = require('../lib/statistics');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const args = process.argv.slice(2);

let inputFile = null;
let beforeFile = null;
let afterFile = null;
let outputFormat = 'console';
let outputFile = null;
let filterShape = null;
let filterOp = null;
let filterSize = null;
let minR2 = 0.90;

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Rendering Efficiency Analysis (Proximity-to-Optimal)

Measures how close each shape renderer is to the theoretical performance
floor established by rect-AA regression.

Usage:
  node analyze-efficiency.js --input <benchmark.json> [options]
  node analyze-efficiency.js --before <a.json> --after <b.json> [options]

Options:
  --input <file>          Benchmark JSON from benchmark-session.js
  --before <file>         Before benchmark JSON (comparison mode)
  --after <file>          After benchmark JSON (comparison mode)
  --format <fmt>          Output format: console (default) or json
  --output <file>         Output file for JSON format
  --filter-shape <name>   Filter to shape prefix (circle, arc, rect-rot, etc.)
  --filter-op <op>        Filter to operation (fill-opaque, stroke-semi, etc.)
  --filter-size <sz>      Filter to size category (szM, szL, etc.)
  --min-r2 <value>        Minimum R² for regression validity (default: 0.90)
  -h, --help              Show this help

Proximity interpretation:
  > 70%    Near optimal, diminishing returns from further optimization
  40-70%   Moderate overhead, worth investigating if hot path
  < 40%    Significant algorithmic overhead, likely worth optimizing

Examples:
  # Basic analysis
  node analyze-efficiency.js --input results/benchmark.json

  # JSON output
  node analyze-efficiency.js --input results/benchmark.json \\
    --format json --output results/efficiency.json

  # Filter to circles only
  node analyze-efficiency.js --input results/benchmark.json \\
    --filter-shape circle

  # Before/after comparison
  node analyze-efficiency.js \\
    --before results/before.json \\
    --after results/after.json
`);
    process.exit(0);
}

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' && args[i + 1]) { inputFile = args[++i]; }
    else if (arg.startsWith('--input=')) { inputFile = arg.split('=').slice(1).join('='); }
    else if (arg === '--before' && args[i + 1]) { beforeFile = args[++i]; }
    else if (arg.startsWith('--before=')) { beforeFile = arg.split('=').slice(1).join('='); }
    else if (arg === '--after' && args[i + 1]) { afterFile = args[++i]; }
    else if (arg.startsWith('--after=')) { afterFile = arg.split('=').slice(1).join('='); }
    else if (arg === '--format' && args[i + 1]) { outputFormat = args[++i]; }
    else if (arg.startsWith('--format=')) { outputFormat = arg.split('=').slice(1).join('='); }
    else if (arg === '--output' && args[i + 1]) { outputFile = args[++i]; }
    else if (arg.startsWith('--output=')) { outputFile = arg.split('=').slice(1).join('='); }
    else if (arg === '--filter-shape' && args[i + 1]) { filterShape = args[++i]; }
    else if (arg.startsWith('--filter-shape=')) { filterShape = arg.split('=').slice(1).join('='); }
    else if (arg === '--filter-op' && args[i + 1]) { filterOp = args[++i]; }
    else if (arg.startsWith('--filter-op=')) { filterOp = arg.split('=').slice(1).join('='); }
    else if (arg === '--filter-size' && args[i + 1]) { filterSize = args[++i]; }
    else if (arg.startsWith('--filter-size=')) { filterSize = arg.split('=').slice(1).join('='); }
    else if (arg === '--min-r2' && args[i + 1]) { minR2 = parseFloat(args[++i]); }
    else if (arg.startsWith('--min-r2=')) { minR2 = parseFloat(arg.split('=')[1]); }
}

// Validate arguments
const isComparisonMode = beforeFile && afterFile;
if (!inputFile && !isComparisonMode) {
    console.error('Error: --input <file> is required (or use --before/--after for comparison)');
    console.error('Use --help for usage information');
    process.exit(1);
}

// ============================================================================
// Pixel Estimation
// ============================================================================

/**
 * Expected value of size² for a uniform bracket [min, max].
 * E[X²] for X ~ Uniform(min, max) = (min² + min*max + max²) / 3
 */
function bracketExpectedSquare(bracket) {
    const { min, max } = bracket;
    return (min * min + min * max + max * max) / 3;
}

/**
 * E[1/ar] for ar ~ Uniform(0.5, 2.0) = ln(4) / 1.5 ≈ 0.924
 * Rect tests use aspectRatio = 0.5 + random * 1.5, so ar ~ Uniform(0.5, 2.0)
 * height = size / ar, so area = size * size / ar
 * E[area] = E[size²] * E[1/ar]
 */
const E_INV_AR = Math.log(4) / 1.5; // ≈ 0.924

/**
 * Estimate pixel count for a rect-AA fill test.
 * Area = size * (size / aspectRatio), with stratified sampling over the bracket.
 */
function estimateRectFillPixels(sizeBracket) {
    return bracketExpectedSquare(sizeBracket) * E_INV_AR;
}

/**
 * Estimate pixel count for a rect-AA stroke test.
 * Perimeter ≈ 2 * (width + height) = 2 * size * (1 + 1/ar)
 * E[perimeter] = 2 * E[size] * (1 + E[1/ar])
 * Stroke pixels ≈ perimeter * strokeWidth
 */
function estimateRectStrokePixels(sizeBracket, strokeBracket) {
    const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
    const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
    const avgPerimeter = 2 * avgSize * (1 + E_INV_AR);
    return avgPerimeter * avgStroke;
}

/**
 * Estimate pixel count for a rect-AA 1px stroke test.
 * Perimeter only, no stroke width multiplication.
 */
function estimateRect1pxStrokePixels(sizeBracket) {
    const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
    return 2 * avgSize * (1 + E_INV_AR);
}

/**
 * Estimate pixel count for a rect-AA fill+stroke test.
 * Sum of fill area and stroke perimeter band.
 */
function estimateRectFillStrokePixels(sizeBracket, strokeBracket) {
    return estimateRectFillPixels(sizeBracket) +
           estimateRectStrokePixels(sizeBracket, strokeBracket);
}

/**
 * Estimate pixel count for a rect-AA fill+1px stroke test.
 */
function estimateRectFill1pxStrokePixels(sizeBracket) {
    return estimateRectFillPixels(sizeBracket) +
           estimateRect1pxStrokePixels(sizeBracket);
}

// Shape-specific pixel estimators
const SHAPE_PIXEL_ESTIMATORS = {
    // Circle fill: π * (d/2)²
    'circle-fill': (sizeBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        return Math.PI * (avgDiameter / 2) ** 2;
    },

    // Circle 1px stroke: π * d (Bresenham traces full circumference)
    'circle-stroke-1px': (sizeBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        return Math.PI * avgDiameter;
    },

    // Circle thick stroke: annular ring ≈ π * d * strokeWidth
    'circle-stroke-thick': (sizeBracket, strokeBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        return Math.PI * avgDiameter * avgStroke;
    },

    // Circle fill+1px stroke: fill area + circumference
    'circle-fillstroke-1px': (sizeBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        return Math.PI * (avgDiameter / 2) ** 2 + Math.PI * avgDiameter;
    },

    // Circle fill+thick stroke: fill area + annular ring
    'circle-fillstroke-thick': (sizeBracket, strokeBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        return Math.PI * (avgDiameter / 2) ** 2 + Math.PI * avgDiameter * avgStroke;
    },

    // Arc fill: fraction of circle area
    'arc-fill': (sizeBracket, _strokeBracket, angleBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        const avgAngle = (angleBracket.min + angleBracket.max) / 2;
        return (avgAngle / 360) * Math.PI * (avgDiameter / 2) ** 2;
    },

    // Arc 1px stroke: FULL circumference (Bresenham traces entire circle, angle-checks each pixel)
    'arc-stroke-1px': (sizeBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        return Math.PI * avgDiameter; // NOT angle-scaled
    },

    // Arc thick stroke: fraction of annular ring
    'arc-stroke-thick': (sizeBracket, strokeBracket, angleBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        const avgAngle = (angleBracket.min + angleBracket.max) / 2;
        return (avgAngle / 360) * Math.PI * avgDiameter * avgStroke;
    },

    // Arc fill+1px stroke: arc fill + full circumference
    'arc-fillstroke-1px': (sizeBracket, _strokeBracket, angleBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        const avgAngle = (angleBracket.min + angleBracket.max) / 2;
        return (avgAngle / 360) * Math.PI * (avgDiameter / 2) ** 2 + Math.PI * avgDiameter;
    },

    // Arc fill+thick stroke: arc fill + arc stroke ring
    'arc-fillstroke-thick': (sizeBracket, strokeBracket, angleBracket) => {
        const avgDiameter = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        const avgAngle = (angleBracket.min + angleBracket.max) / 2;
        return (avgAngle / 360) * Math.PI * (avgDiameter / 2) ** 2 +
               (avgAngle / 360) * Math.PI * avgDiameter * avgStroke;
    },

    // Rect rotated fill: same area as AA rect
    'rect-rot-fill': (sizeBracket) => {
        return bracketExpectedSquare(sizeBracket) * E_INV_AR;
    },

    // Rect rotated 1px stroke: same perimeter as AA rect
    'rect-rot-stroke-1px': (sizeBracket) => {
        const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
        return 2 * avgSize * (1 + E_INV_AR);
    },

    // Rect rotated thick stroke
    'rect-rot-stroke-thick': (sizeBracket, strokeBracket) => {
        const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        return 2 * avgSize * (1 + E_INV_AR) * avgStroke;
    },

    // Rect rotated fill+stroke
    'rect-rot-fillstroke-1px': (sizeBracket) => {
        return bracketExpectedSquare(sizeBracket) * E_INV_AR +
               2 * ((sizeBracket.min + sizeBracket.max) / 2) * (1 + E_INV_AR);
    },
    'rect-rot-fillstroke-thick': (sizeBracket, strokeBracket) => {
        const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        return bracketExpectedSquare(sizeBracket) * E_INV_AR +
               2 * avgSize * (1 + E_INV_AR) * avgStroke;
    },

    // RoundRect fill: rect area minus corner adjustment
    'roundrect-fill': (sizeBracket) => {
        const area = bracketExpectedSquare(sizeBracket) * E_INV_AR;
        const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
        // Corner radius is 10-30% of min dimension; approximate as 20% of size
        const cr = avgSize * 0.2;
        return area - (4 - Math.PI) * cr * cr;
    },

    // RoundRect 1px stroke: perimeter similar to rect
    'roundrect-stroke-1px': (sizeBracket) => {
        const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
        return 2 * avgSize * (1 + E_INV_AR);
    },

    // RoundRect thick stroke
    'roundrect-stroke-thick': (sizeBracket, strokeBracket) => {
        const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        return 2 * avgSize * (1 + E_INV_AR) * avgStroke;
    },

    // RoundRect fill+stroke
    'roundrect-fillstroke-1px': (sizeBracket) => {
        const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
        const cr = avgSize * 0.2;
        return bracketExpectedSquare(sizeBracket) * E_INV_AR - (4 - Math.PI) * cr * cr +
               2 * avgSize * (1 + E_INV_AR);
    },
    'roundrect-fillstroke-thick': (sizeBracket, strokeBracket) => {
        const avgSize = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        const cr = avgSize * 0.2;
        return bracketExpectedSquare(sizeBracket) * E_INV_AR - (4 - Math.PI) * cr * cr +
               2 * avgSize * (1 + E_INV_AR) * avgStroke;
    },

    // Line stroke: length * strokeWidth
    'line-stroke-thick': (sizeBracket, strokeBracket) => {
        const avgLength = (sizeBracket.min + sizeBracket.max) / 2;
        const avgStroke = (strokeBracket.min + strokeBracket.max) / 2;
        return avgLength * avgStroke;
    },

    // Line 1px: just the length
    'line-stroke-1px': (sizeBracket) => {
        return (sizeBracket.min + sizeBracket.max) / 2;
    }
};

// ============================================================================
// Test ID Parsing
// ============================================================================

/**
 * Parse a benchmark test ID into its components.
 * Test IDs follow the pattern: <baseId>-<strokeKey>-<sizeKey>[-<angleKey>]-<operation>
 *
 * Examples:
 *   rect-aa-perf-sw0-szM-fill-opaque
 *   circle-perf-sw1px-szL-stroke-semi
 *   arc-perf-swM-szM-angS-fill-opaque-stroke-semi
 *   line-horiz-perf-sw1px-szM-stroke-opaque
 */
function parseTestId(id) {
    // Known base IDs (order matters: longer prefixes first)
    const BASE_IDS = [
        'roundrect-rot-perf',
        'roundrect-aa-perf',
        'line-horiz-perf',
        'line-vert-perf',
        'line-diag-perf',
        'rect-rot-perf',
        'rect-aa-perf',
        'circle-perf',
        'arc-perf'
    ];

    let baseId = null;
    let rest = id;

    for (const prefix of BASE_IDS) {
        if (id.startsWith(prefix + '-')) {
            baseId = prefix;
            rest = id.slice(prefix.length + 1);
            break;
        }
    }

    if (!baseId) return null;

    // Split remaining parts
    const parts = rest.split('-');

    // Extract stroke key (starts with 'sw')
    const strokeKey = parts.shift();
    if (!strokeKey || !strokeKey.startsWith('sw')) return null;

    // Extract size key (starts with 'sz')
    const sizeKey = parts.shift();
    if (!sizeKey || !sizeKey.startsWith('sz')) return null;

    // Check for angle key (starts with 'ang')
    let angleKey = null;
    if (parts.length > 0 && parts[0].startsWith('ang')) {
        angleKey = parts.shift();
    }

    // Remaining parts form the operation
    const operation = parts.join('-');

    return { baseId, strokeKey, sizeKey, angleKey, operation };
}

/**
 * Determine the shape family from a base test ID.
 */
function getShapeFamily(baseId) {
    if (baseId === 'rect-aa-perf') return 'rect-aa';
    if (baseId === 'rect-rot-perf') return 'rect-rot';
    if (baseId === 'roundrect-aa-perf') return 'roundrect-aa';
    if (baseId === 'roundrect-rot-perf') return 'roundrect-rot';
    if (baseId === 'circle-perf') return 'circle';
    if (baseId === 'arc-perf') return 'arc';
    if (baseId.startsWith('line-')) return baseId.replace('-perf', '');
    return baseId;
}

/**
 * Classify the pixel operation type for floor regression selection.
 * Returns a key like 'fill-opaq', 'stroke-1px-semi', 'fillstroke-thick-opaq-semi', etc.
 */
function classifyOperation(operation, strokeKey) {
    const is1px = strokeKey === 'sw1px';
    const isThick = !is1px && strokeKey !== 'sw0';

    // Parse operation components
    const hasFill = operation.startsWith('fill');
    const hasStroke = operation.includes('stroke');
    const fillSemi = operation.includes('fill-semi');
    const strokeSemi = operation.endsWith('stroke-semi') || operation.includes('stroke-semi');

    if (hasFill && !hasStroke) {
        return fillSemi ? 'fill-semi' : 'fill-opaq';
    }

    if (hasStroke && !hasFill) {
        const opacity = strokeSemi ? 'semi' : 'opaq';
        if (is1px) return `stroke-1px-${opacity}`;
        return `stroke-thick-${opacity}`;
    }

    // Combined fill+stroke
    if (hasFill && hasStroke) {
        const fillOpacity = fillSemi ? 'semi' : 'opaq';
        const strokeOpacity = strokeSemi ? 'semi' : 'opaq';
        if (is1px) return `fillstroke-1px-${fillOpacity}-${strokeOpacity}`;
        return `fillstroke-thick-${fillOpacity}-${strokeOpacity}`;
    }

    return null;
}

/**
 * Get the pixel estimator key for a shape test.
 */
function getEstimatorKey(shapeFamily, operation, strokeKey) {
    const is1px = strokeKey === 'sw1px';
    const hasFill = operation.startsWith('fill');
    const hasStroke = operation.includes('stroke');

    // Normalize shape family for estimator lookup
    let shape;
    if (shapeFamily === 'rect-rot') shape = 'rect-rot';
    else if (shapeFamily === 'roundrect-aa' || shapeFamily === 'roundrect-rot') shape = 'roundrect';
    else if (shapeFamily.startsWith('line-')) shape = 'line';
    else shape = shapeFamily; // circle, arc

    if (hasFill && hasStroke) {
        return `${shape}-fillstroke-${is1px ? '1px' : 'thick'}`;
    }
    if (hasFill && !hasStroke) {
        return `${shape}-fill`;
    }
    if (hasStroke && !hasFill) {
        return is1px ? `${shape}-stroke-1px` : `${shape}-stroke-thick`;
    }
    return null;
}

// ============================================================================
// Linear Regression
// ============================================================================

/**
 * Fit ordinary least squares regression: y = a + b * x
 *
 * Returns { a, b, rSquared, n, dataPoints, insufficient, interceptClamped }
 *
 * Quality flags:
 * - insufficient: true if n < 3 (R²=1.0 is guaranteed with 2 points, meaningless)
 * - interceptClamped: true if the raw intercept was negative (clamped to 0)
 */
function fitRegression(dataPoints) {
    const n = dataPoints.length;
    if (n < 2) {
        return { a: NaN, b: NaN, rSquared: NaN, n, dataPoints, error: 'Need at least 2 data points',
                 insufficient: true, interceptClamped: false };
    }

    const sumX = dataPoints.reduce((s, d) => s + d.pixels, 0);
    const sumY = dataPoints.reduce((s, d) => s + d.time, 0);
    const sumXY = dataPoints.reduce((s, d) => s + d.pixels * d.time, 0);
    const sumX2 = dataPoints.reduce((s, d) => s + d.pixels * d.pixels, 0);

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) {
        return { a: NaN, b: NaN, rSquared: NaN, n, dataPoints, error: 'All x values identical',
                 insufficient: true, interceptClamped: false };
    }

    const b = (n * sumXY - sumX * sumY) / denom;
    const rawA = (sumY - b * sumX) / n;

    // Clamp negative intercept: per-shape overhead cannot be negative
    const interceptClamped = rawA < 0;
    const a = Math.max(0, rawA);

    // R-squared (computed on raw regression, before clamping)
    const meanY = sumY / n;
    const ssRes = dataPoints.reduce((s, d) => s + (d.time - (rawA + b * d.pixels)) ** 2, 0);
    const ssTot = dataPoints.reduce((s, d) => s + (d.time - meanY) ** 2, 0);
    const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    // n=2 guarantees R²=1.0 — flag as insufficient
    const insufficient = n < 3;

    return { a, b, rSquared, n, dataPoints, insufficient, interceptClamped };
}

// ============================================================================
// Floor Regression Building
// ============================================================================

/**
 * Build floor regressions from rect-AA benchmark results.
 *
 * Groups rect-AA tests by operation type, estimates pixel counts,
 * and fits a regression for each operation type.
 */
function buildFloorRegressions(results) {
    // Group rect-AA results by operation classification
    const groups = {};

    for (const result of results) {
        const parsed = parseTestId(result.id);
        if (!parsed || parsed.baseId !== 'rect-aa-perf') continue;

        const opClass = classifyOperation(parsed.operation, parsed.strokeKey);
        if (!opClass) continue;

        if (!groups[opClass]) groups[opClass] = [];

        // Get brackets
        const sizeBracket = PERF_SIZE_CATEGORIES.shapeSize[parsed.sizeKey];
        const strokeBracket = parsed.strokeKey !== 'sw0' ?
            PERF_SIZE_CATEGORIES.strokeWidth[parsed.strokeKey] : null;

        if (!sizeBracket) continue;

        // Estimate pixel count based on operation type
        let pixels;
        if (opClass === 'fill-opaq' || opClass === 'fill-semi') {
            pixels = estimateRectFillPixels(sizeBracket);
        } else if (opClass.startsWith('stroke-1px')) {
            pixels = estimateRect1pxStrokePixels(sizeBracket);
        } else if (opClass.startsWith('stroke-thick')) {
            if (!strokeBracket) continue;
            pixels = estimateRectStrokePixels(sizeBracket, strokeBracket);
        } else if (opClass.startsWith('fillstroke-1px')) {
            pixels = estimateRectFill1pxStrokePixels(sizeBracket);
        } else if (opClass.startsWith('fillstroke-thick')) {
            if (!strokeBracket) continue;
            pixels = estimateRectFillStrokePixels(sizeBracket, strokeBracket);
        } else {
            continue;
        }

        groups[opClass].push({
            pixels,
            time: result.usPerShape,
            id: result.id,
            sizeKey: parsed.sizeKey,
            strokeKey: parsed.strokeKey
        });
    }

    // Fit regression for each group
    const regressions = {};
    for (const [opClass, dataPoints] of Object.entries(groups)) {
        regressions[opClass] = fitRegression(dataPoints);
    }

    return regressions;
}

// ============================================================================
// Proximity Calculation
// ============================================================================

/**
 * Calculate proximity-to-optimal for a single test result.
 */
function calculateProximity(result, regressions) {
    const parsed = parseTestId(result.id);
    if (!parsed) return null;

    const shapeFamily = getShapeFamily(parsed.baseId);

    // Skip rect-AA (they are the floor itself)
    // We'll still compute them but flag them
    const isFloor = parsed.baseId === 'rect-aa-perf';

    // Determine which floor regression to use
    const opClass = classifyOperation(parsed.operation, parsed.strokeKey);
    if (!opClass) return null;

    const regression = regressions[opClass];
    if (!regression || isNaN(regression.a)) return null;

    // Get brackets
    const sizeBracket = PERF_SIZE_CATEGORIES.shapeSize[parsed.sizeKey];
    const strokeBracket = parsed.strokeKey !== 'sw0' && parsed.strokeKey !== 'sw1px' ?
        PERF_SIZE_CATEGORIES.strokeWidth[parsed.strokeKey] :
        (parsed.strokeKey === 'sw1px' ? { min: 1, max: 1 } : null);
    const angleBracket = parsed.angleKey ?
        PERF_SIZE_CATEGORIES.arcAngle[parsed.angleKey] : null;

    if (!sizeBracket) return null;

    // Estimate pixel count for this shape
    const estimatorKey = getEstimatorKey(shapeFamily, parsed.operation, parsed.strokeKey);
    const estimator = estimatorKey ? SHAPE_PIXEL_ESTIMATORS[estimatorKey] : null;

    let estimatedPixels;
    if (isFloor) {
        // For rect-AA tests, use the same estimation as the regression
        if (opClass === 'fill-opaq' || opClass === 'fill-semi') {
            estimatedPixels = estimateRectFillPixels(sizeBracket);
        } else if (opClass.startsWith('stroke-1px')) {
            estimatedPixels = estimateRect1pxStrokePixels(sizeBracket);
        } else if (opClass.startsWith('stroke-thick')) {
            if (!strokeBracket) return null;
            estimatedPixels = estimateRectStrokePixels(sizeBracket, strokeBracket);
        } else if (opClass.startsWith('fillstroke-1px')) {
            estimatedPixels = estimateRectFill1pxStrokePixels(sizeBracket);
        } else if (opClass.startsWith('fillstroke-thick')) {
            if (!strokeBracket) return null;
            estimatedPixels = estimateRectFillStrokePixels(sizeBracket, strokeBracket);
        }
    } else if (estimator) {
        estimatedPixels = estimator(sizeBracket, strokeBracket, angleBracket);
    } else {
        return null;
    }

    if (!estimatedPixels || estimatedPixels <= 0) return null;

    // Calculate floor time from regression
    const floorTime = regression.a + regression.b * estimatedPixels;

    // Proximity = floor / actual
    const proximity = floorTime / result.usPerShape;

    return {
        id: result.id,
        name: result.name,
        shapeFamily,
        parsed,
        opClass,
        isFloor,
        estimatedPixels: Math.round(estimatedPixels),
        floorTime,
        actualTime: result.usPerShape,
        proximity,
        regressionR2: regression.rSquared,
        regressionInsufficient: regression.insufficient || false,
        regressionClamped: regression.interceptClamped || false
    };
}

// ============================================================================
// Report Formatting
// ============================================================================

/**
 * Format a number with commas.
 */
function fmtNum(n) {
    return Math.round(n).toLocaleString('en-US');
}

/**
 * Format microseconds with appropriate precision.
 */
function fmtUs(us) {
    if (us >= 100) return us.toFixed(0) + 'µs';
    if (us >= 10) return us.toFixed(1) + 'µs';
    return us.toFixed(2) + 'µs';
}

/**
 * Format proximity as percentage.
 */
function fmtProx(p) {
    return (p * 100).toFixed(0) + '%';
}

/**
 * Get a human-readable label for a proximity value.
 */
function proximityLabel(p) {
    if (p >= 1.0) return 'at/above floor';
    if (p >= 0.7) return 'near optimal';
    if (p >= 0.4) return 'room to improve';
    return 'significant room';
}

/**
 * Build a compact display label from parsed test ID.
 */
function buildDisplayLabel(parsed) {
    const shape = getShapeFamily(parsed.baseId);
    let label = `${shape} ${parsed.operation} ${parsed.strokeKey} ${parsed.sizeKey}`;
    if (parsed.angleKey) label += ` ${parsed.angleKey}`;
    return label;
}

/**
 * Generate console report.
 */
function generateConsoleReport(regressions, proximities, metadata) {
    const lines = [];
    const w = 72;

    lines.push('='.repeat(w));
    lines.push('PROXIMITY-TO-OPTIMAL ANALYSIS');
    lines.push('='.repeat(w));
    lines.push('');

    if (metadata) {
        if (metadata.timestamp) lines.push(`Source: ${metadata.timestamp}`);
        if (metadata.gitCommit) lines.push(`Git: ${metadata.gitCommit} (${metadata.gitBranch || 'unknown'})`);
    }
    lines.push('Floor model: rect-AA regression (R\u00B2 shown per regression)');
    lines.push('');

    // --- Data Quality Assessment ---
    const sortedRegKeys = Object.keys(regressions).sort();
    const insufficientRegs = sortedRegKeys.filter(k => regressions[k].insufficient);
    const clampedRegs = sortedRegKeys.filter(k => regressions[k].interceptClamped);
    const lowR2Regs = sortedRegKeys.filter(k => !regressions[k].error && !regressions[k].insufficient && regressions[k].rSquared < minR2);

    if (insufficientRegs.length > 0 || clampedRegs.length > 0 || lowR2Regs.length > 0) {
        lines.push('--- DATA QUALITY ---');
        if (insufficientRegs.length > 0) {
            lines.push(`\u26A0  ${insufficientRegs.length} regression(s) have n<3 (R\u00B2=1.0 is guaranteed with 2 points, not meaningful):`);
            lines.push(`   ${insufficientRegs.join(', ')}`);
            lines.push('   For reliable results, include at least 3 size categories (e.g., szS, szM, szL)');
        }
        if (clampedRegs.length > 0) {
            lines.push(`\u26A0  ${clampedRegs.length} regression(s) had negative intercept (clamped to 0):`);
            lines.push(`   ${clampedRegs.join(', ')}`);
            lines.push('   This means the data range is too narrow to separate per-shape from per-pixel cost');
        }
        if (lowR2Regs.length > 0) {
            lines.push(`\u26A0  ${lowR2Regs.length} regression(s) have low R\u00B2 (below ${minR2}):`);
            lines.push(`   ${lowR2Regs.join(', ')}`);
        }
        lines.push('');
    }

    // --- Floor Regressions ---
    lines.push('--- Floor Regressions (rect-AA) ---');

    for (const key of sortedRegKeys) {
        const reg = regressions[key];
        if (reg.error) {
            lines.push(`  ${key.padEnd(30)} ERROR: ${reg.error}`);
            continue;
        }
        const aStr = `a=${(reg.a).toFixed(2)}\u00B5s`;
        const bStr = `b=${(reg.b * 1000).toFixed(2)} ns/px`;
        const r2Str = `R\u00B2=${reg.rSquared.toFixed(3)}`;
        const nStr = `n=${reg.n}`;
        // Build warnings
        const warnings = [];
        if (reg.insufficient) warnings.push('n<3');
        if (reg.interceptClamped) warnings.push('a clamped');
        if (!reg.insufficient && reg.rSquared < minR2) warnings.push('low R\u00B2');
        const warnStr = warnings.length > 0 ? ` \u26A0 ${warnings.join(', ')}` : '';
        lines.push(`  ${key.padEnd(30)} ${aStr.padEnd(14)} ${bStr.padEnd(18)} ${r2Str}${warnStr}  (${nStr})`);
        // Note for 1px stroke regressions
        if (key.includes('stroke-1px')) {
            lines.push(`  ${''.padEnd(30)} Note: rect-AA 1px stroke (4 line segments) may not be the true floor;`);
            lines.push(`  ${''.padEnd(30)} circle Bresenham (8-fold symmetry) can be faster for this op type.`);
        }
    }
    lines.push('');

    // --- Group proximities by shape family ---
    const byFamily = {};
    for (const p of proximities) {
        if (!byFamily[p.shapeFamily]) byFamily[p.shapeFamily] = [];
        byFamily[p.shapeFamily].push(p);
    }

    // Sort families: rect-aa first, then alphabetical
    const familyOrder = Object.keys(byFamily).sort((a, b) => {
        if (a === 'rect-aa') return -1;
        if (b === 'rect-aa') return 1;
        return a.localeCompare(b);
    });

    const header = 'Test'.padEnd(48) + 'Est.Px'.padStart(8) + '  ' +
                   'Floor'.padStart(8) + '  ' + 'Actual'.padStart(8) + '  ' +
                   'Prox'.padStart(6);
    const separator = '-'.repeat(header.length);

    for (const family of familyOrder) {
        const items = byFamily[family];
        // Sort by operation, then size
        items.sort((a, b) => {
            if (a.opClass !== b.opClass) return a.opClass.localeCompare(b.opClass);
            const sizeOrder = Object.keys(PERF_SIZE_CATEGORIES.shapeSize);
            const ai = sizeOrder.indexOf(a.parsed.sizeKey);
            const bi = sizeOrder.indexOf(b.parsed.sizeKey);
            return ai - bi;
        });

        lines.push(`--- ${family.toUpperCase()} ${family === 'rect-aa' ? '(FLOOR)' : ''} ---`);
        lines.push(header);
        lines.push(separator);

        for (const item of items) {
            const label = buildDisplayLabel(item.parsed);
            const proxStr = fmtProx(item.proximity);
            let note = '';
            if (item.isFloor) {
                note = ' (floor)';
            } else if (item.proximity > 1.0) {
                if (item.regressionInsufficient || item.regressionClamped) {
                    note = '?'; // Likely due to unreliable regression
                } else {
                    note = '*'; // Genuinely faster than rect-AA floor
                }
            }
            lines.push(
                `${label.padEnd(48)}${fmtNum(item.estimatedPixels).padStart(8)}  ` +
                `${fmtUs(item.floorTime).padStart(8)}  ${fmtUs(item.actualTime).padStart(8)}  ` +
                `${proxStr.padStart(6)}${note}`
            );
        }
        lines.push('');
    }

    // Footer notes
    lines.push('* >100% = genuinely faster than rect-AA floor (e.g., cache-friendly pattern)');
    lines.push('? >100% = likely due to unreliable regression (n<3 or negative intercept clamped)');
    lines.push('');

    // --- Rankings ---
    const nonFloor = proximities.filter(p => !p.isFloor);
    nonFloor.sort((a, b) => a.proximity - b.proximity);

    lines.push('='.repeat(w));
    lines.push('PROXIMITY RANKINGS (worst first = most room to improve)');
    lines.push('='.repeat(w));

    const maxRank = Math.min(30, nonFloor.length);
    for (let i = 0; i < maxRank; i++) {
        const item = nonFloor[i];
        const label = buildDisplayLabel(item.parsed);
        const proxStr = fmtProx(item.proximity);
        const verdict = proximityLabel(item.proximity);
        lines.push(`${String(i + 1).padStart(3)}. ${label.padEnd(48)} ${proxStr.padStart(6)}   ${verdict}`);
    }

    if (nonFloor.length > maxRank) {
        lines.push(`     ... and ${nonFloor.length - maxRank} more tests`);
    }

    lines.push('');

    // --- Summary statistics ---
    if (nonFloor.length > 0) {
        const avgProx = nonFloor.reduce((s, p) => s + p.proximity, 0) / nonFloor.length;
        const medianIdx = Math.floor(nonFloor.length / 2);
        const medProx = nonFloor[medianIdx].proximity;
        lines.push(`Summary: ${nonFloor.length} shape tests analyzed`);
        lines.push(`  Mean proximity:   ${fmtProx(avgProx)}`);
        lines.push(`  Median proximity: ${fmtProx(medProx)}`);
        lines.push(`  Best:  ${fmtProx(nonFloor[nonFloor.length - 1].proximity)} (${buildDisplayLabel(nonFloor[nonFloor.length - 1].parsed)})`);
        lines.push(`  Worst: ${fmtProx(nonFloor[0].proximity)} (${buildDisplayLabel(nonFloor[0].parsed)})`);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Generate comparison report for before/after analysis.
 */
function generateComparisonReport(beforeProx, afterProx, regressionsBefore, regressionsAfter) {
    const lines = [];
    const w = 80;

    lines.push('='.repeat(w));
    lines.push('PROXIMITY-TO-OPTIMAL COMPARISON (Before → After)');
    lines.push('='.repeat(w));
    lines.push('');

    // Build lookup maps
    const beforeMap = new Map(beforeProx.map(p => [p.id, p]));
    const afterMap = new Map(afterProx.map(p => [p.id, p]));

    // Find common tests (excluding rect-aa floor)
    const commonIds = [...beforeMap.keys()].filter(id =>
        afterMap.has(id) && !beforeMap.get(id).isFloor
    );

    if (commonIds.length === 0) {
        lines.push('No common non-floor tests found between before and after.');
        return lines.join('\n');
    }

    // Calculate deltas
    const deltas = commonIds.map(id => {
        const b = beforeMap.get(id);
        const a = afterMap.get(id);
        return {
            id,
            label: buildDisplayLabel(b.parsed),
            beforeProx: b.proximity,
            afterProx: a.proximity,
            delta: a.proximity - b.proximity,
            beforeTime: b.actualTime,
            afterTime: a.actualTime,
            timeChange: ((a.actualTime - b.actualTime) / b.actualTime) * 100
        };
    });

    // Sort by delta (most improved first)
    deltas.sort((a, b) => b.delta - a.delta);

    const header = 'Test'.padEnd(42) + 'Before'.padStart(7) + ' ' +
                   'After'.padStart(7) + ' ' + 'Delta'.padStart(7) + '  ' +
                   'Time Δ'.padStart(8);
    lines.push(header);
    lines.push('-'.repeat(header.length));

    for (const d of deltas) {
        const deltaStr = (d.delta >= 0 ? '+' : '') + fmtProx(d.delta);
        const timeStr = (d.timeChange >= 0 ? '+' : '') + d.timeChange.toFixed(1) + '%';
        lines.push(
            `${d.label.padEnd(42)}${fmtProx(d.beforeProx).padStart(7)} ` +
            `${fmtProx(d.afterProx).padStart(7)} ${deltaStr.padStart(7)}  ` +
            `${timeStr.padStart(8)}`
        );
    }

    lines.push('');

    // Summary
    const improved = deltas.filter(d => d.delta > 0.01);
    const regressed = deltas.filter(d => d.delta < -0.01);
    const unchanged = deltas.filter(d => Math.abs(d.delta) <= 0.01);

    lines.push(`Summary: ${deltas.length} tests compared`);
    lines.push(`  Improved proximity:  ${improved.length}`);
    lines.push(`  Regressed proximity: ${regressed.length}`);
    lines.push(`  Unchanged:           ${unchanged.length}`);
    lines.push('');

    return lines.join('\n');
}

// ============================================================================
// JSON Output
// ============================================================================

function buildJsonOutput(regressions, proximities, metadata) {
    return {
        version: '1.0',
        metadata: {
            generatedAt: new Date().toISOString(),
            source: metadata || {},
            minR2
        },
        regressions: Object.fromEntries(
            Object.entries(regressions).map(([key, reg]) => [key, {
                a: reg.a,
                b: reg.b,
                rSquared: reg.rSquared,
                n: reg.n,
                valid: !reg.error && !reg.insufficient && reg.rSquared >= minR2,
                insufficient: reg.insufficient || false,
                interceptClamped: reg.interceptClamped || false,
                error: reg.error || undefined
            }])
        ),
        results: proximities.map(p => ({
            id: p.id,
            name: p.name,
            shapeFamily: p.shapeFamily,
            operationClass: p.opClass,
            isFloor: p.isFloor,
            estimatedPixels: p.estimatedPixels,
            floorTimeUs: parseFloat(p.floorTime.toFixed(3)),
            actualTimeUs: p.actualTime,
            proximity: parseFloat(p.proximity.toFixed(4)),
            regressionR2: parseFloat(p.regressionR2.toFixed(4)),
            regressionInsufficient: p.regressionInsufficient,
            regressionClamped: p.regressionClamped
        })),
        rankings: proximities
            .filter(p => !p.isFloor)
            .sort((a, b) => a.proximity - b.proximity)
            .map((p, i) => ({
                rank: i + 1,
                id: p.id,
                proximity: parseFloat(p.proximity.toFixed(4)),
                verdict: proximityLabel(p.proximity)
            }))
    };
}

// ============================================================================
// Main
// ============================================================================

function loadBenchmark(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Error parsing ${filePath}: ${e.message}`);
        process.exit(1);
    }
}

function filterResults(results) {
    let filtered = results;
    if (filterShape) {
        filtered = filtered.filter(r => {
            const parsed = parseTestId(r.id);
            if (!parsed) return false;
            const family = getShapeFamily(parsed.baseId);
            return family.startsWith(filterShape) || parsed.baseId.startsWith(filterShape);
        });
        // Always include rect-AA for floor regression
        const rectAaResults = results.filter(r => r.id.startsWith('rect-aa-perf-'));
        const rectAaIds = new Set(filtered.map(r => r.id));
        for (const r of rectAaResults) {
            if (!rectAaIds.has(r.id)) filtered.push(r);
        }
    }
    if (filterOp) {
        filtered = filtered.filter(r => {
            const parsed = parseTestId(r.id);
            // Always keep rect-AA for regression
            if (parsed && parsed.baseId === 'rect-aa-perf') return true;
            return parsed && parsed.operation === filterOp;
        });
    }
    if (filterSize) {
        filtered = filtered.filter(r => {
            const parsed = parseTestId(r.id);
            // Always keep rect-AA for regression
            if (parsed && parsed.baseId === 'rect-aa-perf') return true;
            return parsed && parsed.sizeKey === filterSize;
        });
    }
    return filtered;
}

function analyzeData(data) {
    if (!data.results || data.results.length === 0) {
        console.error('Error: No results found in benchmark data');
        process.exit(1);
    }

    const results = filterResults(data.results);

    // Check that we have rect-AA data
    const rectAaCount = results.filter(r => r.id.startsWith('rect-aa-perf-')).length;
    if (rectAaCount === 0) {
        console.error('Error: No rect-aa-perf results found. These are required for floor regression.');
        console.error('Run a benchmark that includes rect-aa-perf tests.');
        process.exit(1);
    }

    // Build floor regressions
    const regressions = buildFloorRegressions(results);

    // Check regression quality
    let hasWarnings = false;
    for (const [key, reg] of Object.entries(regressions)) {
        if (reg.error) {
            console.error(`WARNING: Regression "${key}" failed: ${reg.error}`);
            hasWarnings = true;
        } else if (reg.insufficient) {
            console.error(`WARNING: Regression "${key}" has only ${reg.n} data point(s) — R\u00B2 is meaningless with n<3`);
            hasWarnings = true;
        } else {
            if (reg.interceptClamped) {
                console.error(`WARNING: Regression "${key}" had negative intercept (clamped to 0) — data range too narrow`);
                hasWarnings = true;
            }
            if (reg.rSquared < minR2) {
                console.error(`WARNING: Regression "${key}" has low R\u00B2=${reg.rSquared.toFixed(3)} (min: ${minR2})`);
                hasWarnings = true;
            }
        }
    }

    if (hasWarnings) {
        console.error('');
    }

    // Calculate proximity for all results
    const proximities = [];
    for (const result of results) {
        const prox = calculateProximity(result, regressions);
        if (prox) proximities.push(prox);
    }

    return { regressions, proximities, metadata: data.metadata };
}

function main() {
    if (isComparisonMode) {
        // Before/after comparison
        const beforeData = loadBenchmark(beforeFile);
        const afterData = loadBenchmark(afterFile);

        const before = analyzeData(beforeData);
        const after = analyzeData(afterData);

        if (outputFormat === 'json') {
            const output = {
                before: buildJsonOutput(before.regressions, before.proximities, before.metadata),
                after: buildJsonOutput(after.regressions, after.proximities, after.metadata)
            };
            const json = JSON.stringify(output, null, 2);
            if (outputFile) {
                fs.writeFileSync(outputFile, json);
                console.log(`JSON output written to ${outputFile}`);
            } else {
                console.log(json);
            }
        } else {
            // Console comparison report
            const report = generateComparisonReport(
                before.proximities, after.proximities,
                before.regressions, after.regressions
            );
            console.log(report);
        }
    } else {
        // Single file analysis
        const data = loadBenchmark(inputFile);
        const { regressions, proximities, metadata } = analyzeData(data);

        if (outputFormat === 'json') {
            const output = buildJsonOutput(regressions, proximities, metadata);
            const json = JSON.stringify(output, null, 2);
            if (outputFile) {
                fs.writeFileSync(outputFile, json);
                console.log(`JSON output written to ${outputFile}`);
            } else {
                console.log(json);
            }
        } else {
            const report = generateConsoleReport(regressions, proximities, metadata);
            console.log(report);
        }
    }
}

main();

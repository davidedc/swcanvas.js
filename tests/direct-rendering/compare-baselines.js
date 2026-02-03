#!/usr/bin/env node
/**
 * Baseline Comparison Tool for SWCanvas Performance Tests
 *
 * Compares two baseline files (either text or JSON format) and outputs
 * a detailed comparison with classification of changes.
 *
 * Now supports statistical significance testing with --statistical flag
 * when using v2.0/v3.0 JSON baselines with raw measurements.
 *
 * Usage:
 *   node compare-baselines.js --before <file> --after <file> [options]
 *
 * Options:
 *   --before <file>          Baseline file (before changes)
 *   --after <file>           Baseline file (after changes)
 *   --threshold-opaque <N>   Threshold for opaque tests (default: 15)
 *   --threshold-semi <N>     Threshold for semi-transparent tests (default: 25)
 *   --statistical            Use statistical significance testing (requires v2.0/v3.0 JSON)
 *   --json                   Output results in JSON format
 *   --quiet                  Only show summary statistics
 *   -h, --help               Show help message
 */

'use strict';

const fs = require('fs');

// Import statistics module for statistical significance testing
let Statistics;
try {
    Statistics = require('./lib/statistics');
} catch (e) {
    // Statistics module not available - statistical mode will fail gracefully
    Statistics = null;
}

// Default thresholds
let thresholdOpaque = 15;
let thresholdSemi = 25;
let beforeFile = null;
let afterFile = null;
let outputFile = null;
let outputFormat = 'text';
let quietMode = false;
let useStatistical = false;
let analyzeMode = false;

// ============================================================================
// Dimension Labels for --analyze mode
// ============================================================================

const DIMENSION_LABELS = {
    strokeCategory: {
        sw0: '0px (fill only)',
        sw1: '1px (Bresenham)',
        swXXS: '2-3px (XXS)',
        swXS: '3-5px (XS)',
        swS: '5-10px (S)',
        swM: '10-20px (M)',
        swL: '20-40px (L)',
        swXL: '40-80px (XL)',
        swXXL: '80+px (XXL)'
    },
    sizeCategory: {
        szXXS: 'XXS (<5px)',
        szXS: 'XS (5-15px)',
        szS: 'S (16-39px)',
        szM: 'M (40-79px)',
        szL: 'L (80-159px)',
        szXL: 'XL (160-319px)',
        szXXL: 'XXL (320+px)'
    },
    angleCategory: {
        angS: 'Small (30-90°)',
        angM: 'Medium (90-180°)',
        angL: 'Large (180-270°)',
        angXL: 'Nearly Full (270-350°)'
    },
    operation: {
        'fill-opaque': 'Fill (Opaque)',
        'fill-semi': 'Fill (Semi)',
        'stroke-opaque': 'Stroke (Opaque)',
        'stroke-semi': 'Stroke (Semi)',
        'fillstroke-opaque-opaque': 'Fill+Stroke (Both Opaque)',
        'fillstroke-opaque-semi': 'Fill+Stroke (Opaq+Semi)',
        'fillstroke-semi-opaque': 'Fill+Stroke (Semi+Opaq)',
        'fillstroke-semi-semi': 'Fill+Stroke (Both Semi)'
    }
};

// ============================================================================
// Analysis Functions for --analyze mode
// ============================================================================

/**
 * Group comparisons by a dimension and compute stats
 */
function analyzeByDimension(comparisons, dimensionKey) {
    const groups = {};

    for (const c of comparisons) {
        const dimValue = c.metadata?.[dimensionKey] || 'unknown';
        if (!groups[dimValue]) {
            groups[dimValue] = { items: [], faster: 0, slower: 0, same: 0 };
        }
        groups[dimValue].items.push(c);

        if (c.classification.includes('FASTER')) groups[dimValue].faster++;
        else if (c.classification.includes('SLOWER') || c.classification === 'REGRESSION')
            groups[dimValue].slower++;
        else groups[dimValue].same++;
    }

    // Compute averages
    for (const key of Object.keys(groups)) {
        const items = groups[key].items;
        groups[key].avgChange =
            items.reduce((s, c) => s + c.change, 0) / items.length;
        groups[key].count = items.length;
    }

    return groups;
}

/**
 * Create cross-tabulation of two dimensions
 */
function crossTabulate(comparisons, dim1Key, dim2Key) {
    const matrix = {};

    for (const c of comparisons) {
        const d1 = c.metadata?.[dim1Key] || 'unknown';
        const d2 = c.metadata?.[dim2Key] || 'unknown';
        const key = `${d1}|${d2}`;

        if (!matrix[key]) matrix[key] = [];
        matrix[key].push(c.change);
    }

    // Compute averages
    const result = {};
    for (const key of Object.keys(matrix)) {
        const [d1, d2] = key.split('|');
        if (!result[d1]) result[d1] = {};
        result[d1][d2] = matrix[key].reduce((a, b) => a + b, 0) / matrix[key].length;
    }

    return result;
}

/**
 * Print dimensional breakdown table
 */
function printDimensionBreakdown(title, groups, labelMap) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(title);
    console.log('═'.repeat(70));
    console.log(
        'Dimension'.padEnd(24) + ' Count   Avg Δ%   Faster  Slower   Same'
    );
    console.log('─'.repeat(70));

    const order = Object.keys(labelMap);
    for (const key of order) {
        if (!groups[key]) continue;
        const g = groups[key];
        const label = (labelMap[key] || key).padEnd(24);
        const count = String(g.count).padStart(5);
        const avg = (g.avgChange >= 0 ? '+' : '') + g.avgChange.toFixed(1) + '%';
        const avgStr = avg.padStart(8);
        const faster = String(g.faster).padStart(6);
        const slower = String(g.slower).padStart(7);
        const same = String(g.same).padStart(6);
        console.log(`${label}${count}${avgStr}${faster}${slower}${same}`);
    }

    // Handle any 'unknown' entries
    if (groups['unknown']) {
        const g = groups['unknown'];
        const label = 'Unknown'.padEnd(24);
        const count = String(g.count).padStart(5);
        const avg = (g.avgChange >= 0 ? '+' : '') + g.avgChange.toFixed(1) + '%';
        const avgStr = avg.padStart(8);
        const faster = String(g.faster).padStart(6);
        const slower = String(g.slower).padStart(7);
        const same = String(g.same).padStart(6);
        console.log(`${label}${count}${avgStr}${faster}${slower}${same}`);
    }
}

/**
 * Print cross-tabulation matrix
 */
function printCrossTabMatrix(title, matrix, rowLabels, colLabels) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(title);
    console.log('═'.repeat(80));

    // Determine which columns have data
    const activeCols = Object.keys(colLabels).filter((colKey) => {
        return Object.keys(matrix).some((rowKey) => matrix[rowKey][colKey] !== undefined);
    });

    if (activeCols.length === 0) {
        console.log('No data available for this cross-tabulation.');
        return;
    }

    // Header row
    let header = ''.padEnd(28);
    for (const colKey of activeCols) {
        header += colLabels[colKey].slice(0, 10).padStart(10);
    }
    console.log(header);
    console.log('─'.repeat(80));

    // Data rows
    const activeRows = Object.keys(rowLabels).filter((rowKey) => matrix[rowKey]);
    for (const rowKey of activeRows) {
        let row = rowLabels[rowKey].padEnd(28);
        for (const colKey of activeCols) {
            const val = matrix[rowKey]?.[colKey];
            if (val === undefined) {
                row += 'N/A'.padStart(10);
            } else {
                const sign = val >= 0 ? '+' : '';
                row += (sign + val.toFixed(1) + '%').padStart(10);
            }
        }
        console.log(row);
    }
}

/**
 * Generate recommendation based on analysis
 */
function generateRecommendation(summary, comparisons, dimensionAnalysis) {
    const recommendation = {
        verdict: 'UNKNOWN',
        confidence: 'low',
        reasons: [],
        suggestions: []
    };

    const totalTests = comparisons.length;
    if (totalTests === 0) {
        recommendation.verdict = 'NO_DATA';
        recommendation.reasons.push('No test comparisons available');
        return recommendation;
    }

    const fasterCount =
        (summary.significant_faster || 0) +
        (summary.likely_faster || 0) +
        (summary.faster || 0);
    const slowerCount =
        (summary.significant_slower || 0) +
        (summary.likely_slower || 0) +
        (summary.slower || 0) +
        (summary.regression || 0);
    const fasterPct = ((fasterCount / totalTests) * 100).toFixed(1);
    const slowerPct = ((slowerCount / totalTests) * 100).toFixed(1);

    // Check for severe regressions (>5%)
    const severeRegressions = comparisons.filter((c) => c.change < -5);
    const strongImprovements = comparisons.filter((c) => c.change > 5);

    // Opaque vs Semi analysis
    const opaqueTests = comparisons.filter(
        (c) => c.metadata?.operation && !c.metadata.operation.includes('semi')
    );
    const semiTests = comparisons.filter(
        (c) => c.metadata?.operation && c.metadata.operation.includes('semi')
    );

    const opaqueAvg =
        opaqueTests.length > 0
            ? opaqueTests.reduce((s, c) => s + c.change, 0) / opaqueTests.length
            : 0;
    const semiAvg =
        semiTests.length > 0
            ? semiTests.reduce((s, c) => s + c.change, 0) / semiTests.length
            : 0;

    // Decision logic
    if (parseFloat(slowerPct) > 50 && parseFloat(fasterPct) < 30) {
        recommendation.verdict = 'DO_NOT_SHIP';
        recommendation.confidence = 'high';
        recommendation.reasons.push(
            `${slowerPct}% of tests regressed (>50% threshold)`
        );
    } else if (severeRegressions.length > strongImprovements.length * 2) {
        recommendation.verdict = 'DO_NOT_SHIP';
        recommendation.confidence = 'medium';
        recommendation.reasons.push(
            `${severeRegressions.length} severe regressions (>5%) vs ${strongImprovements.length} strong improvements (>5%)`
        );
    } else if (
        opaqueTests.length > 0 &&
        semiTests.length > 0 &&
        Math.abs(opaqueAvg - semiAvg) > 3
    ) {
        recommendation.verdict = 'INVESTIGATE';
        recommendation.confidence = 'medium';
        recommendation.reasons.push(
            `Large divergence: opaque ${opaqueAvg.toFixed(1)}% vs semi ${semiAvg.toFixed(1)}%`
        );
        recommendation.suggestions.push(
            'Consider hybrid approach with separate code paths'
        );
    } else if (parseFloat(fasterPct) > 60 && parseFloat(slowerPct) < 20) {
        recommendation.verdict = 'SHIP';
        recommendation.confidence = 'high';
        recommendation.reasons.push(
            `${fasterPct}% improved, only ${slowerPct}% regressed`
        );
    } else if (severeRegressions.length === 0 && parseFloat(slowerPct) < 30) {
        recommendation.verdict = 'SHIP';
        recommendation.confidence = 'medium';
        recommendation.reasons.push('No severe regressions detected');
        recommendation.reasons.push(
            `${slowerPct}% regressed (within acceptable range)`
        );
    } else {
        recommendation.verdict = 'NEUTRAL';
        recommendation.confidence = 'low';
        recommendation.reasons.push('Mixed results, no clear pattern');
    }

    // Add opaque/semi analysis to reasons if relevant
    if (opaqueTests.length > 0 && semiTests.length > 0) {
        recommendation.reasons.push(
            `Opaque operations: avg ${opaqueAvg >= 0 ? '+' : ''}${opaqueAvg.toFixed(1)}%`
        );
        recommendation.reasons.push(
            `Semi-transparent operations: avg ${semiAvg >= 0 ? '+' : ''}${semiAvg.toFixed(1)}%`
        );
    }

    return recommendation;
}

/**
 * Print top improvements and regressions
 */
function printTopChanges(comparisons) {
    const sorted = [...comparisons].sort((a, b) => b.change - a.change);

    // Top 10 improvements
    const improvements = sorted.filter((c) => c.change > 0).slice(0, 10);
    if (improvements.length > 0) {
        console.log(`\n${'═'.repeat(80)}`);
        console.log('TOP 10 IMPROVEMENTS');
        console.log('═'.repeat(80));
        for (const c of improvements) {
            const changeStr = '+' + c.change.toFixed(2) + '%';
            const meta = formatMetadataDescription(c);
            console.log(`${changeStr.padStart(8)} | ${meta}`);
        }
    }

    // Top 10 regressions
    const regressions = sorted.filter((c) => c.change < 0).slice(-10).reverse();
    if (regressions.length > 0) {
        console.log(`\n${'═'.repeat(80)}`);
        console.log('TOP 10 REGRESSIONS');
        console.log('═'.repeat(80));
        for (const c of regressions) {
            const changeStr = c.change.toFixed(2) + '%';
            const meta = formatMetadataDescription(c);
            console.log(`${changeStr.padStart(8)} | ${meta}`);
        }
    }
}

/**
 * Format a comparison's metadata into a human-readable description
 */
function formatMetadataDescription(comparison) {
    const parts = [comparison.name];

    if (comparison.metadata) {
        const m = comparison.metadata;
        const details = [];

        if (m.strokeCategory && DIMENSION_LABELS.strokeCategory[m.strokeCategory]) {
            details.push(DIMENSION_LABELS.strokeCategory[m.strokeCategory]);
        }
        if (m.sizeCategory && DIMENSION_LABELS.sizeCategory[m.sizeCategory]) {
            details.push(DIMENSION_LABELS.sizeCategory[m.sizeCategory]);
        }
        if (m.angleCategory && DIMENSION_LABELS.angleCategory[m.angleCategory]) {
            details.push(DIMENSION_LABELS.angleCategory[m.angleCategory]);
        }

        if (details.length > 0) {
            parts.push(`[${details.join(', ')}]`);
        }
    }

    return parts.join(' ');
}

/**
 * Print recommendation section
 */
function printRecommendation(recommendation) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log('RECOMMENDATION');
    console.log('═'.repeat(80));

    // Verdict with color
    let verdictColor = '';
    let verdictReset = '';
    switch (recommendation.verdict) {
        case 'SHIP':
            verdictColor = '\x1b[32m'; // Green
            verdictReset = '\x1b[0m';
            break;
        case 'DO_NOT_SHIP':
            verdictColor = '\x1b[31m'; // Red
            verdictReset = '\x1b[0m';
            break;
        case 'INVESTIGATE':
            verdictColor = '\x1b[33m'; // Yellow
            verdictReset = '\x1b[0m';
            break;
    }

    console.log(
        `Verdict: ${verdictColor}${recommendation.verdict}${verdictReset}`
    );
    console.log(`Confidence: ${recommendation.confidence}`);
    console.log('');

    if (recommendation.reasons.length > 0) {
        console.log('Reasons:');
        for (const reason of recommendation.reasons) {
            console.log(`  • ${reason}`);
        }
    }

    if (recommendation.suggestions.length > 0) {
        console.log('');
        console.log('Suggestions:');
        for (const suggestion of recommendation.suggestions) {
            console.log(`  • ${suggestion}`);
        }
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Baseline Comparison Tool for SWCanvas Performance Tests

Compares two baseline files and classifies performance changes.

Usage:
  node compare-baselines.js --before <file> --after <file> [options]

Options:
  --before <file>          Baseline file (before changes)
  --after <file>           Baseline file (after changes)
  --threshold-opaque <N>   Threshold % for opaque tests (default: 15)
  --threshold-semi <N>     Threshold % for semi-transparent tests (default: 25)
  --statistical            Use statistical significance testing (p-values, CI)
                           Requires v2.0/v3.0 JSON baselines with raw measurements
  --analyze                Enable detailed dimensional analysis with recommendations
                           (see Dimensional Analysis section below)
  --json                   Output results in JSON format
  --output <file>          Write output to file instead of stdout (recommended for
                           large JSON output to avoid pipe truncation issues)
  --quiet                  Only show summary statistics
  -h, --help               Show this help message

Classification (threshold-based):
  FASTER      - Performance improved by more than threshold
  SAME        - Within ±threshold (noise)
  SLOWER      - Performance decreased by threshold to 2×threshold
  REGRESSION  - Performance decreased by more than 2×threshold

Classification (--statistical):
  SIGNIFICANT_FASTER  - p < 0.05, CIs don't overlap, positive change
  LIKELY_FASTER       - Significant p-value but CIs overlap
  SAME                - Not statistically significant
  LIKELY_SLOWER       - Significant p-value but CIs overlap
  SIGNIFICANT_SLOWER  - p < 0.05, CIs don't overlap, negative change

Dimensional Analysis (--analyze):
  Requires v3.0 JSON baselines with metadata. Best used with --statistical.

  Provides:
    - Breakdowns by operation type, stroke width, size category, arc angle
    - Cross-tabulation matrices (e.g., Operation x Arc Angle)
    - Top 10 improvements and regressions with context
    - Automated recommendation with confidence level

  Recommendation Verdicts:
    SHIP          - Safe to ship (majority improved, few regressions)
    DO_NOT_SHIP   - Significant regressions detected
    INVESTIGATE   - Mixed results require investigation (e.g., opaque/semi divergence)
    NEUTRAL       - No clear pattern, use judgment

Examples:
  # Basic threshold-based comparison
  node compare-baselines.js --before baseline-before.txt --after baseline-after.txt

  # Statistical significance testing (recommended for v3.0 JSON)
  node compare-baselines.js --before b1.json --after b2.json --statistical

  # Full analysis with recommendations (recommended workflow)
  node compare-baselines.js --before b1.json --after b2.json --statistical --analyze

  # JSON output to file (recommended for large outputs)
  node compare-baselines.js --before b1.json --after b2.json --statistical --analyze --json --output comparison.json

  # JSON output to stdout (may truncate with large datasets when piped)
  node compare-baselines.js --before b1.json --after b2.json --json

  # Custom thresholds for threshold-based mode
  node compare-baselines.js --before b1.txt --after b2.txt --threshold-opaque 20

See PERFORMANCE-TESTING-WORKFLOW.md for detailed documentation.
`);
    process.exit(0);
}

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--before' && args[i + 1]) {
        beforeFile = args[i + 1];
        i++;
    } else if (arg.startsWith('--before=')) {
        beforeFile = arg.split('=')[1];
    } else if (arg === '--after' && args[i + 1]) {
        afterFile = args[i + 1];
        i++;
    } else if (arg.startsWith('--after=')) {
        afterFile = arg.split('=')[1];
    } else if (arg === '--threshold-opaque' && args[i + 1]) {
        thresholdOpaque = parseFloat(args[i + 1]);
        i++;
    } else if (arg.startsWith('--threshold-opaque=')) {
        thresholdOpaque = parseFloat(arg.split('=')[1]);
    } else if (arg === '--threshold-semi' && args[i + 1]) {
        thresholdSemi = parseFloat(args[i + 1]);
        i++;
    } else if (arg.startsWith('--threshold-semi=')) {
        thresholdSemi = parseFloat(arg.split('=')[1]);
    } else if (arg === '--json') {
        outputFormat = 'json';
    } else if (arg === '--quiet' || arg === '-q') {
        quietMode = true;
    } else if (arg === '--statistical') {
        useStatistical = true;
    } else if (arg === '--analyze') {
        analyzeMode = true;
    } else if (arg === '--output' && args[i + 1]) {
        outputFile = args[i + 1];
        i++;
    } else if (arg.startsWith('--output=')) {
        outputFile = arg.split('=')[1];
    }
}

// Validate required arguments
if (!beforeFile || !afterFile) {
    console.error('Error: Both --before and --after files are required');
    console.error('Use --help for usage information');
    process.exit(1);
}

if (!fs.existsSync(beforeFile)) {
    console.error(`Error: Before file not found: ${beforeFile}`);
    process.exit(1);
}

if (!fs.existsSync(afterFile)) {
    console.error(`Error: After file not found: ${afterFile}`);
    process.exit(1);
}

if (useStatistical && !Statistics) {
    console.error('Error: Statistics module not found. Cannot use --statistical mode.');
    console.error('Make sure lib/statistics.js exists.');
    process.exit(1);
}

/**
 * Parse a text baseline file and extract test results
 * Returns array of { name, shapesPerSec, stddev }
 */
function parseTextBaseline(content) {
    const results = [];
    const lines = content.split('\n');

    for (const line of lines) {
        // Match lines that look like table rows with pipe separators
        // Format: | Test Name | Shapes/sec | us/shape | StdDev |
        const match = line.match(
            /^\|\s*(.+?)\s*\|\s*([\d,]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)%?\s*\|/
        );

        if (match) {
            const name = match[1].trim();

            // Skip header rows
            if (name === 'Test Name' || name.startsWith('---')) {
                continue;
            }

            const shapesPerSec = parseInt(match[2].replace(/,/g, ''), 10);
            const usPerShape = parseFloat(match[3]);
            const stddev = parseFloat(match[4]);

            if (!isNaN(shapesPerSec)) {
                results.push({
                    name: name,
                    shapesPerSec: shapesPerSec,
                    usPerShape: usPerShape,
                    stddev: stddev,
                    // No raw measurements in text format
                    statistics: null
                });
            }
        }
    }

    return { version: '1.0', results };
}

/**
 * Parse a JSON baseline file and extract test results.
 * Supports v1.0, v2.0, and v3.0 formats.
 */
function parseJSONBaseline(content) {
    const data = JSON.parse(content);
    const version = data.version || '1.0';

    const results = data.results.map((r) => {
        const result = {
            id: r.id,
            name: r.name || r.id,
            shapesPerSec: r.shapesPerSec,
            usPerShape: r.usPerShape,
            stddev: r.stddev || (r.statistics ? r.statistics.stddevPercent : 0),
            metadata: r.metadata || {}
        };

        // v2.0/v3.0 have full statistics including raw measurements
        if (r.statistics) {
            result.statistics = r.statistics;
        }

        return result;
    });

    return { version, results, metadata: data.metadata };
}

/**
 * Load and parse a baseline file (auto-detect format)
 */
function loadBaseline(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Try to detect format
    if (content.trim().startsWith('{')) {
        return parseJSONBaseline(content);
    } else {
        return parseTextBaseline(content);
    }
}

/**
 * Determine if a test name indicates semi-transparent operations
 */
function isSemiTransparent(name, metadata) {
    // Check metadata first (more reliable)
    if (metadata && metadata.operation) {
        return metadata.operation.includes('semi');
    }

    // Fallback to name-based detection
    const lowerName = name.toLowerCase();
    return (
        lowerName.includes('semi') ||
        lowerName.includes('alpha') ||
        (lowerName.includes('fill') &&
            lowerName.includes('stroke') &&
            !lowerName.includes('opaque'))
    );
}

/**
 * Classify a change based on fixed thresholds (legacy mode)
 */
function classifyChangeThreshold(changePercent, testName, metadata) {
    const threshold = isSemiTransparent(testName, metadata)
        ? thresholdSemi
        : thresholdOpaque;

    if (changePercent > threshold) {
        return { classification: 'FASTER', confidence: 'threshold-based' };
    } else if (changePercent < -2 * threshold) {
        return { classification: 'REGRESSION', confidence: 'threshold-based' };
    } else if (changePercent < -threshold) {
        return { classification: 'SLOWER', confidence: 'threshold-based' };
    } else {
        return { classification: 'SAME', confidence: 'threshold-based' };
    }
}

/**
 * Classify a change using statistical significance testing
 */
function classifyChangeStatistical(beforeStats, afterStats) {
    if (!beforeStats || !afterStats || !beforeStats.raw || !afterStats.raw) {
        return {
            classification: 'UNKNOWN',
            confidence: 'no-data',
            reasoning: 'Raw measurements not available for statistical analysis'
        };
    }

    // Re-analyze raw measurements to get full statistics
    const stats1 = Statistics.analyze(beforeStats.raw);
    const stats2 = Statistics.analyze(afterStats.raw);

    return Statistics.classifyChange(stats1, stats2);
}

/**
 * Format number with thousands separator
 */
function formatNumber(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Get color code for classification
 */
function getStatusColor(classification) {
    switch (classification) {
        case 'FASTER':
        case 'SIGNIFICANT_FASTER':
        case 'LIKELY_FASTER':
            return '\x1b[32m'; // Green
        case 'REGRESSION':
        case 'SIGNIFICANT_SLOWER':
            return '\x1b[31m'; // Red
        case 'SLOWER':
        case 'LIKELY_SLOWER':
            return '\x1b[33m'; // Yellow
        default:
            return ''; // No color
    }
}

/**
 * Get display string for classification
 */
function getStatusDisplay(classification) {
    const color = getStatusColor(classification);
    const reset = color ? '\x1b[0m' : '';

    switch (classification) {
        case 'SIGNIFICANT_FASTER':
            return `${color}SIG_FASTER${reset}  `;
        case 'LIKELY_FASTER':
            return `${color}LIKELY_FAST${reset} `;
        case 'FASTER':
            return `${color}FASTER${reset}      `;
        case 'SIGNIFICANT_SLOWER':
            return `${color}SIG_SLOWER${reset}  `;
        case 'LIKELY_SLOWER':
            return `${color}LIKELY_SLOW${reset} `;
        case 'SLOWER':
            return `${color}SLOWER${reset}      `;
        case 'REGRESSION':
            return `${color}REGRESSION${reset}  `;
        case 'SAME':
            return 'SAME        ';
        default:
            return 'UNKNOWN     ';
    }
}

// Main execution
try {
    const beforeData = loadBaseline(beforeFile);
    const afterData = loadBaseline(afterFile);

    if (beforeData.results.length === 0) {
        console.error('Error: No test results found in before file');
        process.exit(1);
    }

    if (afterData.results.length === 0) {
        console.error('Error: No test results found in after file');
        process.exit(1);
    }

    // Check for v2.0/v3.0 if using statistical mode
    if (useStatistical) {
        const hasRawBefore = beforeData.results.some(
            (r) => r.statistics && r.statistics.raw
        );
        const hasRawAfter = afterData.results.some(
            (r) => r.statistics && r.statistics.raw
        );

        if (!hasRawBefore || !hasRawAfter) {
            console.warn(
                '\x1b[33mWarning: --statistical requires v2.0/v3.0 JSON baselines with raw measurements.\x1b[0m'
            );
            console.warn('Falling back to threshold-based classification.\n');
            // Don't fail, just warn - we'll handle it per-test
        }
    }

    // Create lookup map from before results
    const beforeMap = new Map();
    for (const r of beforeData.results) {
        beforeMap.set(r.name, r);
    }

    // Compare and classify
    const comparisons = [];
    const counts = {
        significant_faster: 0,
        likely_faster: 0,
        faster: 0,
        same: 0,
        likely_slower: 0,
        slower: 0,
        significant_slower: 0,
        regression: 0
    };
    let unmatchedAfter = 0;

    for (const after of afterData.results) {
        const before = beforeMap.get(after.name);

        if (!before) {
            unmatchedAfter++;
            continue;
        }

        const changePercent =
            ((after.shapesPerSec - before.shapesPerSec) / before.shapesPerSec) *
            100;

        let classificationResult;

        if (useStatistical && before.statistics && after.statistics) {
            classificationResult = classifyChangeStatistical(
                before.statistics,
                after.statistics
            );
        } else {
            classificationResult = classifyChangeThreshold(
                changePercent,
                after.name,
                after.metadata
            );
        }

        const classification = classificationResult.classification;

        // Update counts
        switch (classification) {
            case 'SIGNIFICANT_FASTER':
                counts.significant_faster++;
                break;
            case 'LIKELY_FASTER':
                counts.likely_faster++;
                break;
            case 'FASTER':
                counts.faster++;
                break;
            case 'SAME':
                counts.same++;
                break;
            case 'LIKELY_SLOWER':
                counts.likely_slower++;
                break;
            case 'SLOWER':
                counts.slower++;
                break;
            case 'SIGNIFICANT_SLOWER':
                counts.significant_slower++;
                break;
            case 'REGRESSION':
                counts.regression++;
                break;
        }

        comparisons.push({
            name: after.name,
            before: before.shapesPerSec,
            after: after.shapesPerSec,
            beforeStddev: before.stddev,
            afterStddev: after.stddev,
            change: changePercent,
            classification: classification,
            confidence: classificationResult.confidence,
            reasoning: classificationResult.reasoning,
            pValue: classificationResult.pValue,
            isSemi: isSemiTransparent(after.name, after.metadata),
            metadata: after.metadata || {}
        });
    }

    // Compute dimensional analyses if --analyze mode
    let analysisResult = null;
    if (analyzeMode) {
        const byOperation = analyzeByDimension(comparisons, 'operation');
        const byStroke = analyzeByDimension(comparisons, 'strokeCategory');
        const bySize = analyzeByDimension(comparisons, 'sizeCategory');
        const byAngle = analyzeByDimension(comparisons, 'angleCategory');

        // Cross-tabulation: operation × angle
        const opByAngle = crossTabulate(comparisons, 'operation', 'angleCategory');

        // Cross-tabulation: operation × stroke
        const opByStroke = crossTabulate(comparisons, 'operation', 'strokeCategory');

        // Compute recommendation
        const recommendation = generateRecommendation(counts, comparisons, {
            byOperation,
            byStroke,
            bySize,
            byAngle
        });

        analysisResult = {
            byOperation,
            byStroke,
            bySize,
            byAngle,
            opByAngle,
            opByStroke,
            recommendation
        };
    }

    // Output results
    if (outputFormat === 'json') {
        const output = {
            metadata: {
                beforeFile: beforeFile,
                afterFile: afterFile,
                beforeVersion: beforeData.version,
                afterVersion: afterData.version,
                thresholdOpaque: thresholdOpaque,
                thresholdSemi: thresholdSemi,
                statisticalMode: useStatistical,
                analyzeMode: analyzeMode,
                timestamp: new Date().toISOString()
            },
            summary: {
                total: comparisons.length,
                ...counts,
                unmatched: unmatchedAfter
            },
            comparisons: comparisons
        };

        // Add analysis data if --analyze mode
        if (analysisResult) {
            output.analysis = analysisResult;
        }

        const jsonOutput = JSON.stringify(output, null, 2);
        if (outputFile) {
            fs.writeFileSync(outputFile, jsonOutput, 'utf8');
            console.log(`Comparison results written to: ${outputFile}`);
        } else {
            console.log(jsonOutput);
        }
    } else {
        // Text output
        console.log('');
        console.log('='.repeat(120));
        console.log('BASELINE COMPARISON');
        console.log('='.repeat(120));
        console.log(`Before: ${beforeFile} (${beforeData.version})`);
        console.log(`After:  ${afterFile} (${afterData.version})`);
        if (useStatistical) {
            console.log('Mode: Statistical significance testing (p < 0.05)');
        } else {
            console.log(
                `Mode: Threshold-based (opaque=${thresholdOpaque}%, semi=${thresholdSemi}%)`
            );
        }
        console.log('');

        if (!quietMode) {
            // Sort by change (most regressed first)
            comparisons.sort((a, b) => a.change - b.change);

            // Calculate column width
            const maxNameLen = Math.max(
                20,
                ...comparisons.map((c) => c.name.length)
            );

            if (useStatistical) {
                console.log(
                    `| ${'Test Name'.padEnd(maxNameLen)} |     Before |      After |  Change |  p-value | Status      |`
                );
                console.log(
                    `|${'-'.repeat(maxNameLen + 2)}|------------|------------|---------|----------|-------------|`
                );
            } else {
                console.log(
                    `| ${'Test Name'.padEnd(maxNameLen)} |     Before |      After |  Change | StdDev B/A | Status      |`
                );
                console.log(
                    `|${'-'.repeat(maxNameLen + 2)}|------------|------------|---------|------------|-------------|`
                );
            }

            for (const c of comparisons) {
                const name = c.name.padEnd(maxNameLen);
                const before = formatNumber(c.before).padStart(10);
                const after = formatNumber(c.after).padStart(10);
                const change =
                    (c.change >= 0 ? '+' : '') + c.change.toFixed(1) + '%';
                const changeStr = change.padStart(7);
                const statusStr = getStatusDisplay(c.classification);

                if (useStatistical) {
                    const pValueStr = c.pValue
                        ? c.pValue.toFixed(4).padStart(8)
                        : '    N/A ';
                    console.log(
                        `| ${name} | ${before} | ${after} | ${changeStr} | ${pValueStr} | ${statusStr}|`
                    );
                } else {
                    const stddevStr =
                        `${c.beforeStddev.toFixed(0)}%/${c.afterStddev.toFixed(0)}%`.padStart(
                            10
                        );
                    console.log(
                        `| ${name} | ${before} | ${after} | ${changeStr} | ${stddevStr} | ${statusStr}|`
                    );
                }
            }
            console.log('');
        }

        // Summary
        console.log('='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`  Total tests compared: ${comparisons.length}`);

        if (useStatistical) {
            console.log(`  SIGNIFICANT_FASTER:   ${counts.significant_faster}`);
            console.log(`  LIKELY_FASTER:        ${counts.likely_faster}`);
            console.log(`  SAME:                 ${counts.same}`);
            console.log(`  LIKELY_SLOWER:        ${counts.likely_slower}`);
            console.log(`  SIGNIFICANT_SLOWER:   ${counts.significant_slower}`);
        } else {
            console.log(`  FASTER:               ${counts.faster}`);
            console.log(`  SAME:                 ${counts.same}`);
            console.log(`  SLOWER:               ${counts.slower}`);
            console.log(`  REGRESSION:           ${counts.regression}`);
        }

        if (unmatchedAfter > 0) {
            console.log(`  Unmatched (new):      ${unmatchedAfter}`);
        }
        console.log('');

        // Calculate average change
        if (comparisons.length > 0) {
            const avgChange =
                comparisons.reduce((sum, c) => sum + c.change, 0) /
                comparisons.length;
            console.log(
                `  Average change: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)}%`
            );
            console.log('');
        }

        // Detailed analysis output (--analyze mode)
        if (analyzeMode && analysisResult) {
            // Update header for detailed analysis
            console.log('');
            console.log('═'.repeat(80));
            console.log('DETAILED ANALYSIS');
            console.log('═'.repeat(80));

            // By operation type
            printDimensionBreakdown(
                'BY OPERATION TYPE',
                analysisResult.byOperation,
                DIMENSION_LABELS.operation
            );

            // By stroke width
            printDimensionBreakdown(
                'BY STROKE WIDTH',
                analysisResult.byStroke,
                DIMENSION_LABELS.strokeCategory
            );

            // By size category
            printDimensionBreakdown(
                'BY SIZE CATEGORY',
                analysisResult.bySize,
                DIMENSION_LABELS.sizeCategory
            );

            // By angle category (arc tests only)
            const hasAngleData = Object.keys(analysisResult.byAngle).some(
                (k) => k !== 'unknown'
            );
            if (hasAngleData) {
                printDimensionBreakdown(
                    'BY ARC ANGLE (arc tests only)',
                    analysisResult.byAngle,
                    DIMENSION_LABELS.angleCategory
                );
            }

            // Cross-tabulation: operation × angle
            if (hasAngleData) {
                printCrossTabMatrix(
                    'OPERATION × ARC ANGLE MATRIX',
                    analysisResult.opByAngle,
                    DIMENSION_LABELS.operation,
                    DIMENSION_LABELS.angleCategory
                );
            }

            // Top improvements and regressions
            printTopChanges(comparisons);

            // Recommendation
            printRecommendation(analysisResult.recommendation);

            console.log('');
        }

        // Final verdict
        const hasSignificantRegression =
            counts.significant_slower > 0 || counts.regression > 0;
        const hasSuggestiveRegression = counts.likely_slower > 0;

        if (hasSignificantRegression) {
            console.log('\x1b[31m❌ FAIL: Significant regressions detected!\x1b[0m');
            console.log('');
            console.log('Significant regressions:');
            for (const c of comparisons.filter(
                (x) =>
                    x.classification === 'SIGNIFICANT_SLOWER' ||
                    x.classification === 'REGRESSION'
            )) {
                const pInfo = c.pValue ? ` (p=${c.pValue.toFixed(4)})` : '';
                console.log(`  - ${c.name}: ${c.change.toFixed(1)}%${pInfo}`);
            }
        } else if (hasSuggestiveRegression) {
            console.log(
                '\x1b[33m⚠️  WARNING: Some tests show suggestive slowdowns (not statistically significant)\x1b[0m'
            );
        } else if (counts.slower > 0) {
            console.log(
                '\x1b[33m⚠️  WARNING: Some tests are slower (but within acceptable range)\x1b[0m'
            );
        } else {
            console.log('\x1b[32m✓ PASS: No significant regressions detected\x1b[0m');
        }
        console.log('');
    }

    // Exit code for CI
    const failureCount = counts.significant_slower + counts.regression;
    process.exit(failureCount > 0 ? 1 : 0);
} catch (e) {
    console.error(`Error: ${e.message}`);
    if (e.stack && process.env.DEBUG) {
        console.error(e.stack);
    }
    process.exit(1);
}

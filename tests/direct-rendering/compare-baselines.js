#!/usr/bin/env node
/**
 * Baseline Comparison Tool for SWCanvas Performance Tests
 *
 * Compares two baseline files (either text or JSON format) and outputs
 * a detailed comparison with classification of changes.
 *
 * Now supports statistical significance testing with --statistical flag
 * when using v2.0 JSON baselines with raw measurements.
 *
 * Usage:
 *   node compare-baselines.js --before <file> --after <file> [options]
 *
 * Options:
 *   --before <file>          Baseline file (before changes)
 *   --after <file>           Baseline file (after changes)
 *   --threshold-opaque <N>   Threshold for opaque tests (default: 15)
 *   --threshold-semi <N>     Threshold for semi-transparent tests (default: 25)
 *   --statistical            Use statistical significance testing (requires v2.0 JSON)
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
let outputFormat = 'text';
let quietMode = false;
let useStatistical = false;

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
                           Requires v2.0 JSON baselines with raw measurements
  --json                   Output results in JSON format
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

Examples:
  node compare-baselines.js --before baseline-before.txt --after baseline-after.txt
  node compare-baselines.js --before b1.json --after b2.json --statistical
  node compare-baselines.js --before b1.txt --after b2.txt --threshold-opaque 20
  node compare-baselines.js --before b1.txt --after b2.txt --json > comparison.json
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
 * Supports both v1.0 and v2.0 formats.
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

        // v2.0 has full statistics including raw measurements
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

    // Check for v2.0 if using statistical mode
    if (useStatistical) {
        const hasRawBefore = beforeData.results.some(
            (r) => r.statistics && r.statistics.raw
        );
        const hasRawAfter = afterData.results.some(
            (r) => r.statistics && r.statistics.raw
        );

        if (!hasRawBefore || !hasRawAfter) {
            console.warn(
                '\x1b[33mWarning: --statistical requires v2.0 JSON baselines with raw measurements.\x1b[0m'
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
            isSemi: isSemiTransparent(after.name, after.metadata)
        });
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
                timestamp: new Date().toISOString()
            },
            summary: {
                total: comparisons.length,
                ...counts,
                unmatched: unmatchedAfter
            },
            comparisons: comparisons
        };
        console.log(JSON.stringify(output, null, 2));
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

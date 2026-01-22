#!/usr/bin/env node
/**
 * Baseline Comparison Tool for SWCanvas Performance Tests
 *
 * Compares two baseline files (either text or JSON format) and outputs
 * a detailed comparison with classification of changes.
 *
 * Usage:
 *   node compare-baselines.js --before <file> --after <file> [options]
 *
 * Options:
 *   --before <file>          Baseline file (before changes)
 *   --after <file>           Baseline file (after changes)
 *   --threshold-opaque <N>   Threshold for opaque tests (default: 15)
 *   --threshold-semi <N>     Threshold for semi-transparent tests (default: 25)
 *   --json                   Output results in JSON format
 *   --quiet                  Only show summary statistics
 *   -h, --help               Show help message
 */

const fs = require('fs');
const path = require('path');

// Default thresholds
let thresholdOpaque = 15;
let thresholdSemi = 25;
let beforeFile = null;
let afterFile = null;
let outputFormat = 'text';
let quietMode = false;

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
  --json                   Output results in JSON format
  --quiet                  Only show summary statistics
  -h, --help               Show this help message

Classification:
  FASTER      - Performance improved by more than threshold
  SAME        - Within ±threshold (noise)
  SLOWER      - Performance decreased by threshold to 2×threshold
  REGRESSION  - Performance decreased by more than 2×threshold

Examples:
  node compare-baselines.js --before baseline-before.txt --after baseline-after.txt
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
        const match = line.match(/^\|\s*(.+?)\s*\|\s*([\d,]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)%?\s*\|/);

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
                    stddev: stddev
                });
            }
        }
    }

    return results;
}

/**
 * Parse a JSON baseline file and extract test results
 */
function parseJSONBaseline(content) {
    const data = JSON.parse(content);
    return data.results.map(r => ({
        name: r.name || r.id,
        shapesPerSec: r.shapesPerSec,
        usPerShape: r.usPerShape,
        stddev: r.stddev
    }));
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
function isSemiTransparent(name) {
    const lowerName = name.toLowerCase();
    return lowerName.includes('semi') ||
           lowerName.includes('alpha') ||
           (lowerName.includes('fill') && lowerName.includes('stroke') && !lowerName.includes('opaque'));
}

/**
 * Classify a change based on thresholds
 */
function classifyChange(changePercent, testName) {
    const threshold = isSemiTransparent(testName) ? thresholdSemi : thresholdOpaque;

    if (changePercent > threshold) {
        return 'FASTER';
    } else if (changePercent < -2 * threshold) {
        return 'REGRESSION';
    } else if (changePercent < -threshold) {
        return 'SLOWER';
    } else {
        return 'SAME';
    }
}

/**
 * Format number with thousands separator
 */
function formatNumber(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Main execution
try {
    const beforeResults = loadBaseline(beforeFile);
    const afterResults = loadBaseline(afterFile);

    if (beforeResults.length === 0) {
        console.error('Error: No test results found in before file');
        process.exit(1);
    }

    if (afterResults.length === 0) {
        console.error('Error: No test results found in after file');
        process.exit(1);
    }

    // Create lookup map from before results
    const beforeMap = new Map();
    for (const r of beforeResults) {
        beforeMap.set(r.name, r);
    }

    // Compare and classify
    const comparisons = [];
    let fasterCount = 0;
    let sameCount = 0;
    let slowerCount = 0;
    let regressionCount = 0;
    let unmatchedAfter = 0;

    for (const after of afterResults) {
        const before = beforeMap.get(after.name);

        if (!before) {
            unmatchedAfter++;
            continue;
        }

        const change = ((after.shapesPerSec - before.shapesPerSec) / before.shapesPerSec) * 100;
        const classification = classifyChange(change, after.name);

        switch (classification) {
            case 'FASTER': fasterCount++; break;
            case 'SAME': sameCount++; break;
            case 'SLOWER': slowerCount++; break;
            case 'REGRESSION': regressionCount++; break;
        }

        comparisons.push({
            name: after.name,
            before: before.shapesPerSec,
            after: after.shapesPerSec,
            beforeStddev: before.stddev,
            afterStddev: after.stddev,
            change: change,
            classification: classification,
            isSemi: isSemiTransparent(after.name)
        });
    }

    // Output results
    if (outputFormat === 'json') {
        const output = {
            metadata: {
                beforeFile: beforeFile,
                afterFile: afterFile,
                thresholdOpaque: thresholdOpaque,
                thresholdSemi: thresholdSemi,
                timestamp: new Date().toISOString()
            },
            summary: {
                total: comparisons.length,
                faster: fasterCount,
                same: sameCount,
                slower: slowerCount,
                regression: regressionCount,
                unmatched: unmatchedAfter
            },
            comparisons: comparisons
        };
        console.log(JSON.stringify(output, null, 2));
    } else {
        // Text output
        console.log('');
        console.log('='.repeat(110));
        console.log('BASELINE COMPARISON');
        console.log('='.repeat(110));
        console.log(`Before: ${beforeFile}`);
        console.log(`After:  ${afterFile}`);
        console.log(`Thresholds: opaque=${thresholdOpaque}%, semi-transparent=${thresholdSemi}%`);
        console.log('');

        if (!quietMode) {
            // Sort by change (most regressed first)
            comparisons.sort((a, b) => a.change - b.change);

            // Calculate column width
            const maxNameLen = Math.max(20, ...comparisons.map(c => c.name.length));

            console.log(`| ${'Test Name'.padEnd(maxNameLen)} |     Before |      After |  Change | StdDev B/A | Status     |`);
            console.log(`|${'-'.repeat(maxNameLen + 2)}|------------|------------|---------|------------|------------|`);

            for (const c of comparisons) {
                const name = c.name.padEnd(maxNameLen);
                const before = formatNumber(c.before).padStart(10);
                const after = formatNumber(c.after).padStart(10);
                const change = (c.change >= 0 ? '+' : '') + c.change.toFixed(1) + '%';
                const changeStr = change.padStart(7);
                const stddevStr = `${c.beforeStddev.toFixed(0)}%/${c.afterStddev.toFixed(0)}%`.padStart(10);

                // Color coding for terminal
                let statusStr;
                if (c.classification === 'FASTER') {
                    statusStr = '\x1b[32mFASTER\x1b[0m     ';
                } else if (c.classification === 'REGRESSION') {
                    statusStr = '\x1b[31mREGRESSION\x1b[0m ';
                } else if (c.classification === 'SLOWER') {
                    statusStr = '\x1b[33mSLOWER\x1b[0m     ';
                } else {
                    statusStr = 'SAME       ';
                }

                console.log(`| ${name} | ${before} | ${after} | ${changeStr} | ${stddevStr} | ${statusStr}|`);
            }
            console.log('');
        }

        // Summary
        console.log('='.repeat(50));
        console.log('SUMMARY');
        console.log('='.repeat(50));
        console.log(`  Total tests compared: ${comparisons.length}`);
        console.log(`  FASTER:               ${fasterCount}`);
        console.log(`  SAME:                 ${sameCount}`);
        console.log(`  SLOWER:               ${slowerCount}`);
        console.log(`  REGRESSION:           ${regressionCount}`);
        if (unmatchedAfter > 0) {
            console.log(`  Unmatched (new):      ${unmatchedAfter}`);
        }
        console.log('');

        // Calculate average change
        if (comparisons.length > 0) {
            const avgChange = comparisons.reduce((sum, c) => sum + c.change, 0) / comparisons.length;
            console.log(`  Average change: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)}%`);
            console.log('');
        }

        // Final verdict
        if (regressionCount > 0) {
            console.log('\x1b[31m❌ FAIL: Regressions detected!\x1b[0m');
            console.log('');
            console.log('Regressions:');
            for (const c of comparisons.filter(x => x.classification === 'REGRESSION')) {
                console.log(`  - ${c.name}: ${c.change.toFixed(1)}%`);
            }
        } else if (slowerCount > 0) {
            console.log('\x1b[33m⚠️  WARNING: Some tests are slower (but within acceptable range)\x1b[0m');
        } else {
            console.log('\x1b[32m✓ PASS: No regressions detected\x1b[0m');
        }
        console.log('');
    }

    // Exit code for CI
    process.exit(regressionCount > 0 ? 1 : 0);

} catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
}

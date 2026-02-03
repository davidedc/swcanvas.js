#!/usr/bin/env node
/**
 * System Optimization Benchmark
 *
 * Tests various macOS/Node.js optimizations to find which reduce benchmark variance.
 * Runs the minimal-reference-benchmark with different configurations and compares results.
 *
 * Usage:
 *   node system-optimization-benchmark.js [options]
 *
 * Options:
 *   --warmup <N>     Warmup iterations (default: 100000)
 *   --runs <N>       Measurement runs (default: 100)
 *   --shapes <N>     Shapes per run (default: 5000)
 *   --with-sudo      Include tests requiring sudo (high priority)
 *   --cooldown <ms>  Delay between tests in ms (default: 3000)
 *   --output <file>  Write results to JSON file
 *   -h, --help       Show help
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ============================================================================
// Configuration
// ============================================================================

const BENCHMARK_SCRIPT = path.join(__dirname, 'minimal-reference-benchmark.js');

// Configurations to test (in order of complexity)
const CONFIGURATIONS = [
    {
        name: 'Baseline',
        description: 'No optimizations',
        nodeArgs: [],
        wrapper: null,
        sudo: false
    },
    {
        name: 'caffeinate',
        description: 'Prevent system sleep/App Nap',
        nodeArgs: [],
        wrapper: 'caffeinate -i',
        sudo: false
    },
    {
        name: '--expose-gc',
        description: 'Enable manual garbage collection',
        nodeArgs: ['--expose-gc'],
        wrapper: null,
        sudo: false
    },
    {
        name: '--no-lazy',
        description: 'Eager JIT compilation',
        nodeArgs: ['--no-lazy'],
        wrapper: null,
        sudo: false
    },
    {
        name: 'GC + no-lazy',
        description: 'Combined V8 optimizations',
        nodeArgs: ['--expose-gc', '--no-lazy'],
        wrapper: null,
        sudo: false
    },
    {
        name: 'All V8 opts',
        description: 'All V8 flags + larger heap',
        nodeArgs: ['--expose-gc', '--no-lazy', '--max-old-space-size=4096'],
        wrapper: null,
        sudo: false
    },
    {
        name: 'caffeinate + V8',
        description: 'caffeinate with all V8 opts',
        nodeArgs: ['--expose-gc', '--no-lazy', '--max-old-space-size=4096'],
        wrapper: 'caffeinate -i',
        sudo: false
    },
    {
        name: 'High priority',
        description: 'nice -n -20 (requires sudo)',
        nodeArgs: [],
        wrapper: 'nice -n -20',
        sudo: true
    },
    {
        name: 'Full combo',
        description: 'All optimizations combined',
        nodeArgs: ['--expose-gc', '--no-lazy', '--max-old-space-size=4096'],
        wrapper: 'caffeinate -i nice -n -20',
        sudo: true
    }
];

// Default parameters
const DEFAULT_WARMUP = 100000;
const DEFAULT_RUNS = 100;
const DEFAULT_SHAPES = 5000;
const DEFAULT_COOLDOWN = 3000;

// ============================================================================
// Argument Parsing
// ============================================================================

const args = process.argv.slice(2);
let warmup = DEFAULT_WARMUP;
let runs = DEFAULT_RUNS;
let shapes = DEFAULT_SHAPES;
let cooldown = DEFAULT_COOLDOWN;
let withSudo = false;
let outputFile = null;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--warmup' && args[i + 1]) {
        warmup = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--runs' && args[i + 1]) {
        runs = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--shapes' && args[i + 1]) {
        shapes = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--cooldown' && args[i + 1]) {
        cooldown = parseInt(args[i + 1], 10);
        i++;
    } else if (arg === '--with-sudo') {
        withSudo = true;
    } else if (arg === '--output' && args[i + 1]) {
        outputFile = args[i + 1];
        i++;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
System Optimization Benchmark

Tests various macOS/Node.js optimizations to find which reduce benchmark variance.

Usage: node system-optimization-benchmark.js [options]

Options:
  --warmup <N>     Warmup iterations (default: ${DEFAULT_WARMUP})
  --runs <N>       Measurement runs (default: ${DEFAULT_RUNS})
  --shapes <N>     Shapes per run (default: ${DEFAULT_SHAPES})
  --with-sudo      Include tests requiring sudo (high priority)
  --cooldown <ms>  Delay between tests (default: ${DEFAULT_COOLDOWN}ms)
  --output <file>  Write results to JSON file
  -h, --help       Show this help

Configurations tested:
${CONFIGURATIONS.map((c, i) => `  ${i + 1}. ${c.name} - ${c.description}${c.sudo ? ' [SUDO]' : ''}`).join('\n')}

Example:
  # Quick test (no sudo)
  node system-optimization-benchmark.js --warmup 10000 --runs 50

  # Thorough test (with sudo)
  sudo node system-optimization-benchmark.js --with-sudo --warmup 100000 --runs 100
`);
        process.exit(0);
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

function delay(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        // Busy wait to keep CPU active
    }
}

function formatNumber(num) {
    return num.toLocaleString();
}

function formatCV(cv) {
    if (cv <= 2) return `\x1b[32m${cv.toFixed(2)}%\x1b[0m`;      // Green
    if (cv <= 5) return `\x1b[33m${cv.toFixed(2)}%\x1b[0m`;      // Yellow
    if (cv <= 10) return `\x1b[33m${cv.toFixed(2)}%\x1b[0m`;     // Yellow
    return `\x1b[31m${cv.toFixed(2)}%\x1b[0m`;                    // Red
}

function formatDelta(delta) {
    if (delta < -1) return `\x1b[32m${delta.toFixed(1)}%\x1b[0m`;   // Green (improvement)
    if (delta > 1) return `\x1b[31m+${delta.toFixed(1)}%\x1b[0m`;   // Red (regression)
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;          // Neutral
}

/**
 * Run a single benchmark configuration.
 */
function runBenchmark(config) {
    const tempFile = path.join(os.tmpdir(), `sysopt-bench-${Date.now()}.json`);

    // Build command
    const nodeArgs = config.nodeArgs.join(' ');
    const benchArgs = `--warmup ${warmup} --runs ${runs} --shapes ${shapes} --output "${tempFile}"`;

    let cmd;
    if (config.wrapper) {
        cmd = `${config.wrapper} node ${nodeArgs} "${BENCHMARK_SCRIPT}" ${benchArgs}`;
    } else {
        cmd = `node ${nodeArgs} "${BENCHMARK_SCRIPT}" ${benchArgs}`;
    }

    try {
        // Run benchmark (suppress stdout, only show stderr for progress)
        execSync(cmd, {
            stdio: ['inherit', 'pipe', 'inherit'],
            timeout: 600000,  // 10 minute timeout
            cwd: path.join(__dirname, '../../..')
        });

        // Parse results
        if (fs.existsSync(tempFile)) {
            const data = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            fs.unlinkSync(tempFile);
            return {
                success: true,
                cv: data.statistics.cv,
                mean: data.statistics.mean,
                stddev: data.statistics.stddev,
                shapesPerSec: data.statistics.shapesPerSec,
                assessment: data.assessment.code,
                raw: data
            };
        } else {
            return { success: false, error: 'No output file generated' };
        }
    } catch (err) {
        // Clean up temp file if it exists
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        return { success: false, error: err.message };
    }
}

// ============================================================================
// Main Execution
// ============================================================================

function main() {
    console.log('\n' + '='.repeat(70));
    console.log('SYSTEM OPTIMIZATION BENCHMARK');
    console.log('='.repeat(70));

    console.log('\nConfiguration:');
    console.log(`  Warmup:     ${formatNumber(warmup)} iterations`);
    console.log(`  Runs:       ${formatNumber(runs)}`);
    console.log(`  Shapes:     ${formatNumber(shapes)} per run`);
    console.log(`  Cooldown:   ${formatNumber(cooldown)}ms between tests`);
    console.log(`  Sudo tests: ${withSudo ? 'enabled' : 'disabled'}`);

    // Check if running as root when sudo tests requested
    if (withSudo && process.getuid && process.getuid() !== 0) {
        console.log('\n\x1b[33mWARNING: --with-sudo specified but not running as root.');
        console.log('Sudo tests will be skipped. Run with: sudo node ...\x1b[0m');
        // Don't exit, just skip sudo tests
    }

    const isRoot = process.getuid ? process.getuid() === 0 : false;

    // Filter configurations
    const configsToRun = CONFIGURATIONS.filter(c => {
        if (c.sudo && !withSudo) return false;
        if (c.sudo && withSudo && !isRoot) return false;
        return true;
    });

    console.log(`\nRunning ${configsToRun.length} configuration(s)...\n`);

    const results = [];
    let baselineCV = null;

    for (let i = 0; i < configsToRun.length; i++) {
        const config = configsToRun[i];

        console.log('-'.repeat(70));
        console.log(`[${i + 1}/${configsToRun.length}] ${config.name}`);
        console.log(`    ${config.description}`);

        const result = runBenchmark(config);

        if (result.success) {
            // Store baseline for comparison
            if (i === 0) {
                baselineCV = result.cv;
            }

            const deltaCV = result.cv - baselineCV;
            const deltaPct = baselineCV > 0 ? ((result.cv - baselineCV) / baselineCV) * 100 : 0;

            results.push({
                name: config.name,
                description: config.description,
                cv: result.cv,
                mean: result.mean,
                stddev: result.stddev,
                shapesPerSec: result.shapesPerSec,
                assessment: result.assessment,
                deltaCV,
                deltaPct
            });

            console.log(`    CV: ${formatCV(result.cv)} (${formatDelta(deltaPct)} vs baseline)`);
            console.log(`    Throughput: ${formatNumber(result.shapesPerSec)} shapes/sec`);
        } else {
            console.log(`    \x1b[31mFAILED: ${result.error}\x1b[0m`);
            results.push({
                name: config.name,
                description: config.description,
                error: result.error
            });
        }

        // Cooldown between tests
        if (i < configsToRun.length - 1) {
            console.log(`    Cooling down (${cooldown}ms)...`);
            delay(cooldown);
        }
    }

    // ========================================================================
    // Summary
    // ========================================================================

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    // Find best configuration
    const successfulResults = results.filter(r => r.cv !== undefined);
    const bestResult = successfulResults.reduce((best, r) =>
        (!best || r.cv < best.cv) ? r : best, null);

    // Print table header
    console.log('\n' + '-'.repeat(70));
    console.log(
        'Configuration'.padEnd(22) +
        'CV'.padStart(10) +
        'Delta'.padStart(12) +
        'Shapes/sec'.padStart(15) +
        'Assessment'.padStart(12)
    );
    console.log('-'.repeat(70));

    // Print results
    for (const r of results) {
        if (r.error) {
            console.log(
                r.name.padEnd(22) +
                '\x1b[31mFAILED\x1b[0m'.padStart(10)
            );
        } else {
            const isBest = r === bestResult;
            const prefix = isBest ? '\x1b[32m→ ' : '  ';
            const suffix = isBest ? '\x1b[0m' : '';

            console.log(
                prefix +
                r.name.padEnd(20) +
                suffix +
                formatCV(r.cv).padStart(18) +
                formatDelta(r.deltaPct).padStart(20) +
                formatNumber(r.shapesPerSec).padStart(15) +
                r.assessment.padStart(12)
            );
        }
    }

    console.log('-'.repeat(70));

    // Best configuration summary
    if (bestResult) {
        const improvement = baselineCV > 0 ? ((baselineCV - bestResult.cv) / baselineCV) * 100 : 0;

        console.log(`\nBest configuration: \x1b[32m${bestResult.name}\x1b[0m`);
        console.log(`  CV: ${bestResult.cv.toFixed(2)}% (${improvement.toFixed(1)}% improvement vs baseline)`);

        // Recommendation
        console.log('\nRecommendation:');
        if (bestResult.cv <= 5) {
            console.log('  \x1b[32mVariance is acceptable for benchmarking.\x1b[0m');
        } else if (bestResult.cv <= 10) {
            console.log('  \x1b[33mVariance is marginal. Results may have limited precision.\x1b[0m');
        } else {
            console.log('  \x1b[31mVariance is still high. Consider:');
            console.log('    - Closing more background applications');
            console.log('    - Running on AC power (not battery)');
            console.log('    - Disabling Spotlight: sudo mdutil -a -i off');
            console.log('    - Using a cooler environment\x1b[0m');
        }
    }

    console.log('');

    // ========================================================================
    // JSON Output
    // ========================================================================

    if (outputFile) {
        const output = {
            timestamp: new Date().toISOString(),
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                cpus: os.cpus()[0]?.model || 'unknown'
            },
            config: {
                warmup,
                runs,
                shapes,
                cooldown,
                withSudo
            },
            results: results.map(r => ({
                name: r.name,
                description: r.description,
                cv: r.cv,
                mean: r.mean,
                stddev: r.stddev,
                shapesPerSec: r.shapesPerSec,
                assessment: r.assessment,
                deltaCV: r.deltaCV,
                deltaPct: r.deltaPct,
                error: r.error
            })),
            summary: bestResult ? {
                bestConfig: bestResult.name,
                bestCV: bestResult.cv,
                baselineCV,
                improvementPct: baselineCV > 0 ? ((baselineCV - bestResult.cv) / baselineCV) * 100 : 0
            } : null
        };

        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`Results written to: ${outputFile}\n`);
    }
}

// Run
main();

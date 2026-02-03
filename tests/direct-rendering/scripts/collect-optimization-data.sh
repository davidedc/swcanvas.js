#!/bin/bash
#
# Collect multiple runs of system-optimization-benchmark for analysis
#
# Usage:
#   ./collect-optimization-data.sh [iterations]
#
# Default: 5 iterations
# Results saved to: /tmp/sysopt-results/
#

set -e

ITERATIONS=${1:-5}
RESULTS_DIR="/tmp/sysopt-results"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCHMARK="$SCRIPT_DIR/system-optimization-benchmark.js"

# Create results directory
mkdir -p "$RESULTS_DIR"
rm -f "$RESULTS_DIR"/*.json 2>/dev/null || true

echo "========================================"
echo "Collecting $ITERATIONS benchmark runs"
echo "Results will be saved to: $RESULTS_DIR"
echo "========================================"
echo ""

for i in $(seq 1 $ITERATIONS); do
    echo "========== RUN $i of $ITERATIONS =========="
    OUTPUT_FILE="$RESULTS_DIR/run-$(printf '%02d' $i)-$(date +%H%M%S).json"

    node "$BENCHMARK" \
        --warmup 50000 \
        --runs 100 \
        --shapes 3000 \
        --cooldown 2000 \
        --output "$OUTPUT_FILE"

    # Brief pause between runs to let system settle
    if [ $i -lt $ITERATIONS ]; then
        echo ""
        echo "Pausing 10 seconds before next run..."
        sleep 10
    fi
done

echo ""
echo "========================================"
echo "Collection complete!"
echo "========================================"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""
ls -la "$RESULTS_DIR"/*.json
echo ""
echo "Summary of CV values per configuration:"
echo ""

# Quick summary using node
node -e "
const fs = require('fs');
const path = require('path');

const dir = '$RESULTS_DIR';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

// Collect data by configuration
const byConfig = {};

files.forEach((file, idx) => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    data.results.forEach(r => {
        if (r.cv !== undefined) {
            if (!byConfig[r.name]) byConfig[r.name] = [];
            byConfig[r.name].push(r.cv);
        }
    });
});

// Print summary
console.log('Configuration'.padEnd(20) + 'Runs'.padStart(6) + 'Mean CV'.padStart(10) + 'Min CV'.padStart(10) + 'Max CV'.padStart(10) + 'Spread'.padStart(10));
console.log('-'.repeat(66));

const configOrder = ['Baseline', 'caffeinate', '--expose-gc', '--no-lazy', 'GC + no-lazy', 'All V8 opts', 'caffeinate + V8', 'High priority', 'Full combo'];

for (const name of configOrder) {
    const cvs = byConfig[name];
    if (!cvs || cvs.length === 0) continue;

    const mean = cvs.reduce((a,b) => a+b, 0) / cvs.length;
    const min = Math.min(...cvs);
    const max = Math.max(...cvs);
    const spread = max - min;

    console.log(
        name.padEnd(20) +
        cvs.length.toString().padStart(6) +
        (mean.toFixed(2) + '%').padStart(10) +
        (min.toFixed(2) + '%').padStart(10) +
        (max.toFixed(2) + '%').padStart(10) +
        (spread.toFixed(2) + '%').padStart(10)
    );
}

console.log('-'.repeat(66));
console.log('');
console.log('Best configuration per run:');
files.forEach((file, idx) => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (data.summary) {
        console.log('  Run ' + (idx+1) + ': ' + data.summary.bestConfig + ' (' + data.summary.bestCV.toFixed(2) + '% CV)');
    }
});
"

echo ""
echo "To analyze further, read the JSON files in: $RESULTS_DIR"

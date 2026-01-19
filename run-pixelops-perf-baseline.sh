#!/bin/bash
# run-pixelops-perf-baseline.sh
# Performance baseline for PixelOps consolidation refactoring

set -e
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p perf-baselines
OUTPUT="perf-baselines/pixelops-baseline-$TIMESTAMP.txt"

RUNS=20
SHAPES=2000

echo "=== PixelOps Consolidation Performance Baseline ===" | tee "$OUTPUT"
echo "Timestamp: $(date)" | tee -a "$OUTPUT"
echo "Git commit: $(git rev-parse --short HEAD)" | tee -a "$OUTPUT"
echo "Config: $RUNS runs, $SHAPES shapes" | tee -a "$OUTPUT"
echo "" | tee -a "$OUTPUT"

# Circle tests (MOST CRITICAL - 8 inline writes per Bresenham iteration)
echo "=== CIRCLE TESTS ===" | tee -a "$OUTPUT"
for STROKE in sw1px swM; do
  for SIZE in szM szL; do
    echo "Running: circle $STROKE $SIZE..."
    echo "--- circle $STROKE $SIZE ---" | tee -a "$OUTPUT"
    npm run test:direct-rendering:perf -- \
      -t circle-perf \
      --stroke=$STROKE \
      --size=$SIZE \
      -r $RUNS -s $SHAPES -q 2>&1 | tee -a "$OUTPUT"
    echo "" | tee -a "$OUTPUT"
  done
done

# Rect AA tests - NOTE: use --shape=rect to exclude roundrect
echo "=== RECT AA TESTS ===" | tee -a "$OUTPUT"
for STROKE in sw0 sw1px swM; do
  for SIZE in szM szL; do
    echo "Running: rect-aa $STROKE $SIZE..."
    echo "--- rect-aa $STROKE $SIZE ---" | tee -a "$OUTPUT"
    npm run test:direct-rendering:perf -- \
      -t rect-aa-perf \
      --shape=rect \
      --stroke=$STROKE \
      --size=$SIZE \
      -r $RUNS -s $SHAPES -q 2>&1 | tee -a "$OUTPUT"
    echo "" | tee -a "$OUTPUT"
  done
done

# Arc tests - use --angle=angM to test one representative angle
echo "=== ARC TESTS ===" | tee -a "$OUTPUT"
for STROKE in sw0 sw1px swM; do
  for SIZE in szM szL; do
    echo "Running: arc $STROKE $SIZE..."
    echo "--- arc $STROKE $SIZE ---" | tee -a "$OUTPUT"
    npm run test:direct-rendering:perf -- \
      -t arc-perf \
      --stroke=$STROKE \
      --size=$SIZE \
      --angle=angM \
      -r $RUNS -s $SHAPES -q 2>&1 | tee -a "$OUTPUT"
    echo "" | tee -a "$OUTPUT"
  done
done

echo "" | tee -a "$OUTPUT"
echo "=== BASELINE COMPLETE ===" | tee -a "$OUTPUT"
echo "Baseline saved to: $OUTPUT"

# Performance Testing Workflow

A methodical guide for using SWCanvas performance tests to benchmark code changes—whether to detect regressions, verify improvements, or discover performance characteristics.

For technical details on how benchmarking works (VSync cliff detection, timing mechanics), see [PERFORMANCE-BENCHMARKING.md](PERFORMANCE-BENCHMARKING.md).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Phase 1: Understand the Change](#2-phase-1-understand-the-change)
3. [Phase 2: Identify Relevant Tests](#3-phase-2-identify-relevant-tests)
4. [Phase 3: Determine Test Parameters](#4-phase-3-determine-test-parameters)
5. [Phase 4: Execute and Collect Data](#5-phase-4-execute-and-collect-data)
6. [Phase 5: Analyze and Conclude](#6-phase-5-analyze-and-conclude)
7. [Advanced Techniques](#7-advanced-techniques)
8. [Case Study: RoundedRect SpanOps Refactoring](#8-case-study-roundedrect-spanops-refactoring)
9. [Quick Reference](#9-quick-reference)

---

## 1. Overview

### When to Use This Workflow

Use performance testing when:

- **Refactoring rendering code**: Verify no regressions when consolidating or restructuring code
- **Optimizing performance**: Confirm improvements and ensure no regressions elsewhere
- **Exploring performance characteristics**: Understand which operations are fast/slow
- **Modifying hot paths**: Code executed per-shape, per-pixel, or per-scanline
- **Comparing approaches**: Evaluate trade-offs between different implementations

### The Five-Phase Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. UNDERSTAND    →   2. IDENTIFY    →   3. DETERMINE   →   4. EXECUTE     │
│     the change         relevant           test              and collect    │
│                        tests              parameters        data           │
│                                                                            │
│                              ↓                                             │
│                         5. ANALYZE                                         │
│                            and conclude                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Baseline before changing**: Always capture baseline metrics before modifying code
2. **Match test coverage to change scope**: Test all code paths affected by your change
3. **Account for variance**: Use enough runs to achieve statistical significance
4. **Document everything**: Save both raw data and analysis for future reference

---

## 2. Phase 1: Understand the Change

### 2.1 Identify Affected Code Paths

Before selecting tests, map out which rendering paths your change affects:

| Question | Why It Matters |
|----------|----------------|
| Which shape types? | Determines which test categories to include |
| Which operations (fill/stroke/both)? | Different algorithms for fill vs stroke |
| Which stroke widths (0/1px/>1px)? | Different code paths (none/Bresenham/thick) |
| Axis-aligned or rotated? | AA and Rot often use completely different code |
| Opaque or semi-transparent? | Alpha blending adds overhead, separate path |

### 2.2 Predict Performance Impact

Form a hypothesis about expected performance changes:

| Prediction | Testing Strategy |
|------------|------------------|
| **No change expected** | Verify no regressions (look for >15% slowdowns) |
| **Improvement expected** | Verify improvement, check for regressions elsewhere |
| **Mixed impact** | Identify which paths improve/regress, assess trade-offs |
| **Uncertain** | Comprehensive testing across all affected paths |

### 2.3 Example: RoundedRect SpanOps Refactoring

**Change**: Refactor rounded rectangle rendering to use existing `SpanOps` pattern, reducing code duplication.

**Affected code paths**:
- `RoundedRectOpsAA.js` (axis-aligned)
- `RoundedRectOpsRot.js` (rotated)

**Operations affected**:
- Fill operations (opaque and semi-transparent)
- Stroke operations (1px Bresenham, thick strokes)
- Combined fill+stroke

**Prediction**: Code consolidation should maintain performance; potential for minor overhead from abstraction or minor gains from shared optimizations.

---

## 3. Phase 2: Identify Relevant Tests

### 3.1 Test Dimensions

SWCanvas parametric performance tests cover these dimensions:

| Dimension | Categories | Filter Flag |
|-----------|------------|-------------|
| **Shape type** | line, rect, circle, roundrect, arc | `--shape=` or `-t` |
| **Stroke width** | sw0, sw1px, swXXS-swXXL | `--stroke=` |
| **Shape size** | szXXS-szXXL | `--size=` |
| **Operation** | fill-opaque, stroke-semi, fill-opaque-stroke-opaque, etc. | `--op=` |
| **Orientation** | aa (axis-aligned), rot (rotated) | `--orient=` or `-t` |
| **Arc angle** | angS, angM, angL, angXL | `--angle=` |

### 3.2 Selecting a Compact Test Set

**Goal**: Cover all affected code paths with minimum redundancy.

**Strategy**:
1. Include each distinct algorithm/code path at least once
2. Test representative sizes (typically Medium and Large)
3. Include both opaque and semi-transparent variants
4. Skip redundant combinations

### 3.3 Skip Logic

Not all combinations are valid or meaningful:

| Combination | Skip Reason |
|-------------|-------------|
| sw0 + stroke operations | No stroke to draw with lineWidth=0 |
| fill-only + sw1px/swM | Fill-only requires sw0 |
| Very small sizes (szXXS) | Edge cases, not representative |
| Very large sizes (szXXL) | Similar to L, adds test time |

### 3.4 Example: RoundedRect Test Matrix

For the SpanOps refactoring, the relevant test matrix:

**Stroke width** (3 categories covering distinct code paths):
- `sw0`: Fill-only operations
- `sw1px`: Bresenham stroke algorithm
- `swM`: Thick stroke algorithm (10-20px representative)

**Size** (2 categories):
- `szM`: Medium (40-79px) - typical use case
- `szL`: Large (80-159px) - stress test

**Orientation** (2 categories):
- `aa`: Axis-aligned (RoundedRectOpsAA)
- `rot`: Rotated (RoundedRectOpsRot)

**Operations per stroke category**:
- sw0: 2 (fill-opaque, fill-semi)
- sw1px/swM: 6 (all stroke and fill+stroke combinations)

**Total**: (2 + 6 + 6) × 2 sizes × 2 orientations = **56 tests**

---

## 4. Phase 3: Determine Test Parameters

### 4.1 Statistical Significance

Performance measurements have inherent variance. Configure tests for reliable results:

| Parameter | Recommendation | Rationale |
|-----------|----------------|-----------|
| **Runs per test** | 20 | Balances precision with test duration |
| **Shapes per run** | 1000-2000 | Enough work to smooth timing noise |
| **Warmup iterations** | 100 (default) | JIT optimization warm-up |

### 4.2 Expected Variance

Observed standard deviation varies by operation type:

| Operation Type | Typical StdDev | Detection Threshold |
|----------------|----------------|---------------------|
| Opaque operations | 5-15% | 15% change is significant |
| Semi-transparent | 15-30% | 25% change is significant |

**Rule of thumb**: A change must exceed 2× the typical stddev to be considered significant.

See [Section 7.5: Updated Regression Thresholds](#75-updated-regression-thresholds) for detailed thresholds by operation type.

### 4.3 Command Line Filters

List available tests:
```bash
npm run test:direct-rendering:perf -- --help
npm run test:direct-rendering:perf -- -t roundrect --list
```

Filter syntax:
```bash
npm run test:direct-rendering:perf -- \
  -t roundrect-aa-perf \    # Test name filter (substring match)
  --stroke=sw1px \          # Stroke width category
  --size=szM \              # Shape size category
  --op=stroke-opaque \      # Operation type (optional)
  -r 20 \                   # Number of runs
  -s 2000 \                 # Shapes per run
  -q                        # Quiet mode (summary only)
```

### 4.4 Example: RoundedRect Filter Commands

```bash
# AA tests - fill-only (sw0)
npm run test:direct-rendering:perf -- -t roundrect-aa-perf --stroke=sw0 --size=szM -r 20 -s 2000 -q
npm run test:direct-rendering:perf -- -t roundrect-aa-perf --stroke=sw0 --size=szL -r 20 -s 2000 -q

# AA tests - 1px stroke
npm run test:direct-rendering:perf -- -t roundrect-aa-perf --stroke=sw1px --size=szM -r 20 -s 2000 -q
npm run test:direct-rendering:perf -- -t roundrect-aa-perf --stroke=sw1px --size=szL -r 20 -s 2000 -q

# AA tests - thick stroke
npm run test:direct-rendering:perf -- -t roundrect-aa-perf --stroke=swM --size=szM -r 20 -s 2000 -q
npm run test:direct-rendering:perf -- -t roundrect-aa-perf --stroke=swM --size=szL -r 20 -s 2000 -q

# Rotated tests - same pattern with roundrect-rot-perf
npm run test:direct-rendering:perf -- -t roundrect-rot-perf --stroke=sw0 --size=szM -r 20 -s 2000 -q
# ... etc.
```

---

## 5. Phase 4: Execute and Collect Data

### 5.1 Create a Baseline Script

Automate baseline collection to ensure consistency:

```bash
#!/bin/bash
# run-perf-baseline.sh - Customize for your test matrix

set -e
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p perf-baselines
OUTPUT="perf-baselines/baseline-$TIMESTAMP.txt"

RUNS=20
SHAPES=2000

echo "=== Performance Baseline ===" | tee "$OUTPUT"
echo "Timestamp: $(date)" | tee -a "$OUTPUT"
echo "Git commit: $(git rev-parse --short HEAD)" | tee -a "$OUTPUT"
echo "Config: $RUNS runs, $SHAPES shapes" | tee -a "$OUTPUT"
echo "" | tee -a "$OUTPUT"

# Customize these loops for your test matrix
for ORIENT in aa rot; do
  for STROKE in sw0 sw1px swM; do
    for SIZE in szM szL; do
      echo "Running: $ORIENT $STROKE $SIZE..."
      echo "--- $ORIENT $STROKE $SIZE ---" | tee -a "$OUTPUT"
      npm run test:direct-rendering:perf -- \
        -t roundrect-${ORIENT}-perf \
        --stroke=$STROKE \
        --size=$SIZE \
        -r $RUNS -s $SHAPES -q 2>&1 | \
        grep -E "^\|.*\|$" | tee -a "$OUTPUT"
      echo "" | tee -a "$OUTPUT"
    done
  done
done

echo "Baseline saved to: $OUTPUT"
```

### 5.2 Data Collection Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  BEFORE REFACTORING                                             │
│  1. Ensure clean git state (commit or stash changes)            │
│  2. Run: npm run build                                          │
│  3. Run: ./run-perf-baseline.sh                                 │
│  4. Note filename: perf-baselines/baseline-YYYYMMDD_HHMMSS.txt  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PERFORM REFACTORING                                            │
│  Make your code changes                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  AFTER REFACTORING                                              │
│  1. Run: npm run build                                          │
│  2. Run: npm test (ensure correctness first!)                   │
│  3. Run: ./run-perf-baseline.sh                                 │
│  4. Note filename: perf-baselines/baseline-YYYYMMDD_HHMMSS.txt  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Output Format

The test runner produces a summary table:

```
================================================================================
SUMMARY
================================================================================
| Test Name                                              | Shapes/sec |  us/shape | StdDev |
|--------------------------------------------------------|------------|-----------|--------|
| RoundRect AA Fill Opaque: 0px (No Stroke), M (40-79px) |    614,196 |       1.6 |  32.9% |
| RoundRect AA Fill Semi: 0px (No Stroke), M (40-79px)   |     75,738 |      13.2 |  34.8% |
...
```

**Key metrics**:
- **Shapes/sec**: Primary comparison metric (higher is better)
- **us/shape**: Microseconds per shape (lower is better)
- **StdDev**: Measurement variance (lower = more reliable)

---

## 6. Phase 5: Analyze and Conclude

### 6.1 Compare Results

**Simple diff approach**:
```bash
diff -y perf-baselines/baseline-BEFORE.txt perf-baselines/baseline-AFTER.txt | less
```

**Extract shapes/sec for comparison**:
```bash
grep "RoundRect" perf-baselines/baseline-BEFORE.txt | awk -F'|' '{print $2, $3}' > before.txt
grep "RoundRect" perf-baselines/baseline-AFTER.txt | awk -F'|' '{print $2, $3}' > after.txt
paste before.txt after.txt | column -t
```

**Calculate percentage change**:
```
Change % = ((After - Before) / Before) × 100
```

### 6.2 Regression Classification

| Change | Classification | Action |
|--------|----------------|--------|
| > +5% | **FASTER** | Improvement, document it |
| -5% to +5% | **~same** | Within noise, acceptable |
| -5% to -15% | **SLOWER** | Minor slowdown, evaluate trade-off |
| < -15% | **REGRESSION** | Significant regression, investigate |

**Note**: Use stricter thresholds (±10%) for low-variance opaque tests, looser thresholds (±20%) for high-variance semi-transparent tests.

### 6.3 Aggregated Analysis

Group results by category to identify patterns:

| Grouping | What to Look For |
|----------|------------------|
| By orientation (AA vs Rot) | Did one code path regress while other improved? |
| By stroke width | Did a specific algorithm (Bresenham, thick) regress? |
| By transparency | Semi-transparent often has different characteristics |
| By size | Larger shapes stress different bottlenecks |

### 6.4 Drawing Conclusions

**Safe to ship if**:
- No regressions (>15% slower) in any test
- Slowdowns (-5% to -15%) are isolated and understood
- Overall trend is neutral or positive

**Needs investigation if**:
- Any regression >15%
- Pattern of slowdowns in a specific category
- Unexpected variance increase

**Document your findings**:
```
CONCLUSION: [SAFE/NEEDS WORK]

Summary:
- X tests faster, Y tests same, Z tests slower, W regressions
- Average change: +X.X%

Notable changes:
- [Category] improved by X% due to [reason]
- [Category] regressed by X% due to [reason]

Decision: [Ship as-is / Investigate further / Revert]
```

---

## 7. Advanced Techniques

### 7.1 Noise Floor Validation

When analyzing performance changes, **unchanged code paths serve as controls** to establish the noise floor for the current test run.

**Why this matters**: Performance measurements vary due to system load, JIT optimization, CPU throttling, and other factors. By including tests for code paths you didn't modify, you get a baseline for how much variance to expect.

**How to use control tests**:
1. Include tests for unchanged code paths in your baseline collection
2. Calculate the variance observed in unchanged tests
3. Use this as your noise floor threshold
4. Changes must exceed 2× the observed noise floor to be significant

**Expected variance by operation type**:

| Operation Type | Typical StdDev | Noise Floor (2× StdDev) |
|----------------|----------------|-------------------------|
| Opaque operations | 5-15% | 10-30% |
| Semi-transparent | 15-30% | 30-60% |
| Fill+Stroke combined | 20-40% | 40-80% |

**Example**: If your control tests show ±12% variance, then:
- Changes < 24% are likely noise
- Changes > 24% warrant investigation
- Changes > 48% are highly significant

### 7.2 Incremental Change Assessment

For complex refactoring involving multiple code paths, use incremental assessment:

**Pattern**:
1. Implement changes one at a time (one file or one method)
2. Run performance baseline after each change
3. Use unimplemented changes as control tests
4. Build confidence incrementally

**Benefits**:
- Isolate performance impact of each individual change
- Catch regressions immediately when they're introduced
- Easier to investigate and fix issues
- Provides clear before/after for each modification

**Example workflow** (refactoring 4 files):
```
1. Baseline: all 4 files unchanged
2. Modify file A, baseline → Files B,C,D are controls
3. Modify file B, baseline → Files C,D are controls
4. Modify file C, baseline → File D is control
5. Modify file D, final baseline → Compare to step 1
```

### 7.3 High StdDev Handling

High standard deviation indicates unstable measurements. Use this guide:

| StdDev Range | Assessment | Recommended Action |
|--------------|------------|-------------------|
| < 20% | Good | Results are reliable |
| 20-35% | Acceptable | Consider more runs if comparing close values |
| 35-50% | Marginal | Increase runs to 40; investigate if persists |
| > 50% | Unstable | Investigate cause; may indicate GC pressure or test instability |

**Common causes of high StdDev**:
- **GC pressure**: Large temporary allocations cause unpredictable pauses
- **JIT warmup**: Insufficient warmup iterations
- **Fill+Stroke operations**: Inherently more variable than single operations
- **Very small shapes**: Per-shape overhead dominates timing

**Mitigation strategies**:
1. Increase runs: `-r 40` instead of `-r 20`
2. Increase shapes: `-s 5000` instead of `-s 2000`
3. Use stroke-only or fill-only tests when possible (more stable)
4. Close background applications during benchmarking

### 7.4 File Naming Convention

Use consistent naming for baseline files to maintain organization:

**Standard patterns**:
```
baseline-YYYYMMDD_HHMMSS.txt              # Generic timestamped baseline
baseline-YYYYMMDD_HHMMSS-before.txt       # Explicit "before" marker
baseline-YYYYMMDD_HHMMSS-after.txt        # Explicit "after" marker
baseline-FEATURE_NAME-before.txt          # Feature-specific baseline
baseline-FEATURE_NAME-after.txt           # Feature-specific comparison
```

**Examples**:
```
baseline-20260121_143022.txt              # Quick snapshot
baseline-20260121_143022-before.txt       # Before refactoring
baseline-20260121_150315-after.txt        # After refactoring
baseline-circle-ops-refactor-before.txt   # Named baseline pair
baseline-circle-ops-refactor-after.txt
baseline-spanops-v2-before.txt            # Version-specific
```

**Recommendations**:
- Use `--name` flag when running baseline script for meaningful names
- Keep before/after pairs together chronologically
- Archive old baselines to `perf-baselines/archive/` after analysis
- Include git commit hash in baseline metadata (done automatically)

### 7.5 Updated Regression Thresholds

Based on practical observations, use these thresholds:

| Test Type | Typical StdDev | Significant Change | Strong Signal |
|-----------|----------------|-------------------|---------------|
| Opaque stroke-only | 10-20% | >25% | >50% |
| Opaque fill-only | 8-15% | >20% | >40% |
| Semi stroke-only | 15-25% | >40% | >100% |
| Semi fill-only | 12-20% | >30% | >60% |
| Fill+Stroke opaque | 15-25% | >35% | >70% |
| Fill+Stroke semi | 25-40% | >60% | >100% |

**Interpretation guide**:
- **Significant Change**: Exceeds typical noise; warrants attention
- **Strong Signal**: Very likely a real change; high confidence

**Note**: These are guidelines. Always validate against control tests in your specific run.

---

## 8. Case Study: RoundedRect SpanOps Refactoring

### 8.1 Context

**Change**: Refactor `RoundedRectOpsAA.js` and `RoundedRectOpsRot.js` to use existing `SpanOps` pattern, reducing code duplication.

**Hypothesis**: Performance should be maintained; code consolidation might introduce minor overhead or minor gains.

### 8.2 Test Selection

**Test matrix** (56 tests total):

| Orientation | Stroke | Sizes | Operations | Tests |
|-------------|--------|-------|------------|-------|
| AA | sw0 | szM, szL | 2 (fill-only) | 4 |
| AA | sw1px | szM, szL | 6 | 12 |
| AA | swM | szM, szL | 6 | 12 |
| Rot | sw0 | szM, szL | 2 (fill-only) | 4 |
| Rot | sw1px | szM, szL | 6 | 12 |
| Rot | swM | szM, szL | 6 | 12 |

**Parameters**: 20 runs, 2000 shapes per run

### 8.3 Results Summary

| Category | Count |
|----------|-------|
| FASTER (>+5%) | 24 tests |
| ~same (-5% to +5%) | 26 tests |
| SLOWER (-5% to -15%) | 6 tests |
| REGRESSION (<-15%) | **0 tests** |
| **Average change** | **+6.0%** |

### 8.4 Notable Findings

**Top improvements** (rotated thick stroke paths):
| Test | Before | After | Change |
|------|--------|-------|--------|
| Rot Fill+Stroke Semi, swM, L | 17,825 | 25,112 | +40.9% |
| Rot Fill+Stroke Semi, swM, M | 31,556 | 43,333 | +37.3% |
| Rot Fill Semi, sw0, L | 15,605 | 20,562 | +31.8% |

**Minor slowdowns** (within acceptable variance):
| Test | Before | After | Change |
|------|--------|-------|--------|
| Rot Fill+Stroke Semi, sw1px, L | 9,959 | 8,907 | -10.6% |
| AA Fill Semi, sw0, M | 75,738 | 68,839 | -9.1% |

### 8.5 Conclusion

**SAFE TO SHIP**

- No regressions detected
- 24 tests improved, 26 unchanged, 6 minor slowdowns
- Slowdowns are within expected variance for semi-transparent operations
- Significant improvements in rotated thick stroke rendering (+15-41%)

---

## 9. Quick Reference

### Command Cheat Sheet

```bash
# List all available performance tests
npm run test:direct-rendering:perf -- --list

# List tests matching a filter
npm run test:direct-rendering:perf -- -t roundrect --list

# Run with specific filters
npm run test:direct-rendering:perf -- \
  -t roundrect-aa-perf \
  --stroke=sw1px \
  --size=szM \
  -r 20 -s 2000 -q

# Run all roundrect tests for a specific size
npm run test:direct-rendering:perf -- -t roundrect --size=szM -r 20 -s 2000 -q
```

### Filter Quick Reference

| Filter | Values | Example |
|--------|--------|---------|
| `-t`, `--test=` | Test name substring | `-t roundrect-aa` |
| `--stroke=` | sw0, sw1px, swXXS-swXXL | `--stroke=sw1px` |
| `--size=` | szXXS-szXXL | `--size=szM` |
| `--op=` | fill-opaque, stroke-semi, etc. | `--op=stroke-opaque` |
| `--orient=` | aa, rot, horiz, vert | `--orient=aa` |
| `--shape=` | line, rect, circle, roundrect, arc | `--shape=circle` |
| `-r`, `--runs=` | Number of runs | `-r 20` |
| `-s`, `--shapes=` | Shapes per run | `-s 2000` |
| `-q`, `--quiet` | Summary only | `-q` |
| `--list` | List without running | `--list` |

### Regression Thresholds

| Test Type | Typical StdDev | Significant Change |
|-----------|----------------|-------------------|
| Opaque | 5-15% | >15% |
| Semi-transparent | 15-30% | >25% |

### Files to Save

```
perf-baselines/
├── baseline-FEATURE-before.txt      # Named baseline (before)
├── baseline-FEATURE-after.txt       # Named baseline (after)
├── baseline-YYYYMMDD_HHMMSS.txt     # Timestamped snapshot
└── archive/                          # Old baselines for reference
```

See [Section 7.4: File Naming Convention](#74-file-naming-convention) for naming guidelines.

### Comparison Commands

```bash
# Compare two baselines
node tests/direct-rendering/compare-baselines.js \
  --before perf-baselines/baseline-before.txt \
  --after perf-baselines/baseline-after.txt

# Quick comparison with custom thresholds
node tests/direct-rendering/compare-baselines.js \
  --before baseline1.txt --after baseline2.txt \
  --threshold-opaque 20 --threshold-semi 35

# Output as JSON for scripting
node tests/direct-rendering/compare-baselines.js \
  --before baseline1.txt --after baseline2.txt --json
```

---

## See Also

- [PERFORMANCE-BENCHMARKING.md](PERFORMANCE-BENCHMARKING.md) - Technical mechanics of benchmarking
- [README.md](README.md) - Test registration API and utilities
- [../../DIRECT-RENDERING-SUMMARY.MD](../../DIRECT-RENDERING-SUMMARY.MD) - Direct rendering system overview

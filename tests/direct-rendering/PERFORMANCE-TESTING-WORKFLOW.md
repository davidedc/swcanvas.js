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
9. [Enhanced Benchmarking System (v3.0)](#9-enhanced-benchmarking-system-v30)
   - [9.9 Outlier Filtering](#99-outlier-filtering)
   - [9.10 Fixed Position Mode](#910-fixed-position-mode)
10. [Quick Reference](#10-quick-reference)

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

### Build Requirements

**IMPORTANT**: Always use the minified build for performance testing.

Before running performance tests:
```bash
npm run build:prod    # Creates both dist/swcanvas.js and dist/swcanvas.min.js
```

Performance tests automatically load the minified build (`dist/swcanvas.min.js`). Using the unminified build will produce inaccurate results that don't reflect production performance.

If you run performance tests without the minified build, the Node.js runner will display an error and exit.

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
│  2. Run: npm run build:prod   (creates minified build!)         │
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
│  1. Run: npm run build:prod   (creates minified build!)         │
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

## 9. Enhanced Benchmarking System (v3.0)

### 9.1 Overview

The v3.0 benchmarking system uses **statistical filtering** to achieve reliable, low-variance measurements (~0.7-0.9% CV):

- **Time-based warmup**: 3000ms default ensures thermal steady state
- **Super-measurement architecture**: 30 measurements × 5 sub-runs with stability detection
- **Sub-run CV checking**: Detects system instability, retries when CV > 5%
- **Minimum time selection**: Takes fastest time from stable measurement windows
- **IQR-based outlier removal**: Removes measurements from brief disturbances
- **Sample Standard Deviation**: Uses n-1 divisor for unbiased estimation
- **Confidence Intervals**: 95% CI using t-distribution
- **Welch's t-test**: Statistical significance testing for comparisons

### 9.2 Primary Tool: benchmark-session.js

The main tool for running benchmarks with statistical filtering:

```bash
node tests/direct-rendering/scripts/benchmark-session.js \
  --output perf-baselines/baseline.json \
  --filters '{"shape":"arc","stroke":"sw1px"}' \
  --warmup-ms 3000 \
  --super-measurements 30 \
  --fixed-positions \
  --skip-outliers
```

**Key Features:**
- Writes JSON directly to file (avoids npm stdout pollution)
- Time-based warmup for thermal steady state
- Sub-run CV checking with automatic retries on instability
- Full v3.0 JSON format with raw and trimmed measurements
- Reproducible parameters (seeded RNG for consistent values across runs)

**CLI Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--warmup-ms <N>` | 3000 | Time-based warmup in milliseconds |
| `--super-measurements <N>` | 30 | Number of data points per test |
| `--sub-runs <N>` | 5 | Sub-runs per super-measurement |
| `--shapes <N>` | 5000 | Shapes per sub-run |
| `--cv-threshold <N>` | 5 | Max CV% to accept measurement |
| `--max-retries <N>` | 3 | Retries for unstable measurements |
| `--cooldown <ms>` | 100 | Delay between super-measurements |
| `--fixed-positions` | off | Use identical positions for all runs |
| `--skip-outliers` | off | Enable MAD-based outlier filtering |

**With exclusion filters** (skip large categories for faster runs):

```bash
node tests/direct-rendering/scripts/benchmark-session.js \
  --output perf-baselines/arc-baseline.json \
  --filters '{"shape":"arc","excludeSize":["szL","szXL","szXXL"],"excludeStroke":["swL","swXL","swXXL"]}' \
  --warmup-ms 3000 \
  --super-measurements 30
```

This reduces arc tests from ~1400 to ~530 by excluding large size/stroke categories.

#### Enhanced Statistics in run-performance-tests.js

Use the `--enhanced-stats` flag for proper statistical analysis:

```bash
npm run test:direct-rendering:perf -- \
  --shape arc \
  --enhanced-stats \
  --output-file=perf-baselines/arc-baseline.json
```

#### Statistical Comparison

Use `--statistical` flag for p-value based significance testing:

```bash
node tests/direct-rendering/compare-baselines.js \
  --before baseline-before.json \
  --after baseline-after.json \
  --statistical
```

**Statistical Classifications:**
- `SIGNIFICANT_FASTER` - p < 0.05, CIs don't overlap, positive change
- `LIKELY_FASTER` - Significant p-value but CIs overlap
- `SAME` - Not statistically significant
- `LIKELY_SLOWER` - Significant p-value but CIs overlap
- `SIGNIFICANT_SLOWER` - p < 0.05, CIs don't overlap, negative change

### 9.3 JSON Format v3.0

The v3.0 JSON format includes full statistical data and filtering metadata:

```json
{
  "version": "3.0",
  "metadata": {
    "timestamp": "2026-02-02T15:30:00.000Z",
    "gitCommit": "abc1234",
    "gitBranch": "main",
    "nodeVersion": "v22.15.0",
    "platform": "darwin arm64",
    "config": {
      "warmupMs": 3000,
      "superMeasurements": 30,
      "subRuns": 5,
      "shapesPerRun": 5000,
      "cvThreshold": 5,
      "maxRetries": 3,
      "cooldownMs": 100
    }
  },
  "results": [{
    "id": "arc-perf-sw1px-szM-angS-stroke-opaque",
    "name": "Arc Stroke Opaque: 1px, M, Small",
    "statistics": {
      "n": 28,
      "mean": 12.5,
      "median": 12.3,
      "stddev": 0.08,
      "stddevPercent": 0.64,
      "sem": 0.015,
      "semPercent": 0.12,
      "ci95": { "low": 12.47, "high": 12.53 },
      "raw": [12.5, 12.3, ...],
      "trimmed": [12.5, 12.3, ...]
    },
    "rawStatistics": {
      "n": 30,
      "mean": 12.6,
      "stddevPercent": 1.2
    },
    "shapesPerSec": 400000,
    "usPerShape": 2.5,
    "filtering": {
      "totalAttempts": 35,
      "accepted": 30,
      "totalRetries": 5,
      "forcedCount": 0,
      "outlierCount": 2,
      "avgSubRunCV": 2.3
    }
  }]
}
```

### 9.4 Automated Workflow with Generated Scripts

For complex benchmarking sessions, use the template system:

1. **Templates Location**: `tests/direct-rendering/scripts/templates/`
2. **Generated Scripts**: `tests/direct-rendering/scripts/generated/`

**Template Variables:**
- `{{TIMESTAMP}}` - Generation timestamp
- `{{DESCRIPTION}}` - User-provided description
- `{{BASELINE_NAME}}` - Name for baseline file
- `{{FILTERS_JSON}}` - JSON filter string
- `{{RUNS}}` - Number of runs
- `{{SHAPES}}` - Shapes per run
- `{{SESSION_ID}}` - Unique session identifier

**Example Workflow:**

1. Generate scripts from templates (or have Claude generate them)
2. Run baseline script before making changes:
   ```bash
   ./tests/direct-rendering/scripts/generated/create-baseline-20260202.sh
   ```
3. Make your code changes
4. Run comparison script:
   ```bash
   ./tests/direct-rendering/scripts/generated/run-comparison-20260202.sh
   ```

### 9.5 Interpreting Statistical Results

**When is a change real?**

| Condition | Interpretation |
|-----------|----------------|
| p < 0.05 AND CIs don't overlap | **Strong evidence** - the change is real |
| p < 0.05 AND CIs overlap | **Suggestive** - likely real but not conclusive |
| p > 0.05 | **Not significant** - treat as noise |

**Why the old system was unreliable:**

- Used population stddev (n) instead of sample stddev (n-1)
- Fixed thresholds (15%/25%) unrelated to actual variance
- No consideration of statistical significance
- Raw measurements discarded after computing mean
- No confidence intervals for comparison

**Example of the problem:**

```
Test A: Mean=100,000, StdDev=40,000 (40%)
Test B: Mean=110,000, StdDev=35,000 (35%)

Old system: +10% → SAME (within 15% threshold)
New system: p=0.42 → SAME (correct, but with reasoning)

If Test B had StdDev=5,000 (5%):
New system: p=0.001 → SIGNIFICANT_FASTER (different conclusion!)
```

### 9.6 Best Practices

1. **Use 30+ super-measurements** for reliable statistical analysis
2. **Use time-based warmup** (3000ms default) to ensure JIT and thermal stability
3. **Enable `--fixed-positions`** to eliminate position-related variance
4. **Enable `--skip-outliers`** (IQR-based) to filter noise from system interrupts
5. **Store raw measurements** (always happens with v3.0 format)
6. **Compare with `--statistical`** for p-value based decisions
7. **Close other applications** during benchmarking
8. **Run outside Claude Code** - Claude consumes CPU while processing, affecting results

### 9.7 Reproducible Parameters

Each parametric performance test uses deterministically-seeded random values for strokeWidth, shapeSize, and arcAngle. This ensures:

- **All measurement runs use identical parameter values** - A test for "szM (40-79px)" will use the same specific value (e.g., 52.7px) for all 50 measurement runs, not different random values each run
- **Different tests still sample the full category range** - Test A might use 52.7px, Test B might use 71.3px, based on test ID hash
- **Benchmark results are reproducible across sessions** - Running the same test twice produces identical parameter values

**Impact on StdDev:**
- Before: 15-40% typical (different random values each run)
- After: 5-10% expected (same values all runs, only position/timing varies)

This change dramatically improves statistical reliability by eliminating parameter variation as a source of noise.

### 9.8 Variance Management in v3.0

The v3.0 system manages variance through **statistical filtering** rather than active throttle mitigation. Key differences from v2.0:

| v2.0 Approach | v3.0 Approach |
|---------------|---------------|
| Throttle detection with reference benchmarks | Sub-run CV checking for stability detection |
| Drift correction algorithms | Retry unstable measurements (CV > 5%) |
| Active pausing when drift detected | Passive: filter outliers post-collection |
| Complex mitigation options | Simple: `--cooldown` between measurements |

#### How v3.0 Handles Variance

1. **Sub-run stability checking**: Each super-measurement has 5 sub-runs. If CV > 5%, the system was unstable → retry
2. **Take minimum from stable windows**: When system is stable (CV ≤ 5%), the minimum reflects true performance
3. **IQR outlier removal**: Filters remaining noise from brief system interrupts
4. **Simple cooldown**: `--cooldown <ms>` (default 100ms) between super-measurements

#### Investigation Results

Throttle detection was removed after investigation showed:
- macOS system noise is random, intermittent, and uncontrollable
- Drift detection had 8.84% stddev - too noisy to reliably detect throttling
- Statistical filtering achieves 0.7-0.9% CV vs 10-20% with throttle-based approach

### 9.9 Outlier Filtering

Performance measurements can include outliers from GC pauses, system interrupts, or thermal spikes. Use `--skip-outliers` to filter these using IQR (Interquartile Range) filtering:

- Values below Q1 - 1.5×IQR or above Q3 + 1.5×IQR are removed
- Requires at least 4 measurements to apply filtering
- Reports `outlierCount` in JSON output for transparency

### 9.10 Fixed Position Mode

Stroke operations (especially Bresenham 1px strokes) are sensitive to shape positions and angles, which can cause high variance (10-25%) even with seeded random values. Use `--fixed-positions` to eliminate this variance.

#### How It Works

Without `--fixed-positions`:
- Run 0: seed 12345 → positions A₁, A₂, A₃, ...
- Run 1: seed 12346 → positions B₁, B₂, B₃, ...
- Run 2: seed 12347 → positions C₁, C₂, C₃, ...
- Different positions cause variance from octant selection, cache effects, etc.

With `--fixed-positions`:
- All runs: seed 12345 → positions A₁, A₂, A₃, ...
- Same positions for all 50 runs = minimal variance

#### Variance Comparison

| Test Type | Without | With `--fixed-positions` |
|-----------|---------|--------------------------|
| Arc Stroke Opaque 1px | 10-20% | **2-5%** |
| Arc Stroke Semi 1px | 15-25% | **1-3%** |
| Arc Fill+Stroke | 15-22% | **2-5%** |

#### Usage

```bash
# Recommended for production baselines (minimum variance)
node tests/direct-rendering/scripts/benchmark-session.js \
  --output baseline.json \
  --warmup-ms 3000 \
  --super-measurements 30 \
  --fixed-positions \
  --skip-outliers
```

#### When to Use

| Scenario | Recommendation |
|----------|----------------|
| Production baselines | **Enable** - minimum variance for reliable comparisons |
| Before/after comparisons | **Enable** - isolates code changes from position variance |
| Exploring performance characteristics | **Disable** - see real-world variance with varying positions |
| Debugging high variance | **Enable first** - if variance drops, position was the cause |

#### How IQR Filtering Works

1. Sort measurements and calculate **Q1** (25th percentile) and **Q3** (75th percentile)
2. Calculate **IQR** = Q3 - Q1
3. Filter values where `value < Q1 - 1.5×IQR` or `value > Q3 + 1.5×IQR`
4. Use filtered data for mean, stddev, SEM, CI95 calculations

#### JSON Output

When outlier filtering is enabled, the output includes:

```json
{
  "metadata": {
    "config": {
      "outlierFiltering": {
        "enabled": true,
        "method": "iqr",
        "threshold": null
      }
    }
  },
  "results": [{
    "statistics": {
      "n": 28,           // Count after filtering
      "raw": [...],      // Original measurements (always preserved)
      "trimmed": [...]   // After outlier removal
    },
    "rawStatistics": {
      "n": 30,           // Original count
      "mean": 0.061,
      "stddevPercent": 0.35
    },
    "filtering": {
      "totalAttempts": 32,
      "accepted": 30,
      "totalRetries": 2,
      "forcedCount": 0,
      "outlierCount": 2,
      "avgSubRunCV": 3.26
    }
  }]
}
```

#### When to Use

| Scenario | Recommendation |
|----------|----------------|
| Production baselines | **Enable** - cleaner data for comparisons |
| Before/after comparisons | **Enable** - reduces noise from random spikes |
| Debugging | **Disable** - see all measurements including anomalies |
| Initial exploration | **Disable** - understand full distribution first |

#### Verification

Test IQR detection standalone:

```bash
node -e "
const Statistics = require('./tests/direct-rendering/lib/statistics.js');
const data = [10, 11, 10.5, 11.2, 10.8, 50, 10.9, 11.1];  // 50 is outlier
const result = Statistics.removeOutliersIQR(data);
console.log('Outliers removed:', result.outlierCount);
console.log('Bounds: [' + result.lowerBound.toFixed(2) + ', ' + result.upperBound.toFixed(2) + ']');
console.log('Cleaned mean:', (result.cleaned.reduce((a,b)=>a+b,0)/result.cleaned.length).toFixed(2));
"
# Expected: 1 outlier removed (value 50)
```

---

## 10. Quick Reference

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

**Include Filters** (run only matching tests):

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

**Exclusion Filters** (benchmark-session.js only, via `--filters` JSON):

| Filter | Values | Example |
|--------|--------|---------|
| `excludeSize` | Array of size categories | `"excludeSize":["szL","szXL","szXXL"]` |
| `excludeStroke` | Array of stroke categories | `"excludeStroke":["swL","swXL","swXXL"]` |
| `excludeAngle` | Array of angle categories | `"excludeAngle":["angL","angXL"]` |

**Example with exclusion filters:**
```bash
node tests/direct-rendering/scripts/benchmark-session.js \
  --output baseline.json \
  --filters '{"shape":"arc","excludeSize":["szL","szXL","szXXL"],"excludeStroke":["swL","swXL","swXXL"]}'
```

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
# Compare two baselines (threshold-based, legacy)
node tests/direct-rendering/compare-baselines.js \
  --before perf-baselines/baseline-before.txt \
  --after perf-baselines/baseline-after.txt

# Statistical significance testing (v2.0/v3.0 JSON required)
node tests/direct-rendering/compare-baselines.js \
  --before baseline1.json --after baseline2.json \
  --statistical

# Detailed dimensional analysis with recommendations
node tests/direct-rendering/compare-baselines.js \
  --before baseline1.json --after baseline2.json \
  --statistical --analyze

# Quick comparison with custom thresholds
node tests/direct-rendering/compare-baselines.js \
  --before baseline1.txt --after baseline2.txt \
  --threshold-opaque 20 --threshold-semi 35

# JSON output to file (recommended for large outputs to avoid pipe truncation)
node tests/direct-rendering/compare-baselines.js \
  --before baseline1.json --after baseline2.json \
  --statistical --analyze --json --output comparison.json
```

### Dimensional Analysis (--analyze)

The `--analyze` flag provides comprehensive breakdown of performance changes by dimension.

**Requirements:** Works best with v3.0 JSON baselines that include metadata (strokeCategory, sizeCategory, angleCategory, operation). Without metadata, dimensions will show as "unknown". Use with `--statistical` for p-value based classifications.

**Dimension Categories:**
- **By Operation Type**: Fill vs Stroke vs Fill+Stroke, Opaque vs Semi-transparent
- **By Stroke Width**: 0px (fill-only), 1px (Bresenham), 2-3px (XXS) through 80+px (XXL)
- **By Size Category**: XXS (<5px) through XXL (320+px)
- **By Arc Angle** (arc tests only): Small (30-90°), Medium (90-180°), Large (180-270°), Nearly Full (270-350°)

**Output Includes:**
- Dimensional breakdown tables with count, average change, and classification counts
- Cross-tabulation matrices (e.g., Operation × Arc Angle)
- Top 10 improvements and regressions with metadata context
- Automated recommendation (SHIP, DO_NOT_SHIP, INVESTIGATE, NEUTRAL) with confidence level and reasoning

**Example Output:**
```
═══════════════════════════════════════════════════════════════════════════════
BY OPERATION TYPE
═══════════════════════════════════════════════════════════════════════════════
Dimension                Count   Avg Δ%   Faster  Slower   Same
───────────────────────────────────────────────────────────────────────────────
Fill (Opaque)               16   -1.8%       2       9      5
Fill (Semi)                 16   +2.2%      13       1      2
Stroke (Opaque)             96   -3.2%       2      77     17
Stroke (Semi)               96   +0.8%      42      27     27
...

═══════════════════════════════════════════════════════════════════════════════
RECOMMENDATION
═══════════════════════════════════════════════════════════════════════════════
Verdict: DO_NOT_SHIP
Confidence: high

Reasons:
  • 52.0% of tests regressed (>50% threshold)
  • Opaque operations: avg -2.8%
  • Semi-transparent operations: avg +0.1%
```

**Recommendation Logic:**
| Condition | Verdict | Confidence |
|-----------|---------|------------|
| >50% regressed AND <30% improved | DO_NOT_SHIP | high |
| Severe regressions > 2× strong improvements | DO_NOT_SHIP | medium |
| Large opaque/semi divergence (>3%) | INVESTIGATE | medium |
| >60% improved AND <20% regressed | SHIP | high |
| No severe regressions AND <30% regressed | SHIP | medium |
| Mixed results | NEUTRAL | low |

---

## See Also

- [PERFORMANCE-BENCHMARKING.md](PERFORMANCE-BENCHMARKING.md) - Technical mechanics of benchmarking
- [README.md](README.md) - Test registration API and utilities
- [../../DIRECT-RENDERING-SUMMARY.MD](../../DIRECT-RENDERING-SUMMARY.MD) - Direct rendering system overview

# Performance Benchmarking Mechanics

This document explains how SWCanvas performance tests accurately measure rendering performance. Node.js and browser benchmarking use fundamentally different approaches due to the nature of CPU vs GPU rendering.

---

# Part 1: Node.js Benchmarking (SWCanvas)

SWCanvas is pure JavaScript with synchronous CPU rendering. This allows direct timing with `performance.now()`, but system noise (OS scheduling, thermal throttling, background processes) requires statistical filtering to achieve reliable results.

## 1.1 The Challenge: System Noise

Even with direct timing, raw measurements vary significantly:

```
Run 1: 12.3ms
Run 2: 12.5ms
Run 3: 18.7ms  ← OS interrupt or thermal throttle
Run 4: 12.4ms
Run 5: 12.3ms
```

Single-run benchmarks can show 10-20% variance, making it impossible to detect real performance differences under 20%.

## 1.2 The Solution: Statistical Filtering

The v3.0 benchmarking system uses a **super-measurement architecture** with stability detection:

### Core Insight

1. System noise is random and intermittent
2. When noise is absent, consecutive measurements are stable (low CV)
3. We can **detect** stable periods by checking sub-run consistency
4. We can **retry** when noise is detected
5. We can **select** the best (minimum) time from stable periods
6. We can **remove** remaining outliers with IQR filtering

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        WARMUP PHASE                             │
│  Run small batches for 3000ms to reach thermal steady state     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   SUPER-MEASUREMENT PHASE                       │
│  Collect 30 super-measurements, each with stability check       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      ANALYSIS PHASE                             │
│  IQR outlier removal → Final statistics                         │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 Detailed Algorithm with Example

### Step 1: Warmup Phase

Run small batches (100 shapes) continuously for 3000ms to:
- Reach thermal steady state
- Complete V8 JIT compilation (4 optimization tiers)
- Stabilize CPU frequency

### Step 2: Super-Measurement Collection

For each of 30 super-measurements:

```
Super-measurement #1:
  Sub-run 1: draw 5000 shapes → t₁ = 12.3ms
  Sub-run 2: draw 5000 shapes → t₂ = 12.5ms
  Sub-run 3: draw 5000 shapes → t₃ = 12.4ms
  Sub-run 4: draw 5000 shapes → t₄ = 12.3ms
  Sub-run 5: draw 5000 shapes → t₅ = 12.6ms

  Calculate CV:
    mean = (12.3 + 12.5 + 12.4 + 12.3 + 12.6) / 5 = 12.42ms
    stddev = √[Σ(tᵢ - mean)² / (n-1)] = 0.13ms
    CV = stddev / mean × 100 = 1.05%

  CV (1.05%) ≤ threshold (5%) → STABLE
  Accept minimum: bestTime₁ = 12.3ms
```

If unstable (CV > 5%), retry up to 3 times:

```
Super-measurement #7 (attempt 1):
  Sub-runs: [12.4, 12.3, 18.7, 12.5, 12.4]  ← noise spike
  CV = 22.1% > 5% → UNSTABLE, retry

Super-measurement #7 (attempt 2):
  Sub-runs: [12.3, 12.4, 12.3, 12.5, 12.4]
  CV = 0.65% ≤ 5% → STABLE
  Accept minimum: bestTime₇ = 12.3ms
```

After 30 super-measurements, we have:

```
bestTimes = [12.3, 12.4, 12.3, 12.5, 12.3, 12.4, 12.3, 12.6, ..., 12.4]
            (30 values, each the minimum from a stable 5-run window)
```

### Step 3: IQR Outlier Removal

Remove statistical outliers using Interquartile Range:

```
Sort bestTimes: [12.3, 12.3, 12.3, 12.3, 12.4, 12.4, 12.4, 12.5, 12.5, 12.6, ...]

Q1 (25th percentile) = 12.3ms
Q3 (75th percentile) = 12.5ms
IQR = Q3 - Q1 = 0.2ms

Lower fence = Q1 - 1.5 × IQR = 12.3 - 0.3 = 12.0ms
Upper fence = Q3 + 1.5 × IQR = 12.5 + 0.3 = 12.8ms

Remove any values outside [12.0, 12.8]
```

### Step 4: Final Statistics

On the trimmed data (e.g., 28 values after removing 2 outliers):

```
trimmedTimes = [12.3, 12.3, 12.3, 12.3, 12.4, 12.4, 12.4, 12.5, ...]

n = 28
mean = 12.38ms
stddev = 0.09ms
CV = stddev / mean × 100 = 0.73%

Derived metrics:
  shapesPerSecond = (5000 / 12.38) × 1000 = 403,877 shapes/sec
  microsecondsPerShape = (12.38 / 5000) × 1000 = 2.48 µs/shape
```

## 1.4 Why This Works

| Problem | Solution |
|---------|----------|
| Random noise spikes | Sub-run CV detects unstable windows |
| Thermal throttling | Time-based warmup reaches steady state |
| Persistent outliers | IQR filtering removes remaining anomalies |
| Need minimum variance | Take min from each stable window |

**Result**: 0.7-0.9% CV consistently, enabling detection of 2-3% performance differences.

## 1.5 Stratified Coverage Sequences

To ensure benchmarks are representative of real usage, each test uses **stratified sampling** across the full parameter range:

```
For size bracket szL (80-159px) with 10 strata:

  Shape 0:  stratum 0 (80-87px)   → 82px
  Shape 1:  stratum 1 (88-95px)   → 93px
  Shape 2:  stratum 2 (96-103px)  → 101px
  ...
  Shape 9:  stratum 9 (152-159px) → 155px
  Shape 10: stratum 0 again       → 84px (different random within stratum)
  ...
```

Benefits:
- **Full coverage**: Every 10 shapes samples the entire bracket range
- **Breaks caching**: Consecutive shapes have different sizes
- **Deterministic**: Same seed produces identical sequences across runs (maintains low CV)

## 1.6 CLI Reference

```bash
node tests/direct-rendering/scripts/benchmark-session.js \
  --output baseline.json \
  --warmup-ms 3000 \
  --super-measurements 30 \
  --fixed-positions \
  --skip-outliers
```

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

## 1.7 Important: Run Outside Claude

Claude Code consumes CPU while processing streamed results, adding noise to benchmarks.

**Best practice:**
1. Exit the Claude conversation
2. Run benchmarks in a clean terminal
3. Collect results
4. Return to Claude for analysis

---

# Part 2: Browser Benchmarking (HTML5 Canvas)

HTML5 Canvas uses GPU-accelerated rendering, which is fundamentally asynchronous. Standard timing approaches fail because they measure JavaScript execution, not actual GPU rendering.

## 2.1 Why Standard Timing Fails

### Attempt 1: Direct Timing
```javascript
const start = performance.now();
for (let i = 0; i < shapes; i++) ctx.fillRect(...);
const elapsed = performance.now() - start;  // ~0.1ms regardless of shape count!
```
**Problem**: Browsers defer GPU work. We're measuring command recording, not rendering.

### Attempt 2: RAF Timestamp Intervals
```javascript
requestAnimationFrame((t1) => {
    // render
    requestAnimationFrame((t2) => {
        const frameTime = t2 - t1;  // Always ~13.33ms or ~16.67ms!
    });
});
```
**Problem**: VSync locks frames to display refresh rate. Even if GPU finishes in 2ms, frame time is 13.33ms minimum (at 75fps).

### Attempt 3: Force GPU Sync with getImageData
```javascript
ctx.fillRect(...);
ctx.getImageData(0, 0, 1, 1);  // Forces GPU to finish
```
**Problem**: getImageData adds massive overhead (~10x slower results). We're measuring the sync operation, not rendering.

## 2.2 The Solution: VSync Cliff Detection

Instead of measuring time, we detect the **frame drop cliff**:

1. **VSync creates a binary outcome**: At any shape count, frames either:
   - Complete within refresh interval (PASS)
   - Exceed refresh interval and drop (FAIL)

2. **The cliff is detectable**: Frame time jumps from ~13ms to ~20+ms when GPU can't keep up.

3. **Threshold**: We use `FRAME_BUDGET × 1.5` (~20ms at 75fps) to detect the cliff.

### Algorithm

```javascript
function measureAtCount(targetCount, callback) {
    const WARMUP_FRAMES = 5;
    const MEASURE_FRAMES = 15;
    const DROP_THRESHOLD = FRAME_BUDGET * 1.5;

    let frameCount = 0;
    let startTime = 0;

    function runFrame(timestamp) {
        if (frameCount === WARMUP_FRAMES) {
            startTime = timestamp;
        }

        // Clear and render
        clearCanvas();
        drawShapes(targetCount);

        frameCount++;

        if (frameCount < WARMUP_FRAMES + MEASURE_FRAMES) {
            requestAnimationFrame(runFrame);
        } else {
            const avgFrameTime = (timestamp - startTime) / MEASURE_FRAMES;
            const passed = avgFrameTime < DROP_THRESHOLD;
            callback(passed, avgFrameTime);
        }
    }

    requestAnimationFrame(runFrame);
}
```

## 2.3 Scaling Correction

**Problem**: When we find the cliff, the last PASS may have been at 18ms not 13.33ms (VSync isn't perfectly quantized on modern displays with VRR).

**Solution**: Scale results to the target frame budget:

```javascript
function getFinalMaxShapes() {
    if (lastPassTime > FRAME_BUDGET) {
        return Math.floor(lowerBound * (FRAME_BUDGET / lastPassTime));
    }
    return lowerBound;
}
```

**Example**:
- Last PASS: 96,144 shapes @ 18.7ms
- Target: 13.33ms
- Scaled: 96,144 × (13.33 / 18.7) = 68,551 shapes

## 2.4 Configuration

Key parameters for browser testing:
- **Frame budget**: Auto-detected from display refresh rate
- **Drop threshold**: `FRAME_BUDGET × 1.5`
- **Growth factor**: Binary search uses 1.1× growth
- **Convergence precision**: Shapes tolerance for convergence

---

# Part 3: Comparison

| Aspect | Node.js (SWCanvas) | Browser (HTML5 Canvas) |
|--------|-------------------|------------------------|
| Rendering | Synchronous CPU | Asynchronous GPU |
| Timing method | `performance.now()` + statistical filtering | VSync cliff detection |
| What's measured | Actual render time | Frame drop threshold |
| Noise handling | Sub-run CV + IQR filtering | Frame averaging |
| Scaling needed | No | Yes (normalize to frame budget) |
| Accuracy | Direct with statistical filtering | Inferred from stress test |
| Typical CV | 0.7-0.9% | N/A (binary pass/fail) |

---

# Part 4: Historical Results

## Verified Results (December 2024)

| Browser | Test | SWCanvas | HTML5 Canvas | Ratio |
|---------|------|----------|--------------|-------|
| Chrome | Lines 20×1px | 16,027 | 67,410 | 4.21× |
| Chrome | Circle Fill | 3,179 | 23,722 | 7.46× |
| Safari | Lines 20×1px | 25,602 | 69,702 | 2.72× |
| Safari | Circle Fill | 3,422 | 28,670 | 8.38× |

Scaling is applied to all HTML5 Canvas results.

---

## See Also

- [README.md](README.md#7-performance-testing) - Performance test configuration and usage
- [PERFORMANCE-TESTING-WORKFLOW.md](PERFORMANCE-TESTING-WORKFLOW.md) - Workflow guide for benchmarking code changes
- [performance-tests.html](performance-tests.html) - Browser-based performance UI
- [BENCHMARK-INVESTIGATION-RESULTS.md](BENCHMARK-INVESTIGATION-RESULTS.md) - Detailed investigation of variance sources

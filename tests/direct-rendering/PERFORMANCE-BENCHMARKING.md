# Performance Benchmarking Mechanics

This document explains how SWCanvas performance tests accurately measure rendering performance for both SWCanvas (CPU) and HTML5 Canvas (GPU).

## The Core Challenge

**SWCanvas** (pure JavaScript):
- Synchronous CPU rendering
- `performance.now()` directly measures actual work time
- Simple: render, measure, compare to frame budget

**HTML5 Canvas** (GPU accelerated):
- Asynchronous deferred rendering
- Commands are batched and sent to GPU
- `performance.now()` only measures command recording (~0.1ms)
- GPU work happens later, possibly across frame boundaries

---

## Why Standard Timing Approaches Fail

### Attempt 1: Direct Timing
```javascript
const start = performance.now();
for (let i = 0; i < shapes; i++) ctx.fillRect(...);
const elapsed = performance.now() - start;  // ~0.1ms regardless of shape count!
```
**Problem**: Safari (and often Chrome) defer GPU work. We're measuring JavaScript execution, not rendering.

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

---

## The Solution: VSync Cliff Detection

Instead of measuring time, we detect the **frame drop cliff**:

1. **VSync creates a binary outcome**: At any shape count, frames either:
   - Complete within refresh interval (PASS)
   - Exceed refresh interval and drop (FAIL)

2. **The cliff is detectable**: Frame time jumps from ~13ms to ~20+ms when GPU can't keep up.

3. **Threshold**: We use `FRAME_BUDGET × 1.5` (~20ms at 75fps) to detect the cliff. Below threshold = PASS, above = FAIL.

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

---

## Scaling Correction

**Problem**: When we find the cliff, the last PASS may have been at 18ms not 13.33ms (VSync isn't perfectly quantized on modern displays with VRR).

**Solution**: Scale results to the target frame budget:

```javascript
function getFinalMaxShapes() {
    if (lastPassTime > FRAME_BUDGET) {
        // We measured shapes that fit in lastPassTime, not FRAME_BUDGET
        // Scale down proportionally
        return Math.floor(lowerBound * (FRAME_BUDGET / lastPassTime));
    }
    return lowerBound;
}
```

**Example**:
- Last PASS: 96,144 shapes @ 18.7ms
- Target: 13.33ms
- Scaled: 96,144 × (13.33 / 18.7) = 68,551 shapes

---

## SWCanvas: Direct Timing

For SWCanvas (CPU rendering), we use direct timing:

```javascript
const start = performance.now();
for (let i = 0; i < shapes; i++) {
    ctx.fillCircle(x, y, r);
}
if (includeBlitting) {
    blitToDisplay();
}
const elapsed = performance.now() - start;
```

This works because:
- JavaScript execution is synchronous
- CPU work happens immediately
- `performance.now()` accurately measures rendering time

**Build Requirement**: Performance tests load the minified build (`dist/swcanvas.min.js`) to ensure benchmarks reflect production performance. Run `npm run build:prod` before benchmarking.

---

## Measurement Comparison

| Aspect | SWCanvas | HTML5 Canvas |
|--------|----------|--------------|
| Rendering | Synchronous CPU | Asynchronous GPU |
| Timing method | `performance.now()` | VSync cliff detection |
| What's measured | Actual render time | Frame drop threshold |
| Scaling needed | No | Yes (normalize to frame budget) |
| Accuracy | Direct | Inferred from stress test |

---

## Configuration Options

See [README.md](README.md#7-performance-testing) for UI configuration.

Key parameters:
- **Frame budget**: Auto-detected from display refresh rate
- **Drop threshold**: `FRAME_BUDGET × 1.5`
- **Growth factor**: Binary search uses 1.1× growth
- **Convergence precision**: Shapes tolerance for convergence

---

## Implementation Details

Key functions in `performance-tests/performance-utils.js`:

| Function | Purpose |
|----------|---------|
| `measureAtCount()` | VSync cliff detection for HTML5 Canvas |
| `getFinalMaxShapes()` | Applies scaling correction |
| `lastPassTime` | Tracks actual time from last PASS for scaling |

---

## Verified Results (December 2024)

| Browser | Test | SWCanvas | HTML5 Canvas | Ratio |
|---------|------|----------|--------------|-------|
| Chrome | Lines 20×1px | 16,027 | 67,410 | 4.21× |
| Chrome | Circle Fill | 3,179 | 23,722 | 7.46× |
| Safari | Lines 20×1px | 25,602 | 69,702 | 2.72× |
| Safari | Circle Fill | 3,422 | 28,670 | 8.38× |

Scaling is applied to all HTML5 Canvas results.

---

## Statistical Filtering Approach (v3.0)

Instead of trying to eliminate variance through throttle detection and drift correction (which proved unreliable—see investigation notes), the v3.0 system uses **statistical filtering**:

### The Insight

System noise on macOS is inherent, inconsistent, and uncontrollable through configuration. However:
1. Noise is random and intermittent
2. When noise is absent, measurements are stable (low sub-run CV)
3. We can **detect** stable periods by checking consistency within measurement windows
4. We can **retry** when noise is detected
5. We can **select** the best (minimum) measurement from stable periods
6. We can **remove** remaining outliers with IQR filtering

### Algorithm

```
For each super-measurement:
  1. Take 5 sub-runs
  2. Calculate CV of sub-runs
  3. If CV > 5%: system was unstable → retry (up to 3 times)
  4. If CV <= 5%: system was stable → take minimum time

After all measurements:
  5. Apply IQR-based outlier removal (Q1 - 1.5×IQR, Q3 + 1.5×IQR)
  6. Report trimmed statistics
```

### Key Result

This approach achieves **0.7-0.9% CV consistently**, compared to 10-20% with the previous throttle-based approach. Performance differences of 2-3% can now be reliably detected.

---

## Benchmark Reliability

### Recommended Command

For production benchmarking with statistical filtering:

```bash
node tests/direct-rendering/scripts/benchmark-session.js \
  --output baseline.json \
  --warmup-ms 3000 \
  --super-measurements 30 \
  --fixed-positions \
  --skip-outliers
```

### CLI Options

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

### Time-Based Warmup

The v3.0 system uses **time-based warmup** (default 3000ms) instead of iteration-based warmup. This ensures:
- Thermal steady state is reached regardless of operation speed
- JIT compilation completes (V8 has 4 optimization tiers, typically completing by 200+ iterations)
- Consistent warmup duration across different test types

### Expected Variance

| Approach | Typical CV | Detectable Difference |
|----------|------------|----------------------|
| Old (single measurement) | 10-20% | ~20% |
| **New (statistical filtering)** | **0.7-0.9%** | **2-3%** |

### Important: Run Outside Claude

Claude Code consumes CPU while processing streamed results. This adds noise to benchmarks.

**Best practice:**
1. Exit the Claude conversation
2. Run benchmarks in a clean terminal
3. Collect results
4. Return to Claude for analysis

---

## See Also

- [README.md](README.md#7-performance-testing) - Performance test configuration and usage
- [performance-tests.html](performance-tests.html) - Browser-based performance UI
- [BENCHMARK-INVESTIGATION-RESULTS.md](BENCHMARK-INVESTIGATION-RESULTS.md) - Detailed investigation of variance sources

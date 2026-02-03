# Direct Rendering Tests

Comprehensive documentation for SWCanvas.js direct rendering tests. These tests verify the correctness of direct shape APIs (`fillCircle`, `strokeLine`, etc.) that bypass the general polygon pipeline for optimized rendering.

For an overview of how direct rendering works internally, see [DIRECT-RENDERING-SUMMARY.MD](../../DIRECT-RENDERING-SUMMARY.MD).

## Table of Contents

1. [Test Registration API](#1-test-registration-api)
2. [Draw Function Pattern](#2-draw-function-pattern)
3. [Check Options](#3-check-options)
4. [Utility Functions](#4-utility-functions)
5. [Modular Utility Architecture](#5-modular-utility-architecture)
6. [File Naming Convention](#6-file-naming-convention)
7. [Categories](#7-categories)
8. [Performance Testing](#8-performance-testing)
9. [Test Metadata Validation](#9-test-metadata-validation)

---

## 1. Test Registration API

Tests are registered using `registerDirectRenderingTest()`:

```javascript
registerDirectRenderingTest(name, drawFunction, category, checks, metadata)
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Unique test identifier (typically matches filename without `.js`) |
| `drawFunction` | `function` | Yes | Function that draws the test: `(ctx, iterationNumber) => { logs, checkData }` |
| `category` | `string` | Yes | Test category: `'lines'`, `'circles'`, `'arcs'`, `'rects'`, `'rounded-rects'` |
| `checks` | `object` | Yes | Validation checks to perform (see [Check Options](#3-check-options)) |
| `metadata` | `object` | No | Test metadata including `title`, `description` |

### Complete Example

```javascript
registerDirectRenderingTest(
    'circle-fill-opaque',
    function drawTest(ctx, iterationNumber) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        const fillColor = getRandomOpaqueColor();
        const params = calculateCircleTestParams({
            canvasWidth, canvasHeight,
            minRadius: 30, maxRadius: 80,
            hasStroke: false, randomPosition: false
        });

        ctx.fillStyle = fillColor;
        ctx.fillCircle(params.centerX, params.centerY, params.radius);

        return {
            logs: [`Circle at (${params.centerX}, ${params.centerY}) radius ${params.radius}`],
            checkData: {
                topY: Math.floor(params.centerY - params.radius),
                bottomY: Math.floor(params.centerY + params.radius),
                leftX: Math.floor(params.centerX - params.radius),
                rightX: Math.floor(params.centerX + params.radius)
            }
        };
    },
    'circles',
    {
        extremes: { colorTolerance: 8, tolerance: 0.05 },
        totalUniqueColors: 2
    },
    {
        title: 'Filled Circle - Opaque Color',
        description: 'Tests fillCircle with opaque color'
    }
);
```

### Metadata Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Human-readable test title for reports |
| `description` | `string` | Detailed test description |

---

## 2. Draw Function Pattern

Visual tests use a simple function pattern that returns logs and check data.

### Function Signature

```javascript
function drawTest(ctx, iterationNumber) {
    // Draw shapes using direct rendering APIs
    ctx.fillCircle(x, y, radius);

    // Return logs and check data for validation
    return {
        logs: ['Description of what was drawn'],
        checkData: { topY, bottomY, leftX, rightX }
    };
}
```

### Return Value

| Field | Type | Description |
|-------|------|-------------|
| `logs` | `string[]` | Descriptive messages for debugging |
| `checkData` | `object` | Bounds or validation data for automated checks |

### Randomization

Use `SeededRandom.getRandom()` for all random values to ensure reproducible tests:

```javascript
const radius = 30 + SeededRandom.getRandom() * 50;
const centerX = SeededRandom.getRandom() * canvasWidth;
```

**Never use `Math.random()`** in visual tests - it breaks reproducibility.

---

## 3. Check Options

The `checks` object specifies validation to perform on rendered output.

### Available Checks

#### `extremes`

Validates shape bounds against expected positions.

```javascript
// Simple: use defaults
extremes: true

// With options
extremes: {
    colorTolerance: 8,  // Max channel difference from background (0-255)
    tolerance: 0.05     // Position tolerance as fraction of radius
}
```

The test's `checkData` must provide expected bounds:
```javascript
checkData = {
    topY: Math.floor(centerY - radius),
    bottomY: Math.floor(centerY + radius),
    leftX: Math.floor(centerX - radius),
    rightX: Math.floor(centerX + radius)
};
```

#### `totalUniqueColors`

Validates exact number of unique colors in rendered output.

```javascript
// Expect exactly N colors
totalUniqueColors: 2  // background + fill

// With options
totalUniqueColors: {
    expected: 3,  // or use 'count' for backwards compatibility
    count: 3
}
```

#### `maxUniqueColors`

Validates maximum number of unique colors (upper bound).

```javascript
maxUniqueColors: 50  // Allow up to 50 colors
```

#### `uniqueColors.middleRow` / `uniqueColors.middleColumn`

Validates color count in specific scanlines.

```javascript
uniqueColors: {
    middleRow: { count: 3 },     // Exactly 3 colors in middle row
    middleColumn: { count: 2 }   // Exactly 2 colors in middle column
}
```

#### `speckles`

Checks for isolated single-pixel artifacts.

```javascript
// No speckles allowed
speckles: true       // Expect 0 speckles
noSpeckles: true     // Alias for speckles: true

// With options
speckles: {
    expected: 0,
    maxSpeckles: 5,        // Allow up to 5 speckles
    knownFailure: true     // Mark as known issue (test passes but reports)
}
```

#### `dimensionConsistency`

Validates uniform width/height across rendered shape.

```javascript
dimensionConsistency: true
```

Detects issues like missing pixels on edges where row widths or column heights vary unexpectedly.

#### `stroke8Connectivity`

Validates 1px closed stroke continuity using 8-connectivity.

```javascript
stroke8Connectivity: {
    color: [0, 0, 0],    // [r, g, b] stroke color
    tolerance: 0,        // Color matching tolerance
    knownFailure: false  // Mark as known issue
}
```

**Note**: Only works for 1px strokes. Every stroke pixel should have exactly 2 neighbors.

#### `strokePatternContinuity`

Validates closed shape stroke continuity using scanline analysis. Works for any stroke width.

```javascript
// Simple
strokePatternContinuity: true

// With options
strokePatternContinuity: {
    verticalScan: true,    // Scan rows (default: true)
    horizontalScan: true,  // Scan columns (default: true)
    knownFailure: false    // Mark as known issue
}
```

**Limitation**: Only works for closed convex shapes (circles, rectangles, rounded rects).

#### `allowPathBasedRendering`

Allows tests to pass even when path-based (non-direct) rendering is used.

```javascript
allowPathBasedRendering: true
```

Use when testing scenarios that may fall back to the polygon pipeline.

### Check Object Example

```javascript
{
    extremes: { colorTolerance: 8, tolerance: 0.05 },
    totalUniqueColors: 3,
    speckles: { expected: 0 },
    dimensionConsistency: true,
    strokePatternContinuity: true
}
```

---

## 4. Utility Functions

Test utilities are organized into 10 focused modules following a facade pattern. The main `direct-rendering-test-utils.js` file re-exports all modules for Node.js compatibility, while browser tests load modules directly via `<script>` tags.

All utilities use `SeededRandom` for reproducibility. Seed before use:

```javascript
SeededRandom.seedWithInteger(iterationNumber);
```

### Random Generation

#### `SeededRandom`

Deterministic random number generator (SFC32 algorithm).

```javascript
SeededRandom.seedWithInteger(42);        // Initialize with seed
const value = SeededRandom.getRandom();  // Returns 0-1
```

#### `getRandomColor(mode)`

Generates random CSS color strings.

| Mode | Description | Alpha Range |
|------|-------------|-------------|
| `'opaque'` | Fully opaque RGB | 1.0 |
| `'semitransparent'` | Partial transparency | 0.39-0.78 |
| `'semitransparent-light'` | Lighter transparency | 0.20-0.59 |
| `'semitransparent-visible'` | Guaranteed visible on white | 0.39-0.78 |
| `'mixed'` | 50% opaque, 50% semi | varies |
| `'mixed-visible'` | 50% opaque, 50% semi-visible | varies |

```javascript
ctx.fillStyle = getRandomColor('semitransparent');
```

#### `getRandomOpaqueColor()`

Returns opaque RGB color with channels in range 100-254.

```javascript
ctx.fillStyle = getRandomOpaqueColor();  // e.g., 'rgb(142, 187, 203)'
```

#### `getRandomOpaqueVisibleColor()`

Returns opaque color guaranteed visible on white background (at least one dark channel).

```javascript
ctx.strokeStyle = getRandomOpaqueVisibleColor();
```

### Color Standardization Guidelines

While random colors look visually appealing, they can cause problems with certain checks (e.g., `totalUniqueColors`, color separation analysis). When random colors aren't strictly necessary for test validity, prefer standardized colors:

#### Standardized Color Scheme

| Purpose | Opaque | 50% Transparent |
|---------|--------|-----------------|
| **Fills** (Blue) | `rgb(0, 0, 255)` | `rgba(0, 0, 255, 0.49)` |
| **Strokes** (Red) | `rgb(255, 0, 0)` | `rgba(255, 0, 0, 0.49)` |

#### Guidelines

1. **Strokes**: Always red (`rgb(255, 0, 0)` or `rgba(255, 0, 0, 0.49)`)
2. **Fills**: Always blue (`rgb(0, 0, 255)` or `rgba(0, 0, 255, 0.49)`)
3. **"Semitransparent"**: Always 50% transparency (alpha ≈ 0.49, which is 125/255)
4. **"Mixed/Random transparency"**: Simplify to 50/50 choice between fully opaque and 50% transparent:
   ```javascript
   const fillIsOpaque = SeededRandom.getRandom() < 0.5;
   ctx.fillStyle = fillIsOpaque ? 'rgb(0, 0, 255)' : 'rgba(0, 0, 255, 0.49)';
   ```

#### When to Use Random Colors

Use `getRandomColor()` and `getRandomOpaqueColor()` only when:
- Testing color handling across the full spectrum is the actual test purpose
- Verifying gradient or pattern rendering
- Testing anti-aliasing with various color combinations

#### Benefits of Standardized Colors

- **Predictable `totalUniqueColors`**: Easier to calculate expected color counts
- **Clear color separation**: Fill (blue) and stroke (red) are easily distinguishable
- **Consistent test behavior**: Same visual output across iterations
- **Simpler debugging**: Easy to identify which pixels are fill vs stroke

#### `getRandomPoint(decimalPlaces, canvasWidth, canvasHeight, margin)`

Returns random point within canvas bounds.

```javascript
const pt = getRandomPoint(1, 400, 300, 50);  // 50px margin from edges
// pt = { x: 123.4, y: 187.2 }
```

### Positioning Utilities

#### `calculateCenterAtPixel(width, height)`

Returns center at pixel boundary (*.5 coordinates) for crisp 1px strokes.

```javascript
const { centerX, centerY } = calculateCenterAtPixel(400, 300);
// { centerX: 200.5, centerY: 150.5 }
```

#### `calculateCenterAtGrid(width, height)`

Returns center at grid intersection (integer coordinates).

```javascript
const { centerX, centerY } = calculateCenterAtGrid(400, 300);
// { centerX: 200, centerY: 150 }
```

### Crisp Rendering Utilities

#### `adjustDimensionsForCrispStrokeRendering(width, height, strokeWidth, center)`

Adjusts dimensions for crisp stroke rendering based on stroke width and center position.

```javascript
const adjusted = adjustDimensionsForCrispStrokeRendering(
    100, 80, 1, { x: 200.5, y: 150.5 }
);
// Returns { width: 100, height: 80 } (adjusted for crispness)
```

**Rules**:
- Grid-centered (integer coords) + odd strokeWidth → odd dimensions
- Grid-centered (integer coords) + even strokeWidth → even dimensions
- Pixel-centered (*.5 coords) + odd strokeWidth → even dimensions
- Pixel-centered (*.5 coords) + even strokeWidth → odd dimensions

#### `ensureHalfPoint(value)`

Converts any value to half-point (*.5) for crisp 1px strokes.

```javascript
ensureHalfPoint(165);    // 165.5
ensureHalfPoint(165.7);  // 165.5
```

#### `roundPoint(point)`

Rounds point coordinates to integers.

```javascript
roundPoint({ x: 123.7, y: 45.2 });  // { x: 124, y: 45 }
```

### Shape Parameter Calculators

#### `calculateCircleTestParams(options)`

Calculates circle parameters with proper positioning.

```javascript
const params = calculateCircleTestParams({
    canvasWidth: 400,
    canvasHeight: 300,
    minRadius: 8,          // default: 8
    maxRadius: 42,         // default: 42
    hasStroke: false,      // default: false
    minStrokeWidth: 1,     // default: 1
    maxStrokeWidth: 4,     // default: 4
    randomPosition: true,  // default: true
    marginX: 60,           // default: 60
    marginY: 60            // default: 60
});
// Returns: { centerX, centerY, radius, strokeWidth, finalDiameter, atPixel }
```

#### `calculateArcTestParams(options)`

Extends circle parameters with arc angles (gap constrained to single quadrant).

```javascript
const params = calculateArcTestParams({
    canvasWidth: 400,
    canvasHeight: 300,
    minRadius: 20,
    maxRadius: 80
});
// Returns: { ...circleParams, startAngle, endAngle, gapQuadrant, gapSizeDeg }
```

#### `calculate90DegArcTestParams(options)`

Calculates parameters for a single 90-degree fill+stroke arc.

```javascript
const params = calculate90DegArcTestParams({
    canvasWidth: 400,
    canvasHeight: 300,
    minDiameter: 40,
    maxDiameter: 200,
    strokeWidth: 1
});
// Returns: { centerX, centerY, radius, atPixel, quadrantIndex, quadrant,
//            startAngle, endAngle, checkData }
```

#### `calculateCrispRectTestParams(options)`

Calculates rectangle parameters with crisp stroke adjustment.

```javascript
const params = calculateCrispRectTestParams({
    canvasWidth: 400,
    canvasHeight: 300,
    minWidth: 50,
    maxWidth: 400,
    minHeight: 50,
    maxHeight: 400,
    maxStrokeWidth: 10,
    ensureEvenStroke: false,
    randomPosition: false
});
// Returns: { center: {x, y}, adjustedDimensions: {width, height}, strokeWidth }
```

### Analysis Functions

#### `analyzeExtremes(surface, backgroundColor, colorTolerance)`

Finds bounding box of non-background pixels.

```javascript
const bounds = analyzeExtremes(surface, { r: 255, g: 255, b: 255, a: 255 }, 0);
// Returns: { topY, bottomY, leftX, rightX }
```

#### `countUniqueColors(surface)`

Counts total unique colors in surface.

#### `countUniqueColorsInMiddleRow(surface)` / `countUniqueColorsInMiddleColumn(surface)`

Counts unique colors in specific scanlines.

#### `countSpeckles(surface)`

Counts isolated single-pixel artifacts.

```javascript
const result = countSpeckles(surface);
// Returns: { count: 0, firstSpeckle: null } or { count: 3, firstSpeckle: {x, y} }
```

---

## 5. Modular Utility Architecture

The test utilities have been modularized into 10 focused modules, each with a single responsibility. This architecture improves maintainability, testability, and enables three-way verification in the browser (SWCanvas ↔ HTML5 Canvas ↔ checkData).

### Architecture Overview

The `direct-rendering-test-utils.js` file acts as a **facade** that re-exports all modules for Node.js compatibility:

```
direct-rendering-test-utils.js (facade)
├── Re-exports all functions from modular files
└── Provides backwards compatibility for existing imports
```

### Module Reference

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `seeded-random.js` | Deterministic RNG using SFC32 algorithm | `SeededRandom` |
| `random-test-values.js` | Random color/point generators | `getRandomColor()`, `getRandomOpaqueColor()`, `getRandomPoint()` |
| `test-registry.js` | Test registration and registries | `registerDirectRenderingTest()`, `DIRECT_RENDERING_TESTS` |
| `surface-analysis.js` | Pixel-level analysis (bounds, color counting) | `analyzeExtremes()`, `countUniqueColors()`, `countSpeckles()` |
| `color-matching.js` | Color comparison and pixel classification | `colorsMatch()`, `isBackgroundPixel()` |
| `stroke-continuity-1px.js` | 8-connectivity validation for 1px strokes | `checkStroke8Connectivity()` |
| `shape-integrity-checker.js` | Universal validation for closed convex shapes | `ShapeIntegrityChecker` |
| `validation-runner.js` | Validation orchestrator | `runValidationChecks()` |
| `performance-size-categories.js` | Performance test size configurations | `STROKE_WIDTH_CATEGORIES`, `SHAPE_SIZE_CATEGORIES` |
| `positioning-and-bounds.js` | Shape positioning and bounds calculations (921 lines) | `calculateCircleTestParams()`, `calculateFilledCircleBounds()`, etc. |

### Browser Script Loading Order

When loading in browser (`index.html`), scripts must be loaded in dependency order:

```html
<!-- Base modules (no dependencies) -->
<script src="seeded-random.js"></script>
<script src="random-test-values.js"></script>
<script src="test-registry.js"></script>
<script src="surface-analysis.js"></script>
<script src="color-matching.js"></script>
<script src="stroke-continuity-1px.js"></script>
<script src="shape-integrity-checker.js"></script>
<script src="validation-runner.js"></script>
<script src="performance-size-categories.js"></script>
<script src="positioning-and-bounds.js"></script>
```

### Module Dependency Diagram

```
┌─────────────────────────┐
│    seeded-random.js     │ ← No dependencies (foundation)
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│  random-test-values.js  │ ← Uses SeededRandom
└─────────────────────────┘

┌─────────────────────────┐
│    color-matching.js    │ ← No dependencies
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│   surface-analysis.js   │ ← Uses color-matching
└─────────────────────────┘

┌─────────────────────────┐
│stroke-continuity-1px.js │ ← Uses color-matching
└─────────────────────────┘

┌─────────────────────────┐
│shape-integrity-checker.js│ ← Uses surface-analysis
└─────────────────────────┘

┌─────────────────────────┐
│   validation-runner.js  │ ← Orchestrates all validators
└─────────────────────────┘

┌─────────────────────────┐
│positioning-and-bounds.js│ ← Uses seeded-random (921 lines)
└─────────────────────────┘
```

### Dual-Environment Exports

All modules use a dual-export pattern for Node.js and browser compatibility:

```javascript
// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { functionName, anotherFunction };
}

// Browser exports (attach to window)
if (typeof window !== 'undefined') {
    window.functionName = functionName;
    window.anotherFunction = anotherFunction;
}
```

### Function Name Standardization

The modularization standardized function names. Legacy aliases have been removed:

| Old Name (Removed) | New Standardized Name |
|-------------------|----------------------|
| `calculateCircleTestParameters` | `calculateCircleTestParams` |
| `calculateArcTestParameters` | `calculateArcTestParams` |
| `calculateLineTestParameters` | `calculateLineTestParams` |
| `placeCloseToCenterAtPixel` | `calculateCenterAtPixel` |
| `placeCloseToCenterAtGrid` | `calculateCenterAtGrid` |
| `calculateCircleBounds` | `calculateFilledCircleBounds` |
| `calculateRectangleBounds` | `calculateStrokedRectBounds` |
| `calculateCrispStrokeRectBounds` | `calculateCrispStrokedRectBounds` |
| `calculateFillRectBounds` | `calculateFilledRectBounds` |
| `calculateLineBounds` | `calculateStrokedLineBounds` |
| `aggregateBounds` | `calculateAggregateBounds` |

---

## 6. File Naming Convention

Test files use a parametrized naming scheme encoding test characteristics:

```
{shape}-{count}-{size}-{fill}-{stroke}-{strokeWidth}-{layout}-{center}-{edge}-{orientation}-{extras}-test.js
```

### Naming Components

| Component | Prefix | Values | Description |
|-----------|--------|--------|-------------|
| **Shape** | - | `line`, `circle`, `arc`, `rect`, `roundrect` | Shape type |
| **Count** | `m` / `sgl` | `sgl`, `m5`, `m12`, `m20` | Single or multi-N shapes |
| **Size** | `sz` | `Mix`, `Rand`, `Sm`, `Med`, `Lg`, `XL` | Size category |
| **Fill** | `f` | `None`, `Opaq`, `Semi`, `Mix` | Fill style |
| **Stroke** | `s` | `None`, `Opaq`, `Semi`, `Mix` | Stroke style |
| **Stroke Width** | `sw` | `1px`, `1-10px`, `2-40px`, `Mix` | Stroke thickness |
| **Layout** | `lyt` | `Center`, `Spread`, `Grid`, `Rand` | Shape distribution |
| **Center** | `cen` | `Grid`, `Px`, `Rand`, `MixPG` | Center positioning |
| **Edge** | `edge` | `Crisp`, `NotCrisp` | Edge alignment |
| **Orientation** | `orn` | `Axial`, `Rand`, `Rot`, `Horiz` | Shape orientation |

### Shape-Specific Extras

| Shape | Component | Values | Description |
|-------|-----------|--------|-------------|
| Arc | `arcA` | `Rand`, `Deg90`, `Small` | Arc angle extent |
| Arc | `quad` | `Rand` | Quadrant selection |
| RoundedRect | `rrr` | `Rand`, `Mix`, `Lrg`, `Sm` | Corner radius |

### Context Transform Suffixes

| Suffix | Description |
|--------|-------------|
| `ctxTransRand` | Random translation applied |
| `ctxRotRand` | Random rotation applied |
| `ctxScaleRand` | Random scaling applied |

### Examples

```
line-m20-szMix-fNone-sOpaq-sw1px-lytSpread-edgeNotCrisp-ornRand-test.js
│    │   │     │     │     │     │         │             │
│    │   │     │     │     │     │         │             └─ Random orientation
│    │   │     │     │     │     │         └─ Non-crisp edges (floating point)
│    │   │     │     │     │     └─ Spread layout across canvas
│    │   │     │     │     └─ 1px stroke width
│    │   │     │     └─ Opaque stroke
│    │   │     └─ No fill
│    │   └─ Mixed sizes
│    └─ 20 shapes
└─ Line shape

arc-sgl-szMix-fOpaq-sOpaq-sw1-10px-lytCenter-cenMixPG-edgeCrisp-arcADeg90-quadRand-test.js
                                                                │         │
                                                                │         └─ Random quadrant
                                                                └─ 90-degree arc angle
```

---

## 7. Categories

Tests are organized into five categories matching direct rendering shape types:

| Category | Shape Type | Direct API Methods |
|----------|------------|-------------------|
| `'lines'` | Lines | `strokeLine()` |
| `'circles'` | Circles | `fillCircle()`, `strokeCircle()`, `fillStrokeCircle()` |
| `'arcs'` | Arcs | `fillArc()`, `outerStrokeArc()`, `fillOuterStrokeArc()` |
| `'rects'` | Rectangles | `fillRect()`, `strokeRect()`, `fillStrokeRect()` |
| `'rounded-rects'` | Rounded Rectangles | `fillRoundRect()`, `strokeRoundRect()`, `fillStrokeRoundRect()` |

### Category-Specific Considerations

#### Lines
- No fill (stroke only)
- No center position (uses start/end points)
- Orientation: horizontal, vertical, diagonal, random

#### Circles
- Rotation-invariant (no orientation facet)
- Center positioning: grid or pixel
- Crisp rendering depends on diameter/strokeWidth parity

#### Arcs
- Gap constrained to single quadrant for extremes validation
- Arc angle extent: 90-degree, small, random
- Fill includes pie-slice to center

#### Rectangles
- Axis-aligned or rotated
- Crisp rendering depends on dimension/strokeWidth/center alignment

#### Rounded Rectangles
- Corner radius: small, medium, large, random
- When radius=0, falls back to rectangle rendering
- Complex crisp rendering rules for corners

---

## 8. Performance Testing

Performance tests compare SWCanvas direct rendering against native HTML5 Canvas using ramp-up methodology.

**Important**: SWCanvas and HTML5 Canvas use different measurement strategies due to fundamental differences in how they render:
- **SWCanvas**: Uses direct `performance.now()` timing (synchronous CPU rendering)
- **HTML5 Canvas**: Uses VSync cliff detection (asynchronous GPU rendering)

For a detailed explanation of why this is necessary and how it works, see [PERFORMANCE-BENCHMARKING.md](PERFORMANCE-BENCHMARKING.md).

For a workflow guide on using performance tests to benchmark code changes, see [PERFORMANCE-TESTING-WORKFLOW.md](PERFORMANCE-TESTING-WORKFLOW.md).

### Build Requirements

**IMPORTANT**: Performance tests require the minified build for accurate results.

```bash
npm run build:prod    # Creates dist/swcanvas.min.js
```

Performance tests load `dist/swcanvas.min.js` to ensure benchmarks reflect production performance. The Node.js runner will error if the minified build is missing.

### Performance Test Architecture

Performance tests are **separate from visual regression tests**:

- **Visual tests** (`/cases/`): Focus on pixel-accurate rendering verification
- **Performance tests** (`/perf-cases/`): Focus on throughput benchmarking via parametric generation

Performance tests are generated using the parametric test generator (`performance-test-generator.js`), which creates comprehensive coverage across:
- 9 stroke width categories (sw0, sw1px, swXXS, swXS, swS, swM, swL, swXL, swXXL)
- 7 shape size categories (szXXS, szXS, szS, szM, szL, szXL, szXXL)
- 8 operation combinations (stroke/fill × opaque/semi-transparent)
- 4 arc angle categories (for arc tests only)

### Adding Performance Tests

To add new performance tests, create a generator file in `/perf-cases/`:

```javascript
// perf-cases/my-shape-perf.js
registerParametricPerfTests({
    baseId: 'my-shape',
    baseName: 'My Shape',
    category: 'shapes',
    operations: ['stroke-opaque', 'stroke-semi', 'fill-opaque', 'fill-semi'],
    drawFunction: function(ctx, instances, params) {
        // Draw `instances` shapes using params (strokeWidth, size, operation)
        // ...
        return null;
    }
});
```

Tests registered via `registerParametricPerfTests()` automatically set `performanceTestSupported: true` and are added to `DIRECT_RENDERING_PERF_REGISTRY`.

### Running Performance Tests

```bash
# Browser (compares SWCanvas vs HTML5 Canvas with adaptive ramp-up)
open tests/direct-rendering/performance-tests.html

# Node.js (SWCanvas only, fixed iteration timing)
npm run test:direct-rendering:perf

# Node.js with options
npm run test:direct-rendering:perf -- -t line    # Filter by test name
npm run test:direct-rendering:perf -- -s 5000    # 5000 shapes per run
npm run test:direct-rendering:perf -- -r 10      # 10 measurement runs
npm run test:direct-rendering:perf -- -q         # Quiet mode
```

### Performance Test Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| SW Canvas increment | Shapes added per iteration | 10 |
| HTML5 Canvas increment | Shapes added per iteration | 50 |
| SW Canvas start count | Initial shape count | 10 |
| HTML5 Canvas start count | Initial shape count | 10 |
| Consecutive exceedances | Budget overruns before stopping | 10 |
| Runs per test | Iterations to average | 1 |
| Include blitting | Include buffer copy in timing | checked |
| Quiet mode | Reduce logging | checked |

### How Ramp-Up Works

1. Start with initial shape count
2. Draw shapes and measure time (see [PERFORMANCE-BENCHMARKING.md](PERFORMANCE-BENCHMARKING.md) for measurement details)
3. If time < frame budget threshold: increment shape count (binary search growth)
4. If time > frame budget threshold: refine search to find exact cliff
5. Stop when convergence precision reached
6. Apply scaling correction for HTML5 Canvas results (normalizes to frame budget)
7. Report maximum shapes per frame

### Performance Test Output

```
=== PERF: CIRCLE FILL OPAQUE TEST RESULTS ===
Test Parameters:
- Display refresh rate: 120 fps
- Frame budget: 8.33ms
- SW Canvas start count: 10
- SW Canvas increment: 10
- ...

SWCanvas Performance:
- Maximum shapes per frame: 450

HTML5 Canvas Performance:
- Maximum shapes per frame: 12500

Performance Ratio (HTML5 / SWCanvas): 27.78x
```

### Profiling Mode

Click "Enable Profiling Mode" to:
- Set high exceedance threshold (100000)
- Force quiet mode
- Allow browser DevTools profiling without early termination

---

## Running Tests

### Node.js Test Runner

Run direct rendering tests from command line:

```bash
# Run all tests (1 iteration each)
npm run test:direct-rendering

# Show help
npm run test:direct-rendering -- -h
```

#### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --test=<filter>` | Filter tests by name substring | (all tests) |
| `-i, --iterations=<N>` | Number of iterations to run | 1 |
| `-s, --start=<N>` | Starting iteration number | 1 |
| `-l, --logs` | Show verbose test logs | off |
| `-h, --help` | Show help message | - |

#### Examples

```bash
# Run only roundrect tests
npm run test:direct-rendering -- -t roundrect

# Run only iteration 10 of circle tests
npm run test:direct-rendering -- -t circle -s 10 -i 1

# Run iterations 100-104 with verbose logs
npm run test:direct-rendering -- -s 100 -i 5 -l

# Run a specific test at a specific iteration with logs
npm run test:direct-rendering -- -t circle-m5 -s 10 -i 1 -l
```

### Browser Visual Tests

```bash
open tests/direct-rendering/index.html
```

### Browser Performance Tests

```bash
open tests/direct-rendering/performance-tests.html
```

### Node.js Performance Tests

```bash
npm run test:direct-rendering:perf
```

The Node.js runner uses fixed-iteration timing (simpler than browser's adaptive ramp-up since SWCanvas is synchronous):

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --test=<filter>` | Filter tests by name or perfName | (all tests) |
| `-s, --shapes=<N>` | Shapes per measurement run | 1000 |
| `-w, --warmup=<N>` | Warmup iterations | 100 |
| `-r, --runs=<N>` | Measurement runs to average | 5 |
| `-q, --quiet` | Summary only | off |
| `-h, --help` | Show help | - |

**Examples:**
```bash
npm run test:direct-rendering:perf -- -t line         # Filter to line tests
npm run test:direct-rendering:perf -- -s 5000 -r 10   # Custom config
npm run test:direct-rendering:perf -- -q              # Quiet mode
```

### Production Benchmarking

For production baselines and statistical analysis, use `benchmark-session.js`:

```bash
node tests/direct-rendering/scripts/benchmark-session.js \
  --output baseline.json \
  --warmup-ms 3000 \
  --super-measurements 30 \
  --fixed-positions \
  --skip-outliers
```

This tool uses statistical filtering (sub-run CV checking, IQR outlier removal) to achieve 0.7-0.9% CV. See [PERFORMANCE-BENCHMARKING.md](PERFORMANCE-BENCHMARKING.md) and [PERFORMANCE-TESTING-WORKFLOW.md](PERFORMANCE-TESTING-WORKFLOW.md) for details.

---

## 9. Test Metadata Validation

Validation tools ensure test files follow naming conventions and include required metadata.

### Validation Commands

| Command | Description |
|---------|-------------|
| `npm run check:test-metadata` | Full validation (metadata, signatures, filename parsing) |
| `npm run check:register-consistency` | Quick check that registered names match filenames |

### What Gets Validated

#### `check:test-metadata` validates:
1. **registerDirectRenderingTest call** - Must be present
2. **Required metadata** - `title:` and `description:` must exist
3. **Filename parameter** - Must match actual filename (with or without `-test` suffix)
4. **drawTest signature** - Must be `function drawTest(ctx, iterationNumber, instances)`
5. **Filename parsing** - Must follow naming convention (see Section 5)

#### `check:register-consistency` validates:
- Registered test name matches actual filename

### Browser Facet Display

When viewing tests in `tests/direct-rendering/index.html`, each test shows a parsed breakdown of its filename facets:

- **Basic**: Shape, Count, Size, Orientation
- **Fill & Stroke**: Fill Style, Stroke Style, Stroke Thickness
- **Layout & Position**: Layout, Centered At, Edge Alignment
- **Shape-Specific**: Arc Angle, Quadrant, Round Rect Radius
- **Context Transforms**: Translation, Rotation, Scaling
- **Modifiers**: Special Modifiers
- **Clipping**: Clip Shape, Count, Arrangement, Size, Edge Alignment

Parsing errors are displayed in red below the test description.

### Validation Files

| File | Purpose |
|------|---------|
| `tests/direct-rendering/test-name-parser.js` | Core parser class with facet mappings |
| `tests/direct-rendering/test-facet-display.js` | Browser integration for facet tables |
| `build-scripts/check-test-metadata.js` | Node.js build validation script |
| `build-scripts/check-register-consistency.sh` | Shell script for consistency check |

---

## See Also

- [tests/README.md](../README.md) - Main test documentation
- [PERFORMANCE-BENCHMARKING.md](PERFORMANCE-BENCHMARKING.md) - Performance benchmarking mechanics (statistical filtering, v3.0 system)
- [DIRECT-RENDERING-SUMMARY.MD](../../DIRECT-RENDERING-SUMMARY.MD) - Direct rendering implementation details
- [tests/build/README.md](../build/README.md) - Build utilities for test management (includes snapshot verification tools)

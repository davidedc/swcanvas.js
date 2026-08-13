# SWCanvas.js Test Suite

This directory contains the comprehensive **modular test infrastructure** for SWCanvas, with 87 core tests + 154 visual tests + 79 direct rendering tests and cross-platform compatibility.

## Modular Test Architecture

```
tests/
├── core/                          # 87 individual core test files (001-037)
│   ├── 001-surface-creation-valid.js
│   ├── 015-alpha-blending-test.js  
│   ├── 031-transform-matrix-order-dependency.js
│   └── ... (33 more files)
├── visual/                        # 154 individual visual test files (001-140)
│   ├── 001-simple-rectangle-test.js
│   ├── 027-fill-rule-complex-test.js
│   ├── 056-stroke-pixel-analysis-test.js
│   └── ... (137 more files)
├── browser/                       # Browser-specific test files
│   ├── index.html                 # Main browser test page (interactive + comparisons)
│   ├── minimal-example.html       # Minimal usage example
│   └── browser-test-helpers.js    # Browser-specific interactive testing tools
├── direct-rendering/              # Direct rendering path verification tests (79 tests)
│   ├── cases/                     # 79 individual parametrized test case files
│   ├── performance-tests/         # Performance comparison infrastructure
│   │   ├── performance-utils.js   # Core ramp-up testing engine
│   │   └── performance-ui.js      # Dynamic UI generation
│   ├── run-direct-rendering-tests.js    # Test runner with path verification
│   ├── direct-rendering-test-utils.js   # Test utilities and registration
│   ├── browser-test-runner.js     # Browser-based test execution
│   ├── index.html                 # Browser test interface
│   └── performance-tests.html     # Performance comparison interface
├── dist/                          # Built test files (auto-generated, .gitignored)
│   ├── core-functionality-tests.js    # Auto-generated from /core/
│   └── visual-rendering-tests.js      # Auto-generated from /visual/
├── build/
│   ├── concat-tests.js            # Build-time concatenation script
│   ├── renumber-tests.js          # Test renumbering utility
│   ├── update-test-counts.js      # Test count synchronization
│   └── README.md                  # Build utilities documentation
├── core-functionality-tests.js          # Original (fallback/reference)
├── visual-rendering-tests.js            # Original (fallback/reference)
├── run-tests.js                         # Smart test runner with auto-detection
├── output/                              # Generated PNG test images (144+ files)
└── README.md                            # This file
```

## Running Tests

### Node.js Tests
```bash
# Build modular tests + run complete test suite
npm run build  # Concatenates individual test files
npm test       # Runs 78 core + 154 visual tests

# Direct rendering tests (run separately)
npm run test:direct-rendering  # Runs 79 direct rendering path verification tests
```

**Note**: Direct rendering tests verify optimized code paths are invoked and run separately from the main test suite. See the [Direct Rendering Tests](#direct-rendering-tests---79-tests) section for details.

### Browser Tests
1. Open `tests/browser/index.html` in a web browser (automatically runs all tests on page load)
2. Automatically runs 87 modular core functionality tests from `/tests/core/` 
3. Automatically runs all 154 visual rendering tests with side-by-side HTML5 Canvas vs SWCanvas comparison
4. Use interactive visual comparison tools for real-time testing
5. Minimal example: Open `tests/browser/minimal-example.html` to see a minimal usage example

**Technical Note**: Browser visual comparisons use `renderSWCanvasToHTML5()` helper function in `tests/build/concat-tests.js` which correctly transfers SWCanvas Surface data (non-premultiplied RGBA) to HTML5 Canvas ImageData without unpremultiplication, ensuring accurate semi-transparent color display.

## Modular Dual Test Architecture

SWCanvas uses a **modular complementary dual test system** where individual test files are automatically concatenated at build time, maintaining both development flexibility and production performance:

### Core Functionality Tests - 37 Individual Files
**Location**: `/tests/core/` (individual files) → `/tests/dist/core-functionality-tests.js` (concatenated)

**Modular Structure**:
- **37 individual test files** numbered 001-037 with descriptive names
- **Build-time concatenation** into single optimized file
- **Smart test runner** automatically uses built version
- **Development benefit**: No merge conflicts, focused editing

**Characteristics**:
- **37 unit tests** using `assertEquals()`, `assertThrows()` assertions
- **Output**: Console logs with ✓ pass/✗ fail status + detailed error messages
- **Environment**: Runs identically in both Node.js and browser
- **Focus**: API correctness, error handling, data validation, mathematical accuracy

**Test Types**:
- ✅ **API Validation**: Surface creation, dimension validation, error handling
- ✅ **Mathematical Correctness**: Matrix operations, coordinate transformations
- ✅ **State Management**: Context save/restore, property persistence  
- ✅ **Data Structures**: SWPath2D command recording, parameter validation
- ✅ **Integration Points**: PNG generation, cross-platform consistency

**Example Modular Test File** (`/tests/core/001-surface-creation-valid.js`):
```javascript
// Test: Surface creation with valid dimensions
// This file will be concatenated into the main test suite

// Test 001
test('Surface creation with valid dimensions', () => {
    const surface = SWCanvas.Core.Surface(400, 300);
    assertEquals(surface.width, 400);
    assertEquals(surface.height, 300);
    // ✓ Programmatic validation with assertions
});
```

### Visual Rendering Tests - 140 Individual Files
**Location**: `/tests/visual/` (individual files) → `/tests/dist/visual-rendering-tests.js` (concatenated)

**Modular Structure**:
- **144 individual test files** numbered 001-144 with descriptive names
- **Build-time concatenation** preserves registerVisualTest pattern
- **Smart test runner** with automatic fallback to original
- **Development benefit**: Isolated test development, clear organization

**Characteristics**:
- **144 visual tests** that generate actual rendered images
- **Output**: PNG files (Node.js) + side-by-side comparison (browser)
- **Environment**: PNG generation in Node.js, visual comparison in browser
- **Focus**: Rendering accuracy, visual consistency

**Test Categories**:
- ✅ **Phase 1**: Basic transformations (translate, scale, rotate) - 8 tests
- ✅ **Phase 2**: Advanced path filling (curves, self-intersecting, fill rules) - 9 tests
- ✅ **Phase 3**: Stencil-based clipping system (intersection, nesting) - 8 tests
- ✅ **Phase 4**: Combined features (transform+clip+fill+stroke integration) - 7 tests
- ✅ **Phase 5**: Image operations (drawImage with transforms and alpha) - 6 tests
- ✅ **Stroke Rendering**: Line styles, caps, joins, sub-pixel accuracy - 6 tests
- ✅ **Line Dashing**: Dash patterns, offsets, complex paths - 3 tests
- ✅ **Gradient & Pattern Strokes**: All paint sources with sub-pixel strokes - 15 tests
- ✅ **Thick Polyline Joins**: Systematic testing of bevel, miter, round joins with dash patterns - 3 tests
- ✅ **Composite Operations - Basic**: All 10 Porter-Duff operations - 10 tests (079-088)
- ✅ **Debug & Analysis**: Specific rendering issue investigation - 2 tests (089-090)
- ✅ **Composite Operations - Minimal**: Clean minimal tests with basic shapes - 10 tests (091-100)
- ✅ **Composite Operations - Clipped**: All 10 operations with clipping mask interaction - 10 tests (101-110)
- ✅ **Composite Operations - Stroked**: All 10 operations with stroke rendering - 10 tests (111-120)
- ✅ **Composite Operations - Clipped+Stroked**: All 10 operations with clipping + strokes - 10 tests (121-130)
- ✅ **Ellipse**: Ellipse drawing with various orientations and partial arcs - 1 test (131)
- ✅ **ArcTo**: arcTo() path construction with edge cases - 2 tests (132-133)
- ✅ **Hit Testing**: isPointInPath/isPointInStroke with fill rules and Path2D - 5 tests (134-138)
- ✅ **Shadows**: Shadow rendering with blur, offset, clipping, rotation, gradients - 6 tests (139-144)

**Example Modular Test File** (`/tests/visual/002-alpha-blending-test.js`):
```javascript
// Test: Alpha Blending Test  
// This file will be concatenated into the main visual test suite

// Test 2
registerVisualTest('alpha-test', {
    name: 'Alpha blending test - semi-transparent rectangles',
    width: 200, height: 150,
    // Unified drawing function that works with both canvas types
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'red';
        ctx.fillRect(20, 20, 80, 60);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'green';  
        ctx.fillRect(40, 40, 80, 60);
        // → Generates image file for verification
    }
});
```

### Architectural Relationship: Intentional Complementary Redundancy

**Smart Delegation Pattern**:
```javascript
// core-functionality-tests.js
test('Alpha blending test - semi-transparent rectangles', () => {
    // 1. Try to delegate to visual test for consistency
    if (typeof VisualRenderingTests !== 'undefined') {
        const visualTest = VisualRenderingTests.getTest('alpha-test');
        if (visualTest) {
            const surface = visualTest.drawSWCanvas(SWCanvas);
            savePNG(surface, 'alpha-test.png', 'alpha test', SWCanvas);
            
            // 2. Add programmatic validation on top of visual test
            const pixel = getPixelAt(surface, 60, 50); // Green over red area
            assertEquals(pixel.r, 127); // Verify alpha blending math
            return; // ✓ Both visual AND programmatic verification
        }
    }
    
    // 3. Fallback inline test if visual test unavailable
    // ... inline drawing and assertion code
});
```

**Why This Architecture Works**:

1. **Dual Verification**: 8 overlapping tests get BOTH programmatic validation AND visual verification
2. **Fallback Safety**: Core tests work even when visual tests are unavailable  
3. **Cross-Platform Consistency**: Node.js validates math, browser validates visual output
4. **No Code Duplication**: Visual tests define drawing once, used by both test types
5. **Comprehensive Coverage**: Mathematical correctness + rendering validation

**Benefits of Complementary Testing**:
- **Catch More Bugs**: Logic errors caught by assertions, rendering errors caught by visual comparison
- **Platform Validation**: Ensures identical behavior across Node.js and browser environments
- **Regression Prevention**: Any change must pass both programmatic AND visual validation
- **Development Confidence**: Developers can trust that changes maintain both correctness AND visual fidelity

### Browser-Only Tests (`tests/browser/`)
Interactive tests requiring DOM and visual comparison:
- ✅ Side-by-side HTML5 Canvas vs SWCanvas rendering
- ✅ Interactive drawing tools
- ✅ Real-time pixel value debugging
- ✅ PNG file download functionality

### Direct Rendering Tests - 79 Tests
**Location**: `/tests/direct-rendering/cases/` (individual files)

**Purpose**: Verify that optimized direct rendering code paths are invoked instead of path-based fallback rendering. These tests use dedicated shape APIs (`fillCircle`, `strokeRect`, etc.) that bypass the path-based rendering pipeline for performance.

**Key Characteristics**:
- **79 parametrized test cases** with combinatorial coverage
- **Path verification**: Critical `wasPathBasedUsed()` check - tests FAIL if path-based rendering was used
- **Seeded random**: Deterministic reproducibility across runs
- **Dual-environment**: Runs in both Node.js and browser

**What Makes These Different from Visual Tests**:

| Aspect | Direct Rendering Tests | Visual Tests |
|--------|------------------------|--------------|
| **Primary Focus** | Rendering path verification | Pixel output correctness |
| **Critical Check** | `wasPathBasedUsed()` detection | PNG comparison |
| **API Used** | Dedicated shape APIs (`fillCircle`, `strokeRect`) | HTML5 Canvas 2D Context |

**Running Direct Rendering Tests**:
```bash
# Run all direct rendering tests
npm run test:direct-rendering

# Run specific test range
node tests/direct-rendering/run-direct-rendering-tests.js -i 10

# Browser testing (visual comparison)
open tests/direct-rendering/index.html

# Browser testing (performance comparison)
open tests/direct-rendering/performance-tests.html
```

**Browser Polyfills**: Browser tests use polyfills from `lib/swcanvas-compat-polyfill.js` which add SWCanvas-compatible methods (`fillCircle`, `strokeRoundRect`, `fillAndStrokeRoundRect`, etc.) to native HTML5 Canvas, enabling side-by-side comparison testing.

**Performance Testing**: The performance testing page (`performance-tests.html`) provides ramp-up performance comparison between SWCanvas Direct rendering and native HTML5 Canvas. Tests incrementally increase shape count until the frame budget is exceeded, measuring maximum shapes per frame for each renderer. See [Performance Testing](#performance-testing) section below.

**Test Coverage**:
- Circle fill and stroke operations
- Rectangle fill and stroke operations
- Line stroke operations
- Arc fill and stroke operations
- Rounded rectangle operations
- Various positioning (centered, edge-aligned, off-canvas)
- Multiple sizes (small, medium, large)

For detailed documentation on the direct rendering system and APIs, see [DIRECT-RENDERING-SUMMARY.MD](../DIRECT-RENDERING-SUMMARY.MD).

For comprehensive documentation on direct rendering tests (registration API, check options, utility functions, naming conventions, and performance testing), see [tests/direct-rendering/README.md](direct-rendering/README.md).

### Performance Testing

```bash
# Open performance tests in browser
open tests/direct-rendering/performance-tests.html
```

Parametric performance tests in `/perf-cases/` are available for benchmarking. The benchmarking system uses different measurement strategies for SWCanvas (direct timing) vs HTML5 Canvas (VSync cliff detection with scaling correction).

- **Usage and configuration**: [direct-rendering/README.md](direct-rendering/README.md#7-performance-testing)
- **Benchmarking mechanics**: [direct-rendering/PERFORMANCE-BENCHMARKING.md](direct-rendering/PERFORMANCE-BENCHMARKING.md)

## Benefits

1. **No Duplication**: Core test logic exists in one place
2. **Consistency**: Same tests produce same results everywhere
3. **Cross-Platform Validation**: Ensures identical behavior in Node.js and browsers
4. **Easy Maintenance**: Update test logic once, runs everywhere
5. **Comprehensive Coverage**: Combines programmatic testing with visual validation

## Adding New Tests

**For advanced test organization and renumbering utilities, see [tests/build/README.md](build/README.md).**

### For Core Functionality Tests
Create a new individual file in `/tests/core/` following the [naming convention](build/README.md#file-naming-convention):

```bash
# Create new core test
echo "// Test: New feature test" > tests/core/038-new-feature-test.js
echo "test('New feature test', () => { /* test code */ });" >> tests/core/038-new-feature-test.js

# Build automatically includes it
npm run build && npm test
```

### For Visual Rendering Tests
Create a new individual file in `/tests/visual/` following the same [naming convention](build/README.md#file-naming-convention):

```bash
# Create new visual test
cat > tests/visual/145-new-visual-test.js << 'EOF'
// Test: New Visual Test
// This file will be concatenated into the main visual test suite

registerVisualTest('new-visual-test', {
    name: 'New visual feature test',
    width: 200, height: 150,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        // Standard HTML5 Canvas API works with both implementations
        ctx.fillStyle = 'blue';
        ctx.fillRect(10, 10, 100, 100);
    }
});
EOF

# Build automatically includes it
npm run build && npm test
```

### For Browser-Specific Features
Add interactive tests to `tests/browser/index.html` for features requiring DOM interaction or real-time visual comparison.

**Key Benefits of Modular Approach**:
- **No merge conflicts**: Each test is in its own file
- **Clear organization**: Numbered files with descriptive names
- **Easy maintenance**: Edit individual tests without affecting others
- **Automatic integration**: Build system includes new tests automatically

## Key Features

For architectural details about clipping systems and color handling, see ARCHITECTURE.md.

### Comprehensive Modular Test Coverage
- **87 modular core tests** covering all API functionality with individual files
- **154 modular visual tests** covering all major Canvas2D features
- **79 direct rendering tests** verifying optimized rendering path invocation
- **Build-time concatenation** for optimal performance
- **Smart test runner** with automatic fallback system
- **Cross-platform validation** (Node.js + browsers)
- **PNG generation** for visual inspection and regression detection
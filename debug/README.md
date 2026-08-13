# SWCanvas.js Debug Utilities

This directory contains **debugging scripts and utilities** for analyzing SWCanvas rendering behavior, investigating issues, and validating implementations against HTML5 Canvas.

**All debugging scripts (.js files) are tracked in git for collaborative debugging, while generated output image files (.png, .bmp) are gitignored to avoid repository bloat.**

## Overview

Debug utilities help developers:
- **Pixel-level analysis** of rendering output
- **Behavior comparison** between SWCanvas and HTML5 Canvas
- **Issue reproduction** with minimal test cases
- **Visual validation** through PNG output files
- **Development workflow** for investigating rendering problems

## Debug Script Categories

### Composite Operations Debugging

**Purpose**: Investigate Porter-Duff composite operation behavior and HTML5 Canvas compatibility.

- `debug-copy-color.js` - Copy operation with semi-transparent colors
- `debug-copy-composition.js` - Copy vs source-over comparison analysis
- `debug-browser-copy.js` - Browser rendering behavior analysis
- `debug-minimal-xor.js` - Minimal XOR test case analysis
- `debug-simple-xor.js` - Simple XOR debug with step-by-step analysis
- `debug-html5-xor.js` - HTML5-compatible API XOR testing
- `debug-overlap-analysis.js` - Coordinate overlap calculation and verification
- `debug-specific-pixel.js` - Individual pixel behavior investigation

### Step-by-Step Interactive Debugging

**Purpose**: Interactive browser-based tools for detailed operation-by-operation analysis.

- `xor-step-by-step.html` - Interactive XOR composite operation debugger with step-by-step canvas rendering comparison
- `html5-vs-sw-clearrect.html` - HTML5 Canvas vs SWCanvas clearRect behavior comparison

### clearRect Issue Debugging

**Purpose**: Utilities created to investigate and fix clearRect implementation issues.

- `clearrect-test.js` - Node.js clearRect behavior validation
- `gray-background-test.js` - Validates clearRect boundary behavior with background preservation

### Coordinate and Coverage Analysis

**Purpose**: Verify geometric calculations, shape coverage, and pixel positioning.

- `debug-coordinates.js` - Basic coordinate system validation
- `debug-xor-coverage.js` - Circle coverage area calculation
- `debug-overlap-analysis.js` - Shape intersection verification

### Rounded-Rect 1px Stroke Junction Analysis

**Purpose**: ASCII-dump and hash-compare the 1px rounded-rect stroke fast path's edge↔corner junctions across crisp spellings (integer, `*.5`, arbitrary-fractional coordinates). Built while fixing the shared-pixel-frame + quadrant-trig-snap contract (see DIRECT-RENDERING-SUMMARY.MD §6.5.2; pinned by `tests/core/046-048`).

- `probe-halfinteger-roundrect-corner.js` - Top-left corner close-up, integer vs half-integer input
- `probe-halfinteger-roundrect-full.js` - Full-shape dump: fast path (both spellings) vs generic 4-arc path
- `probe-halfinteger-alpha-gap.js` - Semi-transparent variant junction gaps (shortened-edge hand-off)
- `sweep-stroke1px-roundrect-hashes.js` - Parameter-grid render hasher for byte-level A/B of rasterizer changes (run at baseline and after a change, diff the JSONs)

### Circle Direct-Path Crisp Contract & Tier-0 Analysis

**Purpose**: ASCII-dump and hash-compare the direct circle paths (`fillCircle`/`strokeCircle`/`fillStrokeCircle`) across the coordinate-spelling grid, A/B'd against the generic `arc()` pipeline and across transforms. Built while wiring the tier-0 rect clip into CircleOps (pinned by `tests/core/050-052`).

- `probe-circle-crisp.js` - Full spelling grid: fill/1px/thick at integer vs fractional centers and radii, crisp-box idiom discovery, alpha overdraw check, transform pre-multiplication exactness, cardinal-extreme (trig-noise class) check
- `sweep-circle-hashes.js` - Parameter-grid render hasher over all three circle entry points incl. partially off-surface geometry (`SWCANVAS_DIST=<path>` runs it against a saved dist for baseline/after diffs)
- `probe-stadium-roundrect-degenerate.js` - Why fillStadium is its own entry point: measures the direct roundRect arm at the degenerate radius r=min(w,h)/2 (horizontal apex-column loss), the composition's alpha double-blend, and fillStadium against an analytic ideal stadium. Written when fillStadium had a dedicated StadiumOps arm; that arm was removed on parity evidence (§9 entries 15-16) and the entry point now renders generically, so sections 1-5 are a historical measurement of arms that no longer exist while section 6 still measures the live entry point

### Hairline (Sub-Pixel) Stroke Rule

**Purpose**: Measure what each of the five direct stroke entries does BELOW one device pixel, against the generic pipeline's rule (1px geometry at proportional opacity) and against the faint-1px dispatch that now implements it. Built while restating that rule on the direct paths (see DIRECT-RENDERING-SUMMARY.MD §3's Universal Stroke Rule; pinned by `tests/core/055`).

- `probe-hairline-strokes.js` - Per entry (`strokeRect`/`strokeRoundRect`/`strokeCircle`/`outerStrokeArc`/`strokeLine`, plus the rotated rect/roundRect branches): today-vs-generic-vs-faint-1px at identity and under scale(1.4)/scale(0.7), reporting painted count, opacity levels, outline connectivity and whether the generic path was reached; plus faintness-vs-width monotonicity, the Fizzygum rotate-handle ring inside a scaled island, and the threshold-continuity question (does a hairline land where the exact-1px stroke lands, or where the generic path puts it — they differ)

### Visual Comparison Tools

**Purpose**: Generate side-by-side comparisons and reference implementations.

- `debug-browser-xor.html` - Interactive browser comparison page
- `debug-reference-xor.js` - Reference implementation analysis
- `debug-complex-xor.js` - Complex test case debugging

### Output Files

**Purpose**: Visual verification of rendering output.

Generated output files from debug scripts for visual inspection:
- `debug-copy-color.bmp` - Copy operation color output
- `debug-copy-vs-sourceover.bmp` - Copy vs source-over comparison output
- `debug-minimal-xor.bmp` - Minimal XOR test result
- `debug-html5-xor.bmp` - HTML5 API XOR result
- `debug-simple-xor-analysis.bmp` - Simple XOR analysis (BMP legacy format)
- `debug-simple-xor-analysis.basic.png` - Simple XOR analysis (PNG with transparency)
- `debug-complex-xor-fixed.bmp` - Complex XOR after fixes

**Note**: Older scripts used BitmapEncoder (.bmp), newer scripts use PngEncoder (.png) for transparency support.

## Usage Patterns

### 1. Issue Investigation Workflow

When encountering a rendering issue:

```bash
# Step 1: Create minimal reproduction case
cp debug/debug-minimal-xor.js debug/debug-my-issue.js
# Edit debug-my-issue.js to reproduce your issue

# Step 2: Run analysis
node debug/debug-my-issue.js

# Step 3: Compare with HTML5 Canvas behavior
# Create corresponding HTML file for browser testing
cp debug/debug-browser-xor.html debug/debug-my-issue.html
```

### 2. Pixel-Level Analysis Template

```javascript
const SWCanvas = require('../dist/swcanvas.js');
const fs = require('fs');

console.log('=== PIXEL ANALYSIS DEBUG ===');
const canvas = SWCanvas.createCanvas(200, 200);
const ctx = canvas.getContext('2d');

// Your drawing operations here
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 200, 200);

// Analyze specific pixels
const testPoints = [
    [50, 50, 'Test point 1'],
    [100, 100, 'Test point 2']
];

testPoints.forEach(([x, y, desc]) => {
    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b, a] = imageData.data;
    console.log(`${desc} (${x},${y}): RGBA(${r},${g},${b},${a})`);
});

// Save for visual inspection (PNG preserves transparency)
const surface = canvas._coreSurface;
const pngData = SWCanvas.Core.PngEncoder.encode(surface);
fs.writeFileSync('debug/debug-my-analysis.png', Buffer.from(pngData));
console.log('Analysis saved: debug/debug-my-analysis.png');
```

### 3. Composite Operation Testing

```javascript
const SWCanvas = require('../dist/swcanvas.js');

// Test all composite operations systematically
const operations = [
    'source-over', 'destination-over', 'source-out', 'destination-out',
    'source-in', 'destination-in', 'source-atop', 'destination-atop', 
    'xor', 'copy'
];

operations.forEach(op => {
    console.log(`\n=== Testing: ${op} ===`);
    const canvas = SWCanvas.createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    
    // Standard test pattern
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = 'blue';
    ctx.fillRect(20, 20, 40, 40);
    
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = 'red';
    ctx.fillRect(40, 40, 40, 40);
    
    // Analyze result
    const overlap = ctx.getImageData(50, 50, 1, 1);
    console.log(`Overlap result: RGBA(${overlap.data.join(',')})`);
});
```

### 4. Browser Comparison Template

Create HTML files for visual comparison:

```html
<!DOCTYPE html>
<html>
<head><title>Debug Comparison</title></head>
<body>
    <h2>HTML5 Canvas vs SWCanvas Comparison</h2>
    <div style="display: flex; gap: 20px;">
        <div>
            <h3>HTML5 Canvas</h3>
            <canvas id="html5" width="200" height="200"></canvas>
        </div>
        <div>
            <h3>SWCanvas (load swcanvas.js first)</h3>
            <canvas id="swcanvas" width="200" height="200"></canvas>
        </div>
    </div>

    <script>
        // Your drawing code for both canvases
        function drawTest(ctx) {
            // Drawing operations here
        }
        
        // HTML5 Canvas
        const html5Ctx = document.getElementById('html5').getContext('2d');
        drawTest(html5Ctx);
        
        // SWCanvas (when loaded)
        if (typeof SWCanvas !== 'undefined') {
            const swCanvas = SWCanvas.createCanvas(200, 200);
            const swCtx = swCanvas.getContext('2d');
            drawTest(swCtx);
            
            // Transfer to display canvas
            const displayCanvas = document.getElementById('swcanvas');
            const displayCtx = displayCanvas.getContext('2d');
            const surface = swCanvas._coreSurface;
            const imageData = displayCtx.createImageData(200, 200);
            
            for (let i = 0; i < surface.data.length; i++) {
                imageData.data[i] = surface.data[i];
            }
            displayCtx.putImageData(imageData, 0, 0);
        }
    </script>
</body>
</html>
```

### 5. clearRect Issue Debugging

For investigating clearRect behavior and boundary conditions:

```bash
# Test clearRect boundary behavior
node debug/gray-background-test.js

# Interactive step-by-step XOR debugging (includes clearRect step)
open debug/xor-step-by-step.html
```

**Interactive Step-by-Step Debugging Usage:**
1. Open `xor-step-by-step.html` in Safari/Chrome
2. Click "Next Step" to advance through each rendering operation
3. Watch for differences between HTML5 Canvas and SWCanvas panels
4. Check detailed pixel analysis in the difference alert boxes
5. Use "Previous Step" and "Reset" for thorough investigation

**clearRect Validation Pattern:**
```javascript
// Template for testing clearRect behavior
const canvas = SWCanvas.createCanvas(300, 200);
const ctx = canvas.getContext('2d');

// 1. Fill background
ctx.fillStyle = '#f0f0f0';
ctx.fillRect(0, 0, 300, 200);

// 2. Clear specific area
ctx.clearRect(50, 50, 200, 100);

// 3. Validate boundaries
const insideCleared = ctx.getImageData(100, 100, 1, 1).data; // Should be transparent
const outsideCleared = ctx.getImageData(25, 25, 1, 1).data; // Should be gray
```

## Debug Script Patterns

### Essential Debugging Components

Every debug script should include:

1. **Clear console output** with section headers
2. **Pixel analysis** of key test points
3. **PNG file output** for visual verification (preserves transparency)
4. **Expected vs actual** result documentation
5. **Coordinate verification** for geometric operations

### Common Analysis Functions

```javascript
// Pixel color description
function describeColor(r, g, b, a) {
    if (r === 255 && g === 255 && b === 255 && a === 255) return 'WHITE';
    if (r === 0 && g === 0 && b === 255 && a === 255) return 'BLUE';
    if (r === 255 && g === 0 && b === 0 && a === 255) return 'RED';
    if (a === 0) return 'TRANSPARENT';
    return `RGB(${r},${g},${b},${a})`;
}

// Distance calculation for circular shapes
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
}

// Overlap detection for rectangles
function rectOverlap(rect1, rect2) {
    return !(rect1.right < rect2.left || rect2.right < rect1.left ||
             rect1.bottom < rect2.top || rect2.bottom < rect1.top);
}
```

## Development Tips

### When to Create Debug Scripts

- **New feature implementation** - Validate behavior matches specification
- **Bug investigation** - Isolate minimal reproduction case
- **HTML5 Canvas compatibility** - Compare behavior pixel-by-pixel
- **Performance analysis** - Measure rendering time for operations
- **Visual regression** - Compare before/after PNG outputs

### Script Naming Convention

- `debug-feature-issue.js` - Specific feature investigation
- `debug-comparison-feature.js` - SWCanvas vs HTML5 Canvas comparison
- `debug-minimal-case.js` - Minimal reproduction case
- `debug-analysis-feature.js` - Detailed analysis with multiple test points

### PNG File Management

PNG files are gitignored by default to avoid repository bloat. For debugging sessions:

- **Keep outputs for comparison** - Save timestamped copies (e.g., `debug-xor-before.png`, `debug-xor-after.png`) locally
- **Force-track if needed** - Use `git add --force debug/specific-file.png` to temporarily track specific files
- **Clear naming** - Include feature and test case in filename
- **Visual inspection** - Open PNGs in image viewer for verification
- **Pixel-level analysis** - Use image editor for precise pixel inspection
- **Transparency support** - PNG format preserves alpha channel for accurate analysis

## Integration with Main Test Suite

Debug utilities complement the main test suite:

- **Main tests**: Comprehensive automated validation
- **Debug utilities**: Focused investigation of specific issues
- **Visual tests**: Cross-platform validation
- **Debug scripts**: Developer workflow for rapid iteration

Use debug utilities during development, then create proper tests in `/tests/visual/` or `/tests/core/` for permanent validation.

## Contributing Debug Utilities

When adding new debug utilities:

1. **Follow naming convention**: `debug-feature-description.js`
2. **Include comprehensive comments** explaining what's being tested
3. **Generate PNG output** for visual verification (use PngEncoder)
4. **Document expected vs actual results** in the script
5. **Add usage instructions** in comments at top of file

This ensures debug utilities remain valuable for future development and debugging efforts.
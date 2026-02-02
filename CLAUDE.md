# Claude Code Context - SWCanvas.js

This file provides Claude with essential context about the SWCanvas.js project for efficient collaboration and development.

## Project Overview

**SWCanvas** is a deterministic 2D raster engine with dual API architecture that produces identical results across all platforms. It provides both HTML5 Canvas-compatible API and a high-performance Core API.

### Key Characteristics
- **Deterministic**: Same input → same output on any platform
- **Cross-platform**: Works identically in Node.js and browsers  
- **Dual API**: HTML5-compatible API for portability + Core API for performance
- **Drop-in replacement**: True HTML5 Canvas 2D Context compatibility
- **Memory efficient**: 1-bit stencil clipping, optimized algorithms
- **Sub-pixel accurate**: Thin strokes render with proportional opacity (no anti-aliasing)
- **Well-tested**: 37 core tests + 144 visual tests + 79 direct rendering tests with pixel-level validation
- **Paint Sources**: Full HTML5-compatible gradients (linear, radial, conic) and patterns

## API Usage

SWCanvas provides dual APIs - see README.md for complete API documentation and examples.

- **HTML5 Canvas-Compatible API**: `SWCanvas.createCanvas()` for familiarity
- **Core API**: `SWCanvas.Core.*` for performance
- **Interoperability**: Both APIs work together seamlessly

Refer to README.md for detailed usage examples and ARCHITECTURE.md for design rationale.

## Architecture Overview

SWCanvas uses object-oriented ES6 class design organized into 7 semantic directories: `core/`, `renderers/`, `utils/`, `paint/`, `filters/`, `io/`, `compat/`. See ARCHITECTURE.md for complete component details and design rationale.

### Quick Reference
- **Entry points**: `Context2D.js` (Core API), `CanvasCompatibleContext2D.js` (HTML5 API)
- **Rendering pipeline**: Context2D → Rasterizer → Shape *Ops classes → Surface
- **Key patterns**: Immutable value objects, static utility classes, composition over inheritance
- **Direct rendering**: See DIRECT-RENDERING-SUMMARY.MD for optimized shape renderers
- **Performance benchmarking**: Uses different strategies for SWCanvas (direct timing) vs HTML5 Canvas (VSync cliff detection). See tests/direct-rendering/PERFORMANCE-BENCHMARKING.md
- **Performance testing workflow**: See tests/direct-rendering/PERFORMANCE-TESTING-WORKFLOW.md for workflow guide on benchmarking code changes

## Build & Test

See README.md for complete build commands and test instructions.

**Quick reference**: `npm run build` → `npm test` for development cycle.

**Validation commands**:
- `npm run check:test-metadata` - Validate test metadata, signatures, filename parsing
- `npm run check:register-consistency` - Quick filename/registration check
- `npm run test:direct-rendering:perf` - Performance benchmarking for direct rendering (Node.js)
- `node tests/direct-rendering/verify-logs-and-bounds-snapshot.js` - Verify test positioning hasn't regressed

## Common Tasks

### Adding New Tests

See `tests/README.md` for comprehensive test development documentation.

### Using the Dual API

See README.md for complete API usage examples.

### Debugging Rendering Issues
1. Add debug visual test with simplified case
2. Generate PNG: `npm test`  
3. Compare with HTML5 Canvas in browser: `tests/browser/index.html`
4. Check pixel values manually if needed
5. Use git to compare before/after PNGs

See `debug/README.md` for comprehensive debugging utilities, templates, and workflow patterns.

### Making API Changes (OO Structure)
1. Update `src/core/Context2D.js` for public API changes
2. Update `src/core/Rasterizer.js` for rendering pipeline changes
3. Update relevant classes in `src/renderers/` (PolygonFiller.js, StrokeGenerator.js, etc.) as needed
4. Ensure both SWCanvas and HTML5Canvas paths in tests do the same thing
5. Run full test suite to verify no regressions

#### Special Implementation Notes

**clearRect Implementation**: `clearRect` uses direct pixel manipulation (`Context2D._clearRectDirect`) rather than the standard composite operation pipeline. This avoids global compositing issues that would affect the entire canvas. The implementation handles both axis-aligned and transformed rectangles correctly while respecting clipping masks.

## Architecture

Uses object-oriented ES6 class design throughout. See ARCHITECTURE.md for complete architectural details and design patterns.

## Important Notes for Claude

### Documentation Strategy
- **Avoid duplication**: Each document has specific responsibilities (see DOCS.md)
- **Use cross-references**: Reference other docs rather than duplicating content
- **Single source of truth**: API examples in README.md, architecture in ARCHITECTURE.md, tests in tests/README.md

### When Debugging Tests
- **Always run full test suite** after changes: `npm test`
- **Browser vs Node.js differences** - use same visual test registry for consistency
- **Color consistency** - use standard Canvas API (`ctx.fillStyle`, `ctx.strokeStyle`)
- **Coordinate expectations** - test pixel positions are carefully calculated
- **ImageData API available** - use `ctx.getImageData()` for pixel analysis (works on both APIs)
- **Image creation helpers** - use `createCompatibleImage()` for unified image handling in tests
- **Separate test architectures** - Visual tests (`/cases/`) verify rendering correctness; parametric performance tests (`/perf-cases/`) benchmark throughput. Test utilities are modularized into 10 focused modules. See tests/direct-rendering/README.md.
- **Snapshot verification** - Use `node tests/direct-rendering/verify-logs-and-bounds-snapshot.js` to verify refactoring didn't change test bounds/positioning calculations

### When Making Changes
- **Update both paths** - SWCanvas and HTML5Canvas implementations in visual tests
- **Verify cross-platform** - test in both Node.js and browser
- **Check all phases** - changes may affect multiple test categories
- **Build before testing** - `npm run build` then `npm test`
- **Test with different backgrounds** - Use `BitmapEncodingOptions` to test transparency handling

### Inline Markers for Hot Pixel Loops

The preprocessor supports **chained template expansion** - templates can reference other templates via nested markers. The preprocessor performs multi-pass expansion until all markers are resolved, with depth protection (default max 10 passes) to prevent infinite loops.

**Template Hierarchy** (chained expansion):
```
Level 0 (Base):     SET_OPAQUE, BLEND_ALPHA
Level 1 (Clipped):  *_CLIPPED → references Level 0
Level 2 (Arc):      *_ARC_FAST_CLIPPED → references Level 1
```

**Standard Templates** (caller must check clipping BEFORE):
- `/*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, alpha, invAlpha)*/` - for span-based alpha blending
- `/*@inline:SET_OPAQUE(data32, pixelIndex, packedColor)*/` - for span-based opaque writes

**Clipped Templates** (include clipping check, for per-pixel loops):
- `/*@inline:BLEND_ALPHA_CLIPPED(...)*/` - chains to BLEND_ALPHA
- `/*@inline:SET_OPAQUE_CLIPPED(...)*/` - chains to SET_OPAQUE

**Arc Templates** (include angle + bounds + clipping, for arc per-pixel loops):
- `/*@inline:SET_OPAQUE_ARC_FAST_CLIPPED(data32, packedColor, clipBuffer, dx, dy, startCos, startSin, endCos, endSin, isLargeArc, px, py, width, height)*/` - chains to SET_OPAQUE_CLIPPED
- `/*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, alpha, invAlpha, clipBuffer, dx, dy, startCos, startSin, endCos, endSin, isLargeArc, px, py, width, height)*/` - chains to BLEND_ALPHA_CLIPPED

Arc templates use fast cross-product angle checks (10-50x faster than atan2) and include bounds checking. They are used in `ArcOps.stroke1px_Opaq()` and `ArcOps.stroke1px_Alpha()` for per-pixel Bresenham rendering. Scanline-based arc methods use module-level event buffer (`_arcEventBuffer`) and insertion sort for additional performance.

**Clipping contract**:
- Standard templates: Caller checks `clipBuffer` BEFORE the marker (for span-based code via SpanOps)
- Clipped templates: Include clipping check internally (for per-pixel loops where hoisting is not possible)
- Arc templates: Include both angle range check and clipping check (for arc-specific per-pixel loops)
- Templates are defined in `build-scripts/preprocess.js`
- Run `npm run build` to expand markers - check `dist/swcanvas.js` to verify expansion
- Run `node tests/build/test-preprocessor.js` to test the preprocessor (45 tests)

**SpanOps bounds contract**:
- SpanOps TRUSTS that callers provide valid coordinates (y in bounds, startX >= 0, startX + length <= width, length > 0)
- Callers MUST clamp bounds BEFORE calling SpanOps methods
- This enables early-exit optimizations when spans are entirely off-screen
- Debug assertions verify bounds in development builds (`globalThis.__SWCANVAS_DEBUG__ = true`)
- See ARCHITECTURE.md "SpanOps Bounds Contract" section for detailed clamping patterns

### OO Development Patterns
- **Use proper classes**: Prefer `new SWCanvas.Core.Point(x, y)` over plain objects
- **Leverage immutability**: Transform2D, Point, Rectangle, Color, BitmapEncodingOptions are immutable - use their methods
- **Joshua Bloch patterns**: BitmapEncodingOptions demonstrates static factory methods and immutable configuration objects
- **Composition over inheritance**: BitBuffer and BoundsTracker utilities composed by ClipMask, SourceMask, and ShadowBuffer classes (Item 18)
- **Static utilities**: Use ImageProcessor for format conversion, CompositeOperations for blending
- **Factory methods**: Use Transform2D constructor and .translation(), .scaling(), .rotation() for common transformations
- **Validation**: All classes validate input parameters with descriptive error messages
- **Composition**: Classes work together rather than through inheritance hierarchies
- **Encapsulation**: Use public APIs, private methods marked with underscore prefix
- **Utility classes**: BitBuffer provides reusable bit manipulation, BoundsTracker provides reusable bounds tracking

### Key Architecture Principles
- **Single Responsibility**: Each class handles one specific concern
- **Immutability**: Value objects prevent accidental state mutations
- **Static Methods**: Used for pure functions and utilities without state
- **Defensive Programming**: Comprehensive parameter validation at class boundaries
- **Clean APIs**: Clear public interfaces with proper documentation
- **Memory Efficiency**: Optimized data structures (1-bit stencil buffers, efficient pixel operations)

### File Organization
- **One Class Per File**: Each class in its own appropriately named file
- **Clear Dependencies**: Build script maintains proper dependency order
- **Semantic Subdirectories**: Source organized into 7 categories:
  - `src/core/` - Core engine primitives (Context2D, Surface, Transform2D, etc.)
  - `src/renderers/` - Shape-specific direct renderers (*Ops classes)
  - `src/utils/` - Shared utilities (BitBuffer, BoundsTracker, Point, Rectangle)
  - `src/paint/` - Paint sources (Gradient, Pattern, ColorParser)
  - `src/filters/` - Effects (BoxBlur, ShadowBuffer)
  - `src/io/` - File encoders (PngEncoder, BitmapEncoder)
  - `src/compat/` - HTML5 Canvas compatibility layer

This context reflects the current object-oriented architecture and development patterns for effective collaboration.
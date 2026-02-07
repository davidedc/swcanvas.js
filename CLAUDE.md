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
- **Performance benchmarking**: Uses statistical filtering (super-measurements with sub-run CV checking, IQR outlier removal) achieving 0.7-0.9% CV. See tests/direct-rendering/PERFORMANCE-BENCHMARKING.md
- **Performance testing workflow**: See tests/direct-rendering/PERFORMANCE-TESTING-WORKFLOW.md for workflow guide on benchmarking code changes

## Build & Test

See README.md for complete build commands and test instructions.

**Quick reference**: `npm run build` → `npm test` for development cycle.

**Validation commands**:
- `npm run check:test-metadata` - Validate test metadata, signatures, filename parsing
- `npm run check:register-consistency` - Quick filename/registration check
- `npm run test:direct-rendering:perf` - Quick performance tests for direct rendering (Node.js)
- `node tests/direct-rendering/scripts/benchmark-session.js` - Production benchmarking with statistical filtering
- `node tests/direct-rendering/verify-logs-and-bounds-snapshot.js` - Verify test positioning hasn't regressed

**Code quality commands** (on-demand, no hooks):
- `npm run lint` - Check source files for issues (catches unused vars, unreachable code, etc.)
- `npm run lint:fix` - Auto-fix fixable ESLint issues
- `npm run format` - Format all source files with Prettier
- `npm run format:check` - Check which files need formatting

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
- **Optional quality check** - Run `npm run lint` to catch subtle bugs (unused vars, unreachable code, invalid typeof)

### Inline Markers for Hot Pixel Loops

Source files use `/*@inline:TEMPLATE_NAME(...)*/` markers expanded at build time for zero-overhead pixel operations. See build-scripts/README.md for template reference and ARCHITECTURE.md "Build-Time Preprocessing" for design rationale.

Key points for development:
- Templates defined in `build-scripts/preprocess.js`
- Run `npm run build` to expand markers — check `dist/swcanvas.js` to verify
- Run `node tests/build/test-preprocessor.js` to test the preprocessor (45 tests)

### OO Development Patterns
- **Use proper classes**: Prefer `new SWCanvas.Core.Point(x, y)` over plain objects
- **Leverage immutability**: Transform2D, Point, Rectangle, Color, BitmapEncodingOptions are immutable
- See ARCHITECTURE.md for complete design patterns and principles
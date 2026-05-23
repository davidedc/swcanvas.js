# SWCanvas.js Examples

This directory contains examples demonstrating SWCanvas features and capabilities.

## Available Examples

### `showcase.html`
A comprehensive feature showcase demonstrating:
- Basic shapes (rectangles, circles, polygons)
- Gradients (linear, radial, conic) and patterns
- Transformations (translation, rotation, scaling)
- Clipping and masking
- Various stroke styles and line dashing
- Alpha blending and transparency
- Complex paths with curves and arcs
- Sub-pixel rendering

**Usage:**
1. Build the project (see README.md for build commands)
2. Open `showcase.html` in a web browser

The example automatically uses the minified version (`swcanvas.min.js`) if available, falling back to the regular build (`swcanvas.js`).

**Features:**
- Interactive redraw button
- Animation demo
- PNG download functionality with transparency support
- Performance timing display
- Comprehensive feature descriptions

### `text-lru-atlas-demo.html`
Live text-rendering benchmark driving the vendored BitmapText.js engine through SWCanvas's HTML5-compatible API. Mirrors the upstream BitmapText.js demo so the two stay visually comparable side-by-side.

**Demonstrates:**
- `ctx.fillText` / `measureText` against per-size bitmap atlases
- HiDPI rendering via `ctx.textPixelDensity` (density toggle in the UI)
- Atlas LRU eviction under load (size-range pill + character-set pill)
- Color modes (Black / Random / Mixed) and the alpha-on-transparent path
- Live FPS histogram, draw µs/text, repaint-budget slider

**Prerequisites:** Run `./scripts/download-bitmaptext-assets.sh` once to populate `font-assets/`. Without the assets the page loads but renders no glyph pixels (by design). Asset-download mechanics and the two-pin layout (`vendor/bitmaptext.pin` for the engine, `vendor/bitmaptext-release.pin` for the font release) are documented in [`vendor/bitmaptext.UPDATE.md`](../vendor/bitmaptext.UPDATE.md).

## Creating New Examples

When adding new examples:
1. Use the HTML5 Canvas-compatible API for maximum compatibility
2. Include fallback for both minified and regular builds
3. Add descriptive comments and documentation
4. Test in multiple browsers
5. Consider both visual appeal and educational value

## Requirements

- Modern web browser with Canvas support
- Built SWCanvas library (see README.md for build instructions)
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

### `3d-cubes.html`
Software-rendered 3D demo built on the Core-API 3D primitives (`SWCanvas.Core.DepthBuffer`, `SWCanvas.Core.Triangle3DOps`, `SWCanvas.Core.Texture3D`). A flat-shaded cube and a texture-mapped cube rotate *through* each other — the per-pixel depth test renders the interpenetration exactly, with no polygon sorting.

**Demonstrates:**
- Depth-tested triangle rasterization (`Triangle3DOps.fillTriangleZ`)
- Perspective-correct, per-face-lit texture mapping (`Triangle3DOps.fillTriangleTexturedPersp` with a procedural power-of-two `Texture3D`; nearest-neighbor, wrap-around addressing; the faster affine `fillTriangleTextured` also exists)
- A minimal 3D pipeline in userland (`3d-cubes-scene.js`: camera transform, backface culling, flat Lambert shading, perspective projection)
- Optional `ClipMask` integration (circular-viewport toggle in the HUD)
- Full-window rendering with a per-frame software-render timing display

**Usage:** serve the repo over HTTP (e.g. `python3 -m http.server`) and open `examples/3d-cubes.html`.

### `3d-cubes-node.js`
Node version of the same scene: renders one frame to a PNG and reports rough per-frame rasterization timing.

**Usage:** `node examples/3d-cubes-node.js [output.png] [width] [height]`

### `3d-cubes-html5-compose.html`
The 3D engine running **through a native HTML5 canvas pipeline** — no SWCanvas `Surface` anywhere on the page. `Triangle3DOps` writes into a native `ImageData`'s buffer via a duck-typed `{width, height, data32}` target, the frame is presented to a hidden buffer canvas with `putImageData`, and `drawImage` composites it onto the display canvas under **native clipping**.

**Demonstrates:**
- The zero-copy "facade shim": software 3D rasterization directly into native `ImageData` memory
- Why the present step is `putImageData` → buffer canvas → `drawImage` (per spec, `putImageData` ignores `clip()`/transform/compositing; `drawImage` honors them)
- Transparent 3D background (alpha 0) compositing over natively drawn content
- One 3D buffer reused by two native clipped viewports: a rounded-rect widget (1:1, with native shadow/border) and a scaled circular "mirror"
- Native vector/text overlays (crosshair, HUD) drawn on top of the 3D pixels
- Split timing HUD: software raster ms vs present + native compose ms

**Usage:** serve the repo over HTTP (e.g. `python3 -m http.server`) and open `examples/3d-cubes-html5-compose.html`. Uses `ctx.roundRect`, so it needs a current browser (Chrome 99+/Safari 16+/Firefox 112+).

### `3d-fox.html` / `3d-fox-node.js` (SW3D engine)
The **engine-layer** demo: `sw3d.js` is a minimal userland 3D engine over the Core primitives (camera, meshes, backface culling, near-plane clipping with UV interpolation, per-face Lambert, bounding-sphere rejects), and the scene is a port of the rotating-fox demo from Electric Gryphon's PICO-8 3D library (`gryphon-models.js` decodes the original hex-encoded models — fox, pyramid, column).

**Demonstrates:**
- A complete software 3D pipeline in ~400 lines of userland code — SWCanvas only supplies depth-tested triangles
- Near-plane clipping under an orbiting camera that flies through geometry (validated with `__SWCANVAS_DEBUG__` assertions armed)
- A perspective-correct, mip-mapped textured ground plane with wrap-around tiling (`Texture3D.buildMips()` — no shimmer at the horizon)
- 338-triangle mesh with dynamic per-face lighting

**Usage:** open `examples/3d-fox.html` (served over HTTP), or `node examples/3d-fox-node.js [output.png] [width] [height] [timeSeconds]`.

The HUD exposes a **render resolution** control (100/75/50% with `drawImage` upscale, or an auto mode that steps the scale to hold a 12 ms frame budget) and reports render vs present timings separately. Presentation uses `putImageData` — measured at ~0.2 ms for a ~2 Mpx window on Chrome and Safari; a `createImageBitmap` + `drawImage` alternative was benchmarked at ~10× slower (eager snapshot/convert + per-frame allocation) and removed.

3D primitive throughput is benchmarked by `tests/direct-rendering/perf-cases/triangle3d-perf.js` (4 span code paths × 3 triangle sizes) through the standard IQR-filtered harness:
`node tests/direct-rendering/scripts/benchmark-session.js --output out.json --filters '{"test":"triangle3d"}' --shapes 1000`
Baselines live in `perf-baselines/triangle3d-baseline-*.json` (the `-20260707b` set is current). Cross-session drift on the sub-3 ms tests is ±4-5%, so compare before/after within one session.

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
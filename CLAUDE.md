# SWCanvas — Claude context

Deterministic 2D raster engine with a dual API: HTML5-compatible (`SWCanvas.createCanvas()`) on top of a lower-level Core API (`SWCanvas.Core.*`). Same input → identical pixel output in Node.js and browsers.

## Commands

```bash
npm run build                                # REQUIRED before every test run (expands @inline markers)
npm test                                     # 84 core + 154 visual tests
npm run test:direct-rendering                # 79 direct-renderer correctness tests
npm run test:direct-rendering:perf           # Quick perf sanity check — NOT a measurement
npm run lint           # / lint:fix          # ESLint on src/
npm run format         # / format:check      # Prettier on src/
npm run check:test-metadata                  # Validate test metadata, signatures, filenames
npm run check:register-consistency           # Quick filename ↔ registration check
npm run update-test-counts                   # Re-sync test counts across docs after adding/removing tests
npm run text:check-pin                       # Drift check: vendor/bitmaptext-release.pin vs GitHub releases/latest

node tests/direct-rendering/scripts/benchmark-session.js              # Production perf measurement (IQR-filtered, ~0.8% CV)
node tests/direct-rendering/verify-logs-and-bounds-snapshot.js        # Verify test positioning hasn't regressed
```

## Architecture entry points

- Core pipeline:  `src/core/Context2D.js` → `src/core/Rasterizer.js` → `src/renderers/*Ops.js` → `src/core/Surface.js`
- HTML5 facade:   `src/compat/CanvasCompatibleContext2D.js` (thin layer over Core)
- Text engine:    vendored BitmapText.js under `vendor/bitmaptext/`; wiring in `src/text/{BootstrapText,CssFontParser,FillStyleToTextColor,TextRenderer,FontsNamespace}.js`. Slow path renders to an intermediate `SWCanvasElement` then `drawImage`s with the user transform.
- Source layout:  `src/{core,renderers,utils,paint,filters,io,compat,text}` + `vendor/bitmaptext/`
- Hot pixel loops: `src/renderers/*Ops.js`; preprocessor templates in `build-scripts/preprocess.js`

## Critical invariants (not inferable from code — read these before editing)

- **`npm run build` before every test run.** `build.sh` expands `/*@inline:TEMPLATE(...)*/` markers in hot loops into open-coded blend code. Skipping it leaves `dist/swcanvas.js` stale and tests run against old behaviour. See `build-scripts/README.md`.
- **Dual-API parity.** Public-API changes must update **both** `src/core/Context2D.js` and `src/compat/CanvasCompatibleContext2D.js`. Visual tests run both paths against the same expected output — keep them in sync.
- **Node ↔ browser parity.** The same visual test registry runs in both. Never make a test change that only works in one environment.
- **`clearRect` deliberately bypasses the composite pipeline** (`Context2D._clearRectDirect`) to avoid global compositing affecting the whole canvas. Do not "fix" it back to the standard pipeline.
- **Benchmark method matters.** Real perf claims come from `benchmark-session.js` only (super-measurements, sub-run CV check, IQR outlier removal). `test:direct-rendering:perf` is a sanity check — never quote its numbers as results.
- **Immutable value objects:** `Transform2D`, `Point`, `Rectangle`, `Color`, `BitmapEncodingOptions`. Clone, don't mutate.
- **In tests, use standard Canvas API** (`ctx.fillStyle = '...'`, `ctx.getImageData()`). Don't reach into internal classes from test bodies — visual tests must remain runnable against real HTML5 Canvas.
- **Visual tests (`tests/visual/cases/`) vs perf cases (`tests/direct-rendering/perf-cases/`) are separate architectures** — correctness vs throughput. Don't conflate them.
- **Text rendering needs assets.** `dist/swcanvas.js` ships the BitmapText engine but no font data. Run `scripts/download-bitmaptext-assets.sh` once to populate `font-assets/` (browser-side WebP); the Node test fixture under `font-assets/_smoke/` (QOI) is committed and regenerated from the WebP release by `scripts/build-smoke-fixture.js` (`npm run text:build-smoke-fixture`). Without assets, `ctx.fillText(...)` runs without crashing but emits no pixels — by design.
- **Two BitmapText pin files, different cadences.** `vendor/bitmaptext.pin` (SHA) pins the engine source; `vendor/bitmaptext-release.pin` (tag) pins the font-assets release that both downloaders read at runtime. The asset-release pin can drift independently when a new font release is published upstream — `npm run text:check-pin` compares it against GitHub `releases/latest` (exit 1 on drift). See `vendor/bitmaptext.UPDATE.md` for both bump procedures.
- **`vendor/bitmaptext/` is gitignored and regenerated on demand** from the SHA in `vendor/bitmaptext.pin`. `build.sh` auto-fetches on first build via `scripts/vendor-bitmaptext.sh`. Bump by editing the pin and re-running the script (or with `--source <path>` for local-sibling dev, which also rewrites the pin). Don't patch in place — the next vendor run wipes any local edits. See `vendor/bitmaptext.UPDATE.md`. The integration relies on upstream features `BitmapText.setFontLoader`, `setAtlasFormat`, and platform-file self-registration; do not vendor a pre-Sprint-4 BitmapText.

## Canonical workflows

**Changing rendering behaviour:**
1. Edit the relevant `src/renderers/*Ops.js` or `src/core/Rasterizer.js`.
2. If the change is observable through public API: update **both** `Context2D.js` and `CanvasCompatibleContext2D.js`.
3. `npm run build && npm test`.
4. If pixel output may have shifted: also `npm run test:direct-rendering`.

**Debugging a rendering diff:**
1. Add a minimal reproducer under `debug/` (templates in `debug/README.md`).
2. Compare PNG output against real HTML5 Canvas at `tests/browser/index.html`.
3. Use `ctx.getImageData()` for pixel-level inspection (both APIs support it).
4. `git diff` the generated PNGs to localise the change.

**Adding tests:** see `tests/README.md` (visual + core) or `tests/direct-rendering/README.md` (direct renderer). Filename rules in `test_naming_convention.md`.

**Investigating perf:** see `tests/direct-rendering/PERFORMANCE-TESTING-WORKFLOW.md` for the regression / improvement / discovery workflows; mechanics in `PERFORMANCE-BENCHMARKING.md`.

## Where to read more

| Topic                                | File                                                     |
|--------------------------------------|----------------------------------------------------------|
| API usage & examples                 | `README.md`                                              |
| Design rationale, class structure    | `ARCHITECTURE.md`                                        |
| Direct renderer subsystem            | `DIRECT-RENDERING-SUMMARY.MD`                            |
| Visual & core tests                  | `tests/README.md`                                        |
| Direct-rendering tests               | `tests/direct-rendering/README.md`                       |
| Perf benchmark mechanics             | `tests/direct-rendering/PERFORMANCE-BENCHMARKING.md`     |
| Perf testing workflow                | `tests/direct-rendering/PERFORMANCE-TESTING-WORKFLOW.md` |
| Inline markers / preprocessor        | `build-scripts/README.md`                                |
| Debug utilities                      | `debug/README.md`                                        |
| Test naming convention               | `test_naming_convention.md`                              |
| Doc index & anti-duplication policy  | `DOCS.md`                                                |
| Vendored BitmapText (text engine)    | `vendor/bitmaptext.UPDATE.md`                            |

Do not duplicate content from these files into this one. If a topic above feels under-specified, open the linked doc rather than expanding here.

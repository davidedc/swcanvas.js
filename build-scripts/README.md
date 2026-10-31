# SWCanvas Build Scripts

Build utilities for SWCanvas development.

## Scripts

| Script | Purpose |
|--------|---------|
| `preprocess.js` | Expand inline markers in hot pixel loops |
| `generate-build-info.js` | Generate build metadata |
| `check-test-metadata.js` | Validate test metadata and signatures |

## Inline Markers System

The preprocessor expands inline markers at build time for performance-critical pixel operations.

### Template Hierarchy (Chained Expansion)

Templates can reference other templates. The preprocessor performs multi-pass expansion (max 10 passes):

```
Level 0 (Base):     SET_OPAQUE, BLEND_ALPHA
Level 1 (Clipped):  *_CLIPPED → references Level 0
Level 2 (Arc):      *_ARC_FAST_CLIPPED → references Level 1
Image sampling:     FILTER_BILINEAR (no chaining)
```

Templates live in `templates/` (`base.js`, `clipped.js`, `arc.js`, `sampling.js`), registered by
`templates/index.js`.

### Available Templates

**Standard Templates** (caller must check clipping BEFORE):
- `/*@inline:SET_OPAQUE(data32, pixelIndex, packedColor)*/`
- `/*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, alpha, invAlpha)*/`

**Clipped Templates** (include clipping check, for per-pixel loops):
- `/*@inline:SET_OPAQUE_CLIPPED(...)*/` - chains to SET_OPAQUE
- `/*@inline:BLEND_ALPHA_CLIPPED(...)*/` - chains to BLEND_ALPHA

**Arc Templates** (include angle + bounds + clipping):
- `/*@inline:SET_OPAQUE_ARC_FAST_CLIPPED(data32, packedColor, clipBuffer, dx, dy, startCos, startSin, endCos, endSin, isLargeArc, px, py, width, height)*/`
- `/*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, alpha, invAlpha, clipBuffer, dx, dy, startCos, startSin, endCos, endSin, isLargeArc, px, py, width, height)*/`

Arc templates use fast cross-product angle checks (10-50x faster than atan2).

**Image-Sampling Templates** (read texels, write no pixel):
- `/*@inline:FILTER_BILINEAR(data, width, tx0, tx1, ty0, ty1, wx0, wx1, wy0, wy1, outR, outG, outB, outA, onTransparent)*/`
  - the premultiplied bilinear filter of every resampling image draw (`drawImage`, pattern paint). The caller
    resolves its edge rule into the tap columns/rows and weights, names the four assignable outputs, and gives
    the statement to run when every weighted tap is transparent (`continue` in a pixel loop, `return false` in
    a sampler).

### Clipping Contract

| Template Type | Clipping Responsibility |
|---------------|------------------------|
| Standard | Caller checks clipBuffer BEFORE marker (span-based code via SpanOps) |
| Clipped | Template includes check (per-pixel loops where hoisting not possible) |
| Arc | Template includes angle range + clipping (arc-specific per-pixel loops) |

### Which files are expanded

`build.sh` expands the files listed in its `PREPROCESSED_FILES` and concatenates them through `get_src`. A
marker anywhere else would stay a comment, so the build fails when `dist/swcanvas.js` still contains one. ESLint
cannot see that a marker reads a variable: `.eslintrc.js` exempts the marker variables of `src/renderers/` and of
the two `FILTER_BILINEAR` callers from `no-unused-vars`.

### Usage

```bash
npm run build                              # Expand markers during build
node tests/build/test-preprocessor.js      # Test preprocessor
```

Verify expansion in `dist/swcanvas.js`.

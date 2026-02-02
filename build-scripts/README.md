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
```

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

### Clipping Contract

| Template Type | Clipping Responsibility |
|---------------|------------------------|
| Standard | Caller checks clipBuffer BEFORE marker (span-based code via SpanOps) |
| Clipped | Template includes check (per-pixel loops where hoisting not possible) |
| Arc | Template includes angle range + clipping (arc-specific per-pixel loops) |

### Usage

```bash
npm run build                              # Expand markers during build
node tests/build/test-preprocessor.js      # Test preprocessor (45 tests)
```

Verify expansion in `dist/swcanvas.js`.

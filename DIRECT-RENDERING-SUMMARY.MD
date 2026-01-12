# SWCanvas.js Direct Renderings - Comprehensive Analysis & Summary

## Executive Summary

SWCanvas implements direct renderings for 5 shape types: Rectangle, RoundedRect, Circle, Line, and Arc. Each has specialized rendering paths that bypass the general polygon filler when specific conditions are met.

---

## 1. Direct Rendering Entry Points (Calling Functions)

| Shape                   | Entry Point                           | Path-Based Fallback         |
|-------------------------|---------------------------------------|-----------------------------|
| Rectangle Fill          | Context2D.fillRect()                  | rasterizer.fillRect()       |
| Rectangle Stroke        | Context2D.strokeRect()                | rasterizer.stroke(path)     |
| Rectangle Fill+Stroke   | Context2D.fillStrokeRect()         | Separate fill + stroke      |
| RoundedRect Fill        | Context2D.fillRoundRect()             | path.roundRect() + fill()   |
| RoundedRect Stroke      | Context2D.strokeRoundRect()           | path.roundRect() + stroke() |
| RoundedRect Fill+Stroke | Context2D.fillStrokeRoundRect()    | Separate fill + stroke      |
| Circle Fill             | Context2D.fillCircle()                | path.arc() + fill()         |
| Circle Stroke           | Context2D.strokeCircle()              | path.arc() + stroke()       |
| Circle Fill+Stroke      | Context2D.fillStrokeCircle()       | Separate fill + stroke      |
| Line Stroke             | Context2D.strokeLine()                | path moveTo/lineTo + stroke |
| Arc Fill                | Context2D.fillArc()                   | path.arc() + fill()         |
| Arc Stroke              | Context2D.outerStrokeArc()            | path.arc() + stroke()       |
| Arc Fill+Stroke         | Context2D.fillOuterStrokeArc()     | Separate fill + stroke      |

All entry points are in `Context2D.js`. Use grep to find exact locations: `grep -n "methodName(" src/core/Context2D.js`

**Notes:**
- Direct rendering is available **exclusively** via dedicated methods (e.g., `fillCircle()`, `strokeRect()`). Path-based rendering (`beginPath()` + `arc()/rect()` + `fill()/stroke()`) always uses the generic polygon pipeline for consistent, predictable behavior.
- Private methods (`_fillCircleDirect`, `_strokeCircleDirect`, `_strokeLineDirect`) are internal helpers called by the public convenience methods.

---

## 2. Direct Rendering Functions by Shape and Case

### 2.1 RECTANGLES (RectOpsAA.js + RectOpsRot.js)

| Stroke Width | Orientation             | Opacity          | Function                        | Clipping TO |
|--------------|-------------------------|------------------|---------------------------------|-------------|
| N/A (fill)   | Axis-aligned            | Opaque           | RectOpsAA.fill_AA_Opaq()          | YES      |
| N/A (fill)   | Axis-aligned            | Semi-transparent | RectOpsAA.fill_AA_Alpha()         | YES      |
| N/A (fill)   | Rotated (uniform scale) | Both             | RectOpsRot.fill_Rot_Any()      | YES      |
| 1px          | Axis-aligned            | Opaque           | RectOpsAA.stroke1px_AA_Opaq()     | YES      |
| 1px          | Axis-aligned            | Semi-transparent | RectOpsAA.stroke1px_AA_Alpha()    | YES      |
| >1px         | Axis-aligned            | Opaque           | RectOpsAA.strokeThick_AA_Opaq()   | YES      |
| >1px         | Axis-aligned            | Semi-transparent | RectOpsAA.strokeThick_AA_Alpha()  | YES      |
| Any          | Rotated (uniform scale) | Both             | RectOpsRot.stroke_Rot_Any()    | YES      |
| Any          | Axis-aligned            | Both             | RectOpsAA.fillStroke_AA_Any()     | YES      |
| Any          | Rotated (uniform scale) | Both             | RectOpsRot.fillStroke_Rot_Any()| YES      |
| 0px          | Any                     | Any              | IGNORED (per HTML5 spec)        | -        |

Notes:
- Context2D calls RectOpsAA for axis-aligned (AA) operations and RectOpsRot directly for rotated operations.
- `RectOpsAA.fillStroke_AA_Any()` uses single-scan span-based rendering with fill-first ordering for correct semi-transparent stroke blending. Fill extent is conditional: PATH extent for semi-transparent strokes (so stroke blends with fill), INNER extent for opaque strokes (optimization).

### 2.2 ROUNDED RECTANGLES (RoundedRectOpsAA.js + RoundedRectOpsRot.js)

| Stroke Width | Orientation  | Opacity          | Function                               | Clipping TO |
|--------------|--------------|------------------|----------------------------------------|-------------|
| N/A (fill)   | Axis-aligned | Opaque           | RoundedRectOpsAA.fill_AA_Opaq()          | YES      |
| N/A (fill)   | Axis-aligned | Semi-transparent | RoundedRectOpsAA.fill_AA_Alpha()         | YES      |
| N/A (fill)   | Rotated      | Both             | RoundedRectOpsRot.fill_Rot_Any()      | YES      |
| 1px          | Axis-aligned | Opaque           | RoundedRectOpsAA.stroke1px_AA_Opaq()     | YES      |
| 1px          | Axis-aligned | Semi-transparent | RoundedRectOpsAA.stroke1px_AA_Alpha()    | YES      |
| Any          | Rotated      | Both             | RoundedRectOpsRot.stroke_Rot_Any()    | YES      |
| >1px         | Axis-aligned | Opaque           | RoundedRectOpsAA.strokeThick_AA_Opaq()   | YES      |
| >1px         | Axis-aligned | Semi-transparent | RoundedRectOpsAA.strokeThick_AA_Alpha()  | YES      |
| Any          | Axis-aligned | Both             | RoundedRectOpsAA.fillStroke_AA_Any()     | YES      |
| Any          | Rotated      | Both             | RoundedRectOpsRot.fillStroke_Rot_Any()| YES      |
| 0px          | Any          | Any              | IGNORED                                | -        |

Notes:
- Context2D calls RoundedRectOpsAA for axis-aligned (AA) operations and RoundedRectOpsRot directly for rotated operations.
- RoundedRectOpsRot falls back to RectOpsRot (not RectOpsAA) when radius=0 for consistency.
- Axis-aligned rounded rectangle **stroke** (1px alpha) uses Set deduplication to prevent overdraw at edge-arc junctions.
- Rotated rounded rectangle **stroke** (1px opaque) uses hybrid algorithm: 4 edges via inline Bresenham + 4 corner arcs via ArcOps.stroke1px_Opaq_Exact().
- Rotated rounded rectangle **stroke** (1px alpha) uses hybrid algorithm (inline Bresenham edges + arcs) + Set deduplication to prevent overdraw at edge-arc junctions.
- Rotated rounded rectangle **stroke** (thick) uses Dual Edge Buffer algorithm: generates outer and inner perimeters, fills annulus per scanline.
- Rotated rounded rectangle **fill** uses Edge Buffer Rasterization: O(H + P + A) optimal complexity.
- **fillStroke_Rot_Any()** combines fill with epsilon contraction + stroke on top.
- **fillStroke_AA_Any()** fill extent: thick semi-transparent strokes use PATH extent (for proper overlap blending), while 1px and opaque strokes use INNER extent (no meaningful overlap area).

### 2.3 CIRCLES (CircleOps.js)

| Stroke Width | Opacity          | Function                    | Clipping TO |
|--------------|------------------|-----------------------------|-------------|
| N/A (fill)   | Opaque           | CircleOps.fill_Opaq()       | YES      |
| N/A (fill)   | Semi-transparent | CircleOps.fill_Alpha()      | YES      |
| 1px          | Opaque           | CircleOps.stroke1px_Opaq()  | YES      |
| 1px          | Semi-transparent | CircleOps.stroke1px_Alpha() | YES      |
| >1px         | Opaque           | CircleOps.strokeThick_Any() | YES      |
| >1px         | Semi-transparent | CircleOps.strokeThick_Alpha()| YES     |
| Any          | Both             | CircleOps.fillStroke_Any()  | YES      |
| 0px          | Any              | IGNORED                     | -        |

Note: Circles are inherently rotation-invariant (no tilted variant needed)

### 2.4 LINES (LineOps.js)

| Stroke Width | Orientation     | Opacity          | Function                          | Clipping TO |
|--------------|-----------------|------------------|-----------------------------------|-------------|
| ≤1.5px       | Any (Bresenham) | Opaque           | LineOps.stroke_Any() thin path    | YES      |
| ≤1.5px       | Any (Bresenham) | Semi-transparent | LineOps.stroke_Any() thin alpha   | YES      |
| >1.5px       | Horizontal      | Opaque           | LineOps.stroke_Any() → SpanOps    | YES      |
| >1.5px       | Vertical        | Opaque           | LineOps.stroke_Any() → SpanOps    | YES      |
| >1.5px       | Diagonal/Tilted | Opaque           | LineOps._strokeThick_PolyScan()   | YES      |
| >1.5px       | Any             | Semi-transparent | LineOps._strokeThick_PolyScan()   | YES      |
| 0px          | Any             | Any              | IGNORED                           | -        |

Note: Lines already handle all orientations - no separate "rotated" variant needed.
**Requires lineCap === 'butt' for direct rendering (non-butt caps fall to path-based rendering).**

### 2.5 ARCS (ArcOps.js)

| Stroke Width | Opacity          | Function                           | Clipping TO |
|--------------|------------------|------------------------------------|-------------|
| N/A (fill)   | Opaque           | ArcOps.fill_Opaq()                 | YES      |
| N/A (fill)   | Semi-transparent | ArcOps.fill_Alpha()                | YES      |
| 1px          | Opaque           | ArcOps.stroke1px_Opaq()            | YES      |
| 1px          | Opaque (junctions) | ArcOps.stroke1px_Opaq_Exact()    | YES      |
| 1px          | Semi-transparent | ArcOps.stroke1px_Alpha()           | YES      |
| >1px         | Opaque           | ArcOps.strokeOuter_Opaq()          | YES      |
| >1px         | Semi-transparent | ArcOps.strokeOuter_Alpha()         | YES      |
| Any          | Both             | ArcOps.fillStrokeOuter_Any()       | YES      |

Note: Arc uses Bresenham + angle filtering. 1px paths skip Set overhead for opaque.
**stroke1px_Opaq_Exact()** uses angle-based iteration (not Bresenham) guaranteeing pixels at exact start/end angles - used by RoundedRectOpsAA.stroke_Rot_Any() for junction alignment.
**Requires lineCap === 'butt' for direct rendering (non-butt caps fall to path-based rendering).**

---

## 3. Condition Checks for Direct Rendering Eligibility

### Universal Conditions (all shapes):

| Condition    | Check                                      | What Blocks It                            |
|--------------|--------------------------------------------|-------------------------------------------|
| Paint Source | paintSource instanceof Color               | Gradients, Patterns                       |
| Composite Op | globalCompositeOperation === 'source-over' | All other ops (copy, xor, etc.)           |
| Shadows      | No active shadow                           | Any shadowColor, shadowBlur, shadowOffset |
| Paint Alpha  | paintSource.a > 0                          | Fully transparent paint                   |

### Shape-Specific Conditions:

| Shape       | Additional Checks                                                         |
|-------------|---------------------------------------------------------------------------|
| Rectangle   | Transform: isAxisAligned OR isUniformScale                                |
|             | Non-uniform scale + rotation → path-based rendering (produces parallelogram)         |
| RoundedRect | Transform: isIdentity for axis-aligned; rotated uses TRANSFORM_EPSILON (0.0001) |
|             | threshold matching Transform2D.isAxisAligned for consistent detection          |
| Circle      | Transform: noTransform = this._transform.isIdentity                       |
| Line        | lineCap === 'butt' (required for direct rendering)                               |
| Arc         | lineCap === 'butt' (required for direct rendering)                               |
|             | Angle normalization for clockwise/anticlockwise                           |

---

## 4. Interdependencies Between Direct Renderings

```
Context2D ────────────────────────► RectOpsRot.*_Rot_*() for rotated rectangles
                                   ► RoundedRectOpsRot.*_Rot_*() for rotated rounded rects
                                   ► RectOpsAA.*_AA_*() for axis-aligned rectangles
                                   ► RoundedRectOpsAA.*_AA_*() for axis-aligned rounded rects

RectOpsRot.stroke_Rot_Any() ─────► _stroke_Rot_1px_DDA (for 1px strokes)
                            ─────► QuadScanOps.fillQuad (for thick opaque strokes)
                            ─────► _stroke_Rot_Alpha (for thick semi-transparent)

RoundedRectOpsRot.stroke_Rot_Any() ► Inline Bresenham edges + ArcOps.stroke1px_Opaq_Exact()
   (4 edges + 4 corner arcs; inline Bresenham avoids LineOps line-shortening)

RoundedRectOpsRot.fill_Rot_Any() ─► Edge Buffer Rasterization (self-contained)
   (perimeter via Bresenham lines + angle-based arcs → scanline fill)

RoundedRectOpsRot.*_Rot_*() ─────► RectOpsRot.*_Rot_*()
   (fallback when radius=0 - direct call, not via RectOpsAA)

RoundedRectOpsAA.stroke1px_AA_Opaq() ► RectOpsAA.stroke1px_AA_Opaq()
   (fallback when radius=0)

RoundedRectOpsAA.fill_AA_Opaq() ────► RectOpsAA.fill_AA_Opaq()
   (fallback when radius=0)

RoundedRectOpsAA.strokeThick_AA_Opaq() ► RectOpsAA.strokeThick_AA_Opaq()
   (fallback when radius=0)

RoundedRectOpsAA.fillStroke_AA_Any() ► RectOpsAA.* methods
   (fallback when radius=0)

LineOps.stroke_Any() ─────────────► SpanOps.fill_Opaq()
   (thick horizontal/vertical lines)

LineOps._strokeThick_PolyScan() ──► QuadScanOps.lineToQuad + QuadScanOps.fillQuad
   (thick diagonal lines via quad scanline)

CircleOps.fill_Opaq() ────────────► SpanOps.fill_Opaq()
   (each scanline)

CircleOps.fill_Alpha() ───────────► SpanOps.fill_Alpha()
   (each scanline)

RoundedRectOpsAA.fill_AA_Opaq() ────► SpanOps.fill_Opaq()
   (each scanline)

All *Ops.fill*() ─────────────────► SpanOps.fill_Opaq() or SpanOps.fill_Alpha()
   (most shapes)                      (shared horizontal span utility)

RectOpsRot.fill_Rot_Any() ────────► QuadScanOps.fillQuad
   (rotated rectangle fill)

RectOpsRot._stroke_Rot_Alpha() ───► QuadScanOps.lineToQuad + QuadScanOps.fillQuad
   (thick semi-transparent rotated strokes)

QuadScanOps.fillQuad() ───────────► SpanOps.fill_Opaq / SpanOps.fill_Alpha
   (each scanline span)
```

**SpanOps is the shared primitive** - used by RectOpsAA, RectOpsRot, CircleOps, LineOps, RoundedRectOpsAA, RoundedRectOpsRot

**QuadScanOps is the quad primitive** - used by LineOps (thick diagonal) and RectOpsRot (rotated fills/strokes)

---

## 5. Clipping TO Support (Respects Active Clip Mask)

| Shape                   | Clipping TO Support | Method                    |
|-------------------------|---------------------|---------------------------|
| Rectangle (fill/stroke) | YES                 | clipBuffer per pixel      |
| RoundedRect (all)       | YES                 | clipBuffer per pixel      |
| Circle (all)            | YES                 | clipBuffer per pixel      |
| Line (all)              | YES                 | clipBuffer per pixel/span |
| Arc (all)               | YES                 | clipBuffer per pixel      |

All shapes use clipBuffer parameter passed from Context2D to their respective *Ops methods.

---

## 5.1 Clipping AT Support (Using Primitives as Clip Regions)

**Direct rendering does NOT provide methods to define clip regions.** All clipping uses the standard path-based approach per HTML5 Canvas specification:

```javascript
// To clip AT a circle
ctx.beginPath();
ctx.arc(100, 100, 50, 0, Math.PI * 2);
ctx.clip();  // Path-based clipping

// To clip AT a rectangle
ctx.beginPath();
ctx.rect(50, 50, 100, 80);
ctx.clip();

// To clip AT a rounded rectangle
ctx.beginPath();
ctx.roundRect(50, 50, 100, 80, 10);
ctx.clip();
```

| Primitive   | Direct clip*() Method | Path-Based Alternative             |
|-------------|----------------------|-------------------------------------|
| Rectangle   | Not available        | `rect()` + `clip()`                 |
| Circle      | Not available        | `arc(0, 2π)` + `clip()`             |
| Arc         | Not available        | `arc(start, end)` + `clip()`        |
| RoundedRect | Not available        | `roundRect()` + `clip()`            |
| Line        | N/A (not fillable)   | N/A                                 |

**Design rationale**: Direct rendering optimizes fill/stroke operations. Clip region definition is a path operation that works correctly via the existing `clip()` method with any path shape.

### Bit Ordering Convention

All direct renderings use the standard bit ordering convention that matches BitBuffer:
```javascript
const bitIndex = pixelIndex & 7;
const bitMask = (1 << bitIndex);  // CORRECT
```

---

## 6. Optimizations Used per Direct Rendering

### 6.1 32-Bit Packed Pixel Writes

All opaque direct renderings use 32-bit writes for efficiency:
```javascript
const packedColor = Surface.packColor(r, g, b, 255);
data32[pixelIndex] = packedColor;
```

### 6.2 Byte-Skip Optimization for Clipping

Both SpanOps.fillOpaque() and SpanOps.fillAlpha() include byte-skip optimization:
```javascript
if (clipBuffer[byteIndex] === 0) {
    const nextByteBoundary = (byteIndex + 1) << 3;
    // Skip entire clipped byte (8 pixels)
    pixelIndex = Math.min(nextByteBoundary, endIndex);
    continue;
}
```

### 6.3 Algorithm Choices

| Algorithm           | Used By                                  | Purpose                                |
|---------------------|------------------------------------------|----------------------------------------|
| Bresenham circle    | CircleOps.stroke1px*, generateExtents    | Pixel-perfect circle outline           |
| Bresenham line      | LineOps thin strokes                     | Pixel-perfect line rasterization       |
| 8-way symmetry      | CircleOps.stroke1px*                     | Generate 8 points per Bresenham step   |
| Edge function       | RectOpsRot.fill_Rot_Any                    | Test if pixel inside rotated rect      |
| Polygon scanline    | LineOps.strokeThickPolygonScan           | Fill thick diagonal lines              |
| Sqrt-based extent   | CircleOps.fillStroke, strokeThick     | Analytical circle intersection         |
| Annulus (ring)      | CircleOps.strokeThick, fillStroke     | Inner/outer radius for thick strokes   |
| Angle filtering     | ArcOps.*                                 | Filter Bresenham points by angle range |
| Angle-based iterate | ArcOps.stroke1pxOpaqueExactEndpoints     | Exact start/end pixels for junctions   |
| Set deduplication   | CircleOps.stroke1pxAlpha, ArcOps         | Prevent overdraw for alpha blending    |
| Hybrid edges+arcs   | RoundedRectOpsRot._stroke1px_Rot_* (1px)   | 4 inline Bresenham edges + 4 arcs (no LineOps) |
| Edge Buffer Raster  | RoundedRectOpsRot.fill_Rot_Any             | O(H+P+A) optimal rotated fill          |
| Dual Edge Buffer    | RoundedRectOpsRot.stroke_Rot_Any (thick)   | Outer+inner perimeters, fill annulus   |
| Span-based fill-first | RectOpsAA.fillStroke                  | Correct semi-transparent stroke blending |
| Incremental DDA     | QuadScanOps.fillQuad                     | 4x faster scanline traversal (1 add vs 2 muls) |
| Edge-based DDA      | RectOpsRot._stroke_Rot_1px_DDA           | 1px rotated rect stroke aligned with fill |

### 6.4 Special Optimizations

| Optimization         | Where                                                          | Description                                        |
|----------------------|----------------------------------------------------------------|----------------------------------------------------|
| Epsilon contraction  | CircleOps.fillStroke, RoundedRectOpsAA.fillStroke          | FILL_EPSILON = 0.0001 prevents boundary speckles   |
| Line extend/shorten  | RectOpsRot.stroke_Rot_Any                                        | Proper miter corners for thick rotated rect stroke |
| Crisp center adjust  | CircleOps, ArcOps                                              | floor(cx - 0.5) for consistent pixel placement     |
| Exact endpoints      | ArcOps.stroke1pxOpaqueExactEndpoints                           | Angle-based iteration guarantees junction pixels   |
| Conditional fill extent | RectOpsAA.fillStroke                                          | Semi-transparent stroke → PATH extent; opaque → INNER extent |

---

## 7. Feature Comparison Summary

| Feature               | Rect | RoundRect | Circle | Line | Arc |
|-----------------------|------|-----------|--------|------|-----|
| Fill opaque           | ✓    | ✓         | ✓      | N/A  | ✓   |
| Fill alpha            | ✓    | ✓         | ✓      | N/A  | ✓   |
| Stroke 1px opaque     | ✓    | ✓         | ✓      | ✓    | ✓   |
| Stroke 1px alpha      | ✓    | ✓         | ✓      | ✓    | ✓   |
| Stroke thick opaque   | ✓    | ✓         | ✓      | ✓    | ✓   |
| Stroke thick alpha    | ✓    | ✓         | ✓      | ✓    | ✓   |
| fillStroke()       | ✓    | ✓         | ✓      | N/A  | ✓   |
| Rotation support      | ✓    | ✓         | N/A    | ✓    | ✗   |
| Clipping TO (respects clip) | ✓    | ✓         | ✓      | ✓    | ✓   |
| Clipping AT (defines clip)  | ✗    | ✗         | ✗      | N/A  | ✗   |
| 32-bit writes         | ✓    | ✓         | ✓      | ✓    | ✓   |
| Uses SpanOps          | ✓    | ✓         | ✓      | ✓    | ✗   |
| Bresenham algorithm   | ✗    | ✗         | ✓      | ✓    | ✓   |
| Set deduplication     | ✗    | ✗         | ✓      | ✗    | ✓   |

Note: Clipping AT (defining clip regions) uses path-based approach for all shapes - see Section 5.1.

---

## 8. Method Naming Conventions

Methods follow the dual-suffix pattern: `{operation}[Thickness]_{orientation}_{opacity}`
- **Orientation**: `AA` (axis-aligned) | `Rot` (rotated) - only for shapes with rotation variants
- **Opacity**: `Opaq` (opaque only) | `Alpha` (semi-transparent) | `Any` (handles both)

### Public Methods (by Class)

| Class              | Fill Methods                                      | Stroke Methods                                                                                         |
|--------------------|---------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| RectOpsAA            | fill_AA_Opaq, fill_AA_Alpha                       | stroke1px_AA_Opaq, stroke1px_AA_Alpha, strokeThick_AA_Opaq, strokeThick_AA_Alpha                       |
| RectOpsRot        | fill_Rot_Any                                      | stroke_Rot_Any                                                                                         |
| RoundedRectOpsAA     | fill_AA_Opaq, fill_AA_Alpha                       | stroke1px_AA_Opaq, stroke1px_AA_Alpha, strokeThick_AA_Opaq, strokeThick_AA_Alpha                       |
| RoundedRectOpsRot | fill_Rot_Any                                      | stroke_Rot_Any                                                                                         |
| CircleOps          | fill_Opaq, fill_Alpha                             | stroke1px_Opaq, stroke1px_Alpha, strokeThick_Any, strokeThick_Alpha                                    |
| LineOps            | N/A                                               | stroke_Any (public dispatcher)                                                                         |
| ArcOps             | fill_Opaq, fill_Alpha                             | stroke1px_Opaq, stroke1px_Opaq_Exact, stroke1px_Alpha, strokeOuter_Opaq, strokeOuter_Alpha             |
| SpanOps            | fill_Opaq, fill_Alpha                             | N/A                                                                                                    |

Note: Context2D calls *OpsAA classes for axis-aligned operations and *OpsRot classes directly for rotated operations.

### Combined Methods

| Class              | fillStroke Methods                               |
|--------------------|--------------------------------------------------|
| RectOpsAA            | fillStroke_AA_Any                                |
| RectOpsRot        | fillStroke_Rot_Any                               |
| RoundedRectOpsAA     | fillStroke_AA_Any                                |
| RoundedRectOpsRot | fillStroke_Rot_Any                               |
| CircleOps          | fillStroke_Any                                   |
| ArcOps             | fillStrokeOuter_Any                              |

### Internal Methods (underscore prefix)

| Class              | Private/Internal Methods                                                                    |
|--------------------|--------------------------------------------------------------------------------------------|
| RectOpsRot        | _stroke_Rot_1px_DDA, _stroke_Rot_Alpha, _extendLine, _shortenLine, _blendPixelAlpha |
| RoundedRectOpsRot | _fill_Rot_Opaq, _fill_Rot_Alpha, _stroke1px_Rot_Opaq, _stroke1px_Rot_Alpha, _strokeThick_Rot_Opaq, _strokeThick_Rot_Alpha, _transform, _generateEdgePixels, _generateArcPixels, _generatePerimeter |
| LineOps            | _strokeThick_PolyScan                                                                      |
| SpanOps            | blendPixel_Alpha                                                                           |

### 8.1 Call Hierarchy System

Each *Ops file contains a **CALL HIERARCHY** header comment documenting method dependencies. This system organizes methods into layers:

| Layer | Name | Description |
|-------|------|-------------|
| **Layer 0** | Foundation | SpanOps methods - shared horizontal span utilities with no *Ops dependencies |
| **Layer 1** | Primitives | Methods that call only Layer 0 (SpanOps), possibly with fallback to same-class methods |
| **Layer 2** | Internal | Underscore-prefixed internal implementations called by dispatchers |
| **Layer 3** | Dispatchers/Composites | Public methods that dispatch to internal implementations or combine multiple operations |

**Example header (from RoundedRectOpsAA.js):**
```javascript
/**
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha
 *
 * Layer 1 (Primitives - call SpanOps, fallback to RectOpsAA for radius=0):
 *   fill_AA_Opaq, fill_AA_Alpha
 *   stroke1px_AA_Opaq, stroke1px_AA_Alpha
 *   strokeThick_AA_Opaq, strokeThick_AA_Alpha
 *
 * Layer 2 (Composites):
 *   fillStroke_AA_Any  → Inline implementation (SpanOps + corner arcs)
 */
```

**⚠️ Maintenance Note:** These header comments must be kept up to date when:
- Adding new methods
- Changing method dependencies
- Renaming methods
- Adding cross-class calls

All *Ops files have this header: `SpanOps.js`, `QuadScanOps.js`, `RectOpsAA.js`, `RectOpsRot.js`, `CircleOps.js`, `ArcOps.js`, `LineOps.js`, `RoundedRectOpsAA.js`, `RoundedRectOpsRot.js`

**Note on Module Architecture:** The codebase uses a direct call pattern:
- RectOpsAA and RoundedRectOpsAA handle axis-aligned (AA) operations only
- RectOpsRot and RoundedRectOpsRot handle rotated (Rot) operations only
- Context2D calls the appropriate module directly based on transform state
- RoundedRectOpsRot falls back to RectOpsRot (not RectOpsAA) when radius=0
- This separation keeps each file focused and eliminates unnecessary indirection

---

## 9. Remaining Gaps

### Low Priority Enhancements:

1. **clipRect/clipCircle convenience methods** - Optional non-standard API additions

---

## 10. Code File Summary

| File                               | Purpose                                           |
|------------------------------------|---------------------------------------------------|
| src/renderers/SpanOps.js           | Shared horizontal span utilities                  |
| src/renderers/QuadScanOps.js       | Quadrilateral scanline fill (used by LineOps, RectOpsRot) |
| src/renderers/RectOpsRot.js       | Rotated rectangle renderings (called by Context2D)|
| src/renderers/RectOpsAA.js           | Axis-aligned rectangle renderings                 |
| src/renderers/CircleOps.js         | Circle direct renderings                          |
| src/renderers/LineOps.js           | Line direct renderings                            |
| src/renderers/RoundedRectOpsRot.js| Rotated rounded rectangle renderings (called by Context2D) |
| src/renderers/RoundedRectOpsAA.js    | Axis-aligned rounded rectangle renderings         |
| src/renderers/ArcOps.js            | Partial arc direct renderings                     |
| src/renderers/FastPixelOps.js      | Low-level pixel ops and clipping                  |
| src/core/Context2D.js              | Entry points and dispatch logic                   |

**Direct Call Architecture:** Context2D dispatches directly to the appropriate module based on transform state:
- Axis-aligned transforms → *OpsAA classes (RectOpsAA, RoundedRectOpsAA)
- Rotated/scaled transforms → *OpsRot classes (RectOpsRot, RoundedRectOpsRot)

---

## 11. Test Coverage Analysis

All 39 documented direct rendering functions have **100% explicit test coverage** via dedicated tests in `tests/direct-rendering/cases/`.

### 11.1 Coverage Matrix

#### RECTANGULAR (RectOpsAA.js + RectOpsRot.js) - 9/9 Functions Covered

| Function | Test File(s) |
|----------|--------------|
| `RectOpsAA.fill_AA_Opaq()` | `rect-fill-opaque-test.js` |
| `RectOpsAA.fill_AA_Alpha()` | `rect-sgl-*-fSemi-*` tests |
| `RectOpsRot.fill_Rot_Any()` | `rect-sgl-szMix-fOpaq-sOpaq-*-ctxRotRand-test.js` |
| `RectOpsAA.stroke1px_AA_Opaq()` | `rect-sgl-szMix-fNone-sOpaq-sw1px-*` tests |
| `RectOpsAA.stroke1px_AA_Alpha()` | `rect-sgl-szMix-fNone-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp-ornAxial-test.js` |
| `RectOpsAA.strokeThick_AA_Opaq()` | `rect-*-sw1-10px-*-sOpaq-*` tests |
| `RectOpsAA.strokeThick_AA_Alpha()` | `rect-*-sw1-10px-*-sSemi-*` tests |
| `RectOpsRot.stroke_Rot_Any()` | `rect-sgl-szMix-fOpaq-sOpaq-*-ctxRotRand-test.js` |
| `RectOpsAA.fillStroke_AA_Any()` | `rect-*-fSemi-sMix-*` tests |

#### ROUNDED RECTANGLES (RoundedRectOpsAA.js + RoundedRectOpsRot.js) - 10/10 Functions Covered

| Function | Test File(s) |
|----------|--------------|
| `RoundedRectOpsAA.fill_AA_Opaq()` | `roundrect-sgl-szMix-fOpaq-sNone-lytCenter-cenMixPG-edgeCrisp-ornAxial-rrrRand-test.js` |
| `RoundedRectOpsAA.fill_AA_Alpha()` | `roundrect-m8-xl-fSemi-sNone-*` |
| `RoundedRectOpsRot.fill_Rot_Any()` | `roundrect-sgl-szRand-f{Opaq,Semi}-sNone-sw0-lytCenter-cenRand-edgeNotCrisp-ornRot-rrrRand-test.js` |
| `RoundedRectOpsAA.stroke1px_AA_Opaq()` | `roundrect-*-sw1px-*-sOpaq-*` tests |
| `RoundedRectOpsAA.stroke1px_AA_Alpha()` | `roundrect-sgl-szMix-fNone-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp-ornAxial-rrrRand-test.js` |
| `RoundedRectOpsAA.strokeThick_AA_Opaq()` | `roundrect-*-sw1-11px-*-sOpaq-*` tests |
| `RoundedRectOpsAA.strokeThick_AA_Alpha()` | `roundrect-m6-*-sSemi-*`, `roundrect-m8-*` tests |
| `RoundedRectOpsRot.stroke_Rot_Any()` | `roundrect-m12-*-ornRot-*`, `roundrect-sgl-szRand-*-ornRot-*` tests |
| `RoundedRectOpsAA.fillStroke_AA_Any()` | Multiple fill+stroke tests |
| `RoundedRectOpsRot.fillStroke_Rot_Any()` | `roundrect-sgl-szRand-fOpaq-sSemi-sw{1px,2-40px}-*-ornRot-*` tests |

#### CIRCLES (CircleOps.js) - 7/7 Functions Covered

| Function | Test File(s) |
|----------|--------------|
| `fill_Opaq()` | `circle-fill-opaque-test.js`, `circle-*-fOpaq-sNone-*` |
| `fill_Alpha()` | `circle-semitransparent-test.js` |
| `stroke1px_Opaq()` | `circle-*-sw1px-*-sOpaq-*` tests |
| `stroke1px_Alpha()` | `circle-sgl-szMix-fNone-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp-test.js` |
| `strokeThick_Any()` | `circle-*-sw1-30px-*-sOpaq-*` tests |
| `strokeThick_Alpha()` | `circle-*-sw1-30px-*-sSemi-*` tests |
| `fillStroke_Any()` | `circle-*-fOpaq-sOpaq-*`, `multiple-circles-test.js` |

#### LINES (LineOps.js) - 5/5 Functions Covered

| Function | Test File(s) |
|----------|--------------|
| `stroke_Any()` thin opaque | `line-crisp-horizontal-test.js`, `line-*-sw1px-*-sOpaq-*` |
| `stroke_Any()` thin alpha | `line-sgl-fNone-sSemi-sw1px-ornDiag-test.js` |
| `stroke_Any()` thick H/V | `line-*-sw2px-*-ornHoriz/Vert-*` tests |
| `_strokeThick_PolyScan()` opaque | `line-m20-*-ornRand-*` tests |
| `_strokeThick_PolyScan()` alpha | `line-m15-*-sMix-*` tests |

#### ARCS (ArcOps.js) - 8/8 Functions Covered + Edge Cases

| Function | Test File(s) |
|----------|--------------|
| `fill_Opaq()` | `arc-fill-opaque-test.js`, `arc-*-fOpaq-sNone-*` |
| `fill_Alpha()` | `arc-semitransparent-test.js` |
| `stroke1px_Opaq()` | `arc-*-sw1px-*-sOpaq-*` tests |
| `stroke1px_Opaq_Exact()` | Tested via `roundrect-*-ornRot-*` (used for junction alignment) |
| `stroke1px_Alpha()` | `arc-*-sw1px-*-sSemi-*` tests |
| `strokeOuter_Opaq()` | `arc-*-sw2-6px-*-sOpaq-*`, `arc-*-sw1-30px-*` tests |
| `strokeOuter_Alpha()` | `arc-*-sw2-6px-*-sSemi-*` tests |
| `fillStrokeOuter_Any()` | `arc-*-fMix-sOpaq-*`, `arc-*-fMix-sSemi-*` tests |
| *Small angles edge case* | `arc-sgl-szMix-fMix-sMix-swMix-lytCenter-cenMixPG-edgeCrisp-arcASmall-test.js` |

### 11.2 Coverage Summary

| Shape | Functions | Covered |
|-------|-----------|---------|
| Rectangle | 9 | 9 ✓ |
| RoundedRect | 10 | 10 ✓ |
| Circle | 7 | 7 ✓ |
| Line | 5 | 5 ✓ |
| Arc | 8 | 8 ✓ |
| **Total** | **39** | **39 ✓** |

**Test Suite Statistics:**
- **79 test files** in `tests/direct-rendering/cases/`
- **395 test runs passed** (79 tests × 5 iterations)
- Run command: `node tests/direct-rendering/run-direct-rendering-tests.js -i 5`

### 11.3 Optional Future Edge Case Tests

While core functions are fully covered, these edge cases could be added:

1. Near-full arcs (350°-360°)
2. Clockwise vs counterclockwise arc direction
3. Sub-pixel stroke widths (0.1-0.9px)
4. Shapes larger than canvas bounds

---

## 12. Performance Testing

Direct rendering tests support **dual-mode execution**: visual testing for correctness verification and performance testing for comparative benchmarking.

### 12.1 Performance Testing Infrastructure

**Location**: `tests/direct-rendering/performance-tests.html`

The performance testing page provides ramp-up comparison between SWCanvas Direct rendering and native HTML5 Canvas:

1. **Ramp-up methodology**: Incrementally increases shape count until frame budget is exceeded
2. **Frame budget detection**: Automatically detects display refresh rate (60fps, 120fps, etc.)
3. **Comparative metrics**: Reports maximum shapes per frame for both renderers
4. **Performance ratio**: Calculates HTML5 Canvas / SWCanvas performance ratio

### 12.2 Dual-Mode Test Pattern

Tests registered with `displayName` metadata support both visual and performance testing:

```javascript
registerDirectRenderingTest(
    'test-name',
    function drawTest(ctx, iterationNumber, instances = null) {
        const isPerformanceRun = instances !== null && instances > 0;
        const numToDraw = isPerformanceRun ? instances : 1;

        for (let i = 0; i < numToDraw; i++) {
            // Draw shape using direct rendering API
            ctx.fillCircle(x, y, radius);
        }

        // Performance runs return null, visual tests return {logs, checkData}
        return isPerformanceRun ? null : { logs, checkData };
    },
    'circles',
    { /* visual test checks */ },
    {
        title: 'Test Title',
        displayName: 'Perf: Circle Fill'  // Enables performance registration
    }
);
```

### 12.3 Performance Registry

Tests with `displayName` in metadata are automatically registered in `DIRECT_RENDERING_PERF_REGISTRY`:

| Field | Description |
|-------|-------------|
| `id` | Test identifier (e.g., 'circle-fill-opaque') |
| `drawFunction` | The drawing function supporting dual-mode |
| `displayName` | Display name for UI (e.g., 'Perf: Circle Fill Opaque') |
| `description` | Test description |
| `category` | Shape category ('circles', 'rects', 'lines', 'arcs', 'rounded-rects') |

### 12.4 Backward Compatibility

The dual-mode pattern maintains full backward compatibility:

| Runner | Call Signature | Expected Return |
|--------|---------------|-----------------|
| Node.js test runner | `drawFunction(ctx, iteration, null)` | `{logs, checkData}` |
| Browser visual runner | `drawFunction(ctx, iteration, null)` | `{logs, checkData}` |
| Performance runner | `drawFunction(ctx, 0, instanceCount)` | `null` |

See `tests/README.md` for complete performance testing documentation.

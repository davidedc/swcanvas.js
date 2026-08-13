# SWCanvas.js Direct Renderings - Comprehensive Analysis & Summary

## Executive Summary

SWCanvas implements direct renderings for 6 shape types: Rectangle, RoundedRect, Circle, Stadium, Line, and Arc. Each has specialized rendering paths that bypass the general polygon filler when specific conditions are met.

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
| Stadium Fill            | Context2D.fillStadium()               | path.roundRect(r=min/2) + fill() |
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
| <1px (hairline) | Axis-aligned         | Any              | RectOpsAA.stroke1px_AA_Alpha() at globalAlpha×width (§3) | YES |
| >1px         | Axis-aligned            | Opaque           | RectOpsAA.strokeThick_AA_Opaq()   | YES      |
| >1px         | Axis-aligned            | Semi-transparent | RectOpsAA.strokeThick_AA_Alpha()  | YES      |
| Any          | Rotated (uniform scale) | Both             | RectOpsRot.stroke_Rot_Any()    | YES      |
| Any          | Axis-aligned            | Both             | RectOpsAA.fillStroke_AA_Any()     | YES      |
| Any          | Rotated (uniform scale) | Both             | RectOpsRot.fillStroke_Rot_Any()| YES      |
| 0px          | Any                     | Any              | IGNORED (per HTML5 spec)        | -        |

Notes:
- Context2D calls RectOpsAA for axis-aligned (AA) operations and RectOpsRot directly for rotated operations.
- `RectOpsAA.fillStroke_AA_Any()` uses three optimized paths:
  - **1px fast path** (`lineWidth <= 1`): Fill inner extent via SpanOps + direct 4-edge pixel stroke. No overlap exists between fill and stroke for 1px, so no composite calculation needed.
  - **5-segment path** (thick semi-transparent strokes): Pre-computed composite color for overlap regions, zero overdraw.
  - **Simple path** (opaque strokes, fill-only, stroke-only): Fill to inner extent, stroke covers its region.

### 2.2 ROUNDED RECTANGLES (RoundedRectOpsAA.js + RoundedRectOpsRot.js)

| Stroke Width | Orientation  | Opacity          | Function                               | Clipping TO |
|--------------|--------------|------------------|----------------------------------------|-------------|
| N/A (fill)   | Axis-aligned | Opaque           | RoundedRectOpsAA.fill_AA_Opaq()          | YES      |
| N/A (fill)   | Axis-aligned | Semi-transparent | RoundedRectOpsAA.fill_AA_Alpha()         | YES      |
| N/A (fill)   | Rotated      | Both             | RoundedRectOpsRot.fill_Rot_Any()      | YES      |
| 1px          | Axis-aligned | Opaque           | RoundedRectOpsAA.stroke1px_AA_Opaq()     | YES      |
| 1px          | Axis-aligned | Semi-transparent | RoundedRectOpsAA.stroke1px_AA_Alpha()    | YES      |
| <1px (hairline) | Axis-aligned | Any           | RoundedRectOpsAA.stroke1px_AA_Alpha() at globalAlpha×width (§3) | YES |
| Any          | Rotated      | Both             | RoundedRectOpsRot.stroke_Rot_Any()    | YES      |
| >1px         | Axis-aligned | Opaque           | RoundedRectOpsAA.strokeThick_AA_Opaq()   | YES      |
| >1px         | Axis-aligned | Semi-transparent | RoundedRectOpsAA.strokeThick_AA_Alpha()  | YES      |
| Any          | Axis-aligned | Both             | RoundedRectOpsAA.fillStroke_AA_Any()     | YES      |
| Any          | Rotated      | Both             | RoundedRectOpsRot.fillStroke_Rot_Any()| YES      |
| 0px          | Any          | Any              | IGNORED                                | -        |

Notes:
- Context2D calls RoundedRectOpsAA for axis-aligned (AA) operations and RoundedRectOpsRot directly for rotated operations.
- RoundedRectOpsRot falls back to RectOpsRot (not RectOpsAA) when radius=0 for consistency.
- Axis-aligned rounded rectangle **stroke** (1px alpha) uses edge shortening + lastPos tracking to prevent overdraw.
- Rotated rounded rectangle **stroke** (1px opaque) uses hybrid algorithm: 4 edges via inline Bresenham + 4 corner arcs via ArcOps.stroke1px_Opaq_Exact().
- Rotated rounded rectangle **stroke** (1px alpha) uses hybrid algorithm + global lastPos tracking across corners to prevent overdraw.
- Rotated rounded rectangle **stroke** (thick) uses Dual Edge Buffer algorithm: generates outer and inner perimeters, fills annulus per scanline.
- Rotated rounded rectangle **fill** uses Edge Buffer Rasterization: O(H + P + A) optimal complexity.
- **fillStroke_Rot_Any()** combines fill with epsilon contraction + stroke on top.
- **fillStroke_AA_Any()** fill extent: thick semi-transparent strokes use PATH extent (for proper overlap blending), while 1px and opaque strokes use INNER extent (no meaningful overlap area).
- **RoundedRectOpsRot** uses module-level Int16Array buffer pool (`_rrRotBufferPool`) with growth-only strategy for zero steady-state allocations.
- **_fillStroke_Rot_1px** uses double-generation strategy: generate perimeter twice (once for bounds, once for render) instead of storing pixels in Set.

### 2.3 CIRCLES (CircleOps.js)

| Stroke Width | Opacity          | Function                    | Clipping TO |
|--------------|------------------|-----------------------------|-------------|
| N/A (fill)   | Opaque           | CircleOps.fill_Opaq()       | YES      |
| N/A (fill)   | Semi-transparent | CircleOps.fill_Alpha()      | YES      |
| 1px          | Opaque           | CircleOps.stroke1px_Opaq()  | YES      |
| 1px          | Semi-transparent | CircleOps.stroke1px_Alpha() | YES      |
| <1px (hairline) | Any           | CircleOps.stroke1px_Alpha() at globalAlpha×width (§3) | YES |
| >1px         | Opaque           | CircleOps.strokeThick_Opaq() | YES      |
| >1px         | Semi-transparent | CircleOps.strokeThick_Alpha()| YES     |
| Any          | Both             | CircleOps.fillStroke_Any()  | YES      |
| 0px          | Any              | IGNORED                     | -        |

Note: Circles are inherently rotation-invariant (no tilted variant needed)

### 2.3b STADIUMS (StadiumOps.js)

| Stroke Width | Opacity          | Function                 | Clipping TO |
|--------------|------------------|--------------------------|-------------|
| N/A (fill)   | Opaque           | StadiumOps.fill_Opaq()   | YES      |
| N/A (fill)   | Semi-transparent | StadiumOps.fill_Alpha()  | YES      |

A stadium (capsule) is the w-by-h box with its shorter axis fully rounded: two
half-circle caps of radius min(w,h)/2 joined by a rectangular body, orientation
implied by the longer axis (w === h degenerates to fillCircle's exact pixels).
Deliberately FILL-ONLY - no stroke variants until a caller exists. Built on
CircleOps.generateExtents (one union span per row), because (a) the
circle+rect+circle composition double-blends its overlaps at alpha < 1, and
(b) RoundedRectOpsAA at the degenerate radius r = min(w,h)/2 loses the
left/right apex columns of a HORIZONTAL stadium (its corner x extents are
edge-sampled while rows are center-sampled - hidden on normal rounded rects by
their straight vertical edges; probed in
debug/probe-stadium-roundrect-degenerate.js). Rotated-uniform-scale calls
delegate to RoundedRectOpsRot at the degenerate radius (no exact-column
contract under rotation); the crisp contract is pinned by tests/core/053.

### 2.4 LINES (LineOps.js)

| Stroke Width | Orientation     | Opacity          | Function                          | Clipping TO |
|--------------|-----------------|------------------|-----------------------------------|-------------|
| 1px–1.5px    | Any (Bresenham) | Opaque           | LineOps.stroke_Any() thin path    | YES      |
| 1px–1.5px    | Any (Bresenham) | Semi-transparent | LineOps.stroke_Any() thin alpha   | YES      |
| <1px (hairline) | Any (Bresenham) | Any           | LineOps.stroke_Any() thin alpha at globalAlpha×width (§3) | YES |
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
| <1px (hairline) | Any           | ArcOps.stroke1px_Alpha() at globalAlpha×width (§3) | YES |
| >1px         | Opaque           | ArcOps.strokeOuter_Opaq()          | YES      |
| >1px         | Semi-transparent | ArcOps.strokeOuter_Alpha()         | YES      |
| Any          | Both             | ArcOps.fillStrokeOuter_Any()       | YES      |

Note: Arc uses Bresenham + angle filtering for stroke rendering.
**stroke1px_Alpha()** uses conditional deduplication (same pattern as CircleOps) - avoids Set allocation via x!=y + cardinal point checks.
**stroke1px_Opaq_Exact()** uses angle-based iteration (not Bresenham) guaranteeing pixels at exact start/end angles - used by RoundedRectOpsRot.stroke_Rot_Any() for junction alignment.
**Requires lineCap === 'butt' for direct rendering (non-butt caps fall to path-based rendering).**
**Performance optimizations**: Uses module-level scratch buffer (`_arcEventBuffer`) for scanline events, avoiding per-scanline allocation. Events sorted via custom insertion sort (faster than native sort for N < 6 elements).

---

## 3. Condition Checks for Direct Rendering Eligibility

### Universal Conditions — with their TRUE scope (audited 2026-08-12):

Only the first two rows are genuinely universal. The shadow and alpha gates are FAMILY-scoped:
the rect/roundRect/stadium entries dispatch through `_canUseDirectRendering` /
`_canUseDirectRenderingForFillStroke` (Context2D), which carry all four checks; the circle, arc
and line entries re-derive their gates INLINE and carry only the first two (see the per-entry
table below and §9 for the consequences).

| Condition    | Check                                      | What Blocks It                            | Scope |
|--------------|--------------------------------------------|-------------------------------------------|-------|
| Paint Source | paintSource instanceof Color               | Gradients, Patterns                       | ALL entries |
| Composite Op | globalCompositeOperation === 'source-over' | All other ops (copy, xor, etc.)           | ALL entries |
| Shadows      | `_noShadow` (no shadowColor, or `shadowColor.a === 0`, or zero blur+offsets — the exact negation of `ShadowPipeline.needsShadow`) | Any other shadow state | ALL entries — the rect/roundRect/stadium families via `_canUseDirectRendering`/`_canUseDirectRenderingForFillStroke`, the circle/arc/line entries via their inline gates (an active shadow routes to the generic fallback, which renders it) |
| Paint Alpha  | `_isInvisibleDraw`: paint `a === 0` or `globalAlpha === 0`, source-over only | Fully transparent paint / zero globalAlpha | ALL entries — uniform early-return-no-draw at the entry top (fused entries: only when BOTH halves invisible); non-source-over composites keep the generic pipeline ('copy' with transparent paint has visible effects) |
| Line Cap     | lineCap === 'butt'                         | 'round', 'square'                         | line + arc STROKE entries only (`strokeLine`, `outerStrokeArc`, `fillOuterStrokeArc`) |
| Line Dash    | `_lineDash.length === 0`                   | any dash pattern set via setLineDash      | ALL direct STROKE arms incl. fused stroke halves — dashed strokes take the generic path, which applies the dash (policy decided 2026-08-13; fills unaffected) |

`globalAlpha` is deliberately in NO gate: it selects the `_Alpha` renderer variant, which is
still a direct path.

### Universal Stroke Rule — sub-pixel (HAIRLINE) widths:

A stroke narrower than one device pixel is drawn AT one pixel, with the missing
width taken out of the OPACITY instead. Every direct stroke entry — `strokeRect`,
`strokeRoundRect`, `strokeCircle`, `outerStrokeArc`, `strokeLine`, including the
rotated branches — dispatches `0 < scaledLineWidth < 1` to its family's
`stroke1px_*Alpha` renderer at `globalAlpha * scaledLineWidth`. This mirrors the
generic pipeline's rule (`Rasterizer._strokeInternal`: `lineWidth < 1` renders at
width 1.0 with `subPixelOpacity = lineWidth`), so a hairline reads lighter than a
1px stroke on both pipelines — and real browser canvases honour the same
hairline-faintness behaviour through their own machinery (measured on Chrome: a
0.5px black stroke on white reads one uniform mid-gray row), so the stroke
WEIGHT matches cross-engine too. This is a hairline faintness rule, NOT
anti-aliasing: SWCanvas stays non-AA — one uniform opacity level per stroke.

Three properties are load-bearing (contract pinned by core test 055; measured by
`debug/probe-hairline-strokes.js`):

- It keys on the **DEVICE** width (`scaledLineWidth`), not the logical one: a
  0.5-logical stroke at scale 2 is a true 1px stroke and stays on the exact-1px
  path, while a 1-logical stroke inside a shrunk transform goes correctly faint.
  (The generic pipeline keys on the LOGICAL width — it widens the geometry in
  user space and lets the CTM scale it — so the two agree at identity and
  diverge under scale by construction. The direct entries are device-space
  renderers; that is not a divergence to reconcile.)
- The `_Alpha` variant is **always** the target: the opacity product is < 1 by
  construction, so the `_Opaq` twin can never apply on this branch.
- A hairline paints **exactly the pixel set the exact-1px stroke paints**, at
  every sub-pixel width — positional continuity across the 1px threshold.
  Continuity with the generic path's *position* was never available: the direct
  and generic rasterizations already differ there at `lineWidth` 1, which is the
  shipped behaviour of every `lineWidth >= 1` caller.

**Twin invariant** (test 055 §6): every family's `stroke1px_Opaq` and
`stroke1px_Alpha` paint the same pixel set — a stroke's geometry must not
depend on its opacity, or a hairline would not be continuous with the opaque
1px stroke it sits next to. `ArcOps.stroke1px_Opaq` historically violated this
(its Bresenham update used a different spelling than CircleOps'/its own alpha
twin, so a partial arc changed shape with its opacity — 16 vs 19 px at r=11);
its walk is now the family's canonical one. Relatedly, the rotated rect 1px
DDA now dedups pixels shared by consecutive edges (§6.5), so rotated
translucent strokes — including every rotated hairline — are single-blend
(test 055 §7).

Deliberately NOT wired: the fused `fillStroke*` entries' stroke halves — all
FOUR of them (`fillStrokeRect`, `fillStrokeRoundRect`, `fillStrokeCircle`,
`fillOuterStrokeArc`) paint their `lineWidth <= 1` strokes at FULL weight (no
hairline caller exists — previously an untested surface, now a PINNED contract:
core test 068 asserts full-weight fused vs faint standalone per entry, noting
the circle/arc fused sub-pixel rings can be PARTIAL — the degenerate annulus
scan — so the pin is about weight, not coverage). Gradient/pattern strokes at
any width also stay unwired (no `_Alpha` direct renderer; generic path).

### Shape-Specific Conditions:

| Shape       | Additional Checks                                                         |
|-------------|---------------------------------------------------------------------------|
| Rectangle   | Transform: isAxisAligned OR isUniformScale. Generic ONLY when BOTH fail — a non-90°-multiple rotation combined with non-uniform scale, a SHEAR, or a mirror-with-rotation (produces a parallelogram/quad the rect renderers can't draw). NOTE isAxisAligned covers 0/90/180/270 incl. flips, so a 90°-ROTATED NON-UNIFORM CTM stays fully direct (AA arm, w/h swapped); a tilted UNIFORM CTM stays direct (Rot arm). |
| RoundedRect | Transform: isUniformScale REQUIRED (non-uniform would need ellipse corners → generic; ⚠ stricter than plain rects — axis-aligned `scale(2,1)` goes generic here but stays direct for Rectangle; keeping that gate is a RECORDED decision — §9 entry 11). RADII CONTRACT: a `radii` array is collapsed FIRST-ELEMENT-WINS to one uniform radius (NOT HTML5 per-corner semantics), then rounded to an integer and clamped by `RoundedRectUtils.normalizeRadius`. Within it, a three-arm ladder: isIdentity (literal user coords) → isAxisAligned (device coords, 90° w/h swap) → rotated (`*_Rot_Any`). All arms are the same renderer family with numerically equivalent arguments at scale 1. |
| Circle      | Transform: isUniformScale (translate/rotate/uniform-scale go direct — pre-multiplication is byte-exact;      |
|             | test 050; NON-uniform scale gates to the generic pipeline via an un-baked user-space path, so the caller      |
|             | gets the correct ELLIPSE rather than the geometric-mean-radius circle the direct path would draw — test 054). |
| Stadium     | Transform: isUniformScale (axis-aligned 90-degree rotation swaps w/h inline; rotated delegates to             |
|             | RoundedRectOpsRot at r = min(w,h)/2; non-uniform scale falls back to the path pipeline).                      |
| Line        | lineCap === 'butt' (required for direct rendering)                               |
| Arc         | lineCap === 'butt' (required for direct rendering)                               |
|             | Transform: isUniformScale — same gate + generic-path fallback as Circle (test 054) |
|             | Angle normalization for clockwise/anticlockwise                           |

### Per-entry dispatch summary (complete conditions, audited 2026-08-12)

The one table that answers "when does THIS entry leave the direct path, and where does it land".
"Decomposes" means the fused entry re-enters its two component entries, each re-dispatching
independently (so e.g. a gradient fill + solid stroke yields a generic fill and a DIRECT stroke).

| Entry | CTM for direct | Non-CTM for direct | Falls back on | Fallback target |
|---|---|---|---|---|
| `fillRect` | isAxisAligned OR isUniformScale | Color, a>0, source-over, `_noShadow` | gradient/pattern · composite · shadow · shear/mirror-rot/rot+non-uniform (a=0 → early return, §3 Paint Alpha) | generic rasterizer (negative/zero dims and bad types validated up front — §9 note) |
| `strokeRect` | same | same (stroke paint) + no dash | same · dash set | generic (honours `lineDash`; dims/types validated up front like fillRect) |
| `fillStrokeRect` | same | both paints Color, source-over, `_noShadow`, something to draw | either paint non-Color · nothing to draw · composite · shadow · CTM | decomposes → `fillRect` + `strokeRect` |
| `clearRect` | n/a (`b===0 && c===0` picks span loop vs inverse-transform loop) | none | NEVER — direct-only | — (ignores alpha/composite/shadow by design) |
| `fillRoundRect` | isUniformScale (ladder identity→AA→rot) | Color, a>0, source-over, `_noShadow` | non-Color · a=0 · composite · shadow · non-uniform scale | generic via external `SWPath2D` (radius≤0 → `fillRect`) |
| `strokeRoundRect` | same | same (stroke) + no dash | same · dash set | generic via `stroke(path)`, honours `lineDash` (radius≤0 → `strokeRect`) |
| `fillStrokeRoundRect` | same | both Color, source-over, `_noShadow`, something to draw | as `fillStrokeRect` + non-uniform | decomposes → `fillRoundRect` + `strokeRoundRect` (radius≤0 → `fillStrokeRect`) |
| `fillStadium` | isUniformScale (rot arm delegates to `RoundedRectOpsRot`, r=min/2) | Color, a>0, source-over, `_noShadow` | non-Color · a=0 · composite · shadow · non-uniform | generic via external `SWPath2D` (no stroke API exists) |
| `fillCircle` | isUniformScale (pre-gate, correct external-path fallback) | Color, source-over, `_noShadow` | non-Color · composite · shadow | generic via external `SWPath2D` |
| `strokeCircle` | isUniformScale (pre-gate) | Color, a>0, source-over, `_noShadow` | non-Color · a=0 · composite · shadow | generic via external `SWPath2D` (honours cap/join/dash) |
| `fillStrokeCircle` | isUniformScale (pre-gate) | both Color, source-over, `_noShadow`, something to draw | either non-Color · composite · shadow · nothing | sequential `_fillCircleDirect` + `_strokeCircleDirect` (still direct dispatchers) |
| `fillArc` | isUniformScale (pre-gate) | Color, source-over, `_noShadow` | non-Color · composite · shadow (a=0 → early return, §3 Paint Alpha) | generic via external `SWPath2D`; never tier-0-clipped |
| `outerStrokeArc` | isUniformScale (pre-gate) | Color, a>0, source-over, lineCap 'butt', `_noShadow` | non-Color · a=0 · composite · round/square cap · shadow | generic via external `SWPath2D` (honours the cap) |
| `fillOuterStrokeArc` | isUniformScale (pre-gate) | both Color, source-over, lineCap 'butt', `_noShadow`, something to draw | either paint non-Color · composite · cap · shadow | sequential generic via external `SWPath2D` (both halves) |
| `strokeLine` | NONE — any CTM incl. shear (width via geometric-mean uniformScale) | Color, source-over, lineCap 'butt', `_noShadow` | non-Color · composite · round/square cap · shadow | generic via external `SWPath2D` (honours cap/dash; HTML5 anisotropic width under non-uniform CTM); alpha/CTM/clip never gate |
| `fillText` | direct atlas blit iff `b=c=0, a=d=dpr`, integer e/f; else intermediate buffer + `drawImage` | none (no composite/shadow/alpha/clip gate — both arms honour them via `drawImage`) | `maxWidth` → throw · gradient/pattern → ⚠ silent BLACK substitution (console.warn) | both arms mark path-based |
| `strokeText` | — | — | ALWAYS throws | — |
| `drawImage` | no direct path at all | — | always generic | rasterizer (internal source-over/opaque/1:1-scale micro-arms, same renderer). SAMPLING is its own two-arm dispatch: NEAREST-NEIGHBOR iff the draw does not resample — axis-aligned AND effective sample step = 1 (per-device-pixel source step `invA*xScale`/`invD*yScale`, where CTM scale and src/dst rect ratio COMPOSE) — else BILINEAR; `imageSmoothingEnabled=false` (per HTML5: boolean-coerced, save/restored, both API layers) forces NN for every draw |

Clip state is NOT a dispatch condition anywhere: no clip → raw fills; tier-0 rect clip → clamped
extents (where wired — `fillStrokeRect`, all `*_Rot_*` arms, `ArcOps` and `LineOps` always
materialise the bitmask instead, a perf loss only); path clip → per-pixel bitmask test INSIDE the
direct renderers.

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

CircleOps.strokeThick_Alpha() ────► SpanOps.fill_Alpha()
   (annulus segments)

CircleOps.fillStroke_Any() ───────► SpanOps.fill_Opaq/fill_Alpha
   (fill spans + stroke segments)

RoundedRectOpsAA.fill_AA_Opaq() ────► SpanOps.fill_Opaq()
   (each scanline)

RoundedRectOpsAA.fillStroke_AA_Any() ─► SpanOps.fill_Opaq/fill_Alpha (via helper functions)

RoundedRectOpsAA.stroke1px_AA_Alpha() ─► Inline BLEND_ALPHA marker
   (1px alpha strokes)

RoundedRectOpsRot._fill_Rot_Alpha() ──► SpanOps.fill_Alpha()

RoundedRectOpsRot._strokeThick_Rot_Alpha() ► SpanOps.fill_Alpha()

RoundedRectOpsRot._stroke1px_Rot_Alpha() ► Inline BLEND_ALPHA marker
   (1px alpha strokes)

RoundedRectOpsRot._fillStroke_Rot_*() ──► SpanOps.fill_Opaq/fill_Alpha + inline markers

All *Ops.fill*() ─────────────────► SpanOps.fill_Opaq() or SpanOps.fill_Alpha()
   (all shapes)                       (shared horizontal span utility)

All *Ops.stroke1px*_Alpha() ──────► Inline BLEND_ALPHA marker
   (1px alpha strokes)                (preprocessor-expanded pixel blending)

RectOpsRot.fill_Rot_Any() ────────► QuadScanOps.fillQuad
   (rotated rectangle fill)

RectOpsRot._stroke_Rot_Alpha() ───► QuadScanOps.lineToQuad + QuadScanOps.fillQuad
   (thick semi-transparent rotated strokes)

QuadScanOps.fillQuad() ───────────► SpanOps.fill_Opaq / SpanOps.fill_Alpha
   (each scanline span)
```

**Inline markers provide pixel-level blending** - BLEND_ALPHA and SET_OPAQUE markers are expanded by the preprocessor at build time, used by all shape renderers for 1px semi-transparent strokes

**SpanOps is the span layer** - provides fill_Opaq and fill_Alpha for horizontal span operations, uses inline markers internally. Used by all shape renderers: RectOpsAA, RectOpsRot, CircleOps, LineOps, RoundedRectOpsAA, RoundedRectOpsRot, QuadScanOps

**SpanOps bounds contract** - SpanOps TRUSTS that callers provide valid coordinates (y in bounds, startX >= 0, startX + length <= width, length > 0). Callers MUST clamp bounds BEFORE calling SpanOps. This enables early-exit optimizations when spans are entirely off-screen. Debug assertions verify bounds in development builds.

**QuadScanOps is the quad primitive** - used by LineOps (thick diagonal) and RectOpsRot (rotated fills/strokes)

---

## 5. Clipping TO Support (Respects Active Clip Mask)

| Shape                   | Clipping TO Support | Bitmask Method            | Tier-0 rect clip (no bitmask) |
|-------------------------|---------------------|---------------------------|-------------------------------|
| Rectangle (fill/stroke) | YES                 | clipBuffer per pixel      | YES                           |
| RoundedRect             | YES                 | clipBuffer per pixel      | YES (fill, stroke, fused fillStroke)             |
| Circle (all)            | YES                 | clipBuffer per pixel      | YES (fill, 1px + thick stroke, fused fillStroke) |
| Stadium (fill)          | YES                 | clipBuffer per pixel      | YES (from birth; rotated branch uses the bitmask like other Rot paths) |
| Line (all)              | YES                 | clipBuffer per pixel/span | NO — stroke_Any dispatches thin/thick internally and its thick diagonal branch delegates to QuadScanOps, which has no clipRect concept (comment at `_strokeLineDirect`) |
| Arc (all)               | YES                 | clipBuffer per pixel      | NO — the 1px writers bounds-check inside shared inline preprocessor templates, so a clipRect is a codegen change, not a clamp (comment at `fillArc`) |

All shapes take a `clipBuffer` parameter passed from Context2D to their respective *Ops methods.

**Tier-0 rect clip**: when the active clip collapses to a single axis-aligned rect, wired entry points skip the bitmask entirely — they consult `Context2D._tier0ClipRect()` and pass the rect down as a `clipRect` parameter; the renderer clamps its row/span/pixel extents to it (defaults = surface bounds, so unclipped output is byte-identical by construction). The byte-identical contract lives at `Context2D._tier0ClipRect`'s doc comment; equivalence is pinned by `tests/core/049` (RoundedRect) and `tests/core/051` (Circle). ⚠ `SpanOps` does NOT clamp — callers must keep spans inside the surface AND the clip rect (`tests/core/052` pins the off-surface containment contract for the fused circle path).

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

SpanOps.fill_Opaq() and SpanOps.fill_Alpha() include byte-skip optimization for clipping:
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
| Scanline event sort | ArcOps.*                                 | Insertion sort for 2-6 event boundaries |
| Conditional dedup   | CircleOps.stroke1px_Alpha, ArcOps.stroke1px_Alpha | Prevent overdraw via x!=y + cardinal checks |
| Hybrid edges+arcs   | RoundedRectOpsRot._stroke1px_Rot_* (1px)   | 4 inline Bresenham edges + 4 arcs (no LineOps) |
| Edge Buffer Raster  | RoundedRectOpsRot.fill_Rot_Any             | O(H+P+A) optimal rotated fill          |
| Dual Edge Buffer    | RoundedRectOpsRot.stroke_Rot_Any (thick)   | Outer+inner perimeters, fill annulus   |
| Span-based fill-first | RectOpsAA.fillStroke                  | Correct semi-transparent stroke blending |
| 1px fast path         | RectOpsAA.fillStroke                  | No overlap for 1px: fill + 4-edge stroke |
| Incremental DDA     | QuadScanOps.fillQuad                     | 4x faster scanline traversal (1 add vs 2 muls) |
| Edge-based DDA      | RectOpsRot._stroke_Rot_1px_DDA           | 1px rotated rect stroke aligned with fill |
| Buffer pool         | RoundedRectOpsRot (all methods)          | Growth-only Int16Array pool eliminates per-call allocations |
| Double-generation   | RoundedRectOpsRot._fillStroke_Rot_1px    | Generate perimeter twice instead of storing in Set |
| lastPos tracking    | RoundedRectOpsRot._stroke1px_Rot_Alpha, _fillStroke_Rot_1px | Prevent consecutive overdraw for semi-transparent |

### 6.4 Special Optimizations

| Optimization         | Where                                                          | Description                                        |
|----------------------|----------------------------------------------------------------|----------------------------------------------------|
| Epsilon contraction  | CircleOps.fillStroke, RoundedRectOpsAA.fillStroke          | FILL_EPSILON = 0.0001 prevents boundary speckles   |
| Line extend/shorten  | RectOpsRot.stroke_Rot_Any                                        | Proper miter corners for thick rotated rect stroke |
| Crisp center adjust  | CircleOps, ArcOps                                              | floor(cx - 0.5) for consistent pixel placement     |
| Exact endpoints      | ArcOps.stroke1pxOpaqueExactEndpoints                           | Angle-based iteration guarantees junction pixels   |
| Event buffer reuse   | ArcOps.*                                                       | Module-level Float32Array(8) avoids per-scanline allocation |
| Conditional fill extent | RectOpsAA.fillStroke                                          | Semi-transparent stroke → PATH extent; opaque → INNER extent |
| 1px stroke fast path    | RectOpsAA.fillStroke                                          | No overlap for 1px strokes; skip composite calculation       |
| Int16Array buffer pool | RoundedRectOpsRot                                              | Module-level growth-only pool eliminates 10-20 allocations per call |
| Double-generation      | RoundedRectOpsRot._fillStroke_Rot_1px                          | CPU cycles for coord generation < Set hash overhead |
| Conditional dedup      | CircleOps/ArcOps stroke1px_Alpha                               | x!=y + cardinal checks eliminate Set allocation |

### 6.5 Overdraw Prevention for Semi-Transparent Strokes

**The Problem**: When rendering semi-transparent (alpha < 1.0) strokes, drawing the same pixel twice causes visible darkening artifacts. Unlike opaque strokes where overdraw is invisible (pixel just gets set again to same value), alpha blending accumulates: `blend(blend(bg, color), color) ≠ blend(bg, color)`.

**Why It Matters**: The Bresenham circle algorithm with 8-way symmetry generates 8 points per iteration. At certain positions (diagonals, cardinals), multiple symmetric points map to the same pixel. Similarly, rounded rectangle strokes have edge-corner junctions and cross-corner adjacencies that can produce duplicate pixels.

**Design Philosophy**: CPU cycles for coordinate generation are nearly free; memory allocations (Set, Array) and hash operations are expensive. All techniques below use conditionals or tracking variables instead of data structures.

#### 6.5.1 Conditional Deduplication (CircleOps, ArcOps)

Used by: `CircleOps.stroke1px_Alpha()`, `ArcOps.stroke1px_Alpha()`

The 8-way symmetry of circles generates these point pairs per Bresenham step:
```
Primary points (A, C, E, G): Always unique from each other
Swapped points (B, D, F, H): Swap x/y coordinates of primaries
```

**Duplicate conditions**:
1. **Diagonal** (`bx == by`): Swapped points exactly equal primary points
   - B duplicates A, D duplicates C, F duplicates E, H duplicates G

2. **Cardinal** (`bx == 0`): Additional duplicates based on center offset:
   - When `bx == 0 && yOffset == 0`: B duplicates C (right cardinal)
   - When `bx == 0 && xOffset == 0`: D duplicates E (top cardinal)
   - When `bx == 0 && yOffset == 0`: F duplicates G (left cardinal)
   - When `bx == 0 && xOffset == 0`: H duplicates A (bottom cardinal)

**Implementation pattern**:
```javascript
// Primary points: always draw (with bounds/clip/angle checks)
drawPoint(A); drawPoint(C); drawPoint(E); drawPoint(G);

// Swapped points: conditional on bx != by plus cardinal checks
if (bx !== by) {
    if (bx !== 0 || yOffset !== 0) drawPoint(B);  // Not right cardinal
    if (bx !== 0 || xOffset !== 0) drawPoint(D);  // Not top cardinal
    if (bx !== 0 || yOffset !== 0) drawPoint(F);  // Not left cardinal
    if (bx !== 0 || xOffset !== 0) drawPoint(H);  // Not bottom cardinal
}
```

**Result**: Zero allocations, O(1) checks per Bresenham step.

#### 6.5.2 Edge Shortening + Shared Pixel Frame (RoundedRectOpsAA)

Used by: `RoundedRectOpsAA.stroke1px_AA_Alpha()` (frame sharing also by `stroke1px_AA_Opaq()`)

Axis-aligned rounded rectangles have edge-corner junctions where Bresenham edges meet quarter-arc corners. Rather than track which pixels belong to edges vs corners:

**Strategy**: Shorten edges to exclude junction pixels; corners "own" them.
```javascript
// One snapped device-pixel frame drives edges AND corner centers
const leftX = Math.floor(x);
const topY = Math.floor(y);
// Edges start 1 pixel after corner end
const horzStart = leftX + radius + 1;
const vertStart = topY + radius + 1;
// Corner centers derive from the same frame, e.g. top-left:
drawCorner(leftX + radius, topY + radius, Math.PI);
```

Combined with `lastPos` tracking within each corner arc to prevent consecutive duplicates from the arc's own Bresenham iteration.

Two exactness requirements make this junction hand-off correct for every crisp spelling (grid-centered integer AND pixel-centered `*.5` coordinates):

1. **Shared pixel frame**: edge runs and corner centers are both derived from the snapped `leftX/topY/rightX/bottomY` frame, never from the raw (possibly fractional) rect — otherwise a `*.5` spelling lands its corners one pixel inside the snapped edge lines (doubled pixels in the opaque variant, unpainted junction gaps in the shortened-edge alpha variant).
2. **Quadrant-trig snap**: each corner runs a fixed 91-step 1° sweep whose `Math.cos`/`Math.sin` values within `QUADRANT_TRIG_EPSILON` of zero are snapped to exactly zero. At the 90°-multiples the true value is 0 but the floats carry ~1e-16 noise; with integer frame-derived centers that noise sits exactly on a `Math.floor()` boundary and would shift the quadrant-endpoint (junction) pixel one unit. (The rotated variant reaches the same guarantee differently — `ArcOps.stroke1px_Opaq_Exact()`'s exact start/end angles — and arbitrary rotation keeps its junctions off the exact-quadrant ties.)

Contract tests: `tests/core/046-048` pin exact bounds, closed-ring continuity, mirror symmetry, single-blend uniformity, and byte-equivalence between fractional spellings and their snapped integer frame.

#### 6.5.3 Global lastPos Tracking (RoundedRectOpsRot)

Used by: `RoundedRectOpsRot._stroke1px_Rot_Alpha()`, `RoundedRectOpsRot._fillStroke_Rot_1px()`

**Problem**: Rotated rounded rectangles have floating-point edge endpoints and corner positions. Due to rounding, adjacent corners (e.g., TR corner end and BR corner start) can produce the same screen pixel.

**Solution**: A single `lastPos` variable that persists across ALL corners (not reset per-corner):
```javascript
let lastPos = -1;

// Process corners in order: TL → TR → BR → BL
for (const corner of [TL, TR, BR, BL]) {
    generateArcPixels(corner, (x, y) => {
        const pos = y * width + x;
        if (pos === lastPos) return;  // Skip consecutive duplicate
        lastPos = pos;
        blendPixel(pos);
    });
}
```

**Key insight**: Cross-corner duplicates happen at corner boundaries. A global `lastPos` catches them because we process corners sequentially (TL→TR→BR→BL), so the end of one corner's arc is immediately followed by the start of the next.

**Edge-corner junctions**: Pre-compute junction pixels from corners first, then derive edge endpoints from them. Edges skip junction pixels by coordinate match.

#### 6.5.4 Double-Generation Strategy (RoundedRectOpsRot)

Used by: `RoundedRectOpsRot._fillStroke_Rot_1px()`

**Problem**: `fillStroke` needs stroke pixel bounds to clamp fill extent, but also needs to render stroke pixels. Naive approach stores pixels in a Set.

**Solution**: Generate the perimeter twice instead of storing it:
```javascript
// PASS 1: Generate for bounds only (no rendering, no allocation)
for (edge of edges) generateEdgePixels(edge, recordBounds);
for (corner of corners) generateArcPixels(corner, recordBounds);

// ... render fill using recorded bounds ...

// PASS 2: Generate again for rendering (no allocation)
let lastPos = -1;
for (edge of edges) generateEdgePixels(edge, renderPixel);
for (corner of corners) generateArcPixels(corner, renderPixel);
```

**Why this works**: Perimeter generation is pure computation (Bresenham arithmetic). The cost of generating coordinates twice is far less than:
- Allocating a Set with O(perimeter) entries
- Computing hash codes for each pixel position
- Managing Set's internal hash table

**Measured impact**: Eliminates Set allocation entirely; CPU overhead of double-generation is negligible compared to memory allocation cost.

#### 6.5.5 Summary: Overdraw Prevention by Shape

| Shape | Method | Technique | Key Mechanism |
|-------|--------|-----------|---------------|
| Circle | stroke1px_Alpha | Conditional dedup | `bx != by` + cardinal checks |
| Arc | stroke1px_Alpha | Conditional dedup | Same as Circle + angle filtering |
| RoundedRect AA | stroke1px_AA_Alpha | Edge shortening + lastPos | Edges exclude junctions; corners track lastPos |
| RoundedRect Rot | _stroke1px_Rot_Alpha | Global lastPos | Single variable across all corners |
| RoundedRect Rot | _fillStroke_Rot_1px | Double-generation + lastPos | Generate twice; no Set allocation |
| Rect Rot | _stroke_Rot_1px_DDA | Seen-set (alpha only) | Edges iterate min→max, not p1→p2, so shared corner pixels are not emission-adjacent and lastPos is insufficient; opaque path stays allocation-free |

**Note**: Opaque strokes (`_Opaq` variants) don't need overdraw prevention—setting the same pixel twice to the same opaque color is visually identical and causes no artifacts.

---

## 7. Feature Comparison Summary

| Feature               | Rect | RoundRect | Circle | Line | Arc |
|-----------------------|------|-----------|--------|------|-----|
| Fill opaque           | ✓    | ✓         | ✓      | N/A  | ✓   |
| Fill alpha            | ✓    | ✓         | ✓      | N/A  | ✓   |
| Stroke 1px opaque     | ✓    | ✓         | ✓      | ✓    | ✓   |
| Stroke 1px alpha      | ✓    | ✓         | ✓      | ✓    | ✓   |
| Stroke hairline <1px (§3) | ✓ | ✓        | ✓      | ✓    | ✓   |
| Stroke thick opaque   | ✓    | ✓         | ✓      | ✓    | ✓   |
| Stroke thick alpha    | ✓    | ✓         | ✓      | ✓    | ✓   |
| fillStroke()       | ✓    | ✓         | ✓      | N/A  | ✓   |
| Rotation support      | ✓    | ✓         | N/A    | ✓    | ✗   |
| Clipping TO (respects clip) | ✓    | ✓         | ✓      | ✓    | ✓   |
| Clipping AT (defines clip)  | ✗    | ✗         | ✗      | N/A  | ✗   |
| 32-bit writes         | ✓    | ✓         | ✓      | ✓    | ✓   |
| Uses SpanOps          | ✓    | ✓         | ✓      | ✓    | ✓   |
| Bresenham algorithm   | ✗    | ✗         | ✓      | ✓    | ✓   |
| Conditional dedup     | ✗    | ✗         | ✓      | ✗    | ✓   |

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
| CircleOps          | fill_Opaq, fill_Alpha                             | stroke1px_Opaq, stroke1px_Alpha, strokeThick_Opaq, strokeThick_Alpha                                   |
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

### 8.1 Call Hierarchy System

Each *Ops file contains a **CALL HIERARCHY** header comment documenting method dependencies. This system organizes methods into layers:

| Layer | Name | Description |
|-------|------|-------------|
| **Layer 0** | Foundation | SpanOps methods and inline markers - shared horizontal span and pixel utilities |
| **Layer 1** | Primitives | Methods that call Layer 0, possibly with fallback to same-class methods |
| **Layer 2** | Internal | Underscore-prefixed internal implementations called by dispatchers |
| **Layer 3** | Dispatchers/Composites | Public methods that dispatch to internal implementations or combine multiple operations |

**Example header (from RoundedRectOpsAA.js):**
```javascript
/**
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
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

### 8.2 Parameter Order Convention

All *Ops methods follow a consistent parameter order:
```
surface, [geometry], [shape-specific], [lineWidth?], color(s), [globalAlpha?], clipBuffer
```

| Position | Parameter | Notes |
|----------|-----------|-------|
| 1 | `surface` | Always first |
| 2-4 | Geometry | Shape-appropriate: `cx, cy, radius` (circles), `x, y, w, h` (rects), `x1, y1, x2, y2` (lines) |
| Next | Shape-specific | Arc angles (`startAngle, endAngle`), corner radius, etc. |
| Next | `lineWidth` | Only for stroke operations |
| Next | Color(s) | Single `color` for fill/stroke; `fillColor, strokeColor` for combined |
| Next | `globalAlpha` | Only for `_Alpha` and `_Any` methods |
| Last | `clipBuffer` | Always last, always has `= null` default |

### 8.3 Opacity Suffix Rules

The opacity suffix determines whether `globalAlpha` is a parameter:

| Suffix | globalAlpha Parameter | Use Case |
|--------|----------------------|----------|
| `_Opaq` | Never | Caller guarantees fully opaque (color.a === 255 && globalAlpha >= 1.0) |
| `_Alpha` | Always | Semi-transparent rendering requires alpha blending calculation |
| `_Any` | Always | Internal dispatch or combined operations (see below) |

**`_Any` Suffix Usage:**

The `_Any` suffix is reserved for specific patterns:

| Pattern | Purpose | Example |
|---------|---------|---------|
| `fillStroke_*_Any` | Combined fill+stroke in single coordinated pass | `fillStroke_AA_Any`, `fillStroke_Any` |
| `*_Rot_Any` | Rotated operations with complex internal dispatch | `fill_Rot_Any`, `stroke_Rot_Any` |
| `LineOps.stroke_Any` | Special dispatcher with fallback path and boolean return | |

**Do NOT use `_Any` for simple single-operation dispatch.** Use caller-level branching instead:

```javascript
// Correct: Caller-level branching
if (isOpaque) {
    CircleOps.strokeThick_Opaq(surface, cx, cy, radius, lineWidth, color, clipBuffer);
} else {
    CircleOps.strokeThick_Alpha(surface, cx, cy, radius, lineWidth, color, globalAlpha, clipBuffer);
}
```

**Performance Note (ArcOps):** Unifying `fill_Opaq`/`fill_Alpha` and `strokeOuter_Opaq`/`strokeOuter_Alpha` into single `_Any` methods was attempted but reverted. Benchmarks showed -2.8% regression for opaque operations vs only +0.14% improvement for semi-transparent. Separate methods avoid conditionals in hot loops - the apparent "duplication" is intentional optimization.

### 8.4 Coordinate Systems by Shape

| Class | Coordinate System | Reason |
|-------|------------------|--------|
| CircleOps | Center `(cx, cy)` | Rotation-invariant, natural center |
| ArcOps | Center `(cx, cy)` | Angles defined relative to center |
| RectOpsAA | Top-left `(x, y)` | Canvas API convention for axis-aligned |
| RectOpsRot | Center `(cx, cy)` | Rotation pivot is natural at center |
| RoundedRectOpsAA | Top-left `(x, y)` | Canvas API convention for axis-aligned |
| RoundedRectOpsRot | Center `(cx, cy)` | Rotation pivot is natural at center |
| LineOps | Endpoints `(x1, y1, x2, y2)` | Natural for line segments |

---

## 9. Remaining Gaps

### Low Priority Enhancements:

1. **clipRect/clipCircle convenience methods** - Optional non-standard API additions

### Defects / inconsistencies found by the 2026-08-12 dispatch audit

Unfixed; recorded here so they are not re-discovered. Each is a candidate fix; none blocks
current consumers:

1. **FIXED (2026-08-13): `fillCircle`'s unwired opacity case.** An opaque Color under
   `globalAlpha < 1` matched neither `isOpaqueColor` (fails globalAlpha) nor
   `isSemiTransparentColor` (required `a < 255`) in `_fillCircleDirect` and dropped to the
   fallback. `isSemiTransparentColor` now also accepts `globalAlpha < 1`, dispatching the case
   to `CircleOps.fill_Alpha` like every sibling entry. Pinned by `tests/core/060`.
2. **FIXED (2026-08-13): the legacy circle/arc/line fallbacks double-applied the CTM.**
   `_fillCircleDirect`, `_strokeCircleDirect`, `_strokeLineDirect`, `fillArc`, `outerStrokeArc`
   and `fillOuterStrokeArc` fed already-device-space coordinates into the current default path,
   which bakes the live CTM again. All six sites now build an un-baked USER-space `SWPath2D`
   and pass it as an external path (the same form as the `!isUniformScale` pre-gates), so
   geometry and paint share one application of the CTM. Pinned by `tests/core/059`.
3. **FIXED (2026-08-13): `fillOuterStrokeArc` silently dropped gradient/pattern halves.** Its
   generic fallback guarded on `hasFill`/`hasStroke`, which embed `instanceof Color`, so a
   non-Color half drew NOTHING instead of falling back (both-gradient drew nothing at all).
   The fallback now recomputes presence from paint existence (`fallbackHasFill`/
   `fallbackHasStroke`). Pinned by `tests/core/061`.
4. **FIXED (2026-08-13): ctx shadows were silently dropped by the circle/arc/line direct
   paths.** `_noShadow` was only consulted by the rect/roundRect/stadium gates. The circle,
   arc and line entries' inline gates now carry the `_noShadow` term, routing any active
   shadow to the (CTM-correct) generic fallback — the same policy as the rect family; the
   direct renderers themselves still have no shadow code (deliberate: out of proportion).
   Pinned by `tests/core/063` (all seven entries).
5. **FIXED (2026-08-13): `_noShadow` used reference identity for transparency**
   (`shadowColor === Color.transparent`) while the setter builds a NEW Color for
   `'rgba(0,0,0,0)'` — an invisible shadow with non-zero blur/offset de-fast-pathed every
   rect-family draw (pure pessimization). The flag now checks `shadowColor.a === 0`, the exact
   negation of `ShadowPipeline.needsShadow`. Pinned by `tests/core/062`.
6. **FIXED (2026-08-13): `fillRect`/`strokeRect`/`strokeLine` argument-validation divergence.**
   The three entries now validate types up front (family convention: `'Rectangle coordinates
   must be numbers'` / `'Line coordinates must be numbers'`) and return-without-drawing on
   negative/zero dimensions, so success-vs-throw no longer depends on the paint source and the
   negative-dimension `strokeRect` stray-pixel bug is gone. `clearRect`'s previously-unguarded
   `transform.invert()` now returns silently under a singular CTM (like `fill()`/`stroke()`).
   NOTE the deliberate contract: the whole immediate-mode family draws NOTHING for negative
   dimensions — a documented divergence from HTML5's normalize-the-rect behaviour for the
   fillRect/strokeRect/clearRect trio, chosen for uniformity with the pre-existing
   fillStrokeRect/clearRect/roundRect/stadium convention. Pinned by `tests/core/064`.
7. **FIXED (2026-08-13): `setLineDash` was honoured inconsistently** (no-op for `strokeRect`
   on BOTH arms — its generic fallback omitted the dash fields from the stroke props — and
   ignored by every direct stroke arm). Policy decided: DASHED STROKES GATE TO THE GENERIC
   PATH. Every direct stroke arm (standalone and fused halves) declines when
   `_lineDash.length > 0`, and strokeRect's fallback now forwards the dash props, so
   setLineDash works uniformly across the immediate-mode API. Pinned by `tests/core/065`.
8. **FIXED (2026-08-13): `clearRect`'s axis-aligned test was raw `b===0 && c===0`** (no
   `TRANSFORM_EPSILON`). Now `isAxisAligned && !is90DegreeRotated` — the precomputed
   epsilon-ized equivalent (NOT plain `isAxisAligned`: that includes 90° rotations, whose axis
   swap the span loop cannot express). Sub-epsilon shears take the span loop instead of the
   per-pixel inverse-transform cliff; pixels unchanged (probe-verified pre-fix).
9. **FIXED (2026-08-13): fully-transparent paint (`a === 0`) was handled three different
   ways.** Every direct-shape entry now early-returns through `_isInvisibleDraw` (paint
   `a === 0`, or `globalAlpha === 0` with any paint — the "decide while there" half, decided
   yes). The guard is deliberately source-over-scoped: other composites can make invisible
   paint visible ('copy' clears pixels) and keep the generic pipeline. Fused entries return
   only when BOTH halves are invisible. Pinned by `tests/core/064`.
10. **DECIDED (2026-08-13): general-affine rects STAY on the generic pipeline — extension
   rejected on benchmark evidence.** The 2026-08-12 observation was correct that the quad
   machinery covers the shape: a general-affine direct arm (corner transform →
   `RectOpsRot.fill_Quad_Any` → `QuadScanOps.fillQuad`) was implemented, tested green, and
   measured with `benchmark-session.js` over 14 new `rect-affine` perf cases
   (rotation+non-uniform-scale fills, every size XXS–XXL, opaque and semi). Result: DEAD
   PARITY with the generic pipeline — 0.99x–1.02x everywhere, including the tiny-shape
   per-call-overhead case. Cause: solid-color source-over generic fills already run the
   tier-0-wired span arm (`PolygonFiller._fillPolygonsDirect`), which is direct-grade. Landing
   would have added a new dispatch surface, a new UNWIRED-clip arm (fillQuad has no clipRect
   concept), and a rasterization-convention change (fillQuad integer-scanline vs
   PolygonFiller pixel-center — three visual-output PNGs moved during the trial), for zero
   measured win — so the plan's own "if it does NOT win, record that and stop" applied and
   the src change was reverted. STROKES under general-affine CTMs stay generic for a second,
   independent reason: a non-uniform transform varies edge thickness with direction, and the
   generic stroker gives the HTML5-exact anisotropic edges (a direct arm would need four
   per-edge quads at per-edge widths). Artifacts kept: the measurement harness
   (`tests/direct-rendering/perf-cases/rect-affine-perf.js`) and a structural pin
   (`tests/core/066`) that fails if a general-affine direct arm reappears — re-attempt only
   with fresh benchmark evidence, updating the pin and this record together.
11. **DECIDED (2026-08-13): no elliptical-corner renderer — the roundRect/stadium
   `isUniformScale` gate stays.** An axis-aligned non-uniform scale of a roundRect is a
   roundRect with per-axis corner radii; supporting it directly means Bresenham ELLIPSE
   quadrants (two-region algorithm) across the whole `RoundedRectOpsAA` family — fill,
   stroke1px, strokeThick, fused, opaque/alpha variants — plus re-deriving the
   junction-exactness doctrine (tests 046–048 pin edge/arc junction pixels against ~1e-16
   trig noise at floor() boundaries) for two radii, plus the rotated/stadium delegations.
   Out of proportion for a case with a correct generic fallback and no known caller
   (Fizzygum composes only similitudes). The radii-array collapse is now DOCUMENTED instead
   (JSDoc at the three entries + the §3 RoundedRect row): first-element-wins to a uniform
   radius, integer-rounded and clamped — deliberately NOT HTML5 per-corner semantics, and
   `[a, b]` must never be reinterpreted as rx/ry (that would conflict with the spec meaning).
   The collapse is ENGINE-WIDE and consistent: `SWPath2D.roundRect()` (the path method)
   applies the same first-element-wins simplification (its JSDoc now says so too), so the
   path and immediate-mode APIs cannot disagree about what a radii array means.
12. **DECIDED (2026-08-13, re-affirming the P6 design): no `EllipseOps` direct family.**
   Circles/arcs under non-uniform scale are ellipses; all six entries route through the
   correct un-baked user-space path fallback (pinned by `tests/core/054`). A direct family
   would need two-radius Bresenham walks for fill/stroke1px/strokeThick (opaque/alpha) plus
   arc-angle filtering where the parametric angle no longer equals the geometric angle —
   a larger project than the roundRect ellipse corners (entry 11) for the same no-known-caller
   workload. The generic fallback stays the deliberate design; do not build speculatively,
   and do not duplicate the existing `ellipse()` PATH method (both API layers already have
   it — only an immediate-mode direct family is absent, deliberately).
13. **REVIEWED (2026-08-13): tier-0 clip wiring for the unwired arms — left standing.** The
   NOT-wired list (`RectOpsRot`, `RoundedRectOpsRot`, `ArcOps`, `LineOps`, `QuadScanOps`,
   `RectOpsAA.fillStroke_AA_Any`) was re-reviewed after the general-affine trial (entry 10 —
   whose rejection also removed the would-be NEW unwired quad arm). No benchmark evidence
   exists for wiring any of them: every omission is a perf loss only (the bitmask is
   materialised, correctness holds), each has a deliberate in-code note at its dispatch site
   — `fillStrokeRect`'s was the one missing and is now added — and the LineOps answer is
   pre-designed (Cohen-Sutherland endpoint clipping, `plans/clipping-optimization.md` §9
   Stage 4, itself profiling-gated: "if 1px strokes are hot"). Wire an arm only together
   with a benchmark-justified hot clipped caller.
14. **DECIDED (2026-08-13): no arithmetic micro-surgery in the BLEND_ALPHA inner loop — it
   is memory/conversion-bound, not ALU-bound.** An opaque-destination fast branch was
   prototyped in the template (when `dstA === 255`, `outA = alpha + (1−alpha)` is EXACTLY
   1.0 in IEEE doubles — Sterbenz above α=0.5, half-ulp ties-to-even below — so the branch
   collapses to a pure lerp, provably byte-identical: the full battery regenerated every
   visual PNG byte-for-byte). It removes BOTH per-pixel float divisions and two multiplies —
   and measured 0.98x on rect/roundRect fill-semi (the branch test costs more than the
   divisions saved) and 1.00x on circle fill-semi, at CV ≤ ~1%. Reading: the loop's real
   cost is four byte loads + three/four clamped stores with float→byte conversion + the
   dependent dst-alpha load; out-of-order execution hides the divide latency behind that
   traffic. Together with entry 10 this establishes the pattern: for FILLS, both per-row
   scaffolding (entry 10) and per-pixel arithmetic (this entry) are already at their
   practical floor in byte-exact vanilla JS. The remaining structural lever would be a
   PREMULTIPLIED surface format (kills the division and the per-pixel unpremultiply
   dependency) — rejected here because the non-premultiplied `Surface.data` layout is a
   public contract (getImageData, the browser-comparison harness, every pixel-probing
   test); do not re-attempt blend micro-optimizations without first changing that contract
   deliberately.
15. **DONE (2026-08-13): `Rasterizer._fillAxisAlignedRect` retired — the generic side now has
   ONE rect-fill implementation.** The engine carried THREE independent "fill an axis-aligned
   solid rect" implementations: the direct `RectOpsAA` arm, `PolygonFiller`'s tier-0-wired
   solid span arm, and a bespoke per-pixel `blendPixel` loop inside `Rasterizer.fillRect`'s
   generic route. The bespoke arm was retired for two defects, not for speed. (1) CLIP TRAP:
   its pixel loop tested only `clipMask`, never the tier-0 `clipRect` — unreachable with a
   live clipRect only because every solid source-over unshadowed fillRect took the DIRECT arm
   first; removing the direct arm (the fill-arm removal campaign, this plan's Phase B) would
   have routed tier-0-clipped solid fills into it and drawn OUTSIDE THE CLIP — the same
   partial-wiring bug class as the `6b20dcc` roundRect-fallback fix. (2) ±1 BLEND DIVERGENCE:
   it quantized `withGlobalAlpha` to a byte then `blendPixel`-lerped with `Math.round`, where
   the shared templates compute float-alpha un-premultiplied Porter-Duff stored through
   `Uint8ClampedArray` rounding — translucent fills landed ±1 different (measured: 1,295 px at
   Δ1 in one Fizzygum menu-shadow screenshot), and since SHADOWED solid axis-aligned fills
   already took the generic route, shipped SWCanvas blended the same fill differently
   depending on whether a shadow was active. Retirement (not in-place repair — the bespoke
   generation is the defect, the A1 lesson of entry 2) routes every non-clipMask,
   non-canvas-wide `Rasterizer.fillRect` through `PolygonFiller.fillPolygons`. Verified:
   integer-geometry direct-vs-generic byte-identity probe 0 px (opaque, α=128, scale(2,1);
   dispatch difference proven live via the path-based flag), full battery green, zero
   committed PNGs moved. The `_fillFullCoverCanvasWide` micro-arm (entry: BitmapText
   `source-in` tint) is byte-identical and KEPT. Plan:
   `plans/one-rect-fill-pipeline-and-fill-arm-removal.md`.

---

## 10. Code File Summary

| File                               | Purpose                                           |
|------------------------------------|---------------------------------------------------|
| src/renderers/SpanOps.js           | Shared horizontal span utilities                  |
| src/renderers/QuadScanOps.js       | Quadrilateral scanline fill (used by LineOps, RectOpsRot) |
| src/renderers/RectOpsRot.js        | Rotated rectangle renderings (called by Context2D)|
| src/renderers/RectOpsAA.js         | Axis-aligned rectangle renderings                 |
| src/renderers/CircleOps.js         | Circle direct renderings                          |
| src/renderers/LineOps.js           | Line direct renderings                            |
| src/renderers/RoundedRectOpsRot.js | Rotated rounded rectangle renderings (called by Context2D) |
| src/renderers/RoundedRectOpsAA.js  | Axis-aligned rounded rectangle renderings         |
| src/renderers/ArcOps.js            | Partial arc direct renderings                     |
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
| `strokeThick_Opaq()` | `circle-*-sw1-30px-*-sOpaq-*` tests |
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

**Dispatch-contract pins (`tests/core/`, added 2026-08-13):** the DISPATCH layer's
behaviour — which entry takes which path, and what the fallbacks render — is pinned by
core tests 059–068: 059 fallback CTM correctness (all seven circle/arc/line entries
byte-equal external-path renders), 060 fillCircle opaque+globalAlpha direct dispatch,
061 fillOuterStrokeArc non-Color fallback, 062 value-based `_noShadow`, 063 shadow
routing through all seven hand-rolled gates, 064 entry validation / invisible-draw
consistency, 065 dash gating to the generic path, 066 the general-affine
stays-generic decision pin (§9 entry 10), 067 the radii-collapse contract (§9 entry
11), 068 the fused hairline full-weight contract.

### 11.3 Optional Future Edge Case Tests

While core functions are fully covered, these edge cases could be added:

1. Near-full arcs (350°-360°)
2. Clockwise vs counterclockwise arc direction
3. Shapes larger than canvas bounds

(Sub-pixel stroke widths are no longer on this list: core test 055 pins the
hairline rule across all five stroke entries — see §3's Universal Stroke Rule.)

---

## 12. Performance Testing

Performance testing uses **parametric test generation** in `/perf-cases/` for comprehensive benchmarking coverage.

### 12.1 Performance Testing Infrastructure

**Location**: `tests/direct-rendering/performance-tests.html`

The performance testing page provides ramp-up comparison between SWCanvas Direct rendering and native HTML5 Canvas:

1. **Ramp-up methodology**: Incrementally increases shape count until frame budget is exceeded
2. **Frame budget detection**: Automatically detects display refresh rate (60fps, 120fps, etc.)
3. **Comparative metrics**: Reports maximum shapes per frame for both renderers
4. **Performance ratio**: Calculates HTML5 Canvas / SWCanvas performance ratio

### 12.2 Parametric Test Generation

Performance tests are generated using `performance-test-generator.js`:

```javascript
registerParametricPerfTests({
    baseId: 'circle',
    baseName: 'Circle',
    category: 'circles',
    operations: ['stroke-opaque', 'stroke-semi', 'fill-opaque', 'fill-semi', ...],
    drawFunction: function(ctx, instances, params) {
        // Draw `instances` shapes using params
        return null;
    }
});
```

### 12.3 Performance Test Coverage

Parametric tests cover all combinations of:
- **9 stroke width categories**: sw0, sw1px, swXXS, swXS, swS, swM, swL, swXL, swXXL
- **7 shape size categories**: szXXS, szXS, szS, szM, szL, szXL, szXXL
- **8 operation combinations**: stroke/fill × opaque/semi-transparent
- **4 arc angle categories** (arcs only): angS, angM, angL, angXL

### 12.4 Architecture Separation

| Test Type | Location | Purpose | Registration |
|-----------|----------|---------|--------------|
| Visual tests | `/cases/` | Pixel-accurate rendering verification | `registerDirectRenderingTest()` |
| Performance tests | `/perf-cases/` | Throughput benchmarking | `registerParametricPerfTests()` |

See `tests/direct-rendering/README.md` for CLI filtering options and `PERFORMANCE-BENCHMARKING.md` for measurement mechanics.

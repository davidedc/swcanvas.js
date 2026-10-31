# SWCanvas.js Direct Renderings - Comprehensive Analysis & Summary

## Executive Summary

SWCanvas implements direct renderings for 5 shape types: Rectangle, RoundedRect, Circle, Line, and Arc. Each has specialized rendering paths that bypass the general polygon filler when specific conditions are met. Plain FILLS of rect/roundRect/stadium are the deliberate exception — they always take the generic pipeline (§9 entries 15-16).

---

## 1. Direct Rendering Entry Points (Calling Functions)

| Shape                   | Entry Point                           | Path-Based Fallback         |
|-------------------------|---------------------------------------|-----------------------------|
| Rectangle Fill          | Context2D.fillRect() — NO direct arm  | rasterizer.fillRect() (always) |
| Rectangle Stroke        | Context2D.strokeRect()                | rasterizer.stroke(path)     |
| Rectangle Fill+Stroke   | Context2D.fillStrokeRect()         | Separate fill + stroke      |
| RoundedRect Fill        | Context2D.fillRoundRect() — NO direct arm | path.roundRect() + fill() (always) |
| RoundedRect Stroke      | Context2D.strokeRoundRect()           | path.roundRect() + stroke() |
| RoundedRect Fill+Stroke | Context2D.fillStrokeRoundRect()    | Separate fill + stroke      |
| Circle Fill             | Context2D.fillCircle()                | path.arc() + fill()         |
| Circle Stroke           | Context2D.strokeCircle()              | path.arc() + stroke()       |
| Circle Fill+Stroke      | Context2D.fillStrokeCircle()       | Separate fill + stroke      |
| Stadium Fill            | Context2D.fillStadium() — NO direct arm | path.roundRect(r=min/2) + fill() (always) |
| Line Stroke             | Context2D.strokeLine()                | path moveTo/lineTo + stroke |
| Arc Fill                | Context2D.fillArc()                   | path.arc() + fill()         |
| Arc Stroke              | Context2D.outerStrokeArc()            | path.arc() + stroke()       |
| Arc Fill+Stroke         | Context2D.fillOuterStrokeArc()     | Separate fill + stroke      |

All entry points are in `Context2D.js`. Use grep to find exact locations: `grep -n "methodName(" src/core/Context2D.js`

**Notes:**
- Direct rendering is available **exclusively** via dedicated methods (e.g., `fillCircle()`, `strokeRect()`). Path-based rendering (`beginPath()` + `arc()/rect()` + `fill()/stroke()`) always uses the generic polygon pipeline for consistent, predictable behavior.
- Private methods (`_fillCircleDirect`, `_strokeCircleDirect`, `_strokeLineDirect`) are internal helpers called by the public convenience methods.
- **The three plain FILL entries above have no direct arm at all** — `fillRect`, `fillRoundRect`
  and `fillStadium` always take their fallback column. Their fast paths were removed on
  benchmark evidence (§9 entries 15-16); strokes, the fused `fillStroke*` entries, and the
  circle/arc/line families keep theirs.

---

## 2. Direct Rendering Functions by Shape and Case

### 2.1 RECTANGLES (RectOpsAA.js + RectOpsRot.js)

| Stroke Width | Orientation             | Opacity          | Function                        | Clipping TO |
|--------------|-------------------------|------------------|---------------------------------|-------------|
| N/A (fill)   | Any                     | Any              | NONE - always generic (§9 entries 15-16) | via pipeline |
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
- **Plain `fillRect` has no direct arm** - the AA and rotated fill arms were removed on
  benchmark evidence (§9 entries 15-16). The fill STATICS live on as internals:
  `RectOpsAA.fill_AA_Opaq/Alpha` are called by `RoundedRectOpsAA.fillStroke_AA_Any` (and by
  its radius=0 fallback), and `RectOpsRot.fill_Rot_Any` by `RectOpsRot.fillStroke_Rot_Any`
  and `RoundedRectOpsRot`'s radius=0 fallback. They are no longer dispatch targets.
- `RectOpsAA.fillStroke_AA_Any()` uses three optimized paths:
  - **1px fast path** (`lineWidth <= 1`): Fill inner extent via SpanOps + direct 4-edge pixel stroke. No overlap exists between fill and stroke for 1px, so no composite calculation needed.
  - **5-segment path** (thick semi-transparent strokes): Pre-computed composite color for overlap regions, zero overdraw.
  - **Simple path** (opaque strokes, fill-only, stroke-only): Fill to inner extent, stroke covers its region.

### 2.2 ROUNDED RECTANGLES (RoundedRectOpsAA.js + RoundedRectOpsRot.js)

| Stroke Width | Orientation  | Opacity          | Function                               | Clipping TO |
|--------------|--------------|------------------|----------------------------------------|-------------|
| N/A (fill)   | Any          | Any              | NONE - always generic (§9 entries 15-16) | via pipeline |
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
- **Per-corner radii** (HTML5 `roundRect()` semantics, `RoundedRectUtils` documents the contract):
  every RoundedRectOpsAA entry renders them, each corner from its own radius only - a corner
  of radius r is pixel-identical to the same corner of a uniform-r rect, and a radius-0 corner
  is square (thick strokes: square outer corner, like `strokeRect`). Under a 90/180/270° CTM
  Context2D re-assigns the user corners to the device corners they land on
  (`RoundedRectUtils.deviceCornerRadii`) before handing the swapped box to the AA arm.
  RoundedRectOpsRot is **uniform-radius only**: per-corner radii under a non-axis-aligned
  rotation take the generic path (§9 entry 17). Uniform radii in any spelling (`r`, `[r]`,
  `[r, r, r, r]`) render exactly as before.
- **Plain `fillRoundRect` has no direct arm** - the dispatch ladder was removed on benchmark
  evidence (§9 entries 15-16), which left `RoundedRectOpsAA.fill_AA_Opaq/Alpha` with zero
  callers; both were DELETED. `RoundedRectOpsRot.fill_Rot_Any` survives as an internal of
  `RoundedRectOpsRot.fillStroke_Rot_Any`, not as a dispatch target.
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

### 2.3b STADIUMS (no direct renderer)

A stadium (capsule) is the w-by-h box with its shorter axis fully rounded: two
half-circle caps of radius min(w,h)/2 joined by a rectangular body, orientation
implied by the longer axis. `fillStadium` is FILL-ONLY (no stroke variants until
a caller exists) and has **no direct arm**: it builds an un-baked user-space
roundRect path at the degenerate radius r = min(w,h)/2 and fills it through the
generic pipeline under the current CTM.

It once had a dedicated `StadiumOps` renderer built on CircleOps' Bresenham extents,
because (a) a circle+rect+circle composition double-blends its overlaps at
alpha < 1, and (b) the direct roundRect arm at the degenerate radius lost the
left/right apex columns of a HORIZONTAL stadium (its corner x extents were
edge-sampled while rows were center-sampled; probed in
debug/probe-stadium-roundrect-degenerate.js). Both defects belonged to those
DIRECT arms: the generic pipeline samples pixel centers and emits one span per
row, so it has neither. `StadiumOps.js` was deleted with the other fill arms
(§9 entries 15-16); the crisp-box, symmetry, single-blend, tier-0, transform and
containment contract is still pinned by tests/core/053.

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
| Rectangle   | STROKES and the fused entry (fills are always generic). Transform: isAxisAligned OR isUniformScale. Generic ONLY when BOTH fail — a non-90°-multiple rotation combined with non-uniform scale, a SHEAR, or a mirror-with-rotation (produces a parallelogram/quad the rect renderers can't draw). NOTE isAxisAligned covers 0/90/180/270 incl. flips, so a 90°-ROTATED NON-UNIFORM CTM stays fully direct (AA arm, w/h swapped); a tilted UNIFORM CTM stays direct (Rot arm). |
| RoundedRect | STROKES and the fused entry (fills are always generic). Transform: isUniformScale REQUIRED (non-uniform would need ellipse corners → generic; ⚠ stricter than plain rects — axis-aligned `scale(2,1)` goes generic here but stays direct for Rectangle; keeping that gate is a RECORDED decision — §9 entry 11). RADII CONTRACT: HTML5 `roundRect()` semantics — a number or a list of 1-4 corner radii in CSS border-radius order, validated up front (RangeError: negative radius or bad list length; TypeError: elliptical `{x, y}` radius; NaN/infinite: draws nothing), proportionally scaled when they overlap, then rounded to integers per corner (`RoundedRectUtils.normalizeCornerRadii`). Within it, a three-arm ladder: isIdentity (literal user coords) → isAxisAligned (device coords, 90° w/h swap, corners re-assigned to the device corners) → rotated (`*_Rot_Any`, UNIFORM radii only — per-corner radii go generic, §9 entry 17). All arms are the same renderer family with numerically equivalent arguments at scale 1. |
| Circle      | Transform: isUniformScale (translate/rotate/uniform-scale go direct — pre-multiplication is byte-exact;      |
|             | test 050; NON-uniform scale gates to the generic pipeline via an un-baked user-space path, so the caller      |
|             | gets the correct ELLIPSE rather than the geometric-mean-radius circle the direct path would draw — test 054). |
| Stadium     | NO direct arm — every `fillStadium` builds a user-space roundRect path at r = min(w,h)/2 and       |
|             | fills it generically (§9 entries 15-16); there is no stroke entry.                                 |
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
| `fillRect` | NONE — always generic (fill arms removed, §9 entries 15-16) | n/a | ALWAYS (a=0 → early return, §3 Paint Alpha) | generic rasterizer (negative/zero dims and bad types validated up front — §9 note) |
| `strokeRect` | isAxisAligned OR isUniformScale | Color, a>0, source-over, `_noShadow`, no dash | gradient/pattern · composite · shadow · shear/mirror-rot/rot+non-uniform · dash set | generic (honours `lineDash`; dims/types validated up front like fillRect) |
| `fillStrokeRect` | isAxisAligned OR isUniformScale | both paints Color, source-over, `_noShadow`, something to draw | either paint non-Color · nothing to draw · composite · shadow · CTM | decomposes → `fillRect` (generic) + `strokeRect` (direct) |
| `clearRect` | n/a (`b===0 && c===0` picks span loop vs inverse-transform loop) | none | NEVER — direct-only | — (ignores alpha/composite/shadow by design) |
| `fillRoundRect` | NONE — always generic (fill ladder removed, §9 entries 15-16) | n/a | ALWAYS (a=0 → early return) | generic via external `SWPath2D`, per-corner radii included (all radii 0 → `fillRect`, itself generic) |
| `strokeRoundRect` | isUniformScale; per-corner radii also need isAxisAligned (§9 entry 17) | Color, a>0, source-over, `_noShadow`, no dash | non-Color · a=0 · composite · shadow · non-uniform scale · dash set · per-corner radii under a tilt | generic via `stroke(path)`, honours `lineDash` (all radii 0 → `strokeRect`) |
| `fillStrokeRoundRect` | isUniformScale; per-corner radii also need isAxisAligned (§9 entry 17) | both Color, source-over, `_noShadow`, something to draw | as `fillStrokeRect` + non-uniform + per-corner radii under a tilt | decomposes → `fillRoundRect` (generic) + `strokeRoundRect` (direct, or generic for per-corner radii under a tilt) (all radii 0 → `fillStrokeRect`) |
| `fillStadium` | NONE — always generic (`StadiumOps` deleted, §9 entries 15-16) | n/a | ALWAYS (a=0 → early return) | generic via external `SWPath2D` at r=min(w,h)/2 (no stroke API exists) |
| `fillCircle` | isUniformScale (pre-gate, correct external-path fallback) | Color, source-over, `_noShadow` | non-Color · composite · shadow | generic via external `SWPath2D` |
| `strokeCircle` | isUniformScale (pre-gate) | Color, a>0, source-over, `_noShadow` | non-Color · a=0 · composite · shadow | generic via external `SWPath2D` (honours cap/join/dash) |
| `fillStrokeCircle` | isUniformScale (pre-gate) | both Color, source-over, `_noShadow`, something to draw | either non-Color · composite · shadow · nothing | sequential `_fillCircleDirect` + `_strokeCircleDirect` (still direct dispatchers) |
| `fillArc` | isUniformScale (pre-gate) | Color, source-over, `_noShadow` | non-Color · composite · shadow (a=0 → early return, §3 Paint Alpha) | generic via external `SWPath2D`; the direct arm takes the combined clip mask, never the rect separately |
| `outerStrokeArc` | isUniformScale (pre-gate) | Color, a>0, source-over, lineCap 'butt', `_noShadow` | non-Color · a=0 · composite · round/square cap · shadow | generic via external `SWPath2D` (honours the cap) |
| `fillOuterStrokeArc` | isUniformScale (pre-gate) | both Color, source-over, lineCap 'butt', `_noShadow`, something to draw | either paint non-Color · composite · cap · shadow | sequential generic via external `SWPath2D` (both halves) |
| `strokeLine` | NONE — any CTM incl. shear (width via geometric-mean uniformScale) | Color, source-over, lineCap 'butt', `_noShadow` | non-Color · composite · round/square cap · shadow | generic via external `SWPath2D` (honours cap/dash; HTML5 anisotropic width under non-uniform CTM); alpha/CTM/clip never gate |
| `fillText` | direct atlas blit iff `b=c=0, a=d=dpr`, integer e/f; else intermediate buffer + `drawImage` | none (no composite/shadow/alpha/clip gate — both arms honour them via `drawImage`) | `maxWidth` → throw · gradient/pattern → ⚠ silent BLACK substitution (console.warn) | both arms mark path-based |
| `strokeText` | — | — | ALWAYS throws | — |
| `drawImage` | no direct path at all | — | always generic | rasterizer (internal source-over/opaque/1:1-scale micro-arms, same renderer). SAMPLING is its own two-arm dispatch: NEAREST-NEIGHBOR iff the draw does not resample — axis-aligned AND effective sample step = 1 (per-device-pixel source step `invA*xScale`/`invD*yScale`, where CTM scale and src/dst rect ratio COMPOSE) — else BILINEAR; `imageSmoothingEnabled=false` (per HTML5: boolean-coerced, save/restored, both API layers) forces NN for every draw. Both arms sample at the pixel centre (`Rasterizer.centreTranslation`), and the bilinear taps clamp to the image (HTML5 filtering rule) — the same decision (`Rasterizer.imageResamples`) and filter (the `FILTER_BILINEAR` inline template, expanded into the pixel loop) as pattern paint |

Clip state is NOT a dispatch condition anywhere. With no clip, the renderers do raw fills. A
clip rect means clamped extents where the rect is wired. `fillStrokeRect`, all `*_Rot_*` arms,
`ArcOps` and `LineOps` take ONE combined mask (mask ∧ rect) instead, which costs speed only. A
path clip means a per-pixel mask test INSIDE the direct renderers, on top of the rect clamp.

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

| Shape                   | Clipping TO Support | Bitmask Method            | Clip rect clamp (rect passed separately) |
|-------------------------|---------------------|---------------------------|------------------------------------------|
| Rectangle (stroke, fused) | YES               | clipBuffer per pixel      | YES                           |
| RoundedRect (stroke, fused) | YES             | clipBuffer per pixel      | YES (stroke, fused fillStroke)  |
| Circle (all)            | YES                 | clipBuffer per pixel      | YES (fill, 1px + thick stroke, fused fillStroke) |
| Line (all)              | YES                 | clipBuffer per pixel/span | NO — stroke_Any dispatches thin/thick internally and its thick diagonal branch delegates to QuadScanOps, which has no clipRect concept (comment at `_strokeLineDirect`) |
| Arc (all)               | YES                 | clipBuffer per pixel      | NO — the 1px writers bounds-check inside shared inline preprocessor templates, so a clipRect is a codegen change, not a clamp (comment at `fillArc`) |

All shapes take a `clipBuffer` parameter passed from Context2D to their respective *Ops methods. Plain
rect/roundRect/stadium FILLS are not in this table: they run on the generic pipeline, which handles
both the clipRect and the mask itself.

**Clip rect and mask (§9 entry 18)**: the effective clip is an optional immutable mask AND an always-tracked rect (`ARCHITECTURE.md` "Clip State"). Under source-over with no shadow, wired entry points get both parts separately, through `Context2D._clipRectForDraw()` and `_clipBufferForDraw()`. The renderer clamps its row, span and pixel extents to the rect and tests the mask bit per pixel. With no rect, the defaults are the surface bounds, so unclipped output is byte-identical by construction. With a rect clip alone the mask is null, and the renderer skips the bit test entirely. Unwired arms, and every draw under a canvas-wide composite op or a shadow, get one combined mask (`_combinedClipBuffer()`). The contract lives at `Context2D._clipRectForDraw`'s doc comment. Equivalence is pinned by `tests/core/049` (RoundedRect), `051` (Circle), `073` (every draw kind under mask + rect, against the `_disableTier0Clip` pure-mask oracle) and `074` (save/restore with a shared mask and the combined-mask cache). ⚠ `SpanOps` does NOT clamp — callers must keep spans inside the surface AND the clip rect (`tests/core/052` pins the off-surface containment contract for the fused circle path).

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

**Design rationale**: Direct rendering optimizes fill/stroke operations. Clip region definition is a path operation that works correctly via the existing `clip()` method with any path shape. `roundRect()` is the HTML5 path method on both API layers (per-corner radii included); a roundRect clip region exposes exactly the pixels the same roundRect fill covers (pinned by `tests/core/072`).

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
| Bresenham circle    | CircleOps.stroke1px*                     | Pixel-perfect circle outline           |
| Bresenham line      | LineOps thin strokes                     | Pixel-perfect line rasterization       |
| 8-way symmetry      | CircleOps.stroke1px*                     | Generate 8 points per Bresenham step   |
| Edge function       | RectOpsRot.fill_Rot_Any                    | Test if pixel inside rotated rect      |
| Polygon scanline    | LineOps.strokeThickPolygonScan           | Fill thick diagonal lines              |
| Sqrt-based extent   | CircleOps.fill_*, fillStroke, strokeThick | Analytical circle intersection, one sqrt per row |
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
| Two-pass rows       | QuadScanOps.fillQuad                     | Every row's exact pixel-centre span into Int32Array scratch, then the span fills: the per-row divisions pipeline |
| Edge-based DDA      | RectOpsRot._stroke_Rot_1px_DDA           | 1px rotated rect stroke aligned with fill |
| Buffer pool         | RoundedRectOpsRot (all methods)          | Growth-only Int16Array pool eliminates per-call allocations |
| Double-generation   | RoundedRectOpsRot._fillStroke_Rot_1px    | Generate perimeter twice instead of storing in Set |
| lastPos tracking    | RoundedRectOpsRot._stroke1px_Rot_Alpha, _fillStroke_Rot_1px | Prevent consecutive overdraw for semi-transparent |

### 6.4 Special Optimizations

| Optimization         | Where                                                          | Description                                        |
|----------------------|----------------------------------------------------------------|----------------------------------------------------|
| Epsilon contraction  | CircleOps.fillStroke, RoundedRectOpsAA.fillStroke          | FILL_EPSILON = 0.0001 prevents boundary speckles   |
| Line extend/shorten  | RectOpsRot.stroke_Rot_Any                                        | Proper miter corners for thick rotated rect stroke |
| Pixel-centre frame   | CircleOps/ArcOps fills, thick strokes, fused                   | cX = cx - 0.5: each pixel is tested at its centre (the 1px Bresenham strokes walk integer centres, floor(cx)) |
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
| Fill opaque           | ✗ (generic) | ✗ (generic) | ✓  | N/A  | ✓   |
| Fill alpha            | ✗ (generic) | ✗ (generic) | ✓  | N/A  | ✓   |
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
| RectOpsAA            | fill_AA_Opaq, fill_AA_Alpha (internals — no dispatch) | stroke1px_AA_Opaq, stroke1px_AA_Alpha, strokeThick_AA_Opaq, strokeThick_AA_Alpha                   |
| RectOpsRot        | fill_Rot_Any (internal — no dispatch)             | stroke_Rot_Any                                                                                         |
| RoundedRectOpsAA     | — (fill_AA_* DELETED, §9 entries 15-16)           | stroke1px_AA_Opaq, stroke1px_AA_Alpha, strokeThick_AA_Opaq, strokeThick_AA_Alpha                       |
| RoundedRectOpsRot | fill_Rot_Any (internal — no dispatch)             | stroke_Rot_Any                                                                                         |
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
   (Fizzygum composes only similitudes). The radii-array half of this entry - a documented
   first-element-wins collapse to one uniform radius - is SUPERSEDED by entry 17 (per-corner
   HTML5 radii, owner-requested for window title bars). What still stands: no ellipse
   renderer, so elliptical corners from a non-uniform CTM stay generic, and an elliptical
   `{x, y}` radius is rejected (TypeError) rather than read as rx/ry - `[a, b]` means
   per-corner, exactly as in HTML5.
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
16. **DONE (2026-08-13): all four parity FILL fast paths removed — rect, roundRect and stadium
   fills are now uniformly generic.** Disable-and-benchmark (12 super-measurements, CV ≤ ~1%,
   dispatch difference proven live via the path-based flag on both dists; ratio = generic/fast
   median, >1 means the arm wins) measured: axis-aligned rect fill 1.02x opaque / 1.02x semi
   (worst single case 1.06x, szS semi); tilted rect fill 1.00x / 1.01x; roundRect fill 1.00x on
   every case, AA and rotated. Stadium has no perf case by design — its algorithm class (span
   walk + cap geometry) is roundRect's, so parity holds by proxy. **The AA rect arm's 2–6% edge
   on small/mid alpha fills is a real cost the owner explicitly accepted** for one fill
   implementation. Removed: `fillRect`'s AA+rot dispatch block, `fillRoundRect`'s
   identity→AA→rot ladder, `fillStadium`'s block, and — left callerless by the ladder —
   `RoundedRectOpsAA.fill_AA_Opaq/Alpha` plus the whole of `StadiumOps.js`. Kept as internals
   (no longer dispatch targets): `RectOpsAA.fill_AA_*` (fused arm, roundRect radius=0),
   `RectOpsRot.fill_Rot_Any` and `RoundedRectOpsRot.fill_Rot_Any` (fused arms, radius=0
   fallbacks). Strokes, fused `fillStroke*` entries and the circle/arc/line families are NOT
   affected and NOT on the same evidence — they avoid geometry construction the generic path
   must do, and the fused arms are seam-prevention correctness features (§5 of the plan).
   CONVENTION CHANGES this ships, both eyeballed before landing: (a) translucent fills under
   `globalAlpha < 1` move ±1 — the direct arms composed effective alpha in float
   (`(color.a/255)*globalAlpha`), the generic pipeline quantizes to a byte first
   (`Color.withGlobalAlpha`), which is what every path fill, gradient and stroke already did, so
   fills CONVERGE on the engine's dominant convention (fillStyle alpha alone is byte-identical
   across all 255 values — probe-isolated); (b) rotated fills, roundRect corners and stadium
   caps move by boundary hairlines (integer-scanline/Bresenham vs pixel-center sampling).
   Inverted pins now force this conversation before any re-addition: `tests/core/066` (fillRect
   generic under every CTM class) and `tests/core/069` (all three fill entries generic while
   their stroke/fused siblings stay direct). Do not re-add a fill fast path without fresh
   §2.1-grade benchmark evidence. Plan:
   `plans/one-rect-fill-pipeline-and-fill-arm-removal.md`.
17. **DONE (2026-10-15): per-corner roundRect radii (HTML5 semantics), owner-requested for
   window title bars - supersedes entry 11's radii collapse.** Every roundRect entry point
   reads radii as HTML5 `roundRect()` does (`RoundedRectUtils` holds the contract: 1-4 radii
   in CSS border-radius order, proportional overlap scaling, RangeError/TypeError/no-draw
   validation, circular corners only), and `roundRect()` itself is new on both API layers.
   Dispatch, by arm:
   - **Axis-aligned direct arm (RoundedRectOpsAA): per-corner.** Identity, uniform scale and
     the quarter turns (whose w/h swap now carries a corner re-assignment,
     `RoundedRectUtils.deviceCornerRadii`). Each corner is rendered from its own radius only -
     a corner of radius r is pixel-identical to that corner of a uniform-r rect (pinned by
     `tests/core/071`), radius 0 is square (square outer stroke corner, like `strokeRect`).
     Two guards exist only for per-corner radii and are inert for uniform ones: the 1px arcs
     are clamped to the pixel frame (one corner may hold a whole side), and a single inner arc
     too small to reach its band row (r - halfStroke <= 0.25px) no longer blanks that whole
     row of the hole (uniform radii keep the historical whole-row rule).
   - **Rotated direct arm (RoundedRectOpsRot): uniform radius only.** Per-corner radii under a
     non-axis-aligned rotation take the generic path. MEASURED (benchmark-session, 12
     super-measurements, CV <= ~1.5%; `roundrect-rot-corners-perf` vs `roundrect-rot-perf`,
     identical seeded geometry with radii [r, r, 0, 0] vs r): strokes 7.8x slower geomean on the
     generic path (1px: 27-72x, 5-10px: 8-22x, fill+stroke pairs 2.4-7.6x); fills unaffected
     (generic either way - per-corner fills are even 0.79x, square corners flatten to fewer
     segments). Kept generic on the entry-11/12 reasoning: correct fallback, no caller -
     Fizzygum rotates through island buffers composited by `drawImage`, so its rounded rects
     are always drawn axis-aligned. Revisit trigger: a caller stroking per-corner rects under
     a tilt. The probable optimum - making `RoundedRectOpsRot` per-corner the way
     RoundedRectOpsAA is, and how to prove it - is written up in that class's header.
   - **Fills: unchanged** - always generic (entries 15-16).
   - **Reflections** (`scale(-1, 1)` etc.) were never `isUniformScale`, so they stay generic
     for uniform and per-corner radii alike.
   Cost on the axis-aligned arm: per-corner [r, r, 0, 0] vs uniform r is 0.77x geomean
   (`roundrect-aa-corners-perf` vs `roundrect-aa-perf`; square corners skip their arcs).
   Uniform radii: BYTE-IDENTICAL in every spelling (`r`, `[r]` ... `[r, r, r, r]`) on every
   entry point, CTM class, clip kind, width, opacity, dash and cap -
   `debug/sweep-roundrect-uniform-radii-ab.js` over 20,000 seeded cases against the
   pre-change dist gives diffs=0 (66 diffs when a non-uniform spelling is planted). Uniform
   speed: a first cut cost +3.9% geomean on the AA family (up to +12% on small 1px/thick
   strokes) from per-call arrays; uniform radii now travel as one number end to end, the
   renderers read fitted radii from module-level scratch arrays, and the generic fallbacks
   build their private path without re-parsing, and `_getXExtent` takes one sqrt when both
   ends of a row sit on mirror-image arcs. Re-measured interleaved old/new over the same 42
   configs: AA family 1.004x geomean (strokes 1.005x, fills 0.998x), rotated family 1.004x.
   Residual, accepted: the cheapest OPAQUE AA strokes (1px, and 5-10px on the smallest
   shapes) run 3-5% slower in the MINIFIED build only - the unminified build runs them at
   0.97x, so it is terser code shape, not added work (absolute: ~0.1-0.3 us per call).
   Pins: `tests/core/067` (the contract on all five entry points), `071` (direct-arm
   invariants), `072` (clipped and clipping); visual 210-212; the `rrrCorner` direct-rendering
   cases.
18. **DONE (2026-10-17): the clip is an optional IMMUTABLE mask AND an always-tracked rect,
   and a rect clip never touches the mask.** Asked for by Fizzygum's rounded-window clip, which cost
   +7 % (dpr 1) and +12 % (dpr 2) of its suite time. Four costs drove it:
   - A rect clip under an installed mask took the mask path: a canvas-sized allocation, two
     fills, a rect raster and a canvas-sized AND.
   - A non-rect clip after a rect materialised the rect as a canvas-sized mask, then rasterised
     the WHOLE path.
   - `save()` deep-cloned the mask.
   - Draws under a mask lost the rect clamp.

   The model now (`ARCHITECTURE.md` "Clip State"):
   - A rect `clip()` only intersects `_clipRect`.
   - A non-rect `clip()` rasterises its path only inside the rect, into a fresh mask, and ANDs
     the old mask into it over the rect's rows.
   - Installed masks are immutable and shared by reference across save/restore.
   - Under source-over with no shadow, a draw gets the rect and the mask separately. Otherwise it
     gets one combined mask, cached per (mask, rect) pair. Every `clip()` drops the cache, and
     save/restore carry it with its pair.

   Byte identity is pinned against the `_disableTier0Clip` pure-mask oracle:
   - `tests/core/073` covers every draw entry; Fizzygum's corner pattern, 1920x880 included;
     mask/rect sequences under evenodd and nonzero; rotated, off-surface and empty rects; nine
     composite ops; and shadows.
   - `tests/core/074` covers restore exactness at every depth, the stale combined-mask trap,
     and shared-mask immutability.
   - All 888 renders of 073/074 also equal the pre-change bundle (60e7e3e), unminified and
     minified.
   - Fault planting caught ten seeded defects. Among them: a stale cache across `clip()` or
     `restore()`, an installed mask mutated in place, a rect clip replacing instead of
     intersecting, an off-by-one row-ranged AND and an off-by-one bound clamp.

   MEASURED:
   - Fizzygum's suite with its rounded-window clip on: +0.16 % (dpr 1) / +1.87 % (dpr 2) busy
     time, down from +7 % / +12 %. Every one of its 972 shots per run is identical to the
     pre-change engine, with the clip on and off.
   - Pattern micro-bench (4 corner pieces x 10 children under a radius-8 outline clip,
     interleaved old/new): -99.3 % (dpr 1) / -99.4 % (dpr 2) with corner-sized damage, and
     -69 % to -80 % with quadrant-sized damage.
   - Rect-only save/clip/fill/restore: unchanged (0.97-1.00x).
   - Unclipped families: within noise. In-process interleaved checks give 0.993-1.009x. The
     benchmark-session pairs (circle 42 configs 1.003x geomean, rect 7 configs 1.012x) ran
     under external load, so they bound the change rather than measure it.

   Residual, accepted: the buffer-only arms (entry 13) and `clearRect` still allocate one
   canvas-sized combined mask per (mask, rect) state they draw under. That is a cache now, never
   installed. The "fused" bench rows show it: 1.5 ms vs 0.25 ms per corner scene at dpr 1.
   Giving those arms the rect stays entry 13's decision.

### Correctness arc (2026-10)

19. **DONE (2026-10-27): rounded-rect row extents — an empty row is an interval, and columns
   sample pixel centres.** `RoundedRectOpsAA` returns a row with no columns as the EMPTY interval
   `{leftX: 0, rightX: -1}` (`rightX < leftX`), never a marker coordinate, so an extent may start
   at a negative x and every caller tests `rightX < leftX`. (The `-1` marker this replaces collided
   with a real extent at x = -1 at eight sites; the fused arm lost fill rows there.) Columns are
   sampled at pixel centres like rows (`ceil(x - 0.5 ± epsilon)`), so a thick ring is exact and
   symmetric under transposition. Pinned by `tests/core/076` (position invariance off every side,
   lw 1-7, fused included) and `077` (the exact ring and transpose symmetry). Residual, accepted by
   the owner: opaque `fillStrokeRoundRect` costs +2-5% (identical span counts; the cost is code
   shape, and Fizzygum never calls `fillStroke*`).
20. **DONE (2026-10-27): a stroke is the union of its parts, and its seams are shared.**
   - Every `StrokeGenerator` part (bodies, joins, caps) is wound like the segment bodies
     (`_windLikeBodies`), so overlapping parts of one `stroke()` add rather than cancel under
     nonzero.
   - A join's point is a vertex of both adjoining bodies' end edges, so a join and its bodies
     share their seam exactly and no pixel centre on it is left unpainted. (Exact seams are what
     let entry 35 fill a stroke as its outline.)
   - Miter and bevel joins split the connecting area at the join point. The outer half is the
     bevel triangle, or merges with the miter triangle into one convex kite (miter 4 vertices,
     bevel 3). The inner half is emitted only when the two segments' lengths sum to less than
     `halfWidth·|sin turn|` (`_innerTriangleUncovered`); otherwise it lies inside the union of the
     two bodies.
   - A round join is one pie from the join point whose rim ends are the bodies' outer corners, plus
     the inner half under the same rule as miter and bevel (entry 33); a round cap is one
     half-disc polygon on the body's own end edge.
   - Round caps and joins are flattened to within 0.25 device px of their circle, and never with
     fewer than one chord per 45° (`_roundSegments`).
   - `strokeLine` (butt) and `strokeRect` under a rotation sample pixel centres exactly as
     `stroke()` does (`LineOps`, `QuadScanOps`).

   Pinned by `tests/core/078`, `079` and `094`-`096`.
21. **DONE (2026-10-27): the generic filler — one crossing per shared edge, active edges only,
   and only exactly horizontal edges skipped.**
   - Each scanline crossing is interpolated from the edge's upper end, whichever way the polygon
     runs it, so an edge two polygons share crosses at the bit-identical x and the two spans meet
     exactly. One crossing routine serves fills, strokes and clip masks, and an edge and its
     parallel twin resolve exact pixel-centre ties the same way (visual 212's 45° stripes are
     exactly 6 px wide).
   - Per row the filler visits only the edges that cross it: an edge table ordered by first row
     (`PolygonFiller._beginScan`), an active list kept in the previous row's crossing order, and
     crossings ordered by (x, table position) (`_scanRow`). There is no per-row allocation, and
     the pixels are byte-identical to testing every edge every row.
   - Only EXACTLY horizontal edges are skipped (`_beginScan`, `isPointInPolygons`,
     `QuadScanOps`): a near-horizontal edge is the only edge covering its sliver of y, so
     skipping it would drop every crossing in a row.

   Pinned by `tests/core/079` and `090`.
22. **DONE (2026-10-27): circles sample pixel centres, and non-finite radii draw nothing.**
   `fillCircle` (and a full-circle `fillArc`, which delegates to it) fills a pixel iff its centre
   lies strictly inside the circle (`FILL_EPSILON`-contracted). That is the fused
   `fillStrokeCircle` fill's rule, so the two are pixel-identical; Bresenham `generateExtents` is
   deleted. The fill computes every row's span bounds first (one sqrt per row, into `Int32Array`
   scratch), then fills them in an integer-only loop. All six circle/arc entries draw nothing for
   NaN or infinite radii (`strokeCircle(Infinity)` used to hang). Pinned by `tests/core/080` and
   `087`.
23. **DONE (2026-10-27): curve segment counts are float-noise-proof.** Every count goes through
   `PathFlattener.segmentCount(q) = max(1, ceil(q - 1e-9))`: the arc/ellipse/arcTo flatteners,
   Context2D's baking twins, and the stroker's round joins and arc rims. An exact quarter-turn
   `arcTo` corner arrives from atan2 as 16.000000000000004 at some positions, where a bare ceil
   gives it 17 segments and the corner's pixels depend on position. Pinned by `tests/core/081`.
24. **DONE (2026-10-27): the `(path?, fillRule?)` overloads.** The Core API dispatches HTML5's
   overload by type: a leading string is the fill rule, and an explicit `undefined` counts as
   omitted, for `fill()`, `clip()` and three-argument `isPointInPath()`; the facade forwards
   unchanged. DELIBERATELY lenient: an unknown rule string fills and clips nonzero where WebIDL
   throws a TypeError, and `stroke(non-Path2D)` and `clip(undefined, rule)` stay lenient the same
   way. Pinned by `tests/core/082` and visual 213.
25. **DONE (2026-10-27): one image-sampling rule for `drawImage` and patterns.**
   - `drawImage` follows HTML5's rectangle rules: negative sw/sh/dw/dh name the same rect from the
     opposite corner, drawn unmirrored; a zero-size source rect paints nothing; a source rect
     reaching outside the image is clipped to it, and the destination in proportion; one wholly
     outside paints nothing. None of these throws.
   - `Rasterizer.imageResamples` decides and the `FILTER_BILINEAR` inline template filters, for
     both: the nearest texel iff the device→image mapping is axis-aligned with step exactly 1, else
     bilinear at the pixel centre, premultiplied, unless `imageSmoothingEnabled` is false. The
     decision is taken once per draw, or per fill transform. The filter is expanded into each
     sampler at build time (`build-scripts/templates/sampling.js`): V8 does not inline a function
     that size, and a call per pixel costs a fifth of a filtered draw.
   - Every pixel is decided at its centre: the pixel index goes through the inverse with the
     (0.5, 0.5) offset folded into the translation (`Rasterizer.centreTranslation`). Containment
     follows the fill rule and nearest-neighbour takes the texel under the centre, so a plain blit
     keeps its texels exactly and a non-power-of-two scale (dpr 3, a 3× zoom) cannot round a
     corner sample across a texel edge.
   - `drawImage`'s bilinear taps clamp to the edge texel outside the image, and read the image's
     own texels outside the source rect. A pattern's taps wrap on a repeating axis and read
     transparent past a non-repeating border. A pattern's mapping is the CTM × its `setTransform`;
     the context binds its smoothing flag through `Pattern.withSmoothing`, a memoized twin; and a
     pattern snapshots its image's pixels at `createPattern` (one copy, shared by `setTransform`
     copies and twins).
   - Edges follow pixel-centre containment; native's geometric edge coverage is deliberately not
     reproduced. An image drawn piecewise equals the whole up to 1 level of float rounding at
     8-bit ties.

   Pinned by `tests/core/083`, `084`, `086`, `088` and `093`, and visual 215.
26. **DONE (2026-10-27): gradients and patterns are evaluated in paint space.** Each device pixel
   CENTRE is mapped through the inverse CTM, cached per frozen `Transform2D` (on the gradient's own
   fields, or on the pattern's memo), so radii, angles and isolines transform with the CTM under
   any affine. The radial gradient is the HTML5 two-circle cone: the largest ω with r(ω) ≥ 0, and
   transparent outside the cone. A zero-length linear gradient or two identical radial circles
   paint nothing, and creating them does not throw. Pinned by `tests/core/085` and `086`, and
   visual 214.
27. **DONE (2026-10-27): the compat facade's DOM image sources follow HTML5.** A DOM image source
   with no pixels asks the platform canvas (a 1×1 `drawImage`), which throws `InvalidStateError`
   exactly when HTML5 does (a broken image, a zero-size canvas); otherwise `drawImage` draws
   nothing. Compat `createPattern` resolves its source through `_toImageLike`, so it takes every
   source `drawImage` takes; a source with nothing to draw yet gives `null`. Pinned by
   `tests/core/041` and `089`, which run in the browser (`testRequiring('dom', …)`).
28. **DONE (2026-10-27): degenerate curves and the Path2D `ellipse()` subpath.** A Bézier whose
   ends coincide measures its flatness by its control points' distance from the end point, so a
   closed cubic loop is drawn and a point-sized quadratic does not recurse until the stack
   overflows. A Path2D `ellipse()` that opens a subpath starts it, as `arc()` does, so
   `closePath()` returns to the ellipse's start rather than to (0, 0). Pinned by
   `tests/core/091` and `092`.
29. **DONE (2026-10-27): shadows conserve coverage.** A shadow's coverage buffer is blurred by
   three box passes whose mixed odd widths (P. Kovesi, "Fast Almost-Gaussian Filtering", 2010)
   come closest to the HTML5 sigma = shadowBlur / 2. Each pass counts samples beyond the buffer as
   transparent and divides by a fixed 2r+1, so the blur conserves coverage, and the buffer is
   padded by the passes' full reach (`BoxBlur.spread`). A shadow pixel's alpha is the coverage
   (globalAlpha in it once) times the shadow colour's alpha, with no calibration factor (the ×8
   factor this removes made a 0.5-alpha shadow paint 255 where HTML5 paints 128). Pinned by
   `tests/core/097`.
30. **DONE (2026-10-27): `drawImage` under canvas-wide composites.** Under `copy`, `source-in`,
   `source-out`, `destination-in` or `destination-atop`, `drawImage` draws the image source-over
   into a transparent layer the size of the surface, then composites that layer over every pixel
   the clip lets through, so outside the image and under alpha-0 texels the operator sees a
   transparent source, as the fill path does. Every other composite blends the image's own pixels
   only. Pinned by `tests/core/098`.
31. **DONE (2026-10-27): source-over and destination-over onto translucent pixels.** The surface
   holds straight RGBA, so where the destination is translucent its colour counts in proportion to
   its own alpha, and the mix is divided by the result's alpha (Porter-Duff over). An opaque
   destination keeps the plain mix, which that formula reduces to there (byte-identical), and an
   empty one takes the source unchanged. Every source-over writer applies it: `PolygonFiller`'s
   span and pixel templates, `drawImage`'s inline blend and `CompositeOperations`. Pinned by
   `tests/core/099`.
32. **DONE (2026-10-28): a stroke paints the same pixels wherever a whole-pixel translation puts
   it.** `StrokeGenerator` strokes a path relative to the floor of its first point, and
   `PolygonFiller` fills the parts in their device frame: every vertex is placed from the device
   pixel that anchor lands at (`deviceAnchor`, `_toDeviceFrame`). A stroke moved by whole pixels,
   by `translate()` or by its own coordinates, is then computed from the same small numbers and
   covers the same pixels, ties included (a pixel centre exactly on an edge, which rounding at the
   stroke's absolute magnitude would otherwise decide). `strokeLine` takes its endpoints in the
   same frame, so it still paints what `stroke()` paints, and `isPointInStroke` answers in the
   frame its stroke is painted in.
   - Fills, clips and `isPointInPath` keep absolute device arithmetic. A fill's vertices are often
     computed by the caller at the device position, and absolute arithmetic re-rounds them at that
     same magnitude; a device frame there made such a fill depend on position where it had not.
     Translation-free fills need the path stored translation-free first (the default path is kept
     in device space).
   - The rotated `strokeRect` (`RectOpsRot`) is not framed.

   Pinned by `tests/core/100`.
33. **DONE (2026-10-28): round joins cover their inner side.** A round join adds the inner
   triangle [join point, inner corner of the first body's end, inner corner of the second body's
   start] under the same rule as miter and bevel joins (`_innerTriangleUncovered`), so the join
   kind never changes what a thick stroke on a tight curve paints on its inner side. Pinned by
   `tests/core/101`, and shown end to end by visual test 216 (`tight-curve-strokes-join-inner-side`):
   arc, ellipse, cubic and quadratic hairpins and an arcTo corner, stroked 30 px wide with round,
   miter and bevel joins side by side.
34. **DONE (2026-10-31): the arc's speed, measured — three code costs taken back, the new work
   kept.** Benchmarked interleaved (old, new, new, old) on a quiet machine on mains power, against
   an A/A of the baseline with itself within 2.2%. Every family that moved was attributed to one
   change by a per-change chain whose product reproduces the cumulative ratio, and its work was
   counted, so a slowdown that paints more is told from slower code.
   - Faster than before the arc for the same work: curves 0.37×, rotated corners 0.34×,
     rounded-rect fills 0.43×, polylines 0.36–0.75×, gradients 0.59×, rotated rects 0.67×, affine
     controls 0.58×; opaque circle fills 0.98×.
   - Three families were slower for the same work; each is taken back without moving a pixel
     (871 benchmark configurations, 37,680 frames, byte-identical surfaces):
     - bilinear `drawImage` (+16–26%): the filter (entry 25) was a function V8 does not inline,
       called once per pixel. It is the `FILTER_BILINEAR` inline template now. Bilinear draws
       run 0.89–0.98× the time they took before the arc; smoothed patterns gain the same.
     - thick diagonal `strokeLine` (+5–10%) and rotated-rect strokes (+3–4.5%): entry 20's exact
       pixel-centre crossings. `QuadScanOps.fillQuad` computes every row's span into scratch
       first and then fills the spans, and keeps no per-row array: thick lines run 0.41–0.49×,
       thin translucent ones 0.56–0.65× and the thick rotated-rect strokes 0.44–0.47× the time
       they took before the arc.
     - polyline strokes (+4.5% over entry 32's own step): the anchor copied every flattened
       point; it shifts them in place. Of what remains, round joins at large widths on short
       segments cost +8–13% — the inner triangles of entry 33; with them switched off the same
       configurations cost +1.4% — and every other configuration +1–2%, inside the noise. Entry
       35 takes that cost back, and more.
   - Residual, accepted by the owner — each is work the old engine skipped: small
     semi-transparent circles cost +7–26% (XXS–S; entry 22: it painted 58–91% of the true area);
     a smoothed pattern costs 1.24–3.24× (entry 25: it always took the nearest texel); the fused
     rounded-rect arm's left-edge configurations cost 2.7–3.9× (entry 19: it painted no pixel
     there).
35. **DONE (2026-10-31): a stroke is filled as its outline.** `StrokeGenerator` emits each
   subpath as ONE polygon — two for a closed path, its + and − sides — plus the parts that
   polygon does not absorb, instead of one polygon per body, join and cap.
   - The outline walks the bodies' + sides forward and their − sides back. On a join's outer side
     it follows the join's rim (the round pie's arc, the miter kite's point, the bevel's chord),
     around a cap the cap's rim, and on a join's inner side it goes through the join point along
     the bodies' inner half edges (`_outlineJoin`, `_outlineCap`).
   - The seams entry 20 made exact — a join's two straight sides on the bodies' outer half edges,
     a cap's base on a body's end edge — run once each way between the same two points. Such a
     pair crosses every row at the same x with opposite windings (entry 21), so no pixel depends
     on it, and the outline leaves both out (`_spliceRim`). A part whose seam does not run exactly
     opposite (a degenerate join, rounded the other way) stays a polygon of its own and the
     outline takes the body's edges there instead. The edges filled are therefore the parts' own
     less exact opposite pairs, and the pixels are identical by construction.
   - The inner triangles (entries 20 and 33) stay separate parts: their sides run the same way as
     the bodies', so nothing cancels — which is also why no smaller triangle paints the same
     pixels, and why merging one into its pie (same edges, one polygon fewer) saves nothing.
   - Proved by equal edge multisets (exact opposite pairs removed) on 200,000 random strokes —
     every cap and join, dashes, closed paths, reversals, duplicate points, scales 0.5–3 — and by
     byte-identical surfaces on 4,376 benchmark configurations (175,040 frames).
   - `isPointInStroke` answers as before at 108 million probed points (vertices, edge midpoints,
     points 1e-9 and 1e-6 off them, part centroids) but one: a point 1e-9 OUTSIDE a square cap's
     corner, which the cancelled seam's `FLOAT_EPSILON` reach along its own line used to count as
     on an edge. It now answers outside, the exact answer.
   - The filler visits 0.57–0.76× the edges per row on thick strokes, and the time follows,
     against entry 34's engine: polylines 0.61–0.87× (every configuration; thick round joins on
     short segments 0.66–0.70×, i.e. 0.71–0.79× the engine before entry 33's triangles), curve
     strokes 0.62–0.82×, rotated rounded-rect strokes 0.67–0.83× opaque and 0.68–0.85×
     translucent.

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

All 34 documented direct rendering functions have **100% explicit test coverage** (two of them, `RoundedRectOpsAA.strokeThick_AA_*`, through core tests only — §11.1) via dedicated
tests in `tests/direct-rendering/cases/`. Three of them (`RectOpsAA.fill_AA_Opaq/Alpha`,
`RectOpsRot.fill_Rot_Any`) are no longer DISPATCH targets since the fill-arm removal (§9 entries
15-16) — they survive as internals of the fused/radius-0 paths and are covered through those
entries. `RoundedRectOpsAA.fill_AA_Opaq/Alpha` were deleted outright, and `StadiumOps` with them.

### 11.1 Coverage Matrix

#### RECTANGULAR (RectOpsAA.js + RectOpsRot.js) - 9/9 Functions Covered (6 dispatched + 3 internal)

| Function | Test File(s) |
|----------|--------------|
| `RectOpsAA.fill_AA_Opaq()` *(internal)* | via `RoundedRectOpsAA.fillStroke_AA_Any` radius=0 and the fused rect arm — `rect-*-fSemi-sMix-*` tests |
| `RectOpsAA.fill_AA_Alpha()` *(internal)* | same, alpha variants |
| `RectOpsRot.fill_Rot_Any()` *(internal)* | via `RectOpsRot.fillStroke_Rot_Any` / `RoundedRectOpsRot` radius=0 — `rect-sgl-szMix-fOpaq-sOpaq-*-ctxRotRand-test.js` |
| `RectOpsAA.stroke1px_AA_Opaq()` | `rect-sgl-szMix-fNone-sOpaq-sw1px-*` tests |
| `RectOpsAA.stroke1px_AA_Alpha()` | `rect-sgl-szMix-fNone-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp-ornAxial-test.js` |
| `RectOpsAA.strokeThick_AA_Opaq()` | `rect-*-sw1-10px-*-sOpaq-*` tests |
| `RectOpsAA.strokeThick_AA_Alpha()` | `rect-*-sw1-10px-*-sSemi-*` tests |
| `RectOpsRot.stroke_Rot_Any()` | `rect-sgl-szMix-fOpaq-sOpaq-*-ctxRotRand-test.js` |
| `RectOpsAA.fillStroke_AA_Any()` | `rect-*-fSemi-sMix-*` tests |

#### ROUNDED RECTANGLES (RoundedRectOpsAA.js + RoundedRectOpsRot.js) - 8/8 Functions Covered (7 dispatched + 1 internal)

| Function | Test File(s) |
|----------|--------------|
| `RoundedRectOpsRot.fill_Rot_Any()` *(internal)* | via `RoundedRectOpsRot.fillStroke_Rot_Any` — `roundrect-sgl-szRand-fOpaq-sSemi-*-ornRot-*` tests |
| `RoundedRectOpsAA.stroke1px_AA_Opaq()` | `roundrect-*-sw1px-*-sOpaq-*` tests |
| `RoundedRectOpsAA.stroke1px_AA_Alpha()` | `roundrect-sgl-szMix-fNone-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp-ornAxial-rrrRand-test.js` |
| `RoundedRectOpsAA.strokeThick_AA_Opaq()` | core tests 049, 055, 065, 067, 069, 071–073, 076 and 077 only: the direct `roundrect-*-sw1-11px-*` cases call `fillStrokeRoundRect`, which reaches `fillStroke_AA_Any` |
| `RoundedRectOpsAA.strokeThick_AA_Alpha()` | the same core tests only (the `roundrect-m6-*`/`m8-*` cases reach `fillStroke_AA_Any` too) |
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
| Rectangle | 9 (6 dispatched + 3 internal) | 9 ✓ |
| RoundedRect | 8 (7 dispatched + 1 internal) | 8 ✓ |
| Circle | 7 | 7 ✓ |
| Line | 5 | 5 ✓ |
| Arc | 8 | 8 ✓ |
| **Total** | **37** | **37 ✓** |

**Test Suite Statistics:**
- **Test files** in `tests/direct-rendering/cases/` (counts: tests/README.md)
- Each case runs 5 iterations with `-i 5`
- Run command: `node tests/direct-rendering/run-direct-rendering-tests.js -i 5`

**Dispatch-contract pins (`tests/core/`, added 2026-08-13):** the DISPATCH layer's
behaviour — which entry takes which path, and what the fallbacks render — is pinned by
core tests 059–069: 059 fallback CTM correctness (all seven circle/arc/line entries
byte-equal external-path renders), 060 fillCircle opaque+globalAlpha direct dispatch,
061 fillOuterStrokeArc non-Color fallback, 062 value-based `_noShadow`, 063 shadow
routing through all seven hand-rolled gates, 064 entry validation / invisible-draw
consistency, 065 dash gating to the generic path, 066 fillRect generic under EVERY CTM
(the fill-arm-removal pin, §9 entries 15-16), 067 the per-corner radii contract on every
roundRect entry point (§9 entries 11 and 17), 068 the fused hairline full-weight contract,
069 the three fill entries' inverted pin — fillRect/fillRoundRect/fillStadium all dispatch
generic while their stroke and fused siblings stay direct (§9 entries 15-16). Per-corner
radii add two more (§9 entry 17): 071 the direct-arm invariants (corner locality, square
corners, 1px-alpha junction exactness over every mix of rounded and square corners,
containment, quarter turns against the generic path as oracle, dispatch) and 072 clipping
in both directions (tier-0 === bitmask with no leaks; a roundRect clip === its fill).
The direct-rendering cases carry a `rrrCorner` radius facet for per-corner radii.
The clip model (§9 entry 18) adds two: 073 every draw kind under mask + rect against the
`_disableTier0Clip` pure-mask oracle (Fizzygum's corner pattern, mask/rect sequences, composite
ops, shadows), and 074 save/restore exactness with a shared mask and the combined-mask cache.

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

# Clipping Optimisation Plan

**Status**: STAGES 1–3 LANDED (refreshed 2026-08-13; validated GO 2026-07-07). The §5–6
design shipped via `6b20dcc`/`277e8e3`/`7414c35`/`af9af84` — tier-0 rect clip detection,
clamped extents on the wired arms, and the mask-skip. What remains OPEN is §9 Stage 4
(Cohen-Sutherland endpoint clipping for 1px strokes in `LineOps` + the `CircleOps`
bbox hoist), still gated on profiling showing 1px strokes hot, and Stage 5's optional
items. The 2026-08-13 dispatch-audit close-out re-reviewed the tier-0-UNWIRED arms
(`RectOpsRot`, `RoundedRectOpsRot`, `ArcOps`, `LineOps`, `QuadScanOps`,
`RectOpsAA.fillStroke_AA_Any`) and left them standing with in-code notes at every
dispatch site — wire only with a benchmark-justified hot clipped caller
(`DIRECT-RENDERING-SUMMARY.MD` §9 entry 13). Historical validation data: the consumer
profiling campaign found 100.000% of clips are axis-aligned integer rects (§8.5), and
sequenced the drawImage debug-log removal + fast path first (both since landed
consumer-side).

**Date**: 2026-05-23 (workload validation added 2026-07-07)

**Context**: The anticipated consumer workload is dominated by axis-aligned
integer rectangular clipping (drawImage + fillRect against clipped regions,
many `save/clipRect/draw/restore` cycles). This document captures the research,
design, and sequenced plan for when we pull the trigger.

---

## 1. Current clipping architecture

### 1.1 Data structures

- `src/utils/BitBuffer.js` — generic 1-bit-per-pixel buffer (Uint8Array,
  8 pixels per byte), with `clear / fill / and / copyFrom / isFull / isEmpty /
  equals`. Used by composition.
- `src/core/ClipMask.js` — thin wrapper around BitBuffer; defaults to all-1s
  (visible). Exposes raw `.buffer` for hot loops plus `intersectWith`, `clone`,
  `createPixelWriter`, `hasClipping`, `isPixelClipped`.
- `src/core/SourceMask.js` — sister structure (defaults to all-0s) used only
  for canvas-wide composite operations (`destination-atop`, `source-in`, etc).
  Has bounds tracking via `BoundsTracker`. Not directly involved in clipping
  but worth knowing exists, since it demonstrates the project already accepts
  "1-bit buffer + bbox" as an idiom.

### 1.2 API surface

- `Context2D.clip(path?, rule?)` at `src/core/Context2D.js:1481` — builds a temp
  ClipMask initialised all-0 (`clipAll`), rasterises the path into it via
  `PolygonFiller.fillPolygonsToClipMask`, then `intersectWith`s the existing
  mask. Lazy allocation: `_clipMask` stays `null` until the first `clip()` call.
- `CanvasCompatibleContext2D.clip` at `src/compat/CanvasCompatibleContext2D.js:451`
  — argument dispatch only, delegates to core.
- `save()` / `restore()` — deep-clones the mask via `_createSnapshot` /
  `_applySnapshot` (`Context2D.js:185`, `:228`). No CTM transformation on save:
  the mask is in device space.

### 1.3 How the mask is produced

`PolygonFiller.fillPolygonsToClipMask` (`src/renderers/PolygonFiller.js:705`)
uses the scanline algorithm and writes via `_fillClipMaskSpans` (`:754`), which
calls `clipMask.setPixel(x, y, true)` per pixel — no byte-aligned fast path.
Always allocates at full surface size.

### 1.4 How the mask is consumed (three patterns)

1. **Span-level byte-skip** (fastest, used by SpanOps and PolygonFiller's
   direct path). Reads the raw `clipBuffer` byte; if `=== 0`, skips 8 pixels
   at once. Per-bit check otherwise. See `src/renderers/SpanOps.js:75-92` and
   the inlined copy at `src/renderers/PolygonFiller.js:132-150`.

2. **Per-pixel inline check via preprocessor templates** — used by
   `RectOpsAA`, `CircleOps` (1px strokes), `ArcOps`, `LineOps`,
   `RoundedRectOps*`, `QuadScanOps`. Expanded from markers
   `SET_OPAQUE_CLIPPED` / `BLEND_ALPHA_CLIPPED` defined in
   `build-scripts/templates/clipped.js`. Inline form:
   `if (!clipBuffer || (clipBuffer[idx >> 3] & (1 << (idx & 7)))) { ... }`.

3. **`isPixelClipped` method calls** (slowest — getter + method indirection
   per pixel). Used by `Rasterizer._fillAxisAlignedRect` (`Rasterizer.js:274`),
   `_performCanvasWideCompositing` (`:335`), `drawImage` per-pixel loop
   (`:651`), `PolygonFiller._fillPixelSpan` (`:421`), and
   `ShadowPipeline._compositeShadowToSurface` (`:196`).

### 1.5 Existing fast paths that bypass the mask

- `clearRect` deliberately bypasses the composite pipeline (CLAUDE.md notes
  this is intentional — `Context2D._clearRectDirect`).
- Direct rendering paths in Context2D (`fillRect`, `strokeRect`, `fill`,
  `stroke`) accept clipping by passing `clipBuffer` to the renderers, but
  `Rasterizer._fillRectInternal` (`Rasterizer.js:172`) explicitly reroutes
  to `_fillInternal` (path-based) if any `clipMask` is present.

### 1.6 Existing optimisations (the three the user identified)

1. **Lazy allocation** — `_clipMask` is `null` until the first `clip()`.
   Every code path checks `this._clipMask ?` first. This is the real
   "no clip" fast path.
2. **Byte-skip on read side** — 8 pixels at a time when `clipBuffer[byte] === 0`.
   This is the fastest fully-clipped fast path inside SpanOps.
3. **Direct rendering gating** — short-circuits the rasteriser entirely for
   solid-colour source-over with no shadow (see `Context2D._canUseDirectRendering`
   at `Context2D.js:144`). Independently of clipping, but interacts with it.

---

## 2. Target workload

The consumer system (not yet integrated) is expected to:

- Use **axis-aligned integer rectangular clips** for the vast majority of
  `clip()` calls.
- Perform many `drawImage` (copy) and `fillRect` operations against clipped
  regions, often where the clip is much smaller than the canvas.
- Use `save → clipRect → draw → restore` cycles heavily (UI-style rendering).
- Rarely use path-based clips, transformed clips under rotation, or
  intersections that produce non-rectangular effective regions.

**This is a prediction, not a measurement.** §8 covers how to validate it
cheaply before committing to the optimisation work.

---

## 3. Survey: how production renderers handle clipping

(Distilled from a survey provided during the design session. Full survey
available on request.)

### 3.1 Universal pattern: tier the clip representation

Every serious 2D renderer (Skia, Cairo/pixman, X11/Xlib, QuickDraw, AGG, Qt
raster, SDL2) tiers its clip into at least three levels:

| Tier | Representation | Cost | Where used |
|------|---------------|------|-----------|
| 0 | Single rectangle | 4 ints; analytic intersect | Skia `fIsRect`, GDI `SelectClipRgn`-with-rect, OpenGL `glScissor`, SDL `clip_rect`, Qt `simpleClip` |
| 1 | Y-X banded rectangle list (a region) | O(n+m) sweep | pixman `pixman_region_t`, Cairo `cairo_region_t`, Qt `QRegion`, Skia `SkRegion` (BW path) |
| 2 | Per-pixel mask (1-bit or 8-bit alpha) | O(W·H) | Skia `SkAAClip`, our `ClipMask` |

**The architectural lesson**: tier-0 is the overwhelmingly common case in real
applications. Detect it and never pay the higher-tier costs.

Skia caches `fIsRect` and `fIsEmpty` flags on every clip update for fast-path
selection. Qt caches a `simpleClip` flag (`region.rects().size() <= 1`) plus a
`boundingRect`. X11/pixman regions always store an `extents` bounding box as
a first-class field, allowing `EXTENTCHECK` early rejection.

### 3.2 Analytic primitive clipping (not per-pixel mask testing)

- **Blits/fills**: clamp the destination rectangle to the clip rect *before*
  the inner loop. Standard in SDL (`SDL_BlitSurface`), Allegro (`blit()`), GDI.
  One `min`/`max` rect intersection eliminates per-pixel mask checks.
- **Lines**: Cohen-Sutherland endpoint clipping against the clip rect, then
  Bresenham on the survivor segment. Trivial-accept (both outcodes zero) is
  two computes and one OR; the inner loop becomes pure integer arithmetic
  with no memory load. Liang-Barsky is faster *when most lines are heavily
  clipped*, but for UI workloads where most lines are fully inside, the gap
  doesn't matter and Cohen-Sutherland is simpler.
- **Polygons**: Sutherland-Hodgman in 4 passes (left/top/right/bottom).
  Handles convex/rectangular clip windows; chokes on concave (Weiler-Atherton
  fixes that, but unnecessary here).

### 3.3 Detecting "the bitmask is actually a rectangle"

When a non-rectangular path's clip is intersected with an existing rect clip,
the result may happen to remain rectangular (e.g., a circular clip wholly
containing a smaller rectangular clip collapses to the rectangle). Skia tests
this via `nearly_integral()` and promotes nominally-AA rect clips back to BW
when their edges are within 1/8 pixel of an integer.

The analogue for SWCanvas: after each non-rect `clip()`, scan the bitmask
once. If every row inside the bbox contains exactly the bits `[bbox.x0,
bbox.x1)` set and outside-bbox rows are empty, promote back to tier-0.

### 3.4 Per-row span extents (Sutherland's Scanline Coherent Shape Algebra)

When the clip is genuinely non-rectangular, an intermediate representation
helps: per scanline, store `minX[y] / maxX[y] / rowState[y] (EMPTY|FULL|PARTIAL)`.
Blits become:

```
for y in [y0, y1):
  state = rowState[y]
  if state == EMPTY: continue
  if state == FULL: copyRow(y, x0, x1)        // no clip test
  else: copyRow(y, max(x0, minX[y]), min(x1, maxX[y]))  // analytic
```

Worth it only if the non-rect case becomes a measured bottleneck.

---

## 4. Gap analysis

### 4.1 What SWCanvas already does well

- The byte-skip on the read side is the right idea — gets most of the win
  on the all-clipped case.
- Lazy allocation means the no-clip case has zero overhead.
- Span-based rendering via `SpanOps` means circles, thick strokes, rounded
  rects, and polygon fills all funnel through the same span entry points —
  any clipping improvement at the span layer propagates to all shapes.
- The preprocessor inline-marker pattern means we don't pay function call
  overhead per pixel in the per-pixel-clip path.
- Direct-rendering gating with cached `_isSourceOver` and `_noShadow` flags
  efficiently skips the rasteriser when not needed.

### 4.2 What's missing

| Gap | Impact |
|-----|--------|
| No tier-0 detection — every clip becomes a bitmask | Huge: small rect clip on a 4K canvas allocates 2 MB, ANDed every nested `clip()` |
| No bbox tracking on the mask | Operations iterate the full draw extent even when the clip is a 20×20 region |
| Full-surface allocation regardless of clip size | Memory cost; also affects intersect / clone time |
| `save()` deep-clones the bitmap | `save/clipRect/.../restore` cycles dominated by allocation, not pixel work |
| `drawImage` iterates the full transformed device bbox | Same — could clip to clipBBox first |
| `isPixelClipped` method calls use getter indirection rather than raw bit ops | Path 3 above could be as fast as Path 2, but isn't |
| `_fillClipMaskSpans` writes one bit at a time, not byte-aligned | Mask construction slower than necessary; matters less than read-side perf |
| 1px Bresenham strokes (`LineOps`, `CircleOps.stroke1px_*`) have no analytic endpoint clip | Per-pixel bit-test on every Bresenham step |
| `Rasterizer._fillRectInternal` disables direct rect fill if any clip exists | Even when clip is rectangular, axis-aligned rect fill loses its fast path |

The "Rasterizer disables direct rect fill when clip exists" gap is
particularly painful for the target workload — it explicitly fights it.

---

## 5. Recommended design: tier-0 rect + clip bbox

### 5.1 New state on Context2D (alongside `_clipMask`)

```js
this._clipRect = null;    // { x0, y0, x1, y1 } in device space, integer coords;
                          // half-open: [x0, x1) × [y0, y1)
this._clipIsRect = false; // true ⇔ effective clip is exactly _clipRect
                          // (no bitmask consultation needed)
```

Semantics:
- `_clipMask === null && _clipRect === null` → no clipping (existing path).
- `_clipIsRect === true` → `_clipRect` describes the entire clip exactly;
  `_clipMask` may still exist (if we kept it as a back-stop) but isn't read.
- `_clipIsRect === false && _clipRect !== null` → `_clipRect` is the
  bounding box of unclipped pixels; the bitmask describes the actual shape
  inside that bbox. Bbox is used to bound iteration and trivial-reject draws.

### 5.2 The detection logic in `clip()`

After `PathFlattener.flattenPath(pathToClip)` returns polygons, check whether
they collapse to a single 4-vertex axis-aligned rectangle in device space:

```
function detectAxisAlignedRect(polygons, transform):
  if polygons.length !== 1: return null
  poly = polygons[0]
  if poly.length !== 4: return null
  // transform corners
  p = poly.map(pt => transform.transformPoint(pt))
  // check axis-aligned (two pairs of x's, two pairs of y's)
  xs = sorted unique x coords of p
  ys = sorted unique y coords of p
  if xs.length !== 2 || ys.length !== 2: return null
  // check integer (use same rounding as _fillClipMaskSpans:
  // ceil(min) for left/top, floor(max)+1 for right/bottom)
  return {
    x0: Math.ceil(xs[0]),
    y0: Math.ceil(ys[0]),
    x1: Math.floor(xs[1]) + 1,
    y1: Math.floor(ys[1]) + 1
  }
```

Then in `clip()`:

```
new = detectAxisAlignedRect(polygons, this._transform)
if (new && (this._clipMask === null || this._clipIsRect)) {
  // tier-0: pure rect intersection, skip the bitmask path entirely
  this._clipRect = intersectRect(this._clipRect, new)
  this._clipIsRect = true
  this._clipMask = null  // free any prior mask
  return
}
// fall through to existing bitmask path...
// also update _clipRect to track the bbox of the resulting bitmask
// also set _clipIsRect = false
```

### 5.3 The key architectural insight

**Reuse the no-clip fast paths.** Every renderer in `src/renderers/` already has
a tested unclipped code path (the `else` branch when `clipBuffer === null`).
By detecting tier-0 and clipping the *draw extent* analytically before calling
the renderer, we pass `clipBuffer = null` and get back the existing unclipped
fast path automatically — no new inner loops to write or test.

So the consumer integration is:

```
// at every renderer entry point in Context2D (fillRect direct, strokeRect direct,
// fill direct, stroke direct, fillCircle, strokeCircle, drawImage):

if (this._clipIsRect) {
  // clamp draw bbox to _clipRect, then call renderer with clipBuffer = null
  ...
} else if (this._clipMask) {
  // existing bitmask path, but: clamp draw bbox to this._clipRect first
  // (lets even bitmask-clip draws skip out-of-bbox regions)
  ...
} else {
  // existing no-clip path
  ...
}
```

### 5.4 Bounding box tracking for the bitmask case

When `_clipIsRect` is false (the bitmask path is in use), we still maintain
`_clipRect` as the tight axis-aligned bounding box of unclipped pixels. Compute
it during `fillPolygonsToClipMask` by tracking min/max x/y of pixels written.
Cost: ~4 `Math.min`/`max` per scanline, paid once at clip time.

With this, even path-based clips benefit:
- Trivial reject: `if (drawBbox ∩ _clipRect is empty) return`.
- Iteration shrink: `drawImage`, `fillPolygons`, etc. iterate only inside
  `_clipRect`, not the full surface.
- Inner loop still does per-pixel bit-test (the bitmask isn't rectangular),
  but vastly fewer pixels are visited.

---

## 6. Per-primitive treatment

### 6.1 fillRect (direct path)

Touch points: `Context2D.js:384-446` (direct fast path), `Rasterizer.js:172`
(the disabling gate).

Changes:
- When `_clipIsRect`: clamp device-space rect to `_clipRect`, call
  `RectOpsAA.fill_AA_Opaq` (or similar) with `clipBuffer = null`.
- When `!_clipIsRect && _clipRect`: clamp to `_clipRect` first, then call
  with `clipBuffer = this._clipMask.buffer` (existing path, smaller extent).
- Remove the "if clipMask exists, reroute through `_fillInternal`" gate in
  `Rasterizer._fillRectInternal:172` — the tier-0 case can now use the direct
  rect fill safely.

### 6.2 drawImage

Touch point: `Rasterizer._drawImageInternal:555-725`.

The current implementation computes `[minX, maxX, minY, maxY]` from
transformed corners (lines 615-624), clamps to surface, then iterates every
device pixel inside. The inner loop at `:649-723` does `_isPixelClipped`
per pixel.

Changes:
- After computing the device bbox, intersect with `_clipRect` if present.
  Trivial reject if empty.
- When `_clipIsRect`: drop the `_isPixelClipped` check at `:651`.
- When `!_clipIsRect && _clipRect`: keep the check but only over the smaller
  iteration range.

This is the single highest-impact change for the target workload: a 20×20
clipped drawImage on a 4K canvas goes from iterating ~33M pixels (the full
image-extent bbox) to ~400.

### 6.3 Circles

Touch points: `src/renderers/CircleOps.js` — `fill_Opaq` (`:93`), `fill_Alpha`
(`:160`), `stroke1px_Opaq` (`:249`), `stroke1px_Alpha` (`:384`),
`fillStroke_Any` (`:548`), `strokeThick_Opaq` (`:704`), `strokeThick_Alpha`
(`:777`).

`fill_*`, `strokeThick_*`, and `fillStroke_Any` all funnel through `SpanOps`,
which inherits the tier-0 win automatically once `Context2D.fillCircle`
(or wherever calls them) passes `clipBuffer = null` in the rect case.

Circle-specific code changes:
1. **Whole-circle trivial reject**: at the top of each method, compute circle
   bbox `[cx−r, cy−r, cx+r, cy+r]`, intersect with `_clipRect`. If empty,
   return. (Cheaper than entering the Bresenham/sqrt loop and discovering
   row-by-row emptiness.)
2. **Whole-circle trivial accept**: if circle bbox fits entirely inside
   `_clipRect` AND `_clipIsRect`: pass `clipBuffer = null` to every downstream
   `SpanOps` call. (This is the common case for small circles drawn well
   inside a clipped panel.)
3. **Partial overlap**: replace canvas-bounds clamps with `_clipRect` clamps:
   - `clampedStartX = Math.max(_clipRect.x0, abs_x_min)`
   - `clampedEndX = Math.min(_clipRect.x1 - 1, abs_x_max)`
   - Row predicates at `:128`, `:143`, `:601-606` use `_clipRect.y0/y1`
     instead of `0/height`.
4. **1px stroke**: see §6.5.

### 6.4 Paths (general)

Touch points: `PolygonFiller._calculateBounds:216`, `_fillPolygonsDirect:83`,
`_fillScanline:249`, `_fillSpans:336`, `_fillPixelSpan:406`.

Changes:
- `_calculateBounds` clamps to surface; also clamp to `_clipRect`.
- Per-scanline span endpoints (lines 124-125, 371-372): clamp to `_clipRect`
  in addition to surface width.
- When `_clipIsRect`: take the direct path (`_fillPolygonsDirect`'s `else`
  branch at line 151) by passing `clipMask = null`. The conditions for that
  branch are already checked at `:52-58` (opaque solid colour, source-over,
  globalAlpha = 1, no sourceMask); add "or rect clip" as a permitted case.

### 6.5 Lines (1px Bresenham) and the per-pixel-clip stroke

Touch points: `src/renderers/LineOps.js`, `CircleOps.stroke1px_Opaq/Alpha`.

These write individual pixels with inline `clipBuffer` bit-tests on every
step (`LineOps.js:105-113`, `CircleOps.js:270-273` and seven sibling blocks).

Changes when `_clipIsRect`:
- For circles: hoist a single bbox-vs-circle-bbox check. If circle bbox
  ⊆ `_clipRect`, all 8 symmetric points per Bresenham step are guaranteed
  inside the clip — drop the per-point bit-test entirely, write
  unconditionally (still need the surface-bounds check if circle extends
  off-screen, which can be hoisted too).
- For lines: implement Cohen-Sutherland endpoint clipping against
  `_clipRect`. Trivial-accept (both endpoint outcodes zero) skips the
  per-pixel bit-test for the entire line. Partial-clip case: solve for
  intersection with the clip edge, then run unclipped Bresenham on the
  survivor segment.

Cohen-Sutherland for line endpoints (4-bit outcode: above/below/left/right
of rect; integer math throughout):

```
function outcode(x, y, r):
  c = 0
  if (x < r.x0) c |= 1
  if (x >= r.x1) c |= 2
  if (y < r.y0) c |= 4
  if (y >= r.y1) c |= 8
  return c

function clipLine(x0, y0, x1, y1, r):
  c0 = outcode(x0, y0, r)
  c1 = outcode(x1, y1, r)
  while true:
    if (c0 | c1) === 0: return {x0, y0, x1, y1}      // trivial accept
    if (c0 & c1) !== 0: return null                  // trivial reject
    // pick the endpoint outside the clip, clip it against the first edge
    c = c0 !== 0 ? c0 : c1
    // compute intersection ...
    // update endpoint and outcode, loop
```

For UI workloads where most lines are fully inside, the trivial-accept path
fires constantly and the per-pixel bit-test disappears from the inner loop.

### 6.6 Save / restore

Touch points: `_createSnapshot:171`, `_applySnapshot:219`.

Changes:
- Snapshot stores `{clipRect, clipIsRect, clipMask}`.
- When `clipIsRect`, `clipMask` is null → snapshot copies 5 numbers, restore
  copies them back. No bitmap clone.
- When `!clipIsRect`, current deep-clone behaviour preserved.

The `save/clipRect/draw/restore` loop becomes essentially allocation-free in
the tier-0 case, which matters most for UI-style workloads.

---

## 7. Not in scope (skip list, with rationale)

| Idea | Why skip |
|------|---------|
| Y-X banded rectangle region list (pixman-style) | Right for compositors with many disjoint rectangles; wrong for a UI workload where clips compose to a single rect. Multi-week implementation effort for a niche gain. |
| Per-row `[minX, maxX]` span extents | Worth it only if the *non-rect* bitmask case becomes a measured bottleneck. Target workload is rect-dominated. |
| Subregion bitmask (allocate at bbox extent rather than surface) | Big memory wins on 4K canvases with tiny clips, but requires touching every renderer's pixel-index arithmetic (`y * width + x` assumes mask is at surface stride). High disruption, modest payoff once tier-0 lands. Reconsider only if memory pressure becomes a measurable problem. |
| 8-bit anti-aliased clip (alpha coverage mask) | SWCanvas is binary (`coverage > 0.5` in `ClipMask.createPixelWriter`). Adding AA clipping is a much larger project with implications for the entire renderer. Out of scope here. |
| All-ones byte detection on read side (symmetric to all-zeros byte-skip) | Tier-0 rect makes `clipBuffer === null` in the common case, which is even faster than any byte-test optimisation. Worth it only as a marginal optimisation for the residual bitmask path. |
| Pre-flattening rect detection (check Path2D commands before flattening) | Marginal — flattening a rect path is cheap. Better to detect post-flatten (one branch, no Path2D introspection). |
| Recover-to-rect promotion (scan bitmask, detect "happens to be rect") | Worth it if `clip()` calls frequently produce rect-result-from-non-rect-input. Likely rare in the target workload — defer. |
| Round-trip back to a lower tier after `restore()` | Skia's lesson: don't. The bookkeeping is rarely worth it. |

---

## 8. Pre-integration work (do now)

The only work justified before integration is **instrumentation that lets us
validate the workload assumption before optimising**.

### 8.1 Counters to add

In `Context2D.clip()`:
- `clipCallCount` — total `clip()` calls
- `clipDetectedAsRect` — calls where the flattened polygons would have
  detected as axis-aligned integer rect (run detection but don't act on it)
- `clipFellThroughToBitmask` — the rest
- `clipUnderRotatedCTM` — calls where `transform.b !== 0 || transform.c !== 0`

At each renderer entry point (`fillRect`, `fillCircle`, `drawImage`,
`fill`, `stroke`, etc.):
- `drawCallsByPrimitive[type]++`
- `drawCallsByClipKind[noClip|wouldBeTier0|bitmask]++` — partitioned by what
  tier-0 *would* have classified the draw as (compute, don't act)

Optional but valuable:
- For each draw, the ratio of `clipBBox area / drawExtent area`. Aggregate to
  estimate the iteration shrink we'd get from clipBBox clamping.

### 8.2 Exposure

Add `Context2D.getClippingStats()` returning the counters. The consumer
project's integration test can dump this after a representative session.

### 8.3 What to expect

Useful trigger thresholds for committing to the full plan:
- `clipDetectedAsRect / clipCallCount > 80%` — tier-0 will fire often enough
  to matter.
- `drawCallsByClipKind[wouldBeTier0] / total > 50%` — primary motivation
  validated.
- `drawCallsByClipKind[bitmask] > 5%` of total **and** dominating frame time
  in a profile — invest in bitmask-path bbox clamp first.
- `drawCallsByClipKind[wouldBeTier0] < 20%` — workload assumption is wrong,
  redesign the optimisation around what's actually hot.

### 8.4 What NOT to add now

- The `_clipRect` / `_clipIsRect` state itself.
- Any new code paths in renderers.
- The Cohen-Sutherland implementation.
- Any change to `save/restore`.

Just observation, no behavioural change.

### 8.5 MEASURED WORKLOAD DATA (2026-07-07) — §8 fulfilled

The observation was implemented **externally** — no SWCanvas code changes were needed:
the consumer's profiling harness (`Fizzygum/docs/profiling/`, see its README) wraps the
compat context prototype page-side and classifies every `clip()`/`save()`/draw call.
Workload: Fizzygum's full 190-test SystemTest suite, headless Chrome, 1100×800, both
dpr 1 and dpr 2, all runs passing 190/190.

Counter results (dpr1; dpr2 in parens where different):

| §8.1 counter | Measured |
|---|---|
| `clipCallCount` | 76,675 (62,344 @dpr2) |
| `clipDetectedAsRect` | **76,675 = 100.000%** (all INTEGER-coordinate rects) |
| `clipFellThroughToBitmask` | 0 |
| `clipUnderRotatedCTM` | 0 |
| nested clips (intersections) | 0 |
| `drawCallsByClipKind[wouldBeTier0]` | 227,200 (stroke 124,543 · fill 54,163 · fillText 23,507 · strokeRect 19,907 · fillRect 5,080) |
| `drawCallsByClipKind[bitmask]` | **0** |
| clipBBox / surface area | 71% of clips ≤1%, 82% ≤5%, mean 3.4% |
| `save()` with live clip (= mask deep-clone today) | 12,494 of 382,794 saves |

Derived cost of the current bitmask path on this workload, per suite run: ≈2.27 **billion**
`setPixel` calls building masks (Σ clip-bbox pixels), 76,675 full-surface ClipMask
allocations, 12,494 full-surface clones (110 KB @dpr1 / 440 KB @dpr2 each).

CPU-profile share attributable to clipping (V8 sampling, unminified bundle):
mask build (`fillPolygonsToClipMask`/`_fillClipMaskSpans`/`BitBuffer`) 2.6% of busy CPU
@dpr1 / 2.8% @dpr2; mask reads (`_getBit`) 6.4% / 10.3%; plus the structural detours
(clipped `fillRect` rerouted through path filling per `Rasterizer._fillRectInternal`;
per-pixel bit tests inside span fills). Total addressable ≈10–18% of the consumer's
busy CPU — comfortably above the §10 "clipping < 5%" abandon line.

**Verdicts against §8.3:** `clipDetectedAsRect/clipCallCount` = 100% (needs >80%) — MET.
`wouldBeTier0/total draws-under-clip` = 100% (needs >50%) — MET. `bitmask > 5%` — moot
(zero). The §5 design and §6 per-primitive treatment stand unchanged. The §7 skip-list is
confirmed by measurement (zero non-rect clips ⇒ recover-to-rect promotion, per-row span
extents, banded regions all stay skipped). Detection rounding MUST follow
`_fillClipMaskSpans`'s pixel-center sampling semantics (see the comment at
`PolygonFiller.js:767+`) so tier-0 stays byte-identical with the mask path — the consumer's
reference tests hash raw pixels, so any deviation fails its suite loudly.

Consumer-side facts that simplify implementation: all clips originate from just two code
shapes (an integer-rect `clipToRectangle` helper: moveTo+4×lineTo+closePath; and
`beginPath/rect/clip` around strokeRect), always inside a save/restore pair, never nested,
never under rotation. The `save/clipRect/draw/restore` cycle count (12,494 clones/run)
independently justifies Stage 3.

---

## 9. Post-integration work (sequenced)

Trigger: instrumentation data confirms target workload assumption.

### Stage 1 — Tier-0 detection + clipBBox tracking (1–2 days)

- Add `_clipRect`, `_clipIsRect` to `Context2D`.
- Implement `detectAxisAlignedRect` in `Context2D.clip()`.
- Update `_createSnapshot` / `_applySnapshot` to include the new state.
- In `Context2D.clip()`'s bitmask fallback path, also compute and store the
  result bbox.
- No consumer changes yet — just the bookkeeping. Verify all tests still
  pass; the new state is unused.

### Stage 2 — Consumer integration (2–3 days)

Update each renderer entry point in `Context2D` to:
1. Check `_clipRect` for trivial reject.
2. In the tier-0 case, clamp draw extent to `_clipRect` and pass
   `clipBuffer = null`.
3. In the bitmask case with `_clipRect`, clamp draw extent first.

Order, biggest-impact first:
1. `drawImage` (§6.2) — likely the largest single win.
2. `fillRect` direct path (§6.1).
3. `fillCircle` / `strokeCircle` (§6.3).
4. Path-based `fill` (§6.4).
5. `strokeRect` direct path.

Each of these is independent — land them in separate commits, verify the
visual test suite after each, measure with the integration workload.

### Stage 3 — Save/restore fast path (1 day)

Update `_createSnapshot` / `_applySnapshot` so the tier-0 case copies state
without bitmap cloning (§6.6). This is small but high-leverage for UI
workloads.

### Stage 4 — Cohen-Sutherland for 1px strokes (1–2 days)

If profiling shows 1px strokes are hot, implement endpoint clipping in
`LineOps` and bbox-vs-bbox hoist in `CircleOps.stroke1px_*` (§6.5).

### Stage 5 — Optional (only if profiling demands)

- Recover-to-rect promotion after non-rect `clip()`.
- Per-row span extents for the non-rect bitmask case.
- All-ones byte symmetric optimisation in SpanOps.

---

## 10. Decision criteria

### When to start (post-integration)

- Integration of SWCanvas into the consumer project is complete and stable. ✅ (2026-07-07)
- Instrumentation data from a representative workload is in hand. ✅ (§8.5)
- At least one of the trigger thresholds in §8.3 is met. ✅ (all of them, at 100%)
- No higher-priority correctness issue is open against the renderer. — verify at start;
  also sequence AFTER the two bigger measured wins (drawImage debug-log removal + drawImage
  fast path, items S1/S2 in `Fizzygum/docs/runtime-performance-optimization-plan.md`).

### When to abandon this plan

- Instrumentation shows `clipDetectedAsRect < 30%` of clip calls — the
  workload doesn't match the assumption; this design is wrong for it.
- Profiling shows clipping is < 5% of total render time — there's bigger
  fish to fry (text, drawImage scaling, gradient evaluation, ...).
- The consumer project pivots to a non-clipping-heavy approach (e.g., draws
  to many small offscreen canvases instead).

### Signals to escalate priority

- `save/clipRect/draw/restore` loops dominate the profile — Stage 1 + Stage 3
  alone should give a major win.
- `drawImage` against small clips is in the top 3 hot functions — Stage 2's
  drawImage change is high-leverage.

---

## 11. File reference index

For future-self: the files and lines most affected by this plan.

### Core clipping
- `src/core/Context2D.js:80-86` — `_clipMask` field declaration
- `src/core/Context2D.js:144-162` — direct-rendering gating logic
- `src/core/Context2D.js:171-241` — `_createSnapshot` / `_applySnapshot`
- `src/core/Context2D.js:1481-1506` — `clip()` implementation
- `src/core/ClipMask.js` — full file (160 lines)
- `src/core/SourceMask.js` — full file (175 lines, similar idiom)
- `src/utils/BitBuffer.js` — full file (280 lines)

### Producer side (writing the mask)
- `src/renderers/PolygonFiller.js:705-743` — `fillPolygonsToClipMask`
- `src/renderers/PolygonFiller.js:754-785` — `_fillClipMaskSpans`

### Consumer side — the three patterns
1. **Span-level byte-skip**:
   - `src/renderers/SpanOps.js:75-92` (fill_Opaq) and `:143-163` (fill_Alpha)
   - `src/renderers/PolygonFiller.js:132-150` (`_fillPolygonsDirect`)

2. **Per-pixel inline templates**:
   - `build-scripts/templates/clipped.js` (definitions)
   - `src/renderers/RectOpsAA.js`, `CircleOps.js`, `ArcOps.js`, `LineOps.js`,
     `RoundedRectOpsAA.js`, `RoundedRectOpsRot.js`, `QuadScanOps.js` (uses)

3. **`isPixelClipped` method**:
   - `src/core/Rasterizer.js:128-131` (helper)
   - `src/core/Rasterizer.js:274` (`_fillAxisAlignedRect`)
   - `src/core/Rasterizer.js:335` (`_performCanvasWideCompositing`)
   - `src/core/Rasterizer.js:651` (`_drawImageInternal`)
   - `src/renderers/PolygonFiller.js:421` (`_fillPixelSpan`)
   - `src/filters/ShadowPipeline.js:196` (`_compositeShadowToSurface`)

### Disabling gates
- `src/core/Rasterizer.js:172` — direct rect fill disabled when clipMask
  exists (the key gate to relax in Stage 2)
- `src/core/Context2D.js:773` — comment noting strokes use direct rendering
  "with no transforms/clipping/shadows"

### Tests
- `tests/visual/005-basic-clipping-test.js` — basic circular clip
- `tests/visual/028-basic-rectangular-clip-regions-test.js` — **most relevant
  for tier-0 validation**
- `tests/visual/029-polygon-clip-shapes-test.js`
- `tests/visual/030-arcellipse-clip-regions-test.js`
- `tests/visual/031-self-intersecting-clip-paths-test.js`
- `tests/visual/032-multiple-nested-clips-test.js`
- `tests/visual/033-clip-with-saverestore-behavior-test.js`
- `tests/visual/034-basic-clipping-regions-test.js`
- `tests/visual/035-enhanced-clipping-intersection-test-test.js`
- `tests/visual/039-combined-transform-clip-fill-critical-stencil-buffer-test-test.js`
- `tests/visual/042-combined-transform-clip-fill-rotated-clip-test.js` —
  rotated-CTM clip; verifies tier-0 detection correctly falls through
- `tests/visual/046-combined-transform-clip-stroke-phase-4-integration-test-test.js`
- `tests/visual/056-clipped-path-strokes-recreates-polygon-clipping-star-issue-test.js`
- `tests/visual/101-130-*-clipped-*-test.js` — clipping × every composite op
- `tests/visual/141-shadow-clipping-test.js`
- `tests/visual/205-text-clipped-test.js`

Visual tests in the 028–046 and 101–130 ranges are the primary regression
surface for Stage 2.

---

## 12. Open questions

- **Does `_clipRect` need to survive a CTM change?** Per current
  implementation, the mask is in device space and ignored by transforms (CTM
  affects drawing, not the existing clip). `_clipRect` should follow the
  same convention: device-space integer coords, unaffected by subsequent
  `setTransform`/`translate`/etc. Verify against visual test 042 (rotated
  CTM around an existing clip).

- **What about `clip()` called on a path that's been transformed via
  `setTransform` to be axis-aligned, but whose original Path2D commands
  describe a rotated rect?** Post-flatten detection handles this correctly
  (we work from device-space polygons, not source-space commands), but worth
  a unit test.

- **Does the existing `clearRect` direct-bypass interact with `_clipRect`?**
  `_clearRectDirect` already ignores the composite pipeline; needs to still
  respect any clip. Currently it doesn't (per CLAUDE.md, it deliberately
  bypasses — but this is for global compositing, not clipping; need to
  verify the existing behaviour and preserve it under tier-0).

- **Promote from bitmask back to rect after `restore()`?** When restoring a
  state where the previous clip was tier-0 but the current is bitmask, do we
  free the bitmask? Yes — the snapshot stored `clipMask: null` for tier-0
  states, so restore naturally drops it. Verify against visual test 033.

---

## 13. References

- Skia: `SkClipStack`, `SkRasterClip`, `SkRegion`, `SkAAClip`
  (github.com/google/skia, `src/core/`)
- Pixman: `pixman-region.c`, X11 `Xregion.h` (xc/lib/X11/Region.c)
- Cairo: `cairo_region_t` (thin wrapper over pixman)
- Qt: `QRegion`, `QPainter::clipRegion`, raster paint engine
- SDL2: `SDL_Surface::clip_rect`, `SDL_BlitSurface`, `SDL_SetClipRect`
- AGG: `agg::clip_liang_barsky`, `rasterizer_scanline_aa`
- Cohen-Sutherland: Foley, van Dam, Feiner, Hughes, *Computer Graphics:
  Principles and Practice*, 2nd ed., clipping chapter
- Liang-Barsky: Liang & Barsky, "A New Concept and Method for Line Clipping,"
  *ACM TOG* 3(1):1–22, Jan 1984, doi:10.1145/357332.357333
- Sutherland-Hodgman polygon clipping
- QuickDraw region format: Apple Tech Note, reverse-engineering posts circa 1985
- Mozilla Bugzilla 845874 (Y-X banded region representation discussion)
- Matthes & Drakopoulos, "Another Simple but Faster Method for 2D Line
  Clipping," *IJCGA* 9(4), July 2019, arXiv:1908.01350

---

## Document history

- 2026-05-23 — Initial draft. Based on session studying SWCanvas clipping
  internals and discussing the consumer-project integration plan. Captures
  research + design + sequenced plan; implementation deferred until after
  integration provides workload data.
- 2026-07-07 — Workload data measured on Fizzygum's full 190-test SystemTest suite
  (external page-side instrumentation; §8.5 added). All §8.3 triggers exceeded at 100%;
  status flipped to VALIDATED — GO, with sequencing deferred behind the consumer plan's
  S1/S2 drawImage items. Design unmodified.

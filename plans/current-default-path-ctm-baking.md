# Canonical fix: bake the current default path's CTM at build time

**Status**: **DONE — Approach A (device-space current default path) implemented**
(2026-06-02), superseding the interim fix described in §2. The current default
path now bakes the CTM into device-space geometry at build time; `fill`/`clip`
of it run under `IDENTITY`; `stroke` maps the centerline back by `drawT⁻¹`,
strokes with the round pen, and forwards by `drawT`; `isPointInPath`/`InStroke`
test the device-space geometry directly; `arcTo` is exact for any affine (via
`PathFlattener.resolveArcToGeometry`); and the interim machinery
(`_stampPathOp`, `_buildTransform`, `_resolvePathForDraw`) is removed. External
`Path2D` remains user-space and transform-independent. The byte-identical
constraint was deliberately relaxed (correctness over bit-identity): the only
visual change is that arcs/ellipses/arcTo under a scale now tessellate at
on-screen resolution (smoother) — 7 reference PNGs were regenerated and visually
verified. See the executed plan at
`~/.claude/plans/study-deeply-the-plan-hidden-bee.md`. The text below is the
original roadmap, kept for rationale.

**Date**: 2026-06-01 (roadmap); implemented 2026-06-02

**Context**: SWCanvas stored the *context's current default path* in raw
user-space coordinates and applied the current transformation matrix (CTM) at
`fill()`/`stroke()`/`clip()` time. The HTML5 Canvas spec requires the current
default path to **bake in the CTM at the moment each path-building method is
called** — only `Path2D` objects are transform-independent. The divergence
surfaced in the Fizzygum backend: the canonical PaintCode idiom

```js
ctx.save(); ctx.translate(x, y); ctx.scale(w/2, h/2);
ctx.arc(1, 1, 1, 0, 2*Math.PI); ctx.closePath();
ctx.restore();                 // CTM popped BEFORE the caller strokes
// caller: ctx.lineWidth = 3.5; ctx.stroke();
```

rendered `arc(1,1,1)` at user-space (1,1) radius 1 — a tiny circle at the
origin — instead of where the (now-discarded) `translate/scale` placed it. This
is `IconAppearance.oval`/`arc` in Fizzygum, and broke every icon that uses the
build-then-`restore`-then-draw pattern.

---

## 1. Current architecture (the relevant slice)

- `src/core/SWPath2D.js` — a pure command **recorder**. `moveTo/lineTo/arc/...`
  push plain `{type, ...coords}` objects onto `this.commands`. It has **no**
  access to a transform. It is used for **both** the context's current default
  path (`Context2D._currentPath`) **and** any external `Path2D` passed to
  `fill(path)`/`stroke(path)`. This dual use is why the baking logic cannot live
  here (see §5).
- `src/core/Context2D.js`
  - `_currentPath = new SWPath2D()` (constructor, ~81); reset by `beginPath()`.
  - Path methods (`moveTo`, `lineTo`, `rect`, `arc`, `ellipse`, `arcTo`,
    `quadraticCurveTo`, `bezierCurveTo`, `closePath`) delegate to
    `this._currentPath.*`.
  - `fill()` (~1205), `stroke()` (~1256), `clip()` (~1481): each calls
    `this.rasterizer.beginOp({ transform: this._transform, ... })` and hands the
    **user-space** path to the rasterizer. **The transform applied is the one in
    effect at the draw call** — this is the bug for the current default path
    (correct for `Path2D`).
  - `isPointInPath()` (~1299), `isPointInStroke()` (~1376): flatten the path,
    then `poly.map(p => this._transform.transformPoint(p))` and test the point —
    same draw-time-CTM assumption.
  - Direct-rendering fast paths (`fillRect`, `strokeRect`, `fillRoundRect`,
    `strokeRoundRect`, …) transform the primitive by `this._transform`
    **immediately** and never touch `_currentPath`; they are inherently
    single-transform and already correct. **Out of scope.**
- `src/core/Rasterizer.js` — `beginOp({transform})` stores the op transform;
  `_fillInternal` / `_strokeInternal` pass `this._currentOp.transform` to
  `PolygonFiller.fillPolygons(...)`.
- `src/renderers/PathFlattener.js` — `flattenPath()` turns commands into
  user-space polygons. `_flattenArc` (~402) computes its **segment count from the
  user-space radius** (`2*acos(1 - TOL/radius)`) — so an arc built at radius 1
  and scaled up renders coarse; tessellation must be chosen against the
  on-screen radius.
- `src/renderers/StrokeGenerator.js` — `generateStrokePolygons(path, props)`
  builds the stroke **outline in the path's coordinate space** using
  `lineWidth` (round pen + miter/bevel/round joins).
- `src/renderers/PolygonFiller.js` — `fillPolygons(..., transform, ...)` applies
  the op transform to every polygon point at scan time.
- `src/core/Transform2D.js` — immutable affine; provides `multiply`, `invert`,
  `transformPoint`, `equals`, `isIdentity`, and precomputed `scaleX`, `scaleY`,
  `uniformScale`, `scaledLineWidthFactor`.

**Consequence:** geometry *and* pen both live in user space and are transformed
by a single op transform at draw time. For a `Path2D` (transform-independent)
this is exactly right. For the current default path it violates the spec
whenever the CTM changes between building the path and drawing it.

---

## 2. The interim fix (what ships today)

`Context2D` now stamps each current-default-path command with the CTM in effect
when it was added (`_stampPathOp` → `cmd._buildTransform`), and at draw time
`_resolvePathForDraw(path)` rewrites any command whose build-time CTM differs
from the draw-time CTM into **draw-time user space** via the relative transform

```
R = drawT⁻¹ · buildT          (so that  drawT · R = buildT)
```

then feeds the rewritten path through the unchanged pipeline (which applies
`drawT` and scales the pen in draw-time user space). Arc/ellipse are resampled at
on-screen resolution (`_appendTransformedArc` / `_appendTransformedEllipse` /
`_arcSegmentCount`); `arcTo` transforms its points and scales the radius by
`R.uniformScale`. Applied in `fill`/`stroke`/`clip` only.

**Properties of the interim fix**

- Correct, spec-faithful pixels for the cases that matter (verified: the juggled
  `oval()` is byte-for-byte identical to the well-written direct
  `arc(30,50,10,…)`; full suite 196/196 with identical per-test outcomes;
  rotation and non-uniform→ellipse correct).
- **Byte-identical for the common (non-juggled) case** — when no command's
  build-time CTM differs from the draw-time CTM, the original path object is
  returned untouched.
- Known gaps it leaves (the reason for this plan):
  1. **`arcTo` under a non-similarity `R`** (non-uniform scale / shear) is
     approximated (radius × `uniformScale`); exact only for similarity
     transforms. Irrelevant to Fizzygum but not general-correct.
  2. **`isPointInPath` / `isPointInStroke` were left untouched** — they retain
     the draw-time-CTM behavior for the current default path. (`tests/core/
     035-ispointinpath-api-test.js:112` "isPointInPath with transforms" actually
     *asserts* the non-spec behavior.) Rendering and hit-testing therefore use
     different path-placement semantics under the juggle idiom.
  3. The `_buildTransform` stamp is an ad-hoc property on command objects, and
     `_resolvePathForDraw` rebuilds the whole path when *any* command diverges.

---

## 3. Goal — exact spec semantics, uniformly

1. **Current default path:** every point added by a path-building method is
   placed using the CTM **at the time of that call** (build-time baking). A later
   transform change (incl. `restore()`) does not move already-recorded geometry.
2. **`Path2D`:** unchanged — transform-independent, transformed at draw time.
3. **Stroke pen:** the line width is interpreted in **draw-time** user space and
   scaled by the draw-time CTM; under a non-uniform/sheared draw-time CTM the
   stroke is correspondingly **anisotropic** (a round pen maps to an ellipse),
   matching browsers.
4. **Uniform application:** the same semantics for `fill`, `stroke`, `clip`,
   `isPointInPath`, and `isPointInStroke`.
5. **No regressions:** byte-identical output for the non-juggled common case
   (this protects the 196 functional tests and the 153 visual reference PNGs).

---

## 4. Key equivalence (set the bar honestly)

For `fill`/`stroke`, the canonical "store device-space geometry, then stroke in
draw-time user space" reduces algebraically to the interim fix:

- Build-time baking stores `buildT · p` (device space).
- Correct stroking needs the **round** pen in user space, so you transform the
  device geometry back to draw-time user space with `drawT⁻¹`, giving
  `drawT⁻¹ · buildT · p = R · p` — *exactly* the interim fix's draw-space path —
  then the existing pipeline forwards by `drawT`.

**Therefore the deeper fix does not change the pixels of the cases the interim
fix already handles.** Its payoff is *structural*: a self-contained device-space
path, an explicit `Path2D`-vs-current-default-path split, hit-testing that falls
out for free, removal of the per-draw "compensating transform" cleverness, and
closing the `arcTo` / hit-test gaps (§2). Reviewers must understand this so the
work is scoped as *architecture + completeness*, not *pixel correction*.

---

## 5. Why the fix belongs in `Context2D` (not `SWPath2D`, not the renderer)

- `SWPath2D` is shared with external `Path2D`, which must **not** bake the CTM,
  and has no transform anyway. Baking there would corrupt `Path2D`.
- Pushing per-command transforms into `PathFlattener`/`PolygonFiller` smears the
  "current default path bakes; Path2D doesn't" distinction across the renderer.
- `Context2D` is the single owner of that distinction and of `this._transform`.
  The clean boundary is: **`Context2D` produces device-space geometry (current
  default path) or hands the renderer a `Path2D` + draw-time CTM (external
  path), and the renderer stays a dumb "polygons + one transform" consumer.**

---

## 6. Target architecture

Introduce a first-class **device-space current default path**.

### 6.1 Build-time baking

Each `Context2D` path method transforms its coordinates by `this._transform`
before recording, storing **device-space** geometry on `_currentPath`:

- `moveTo`/`lineTo`: `transformPoint`. Exact.
- `bezierCurveTo`/`quadraticCurveTo`: transform all control points (Béziers are
  affine-invariant). Exact.
- `rect`: already expands to `moveTo`+`lineTo`×3+`closePath` in `SWPath2D.rect`;
  each sub-point is baked. Exact.
- `arc`/`ellipse`/`arcTo`: a circle/arc under an affine map is an elliptical arc.
  Two options — see §7.1. **Recommended: flatten at build time** at on-screen
  resolution and store as baked `lineTo`s.

`beginPath()` resets to an empty device-space path. The path is no longer
re-baked at draw time.

To keep the build-time/draw-time relationship explicit and to support stroking
(§6.2) and hit-testing (§6.4), record the **CTM that was current when the path
was begun/last drawn-under is irrelevant** — what stroke needs is the *draw-time*
CTM, available at the draw call. No per-command stamp is required: geometry is
already device-space; only the pen needs the draw-time CTM.

> Implementation note: store device-space geometry on a distinct internal type
> (e.g. keep using `SWPath2D` but treat `_currentPath` as "device-space" by
> contract, or add a thin `DeviceSpacePath` marker) so the renderer entry points
> can assert which space they received. External `Path2D` remains user-space.

### 6.2 Draw-time

- **`fill` / `clip`:** geometry is already device-space → call the rasterizer
  with `transform = Transform2D.IDENTITY`. `PolygonFiller` then scans the
  device-space polygons directly.
- **`stroke`:** the round pen lives in draw-time user space. Transform the
  device-space centerline back with `drawT⁻¹`, run the **unchanged**
  `StrokeGenerator` (round pen + joins) with the user-space `lineWidth`, then let
  the existing pipeline forward the outline by `drawT` (op `transform = drawT`).
  This preserves anisotropic strokes under non-uniform/sheared `drawT` for free
  (§7.2). If `drawT` is singular, skip (nothing to stroke).

### 6.3 Direct-rendering fast paths

`fillRect`/`strokeRect`/`fillRoundRect`/… are unchanged: they never used
`_currentPath` and already bake at call time. Confirm none of them route through
the new device-space path.

### 6.4 Hit-testing (closes interim gap #2)

- `isPointInPath`: geometry is device-space; the point is in canvas space → test
  the point against the device-space polygons directly (drop the
  `this._transform.transformPoint` step). Spec-correct.
- `isPointInStroke`: transform the device centerline back via `drawT⁻¹`, generate
  stroke polygons in draw-time user space, forward by `drawT`, test the point.
- **Update** `tests/core/035-ispointinpath-api-test.js:112` — it encodes the old
  (non-spec) behavior and must be rewritten to the spec expectation (build under
  identity, then `translate` → point tested against the *unmoved* path).

---

## 7. The two hard problems

### 7.1 Arcs/ellipses → device space

A circle under an affine map is an ellipse; a *partial* arc additionally needs
its start/end angles remapped (the circle's parametric angle does not equal the
ellipse's eccentric angle under non-uniform scale).

- **Option A (recommended): build-time flattening at device resolution.** When
  recording `arc`/`ellipse`/`arcTo`, sample the curve in user space with segment
  count derived from the *on-screen* radius (`radius × max(scaleX, scaleY)` of
  the build CTM), transform each sample by the CTM, store baked `lineTo`s. This
  is exactly the proven `_appendTransformedArc` logic, moved to build time, and
  sidesteps all angle/axis math. Robust for any affine (rotation, non-uniform,
  shear, reflection). `arcTo` is first resolved to its center/sweep (reuse
  `PathFlattener._handleArcTo`'s geometry) then sampled — **this makes `arcTo`
  exact and closes interim gap #1.** Cost: a circle is stored as N segments.
- **Option B: store device-space `ellipse` commands.** Derive `(rx, ry, φ)` from
  the linear part of the CTM and remap start/end angles. Keeps curves as curves
  (smaller stored path, re-tessellable) but the partial-angle eccentric-anomaly
  remapping is fiddly and bug-prone. Defer as a later optimization if curve
  fidelity/perf ever demands it.

> The common case (no juggling) must stay byte-identical. With Option A, a path
> built and drawn under the same CTM would flatten arcs at build time instead of
> draw time — a behavioral change for *every* arc, not just juggled ones, which
> would shift the 153 visual refs. **Mitigation:** only bake arcs when the build
> CTM is non-identity *relative to how they'd be flattened today*; or, more
> simply, keep arcs as native commands in device space when `drawT == buildT`
> (the common case) and flatten only when they diverge. Decide this explicitly
> (see §10, Q1) — it is the single biggest byte-identical risk.

### 7.2 Pen anisotropy under non-uniform draw-time CTM

The existing `StrokeGenerator` assumes a **circular** pen. Real anisotropic
strokes are the Minkowski sum of the centerline with `L`(disk) — an ellipse —
where `L` is the linear part of `drawT`. Two ways:

- **Recommended: stroke in draw-time user space.** Per §6.2, transform device
  geometry back via `drawT⁻¹`, stroke with the round pen, forward by `drawT`.
  The forward transform turns the round outline into the correct ellipse — i.e.,
  `StrokeGenerator` is reused **unchanged** and anisotropy is exact. (This is the
  step that makes the deeper fix algebraically equal to the interim fix — §4.)
- **Not recommended now: generalize `StrokeGenerator` to elliptical pens.** A
  large rewrite of the offset + join math for marginal benefit. Out of scope.

---

## 8. Work items (file-by-file)

1. `src/core/Context2D.js`
   - Bake at build time in `moveTo/lineTo/rect/bezierCurveTo/quadraticCurveTo`
     (points), and `arc/ellipse/arcTo` (§7.1). Remove the interim
     `_stampPathOp` / `_buildTransform` stamping.
   - `fill`/`clip`: pass `IDENTITY` for geometry; drop `_resolvePathForDraw`.
   - `stroke`: back-transform via `drawT⁻¹`, reuse `StrokeGenerator`, forward by
     `drawT`; singular-`drawT` guard.
   - `isPointInPath`/`isPointInStroke`: §6.4.
   - Remove the interim helpers (`_resolvePathForDraw`, `_appendTransformedArc`,
     `_appendTransformedEllipse`, `_arcSegmentCount`) once superseded.
2. `src/core/SWPath2D.js` — likely unchanged structurally; clarify in a comment
   that the *context* is responsible for the coordinate space of `_currentPath`.
   Consider a marker/type for "device-space path" vs external `Path2D` (§6.1).
3. `src/core/Rasterizer.js` — no API change expected; it already takes a path +
   op transform. Verify `IDENTITY` op-transform paths hit the same scan code.
4. `src/renderers/PathFlattener.js` — reuse `_flattenArcWithTolerance` /
   `_handleArcTo` for build-time sampling; expose a tolerance parameter for
   ellipse if Option A is taken for `ellipse`.
5. `src/renderers/StrokeGenerator.js` / `PolygonFiller.js` — unchanged
   (the recommended stroke route reuses them as-is).
6. `tests/core/035-ispointinpath-api-test.js` — rewrite the
   "with transforms" cases to spec behavior (§6.4).

---

## 9. Byte-identical guarantee (the no-regression contract)

The 196 functional tests and 153 visual reference PNGs were generated with the
*current* renderer. The deeper fix must not change output for any path built and
drawn under a single transform. The risk areas:

- **Arc flattening location (§7.1).** Build-time vs draw-time flattening can
  change tessellation for *all* arcs unless gated to the divergent case. This is
  the primary threat to the visual refs. Resolve Q1 before writing code.
- **Float order of operations.** `drawT⁻¹·buildT·p` vs `buildT·p` then nothing
  can differ in the last ULP. For the common case, ensure the code path is
  literally "no transform applied" (not "multiply by an identity built from
  `drawT⁻¹·drawT`") so results are bit-identical.

Gate the whole behavior so that, when `drawT == buildT` at every step, the
emitted polygons are identical to today's.

---

## 10. Verification plan

- Reuse the repros from the interim work: the isolated `oval()` idiom; the full
  ported `PatchProgrammingIcon`; non-uniform→ellipse (`@arc` with `w≠h`);
  rotated-context circle; and the **0-pixel-diff** equivalence check
  (juggled `oval()` vs direct `arc(30,50,10,…)`).
- New unit tests: build-then-`restore`-then-`fill`/`stroke`/`clip`; build under
  T1, draw under T2 (≠ identity both); `arcTo` under non-uniform scale (now
  exact — the case the interim fix approximates); `isPointInPath`/`InStroke`
  under the juggle idiom; full-circle and partial-arc under rotation+shear.
- **Cross-check against the interim fix**: render a battery of juggled paths with
  both implementations; assert pixel-identical (per §4 they must match).
- Full suite green (`npm run build && npm run minify && npm test`); diff the
  per-test log against baseline. Regenerate only the *intended* visual refs (if
  any change) and justify each.
- Headless Fizzygum check: `?sw=1` renders `PatchProgrammingIcon` correctly at
  `dpr=1` and `dpr=2`.

---

## 11. Risks & open questions

- **Q1 (blocking): arc flattening gate.** Decide whether arcs are *always*
  flattened at build time (simplest, but threatens visual refs) or only when the
  draw CTM diverges from the build CTM (preserves byte-identical, but
  reintroduces a "did the transform change?" check — i.e., keeps a vestige of the
  interim design). Recommendation: gate it (preserve refs).
- **Q2: is the deeper fix worth it now?** Given §4 (no pixel change for handled
  cases), the concrete wins are: exact `arcTo`, spec-correct hit-testing,
  cleaner architecture. If those aren't currently needed, a cheaper alternative
  is **Approach B′ — formalize the interim fix**: make `arcTo` exact (resample
  like arc), apply `_resolvePathForDraw` to `isPointInPath`/`InStroke` (and fix
  the test), and document it as the intended design. Lower risk, closes the same
  gaps, but keeps the per-draw reconstruction. The team should choose A vs B′
  before starting.
- **Reflection/degenerate transforms:** confirm reflections (negative scale) and
  near-singular CTMs behave (the back-transform route inherits
  `StrokeGenerator`'s handling; add tests).
- **Perf:** build-time flattening front-loads work onto path construction;
  stroke still pays one `drawT⁻¹`. Both negligible vs rasterization, but measure
  on the Fizzygum text/blit hot path.

---

## 12. Recommendation

If the goal is the textbook architecture: take **Approach A** (device-space
baking + §7.1 Option A flattening, gated per Q1 + §7.2 recommended stroke
route). If the goal is closing the known gaps at minimum risk: take **Approach
B′** (formalize/complete the interim fix). Both reach the same spec semantics;
A is cleaner and self-contained, B′ is smaller and lower-risk. Resolve Q1/Q2
first — they determine the scope and the visual-ref blast radius.

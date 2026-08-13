# Direct-dispatch gaps: deep review, defect fixes, and fast-path coverage extension

**✅ EXECUTED IN FULL 2026-08-13** — Tier A (A1–A7) landed as seven fix commits with
pinning tests (`tests/core/059`–`065`); Tier B resolved every item (B1 implemented,
benchmarked at DEAD PARITY, and REJECTED per its own review clause — decision + harness
kept; B2/B3/B5 decided-and-recorded; B4 pinned); Tier C close-out done. All ten §9 gap
entries are struck or converted to decision records (now entries 1–13 in
`DIRECT-RENDERING-SUMMARY.MD` §9). The close-out record, including the downstream
re-vendor dispatch-move list, is §6 at the bottom of this file.

**PLAN ONLY. Written to be executed COLD by an LLM/engineer with ZERO prior context.**
Authored 2026-08-12 against SWCanvas `430cafa`; **fact-checked in full and revised 2026-08-13
at HEAD `0f0d25d`** — every claim below was re-verified against `src/` at that SHA (three
independent read-only sweeps + empirical `node` probes against a current `dist`). The two
commits after `430cafa` (`619dc1c`, `0f0d25d`) are drawImage/sampling work only — **no shape
dispatch, no `src/renderers/*` file, and none of the code paths this plan touches drifted.**
`file:line` refs below are cited from `src/` at `0f0d25d`; lines DRIFT — the quoted code and
method names are authoritative, grep them fresh before trusting a number.

**⚠⚠ REPO-STATE WARNING (verified 2026-08-13).** The audit this plan consumes is UNVERSIONED:
the §3 per-entry dispatch table and the §9 gap ledger of `DIRECT-RENDERING-SUMMARY.MD` exist
ONLY as an uncommitted working-tree modification (+107/−12; no commit contains them), and this
plan file itself is the repo's only untracked file. The two artifacts reference each other and
are the two halves of the same audit — a `git checkout -- DIRECT-RENDERING-SUMMARY.MD` or a
stash mishap destroys the audit and silently guts this plan. **Step 0 of execution (§2) is to
get both committed (with owner approval — house rule). Never clean the tree before that.**

**MANDATE.** The 2026-08-12 dispatch audit (recorded as `DIRECT-RENDERING-SUMMARY.MD` §3
per-entry table + §9 gap entries 1–10) found two kinds of debt: (a) real DEFECTS in the
dispatch/fallback layer (a CTM-broken legacy fallback generation, silently dropped paint and
shadows, an unwired opacity case), and (b) COVERAGE the direct layer could own but forfeits
(most visibly: rects under a general affine CTM fall to the generic pipeline although the quad
machinery to draw them directly already exists). This plan eliminates the defect class — the
legacy fallback GENERATION is to be retired, not patched case-by-case — and extends fast-path
coverage where a review finds it practical, with each extension either landed or explicitly
justified-and-recorded as not-worth-it. No gap may survive unreviewed.

---

## §0 Orientation

SWCanvas is a deterministic 2D raster engine (same input → identical pixels, Node and browser)
with a dual API (`src/core/Context2D.js` + the HTML5 facade
`src/compat/CanvasCompatibleContext2D.js` — **public-API changes must update both**). Draw calls
dispatch between per-shape DIRECT renderers (`src/renderers/*Ops.js`, hot loops with
preprocessor-expanded blend templates) and a generic path-based pipeline
(`Rasterizer`/`PolygonFiller`). The complete dispatch-condition reference — freshly audited and
truthed-up — is `DIRECT-RENDERING-SUMMARY.MD` §3 (Universal-Conditions-with-scope table,
Shape-Specific table, and the per-entry dispatch summary table); its §9 lists the ten gap
entries this plan consumes. Read those two sections FIRST; this plan does not restate them.
⚠ Two reading notes: (1) §9 opens with a pre-existing "Low Priority Enhancements" numbered
list whose own item 1 is unrelated (clipRect/clipCircle convenience methods); the ten gap
entries are the SECOND numbered list, under the heading "Defects / inconsistencies found by
the 2026-08-12 dispatch audit". (2) The §3 table's `drawImage` row is one generation stale —
`619dc1c`/`0f0d25d` added NN-vs-bilinear sampling arms gated on effective sample step plus an
`imageSmoothingEnabled` context property; truth that row up in Tier C while editing the doc.

**The one mechanism everything in Tier A pivots on (verified).** The current default path
BAKES the CTM at path-build time (`moveTo` `Context2D.js:472`, `_emitBakedArc:559`,
`_bakeArc:587`; the invariant comment at `:440-460` says so explicitly), and `fill()`/`stroke()`
UN-BAKE and re-apply it for the current default path (`:1867-1879`, `:1912-1920`: invert,
transform the points back, set `opTransform = drawT` — a net identity round-trip). Consequence:
building a path from *device-space* coordinates always costs exactly ONE spurious application
of the CTM — and it costs it whether or not the caller swaps in `Transform2D.IDENTITY` before
`fill()`/`stroke()`, because any swap happens AFTER the bake. Code needing an un-baked
user-space path must build its own `SWPath2D` and pass it as an external path (then `fill(path)`
takes the `opTransform = this._transform` branch and rasterizes correctly under the live CTM).

Key invariants from `CLAUDE.md` that bound this work:
- `npm run build` before EVERY test run (expands `/*@inline:...*/` markers; stale dist = testing
  old behaviour).
- `clearRect`'s composite-pipeline bypass is BY DESIGN — do not "fix" it (gap 8's epsilon note
  is in scope; its architecture is not).
- Perf claims come from `node tests/direct-rendering/scripts/benchmark-session.js` only
  (⚠ it REQUIRES `--output <file>` — see §3 for the invocation).
- Visual tests run the same registry in Node and browser; test bodies use the standard Canvas
  API only.
- `Transform2D`/`Color`/etc. are immutable — clone, don't mutate.

**Downstream consumer caveat (Fizzygum).** Fizzygum vendors this repo by pin
(`Fizzygum/vendor/swcanvas.pin` — currently `0f0d25d`, i.e. Fizzygum has already re-vendored
past this plan's authoring SHA twice, both drawImage commits) and screenshots byte-exactly.
Moving a case from the generic pipeline to a direct renderer CHANGES ITS RASTERIZATION — the
two regimes use different sampling conventions (verified in-source, the audit doc does NOT
state this): `QuadScanOps.fillQuad` evaluates edge intersections at INTEGER scanline y
(`QuadScanOps.js:134`) with columns `ceil(min)…ceil(max)-1` (`:188-190`), while
`PolygonFiller` samples PIXEL CENTERS (`PolygonFiller.js:114` `y + 0.5`; `:144-145`
`ceil(x - 0.5)`) — a systematic half-pixel offset in BOTH axes, not merely a half-integer-
geometry edge case. The rotated-rect direct arm already ships fillQuad's convention. So each
landed change must state, in the close-out, which dispatch cases moved — the Fizzygum
re-vendor session predicts reference exposure from that list. For the flagship item (rects
under shear/mirror-rotation/rot+non-uniform): Fizzygum's islands compose only rotation +
uniform scale — `TransformSpec` is a similitude with no shear/non-uniform degree of freedom
(`Fizzygum/docs/architecture/transforms.md`, "similitude — uniform scale + rotation", scalars
canonical) — so Fizzygum has ZERO exposure there.

## §1 The work items (each = review deeply → fix/extend or justify-and-record)

Numbered as in `DIRECT-RENDERING-SUMMARY.MD` §9. Every §9 claim was re-verified against `src/`
on 2026-08-13 (all ten confirmed real; corrections woven in below). The executor should still
spot-check the quoted code before acting — lines drift — then act, then update §9 (strike the
entry or convert it to a documented-decision note) and the §3 tables if dispatch changed.

### Tier A — defect fixes (do these first; each is small and independently testable)

- **A1 (gap 2, the big one): retire the LEGACY fallback generation.** Six sites — confirmed
  exhaustive (`grep -n "this.beginPath()" src/core/Context2D.js` = 7 hits in exactly these 6
  methods; `fillOuterStrokeArc` has two) — build the current default path from
  already-DEVICE-space coordinates, which the bake-and-round-trip mechanism (§0) then charges
  one spurious CTM application: `_fillCircleDirect` (`:3090`), `_strokeCircleDirect` (`:3178`),
  `_strokeLineDirect` (`:3258`), `fillArc`'s tail (`:2808`), `outerStrokeArc`'s tail (`:2929`),
  `fillOuterStrokeArc`'s tail (`:3008`). ⚠ **Mechanism correction (matters for review AND
  fix):** the three `_*Direct` sites DO swap in `Transform2D.IDENTITY` — but AFTER the bake
  (`:3096-3097` etc.), where it only prevents a third application; the in-code comment claiming
  the swap compensates is FALSE. A reviewer who greps for the identity swap will misread those
  sites as already fixed — they are not; all six land on the same net error, and it fires under
  plain `translate` (probe: gradient `fillCircle(20,20,10)` under `translate(30,30)` renders at
  centre (80,80) instead of (50,50); same class for `fillArc`, `strokeLine`).
  `fillStrokeCircle`'s non-Color fallback (`:2719-2720`) routes into sites 1–2, a third entry
  point into the defect. **The only correct fix is the un-baked user-space `SWPath2D` form**
  already used by every pre-gate (e.g. `fillCircle`'s `!isUniformScale` arm, `:2596-2602`) —
  NOT hoisting the identity swap before the bake, which would fix geometry but then evaluate
  gradient/pattern paint in device space (wrong pixels a different way; see §4). Convert all
  six tails; add a regression visual test per entry exercising the fallback under a rotated or
  translated CTM (e.g. gradient-fill circle under `rotate(30°)`).
- **A2 (gap 1): wire `fillCircle`'s opaque-color + `globalAlpha < 1` case** to
  `CircleOps.fill_Alpha`. The hole (`_fillCircleDirect:3073-3077`): `isOpaqueColor` requires
  `globalAlpha >= 1`, `isSemiTransparentColor` requires `a < 255` — opaque colour at
  `globalAlpha 0.5` satisfies neither and falls to the A1-broken fallback. ⚠ **This makes A2
  the most user-visible Tier A symptom, not a gradient edge case:** a plain solid-colour
  `fillCircle` at `globalAlpha 0.5` under `translate(30,30)` renders 30px off TODAY
  (probe-verified). Every sibling handles the case (`fillRect:740` → `fill_AA_Alpha`,
  `fillRoundRect:1430`, `_strokeCircleDirect:3129`, `fillArc:2780`, `fillStadium:1688`).
  One condition change + a visual test at `globalAlpha 0.5` (assert position under a translate,
  so it also regression-covers the A1 interaction).
- **A3 (gap 3): `fillOuterStrokeArc` must FALL BACK, not drop, non-Color halves.** Confirmed at
  `:2982-2986`: `hasFill`/`hasStroke` embed `instanceof Color`, and the fallback tail re-uses
  them (`:3012`, `:3021`) — gradient fill + solid stroke draws the stroke only (at the
  A1-wrong position); **gradient fill + gradient stroke draws NOTHING AT ALL** (probe: n=0).
  It is the only family member with this hole (`fillStrokeCircle`, `fillStrokeRect`,
  `fillStrokeRoundRect` delegate to single-purpose entries and are safe). Recompute presence
  for the fallback from paint existence, not paint type. Test: gradient fill + solid stroke
  arc, plus the both-gradient nothing-at-all case.
- **A4 (gap 5): `_noShadow` transparency by VALUE.** Confirmed: `_updateNoShadowFlag`
  (`Context2D.js:211-216`) tests `shadowColor === Color.transparent` (reference identity),
  while `ShadowPipeline.needsShadow` (`src/filters/ShadowPipeline.js:19-26`) tests
  `shadowColor.a > 0`. Scope (verified): the OR'd zero-blur/offset clause saves the default
  state, and every non-default route allocates a fresh Color (`setShadowColor:410`, the compat
  CSS parser), so the divergence bites exactly at the common "disable the shadow by colour,
  leave blur/offset set" idiom — `_noShadow` goes false and EVERY rect/roundRect/stadium
  direct path silently abandons to the generic pipeline. **This is a whole-family fast-path
  loss with correct output, not a wrong-pixels bug** — a de-pessimization, kept in Tier A
  because A5 builds on the fixed flag. Check `shadowColor.a === 0`; assert byte-identity with
  a before/after visual pair.
- **A5 (gap 4): decide the shadow POLICY for circle/arc/line direct paths.** Confirmed: the
  rect family gates through `_canUseDirectRendering`(`:224-226`)/`_canUseDirectRenderingForFillStroke`(`:236`),
  both containing `_noShadow`; the circle/arc/line gates are hand-rolled and shadow-blind
  (`:3070`, `:3120`, `:2694`, `:2776`, `:2857`, `:2982`, `:3206`), and `grep -rn shadow
  src/renderers/` = zero hits — the direct renderers cannot draw one. ⚠ One non-uniformity to
  cover in tests: `fillCircle` opaque + `globalAlpha < 1` DOES draw its shadow today (the A2
  hole drops it into the generic path) — at the A1-wrong position; after A1+A2 land, that case
  goes direct and would LOSE its shadow unless A5 lands too, which is one more reason A1→A5
  order matters. Two options: (i) gate to the (post-A1, now-correct) generic fallback when a
  real shadow is active — correct, cheap, matches the rect families; (ii) implement shadow
  support in the direct renderers — out of proportion. **Default: (i).** Add the `_noShadow`
  term (post-A4) to their inline gates + one visual test per family (shadowed
  fillCircle/strokeLine/fillArc now render shadows).
- **A6 (gaps 6, 9): argument/alpha/throw consistency sweep.** Verified per-entry: `fillRect`,
  `strokeRect`, and `strokeLine` have NO up-front validation (every other entry validates
  types with its own throw and early-returns negative/zero dims; circles/arcs guard
  `radius <= 0`). Consequences sharper than "divergence": (a) **negative-dimension
  `strokeRect` is a PIXEL BUG** — probe: `strokeRect(10,10,-20,20)` paints 19 stray pixels,
  `(…,20,-20)` 21, where HTML5 requires normalization-or-nothing; (b) the succeeds-or-throws
  divergence is THREE-way — bad args produce three different messages from three different
  layers depending on paint source (`'Point must have numeric x and y'` from Transform2D on
  the direct path, `'Rectangle coordinates must be numbers'` from the rasterizer, `'Point x
  coordinate must be a finite number'` from stroke geometry); (c) **`clearRect` calls
  `transform.invert()` UNGUARDED at `:1140`** — under a singular CTM it throws
  `'Transform2D matrix is not invertible'` where `fillRect`/`fill()` silently draw nothing
  (they try/catch at `:1870`/`:1914`) — same theme, fix it here. On alpha: ⚠ **no entry
  anywhere checks `globalAlpha === 0`** (grep-verified) — the inconsistency is about the PAINT
  colour's `a === 0`: `fillArc`/`outerStrokeArc` truly early-return (`:2792`/`:2884`), the
  rect family falls through to the GENERIC pipeline (paint-existence gate fails), and
  `fillCircle`/`strokeLine` run their direct `_Alpha` writers scanning-and-writing-nothing.
  Unify as early-return-no-draw on paint `a === 0` at every entry (cheapest, matches
  `fillArc`); decide whether `globalAlpha === 0` deserves the same guard while there (it is a
  pure no-op draw either way). Document all of it in the §3 tables.
- **A7 (gaps 7, 8): dash + clearRect epsilon — decide-and-document, some code likely.**
  **Dash (verified):** `setLineDash` is fully implemented and the GENERIC path honours it
  (`stroke()` forwards `lineDash`/`lineDashOffset` at `:1951-1952` →
  `StrokeGenerator._applyDashPattern`); every direct stroke entry ignores it (no `_lineDash`
  read anywhere in the dispatch layer). ⚠ **`strokeRect` is dash-blind on BOTH branches**: its
  generic fallback hand-builds the stroke props and OMITS the dash fields (`:970-975`), so the
  "gate dashed strokes to the generic path" remedy works for circle/roundRect but NOT for
  `strokeRect` until that props list is completed — one-line fix, do it regardless of the
  policy chosen. Then either honour dash by gating dashed direct strokes to the generic path,
  or document "dash is `stroke()`-only" as the contract in the docs + §3. **clearRect epsilon
  (verified, consequence restated):** `_clearRectDirect:1110` tests raw
  `b === 0 && c === 0` where everything else uses `TRANSFORM_EPSILON` (`Transform2D.js:50`,
  the sole holdout, also the sole place re-deriving axis-alignment by hand instead of reading
  `transform.isAxisAligned`). Probe shows NO pixel divergence at sub-epsilon rotations — do
  not promise one; the real cost is the perf cliff onto the per-pixel inverse-transform loop
  (`:1137-1161`) for `|b|,|c| ∈ (0, 1e-4)` (plus the unguarded-invert throw, filed under A6).
  Align the test to `transform.isAxisAligned` or record why not (the bypass architecture is
  protected; the epsilon choice is not).

### Tier B — coverage extension (the owner's ask; review for practicality, then land or record)

- **B1 (gap 10, flagship): rects under GENERAL affine CTMs go direct.** A transformed rectangle
  is a parallelogram; `QuadScanOps.fillQuad` (`QuadScanOps.js:90`) fills quads and is already
  what `RectOpsRot.fill_Rot_Any` (`RectOpsRot.js:236`) renders through (corners built
  `:253-258`, delegated `:261`). Verified qualifications: **fillQuad is CONVEX-only**
  (min/max-per-scanline, header says "NOT for general polygons") — fine for affine images of a
  rect, which are always convex parallelograms; and **fillQuad has NO `clipRect` parameter**,
  so a new quad arm is born tier-0-unwired — this makes the "B5 only AFTER B1" ordering a
  CORRECTNESS sequencing, not a convenience (a partial wiring would silently drop the clip —
  the exact bug class `6b20dcc` fixed; see the LineOps note at `Context2D.js:3196-3202`).
  Proposed shape: in `fillRect`'s dispatch (`:742` axis-aligned / `:775` uniform-scale /
  `:803` fall-through), replace the `isUniformScale` arm's rotation-only math with a
  corner-transform + quad-fill arm covering EVERY remaining CTM (shear, mirror-with-rotation,
  rotation+non-uniform) — the generic fallback for solid-color source-over fillRect disappears
  except for the §3-universal gates. Review points: (a) `fill_Rot_Any` takes
  center/angle/dims (verified) and cannot express shear — either generalize to four corners or
  add a `fill_Quad_Any` (none exists today; `fillQuad` itself is a Layer-0 primitive taking a
  pre-packed params object, not a dispatch-level entry); (b) sampling semantics — **answered,
  see §0's caveat: fillQuad and the generic filler differ by a systematic half-pixel in both
  axes**, so visual-test expectations MOVE with the change (deterministic either way; budget
  churn accordingly, and note the rotated arm already ships fillQuad's convention); (c) perf —
  benchmark-session on the new arm vs generic (expect the usual direct-path win; if it does
  NOT win, record that and stop).
  **Strokes**: non-uniform transforms vary edge thickness with direction. Options: four
  per-edge quads at per-edge widths (exact for parallelograms); or keep strokes generic under
  `!isAxisAligned && !isUniformScale` and record why (the geometric-mean width the direct arm
  would use is the same approximation `strokeLine` already accepts — decide whether that
  precedent extends). Fill first; strokes only if the fill lands cleanly.
- **B2: roundRects/stadiums under non-uniform AXIS-ALIGNED scale.** The uniform-scale gate is
  confirmed at all four sites (`:1207`, `:1425`, `:1570`, `:1684` — "non-uniform would make
  ellipses"). An axis-aligned non-uniform scale of a roundRect is a roundRect with per-axis
  radii. Current radii truth (verified, sharper than authored): arrays are accepted at the API
  surface (JSDoc `number|number[]`; compat passes through unvalidated) and collapsed
  **first-element-wins** at TWO independent layers — dispatch-level
  (`radii[0]`, `:1189`/`:1407`/`:1549`) and renderer-level (`RoundedRectUtils.normalizeRadius`,
  which ALSO rounds the radius to an integer — a second silent narrowing). ⚠ **The collapse is
  NOT documented anywhere public** — `DOCS.md` is a documentation index with no API content;
  the only record is the JSDoc in `RoundedRectUtils.js:8-9`. Documenting it (or fixing it) is
  a deliverable of this item, wherever the review lands. ⚠ **Semantics hazard:** HTML5's
  `roundRect` radii array is PER-CORNER (up to 4 entries, each optionally `{x,y}`) — reading
  `radii[0..1]` as `[rx,ry]` would CONFLICT with the spec meaning, not fulfil it; also SWCanvas
  has no `roundRect()` path method at all, only the fill/stroke/fillStroke immediate entries,
  so there is no spec-conformance anchor to preserve. Review whether `RoundedRectOpsAA` can
  take rx/ry (elliptical corner quadrants — Bresenham ellipse instead of circle; zero rx/ry
  support exists today, grep-verified); if yes, `scale(2,1)` roundRects/stadiums go direct and
  the radii semantics get decided DELIBERATELY (per-corner spec shape vs a documented SWCanvas
  extension). If the ellipse-corner renderer is disproportionate, record that verdict in §9,
  keep the gate, and STILL document the array collapse.
- **B3: circles/arcs under non-uniform scale** = ellipses. The correct-result fallback exists
  and is verified at all six entries (`:2596`, `:2632`, `:2670`, `:2743`, `:2832`, `:2951` —
  user-space `SWPath2D` under the CTM; pinned by `tests/core/054-circle-arc-nonuniform-scale-gate.js`).
  An `EllipseOps` direct family is a real project — review COST only, record a verdict, do not
  build by default. ⚠ Correction to the authored text: **`ellipse()` DOES exist as a PATH
  method in both API layers** (`Context2D.js:512`, `CanvasCompatibleContext2D.js:382`, baked
  via `_bakeEllipse`); what does not exist is a direct/immediate-mode `fillEllipse`/
  `strokeEllipse` entry or an `EllipseOps` renderer. Do not add either in this plan — and do
  not duplicate the existing path method.
- **B4: fused-path hairline rule.** Verified: the hairline rule ("draw AT one pixel, take the
  missing width out of the OPACITY" — doctrine comment `Context2D.js:21-57`) is restated
  inline at the five standalone stroke entries (`:850`, `:1215`, `:2865`, `:3110`, `:3208`;
  landed by `d6e6765`), and the FUSED entries bypass it — ⚠ **all four of them, not two**:
  `fillStrokeRect`, `fillStrokeRoundRect`, `fillStrokeCircle`, `fillOuterStrokeArc` pass raw
  `globalAlpha` into their `fillStroke_*` renderers, whose `lineWidth <= 1` arms paint at full
  weight. The bypass is DECLARED deliberate at `Context2D.js:53-56` ("no hairline caller
  exists; untested surface"), mirrored in the summary doc; `tests/core/055` scopes itself to
  the five standalone entries. Either wire the hairline rule into the fused `_Any` renderers
  for consistency, or keep the doctrine and add the missing fused-entry test documenting the
  full-opacity contract. Small either way.
- **B5: tier-0 clip wiring for the unwired arms.** Verified wiring map: WIRED —
  `RectOpsAA` (all six single-purpose statics), `RoundedRectOpsAA` incl. `fillStroke_AA_Any`,
  `CircleOps` incl. `fillStroke_Any`, `StadiumOps`, `PolygonFiller._fillPolygonsDirect`.
  NOT wired — `RectOpsRot`, `RoundedRectOpsRot`, `ArcOps`, `LineOps`, `QuadScanOps`,
  **and `RectOpsAA.fillStroke_AA_Any`** (signature ends at `clipBuffer`). ⚠ Precision fix to
  the authored list: "fillStrokeRect unwired" is true of the RECT fused entry only — it calls
  `_ensureClipBuffer()` unconditionally at `:1005`; `fillStrokeRoundRect`'s AA arms and
  `fillStrokeCircle` ARE tier-0-wired; only rotated arms materialise the bitmask. The
  omissions are documented as deliberate in-code for ArcOps (`:2765-2772`), LineOps
  (`:3196-3202`, the partial-wiring hazard), and the `*_Rot_*` arms (`:726-733` etc.) — but
  **`fillStrokeRect` has NO in-code note**; its only record is the UNCOMMITTED summary-doc
  line. Add that comment even if the arm stays unwired. Pure perf otherwise: re-review only
  AFTER B1 (which touches the same dispatch sites AND creates the new unwired quad arm — see
  B1's correctness note); land only with a benchmark-session delta; otherwise leave the
  documented notes standing. **Prior art — do not re-design:** `plans/clipping-optimization.md`
  (committed) is the tier-0 design doc; its §9 Stage 4 pre-designs the LineOps answer
  (Cohen-Sutherland endpoint clipping for 1px strokes); B5 should execute/adapt that, and
  Tier C should refresh that plan's stale "execute Stages 1–3" banner (Stages 1–3 have since
  landed via `6b20dcc`/`277e8e3`/`7414c35`/`af9af84`).

### Tier C — close-out

- Re-run the FULL verification battery (§3). Update `DIRECT-RENDERING-SUMMARY.MD`: §3 tables
  reflect the new dispatch truth **including the stale `drawImage` row** (NN-vs-bilinear on
  effective sample step + `imageSmoothingEnabled`, from `619dc1c`/`0f0d25d`); §9 entries
  struck or converted to decision records; §11 coverage matrix + `npm run update-test-counts`
  if tests were added. Update the public docs for any contract changed or newly documented
  (dash policy, validation, the radii-array collapse from B2). Refresh
  `plans/clipping-optimization.md`'s status banner (B5 note above). Write the per-change
  dispatch-move list for the Fizzygum re-vendor session (§0 caveat), re-baselined against
  whatever the pin is at close (it was already `0f0d25d` at revision time).

## §2 Cold-execution protocol

0. **Repo-state gate (see the warning up top).** `git -C <repo> status` — expect
   `DIRECT-RENDERING-SUMMARY.MD` modified and this plan untracked *unless the owner has since
   committed them*. If still uncommitted: present a commit of BOTH files to the owner and get
   it landed before any other work; do not stash, do not checkout, do not clean.
1. Read `DIRECT-RENDERING-SUMMARY.MD` §3 + §9 fully (mind the §9 double-list note in §0), then
   this plan. Spot-check quoted code against `src/` before acting on an item (lines drift).
2. `npm run build && npm test && npm run test:direct-rendering` — green baseline FIRST.
3. Execute A1→A7 in order (A1 before A2's position test and before A5 — A5's fallback routing
   assumes correct fallbacks, and the A2/A5 shadow interaction (see A5) wants A1+A2 landed
   first; A4 before A5 — A5 reuses `_noShadow`). One commit per item, each with its test(s),
   each after a full `npm run build && npm test && npm run test:direct-rendering` pass.
4. Then B1; B2–B5 as their reviews conclude (B5 strictly after B1 — correctness ordering, see
   B1/B5). Perf-relevant items carry a `benchmark-session.js` before/after in the commit
   message.
5. Tier C close-out. Present the commit stack to the owner before pushing (house rule).

## §3 Verification protocol

- `npm run build` before every test run (non-negotiable — stale-dist trap).
- `npm test` (78 core + 154 visual at revision time — the authored "46 core + 153 visual" was
  stale even on authoring day) + `npm run test:direct-rendering` (79) — counts grow;
  `npm run update-test-counts` at close (it rewrites `README.md`, `tests/README.md`,
  `CLAUDE.md`).
- Dual-API parity: any Context2D signature/validation change lands in
  `CanvasCompatibleContext2D` the same commit.
- Perf: `node tests/direct-rendering/scripts/benchmark-session.js --output <file>` only
  (`--output` is REQUIRED; see its header for `--filters`/`--shapes`/`--warmup-ms`).
- Determinism: visual tests run identically Node vs browser; new dispatch arms must not
  introduce environment-dependent math (integer/dyadic arithmetic in the quad corner
  transform; the existing `Transform2D.transformPoint` is already the shared primitive).

## §4 Rejected / protected — do not re-attempt

- **`clearRect` back onto the composite pipeline** — protected by CLAUDE.md, deliberate design.
- **Ellipse direct renderers built speculatively (B3)** — review cost, record verdict; the
  correct-ellipse-via-generic fallback is the deliberate P6 design and stays default.
- **Fixing legacy fallbacks in place with per-site transform resets** — the generation is the
  defect; A1 converts them to the external-path form instead of patching six variants of the
  same mistake. Specifically REJECTED: hoisting the existing identity swap before the bake —
  verified to fix geometry while breaking gradient/pattern paint space (the paint source would
  evaluate in device coords); the swap-too-late sites (`_fillCircleDirect` etc.) are evidence
  this halfway shape gets written and then trusted. External user-space `SWPath2D` or nothing.

## §5 References

- `DIRECT-RENDERING-SUMMARY.MD` §1–3 (dispatch truth, per-entry table), §9 (the gap ledger this
  plan consumes — the SECOND numbered list in that section), §11 (test coverage matrix).
  ⚠ Uncommitted at revision time — see the repo-state warning.
- `CLAUDE.md` (invariants), `build-scripts/README.md` (inline-marker build).
- `plans/clipping-optimization.md` — tier-0 clip design doc (§6.5, §9 Stage 4 = LineOps
  pre-design for B5); banner stale, Stages 1–3 landed.
- Tests pinning current contracts: `tests/core/049`/`051`/`052` (tier-0 clip),
  `054` (non-uniform circle/arc gate), `055` (hairline rule, five standalone entries).
- Prior art for the dispatch-gate case law: the Fizzygum-side
  `docs/archive/direct-shape-fastpaths-followups-plan.md` (P1 falsified the circle
  identity-gate myth; P6 added the uniform-scale ellipse gates this plan's B3 respects).
- Provenance: the §3 per-entry table is the product of the 2026-08-12 dispatch audit
  (Fizzygum session); this plan's §1 items map 1:1 onto §9 entries 1–10. The 2026-08-13
  revision re-verified every §1 claim against `src/` at `0f0d25d` with empirical probes;
  probe details (bounding boxes, pixel counts) live in that session's transcript — the
  load-bearing facts are all restated inline above.

## §6 Close-out record (2026-08-13 execution)

Commit stack (on top of `0f0d25d`): `a23e939` step-0 audit landing · `be8b2c2` A1 ·
`f80b919` A2 · `4c0c69d` A3 · `eb69e4d` A4 · `66a19d1` A5 · `96dbfba` A6 · `4f07f01` A7 ·
`e319c4f` B1 (rejection record) · `55123f5` B2+B3 · `b11ceb2` B4 · `c3dff04` B5 ·
Tier C docs commit. Verification at close: 88 core + 154 visual + 79 direct-rendering,
all green after every commit.

**Dispatch-move list for the Fizzygum re-vendor session** (baseline: pin `0f0d25d`;
every move below happens between that pin and this campaign's HEAD):

1. **Fallback pixels move where they were previously WRONG** (A1): gradient/pattern/
   non-source-over circle/arc/line draws under any non-identity CTM now render at the
   correct place with paint evaluated in user space. Byte-exposure only where Fizzygum
   drew those combinations under a CTM — they were misrendered before, so any reference
   capturing them was capturing a bug.
2. **fillCircle, opaque color + globalAlpha < 1** (A2): generic → direct
   (`CircleOps.fill_Alpha`) — non-AA circle rasterization instead of pixel-center
   polygon sampling, and (with A5) the shadow policy of the direct family.
3. **Rect/roundRect/stadium draws under a value-transparent shadow colour with non-zero
   blur/offset** (A4): generic → direct; output byte-identical (pinned by test 062).
4. **Solid-color circle/arc/line draws with an ACTIVE shadow** (A5): direct → generic;
   the shape re-rasterizes under the generic convention and GAINS the previously-dropped
   shadow. Fizzygum exposure: any SWCanvas-side shadowed direct-shape call.
5. **DASHED immediate-mode strokes** (A7): direct → generic, and now render dashed
   instead of solid — a behaviour fix; solid strokes untouched.
6. **Negative-dimension fillRect/strokeRect, singular-CTM clearRect, a=0/globalAlpha=0
   draws** (A6): no pixel-producing moves — all draw nothing (strokeRect's stray pixels
   gone; two throw paths became silent no-ops).
7. **NOT moved** (B1 rejected): rects under shear/mirror-rotation/rot+non-uniform stay
   generic — dispatch for every CTM class is unchanged; Fizzygum's
   rotation+uniform-scale islands were never in scope (similitudes, §0 caveat).

Since Fizzygum composes only similitudes and (per the §0 caveat) had zero exposure on
the flagship item, the realistic exposure set is items 2, 4 and 5 — and only where
Fizzygum actually issues those calls on the SW backend. Screenshot-reference churn, if
any, needs the usual eyeball + webkit-verify pass, not blind recapture.

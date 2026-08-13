# One rect-fill pipeline: retire the Rasterizer bespoke arm, then remove the four parity fill fast-paths

**PLAN ONLY. Written to be executed COLD by an LLM/engineer with ZERO prior context.**
Authored 2026-08-13 against SWCanvas `1819328` (all evidence below measured at that HEAD or
during the same-day campaign that produced it; `file:line` refs cited fresh at `1819328` —
lines DRIFT, the quoted code and method names are authoritative, grep them before trusting a
number). Owner decision on record: eliminate ALL FOUR parity fill arms, accepting the
reference churn and the AA arm's small measured edge (see §2.1) — simplicity is the goal.

**MANDATE.** SWCanvas currently contains THREE independent implementations of "fill an
axis-aligned solid-color rectangle" (the direct `RectOpsAA` arm, `PolygonFiller`'s solid span
arm, and `Rasterizer._fillAxisAlignedRect`'s per-pixel `blendPixel` loop) plus per-shape fill
arms measured at dead parity with the generic pipeline. This plan ELIMINATES the redundancy:
after it, exactly ONE code path fills rectangles (PolygonFiller), roundRect/stadium fills ride
the same generic pipeline as every path fill, and the dispatch layer stops routing fills
anywhere else. Not a perf campaign — a simplification campaign with measured no-perf-cost
evidence and a controlled downstream (Fizzygum) reference migration.

---

## EXECUTION STATUS (updated as phases land — 2026-08-13 session)

- **Phase A — DONE.** Bespoke branch + `_fillAxisAlignedRect` deleted; the device-bbox
  corner block feeding only it deleted too. Gates: (a) full battery green (254 + 79);
  (b) integer-geometry byte-identity probe direct-vs-generic **0 px** — opaque, α=128,
  axis-aligned scale(2,1), dispatch difference proven live per draw via the path-based
  flag; (c) **zero** committed visual-output PNGs moved (177 tracked — nothing to
  eyeball); (d) perf before/after: see the table in this box. §9 entry 15 written.
- **Phase B step 0 (re-census)** — DONE. Preview swap injection-PROVEN (marker in
  `fizzygum-boot-sw-min.js`), all four gates `false &&`-disabled on the Phase-A engine:
  **164/293 failed, `geometry-violations: 0`** (list:
  `Fizzygum-tests/.scratch/…/census-failing-164.json`, also in the session scratchpad).
  Diffpage sample (10 tests, both dprs, `fg classify` + pixel forensics in
  `Fizzygum-tests/.scratch/census-diffviz/`): the §2.3 menu-shadow Δ1 class is GONE
  (menu screenshots down from 1,295 Δ1 px to 15–42 boundary px — Phase A cured it), and
  most diffs are the honest §2.2 classes (corners/bands/caps, counts 15–320/screenshot at
  maxΔ 127–248). **NEW FINDING (the plan's §2.3 "~nothing post-A" prediction was wrong):**
  a second ±1 class, whole-region Δ1 on TRANSLUCENT fills under `globalAlpha`
  (box/highlight tests: 7k–43k px, 100% Δ1). Root cause, probe-isolated (256-alpha sweep,
  direct-vs-generic, dispatch proven live): fillStyle-alpha alone is byte-identical
  (0/255 alphas differ); the divergence is GLOBAL-ALPHA COMPOSITION ONLY (30/100
  globalAlpha values differ). The direct arms compose float
  (`effectiveAlpha = (color.a/255)*globalAlpha`, `RectOpsAA.fill_AA_Alpha`); the generic
  pipeline quantizes to a byte first (`Color.withGlobalAlpha` `Math.round`, via
  `PolygonFiller._evaluatePaintSource`). The quantized convention is the engine's DOMINANT
  one (every path fill/gradient/stroke already composes globalAlpha this way), so the
  fill-arm removal CONVERGES fills onto it — the divergence dies with the arms being
  deleted; nothing is hiding in the survivor. Churn class accepted into the recapture
  scope; owner eyeballs at Phase C before any recapture (and may still reject there).
- **B1 fillRect** — DONE. `:763` block (AA + rot branches) deleted; 066 collapsed to the
  all-CTMs-generic pin (renamed `066-fillrect-all-ctms-generic-pin.js`); 062 reduced to
  byte-identity + visible-shadow; 6 DR rect cases flipped (`allowPathBasedRendering:
  true` + rationale); 054/055 fixture flag-resets moved AFTER the background fillRect
  (the reset preceded a now-generic fixture fill — the flag is global). Battery green
  (254 + 79). 13 committed PNGs moved, each eyeballed (strips in
  `Fizzygum-tests/.scratch/b1-eyeball/`): rotated-fill boundary hairlines + Δ1
  alpha-composition on translucent fills — the two expected classes, nothing else.
- **B2 fillRoundRect** — DONE. `:1521` ladder deleted; radius≤0→fillRect delegation kept;
  `RoundedRectOpsAA.fill_AA_Opaq/Alpha` deleted (~200 lines) after a fresh caller grep
  found zero callers (fused arm composes `RectOpsAA` fills); class-header hierarchy +
  "see fill_AA_Opaq" anchors re-pointed at `RectOpsAA`. 4 fill-only DR roundrect cases
  flipped (fill+stroke cases ride the fused arm and stay direct — unchanged). Battery
  green (254 + 79); **zero** committed PNGs moved (the visual corpus has no plain
  roundRect fills).
- **B3 fillStadium** — DONE. `:1795` block deleted (incl. the rotated
  `RoundedRectOpsRot` delegation); `StadiumOps.js` deleted (224 lines) after a fresh
  caller grep; `build.sh` concat entry removed. `tests/core/053`: the
  caps-byte-identical-to-`fillCircle` pin RETIRED (it compared two DIRECT arms' shared
  Bresenham construction; stadium is generic now, circle is not — header records it);
  crisp-box, symmetry, single-blend, tier-0, transform and containment checks all still
  hold and pass unchanged. Battery green (254 + 79). ONE PNG moved
  (`stadium-fill-contract.basic.png`, 24 px on the cap arcs) — eyeballed: box exact,
  symmetry intact, one-pixel staircase difference on the arc quadrants (the §2.2 cap
  class). Stale `StadiumOps` labels in `debug/` updated.
- **B4 sweep** — DONE. Fresh dead-code greps: `RectOpsAA.fill_AA_*`,
  `RectOpsRot.fill_Rot_Any`, `RoundedRectOpsRot.fill_Rot_Any` all still have live callers
  as INTERNALS (fused arms, radius-0 fallbacks) — kept and relabelled as internals
  everywhere they are documented; nothing else went callerless. New inverted pin
  `tests/core/069` (three fill entries generic × every CTM × both opacities, AND the four
  stroke/fused siblings still direct — the second half guards over-reach). Core tests
  88→89. `DIRECT-RENDERING-SUMMARY.MD` updated end-to-end (§9 entry 16 = the full decision
  record; exec summary, §1, §2.1/2.2/2.3b, §3, §4, §5, §7, §8, §11). `update-test-counts` +
  the CLAUDE.md line it misses; both consistency checkers clean. Battery green (255 + 79),
  no PNG moved.
- **Phase C** — NOT STARTED (owner-attended session). Inputs ready: the SWCanvas stack is
  5 commits on `main`, unpushed; the recapture scope to expect is the 164-test census list
  above (`Fizzygum-tests/.scratch/census-failing-164.json`), which was measured with all
  four arms disabled on the Phase-A engine — i.e. exactly this stack's behaviour.

Phase A perf evidence (gate d, rect-aa-perf + roundrect-aa-perf fill-semi, 12
super-measurements, warmup 2000 ms, median ms after/before): rect szXXS 1.026 ·
szXS 1.032 · szS 1.037 · szM 1.016 · szL 1.008 · szXL 1.003 · szXXL 1.009;
roundrect szXXS 1.032 · szXS 1.010 · szS 1.019 · szM 1.020 · szL 1.005 ·
szXL 1.002 · szXXL 1.006. As predicted: these fills still take the DIRECT arm in
Phase A (dispatch untouched — probe (b) proved direct dispatch live on the after
build), so the ≤4% small-case drift is session noise at CV ~1–2%, not a code
effect; the big-case ratios (≤1%) bound any real shift. Evidence filed, no gate.

---

## §0 Orientation

SWCanvas is a deterministic 2D raster engine (same input → identical bytes, Node and browser)
with a dual API (`src/core/Context2D.js` + `src/compat/CanvasCompatibleContext2D.js`). Draw
calls dispatch between per-shape DIRECT renderers (`src/renderers/*Ops.js`) and a generic
path pipeline (`Rasterizer`/`PolygonFiller`). The dispatch truth reference is
`DIRECT-RENDERING-SUMMARY.MD` §3; its §9 (entries 1–14) is the decision ledger of the
2026-08-13 direct-dispatch campaign (13 commits, `0f0d25d..ad1a703`, pushed) that this plan
builds on. Downstream, Fizzygum vendors SWCanvas by pin (`Fizzygum/vendor/swcanvas.pin`) and
screenshot-tests byte-exactly (293 SystemTests at revision time; 1748 reference files).

**Why this plan exists.** After the campaign, same-day follow-up measurements (owner-driven)
established that the FILL fast paths do not pay: benchmark-session runs with the arms
disabled (dispatch difference proven live via the path-based flag both times) measured dead
parity for tilted rect fills, roundRect fills (AA and rotated), and near-parity for AA rect
fills (§2.1). The owner chose removal of all four. A churn census then found that naively
disabling `fillRect`'s arm moves **102 of 293** Fizzygum tests — and diffing the failures
revealed the churn is NOT the fills' rasterization convention: it is a third bespoke
implementation hiding inside the GENERIC side (`Rasterizer._fillAxisAlignedRect`), which
blends translucent fills ±1 differently from the shared templates. Removing it first
(Phase A) collapses the migration to the small honest convention changes (§2.3).

**⚠ CRITICAL REFRAME 1 — Phase A is a correctness PREREQUISITE for Phase B, not an
optimization.** `_fillAxisAlignedRect`'s pixel loop tests only `clipMask`, never the tier-0
`clipRect` (verified: the loop's sole clip check is
`if (this._currentOp.clipMask && this._isPixelClipped(px, py))`). It is unreachable with a
live `clipRect` TODAY only because `_tier0ClipRect()` requires source-over + `_noShadow`, and
every solid source-over unshadowed fillRect currently takes the DIRECT arm instead. Remove
the direct arm without Phase A and tier-0-clipped solid fills route into
`_fillAxisAlignedRect` and DRAW OUTSIDE THE CLIP — the exact partial-wiring bug class
`6b20dcc` fixed in the roundRect fallbacks (see the LineOps note at `Context2D.js`'s
`_strokeLineDirect`). Phase order is mandatory.

**⚠ CRITICAL REFRAME 2 — the ±1 churn class is a PRE-EXISTING inconsistency, not a removal
artifact.** `_fillAxisAlignedRect` already runs today for SHADOWED solid axis-aligned rect
fills (shadow → `_noShadow` false → generic → its unclipped solid arm). So shipped SWCanvas
already blends the same translucent fill differently depending on whether a shadow is active.
Phase A fixes a real live inconsistency; the fill-arm removal merely made it visible at scale.

## §1 Current state (verified at `1819328`)

### 1.1 The three rect-fill implementations

1. **Direct arm** — `Context2D.fillRect` at `:745`, gate
   `if (this._canUseDirectRendering(this._fillStyle))` at `:763`: axis-aligned →
   `RectOpsAA.fill_AA_Opaq/Alpha` (span writes through the shared inline templates); tilted
   uniform → `RectOpsRot.fill_Rot_Any` (QuadScanOps DDA). General-affine falls through
   (rejected extension, §9 entry 10, pinned by `tests/core/066`).
2. **Generic polygon pipeline** — `PolygonFiller.fillPolygons` with the tier-0-wired
   solid-color span arm `_fillPolygonsDirect`; blends through the SAME inline templates as
   the direct arm. Handles clipMask, clipRect, all composites, gradients/patterns.
3. **The bespoke Rasterizer arm** — `Rasterizer.fillRect` (`:149`) →
   `_fillRectInternal` (`:178`), which routes:
   - `clipMask || _requiresCanvasWideCompositing(composite)` → path route (`_fillInternal`,
     standard machinery), with one documented byte-identical micro-arm
     `_fillFullCoverCanvasWide` (`:196`) for the BitmapText `source-in` tint (~128×/frame
     measured) — **KEEP that micro-arm**;
   - else: device bbox via `Math.floor(min)`/`Math.floor(max − 1)` (its own fractional
     convention), then `transform.b === 0 && transform.c === 0` (RAW, no epsilon — the same
     holdout class A7 fixed in clearRect) AND Color → **`_fillAxisAlignedRect` (`:247`)**:
     per-pixel loop calling `CompositeOperations.blendPixel` with
     `finalColor = colorObj.withGlobalAlpha(globalAlpha)` (`Color.js:125`) — the effective
     alpha is QUANTIZED to a byte, then `blendPixel` lerps with `Math.round`
     (`src/utils/CompositeOperations.js:116-118`). The shared templates instead compute
     float-alpha un-premultiplied Porter-Duff and store through `Uint8ClampedArray`
     rounding. Result: translucent fills land ±1 different (measured: 1,295 px at Δ1,
     `166→165`, across one menu-shadow screenshot);
   - else → `PolygonFiller.fillPolygons` on the user-space rect polygon (gradients under any
     transform, non-axis-aligned solids).

### 1.2 The four parity fill dispatch arms and their deletable graphs

| Arm | Dispatch site | Renderer statics | Deletable on removal |
|---|---|---|---|
| AA rect fill | `fillRect` `:763` block, AA branch | `RectOpsAA.fill_AA_Opaq/Alpha` | dispatch only (~80 lines) — statics stay: called by `RoundedRectOpsAA` (`:373`,`:468`,`:935`,`:937`) and the fused arm |
| Tilted rect fill | same block, `isUniformScale` branch | `RectOpsRot.fill_Rot_Any` | dispatch only (~35 lines) — static stays: `fillStroke_Rot_Any` (`RectOpsRot.js:530`), `RoundedRectOpsRot` r=0 fallback (`:259`) |
| RoundRect fills | `fillRoundRect` `:1521` block (identity→AA→rot ladder) | `RoundedRectOpsAA.fill_AA_Opaq` (`:363`), `fill_AA_Alpha` (`:458`); `RoundedRectOpsRot.fill_Rot_Any` | dispatch (~110 lines) + **both `RoundedRectOpsAA.fill_AA_*` statics (~190 lines) become DEAD** (only callers are the dispatch; the fused arm composes `RectOpsAA` fills + its own corner code). `RoundedRectOpsRot.fill_Rot_Any` stays (own fused arm `:1484`) |
| Stadium fills | `fillStadium` `:1795` block | `StadiumOps.fill_Opaq/Alpha`; rot delegates to `RoundedRectOpsRot.fill_Rot_Any` | dispatch (~120 lines) + **the ENTIRE `StadiumOps.js` file (224 lines)** — its only external callers are this dispatch |

The fused `fillStroke*` arms, all stroke arms, and all circle/arc arms are OUT OF SCOPE:
strokes and circles/arcs are structural wins (outline construction and arc flattening avoided,
never measured at parity), and the fused arms exist for seam-prevention correctness.

### 1.3 Existing tests that pin the CURRENT dispatch (must be reworked in Phase B)

- `tests/core/062` — asserts fillRect/fillRoundRect with an invisible shadow stay DIRECT
  (structural `wasPathBasedUsed` checks). After Phase B the structural half is vacuous:
  rework to byte-identity-only, keeping the §9-entry-5 story in its header.
- `tests/core/066` — asserts general-affine fillRect stays generic AND the AA/Rot arms stay
  direct. The stays-direct guards flip to stays-generic (the whole entry is then
  uniformly generic — collapse the test into a single all-CTMs-generic pin and update its
  decision-record header to cite THIS plan).
- `tests/core/067` — radii collapse byte-identity: unaffected (byte-level pin, both arms of
  the comparison move together).
- **`tests/direct-rendering/` (79 cases)** — the runner verifies direct paths are INVOKED.
  Every rect/roundrect fill-op case (and any scene case whose fills were direct) will fail
  structurally after Phase B. Work item: flip those cases' expectations to path-based (the
  runner's per-case expectation mechanism — read
  `tests/direct-rendering/run-direct-rendering-tests.js` and `direct-rendering-test-utils.js`
  for how a case declares expected dispatch), or retire fill-only cases with a rationale
  line. Do NOT silently delete coverage: the perf cases (`perf-cases/`) stay — they measure
  whatever pipeline serves the call.

## §2 Evidence (all measured 2026-08-13; restated inline so no transcript hop is needed)

### 2.1 Disable-and-benchmark: fill arms vs generic (benchmark-session.js, 12 super-measurements, CV ≤ ~1%, dispatch difference proven live via the path-based flag on both dists)

Ratio = generic/fast median; >1 means the fast path genuinely wins.

| Case | rect mean | roundrect mean | Worst single case |
|---|---|---|---|
| fill-opaque, axis-aligned | 1.02x | 1.00x | rect szXXL 1.04x |
| fill-semi, axis-aligned | 1.02x | 1.00x | rect szS 1.06x |
| fill-opaque, rotated | 1.00x | 1.00x | — flat |
| fill-semi, rotated | 1.01x | 1.00x | — flat |

The AA rect arm's 2–6% edge on small/mid alpha fills is the ONLY measured win across all
fills; the owner explicitly accepted losing it. Related priors, same day, same protocol:
the general-affine quad arm measured 0.99–1.02x and was rejected (§9 entry 10); the
BLEND_ALPHA opaque-destination micro-optimization measured 0.98–1.00x and was rejected
(§9 entry 14). Stadium has no perf case; its algorithm class (span walk + cap geometry)
matches roundRect → parity by proxy, do not build a perf case just for this.

### 2.2 Convention probes (direct vs `fill(external SWPath2D)`, current engine, 90×70 canvases)

| Case | Diff |
|---|---|
| AA rect fill, integer geometry, opaque AND α=128, incl. axis-aligned `scale(2,1)` | **0 px** |
| AA rect fill, fractional geometry (10.3, 10.7, 50.4×29.6) | 31 px (edge rows/cols) |
| Tilted rect fill (rotate 0.5) | 27 px (boundary band; integer-scanline vs pixel-center) |
| roundRect r=10 fill, opaque and α=128 | 14 px (corner arcs; Bresenham quadrants vs arcTo-flattened) |
| stadium fill | 10 px (caps) |

Also verified: `Rasterizer.fillRect`'s POLYGON route and `fill(path)` are the same machinery,
and integer-geometry rects through `rasterizer.fillRect` matched `fill(path)` exactly in the
probed cases (the α=128 probe value 227/142/142 cannot discriminate round-vs-truncate;
the ±1 class needs boundary values like 165.75 and shows up at suite scale, not in that probe).

### 2.3 Fizzygum churn census (suite = 293 tests, dpr1, preview vendor-swap, marker-verified live)

- `fillRect` arm alone disabled (Phase B without Phase A): **102/293 failed**. Diff forensics
  (via `fg diffpage`): dominated by uniform Δ1 shifts across translucent-fill regions
  (menu/window shadows; 1,295 px in one screenshot, all `166→165`) = the
  `_fillAxisAlignedRect` blend divergence of §1.1(3) — NOT the fills' own convention.
  Plus a small fractional-edge class: 8–16 scattered px in window-resize tests (Δ130-class
  single pixels; the `Math.floor` bbox convention vs the AA arm's crisp convention).
- Expected census AFTER Phase A (to be re-measured — §3 Phase B step 0): only the honest
  convention classes of §2.2 — tilted bands, roundRect corners, stadium caps, fractional
  edges. Fizzygum paints axis-aligned integer-geometry rects almost exclusively
  (`NON_INTEGER_GEOMETRY` gate; suite ran with `geometry-violations: 0`), so the AA-arm
  removal itself should contribute ~nothing post-A.

## §3 The work

### Phase A — one generic rect fill: retire `_fillAxisAlignedRect`

1. In `_fillRectInternal`, delete the axis-aligned bespoke branch (`transform.b === 0 &&
   transform.c === 0 && Color` → `_fillAxisAlignedRect`) so every non-clipMask,
   non-canvas-wide fill takes the existing `PolygonFiller.fillPolygons` route (already the
   gradient/rotated route; tier-0 `clipRect` and clipMask both wired there). Delete
   `_fillAxisAlignedRect` itself. Also now-dead: the corner-transform/bbox block above it if
   the polygon route recomputes it (check: `fillPolygons` takes the USER-space polygon + the
   op transform, so the device-bbox block feeding only the deleted branch goes too). KEEP
   `fillRect`'s validation, the `ShadowPipeline.renderWithShadow` wrapper, and the
   `_fillFullCoverCanvasWide` micro-arm (documented, byte-identical, hot).
2. Do NOT "fix" `_fillAxisAlignedRect` in place (clipRect + rounding patches): the bespoke
   generation is the defect — the A1 lesson from the parent campaign (§9 entry 2). Retire it.
3. **Gates (in order):**
   a. `npm run build && npm test && npm run test:direct-rendering` — full battery.
   b. Integer-geometry byte-identity probe: direct fillRect vs the NEW generic route
      (temporarily force-generic via a scratch `false &&` on the `:763` gate, then restore)
      must be 0 px for integer opaque and α=128 — this is the Phase-B enabling condition.
   c. Expected SWCanvas-side churn (eyeball each): committed visual-output PNGs containing
      TRANSLUCENT SHADOWED axis-aligned rect fills may move ±1 (the shape pixels of shadowed
      fills switch from blendPixel to template blending; OPAQUE shadowed fills are exact
      under both — `blendPixel` source-over at α=1 returns src verbatim). Fractional-origin
      unclipped generic fills switch from the floor-bbox convention to pixel centers.
      Sub-epsilon-shear generic fills (raw `b===0&&c===0` vs the polygon route) also move —
      same epsilon-holdout cleanup as A7's clearRect fix.
   d. Perf: benchmark-session `{"test":"rect-aa-perf","op":"fill-semi"}` before/after —
      the fills measured here still take the DIRECT arm in Phase A, so expect NO change;
      what Phase A can slow is the (rare today) generic-solid population. Record whatever
      is measured; there is no perf gate to pass, only evidence to file.
4. One commit. §9 gains a decision entry (15): the three-implementations story, the clip
   trap, the ±1 mechanism, this plan's name.

### Phase B — remove the four fill dispatch arms (strictly after A; one commit per arm)

**Step 0 — re-census.** Preview vendor-swap the Phase-A build into Fizzygum (backup
`vendor/swcanvas/swcanvas.js` + `swcanvas.min.js`, copy from `dist/`, `fg build`, verify a
minification-surviving marker, run `fg suite`), with ALL FOUR fill gates `false &&`-disabled,
to get the TRUE recapture scope. Expect the §2.2 classes only. If the failure set is still
dominated by full-window diffs → STOP, diagnose with `fg diffpage` before removing anything
(a second bespoke divergence would be hiding). Restore the vendor swap afterwards.

Then per arm, in this order (each: remove code → full battery → commit):

- **B1 `fillRect`**: delete the `:763` block (AA + rot branches). Rework `tests/core/066`
  into the all-CTMs-generic pin; rework `tests/core/062` per §1.3. Flip/adjust the
  direct-rendering fill cases for rect (§1.3 bullet 3).
- **B2 `fillRoundRect`**: delete the `:1521` ladder; delete the now-dead
  `RoundedRectOpsAA.fill_AA_Opaq/Alpha` (verify with a fresh caller grep first — the fused
  arm must still build). Keep the radius≤0 → `fillRect` delegation (it now lands generic).
  Direct-rendering roundrect fill cases per §1.3.
- **B3 `fillStadium`**: delete the `:1795` block and the `StadiumOps.js` file (fresh caller
  grep first). The stadium's generic fallback (external `SWPath2D` roundRect r=min/2)
  already exists and is the shipped non-uniform path.
- **B4 sweep**: fresh dead-code grep over `fill_Rot_Any` callers (both files — they must
  still have live fused/r=0 callers, else delete), `update-test-counts`, per-entry §3 table
  rows in `DIRECT-RENDERING-SUMMARY.MD` (fillRect/fillRoundRect/fillStadium fills → "always
  generic"), strike/convert the relevant §9 entries, add inverted structural pins (one core
  test asserting all three entries' fills dispatch generic — model: the current test 066).

Each commit message carries the §2.1 parity table row that justifies it. The AA arm's
commit must state the accepted 2–6% small-alpha-fill cost explicitly (owner decision,
2026-08-13).

### Phase C — Fizzygum migration (single coordinated event)

1. Push the SWCanvas stack (owner approval per house rules).
2. Re-vendor: `Fizzygum/scripts/vendor-swcanvas.sh --source <SWCanvas checkout>` (rewrites
   the pin; stale-min gate built in — run `npm run build && npm run minify` first).
3. `fg build`, prove the new engine live (marker or structural probe), `fg suite` → the
   failing set IS the recapture scope from Phase B step 0 (must match; investigate any
   surplus).
4. `fg diffpage <failing tests> --dprs=1,2` + `fg classify` → owner eyeballs the review
   page (convention-band/corner diffs only; anything else → stop).
5. `fg recapture --auto` (prints COMPLETE/INCOMPLETE — INCOMPLETE means missing captures,
   re-run), then the full `fg gauntlet` INCLUDING the webkit leg (references are shared
   cross-engine; a recapture that only Chrome verifies is the known trap —
   `fizzygum-recapture-masks-crash-webkit-safeguard` case law).
6. Pin-bump commit in Fizzygum; present both repos' stacks for push approval.

## §4 Verification protocol

- `npm run build` before EVERY test run (stale-dist trap). Full battery = `npm test`
  (88 core + 154 visual at authoring) + `npm run test:direct-rendering` (79; count will
  change in Phase B — `npm run update-test-counts` then, and hand-fix the count line in
  `CLAUDE.md`, the script misses it).
- Byte-identity checks ride the battery: the visual tests regenerate every committed output
  PNG — `git status` on `tests/output/` + `tests/dist/output/` after a run is the
  empirical did-any-pixel-move gate. Eyeball anything that moved; nothing may be committed
  un-eyeballed.
- Perf claims: `node tests/direct-rendering/scripts/benchmark-session.js --output <file>
  --filters '{"test":"rect-aa-perf","op":"fill-semi"}'` (add `--super-measurements 12
  --warmup-ms 2000` for the ~35s/case profile used for all §2.1 numbers). The
  `"rect-aa-perf"` filter string-matches `roundrect-aa-perf` too — one run covers both.
- Fizzygum legs: `fg build` / `fg suite` / `fg diffpage` / `fg recapture --auto` /
  `fg gauntlet` — invoke as `/Users/davidedellacasa/code/Fizzygum-all/fg …` (absolute path;
  cwd is a trap). Preview vendor swaps must PROVE injection (marker grep in
  `Fizzygum-builds/latest/js/fizzygum-boot-sw-min.js`) before any conclusion is drawn from a
  green or red run.

## §5 Rejected / protected — do not re-attempt

- **Patching `_fillAxisAlignedRect` in place** (add clipRect, fix rounding): the bespoke
  generation is the defect; retire it (parent campaign's A1 lesson, §9 entry 2).
- **Deleting `_fillFullCoverCanvasWide`**: documented byte-identical micro-arm on a measured
  hot path (BitmapText `source-in` tint, ~128×/frame). Keep.
- **Re-adding any fill fast path without fresh benchmark evidence**: §2.1 is the falsification
  record; the inverted pins exist to force this conversation.
- **General-affine quad arm** (§9 entry 10), **BLEND_ALPHA micro-surgery** (§9 entry 14),
  **premultiplied surface format** (entry 14's boundary: breaks the public non-premultiplied
  `Surface.data` contract — Fizzygum presents the raw buffer zero-copy via
  `WorldWdgt.coffee` `putImageData`; also sacrifices exact-value read-back, an identity
  decision the owner made deliberately).
- **Removing stroke/circle/arc/fused arms on "same grounds"**: NOT the same grounds — no
  parity measurement exists for them, they avoid geometry construction the generic path must
  do (outline building, arc flattening), and the fused arms are correctness features
  (seam prevention). Any future case needs its own §2.1-grade evidence.

## §6 References

- `DIRECT-RENDERING-SUMMARY.MD` §3 (dispatch truth — update in Phase B), §9 entries 1–14
  (campaign ledger; this plan adds 15+).
- `plans/direct-dispatch-gaps-and-coverage.md` — the parent campaign (EXECUTED banner; its
  §6 close-out lists the commit stack and the re-vendor exposure model).
- `plans/clipping-optimization.md` — tier-0 design; the clipRect-wiring map that makes
  Phase A's clip-trap argument legible.
- `CLAUDE.md` (invariants: build-before-test, dual-API parity, benchmark discipline).
- Fizzygum-side case law (umbrella memory): `fg recapture --auto` completeness,
  webkit-verify-any-recapture, diffpage/classify advisory flow, preview-swap
  injection-proof discipline.

## Start-prompt for the executing session

> Execute `plans/one-rect-fill-pipeline-and-fill-arm-removal.md` cold. Repo:
> `"/Users/davidedellacasa/code/Unified SW Canvas/SWCanvas"` (path has spaces — quote it;
> NOT the Fizzygum umbrella). Read the plan in full first; §0's two critical reframes are
> load-bearing (Phase A is a correctness prerequisite — clip-drop trap). Then: green
> baseline (`npm run build && npm test && npm run test:direct-rendering`), Phase A with its
> §3 gates (one commit), Phase B step-0 re-census in Fizzygum (preview vendor swap,
> injection-proven), then B1→B4 one commit each, then STOP before Phase C and present the
> stack — Phase C (push + re-vendor + recapture) needs the owner present for the eyeball
> and push approvals. House rules: build before every test run; never commit/push without
> presenting first; any pixel divergence gets eyeballed before it is committed.

Run this in a FRESH session — it needs a clean context and its own full time budget
(Phases A+B ≈ one long session; Phase C is a second, owner-attended session).

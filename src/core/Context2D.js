/**
 * CLIPPING: AN OPTIONAL IMMUTABLE MASK AND AN ALWAYS-TRACKED RECT
 *
 * The effective clip is (_clipMask ?? all visible) AND (_clipRect ?? whole
 * surface) — the intersection of every clip() since the matching save(), as
 * HTML5 Canvas defines it. It is split in two because nearly every real clip is
 * an axis-aligned integer rect (4 ints), while a general clip needs a per-pixel
 * mask (a canvas-sized bitmap: ClipMask, 1 bit per pixel, 1 = visible).
 *
 * - A clip() whose device-space path is exactly an axis-aligned rect
 *   (_detectAxisAlignedRect) only intersects into _clipRect. It never builds,
 *   reads or writes a mask, whether or not one is installed.
 * - Any other clip() rasterises its path into a FRESH all-clipped mask, and only
 *   inside the current _clipRect (the rect discards everything outside it
 *   anyway); the previous mask is ANDed into the fresh one, which is then
 *   installed. _clipRect stays set and keeps bounding every draw.
 * - An installed mask is IMMUTABLE. clip() swaps in a new mask instead of
 *   editing the old one, so save() shares the mask by reference and restore()
 *   puts the reference back — no bitmap copy on either side.
 * - A draw that can clamp its extent to the rect AND test the mask bit per pixel
 *   gets both (_clipRectForDraw / _clipMaskForDraw), which is exactly
 *   mask ∧ rect. A draw that takes ONE mask gets _combinedClipMask(): mask ∧ rect
 *   built on demand into a cache that belongs to the current (mask, rect) pair
 *   and is never installed as _clipMask.
 */

/**
 * HAIRLINE (SUB-PIXEL) STROKES ON THE DIRECT PATHS — ONE RULE
 *
 * A stroke narrower than one device pixel cannot be drawn narrower than one
 * pixel, so the engine draws it AT one pixel and takes the missing width out of
 * the OPACITY instead. That rule is the generic pipeline's
 * (Rasterizer._strokeInternal: any lineWidth < 1 renders at width 1.0 with
 * subPixelOpacity = lineWidth, threaded through PolygonFiller), and every
 * direct stroke entry below restates it:
 *
 *     isHairlineStroke  ->  the family's stroke1px_*Alpha renderer,
 *                           at globalAlpha * scaledLineWidth
 *
 * Three properties of that spelling are load-bearing:
 *
 * 1. It keys on the DEVICE width (scaledLineWidth, already multiplied by the
 *    transform's uniform scale), not the logical one, so a 0.5-logical stroke
 *    at scale 2 is a true 1px stroke and stays on the exact-1px path, while a
 *    1-logical stroke inside a shrunk island correctly goes faint. (The generic
 *    pipeline keys on the LOGICAL width — it widens the stroke geometry in user
 *    space and lets the CTM scale it — so the two pipelines agree at identity
 *    and diverge under scale by construction. That is not a bug to reconcile:
 *    the direct entries are device-space renderers.)
 * 2. The _Alpha variant is ALWAYS the target: the opacity product is < 1 by
 *    construction, so the _Opaq twin can never apply on this branch.
 * 3. It makes the hairline positionally CONTINUOUS with the exact-1px stroke —
 *    measured: as the width approaches 1 the painted pixel SET becomes
 *    identical to the 1px renderer's, differing only in opacity (debug/
 *    probe-hairline-strokes.js §5). Agreeing with the GENERIC path's position
 *    instead was never available: the direct and generic rasterizations already
 *    differ there at lineWidth 1 (188px of 96 for a rect at identity), which is
 *    the shipped behaviour of every lineWidth >= 1 caller.
 *
 * Deliberately NOT wired: the fused fillStroke* entries' stroke halves (no
 * hairline caller exists; untested surface), and gradient/pattern strokes at
 * any width (they have no _Alpha direct renderer and keep the generic path).
 */

class Context2D {
    // Static flag to track path-based rendering usage (for testing)
    // Reset before each test, check after to verify direct rendering was used
    static _pathBasedRenderingUsed = false;

    // Test-only oracle switch: when true, clip() runs the pure mask model — every
    // clip, rect-shaped or not, becomes a full-surface mask ANDed with the whole
    // prior clip, and no rect is tracked. Lets a harness render the same scene
    // both ways and assert the rect + mask model is byte-identical to it. Never
    // set in production. (See plans/clipping-optimization.md.)
    static _disableTier0Clip = false;

    /**
     * Reset the path-based rendering tracking flag
     * Call before running tests that should use direct rendering
     */
    static resetPathBasedFlag() {
        Context2D._pathBasedRenderingUsed = false;
    }

    /**
     * Check if path-based rendering was used since last reset
     * @returns {boolean} True if path-based rendering was used
     */
    static wasPathBasedUsed() {
        return Context2D._pathBasedRenderingUsed;
    }

    /**
     * Mark that path-based rendering was used (called internally)
     * @private
     */
    static _markPathBasedRendering() {
        Context2D._pathBasedRenderingUsed = true;
    }

    constructor(surface) {
        this.surface = surface;
        this.rasterizer = new Rasterizer(surface);

        // State stack (uses Snapshot/Memento pattern for storage only)
        this._stateStack = new StateStack();

        // Current state
        this._globalAlpha = 1.0;
        this._globalCompositeOperation = 'source-over';
        this._transform = Transform2D.IDENTITY;
        this._fillStyle = new Color(0, 0, 0, 255); // Black
        this._strokeStyle = new Color(0, 0, 0, 255); // Black

        // Stroke properties
        this._lineWidth = 1.0;
        this.lineJoin = 'miter'; // 'miter', 'round', 'bevel'
        this.lineCap = 'butt'; // 'butt', 'round', 'square'
        this.miterLimit = DEFAULT_MITER_LIMIT;

        // Line dash properties
        this._lineDash = []; // Internal working dash pattern (may be duplicated)
        this._originalLineDash = []; // Original pattern as set by user
        this._lineDashOffset = 0; // Starting offset into dash pattern

        // Shadow properties - HTML5 Canvas compatible defaults
        this.shadowColor = Color.transparent; // Transparent black (no shadow)
        this.shadowBlur = 0; // No blur
        this.shadowOffsetX = 0; // No horizontal offset
        this.shadowOffsetY = 0; // No vertical offset

        // Image smoothing (HTML5 imageSmoothingEnabled, default true). When true,
        // drawImage and pattern paint sample BILINEAR whenever the draw actually
        // resamples the image (any rotation/skew, or an axis-aligned draw whose
        // effective sample step != 1); step-1 axis-aligned draws are
        // nearest-neighbor byte-exact either way. When false, every draw samples
        // nearest-neighbor — including rotation, matching the HTML5 property's
        // semantics (which re-admits the thin-feature dashing bilinear exists to
        // prevent; that is the user's explicit choice, e.g. pixel art).
        this._imageSmoothingEnabled = true;

        // Internal path and clipping. The current default path holds DEVICE-space
        // geometry (the CTM is baked at build time); see the path methods below.
        this._currentPath = new SWPath2D();
        this._devCurrent = null; // current point (device space); null = no open subpath
        this._devSubStart = null; // current subpath start (device space)

        // Clip state — see CLIPPING at the top of this file. Effective clip =
        // (_clipMask ?? all visible) AND (_clipRect ?? whole surface).
        //   _clipRect     : { x0, y0, x1, y1 } device-space integer coords, half-open
        //                   [x0, x1) × [y0, y1), clamped to the surface; null = no
        //                   rect bound. Replaced wholesale, never mutated.
        //   _clipMask     : ClipMask or null. IMMUTABLE once installed: clip()
        //                   installs a fresh mask rather than editing this one,
        //                   because saved states share it by reference.
        //   _combinedClip : cached _clipMask ∧ _clipRect as one ClipMask (see
        //                   _combinedClipMask); null = not built. It belongs to the
        //                   current pair: clip() drops it, save()/restore() carry it.
        this._clipRect = null;
        this._clipMask = null;
        this._combinedClip = null;

        // Cached state flags for direct rendering eligibility (performance optimization)
        this._noShadow = true; // Updated when shadow properties change
        this._isSourceOver = true; // Updated when globalCompositeOperation changes

        // Text state (HTML5 Canvas-compatible). `_font` is the parsed shape produced
        // by CssFontParser ({style, weight, fontSize, fontFamily}) or null when the
        // user hasn't assigned a font yet. `null` means "nothing renderable" — we
        // don't default to '10px sans-serif' because BitmapText would have no atlas
        // for it and the silent failure would be confusing.
        this._font = null;
        this._textAlign = 'start';
        this._textBaseline = 'alphabetic';
        this._direction = 'inherit';
        // Picks up window.devicePixelRatio in browsers, defaults to 1 in Node.
        // Tests force determinism via `ctx.textPixelDensity = 1`.
        this._textPixelDensity = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    }

    // HTML5 Canvas-compatible lineWidth property with validation
    get lineWidth() {
        return this._lineWidth;
    }

    set lineWidth(value) {
        // HTML5 Canvas spec: ignore zero, negative, Infinity, and NaN values
        if (typeof value === 'number' && value > 0 && isFinite(value)) {
            this._lineWidth = value;
        }
        // Otherwise, keep the current value unchanged (ignore invalid input)
    }

    // HTML5 Canvas-compatible globalAlpha property with validation
    get globalAlpha() {
        return this._globalAlpha;
    }

    set globalAlpha(value) {
        // HTML5 Canvas spec: "if the given value is either infinite, NaN, or not in
        // the range 0.0 to 1.0, then it must be ignored, without assigning a new
        // value" — so an invalid assignment leaves the previous alpha standing.
        //
        // This is NOT cosmetic conformance. Before it, the value was a plain public
        // field, so `ctx.globalAlpha = undefined` (or NaN) was stored RAW and every
        // downstream `(color.a / 255) * globalAlpha` went NaN — a fill then covered
        // ZERO pixels while its fillStyle, geometry and clip were all correct, and
        // nothing threw. Fizzygum shipped exactly that bug: a widget's specified
        // backgroundColor silently never painted (Fizzygum
        // docs/archive/dropped-background-fill-investigation.md). Native canvas
        // ignores the assignment, so the fault was invisible on the native backend
        // and only SWCanvas reproduced it.
        if (typeof value === 'number' && isFinite(value) && value >= 0 && value <= 1) {
            this._globalAlpha = value;
        }
        // Otherwise, keep the current value unchanged (ignore invalid input)
    }

    // HTML5 Canvas-compatible globalCompositeOperation property with cached flag
    get globalCompositeOperation() {
        return this._globalCompositeOperation;
    }

    set globalCompositeOperation(value) {
        this._globalCompositeOperation = value;
        this._isSourceOver = value === 'source-over';
    }

    // HTML5 Canvas-compatible imageSmoothingEnabled property (boolean IDL
    // attribute: any assigned value coerces to boolean, default true)
    get imageSmoothingEnabled() {
        return this._imageSmoothingEnabled;
    }

    set imageSmoothingEnabled(value) {
        this._imageSmoothingEnabled = !!value;
    }

    /**
     * Update cached shadow flag based on current shadow properties
     * @private
     */
    _updateNoShadowFlag() {
        // Exact negation of ShadowPipeline.needsShadow. Transparency is a VALUE
        // test (a === 0), not reference identity with Color.transparent: every
        // non-default route (setShadowColor, the compat CSS parser) allocates a
        // fresh Color, so an identity test misses "disable the shadow by
        // colour, leave blur/offset set" and abandons every rect-family direct
        // path for a shadow that would never be drawn.
        this._noShadow =
            !this.shadowColor ||
            this.shadowColor.a === 0 ||
            (this.shadowBlur === 0 && this.shadowOffsetX === 0 && this.shadowOffsetY === 0);
    }

    /**
     * True when a draw can have no visible effect under source-over: fully
     * transparent Color paint, or globalAlpha 0 (any paint). Used by every
     * direct-shape entry as an early-return-no-draw guard, so the
     * paint-a=0/globalAlpha-0 cases dispatch uniformly (previously: rects ran
     * the whole generic pipeline, circles/lines scanned writing nothing,
     * fillArc returned early - three behaviours for one no-op).
     * Deliberately restricted to source-over: other composites make invisible
     * paint visible ('copy' with transparent paint clears pixels), so they
     * keep the generic pipeline.
     * @param {Color|Gradient|Pattern} paintSource - The paint to check
     * @returns {boolean} true if the draw cannot change any pixel
     * @private
     */
    _isInvisibleDraw(paintSource) {
        return this._isSourceOver && (this.globalAlpha === 0 || (paintSource instanceof Color && paintSource.a === 0));
    }

    /**
     * Fast-path check for direct rendering eligibility.
     * @param {Color|Gradient|Pattern} paintSource - The paint to check
     * @returns {boolean} true if direct rendering can be used
     * @private
     */
    _canUseDirectRendering(paintSource) {
        return this._isSourceOver && this._noShadow && paintSource instanceof Color && paintSource.a > 0;
    }

    /**
     * The paint source an op draws with. A pattern samples under the context's
     * imageSmoothingEnabled at draw time, so the op gets the pattern's twin for
     * the current flag (Pattern.withSmoothing — memoized, no allocation per draw).
     * @param {Color|Gradient|Pattern} paintSource - fillStyle or strokeStyle
     * @returns {Color|Gradient|Pattern}
     * @private
     */
    _paintForOp(paintSource) {
        return paintSource instanceof Pattern ? paintSource.withSmoothing(this._imageSmoothingEnabled) : paintSource;
    }

    /**
     * Fast-path check for dual (fill+stroke) direct rendering eligibility.
     * @param {Color|Gradient|Pattern} fillPaint - Fill paint source
     * @param {Color|Gradient|Pattern} strokePaint - Stroke paint source
     * @returns {boolean} true if direct rendering can be used
     * @private
     */
    _canUseDirectRenderingForFillStroke(fillPaint, strokePaint) {
        if (!this._isSourceOver || !this._noShadow) return false;
        if (!(fillPaint instanceof Color) || !(strokePaint instanceof Color)) return false;

        const hasFill = fillPaint.a > 0;
        const hasStroke = strokePaint.a > 0 && this._lineWidth > 0;
        return hasFill || hasStroke;
    }

    // State management

    /**
     * Create a complete state snapshot for save/restore
     * @returns {Object} Snapshot of all saveable state
     * @private
     */
    _createSnapshot() {
        return {
            globalAlpha: this.globalAlpha,
            globalCompositeOperation: this._globalCompositeOperation,
            transform: new Transform2D([
                this._transform.a,
                this._transform.b,
                this._transform.c,
                this._transform.d,
                this._transform.e,
                this._transform.f
            ]),
            fillStyle: this._fillStyle, // Paint sources are immutable, safe to share
            strokeStyle: this._strokeStyle, // Paint sources are immutable, safe to share
            // Clip state: the mask, the rect and the combined-mask cache are all
            // immutable once set, so the snapshot shares references — no copy.
            clipMask: this._clipMask,
            clipRect: this._clipRect,
            combinedClip: this._combinedClip,
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit,
            lineDash: this._lineDash.slice(), // Copy working dash pattern array
            originalLineDash: this._originalLineDash.slice(), // Copy original pattern
            lineDashOffset: this._lineDashOffset,
            // Shadow properties
            shadowColor: this.shadowColor, // Color is immutable, safe to share
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY,
            // Image smoothing
            imageSmoothingEnabled: this._imageSmoothingEnabled,
            // Cached state flags
            _noShadow: this._noShadow,
            _isSourceOver: this._isSourceOver,
            // Text state
            font: this._font,
            textAlign: this._textAlign,
            textBaseline: this._textBaseline,
            direction: this._direction,
            textPixelDensity: this._textPixelDensity
        };
    }

    save() {
        this._stateStack.push(this._createSnapshot());
    }

    /**
     * Apply a state snapshot to restore context state
     * @param {Object} snapshot - Previously saved state
     * @private
     */
    _applySnapshot(snapshot) {
        // Use backing fields directly to avoid setter overhead (flags are saved
        // separately; a snapshot only ever holds already-validated values)
        this._globalAlpha = snapshot.globalAlpha;
        this._globalCompositeOperation = snapshot.globalCompositeOperation;
        this._transform = snapshot.transform;
        this._fillStyle = snapshot.fillStyle;
        this._strokeStyle = snapshot.strokeStyle;

        // Restore the clip state as one unit: the combined-mask cache comes back
        // with the very (mask, rect) pair it was built from, so a cache built
        // after save() can never outlive its restore().
        this._clipMask = snapshot.clipMask ?? null;
        this._clipRect = snapshot.clipRect ?? null;
        this._combinedClip = snapshot.combinedClip ?? null;

        this._lineWidth = snapshot.lineWidth;
        this.lineJoin = snapshot.lineJoin;
        this.lineCap = snapshot.lineCap;
        this.miterLimit = snapshot.miterLimit;
        this._lineDash = snapshot.lineDash || [];
        this._originalLineDash = snapshot.originalLineDash || [];
        this._lineDashOffset = snapshot.lineDashOffset || 0;

        // Restore shadow properties
        this.shadowColor = snapshot.shadowColor || Color.transparent;
        this.shadowBlur = snapshot.shadowBlur || 0;
        this.shadowOffsetX = snapshot.shadowOffsetX || 0;
        this.shadowOffsetY = snapshot.shadowOffsetY || 0;

        // Restore image smoothing (older snapshots predating the field restore
        // to the HTML5 default, true)
        this._imageSmoothingEnabled = snapshot.imageSmoothingEnabled ?? true;

        // Restore cached state flags
        this._noShadow = snapshot._noShadow ?? true;
        this._isSourceOver = snapshot._isSourceOver ?? true;

        // Restore text state
        this._font = snapshot.font !== undefined ? snapshot.font : null;
        this._textAlign = snapshot.textAlign || 'start';
        this._textBaseline = snapshot.textBaseline || 'alphabetic';
        this._direction = snapshot.direction || 'inherit';
        this._textPixelDensity = snapshot.textPixelDensity !== undefined ? snapshot.textPixelDensity : 1;
    }

    restore() {
        if (this._stateStack.isEmpty()) return;
        this._applySnapshot(this._stateStack.pop());
    }

    // Transform methods
    // HTML5 Canvas spec: transformations POST-multiply (current * new)
    transform(a, b, c, d, e, f) {
        const m = new Transform2D([a, b, c, d, e, f]);
        this._transform = this._transform.multiply(m);
    }

    setTransform(a, b, c, d, e, f) {
        this._transform = new Transform2D([a, b, c, d, e, f]);
    }

    resetTransform() {
        this._transform = Transform2D.IDENTITY;
    }

    // Convenience transform methods - all post-multiply per HTML5 Canvas spec
    translate(x, y) {
        this._transform = this._transform.translate(x, y);
    }

    scale(sx, sy) {
        this._transform = this._transform.scale(sx, sy);
    }

    rotate(angleInRadians) {
        this._transform = this._transform.rotate(angleInRadians);
    }

    // Style setters - support solid colors and paint sources
    setFillStyle(r, g, b, a) {
        if (arguments.length === 1 && (r instanceof Color || r instanceof Gradient || r instanceof Pattern)) {
            // Paint source (gradient or pattern)
            this._fillStyle = r;
        } else {
            // RGBA color
            a = a !== undefined ? a : 255;
            this._fillStyle = new Color(r, g, b, a);
        }
    }

    setStrokeStyle(r, g, b, a) {
        if (arguments.length === 1 && (r instanceof Color || r instanceof Gradient || r instanceof Pattern)) {
            // Paint source (gradient or pattern)
            this._strokeStyle = r;
        } else {
            // RGBA color
            a = a !== undefined ? a : 255;
            this._strokeStyle = new Color(r, g, b, a);
        }
    }

    // Shadow property setters with validation
    setShadowColor(r, g, b, a) {
        if (arguments.length === 1 && r instanceof Color) {
            this.shadowColor = r;
        } else {
            a = a !== undefined ? a : 255;
            this.shadowColor = new Color(r, g, b, a);
        }
        this._updateNoShadowFlag();
    }

    setShadowBlur(blur) {
        Validators.nonNegative(blur, 'shadowBlur');
        this.shadowBlur = blur;
        this._updateNoShadowFlag();
    }

    setShadowOffsetX(offset) {
        Validators.number(offset, 'shadowOffsetX');
        this.shadowOffsetX = offset;
        this._updateNoShadowFlag();
    }

    setShadowOffsetY(offset) {
        Validators.number(offset, 'shadowOffsetY');
        this.shadowOffsetY = offset;
        this._updateNoShadowFlag();
    }

    // Path methods — the context's *current default path*.
    //
    // Per the HTML5 Canvas spec, the current default path bakes in the current
    // transformation matrix (CTM) at the moment each path-building method is
    // called; only a Path2D object is transform-independent. We honor this by
    // transforming every coordinate by this._transform BEFORE recording it, so
    // this._currentPath always holds DEVICE-space geometry. A later transform
    // change (including restore()) never moves already-recorded geometry.
    //
    // Circles/arcs are not affine-invariant (an affine maps a circle to an
    // ellipse), so arc/ellipse/arcTo are flattened to device-space line segments
    // at build time, sized for their on-screen radius. Béziers are affine-
    // invariant, so their control points are baked and the curve is flattened at
    // draw time. Consequences at draw time (see fill/stroke/clip/isPointInPath):
    //   - fill()/clip() of the current default path run under IDENTITY.
    //   - stroke() maps the device centerline back by drawT⁻¹, strokes with the
    //     round pen (lineWidth in draw-time user space), and lets drawT forward
    //     the outline (anisotropic under a non-uniform/sheared drawT).
    //   - isPointInPath() tests the query point against device geometry directly.
    //
    // INVARIANT: only these methods write to this._currentPath, and they always
    // bake. Code needing an un-baked, user-space path (e.g. the roundRect
    // fallbacks) must build its own SWPath2D and pass it as an external Path2D.
    beginPath() {
        this._currentPath = new SWPath2D();
        this._devCurrent = null;
        this._devSubStart = null;
    }

    closePath() {
        this._currentPath.closePath();
        this._devCurrent = this._devSubStart;
    }

    moveTo(x, y) {
        const p = this._transform.transformPoint({ x: x, y: y });
        this._currentPath.moveTo(p.x, p.y);
        this._devCurrent = p;
        this._devSubStart = p;
    }

    lineTo(x, y) {
        const p = this._transform.transformPoint({ x: x, y: y });
        this._currentPath.lineTo(p.x, p.y);
        this._devCurrent = p;
    }

    rect(x, y, w, h) {
        const t = this._transform;
        const p0 = t.transformPoint({ x: x, y: y });
        const p1 = t.transformPoint({ x: x + w, y: y });
        const p2 = t.transformPoint({ x: x + w, y: y + h });
        const p3 = t.transformPoint({ x: x, y: y + h });
        this._currentPath.moveTo(p0.x, p0.y);
        this._currentPath.lineTo(p1.x, p1.y);
        this._currentPath.lineTo(p2.x, p2.y);
        this._currentPath.lineTo(p3.x, p3.y);
        this._currentPath.closePath();
        // Per the spec, the current point after rect() is the rectangle's origin.
        this._devCurrent = p0;
        this._devSubStart = p0;
    }

    /**
     * Add a rounded rectangle subpath (HTML5 roundRect()): per-corner radii in CSS
     * border-radius order, overlap-scaled; the corner curves are baked through
     * this context's own arcTo, so they follow the CTM like every other path
     * method. Validation, the radii contract and the one divergence (no
     * elliptical {x, y} radii) are SWPath2D.roundRect's.
     * @param {number} x - Rectangle x
     * @param {number} y - Rectangle y
     * @param {number} w - Rectangle width
     * @param {number} h - Rectangle height
     * @param {number|number[]} [radii=0] - Corner radius, or a list of 1-4 corner radii
     */
    roundRect(x, y, w, h, radii) {
        x = +x;
        y = +y;
        w = +w;
        h = +h;
        if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) return;
        const corners = RoundedRectUtils.parseCornerRadii(radii);
        if (corners === null) return;
        SWPath2D.appendRoundRect(this, x, y, w, h, corners);
        // HTML5: the current point after roundRect() is (x, y), on a new subpath.
        this.moveTo(x, y);
    }

    arc(x, y, radius, startAngle, endAngle, counterclockwise) {
        this._bakeArc({
            x: x,
            y: y,
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle,
            counterclockwise: counterclockwise
        });
    }

    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
        this._bakeEllipse({
            x: x,
            y: y,
            radiusX: radiusX,
            radiusY: radiusY,
            rotation: rotation,
            startAngle: startAngle,
            endAngle: endAngle,
            counterclockwise: counterclockwise
        });
    }

    arcTo(x1, y1, x2, y2, radius) {
        this._bakeArcTo(x1, y1, x2, y2, radius);
    }

    quadraticCurveTo(cpx, cpy, x, y) {
        const t = this._transform;
        const cp = t.transformPoint({ x: cpx, y: cpy });
        const p = t.transformPoint({ x: x, y: y });
        this._currentPath.quadraticCurveTo(cp.x, cp.y, p.x, p.y);
        this._devCurrent = p;
    }

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        const t = this._transform;
        const cp1 = t.transformPoint({ x: cp1x, y: cp1y });
        const cp2 = t.transformPoint({ x: cp2x, y: cp2y });
        const p = t.transformPoint({ x: x, y: y });
        this._currentPath.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
        this._devCurrent = p;
    }

    /**
     * Append a baked curve to the current default path as device-space line
     * segments: sample `segments + 1` points at equal angle steps over the
     * (already-normalized) sweep [start, end], map each user-space point through
     * sampleFn and then the current CTM, and emit moveTo for the first point of a
     * fresh subpath else lineTo. Updates the device current-point / subpath-start
     * tracking. Shared by _bakeArc, _bakeEllipse, and _bakeArcTo.
     * @param {number} start - normalized start angle
     * @param {number} end - normalized end angle
     * @param {number} segments - segment count (>= 1)
     * @param {Function} sampleFn - (angle) => {x, y} user-space point on the curve
     * @private
     */
    _emitBakedArc(start, end, segments, sampleFn) {
        const M = this._transform;
        const angleStep = (end - start) / segments;
        const hasSubpath = this._devCurrent !== null;
        let last = null;
        for (let i = 0; i <= segments; i++) {
            const p = M.transformPoint(sampleFn(start + i * angleStep));
            if (i === 0 && !hasSubpath) {
                this._currentPath.moveTo(p.x, p.y);
                this._devSubStart = p;
            } else {
                this._currentPath.lineTo(p.x, p.y);
            }
            last = p;
        }
        if (last) this._devCurrent = last;
    }

    /**
     * Bake an arc into the current default path as device-space line segments. The
     * arc is sampled in user space and each sample is mapped by the current CTM;
     * the segment count is sized for the on-screen radius (radius × build scale) so
     * the curve stays smooth. An affine CTM maps the sampled circle to the correct
     * circle/ellipse with no angle/axis math. Matches PathFlattener._flattenArc
     * under an identity CTM.
     * @param {Object} c - {x, y, radius, startAngle, endAngle, counterclockwise}
     * @private
     */
    _bakeArc(c) {
        const radius = c.radius;
        if (radius <= 0) return;

        // Normalize the sweep, matching PathFlattener._flattenArc.
        let start = c.startAngle;
        let end = c.endAngle;
        if (!c.counterclockwise && end < start) end += TAU;
        else if (c.counterclockwise && start < end) start += TAU;

        const segments = Context2D._arcSegmentCount(radius, this._transform, Math.abs(end - start));
        this._emitBakedArc(start, end, segments, a => ({
            x: c.x + radius * Math.cos(a),
            y: c.y + radius * Math.sin(a)
        }));
    }

    /**
     * Bake an ellipse into the current default path as device-space line segments.
     * See _bakeArc; matches PathFlattener._flattenEllipse under an identity CTM.
     * @param {Object} c - {x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise}
     * @private
     */
    _bakeEllipse(c) {
        const radiusX = c.radiusX;
        const radiusY = c.radiusY;
        if (radiusX <= 0 || radiusY <= 0) return;

        let start = c.startAngle;
        let end = c.endAngle;
        if (!c.counterclockwise && end < start) end += TAU;
        else if (c.counterclockwise && start < end) start += TAU;

        const segments = Context2D._arcSegmentCount(Math.min(radiusX, radiusY), this._transform, Math.abs(end - start));
        const cosRot = Math.cos(c.rotation);
        const sinRot = Math.sin(c.rotation);
        this._emitBakedArc(start, end, segments, a => {
            const ex = radiusX * Math.cos(a);
            const ey = radiusY * Math.sin(a);
            return { x: c.x + ex * cosRot - ey * sinRot, y: c.y + ex * sinRot + ey * cosRot };
        });
    }

    /**
     * Bake an arcTo into the current default path as device-space line segments.
     * arcTo's geometry is defined in the current user space and depends on the
     * current point, so we map the (device-space) current point back by the CTM
     * inverse, resolve the tangent arc with PathFlattener.resolveArcToGeometry,
     * then sample it and bake by the CTM — exact for any affine (this closes the
     * similarity-only approximation the previous implementation used).
     * @private
     */
    _bakeArcTo(x1, y1, x2, y2, radius) {
        const M = this._transform;

        // No open subpath yet: per the spec arcTo establishes the first point.
        if (this._devCurrent === null) {
            const p = M.transformPoint({ x: x1, y: y1 });
            this._currentPath.moveTo(p.x, p.y);
            this._devCurrent = p;
            this._devSubStart = p;
            return;
        }

        // The current point is stored in device space; arcTo needs it in the
        // current user space. A singular CTM has no user space — degrade to a line.
        let userCur;
        try {
            userCur = M.invert().transformPoint(this._devCurrent);
        } catch (e) {
            const p = M.transformPoint({ x: x1, y: y1 });
            this._currentPath.lineTo(p.x, p.y);
            this._devCurrent = p;
            return;
        }

        const g = PathFlattener.resolveArcToGeometry(userCur, { x: x1, y: y1 }, { x: x2, y: y2 }, radius);
        if (g.type === 'line') {
            const p = M.transformPoint({ x: g.x, y: g.y });
            this._currentPath.lineTo(p.x, p.y);
            this._devCurrent = p;
            return;
        }

        // Sample the resolved arc in user space and bake by M (device resolution).
        // _devCurrent is non-null here, so _emitBakedArc emits all lineTo (no moveTo).
        let start = g.startAngle;
        let end = g.endAngle;
        if (!g.counterclockwise && end < start) end += TAU;
        else if (g.counterclockwise && start < end) start += TAU;
        const segments = Context2D._arcToSegmentCount(g.radius, M, Math.abs(end - start));
        this._emitBakedArc(start, end, segments, a => ({
            x: g.center.x + g.radius * Math.cos(a),
            y: g.center.y + g.radius * Math.sin(a)
        }));
    }

    /**
     * Number of line segments to approximate a circular arc of the given user-space
     * radius, sized for its on-screen radius (radius × build-time scale) so the
     * flattening stays within `tolerance` (default PATH_FLATTENING_TOLERANCE) after
     * the transform is applied.
     * @private
     */
    static _arcSegmentCount(radius, buildTransform, totalAngle, tolerance) {
        if (tolerance === undefined) tolerance = PATH_FLATTENING_TOLERANCE;
        const deviceScale = Math.max(buildTransform.scaleX, buildTransform.scaleY, TRANSFORM_EPSILON);
        const deviceRadius = Math.max(radius * deviceScale, TRANSFORM_EPSILON);
        let maxAngleStep = 2 * Math.acos(Math.max(0, 1 - tolerance / deviceRadius));
        if (!(maxAngleStep > TRANSFORM_EPSILON)) maxAngleStep = TRANSFORM_EPSILON;
        let segments = PathFlattener.segmentCount(totalAngle / maxAngleStep);
        if (segments > 4096) segments = 4096; // defensive cap for pathological radii
        return segments;
    }

    /**
     * Segment count for baking an arcTo: _arcSegmentCount with arcTo's finer
     * tolerance, plus the same minimum-segments-per-quarter-turn floor as
     * PathFlattener._flattenArcWithTolerance. (minSegments ≤ 64 for a full turn, so
     * the result never exceeds _arcSegmentCount's 4096 cap.)
     * @private
     */
    static _arcToSegmentCount(radius, buildTransform, totalAngle) {
        const toleranceSegments = Context2D._arcSegmentCount(
            radius,
            buildTransform,
            totalAngle,
            Math.min(0.1, PATH_FLATTENING_TOLERANCE) // matches _handleArcTo
        );
        const minSegments = PathFlattener.segmentCount((totalAngle / (Math.PI / 2)) * 16); // 16 per 90°
        return Math.max(toleranceSegments, minSegments);
    }

    // Drawing methods - rectangle operations
    fillRect(x, y, width, height) {
        // Validate parameters up front (family convention - fillStrokeRect,
        // clearRect, the roundRect/stadium entries all do), so bad arguments
        // fail identically whatever the paint source. Previously the throw
        // came from a different layer with a different message per paint.
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width <= 0 || height <= 0) {
            return; // Nothing to draw for negative/zero dimensions (family convention)
        }

        if (this._isInvisibleDraw(this._fillStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // NO direct fill arm, deliberately: rect FILLS are uniformly generic. The
        // AA and tilted direct fill arms were removed on disable-and-benchmark
        // evidence (generic parity; the AA arm's 2-6% small-alpha edge explicitly
        // accepted as a loss) - see DIRECT-RENDERING-SUMMARY.MD §9 entries 15-16
        // and plans/one-rect-fill-pipeline-and-fill-arm-removal.md. Do not re-add
        // a fill fast path without fresh benchmark evidence (tests/core pins this).
        // Direct rect machinery lives on in strokeRect/fillStrokeRect only.
        Context2D._markPathBasedRendering();
        const fillStyle = this._paintForOp(this._fillStyle);
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMaskForDraw(),
            clipRect: this._clipRectForDraw(),
            fillStyle: fillStyle,
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.fillRect(x, y, width, height, fillStyle);
        this.rasterizer.endOp();
    }

    strokeRect(x, y, width, height) {
        // Validate parameters up front - see fillRect. The negative-dimension
        // return also fixes a pixel bug: the direct 1px frame walk painted
        // stray pixels for negative width/height.
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width <= 0 || height <= 0) {
            return; // Nothing to draw for negative/zero dimensions (family convention)
        }

        if (this._isInvisibleDraw(this._strokeStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // Direct rendering: Color stroke with source-over, no shadows (clipping supported)
        // Dashed strokes take the generic path - the direct renderers draw
        // solid runs only; the fallback honours lineDash (setLineDash support).
        if (this._canUseDirectRendering(this._strokeStyle) && this._lineDash.length === 0) {
            const t = this._transform;
            // The axis-aligned RectOpsAA arms take the clip rect and the mask
            // separately (clamp to the rect, test the mask bits); the rotated
            // RectOpsRot arm takes one buffer, the combined mask. This branch is
            // source-over with no shadow, so the pair is (_clipRect, _clipMask).
            const clipRect = this._clipRectForDraw();
            const clip = this._clipBufferForDraw();

            // Fast access to pre-computed transform values
            const scaledW = width * t.scaleX;
            const scaledH = height * t.scaleY;
            const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
            const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);

            const isOpaque = this._strokeStyle.a === 255 && this.globalAlpha >= 1.0;
            // HAIRLINE (sub-pixel) stroke — see the class-level note at the top
            // of this file for the one rule all direct stroke entries share.
            // Declared out here because the rotated branch below needs it too.
            const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;
            const isHairlineStroke = scaledLineWidth > 0 && scaledLineWidth < 1 && !is1pxStroke;
            const strokeAlpha = isHairlineStroke ? this.globalAlpha * scaledLineWidth : this.globalAlpha;

            if (t.isAxisAligned) {
                // Inline dimension swapping
                const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                const tlX = center.x - finalW / 2;
                const tlY = center.y - finalH / 2;

                const isThickStroke = scaledLineWidth > 1;

                if (is1pxStroke || isHairlineStroke) {
                    if (isOpaque && !isHairlineStroke) {
                        RectOpsAA.stroke1px_AA_Opaq(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            this._strokeStyle,
                            clip,
                            clipRect
                        );
                        return;
                    } else {
                        RectOpsAA.stroke1px_AA_Alpha(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            this._strokeStyle,
                            strokeAlpha,
                            clip,
                            clipRect
                        );
                        return;
                    }
                } else if (isThickStroke) {
                    if (isOpaque) {
                        RectOpsAA.strokeThick_AA_Opaq(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            scaledLineWidth,
                            this._strokeStyle,
                            clip,
                            clipRect
                        );
                        return;
                    } else {
                        RectOpsAA.strokeThick_AA_Alpha(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            scaledLineWidth,
                            this._strokeStyle,
                            this.globalAlpha,
                            clip,
                            clipRect
                        );
                        return;
                    }
                }
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use line-based stroke. RectOpsRot takes
                // one clip buffer, so it gets the combined mask (mask ∧ rect).
                // The hairline rule reaches this branch through strokeAlpha alone:
                // stroke_Rot_Any already routes lineWidth <= 1 to its 1px DDA and
                // derives opaque-vs-alpha from the globalAlpha it is handed (the
                // DDA dedups shared corner pixels, so translucent coverage is
                // single-blend — the §6.5 doctrine).
                RectOpsRot.stroke_Rot_Any(
                    this.surface,
                    center.x,
                    center.y,
                    scaledW,
                    scaledH,
                    t.rotationAngle,
                    scaledLineWidth,
                    this._strokeStyle,
                    strokeAlpha,
                    this._combinedClipBuffer()
                );
                return;
            }
            // Non-uniform scale + rotation: fall through to path-based rendering (produces parallelogram)
        }

        // Path-based rendering: Create a rectangular path
        Context2D._markPathBasedRendering();
        const rectPath = new SWPath2D();
        rectPath.rect(x, y, width, height);
        rectPath.closePath();

        // Stroke the path using existing stroke infrastructure
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMaskForDraw(),
            clipRect: this._clipRectForDraw(),
            strokeStyle: this._paintForOp(this._strokeStyle),
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.stroke(rectPath, {
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit,
            lineDash: this._lineDash.slice(), // Copy to avoid mutation (see stroke())
            lineDashOffset: this._lineDashOffset
        });

        this.rasterizer.endOp();
    }

    /**
     * Fill and stroke a rectangle in a single operation
     * Uses unified rendering when possible to prevent fill/stroke gaps.
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     */
    fillStrokeRect(x, y, width, height) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width < 0 || height < 0) {
            return; // Nothing to draw for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to draw for zero dimensions
        }

        if (this._isInvisibleDraw(this._fillStyle) && this._isInvisibleDraw(this._strokeStyle)) {
            return; // Neither half can change a pixel under source-over
        }

        // Direct rendering: both fill and stroke are solid colors, source-over, no shadows
        // Dashed strokes route to the decomposed/generic path (see strokeRect).
        if (
            this._canUseDirectRenderingForFillStroke(this._fillStyle, this._strokeStyle) &&
            this._lineDash.length === 0
        ) {
            const t = this._transform;
            // The one AA rect-family arm that takes no clip rect:
            // RectOpsAA.fillStroke_AA_Any's signature ends at clipBuffer (as does
            // RectOpsRot.fillStroke_Rot_Any's), so both get the combined mask
            // (mask ∧ rect) while the single-purpose strokeRect arms clamp extents
            // instead. Taking the rect means threading the clamp through the
            // fused fill+stroke composite; do it together with a
            // benchmark-justified hot clipped caller (plans/clipping-optimization.md).
            const clip = this._combinedClipBuffer();

            const hasFill = this._fillStyle.a > 0;
            const hasStroke = this._strokeStyle.a > 0 && this._lineWidth > 0;

            // Fast access to pre-computed transform values
            const scaledW = width * t.scaleX;
            const scaledH = height * t.scaleY;
            const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
            const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);

            if (t.isAxisAligned) {
                // Inline dimension swapping
                const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                const tlX = center.x - finalW / 2;
                const tlY = center.y - finalH / 2;

                RectOpsAA.fillStroke_AA_Any(
                    this.surface,
                    tlX,
                    tlY,
                    finalW,
                    finalH,
                    scaledLineWidth,
                    hasFill ? this._fillStyle : null,
                    hasStroke ? this._strokeStyle : null,
                    this.globalAlpha,
                    clip
                );
                return;
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use rotated fill+stroke wrapper
                RectOpsRot.fillStroke_Rot_Any(
                    this.surface,
                    center.x,
                    center.y,
                    scaledW,
                    scaledH,
                    t.rotationAngle,
                    scaledLineWidth,
                    hasFill ? this._fillStyle : null,
                    hasStroke ? this._strokeStyle : null,
                    this.globalAlpha,
                    clip
                );
                return;
            }
            // Non-uniform scale + rotation: fall through to path-based rendering (produces parallelogram)
        }

        // Path-based rendering: gradients, patterns, non-source-over, shadows, or parallelograms
        Context2D._markPathBasedRendering();
        this.fillRect(x, y, width, height);
        this.strokeRect(x, y, width, height);
    }

    clearRect(x, y, width, height) {
        // clearRect should only affect the specified rectangle, not use canvas-wide compositing
        // We'll handle this as a special case by directly clearing the surface pixels
        this._clearRectDirect(x, y, width, height);
    }

    /**
     * Clear rectangle directly without canvas-wide compositing
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @private
     */
    _clearRectDirect(x, y, width, height) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width < 0 || height < 0) {
            return; // Nothing to clear for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to clear for zero dimensions
        }

        const surface = this.surface;
        const transform = this._transform;

        // Transform rectangle corners to determine affected region
        const topLeft = transform.transformPoint({ x: x, y: y });
        const topRight = transform.transformPoint({ x: x + width, y: y });
        const bottomLeft = transform.transformPoint({ x: x, y: y + height });
        const bottomRight = transform.transformPoint({ x: x + width, y: y + height });

        // Get bounding box of transformed rectangle
        const minX = Math.floor(Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x));
        const maxX = Math.ceil(Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x));
        const minY = Math.floor(Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y));
        const maxY = Math.ceil(Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y));

        // clearRect honours the clip. Its per-pixel test below reads one mask, so
        // it takes the combined mask (mask ∧ rect, built on demand).
        const clipMask = this._combinedClipMask();

        // Handle simple axis-aligned case (no rotation/skew). Epsilon-ized via
        // the precomputed flags (raw b===0 && c===0 was the codebase's one
        // holdout from TRANSFORM_EPSILON, parking sub-epsilon shears on the
        // per-pixel inverse-transform loop below - same pixels, perf cliff).
        // NOT plain isAxisAligned: that includes 90-degree rotations, whose
        // axis swap this span loop's e + x*a mapping cannot express.
        if (transform.isAxisAligned && !transform.is90DegreeRotated) {
            // Calculate the actual rectangle bounds in surface coordinates
            const rectLeft = transform.e + x * transform.a; // x coordinate with scaling and translation
            const rectTop = transform.f + y * transform.d; // y coordinate with scaling and translation
            const rectRight = rectLeft + width * transform.a;
            const rectBottom = rectTop + height * transform.d;

            // Get integer pixel bounds
            const startX = Math.max(0, Math.floor(rectLeft));
            const endX = Math.min(surface.width - 1, Math.floor(rectRight) - 1); // Inclusive end
            const startY = Math.max(0, Math.floor(rectTop));
            const endY = Math.min(surface.height - 1, Math.floor(rectBottom) - 1); // Inclusive end

            for (let py = startY; py <= endY; py++) {
                for (let px = startX; px <= endX; px++) {
                    // Check if this pixel should be clipped by current clip mask
                    if (clipMask && clipMask.isPixelClipped(px, py)) {
                        continue;
                    }

                    const offset = py * surface.stride + px * 4;
                    surface.data[offset] = 0; // R
                    surface.data[offset + 1] = 0; // G
                    surface.data[offset + 2] = 0; // B
                    surface.data[offset + 3] = 0; // A (transparent)
                }
            }
        } else {
            // For rotated/skewed rectangles, we need to test each pixel
            // This is more complex but handles all transformation cases correctly.
            // A singular CTM maps the rect to zero area: nothing to clear -
            // return silently like fill()/stroke() do, instead of letting
            // invert() throw.
            let invTransform;
            try {
                invTransform = transform.invert();
            } catch (e) {
                return;
            }

            for (let py = Math.max(0, minY); py <= Math.min(surface.height - 1, maxY); py++) {
                for (let px = Math.max(0, minX); px <= Math.min(surface.width - 1, maxX); px++) {
                    // Check if this pixel should be clipped by current clip mask
                    if (clipMask && clipMask.isPixelClipped(px, py)) {
                        continue;
                    }

                    // Transform pixel back to path coordinate space
                    const pathPoint = invTransform.transformPoint({ x: px + 0.5, y: py + 0.5 });

                    // Check if point is inside the clearRect rectangle
                    if (pathPoint.x >= x && pathPoint.x < x + width && pathPoint.y >= y && pathPoint.y < y + height) {
                        const offset = py * surface.stride + px * 4;
                        surface.data[offset] = 0; // R
                        surface.data[offset + 1] = 0; // G
                        surface.data[offset + 2] = 0; // B
                        surface.data[offset + 3] = 0; // A (transparent)
                    }
                }
            }
        }
    }

    /**
     * Stroke a rounded rectangle.
     * Uses direct rendering for strokes with no transforms/clipping/shadows.
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius, or a list of 1-4 corner
     *   radii with HTML5 roundRect() semantics (RoundedRectUtils documents the
     *   contract). The direct renderers round each fitted corner radius to an
     *   integer; per-corner radii under a non-axis-aligned rotation take the
     *   generic path.
     */
    strokeRoundRect(x, y, width, height, radii) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }
        // Validated up front (RangeError/TypeError), so whether a call throws never
        // depends on the dimensions or the paint.
        const corners = RoundedRectUtils.parseCornerRadii(radii);

        if (width < 0 || height < 0) {
            return; // Nothing to draw for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to draw for zero dimensions
        }

        if (corners === null) {
            return; // NaN/infinite radius draws nothing (HTML5)
        }

        if (this._isInvisibleDraw(this._strokeStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // Fallback to strokeRect when no corner is rounded (rounded rect becomes regular rect)
        if (corners === 0) {
            this.strokeRect(x, y, width, height);
            return;
        }

        // Direct rendering: Color stroke with source-over, no shadows
        // Dashed strokes take the generic path - the direct renderers draw
        // solid runs only; the fallback honours lineDash (setLineDash support).
        if (this._canUseDirectRendering(this._strokeStyle) && this._lineDash.length === 0) {
            const t = this._transform;
            // The axis-aligned RoundedRectOpsAA arms take the clip rect and the
            // mask separately; the rotated branch takes the combined mask (see
            // strokeRect).
            const clipRect = this._clipRectForDraw();
            const clip = this._clipBufferForDraw();

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);
                const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;
                const isOpaque = this._strokeStyle.a === 255 && this.globalAlpha >= 1.0;
                // HAIRLINE (sub-pixel) stroke — see the class-level note at the
                // top of this file for the one rule all direct stroke entries
                // share. Below 1px this used to reach strokeThick_AA_*, which
                // renders a sub-pixel width at FULL opacity (wrong weight) and
                // with an open outline.
                const isHairlineStroke = scaledLineWidth > 0 && scaledLineWidth < 1 && !is1pxStroke;
                const strokeAlpha = isHairlineStroke ? this.globalAlpha * scaledLineWidth : this.globalAlpha;

                if (t.isIdentity) {
                    // No transform: use axis-aligned methods with original coordinates
                    if (is1pxStroke || isHairlineStroke) {
                        if (isOpaque && !isHairlineStroke) {
                            RoundedRectOpsAA.stroke1px_AA_Opaq(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                corners,
                                this._strokeStyle,
                                clip,
                                clipRect
                            );
                        } else {
                            RoundedRectOpsAA.stroke1px_AA_Alpha(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                corners,
                                this._strokeStyle,
                                strokeAlpha,
                                clip,
                                clipRect
                            );
                        }
                    } else {
                        if (isOpaque) {
                            RoundedRectOpsAA.strokeThick_AA_Opaq(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                corners,
                                this._lineWidth,
                                this._strokeStyle,
                                clip,
                                clipRect
                            );
                        } else {
                            RoundedRectOpsAA.strokeThick_AA_Alpha(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                corners,
                                this._lineWidth,
                                this._strokeStyle,
                                this.globalAlpha,
                                clip,
                                clipRect
                            );
                        }
                    }
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping; the corner radii turn with the box
                    const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                    const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                    const tlX = center.x - finalW / 2;
                    const tlY = center.y - finalH / 2;
                    const deviceCorners = RoundedRectUtils.deviceCornerRadii(corners, t);

                    if (is1pxStroke || isHairlineStroke) {
                        if (isOpaque && !isHairlineStroke) {
                            RoundedRectOpsAA.stroke1px_AA_Opaq(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                deviceCorners,
                                this._strokeStyle,
                                clip,
                                clipRect
                            );
                        } else {
                            RoundedRectOpsAA.stroke1px_AA_Alpha(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                deviceCorners,
                                this._strokeStyle,
                                strokeAlpha,
                                clip,
                                clipRect
                            );
                        }
                    } else {
                        if (isOpaque) {
                            RoundedRectOpsAA.strokeThick_AA_Opaq(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                deviceCorners,
                                scaledLineWidth,
                                this._strokeStyle,
                                clip,
                                clipRect
                            );
                        } else {
                            RoundedRectOpsAA.strokeThick_AA_Alpha(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                deviceCorners,
                                scaledLineWidth,
                                this._strokeStyle,
                                this.globalAlpha,
                                clip,
                                clipRect
                            );
                        }
                    }
                    return;
                } else if (typeof corners === 'number') {
                    // Rotated with uniform scale: use strokeRotated.
                    // The hairline rule reaches this branch through strokeAlpha
                    // alone: stroke_Rot_Any already routes lineWidth <= 1 to its
                    // 1px renderers and picks opaque-vs-alpha from the
                    // globalAlpha it is handed.
                    RoundedRectOpsRot.stroke_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        corners * t.scaleX,
                        t.rotationAngle,
                        scaledLineWidth,
                        this._strokeStyle,
                        strokeAlpha,
                        this._combinedClipBuffer()
                    );
                    return;
                }
                // Per-corner radii under a non-axis-aligned rotation: the rotated
                // renderers are uniform-radius only (no caller needs more - see
                // DIRECT-RENDERING-SUMMARY.MD §9 entry 17); the generic path below
                // draws them exactly, ~8x slower for strokes. RoundedRectOpsRot's
                // header notes how that family would go per-corner if ever needed.
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: build an un-baked, user-space path and stroke it as
        // an external Path2D so it draws under the current CTM. (The current default
        // path bakes the CTM at build time — the wrong coordinate space here.)
        const fallbackPath = new SWPath2D();
        SWPath2D.appendRoundRect(fallbackPath, x, y, width, height, corners);
        this.stroke(fallbackPath);
    }

    /**
     * Fill a rounded rectangle.
     * Always renders through the generic path pipeline (fill arms removed on
     * parity evidence - §9 entries 15-16); no rounded corner delegates to fillRect.
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius, or a list of 1-4 corner
     *   radii with HTML5 roundRect() semantics (RoundedRectUtils documents the
     *   contract).
     */
    fillRoundRect(x, y, width, height, radii) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }
        // Validated up front - see strokeRoundRect.
        const corners = RoundedRectUtils.parseCornerRadii(radii);

        if (width < 0 || height < 0) {
            return; // Nothing to draw for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to draw for zero dimensions
        }

        if (corners === null) {
            return; // NaN/infinite radius draws nothing (HTML5)
        }

        if (this._isInvisibleDraw(this._fillStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // Fallback to fillRect when no corner is rounded (rounded rect becomes regular rect)
        if (corners === 0) {
            this.fillRect(x, y, width, height);
            return;
        }

        // NO direct fill arm, deliberately: roundRect FILLS are uniformly generic
        // (disable-and-benchmark measured dead parity across sizes, opacities and
        // rotations - DIRECT-RENDERING-SUMMARY.MD §9 entries 15-16 and
        // plans/one-rect-fill-pipeline-and-fill-arm-removal.md). Do not re-add a
        // fill fast path without fresh benchmark evidence. Direct roundRect
        // machinery lives on in strokeRoundRect/fillStrokeRoundRect only.
        //
        // Path-based rendering: build an un-baked, user-space path and fill it as an
        // external Path2D so it draws under the current CTM. (The current default
        // path bakes the CTM at build time — the wrong coordinate space here.)
        const fallbackPath = new SWPath2D();
        SWPath2D.appendRoundRect(fallbackPath, x, y, width, height, corners);
        this.fill(fallbackPath);
    }

    /**
     * Fill and stroke a rounded rectangle in a single unified operation.
     * Uses unified direct rendering to prevent fill/stroke boundary speckles.
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius, or a list of 1-4 corner
     *   radii with HTML5 roundRect() semantics (RoundedRectUtils documents the
     *   contract). The direct renderers round each fitted corner radius to an
     *   integer; per-corner radii under a non-axis-aligned rotation take the
     *   generic path.
     */
    fillStrokeRoundRect(x, y, width, height, radii) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }
        // Validated up front - see strokeRoundRect.
        const corners = RoundedRectUtils.parseCornerRadii(radii);

        if (width < 0 || height < 0) {
            return; // Nothing to draw for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to draw for zero dimensions
        }

        if (corners === null) {
            return; // NaN/infinite radius draws nothing (HTML5)
        }

        if (this._isInvisibleDraw(this._fillStyle) && this._isInvisibleDraw(this._strokeStyle)) {
            return; // Neither half can change a pixel under source-over
        }

        // Fallback to fillStrokeRect when no corner is rounded
        if (corners === 0) {
            this.fillStrokeRect(x, y, width, height);
            return;
        }

        // Direct rendering: both fill and stroke are solid colors, source-over, no shadows
        // Dashed strokes route to the decomposed/generic path (see strokeRect).
        if (
            this._canUseDirectRenderingForFillStroke(this._fillStyle, this._strokeStyle) &&
            this._lineDash.length === 0
        ) {
            const t = this._transform;
            // The axis-aligned RoundedRectOpsAA arms take the clip rect and the
            // mask separately; the rotated branch takes the combined mask (see
            // strokeRect).
            const clipRect = this._clipRectForDraw();
            const clip = this._clipBufferForDraw();

            const hasFill = this._fillStyle.a > 0;
            const hasStroke = this._strokeStyle.a > 0 && this._lineWidth > 0;

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);

                if (t.isIdentity) {
                    // Axis-aligned, no transform: use top-left coordinates
                    RoundedRectOpsAA.fillStroke_AA_Any(
                        this.surface,
                        x,
                        y,
                        width,
                        height,
                        corners,
                        this._lineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        clip,
                        clipRect
                    );
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping; the corner radii turn with the box
                    const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                    const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                    const tlX = center.x - finalW / 2;
                    const tlY = center.y - finalH / 2;

                    RoundedRectOpsAA.fillStroke_AA_Any(
                        this.surface,
                        tlX,
                        tlY,
                        finalW,
                        finalH,
                        RoundedRectUtils.deviceCornerRadii(corners, t),
                        scaledLineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        clip,
                        clipRect
                    );
                    return;
                } else if (typeof corners === 'number') {
                    // Rotated with uniform scale: use rotated fill+stroke
                    RoundedRectOpsRot.fillStroke_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        corners * t.scaleX,
                        t.rotationAngle,
                        scaledLineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        this._combinedClipBuffer()
                    );
                    return;
                }
                // Per-corner radii under a non-axis-aligned rotation: decompose into
                // the generic halves below (see strokeRoundRect).
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: use sequential fill + stroke
        Context2D._markPathBasedRendering();
        this.fillRoundRect(x, y, width, height, radii);
        this.strokeRoundRect(x, y, width, height, radii);
    }

    /**
     * Fill a stadium (capsule): the w-by-h box with its shorter axis fully
     * rounded — two half-circle caps of radius min(w,h)/2 joined by a
     * rectangular body. Orientation is implied by the longer axis, so one
     * signature covers vertical and horizontal shapes (w === h degenerates to
     * a circle).
     *
     * Always renders through the generic path pipeline (fill arms removed on
     * parity evidence - §9 entries 15-16). There are deliberately NO stroke
     * variants — capability lands with callers, and the one consumer only
     * fills.
     * @param {number} x - Box top-left X
     * @param {number} y - Box top-left Y
     * @param {number} width - Box width
     * @param {number} height - Box height
     */
    fillStadium(x, y, width, height) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Stadium coordinates must be numbers');
        }

        if (width <= 0 || height <= 0) {
            return; // Nothing to draw
        }

        if (this._isInvisibleDraw(this._fillStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // NO direct fill arm, deliberately: stadium FILLS are uniformly generic.
        // The StadiumOps arm was removed with the other fill fast paths on parity
        // evidence (stadium shares roundRect's algorithm class - span walk + cap
        // geometry - so parity holds by proxy; DIRECT-RENDERING-SUMMARY.MD §9
        // entries 15-16, plans/one-rect-fill-pipeline-and-fill-arm-removal.md).
        // Do not re-add a fill fast path without fresh benchmark evidence.
        //
        // Path-based rendering: an un-baked, user-space rounded-rect path at
        // the degenerate radius, drawn as an external Path2D under the current
        // CTM. The generic pipeline samples pixel centres, so the stadium is
        // its flattened outline (caps as inscribed chords, within the
        // flattening tolerance) sampled exactly.
        const fallbackPath = new SWPath2D();
        SWPath2D.appendRoundRect(fallbackPath, x, y, width, height, Math.min(width, height) / 2);
        this.fill(fallbackPath);
    }

    // M2: Path drawing methods
    /**
     * Return a new SWPath2D with every point of `path` mapped by transform M.
     * Used to map the device-space current default path back to draw-time user
     * space for stroking (M = drawT⁻¹). Handles the command types the current
     * default path can contain — arcs are already flattened to lineTo at build time.
     * @private
     */
    _transformPathPoints(path, M) {
        // Common case (no draw-time transform): mapping by identity is a no-op, so
        // return the path as-is and skip cloning every command.
        if (M.isIdentity) return path;
        const out = new SWPath2D();
        const cmds = path.commands;
        for (let i = 0; i < cmds.length; i++) {
            const c = cmds[i];
            switch (c.type) {
                case 'moveTo': {
                    const p = M.transformPoint(c);
                    out.moveTo(p.x, p.y);
                    break;
                }
                case 'lineTo': {
                    const p = M.transformPoint(c);
                    out.lineTo(p.x, p.y);
                    break;
                }
                case 'closePath':
                    out.closePath();
                    break;
                case 'bezierCurveTo': {
                    const cp1 = M.transformPoint({ x: c.cp1x, y: c.cp1y });
                    const cp2 = M.transformPoint({ x: c.cp2x, y: c.cp2y });
                    const p = M.transformPoint(c);
                    out.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
                    break;
                }
                case 'quadraticCurveTo': {
                    const cp = M.transformPoint({ x: c.cpx, y: c.cpy });
                    const p = M.transformPoint(c);
                    out.quadraticCurveTo(cp.x, cp.y, p.x, p.y);
                    break;
                }
                default:
                    out.commands.push(c);
                    break;
            }
        }
        return out;
    }

    fill(path, rule) {
        // The HTML5 (path?, fillRule?) overload, dispatched by TYPE so an
        // explicitly passed undefined means "omitted", as WebIDL has it:
        // fill(), fill(rule), fill(path2d), fill(path2d, rule). A rule string
        // other than 'evenodd' fills nonzero (lenient, where WebIDL throws).
        if (typeof path === 'string') {
            rule = path;
            path = undefined;
        }
        let pathToFill = path || this._currentPath;
        const fillRule = rule || 'nonzero';

        // The current default path holds device-space geometry. Filling it under
        // IDENTITY would starve a gradient/pattern fillStyle of the CTM: a paint
        // source is specified in draw-time user space and must be mapped to device
        // space by the CTM, exactly like the path. So map the centerline back to
        // user space (drawT⁻¹) and fill under the CTM, so the path AND the paint
        // source share one transform — mirroring stroke() and matching HTML5
        // semantics. A singular drawT → zero area → nothing to fill. An external
        // Path2D is transform-independent → fill under the CTM.
        let opTransform;
        if (pathToFill === this._currentPath) {
            const drawT = this._transform;
            let inv;
            try {
                inv = drawT.invert();
            } catch (e) {
                return;
            }
            pathToFill = this._transformPathPoints(this._currentPath, inv);
            opTransform = drawT;
        } else {
            opTransform = this._transform;
        }

        // Mark path-based rendering for testing (fill() has no direct rendering currently)
        Context2D._markPathBasedRendering();

        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: opTransform,
            clipMask: this._clipMaskForDraw(),
            clipRect: this._clipRectForDraw(),
            fillStyle: this._paintForOp(this._fillStyle),
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.fill(pathToFill, fillRule);
        this.rasterizer.endOp();
    }

    stroke(path) {
        let pathToStroke;
        let opTransform;

        if (!path) {
            // Current default path: device-space geometry. The round pen lives in
            // draw-time user space, so map the centerline back by drawT⁻¹, stroke,
            // and let the op transform forward the outline (anisotropic under a
            // non-uniform/sheared drawT). A singular drawT → nothing to stroke.
            const drawT = this._transform;
            let inv;
            try {
                inv = drawT.invert();
            } catch (e) {
                return;
            }
            pathToStroke = this._transformPathPoints(this._currentPath, inv);
            opTransform = drawT;
        } else {
            // External Path2D: transform-independent → stroke under the current CTM.
            pathToStroke = path;
            opTransform = this._transform;
        }

        // All path-based strokes use generic pipeline
        // Direct rendering available via dedicated methods: strokeCircle(), strokeRect(), etc.
        Context2D._markPathBasedRendering();

        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: opTransform,
            clipMask: this._clipMaskForDraw(),
            clipRect: this._clipRectForDraw(),
            strokeStyle: this._paintForOp(this._strokeStyle),
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.stroke(pathToStroke, {
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit,
            lineDash: this._lineDash.slice(), // Copy to avoid mutation
            lineDashOffset: this._lineDashOffset
        });

        this.rasterizer.endOp();
    }

    /**
     * Test if a point is inside the current path or specified path
     * Supports all HTML5 Canvas API overloads:
     * - isPointInPath(x, y)
     * - isPointInPath(x, y, fillRule)
     * - isPointInPath(path, x, y)
     * - isPointInPath(path, x, y, fillRule)
     * @param {...} arguments - Variable arguments depending on overload
     * @returns {boolean} True if point is inside the path
     */
    isPointInPath() {
        let path, x, y, fillRule;

        if (arguments.length < 2) {
            const error = new TypeError('Invalid number of arguments for isPointInPath');
            error.message = 'TypeError: ' + error.message;
            throw error;
        } else if (arguments.length === 2) {
            // isPointInPath(x, y)
            [x, y] = arguments;
            path = this._currentPath;
            fillRule = 'nonzero';
        } else if (arguments.length === 3) {
            // Told apart by the FIRST argument, as WebIDL resolves it: a number
            // selects (x, y, fillRule), whose fillRule may be passed undefined.
            if (typeof arguments[0] !== 'object') {
                // isPointInPath(x, y, fillRule)
                [x, y, fillRule] = arguments;
                path = this._currentPath;
            } else {
                // isPointInPath(path, x, y)
                [path, x, y] = arguments;
                if (!path || typeof path !== 'object' || !path.commands) {
                    const error = new TypeError('First argument must be a Path2D object');
                    error.message = 'TypeError: ' + error.message;
                    throw error;
                }
                fillRule = 'nonzero';
            }
        } else if (arguments.length === 4) {
            // isPointInPath(path, x, y, fillRule)
            [path, x, y, fillRule] = arguments;
            if (!path || typeof path !== 'object' || !path.commands) {
                const error = new TypeError('First argument must be a Path2D object');
                error.message = 'TypeError: ' + error.message;
                throw error;
            }
        } else if (arguments.length > 4) {
            const error = new TypeError('Invalid number of arguments for isPointInPath');
            error.message = 'TypeError: ' + error.message;
            throw error;
        }

        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number') {
            return false;
        }

        if (!path || !path.commands || path.commands.length === 0) {
            return false;
        }

        fillRule = fillRule || 'nonzero';

        // Per the HTML5 Canvas spec the query point is in canvas (device) space and
        // is NOT affected by the current transform.
        const polygons = PathFlattener.flattenPath(path);

        if (polygons.length === 0) {
            return false;
        }

        // The current default path already holds device-space geometry → test the
        // point directly. An external Path2D is in user space → map its polygons by
        // the current CTM first.
        const testPolygons =
            path === this._currentPath
                ? polygons
                : polygons.map(poly => poly.map(point => this._transform.transformPoint(point)));

        return PolygonFiller.isPointInPolygons(x, y, testPolygons, fillRule);
    }

    /**
     * Test if a point is inside the stroke of current path or specified path
     * Supports all HTML5 Canvas API overloads:
     * - isPointInStroke(x, y)
     * - isPointInStroke(path, x, y)
     * @param {...} arguments - Variable arguments depending on overload
     * @returns {boolean} True if point is inside the stroke
     */
    isPointInStroke() {
        let path, x, y;

        if (arguments.length < 2) {
            const error = new TypeError('Invalid number of arguments for isPointInStroke');
            error.message = 'TypeError: ' + error.message;
            throw error;
        } else if (arguments.length === 2) {
            // isPointInStroke(x, y)
            [x, y] = arguments;
            path = this._currentPath;
        } else if (arguments.length === 3) {
            // isPointInStroke(path, x, y)
            [path, x, y] = arguments;
            if (!path || typeof path !== 'object' || !path.commands) {
                const error = new TypeError('First argument must be a Path2D object');
                error.message = 'TypeError: ' + error.message;
                throw error;
            }
        } else if (arguments.length > 3) {
            const error = new TypeError('Invalid number of arguments for isPointInStroke');
            error.message = 'TypeError: ' + error.message;
            throw error;
        }

        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number') {
            return false;
        }

        if (!path || !path.commands || path.commands.length === 0) {
            return false;
        }

        // Per the HTML5 Canvas spec the query point is in canvas (device) space and
        // is NOT affected by the current transform.

        // Create stroke properties object from current context state
        const strokeProps = {
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit,
            lineDash: this._lineDash,
            lineDashOffset: this._lineDashOffset
        };

        // The stroke parts, relative to the path's anchor (origin), as stroke() makes them
        const origin = { x: 0, y: 0 };
        let strokePolygons;
        let strokeTransform;
        if (path === this._currentPath) {
            // Device-space centerline: map back by drawT⁻¹, stroke with the round pen
            // in draw-time user space, then forward by drawT — mirroring stroke().
            const drawT = this._transform;
            let inv;
            try {
                inv = drawT.invert();
            } catch (e) {
                return false;
            }
            strokePolygons = StrokeGenerator.generateStrokePolygons(
                this._transformPathPoints(path, inv),
                strokeProps,
                Math.max(drawT.scaleX, drawT.scaleY),
                origin
            );
            strokeTransform = drawT;
        } else {
            // External user-space path: stroke, then map by the current CTM.
            strokePolygons = StrokeGenerator.generateStrokePolygons(
                path,
                strokeProps,
                Math.max(this._transform.scaleX, this._transform.scaleY),
                origin
            );
            strokeTransform = this._transform;
        }
        if (strokePolygons.length === 0) {
            return false;
        }

        // Test point against the stroke polygons using nonzero winding rule
        // (stroke hit testing doesn't use fill rules like path filling does), in the
        // device frame stroke() fills them in, so a tie is answered as it is painted.
        return PolygonFiller.isPointInStrokePolygons(x, y, strokePolygons, strokeTransform, origin);
    }

    /**
     * Calculate distance from a point to a line segment
     * @param {number} px - Point x coordinate
     * @param {number} py - Point y coordinate
     * @param {number} x1 - Line segment start x
     * @param {number} y1 - Line segment start y
     * @param {number} x2 - Line segment end x
     * @param {number} y2 - Line segment end y
     * @returns {number} Shortest distance from point to line segment
     * @private
     */
    _distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;

        // If line segment is actually a point
        if (dx === 0 && dy === 0) {
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        // Calculate parameter t for closest point on line
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

        // Find closest point on line segment
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;

        // Return distance from point to closest point on segment
        return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
    }

    /**
     * The clip rect to hand a renderer for the CURRENT draw, paired with
     * _clipMaskForDraw(): the context's _clipRect when the draw may take the rect
     * and the mask separately, else null (the mask then carries the rect too).
     *
     * A renderer that clamps its extent to the rect and tests the mask bit per
     * pixel draws exactly mask ∧ rect ONLY when the clip's sole effect is to
     * restrict which pixels the draw writes. That holds for source-over (and the
     * other per-pixel Porter-Duff ops that touch only source-covered pixels) with
     * no shadow. It does NOT hold for:
     *   - canvas-wide composite ops (copy / destination-atop / source-in /
     *     source-out / destination-in): these also CLEAR pixels the source
     *     doesn't cover, in a whole-surface pass that reads only the mask;
     *   - shadows: the blurred shadow spreads beyond the shape, and its
     *     composite (ShadowPipeline) reads only the mask.
     * We gate on the cached _isSourceOver (⊂ non-canvas-wide) + _noShadow, which
     * is conservative, correct, and covers all of Fizzygum's clipped traffic.
     * Evaluated per draw because composite/shadow can change after clip().
     * @private
     */
    _clipRectForDraw() {
        return this._isSourceOver && this._noShadow ? this._clipRect : null;
    }

    /**
     * The clip mask to hand a renderer for the CURRENT draw, paired with
     * _clipRectForDraw(): the installed mask itself when the draw takes the rect
     * separately, else the combined mask (_combinedClipMask). Null = nothing to
     * test per pixel.
     * @private
     */
    _clipMaskForDraw() {
        return this._isSourceOver && this._noShadow ? this._clipMask : this._combinedClipMask();
    }

    /**
     * As _clipMaskForDraw, as the raw buffer (or null) for the renderers that
     * take a `Uint8Array` clip argument.
     * @private
     */
    _clipBufferForDraw() {
        const mask = this._clipMaskForDraw();
        return mask ? mask.buffer : null;
    }

    /**
     * The WHOLE clip as one mask: _clipMask ∧ _clipRect. For the consumers that
     * cannot take the rect separately — renderers whose only clip input is a
     * buffer (RectOpsAA.fillStroke_AA_Any, RectOpsRot, RoundedRectOpsRot, ArcOps,
     * LineOps/QuadScanOps), clearRect's per-pixel test, and every draw that
     * _clipRectForDraw() refuses (canvas-wide composite, shadow). With no rect it
     * is the installed mask itself (null = no clip at all). Otherwise it is built
     * on first use into _combinedClip, a SEPARATE field: installing it as
     * _clipMask would turn every later rect clip() into mask work and make every
     * later save() share a canvas-sized mask that a rect could describe.
     * @private
     */
    _combinedClipMask() {
        const rect = this._clipRect;
        if (rect === null) return this._clipMask;
        if (this._combinedClip === null) {
            const combined = Context2D._rectToClipMask(rect, this.surface.width, this.surface.height);
            // Outside the rect's rows the rect mask is all clipped already.
            if (this._clipMask !== null) combined.intersectWithRows(this._clipMask, rect.y0, rect.y1);
            this._combinedClip = combined;
        }
        return this._combinedClip;
    }

    /**
     * As _combinedClipMask, as the raw buffer (or null).
     * @private
     */
    _combinedClipBuffer() {
        const mask = this._combinedClipMask();
        return mask ? mask.buffer : null;
    }

    /**
     * Build a ClipMask whose visible pixels are EXACTLY the half-open rect
     * [x0,x1) × [y0,y1). Because `_clipRect` is defined as the exact pixel set
     * `fillPolygonsToClipMask` would expose for that rect, this reproduces the
     * mask a rect `clip()` would build under the pure mask model — byte-for-byte.
     * @private
     */
    static _rectToClipMask(rect, width, height) {
        const mask = new ClipMask(width, height, false);
        for (let y = rect.y0; y < rect.y1; y++) {
            for (let x = rect.x0; x < rect.x1; x++) {
                mask.setPixel(x, y, true);
            }
        }
        return mask;
    }

    /**
     * Rect clip detection: does this flattened path collapse to a single
     * axis-aligned rectangle in device space? If so, return the exact set of
     * pixels the path's mask WOULD expose, as a half-open integer rect
     * { x0, y0, x1, y1 } clamped to the surface. Otherwise return null.
     *
     * BYTE-IDENTICAL CONTRACT — the returned rect must expose EXACTLY the pixels
     * that PolygonFiller.fillPolygonsToClipMask would set for this path, so a
     * draw clamped to the rect is pixel-identical to one tested against that mask:
     *   - X (per _fillClipMaskSpans): a span [left, right) sets columns
     *     [ceil(left − 0.5), ceil(right − 0.5)).
     *   - Y (per PolygonFiller._scanRow's half-open `upper.y <= y+0.5 < lower.y`
     *     edge test): rows [ceil(top − 0.5), ceil(bottom − 0.5)).
     * Both axes therefore round with ceil(v − 0.5). (This supersedes the
     * `ceil(min)/floor(max)+1` sketch in the plan's §5.2, which encoded the older
     * inclusive-endX mask that over-exposed the right/bottom edge column.)
     *
     * Corners are transformed with the SAME transform.transformPoint call that
     * fillPolygonsToClipMask uses, so floating-point rounding is identical.
     *
     * @param {Array<Array<{x,y}>>} polygons - flattened path polygons (untransformed)
     * @param {Transform2D} transform - the transform the mask would be built under
     * @param {number} width - surface width (for clamping)
     * @param {number} height - surface height (for clamping)
     * @returns {{x0:number,y0:number,x1:number,y1:number}|null}
     * @private
     */
    static _detectAxisAlignedRect(polygons, transform, width, height) {
        if (polygons.length !== 1) return null;
        const src = polygons[0];
        if (src.length < 4) return null; // fewer than 4 points can't be a rect

        // Transform vertices exactly as fillPolygonsToClipMask does, collapsing
        // consecutive duplicates and a closing vertex equal to the first (a
        // rect() path flattens to 5 pts: the 4 corners + a repeated start; a
        // moveTo+4×lineTo+closePath likewise carries a closing duplicate).
        const v = [];
        for (let i = 0; i < src.length; i++) {
            const p = transform.transformPoint(src[i]);
            const last = v.length ? v[v.length - 1] : null;
            if (last && last.x === p.x && last.y === p.y) continue; // consecutive dup
            v.push(p);
        }
        if (v.length > 1) {
            const first = v[0],
                last = v[v.length - 1];
            if (first.x === last.x && first.y === last.y) v.pop(); // closing dup
        }
        if (v.length !== 4) return null; // exactly 4 distinct corners for a rect

        // Every edge (incl. the wrap-around) must be axis-aligned: exactly one of
        // dx/dy is zero. A diagonal edge means a rotated rect, a triangle, or a
        // bowtie — all conservatively rejected to the mask path (their fill
        // region is not their bounding box, so a rect would not be byte-identical).
        for (let i = 0; i < 4; i++) {
            const a = v[i],
                b = v[(i + 1) % 4];
            const horiz = a.y === b.y;
            const vert = a.x === b.x;
            if (horiz === vert) return null; // both (degenerate) or neither (diagonal)
        }

        const xMin = Math.min(v[0].x, v[1].x, v[2].x, v[3].x);
        const xMax = Math.max(v[0].x, v[1].x, v[2].x, v[3].x);
        const yMin = Math.min(v[0].y, v[1].y, v[2].y, v[3].y);
        const yMax = Math.max(v[0].y, v[1].y, v[2].y, v[3].y);
        // (xMin<xMax and yMin<yMax are implied: 4 distinct corners joined by
        //  axis-aligned edges span both axes.)

        // Rasterize to the same half-open pixel rect the mask would expose, then
        // clamp to the surface (mask spans clamp to [0, width-1] / [0, height-1]).
        let x0 = Math.max(0, Math.ceil(xMin - 0.5));
        let y0 = Math.max(0, Math.ceil(yMin - 0.5));
        let x1 = Math.min(width, Math.ceil(xMax - 0.5));
        let y1 = Math.min(height, Math.ceil(yMax - 0.5));
        if (x1 < x0) x1 = x0;
        if (y1 < y0) y1 = y0;
        return { x0, y0, x1, y1 };
    }

    /**
     * Intersect two half-open integer rects. A degenerate (empty) result keeps
     * x0/y0 as the lower bound with x1<=x0 / y1<=y0 so consumers trivial-reject.
     * @private
     */
    static _intersectRect(a, b) {
        const x0 = Math.max(a.x0, b.x0);
        const y0 = Math.max(a.y0, b.y0);
        const x1 = Math.min(a.x1, b.x1);
        const y1 = Math.min(a.y1, b.y1);
        return { x0, y0, x1: x1 < x0 ? x0 : x1, y1: y1 < y0 ? y0 : y1 };
    }

    /**
     * Intersect the clip with a path (HTML5 Canvas clip() semantics: the new clip
     * is the old one AND the path's fill region). See CLIPPING at the top of this
     * file for the rect + immutable-mask model this maintains.
     *
     * @param {Path2D} path - Optional path to clip with (uses current path if not provided)
     * @param {string} rule - Fill rule: 'nonzero' (default) or 'evenodd'
     */
    clip(path, rule) {
        // The same (path?, fillRule?) overload as fill(): a leading string is
        // the fill rule, and no path means the current default path.
        if (typeof path === 'string') {
            rule = path;
            path = undefined;
        }
        const pathToClip = path || this._currentPath;
        const clipRule = rule || 'nonzero';

        // The current default path already holds device-space geometry → flatten
        // under IDENTITY. An external Path2D is transform-independent → flatten
        // under the current CTM.
        const opTransform = pathToClip === this._currentPath ? Transform2D.IDENTITY : this._transform;

        // Flatten path.
        const polygons = PathFlattener.flattenPath(pathToClip);
        const width = this.surface.width;
        const height = this.surface.height;

        if (Context2D._disableTier0Clip) {
            // Test oracle — the pure mask model: a full-surface mask of the path,
            // ANDed with the whole prior clip, and no rect tracked.
            const mask = new ClipMask(width, height, false);
            PolygonFiller.fillPolygonsToClipMask(mask, polygons, clipRule, opTransform);
            const prior = this._combinedClipMask();
            if (prior !== null) mask.intersectWith(prior);
            this._clipMask = mask;
            this._clipRect = null;
            this._combinedClip = null;
            return;
        }

        const detectedRect = Context2D._detectAxisAlignedRect(polygons, opTransform, width, height);

        if (detectedRect) {
            // RECT clip: intersect into the rect and leave the mask alone, whether
            // or not one is installed. detectedRect exposes exactly the pixels the
            // path's mask would, and the half-open intersection is exact, so
            // mask ∧ (rect ∩ detectedRect) is the HTML5 intersection.
            this._clipRect = this._clipRect ? Context2D._intersectRect(this._clipRect, detectedRect) : detectedRect;
        } else {
            // NON-RECT clip: rasterise the path into a fresh all-clipped mask, but
            // only inside the current rect — path ∩ rect, exactly what ANDing the
            // path with the rect's own mask would give, without building either at
            // full size. Then AND the previous mask INTO the fresh one and install
            // it: the previous mask is never written, because saved states share it.
            const rect = this._clipRect;
            const mask = new ClipMask(width, height, false);
            PolygonFiller.fillPolygonsToClipMask(mask, polygons, clipRule, opTransform, rect);
            if (this._clipMask !== null) {
                // Outside the rect's rows the fresh mask is all clipped already.
                if (rect !== null) mask.intersectWithRows(this._clipMask, rect.y0, rect.y1);
                else mask.intersectWith(this._clipMask);
            }
            this._clipMask = mask;
            // _clipRect stays: the mask lies inside it, and it keeps clamping draws.
        }

        // The combined-mask cache belonged to the previous (mask, rect) pair.
        this._combinedClip = null;

        // clip() does not auto-stroke the path (per HTML5 Canvas spec)
    }

    // Image rendering
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
        // Validate ImageLike object at API level
        if (!image || typeof image !== 'object') {
            throw new Error('First argument must be an ImageLike object');
        }

        if (typeof image.width !== 'number' || typeof image.height !== 'number') {
            throw new Error('ImageLike must have numeric width and height properties');
        }

        if (!(image.data instanceof Uint8ClampedArray)) {
            throw new Error('ImageLike data must be a Uint8ClampedArray');
        }

        // Mark path-based rendering for testing (drawImage() has no direct rendering currently)
        Context2D._markPathBasedRendering();

        // Set up rasterizer operation
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: new Transform2D([
                this._transform.a,
                this._transform.b,
                this._transform.c,
                this._transform.d,
                this._transform.e,
                this._transform.f
            ]),
            // The rect and the mask separately (drawImage clamps its extent to the
            // rect and tests each pixel's bit), or the combined mask alone when the
            // composite op or a shadow rules the split out — see _clipRectForDraw.
            clipMask: this._clipMaskForDraw(),
            clipRect: this._clipRectForDraw(),
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY,
            // Sampling policy input (see Rasterizer._drawImageInternal)
            imageSmoothingEnabled: this._imageSmoothingEnabled
        });

        // Delegate to rasterizer
        this.rasterizer.drawImage.apply(this.rasterizer, arguments);

        // End rasterizer operation
        this.rasterizer.endOp();
    }

    // Text rendering — uses the vendored BitmapText engine via TextRenderer.
    // Phase 2: fast path only (BitmapText resets transform to identity
    // internally, so user transforms are not yet honoured). Phase 3 adds the
    // intermediate-buffer slow path for rotated/scaled text.

    fillText(text, x, y, maxWidth) {
        // maxWidth (HTML5 "shrink-to-fit") is not implementable on top of
        // BitmapText's pre-rasterised atlas glyphs. Rather than silently
        // ignore the argument and quietly mis-render long strings, we
        // throw — explicit failure beats silent no-op, mirroring strokeText.
        if (maxWidth !== undefined) {
            throw new Error(
                "fillText: maxWidth is not supported by SWCanvas's BitmapText backend. " +
                    'Drop the argument or pre-measure with measureText and adjust your layout.'
            );
        }
        return TextRenderer.fillText(this, text, x, y);
    }

    measureText(text) {
        return TextRenderer.measureText(this, text);
    }

    strokeText() {
        throw new Error("strokeText is not supported by SWCanvas's BitmapText backend. " + 'Use fillText instead.');
    }

    // Line dash methods

    /**
     * Set line dash pattern
     * @param {Array<number>} segments - Array of dash and gap lengths
     */
    setLineDash(segments) {
        if (!Array.isArray(segments)) {
            throw new Error('setLineDash expects an array');
        }

        // Validate all segments are numbers and non-negative
        for (let i = 0; i < segments.length; i++) {
            if (typeof segments[i] !== 'number' || isNaN(segments[i])) {
                throw new Error('Dash segments must be numbers');
            }
            if (segments[i] < 0) {
                throw new Error('Dash segments must be non-negative');
            }
        }

        // Store original pattern for getLineDash()
        this._originalLineDash = segments.slice();

        // Create working pattern - duplicate if odd length
        // This matches HTML5 Canvas behavior: [5, 10, 15] becomes [5, 10, 15, 5, 10, 15]
        this._lineDash = segments.slice();
        if (this._lineDash.length % 2 === 1) {
            this._lineDash = this._lineDash.concat(this._lineDash);
        }
    }

    /**
     * Get current line dash pattern
     * @returns {Array<number>} Copy of current dash pattern
     */
    getLineDash() {
        // Return copy of original pattern as set by user
        return this._originalLineDash.slice();
    }

    /**
     * Set line dash offset
     * @param {number} offset - Starting offset into dash pattern
     */
    set lineDashOffset(offset) {
        if (typeof offset !== 'number' || isNaN(offset)) {
            return; // Silently ignore invalid values like HTML5 Canvas
        }
        this._lineDashOffset = offset;
    }

    /**
     * Get line dash offset
     * @returns {number} Current dash offset
     */
    get lineDashOffset() {
        return this._lineDashOffset;
    }

    // Gradient and Pattern Creation Methods

    /**
     * Create a linear gradient
     * @param {number} x0 - Start point x coordinate
     * @param {number} y0 - Start point y coordinate
     * @param {number} x1 - End point x coordinate
     * @param {number} y1 - End point y coordinate
     * @returns {LinearGradient} New linear gradient object
     */
    createLinearGradient(x0, y0, x1, y1) {
        return new LinearGradient(x0, y0, x1, y1);
    }

    /**
     * Create a radial gradient
     * @param {number} x0 - Inner circle center x
     * @param {number} y0 - Inner circle center y
     * @param {number} r0 - Inner circle radius
     * @param {number} x1 - Outer circle center x
     * @param {number} y1 - Outer circle center y
     * @param {number} r1 - Outer circle radius
     * @returns {RadialGradient} New radial gradient object
     */
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
        return new RadialGradient(x0, y0, r0, x1, y1, r1);
    }

    /**
     * Create a conic gradient
     * @param {number} angle - Starting angle in radians
     * @param {number} x - Center point x coordinate
     * @param {number} y - Center point y coordinate
     * @returns {ConicGradient} New conic gradient object
     */
    createConicGradient(angle, x, y) {
        return new ConicGradient(angle, x, y);
    }

    /**
     * Create a pattern from an image
     * @param {Object} image - ImageLike object (canvas, surface, imagedata)
     * @param {string} repetition - Repetition mode: 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'
     * @returns {Pattern} New pattern object
     */
    createPattern(image, repetition) {
        return new Pattern(image, repetition);
    }

    // ========================================================================
    // DIRECT SHAPE APIs
    // These methods bypass the path system for maximum performance
    // ========================================================================

    /**
     * Fill a circle directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    fillCircle(centerX, centerY, radius) {
        // Non-positive, NaN and infinite radii draw nothing (an infinite radius
        // would otherwise sample every pixel center as inside).
        if (!(radius > 0 && radius < Infinity)) return;

        if (this._isInvisibleDraw(this._fillStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // Uniform-scale gate (mirrors fillRoundRect/fillStadium): the direct
        // paths scale the radius by the transform's uniform scale (a geometric
        // mean), so under a NON-uniform transform they would draw a CIRCLE
        // where an ellipse belongs. Route to the generic pipeline instead via
        // an un-baked user-space path under the CTM — correct shape, slower.
        if (!this._transform.isUniformScale) {
            Context2D._markPathBasedRendering();
            const fallbackPath = new SWPath2D();
            fallbackPath.arc(centerX, centerY, radius, 0, TAU);
            this.fill(fallbackPath);
            return;
        }

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius considering non-uniform scaling
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;

        // Get paint source
        const paintSource = this._fillStyle;

        // Use optimized circle renderer (user-space args feed its generic fallback)
        this._fillCircleDirect(center.x, center.y, scaledRadius, paintSource, centerX, centerY, radius);
    }

    /**
     * Stroke a circle directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    strokeCircle(centerX, centerY, radius) {
        if (!(radius > 0 && radius < Infinity)) return; // see fillCircle

        if (this._isInvisibleDraw(this._strokeStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // Uniform-scale gate (mirrors fillRoundRect/fillStadium): the direct
        // paths scale the radius by the transform's uniform scale (a geometric
        // mean), so under a NON-uniform transform they would draw a CIRCLE
        // where an ellipse belongs. Route to the generic pipeline instead via
        // an un-baked user-space path under the CTM — correct shape, slower.
        if (!this._transform.isUniformScale) {
            Context2D._markPathBasedRendering();
            const fallbackPath = new SWPath2D();
            fallbackPath.arc(centerX, centerY, radius, 0, TAU);
            this.stroke(fallbackPath);
            return;
        }

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius and line width
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;
        const scaledLineWidth = this._lineWidth * scale;

        // Get paint source
        const paintSource = this._strokeStyle;

        // Use optimized circle stroke renderer (user-space args feed its generic fallback)
        this._strokeCircleDirect(
            center.x,
            center.y,
            scaledRadius,
            scaledLineWidth,
            paintSource,
            centerX,
            centerY,
            radius
        );
    }

    /**
     * Fill and stroke a circle in one operation
     * Uses unified rendering when possible to prevent fill/stroke gaps.
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    fillStrokeCircle(centerX, centerY, radius) {
        if (!(radius > 0 && radius < Infinity)) return; // see fillCircle

        if (this._isInvisibleDraw(this._fillStyle) && this._isInvisibleDraw(this._strokeStyle)) {
            return; // Neither half can change a pixel under source-over
        }

        // Uniform-scale gate (mirrors fillRoundRect/fillStadium): the direct
        // paths scale the radius by the transform's uniform scale (a geometric
        // mean), so under a NON-uniform transform they would draw a CIRCLE
        // where an ellipse belongs. Route to the generic pipeline instead via
        // an un-baked user-space path under the CTM — correct shape, slower.
        if (!this._transform.isUniformScale) {
            Context2D._markPathBasedRendering();
            const fallbackPath = new SWPath2D();
            fallbackPath.arc(centerX, centerY, radius, 0, TAU);
            this.fill(fallbackPath);
            this.stroke(fallbackPath);
            return;
        }

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius and line width
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;
        const scaledLineWidth = this._lineWidth * scale;

        // Get paint sources
        const fillPaintSource = this._fillStyle;
        const strokePaintSource = this._strokeStyle;

        // Check if we can use unified direct rendering:
        // - Both fill and stroke are solid Colors
        // - Composite operation is source-over
        const fillIsColor = fillPaintSource instanceof Color;
        const strokeIsColor = strokePaintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        const hasFill = fillIsColor && fillPaintSource.a > 0;
        const hasStroke = strokeIsColor && strokePaintSource.a > 0;

        // _noShadow term: the direct renderers cannot draw a ctx shadow, so an
        // active shadow routes to the generic fallback (which can) - the same
        // policy _canUseDirectRendering applies to the rect family.
        if (
            fillIsColor &&
            strokeIsColor &&
            isSourceOver &&
            this._noShadow &&
            this._lineDash.length === 0 &&
            (hasFill || hasStroke)
        ) {
            // Use unified method for coordinated fill+stroke rendering (no gaps).
            // Clip rect and mask separately (see strokeRect).
            const clipRect = this._clipRectForDraw();
            const clipBuffer = this._clipBufferForDraw();
            CircleOps.fillStroke_Any(
                this.surface,
                center.x,
                center.y,
                scaledRadius,
                scaledLineWidth,
                hasFill ? fillPaintSource : null,
                hasStroke ? strokePaintSource : null,
                this.globalAlpha,
                clipBuffer,
                clipRect
            );
        } else {
            // Fallback to sequential rendering for gradients, patterns, or non-source-over
            this._fillCircleDirect(center.x, center.y, scaledRadius, fillPaintSource, centerX, centerY, radius);
            this._strokeCircleDirect(
                center.x,
                center.y,
                scaledRadius,
                scaledLineWidth,
                strokePaintSource,
                centerX,
                centerY,
                radius
            );
        }
    }

    // ========================================================================
    // Arc rendering methods (partial arcs, not full circles)
    // ========================================================================

    /**
     * Fill an arc (pie slice) directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction
     */
    fillArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        if (!(radius > 0 && radius < Infinity)) return; // see fillCircle

        if (this._isInvisibleDraw(this._fillStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // Uniform-scale gate — see fillCircle: the direct arc paths scale the
        // radius by the geometric-mean uniform scale, the wrong shape under a
        // non-uniform transform. Un-baked user-space path under the CTM instead.
        if (!this._transform.isUniformScale) {
            Context2D._markPathBasedRendering();
            const fallbackPath = new SWPath2D();
            fallbackPath.moveTo(centerX, centerY);
            fallbackPath.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
            fallbackPath.closePath();
            this.fill(fallbackPath);
            return;
        }

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;

        // Normalize angles
        const angles = ArcOps.normalizeAngles(startAngle, endAngle, anticlockwise);

        // Get paint source
        const paintSource = this._fillStyle;

        // Check for direct rendering conditions. _noShadow: the direct
        // renderers cannot draw a ctx shadow - an active shadow routes to the
        // generic fallback (same policy as the rect family's gates).
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';

        if (isColor && isSourceOver && this._noShadow) {
            // ArcOps takes no clip rect (unlike CircleOps): its 1px-stroke writers
            // bounds-check inside shared inline preprocessor templates
            // (SET_OPAQUE_ARC_FAST_CLIPPED / BLEND_ALPHA_ARC_FAST_CLIPPED) and
            // stroke1px_Opaq_Exact hoists its bounds check out of the loop, so a
            // clipRect there means changing codegen, not a mechanical clamp — and
            // no Fizzygum call site draws arcs directly today. So the whole ArcOps
            // family gets the combined mask (mask ∧ rect); wire the rect into the
            // family as a whole, when a hot clipped caller appears.
            const clipBuffer = this._combinedClipBuffer();
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0;
            if (isOpaque) {
                ArcOps.fill_Opaq(
                    this.surface,
                    center.x,
                    center.y,
                    scaledRadius,
                    angles.start,
                    angles.end,
                    paintSource,
                    clipBuffer
                );
            } else if (paintSource.a > 0) {
                ArcOps.fill_Alpha(
                    this.surface,
                    center.x,
                    center.y,
                    scaledRadius,
                    angles.start,
                    angles.end,
                    paintSource,
                    this.globalAlpha,
                    clipBuffer
                );
            }
            return;
        }

        // Gradients/patterns/non-source-over: generic pipeline via an un-baked
        // USER-space external path under the live CTM — same form as the
        // !isUniformScale gate above (device coords on the default path would
        // apply the CTM twice; see _fillCircleDirect's fallback note).
        Context2D._markPathBasedRendering();
        const fallbackPath = new SWPath2D();
        fallbackPath.moveTo(centerX, centerY);
        fallbackPath.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
        fallbackPath.closePath();
        this.fill(fallbackPath);
    }

    /**
     * Stroke only the outer arc curve (not the lines to center)
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction
     */
    outerStrokeArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        if (!(radius > 0 && radius < Infinity)) return; // see fillCircle

        if (this._isInvisibleDraw(this._strokeStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // Uniform-scale gate — see fillCircle: the direct arc paths scale the
        // radius by the geometric-mean uniform scale, the wrong shape under a
        // non-uniform transform. Un-baked user-space path under the CTM instead.
        if (!this._transform.isUniformScale) {
            Context2D._markPathBasedRendering();
            const fallbackPath = new SWPath2D();
            fallbackPath.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
            this.stroke(fallbackPath);
            return;
        }

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius and line width
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;
        const scaledLineWidth = this._lineWidth * scale;

        // Normalize angles
        const angles = ArcOps.normalizeAngles(startAngle, endAngle, anticlockwise);

        // Get paint source
        const paintSource = this._strokeStyle;

        // Check for direct rendering conditions
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        // Direct rendering only supports butt line caps (open arc shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        // _noShadow: see fillArc - shadows only render via the generic fallback.
        if (isColor && isSourceOver && isButtCap && this._noShadow && this._lineDash.length === 0) {
            // ArcOps takes one clip buffer: the combined mask — see fillArc.
            const clipBuffer = this._combinedClipBuffer();
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0;
            const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;
            // HAIRLINE (sub-pixel) stroke — see the class-level note at the top
            // of this file. Below 1px this used to reach strokeOuter_*, whose
            // annulus scan at a sub-pixel width degenerates into a handful of
            // FULL-opacity scattered pixels (measured: 8 of 19, outline broken).
            const isHairlineStroke = scaledLineWidth > 0 && scaledLineWidth < 1 && !is1pxStroke;

            if (is1pxStroke || isHairlineStroke) {
                // Optimized 1px stroke path
                if (isOpaque && !isHairlineStroke) {
                    ArcOps.stroke1px_Opaq(
                        this.surface,
                        center.x,
                        center.y,
                        scaledRadius,
                        angles.start,
                        angles.end,
                        paintSource,
                        clipBuffer
                    );
                } else if (paintSource.a > 0) {
                    ArcOps.stroke1px_Alpha(
                        this.surface,
                        center.x,
                        center.y,
                        scaledRadius,
                        angles.start,
                        angles.end,
                        paintSource,
                        isHairlineStroke ? this.globalAlpha * scaledLineWidth : this.globalAlpha,
                        clipBuffer
                    );
                }
            } else {
                // Thick stroke path
                if (isOpaque) {
                    ArcOps.strokeOuter_Opaq(
                        this.surface,
                        center.x,
                        center.y,
                        scaledRadius,
                        angles.start,
                        angles.end,
                        scaledLineWidth,
                        paintSource,
                        clipBuffer
                    );
                } else if (paintSource.a > 0) {
                    ArcOps.strokeOuter_Alpha(
                        this.surface,
                        center.x,
                        center.y,
                        scaledRadius,
                        angles.start,
                        angles.end,
                        scaledLineWidth,
                        paintSource,
                        this.globalAlpha,
                        clipBuffer
                    );
                }
            }
            return;
        }

        // Gradients/patterns/non-source-over/round-square caps: generic
        // pipeline via an un-baked USER-space external path under the live CTM
        // (arc only, not pie slice) — same form as the !isUniformScale gate
        // above; see _fillCircleDirect's fallback note.
        Context2D._markPathBasedRendering();
        const fallbackPath = new SWPath2D();
        fallbackPath.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
        this.stroke(fallbackPath);
    }

    /**
     * Fill an arc (pie slice) and stroke only the outer curve in one operation
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction
     */
    fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        if (!(radius > 0 && radius < Infinity)) return; // see fillCircle

        if (this._isInvisibleDraw(this._fillStyle) && this._isInvisibleDraw(this._strokeStyle)) {
            return; // Neither half can change a pixel under source-over
        }

        // Uniform-scale gate — see fillCircle: the direct arc paths scale the
        // radius by the geometric-mean uniform scale, the wrong shape under a
        // non-uniform transform. Un-baked user-space path under the CTM instead.
        if (!this._transform.isUniformScale) {
            Context2D._markPathBasedRendering();
            const fallbackPath = new SWPath2D();
            fallbackPath.moveTo(centerX, centerY);
            fallbackPath.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
            fallbackPath.closePath();
            this.fill(fallbackPath);
            const strokePath = new SWPath2D();
            strokePath.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
            this.stroke(strokePath);
            return;
        }

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius and line width
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;
        const scaledLineWidth = this._lineWidth * scale;

        // Normalize angles
        const angles = ArcOps.normalizeAngles(startAngle, endAngle, anticlockwise);

        // Get paint sources
        const fillPaintSource = this._fillStyle;
        const strokePaintSource = this._strokeStyle;

        // Check for unified direct rendering
        const fillIsColor = fillPaintSource instanceof Color;
        const strokeIsColor = strokePaintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        const hasFill = fillIsColor && fillPaintSource.a > 0;
        const hasStroke = strokeIsColor && strokePaintSource.a > 0;
        // Direct rendering only supports butt line caps (open arc shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        // _noShadow: see fillArc - shadows only render via the generic fallback.
        if (
            fillIsColor &&
            strokeIsColor &&
            isSourceOver &&
            isButtCap &&
            this._noShadow &&
            this._lineDash.length === 0 &&
            (hasFill || hasStroke)
        ) {
            // Use unified direct rendering. ArcOps takes one clip buffer: the
            // combined mask — see fillArc.
            ArcOps.fillStrokeOuter_Any(
                this.surface,
                center.x,
                center.y,
                scaledRadius,
                angles.start,
                angles.end,
                scaledLineWidth,
                hasFill ? fillPaintSource : null,
                hasStroke ? strokePaintSource : null,
                this.globalAlpha,
                this._combinedClipBuffer()
            );
            return;
        }

        // Sequential generic rendering via un-baked USER-space external paths
        // under the live CTM — same form as the !isUniformScale gate above;
        // see _fillCircleDirect's fallback note.
        // Presence here is paint EXISTENCE, not paint type: hasFill/hasStroke
        // embed `instanceof Color` (correct for the direct arm's null-paint
        // slots) and would silently DROP a gradient/pattern half instead of
        // falling it back. A Color half at a === 0 draws nothing either way
        // and is skipped.
        Context2D._markPathBasedRendering();
        const fallbackHasFill = fillIsColor ? fillPaintSource.a > 0 : true;
        const fallbackHasStroke = strokeIsColor ? strokePaintSource.a > 0 : true;

        // Fill pie slice
        if (fallbackHasFill) {
            const fillPath = new SWPath2D();
            fillPath.moveTo(centerX, centerY);
            fillPath.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
            fillPath.closePath();
            this.fill(fillPath);
        }

        // Stroke outer arc only
        if (fallbackHasStroke) {
            const strokePath = new SWPath2D();
            strokePath.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
            this.stroke(strokePath);
        }
    }

    /**
     * Stroke a line directly without using the path system
     * @param {number} x1 - Start X coordinate
     * @param {number} y1 - Start Y coordinate
     * @param {number} x2 - End X coordinate
     * @param {number} y2 - End Y coordinate
     */
    strokeLine(x1, y1, x2, y2) {
        // Validate parameters up front (family convention - see fillRect), so
        // bad arguments fail identically whatever the paint source.
        if (typeof x1 !== 'number' || typeof y1 !== 'number' || typeof x2 !== 'number' || typeof y2 !== 'number') {
            throw new Error('Line coordinates must be numbers');
        }

        if (this._isInvisibleDraw(this._strokeStyle)) {
            return; // Transparent paint / globalAlpha 0 under source-over draws nothing
        }

        // Deliberately NOT uniform-scale-gated (unlike the circle/arc entries):
        // the endpoints are transformed exactly, so the geometry is always
        // right — only the stroke WIDTH uses the geometric-mean uniform scale,
        // a direction-dependent approximation under non-uniform transforms.
        // No caller strokes lines under a non-uniform transform, and the
        // generic stroker makes lines cheap anyway; gate it if one appears.

        // The endpoints in the line's device frame, as stroke() takes the same line: relative
        // to the floor of the start point (StrokeGenerator's anchor), placed from the device
        // pixel (ox, oy) that anchor lands at (PolygonFiller.deviceAnchor), so the line covers
        // the same pixels wherever it is drawn - and the pixels stroke() covers, ties included
        const t = this._transform;
        let ax = Math.floor(x1);
        let ay = Math.floor(y1);
        if (!Number.isFinite(ax) || !Number.isFinite(ay)) {
            ax = 0;
            ay = 0;
        }
        const anchor = PolygonFiller.deviceAnchor(t, ax, ay);
        const px1 = x1 - ax,
            py1 = y1 - ay,
            px2 = x2 - ax,
            py2 = y2 - ay;

        // Calculate effective line width
        const scale = t.uniformScale;
        const scaledLineWidth = this._lineWidth * scale;

        // Get paint source
        const paintSource = this._strokeStyle;

        // Use optimized line renderer (user-space args feed its generic fallback)
        this._strokeLineDirect(
            t.a * px1 + t.c * py1 + anchor.rx,
            t.b * px1 + t.d * py1 + anchor.ry,
            t.a * px2 + t.c * py2 + anchor.rx,
            t.b * px2 + t.d * py2 + anchor.ry,
            anchor.ox,
            anchor.oy,
            scaledLineWidth,
            paintSource,
            x1,
            y1,
            x2,
            y2
        );
    }

    // ========================================================================
    // Private optimized shape renderers
    // ========================================================================

    /**
     * Optimized circle fill using midpoint algorithm with horizontal spans
     * @private
     * @param {number} cx - Device-space center x (CTM pre-applied by the caller)
     * @param {number} cy - Device-space center y
     * @param {number} radius - Device-space radius (uniform scale pre-applied)
     * @param {Object} paintSource - Fill paint (Color, gradient, or pattern)
     * @param {number} userX - User-space center x, for the generic fallback
     * @param {number} userY - User-space center y, for the generic fallback
     * @param {number} userRadius - User-space radius, for the generic fallback
     */
    _fillCircleDirect(cx, cy, radius, paintSource, userX, userY, userRadius) {
        const surface = this.surface;

        // Check for solid color direct rendering
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';

        // _noShadow term in both: the direct renderers cannot draw a ctx
        // shadow - an active shadow routes to the generic fallback below (same
        // policy as the rect family's _canUseDirectRendering).
        const isOpaqueColor =
            isColor && paintSource.a === 255 && this.globalAlpha >= 1.0 && isSourceOver && this._noShadow;

        // Everything else a Color can be goes through fill_Alpha: a < 255, and
        // ALSO an opaque color under globalAlpha < 1 (like every sibling entry
        // - fillRect, fillRoundRect, fillArc, fillStadium dispatch that case to
        // their _Alpha renderer rather than the generic fallback).
        const isSemiTransparentColor =
            isColor && (paintSource.a < 255 || this.globalAlpha < 1.0) && isSourceOver && this._noShadow;

        if (isOpaqueColor || isSemiTransparentColor) {
            // Clip rect and mask separately (see strokeRect); the path fallback
            // below consults the context's own clip state, so nothing to forward
            // there.
            const clipRect = this._clipRectForDraw();
            const clipBuffer = this._clipBufferForDraw();
            if (isOpaqueColor) {
                // Direct rendering 1: 32-bit packed writes for opaque colors
                CircleOps.fill_Opaq(surface, cx, cy, radius, paintSource, clipBuffer, clipRect);
            } else {
                // Direct rendering 2: pixel-center scanlines with per-pixel alpha blending
                CircleOps.fill_Alpha(surface, cx, cy, radius, paintSource, this.globalAlpha, clipBuffer, clipRect);
            }
        } else {
            // Gradients/patterns/non-source-over: generic pipeline via an
            // un-baked USER-space external path, like every pre-gate fallback.
            // An external SWPath2D is rasterized under the live CTM, which maps
            // the geometry AND the paint source together (see fill()). The
            // device-space coordinates must not be used here: the current
            // default path bakes the CTM at build time, so feeding it
            // already-transformed points applies the CTM twice.
            Context2D._markPathBasedRendering();
            const fallbackPath = new SWPath2D();
            fallbackPath.arc(userX, userY, userRadius, 0, TAU);
            this.fill(fallbackPath);
        }
    }

    /**
     * Optimized circle stroke - dispatches to direct rendering when possible
     * @private
     * @param {number} cx - Device-space center x (CTM pre-applied by the caller)
     * @param {number} cy - Device-space center y
     * @param {number} radius - Device-space radius (uniform scale pre-applied)
     * @param {number} lineWidth - Device-space line width (uniform scale pre-applied)
     * @param {Object} paintSource - Stroke paint (Color, gradient, or pattern)
     * @param {number} userX - User-space center x, for the generic fallback
     * @param {number} userY - User-space center y, for the generic fallback
     * @param {number} userRadius - User-space radius, for the generic fallback
     */
    _strokeCircleDirect(cx, cy, radius, lineWidth, paintSource, userX, userY, userRadius) {
        const isColor = paintSource instanceof Color;
        const is1pxStroke = Math.abs(lineWidth - 1) < STROKE_1PX_TOLERANCE;
        // HAIRLINE (sub-pixel) stroke — see the class-level note at the top of
        // this file. lineWidth here is already in device units. Below 1px this
        // used to fall through to the path fallback at the bottom, which strokes
        // in DEVICE space at an identity transform: at identity that inherits
        // the generic pipeline's faint rule, but under a scaled transform it
        // re-rasterizes a sub-pixel ring it can no longer place and LOSES most
        // of it (measured: 35 of 70 ring pixels at scale 1.4, open). That is the
        // ring-vanish Fizzygum's rotate-handle hit. The fallback stays for what
        // it is actually for: gradient and pattern strokes at any width.
        const isHairlineStroke = lineWidth > 0 && lineWidth < 1 && !is1pxStroke;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        // Both direct arms below run only under source-over with no shadow, and
        // take the clip rect and the mask separately (see strokeRect). The path
        // fallback consults the context's own clip state, so off those arms the
        // pair is never fetched (fetching it there could build a combined mask).
        const directArmsEligible = isSourceOver && this._noShadow;
        const clipRect = directArmsEligible ? this._clipRectForDraw() : null;
        const clipBuffer = directArmsEligible ? this._clipBufferForDraw() : null;

        // Direct rendering 1: 1px strokes using Bresenham algorithm.
        // _noShadow on both branches: shadows only render via the generic
        // fallback (see _fillCircleDirect).
        if (
            isColor &&
            (is1pxStroke || isHairlineStroke) &&
            isSourceOver &&
            this._noShadow &&
            this._lineDash.length === 0
        ) {
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0 && !isHairlineStroke;
            if (isOpaque) {
                CircleOps.stroke1px_Opaq(this.surface, cx, cy, radius, paintSource, clipBuffer, clipRect);
                return;
            } else if (paintSource.a > 0) {
                CircleOps.stroke1px_Alpha(
                    this.surface,
                    cx,
                    cy,
                    radius,
                    paintSource,
                    isHairlineStroke ? this.globalAlpha * lineWidth : this.globalAlpha,
                    clipBuffer,
                    clipRect
                );
                return;
            }
        }

        // Direct rendering 2: Thick strokes using scanline annulus algorithm
        if (
            isColor &&
            isSourceOver &&
            this._noShadow &&
            this._lineDash.length === 0 &&
            lineWidth > 1 &&
            paintSource.a > 0
        ) {
            const isOpaqueThick = paintSource.a === 255 && this.globalAlpha >= 1.0;
            if (isOpaqueThick) {
                CircleOps.strokeThick_Opaq(this.surface, cx, cy, radius, lineWidth, paintSource, clipBuffer, clipRect);
            } else {
                CircleOps.strokeThick_Alpha(
                    this.surface,
                    cx,
                    cy,
                    radius,
                    lineWidth,
                    paintSource,
                    this.globalAlpha,
                    clipBuffer,
                    clipRect
                );
            }
            return;
        }

        // Gradients/patterns/non-source-over: generic pipeline via an un-baked
        // USER-space external path under the live CTM (see _fillCircleDirect's
        // fallback note — device coords on the default path apply the CTM
        // twice). stroke(path) widens at this._lineWidth in user space and the
        // CTM scales it, so the device-space `lineWidth` param is unused here.
        Context2D._markPathBasedRendering();
        const fallbackPath = new SWPath2D();
        fallbackPath.arc(userX, userY, userRadius, 0, TAU);
        this.stroke(fallbackPath);
    }

    /**
     * Optimized line stroke
     * @private
     * @param {number} x1 - Device-space start x (CTM pre-applied by the caller)
     * @param {number} y1 - Device-space start y
     * @param {number} x2 - Device-space end x
     * @param {number} y2 - Device-space end y
     * @param {number} lineWidth - Device-space line width (geometric-mean scale pre-applied)
     * @param {Object} paintSource - Stroke paint (Color, gradient, or pattern)
     * @param {number} ux1 - User-space start x, for the generic fallback
     * @param {number} uy1 - User-space start y, for the generic fallback
     * @param {number} ux2 - User-space end x, for the generic fallback
     * @param {number} uy2 - User-space end y, for the generic fallback
     */
    _strokeLineDirect(x1, y1, x2, y2, ox, oy, lineWidth, paintSource, ux1, uy1, ux2, uy2) {
        // Direct rendering only supports butt line caps (open shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        // HAIRLINE (sub-pixel) stroke — see the class-level note at the top of
        // this file. lineWidth here is already in device units. LineOps' thin
        // branches (both of them) rasterize the same Bresenham line and ignore
        // the width below THIN_LINE_THRESHOLD, so the rule needs no geometry
        // change here at all: it is exactly "take the ALPHA thin branch, at the
        // multiplied alpha" — the same pixels, at the right weight. Until now a
        // hairline drew a FULL-opacity 1px line, the one entry with no faint
        // rule anywhere in its history.
        // It is gated on everything the alpha thin branch needs, so that a
        // gradient hairline still reaches the fallback at its TRUE width.
        const isHairlineStroke =
            paintSource instanceof Color &&
            this.globalCompositeOperation === 'source-over' &&
            isButtCap &&
            lineWidth > 0 &&
            lineWidth < 1 &&
            Math.abs(lineWidth - 1) >= STROKE_1PX_TOLERANCE; // i.e. not the exact-1px case

        // Get color for solid color direct rendering. _noShadow in both
        // eligibility flags: LineOps cannot draw a ctx shadow - an active
        // shadow makes stroke_Any decline and routes to the generic fallback
        // below (see _fillCircleDirect).
        const isOpaqueColor =
            paintSource instanceof Color &&
            paintSource.a === 255 &&
            this.globalAlpha >= 1.0 &&
            this.globalCompositeOperation === 'source-over' &&
            this._noShadow &&
            this._lineDash.length === 0 &&
            isButtCap &&
            !isHairlineStroke;

        // Check for semitransparent color direct rendering (Color with alpha blending)
        const isSemiTransparentColor =
            paintSource instanceof Color &&
            !isOpaqueColor &&
            this.globalCompositeOperation === 'source-over' &&
            this._noShadow &&
            this._lineDash.length === 0 &&
            isButtCap;

        // LineOps takes no clip rect (unlike CircleOps): LineOps.stroke_Any
        // decides thin-vs-thick INSIDE the dispatcher, and its thick
        // non-axis-aligned branch delegates to QuadScanOps, which has no clipRect
        // concept — a partial wiring would silently drop the clip on that branch
        // (the exact bug class 6b20dcc fixed in the roundRect fallbacks). So it
        // gets the combined mask (mask ∧ rect); wire the rect into LineOps and
        // QuadScanOps together, when a hot clipped caller appears. stroke_Any declines
        // (draws nothing, reads no clip) unless one of the two flags is set, so
        // the combined mask is only fetched for a draw that can use it.
        const clipBuffer = isOpaqueColor || isSemiTransparentColor ? this._combinedClipBuffer() : null;

        // Try direct rendering via LineOps. ⚠ `lineWidth` itself must stay
        // untouched — the gradient/pattern fallback below strokes at it.
        const directRenderingUsed = LineOps.stroke_Any(
            this.surface,
            x1,
            y1,
            x2,
            y2,
            isHairlineStroke ? 1 : lineWidth,
            paintSource,
            isHairlineStroke ? this.globalAlpha * lineWidth : this.globalAlpha,
            clipBuffer,
            isOpaqueColor,
            isSemiTransparentColor,
            ox,
            oy
        );

        if (!directRenderingUsed) {
            // Non-Color paints (gradients, patterns), round/square caps,
            // non-source-over, active shadows: generic pipeline via an un-baked USER-space
            // external path under the live CTM (see _fillCircleDirect's
            // fallback note). stroke(path) widens at this._lineWidth in user
            // space and the CTM scales it — under a non-uniform CTM that gives
            // the HTML5-correct direction-dependent width, where the direct
            // path above accepts the geometric-mean approximation.
            Context2D._markPathBasedRendering();
            const fallbackPath = new SWPath2D();
            fallbackPath.moveTo(ux1, uy1);
            fallbackPath.lineTo(ux2, uy2);
            this.stroke(fallbackPath);
        }
    }
}

/**
 * STENCIL-BASED CLIPPING SYSTEM
 *
 * SWCanvas uses a 1-bit stencil buffer approach for memory-efficient clipping with
 * proper intersection semantics. This system matches HTML5 Canvas behavior exactly.
 *
 * Memory Layout:
 * - Each pixel is represented by 1 bit (1 = visible, 0 = clipped)
 * - Bits are packed into Uint8Array (8 pixels per byte)
 * - Memory usage: width × height ÷ 8 bytes (96.9% reduction vs RGBA coverage)
 * - Lazy allocation: only created when first clip() operation is performed
 *
 * Clipping Operations:
 * 1. First clip: Creates stencil buffer, renders clip path with 1s where path covers
 * 2. Subsequent clips: Renders to temp buffer, ANDs with existing stencil buffer
 * 3. Intersection semantics: Only pixels covered by ALL clips have bit = 1
 * 4. Save/restore: Stencil buffer is deep-copied during save() and restored
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

    // Test-only escape hatch: when true, clip() always builds the legacy bitmask
    // and never takes the tier-0 rect fast path. Lets a harness render the same
    // scene both ways and assert the tier-0 path is byte-identical. Never set in
    // production. (See plans/clipping-optimization.md §9 Stage 2.)
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
        this.globalAlpha = 1.0;
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

        // Internal path and clipping. The current default path holds DEVICE-space
        // geometry (the CTM is baked at build time); see the path methods below.
        this._currentPath = new SWPath2D();
        this._devCurrent = null; // current point (device space); null = no open subpath
        this._devSubStart = null; // current subpath start (device space)

        // Stencil-based clipping system (only clipping mechanism)
        this._clipMask = null; // ClipMask instance for 1-bit per pixel clipping

        // Tier-0 rectangular-clip fast path (see plans/clipping-optimization.md §5).
        // When the effective clip region is exactly an axis-aligned rectangle we
        // track it analytically and skip the per-pixel bitmask entirely.
        //   _clipRect  : { x0, y0, x1, y1 } device-space integer coords, half-open
        //                [x0, x1) × [y0, y1), clamped to the surface; null = untracked.
        //   _clipIsRect: true  ⇔ _clipRect describes the ENTIRE clip exactly
        //                        (the bitmask need not be consulted).
        //                false ⇔ non-rect clip in effect (bitmask is authoritative).
        // NOTE (Stage 1): these are bookkeeping only — _clipMask remains the sole
        // clip mechanism consulted by the renderers until Stage 2 wires them up.
        this._clipRect = null;
        this._clipIsRect = false;

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

    // HTML5 Canvas-compatible globalCompositeOperation property with cached flag
    get globalCompositeOperation() {
        return this._globalCompositeOperation;
    }

    set globalCompositeOperation(value) {
        this._globalCompositeOperation = value;
        this._isSourceOver = value === 'source-over';
    }

    /**
     * Update cached shadow flag based on current shadow properties
     * @private
     */
    _updateNoShadowFlag() {
        this._noShadow =
            !this.shadowColor ||
            this.shadowColor === Color.transparent ||
            (this.shadowBlur === 0 && this.shadowOffsetX === 0 && this.shadowOffsetY === 0);
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
            clipMask: this._clipMask ? this._clipMask.clone() : null, // Deep copy of clip mask
            // Tier-0 rect state. _clipRect objects are immutable (replaced
            // wholesale, never mutated in place), so the reference is safe to
            // share across snapshots — no clone needed (Stage 3 will drop the
            // clipMask clone above for the tier-0 case).
            clipRect: this._clipRect,
            clipIsRect: this._clipIsRect,
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
        this.globalAlpha = snapshot.globalAlpha;
        // Use backing field directly to avoid setter overhead (flags are saved separately)
        this._globalCompositeOperation = snapshot.globalCompositeOperation;
        this._transform = snapshot.transform;
        this._fillStyle = snapshot.fillStyle;
        this._strokeStyle = snapshot.strokeStyle;

        // Restore clipMask (may be null)
        this._clipMask = snapshot.clipMask;

        // Restore tier-0 rect state (older snapshots predating this field restore
        // to the no-tier-0 default).
        this._clipRect = snapshot.clipRect !== undefined ? snapshot.clipRect : null;
        this._clipIsRect = snapshot.clipIsRect !== undefined ? snapshot.clipIsRect : false;

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
        let segments = Math.max(1, Math.ceil(totalAngle / maxAngleStep));
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
        const minSegments = Math.ceil((totalAngle / (Math.PI / 2)) * 16); // 16 per 90°
        return Math.max(toleranceSegments, minSegments);
    }

    // Drawing methods - rectangle operations
    fillRect(x, y, width, height) {
        // Direct rendering: Color fill with source-over, no shadows (clipping supported)
        if (this._canUseDirectRendering(this._fillStyle)) {
            const t = this._transform;
            // Tier-0 rect clip → clamp draw extent + pass clipBuffer=null on the
            // axis-aligned path. The rotated RectOpsRot branch isn't tier-0-wired,
            // so it materialises the bitmask on demand (_ensureClipBuffer) — under
            // the mask-skip, clip() no longer builds a mask for a rect clip. Within
            // this branch _isSourceOver && _noShadow hold, so _tier0ClipRect()
            // reduces to (_clipIsRect ? _clipRect : null).
            const tier0ClipRect = this._tier0ClipRect();
            const clip = tier0ClipRect ? null : this._ensureClipBuffer();

            // Fast access to pre-computed transform values (no getters, no sqrt/atan2)
            const scaledW = width * t.scaleX;
            const scaledH = height * t.scaleY;
            const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });

            // Inline opacity check
            const isOpaque = this._fillStyle.a === 255 && this.globalAlpha >= 1.0;

            if (t.isAxisAligned) {
                // Inline dimension swapping - no RectOpsAA.getRotatedDimensions() call needed
                const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                const tlX = center.x - finalW / 2;
                const tlY = center.y - finalH / 2;

                if (isOpaque) {
                    RectOpsAA.fill_AA_Opaq(
                        this.surface,
                        tlX,
                        tlY,
                        finalW,
                        finalH,
                        this._fillStyle,
                        clip,
                        tier0ClipRect
                    );
                    return;
                } else {
                    RectOpsAA.fill_AA_Alpha(
                        this.surface,
                        tlX,
                        tlY,
                        finalW,
                        finalH,
                        this._fillStyle,
                        this.globalAlpha,
                        clip,
                        tier0ClipRect
                    );
                    return;
                }
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use edge-function algorithm.
                // Not tier-0-wired (Fizzygum never clips a rotated draw); materialise
                // the bitmask on demand for a rect clip.
                const rotClip = this._ensureClipBuffer();
                if (isOpaque) {
                    RectOpsRot.fill_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        t.rotationAngle,
                        this._fillStyle,
                        1.0,
                        rotClip
                    );
                    return;
                } else {
                    RectOpsRot.fill_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        t.rotationAngle,
                        this._fillStyle,
                        this.globalAlpha,
                        rotClip
                    );
                    return;
                }
            }
            // Non-uniform scale + rotation: fall through to path-based rendering (produces parallelogram)
        }

        // Path-based rendering: gradients, patterns, non-source-over, shadows, clipping
        Context2D._markPathBasedRendering();
        const tier0ClipRect = this._tier0ClipRect();
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: tier0ClipRect ? null : this._ensureClipMask(),
            clipRect: tier0ClipRect,
            fillStyle: this._fillStyle,
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.fillRect(x, y, width, height, this._fillStyle);
        this.rasterizer.endOp();
    }

    strokeRect(x, y, width, height) {
        // Direct rendering: Color stroke with source-over, no shadows (clipping supported)
        if (this._canUseDirectRendering(this._strokeStyle)) {
            const t = this._transform;
            // Tier-0 rect clip → clamp extent + clipBuffer=null on the axis-aligned
            // path; the rotated RectOpsRot branch materialises the bitmask on demand
            // (see fillRect for the rationale). Within this branch _tier0ClipRect() =
            // _clipIsRect ? _clipRect : null.
            const tier0ClipRect = this._tier0ClipRect();
            const clip = tier0ClipRect ? null : this._ensureClipBuffer();

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
                            tier0ClipRect
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
                            tier0ClipRect
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
                            tier0ClipRect
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
                            tier0ClipRect
                        );
                        return;
                    }
                }
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use line-based stroke. Not tier-0-wired;
                // materialises the bitmask on demand for a rect clip.
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
                    this._ensureClipBuffer()
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
        const tier0ClipRect = this._tier0ClipRect();
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: tier0ClipRect ? null : this._ensureClipMask(),
            clipRect: tier0ClipRect,
            strokeStyle: this._strokeStyle,
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
            miterLimit: this.miterLimit
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

        // Direct rendering: both fill and stroke are solid colors, source-over, no shadows
        if (this._canUseDirectRenderingForFillStroke(this._fillStyle, this._strokeStyle)) {
            const t = this._transform;
            const clip = this._ensureClipBuffer();

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

        // clearRect honours the clip; under the tier-0 mask-skip a rect clip keeps
        // no bitmask, so materialise it on demand for the per-pixel test below.
        const clipMask = this._ensureClipMask();

        // Handle simple axis-aligned case (no rotation/skew)
        if (transform.b === 0 && transform.c === 0) {
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
            // This is more complex but handles all transformation cases correctly
            const invTransform = transform.invert();

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
     * @param {number|number[]} radii - Corner radius (single value or array)
     */
    strokeRoundRect(x, y, width, height, radii) {
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

        // Normalize radius to check for zero
        const radius = Array.isArray(radii) ? radii[0] : radii || 0;

        // Fallback to strokeRect for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            this.strokeRect(x, y, width, height);
            return;
        }

        // Direct rendering: Color stroke with source-over, no shadows
        if (this._canUseDirectRendering(this._strokeStyle)) {
            const t = this._transform;
            // Tier-0 rect clip → clamp extent + clipBuffer=null on the axis-aligned
            // paths; the rotated branch materialises the bitmask on demand (see
            // fillRect for the rationale).
            const tier0ClipRect = this._tier0ClipRect();
            const clip = tier0ClipRect ? null : this._ensureClipBuffer();

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);
                const scaledRadius = radius * t.scaleX;
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
                                radii,
                                this._strokeStyle,
                                clip,
                                tier0ClipRect
                            );
                        } else {
                            RoundedRectOpsAA.stroke1px_AA_Alpha(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                radii,
                                this._strokeStyle,
                                strokeAlpha,
                                clip,
                                tier0ClipRect
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
                                radii,
                                this._lineWidth,
                                this._strokeStyle,
                                clip,
                                tier0ClipRect
                            );
                        } else {
                            RoundedRectOpsAA.strokeThick_AA_Alpha(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                radii,
                                this._lineWidth,
                                this._strokeStyle,
                                this.globalAlpha,
                                clip,
                                tier0ClipRect
                            );
                        }
                    }
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping
                    const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                    const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                    const tlX = center.x - finalW / 2;
                    const tlY = center.y - finalH / 2;

                    if (is1pxStroke || isHairlineStroke) {
                        if (isOpaque && !isHairlineStroke) {
                            RoundedRectOpsAA.stroke1px_AA_Opaq(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                scaledRadius,
                                this._strokeStyle,
                                clip,
                                tier0ClipRect
                            );
                        } else {
                            RoundedRectOpsAA.stroke1px_AA_Alpha(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                scaledRadius,
                                this._strokeStyle,
                                strokeAlpha,
                                clip,
                                tier0ClipRect
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
                                scaledRadius,
                                scaledLineWidth,
                                this._strokeStyle,
                                clip,
                                tier0ClipRect
                            );
                        } else {
                            RoundedRectOpsAA.strokeThick_AA_Alpha(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                scaledRadius,
                                scaledLineWidth,
                                this._strokeStyle,
                                this.globalAlpha,
                                clip,
                                tier0ClipRect
                            );
                        }
                    }
                    return;
                } else {
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
                        scaledRadius,
                        t.rotationAngle,
                        scaledLineWidth,
                        this._strokeStyle,
                        strokeAlpha,
                        this._ensureClipBuffer()
                    );
                    return;
                }
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: build an un-baked, user-space path and stroke it as
        // an external Path2D so it draws under the current CTM. (The current default
        // path bakes the CTM at build time — the wrong coordinate space here.)
        const fallbackPath = new SWPath2D();
        fallbackPath.roundRect(x, y, width, height, radii);
        this.stroke(fallbackPath);
    }

    /**
     * Fill a rounded rectangle.
     * Uses direct rendering when possible (solid color, source-over, no shadow, uniform scale).
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     */
    fillRoundRect(x, y, width, height, radii) {
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

        // Normalize radius to check for zero
        const radius = Array.isArray(radii) ? radii[0] : radii || 0;

        // Fallback to fillRect for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            this.fillRect(x, y, width, height);
            return;
        }

        // Direct rendering: Color fill with source-over, no shadows
        if (this._canUseDirectRendering(this._fillStyle)) {
            const t = this._transform;
            // Tier-0 rect clip → clamp extent + clipBuffer=null on the axis-aligned
            // paths; the rotated branch materialises the bitmask on demand (see
            // fillRect for the rationale).
            const tier0ClipRect = this._tier0ClipRect();
            const clip = tier0ClipRect ? null : this._ensureClipBuffer();

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledRadius = radius * t.scaleX;
                const isOpaque = this._fillStyle.a === 255 && this.globalAlpha >= 1.0;

                if (t.isIdentity) {
                    // No transform: use axis-aligned methods with original coordinates
                    if (isOpaque) {
                        RoundedRectOpsAA.fill_AA_Opaq(
                            this.surface,
                            x,
                            y,
                            width,
                            height,
                            radii,
                            this._fillStyle,
                            clip,
                            tier0ClipRect
                        );
                    } else {
                        RoundedRectOpsAA.fill_AA_Alpha(
                            this.surface,
                            x,
                            y,
                            width,
                            height,
                            radii,
                            this._fillStyle,
                            this.globalAlpha,
                            clip,
                            tier0ClipRect
                        );
                    }
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping
                    const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                    const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                    const tlX = center.x - finalW / 2;
                    const tlY = center.y - finalH / 2;

                    if (isOpaque) {
                        RoundedRectOpsAA.fill_AA_Opaq(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            scaledRadius,
                            this._fillStyle,
                            clip,
                            tier0ClipRect
                        );
                    } else {
                        RoundedRectOpsAA.fill_AA_Alpha(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            scaledRadius,
                            this._fillStyle,
                            this.globalAlpha,
                            clip,
                            tier0ClipRect
                        );
                    }
                    return;
                } else {
                    // Rotated with uniform scale: use fillRotated
                    RoundedRectOpsRot.fill_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        scaledRadius,
                        t.rotationAngle,
                        this._fillStyle,
                        this.globalAlpha,
                        this._ensureClipBuffer()
                    );
                    return;
                }
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: build an un-baked, user-space path and fill it as an
        // external Path2D so it draws under the current CTM. (The current default
        // path bakes the CTM at build time — the wrong coordinate space here.)
        const fallbackPath = new SWPath2D();
        fallbackPath.roundRect(x, y, width, height, radii);
        this.fill(fallbackPath);
    }

    /**
     * Fill and stroke a rounded rectangle in a single unified operation.
     * Uses unified direct rendering to prevent fill/stroke boundary speckles.
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     */
    fillStrokeRoundRect(x, y, width, height, radii) {
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

        // Normalize radius to check for zero
        const radius = Array.isArray(radii) ? radii[0] : radii || 0;

        // Fallback to fillStrokeRect for zero radius
        if (radius <= 0) {
            this.fillStrokeRect(x, y, width, height);
            return;
        }

        // Direct rendering: both fill and stroke are solid colors, source-over, no shadows
        if (this._canUseDirectRenderingForFillStroke(this._fillStyle, this._strokeStyle)) {
            const t = this._transform;
            // Tier-0 rect clip → clamp extent + clipBuffer=null on the axis-aligned
            // paths; the rotated branch materialises the bitmask on demand (see
            // fillRect for the rationale).
            const tier0ClipRect = this._tier0ClipRect();
            const clip = tier0ClipRect ? null : this._ensureClipBuffer();

            const hasFill = this._fillStyle.a > 0;
            const hasStroke = this._strokeStyle.a > 0 && this._lineWidth > 0;

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);
                const scaledRadius = radius * t.scaleX;

                if (t.isIdentity) {
                    // Axis-aligned, no transform: use top-left coordinates
                    RoundedRectOpsAA.fillStroke_AA_Any(
                        this.surface,
                        x,
                        y,
                        width,
                        height,
                        radii,
                        this._lineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        clip,
                        tier0ClipRect
                    );
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping
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
                        scaledRadius,
                        scaledLineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        clip,
                        tier0ClipRect
                    );
                    return;
                } else {
                    // Rotated with uniform scale: use rotated fill+stroke
                    RoundedRectOpsRot.fillStroke_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        scaledRadius,
                        t.rotationAngle,
                        scaledLineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        this._ensureClipBuffer()
                    );
                    return;
                }
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
     * a circle). Crisp contract: at integer geometry the fill covers EXACTLY
     * the [x, x+w) × [y, y+h) pixel box, with caps byte-identical to
     * fillCircle's (tests/core/053).
     *
     * Uses direct rendering when possible (solid color, source-over, no
     * shadow, uniform scale). There are deliberately NO stroke variants —
     * capability lands with callers, and the one consumer only fills.
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

        // Direct rendering: Color fill with source-over, no shadows
        if (this._canUseDirectRendering(this._fillStyle)) {
            const t = this._transform;
            // Tier-0 rect clip → clamp extent + clipBuffer=null on the
            // axis-aligned paths; the rotated branch materialises the bitmask
            // on demand (see fillRect for the rationale).
            const tier0ClipRect = this._tier0ClipRect();
            const clip = tier0ClipRect ? null : this._ensureClipBuffer();

            // Stadiums require uniform scale (non-uniform would make an
            // ellipse-capped shape the caps cannot represent)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const isOpaque = this._fillStyle.a === 255 && this.globalAlpha >= 1.0;

                if (t.isIdentity) {
                    // No transform: use original coordinates
                    if (isOpaque) {
                        StadiumOps.fill_Opaq(this.surface, x, y, width, height, this._fillStyle, clip, tier0ClipRect);
                    } else {
                        StadiumOps.fill_Alpha(
                            this.surface,
                            x,
                            y,
                            width,
                            height,
                            this._fillStyle,
                            this.globalAlpha,
                            clip,
                            tier0ClipRect
                        );
                    }
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping — a 90°-rotated stadium is
                    // still a stadium with w/h exchanged.
                    const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                    const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                    const tlX = center.x - finalW / 2;
                    const tlY = center.y - finalH / 2;

                    if (isOpaque) {
                        StadiumOps.fill_Opaq(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            this._fillStyle,
                            clip,
                            tier0ClipRect
                        );
                    } else {
                        StadiumOps.fill_Alpha(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            this._fillStyle,
                            this.globalAlpha,
                            clip,
                            tier0ClipRect
                        );
                    }
                    return;
                } else {
                    // Rotated with uniform scale: a stadium IS a rounded rect
                    // at the degenerate radius, and under rotation there is no
                    // exact-column crisp contract for the AA-free edge pixels
                    // to violate, so delegate to the rotated rounded-rect
                    // renderer with r = min(w,h)/2.
                    RoundedRectOpsRot.fill_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        Math.min(scaledW, scaledH) / 2,
                        t.rotationAngle,
                        this._fillStyle,
                        this.globalAlpha,
                        this._ensureClipBuffer()
                    );
                    return;
                }
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: an un-baked, user-space rounded-rect path at
        // the degenerate radius (the generic pipeline samples pixel centers,
        // so ITS degenerate-radius output is a correct stadium), drawn as an
        // external Path2D under the current CTM.
        const fallbackPath = new SWPath2D();
        fallbackPath.roundRect(x, y, width, height, Math.min(width, height) / 2);
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
        let pathToFill, fillRule;

        // Handle different argument combinations:
        // fill() -> path = undefined, rule = undefined
        // fill('evenodd') -> path = 'evenodd', rule = undefined
        // fill(path2d) -> path = path2d object, rule = undefined
        // fill(path2d, 'evenodd') -> path = path2d object, rule = 'evenodd'

        if (arguments.length === 0) {
            // fill() - use current path, nonzero rule
            pathToFill = this._currentPath;
            fillRule = 'nonzero';
        } else if (arguments.length === 1) {
            if (typeof path === 'string') {
                // fill('evenodd') - use current path, specified rule
                pathToFill = this._currentPath;
                fillRule = path;
            } else {
                // fill(path2d) - use specified path, nonzero rule
                pathToFill = path;
                fillRule = 'nonzero';
            }
        } else {
            // fill(path2d, 'evenodd') - use specified path and rule
            pathToFill = path;
            fillRule = rule;
        }

        fillRule = fillRule || 'nonzero';

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

        const tier0ClipRect = this._tier0ClipRect();
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: opTransform,
            clipMask: tier0ClipRect ? null : this._ensureClipMask(),
            clipRect: tier0ClipRect,
            fillStyle: this._fillStyle,
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

        const tier0ClipRect = this._tier0ClipRect();
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: opTransform,
            clipMask: tier0ClipRect ? null : this._ensureClipMask(),
            clipRect: tier0ClipRect,
            strokeStyle: this._strokeStyle,
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
            if (typeof arguments[2] === 'string') {
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

        let testPolygons;
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
            const strokePolygons = StrokeGenerator.generateStrokePolygons(
                this._transformPathPoints(path, inv),
                strokeProps
            );
            if (strokePolygons.length === 0) {
                return false;
            }
            testPolygons = strokePolygons.map(poly => poly.map(point => drawT.transformPoint(point)));
        } else {
            // External user-space path: stroke, then map by the current CTM.
            const strokePolygons = StrokeGenerator.generateStrokePolygons(path, strokeProps);
            if (strokePolygons.length === 0) {
                return false;
            }
            testPolygons = strokePolygons.map(poly => poly.map(point => this._transform.transformPoint(point)));
        }

        // Test point against the stroke polygons using nonzero winding rule
        // (stroke hit testing doesn't use fill rules like path filling does).
        return PolygonFiller.isPointInPolygons(x, y, testPolygons, 'nonzero');
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
     * The tier-0 clip rect to hand a renderer for the CURRENT draw, or null if
     * the draw must use the bitmask (_clipMask) instead.
     *
     * Tier-0 (clamp draw extent to the rect + pass clipBuffer=null) is byte-
     * identical to the bitmask ONLY when the clip's sole effect is to restrict
     * which pixels are written. That holds for source-over (and the other
     * per-pixel Porter-Duff ops that touch only source-covered pixels) with no
     * shadow. It does NOT hold for:
     *   - canvas-wide composite ops (copy / destination-atop / source-in /
     *     source-out / destination-in): these also CLEAR pixels the source
     *     doesn't cover, so the clip must confine that erase — a real mask.
     *   - shadows: the blurred shadow spreads beyond the shape and must be
     *     clipped too; the mask handles that uniformly.
     * We gate on the cached _isSourceOver (⊂ non-canvas-wide) + _noShadow, which
     * is conservative, correct, and covers 100% of Fizzygum's clipped traffic.
     * Evaluated per-draw because composite/shadow can change after clip().
     * @private
     */
    _tier0ClipRect() {
        return this._clipIsRect && this._isSourceOver && this._noShadow ? this._clipRect : null;
    }

    /**
     * Build a ClipMask whose visible pixels are EXACTLY the half-open rect
     * [x0,x1) × [y0,y1). Because `_clipRect` is defined as the exact pixel set
     * `fillPolygonsToClipMask` would expose for that rect, this reproduces the
     * bitmask a rect `clip()` would have built — byte-for-byte. Used only to
     * lazily materialise a tier-0 rect for a draw path that still reads the
     * bitmask (see `_ensureClipMask`).
     * @private
     */
    static _rectToClipMask(rect, width, height) {
        const mask = new ClipMask(width, height);
        mask.clipAll();
        for (let y = rect.y0; y < rect.y1; y++) {
            for (let x = rect.x0; x < rect.x1; x++) {
                mask.setPixel(x, y, true);
            }
        }
        return mask;
    }

    /**
     * Return the ClipMask for a draw that CANNOT take the tier-0 rect fast path
     * (rotated/rounded/circle/arc primitives, canvas-wide composite ops, shadows,
     * or a bitmask clip), materialising it on demand. Under the tier-0 mask-skip,
     * a rect `clip()` keeps `_clipRect` but leaves `_clipMask` null; the first
     * such draw builds the mask from the rect here. Wired tier-0 draws never call
     * this (they consult `_tier0ClipRect()` and pass `clipBuffer=null`), so the
     * all-tier-0 Fizzygum workload never allocates a mask. Returns null when
     * there is no clip at all.
     * @private
     */
    _ensureClipMask() {
        if (this._clipMask === null && this._clipRect !== null) {
            this._clipMask = Context2D._rectToClipMask(this._clipRect, this.surface.width, this.surface.height);
        }
        return this._clipMask;
    }

    /**
     * As `_ensureClipMask`, but returns the raw clip buffer (or null) for the
     * renderers that take a `Uint8Array` clip argument.
     * @private
     */
    _ensureClipBuffer() {
        const mask = this._ensureClipMask();
        return mask ? mask.buffer : null;
    }

    /**
     * Tier-0 clip detection: does this flattened path collapse to a single
     * axis-aligned rectangle in device space? If so, return the exact set of
     * pixels the bitmask path WOULD expose, as a half-open integer rect
     * { x0, y0, x1, y1 } clamped to the surface. Otherwise return null.
     *
     * BYTE-IDENTICAL CONTRACT — the returned rect must expose EXACTLY the pixels
     * that PolygonFiller.fillPolygonsToClipMask would set for this path, so a
     * downstream tier-0 draw is pixel-identical to a bitmask-clipped draw:
     *   - X (per _fillClipMaskSpans): a span [left, right) sets columns
     *     [ceil(left − 0.5), ceil(right − 0.5)).
     *   - Y (per _findPolygonIntersections' half-open `y >= minY && y < maxY`
     *     edge test sampled at y+0.5): rows [ceil(top − 0.5), ceil(bottom − 0.5)).
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
        // bowtie — all conservatively rejected to the bitmask path (their fill
        // region is not their bounding box, so tier-0 would not be byte-identical).
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
     * Enhanced clipping support with stencil buffer intersection
     *
     * Implements HTML5 Canvas-compatible clipping with proper intersection semantics.
     * Each clip() operation creates a new clip region that intersects with any existing
     * clipping regions.
     *
     * @param {Path2D} path - Optional path to clip with (uses current path if not provided)
     * @param {string} rule - Fill rule: 'nonzero' (default) or 'evenodd'
     */
    clip(path, rule) {
        // If no path provided, use the current default path.
        const pathToClip = path || this._currentPath;
        const clipRule = rule || 'nonzero';

        // The current default path already holds device-space geometry → flatten
        // under IDENTITY. An external Path2D is transform-independent → flatten
        // under the current CTM.
        const opTransform = pathToClip === this._currentPath ? Transform2D.IDENTITY : this._transform;

        // Flatten path.
        const polygons = PathFlattener.flattenPath(pathToClip);

        // Tier-0 detection — evaluated BEFORE we mutate the clip state below, since
        // it depends on whether the PRIOR clip was itself a pure rect.
        const detectedRect = Context2D._detectAxisAlignedRect(
            polygons,
            opTransform,
            this.surface.width,
            this.surface.height
        );
        const priorWasPureRectOrEmpty = (this._clipMask === null && this._clipRect === null) || this._clipIsRect;

        if (detectedRect && priorWasPureRectOrEmpty && !Context2D._disableTier0Clip) {
            // TIER-0: the composed clip is exactly an axis-aligned rect. Track it
            // and SKIP the bitmask build entirely — wired renderers consult
            // _clipRect and pass clipBuffer=null (byte-identical, since _clipRect
            // exposes exactly the pixels the mask would). Any draw that still needs
            // a real bitmask (rotated/rounded/circle/arc primitives, canvas-wide
            // composite ops, shadows) materialises it on demand via _ensureClipMask().
            // The prior clip was itself a pure rect (priorWasPureRectOrEmpty),
            // already captured in _clipRect, so no prior mask region is lost.
            this._clipRect = this._clipRect ? Context2D._intersectRect(this._clipRect, detectedRect) : detectedRect;
            this._clipIsRect = true;
            this._clipMask = null; // freed / never built — the allocation win
        } else {
            // BITMASK path. If the PRIOR clip was a tier-0 rect (mask skipped),
            // materialise it first so the intersection below preserves that region.
            this._ensureClipMask();

            const tempClipMask = new ClipMask(this.surface.width, this.surface.height);
            tempClipMask.clipAll(); // Start with all pixels clipped
            PolygonFiller.fillPolygonsToClipMask(tempClipMask, polygons, clipRule, opTransform);
            if (this._clipMask) {
                this._clipMask.intersectWith(tempClipMask); // AND with existing
            } else {
                this._clipMask = tempClipMask; // first clip
            }
            this._clipIsRect = false;
            this._clipRect = null; // bitmask authoritative; no bbox tracked
        }

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

        const tier0ClipRect = this._tier0ClipRect();

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
            // Tier-0 rect clip: hand the renderer the rect (it clamps its extent)
            // and null the mask; otherwise the bitmask path is unchanged. (Gated
            // to source-over + no-shadow — see _tier0ClipRect; here _noShadow is
            // still true, shadows are handled by the ShadowPipeline wrapper.)
            clipMask: tier0ClipRect ? null : this._ensureClipMask(),
            clipRect: tier0ClipRect,
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
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
        if (radius <= 0) return;

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

        // Use optimized circle renderer
        this._fillCircleDirect(center.x, center.y, scaledRadius, paintSource);
    }

    /**
     * Stroke a circle directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    strokeCircle(centerX, centerY, radius) {
        if (radius <= 0) return;

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

        // Use optimized circle stroke renderer
        this._strokeCircleDirect(center.x, center.y, scaledRadius, scaledLineWidth, paintSource);
    }

    /**
     * Fill and stroke a circle in one operation
     * Uses unified rendering when possible to prevent fill/stroke gaps.
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    fillStrokeCircle(centerX, centerY, radius) {
        if (radius <= 0) return;

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

        if (fillIsColor && strokeIsColor && isSourceOver && (hasFill || hasStroke)) {
            // Use unified method for coordinated fill+stroke rendering (no gaps).
            // Tier-0 rect clip → clamp extent + clipBuffer=null (see fillRect).
            const tier0ClipRect = this._tier0ClipRect();
            const clipBuffer = tier0ClipRect ? null : this._ensureClipBuffer();
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
                tier0ClipRect
            );
        } else {
            // Fallback to sequential rendering for gradients, patterns, or non-source-over
            this._fillCircleDirect(center.x, center.y, scaledRadius, fillPaintSource);
            this._strokeCircleDirect(center.x, center.y, scaledRadius, scaledLineWidth, strokePaintSource);
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
        if (radius <= 0) return;

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
        // Deliberately NOT tier-0-wired (unlike fillCircle/strokeCircle): ArcOps'
        // 1px-stroke writers bounds-check inside shared inline preprocessor
        // templates (SET_OPAQUE_ARC_FAST_CLIPPED / BLEND_ALPHA_ARC_FAST_CLIPPED)
        // and stroke1px_Opaq_Exact hoists its bounds check out of the loop, so a
        // clipRect there means changing codegen, not a mechanical clamp — and no
        // Fizzygum call site draws arcs directly today. A rect clip materialises
        // the bitmask here. Wire the whole ArcOps family together when a hot
        // clipped caller appears.
        const clipBuffer = this._ensureClipBuffer();

        // Check for direct rendering conditions
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';

        if (isColor && isSourceOver) {
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

        // Path-based rendering: use path system
        Context2D._markPathBasedRendering();
        this.beginPath();
        this.moveTo(center.x, center.y);
        this.arc(center.x, center.y, scaledRadius, startAngle, endAngle, anticlockwise);
        this.closePath();
        this.fill();
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
        if (radius <= 0) return;

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
        // Deliberately NOT tier-0-wired — see fillArc for the ArcOps-family reason.
        const clipBuffer = this._ensureClipBuffer();

        // Check for direct rendering conditions
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        // Direct rendering only supports butt line caps (open arc shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        if (isColor && isSourceOver && isButtCap) {
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

        // Path-based rendering: use path system (arc only, not pie slice)
        Context2D._markPathBasedRendering();
        this.beginPath();
        this.arc(center.x, center.y, scaledRadius, startAngle, endAngle, anticlockwise);
        this.stroke();
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
        if (radius <= 0) return;

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
        // Deliberately NOT tier-0-wired — see fillArc for the ArcOps-family reason.
        const clipBuffer = this._ensureClipBuffer();

        // Check for unified direct rendering
        const fillIsColor = fillPaintSource instanceof Color;
        const strokeIsColor = strokePaintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        const hasFill = fillIsColor && fillPaintSource.a > 0;
        const hasStroke = strokeIsColor && strokePaintSource.a > 0;
        // Direct rendering only supports butt line caps (open arc shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        if (fillIsColor && strokeIsColor && isSourceOver && isButtCap && (hasFill || hasStroke)) {
            // Use unified direct rendering
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
                clipBuffer
            );
            return;
        }

        // Path-based rendering: sequential rendering
        Context2D._markPathBasedRendering();

        // Fill pie slice
        if (hasFill) {
            this.beginPath();
            this.moveTo(center.x, center.y);
            this.arc(center.x, center.y, scaledRadius, startAngle, endAngle, anticlockwise);
            this.closePath();
            this.fill();
        }

        // Stroke outer arc only
        if (hasStroke) {
            this.beginPath();
            this.arc(center.x, center.y, scaledRadius, startAngle, endAngle, anticlockwise);
            this.stroke();
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
        // Deliberately NOT uniform-scale-gated (unlike the circle/arc entries):
        // the endpoints are transformed exactly, so the geometry is always
        // right — only the stroke WIDTH uses the geometric-mean uniform scale,
        // a direction-dependent approximation under non-uniform transforms.
        // No caller strokes lines under a non-uniform transform, and the
        // generic stroker makes lines cheap anyway; gate it if one appears.

        // Transform endpoints
        const start = this._transform.transformPoint({ x: x1, y: y1 });
        const end = this._transform.transformPoint({ x: x2, y: y2 });

        // Calculate effective line width
        const scale = this._transform.uniformScale;
        const scaledLineWidth = this._lineWidth * scale;

        // Get paint source
        const paintSource = this._strokeStyle;

        // Use optimized line renderer
        this._strokeLineDirect(start.x, start.y, end.x, end.y, scaledLineWidth, paintSource);
    }

    // ========================================================================
    // Private optimized shape renderers
    // ========================================================================

    /**
     * Optimized circle fill using midpoint algorithm with horizontal spans
     * @private
     */
    _fillCircleDirect(cx, cy, radius, paintSource) {
        const surface = this.surface;

        // Check for solid color direct rendering
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';

        const isOpaqueColor = isColor && paintSource.a === 255 && this.globalAlpha >= 1.0 && isSourceOver;

        const isSemiTransparentColor = isColor && paintSource.a < 255 && isSourceOver;

        if (isOpaqueColor || isSemiTransparentColor) {
            // Tier-0 rect clip → clamp extent + clipBuffer=null (mirrors
            // fillRoundRect); the path fallback below consults the context's
            // own clip state, so nothing to forward there.
            const tier0ClipRect = this._tier0ClipRect();
            const clipBuffer = tier0ClipRect ? null : this._ensureClipBuffer();
            if (isOpaqueColor) {
                // Direct rendering 1: 32-bit packed writes for opaque colors
                CircleOps.fill_Opaq(surface, cx, cy, radius, paintSource, clipBuffer, tier0ClipRect);
            } else {
                // Direct rendering 2: Bresenham scanlines with per-pixel alpha blending
                CircleOps.fill_Alpha(surface, cx, cy, radius, paintSource, this.globalAlpha, clipBuffer, tier0ClipRect);
            }
        } else {
            // Path-based rendering: use path system for gradients/patterns/non-source-over compositing
            Context2D._markPathBasedRendering(); // Mark path-based rendering for testing
            this.beginPath();
            this.arc(cx, cy, radius, 0, TAU);
            // Temporarily set identity transform since we already transformed
            const savedTransform = this._transform;
            this._transform = Transform2D.IDENTITY;
            this.fill();
            this._transform = savedTransform;
        }
    }

    /**
     * Optimized circle stroke - dispatches to direct rendering when possible
     * @private
     */
    _strokeCircleDirect(cx, cy, radius, lineWidth, paintSource) {
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
        // Tier-0 rect clip → clamp extent + clipBuffer=null on the direct paths
        // (mirrors strokeRoundRect); the path fallback consults the context's
        // own clip state directly, so the pair below is simply unused there.
        const tier0ClipRect = this._tier0ClipRect();
        const clipBuffer = tier0ClipRect ? null : this._ensureClipBuffer();

        // Direct rendering 1: 1px strokes using Bresenham algorithm
        if (isColor && (is1pxStroke || isHairlineStroke) && isSourceOver) {
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0 && !isHairlineStroke;
            if (isOpaque) {
                CircleOps.stroke1px_Opaq(this.surface, cx, cy, radius, paintSource, clipBuffer, tier0ClipRect);
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
                    tier0ClipRect
                );
                return;
            }
        }

        // Direct rendering 2: Thick strokes using scanline annulus algorithm
        if (isColor && isSourceOver && lineWidth > 1 && paintSource.a > 0) {
            const isOpaqueThick = paintSource.a === 255 && this.globalAlpha >= 1.0;
            if (isOpaqueThick) {
                CircleOps.strokeThick_Opaq(
                    this.surface,
                    cx,
                    cy,
                    radius,
                    lineWidth,
                    paintSource,
                    clipBuffer,
                    tier0ClipRect
                );
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
                    tier0ClipRect
                );
            }
            return;
        }

        // Fallback to path system for gradients, patterns, or non-source-over compositing
        Context2D._markPathBasedRendering();
        this.beginPath();
        this.arc(cx, cy, radius, 0, TAU);
        const savedTransform = this._transform;
        this._transform = Transform2D.IDENTITY;
        const savedLineWidth = this._lineWidth;
        this._lineWidth = lineWidth;
        this.stroke();
        this._lineWidth = savedLineWidth;
        this._transform = savedTransform;
    }

    /**
     * Optimized line stroke
     * @private
     */
    _strokeLineDirect(x1, y1, x2, y2, lineWidth, paintSource) {
        // Deliberately NOT tier-0-wired (unlike fillCircle/strokeCircle):
        // LineOps.stroke_Any decides thin-vs-thick INSIDE the dispatcher, and its
        // thick non-axis-aligned branch delegates to QuadScanOps, which has no
        // clipRect concept — a partial wiring would silently drop the clip on
        // that branch (the exact bug class 6b20dcc fixed in the roundRect
        // fallbacks). A rect clip materialises the bitmask here. Wire LineOps +
        // QuadScanOps together when a hot clipped caller appears.
        const clipBuffer = this._ensureClipBuffer();

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

        // Get color for solid color direct rendering
        const isOpaqueColor =
            paintSource instanceof Color &&
            paintSource.a === 255 &&
            this.globalAlpha >= 1.0 &&
            this.globalCompositeOperation === 'source-over' &&
            isButtCap &&
            !isHairlineStroke;

        // Check for semitransparent color direct rendering (Color with alpha blending)
        const isSemiTransparentColor =
            paintSource instanceof Color &&
            !isOpaqueColor &&
            this.globalCompositeOperation === 'source-over' &&
            isButtCap;

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
            isSemiTransparentColor
        );

        if (!directRenderingUsed) {
            // Path-based rendering for non-Color paint sources (gradients, patterns)
            Context2D._markPathBasedRendering();
            this.beginPath();
            this.moveTo(x1, y1);
            this.lineTo(x2, y2);
            const savedTransform = this._transform;
            this._transform = Transform2D.IDENTITY;
            const savedLineWidth = this._lineWidth;
            this._lineWidth = lineWidth;
            this.stroke();
            this._lineWidth = savedLineWidth;
            this._transform = savedTransform;
        }
    }
}

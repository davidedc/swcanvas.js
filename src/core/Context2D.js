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

class Context2D {
    // Static flag to track path-based rendering usage (for testing)
    // Reset before each test, check after to verify direct rendering was used
    static _pathBasedRenderingUsed = false;

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

        // Internal path and clipping
        this._currentPath = new SWPath2D();

        // Stencil-based clipping system (only clipping mechanism)
        this._clipMask = null; // ClipMask instance for 1-bit per pixel clipping

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

    // Path methods (delegated to internal path)
    beginPath() {
        this._currentPath = new SWPath2D();
    }

    closePath() {
        this._currentPath.closePath();
    }

    moveTo(x, y) {
        this._currentPath.moveTo(x, y);
    }

    lineTo(x, y) {
        this._currentPath.lineTo(x, y);
    }

    rect(x, y, w, h) {
        this._currentPath.rect(x, y, w, h);
    }

    arc(x, y, radius, startAngle, endAngle, counterclockwise) {
        this._currentPath.arc(x, y, radius, startAngle, endAngle, counterclockwise);
    }

    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
        this._currentPath.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise);
    }

    arcTo(x1, y1, x2, y2, radius) {
        this._currentPath.arcTo(x1, y1, x2, y2, radius);
    }

    quadraticCurveTo(cpx, cpy, x, y) {
        this._currentPath.quadraticCurveTo(cpx, cpy, x, y);
    }

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        this._currentPath.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }

    // Drawing methods - rectangle operations
    fillRect(x, y, width, height) {
        // Direct rendering: Color fill with source-over, no shadows (clipping supported)
        if (this._canUseDirectRendering(this._fillStyle)) {
            const t = this._transform;
            const clip = this._clipMask ? this._clipMask.buffer : null;

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
                    RectOpsAA.fill_AA_Opaq(this.surface, tlX, tlY, finalW, finalH, this._fillStyle, clip);
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
                        clip
                    );
                    return;
                }
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use edge-function algorithm
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
                        clip
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
                        clip
                    );
                    return;
                }
            }
            // Non-uniform scale + rotation: fall through to path-based rendering (produces parallelogram)
        }

        // Path-based rendering: gradients, patterns, non-source-over, shadows, clipping
        Context2D._markPathBasedRendering();
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMask,
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
            const clip = this._clipMask ? this._clipMask.buffer : null;

            // Fast access to pre-computed transform values
            const scaledW = width * t.scaleX;
            const scaledH = height * t.scaleY;
            const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
            const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);

            const isOpaque = this._strokeStyle.a === 255 && this.globalAlpha >= 1.0;

            if (t.isAxisAligned) {
                // Inline dimension swapping
                const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                const tlX = center.x - finalW / 2;
                const tlY = center.y - finalH / 2;

                const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;
                const isThickStroke = scaledLineWidth > 1;

                if (is1pxStroke) {
                    if (isOpaque) {
                        RectOpsAA.stroke1px_AA_Opaq(this.surface, tlX, tlY, finalW, finalH, this._strokeStyle, clip);
                        return;
                    } else {
                        RectOpsAA.stroke1px_AA_Alpha(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            this._strokeStyle,
                            this.globalAlpha,
                            clip
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
                            clip
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
                            clip
                        );
                        return;
                    }
                }
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use line-based stroke
                RectOpsRot.stroke_Rot_Any(
                    this.surface,
                    center.x,
                    center.y,
                    scaledW,
                    scaledH,
                    t.rotationAngle,
                    scaledLineWidth,
                    this._strokeStyle,
                    this.globalAlpha,
                    clip
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
            clipMask: this._clipMask,
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
            const clip = this._clipMask ? this._clipMask.buffer : null;

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
                    if (this._clipMask && this._clipMask.isPixelClipped(px, py)) {
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
                    if (this._clipMask && this._clipMask.isPixelClipped(px, py)) {
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
            const clip = this._clipMask ? this._clipMask.buffer : null;

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);
                const scaledRadius = radius * t.scaleX;
                const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;
                const isOpaque = this._strokeStyle.a === 255 && this.globalAlpha >= 1.0;

                if (t.isIdentity) {
                    // No transform: use axis-aligned methods with original coordinates
                    if (is1pxStroke) {
                        if (isOpaque) {
                            RoundedRectOpsAA.stroke1px_AA_Opaq(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                radii,
                                this._strokeStyle,
                                clip
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
                                this.globalAlpha,
                                clip
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
                                clip
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
                                clip
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

                    if (is1pxStroke) {
                        if (isOpaque) {
                            RoundedRectOpsAA.stroke1px_AA_Opaq(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                scaledRadius,
                                this._strokeStyle,
                                clip
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
                                this.globalAlpha,
                                clip
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
                                clip
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
                                clip
                            );
                        }
                    }
                    return;
                } else {
                    // Rotated with uniform scale: use strokeRotated
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
                        this.globalAlpha,
                        clip
                    );
                    return;
                }
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: use general path system
        Context2D._markPathBasedRendering();
        this.beginPath();
        this._currentPath.roundRect(x, y, width, height, radii);
        this.stroke();
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
            const clip = this._clipMask ? this._clipMask.buffer : null;

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
                        RoundedRectOpsAA.fill_AA_Opaq(this.surface, x, y, width, height, radii, this._fillStyle, clip);
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
                            clip
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
                            clip
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
                            clip
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
                        clip
                    );
                    return;
                }
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: use general path system
        Context2D._markPathBasedRendering();
        this.beginPath();
        this._currentPath.roundRect(x, y, width, height, radii);
        this.fill();
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
            const clip = this._clipMask ? this._clipMask.buffer : null;

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
                        clip
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
                        clip
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
                        clip
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

    // M2: Path drawing methods
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

        // Mark path-based rendering for testing (fill() has no direct rendering currently)
        Context2D._markPathBasedRendering();

        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMask,
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
        // Use specified path or current internal path
        const pathToStroke = path || this._currentPath;

        // All path-based strokes use generic pipeline
        // Direct rendering available via dedicated methods: strokeCircle(), strokeRect(), etc.
        Context2D._markPathBasedRendering();

        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMask,
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

        // Note: isPointInPath uses untransformed coordinates per HTML5 Canvas spec
        // The point coordinates are in canvas coordinate space, not transform-adjusted space

        // Flatten the path to polygons
        const polygons = PathFlattener.flattenPath(path);

        if (polygons.length === 0) {
            return false;
        }

        // Transform polygons to match current canvas transform
        const transformedPolygons = polygons.map(poly => poly.map(point => this._transform.transformPoint(point)));

        // Test point against transformed polygons
        return PolygonFiller.isPointInPolygons(x, y, transformedPolygons, fillRule);
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

        // Note: isPointInStroke uses untransformed coordinates per HTML5 Canvas spec
        // The point coordinates are in canvas coordinate space, not transform-adjusted space

        // Create stroke properties object from current context state
        const strokeProps = {
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit,
            lineDash: this._lineDash,
            lineDashOffset: this._lineDashOffset
        };

        // Generate stroke polygons using StrokeGenerator
        const strokePolygons = StrokeGenerator.generateStrokePolygons(path, strokeProps);

        if (strokePolygons.length === 0) {
            return false;
        }

        // Transform stroke polygons to match current canvas transform
        const transformedPolygons = strokePolygons.map(poly =>
            poly.map(point => this._transform.transformPoint(point))
        );

        // Test point against transformed stroke polygons using nonzero winding rule
        // (stroke hit testing doesn't use fill rules like path filling does)
        return PolygonFiller.isPointInPolygons(x, y, transformedPolygons, 'nonzero');
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
        // If no path provided, use current internal path
        const pathToClip = path || this._currentPath;
        const clipRule = rule || 'nonzero';

        // Create temporary clip mask to render this clip path
        const tempClipMask = new ClipMask(this.surface.width, this.surface.height);
        tempClipMask.clipAll(); // Start with all pixels clipped

        // Flatten path and fill to temporary clip buffer
        const polygons = PathFlattener.flattenPath(pathToClip);

        // Delegate to PolygonFiller for scanline rendering
        PolygonFiller.fillPolygonsToClipMask(tempClipMask, polygons, clipRule, this._transform);

        // Intersect with existing clip mask (if any)
        if (this._clipMask) {
            // AND operation: existing mask & new mask
            this._clipMask.intersectWith(tempClipMask);
        } else {
            // First clip - use the temporary buffer as the new clip mask
            this._clipMask = tempClipMask;
        }

        // clip() does not auto-stroke the path (per HTML5 Canvas spec)
    }

    // Image rendering
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
        // Debug logging for browser troubleshooting
        if (typeof console !== 'undefined' && console.log) {
            console.log('Core drawImage called with:', {
                imageType: image ? image.constructor.name : 'null',
                hasWidth: image ? typeof image.width : 'N/A',
                hasHeight: image ? typeof image.height : 'N/A',
                hasData: image ? !!image.data : 'N/A',
                dataType: image && image.data ? image.data.constructor.name : 'N/A',
                dataInstanceCheck: image && image.data ? image.data instanceof Uint8ClampedArray : 'N/A'
            });
        }

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
            clipMask: this._clipMask,
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
                'fillText: maxWidth is not supported by SWCanvas\'s BitmapText backend. ' +
                'Drop the argument or pre-measure with measureText and adjust your layout.'
            );
        }
        return TextRenderer.fillText(this, text, x, y);
    }

    measureText(text) {
        return TextRenderer.measureText(this, text);
    }

    strokeText() {
        throw new Error(
            'strokeText is not supported by SWCanvas\'s BitmapText backend. ' +
            'Use fillText instead.'
        );
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
            // Use unified method for coordinated fill+stroke rendering (no gaps)
            const clipBuffer = this._clipMask ? this._clipMask.buffer : null;
            CircleOps.fillStroke_Any(
                this.surface,
                center.x,
                center.y,
                scaledRadius,
                scaledLineWidth,
                hasFill ? fillPaintSource : null,
                hasStroke ? strokePaintSource : null,
                this.globalAlpha,
                clipBuffer
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

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;

        // Normalize angles
        const angles = ArcOps.normalizeAngles(startAngle, endAngle, anticlockwise);

        // Get paint source
        const paintSource = this._fillStyle;
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

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
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Check for direct rendering conditions
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        // Direct rendering only supports butt line caps (open arc shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        if (isColor && isSourceOver && isButtCap) {
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0;
            const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;

            if (is1pxStroke) {
                // Optimized 1px stroke path
                if (isOpaque) {
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
                        this.globalAlpha,
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
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

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
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Check for solid color direct rendering
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';

        const isOpaqueColor = isColor && paintSource.a === 255 && this.globalAlpha >= 1.0 && isSourceOver;

        const isSemiTransparentColor = isColor && paintSource.a < 255 && isSourceOver;

        if (isOpaqueColor) {
            // Direct rendering 1: 32-bit packed writes for opaque colors
            CircleOps.fill_Opaq(surface, cx, cy, radius, paintSource, clipBuffer);
        } else if (isSemiTransparentColor) {
            // Direct rendering 2: Bresenham scanlines with per-pixel alpha blending
            CircleOps.fill_Alpha(this.surface, cx, cy, radius, paintSource, this.globalAlpha, clipBuffer);
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
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Direct rendering 1: 1px strokes using Bresenham algorithm
        if (isColor && is1pxStroke && isSourceOver) {
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0;
            if (isOpaque) {
                CircleOps.stroke1px_Opaq(this.surface, cx, cy, radius, paintSource, clipBuffer);
                return;
            } else if (paintSource.a > 0) {
                CircleOps.stroke1px_Alpha(this.surface, cx, cy, radius, paintSource, this.globalAlpha, clipBuffer);
                return;
            }
        }

        // Direct rendering 2: Thick strokes using scanline annulus algorithm
        if (isColor && isSourceOver && lineWidth > 1 && paintSource.a > 0) {
            const isOpaqueThick = paintSource.a === 255 && this.globalAlpha >= 1.0;
            if (isOpaqueThick) {
                CircleOps.strokeThick_Opaq(this.surface, cx, cy, radius, lineWidth, paintSource, clipBuffer);
            } else {
                CircleOps.strokeThick_Alpha(
                    this.surface,
                    cx,
                    cy,
                    radius,
                    lineWidth,
                    paintSource,
                    this.globalAlpha,
                    clipBuffer
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
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Direct rendering only supports butt line caps (open shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        // Get color for solid color direct rendering
        const isOpaqueColor =
            paintSource instanceof Color &&
            paintSource.a === 255 &&
            this.globalAlpha >= 1.0 &&
            this.globalCompositeOperation === 'source-over' &&
            isButtCap;

        // Check for semitransparent color direct rendering (Color with alpha blending)
        const isSemiTransparentColor =
            paintSource instanceof Color &&
            !isOpaqueColor &&
            this.globalCompositeOperation === 'source-over' &&
            isButtCap;

        // Try direct rendering via LineOps
        const directRenderingUsed = LineOps.stroke_Any(
            this.surface,
            x1,
            y1,
            x2,
            y2,
            lineWidth,
            paintSource,
            this.globalAlpha,
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

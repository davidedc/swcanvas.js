/**
 * CanvasCompatibleContext2D
 *
 * HTML5 Canvas 2D Context-compatible wrapper around SWCanvas Core Context2D.
 * Provides the standard HTML5 Canvas API with property setters/getters and
 * CSS color support while delegating actual rendering to the Core implementation.
 */
// Caches decoded pixels (ImageLike) for immutable, decode-complete
// HTMLImageElements drawn via drawImage/createPattern, keyed by the element.
// Never used for videos or canvases (their pixels change).
const _swElementImageLikeCache = new WeakMap();

class CanvasCompatibleContext2D {
    // ===== STATIC PATH-BASED RENDERING TRACKING (for testing) =====

    /**
     * Reset the path-based rendering tracking flag
     * Call before running tests that should use direct rendering
     */
    static resetPathBasedFlag() {
        Context2D.resetPathBasedFlag();
    }

    /**
     * Check if path-based rendering was used since last reset
     * @returns {boolean} True if path-based rendering was used
     */
    static wasPathBasedUsed() {
        return Context2D.wasPathBasedUsed();
    }

    constructor(surface) {
        this._core = new Context2D(surface);
        this._colorParser = new ColorParser();

        // Property state (mirroring HTML5 Canvas behavior)
        this._fillStyle = '#000000';
        this._strokeStyle = '#000000';
        this._shadowColor = 'rgba(0, 0, 0, 0)'; // Transparent black (no shadow)
    }

    /**
     * Update the underlying surface (called when canvas is resized)
     * @param {Surface} newSurface - New surface instance
     * @private
     */
    _updateSurface(newSurface) {
        this._core = new Context2D(newSurface);

        // Reapply current styles to new context
        this._applyFillStyle();
        this._applyStrokeStyle();
        this._applyShadowProperties();
    }

    // ===== STYLE PROPERTIES =====

    /**
     * Get fill style
     * @returns {string} Current fill style as CSS color
     */
    get fillStyle() {
        return this._fillStyle;
    }

    /**
     * Set fill style
     * @param {string|Gradient|Pattern} value - CSS color string or paint source
     */
    set fillStyle(value) {
        this._fillStyle = value;
        this._applyFillStyle();
    }

    /**
     * Get stroke style
     * @returns {string} Current stroke style as CSS color
     */
    get strokeStyle() {
        return this._strokeStyle;
    }

    /**
     * Set stroke style
     * @param {string|Gradient|Pattern} value - CSS color string or paint source
     */
    set strokeStyle(value) {
        this._strokeStyle = value;
        this._applyStrokeStyle();
    }

    /**
     * Apply current fill style to core context
     * @private
     */
    _applyFillStyle() {
        if (
            this._fillStyle instanceof Gradient ||
            this._fillStyle instanceof LinearGradient ||
            this._fillStyle instanceof RadialGradient ||
            this._fillStyle instanceof ConicGradient ||
            this._fillStyle instanceof Pattern
        ) {
            // Pass gradient/pattern directly to core
            this._core.setFillStyle(this._fillStyle);
        } else {
            // Parse CSS color string
            const rgba = this._colorParser.parse(this._fillStyle);
            this._core.setFillStyle(rgba.r, rgba.g, rgba.b, rgba.a);
        }
    }

    /**
     * Apply current stroke style to core context
     * @private
     */
    _applyStrokeStyle() {
        if (
            this._strokeStyle instanceof Gradient ||
            this._strokeStyle instanceof LinearGradient ||
            this._strokeStyle instanceof RadialGradient ||
            this._strokeStyle instanceof ConicGradient ||
            this._strokeStyle instanceof Pattern
        ) {
            // Pass gradient/pattern directly to core
            this._core.setStrokeStyle(this._strokeStyle);
        } else {
            // Parse CSS color string
            const rgba = this._colorParser.parse(this._strokeStyle);
            this._core.setStrokeStyle(rgba.r, rgba.g, rgba.b, rgba.a);
        }
    }

    /**
     * Apply current shadow properties to core context
     * @private
     */
    _applyShadowProperties() {
        // Re-apply shadow color
        if (this._shadowColor) {
            const rgba = this._colorParser.parse(this._shadowColor);
            this._core.setShadowColor(rgba.r, rgba.g, rgba.b, rgba.a);
        }
        // Other shadow properties are stored directly in core, no need to reapply
    }

    // ===== DIRECT PROPERTY DELEGATION =====

    get globalAlpha() {
        return this._core.globalAlpha;
    }
    set globalAlpha(value) {
        this._core.globalAlpha = value;
    }

    get globalCompositeOperation() {
        return this._core.globalCompositeOperation;
    }
    set globalCompositeOperation(value) {
        this._core.globalCompositeOperation = value;
    }

    get lineWidth() {
        return this._core.lineWidth;
    }
    set lineWidth(value) {
        // HTML5 Canvas spec: ignore zero, negative, Infinity, and NaN values
        if (typeof value === 'number' && value > 0 && isFinite(value)) {
            this._core.lineWidth = value;
        }
        // Otherwise, keep the current value unchanged (ignore invalid input)
    }

    get lineJoin() {
        return this._core.lineJoin;
    }
    set lineJoin(value) {
        this._core.lineJoin = value;
    }

    get lineCap() {
        return this._core.lineCap;
    }
    set lineCap(value) {
        this._core.lineCap = value;
    }

    get miterLimit() {
        return this._core.miterLimit;
    }
    set miterLimit(value) {
        this._core.miterLimit = value;
    }

    get lineDashOffset() {
        return this._core.lineDashOffset;
    }
    set lineDashOffset(value) {
        this._core.lineDashOffset = value;
    }

    // ===== SHADOW PROPERTIES =====

    get shadowColor() {
        return this._shadowColor;
    }

    set shadowColor(value) {
        if (typeof value === 'string') {
            this._shadowColor = value;
            // Parse CSS color string and apply to core
            const rgba = this._colorParser.parse(value);
            this._core.setShadowColor(rgba.r, rgba.g, rgba.b, rgba.a);
        } else {
            // Silently ignore invalid values (matches HTML5 Canvas behavior)
        }
    }

    get shadowBlur() {
        return this._core.shadowBlur;
    }
    set shadowBlur(value) {
        if (typeof value === 'number' && !isNaN(value) && value >= 0) {
            this._core.setShadowBlur(value);
        }
        // Silently ignore invalid values (matches HTML5 Canvas behavior)
    }

    get shadowOffsetX() {
        return this._core.shadowOffsetX;
    }
    set shadowOffsetX(value) {
        if (typeof value === 'number' && !isNaN(value)) {
            this._core.setShadowOffsetX(value);
        }
        // Silently ignore invalid values (matches HTML5 Canvas behavior)
    }

    get shadowOffsetY() {
        return this._core.shadowOffsetY;
    }
    set shadowOffsetY(value) {
        if (typeof value === 'number' && !isNaN(value)) {
            this._core.setShadowOffsetY(value);
        }
        // Silently ignore invalid values (matches HTML5 Canvas behavior)
    }

    // ===== TEXT PROPERTIES =====

    get font() {
        // HTML5 spec: getter returns the *serialized* (canonical) form of the
        // current font, not the user's verbatim input. Core stores the parsed
        // shape on this._core._font; we format it back through CssFontParser.
        return this._core._font === null
            ? '10px sans-serif'
            : CssFontParser.format(this._core._font);
    }
    set font(value) {
        // HTML5 spec: silently ignore unparseable values; previous value stays.
        if (typeof value !== 'string') return;
        try {
            this._core._font = CssFontParser.parse(value);
        } catch (_e) {
            // Ignore — getter still returns whatever was last successfully set.
        }
    }

    get textAlign() {
        return this._core._textAlign;
    }
    set textAlign(value) {
        if (value === 'start' || value === 'end' || value === 'left' ||
            value === 'right' || value === 'center') {
            this._core._textAlign = value;
        }
    }

    get textBaseline() {
        return this._core._textBaseline;
    }
    set textBaseline(value) {
        if (value === 'top' || value === 'hanging' || value === 'middle' ||
            value === 'alphabetic' || value === 'ideographic' || value === 'bottom') {
            this._core._textBaseline = value;
        }
    }

    get direction() {
        return this._core._direction;
    }
    set direction(value) {
        if (value === 'inherit' || value === 'ltr' || value === 'rtl') {
            this._core._direction = value;
        }
    }

    // Non-standard. Picks the BitmapText atlas density used for fillText.
    // Default at construction: window.devicePixelRatio in browsers, 1 in Node.
    // Snapshotted through save()/restore() via the core snapshot.
    get textPixelDensity() {
        return this._core._textPixelDensity;
    }
    set textPixelDensity(value) {
        if (typeof value === 'number' && value > 0 && isFinite(value)) {
            this._core._textPixelDensity = value;
        }
    }

    // ===== STATE MANAGEMENT =====

    save() {
        this._core.save();
    }

    restore() {
        this._core.restore();
    }

    // ===== TRANSFORMS =====

    transform(a, b, c, d, e, f) {
        this._core.transform(a, b, c, d, e, f);
    }

    setTransform(a, b, c, d, e, f) {
        this._core.setTransform(a, b, c, d, e, f);
    }

    resetTransform() {
        this._core.resetTransform();
    }

    translate(x, y) {
        this._core.translate(x, y);
    }

    scale(sx, sy) {
        this._core.scale(sx, sy);
    }

    rotate(angleInRadians) {
        this._core.rotate(angleInRadians);
    }

    // ===== PATH METHODS =====

    beginPath() {
        this._core.beginPath();
    }

    closePath() {
        this._core.closePath();
    }

    moveTo(x, y) {
        this._core.moveTo(x, y);
    }

    lineTo(x, y) {
        this._core.lineTo(x, y);
    }

    rect(x, y, w, h) {
        this._core.rect(x, y, w, h);
    }

    arc(x, y, radius, startAngle, endAngle, counterclockwise = false) {
        this._core.arc(x, y, radius, startAngle, endAngle, counterclockwise);
    }

    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise = false) {
        this._core.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise);
    }

    arcTo(x1, y1, x2, y2, radius) {
        this._core.arcTo(x1, y1, x2, y2, radius);
    }

    quadraticCurveTo(cpx, cpy, x, y) {
        this._core.quadraticCurveTo(cpx, cpy, x, y);
    }

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        this._core.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }

    // ===== DRAWING METHODS =====

    fillRect(x, y, width, height) {
        this._core.fillRect(x, y, width, height);
    }

    strokeRect(x, y, width, height) {
        this._core.strokeRect(x, y, width, height);
    }

    fillStrokeRect(x, y, width, height) {
        this._core.fillStrokeRect(x, y, width, height);
    }

    clearRect(x, y, width, height) {
        this._core.clearRect(x, y, width, height);
    }

    strokeRoundRect(x, y, width, height, radii) {
        this._core.strokeRoundRect(x, y, width, height, radii);
    }

    fillRoundRect(x, y, width, height, radii) {
        this._core.fillRoundRect(x, y, width, height, radii);
    }

    fillStrokeRoundRect(x, y, width, height, radii) {
        this._core.fillStrokeRoundRect(x, y, width, height, radii);
    }

    fill(pathOrFillRule, fillRule) {
        if (typeof pathOrFillRule === 'string') {
            // fill(fillRule)
            this._core.fill(pathOrFillRule);
        } else if (pathOrFillRule && pathOrFillRule instanceof SWPath2D) {
            // fill(path, fillRule)
            this._core.fill(pathOrFillRule, fillRule);
        } else {
            // fill()
            this._core.fill();
        }
    }

    stroke(path) {
        if (path && path instanceof SWPath2D) {
            this._core.stroke(path);
        } else {
            this._core.stroke();
        }
    }

    isPointInPath() {
        return this._core.isPointInPath.apply(this._core, arguments);
    }

    isPointInStroke() {
        return this._core.isPointInStroke.apply(this._core, arguments);
    }

    // Line dash methods
    setLineDash(segments) {
        this._core.setLineDash(segments);
    }

    getLineDash() {
        return this._core.getLineDash();
    }

    clip(pathOrFillRule, fillRule) {
        if (typeof pathOrFillRule === 'string') {
            // clip(fillRule)
            this._core.clip(pathOrFillRule);
        } else if (pathOrFillRule && pathOrFillRule instanceof SWPath2D) {
            // clip(path, fillRule)
            this._core.clip(pathOrFillRule, fillRule);
        } else {
            // clip()
            this._core.clip();
        }
    }

    // ===== IMAGE DRAWING =====

    drawImage(image, ...args) {
        this._core.drawImage(CanvasCompatibleContext2D._toImageLike(image), ...args);
    }

    /**
     * Resolve any supported drawImage/createPattern source to an ImageLike that
     * the Core understands ({width, height, data: Uint8ClampedArray}).
     *  - SWCanvasElement → its _imageData (shares the surface buffer, no copy)
     *  - HTMLCanvasElement (has getContext) → getImageData
     *  - structural ImageLike → passed through
     *  - HTMLImageElement / HTMLVideoElement / ImageBitmap → rasterized into a
     *    scratch DOM canvas; image results are cached (immutable), video/bitmap
     *    are re-grabbed each call (frames change)
     *  - anything else → returned as-is so the Core can throw its own error
     * @private
     */
    static _toImageLike(image) {
        if (!image || typeof image !== 'object') {
            return image;
        }
        if (image instanceof SWCanvasElement) {
            return image._imageData;
        }
        if (typeof image.getContext === 'function') {
            // HTMLCanvasElement (or any canvas-like with a 2d context)
            const ctx = image.getContext('2d');
            return ctx.getImageData(0, 0, image.width, image.height);
        }
        if (image.data && image.width && image.height) {
            // structural ImageLike
            return image;
        }
        if (CanvasCompatibleContext2D._isElementImageSource(image)) {
            return CanvasCompatibleContext2D._elementToImageLike(image);
        }
        return image;
    }

    /** True for HTMLImageElement / HTMLVideoElement / ImageBitmap-like sources. @private */
    static _isElementImageSource(image) {
        return ('naturalWidth' in image) || ('videoWidth' in image) ||
               (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap);
    }

    /** Rasterize an element image source into a scratch DOM canvas → ImageLike. @private */
    static _elementToImageLike(image) {
        const isVideo = ('videoWidth' in image);
        const isImg = ('naturalWidth' in image);
        const w = isVideo ? image.videoWidth : (isImg ? image.naturalWidth : image.width);
        const h = isVideo ? image.videoHeight : (isImg ? image.naturalHeight : image.height);

        // Only immutable, fully-decoded images are cacheable.
        const cacheable = isImg && image.complete && image.naturalWidth > 0;
        if (cacheable) {
            const cached = _swElementImageLikeCache.get(image);
            if (cached && cached.width === w && cached.height === h) {
                return cached;
            }
        }

        if (typeof document === 'undefined') {
            throw new Error('SWCanvas: cannot rasterize an element image source without a DOM canvas');
        }
        const scratch = document.createElement('canvas');
        scratch.width = w;
        scratch.height = h;
        const sctx = scratch.getContext('2d');
        sctx.drawImage(image, 0, 0, w, h);
        const decoded = sctx.getImageData(0, 0, w, h);
        const imageLike = { width: decoded.width, height: decoded.height, data: decoded.data };

        if (cacheable) {
            _swElementImageLikeCache.set(image, imageLike);
        }
        return imageLike;
    }

    // ===== TEXT RENDERING =====

    fillText(text, x, y, maxWidth) {
        return this._core.fillText(text, x, y, maxWidth);
    }

    measureText(text) {
        return this._core.measureText(text);
    }

    strokeText() {
        // Re-throws Core's "not supported" — explicit failure beats silent no-op.
        this._core.strokeText();
    }

    // ===== IMAGE DATA API =====

    /**
     * Create new ImageData object with specified dimensions
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels
     * @returns {Object} ImageData-like object
     */
    createImageData(width, height) {
        Validators.positiveInteger(width, 'width');
        Validators.positiveInteger(height, 'height');

        return {
            width: width,
            height: height,
            data: new Uint8ClampedArray(width * height * 4)
        };
    }

    /**
     * Get ImageData from a rectangular region
     * @param {number} x - X coordinate of rectangle
     * @param {number} y - Y coordinate of rectangle
     * @param {number} width - Width of rectangle
     * @param {number} height - Height of rectangle
     * @returns {Object} ImageData-like object
     */
    getImageData(x, y, width, height) {
        Validators.number(x, 'x coordinate');
        Validators.number(y, 'y coordinate');
        Validators.positiveInteger(width, 'width');
        Validators.positiveInteger(height, 'height');

        // Create ImageData object
        const imageData = this.createImageData(width, height);
        const surface = this._core.surface;

        // Copy pixel data from surface to ImageData
        for (let row = 0; row < height; row++) {
            const surfaceRow = Math.floor(y) + row;
            const imageRow = row;

            if (surfaceRow >= 0 && surfaceRow < surface.height) {
                for (let col = 0; col < width; col++) {
                    const surfaceCol = Math.floor(x) + col;
                    const imageCol = col;

                    if (surfaceCol >= 0 && surfaceCol < surface.width) {
                        const surfaceOffset = surfaceRow * surface.stride + surfaceCol * 4;
                        const imageOffset = imageRow * width * 4 + imageCol * 4;

                        imageData.data[imageOffset] = surface.data[surfaceOffset];
                        imageData.data[imageOffset + 1] = surface.data[surfaceOffset + 1];
                        imageData.data[imageOffset + 2] = surface.data[surfaceOffset + 2];
                        imageData.data[imageOffset + 3] = surface.data[surfaceOffset + 3];
                    }
                }
            }
        }

        return imageData;
    }

    /**
     * Put ImageData onto the canvas at specified position
     * @param {Object} imageData - ImageData-like object
     * @param {number} dx - Destination x coordinate
     * @param {number} dy - Destination y coordinate
     */
    putImageData(imageData, dx, dy) {
        Validators.defined(imageData, 'imageData');
        Validators.number(imageData.width, 'imageData.width');
        Validators.number(imageData.height, 'imageData.height');
        Validators.instanceOf(imageData.data, Uint8ClampedArray, 'imageData.data');
        Validators.number(dx, 'dx');
        Validators.number(dy, 'dy');

        const surface = this._core.surface;

        // Copy pixel data from ImageData to surface
        for (let row = 0; row < imageData.height; row++) {
            const surfaceRow = Math.floor(dy) + row;
            const imageRow = row;

            if (surfaceRow >= 0 && surfaceRow < surface.height) {
                for (let col = 0; col < imageData.width; col++) {
                    const surfaceCol = Math.floor(dx) + col;
                    const imageCol = col;

                    if (surfaceCol >= 0 && surfaceCol < surface.width) {
                        const surfaceOffset = surfaceRow * surface.stride + surfaceCol * 4;
                        const imageOffset = imageRow * imageData.width * 4 + imageCol * 4;

                        surface.data[surfaceOffset] = imageData.data[imageOffset];
                        surface.data[surfaceOffset + 1] = imageData.data[imageOffset + 1];
                        surface.data[surfaceOffset + 2] = imageData.data[imageOffset + 2];
                        surface.data[surfaceOffset + 3] = imageData.data[imageOffset + 3];
                    }
                }
            }
        }
    }

    // ===== GRADIENT AND PATTERN METHODS =====

    /**
     * Create a linear gradient
     * @param {number} x0 - Start point x coordinate
     * @param {number} y0 - Start point y coordinate
     * @param {number} x1 - End point x coordinate
     * @param {number} y1 - End point y coordinate
     * @returns {LinearGradient} New linear gradient object
     */
    createLinearGradient(x0, y0, x1, y1) {
        return this._core.createLinearGradient(x0, y0, x1, y1);
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
        return this._core.createRadialGradient(x0, y0, r0, x1, y1, r1);
    }

    /**
     * Create a conic gradient
     * @param {number} angle - Starting angle in radians
     * @param {number} x - Center point x coordinate
     * @param {number} y - Center point y coordinate
     * @returns {ConicGradient} New conic gradient object
     */
    createConicGradient(angle, x, y) {
        return this._core.createConicGradient(angle, x, y);
    }

    /**
     * Create a pattern from an image
     * @param {Object} image - ImageLike object (canvas, surface, imagedata)
     * @param {string} repetition - Repetition mode: 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'
     * @returns {Pattern} New pattern object
     */
    createPattern(image, repetition) {
        return this._core.createPattern(image, repetition);
    }

    // ===== CORE ACCESS FOR ADVANCED USERS =====

    /**
     * Get the underlying Core Context2D for advanced operations
     * @returns {Context2D} The Core Context2D instance
     */
    get _coreContext() {
        return this._core;
    }

    // ===== DIRECT SHAPE APIs =====

    /**
     * Fill a circle directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    fillCircle(centerX, centerY, radius) {
        this._core.fillCircle(centerX, centerY, radius);
    }

    /**
     * Stroke a circle directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    strokeCircle(centerX, centerY, radius) {
        this._core.strokeCircle(centerX, centerY, radius);
    }

    /**
     * Fill and stroke a circle in one operation
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    fillStrokeCircle(centerX, centerY, radius) {
        this._core.fillStrokeCircle(centerX, centerY, radius);
    }

    /**
     * Stroke a line directly without using the path system
     * @param {number} x1 - Start X coordinate
     * @param {number} y1 - Start Y coordinate
     * @param {number} x2 - End X coordinate
     * @param {number} y2 - End Y coordinate
     */
    strokeLine(x1, y1, x2, y2) {
        this._core.strokeLine(x1, y1, x2, y2);
    }

    // ===== ARC DIRECT APIs (direct rendering) =====

    /**
     * Fill an arc (pie slice) directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction of arc
     */
    fillArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        this._core.fillArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
    }

    /**
     * Stroke only the outer curved part of an arc (not radial lines to center)
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction of arc
     */
    outerStrokeArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        this._core.outerStrokeArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
    }

    /**
     * Fill an arc and stroke only its outer curve in one operation
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction of arc
     */
    fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        this._core.fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
    }
}

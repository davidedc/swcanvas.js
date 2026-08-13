/**
 * Rasterizer class for SWCanvas
 *
 * Handles low-level pixel operations and rendering pipeline.
 * Converted to ES6 class following Joshua Bloch's effective OO principles.
 * Encapsulates rendering state and provides clear separation of concerns.
 */
// Composite operations that affect pixels outside the source region and so need
// a canvas-wide pass. Hoisted to a module-const Set (was a fresh array + .includes
// allocated on every draw op via _requiresCanvasWideCompositing).
const CANVAS_WIDE_COMPOSITE_OPS = new Set(['destination-atop', 'destination-in', 'source-in', 'source-out', 'copy']);

class Rasterizer {
    /**
     * Create a Rasterizer
     * @param {Surface} surface - Target surface for rendering
     */
    constructor(surface) {
        if (!surface || typeof surface !== 'object') {
            throw new Error('Rasterizer requires a valid Surface object');
        }

        if (!surface.width || !surface.height || !surface.data) {
            throw new Error('Surface must have width, height, and data properties');
        }

        this._surface = surface;
        this._currentOp = null;
    }

    /**
     * Get the target surface
     * @returns {Surface} Target surface
     */
    get surface() {
        return this._surface;
    }

    /**
     * Get current operation state
     * @returns {Object|null} Current operation state
     */
    get currentOp() {
        return this._currentOp;
    }

    /**
     * Begin a rendering operation
     * @param {Object} params - Operation parameters
     */
    beginOp(params = {}) {
        this._validateParams(params);

        this._currentOp = {
            composite: params.composite || 'source-over',
            globalAlpha: params.globalAlpha !== undefined ? params.globalAlpha : 1.0,
            transform: params.transform || Transform2D.IDENTITY,
            clipMask: params.clipMask || null, // Stencil-based clipping
            // Tier-0 rectangular clip (S3): { x0, y0, x1, y1 } half-open device
            // ints, or null. When set, clipMask is null and the renderer clamps
            // its draw extent to this rect instead of per-pixel bit-testing.
            clipRect: params.clipRect || null,
            fillStyle: params.fillStyle || null,
            strokeStyle: params.strokeStyle || null,
            // Lazily built on the first coverage write of a canvas-wide op (see
            // _ensureSourceMask). The full-cover fillRect fast path in
            // _fillRectInternal never needs it, so it pays no allocation.
            sourceMask: null,
            // Shadow properties
            shadowColor: params.shadowColor || Color.transparent,
            shadowBlur: params.shadowBlur || 0,
            shadowOffsetX: params.shadowOffsetX || 0,
            shadowOffsetY: params.shadowOffsetY || 0,
            // Sampling policy (drawImage only; HTML5 default true when unset)
            imageSmoothingEnabled: params.imageSmoothingEnabled !== false
        };
    }

    /**
     * End the current rendering operation
     */
    endOp() {
        this._currentOp = null;
    }

    /**
     * Validate operation parameters
     * @param {Object} params - Parameters to validate
     * @private
     */
    _validateParams(params) {
        if (IS_DEBUG) {
            if (params.globalAlpha !== undefined) {
                if (typeof params.globalAlpha !== 'number' || params.globalAlpha < 0 || params.globalAlpha > 1) {
                    throw new Error('globalAlpha must be a number between 0 and 1');
                }
            }
            if (params.composite && !CompositeOperations.isSupported(params.composite)) {
                throw new Error('Invalid composite operation');
            }
            if (params.transform && !(params.transform instanceof Transform2D)) {
                throw new Error('transform must be a Transform2D instance');
            }
        }
    }

    /**
     * Ensure an operation is active
     * @private
     */
    _requireActiveOp() {
        if (IS_DEBUG) {
            if (!this._currentOp) {
                throw new Error('Must call beginOp() before drawing operations');
            }
        }
    }

    /**
     * Check if a composite operation requires canvas-wide compositing (affects pixels outside source)
     * @param {string} operation - Composite operation name
     * @returns {boolean} True if operation requires canvas-wide compositing
     * @private
     */
    _requiresCanvasWideCompositing(operation) {
        return CANVAS_WIDE_COMPOSITE_OPS.has(operation);
    }

    /**
     * Check if a pixel should be clipped by stencil buffer
     * @param {number} x - Pixel x coordinate
     * @param {number} y - Pixel y coordinate
     * @returns {boolean} True if pixel should be clipped
     * @private
     */
    _isPixelClipped(x, y) {
        if (!this._currentOp?.clipMask) return false; // No clipping active
        return this._currentOp.clipMask.isPixelClipped(x, y);
    }

    /**
     * Fill a rectangle with solid color
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Array|Color} color - Fill color (RGBA array or Color instance)
     */
    fillRect(x, y, width, height, color) {
        this._requireActiveOp();

        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width < 0 || height < 0) {
            throw new Error('Rectangle dimensions must be non-negative');
        }

        if (width === 0 || height === 0) return; // Nothing to draw

        // Wrap the actual rectangle filling logic with shadow pipeline
        ShadowPipeline.renderWithShadow(this, () => {
            this._fillRectInternal(x, y, width, height, color);
        });
    }

    /**
     * Internal rectangle filling logic (without shadow processing)
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Array|Color} color - Fill color
     * @private
     */
    _fillRectInternal(x, y, width, height, color) {
        // If there's stencil clipping or canvas-wide compositing, convert the rectangle to a path and use path filling
        if (this._currentOp.clipMask || this._requiresCanvasWideCompositing(this._currentOp.composite)) {
            // ── Full-cover canvas-wide fast path (byte-identical single pass) ──
            // A fillRect under a canvas-wide composite op (source-in/out,
            // destination-in/atop, copy) that covers the ENTIRE surface makes the
            // two-pass SourceMask machinery pure waste: full coverage ⇒ every pixel's
            // Sa===1 ⇒ the result equals ONE blendPixel(composite, evalPaint, dst) pass
            // (exactly the Sa>0 arm of _performCanvasWideCompositing, with no mask build
            // and no second iteration). This is the colored-glyph tint — BitmapText
            // stamps text colour with `source-in` fillRect(0,0,fullScratch), ~128×/frame
            // on a busy desktop. Scope to the safe dominant case only: no clip, an
            // axis-aligned transform, and a device rect ⊇ [0,W]×[0,H]. Everything else
            // (any clip, rotation, or partial cover) keeps the two-pass path below.
            if (this._currentOp.clipMask === null && this._currentOp.clipRect === null &&
                this._requiresCanvasWideCompositing(this._currentOp.composite) &&
                this._currentOp.transform.b === 0 && this._currentOp.transform.c === 0 &&
                this._axisAlignedRectCoversSurface(x, y, width, height, this._currentOp.transform)) {
                this._fillFullCoverCanvasWide(color);
                return;
            }

            // Create a path for the rectangle
            const rectPath = new SWPath2D();
            rectPath.rect(x, y, width, height);

            // Temporarily override fill style with provided color if specified
            const originalFillStyle = this._currentOp.fillStyle;
            if (color && Array.isArray(color)) {
                // Only override for array colors (like from clearRect)
                this._currentOp.fillStyle = new Color(color[0], color[1], color[2], color[3]);
            }

            // Use the existing path filling logic which handles stencil clipping and canvas-wide compositing properly
            this._fillInternal(rectPath, 'nonzero');

            // Restore original fill style
            if (color && Array.isArray(color)) {
                this._currentOp.fillStyle = originalFillStyle;
            }
            return;
        }

        // No clipping - use optimized direct rectangle filling
        // Transform rectangle corners
        const transform = this._currentOp.transform;
        const topLeft = transform.transformPoint({ x: x, y: y });
        const topRight = transform.transformPoint({ x: x + width, y: y });
        const bottomLeft = transform.transformPoint({ x: x, y: y + height });
        const bottomRight = transform.transformPoint({ x: x + width, y: y + height });

        // Find bounding box in device space
        const minX = Math.max(0, Math.floor(Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)));
        const maxX = Math.min(
            this._surface.width - 1,
            Math.floor(Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) - 1)
        );
        const minY = Math.max(0, Math.floor(Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)));
        const maxY = Math.min(
            this._surface.height - 1,
            Math.floor(Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) - 1)
        );

        // Optimized path for axis-aligned rectangles with solid colors only
        if (
            this._currentOp.transform.b === 0 &&
            this._currentOp.transform.c === 0 &&
            (color instanceof Color || Array.isArray(color))
        ) {
            this._fillAxisAlignedRect(minX, minY, maxX - minX + 1, maxY - minY + 1, color);
        } else {
            // Handle rotated rectangles by converting to polygon
            const rectPolygon = [
                { x: x, y: y },
                { x: x + width, y: y },
                { x: x + width, y: y + height },
                { x: x, y: y + height }
            ];

            // Use existing polygon filling system which handles transforms and stencil clipping
            const rectColor = Array.isArray(color) ? new Color(color[0], color[1], color[2], color[3]) : color;
            PolygonFiller.fillPolygons(
                this._surface,
                [rectPolygon],
                rectColor,
                'nonzero',
                this._currentOp.transform,
                this._currentOp.clipMask,
                this._currentOp.globalAlpha,
                1.0,
                this._currentOp.composite,
                this._currentOp.sourceMask,
                this._currentOp.clipRect
            );
        }
    }

    /**
     * Fill axis-aligned rectangle (optimized path)
     * @param {number} x - Rectangle x
     * @param {number} y - Rectangle y
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Array|Color} color - Fill color
     * @private
     */
    _fillAxisAlignedRect(x, y, width, height, color) {
        const surface = this._surface;
        const globalAlpha = this._currentOp.globalAlpha;

        // Convert color to Color object if needed and apply global alpha
        const colorObj = Array.isArray(color) ? new Color(color[0], color[1], color[2], color[3]) : color;
        const finalColor = colorObj.withGlobalAlpha(globalAlpha);
        const srcR = finalColor.r;
        const srcG = finalColor.g;
        const srcB = finalColor.b;
        const srcA = finalColor.a;

        for (let py = y; py < y + height; py++) {
            if (py < 0 || py >= surface.height) continue;

            for (let px = x; px < x + width; px++) {
                if (px < 0 || px >= surface.width) continue;

                // Check stencil buffer clipping
                if (this._currentOp.clipMask && this._isPixelClipped(px, py)) {
                    continue; // Skip pixels clipped by stencil buffer
                }

                const offset = py * surface.stride + px * 4;

                // Get destination pixel for blending
                const dstR = surface.data[offset];
                const dstG = surface.data[offset + 1];
                const dstB = surface.data[offset + 2];
                const dstA = surface.data[offset + 3];

                // Use CompositeOperations for consistent blending
                const result = CompositeOperations.blendPixel(
                    this._currentOp.composite,
                    srcR,
                    srcG,
                    srcB,
                    srcA, // source
                    dstR,
                    dstG,
                    dstB,
                    dstA // destination
                );

                surface.data[offset] = result.r;
                surface.data[offset + 1] = result.g;
                surface.data[offset + 2] = result.b;
                surface.data[offset + 3] = result.a;
            }
        }
    }

    /**
     * Lazily allocate the source-coverage mask for canvas-wide compositing.
     * Called on the first coverage write of a canvas-wide op (the two-pass path);
     * the full-cover fillRect fast path never calls it, so it allocates nothing.
     * @returns {SourceMask} The current op's source mask
     * @private
     */
    _ensureSourceMask() {
        if (this._currentOp.sourceMask === null) {
            this._currentOp.sourceMask = new SourceMask(this._surface.width, this._surface.height);
        }
        return this._currentOp.sourceMask;
    }

    /**
     * Does the axis-aligned device bbox of this rect cover the whole surface?
     * When true (and the transform is axis-aligned), every surface pixel's span
     * membership in the mask the two-pass path would build is guaranteed true, so a
     * single composite pass is exact. dx0<=0 ⇒ startX clamps to 0, dx1>=W ⇒ endX
     * clamps to W-1 for every scanline, and dy0<=0 / dy1>=H make every scanline
     * (sampled at y+0.5) intersect the rect — i.e. the mask is all-covered.
     * @private
     */
    _axisAlignedRectCoversSurface(x, y, width, height, transform) {
        const topLeft = transform.transformPoint({ x: x, y: y });
        const topRight = transform.transformPoint({ x: x + width, y: y });
        const bottomLeft = transform.transformPoint({ x: x, y: y + height });
        const bottomRight = transform.transformPoint({ x: x + width, y: y + height });
        const dx0 = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
        const dx1 = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
        const dy0 = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
        const dy1 = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
        return dx0 <= 0 && dy0 <= 0 && dx1 >= this._surface.width && dy1 >= this._surface.height;
    }

    /**
     * Single-pass full-cover canvas-wide fill (byte-identical to the two-pass path
     * when the source covers every pixel — see _fillRectInternal). Iterates the whole
     * surface in the same [0..H-1]×[0..W-1] order as _performCanvasWideCompositing,
     * evaluating the paint and blending each pixel, but with no SourceMask build and
     * no per-pixel getPixel/Sa branch (Sa is 1 everywhere by construction).
     * @param {Color|Array} color - Fill color param from fillRect (array overrides fillStyle)
     * @private
     */
    _fillFullCoverCanvasWide(color) {
        const op = this._currentOp;
        const surface = this._surface;
        const composite = op.composite;
        const transform = op.transform;
        const globalAlpha = op.globalAlpha;
        // Resolve the paint source exactly as the two-pass path does: an array color
        // (e.g. from clearRect) overrides fillStyle; otherwise the op's fillStyle (or
        // opaque black). color is normally Context2D._fillStyle (a Color), so the array
        // branch is not taken — same resolution as _fillRectInternal + _fillInternal.
        const paintSource = Array.isArray(color)
            ? new Color(color[0], color[1], color[2], color[3])
            : (op.fillStyle || new Color(0, 0, 0, 255));
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;
        const stride = surface.stride;

        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                const src = PolygonFiller._evaluatePaintSource(
                    paintSource, px, py, transform, globalAlpha, 1.0
                );
                const offset = py * stride + px * 4;
                const result = CompositeOperations.blendPixel(
                    composite,
                    src.r, src.g, src.b, src.a,
                    data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
                );
                data[offset] = result.r;
                data[offset + 1] = result.g;
                data[offset + 2] = result.b;
                data[offset + 3] = result.a;
            }
        }
    }

    /**
     * Perform canvas-wide compositing for operations that affect pixels outside the source area
     * @param {Color|Gradient|Pattern} paintSource - Paint source for source pixels
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @private
     */
    _performCanvasWideCompositing(paintSource, globalAlpha = 1.0, subPixelOpacity = 1.0) {
        if (!this._currentOp || !this._currentOp.sourceMask) {
            throw new Error('Canvas-wide compositing requires active operation with source mask');
        }

        const surface = this._surface;
        const sourceMask = this._currentOp.sourceMask;
        const composite = this._currentOp.composite;
        const transform = this._currentOp.transform;
        const clipMask = this._currentOp.clipMask;

        // Get optimized iteration bounds (full surface for canvas-wide compositing)
        const bounds = sourceMask.getIterationBounds(clipMask, true);
        if (bounds.isEmpty) {
            return; // Nothing to composite
        }

        // Iterate over all pixels in the compositing region
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                // Check stencil buffer clipping
                if (clipMask && clipMask.isPixelClipped(x, y)) {
                    continue; // Skip pixels clipped by stencil buffer
                }

                // Determine source coverage and color
                const Sa = sourceMask.getPixel(x, y) ? 1 : 0;
                let srcColor;

                if (Sa > 0) {
                    // Evaluate paint source at covered pixel
                    srcColor = PolygonFiller._evaluatePaintSource(
                        paintSource,
                        x,
                        y,
                        transform,
                        globalAlpha,
                        subPixelOpacity
                    );
                } else {
                    // Transparent source for uncovered pixels
                    srcColor = Color.transparent;
                }

                // Get destination pixel
                const offset = y * surface.stride + x * 4;
                const dstR = surface.data[offset];
                const dstG = surface.data[offset + 1];
                const dstB = surface.data[offset + 2];
                const dstA = surface.data[offset + 3];

                // Apply composite operation with explicit source coverage
                const result = CompositeOperations.blendPixel(
                    composite,
                    srcColor.r,
                    srcColor.g,
                    srcColor.b,
                    srcColor.a, // source
                    dstR,
                    dstG,
                    dstB,
                    dstA // destination
                );

                // Store result
                surface.data[offset] = result.r;
                surface.data[offset + 1] = result.g;
                surface.data[offset + 2] = result.b;
                surface.data[offset + 3] = result.a;
            }
        }
    }

    /**
     * Fill a path using the current fill style
     * @param {Path2D} path - Path to fill
     * @param {string} rule - Fill rule ('nonzero' or 'evenodd')
     */
    fill(path, rule) {
        this._requireActiveOp();

        // Wrap the actual path filling logic with shadow pipeline
        ShadowPipeline.renderWithShadow(this, () => {
            this._fillInternal(path, rule);
        });
    }

    /**
     * Internal path filling logic (without shadow processing)
     * @param {Path2D} path - Path to fill
     * @param {string} rule - Fill rule
     * @private
     */
    _fillInternal(path, rule) {
        // Get fill style (Color, Gradient, or Pattern)
        const fillStyle = this._currentOp.fillStyle || new Color(0, 0, 0, 255);
        const fillRule = rule || 'nonzero';

        // Flatten path to polygons
        const polygons = PathFlattener.flattenPath(path);

        if (this._requiresCanvasWideCompositing(this._currentOp.composite)) {
            // Canvas-wide compositing path: build source mask then perform canvas-wide compositing
            PolygonFiller.fillPolygons(
                this._surface,
                polygons,
                fillStyle,
                fillRule,
                this._currentOp.transform,
                this._currentOp.clipMask,
                this._currentOp.globalAlpha,
                1.0,
                this._currentOp.composite,
                this._ensureSourceMask(),
                this._currentOp.clipRect
            );

            // Perform canvas-wide compositing pass
            this._performCanvasWideCompositing(fillStyle, this._currentOp.globalAlpha, 1.0);
        } else {
            // Source-bounded compositing path: direct rendering (existing behavior)
            PolygonFiller.fillPolygons(
                this._surface,
                polygons,
                fillStyle,
                fillRule,
                this._currentOp.transform,
                this._currentOp.clipMask,
                this._currentOp.globalAlpha,
                1.0,
                this._currentOp.composite,
                this._currentOp.sourceMask,
                this._currentOp.clipRect
            );
        }
    }

    /**
     * Stroke a path using the current stroke style
     * @param {Path2D} path - Path to stroke
     * @param {Object} strokeProps - Stroke properties
     */
    stroke(path, strokeProps) {
        this._requireActiveOp();

        // Wrap the actual stroke logic with shadow pipeline
        ShadowPipeline.renderWithShadow(this, () => {
            this._strokeInternal(path, strokeProps);
        });
    }

    /**
     * Internal stroke logic (without shadow processing)
     * @param {Path2D} path - Path to stroke
     * @param {Object} strokeProps - Stroke properties
     * @private
     */
    _strokeInternal(path, strokeProps) {
        // Get stroke style (Color, Gradient, or Pattern)
        const strokeStyle = this._currentOp.strokeStyle || new Color(0, 0, 0, 255);

        // Sub-pixel stroke rendering: calculate opacity adjustment
        let adjustedStrokeProps = strokeProps;
        let subPixelOpacity = 1.0; // Default for strokes > 1px

        if (strokeProps.lineWidth < 1.0) {
            // Sub-pixel strokes: render at proportional opacity
            subPixelOpacity = strokeProps.lineWidth;

            // Render sub-pixel strokes at 1px width
            // Opacity adjustment handled in paint source evaluation
            adjustedStrokeProps = { ...strokeProps, lineWidth: 1.0 };
        }

        // Generate stroke polygons using geometric approach
        const strokePolygons = StrokeGenerator.generateStrokePolygons(path, adjustedStrokeProps);

        if (this._requiresCanvasWideCompositing(this._currentOp.composite)) {
            // Canvas-wide compositing path: build source mask then perform canvas-wide compositing
            PolygonFiller.fillPolygons(
                this._surface,
                strokePolygons,
                strokeStyle,
                'nonzero',
                this._currentOp.transform,
                this._currentOp.clipMask,
                this._currentOp.globalAlpha,
                subPixelOpacity,
                this._currentOp.composite,
                this._ensureSourceMask(),
                this._currentOp.clipRect
            );

            // Perform canvas-wide compositing pass
            this._performCanvasWideCompositing(strokeStyle, this._currentOp.globalAlpha, subPixelOpacity);
        } else {
            // Source-bounded compositing path: direct rendering (existing behavior)
            PolygonFiller.fillPolygons(
                this._surface,
                strokePolygons,
                strokeStyle,
                'nonzero',
                this._currentOp.transform,
                this._currentOp.clipMask,
                this._currentOp.globalAlpha,
                subPixelOpacity,
                this._currentOp.composite,
                this._currentOp.sourceMask,
                this._currentOp.clipRect
            );
        }
    }

    /**
     * Draw an image to the surface
     * @param {Object} img - ImageLike object to draw
     * @param {number} sx - Source x (optional)
     * @param {number} sy - Source y (optional)
     * @param {number} sw - Source width (optional)
     * @param {number} sh - Source height (optional)
     * @param {number} dx - Destination x
     * @param {number} dy - Destination y
     * @param {number} dw - Destination width (optional)
     * @param {number} dh - Destination height (optional)
     */
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
        this._requireActiveOp();

        // Wrap the actual image drawing logic with shadow pipeline
        ShadowPipeline.renderWithShadow(this, () => {
            this._drawImageInternal.apply(this, arguments);
        });
    }

    /**
     * Internal image drawing logic (without shadow processing)
     * @param {Object} img - ImageLike object to draw
     * @param {number} sx - Source x (optional)
     * @param {number} sy - Source y (optional)
     * @param {number} sw - Source width (optional)
     * @param {number} sh - Source height (optional)
     * @param {number} dx - Destination x
     * @param {number} dy - Destination y
     * @param {number} dw - Destination width (optional)
     * @param {number} dh - Destination height (optional)
     * @private
     */
    _drawImageInternal(img, sx, sy, sw, sh, dx, dy, dw, dh) {
        // Validate and convert ImageLike (handles RGB→RGBA conversion)
        const imageData = ImageProcessor.validateAndConvert(img);

        // Handle different parameter combinations
        let sourceX, sourceY, sourceWidth, sourceHeight;
        let destX, destY, destWidth, destHeight;

        if (arguments.length === 3) {
            // drawImage(image, dx, dy)
            sourceX = 0;
            sourceY = 0;
            sourceWidth = imageData.width;
            sourceHeight = imageData.height;
            destX = sx; // Actually dx
            destY = sy; // Actually dy
            destWidth = sourceWidth;
            destHeight = sourceHeight;
        } else if (arguments.length === 5) {
            // drawImage(image, dx, dy, dw, dh)
            sourceX = 0;
            sourceY = 0;
            sourceWidth = imageData.width;
            sourceHeight = imageData.height;
            destX = sx; // Actually dx
            destY = sy; // Actually dy
            destWidth = sw; // Actually dw
            destHeight = sh; // Actually dh
        } else if (arguments.length === 9) {
            // drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
            sourceX = sx;
            sourceY = sy;
            sourceWidth = sw;
            sourceHeight = sh;
            destX = dx;
            destY = dy;
            destWidth = dw;
            destHeight = dh;
        } else {
            throw new Error('Invalid number of arguments for drawImage');
        }

        // Validate source rectangle bounds
        if (
            sourceX < 0 ||
            sourceY < 0 ||
            sourceX + sourceWidth > imageData.width ||
            sourceY + sourceHeight > imageData.height
        ) {
            throw new Error('Source rectangle is outside image bounds');
        }

        // Apply transform to destination rectangle corners
        const transform = this._currentOp.transform;
        const topLeft = transform.transformPoint({ x: destX, y: destY });
        const topRight = transform.transformPoint({ x: destX + destWidth, y: destY });
        const bottomLeft = transform.transformPoint({ x: destX, y: destY + destHeight });
        const bottomRight = transform.transformPoint({ x: destX + destWidth, y: destY + destHeight });

        // Find bounding box in device space
        let minX = Math.max(0, Math.floor(Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)));
        let maxX = Math.min(
            this._surface.width - 1,
            Math.ceil(Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x))
        );
        let minY = Math.max(0, Math.floor(Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)));
        let maxY = Math.min(
            this._surface.height - 1,
            Math.ceil(Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y))
        );

        // Tier-0 rect clip (S3): clamp the iteration extent to the clip rect and
        // draw unconditionally (clipMask is null in this case). _clipRect is the
        // half-open [x0,x1)×[y0,y1) set of visible pixels — byte-identical to the
        // bitmask, which the inner loop would otherwise reject pixel-by-pixel.
        const clipRect = this._currentOp.clipRect;
        if (clipRect) {
            if (clipRect.x0 > minX) minX = clipRect.x0;
            if (clipRect.y0 > minY) minY = clipRect.y0;
            if (clipRect.x1 - 1 < maxX) maxX = clipRect.x1 - 1;
            if (clipRect.y1 - 1 < maxY) maxY = clipRect.y1 - 1;
        }

        // Get inverse transform for mapping device pixels back to source
        const inverseTransform = transform.invert();
        // Hoist the inverse-transform coefficients and apply them as scalars inside
        // the loop (destPoint = inv * (deviceX, deviceY)) so no {x,y} object is
        // allocated per pixel. Byte-identical to inverseTransform.transformPoint,
        // which computes a*x + c*y + e / b*x + d*y + f in exactly this order.
        const invA = inverseTransform.a, invB = inverseTransform.b, invC = inverseTransform.c;
        const invD = inverseTransform.d, invE = inverseTransform.e, invF = inverseTransform.f;

        const globalAlpha = this._currentOp.globalAlpha;
        const composite = this._currentOp.composite;
        const clipMask = this._currentOp.clipMask;
        // Resolve the composite op once. Fizzygum's blit traffic is 100% source-over,
        // so specialise it inline below (write-in-place, no per-pixel result object
        // and no string switch); every other op falls back to the general
        // CompositeOperations.blendPixel path, unchanged.
        const isSourceOver = (composite === 'source-over');
        const surfaceData = this._surface.data;
        const surfaceStride = this._surface.stride;
        const imgData = imageData.data;
        const imgWidth = imageData.width;
        const imgHeight = imageData.height;
        const destXMax = destX + destWidth;
        const destYMax = destY + destHeight;

        // Precompute source-to-dest scale factors. When destWidth === sourceWidth
        // (the same-size 1:1 blit, e.g., the per-glyph + scratch-to-main
        // drawImage calls BitmapText emits for colored text), the ratio is
        // exactly 1.0 in IEEE 754 and the inner-loop mapping reduces to
        // `sourceX + (destPoint.x - destX)` — bit-exact integer arithmetic.
        // Critical: do NOT compute the mapping as `(d / dW) * sW` inside the
        // loop. For many denominators (e.g. dW=191), `((d/191)*191)` rounds
        // to d−ε (e.g. 27.999...) for some integer d, then `Math.floor`
        // drops the result to d−1. That silently swaps the sampled source
        // column for an adjacent one — sometimes a transparent neighbour —
        // dropping or duplicating pixels in an FP-precision-of-the-denominator
        // pattern. Multiplication by a precomputed ratio sidesteps the issue
        // entirely.
        const xScale = (destWidth === sourceWidth) ? 1 : sourceWidth / destWidth;
        const yScale = (destHeight === sourceHeight) ? 1 : sourceHeight / destHeight;

        // Sampling policy: smooth (bilinear) whenever the draw actually
        // RESAMPLES the source; keep the historical nearest-neighbor sample,
        // byte-for-byte, when it does not. Two ways a draw resamples:
        //  - a NON-axis-aligned transform (rotation/skew): under rotation the
        //    floor-quantized NN sample point periodically lands on the texel
        //    BESIDE a thin source feature, so 1-2px features (hairline
        //    strokes, selection overlays) disintegrate into dashes. Bilinear
        //    cannot produce a pure-background gap along a continuous source
        //    feature — every nearby destination pixel blends it in. See
        //    debug/probe-rotated-thinline-gaps.js and tests/core/*bilinear*.
        //  - an axis-aligned draw whose EFFECTIVE SAMPLE STEP ≠ 1: the
        //    per-device-pixel source step is invA*xScale / invD*yScale — the
        //    CTM scale and the src/dst rect ratio COMPOSE (a ctx.scale with
        //    same-size rects and a rect-scaled blit under identity both
        //    resample; a scale(2) CTM drawing a physical-resolution buffer at
        //    half-size rects steps exactly 1 and does not). NN upscale
        //    duplicates rows/columns chunkily and downscale drops them;
        //    native smooths both (imageSmoothingEnabled defaults true).
        // Step-1 axis-aligned draws (every plain blit — glyphs, back buffers)
        // stay on the NN branch BY CONSTRUCTION, so their bytes cannot move.
        // imageSmoothingEnabled === false forces the NN branch for EVERY
        // transform — including rotation, per the HTML5 property's semantics
        // (the user's explicit opt-out, e.g. pixel art; it re-admits the
        // rotated thin-feature dashing bilinear exists to prevent).
        const smoothingEnabled = this._currentOp.imageSmoothingEnabled !== false;
        const stepX = invA * xScale;
        const stepY = invD * yScale;
        const useBilinear = smoothingEnabled &&
            (transform.b !== 0 || transform.c !== 0 || stepX !== 1 || stepY !== 1);
        // Bilinear samples at the DEST PIXEL CENTER (native semantics): the
        // corner-mapped destPoint below (kept for containment and for the NN
        // path, byte-compat) plus this constant device-space (0.5, 0.5) offset
        // pushed through the inverse transform. Texel centers live at +0.5, so
        // a 90°-style composite with integer translation lands samples exactly
        // ON texel centers -> the zero-fraction fast path -> crisp pure texels
        // (no blur), while arbitrary angles reconstruct without the half-texel
        // shift a floor-anchored kernel would smear into every resample.
        const centerOffX = (invA + invC) * 0.5;
        const centerOffY = (invB + invD) * 0.5;
        // Bilinear tap bounds: the texel range of the sx/sy/sw/sh source
        // sub-rect, clamped to the image. A tap OUTSIDE these bounds
        // contributes transparent black — never clamped edge content — so a
        // sub-rect blit cannot smear pixels that were never part of the
        // source rect.
        const tapMinX = Math.max(0, Math.floor(sourceX));
        const tapMaxX = Math.min(imgWidth - 1, Math.ceil(sourceX + sourceWidth) - 1);
        const tapMinY = Math.max(0, Math.floor(sourceY));
        const tapMaxY = Math.min(imgHeight - 1, Math.ceil(sourceY + sourceHeight) - 1);

        // Render each pixel in the bounding box
        for (let deviceY = minY; deviceY <= maxY; deviceY++) {
            for (let deviceX = minX; deviceX <= maxX; deviceX++) {
                // Check stencil clipping
                if (clipMask && this._isPixelClipped(deviceX, deviceY)) {
                    continue;
                }

                // Transform device pixel back to destination space (scalar form of
                // inverseTransform.transformPoint — same a*x+c*y+e / b*x+d*y+f order)
                const destPointX = invA * deviceX + invC * deviceY + invE;
                const destPointY = invB * deviceX + invD * deviceY + invF;

                let srcR, srcG, srcB, srcA;
                if (!useBilinear) {
                    // Check if we're inside the destination rectangle
                    // (corner-mapped point — the historical inclusion rule)
                    if (
                        destPointX < destX ||
                        destPointX >= destXMax ||
                        destPointY < destY ||
                        destPointY >= destYMax
                    ) {
                        continue;
                    }

                    // Map destination coordinates to source coordinates.
                    // See the xScale/yScale comment above for why this form is
                    // FP-stable in the same-size case.
                    const sourceXf = sourceX + (destPointX - destX) * xScale;
                    const sourceYf = sourceY + (destPointY - destY) * yScale;

                    // Nearest-neighbor sampling (axis-aligned transforms — the
                    // historical path, byte-for-byte)
                    const sourcePX = Math.floor(sourceXf);
                    const sourcePY = Math.floor(sourceYf);

                    // Bounds check for source coordinates
                    if (sourcePX < 0 || sourcePY < 0 || sourcePX >= imgWidth || sourcePY >= imgHeight) {
                        continue;
                    }

                    // Sample source pixel
                    const sourceOffset = (sourcePY * imgWidth + sourcePX) * 4;
                    srcR = imgData[sourceOffset];
                    srcG = imgData[sourceOffset + 1];
                    srcB = imgData[sourceOffset + 2];
                    srcA = imgData[sourceOffset + 3];
                } else {
                    // Bilinear: the DEST PIXEL CENTER (see centerOffX/Y above)
                    // drives BOTH containment and sampling — one convention per
                    // path. (Mixing corner containment with center sampling
                    // shifts the included window one pixel against the sampled
                    // window under a 90°-style transform, dropping an edge
                    // row/column.)
                    const centerPointX = destPointX + centerOffX;
                    const centerPointY = destPointY + centerOffY;
                    if (
                        centerPointX < destX ||
                        centerPointX >= destXMax ||
                        centerPointY < destY ||
                        centerPointY >= destYMax
                    ) {
                        continue;
                    }

                    // Put texel centers at +0.5 and split into floor texel +
                    // fractions. A sample landing exactly on a texel center has
                    // fractions 0/0 and takes the pure-texel fast path —
                    // bit-exact with a NN sample of that point.
                    const sampleXf = sourceX + (centerPointX - destX) * xScale;
                    const sampleYf = sourceY + (centerPointY - destY) * yScale;
                    const gx = sampleXf - 0.5;
                    const gy = sampleYf - 0.5;
                    const x0 = Math.floor(gx);
                    const y0 = Math.floor(gy);
                    const fx = gx - x0;
                    const fy = gy - y0;

                    if (fx === 0 && fy === 0) {
                        // Pure-texel fast path (zero-fraction exactness)
                        if (x0 < tapMinX || x0 > tapMaxX || y0 < tapMinY || y0 > tapMaxY) {
                            continue;
                        }
                        const sourceOffset = (y0 * imgWidth + x0) * 4;
                        srcR = imgData[sourceOffset];
                        srcG = imgData[sourceOffset + 1];
                        srcB = imgData[sourceOffset + 2];
                        srcA = imgData[sourceOffset + 3];
                    } else {
                        // Bilinear over the 4 neighboring texels, filtered
                        // PREMULTIPLIED: source texels are straight RGBA and fully
                        // transparent texels carry arbitrary RGB, so a straight-alpha
                        // lerp would bleed that RGB into edges (dark fringes). Weight
                        // each texel's RGB by its alpha, accumulate, un-premultiply at
                        // the end. Plain double arithmetic in a fixed accumulation
                        // order (00, 10, 01, 11) — byte-identical on V8 and JSC.
                        const x1 = x0 + 1;
                        const y1 = y0 + 1;
                        const w00 = (1 - fx) * (1 - fy);
                        const w10 = fx * (1 - fy);
                        const w01 = (1 - fx) * fy;
                        const w11 = fx * fy;
                        let aSum = 0, rSum = 0, gSum = 0, bSum = 0;
                        if (w00 !== 0 && x0 >= tapMinX && x0 <= tapMaxX && y0 >= tapMinY && y0 <= tapMaxY) {
                            const o = (y0 * imgWidth + x0) * 4;
                            const wa = w00 * imgData[o + 3];
                            if (wa !== 0) {
                                aSum += wa; rSum += wa * imgData[o]; gSum += wa * imgData[o + 1]; bSum += wa * imgData[o + 2];
                            }
                        }
                        if (w10 !== 0 && x1 >= tapMinX && x1 <= tapMaxX && y0 >= tapMinY && y0 <= tapMaxY) {
                            const o = (y0 * imgWidth + x1) * 4;
                            const wa = w10 * imgData[o + 3];
                            if (wa !== 0) {
                                aSum += wa; rSum += wa * imgData[o]; gSum += wa * imgData[o + 1]; bSum += wa * imgData[o + 2];
                            }
                        }
                        if (w01 !== 0 && x0 >= tapMinX && x0 <= tapMaxX && y1 >= tapMinY && y1 <= tapMaxY) {
                            const o = (y1 * imgWidth + x0) * 4;
                            const wa = w01 * imgData[o + 3];
                            if (wa !== 0) {
                                aSum += wa; rSum += wa * imgData[o]; gSum += wa * imgData[o + 1]; bSum += wa * imgData[o + 2];
                            }
                        }
                        if (w11 !== 0 && x1 >= tapMinX && x1 <= tapMaxX && y1 >= tapMinY && y1 <= tapMaxY) {
                            const o = (y1 * imgWidth + x1) * 4;
                            const wa = w11 * imgData[o + 3];
                            if (wa !== 0) {
                                aSum += wa; rSum += wa * imgData[o]; gSum += wa * imgData[o + 1]; bSum += wa * imgData[o + 2];
                            }
                        }
                        if (aSum === 0) continue; // all taps transparent
                        // Un-premultiply back to straight RGBA (the alpha weights
                        // cancel out of the RGB average).
                        srcR = Math.round(rSum / aSum);
                        srcG = Math.round(gSum / aSum);
                        srcB = Math.round(bSum / aSum);
                        srcA = Math.round(aSum);
                    }
                }

                // Apply global alpha
                const effectiveAlpha = (srcA / 255) * globalAlpha;
                const finalSrcA = Math.round(effectiveAlpha * 255);

                // Skip transparent pixels
                if (finalSrcA === 0) continue;

                const destOffset = deviceY * surfaceStride + deviceX * 4;

                if (isSourceOver) {
                    // Inline source-over, write in place — byte-identical to
                    // CompositeOperations._sourceOver (finalSrcA is already !== 0 here).
                    if (finalSrcA === 255) {
                        surfaceData[destOffset] = srcR;
                        surfaceData[destOffset + 1] = srcG;
                        surfaceData[destOffset + 2] = srcB;
                        surfaceData[destOffset + 3] = 255;
                    } else {
                        const dstA = surfaceData[destOffset + 3];
                        if (dstA === 0) {
                            surfaceData[destOffset] = srcR;
                            surfaceData[destOffset + 1] = srcG;
                            surfaceData[destOffset + 2] = srcB;
                            surfaceData[destOffset + 3] = finalSrcA;
                        } else {
                            const srcAlpha = finalSrcA / 255;
                            const invSrcAlpha = 1 - srcAlpha;
                            surfaceData[destOffset] = Math.round(srcR * srcAlpha + surfaceData[destOffset] * invSrcAlpha);
                            surfaceData[destOffset + 1] = Math.round(srcG * srcAlpha + surfaceData[destOffset + 1] * invSrcAlpha);
                            surfaceData[destOffset + 2] = Math.round(srcB * srcAlpha + surfaceData[destOffset + 2] * invSrcAlpha);
                            surfaceData[destOffset + 3] = Math.round(finalSrcA + dstA * invSrcAlpha);
                        }
                    }
                } else {
                    // Non-source-over: general path (unchanged)
                    const dstR = surfaceData[destOffset];
                    const dstG = surfaceData[destOffset + 1];
                    const dstB = surfaceData[destOffset + 2];
                    const dstA = surfaceData[destOffset + 3];
                    const result = CompositeOperations.blendPixel(
                        composite,
                        srcR,
                        srcG,
                        srcB,
                        finalSrcA, // source
                        dstR,
                        dstG,
                        dstB,
                        dstA // destination
                    );
                    surfaceData[destOffset] = result.r;
                    surfaceData[destOffset + 1] = result.g;
                    surfaceData[destOffset + 2] = result.b;
                    surfaceData[destOffset + 3] = result.a;
                }
            }
        }
    }
}

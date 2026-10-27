/**
 * Pattern class for SWCanvas
 *
 * Implements HTML5 Canvas pattern support with deterministic rendering.
 * Follows SWCanvas's immutable object-oriented design principles.
 *
 * Patterns are paint sources that tile ImageLike objects and can replace solid colors.
 * They work in canvas coordinate space and support repetition modes.
 *
 * A pattern samples its image by the same rule as drawImage: nearest-neighbour
 * when the device→image mapping does not resample (Rasterizer.imageResamples),
 * bilinear at the pixel centre (Rasterizer.filterBilinear) when it does and the
 * drawing context's imageSmoothingEnabled is true.
 */
class Pattern {
    /**
     * Create a Pattern
     * @param {Object} image - ImageLike object (canvas, surface, imagedata)
     * @param {string} repetition - Repetition mode: 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'
     */
    constructor(image, repetition = 'repeat') {
        // Validate and convert image to standard format. The pattern paints the
        // image as it is NOW (HTML5: modifying the image after createPattern must
        // not affect the pattern), so it keeps its own copy of the pixels — unless
        // the conversion already built a fresh buffer (RGB → RGBA).
        const imageData = ImageProcessor.validateAndConvert(image);
        this._imageData =
            imageData.data === image.data
                ? { width: imageData.width, height: imageData.height, data: new Uint8ClampedArray(imageData.data) }
                : imageData;

        // Validate repetition mode
        const validRepetitions = ['repeat', 'repeat-x', 'repeat-y', 'no-repeat'];
        if (!validRepetitions.includes(repetition)) {
            throw new Error(`Invalid repetition mode: ${repetition}. Must be one of: ${validRepetitions.join(', ')}`);
        }

        this._repetition = repetition;

        // Pattern-specific transform (initially identity)
        this._patternTransform = Transform2D.IDENTITY;

        // The imageSmoothingEnabled this pattern samples under (the HTML5 default).
        // A context draws with withSmoothing(its own flag).
        this._smoothing = true;

        this._sampling = Pattern._newSampling(this);

        Object.freeze(this);
    }

    /**
     * The per-pattern memo shared by a pattern and its smoothing twin: the
     * device→pattern inverse for the last canvas transform seen (see
     * _inverseFor) and its pixel-centre map (centreMapForDevice), whether that
     * mapping resamples, the twin patterns, and the filtered texel scratch.
     * Object.freeze is shallow: this memo stays writable while every observable
     * field of the pattern is frozen.
     * @param {Pattern} smoothed - The pattern sampling with smoothing on
     * @private
     */
    static _newSampling(smoothed) {
        return {
            canvasTransform: null,
            inverse: null,
            centre: null,
            resamples: false,
            smoothed: smoothed,
            unsmoothed: null,
            texel: { r: 0, g: 0, b: 0, a: 0 }
        };
    }

    /**
     * Set pattern transformation matrix
     * @param {Transform2D|DOMMatrix} matrix - Pattern transformation
     */
    setTransform(matrix) {
        if (matrix instanceof Transform2D) {
            // Create new Pattern with updated transform (immutable). It shares the
            // pixel snapshot.
            const newPattern = Object.create(Object.getPrototypeOf(this));
            newPattern._imageData = this._imageData;
            newPattern._repetition = this._repetition;
            newPattern._patternTransform = matrix;
            newPattern._smoothing = true;
            newPattern._sampling = Pattern._newSampling(newPattern);
            Object.freeze(newPattern);
            return newPattern;
        } else if (matrix && typeof matrix.a === 'number') {
            // DOMMatrix-like object
            const transform = new Transform2D([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]);
            return this.setTransform(transform);
        } else {
            throw new Error('Pattern transform must be a Transform2D or DOMMatrix-like object');
        }
    }

    /**
     * This pattern as sampled under the given imageSmoothingEnabled: itself when
     * the flag matches, else its twin — same pixels, repetition and transform,
     * created once and memoized, so binding the flag per draw allocates nothing.
     * @param {boolean} enabled - The drawing context's imageSmoothingEnabled
     * @returns {Pattern}
     */
    withSmoothing(enabled) {
        if (enabled === this._smoothing) return this;
        const sampling = this._sampling;
        if (enabled) return sampling.smoothed;
        if (sampling.unsmoothed === null) {
            const twin = Object.create(Object.getPrototypeOf(this));
            twin._imageData = this._imageData;
            twin._repetition = this._repetition;
            twin._patternTransform = this._patternTransform;
            twin._smoothing = false;
            twin._sampling = sampling;
            Object.freeze(twin);
            sampling.unsmoothed = twin;
        }
        return sampling.unsmoothed;
    }

    /**
     * Calculate color for a pixel position
     * @param {number} x - Pixel x coordinate in canvas space
     * @param {number} y - Pixel y coordinate in canvas space
     * @param {Transform2D} canvasTransform - Current canvas transform
     * @returns {Color} Color for this pixel
     */
    getColorForPixel(x, y, canvasTransform) {
        // The pixel centre, through the inverse pattern transform and then the
        // inverse canvas transform, into pattern image space; a non-invertible
        // transform paints nothing. Filtered or nearest per isFilteredUnder,
        // which is decided once per transform.
        const map = this.centreMapForDevice(canvasTransform);
        if (this._smoothing && this._sampling.resamples) {
            const texel = this._sampling.texel;
            if (!this.filterAt(map, x, y, texel)) return Color.transparent;
            return new Color(texel.r, texel.g, texel.b, texel.a);
        }
        const offset = this.sampleOffsetAt(map, x, y);
        if (offset < 0) return Color.transparent;
        const data = this._imageData.data;
        return new Color(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    }

    /**
     * Byte offset into `_imageData.data` for pattern-space coordinate (x, y),
     * applying the repetition + nearest-neighbour + clamp logic. Returns -1 when
     * the sample is transparent (a non-repeat axis out of bounds). Every device
     * pixel reaches it through `sampleOffsetAt` — ONE copy of the
     * sampling arithmetic, so the fill fast path is byte-identical to the
     * per-pixel path.
     * @private
     */
    _sampleOffset(x, y) {
        const width = this._imageData.width;
        const height = this._imageData.height;

        // Apply repetition logic
        let sampleX, sampleY;

        switch (this._repetition) {
            case 'repeat':
                sampleX = this._repeatCoordinate(x, width);
                sampleY = this._repeatCoordinate(y, height);
                break;

            case 'repeat-x':
                sampleX = this._repeatCoordinate(x, width);
                sampleY = y;
                if (y < 0 || y >= height) return -1; // Transparent
                break;

            case 'repeat-y':
                sampleX = x;
                sampleY = this._repeatCoordinate(y, height);
                if (x < 0 || x >= width) return -1; // Transparent
                break;

            case 'no-repeat':
                sampleX = x;
                sampleY = y;
                if (x < 0 || x >= width || y < 0 || y >= height) return -1; // Transparent
                break;
        }

        // Use nearest neighbor sampling (matching SWCanvas approach)
        const pixelX = Math.floor(sampleX);
        const pixelY = Math.floor(sampleY);

        // Clamp to image bounds (safety check)
        const clampedX = Math.max(0, Math.min(width - 1, pixelX));
        const clampedY = Math.max(0, Math.min(height - 1, pixelY));

        return (clampedY * width + clampedX) * 4;
    }

    /**
     * The CONSTANT device→pattern inverse transform for a fill, so the per-pixel
     * sampler doesn't recompute a matrix multiply + inversion for every pixel
     * (they are invariant across a fill). Returns null when the combined
     * transform is non-invertible, which paints nothing. Hoist this out of the
     * pixel loop.
     * @param {Transform2D} canvasTransform
     * @returns {Transform2D|null}
     */
    inverseForDevice(canvasTransform) {
        return this._inverseFor(canvasTransform);
    }

    /**
     * The map from a device pixel's INDEX (x, y) to the pattern-image point of
     * its CENTRE: the device→pattern inverse with the (0.5, 0.5) centre offset
     * folded into its translation (Rasterizer.centreTranslation — drawImage's
     * centre, so both sample at the same point). Cached with the inverse;
     * null when the transform is non-invertible, which paints nothing.
     * @param {Transform2D} canvasTransform
     * @returns {{a: number, b: number, c: number, d: number, e: number, f: number}|null}
     */
    centreMapForDevice(canvasTransform) {
        this._inverseFor(canvasTransform);
        return this._sampling.centre;
    }

    /**
     * Does a fill under this canvas transform take the FILTERED arm
     * (filterAt) rather than the nearest-neighbour one
     * (sampleOffsetAt)? True iff smoothing is on and the device→pattern
     * mapping resamples (Rasterizer.imageResamples) — decided once per
     * transform and cached with the inverse.
     * @param {Transform2D} canvasTransform
     * @returns {boolean}
     */
    isFilteredUnder(canvasTransform) {
        this._inverseFor(canvasTransform);
        return this._smoothing && this._sampling.resamples;
    }

    /**
     * The device→pattern inverse, cached per canvas transform OBJECT (the same
     * mechanism as Gradient._toGradientSpace): Transform2D is frozen, and so is
     * this pattern's own transform, so the cached inverse stays valid for as
     * long as the identity matches. Caches with it whether the mapping
     * resamples: its step per device pixel is the inverse's diagonal.
     * @private
     */
    _inverseFor(canvasTransform) {
        const sampling = this._sampling;
        if (sampling.canvasTransform !== canvasTransform) {
            sampling.canvasTransform = canvasTransform;
            try {
                const inverse = canvasTransform.multiply(this._patternTransform).invert();
                sampling.inverse = inverse;
                sampling.centre = {
                    a: inverse.a,
                    b: inverse.b,
                    c: inverse.c,
                    d: inverse.d,
                    e: Rasterizer.centreTranslation(inverse.a, inverse.c, inverse.e),
                    f: Rasterizer.centreTranslation(inverse.b, inverse.d, inverse.f)
                };
                sampling.resamples = Rasterizer.imageResamples(inverse.b, inverse.c, inverse.a, inverse.d);
            } catch (error) {
                sampling.inverse = null;
                sampling.centre = null;
                sampling.resamples = false;
            }
        }
        return sampling.inverse;
    }

    /**
     * Byte offset into `_imageData.data` of the texel under DEVICE pixel (x, y)'s
     * CENTRE (HTML5 semantics; drawImage's nearest neighbour), through the map
     * from `centreMapForDevice`. Returns -1 for a transparent sample (null
     * map, or a non-repeat axis out of bounds). `getColorForPixel` samples
     * through this too, so both paths read the same texel.
     * @param {Object|null} map - From centreMapForDevice
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    sampleOffsetAt(map, x, y) {
        if (map === null) return -1;
        const px = map.a * x + map.c * y + map.e;
        const py = map.b * x + map.d * y + map.f;
        return this._sampleOffset(px, py);
    }

    /**
     * The bilinearly filtered paint of DEVICE pixel (x, y): its centre mapped
     * through the map from `centreMapForDevice`, the four texels
     * around it filtered by Rasterizer.filterBilinear — drawImage's filter. The
     * edge rule is the pattern's own: a tap on a repeating axis wraps to the
     * opposite edge of the image, and a tap beyond the image on a non-repeating
     * axis is transparent (where drawImage clamps to the edge texel), so a
     * 'no-repeat' image fades out over half a texel at its border.
     * `getColorForPixel` filters through this too, so both paths take the same
     * filtered texel.
     * @param {Object} map - From centreMapForDevice; non-null (a singular
     *   transform never resamples)
     * @param {number} x
     * @param {number} y
     * @param {{r: number, g: number, b: number, a: number}} out - Receives the
     *   filtered straight RGBA
     * @returns {boolean} false (out untouched) when the sample is transparent
     */
    filterAt(map, x, y, out) {
        // Texel centres sit at +0.5: split into the top-left tap and fractions.
        const gx = map.a * x + map.c * y + map.e - 0.5;
        const gy = map.b * x + map.d * y + map.f - 0.5;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const fx = gx - x0;
        const fy = gy - y0;
        const width = this._imageData.width;
        const height = this._imageData.height;
        const repetition = this._repetition;

        let tx0, tx1, wx0, wx1;
        if (repetition === 'repeat' || repetition === 'repeat-x') {
            tx0 = x0 % width;
            if (tx0 < 0) tx0 += width;
            tx1 = tx0 + 1 === width ? 0 : tx0 + 1;
            wx0 = 1 - fx;
            wx1 = fx;
        } else {
            wx0 = x0 >= 0 && x0 < width ? 1 - fx : 0;
            wx1 = x0 + 1 >= 0 && x0 + 1 < width ? fx : 0;
            if (wx0 === 0 && wx1 === 0) return false;
            tx0 = x0 < 0 ? 0 : x0 < width ? x0 : width - 1;
            tx1 = x0 + 1 < 0 ? 0 : x0 + 1 < width ? x0 + 1 : width - 1;
        }

        let ty0, ty1, wy0, wy1;
        if (repetition === 'repeat' || repetition === 'repeat-y') {
            ty0 = y0 % height;
            if (ty0 < 0) ty0 += height;
            ty1 = ty0 + 1 === height ? 0 : ty0 + 1;
            wy0 = 1 - fy;
            wy1 = fy;
        } else {
            wy0 = y0 >= 0 && y0 < height ? 1 - fy : 0;
            wy1 = y0 + 1 >= 0 && y0 + 1 < height ? fy : 0;
            if (wy0 === 0 && wy1 === 0) return false;
            ty0 = y0 < 0 ? 0 : y0 < height ? y0 : height - 1;
            ty1 = y0 + 1 < 0 ? 0 : y0 + 1 < height ? y0 + 1 : height - 1;
        }

        return Rasterizer.filterBilinear(this._imageData.data, width, tx0, tx1, ty0, ty1, wx0, wx1, wy0, wy1, out);
    }

    /**
     * Apply repeat logic to a coordinate
     * @param {number} coord - Input coordinate
     * @param {number} size - Pattern dimension size
     * @returns {number} Repeated coordinate
     * @private
     */
    _repeatCoordinate(coord, size) {
        if (size === 0) return 0;

        let result = coord % size;
        if (result < 0) {
            result += size; // Handle negative coordinates
        }
        return result;
    }

    /**
     * Get pattern dimensions
     * @returns {Object} {width, height} of pattern
     */
    getDimensions() {
        return {
            width: this._imageData.width,
            height: this._imageData.height
        };
    }

    /**
     * Get repetition mode
     * @returns {string} Current repetition mode
     */
    getRepetition() {
        return this._repetition;
    }

    /**
     * Get current pattern transform
     * @returns {Transform2D} Current pattern transform
     */
    getTransform() {
        return this._patternTransform;
    }

    /**
     * Create a pattern from a Surface object
     * @param {Surface} surface - Source surface
     * @param {string} repetition - Repetition mode
     * @returns {Pattern} New pattern instance
     */
    static fromSurface(surface, repetition = 'repeat') {
        const imageData = ImageProcessor.surfaceToImageLike(surface);
        return new Pattern(imageData, repetition);
    }

    /**
     * Create a solid color pattern (useful for testing)
     * @param {number} width - Pattern width
     * @param {number} height - Pattern height
     * @param {Color|Array} color - Fill color
     * @param {string} repetition - Repetition mode
     * @returns {Pattern} New solid pattern
     */
    static createSolid(width, height, color, repetition = 'repeat') {
        const imageData = ImageProcessor.createBlankImage(width, height, color);
        return new Pattern(imageData, repetition);
    }
}

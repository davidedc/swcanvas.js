/**
 * Pattern class for SWCanvas
 *
 * Implements HTML5 Canvas pattern support with deterministic rendering.
 * Follows SWCanvas's immutable object-oriented design principles.
 *
 * Patterns are paint sources that tile ImageLike objects and can replace solid colors.
 * They work in canvas coordinate space and support repetition modes.
 */
class Pattern {
    /**
     * Create a Pattern
     * @param {Object} image - ImageLike object (canvas, surface, imagedata)
     * @param {string} repetition - Repetition mode: 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'
     */
    constructor(image, repetition = 'repeat') {
        // Validate and convert image to standard format
        this._imageData = ImageProcessor.validateAndConvert(image);

        // Validate repetition mode
        const validRepetitions = ['repeat', 'repeat-x', 'repeat-y', 'no-repeat'];
        if (!validRepetitions.includes(repetition)) {
            throw new Error(`Invalid repetition mode: ${repetition}. Must be one of: ${validRepetitions.join(', ')}`);
        }

        this._repetition = repetition;

        // Pattern-specific transform (initially identity)
        this._patternTransform = Transform2D.IDENTITY;

        Object.freeze(this);
    }

    /**
     * Set pattern transformation matrix
     * @param {Transform2D|DOMMatrix} matrix - Pattern transformation
     */
    setTransform(matrix) {
        if (matrix instanceof Transform2D) {
            // Create new Pattern with updated transform (immutable)
            const newPattern = Object.create(Object.getPrototypeOf(this));
            newPattern._imageData = this._imageData;
            newPattern._repetition = this._repetition;
            newPattern._patternTransform = matrix;
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
     * Calculate color for a pixel position
     * @param {number} x - Pixel x coordinate in canvas space
     * @param {number} y - Pixel y coordinate in canvas space
     * @param {Transform2D} canvasTransform - Current canvas transform
     * @returns {Color} Color for this pixel
     */
    getColorForPixel(x, y, canvasTransform) {
        // Apply inverse pattern transform, then inverse canvas transform
        // to map pixel coordinates to pattern image space
        try {
            const combinedTransform = canvasTransform.multiply(this._patternTransform);
            const inverseTransform = combinedTransform.invert();
            const patternPoint = inverseTransform.transformPoint(new Point(x, y));

            // Sample pattern image at calculated coordinates
            return this._samplePattern(patternPoint.x, patternPoint.y);
        } catch (error) {
            // If transform is not invertible, return transparent
            return Color.transparent;
        }
    }

    /**
     * Sample pattern image at given coordinates with repetition logic
     * @param {number} x - X coordinate in pattern space
     * @param {number} y - Y coordinate in pattern space
     * @returns {Color} Sampled color
     * @private
     */
    _samplePattern(x, y) {
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
                // Check if Y is out of bounds
                if (y < 0 || y >= height) {
                    return Color.transparent; // Transparent
                }
                break;

            case 'repeat-y':
                sampleX = x;
                sampleY = this._repeatCoordinate(y, height);
                // Check if X is out of bounds
                if (x < 0 || x >= width) {
                    return Color.transparent; // Transparent
                }
                break;

            case 'no-repeat':
                sampleX = x;
                sampleY = y;
                // Check if coordinates are out of bounds
                if (x < 0 || x >= width || y < 0 || y >= height) {
                    return Color.transparent; // Transparent
                }
                break;
        }

        // Use nearest neighbor sampling (matching SWCanvas approach)
        const pixelX = Math.floor(sampleX);
        const pixelY = Math.floor(sampleY);

        // Clamp to image bounds (safety check)
        const clampedX = Math.max(0, Math.min(width - 1, pixelX));
        const clampedY = Math.max(0, Math.min(height - 1, pixelY));

        // Sample pixel from image data
        const offset = (clampedY * width + clampedX) * 4;
        const r = this._imageData.data[offset];
        const g = this._imageData.data[offset + 1];
        const b = this._imageData.data[offset + 2];
        const a = this._imageData.data[offset + 3];

        return new Color(r, g, b, a);
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

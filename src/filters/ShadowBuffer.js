/**
 * ShadowBuffer class for SWCanvas
 *
 * Manages shadow rendering with extended bounds to handle blur overflow.
 * Uses sparse array storage for efficiency when shadows only cover part of the canvas.
 *
 * The shadow buffer extends beyond the original canvas bounds to accommodate
 * blur effects that spread pixels beyond the original shape boundary.
 */
class ShadowBuffer {
    /**
     * Create a ShadowBuffer
     * @param {number} width - Original surface width
     * @param {number} height - Original surface height
     * @param {number} maxBlurRadius - Maximum blur radius for bounds calculation
     */
    constructor(width, height, maxBlurRadius = 0) {
        // Validate parameters - these are internal assertions since ShadowBuffer
        // is only created by Context2D internally
        if (IS_DEBUG) {
            if (typeof width !== 'number' || !Number.isInteger(width) || width <= 0) {
                throw new Error('ShadowBuffer width must be a positive integer');
            }
            if (typeof height !== 'number' || !Number.isInteger(height) || height <= 0) {
                throw new Error('ShadowBuffer height must be a positive integer');
            }
            if (typeof maxBlurRadius !== 'number' || maxBlurRadius < 0) {
                throw new Error('ShadowBuffer maxBlurRadius must be a non-negative number');
            }
        }

        // Original surface dimensions
        this._originalWidth = width;
        this._originalHeight = height;
        this._maxBlurRadius = Math.ceil(maxBlurRadius);

        // Extended bounds to accommodate blur spillover
        const blurPadding = this._maxBlurRadius;
        this._extendedWidth = width + blurPadding * 2;
        this._extendedHeight = height + blurPadding * 2;
        this._extendedOffsetX = blurPadding;
        this._extendedOffsetY = blurPadding;

        // Sparse storage for alpha values (only stores non-zero pixels)
        // Key format: "x,y" -> alpha value (0-1)
        this._alphaData = {};

        // Bounds tracking for optimization using composition
        this._boundsTracker = new BoundsTracker();

        // Make properties immutable
        Object.defineProperty(this, 'originalWidth', { value: width, writable: false });
        Object.defineProperty(this, 'originalHeight', { value: height, writable: false });
        Object.defineProperty(this, 'extendedWidth', { value: this._extendedWidth, writable: false });
        Object.defineProperty(this, 'extendedHeight', { value: this._extendedHeight, writable: false });
        Object.defineProperty(this, 'extendedOffsetX', { value: this._extendedOffsetX, writable: false });
        Object.defineProperty(this, 'extendedOffsetY', { value: this._extendedOffsetY, writable: false });
    }

    /**
     * Add alpha value to the buffer at specified coordinates
     * @param {number} x - X coordinate (in original surface space)
     * @param {number} y - Y coordinate (in original surface space)
     * @param {number} alpha - Alpha value (0-1)
     */
    addAlpha(x, y, alpha) {
        if (alpha <= 0) return; // No need to store zero/negative alpha

        // Convert to extended buffer coordinates
        const extX = x + this._extendedOffsetX;
        const extY = y + this._extendedOffsetY;

        // Bounds check for extended buffer
        if (extX < 0 || extX >= this._extendedWidth || extY < 0 || extY >= this._extendedHeight) {
            return; // Outside extended bounds
        }

        const key = `${extX},${extY}`;

        // Accumulate alpha values (for overlapping shapes)
        const currentAlpha = this._alphaData[key] || 0;
        this._alphaData[key] = Math.min(1.0, currentAlpha + alpha);

        // Update bounds
        this._boundsTracker.updateBounds(extX, extY);
    }

    /**
     * Get alpha value at specified coordinates
     * @param {number} x - X coordinate (in extended buffer space)
     * @param {number} y - Y coordinate (in extended buffer space)
     * @returns {number} Alpha value (0-1)
     */
    getAlpha(x, y) {
        if (x < 0 || x >= this._extendedWidth || y < 0 || y >= this._extendedHeight) {
            return 0;
        }

        const key = `${x},${y}`;
        return this._alphaData[key] || 0;
    }

    /**
     * Set alpha value at specified coordinates
     * @param {number} x - X coordinate (in extended buffer space)
     * @param {number} y - Y coordinate (in extended buffer space)
     * @param {number} alpha - Alpha value (0-1)
     */
    setAlpha(x, y, alpha) {
        if (x < 0 || x >= this._extendedWidth || y < 0 || y >= this._extendedHeight) {
            return; // Outside bounds
        }

        const key = `${x},${y}`;

        if (alpha <= 0) {
            // Remove zero alpha values to keep sparse storage efficient
            delete this._alphaData[key];
        } else {
            this._alphaData[key] = Math.min(1.0, alpha);

            // Update bounds if needed
            this._boundsTracker.updateBounds(x, y);
        }
    }

    /**
     * Clear all alpha data
     */
    clear() {
        this._alphaData = {};
        this._boundsTracker.reset();
    }

    /**
     * Get bounding box of actual shadow data
     * @returns {Object} Bounds object with minX, maxX, minY, maxY, isEmpty
     */
    getBounds() {
        return this._boundsTracker.getBounds();
    }

    /**
     * Get all non-zero alpha pixels as an iterator
     * @returns {Iterator} Iterator over {x, y, alpha} objects
     */
    *getPixels() {
        for (const key in this._alphaData) {
            const alpha = this._alphaData[key];
            if (alpha > 0) {
                const coords = key.split(',');
                const x = parseInt(coords[0], 10);
                const y = parseInt(coords[1], 10);
                yield { x, y, alpha };
            }
        }
    }

    /**
     * Get the number of non-zero alpha pixels
     * @returns {number} Count of pixels with alpha > 0
     */
    getPixelCount() {
        let count = 0;
        for (const key in this._alphaData) {
            if (this._alphaData[key] > 0) {
                count++;
            }
        }
        return count;
    }

    /**
     * Create a copy of this shadow buffer
     * @returns {ShadowBuffer} New ShadowBuffer with copied data
     */
    clone() {
        const clone = new ShadowBuffer(this._originalWidth, this._originalHeight, this._maxBlurRadius);

        // Copy alpha data
        for (const key in this._alphaData) {
            clone._alphaData[key] = this._alphaData[key];
        }

        // Copy bounds
        clone._boundsTracker = this._boundsTracker.clone();

        return clone;
    }

    /**
     * Convert shadow buffer to a dense Float32Array for blur processing
     * @returns {Object} Object with {data: Float32Array, width, height, offsetX, offsetY}
     */
    toDenseArray() {
        // Only create dense array for the actual bounds (plus blur padding)
        if (this._boundsTracker.isEmpty()) {
            return {
                data: new Float32Array(0),
                width: 0,
                height: 0,
                offsetX: 0,
                offsetY: 0
            };
        }

        // Expand bounds by blur radius for blur processing
        const bounds = this._boundsTracker.getBounds();
        const padding = this._maxBlurRadius;
        const minX = Math.max(0, bounds.minX - padding);
        const maxX = Math.min(this._extendedWidth - 1, bounds.maxX + padding);
        const minY = Math.max(0, bounds.minY - padding);
        const maxY = Math.min(this._extendedHeight - 1, bounds.maxY + padding);

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const data = new Float32Array(width * height);

        // Copy sparse data to dense array
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const alpha = this.getAlpha(x, y);
                if (alpha > 0) {
                    const denseIndex = (y - minY) * width + (x - minX);
                    data[denseIndex] = alpha;
                }
            }
        }

        return {
            data: data,
            width: width,
            height: height,
            offsetX: minX,
            offsetY: minY
        };
    }

    /**
     * Update shadow buffer from dense array after blur processing
     * @param {Float32Array} data - Dense array data
     * @param {number} width - Dense array width
     * @param {number} height - Dense array height
     * @param {number} offsetX - Offset X in extended buffer space
     * @param {number} offsetY - Offset Y in extended buffer space
     */
    fromDenseArray(data, width, height, offsetX, offsetY) {
        // Clear existing data
        this.clear();

        // Copy dense data back to sparse storage
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const denseIndex = y * width + x;
                const alpha = data[denseIndex];

                if (alpha > 0) {
                    const extX = x + offsetX;
                    const extY = y + offsetY;
                    this.setAlpha(extX, extY, alpha);
                }
            }
        }
    }
}

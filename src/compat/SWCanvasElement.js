/**
 * SWCanvasElement
 *
 * HTML5 Canvas-compatible wrapper that mimics HTMLCanvasElement interface.
 * Provides width/height properties and getContext('2d') method.
 * Internally manages an SWCanvas Core Surface.
 */
class SWCanvasElement {
    constructor(width = 300, height = 150) {
        this._width = width;
        this._height = height;
        this._surface = new Surface(width, height);
        this._context = null;
    }

    /**
     * Get canvas width
     * @returns {number} Canvas width in pixels
     */
    get width() {
        return this._width;
    }

    /**
     * Set canvas width (recreates surface)
     * @param {number} value - New width in pixels
     */
    set width(value) {
        const newWidth = Math.max(1, Math.floor(value));
        if (newWidth !== this._width) {
            this._width = newWidth;
            this._recreateSurface();
        }
    }

    /**
     * Get canvas height
     * @returns {number} Canvas height in pixels
     */
    get height() {
        return this._height;
    }

    /**
     * Set canvas height (recreates surface)
     * @param {number} value - New height in pixels
     */
    set height(value) {
        const newHeight = Math.max(1, Math.floor(value));
        if (newHeight !== this._height) {
            this._height = newHeight;
            this._recreateSurface();
        }
    }

    /**
     * Get rendering context
     * @param {string} contextType - Must be '2d'
     * @returns {CanvasCompatibleContext2D} The 2D rendering context
     */
    getContext(contextType) {
        if (contextType !== '2d') {
            throw new Error('SWCanvas only supports 2d context');
        }

        if (!this._context) {
            this._context = new CanvasCompatibleContext2D(this._surface);
        }

        return this._context;
    }

    /**
     * Recreate surface with new dimensions
     * @private
     */
    _recreateSurface() {
        this._surface = new Surface(this._width, this._height);

        // Recreate context if it exists
        if (this._context) {
            this._context._updateSurface(this._surface);
        }
    }

    /**
     * Get surface for Core API access
     * Allows advanced users to access the underlying Surface directly
     * @returns {Surface} The underlying Surface object
     */
    get _coreSurface() {
        return this._surface;
    }

    /**
     * Get ImageData-like object for drawImage compatibility
     * @returns {Object} ImageData-like object with width, height, data
     */
    get _imageData() {
        return {
            width: this._width,
            height: this._height,
            data: this._surface.data
        };
    }

    /**
     * Get pixel data for ImageLike interface compatibility
     * Makes SWCanvasElement directly usable as an ImageLike object
     * @returns {Uint8ClampedArray} The pixel data
     */
    get data() {
        return this._surface.data;
    }

    /**
     * String representation for debugging
     * @returns {string} Canvas description
     */
    toString() {
        return `[object SWCanvasElement(${this._width}x${this._height})]`;
    }
}

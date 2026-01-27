/**
 * Color class for SWCanvas
 *
 * Encapsulates color operations, conversions, and alpha blending math.
 * Follows Joshua Bloch's principle of making classes immutable where practical.
 *
 * Internally uses premultiplied sRGB for consistency with HTML5 Canvas behavior.
 * Premultiplied form simplifies alpha compositing: result = src + dst*(1-srcA)
 * instead of requiring division during blending. API exposes non-premultiplied
 * values for user convenience; conversions happen transparently.
 */
class Color {
    /**
     * Create a Color instance
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)  
     * @param {number} b - Blue component (0-255)
     * @param {number} a - Alpha component (0-255)
     * @param {boolean} isPremultiplied - Whether values are already premultiplied
     */
    constructor(r, g, b, a = 255, isPremultiplied = false) {
        // Validate input ranges
        Validators.colorComponent(r, 'Red component');
        Validators.colorComponent(g, 'Green component');
        Validators.colorComponent(b, 'Blue component');
        Validators.colorComponent(a, 'Alpha component');

        if (isPremultiplied) {
            this._r = Math.round(r);
            this._g = Math.round(g);
            this._b = Math.round(b);
            this._a = Math.round(a);
        } else {
            // Convert to premultiplied form
            const alpha = a / 255;
            this._r = Math.round(r * alpha);
            this._g = Math.round(g * alpha);
            this._b = Math.round(b * alpha);
            this._a = Math.round(a);
        }
    }

    // Getters for premultiplied components (internal storage format)
    get premultipliedR() { return this._r; }
    get premultipliedG() { return this._g; }
    get premultipliedB() { return this._b; }
    get premultipliedA() { return this._a; }

    // Getters for non-premultiplied components (API-friendly)
    get r() {
        if (this._a === 0) return 0;
        if (this._a === 255) return this._r;
        return Math.round((this._r * 255) / this._a);
    }

    get g() {
        if (this._a === 0) return 0;
        if (this._a === 255) return this._g;
        return Math.round((this._g * 255) / this._a);
    }

    get b() {
        if (this._a === 0) return 0;
        if (this._a === 255) return this._b;
        return Math.round((this._b * 255) / this._a);
    }

    get a() {
        return this._a;
    }

    /**
     * Get non-premultiplied RGBA array
     * @returns {number[]} [r, g, b, a] array
     */
    toRGBA() {
        return [this.r, this.g, this.b, this.a];
    }

    /**
     * Get premultiplied RGBA array (internal storage format)
     * @returns {number[]} [r, g, b, a] array with RGB premultiplied
     */
    toPremultipliedRGBA() {
        return [this._r, this._g, this._b, this._a];
    }

    /**
     * Get alpha as normalized value (0-1)
     * @returns {number} Alpha in 0-1 range
     */
    get normalizedAlpha() {
        return this._a / 255;
    }

    /**
     * Check if color is fully transparent
     * @returns {boolean} True if alpha is 0
     */
    get isTransparent() {
        return this._a === 0;
    }

    /**
     * Check if color is fully opaque
     * @returns {boolean} True if alpha is 255
     */
    get isOpaque() {
        return this._a === 255;
    }

    /**
     * Apply global alpha to this color (immutable operation)
     * @param {number} globalAlpha - Alpha multiplier (0-1)
     * @returns {Color} New Color with applied global alpha
     */
    withGlobalAlpha(globalAlpha) {
        if (globalAlpha < 0 || globalAlpha > 1) {
            throw new Error('Global alpha must be in range 0-1');
        }

        // Work with non-premultiplied values to apply global alpha correctly
        const nonPremultR = this.r;
        const nonPremultG = this.g;
        const nonPremultB = this.b;
        const nonPremultA = this.a;

        const newAlpha = Math.round(nonPremultA * globalAlpha);
        return new Color(nonPremultR, nonPremultG, nonPremultB, newAlpha, false);
    }

    /**
     * Blend this color over another color using source-over composition
     * @param {Color} background - Background color to blend over
     * @returns {Color} New Color representing the blended result
     */
    blendOver(background) {
        if (this._a === 255) {
            // Source is opaque - return source
            return this;
        }

        if (this._a === 0) {
            // Source is transparent - return background
            return background;
        }

        // Standard premultiplied alpha blending
        const srcAlpha = this.normalizedAlpha;
        const invSrcAlpha = 1 - srcAlpha;

        const newR = Math.round(this._r + background._r * invSrcAlpha);
        const newG = Math.round(this._g + background._g * invSrcAlpha);
        const newB = Math.round(this._b + background._b * invSrcAlpha);
        const newA = Math.round(this._a + background._a * invSrcAlpha);

        return new Color(newR, newG, newB, newA, true);
    }

    /**
     * Convert color for BMP output (non-premultiplied RGB)
     * @returns {Object} {r, g, b} object for BMP encoding
     */
    toBMP() {
        return {
            r: this.r,
            g: this.g,
            b: this.b
        };
    }

    /**
     * Convert to CSS rgba() string
     * @returns {string} CSS rgba() format string
     */
    toCSS() {
        const alpha = (this.a / 255).toFixed(3).replace(/\.?0+$/, '');
        return `rgba(${this.r}, ${this.g}, ${this.b}, ${alpha})`;
    }

    /**
     * String representation for debugging
     * @returns {string} Color description
     */
    toString() {
        return `Color(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
    }

    /**
     * Check equality with another Color
     * @param {Color} other - Color to compare with
     * @returns {boolean} True if colors are equal
     */
    equals(other) {
        return other instanceof Color &&
            this._r === other._r &&
            this._g === other._g &&
            this._b === other._b &&
            this._a === other._a;
    }
}

// Static constant: transparent black
Color.transparent = new Color(0, 0, 0, 0);

// Static constant: opaque black
Color.black = new Color(0, 0, 0, 255);

/**
 * Create Color from CSS string using provided parser
 * @param {string} cssString - CSS color string
 * @param {ColorParser} parser - ColorParser instance
 * @returns {Color} New Color instance
 */
Color.fromCSS = function (cssString, parser) {
    if (!cssString || typeof cssString !== 'string') {
        throw new Error("Invalid color format: must be a string");
    }
    const parsed = parser.parse(cssString);
    return new Color(parsed.r, parsed.g, parsed.b, parsed.a, false);
};
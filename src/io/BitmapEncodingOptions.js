/**
 * BitmapEncodingOptions class for SWCanvas BitmapEncoder
 *
 * Provides configuration options for BMP encoding operations.
 * Follows immutable object-oriented design principles per Joshua Bloch's Effective Java.
 *
 * Key Features:
 * - Immutable options objects prevent accidental modification
 * - Static factory methods provide clear API
 * - Extensible design allows for future encoding options
 * - Type-safe configuration prevents parameter confusion
 */
class BitmapEncodingOptions {
    /**
     * Create BitmapEncodingOptions instance
     * @param {Object} backgroundColor - Background color for transparent pixel compositing
     * @param {number} backgroundColor.r - Red component (0-255)
     * @param {number} backgroundColor.g - Green component (0-255)
     * @param {number} backgroundColor.b - Blue component (0-255)
     */
    constructor(backgroundColor = { r: 255, g: 255, b: 255 }) {
        // Validate background color components
        Validators.defined(backgroundColor, 'backgroundColor');

        const { r, g, b } = backgroundColor;

        Validators.colorComponent(r, 'backgroundColor.r');
        Validators.colorComponent(g, 'backgroundColor.g');
        Validators.colorComponent(b, 'backgroundColor.b');

        // Store immutable background color
        this._backgroundColor = Object.freeze({
            r: Math.round(r),
            g: Math.round(g),
            b: Math.round(b)
        });

        // Make this instance immutable
        Object.freeze(this);
    }

    /**
     * Get background color for transparent pixel compositing
     * @returns {Object} {r, g, b} background color (0-255 range)
     */
    get backgroundColor() {
        return this._backgroundColor;
    }

    /**
     * Create options with specified background color
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {BitmapEncodingOptions} New options instance
     */
    static withBackgroundColor(r, g, b) {
        return new BitmapEncodingOptions({ r, g, b });
    }

    /**
     * Create options with white background (default)
     * @returns {BitmapEncodingOptions} Options with white background
     */
    static withWhiteBackground() {
        return new BitmapEncodingOptions({ r: 255, g: 255, b: 255 });
    }

    /**
     * Create options with black background
     * @returns {BitmapEncodingOptions} Options with black background
     */
    static withBlackBackground() {
        return new BitmapEncodingOptions({ r: 0, g: 0, b: 0 });
    }

    /**
     * Create options with gray background
     * @param {number} intensity - Gray intensity (0-255, default 128)
     * @returns {BitmapEncodingOptions} Options with gray background
     */
    static withGrayBackground(intensity = 128) {
        return new BitmapEncodingOptions({ r: intensity, g: intensity, b: intensity });
    }

    /**
     * Check if two options instances are equal
     * @param {BitmapEncodingOptions} other - Other options to compare
     * @returns {boolean} True if options are equivalent
     */
    equals(other) {
        if (!(other instanceof BitmapEncodingOptions)) {
            return false;
        }

        const bg1 = this._backgroundColor;
        const bg2 = other._backgroundColor;

        return bg1.r === bg2.r && bg1.g === bg2.g && bg1.b === bg2.b;
    }

    /**
     * Get string representation for debugging
     * @returns {string} String representation
     */
    toString() {
        const bg = this._backgroundColor;
        return `BitmapEncodingOptions(backgroundColor: rgb(${bg.r}, ${bg.g}, ${bg.b}))`;
    }
}

// Default options instance - white background (maintains backward compatibility)
BitmapEncodingOptions.DEFAULT = new BitmapEncodingOptions();

/**
 * PngEncodingOptions class for SWCanvas PngEncoder
 *
 * Provides configuration options for PNG encoding operations.
 * Follows immutable object-oriented design principles per Joshua Bloch's Effective Java.
 *
 * Key Features:
 * - Immutable options objects prevent accidental modification
 * - Static factory methods provide clear API
 * - Extensible design allows for future encoding options
 * - Type-safe configuration prevents parameter confusion
 * - Simpler than BitmapEncodingOptions since PNG supports transparency natively
 */
class PngEncodingOptions {
    /**
     * Create PngEncodingOptions instance
     * @param {Object} config - Configuration object
     * @param {boolean} config.preserveTransparency - Whether to preserve transparency (default: true)
     * @param {number} config.compressionLevel - 0 = no compression (stored blocks); 1-9 = DEFLATE, a higher level
     *     searching longer for matches (default: PngEncodingOptions.DEFAULT_COMPRESSION_LEVEL)
     */
    constructor(config = {}) {
        // Set defaults
        const { preserveTransparency = true, compressionLevel = PngEncodingOptions.DEFAULT_COMPRESSION_LEVEL } = config;

        // Validate parameters
        if (typeof preserveTransparency !== 'boolean') {
            throw new Error('preserveTransparency must be a boolean');
        }

        Validators.range(compressionLevel, 'compressionLevel', 0, 9);
        if (!Number.isInteger(compressionLevel)) {
            throw new Error('compressionLevel must be an integer');
        }

        // Store immutable configuration
        this._config = Object.freeze({
            preserveTransparency,
            compressionLevel
        });

        // Make this instance immutable
        Object.freeze(this);
    }

    /**
     * Get whether transparency should be preserved
     * @returns {boolean} True if transparency is preserved
     */
    get preserveTransparency() {
        return this._config.preserveTransparency;
    }

    /**
     * Get compression level
     * @returns {number} Compression level (0 = stored blocks, 1-9 = DEFLATE)
     */
    get compressionLevel() {
        return this._config.compressionLevel;
    }

    /**
     * Create default options (transparency preserved, DEFAULT_COMPRESSION_LEVEL)
     * @returns {PngEncodingOptions} Default options instance
     */
    static withDefaults() {
        return new PngEncodingOptions();
    }

    /**
     * Create options with transparency preserved (default behavior)
     * @returns {PngEncodingOptions} Options with transparency preserved
     */
    static withTransparency() {
        return new PngEncodingOptions({ preserveTransparency: true });
    }

    /**
     * Create options for opaque images (transparency ignored)
     * Note: This doesn't affect the PNG format (still RGBA), but may be useful for future optimizations
     * @returns {PngEncodingOptions} Options for opaque images
     */
    static withoutTransparency() {
        return new PngEncodingOptions({ preserveTransparency: false });
    }

    /**
     * Create options with specific compression level
     * @param {number} level - Compression level (0 = stored blocks, 1-9 = DEFLATE)
     * @returns {PngEncodingOptions} Options with specified compression level
     */
    static withCompressionLevel(level) {
        return new PngEncodingOptions({ compressionLevel: level });
    }

    /**
     * Create options for maximum compatibility (no compression, preserve transparency)
     * @returns {PngEncodingOptions} Maximum compatibility options
     */
    static forMaximumCompatibility() {
        return new PngEncodingOptions({
            preserveTransparency: true,
            compressionLevel: 0
        });
    }

    /**
     * Check if two options instances are equal
     * @param {PngEncodingOptions} other - Other options to compare
     * @returns {boolean} True if options are equivalent
     */
    equals(other) {
        if (!(other instanceof PngEncodingOptions)) {
            return false;
        }

        const config1 = this._config;
        const config2 = other._config;

        return (
            config1.preserveTransparency === config2.preserveTransparency &&
            config1.compressionLevel === config2.compressionLevel
        );
    }

    /**
     * Get string representation for debugging
     * @returns {string} String representation
     */
    toString() {
        const config = this._config;
        return `PngEncodingOptions(transparency: ${config.preserveTransparency}, compression: ${config.compressionLevel})`;
    }

    /**
     * Create a new options instance with modified transparency setting
     * @param {boolean} preserveTransparency - Whether to preserve transparency
     * @returns {PngEncodingOptions} New options instance
     */
    withTransparency(preserveTransparency) {
        return new PngEncodingOptions({
            preserveTransparency,
            compressionLevel: this._config.compressionLevel
        });
    }

    /**
     * Create a new options instance with modified compression level
     * @param {number} compressionLevel - Compression level (0 = stored blocks, 1-9 = DEFLATE)
     * @returns {PngEncodingOptions} New options instance
     */
    withCompression(compressionLevel) {
        return new PngEncodingOptions({
            preserveTransparency: this._config.preserveTransparency,
            compressionLevel
        });
    }
}

// The level a default options instance encodes at (see PngEncoder.MAX_CHAIN)
PngEncodingOptions.DEFAULT_COMPRESSION_LEVEL = 6;
// Default options instance - preserve transparency, DEFAULT_COMPRESSION_LEVEL
PngEncodingOptions.DEFAULT = new PngEncodingOptions();

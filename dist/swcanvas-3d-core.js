(function() {
'use strict';

/**
 * Centralized constants for SWCanvas.
 * Loaded first in build order - available to all modules.
 *
 * DESIGN PRINCIPLE:
 * The purpose of extracting magic numbers is to give semantic meaning to values
 * that would otherwise be opaque. A constant should answer "what is this value's
 * PURPOSE?" not just "what is this value?"
 *
 * Examples:
 * - FILL_EPSILON = 0.0001      → Good: the name explains WHY this threshold exists
 * - TAU = 2 * Math.PI          → Good: represents "one full turn", a distinct concept
 * - PI = Math.PI               → Bad: just an alias, Math.PI is already perfectly clear
 *
 * We intentionally use Math.PI directly throughout the codebase because it is
 * universally recognized, self-documenting JavaScript.
 */
class SWCanvasConstants {
    // ═══════════════════════════════════════════════════════════════════════
    // CORE GEOMETRY CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    /** Floating-point near-zero threshold for degenerate case detection */
    static FLOAT_EPSILON = 1e-10;

    /** Epsilon for axis-aligned detection in transforms (~0.057 degrees) */
    static TRANSFORM_EPSILON = 0.0001;

    // ═══════════════════════════════════════════════════════════════════════
    // ANGLE CONSTANTS (radians)
    // ═══════════════════════════════════════════════════════════════════════

    /** Full circle: 2π radians (360°) */
    static TAU = 2 * Math.PI;

    /** Quarter turn: π/2 radians (90°) */
    static HALF_PI = Math.PI / 2;

    /** Three-quarter turn: 3π/2 radians (270°) */
    static THREE_HALF_PI = 1.5 * Math.PI;

    /** Eighth turn: π/4 radians (45°) */
    static QUARTER_PI = Math.PI / 4;

    /** Degrees to radians conversion factor: π/180 */
    static DEG_TO_RAD = Math.PI / 180;

    // ═══════════════════════════════════════════════════════════════════════
    // RENDERING TOLERANCES
    // ═══════════════════════════════════════════════════════════════════════

    /** Epsilon for fill boundary contraction to prevent speckles */
    static FILL_EPSILON = 0.0001;

    /** Tolerance for detecting effective 1px strokes */
    static STROKE_1PX_TOLERANCE = 0.001;

    /**
     * Snap threshold for Math.cos/Math.sin noise at quadrant boundaries.
     * The true value at 90°-multiples is exactly 0, but Math.cos(1.5*Math.PI) etc.
     * return ~±2e-16; when an arc plotter's center sits on integer coordinates that
     * noise lands exactly on a Math.floor() boundary and shifts the quadrant-endpoint
     * pixel one unit, tearing the junction where an arc meets a straight edge.
     */
    static QUADRANT_TRIG_EPSILON = 1e-12;

    /** Tolerance for axis-aligned rotation detection */
    static ANGLE_TOLERANCE = 0.001;

    /** Tolerance for detecting full circle arcs (arc span ≈ 2π) */
    static ARC_FULLCIRCLE_TOLERANCE = 1e-5;

    /** Minimum edge length worth processing */
    static MIN_EDGE_LENGTH = 0.5;

    /** Minimum edge length squared (for distance comparisons) */
    static MIN_EDGE_LENGTH_SQUARED = 0.25;

    /** Curve flattening tolerance for deterministic behavior */
    static PATH_FLATTENING_TOLERANCE = 0.25;

    // ═══════════════════════════════════════════════════════════════════════
    // LINE/STROKE THRESHOLDS
    // ═══════════════════════════════════════════════════════════════════════

    /** Threshold for thin line vs thick line rendering */
    static THIN_LINE_THRESHOLD = 1.5;

    /** Default miter limit ratio */
    static DEFAULT_MITER_LIMIT = 10.0;
}

// File-scope aliases for zero-overhead access (inlined by JIT compilers)
const FLOAT_EPSILON = SWCanvasConstants.FLOAT_EPSILON;
const TRANSFORM_EPSILON = SWCanvasConstants.TRANSFORM_EPSILON;
const TAU = SWCanvasConstants.TAU;
const HALF_PI = SWCanvasConstants.HALF_PI;
const THREE_HALF_PI = SWCanvasConstants.THREE_HALF_PI;
const QUARTER_PI = SWCanvasConstants.QUARTER_PI;
const DEG_TO_RAD = SWCanvasConstants.DEG_TO_RAD;
const FILL_EPSILON = SWCanvasConstants.FILL_EPSILON;
const STROKE_1PX_TOLERANCE = SWCanvasConstants.STROKE_1PX_TOLERANCE;
const QUADRANT_TRIG_EPSILON = SWCanvasConstants.QUADRANT_TRIG_EPSILON;
const ANGLE_TOLERANCE = SWCanvasConstants.ANGLE_TOLERANCE;
const ARC_FULLCIRCLE_TOLERANCE = SWCanvasConstants.ARC_FULLCIRCLE_TOLERANCE;
const MIN_EDGE_LENGTH = SWCanvasConstants.MIN_EDGE_LENGTH;
const MIN_EDGE_LENGTH_SQUARED = SWCanvasConstants.MIN_EDGE_LENGTH_SQUARED;
const PATH_FLATTENING_TOLERANCE = SWCanvasConstants.PATH_FLATTENING_TOLERANCE;
const THIN_LINE_THRESHOLD = SWCanvasConstants.THIN_LINE_THRESHOLD;
const DEFAULT_MITER_LIMIT = SWCanvasConstants.DEFAULT_MITER_LIMIT;

/**
 * Debug - Development utilities for SWCanvas
 *
 * These utilities are completely stripped in production builds by Terser.
 * The build script uses: --compress drop_console=true,drop_debugger=true,dead_code=true
 *
 * Enable debug mode in development:
 *   globalThis.__SWCANVAS_DEBUG__ = true;
 *   // Then load SWCanvas
 *
 * Debug mode provides:
 *   - Runtime assertions for contract verification
 *   - Debug logging for tracing execution
 *   - Clipping invariant validation
 */

/**
 * Check if debug mode is enabled.
 * @type {boolean}
 */
const IS_DEBUG = typeof globalThis !== 'undefined' && globalThis.__SWCANVAS_DEBUG__ === true;

/**
 * Assert a condition is true (development only).
 *
 * In production builds, this function is completely stripped by Terser's
 * dead code elimination since IS_DEBUG will be false and the early return
 * makes the rest unreachable.
 *
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message if condition fails
 */
function assertDebug(condition, message) {
    if (!IS_DEBUG) return;
    if (!condition) {
        console.error(`[SWCanvas] Assertion failed: ${message}`);
        debugger;
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Log a debug message (development only).
 *
 * Stripped in production builds.
 *
 * @param {string} message - Message to log
 */
function debugLog(message) {
    if (!IS_DEBUG) return;
    console.log(`[SWCanvas Debug] ${message}`);
}

/**
 * Log a debug warning (development only).
 *
 * Stripped in production builds.
 *
 * @param {string} message - Warning message to log
 */
function debugWarn(message) {
    if (!IS_DEBUG) return;
    console.warn(`[SWCanvas Debug] ${message}`);
}

/**
 * Validators class for SWCanvas
 *
 * Public API parameter validation utilities.
 * These validations REMAIN in production builds to ensure correct API usage.
 *
 * Following Joshua Bloch's principle of providing clear, descriptive error messages
 * to help users understand and fix invalid input.
 */
class Validators {
    /**
     * Validate that value is a number (not NaN)
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static number(value, name) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`${name} must be a valid number`);
        }
    }

    /**
     * Validate that value is a finite number
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static finiteNumber(value, name) {
        if (typeof value !== 'number' || !isFinite(value)) {
            throw new Error(`${name} must be a finite number`);
        }
    }

    /**
     * Validate that value is a non-negative number
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static nonNegative(value, name) {
        Validators.number(value, name);
        if (value < 0) {
            throw new Error(`${name} must be non-negative`);
        }
    }

    /**
     * Validate that value is a positive integer
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static positiveInteger(value, name) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
            throw new Error(`${name} must be a positive integer`);
        }
    }

    /**
     * Validate that value is a non-negative integer
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static nonNegativeInteger(value, name) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new Error(`${name} must be a non-negative integer`);
        }
    }

    /**
     * Validate that value is within a specified range
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     * @param {number} min - Minimum allowed value (inclusive)
     * @param {number} max - Maximum allowed value (inclusive)
     */
    static range(value, name, min, max) {
        Validators.number(value, name);
        if (value < min || value > max) {
            throw new Error(`${name} must be between ${min} and ${max}`);
        }
    }

    /**
     * Validate that value is a valid color component (0-255)
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static colorComponent(value, name) {
        if (typeof value !== 'number' || value < 0 || value > 255) {
            throw new Error(`${name} must be in range 0-255`);
        }
    }

    /**
     * Validate that value is a normalized value (0-1)
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static normalizedValue(value, name) {
        Validators.number(value, name);
        if (value < 0 || value > 1) {
            throw new Error(`${name} must be between 0 and 1`);
        }
    }

    /**
     * Validate rectangle parameters (all must be numbers)
     * @param {*} x - X coordinate
     * @param {*} y - Y coordinate
     * @param {*} width - Width
     * @param {*} height - Height
     */
    static rectParams(x, y, width, height) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle parameters must be numbers');
        }
    }

    /**
     * Validate that rectangle dimensions are finite
     * @param {*} x - X coordinate
     * @param {*} y - Y coordinate
     * @param {*} width - Width
     * @param {*} height - Height
     */
    static rectParamsFinite(x, y, width, height) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle parameters must be numbers');
        }
        if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height)) {
            throw new Error('Rectangle parameters must be finite numbers');
        }
    }

    /**
     * Validate that value is a string
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static string(value, name) {
        if (typeof value !== 'string') {
            throw new Error(`${name} must be a string`);
        }
    }

    /**
     * Validate that value is an array
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static array(value, name) {
        if (!Array.isArray(value)) {
            throw new Error(`${name} must be an array`);
        }
    }

    /**
     * Validate that value is an instance of a specified class
     * @param {*} value - Value to validate
     * @param {Function} expectedClass - Expected class constructor
     * @param {string} name - Parameter name for error message
     */
    static instanceOf(value, expectedClass, name) {
        if (!(value instanceof expectedClass)) {
            throw new Error(`${name} must be an instance of ${expectedClass.name}`);
        }
    }

    /**
     * Validate that value is defined (not null or undefined)
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static defined(value, name) {
        if (value === null || value === undefined) {
            throw new Error(`${name} must be defined`);
        }
    }
}

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
    get premultipliedR() {
        return this._r;
    }
    get premultipliedG() {
        return this._g;
    }
    get premultipliedB() {
        return this._b;
    }
    get premultipliedA() {
        return this._a;
    }

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
        return (
            other instanceof Color &&
            this._r === other._r &&
            this._g === other._g &&
            this._b === other._b &&
            this._a === other._a
        );
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
        throw new Error('Invalid color format: must be a string');
    }
    const parsed = parser.parse(cssString);
    return new Color(parsed.r, parsed.g, parsed.b, parsed.a, false);
};

/**
 * Surface class for SWCanvas
 *
 * Represents a 2D pixel surface with RGBA data storage.
 * Following Joshua Bloch's principle of proper class design with validation,
 * clear error messages, and immutable properties where sensible.
 *
 * Provides dual-view buffer access:
 * - data: Uint8ClampedArray for standard RGBA access (4 bytes per pixel)
 * - data32: Uint32Array view for optimized 32-bit packed writes (same underlying buffer)
 */
class Surface {
    /**
     * Create a Surface
     * @param {number} width - Surface width in pixels
     * @param {number} height - Surface height in pixels
     */
    constructor(width, height) {
        // Validate parameters with descriptive error messages
        Validators.positiveInteger(width, 'Surface width');
        Validators.positiveInteger(height, 'Surface height');

        // Check area first (SurfaceTooLarge takes precedence for test compatibility)
        if (width * height > 268435456) {
            // 16384 * 16384
            throw new Error('SurfaceTooLarge');
        }

        // Prevent memory issues with reasonable individual dimension limits
        const maxDimension = 16384;
        if (width > maxDimension || height > maxDimension) {
            throw new Error(`Surface dimensions must be ≤ ${maxDimension}x${maxDimension}`);
        }

        // Make dimensions immutable
        Object.defineProperty(this, 'width', { value: width, writable: false });
        Object.defineProperty(this, 'height', { value: height, writable: false });
        Object.defineProperty(this, 'stride', { value: width * 4, writable: false });

        // Allocate pixel data (RGBA, non-premultiplied)
        this.data = new Uint8ClampedArray(this.stride * height);

        // Uint32Array view for optimized opaque pixel writes (little-endian ABGR layout)
        // Shares same underlying ArrayBuffer - no additional memory cost
        // Use Surface.packColor() for correct byte ordering
        this.data32 = new Uint32Array(this.data.buffer);
    }

    /**
     * Pack RGBA color into 32-bit integer (little-endian: ABGR layout in memory)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} a - Alpha component (0-255), defaults to 255 (opaque)
     * @returns {number} Packed 32-bit color value
     */
    static packColor(r, g, b, a = 255) {
        return (a << 24) | (b << 16) | (g << 8) | r;
    }

    /**
     * Set pixel using pre-packed 32-bit color (optimized path)
     * No bounds checking - caller must ensure validity for performance
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} packedColor - Pre-packed 32-bit ABGR color from packColor()
     */
    setPixelPacked(pixelIndex, packedColor) {
        this.data32[pixelIndex] = packedColor;
    }

    /**
     * Set opaque pixel with individual RGB components (no alpha blending)
     * No bounds checking - caller must ensure validity for performance
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     */
    setPixelOpaque(pixelIndex, r, g, b) {
        this.data32[pixelIndex] = 0xff000000 | (b << 16) | (g << 8) | r;
    }

    /**
     * Fill horizontal span with packed color (optimized for scanline rendering)
     * No bounds checking - caller must ensure validity for performance
     * @param {number} startIndex - Starting linear pixel index
     * @param {number} length - Number of pixels to fill
     * @param {number} packedColor - Pre-packed 32-bit ABGR color from packColor()
     */
    fillSpanPacked(startIndex, length, packedColor) {
        const end = startIndex + length;
        const data32 = this.data32;
        for (let i = startIndex; i < end; i++) {
            data32[i] = packedColor;
        }
    }

    /**
     * Create a copy of this surface
     * @returns {Surface} New surface with copied data
     */
    clone() {
        const clone = new Surface(this.width, this.height);
        clone.data.set(this.data);
        return clone;
    }

    /**
     * Get pixel color at coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Color|null} Color at position, or null if out of bounds
     */
    getPixel(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null;
        }

        const offset = y * this.stride + x * 4;
        return new Color(
            this.data[offset],
            this.data[offset + 1],
            this.data[offset + 2],
            this.data[offset + 3],
            false // Non-premultiplied
        );
    }

    /**
     * Set pixel color at coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Color} color - Color to set
     */
    setPixel(x, y, color) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return; // Silently ignore out-of-bounds writes
        }

        if (!(color instanceof Color)) {
            throw new Error('Color must be a Color instance');
        }

        const offset = y * this.stride + x * 4;
        this.data[offset] = color.r;
        this.data[offset + 1] = color.g;
        this.data[offset + 2] = color.b;
        this.data[offset + 3] = color.a;
    }

    /**
     * Clear surface to specified color
     * Uses optimized 32-bit writes for better performance
     * @param {Color} color - Color to clear to (defaults to transparent)
     */
    clear(color = Color.transparent) {
        if (!(color instanceof Color)) {
            throw new Error('Color must be a Color instance');
        }

        const rgba = color.toRGBA();
        const packedColor = Surface.packColor(rgba[0], rgba[1], rgba[2], rgba[3]);
        const data32 = this.data32;
        const pixelCount = this.width * this.height;

        // Use 32-bit writes - 4x fewer write operations than byte-by-byte
        for (let i = 0; i < pixelCount; i++) {
            data32[i] = packedColor;
        }
    }

    /**
     * Get memory usage in bytes
     * @returns {number} Memory usage
     */
    getMemoryUsage() {
        return this.data.byteLength;
    }

    /**
     * String representation for debugging
     * @returns {string} Surface description
     */
    toString() {
        const memoryMB = (this.getMemoryUsage() / (1024 * 1024)).toFixed(2);
        return `Surface(${this.width}×${this.height}, ${memoryMB}MB)`;
    }
}

/**
 * DepthBuffer class for SWCanvas
 *
 * Per-pixel depth storage for 3D rasterization (Triangle3DOps and future
 * z-tested primitives). Enables correct rendering of interpenetrating
 * geometry without depth-sorting polygons.
 *
 * Depth Convention:
 * - Each pixel stores INVERSE camera-space depth (1/z), not z itself.
 *   For planar geometry 1/z is linear in screen space, so it can be
 *   interpolated with simple per-pixel increments during scanline fills.
 * - Larger stored value = nearer to the camera.
 * - clear() resets all pixels to 0 (infinitely far). Any geometry in front
 *   of the camera has z > 0, hence 1/z > 0, and passes the depth test
 *   against a cleared buffer.
 * - The depth test used by consumers is strictly greater-than (`>`):
 *   on equal depth the earlier write wins (deterministic).
 *
 * Memory Layout:
 * - Float32Array, one entry per pixel, row-major, index = y * width + x
 *   (same indexing as Surface.data32).
 */
class DepthBuffer {
    /**
     * Create a DepthBuffer
     * @param {number} width - Buffer width in pixels (must match target Surface)
     * @param {number} height - Buffer height in pixels (must match target Surface)
     */
    constructor(width, height) {
        if (typeof width !== 'number' || width <= 0 || !Number.isInteger(width)) {
            throw new Error('DepthBuffer width must be a positive integer');
        }
        if (typeof height !== 'number' || height <= 0 || !Number.isInteger(height)) {
            throw new Error('DepthBuffer height must be a positive integer');
        }

        // Make dimensions immutable
        Object.defineProperty(this, 'width', { value: width, writable: false });
        Object.defineProperty(this, 'height', { value: height, writable: false });

        /**
         * Raw depth storage (1/z per pixel). Direct access for hot loops
         * (dual-access pattern, same rationale as ClipMask.buffer).
         * @type {Float32Array}
         */
        this.data = new Float32Array(width * height);
    }

    /**
     * Reset the entire buffer to "infinitely far" (0).
     * Call once per frame before 3D rasterization.
     */
    clear() {
        this.data.fill(0);
    }

    /**
     * Reset a rectangular region to "infinitely far" (0).
     * Useful for re-rendering an embedded 3D viewport without touching
     * the rest of a shared full-surface depth buffer.
     * Coordinates are clamped to the buffer bounds.
     * @param {number} x - Left edge of region
     * @param {number} y - Top edge of region
     * @param {number} w - Region width in pixels
     * @param {number} h - Region height in pixels
     */
    clearRect(x, y, w, h) {
        const x0 = Math.max(0, Math.floor(x));
        const y0 = Math.max(0, Math.floor(y));
        const x1 = Math.min(this.width, Math.ceil(x + w));
        const y1 = Math.min(this.height, Math.ceil(y + h));

        // A rect fully left of the buffer leaves x1 negative after the one-sided
        // clamps; TypedArray.fill wraps a negative end to length+end, so bail on
        // empty extents before the loop (the off-surface span-wrap class).
        if (x1 <= x0 || y1 <= y0) return;

        for (let row = y0; row < y1; row++) {
            const rowStart = row * this.width;
            this.data.fill(0, rowStart + x0, rowStart + x1);
        }
    }

    /**
     * Get stored inverse depth for a pixel (debugging/tests; not for hot loops)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Stored 1/z value (0 = far/cleared)
     */
    getInvDepth(x, y) {
        return this.data[y * this.width + x];
    }

    /**
     * Get memory usage in bytes
     * @returns {number} Memory usage of the depth buffer
     */
    getMemoryUsage() {
        return this.data.byteLength;
    }

    /**
     * String representation for debugging
     * @returns {string} DepthBuffer description
     */
    toString() {
        const memoryMB = (this.getMemoryUsage() / (1024 * 1024)).toFixed(2);
        return `DepthBuffer(${this.width}×${this.height}, ${memoryMB}MB)`;
    }
}

/**
 * Texture3D class for SWCanvas
 *
 * Packed texture for the 3D rasterization primitives (Triangle3DOps).
 * Converts an ImageLike ({width, height, data: RGBA Uint8ClampedArray})
 * into a Uint32Array of pre-packed pixels in the same little-endian ABGR
 * word order as Surface.data32, so a textured span writes texels with a
 * single 32-bit store (no per-pixel packing or channel shuffling).
 *
 * Constraints:
 * - Width and height MUST be powers of two. Sampling uses mask-based
 *   wrap-around addressing: texelIndex = ((v & vMask) << shift) | (u & uMask),
 *   which makes out-of-range coordinates repeat the texture at zero cost.
 * - Sampling is nearest-neighbor (like Pattern; drawImage, by contrast,
 *   smooths whenever it resamples — see Rasterizer — while Texture3D stays NN).
 * - Texel alpha is written to the surface AS-IS by the 3D primitives (no
 *   blending); for normal opaque rendering author textures with alpha 255.
 *
 * UV convention (see Triangle3DOps): texel units, not normalized [0,1] —
 * u in [0, width), v in [0, height). Multiply normalized coordinates by
 * width/height before passing them in.
 */
class Texture3D {
    /**
     * Create a packed texture from an ImageLike
     * @param {Object} imageLike - {width, height, data} with RGBA data
     *   (data.length === width * height * 4), e.g. an ImageData
     */
    constructor(imageLike) {
        const width = imageLike.width;
        const height = imageLike.height;
        const data = imageLike.data;

        if (typeof width !== 'number' || width <= 0 || (width & (width - 1)) !== 0) {
            throw new Error(`Texture3D width must be a positive power of two, got ${width}`);
        }
        if (typeof height !== 'number' || height <= 0 || (height & (height - 1)) !== 0) {
            throw new Error(`Texture3D height must be a positive power of two, got ${height}`);
        }
        if (!data || data.length !== width * height * 4) {
            throw new Error(
                `Texture3D data must be RGBA with length width*height*4 (${width * height * 4}), got ${data ? data.length : 'none'}`
            );
        }

        // Make dimensions and addressing constants immutable
        Object.defineProperty(this, 'width', { value: width, writable: false });
        Object.defineProperty(this, 'height', { value: height, writable: false });
        /** Horizontal wrap mask (width - 1) */
        Object.defineProperty(this, 'uMask', { value: width - 1, writable: false });
        /** Vertical wrap mask (height - 1) */
        Object.defineProperty(this, 'vMask', { value: height - 1, writable: false });
        /** Row shift (log2(width)) for index computation */
        Object.defineProperty(this, 'shift', { value: Math.log2(width), writable: false });

        /**
         * Packed texels, same word order as Surface.data32.
         * Direct access for hot loops (dual-access pattern).
         * @type {Uint32Array}
         */
        this.data32 = new Uint32Array(width * height);
        for (let i = 0, p = 0; i < this.data32.length; i++, p += 4) {
            this.data32[i] = ((data[p + 3] << 24) | (data[p + 2] << 16) | (data[p + 1] << 8) | data[p]) >>> 0;
        }
    }

    /**
     * Get a pre-modulated ("lit") variant of this texture for a flat light
     * intensity, so hot span loops can copy texels instead of modulating
     * per pixel (Quake surface-cache idea, one intensity per whole face).
     *
     * Intensity is quantized to 32 steps (multiples of 8) and variants are
     * built lazily and cached, so repeated frames with stable lighting cost
     * nothing. Memory: up to 32 x texture size on heavily-varied lighting.
     *
     * Exactness: intensities that quantize to 256 return THIS texture
     * (identity, zero error). Other levels modulate each channel exactly
     * like the rasterizer would: (c * quantizedIntensity) >> 8. The only
     * approximation versus per-pixel modulation is the quantization step
     * (max 1/32 of full brightness), invisible for flat-shaded lighting.
     *
     * @param {number} intensity - Flat light, 0..256 (Triangle3DOps convention)
     * @returns {Texture3D|Object} A texture-like {data32, shift, uMask, vMask,
     *   width, height} sharing this texture's dimensions - pass to the
     *   textured fill methods with intensity 256
     */
    litVariant(intensity) {
        // Quantize to the nearest multiple of 8 (33 levels, 0..256)
        let level = (intensity + 4) >> 3;
        if (level < 0) level = 0;
        if (level > 32) level = 32;
        if (level === 32) {
            return this;
        }

        if (!this._litVariants) {
            this._litVariants = new Array(32);
        }
        let variant = this._litVariants[level];
        if (!variant) {
            const q = level << 3;
            variant = {
                width: this.width,
                height: this.height,
                uMask: this.uMask,
                vMask: this.vMask,
                shift: this.shift,
                data32: Texture3D._modulate(this.data32, q)
            };
            // Propagate the mip chain (if built) so lit rendering stays
            // minification-aware; level 0 shares the variant's own pixels
            if (this.mips) {
                variant.mips = this.mips.map((mipLevel, k) => ({
                    width: mipLevel.width,
                    height: mipLevel.height,
                    uMask: mipLevel.uMask,
                    vMask: mipLevel.vMask,
                    shift: mipLevel.shift,
                    data32: k === 0 ? variant.data32 : Texture3D._modulate(mipLevel.data32, q)
                }));
            }
            this._litVariants[level] = variant;
        }
        return variant;
    }

    /**
     * Modulate packed texels by a fixed-point intensity, exactly as the
     * rasterizer's per-pixel path would: (channel * q) >> 8, alpha kept.
     * @param {Uint32Array} src - Packed source texels
     * @param {number} q - Intensity 0..256
     * @returns {Uint32Array} New modulated texel array
     */
    static _modulate(src, q) {
        const lit = new Uint32Array(src.length);
        for (let i = 0; i < src.length; i++) {
            const texel = src[i];
            lit[i] =
                ((texel & 0xff000000) |
                    ((((((texel >> 16) & 0xff) * q) >> 8) & 0xff) << 16) |
                    ((((((texel >> 8) & 0xff) * q) >> 8) & 0xff) << 8) |
                    (((texel & 0xff) * q) >> 8)) >>>
                0;
        }
        return lit;
    }

    /**
     * Build the mip chain for minification-aware sampling by the
     * perspective-correct textured span (opt-in; adds ~33% memory).
     *
     * Levels halve each dimension (minimum 1) down to 1x1, box-filtered
     * (2x2 average with rounding). Power-of-two dimensions stay power-of-two
     * so wrap addressing keeps working at every level. Any cached lit
     * variants are invalidated so they rebuild with mips included - call
     * buildMips() right after construction, before rendering.
     *
     * @returns {Texture3D} this (chainable)
     */
    buildMips() {
        if (this.mips) {
            return this;
        }
        const levels = [
            {
                width: this.width,
                height: this.height,
                uMask: this.uMask,
                vMask: this.vMask,
                shift: this.shift,
                data32: this.data32
            }
        ];
        let prev = levels[0];
        while (prev.width > 1 || prev.height > 1) {
            const w = Math.max(1, prev.width >> 1);
            const h = Math.max(1, prev.height >> 1);
            const data32 = new Uint32Array(w * h);
            for (let y = 0; y < h; y++) {
                const y0 = Math.min(prev.height - 1, y * 2);
                const y1 = Math.min(prev.height - 1, y * 2 + 1);
                for (let x = 0; x < w; x++) {
                    const x0 = Math.min(prev.width - 1, x * 2);
                    const x1 = Math.min(prev.width - 1, x * 2 + 1);
                    const a = prev.data32[y0 * prev.width + x0];
                    const b = prev.data32[y0 * prev.width + x1];
                    const c = prev.data32[y1 * prev.width + x0];
                    const d = prev.data32[y1 * prev.width + x1];
                    data32[y * w + x] =
                        (((((a >>> 24) + (b >>> 24) + (c >>> 24) + (d >>> 24) + 2) >> 2) << 24) |
                            (((((a >> 16) & 0xff) + ((b >> 16) & 0xff) + ((c >> 16) & 0xff) + ((d >> 16) & 0xff) + 2) >>
                                2) <<
                                16) |
                            (((((a >> 8) & 0xff) + ((b >> 8) & 0xff) + ((c >> 8) & 0xff) + ((d >> 8) & 0xff) + 2) >>
                                2) <<
                                8) |
                            (((a & 0xff) + (b & 0xff) + (c & 0xff) + (d & 0xff) + 2) >> 2)) >>>
                        0;
                }
            }
            const level = {
                width: w,
                height: h,
                uMask: w - 1,
                vMask: h - 1,
                shift: Math.log2(w),
                data32: data32
            };
            levels.push(level);
            prev = level;
        }
        this.mips = levels;
        this._litVariants = null;
        return this;
    }

    /**
     * Get memory usage in bytes (base texture plus any cached lit variants)
     * @returns {number} Memory usage of the packed texture
     */
    getMemoryUsage() {
        let total = this.data32.byteLength;
        if (this._litVariants) {
            for (let i = 0; i < this._litVariants.length; i++) {
                if (this._litVariants[i]) total += this._litVariants[i].data32.byteLength;
            }
        }
        return total;
    }

    /**
     * String representation for debugging
     * @returns {string} Texture3D description
     */
    toString() {
        const memoryKB = (this.getMemoryUsage() / 1024).toFixed(1);
        return `Texture3D(${this.width}×${this.height}, ${memoryKB}KB)`;
    }
}

/**
 * Triangle3DOps - Static methods for depth-tested 3D triangle rasterization
 *
 * Low-level screen-space primitives for software 3D rendering, in the spirit
 * of PICO-8's tline: callers run their own 3D pipeline (transform, cull,
 * near-plane clip, project) and hand this class screen-space vertices with
 * inverse depth. The depth test against a DepthBuffer makes interpenetrating
 * geometry render correctly with no polygon sorting.
 *
 * NOT part of the Context2D pipeline: these methods write directly to a
 * Surface + DepthBuffer and deliberately ignore canvas transform, composite
 * modes and paint sources. The optional clipBuffer parameter follows the
 * same convention as SpanOps (1 bit per pixel, 1 = visible, null = no clip).
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): zFlatSpan - depth-tested opaque horizontal span
 * Layer 1 (Primitives): fillTriangleZ - scanline-fills a triangle via zFlatSpan
 *
 * DEPTH CONVENTION (see DepthBuffer):
 * -----------------------------------
 * Vertices carry INVERSE camera-space depth (invZ = 1/z, z > 0 in front of
 * the camera). For a planar triangle 1/z is linear in screen space, so it is
 * interpolated linearly per pixel. Test is strictly greater-than: a pixel is
 * written iff its invZ is greater (nearer) than the stored value.
 *
 * VERTEX CONTRACT:
 * ----------------
 * Callers MUST near-clip geometry before projecting: all three vertices must
 * have z > 0 (invZ > 0, finite coordinates). Vertices may project outside
 * the surface - spans are clamped to surface bounds here.
 *
 * FILL RULE:
 * ----------
 * Samples at integer coordinates with half-open intervals (grid-line
 * convention, consistent with QuadScanOps/PolygonFiller): scanlines cover
 * ceil(yMin) <= y < ceil(yMax), columns cover ceil(xL) <= x < ceil(xR).
 * Adjacent triangles sharing an edge are watertight: no gaps, no
 * double-written pixels.
 *
 * OPACITY:
 * --------
 * packedColor is written as-is (32-bit store, no blending). Use
 * Surface.packColor(r, g, b, 255). Semi-transparent 3D geometry would
 * require depth-sorting and is out of scope for this primitive.
 */
class Triangle3DOps {
    /**
     * Depth-tested opaque horizontal span with linear inverse-depth stepping.
     *
     * BOUNDS CONTRACT (same as SpanOps): trusts the caller.
     *   1. y must be in [0, surfaceHeight)
     *   2. startX must be >= 0 and startX + length <= surfaceWidth
     *   3. length must be > 0
     *
     * CLIPPING CONTRACT: clipping is handled here when clipBuffer is
     * provided (byte-skip for fully clipped bytes, 8-pixel fast path for
     * fully visible bytes). Callers MUST NOT pre-check clipping.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {Float32Array} depthData - DepthBuffer.data (1/z per pixel)
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (integer, >= 0)
     * @param {number} y - Y coordinate of the span (integer, in [0, surfaceHeight))
     * @param {number} length - Span length in pixels (> 0)
     * @param {number} invZ0 - Inverse depth (1/z) at the first pixel
     * @param {number} dInvZdX - Inverse depth increment per pixel (plane gradient)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color (opaque; written without blending)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here; gates color AND depth writes)
     */
    static zFlatSpan(
        data32,
        depthData,
        surfaceWidth,
        surfaceHeight,
        startX,
        y,
        length,
        invZ0,
        dInvZdX,
        packedColor,
        clipBuffer
    ) {
        if (IS_DEBUG) {
            if (y < 0 || y >= surfaceHeight || !Number.isInteger(y)) {
                throw new Error(`Triangle3DOps.zFlatSpan: y out of bounds: y=${y}, surfaceHeight=${surfaceHeight}`);
            }
            if (startX < 0 || !Number.isInteger(startX)) {
                throw new Error(`Triangle3DOps.zFlatSpan: invalid startX=${startX}, must be integer >= 0`);
            }
            if (startX + length > surfaceWidth) {
                throw new Error(
                    `Triangle3DOps.zFlatSpan: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`Triangle3DOps.zFlatSpan: invalid length: ${length}, must be > 0`);
            }
            if (depthData.length !== surfaceWidth * surfaceHeight) {
                throw new Error('Triangle3DOps.zFlatSpan: depthData size does not match surface dimensions');
            }
        }

        let pixelIndex = y * surfaceWidth + startX;
        const endIndex = pixelIndex + length;
        let invZ = invZ0;

        if (clipBuffer) {
            // With clipping - byte-skip fully clipped bytes, fast-path fully
            // visible bytes (3D viewports clipped to a widget are mostly
            // visible, so the 0xFF path is the common one).
            while (pixelIndex < endIndex) {
                const byteIndex = pixelIndex >> 3;
                const bits = clipBuffer[byteIndex];

                if (bits === 0) {
                    // Skip to next byte boundary (up to 8 fully clipped pixels)
                    const step = Math.min(((byteIndex + 1) << 3) - pixelIndex, endIndex - pixelIndex);
                    pixelIndex += step;
                    invZ += step * dInvZdX;
                    continue;
                }

                if (bits === 0xff && (pixelIndex & 7) === 0 && pixelIndex + 8 <= endIndex) {
                    // Fully visible byte - 8 pixels without per-pixel clip tests
                    for (let k = 0; k < 8; k++) {
                        if (invZ > depthData[pixelIndex]) {
                            depthData[pixelIndex] = invZ;
                            data32[pixelIndex] = packedColor;
                        }
                        invZ += dInvZdX;
                        pixelIndex++;
                    }
                    continue;
                }

                // Partial byte - per-pixel test
                if (bits & (1 << (pixelIndex & 7))) {
                    if (invZ > depthData[pixelIndex]) {
                        depthData[pixelIndex] = invZ;
                        data32[pixelIndex] = packedColor;
                    }
                }
                invZ += dInvZdX;
                pixelIndex++;
            }
        } else {
            // No clipping - optimized path
            for (; pixelIndex < endIndex; pixelIndex++) {
                if (invZ > depthData[pixelIndex]) {
                    depthData[pixelIndex] = invZ;
                    data32[pixelIndex] = packedColor;
                }
                invZ += dInvZdX;
            }
        }
    }

    /**
     * Fill a screen-space triangle with depth testing (flat color).
     *
     * Vertices are (x, y, invZ) with invZ = 1/z in camera space (see class
     * docs). Winding order does not matter - backface culling is the
     * caller's job. Degenerate (zero-area) triangles are ignored.
     *
     * @param {Surface} surface - Target surface
     * @param {DepthBuffer} depthBuffer - Depth buffer (must match surface dimensions)
     * @param {number} x0 - Vertex 0 screen X
     * @param {number} y0 - Vertex 0 screen Y
     * @param {number} invZ0 - Vertex 0 inverse depth (1/z, > 0)
     * @param {number} x1 - Vertex 1 screen X
     * @param {number} y1 - Vertex 1 screen Y
     * @param {number} invZ1 - Vertex 1 inverse depth (1/z, > 0)
     * @param {number} x2 - Vertex 2 screen X
     * @param {number} y2 - Vertex 2 screen Y
     * @param {number} invZ2 - Vertex 2 inverse depth (1/z, > 0)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color (opaque)
     * @param {Uint8Array|null} [clipBuffer=null] - Clip mask (CLIPPING: delegated to zFlatSpan)
     */
    static fillTriangleZ(
        surface,
        depthBuffer,
        x0,
        y0,
        invZ0,
        x1,
        y1,
        invZ1,
        x2,
        y2,
        invZ2,
        packedColor,
        clipBuffer = null
    ) {
        if (IS_DEBUG) {
            if (depthBuffer.width !== surface.width || depthBuffer.height !== surface.height) {
                throw new Error(
                    `Triangle3DOps.fillTriangleZ: depth buffer ${depthBuffer.width}×${depthBuffer.height} does not match surface ${surface.width}×${surface.height}`
                );
            }
            if (!(invZ0 > 0 && invZ1 > 0 && invZ2 > 0)) {
                throw new Error(
                    'Triangle3DOps.fillTriangleZ: all vertices must have invZ > 0 (near-clip before projecting)'
                );
            }
        }

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const depthData = depthBuffer.data;

        // Inverse-depth plane gradients (constant over the triangle since
        // 1/z is linear in screen space for planar geometry). area2 is the
        // doubled signed area; zero means degenerate.
        const bx = x1 - x0;
        const by = y1 - y0;
        const cx = x2 - x0;
        const cy = y2 - y0;
        const area2 = bx * cy - cx * by;
        if (area2 === 0) {
            return;
        }
        const invArea2 = 1 / area2;
        const dizB = invZ1 - invZ0;
        const dizC = invZ2 - invZ0;
        const dInvZdX = (dizB * cy - dizC * by) * invArea2;
        const dInvZdY = (bx * dizC - cx * dizB) * invArea2;

        // Sort vertices by Y (only x/y needed below; invZ comes from the plane)
        let xA = x0,
            yA = y0;
        let xB = x1,
            yB = y1;
        let xC = x2,
            yC = y2;
        let tmp;
        if (yA > yB) {
            tmp = xA;
            xA = xB;
            xB = tmp;
            tmp = yA;
            yA = yB;
            yB = tmp;
        }
        if (yA > yC) {
            tmp = xA;
            xA = xC;
            xC = tmp;
            tmp = yA;
            yA = yC;
            yC = tmp;
        }
        if (yB > yC) {
            tmp = xB;
            xB = xC;
            xC = tmp;
            tmp = yB;
            yB = yC;
            yC = tmp;
        }

        // Scanline range: half-open [ceil(yA), ceil(yC)), clamped to surface
        const yStart = Math.max(0, Math.ceil(yA));
        const yEnd = Math.min(height, Math.ceil(yC));
        if (yStart >= yEnd) {
            return;
        }

        // Edge slopes (dx per unit y). Long edge A->C always spans the full
        // Y range (yC > yA guaranteed: area2 !== 0 rules out all-equal Y).
        const slopeAC = (xC - xA) / (yC - yA);
        const slopeAB = yB !== yA ? (xB - xA) / (yB - yA) : 0; // unused when yB === yA
        const slopeBC = yC !== yB ? (xC - xB) / (yC - yB) : 0; // unused when yB === yC

        for (let y = yStart; y < yEnd; y++) {
            // X extents: long edge vs the active short edge (A->B covers
            // yA <= y < yB, B->C covers yB <= y < yC)
            let xL = xA + (y - yA) * slopeAC;
            let xR = y < yB ? xA + (y - yA) * slopeAB : xB + (y - yB) * slopeBC;
            if (xL > xR) {
                tmp = xL;
                xL = xR;
                xR = tmp;
            }

            // Half-open column range [ceil(xL), ceil(xR)), clamped
            const xs = Math.max(0, Math.ceil(xL));
            const xe = Math.min(width, Math.ceil(xR));
            const spanLength = xe - xs;
            if (spanLength <= 0) {
                continue;
            }

            // Inverse depth at the first pixel from the plane equation
            // (evaluated fresh per scanline - no incremental drift down edges)
            const invZRow = invZ0 + (xs - x0) * dInvZdX + (y - y0) * dInvZdY;

            Triangle3DOps.zFlatSpan(
                data32,
                depthData,
                width,
                height,
                xs,
                y,
                spanLength,
                invZRow,
                dInvZdX,
                packedColor,
                clipBuffer
            );
        }
    }

    /**
     * Depth-tested textured horizontal span with affine (u, v) stepping.
     *
     * The direct analog of PICO-8's tline: nearest-neighbor texel fetch with
     * per-pixel u/v increments and mask-based wrap-around addressing. The
     * texel is written AS-IS (32-bit store, no blending, no lighting); the
     * fetch is skipped entirely when the depth test rejects (early-z).
     *
     * BOUNDS CONTRACT: same as zFlatSpan (trusts the caller).
     * CLIPPING CONTRACT: same as zFlatSpan (handled here; gates color AND
     * depth writes; byte-skip + fully-visible fast paths).
     *
     * UV CONTRACT: texel units with u, v >= 0 (truncation via |0 is used,
     * which rounds toward zero — negative coordinates would wrap wrongly).
     * Wrapping is (u & uMask), (v & vMask) — the texture repeats.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {Float32Array} depthData - DepthBuffer.data (1/z per pixel)
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (integer, >= 0)
     * @param {number} y - Y coordinate of the span (integer, in [0, surfaceHeight))
     * @param {number} length - Span length in pixels (> 0)
     * @param {number} invZ0 - Inverse depth (1/z) at the first pixel
     * @param {number} dInvZdX - Inverse depth increment per pixel
     * @param {number} u0 - Texture u (texels) at the first pixel
     * @param {number} dUdX - u increment per pixel (affine plane gradient)
     * @param {number} v0 - Texture v (texels) at the first pixel
     * @param {number} dVdX - v increment per pixel (affine plane gradient)
     * @param {Uint32Array} tex32 - Packed texels (Texture3D.data32)
     * @param {number} texShift - log2 of texture width (Texture3D.shift)
     * @param {number} uMask - Texture width - 1 (Texture3D.uMask)
     * @param {number} vMask - Texture height - 1 (Texture3D.vMask)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here)
     */
    static zTexturedSpan(
        data32,
        depthData,
        surfaceWidth,
        surfaceHeight,
        startX,
        y,
        length,
        invZ0,
        dInvZdX,
        u0,
        dUdX,
        v0,
        dVdX,
        tex32,
        texShift,
        uMask,
        vMask,
        clipBuffer
    ) {
        if (IS_DEBUG) {
            if (y < 0 || y >= surfaceHeight || !Number.isInteger(y)) {
                throw new Error(`Triangle3DOps.zTexturedSpan: y out of bounds: y=${y}, surfaceHeight=${surfaceHeight}`);
            }
            if (startX < 0 || !Number.isInteger(startX)) {
                throw new Error(`Triangle3DOps.zTexturedSpan: invalid startX=${startX}, must be integer >= 0`);
            }
            if (startX + length > surfaceWidth) {
                throw new Error(
                    `Triangle3DOps.zTexturedSpan: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`Triangle3DOps.zTexturedSpan: invalid length: ${length}, must be > 0`);
            }
            if (tex32.length !== (uMask + 1) * (vMask + 1)) {
                throw new Error('Triangle3DOps.zTexturedSpan: texture size does not match masks');
            }
        }

        let pixelIndex = y * surfaceWidth + startX;
        const endIndex = pixelIndex + length;
        let invZ = invZ0;

        // Sub-texel bias: see zTexturedSpanPersp (guards integer-boundary
        // texel flips from float rounding)
        let u = u0 + 9.5367431640625e-7;
        let v = v0 + 9.5367431640625e-7;

        if (clipBuffer) {
            // With clipping - same three paths as zFlatSpan
            while (pixelIndex < endIndex) {
                const byteIndex = pixelIndex >> 3;
                const bits = clipBuffer[byteIndex];

                if (bits === 0) {
                    const step = Math.min(((byteIndex + 1) << 3) - pixelIndex, endIndex - pixelIndex);
                    pixelIndex += step;
                    invZ += step * dInvZdX;
                    u += step * dUdX;
                    v += step * dVdX;
                    continue;
                }

                if (bits === 0xff && (pixelIndex & 7) === 0 && pixelIndex + 8 <= endIndex) {
                    for (let k = 0; k < 8; k++) {
                        if (invZ > depthData[pixelIndex]) {
                            depthData[pixelIndex] = invZ;
                            data32[pixelIndex] = tex32[(((v | 0) & vMask) << texShift) | ((u | 0) & uMask)];
                        }
                        invZ += dInvZdX;
                        u += dUdX;
                        v += dVdX;
                        pixelIndex++;
                    }
                    continue;
                }

                if (bits & (1 << (pixelIndex & 7))) {
                    if (invZ > depthData[pixelIndex]) {
                        depthData[pixelIndex] = invZ;
                        data32[pixelIndex] = tex32[(((v | 0) & vMask) << texShift) | ((u | 0) & uMask)];
                    }
                }
                invZ += dInvZdX;
                u += dUdX;
                v += dVdX;
                pixelIndex++;
            }
        } else {
            // No clipping - optimized path
            for (; pixelIndex < endIndex; pixelIndex++) {
                if (invZ > depthData[pixelIndex]) {
                    depthData[pixelIndex] = invZ;
                    data32[pixelIndex] = tex32[(((v | 0) & vMask) << texShift) | ((u | 0) & uMask)];
                }
                invZ += dInvZdX;
                u += dUdX;
                v += dVdX;
            }
        }
    }

    /**
     * Fill a screen-space triangle with depth testing and affine texture
     * mapping (nearest-neighbor, wrap-around).
     *
     * Vertices are (x, y, invZ, u, v): screen position, inverse camera-space
     * depth (see class docs) and texture coordinates in TEXEL units (not
     * normalized; u in [0, texture.width), v in [0, texture.height), both
     * >= 0). Interpolation is AFFINE in screen space — perspective-correct
     * mapping (interpolating u/z, v/z) is a planned follow-up; affine warp
     * is visible on large triangles at steep angles, classic PS1 style.
     *
     * @param {Surface} surface - Target surface
     * @param {DepthBuffer} depthBuffer - Depth buffer (must match surface dimensions)
     * @param {number} x0 - Vertex 0 screen X
     * @param {number} y0 - Vertex 0 screen Y
     * @param {number} invZ0 - Vertex 0 inverse depth (1/z, > 0)
     * @param {number} u0 - Vertex 0 texture u (texels)
     * @param {number} v0 - Vertex 0 texture v (texels)
     * @param {number} x1 - Vertex 1 screen X
     * @param {number} y1 - Vertex 1 screen Y
     * @param {number} invZ1 - Vertex 1 inverse depth (1/z, > 0)
     * @param {number} u1 - Vertex 1 texture u (texels)
     * @param {number} v1 - Vertex 1 texture v (texels)
     * @param {number} x2 - Vertex 2 screen X
     * @param {number} y2 - Vertex 2 screen Y
     * @param {number} invZ2 - Vertex 2 inverse depth (1/z, > 0)
     * @param {number} u2 - Vertex 2 texture u (texels)
     * @param {number} v2 - Vertex 2 texture v (texels)
     * @param {Texture3D} texture - Packed power-of-two texture
     * @param {Uint8Array|null} [clipBuffer=null] - Clip mask (CLIPPING: delegated to zTexturedSpan)
     */
    static fillTriangleTextured(
        surface,
        depthBuffer,
        x0,
        y0,
        invZ0,
        u0,
        v0,
        x1,
        y1,
        invZ1,
        u1,
        v1,
        x2,
        y2,
        invZ2,
        u2,
        v2,
        texture,
        clipBuffer = null
    ) {
        if (IS_DEBUG) {
            if (depthBuffer.width !== surface.width || depthBuffer.height !== surface.height) {
                throw new Error(
                    `Triangle3DOps.fillTriangleTextured: depth buffer ${depthBuffer.width}×${depthBuffer.height} does not match surface ${surface.width}×${surface.height}`
                );
            }
            if (!(invZ0 > 0 && invZ1 > 0 && invZ2 > 0)) {
                throw new Error(
                    'Triangle3DOps.fillTriangleTextured: all vertices must have invZ > 0 (near-clip before projecting)'
                );
            }
            if (!texture || !texture.data32) {
                throw new Error('Triangle3DOps.fillTriangleTextured: texture must be a Texture3D');
            }
        }

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const depthData = depthBuffer.data;
        const tex32 = texture.data32;
        const texShift = texture.shift;
        const uMask = texture.uMask;
        const vMask = texture.vMask;

        // Screen-space plane gradients for invZ, u and v (all linear in
        // screen space for the affine approximation; invZ exactly so)
        const bx = x1 - x0;
        const by = y1 - y0;
        const cx = x2 - x0;
        const cy = y2 - y0;
        const area2 = bx * cy - cx * by;
        if (area2 === 0) {
            return;
        }
        const invArea2 = 1 / area2;
        const dizB = invZ1 - invZ0;
        const dizC = invZ2 - invZ0;
        const dInvZdX = (dizB * cy - dizC * by) * invArea2;
        const dInvZdY = (bx * dizC - cx * dizB) * invArea2;
        const duB = u1 - u0;
        const duC = u2 - u0;
        const dUdX = (duB * cy - duC * by) * invArea2;
        const dUdY = (bx * duC - cx * duB) * invArea2;
        const dvB = v1 - v0;
        const dvC = v2 - v0;
        const dVdX = (dvB * cy - dvC * by) * invArea2;
        const dVdY = (bx * dvC - cx * dvB) * invArea2;

        // Sort vertices by Y (only x/y needed; invZ/u/v come from the planes)
        let xA = x0,
            yA = y0;
        let xB = x1,
            yB = y1;
        let xC = x2,
            yC = y2;
        let tmp;
        if (yA > yB) {
            tmp = xA;
            xA = xB;
            xB = tmp;
            tmp = yA;
            yA = yB;
            yB = tmp;
        }
        if (yA > yC) {
            tmp = xA;
            xA = xC;
            xC = tmp;
            tmp = yA;
            yA = yC;
            yC = tmp;
        }
        if (yB > yC) {
            tmp = xB;
            xB = xC;
            xC = tmp;
            tmp = yB;
            yB = yC;
            yC = tmp;
        }

        // Scanline range: half-open [ceil(yA), ceil(yC)), clamped to surface
        const yStart = Math.max(0, Math.ceil(yA));
        const yEnd = Math.min(height, Math.ceil(yC));
        if (yStart >= yEnd) {
            return;
        }

        const slopeAC = (xC - xA) / (yC - yA);
        const slopeAB = yB !== yA ? (xB - xA) / (yB - yA) : 0; // unused when yB === yA
        const slopeBC = yC !== yB ? (xC - xB) / (yC - yB) : 0; // unused when yB === yC

        for (let y = yStart; y < yEnd; y++) {
            let xL = xA + (y - yA) * slopeAC;
            let xR = y < yB ? xA + (y - yA) * slopeAB : xB + (y - yB) * slopeBC;
            if (xL > xR) {
                tmp = xL;
                xL = xR;
                xR = tmp;
            }

            const xs = Math.max(0, Math.ceil(xL));
            const xe = Math.min(width, Math.ceil(xR));
            const spanLength = xe - xs;
            if (spanLength <= 0) {
                continue;
            }

            // Row starts from the plane equations (no incremental drift)
            const dx = xs - x0;
            const dy = y - y0;
            const invZRow = invZ0 + dx * dInvZdX + dy * dInvZdY;
            const uRow = u0 + dx * dUdX + dy * dUdY;
            const vRow = v0 + dx * dVdX + dy * dVdY;

            Triangle3DOps.zTexturedSpan(
                data32,
                depthData,
                width,
                height,
                xs,
                y,
                spanLength,
                invZRow,
                dInvZdX,
                uRow,
                dUdX,
                vRow,
                dVdX,
                tex32,
                texShift,
                uMask,
                vMask,
                clipBuffer
            );
        }
    }

    /**
     * Depth-tested PERSPECTIVE-CORRECT textured horizontal span with flat
     * light modulation.
     *
     * Interpolates the screen-space-linear quantities 1/z, u/z and v/z and
     * recovers perspective-correct (u, v) by division at the endpoints of
     * every 16-pixel segment, stepping affinely inside each segment (the
     * classic subdivision scheme: 1 divide per 16 pixels instead of one per
     * pixel, with sub-texel error for typical geometry).
     *
     * Each texel is modulated by `intensity` (0..256 fixed-point). 256 is
     * EXACT identity and selects a copy-only inner loop (no per-pixel
     * multiplies) - pair it with Texture3D.litVariant() pre-modulated
     * textures for lit rendering at unlit speed. Modulated loops force
     * texel alpha to 255; the 256 copy path writes texels as-is (author
     * textures with alpha 255, same contract as zTexturedSpan).
     *
     * BOUNDS CONTRACT: same as zFlatSpan (trusts the caller).
     * CLIPPING CONTRACT: clipping handled here, gates color AND depth
     * writes. Per-pixel bit test only — the 16px segmentation caps what the
     * byte-run fast paths could save, so they are deliberately omitted.
     * UV CONTRACT: same as zTexturedSpan (texel units, wrap, u/z & v/z here).
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {Float32Array} depthData - DepthBuffer.data (1/z per pixel)
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (integer, >= 0)
     * @param {number} y - Y coordinate of the span (integer, in [0, surfaceHeight))
     * @param {number} length - Span length in pixels (> 0)
     * @param {number} invZ0 - 1/z at the first pixel
     * @param {number} dInvZdX - 1/z increment per pixel (plane gradient)
     * @param {number} uz0 - u/z at the first pixel
     * @param {number} dUZdX - u/z increment per pixel (plane gradient)
     * @param {number} vz0 - v/z at the first pixel
     * @param {number} dVZdX - v/z increment per pixel (plane gradient)
     * @param {Uint32Array} tex32 - Packed texels (Texture3D.data32)
     * @param {number} texShift - log2 of texture width (Texture3D.shift)
     * @param {number} uMask - Texture width - 1 (Texture3D.uMask)
     * @param {number} vMask - Texture height - 1 (Texture3D.vMask)
     * @param {number} intensity - Flat light, 0..256 (256 = unmodulated)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here)
     */
    static zTexturedSpanPersp(
        data32,
        depthData,
        surfaceWidth,
        surfaceHeight,
        startX,
        y,
        length,
        invZ0,
        dInvZdX,
        uz0,
        dUZdX,
        vz0,
        dVZdX,
        tex32,
        texShift,
        uMask,
        vMask,
        intensity,
        clipBuffer,
        mips = null
    ) {
        if (IS_DEBUG) {
            if (y < 0 || y >= surfaceHeight || !Number.isInteger(y)) {
                throw new Error(
                    `Triangle3DOps.zTexturedSpanPersp: y out of bounds: y=${y}, surfaceHeight=${surfaceHeight}`
                );
            }
            if (startX < 0 || !Number.isInteger(startX)) {
                throw new Error(`Triangle3DOps.zTexturedSpanPersp: invalid startX=${startX}, must be integer >= 0`);
            }
            if (startX + length > surfaceWidth) {
                throw new Error(
                    `Triangle3DOps.zTexturedSpanPersp: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`Triangle3DOps.zTexturedSpanPersp: invalid length: ${length}, must be > 0`);
            }
            if (!(intensity >= 0 && intensity <= 256)) {
                throw new Error(`Triangle3DOps.zTexturedSpanPersp: intensity must be in [0, 256], got ${intensity}`);
            }
        }

        // Segment length: 16 px by default; when 1/z barely changes across
        // the whole span (distant, view-aligned surfaces - the far-floor
        // profile) the affine approximation holds over much longer segments,
        // quartering the per-segment divides. With relative 1/z variation
        // under 2% the added UV error is orders of magnitude below a texel.
        const SEG = Math.abs(dInvZdX) * length < 0.02 * invZ0 ? 64 : 16;
        let pixelIndex = y * surfaceWidth + startX;
        let done = 0;

        // Perspective-correct u,v at the span start
        let invIz = 1 / invZ0;
        let uStart = uz0 * invIz;
        let vStart = vz0 * invIz;
        let invZ = invZ0;

        while (done < length) {
            const seg = length - done > SEG ? SEG : length - done;
            const doneEnd = done + seg;

            // Exact attribute values at the segment end (computed from the
            // span start each time - no drift across segments)
            const izEnd = invZ0 + doneEnd * dInvZdX;
            invIz = 1 / izEnd;
            const uEnd = (uz0 + doneEnd * dUZdX) * invIz;
            const vEnd = (vz0 + doneEnd * dVZdX) * invIz;

            // Affine steps within this segment
            const invSeg = 1 / seg;
            const dU = (uEnd - uStart) * invSeg;
            const dV = (vEnd - vStart) * invSeg;

            // Mip level for this segment from the texel-per-pixel step
            // (nearest level below; level-k coordinates are u >> lv, exact
            // for u >= 0). Without mips this collapses to level 0 and the
            // sampling shift below is by zero.
            let tex32L = tex32;
            let shiftL = texShift;
            let uMaskL = uMask;
            let vMaskL = vMask;
            let lv = 0;
            if (mips !== null) {
                const stepU = dU < 0 ? -dU : dU;
                const stepV = dV < 0 ? -dV : dV;
                const step = stepU > stepV ? stepU : stepV;
                if (step >= 2) {
                    lv = 31 - Math.clz32(step | 0);
                    if (lv >= mips.length) lv = mips.length - 1;
                    const L = mips[lv];
                    tex32L = L.data32;
                    shiftL = L.shift;
                    uMaskL = L.uMask;
                    vMaskL = L.vMask;
                }
            }

            // Sub-texel bias (2^-20 texel): affine endpoints computed with a
            // non-power-of-two 1/seg can land 1 ulp below an integer texel
            // boundary and flip the sampled texel; the bias is far above
            // accumulated float error and far below half a texel.
            let u = uStart + 9.5367431640625e-7;
            let v = vStart + 9.5367431640625e-7;
            const segEndIndex = pixelIndex + seg;

            // Four inner-loop variants: clip x modulation. intensity 256 is
            // exact identity, so the copy-only loops are lossless - callers
            // using Texture3D.litVariant() pre-modulated textures land there.
            if (intensity === 256) {
                if (clipBuffer) {
                    for (; pixelIndex < segEndIndex; pixelIndex++) {
                        if (clipBuffer[pixelIndex >> 3] & (1 << (pixelIndex & 7))) {
                            if (invZ > depthData[pixelIndex]) {
                                depthData[pixelIndex] = invZ;
                                data32[pixelIndex] =
                                    tex32L[((((v | 0) >> lv) & vMaskL) << shiftL) | (((u | 0) >> lv) & uMaskL)];
                            }
                        }
                        invZ += dInvZdX;
                        u += dU;
                        v += dV;
                    }
                } else {
                    for (; pixelIndex < segEndIndex; pixelIndex++) {
                        if (invZ > depthData[pixelIndex]) {
                            depthData[pixelIndex] = invZ;
                            data32[pixelIndex] =
                                tex32L[((((v | 0) >> lv) & vMaskL) << shiftL) | (((u | 0) >> lv) & uMaskL)];
                        }
                        invZ += dInvZdX;
                        u += dU;
                        v += dV;
                    }
                }
            } else if (clipBuffer) {
                for (; pixelIndex < segEndIndex; pixelIndex++) {
                    if (clipBuffer[pixelIndex >> 3] & (1 << (pixelIndex & 7))) {
                        if (invZ > depthData[pixelIndex]) {
                            depthData[pixelIndex] = invZ;
                            const texel = tex32L[((((v | 0) >> lv) & vMaskL) << shiftL) | (((u | 0) >> lv) & uMaskL)];
                            data32[pixelIndex] =
                                (0xff000000 |
                                    ((((((texel >> 16) & 0xff) * intensity) >> 8) & 0xff) << 16) |
                                    ((((((texel >> 8) & 0xff) * intensity) >> 8) & 0xff) << 8) |
                                    (((texel & 0xff) * intensity) >> 8)) >>>
                                0;
                        }
                    }
                    invZ += dInvZdX;
                    u += dU;
                    v += dV;
                }
            } else {
                for (; pixelIndex < segEndIndex; pixelIndex++) {
                    if (invZ > depthData[pixelIndex]) {
                        depthData[pixelIndex] = invZ;
                        const texel = tex32L[((((v | 0) >> lv) & vMaskL) << shiftL) | (((u | 0) >> lv) & uMaskL)];
                        data32[pixelIndex] =
                            (0xff000000 |
                                ((((((texel >> 16) & 0xff) * intensity) >> 8) & 0xff) << 16) |
                                ((((((texel >> 8) & 0xff) * intensity) >> 8) & 0xff) << 8) |
                                (((texel & 0xff) * intensity) >> 8)) >>>
                            0;
                    }
                    invZ += dInvZdX;
                    u += dU;
                    v += dV;
                }
            }

            uStart = uEnd;
            vStart = vEnd;
            done = doneEnd;
        }
    }

    /**
     * Fill a screen-space triangle with depth testing, PERSPECTIVE-CORRECT
     * texture mapping and flat light modulation.
     *
     * Same vertex layout as fillTriangleTextured — (x, y, invZ, u, v) with
     * texel-unit UVs — but u and v are interpolated perspective-correctly
     * (as u/z and v/z, re-divided every 16 pixels). Use this instead of the
     * affine variant when triangles are large or steeply angled; use the
     * affine one when texel-per-pixel density is high and speed matters.
     *
     * @param {Surface} surface - Target surface
     * @param {DepthBuffer} depthBuffer - Depth buffer (must match surface dimensions)
     * @param {number} x0 - Vertex 0 screen X
     * @param {number} y0 - Vertex 0 screen Y
     * @param {number} invZ0 - Vertex 0 inverse depth (1/z, > 0)
     * @param {number} u0 - Vertex 0 texture u (texels)
     * @param {number} v0 - Vertex 0 texture v (texels)
     * @param {number} x1 - Vertex 1 screen X
     * @param {number} y1 - Vertex 1 screen Y
     * @param {number} invZ1 - Vertex 1 inverse depth (1/z, > 0)
     * @param {number} u1 - Vertex 1 texture u (texels)
     * @param {number} v1 - Vertex 1 texture v (texels)
     * @param {number} x2 - Vertex 2 screen X
     * @param {number} y2 - Vertex 2 screen Y
     * @param {number} invZ2 - Vertex 2 inverse depth (1/z, > 0)
     * @param {number} u2 - Vertex 2 texture u (texels)
     * @param {number} v2 - Vertex 2 texture v (texels)
     * @param {Texture3D} texture - Packed power-of-two texture
     * @param {number} [intensity=256] - Flat light, 0..256 (256 = unmodulated)
     * @param {Uint8Array|null} [clipBuffer=null] - Clip mask (CLIPPING: delegated to zTexturedSpanPersp)
     */
    static fillTriangleTexturedPersp(
        surface,
        depthBuffer,
        x0,
        y0,
        invZ0,
        u0,
        v0,
        x1,
        y1,
        invZ1,
        u1,
        v1,
        x2,
        y2,
        invZ2,
        u2,
        v2,
        texture,
        intensity = 256,
        clipBuffer = null
    ) {
        if (IS_DEBUG) {
            if (depthBuffer.width !== surface.width || depthBuffer.height !== surface.height) {
                throw new Error(
                    `Triangle3DOps.fillTriangleTexturedPersp: depth buffer ${depthBuffer.width}×${depthBuffer.height} does not match surface ${surface.width}×${surface.height}`
                );
            }
            if (!(invZ0 > 0 && invZ1 > 0 && invZ2 > 0)) {
                throw new Error(
                    'Triangle3DOps.fillTriangleTexturedPersp: all vertices must have invZ > 0 (near-clip before projecting)'
                );
            }
            if (!texture || !texture.data32) {
                throw new Error('Triangle3DOps.fillTriangleTexturedPersp: texture must be a Texture3D');
            }
        }

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const depthData = depthBuffer.data;
        const tex32 = texture.data32;
        const texShift = texture.shift;
        const uMask = texture.uMask;
        const vMask = texture.vMask;
        const mips = texture.mips || null;

        // Perspective-correct interpolants: u/z and v/z (linear in screen
        // space, like 1/z itself)
        const uz0 = u0 * invZ0;
        const uz1 = u1 * invZ1;
        const uz2 = u2 * invZ2;
        const vz0 = v0 * invZ0;
        const vz1 = v1 * invZ1;
        const vz2 = v2 * invZ2;

        const bx = x1 - x0;
        const by = y1 - y0;
        const cx = x2 - x0;
        const cy = y2 - y0;
        const area2 = bx * cy - cx * by;
        if (area2 === 0) {
            return;
        }
        const invArea2 = 1 / area2;
        const dizB = invZ1 - invZ0;
        const dizC = invZ2 - invZ0;
        const dInvZdX = (dizB * cy - dizC * by) * invArea2;
        const dInvZdY = (bx * dizC - cx * dizB) * invArea2;
        const duzB = uz1 - uz0;
        const duzC = uz2 - uz0;
        const dUZdX = (duzB * cy - duzC * by) * invArea2;
        const dUZdY = (bx * duzC - cx * duzB) * invArea2;
        const dvzB = vz1 - vz0;
        const dvzC = vz2 - vz0;
        const dVZdX = (dvzB * cy - dvzC * by) * invArea2;
        const dVZdY = (bx * dvzC - cx * dvzB) * invArea2;

        // Sort vertices by Y (only x/y needed; attributes come from planes)
        let xA = x0,
            yA = y0;
        let xB = x1,
            yB = y1;
        let xC = x2,
            yC = y2;
        let tmp;
        if (yA > yB) {
            tmp = xA;
            xA = xB;
            xB = tmp;
            tmp = yA;
            yA = yB;
            yB = tmp;
        }
        if (yA > yC) {
            tmp = xA;
            xA = xC;
            xC = tmp;
            tmp = yA;
            yA = yC;
            yC = tmp;
        }
        if (yB > yC) {
            tmp = xB;
            xB = xC;
            xC = tmp;
            tmp = yB;
            yB = yC;
            yC = tmp;
        }

        const yStart = Math.max(0, Math.ceil(yA));
        const yEnd = Math.min(height, Math.ceil(yC));
        if (yStart >= yEnd) {
            return;
        }

        const slopeAC = (xC - xA) / (yC - yA);
        const slopeAB = yB !== yA ? (xB - xA) / (yB - yA) : 0; // unused when yB === yA
        const slopeBC = yC !== yB ? (xC - xB) / (yC - yB) : 0; // unused when yB === yC

        for (let y = yStart; y < yEnd; y++) {
            let xL = xA + (y - yA) * slopeAC;
            let xR = y < yB ? xA + (y - yA) * slopeAB : xB + (y - yB) * slopeBC;
            if (xL > xR) {
                tmp = xL;
                xL = xR;
                xR = tmp;
            }

            const xs = Math.max(0, Math.ceil(xL));
            const xe = Math.min(width, Math.ceil(xR));
            const spanLength = xe - xs;
            if (spanLength <= 0) {
                continue;
            }

            const dx = xs - x0;
            const dy = y - y0;
            const invZRow = invZ0 + dx * dInvZdX + dy * dInvZdY;
            const uzRow = uz0 + dx * dUZdX + dy * dUZdY;
            const vzRow = vz0 + dx * dVZdX + dy * dVZdY;

            Triangle3DOps.zTexturedSpanPersp(
                data32,
                depthData,
                width,
                height,
                xs,
                y,
                spanLength,
                invZRow,
                dInvZdX,
                uzRow,
                dUZdX,
                vzRow,
                dVZdX,
                tex32,
                texShift,
                uMask,
                vMask,
                intensity,
                clipBuffer,
                mips
            );
        }
    }
}


// Core namespace factory function (mirrors the full bundle's contract:
// SWCanvas.Core.Surface is a FACTORY, called without `new`).
function CoreSurfaceFactory(width, height) {
    return new Surface(width, height);
}

var swcanvas3DCoreApi = {
    Core: {
        Surface: CoreSurfaceFactory,
        Color: Color,
        Validators: Validators,
        DepthBuffer: DepthBuffer,
        Texture3D: Texture3D,
        Triangle3DOps: Triangle3DOps,
        IS_DEBUG: IS_DEBUG,
        assertDebug: assertDebug,
        debugLog: debugLog,
        debugWarn: debugWarn
    }
};

if (typeof window !== 'undefined') {
    window.SWCanvas = swcanvas3DCoreApi;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = swcanvas3DCoreApi;
}

})();

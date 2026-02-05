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
 * StateStack - Manages save/restore state snapshots for Context2D
 *
 * Uses Snapshot/Memento pattern: stores complete state snapshots
 * without affecting hot-path property access performance.
 *
 * Design rationale:
 * - Context2D keeps active state as direct properties for O(1) access
 * - StateStack only handles storage during save()/restore() operations
 * - This avoids performance regression from property indirection on hot paths
 */
class StateStack {
    constructor() {
        this._stack = [];
    }

    /**
     * Push a state snapshot onto the stack
     * @param {Object} snapshot - Complete state snapshot
     */
    push(snapshot) {
        this._stack.push(snapshot);
    }

    /**
     * Pop and return the top state snapshot
     * @returns {Object|undefined} The snapshot or undefined if empty
     */
    pop() {
        return this._stack.pop();
    }

    /**
     * Check if stack is empty
     * @returns {boolean} True if no saved states
     */
    isEmpty() {
        return this._stack.length === 0;
    }

    /**
     * Get current stack depth (for debugging/testing)
     * @returns {number} Number of saved states
     */
    get depth() {
        return this._stack.length;
    }
}

/**
 * Point class for SWCanvas
 *
 * Immutable 2D point representing a coordinate pair.
 * Following Joshua Bloch's principle of making small, focused, immutable classes.
 */
class Point {
    /**
     * Create a Point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    constructor(x, y) {
        // Validate input parameters
        Validators.finiteNumber(x, 'Point x coordinate');
        Validators.finiteNumber(y, 'Point y coordinate');

        this._x = x;
        this._y = y;

        // Make point immutable
        Object.freeze(this);
    }

    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }

    /**
     * Create Point from object with x,y properties
     * @param {Object} obj - Object with x and y properties
     * @returns {Point} New Point instance
     */
    static from(obj) {
        if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number') {
            throw new Error('Object must have numeric x and y properties');
        }
        return new Point(obj.x, obj.y);
    }

    /**
     * Calculate distance to another point
     * @param {Point} other - Other point
     * @returns {number} Euclidean distance
     */
    distanceTo(other) {
        if (!(other instanceof Point)) {
            throw new Error('Argument must be a Point instance');
        }

        const dx = this._x - other._x;
        const dy = this._y - other._y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Add vector to this point (immutable)
     * @param {number} dx - X offset
     * @param {number} dy - Y offset
     * @returns {Point} New translated point
     */
    translate(dx, dy) {
        return new Point(this._x + dx, this._y + dy);
    }

    /**
     * Add another point to this point (immutable)
     * @param {Point} other - Other point to add
     * @returns {Point} New point representing sum
     */
    add(other) {
        if (!(other instanceof Point)) {
            throw new Error('Argument must be a Point instance');
        }

        return new Point(this._x + other._x, this._y + other._y);
    }

    /**
     * Subtract another point from this point (immutable)
     * @param {Point} other - Other point to subtract
     * @returns {Point} New point representing difference
     */
    subtract(other) {
        if (!(other instanceof Point)) {
            throw new Error('Argument must be a Point instance');
        }

        return new Point(this._x - other._x, this._y - other._y);
    }

    /**
     * Scale this point by a factor (immutable)
     * @param {number} factor - Scale factor
     * @returns {Point} New scaled point
     */
    scale(factor) {
        if (typeof factor !== 'number') {
            throw new Error('Scale factor must be a number');
        }

        return new Point(this._x * factor, this._y * factor);
    }

    /**
     * Scale this point by separate X and Y factors (immutable)
     * @param {number} sx - X scale factor
     * @param {number} sy - Y scale factor
     * @returns {Point} New scaled point
     */
    scaleXY(sx, sy) {
        if (typeof sx !== 'number' || typeof sy !== 'number') {
            throw new Error('Scale factors must be numbers');
        }

        return new Point(this._x * sx, this._y * sy);
    }

    /**
     * Rotate this point around origin (immutable)
     * @param {number} angle - Rotation angle in radians
     * @returns {Point} New rotated point
     */
    rotate(angle) {
        if (typeof angle !== 'number') {
            throw new Error('Angle must be a number');
        }

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Point(this._x * cos - this._y * sin, this._x * sin + this._y * cos);
    }

    /**
     * Rotate this point around a center point (immutable)
     * @param {Point} center - Center of rotation
     * @param {number} angle - Rotation angle in radians
     * @returns {Point} New rotated point
     */
    rotateAround(center, angle) {
        if (!(center instanceof Point)) {
            throw new Error('Center must be a Point instance');
        }

        return this.subtract(center).rotate(angle).add(center);
    }

    /**
     * Get magnitude (distance from origin)
     * @returns {number} Vector magnitude
     */
    get magnitude() {
        return Math.sqrt(this._x * this._x + this._y * this._y);
    }

    /**
     * Get squared magnitude (avoids sqrt for performance)
     * @returns {number} Squared vector magnitude
     */
    get magnitudeSquared() {
        return this._x * this._x + this._y * this._y;
    }

    /**
     * Normalize to unit vector (immutable)
     * @returns {Point} New normalized point
     */
    normalize() {
        const mag = this.magnitude;
        if (mag === 0) {
            return new Point(0, 0);
        }
        return new Point(this._x / mag, this._y / mag);
    }

    /**
     * Calculate dot product with another point
     * @param {Point} other - Other point/vector
     * @returns {number} Dot product
     */
    dot(other) {
        if (!(other instanceof Point)) {
            throw new Error('Argument must be a Point instance');
        }

        return this._x * other._x + this._y * other._y;
    }

    /**
     * Calculate cross product with another point (2D cross returns scalar)
     * @param {Point} other - Other point/vector
     * @returns {number} Cross product magnitude
     */
    cross(other) {
        if (!(other instanceof Point)) {
            throw new Error('Argument must be a Point instance');
        }

        return this._x * other._y - this._y * other._x;
    }

    /**
     * Round coordinates to integers (immutable)
     * @returns {Point} New point with rounded coordinates
     */
    round() {
        return new Point(Math.round(this._x), Math.round(this._y));
    }

    /**
     * Floor coordinates to integers (immutable)
     * @returns {Point} New point with floored coordinates
     */
    floor() {
        return new Point(Math.floor(this._x), Math.floor(this._y));
    }

    /**
     * Ceiling coordinates to integers (immutable)
     * @returns {Point} New point with ceiling coordinates
     */
    ceil() {
        return new Point(Math.ceil(this._x), Math.ceil(this._y));
    }

    /**
     * Clamp coordinates to a range (immutable)
     * @param {number} minX - Minimum X value
     * @param {number} minY - Minimum Y value
     * @param {number} maxX - Maximum X value
     * @param {number} maxY - Maximum Y value
     * @returns {Point} New clamped point
     */
    clamp(minX, minY, maxX, maxY) {
        return new Point(Math.max(minX, Math.min(maxX, this._x)), Math.max(minY, Math.min(maxY, this._y)));
    }

    /**
     * Interpolate between this point and another (immutable)
     * @param {Point} other - Target point
     * @param {number} t - Interpolation factor (0-1)
     * @returns {Point} Interpolated point
     */
    lerp(other, t) {
        if (!(other instanceof Point)) {
            throw new Error('Target must be a Point instance');
        }

        if (typeof t !== 'number' || t < 0 || t > 1) {
            throw new Error('Interpolation factor must be between 0 and 1');
        }

        return new Point(this._x + (other._x - this._x) * t, this._y + (other._y - this._y) * t);
    }

    /**
     * Convert to plain object
     * @returns {Object} {x, y} object
     */
    toObject() {
        return { x: this._x, y: this._y };
    }

    /**
     * Convert to array
     * @returns {number[]} [x, y] array
     */
    toArray() {
        return [this._x, this._y];
    }

    /**
     * Check equality with another point
     * @param {Point} other - Other point
     * @param {number} tolerance - Tolerance for floating point comparison
     * @returns {boolean} True if points are equal within tolerance
     */
    equals(other, tolerance = FLOAT_EPSILON) {
        return (
            other instanceof Point &&
            Math.abs(this._x - other._x) < tolerance &&
            Math.abs(this._y - other._y) < tolerance
        );
    }

    /**
     * Check if point is at origin (0, 0)
     * @param {number} tolerance - Tolerance for floating point comparison
     * @returns {boolean} True if point is at origin
     */
    isOrigin(tolerance = FLOAT_EPSILON) {
        return Math.abs(this._x) < tolerance && Math.abs(this._y) < tolerance;
    }

    /**
     * String representation for debugging
     * @returns {string} Point description
     */
    toString() {
        return `Point(${this._x}, ${this._y})`;
    }
}

/**
 * Rectangle class for SWCanvas
 *
 * Immutable Rectangle class representing an axis-aligned bounding box.
 * Following Joshua Bloch's principle of making small, focused, immutable classes.
 */
class Rectangle {
    /**
     * Create a Rectangle
     * @param {number} x - Left coordinate
     * @param {number} y - Top coordinate
     * @param {number} width - Width
     * @param {number} height - Height
     */
    constructor(x, y, width, height) {
        // Validate input parameters
        Validators.rectParamsFinite(x, y, width, height);

        if (width < 0 || height < 0) {
            throw new Error('Rectangle dimensions must be non-negative');
        }

        this._x = x;
        this._y = y;
        this._width = width;
        this._height = height;

        // Make rectangle immutable
        Object.freeze(this);
    }

    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }
    get width() {
        return this._width;
    }
    get height() {
        return this._height;
    }

    get left() {
        return this._x;
    }
    get top() {
        return this._y;
    }
    get right() {
        return this._x + this._width;
    }
    get bottom() {
        return this._y + this._height;
    }

    /**
     * Create rectangle that bounds a set of points
     * @param {Point[]} points - Array of points
     * @returns {Rectangle} Bounding rectangle
     */
    static boundingBox(points) {
        if (!Array.isArray(points)) {
            throw new Error('Points must be an array');
        }

        if (points.length === 0) {
            return new Rectangle(0, 0, 0, 0);
        }

        // Validate all points
        for (const point of points) {
            if (!(point instanceof Point)) {
                throw new Error('All items must be Point instances');
            }
        }

        let minX = Infinity,
            minY = Infinity;
        let maxX = -Infinity,
            maxY = -Infinity;

        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        return new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }

    /**
     * Get center point of rectangle
     * @returns {Point} Center point
     */
    get center() {
        return new Point(this._x + this._width / 2, this._y + this._height / 2);
    }

    /**
     * Get area of rectangle
     * @returns {number} Area
     */
    get area() {
        return this._width * this._height;
    }

    /**
     * Get perimeter of rectangle
     * @returns {number} Perimeter
     */
    get perimeter() {
        return 2 * (this._width + this._height);
    }

    /**
     * Check if rectangle is empty (zero area)
     * @returns {boolean} True if empty
     */
    get isEmpty() {
        return this._width === 0 || this._height === 0;
    }

    /**
     * Check if rectangle is a square
     * @returns {boolean} True if square
     */
    get isSquare() {
        return this._width === this._height && this._width > 0;
    }

    /**
     * String representation for debugging
     * @returns {string} Rectangle description
     */
    toString() {
        return `Rectangle(${this._x}, ${this._y}, ${this._width}, ${this._height})`;
    }
}

/**
 * Transform2D class for SWCanvas
 *
 * Represents a 2D affine transformation matrix using homogeneous coordinates.
 * Immutable value object following Joshua Bloch's effective design principles.
 *
 * Transform2D format (2x3 affine transformation):
 * | a  c  e |   | x |   | ax + cy + e |
 * | b  d  f | × | y | = | bx + dy + f |
 * | 0  0  1 |   | 1 |   |      1      |
 */
class Transform2D {
    /**
     * Create a Transform2D matrix
     * @param {number[]|undefined} init - Optional [a, b, c, d, e, f] array
     */
    constructor(init) {
        if (init && Array.isArray(init) && init.length === 6) {
            // Validate input values
            for (let i = 0; i < 6; i++) {
                if (typeof init[i] !== 'number' || !isFinite(init[i])) {
                    throw new Error(`Transform2D component ${i} must be a finite number`);
                }
            }

            this.a = init[0];
            this.b = init[1];
            this.c = init[2];
            this.d = init[3];
            this.e = init[4];
            this.f = init[5];
        } else if (init && init.length !== undefined) {
            throw new Error('Transform2D initialization array must have exactly 6 elements');
        } else {
            // Identity transformation
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.e = 0;
            this.f = 0;
        }

        // Pre-compute decomposition values using matrix-based axis detection
        // This avoids sqrt/atan2 for 90% of common cases (simple scaling/translation)
        // Uses TRANSFORM_EPSILON from SWCanvasConstants for axis detection threshold

        // 1. Check for Axis Alignment (0° or 180°)
        // Most common case: Simple scaling/translation where b=0, c=0
        if (Math.abs(this.b) < TRANSFORM_EPSILON && Math.abs(this.c) < TRANSFORM_EPSILON) {
            this.isAxisAligned = true;
            this.is90DegreeRotated = false; // No dimension swap needed
            this.scaleX = Math.abs(this.a); // No sqrt needed
            this.scaleY = Math.abs(this.d); // No sqrt needed
            this.rotationAngle = this.a < 0 ? Math.PI : 0;
        } else if (Math.abs(this.a) < TRANSFORM_EPSILON && Math.abs(this.d) < TRANSFORM_EPSILON) {
            // 2. Check for Perpendicular Alignment (90° or 270°)
            // Second common case: 90° rotation where a=0, d=0
            this.isAxisAligned = true;
            this.is90DegreeRotated = true; // Dimension swap needed
            this.scaleX = Math.abs(this.b); // No sqrt needed
            this.scaleY = Math.abs(this.c); // No sqrt needed
            this.rotationAngle = this.b > 0 ? HALF_PI : -HALF_PI;
        } else {
            // 3. Complex Rotation / Skew - fallback to trig
            this.isAxisAligned = false;
            this.is90DegreeRotated = false;
            this.scaleX = Math.sqrt(this.a * this.a + this.b * this.b);
            this.scaleY = Math.sqrt(this.c * this.c + this.d * this.d);
            this.rotationAngle = Math.atan2(-this.c, this.a);
        }

        // Pre-compute scaled line width factor (geometric mean of scales)
        this.scaledLineWidthFactor = Math.max(Math.sqrt(this.scaleX * this.scaleY), TRANSFORM_EPSILON);

        // Pre-compute uniform scale factor (sqrt of absolute determinant)
        // Used for scaling radii and values that transform uniformly in all directions
        this.uniformScale = Math.max(Math.sqrt(Math.abs(this.a * this.d - this.b * this.c)), TRANSFORM_EPSILON);

        // Pre-compute uniform scale check: a=d, b=-c (rotation + uniform scale)
        this.isUniformScale =
            Math.abs(this.a - this.d) < TRANSFORM_EPSILON && Math.abs(this.b + this.c) < TRANSFORM_EPSILON;

        // Make transformation immutable
        Object.freeze(this);
    }

    /**
     * Create translation transform
     * @param {number} x - X translation
     * @param {number} y - Y translation
     * @returns {Transform2D} Translation transformation
     */
    static translation(x, y) {
        if (x === 0 && y === 0) return Transform2D.IDENTITY;
        return new Transform2D([1, 0, 0, 1, x, y]);
    }

    /**
     * Create scaling transform
     * @param {number} sx - X scale factor
     * @param {number} sy - Y scale factor
     * @returns {Transform2D} Scaling transformation
     */
    static scaling(sx, sy) {
        if (sx === 1 && sy === 1) return Transform2D.IDENTITY;
        return new Transform2D([sx, 0, 0, sy, 0, 0]);
    }

    /**
     * Create rotation transform
     * @param {number} angleInRadians - Rotation angle in radians
     * @returns {Transform2D} Rotation transformation
     */
    static rotation(angleInRadians) {
        if (angleInRadians === 0) return Transform2D.IDENTITY;
        const cos = Math.cos(angleInRadians);
        const sin = Math.sin(angleInRadians);
        return new Transform2D([cos, sin, -sin, cos, 0, 0]);
    }

    /**
     * Multiply this transform with another (immutable)
     * @param {Transform2D} other - Transform to multiply with
     * @returns {Transform2D} Result of multiplication
     */
    multiply(other) {
        if (!(other instanceof Transform2D)) {
            throw new Error('Can only multiply with another Transform2D');
        }

        // Short-circuit: identity * X = X, X * identity = X
        if (this.isIdentity) return other;
        if (other.isIdentity) return this;

        return new Transform2D([
            this.a * other.a + this.c * other.b,
            this.b * other.a + this.d * other.b,
            this.a * other.c + this.c * other.d,
            this.b * other.c + this.d * other.d,
            this.a * other.e + this.c * other.f + this.e,
            this.b * other.e + this.d * other.f + this.f
        ]);
    }

    /**
     * Apply translation to this transform (immutable)
     * @param {number} x - X translation
     * @param {number} y - Y translation
     * @returns {Transform2D} New transformed matrix
     */
    translate(x, y) {
        if (x === 0 && y === 0) return this;
        return this.multiply(Transform2D.translation(x, y));
    }

    /**
     * Apply scaling to this transform (immutable)
     * @param {number} sx - X scale factor
     * @param {number} sy - Y scale factor
     * @returns {Transform2D} New transformed matrix
     */
    scale(sx, sy) {
        if (sx === 1 && sy === 1) return this;
        return this.multiply(Transform2D.scaling(sx, sy));
    }

    /**
     * Apply rotation to this transform (immutable)
     * @param {number} angleInRadians - Rotation angle in radians
     * @returns {Transform2D} New transformed matrix
     */
    rotate(angleInRadians) {
        if (angleInRadians === 0) return this;
        return this.multiply(Transform2D.rotation(angleInRadians));
    }

    /**
     * Calculate inverse transformation (immutable)
     * @returns {Transform2D} Inverse transformation
     */
    invert() {
        const det = this.a * this.d - this.b * this.c;

        if (Math.abs(det) < FLOAT_EPSILON) {
            throw new Error('Transform2D matrix is not invertible (determinant ≈ 0)');
        }

        return new Transform2D([
            this.d / det,
            -this.b / det,
            -this.c / det,
            this.a / det,
            (this.c * this.f - this.d * this.e) / det,
            (this.b * this.e - this.a * this.f) / det
        ]);
    }

    /**
     * Transform a point using this matrix
     * @param {Object|Point} point - Point with x,y properties
     * @returns {Object} Transformed point {x, y}
     */
    transformPoint(point) {
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
            throw new Error('Point must have numeric x and y properties');
        }

        return {
            x: this.a * point.x + this.c * point.y + this.e,
            y: this.b * point.x + this.d * point.y + this.f
        };
    }

    /**
     * Transform multiple points efficiently
     * @param {Array} points - Array of points to transform
     * @returns {Array} Array of transformed points
     */
    transformPoints(points) {
        return points.map(point => this.transformPoint(point));
    }

    /**
     * Get transformation as array
     * @returns {number[]} [a, b, c, d, e, f] array
     */
    toArray() {
        return [this.a, this.b, this.c, this.d, this.e, this.f];
    }

    /**
     * Check if this is the identity transformation
     * @returns {boolean} True if identity
     */
    get isIdentity() {
        // Fast path: reference equality with cached identity
        if (this === Transform2D.IDENTITY) return true;
        // Fallback: component equality (for transforms created with [1,0,0,1,0,0])
        return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
    }

    /**
     * Get transformation determinant
     * @returns {number} Transform2D determinant
     */
    get determinant() {
        return this.a * this.d - this.b * this.c;
    }

    // Note: rotationAngle, scaleX, scaleY, isAxisAligned, is90DegreeRotated, isUniformScale,
    // and scaledLineWidthFactor are now pre-computed direct properties set in the constructor.
    // This avoids sqrt/atan2 calls on every access (90% of transforms are simple scale/translate).

    /**
     * Calculate the scaled line width based on the current transformation
     * Uses pre-computed scaledLineWidthFactor for efficiency
     * @param {number} baseWidth - The base line width before transformation
     * @returns {number} The scaled line width
     */
    getScaledLineWidth(baseWidth) {
        return baseWidth * this.scaledLineWidthFactor;
    }

    /**
     * Check equality with another transform
     * @param {Transform2D} other - Transform to compare
     * @param {number} tolerance - Floating point tolerance
     * @returns {boolean} True if transforms are equal within tolerance
     */
    equals(other, tolerance = FLOAT_EPSILON) {
        return (
            other instanceof Transform2D &&
            Math.abs(this.a - other.a) < tolerance &&
            Math.abs(this.b - other.b) < tolerance &&
            Math.abs(this.c - other.c) < tolerance &&
            Math.abs(this.d - other.d) < tolerance &&
            Math.abs(this.e - other.e) < tolerance &&
            Math.abs(this.f - other.f) < tolerance
        );
    }

    /**
     * String representation for debugging
     * @returns {string} Transform2D description
     */
    toString() {
        return `Transform2D([${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f}])`;
    }
}

// Cache the identity matrix - immutable, so safe to share
Transform2D.IDENTITY = new Transform2D();

/**
 * SWPath2D - Path command recorder for 2D drawing operations
 *
 * Records path commands (moveTo, lineTo, arc, bezierCurveTo, etc.) for later
 * execution. Used for defining shapes that can be filled, stroked, or used as
 * clip regions. Compatible with HTML5 Canvas Path2D API.
 */
class SWPath2D {
    constructor() {
        this.commands = [];
    }

    closePath() {
        this.commands.push({ type: 'closePath' });
    }

    moveTo(x, y) {
        this.commands.push({ type: 'moveTo', x: x, y: y });
    }

    lineTo(x, y) {
        this.commands.push({ type: 'lineTo', x: x, y: y });
    }

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        this.commands.push({
            type: 'bezierCurveTo',
            cp1x: cp1x,
            cp1y: cp1y,
            cp2x: cp2x,
            cp2y: cp2y,
            x: x,
            y: y
        });
    }

    quadraticCurveTo(cpx, cpy, x, y) {
        this.commands.push({
            type: 'quadraticCurveTo',
            cpx: cpx,
            cpy: cpy,
            x: x,
            y: y
        });
    }

    rect(x, y, w, h) {
        this.moveTo(x, y);
        this.lineTo(x + w, y);
        this.lineTo(x + w, y + h);
        this.lineTo(x, y + h);
        this.closePath();
    }

    /**
     * Adds a rounded rectangle subpath to the current path.
     * Follows the HTML5 Canvas roundRect() specification.
     * @param {number} x - X coordinate of the rectangle's top-left corner
     * @param {number} y - Y coordinate of the rectangle's top-left corner
     * @param {number} width - Width of the rectangle
     * @param {number} height - Height of the rectangle
     * @param {number|number[]} radii - Corner radius (single value or array)
     */
    roundRect(x, y, width, height, radii) {
        // Normalize radii to a single value for simplicity
        // HTML5 Canvas spec allows array of up to 4 values, but we simplify to single radius
        let radius = Array.isArray(radii) ? radii[0] : radii || 0;

        // Clamp radius to half the smaller dimension
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;

        // Handle zero or negative radius - just draw a regular rect
        if (radius <= 0) {
            this.rect(x, y, width, height);
            return;
        }

        // Build path using arcTo for rounded corners
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + radius, y, radius);
        this.closePath();
    }

    arc(x, y, radius, startAngle, endAngle, counterclockwise) {
        this.commands.push({
            type: 'arc',
            x: x,
            y: y,
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle,
            counterclockwise: !!counterclockwise
        });
    }

    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
        this.commands.push({
            type: 'ellipse',
            x: x,
            y: y,
            radiusX: radiusX,
            radiusY: radiusY,
            rotation: rotation,
            startAngle: startAngle,
            endAngle: endAngle,
            counterclockwise: !!counterclockwise
        });
    }

    arcTo(x1, y1, x2, y2, radius) {
        if (
            typeof x1 !== 'number' ||
            typeof y1 !== 'number' ||
            typeof x2 !== 'number' ||
            typeof y2 !== 'number' ||
            typeof radius !== 'number'
        ) {
            const error = new TypeError('All parameters must be numbers');
            error.message = 'TypeError: ' + error.message;
            throw error;
        }

        if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2) || !isFinite(radius)) {
            const error = new TypeError('All parameters must be finite numbers');
            error.message = 'TypeError: ' + error.message;
            throw error;
        }

        if (radius < 0) {
            const error = new Error('IndexSizeError');
            error.name = 'IndexSizeError';
            throw error;
        }

        this.commands.push({
            type: 'arcTo',
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            radius: radius
        });
    }
}

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
 * SpanOps - Static utility methods for horizontal span filling
 * Used by all shape *Ops classes for optimized pixel rendering.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): Uses inline markers for pixel blending.
 *   - Called by: RectOpsAA, RectOpsRot, CircleOps, LineOps, ArcOps,
 *                RoundedRectOpsAA, RoundedRectOpsRot, QuadScanOps
 *
 * BOUNDS CONTRACT:
 * ----------------
 * SpanOps TRUSTS that callers provide valid coordinates:
 *   1. y must be in [0, surfaceHeight)
 *   2. startX must be in [0, surfaceWidth)
 *   3. startX + length must be <= surfaceWidth
 *   4. length must be > 0
 *
 * In development builds, assertions verify these invariants and throw
 * descriptive errors if violated. In production builds, assertions are
 * stripped for maximum performance.
 *
 * CLIPPING CONTRACT:
 * ------------------
 * SpanOps IS RESPONSIBLE for clipping checks when clipBuffer is provided.
 * Callers MUST NOT pre-check clipping before calling SpanOps methods.
 * This is the PRIMARY clipping checkpoint for span-based rendering.
 *
 * Methods check each pixel against clipBuffer (with byte-skip optimization)
 * before writing. Passing clipBuffer=null disables clipping checks.
 *
 * NAMING PATTERN: {operation}_{opacity}
 *   - fill_Opaq: Opaque span fill (32-bit writes)
 *   - fill_Alpha: Semi-transparent span fill (uses inline BLEND_ALPHA marker)
 */
class SpanOps {
    /**
     * Optimized horizontal span fill with 32-bit writes (opaque colors only)
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (must be >= 0)
     * @param {number} y - Y coordinate of the span (must be in [0, surfaceHeight))
     * @param {number} length - Length of the span in pixels (must be > 0, startX + length <= surfaceWidth)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here with byte-skip optimization)
     */
    static fill_Opaq(data32, surfaceWidth, surfaceHeight, startX, y, length, packedColor, clipBuffer) {
        if (IS_DEBUG) {
            const yi = Math.floor(y);
            const x = Math.floor(startX);
            if (yi < 0 || yi >= surfaceHeight) {
                throw new Error(
                    `SpanOps.fill_Opaq: y out of bounds: y=${y} (yi=${yi}), surfaceHeight=${surfaceHeight}`
                );
            }
            if (x < 0) {
                throw new Error(`SpanOps.fill_Opaq: startX out of bounds: startX=${startX} (x=${x}), must be >= 0`);
            }
            if (x + length > surfaceWidth) {
                throw new Error(
                    `SpanOps.fill_Opaq: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`SpanOps.fill_Opaq: invalid length: ${length}, must be > 0`);
            }
        }

        const yi = Math.floor(y);
        const x = Math.floor(startX);
        let pixelIndex = yi * surfaceWidth + x;
        const endIndex = pixelIndex + length;

        if (clipBuffer) {
            // With clipping
            while (pixelIndex < endIndex) {
                const byteIndex = pixelIndex >> 3;

                // Skip fully clipped bytes
                if (clipBuffer[byteIndex] === 0) {
                    const nextByteBoundary = (byteIndex + 1) << 3;
                    pixelIndex = Math.min(nextByteBoundary, endIndex);
                    continue;
                }

                const bitIndex = pixelIndex & 7;
                if (clipBuffer[byteIndex] & (1 << bitIndex)) {
                    data32[pixelIndex] = packedColor;
                }
                pixelIndex++;
            }
        } else {
            // No clipping - optimized path
            for (; pixelIndex < endIndex; pixelIndex++) {
                data32[pixelIndex] = packedColor;
            }
        }
    }

    /**
     * Horizontal span fill with alpha blending (source-over)
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (must be >= 0)
     * @param {number} y - Y coordinate of the span (must be in [0, surfaceHeight))
     * @param {number} length - Length of the span in pixels (must be > 0, startX + length <= surfaceWidth)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1)
     * @param {number} invAlpha - Inverse alpha (1 - alpha)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here with byte-skip optimization)
     */
    static fill_Alpha(data, surfaceWidth, surfaceHeight, startX, y, length, r, g, b, alpha, invAlpha, clipBuffer) {
        if (IS_DEBUG) {
            const yi = Math.floor(y);
            const x = Math.floor(startX);
            if (yi < 0 || yi >= surfaceHeight) {
                throw new Error(
                    `SpanOps.fill_Alpha: y out of bounds: y=${y} (yi=${yi}), surfaceHeight=${surfaceHeight}`
                );
            }
            if (x < 0) {
                throw new Error(`SpanOps.fill_Alpha: startX out of bounds: startX=${startX} (x=${x}), must be >= 0`);
            }
            if (x + length > surfaceWidth) {
                throw new Error(
                    `SpanOps.fill_Alpha: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`SpanOps.fill_Alpha: invalid length: ${length}, must be > 0`);
            }
        }

        const yi = Math.floor(y);
        const x = Math.floor(startX);
        const endX = x + length;
        const rowStart = yi * surfaceWidth;

        if (clipBuffer) {
            // With clipping - includes byte-skip optimization
            let px = x;
            while (px < endX) {
                const pixelIndex = rowStart + px;
                const byteIndex = pixelIndex >> 3;

                // Skip fully clipped bytes (8 pixels at a time)
                if (clipBuffer[byteIndex] === 0) {
                    const nextByteBoundary = (byteIndex + 1) << 3;
                    // Convert back to X coordinate with bounds check
                    px = Math.min(nextByteBoundary - rowStart, endX);
                    continue;
                }

                const bitOffset = pixelIndex & 7;
                if ((clipBuffer[byteIndex] & (1 << bitOffset)) !== 0) {
                    const __off = pixelIndex * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = alpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * alpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * alpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * alpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                }
                px++;
            }
        } else {
            // No clipping
            for (let px = x; px < endX; px++) {
                const pixelIndex = rowStart + px;
                const __off = pixelIndex * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = alpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * alpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * alpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * alpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
            }
        }
    }
}

/**
 * QuadScanOps - Static methods for quadrilateral scanline filling
 *
 * Specialized utility for filling 4-vertex convex shapes using scanline DDA.
 * Used by LineOps (thick diagonal lines) and RectOpsRot (semi-transparent strokes).
 *
 * NOT for general polygons - use PolygonFiller for arbitrary N-vertex shapes
 * with winding rules and paint source support.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Primitives):
 *   lineToQuad - Convert line + thickness to 4 corners
 *   fillQuad   - Scanline fill the quad (calls SpanOps for spans)
 */
class QuadScanOps {
    // Static pools - reused across calls to eliminate GC pressure
    static _edges = [
        { p1: null, p2: null, invDeltaY: 0, deltaX: 0, slope: 0, currentX: 0 },
        { p1: null, p2: null, invDeltaY: 0, deltaX: 0, slope: 0, currentX: 0 },
        { p1: null, p2: null, invDeltaY: 0, deltaX: 0, slope: 0, currentX: 0 },
        { p1: null, p2: null, invDeltaY: 0, deltaX: 0, slope: 0, currentX: 0 }
    ];
    static _edgeCount = 0;

    static _corners = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
    ];

    /**
     * Convert a line segment to a quadrilateral by adding perpendicular thickness.
     *
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} halfThickness - Half the stroke width
     * @returns {Object[]|null} 4 corner points [{x, y}, ...] or null for zero-length
     */
    static lineToQuad(x1, y1, x2, y2, halfThickness) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lineLength = Math.sqrt(dx * dx + dy * dy);

        if (lineLength === 0) {
            return null; // Caller handles zero-length case
        }

        const invLineLength = 1 / lineLength;
        const perpX = -dy * invLineLength;
        const perpY = dx * invLineLength;
        const perpXHalf = perpX * halfThickness;
        const perpYHalf = perpY * halfThickness;

        // Reuse static corner pool instead of allocating new objects
        const c = QuadScanOps._corners;
        c[0].x = x1 + perpXHalf;
        c[0].y = y1 + perpYHalf;
        c[1].x = x1 - perpXHalf;
        c[1].y = y1 - perpYHalf;
        c[2].x = x2 - perpXHalf;
        c[2].y = y2 - perpYHalf;
        c[3].x = x2 + perpXHalf;
        c[3].y = y2 + perpYHalf;
        return c;
    }

    /**
     * Scanline fill a quadrilateral defined by 4 corners.
     *
     * @param {Object[]} corners - 4 corner points [{x, y}, ...]
     * @param {Object} params - Rendering parameters
     * @param {Surface} params.surface - Target surface
     * @param {number} params.r - Red component (0-255)
     * @param {number} params.g - Green component (0-255)
     * @param {number} params.b - Blue component (0-255)
     * @param {boolean} params.isOpaque - Use 32-bit writes (true) or alpha blend (false)
     * @param {number} [params.packedColor] - Pre-packed color for opaque rendering
     * @param {number} [params.effectiveAlpha] - Effective alpha (0-1) for blending
     * @param {number} [params.invAlpha] - 1 - effectiveAlpha for blending
     * @param {Uint8Array|null} params.clipBuffer - Clip mask (CLIPPING: inline per-pixel or delegated to SpanOps depending on mode)
     * @param {Set|null} [params.collectTo] - Add rendered pixel positions to this Set
     * @param {Set|null} [params.skipFrom] - Skip pixels that are in this Set
     */
    static fillQuad(corners, params) {
        const { surface, r, g, b, isOpaque, clipBuffer } = params;
        const packedColor = params.packedColor || 0;
        const effectiveAlpha = params.effectiveAlpha || 0;
        const invAlpha = params.invAlpha || 0;
        const collectTo = params.collectTo || null;
        const skipFrom = params.skipFrom || null;

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const data = surface.data;

        // Find bounding box
        const minY = Math.max(0, Math.floor(Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y)));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y)));

        // Pre-compute edge data using static pool (no allocation)
        // Includes slope and initial currentX for incremental DDA
        QuadScanOps._edgeCount = 0;
        for (let i = 0; i < 4; i++) {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];

            if (p1.y !== p2.y) {
                // Skip horizontal edges
                const edge = QuadScanOps._edges[QuadScanOps._edgeCount++];
                edge.p1 = p1;
                edge.p2 = p2;
                edge.invDeltaY = 1 / (p2.y - p1.y);
                edge.deltaX = p2.x - p1.x;
                edge.slope = edge.deltaX * edge.invDeltaY;
                // Compute initial currentX at edge's first active scanline
                const edgeMinY = Math.min(p1.y, p2.y);
                const firstActiveY = Math.max(minY, Math.ceil(edgeMinY));
                edge.currentX = p1.x + (firstActiveY - p1.y) * edge.slope;
            }
        }

        // Determine rendering mode
        const usePerPixel = collectTo !== null || skipFrom !== null;
        const intersections = [];

        // Scanline fill with incremental DDA
        for (let y = minY; y <= maxY; y++) {
            intersections.length = 0;

            // Find x-intersections using incremental currentX
            for (let i = 0; i < QuadScanOps._edgeCount; i++) {
                const edge = QuadScanOps._edges[i];
                const p1 = edge.p1;
                const p2 = edge.p2;

                if ((y >= p1.y && y < p2.y) || (y >= p2.y && y < p1.y)) {
                    intersections.push(edge.currentX);
                    edge.currentX += edge.slope; // Incremental update (was: t * deltaX)
                }
            }

            if (intersections.length === 1) {
                // Single intersection - draw one pixel (edge case)
                const x = intersections[0] | 0;
                if (x >= 0 && x < width) {
                    const pixelIndex = y * width + x;

                    // Skip if in skipFrom Set
                    if (skipFrom && skipFrom.has(pixelIndex)) continue;

                    // Add to collectTo Set
                    if (collectTo) collectTo.add(pixelIndex);

                    // Check clipping
                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }

                    // Render pixel
                    if (isOpaque) {
                        data32[pixelIndex] = packedColor;
                    } else {
                        const __off = pixelIndex * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }
            } else if (intersections.length >= 2) {
                // Two or more intersections - draw span between min and max
                const x1i = intersections[0];
                const x2i = intersections[1];
                const leftX = Math.max(0, Math.ceil(Math.min(x1i, x2i)));
                const rightX = Math.min(width - 1, Math.floor(Math.max(x1i, x2i)));
                const spanLength = rightX - leftX + 1;

                if (spanLength > 0) {
                    if (usePerPixel) {
                        // Per-pixel mode for Set tracking
                        for (let x = leftX; x <= rightX; x++) {
                            const pixelIndex = y * width + x;

                            // Skip if in skipFrom Set
                            if (skipFrom && skipFrom.has(pixelIndex)) continue;

                            // Add to collectTo Set
                            if (collectTo) collectTo.add(pixelIndex);

                            // Check clipping
                            if (clipBuffer) {
                                const byteIndex = pixelIndex >> 3;
                                const bitIndex = pixelIndex & 7;
                                if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                            }

                            // Render pixel
                            if (isOpaque) {
                                data32[pixelIndex] = packedColor;
                            } else {
                                const __off = pixelIndex * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                            }
                        }
                    } else {
                        // Span mode using SpanOps (faster, no Set tracking)
                        if (isOpaque) {
                            SpanOps.fill_Opaq(data32, width, height, leftX, y, spanLength, packedColor, clipBuffer);
                        } else {
                            SpanOps.fill_Alpha(
                                data,
                                width,
                                height,
                                leftX,
                                y,
                                spanLength,
                                r,
                                g,
                                b,
                                effectiveAlpha,
                                invAlpha,
                                clipBuffer
                            );
                        }
                    }
                }
            }
        }
    }

    /**
     * Fill a square for zero-length line degeneration.
     *
     * @param {number} centerX - Center X
     * @param {number} centerY - Center Y
     * @param {number} halfSize - Half the square size (typically lineWidth / 2)
     * @param {Object} params - Same parameters as fillQuad (CLIPPING: inline per-pixel or delegated to SpanOps)
     */
    static fillSquare(centerX, centerY, halfSize, params) {
        const { surface, r, g, b, isOpaque, clipBuffer } = params;
        const packedColor = params.packedColor || 0;
        const effectiveAlpha = params.effectiveAlpha || 0;
        const invAlpha = params.invAlpha || 0;
        const collectTo = params.collectTo || null;
        const skipFrom = params.skipFrom || null;

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const data = surface.data;

        const usePerPixel = collectTo !== null || skipFrom !== null;

        // Calculate Y bounds using proper rounding
        const minY = Math.max(0, Math.floor(centerY - halfSize));
        const maxY = Math.min(height - 1, Math.ceil(centerY + halfSize));

        for (let y = minY; y <= maxY; y++) {
            // Calculate X bounds using ceil/floor for consistency with fillQuad
            const leftX = Math.max(0, Math.ceil(centerX - halfSize));
            const rightX = Math.min(width - 1, Math.floor(centerX + halfSize));
            const spanLength = rightX - leftX + 1;

            if (spanLength <= 0) continue;

            if (usePerPixel) {
                // Per-pixel mode for Set tracking
                for (let x = leftX; x <= rightX; x++) {
                    const pixelIndex = y * width + x;

                    if (skipFrom && skipFrom.has(pixelIndex)) continue;
                    if (collectTo) collectTo.add(pixelIndex);

                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }

                    if (isOpaque) {
                        data32[pixelIndex] = packedColor;
                    } else {
                        const __off = pixelIndex * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }
            } else {
                // Span mode using SpanOps
                if (isOpaque) {
                    SpanOps.fill_Opaq(data32, width, height, leftX, y, spanLength, packedColor, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        leftX,
                        y,
                        spanLength,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            }
        }
    }
}

/**
 * RectOpsRot - Static methods for rotated rectangle rendering
 *
 * This module handles all rotated (non-axis-aligned) rectangle rendering.
 * Called directly by Context2D for rotated operations.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): QuadScanOps.fillQuad, QuadScanOps.fillSquare
 *
 * Layer 1 (Primitives - do atomic rendering):
 *   fill_Rot_Any (scanline DDA via QuadScanOps)
 *   _stroke_Rot_Alpha (internal, uses QuadScanOps with Set tracking)
 *
 * Layer 2 (Composites - call other *Ops methods):
 *   stroke_Rot_Any       → LineOps.stroke_Any (for edges), _stroke_Rot_Alpha
 *   fillStroke_Rot_Any   → fill_Rot_Any + stroke_Rot_Any
 *
 * Helpers (private, used by rotated methods):
 *   _extendLine, _shortenLine, _blendPixelAlpha
 */
class RectOpsRot {
    // ========================================================================
    // PRIVATE HELPERS (used by rotated rendering)
    // ========================================================================

    /**
     * Extends a line segment by a given amount at both ends.
     * Used for proper miter joins at rectangle corners.
     * @param {Object} p1 - Start point {x, y}
     * @param {Object} p2 - End point {x, y}
     * @param {number} amount - Amount to extend at each end
     * @returns {Object} Extended line {start: {x, y}, end: {x, y}}
     * @private
     */
    static _extendLine(p1, p2, amount) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return { start: p1, end: p2 };

        const dirX = dx / len;
        const dirY = dy / len;

        return {
            start: { x: p1.x - dirX * amount, y: p1.y - dirY * amount },
            end: { x: p2.x + dirX * amount, y: p2.y + dirY * amount }
        };
    }

    /**
     * Shortens a line segment by a given amount at both ends.
     * Used for proper miter joins at rectangle corners.
     * @param {Object} p1 - Start point {x, y}
     * @param {Object} p2 - End point {x, y}
     * @param {number} amount - Amount to shorten at each end
     * @returns {Object} Shortened line {start: {x, y}, end: {x, y}}
     * @private
     */
    static _shortenLine(p1, p2, amount) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return { start: p1, end: p2 };

        const dirX = dx / len;
        const dirY = dy / len;

        return {
            start: { x: p1.x + dirX * amount, y: p1.y + dirY * amount },
            end: { x: p2.x - dirX * amount, y: p2.y - dirY * amount }
        };
    }

    /**
     * Blend a single pixel with alpha (with clipping check)
     * Used by _stroke_Rot_Alpha for overdraw prevention.
     * @param {Uint8Array|Uint8ClampedArray} data - Surface data array
     * @param {number} pos - Pixel position (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} effectiveAlpha - Effective alpha (0-1)
     * @param {number} invAlpha - 1 - effectiveAlpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     * @private
     */
    static _blendPixelAlpha(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer) {
        if (clipBuffer) {
            const byteIndex = pos >> 3;
            const bitIndex = pos & 7;
            if (!(clipBuffer[byteIndex] & (1 << bitIndex))) return;
        }
        const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
    }

    /**
     * 1px stroke drawing each edge individually using DDA.
     * Uses edge-based DDA that matches fill boundary computation:
     * - Y-major edges (|dy| >= |dx|): step Y, compute X, floor
     * - X-major edges (|dx| > |dy|): step X, compute Y, floor
     * - Horizontal edges (dy=0): draw all pixels at floor(y)
     * @param {Surface} surface - Target surface
     * @param {Array} corners - 4 corner points [{x, y}, ...]
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     * @param {boolean} isOpaqueColor - True if color is fully opaque
     * @private
     */
    static _stroke_Rot_1px_DDA(surface, corners, color, globalAlpha, clipBuffer, isOpaqueColor) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const data = surface.data;

        const packedColor = isOpaqueColor ? Surface.packColor(color.r, color.g, color.b, 255) : 0;
        const r = color.r,
            g = color.g,
            b = color.b;
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        const invAlpha = 1 - effectiveAlpha;

        // Draw each of the 4 edges
        for (let i = 0; i < 4; i++) {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;

            if (dy === 0) {
                // Horizontal edge: draw all pixels at floor(y)
                const y = p1.y | 0;
                if (y < 0 || y >= height) continue;
                const xStart = Math.ceil(Math.min(p1.x, p2.x));
                const xEnd = Math.floor(Math.max(p1.x, p2.x));

                for (let x = xStart; x <= xEnd; x++) {
                    if (x < 0 || x >= width) continue;
                    const pixelIndex = y * width + x;
                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }
                    if (isOpaqueColor) {
                        data32[pixelIndex] = packedColor;
                    } else {
                        RectOpsRot._blendPixelAlpha(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha, null);
                    }
                }
            } else if (Math.abs(dy) >= Math.abs(dx)) {
                // Y-major edge: step Y, compute X (matches fill DDA)
                const yStart = Math.ceil(Math.min(p1.y, p2.y));
                const yEnd = Math.floor(Math.max(p1.y, p2.y));
                const slope = dx / dy; // dX/dY

                for (let y = yStart; y <= yEnd; y++) {
                    if (y < 0 || y >= height) continue;
                    const x = (p1.x + (y - p1.y) * slope) | 0; // floor
                    if (x < 0 || x >= width) continue;

                    const pixelIndex = y * width + x;
                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }
                    if (isOpaqueColor) {
                        data32[pixelIndex] = packedColor;
                    } else {
                        RectOpsRot._blendPixelAlpha(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha, null);
                    }
                }
            } else {
                // X-major edge: step X, compute Y
                const xStart = Math.ceil(Math.min(p1.x, p2.x));
                const xEnd = Math.floor(Math.max(p1.x, p2.x));
                const slope = dy / dx; // dY/dX

                for (let x = xStart; x <= xEnd; x++) {
                    if (x < 0 || x >= width) continue;
                    const y = (p1.y + (x - p1.x) * slope) | 0; // floor
                    if (y < 0 || y >= height) continue;

                    const pixelIndex = y * width + x;
                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    }
                    if (isOpaqueColor) {
                        data32[pixelIndex] = packedColor;
                    } else {
                        RectOpsRot._blendPixelAlpha(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha, null);
                    }
                }
            }
        }
    }

    // ========================================================================
    // ROTATED FILL IMPLEMENTATION
    // ========================================================================

    /**
     * Rotated rectangle fill using optimized scanline DDA algorithm.
     * Delegates to QuadScanOps.fillQuad for 5-10x faster rendering than edge functions.
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     */
    static fill_Rot_Any(surface, centerX, centerY, width, height, rotation, color, globalAlpha, clipBuffer) {
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;
        const isOpaque = effectiveAlpha >= 1.0;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Calculate 4 corners of the rotated rectangle
        // Use sub-pixel coordinates - QuadScanOps handles discretization via DDA
        // Edge-based DDA stroke uses same corner coordinates for consistent boundaries
        const corners = [
            { x: centerX + hw * cos - hh * sin, y: centerY + hw * sin + hh * cos },
            { x: centerX + hw * cos + hh * sin, y: centerY + hw * sin - hh * cos },
            { x: centerX - hw * cos + hh * sin, y: centerY - hw * sin - hh * cos },
            { x: centerX - hw * cos - hh * sin, y: centerY - hw * sin + hh * cos }
        ];

        // Delegate to optimized scanline algorithm
        QuadScanOps.fillQuad(corners, {
            surface,
            r,
            g,
            b,
            isOpaque,
            packedColor: isOpaque ? Surface.packColor(r, g, b, 255) : 0,
            effectiveAlpha,
            invAlpha,
            clipBuffer
        });
    }

    // ========================================================================
    // ROTATED STROKE IMPLEMENTATIONS
    // ========================================================================

    /**
     * Rotated rectangle stroke with alpha blending (no overdraw).
     * Uses QuadScanOps with Set tracking to prevent overdraw at corner regions.
     * Single-pass optimization: render short edges first (add to Set), then long edges (check Set).
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     */
    static _stroke_Rot_Alpha(
        surface,
        centerX,
        centerY,
        width,
        height,
        rotation,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer
    ) {
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;
        const halfStroke = lineWidth / 2;

        // Calculate 4 corners (same as stroke_Rot_Any)
        const corners = [
            { x: centerX - hw * cos - hh * sin, y: centerY - hw * sin + hh * cos },
            { x: centerX + hw * cos - hh * sin, y: centerY + hw * sin + hh * cos },
            { x: centerX + hw * cos + hh * sin, y: centerY + hw * sin - hh * cos },
            { x: centerX - hw * cos + hh * sin, y: centerY - hw * sin - hh * cos }
        ];

        // Determine which edge pair is shorter at runtime
        // Extended edges (0,2): approx width + lineWidth
        // Shortened edges (1,3): approx height - lineWidth
        const extendedLength = width + lineWidth;
        const shortenedLength = Math.max(0, height - lineWidth);

        const renderedPixels = new Set();

        // Common params for QuadScanOps
        const baseParams = {
            surface,
            r,
            g,
            b,
            isOpaque: false,
            effectiveAlpha,
            invAlpha,
            clipBuffer
        };

        // Helper to process a single edge using QuadScanOps
        const processEdge = (i, extend, renderFirst) => {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];
            const line = extend
                ? RectOpsRot._extendLine(p1, p2, halfStroke)
                : RectOpsRot._shortenLine(p1, p2, halfStroke);

            const quadCorners = QuadScanOps.lineToQuad(line.start.x, line.start.y, line.end.x, line.end.y, halfStroke);

            const params = {
                ...baseParams,
                collectTo: renderFirst ? renderedPixels : null,
                skipFrom: renderFirst ? null : renderedPixels
            };

            if (quadCorners === null) {
                // Zero-length edge - use fillSquare
                QuadScanOps.fillSquare(line.start.x, line.start.y, halfStroke, params);
            } else {
                QuadScanOps.fillQuad(quadCorners, params);
            }
        };

        if (shortenedLength <= extendedLength) {
            // Shortened edges are shorter: render+add first, then extended with check
            processEdge(1, false, true); // shortened
            processEdge(3, false, true); // shortened
            processEdge(0, true, false); // extended with check
            processEdge(2, true, false); // extended with check
        } else {
            // Extended edges are shorter: render+add first, then shortened with check
            processEdge(0, true, true); // extended
            processEdge(2, true, true); // extended
            processEdge(1, false, false); // shortened with check
            processEdge(3, false, false); // shortened with check
        }
    }

    /**
     * Rotated rectangle stroke using LineOps for edges.
     * Uses extend/shorten strategy for proper miter joins at corners.
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     */
    static stroke_Rot_Any(
        surface,
        centerX,
        centerY,
        width,
        height,
        rotation,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer
    ) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Calculate 4 corners
        const corners = [
            { x: centerX - hw * cos - hh * sin, y: centerY - hw * sin + hh * cos },
            { x: centerX + hw * cos - hh * sin, y: centerY + hw * sin + hh * cos },
            { x: centerX + hw * cos + hh * sin, y: centerY + hw * sin - hh * cos },
            { x: centerX - hw * cos + hh * sin, y: centerY - hw * sin - hh * cos }
        ];

        const isOpaqueColor = color.a === 255 && globalAlpha >= 1.0;
        const isSemiTransparentColor = !isOpaqueColor && color.a > 0;

        // Handle 1px strokes - use edge-based DDA that matches fill boundaries
        if (lineWidth <= 1) {
            // Use same corner order as fill_Rot_Any for consistent DDA processing
            const fillCorners = [
                { x: centerX + hw * cos - hh * sin, y: centerY + hw * sin + hh * cos },
                { x: centerX + hw * cos + hh * sin, y: centerY + hw * sin - hh * cos },
                { x: centerX - hw * cos + hh * sin, y: centerY - hw * sin - hh * cos },
                { x: centerX - hw * cos - hh * sin, y: centerY - hw * sin + hh * cos }
            ];
            RectOpsRot._stroke_Rot_1px_DDA(surface, fillCorners, color, globalAlpha, clipBuffer, isOpaqueColor);
            return;
        }

        // For thick semitransparent strokes, use Set-based approach to prevent overdraw
        if (isSemiTransparentColor) {
            return RectOpsRot._stroke_Rot_Alpha(
                surface,
                centerX,
                centerY,
                width,
                height,
                rotation,
                lineWidth,
                color,
                globalAlpha,
                clipBuffer
            );
        }

        // Handle thick opaque strokes using QuadScanOps directly for consistent rasterization.
        // This avoids axis-aligned detection in LineOps.stroke_Any which uses different
        // algorithms causing 1-pixel gaps at edge joints for nearly-axis-aligned rotations.
        const halfStroke = lineWidth / 2;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        const params = {
            surface,
            r: color.r,
            g: color.g,
            b: color.b,
            isOpaque: true,
            packedColor,
            effectiveAlpha: 0,
            invAlpha: 0,
            clipBuffer
        };

        const renderEdge = (p1, p2, extend) => {
            const line = extend
                ? RectOpsRot._extendLine(p1, p2, halfStroke)
                : RectOpsRot._shortenLine(p1, p2, halfStroke);

            const quadCorners = QuadScanOps.lineToQuad(line.start.x, line.start.y, line.end.x, line.end.y, halfStroke);

            if (quadCorners === null) {
                QuadScanOps.fillSquare(line.start.x, line.start.y, halfStroke, params);
            } else {
                QuadScanOps.fillQuad(quadCorners, params);
            }
        };

        // Extended edges (0→1, 2→3) form corner regions
        renderEdge(corners[0], corners[1], true);
        renderEdge(corners[2], corners[3], true);

        // Shortened edges (1→2, 3→0) fit between extended edges
        renderEdge(corners[1], corners[2], false);
        renderEdge(corners[3], corners[0], false);
    }

    // ========================================================================
    // COMBINED FILL+STROKE
    // ========================================================================

    /**
     * Fill and stroke a rotated rectangle in a single operation.
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} fillColor - Fill color (may be null)
     * @param {Color} strokeColor - Stroke color (may be null)
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps or LineOps)
     */
    static fillStroke_Rot_Any(
        surface,
        centerX,
        centerY,
        width,
        height,
        rotation,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer
    ) {
        // Fill first, then stroke on top
        if (fillColor && fillColor.a > 0) {
            RectOpsRot.fill_Rot_Any(
                surface,
                centerX,
                centerY,
                width,
                height,
                rotation,
                fillColor,
                globalAlpha,
                clipBuffer
            );
        }
        if (strokeColor && strokeColor.a > 0 && lineWidth > 0) {
            RectOpsRot.stroke_Rot_Any(
                surface,
                centerX,
                centerY,
                width,
                height,
                rotation,
                lineWidth,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
        }
    }
}

/**
 * RectOpsAA - Static methods for optimized AXIS-ALIGNED rectangle rendering
 * Follows PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillRect(), strokeRect()
 *
 * Path-based rectangles (beginPath() + rect() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * NOTE: Rotated rectangle rendering is handled by RectOpsRot (called directly
 * by Context2D). This class only handles axis-aligned (AA) rectangles.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha
 *
 * Layer 1 (Primitives - do atomic rendering):
 *   fill_AA_Opaq, fill_AA_Alpha
 *   stroke1px_AA_Opaq, stroke1px_AA_Alpha
 *   strokeThick_AA_Opaq, strokeThick_AA_Alpha
 *
 * Layer 2 (Composites - call SpanOps):
 *   fillStroke_AA_Any    → SpanOps (inline)
 *
 * NAMING PATTERN: {operation}[Thickness]_{orientation}_{opacity}
 *   - AA = Axis-Aligned
 *   - Opaq = Opaque only, Alpha = Semi-transparent, Any = Handles both
 */
class RectOpsAA {
    /**
     * Optimized 1px opaque rectangle stroke using direct pixel drawing
     * Matches Canvas grid-line to pixel-coordinate conversion
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_AA_Opaq(surface, x, y, width, height, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Calculate rectangle pixel bounds
        // For strokeRect(132.5, 126.5, 135, 47):
        // - Path spans (132.5, 126.5) to (267.5, 173.5)
        // - 1px stroke renders at: left=132, right=267, top=126, bottom=173
        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.floor(x + width);
        const bottom = Math.floor(y + height);

        // Draw top edge (horizontal): pixels from left to right (inclusive)
        if (top >= 0 && top < surfaceHeight) {
            for (let px = Math.max(0, left); px <= Math.min(right, surfaceWidth - 1); px++) {
                const pos = top * surfaceWidth + px;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
            }
        }

        // Draw bottom edge (horizontal): pixels from left to right (inclusive)
        if (bottom >= 0 && bottom < surfaceHeight) {
            for (let px = Math.max(0, left); px <= Math.min(right, surfaceWidth - 1); px++) {
                const pos = bottom * surfaceWidth + px;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
            }
        }

        // Draw left edge (vertical): skip corners (already drawn)
        if (left >= 0 && left < surfaceWidth) {
            for (let py = Math.max(0, top + 1); py < Math.min(bottom, surfaceHeight); py++) {
                const pos = py * surfaceWidth + left;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
            }
        }

        // Draw right edge (vertical): skip corners (already drawn)
        if (right >= 0 && right < surfaceWidth) {
            for (let py = Math.max(0, top + 1); py < Math.min(bottom, surfaceHeight); py++) {
                const pos = py * surfaceWidth + right;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
            }
        }
    }

    /**
     * Optimized 1px semi-transparent rectangle stroke using direct pixel drawing
     * Matches Canvas grid-line to pixel-coordinate conversion
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_AA_Alpha(surface, x, y, width, height, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Calculate rectangle pixel bounds
        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.floor(x + width);
        const bottom = Math.floor(y + height);

        // Draw top edge (horizontal): pixels from left to right (inclusive)
        if (top >= 0 && top < surfaceHeight) {
            for (let px = Math.max(0, left); px <= Math.min(right, surfaceWidth - 1); px++) {
                const pos = top * surfaceWidth + px;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
            }
        }

        // Draw bottom edge (horizontal): pixels from left to right (inclusive)
        if (bottom >= 0 && bottom < surfaceHeight) {
            for (let px = Math.max(0, left); px <= Math.min(right, surfaceWidth - 1); px++) {
                const pos = bottom * surfaceWidth + px;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
            }
        }

        // Draw left edge (vertical): skip corners (already drawn)
        if (left >= 0 && left < surfaceWidth) {
            for (let py = Math.max(0, top + 1); py < Math.min(bottom, surfaceHeight); py++) {
                const pos = py * surfaceWidth + left;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
            }
        }

        // Draw right edge (vertical): skip corners (already drawn)
        if (right >= 0 && right < surfaceWidth) {
            for (let py = Math.max(0, top + 1); py < Math.min(bottom, surfaceHeight); py++) {
                const pos = py * surfaceWidth + right;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
            }
        }
    }

    /**
     * Optimized thick stroke rectangle using direct pixel drawing
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static strokeThick_AA_Opaq(surface, x, y, width, height, lineWidth, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        const halfStroke = lineWidth / 2;

        // Calculate stroke geometry (edge centers)
        // Keep as floats - don't floor early for sub-pixel accuracy
        // and only floors when calculating actual pixel positions
        const left = x;
        const top = y;
        const right = x + width;
        const bottom = y + height;

        // Draw horizontal strokes (top and bottom edges with full thickness)
        for (let px = Math.floor(left - halfStroke); px < right + halfStroke; px++) {
            if (px < 0 || px >= surfaceWidth) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Top edge
                const pyTop = Math.floor(top + t);
                if (pyTop >= 0 && pyTop < surfaceHeight) {
                    const pos = pyTop * surfaceWidth + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
                // Bottom edge
                const pyBottom = Math.floor(bottom + t);
                if (pyBottom >= 0 && pyBottom < surfaceHeight) {
                    const pos = pyBottom * surfaceWidth + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
            }
        }

        // Draw vertical strokes (left and right edges, excluding corners already drawn)
        for (let py = Math.floor(top + halfStroke); py < bottom - halfStroke; py++) {
            if (py < 0 || py >= surfaceHeight) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Left edge
                const pxLeft = Math.floor(left + t);
                if (pxLeft >= 0 && pxLeft < surfaceWidth) {
                    const pos = py * surfaceWidth + pxLeft;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
                // Right edge
                const pxRight = Math.floor(right + t);
                if (pxRight >= 0 && pxRight < surfaceWidth) {
                    const pos = py * surfaceWidth + pxRight;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
            }
        }
    }

    /**
     * Optimized thick stroke rectangle with alpha blending
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static strokeThick_AA_Alpha(surface, x, y, width, height, lineWidth, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        const halfStroke = lineWidth / 2;

        // Calculate stroke geometry (edge centers)
        // Keep as floats - don't floor early for sub-pixel accuracy
        // and only floors when calculating actual pixel positions
        const left = x;
        const top = y;
        const right = x + width;
        const bottom = y + height;

        // Draw horizontal strokes (top and bottom edges with full thickness)
        for (let px = Math.floor(left - halfStroke); px < right + halfStroke; px++) {
            if (px < 0 || px >= surfaceWidth) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Top edge
                const pyTop = Math.floor(top + t);
                if (pyTop >= 0 && pyTop < surfaceHeight) {
                    const pos = pyTop * surfaceWidth + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
                }
                // Bottom edge
                const pyBottom = Math.floor(bottom + t);
                if (pyBottom >= 0 && pyBottom < surfaceHeight) {
                    const pos = pyBottom * surfaceWidth + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
                }
            }
        }

        // Calculate exact Y bounds to prevent corner overlap with non-integer geometry
        // The t loop iterates ceil(lineWidth) times, so the last t value is:
        const numTIterations = Math.ceil(lineWidth);
        const lastT = -halfStroke + numTIterations - 1;
        const topStrokeMaxY = Math.floor(top + lastT);
        const bottomStrokeMinY = Math.floor(bottom - halfStroke);

        // Draw vertical strokes (left and right edges, excluding corners)
        // Use px-based iteration to match horizontal stroke X coverage
        for (let py = topStrokeMaxY + 1; py < bottomStrokeMinY; py++) {
            if (py < 0 || py >= surfaceHeight) continue;
            // Left edge
            for (let px = Math.floor(left - halfStroke); px < left + halfStroke; px++) {
                if (px >= 0 && px < surfaceWidth) {
                    const pos = py * surfaceWidth + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
                }
            }
            // Right edge
            for (let px = Math.floor(right - halfStroke); px < right + halfStroke; px++) {
                if (px >= 0 && px < surfaceWidth) {
                    const pos = py * surfaceWidth + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
                }
            }
        }
    }

    /**
     * Check if rotation angle is near axis-aligned (0°, 90°, 180°, 270°)
     * @param {number} angle - Rotation angle in radians
     * @returns {boolean} True if near axis-aligned
     */
    static isNearAxisAligned(angle) {
        const tolerance = ANGLE_TOLERANCE;
        const normalized = ((angle % TAU) + TAU) % TAU;
        return (
            Math.abs(normalized) < tolerance ||
            Math.abs(normalized - HALF_PI) < tolerance ||
            Math.abs(normalized - Math.PI) < tolerance ||
            Math.abs(normalized - THREE_HALF_PI) < tolerance ||
            Math.abs(normalized - TAU) < tolerance
        );
    }

    /**
     * Get adjusted dimensions for 90°/270° rotations (swap width/height)
     * @param {number} width - Original width
     * @param {number} height - Original height
     * @param {number} angle - Rotation angle in radians
     * @returns {{adjustedWidth: number, adjustedHeight: number}} Adjusted dimensions
     */
    static getRotatedDimensions(width, height, angle) {
        const tolerance = ANGLE_TOLERANCE;
        const normalized = ((angle % TAU) + TAU) % TAU;
        if (Math.abs(normalized - HALF_PI) < tolerance || Math.abs(normalized - THREE_HALF_PI) < tolerance) {
            return { adjustedWidth: height, adjustedHeight: width };
        }
        return { adjustedWidth: width, adjustedHeight: height };
    }

    /**
     * Optimized opaque rectangle fill using direct 32-bit pixel writes
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Color} color - Fill color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fill_AA_Opaq(surface, x, y, width, height, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.ceil(x + width);
        const bottom = Math.ceil(y + height);

        for (let py = Math.max(0, top); py < Math.min(bottom, surfaceHeight); py++) {
            for (let px = Math.max(0, left); px < Math.min(right, surfaceWidth); px++) {
                const pixelIndex = py * surfaceWidth + px;

                if (clipBuffer) {
                    const byteIndex = pixelIndex >> 3;
                    const bitIndex = pixelIndex & 7;
                    if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                }

                data32[pixelIndex] = packedColor;
            }
        }
    }

    /**
     * Optimized alpha-blended rectangle fill
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fill_AA_Alpha(surface, x, y, width, height, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.ceil(x + width);
        const bottom = Math.ceil(y + height);

        for (let py = Math.max(0, top); py < Math.min(bottom, surfaceHeight); py++) {
            for (let px = Math.max(0, left); px < Math.min(right, surfaceWidth); px++) {
                const pixelIndex = py * surfaceWidth + px;

                if (clipBuffer) {
                    const byteIndex = pixelIndex >> 3;
                    const bitIndex = pixelIndex & 7;
                    if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                }

                const __off = pixelIndex * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
            }
        }
    }

    /**
     * Combined fill and stroke for rectangles - single-scan span-based rendering.
     * Uses fill-first ordering for correct semi-transparent stroke blending.
     *
     * For semi-transparent strokes: fill renders to PATH extent first, then stroke
     * renders on top and blends correctly with the fill underneath.
     *
     * For opaque strokes: fill renders to INNER extent (stroke covers overlap anyway).
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} fillColor - Fill color (may be null)
     * @param {Color} strokeColor - Stroke color (may be null)
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fillStroke_AA_Any(
        surface,
        x,
        y,
        width,
        height,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer = null
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        const halfStroke = hasStroke ? lineWidth / 2 : 0;

        // Determine rendering modes
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;

        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Key check: is stroke semi-transparent? (needs fill-first blending)
        const strokeIsSemiTransparent = hasStroke && !strokeIsOpaque;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Pre-compute composite color for overlap regions (stroke over fill)
        // Uses Porter-Duff source-over: stroke OVER fill
        // This eliminates overdraw by rendering overlap regions once with pre-composited color
        let compositeR = 0,
            compositeG = 0,
            compositeB = 0;
        let compositeAlpha = 0,
            compositeInvAlpha = 1;
        const useCompositeOptimization = strokeIsSemiTransparent && hasFill;

        if (useCompositeOptimization) {
            // Porter-Duff: outA = srcA + dstA * (1 - srcA)
            compositeAlpha = strokeEffectiveAlpha + fillEffectiveAlpha * (1 - strokeEffectiveAlpha);

            if (compositeAlpha > 0) {
                compositeInvAlpha = 1 - compositeAlpha;

                // Non-premultiplied RGB composite
                const fillContrib = (fillEffectiveAlpha * (1 - strokeEffectiveAlpha)) / compositeAlpha;
                const strokeContrib = strokeEffectiveAlpha / compositeAlpha;

                compositeR = Math.round(strokeColor.r * strokeContrib + fillColor.r * fillContrib);
                compositeG = Math.round(strokeColor.g * strokeContrib + fillColor.g * fillContrib);
                compositeB = Math.round(strokeColor.b * strokeContrib + fillColor.b * fillContrib);
            }
        }

        // Calculate bounds
        // Path bounds (fill boundary)
        const pathLeft = Math.floor(x);
        const pathTop = Math.floor(y);
        const pathRight = Math.ceil(x + width);
        const pathBottom = Math.ceil(y + height);

        // Stroke outer bounds (scan region when stroke present)
        const strokeOuterLeft = hasStroke ? Math.floor(x - halfStroke) : pathLeft;
        const strokeOuterTop = hasStroke ? Math.floor(y - halfStroke) : pathTop;
        const strokeOuterRight = hasStroke ? Math.ceil(x + width + halfStroke) : pathRight;
        const strokeOuterBottom = hasStroke ? Math.ceil(y + height + halfStroke) : pathBottom;

        // Stroke inner bounds (interior where no stroke is drawn)
        const strokeInnerLeft = hasStroke ? Math.ceil(x + halfStroke) : pathLeft;
        const strokeInnerTop = hasStroke ? Math.ceil(y + halfStroke) : pathTop;
        const strokeInnerRight = hasStroke ? Math.floor(x + width - halfStroke) : pathRight;
        const strokeInnerBottom = hasStroke ? Math.floor(y + height - halfStroke) : pathBottom;

        // Span rendering helpers
        const renderFillSpan = (left, right, py) => {
            const spanLeft = Math.max(0, left);
            const spanRight = Math.min(surfaceWidth, right);
            const length = spanRight - spanLeft;
            if (length <= 0) return;

            if (fillIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, spanLeft, py, length, fillPacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    spanLeft,
                    py,
                    length,
                    fillColor.r,
                    fillColor.g,
                    fillColor.b,
                    fillEffectiveAlpha,
                    fillInvAlpha,
                    clipBuffer
                );
            }
        };

        const renderStrokeSpan = (left, right, py) => {
            const spanLeft = Math.max(0, left);
            const spanRight = Math.min(surfaceWidth, right);
            const length = spanRight - spanLeft;
            if (length <= 0) return;

            if (strokeIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, spanLeft, py, length, strokePacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    spanLeft,
                    py,
                    length,
                    strokeColor.r,
                    strokeColor.g,
                    strokeColor.b,
                    strokeEffectiveAlpha,
                    strokeInvAlpha,
                    clipBuffer
                );
            }
        };

        // Composite span helper for pre-composited fill+stroke overlap regions
        const renderCompositeSpan = (left, right, py) => {
            const spanLeft = Math.max(0, left);
            const spanRight = Math.min(surfaceWidth, right);
            const length = spanRight - spanLeft;
            if (length <= 0) return;

            SpanOps.fill_Alpha(
                data,
                surfaceWidth,
                surfaceHeight,
                spanLeft,
                py,
                length,
                compositeR,
                compositeG,
                compositeB,
                compositeAlpha,
                compositeInvAlpha,
                clipBuffer
            );
        };

        // Single-pass scanline rendering
        for (let py = strokeOuterTop; py < strokeOuterBottom; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            const inVerticalStrokeZone = hasStroke && (py < strokeInnerTop || py >= strokeInnerBottom);

            if (inVerticalStrokeZone) {
                // Top/bottom stroke zones
                if (useCompositeOptimization && py >= pathTop && py < pathBottom) {
                    // Stroke zone overlaps fill: render 3 segments (no overdraw)
                    // Segment 1: stroke-only left of fill
                    if (strokeOuterLeft < pathLeft) {
                        renderStrokeSpan(strokeOuterLeft, pathLeft, py);
                    }
                    // Segment 2: composite where stroke overlaps fill
                    renderCompositeSpan(pathLeft, pathRight, py);
                    // Segment 3: stroke-only right of fill
                    if (pathRight < strokeOuterRight) {
                        renderStrokeSpan(pathRight, strokeOuterRight, py);
                    }
                } else if (hasStroke) {
                    // Pure stroke (no fill overlap) - full span
                    renderStrokeSpan(strokeOuterLeft, strokeOuterRight, py);
                }
            } else if (py >= pathTop && py < pathBottom) {
                // Interior rows

                if (useCompositeOptimization && hasStroke) {
                    // 5-segment rendering: zero overdraw
                    // Segment 1: stroke-only left
                    if (strokeOuterLeft < pathLeft) {
                        renderStrokeSpan(strokeOuterLeft, pathLeft, py);
                    }
                    // Segment 2: composite left (fill+stroke overlap)
                    if (pathLeft < strokeInnerLeft) {
                        renderCompositeSpan(pathLeft, strokeInnerLeft, py);
                    }
                    // Segment 3: fill-only center
                    if (hasFill && strokeInnerLeft < strokeInnerRight) {
                        renderFillSpan(strokeInnerLeft, strokeInnerRight, py);
                    }
                    // Segment 4: composite right (fill+stroke overlap)
                    if (strokeInnerRight < pathRight) {
                        renderCompositeSpan(strokeInnerRight, pathRight, py);
                    }
                    // Segment 5: stroke-only right
                    if (pathRight < strokeOuterRight) {
                        renderStrokeSpan(pathRight, strokeOuterRight, py);
                    }
                } else {
                    // Opaque stroke or fill-only: existing optimized path
                    if (hasFill) {
                        const fillLeft = hasStroke ? strokeInnerLeft : pathLeft;
                        const fillRight = hasStroke ? strokeInnerRight : pathRight;
                        if (fillLeft < fillRight) {
                            renderFillSpan(fillLeft, fillRight, py);
                        }
                    }
                    if (hasStroke) {
                        if (strokeOuterLeft < strokeInnerLeft) {
                            renderStrokeSpan(strokeOuterLeft, strokeInnerLeft, py);
                        }
                        if (strokeInnerRight < strokeOuterRight) {
                            renderStrokeSpan(strokeInnerRight, strokeOuterRight, py);
                        }
                    }
                }
            }
        }
    }
}

/**
 * CircleOps - Static methods for optimized circle rendering
 * Follows PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillCircle(), strokeCircle(), fillStrokeCircle()
 *
 * Path-based circles (beginPath() + arc() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * Algorithm notes: Uses a Bresenham circle variant with specific adjustments
 * (center offset, +1 boundary corrections) for correct extreme pixel rendering.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Primitives):
 *   fill_Opaq, fill_Alpha              → SpanOps.fill_Opaq/fill_Alpha
 *   stroke1px_Opaq                     → Direct pixel writes (opaque)
 *   stroke1px_Alpha                    → Inline BLEND_ALPHA marker
 *   strokeThick_Opaq                   → SpanOps.fill_Opaq
 *   strokeThick_Alpha                  → SpanOps.fill_Alpha
 *
 * Layer 2 (Composites):
 *   fillStroke_Any                     → SpanOps.fill_Opaq/fill_Alpha
 *
 * MEMORY OPTIMIZATIONS:
 * - stroke1px_Alpha uses conditional deduplication (no Set allocation)
 *   via x!=y + cardinal point checks to prevent overdraw
 *
 * NAMING PATTERN: {operation}[Thickness]_{opacity}
 *   - Opaq = Opaque only, Alpha = Semi-transparent, Any = Handles both
 *   - (No orientation suffix - circles are rotation-invariant)
 */
class CircleOps {
    /**
     * Generate horizontal extents for each scanline of a circle using Bresenham
     * Uses Bresenham circle algorithm variant optimized for correct extreme pixel rendering
     * @param {number} radius - Circle radius (can be float)
     * @returns {object|null} { extents, intRadius, xOffset, yOffset } or null for invalid radius
     */
    static generateExtents(radius) {
        const intRadius = Math.floor(radius);
        if (intRadius < 0) return null;

        // Determine offsets for .5 radius case (affects boundary calculations)
        let xOffset = 0,
            yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            return { extents: [0], intRadius: 0, xOffset, yOffset };
        }

        // Bresenham initialization (midpoint circle algorithm variant)
        const extents = new Array(intRadius + 1).fill(0);
        let x = 0;
        let y = intRadius;
        let d = 3 - 2 * intRadius;

        while (x <= y) {
            // Record extents using max to handle octant overlap
            extents[y] = Math.max(extents[y], x);
            extents[x] = Math.max(extents[x], y);

            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }

        return { extents, intRadius, xOffset, yOffset };
    }

    /**
     * Optimized opaque circle fill using Bresenham scanlines with 32-bit packed writes
     * Uses Bresenham variant with pixel corrections for accurate rendering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Fill color (must be opaque, alpha=255)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fill_Opaq(surface, cx, cy, radius, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Generate extents with Bresenham algorithm
        const extentData = CircleOps.generateExtents(radius);
        if (!extentData) return;
        const { extents, intRadius, xOffset, yOffset } = extentData;

        // Center adjustment for pixel-perfect rendering
        const adjCenterX = Math.floor(cx - 0.5);
        const adjCenterY = Math.floor(cy - 0.5);

        // Fill scanlines - iterate through ALL rows (no skipping)
        for (let rel_y = 0; rel_y <= intRadius; rel_y++) {
            const max_rel_x = extents[rel_y];

            // +1 corrections on min boundaries for pixel accuracy
            const abs_x_min = adjCenterX - max_rel_x - xOffset + 1;
            const abs_x_max = adjCenterX + max_rel_x;
            const abs_y_bottom = adjCenterY + rel_y;
            const abs_y_top = adjCenterY - rel_y - yOffset + 1;

            // Clamp X coordinates to canvas bounds to prevent memory wrap-around
            const clampedStartX = Math.max(0, abs_x_min);
            const clampedEndX = Math.min(width - 1, abs_x_max);
            const spanWidth = clampedEndX - clampedStartX + 1;

            // Skip if span is entirely off-screen
            if (spanWidth <= 0) continue;

            // Draw bottom scanline
            if (abs_y_bottom >= 0 && abs_y_bottom < height) {
                SpanOps.fill_Opaq(
                    data32,
                    width,
                    height,
                    clampedStartX,
                    abs_y_bottom,
                    spanWidth,
                    packedColor,
                    clipBuffer
                );
            }

            // Draw top scanline (skip overdraw conditions)
            const drawTop = rel_y > 0 && !(rel_y === 1 && yOffset === 0);
            if (drawTop && abs_y_top >= 0 && abs_y_top < height) {
                SpanOps.fill_Opaq(data32, width, height, clampedStartX, abs_y_top, spanWidth, packedColor, clipBuffer);
            }
        }
    }

    /**
     * Optimized circle fill with alpha blending using Bresenham scanlines
     * Uses Bresenham variant with pixel corrections for accurate rendering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fill_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        // Calculate effective alpha (color alpha * global alpha)
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;

        const invAlpha = 1 - effectiveAlpha;
        const r = color.r;
        const g = color.g;
        const b = color.b;

        // Generate extents with Bresenham algorithm
        const extentData = CircleOps.generateExtents(radius);
        if (!extentData) return;
        const { extents, intRadius, xOffset, yOffset } = extentData;

        // Center adjustment for pixel-perfect rendering
        const adjCenterX = Math.floor(cx - 0.5);
        const adjCenterY = Math.floor(cy - 0.5);

        // Fill scanlines - iterate through ALL rows (no skipping)
        for (let rel_y = 0; rel_y <= intRadius; rel_y++) {
            const max_rel_x = extents[rel_y];

            // +1 corrections on min boundaries for pixel accuracy
            const abs_x_min = adjCenterX - max_rel_x - xOffset + 1;
            const abs_x_max = adjCenterX + max_rel_x;
            const abs_y_bottom = adjCenterY + rel_y;
            const abs_y_top = adjCenterY - rel_y - yOffset + 1;

            // Clamp X coordinates to canvas bounds to prevent memory wrap-around
            const clampedStartX = Math.max(0, abs_x_min);
            const clampedEndX = Math.min(width - 1, abs_x_max);
            const spanWidth = clampedEndX - clampedStartX + 1;

            // Skip if span is entirely off-screen
            if (spanWidth <= 0) continue;

            // Draw bottom scanline
            if (abs_y_bottom >= 0 && abs_y_bottom < height) {
                SpanOps.fill_Alpha(
                    data,
                    width,
                    height,
                    clampedStartX,
                    abs_y_bottom,
                    spanWidth,
                    r,
                    g,
                    b,
                    effectiveAlpha,
                    invAlpha,
                    clipBuffer
                );
            }

            // Draw top scanline (skip overdraw conditions)
            const drawTop = rel_y > 0 && !(rel_y === 1 && yOffset === 0);
            if (drawTop && abs_y_top >= 0 && abs_y_top < height) {
                SpanOps.fill_Alpha(
                    data,
                    width,
                    height,
                    clampedStartX,
                    abs_y_top,
                    spanWidth,
                    r,
                    g,
                    b,
                    effectiveAlpha,
                    invAlpha,
                    clipBuffer
                );
            }
        }
    }

    /**
     * Optimized 1px opaque circle stroke using Bresenham's algorithm
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Opaq(surface, cx, cy, radius, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Center calculation for stroke (standard Bresenham approach)
        const cX = Math.floor(cx);
        const cY = Math.floor(cy);
        const intRadius = Math.floor(radius);

        if (intRadius < 0) return;

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            if (radius >= 0) {
                const px = Math.round(cx);
                const py = Math.round(cy);
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const pos = py * width + px;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        data32[pos] = packedColor;
                    }
                }
            }
            return;
        }

        // Determine offsets for .5 radius case
        let xOffset = 0,
            yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        // Bresenham circle algorithm
        let x = 0;
        let y = intRadius;
        let d = 3 - 2 * intRadius;

        while (x <= y) {
            // Calculate 8 symmetric points with offsets for top/left halves
            // Note: Quadrant labels use screen coordinates (Y-down). In standard math (Y-up):
            // bottom-right = Q1, top-right = Q4, top-left = Q3, bottom-left = Q2
            const p1x = cX + x,
                p1y = cY + y; // bottom-right (math: Q1)
            const p2x = cX + y,
                p2y = cY + x; // bottom-right (math: Q1)
            const p3x = cX + y,
                p3y = cY - x - yOffset; // top-right (math: Q4)
            const p4x = cX + x,
                p4y = cY - y - yOffset; // top-right (math: Q4)
            const p5x = cX - x - xOffset,
                p5y = cY - y - yOffset; // top-left (math: Q3)
            const p6x = cX - y - xOffset,
                p6y = cY - x - yOffset; // top-left (math: Q3)
            const p7x = cX - y - xOffset,
                p7y = cY + x; // bottom-left (math: Q2)
            const p8x = cX - x - xOffset,
                p8y = cY + y; // bottom-left (math: Q2)

            // Plot points with bounds checking
            if (p1x >= 0 && p1x < width && p1y >= 0 && p1y < height) {
                const pos = p1y * width + p1x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (x !== y && p2x >= 0 && p2x < width && p2y >= 0 && p2y < height) {
                const pos = p2y * width + p2x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p3x >= 0 && p3x < width && p3y >= 0 && p3y < height) {
                const pos = p3y * width + p3x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p4x >= 0 && p4x < width && p4y >= 0 && p4y < height) {
                const pos = p4y * width + p4x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p5x >= 0 && p5x < width && p5y >= 0 && p5y < height) {
                const pos = p5y * width + p5x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (x !== y && p6x >= 0 && p6x < width && p6y >= 0 && p6y < height) {
                const pos = p6y * width + p6x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p7x >= 0 && p7x < width && p7y >= 0 && p7y < height) {
                const pos = p7y * width + p7x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            if (p8x >= 0 && p8x < width && p8y >= 0 && p8y < height) {
                const pos = p8y * width + p8x;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }

            // Update Bresenham state
            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }
    }

    /**
     * Optimized 1px semi-transparent circle stroke using Bresenham's algorithm
     * Uses Set to prevent overdraw for semi-transparent colors
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Center calculation for stroke (standard Bresenham approach)
        const cX = Math.floor(cx);
        const cY = Math.floor(cy);
        const intRadius = Math.floor(radius);

        if (intRadius < 0) return;

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            if (radius >= 0) {
                const px = Math.round(cx);
                const py = Math.round(cy);
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const pos = py * width + px;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }
            }
            return;
        }

        // Determine offsets for .5 radius case
        let xOffset = 0,
            yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        // Bresenham circle algorithm with conditional checks to prevent overdraw
        // (eliminates Set allocation by using geometric deduplication)
        let x = 0;
        let y = intRadius;
        let d = 3 - 2 * intRadius;

        while (x <= y) {
            // Calculate 8 symmetric points with offsets for top/left halves
            // Primary points (A, C, E, G) - always unique from each other
            // Note: Quadrant labels use screen coordinates (Y-down). In standard math (Y-up):
            // bottom-right = Q1, top-right = Q4, top-left = Q3, bottom-left = Q2
            const pAx = cX + x,
                pAy = cY + y; // bottom-right quadrant (math: Q1)
            const pCx = cX + y,
                pCy = cY - x - yOffset; // top-right quadrant (math: Q4)
            const pEx = cX - x - xOffset,
                pEy = cY - y - yOffset; // top-left quadrant (math: Q3)
            const pGx = cX - y - xOffset,
                pGy = cY + x; // bottom-left quadrant (math: Q2)

            // Swapped points (B, D, F, H) - duplicate primaries when x == y
            const pBx = cX + y,
                pBy = cY + x; // duplicates A when x == y
            const pDx = cX + x,
                pDy = cY - y - yOffset; // duplicates C when x == y
            const pFx = cX - y - xOffset,
                pFy = cY - x - yOffset; // duplicates E when x == y
            const pHx = cX - x - xOffset,
                pHy = cY + y; // duplicates G when x == y, also A when x == 0 && xOffset == 0

            // Draw primary points (always)
            if (pAx >= 0 && pAx < width && pAy >= 0 && pAy < height) {
                const pos = pAy * width + pAx;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                }
            }
            if (pCx >= 0 && pCx < width && pCy >= 0 && pCy < height) {
                const pos = pCy * width + pCx;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                }
            }
            if (pEx >= 0 && pEx < width && pEy >= 0 && pEy < height) {
                const pos = pEy * width + pEx;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                }
            }
            if (pGx >= 0 && pGx < width && pGy >= 0 && pGy < height) {
                const pos = pGy * width + pGx;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                }
            }

            // Draw swapped points only when x != y (they duplicate primaries on the diagonal)
            // Additional cardinal point checks: at x == 0, swapped points may duplicate primaries
            if (x !== y) {
                // B duplicates C at right cardinal when x == 0 && yOffset == 0
                if ((x !== 0 || yOffset !== 0) && pBx >= 0 && pBx < width && pBy >= 0 && pBy < height) {
                    const pos = pBy * width + pBx;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }
                // D duplicates E at top cardinal when x == 0 && xOffset == 0
                if ((x !== 0 || xOffset !== 0) && pDx >= 0 && pDx < width && pDy >= 0 && pDy < height) {
                    const pos = pDy * width + pDx;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }
                // F duplicates G at left cardinal when x == 0 && yOffset == 0
                if ((x !== 0 || yOffset !== 0) && pFx >= 0 && pFx < width && pFy >= 0 && pFy < height) {
                    const pos = pFy * width + pFx;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }
                // H duplicates A at bottom cardinal when x == 0 && xOffset == 0
                if ((x !== 0 || xOffset !== 0) && pHx >= 0 && pHx < width && pHy >= 0 && pHy < height) {
                    const pos = pHy * width + pHx;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }
            }

            // Update Bresenham state
            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }
    }

    /**
     * Unified fill and stroke rendering for circles.
     * This method draws both fill and stroke in a single coordinated pass,
     * ensuring no gaps between fill and stroke boundaries.
     *
     * Optimized circle fill+stroke approach using:
     * - Uses single floating-point center (cx - 0.5) for both operations
     * - Uses analytical boundary detection (sqrt-based) instead of Bresenham extents
     * - Uses epsilon contraction (FILL_EPSILON) on fill boundaries to prevent speckles
     * - Renders fill first, then stroke on top (stroke covers any micro-gaps)
     *
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius (path radius)
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color
     * @param {Color} strokeColor - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fillStroke_Any(surface, cx, cy, radius, lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0;

        if (!hasFill && !hasStroke) return;

        // Single floating-point center for both fill and stroke
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate radii based on stroke width
        // The path radius is the center of the stroke
        // Inner radius = radius - lineWidth/2 (fill boundary / stroke inner edge)
        // Outer radius = radius + lineWidth/2 (stroke outer edge)
        // Fill extends to the path radius (center of stroke)
        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;
        const fillRadius = radius; // Path radius is the fill boundary

        // Calculate bounds
        const minY = Math.max(0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(width - 1, Math.ceil(cX + outerRadius + 1));

        // Skip if completely outside canvas
        if (minY > maxY || minX > maxX) return;

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;
        const fillRadiusSquared = fillRadius * fillRadius;

        // Determine rendering mode for fill
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;

        // Determine rendering mode for stroke
        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSquared) continue;

            // Calculate outer circle X intersections (stroke outer boundary)
            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

            // Calculate fill boundaries if this row intersects the fill area
            let leftFillX = -1;
            let rightFillX = -1;
            const fillDistSquared = fillRadiusSquared - dySquared;
            if (hasFill && fillDistSquared >= 0) {
                const fillXDist = Math.sqrt(fillDistSquared);
                // Epsilon contraction to prevent speckles at boundary
                leftFillX = Math.max(minX, Math.ceil(cX - fillXDist + FILL_EPSILON));
                rightFillX = Math.min(maxX, Math.floor(cX + fillXDist - FILL_EPSILON));
            }

            // Calculate inner circle boundaries (stroke inner boundary)
            let innerLeftX = outerRightX + 1; // Default: no inner circle intersection
            let innerRightX = outerLeftX - 1;
            if (innerRadius > 0 && dySquared <= innerRadiusSquared) {
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                innerLeftX = Math.floor(cX - innerXDist);
                innerRightX = Math.ceil(cX + innerXDist);
            }

            // STEP 1: Render fill first (if this row intersects the fill circle) via SpanOps
            if (hasFill && leftFillX >= 0 && leftFillX <= rightFillX) {
                const fillSpanLength = rightFillX - leftFillX + 1;
                if (fillIsOpaque) {
                    SpanOps.fill_Opaq(data32, width, height, leftFillX, y, fillSpanLength, fillPacked, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        leftFillX,
                        y,
                        fillSpanLength,
                        fillColor.r,
                        fillColor.g,
                        fillColor.b,
                        fillEffectiveAlpha,
                        fillInvAlpha,
                        clipBuffer
                    );
                }
            }

            // STEP 2: Render stroke on top (covers any micro-gaps) via SpanOps
            if (hasStroke) {
                // Helper function to render a stroke segment via SpanOps
                const renderStrokeSegment = (startX, endX) => {
                    if (startX > endX) return;
                    const spanLength = endX - startX + 1;
                    if (strokeIsOpaque) {
                        SpanOps.fill_Opaq(data32, width, height, startX, y, spanLength, strokePacked, clipBuffer);
                    } else {
                        SpanOps.fill_Alpha(
                            data,
                            width,
                            height,
                            startX,
                            y,
                            spanLength,
                            strokeColor.r,
                            strokeColor.g,
                            strokeColor.b,
                            strokeEffectiveAlpha,
                            strokeInvAlpha,
                            clipBuffer
                        );
                    }
                };

                if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                    // No inner circle intersection - draw entire stroke span
                    renderStrokeSegment(outerLeftX, outerRightX);
                } else {
                    // Intersects both inner and outer circles - draw left and right segments
                    renderStrokeSegment(outerLeftX, innerLeftX);
                    renderStrokeSegment(innerRightX, outerRightX);
                }
            }
        }
    }

    /**
     * Optimized thick opaque stroke circle using scanline-based annulus rendering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static strokeThick_Opaq(surface, cx, cy, radius, lineWidth, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Calculate inner and outer radii for the stroke annulus
        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;

        // Use exact centers for Canvas coordinate alignment
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate bounds with safety margin
        const minY = Math.max(0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(width - 1, Math.ceil(cX + outerRadius + 1));

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSquared) continue;

            // Calculate outer circle X intersections
            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

            // Case: No inner circle intersection (draw full span)
            if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                const spanLength = outerRightX - outerLeftX + 1;
                SpanOps.fill_Opaq(data32, width, height, outerLeftX, y, spanLength, packedColor, clipBuffer);
            } else {
                // Case: Intersects both circles - draw left and right segments
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                const innerLeftX = Math.min(outerRightX, Math.floor(cX - innerXDist));
                const innerRightX = Math.max(outerLeftX, Math.ceil(cX + innerXDist));

                // Left segment via SpanOps
                const leftLen = innerLeftX - outerLeftX + 1;
                if (leftLen > 0) {
                    SpanOps.fill_Opaq(data32, width, height, outerLeftX, y, leftLen, packedColor, clipBuffer);
                }

                // Right segment via SpanOps
                const rightLen = outerRightX - innerRightX + 1;
                if (rightLen > 0) {
                    SpanOps.fill_Opaq(data32, width, height, innerRightX, y, rightLen, packedColor, clipBuffer);
                }
            }
        }
    }

    /**
     * Thick stroke circle with alpha blending
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static strokeThick_Alpha(surface, cx, cy, radius, lineWidth, color, globalAlpha, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        const minY = Math.max(0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(width - 1, Math.ceil(cX + outerRadius + 1));

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;

        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            if (dySquared > outerRadiusSquared) continue;

            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

            if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                // No inner circle intersection - draw full span via SpanOps
                const spanLength = outerRightX - outerLeftX + 1;
                SpanOps.fill_Alpha(
                    data,
                    width,
                    height,
                    outerLeftX,
                    y,
                    spanLength,
                    r,
                    g,
                    b,
                    effectiveAlpha,
                    invAlpha,
                    clipBuffer
                );
            } else {
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                const innerLeftX = Math.min(outerRightX, Math.floor(cX - innerXDist));
                const innerRightX = Math.max(outerLeftX, Math.ceil(cX + innerXDist));

                // Left segment via SpanOps
                const leftLen = innerLeftX - outerLeftX + 1;
                if (leftLen > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        outerLeftX,
                        y,
                        leftLen,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }

                // Right segment via SpanOps
                const rightLen = outerRightX - innerRightX + 1;
                if (rightLen > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        innerRightX,
                        y,
                        rightLen,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            }
        }
    }
}

/**
 * ArcOps - Static methods for optimized partial arc rendering
 * Follows CircleOps/PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillArc(), outerStrokeArc(), fillOuterStrokeArc()
 *
 * Path-based arcs (beginPath() + arc() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * Unlike CircleOps (which handles full circles), ArcOps handles partial arcs
 * by filtering pixels based on angle range using isAngleInRange_Fast() or
 * inline ARC_FAST_CLIPPED templates for per-pixel Bresenham rendering.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): CircleOps.generateExtents (for Bresenham data), inline markers
 *
 * Layer 1 (Primitives - do atomic rendering):
 *   fill_Opaq, fill_Alpha (use CircleOps extents + angle filtering via isAngleInRange_Fast)
 *   stroke1px_Opaq (uses SET_OPAQUE_ARC_FAST_CLIPPED inline template)
 *   stroke1px_Alpha (uses BLEND_ALPHA_ARC_FAST_CLIPPED inline template)
 *   stroke1px_Opaq_Exact (uses angle-based iteration for exact endpoints)
 *   strokeOuter_Opaq, strokeOuter_Alpha
 *
 * Layer 2 (Composites):
 *   fillStrokeOuter_Any → inline rendering (single-pass)
 *
 * MEMORY OPTIMIZATIONS:
 * - stroke1px_Opaq uses SET_OPAQUE_ARC_FAST_CLIPPED (angle+bounds+clipping in one template)
 * - stroke1px_Alpha uses BLEND_ALPHA_ARC_FAST_CLIPPED + conditional deduplication
 *   following CircleOps pattern: primary/swapped point checks prevent overdraw
 * - Module-level scratch buffer (_arcEventBuffer) for scanline events
 *
 * NAMING PATTERN: {operation}[Thickness]_{opacity}
 *   - Opaq = Opaque only, Alpha = Semi-transparent, Any = Handles both
 *   - (No orientation suffix - arcs are defined by angles, not rotation)
 *
 * PERFORMANCE NOTE: Unifying fill_Opaq/fill_Alpha and strokeOuter_Opaq/strokeOuter_Alpha
 * into single _Any methods was attempted but reverted. Benchmarks showed -2.8% regression
 * for opaque operations vs only +0.14% improvement for semi-transparent. The separate
 * methods avoid conditionals in hot loops - the "duplication" is intentional optimization.
 */

// Module-level scratch buffer for scanline events - avoids per-scanline allocation
// Max 6 events: 2 outer + 2 inner + 2 rays (for strokeOuter)
// Max 4 events: 2 circle + 2 rays (for fill)
const _arcEventBuffer = new Float32Array(8);

class ArcOps {
    /**
     * Precompute arc parameters for fast cross-product angle checking.
     * Call once per arc, then use isAngleInRange_Fast for each pixel.
     *
     * @param {number} startAngle - Normalized start angle in radians
     * @param {number} endAngle - Normalized end angle in radians (must be > startAngle)
     * @returns {object} { startCos, startSin, endCos, endSin, isLargeArc, isFullCircle }
     */
    static getArcParams(startAngle, endAngle) {
        // Calculate arc span (endAngle is already > startAngle from normalizeAngles)
        const diff = endAngle - startAngle;

        return {
            startCos: Math.cos(startAngle),
            startSin: Math.sin(startAngle),
            endCos: Math.cos(endAngle),
            endSin: Math.sin(endAngle),
            isLargeArc: diff > Math.PI,
            isFullCircle: diff >= TAU - ARC_FULLCIRCLE_TOLERANCE
        };
    }

    /**
     * Fast angle check using cross-product (replaces atan2).
     * Uses the fact that cross(V, P) >= 0 means P is counter-clockwise from V.
     *
     * Cost: 4 multiplications, 2 subtractions, 2 comparisons
     * vs atan2: expensive transcendental function
     *
     * @param {number} px - X coordinate relative to arc center
     * @param {number} py - Y coordinate relative to arc center
     * @param {number} startCos - cos(startAngle)
     * @param {number} startSin - sin(startAngle)
     * @param {number} endCos - cos(endAngle)
     * @param {number} endSin - sin(endAngle)
     * @param {boolean} isLargeArc - True if arc spans > 180°
     * @returns {boolean} True if point's angle is within arc range
     */
    static isAngleInRange_Fast(px, py, startCos, startSin, endCos, endSin, isLargeArc) {
        // Cross product: V × P = Vx*Py - Vy*Px
        // P is counter-clockwise from V (i.e., "after" V going CCW) if cross >= 0
        const afterStart = startCos * py - startSin * px >= 0;
        const beforeEnd = endCos * py - endSin * px <= 0;

        // For small arcs (<180°): point must be after start AND before end
        // For large arcs (>180°): point must be after start OR before end
        return isLargeArc ? afterStart || beforeEnd : afterStart && beforeEnd;
    }

    /**
     * Normalize angles for consistent arc rendering
     * Ensures endAngle > startAngle and handles anticlockwise direction
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} anticlockwise - Direction flag
     * @returns {object} { start, end } normalized angles
     */
    static normalizeAngles(startAngle, endAngle, anticlockwise) {
        let start = startAngle;
        let end = endAngle;

        // Normalize to [0, TAU) range
        start = start % TAU;
        if (start < 0) start += TAU;
        end = end % TAU;
        if (end < 0) end += TAU;

        if (anticlockwise) {
            // Swap and adjust for anticlockwise
            const temp = start;
            start = end;
            end = temp;
        }

        // Ensure end > start
        if (end <= start) {
            end += TAU;
        }

        return { start, end };
    }

    /**
     * In-place insertion sort for event buffer. Faster than native sort for N < 10.
     * @private
     * @param {Float32Array} buffer - Event buffer
     * @param {number} count - Number of elements to sort
     */
    static _sortEvents(buffer, count) {
        for (let i = 1; i < count; i++) {
            const val = buffer[i];
            let j = i - 1;
            while (j >= 0 && buffer[j] > val) {
                buffer[j + 1] = buffer[j];
                j--;
            }
            buffer[j + 1] = val;
        }
    }

    /**
     * Fill an arc (pie slice) with opaque color - direct rendering
     * Uses span-based scanline algorithm with cross-product angle checks.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Fill color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static fill_Opaq(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.fill_Opaq(surface, cx, cy, radius, color, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use floating-point center for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Bounds
        const minY = Math.max(0, Math.floor(cY - radius));
        const maxY = Math.min(height - 1, Math.ceil(cY + radius));

        const radiusSquared = radius * radius;

        // Precompute ray slopes for intersection calculation
        // x = dy * cos(angle) / sin(angle)  when sin(angle) != 0
        const startHasSlope = Math.abs(startSin) > FLOAT_EPSILON;
        const endHasSlope = Math.abs(endSin) > FLOAT_EPSILON;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside circle
            if (dySquared > radiusSquared) continue;

            // Circle intersection with this scanline
            const xDist = Math.sqrt(radiusSquared - dySquared);
            const circleLeft = cX - xDist;
            const circleRight = cX + xDist;

            // Collect events (boundary points): circle edges + ray intersections
            // Note: Do NOT add cX here - the center is interior, not a boundary
            // Uses module-level scratch buffer to avoid per-scanline allocation
            let evtCount = 0;
            _arcEventBuffer[evtCount++] = circleLeft;
            _arcEventBuffer[evtCount++] = circleRight;

            // Add start ray intersection if it crosses this scanline
            if (startHasSlope) {
                const startX = cX + dy * startSlope;
                if (startX >= circleLeft && startX <= circleRight) {
                    _arcEventBuffer[evtCount++] = startX;
                }
            } else if (Math.abs(dy) < FLOAT_EPSILON) {
                // Horizontal ray (sin=0), handle center scanline
                // Ray goes in direction of startCos (positive = right, negative = left)
                _arcEventBuffer[evtCount++] = startCos > 0 ? circleRight : circleLeft;
            }

            // Add end ray intersection if it crosses this scanline
            if (endHasSlope) {
                const endX = cX + dy * endSlope;
                if (endX >= circleLeft && endX <= circleRight) {
                    _arcEventBuffer[evtCount++] = endX;
                }
            } else if (Math.abs(dy) < FLOAT_EPSILON) {
                // Horizontal ray (sin=0), handle center scanline
                _arcEventBuffer[evtCount++] = endCos > 0 ? circleRight : circleLeft;
            }

            // Sort events by X using insertion sort (faster than native sort for N < 10)
            ArcOps._sortEvents(_arcEventBuffer, evtCount);

            // Process each segment between events
            for (let i = 0; i < evtCount - 1; i++) {
                const segLeft = _arcEventBuffer[i];
                const segRight = _arcEventBuffer[i + 1];

                // Skip degenerate segments
                if (segRight - segLeft < MIN_EDGE_LENGTH) continue;

                // Test midpoint
                const midX = (segLeft + segRight) / 2;
                const dx = midX - cX;

                // Check if midpoint is within arc angle range (fast cross-product check)
                if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) {
                    continue;
                }

                // Fill this segment via SpanOps
                // Use half-open interval [segLeft, segRight) to avoid double-including boundary pixels
                const xStart = Math.max(0, Math.ceil(segLeft));
                const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                const length = xEnd - xStart + 1;

                if (length > 0) {
                    SpanOps.fill_Opaq(data32, width, height, xStart, y, length, packedColor, clipBuffer);
                }
            }
        }
    }

    /**
     * Fill an arc (pie slice) with alpha blending
     * Uses span-based scanline algorithm with cross-product angle checks.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static fill_Alpha(surface, cx, cy, radius, startAngle, endAngle, color, globalAlpha, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.fill_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use floating-point center for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Bounds
        const minY = Math.max(0, Math.floor(cY - radius));
        const maxY = Math.min(height - 1, Math.ceil(cY + radius));

        const radiusSquared = radius * radius;

        // Precompute ray slopes for intersection calculation
        const startHasSlope = Math.abs(startSin) > FLOAT_EPSILON;
        const endHasSlope = Math.abs(endSin) > FLOAT_EPSILON;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside circle
            if (dySquared > radiusSquared) continue;

            // Circle intersection with this scanline
            const xDist = Math.sqrt(radiusSquared - dySquared);
            const circleLeft = cX - xDist;
            const circleRight = cX + xDist;

            // Collect events (boundary points): circle edges + ray intersections
            // Note: Do NOT add cX here - the center is interior, not a boundary
            // Uses module-level scratch buffer to avoid per-scanline allocation
            let evtCount = 0;
            _arcEventBuffer[evtCount++] = circleLeft;
            _arcEventBuffer[evtCount++] = circleRight;

            // Add start ray intersection if it crosses this scanline
            if (startHasSlope) {
                const startX = cX + dy * startSlope;
                if (startX >= circleLeft && startX <= circleRight) {
                    _arcEventBuffer[evtCount++] = startX;
                }
            } else if (Math.abs(dy) < FLOAT_EPSILON) {
                _arcEventBuffer[evtCount++] = startCos > 0 ? circleRight : circleLeft;
            }

            // Add end ray intersection if it crosses this scanline
            if (endHasSlope) {
                const endX = cX + dy * endSlope;
                if (endX >= circleLeft && endX <= circleRight) {
                    _arcEventBuffer[evtCount++] = endX;
                }
            } else if (Math.abs(dy) < FLOAT_EPSILON) {
                _arcEventBuffer[evtCount++] = endCos > 0 ? circleRight : circleLeft;
            }

            // Sort events by X using insertion sort (faster than native sort for N < 10)
            ArcOps._sortEvents(_arcEventBuffer, evtCount);

            // Process each segment between events
            for (let i = 0; i < evtCount - 1; i++) {
                const segLeft = _arcEventBuffer[i];
                const segRight = _arcEventBuffer[i + 1];

                // Skip degenerate segments
                if (segRight - segLeft < MIN_EDGE_LENGTH) continue;

                // Test midpoint
                const midX = (segLeft + segRight) / 2;
                const dx = midX - cX;

                // Check if midpoint is within arc angle range (fast cross-product check)
                if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) {
                    continue;
                }

                // Fill this segment via SpanOps
                // Use half-open interval [segLeft, segRight) to avoid double-including boundary pixels
                const xStart = Math.max(0, Math.ceil(segLeft));
                const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                const length = xEnd - xStart + 1;

                if (length > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        xStart,
                        y,
                        length,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            }
        }
    }

    /**
     * Optimized 1px opaque arc stroke using Bresenham + direct writes
     * Uses fast cross-product angle check instead of atan2.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Opaq(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Precompute arc parameters for fast angle check
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.stroke1px_Opaq(surface, cx, cy, radius, color, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use same center calculation as CircleOps.stroke1pxOpaque()
        const adjCX = Math.floor(cx);
        const adjCY = Math.floor(cy);

        // Calculate offsets for fractional radii (same as CircleOps)
        let xOffset = 0,
            yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        const intRadius = Math.floor(radius);
        if (intRadius < 0) return;

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            if (radius >= 0) {
                const px = Math.round(cx);
                const py = Math.round(cy);
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const pos = py * width + px;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        data32[pos] = packedColor;
                    }
                }
            }
            return;
        }

        // Bresenham circle algorithm with fast angle filtering
        let bx = 0;
        let by = intRadius;
        let d = 3 - 2 * intRadius;

        while (by >= bx) {
            // 8 symmetric points with offset corrections (same pattern as CircleOps)
            const points = [
                [bx, by], // bottom-right: no offset
                [by, bx], // bottom-right: no offset
                [by, -bx - yOffset], // top-right: yOffset
                [bx, -by - yOffset], // top-right: yOffset
                [-bx - xOffset, -by - yOffset], // top-left: both offsets
                [-by - xOffset, -bx - yOffset], // top-left: both offsets
                [-by - xOffset, bx], // bottom-left: xOffset
                [-bx - xOffset, by] // bottom-left: xOffset
            ];

            for (const [px, py] of points) {
                const screenX = adjCX + px;
                const screenY = adjCY + py;
                {
    const __afterStart = (startCos * py - startSin * px) >= 0;
    const __beforeEnd = (endCos * py - endSin * px) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && screenX >= 0 && screenX < width && screenY >= 0 && screenY < height) {
        const __pos = screenY * width + screenX;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    data32[__pos] = packedColor;
}
    }
}
            }

            bx++;
            if (d > 0) {
                by--;
                d = d + 4 * (bx - by) + 10;
            } else {
                d = d + 4 * bx + 6;
            }
        }
    }

    /**
     * 1px opaque arc stroke using angle-based iteration with exact endpoint pixels.
     * Unlike Bresenham, this method guarantees pixels at exact start/end angles,
     * eliminating junction gaps with connected line segments.
     *
     * Use this when junction alignment is critical (e.g., rotated rounded rectangles)
     * where Bresenham's angular coverage gaps would cause discontinuities.
     *
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X (floating-point)
     * @param {number} cy - Center Y (floating-point)
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Opaq_Exact(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        // Hoist color packing
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // 1. Setup Arc Steps
        // Keep the safety factor to ensure continuous lines, but we will deduplicate writes later.
        const arcLength = radius * Math.abs(endAngle - startAngle);
        const numSteps = Math.max(Math.ceil(arcLength * 2), 8);
        const angleStep = (endAngle - startAngle) / numSteps;

        // 2. Optimization: Use Incremental Rotation (Rotation Matrix)
        // This removes Math.cos/sin from the hot loop, replacing them with multiplication.
        // x' = x*cos - y*sin
        // y' = x*sin + y*cos
        const cosStep = Math.cos(angleStep);
        const sinStep = Math.sin(angleStep);

        // Start position relative to center
        let x = radius * Math.cos(startAngle);
        let y = radius * Math.sin(startAngle);

        // 3. Optimization: Bounds Check Hoisting
        // If the entire circle is safely within the canvas, we can skip individual pixel bounds checks.
        // We use a conservative estimate for safety.
        const isSafe = cx - radius >= 0 && cx + radius < width && cy - radius >= 0 && cy + radius < height;

        // Track the last written pixel index to prevent overdraw (expensive memory writes)
        let lastPos = -1;

        for (let i = 0; i <= numSteps; i++) {
            // Force exact precision for the final point to satisfy "ExactEndpoints" requirement
            // (prevents floating point drift from the rotation matrix)
            if (i === numSteps) {
                x = radius * Math.cos(endAngle);
                y = radius * Math.sin(endAngle);
            }

            // Fast floor (Bitwise OR 0) matches Math.floor for positive numbers.
            // If your inputs can be negative (off-canvas), stick to Math.floor.
            // We use Math.floor here to match the original LineOps consistency requirement.
            const px = Math.floor(cx + x);
            const py = Math.floor(cy + y);

            // 4. Optimization: Deduplication
            // Because numSteps is high (2x arcLength), we often hit the same pixel twice.
            // We calculate the linear position once and check if we just wrote to it.
            const pos = py * width + px;

            if (pos !== lastPos) {
                // Apply bounds check only if the circle isn't fully contained
                if (isSafe || (px >= 0 && px < width && py >= 0 && py < height)) {
                    // Clipping check
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        data32[pos] = packedColor;
                        lastPos = pos;
                    }
                }
            }

            // Apply rotation for next iteration (Incremental Trigonometry)
            const nextX = x * cosStep - y * sinStep;
            y = x * sinStep + y * cosStep;
            x = nextX;
        }
    }
    /**
     * Optimized 1px semi-transparent arc stroke using Bresenham with conditional deduplication.
     * Uses fast cross-product angle check via inline template. Prevents overdraw via
     * bx != by + cardinal point checks (same pattern as CircleOps.stroke1px_Alpha).
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Alpha(surface, cx, cy, radius, startAngle, endAngle, color, globalAlpha, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Precompute arc parameters for fast angle check
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.stroke1px_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use same center calculation as CircleOps.stroke1pxAlpha()
        const adjCX = Math.floor(cx);
        const adjCY = Math.floor(cy);

        // Calculate offsets for fractional radii (same as CircleOps)
        let xOffset = 0,
            yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        const intRadius = Math.floor(radius);
        if (intRadius < 0) return;

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            if (radius >= 0) {
                const px = Math.round(cx);
                const py = Math.round(cy);
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const pos = py * width + px;
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }
            }
            return;
        }

        // Bresenham circle algorithm with conditional checks to prevent overdraw
        // (eliminates Set allocation by using geometric deduplication - same pattern as CircleOps)
        let bx = 0;
        let by = intRadius;
        let d = 3 - 2 * intRadius;

        while (bx <= by) {
            // Calculate 8 symmetric points with offsets for top/left halves
            // Primary points (A, C, E, G) - always unique from each other
            // Note: Quadrant labels use screen coordinates (Y-down). In standard math (Y-up):
            // bottom-right = Q1, top-right = Q4, top-left = Q3, bottom-left = Q2
            const pAx = adjCX + bx,
                pAy = adjCY + by; // bottom-right quadrant (math: Q1)
            const pCx = adjCX + by,
                pCy = adjCY - bx - yOffset; // top-right quadrant (math: Q4)
            const pEx = adjCX - bx - xOffset,
                pEy = adjCY - by - yOffset; // top-left quadrant (math: Q3)
            const pGx = adjCX - by - xOffset,
                pGy = adjCY + bx; // bottom-left quadrant (math: Q2)

            // Swapped points (B, D, F, H) - duplicate primaries when bx == by
            const pBx = adjCX + by,
                pBy = adjCY + bx; // duplicates A when bx == by
            const pDx = adjCX + bx,
                pDy = adjCY - by - yOffset; // duplicates C when bx == by
            const pFx = adjCX - by - xOffset,
                pFy = adjCY - bx - yOffset; // duplicates E when bx == by
            const pHx = adjCX - bx - xOffset,
                pHy = adjCY + by; // duplicates G when bx == by

            // Draw primary points (always) - with angle filtering
            // Note: Quadrant labels use screen coordinates (Y-down). In standard math (Y-up):
            // bottom-right = Q1, top-right = Q4, top-left = Q3, bottom-left = Q2
            // Point A (bottom-right quadrant, math: Q1)
            {
    const __afterStart = (startCos * by - startSin * bx) >= 0;
    const __beforeEnd = (endCos * by - endSin * bx) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && pAx >= 0 && pAx < width && pAy >= 0 && pAy < height) {
        const __pos = pAy * width + pAx;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    const __off = __pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
    }
}
            // Point C (top-right quadrant, math: Q4)
            {
    const __afterStart = (startCos * -bx - yOffset - startSin * by) >= 0;
    const __beforeEnd = (endCos * -bx - yOffset - endSin * by) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && pCx >= 0 && pCx < width && pCy >= 0 && pCy < height) {
        const __pos = pCy * width + pCx;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    const __off = __pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
    }
}
            // Point E (top-left quadrant, math: Q3)
            {
    const __afterStart = (startCos * -by - yOffset - startSin * -bx - xOffset) >= 0;
    const __beforeEnd = (endCos * -by - yOffset - endSin * -bx - xOffset) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && pEx >= 0 && pEx < width && pEy >= 0 && pEy < height) {
        const __pos = pEy * width + pEx;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    const __off = __pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
    }
}
            // Point G (bottom-left quadrant, math: Q2)
            {
    const __afterStart = (startCos * bx - startSin * -by - xOffset) >= 0;
    const __beforeEnd = (endCos * bx - endSin * -by - xOffset) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && pGx >= 0 && pGx < width && pGy >= 0 && pGy < height) {
        const __pos = pGy * width + pGx;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    const __off = __pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
    }
}

            // Draw swapped points only when bx != by (they duplicate primaries on the diagonal)
            // Additional cardinal point checks: at bx == 0, swapped points may duplicate primaries
            if (bx !== by) {
                // Point B - duplicates C at right cardinal when bx == 0 && yOffset == 0
                if (bx !== 0 || yOffset !== 0) {
                    {
    const __afterStart = (startCos * bx - startSin * by) >= 0;
    const __beforeEnd = (endCos * bx - endSin * by) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && pBx >= 0 && pBx < width && pBy >= 0 && pBy < height) {
        const __pos = pBy * width + pBx;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    const __off = __pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
    }
}
                }
                // Point D - duplicates E at top cardinal when bx == 0 && xOffset == 0
                if (bx !== 0 || xOffset !== 0) {
                    {
    const __afterStart = (startCos * -by - yOffset - startSin * bx) >= 0;
    const __beforeEnd = (endCos * -by - yOffset - endSin * bx) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && pDx >= 0 && pDx < width && pDy >= 0 && pDy < height) {
        const __pos = pDy * width + pDx;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    const __off = __pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
    }
}
                }
                // Point F - duplicates G at left cardinal when bx == 0 && yOffset == 0
                if (bx !== 0 || yOffset !== 0) {
                    {
    const __afterStart = (startCos * -bx - yOffset - startSin * -by - xOffset) >= 0;
    const __beforeEnd = (endCos * -bx - yOffset - endSin * -by - xOffset) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && pFx >= 0 && pFx < width && pFy >= 0 && pFy < height) {
        const __pos = pFy * width + pFx;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    const __off = __pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
    }
}
                }
                // Point H - duplicates A at bottom cardinal when bx == 0 && xOffset == 0
                if (bx !== 0 || xOffset !== 0) {
                    {
    const __afterStart = (startCos * by - startSin * -bx - xOffset) >= 0;
    const __beforeEnd = (endCos * by - endSin * -bx - xOffset) <= 0;
    const __inRange = isLargeArc ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange && pHx >= 0 && pHx < width && pHy >= 0 && pHy < height) {
        const __pos = pHy * width + pHx;
        if (!clipBuffer || (clipBuffer[__pos >> 3] & (1 << (__pos & 7)))) {
    const __off = __pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
    }
}
                }
            }

            // Update Bresenham state
            if (d < 0) {
                d = d + 4 * bx + 6;
            } else {
                d = d + 4 * (bx - by) + 10;
                by--;
            }
            bx++;
        }
    }

    /**
     * Stroke outer arc with opaque color using span-based scanline algorithm
     * Uses cross-product angle checks and SpanOps for optimal performance.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static strokeOuter_Opaq(surface, cx, cy, radius, startAngle, endAngle, lineWidth, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.strokeOuter_Opaq(surface, cx, cy, radius, lineWidth, color, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use floating-point center for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Handle zero/tiny radius (single pixel)
        if (radius < 1) {
            const px = Math.round(cx);
            const py = Math.round(cy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
                const pos = py * width + px;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    data32[pos] = packedColor;
                }
            }
            return;
        }

        // Annulus boundaries - stroke width distributed around the arc path
        const innerRadius = Math.max(0, radius - lineWidth / 2);
        const outerRadius = radius + lineWidth / 2;

        // Bounds
        const minY = Math.max(0, Math.floor(cY - outerRadius));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius));

        const outerRadiusSq = outerRadius * outerRadius;
        const innerRadiusSq = innerRadius * innerRadius;

        // Precompute ray slopes for intersection calculation
        const startHasSlope = Math.abs(startSin) > FLOAT_EPSILON;
        const endHasSlope = Math.abs(endSin) > FLOAT_EPSILON;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSq) continue;

            // Outer circle intersection with this scanline
            const outerXDist = Math.sqrt(outerRadiusSq - dySquared);
            const outerLeft = cX - outerXDist;
            const outerRight = cX + outerXDist;

            // Inner circle intersection (if applicable)
            let innerLeft = outerRight + 1; // Default: no inner circle
            let innerRight = outerLeft - 1;
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                const innerXDist = Math.sqrt(innerRadiusSq - dySquared);
                innerLeft = cX - innerXDist;
                innerRight = cX + innerXDist;
            }

            // Collect events (boundary points)
            // Uses module-level scratch buffer to avoid per-scanline allocation
            let evtCount = 0;
            _arcEventBuffer[evtCount++] = outerLeft;
            _arcEventBuffer[evtCount++] = outerRight;

            // Add inner circle boundaries if they exist
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                _arcEventBuffer[evtCount++] = innerLeft;
                _arcEventBuffer[evtCount++] = innerRight;
            }

            // Add start ray intersection if it crosses this scanline
            if (startHasSlope) {
                const startX = cX + dy * startSlope;
                if (startX >= outerLeft && startX <= outerRight) {
                    _arcEventBuffer[evtCount++] = startX;
                }
            } else if (Math.abs(dy) < FLOAT_EPSILON) {
                // Horizontal ray (sin=0), handle center scanline
                _arcEventBuffer[evtCount++] = startCos > 0 ? outerRight : outerLeft;
            }

            // Add end ray intersection if it crosses this scanline
            if (endHasSlope) {
                const endX = cX + dy * endSlope;
                if (endX >= outerLeft && endX <= outerRight) {
                    _arcEventBuffer[evtCount++] = endX;
                }
            } else if (Math.abs(dy) < FLOAT_EPSILON) {
                _arcEventBuffer[evtCount++] = endCos > 0 ? outerRight : outerLeft;
            }

            // Sort events by X using insertion sort (faster than native sort for N < 10)
            ArcOps._sortEvents(_arcEventBuffer, evtCount);

            // Process each segment between events
            for (let i = 0; i < evtCount - 1; i++) {
                const segLeft = _arcEventBuffer[i];
                const segRight = _arcEventBuffer[i + 1];

                // Skip degenerate segments
                if (segRight - segLeft < MIN_EDGE_LENGTH) continue;

                // Test midpoint
                const midX = (segLeft + segRight) / 2;
                const dx = midX - cX;

                // Check if midpoint is within annulus (between inner and outer radii)
                const distSq = dx * dx + dySquared;
                if (distSq > outerRadiusSq || distSq < innerRadiusSq) continue;

                // Check if midpoint is within arc angle range (fast cross-product check)
                if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) {
                    continue;
                }

                // Fill this segment via SpanOps
                const xStart = Math.max(0, Math.ceil(segLeft));
                const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                const length = xEnd - xStart + 1;

                if (length > 0) {
                    SpanOps.fill_Opaq(data32, width, height, xStart, y, length, packedColor, clipBuffer);
                }
            }
        }
    }

    /**
     * Stroke outer arc with alpha blending using span-based scanline algorithm
     * Uses cross-product angle checks and SpanOps for optimal performance.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static strokeOuter_Alpha(
        surface,
        cx,
        cy,
        radius,
        startAngle,
        endAngle,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer = null
    ) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.strokeOuter_Alpha(surface, cx, cy, radius, lineWidth, color, globalAlpha, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use floating-point center for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Handle zero/tiny radius (single pixel)
        if (radius < 1) {
            const px = Math.round(cx);
            const py = Math.round(cy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
                const pos = py * width + px;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                }
            }
            return;
        }

        // Annulus boundaries - stroke width distributed around the arc path
        const innerRadius = Math.max(0, radius - lineWidth / 2);
        const outerRadius = radius + lineWidth / 2;

        // Bounds
        const minY = Math.max(0, Math.floor(cY - outerRadius));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius));

        const outerRadiusSq = outerRadius * outerRadius;
        const innerRadiusSq = innerRadius * innerRadius;

        // Precompute ray slopes for intersection calculation
        const startHasSlope = Math.abs(startSin) > FLOAT_EPSILON;
        const endHasSlope = Math.abs(endSin) > FLOAT_EPSILON;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSq) continue;

            // Outer circle intersection with this scanline
            const outerXDist = Math.sqrt(outerRadiusSq - dySquared);
            const outerLeft = cX - outerXDist;
            const outerRight = cX + outerXDist;

            // Inner circle intersection (if applicable)
            let innerLeft = outerRight + 1; // Default: no inner circle
            let innerRight = outerLeft - 1;
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                const innerXDist = Math.sqrt(innerRadiusSq - dySquared);
                innerLeft = cX - innerXDist;
                innerRight = cX + innerXDist;
            }

            // Collect events (boundary points)
            // Uses module-level scratch buffer to avoid per-scanline allocation
            let evtCount = 0;
            _arcEventBuffer[evtCount++] = outerLeft;
            _arcEventBuffer[evtCount++] = outerRight;

            // Add inner circle boundaries if they exist
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                _arcEventBuffer[evtCount++] = innerLeft;
                _arcEventBuffer[evtCount++] = innerRight;
            }

            // Add start ray intersection if it crosses this scanline
            if (startHasSlope) {
                const startX = cX + dy * startSlope;
                if (startX >= outerLeft && startX <= outerRight) {
                    _arcEventBuffer[evtCount++] = startX;
                }
            } else if (Math.abs(dy) < FLOAT_EPSILON) {
                _arcEventBuffer[evtCount++] = startCos > 0 ? outerRight : outerLeft;
            }

            // Add end ray intersection if it crosses this scanline
            if (endHasSlope) {
                const endX = cX + dy * endSlope;
                if (endX >= outerLeft && endX <= outerRight) {
                    _arcEventBuffer[evtCount++] = endX;
                }
            } else if (Math.abs(dy) < FLOAT_EPSILON) {
                _arcEventBuffer[evtCount++] = endCos > 0 ? outerRight : outerLeft;
            }

            // Sort events by X using insertion sort (faster than native sort for N < 10)
            ArcOps._sortEvents(_arcEventBuffer, evtCount);

            // Process each segment between events
            for (let i = 0; i < evtCount - 1; i++) {
                const segLeft = _arcEventBuffer[i];
                const segRight = _arcEventBuffer[i + 1];

                // Skip degenerate segments
                if (segRight - segLeft < MIN_EDGE_LENGTH) continue;

                // Test midpoint
                const midX = (segLeft + segRight) / 2;
                const dx = midX - cX;

                // Check if midpoint is within annulus (between inner and outer radii)
                const distSq = dx * dx + dySquared;
                if (distSq > outerRadiusSq || distSq < innerRadiusSq) continue;

                // Check if midpoint is within arc angle range (fast cross-product check)
                if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) {
                    continue;
                }

                // Fill this segment via SpanOps
                const xStart = Math.max(0, Math.ceil(segLeft));
                const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                const length = xEnd - xStart + 1;

                if (length > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        xStart,
                        y,
                        length,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            }
        }
    }

    /**
     * Fill and stroke an arc in a unified pass using span-based scanline algorithm.
     * Uses cross-product angle checks and SpanOps for optimal performance.
     * Mirrors CircleOps.fillStroke() approach to prevent speckles between fill and stroke.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius (path radius - center of stroke)
     * @param {number} startAngle - Start angle in radians (normalized)
     * @param {number} endAngle - End angle in radians (normalized, > startAngle)
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color (null/undefined for no fill)
     * @param {Color} strokeColor - Stroke color (null/undefined for no stroke)
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static fillStrokeOuter_Any(
        surface,
        cx,
        cy,
        radius,
        startAngle,
        endAngle,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer = null
    ) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.fillStroke_Any(
                surface,
                cx,
                cy,
                radius,
                lineWidth,
                fillColor,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Single floating-point center for both fill and stroke (CircleOps.fillStroke approach)
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate radii based on stroke width
        const innerRadius = hasStroke ? Math.max(0, radius - lineWidth / 2) : radius;
        const outerRadius = hasStroke ? radius + lineWidth / 2 : radius;
        const fillRadius = radius;

        // Calculate bounds
        const minY = Math.max(0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius + 1));

        // Skip if completely outside canvas
        if (minY > maxY) return;

        const outerRadiusSq = outerRadius * outerRadius;
        const innerRadiusSq = innerRadius > 0 ? innerRadius * innerRadius : 0;
        const fillRadiusSq = fillRadius * fillRadius;

        // Determine rendering mode for fill
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;
        const fr = hasFill ? fillColor.r : 0,
            fg = hasFill ? fillColor.g : 0,
            fb = hasFill ? fillColor.b : 0;
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;

        // Determine rendering mode for stroke
        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;
        const sr = hasStroke ? strokeColor.r : 0,
            sg = hasStroke ? strokeColor.g : 0,
            sb = hasStroke ? strokeColor.b : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Precompute ray slopes for intersection calculation
        const startHasSlope = Math.abs(startSin) > FLOAT_EPSILON;
        const endHasSlope = Math.abs(endSin) > FLOAT_EPSILON;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSq) continue;

            // Outer circle intersection
            const outerXDist = Math.sqrt(outerRadiusSq - dySquared);
            const outerLeft = cX - outerXDist;
            const outerRight = cX + outerXDist;

            // Fill circle intersection
            let fillLeft = outerRight + 1,
                fillRight = outerLeft - 1;
            if (hasFill && dySquared <= fillRadiusSq) {
                const fillXDist = Math.sqrt(fillRadiusSq - dySquared);
                fillLeft = cX - fillXDist + FILL_EPSILON;
                fillRight = cX + fillXDist - FILL_EPSILON;
            }

            // Inner circle intersection (stroke inner boundary)
            let innerLeft = outerRight + 1,
                innerRight = outerLeft - 1;
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                const innerXDist = Math.sqrt(innerRadiusSq - dySquared);
                innerLeft = cX - innerXDist;
                innerRight = cX + innerXDist;
            }

            // Collect events for fill (pie shape)
            // Note: Do NOT add cX here - the center is interior, not a boundary
            // Uses module-level scratch buffer (reused for fill then stroke)
            if (hasFill && fillLeft <= fillRight) {
                let evtCount = 0;
                _arcEventBuffer[evtCount++] = fillLeft;
                _arcEventBuffer[evtCount++] = fillRight;

                // Add ray intersections within fill circle
                if (startHasSlope) {
                    const startX = cX + dy * startSlope;
                    if (startX >= fillLeft && startX <= fillRight) _arcEventBuffer[evtCount++] = startX;
                } else if (Math.abs(dy) < FLOAT_EPSILON) {
                    _arcEventBuffer[evtCount++] = startCos > 0 ? fillRight : fillLeft;
                }
                if (endHasSlope) {
                    const endX = cX + dy * endSlope;
                    if (endX >= fillLeft && endX <= fillRight) _arcEventBuffer[evtCount++] = endX;
                } else if (Math.abs(dy) < FLOAT_EPSILON) {
                    _arcEventBuffer[evtCount++] = endCos > 0 ? fillRight : fillLeft;
                }

                ArcOps._sortEvents(_arcEventBuffer, evtCount);

                // Process fill segments
                for (let i = 0; i < evtCount - 1; i++) {
                    const segLeft = _arcEventBuffer[i];
                    const segRight = _arcEventBuffer[i + 1];
                    if (segRight - segLeft < MIN_EDGE_LENGTH) continue;

                    const midX = (segLeft + segRight) / 2;
                    const dx = midX - cX;

                    if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) continue;

                    const xStart = Math.max(0, Math.ceil(segLeft));
                    const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                    const length = xEnd - xStart + 1;

                    if (length > 0) {
                        if (fillIsOpaque) {
                            SpanOps.fill_Opaq(data32, width, height, xStart, y, length, fillPacked, clipBuffer);
                        } else {
                            SpanOps.fill_Alpha(
                                data,
                                width,
                                height,
                                xStart,
                                y,
                                length,
                                fr,
                                fg,
                                fb,
                                fillEffectiveAlpha,
                                fillInvAlpha,
                                clipBuffer
                            );
                        }
                    }
                }
            }

            // Collect events for stroke (annulus shape)
            // Reuses same scratch buffer since fill is fully processed
            if (hasStroke) {
                let evtCount = 0;
                _arcEventBuffer[evtCount++] = outerLeft;
                _arcEventBuffer[evtCount++] = outerRight;
                if (innerRadius > 0 && dySquared < innerRadiusSq) {
                    _arcEventBuffer[evtCount++] = innerLeft;
                    _arcEventBuffer[evtCount++] = innerRight;
                }

                // Add ray intersections within stroke area
                if (startHasSlope) {
                    const startX = cX + dy * startSlope;
                    if (startX >= outerLeft && startX <= outerRight) _arcEventBuffer[evtCount++] = startX;
                } else if (Math.abs(dy) < FLOAT_EPSILON) {
                    _arcEventBuffer[evtCount++] = startCos > 0 ? outerRight : outerLeft;
                }
                if (endHasSlope) {
                    const endX = cX + dy * endSlope;
                    if (endX >= outerLeft && endX <= outerRight) _arcEventBuffer[evtCount++] = endX;
                } else if (Math.abs(dy) < FLOAT_EPSILON) {
                    _arcEventBuffer[evtCount++] = endCos > 0 ? outerRight : outerLeft;
                }

                ArcOps._sortEvents(_arcEventBuffer, evtCount);

                // Process stroke segments
                for (let i = 0; i < evtCount - 1; i++) {
                    const segLeft = _arcEventBuffer[i];
                    const segRight = _arcEventBuffer[i + 1];
                    if (segRight - segLeft < MIN_EDGE_LENGTH) continue;

                    const midX = (segLeft + segRight) / 2;
                    const dx = midX - cX;

                    // Check annulus bounds
                    const distSq = dx * dx + dySquared;
                    if (distSq > outerRadiusSq || distSq < innerRadiusSq) continue;

                    if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) continue;

                    const xStart = Math.max(0, Math.ceil(segLeft));
                    const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                    const length = xEnd - xStart + 1;

                    if (length > 0) {
                        if (strokeIsOpaque) {
                            SpanOps.fill_Opaq(data32, width, height, xStart, y, length, strokePacked, clipBuffer);
                        } else {
                            SpanOps.fill_Alpha(
                                data,
                                width,
                                height,
                                xStart,
                                y,
                                length,
                                sr,
                                sg,
                                sb,
                                strokeEffectiveAlpha,
                                strokeInvAlpha,
                                clipBuffer
                            );
                        }
                    }
                }
            }
        }
    }
}

/**
 * LineOps - Static methods for optimized line rendering
 * Follows PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * strokeLine()
 *
 * Path-based lines (beginPath() + moveTo() + lineTo() + stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers, QuadScanOps.fillQuad
 *
 * Layer 1 (Internal):
 *   _strokeThick_PolyScan → QuadScanOps.lineToQuad + QuadScanOps.fillQuad/fillSquare
 *
 * Layer 2 (Public dispatcher):
 *   stroke_Any → Bresenham (thin opaque), inline markers/SpanOps (thin alpha), SpanOps (thick AA), _strokeThick_PolyScan
 *
 * NAMING PATTERN: {operation}_{opacity}
 *   - Any = Handles all opacity/thickness cases (dispatcher)
 *   - (No orientation suffix - lines handle all angles)
 */
class LineOps {
    /**
     * Optimized line stroke - dispatches to appropriate rendering algorithm
     * @param {Surface} surface - Target surface
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} lineWidth - Stroke width
     * @param {Color} paintSource - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: inline per-pixel for Bresenham, delegated to SpanOps/QuadScanOps for spans)
     * @param {boolean} isOpaqueColor - True if color is opaque with full alpha
     * @param {boolean} isSemiTransparentColor - True if color needs alpha blending
     * @returns {boolean} True if direct rendering was used, false if path-based rendering needed
     */
    static stroke_Any(
        surface,
        x1,
        y1,
        x2,
        y2,
        lineWidth,
        paintSource,
        globalAlpha,
        clipBuffer,
        isOpaqueColor,
        isSemiTransparentColor
    ) {
        const width = surface.width;
        const height = surface.height;

        if (isOpaqueColor && lineWidth <= THIN_LINE_THRESHOLD) {
            // Direct rendering for thin lines: Bresenham algorithm
            const packedColor = Surface.packColor(paintSource.r, paintSource.g, paintSource.b, 255);
            const data32 = surface.data32;

            let x1i = Math.floor(x1);
            let y1i = Math.floor(y1);
            let x2i = Math.floor(x2);
            let y2i = Math.floor(y2);

            // Shorten horizontal/vertical lines by 1 pixel to match HTML5 Canvas
            if (x1i === x2i) {
                if (y2i > y1i) y2i--;
                else y1i--;
            }
            if (y1i === y2i) {
                if (x2i > x1i) x2i--;
                else x1i--;
            }

            // Optimize thin horizontal lines: use span-based rendering
            if (y1i === y2i) {
                // Y bounds check - skip if entirely off-screen
                if (y1i < 0 || y1i >= height) return true;

                // X bounds clamping
                const leftX = Math.max(0, Math.min(x1i, x2i));
                const rightX = Math.min(width - 1, Math.max(x1i, x2i));
                if (leftX > rightX) return true;

                const spanLength = rightX - leftX + 1;
                SpanOps.fill_Opaq(data32, width, height, leftX, y1i, spanLength, packedColor, clipBuffer);
                return true;
            }

            const dx = Math.abs(x2i - x1i);
            const dy = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dx - dy;

            let x = x1i;
            let y = y1i;

            while (true) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const pixelIndex = y * width + x;

                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (clipBuffer[byteIndex] & (1 << bitIndex)) {
                            data32[pixelIndex] = packedColor;
                        }
                    } else {
                        data32[pixelIndex] = packedColor;
                    }
                }

                if (x === x2i && y === y2i) break;

                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y += sy;
                }
            }
            return true;
        } else if (isOpaqueColor) {
            // Direct rendering for thick axis-aligned lines: render as rectangle
            const x1i = Math.floor(x1);
            const y1i = Math.floor(y1);
            const x2i = Math.floor(x2);
            const y2i = Math.floor(y2);
            const data32 = surface.data32;

            if (y1i === y2i) {
                // Horizontal thick line - render as filled rectangle
                const halfWidth = lineWidth / 2;
                const topY = Math.floor(y1 - halfWidth);
                const bottomY = Math.floor(y1 + halfWidth);
                const leftX = Math.min(x1i, x2i);
                const rightX = Math.max(x1i, x2i) - 1;
                const packedColor = Surface.packColor(paintSource.r, paintSource.g, paintSource.b, 255);

                // Y bounds clamping for the loop
                const clampedTopY = Math.max(0, topY);
                const clampedBottomY = Math.min(height, bottomY);
                if (clampedTopY >= clampedBottomY) return true;

                // X bounds clamping
                const clampedLeftX = Math.max(0, leftX);
                const clampedRightX = Math.min(width - 1, rightX);
                if (clampedLeftX > clampedRightX) return true;

                const spanLength = clampedRightX - clampedLeftX + 1;
                for (let y = clampedTopY; y < clampedBottomY; y++) {
                    SpanOps.fill_Opaq(data32, width, height, clampedLeftX, y, spanLength, packedColor, clipBuffer);
                }
                return true;
            } else if (x1i === x2i) {
                // Vertical thick line - render as filled rectangle
                const halfWidth = lineWidth / 2;
                const leftX = Math.floor(x1 - halfWidth);
                const rightX = Math.floor(x1 + halfWidth);
                const topY = Math.min(y1i, y2i);
                const bottomY = Math.max(y1i, y2i);
                const packedColor = Surface.packColor(paintSource.r, paintSource.g, paintSource.b, 255);

                // Y bounds clamping for the loop
                const clampedTopY = Math.max(0, topY);
                const clampedBottomY = Math.min(height, bottomY);
                if (clampedTopY >= clampedBottomY) return true;

                // X bounds clamping (for span width)
                // Note: rightX - leftX is the span width (not +1) because leftX/rightX
                // are computed from floor(x - halfWidth) / floor(x + halfWidth)
                const clampedLeftX = Math.max(0, leftX);
                const clampedRightX = Math.min(width, rightX); // Use width (not width-1) since rightX is already exclusive
                const spanLength = clampedRightX - clampedLeftX;
                if (spanLength <= 0) return true;

                for (let y = clampedTopY; y < clampedBottomY; y++) {
                    SpanOps.fill_Opaq(data32, width, height, clampedLeftX, y, spanLength, packedColor, clipBuffer);
                }
                return true;
            } else {
                // Non-axis-aligned thick line - use polygon scan algorithm
                LineOps._strokeThick_PolyScan(
                    surface,
                    x1,
                    y1,
                    x2,
                    y2,
                    lineWidth,
                    paintSource,
                    globalAlpha,
                    clipBuffer,
                    false
                );
                return true;
            }
        } else if (isSemiTransparentColor && lineWidth <= THIN_LINE_THRESHOLD) {
            // Direct rendering for thin semitransparent lines: Bresenham with alpha blending
            const data = surface.data;
            const effectiveAlpha = (paintSource.a / 255) * globalAlpha;
            // Note: No early return - already inside a conditional branch
            const invAlpha = 1 - effectiveAlpha;
            const r = paintSource.r,
                g = paintSource.g,
                b = paintSource.b;

            let x1i = Math.floor(x1);
            let y1i = Math.floor(y1);
            let x2i = Math.floor(x2);
            let y2i = Math.floor(y2);

            if (x1i === x2i) {
                if (y2i > y1i) y2i--;
                else y1i--;
            }
            if (y1i === y2i) {
                if (x2i > x1i) x2i--;
                else x1i--;
            }

            // Optimize thin horizontal lines: use span-based rendering
            if (y1i === y2i) {
                // Y bounds check - skip if entirely off-screen
                if (y1i < 0 || y1i >= height) return true;

                // X bounds clamping
                const leftX = Math.max(0, Math.min(x1i, x2i));
                const rightX = Math.min(width - 1, Math.max(x1i, x2i));
                if (leftX > rightX) return true;

                const spanLength = rightX - leftX + 1;
                SpanOps.fill_Alpha(
                    data,
                    width,
                    height,
                    leftX,
                    y1i,
                    spanLength,
                    r,
                    g,
                    b,
                    effectiveAlpha,
                    invAlpha,
                    clipBuffer
                );
                return true;
            }

            const dx = Math.abs(x2i - x1i);
            const dy = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dx - dy;

            let x = x1i;
            let y = y1i;

            while (true) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const pixelIndex = y * width + x;
                    let drawPixel = true;

                    if (clipBuffer) {
                        const byteIndex = pixelIndex >> 3;
                        const bitIndex = pixelIndex & 7;
                        if (!(clipBuffer[byteIndex] & (1 << bitIndex))) {
                            drawPixel = false;
                        }
                    }

                    if (drawPixel) {
                        const __off = pixelIndex * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                    }
                }

                if (x === x2i && y === y2i) break;

                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y += sy;
                }
            }
            return true;
        } else if (isSemiTransparentColor) {
            // Direct rendering for thick semitransparent lines: polygon scan with alpha blending
            LineOps._strokeThick_PolyScan(
                surface,
                x1,
                y1,
                x2,
                y2,
                lineWidth,
                paintSource,
                globalAlpha,
                clipBuffer,
                true
            );
            return true;
        }

        // No direct rendering available
        return false;
    }

    /**
     * Fast thick line rendering using polygon scanline algorithm.
     * Treats the thick line as a quadrilateral and fills it using QuadScanOps.
     * @param {Surface} surface - Target surface
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} lineWidth - Stroke width
     * @param {Color} paintSource - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to QuadScanOps)
     * @param {boolean} useSemiTransparent - If true, use alpha blending
     */
    static _strokeThick_PolyScan(
        surface,
        x1,
        y1,
        x2,
        y2,
        lineWidth,
        paintSource,
        globalAlpha,
        clipBuffer,
        useSemiTransparent = false
    ) {
        const r = paintSource.r,
            g = paintSource.g,
            b = paintSource.b;

        const isOpaque = !useSemiTransparent;
        const packedColor = isOpaque ? Surface.packColor(r, g, b, 255) : 0;
        const effectiveAlpha = useSemiTransparent ? (paintSource.a / 255) * globalAlpha : 0;
        const invAlpha = useSemiTransparent ? 1 - effectiveAlpha : 0;

        const halfThick = lineWidth * 0.5;
        const corners = QuadScanOps.lineToQuad(x1, y1, x2, y2, halfThick);

        const params = {
            surface,
            r,
            g,
            b,
            isOpaque,
            packedColor,
            effectiveAlpha,
            invAlpha,
            clipBuffer
        };

        if (corners === null) {
            // Zero-length line - draw a square
            QuadScanOps.fillSquare(x1, y1, halfThick, params);
        } else {
            QuadScanOps.fillQuad(corners, params);
        }
    }
}

/**
 * RoundedRectUtils - Shared utilities for rounded rectangle rendering
 * Used by both RoundedRectOpsAA and RoundedRectOpsRot.
 */
class RoundedRectUtils {
    /**
     * Normalize radius for rounded rectangle, clamping to valid range.
     * Handles array input (only first element used) and ensures radius
     * doesn't exceed half of either dimension.
     *
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @returns {number} Normalized integer radius
     */
    static normalizeRadius(radii, width, height) {
        let radius = Array.isArray(radii) ? radii[0] : radii || 0;
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        return Math.round(Math.min(radius, Math.min(width, height) / 2));
    }

    /**
     * Get edge endpoint definitions for a rounded rectangle in local coordinates
     * (centered at origin). Used for perimeter generation in rotated rendering.
     *
     * @param {number} hw - Half-width
     * @param {number} hh - Half-height
     * @param {number} r - Corner radius
     * @returns {Array<{start: {x: number, y: number}, end: {x: number, y: number}}>}
     */
    static getEdgeEndpoints(hw, hh, r) {
        return [
            { start: { x: -hw + r, y: -hh }, end: { x: hw - r, y: -hh } }, // Top
            { start: { x: hw, y: -hh + r }, end: { x: hw, y: hh - r } }, // Right
            { start: { x: hw - r, y: hh }, end: { x: -hw + r, y: hh } }, // Bottom
            { start: { x: -hw, y: hh - r }, end: { x: -hw, y: -hh + r } } // Left
        ];
    }

    /**
     * Get corner arc definitions for a rounded rectangle in local coordinates
     * (centered at origin). Returns center points and angle ranges for each corner.
     *
     * @param {number} hw - Half-width
     * @param {number} hh - Half-height
     * @param {number} r - Corner radius
     * @returns {Array<{cx: number, cy: number, startAngle: number, endAngle: number}>}
     */
    static getCornerDefinitions(hw, hh, r) {
        return [
            { cx: -hw + r, cy: -hh + r, startAngle: Math.PI, endAngle: THREE_HALF_PI }, // Top-left
            { cx: hw - r, cy: -hh + r, startAngle: THREE_HALF_PI, endAngle: TAU }, // Top-right
            { cx: hw - r, cy: hh - r, startAngle: 0, endAngle: HALF_PI }, // Bottom-right
            { cx: -hw + r, cy: hh - r, startAngle: HALF_PI, endAngle: Math.PI } // Bottom-left
        ];
    }
}

/**
 * RoundedRectOpsRot - Static methods for rotated rounded rectangle rendering
 * Provides rotated rendering separately from axis-aligned logic in RoundedRectOpsAA.
 *
 * This class is loaded BEFORE RoundedRectOpsAA and provides all rotated rounded rectangle
 * rendering implementations. Called directly by Context2D for rotated cases.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Helpers - used by rotated implementations):
 *   _normalizeRadius, _transform, _generateEdgePixels, _generateArcPixels, _generatePerimeter
 *
 * Layer 2 (Implementations - internal):
 *   _fill_Rot_Opaq                → SpanOps.fill_Opaq
 *   _fill_Rot_Alpha               → SpanOps.fill_Alpha
 *   _stroke1px_Rot_Opaq           → Direct pixel writes
 *   _stroke1px_Rot_Alpha          → Inline BLEND_ALPHA marker (with lastPos tracking)
 *   _strokeThick_Rot_Opaq         → SpanOps.fill_Opaq
 *   _strokeThick_Rot_Alpha        → SpanOps.fill_Alpha
 *   _fillStroke_Rot_1px           → SpanOps.fill_Opaq/fill_Alpha + inline markers (double-generation)
 *   _fillStroke_Rot_Unified       → SpanOps.fill_Opaq/fill_Alpha
 *
 * Layer 3 (Dispatchers):
 *   fill_Rot_Any       → _fill_Rot_Opaq / _fill_Rot_Alpha
 *   stroke_Rot_Any     → _stroke1px_Rot_* / _strokeThick_Rot_*
 *   fillStroke_Rot_Any → _fillStroke_Rot_1px / _fillStroke_Rot_Unified
 *
 * External dependencies:
 *   - RectOpsRot.fill_Rot_Any (fallback when radius=0)
 *   - RectOpsRot.stroke_Rot_Any (fallback when radius=0)
 *   - ArcOps.stroke1px_Opaq_Exact (for corner arc strokes)
 *
 * MEMORY OPTIMIZATIONS:
 * ---------------------
 * - Module-level Int16Array buffer pool (_rrRotBufferPool) with growth-only strategy
 *   eliminates 10-20 allocations per call after initial warmup
 * - _stroke1px_Rot_Alpha uses global lastPos tracking across corners to prevent overdraw
 *   without Set allocation
 * - _fillStroke_Rot_1px uses double-generation: generates perimeter twice (bounds pass +
 *   render pass) instead of storing pixels in Set - CPU cycles are cheaper than hash ops
 *
 * Note: 1px stroke edges use inline Bresenham (no LineOps) to avoid line-shortening
 * that would create gaps at edge-arc junctions.
 *
 * Note: _fillStroke_Rot_1px includes assertion to catch axis-aligned cases that should
 * have been routed to RoundedRectOpsAA. Uses TRANSFORM_EPSILON (0.0001) aligned with
 * Transform2D.isAxisAligned for consistent threshold.
 */

// Module-level buffer pool for Int16Array span buffers (growth-only strategy)
// All functions share this pool since JavaScript is single-threaded.
const _rrRotBufferPool = {
    capacity: 0,
    // Fill buffers
    minX: null,
    maxX: null,
    // Stroke outer buffers
    outerMinX: null,
    outerMaxX: null,
    // Stroke inner buffers
    innerMinX: null,
    innerMaxX: null,
    // fillStroke stroke boundary buffers
    strokeMinX: null,
    strokeMaxX: null,
    // fillStroke fill buffers
    fillMinX: null,
    fillMaxX: null
};

/**
 * Ensure buffer pool has sufficient capacity (growth-only).
 * @param {number} spanCount - Required number of spans
 */
function _ensureRRRotBuffers(spanCount) {
    if (spanCount > _rrRotBufferPool.capacity) {
        // Grow with headroom to avoid frequent reallocations (2x or min 256)
        const newCapacity = Math.max(spanCount, _rrRotBufferPool.capacity * 2, 256);
        _rrRotBufferPool.minX = new Int16Array(newCapacity);
        _rrRotBufferPool.maxX = new Int16Array(newCapacity);
        _rrRotBufferPool.outerMinX = new Int16Array(newCapacity);
        _rrRotBufferPool.outerMaxX = new Int16Array(newCapacity);
        _rrRotBufferPool.innerMinX = new Int16Array(newCapacity);
        _rrRotBufferPool.innerMaxX = new Int16Array(newCapacity);
        _rrRotBufferPool.strokeMinX = new Int16Array(newCapacity);
        _rrRotBufferPool.strokeMaxX = new Int16Array(newCapacity);
        _rrRotBufferPool.fillMinX = new Int16Array(newCapacity);
        _rrRotBufferPool.fillMaxX = new Int16Array(newCapacity);
        _rrRotBufferPool.capacity = newCapacity;
    }
}

class RoundedRectOpsRot {
    // =========================================================================
    // Private Static Helpers
    // =========================================================================

    /**
     * Transform local coordinates to screen coordinates using rotation matrix.
     * @param {number} localX - Local X coordinate
     * @param {number} localY - Local Y coordinate
     * @param {number} centerX - Center X in screen coordinates
     * @param {number} centerY - Center Y in screen coordinates
     * @param {number} cos - Cosine of rotation angle
     * @param {number} sin - Sine of rotation angle
     * @returns {{x: number, y: number}} Screen coordinates
     * @private
     */
    static _transform(localX, localY, centerX, centerY, cos, sin) {
        return {
            x: centerX + localX * cos - localY * sin,
            y: centerY + localX * sin + localY * cos
        };
    }

    /**
     * Generate edge pixels using Bresenham's line algorithm.
     * @param {number} x0 - Start X coordinate
     * @param {number} y0 - Start Y coordinate
     * @param {number} x1 - End X coordinate
     * @param {number} y1 - End Y coordinate
     * @param {function(number, number): void} recorder - Pixel recording callback
     * @private
     */
    static _generateEdgePixels(x0, y0, x1, y1, recorder) {
        const ix0 = Math.floor(x0),
            iy0 = Math.floor(y0);
        const ix1 = Math.floor(x1),
            iy1 = Math.floor(y1);
        const dx = Math.abs(ix1 - ix0),
            dy = Math.abs(iy1 - iy0);
        const sx = ix0 < ix1 ? 1 : -1,
            sy = iy0 < iy1 ? 1 : -1;
        let err = dx - dy,
            x = ix0,
            y = iy0;
        while (true) {
            recorder(x, y);
            if (x === ix1 && y === iy1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }

    /**
     * Generate arc pixels using angle-based iteration.
     * @param {number} cx - Center X coordinate
     * @param {number} cy - Center Y coordinate
     * @param {number} r - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {function(number, number): void} recorder - Pixel recording callback
     * @private
     */
    static _generateArcPixels(cx, cy, r, startAngle, endAngle, recorder) {
        if (r <= 0) return;
        const arcLength = r * Math.abs(endAngle - startAngle);
        const steps = Math.max(Math.ceil(arcLength), 8);
        const angleStep = (endAngle - startAngle) / steps;
        let lastPx = null,
            lastPy = null;
        for (let i = 0; i <= steps; i++) {
            const angle = startAngle + i * angleStep;
            const px = Math.floor(cx + r * Math.cos(angle));
            const py = Math.floor(cy + r * Math.sin(angle));
            if (px !== lastPx || py !== lastPy) {
                recorder(px, py);
                lastPx = px;
                lastPy = py;
            }
        }
    }

    /**
     * Generate perimeter pixels for a rounded rectangle.
     * @param {number} hw - Half-width
     * @param {number} hh - Half-height
     * @param {number} r - Corner radius
     * @param {function(number, number): void} recorder - Pixel recording callback
     * @param {number} centerX - Center X in screen coordinates
     * @param {number} centerY - Center Y in screen coordinates
     * @param {number} cos - Cosine of rotation angle
     * @param {number} sin - Sine of rotation angle
     * @param {number} rotation - Rotation angle in radians
     * @private
     */
    static _generatePerimeter(hw, hh, r, recorder, centerX, centerY, cos, sin, rotation) {
        const edges = RoundedRectUtils.getEdgeEndpoints(hw, hh, r);
        for (const edge of edges) {
            const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
            const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);
            const dx = end.x - start.x,
                dy = end.y - start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;
            RoundedRectOpsRot._generateEdgePixels(start.x, start.y, end.x, end.y, recorder);
        }
        const corners = RoundedRectUtils.getCornerDefinitions(hw, hh, r);
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            RoundedRectOpsRot._generateArcPixels(
                screenCenter.x,
                screenCenter.y,
                r,
                corner.startAngle + rotation,
                corner.endAngle + rotation,
                recorder
            );
        }
    }

    // =========================================================================
    // Fill Methods
    // =========================================================================

    /**
     * Direct rendering for filled rotated rounded rectangle.
     * Uses Edge Buffer Rasterization: generates perimeter into minX/maxX arrays,
     * then fills scanlines efficiently with data32.fill().
     *
     * Algorithm complexity: O(H + P + A) where H=height, P=perimeter, A=fill area.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static fill_Rot_Any(
        surface,
        centerX,
        centerY,
        width,
        height,
        radii,
        rotation,
        color,
        globalAlpha,
        clipBuffer = null
    ) {
        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOpsRot.fill_Rot_Any for zero radius
        if (radius <= 0) {
            RectOpsRot.fill_Rot_Any(surface, centerX, centerY, width, height, rotation, color, globalAlpha, clipBuffer);
            return;
        }

        const isOpaqueColor = color.a === 255 && globalAlpha >= 1.0;

        if (isOpaqueColor) {
            RoundedRectOpsRot._fill_Rot_Opaq(
                surface,
                centerX,
                centerY,
                width,
                height,
                radius,
                rotation,
                color,
                clipBuffer
            );
        } else if (color.a > 0) {
            RoundedRectOpsRot._fill_Rot_Alpha(
                surface,
                centerX,
                centerY,
                width,
                height,
                radius,
                rotation,
                color,
                globalAlpha,
                clipBuffer
            );
        }
    }

    /**
     * Internal: Opaque fill for rotated rounded rectangle using Edge Buffer Rasterization.
     *
     * Algorithm:
     * 1. Compute Y bounds from rotation angle (O(1))
     * 2. Allocate minX/maxX Int16Arrays sized to shape height
     * 3. Generate perimeter (edges + corner arcs), recording min/max X per row
     * 4. Fill scanlines using data32.fill() for each row
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Fill color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _fill_Rot_Opaq(surface, centerX, centerY, width, height, radius, rotation, color, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Compute AABB height (exact formula for rotated rectangle)
        const boundingHeight = Math.abs(width * sin) + Math.abs(height * cos);

        // Clamp to canvas bounds BEFORE array allocation
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const minX = _rrRotBufferPool.minX;
        const maxX = _rrRotBufferPool.maxX;
        for (let i = 0; i < spanCount; i++) {
            minX[i] = surfaceWidth; // Sentinel: larger than any valid x
            maxX[i] = -1; // Sentinel: smaller than any valid x
        }

        // Record perimeter pixel into span arrays
        const recordPixel = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < minX[row]) minX[row] = x;
            if (x > maxX[row]) maxX[row] = x;
        };

        // Edge endpoints in local space (centered at origin)
        const edges = RoundedRectUtils.getEdgeEndpoints(hw, hh, radius);

        // Generate edge perimeter pixels
        for (const edge of edges) {
            const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
            const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);

            // Skip zero-length edges (radius = half width or height)
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;

            RoundedRectOpsRot._generateEdgePixels(start.x, start.y, end.x, end.y, recordPixel);
        }

        // Corner definitions (local center and angle range)
        const corners = RoundedRectUtils.getCornerDefinitions(hw, hh, radius);

        // Generate corner arc perimeter pixels
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            RoundedRectOpsRot._generateArcPixels(
                screenCenter.x,
                screenCenter.y,
                radius,
                corner.startAngle + rotation,
                corner.endAngle + rotation,
                recordPixel
            );
        }

        // Fill scanlines
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        if (!clipBuffer) {
            // Fast path: no clipping
            for (let row = 0; row < spanCount; row++) {
                const left = minX[row];
                const right = maxX[row];
                if (left > right) continue;

                const y = yMin + row;
                const x0 = Math.max(0, left);
                const x1 = Math.min(surfaceWidth - 1, right);

                if (x0 <= x1) {
                    const offset = y * surfaceWidth;
                    data32.fill(packedColor, offset + x0, offset + x1 + 1);
                }
            }
        } else {
            // Slower path: per-pixel clipping
            for (let row = 0; row < spanCount; row++) {
                const left = minX[row];
                const right = maxX[row];
                if (left > right) continue;

                const y = yMin + row;
                const x0 = Math.max(0, left);
                const x1 = Math.min(surfaceWidth - 1, right);

                for (let x = x0; x <= x1; x++) {
                    const pos = y * surfaceWidth + x;
                    if (clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        data32[pos] = packedColor;
                    }
                }
            }
        }
    }

    /**
     * Internal: Alpha fill for rotated rounded rectangle using Edge Buffer Rasterization.
     *
     * Same algorithm as _fill_Rot_Opaq but with alpha blending in the fill phase.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _fill_Rot_Alpha(surface, centerX, centerY, width, height, radius, rotation, color, globalAlpha, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Compute AABB height
        const boundingHeight = Math.abs(width * sin) + Math.abs(height * cos);

        // Clamp to canvas bounds
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const minX = _rrRotBufferPool.minX;
        const maxX = _rrRotBufferPool.maxX;
        for (let i = 0; i < spanCount; i++) {
            minX[i] = surfaceWidth;
            maxX[i] = -1;
        }

        const recordPixel = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < minX[row]) minX[row] = x;
            if (x > maxX[row]) maxX[row] = x;
        };

        // Edge endpoints
        const edges = RoundedRectUtils.getEdgeEndpoints(hw, hh, radius);

        for (const edge of edges) {
            const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
            const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;
            RoundedRectOpsRot._generateEdgePixels(start.x, start.y, end.x, end.y, recordPixel);
        }

        // Corner definitions
        const corners = RoundedRectUtils.getCornerDefinitions(hw, hh, radius);

        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            RoundedRectOpsRot._generateArcPixels(
                screenCenter.x,
                screenCenter.y,
                radius,
                corner.startAngle + rotation,
                corner.endAngle + rotation,
                recordPixel
            );
        }

        // Fill with alpha blending via SpanOps
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        for (let row = 0; row < spanCount; row++) {
            const left = minX[row];
            const right = maxX[row];
            if (left > right) continue;

            const y = yMin + row;
            const x0 = Math.max(0, left);
            const x1 = Math.min(surfaceWidth - 1, right);

            if (x0 <= x1) {
                const spanLength = x1 - x0 + 1;
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    x0,
                    y,
                    spanLength,
                    r,
                    g,
                    b,
                    effectiveAlpha,
                    invAlpha,
                    clipBuffer
                );
            }
        }
    }

    // =========================================================================
    // Stroke Methods
    // =========================================================================

    /**
     * Direct rendering for stroked rotated rounded rectangle.
     * Dispatches to appropriate sub-method based on lineWidth and opacity.
     *
     * Uses center-based coordinates (like RectOps.stroke_Rot_Any) since rotation
     * naturally occurs around the center point.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static stroke_Rot_Any(
        surface,
        centerX,
        centerY,
        width,
        height,
        radii,
        rotation,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer = null
    ) {
        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOpsRot.stroke_Rot_Any for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsRot.stroke_Rot_Any(
                surface,
                centerX,
                centerY,
                width,
                height,
                rotation,
                lineWidth,
                color,
                globalAlpha,
                clipBuffer
            );
            return;
        }

        const isOpaqueColor = color.a === 255 && globalAlpha >= 1.0;
        const isSemiTransparentColor = !isOpaqueColor && color.a > 0;

        // Handle 1px strokes
        if (lineWidth <= 1) {
            if (isOpaqueColor) {
                RoundedRectOpsRot._stroke1px_Rot_Opaq(
                    surface,
                    centerX,
                    centerY,
                    width,
                    height,
                    radius,
                    rotation,
                    color,
                    clipBuffer
                );
            } else if (isSemiTransparentColor) {
                RoundedRectOpsRot._stroke1px_Rot_Alpha(
                    surface,
                    centerX,
                    centerY,
                    width,
                    height,
                    radius,
                    rotation,
                    color,
                    globalAlpha,
                    clipBuffer
                );
            }
            return;
        }

        // Handle thick strokes
        if (isSemiTransparentColor) {
            RoundedRectOpsRot._strokeThick_Rot_Alpha(
                surface,
                centerX,
                centerY,
                width,
                height,
                radius,
                rotation,
                lineWidth,
                color,
                globalAlpha,
                clipBuffer
            );
        } else if (isOpaqueColor) {
            RoundedRectOpsRot._strokeThick_Rot_Opaq(
                surface,
                centerX,
                centerY,
                width,
                height,
                radius,
                rotation,
                lineWidth,
                color,
                clipBuffer
            );
        }
    }

    /**
     * Internal: 1px opaque stroke for rotated rounded rectangle.
     * Uses hybrid approach: 4 straight edges via inline Bresenham + 4 corner arcs via ArcOps.
     *
     * Edges use inline Bresenham (not LineOps) to avoid line-shortening that would
     * create gaps at edge-arc junctions. Since stroke is opaque, overdraw is fine.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _stroke1px_Rot_Opaq(surface, centerX, centerY, width, height, radius, rotation, color, clipBuffer) {
        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2; // half-width
        const hh = height / 2; // half-height

        // Calculate 8 edge endpoints in local space, then transform to screen space
        // Local coordinates (centered at origin):
        // - Top edge: (-hw+radius, -hh) to (hw-radius, -hh)
        // - Right edge: (hw, -hh+radius) to (hw, hh-radius)
        // - Bottom edge: (hw-radius, hh) to (-hw+radius, hh)
        // - Left edge: (-hw, hh-radius) to (-hw, -hh+radius)

        const edgeEndpoints = [
            // Top edge
            {
                start: RoundedRectOpsRot._transform(-hw + radius, -hh, centerX, centerY, cos, sin),
                end: RoundedRectOpsRot._transform(hw - radius, -hh, centerX, centerY, cos, sin)
            },
            // Right edge
            {
                start: RoundedRectOpsRot._transform(hw, -hh + radius, centerX, centerY, cos, sin),
                end: RoundedRectOpsRot._transform(hw, hh - radius, centerX, centerY, cos, sin)
            },
            // Bottom edge
            {
                start: RoundedRectOpsRot._transform(hw - radius, hh, centerX, centerY, cos, sin),
                end: RoundedRectOpsRot._transform(-hw + radius, hh, centerX, centerY, cos, sin)
            },
            // Left edge
            {
                start: RoundedRectOpsRot._transform(-hw, hh - radius, centerX, centerY, cos, sin),
                end: RoundedRectOpsRot._transform(-hw, -hh + radius, centerX, centerY, cos, sin)
            }
        ];

        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Draw 4 straight edges via inline Bresenham (no shortening for perimeter edges)
        for (const edge of edgeEndpoints) {
            const dx = edge.end.x - edge.start.x;
            const dy = edge.end.y - edge.start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;

            const x1i = Math.floor(edge.start.x);
            const y1i = Math.floor(edge.start.y);
            const x2i = Math.floor(edge.end.x);
            const y2i = Math.floor(edge.end.y);

            // NOTE: No line shortening! Perimeter edges must meet arcs exactly.

            const dxAbs = Math.abs(x2i - x1i);
            const dyAbs = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dxAbs - dyAbs;
            let x = x1i,
                y = y1i;

            while (true) {
                if (x >= 0 && x < surfaceWidth && y >= 0 && y < surfaceHeight) {
                    const pixelIndex = y * surfaceWidth + x;
                    if (!clipBuffer || clipBuffer[pixelIndex >> 3] & (1 << (pixelIndex & 7))) {
                        data32[pixelIndex] = packedColor;
                    }
                }
                if (x === x2i && y === y2i) break;
                const e2 = 2 * err;
                if (e2 > -dyAbs) {
                    err -= dyAbs;
                    x += sx;
                }
                if (e2 < dxAbs) {
                    err += dxAbs;
                    y += sy;
                }
            }
        }

        // Calculate 4 corner arc centers in local space, then transform to screen space
        // Local corner centers and their angle ranges:
        // - Top-left: (-hw+radius, -hh+radius), angles: π to 3π/2
        // - Top-right: (hw-radius, -hh+radius), angles: 3π/2 to 2π
        // - Bottom-right: (hw-radius, hh-radius), angles: 0 to π/2
        // - Bottom-left: (-hw+radius, hh-radius), angles: π/2 to π

        const corners = RoundedRectUtils.getCornerDefinitions(hw, hh, radius);

        // Draw 4 corner arcs
        // Arc angles shift by rotation when the shape is rotated
        // Always use angle-based iteration for rotated rounded rects to ensure junction alignment with the sides (or other corner if the side ends up being zero-length).
        // Bresenham has angular coverage gaps at any radius, which cause discontinuities.
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            // Angle-based iteration with exact endpoints (guaranteed junction alignment)
            ArcOps.stroke1px_Opaq_Exact(
                surface,
                screenCenter.x,
                screenCenter.y,
                radius,
                corner.startAngle + rotation,
                corner.endAngle + rotation,
                color,
                clipBuffer
            );
        }
    }

    /**
     * Internal: 1px semi-transparent stroke for rotated rounded rectangle.
     * Uses hybrid approach: 4 straight edges + 4 corner arcs with Set deduplication
     * to prevent overdraw at edge-arc junctions (which would cause incorrect alpha blending).
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _stroke1px_Rot_Alpha(
        surface,
        centerX,
        centerY,
        width,
        height,
        radius,
        rotation,
        color,
        globalAlpha,
        clipBuffer
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha for blending
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2; // half-width
        const hh = height / 2; // half-height

        // Define 4 corner arc centers and angles (needed first for junction calculation)
        const corners = RoundedRectUtils.getCornerDefinitions(hw, hh, radius);

        // Pre-compute junction pixels using the SAME math as corner rendering.
        // This ensures edges skip exactly the pixels that corners will draw.
        // CRITICAL: Store both integer (floored) and float coordinates.
        // Edge endpoints are DERIVED from these junction pixels, NOT computed separately!
        // This eliminates floating-point precision mismatches that cause overdraw.
        const junctionPixels = [];
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            const cx = screenCenter.x;
            const cy = screenCenter.y;

            // Start junction (connects to previous edge's end)
            const startAngle = corner.startAngle + rotation;
            const startXf = cx + radius * Math.cos(startAngle);
            const startYf = cy + radius * Math.sin(startAngle);
            junctionPixels.push({
                x: Math.floor(startXf),
                y: Math.floor(startYf),
                xf: startXf,
                yf: startYf // Float coords for edge length calculation
            });

            // End junction (connects to next edge's start)
            const endAngle = corner.endAngle + rotation;
            const endXf = cx + radius * Math.cos(endAngle);
            const endYf = cy + radius * Math.sin(endAngle);
            junctionPixels.push({
                x: Math.floor(endXf),
                y: Math.floor(endYf),
                xf: endXf,
                yf: endYf
            });
        }

        // DERIVE edge endpoints from junction pixels (DON'T compute separately!)
        // This guarantees Bresenham first/last pixels match junction pixels exactly.
        // Edge connectivity:
        // Edge 0 (Top): TL_end (1) → TR_start (2)
        // Edge 1 (Right): TR_end (3) → BR_start (4)
        // Edge 2 (Bottom): BR_end (5) → BL_start (6)
        // Edge 3 (Left): BL_end (7) → TL_start (0)
        const edgeEndpoints = [
            { start: junctionPixels[1], end: junctionPixels[2] }, // Top edge
            { start: junctionPixels[3], end: junctionPixels[4] }, // Right edge
            { start: junctionPixels[5], end: junctionPixels[6] }, // Bottom edge
            { start: junctionPixels[7], end: junctionPixels[0] } // Left edge
        ];

        // Draw edge pixels via Bresenham, skipping junction pixels by coordinate match
        for (let edgeIndex = 0; edgeIndex < edgeEndpoints.length; edgeIndex++) {
            const edge = edgeEndpoints[edgeIndex];
            // Junction pixels to skip (same objects as edge start/end, guaranteed match!)
            const junc1 = edge.start;
            const junc2 = edge.end;

            // Skip zero-length edges (use float coords for accurate length)
            const dx = edge.end.xf - edge.start.xf;
            const dy = edge.end.yf - edge.start.yf;
            const edgeLength = Math.sqrt(dx * dx + dy * dy);
            if (edgeLength < MIN_EDGE_LENGTH) continue;

            // Use integer coords for Bresenham (same as junction pixels!)
            const x1i = edge.start.x;
            const y1i = edge.start.y;
            const x2i = edge.end.x;
            const y2i = edge.end.y;

            const dxAbs = Math.abs(x2i - x1i);
            const dyAbs = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dxAbs - dyAbs;

            let x = x1i;
            let y = y1i;

            while (true) {
                const isLast = x === x2i && y === y2i;

                // Skip if current pixel matches either junction pixel (corner will handle it)
                if (!((x === junc1.x && y === junc1.y) || (x === junc2.x && y === junc2.y))) {
                    if (x >= 0 && x < surfaceWidth && y >= 0 && y < surfaceHeight) {
                        const pos = y * surfaceWidth + x;
                        if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                            const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                        }
                    }
                }

                if (isLast) break;

                const e2 = 2 * err;
                if (e2 > -dyAbs) {
                    err -= dyAbs;
                    x += sx;
                }
                if (e2 < dxAbs) {
                    err += dxAbs;
                    y += sy;
                }
            }
        }

        // Draw corner arc pixels with cross-corner duplicate tracking
        // Angle iteration can map multiple angles to the same pixel for small radii.
        // Additionally, adjacent corners may map their junction pixels to the same screen coordinate
        // (e.g., TR's END and BR's START may both be pixel (170,171)).
        // Using a global lastPos across ALL corners prevents overdraw in both cases:
        // 1. Consecutive duplicates within a single corner arc
        // 2. Corner END matching next corner's START (when they map to the same pixel)
        let globalLastPos = -1;

        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            const arcCx = screenCenter.x;
            const arcCy = screenCenter.y;
            const startAngle = corner.startAngle + rotation;
            const endAngle = corner.endAngle + rotation;

            // Angle-based iteration for arc pixels
            const arcLength = radius * Math.abs(endAngle - startAngle);
            const numSteps = Math.max(Math.ceil(arcLength * 2), 8);
            const angleStep = (endAngle - startAngle) / numSteps;

            // Incremental rotation (avoid Math.cos/sin in loop)
            const cosStep = Math.cos(angleStep);
            const sinStep = Math.sin(angleStep);

            // Start position relative to center
            let ax = radius * Math.cos(startAngle);
            let ay = radius * Math.sin(startAngle);

            for (let i = 0; i <= numSteps; i++) {
                // Force exact precision for the final point
                if (i === numSteps) {
                    ax = radius * Math.cos(endAngle);
                    ay = radius * Math.sin(endAngle);
                }

                const px = Math.floor(arcCx + ax);
                const py = Math.floor(arcCy + ay);

                if (px >= 0 && px < surfaceWidth && py >= 0 && py < surfaceHeight) {
                    const pos = py * surfaceWidth + px;
                    // Skip consecutive duplicates (including cross-corner duplicates)
                    if (pos !== globalLastPos) {
                        globalLastPos = pos;
                        if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                            const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
                        }
                    }
                }

                // Apply rotation for next iteration
                const nextX = ax * cosStep - ay * sinStep;
                ay = ax * sinStep + ay * cosStep;
                ax = nextX;
            }
        }
    }

    /**
     * Internal: Thick opaque stroke for rotated rounded rectangle.
     * Uses Dual Edge Buffer algorithm: generates outer and inner perimeters,
     * then fills the annulus between them per scanline.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _strokeThick_Rot_Opaq(
        surface,
        centerX,
        centerY,
        width,
        height,
        radius,
        rotation,
        lineWidth,
        color,
        clipBuffer
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        const halfStroke = lineWidth / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        // Outer dimensions (path expanded by halfStroke)
        const outerWidth = width + lineWidth;
        const outerHeight = height + lineWidth;
        const outerRadius = Math.min(radius + halfStroke, Math.min(outerWidth, outerHeight) / 2);
        const outerHW = outerWidth / 2;
        const outerHH = outerHeight / 2;

        // Inner dimensions (path contracted by halfStroke)
        const innerWidth = width - lineWidth;
        const innerHeight = height - lineWidth;
        const innerRadius = Math.max(0, radius - halfStroke);
        const innerHW = innerWidth / 2;
        const innerHH = innerHeight / 2;
        const hasInnerRect = innerWidth > 0 && innerHeight > 0;

        // Compute AABB height based on outer bounds
        const boundingHeight = Math.abs(outerWidth * sin) + Math.abs(outerHeight * cos);

        // Clamp to canvas bounds
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const outerMinX = _rrRotBufferPool.outerMinX;
        const outerMaxX = _rrRotBufferPool.outerMaxX;
        for (let i = 0; i < spanCount; i++) {
            outerMinX[i] = surfaceWidth;
            outerMaxX[i] = -1;
        }

        // Use pooled inner perimeter buffers (if inner rect exists)
        const innerMinX = hasInnerRect ? _rrRotBufferPool.innerMinX : null;
        const innerMaxX = hasInnerRect ? _rrRotBufferPool.innerMaxX : null;
        if (hasInnerRect) {
            for (let i = 0; i < spanCount; i++) {
                innerMinX[i] = surfaceWidth;
                innerMaxX[i] = -1;
            }
        }

        // Helper to record pixel to outer perimeter
        const recordOuter = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < outerMinX[row]) outerMinX[row] = x;
            if (x > outerMaxX[row]) outerMaxX[row] = x;
        };

        // Helper to record pixel to inner perimeter
        const recordInner = hasInnerRect
            ? (x, y) => {
                  if (y < yMin || y > yMax) return;
                  const row = y - yMin;
                  if (x < innerMinX[row]) innerMinX[row] = x;
                  if (x > innerMaxX[row]) innerMaxX[row] = x;
              }
            : null;

        // Generate outer perimeter
        RoundedRectOpsRot._generatePerimeter(
            outerHW,
            outerHH,
            outerRadius,
            recordOuter,
            centerX,
            centerY,
            cos,
            sin,
            rotation
        );

        // Generate inner perimeter (if inner rect exists)
        if (hasInnerRect) {
            RoundedRectOpsRot._generatePerimeter(
                innerHW,
                innerHH,
                innerRadius,
                recordInner,
                centerX,
                centerY,
                cos,
                sin,
                rotation
            );
        }

        // Fill annulus per scanline
        for (let row = 0; row < spanCount; row++) {
            const outerLeft = outerMinX[row];
            const outerRight = outerMaxX[row];
            if (outerLeft > outerRight) continue;

            const y = yMin + row;

            if (hasInnerRect) {
                const innerLeft = innerMinX[row];
                const innerRight = innerMaxX[row];

                if (innerLeft <= innerRight) {
                    // Has inner hole: fill left span [outerLeft, innerLeft-1] and right span [innerRight+1, outerRight]
                    // Left span
                    const leftStart = Math.max(0, outerLeft);
                    const leftEnd = Math.min(surfaceWidth - 1, innerLeft - 1);
                    if (leftStart <= leftEnd) {
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            leftStart,
                            y,
                            leftEnd - leftStart + 1,
                            packedColor,
                            clipBuffer
                        );
                    }

                    // Right span
                    const rightStart = Math.max(0, innerRight + 1);
                    const rightEnd = Math.min(surfaceWidth - 1, outerRight);
                    if (rightStart <= rightEnd) {
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            rightStart,
                            y,
                            rightEnd - rightStart + 1,
                            packedColor,
                            clipBuffer
                        );
                    }
                } else {
                    // No inner hole on this row: fill entire outer span
                    const x0 = Math.max(0, outerLeft);
                    const x1 = Math.min(surfaceWidth - 1, outerRight);
                    if (x0 <= x1) {
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            x0,
                            y,
                            x1 - x0 + 1,
                            packedColor,
                            clipBuffer
                        );
                    }
                }
            } else {
                // No inner rect: fill entire outer span (solid fill)
                const x0 = Math.max(0, outerLeft);
                const x1 = Math.min(surfaceWidth - 1, outerRight);
                if (x0 <= x1) {
                    SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, y, x1 - x0 + 1, packedColor, clipBuffer);
                }
            }
        }
    }

    /**
     * Internal: Thick semi-transparent stroke for rotated rounded rectangle.
     * Uses same Dual Edge Buffer algorithm as opaque, but with alpha blending.
     * The algorithm is inherently overdraw-free (each pixel visited exactly once).
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _strokeThick_Rot_Alpha(
        surface,
        centerX,
        centerY,
        width,
        height,
        radius,
        rotation,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha for blending
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        const halfStroke = lineWidth / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        // Outer dimensions (path expanded by halfStroke)
        const outerWidth = width + lineWidth;
        const outerHeight = height + lineWidth;
        const outerRadius = Math.min(radius + halfStroke, Math.min(outerWidth, outerHeight) / 2);
        const outerHW = outerWidth / 2;
        const outerHH = outerHeight / 2;

        // Inner dimensions (path contracted by halfStroke)
        const innerWidth = width - lineWidth;
        const innerHeight = height - lineWidth;
        const innerRadius = Math.max(0, radius - halfStroke);
        const innerHW = innerWidth / 2;
        const innerHH = innerHeight / 2;
        const hasInnerRect = innerWidth > 0 && innerHeight > 0;

        // Compute AABB height based on outer bounds
        const boundingHeight = Math.abs(outerWidth * sin) + Math.abs(outerHeight * cos);

        // Clamp to canvas bounds
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const outerMinX = _rrRotBufferPool.outerMinX;
        const outerMaxX = _rrRotBufferPool.outerMaxX;
        for (let i = 0; i < spanCount; i++) {
            outerMinX[i] = surfaceWidth;
            outerMaxX[i] = -1;
        }

        // Use pooled inner perimeter buffers (if inner rect exists)
        const innerMinX = hasInnerRect ? _rrRotBufferPool.innerMinX : null;
        const innerMaxX = hasInnerRect ? _rrRotBufferPool.innerMaxX : null;
        if (hasInnerRect) {
            for (let i = 0; i < spanCount; i++) {
                innerMinX[i] = surfaceWidth;
                innerMaxX[i] = -1;
            }
        }

        // Helper to record pixel to outer perimeter
        const recordOuter = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < outerMinX[row]) outerMinX[row] = x;
            if (x > outerMaxX[row]) outerMaxX[row] = x;
        };

        // Helper to record pixel to inner perimeter
        const recordInner = hasInnerRect
            ? (x, y) => {
                  if (y < yMin || y > yMax) return;
                  const row = y - yMin;
                  if (x < innerMinX[row]) innerMinX[row] = x;
                  if (x > innerMaxX[row]) innerMaxX[row] = x;
              }
            : null;

        // Generate outer perimeter
        RoundedRectOpsRot._generatePerimeter(
            outerHW,
            outerHH,
            outerRadius,
            recordOuter,
            centerX,
            centerY,
            cos,
            sin,
            rotation
        );

        // Generate inner perimeter (if inner rect exists)
        if (hasInnerRect) {
            RoundedRectOpsRot._generatePerimeter(
                innerHW,
                innerHH,
                innerRadius,
                recordInner,
                centerX,
                centerY,
                cos,
                sin,
                rotation
            );
        }

        // Fill annulus per scanline with alpha blending via SpanOps
        for (let row = 0; row < spanCount; row++) {
            const outerLeft = outerMinX[row];
            const outerRight = outerMaxX[row];
            if (outerLeft > outerRight) continue;

            const y = yMin + row;

            if (hasInnerRect) {
                const innerLeft = innerMinX[row];
                const innerRight = innerMaxX[row];

                if (innerLeft <= innerRight) {
                    // Has inner hole: fill left span and right span
                    const leftStart = Math.max(0, outerLeft);
                    const leftEnd = Math.min(surfaceWidth - 1, innerLeft - 1);
                    if (leftStart <= leftEnd) {
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            leftStart,
                            y,
                            leftEnd - leftStart + 1,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }

                    const rightStart = Math.max(0, innerRight + 1);
                    const rightEnd = Math.min(surfaceWidth - 1, outerRight);
                    if (rightStart <= rightEnd) {
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            rightStart,
                            y,
                            rightEnd - rightStart + 1,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }
                } else {
                    // No inner hole on this row: fill entire outer span
                    const x0 = Math.max(0, outerLeft);
                    const x1 = Math.min(surfaceWidth - 1, outerRight);
                    if (x0 <= x1) {
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            x0,
                            y,
                            x1 - x0 + 1,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }
                }
            } else {
                // No inner rect: fill entire outer span
                const x0 = Math.max(0, outerLeft);
                const x1 = Math.min(surfaceWidth - 1, outerRight);
                if (x0 <= x1) {
                    SpanOps.fill_Alpha(
                        data,
                        surfaceWidth,
                        surfaceHeight,
                        x0,
                        y,
                        x1 - x0 + 1,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            }
        }
    }

    // =========================================================================
    // Combined Fill+Stroke
    // =========================================================================

    /**
     * Direct rendering for filled and stroked rotated rounded rectangle.
     * Uses unified scanline rendering to ensure fill never extends past stroke.
     *
     * Algorithm: Generates all three boundaries (fill, stroke outer, stroke inner)
     * using the same perimeter generation algorithm, then processes each scanline
     * once, rendering fill first (clamped to stroke outer) then stroke on top.
     *
     * This approach solves the pixel divergence problem that occurred when fill
     * and stroke were rendered separately with different algorithms.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color (null/undefined to skip fill)
     * @param {Color} strokeColor - Stroke color (null/undefined to skip stroke)
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static fillStroke_Rot_Any(
        surface,
        centerX,
        centerY,
        width,
        height,
        radii,
        rotation,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer = null
    ) {
        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        // If no stroke, just do fill
        if (!hasStroke) {
            RoundedRectOpsRot.fill_Rot_Any(
                surface,
                centerX,
                centerY,
                width,
                height,
                radii,
                rotation,
                fillColor,
                globalAlpha,
                clipBuffer
            );
            return;
        }

        // If no fill, just do stroke
        if (!hasFill) {
            RoundedRectOpsRot.stroke_Rot_Any(
                surface,
                centerX,
                centerY,
                width,
                height,
                radii,
                rotation,
                lineWidth,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
            return;
        }

        // Fallback to RectOpsRot for zero radius
        if (radius <= 0) {
            RectOpsRot.fillStroke_Rot_Any(
                surface,
                centerX,
                centerY,
                width,
                height,
                rotation,
                lineWidth,
                fillColor,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
            return;
        }

        // For 1px stroke, use special handling to ensure stroke is only on perimeter
        // For thick stroke (>1px), use unified scanline rendering
        if (lineWidth <= 1) {
            RoundedRectOpsRot._fillStroke_Rot_1px(
                surface,
                centerX,
                centerY,
                width,
                height,
                radius,
                rotation,
                fillColor,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
        } else {
            RoundedRectOpsRot._fillStroke_Rot_Unified(
                surface,
                centerX,
                centerY,
                width,
                height,
                radius,
                rotation,
                lineWidth,
                fillColor,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
        }
    }

    /**
     * Internal: Fill+stroke for 1px stroke on rotated rounded rectangle.
     * Uses perimeter-clamped fill + Set-based stroke rendering.
     *
     * IMPORTANT: This method only handles non-axis-aligned (rotated) cases.
     * Includes assertion to catch routing errors - axis-aligned shapes should
     * use RoundedRectOpsAA.fillStroke_AA_Any() instead.
     *
     * For 1px stroke, the stroke is only the perimeter pixels (not a filled annulus).
     * We generate the stroke perimeter, use it to clamp fill, then render stroke pixels.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} fillColor - Fill color
     * @param {Color} strokeColor - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _fillStroke_Rot_1px(
        surface,
        centerX,
        centerY,
        width,
        height,
        radius,
        rotation,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        // Assertion: This method should only be called for non-axis-aligned shapes.
        // If |sin| < TRANSFORM_EPSILON, the shape should have been routed to RoundedRectOpsAA.
        if (Math.abs(sin) < TRANSFORM_EPSILON) {
            throw new Error(
                `_fillStroke_Rot_1px called with axis-aligned rotation (sin=${sin}). ` +
                    `This should have been routed to RoundedRectOpsAA.`
            );
        }

        const hw = width / 2;
        const hh = height / 2;

        // Edge endpoints in local space
        const edges = RoundedRectUtils.getEdgeEndpoints(hw, hh, radius);

        // Corner definitions
        const corners = RoundedRectUtils.getCornerDefinitions(hw, hh, radius);

        // Calculate bounding box for fill
        const boundingHeight = Math.abs(width * sin) + Math.abs(height * cos);
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount > 0) {
            // Use pooled span arrays (growth-only buffer pool)
            _ensureRRRotBuffers(spanCount);
            const fillMinX = _rrRotBufferPool.fillMinX;
            const fillMaxX = _rrRotBufferPool.fillMaxX;
            const strokeMinX = _rrRotBufferPool.strokeMinX;
            const strokeMaxX = _rrRotBufferPool.strokeMaxX;

            for (let i = 0; i < spanCount; i++) {
                fillMinX[i] = surfaceWidth;
                fillMaxX[i] = -1;
                strokeMinX[i] = surfaceWidth;
                strokeMaxX[i] = -1;
            }

            // PASS 1: Generate stroke perimeter for bounds only (no Set allocation)
            // Record both fill bounds and stroke bounds
            const recordFill = (x, y) => {
                if (y < yMin || y > yMax) return;
                const row = y - yMin;
                if (x < fillMinX[row]) fillMinX[row] = x;
                if (x > fillMaxX[row]) fillMaxX[row] = x;
            };

            const recordStrokeBounds = (x, y) => {
                if (x < 0 || x >= surfaceWidth || y < 0 || y >= surfaceHeight) return;
                if (y < yMin || y > yMax) return;
                const row = y - yMin;
                if (x < strokeMinX[row]) strokeMinX[row] = x;
                if (x > strokeMaxX[row]) strokeMaxX[row] = x;
            };

            // Generate fill bounds using perimeter-based approach
            RoundedRectOpsRot._generatePerimeter(hw, hh, radius, recordFill, centerX, centerY, cos, sin, rotation);

            // Generate stroke bounds (PASS 1 of double-generation)
            for (const edge of edges) {
                const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
                const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);
                const dx = end.x - start.x,
                    dy = end.y - start.y;
                if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;
                RoundedRectOpsRot._generateEdgePixels(start.x, start.y, end.x, end.y, recordStrokeBounds);
            }
            for (const corner of corners) {
                const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
                RoundedRectOpsRot._generateArcPixels(
                    screenCenter.x,
                    screenCenter.y,
                    radius,
                    corner.startAngle + rotation,
                    corner.endAngle + rotation,
                    recordStrokeBounds
                );
            }

            // Clamp fill to stroke bounds to prevent overspill
            for (let row = 0; row < spanCount; row++) {
                if (strokeMaxX[row] >= 0) {
                    if (fillMaxX[row] > strokeMaxX[row]) fillMaxX[row] = strokeMaxX[row];
                    if (fillMinX[row] < strokeMinX[row]) fillMinX[row] = strokeMinX[row];
                }
            }

            // Determine fill rendering mode
            const fillIsOpaque = fillColor.a === 255 && globalAlpha >= 1.0;
            const fillEffectiveAlpha = (fillColor.a / 255) * globalAlpha;
            const fillInvAlpha = 1 - fillEffectiveAlpha;
            const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;

            // Render fill scanlines via SpanOps (fill clamped to stroke bounds to prevent overspill)
            for (let row = 0; row < spanCount; row++) {
                const y = yMin + row;
                const fillLeft = fillMinX[row];
                const fillRight = fillMaxX[row];

                if (fillLeft > fillRight) continue;

                const x0 = Math.max(0, fillLeft);
                const x1 = Math.min(surfaceWidth - 1, fillRight);

                if (x0 <= x1) {
                    const spanLength = x1 - x0 + 1;
                    if (fillIsOpaque) {
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            x0,
                            y,
                            spanLength,
                            fillPacked,
                            clipBuffer
                        );
                    } else {
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            x0,
                            y,
                            spanLength,
                            fillColor.r,
                            fillColor.g,
                            fillColor.b,
                            fillEffectiveAlpha,
                            fillInvAlpha,
                            clipBuffer
                        );
                    }
                }
            }
        }

        // PASS 2: Render stroke on top (inline iteration, no closure/callback overhead)
        const strokeIsOpaque = strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = (strokeColor.a / 255) * globalAlpha;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Extract RGB for inline markers (required by BLEND_ALPHA_CLIPPED)
        const r = strokeColor.r,
            g = strokeColor.g,
            b = strokeColor.b;

        // For opaque strokes, direct rendering is safe (duplicates just overwrite same value)
        // For semi-transparent strokes, use lastPos tracking to prevent overdraw
        let lastPos = -1;

        // Render edges via inline Bresenham (no callback)
        for (const edge of edges) {
            const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
            const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);
            const dx = end.x - start.x,
                dy = end.y - start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;

            const x1i = Math.floor(start.x),
                y1i = Math.floor(start.y);
            const x2i = Math.floor(end.x),
                y2i = Math.floor(end.y);
            const dxAbs = Math.abs(x2i - x1i),
                dyAbs = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1,
                sy = y1i < y2i ? 1 : -1;
            let err = dxAbs - dyAbs;
            let x = x1i,
                y = y1i;

            while (true) {
                if (x >= 0 && x < surfaceWidth && y >= 0 && y < surfaceHeight) {
                    const pos = y * surfaceWidth + x;
                    if (strokeIsOpaque) {
                        if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = strokePacked;
}
                    } else {
                        if (pos !== lastPos) {
                            lastPos = pos;
                            if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * strokeInvAlpha;
const __outA = strokeEffectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * strokeEffectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * strokeEffectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * strokeEffectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
                        }
                    }
                }
                if (x === x2i && y === y2i) break;
                const e2 = 2 * err;
                if (e2 > -dyAbs) {
                    err -= dyAbs;
                    x += sx;
                }
                if (e2 < dxAbs) {
                    err += dxAbs;
                    y += sy;
                }
            }
        }

        // Render corners via inline arc iteration (matching _generateArcPixels parameters)
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            const cx = screenCenter.x,
                cy = screenCenter.y;
            const startAngle = corner.startAngle + rotation;
            const endAngle = corner.endAngle + rotation;

            const arcLength = radius * Math.abs(endAngle - startAngle);
            const numSteps = Math.max(Math.ceil(arcLength), 8);
            const angleStep = (endAngle - startAngle) / numSteps;

            // Use per-arc pixel deduplication (matching _generateArcPixels behavior)
            let lastPx = null,
                lastPy = null;

            for (let i = 0; i <= numSteps; i++) {
                const angle = startAngle + i * angleStep;
                const px = Math.floor(cx + radius * Math.cos(angle));
                const py = Math.floor(cy + radius * Math.sin(angle));

                // Skip consecutive duplicates within this arc
                if (px === lastPx && py === lastPy) continue;
                lastPx = px;
                lastPy = py;

                if (px >= 0 && px < surfaceWidth && py >= 0 && py < surfaceHeight) {
                    const pos = py * surfaceWidth + px;
                    if (strokeIsOpaque) {
                        if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = strokePacked;
}
                    } else {
                        if (pos !== lastPos) {
                            lastPos = pos;
                            if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * strokeInvAlpha;
const __outA = strokeEffectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * strokeEffectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * strokeEffectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * strokeEffectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
}
                        }
                    }
                }
            }
        }
    }

    /**
     * Internal: Unified fill+stroke rendering for rotated rounded rectangle.
     * Generates all three boundaries (fill, stroke outer, stroke inner) using
     * the same perimeter algorithm, then renders fill and stroke per scanline.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color
     * @param {Color} strokeColor - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _fillStroke_Rot_Unified(
        surface,
        centerX,
        centerY,
        width,
        height,
        radius,
        rotation,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const halfStroke = lineWidth / 2;

        // Stroke outer dimensions (path expanded by halfStroke)
        const outerHW = (width + lineWidth) / 2;
        const outerHH = (height + lineWidth) / 2;
        const outerRadius = Math.min(radius + halfStroke, Math.min(width + lineWidth, height + lineWidth) / 2);

        // Stroke inner dimensions
        const innerWidth = width - lineWidth;
        const innerHeight = height - lineWidth;
        const innerHW = innerWidth / 2;
        const innerHH = innerHeight / 2;
        const innerRadius = Math.max(0, radius - halfStroke);
        const hasInnerRect = innerWidth > 0 && innerHeight > 0;

        // Check if stroke is opaque - determines if we need fill perimeter
        const strokeIsOpaque = strokeColor.a === 255 && globalAlpha >= 1.0;

        // Compute AABB height based on outer bounds (largest boundary)
        const outerWidth = outerHW * 2;
        const outerHeight = outerHH * 2;
        const boundingHeight = Math.abs(outerWidth * sin) + Math.abs(outerHeight * cos);

        // Clamp to canvas bounds
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const outerMinX = _rrRotBufferPool.outerMinX;
        const outerMaxX = _rrRotBufferPool.outerMaxX;
        for (let i = 0; i < spanCount; i++) {
            outerMinX[i] = surfaceWidth;
            outerMaxX[i] = -1;
        }

        // Use pooled inner perimeter buffers (if inner rect exists)
        const innerMinX = hasInnerRect ? _rrRotBufferPool.innerMinX : null;
        const innerMaxX = hasInnerRect ? _rrRotBufferPool.innerMaxX : null;
        if (hasInnerRect) {
            for (let i = 0; i < spanCount; i++) {
                innerMinX[i] = surfaceWidth;
                innerMaxX[i] = -1;
            }
        }

        // For opaque strokes, reuse inner bounds for fill (stroke covers overlap region)
        // For semi-transparent strokes, need path boundary for correct 3-color overlap
        let fillMinX, fillMaxX;
        if (strokeIsOpaque) {
            // Opaque stroke: fill to inner boundary - stroke covers the rest
            fillMinX = hasInnerRect ? innerMinX : null;
            fillMaxX = hasInnerRect ? innerMaxX : null;
        } else {
            // Semi-transparent stroke: use pooled fill bounds at path boundary
            fillMinX = _rrRotBufferPool.fillMinX;
            fillMaxX = _rrRotBufferPool.fillMaxX;
            for (let i = 0; i < spanCount; i++) {
                fillMinX[i] = surfaceWidth;
                fillMaxX[i] = -1;
            }
        }

        // Create recorders for each perimeter
        const recordOuter = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < outerMinX[row]) outerMinX[row] = x;
            if (x > outerMaxX[row]) outerMaxX[row] = x;
        };

        const recordInner = hasInnerRect
            ? (x, y) => {
                  if (y < yMin || y > yMax) return;
                  const row = y - yMin;
                  if (x < innerMinX[row]) innerMinX[row] = x;
                  if (x > innerMaxX[row]) innerMaxX[row] = x;
              }
            : null;

        // Generate outer and inner perimeters
        RoundedRectOpsRot._generatePerimeter(
            outerHW,
            outerHH,
            outerRadius,
            recordOuter,
            centerX,
            centerY,
            cos,
            sin,
            rotation
        );
        if (hasInnerRect) {
            RoundedRectOpsRot._generatePerimeter(
                innerHW,
                innerHH,
                innerRadius,
                recordInner,
                centerX,
                centerY,
                cos,
                sin,
                rotation
            );
        }

        // Generate fill perimeter only for semi-transparent strokes
        // Fill uses path dimensions directly (no contraction needed).
        // Since lineWidth > 1 (this method only handles thick strokes), stroke outer
        // extends by at least 0.5px beyond path on each side. Using the same
        // _generatePerimeter algorithm for both guarantees fill stays inside
        // outer bounds without explicit clamping.
        if (!strokeIsOpaque) {
            const fillHW = width / 2;
            const fillHH = height / 2;
            const fillRadius = radius;
            const recordFill = (x, y) => {
                if (y < yMin || y > yMax) return;
                const row = y - yMin;
                if (x < fillMinX[row]) fillMinX[row] = x;
                if (x > fillMaxX[row]) fillMaxX[row] = x;
            };
            RoundedRectOpsRot._generatePerimeter(
                fillHW,
                fillHH,
                fillRadius,
                recordFill,
                centerX,
                centerY,
                cos,
                sin,
                rotation
            );
        }

        // Determine rendering modes
        const fillIsOpaque = fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = (fillColor.a / 255) * globalAlpha;
        const fillInvAlpha = 1 - fillEffectiveAlpha;
        const strokeEffectiveAlpha = (strokeColor.a / 255) * globalAlpha;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Render each scanline
        for (let row = 0; row < spanCount; row++) {
            const y = yMin + row;

            // Get outer stroke extent
            const outerLeft = outerMinX[row];
            const outerRight = outerMaxX[row];
            if (outerLeft > outerRight) continue; // No pixels on this row

            // Get inner stroke extent
            const innerLeft = hasInnerRect ? innerMinX[row] : surfaceWidth;
            const innerRight = hasInnerRect ? innerMaxX[row] : -1;
            const hasInnerRegion = innerLeft <= innerRight;

            // Get fill extent
            // For opaque stroke with no inner rect, fillMinX/fillMaxX are null (stroke covers everything)
            const fillLeft = fillMinX ? fillMinX[row] : surfaceWidth;
            const fillRight = fillMaxX ? fillMaxX[row] : -1;

            // STEP 1: Render fill first via SpanOps
            if (fillLeft <= fillRight) {
                const x0 = Math.max(0, fillLeft);
                const x1 = Math.min(surfaceWidth - 1, fillRight);

                if (x0 <= x1) {
                    const spanLength = x1 - x0 + 1;
                    if (fillIsOpaque) {
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            x0,
                            y,
                            spanLength,
                            fillPacked,
                            clipBuffer
                        );
                    } else {
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            x0,
                            y,
                            spanLength,
                            fillColor.r,
                            fillColor.g,
                            fillColor.b,
                            fillEffectiveAlpha,
                            fillInvAlpha,
                            clipBuffer
                        );
                    }
                }
            }

            // STEP 2: Render stroke on top (outer minus inner) via SpanOps
            const renderStrokeSegment = (startX, endX) => {
                if (startX > endX) return;
                const x0 = Math.max(0, startX);
                const x1 = Math.min(surfaceWidth - 1, endX);
                if (x0 > x1) return;
                const spanLength = x1 - x0 + 1;

                if (strokeIsOpaque) {
                    SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, y, spanLength, strokePacked, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(
                        data,
                        surfaceWidth,
                        surfaceHeight,
                        x0,
                        y,
                        spanLength,
                        strokeColor.r,
                        strokeColor.g,
                        strokeColor.b,
                        strokeEffectiveAlpha,
                        strokeInvAlpha,
                        clipBuffer
                    );
                }
            };

            if (hasInnerRegion) {
                // Has inner hole: render left and right stroke segments
                renderStrokeSegment(outerLeft, innerLeft - 1); // Left segment
                renderStrokeSegment(innerRight + 1, outerRight); // Right segment
            } else {
                // No inner region: fill entire stroke span
                renderStrokeSegment(outerLeft, outerRight);
            }
        }
    }
}

/**
 * RoundedRectOpsAA - Static methods for optimized AXIS-ALIGNED rounded rectangle rendering
 * Follows the PolygonFiller/RectOpsAA/CircleOps/LineOps pattern.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillRoundRect(), strokeRoundRect(), fillStrokeRoundRect()
 *
 * Path-based rounded rectangles (beginPath() + roundRect() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * NOTE: Rotated rounded rectangle rendering is handled by RoundedRectOpsRot (called
 * directly by Context2D). This class only handles axis-aligned (AA) rounded rectangles.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Primitives - call SpanOps, fallback to RectOpsAA for radius=0):
 *   fill_AA_Opaq, fill_AA_Alpha          → SpanOps.fill_Opaq/fill_Alpha
 *   stroke1px_AA_Opaq                    → Direct pixel writes
 *   stroke1px_AA_Alpha                   → Inline BLEND_ALPHA marker
 *   strokeThick_AA_Opaq, strokeThick_AA_Alpha → SpanOps.fill_Opaq/fill_Alpha
 *
 * Layer 2 (Composites):
 *   fillStroke_AA_Any  → SpanOps.fill_Opaq/fill_Alpha (via renderFillSpan/renderStrokeSpan helpers)
 *
 * NAMING PATTERN: {operation}[Thickness]_{orientation}_{opacity}
 *   - Orientation: AA (axis-aligned)
 *   - Opacity: Opaq | Alpha | Any
 */
class RoundedRectOpsAA {
    // =========================================================================
    // Private Static Helpers
    // =========================================================================

    /**
     * Calculate X extent for rounded corner at a given scanline Y.
     * @param {number} py - Scanline Y coordinate
     * @param {number} rectX - Rectangle left X
     * @param {number} rectW - Rectangle width
     * @param {number} rectY - Rectangle top Y
     * @param {number} rectH - Rectangle height
     * @param {number} radius - Corner radius
     * @param {number} [epsilon=0] - Epsilon for inset calculation
     * @returns {{leftX: number, rightX: number}} X extent or {-1, -1} if outside
     * @private
     */
    static _getXExtent(py, rectX, rectW, rectY, rectH, radius, epsilon = 0) {
        if (py < rectY || py >= rectY + rectH) {
            return { leftX: -1, rightX: -1 };
        }
        if (radius <= 0) {
            return { leftX: rectX, rightX: rectX + rectW - 1 };
        }
        let leftX = rectX,
            rightX = rectX + rectW - 1;
        if (py < rectY + radius) {
            const dy = rectY + radius - py - 0.5;
            const dySquared = dy * dy,
                radiusSquared = radius * radius;
            if (dySquared < radiusSquared) {
                const dx = Math.sqrt(radiusSquared - dySquared);
                leftX = Math.ceil(rectX + radius - dx + epsilon);
                rightX = Math.floor(rectX + rectW - radius + dx - 1 - epsilon);
            } else {
                return { leftX: -1, rightX: -1 };
            }
        } else if (py >= rectY + rectH - radius) {
            const dy = py - (rectY + rectH - radius) + 0.5;
            const dySquared = dy * dy,
                radiusSquared = radius * radius;
            if (dySquared < radiusSquared) {
                const dx = Math.sqrt(radiusSquared - dySquared);
                leftX = Math.ceil(rectX + radius - dx + epsilon);
                rightX = Math.floor(rectX + rectW - radius + dx - 1 - epsilon);
            } else {
                return { leftX: -1, rightX: -1 };
            }
        }
        return { leftX, rightX };
    }

    // =========================================================================
    // Axis-Aligned Public Static Methods
    // =========================================================================

    /**
     * Direct rendering for 1px opaque stroke on axis-aligned rounded rectangle.
     * Uses direct pixel setting for corners via angle iteration and
     * horizontal/vertical line drawing for straight edges.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static stroke1px_AA_Opaq(surface, x, y, width, height, radii, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsAA.stroke1px_AA_Opaq(surface, x, y, width, height, color);
            return;
        }

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // For 1px stroke, calculate the stroke geometry
        // The stroke is centered on the path, so for integer coordinates
        // we need to handle both grid-centered and pixel-centered cases
        const posX = x;
        const posY = y;
        const posW = width;
        const posH = height;

        // Draw horizontal edges (top and bottom, excluding corners)
        const topY = Math.floor(posY);
        const bottomY = Math.floor(posY + posH - 0.5);

        // Top edge
        if (topY >= 0 && topY < surfaceHeight) {
            for (let xx = Math.floor(posX + radius); xx < posX + posW - radius; xx++) {
                if (xx >= 0 && xx < surfaceWidth) {
                    const pos = topY * surfaceWidth + xx;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
            }
        }
        // Bottom edge
        if (bottomY >= 0 && bottomY < surfaceHeight) {
            for (let xx = Math.floor(posX + radius); xx < posX + posW - radius; xx++) {
                if (xx >= 0 && xx < surfaceWidth) {
                    const pos = bottomY * surfaceWidth + xx;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
            }
        }

        // Draw vertical edges (left and right, excluding corners)
        const leftX = Math.floor(posX);
        const rightX = Math.floor(posX + posW - 0.5);

        // Left edge
        if (leftX >= 0 && leftX < surfaceWidth) {
            for (let yy = Math.floor(posY + radius); yy < posY + posH - radius; yy++) {
                if (yy >= 0 && yy < surfaceHeight) {
                    const pos = yy * surfaceWidth + leftX;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
            }
        }
        // Right edge
        if (rightX >= 0 && rightX < surfaceWidth) {
            for (let yy = Math.floor(posY + radius); yy < posY + posH - radius; yy++) {
                if (yy >= 0 && yy < surfaceHeight) {
                    const pos = yy * surfaceWidth + rightX;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
            }
        }

        // Draw corner arcs using angle iteration (Bresenham-style)
        // For a 1px stroke, we draw at radius - 0.5 to get proper pixel placement
        const drawCorner = (cx, cy, startAngle, endAngle) => {
            const sr = radius - 0.5;
            // Use 1 degree steps for smooth corners
            const angleStep = DEG_TO_RAD;
            for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
                const px = Math.floor(cx + sr * Math.cos(angle));
                const py = Math.floor(cy + sr * Math.sin(angle));
                if (px >= 0 && px < surfaceWidth && py >= 0 && py < surfaceHeight) {
                    const pos = py * surfaceWidth + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
    data32[pos] = packedColor;
}
                }
            }
        };

        // Top-left corner (180° to 270°)
        drawCorner(posX + radius, posY + radius, Math.PI, THREE_HALF_PI);
        // Top-right corner (270° to 360°)
        drawCorner(posX + posW - radius, posY + radius, THREE_HALF_PI, TAU);
        // Bottom-right corner (0° to 90°)
        drawCorner(posX + posW - radius, posY + posH - radius, 0, HALF_PI);
        // Bottom-left corner (90° to 180°)
        drawCorner(posX + radius, posY + posH - radius, HALF_PI, Math.PI);
    }

    /**
     * Direct rendering for 1px semi-transparent stroke on axis-aligned rounded rectangle.
     * Uses Set-based deduplication to prevent overdraw at edge-arc junctions.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static stroke1px_AA_Alpha(surface, x, y, width, height, radii, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsAA.stroke1px_AA_Alpha(surface, x, y, width, height, color, globalAlpha);
            return;
        }

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        const posX = x;
        const posY = y;
        const posW = width;
        const posH = height;

        // Edge shortening strategy: shorten edges by 1 pixel at each end to avoid
        // junction overlap with corners. Corners naturally cover junction pixels.
        // This eliminates the need for a Set to prevent overdraw at junctions.

        // Helper to blend a pixel directly
        const blendPixel = (px, py) => {
            if (px < 0 || px >= surfaceWidth || py < 0 || py >= surfaceHeight) return;
            const pixelIndex = py * surfaceWidth + px;
            if (clipBuffer) {
                const byteIndex = pixelIndex >> 3;
                const bitIndex = pixelIndex & 7;
                if (!(clipBuffer[byteIndex] & (1 << bitIndex))) return;
            }
            const __off = pixelIndex * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
        };

        // Draw horizontal edges (shortened by 1 pixel at each end to avoid junction overlap)
        const topY = Math.floor(posY);
        const bottomY = Math.floor(posY + posH - 0.5);
        const horzStart = Math.floor(posX + radius) + 1; // Skip left junction pixel
        const horzEnd = Math.floor(posX + posW - radius); // Stop before right junction pixel

        for (let xx = horzStart; xx < horzEnd; xx++) {
            blendPixel(xx, topY);
            blendPixel(xx, bottomY);
        }

        // Draw vertical edges (shortened by 1 pixel at each end to avoid junction overlap)
        const leftX = Math.floor(posX);
        const rightX = Math.floor(posX + posW - 0.5);
        const vertStart = Math.floor(posY + radius) + 1; // Skip top junction pixel
        const vertEnd = Math.floor(posY + posH - radius); // Stop before bottom junction pixel

        for (let yy = vertStart; yy < vertEnd; yy++) {
            blendPixel(leftX, yy);
            blendPixel(rightX, yy);
        }

        // Draw corner arcs with consecutive-duplicate tracking
        // Angle iteration can map multiple angles to the same pixel for small radii.
        // Since duplicates are always consecutive, tracking lastPos is sufficient.
        const drawCorner = (cx, cy, startAngle, endAngle) => {
            const sr = radius - 0.5;
            const angleStep = DEG_TO_RAD;
            let lastPos = -1;
            for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
                const px = Math.floor(cx + sr * Math.cos(angle));
                const py = Math.floor(cy + sr * Math.sin(angle));
                if (px < 0 || px >= surfaceWidth || py < 0 || py >= surfaceHeight) continue;
                const pos = py * surfaceWidth + px;
                if (pos === lastPos) continue; // Skip consecutive duplicate
                lastPos = pos;
                if (clipBuffer) {
                    const byteIndex = pos >> 3;
                    const bitIndex = pos & 7;
                    if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                }
                const __off = pos * 4;
const __dstA = data[__off + 3] / 255;
const __dstAScaled = __dstA * invAlpha;
const __outA = effectiveAlpha + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    data[__off]     = (r * effectiveAlpha + data[__off] * __dstAScaled) * __blend;
    data[__off + 1] = (g * effectiveAlpha + data[__off + 1] * __dstAScaled) * __blend;
    data[__off + 2] = (b * effectiveAlpha + data[__off + 2] * __dstAScaled) * __blend;
    data[__off + 3] = __outA * 255;
}
            }
        };

        // Top-left corner (180° to 270°)
        drawCorner(posX + radius, posY + radius, Math.PI, THREE_HALF_PI);
        // Top-right corner (270° to 360°)
        drawCorner(posX + posW - radius, posY + radius, THREE_HALF_PI, TAU);
        // Bottom-right corner (0° to 90°)
        drawCorner(posX + posW - radius, posY + posH - radius, 0, HALF_PI);
        // Bottom-left corner (90° to 180°)
        drawCorner(posX + radius, posY + posH - radius, HALF_PI, Math.PI);
    }

    /**
     * Direct rendering for opaque fill on axis-aligned rounded rectangle.
     * Uses scanline algorithm with 32-bit packed writes.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {Color} color - Fill color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static fill_AA_Opaq(surface, x, y, width, height, radii, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius
        if (radius <= 0) {
            RectOpsAA.fill_AA_Opaq(surface, x, y, width, height, color);
            return;
        }

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Calculate integer bounds
        const rectX = Math.floor(x);
        const rectY = Math.floor(y);
        const rectW = Math.floor(width);
        const rectH = Math.floor(height);

        // For each scanline
        for (let py = rectY; py < rectY + rectH; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            let leftX = rectX;
            let rightX = rectX + rectW - 1;

            // Adjust for rounded corners
            if (py < rectY + radius) {
                // Top corners - calculate x extent based on circle equation
                const cornerCenterY = rectY + radius;
                const dy = cornerCenterY - py - 0.5;
                const dySquared = dy * dy;
                const radiusSquared = radius * radius;

                if (dySquared < radiusSquared) {
                    const dx = Math.sqrt(radiusSquared - dySquared);
                    leftX = Math.ceil(rectX + radius - dx);
                    rightX = Math.floor(rectX + rectW - radius + dx - 1);
                } else {
                    continue; // Outside the rounded area
                }
            } else if (py >= rectY + rectH - radius) {
                // Bottom corners
                const cornerCenterY = rectY + rectH - radius;
                const dy = py - cornerCenterY + 0.5;
                const dySquared = dy * dy;
                const radiusSquared = radius * radius;

                if (dySquared < radiusSquared) {
                    const dx = Math.sqrt(radiusSquared - dySquared);
                    leftX = Math.ceil(rectX + radius - dx);
                    rightX = Math.floor(rectX + rectW - radius + dx - 1);
                } else {
                    continue; // Outside the rounded area
                }
            }

            // Clamp to surface bounds
            leftX = Math.max(0, leftX);
            rightX = Math.min(surfaceWidth - 1, rightX);

            if (leftX > rightX) continue;

            // Fill scanline
            const spanLength = rightX - leftX + 1;
            SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, leftX, py, spanLength, packedColor, clipBuffer);
        }
    }

    /**
     * Direct rendering for semi-transparent fill on axis-aligned rounded rectangle.
     * Uses scanline algorithm with alpha blending.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static fill_AA_Alpha(surface, x, y, width, height, radii, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius
        if (radius <= 0) {
            RectOpsAA.fill_AA_Alpha(surface, x, y, width, height, color, globalAlpha);
            return;
        }

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Calculate integer bounds
        const rectX = Math.floor(x);
        const rectY = Math.floor(y);
        const rectW = Math.floor(width);
        const rectH = Math.floor(height);

        // For each scanline
        for (let py = rectY; py < rectY + rectH; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            let leftX = rectX;
            let rightX = rectX + rectW - 1;

            // Adjust for rounded corners (same logic as fill_AA_Opaq)
            if (py < rectY + radius) {
                const cornerCenterY = rectY + radius;
                const dy = cornerCenterY - py - 0.5;
                const dySquared = dy * dy;
                const radiusSquared = radius * radius;

                if (dySquared < radiusSquared) {
                    const dx = Math.sqrt(radiusSquared - dySquared);
                    leftX = Math.ceil(rectX + radius - dx);
                    rightX = Math.floor(rectX + rectW - radius + dx - 1);
                } else {
                    continue;
                }
            } else if (py >= rectY + rectH - radius) {
                const cornerCenterY = rectY + rectH - radius;
                const dy = py - cornerCenterY + 0.5;
                const dySquared = dy * dy;
                const radiusSquared = radius * radius;

                if (dySquared < radiusSquared) {
                    const dx = Math.sqrt(radiusSquared - dySquared);
                    leftX = Math.ceil(rectX + radius - dx);
                    rightX = Math.floor(rectX + rectW - radius + dx - 1);
                } else {
                    continue;
                }
            }

            // Clamp to surface bounds
            leftX = Math.max(0, leftX);
            rightX = Math.min(surfaceWidth - 1, rightX);

            if (leftX > rightX) continue;

            // Fill scanline with alpha blending
            const spanLength = rightX - leftX + 1;
            SpanOps.fill_Alpha(
                data,
                surfaceWidth,
                surfaceHeight,
                leftX,
                py,
                spanLength,
                r,
                g,
                b,
                effectiveAlpha,
                invAlpha,
                clipBuffer
            );
        }
    }

    /**
     * Direct rendering for thick opaque stroke on axis-aligned rounded rectangle.
     * Uses scanline algorithm to fill the stroke region between inner and outer bounds.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static strokeThick_AA_Opaq(surface, x, y, width, height, radii, lineWidth, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsAA.strokeThick_AA_Opaq(surface, x, y, width, height, lineWidth, color, clipBuffer);
            return;
        }

        const halfStroke = lineWidth / 2;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Calculate outer and inner bounds
        const outerX = Math.floor(x - halfStroke);
        const outerY = Math.floor(y - halfStroke);
        const outerW = Math.ceil(width + lineWidth);
        const outerH = Math.ceil(height + lineWidth);
        const outerRadius = radius + halfStroke;

        const innerX = Math.floor(x + halfStroke);
        const innerY = Math.floor(y + halfStroke);
        const innerW = Math.floor(width - lineWidth);
        const innerH = Math.floor(height - lineWidth);
        const innerRadius = Math.max(0, radius - halfStroke);

        // For each scanline in the outer bounds
        for (let py = outerY; py < outerY + outerH; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            // Get outer extent
            const outer = RoundedRectOpsAA._getXExtent(py, outerX, outerW, outerY, outerH, outerRadius);
            if (outer.leftX < 0) continue; // Outside outer bounds

            // Clamp outer to surface
            const outerLeft = Math.max(0, outer.leftX);
            const outerRight = Math.min(surfaceWidth - 1, outer.rightX);
            if (outerLeft > outerRight) continue;

            // Check if we're in the inner region (hollow part)
            if (innerW > 0 && innerH > 0 && py >= innerY && py < innerY + innerH) {
                const inner = RoundedRectOpsAA._getXExtent(py, innerX, innerW, innerY, innerH, innerRadius);

                if (inner.leftX >= 0 && inner.rightX >= inner.leftX) {
                    // Draw left and right stroke spans around the inner region
                    const innerLeft = Math.max(0, inner.leftX);
                    const innerRight = Math.min(surfaceWidth - 1, inner.rightX);

                    // Left span: from outerLeft to just before innerLeft
                    if (outerLeft < innerLeft) {
                        const leftSpanLength = innerLeft - outerLeft;
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            outerLeft,
                            py,
                            leftSpanLength,
                            packedColor,
                            clipBuffer
                        );
                    }

                    // Right span: from just after innerRight to outerRight
                    if (innerRight < outerRight) {
                        const rightSpanStart = innerRight + 1;
                        const rightSpanLength = outerRight - innerRight;
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            rightSpanStart,
                            py,
                            rightSpanLength,
                            packedColor,
                            clipBuffer
                        );
                    }
                } else {
                    // Inner region invalid at this Y, fill entire outer span
                    const spanLength = outerRight - outerLeft + 1;
                    SpanOps.fill_Opaq(
                        data32,
                        surfaceWidth,
                        surfaceHeight,
                        outerLeft,
                        py,
                        spanLength,
                        packedColor,
                        clipBuffer
                    );
                }
            } else {
                // Not in inner region, fill entire outer span
                const spanLength = outerRight - outerLeft + 1;
                SpanOps.fill_Opaq(
                    data32,
                    surfaceWidth,
                    surfaceHeight,
                    outerLeft,
                    py,
                    spanLength,
                    packedColor,
                    clipBuffer
                );
            }
        }
    }

    /**
     * Direct rendering for thick semi-transparent stroke on axis-aligned rounded rectangle.
     * Uses scanline algorithm with alpha blending.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static strokeThick_AA_Alpha(surface, x, y, width, height, radii, lineWidth, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsAA.strokeThick_AA_Alpha(surface, x, y, width, height, lineWidth, color, globalAlpha, clipBuffer);
            return;
        }

        const halfStroke = lineWidth / 2;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Calculate outer and inner bounds
        const outerX = Math.floor(x - halfStroke);
        const outerY = Math.floor(y - halfStroke);
        const outerW = Math.ceil(width + lineWidth);
        const outerH = Math.ceil(height + lineWidth);
        const outerRadius = radius + halfStroke;

        const innerX = Math.floor(x + halfStroke);
        const innerY = Math.floor(y + halfStroke);
        const innerW = Math.floor(width - lineWidth);
        const innerH = Math.floor(height - lineWidth);
        const innerRadius = Math.max(0, radius - halfStroke);

        // For each scanline in the outer bounds
        for (let py = outerY; py < outerY + outerH; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            const outer = RoundedRectOpsAA._getXExtent(py, outerX, outerW, outerY, outerH, outerRadius);
            if (outer.leftX < 0) continue;

            const outerLeft = Math.max(0, outer.leftX);
            const outerRight = Math.min(surfaceWidth - 1, outer.rightX);
            if (outerLeft > outerRight) continue;

            if (innerW > 0 && innerH > 0 && py >= innerY && py < innerY + innerH) {
                const inner = RoundedRectOpsAA._getXExtent(py, innerX, innerW, innerY, innerH, innerRadius);

                if (inner.leftX >= 0 && inner.rightX >= inner.leftX) {
                    const innerLeft = Math.max(0, inner.leftX);
                    const innerRight = Math.min(surfaceWidth - 1, inner.rightX);

                    if (outerLeft < innerLeft) {
                        const leftSpanLength = innerLeft - outerLeft;
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            outerLeft,
                            py,
                            leftSpanLength,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }

                    if (innerRight < outerRight) {
                        const rightSpanStart = innerRight + 1;
                        const rightSpanLength = outerRight - innerRight;
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            rightSpanStart,
                            py,
                            rightSpanLength,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }
                } else {
                    const spanLength = outerRight - outerLeft + 1;
                    SpanOps.fill_Alpha(
                        data,
                        surfaceWidth,
                        surfaceHeight,
                        outerLeft,
                        py,
                        spanLength,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            } else {
                const spanLength = outerRight - outerLeft + 1;
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    outerLeft,
                    py,
                    spanLength,
                    r,
                    g,
                    b,
                    effectiveAlpha,
                    invAlpha,
                    clipBuffer
                );
            }
        }
    }

    /**
     * Unified fill and stroke rendering for rounded rectangles.
     * Draws both in a single coordinated pass to prevent fill/stroke gaps (speckles).
     * Fill is rendered first, then stroke is rendered on top.
     *
     * Fill extent strategy (per scanline):
     * - Thick semi-transparent stroke (lineWidth > 1): Fill to PATH extent so stroke
     *   can blend on top, creating proper 3-color overlap (background, fill, fill+stroke)
     * - 1px or opaque stroke: Fill to INNER extent (no meaningful overlap area for 1px;
     *   opaque stroke covers fill anyway)
     *
     * Key insight: All corner arcs (fill, outer stroke, inner stroke) must use the SAME
     * corner center point, just with different radii. This ensures pixel-perfect alignment.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {number} lineWidth - Stroke width
     * @param {Color|null} fillColor - Fill color (null to skip fill)
     * @param {Color|null} strokeColor - Stroke color (null to skip stroke)
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static fillStroke_AA_Any(
        surface,
        x,
        y,
        width,
        height,
        radii,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer = null
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to separate methods for zero radius
        if (radius <= 0) {
            if (hasFill) {
                if (fillColor.a === 255 && globalAlpha >= 1.0) {
                    RectOpsAA.fill_AA_Opaq(surface, x, y, width, height, fillColor);
                } else {
                    RectOpsAA.fill_AA_Alpha(surface, x, y, width, height, fillColor, globalAlpha);
                }
            }
            if (hasStroke) {
                if (strokeColor.a === 255 && globalAlpha >= 1.0) {
                    RectOpsAA.strokeThick_AA_Opaq(surface, x, y, width, height, lineWidth, strokeColor, clipBuffer);
                } else {
                    RectOpsAA.strokeThick_AA_Alpha(
                        surface,
                        x,
                        y,
                        width,
                        height,
                        lineWidth,
                        strokeColor,
                        globalAlpha,
                        clipBuffer
                    );
                }
            }
            return;
        }

        const halfStroke = lineWidth / 2;

        // Use PATH coordinates as reference for fill
        const pathX = Math.floor(x);
        const pathY = Math.floor(y);
        const pathW = Math.floor(width);
        const pathH = Math.floor(height);
        const pathRadius = radius;

        // Radii for different boundaries
        const outerRadius = pathRadius + halfStroke; // Stroke outer edge
        const innerRadius = Math.max(0, pathRadius - halfStroke); // Stroke inner edge

        // Calculate scan bounds - use original coordinates (not floored pathX/pathY)
        const scanMinY = Math.floor(y - halfStroke);
        const scanMaxY = Math.ceil(y + height + halfStroke);

        // Determine rendering modes
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;

        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Helper to render fill span via SpanOps
        const renderFillSpan = (startX, endX, py) => {
            if (startX > endX) return;
            const x0 = Math.max(0, startX);
            const x1 = Math.min(surfaceWidth - 1, endX);
            if (x0 > x1) return;
            const spanLength = x1 - x0 + 1;

            if (fillIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, py, spanLength, fillPacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    x0,
                    py,
                    spanLength,
                    fillColor.r,
                    fillColor.g,
                    fillColor.b,
                    fillEffectiveAlpha,
                    fillInvAlpha,
                    clipBuffer
                );
            }
        };

        // Helper to render stroke span via SpanOps
        const renderStrokeSpan = (startX, endX, py) => {
            if (startX > endX) return;
            const x0 = Math.max(0, startX);
            const x1 = Math.min(surfaceWidth - 1, endX);
            if (x0 > x1) return;
            const spanLength = x1 - x0 + 1;

            if (strokeIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, py, spanLength, strokePacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    x0,
                    py,
                    spanLength,
                    strokeColor.r,
                    strokeColor.g,
                    strokeColor.b,
                    strokeEffectiveAlpha,
                    strokeInvAlpha,
                    clipBuffer
                );
            }
        };

        // Calculate stroke bounds - use original coordinates (like strokeThick_AA_Opaq)
        // This avoids double-flooring which causes 1px shift when x/y have .5 fractional parts
        const outerRectX = Math.floor(x - halfStroke);
        const outerRectY = Math.floor(y - halfStroke);
        const outerRectW = Math.ceil(width + lineWidth);
        const outerRectH = Math.ceil(height + lineWidth);

        const innerRectX = Math.floor(x + halfStroke);
        const innerRectY = Math.floor(y + halfStroke);
        const innerRectW = Math.floor(width - lineWidth);
        const innerRectH = Math.floor(height - lineWidth);

        // Process each scanline in the scan bounds
        for (let py = scanMinY; py < scanMaxY; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            // Get outer stroke extent - uses calculated bounds from original coordinates
            const outerExtent = hasStroke
                ? RoundedRectOpsAA._getXExtent(py, outerRectX, outerRectW, outerRectY, outerRectH, outerRadius, 0)
                : { leftX: -1, rightX: -1 };

            // Get inner stroke extent - uses calculated bounds from original coordinates
            const innerExtent =
                hasStroke && innerRectH > 0
                    ? RoundedRectOpsAA._getXExtent(py, innerRectX, innerRectW, innerRectY, innerRectH, innerRadius, 0)
                    : { leftX: -1, rightX: -1 };

            // Determine fill extent based on stroke transparency
            let fillExtent = { leftX: -1, rightX: -1 };
            if (hasFill) {
                if (hasStroke) {
                    // Check if stroke is semi-transparent (needs overlap blending)
                    const strokeIsSemiTransparent = strokeEffectiveAlpha < 1.0;

                    if (strokeIsSemiTransparent && lineWidth > 1) {
                        // Thick semi-transparent stroke: fill to PATH extent
                        // Stroke will blend ON TOP of this fill for correct alpha overlap color
                        fillExtent = RoundedRectOpsAA._getXExtent(
                            py,
                            pathX,
                            pathW,
                            pathY,
                            pathH,
                            pathRadius,
                            FILL_EPSILON
                        );
                    } else {
                        // Opaque OR 1px semi-transparent: fill to inner extent
                        // (1px has no visible overlap area; opaque stroke covers fill anyway)
                        if (innerExtent.leftX >= 0 && innerExtent.rightX >= innerExtent.leftX) {
                            fillExtent.leftX = innerExtent.leftX;
                            fillExtent.rightX = innerExtent.rightX;
                        }
                    }
                } else {
                    // Fill-only: use standard fill extent calculation
                    fillExtent = RoundedRectOpsAA._getXExtent(py, pathX, pathW, pathY, pathH, pathRadius, FILL_EPSILON);
                }
            }

            // STEP 1: Render fill first (uses path extent or inner extent based on stroke type)
            if (hasFill && fillExtent.leftX >= 0 && fillExtent.leftX <= fillExtent.rightX) {
                renderFillSpan(fillExtent.leftX, fillExtent.rightX, py);
            }

            // STEP 2: Render stroke on top (covers any micro-gaps at boundary)
            if (hasStroke && outerExtent.leftX >= 0) {
                const outerLeft = Math.max(0, outerExtent.leftX);
                const outerRight = Math.min(surfaceWidth - 1, outerExtent.rightX);

                if (outerLeft <= outerRight) {
                    if (innerExtent.leftX >= 0 && innerExtent.rightX >= innerExtent.leftX) {
                        // Has inner region - draw left and right stroke segments
                        const innerLeft = Math.max(0, innerExtent.leftX);
                        const innerRight = Math.min(surfaceWidth - 1, innerExtent.rightX);

                        // Left stroke segment
                        if (outerLeft < innerLeft) {
                            renderStrokeSpan(outerLeft, innerLeft - 1, py);
                        }

                        // Right stroke segment
                        if (innerRight < outerRight) {
                            renderStrokeSpan(innerRight + 1, outerRight, py);
                        }
                    } else {
                        // No inner region - fill entire stroke span
                        renderStrokeSpan(outerLeft, outerRight, py);
                    }
                }
            }
        }
    }
}

/**
 * CompositeOperations utility class for SWCanvas
 *
 * Centralized implementation of HTML5 Canvas globalCompositeOperation modes.
 * Provides optimized blending functions for various composite operations.
 * Supports full Porter-Duff compositing operations and follows Canvas 2D API spec.
 *
 * Supported operations:
 * - source-over (default) - Source drawn on top of destination
 * - destination-over - Source drawn behind destination
 * - source-atop - Source drawn only where destination exists
 * - destination-atop - Destination visible only where source exists
 * - source-in - Source visible only where destination exists
 * - destination-in - Destination visible only where source exists
 * - source-out - Source visible only where destination doesn't exist
 * - destination-out - Destination erased where source exists
 * - xor - Both visible except in overlap areas
 * - copy - Source replaces destination completely
 *
 * The implementation uses a dual rendering approach:
 * - Source-bounded operations (source-over, destination-over, destination-out, xor, source-atop) process only source-covered pixels
 * - Canvas-wide operations (destination-atop, source-in, destination-in, source-out, copy)
 *   use source coverage masks and full-region compositing to correctly handle pixels outside the source area
 */
class CompositeOperations {
    /**
     * Blend two pixels using the specified composite operation
     * @param {string} operation - Composite operation mode
     * @param {number} srcR - Source red (0-255)
     * @param {number} srcG - Source green (0-255)
     * @param {number} srcB - Source blue (0-255)
     * @param {number} srcA - Source alpha (0-255)
     * @param {number} dstR - Destination red (0-255)
     * @param {number} dstG - Destination green (0-255)
     * @param {number} dstB - Destination blue (0-255)
     * @param {number} dstA - Destination alpha (0-255)
     * @returns {Object} Result with {r, g, b, a} properties (0-255)
     */
    static blendPixel(operation, srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA) {
        // Early exit for transparent source
        if (srcA === 0) {
            switch (operation) {
                case 'destination-out':
                    // Transparent source erases nothing
                    return { r: dstR, g: dstG, b: dstB, a: dstA };
                case 'destination-atop':
                    // destination-atop: destination appears only where source exists
                    // No source means destination doesn't appear
                    return { r: 0, g: 0, b: 0, a: 0 };
                case 'source-in':
                case 'destination-in':
                    // No source to blend with
                    return { r: 0, g: 0, b: 0, a: 0 };
                case 'source-out':
                    // source-out: source appears only where destination doesn't exist
                    // No source means result is transparent regardless of destination
                    return { r: 0, g: 0, b: 0, a: 0 };
                case 'copy':
                    // Copy always replaces destination, even with transparent source
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                default:
                    // Transparent source doesn't change destination
                    return { r: dstR, g: dstG, b: dstB, a: dstA };
            }
        }

        // Early exit for transparent destination
        if (dstA === 0) {
            switch (operation) {
                case 'source-over':
                case 'destination-over':
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                case 'source-atop':
                case 'destination-out':
                case 'source-in':
                case 'destination-in':
                    // No destination to blend with
                    return { r: 0, g: 0, b: 0, a: 0 };
                case 'destination-atop':
                    // destination-atop: destination appears only where source exists
                    // No destination to show, so show source
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                case 'source-out':
                case 'xor':
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                case 'copy':
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                default:
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
            }
        }

        // Convert to normalized alpha values (0-1)
        const srcAlpha = srcA / 255;
        const dstAlpha = dstA / 255;

        let resultR, resultG, resultB, resultA;

        switch (operation) {
            case 'source-over':
                return CompositeOperations._sourceOver(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA);

            case 'destination-over':
                // Swap source and destination for destination-over
                return CompositeOperations._sourceOver(dstR, dstG, dstB, dstA, srcR, srcG, srcB, srcA);

            case 'source-atop':
                // Source appears only where destination exists
                // αo = αb, Co = αs × Cs + (1 - αs) × Cb
                // NOTE: This operation works correctly with the current architecture
                resultA = dstA; // Destination alpha
                if (dstA === 0) {
                    // No destination, source doesn't appear
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = Math.round(srcAlpha * srcR + (1 - srcAlpha) * dstR);
                resultG = Math.round(srcAlpha * srcG + (1 - srcAlpha) * dstG);
                resultB = Math.round(srcAlpha * srcB + (1 - srcAlpha) * dstB);
                break;

            case 'destination-atop':
                // Destination appears only where source exists
                // αo = αs, Co = αb × Cb + (1 - αb) × Cs
                resultA = srcA; // Source alpha
                if (srcA === 0) {
                    // No source, destination doesn't appear
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = Math.round(dstAlpha * dstR + (1 - dstAlpha) * srcR);
                resultG = Math.round(dstAlpha * dstG + (1 - dstAlpha) * srcG);
                resultB = Math.round(dstAlpha * dstB + (1 - dstAlpha) * srcB);
                break;

            case 'source-in':
                // Source visible only where destination exists
                // αo = αs × αb, Co = Cs
                resultA = Math.round(srcA * dstAlpha);
                if (resultA === 0) {
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = srcR;
                resultG = srcG;
                resultB = srcB;
                break;

            case 'destination-in':
                // Destination visible only where source exists
                // αo = αb × αs, Co = Cb
                resultA = Math.round(dstA * srcAlpha);
                if (resultA === 0) {
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = dstR;
                resultG = dstG;
                resultB = dstB;
                break;

            case 'source-out':
                // Source visible only where destination doesn't exist
                // αo = αs × (1 - αb), Co = Cs
                resultA = Math.round(srcA * (1 - dstAlpha));
                if (resultA === 0) {
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = srcR;
                resultG = srcG;
                resultB = srcB;
                break;

            case 'destination-out':
                // dst * (1 - srcAlpha)
                resultA = Math.round(dstA * (1 - srcAlpha));
                if (resultA === 0) {
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = dstR;
                resultG = dstG;
                resultB = dstB;
                break;

            case 'xor':
                // HTML5 Canvas XOR behavior:
                // - Source over transparent background: show source
                // - Transparent over destination: show destination
                // - Source over opaque destination: transparent (both disappear)

                if (srcAlpha === 0 && dstAlpha === 0) {
                    // Both transparent
                    return { r: 0, g: 0, b: 0, a: 0 };
                } else if (srcAlpha === 0) {
                    // No source - show destination unchanged
                    return { r: dstR, g: dstG, b: dstB, a: dstA };
                } else if (dstAlpha === 0) {
                    // Source over transparent background - show source
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                } else {
                    // Source over opaque destination - both disappear (XOR effect)
                    return { r: 0, g: 0, b: 0, a: 0 };
                }

            case 'copy':
                // Replace destination completely with source
                // αo = αs, Co = Cs
                return { r: srcR, g: srcG, b: srcB, a: srcA };

            default:
                // Default to source-over for unknown operations
                return CompositeOperations._sourceOver(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA);
        }

        // Clamp results to valid range
        return {
            r: Math.max(0, Math.min(255, Math.round(resultR))),
            g: Math.max(0, Math.min(255, Math.round(resultG))),
            b: Math.max(0, Math.min(255, Math.round(resultB))),
            a: Math.max(0, Math.min(255, Math.round(resultA)))
        };
    }

    /**
     * Optimized source-over implementation
     * @private
     */
    static _sourceOver(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA) {
        // Optimization for opaque source
        if (srcA === 255) {
            return { r: srcR, g: srcG, b: srcB, a: srcA };
        }

        // Standard source-over blending
        const srcAlpha = srcA / 255;
        const invSrcAlpha = 1 - srcAlpha;

        return {
            r: Math.round(srcR * srcAlpha + dstR * invSrcAlpha),
            g: Math.round(srcG * srcAlpha + dstG * invSrcAlpha),
            b: Math.round(srcB * srcAlpha + dstB * invSrcAlpha),
            a: Math.round(srcA + dstA * invSrcAlpha)
        };
    }

    /**
     * Get list of supported composite operations
     * @returns {string[]} Array of supported operation names
     */
    static getSupportedOperations() {
        return [
            'source-over',
            'destination-over',
            'source-atop',
            'destination-atop',
            'source-in',
            'destination-in',
            'source-out',
            'destination-out',
            'xor',
            'copy'
        ];
    }

    /**
     * Check if a composite operation is supported
     * @param {string} operation - Operation name to check
     * @returns {boolean} True if operation is supported
     */
    static isSupported(operation) {
        return CompositeOperations.getSupportedOperations().includes(operation);
    }
}

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

/**
 * BitmapEncoder class for SWCanvas
 *
 * Handles encoding of Surface data to BMP (Windows Bitmap) format.
 * Provides static methods for encoding with proper premultiplied alpha handling
 * and BMP format compliance.
 *
 * Class-based design following OO best practices:
 * - Static methods for stateless encoding operations
 * - Clear separation of header generation and pixel processing
 * - Proper error handling and validation
 */
class BitmapEncoder {
    /**
     * Encode a surface to BMP format
     * @param {Surface} surface - Surface to encode
     * @param {BitmapEncodingOptions} [options=BitmapEncodingOptions.DEFAULT] - Encoding options
     * @returns {ArrayBuffer} BMP file data
     */
    static encode(surface, options = BitmapEncodingOptions.DEFAULT) {
        if (!surface || typeof surface !== 'object') {
            throw new Error('Surface must be a valid Surface object');
        }

        if (!surface.width || !surface.height || !surface.data) {
            throw new Error('Surface must have width, height, and data properties');
        }

        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        // Validate surface data
        const expectedSize = width * height * 4;
        if (data.length !== expectedSize) {
            throw new Error(`Surface data size mismatch. Expected ${expectedSize}, got ${data.length}`);
        }

        // Calculate BMP dimensions and sizes
        const dimensions = BitmapEncoder._calculateDimensions(width, height);

        // Create output buffer
        const buffer = new ArrayBuffer(dimensions.fileSize);
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);

        // Write BMP headers
        BitmapEncoder._writeBMPHeaders(view, dimensions);

        // Convert and write pixel data
        BitmapEncoder._writePixelData(bytes, data, surface, dimensions, options);

        return buffer;
    }

    /**
     * Calculate BMP dimensions and file size
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Object} Dimension information
     * @private
     */
    static _calculateDimensions(width, height) {
        // BMP row padding (each row must be aligned to 4-byte boundary)
        const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
        const imageSize = rowSize * height;
        const fileSize = BitmapEncoder.BMP_HEADER_SIZE + imageSize;

        return {
            width,
            height,
            rowSize,
            imageSize,
            fileSize
        };
    }

    /**
     * Write BMP file header and info header
     * @param {DataView} view - DataView for writing binary data
     * @param {Object} dimensions - Dimension information
     * @private
     */
    static _writeBMPHeaders(view, dimensions) {
        // BMP File Header (14 bytes)
        BitmapEncoder._writeBMPFileHeader(view, dimensions.fileSize);

        // BMP Info Header (40 bytes)
        BitmapEncoder._writeBMPInfoHeader(view, dimensions);
    }

    /**
     * Write BMP file header
     * @param {DataView} view - DataView for writing
     * @param {number} fileSize - Total file size
     * @private
     */
    static _writeBMPFileHeader(view, fileSize) {
        const bytes = new Uint8Array(view.buffer);

        // BMP signature "BM"
        bytes[0] = 0x42; // 'B'
        bytes[1] = 0x4d; // 'M'

        // File size
        view.setUint32(2, fileSize, true);

        // Reserved fields (must be 0)
        view.setUint32(6, 0, true);

        // Offset to pixel data
        view.setUint32(10, BitmapEncoder.BMP_HEADER_SIZE, true);
    }

    /**
     * Write BMP info header (BITMAPINFOHEADER)
     * @param {DataView} view - DataView for writing
     * @param {Object} dimensions - Dimension information
     * @private
     */
    static _writeBMPInfoHeader(view, dimensions) {
        const offset = 14; // After file header

        // Header size (40 bytes for BITMAPINFOHEADER)
        view.setUint32(offset + 0, 40, true);

        // Width and height
        view.setInt32(offset + 4, dimensions.width, true);
        view.setInt32(offset + 8, -dimensions.height, true); // Negative for top-down

        // Color planes (must be 1)
        view.setUint16(offset + 12, 1, true);

        // Bits per pixel (24-bit RGB)
        view.setUint16(offset + 14, 24, true);

        // Compression method (0 = uncompressed)
        view.setUint32(offset + 16, 0, true);

        // Image size
        view.setUint32(offset + 20, dimensions.imageSize, true);

        // Pixels per meter (approximately 72 DPI)
        const ppm = 2835; // 72 DPI * 39.3701 inches/meter
        view.setInt32(offset + 24, ppm, true); // X resolution
        view.setInt32(offset + 28, ppm, true); // Y resolution

        // Colors in palette (0 for true color)
        view.setUint32(offset + 32, 0, true);

        // Important colors (0 = all colors are important)
        view.setUint32(offset + 36, 0, true);
    }

    /**
     * Convert RGBA surface data to BMP pixel format and write to buffer
     * @param {Uint8Array} bytes - Byte array for writing
     * @param {Uint8ClampedArray} data - Surface RGBA data (non-premultiplied)
     * @param {Surface} surface - Original surface for stride info
     * @param {Object} dimensions - Dimension information
     * @param {BitmapEncodingOptions} options - Encoding options
     * @private
     */
    static _writePixelData(bytes, data, surface, dimensions, options) {
        let pixelOffset = BitmapEncoder.BMP_HEADER_SIZE;

        for (let y = 0; y < dimensions.height; y++) {
            let rowOffset = pixelOffset;

            for (let x = 0; x < dimensions.width; x++) {
                const srcOffset = y * surface.stride + x * 4;

                // Get RGBA values from surface (non-premultiplied)
                const r = data[srcOffset];
                const g = data[srcOffset + 1];
                const b = data[srcOffset + 2];
                const a = data[srcOffset + 3];

                // Composite with background color for BMP output (which doesn't support alpha)
                const rgb = BitmapEncoder._unpremultiplyAlpha(r, g, b, a, options.backgroundColor);

                // BMP stores pixels as BGR (not RGB)
                bytes[rowOffset] = rgb.b;
                bytes[rowOffset + 1] = rgb.g;
                bytes[rowOffset + 2] = rgb.r;
                rowOffset += 3;
            }

            // Apply row padding to align to 4-byte boundary
            while (rowOffset - pixelOffset < dimensions.rowSize) {
                bytes[rowOffset] = 0;
                rowOffset++;
            }

            pixelOffset += dimensions.rowSize;
        }
    }

    /**
     * Convert premultiplied RGBA to non-premultiplied RGB
     * @param {number} r - Red component (0-255, premultiplied)
     * @param {number} g - Green component (0-255, premultiplied)
     * @param {number} b - Blue component (0-255, premultiplied)
     * @param {number} a - Alpha component (0-255)
     * @param {Object} backgroundColor - Background color for transparent pixels {r, g, b}
     * @returns {Object} {r, g, b} non-premultiplied RGB values
     * @private
     */
    static _unpremultiplyAlpha(r, g, b, a, backgroundColor = { r: 255, g: 255, b: 255 }) {
        if (a === 0) {
            // Fully transparent - composite with configured background for BMP
            return { r: backgroundColor.r, g: backgroundColor.g, b: backgroundColor.b };
        }

        if (a === 255) {
            // Fully opaque - no unpremultiplication needed
            return { r: r, g: g, b: b };
        }

        // For semi-transparent pixels in BMP, composite with configured background
        // Surface data is non-premultiplied, so use standard alpha compositing
        const alpha = a / 255;
        return {
            r: Math.round(r * alpha + backgroundColor.r * (1 - alpha)),
            g: Math.round(g * alpha + backgroundColor.g * (1 - alpha)),
            b: Math.round(b * alpha + backgroundColor.b * (1 - alpha))
        };
    }

    /**
     * Get BMP file information without encoding (for debugging/info)
     * @param {Surface} surface - Surface to analyze
     * @returns {Object} BMP file information
     */
    static getBMPInfo(surface) {
        if (!surface || !surface.width || !surface.height) {
            throw new Error('Invalid surface');
        }

        const dimensions = BitmapEncoder._calculateDimensions(surface.width, surface.height);

        return {
            width: dimensions.width,
            height: dimensions.height,
            bitsPerPixel: 24,
            compression: 'None',
            rowSize: dimensions.rowSize,
            imageSize: dimensions.imageSize,
            fileSize: dimensions.fileSize,
            headerSize: BitmapEncoder.BMP_HEADER_SIZE
        };
    }

    /**
     * Validate that a surface can be encoded to BMP
     * @param {Surface} surface - Surface to validate
     * @returns {boolean} True if surface can be encoded
     */
    static canEncode(surface) {
        try {
            if (!surface || typeof surface !== 'object') return false;
            if (!surface.width || !surface.height || !surface.data) return false;
            if (surface.width <= 0 || surface.height <= 0) return false;
            if (surface.width > BitmapEncoder.MAX_DIMENSION || surface.height > BitmapEncoder.MAX_DIMENSION)
                return false;

            const expectedSize = surface.width * surface.height * 4;
            return surface.data.length === expectedSize;
        } catch (error) {
            return false;
        }
    }

    /**
     * Calculate memory usage for BMP encoding
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {number} Memory usage in bytes
     */
    static calculateMemoryUsage(width, height) {
        if (width <= 0 || height <= 0) return 0;

        const dimensions = BitmapEncoder._calculateDimensions(width, height);
        return dimensions.fileSize;
    }
}

// Class constants
BitmapEncoder.BMP_HEADER_SIZE = 54; // 14 bytes file header + 40 bytes info header
BitmapEncoder.MAX_DIMENSION = 65535; // Reasonable maximum to prevent memory issues

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
     * @param {number} config.compressionLevel - Future placeholder for compression (0 = none, currently unused)
     */
    constructor(config = {}) {
        // Set defaults
        const {
            preserveTransparency = true,
            compressionLevel = 0 // 0 = no compression (stored blocks)
        } = config;

        // Validate parameters
        if (typeof preserveTransparency !== 'boolean') {
            throw new Error('preserveTransparency must be a boolean');
        }

        Validators.range(compressionLevel, 'compressionLevel', 0, 9);

        // Currently only support compression level 0 (stored blocks)
        if (compressionLevel !== 0) {
            throw new Error('Only compression level 0 (no compression) is currently supported');
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
     * @returns {number} Compression level (0-9, currently only 0 supported)
     */
    get compressionLevel() {
        return this._config.compressionLevel;
    }

    /**
     * Create default options (transparency preserved, no compression)
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
     * Create options with specific compression level (future extensibility)
     * @param {number} level - Compression level (0-9, currently only 0 supported)
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
     * @param {number} compressionLevel - Compression level (0-9, currently only 0 supported)
     * @returns {PngEncodingOptions} New options instance
     */
    withCompression(compressionLevel) {
        return new PngEncodingOptions({
            preserveTransparency: this._config.preserveTransparency,
            compressionLevel
        });
    }
}

// Default options instance - preserve transparency, no compression (maintains simplicity)
PngEncodingOptions.DEFAULT = new PngEncodingOptions();

/**
 * PngEncoder class for SWCanvas
 *
 * Handles encoding of Surface data to minimal PNG format with transparency support.
 * Uses uncompressed DEFLATE blocks for simplicity while maintaining PNG compliance.
 * Provides static methods for encoding with proper alpha handling.
 *
 * Following OO best practices:
 * - Static methods for stateless encoding operations
 * - Clear separation of PNG chunk generation and pixel processing
 * - Proper error handling and validation
 * - Support for transparency (unlike BMP format)
 */
class PngEncoder {
    /**
     * Encode a surface to PNG format
     * @param {Surface} surface - Surface to encode
     * @param {PngEncodingOptions} [options=PngEncodingOptions.DEFAULT] - Encoding options
     * @returns {ArrayBuffer} PNG file data
     */
    static encode(surface, options = PngEncodingOptions.DEFAULT) {
        if (!surface || typeof surface !== 'object') {
            throw new Error('Surface must be a valid Surface object');
        }

        if (!surface.width || !surface.height || !surface.data) {
            throw new Error('Surface must have width, height, and data properties');
        }

        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        // Validate surface data
        const expectedSize = width * height * 4;
        if (data.length !== expectedSize) {
            throw new Error(`Surface data size mismatch. Expected ${expectedSize}, got ${data.length}`);
        }

        // Validate dimensions
        if (width <= 0 || height <= 0) {
            throw new Error('Surface dimensions must be positive');
        }

        if (width > PngEncoder.MAX_DIMENSION || height > PngEncoder.MAX_DIMENSION) {
            throw new Error(`Surface dimensions must be ≤ ${PngEncoder.MAX_DIMENSION}x${PngEncoder.MAX_DIMENSION}`);
        }

        // Create scanlines with filter bytes (filter 0 = None)
        const scanlines = PngEncoder._createScanlines(width, height, data);

        // Create compressed data using stored DEFLATE blocks
        const zlibData = PngEncoder._createZlibData(scanlines);

        // Build PNG chunks
        const signature = PngEncoder._createSignature();
        const ihdrChunk = PngEncoder._createIHDRChunk(width, height);
        const idatChunk = PngEncoder._createIDATChunk(zlibData);
        const iendChunk = PngEncoder._createIENDChunk();

        // Concatenate all parts
        const totalLength = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
        const result = new Uint8Array(totalLength);

        let offset = 0;
        result.set(signature, offset);
        offset += signature.length;
        result.set(ihdrChunk, offset);
        offset += ihdrChunk.length;
        result.set(idatChunk, offset);
        offset += idatChunk.length;
        result.set(iendChunk, offset);

        return result.buffer;
    }

    /**
     * Create PNG signature (8 bytes)
     * @returns {Uint8Array} PNG signature
     * @private
     */
    static _createSignature() {
        return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    }

    /**
     * Create scanlines with filter bytes
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {Uint8ClampedArray} data - RGBA pixel data (non-premultiplied)
     * @returns {Uint8Array} Scanlines with filter bytes
     * @private
     */
    static _createScanlines(width, height, data) {
        const bytesPerPixel = 4; // RGBA
        const stride = width * bytesPerPixel;
        const scanlineLength = stride + 1; // +1 for filter byte
        const result = new Uint8Array(scanlineLength * height);

        let srcOffset = 0;
        let destOffset = 0;

        for (let y = 0; y < height; y++) {
            // Filter type 0 (None)
            result[destOffset++] = 0;

            // Copy scanline (RGBA order, already non-premultiplied)
            for (let x = 0; x < width; x++) {
                result[destOffset++] = data[srcOffset++]; // R
                result[destOffset++] = data[srcOffset++]; // G
                result[destOffset++] = data[srcOffset++]; // B
                result[destOffset++] = data[srcOffset++]; // A
            }
        }

        return result;
    }

    /**
     * Create zlib data with stored DEFLATE blocks
     * @param {Uint8Array} uncompressed - Uncompressed scanline data
     * @returns {Uint8Array} Zlib-wrapped data
     * @private
     */
    static _createZlibData(uncompressed) {
        // Zlib header (CMF=0x78, FLG=0x01 for stored blocks)
        const header = new Uint8Array([0x78, 0x01]);

        // Split into DEFLATE stored blocks (max 65535 bytes per block)
        const blocks = [];
        const maxBlockSize = 65535;
        let offset = 0;

        while (offset < uncompressed.length) {
            const remaining = uncompressed.length - offset;
            const blockSize = Math.min(maxBlockSize, remaining);
            const isLastBlock = offset + blockSize === uncompressed.length;

            // Block header: BFINAL (1 bit) + BTYPE (2 bits, 00 = stored)
            const bfinal = isLastBlock ? 1 : 0;
            const blockHeader = new Uint8Array(5);
            blockHeader[0] = bfinal; // BFINAL=1 if last, BTYPE=00

            // LEN (little-endian)
            blockHeader[1] = blockSize & 0xff;
            blockHeader[2] = (blockSize >>> 8) & 0xff;

            // NLEN (bitwise NOT of LEN, little-endian)
            const nlen = ~blockSize & 0xffff;
            blockHeader[3] = nlen & 0xff;
            blockHeader[4] = (nlen >>> 8) & 0xff;

            blocks.push(blockHeader);
            blocks.push(uncompressed.subarray(offset, offset + blockSize));

            offset += blockSize;
        }

        // Calculate Adler-32 checksum
        const adler32 = PngEncoder._calculateAdler32(uncompressed);
        const trailer = PngEncoder._u32be(adler32);

        // Concatenate all parts
        let totalLength = header.length + trailer.length;
        for (const block of blocks) {
            totalLength += block.length;
        }

        const result = new Uint8Array(totalLength);
        let resultOffset = 0;

        result.set(header, resultOffset);
        resultOffset += header.length;

        for (const block of blocks) {
            result.set(block, resultOffset);
            resultOffset += block.length;
        }

        result.set(trailer, resultOffset);

        return result;
    }

    /**
     * Create IHDR chunk (image header)
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Uint8Array} IHDR chunk
     * @private
     */
    static _createIHDRChunk(width, height) {
        const data = new Uint8Array(13);

        // Width (4 bytes, big-endian)
        const widthBytes = PngEncoder._u32be(width);
        data.set(widthBytes, 0);

        // Height (4 bytes, big-endian)
        const heightBytes = PngEncoder._u32be(height);
        data.set(heightBytes, 4);

        // Bit depth: 8 bits per channel
        data[8] = 8;

        // Color type: 6 = RGBA (RGB + alpha)
        data[9] = 6;

        // Compression method: 0 = DEFLATE
        data[10] = 0;

        // Filter method: 0 = basic 5-filter set
        data[11] = 0;

        // Interlace method: 0 = none
        data[12] = 0;

        return PngEncoder._createChunk('IHDR', data);
    }

    /**
     * Create IDAT chunk (image data)
     * @param {Uint8Array} zlibData - Zlib-compressed image data
     * @returns {Uint8Array} IDAT chunk
     * @private
     */
    static _createIDATChunk(zlibData) {
        return PngEncoder._createChunk('IDAT', zlibData);
    }

    /**
     * Create IEND chunk (end marker)
     * @returns {Uint8Array} IEND chunk
     * @private
     */
    static _createIENDChunk() {
        return PngEncoder._createChunk('IEND', new Uint8Array(0));
    }

    /**
     * Create a PNG chunk with length, type, data, and CRC
     * @param {string} type - 4-character chunk type
     * @param {Uint8Array} data - Chunk data
     * @returns {Uint8Array} Complete chunk
     * @private
     */
    static _createChunk(type, data) {
        if (type.length !== 4) {
            throw new Error('Chunk type must be exactly 4 characters');
        }

        const typeBytes = new TextEncoder().encode(type);
        const length = data.length;
        const lengthBytes = PngEncoder._u32be(length);

        // Calculate CRC over type + data
        const crcInput = new Uint8Array(typeBytes.length + data.length);
        crcInput.set(typeBytes, 0);
        crcInput.set(data, typeBytes.length);
        const crc = PngEncoder._calculateCRC32(crcInput);
        const crcBytes = PngEncoder._u32be(crc);

        // Assemble chunk: length + type + data + crc
        const chunk = new Uint8Array(4 + 4 + length + 4);
        let offset = 0;

        chunk.set(lengthBytes, offset);
        offset += lengthBytes.length;
        chunk.set(typeBytes, offset);
        offset += typeBytes.length;
        chunk.set(data, offset);
        offset += data.length;
        chunk.set(crcBytes, offset);

        return chunk;
    }

    /**
     * Convert 32-bit unsigned integer to big-endian bytes
     * @param {number} value - Value to convert
     * @returns {Uint8Array} 4-byte big-endian representation
     * @private
     */
    static _u32be(value) {
        const bytes = new Uint8Array(4);
        bytes[0] = (value >>> 24) & 0xff;
        bytes[1] = (value >>> 16) & 0xff;
        bytes[2] = (value >>> 8) & 0xff;
        bytes[3] = value & 0xff;
        return bytes;
    }

    /**
     * Calculate CRC-32 checksum
     * @param {Uint8Array} data - Data to checksum
     * @returns {number} CRC-32 value
     * @private
     */
    static _calculateCRC32(data) {
        let crc = 0xffffffff;

        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];

            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
            }
        }

        return (crc ^ 0xffffffff) >>> 0;
    }

    /**
     * Calculate Adler-32 checksum
     * @param {Uint8Array} data - Data to checksum
     * @returns {number} Adler-32 value
     * @private
     */
    static _calculateAdler32(data) {
        let s1 = 1;
        let s2 = 0;
        const MOD_ADLER = 65521;

        for (let i = 0; i < data.length; i++) {
            s1 = (s1 + data[i]) % MOD_ADLER;
            s2 = (s2 + s1) % MOD_ADLER;
        }

        return ((s2 << 16) | s1) >>> 0;
    }

    /**
     * Get PNG file information without encoding (for debugging/info)
     * @param {Surface} surface - Surface to analyze
     * @returns {Object} PNG file information
     */
    static getPNGInfo(surface) {
        if (!surface || !surface.width || !surface.height) {
            throw new Error('Invalid surface');
        }

        const scanlineBytes = (surface.width * 4 + 1) * surface.height; // +1 for filter bytes
        const approximateFileSize = scanlineBytes + 200; // PNG headers + zlib overhead

        return {
            width: surface.width,
            height: surface.height,
            colorType: 'RGBA (6)',
            bitDepth: 8,
            compression: 'DEFLATE (stored blocks)',
            filter: 'None (0)',
            interlace: 'None (0)',
            approximateFileSize: approximateFileSize,
            scanlineBytes: scanlineBytes
        };
    }

    /**
     * Validate that a surface can be encoded to PNG
     * @param {Surface} surface - Surface to validate
     * @returns {boolean} True if surface can be encoded
     */
    static canEncode(surface) {
        try {
            if (!surface || typeof surface !== 'object') return false;
            if (!surface.width || !surface.height || !surface.data) return false;
            if (surface.width <= 0 || surface.height <= 0) return false;
            if (surface.width > PngEncoder.MAX_DIMENSION || surface.height > PngEncoder.MAX_DIMENSION) return false;

            const expectedSize = surface.width * surface.height * 4;
            return surface.data.length === expectedSize;
        } catch (error) {
            return false;
        }
    }

    /**
     * Calculate memory usage for PNG encoding
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {number} Approximate memory usage in bytes
     */
    static calculateMemoryUsage(width, height) {
        if (width <= 0 || height <= 0) return 0;

        // Scanlines + PNG overhead
        return width * height * 4 + height * 1 + 200;
    }
}

// Class constants
PngEncoder.MAX_DIMENSION = 65535; // PNG supports up to 2^31-1, but this is reasonable limit

/**
 * PathFlattener class for SWCanvas
 *
 * Converts Path2D curves and arcs into line segments (polygons) for rendering.
 * Implements deterministic curve flattening with 0.25px tolerance to ensure
 * visual consistency across platforms.
 *
 * Converted from functional to class-based approach following OO best practices:
 * - Static methods for stateless operations
 * - Immutable parameters and predictable behavior
 * - Clear separation of concerns
 */
class PathFlattener {
    /**
     * Flatten a Path2D into a list of polygons
     * @param {Path2D} path2d - Path to flatten
     * @returns {Array<Array<Point>>} Array of polygons, each polygon is an array of Point objects
     */
    static flattenPath(path2d) {
        const polygons = [];
        let currentPoly = [];
        let currentPoint = new Point(0, 0);
        let subpathStart = new Point(0, 0);

        for (const cmd of path2d.commands) {
            switch (cmd.type) {
                case 'moveTo':
                    PathFlattener._handleMoveTo(cmd, polygons, currentPoly);
                    currentPoint = new Point(cmd.x, cmd.y);
                    subpathStart = new Point(cmd.x, cmd.y);
                    currentPoly = [currentPoint.toObject()]; // Convert to plain object for compatibility
                    break;

                case 'lineTo':
                    currentPoint = new Point(cmd.x, cmd.y);
                    currentPoly.push(currentPoint.toObject());
                    break;

                case 'closePath':
                    PathFlattener._handleClosePath(currentPoly, subpathStart, polygons);
                    currentPoly = [];
                    break;

                case 'quadraticCurveTo':
                    const quadPoints = PathFlattener._flattenQuadraticBezier(
                        currentPoint.x,
                        currentPoint.y,
                        cmd.cpx,
                        cmd.cpy,
                        cmd.x,
                        cmd.y
                    );
                    PathFlattener._appendPoints(currentPoly, quadPoints, 1); // Skip first point
                    currentPoint = new Point(cmd.x, cmd.y);
                    break;

                case 'bezierCurveTo':
                    const cubicPoints = PathFlattener._flattenCubicBezier(
                        currentPoint.x,
                        currentPoint.y,
                        cmd.cp1x,
                        cmd.cp1y,
                        cmd.cp2x,
                        cmd.cp2y,
                        cmd.x,
                        cmd.y
                    );
                    PathFlattener._appendPoints(currentPoly, cubicPoints, 1); // Skip first point
                    currentPoint = new Point(cmd.x, cmd.y);
                    break;

                case 'arc':
                    const arcResult = PathFlattener._handleArc(cmd, currentPoly, currentPoint, subpathStart);
                    currentPoint = arcResult.currentPoint;
                    currentPoly = arcResult.currentPoly;
                    if (arcResult.subpathStart) {
                        subpathStart = arcResult.subpathStart;
                    }
                    break;

                case 'ellipse':
                    const ellipsePoints = PathFlattener._flattenEllipse(
                        cmd.x,
                        cmd.y,
                        cmd.radiusX,
                        cmd.radiusY,
                        cmd.rotation,
                        cmd.startAngle,
                        cmd.endAngle,
                        cmd.counterclockwise
                    );
                    PathFlattener._handleEllipsePoints(ellipsePoints, currentPoly, currentPoint);
                    if (ellipsePoints.length > 0) {
                        currentPoint = new Point(
                            ellipsePoints[ellipsePoints.length - 1].x,
                            ellipsePoints[ellipsePoints.length - 1].y
                        );
                    }
                    break;

                case 'arcTo':
                    const arcToResult = PathFlattener._handleArcTo(cmd, currentPoly, currentPoint, subpathStart);
                    currentPoint = arcToResult.currentPoint;
                    currentPoly = arcToResult.currentPoly;
                    if (arcToResult.subpathStart) {
                        subpathStart = arcToResult.subpathStart;
                    }
                    break;
            }
        }

        // Add final polygon if exists
        if (currentPoly.length > 0) {
            polygons.push(currentPoly);
        }

        return polygons;
    }

    /**
     * Handle moveTo command
     * @param {Object} cmd - MoveTo command
     * @param {Array} polygons - Polygon array to update
     * @param {Array} currentPoly - Current polygon to finalize
     * @private
     */
    static _handleMoveTo(cmd, polygons, currentPoly) {
        // Start new subpath
        if (currentPoly.length > 0) {
            polygons.push(currentPoly);
        }
    }

    /**
     * Handle closePath command
     * @param {Array} currentPoly - Current polygon
     * @param {Point} subpathStart - Start point of subpath
     * @param {Array} polygons - Polygon array to update
     * @private
     */
    static _handleClosePath(currentPoly, subpathStart, polygons) {
        if (currentPoly.length > 0) {
            // Close the polygon by adding the start point if not already there
            const last = currentPoly[currentPoly.length - 1];
            if (last.x !== subpathStart.x || last.y !== subpathStart.y) {
                currentPoly.push(subpathStart.toObject());
            }
            polygons.push(currentPoly);
        }
    }

    /**
     * Append points to polygon, skipping the first N points
     * @param {Array} currentPoly - Current polygon
     * @param {Array} points - Points to append
     * @param {number} skipCount - Number of points to skip at start
     * @private
     */
    static _appendPoints(currentPoly, points, skipCount) {
        for (let i = skipCount; i < points.length; i++) {
            currentPoly.push(points[i]);
        }
    }

    /**
     * Handle arc command with path continuity logic
     * @param {Object} cmd - Arc command
     * @param {Array} currentPoly - Current polygon
     * @param {Point} currentPoint - Current point
     * @param {Point} subpathStart - Subpath start point
     * @returns {Object} {currentPoint, currentPoly, subpathStart}
     * @private
     */
    static _handleArc(cmd, currentPoly, currentPoint, subpathStart) {
        const arcPoints = PathFlattener._flattenArc(
            cmd.x,
            cmd.y,
            cmd.radius,
            cmd.startAngle,
            cmd.endAngle,
            cmd.counterclockwise
        );

        if (arcPoints.length === 0) {
            return { currentPoint, currentPoly, subpathStart: null };
        }

        const arcStart = new Point(arcPoints[0].x, arcPoints[0].y);

        // If this is the first command in the subpath, start at arc start
        if (currentPoly.length === 0) {
            currentPoly.push(arcStart.toObject());
            const newCurrentPoint = arcStart;
            const newSubpathStart = arcStart;

            // Add remaining arc points
            PathFlattener._appendPoints(currentPoly, arcPoints, 1);

            return {
                currentPoint:
                    arcPoints.length > 1
                        ? new Point(arcPoints[arcPoints.length - 1].x, arcPoints[arcPoints.length - 1].y)
                        : newCurrentPoint,
                currentPoly,
                subpathStart: newSubpathStart
            };
        } else {
            // Move to arc start if we're not already there
            const distance = currentPoint.distanceTo(arcStart);
            if (distance > 0.01) {
                // Add line to arc start if not already there
                currentPoly.push(arcStart.toObject());
            }

            // Add all arc points except the first
            PathFlattener._appendPoints(currentPoly, arcPoints, 1);

            return {
                currentPoint: new Point(arcPoints[arcPoints.length - 1].x, arcPoints[arcPoints.length - 1].y),
                currentPoly,
                subpathStart: null
            };
        }
    }

    /**
     * Handle ellipse points
     * @param {Array} ellipsePoints - Ellipse points
     * @param {Array} currentPoly - Current polygon
     * @param {Point} currentPoint - Current point
     * @private
     */
    static _handleEllipsePoints(ellipsePoints, currentPoly, currentPoint) {
        if (ellipsePoints.length > 0) {
            // Move to ellipse start if we're not already there
            const ellipseStart = new Point(ellipsePoints[0].x, ellipsePoints[0].y);
            const distance = currentPoint.distanceTo(ellipseStart);
            if (distance > 0.01) {
                // Add line to ellipse start if not already there
                currentPoly.push(ellipseStart.toObject());
            }
            // Add all ellipse points except the first
            PathFlattener._appendPoints(currentPoly, ellipsePoints, 1);
        }
    }

    /**
     * Flatten quadratic Bézier curve with fixed tolerance
     * @param {number} x0 - Start x
     * @param {number} y0 - Start y
     * @param {number} x1 - Control point x
     * @param {number} y1 - Control point y
     * @param {number} x2 - End x
     * @param {number} y2 - End y
     * @returns {Array<Object>} Array of {x, y} points
     * @private
     */
    static _flattenQuadraticBezier(x0, y0, x1, y1, x2, y2) {
        const points = [{ x: x0, y: y0 }];
        PathFlattener._flattenQuadraticBezierRecursive(x0, y0, x1, y1, x2, y2, points, PATH_FLATTENING_TOLERANCE);
        return points;
    }

    /**
     * Recursive quadratic Bézier flattening
     * @param {number} x0 - Start x
     * @param {number} y0 - Start y
     * @param {number} x1 - Control x
     * @param {number} y1 - Control y
     * @param {number} x2 - End x
     * @param {number} y2 - End y
     * @param {Array} points - Points array to append to
     * @param {number} tolerance - Flattening tolerance
     * @private
     */
    static _flattenQuadraticBezierRecursive(x0, y0, x1, y1, x2, y2, points, tolerance) {
        // Check if curve is flat enough
        const dx = x2 - x0;
        const dy = y2 - y0;
        const d = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / Math.sqrt(dx * dx + dy * dy);

        if (d <= tolerance || points.length > 1000) {
            // Safety limit
            points.push({ x: x2, y: y2 });
            return;
        }

        // Split curve at t=0.5
        const x01 = (x0 + x1) / 2;
        const y01 = (y0 + y1) / 2;
        const x12 = (x1 + x2) / 2;
        const y12 = (y1 + y2) / 2;
        const x012 = (x01 + x12) / 2;
        const y012 = (y01 + y12) / 2;

        // Recursively flatten both halves
        PathFlattener._flattenQuadraticBezierRecursive(x0, y0, x01, y01, x012, y012, points, tolerance);
        PathFlattener._flattenQuadraticBezierRecursive(x012, y012, x12, y12, x2, y2, points, tolerance);
    }

    /**
     * Flatten cubic Bézier curve with fixed tolerance
     * @param {number} x0 - Start x
     * @param {number} y0 - Start y
     * @param {number} x1 - Control point 1 x
     * @param {number} y1 - Control point 1 y
     * @param {number} x2 - Control point 2 x
     * @param {number} y2 - Control point 2 y
     * @param {number} x3 - End x
     * @param {number} y3 - End y
     * @returns {Array<Object>} Array of {x, y} points
     * @private
     */
    static _flattenCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3) {
        const points = [{ x: x0, y: y0 }];
        PathFlattener._flattenCubicBezierRecursive(x0, y0, x1, y1, x2, y2, x3, y3, points, PATH_FLATTENING_TOLERANCE);
        return points;
    }

    /**
     * Recursive cubic Bézier flattening using de Casteljau's algorithm
     * @param {number} x0 - Start x
     * @param {number} y0 - Start y
     * @param {number} x1 - Control 1 x
     * @param {number} y1 - Control 1 y
     * @param {number} x2 - Control 2 x
     * @param {number} y2 - Control 2 y
     * @param {number} x3 - End x
     * @param {number} y3 - End y
     * @param {Array} points - Points array
     * @param {number} tolerance - Tolerance
     * @private
     */
    static _flattenCubicBezierRecursive(x0, y0, x1, y1, x2, y2, x3, y3, points, tolerance) {
        // Simplified flatness test - check distance from control points to line
        const dx = x3 - x0;
        const dy = y3 - y0;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) {
            points.push({ x: x3, y: y3 });
            return;
        }

        const d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / len;
        const d2 = Math.abs((x2 - x0) * dy - (y2 - y0) * dx) / len;

        if (d1 + d2 <= tolerance || points.length > 1000) {
            // Safety limit
            points.push({ x: x3, y: y3 });
            return;
        }

        // Split curve at t=0.5 using de Casteljau's algorithm
        const x01 = (x0 + x1) / 2;
        const y01 = (y0 + y1) / 2;
        const x12 = (x1 + x2) / 2;
        const y12 = (y1 + y2) / 2;
        const x23 = (x2 + x3) / 2;
        const y23 = (y2 + y3) / 2;

        const x012 = (x01 + x12) / 2;
        const y012 = (y01 + y12) / 2;
        const x123 = (x12 + x23) / 2;
        const y123 = (y12 + y23) / 2;

        const x0123 = (x012 + x123) / 2;
        const y0123 = (y012 + y123) / 2;

        // Recursively flatten both halves
        PathFlattener._flattenCubicBezierRecursive(x0, y0, x01, y01, x012, y012, x0123, y0123, points, tolerance);
        PathFlattener._flattenCubicBezierRecursive(x0123, y0123, x123, y123, x23, y23, x3, y3, points, tolerance);
    }

    /**
     * Flatten arc to line segments
     * @param {number} cx - Center x
     * @param {number} cy - Center y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} counterclockwise - Direction flag
     * @returns {Array<Object>} Array of {x, y} points
     * @private
     */
    static _flattenArc(cx, cy, radius, startAngle, endAngle, counterclockwise) {
        if (radius <= 0) return [];

        // Normalize angles
        let start = startAngle;
        let end = endAngle;

        if (!counterclockwise && end < start) {
            end += TAU;
        } else if (counterclockwise && start < end) {
            start += TAU;
        }

        const totalAngle = Math.abs(end - start);

        // Calculate number of segments needed for tolerance
        const maxAngleStep = 2 * Math.acos(Math.max(0, 1 - PATH_FLATTENING_TOLERANCE / radius));
        const segments = Math.max(1, Math.ceil(totalAngle / maxAngleStep));

        const points = [];
        const angleStep = (end - start) / segments;

        for (let i = 0; i <= segments; i++) {
            const angle = start + i * angleStep;
            points.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }

        return points;
    }

    /**
     * Flatten ellipse to line segments
     * @param {number} cx - Center x
     * @param {number} cy - Center y
     * @param {number} radiusX - X radius
     * @param {number} radiusY - Y radius
     * @param {number} rotation - Rotation angle
     * @param {number} startAngle - Start angle
     * @param {number} endAngle - End angle
     * @param {boolean} counterclockwise - Direction flag
     * @returns {Array<Object>} Array of {x, y} points
     * @private
     */
    static _flattenEllipse(cx, cy, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
        if (radiusX <= 0 || radiusY <= 0) return [];

        // Normalize angles
        let start = startAngle;
        let end = endAngle;

        if (!counterclockwise && end < start) {
            end += TAU;
        } else if (counterclockwise && start < end) {
            start += TAU;
        }

        const totalAngle = Math.abs(end - start);

        // Calculate number of segments - use smaller radius for tolerance calculation
        const minRadius = Math.min(radiusX, radiusY);
        const maxAngleStep = 2 * Math.acos(Math.max(0, 1 - PATH_FLATTENING_TOLERANCE / minRadius));
        const segments = Math.max(1, Math.ceil(totalAngle / maxAngleStep));

        const points = [];
        const angleStep = (end - start) / segments;
        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);

        for (let i = 0; i <= segments; i++) {
            const angle = start + i * angleStep;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // Unrotated ellipse point
            const x = radiusX * cos;
            const y = radiusY * sin;

            // Apply rotation and translation
            points.push({
                x: cx + x * cosRot - y * sinRot,
                y: cy + x * sinRot + y * cosRot
            });
        }

        return points;
    }

    /**
     * Flatten arc to line segments with custom tolerance for higher precision
     * @param {number} cx - Center x
     * @param {number} cy - Center y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} counterclockwise - Direction flag
     * @param {number} tolerance - Custom tolerance for segment calculation
     * @returns {Array<Object>} Array of {x, y} points
     * @private
     */
    static _flattenArcWithTolerance(cx, cy, radius, startAngle, endAngle, counterclockwise, tolerance) {
        if (radius <= 0) return [];

        // Normalize angles
        let start = startAngle;
        let end = endAngle;

        if (!counterclockwise && end < start) {
            end += TAU;
        } else if (counterclockwise && start < end) {
            start += TAU;
        }

        const totalAngle = Math.abs(end - start);

        // Calculate number of segments needed for tolerance with minimum segments for smooth curves
        const maxAngleStep = 2 * Math.acos(Math.max(0, 1 - tolerance / radius));
        const minSegmentsFor90Deg = 16; // Minimum segments for a 90-degree arc
        const minSegments = Math.ceil((totalAngle / HALF_PI) * minSegmentsFor90Deg);
        const toleranceSegments = Math.ceil(totalAngle / maxAngleStep);
        const segments = Math.max(1, Math.max(minSegments, toleranceSegments));

        const points = [];
        const angleStep = (end - start) / segments;

        for (let i = 0; i <= segments; i++) {
            const angle = start + i * angleStep;
            points.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }

        return points;
    }

    /**
     * Handle arcTo command - creates arc between two tangent lines
     * @param {Object} cmd - arcTo command {x1, y1, x2, y2, radius}
     * @param {Array} currentPoly - Current polygon points
     * @param {Point} currentPoint - Current path position
     * @param {Point} subpathStart - Subpath start position
     * @returns {Object} {currentPoint, currentPoly, subpathStart}
     * @private
     */
    static _handleArcTo(cmd, currentPoly, currentPoint, subpathStart) {
        const { x1, y1, x2, y2, radius } = cmd;

        // Early outs / degenerates
        // If no current point has been set yet: moveTo(x1, y1) and return
        if (currentPoly.length === 0) {
            const targetPoint = new Point(x1, y1);
            currentPoly.push(targetPoint.toObject());
            return {
                currentPoint: targetPoint,
                currentPoly,
                subpathStart: targetPoint
            };
        }

        // If radius <= 0: degrade to lineTo(x1, y1) and return
        if (radius <= 0) {
            const targetPoint = new Point(x1, y1);
            currentPoly.push(targetPoint.toObject());
            return {
                currentPoint: targetPoint,
                currentPoly,
                subpathStart: null
            };
        }

        const p0 = currentPoint; // Current point
        const p1 = new Point(x1, y1); // Corner point
        const p2 = new Point(x2, y2); // End control point

        // Direction vectors from the corner (pointing OUT of the corner)
        // v1 = normalize(P0 - P1)
        // v2 = normalize(P2 - P1)
        const v1 = new Point(p0.x - p1.x, p0.y - p1.y);
        const v2 = new Point(p2.x - p1.x, p2.y - p1.y);

        // Calculate lengths
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        // If any vectors are zero-length (P0==P1, or P1==P2): degrade to lineTo(x1, y1)
        if (len1 < FLOAT_EPSILON || len2 < FLOAT_EPSILON) {
            const targetPoint = new Point(x1, y1);
            currentPoly.push(targetPoint.toObject());
            return {
                currentPoint: targetPoint,
                currentPoly,
                subpathStart: null
            };
        }

        // Normalize vectors
        const u1 = new Point(v1.x / len1, v1.y / len1);
        const u2 = new Point(v2.x / len2, v2.y / len2);

        // Turn angle and tangent distance
        // Compute the turn angle φ between u1 and u2
        const dot = u1.x * u2.x + u1.y * u2.y;
        const cross = u1.x * u2.y - u1.y * u2.x;

        // Clamp dot product to avoid NaN from acos
        const clampedDot = Math.max(-1, Math.min(1, dot));
        const turnAngle = Math.acos(clampedDot);

        // If the three points are collinear (turn angle is ~0° or ~180°): just lineTo(x1, y1)
        if (Math.abs(Math.sin(turnAngle)) < FLOAT_EPSILON) {
            const targetPoint = new Point(x1, y1);
            currentPoly.push(targetPoint.toObject());
            return {
                currentPoint: targetPoint,
                currentPoly,
                subpathStart: null
            };
        }

        // Compute distance from corner to tangent points along each leg
        // d = r / tan(φ/2)
        const halfAngle = turnAngle / 2;
        const tangentDistance = radius / Math.tan(halfAngle);

        // Tangent points on each leg
        // T1 = P1 + u1 * d
        // T2 = P1 + u2 * d
        const t1 = new Point(p1.x + u1.x * tangentDistance, p1.y + u1.y * tangentDistance);
        const t2 = new Point(p1.x + u2.x * tangentDistance, p1.y + u2.y * tangentDistance);

        // Arc center
        // Compute unit left normal for u1 (rotate 90°): n1 = (-u1.y, u1.x)
        const n1 = new Point(-u1.y, u1.x);

        // Decide which side is "inside" using the sign of the cross product
        // sign = sgn(u1.x*u2.y - u1.y*u2.x)
        const sign = Math.sign(cross);

        // The circle's center C is at:
        // C = T1 + n1 * (sign * r)
        const center = new Point(t1.x + n1.x * sign * radius, t1.y + n1.y * sign * radius);

        // Start/end angles and sweep
        // Start angle: a1 = atan2(T1.y - C.y, T1.x - C.x)
        // End angle: a2 = atan2(T2.y - C.y, T2.x - C.x)
        const startAngle = Math.atan2(t1.y - center.y, t1.x - center.x);
        const endAngle = Math.atan2(t2.y - center.y, t2.x - center.x);

        // Anticlockwise flag: anticlockwise = (sign > 0)
        // Note: Inverted from reference to get correct arc direction
        const counterclockwise = sign > 0;

        // Add line to start of arc if needed
        const distance = currentPoint.distanceTo(t1);
        if (distance > 0.01) {
            currentPoly.push(t1.toObject());
        }

        // Generate arc points with higher precision for smooth curves
        const arcTolerance = Math.min(0.1, PATH_FLATTENING_TOLERANCE); // Use finer tolerance for arcTo
        const arcPoints = PathFlattener._flattenArcWithTolerance(
            center.x,
            center.y,
            radius,
            startAngle,
            endAngle,
            counterclockwise,
            arcTolerance
        );

        // Add arc points (skip first point as it's already added)
        PathFlattener._appendPoints(currentPoly, arcPoints, 1);

        // Return end point of arc
        const endPoint =
            arcPoints.length > 0 ? new Point(arcPoints[arcPoints.length - 1].x, arcPoints[arcPoints.length - 1].y) : t2;

        return {
            currentPoint: endPoint,
            currentPoly,
            subpathStart: null
        };
    }
}

/**
 * PolygonFiller class for SWCanvas
 *
 * Implements scanline polygon filling with nonzero and evenodd winding rules.
 * Handles stencil-based clipping integration and premultiplied alpha blending.
 *
 * Provides dual rendering approaches:
 * - Optimized path: 32-bit packed writes for opaque solid colors
 * - Standard path: Full paint source support with gradients, patterns, compositing
 *
 * Converted from functional to class-based approach following OO best practices:
 * - Static methods for stateless operations
 * - Clear separation of scanline logic from pixel blending
 * - Immutable color handling with Color class integration
 */
class PolygonFiller {
    /**
     * Fill polygons using scanline algorithm with stencil-based clipping
     * Routes to optimized rendering when possible for optimal performance
     *
     * @param {Surface} surface - Target surface to render to
     * @param {Array} polygons - Array of polygons (each polygon is array of {x,y} points)
     * @param {Color|Gradient|Pattern} paintSource - Paint source to fill with
     * @param {string} fillRule - 'nonzero' or 'evenodd' winding rule
     * @param {Transform2D} transform - Transformation matrix to apply to polygons
     * @param {ClipMask|null} clipMask - Optional 1-bit stencil buffer for clipping
     * @param {number} globalAlpha - Global alpha value (0-1) for rendering operation
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation (default: 'source-over')
     * @param {SourceMask|null} sourceMask - Optional source coverage mask for canvas-wide compositing
     */
    static fillPolygons(
        surface,
        polygons,
        paintSource,
        fillRule,
        transform,
        clipMask,
        globalAlpha = 1.0,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null
    ) {
        if (polygons.length === 0) return;
        if (IS_DEBUG) {
            if (!PolygonFiller._isValidPaintSource(paintSource)) {
                throw new Error('Paint source must be a Color, Gradient, or Pattern instance');
            }
        }

        // Check if we can use direct rendering (opaque solid color with source-over)
        const canUseDirectRendering =
            paintSource instanceof Color &&
            paintSource.a === 255 &&
            globalAlpha >= 1.0 &&
            subPixelOpacity >= 1.0 &&
            composite === 'source-over' &&
            sourceMask === null;

        if (canUseDirectRendering) {
            PolygonFiller._fillPolygonsDirect(surface, polygons, paintSource, fillRule, transform, clipMask);
        } else {
            PolygonFiller._fillPolygonsStandard(
                surface,
                polygons,
                paintSource,
                fillRule,
                transform,
                clipMask,
                globalAlpha,
                subPixelOpacity,
                composite,
                sourceMask
            );
        }
    }

    /**
     * Direct rendering for opaque solid color fills with source-over compositing
     * Uses 32-bit packed writes and inline clip buffer access for maximum performance
     * @private
     */
    static _fillPolygonsDirect(surface, polygons, color, fillRule, transform, clipMask) {
        // Pre-compute packed color outside hot loop
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);
        const data32 = surface.data32;
        const width = surface.width;
        const clipBuffer = clipMask ? clipMask.buffer : null;

        // Transform all polygon vertices
        const transformedPolygons = polygons.map(poly => poly.map(point => transform.transformPoint(point)));

        // Find bounding box
        const bounds = PolygonFiller._calculateBounds(transformedPolygons, surface);

        // Process each scanline
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            // Find all intersections with this scanline
            const intersections = [];
            for (const poly of transformedPolygons) {
                PolygonFiller._findPolygonIntersections(poly, y + 0.5, intersections);
            }

            // Sort intersections by x coordinate
            intersections.sort((a, b) => a.x - b.x);

            // Fill spans using optimized rendering
            let windingNumber = 0;
            let inside = false;

            for (let i = 0; i < intersections.length; i++) {
                const intersection = intersections[i];
                const nextIntersection = intersections[i + 1];

                windingNumber += intersection.winding;

                if (fillRule === 'evenodd') {
                    inside = windingNumber % 2 !== 0;
                } else {
                    inside = windingNumber !== 0;
                }

                if (inside && nextIntersection) {
                    const startX = Math.max(0, Math.ceil(intersection.x));
                    const endX = Math.min(width - 1, Math.floor(nextIntersection.x));

                    if (startX <= endX) {
                        // Direct span fill with 32-bit writes
                        let pixelIndex = y * width + startX;
                        const endIndex = y * width + endX + 1;

                        if (clipBuffer) {
                            // With clipping - use byte-level skip optimization
                            while (pixelIndex < endIndex) {
                                const byteIndex = pixelIndex >> 3;

                                // Skip fully clipped bytes (8 pixels at a time)
                                if (clipBuffer[byteIndex] === 0) {
                                    const nextByteBoundary = (byteIndex + 1) << 3;
                                    pixelIndex = Math.min(nextByteBoundary, endIndex);
                                    continue;
                                }

                                // Check individual pixel within partially visible byte
                                const bitIndex = pixelIndex & 7;
                                if (clipBuffer[byteIndex] & (1 << bitIndex)) {
                                    data32[pixelIndex] = packedColor;
                                }
                                pixelIndex++;
                            }
                        } else {
                            // No clipping - optimized path with direct 32-bit writes
                            for (; pixelIndex < endIndex; pixelIndex++) {
                                data32[pixelIndex] = packedColor;
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Standard path for all other cases (gradients, patterns, transparency, compositing)
     * @private
     */
    static _fillPolygonsStandard(
        surface,
        polygons,
        paintSource,
        fillRule,
        transform,
        clipMask,
        globalAlpha,
        subPixelOpacity,
        composite,
        sourceMask
    ) {
        // Mark path-based rendering for testing (helps verify direct rendering is used when expected)
        // Check for Context2D existence since PolygonFiller may be used in isolation (e.g., unit tests)
        if (typeof Context2D !== 'undefined' && Context2D._markPathBasedRendering) {
            Context2D._markPathBasedRendering();
        }

        // Transform all polygon vertices
        const transformedPolygons = polygons.map(poly => poly.map(point => transform.transformPoint(point)));

        // Find bounding box for optimization
        const bounds = PolygonFiller._calculateBounds(transformedPolygons, surface);

        // Process each scanline
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            PolygonFiller._fillScanline(
                surface,
                y,
                transformedPolygons,
                paintSource,
                fillRule,
                clipMask,
                transform,
                globalAlpha,
                subPixelOpacity,
                composite,
                sourceMask
            );
        }
    }

    /**
     * Calculate bounding box for transformed polygons
     * @param {Array} polygons - Transformed polygons
     * @param {Surface} surface - Target surface for bounds clamping
     * @returns {Object} {minY, maxY} bounds
     * @private
     */
    static _calculateBounds(polygons, surface) {
        let minY = Infinity,
            maxY = -Infinity;

        for (const poly of polygons) {
            for (const point of poly) {
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }
        }

        // Clamp to surface bounds
        return {
            minY: Math.max(0, Math.floor(minY)),
            maxY: Math.min(surface.height - 1, Math.ceil(maxY))
        };
    }

    /**
     * Fill a single scanline using polygon intersection and winding rules
     * @param {Surface} surface - Target surface
     * @param {number} y - Scanline y coordinate
     * @param {Array} polygons - Transformed polygons
     * @param {Color|Gradient|Pattern} paintSource - Paint source
     * @param {string} fillRule - Winding rule
     * @param {ClipMask|null} clipMask - Clipping mask
     * @param {Transform2D} transform - Canvas transform (for gradients/patterns)
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation
     * @param {SourceMask|null} sourceMask - Optional source coverage mask
     * @private
     */
    static _fillScanline(
        surface,
        y,
        polygons,
        paintSource,
        fillRule,
        clipMask,
        transform,
        globalAlpha,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null
    ) {
        const intersections = [];

        // Find all intersections with this scanline
        for (const poly of polygons) {
            PolygonFiller._findPolygonIntersections(poly, y + 0.5, intersections);
        }

        // Sort intersections by x coordinate
        intersections.sort((a, b) => a.x - b.x);

        // Fill spans based on winding rule
        PolygonFiller._fillSpans(
            surface,
            y,
            intersections,
            paintSource,
            fillRule,
            clipMask,
            transform,
            globalAlpha,
            subPixelOpacity,
            composite,
            sourceMask
        );
    }

    /**
     * Find intersections between a polygon and a horizontal scanline
     * @param {Array} polygon - Array of {x, y} points
     * @param {number} y - Scanline y coordinate
     * @param {Array} intersections - Array to append intersections to
     * @private
     */
    static _findPolygonIntersections(polygon, y, intersections) {
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];

            // Skip horizontal edges (avoid division by zero)
            if (Math.abs(p1.y - p2.y) < FLOAT_EPSILON) continue;

            // Check if scanline crosses this edge
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);

            if (y >= minY && y < maxY) {
                // Note: < maxY to avoid double-counting vertices
                // Calculate intersection point using linear interpolation
                const t = (y - p1.y) / (p2.y - p1.y);
                const x = p1.x + t * (p2.x - p1.x);

                // Determine winding direction
                const winding = p2.y > p1.y ? 1 : -1;

                intersections.push({ x: x, winding: winding });
            }
        }
    }

    /**
     * Fill spans on a scanline based on winding rule
     * @param {Surface} surface - Target surface
     * @param {number} y - Scanline y coordinate
     * @param {Array} intersections - Sorted intersections with winding info
     * @param {Color|Gradient|Pattern} paintSource - Paint source
     * @param {string} fillRule - 'evenodd' or 'nonzero'
     * @param {ClipMask|null} clipMask - Stencil clipping mask
     * @param {Transform2D} transform - Canvas transform (for gradients/patterns)
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation
     * @param {SourceMask|null} sourceMask - Optional source coverage mask
     * @private
     */
    static _fillSpans(
        surface,
        y,
        intersections,
        paintSource,
        fillRule,
        clipMask,
        transform,
        globalAlpha,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null
    ) {
        if (intersections.length === 0) return;

        let windingNumber = 0;
        let inside = false;

        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];
            const nextIntersection = intersections[i + 1];

            // Update winding number
            windingNumber += intersection.winding;

            // Determine if we're inside based on fill rule
            if (fillRule === 'evenodd') {
                inside = windingNumber % 2 !== 0;
            } else {
                // nonzero
                inside = windingNumber !== 0;
            }

            // Fill span if we're inside
            if (inside && nextIntersection) {
                const startX = Math.max(0, Math.ceil(intersection.x));
                const endX = Math.min(surface.width - 1, Math.floor(nextIntersection.x));

                PolygonFiller._fillPixelSpan(
                    surface,
                    y,
                    startX,
                    endX,
                    paintSource,
                    clipMask,
                    transform,
                    globalAlpha,
                    subPixelOpacity,
                    composite,
                    sourceMask
                );
            }
        }
    }

    /**
     * Fill a horizontal span of pixels with paint source and alpha blending
     * @param {Surface} surface - Target surface
     * @param {number} y - Y coordinate
     * @param {number} startX - Start X coordinate (inclusive)
     * @param {number} endX - End X coordinate (inclusive)
     * @param {Color|Gradient|Pattern} paintSource - Paint source
     * @param {ClipMask|null} clipMask - Stencil clipping mask
     * @param {Transform2D} transform - Canvas transform (for gradients/patterns)
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation
     * @param {SourceMask|null} sourceMask - Optional source coverage mask to record coverage
     * @private
     */
    static _fillPixelSpan(
        surface,
        y,
        startX,
        endX,
        paintSource,
        clipMask,
        transform,
        globalAlpha,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null
    ) {
        for (let x = startX; x <= endX; x++) {
            // Check stencil buffer clipping
            if (clipMask && clipMask.isPixelClipped(x, y)) {
                continue; // Skip pixels clipped by stencil buffer
            }

            // Record source coverage if sourceMask is provided
            if (sourceMask) {
                sourceMask.setPixel(x, y, true);
                // For canvas-wide compositing operations, only build source mask - don't draw to surface
                continue;
            }

            // Evaluate paint source at pixel position
            const pixelColor = PolygonFiller._evaluatePaintSource(
                paintSource,
                x,
                y,
                transform,
                globalAlpha,
                subPixelOpacity
            );

            const offset = y * surface.stride + x * 4;
            PolygonFiller._blendPixel(surface, offset, pixelColor, composite);
        }
    }

    /**
     * Blend a color into a surface pixel using specified composite operation
     * @param {Surface} surface - Target surface
     * @param {number} offset - Byte offset in surface data
     * @param {Color} color - Source color to blend
     * @param {string} composite - Composite operation (default: 'source-over')
     * @private
     */
    static _blendPixel(surface, offset, color, composite = 'source-over') {
        // Get destination pixel
        const dstR = surface.data[offset];
        const dstG = surface.data[offset + 1];
        const dstB = surface.data[offset + 2];
        const dstA = surface.data[offset + 3];

        // Use CompositeOperations for blending
        const result = CompositeOperations.blendPixel(
            composite,
            color.r,
            color.g,
            color.b,
            color.a, // source
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

    /**
     * Utility method to convert old-style RGBA array to Color instance
     * Maintains backward compatibility during transition
     * @param {Array} rgba - [r, g, b, a] array (0-255, non-premultiplied)
     * @returns {Color} Color instance
     */
    static colorFromRGBA(rgba) {
        return new Color(rgba[0], rgba[1], rgba[2], rgba[3], false);
    }

    /**
     * Debug method to visualize polygon bounds
     * @param {Array} polygons - Polygons to analyze
     * @returns {Object} Bounding box information
     */
    static getPolygonBounds(polygons) {
        if (polygons.length === 0) {
            return new Rectangle(0, 0, 0, 0);
        }

        const points = polygons.flat();
        return Rectangle.boundingBox(points.map(p => new Point(p.x, p.y)));
    }

    /**
     * Performance utility to count total vertices in polygon set
     * @param {Array} polygons - Polygons to count
     * @returns {number} Total vertex count
     */
    static countVertices(polygons) {
        return polygons.reduce((total, poly) => total + poly.length, 0);
    }

    /**
     * Validate paint source type
     * @param {*} paintSource - Object to validate
     * @returns {boolean} True if valid paint source
     * @private
     */
    static _isValidPaintSource(paintSource) {
        return (
            paintSource instanceof Color ||
            paintSource instanceof Gradient ||
            paintSource instanceof LinearGradient ||
            paintSource instanceof RadialGradient ||
            paintSource instanceof ConicGradient ||
            paintSource instanceof Pattern
        );
    }

    /**
     * Evaluate paint source at a pixel position
     * @param {Color|Gradient|Pattern} paintSource - Paint source to evaluate
     * @param {number} x - Pixel x coordinate
     * @param {number} y - Pixel y coordinate
     * @param {Transform2D} transform - Current canvas transform
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @returns {Color} Color for this pixel
     * @private
     */
    static _evaluatePaintSource(paintSource, x, y, transform, globalAlpha, subPixelOpacity = 1.0) {
        let color;
        if (paintSource instanceof Color) {
            color = paintSource;
        } else if (
            paintSource instanceof Gradient ||
            paintSource instanceof LinearGradient ||
            paintSource instanceof RadialGradient ||
            paintSource instanceof ConicGradient
        ) {
            color = paintSource.getColorForPixel(x, y, transform);
        } else if (paintSource instanceof Pattern) {
            color = paintSource.getColorForPixel(x, y, transform);
        } else {
            // Fallback to transparent black
            color = Color.transparent;
        }

        // Apply global alpha and sub-pixel opacity
        let resultColor = color.withGlobalAlpha(globalAlpha);

        // Apply sub-pixel opacity for thin strokes
        if (subPixelOpacity < 1.0) {
            const adjustedAlpha = Math.round(resultColor.a * subPixelOpacity);
            resultColor = new Color(
                resultColor.r,
                resultColor.g,
                resultColor.b,
                adjustedAlpha,
                resultColor.premultiplied
            );
        }

        return resultColor;
    }

    /**
     * Test if a point is inside a set of polygons using the specified fill rule
     * @param {number} x - X coordinate of the point
     * @param {number} y - Y coordinate of the point
     * @param {Array<Array<Object>>} polygons - Array of polygons, each polygon is array of {x, y} points
     * @param {string} fillRule - Fill rule: 'nonzero' or 'evenodd'
     * @returns {boolean} True if point is inside the polygon set
     * @static
     */
    static isPointInPolygons(x, y, polygons, fillRule = 'nonzero') {
        if (polygons.length === 0) return false;

        const epsilon = FLOAT_EPSILON;

        // First check if point is exactly on any edge (HTML5 Canvas inclusive behavior)
        for (const polygon of polygons) {
            if (polygon.length < 3) continue;

            for (let i = 0; i < polygon.length; i++) {
                const p1 = polygon[i];
                const p2 = polygon[(i + 1) % polygon.length];

                // Check if point lies on this edge
                if (PolygonFiller._isPointOnEdge(x, y, p1, p2, epsilon)) {
                    return true; // HTML5 Canvas treats points on edges as inside
                }
            }
        }

        let windingNumber = 0;

        // Cast horizontal ray from point to the right
        // Count intersections with polygon edges
        for (const polygon of polygons) {
            if (polygon.length < 3) continue; // Skip degenerate polygons

            for (let i = 0; i < polygon.length; i++) {
                const p1 = polygon[i];
                const p2 = polygon[(i + 1) % polygon.length];

                // Skip horizontal edges (no intersection with horizontal ray)
                if (Math.abs(p1.y - p2.y) < epsilon) continue;

                // Check if ray crosses this edge
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);

                // Ray is at y level, check if it intersects the edge
                if (y >= minY && y < maxY) {
                    // Note: < maxY to avoid double-counting vertices
                    // Calculate intersection point using linear interpolation
                    const t = (y - p1.y) / (p2.y - p1.y);
                    const intersectionX = p1.x + t * (p2.x - p1.x);

                    // Only count intersections to the right of our point
                    // Use >= to handle edge case where intersection is exactly at x
                    if (intersectionX >= x) {
                        // Determine winding direction
                        const winding = p2.y > p1.y ? 1 : -1;
                        windingNumber += winding;
                    }
                }
            }
        }

        // Apply fill rule to determine if point is inside
        if (fillRule === 'evenodd') {
            return windingNumber % 2 !== 0;
        } else {
            // nonzero
            return windingNumber !== 0;
        }
    }

    /**
     * Check if a point lies exactly on a line segment (edge)
     * @param {number} px - Point x coordinate
     * @param {number} py - Point y coordinate
     * @param {Object} p1 - First endpoint {x, y}
     * @param {Object} p2 - Second endpoint {x, y}
     * @param {number} epsilon - Tolerance for floating point comparison
     * @returns {boolean} True if point is on the edge
     * @private
     */
    static _isPointOnEdge(px, py, p1, p2, epsilon) {
        // Handle degenerate case where p1 and p2 are the same point
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const edgeLength = Math.sqrt(dx * dx + dy * dy);

        if (edgeLength < epsilon) {
            // Degenerate edge - check if point is at the same location
            return Math.abs(px - p1.x) < epsilon && Math.abs(py - p1.y) < epsilon;
        }

        // Vector from p1 to test point
        const dpx = px - p1.x;
        const dpy = py - p1.y;

        // Check if point is collinear with the edge using cross product
        const crossProduct = Math.abs(dpx * dy - dpy * dx);
        const lineDistanceThreshold = epsilon * edgeLength; // Scale epsilon by edge length
        if (crossProduct > lineDistanceThreshold) {
            return false; // Not on the line containing the edge
        }

        // Check if point is within the bounds of the edge segment
        const dotProduct = dpx * dx + dpy * dy;
        const lengthSquared = dx * dx + dy * dy;

        // Parameter t where point = p1 + t * (p2 - p1)
        // Point is on segment if 0 <= t <= 1
        const t = dotProduct / lengthSquared;
        return t >= -epsilon && t <= 1 + epsilon;
    }

    /**
     * Fill polygons directly into a ClipMask for clipping operations.
     * Uses scanline algorithm identical to surface filling, but writes to 1-bit stencil buffer.
     * This centralizes clip buffer filling logic that was previously duplicated in Context2D.
     *
     * @param {ClipMask} clipMask - Target clip mask to render to
     * @param {Array} polygons - Array of polygons (each polygon is array of {x,y} points)
     * @param {string} fillRule - 'nonzero' or 'evenodd' winding rule
     * @param {Transform2D} transform - Transformation matrix to apply to polygons
     */
    static fillPolygonsToClipMask(clipMask, polygons, fillRule, transform) {
        if (polygons.length === 0) return;

        const width = clipMask.width;
        const height = clipMask.height;

        // Transform all polygon vertices
        const transformedPolygons = polygons.map(poly => poly.map(point => transform.transformPoint(point)));

        // Find bounding box
        let minY = Infinity,
            maxY = -Infinity;
        for (const poly of transformedPolygons) {
            for (const point of poly) {
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }
        }

        // Clamp to clip mask bounds
        minY = Math.max(0, Math.floor(minY));
        maxY = Math.min(height - 1, Math.ceil(maxY));

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const intersections = [];

            // Find all intersections with this scanline (reuse existing method)
            for (const poly of transformedPolygons) {
                PolygonFiller._findPolygonIntersections(poly, y + 0.5, intersections);
            }

            // Sort intersections by x coordinate
            intersections.sort((a, b) => a.x - b.x);

            // Fill spans to clip mask
            PolygonFiller._fillClipMaskSpans(clipMask, y, intersections, fillRule, width);
        }
    }

    /**
     * Fill spans on a scanline into a ClipMask based on winding rule
     * @param {ClipMask} clipMask - Target clip mask
     * @param {number} y - Scanline y coordinate
     * @param {Array} intersections - Sorted intersections with winding info
     * @param {string} fillRule - 'evenodd' or 'nonzero'
     * @param {number} width - Surface width for bounds clamping
     * @private
     */
    static _fillClipMaskSpans(clipMask, y, intersections, fillRule, width) {
        if (intersections.length === 0) return;

        let windingNumber = 0;
        let inside = false;

        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];
            const nextIntersection = intersections[i + 1];

            // Update winding number
            windingNumber += intersection.winding;

            // Determine if we're inside based on fill rule
            if (fillRule === 'evenodd') {
                inside = windingNumber % 2 !== 0;
            } else {
                // nonzero
                inside = windingNumber !== 0;
            }

            // Fill span if we're inside
            if (inside && nextIntersection) {
                const startX = Math.max(0, Math.ceil(intersection.x));
                const endX = Math.min(width - 1, Math.floor(nextIntersection.x));

                for (let x = startX; x <= endX; x++) {
                    clipMask.setPixel(x, y, true); // Set pixel to visible
                }
            }
        }
    }
}

/**
 * StrokeGenerator class for SWCanvas
 *
 * Implements geometric stroke generation that converts paths into filled polygons
 * representing stroke geometry. Handles all join types (miter, round, bevel) and
 * cap types (butt, round, square) with proper miter limit handling.
 *
 * Converted from functional to class-based approach following OO best practices:
 * - Static methods for stateless stroke generation
 * - Clear separation of segment, join, and cap generation
 * - Immutable stroke properties with validation
 */
class StrokeGenerator {
    /**
     * Generate stroke polygons for a path with given stroke properties
     * @param {Path2D} path - Path to stroke
     * @param {Object} strokeProps - Stroke properties
     * @returns {Array<Array<Point>>} Array of stroke polygons
     */
    static generateStrokePolygons(path, strokeProps) {
        const validatedProps = StrokeGenerator._validateStrokeProperties(strokeProps);

        if (validatedProps.lineWidth <= 0) return [];

        // Flatten path to get line segments
        const pathPolygons = PathFlattener.flattenPath(path);

        // Apply dash pattern if specified
        const dashedPolygons = StrokeGenerator._applyDashPattern(pathPolygons, validatedProps);

        const strokePolygons = [];

        for (const polygon of dashedPolygons) {
            if (polygon.length < 2) continue;

            const strokeParts = StrokeGenerator._generateStrokeForPolygon(polygon, validatedProps);
            strokePolygons.push(...strokeParts);
        }

        return strokePolygons;
    }

    /**
     * Validate and normalize stroke properties
     * @param {Object} props - Stroke properties to validate
     * @returns {Object} Validated properties
     * @private
     */
    static _validateStrokeProperties(props) {
        const defaults = {
            lineWidth: 1.0,
            lineJoin: 'miter',
            lineCap: 'butt',
            miterLimit: DEFAULT_MITER_LIMIT,
            lineDash: [],
            lineDashOffset: 0
        };

        const validated = { ...defaults, ...props };

        if (IS_DEBUG) {
            if (validated.lineWidth < 0) {
                throw new Error('lineWidth must not be negative');
            }
            if (!['miter', 'round', 'bevel'].includes(validated.lineJoin)) {
                throw new Error('Invalid lineJoin');
            }
            if (!['butt', 'round', 'square'].includes(validated.lineCap)) {
                throw new Error('Invalid lineCap');
            }
            if (validated.miterLimit <= 0) {
                throw new Error('miterLimit must be positive');
            }
        }

        return validated;
    }

    /**
     * Apply dash pattern to path polygons
     * @param {Array<Array>} pathPolygons - Original path polygons
     * @param {Object} strokeProps - Stroke properties including dash settings
     * @returns {Array<Array>} Dashed polygons (only visible segments)
     * @private
     */
    static _applyDashPattern(pathPolygons, strokeProps) {
        if (!strokeProps.lineDash || strokeProps.lineDash.length === 0) {
            return pathPolygons; // No dashing - return original polygons
        }

        const dashedPolygons = [];

        for (const polygon of pathPolygons) {
            if (polygon.length < 2) continue;

            const dashedSegments = StrokeGenerator._dashPolygon(
                polygon,
                strokeProps.lineDash,
                strokeProps.lineDashOffset
            );

            dashedPolygons.push(...dashedSegments);
        }

        return dashedPolygons;
    }

    /**
     * Apply dash pattern to a single polygon
     * @param {Array} points - Array of {x, y} points
     * @param {Array<number>} lineDash - Dash pattern array
     * @param {number} lineDashOffset - Starting offset
     * @returns {Array<Array>} Array of dashed polygon segments
     * @private
     */
    static _dashPolygon(points, lineDash, lineDashOffset) {
        if (points.length < 2) return [];

        const dashedSegments = [];
        const patternLength = lineDash.reduce((sum, segment) => sum + segment, 0);

        if (patternLength <= 0) {
            return [points]; // Invalid pattern - return original
        }

        // Normalize offset to be within pattern bounds
        let normalizedOffset = lineDashOffset % patternLength;
        if (normalizedOffset < 0) {
            normalizedOffset += patternLength;
        }

        let patternPosition = normalizedOffset;
        let patternIndex = 0;
        let isDash = true; // Start with assuming we're in a dash

        // Find starting pattern index and dash/gap state
        let tempPos = 0;
        for (let i = 0; i < lineDash.length; i++) {
            if (tempPos + lineDash[i] > normalizedOffset) {
                patternIndex = i;
                patternPosition = normalizedOffset - tempPos;
                isDash = i % 2 === 0; // Even indices are dashes, odd are gaps
                break;
            }
            tempPos += lineDash[i];
        }

        let currentSegment = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const segmentLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

            if (segmentLength === 0) continue; // Skip zero-length segments

            const segmentProcessed = StrokeGenerator._processSegmentWithDash(
                p1,
                p2,
                segmentLength,
                lineDash,
                patternIndex,
                patternPosition,
                isDash,
                currentSegment,
                dashedSegments
            );

            // Update state for next segment
            patternIndex = segmentProcessed.patternIndex;
            patternPosition = segmentProcessed.patternPosition;
            isDash = segmentProcessed.isDash;
            currentSegment = segmentProcessed.currentSegment;
        }

        // Add any remaining segment
        if (currentSegment.length > 1) {
            dashedSegments.push(currentSegment);
        }

        return dashedSegments;
    }

    /**
     * Process a single line segment with dash pattern
     * @param {Object} p1 - Start point {x, y}
     * @param {Object} p2 - End point {x, y}
     * @param {number} segmentLength - Length of segment
     * @param {Array<number>} lineDash - Dash pattern
     * @param {number} patternIndex - Current pattern index
     * @param {number} patternPosition - Position within current pattern segment
     * @param {boolean} isDash - Whether currently in dash or gap
     * @param {Array} currentSegment - Current dash segment being built
     * @param {Array} dashedSegments - Array to add completed segments to
     * @returns {Object} Updated state
     * @private
     */
    static _processSegmentWithDash(
        p1,
        p2,
        segmentLength,
        lineDash,
        patternIndex,
        patternPosition,
        isDash,
        currentSegment,
        dashedSegments
    ) {
        let remainingLength = segmentLength;

        // Add start point to current segment if we're in a dash
        if (isDash && currentSegment.length === 0) {
            currentSegment.push({ x: p1.x, y: p1.y });
        }

        while (remainingLength > 0) {
            const currentPatternSegment = lineDash[patternIndex];
            const remainingInPattern = currentPatternSegment - patternPosition;
            const distanceToUse = Math.min(remainingLength, remainingInPattern);

            // Calculate intermediate point
            const t = (segmentLength - remainingLength + distanceToUse) / segmentLength;
            const intermediatePoint = {
                x: p1.x + t * (p2.x - p1.x),
                y: p1.y + t * (p2.y - p1.y)
            };

            if (isDash) {
                currentSegment.push({ x: intermediatePoint.x, y: intermediatePoint.y });
            }

            remainingLength -= distanceToUse;
            patternPosition += distanceToUse;

            // Check if we've completed current pattern segment
            if (patternPosition >= currentPatternSegment) {
                if (isDash && currentSegment.length > 1) {
                    dashedSegments.push(currentSegment);
                    currentSegment = [];
                }

                // Move to next pattern segment
                patternIndex = (patternIndex + 1) % lineDash.length;
                patternPosition = 0;
                isDash = !isDash;

                // Start new segment if entering dash
                if (isDash && remainingLength > 0) {
                    currentSegment = [{ x: intermediatePoint.x, y: intermediatePoint.y }];
                }
            }
        }

        return {
            patternIndex: patternIndex,
            patternPosition: patternPosition,
            isDash: isDash,
            currentSegment: currentSegment
        };
    }

    /**
     * Generate stroke geometry for a single polygon (subpath)
     * @param {Array} points - Array of {x, y} points
     * @param {Object} strokeProps - Validated stroke properties
     * @returns {Array} Array of stroke polygon parts
     * @private
     */
    static _generateStrokeForPolygon(points, strokeProps) {
        if (points.length < 2) return [];

        const strokeParts = [];
        const halfWidth = strokeProps.lineWidth / 2;

        // Determine if this is a closed path
        const isClosed = StrokeGenerator._isPathClosed(points);

        // Generate segment bodies with geometric info
        const segments = StrokeGenerator._generateSegments(points, halfWidth);
        if (segments.length === 0) return [];

        // Add segment bodies to stroke parts
        for (const segment of segments) {
            strokeParts.push(segment.body);
        }

        // Generate joins between adjacent segments
        StrokeGenerator._generateJoins(segments, strokeParts, strokeProps, isClosed);

        // Generate caps for open paths
        if (!isClosed && segments.length > 0) {
            StrokeGenerator._generateCaps(segments, strokeParts, strokeProps, halfWidth);
        }

        return strokeParts;
    }

    /**
     * Check if path is closed (first and last points are very close)
     * @param {Array} points - Path points
     * @returns {boolean} True if path is closed
     * @private
     */
    static _isPathClosed(points) {
        return (
            points.length > 2 &&
            Math.abs(points[0].x - points[points.length - 1].x) < FLOAT_EPSILON &&
            Math.abs(points[0].y - points[points.length - 1].y) < FLOAT_EPSILON
        );
    }

    /**
     * Generate segment data with geometric information
     * @param {Array} points - Path points
     * @param {number} halfWidth - Half of line width
     * @returns {Array} Array of segment objects with body and geometry
     * @private
     */
    static _generateSegments(points, halfWidth) {
        const segments = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = new Point(points[i].x, points[i].y);
            const p2 = new Point(points[i + 1].x, points[i + 1].y);

            // Skip zero-length segments
            const length = p1.distanceTo(p2);
            if (length < FLOAT_EPSILON) continue;

            const segment = StrokeGenerator._createSegment(p1, p2, halfWidth, length);
            segments.push(segment);
        }

        return segments;
    }

    /**
     * Create a segment object with body and geometry
     * @param {Point} p1 - Start point
     * @param {Point} p2 - End point
     * @param {number} halfWidth - Half line width
     * @param {number} length - Segment length
     * @returns {Object} Segment object
     * @private
     */
    static _createSegment(p1, p2, halfWidth, length) {
        // Calculate unit vectors
        const direction = p2.subtract(p1).scale(1 / length);
        const normal = new Point(-direction.y, direction.x); // Perpendicular

        // Generate rectangular body for segment
        const body = [
            p1.add(normal.scale(halfWidth)).toObject(),
            p2.add(normal.scale(halfWidth)).toObject(),
            p2.add(normal.scale(-halfWidth)).toObject(),
            p1.add(normal.scale(-halfWidth)).toObject()
        ];

        return {
            body: body,
            p1: p1,
            p2: p2,
            tangent: direction,
            normal: normal,
            length: length
        };
    }

    /**
     * Generate joins between segments
     * @param {Array} segments - Array of segments
     * @param {Array} strokeParts - Array to append join polygons to
     * @param {Object} strokeProps - Stroke properties
     * @param {boolean} isClosed - Whether path is closed
     * @private
     */
    static _generateJoins(segments, strokeParts, strokeProps, isClosed) {
        // Joins between adjacent segments
        for (let i = 0; i < segments.length - 1; i++) {
            const seg1 = segments[i];
            const seg2 = segments[i + 1];
            const joinPolygons = StrokeGenerator._generateJoin(seg1, seg2, strokeProps);
            strokeParts.push(...joinPolygons);
        }

        // Handle closed path joining (last segment to first segment)
        if (isClosed && segments.length > 1) {
            const lastSeg = segments[segments.length - 1];
            const firstSeg = segments[0];
            const joinPolygons = StrokeGenerator._generateJoin(lastSeg, firstSeg, strokeProps);
            strokeParts.push(...joinPolygons);
        }
    }

    /**
     * Generate join geometry between two segments
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Object} strokeProps - Stroke properties
     * @returns {Array} Array of join polygons
     * @private
     */
    static _generateJoin(seg1, seg2, strokeProps) {
        const joinPoint = seg2.p1; // Connection point

        // Calculate cross product to determine turn direction
        const cross = seg1.tangent.cross(seg2.tangent);

        // Check for 180-degree turn (parallel segments)
        if (Math.abs(cross) < FLOAT_EPSILON) {
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint);
        }

        // Generate appropriate join type
        switch (strokeProps.lineJoin) {
            case 'miter':
                return StrokeGenerator._generateMiterJoin(seg1, seg2, joinPoint, strokeProps.miterLimit);
            case 'round':
                return StrokeGenerator._generateRoundJoin(seg1, seg2, joinPoint);
            case 'bevel':
            default:
                return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint);
        }
    }

    /**
     * Generate miter join with miter limit checking
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Point} joinPoint - Join point
     * @param {number} miterLimit - Miter limit
     * @returns {Array} Array of join polygons
     * @private
     */
    static _generateMiterJoin(seg1, seg2, joinPoint, miterLimit) {
        // Calculate half width from segment body (same as original)
        const halfWidth =
            Math.sqrt(Math.pow(seg1.body[0].x - seg1.body[3].x, 2) + Math.pow(seg1.body[0].y - seg1.body[3].y, 2)) / 2;

        // Determine which sides are on the outside of the turn
        const cross = seg1.tangent.cross(seg2.tangent);

        let outer1, outer2;
        if (cross > 0) {
            // Left turn - right sides are outer
            outer1 = seg1.body[2]; // Right side of seg1 end
            outer2 = seg2.body[3]; // Right side of seg2 start
        } else {
            // Right turn - left sides are outer
            outer1 = seg1.body[1]; // Left side of seg1 end
            outer2 = seg2.body[0]; // Left side of seg2 start
        }

        // Calculate miter point (intersection of extended outer edges)
        // Extend seg1's outer edge forward
        const seg1Extended = {
            x: outer1.x + seg1.tangent.x * 100,
            y: outer1.y + seg1.tangent.y * 100
        };
        // Extend seg2's outer edge backward
        const seg2Extended = {
            x: outer2.x - seg2.tangent.x * 100,
            y: outer2.y - seg2.tangent.y * 100
        };

        const miterPoint = StrokeGenerator._lineIntersection(outer1, seg1Extended, outer2, seg2Extended);

        if (!miterPoint) {
            // Fallback to bevel if no intersection
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint);
        }

        // Check miter limit
        const miterLength = Math.sqrt(
            Math.pow(miterPoint.x - joinPoint.x, 2) + Math.pow(miterPoint.y - joinPoint.y, 2)
        );
        const miterRatio = miterLength / halfWidth;

        if (miterRatio > miterLimit) {
            // Exceeds miter limit - use bevel
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint);
        }

        // For miter join, we need to fill both the miter triangle and the inner area
        let inner1, inner2;
        if (cross > 0) {
            // Left turn - left sides are inner
            inner1 = seg1.body[1]; // Left side of seg1 end
            inner2 = seg2.body[0]; // Left side of seg2 start
        } else {
            // Right turn - right sides are inner
            inner1 = seg1.body[2]; // Right side of seg1 end
            inner2 = seg2.body[3]; // Right side of seg2 start
        }

        // Create miter triangle and inner quadrilateral
        return [
            [outer1, miterPoint, outer2], // Miter triangle
            [outer1, outer2, inner2, inner1] // Inner connecting area
        ];
    }

    /**
     * Generate bevel join
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Point} joinPoint - Join point
     * @returns {Array} Array containing single bevel polygon
     * @private
     */
    static _generateBevelJoin(seg1, seg2, joinPoint) {
        const cross = seg1.tangent.cross(seg2.tangent);
        const outerSides = StrokeGenerator._getOuterSides(seg1, seg2, cross);
        const innerSides = StrokeGenerator._getInnerSides(seg1, seg2, cross);

        return [[outerSides.outer1, outerSides.outer2, innerSides.inner2, innerSides.inner1]];
    }

    /**
     * Generate round join
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Point} joinPoint - Join point
     * @returns {Array} Array of triangular fan polygons
     * @private
     */
    static _generateRoundJoin(seg1, seg2, joinPoint) {
        // Calculate half width from segment body (distance between top and bottom edges)
        const halfWidth =
            Math.sqrt(Math.pow(seg1.body[0].x - seg1.body[3].x, 2) + Math.pow(seg1.body[0].y - seg1.body[3].y, 2)) / 2;

        // Determine which sides are on the outside of the turn
        const cross = seg1.tangent.cross(seg2.tangent);

        let outer1, outer2;
        if (cross > 0) {
            // Left turn - right sides are outer
            outer1 = seg1.body[2]; // Right side of seg1 end
            outer2 = seg2.body[3]; // Right side of seg2 start
        } else {
            // Right turn - left sides are outer
            outer1 = seg1.body[1]; // Left side of seg1 end
            outer2 = seg2.body[0]; // Left side of seg2 start
        }

        // Calculate angles
        const angle1 = Math.atan2(outer1.y - joinPoint.y, outer1.x - joinPoint.x);
        const angle2 = Math.atan2(outer2.y - joinPoint.y, outer2.x - joinPoint.x);

        let startAngle = angle1;
        let endAngle = angle2;

        // Normalize angles to go the correct way around (from original implementation)
        let angleDiff = endAngle - startAngle;
        if (angleDiff > Math.PI) {
            angleDiff -= TAU;
        } else if (angleDiff < -Math.PI) {
            angleDiff += TAU;
        }

        // We want to go the convex way (positive turn)
        if (angleDiff < 0) {
            // Swap to go positive direction
            const temp = startAngle;
            startAngle = endAngle;
            endAngle = temp;
            angleDiff = -angleDiff;
        }

        const segments = Math.max(2, Math.ceil(angleDiff / QUARTER_PI)); // At least 2 segments
        const angleStep = angleDiff / segments;

        const triangles = [];
        for (let i = 0; i < segments; i++) {
            const a1 = startAngle + i * angleStep;
            const a2 = startAngle + (i + 1) * angleStep;

            const p1 = {
                x: joinPoint.x + halfWidth * Math.cos(a1),
                y: joinPoint.y + halfWidth * Math.sin(a1)
            };
            const p2 = {
                x: joinPoint.x + halfWidth * Math.cos(a2),
                y: joinPoint.y + halfWidth * Math.sin(a2)
            };

            triangles.push([joinPoint.toObject(), p1, p2]);
        }

        return triangles;
    }

    /**
     * Generate caps for open paths
     * @param {Array} segments - Array of segments
     * @param {Array} strokeParts - Array to append cap polygons to
     * @param {Object} strokeProps - Stroke properties
     * @param {number} halfWidth - Half line width
     * @private
     */
    static _generateCaps(segments, strokeParts, strokeProps, halfWidth) {
        // Start cap
        const startCaps = StrokeGenerator._generateCap(
            segments[0].p1,
            segments[0].tangent,
            halfWidth,
            strokeProps.lineCap,
            true
        );
        if (startCaps) {
            strokeParts.push(...(Array.isArray(startCaps[0]) ? startCaps : [startCaps]));
        }

        // End cap
        const lastSeg = segments[segments.length - 1];
        const endCaps = StrokeGenerator._generateCap(
            lastSeg.p2,
            lastSeg.tangent,
            halfWidth,
            strokeProps.lineCap,
            false
        );
        if (endCaps) {
            strokeParts.push(...(Array.isArray(endCaps[0]) ? endCaps : [endCaps]));
        }
    }

    /**
     * Generate cap geometry
     * @param {Point} point - Cap point
     * @param {Point} tangent - Tangent direction
     * @param {number} halfWidth - Half line width
     * @param {string} lineCap - Cap type
     * @param {boolean} isStart - Whether this is start cap
     * @returns {Array|null} Cap polygons or null for butt caps
     * @private
     */
    static _generateCap(point, tangent, halfWidth, lineCap, isStart) {
        const normal = new Point(-tangent.y, tangent.x);

        switch (lineCap) {
            case 'square':
                return StrokeGenerator._generateSquareCap(point, tangent, normal, halfWidth, isStart);
            case 'round':
                return StrokeGenerator._generateRoundCap(point, normal, halfWidth, isStart);
            case 'butt':
            default:
                return null; // No cap geometry needed
        }
    }

    /**
     * Generate square cap
     * @param {Point} point - Cap center point
     * @param {Point} tangent - Tangent direction
     * @param {Point} normal - Normal direction
     * @param {number} halfWidth - Half line width
     * @param {boolean} isStart - Whether this is start cap
     * @returns {Array} Square cap polygon
     * @private
     */
    static _generateSquareCap(point, tangent, normal, halfWidth, isStart) {
        const extension = isStart ? point.subtract(tangent.scale(halfWidth)) : point.add(tangent.scale(halfWidth));

        return [
            [
                extension.add(normal.scale(halfWidth)).toObject(),
                extension.subtract(normal.scale(halfWidth)).toObject(),
                point.subtract(normal.scale(halfWidth)).toObject(),
                point.add(normal.scale(halfWidth)).toObject()
            ]
        ];
    }

    /**
     * Generate round cap as semicircular fan
     * @param {Point} point - Cap center point
     * @param {Point} normal - Normal direction
     * @param {number} halfWidth - Half line width
     * @param {boolean} isStart - Whether this is start cap
     * @returns {Array} Array of triangular fan segments
     * @private
     */
    static _generateRoundCap(point, normal, halfWidth, isStart) {
        const startAngle = Math.atan2(normal.y, normal.x);
        return StrokeGenerator._generateArcFan(point, halfWidth, startAngle, startAngle + Math.PI * (isStart ? 1 : -1));
    }

    // Helper methods

    /**
     * Get outer edge points for join calculation
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {number} cross - Cross product
     * @returns {Object} {outer1, outer2}
     * @private
     */
    static _getOuterSides(seg1, seg2, cross) {
        if (cross > 0) {
            // Left turn - right sides are outer
            return {
                outer1: seg1.body[2], // Right side of seg1 end
                outer2: seg2.body[3] // Right side of seg2 start
            };
        } else {
            // Right turn - left sides are outer
            return {
                outer1: seg1.body[1], // Left side of seg1 end
                outer2: seg2.body[0] // Left side of seg2 start
            };
        }
    }

    /**
     * Get inner edge points for join calculation
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {number} cross - Cross product
     * @returns {Object} {inner1, inner2}
     * @private
     */
    static _getInnerSides(seg1, seg2, cross) {
        if (cross > 0) {
            // Left turn - left sides are inner
            return {
                inner1: seg1.body[1], // Left side of seg1 end
                inner2: seg2.body[0] // Left side of seg2 start
            };
        } else {
            // Right turn - right sides are inner
            return {
                inner1: seg1.body[2], // Right side of seg1 end
                inner2: seg2.body[3] // Right side of seg2 start
            };
        }
    }

    /**
     * Calculate intersection of two lines defined by points
     * @param {Object} p1 - First line point 1
     * @param {Object} p2 - First line point 2
     * @param {Object} p3 - Second line point 1
     * @param {Object} p4 - Second line point 2
     * @returns {Object|null} Intersection point or null if parallel
     * @private
     */
    static _lineIntersection(p1, p2, p3, p4) {
        const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);

        if (Math.abs(denom) < FLOAT_EPSILON) {
            return null; // Lines are parallel
        }

        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;

        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y)
        };
    }

    /**
     * Generate triangular fan for arcs (used by round joins and caps)
     * @param {Point} center - Arc center
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @returns {Array} Array of triangles
     * @private
     */
    static _generateArcFan(center, radius, startAngle, endAngle) {
        let angleDiff = endAngle - startAngle;

        // Normalize angle difference
        while (angleDiff > Math.PI) angleDiff -= TAU;
        while (angleDiff < -Math.PI) angleDiff += TAU;

        const absAngle = Math.abs(angleDiff);
        const segments = Math.max(2, Math.ceil(absAngle / QUARTER_PI));
        const angleStep = angleDiff / segments;

        const triangles = [];
        for (let i = 0; i < segments; i++) {
            const a1 = startAngle + i * angleStep;
            const a2 = startAngle + (i + 1) * angleStep;

            const p1 = {
                x: center.x + radius * Math.cos(a1),
                y: center.y + radius * Math.sin(a1)
            };
            const p2 = {
                x: center.x + radius * Math.cos(a2),
                y: center.y + radius * Math.sin(a2)
            };

            triangles.push([center.toObject(), p1, p2]);
        }

        return triangles;
    }
}

/**
 * BitBuffer class for SWCanvas
 *
 * A utility class for managing 1-bit per pixel data structures.
 * Used as a composition component by ClipMask and SourceMask to eliminate
 * code duplication while maintaining clear separation of concerns.
 *
 * Following Joshua Bloch's principle: "Favor composition over inheritance" (Item 18)
 *
 * Memory Layout:
 * - Each pixel is represented by 1 bit
 * - Bits are packed into Uint8Array (8 pixels per byte)
 * - Memory usage: width × height ÷ 8 bytes
 */
class BitBuffer {
    /**
     * Create a BitBuffer
     * @param {number} width - Buffer width in pixels
     * @param {number} height - Buffer height in pixels
     * @param {number} defaultValue - Default bit value (0 or 1)
     */
    constructor(width, height, defaultValue = 0) {
        // Validate parameters
        Validators.positiveInteger(width, 'BitBuffer width');
        Validators.positiveInteger(height, 'BitBuffer height');

        if (defaultValue !== 0 && defaultValue !== 1) {
            throw new Error('BitBuffer defaultValue must be 0 or 1');
        }

        this._width = width;
        this._height = height;
        this._numPixels = width * height;
        this._numBytes = Math.ceil(this._numPixels / 8);
        this._defaultValue = defaultValue;

        // Create buffer and initialize to default value
        this._buffer = new Uint8Array(this._numBytes);
        this._initializeToDefault();

        // Make dimensions immutable
        Object.defineProperty(this, 'width', { value: width, writable: false });
        Object.defineProperty(this, 'height', { value: height, writable: false });
    }

    /**
     * Initialize buffer to default value
     * @private
     */
    _initializeToDefault() {
        if (this._defaultValue === 1) {
            // Initialize to all 1s
            this._buffer.fill(0xff);

            // Handle partial last byte if width*height is not divisible by 8
            const remainderBits = this._numPixels % 8;
            if (remainderBits !== 0) {
                const lastByteIndex = this._numBytes - 1;
                const lastByteMask = (1 << remainderBits) - 1;
                this._buffer[lastByteIndex] = lastByteMask;
            }
        } else {
            // Initialize to all 0s (default for Uint8Array)
            this._buffer.fill(0);
        }
    }

    /**
     * Get bit value for a pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if bit is 1, false if bit is 0
     */
    getPixel(x, y) {
        // Bounds checking
        if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
            return false; // Out of bounds pixels return 0
        }

        const pixelIndex = y * this._width + x;
        return this._getBit(pixelIndex) === 1;
    }

    /**
     * Set bit value for a pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {boolean} value - True to set bit to 1, false to set to 0
     */
    setPixel(x, y, value) {
        // Bounds checking
        if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
            return; // Ignore out of bounds
        }

        const pixelIndex = y * this._width + x;
        this._setBit(pixelIndex, value ? 1 : 0);
    }

    /**
     * Clear all bits (set to 0)
     */
    clear() {
        this._buffer.fill(0);
    }

    /**
     * Fill all bits (set to 1)
     */
    fill() {
        this._buffer.fill(0xff);

        // Handle partial last byte
        const remainderBits = this._numPixels % 8;
        if (remainderBits !== 0) {
            const lastByteIndex = this._numBytes - 1;
            const lastByteMask = (1 << remainderBits) - 1;
            this._buffer[lastByteIndex] = lastByteMask;
        }
    }

    /**
     * Reset buffer to its default value
     */
    reset() {
        this._initializeToDefault();
    }

    /**
     * Perform bitwise AND with another BitBuffer
     * @param {BitBuffer} other - Other BitBuffer to AND with
     */
    and(other) {
        if (IS_DEBUG) {
            if (!(other instanceof BitBuffer)) {
                throw new Error('Argument must be a BitBuffer instance');
            }
            if (other._width !== this._width || other._height !== this._height) {
                throw new Error('BitBuffer dimensions must match for AND operation');
            }
        }

        // Perform bitwise AND on each byte
        for (let i = 0; i < this._numBytes; i++) {
            this._buffer[i] &= other._buffer[i];
        }
    }

    /**
     * Copy data from another BitBuffer
     * @param {BitBuffer} other - Source BitBuffer to copy from
     */
    copyFrom(other) {
        if (IS_DEBUG) {
            if (!(other instanceof BitBuffer)) {
                throw new Error('Argument must be a BitBuffer instance');
            }
            if (other._width !== this._width || other._height !== this._height) {
                throw new Error('BitBuffer dimensions must match for copy operation');
            }
        }

        this._buffer.set(other._buffer);
    }

    /**
     * Check if buffer is completely filled (all 1s)
     * @returns {boolean} True if all bits are 1
     */
    isFull() {
        // Quick check: if all bytes are 0xFF except possibly the last one
        for (let i = 0; i < this._numBytes - 1; i++) {
            if (this._buffer[i] !== 0xff) {
                return false;
            }
        }

        // Check last byte accounting for partial bits
        const remainderBits = this._numPixels % 8;
        if (remainderBits === 0) {
            return this._buffer[this._numBytes - 1] === 0xff;
        } else {
            const lastByteMask = (1 << remainderBits) - 1;
            return this._buffer[this._numBytes - 1] === lastByteMask;
        }
    }

    /**
     * Check if buffer is completely empty (all 0s)
     * @returns {boolean} True if all bits are 0
     */
    isEmpty() {
        for (let i = 0; i < this._numBytes; i++) {
            if (this._buffer[i] !== 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get memory usage in bytes
     * @returns {number} Memory usage of the buffer
     */
    getMemoryUsage() {
        return this._buffer.byteLength;
    }

    /**
     * Get bit value at linear pixel index
     * @param {number} pixelIndex - Linear pixel index
     * @returns {number} 0 or 1
     * @private
     */
    _getBit(pixelIndex) {
        const byteIndex = Math.floor(pixelIndex / 8);
        const bitIndex = pixelIndex % 8;

        if (byteIndex >= this._buffer.length) {
            return 0; // Out of bounds pixels return 0
        }

        return (this._buffer[byteIndex] & (1 << bitIndex)) !== 0 ? 1 : 0;
    }

    /**
     * Set bit value at linear pixel index
     * @param {number} pixelIndex - Linear pixel index
     * @param {number} value - 0 or 1
     * @private
     */
    _setBit(pixelIndex, value) {
        const byteIndex = Math.floor(pixelIndex / 8);
        const bitIndex = pixelIndex % 8;

        if (byteIndex >= this._buffer.length) {
            return; // Ignore out of bounds
        }

        if (value) {
            this._buffer[byteIndex] |= 1 << bitIndex;
        } else {
            this._buffer[byteIndex] &= ~(1 << bitIndex);
        }
    }

    /**
     * String representation for debugging
     * @returns {string} BitBuffer description
     */
    toString() {
        const memoryKB = (this.getMemoryUsage() / 1024).toFixed(2);
        const state = this.isEmpty() ? 'empty' : this.isFull() ? 'full' : 'mixed';
        return `BitBuffer(${this._width}×${this._height}, ${memoryKB}KB, ${state})`;
    }

    /**
     * Check equality with another BitBuffer
     * @param {BitBuffer} other - Other BitBuffer to compare
     * @returns {boolean} True if buffers are identical
     */
    equals(other) {
        if (!(other instanceof BitBuffer)) {
            return false;
        }

        if (other._width !== this._width || other._height !== this._height) {
            return false;
        }

        // Compare buffer contents
        for (let i = 0; i < this._numBytes; i++) {
            if (this._buffer[i] !== other._buffer[i]) {
                return false;
            }
        }

        return true;
    }
}

/**
 * BoundsTracker class for SWCanvas
 *
 * Reusable component for tracking the bounding box of pixel operations.
 * Used by SourceMask and ShadowBuffer to eliminate code duplication
 * while maintaining clear separation of concerns.
 *
 * Following Joshua Bloch's principle: "Favor composition over inheritance" (Item 18)
 * This utility class encapsulates the common bounds tracking logic needed by
 * multiple mask and buffer classes.
 */
class BoundsTracker {
    /**
     * Create a BoundsTracker
     */
    constructor() {
        this.reset();
    }

    /**
     * Reset bounds to empty state
     */
    reset() {
        this._bounds = {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
            isEmpty: true
        };
    }

    /**
     * Update bounds to include a new point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    updateBounds(x, y) {
        // Parameter validation
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('BoundsTracker coordinates must be numbers');
        }

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error('BoundsTracker coordinates must be finite numbers');
        }

        if (this._bounds.isEmpty) {
            // First point sets initial bounds
            this._bounds.minX = this._bounds.maxX = x;
            this._bounds.minY = this._bounds.maxY = y;
            this._bounds.isEmpty = false;
        } else {
            // Expand bounds to include new point
            this._bounds.minX = Math.min(this._bounds.minX, x);
            this._bounds.maxX = Math.max(this._bounds.maxX, x);
            this._bounds.minY = Math.min(this._bounds.minY, y);
            this._bounds.maxY = Math.max(this._bounds.maxY, y);
        }
    }

    /**
     * Get current bounds
     * @returns {Object} Bounds object with minX, minY, maxX, maxY, isEmpty
     */
    getBounds() {
        return {
            minX: this._bounds.minX,
            minY: this._bounds.minY,
            maxX: this._bounds.maxX,
            maxY: this._bounds.maxY,
            isEmpty: this._bounds.isEmpty
        };
    }

    /**
     * Check if bounds are empty
     * @returns {boolean} True if no points have been added
     */
    isEmpty() {
        return this._bounds.isEmpty;
    }

    /**
     * Get bounds width (returns 0 if empty)
     * Bounds are inclusive pixel coordinates, so width = maxX - minX + 1
     * (e.g., minX=0 to maxX=10 spans 11 pixels)
     * @returns {number} Width of bounding box in pixels
     */
    getWidth() {
        return this._bounds.isEmpty ? 0 : this._bounds.maxX - this._bounds.minX + 1;
    }

    /**
     * Get bounds height (returns 0 if empty)
     * Bounds are inclusive pixel coordinates, so height = maxY - minY + 1
     * (e.g., minY=0 to maxY=10 spans 11 pixels)
     * @returns {number} Height of bounding box in pixels
     */
    getHeight() {
        return this._bounds.isEmpty ? 0 : this._bounds.maxY - this._bounds.minY + 1;
    }

    /**
     * Get bounds area (returns 0 if empty)
     * @returns {number} Area of bounding box
     */
    getArea() {
        return this.getWidth() * this.getHeight();
    }

    /**
     * Check if a point is within current bounds
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if point is within bounds
     */
    contains(x, y) {
        if (this._bounds.isEmpty) {
            return false;
        }

        return x >= this._bounds.minX && x <= this._bounds.maxX && y >= this._bounds.minY && y <= this._bounds.maxY;
    }

    /**
     * Expand bounds by a specified margin
     * @param {number} margin - Margin to add on all sides
     */
    expand(margin) {
        if (typeof margin !== 'number' || margin < 0) {
            throw new Error('BoundsTracker margin must be a non-negative number');
        }

        if (!this._bounds.isEmpty && margin > 0) {
            this._bounds.minX -= margin;
            this._bounds.minY -= margin;
            this._bounds.maxX += margin;
            this._bounds.maxY += margin;
        }
    }

    /**
     * Constrain bounds to specified limits
     * @param {number} minX - Minimum X value
     * @param {number} minY - Minimum Y value
     * @param {number} maxX - Maximum X value
     * @param {number} maxY - Maximum Y value
     */
    clampTo(minX, minY, maxX, maxY) {
        // Parameter validation
        if (
            typeof minX !== 'number' ||
            typeof minY !== 'number' ||
            typeof maxX !== 'number' ||
            typeof maxY !== 'number'
        ) {
            throw new Error('BoundsTracker clamp limits must be numbers');
        }

        if (minX > maxX || minY > maxY) {
            throw new Error('BoundsTracker clamp limits: min values must be <= max values');
        }

        if (!this._bounds.isEmpty) {
            this._bounds.minX = Math.max(this._bounds.minX, minX);
            this._bounds.minY = Math.max(this._bounds.minY, minY);
            this._bounds.maxX = Math.min(this._bounds.maxX, maxX);
            this._bounds.maxY = Math.min(this._bounds.maxY, maxY);

            // Check if bounds became invalid after clamping
            if (this._bounds.minX > this._bounds.maxX || this._bounds.minY > this._bounds.maxY) {
                this.reset(); // Bounds are now empty
            }
        }
    }

    /**
     * Create a deep copy of the internal bounds object
     * @returns {Object} Cloned bounds object
     */
    cloneBounds() {
        return {
            minX: this._bounds.minX,
            minY: this._bounds.minY,
            maxX: this._bounds.maxX,
            maxY: this._bounds.maxY,
            isEmpty: this._bounds.isEmpty
        };
    }

    /**
     * Create a deep copy of this BoundsTracker
     * @returns {BoundsTracker} New BoundsTracker with copied bounds
     */
    clone() {
        const clone = new BoundsTracker();
        clone._bounds = this.cloneBounds();
        return clone;
    }

    /**
     * Merge with another BoundsTracker
     * @param {BoundsTracker} other - Other BoundsTracker to merge with
     */
    mergeWith(other) {
        if (IS_DEBUG) {
            if (!(other instanceof BoundsTracker)) {
                throw new Error('BoundsTracker merge requires another BoundsTracker instance');
            }
        }

        if (other._bounds.isEmpty) {
            return; // Nothing to merge
        }

        if (this._bounds.isEmpty) {
            // This tracker is empty, copy other's bounds
            this._bounds = other.cloneBounds();
        } else {
            // Merge bounds
            this._bounds.minX = Math.min(this._bounds.minX, other._bounds.minX);
            this._bounds.minY = Math.min(this._bounds.minY, other._bounds.minY);
            this._bounds.maxX = Math.max(this._bounds.maxX, other._bounds.maxX);
            this._bounds.maxY = Math.max(this._bounds.maxY, other._bounds.maxY);
        }
    }

    /**
     * Check equality with another BoundsTracker
     * @param {BoundsTracker} other - Other BoundsTracker to compare
     * @returns {boolean} True if bounds are identical
     */
    equals(other) {
        if (!(other instanceof BoundsTracker)) {
            return false;
        }

        return (
            this._bounds.isEmpty === other._bounds.isEmpty &&
            this._bounds.minX === other._bounds.minX &&
            this._bounds.minY === other._bounds.minY &&
            this._bounds.maxX === other._bounds.maxX &&
            this._bounds.maxY === other._bounds.maxY
        );
    }

    /**
     * String representation for debugging
     * @returns {string} BoundsTracker description
     */
    toString() {
        if (this._bounds.isEmpty) {
            return 'BoundsTracker(empty)';
        } else {
            const width = this.getWidth();
            const height = this.getHeight();
            return `BoundsTracker((${this._bounds.minX},${this._bounds.minY})-(${this._bounds.maxX},${this._bounds.maxY}), ${width}×${height})`;
        }
    }
}

/**
 * ClipMask class for SWCanvas
 *
 * Represents a 1-bit stencil buffer for memory-efficient clipping operations.
 * Uses composition with BitBuffer to eliminate code duplication while maintaining
 * clear separation of concerns (Joshua Bloch Item 18: Favor composition over inheritance).
 *
 * Memory Layout:
 * - Each pixel is represented by 1 bit (1 = visible, 0 = clipped)
 * - Bits are packed into Uint8Array (8 pixels per byte)
 * - Memory usage: width × height ÷ 8 bytes (87.5% reduction vs full coverage)
 */
class ClipMask {
    /**
     * Create a ClipMask
     * @param {number} width - Surface width in pixels
     * @param {number} height - Surface height in pixels
     */
    constructor(width, height) {
        // BitBuffer validates parameters and handles bit manipulation
        // Default to 1 (no clipping by default)
        this._bitBuffer = new BitBuffer(width, height, 1);

        // Make dimensions immutable
        Object.defineProperty(this, 'width', { value: width, writable: false });
        Object.defineProperty(this, 'height', { value: height, writable: false });
    }

    /**
     * Direct buffer access for hot-loop optimizations (dual-access pattern).
     * Use this for performance-critical code that needs direct bitwise operations.
     * @returns {Uint8Array} The raw bit buffer
     */
    get buffer() {
        return this._bitBuffer._buffer;
    }

    /**
     * Get clip state for a pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if pixel is visible (not clipped)
     */
    getPixel(x, y) {
        return this._bitBuffer.getPixel(x, y);
    }

    /**
     * Set clip state for a pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {boolean} visible - True if pixel should be visible
     */
    setPixel(x, y, visible) {
        this._bitBuffer.setPixel(x, y, visible);
    }

    /**
     * Check if a pixel is clipped (convenience method)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if pixel is clipped out
     */
    isPixelClipped(x, y) {
        return !this.getPixel(x, y);
    }

    /**
     * Clear all clipping (set all pixels to visible)
     */
    clear() {
        this._bitBuffer.fill(); // Fill with 1s (visible)
    }

    /**
     * Set all pixels to clipped state
     */
    clipAll() {
        this._bitBuffer.clear(); // Clear to 0s (clipped)
    }

    /**
     * Intersect this clip mask with another (AND operation)
     * Only pixels visible in BOTH masks will remain visible
     * @param {ClipMask} other - Other clip mask to intersect with
     */
    intersectWith(other) {
        if (IS_DEBUG) {
            if (!(other instanceof ClipMask)) {
                throw new Error('Argument must be a ClipMask instance');
            }
        }

        this._bitBuffer.and(other._bitBuffer);
    }

    /**
     * Create a deep copy of this clip mask
     * @returns {ClipMask} New ClipMask with copied data
     */
    clone() {
        const clone = new ClipMask(this.width, this.height);
        clone._bitBuffer.copyFrom(this._bitBuffer);
        return clone;
    }

    /**
     * Create a clip pixel writer function for path rendering
     * @returns {Function} clipPixel function for coverage-based rendering
     */
    createPixelWriter() {
        return (x, y, coverage) => {
            // Bounds checking
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

            // Convert coverage to binary: >0.5 means inside, <=0.5 means outside
            const isInside = coverage > 0.5;
            this.setPixel(x, y, isInside);
        };
    }

    /**
     * Get memory usage in bytes
     * @returns {number} Memory usage of the clip mask
     */
    getMemoryUsage() {
        return this._bitBuffer.getMemoryUsage();
    }

    /**
     * Check if mask has any clipping (optimization)
     * @returns {boolean} True if any pixels are clipped
     */
    hasClipping() {
        return !this._bitBuffer.isFull();
    }

    /**
     * String representation for debugging
     * @returns {string} ClipMask description
     */
    toString() {
        const memoryKB = (this.getMemoryUsage() / 1024).toFixed(2);
        const clippingStatus = this.hasClipping() ? 'with clipping' : 'no clipping';
        return `ClipMask(${this.width}×${this.height}, ${memoryKB}KB, ${clippingStatus})`;
    }

    /**
     * Check equality with another ClipMask
     * @param {ClipMask} other - Other ClipMask to compare
     * @returns {boolean} True if masks are identical
     */
    equals(other) {
        if (!(other instanceof ClipMask)) {
            return false;
        }

        return this._bitBuffer.equals(other._bitBuffer);
    }
}

/**
 * SourceMask class for SWCanvas
 *
 * Represents a 1-bit source coverage mask for canvas-wide composite operations.
 * Uses composition with BitBuffer to eliminate code duplication while maintaining
 * clear separation of concerns (Joshua Bloch Item 18: Favor composition over inheritance).
 * Tracks which pixels are covered by the current drawing operation and provides
 * efficient bounds for iteration during canvas-wide compositing passes.
 *
 * Optimizations:
 * - 1-bit per pixel memory efficiency (same as ClipMask)
 * - Automatic bounds tracking to minimize iteration area
 * - Fast clear and isEmpty operations
 * - Optimized for: build once during rendering, read many times during compositing
 */
class SourceMask {
    /**
     * Create a SourceMask
     * @param {number} width - Surface width in pixels
     * @param {number} height - Surface height in pixels
     */
    constructor(width, height) {
        // BitBuffer validates parameters and handles bit manipulation
        // Default to 0 (no coverage by default)
        this._bitBuffer = new BitBuffer(width, height, 0);

        // Bounds tracking for optimization using composition
        this._boundsTracker = new BoundsTracker();

        // Make dimensions immutable
        Object.defineProperty(this, 'width', { value: width, writable: false });
        Object.defineProperty(this, 'height', { value: height, writable: false });
    }

    /**
     * Get coverage state for a pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if pixel is covered by source
     */
    getPixel(x, y) {
        return this._bitBuffer.getPixel(x, y);
    }

    /**
     * Set coverage state for a pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {boolean} covered - True if pixel should be marked as covered
     */
    setPixel(x, y, covered) {
        // Bounds checking
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return; // Ignore out of bounds
        }

        const wasCovered = this._bitBuffer.getPixel(x, y);

        // Update pixel state
        this._bitBuffer.setPixel(x, y, covered);

        // Update bounds if pixel became covered
        if (covered && !wasCovered) {
            this._boundsTracker.updateBounds(x, y);
        }
        // Note: We don't shrink bounds when pixels are uncovered for performance
        // Clear() resets bounds completely
    }

    /**
     * Clear all coverage (set all pixels to not covered)
     */
    clear() {
        this._bitBuffer.clear();
        this._boundsTracker.reset();
    }

    /**
     * Check if mask has any coverage
     * @returns {boolean} True if no pixels are covered
     */
    isEmpty() {
        return this._boundsTracker.isEmpty();
    }

    /**
     * Get bounding box of covered pixels
     * @returns {Object} {minX, minY, maxX, maxY, isEmpty} bounds
     */
    getBounds() {
        return this._boundsTracker.getBounds();
    }

    /**
     * Get optimized iteration bounds clamped to surface and intersected with clipMask bounds if provided
     * @param {ClipMask|null} clipMask - Optional clip mask to intersect with
     * @param {boolean} isCanvasWideCompositing - True if this is for canvas-wide compositing operations
     * @returns {Object} {minX, minY, maxX, maxY, isEmpty} optimized iteration bounds
     */
    getIterationBounds(clipMask = null, isCanvasWideCompositing = false) {
        if (this._boundsTracker.isEmpty()) {
            return { minX: 0, minY: 0, maxX: -1, maxY: -1, isEmpty: true };
        }

        // For canvas-wide compositing operations, we need to process the entire surface
        // because destination pixels anywhere could be affected
        if (isCanvasWideCompositing) {
            if (clipMask && clipMask.hasClipping()) {
                // With clipping: process entire surface (clipping will filter pixels)
                return {
                    minX: 0,
                    minY: 0,
                    maxX: this.width - 1,
                    maxY: this.height - 1,
                    isEmpty: false
                };
            } else {
                // No clipping: process entire surface for canvas-wide operations
                return {
                    minX: 0,
                    minY: 0,
                    maxX: this.width - 1,
                    maxY: this.height - 1,
                    isEmpty: false
                };
            }
        }

        // For local compositing operations, use source bounds only
        const sourceBounds = this._boundsTracker.getBounds();
        const bounds = {
            minX: Math.max(0, sourceBounds.minX),
            minY: Math.max(0, sourceBounds.minY),
            maxX: Math.min(this.width - 1, sourceBounds.maxX),
            maxY: Math.min(this.height - 1, sourceBounds.maxY),
            isEmpty: false
        };

        return bounds;
    }

    /**
     * Create a pixel writer function for filling operations
     * @returns {Function} setPixel function optimized for coverage tracking
     */
    createPixelWriter() {
        return (x, y, coverage) => {
            // Bounds checking
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

            // Convert coverage to binary: >0.5 means covered, <=0.5 means not covered
            const isCovered = coverage > 0.5;
            this.setPixel(x, y, isCovered);
        };
    }

    /**
     * Get memory usage in bytes
     * @returns {number} Memory usage of the source mask
     */
    getMemoryUsage() {
        return this._bitBuffer.getMemoryUsage();
    }

    /**
     * String representation for debugging
     * @returns {string} SourceMask description
     */
    toString() {
        const memoryKB = (this.getMemoryUsage() / 1024).toFixed(2);
        const bounds = this._boundsTracker.getBounds();
        const boundsStr = bounds.isEmpty ? 'empty' : `(${bounds.minX},${bounds.minY})-(${bounds.maxX},${bounds.maxY})`;
        return `SourceMask(${this.width}×${this.height}, ${memoryKB}KB, bounds: ${boundsStr})`;
    }
}

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

/**
 * BoxBlur class for SWCanvas
 *
 * Implements multi-pass box blur using separable running sum approach for
 * efficient O(n) filtering. Multiple box blur passes approximate Gaussian blur
 * based on the Central Limit Theorem.
 *
 * An alternative Summed Area Table (SAT) implementation is also provided for
 * O(1) lookups at the cost of higher memory usage.
 *
 * This approach matches the reference implementation and provides good
 * performance characteristics for shadow blur effects.
 */
class BoxBlur {
    /**
     * Apply box blur to image data using multi-pass running sum approach
     * @param {Float32Array} data - Image data (alpha values 0-1)
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} blurRadius - Blur radius in pixels
     * @param {number} passes - Number of blur passes (default: 3)
     * @returns {Float32Array} Blurred image data
     */
    static blur(data, width, height, blurRadius, passes = 3) {
        // Validate parameters - internal assertions since BoxBlur is only called by ShadowBuffer
        if (IS_DEBUG) {
            if (!data || !(data instanceof Float32Array)) {
                throw new Error('BoxBlur requires Float32Array data');
            }
            if (typeof width !== 'number' || width <= 0 || typeof height !== 'number' || height <= 0) {
                throw new Error('BoxBlur width and height must be positive numbers');
            }
            if (data.length !== width * height) {
                throw new Error('BoxBlur data length must match width * height');
            }
            if (typeof blurRadius !== 'number' || blurRadius < 0) {
                throw new Error('BoxBlur radius must be a non-negative number');
            }
            if (typeof passes !== 'number' || passes < 1) {
                throw new Error('BoxBlur passes must be at least 1');
            }
        }

        // No blur needed for zero radius
        if (blurRadius === 0) {
            return new Float32Array(data); // Return copy
        }

        // Calculate equivalent box filter width for Gaussian approximation
        // Based on Central Limit Theorem: multiple box filters -> Gaussian
        const sigma = blurRadius / 2.0;
        const boxWidth = Math.floor(Math.max(Math.sqrt((12 * sigma * sigma) / passes + 1), 3));

        // Ensure odd width for symmetric filter
        const finalBoxWidth = boxWidth % 2 === 0 ? boxWidth + 1 : boxWidth;

        // Apply multiple blur passes
        let currentData = new Float32Array(data);

        for (let pass = 0; pass < passes; pass++) {
            currentData = BoxBlur._singleBoxBlurPass(currentData, width, height, finalBoxWidth);
        }

        return currentData;
    }

    /**
     * Apply single box blur pass using separable horizontal/vertical blurs
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} boxWidth - Box filter width (should be odd)
     * @returns {Float32Array} Blurred image data
     * @private
     */
    static _singleBoxBlurPass(data, width, height, boxWidth) {
        const halfBox = Math.floor(boxWidth / 2);

        // First pass: horizontal box blur
        const horizontalData = BoxBlur._horizontalBoxBlur(data, width, height, halfBox);

        // Second pass: vertical box blur on horizontally blurred data
        const verticalData = BoxBlur._verticalBoxBlur(horizontalData, width, height, halfBox);

        return verticalData;
    }

    /**
     * Apply horizontal box blur using running sum
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} radius - Half-width of box filter
     * @returns {Float32Array} Horizontally blurred data
     * @private
     */
    static _horizontalBoxBlur(data, width, height, radius) {
        const result = new Float32Array(data.length);

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;

            // Initialize running sum for first pixel
            let sum = 0;
            let count = 0;

            // Build initial sum
            for (let x = -radius; x <= radius; x++) {
                const srcX = Math.max(0, Math.min(width - 1, x));
                sum += data[rowOffset + srcX];
                count++;
            }

            result[rowOffset] = sum / count;

            // Slide the box across the row
            for (let x = 1; x < width; x++) {
                // Remove leftmost pixel from sum
                const leftX = Math.max(0, Math.min(width - 1, x - radius - 1));
                const rightX = Math.max(0, Math.min(width - 1, x + radius));

                if (x - radius - 1 >= 0) {
                    sum -= data[rowOffset + leftX];
                    count--;
                }

                if (x + radius < width) {
                    sum += data[rowOffset + rightX];
                    count++;
                }

                result[rowOffset + x] = sum / count;
            }
        }

        return result;
    }

    /**
     * Apply vertical box blur using running sum
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} radius - Half-height of box filter
     * @returns {Float32Array} Vertically blurred data
     * @private
     */
    static _verticalBoxBlur(data, width, height, radius) {
        const result = new Float32Array(data.length);

        for (let x = 0; x < width; x++) {
            // Initialize running sum for first pixel
            let sum = 0;
            let count = 0;

            // Build initial sum
            for (let y = -radius; y <= radius; y++) {
                const srcY = Math.max(0, Math.min(height - 1, y));
                sum += data[srcY * width + x];
                count++;
            }

            result[x] = sum / count;

            // Slide the box down the column
            for (let y = 1; y < height; y++) {
                // Remove topmost pixel from sum
                const topY = Math.max(0, Math.min(height - 1, y - radius - 1));
                const bottomY = Math.max(0, Math.min(height - 1, y + radius));

                if (y - radius - 1 >= 0) {
                    sum -= data[topY * width + x];
                    count--;
                }

                if (y + radius < height) {
                    sum += data[bottomY * width + x];
                    count++;
                }

                result[y * width + x] = sum / count;
            }
        }

        return result;
    }

    /**
     * Alternative implementation using full Summed Area Table
     * More memory intensive but demonstrates the SAT approach from reference
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} boxWidth - Box filter width
     * @returns {Float32Array} Blurred image data
     * @private
     */
    static _boxBlurWithSAT(data, width, height, boxWidth) {
        const halfBox = Math.floor(boxWidth / 2);

        // Build Summed Area Table
        const sat = BoxBlur._buildSAT(data, width, height);

        // Apply box filtering using SAT for O(1) lookups
        const result = new Float32Array(data.length);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate box bounds
                const x1 = Math.max(0, x - halfBox);
                const y1 = Math.max(0, y - halfBox);
                const x2 = Math.min(width - 1, x + halfBox);
                const y2 = Math.min(height - 1, y + halfBox);

                // Use SAT to calculate sum in O(1)
                const sum = BoxBlur._getSATSum(sat, width, x1, y1, x2, y2);
                const area = (x2 - x1 + 1) * (y2 - y1 + 1);

                result[y * width + x] = sum / area;
            }
        }

        return result;
    }

    /**
     * Build Summed Area Table for O(1) rectangular sum queries
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Float32Array} Summed Area Table
     * @private
     */
    static _buildSAT(data, width, height) {
        const sat = new Float32Array(width * height);

        // Fill first row
        sat[0] = data[0];
        for (let x = 1; x < width; x++) {
            sat[x] = data[x] + sat[x - 1];
        }

        // Fill remaining rows
        for (let y = 1; y < height; y++) {
            const rowOffset = y * width;
            const prevRowOffset = (y - 1) * width;

            // First column
            sat[rowOffset] = data[rowOffset] + sat[prevRowOffset];

            // Remaining columns
            for (let x = 1; x < width; x++) {
                sat[rowOffset + x] =
                    data[rowOffset + x] + sat[rowOffset + x - 1] + sat[prevRowOffset + x] - sat[prevRowOffset + x - 1];
            }
        }

        return sat;
    }

    /**
     * Get sum of rectangular region using SAT in O(1) time
     * @param {Float32Array} sat - Summed Area Table
     * @param {number} width - Image width
     * @param {number} x1 - Left boundary (inclusive)
     * @param {number} y1 - Top boundary (inclusive)
     * @param {number} x2 - Right boundary (inclusive)
     * @param {number} y2 - Bottom boundary (inclusive)
     * @returns {number} Sum of values in rectangle
     * @private
     */
    static _getSATSum(sat, width, x1, y1, x2, y2) {
        // Handle edge cases
        if (x1 > x2 || y1 > y2) return 0;

        const bottomRight = sat[y2 * width + x2];
        const topRight = y1 > 0 ? sat[(y1 - 1) * width + x2] : 0;
        const bottomLeft = x1 > 0 ? sat[y2 * width + (x1 - 1)] : 0;
        const topLeft = x1 > 0 && y1 > 0 ? sat[(y1 - 1) * width + (x1 - 1)] : 0;

        return bottomRight - topRight - bottomLeft + topLeft;
    }

    /**
     * Calculate optimal box width for Gaussian approximation
     * @param {number} sigma - Standard deviation of desired Gaussian
     * @param {number} passes - Number of box blur passes
     * @returns {number} Optimal box width (odd integer)
     */
    static calculateBoxWidth(sigma, passes) {
        const width = Math.floor(Math.sqrt((12 * sigma * sigma) / passes + 1));
        return width % 2 === 0 ? width + 1 : width;
    }
}

/**
 * ShadowPipeline class for SWCanvas
 *
 * Encapsulates shadow rendering pipeline logic extracted from Rasterizer.
 * Provides static methods to handle shadow rendering with clear parameter passing.
 *
 * Design rationale:
 * - Static methods: No instance overhead, pure functions
 * - Explicit parameters: Clear data flow without global state
 * - Delegates to existing ShadowBuffer/BoxBlur for actual work
 * - Encapsulates state management for temporary rendering
 */
class ShadowPipeline {
    /**
     * Check if shadows are needed for the given operation state
     * @param {Object} currentOp - Current operation state
     * @returns {boolean} True if shadows should be rendered
     */
    static needsShadow(currentOp) {
        if (!currentOp) return false;

        return (
            currentOp.shadowColor.a > 0 &&
            (currentOp.shadowBlur > 0 || currentOp.shadowOffsetX !== 0 || currentOp.shadowOffsetY !== 0)
        );
    }

    /**
     * Render with shadow support - main shadow pipeline entry point
     * @param {Rasterizer} rasterizer - The rasterizer to use for rendering
     * @param {Function} renderFunc - Function that performs the actual rendering
     */
    static renderWithShadow(rasterizer, renderFunc) {
        if (!ShadowPipeline.needsShadow(rasterizer.currentOp)) {
            // No shadow needed - render normally
            renderFunc();
            return;
        }

        // Shadow pipeline:
        // 1. Create shadow buffer
        // 2. Render shape alpha to shadow buffer
        // 3. Apply blur to shadow buffer
        // 4. Composite shadow to surface
        // 5. Render actual shape on top

        const surface = rasterizer.surface;
        const op = rasterizer.currentOp;
        const maxBlurRadius = Math.ceil(op.shadowBlur);
        const shadowBuffer = new ShadowBuffer(surface.width, surface.height, maxBlurRadius);

        // Step 1: Render shape to shadow buffer
        ShadowPipeline._renderToShadowBuffer(rasterizer, shadowBuffer, renderFunc);

        // Step 2: Apply blur if needed
        let blurredShadow = shadowBuffer;
        if (op.shadowBlur > 0) {
            blurredShadow = ShadowPipeline._applyShadowBlur(shadowBuffer, op.shadowBlur);
        }

        // Step 3: Composite shadow to surface
        ShadowPipeline._compositeShadowToSurface(
            surface,
            blurredShadow,
            op.shadowColor,
            op.shadowOffsetX,
            op.shadowOffsetY,
            op.globalAlpha,
            op.clipMask
        );

        // Step 4: Render actual shape on top
        renderFunc();
    }

    /**
     * Render shape alpha to shadow buffer
     * @param {Rasterizer} rasterizer - The rasterizer to use
     * @param {ShadowBuffer} shadowBuffer - Target shadow buffer
     * @param {Function} renderFunc - Function that performs the actual rendering
     * @private
     */
    static _renderToShadowBuffer(rasterizer, shadowBuffer, renderFunc) {
        const surface = rasterizer.surface;

        // Create a temporary surface to capture the shape
        const tempSurface = new Surface(surface.width, surface.height);

        // Create operation copy without shadow (to prevent infinite recursion)
        const opCopy = Object.assign({}, rasterizer.currentOp);
        opCopy.shadowColor = Color.transparent;
        opCopy.shadowBlur = 0;
        opCopy.shadowOffsetX = 0;
        opCopy.shadowOffsetY = 0;

        // Temporarily swap surface and operation state
        // This is necessary because renderFunc is bound to the original rasterizer
        const originalSurface = rasterizer._surface;
        const originalOp = rasterizer._currentOp;
        rasterizer._surface = tempSurface;
        rasterizer._currentOp = opCopy;

        try {
            renderFunc();
        } finally {
            // Restore original state
            rasterizer._surface = originalSurface;
            rasterizer._currentOp = originalOp;
        }

        // Extract alpha from temp surface to shadow buffer
        ShadowPipeline._extractAlphaToShadowBuffer(tempSurface, shadowBuffer);
    }

    /**
     * Extract alpha channel from surface to shadow buffer
     * @param {Surface} surface - Source surface
     * @param {ShadowBuffer} shadowBuffer - Target shadow buffer
     * @private
     */
    static _extractAlphaToShadowBuffer(surface, shadowBuffer) {
        for (let y = 0; y < surface.height; y++) {
            for (let x = 0; x < surface.width; x++) {
                const offset = y * surface.stride + x * 4;
                const alpha = surface.data[offset + 3] / 255.0; // Normalize to 0-1

                if (alpha > 0) {
                    shadowBuffer.addAlpha(x, y, alpha);
                }
            }
        }
    }

    /**
     * Apply blur to shadow buffer
     * @param {ShadowBuffer} shadowBuffer - Shadow buffer to blur
     * @param {number} blurRadius - Blur radius
     * @returns {ShadowBuffer} New blurred shadow buffer
     * @private
     */
    static _applyShadowBlur(shadowBuffer, blurRadius) {
        // Convert shadow buffer to dense array for blur processing
        const denseData = shadowBuffer.toDenseArray();

        if (denseData.width === 0 || denseData.height === 0) {
            return shadowBuffer; // Nothing to blur
        }

        // Apply box blur
        const blurredData = BoxBlur.blur(denseData.data, denseData.width, denseData.height, blurRadius);

        // Create new shadow buffer with blurred data
        const blurredBuffer = new ShadowBuffer(
            shadowBuffer.originalWidth,
            shadowBuffer.originalHeight,
            Math.ceil(blurRadius)
        );
        blurredBuffer.fromDenseArray(
            blurredData,
            denseData.width,
            denseData.height,
            denseData.offsetX,
            denseData.offsetY
        );

        return blurredBuffer;
    }

    /**
     * Composite shadow buffer to surface
     * @param {Surface} surface - Target surface
     * @param {ShadowBuffer} shadowBuffer - Shadow buffer to composite
     * @param {Color} shadowColor - Shadow color
     * @param {number} offsetX - Shadow X offset
     * @param {number} offsetY - Shadow Y offset
     * @param {number} globalAlpha - Global alpha value
     * @param {ClipMask} clipMask - Clipping mask (can be null)
     * @private
     */
    static _compositeShadowToSurface(surface, shadowBuffer, shadowColor, offsetX, offsetY, globalAlpha, clipMask) {
        // Apply global alpha to shadow color
        const effectiveShadowColor = shadowColor.withGlobalAlpha(globalAlpha);

        // Iterate over shadow pixels and composite to surface
        for (const pixel of shadowBuffer.getPixels()) {
            // Convert from extended buffer coordinates to surface coordinates
            const surfaceX = Math.round(pixel.x - shadowBuffer.extendedOffsetX + offsetX);
            const surfaceY = Math.round(pixel.y - shadowBuffer.extendedOffsetY + offsetY);

            // Bounds check
            if (surfaceX < 0 || surfaceX >= surface.width || surfaceY < 0 || surfaceY >= surface.height) {
                continue;
            }

            // Check clipping
            if (clipMask && clipMask.isPixelClipped(surfaceX, surfaceY)) {
                continue;
            }

            // Calculate final shadow alpha
            // The 8x multiplier compensates for alpha dilution caused by box blur averaging.
            // When blur spreads a single pixel over a larger area, the average alpha drops
            // significantly. The multiplier restores visual intensity to match HTML5 Canvas.
            const BLUR_DILUTION_COMPENSATION = 8;
            const finalShadowAlpha = Math.min(
                255,
                Math.round(pixel.alpha * effectiveShadowColor.a * BLUR_DILUTION_COMPENSATION)
            );

            if (finalShadowAlpha <= 0) continue;

            // Get surface pixel
            const offset = surfaceY * surface.stride + surfaceX * 4;
            const dstR = surface.data[offset];
            const dstG = surface.data[offset + 1];
            const dstB = surface.data[offset + 2];
            const dstA = surface.data[offset + 3];

            // Composite shadow (always uses source-over blending per HTML5 spec)
            const result = CompositeOperations.blendPixel(
                'source-over',
                effectiveShadowColor.r,
                effectiveShadowColor.g,
                effectiveShadowColor.b,
                finalShadowAlpha,
                dstR,
                dstG,
                dstB,
                dstA
            );

            // Write result
            surface.data[offset] = result.r;
            surface.data[offset + 1] = result.g;
            surface.data[offset + 2] = result.b;
            surface.data[offset + 3] = result.a;
        }
    }
}

/**
 * ImageProcessor class for SWCanvas
 *
 * Handles ImageLike interface validation and format conversions.
 * Provides static methods following Joshua Bloch's principle of
 * using static methods for stateless utility operations.
 */
class ImageProcessor {
    /**
     * Validate and convert ImageLike object to standardized RGBA format
     * @param {Object} imageLike - ImageLike object to validate and convert
     * @returns {Object} Validated and converted image data
     */
    static validateAndConvert(imageLike) {
        ImageProcessor._validateImageLike(imageLike);

        const expectedRGBLength = imageLike.width * imageLike.height * 3;
        const expectedRGBALength = imageLike.width * imageLike.height * 4;

        if (imageLike.data.length === expectedRGBLength) {
            return ImageProcessor._convertRGBToRGBA(imageLike);
        } else if (imageLike.data.length === expectedRGBALength) {
            // Already RGBA - return as-is with validation
            return {
                width: imageLike.width,
                height: imageLike.height,
                data: imageLike.data
            };
        } else {
            throw new Error(
                `ImageLike data length (${imageLike.data.length}) must match ` +
                    `width*height*3 (${expectedRGBLength}) for RGB or ` +
                    `width*height*4 (${expectedRGBALength}) for RGBA`
            );
        }
    }

    /**
     * Validate basic ImageLike interface properties
     * @param {Object} imageLike - Object to validate
     * @private
     */
    static _validateImageLike(imageLike) {
        Validators.defined(imageLike, 'ImageLike');
        Validators.positiveInteger(imageLike.width, 'ImageLike width');
        Validators.positiveInteger(imageLike.height, 'ImageLike height');
        Validators.instanceOf(imageLike.data, Uint8ClampedArray, 'ImageLike data');

        // Additional validation for reasonable limits
        const maxDimension = 16384;
        if (imageLike.width > maxDimension || imageLike.height > maxDimension) {
            throw new Error(`ImageLike dimensions must be ≤ ${maxDimension}x${maxDimension}`);
        }
    }

    /**
     * Convert RGB image data to RGBA format
     * @param {Object} rgbImage - RGB ImageLike object
     * @returns {Object} RGBA ImageLike object
     * @private
     */
    static _convertRGBToRGBA(rgbImage) {
        const expectedRGBALength = rgbImage.width * rgbImage.height * 4;
        const rgbaData = new Uint8ClampedArray(expectedRGBALength);

        // RGB to RGBA conversion - append alpha = 255 to each pixel
        for (let i = 0; i < rgbImage.width * rgbImage.height; i++) {
            const rgbOffset = i * 3;
            const rgbaOffset = i * 4;

            rgbaData[rgbaOffset] = rgbImage.data[rgbOffset]; // R
            rgbaData[rgbaOffset + 1] = rgbImage.data[rgbOffset + 1]; // G
            rgbaData[rgbaOffset + 2] = rgbImage.data[rgbOffset + 2]; // B
            rgbaData[rgbaOffset + 3] = 255; // A = fully opaque
        }

        return {
            width: rgbImage.width,
            height: rgbImage.height,
            data: rgbaData
        };
    }

    /**
     * Convert Surface to ImageLike format
     * @param {Surface} surface - Surface to convert
     * @returns {Object} ImageLike representation of surface
     */
    static surfaceToImageLike(surface) {
        Validators.defined(surface, 'Surface');
        Validators.defined(surface.width, 'Surface.width');
        Validators.defined(surface.height, 'Surface.height');
        Validators.defined(surface.data, 'Surface.data');

        return {
            width: surface.width,
            height: surface.height,
            data: new Uint8ClampedArray(surface.data) // Create copy for safety
        };
    }

    /**
     * Create a blank ImageLike object filled with specified color
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {Color|Array} fillColor - Color to fill with (Color instance or RGBA array)
     * @returns {Object} ImageLike object
     */
    static createBlankImage(width, height, fillColor = [0, 0, 0, 255]) {
        Validators.positiveInteger(width, 'width');
        Validators.positiveInteger(height, 'height');

        const numPixels = width * height;
        const data = new Uint8ClampedArray(numPixels * 4);

        // Determine RGBA values
        let r, g, b, a;
        if (fillColor instanceof Color) {
            const rgba = fillColor.toRGBA();
            r = rgba[0];
            g = rgba[1];
            b = rgba[2];
            a = rgba[3];
        } else if (Array.isArray(fillColor) && fillColor.length >= 4) {
            r = fillColor[0];
            g = fillColor[1];
            b = fillColor[2];
            a = fillColor[3];
        } else {
            throw new Error('fillColor must be a Color instance or RGBA array');
        }

        // Fill image with specified color
        for (let i = 0; i < numPixels; i++) {
            const offset = i * 4;
            data[offset] = r;
            data[offset + 1] = g;
            data[offset + 2] = b;
            data[offset + 3] = a;
        }

        return {
            width,
            height,
            data
        };
    }

    /**
     * Extract a rectangular region from an ImageLike object
     * @param {Object} source - Source ImageLike object
     * @param {number} x - Source x coordinate
     * @param {number} y - Source y coordinate
     * @param {number} width - Region width
     * @param {number} height - Region height
     * @returns {Object} New ImageLike object containing the extracted region
     */
    static extractRegion(source, x, y, width, height) {
        const validated = ImageProcessor.validateAndConvert(source);

        // Validate extraction bounds
        if (x < 0 || y < 0 || x + width > validated.width || y + height > validated.height) {
            throw new Error('Extraction region exceeds source image bounds');
        }

        if (width <= 0 || height <= 0) {
            throw new Error('Extraction region dimensions must be positive');
        }

        const extractedData = new Uint8ClampedArray(width * height * 4);

        // Copy pixel data row by row
        for (let row = 0; row < height; row++) {
            const sourceRowStart = ((y + row) * validated.width + x) * 4;
            const destRowStart = row * width * 4;
            const rowLength = width * 4;

            extractedData.set(validated.data.subarray(sourceRowStart, sourceRowStart + rowLength), destRowStart);
        }

        return {
            width,
            height,
            data: extractedData
        };
    }

    /**
     * Scale an ImageLike object using nearest-neighbor interpolation
     * @param {Object} source - Source ImageLike object
     * @param {number} newWidth - Target width
     * @param {number} newHeight - Target height
     * @returns {Object} Scaled ImageLike object
     */
    static scaleImage(source, newWidth, newHeight) {
        const validated = ImageProcessor.validateAndConvert(source);

        Validators.positiveInteger(newWidth, 'newWidth');
        Validators.positiveInteger(newHeight, 'newHeight');

        const scaledData = new Uint8ClampedArray(newWidth * newHeight * 4);
        const scaleX = validated.width / newWidth;
        const scaleY = validated.height / newHeight;

        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                // Nearest-neighbor sampling
                const sourceX = Math.floor(x * scaleX);
                const sourceY = Math.floor(y * scaleY);

                // Clamp to source bounds (shouldn't be necessary with correct scaling)
                const clampedX = Math.min(sourceX, validated.width - 1);
                const clampedY = Math.min(sourceY, validated.height - 1);

                const sourceOffset = (clampedY * validated.width + clampedX) * 4;
                const destOffset = (y * newWidth + x) * 4;

                // Copy RGBA values
                scaledData[destOffset] = validated.data[sourceOffset];
                scaledData[destOffset + 1] = validated.data[sourceOffset + 1];
                scaledData[destOffset + 2] = validated.data[sourceOffset + 2];
                scaledData[destOffset + 3] = validated.data[sourceOffset + 3];
            }
        }

        return {
            width: newWidth,
            height: newHeight,
            data: scaledData
        };
    }

    /**
     * Check if an object conforms to the ImageLike interface
     * @param {*} obj - Object to check
     * @returns {boolean} True if object is ImageLike-compatible
     */
    static isImageLike(obj) {
        try {
            ImageProcessor._validateImageLike(obj);

            const expectedRGBLength = obj.width * obj.height * 3;
            const expectedRGBALength = obj.width * obj.height * 4;

            return obj.data.length === expectedRGBLength || obj.data.length === expectedRGBALength;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get information about an ImageLike object
     * @param {Object} imageLike - ImageLike object to analyze
     * @returns {Object} Information about the image
     */
    static getImageInfo(imageLike) {
        const validated = ImageProcessor.validateAndConvert(imageLike);
        const isRGB = imageLike.data.length === imageLike.width * imageLike.height * 3;

        return {
            width: validated.width,
            height: validated.height,
            pixelCount: validated.width * validated.height,
            format: isRGB ? 'RGB' : 'RGBA',
            dataSize: validated.data.length,
            bytesPerPixel: isRGB ? 3 : 4,
            memoryUsage: validated.data.byteLength
        };
    }

    /**
     * Convert HTMLCanvasElement to ImageLike format
     * @param {HTMLCanvasElement} canvas - HTML canvas element to convert
     * @returns {Object} ImageLike representation of canvas
     */
    static fromCanvas(canvas) {
        Validators.defined(canvas, 'Canvas');
        Validators.number(canvas.width, 'Canvas.width');
        Validators.number(canvas.height, 'Canvas.height');

        if (!canvas.getContext || typeof canvas.getContext !== 'function') {
            throw new Error('Canvas must have getContext method');
        }

        try {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            return {
                width: canvas.width,
                height: canvas.height,
                data: new Uint8ClampedArray(imageData.data)
            };
        } catch (error) {
            throw new Error(`Failed to extract canvas data: ${error.message}`);
        }
    }
}

/**
 * ColorParser for SWCanvas
 *
 * Parses CSS color strings into RGBA values for use with Core API.
 * Supports hex, RGB/RGBA functions, and named colors.
 * Includes caching for performance optimization.
 *
 * All colors are interpreted as sRGB (no gamma correction applied,
 * matching HTML5 Canvas behavior).
 */
class ColorParser {
    constructor() {
        this._cache = new Map();

        // CSS Color names to RGB mapping - Complete MDN specification
        this._namedColors = {
            // CSS Level 1 colors
            black: { r: 0, g: 0, b: 0 },
            silver: { r: 192, g: 192, b: 192 },
            gray: { r: 128, g: 128, b: 128 },
            white: { r: 255, g: 255, b: 255 },
            maroon: { r: 128, g: 0, b: 0 },
            red: { r: 255, g: 0, b: 0 },
            purple: { r: 128, g: 0, b: 128 },
            fuchsia: { r: 255, g: 0, b: 255 },
            green: { r: 0, g: 128, b: 0 },
            lime: { r: 0, g: 255, b: 0 },
            olive: { r: 128, g: 128, b: 0 },
            yellow: { r: 255, g: 255, b: 0 },
            navy: { r: 0, g: 0, b: 128 },
            blue: { r: 0, g: 0, b: 255 },
            teal: { r: 0, g: 128, b: 128 },
            aqua: { r: 0, g: 255, b: 255 },

            // CSS Level 2 (X11) colors
            aliceblue: { r: 240, g: 248, b: 255 },
            antiquewhite: { r: 250, g: 235, b: 215 },
            aquamarine: { r: 127, g: 255, b: 212 },
            azure: { r: 240, g: 255, b: 255 },
            beige: { r: 245, g: 245, b: 220 },
            bisque: { r: 255, g: 228, b: 196 },
            blanchedalmond: { r: 255, g: 235, b: 205 },
            blueviolet: { r: 138, g: 43, b: 226 },
            brown: { r: 165, g: 42, b: 42 },
            burlywood: { r: 222, g: 184, b: 135 },
            cadetblue: { r: 95, g: 158, b: 160 },
            chartreuse: { r: 127, g: 255, b: 0 },
            chocolate: { r: 210, g: 105, b: 30 },
            coral: { r: 255, g: 127, b: 80 },
            cornflowerblue: { r: 100, g: 149, b: 237 },
            cornsilk: { r: 255, g: 248, b: 220 },
            crimson: { r: 220, g: 20, b: 60 },
            cyan: { r: 0, g: 255, b: 255 }, // synonym of aqua
            darkblue: { r: 0, g: 0, b: 139 },
            darkcyan: { r: 0, g: 139, b: 139 },
            darkgoldenrod: { r: 184, g: 134, b: 11 },
            darkgray: { r: 169, g: 169, b: 169 },
            darkgreen: { r: 0, g: 100, b: 0 },
            darkgrey: { r: 169, g: 169, b: 169 }, // synonym of darkgray
            darkkhaki: { r: 189, g: 183, b: 107 },
            darkmagenta: { r: 139, g: 0, b: 139 },
            darkolivegreen: { r: 85, g: 107, b: 47 },
            darkorange: { r: 255, g: 140, b: 0 },
            darkorchid: { r: 153, g: 50, b: 204 },
            darkred: { r: 139, g: 0, b: 0 },
            darksalmon: { r: 233, g: 150, b: 122 },
            darkseagreen: { r: 143, g: 188, b: 143 },
            darkslateblue: { r: 72, g: 61, b: 139 },
            darkslategray: { r: 47, g: 79, b: 79 },
            darkslategrey: { r: 47, g: 79, b: 79 }, // synonym of darkslategray
            darkturquoise: { r: 0, g: 206, b: 209 },
            darkviolet: { r: 148, g: 0, b: 211 },
            deeppink: { r: 255, g: 20, b: 147 },
            deepskyblue: { r: 0, g: 191, b: 255 },
            dimgray: { r: 105, g: 105, b: 105 },
            dimgrey: { r: 105, g: 105, b: 105 }, // synonym of dimgray
            dodgerblue: { r: 30, g: 144, b: 255 },
            firebrick: { r: 178, g: 34, b: 34 },
            floralwhite: { r: 255, g: 250, b: 240 },
            forestgreen: { r: 34, g: 139, b: 34 },
            gainsboro: { r: 220, g: 220, b: 220 },
            ghostwhite: { r: 248, g: 248, b: 255 },
            gold: { r: 255, g: 215, b: 0 },
            goldenrod: { r: 218, g: 165, b: 32 },
            grey: { r: 128, g: 128, b: 128 }, // synonym of gray
            greenyellow: { r: 173, g: 255, b: 47 },
            honeydew: { r: 240, g: 255, b: 240 },
            hotpink: { r: 255, g: 105, b: 180 },
            indianred: { r: 205, g: 92, b: 92 },
            indigo: { r: 75, g: 0, b: 130 },
            ivory: { r: 255, g: 255, b: 240 },
            khaki: { r: 240, g: 230, b: 140 },
            lavender: { r: 230, g: 230, b: 250 },
            lavenderblush: { r: 255, g: 240, b: 245 },
            lawngreen: { r: 124, g: 252, b: 0 },
            lemonchiffon: { r: 255, g: 250, b: 205 },
            lightblue: { r: 173, g: 216, b: 230 },
            lightcoral: { r: 240, g: 128, b: 128 },
            lightcyan: { r: 224, g: 255, b: 255 },
            lightgoldenrodyellow: { r: 250, g: 250, b: 210 },
            lightgray: { r: 211, g: 211, b: 211 },
            lightgreen: { r: 144, g: 238, b: 144 },
            lightgrey: { r: 211, g: 211, b: 211 }, // synonym of lightgray
            lightpink: { r: 255, g: 182, b: 193 },
            lightsalmon: { r: 255, g: 160, b: 122 },
            lightseagreen: { r: 32, g: 178, b: 170 },
            lightskyblue: { r: 135, g: 206, b: 250 },
            lightslategray: { r: 119, g: 136, b: 153 },
            lightslategrey: { r: 119, g: 136, b: 153 }, // synonym of lightslategray
            lightsteelblue: { r: 176, g: 196, b: 222 },
            lightyellow: { r: 255, g: 255, b: 224 },
            limegreen: { r: 50, g: 205, b: 50 },
            linen: { r: 250, g: 240, b: 230 },
            magenta: { r: 255, g: 0, b: 255 }, // synonym of fuchsia
            mediumaquamarine: { r: 102, g: 205, b: 170 },
            mediumblue: { r: 0, g: 0, b: 205 },
            mediumorchid: { r: 186, g: 85, b: 211 },
            mediumpurple: { r: 147, g: 112, b: 219 },
            mediumseagreen: { r: 60, g: 179, b: 113 },
            mediumslateblue: { r: 123, g: 104, b: 238 },
            mediumspringgreen: { r: 0, g: 250, b: 154 },
            mediumturquoise: { r: 72, g: 209, b: 204 },
            mediumvioletred: { r: 199, g: 21, b: 133 },
            midnightblue: { r: 25, g: 25, b: 112 },
            mintcream: { r: 245, g: 255, b: 250 },
            mistyrose: { r: 255, g: 228, b: 225 },
            moccasin: { r: 255, g: 228, b: 181 },
            navajowhite: { r: 255, g: 222, b: 173 },
            oldlace: { r: 253, g: 245, b: 230 },
            olivedrab: { r: 107, g: 142, b: 35 },
            orange: { r: 255, g: 165, b: 0 },
            orangered: { r: 255, g: 69, b: 0 },
            orchid: { r: 218, g: 112, b: 214 },
            palegoldenrod: { r: 238, g: 232, b: 170 },
            palegreen: { r: 152, g: 251, b: 152 },
            paleturquoise: { r: 175, g: 238, b: 238 },
            palevioletred: { r: 219, g: 112, b: 147 },
            papayawhip: { r: 255, g: 239, b: 213 },
            peachpuff: { r: 255, g: 218, b: 185 },
            peru: { r: 205, g: 133, b: 63 },
            pink: { r: 255, g: 192, b: 203 },
            plum: { r: 221, g: 160, b: 221 },
            powderblue: { r: 176, g: 224, b: 230 },
            rebeccapurple: { r: 102, g: 51, b: 153 }, // CSS Level 4
            rosybrown: { r: 188, g: 143, b: 143 },
            royalblue: { r: 65, g: 105, b: 225 },
            saddlebrown: { r: 139, g: 69, b: 19 },
            salmon: { r: 250, g: 128, b: 114 },
            sandybrown: { r: 244, g: 164, b: 96 },
            seagreen: { r: 46, g: 139, b: 87 },
            seashell: { r: 255, g: 245, b: 238 },
            sienna: { r: 160, g: 82, b: 45 },
            skyblue: { r: 135, g: 206, b: 235 },
            slateblue: { r: 106, g: 90, b: 205 },
            slategray: { r: 112, g: 128, b: 144 },
            slategrey: { r: 112, g: 128, b: 144 }, // synonym of slategray
            snow: { r: 255, g: 250, b: 250 },
            springgreen: { r: 0, g: 255, b: 127 },
            steelblue: { r: 70, g: 130, b: 180 },
            tan: { r: 210, g: 180, b: 140 },
            thistle: { r: 216, g: 191, b: 216 },
            tomato: { r: 255, g: 99, b: 71 },
            turquoise: { r: 64, g: 224, b: 208 },
            violet: { r: 238, g: 130, b: 238 },
            wheat: { r: 245, g: 222, b: 179 },
            whitesmoke: { r: 245, g: 245, b: 245 },
            yellowgreen: { r: 154, g: 205, b: 50 }
        };
    }

    /**
     * Parse a CSS color string to RGBA values
     * @param {string} color - CSS color string
     * @returns {Object} {r, g, b, a} with values 0-255
     */
    parse(color) {
        // Check cache first
        if (this._cache.has(color)) {
            return this._cache.get(color);
        }

        let result;

        if (typeof color !== 'string') {
            result = { r: 0, g: 0, b: 0, a: 255 };
        } else {
            const trimmed = color.trim().toLowerCase();

            if (trimmed.startsWith('#')) {
                result = this._parseHex(trimmed);
            } else if (trimmed.startsWith('rgb')) {
                result = this._parseRGB(trimmed);
            } else if (this._namedColors[trimmed]) {
                const named = this._namedColors[trimmed];
                result = { r: named.r, g: named.g, b: named.b, a: 255 };
            } else {
                // Unknown color - default to black
                result = { r: 0, g: 0, b: 0, a: 255 };
            }
        }

        // Cache the result
        this._cache.set(color, result);
        return result;
    }

    /**
     * Parse hex color (#RGB, #RRGGBB, #RRGGBBAA)
     * @private
     */
    _parseHex(hex) {
        // Remove the #
        hex = hex.substring(1);

        if (hex.length === 3) {
            // #RGB -> #RRGGBB
            hex = hex
                .split('')
                .map(c => c + c)
                .join('');
        }

        if (hex.length === 6) {
            // #RRGGBB
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return { r, g, b, a: 255 };
        } else if (hex.length === 8) {
            // #RRGGBBAA
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const a = parseInt(hex.substring(6, 8), 16);
            return { r, g, b, a };
        }

        // Invalid hex - default to black
        return { r: 0, g: 0, b: 0, a: 255 };
    }

    /**
     * Parse RGB/RGBA function notation
     * @private
     */
    _parseRGB(rgb) {
        // Extract the content inside parentheses
        const match = rgb.match(/rgba?\s*\(\s*([^)]+)\s*\)/);
        if (!match) {
            return { r: 0, g: 0, b: 0, a: 255 };
        }

        const parts = match[1].split(',').map(s => s.trim());

        if (parts.length < 3) {
            return { r: 0, g: 0, b: 0, a: 255 };
        }

        const r = Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0));
        const g = Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0));
        const b = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));

        let a = 255;
        if (parts.length >= 4) {
            const alpha = parseFloat(parts[3]);
            if (!isNaN(alpha)) {
                a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
            }
        }

        return { r, g, b, a };
    }

    /**
     * Clear the color cache
     */
    clearCache() {
        this._cache.clear();
    }
}

/**
 * Gradient classes for SWCanvas
 *
 * Implements HTML5 Canvas gradient support with deterministic rendering.
 * Follows SWCanvas's immutable object-oriented design principles.
 *
 * Gradients are paint sources that can replace solid colors in fillStyle/strokeStyle.
 * They work in canvas coordinate space and are affected by current transform.
 */

/**
 * Base Gradient class
 * Abstract base class for all gradient types
 */
class Gradient {
    /**
     * Create a Gradient
     * @private - Use specific gradient factory methods instead
     */
    constructor() {
        this._colorStops = [];
        this._sorted = false;
    }

    /**
     * Add a color stop to the gradient
     * @param {number} offset - Position along gradient (0-1)
     * @param {string} color - CSS color string
     */
    addColorStop(offset, color) {
        // Validate offset
        Validators.normalizedValue(offset, 'Color stop offset');

        // Parse color using ColorParser
        const colorParser = new ColorParser();
        const rgba = colorParser.parse(color);
        const colorObj = new Color(rgba.r, rgba.g, rgba.b, rgba.a);

        // Add color stop
        this._colorStops.push({
            offset: offset,
            color: colorObj
        });

        this._sorted = false; // Mark as needing re-sort
    }

    /**
     * Get sorted color stops array
     * @returns {Array} Sorted color stops
     * @private
     */
    _getSortedColorStops() {
        if (!this._sorted) {
            this._colorStops.sort((a, b) => a.offset - b.offset);
            this._sorted = true;
        }
        return this._colorStops;
    }

    /**
     * Get color at parameter t using color stops
     * @param {number} t - Parameter value (0-1, but can be outside range)
     * @returns {Color} Color at parameter t
     * @private
     */
    _getColorAt(t) {
        const stops = this._getSortedColorStops();

        if (stops.length === 0) {
            return Color.transparent; // Transparent black
        }

        if (stops.length === 1) {
            return stops[0].color;
        }

        // Clamp t to [0, 1] range for gradient bounds
        if (t <= stops[0].offset) {
            return stops[0].color;
        }

        if (t >= stops[stops.length - 1].offset) {
            return stops[stops.length - 1].color;
        }

        // Find adjacent color stops
        for (let i = 0; i < stops.length - 1; i++) {
            const stop1 = stops[i];
            const stop2 = stops[i + 1];

            if (t >= stop1.offset && t <= stop2.offset) {
                // Linear interpolation between color stops
                const range = stop2.offset - stop1.offset;
                if (range === 0) {
                    return stop1.color;
                }

                const localT = (t - stop1.offset) / range;

                // Interpolate RGBA components
                const r1 = stop1.color.r,
                    g1 = stop1.color.g,
                    b1 = stop1.color.b,
                    a1 = stop1.color.a;
                const r2 = stop2.color.r,
                    g2 = stop2.color.g,
                    b2 = stop2.color.b,
                    a2 = stop2.color.a;

                const r = Math.round(r1 + (r2 - r1) * localT);
                const g = Math.round(g1 + (g2 - g1) * localT);
                const b = Math.round(b1 + (b2 - b1) * localT);
                const a = Math.round(a1 + (a2 - a1) * localT);

                return new Color(r, g, b, a);
            }
        }

        // Fallback (shouldn't reach here)
        return stops[0].color;
    }

    /**
     * Calculate color for a pixel position (must be implemented by subclasses)
     * Subclasses should use the transform to map pixel coordinates to gradient space.
     * @param {number} x - Pixel x coordinate in canvas space (integer)
     * @param {number} y - Pixel y coordinate in canvas space (integer)
     * @param {Transform2D} transform - Current canvas transform (used to invert pixel to gradient coords)
     * @returns {Color} Color for this pixel (non-null Color instance)
     * @abstract
     */
    getColorForPixel(x, y, transform) {
        throw new Error('getColorForPixel must be implemented by subclass');
    }
}

/**
 * Linear Gradient implementation
 */
class LinearGradient extends Gradient {
    /**
     * Create a LinearGradient
     * @param {number} x0 - Start point x
     * @param {number} y0 - Start point y
     * @param {number} x1 - End point x
     * @param {number} y1 - End point y
     */
    constructor(x0, y0, x1, y1) {
        super();

        this._x0 = x0;
        this._y0 = y0;
        this._x1 = x1;
        this._y1 = y1;

        // Pre-compute gradient vector
        this._dx = x1 - x0;
        this._dy = y1 - y0;
        this._lengthSquared = this._dx * this._dx + this._dy * this._dy;
    }

    /**
     * Calculate color for a pixel position
     * @param {number} x - Pixel x coordinate in canvas space
     * @param {number} y - Pixel y coordinate in canvas space
     * @param {Transform2D} transform - Current canvas transform (applied to gradient)
     * @returns {Color} Color for this pixel
     */
    getColorForPixel(x, y, transform) {
        // Transform gradient coordinates by current transform
        // Gradients work in transformed coordinate space
        const p0 = transform.transformPoint(new Point(this._x0, this._y0));
        const p1 = transform.transformPoint(new Point(this._x1, this._y1));

        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            // Degenerate gradient (same start/end points)
            return this._getColorAt(0);
        }

        // Calculate parameter t along gradient line
        // Project pixel onto gradient line
        const px = x - p0.x;
        const py = y - p0.y;
        const t = (px * dx + py * dy) / lengthSquared;

        return this._getColorAt(t);
    }
}

/**
 * Radial Gradient implementation
 */
class RadialGradient extends Gradient {
    /**
     * Create a RadialGradient
     * @param {number} x0 - Inner circle center x
     * @param {number} y0 - Inner circle center y
     * @param {number} r0 - Inner circle radius
     * @param {number} x1 - Outer circle center x
     * @param {number} y1 - Outer circle center y
     * @param {number} r1 - Outer circle radius
     */
    constructor(x0, y0, r0, x1, y1, r1) {
        super();

        // Validate radii
        Validators.nonNegative(r0, 'Inner radius');
        Validators.nonNegative(r1, 'Outer radius');

        // Check for identical circles (would paint nothing)
        if (x0 === x1 && y0 === y1 && r0 === r1) {
            throw new Error('Radial gradient circles must not be identical');
        }

        this._x0 = x0;
        this._y0 = y0;
        this._r0 = r0;
        this._x1 = x1;
        this._y1 = y1;
        this._r1 = r1;
    }

    /**
     * Calculate color for a pixel position
     * @param {number} x - Pixel x coordinate in canvas space
     * @param {number} y - Pixel y coordinate in canvas space
     * @param {Transform2D} transform - Current canvas transform
     * @returns {Color} Color for this pixel
     */
    getColorForPixel(x, y, transform) {
        // Transform gradient coordinates by current transform
        const p0 = transform.transformPoint(new Point(this._x0, this._y0));
        const p1 = transform.transformPoint(new Point(this._x1, this._y1));

        // For simplicity, we'll use distance-based calculation
        // More accurate would be solving the cone intersection equation
        const d0 = Math.sqrt((x - p0.x) ** 2 + (y - p0.y) ** 2);
        const d1 = Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2);

        // Simple linear interpolation based on distance ratio
        const maxDistance = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2) + this._r1;

        let t;
        if (d0 <= this._r0) {
            t = 0; // Inside inner circle
        } else if (d1 >= this._r1) {
            t = 1; // Outside outer circle
        } else {
            // Simple distance-based calculation
            t = (d0 - this._r0) / (maxDistance - this._r0);
        }

        return this._getColorAt(Math.max(0, Math.min(1, t)));
    }
}

/**
 * Conic Gradient implementation
 */
class ConicGradient extends Gradient {
    /**
     * Create a ConicGradient
     * @param {number} angle - Starting angle in radians
     * @param {number} x - Center point x
     * @param {number} y - Center point y
     */
    constructor(angle, x, y) {
        super();

        this._angle = angle;
        this._x = x;
        this._y = y;
    }

    /**
     * Calculate color for a pixel position
     * @param {number} x - Pixel x coordinate in canvas space
     * @param {number} y - Pixel y coordinate in canvas space
     * @param {Transform2D} transform - Current canvas transform
     * @returns {Color} Color for this pixel
     */
    getColorForPixel(x, y, transform) {
        // Transform gradient center by current transform
        const center = transform.transformPoint(new Point(this._x, this._y));

        // Calculate angle from center to pixel
        let pixelAngle = Math.atan2(y - center.y, x - center.x) - this._angle;

        // Normalize angle to [0, 2π)
        while (pixelAngle < 0) {
            pixelAngle += TAU;
        }
        while (pixelAngle >= TAU) {
            pixelAngle -= TAU;
        }

        // Convert angle to parameter t [0, 1]
        const t = pixelAngle / TAU;

        return this._getColorAt(t);
    }
}

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

/**
 * Rasterizer class for SWCanvas
 *
 * Handles low-level pixel operations and rendering pipeline.
 * Converted to ES6 class following Joshua Bloch's effective OO principles.
 * Encapsulates rendering state and provides clear separation of concerns.
 */
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
            fillStyle: params.fillStyle || null,
            strokeStyle: params.strokeStyle || null,
            sourceMask: null, // Will be initialized if needed for canvas-wide compositing
            // Shadow properties
            shadowColor: params.shadowColor || Color.transparent,
            shadowBlur: params.shadowBlur || 0,
            shadowOffsetX: params.shadowOffsetX || 0,
            shadowOffsetY: params.shadowOffsetY || 0
        };

        // Initialize source mask for global-effect operations
        if (this._requiresCanvasWideCompositing(this._currentOp.composite)) {
            this._currentOp.sourceMask = new SourceMask(this._surface.width, this._surface.height);
        }
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
        const globalOps = ['destination-atop', 'destination-in', 'source-in', 'source-out', 'copy'];
        return globalOps.includes(operation);
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
                this._currentOp.composite
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
                this._currentOp.sourceMask
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
                this._currentOp.composite
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
                this._currentOp.sourceMask
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
                this._currentOp.composite
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
        const minX = Math.max(0, Math.floor(Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)));
        const maxX = Math.min(
            this._surface.width - 1,
            Math.ceil(Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x))
        );
        const minY = Math.max(0, Math.floor(Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)));
        const maxY = Math.min(
            this._surface.height - 1,
            Math.ceil(Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y))
        );

        // Get inverse transform for mapping device pixels back to source
        const inverseTransform = transform.invert();

        const globalAlpha = this._currentOp.globalAlpha;

        // Render each pixel in the bounding box
        for (let deviceY = minY; deviceY <= maxY; deviceY++) {
            for (let deviceX = minX; deviceX <= maxX; deviceX++) {
                // Check stencil clipping
                if (this._currentOp.clipMask && this._isPixelClipped(deviceX, deviceY)) {
                    continue;
                }

                // Transform device pixel back to destination space
                const destPoint = inverseTransform.transformPoint({ x: deviceX, y: deviceY });

                // Check if we're inside the destination rectangle
                if (
                    destPoint.x < destX ||
                    destPoint.x >= destX + destWidth ||
                    destPoint.y < destY ||
                    destPoint.y >= destY + destHeight
                ) {
                    continue;
                }

                // Map destination coordinates to source coordinates
                const sourceXf = sourceX + ((destPoint.x - destX) / destWidth) * sourceWidth;
                const sourceYf = sourceY + ((destPoint.y - destY) / destHeight) * sourceHeight;

                // Nearest-neighbor sampling
                const sourcePX = Math.floor(sourceXf);
                const sourcePY = Math.floor(sourceYf);

                // Bounds check for source coordinates
                if (sourcePX < 0 || sourcePY < 0 || sourcePX >= imageData.width || sourcePY >= imageData.height) {
                    continue;
                }

                // Sample source pixel
                const sourceOffset = (sourcePY * imageData.width + sourcePX) * 4;
                const srcR = imageData.data[sourceOffset];
                const srcG = imageData.data[sourceOffset + 1];
                const srcB = imageData.data[sourceOffset + 2];
                const srcA = imageData.data[sourceOffset + 3];

                // Apply global alpha
                const effectiveAlpha = (srcA / 255) * globalAlpha;
                const finalSrcA = Math.round(effectiveAlpha * 255);

                // Skip transparent pixels
                if (finalSrcA === 0) continue;

                // Get destination pixel for blending
                const destOffset = deviceY * this._surface.stride + deviceX * 4;

                // Get destination pixel for blending
                const dstR = this._surface.data[destOffset];
                const dstG = this._surface.data[destOffset + 1];
                const dstB = this._surface.data[destOffset + 2];
                const dstA = this._surface.data[destOffset + 3];

                // Use CompositeOperations for consistent blending
                const result = CompositeOperations.blendPixel(
                    this._currentOp.composite,
                    srcR,
                    srcG,
                    srcB,
                    finalSrcA, // source
                    dstR,
                    dstG,
                    dstB,
                    dstA // destination
                );

                this._surface.data[destOffset] = result.r;
                this._surface.data[destOffset + 1] = result.g;
                this._surface.data[destOffset + 2] = result.b;
                this._surface.data[destOffset + 3] = result.a;
            }
        }
    }
}

/**
 * STENCIL-BASED CLIPPING SYSTEM
 *
 * SWCanvas uses a 1-bit stencil buffer approach for memory-efficient clipping with
 * proper intersection semantics. This system matches HTML5 Canvas behavior exactly.
 *
 * Memory Layout:
 * - Each pixel is represented by 1 bit (1 = visible, 0 = clipped)
 * - Bits are packed into Uint8Array (8 pixels per byte)
 * - Memory usage: width × height ÷ 8 bytes (96.9% reduction vs RGBA coverage)
 * - Lazy allocation: only created when first clip() operation is performed
 *
 * Clipping Operations:
 * 1. First clip: Creates stencil buffer, renders clip path with 1s where path covers
 * 2. Subsequent clips: Renders to temp buffer, ANDs with existing stencil buffer
 * 3. Intersection semantics: Only pixels covered by ALL clips have bit = 1
 * 4. Save/restore: Stencil buffer is deep-copied during save() and restored
 */

class Context2D {
    // Static flag to track path-based rendering usage (for testing)
    // Reset before each test, check after to verify direct rendering was used
    static _pathBasedRenderingUsed = false;

    /**
     * Reset the path-based rendering tracking flag
     * Call before running tests that should use direct rendering
     */
    static resetPathBasedFlag() {
        Context2D._pathBasedRenderingUsed = false;
    }

    /**
     * Check if path-based rendering was used since last reset
     * @returns {boolean} True if path-based rendering was used
     */
    static wasPathBasedUsed() {
        return Context2D._pathBasedRenderingUsed;
    }

    /**
     * Mark that path-based rendering was used (called internally)
     * @private
     */
    static _markPathBasedRendering() {
        Context2D._pathBasedRenderingUsed = true;
    }

    constructor(surface) {
        this.surface = surface;
        this.rasterizer = new Rasterizer(surface);

        // State stack (uses Snapshot/Memento pattern for storage only)
        this._stateStack = new StateStack();

        // Current state
        this.globalAlpha = 1.0;
        this._globalCompositeOperation = 'source-over';
        this._transform = Transform2D.IDENTITY;
        this._fillStyle = new Color(0, 0, 0, 255); // Black
        this._strokeStyle = new Color(0, 0, 0, 255); // Black

        // Stroke properties
        this._lineWidth = 1.0;
        this.lineJoin = 'miter'; // 'miter', 'round', 'bevel'
        this.lineCap = 'butt'; // 'butt', 'round', 'square'
        this.miterLimit = DEFAULT_MITER_LIMIT;

        // Line dash properties
        this._lineDash = []; // Internal working dash pattern (may be duplicated)
        this._originalLineDash = []; // Original pattern as set by user
        this._lineDashOffset = 0; // Starting offset into dash pattern

        // Shadow properties - HTML5 Canvas compatible defaults
        this.shadowColor = Color.transparent; // Transparent black (no shadow)
        this.shadowBlur = 0; // No blur
        this.shadowOffsetX = 0; // No horizontal offset
        this.shadowOffsetY = 0; // No vertical offset

        // Internal path and clipping
        this._currentPath = new SWPath2D();

        // Stencil-based clipping system (only clipping mechanism)
        this._clipMask = null; // ClipMask instance for 1-bit per pixel clipping

        // Cached state flags for direct rendering eligibility (performance optimization)
        this._noShadow = true; // Updated when shadow properties change
        this._isSourceOver = true; // Updated when globalCompositeOperation changes
    }

    // HTML5 Canvas-compatible lineWidth property with validation
    get lineWidth() {
        return this._lineWidth;
    }

    set lineWidth(value) {
        // HTML5 Canvas spec: ignore zero, negative, Infinity, and NaN values
        if (typeof value === 'number' && value > 0 && isFinite(value)) {
            this._lineWidth = value;
        }
        // Otherwise, keep the current value unchanged (ignore invalid input)
    }

    // HTML5 Canvas-compatible globalCompositeOperation property with cached flag
    get globalCompositeOperation() {
        return this._globalCompositeOperation;
    }

    set globalCompositeOperation(value) {
        this._globalCompositeOperation = value;
        this._isSourceOver = value === 'source-over';
    }

    /**
     * Update cached shadow flag based on current shadow properties
     * @private
     */
    _updateNoShadowFlag() {
        this._noShadow =
            !this.shadowColor ||
            this.shadowColor === Color.transparent ||
            (this.shadowBlur === 0 && this.shadowOffsetX === 0 && this.shadowOffsetY === 0);
    }

    /**
     * Fast-path check for direct rendering eligibility.
     * @param {Color|Gradient|Pattern} paintSource - The paint to check
     * @returns {boolean} true if direct rendering can be used
     * @private
     */
    _canUseDirectRendering(paintSource) {
        return this._isSourceOver && this._noShadow && paintSource instanceof Color && paintSource.a > 0;
    }

    /**
     * Fast-path check for dual (fill+stroke) direct rendering eligibility.
     * @param {Color|Gradient|Pattern} fillPaint - Fill paint source
     * @param {Color|Gradient|Pattern} strokePaint - Stroke paint source
     * @returns {boolean} true if direct rendering can be used
     * @private
     */
    _canUseDirectRenderingForFillStroke(fillPaint, strokePaint) {
        if (!this._isSourceOver || !this._noShadow) return false;
        if (!(fillPaint instanceof Color) || !(strokePaint instanceof Color)) return false;

        const hasFill = fillPaint.a > 0;
        const hasStroke = strokePaint.a > 0 && this._lineWidth > 0;
        return hasFill || hasStroke;
    }

    // State management

    /**
     * Create a complete state snapshot for save/restore
     * @returns {Object} Snapshot of all saveable state
     * @private
     */
    _createSnapshot() {
        return {
            globalAlpha: this.globalAlpha,
            globalCompositeOperation: this._globalCompositeOperation,
            transform: new Transform2D([
                this._transform.a,
                this._transform.b,
                this._transform.c,
                this._transform.d,
                this._transform.e,
                this._transform.f
            ]),
            fillStyle: this._fillStyle, // Paint sources are immutable, safe to share
            strokeStyle: this._strokeStyle, // Paint sources are immutable, safe to share
            clipMask: this._clipMask ? this._clipMask.clone() : null, // Deep copy of clip mask
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit,
            lineDash: this._lineDash.slice(), // Copy working dash pattern array
            originalLineDash: this._originalLineDash.slice(), // Copy original pattern
            lineDashOffset: this._lineDashOffset,
            // Shadow properties
            shadowColor: this.shadowColor, // Color is immutable, safe to share
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY,
            // Cached state flags
            _noShadow: this._noShadow,
            _isSourceOver: this._isSourceOver
        };
    }

    save() {
        this._stateStack.push(this._createSnapshot());
    }

    /**
     * Apply a state snapshot to restore context state
     * @param {Object} snapshot - Previously saved state
     * @private
     */
    _applySnapshot(snapshot) {
        this.globalAlpha = snapshot.globalAlpha;
        // Use backing field directly to avoid setter overhead (flags are saved separately)
        this._globalCompositeOperation = snapshot.globalCompositeOperation;
        this._transform = snapshot.transform;
        this._fillStyle = snapshot.fillStyle;
        this._strokeStyle = snapshot.strokeStyle;

        // Restore clipMask (may be null)
        this._clipMask = snapshot.clipMask;

        this._lineWidth = snapshot.lineWidth;
        this.lineJoin = snapshot.lineJoin;
        this.lineCap = snapshot.lineCap;
        this.miterLimit = snapshot.miterLimit;
        this._lineDash = snapshot.lineDash || [];
        this._originalLineDash = snapshot.originalLineDash || [];
        this._lineDashOffset = snapshot.lineDashOffset || 0;

        // Restore shadow properties
        this.shadowColor = snapshot.shadowColor || Color.transparent;
        this.shadowBlur = snapshot.shadowBlur || 0;
        this.shadowOffsetX = snapshot.shadowOffsetX || 0;
        this.shadowOffsetY = snapshot.shadowOffsetY || 0;

        // Restore cached state flags
        this._noShadow = snapshot._noShadow ?? true;
        this._isSourceOver = snapshot._isSourceOver ?? true;
    }

    restore() {
        if (this._stateStack.isEmpty()) return;
        this._applySnapshot(this._stateStack.pop());
    }

    // Transform methods
    // HTML5 Canvas spec: transformations POST-multiply (current * new)
    transform(a, b, c, d, e, f) {
        const m = new Transform2D([a, b, c, d, e, f]);
        this._transform = this._transform.multiply(m);
    }

    setTransform(a, b, c, d, e, f) {
        this._transform = new Transform2D([a, b, c, d, e, f]);
    }

    resetTransform() {
        this._transform = Transform2D.IDENTITY;
    }

    // Convenience transform methods - all post-multiply per HTML5 Canvas spec
    translate(x, y) {
        this._transform = this._transform.translate(x, y);
    }

    scale(sx, sy) {
        this._transform = this._transform.scale(sx, sy);
    }

    rotate(angleInRadians) {
        this._transform = this._transform.rotate(angleInRadians);
    }

    // Style setters - support solid colors and paint sources
    setFillStyle(r, g, b, a) {
        if (arguments.length === 1 && (r instanceof Color || r instanceof Gradient || r instanceof Pattern)) {
            // Paint source (gradient or pattern)
            this._fillStyle = r;
        } else {
            // RGBA color
            a = a !== undefined ? a : 255;
            this._fillStyle = new Color(r, g, b, a);
        }
    }

    setStrokeStyle(r, g, b, a) {
        if (arguments.length === 1 && (r instanceof Color || r instanceof Gradient || r instanceof Pattern)) {
            // Paint source (gradient or pattern)
            this._strokeStyle = r;
        } else {
            // RGBA color
            a = a !== undefined ? a : 255;
            this._strokeStyle = new Color(r, g, b, a);
        }
    }

    // Shadow property setters with validation
    setShadowColor(r, g, b, a) {
        if (arguments.length === 1 && r instanceof Color) {
            this.shadowColor = r;
        } else {
            a = a !== undefined ? a : 255;
            this.shadowColor = new Color(r, g, b, a);
        }
        this._updateNoShadowFlag();
    }

    setShadowBlur(blur) {
        Validators.nonNegative(blur, 'shadowBlur');
        this.shadowBlur = blur;
        this._updateNoShadowFlag();
    }

    setShadowOffsetX(offset) {
        Validators.number(offset, 'shadowOffsetX');
        this.shadowOffsetX = offset;
        this._updateNoShadowFlag();
    }

    setShadowOffsetY(offset) {
        Validators.number(offset, 'shadowOffsetY');
        this.shadowOffsetY = offset;
        this._updateNoShadowFlag();
    }

    // Path methods (delegated to internal path)
    beginPath() {
        this._currentPath = new SWPath2D();
    }

    closePath() {
        this._currentPath.closePath();
    }

    moveTo(x, y) {
        this._currentPath.moveTo(x, y);
    }

    lineTo(x, y) {
        this._currentPath.lineTo(x, y);
    }

    rect(x, y, w, h) {
        this._currentPath.rect(x, y, w, h);
    }

    arc(x, y, radius, startAngle, endAngle, counterclockwise) {
        this._currentPath.arc(x, y, radius, startAngle, endAngle, counterclockwise);
    }

    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
        this._currentPath.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise);
    }

    arcTo(x1, y1, x2, y2, radius) {
        this._currentPath.arcTo(x1, y1, x2, y2, radius);
    }

    quadraticCurveTo(cpx, cpy, x, y) {
        this._currentPath.quadraticCurveTo(cpx, cpy, x, y);
    }

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        this._currentPath.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }

    // Drawing methods - rectangle operations
    fillRect(x, y, width, height) {
        // Direct rendering: Color fill with source-over, no shadows (clipping supported)
        if (this._canUseDirectRendering(this._fillStyle)) {
            const t = this._transform;
            const clip = this._clipMask ? this._clipMask.buffer : null;

            // Fast access to pre-computed transform values (no getters, no sqrt/atan2)
            const scaledW = width * t.scaleX;
            const scaledH = height * t.scaleY;
            const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });

            // Inline opacity check
            const isOpaque = this._fillStyle.a === 255 && this.globalAlpha >= 1.0;

            if (t.isAxisAligned) {
                // Inline dimension swapping - no RectOpsAA.getRotatedDimensions() call needed
                const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                const tlX = center.x - finalW / 2;
                const tlY = center.y - finalH / 2;

                if (isOpaque) {
                    RectOpsAA.fill_AA_Opaq(this.surface, tlX, tlY, finalW, finalH, this._fillStyle, clip);
                    return;
                } else {
                    RectOpsAA.fill_AA_Alpha(
                        this.surface,
                        tlX,
                        tlY,
                        finalW,
                        finalH,
                        this._fillStyle,
                        this.globalAlpha,
                        clip
                    );
                    return;
                }
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use edge-function algorithm
                if (isOpaque) {
                    RectOpsRot.fill_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        t.rotationAngle,
                        this._fillStyle,
                        1.0,
                        clip
                    );
                    return;
                } else {
                    RectOpsRot.fill_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        t.rotationAngle,
                        this._fillStyle,
                        this.globalAlpha,
                        clip
                    );
                    return;
                }
            }
            // Non-uniform scale + rotation: fall through to path-based rendering (produces parallelogram)
        }

        // Path-based rendering: gradients, patterns, non-source-over, shadows, clipping
        Context2D._markPathBasedRendering();
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMask,
            fillStyle: this._fillStyle,
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.fillRect(x, y, width, height, this._fillStyle);
        this.rasterizer.endOp();
    }

    strokeRect(x, y, width, height) {
        // Direct rendering: Color stroke with source-over, no shadows (clipping supported)
        if (this._canUseDirectRendering(this._strokeStyle)) {
            const t = this._transform;
            const clip = this._clipMask ? this._clipMask.buffer : null;

            // Fast access to pre-computed transform values
            const scaledW = width * t.scaleX;
            const scaledH = height * t.scaleY;
            const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
            const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);

            const isOpaque = this._strokeStyle.a === 255 && this.globalAlpha >= 1.0;

            if (t.isAxisAligned) {
                // Inline dimension swapping
                const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                const tlX = center.x - finalW / 2;
                const tlY = center.y - finalH / 2;

                const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;
                const isThickStroke = scaledLineWidth > 1;

                if (is1pxStroke) {
                    if (isOpaque) {
                        RectOpsAA.stroke1px_AA_Opaq(this.surface, tlX, tlY, finalW, finalH, this._strokeStyle, clip);
                        return;
                    } else {
                        RectOpsAA.stroke1px_AA_Alpha(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            this._strokeStyle,
                            this.globalAlpha,
                            clip
                        );
                        return;
                    }
                } else if (isThickStroke) {
                    if (isOpaque) {
                        RectOpsAA.strokeThick_AA_Opaq(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            scaledLineWidth,
                            this._strokeStyle,
                            clip
                        );
                        return;
                    } else {
                        RectOpsAA.strokeThick_AA_Alpha(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            scaledLineWidth,
                            this._strokeStyle,
                            this.globalAlpha,
                            clip
                        );
                        return;
                    }
                }
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use line-based stroke
                RectOpsRot.stroke_Rot_Any(
                    this.surface,
                    center.x,
                    center.y,
                    scaledW,
                    scaledH,
                    t.rotationAngle,
                    scaledLineWidth,
                    this._strokeStyle,
                    this.globalAlpha,
                    clip
                );
                return;
            }
            // Non-uniform scale + rotation: fall through to path-based rendering (produces parallelogram)
        }

        // Path-based rendering: Create a rectangular path
        Context2D._markPathBasedRendering();
        const rectPath = new SWPath2D();
        rectPath.rect(x, y, width, height);
        rectPath.closePath();

        // Stroke the path using existing stroke infrastructure
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMask,
            strokeStyle: this._strokeStyle,
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.stroke(rectPath, {
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit
        });

        this.rasterizer.endOp();
    }

    /**
     * Fill and stroke a rectangle in a single operation
     * Uses unified rendering when possible to prevent fill/stroke gaps.
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     */
    fillStrokeRect(x, y, width, height) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width < 0 || height < 0) {
            return; // Nothing to draw for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to draw for zero dimensions
        }

        // Direct rendering: both fill and stroke are solid colors, source-over, no shadows
        if (this._canUseDirectRenderingForFillStroke(this._fillStyle, this._strokeStyle)) {
            const t = this._transform;
            const clip = this._clipMask ? this._clipMask.buffer : null;

            const hasFill = this._fillStyle.a > 0;
            const hasStroke = this._strokeStyle.a > 0 && this._lineWidth > 0;

            // Fast access to pre-computed transform values
            const scaledW = width * t.scaleX;
            const scaledH = height * t.scaleY;
            const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
            const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);

            if (t.isAxisAligned) {
                // Inline dimension swapping
                const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                const tlX = center.x - finalW / 2;
                const tlY = center.y - finalH / 2;

                RectOpsAA.fillStroke_AA_Any(
                    this.surface,
                    tlX,
                    tlY,
                    finalW,
                    finalH,
                    scaledLineWidth,
                    hasFill ? this._fillStyle : null,
                    hasStroke ? this._strokeStyle : null,
                    this.globalAlpha,
                    clip
                );
                return;
            } else if (t.isUniformScale) {
                // Rotated with uniform scale: use rotated fill+stroke wrapper
                RectOpsRot.fillStroke_Rot_Any(
                    this.surface,
                    center.x,
                    center.y,
                    scaledW,
                    scaledH,
                    t.rotationAngle,
                    scaledLineWidth,
                    hasFill ? this._fillStyle : null,
                    hasStroke ? this._strokeStyle : null,
                    this.globalAlpha,
                    clip
                );
                return;
            }
            // Non-uniform scale + rotation: fall through to path-based rendering (produces parallelogram)
        }

        // Path-based rendering: gradients, patterns, non-source-over, shadows, or parallelograms
        Context2D._markPathBasedRendering();
        this.fillRect(x, y, width, height);
        this.strokeRect(x, y, width, height);
    }

    clearRect(x, y, width, height) {
        // clearRect should only affect the specified rectangle, not use canvas-wide compositing
        // We'll handle this as a special case by directly clearing the surface pixels
        this._clearRectDirect(x, y, width, height);
    }

    /**
     * Clear rectangle directly without canvas-wide compositing
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @private
     */
    _clearRectDirect(x, y, width, height) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width < 0 || height < 0) {
            return; // Nothing to clear for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to clear for zero dimensions
        }

        const surface = this.surface;
        const transform = this._transform;

        // Transform rectangle corners to determine affected region
        const topLeft = transform.transformPoint({ x: x, y: y });
        const topRight = transform.transformPoint({ x: x + width, y: y });
        const bottomLeft = transform.transformPoint({ x: x, y: y + height });
        const bottomRight = transform.transformPoint({ x: x + width, y: y + height });

        // Get bounding box of transformed rectangle
        const minX = Math.floor(Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x));
        const maxX = Math.ceil(Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x));
        const minY = Math.floor(Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y));
        const maxY = Math.ceil(Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y));

        // Handle simple axis-aligned case (no rotation/skew)
        if (transform.b === 0 && transform.c === 0) {
            // Calculate the actual rectangle bounds in surface coordinates
            const rectLeft = transform.e + x * transform.a; // x coordinate with scaling and translation
            const rectTop = transform.f + y * transform.d; // y coordinate with scaling and translation
            const rectRight = rectLeft + width * transform.a;
            const rectBottom = rectTop + height * transform.d;

            // Get integer pixel bounds
            const startX = Math.max(0, Math.floor(rectLeft));
            const endX = Math.min(surface.width - 1, Math.floor(rectRight) - 1); // Inclusive end
            const startY = Math.max(0, Math.floor(rectTop));
            const endY = Math.min(surface.height - 1, Math.floor(rectBottom) - 1); // Inclusive end

            for (let py = startY; py <= endY; py++) {
                for (let px = startX; px <= endX; px++) {
                    // Check if this pixel should be clipped by current clip mask
                    if (this._clipMask && this._clipMask.isPixelClipped(px, py)) {
                        continue;
                    }

                    const offset = py * surface.stride + px * 4;
                    surface.data[offset] = 0; // R
                    surface.data[offset + 1] = 0; // G
                    surface.data[offset + 2] = 0; // B
                    surface.data[offset + 3] = 0; // A (transparent)
                }
            }
        } else {
            // For rotated/skewed rectangles, we need to test each pixel
            // This is more complex but handles all transformation cases correctly
            const invTransform = transform.invert();

            for (let py = Math.max(0, minY); py <= Math.min(surface.height - 1, maxY); py++) {
                for (let px = Math.max(0, minX); px <= Math.min(surface.width - 1, maxX); px++) {
                    // Check if this pixel should be clipped by current clip mask
                    if (this._clipMask && this._clipMask.isPixelClipped(px, py)) {
                        continue;
                    }

                    // Transform pixel back to path coordinate space
                    const pathPoint = invTransform.transformPoint({ x: px + 0.5, y: py + 0.5 });

                    // Check if point is inside the clearRect rectangle
                    if (pathPoint.x >= x && pathPoint.x < x + width && pathPoint.y >= y && pathPoint.y < y + height) {
                        const offset = py * surface.stride + px * 4;
                        surface.data[offset] = 0; // R
                        surface.data[offset + 1] = 0; // G
                        surface.data[offset + 2] = 0; // B
                        surface.data[offset + 3] = 0; // A (transparent)
                    }
                }
            }
        }
    }

    /**
     * Stroke a rounded rectangle.
     * Uses direct rendering for strokes with no transforms/clipping/shadows.
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     */
    strokeRoundRect(x, y, width, height, radii) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width < 0 || height < 0) {
            return; // Nothing to draw for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to draw for zero dimensions
        }

        // Normalize radius to check for zero
        const radius = Array.isArray(radii) ? radii[0] : radii || 0;

        // Fallback to strokeRect for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            this.strokeRect(x, y, width, height);
            return;
        }

        // Direct rendering: Color stroke with source-over, no shadows
        if (this._canUseDirectRendering(this._strokeStyle)) {
            const t = this._transform;
            const clip = this._clipMask ? this._clipMask.buffer : null;

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);
                const scaledRadius = radius * t.scaleX;
                const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;
                const isOpaque = this._strokeStyle.a === 255 && this.globalAlpha >= 1.0;

                if (t.isIdentity) {
                    // No transform: use axis-aligned methods with original coordinates
                    if (is1pxStroke) {
                        if (isOpaque) {
                            RoundedRectOpsAA.stroke1px_AA_Opaq(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                radii,
                                this._strokeStyle,
                                clip
                            );
                        } else {
                            RoundedRectOpsAA.stroke1px_AA_Alpha(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                radii,
                                this._strokeStyle,
                                this.globalAlpha,
                                clip
                            );
                        }
                    } else {
                        if (isOpaque) {
                            RoundedRectOpsAA.strokeThick_AA_Opaq(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                radii,
                                this._lineWidth,
                                this._strokeStyle,
                                clip
                            );
                        } else {
                            RoundedRectOpsAA.strokeThick_AA_Alpha(
                                this.surface,
                                x,
                                y,
                                width,
                                height,
                                radii,
                                this._lineWidth,
                                this._strokeStyle,
                                this.globalAlpha,
                                clip
                            );
                        }
                    }
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping
                    const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                    const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                    const tlX = center.x - finalW / 2;
                    const tlY = center.y - finalH / 2;

                    if (is1pxStroke) {
                        if (isOpaque) {
                            RoundedRectOpsAA.stroke1px_AA_Opaq(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                scaledRadius,
                                this._strokeStyle,
                                clip
                            );
                        } else {
                            RoundedRectOpsAA.stroke1px_AA_Alpha(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                scaledRadius,
                                this._strokeStyle,
                                this.globalAlpha,
                                clip
                            );
                        }
                    } else {
                        if (isOpaque) {
                            RoundedRectOpsAA.strokeThick_AA_Opaq(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                scaledRadius,
                                scaledLineWidth,
                                this._strokeStyle,
                                clip
                            );
                        } else {
                            RoundedRectOpsAA.strokeThick_AA_Alpha(
                                this.surface,
                                tlX,
                                tlY,
                                finalW,
                                finalH,
                                scaledRadius,
                                scaledLineWidth,
                                this._strokeStyle,
                                this.globalAlpha,
                                clip
                            );
                        }
                    }
                    return;
                } else {
                    // Rotated with uniform scale: use strokeRotated
                    RoundedRectOpsRot.stroke_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        scaledRadius,
                        t.rotationAngle,
                        scaledLineWidth,
                        this._strokeStyle,
                        this.globalAlpha,
                        clip
                    );
                    return;
                }
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: use general path system
        Context2D._markPathBasedRendering();
        this.beginPath();
        this._currentPath.roundRect(x, y, width, height, radii);
        this.stroke();
    }

    /**
     * Fill a rounded rectangle.
     * Uses direct rendering when possible (solid color, source-over, no shadow, uniform scale).
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     */
    fillRoundRect(x, y, width, height, radii) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width < 0 || height < 0) {
            return; // Nothing to draw for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to draw for zero dimensions
        }

        // Normalize radius to check for zero
        const radius = Array.isArray(radii) ? radii[0] : radii || 0;

        // Fallback to fillRect for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            this.fillRect(x, y, width, height);
            return;
        }

        // Direct rendering: Color fill with source-over, no shadows
        if (this._canUseDirectRendering(this._fillStyle)) {
            const t = this._transform;
            const clip = this._clipMask ? this._clipMask.buffer : null;

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledRadius = radius * t.scaleX;
                const isOpaque = this._fillStyle.a === 255 && this.globalAlpha >= 1.0;

                if (t.isIdentity) {
                    // No transform: use axis-aligned methods with original coordinates
                    if (isOpaque) {
                        RoundedRectOpsAA.fill_AA_Opaq(this.surface, x, y, width, height, radii, this._fillStyle, clip);
                    } else {
                        RoundedRectOpsAA.fill_AA_Alpha(
                            this.surface,
                            x,
                            y,
                            width,
                            height,
                            radii,
                            this._fillStyle,
                            this.globalAlpha,
                            clip
                        );
                    }
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping
                    const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                    const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                    const tlX = center.x - finalW / 2;
                    const tlY = center.y - finalH / 2;

                    if (isOpaque) {
                        RoundedRectOpsAA.fill_AA_Opaq(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            scaledRadius,
                            this._fillStyle,
                            clip
                        );
                    } else {
                        RoundedRectOpsAA.fill_AA_Alpha(
                            this.surface,
                            tlX,
                            tlY,
                            finalW,
                            finalH,
                            scaledRadius,
                            this._fillStyle,
                            this.globalAlpha,
                            clip
                        );
                    }
                    return;
                } else {
                    // Rotated with uniform scale: use fillRotated
                    RoundedRectOpsRot.fill_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        scaledRadius,
                        t.rotationAngle,
                        this._fillStyle,
                        this.globalAlpha,
                        clip
                    );
                    return;
                }
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: use general path system
        Context2D._markPathBasedRendering();
        this.beginPath();
        this._currentPath.roundRect(x, y, width, height, radii);
        this.fill();
    }

    /**
     * Fill and stroke a rounded rectangle in a single unified operation.
     * Uses unified direct rendering to prevent fill/stroke boundary speckles.
     * @param {number} x - Rectangle x coordinate
     * @param {number} y - Rectangle y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     */
    fillStrokeRoundRect(x, y, width, height, radii) {
        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle coordinates must be numbers');
        }

        if (width < 0 || height < 0) {
            return; // Nothing to draw for negative dimensions
        }

        if (width === 0 || height === 0) {
            return; // Nothing to draw for zero dimensions
        }

        // Normalize radius to check for zero
        const radius = Array.isArray(radii) ? radii[0] : radii || 0;

        // Fallback to fillStrokeRect for zero radius
        if (radius <= 0) {
            this.fillStrokeRect(x, y, width, height);
            return;
        }

        // Direct rendering: both fill and stroke are solid colors, source-over, no shadows
        if (this._canUseDirectRenderingForFillStroke(this._fillStyle, this._strokeStyle)) {
            const t = this._transform;
            const clip = this._clipMask ? this._clipMask.buffer : null;

            const hasFill = this._fillStyle.a > 0;
            const hasStroke = this._strokeStyle.a > 0 && this._lineWidth > 0;

            // Rounded rects require uniform scale (non-uniform would make ellipses)
            if (t.isUniformScale) {
                const scaledW = width * t.scaleX;
                const scaledH = height * t.scaleY;
                const center = t.transformPoint({ x: x + width / 2, y: y + height / 2 });
                const scaledLineWidth = t.getScaledLineWidth(this._lineWidth);
                const scaledRadius = radius * t.scaleX;

                if (t.isIdentity) {
                    // Axis-aligned, no transform: use top-left coordinates
                    RoundedRectOpsAA.fillStroke_AA_Any(
                        this.surface,
                        x,
                        y,
                        width,
                        height,
                        radii,
                        this._lineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        clip
                    );
                    return;
                }

                if (t.isAxisAligned) {
                    // Inline dimension swapping
                    const finalW = t.is90DegreeRotated ? scaledH : scaledW;
                    const finalH = t.is90DegreeRotated ? scaledW : scaledH;
                    const tlX = center.x - finalW / 2;
                    const tlY = center.y - finalH / 2;

                    RoundedRectOpsAA.fillStroke_AA_Any(
                        this.surface,
                        tlX,
                        tlY,
                        finalW,
                        finalH,
                        scaledRadius,
                        scaledLineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        clip
                    );
                    return;
                } else {
                    // Rotated with uniform scale: use rotated fill+stroke
                    RoundedRectOpsRot.fillStroke_Rot_Any(
                        this.surface,
                        center.x,
                        center.y,
                        scaledW,
                        scaledH,
                        scaledRadius,
                        t.rotationAngle,
                        scaledLineWidth,
                        hasFill ? this._fillStyle : null,
                        hasStroke ? this._strokeStyle : null,
                        this.globalAlpha,
                        clip
                    );
                    return;
                }
            }
            // Non-uniform scale: fall through to path-based rendering
        }

        // Path-based rendering: use sequential fill + stroke
        Context2D._markPathBasedRendering();
        this.fillRoundRect(x, y, width, height, radii);
        this.strokeRoundRect(x, y, width, height, radii);
    }

    // M2: Path drawing methods
    fill(path, rule) {
        let pathToFill, fillRule;

        // Handle different argument combinations:
        // fill() -> path = undefined, rule = undefined
        // fill('evenodd') -> path = 'evenodd', rule = undefined
        // fill(path2d) -> path = path2d object, rule = undefined
        // fill(path2d, 'evenodd') -> path = path2d object, rule = 'evenodd'

        if (arguments.length === 0) {
            // fill() - use current path, nonzero rule
            pathToFill = this._currentPath;
            fillRule = 'nonzero';
        } else if (arguments.length === 1) {
            if (typeof path === 'string') {
                // fill('evenodd') - use current path, specified rule
                pathToFill = this._currentPath;
                fillRule = path;
            } else {
                // fill(path2d) - use specified path, nonzero rule
                pathToFill = path;
                fillRule = 'nonzero';
            }
        } else {
            // fill(path2d, 'evenodd') - use specified path and rule
            pathToFill = path;
            fillRule = rule;
        }

        fillRule = fillRule || 'nonzero';

        // Mark path-based rendering for testing (fill() has no direct rendering currently)
        Context2D._markPathBasedRendering();

        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMask,
            fillStyle: this._fillStyle,
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.fill(pathToFill, fillRule);
        this.rasterizer.endOp();
    }

    stroke(path) {
        // Use specified path or current internal path
        const pathToStroke = path || this._currentPath;

        // All path-based strokes use generic pipeline
        // Direct rendering available via dedicated methods: strokeCircle(), strokeRect(), etc.
        Context2D._markPathBasedRendering();

        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: this._transform,
            clipMask: this._clipMask,
            strokeStyle: this._strokeStyle,
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        this.rasterizer.stroke(pathToStroke, {
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit,
            lineDash: this._lineDash.slice(), // Copy to avoid mutation
            lineDashOffset: this._lineDashOffset
        });

        this.rasterizer.endOp();
    }

    /**
     * Test if a point is inside the current path or specified path
     * Supports all HTML5 Canvas API overloads:
     * - isPointInPath(x, y)
     * - isPointInPath(x, y, fillRule)
     * - isPointInPath(path, x, y)
     * - isPointInPath(path, x, y, fillRule)
     * @param {...} arguments - Variable arguments depending on overload
     * @returns {boolean} True if point is inside the path
     */
    isPointInPath() {
        let path, x, y, fillRule;

        if (arguments.length < 2) {
            const error = new TypeError('Invalid number of arguments for isPointInPath');
            error.message = 'TypeError: ' + error.message;
            throw error;
        } else if (arguments.length === 2) {
            // isPointInPath(x, y)
            [x, y] = arguments;
            path = this._currentPath;
            fillRule = 'nonzero';
        } else if (arguments.length === 3) {
            if (typeof arguments[2] === 'string') {
                // isPointInPath(x, y, fillRule)
                [x, y, fillRule] = arguments;
                path = this._currentPath;
            } else {
                // isPointInPath(path, x, y)
                [path, x, y] = arguments;
                if (!path || typeof path !== 'object' || !path.commands) {
                    const error = new TypeError('First argument must be a Path2D object');
                    error.message = 'TypeError: ' + error.message;
                    throw error;
                }
                fillRule = 'nonzero';
            }
        } else if (arguments.length === 4) {
            // isPointInPath(path, x, y, fillRule)
            [path, x, y, fillRule] = arguments;
            if (!path || typeof path !== 'object' || !path.commands) {
                const error = new TypeError('First argument must be a Path2D object');
                error.message = 'TypeError: ' + error.message;
                throw error;
            }
        } else if (arguments.length > 4) {
            const error = new TypeError('Invalid number of arguments for isPointInPath');
            error.message = 'TypeError: ' + error.message;
            throw error;
        }

        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number') {
            return false;
        }

        if (!path || !path.commands || path.commands.length === 0) {
            return false;
        }

        fillRule = fillRule || 'nonzero';

        // Note: isPointInPath uses untransformed coordinates per HTML5 Canvas spec
        // The point coordinates are in canvas coordinate space, not transform-adjusted space

        // Flatten the path to polygons
        const polygons = PathFlattener.flattenPath(path);

        if (polygons.length === 0) {
            return false;
        }

        // Transform polygons to match current canvas transform
        const transformedPolygons = polygons.map(poly => poly.map(point => this._transform.transformPoint(point)));

        // Test point against transformed polygons
        return PolygonFiller.isPointInPolygons(x, y, transformedPolygons, fillRule);
    }

    /**
     * Test if a point is inside the stroke of current path or specified path
     * Supports all HTML5 Canvas API overloads:
     * - isPointInStroke(x, y)
     * - isPointInStroke(path, x, y)
     * @param {...} arguments - Variable arguments depending on overload
     * @returns {boolean} True if point is inside the stroke
     */
    isPointInStroke() {
        let path, x, y;

        if (arguments.length < 2) {
            const error = new TypeError('Invalid number of arguments for isPointInStroke');
            error.message = 'TypeError: ' + error.message;
            throw error;
        } else if (arguments.length === 2) {
            // isPointInStroke(x, y)
            [x, y] = arguments;
            path = this._currentPath;
        } else if (arguments.length === 3) {
            // isPointInStroke(path, x, y)
            [path, x, y] = arguments;
            if (!path || typeof path !== 'object' || !path.commands) {
                const error = new TypeError('First argument must be a Path2D object');
                error.message = 'TypeError: ' + error.message;
                throw error;
            }
        } else if (arguments.length > 3) {
            const error = new TypeError('Invalid number of arguments for isPointInStroke');
            error.message = 'TypeError: ' + error.message;
            throw error;
        }

        // Validate parameters
        if (typeof x !== 'number' || typeof y !== 'number') {
            return false;
        }

        if (!path || !path.commands || path.commands.length === 0) {
            return false;
        }

        // Note: isPointInStroke uses untransformed coordinates per HTML5 Canvas spec
        // The point coordinates are in canvas coordinate space, not transform-adjusted space

        // Create stroke properties object from current context state
        const strokeProps = {
            lineWidth: this._lineWidth,
            lineJoin: this.lineJoin,
            lineCap: this.lineCap,
            miterLimit: this.miterLimit,
            lineDash: this._lineDash,
            lineDashOffset: this._lineDashOffset
        };

        // Generate stroke polygons using StrokeGenerator
        const strokePolygons = StrokeGenerator.generateStrokePolygons(path, strokeProps);

        if (strokePolygons.length === 0) {
            return false;
        }

        // Transform stroke polygons to match current canvas transform
        const transformedPolygons = strokePolygons.map(poly =>
            poly.map(point => this._transform.transformPoint(point))
        );

        // Test point against transformed stroke polygons using nonzero winding rule
        // (stroke hit testing doesn't use fill rules like path filling does)
        return PolygonFiller.isPointInPolygons(x, y, transformedPolygons, 'nonzero');
    }

    /**
     * Calculate distance from a point to a line segment
     * @param {number} px - Point x coordinate
     * @param {number} py - Point y coordinate
     * @param {number} x1 - Line segment start x
     * @param {number} y1 - Line segment start y
     * @param {number} x2 - Line segment end x
     * @param {number} y2 - Line segment end y
     * @returns {number} Shortest distance from point to line segment
     * @private
     */
    _distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;

        // If line segment is actually a point
        if (dx === 0 && dy === 0) {
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        // Calculate parameter t for closest point on line
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

        // Find closest point on line segment
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;

        // Return distance from point to closest point on segment
        return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
    }

    /**
     * Enhanced clipping support with stencil buffer intersection
     *
     * Implements HTML5 Canvas-compatible clipping with proper intersection semantics.
     * Each clip() operation creates a new clip region that intersects with any existing
     * clipping regions.
     *
     * @param {Path2D} path - Optional path to clip with (uses current path if not provided)
     * @param {string} rule - Fill rule: 'nonzero' (default) or 'evenodd'
     */
    clip(path, rule) {
        // If no path provided, use current internal path
        const pathToClip = path || this._currentPath;
        const clipRule = rule || 'nonzero';

        // Create temporary clip mask to render this clip path
        const tempClipMask = new ClipMask(this.surface.width, this.surface.height);
        tempClipMask.clipAll(); // Start with all pixels clipped

        // Flatten path and fill to temporary clip buffer
        const polygons = PathFlattener.flattenPath(pathToClip);

        // Delegate to PolygonFiller for scanline rendering
        PolygonFiller.fillPolygonsToClipMask(tempClipMask, polygons, clipRule, this._transform);

        // Intersect with existing clip mask (if any)
        if (this._clipMask) {
            // AND operation: existing mask & new mask
            this._clipMask.intersectWith(tempClipMask);
        } else {
            // First clip - use the temporary buffer as the new clip mask
            this._clipMask = tempClipMask;
        }

        // clip() does not auto-stroke the path (per HTML5 Canvas spec)
    }

    // Image rendering
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
        // Debug logging for browser troubleshooting
        if (typeof console !== 'undefined' && console.log) {
            console.log('Core drawImage called with:', {
                imageType: image ? image.constructor.name : 'null',
                hasWidth: image ? typeof image.width : 'N/A',
                hasHeight: image ? typeof image.height : 'N/A',
                hasData: image ? !!image.data : 'N/A',
                dataType: image && image.data ? image.data.constructor.name : 'N/A',
                dataInstanceCheck: image && image.data ? image.data instanceof Uint8ClampedArray : 'N/A'
            });
        }

        // Validate ImageLike object at API level
        if (!image || typeof image !== 'object') {
            throw new Error('First argument must be an ImageLike object');
        }

        if (typeof image.width !== 'number' || typeof image.height !== 'number') {
            throw new Error('ImageLike must have numeric width and height properties');
        }

        if (!(image.data instanceof Uint8ClampedArray)) {
            throw new Error('ImageLike data must be a Uint8ClampedArray');
        }

        // Mark path-based rendering for testing (drawImage() has no direct rendering currently)
        Context2D._markPathBasedRendering();

        // Set up rasterizer operation
        this.rasterizer.beginOp({
            composite: this.globalCompositeOperation,
            globalAlpha: this.globalAlpha,
            transform: new Transform2D([
                this._transform.a,
                this._transform.b,
                this._transform.c,
                this._transform.d,
                this._transform.e,
                this._transform.f
            ]),
            clipMask: this._clipMask,
            // Shadow properties
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY
        });

        // Delegate to rasterizer
        this.rasterizer.drawImage.apply(this.rasterizer, arguments);

        // End rasterizer operation
        this.rasterizer.endOp();
    }

    // Line dash methods

    /**
     * Set line dash pattern
     * @param {Array<number>} segments - Array of dash and gap lengths
     */
    setLineDash(segments) {
        if (!Array.isArray(segments)) {
            throw new Error('setLineDash expects an array');
        }

        // Validate all segments are numbers and non-negative
        for (let i = 0; i < segments.length; i++) {
            if (typeof segments[i] !== 'number' || isNaN(segments[i])) {
                throw new Error('Dash segments must be numbers');
            }
            if (segments[i] < 0) {
                throw new Error('Dash segments must be non-negative');
            }
        }

        // Store original pattern for getLineDash()
        this._originalLineDash = segments.slice();

        // Create working pattern - duplicate if odd length
        // This matches HTML5 Canvas behavior: [5, 10, 15] becomes [5, 10, 15, 5, 10, 15]
        this._lineDash = segments.slice();
        if (this._lineDash.length % 2 === 1) {
            this._lineDash = this._lineDash.concat(this._lineDash);
        }
    }

    /**
     * Get current line dash pattern
     * @returns {Array<number>} Copy of current dash pattern
     */
    getLineDash() {
        // Return copy of original pattern as set by user
        return this._originalLineDash.slice();
    }

    /**
     * Set line dash offset
     * @param {number} offset - Starting offset into dash pattern
     */
    set lineDashOffset(offset) {
        if (typeof offset !== 'number' || isNaN(offset)) {
            return; // Silently ignore invalid values like HTML5 Canvas
        }
        this._lineDashOffset = offset;
    }

    /**
     * Get line dash offset
     * @returns {number} Current dash offset
     */
    get lineDashOffset() {
        return this._lineDashOffset;
    }

    // Gradient and Pattern Creation Methods

    /**
     * Create a linear gradient
     * @param {number} x0 - Start point x coordinate
     * @param {number} y0 - Start point y coordinate
     * @param {number} x1 - End point x coordinate
     * @param {number} y1 - End point y coordinate
     * @returns {LinearGradient} New linear gradient object
     */
    createLinearGradient(x0, y0, x1, y1) {
        return new LinearGradient(x0, y0, x1, y1);
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
        return new RadialGradient(x0, y0, r0, x1, y1, r1);
    }

    /**
     * Create a conic gradient
     * @param {number} angle - Starting angle in radians
     * @param {number} x - Center point x coordinate
     * @param {number} y - Center point y coordinate
     * @returns {ConicGradient} New conic gradient object
     */
    createConicGradient(angle, x, y) {
        return new ConicGradient(angle, x, y);
    }

    /**
     * Create a pattern from an image
     * @param {Object} image - ImageLike object (canvas, surface, imagedata)
     * @param {string} repetition - Repetition mode: 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'
     * @returns {Pattern} New pattern object
     */
    createPattern(image, repetition) {
        return new Pattern(image, repetition);
    }

    // ========================================================================
    // DIRECT SHAPE APIs
    // These methods bypass the path system for maximum performance
    // ========================================================================

    /**
     * Fill a circle directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    fillCircle(centerX, centerY, radius) {
        if (radius <= 0) return;

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius considering non-uniform scaling
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;

        // Get paint source
        const paintSource = this._fillStyle;

        // Use optimized circle renderer
        this._fillCircleDirect(center.x, center.y, scaledRadius, paintSource);
    }

    /**
     * Stroke a circle directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    strokeCircle(centerX, centerY, radius) {
        if (radius <= 0) return;

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius and line width
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;
        const scaledLineWidth = this._lineWidth * scale;

        // Get paint source
        const paintSource = this._strokeStyle;

        // Use optimized circle stroke renderer
        this._strokeCircleDirect(center.x, center.y, scaledRadius, scaledLineWidth, paintSource);
    }

    /**
     * Fill and stroke a circle in one operation
     * Uses unified rendering when possible to prevent fill/stroke gaps.
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Circle radius
     */
    fillStrokeCircle(centerX, centerY, radius) {
        if (radius <= 0) return;

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius and line width
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;
        const scaledLineWidth = this._lineWidth * scale;

        // Get paint sources
        const fillPaintSource = this._fillStyle;
        const strokePaintSource = this._strokeStyle;

        // Check if we can use unified direct rendering:
        // - Both fill and stroke are solid Colors
        // - Composite operation is source-over
        const fillIsColor = fillPaintSource instanceof Color;
        const strokeIsColor = strokePaintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        const hasFill = fillIsColor && fillPaintSource.a > 0;
        const hasStroke = strokeIsColor && strokePaintSource.a > 0;

        if (fillIsColor && strokeIsColor && isSourceOver && (hasFill || hasStroke)) {
            // Use unified method for coordinated fill+stroke rendering (no gaps)
            const clipBuffer = this._clipMask ? this._clipMask.buffer : null;
            CircleOps.fillStroke_Any(
                this.surface,
                center.x,
                center.y,
                scaledRadius,
                scaledLineWidth,
                hasFill ? fillPaintSource : null,
                hasStroke ? strokePaintSource : null,
                this.globalAlpha,
                clipBuffer
            );
        } else {
            // Fallback to sequential rendering for gradients, patterns, or non-source-over
            this._fillCircleDirect(center.x, center.y, scaledRadius, fillPaintSource);
            this._strokeCircleDirect(center.x, center.y, scaledRadius, scaledLineWidth, strokePaintSource);
        }
    }

    // ========================================================================
    // Arc rendering methods (partial arcs, not full circles)
    // ========================================================================

    /**
     * Fill an arc (pie slice) directly without using the path system
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction
     */
    fillArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        if (radius <= 0) return;

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;

        // Normalize angles
        const angles = ArcOps.normalizeAngles(startAngle, endAngle, anticlockwise);

        // Get paint source
        const paintSource = this._fillStyle;
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Check for direct rendering conditions
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';

        if (isColor && isSourceOver) {
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0;
            if (isOpaque) {
                ArcOps.fill_Opaq(
                    this.surface,
                    center.x,
                    center.y,
                    scaledRadius,
                    angles.start,
                    angles.end,
                    paintSource,
                    clipBuffer
                );
            } else if (paintSource.a > 0) {
                ArcOps.fill_Alpha(
                    this.surface,
                    center.x,
                    center.y,
                    scaledRadius,
                    angles.start,
                    angles.end,
                    paintSource,
                    this.globalAlpha,
                    clipBuffer
                );
            }
            return;
        }

        // Path-based rendering: use path system
        Context2D._markPathBasedRendering();
        this.beginPath();
        this.moveTo(center.x, center.y);
        this.arc(center.x, center.y, scaledRadius, startAngle, endAngle, anticlockwise);
        this.closePath();
        this.fill();
    }

    /**
     * Stroke only the outer arc curve (not the lines to center)
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction
     */
    outerStrokeArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        if (radius <= 0) return;

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius and line width
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;
        const scaledLineWidth = this._lineWidth * scale;

        // Normalize angles
        const angles = ArcOps.normalizeAngles(startAngle, endAngle, anticlockwise);

        // Get paint source
        const paintSource = this._strokeStyle;
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Check for direct rendering conditions
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        // Direct rendering only supports butt line caps (open arc shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        if (isColor && isSourceOver && isButtCap) {
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0;
            const is1pxStroke = Math.abs(scaledLineWidth - 1) < STROKE_1PX_TOLERANCE;

            if (is1pxStroke) {
                // Optimized 1px stroke path
                if (isOpaque) {
                    ArcOps.stroke1px_Opaq(
                        this.surface,
                        center.x,
                        center.y,
                        scaledRadius,
                        angles.start,
                        angles.end,
                        paintSource,
                        clipBuffer
                    );
                } else if (paintSource.a > 0) {
                    ArcOps.stroke1px_Alpha(
                        this.surface,
                        center.x,
                        center.y,
                        scaledRadius,
                        angles.start,
                        angles.end,
                        paintSource,
                        this.globalAlpha,
                        clipBuffer
                    );
                }
            } else {
                // Thick stroke path
                if (isOpaque) {
                    ArcOps.strokeOuter_Opaq(
                        this.surface,
                        center.x,
                        center.y,
                        scaledRadius,
                        angles.start,
                        angles.end,
                        scaledLineWidth,
                        paintSource,
                        clipBuffer
                    );
                } else if (paintSource.a > 0) {
                    ArcOps.strokeOuter_Alpha(
                        this.surface,
                        center.x,
                        center.y,
                        scaledRadius,
                        angles.start,
                        angles.end,
                        scaledLineWidth,
                        paintSource,
                        this.globalAlpha,
                        clipBuffer
                    );
                }
            }
            return;
        }

        // Path-based rendering: use path system (arc only, not pie slice)
        Context2D._markPathBasedRendering();
        this.beginPath();
        this.arc(center.x, center.y, scaledRadius, startAngle, endAngle, anticlockwise);
        this.stroke();
    }

    /**
     * Fill an arc (pie slice) and stroke only the outer curve in one operation
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} [anticlockwise=false] - Direction
     */
    fillOuterStrokeArc(centerX, centerY, radius, startAngle, endAngle, anticlockwise = false) {
        if (radius <= 0) return;

        // Transform center point
        const center = this._transform.transformPoint({ x: centerX, y: centerY });

        // Calculate effective radius and line width
        const scale = this._transform.uniformScale;
        const scaledRadius = radius * scale;
        const scaledLineWidth = this._lineWidth * scale;

        // Normalize angles
        const angles = ArcOps.normalizeAngles(startAngle, endAngle, anticlockwise);

        // Get paint sources
        const fillPaintSource = this._fillStyle;
        const strokePaintSource = this._strokeStyle;
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Check for unified direct rendering
        const fillIsColor = fillPaintSource instanceof Color;
        const strokeIsColor = strokePaintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        const hasFill = fillIsColor && fillPaintSource.a > 0;
        const hasStroke = strokeIsColor && strokePaintSource.a > 0;
        // Direct rendering only supports butt line caps (open arc shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        if (fillIsColor && strokeIsColor && isSourceOver && isButtCap && (hasFill || hasStroke)) {
            // Use unified direct rendering
            ArcOps.fillStrokeOuter_Any(
                this.surface,
                center.x,
                center.y,
                scaledRadius,
                angles.start,
                angles.end,
                scaledLineWidth,
                hasFill ? fillPaintSource : null,
                hasStroke ? strokePaintSource : null,
                this.globalAlpha,
                clipBuffer
            );
            return;
        }

        // Path-based rendering: sequential rendering
        Context2D._markPathBasedRendering();

        // Fill pie slice
        if (hasFill) {
            this.beginPath();
            this.moveTo(center.x, center.y);
            this.arc(center.x, center.y, scaledRadius, startAngle, endAngle, anticlockwise);
            this.closePath();
            this.fill();
        }

        // Stroke outer arc only
        if (hasStroke) {
            this.beginPath();
            this.arc(center.x, center.y, scaledRadius, startAngle, endAngle, anticlockwise);
            this.stroke();
        }
    }

    /**
     * Stroke a line directly without using the path system
     * @param {number} x1 - Start X coordinate
     * @param {number} y1 - Start Y coordinate
     * @param {number} x2 - End X coordinate
     * @param {number} y2 - End Y coordinate
     */
    strokeLine(x1, y1, x2, y2) {
        // Transform endpoints
        const start = this._transform.transformPoint({ x: x1, y: y1 });
        const end = this._transform.transformPoint({ x: x2, y: y2 });

        // Calculate effective line width
        const scale = this._transform.uniformScale;
        const scaledLineWidth = this._lineWidth * scale;

        // Get paint source
        const paintSource = this._strokeStyle;

        // Use optimized line renderer
        this._strokeLineDirect(start.x, start.y, end.x, end.y, scaledLineWidth, paintSource);
    }

    // ========================================================================
    // Private optimized shape renderers
    // ========================================================================

    /**
     * Optimized circle fill using midpoint algorithm with horizontal spans
     * @private
     */
    _fillCircleDirect(cx, cy, radius, paintSource) {
        const surface = this.surface;
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Check for solid color direct rendering
        const isColor = paintSource instanceof Color;
        const isSourceOver = this.globalCompositeOperation === 'source-over';

        const isOpaqueColor = isColor && paintSource.a === 255 && this.globalAlpha >= 1.0 && isSourceOver;

        const isSemiTransparentColor = isColor && paintSource.a < 255 && isSourceOver;

        if (isOpaqueColor) {
            // Direct rendering 1: 32-bit packed writes for opaque colors
            CircleOps.fill_Opaq(surface, cx, cy, radius, paintSource, clipBuffer);
        } else if (isSemiTransparentColor) {
            // Direct rendering 2: Bresenham scanlines with per-pixel alpha blending
            CircleOps.fill_Alpha(this.surface, cx, cy, radius, paintSource, this.globalAlpha, clipBuffer);
        } else {
            // Path-based rendering: use path system for gradients/patterns/non-source-over compositing
            Context2D._markPathBasedRendering(); // Mark path-based rendering for testing
            this.beginPath();
            this.arc(cx, cy, radius, 0, TAU);
            // Temporarily set identity transform since we already transformed
            const savedTransform = this._transform;
            this._transform = Transform2D.IDENTITY;
            this.fill();
            this._transform = savedTransform;
        }
    }

    /**
     * Optimized circle stroke - dispatches to direct rendering when possible
     * @private
     */
    _strokeCircleDirect(cx, cy, radius, lineWidth, paintSource) {
        const isColor = paintSource instanceof Color;
        const is1pxStroke = Math.abs(lineWidth - 1) < STROKE_1PX_TOLERANCE;
        const isSourceOver = this.globalCompositeOperation === 'source-over';
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Direct rendering 1: 1px strokes using Bresenham algorithm
        if (isColor && is1pxStroke && isSourceOver) {
            const isOpaque = paintSource.a === 255 && this.globalAlpha >= 1.0;
            if (isOpaque) {
                CircleOps.stroke1px_Opaq(this.surface, cx, cy, radius, paintSource, clipBuffer);
                return;
            } else if (paintSource.a > 0) {
                CircleOps.stroke1px_Alpha(this.surface, cx, cy, radius, paintSource, this.globalAlpha, clipBuffer);
                return;
            }
        }

        // Direct rendering 2: Thick strokes using scanline annulus algorithm
        if (isColor && isSourceOver && lineWidth > 1 && paintSource.a > 0) {
            const isOpaqueThick = paintSource.a === 255 && this.globalAlpha >= 1.0;
            if (isOpaqueThick) {
                CircleOps.strokeThick_Opaq(this.surface, cx, cy, radius, lineWidth, paintSource, clipBuffer);
            } else {
                CircleOps.strokeThick_Alpha(
                    this.surface,
                    cx,
                    cy,
                    radius,
                    lineWidth,
                    paintSource,
                    this.globalAlpha,
                    clipBuffer
                );
            }
            return;
        }

        // Fallback to path system for gradients, patterns, or non-source-over compositing
        Context2D._markPathBasedRendering();
        this.beginPath();
        this.arc(cx, cy, radius, 0, TAU);
        const savedTransform = this._transform;
        this._transform = Transform2D.IDENTITY;
        const savedLineWidth = this._lineWidth;
        this._lineWidth = lineWidth;
        this.stroke();
        this._lineWidth = savedLineWidth;
        this._transform = savedTransform;
    }

    /**
     * Optimized line stroke
     * @private
     */
    _strokeLineDirect(x1, y1, x2, y2, lineWidth, paintSource) {
        const clipBuffer = this._clipMask ? this._clipMask.buffer : null;

        // Direct rendering only supports butt line caps (open shapes need cap handling)
        const isButtCap = this.lineCap === 'butt';

        // Get color for solid color direct rendering
        const isOpaqueColor =
            paintSource instanceof Color &&
            paintSource.a === 255 &&
            this.globalAlpha >= 1.0 &&
            this.globalCompositeOperation === 'source-over' &&
            isButtCap;

        // Check for semitransparent color direct rendering (Color with alpha blending)
        const isSemiTransparentColor =
            paintSource instanceof Color &&
            !isOpaqueColor &&
            this.globalCompositeOperation === 'source-over' &&
            isButtCap;

        // Try direct rendering via LineOps
        const directRenderingUsed = LineOps.stroke_Any(
            this.surface,
            x1,
            y1,
            x2,
            y2,
            lineWidth,
            paintSource,
            this.globalAlpha,
            clipBuffer,
            isOpaqueColor,
            isSemiTransparentColor
        );

        if (!directRenderingUsed) {
            // Path-based rendering for non-Color paint sources (gradients, patterns)
            Context2D._markPathBasedRendering();
            this.beginPath();
            this.moveTo(x1, y1);
            this.lineTo(x2, y2);
            const savedTransform = this._transform;
            this._transform = Transform2D.IDENTITY;
            const savedLineWidth = this._lineWidth;
            this._lineWidth = lineWidth;
            this.stroke();
            this._lineWidth = savedLineWidth;
            this._transform = savedTransform;
        }
    }
}

/**
 * CanvasCompatibleContext2D
 *
 * HTML5 Canvas 2D Context-compatible wrapper around SWCanvas Core Context2D.
 * Provides the standard HTML5 Canvas API with property setters/getters and
 * CSS color support while delegating actual rendering to the Core implementation.
 */
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
        // Debug logging for browser troubleshooting
        if (typeof console !== 'undefined' && console.log) {
            console.log('CanvasCompatibleContext2D.drawImage called with:', {
                imageType: image ? image.constructor.name : 'null',
                hasGetContext: image && typeof image.getContext === 'function',
                hasWidth: image ? typeof image.width : 'N/A',
                hasHeight: image ? typeof image.height : 'N/A',
                hasData: image ? !!image.data : 'N/A',
                isSWCanvasElement: image instanceof SWCanvasElement,
                argsLength: args.length
            });
        }

        // Handle SWCanvasElement specially
        if (image && image instanceof SWCanvasElement) {
            this._core.drawImage(image._imageData, ...args);
        } else if (image && typeof image === 'object' && image.getContext && typeof image.getContext === 'function') {
            // Handle HTMLCanvasElement (has getContext method)
            const ctx = image.getContext('2d');
            const imageData = ctx.getImageData(0, 0, image.width, image.height);
            this._core.drawImage(imageData, ...args);
        } else if (image && typeof image === 'object' && image.width && image.height && image.data) {
            // Handle ImageLike objects (duck typing)
            this._core.drawImage(image, ...args);
        } else {
            // Fallback to core implementation (includes HTMLImageElement and other types)
            this._core.drawImage(image, ...args);
        }
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

// Canvas factory function for HTML5 Canvas compatibility
function createCanvas(width = 300, height = 150) {
    return new SWCanvasElement(width, height);
}

// Core namespace factory functions  
function CoreSurfaceFactory(width, height) {
    return new Surface(width, height);
}


// Legacy encodeBMP function
function encodeBMP(surface) {
    return BitmapEncoder.encode(surface);
}

// Factory function for creating ImageData objects
function createImageData(width, height) {
    if (typeof width !== 'number' || width <= 0 || !Number.isInteger(width)) {
        throw new Error('Width must be a positive integer');
    }
    if (typeof height !== 'number' || height <= 0 || !Number.isInteger(height)) {
        throw new Error('Height must be a positive integer');
    }
    
    return {
        width: width,
        height: height,
        data: new Uint8ClampedArray(width * height * 4)
    };
}


// Export to global scope with clean dual API architecture
if (typeof window !== 'undefined') {
    // Browser
    window.SWCanvas = {
        // HTML5 Canvas-compatible API (recommended for portability)
        createCanvas: createCanvas,
        createImageData: createImageData,
        
        // Core API namespace (recommended for performance/control)  
        Core: {
            Surface: CoreSurfaceFactory,
            Context2D: Context2D,
            Transform2D: Transform2D,
            SWPath2D: SWPath2D,
            Color: Color,
            Point: Point,
            Rectangle: Rectangle,
            StateStack: StateStack,
            BitmapEncoder: BitmapEncoder,
            BitmapEncodingOptions: BitmapEncodingOptions,
            PngEncoder: PngEncoder,
            PngEncodingOptions: PngEncodingOptions,
            BitBuffer: BitBuffer,
            BoundsTracker: BoundsTracker,
            ClipMask: ClipMask,
            SourceMask: SourceMask,
            ShadowBuffer: ShadowBuffer,
            BoxBlur: BoxBlur,
            ShadowPipeline: ShadowPipeline,
            ImageProcessor: ImageProcessor,
            CompositeOperations: CompositeOperations,
            Rasterizer: Rasterizer,
            PathFlattener: PathFlattener,
            PolygonFiller: PolygonFiller,
            StrokeGenerator: StrokeGenerator,
            Gradient: Gradient,
            LinearGradient: LinearGradient,
            RadialGradient: RadialGradient,
            ConicGradient: ConicGradient,
            Pattern: Pattern,
            RoundedRectOpsAA: RoundedRectOpsAA,
            Validators: Validators,
            IS_DEBUG: IS_DEBUG,
            assertDebug: assertDebug,
            debugLog: debugLog,
            debugWarn: debugWarn
        }
    };
} else if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = {
        // HTML5 Canvas-compatible API (recommended for portability)
        createCanvas: createCanvas,
        createImageData: createImageData,

        // Core API namespace (recommended for performance/control)
        Core: {
            Surface: CoreSurfaceFactory,
            Context2D: Context2D,
            Transform2D: Transform2D,
            SWPath2D: SWPath2D,
            Color: Color,
            Point: Point,
            Rectangle: Rectangle,
            StateStack: StateStack,
            BitmapEncoder: BitmapEncoder,
            BitmapEncodingOptions: BitmapEncodingOptions,
            PngEncoder: PngEncoder,
            PngEncodingOptions: PngEncodingOptions,
            BitBuffer: BitBuffer,
            BoundsTracker: BoundsTracker,
            ClipMask: ClipMask,
            SourceMask: SourceMask,
            ShadowBuffer: ShadowBuffer,
            BoxBlur: BoxBlur,
            ShadowPipeline: ShadowPipeline,
            ImageProcessor: ImageProcessor,
            CompositeOperations: CompositeOperations,
            Rasterizer: Rasterizer,
            PathFlattener: PathFlattener,
            PolygonFiller: PolygonFiller,
            StrokeGenerator: StrokeGenerator,
            Gradient: Gradient,
            LinearGradient: LinearGradient,
            RadialGradient: RadialGradient,
            ConicGradient: ConicGradient,
            Pattern: Pattern,
            RoundedRectOpsAA: RoundedRectOpsAA,
            Validators: Validators,
            IS_DEBUG: IS_DEBUG,
            assertDebug: assertDebug,
            debugLog: debugLog,
            debugWarn: debugWarn
        }
    };
}

})();

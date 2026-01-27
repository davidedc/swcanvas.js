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
                const r1 = stop1.color.r, g1 = stop1.color.g, b1 = stop1.color.b, a1 = stop1.color.a;
                const r2 = stop2.color.r, g2 = stop2.color.g, b2 = stop2.color.b, a2 = stop2.color.a;

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
        const t = pixelAngle / (TAU);

        return this._getColorAt(t);
    }
}
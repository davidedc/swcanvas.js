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
        // _toGradientSpace's per-transform inverse cache and its scalar output.
        this._inverseOf = null;
        this._inverse = null;
        this._ux = 0;
        this._uy = 0;
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
     * Calculate color for a pixel position (must be implemented by subclasses).
     * Every subclass evaluates its gradient in GRADIENT (user) space: the device
     * pixel is mapped back through the inverse CTM by _toGradientSpace, so the
     * CTM transforms the whole gradient - radii, angles and isolines included -
     * exactly as HTML5 specifies, under any affine CTM.
     * @param {number} x - Pixel x coordinate in canvas space (integer)
     * @param {number} y - Pixel y coordinate in canvas space (integer)
     * @param {Transform2D} transform - Current canvas transform (used to invert pixel to gradient coords)
     * @returns {Color} Color for this pixel (non-null Color instance)
     * @abstract
     */
    getColorForPixel(x, y, transform) {
        throw new Error('getColorForPixel must be implemented by subclass');
    }

    /**
     * Map device pixel (x, y), sampled at its centre, into gradient space; the
     * result lands in this._ux / this._uy (scalars - no per-pixel allocation).
     * The inverse CTM is cached per transform OBJECT: Transform2D is frozen, so
     * one identity test per pixel replaces a matrix inversion. Returns false
     * when the CTM is singular (a zero-area mapping paints nothing).
     * @private
     */
    _toGradientSpace(x, y, transform) {
        if (transform !== this._inverseOf) {
            this._inverseOf = transform;
            try {
                this._inverse = transform.invert();
            } catch (e) {
                this._inverse = null;
            }
        }
        const inv = this._inverse;
        if (inv === null) return false;
        // The pixel CENTRE (HTML5 semantics), as the polygon scanlines sample.
        const px = x + 0.5;
        const py = y + 0.5;
        this._ux = inv.a * px + inv.c * py + inv.e;
        this._uy = inv.b * px + inv.d * py + inv.f;
        return true;
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
     * Calculate color for a pixel position: project the gradient-space point
     * onto the start→end line. A zero-length line paints nothing (HTML5).
     * @param {number} x - Pixel x coordinate in canvas space
     * @param {number} y - Pixel y coordinate in canvas space
     * @param {Transform2D} transform - Current canvas transform
     * @returns {Color} Color for this pixel
     */
    getColorForPixel(x, y, transform) {
        if (this._lengthSquared === 0 || !this._toGradientSpace(x, y, transform)) {
            return Color.transparent;
        }
        const t = ((this._ux - this._x0) * this._dx + (this._uy - this._y0) * this._dy) / this._lengthSquared;
        return this._getColorAt(t);
    }
}

/**
 * Radial Gradient implementation - the HTML5 two-circle CONE: circles
 * c(ω) = c0 + ω(c1 − c0), r(ω) = r0 + ω(r1 − r0); a point takes the colour
 * at the LARGEST ω whose circle passes through it with r(ω) ≥ 0, and a point
 * no such circle reaches (outside the cone) stays transparent black.
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

        this._x0 = x0;
        this._y0 = y0;
        this._r0 = r0;
        this._x1 = x1;
        this._y1 = y1;
        this._r1 = r1;

        // |p − c(ω)| = r(ω) is the quadratic  a·ω² − 2·b·ω + c = 0  with
        // a = |c1 − c0|² − (r1 − r0)², b = (p − c0)·(c1 − c0) + r0(r1 − r0),
        // c = |p − c0|² − r0²; a and the per-gradient terms are constant.
        this._cdx = x1 - x0;
        this._cdy = y1 - y0;
        this._dr = r1 - r0;
        this._a = this._cdx * this._cdx + this._cdy * this._cdy - this._dr * this._dr;
        this._concentric = this._cdx === 0 && this._cdy === 0;
        // Identical circles paint nothing (HTML5).
        this._paintsNothing = this._concentric && this._dr === 0;
    }

    /**
     * Calculate color for a pixel position
     * @param {number} x - Pixel x coordinate in canvas space
     * @param {number} y - Pixel y coordinate in canvas space
     * @param {Transform2D} transform - Current canvas transform
     * @returns {Color} Color for this pixel
     */
    getColorForPixel(x, y, transform) {
        if (this._paintsNothing || !this._toGradientSpace(x, y, transform)) {
            return Color.transparent;
        }
        const pdx = this._ux - this._x0;
        const pdy = this._uy - this._y0;

        if (this._concentric) {
            // One root survives r(ω) ≥ 0: ω = (|p − c0| − r0) / (r1 − r0).
            const t = (Math.sqrt(pdx ** 2 + pdy ** 2) - this._r0) / this._dr;
            return this._getColorAt(t);
        }

        const r0 = this._r0;
        const dr = this._dr;
        const b = pdx * this._cdx + pdy * this._cdy + r0 * dr;
        const c = pdx * pdx + pdy * pdy - r0 * r0;
        let omega;
        if (this._a === 0) {
            // One circle touches the other internally: the quadratic is linear.
            if (b === 0) return Color.transparent;
            omega = c / (2 * b);
            if (r0 + omega * dr < 0) return Color.transparent;
        } else {
            const disc = b * b - this._a * c;
            if (disc < 0) return Color.transparent; // outside the cone
            const root = Math.sqrt(disc);
            const w1 = (b + root) / this._a;
            const w2 = (b - root) / this._a;
            const hi = w1 > w2 ? w1 : w2;
            const lo = w1 > w2 ? w2 : w1;
            if (r0 + hi * dr >= 0) omega = hi;
            else if (r0 + lo * dr >= 0) omega = lo;
            else return Color.transparent;
        }
        return this._getColorAt(omega);
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
     * Calculate color for a pixel position: the gradient-space angle around the
     * centre, measured from the start angle.
     * @param {number} x - Pixel x coordinate in canvas space
     * @param {number} y - Pixel y coordinate in canvas space
     * @param {Transform2D} transform - Current canvas transform
     * @returns {Color} Color for this pixel
     */
    getColorForPixel(x, y, transform) {
        if (!this._toGradientSpace(x, y, transform)) {
            return Color.transparent;
        }

        // Calculate angle from center to pixel
        let pixelAngle = Math.atan2(this._uy - this._y, this._ux - this._x) - this._angle;

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

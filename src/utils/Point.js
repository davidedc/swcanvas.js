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
    
    get x() { return this._x; }
    get y() { return this._y; }
    
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
        return new Point(
            this._x * cos - this._y * sin,
            this._x * sin + this._y * cos
        );
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
        return new Point(
            Math.max(minX, Math.min(maxX, this._x)),
            Math.max(minY, Math.min(maxY, this._y))
        );
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
        
        return new Point(
            this._x + (other._x - this._x) * t,
            this._y + (other._y - this._y) * t
        );
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
        return other instanceof Point &&
               Math.abs(this._x - other._x) < tolerance &&
               Math.abs(this._y - other._y) < tolerance;
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
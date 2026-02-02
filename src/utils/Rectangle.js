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

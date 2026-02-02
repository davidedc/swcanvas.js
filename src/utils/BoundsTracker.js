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

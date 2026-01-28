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
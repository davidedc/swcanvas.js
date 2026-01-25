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
        let bounds = {
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
        const boundsStr = bounds.isEmpty ? 'empty' : 
            `(${bounds.minX},${bounds.minY})-(${bounds.maxX},${bounds.maxY})`;
        return `SourceMask(${this.width}×${this.height}, ${memoryKB}KB, bounds: ${boundsStr})`;
    }
}
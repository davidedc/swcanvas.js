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

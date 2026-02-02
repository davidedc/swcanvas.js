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

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

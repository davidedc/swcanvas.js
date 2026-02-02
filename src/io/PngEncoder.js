/**
 * PngEncoder class for SWCanvas
 *
 * Handles encoding of Surface data to minimal PNG format with transparency support.
 * Uses uncompressed DEFLATE blocks for simplicity while maintaining PNG compliance.
 * Provides static methods for encoding with proper alpha handling.
 *
 * Following OO best practices:
 * - Static methods for stateless encoding operations
 * - Clear separation of PNG chunk generation and pixel processing
 * - Proper error handling and validation
 * - Support for transparency (unlike BMP format)
 */
class PngEncoder {
    /**
     * Encode a surface to PNG format
     * @param {Surface} surface - Surface to encode
     * @param {PngEncodingOptions} [options=PngEncodingOptions.DEFAULT] - Encoding options
     * @returns {ArrayBuffer} PNG file data
     */
    static encode(surface, options = PngEncodingOptions.DEFAULT) {
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

        // Validate dimensions
        if (width <= 0 || height <= 0) {
            throw new Error('Surface dimensions must be positive');
        }

        if (width > PngEncoder.MAX_DIMENSION || height > PngEncoder.MAX_DIMENSION) {
            throw new Error(`Surface dimensions must be ≤ ${PngEncoder.MAX_DIMENSION}x${PngEncoder.MAX_DIMENSION}`);
        }

        // Create scanlines with filter bytes (filter 0 = None)
        const scanlines = PngEncoder._createScanlines(width, height, data);

        // Create compressed data using stored DEFLATE blocks
        const zlibData = PngEncoder._createZlibData(scanlines);

        // Build PNG chunks
        const signature = PngEncoder._createSignature();
        const ihdrChunk = PngEncoder._createIHDRChunk(width, height);
        const idatChunk = PngEncoder._createIDATChunk(zlibData);
        const iendChunk = PngEncoder._createIENDChunk();

        // Concatenate all parts
        const totalLength = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
        const result = new Uint8Array(totalLength);

        let offset = 0;
        result.set(signature, offset);
        offset += signature.length;
        result.set(ihdrChunk, offset);
        offset += ihdrChunk.length;
        result.set(idatChunk, offset);
        offset += idatChunk.length;
        result.set(iendChunk, offset);

        return result.buffer;
    }

    /**
     * Create PNG signature (8 bytes)
     * @returns {Uint8Array} PNG signature
     * @private
     */
    static _createSignature() {
        return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    }

    /**
     * Create scanlines with filter bytes
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {Uint8ClampedArray} data - RGBA pixel data (non-premultiplied)
     * @returns {Uint8Array} Scanlines with filter bytes
     * @private
     */
    static _createScanlines(width, height, data) {
        const bytesPerPixel = 4; // RGBA
        const stride = width * bytesPerPixel;
        const scanlineLength = stride + 1; // +1 for filter byte
        const result = new Uint8Array(scanlineLength * height);

        let srcOffset = 0;
        let destOffset = 0;

        for (let y = 0; y < height; y++) {
            // Filter type 0 (None)
            result[destOffset++] = 0;

            // Copy scanline (RGBA order, already non-premultiplied)
            for (let x = 0; x < width; x++) {
                result[destOffset++] = data[srcOffset++]; // R
                result[destOffset++] = data[srcOffset++]; // G
                result[destOffset++] = data[srcOffset++]; // B
                result[destOffset++] = data[srcOffset++]; // A
            }
        }

        return result;
    }

    /**
     * Create zlib data with stored DEFLATE blocks
     * @param {Uint8Array} uncompressed - Uncompressed scanline data
     * @returns {Uint8Array} Zlib-wrapped data
     * @private
     */
    static _createZlibData(uncompressed) {
        // Zlib header (CMF=0x78, FLG=0x01 for stored blocks)
        const header = new Uint8Array([0x78, 0x01]);

        // Split into DEFLATE stored blocks (max 65535 bytes per block)
        const blocks = [];
        const maxBlockSize = 65535;
        let offset = 0;

        while (offset < uncompressed.length) {
            const remaining = uncompressed.length - offset;
            const blockSize = Math.min(maxBlockSize, remaining);
            const isLastBlock = offset + blockSize === uncompressed.length;

            // Block header: BFINAL (1 bit) + BTYPE (2 bits, 00 = stored)
            const bfinal = isLastBlock ? 1 : 0;
            const blockHeader = new Uint8Array(5);
            blockHeader[0] = bfinal; // BFINAL=1 if last, BTYPE=00

            // LEN (little-endian)
            blockHeader[1] = blockSize & 0xff;
            blockHeader[2] = (blockSize >>> 8) & 0xff;

            // NLEN (bitwise NOT of LEN, little-endian)
            const nlen = ~blockSize & 0xffff;
            blockHeader[3] = nlen & 0xff;
            blockHeader[4] = (nlen >>> 8) & 0xff;

            blocks.push(blockHeader);
            blocks.push(uncompressed.subarray(offset, offset + blockSize));

            offset += blockSize;
        }

        // Calculate Adler-32 checksum
        const adler32 = PngEncoder._calculateAdler32(uncompressed);
        const trailer = PngEncoder._u32be(adler32);

        // Concatenate all parts
        let totalLength = header.length + trailer.length;
        for (const block of blocks) {
            totalLength += block.length;
        }

        const result = new Uint8Array(totalLength);
        let resultOffset = 0;

        result.set(header, resultOffset);
        resultOffset += header.length;

        for (const block of blocks) {
            result.set(block, resultOffset);
            resultOffset += block.length;
        }

        result.set(trailer, resultOffset);

        return result;
    }

    /**
     * Create IHDR chunk (image header)
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Uint8Array} IHDR chunk
     * @private
     */
    static _createIHDRChunk(width, height) {
        const data = new Uint8Array(13);

        // Width (4 bytes, big-endian)
        const widthBytes = PngEncoder._u32be(width);
        data.set(widthBytes, 0);

        // Height (4 bytes, big-endian)
        const heightBytes = PngEncoder._u32be(height);
        data.set(heightBytes, 4);

        // Bit depth: 8 bits per channel
        data[8] = 8;

        // Color type: 6 = RGBA (RGB + alpha)
        data[9] = 6;

        // Compression method: 0 = DEFLATE
        data[10] = 0;

        // Filter method: 0 = basic 5-filter set
        data[11] = 0;

        // Interlace method: 0 = none
        data[12] = 0;

        return PngEncoder._createChunk('IHDR', data);
    }

    /**
     * Create IDAT chunk (image data)
     * @param {Uint8Array} zlibData - Zlib-compressed image data
     * @returns {Uint8Array} IDAT chunk
     * @private
     */
    static _createIDATChunk(zlibData) {
        return PngEncoder._createChunk('IDAT', zlibData);
    }

    /**
     * Create IEND chunk (end marker)
     * @returns {Uint8Array} IEND chunk
     * @private
     */
    static _createIENDChunk() {
        return PngEncoder._createChunk('IEND', new Uint8Array(0));
    }

    /**
     * Create a PNG chunk with length, type, data, and CRC
     * @param {string} type - 4-character chunk type
     * @param {Uint8Array} data - Chunk data
     * @returns {Uint8Array} Complete chunk
     * @private
     */
    static _createChunk(type, data) {
        if (type.length !== 4) {
            throw new Error('Chunk type must be exactly 4 characters');
        }

        const typeBytes = new TextEncoder().encode(type);
        const length = data.length;
        const lengthBytes = PngEncoder._u32be(length);

        // Calculate CRC over type + data
        const crcInput = new Uint8Array(typeBytes.length + data.length);
        crcInput.set(typeBytes, 0);
        crcInput.set(data, typeBytes.length);
        const crc = PngEncoder._calculateCRC32(crcInput);
        const crcBytes = PngEncoder._u32be(crc);

        // Assemble chunk: length + type + data + crc
        const chunk = new Uint8Array(4 + 4 + length + 4);
        let offset = 0;

        chunk.set(lengthBytes, offset);
        offset += lengthBytes.length;
        chunk.set(typeBytes, offset);
        offset += typeBytes.length;
        chunk.set(data, offset);
        offset += data.length;
        chunk.set(crcBytes, offset);

        return chunk;
    }

    /**
     * Convert 32-bit unsigned integer to big-endian bytes
     * @param {number} value - Value to convert
     * @returns {Uint8Array} 4-byte big-endian representation
     * @private
     */
    static _u32be(value) {
        const bytes = new Uint8Array(4);
        bytes[0] = (value >>> 24) & 0xff;
        bytes[1] = (value >>> 16) & 0xff;
        bytes[2] = (value >>> 8) & 0xff;
        bytes[3] = value & 0xff;
        return bytes;
    }

    /**
     * Calculate CRC-32 checksum
     * @param {Uint8Array} data - Data to checksum
     * @returns {number} CRC-32 value
     * @private
     */
    static _calculateCRC32(data) {
        let crc = 0xffffffff;

        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];

            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
            }
        }

        return (crc ^ 0xffffffff) >>> 0;
    }

    /**
     * Calculate Adler-32 checksum
     * @param {Uint8Array} data - Data to checksum
     * @returns {number} Adler-32 value
     * @private
     */
    static _calculateAdler32(data) {
        let s1 = 1;
        let s2 = 0;
        const MOD_ADLER = 65521;

        for (let i = 0; i < data.length; i++) {
            s1 = (s1 + data[i]) % MOD_ADLER;
            s2 = (s2 + s1) % MOD_ADLER;
        }

        return ((s2 << 16) | s1) >>> 0;
    }

    /**
     * Get PNG file information without encoding (for debugging/info)
     * @param {Surface} surface - Surface to analyze
     * @returns {Object} PNG file information
     */
    static getPNGInfo(surface) {
        if (!surface || !surface.width || !surface.height) {
            throw new Error('Invalid surface');
        }

        const scanlineBytes = (surface.width * 4 + 1) * surface.height; // +1 for filter bytes
        const approximateFileSize = scanlineBytes + 200; // PNG headers + zlib overhead

        return {
            width: surface.width,
            height: surface.height,
            colorType: 'RGBA (6)',
            bitDepth: 8,
            compression: 'DEFLATE (stored blocks)',
            filter: 'None (0)',
            interlace: 'None (0)',
            approximateFileSize: approximateFileSize,
            scanlineBytes: scanlineBytes
        };
    }

    /**
     * Validate that a surface can be encoded to PNG
     * @param {Surface} surface - Surface to validate
     * @returns {boolean} True if surface can be encoded
     */
    static canEncode(surface) {
        try {
            if (!surface || typeof surface !== 'object') return false;
            if (!surface.width || !surface.height || !surface.data) return false;
            if (surface.width <= 0 || surface.height <= 0) return false;
            if (surface.width > PngEncoder.MAX_DIMENSION || surface.height > PngEncoder.MAX_DIMENSION) return false;

            const expectedSize = surface.width * surface.height * 4;
            return surface.data.length === expectedSize;
        } catch (error) {
            return false;
        }
    }

    /**
     * Calculate memory usage for PNG encoding
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {number} Approximate memory usage in bytes
     */
    static calculateMemoryUsage(width, height) {
        if (width <= 0 || height <= 0) return 0;

        // Scanlines + PNG overhead
        return width * height * 4 + height * 1 + 200;
    }
}

// Class constants
PngEncoder.MAX_DIMENSION = 65535; // PNG supports up to 2^31-1, but this is reasonable limit

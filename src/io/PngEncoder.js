/**
 * PngEncoder class for SWCanvas
 *
 * Encodes Surface data as a PNG: 8-bit RGBA (colour type 6), alpha kept exactly as the surface
 * holds it (non-premultiplied). Each scanline is given the PNG filter (0-4) whose residuals have the
 * smallest sum of absolute values, and the filtered bytes are DEFLATE-compressed with LZ77 (3-byte
 * hash chains over the 32 KB window) and the FIXED Huffman codes (block type 1): the code tables
 * are the DEFLATE specification's own, so none is built or transmitted.
 *
 * DETERMINISM: the output is a pure function of the pixels and the options — integer arithmetic
 * only, no platform compressor (CompressionStream would hand back each engine's own zlib bytes),
 * every tie broken by a fixed rule — so identical pixels give identical bytes in every engine.
 * SWCanvasElement.toDataURL promises exactly that to its callers, and the PNGs this repo commits
 * under tests/ stay meaningful to `git diff` because of it.
 *
 * SYNCHRONOUS, because HTML5's toDataURL is.
 *
 * FIXED codes, not dynamic ones: on drawn canvases the fixed codes already land within ~1.2x of
 * the browser's own encoder (a 99.3% cut from the stored form), and per-image dynamic codes would
 * save only ~7-11 KB more per drawing for a second, larger code path.
 *
 * compressionLevel 0 writes the uncompressed form (filter 0 rows in STORED blocks). Levels 1-9
 * bound how many earlier positions the match search visits per byte (PngEncoder.MAX_CHAIN).
 * Whatever the level, a stream that would come out larger than STORED blocks is written STORED.
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

        const level = options.compressionLevel;
        const zlibData =
            level === 0
                ? PngEncoder._createZlibData(PngEncoder._createScanlines(width, height, data))
                : PngEncoder._createCompressedZlibData(
                      PngEncoder._createFilteredScanlines(width, height, data),
                      PngEncoder.MAX_CHAIN[level]
                  );

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
     * Create scanlines with filter bytes, every row filter 0 (None) — the compressionLevel 0 form
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
     * Create scanlines with filter bytes, each row filtered by the PNG filter (0 None, 1 Sub, 2 Up,
     * 3 Average, 4 Paeth) whose residuals, read as signed bytes, have the smallest sum of absolute
     * values (the PNG specification's recommended heuristic). A tie goes to the lower filter number.
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {Uint8ClampedArray} data - RGBA pixel data (non-premultiplied)
     * @returns {Uint8Array} Filtered scanlines, each led by its filter byte
     * @private
     */
    static _createFilteredScanlines(width, height, data) {
        const bpp = 4; // bytes per pixel: the filters' left neighbour is one PIXEL back
        const stride = width * bpp;
        const result = new Uint8Array((stride + 1) * height);
        let dest = 0;

        for (let y = 0; y < height; y++) {
            const row = y * stride;
            const up = row - stride; // read only when y > 0

            // Pass 1: the residual sum each filter would leave (left/up/up-left read as 0 off the image)
            let s0 = 0;
            let s1 = 0;
            let s2 = 0;
            let s3 = 0;
            let s4 = 0;
            for (let x = 0; x < stride; x++) {
                const cur = data[row + x];
                const a = x >= bpp ? data[row + x - bpp] : 0;
                const b = y > 0 ? data[up + x] : 0;
                const c = x >= bpp && y > 0 ? data[up + x - bpp] : 0;
                let r = cur;
                s0 += r < 128 ? r : 256 - r;
                r = (cur - a) & 0xff;
                s1 += r < 128 ? r : 256 - r;
                r = (cur - b) & 0xff;
                s2 += r < 128 ? r : 256 - r;
                r = (cur - ((a + b) >>> 1)) & 0xff;
                s3 += r < 128 ? r : 256 - r;
                r = (cur - PngEncoder._paeth(a, b, c)) & 0xff;
                s4 += r < 128 ? r : 256 - r;
            }

            let filter = 0;
            let best = s0;
            if (s1 < best) {
                filter = 1;
                best = s1;
            }
            if (s2 < best) {
                filter = 2;
                best = s2;
            }
            if (s3 < best) {
                filter = 3;
                best = s3;
            }
            if (s4 < best) {
                filter = 4;
            }

            // Pass 2: write the row under the chosen filter
            result[dest++] = filter;
            for (let x = 0; x < stride; x++) {
                const cur = data[row + x];
                const a = x >= bpp ? data[row + x - bpp] : 0;
                const b = y > 0 ? data[up + x] : 0;
                let predicted;
                switch (filter) {
                    case 0:
                        predicted = 0;
                        break;
                    case 1:
                        predicted = a;
                        break;
                    case 2:
                        predicted = b;
                        break;
                    case 3:
                        predicted = (a + b) >>> 1;
                        break;
                    default:
                        predicted = PngEncoder._paeth(a, b, x >= bpp && y > 0 ? data[up + x - bpp] : 0);
                }
                result[dest++] = (cur - predicted) & 0xff;
            }
        }

        return result;
    }

    /**
     * The Paeth predictor: whichever of left, up and up-left is nearest to left + up - upLeft,
     * ties resolved in that order
     * @param {number} a - Left byte
     * @param {number} b - Up byte
     * @param {number} c - Up-left byte
     * @returns {number} The predicted byte
     * @private
     */
    static _paeth(a, b, c) {
        const pa = b > c ? b - c : c - b;
        const pb = a > c ? a - c : c - a;
        const pcSigned = a + b - c - c;
        const pc = pcSigned < 0 ? -pcSigned : pcSigned;
        if (pa <= pb && pa <= pc) return a;
        if (pb <= pc) return b;
        return c;
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
        const blocks = PngEncoder._createStoredBlocks(uncompressed);

        // Calculate Adler-32 checksum
        const adler32 = PngEncoder._calculateAdler32(uncompressed);
        const trailer = PngEncoder._u32be(adler32);

        const result = new Uint8Array(header.length + blocks.length + trailer.length);
        result.set(header, 0);
        result.set(blocks, header.length);
        result.set(trailer, header.length + blocks.length);
        return result;
    }

    /**
     * Create zlib data holding one fixed-Huffman DEFLATE block, or STORED blocks when those are
     * smaller (input LZ77 cannot shrink: 9-bit literals would outgrow the 8-bit bytes)
     * @param {Uint8Array} uncompressed - Filtered scanline data
     * @param {number} maxChain - How many earlier positions a match search may visit
     * @returns {Uint8Array} Zlib-wrapped data
     * @private
     */
    static _createCompressedZlibData(uncompressed, maxChain) {
        let deflated = PngEncoder._deflateFixed(uncompressed, maxChain);
        if (deflated.length > PngEncoder._storedBlocksLength(uncompressed.length)) {
            deflated = PngEncoder._createStoredBlocks(uncompressed);
        }

        // Zlib header: CMF=0x78 (DEFLATE, 32 KB window), FLG=0x5E (FLEVEL 1 "fast"; FCHECK makes
        // CMF*256+FLG a multiple of 31). FLEVEL is informational: decoders ignore it.
        const header = new Uint8Array([0x78, 0x5e]);
        const trailer = PngEncoder._u32be(PngEncoder._calculateAdler32(uncompressed));

        const result = new Uint8Array(header.length + deflated.length + trailer.length);
        result.set(header, 0);
        result.set(deflated, header.length);
        result.set(trailer, header.length + deflated.length);
        return result;
    }

    /**
     * Total length of the STORED-block form of n bytes (5 header bytes per 65535-byte block)
     * @param {number} n - Uncompressed length
     * @returns {number} Length in bytes
     * @private
     */
    static _storedBlocksLength(n) {
        return n + 5 * Math.max(1, Math.ceil(n / 65535));
    }

    /**
     * DEFLATE STORED blocks (BTYPE 00) carrying the input verbatim, the last one marked BFINAL
     * @param {Uint8Array} uncompressed - Data to store
     * @returns {Uint8Array} The blocks, concatenated
     * @private
     */
    static _createStoredBlocks(uncompressed) {
        const maxBlockSize = 65535;
        const result = new Uint8Array(PngEncoder._storedBlocksLength(uncompressed.length));
        let offset = 0;
        let out = 0;

        do {
            const blockSize = Math.min(maxBlockSize, uncompressed.length - offset);
            const isLastBlock = offset + blockSize === uncompressed.length;
            const nlen = ~blockSize & 0xffff;

            // Block header: BFINAL (1 bit) + BTYPE (2 bits, 00 = stored), then LEN and NLEN little-endian
            result[out++] = isLastBlock ? 1 : 0;
            result[out++] = blockSize & 0xff;
            result[out++] = (blockSize >>> 8) & 0xff;
            result[out++] = nlen & 0xff;
            result[out++] = (nlen >>> 8) & 0xff;

            result.set(uncompressed.subarray(offset, offset + blockSize), out);
            out += blockSize;
            offset += blockSize;
        } while (offset < uncompressed.length);

        return result;
    }

    /**
     * One DEFLATE block of BTYPE 01 (fixed Huffman codes): greedy LZ77 over 3-byte hash chains in
     * the 32 KB window. A search stops at the first 258-byte match (the longest DEFLATE can say),
     * and a 3-byte match farther than 4096 back is sent as literals (it would cost more bits).
     * @param {Uint8Array} input - Bytes to compress
     * @param {number} maxChain - How many earlier positions a match search may visit
     * @returns {Uint8Array} The block, padded to a whole byte
     * @private
     */
    static _deflateFixed(input, maxChain) {
        const T = PngEncoder._FIXED_TABLES;
        const n = input.length;
        const WSIZE = 32768;
        const WMASK = WSIZE - 1;
        const HMASK = 32767;
        const MAX_MATCH = 258;
        const head = new Int32Array(HMASK + 1).fill(-1);
        const prev = new Int32Array(WSIZE);
        // worst case: every byte a 9-bit literal, plus the 3-bit header and 7-bit end-of-block
        const out = new Uint8Array(Math.ceil((n * 9 + 10) / 8) + 4);
        let op = 0;
        let bitBuf = 0;
        let bitCount = 0;

        // Block header: BFINAL=1, BTYPE=01
        bitBuf = 1 | (1 << 1);
        bitCount = 3;

        let i = 0;
        while (i < n) {
            let bestLen = 0;
            let bestDist = 0;

            if (i + 2 < n) {
                const h = ((input[i] << 10) ^ (input[i + 1] << 5) ^ input[i + 2]) & HMASK;
                const maxLen = n - i < MAX_MATCH ? n - i : MAX_MATCH;
                let candidate = head[h];
                let chain = maxChain;
                while (candidate >= 0 && i - candidate <= WSIZE && chain-- > 0) {
                    if (input[candidate + bestLen] === input[i + bestLen]) {
                        let len = 0;
                        while (len < maxLen && input[candidate + len] === input[i + len]) len++;
                        if (len > bestLen) {
                            bestLen = len;
                            bestDist = i - candidate;
                            if (len === maxLen) break;
                        }
                    }
                    candidate = prev[candidate & WMASK];
                }
                prev[i & WMASK] = head[h];
                head[h] = i;
                if (bestLen === 3 && bestDist > 4096) bestLen = 0;
            }

            if (bestLen >= 3) {
                // length: its symbol's code, then the extra bits
                const sym = T.lengthSymbol[bestLen];
                bitBuf |= T.litCode[sym] << bitCount;
                bitCount += T.litLength[sym];
                bitBuf |= (bestLen - T.lengthBase[sym - 257]) << bitCount;
                bitCount += T.lengthExtra[sym - 257];
                while (bitCount >= 8) {
                    out[op++] = bitBuf & 0xff;
                    bitBuf >>>= 8;
                    bitCount -= 8;
                }
                // distance: its 5-bit code, then the extra bits
                const d = bestDist - 1;
                const dsym = d < 256 ? T.distSymbol[d] : T.distSymbol[256 + (d >>> 7)];
                bitBuf |= T.distCode[dsym] << bitCount;
                bitCount += 5;
                bitBuf |= (bestDist - T.distBase[dsym]) << bitCount;
                bitCount += T.distExtra[dsym];
                while (bitCount >= 8) {
                    out[op++] = bitBuf & 0xff;
                    bitBuf >>>= 8;
                    bitCount -= 8;
                }
                // the positions the match covers join the hash chains too
                const end = i + bestLen;
                for (i++; i < end; i++) {
                    if (i + 2 < n) {
                        const h = ((input[i] << 10) ^ (input[i + 1] << 5) ^ input[i + 2]) & HMASK;
                        prev[i & WMASK] = head[h];
                        head[h] = i;
                    }
                }
            } else {
                const sym = input[i++];
                bitBuf |= T.litCode[sym] << bitCount;
                bitCount += T.litLength[sym];
                while (bitCount >= 8) {
                    out[op++] = bitBuf & 0xff;
                    bitBuf >>>= 8;
                    bitCount -= 8;
                }
            }
        }

        // End of block (symbol 256, the 7-bit code 0000000), then pad to a byte
        bitCount += T.litLength[256];
        while (bitCount > 0) {
            out[op++] = bitBuf & 0xff;
            bitBuf >>>= 8;
            bitCount -= 8;
        }

        return out.subarray(0, op);
    }

    /**
     * The fixed Huffman code tables of DEFLATE (RFC 1951 §3.2.6) and the length/distance symbol
     * lookups, codes stored bit-reversed because DEFLATE packs a code's most significant bit first
     * into a least-significant-bit-first stream
     * @returns {Object} The tables
     * @private
     */
    static _buildFixedTables() {
        const reverse = (code, length) => {
            let r = 0;
            for (let k = 0; k < length; k++) {
                r = (r << 1) | (code & 1);
                code >>>= 1;
            }
            return r;
        };

        // Literal/length alphabet 0-287: 0-143 8 bits from 0x30, 144-255 9 bits from 0x190,
        // 256-279 7 bits from 0, 280-287 8 bits from 0xC0
        const litCode = new Uint16Array(288);
        const litLength = new Uint8Array(288);
        for (let s = 0; s < 288; s++) {
            let code;
            let length;
            if (s < 144) {
                code = 0x30 + s;
                length = 8;
            } else if (s < 256) {
                code = 0x190 + s - 144;
                length = 9;
            } else if (s < 280) {
                code = s - 256;
                length = 7;
            } else {
                code = 0xc0 + s - 280;
                length = 8;
            }
            litCode[s] = reverse(code, length);
            litLength[s] = length;
        }

        // Length symbols 257-285: base lengths and extra-bit counts
        const lengthBase = new Uint16Array([
            3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195,
            227, 258
        ]);
        const lengthExtra = new Uint8Array([
            0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0
        ]);
        const lengthSymbol = new Uint16Array(259);
        for (let k = 0; k < 29; k++) {
            const last = k === 28 ? 258 : lengthBase[k] + (1 << lengthExtra[k]) - 1;
            for (let len = lengthBase[k]; len <= last && len <= 258; len++) lengthSymbol[len] = 257 + k;
        }
        lengthSymbol[258] = 285; // 258 has its own symbol, not 284 with all extra bits set

        // Distance codes 0-29: base distances and extra-bit counts; the 5-bit codes are the symbols
        const distBase = new Uint16Array([
            1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097,
            6145, 8193, 12289, 16385, 24577
        ]);
        const distExtra = new Uint8Array([
            0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13
        ]);
        const distCode = new Uint8Array(30);
        for (let k = 0; k < 30; k++) distCode[k] = reverse(k, 5);
        // distance-1 below 256 indexes directly; above, (distance-1) >>> 7 indexes the upper half
        const distSymbol = new Uint8Array(512);
        for (let k = 0; k < 30; k++) {
            const first = distBase[k] - 1;
            const last = distBase[k] + (1 << distExtra[k]) - 2;
            for (let d = first; d <= last; d++) {
                if (d < 256) distSymbol[d] = k;
                else distSymbol[256 + (d >>> 7)] = k;
            }
        }

        return { litCode, litLength, lengthBase, lengthExtra, lengthSymbol, distBase, distExtra, distCode, distSymbol };
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
     * Calculate Adler-32 checksum. The modulo is taken every 5552 bytes, the longest run whose
     * sums cannot overflow 2^32 (zlib's NMAX), which gives the same value as a per-byte modulo.
     * @param {Uint8Array} data - Data to checksum
     * @returns {number} Adler-32 value
     * @private
     */
    static _calculateAdler32(data) {
        let s1 = 1;
        let s2 = 0;
        const MOD_ADLER = 65521;
        const NMAX = 5552;

        for (let i = 0; i < data.length; ) {
            const end = Math.min(i + NMAX, data.length);
            for (; i < end; i++) {
                s1 += data[i];
                s2 += s1;
            }
            s1 %= MOD_ADLER;
            s2 %= MOD_ADLER;
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
            compression: 'DEFLATE (fixed Huffman; stored blocks when smaller, or at compressionLevel 0)',
            filter: 'Per row, minimum sum of absolute differences (0-4); None (0) at compressionLevel 0',
            interlace: 'None (0)',
            approximateFileSize: approximateFileSize, // the compressionLevel 0 size: an upper bound otherwise
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

        // Filtered scanlines + the worst-case compressed buffer (9-bit literals) + the hash chains
        const scanlineBytes = width * height * 4 + height;
        return scanlineBytes + Math.ceil((scanlineBytes * 9) / 8) + 4 * 65536 + 200;
    }
}

// Class constants
PngEncoder.MAX_DIMENSION = 65535; // PNG supports up to 2^31-1, but this is reasonable limit
// Match-search bound per compressionLevel (index = level; level 0 does not search)
PngEncoder.MAX_CHAIN = Object.freeze([0, 4, 8, 16, 32, 64, 128, 256, 1024, 4096]);
PngEncoder._FIXED_TABLES = PngEncoder._buildFixedTables();

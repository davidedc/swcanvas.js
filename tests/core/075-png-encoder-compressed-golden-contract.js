// Test: PngEncoder's output is pinned byte for byte, compresses, and keeps level 0 as the stored form
// This file will be concatenated into the main test suite
//
// PngEncoder promises that identical pixels give identical bytes in every engine (toDataURL's
// callers rely on it, and so do the PNGs this repo commits under tests/). 038 checks that within one
// run; this test pins the bytes themselves, so ANY change to the encoder's output fails here and has
// to be a deliberate re-golden. Run in Node and in the browser test page, it is also the
// cross-engine check: both must reproduce the same golden.
//
// The fixture raster is written into a Surface directly — no rasterizer involved — so a rendering
// change can never move these goldens; only an encoder change can. It has an opaque half (a
// gradient beside a flat colour) and a translucent half (an alpha ramp over a varying colour, with a
// fully clear corner), so alpha < 255 is in the pinned bytes.
//
// The golden bytes decode (zlib, PIL) to exactly this raster, and the level-0 golden is the stored
// encoder's output byte for byte. Re-cut a golden only after re-verifying that with a real decoder:
// no decoder lives in this test, by design (it must run unchanged in the browser).
//
// Contract pinned here:
//   1. the default encoding (compressionLevel 6) has the golden length and FNV-1a hash, and is a
//      zlib stream (CMF 0x78, FLG 0x5E) whose DEFLATE block uses the fixed Huffman codes (BTYPE 01);
//   2. it is under a quarter of the stored form's length — a bound level 0 cannot meet;
//   3. compressionLevel 0 still writes the stored form: filter 0 on every row, STORED blocks
//      (CMF 0x78, FLG 0x01), the exact expected length and its own golden hash;
//   4. PngEncodingOptions.DEFAULT is level 6, and encoding twice gives identical bytes.

test('PngEncoder - golden bytes at the default level, a compression bound, level 0 = stored form', () => {
    const W = 64;
    const H = 48;
    const GOLDEN_LENGTH = 338;
    const GOLDEN_FNV = '911bbd37';
    const GOLDEN_STORED_FNV = '265c26c7';

    // 32-bit FNV-1a over the bytes, as 8 hex digits
    function fnv1a(bytes) {
        let h = 0x811c9dc5;
        for (let i = 0; i < bytes.length; i++) {
            h ^= bytes[i];
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return ('0000000' + h.toString(16)).slice(-8);
    }

    function fixtureSurface() {
        const surface = SWCanvas.Core.Surface(W, H);
        const d = surface.data;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                if (y < H / 2) {
                    const flat = x >= W / 2;
                    d[o] = flat ? 40 : (x * 8) & 255;
                    d[o + 1] = flat ? 80 : (y * 10) & 255;
                    d[o + 2] = flat ? 160 : 128;
                    d[o + 3] = 255;
                } else if (x < 8 && y >= H - 8) {
                    d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0;
                } else {
                    d[o] = 200;
                    d[o + 1] = (x * 7) & 255;
                    d[o + 2] = 50;
                    d[o + 3] = (x * 3 + y * 5) & 255;
                }
            }
        }
        return surface;
    }

    const surface = fixtureSurface();
    const options = SWCanvas.Core.PngEncodingOptions;
    const encoded = new Uint8Array(SWCanvas.Core.PngEncoder.encode(surface));

    // 1. golden bytes, zlib header, fixed Huffman block
    const encodedFnv = fnv1a(encoded);
    assertEquals(encoded.length, GOLDEN_LENGTH, 'default-level PNG length: expected ' + GOLDEN_LENGTH + ', got ' +
        encoded.length);
    assertEquals(encodedFnv, GOLDEN_FNV, 'default-level PNG FNV-1a: expected ' + GOLDEN_FNV + ', got ' + encodedFnv);
    // signature 8 + IHDR chunk 25 + IDAT length/type 8: the zlib stream starts at byte 41
    assertEquals(encoded[25], 6, 'colour type 6 (RGBA)');
    assertEquals(encoded[41], 0x78, 'zlib CMF');
    assertEquals(encoded[42], 0x5e, 'zlib FLG of the compressed form');
    assertEquals((encoded[43] >> 1) & 3, 1, 'DEFLATE block type 01 (fixed Huffman)');

    // 3. level 0: the stored form, laid out exactly
    const rowBytes = W * 4 + 1;
    const scanlineBytes = rowBytes * H;
    const storedLength = 8 + 25 + 12 + 2 + scanlineBytes + 5 * Math.ceil(scanlineBytes / 65535) + 4 + 12;
    const stored = new Uint8Array(SWCanvas.Core.PngEncoder.encode(surface, options.withCompressionLevel(0)));
    assertEquals(stored.length, storedLength, 'level-0 PNG length: expected ' + storedLength + ', got ' +
        stored.length);
    assertEquals(stored[42], 0x01, 'zlib FLG of the stored form');
    assertEquals(stored[43], 1, 'one STORED block, BFINAL set');
    assertEquals(stored[44] | (stored[45] << 8), scanlineBytes, 'STORED block LEN');
    for (let y = 0; y < H; y++) {
        const row = 48 + y * rowBytes;
        assertEquals(stored[row], 0, 'level 0 writes filter 0 on row ' + y);
        for (let i = 0; i < W * 4; i++) {
            if (stored[row + 1 + i] !== surface.data[y * surface.stride + i]) {
                throw new Error('level 0 row ' + y + ' byte ' + i + ' is not the raw pixel byte');
            }
        }
    }
    const storedFnv = fnv1a(stored);
    assertEquals(storedFnv, GOLDEN_STORED_FNV, 'level-0 PNG FNV-1a: expected ' + GOLDEN_STORED_FNV + ', got ' +
        storedFnv);

    // 2. the bound level 0 cannot meet
    if (!(encoded.length * 4 < storedLength)) {
        throw new Error('default-level PNG (' + encoded.length + ' bytes) is not under a quarter of the stored form (' +
            storedLength + ')');
    }

    // 4. the default level, and determinism within the run
    assertEquals(options.DEFAULT.compressionLevel, 6, 'PngEncodingOptions.DEFAULT is level 6');
    const again = new Uint8Array(SWCanvas.Core.PngEncoder.encode(surface, options.withCompressionLevel(6)));
    assertEquals(fnv1a(again), encodedFnv, 'level 6 encoded again gives the same bytes as the default');
});

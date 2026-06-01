// Test: getImageData/putImageData round-trips byte-exactly.
// SWCanvas stores non-premultiplied RGBA8, so unlike a browser canvas this is
// lossless even for partial alpha. Fizzygum relies on this for pixel hit-testing
// (Widget.fullImage, BackBufferMixin point-alpha, PreferencesAndSettings probe).

test('putImageData then getImageData returns identical bytes (incl. partial alpha)', () => {
    const canvas = SWCanvas.createCanvas(6, 5);
    const ctx = canvas.getContext('2d');

    const src = ctx.createImageData(6, 5);
    for (let i = 0; i < src.data.length; i += 4) {
        src.data[i]     = (i * 7) & 0xff;        // R
        src.data[i + 1] = (i * 13 + 5) & 0xff;   // G
        src.data[i + 2] = (i * 31 + 17) & 0xff;  // B
        src.data[i + 3] = (i % 8 === 0) ? 128 : 255; // A (mix in partial alpha)
    }

    ctx.putImageData(src, 0, 0);
    const out = ctx.getImageData(0, 0, 6, 5);

    assertEquals(out.width, 6, 'width');
    assertEquals(out.height, 5, 'height');
    let mismatches = 0;
    for (let i = 0; i < src.data.length; i++) {
        if (out.data[i] !== src.data[i]) mismatches++;
    }
    assertEquals(mismatches, 0, 'every RGBA byte must round-trip exactly');
});

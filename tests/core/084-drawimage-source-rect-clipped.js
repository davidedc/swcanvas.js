// Test: drawImage source rects outside the image are clipped, negative sizes
// are normalised, and a zero-size source draws nothing (HTML5 drawImage steps)
// This file will be concatenated into the main test suite
//
// HTML5 drawImage: "When the source rectangle is outside the source image, the
// source rectangle must be clipped to the source image and the destination
// rectangle must be clipped in the same proportion." - "If one of the sw or sh
// arguments is zero, then return." - "The image data must be processed in the
// original direction, even if the dimensions given are negative." Contract
// pinned here, smoothing on and off:
//   1. a source rect reaching outside the image (each side, all sides) paints
//      exactly what the same draw with the PRE-CLIPPED rects paints, and one
//      wholly outside paints nothing - none of them throws;
//   2. a negative sw/sh or dw/dh names the same rect from its other corner and
//      is drawn unmirrored: it paints exactly what the normalised call paints;
//   3. a zero sw or sh paints nothing.
// Every rect below scales by exactly 2, so the clipped rects are exact.

test('drawImage: source rect clipped to the image, negative sizes normalised, zero size draws nothing', () => {
    const W = 48;
    const H = 40;

    // 10x8 opaque image, every texel distinct
    const image = SWCanvas.createCanvas(10, 8);
    const imageCtx = image.getContext('2d');
    const texels = imageCtx.createImageData(10, 8);
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 10; x++) {
            const o = (y * 10 + x) * 4;
            texels.data[o] = x * 25;
            texels.data[o + 1] = y * 30;
            texels.data[o + 2] = 100;
            texels.data[o + 3] = 255;
        }
    }
    imageCtx.putImageData(texels, 0, 0);

    function render(args, smoothing) {
        const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
        ctx.imageSmoothingEnabled = smoothing;
        ctx.drawImage(image, ...args);
        return ctx.getImageData(0, 0, W, H).data;
    }

    function painted(data) {
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++;
        return n;
    }

    function assertSame(label, args, expectedArgs) {
        for (const smoothing of [true, false]) {
            let actual;
            try {
                actual = render(args, smoothing);
            } catch (e) {
                throw new Error(label + ': drawImage threw "' + e.message + '"');
            }
            const expected = render(expectedArgs, smoothing);
            let differing = 0;
            for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) differing++;
            assertEquals(differing, 0, label + ' (smoothing ' + smoothing + '): bytes differing from the expected draw');
            assertEquals(painted(actual) > 0, true, label + ': paints something');
        }
    }

    // 1. Clipped to the image, the destination in the same proportion (x2)
    assertSame('left', [-4, 1, 8, 5, 5, 5, 16, 10], [0, 1, 4, 5, 13, 5, 8, 10]);
    assertSame('right', [6, 1, 8, 5, 5, 5, 16, 10], [6, 1, 4, 5, 5, 5, 8, 10]);
    assertSame('top', [2, -3, 6, 6, 5, 5, 12, 12], [2, 0, 6, 3, 5, 11, 12, 6]);
    assertSame('bottom', [2, 5, 6, 6, 5, 5, 12, 12], [2, 5, 6, 3, 5, 5, 12, 6]);
    assertSame('all sides', [-2, -2, 14, 12, 2, 2, 28, 24], [0, 0, 10, 8, 6, 6, 20, 16]);
    for (const smoothing of [true, false]) {
        let data;
        try {
            data = render([12, 1, 4, 4, 5, 5, 8, 8], smoothing);
        } catch (e) {
            throw new Error('wholly outside: drawImage threw "' + e.message + '"');
        }
        assertEquals(painted(data), 0, 'wholly outside (smoothing ' + smoothing + '): painted pixels');
    }

    // 2. Negative sizes: the same rect from the other corner, unmirrored
    assertSame('negative sw', [8, 1, -6, 5, 5, 5, 12, 10], [2, 1, 6, 5, 5, 5, 12, 10]);
    assertSame('negative dw', [2, 1, 6, 5, 17, 5, -12, 10], [2, 1, 6, 5, 5, 5, 12, 10]);
    assertSame('negative sh and dh', [2, 6, 6, -5, 5, 15, 12, -10], [2, 1, 6, 5, 5, 5, 12, 10]);
    assertSame('negative dw, 5-argument form', [25, 5, -20, 16], [5, 5, 20, 16]);

    // 3. A zero-size source paints nothing
    for (const smoothing of [true, false]) {
        const label = ' (smoothing ' + smoothing + '): painted pixels';
        assertEquals(painted(render([2, 1, 0, 5, 5, 5, 12, 10], smoothing)), 0, 'zero sw' + label);
        assertEquals(painted(render([2, 1, 6, 0, 5, 5, 12, 10], smoothing)), 0, 'zero sh' + label);
    }
});

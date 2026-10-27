// Test: drawImage under a canvas-wide composite (copy, source-in, source-out,
// destination-in, destination-atop) acts on every pixel the clip lets through
// This file will be concatenated into the main test suite
//
// These operators are defined over the whole canvas: where the source is
// transparent — outside the drawn image, and under its fully transparent
// texels — the result is what the operator gives for a transparent source
// (transparent black, for each of the five), exactly as for a fill. Pinned on
// a destination holding opaque red, under a clip, with an image whose left
// half is opaque blue and right half fully transparent; pixels outside the
// clip keep their red.

test('drawImage: canvas-wide composites act wherever the clip lets them, not only under the image', () => {
    const W = 60;
    const H = 40;

    const image = SWCanvas.createCanvas(20, 10);
    const imageCtx = image.getContext('2d');
    const id = imageCtx.createImageData(20, 10);
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 20; x++) {
            const o = (y * 20 + x) * 4;
            if (x < 10) {
                id.data[o + 2] = 255;
                id.data[o + 3] = 255;
            } else {
                id.data[o] = 255; // colour under zero alpha must not leak
                id.data[o + 3] = 0;
            }
        }
    }
    imageCtx.putImageData(id, 0, 0);

    // Expected at an opaque blue texel over opaque red, per operator.
    const overOpaque = {
        copy: [0, 0, 255, 255],
        'source-in': [0, 0, 255, 255],
        'source-out': [0, 0, 0, 0],
        'destination-in': [255, 0, 0, 255],
        'destination-atop': [255, 0, 0, 255]
    };

    for (const op of Object.keys(overOpaque)) {
        const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
        ctx.fillStyle = 'rgb(255, 0, 0)';
        ctx.fillRect(0, 0, W, H);
        ctx.beginPath();
        ctx.rect(5, 5, 50, 30);
        ctx.clip();
        ctx.globalCompositeOperation = op;
        ctx.drawImage(image, 20, 15);

        const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).join(',');
        assertEquals(px(22, 18), overOpaque[op].join(','), op + ': under an opaque texel');
        assertEquals(px(35, 18), '0,0,0,0', op + ': under a transparent texel');
        assertEquals(px(10, 10), '0,0,0,0', op + ': outside the image, inside the clip');
        assertEquals(px(50, 30), '0,0,0,0', op + ': outside the image, inside the clip (far corner)');
        assertEquals(px(2, 2), '255,0,0,255', op + ': outside the clip');
    }
});

// Test: drawImage's smoothing filter reads clamp-to-edge outside the image and
// the image itself outside the source rect (HTML5 filtering rule)
// This file will be concatenated into the main test suite
//
// HTML5 drawImage: "When the filtering algorithm requires a pixel value from
// outside the original image data, it must instead use the value from the
// nearest edge pixel. (That is, the filter uses 'clamp-to-edge' behavior.)
// When the filtering algorithm requires a pixel value from outside the source
// rectangle but inside the original image data, then the value from the
// original image data must be used." - "Thus, scaling an image in parts or in
// whole will have the same effect." Contract pinned here (smoothing on, so
// every scaled draw takes the bilinear filter):
//   1. an OPAQUE image scaled up stays opaque to its edges - by a rect ratio,
//      by a ctx.scale CTM, and at a non-integer ratio;
//   2. a sub-rect draw blends the texels just outside the source rect into its
//      edge pixels (they are part of the image);
//   3. an image drawn as two abutting sub-rects equals the image drawn whole.

test('drawImage filter: clamp-to-edge outside the image, image data outside the source rect', () => {
    function makeImage(w, h, texel) {
        const canvas = SWCanvas.createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        const id = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const o = (y * w + x) * 4;
                const p = texel(x, y);
                id.data[o] = p[0];
                id.data[o + 1] = p[1];
                id.data[o + 2] = p[2];
                id.data[o + 3] = p[3];
            }
        }
        ctx.putImageData(id, 0, 0);
        return canvas;
    }

    function countPartialAlpha(ctx, x, y, w, h) {
        const d = ctx.getImageData(x, y, w, h).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) n++;
        return n;
    }

    const solid = (w, h) => makeImage(w, h, () => [200, 100, 50, 255]);

    // 1. Opaque stays opaque, edge to edge.
    {
        const ctx = SWCanvas.createCanvas(220, 140).getContext('2d');
        ctx.drawImage(solid(20, 12), 10, 10, 200, 120);
        assertEquals(countPartialAlpha(ctx, 10, 10, 200, 120), 0, '20x12 -> 200x120: dest pixels not fully opaque');
    }
    {
        const ctx = SWCanvas.createCanvas(220, 140).getContext('2d');
        ctx.drawImage(solid(175, 120), 10, 10, 200, 120);
        assertEquals(countPartialAlpha(ctx, 10, 10, 200, 120), 0, '175x120 -> 200x120: dest pixels not fully opaque');
    }
    {
        const ctx = SWCanvas.createCanvas(80, 56).getContext('2d');
        ctx.scale(3, 3);
        ctx.drawImage(solid(20, 12), 2, 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        assertEquals(countPartialAlpha(ctx, 6, 6, 60, 36), 0, 'scale(3) CTM, same-size rects: dest pixels not fully opaque');
    }

    // 2. A sub-rect's edge pixels blend the texels beyond the source rect:
    // orange inside (10,6,20,12), blue around it.
    {
        const framed = makeImage(40, 24, (x, y) =>
            (x >= 10 && x < 30 && y >= 6 && y < 18) ? [255, 128, 0, 255] : [0, 0, 255, 255]);
        const ctx = SWCanvas.createCanvas(220, 140).getContext('2d');
        ctx.drawImage(framed, 10, 6, 20, 12, 10, 10, 200, 120);
        assertEquals(countPartialAlpha(ctx, 10, 10, 200, 120), 0, 'sub-rect up-scale: dest pixels not fully opaque');
        const edge = ctx.getImageData(10, 70, 1, 1).data; // left edge, mid row
        const inner = ctx.getImageData(110, 70, 1, 1).data; // centre
        if (!(edge[2] > 64)) {
            throw new Error('sub-rect left edge pixel must blend the blue texel outside the source rect, got rgba(' + Array.from(edge).join(',') + ')');
        }
        assertEquals(inner[2], 0, 'sub-rect centre stays pure orange (no blue)');
    }

    // 3. In parts or in whole: the same pixels.
    {
        const ramp = makeImage(20, 12, (x, y) => [Math.round(255 * x / 19), Math.round(255 * y / 11), 128, 255]);
        const whole = SWCanvas.createCanvas(220, 140).getContext('2d');
        whole.drawImage(ramp, 10, 10, 200, 120);
        const parts = SWCanvas.createCanvas(220, 140).getContext('2d');
        parts.drawImage(ramp, 0, 0, 10, 12, 10, 10, 100, 120);
        parts.drawImage(ramp, 10, 0, 10, 12, 110, 10, 100, 120);
        const a = whole.getImageData(0, 0, 220, 140).data;
        const b = parts.getImageData(0, 0, 220, 140).data;
        let differing = 0;
        for (let i = 0; i < a.length; i += 4) {
            if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) differing++;
        }
        assertEquals(differing, 0, 'two abutting sub-rect draws vs one whole draw: differing pixels');
    }
});

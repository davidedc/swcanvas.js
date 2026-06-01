// Test: drawImage accepts the source shapes Fizzygum passes — an SWCanvasElement,
// a structural ImageLike, and a canvas-like object (getContext) — and routes
// element image sources (HTMLImageElement/HTMLVideoElement) through the
// scratch-canvas adapter (which throws cleanly when there is no DOM, as in Node).

test('drawImage(SWCanvasElement) blits the source pixels', () => {
    const srcCanvas = SWCanvas.createCanvas(2, 2);
    const sctx = srcCanvas.getContext('2d');
    sctx.fillStyle = 'rgb(220, 30, 40)';
    sctx.fillRect(0, 0, 2, 2);

    const dst = SWCanvas.createCanvas(4, 4);
    const dctx = dst.getContext('2d');
    dctx.drawImage(srcCanvas, 0, 0);

    const px = dctx.getImageData(0, 0, 1, 1).data;
    assertEquals(px[0], 220, 'R');
    assertEquals(px[1], 30, 'G');
    assertEquals(px[2], 40, 'B');
});

test('drawImage(structural ImageLike) blits the source pixels', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 5; data[i + 1] = 200; data[i + 2] = 90; data[i + 3] = 255;
    }
    const imageLike = { width: 2, height: 2, data: data };

    const dst = SWCanvas.createCanvas(3, 3);
    const dctx = dst.getContext('2d');
    dctx.drawImage(imageLike, 1, 1);

    const px = dctx.getImageData(1, 1, 1, 1).data;
    assertEquals(px[0], 5, 'R');
    assertEquals(px[1], 200, 'G');
    assertEquals(px[2], 90, 'B');
});

test('drawImage(canvas-like with getContext) is unwrapped via getImageData', () => {
    // Minimal duck of an HTMLCanvasElement: width/height + getContext('2d')
    // returning an object exposing getImageData.
    const fakeData = new Uint8ClampedArray(1 * 1 * 4);
    fakeData[0] = 17; fakeData[1] = 18; fakeData[2] = 19; fakeData[3] = 255;
    const fakeCanvas = {
        width: 1,
        height: 1,
        getContext: function () {
            return { getImageData: function () { return { width: 1, height: 1, data: fakeData }; } };
        }
    };

    const dst = SWCanvas.createCanvas(2, 2);
    const dctx = dst.getContext('2d');
    dctx.drawImage(fakeCanvas, 0, 0);

    const px = dctx.getImageData(0, 0, 1, 1).data;
    assertEquals(px[0], 17, 'R');
    assertEquals(px[1], 18, 'G');
    assertEquals(px[2], 19, 'B');
});

test('drawImage(element image source) throws cleanly without a DOM canvas', () => {
    const dst = SWCanvas.createCanvas(2, 2);
    const dctx = dst.getContext('2d');
    // Looks like an HTMLImageElement (has naturalWidth) but no DOM to rasterize.
    const fakeImg = { naturalWidth: 2, naturalHeight: 2, complete: false };
    assertThrows(() => dctx.drawImage(fakeImg, 0, 0), 'without a DOM canvas');
});

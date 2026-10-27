// Test: drawImage accepts the source shapes Fizzygum passes — an SWCanvasElement,
// a structural ImageLike, and a canvas-like object (getContext) — and routes
// element image sources (HTMLImageElement/HTMLVideoElement/ImageBitmap) through
// the scratch-canvas adapter: with a DOM it rasterizes them, with HTML5's answer
// for a source that has no pixels yet; without one it throws cleanly.

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

// The element-source tests below need one environment or the other: an element
// image source only exists where there is a DOM (the browser page runs those), and
// SWCanvas's refusal of one only shows where there is none (Node runs that one).

testRequiring('no-dom', 'drawImage(element image source) throws cleanly without a DOM canvas', () => {
    const dst = SWCanvas.createCanvas(2, 2);
    const dctx = dst.getContext('2d');
    // Looks like an HTMLImageElement (has naturalWidth) but no DOM to rasterize.
    const fakeImg = { naturalWidth: 2, naturalHeight: 2, complete: false };
    assertThrows(() => dctx.drawImage(fakeImg, 0, 0), 'without a DOM canvas');
});

testRequiring('dom', 'drawImage(ImageBitmap) blits the element source through the DOM canvas', () => {
    // transferToImageBitmap is synchronous: a real element source with known pixels.
    const offscreen = new OffscreenCanvas(2, 2);
    const octx = offscreen.getContext('2d');
    octx.fillStyle = 'rgb(220, 30, 40)';
    octx.fillRect(0, 0, 2, 2);
    const bitmap = offscreen.transferToImageBitmap();

    const dst = SWCanvas.createCanvas(4, 4);
    const dctx = dst.getContext('2d');
    dctx.drawImage(bitmap, 1, 1);

    const inside = dctx.getImageData(2, 2, 1, 1).data;
    assertEquals(inside[0], 220, 'R');
    assertEquals(inside[1], 30, 'G');
    assertEquals(inside[2], 40, 'B');
    assertEquals(inside[3], 255, 'A');
    assertEquals(dctx.getImageData(0, 0, 1, 1).data[3], 0, 'outside the image stays transparent');
});

testRequiring('dom', 'drawImage of an element source with no pixels yet draws nothing, as HTML5 does', () => {
    // An image without a src and a video with no frame yet are not "fully
    // decodable": HTML5 draws nothing from them (no throw).
    const dst = SWCanvas.createCanvas(2, 2);
    const dctx = dst.getContext('2d');
    dctx.fillStyle = 'rgb(10, 20, 30)';
    dctx.fillRect(0, 0, 2, 2);
    dctx.drawImage(new Image(), 0, 0);
    dctx.drawImage(document.createElement('video'), 0, 0, 2, 2);
    const px = dctx.getImageData(1, 1, 1, 1).data;
    assertEquals(px[0], 10, 'R unchanged');
    assertEquals(px[1], 20, 'G unchanged');
    assertEquals(px[2], 30, 'B unchanged');
});

testRequiring('dom', 'drawImage(zero-size canvas) throws InvalidStateError, as HTML5 does', () => {
    const empty = document.createElement('canvas');
    empty.width = 0;
    empty.height = 4;
    const dctx = SWCanvas.createCanvas(2, 2).getContext('2d');
    let thrown = null;
    try {
        dctx.drawImage(empty, 0, 0);
    } catch (e) {
        thrown = e;
    }
    assertEquals(thrown !== null && thrown.name, 'InvalidStateError', 'error name');
});

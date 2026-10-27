// Test: createPattern takes every source drawImage takes. In the browser that
// includes the DOM's own sources — a canvas element, an ImageBitmap — which the
// HTML5-compatible API resolves to pixels the same way drawImage does; a source
// with no pixels yet gives null, as HTML5's createPattern does. Without a DOM
// these sources do not exist, so these tests run in the browser page only.

function patternTileColor089(source) {
    const dst = SWCanvas.createCanvas(4, 4);
    const dctx = dst.getContext('2d');
    dctx.fillStyle = dctx.createPattern(source, 'repeat');
    dctx.fillRect(0, 0, 4, 4);
    return Array.from(dctx.getImageData(3, 3, 1, 1).data);
}

testRequiring('dom', 'createPattern(canvas element) tiles the canvas pixels', () => {
    const tile = document.createElement('canvas');
    tile.width = 2;
    tile.height = 2;
    const tctx = tile.getContext('2d');
    tctx.fillStyle = 'rgb(220, 30, 40)';
    tctx.fillRect(0, 0, 2, 2);
    assertEquals(patternTileColor089(tile).join(','), '220,30,40,255', 'pattern pixel');
});

testRequiring('dom', 'createPattern(ImageBitmap) tiles the bitmap pixels', () => {
    const offscreen = new OffscreenCanvas(2, 2);
    const octx = offscreen.getContext('2d');
    octx.fillStyle = 'rgb(5, 200, 90)';
    octx.fillRect(0, 0, 2, 2);
    assertEquals(patternTileColor089(offscreen.transferToImageBitmap()).join(','), '5,200,90,255', 'pattern pixel');
});

testRequiring('dom', 'createPattern of an element source with no pixels yet returns null, as HTML5 does', () => {
    const ctx = SWCanvas.createCanvas(2, 2).getContext('2d');
    assertEquals(ctx.createPattern(new Image(), 'repeat'), null, 'image without a src');
    assertEquals(ctx.createPattern(document.createElement('video'), 'repeat'), null, 'video with no frame');
});

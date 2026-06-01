// Test: a rectangular clip must be geometrically correct on its RIGHT edge,
// and vector fills must clip IDENTICALLY to raster (drawImage) blits.
//
// Regression for the Fizzygum "streak" bug: the clip-mask scanline filler used
// ceil(left)..floor(right) with an INCLUSIVE end, which exposed one extra pixel
// column on the right for integer-aligned clips (a clip rect [5,25) wrongly
// exposed column 25). Vector fills bled into that phantom column while raster
// drawImage blits bounded by their own extent did not, leaving 1px streaks of
// erased raster content along the right edge of repainted dirty rectangles.
// The Y axis was already correct (pixel-center sampling at y+0.5), so only the
// right edge was wrong, never the bottom.

function _opaque(w, h, r, g, b) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { data[i*4]=r; data[i*4+1]=g; data[i*4+2]=b; data[i*4+3]=255; }
    return { width: w, height: h, data };
}
// last column index with any painted (alpha>0) pixel in a given row, else -1
function _lastPaintedCol(ctx, W, row) {
    const img = ctx.getImageData(0, 0, W, row + 1).data;
    let last = -1;
    for (let x = 0; x < W; x++) if (img[(row * W + x) * 4 + 3] > 0) last = x;
    return last;
}

test('clip right edge is geometrically correct (no phantom +1 column)', () => {
    const W = 40, H = 40, ROW = 12;
    // Clip rect [5,5,20,20] => right edge at x=25 (exclusive) => last visible col 24.
    const canvas = SWCanvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.rect(5, 5, 20, 20);
    ctx.clip();
    ctx.fillStyle = 'rgb(0, 200, 0)';
    ctx.fillRect(0, 0, W, H); // huge fill; only the clip limits it

    const px24 = ctx.getImageData(24, ROW, 1, 1).data; // inside clip => painted
    const px25 = ctx.getImageData(25, ROW, 1, 1).data; // outside clip => untouched
    assertEquals(px24[3], 255, 'column 24 (last column inside clip) must be filled');
    assertEquals(px25[3], 0,   'column 25 (just outside clip) must NOT be filled');
    assertEquals(_lastPaintedCol(ctx, W, ROW), 24, 'rightmost filled column under clip must be 24');
});

test('vector fill and raster drawImage clip identically on the right edge', () => {
    const W = 40, H = 40, ROW = 12;

    const cf = SWCanvas.createCanvas(W, H);
    const f = cf.getContext('2d');
    f.beginPath(); f.rect(5, 5, 20, 20); f.clip();
    f.fillStyle = 'rgb(0, 200, 0)';
    f.fillRect(0, 0, W, H);

    const cd = SWCanvas.createCanvas(W, H);
    const d = cd.getContext('2d');
    d.beginPath(); d.rect(5, 5, 20, 20); d.clip();
    d.drawImage(_opaque(W, H, 200, 0, 0), 0, 0); // image spans well past the clip

    assertEquals(
        _lastPaintedCol(d, W, ROW),
        _lastPaintedCol(f, W, ROW),
        'drawImage and fillRect must reach the same rightmost column under an identical clip'
    );
    assertEquals(_lastPaintedCol(d, W, ROW), 24, 'both must stop at column 24');
});

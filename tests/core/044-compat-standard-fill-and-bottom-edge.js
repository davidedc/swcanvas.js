// Test: the STANDARD fill path (PolygonFiller._fillSpans — patterns, gradients,
// alpha<255, non-source-over) must obey the SAME half-open right-edge convention
// as the opaque fast path / fillRect / clip / drawImage; and ALL fill paths must
// keep the BOTTOM edge half-open too.
//
// Why a separate file from 043: an opaque solid-color fill + source-over routes
// through _fillPolygonsDirect (the fast path, covered by 043), NOT _fillSpans.
// A Pattern/Gradient paint source, OR alpha<255, OR globalAlpha<1, OR a
// non-source-over composite is what routes through _fillSpans. That standard
// path is exactly what produced the reported "desktop pattern survives, morphs
// erased" bleed, so it needs its own regression guard.
//
// The BOTTOM edge was always correct (scanlines are sampled at y+0.5 with a
// half-open edge test), but no test enforced it — so a future "apply the X fix
// to Y too" change could silently erase the last row. These tests lock it.

function _solidTile(w, h, r, g, b) {
    const t = SWCanvas.createCanvas(w, h);
    const tc = t.getContext('2d');
    tc.fillStyle = `rgb(${r}, ${g}, ${b})`;
    tc.fillRect(0, 0, w, h);
    return t;
}
function _lastPaintedCol(ctx, W, row) {
    const img = ctx.getImageData(0, 0, W, row + 1).data;
    let last = -1;
    for (let x = 0; x < W; x++) if (img[(row * W + x) * 4 + 3] > 0) last = x;
    return last;
}
function _lastPaintedRow(ctx, W, H, col) {
    const img = ctx.getImageData(0, 0, W, H).data;
    let last = -1;
    for (let y = 0; y < H; y++) if (img[(y * W + col) * 4 + 3] > 0) last = y;
    return last;
}

test('pattern fill obeys the half-open right edge (routes through _fillSpans, not the direct path)', () => {
    const W = 40, H = 40, ROW = 12;
    const c = SWCanvas.createCanvas(W, H);
    const x = c.getContext('2d');
    x.fillStyle = x.createPattern(_solidTile(4, 4, 0, 0, 200), 'repeat'); // Pattern => _fillSpans
    x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
    // rect [5,25) must fill cols 5..24, not the phantom column 25.
    assertEquals(_lastPaintedCol(x, W, ROW), 24, 'pattern fill of rect [5,25) must reach col 24, not 25');
    assertEquals(x.getImageData(25, ROW, 1, 1).data[3], 0, 'col 25 must be untouched by the pattern fill');
});

test('semi-transparent fill obeys the half-open right edge (alpha<255 also routes through _fillSpans)', () => {
    const W = 40, H = 40, ROW = 12;
    const c = SWCanvas.createCanvas(W, H);
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0, 200, 0, 0.5)'; // alpha<255 => standard path
    x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
    assertEquals(_lastPaintedCol(x, W, ROW), 24, 'semi-transparent fill of rect [5,25) must reach col 24, not 25');
    assertEquals(x.getImageData(25, ROW, 1, 1).data[3], 0, 'col 25 must be untouched');
});

test('unclipped pattern background does not bleed one column past a clipped morph', () => {
    // The exact reported symptom: desktop PATTERN (unclipped _fillSpans) must not
    // reach one column further than the clipped morphs painted over it.
    const W = 40, H = 40, ROW = 12;
    const c = SWCanvas.createCanvas(W, H);
    const x = c.getContext('2d');

    x.fillStyle = 'rgb(0, 180, 0)';     // pre-existing neighbour content everywhere
    x.fillRect(0, 0, W, H);
    x.fillStyle = x.createPattern(_solidTile(4, 4, 0, 0, 200), 'repeat'); // desktop pattern, UNCLIPPED
    x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
    x.save();
    x.beginPath(); x.rect(5, 5, 20, 20); x.clip();
    x.fillStyle = 'rgb(200, 0, 0)';     // clipped morph on top
    x.beginPath(); x.rect(0, 0, W, H); x.fill();
    x.restore();

    const col24 = x.getImageData(24, ROW, 1, 1).data;
    const col25 = x.getImageData(25, ROW, 1, 1).data;
    assertEquals(col24[0], 200, 'col 24 (clip last col) must be the morph red, not the pattern');
    assertEquals(col25[1], 180, 'col 25 (outside dirty rect) must remain the untouched neighbour green');
    assertEquals(col25[2], 0,   'col 25 must NOT be the pattern blue (no 1px bleed)');
});

test('fills keep the BOTTOM edge half-open too (guard against a symmetric Y regression)', () => {
    const W = 40, H = 40, COL = 12;

    // Direct path (opaque solid).
    let c = SWCanvas.createCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = 'rgb(0, 200, 0)';
    x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
    assertEquals(_lastPaintedRow(x, W, H, COL), 24, 'opaque path-fill of [5,25) must fill rows 5..24');
    assertEquals(x.getImageData(COL, 25, 1, 1).data[3], 0, 'row 25 must be untouched (direct path)');

    // Standard path (pattern => _fillSpans).
    c = SWCanvas.createCanvas(W, H); x = c.getContext('2d');
    x.fillStyle = x.createPattern(_solidTile(4, 4, 0, 0, 200), 'repeat');
    x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
    assertEquals(_lastPaintedRow(x, W, H, COL), 24, 'pattern fill of [5,25) must fill rows 5..24');

    // Clip-mask path.
    c = SWCanvas.createCanvas(W, H); x = c.getContext('2d');
    x.beginPath(); x.rect(5, 5, 20, 20); x.clip();
    x.fillStyle = 'rgb(0, 200, 0)'; x.fillRect(0, 0, W, H);
    assertEquals(_lastPaintedRow(x, W, H, COL), 24, 'clipped fill bottom row must be 24');
    assertEquals(x.getImageData(COL, 25, 1, 1).data[3], 0, 'row 25 must be untouched (clip path)');
});

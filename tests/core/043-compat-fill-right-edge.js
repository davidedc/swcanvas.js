// Test: path-fill (PolygonFiller) must agree with fillRect (RectOpsAA) on the
// RIGHT edge, and an UNCLIPPED fill must not bleed one column past a clipped
// morph drawn on top of it.
//
// Regression for the Fizzygum "everything-but-the-desktop erased" symptom: the
// surface path-fill spans used ceil(left)..floor(right) with an INCLUSIVE end,
// so a path-filled (or pattern-filled) rect was 1px wider on the right than
// fillRect / the clip / drawImage / HTML5. When the desktop background (an
// unclipped pattern path-fill) reached column R while clipped morphs on top
// correctly stopped at R-1, that extra column showed only the desktop and
// overwrote the clean neighbour content that lived just outside the dirty rect.

function _lastPaintedCol(ctx, W, row) {
    const img = ctx.getImageData(0, 0, W, row + 1).data;
    let last = -1;
    for (let x = 0; x < W; x++) if (img[(row * W + x) * 4 + 3] > 0) last = x;
    return last;
}

test('path-fill and fillRect agree on the right edge (half-open [x, x+w))', () => {
    const W = 40, H = 40, ROW = 12;

    const cr = SWCanvas.createCanvas(W, H);
    const r = cr.getContext('2d');
    r.fillStyle = 'rgb(0, 200, 0)';
    r.fillRect(5, 5, 20, 20); // RectOpsAA fast path

    const cp = SWCanvas.createCanvas(W, H);
    const p = cp.getContext('2d');
    p.fillStyle = 'rgb(0, 200, 0)';
    p.beginPath(); p.rect(5, 5, 20, 20); p.fill(); // PolygonFiller path

    assertEquals(_lastPaintedCol(p, W, ROW), _lastPaintedCol(r, W, ROW),
        'path-fill and fillRect must reach the same rightmost column');
    assertEquals(_lastPaintedCol(p, W, ROW), 24, 'rect [5,25) must fill cols 5..24, not 25');
});

test('unclipped fill does not bleed one column past a clipped morph on top', () => {
    const W = 40, H = 40, ROW = 12;
    const c = SWCanvas.createCanvas(W, H);
    const x = c.getContext('2d');

    // Pre-existing neighbour content everywhere (incl. the column just outside the dirty rect).
    x.fillStyle = 'rgb(0, 180, 0)';
    x.fillRect(0, 0, W, H);

    // Repaint of the dirty rect [5,25): an UNCLIPPED background path-fill, then a clipped morph.
    x.fillStyle = 'rgb(0, 0, 200)';
    x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
    x.save();
    x.beginPath(); x.rect(5, 5, 20, 20); x.clip();
    x.fillStyle = 'rgb(200, 0, 0)';
    x.beginPath(); x.rect(0, 0, W, H); x.fill();
    x.restore();

    const col24 = x.getImageData(24, ROW, 1, 1).data; // clip's last column -> morph
    const col25 = x.getImageData(25, ROW, 1, 1).data; // just outside dirty rect -> untouched neighbour
    assertEquals(col24[0], 200, 'column 24 (clip last col) must be the morph (red), not the background');
    // Neighbour content (green) must survive — the background must NOT have bled into column 25.
    assertEquals(col25[1], 180, 'column 25 must remain the untouched neighbour (green), not bled background');
    assertEquals(col25[2], 0,   'column 25 must NOT be the background blue');
});

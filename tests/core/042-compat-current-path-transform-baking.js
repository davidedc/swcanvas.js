// Test: the context's *current default path* bakes in the CTM at the time each
// path-building call is made (HTML5 Canvas semantics), not at fill/stroke time.
//
// Regression for the Fizzygum icon bug: the canonical PaintCode idiom
//   ctx.save(); ctx.translate(x,y); ctx.scale(w/2,h/2)
//   ctx.arc(1,1,1,0,2*PI); ctx.closePath()
//   ctx.restore()              // transform popped BEFORE the caller strokes
//   ctx.lineWidth = ...; ctx.stroke()
// must place the circle where it was BUILT (baked transform), not re-evaluate the
// geometry under the draw-time transform (which dropped the translate/scale and
// drew a tiny circle at the origin). The line width stays in draw-time user space.
//
// External Path2D objects remain transform-independent (transformed at draw time),
// which this file also guards.

// Returns true if the pixel is opaque and dark (black-on-white test fixtures).
function isDarkPx(ctx, x, y) {
    const px = ctx.getImageData(x, y, 1, 1).data;
    return px[3] > 128 && px[0] < 128;
}

// Bounding box of opaque dark pixels, plus count.
function darkBBox(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, n = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (data[i + 3] > 128 && data[i] < 128) {
                n++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    return { minX, minY, maxX, maxY, n };
}

function whiteCanvas(w, h) {
    const canvas = SWCanvas.createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);
    return { canvas, ctx };
}

test('current-path stroke bakes the build-time transform (arc built under translate+scale, restored, then stroked)', () => {
    const { ctx } = whiteCanvas(100, 100);

    // Build a unit circle under translate(20,40)·scale(10,10) → a circle centered
    // at (30,50) with radius 10 in device space; restore BEFORE stroking.
    ctx.save();
    ctx.beginPath();
    ctx.translate(20, 40);
    ctx.scale(10, 10);
    ctx.arc(1, 1, 1, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.restore();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'black';
    ctx.stroke();

    // The stroke ring (band radius ~8.25..11.75) sits around (30,50).
    assertEquals(isDarkPx(ctx, 30, 40), true, 'ring present at top of baked circle (30,40)');
    assertEquals(isDarkPx(ctx, 20, 50), true, 'ring present at left of baked circle (20,50)');
    assertEquals(isDarkPx(ctx, 30, 50), false, 'baked circle is hollow at its center (30,50)');

    // The pre-fix bug drew a tiny ring at user-space (1,1): the top-left corner
    // must be clean now.
    assertEquals(isDarkPx(ctx, 2, 2), false, 'no stray geometry at the origin (the old bug)');

    // Overall the geometry must be localized around the baked circle, not the corner.
    const bb = darkBBox(ctx, 100, 100);
    assertEquals(bb.minX >= 16 && bb.maxX <= 44, true, 'dark pixels span x[~16..44]');
    assertEquals(bb.minY >= 36 && bb.maxY <= 64, true, 'dark pixels span y[~36..64]');
});

test('current-path fill bakes the build-time transform (juggled disk lands at baked center)', () => {
    const { ctx } = whiteCanvas(100, 100);

    ctx.save();
    ctx.beginPath();
    ctx.translate(20, 40);
    ctx.scale(10, 10);
    ctx.arc(1, 1, 1, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.restore();
    ctx.fillStyle = 'black';
    ctx.fill();

    assertEquals(isDarkPx(ctx, 30, 50), true, 'filled disk covers the baked center (30,50)');
    assertEquals(isDarkPx(ctx, 30, 42), true, 'filled disk covers a point inside the baked circle');
    assertEquals(isDarkPx(ctx, 2, 2), false, 'no stray fill at the origin (the old bug)');
});

test('juggled current-path stroke is pixel-identical to the equivalent direct stroke', () => {
    // A: the build-then-restore idiom.
    const a = whiteCanvas(100, 100);
    a.ctx.save();
    a.ctx.beginPath();
    a.ctx.translate(20, 40);
    a.ctx.scale(10, 10);
    a.ctx.arc(1, 1, 1, 0, 2 * Math.PI);
    a.ctx.closePath();
    a.ctx.restore();
    a.ctx.lineWidth = 3.5;
    a.ctx.strokeStyle = 'black';
    a.ctx.stroke();

    // B: the same circle authored directly in draw space (no transform juggling).
    const b = whiteCanvas(100, 100);
    b.ctx.beginPath();
    b.ctx.arc(30, 50, 10, 0, 2 * Math.PI);
    b.ctx.closePath();
    b.ctx.lineWidth = 3.5;
    b.ctx.strokeStyle = 'black';
    b.ctx.stroke();

    const da = a.ctx.getImageData(0, 0, 100, 100).data;
    const db = b.ctx.getImageData(0, 0, 100, 100).data;
    let diffs = 0;
    for (let i = 0; i < da.length; i++) {
        if (da[i] !== db[i]) diffs++;
    }
    assertEquals(diffs, 0, 'baked juggled circle equals the direct circle byte-for-byte');
});

test('non-uniform build transform produces an ellipse at the baked location', () => {
    const { ctx } = whiteCanvas(120, 120);

    // arc(0,0,1) under translate(60,60)·scale(20,8) → ellipse centered (60,60),
    // rx=20, ry=8; restore before stroking.
    ctx.save();
    ctx.beginPath();
    ctx.translate(60, 60);
    ctx.scale(20, 8);
    ctx.arc(0, 0, 1, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.stroke();

    const bb = darkBBox(ctx, 120, 120);
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    const width = bb.maxX - bb.minX;
    const height = bb.maxY - bb.minY;

    assertEquals(Math.abs(cx - 60) <= 2, true, 'ellipse centered on x≈60');
    assertEquals(Math.abs(cy - 60) <= 2, true, 'ellipse centered on y≈60');
    // rx=20, ry=8 → clearly wider than tall (and NOT a circle).
    assertEquals(width > height + 10, true, 'ellipse is wider than tall (non-uniform scale honored)');
    assertEquals(Math.abs(width / 2 - 20) <= 3, true, 'horizontal radius ≈ 20');
    assertEquals(Math.abs(height / 2 - 8) <= 3, true, 'vertical radius ≈ 8');
});

test('rotation in the build transform keeps a circle a circle at the baked center', () => {
    const { ctx } = whiteCanvas(120, 120);

    // Rotate about (60,60), build a circle there, restore, stroke. A circle is
    // rotation-invariant, so it must remain a circle centered at (60,60) r=20.
    ctx.save();
    ctx.translate(60, 60);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'black';
    ctx.stroke();

    assertEquals(isDarkPx(ctx, 60, 40), true, 'ring present at top (60,40)');
    assertEquals(isDarkPx(ctx, 80, 60), true, 'ring present at right (80,60)');
    assertEquals(isDarkPx(ctx, 60, 80), true, 'ring present at bottom (60,80)');
    assertEquals(isDarkPx(ctx, 40, 60), true, 'ring present at left (40,60)');
    assertEquals(isDarkPx(ctx, 60, 60), false, 'circle is hollow at the baked center');
});

test('clip() honors the build-time transform of the current path', () => {
    const { ctx } = whiteCanvas(100, 100);

    // Build a 20x20 clip rect under translate(40,40), restore, then clip and paint.
    // The clip must land at device (40,40)-(60,60), not (0,0)-(20,20).
    ctx.save();
    ctx.beginPath();
    ctx.translate(40, 40);
    ctx.rect(0, 0, 20, 20);
    ctx.restore();
    ctx.clip();
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 100, 100); // only the clipped region should darken

    assertEquals(isDarkPx(ctx, 50, 50), true, 'inside the baked clip region (50,50)');
    assertEquals(isDarkPx(ctx, 10, 10), false, 'outside the baked clip region (10,10) stays clear');
});

test('external Path2D stays transform-independent (transformed at draw time)', () => {
    const { ctx } = whiteCanvas(100, 100);

    // A standalone path carries no build-time transform; it must be transformed by
    // the CTM in effect at fill() time — unlike the current default path.
    const path = new SWCanvas.Core.SWPath2D();
    path.rect(0, 0, 20, 20);

    ctx.translate(50, 50);
    ctx.fillStyle = 'black';
    ctx.fill(path);

    assertEquals(isDarkPx(ctx, 55, 55), true, 'Path2D drawn under the draw-time transform (55,55)');
    assertEquals(isDarkPx(ctx, 5, 5), false, 'Path2D NOT baked at build time (5,5) stays clear');
});

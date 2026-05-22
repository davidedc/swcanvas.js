// Test: ctx.textPixelDensity property — default, validation, save/restore,
// snapshot field, and no-crash at density>1 with no atlas.

test('textPixelDensity default is a positive finite number', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    const d = ctx.textPixelDensity;
    // In Node `window` is undefined → falls back to 1. In a browser it picks
    // up devicePixelRatio. Don't assert the exact value — environment-
    // dependent — just shape.
    if (typeof d !== 'number') throw new Error('textPixelDensity not a number');
    if (!(d > 0)) throw new Error('textPixelDensity not positive');
    if (!isFinite(d)) throw new Error('textPixelDensity not finite');
});

test('textPixelDensity setter accepts positive numbers (integer and fractional)', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.textPixelDensity = 2;
    assertEquals(ctx.textPixelDensity, 2);
    ctx.textPixelDensity = 1.5;
    assertEquals(ctx.textPixelDensity, 1.5);
    ctx.textPixelDensity = 3;
    assertEquals(ctx.textPixelDensity, 3);
});

test('textPixelDensity setter silently rejects invalid values', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.textPixelDensity = 2;  // baseline
    const invalid = [0, -1, NaN, Infinity, -Infinity, 'two', null, undefined, {}];
    for (const v of invalid) {
        ctx.textPixelDensity = v;
        assertEquals(ctx.textPixelDensity, 2);
    }
});

test('save/restore preserves textPixelDensity', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.textPixelDensity = 1;
    ctx.save();
    ctx.textPixelDensity = 2;
    assertEquals(ctx.textPixelDensity, 2);
    ctx.restore();
    assertEquals(ctx.textPixelDensity, 1);
});

test('_textPixelDensity exists on Core context as a number', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    if (typeof ctx._core._textPixelDensity !== 'number') {
        throw new Error('Core _textPixelDensity not a number');
    }
});

test('fillText at density 2 with no atlas does not crash', () => {
    const canvas = SWCanvas.createCanvas(20, 20);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    ctx.fillStyle = 'black';
    ctx.textPixelDensity = 2;
    ctx.fillText('hi', 0, 16);  // forces slow path; must not throw
});

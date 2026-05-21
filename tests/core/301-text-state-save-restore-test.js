// Test: font, textAlign, textBaseline survive save()/restore()

test('save/restore preserves font, textAlign, textBaseline', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.save();
    ctx.font = '12px Courier';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    assertEquals(ctx.font, '12px Courier');
    assertEquals(ctx.textAlign, 'right');
    assertEquals(ctx.textBaseline, 'top');

    ctx.restore();
    assertEquals(ctx.font, '16px Arial');
    assertEquals(ctx.textAlign, 'center');
    assertEquals(ctx.textBaseline, 'middle');
});

test('textAlign accepts the six standard values; rejects others', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    for (const v of ['start', 'end', 'left', 'right', 'center']) {
        ctx.textAlign = v;
        assertEquals(ctx.textAlign, v);
    }
    ctx.textAlign = 'bogus';
    assertEquals(ctx.textAlign, 'center');  // unchanged from previous valid set
});

test('textBaseline accepts the six standard values; rejects others', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    for (const v of ['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom']) {
        ctx.textBaseline = v;
        assertEquals(ctx.textBaseline, v);
    }
    ctx.textBaseline = 'bogus';
    assertEquals(ctx.textBaseline, 'bottom');  // unchanged from previous valid set
});

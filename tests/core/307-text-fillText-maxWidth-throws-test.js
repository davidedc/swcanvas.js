// Test: fillText throws when maxWidth is passed — explicit failure beats
// silent no-op (BitmapText can't shrink-to-fit pre-rasterised glyphs).

test('ctx.fillText throws when maxWidth is passed', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    assertThrows(() => ctx.fillText('hello', 10, 20, 100), 'not supported');
});

test('ctx.fillText without maxWidth does not throw', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    // No assertion on pixels (no atlas loaded); we just verify the call
    // path is reachable without error when maxWidth is omitted.
    ctx.fillText('hello', 10, 20);
});

test('ctx.fillText with explicit undefined maxWidth does not throw', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    ctx.fillText('hello', 10, 20, undefined);
});

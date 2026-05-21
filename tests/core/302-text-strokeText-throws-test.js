// Test: strokeText throws "not supported" — explicit failure beats silent no-op.

test('ctx.strokeText throws "not supported"', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    assertThrows(() => ctx.strokeText('hello', 10, 20), 'not supported');
});

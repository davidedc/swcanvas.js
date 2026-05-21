// Test: fillText with no font atlas loaded should not crash.
// Phase 2 doesn't ship a font fixture, so all fillText calls hit the
// NO_METRICS path. They must return cleanly without writing pixels.

test('fillText with no font loaded does not crash, leaves canvas untouched', () => {
    const canvas = SWCanvas.createCanvas(20, 20);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 20, 20);
    // Snapshot a pixel before fillText.
    const before = ctx.getImageData(10, 10, 1, 1).data;

    ctx.font = '16px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('hi', 0, 16);

    const after = ctx.getImageData(10, 10, 1, 1).data;
    // Pixel unchanged — no atlas means nothing rendered.
    assertEquals(after[0], before[0]);
    assertEquals(after[1], before[1]);
    assertEquals(after[2], before[2]);
    assertEquals(after[3], before[3]);
});

test('fillText with no font assigned does not crash', () => {
    const canvas = SWCanvas.createCanvas(20, 20);
    const ctx = canvas.getContext('2d');
    // No ctx.font assignment — _font stays null.
    ctx.fillText('hi', 0, 16);  // must not throw
});

test('measureText with no font assigned returns null', () => {
    const canvas = SWCanvas.createCanvas(20, 20);
    const ctx = canvas.getContext('2d');
    const m = ctx.measureText('hi');
    assertEquals(m, null);
});

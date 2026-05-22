// Test: fillText must not crash when the requested font/size has no matching
// atlas — it should silently render nothing (NO_METRICS path). The test
// runner preloads the smoke fixture's 3 fonts (Arial reg+bold +
// BitmapTextInvariant at size 16, density-1), so we deliberately request a
// font outside that set: Courier New 24 misses on both family AND size.

test('fillText with an unmatched font does not crash, leaves canvas untouched', () => {
    const canvas = SWCanvas.createCanvas(20, 20);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 20, 20);
    // Snapshot a pixel before fillText.
    const before = ctx.getImageData(10, 10, 1, 1).data;

    ctx.font = '24px Courier New';   // not in smoke set (family or size)
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

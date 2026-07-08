// Test: DepthBuffer creation validation, clear() and clearRect()
// This file will be concatenated into the main test suite

test('DepthBuffer creation, clear and clearRect', () => {
    assertThrows(() => new SWCanvas.Core.DepthBuffer(0, 10), 'width');
    assertThrows(() => new SWCanvas.Core.DepthBuffer(10, -5), 'height');
    assertThrows(() => new SWCanvas.Core.DepthBuffer(10.5, 10), 'width');

    const db = new SWCanvas.Core.DepthBuffer(16, 8);
    assertEquals(db.width, 16);
    assertEquals(db.height, 8);
    assertEquals(db.data.length, 128);

    // clear() resets every pixel to 0 (infinitely far)
    db.data.fill(0.5);
    db.clear();
    let nonZero = 0;
    for (let i = 0; i < db.data.length; i++) {
        if (db.data[i] !== 0) nonZero++;
    }
    assertEquals(nonZero, 0, 'clear() must reset all depths to 0');

    // clearRect() resets only the region (clamped), leaves the rest
    db.data.fill(0.5);
    db.clearRect(4, 2, 8, 4);
    assertEquals(db.getInvDepth(4, 2), 0, 'inside region top-left');
    assertEquals(db.getInvDepth(11, 5), 0, 'inside region bottom-right');
    assertEquals(db.getInvDepth(3, 2), 0.5, 'left of region untouched');
    assertEquals(db.getInvDepth(4, 1), 0.5, 'above region untouched');
    assertEquals(db.getInvDepth(12, 3), 0.5, 'right of region untouched');
    assertEquals(db.getInvDepth(11, 6), 0.5, 'below region untouched');
});

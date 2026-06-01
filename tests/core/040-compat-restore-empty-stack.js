// Test: restore() on an empty state stack is a no-op (does not throw).
// Fizzygum's resetWorldCanvasContext deliberately over-restores ~2000x to
// recover from a half-applied state, so this must never throw.

test('restore() over-pops on an empty stack without throwing', () => {
    const canvas = SWCanvas.createCanvas(10, 10);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < 5; i++) {
        ctx.restore(); // no matching save()
    }

    // Context must still be usable afterwards.
    ctx.fillStyle = 'rgb(0, 128, 0)';
    ctx.fillRect(0, 0, 10, 10);
    const px = ctx.getImageData(5, 5, 1, 1).data;
    assertEquals(px[0], 0, 'R');
    assertEquals(px[1], 128, 'G');
    assertEquals(px[2], 0, 'B');
});

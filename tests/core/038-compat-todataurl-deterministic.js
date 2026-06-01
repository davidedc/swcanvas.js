// Test: SWCanvasElement.toDataURL produces a deterministic PNG data URL.
// Identical pixels must yield identical bytes (relied on for snapshot tests),
// and the output must be a real PNG (signature) reflecting the drawn pixels.

test('toDataURL returns a data:image/png URL with a valid PNG signature', () => {
    const canvas = SWCanvas.createCanvas(4, 3);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(10, 20, 30)';
    ctx.fillRect(0, 0, 4, 3);

    const url = canvas.toDataURL();
    assertEquals(url.indexOf('data:image/png;base64,'), 0, 'must be a PNG data URL');

    const bytes = Buffer.from(url.slice('data:image/png;base64,'.length), 'base64');
    // PNG signature: 137 80 78 71 13 10 26 10
    assertEquals(bytes[0], 137, 'PNG sig byte 0');
    assertEquals(bytes[1], 80, 'PNG sig byte 1');
    assertEquals(bytes[2], 78, 'PNG sig byte 2');
    assertEquals(bytes[3], 71, 'PNG sig byte 3');
});

test('toDataURL is deterministic for identical pixels', () => {
    const a = SWCanvas.createCanvas(8, 8);
    a.getContext('2d').fillStyle = 'rgba(200, 100, 50, 0.5)';
    a.getContext('2d').fillRect(1, 1, 5, 5);

    const b = SWCanvas.createCanvas(8, 8);
    b.getContext('2d').fillStyle = 'rgba(200, 100, 50, 0.5)';
    b.getContext('2d').fillRect(1, 1, 5, 5);

    assertEquals(a.toDataURL(), b.toDataURL(), 'same pixels => same bytes');
});

test('toDataURL differs when pixels differ', () => {
    const a = SWCanvas.createCanvas(4, 4);
    a.getContext('2d').fillStyle = 'rgb(0, 0, 0)';
    a.getContext('2d').fillRect(0, 0, 4, 4);

    const b = SWCanvas.createCanvas(4, 4);
    b.getContext('2d').fillStyle = 'rgb(255, 255, 255)';
    b.getContext('2d').fillRect(0, 0, 4, 4);

    assertEquals(a.toDataURL() === b.toDataURL(), false, 'different pixels => different bytes');
});

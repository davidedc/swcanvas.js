// Test: ctx.font setter accepts the supported CSS subset and rejects unsupported

test('ctx.font: basic "16px Arial" parses and round-trips', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    assertEquals(ctx.font, '16px Arial');
});

test('ctx.font: "bold 12px Courier" parses and round-trips', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 12px Courier';
    assertEquals(ctx.font, 'bold 12px Courier');
});

test('ctx.font: "italic bold 18px Georgia" parses and round-trips', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = 'italic bold 18px Georgia';
    assertEquals(ctx.font, 'italic bold 18px Georgia');
});

test('ctx.font: default before assignment is "10px sans-serif"', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    assertEquals(ctx.font, '10px sans-serif');
});

test('ctx.font: invalid value silently leaves previous value in place', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    ctx.font = '16em Arial';      // non-px units — should be rejected
    assertEquals(ctx.font, '16px Arial');
    ctx.font = '16px Arial, sans-serif';  // comma list — rejected
    assertEquals(ctx.font, '16px Arial');
});

test('ctx.font: numeric weights (100..900) parse', () => {
    const canvas = SWCanvas.createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.font = '700 14px Arial';
    assertEquals(ctx.font, '700 14px Arial');
});

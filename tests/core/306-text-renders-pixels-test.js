// Test: fillText actually writes glyph pixels when a matching atlas is loaded.
// The test runner preloads the smoke fixture's 3 fonts at size 16 density-1:
// Arial reg, Arial bold, BitmapTextInvariant. Tests in this file constrain
// themselves to size 16 (the only size in the smoke set) — sizes 9..15
// and 17..96 in the smoke fixture have no atlas and would return NO_METRICS.

// Helper: count canvas pixels that differ from white (255,255,255,255).
function countNonWhitePixels(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255 || data[i + 3] !== 255) n++;
    }
    return n;
}

test('fillText with Arial 16 writes glyph pixels', () => {
    const canvas = SWCanvas.createCanvas(40, 30);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 40, 30);

    ctx.font = '16px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('A', 0, 20);

    const nonWhite = countNonWhitePixels(ctx, 40, 30);
    if (nonWhite < 1) {
        throw new Error('Expected at least one non-white pixel after fillText("A"); got ' + nonWhite);
    }
});

test('fillText with bold Arial 16 writes glyph pixels', () => {
    const canvas = SWCanvas.createCanvas(40, 30);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 40, 30);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('A', 0, 20);

    const nonWhite = countNonWhitePixels(ctx, 40, 30);
    if (nonWhite < 1) {
        throw new Error('Expected at least one non-white pixel after bold fillText("A"); got ' + nonWhite);
    }
});

test('measureText with Arial 16 returns non-zero width', () => {
    const canvas = SWCanvas.createCanvas(40, 30);
    const ctx = canvas.getContext('2d');
    ctx.font = '16px Arial';
    const m = ctx.measureText('Hello');
    if (m === null) throw new Error('measureText returned null; expected metrics');
    if (typeof m.width !== 'number' || m.width <= 0) {
        throw new Error('measureText width should be positive; got ' + m.width);
    }
});

test('fillText with an invariant char (☺) at size 16 writes pixels', () => {
    // The smiley auto-redirects to BitmapTextInvariant at the SAME size+density.
    // Smoke set ships invariant at size 16 only — keeping the test at 16 ensures
    // the redirect lookup hits. At other sizes it would write placeholder rects.
    const canvas = SWCanvas.createCanvas(40, 30);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 40, 30);

    ctx.font = '16px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('☺', 0, 20);   // ☺

    const nonWhite = countNonWhitePixels(ctx, 40, 30);
    if (nonWhite < 1) {
        throw new Error('Expected at least one non-white pixel from invariant glyph; got ' + nonWhite);
    }
});

test('fillText with non-black fillStyle writes pixels in that color', () => {
    // Black takes BitmapText's fast direct-blit path; any other colour forces
    // the per-glyph composite recolor path. Exercise the slow path here.
    const canvas = SWCanvas.createCanvas(40, 30);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 40, 30);

    ctx.font = '16px Arial';
    ctx.fillStyle = '#ff0000';   // pure red
    ctx.fillText('A', 0, 20);

    // Look for at least one pixel whose red channel is high AND green/blue
    // are low — distinct from the white background.
    const data = ctx.getImageData(0, 0, 40, 30).data;
    let foundRed = false;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 128 && data[i + 1] < 128 && data[i + 2] < 128) {
            foundRed = true;
            break;
        }
    }
    if (!foundRed) throw new Error('Expected at least one red-dominated pixel from red fillText');
});

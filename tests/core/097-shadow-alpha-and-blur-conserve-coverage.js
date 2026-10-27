// Test: a shadow carries the shadow colour's alpha times the shape's coverage —
// once — and blurring spreads that coverage without losing or adding any
// This file will be concatenated into the main test suite
//
// An opaque 40x40 square casts its shadow 70px to the side, so the shadow
// lands on transparent pixels nothing else paints:
//   1. unblurred, every shadow pixel's alpha is the shadow colour's alpha;
//   2. under globalAlpha 0.5 it is half that (globalAlpha counted once);
//   3. blurred, the shadow's total alpha is the unblurred total (the blur
//      moves coverage, it does not dilute or amplify it), and deep inside a
//      shape much larger than the blur the shadow keeps the full alpha.

test('shadows: alpha is shadow alpha x coverage, and blur conserves coverage', () => {
    const W = 200;
    const H = 140;

    function shadowOf(alpha, blur, globalAlpha) {
        const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
        ctx.shadowColor = `rgba(20, 40, 200, ${alpha})`;
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = 70;
        if (globalAlpha !== undefined) ctx.globalAlpha = globalAlpha;
        ctx.fillStyle = 'black';
        ctx.fillRect(20, 50, 40, 40);
        return ctx.getImageData(0, 0, W, H).data;
    }

    // Total alpha over the shadow's side of the canvas (x >= 65: the shape ends at 60).
    function shadowMass(data) {
        let sum = 0;
        for (let y = 0; y < H; y++) {
            for (let x = 65; x < W; x++) sum += data[(y * W + x) * 4 + 3];
        }
        return sum;
    }

    const centre = data => data[(70 * W + 110) * 4 + 3];

    // 1. unblurred
    for (const alpha of [1, 0.5, 0.1, 3 / 255]) {
        assertEquals(centre(shadowOf(alpha, 0)), Math.round(alpha * 255), `blur 0, shadow alpha ${alpha}`);
    }

    // 2. globalAlpha once
    assertEquals(centre(shadowOf(0.5, 0, 0.5)), Math.round(0.25 * 255), 'blur 0, shadow alpha 0.5 under globalAlpha 0.5');

    // 3. blur conserves coverage
    const unblurred = shadowMass(shadowOf(0.5, 0));
    for (const blur of [2, 4, 8, 16]) {
        const data = shadowOf(0.5, blur);
        const ratio = shadowMass(data) / unblurred;
        if (Math.abs(ratio - 1) > 0.01) {
            throw new Error(`blur ${blur}: shadow total alpha is ${ratio.toFixed(4)} of the unblurred total`);
        }
        if (blur <= 8) assertEquals(centre(data), 128, `blur ${blur}: shadow alpha deep inside the shape`);
    }
});

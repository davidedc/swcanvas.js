// Test: with imageSmoothingEnabled false, a pattern is sampled at device pixel
// CENTRES mapped through the inverse CTM, under rotation, scale and
// fractional translation
// This file will be concatenated into the main test suite
//
// A pattern is painted in the user space of the fill. With smoothing off, each
// device pixel takes the texel its CENTRE maps to through the inverse CTM,
// repeated per the pattern's repetition (nearest-neighbour; with smoothing on,
// a resampling mapping is filtered instead - tests/core/088). The oracle below
// maps every pixel centre through the inverse of the matrix given to
// setTransform and checks the texel painted there, for:
//   1. a rotation with a 3x scale and a fractional translate ('repeat'),
//   2. a fractional translate alone,
//   3. a non-uniform DOWN-scale,
//   4. a non-integer up-scale,
//   5. a rotation with 'no-repeat' (outside the tile stays transparent);
//   6. case 1 under 'destination-over', which takes the per-pixel paint path
//      instead of the source-over fill fast path.
// Pixel centres within 1e-9 of a texel boundary are skipped: there the oracle's
// and the engine's float routes may round to different sides.

test('pattern paint is sampled at pixel centres through the inverse CTM', () => {
    const W = 64;
    const H = 48;
    const T = 4; // tile size

    // 4x4 tile, every texel distinct and opaque
    const tile = SWCanvas.createCanvas(T, T);
    const tileCtx = tile.getContext('2d');
    const tileData = tileCtx.createImageData(T, T);
    for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
            const o = (y * T + x) * 4;
            tileData.data[o] = 40 + x * 60;
            tileData.data[o + 1] = 40 + y * 60;
            tileData.data[o + 2] = (x + y) % 2 === 0 ? 200 : 20;
            tileData.data[o + 3] = 255;
        }
    }
    tileCtx.putImageData(tileData, 0, 0);

    function check(label, m, repetition, composite = 'source-over') {
        const [a, b, c, d, e, f] = m;
        const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = ctx.createPattern(tile, repetition);
        ctx.globalCompositeOperation = composite;
        // The pattern is anchored to the CTM in force at fill time.
        ctx.setTransform(a, b, c, d, e, f);
        const det = a * d - b * c;
        // Cover the whole device canvas: map its corners back to user space.
        const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => [
            (d * (x - e) - c * (y - f)) / det,
            (-b * (x - e) + a * (y - f)) / det
        ]);
        const xs = corners.map(p => p[0]);
        const ys = corners.map(p => p[1]);
        const minX = Math.floor(Math.min(...xs)) - 1;
        const minY = Math.floor(Math.min(...ys)) - 1;
        ctx.fillRect(minX, minY, Math.ceil(Math.max(...xs)) + 1 - minX, Math.ceil(Math.max(...ys)) + 1 - minY);
        const data = ctx.getImageData(0, 0, W, H).data;

        let checked = 0;
        let wrong = 0;
        let firstWrong = '';
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const cx = x + 0.5;
                const cy = y + 0.5;
                const u = (d * (cx - e) - c * (cy - f)) / det;
                const v = (-b * (cx - e) + a * (cy - f)) / det;
                if (Math.abs(u - Math.round(u)) < 1e-9 || Math.abs(v - Math.round(v)) < 1e-9) continue;
                const tx = Math.floor(u);
                const ty = Math.floor(v);
                const o = (y * W + x) * 4;
                let expected;
                if (repetition === 'no-repeat' && (tx < 0 || ty < 0 || tx >= T || ty >= T)) {
                    expected = [0, 0, 0, 0];
                } else {
                    const ox = ((tx % T) + T) % T;
                    const oy = ((ty % T) + T) % T;
                    const t = (oy * T + ox) * 4;
                    expected = [tileData.data[t], tileData.data[t + 1], tileData.data[t + 2], tileData.data[t + 3]];
                }
                checked++;
                if (data[o] !== expected[0] || data[o + 1] !== expected[1] ||
                    data[o + 2] !== expected[2] || data[o + 3] !== expected[3]) {
                    if (wrong === 0) {
                        firstWrong = ` first at (${x},${y}): got (${Array.from(data.slice(o, o + 4))}), expected (${expected})`;
                    }
                    wrong++;
                }
            }
        }
        if (checked < W * H * 0.9) {
            throw new Error(label + ': only ' + checked + ' pixels checked (vacuous)');
        }
        assertEquals(wrong, 0, label + ': pixels not sampled at their centre' + firstWrong);
    }

    const r = 0.6;
    check('rotation x3 + fractional translate', [3 * Math.cos(r), 3 * Math.sin(r), -3 * Math.sin(r), 3 * Math.cos(r), 30.3, 20.7], 'repeat');
    check('fractional translate', [1, 0, 0, 1, 0.3, 0.6], 'repeat');
    check('non-uniform down-scale', [0.71, 0, 0, 0.43, 1.23, 0.91], 'repeat');
    check('non-integer up-scale', [2.6, 0, 0, 2.6, 0.4, 0.2], 'repeat');
    check('rotation, no-repeat', [4 * Math.cos(r), 4 * Math.sin(r), -4 * Math.sin(r), 4 * Math.cos(r), 30.3, 6.7], 'no-repeat');
    check('rotation x3, per-pixel path', [3 * Math.cos(r), 3 * Math.sin(r), -3 * Math.sin(r), 3 * Math.cos(r), 30.3, 20.7], 'repeat', 'destination-over');
});

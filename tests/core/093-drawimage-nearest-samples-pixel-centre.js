// Test: drawImage's nearest-neighbour arm takes the texel under each device
// pixel's CENTRE, like pattern paint
// This file will be concatenated into the main test suite
//
// A draw that does not resample (axis-aligned, one texel per device pixel), or
// any draw with imageSmoothingEnabled false, takes the texel its pixel centre
// maps to, and paints the pixels whose centre lies inside the destination
// rect. Pinned against an exact oracle (pixel centres within 1e-9 of a texel
// boundary skipped: there the oracle's and the engine's float routes may round
// to different sides) for:
//   1. a step-1 draw at a fractional offset, smoothing on (the arm that never
//      filters);
//   2. smoothing off under a fractional up-scale, a down-scale and a rotation;
//   3. step-1 draws under a scale(3) CTM at device-grid offsets (a plain blit
//      at device pixel ratio 3) and an integer 3x zoom with smoothing off —
//      every texel boundary lands on a pixel CORNER there, so only centre
//      sampling is immune to the division's rounding;
//   4. a smoothing-off pattern paints the same bytes as drawImage under a
//      rotation (one nearest-neighbour rule).

test('drawImage nearest-neighbour samples each pixel at its centre', () => {
    const W = 96;
    const H = 80;

    function makeImage(w, h) {
        const canvas = SWCanvas.createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        const id = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const o = (y * w + x) * 4;
                id.data[o] = 20 + ((x * 37) % 220);
                id.data[o + 1] = 20 + ((y * 53) % 220);
                id.data[o + 2] = (x + y) % 2 ? 230 : 30;
                id.data[o + 3] = 255;
            }
        }
        ctx.putImageData(id, 0, 0);
        return { canvas, data: id.data, w, h };
    }

    // m = CTM [a, b, c, d, e, f]; the image is drawn at dest (dx, dy, dw, dh).
    function check(label, m, smoothing, image, dest) {
        const [dx, dy, dw, dh] = dest || [0, 0, image.w, image.h];
        const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
        ctx.imageSmoothingEnabled = smoothing;
        ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        ctx.drawImage(image.canvas, dx, dy, dw, dh);
        const data = ctx.getImageData(0, 0, W, H).data;

        const [a, b, c, d, e, f] = m;
        const det = a * d - b * c;
        let checked = 0;
        let wrong = 0;
        let first = '';
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const cx = x + 0.5 - e;
                const cy = y + 0.5 - f;
                const ux = (d * cx - c * cy) / det;
                const uy = (-b * cx + a * cy) / det;
                const u = ((ux - dx) * image.w) / dw;
                const v = ((uy - dy) * image.h) / dh;
                if (Math.abs(u - Math.round(u)) < 1e-9 || Math.abs(v - Math.round(v)) < 1e-9) continue;
                const o = (y * W + x) * 4;
                let expected;
                if (u < 0 || v < 0 || u >= image.w || v >= image.h) {
                    expected = [0, 0, 0, 0];
                } else {
                    const t = (Math.floor(v) * image.w + Math.floor(u)) * 4;
                    expected = [image.data[t], image.data[t + 1], image.data[t + 2], 255];
                }
                checked++;
                if (data[o] !== expected[0] || data[o + 1] !== expected[1] ||
                    data[o + 2] !== expected[2] || data[o + 3] !== expected[3]) {
                    if (wrong === 0) {
                        first = ` first at (${x},${y}): got (${Array.from(data.slice(o, o + 4))}), expected (${expected})`;
                    }
                    wrong++;
                }
            }
        }
        if (checked < W * H * 0.5) throw new Error(label + ': only ' + checked + ' pixels checked (vacuous)');
        assertEquals(wrong, 0, label + ': pixels not showing the texel under their centre' + first);
        return data;
    }

    const small = makeImage(12, 9);
    const large = makeImage(60, 50);
    const rot = (angle, s, e, f) => [s * Math.cos(angle), s * Math.sin(angle), -s * Math.sin(angle), s * Math.cos(angle), e, f];

    // 1. step 1 at a fractional offset (smoothing on: this arm never filters)
    check('step-1 fractional offset', [1, 0, 0, 1, 10.3, 7.6], true, makeImage(40, 30));

    // 2. smoothing off
    check('smoothing off, fractional up-scale', [2.6, 0, 0, 2.6, 10.35, 7.65], false, small);
    check('smoothing off, down-scale', [0.71, 0, 0, 0.83, 7.35, 4.65], false, large);
    const rotated = rot(0.5, 3, 40.3, 6.2);
    const viaDrawImage = check('smoothing off, rotation', rotated, false, small);

    // 3. scale(3): a device-pixel-ratio-3 plain blit (step 1) and an integer 3x zoom
    check('step-1 blit under scale(3)', [3, 0, 0, 3, 0, 0], true, large, [11 / 3, 7 / 3, 60 / 3, 50 / 3]);
    check('integer 3x zoom, smoothing off', [3, 0, 0, 2, 10, 7], false, small);

    // 4. one nearest-neighbour rule: a smoothing-off pattern paints drawImage's bytes
    const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(rotated[0], rotated[1], rotated[2], rotated[3], rotated[4], rotated[5]);
    ctx.fillStyle = ctx.createPattern(small.canvas, 'no-repeat');
    ctx.fillRect(0, 0, small.w, small.h);
    const viaPattern = ctx.getImageData(0, 0, W, H).data;
    let differ = 0;
    for (let i = 0; i < viaPattern.length; i++) if (viaPattern[i] !== viaDrawImage[i]) differ++;
    assertEquals(differ, 0, 'smoothing-off pattern vs drawImage under rotation: differing bytes');
});

// Test: a pattern samples its image by drawImage's rule, and paints the pixels
// its image had at createPattern
// This file will be concatenated into the main test suite
//
// ONE image-sampling rule: a draw whose device→image mapping is axis-aligned
// with a step of exactly one texel per device pixel takes the nearest texel;
// any other mapping filters bilinearly at the pixel centre, unless
// imageSmoothingEnabled is false (then nearest). A pattern's mapping is the CTM
// composed with its own setTransform. Pinned by comparison with drawImage of the
// same image under the same transform:
//   1. a 'no-repeat' pattern under rotation + non-uniform scale, a fractional
//      up-scale and a down-scale paints drawImage's bytes wherever every filter
//      tap lies inside the image (at the image border the edge rules differ:
//      drawImage clamps to the edge texel, a non-repeating pattern axis reads
//      transparent beyond the image) — also for an image of translucent and
//      fully transparent texels, whose RGB the premultiplied filter weighs by
//      alpha (the FILTER_BILINEAR template, expanded into each caller's own
//      edge rule and transparent-sample exit);
//   2. a 'repeat' pattern's taps wrap: under rotation it paints what drawImage
//      paints of a 3x3 mosaic of the tile (within one level: the mosaic's image
//      coordinates are the pattern's shifted by a tile, which can round the
//      filter fractions differently in the last bit);
//   3. smoothing off: nearest-neighbour for both — each takes the texel under
//      the pixel centre — under an integer up-scale (test 093 compares the two
//      under a rotation) — and the pattern's smoothing-off bytes differ from its
//      smoothing-on bytes, through the facade and through the Core API alike;
//   4. a pattern under an integer translate does not resample: every pixel is
//      exactly its texel, smoothing on or off.
// A second test pins the snapshot: modifying the image after createPattern
// does not change the pattern (HTML5), for a canvas source and an ImageLike
// source, and a setTransform copy of the pattern keeps the snapshot too.

test('pattern paint samples by drawImage\'s rule: filtered under a resampling transform, nearest otherwise', () => {
    const SIZE = 64;

    // N x N opaque image, every texel distinct.
    function makeImage(n) {
        const canvas = SWCanvas.createCanvas(n, n);
        const ctx = canvas.getContext('2d');
        const id = ctx.createImageData(n, n);
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const o = (y * n + x) * 4;
                id.data[o] = 30 + ((x * 29) % 220);
                id.data[o + 1] = 20 + ((y * 31) % 230);
                id.data[o + 2] = (x * 7 + y * 13) % 256;
                id.data[o + 3] = 255;
            }
        }
        ctx.putImageData(id, 0, 0);
        return { canvas, data: id.data };
    }

    // N x N image of translucent texels, every fifth one fully transparent with
    // non-zero RGB (which a straight-alpha filter would bleed into its neighbours).
    function makeTranslucentImage(n) {
        const data = new Uint8ClampedArray(n * n * 4);
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const o = (y * n + x) * 4;
                data[o] = 30 + ((x * 29) % 220);
                data[o + 1] = 20 + ((y * 31) % 230);
                data[o + 2] = (x * 7 + y * 13) % 256;
                data[o + 3] = (x + 2 * y) % 5 === 0 ? 0 : 40 + ((x * 23 + y * 41) % 216);
            }
        }
        return { canvas: { width: n, height: n, data }, data };
    }

    function render(m, smoothing, draw) {
        const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
        ctx.imageSmoothingEnabled = smoothing;
        ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        draw(ctx);
        return ctx.getImageData(0, 0, SIZE, SIZE).data;
    }

    // Image-space coordinates of the pixel centre (x, y) under m.
    function imagePoint(m, x, y) {
        const [a, b, c, d, e, f] = m;
        const det = a * d - b * c;
        const cx = x + 0.5 - e;
        const cy = y + 0.5 - f;
        return [(d * cx - c * cy) / det, (-b * cx + a * cy) / det];
    }

    // Compare two renders over the pixels whose centre maps into [lo, hi]^2.
    function compare(label, m, got, want, lo, hi, tolerance) {
        let checked = 0;
        let worst = 0;
        let first = '';
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                const [u, v] = imagePoint(m, x, y);
                if (u < lo || v < lo || u > hi || v > hi) continue;
                checked++;
                const o = (y * SIZE + x) * 4;
                for (let k = 0; k < 4; k++) {
                    const d = Math.abs(got[o + k] - want[o + k]);
                    if (d > worst) {
                        worst = d;
                        first = ` worst at (${x},${y}): got (${Array.from(got.slice(o, o + 4))}), drawImage (${Array.from(want.slice(o, o + 4))})`;
                    }
                }
            }
        }
        if (checked < 12) throw new Error(label + ': only ' + checked + ' pixels compared (vacuous)');
        if (worst > tolerance) {
            throw new Error(label + ': pattern differs from drawImage by ' + worst + ' (tolerance ' + tolerance + ')' + first);
        }
    }

    const r = 0.37;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const rotated = [2.3 * cos, 2.3 * sin, -1.9 * sin, 1.9 * cos, 30.2, 8.7];
    const image8 = makeImage(8);

    // 1. no-repeat, smoothing on: drawImage's bytes inside the image.
    const cases = [
        ['rotation + non-uniform scale', rotated, image8, 8],
        ['fractional up-scale', [2.6, 0, 0, 3.1, 10.3, 7.7], image8, 8],
        ['down-scale', [0.7, 0, 0, 0.6, 10.3, 7.7], makeImage(40), 40],
        ['translucent texels, rotation + non-uniform scale', rotated, makeTranslucentImage(8), 8]
    ];
    for (const [label, m, image, n] of cases) {
        const viaDrawImage = render(m, true, ctx => ctx.drawImage(image.canvas, 0, 0));
        const viaPattern = render(m, true, ctx => {
            ctx.fillStyle = ctx.createPattern(image.canvas, 'no-repeat');
            ctx.fillRect(0, 0, n, n);
        });
        compare('no-repeat, ' + label, m, viaPattern, viaDrawImage, 1, n - 1, 0);
    }

    // 2. repeat: the taps wrap — the pattern paints drawImage's view of a 3x3
    // mosaic of the tile placed one tile up and left.
    const mosaic = SWCanvas.createCanvas(24, 24);
    const mosaicCtx = mosaic.getContext('2d');
    for (let ty = 0; ty < 3; ty++) {
        for (let tx = 0; tx < 3; tx++) mosaicCtx.drawImage(image8.canvas, tx * 8, ty * 8);
    }
    const viaMosaic = render(rotated, true, ctx => ctx.drawImage(mosaic, -8, -8));
    const viaRepeat = render(rotated, true, ctx => {
        ctx.fillStyle = ctx.createPattern(image8.canvas, 'repeat');
        ctx.fillRect(-8, -8, 24, 24);
    });
    compare('repeat wraps like a mosaic', rotated, viaRepeat, viaMosaic, -7, 15, 1);

    // 3. smoothing off: nearest for both.
    const upScale = [3, 0, 0, 2, 10.75, 7.75];
    const nearestDrawImage = render(upScale, false, ctx => ctx.drawImage(image8.canvas, 0, 0));
    const nearestPattern = render(upScale, false, ctx => {
        ctx.fillStyle = ctx.createPattern(image8.canvas, 'no-repeat');
        ctx.fillRect(0, 0, 8, 8);
    });
    compare('smoothing off, integer up-scale', upScale, nearestPattern, nearestDrawImage, 0, 8, 0);
    const smoothPattern = render(upScale, true, ctx => {
        ctx.fillStyle = ctx.createPattern(image8.canvas, 'no-repeat');
        ctx.fillRect(0, 0, 8, 8);
    });
    let smoothingMatters = 0;
    for (let i = 0; i < nearestPattern.length; i++) if (nearestPattern[i] !== smoothPattern[i]) smoothingMatters++;
    if (smoothingMatters === 0) {
        throw new Error('facade: imageSmoothingEnabled must reach the pattern sampler (smoothing on and off paint the same bytes)');
    }

    // ...and through the Core API.
    function coreRender(smoothing) {
        const surface = SWCanvas.Core.Surface(SIZE, SIZE);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.imageSmoothingEnabled = smoothing;
        ctx.setTransform(upScale[0], upScale[1], upScale[2], upScale[3], upScale[4], upScale[5]);
        ctx.setFillStyle(ctx.createPattern({ width: 8, height: 8, data: image8.data }, 'no-repeat'));
        ctx.fillRect(0, 0, 8, 8);
        return surface.data;
    }
    const coreNearest = coreRender(false);
    const coreSmooth = coreRender(true);
    let coreMismatch = 0;
    for (let i = 0; i < coreNearest.length; i++) {
        if (coreNearest[i] !== nearestPattern[i] || coreSmooth[i] !== smoothPattern[i]) coreMismatch++;
    }
    assertEquals(coreMismatch, 0, 'Core API: pattern bytes must equal the facade\'s, smoothing on and off');

    // 4. an integer translate does not resample: exactly the texels.
    for (const smoothing of [true, false]) {
        const tx = 3;
        const ty = -5;
        const data = render([1, 0, 0, 1, tx, ty], smoothing, ctx => {
            ctx.fillStyle = ctx.createPattern(image8.canvas, 'repeat');
            ctx.fillRect(-tx, -ty, SIZE, SIZE);
        });
        let wrong = 0;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                const sx = (((x - tx) % 8) + 8) % 8;
                const sy = (((y - ty) % 8) + 8) % 8;
                const o = (y * SIZE + x) * 4;
                const t = (sy * 8 + sx) * 4;
                for (let k = 0; k < 4; k++) if (data[o + k] !== image8.data[t + k]) wrong++;
            }
        }
        assertEquals(wrong, 0, 'integer translate, smoothing ' + smoothing + ': every pixel is its texel');
    }
});

test('a pattern paints its image as it was at createPattern', () => {
    const RED = [220, 30, 40, 255];

    function pixel(ctx) {
        return Array.from(ctx.getImageData(3, 3, 1, 1).data);
    }

    // Canvas source, modified after createPattern.
    const source = SWCanvas.createCanvas(2, 2);
    const sourceCtx = source.getContext('2d');
    sourceCtx.fillStyle = 'rgb(220, 30, 40)';
    sourceCtx.fillRect(0, 0, 2, 2);
    const target = SWCanvas.createCanvas(6, 6).getContext('2d');
    const pattern = target.createPattern(source, 'repeat');
    sourceCtx.fillStyle = 'rgb(0, 0, 255)';
    sourceCtx.fillRect(0, 0, 2, 2);
    target.fillStyle = pattern;
    target.fillRect(0, 0, 6, 6);
    assertEquals(pixel(target).join(','), RED.join(','), 'canvas source modified after createPattern');

    // A setTransform copy made after the modification keeps the snapshot too.
    const moved = pattern.setTransform({ a: 1, b: 0, c: 0, d: 1, e: 1, f: 1 }) || pattern;
    target.fillStyle = moved;
    target.fillRect(0, 0, 6, 6);
    assertEquals(pixel(target).join(','), RED.join(','), 'setTransform copy of the pattern');

    // ImageLike source, its data modified after createPattern.
    const data = new Uint8ClampedArray(16);
    for (let i = 0; i < 16; i += 4) data.set(RED, i);
    const imageLike = { width: 2, height: 2, data };
    const target2 = SWCanvas.createCanvas(6, 6).getContext('2d');
    const pattern2 = target2.createPattern(imageLike, 'repeat');
    data.fill(0);
    for (let i = 3; i < 16; i += 4) data[i] = 255;
    target2.fillStyle = pattern2;
    target2.fillRect(0, 0, 6, 6);
    assertEquals(pixel(target2).join(','), RED.join(','), 'ImageLike source modified after createPattern');
});

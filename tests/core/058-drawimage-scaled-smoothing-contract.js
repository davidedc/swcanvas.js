// Test: the scaled-drawImage smoothing contract (the axis-aligned half of the
// sampling policy; the rotated half is 057). An axis-aligned draw whose
// EFFECTIVE SAMPLE STEP != 1 — the per-device-pixel source step invA*xScale /
// invD*yScale, where the CTM scale and the src/dst rect ratio COMPOSE —
// samples BILINEAR (dest-pixel-center, premultiplied, texels outside the
// source sub-rect transparent); a step-1 draw reproduces the historical
// nearest-neighbor bytes exactly, whichever way the step-1 arises (identity
// same-size, or a scale(2) CTM drawing a physical-resolution source at
// half-size rects). `imageSmoothingEnabled` (HTML5: default true, boolean,
// save/restore state, both API layers) opts out: false forces nearest-
// neighbor for EVERY transform, rotation included.

// -- helpers ------------------------------------------------------------------

function makeRedGreenSource(redCols, greenCols) {
    // (redCols+greenCols) x 1 opaque hard-edge pattern: red columns then green.
    const W = redCols + greenCols;
    const data = new Uint8ClampedArray(W * 4);
    for (let x = 0; x < W; x++) {
        const o = x * 4;
        if (x < redCols) { data[o] = 255; } else { data[o + 1] = 255; }
        data[o + 3] = 255;
    }
    return { width: W, height: 1, data: data };
}

function makeGradientSource(W, H) {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            data[o] = x * 29; data[o + 1] = y * 31; data[o + 2] = (x ^ y) * 17; data[o + 3] = 255;
        }
    }
    return { width: W, height: H, data: data };
}

// -- smoothing engages on a non-integer upscale -------------------------------

test('axis-aligned non-integer upscale blends at a hard source edge', () => {
    // 3x1 red|red|green upscaled to 7x1: bilinear must produce at least one
    // interior column that is a red-green MIX (both channels non-zero) —
    // nearest-neighbor produces only pure source colors.
    const src = makeRedGreenSource(2, 1);
    const dst = SWCanvas.createCanvas(7, 1);
    const ctx = dst.getContext('2d');
    ctx.drawImage(src, 0, 0, 7, 1);

    const img = ctx.getImageData(0, 0, 7, 1);
    let mixed = 0;
    for (let x = 1; x < 6; x++) { // interior columns (edges fade vs transparent outside)
        const o = x * 4;
        if (img.data[o] > 0 && img.data[o + 1] > 0) mixed++;
    }
    assertEquals(mixed > 0, true, 'no blended column in a non-integer upscale — smoothing did not engage');
});

// -- step-1 byte-exactness (the gate that guards every plain blit) ------------

test('step-1 same-size blit at integer position is byte-exact NN', () => {
    const src = makeGradientSource(8, 8);
    const dst = SWCanvas.createCanvas(16, 16);
    const ctx = dst.getContext('2d');
    ctx.drawImage(src, 5, 3);

    const img = ctx.getImageData(0, 0, 16, 16);
    let wrong = 0;
    for (let sy = 0; sy < 8; sy++) {
        for (let sx = 0; sx < 8; sx++) {
            const o = ((3 + sy) * 16 + (5 + sx)) * 4;
            const so = (sy * 8 + sx) * 4;
            if (img.data[o] !== src.data[so] || img.data[o + 1] !== src.data[so + 1] ||
                img.data[o + 2] !== src.data[so + 2] || img.data[o + 3] !== 255) wrong++;
        }
    }
    assertEquals(wrong, 0, 'same-size blit pixels differing from the source (step-1 leak into bilinear)');
});

test('step-1 via CTM x rect composition is byte-exact NN (scale(2) at half-size rects)', () => {
    // The dpr-2 compensation shape: a physical-resolution source drawn at
    // logical size under a scale(2) CTM. invA = 0.5, xScale = 2 -> step
    // EXACTLY 1: nothing resamples and the bytes must equal the source.
    const src = makeGradientSource(8, 8);
    const dst = SWCanvas.createCanvas(16, 16);
    const ctx = dst.getContext('2d');
    ctx.scale(2, 2);
    ctx.drawImage(src, 0, 0, 8, 8, 2, 1, 4, 4); // dest 4x4 logical = 8x8 device at (4,2)

    const img = ctx.getImageData(0, 0, 16, 16);
    let wrong = 0;
    for (let sy = 0; sy < 8; sy++) {
        for (let sx = 0; sx < 8; sx++) {
            const o = ((2 + sy) * 16 + (4 + sx)) * 4;
            const so = (sy * 8 + sx) * 4;
            if (img.data[o] !== src.data[so] || img.data[o + 1] !== src.data[so + 1] ||
                img.data[o + 2] !== src.data[so + 2] || img.data[o + 3] !== 255) wrong++;
        }
    }
    assertEquals(wrong, 0, 'cpr-compensated (step-1) blit pixels differing from the source');
});

// -- imageSmoothingEnabled ----------------------------------------------------

test('imageSmoothingEnabled: default true, boolean-coerced, both API layers', () => {
    const compat = SWCanvas.createCanvas(4, 4).getContext('2d');
    assertEquals(compat.imageSmoothingEnabled, true, 'compat default');
    compat.imageSmoothingEnabled = 0;
    assertEquals(compat.imageSmoothingEnabled, false, 'compat coerces falsy to false');
    compat.imageSmoothingEnabled = 'yes';
    assertEquals(compat.imageSmoothingEnabled, true, 'compat coerces truthy to true');

    const surface = SWCanvas.Core.Surface(4, 4);
    const core = new SWCanvas.Core.Context2D(surface);
    assertEquals(core.imageSmoothingEnabled, true, 'core default');
    core.imageSmoothingEnabled = 0;
    assertEquals(core.imageSmoothingEnabled, false, 'core coerces falsy to false');
});

test('imageSmoothingEnabled participates in save/restore', () => {
    const ctx = SWCanvas.createCanvas(4, 4).getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    assertEquals(ctx.imageSmoothingEnabled, true, 'set inside save scope');
    ctx.restore();
    assertEquals(ctx.imageSmoothingEnabled, false, 'restore returns the saved value');
});

test('imageSmoothingEnabled=false forces NN on a scaled blit (hard edge kept)', () => {
    // The historical (pre-smoothing) contract, now behind the opt-out: 2x1
    // red|green scaled x8 keeps a hard vertical edge, byte-for-byte.
    const src = makeRedGreenSource(1, 1);
    const dst = SWCanvas.createCanvas(16, 8);
    const ctx = dst.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, 16, 8);

    const img = ctx.getImageData(0, 0, 16, 8);
    let wrong = 0;
    for (let x = 0; x < 16; x++) {
        const o = x * 4;
        const expectRed = x < 8;
        if (img.data[o] !== (expectRed ? 255 : 0) || img.data[o + 1] !== (expectRed ? 0 : 255) ||
            img.data[o + 2] !== 0) wrong++;
    }
    assertEquals(wrong, 0, 'columns of the smoothing-off scaled blit not exactly red|green');
});

test('imageSmoothingEnabled=false forces NN under rotation (pure texels only)', () => {
    // A rotated draw with smoothing off never blends: every covered pixel is
    // exactly the source gray (gaps may reappear — that is the opt-out's
    // documented cost, the user asked for NN).
    const W = 32, H = 32;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let x = 0; x < W; x++) {
        const o = (10 * W + x) * 4;
        data[o] = 128; data[o + 1] = 128; data[o + 2] = 128; data[o + 3] = 255;
    }
    const src = { width: W, height: H, data: data };
    const dst = SWCanvas.createCanvas(110, 110);
    const ctx = dst.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.translate(20.37, 12.61);
    ctx.rotate(Math.PI / 6);
    ctx.drawImage(src, 0, 0);

    const img = ctx.getImageData(0, 0, 110, 110);
    let covered = 0, wrong = 0;
    for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i + 3] === 0) continue;
        covered++;
        if (img.data[i] !== 128 || img.data[i + 1] !== 128 || img.data[i + 2] !== 128 ||
            img.data[i + 3] !== 255) wrong++;
    }
    assertEquals(wrong, 0, 'smoothing-off rotated draw produced blended pixels');
    assertEquals(covered > 20, true, 'the rotated line rendered some coverage');
});

// -- clipped whole-image draws compose seamlessly -----------------------------

test('two adjacent clipped scaled draws equal one unclipped draw (seam-free)', () => {
    // The property incremental compositors rely on (e.g. Fizzygum's scaled
    // islands): drawing the WHOLE image through ONE mapping under two adjacent
    // rect clips must be byte-identical to a single unclipped draw — the clip
    // confines which pixels are written, never the sampling mapping or the
    // available taps.
    const src = makeGradientSource(8, 8);

    const whole = SWCanvas.createCanvas(20, 20);
    const wctx = whole.getContext('2d');
    wctx.drawImage(src, 0, 0, 8, 8, 1, 1, 17, 17); // non-integer step

    const strips = SWCanvas.createCanvas(20, 20);
    const sctx = strips.getContext('2d');
    for (const clip of [[0, 0, 9, 20], [9, 0, 11, 20]]) {
        sctx.save();
        sctx.beginPath();
        sctx.rect(clip[0], clip[1], clip[2], clip[3]);
        sctx.clip();
        sctx.drawImage(src, 0, 0, 8, 8, 1, 1, 17, 17);
        sctx.restore();
    }

    const a = wctx.getImageData(0, 0, 20, 20);
    const b = sctx.getImageData(0, 0, 20, 20);
    let diff = 0;
    for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) diff++;
    assertEquals(diff, 0, 'strip-composed scaled draw differs from the whole draw');
});

// -- downscale sanity ---------------------------------------------------------

test('downscale is deterministic and keeps solid regions solid', () => {
    const W = 8, H = 8;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 40; data[i + 1] = 90; data[i + 2] = 200; data[i + 3] = 255;
    }
    const src = { width: W, height: H, data: data };

    const render = () => {
        const c = SWCanvas.createCanvas(5, 5);
        const x = c.getContext('2d');
        x.drawImage(src, 0, 0, 8, 8, 0, 0, 3, 3);
        return x.getImageData(0, 0, 5, 5);
    };
    const r1 = render(), r2 = render();
    let diff = 0;
    for (let i = 0; i < r1.data.length; i++) if (r1.data[i] !== r2.data[i]) diff++;
    assertEquals(diff, 0, 'two identical downscales differ (nondeterminism)');
    // interior pixel of the solid downscale keeps the source color exactly
    const o = (1 * 5 + 1) * 4;
    assertEquals(r1.data[o], 40, 'solid-region downscale changed R');
    assertEquals(r1.data[o + 1], 90, 'solid-region downscale changed G');
    assertEquals(r1.data[o + 2], 200, 'solid-region downscale changed B');
    assertEquals(r1.data[o + 3], 255, 'solid-region downscale changed A');
});

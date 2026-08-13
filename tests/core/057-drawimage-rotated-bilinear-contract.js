// Test: the transformed-drawImage sampling contract. Draws that do not
// resample — axis-aligned with an effective sample step of exactly 1 —
// sample nearest-neighbor, byte-for-byte as they always have; draws that DO
// resample (rotation/skew, and axis-aligned scale — see
// 058-drawimage-scaled-smoothing-contract.js) sample BILINEAR at the dest
// pixel center, filtered premultiplied, with texels outside the source
// sub-rect contributing transparent black.
//
// WHY: under nearest-neighbor rotation the floor-quantized sample point
// periodically lands on the texel BESIDE a thin source feature, so 1-2px
// features (hairline strokes, selection overlays in Fizzygum's rotated
// "island" composites) disintegrate into dashes. Bilinear cannot produce a
// pure-background gap along a continuous source feature. Reproducer:
// debug/probe-rotated-thinline-gaps.js.

// -- shared helpers -----------------------------------------------------------

function makeLineSource(lineWidthPx, r, g, b, garbageRGB) {
    // 32x32, fully transparent, with a horizontal opaque line at rows 10..10+n.
    // If garbageRGB is set, the transparent texels carry non-black RGB under
    // alpha 0 — a straight-alpha lerp would bleed it into the edges, the
    // premultiplied filter must ignore it.
    const W = 32, H = 32;
    const data = new Uint8ClampedArray(W * H * 4);
    if (garbageRGB) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255; data[i + 1] = 0; data[i + 2] = 255; data[i + 3] = 0;
        }
    }
    for (let y = 10; y < 10 + lineWidthPx; y++) {
        for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        }
    }
    return { width: W, height: H, data: data };
}

function walkRotatedCenterlinePixels(tx, ty, angle, lineWidthPx) {
    // The distinct device pixels the line's centerline crosses, endpoints
    // excluded (a continuous point p lies inside device pixel floor(p)).
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const cy = 10 + lineWidthPx / 2;
    const seen = new Set();
    const pixels = [];
    for (let t = 2; t <= 30; t += 0.05) {
        const px = tx + t * cos - cy * sin;
        const py = ty + t * sin + cy * cos;
        const dx = Math.floor(px), dy = Math.floor(py);
        const key = dx + ',' + dy;
        if (seen.has(key)) continue;
        seen.add(key);
        pixels.push({ dx: dx, dy: dy });
    }
    return pixels;
}

// -- the gap-free contract ----------------------------------------------------

test('rotated drawImage keeps a 1px line gap-free (bilinear, 30 deg)', () => {
    const src = makeLineSource(1, 0, 0, 0, false);
    const dst = SWCanvas.createCanvas(110, 110);
    const ctx = dst.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 110, 110);
    ctx.translate(20.37, 12.61); // fractional translation, like an island composite
    ctx.rotate(Math.PI / 6);
    ctx.drawImage(src, 0, 0);

    const img = ctx.getImageData(0, 0, 110, 110);
    const pixels = walkRotatedCenterlinePixels(20.37, 12.61, Math.PI / 6, 1);
    let gaps = 0;
    for (let i = 0; i < pixels.length; i++) {
        const o = (pixels[i].dy * 110 + pixels[i].dx) * 4;
        const s = img.data[o] + img.data[o + 1] + img.data[o + 2];
        if (s >= 600) gaps++; // essentially background = the feature dropped out
    }
    assertEquals(gaps, 0, 'background gaps along the rotated 1px line centerline');
});

test('rotated drawImage keeps a 2px line gap-free (bilinear, 30 deg)', () => {
    const src = makeLineSource(2, 0, 0, 0, false);
    const dst = SWCanvas.createCanvas(110, 110);
    const ctx = dst.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 110, 110);
    ctx.translate(20, 12);
    ctx.rotate(Math.PI / 6);
    ctx.drawImage(src, 0, 0);

    const img = ctx.getImageData(0, 0, 110, 110);
    const pixels = walkRotatedCenterlinePixels(20, 12, Math.PI / 6, 2);
    let gaps = 0;
    for (let i = 0; i < pixels.length; i++) {
        const o = (pixels[i].dy * 110 + pixels[i].dx) * 4;
        const s = img.data[o] + img.data[o + 1] + img.data[o + 2];
        if (s >= 600) gaps++;
    }
    assertEquals(gaps, 0, 'background gaps along the rotated 2px line centerline');
});

// -- the premultiplied-filtering contract (no fringes) ------------------------

test('rotated drawImage filters premultiplied: no fringe from transparent-texel RGB', () => {
    // Mid-gray line; transparent background texels deliberately carry magenta
    // RGB under alpha 0. Composite onto an EMPTY (transparent) dest: every
    // pixel that received any coverage must be EXACTLY gray 128/128/128 —
    // a straight-alpha lerp would tint edges toward magenta (or darken them
    // toward black with zeroed transparent RGB).
    const src = makeLineSource(1, 128, 128, 128, true);
    const dst = SWCanvas.createCanvas(110, 110);
    const ctx = dst.getContext('2d');
    ctx.translate(20.37, 12.61);
    ctx.rotate(Math.PI / 6);
    ctx.drawImage(src, 0, 0);

    const img = ctx.getImageData(0, 0, 110, 110);
    let covered = 0, wrong = 0;
    for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i + 3] === 0) continue;
        covered++;
        if (img.data[i] !== 128 || img.data[i + 1] !== 128 || img.data[i + 2] !== 128) wrong++;
    }
    assertEquals(wrong, 0, 'covered pixels whose RGB is not exactly the line gray');
    assertEquals(covered > 50, true, 'the rotated line rendered some coverage');
});

// -- the zero-fraction exactness contract (crisp 90 deg) ----------------------

test('exact 90 deg + integer translation stays crisp: pure texels, no blends', () => {
    // setTransform(0,1,-1,0,...) is an EXACT quarter-turn (ctx.rotate(PI/2)
    // would leave ~1e-17 residues in a and d). Dest pixel centers then land
    // exactly ON texel centers -> the zero-fraction fast path -> every output
    // pixel is byte-identical to one source texel, no blending anywhere.
    const W = 8, H = 8;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            data[o] = x * 30; data[o + 1] = y * 30; data[o + 2] = (x ^ y) * 20; data[o + 3] = 255;
        }
    }
    const src = { width: W, height: H, data: data };

    const dst = SWCanvas.createCanvas(24, 24);
    const ctx = dst.getContext('2d');
    // rotate 90 deg CW about the origin, then shift right so the image lands
    // at x in [10, 18): dest = (10 + (H-1) - sy, sx)
    ctx.setTransform(0, 1, -1, 0, 10 + H, 0);
    ctx.drawImage(src, 0, 0);

    const img = ctx.getImageData(0, 0, 24, 24);
    let wrong = 0;
    for (let sy = 0; sy < H; sy++) {
        for (let sx = 0; sx < W; sx++) {
            const dx = 10 + H - 1 - sy, dy = sx;
            const o = (dy * 24 + dx) * 4;
            const so = (sy * W + sx) * 4;
            if (img.data[o] !== data[so] || img.data[o + 1] !== data[so + 1] ||
                img.data[o + 2] !== data[so + 2] || img.data[o + 3] !== 255) wrong++;
        }
    }
    assertEquals(wrong, 0, 'pixels of the 90 deg composite differing from the exact source texel');
});

// -- the step-1 gate (non-resampling draws stay nearest-neighbor) -------------

test('step-1 same-size drawImage stays nearest-neighbor byte-exact (hard edge)', () => {
    // 2x1 red|green blitted same-size at an integer position: the effective
    // sample step is exactly 1, nothing resamples, and the historical NN
    // bytes must come out — any blended column would mean the smoothing gate
    // leaked into the step-1 path (the path every glyph and back-buffer blit
    // rides).
    const data = new Uint8ClampedArray(2 * 1 * 4);
    data[0] = 255; data[3] = 255;              // red
    data[5] = 255; data[7] = 255;              // green
    const src = { width: 2, height: 1, data: data };

    const dst = SWCanvas.createCanvas(8, 4);
    const ctx = dst.getContext('2d');
    ctx.drawImage(src, 3, 1);

    const img = ctx.getImageData(0, 0, 8, 4);
    let wrong = 0;
    for (let x = 3; x < 5; x++) {
        const o = (1 * 8 + x) * 4;
        const expectRed = x === 3;
        if (img.data[o] !== (expectRed ? 255 : 0) || img.data[o + 1] !== (expectRed ? 0 : 255) ||
            img.data[o + 2] !== 0 || img.data[o + 3] !== 255) wrong++;
    }
    assertEquals(wrong, 0, 'pixels of the same-size blit not exactly red|green (smoothing leak)');
});

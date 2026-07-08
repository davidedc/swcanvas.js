// Test: Texture3D.litVariant - identity at full brightness, exact
// pre-modulation at quantized levels, caching, and rendering equivalence
// through the copy-only fast path of the perspective span
// This file will be concatenated into the main test suite

test('Texture3D litVariant quantization, caching and render equivalence', () => {
    const S = 32;
    const td = new Uint8ClampedArray(S * S * 4);
    for (let v = 0; v < S; v++) {
        for (let u = 0; u < S; u++) {
            const i = (v * S + u) * 4;
            td[i] = u * 8 + 1;
            td[i + 1] = v * 8 + 2;
            td[i + 2] = 77;
            td[i + 3] = 255;
        }
    }
    const tex = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td });

    // Full brightness (and anything quantizing to 256) is identity: same object
    assertEquals(tex.litVariant(256) === tex, true, '256 must return the texture itself');
    assertEquals(tex.litVariant(253) === tex, true, '253 quantizes to 256 -> identity');

    // Quantized level: 128 is a multiple of 8, so modulation must be exact
    const half = tex.litVariant(128);
    assertEquals(half === tex, false);
    assertEquals(half.width, S);
    assertEquals(half.uMask, tex.uMask);
    let bad = 0;
    for (let i = 0; i < tex.data32.length; i++) {
        const t = tex.data32[i];
        const expected =
            ((t & 0xff000000) |
                ((((((t >> 16) & 0xff) * 128) >> 8) & 0xff) << 16) |
                ((((((t >> 8) & 0xff) * 128) >> 8) & 0xff) << 8) |
                (((t & 0xff) * 128) >> 8)) >>>
            0;
        if (half.data32[i] !== expected) bad++;
    }
    assertEquals(bad, 0, 'level-128 variant must be exactly (c*128)>>8 per channel');

    // Caching: same level returns the same object; 130 quantizes to 128 too
    assertEquals(tex.litVariant(128) === half, true, 'variant must be cached');
    assertEquals(tex.litVariant(130) === half, true, '130 quantizes to the same level as 128');

    // Render equivalence: persp fill with (litVariant, 256) must equal
    // persp fill with (texture, quantizedIntensity) pixel-for-pixel
    const T = SWCanvas.Core.Triangle3DOps;
    const W = 96, H = 96;
    const render = (texture, intensity) => {
        const surf = SWCanvas.Core.Surface(W, H);
        const depth = new SWCanvas.Core.DepthBuffer(W, H);
        surf.data32.fill(0);
        T.fillTriangleTexturedPersp(surf, depth, 5, 5, 0.5, 0, 0, 90, 10, 0.25, 64, 0, 10, 90, 0.4, 0, 64, texture, intensity, null);
        return surf;
    };
    const direct = render(tex, 104); // 104 is a multiple of 8 -> no quantization error
    const cached = render(tex.litVariant(104), 256);
    let diff = 0;
    for (let i = 0; i < W * H; i++) {
        if (direct.data32[i] !== cached.data32[i]) diff++;
    }
    assertEquals(diff, 0, 'litVariant + fast path must render identically to direct modulation');
});

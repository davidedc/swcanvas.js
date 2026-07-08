// Test: Texture3D.buildMips - chain shape, box-filter exactness, lit-variant
// propagation, and minified rendering sampling from the selected level
// This file will be concatenated into the main test suite

test('Texture3D mip chain build, filtering, litVariant propagation, render', () => {
    // 4x4 texture with known values: r channel = 16*u + 4*v (distinct per texel)
    const mk = () => {
        const data = new Uint8ClampedArray(4 * 4 * 4);
        for (let v = 0; v < 4; v++) {
            for (let u = 0; u < 4; u++) {
                const i = (v * 4 + u) * 4;
                data[i] = 16 * u + 4 * v;
                data[i + 1] = 100;
                data[i + 2] = 200;
                data[i + 3] = 255;
            }
        }
        return new SWCanvas.Core.Texture3D({ width: 4, height: 4, data: data });
    };

    const tex = mk().buildMips();
    assertEquals(tex.mips.length, 3, '4x4 -> 2x2 -> 1x1 = 3 levels');
    assertEquals(tex.mips[0].data32 === tex.data32, true, 'level 0 shares base texels');
    assertEquals(tex.mips[1].width, 2);
    assertEquals(tex.mips[1].uMask, 1);
    assertEquals(tex.mips[1].shift, 1);
    assertEquals(tex.mips[2].width, 1);

    // Box filter exactness: level-1 texel (0,0) = rounded average of the
    // 2x2 block r values {0, 16, 4, 20} -> (40+2)>>2 = 10
    assertEquals(tex.mips[1].data32[0] & 0xff, 10, 'level-1 (0,0) red must be rounded 2x2 average');
    // g and b are uniform, so averages must be exact
    assertEquals((tex.mips[1].data32[0] >> 8) & 0xff, 100);
    assertEquals((tex.mips[1].data32[0] >> 16) & 0xff, 200);
    assertEquals((tex.mips[1].data32[0] >>> 24) & 0xff, 255, 'alpha preserved through the filter');

    // buildMips is idempotent
    const chain = tex.mips;
    tex.buildMips();
    assertEquals(tex.mips === chain, true, 'second buildMips must be a no-op');

    // litVariant propagates the chain with exact per-level modulation
    const half = tex.litVariant(128);
    assertEquals(!!half.mips, true, 'lit variant must carry mips');
    assertEquals(half.mips.length, 3);
    assertEquals(half.mips[0].data32 === half.data32, true, 'lit level 0 shares variant texels');
    assertEquals(half.mips[1].data32[0] & 0xff, (10 * 128) >> 8, 'lit mip texel must be (c*q)>>8 of the mip texel');

    // Minified render: 32x32 base, du/dx = 5 -> level 2 expected.
    // (5, not 4: selection floors the float step, so a step sitting exactly
    // on a power-of-two boundary can legitimately resolve one level lower
    // when 1/segmentLength rounding nudges it below the boundary. 5 is
    // robustly inside the level-2 bracket [4, 8).)
    // Replicate the span's selection + sampling and compare pixel-for-pixel.
    const S = 32;
    const td = new Uint8ClampedArray(S * S * 4);
    for (let v = 0; v < S; v++) {
        for (let u = 0; u < S; u++) {
            const i = (v * S + u) * 4;
            td[i] = u * 8;
            td[i + 1] = v * 8;
            td[i + 2] = 33;
            td[i + 3] = 255;
        }
    }
    const big = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td }).buildMips();

    const T = SWCanvas.Core.Triangle3DOps;
    const W = 64, H = 64;
    const surf = SWCanvas.Core.Surface(W, H);
    const depth = new SWCanvas.Core.DepthBuffer(W, H);
    surf.data32.fill(0);
    // Right triangle at origin, u = 5x (minification x5), v = 5y, constant z
    T.fillTriangleTexturedPersp(surf, depth, 0, 0, 0.5, 0, 0, 48, 0, 0.5, 240, 0, 0, 48, 0.5, 0, 240, big, 256, null);

    const L = big.mips[2]; // step 5 -> level 2 (bracket [4, 8))
    let covered = 0, wrong = 0;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const p = surf.data32[y * W + x];
            if (p === 0) continue;
            covered++;
            const u = 5 * x, v = 5 * y; // exact plane values at pixel (x, y)
            const expected = L.data32[(((v >> 2) & L.vMask) << L.shift) | ((u >> 2) & L.uMask)];
            if (p !== expected) wrong++;
        }
    }
    assertEquals(covered > 800, true, 'sanity: coverage');
    assertEquals(wrong, 0, 'minified pixels must sample the level-2 mip exactly');
});

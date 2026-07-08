// Test: textured triangle is texel-exact under identity UV mapping and
// wrap-around addressing repeats the texture exactly
// This file will be concatenated into the main test suite

test('Triangle3DOps textured identity mapping and wrap addressing', () => {
    const T = SWCanvas.Core.Triangle3DOps;
    const S = 64;
    const td = new Uint8ClampedArray(S * S * 4);
    for (let v = 0; v < S; v++) {
        for (let u = 0; u < S; u++) {
            const i = (v * S + u) * 4;
            td[i] = u * 4;
            td[i + 1] = v * 4;
            td[i + 2] = 128;
            td[i + 3] = 255;
        }
    }
    const tex = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td });

    const W = 128, H = 128;
    const surf = SWCanvas.Core.Surface(W, H);
    const depth = new SWCanvas.Core.DepthBuffer(W, H);

    // Identity mapping: right triangle at (10,10), UV = (x-10, y-10)
    surf.data32.fill(0);
    depth.clear();
    T.fillTriangleTextured(surf, depth, 10, 10, 0.5, 0, 0, 74, 10, 0.5, 64, 0, 10, 74, 0.5, 0, 64, tex, null);
    let mismatches = 0, checked = 0;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const p = surf.data32[y * W + x];
            if (p === 0) continue;
            checked++;
            const expected = tex.data32[(((y - 10) & tex.vMask) << tex.shift) | ((x - 10) & tex.uMask)];
            if (p !== expected) mismatches++;
        }
    }
    assertEquals(mismatches, 0, 'identity-mapped triangle must be texel-exact');
    assertEquals(checked > 1000, true, 'sanity: triangle must actually cover pixels');
    const reference = [];
    for (let i = 0; i < W * H; i++) reference.push(surf.data32[i]);

    // Wrap: same triangle with UVs offset by 4 full texture periods
    surf.data32.fill(0);
    depth.clear();
    T.fillTriangleTextured(surf, depth, 10, 10, 0.5, 256, 256, 74, 10, 0.5, 320, 256, 10, 74, 0.5, 256, 320, tex, null);
    let wrapDiff = 0;
    for (let i = 0; i < W * H; i++) {
        if (reference[i] !== surf.data32[i]) wrapDiff++;
    }
    assertEquals(wrapDiff, 0, 'UVs offset by full periods must render identically (wrap)');
});

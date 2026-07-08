// Test: textured intensity modulation is bit-exact - 256 is identity,
// other values are exactly (channel * intensity) >> 8, alpha forced to 255
// This file will be concatenated into the main test suite

test('Triangle3DOps intensity modulation exactness', () => {
    const T = SWCanvas.Core.Triangle3DOps;
    const S = 64;
    const td = new Uint8ClampedArray(S * S * 4);
    for (let v = 0; v < S; v++) {
        for (let u = 0; u < S; u++) {
            const i = (v * S + u) * 4;
            td[i] = u * 4 + 3;
            td[i + 1] = v * 4 + 1;
            td[i + 2] = 200;
            td[i + 3] = 255;
        }
    }
    const tex = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td });

    const W = 64, H = 64;
    const render = (intensity) => {
        const surf = SWCanvas.Core.Surface(W, H);
        const depth = new SWCanvas.Core.DepthBuffer(W, H);
        surf.data32.fill(0);
        // Identity-ish mapping over a right triangle at the origin
        T.fillTriangleTexturedPersp(surf, depth, 0, 0, 0.5, 0, 0, 63, 0, 0.5, 63, 0, 0, 63, 0.5, 0, 63, tex, intensity, null);
        return surf;
    };

    const checkAll = (surf, intensity) => {
        let bad = 0, n = 0;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const p = surf.data32[y * W + x];
                if (p === 0) continue;
                n++;
                const texel = tex.data32[((y & tex.vMask) << tex.shift) | (x & tex.uMask)];
                const expR = ((texel & 0xff) * intensity) >> 8;
                const expG = (((texel >> 8) & 0xff) * intensity) >> 8;
                const expB = (((texel >> 16) & 0xff) * intensity) >> 8;
                if ((p & 0xff) !== expR || ((p >> 8) & 0xff) !== expG || ((p >> 16) & 0xff) !== expB) bad++;
                if (((p >>> 24) & 0xff) !== 255) bad++;
            }
        }
        assertEquals(n > 1000, true, 'sanity: coverage');
        assertEquals(bad, 0, `intensity=${intensity} must be bit-exact per channel with alpha 255`);
        return n;
    };

    checkAll(render(256), 256); // identity: (c * 256) >> 8 === c
    checkAll(render(128), 128);
    checkAll(render(37), 37);

    // intensity 0 -> black (but still opaque and depth-written)
    const black = render(0);
    let nonBlack = 0, covered = 0;
    for (let i = 0; i < W * H; i++) {
        const p = black.data32[i];
        if (p === 0) continue;
        covered++;
        if ((p & 0xffffff) !== 0) nonBlack++;
    }
    assertEquals(nonBlack, 0, 'intensity=0 must render black');
    assertEquals(covered > 1000, true, 'sanity: coverage at intensity 0');
});

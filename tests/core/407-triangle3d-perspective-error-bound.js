// Test: perspective-correct texturing stays within 1 texel of the exact
// per-pixel divide on strong-perspective geometry (where affine is off by
// tens of texels)
// This file will be concatenated into the main test suite

test('Triangle3DOps perspective correction error bound', () => {
    const T = SWCanvas.Core.Triangle3DOps;

    // Decode texture: r = u, g = v
    const S = 256;
    const td = new Uint8ClampedArray(S * S * 4);
    for (let v = 0; v < S; v++) {
        for (let u = 0; u < S; u++) {
            const i = (v * S + u) * 4;
            td[i] = u;
            td[i + 1] = v;
            td[i + 2] = 0;
            td[i + 3] = 255;
        }
    }
    const tex = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td });

    const W = 640, H = 480;
    // Floor-like triangle, z from 2 (bottom) to 12 (top): 6:1 depth ratio
    const V = [
        { x: 20, y: 460, z: 2, u: 0, v: 255 },
        { x: 620, y: 460, z: 2, u: 255, v: 255 },
        { x: 320, y: 40, z: 12, u: 128, v: 0 }
    ];
    const iz = [1 / V[0].z, 1 / V[1].z, 1 / V[2].z];

    // Independent exact reference: plane gradients of 1/z, u/z, v/z
    const bxe = V[1].x - V[0].x, bye = V[1].y - V[0].y;
    const cxe = V[2].x - V[0].x, cye = V[2].y - V[0].y;
    const A2 = bxe * cye - cxe * bye;
    const grad = (a0, a1, a2) => ({
        gx: ((a1 - a0) * cye - (a2 - a0) * bye) / A2,
        gy: (bxe * (a2 - a0) - cxe * (a1 - a0)) / A2,
        a0: a0
    });
    const gIZ = grad(iz[0], iz[1], iz[2]);
    const gUZ = grad(V[0].u * iz[0], V[1].u * iz[1], V[2].u * iz[2]);
    const gVZ = grad(V[0].v * iz[0], V[1].v * iz[1], V[2].v * iz[2]);

    const measure = (usePersp) => {
        const surf = SWCanvas.Core.Surface(W, H);
        const depth = new SWCanvas.Core.DepthBuffer(W, H);
        surf.data32.fill(0);
        if (usePersp) {
            T.fillTriangleTexturedPersp(surf, depth,
                V[0].x, V[0].y, iz[0], V[0].u, V[0].v,
                V[1].x, V[1].y, iz[1], V[1].u, V[1].v,
                V[2].x, V[2].y, iz[2], V[2].u, V[2].v,
                tex, 256, null);
        } else {
            T.fillTriangleTextured(surf, depth,
                V[0].x, V[0].y, iz[0], V[0].u, V[0].v,
                V[1].x, V[1].y, iz[1], V[1].u, V[1].v,
                V[2].x, V[2].y, iz[2], V[2].u, V[2].v,
                tex, null);
        }
        let maxE = 0;
        for (let y = 40; y < 461; y++) {
            for (let x = 20; x < 621; x++) {
                const p = surf.data32[y * W + x];
                if (p === 0) continue;
                const dx = x - V[0].x, dy = y - V[0].y;
                const zi = gIZ.a0 + dx * gIZ.gx + dy * gIZ.gy;
                const ue = (gUZ.a0 + dx * gUZ.gx + dy * gUZ.gy) / zi;
                const ve = (gVZ.a0 + dx * gVZ.gx + dy * gVZ.gy) / zi;
                const e = Math.max(Math.abs((p & 0xff) - Math.floor(ue)), Math.abs(((p >> 8) & 0xff) - Math.floor(ve)));
                if (e > maxE) maxE = e;
            }
        }
        return maxE;
    };

    const perspErr = measure(true);
    const affineErr = measure(false);
    log(`persp max UV error: ${perspErr} texels; affine on same geometry: ${affineErr}`);
    assertEquals(perspErr <= 1, true, `perspective-correct error must be <= 1 texel, got ${perspErr}`);
    assertEquals(affineErr > 10, true, 'sanity: geometry must be perspective-hard (affine visibly wrong)');
});

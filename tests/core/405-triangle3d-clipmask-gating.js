// Test: Triangle3DOps clipBuffer gates BOTH color and depth writes, and the
// byte fast paths agree exactly with a per-pixel reference
// This file will be concatenated into the main test suite

test('Triangle3DOps clip mask gates color and depth writes', () => {
    const T = SWCanvas.Core.Triangle3DOps;
    const W = 120, H = 120;
    const R2 = 40 * 40;
    const inside = (x, y) => {
        const dx = x - 60, dy = y - 60;
        return dx * dx + dy * dy <= R2;
    };

    const probe = SWCanvas.Core.Surface(1, 1);
    probe.setPixelOpaque(0, 255, 0, 0);
    const RED = probe.data32[0];

    // Circular clip (partial bytes at the boundary exercise all three
    // clip code paths: 0x00 skip, 0xFF run, per-pixel)
    const mask = new SWCanvas.Core.ClipMask(W, H);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!inside(x, y)) mask.setPixel(x, y, false);
        }
    }

    const s = SWCanvas.Core.Surface(W, H);
    const d = new SWCanvas.Core.DepthBuffer(W, H);
    s.data32.fill(0);
    T.fillTriangleZ(s, d, 5, 5, 0.5, 115, 5, 0.5, 60, 115, 0.5, RED, mask.buffer);

    // Reference: same triangle unclipped
    const rs = SWCanvas.Core.Surface(W, H);
    const rd = new SWCanvas.Core.DepthBuffer(W, H);
    rs.data32.fill(0);
    T.fillTriangleZ(rs, rd, 5, 5, 0.5, 115, 5, 0.5, 60, 115, 0.5, RED, null);

    let colorLeak = 0, depthLeak = 0, missingDepth = 0, clippedCount = 0, refCount = 0;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (!inside(x, y)) {
                if (s.data32[i] !== 0) colorLeak++;
                if (d.data[i] !== 0) depthLeak++;
            } else {
                if (s.data32[i] === RED) {
                    clippedCount++;
                    if (d.data[i] === 0) missingDepth++;
                }
                if (rs.data32[i] === RED) refCount++;
            }
        }
    }

    assertEquals(colorLeak, 0, 'no color writes outside the clip');
    assertEquals(depthLeak, 0, 'no depth writes outside the clip (would create invisible occluders)');
    assertEquals(missingDepth, 0, 'every drawn pixel must also write depth');
    assertEquals(clippedCount, refCount, 'clipped coverage must equal unclipped coverage intersected with the mask');
});

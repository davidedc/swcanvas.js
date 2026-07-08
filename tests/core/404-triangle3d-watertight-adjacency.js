// Test: Triangle3DOps fill rule is watertight - a quad split along its
// diagonal produces no double-written pixels and no gaps, at any rotation
// This file will be concatenated into the main test suite

test('Triangle3DOps watertight shared edges (no overlap, no gaps)', () => {
    const T = SWCanvas.Core.Triangle3DOps;
    const W = 160, H = 160;

    const probe = SWCanvas.Core.Surface(1, 1);
    probe.setPixelOpaque(0, 255, 0, 0);
    const RED = probe.data32[0];
    probe.setPixelOpaque(0, 0, 0, 255);
    const BLUE = probe.data32[0];

    let totalOverlap = 0;
    let totalGapRows = 0;

    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.13;
        const cos = Math.cos(a), sin = Math.sin(a);
        const pts = [[-50.3, -34.7], [45.9, -27.3], [38.1, 42.6], [-30.7, 36.2]].map((p) => [
            80 + p[0] * cos - p[1] * sin,
            80 + p[0] * sin + p[1] * cos
        ]);

        // Each triangle alone -> coverage sets
        const covA = {};
        const covB = {};
        for (let pass = 0; pass < 2; pass++) {
            const s = SWCanvas.Core.Surface(W, H);
            const d = new SWCanvas.Core.DepthBuffer(W, H);
            s.data32.fill(0);
            if (pass === 0) {
                T.fillTriangleZ(s, d, pts[0][0], pts[0][1], 0.5, pts[1][0], pts[1][1], 0.5, pts[2][0], pts[2][1], 0.5, RED, null);
            } else {
                T.fillTriangleZ(s, d, pts[0][0], pts[0][1], 0.5, pts[2][0], pts[2][1], 0.5, pts[3][0], pts[3][1], 0.5, BLUE, null);
            }
            const cov = pass === 0 ? covA : covB;
            for (let i = 0; i < W * H; i++) {
                if (s.data32[i] !== 0) cov[i] = true;
            }
        }
        for (const i in covA) {
            if (covB[i]) totalOverlap++;
        }

        // Union: per row, covered pixels of a convex quad must be contiguous
        const u = SWCanvas.Core.Surface(W, H);
        const ud = new SWCanvas.Core.DepthBuffer(W, H);
        u.data32.fill(0);
        T.fillTriangleZ(u, ud, pts[0][0], pts[0][1], 0.5, pts[1][0], pts[1][1], 0.5, pts[2][0], pts[2][1], 0.5, RED, null);
        T.fillTriangleZ(u, ud, pts[0][0], pts[0][1], 0.5, pts[2][0], pts[2][1], 0.5, pts[3][0], pts[3][1], 0.5, BLUE, null);
        for (let y = 0; y < H; y++) {
            let first = -1, last = -1;
            for (let x = 0; x < W; x++) {
                if (u.data32[y * W + x] !== 0) {
                    if (first < 0) first = x;
                    last = x;
                }
            }
            if (first < 0) continue;
            for (let x = first; x <= last; x++) {
                if (u.data32[y * W + x] === 0) {
                    totalGapRows++;
                    break;
                }
            }
        }
    }

    assertEquals(totalOverlap, 0, 'shared edge must not be written by both triangles');
    assertEquals(totalGapRows, 0, 'shared edge must not leave gap pixels');
});

// Test: Triangle3DOps depth-test semantics - near wins, strict-> ties,
// and correct per-pixel interpenetration of crossing depth planes
// This file will be concatenated into the main test suite

test('Triangle3DOps depth test: near wins, ties keep first, interpenetration', () => {
    const T = SWCanvas.Core.Triangle3DOps;
    const W = 100, H = 100;
    const surf = SWCanvas.Core.Surface(W, H);
    const depth = new SWCanvas.Core.DepthBuffer(W, H);

    const probe = SWCanvas.Core.Surface(1, 1);
    probe.setPixelOpaque(0, 255, 0, 0);
    const RED = probe.data32[0];
    probe.setPixelOpaque(0, 0, 0, 255);
    const BLUE = probe.data32[0];

    const quadZ = (color, iz00, iz10, iz11, iz01) => {
        T.fillTriangleZ(surf, depth, 0, 0, iz00, W, 0, iz10, W, H, iz11, color, null);
        T.fillTriangleZ(surf, depth, 0, 0, iz00, W, H, iz11, 0, H, iz01, color, null);
    };

    // 1. Near wins
    surf.data32.fill(0);
    depth.clear();
    quadZ(RED, 0.2, 0.2, 0.2, 0.2);
    quadZ(BLUE, 0.4, 0.4, 0.4, 0.4);
    assertEquals(surf.data32[50 * W + 50], BLUE, 'nearer draw must win');

    // 2. Strict > : equal depth keeps the first-drawn pixel
    quadZ(RED, 0.4, 0.4, 0.4, 0.4);
    assertEquals(surf.data32[50 * W + 50], BLUE, 'tie must keep first-drawn pixel');

    // 3. Interpenetration: constant plane (0.3) vs x-gradient plane
    //    (0.2 at x=0 to 0.4 at x=100) -> crossover at x=50
    surf.data32.fill(0);
    depth.clear();
    quadZ(RED, 0.3, 0.3, 0.3, 0.3);
    quadZ(BLUE, 0.2, 0.4, 0.4, 0.2);
    assertEquals(surf.data32[50 * W + 25], RED, 'left of intersection: constant plane in front');
    assertEquals(surf.data32[50 * W + 75], BLUE, 'right of intersection: gradient plane in front');
    assertEquals(surf.data32[50 * W + 49], RED, 'one pixel left of crossover');
    assertEquals(surf.data32[50 * W + 51], BLUE, 'one pixel right of crossover');
});

// Test: a near-horizontal polygon edge still crosses the scanlines in its sliver of y
// This file will be concatenated into the main test suite
//
// A polygon's edges cover y half-open, [min, max), so every scanline is crossed by exactly
// the edges it lies in. An edge whose two ends differ in y by a hair (two computed vertices
// one ulp apart) is the ONLY edge covering that hair: if the scanline falls in it, the edge's
// crossing is the row's crossing. Only an exactly horizontal edge has none. Pinned for fill(),
// clip() and isPointInPath(), with the hair at a pixel-center row.

test('A near-horizontal edge keeps its scanline crossing', () => {
    const W = 40;
    const H = 40;
    for (const nudge of [0, 2e-15, 5e-11, -2e-15]) {
        const shape = c => {
            c.beginPath();
            c.moveTo(10, 5);
            c.lineTo(30, 5);
            c.lineTo(30, 10.5);
            c.lineTo(30, 10.5 + nudge);
            c.lineTo(30, 30);
            c.lineTo(10, 30);
            c.closePath();
        };
        for (const mode of ['fill', 'clip']) {
            const surface = SWCanvas.Core.Surface(W, H);
            const ctx = new SWCanvas.Core.Context2D(surface);
            ctx.setFillStyle(0, 0, 0, 255);
            shape(ctx);
            if (mode === 'fill') {
                ctx.fill();
            } else {
                ctx.clip();
                ctx.fillRect(0, 0, W, H);
            }
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const on = surface.data[y * surface.stride + x * 4 + 3] !== 0;
                    const inside = x >= 10 && x < 30 && y >= 5 && y < 30;
                    if (on !== inside) {
                        throw new Error(`${mode}, vertex nudged by ${nudge}: pixel (${x},${y}) ${on ? 'painted outside' : 'missed inside'}`);
                    }
                }
            }
        }
        const ctx = new SWCanvas.Core.Context2D(SWCanvas.Core.Surface(W, H));
        shape(ctx);
        if (!ctx.isPointInPath(25, 10.5)) {
            throw new Error(`isPointInPath(25, 10.5), vertex nudged by ${nudge}: false, but the point is inside`);
        }
    }
    log('  near-horizontal edges keep their scanline crossings (fill, clip, isPointInPath)');
});

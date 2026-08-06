// Test: strokeRoundRect 1px semi-transparent - junction exactness (no gaps, no double blends)
// This file will be concatenated into the main test suite
//
// The semi-transparent 1px rounded-rect fast path shortens each edge run by one
// pixel and relies on the corner arcs covering the junction pixels exactly once.
// Two failure modes are therefore invisible to bounds/color-count checks but
// fatal to crispness, and both are pinned here:
//   - a junction GAP (the corner's quadrant-endpoint pixel misses the edge line;
//     historically caused by ~1e-16 Math.cos/sin noise at the 90-degree
//     multiples flooring the endpoint one unit off - see QUADRANT_TRIG_EPSILON),
//   - a junction DOUBLE BLEND (edge and corner both painting the same pixel,
//     which darkens it and breaks the stroke's uniform color).
// Checked for the grid-centered (integer) and pixel-centered (half-integer)
// crisp spellings alike.

test('RoundRect stroke1px semi-transparent - junction gaps and single-blend uniformity', () => {
    const W = 90;
    const H = 60;

    function check(label, x, y, w, h, r) {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        ctx.setStrokeStyle(255, 0, 0, 128);
        ctx.lineWidth = 1;
        ctx.strokeRoundRect(x, y, w, h, r);

        // Collect every non-background pixel with its color.
        const stroke = new Set();
        const strokeColors = new Set();
        for (let py = 0; py < H; py++) {
            for (let px = 0; px < W; px++) {
                const o = py * surface.stride + px * 4;
                const rr = surface.data[o];
                const gg = surface.data[o + 1];
                const bb = surface.data[o + 2];
                if (rr === 255 && gg === 255 && bb === 255) continue;
                stroke.add(py * W + px);
                strokeColors.add((rr << 16) | (gg << 8) | bb);
            }
        }
        if (stroke.size === 0) {
            throw new Error(`${label}: nothing drawn`);
        }

        // Single-blend uniformity: every stroke pixel carries the one 50%-red-
        // over-white blend value. A pixel blended twice is darker and adds a
        // second color.
        if (strokeColors.size !== 1) {
            throw new Error(
                `${label}: expected one uniform stroke color, found ${strokeColors.size} - ` +
                    `some pixels were blended more than once`
            );
        }

        // Closed ring: every stroke pixel has at least 2 stroke neighbors
        // (8-connectivity); a junction gap leaves its two flanking pixels with
        // only one neighbor each.
        for (const p of stroke) {
            const px = p % W;
            const py = (p - px) / W;
            let neighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (stroke.has((py + dy) * W + (px + dx))) neighbors++;
                }
            }
            if (neighbors < 2) {
                throw new Error(
                    `${label}: stroke pixel (${px},${py}) has ${neighbors} neighbor(s) - junction gap`
                );
            }
        }

        log(`  ${label}: closed ring, uniform single-blend color`);
    }

    for (const r of [1, 2, 3, 5, 8, 10]) {
        check(`integer r=${r}`, 10, 8, 28, 22, r);
        check(`half-integer r=${r}`, 10.5, 8.5, 28, 22, r);
    }
});

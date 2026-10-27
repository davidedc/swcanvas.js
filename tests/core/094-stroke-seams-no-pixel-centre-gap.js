// Test: a join or a cap meets its segment body with no pixel-centre gap on the seam
// This file will be concatenated into the main test suite
//
// A stroke is filled as separate parts - segment bodies, joins, caps - under the nonzero
// rule. Where a join or a cap meets a body they share an edge: the body's end edge through
// the joint (or cap point), perpendicular to the segment. The whole of that edge, short of
// its two corners, lies INSIDE the stroke (the join or cap continues past it), so a pixel
// centre exactly on it must be painted - which only happens if the filler crosses that edge
// at the bit-identical x from both parts. Integer ends with both direction components odd
// put pixel centres exactly on these lines; each join is drawn by translate() and by
// coordinates, at scale 1 and 2, at two device offsets (the rounding of the shared edge
// depends on where it lies), each cap at the first of them. Checked exactly, in doubled
// device coordinates (pixel centres odd): u = centre - joint, on the edge when u.d == 0,
// strictly inside the half width when u.u < (lineWidth * scale)^2. Each offset reuses one
// canvas: a stroke's bounding box is cleared before it is drawn, and only the square around
// each seam is read back.

test('Stroke seams - no pixel-centre gap where a join or cap meets a body', () => {
    const P = 80;
    // Directions (a, b), both odd: a spread of turns and segment lengths, including the ones whose
    // seams open when a join and a body do not share their seam points exactly
    const directions = [
        [-9, 5], [-7, 3], [-5, 1], [-5, 3], [-3, 7], [-3, 9], [-1, 3], [-1, 5], [-1, 9], [1, 1],
        [1, 3], [3, 1], [3, 3], [3, 5], [5, 5], [5, 9], [7, 1], [7, 7], [9, 3], [9, 9]
    ];
    // [scale, by translate(), offsets, line widths]: device widths 6 and 11 at scale 1, 6 and 22 at scale 2
    const spellings = [
        [1, true, [[3, 3], [3, 701]], [6, 11]],
        [1, false, [[3, 3], [474, 3]], [6, 11]],
        [2, true, [[3, 3], [474, 701]], [3, 11]],
        [2, false, [[3, 3], [474, 3]], [3, 11]]
    ];
    let seamPixels = 0;
    let strokes = 0;
    for (const [dev, byTranslate, offsets, widths] of spellings) {
        offsets.forEach(([X, Y], offsetIndex) => {
            const canvas = SWCanvas.createCanvas((X + P) * dev, (Y + P) * dev);
            const ctx = canvas.getContext('2d');
            for (const [a, b] of directions) {
                const k = Math.max(1, Math.round(18 / Math.hypot(a, b)));
                const turn = [[40 - a * k, 40 - b * k], [40, 40], [40 - b * k, 40 + a * k]];
                const line = [[40 - a * k, 40 - b * k], [40 + a * k, 40 + b * k]];
                const shapes = [['round', 'butt', turn], ['miter', 'butt', turn], ['bevel', 'butt', turn]];
                if (offsetIndex === 0) shapes.push(['miter', 'round', line], ['miter', 'square', line]);
                for (const lw of widths) {
                    for (const [join, cap, pts] of shapes) {
                        // the shared edges: [point, direction the edge is perpendicular to]
                        const seams = pts.length === 3 ? [[pts[1], [a, b]], [pts[1], [-b, a]]] : [[pts[0], [a, b]], [pts[1], [a, b]]];
                        // clear the stroke's bounding box (a miter reaches lineWidth / sqrt(2) past the joint)
                        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
                        const left = Math.floor((X + Math.min(...xs) - lw - 1) * dev);
                        const top = Math.floor((Y + Math.min(...ys) - lw - 1) * dev);
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.clearRect(left, top, Math.ceil((X + Math.max(...xs) + lw + 1) * dev) - left, Math.ceil((Y + Math.max(...ys) + lw + 1) * dev) - top);
                        ctx.setTransform(dev, 0, 0, dev, 0, 0);
                        let ox = X, oy = Y;
                        if (byTranslate) {
                            ctx.translate(X, Y);
                            ox = 0;
                            oy = 0;
                        }
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = lw;
                        ctx.lineJoin = join;
                        ctx.lineCap = cap;
                        ctx.beginPath();
                        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x + ox, y + oy) : ctx.lineTo(x + ox, y + oy)));
                        ctx.stroke();
                        strokes++;
                        const H2 = lw * dev * lw * dev;
                        const r = Math.ceil((lw * dev) / 2) + 1;
                        for (const [[sx, sy], [dx, dy]] of seams) {
                            // the square of device pixels around the seam point, crop-relative (i, j)
                            const i0 = sx * dev - r, j0 = sy * dev - r, n = 2 * r;
                            const d = ctx.getImageData(X * dev + i0, Y * dev + j0, n, n).data;
                            for (let j = j0; j < j0 + n; j++) {
                                for (let i = i0; i < i0 + n; i++) {
                                    const ux = 2 * i + 1 - 2 * dev * sx, uy = 2 * j + 1 - 2 * dev * sy;
                                    if (ux * dx + uy * dy !== 0 || ux * ux + uy * uy >= H2) continue;
                                    seamPixels++;
                                    if (d[((j - j0) * n + (i - i0)) * 4 + 3] === 0) {
                                        throw new Error(
                                            `${pts.length === 3 ? join + ' join' : cap + ' cap'} (${a},${b}) lineWidth ${lw} at ` +
                                                `${byTranslate ? 'translate' : 'coordinates'} (${X},${Y}) scale ${dev}: pixel (${i},${j}) ` +
                                                `of the crop lies on the seam at (${sx},${sy}) inside the stroke, unpainted`
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    log(`  ${strokes} strokes, ${seamPixels} seam pixel centres all painted`);
});

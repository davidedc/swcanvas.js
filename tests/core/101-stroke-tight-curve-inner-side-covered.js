// Test: a thick stroke along short segments covers the inner side of every join, whatever the join kind
// This file will be concatenated into the main test suite
//
// A stroke is its segment bodies plus a join at every vertex. Where two consecutive segments are
// short for the line's width - a thick stroke on a tightly flattened curve, short polyline steps -
// their bodies cannot cover the inner side of their join: the triangle [joint, inner corner of the
// first body's end, inner corner of the second body's start], which the swept line covers. Every
// join kind adds that triangle exactly where the bodies leave part of it bare (the two lengths
// together under halfWidth * |sin(turn)|) - round joins included, so the join kind never changes
// what a curve's inner side paints. Polylines on small circles and a U-turn, each pixel centre more
// than 1e-6 px inside such a triangle must be painted.

test('Thick stroke on short segments - inner side covered for every join kind', () => {
    const shapes = [];
    for (const [r, steps] of [[1, 16], [2, 12], [3, 16], [5, 24]]) {
        const pts = [];
        for (let i = 0; i <= Math.round(steps * 0.8); i++) {
            const t = 0.3 + (2 * Math.PI * i) / steps;
            pts.push([r * Math.cos(t), r * Math.sin(t)]);
        }
        shapes.push([`circle r${r}`, pts]);
    }
    shapes.push(['U-turn', [[-4, -6], [0, -5.5], [2.5, -3.5], [3.5, 0], [2.5, 3.5], [0, 5.5], [-4, 6]]]);
    let triangles = 0;
    for (const [name, rel] of shapes) {
        for (const lw of [8, 16, 30]) {
            const W = 2 * Math.ceil(lw + 12), c = W / 2 + 0.37;
            const pts = rel.map(([x, y]) => [c + x, c + y]);
            const h = lw / 2;
            // the inner triangles the bodies leave bare
            const tris = [];
            for (let i = 1; i + 1 < pts.length; i++) {
                const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
                const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
                const t1 = [(p1[0] - p0[0]) / l1, (p1[1] - p0[1]) / l1], t2 = [(p2[0] - p1[0]) / l2, (p2[1] - p1[1]) / l2];
                const cross = t1[0] * t2[1] - t1[1] * t2[0];
                if (!(l1 + l2 < h * Math.abs(cross))) continue;
                const s = cross > 0 ? 1 : -1; // inner side: the normal (-t.y, t.x) on a left turn
                tris.push([
                    [p1[0], p1[1]],
                    [p1[0] - s * t1[1] * h, p1[1] + s * t1[0] * h],
                    [p1[0] - s * t2[1] * h, p1[1] + s * t2[0] * h]
                ]);
            }
            for (const join of ['round', 'miter', 'bevel']) {
                const ctx = SWCanvas.createCanvas(W, W).getContext('2d');
                ctx.strokeStyle = '#000';
                ctx.lineWidth = lw;
                ctx.lineJoin = join;
                ctx.beginPath();
                pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
                ctx.stroke();
                const d = ctx.getImageData(0, 0, W, W).data;
                for (const T of tris) {
                    triangles++;
                    const area = (T[1][0] - T[0][0]) * (T[2][1] - T[0][1]) - (T[2][0] - T[0][0]) * (T[1][1] - T[0][1]);
                    const sg = area > 0 ? 1 : -1;
                    const x0 = Math.floor(Math.min(T[0][0], T[1][0], T[2][0])), x1 = Math.ceil(Math.max(T[0][0], T[1][0], T[2][0]));
                    const y0 = Math.floor(Math.min(T[0][1], T[1][1], T[2][1])), y1 = Math.ceil(Math.max(T[0][1], T[1][1], T[2][1]));
                    for (let y = y0; y < y1; y++) {
                        for (let x = x0; x < x1; x++) {
                            let inside = true;
                            for (let e = 0; e < 3 && inside; e++) {
                                const A = T[e], B = T[(e + 1) % 3], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
                                const dist = (sg * ((B[0] - A[0]) * (y + 0.5 - A[1]) - (B[1] - A[1]) * (x + 0.5 - A[0]))) / len;
                                if (dist <= 1e-6) inside = false;
                            }
                            if (inside && d[(y * W + x) * 4 + 3] === 0) {
                                throw new Error(
                                    `${name} lineWidth ${lw}, ${join} joins: pixel (${x},${y}) inside the inner triangle at ` +
                                        `(${T[0][0].toFixed(2)},${T[0][1].toFixed(2)}) is unpainted`
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    log(`  ${triangles} inner triangles covered`);
});

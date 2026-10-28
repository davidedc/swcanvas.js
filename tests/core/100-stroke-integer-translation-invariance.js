// Test: a stroke paints the same pixels wherever a whole-pixel translation puts it
// This file will be concatenated into the main test suite
//
// Moving a drawing by whole device pixels - by translate() or by its own coordinates - moves
// its pixels by the same whole pixels and changes nothing else. This holds even where the
// stroke's outline passes EXACTLY through pixel centres (a tie, decided by float rounding): a
// butt end through an integer point, perpendicular to a direction whose components are both
// odd, or a side edge of a Pythagorean direction ((3,4) at an odd width). The stroke is
// computed relative to an integer point of its own path and filled relative to the integer
// device pixel that point lands at, so the same small numbers are rounded wherever it lands -
// for stroke() and for the direct strokeLine() alike. Every join and cap kind, near the origin
// and at an offset of thousands of pixels, at scale 1 and 2. Each offset reuses one canvas: a
// stroke's bounding box is cleared before it is drawn and read back after.

test('stroke() and strokeLine() - invariant under whole-pixel translation', () => {
    const P = 80;
    const directions = [
        [1, 1], [-3, 3], [7, 7], [1, 3], [3, 9], [5, 1], [-1, 5], [5, 3], [-9, 3], [3, 4], [-4, 3], [-8, 6]
    ];
    // [scale, by translate(), the far offset (each is compared with the stroke at (3, 3))]
    const spellings = [
        [1, true, [5, 4093]],
        [1, false, [5, 4093]],
        [2, true, [700, 1513]],
        [2, false, [700, 1513]]
    ];
    let strokes = 0;
    for (const [dev, byTranslate, far] of spellings) {
        const offsets = [[3, 3], far];
        const contexts = offsets.map(([X, Y]) => SWCanvas.createCanvas((X + P) * dev, (Y + P) * dev).getContext('2d'));
        for (const [a, b] of directions) {
            const k = Math.max(1, Math.round(18 / Math.hypot(a, b)));
            const turn = [[40 - a * k, 40 - b * k], [40, 40], [40 - b * k, 40 + a * k]];
            const line = [[40 - a * k, 40 - b * k], [40 + a * k, 40 + b * k]];
            const shapes = [
                ['round', 'butt', turn, 'round join'],
                ['miter', 'butt', turn, 'miter join'],
                ['bevel', 'butt', turn, 'bevel join'],
                ['miter', 'round', line, 'round cap'],
                ['miter', 'square', line, 'square cap'],
                ['miter', 'butt', line, 'butt cap'],
                ['miter', 'butt', line, 'strokeLine']
            ];
            for (const lw of [6, 11]) {
                for (const [join, cap, pts, kind] of shapes) {
                    // the stroke's bounding box in the crop (a miter reaches lineWidth / sqrt(2) past the joint)
                    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
                    const left = Math.floor((Math.min(...xs) - lw - 1) * dev), top = Math.floor((Math.min(...ys) - lw - 1) * dev);
                    const w = Math.ceil((Math.max(...xs) + lw + 1) * dev) - left, h = Math.ceil((Math.max(...ys) + lw + 1) * dev) - top;
                    let base = null;
                    offsets.forEach(([X, Y], o) => {
                        const ctx = contexts[o];
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.clearRect(X * dev + left, Y * dev + top, w, h);
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
                        if (kind === 'strokeLine') {
                            ctx.strokeLine(pts[0][0] + ox, pts[0][1] + oy, pts[1][0] + ox, pts[1][1] + oy);
                        } else {
                            ctx.beginPath();
                            pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x + ox, y + oy) : ctx.lineTo(x + ox, y + oy)));
                            ctx.stroke();
                        }
                        strokes++;
                        const d = ctx.getImageData(X * dev + left, Y * dev + top, w, h).data;
                        if (base === null) {
                            base = d;
                            return;
                        }
                        for (let i = 3; i < d.length; i += 4) {
                            if ((d[i] > 0) !== (base[i] > 0)) {
                                const px = left + ((i >> 2) % w), py = top + Math.floor((i >> 2) / w);
                                throw new Error(
                                    `${kind} (${a},${b}) lineWidth ${lw}, scale ${dev}, ${byTranslate ? 'translate' : 'coordinates'} ` +
                                        `(${X},${Y}): crop pixel (${px},${py}) ${d[i] > 0 ? 'painted' : 'unpainted'}, but ` +
                                        `${base[i] > 0 ? 'painted' : 'unpainted'} at (3,3)`
                                );
                            }
                        }
                    });
                }
            }
        }
    }
    log(`  ${strokes} strokes, identical at both offsets`);
});

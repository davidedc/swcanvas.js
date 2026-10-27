// Test: one stroke() is the UNION of its parts - overlapping caps, joins and bodies never cancel
// This file will be concatenated into the main test suite
//
// A stroke covers the union of the shapes its pen sweeps (HTML5: the traced path is
// "the edge of the areas that would be covered" by the swept line). SWCanvas fills a
// stroke's parts - segment bodies, joins, caps - together under the nonzero rule, so
// a part wound against the others would cancel coverage wherever it overlaps another
// part of the same stroke(). Pinned here, with opaque paint (overpainting is the union):
//   1. ACROSS SUBPATHS: stroking several subpaths in ONE stroke() paints exactly what
//      stroking each in its own stroke() paints - a T (the stem's start cap on the bar,
//      and the bar's end on the stem), a cross, a star of segments sharing an end,
//      collinear overlaps run both ways, a V whose join lies on a crossing bar; every
//      cap and join kind;
//   2. WITHIN A SUBPATH: a polyline's stroke paints every pixel each of its segments
//      paints stroked alone (butt caps) - sharp V turns and near-degenerate closed
//      quads, where a join's parts overlap the bodies they connect;
//   3. isPointInStroke reads the same parts: a point where the T's stem cap overlaps
//      the bar is in the stroke.

test('One-path stroke - the union of its parts', () => {
    const S = 48;
    function render(width, height, setup, paths, closed) {
        const canvas = SWCanvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#000';
        setup(ctx);
        for (const subpaths of paths) {
            ctx.beginPath();
            for (const pts of subpaths) {
                pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
                if (closed) ctx.closePath();
            }
            ctx.stroke();
        }
        return ctx.getImageData(0, 0, width, height).data;
    }

    // 1. ACROSS SUBPATHS
    const scenes = [];
    const c = S / 2;
    scenes.push(['tee (cap on the bar)', [[[4, c], [S - 4, c]], [[c, c], [c, 6]]]]);
    scenes.push(['tee (bar end on the stem)', [[[c, 6], [c, c]], [[4, c], [S - 4, c]]]]);
    scenes.push(['cross', [[[4, c], [S - 4, c]], [[c, 4], [c, S - 4]]]]);
    scenes.push(['collinear overlap, same way', [[[4, c], [30, c]], [[16, c], [S - 4, c]]]]);
    scenes.push(['collinear overlap, opposite ways', [[[4, c], [30, c]], [[S - 4, c], [16, c]]]]);
    scenes.push(['V join on a crossing bar', [[[8, 40], [c, 20], [40, 40]], [[4, 22], [S - 4, 22]]]]);
    const star = [];
    for (let k = 0; k < 7; k++) {
        const a = (k * 2 * Math.PI) / 7 + 0.3;
        star.push([[c, c], [Math.round(c + 18 * Math.cos(a)), Math.round(c + 18 * Math.sin(a))]]);
    }
    scenes.push(['star of 7 from one point', star]);
    let unionCases = 0;
    for (const cap of ['round', 'square', 'butt']) {
        for (const join of ['round', 'miter', 'bevel']) {
            for (const lw of [2, 3, 4, 6, 8]) {
                for (const [label, subpaths] of scenes) {
                    const setup = (ctx) => {
                        ctx.lineWidth = lw;
                        ctx.lineCap = cap;
                        ctx.lineJoin = join;
                    };
                    const together = render(S, S, setup, [subpaths], false);
                    const apart = render(S, S, setup, subpaths.map((p) => [p]), false);
                    for (let i = 0; i < together.length; i += 4) {
                        if (together[i] !== apart[i]) {
                            const p = i / 4;
                            throw new Error(
                                `${label} cap=${cap} join=${join} lw=${lw}: pixel (${p % S},${Math.floor(p / S)}) ` +
                                    `${together[i] < 128 ? 'painted' : 'unpainted'} in one stroke() but ` +
                                    `${apart[i] < 128 ? 'painted' : 'unpainted'} stroked part by part`
                            );
                        }
                    }
                    unionCases++;
                }
            }
        }
    }

    // 2. WITHIN A SUBPATH: sharp V turns, and thin closed quads (a grid of skews, thicknesses,
    //    sizes and sub-pixel offsets)
    const polylines = [];
    for (const dx of [1, 2, 3, 5]) {
        polylines.push([
            [
                [
                    [c - dx, 6],
                    [c, 40],
                    [c + dx, 6]
                ]
            ],
            false
        ]);
    }
    for (const skew of [-0.35, -0.1, 0.15, 0.4]) {
        for (const thin of [0.03, 0.08, 0.15]) {
            for (const [size, x0, y0] of [
                [12, 14.3, 18.6],
                [23, 11.7, 15.2]
            ]) {
                const t = size * thin;
                polylines.push([
                    [
                        [
                            [x0, y0],
                            [x0 + size, y0 + skew * size],
                            [x0 + size * (1 + skew), y0 + skew * size + t],
                            [x0 + skew * size, y0 + t]
                        ]
                    ],
                    true
                ]);
            }
        }
    }
    let subsetCases = 0;
    for (const join of ['round', 'miter', 'bevel']) {
        for (const lw of [1, 2, 3]) {
            for (const [subpaths, closed] of polylines) {
                const setup = (ctx) => {
                    ctx.lineWidth = lw;
                    ctx.lineCap = 'butt';
                    ctx.lineJoin = join;
                };
                const whole = render(S, S, setup, [subpaths], closed);
                const pts = closed ? subpaths[0].concat([subpaths[0][0]]) : subpaths[0];
                for (let j = 0; j + 1 < pts.length; j++) {
                    const seg = render(S, S, setup, [[[pts[j], pts[j + 1]]]], false);
                    for (let i = 0; i < whole.length; i += 4) {
                        if (seg[i] < 128 && whole[i] >= 128) {
                            const p = i / 4;
                            throw new Error(
                                `polyline ${JSON.stringify(pts.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]))} ` +
                                    `join=${join} lw=${lw}: pixel (${p % S},${Math.floor(p / S)}) is painted by ` +
                                    `segment ${j} alone but not by the whole stroke`
                            );
                        }
                    }
                }
                subsetCases++;
            }
        }
    }

    // 3. isPointInStroke: inside the bar AND the stem's start cap, off every part edge
    const probe = SWCanvas.createCanvas(S, S).getContext('2d');
    probe.lineWidth = 4;
    probe.lineCap = 'round';
    probe.beginPath();
    probe.moveTo(4, c);
    probe.lineTo(S - 4, c);
    probe.moveTo(c, c);
    probe.lineTo(c, 6);
    if (!probe.isPointInStroke(c + 0.3, c + 1.1) || probe.isPointInStroke(c + 0.3, c + 4)) {
        throw new Error('isPointInStroke: the stem cap over the bar must be in the stroke, a point past both must not');
    }

    log(`  ${unionCases} one-path renders equal their part-by-part union, ${subsetCases} polylines contain their segments`);
});

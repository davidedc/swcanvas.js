// Test: roundRect radii - the HTML5 per-corner contract, on every roundRect entry point
// This file will be concatenated into the main test suite
//
// Contract pin for the per-corner radii decision (DIRECT-RENDERING-SUMMARY.MD §9
// entry 11, which records how the radii argument went from first-element-wins to
// HTML5 semantics). Every roundRect entry - the path methods
// (Context2D.roundRect, SWPath2D.roundRect) and the immediate-mode
// fillRoundRect / strokeRoundRect / fillStrokeRoundRect - reads radii the way
// HTML5 roundRect() does (CSS border-radius order). Pinned here:
//   1. list expansion: r | [r] | [a,b] | [a,b,c] | [a,b,c,d] land on the
//      right corners (TL, TR, BR, BL), probed by which bounding-box corner
//      pixels a fill/stroke leaves unpainted;
//   2. validation exactly as HTML5: RangeError for a negative radius or a list
//      of other than 1-4 entries, TypeError for an elliptical {x, y} radius
//      (the one divergence), a NaN/infinite radius draws nothing - and the
//      immediate-mode entries validate UP FRONT, so throwing never depends on
//      the paint or the dimensions;
//   3. every uniform spelling renders byte-identically to the scalar radius;
//   4. overlapping radii scale down PROPORTIONALLY (all four by one factor),
//      not by per-corner clamping;
//   5. the path method leaves the current point at (x, y) on a new subpath, and
//      a negative width mirrors the corners about (x, y) - both as HTML5.

test('roundRect radii - HTML5 per-corner contract on every entry point', () => {
    const W = 60;
    const H = 44;
    const BOX = [10, 8, 40, 28]; // x, y, w, h (integer: the corner pixel is unambiguous)

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        ctx.setFillStyle(0, 0, 255, 255);
        ctx.setStrokeStyle(255, 0, 0, 255);
        ctx.lineWidth = 1;
        return { surface, ctx };
    }

    function render(draw) {
        const { surface, ctx } = newCtx();
        draw(ctx);
        return surface;
    }

    function isPainted(surface, x, y) {
        const o = y * surface.stride + x * 4;
        return !(surface.data[o] === 255 && surface.data[o + 1] === 255 && surface.data[o + 2] === 255);
    }

    function sameBytes(a, b) {
        for (let i = 0; i < a.data.length; i++) {
            if (a.data[i] !== b.data[i]) return false;
        }
        return true;
    }

    function blank(surface) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (isPainted(surface, x, y)) return false;
            }
        }
        return true;
    }

    const [bx, by, bw, bh] = BOX;
    // The four bounding-box corner pixels of the box, in TL, TR, BR, BL order. A
    // fill covers pixel centers inside the path; a 1px stroke on the *.5 frame
    // covers the same outer ring - either way a rounded corner leaves its
    // bounding-box corner pixel unpainted and a square one paints it.
    const fillCornerPixels = [
        [bx, by],
        [bx + bw - 1, by],
        [bx + bw - 1, by + bh - 1],
        [bx, by + bh - 1]
    ];
    const strokeCornerPixels = [
        [bx, by],
        [bx + bw, by],
        [bx + bw, by + bh],
        [bx, by + bh]
    ];

    const ENTRIES = [
        ['fillRoundRect', fillCornerPixels, (ctx, r) => ctx.fillRoundRect(bx, by, bw, bh, r)],
        ['strokeRoundRect (direct)', strokeCornerPixels, (ctx, r) => ctx.strokeRoundRect(bx + 0.5, by + 0.5, bw, bh, r)],
        [
            'fillStrokeRoundRect (direct)',
            strokeCornerPixels,
            (ctx, r) => ctx.fillStrokeRoundRect(bx + 0.5, by + 0.5, bw, bh, r)
        ],
        [
            'ctx.roundRect + fill',
            fillCornerPixels,
            (ctx, r) => {
                ctx.beginPath();
                ctx.roundRect(bx, by, bw, bh, r);
                ctx.fill();
            }
        ],
        [
            'SWPath2D.roundRect + fill',
            fillCornerPixels,
            (ctx, r) => {
                const p = new SWCanvas.Core.SWPath2D();
                p.roundRect(bx, by, bw, bh, r);
                ctx.fill(p);
            }
        ]
    ];

    // 1. List expansion - which corners come out rounded (true) vs square (false).
    const EXPANSIONS = [
        [8, [true, true, true, true]],
        [[8], [true, true, true, true]],
        [[8, 0], [true, false, true, false]],
        [[0, 8], [false, true, false, true]],
        [[8, 0, 0], [true, false, false, false]],
        [[0, 8, 0], [false, true, false, true]],
        [[0, 0, 8], [false, false, true, false]],
        [[8, 0, 0, 0], [true, false, false, false]],
        [[0, 8, 0, 0], [false, true, false, false]],
        [[0, 0, 8, 0], [false, false, true, false]],
        [[0, 0, 0, 8], [false, false, false, true]],
        [[8, 8, 0, 0], [true, true, false, false]], // the title-bar spelling
        [0, [false, false, false, false]],
        [undefined, [false, false, false, false]]
    ];
    const CORNER_NAMES = ['TL', 'TR', 'BR', 'BL'];
    for (const [label, cornerPixels, draw] of ENTRIES) {
        for (const [radii, rounded] of EXPANSIONS) {
            const s = render((ctx) => draw(ctx, radii));
            for (let i = 0; i < 4; i++) {
                const [px, py] = cornerPixels[i];
                if (isPainted(s, px, py) === rounded[i]) {
                    throw new Error(
                        `${label} radii ${JSON.stringify(radii)}: corner ${CORNER_NAMES[i]} should be ` +
                            `${rounded[i] ? 'rounded' : 'square'}`
                    );
                }
            }
        }
        log(`  ${label}: r | [a] | [a,b] | [a,b,c] | [a,b,c,d] land on TL,TR,BR,BL`);
    }

    // 2. Validation, exactly as HTML5 (the error TYPE matters: RangeError vs TypeError).
    function expectError(label, fn, name) {
        let thrown = null;
        try {
            fn();
        } catch (e) {
            thrown = e;
        }
        if (!thrown) throw new Error(`${label}: expected a ${name}, nothing was thrown`);
        if (thrown.name !== name) throw new Error(`${label}: expected a ${name}, got ${thrown.name}: ${thrown.message}`);
    }
    const CALLS = [
        ['ctx.roundRect', (ctx, r) => ctx.roundRect(bx, by, bw, bh, r)],
        ['SWPath2D.roundRect', (ctx, r) => new SWCanvas.Core.SWPath2D().roundRect(bx, by, bw, bh, r)],
        ['fillRoundRect', (ctx, r) => ctx.fillRoundRect(bx, by, bw, bh, r)],
        ['strokeRoundRect', (ctx, r) => ctx.strokeRoundRect(bx, by, bw, bh, r)],
        ['fillStrokeRoundRect', (ctx, r) => ctx.fillStrokeRoundRect(bx, by, bw, bh, r)]
    ];
    for (const [label, call] of CALLS) {
        const { ctx } = newCtx();
        expectError(`${label} radius -1`, () => call(ctx, -1), 'RangeError');
        expectError(`${label} radii [4, -1]`, () => call(ctx, [4, -1]), 'RangeError');
        expectError(`${label} radii []`, () => call(ctx, []), 'RangeError');
        expectError(`${label} radii [1,2,3,4,5]`, () => call(ctx, [1, 2, 3, 4, 5]), 'RangeError');
        expectError(`${label} radius {x, y}`, () => call(ctx, { x: 4, y: 4 }), 'TypeError');
        expectError(`${label} radii [4, {x, y}]`, () => call(ctx, [4, { x: 4, y: 2 }]), 'TypeError');
    }
    log('  all five entry points: RangeError (negative / 0 or 5 radii), TypeError ({x, y})');

    // Up-front validation: an invalid radius throws even when nothing would draw.
    {
        const { ctx } = newCtx();
        ctx.setFillStyle(0, 0, 0, 0);
        ctx.setStrokeStyle(0, 0, 0, 0);
        expectError('fillRoundRect transparent paint', () => ctx.fillRoundRect(bx, by, bw, bh, -1), 'RangeError');
        expectError('strokeRoundRect negative width', () => ctx.strokeRoundRect(bx, by, -5, bh, [1, 2, 3, 4, 5]), 'RangeError');
        expectError('fillStrokeRoundRect zero height', () => ctx.fillStrokeRoundRect(bx, by, bw, 0, -2), 'RangeError');
        log('  immediate-mode entries validate radii up front (paint/dimensions never decide a throw)');
    }

    // A NaN or infinite radius (or coordinate, for the path method) draws nothing, silently.
    for (const bad of [NaN, Infinity, [4, NaN], [4, 4, -Infinity, 4]]) {
        for (const [label, , draw] of ENTRIES) {
            const s = render((ctx) => draw(ctx, bad));
            if (!blank(s)) throw new Error(`${label} radii ${String(bad)}: a non-finite radius must draw nothing`);
        }
        const s = render((ctx) => {
            ctx.beginPath();
            ctx.rect(2, 2, 4, 4);
            ctx.roundRect(bx, by, NaN, bh, 4);
            ctx.roundRect(bx, by, bw, bh, bad);
            ctx.fill();
        });
        if (isPainted(s, bx + bw / 2, by + bh / 2)) {
            throw new Error(`ctx.roundRect: a NaN width / non-finite radius must add no subpath`);
        }
    }
    log('  NaN / infinite radius (or coordinate): no throw, nothing drawn');

    // 3. Uniform spellings are byte-identical to the scalar radius, on the direct
    //    arms at identity, scale and a quarter turn, and on the generic fill.
    const CTMS = [
        ['identity', () => {}],
        ['scale 2', (ctx) => ctx.scale(2, 2)],
        ['quarter turn', (ctx) => ctx.setTransform(0, 1, -1, 0, 52, 2)]
    ];
    const SPELLINGS = [[6], [6, 6], [6, 6, 6], [6, 6, 6, 6]];
    for (const [ctmLabel, applyCtm] of CTMS) {
        for (const [label, , draw] of ENTRIES) {
            const scalar = render((ctx) => {
                applyCtm(ctx);
                ctx.lineWidth = 3;
                draw(ctx, 6);
            });
            for (const spelling of SPELLINGS) {
                const arr = render((ctx) => {
                    applyCtm(ctx);
                    ctx.lineWidth = 3;
                    draw(ctx, spelling);
                });
                if (!sameBytes(arr, scalar)) {
                    throw new Error(`${label} @${ctmLabel}: radii ${JSON.stringify(spelling)} differs from radius 6`);
                }
            }
        }
    }
    log('  [r] / [r,r] / [r,r,r] / [r,r,r,r] === r, every entry, identity / scale / quarter turn');

    // 4. Proportional overlap scaling. On the 40x28 box, [56, 0, 0, 0] overflows
    //    the left side (56 > 28): every radius scales by 28/56, so TL becomes 28 -
    //    per-corner clamping to half a side would give 14. [40, 40, 0, 0] overflows
    //    the top (80 > 40): both scale by 40/80 to 20. (Power-of-two factors keep
    //    the fitted radii exact.)
    const OVERLAPS = [
        [[56, 0, 0, 0], [28, 0, 0, 0]],
        [[40, 40, 0, 0], [20, 20, 0, 0]],
        [[100], [14]]
    ];
    for (const [given, fitted] of OVERLAPS) {
        const fill = (r) => (ctx) => ctx.fillRoundRect(bx, by, bw, bh, r);
        if (!sameBytes(render(fill(given)), render(fill(fitted)))) {
            throw new Error(`fillRoundRect radii ${JSON.stringify(given)} should fit to ${JSON.stringify(fitted)}`);
        }
        const stroke = (r) => (ctx) => ctx.strokeRoundRect(bx + 0.5, by + 0.5, bw, bh, r);
        if (!sameBytes(render(stroke(given)), render(stroke(fitted)))) {
            throw new Error(`strokeRoundRect radii ${JSON.stringify(given)} should fit to ${JSON.stringify(fitted)}`);
        }
    }
    log('  overlapping radii scale proportionally (HTML5), not per corner');

    // 5a. The current point after roundRect() is (x, y), on a NEW subpath: a
    //     following lineTo draws from (x, y), not from the rect's first point.
    {
        const s = render((ctx) => {
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(bx, by, 20, 10, 4);
            ctx.lineTo(bx, by + 34);
            ctx.stroke();
        });
        // Below the rect the line from (x, y) runs down column x; one from the
        // rect's first point (x + 4, y) would cross column x + 3 here instead.
        if (!isPainted(s, bx, by + 12) || isPainted(s, bx + 3, by + 12)) {
            throw new Error('ctx.roundRect: the current point afterwards is not (x, y)');
        }
        log('  current point after roundRect() is (x, y)');
    }

    // 5b. A negative width mirrors the rect about (x, y): radii[0] stays on the
    //     corner AT (x, y) - here the visual top-right.
    {
        const s = render((ctx) => {
            ctx.beginPath();
            ctx.roundRect(bx + bw, by, -bw, bh, [8, 0, 0, 0]);
            ctx.fill();
        });
        if (isPainted(s, bx + bw - 1, by) || !isPainted(s, bx, by)) {
            throw new Error('ctx.roundRect with a negative width: radii[0] must round the corner at (x, y)');
        }
        log('  negative width mirrors the corners about (x, y)');
    }
});

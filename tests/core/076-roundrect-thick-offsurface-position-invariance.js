// Test: thick / fused rounded-rect strokes partially off-surface - position invariance on every side
// This file will be concatenated into the main test suite
//
// The axis-aligned thick and fused rounded-rect arms (strokeRoundRect at a
// device line width > 1, fillStrokeRoundRect at any width) walk the shape row by
// row and clamp each row's span to the surface / clip rect. A row's extent can start at
// a NEGATIVE x - the shape hangs off the surface's left edge, or a widget is
// painted past the left of the canvas it lands on - and such a row must still
// paint its on-surface part. Contract pinned here: the on-surface part of a
// render that hangs off any side is byte-identical to the same window of the
// same draw made fully on a wider/taller surface (integer shifts are exact in
// the renderers' arithmetic, so clamping may only REMOVE pixels), for:
//   - strokeRoundRect and fillStrokeRoundRect, opaque and semi-transparent;
//   - uniform and per-corner radii;
//   - identity, and scale(2) with the 1-logical-px crisp spelling
//     (strokeRoundRect(0.5, 0.5, w - 1, h - 1, r)) a HiDPI client strokes with;
//   - line widths 1..7 (at 1, strokeRoundRect is the 1px arm and the fused
//     entry still walks rows), unclipped and under a rect clip;
//   - the shape off the left, right, top and bottom edges, and far enough off
//     the left / top that both of that side's corner arcs are off-surface too.
// (The circle analogue is 052.)

test('RoundRect thick/fused strokes off-surface - position invariance on every side', () => {
    const W = 64;
    const H = 56;
    const PAD = 80; // the wide/tall surface adds PAD on the shifted axis

    function render(width, height, dx, dy, opts) {
        const surface = SWCanvas.Core.Surface(width, height);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, width, height);
        if (opts.clip) {
            ctx.beginPath();
            ctx.rect(3 + dx, 2 + dy, W - 7, H - 5);
            ctx.clip();
        }
        ctx.translate(dx, dy);
        if (opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
        ctx.setFillStyle(0, 0, 255, opts.semi ? 128 : 255);
        ctx.setStrokeStyle(255, 0, 0, opts.semi ? 128 : 255);
        ctx.lineWidth = opts.lw;
        if (opts.fused) {
            ctx.fillStrokeRoundRect(opts.x, opts.y, opts.w, opts.h, opts.r);
        } else {
            ctx.strokeRoundRect(opts.x, opts.y, opts.w, opts.h, opts.r);
        }
        return surface;
    }

    // [label, x, y] in DEVICE px for the shape's box (w x h device px)
    const SIDES = [
        ['off-left', -9, 10],
        ['off-right', 34, 10],
        ['off-top', 10, -9],
        ['off-bottom', 10, 30],
        ['far off-left', -30, 10],
        ['far off-top', 10, -24]
    ];
    let cases = 0;
    for (const fused of [false, true]) {
        for (const semi of [false, true]) {
            for (const radii of [9, [9, 0, 5, 2]]) {
                for (const clip of [false, true]) {
                    for (const [label, bx, by] of SIDES) {
                        // identity, line widths 1..7 (odd widths put the path on half pixels)
                        const variants = [];
                        for (let lw = 1; lw <= 7; lw++) {
                            variants.push({ scale: 1, lw, x: bx, y: by, w: 38, h: 34, r: radii });
                        }
                        // scale(2): the 1-logical-px crisp spelling, box at logical (bx/2, by/2)
                        variants.push({
                            scale: 2,
                            lw: 1,
                            x: bx / 2 + 0.5,
                            y: by / 2 + 0.5,
                            w: 19 - 1,
                            h: 17 - 1,
                            r: Array.isArray(radii) ? radii.map((v) => Math.round(v / 2)) : Math.round(radii / 2)
                        });
                        for (const v of variants) {
                            const opts = Object.assign({ fused, semi, clip }, v);
                            const offAxisX = label.endsWith('left') || label.endsWith('right');
                            const shift = label.endsWith('left') || label.endsWith('top') ? PAD : 0;
                            const got = render(W, H, 0, 0, opts);
                            const wide = offAxisX
                                ? render(W + PAD, H, shift, 0, opts)
                                : render(W, H + PAD, 0, shift, opts);
                            for (let y = 0; y < H; y++) {
                                for (let x = 0; x < W; x++) {
                                    const go = y * got.stride + x * 4;
                                    const wo = offAxisX
                                        ? y * wide.stride + (x + shift) * 4
                                        : (y + shift) * wide.stride + x * 4;
                                    for (let c = 0; c < 4; c++) {
                                        if (got.data[go + c] !== wide.data[wo + c]) {
                                            throw new Error(
                                                `${fused ? 'fillStrokeRoundRect' : 'strokeRoundRect'} ${label} ` +
                                                    `${semi ? 'semi' : 'opaque'} radii=${JSON.stringify(radii)} ` +
                                                    `clip=${clip} scale=${opts.scale} lw=${opts.lw}: pixel (${x},${y}) ` +
                                                    `differs from the fully-on-surface render`
                                            );
                                        }
                                    }
                                }
                            }
                            cases++;
                        }
                    }
                }
            }
        }
    }
    log(`  ${cases} off-surface renders match their fully-on-surface windows`);
});

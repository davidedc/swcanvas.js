// Test: rounded-rect fills and clips are translation-invariant under integer translations
// This file will be concatenated into the main test suite
//
// A rasterizer must paint the same pixels for the same integer geometry wherever it
// is drawn. Pinned for every rounded-rect FILL path and both CLIP spellings, which
// all flatten arcTo corners through the generic pipeline: fillRoundRect (uniform
// and per-corner radii, opaque and translucent), fillStadium, roundRect() + fill(),
// roundRect() + clip() on the Context2D path and clip(SWPath2D) - plus the direct
// stroke and fused arms as controls. Every integer radius 1..64 and half-integer
// radius 0.5..40.5, at device positions including the canvas's own (0, 0) and
// coordinates up to ~4000 on each axis, must reproduce the baseline crop at (3, 3).
//
// What it guards: an arcTo corner is flattened into ceil(sweep / 90deg x 16)
// segments, and an exact quarter turn's sweep comes out of atan2 of the corner's
// position-dependent tangent points as 16.000000000000004 at some positions. A bare
// ceil gives the top-right (sometimes the bottom-right) corner 17 segments there and
// 16 elsewhere - 1 to 8 corner pixels differ at radii such as 15, 17, 28, 29, 32,
// 34, 38, 39, 44 - so every segment count goes through PathFlattener.segmentCount.

test('roundRect fills and clips - translation-invariant at integer positions', () => {
    const M = 2; // margin read around the box
    const BASE = [3, 3];
    const POSITIONS = [
        [0, 0],
        [0, 3],
        [3, 0],
        [1, 1],
        [64, 1],
        [127, 255],
        [333, 7],
        [2056, 236],
        [4093, 5],
        [5, 4093]
    ];

    // draw(ctx, X, Y, w, h, r): an integer box at device (X, Y)
    const SHAPES = [
        ['fillRoundRect', (c, X, Y, w, h, r) => c.fillRoundRect(X, Y, w, h, r)],
        ['fillRoundRect translucent', (c, X, Y, w, h, r) => {
            c.setFillStyle(0, 0, 0, 128);
            c.fillRoundRect(X, Y, w, h, r);
        }],
        ['fillRoundRect per-corner', (c, X, Y, w, h, r) => c.fillRoundRect(X, Y, w, h, [r, r, 0, r / 2])],
        ['fillStadium', (c, X, Y, w, h, r) => c.fillStadium(X, Y, w, 2 * r)],
        ['roundRect + fill', (c, X, Y, w, h, r) => {
            c.beginPath();
            c.roundRect(X, Y, w, h, r);
            c.fill();
        }],
        ['roundRect + clip', (c, X, Y, w, h, r) => {
            c.beginPath();
            c.roundRect(X, Y, w, h, r);
            c.clip();
            c.fillRect(X - 1, Y - 1, w + 2, h + 2);
        }],
        ['clip(SWPath2D roundRect)', (c, X, Y, w, h, r) => {
            const p = new SWCanvas.Core.SWPath2D();
            p.roundRect(X, Y, w, h, r);
            c.clip(p);
            c.fillRect(X - 1, Y - 1, w + 2, h + 2);
        }],
        // controls: the direct stroke and fused arms (integer-snapped)
        ['strokeRoundRect 1px', (c, X, Y, w, h, r) => {
            c.setStrokeStyle(0, 0, 0, 255);
            c.lineWidth = 1;
            c.strokeRoundRect(X + 0.5, Y + 0.5, w - 1, h - 1, r);
        }],
        ['fillStrokeRoundRect', (c, X, Y, w, h, r) => {
            c.setFillStyle(128, 128, 128, 255);
            c.setStrokeStyle(0, 0, 0, 255);
            c.lineWidth = 2;
            c.fillStrokeRoundRect(X + 1, Y + 1, w - 2, h - 2, r);
        }]
    ];

    // The crop [X-M, X+w+M) x [Y-M, Y+h+M) of a canvas just big enough to hold it;
    // pixels left of / above the canvas read as empty.
    function crop(draw, X, Y, w, h, r) {
        const cw = X + w + M + 1;
        const ch = Y + h + M + 1;
        const surface = SWCanvas.Core.Surface(cw, ch);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(0, 0, 0, 255);
        draw(ctx, X, Y, w, h, r);
        const rw = w + 2 * M;
        const rh = h + 2 * M;
        const out = new Uint8Array(rw * rh * 4);
        for (let yy = 0; yy < rh; yy++) {
            const sy = Y - M + yy;
            if (sy < 0) continue;
            for (let xx = 0; xx < rw; xx++) {
                const sx = X - M + xx;
                if (sx < 0) continue;
                const so = sy * surface.stride + sx * 4;
                const d = (yy * rw + xx) * 4;
                out[d] = surface.data[so];
                out[d + 1] = surface.data[so + 1];
                out[d + 2] = surface.data[so + 2];
                out[d + 3] = surface.data[so + 3];
            }
        }
        return { out, rw };
    }

    const radii = [];
    for (let r = 1; r <= 64; r++) radii.push(r);
    for (let r = 0.5; r <= 40.5; r += 1) radii.push(r);

    let cases = 0;
    for (const [name, draw] of SHAPES) {
        for (const r of radii) {
            const w = Math.ceil(2 * r) + 4;
            const h = Math.ceil(2 * r) + 4;
            const base = crop(draw, BASE[0], BASE[1], w, h, r);
            for (const [X, Y] of POSITIONS) {
                const got = crop(draw, X, Y, w, h, r);
                for (let i = 0; i < base.out.length; i++) {
                    if (base.out[i] !== got.out[i]) {
                        const p = i >> 2;
                        throw new Error(
                            `${name} r=${r} ${w}x${h}: at (${X},${Y}) box pixel ` +
                                `(${(p % base.rw) - M},${Math.floor(p / base.rw) - M}) differs from the same box at ` +
                                `(${BASE[0]},${BASE[1]}) - the corner flattening depends on position`
                        );
                    }
                }
                cases++;
            }
        }
    }
    log(`  ${cases} placements: every rounded-rect fill/clip path paints the same pixels at every integer position`);
});

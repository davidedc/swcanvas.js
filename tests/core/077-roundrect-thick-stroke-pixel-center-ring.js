// Test: thick axis-aligned rounded-rect strokes cover exactly the pixel-center ring
// This file will be concatenated into the main test suite
//
// SWCanvas samples coverage at pixel CENTERS (the polygon filler, CircleOps,
// the row walk of the rounded-rect arms). For a thick axis-aligned rounded-rect
// stroke whose frame sits on the pixel grid - the case the direct arm's integer
// frame is exact for - the painted ring must therefore be exactly the pixels
// whose centers lie within lineWidth / 2 of the path outline, on all four sides
// alike. Pinned here, against that analytic ring (pixels whose center lies ON the
// ring's boundary are not asserted):
//   1. EXACT RING: strokeRoundRect and fillStrokeRoundRect (its stroke colour),
//      identity at line widths 2..6 (odd widths on half-pixel paths), and the
//      1-logical-px crisp spelling under scale(2) (strokeRoundRect(0.5, 0.5,
//      w - 1, h - 1, r): a 2-device-px ring), radii 1..12, uniform and per-corner;
//   2. TRANSPOSE SYMMETRY: on a square box the ring is its own mirror image across
//      the diagonal - a vertical side's run up to its arc is the same shape as
//      the horizontal side's.

test('RoundRect thick strokes - exact pixel-center ring, transpose-symmetric', () => {
    // 1 covered, 0 not, 0.5 on the boundary (not asserted). Path: rounded rect
    // (x0,y0)-(x1,y1) with corner radii [tl, tr, br, bl]; the ring is every point
    // within hs of its outline.
    function ideal(px, py, x0, y0, x1, y1, radii, hs) {
        const cx = px + 0.5;
        const cy = py + 0.5;
        // the corner whose quadrant holds the point, if any
        let r = 0;
        let kx = 0;
        let ky = 0;
        if (cx < x0 + radii[0] && cy < y0 + radii[0]) {
            r = radii[0];
            kx = x0 + r;
            ky = y0 + r;
        } else if (cx > x1 - radii[1] && cy < y0 + radii[1]) {
            r = radii[1];
            kx = x1 - r;
            ky = y0 + r;
        } else if (cx > x1 - radii[2] && cy > y1 - radii[2]) {
            r = radii[2];
            kx = x1 - r;
            ky = y1 - r;
        } else if (cx < x0 + radii[3] && cy > y1 - radii[3]) {
            r = radii[3];
            kx = x0 + r;
            ky = y1 - r;
        }
        let dist;
        if (r > 0) {
            dist = Math.abs(Math.sqrt((cx - kx) * (cx - kx) + (cy - ky) * (cy - ky)) - r);
        } else {
            // outside every rounded quadrant: distance to the box outline - past a
            // radius-0 corner the outer edge is SQUARE (a mitered right angle, as
            // strokeRect's), hence the larger of the two side distances
            const ox = Math.max(x0 - cx, 0, cx - x1);
            const oy = Math.max(y0 - cy, 0, cy - y1);
            dist = ox > 0 || oy > 0 ? Math.max(ox, oy) : Math.min(cx - x0, x1 - cx, cy - y0, y1 - cy);
        }
        if (Math.abs(dist - hs) < 1e-9) return 0.5;
        return dist < hs ? 1 : 0;
    }

    const W = 80;
    const H = 72;
    function stroked(opts) {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        if (opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
        ctx.setStrokeStyle(255, 0, 0, 255);
        ctx.setFillStyle(0, 0, 255, 255);
        ctx.lineWidth = opts.lw;
        if (opts.fused) ctx.fillStrokeRoundRect(opts.x, opts.y, opts.w, opts.h, opts.r);
        else ctx.strokeRoundRect(opts.x, opts.y, opts.w, opts.h, opts.r);
        return surface;
    }
    const isStroke = (s, x, y) => {
        const o = y * s.stride + x * 4;
        return s.data[o] === 255 && s.data[o + 1] === 0 && s.data[o + 2] === 0;
    };

    let renders = 0;
    let asserted = 0;
    for (const fused of [false, true]) {
        for (const radiiSpec of [1, 2, 3, 5, 7, 8, 10, 12, [10, 0, 6, 3]]) {
            // identity: a box of integer device edges, path inset by hs (odd widths on half pixels)
            const cases = [];
            for (let lw = 2; lw <= 6; lw++) {
                const hs = lw / 2;
                cases.push({ scale: 1, lw, x: 6 + hs, y: 5 + hs, w: 60 - lw, h: 54 - lw, r: radiiSpec, dev: 1 });
            }
            // scale(2), the crisp 1-logical-px spelling: box 30x27 logical at (3, 2)
            const half = Array.isArray(radiiSpec) ? radiiSpec.map((v) => Math.ceil(v / 2)) : Math.ceil(radiiSpec / 2);
            cases.push({ scale: 2, lw: 1, x: 3.5, y: 2.5, w: 29, h: 26, r: half, dev: 2 });
            for (const c of cases) {
                const s = stroked(Object.assign({ fused }, c));
                const k = c.dev;
                const hs = (c.lw * k) / 2;
                const x0 = c.x * k;
                const y0 = c.y * k;
                const x1 = (c.x + c.w) * k;
                const y1 = (c.y + c.h) * k;
                const rr = Array.isArray(c.r) ? c.r.map((v) => v * k) : [c.r * k, c.r * k, c.r * k, c.r * k];
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const want = ideal(x, y, x0, y0, x1, y1, rr, hs);
                        if (want === 0.5) continue;
                        asserted++;
                        if ((want === 1) !== isStroke(s, x, y)) {
                            throw new Error(
                                `${fused ? 'fillStrokeRoundRect' : 'strokeRoundRect'} scale=${c.scale} lw=${c.lw} ` +
                                    `radii=${JSON.stringify(c.r)}: pixel (${x},${y}) is ${want ? 'in' : 'outside'} the ` +
                                    `pixel-center ring but ${want ? 'unpainted' : 'painted'}`
                            );
                        }
                    }
                }
                renders++;
            }
        }
    }

    // 2. transpose symmetry on a square box, every radius 1..16 at lw 2 and 3, and at scale(2)
    let squares = 0;
    for (let r = 1; r <= 16; r++) {
        for (const c of [
            { scale: 1, lw: 2, x: 5, y: 5, w: 60, h: 60, r },
            { scale: 1, lw: 3, x: 5.5, y: 5.5, w: 59, h: 59, r },
            { scale: 2, lw: 1, x: 2.5, y: 2.5, w: 31, h: 31, r: Math.ceil(r / 2) }
        ]) {
            const s = stroked(Object.assign({ fused: false }, c));
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < H; x++) {
                    if (isStroke(s, x, y) !== isStroke(s, y, x)) {
                        throw new Error(
                            `strokeRoundRect square scale=${c.scale} lw=${c.lw} r=${c.r}: (${x},${y}) and ` +
                                `(${y},${x}) differ - the vertical and horizontal sides are not mirror images`
                        );
                    }
                }
            }
            squares++;
        }
    }
    log(`  ${renders} rings exact (${asserted} pixels asserted), ${squares} square rings transpose-symmetric`);
});

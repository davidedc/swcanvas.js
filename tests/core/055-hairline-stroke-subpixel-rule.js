// Test: HAIRLINE (sub-pixel) strokes on the five direct stroke entries
// This file will be concatenated into the main test suite
//
// A stroke narrower than one device pixel cannot be drawn narrower than one
// pixel, so the engine draws it AT one pixel and takes the missing width out of
// the OPACITY. That is the generic pipeline's rule (Rasterizer._strokeInternal:
// lineWidth < 1 renders at width 1.0 with subPixelOpacity = lineWidth), and
// every direct stroke entry now restates it at the dispatch layer, keyed on the
// DEVICE width. Before, each entry did something different below 1px:
// strokeRect fell through to the generic path (correct, slow); strokeRoundRect
// and outerStrokeArc reached their THICK renderers, which draw a sub-pixel
// width at FULL opacity (wrong weight) and with a broken outline (measured: 8
// of 19 pixels for the arc); strokeCircle fell to a device-space re-stroke that
// LOST most of a scaled ring (35 of 70 at scale 1.4 - the vanish that blocked
// Fizzygum's rotate-handle conversion); strokeLine had no faint rule at all.
//
// Contract pinned here, for every entry at identity / scale(1.4) / scale(0.7):
//   1. RULE AS IDENTITY: the hairline render byte-equals the explicit
//      "1 device px at globalAlpha x deviceWidth" call. The rule as an
//      equation, not an eyeball.
//   2. GEOMETRY IS THE 1px GEOMETRY: the hairline paints exactly the pixel SET
//      the exact-1px stroke paints - at every sub-pixel width - so only the
//      opacity varies. This is the assertion the old circle fallback fails
//      (it painted 35 of the ring's 70 pixels under scale 1.4), and it is why
//      hairlines are positionally continuous across the 1px threshold.
//      (Continuity with the GENERIC path's position was never available: direct
//      and generic already rasterize 1px strokes differently - 188 of 96 pixels
//      for a rect at identity - which is the shipped behaviour of every
//      lineWidth >= 1 caller.)
//   3. OUTLINE CONNECTED: no painted pixel is left with fewer than 2 painted
//      8-neighbours (bar the two endpoints of the open shapes). NOTE the
//      geometry below is sized to stay INSIDE the surface at scale 1.4 on
//      purpose: an edge-clipped outline has legitimately loose ends and would
//      make this assertion measure the clip instead of the rule.
//   4. FAINTNESS MONOTONICITY: a narrower hairline is strictly lighter.
//   5. lw >= 1 DISPATCH UNCHANGED: exact-1px and thick strokes stay direct and
//      fully opaque - the new branch must not reach across the tolerance - and
//      a hairline must ALSO be direct, never a fall-back to the generic
//      pipeline, which is the whole point of the branch.
//   6. TWIN INVARIANT: every family's stroke1px_Opaq and stroke1px_Alpha
//      rasterize the same pixel set - a stroke's GEOMETRY must not depend on
//      its OPACITY. ArcOps historically violated this (its Opaq walk used a
//      different Bresenham update spelling than CircleOps'/its own Alpha twin,
//      so a partial arc changed shape when its opacity did - 16 vs 19 px at
//      r=11); the walk is now canonical and this assertion keeps all five
//      families honest.

test('Hairline strokes - the sub-pixel rule on all five direct stroke entries', () => {
    const W = 64;
    const H = 64;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    // Every entry strokes BLACK on white, so the red channel IS the opacity
    // readout: 255 = untouched, 0 = full opacity, in between = the faint rule.
    function painted(surface) {
        const on = [];
        let count = 0;
        let darkest = 255;
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                const v = surface.data[y * surface.stride + x * 4];
                row.push(v !== 255);
                if (v !== 255) {
                    count++;
                    if (v < darkest) darkest = v;
                }
            }
            on.push(row);
        }
        return { on, count, darkest };
    }

    function assertBytesEqual(label, sa, sb) {
        for (let i = 0; i < sa.data.length; i++) {
            if (sa.data[i] !== sb.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
            }
        }
    }

    // How many pixels one render paints that the other does not (ignoring level).
    function positionDiff(a, b) {
        let d = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a.on[y][x] !== b.on[y][x]) d++;
        return d;
    }

    // Painted pixels with fewer than 2 painted 8-neighbours: none for a closed
    // outline, exactly 2 (the endpoints) for an open arc or a line.
    function looseEnds(p) {
        let loose = 0;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (!p.on[y][x]) continue;
                let n = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (!dx && !dy) continue;
                        const yy = y + dy;
                        const xx = x + dx;
                        if (yy >= 0 && yy < H && xx >= 0 && xx < W && p.on[yy][xx]) n++;
                    }
                }
                if (n < 2) loose++;
            }
        }
        return loose;
    }

    // Geometry chosen to stay inside the 64x64 surface at scale 1.4 (see 3).
    const ENTRIES = [
        { name: 'strokeRect', looseAllowed: 0, draw: (c) => c.strokeRect(10, 10, 24, 24) },
        { name: 'strokeRoundRect', looseAllowed: 0, draw: (c) => c.strokeRoundRect(10, 10, 24, 24, 6) },
        { name: 'strokeCircle', looseAllowed: 0, draw: (c) => c.strokeCircle(22, 22, 11) },
        { name: 'outerStrokeArc', looseAllowed: 2, draw: (c) => c.outerStrokeArc(22, 22, 11, 0.3, 2.2) },
        { name: 'strokeLine', looseAllowed: 2, draw: (c) => c.strokeLine(10, 13, 34, 29) }
    ];

    const TRANSFORMS = [
        { label: 'identity', scale: 1, apply: () => {} },
        { label: 'scale(1.4)', scale: 1.4, apply: (c) => c.scale(1.4, 1.4) },
        { label: 'scale(0.7)', scale: 0.7, apply: (c) => c.scale(0.7, 0.7) }
    ];

    const SUB_PIXEL_WIDTHS = [0.35, 0.5, 0.7, 0.995];

    // Render an entry at a given LOGICAL lineWidth and globalAlpha.
    function render(entry, transform, logicalLineWidth, globalAlpha) {
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        const { surface, ctx } = newCtx();
        ctx.save();
        transform.apply(ctx);
        ctx.setStrokeStyle(0, 0, 0, 255);
        ctx.lineWidth = logicalLineWidth;
        ctx.globalAlpha = globalAlpha;
        entry.draw(ctx);
        ctx.restore();
        return { surface, pathBased: SWCanvas.Core.Context2D.wasPathBasedUsed() };
    }

    // 1. RULE AS IDENTITY, and hairlines are DIRECT (part of 5).
    for (const entry of ENTRIES) {
        for (const t of TRANSFORMS) {
            for (const deviceWidth of SUB_PIXEL_WIDTHS) {
                const hairline = render(entry, t, deviceWidth / t.scale, 1.0);
                const explicit = render(entry, t, 1 / t.scale, deviceWidth);
                assertBytesEqual(
                    `${entry.name} @${t.label} hairline(device ${deviceWidth}) vs 1px at alpha ${deviceWidth}`,
                    hairline.surface,
                    explicit.surface
                );
                if (hairline.pathBased) {
                    throw new Error(
                        `${entry.name} @${t.label} hairline(device ${deviceWidth}) fell back to the path pipeline`
                    );
                }
            }
        }
        log(`  ${entry.name}: hairline === 1px x proportional alpha, direct, 4 widths x 3 transforms`);
    }

    // 2. GEOMETRY IS THE 1px GEOMETRY (the vanish-catcher). The 0.995-alpha
    //    oracle and the opaque 1px stroke paint the same set by invariant 6.
    for (const entry of ENTRIES) {
        for (const t of TRANSFORMS) {
            const onePx = painted(render(entry, t, 1 / t.scale, 0.995).surface);
            if (onePx.count === 0) throw new Error(`${entry.name} @${t.label}: the 1px stroke painted NOTHING`);
            for (const deviceWidth of SUB_PIXEL_WIDTHS) {
                const hair = painted(render(entry, t, deviceWidth / t.scale, 1.0).surface);
                const d = positionDiff(hair, onePx);
                if (d !== 0) {
                    throw new Error(
                        `${entry.name} @${t.label}: hairline at device width ${deviceWidth} paints ${hair.count}px, ` +
                            `differing from the 1px stroke's ${onePx.count}px in ${d} pixels — a hairline must be ` +
                            `the 1px geometry at reduced opacity, nothing else`
                    );
                }
            }
        }
        log(`  ${entry.name}: every sub-pixel width paints exactly the 1px stroke's pixels`);
    }

    // 3. OUTLINE CONNECTED.
    for (const entry of ENTRIES) {
        for (const t of TRANSFORMS) {
            const p = painted(render(entry, t, 0.5 / t.scale, 1.0).surface);
            const loose = looseEnds(p);
            if (loose > entry.looseAllowed) {
                throw new Error(
                    `${entry.name} @${t.label}: hairline outline is broken — ${loose} pixels with < 2 ` +
                        `neighbours (allowed ${entry.looseAllowed}), ${p.count}px painted`
                );
            }
        }
        log(`  ${entry.name}: hairline outline connected at identity, scale 1.4 and scale 0.7`);
    }

    // 4. FAINTNESS MONOTONICITY.
    for (const entry of ENTRIES) {
        const levels = [0.25, 0.5, 0.75].map((w) => painted(render(entry, TRANSFORMS[0], w, 1.0).surface).darkest);
        if (!(levels[0] > levels[1] && levels[1] > levels[2])) {
            throw new Error(
                `${entry.name}: faintness is not monotone in width — darkest pixel at w=0.25/0.5/0.75 was ` +
                    `${levels.join('/')} (must be strictly decreasing)`
            );
        }
        log(`  ${entry.name}: darkest pixel at w=0.25/0.5/0.75 = ${levels.join('/')} (monotone)`);
    }

    // 5. lw >= 1 DISPATCH UNCHANGED. 1.0005 is just past STROKE_1PX_TOLERANCE:
    //    it must stay opaque, i.e. the hairline branch must not reach across.
    for (const entry of ENTRIES) {
        for (const deviceWidth of [1, 1.0005, 3]) {
            const r = render(entry, TRANSFORMS[0], deviceWidth, 1.0);
            if (r.pathBased) {
                throw new Error(`${entry.name}: lineWidth ${deviceWidth} unexpectedly fell to the path pipeline`);
            }
            const p = painted(r.surface);
            if (p.darkest !== 0) {
                throw new Error(
                    `${entry.name}: opaque stroke at lineWidth ${deviceWidth} rendered faint (darkest pixel ` +
                        `${p.darkest}, expected 0) — the hairline branch has eaten a lineWidth >= 1 case`
                );
            }
        }
        log(`  ${entry.name}: lineWidth 1 / 1.0005 / 3 still opaque and direct`);
    }

    // 6. TWIN INVARIANT: opaque and alpha 1px renderers paint the same pixel
    //    set in every family, at identity and under scale — a stroke's
    //    geometry must not depend on its opacity. (ArcOps historically failed
    //    this; its Bresenham walk is now the family's canonical spelling.)
    for (const entry of ENTRIES) {
        for (const t of TRANSFORMS) {
            const opaque = painted(render(entry, t, 1 / t.scale, 1.0).surface);
            const alpha = painted(render(entry, t, 1 / t.scale, 0.995).surface);
            const d = positionDiff(opaque, alpha);
            if (d !== 0) {
                throw new Error(
                    `${entry.name} @${t.label}: its opaque and alpha 1px renderers disagree in ${d} pixels — ` +
                        `the stroke's geometry depends on its opacity, and a hairline is therefore NOT ` +
                        `positionally continuous with the opaque 1px stroke it sits next to`
                );
            }
        }
        log(`  ${entry.name}: opaque and alpha 1px twins paint the same pixel set at all 3 transforms`);
    }

    // 7. ROTATED translucent stroke is SINGLE-BLEND: the rotated rect 1px DDA
    //    dedups pixels shared by consecutive edges (the overdraw-prevention
    //    doctrine, DIRECT-RENDERING-SUMMARY.MD 6.5), so a translucent rotated
    //    stroke — and every rotated hairline, translucent by construction —
    //    shows exactly ONE blended level: no darker corner dots.
    {
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        const { surface, ctx } = newCtx();
        ctx.save();
        ctx.translate(28, 28);
        ctx.rotate(0.3);
        ctx.setStrokeStyle(0, 0, 0, 255);
        ctx.lineWidth = 0.5; // hairline → dispatched at alpha 0.5
        ctx.strokeRect(-14, -14, 28, 28);
        ctx.restore();
        if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
            throw new Error('rotated hairline strokeRect fell back to the path pipeline');
        }
        const seen = new Set();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const v = surface.data[y * surface.stride + x * 4];
                if (v !== 255) seen.add(v);
            }
        }
        if (seen.size !== 1) {
            throw new Error(
                `rotated hairline strokeRect painted ${seen.size} distinct levels (${[...seen].sort((a, b) => a - b)}) — ` +
                    `expected ONE: a corner pixel is being blended twice`
            );
        }
        log(`  rotated hairline strokeRect: single blended level (${[...seen]}), no corner double-blend`);
    }

    // Showcase: the geometry that motivated this — a hairline ring inside a
    // scaled island, which used to lose most of itself.
    const showcase = newCtx();
    showcase.ctx.save();
    showcase.ctx.scale(1.4, 1.4);
    showcase.ctx.setStrokeStyle(0, 0, 0, 255);
    showcase.ctx.lineWidth = 0.5 / 1.4;
    showcase.ctx.strokeCircle(22, 22, 11);
    showcase.ctx.restore();
    savePNG(
        showcase.surface,
        'hairline-stroke-ring-scaled.basic.png',
        'strokeCircle at a 0.5 device-px width under scale(1.4) - closed faint ring',
        SWCanvas
    );
});

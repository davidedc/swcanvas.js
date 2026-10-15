// Test: per-corner roundRects clipped (tier-0 === bitmask, no leaks) and clipping (clip region === fill)
// This file will be concatenated into the main test suite
//
// Both directions of clipping for per-corner radii (DIRECT-RENDERING-SUMMARY.MD
// §5 and §5.1):
//   1. BEING CLIPPED: the per-corner direct arms honour the tier-0 rect clip
//      exactly like the bitmask clip of the same region (byte-identical), and
//      never paint outside it - for 1px/thick strokes, opaque/alpha, the fused
//      arm, at identity, uniform scale and a quarter turn (the corner-permuting
//      branch), with the window-title-bar spelling [r, r, 0, 0] among the radii.
//      Same contract as tests/core/049 for uniform radii.
//   2. CLIPPING AT a per-corner roundRect: roundRect() + clip() exposes exactly
//      the pixels roundRect() + fill() covers (one geometry, one generic
//      rasterization), on both the Context2D path method and an external
//      SWPath2D, including under a non-uniform scale (elliptical corners).

test('roundRect per-corner radii - clipped (tier-0 === bitmask) and clipping (clip === fill)', () => {
    const W = 90;
    const H = 64;
    const CLIP = { x: 14, y: 10, w: 34, h: 22 };

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function render(clipMode, drawFn) {
        const { surface, ctx } = newCtx();
        ctx.save();
        ctx.beginPath();
        ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
        if (clipMode === 'mask') {
            // A second identical rect: same exposed pixels, but no longer one
            // axis-aligned rect path, so the clip goes through the bitmask.
            ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
        }
        ctx.clip();
        drawFn(ctx);
        ctx.restore();
        return surface;
    }

    function isPainted(surface, x, y) {
        const o = y * surface.stride + x * 4;
        return !(surface.data[o] === 255 && surface.data[o + 1] === 255 && surface.data[o + 2] === 255);
    }

    // 1. Being clipped.
    // Two DEVICE boxes, one ring crossing each pair of clip bounds: A's left and
    // bottom edges run inside the clip (it crosses the top and right bounds), B's
    // right and top edges do (it crosses the left and bottom bounds). Every CTM maps
    // its user box onto the same device box.
    const DEVICE_BOXES = [
        ['A', [20.5, 4.5, 50, 22]],
        ['B', [4.5, 14.5, 30, 30]]
    ];
    const CTMS = [
        ['identity', () => {}, ([x, y, w, h]) => [x, y, w, h]],
        ['scale 2', (ctx) => ctx.scale(2, 2), ([x, y, w, h]) => [x / 2, y / 2, w / 2, h / 2]],
        [
            'quarter turn',
            (ctx) => ctx.setTransform(0, 1, -1, 0, 80, 2),
            // device (x', y') = (80 - y, x + 2): the user box is the device box turned back
            ([x, y, w, h]) => [y - 2, 80 - (x + w), h, w]
        ]
    ];
    const RADII = [
        [8, 8, 0, 0],
        [0, 5, 9, 2],
        [12, 0]
    ];
    const STYLES = [
        [
            'stroke 1px opaque',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
            },
            'strokeRoundRect'
        ],
        [
            'stroke 1px semi',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 128);
                ctx.lineWidth = 1;
            },
            'strokeRoundRect'
        ],
        [
            'stroke 3px semi',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 128);
                ctx.lineWidth = 3;
            },
            'strokeRoundRect'
        ],
        [
            'fused opaque 1px',
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
            },
            'fillStrokeRoundRect'
        ],
        [
            'fused semi 3px',
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 128);
                ctx.lineWidth = 3;
            },
            'fillStrokeRoundRect'
        ]
    ];
    let cases = 0;
    for (const [boxLabel, deviceBox] of DEVICE_BOXES) {
      for (const [ctmLabel, applyCtm, toUser] of CTMS) {
        const [x, y, w, h] = toUser(deviceBox);
        for (const radii of RADII) {
            for (const [styleLabel, setup, entry] of STYLES) {
                const draw = (ctx) => {
                    applyCtm(ctx);
                    setup(ctx);
                    ctx[entry](x, y, w, h, radii);
                };
                const label = `${styleLabel} ${JSON.stringify(radii)} box ${boxLabel} @${ctmLabel}`;
                const tier0 = render('tier0', draw);
                const mask = render('mask', draw);
                let anyInside = false;
                for (let py = 0; py < H; py++) {
                    for (let px = 0; px < W; px++) {
                        const o = py * tier0.stride + px * 4;
                        for (let k = 0; k < 4; k++) {
                            if (tier0.data[o + k] !== mask.data[o + k]) {
                                throw new Error(`${label}: tier-0 and bitmask clips differ at (${px},${py})`);
                            }
                        }
                        if (!isPainted(tier0, px, py)) continue;
                        const inside =
                            px >= CLIP.x && px < CLIP.x + CLIP.w && py >= CLIP.y && py < CLIP.y + CLIP.h;
                        if (!inside) throw new Error(`${label}: painted outside the clip rect at (${px},${py})`);
                        anyInside = true;
                    }
                }
                if (!anyInside) throw new Error(`${label}: nothing painted inside the clip - fixture misses the clip`);
                cases++;
            }
        }
      }
    }
    log(`  being clipped: ${cases} per-corner cases - tier-0 === bitmask, no clip leak`);

    // 2. Clipping AT a per-corner roundRect: clip coverage === fill coverage.
    const SHAPES = [
        ['[10, 10, 0, 0]', [10, 6, 60, 40], [10, 10, 0, 0], () => {}],
        ['[0, 14, 3, 22]', [8.5, 5.5, 64, 50], [0, 14, 3, 22], () => {}],
        ['[18, 4] under scale(1.5, 0.75)', [6, 8, 44, 56], [18, 4], (ctx) => ctx.scale(1.5, 0.75)],
        ['[9, 0, 9] rotated', [-25, -18, 50, 36], [9, 0, 9], (ctx) => {
            ctx.translate(45, 32);
            ctx.rotate(0.4);
        }]
    ];
    for (const [label, [x, y, w, h], radii, applyCtm] of SHAPES) {
        // Like against like: the current path bakes its arcs at build time, an
        // external Path2D flattens them at draw time.
        const filledCurrentPath = (() => {
            const { surface, ctx } = newCtx();
            applyCtm(ctx);
            ctx.setFillStyle(0, 0, 0, 255);
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radii);
            ctx.fill();
            return surface;
        })();
        const filledPath2D = (() => {
            const { surface, ctx } = newCtx();
            applyCtm(ctx);
            ctx.setFillStyle(0, 0, 0, 255);
            const p = new SWCanvas.Core.SWPath2D();
            p.roundRect(x, y, w, h, radii);
            ctx.fill(p);
            return surface;
        })();
        const viaCurrentPath = (() => {
            const { surface, ctx } = newCtx();
            applyCtm(ctx);
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radii);
            ctx.clip();
            ctx.resetTransform();
            ctx.setFillStyle(0, 0, 0, 255);
            ctx.fillRect(0, 0, W, H);
            return surface;
        })();
        const viaPath2D = (() => {
            const { surface, ctx } = newCtx();
            applyCtm(ctx);
            const p = new SWCanvas.Core.SWPath2D();
            p.roundRect(x, y, w, h, radii);
            ctx.clip(p);
            ctx.resetTransform();
            ctx.setFillStyle(0, 0, 0, 255);
            ctx.fillRect(0, 0, W, H);
            return surface;
        })();
        let n = 0;
        for (let py = 0; py < H; py++) {
            for (let px = 0; px < W; px++) {
                const f = isPainted(filledCurrentPath, px, py);
                if (f !== isPainted(viaCurrentPath, px, py)) {
                    throw new Error(`clip AT ${label} (ctx.roundRect): clip and fill disagree at (${px},${py})`);
                }
                if (isPainted(filledPath2D, px, py) !== isPainted(viaPath2D, px, py)) {
                    throw new Error(`clip AT ${label} (SWPath2D): clip and fill disagree at (${px},${py})`);
                }
                if (f) n++;
            }
        }
        if (n === 0) throw new Error(`clip AT ${label}: empty fixture`);
    }
    log('  clipping AT per-corner roundRects: clip region === fill coverage (path method and Path2D)');
});

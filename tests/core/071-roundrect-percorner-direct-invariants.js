// Test: per-corner roundRect radii on the direct arms - locality, square corners, junctions, containment, quarter turns, dispatch
// This file will be concatenated into the main test suite
//
// The axis-aligned direct family (RoundedRectOpsAA: stroke1px_AA_Opaq/Alpha,
// strokeThick_AA_Opaq/Alpha, fillStroke_AA_Any) renders per-corner radii
// (DIRECT-RENDERING-SUMMARY.MD §9 entry 17). Its contract, pinned here:
//   1. LOCALITY: a corner of radius r is pixel-identical to the same corner of
//      the uniform-r rounded rect - per-corner radii add no new corner shapes,
//      they only choose among the existing ones (the corner quadrants are
//      compared byte for byte, every stroke/fused style);
//   2. a radius-0 corner is SQUARE: the frame's corner pixel is painted, while a
//      rounded corner's is not;
//   3. 1px semi-transparent JUNCTIONS stay exact with any mix of rounded and
//      square corners: one blend per pixel (a single stroke colour) and a closed
//      ring (every pixel has >= 2 of 8 neighbours) - square corners have no arc
//      to own their pixel, so edge ownership there is explicit;
//   4. CONTAINMENT: one corner may hold a whole side ([w, 0, 0, 0] is legal);
//      nothing is ever painted outside the bounding box the same entry paints
//      for radius 1 (its corners reach the frame) - the 1px arcs are clamped to
//      the pixel frame for exactly this;
//   5. QUARTER TURNS: under a 90/180/270-degree CTM the axis-aligned arm draws a
//      device-space box, so the radii must turn with it; the generic path (which
//      just transforms user-space geometry) is the oracle for which device
//      corner ends up rounded;
//   6. DISPATCH: per-corner radii stay direct under identity / translate /
//      uniform scale / quarter turns, and go generic under a non-axis-aligned
//      rotation (the rotated family is uniform-radius only), where a uniform
//      radii LIST still goes direct.

test('roundRect per-corner radii - direct-arm invariants', () => {
    const W = 96;
    const H = 80;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    function render(draw) {
        const { surface, ctx } = newCtx();
        draw(ctx);
        return surface;
    }

    function isPainted(surface, x, y) {
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        const o = y * surface.stride + x * 4;
        return !(surface.data[o] === 255 && surface.data[o + 1] === 255 && surface.data[o + 2] === 255);
    }

    function paintedBBox(surface) {
        let minX = W,
            minY = H,
            maxX = -1,
            maxY = -1;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (!isPainted(surface, x, y)) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
        return { minX, minY, maxX, maxY };
    }

    // Each style: [label, paint setup, draw(ctx, x, y, w, h, radii)]
    const STYLES = [
        [
            'stroke 1px opaque',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
            },
            (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
        ],
        [
            'stroke 1px alpha',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 128);
                ctx.lineWidth = 1;
            },
            (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
        ],
        [
            'stroke hairline 0.5',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 0.5;
            },
            (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
        ],
        [
            'stroke 3px opaque',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 3;
            },
            (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
        ],
        [
            'stroke 4px alpha',
            (ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 128);
                ctx.lineWidth = 4;
            },
            (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
        ],
        [
            'fused opaque, 1px stroke',
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
            },
            (ctx, x, y, w, h, r) => ctx.fillStrokeRoundRect(x, y, w, h, r)
        ],
        [
            'fused semi fill, 3px semi stroke',
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 128);
                ctx.setStrokeStyle(255, 0, 0, 128);
                ctx.lineWidth = 3;
            },
            (ctx, x, y, w, h, r) => ctx.fillStrokeRoundRect(x, y, w, h, r)
        ],
        [
            'fused fill only',
            (ctx) => {
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 0);
                ctx.lineWidth = 2;
            },
            (ctx, x, y, w, h, r) => ctx.fillStrokeRoundRect(x, y, w, h, r)
        ]
    ];

    // 1. Locality - corner quadrants of a per-corner render equal the uniform renders'.
    const BOX = [8.5, 6.5, 78, 66];
    const [bx, by, bw, bh] = BOX;
    const midX = Math.floor(bx + bw / 2);
    const midY = Math.floor(by + bh / 2);
    const QUADRANTS = [
        (x, y) => x < midX && y < midY, // TL
        (x, y) => x >= midX && y < midY, // TR
        (x, y) => x >= midX && y >= midY, // BR
        (x, y) => x < midX && y >= midY // BL
    ];
    const CORNER = ['TL', 'TR', 'BR', 'BL'];
    const RADII_SETS = [
        [3, 7, 11, 5],
        [12, 2, 6, 9],
        [1, 13, 4, 8],
        [10, 10, 0, 0],
        [0, 6, 0, 14]
    ];
    for (const [label, setup, draw] of STYLES) {
        for (const radii of RADII_SETS) {
            const mixed = render((ctx) => {
                setup(ctx);
                draw(ctx, bx, by, bw, bh, radii);
            });
            for (let c = 0; c < 4; c++) {
                if (radii[c] === 0) continue; // square corners: section 2
                const uniform = render((ctx) => {
                    setup(ctx);
                    draw(ctx, bx, by, bw, bh, radii[c]);
                });
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        if (!QUADRANTS[c](x, y)) continue;
                        const o = y * mixed.stride + x * 4;
                        for (let k = 0; k < 4; k++) {
                            if (mixed.data[o + k] !== uniform.data[o + k]) {
                                throw new Error(
                                    `${label} radii ${JSON.stringify(radii)}: corner ${CORNER[c]} differs from ` +
                                        `the uniform r=${radii[c]} corner at (${x},${y})`
                                );
                            }
                        }
                    }
                }
            }
        }
        log(`  ${label}: every rounded corner === the uniform-radius corner`);
    }

    // 1b. Locality survives an inner arc too small to reach its own band row (radius 1
    //     under a 1.5-2px stroke: inner radius <= 0.25px). Uniform radii keep the
    //     historical rule - that row of the hole is dropped whole - but with mixed
    //     radii only the tiny corner may react: the other corners must still match
    //     their uniform renders.
    for (const lineWidth of [1.5, 1.75]) {
        const radii = [1, 9, 0, 6];
        const draw = (r) =>
            render((ctx) => {
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = lineWidth;
                ctx.strokeRoundRect(bx, by, bw, bh, r);
            });
        const mixed = draw(radii);
        for (const c of [1, 3]) {
            const uniform = draw(radii[c]);
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    if (!QUADRANTS[c](x, y)) continue;
                    const o = y * mixed.stride + x * 4;
                    if (mixed.data[o + 1] !== uniform.data[o + 1]) {
                        throw new Error(
                            `stroke ${lineWidth}px ${JSON.stringify(radii)}: the radius-1 corner leaked into ` +
                                `corner ${CORNER[c]} at (${x},${y})`
                        );
                    }
                }
            }
        }
    }
    log('  a sub-quarter-pixel inner corner arc stays local (1.5px / 1.75px strokes, radius 1)');

    // 2. Square corners: the frame's corner pixel is painted for radius 0, not for a
    //    rounded corner. The frame is the painted bounding box (radius-0 corners and
    //    the straight edges reach it).
    for (const [label, setup, draw] of STYLES) {
        const radii = [9, 9, 0, 0]; // the window title bar: rounded top, square bottom
        const s = render((ctx) => {
            setup(ctx);
            draw(ctx, bx, by, bw, bh, radii);
        });
        const b = paintedBBox(s);
        const corners = [
            [b.minX, b.minY],
            [b.maxX, b.minY],
            [b.maxX, b.maxY],
            [b.minX, b.maxY]
        ];
        for (let c = 0; c < 4; c++) {
            const square = radii[c] === 0;
            if (isPainted(s, corners[c][0], corners[c][1]) !== square) {
                throw new Error(`${label} [9,9,0,0]: corner ${CORNER[c]} should be ${square ? 'square' : 'rounded'}`);
            }
        }
    }
    log('  every style: [9,9,0,0] gives two rounded top corners and two square bottom ones');

    // 3. 1px semi-transparent junction exactness across mixes of rounded and square
    //    corners, at the integer and the pixel-centred (crisp) spellings.
    {
        const R = [0, 1, 2, 3, 5, 8];
        let combos = 0;
        for (const [x, y, w, h] of [
            [10, 9, 60, 50],
            [10.5, 9.5, 61, 47]
        ]) {
            for (const a of R) {
                for (const b of R) {
                    for (const c of R) {
                        for (const d of R) {
                            if (a + b + c + d === 0) continue; // radius 0: the RectOps fallback
                            const radii = [a, b, c, d];
                            const s = render((ctx) => {
                                ctx.setStrokeStyle(255, 0, 0, 128);
                                ctx.lineWidth = 1;
                                ctx.strokeRoundRect(x, y, w, h, radii);
                            });
                            const pixels = new Set();
                            const colors = new Set();
                            for (let py = 0; py < H; py++) {
                                for (let px = 0; px < W; px++) {
                                    if (!isPainted(s, px, py)) continue;
                                    const o = py * s.stride + px * 4;
                                    pixels.add(py * W + px);
                                    colors.add((s.data[o] << 16) | (s.data[o + 1] << 8) | s.data[o + 2]);
                                }
                            }
                            if (colors.size !== 1) {
                                throw new Error(
                                    `1px alpha ${JSON.stringify(radii)} at (${x},${y}): ${colors.size} stroke colours - ` +
                                        'a pixel was blended more than once'
                                );
                            }
                            for (const p of pixels) {
                                const px = p % W;
                                const py = Math.floor(p / W);
                                let n = 0;
                                for (let dy = -1; dy <= 1; dy++) {
                                    for (let dx = -1; dx <= 1; dx++) {
                                        if ((dx || dy) && pixels.has((py + dy) * W + px + dx)) n++;
                                    }
                                }
                                if (n < 2) {
                                    throw new Error(
                                        `1px alpha ${JSON.stringify(radii)} at (${x},${y}): ring broken at (${px},${py})`
                                    );
                                }
                            }
                            combos++;
                        }
                    }
                }
            }
        }
        log(`  1px alpha: ${combos} radius mixes - single blend, closed ring`);
    }

    // 4. Containment: a corner holding a whole side stays inside the radius-1 bounding box.
    {
        let cases = 0;
        for (const [label, setup, draw] of STYLES) {
            for (const [x, y, w, h] of [
                [10, 9, 40, 30],
                [10.5, 9.5, 40, 30],
                [10.25, 9.75, 39.6, 30.4]
            ]) {
                const ref = paintedBBox(
                    render((ctx) => {
                        setup(ctx);
                        draw(ctx, x, y, w, h, 1);
                    })
                );
                for (const radii of [
                    [w, 0, 0, 0],
                    [0, w, 0, 0],
                    [0, 0, w, 0],
                    [0, 0, 0, w],
                    [0, h, 0, 0],
                    [h, 0, h, 0],
                    [w, w, 0, 0]
                ]) {
                    const b = paintedBBox(
                        render((ctx) => {
                            setup(ctx);
                            draw(ctx, x, y, w, h, radii);
                        })
                    );
                    if (b.minX < ref.minX || b.minY < ref.minY || b.maxX > ref.maxX || b.maxY > ref.maxY) {
                        throw new Error(
                            `${label} radii ${JSON.stringify(radii)} at (${x},${y},${w},${h}): painted ` +
                                `[${b.minX},${b.minY}..${b.maxX},${b.maxY}] outside the radius-1 box ` +
                                `[${ref.minX},${ref.minY}..${ref.maxX},${ref.maxY}]`
                        );
                    }
                    cases++;
                }
            }
        }
        log(`  containment: ${cases} whole-side-radius cases inside the radius-1 bounding box`);
    }

    // 5. Quarter turns: which DEVICE corner is rounded must agree with the generic
    //    path, which simply transforms the user-space geometry. Exact quarter-turn
    //    matrices (no trig noise). [9, 0, 4, 0] tells all four orientations apart.
    {
        const QUARTER_TURNS = [
            ['0', [1, 0, 0, 1, 12, 10]],
            ['90', [0, 1, -1, 0, 70, 10]],
            ['180', [-1, 0, 0, -1, 80, 66]],
            ['270', [0, -1, 1, 0, 12, 76]]
        ];
        const radii = [9, 0, 4, 0];
        const UW = 50;
        const UH = 34;
        for (const [turn, m] of QUARTER_TURNS) {
            const roundedness = (surface) => {
                const b = paintedBBox(surface);
                return [
                    isPainted(surface, b.minX, b.minY),
                    isPainted(surface, b.maxX, b.minY),
                    isPainted(surface, b.maxX, b.maxY),
                    isPainted(surface, b.minX, b.maxY)
                ].map((painted) => (painted ? 'square' : 'rounded'));
            };
            // Direct: the fused entry with an invisible stroke is the fill-only direct arm.
            // (Reset AFTER the fixture background, which is a generic fill.)
            let leftDirectArm = false;
            const direct = render((ctx) => {
                ctx.setTransform(...m);
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 0);
                SWCanvas.Core.Context2D.resetPathBasedFlag();
                ctx.fillStrokeRoundRect(0, 0, UW, UH, radii);
                leftDirectArm = SWCanvas.Core.Context2D.wasPathBasedUsed();
            });
            if (leftDirectArm) {
                throw new Error(`quarter turn ${turn}: per-corner fillStrokeRoundRect left the direct arm`);
            }
            const generic = render((ctx) => {
                ctx.setTransform(...m);
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.fillRoundRect(0, 0, UW, UH, radii);
            });
            const d = roundedness(direct).join(',');
            const g = roundedness(generic).join(',');
            if (d !== g) {
                throw new Error(`quarter turn ${turn}: direct device corners [${d}] but the generic path gives [${g}]`);
            }
            // And the stroke arm, on the crisp (pixel-centred) spelling.
            const stroke = render((ctx) => {
                ctx.setTransform(...m);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
                ctx.strokeRoundRect(0.5, 0.5, UW, UH, radii);
            });
            if (roundedness(stroke).join(',') !== g) {
                throw new Error(`quarter turn ${turn}: stroke device corners [${roundedness(stroke)}] vs generic [${g}]`);
            }
        }
        log('  quarter turns 0/90/180/270: device corners rounded exactly where the generic path rounds them');
    }

    // 6. Dispatch.
    {
        function dispatchOf(applyCtm, draw) {
            const { ctx } = newCtx();
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 2;
            applyCtm(ctx);
            SWCanvas.Core.Context2D.resetPathBasedFlag();
            draw(ctx);
            return SWCanvas.Core.Context2D.wasPathBasedUsed() ? 'generic' : 'direct';
        }
        const DIRECT_CTMS = [
            ['identity', () => {}],
            ['translate', (ctx) => ctx.translate(3.5, 2)],
            ['scale 2', (ctx) => ctx.scale(2, 2)],
            ['quarter turn', (ctx) => ctx.setTransform(0, 1, -1, 0, 60, 5)],
            ['half turn + scale', (ctx) => ctx.setTransform(-1.5, 0, 0, -1.5, 80, 70)]
        ];
        const TILTED = (ctx) => {
            ctx.translate(48, 40);
            ctx.rotate(0.5);
        };
        const ENTRIES = [
            ['strokeRoundRect', (ctx, r) => ctx.strokeRoundRect(-20, -15, 40, 30, r)],
            ['fillStrokeRoundRect', (ctx, r) => ctx.fillStrokeRoundRect(-20, -15, 40, 30, r)]
        ];
        for (const [label, draw] of ENTRIES) {
            for (const [ctmLabel, applyCtm] of DIRECT_CTMS) {
                if (dispatchOf(applyCtm, (ctx) => draw(ctx, [6, 6, 0, 0])) !== 'direct') {
                    throw new Error(`${label} [6,6,0,0] @${ctmLabel}: expected the direct arm`);
                }
            }
            if (dispatchOf(TILTED, (ctx) => draw(ctx, [6, 6, 0, 0])) !== 'generic') {
                throw new Error(`${label} [6,6,0,0] tilted: per-corner radii must take the generic path`);
            }
            if (dispatchOf(TILTED, (ctx) => draw(ctx, [6, 6, 6, 6])) !== 'direct') {
                throw new Error(`${label} [6,6,6,6] tilted: a uniform radii list must stay on the rotated direct arm`);
            }
        }
        log('  dispatch: per-corner direct on identity/translate/scale/quarter turns; generic when tilted');
    }
});

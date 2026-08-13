// Test: the three FILL entries dispatch generic; their stroke/fused siblings stay direct
// This file will be concatenated into the main test suite
//
// INVERTED DECISION PIN (the mirror of the pins that used to assert these
// entries stayed DIRECT). SWCanvas once carried four parity fill fast paths:
// fillRect's axis-aligned (RectOpsAA) and tilted (RectOpsRot) arms,
// fillRoundRect's identity->AA->rot ladder, and fillStadium's StadiumOps arm.
// Disable-and-benchmark measured them at parity with the generic pipeline's
// tier-0-wired solid span arm - roundRect 1.00x on every case, tilted rect
// 1.00-1.01x, axis-aligned rect 1.02x mean with a 2-6% edge only on small/mid
// ALPHA fills, a cost the owner explicitly accepted - so all four were removed
// for ONE fill implementation (DIRECT-RENDERING-SUMMARY.MD §9 entries 15-16;
// plans/one-rect-fill-pipeline-and-fill-arm-removal.md).
//
// Two halves, and BOTH matter:
//   1. The three FILL entries dispatch generic under every CTM class and both
//      opacities. A failure here means a fill fast path came back.
//   2. Their STROKE and FUSED siblings still dispatch DIRECT. That is the
//      boundary of the decision: strokes avoid outline construction the generic
//      path must do, and the fused arms exist to prevent fill/stroke seams -
//      neither was measured at parity, and neither was removed. A failure here
//      means the removal over-reached.
//
// Re-adding any fill fast path needs fresh benchmark evidence of the same grade;
// then update this pin and the §9 record together.

test('fill entries dispatch generic; stroke/fused siblings stay direct', () => {
    const W = 100;
    const H = 60;

    function newCtx() {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        return { surface, ctx };
    }

    // Reset AFTER the fixture background - fillRect is generic now, so a reset
    // before it would read the FIXTURE's dispatch, not the probe's.
    function dispatchOf(applyCtm, draw) {
        const { ctx } = newCtx();
        ctx.save();
        applyCtm(ctx);
        SWCanvas.Core.Context2D.resetPathBasedFlag();
        draw(ctx);
        ctx.restore();
        return SWCanvas.Core.Context2D.wasPathBasedUsed() ? 'generic' : 'direct';
    }

    const CTMS = [
        ['identity', () => {}],
        ['integer translate', (ctx) => ctx.translate(10, 5)],
        [
            '90-degree rotation',
            (ctx) => {
                ctx.translate(50, 30);
                ctx.rotate(Math.PI / 2);
            }
        ],
        [
            'tilted uniform scale',
            (ctx) => {
                ctx.translate(50, 30);
                ctx.rotate(0.5);
                ctx.scale(1.5, 1.5);
            }
        ]
    ];

    // 1. The three FILL entries: generic everywhere, opaque and translucent.
    const FILLS = [
        ['fillRect', (ctx) => ctx.fillRect(-10, -8, 20, 16)],
        ['fillRoundRect', (ctx) => ctx.fillRoundRect(-10, -8, 20, 16, 4)],
        ['fillStadium', (ctx) => ctx.fillStadium(-10, -8, 20, 16)]
    ];
    for (const [name, draw] of FILLS) {
        for (const [label, applyCtm] of CTMS) {
            for (const alpha of [255, 128]) {
                const got = dispatchOf(applyCtm, (ctx) => {
                    ctx.setFillStyle(255, 0, 0, alpha);
                    draw(ctx);
                });
                if (got !== 'generic') {
                    throw new Error(
                        `${name} under ${label} (alpha ${alpha}) dispatched DIRECT - a fill fast ` +
                            `path is back without the §9 fill-arm-removal record being revisited`
                    );
                }
            }
        }
        log(`  ${name}: generic under every CTM class, both opacities`);
    }

    // 2. The boundary: stroke and fused siblings still dispatch DIRECT.
    //    (Axis-aligned + tilted-uniform only - the CTM classes those arms serve.)
    const DIRECT_SIBLINGS = [
        [
            'strokeRect',
            (ctx) => {
                ctx.setStrokeStyle(0, 0, 255, 255);
                ctx.lineWidth = 2;
                ctx.strokeRect(-10, -8, 20, 16);
            }
        ],
        [
            'fillStrokeRect',
            (ctx) => {
                ctx.setFillStyle(255, 0, 0, 255);
                ctx.setStrokeStyle(0, 0, 255, 255);
                ctx.lineWidth = 2;
                ctx.fillStrokeRect(-10, -8, 20, 16);
            }
        ],
        [
            'strokeRoundRect',
            (ctx) => {
                ctx.setStrokeStyle(0, 0, 255, 255);
                ctx.lineWidth = 2;
                ctx.strokeRoundRect(-10, -8, 20, 16, 4);
            }
        ],
        [
            'fillStrokeRoundRect',
            (ctx) => {
                ctx.setFillStyle(255, 0, 0, 255);
                ctx.setStrokeStyle(0, 0, 255, 255);
                ctx.lineWidth = 2;
                ctx.fillStrokeRoundRect(-10, -8, 20, 16, 4);
            }
        ]
    ];
    // strokeRect/fillStrokeRect take the AA arm at 90-degree rotation too; the
    // roundRect pair requires uniform scale, which all four CTMs here satisfy.
    for (const [name, draw] of DIRECT_SIBLINGS) {
        for (const [label, applyCtm] of CTMS) {
            const got = dispatchOf(applyCtm, draw);
            if (got !== 'direct') {
                throw new Error(
                    `${name} under ${label} dispatched GENERIC - the fill-arm removal over-reached ` +
                        `into the stroke/fused arms, which were never measured at parity`
                );
            }
        }
        log(`  ${name}: still direct under every CTM class`);
    }
});

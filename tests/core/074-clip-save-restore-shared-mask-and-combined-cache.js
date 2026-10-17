// Test: save()/restore() bring back EXACTLY the earlier clip - shared immutable masks, combined-mask cache
// This file will be concatenated into the main test suite
//
// save() shares the installed clip mask by reference (masks are never mutated
// once installed), and draws that take ONE mask read a combined mask ∧ rect that
// is built on demand and cached per (mask, rect) pair - the cache travels with
// save()/restore() and every clip() drops it. Contract pinned here:
//   1. after restore() the clip is exactly the one in force at the matching
//      save(): a full-surface draw after a nested save/clip/draw/restore program
//      is byte-identical to the same draw under only the outer clips - for draws
//      that take the rect and mask separately, draws that take the combined
//      mask, canvas-wide composites and shadows, at every nesting depth;
//   2. a combined mask built inside a nested state (or after save() but before
//      the nested clip) never survives the restore() - the stale-cache trap;
//   3. a nested non-rect clip never alters the mask the outer state shares;
//   4. all of the above is byte-identical to the pure mask model
//      (Context2D._disableTier0Clip = true).

const ClipRestore074 = (() => {
    const Ctx2D = SWCanvas.Core.Context2D;
    const W = 96;
    const H = 72;

    const OPAQUE_2X2 = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([10, 200, 30, 255, 10, 200, 30, 255, 10, 200, 30, 255, 10, 200, 30, 255])
    };

    function starPath(cx, cy, r) {
        const p = new SWCanvas.Core.SWPath2D();
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
            if (i === 0) p.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
            else p.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        p.closePath();
        return p;
    }

    // Clip steps. Each nesting level of a program is a list of these.
    const CLIPS = {
        rectA: ctx => {
            ctx.beginPath();
            ctx.rect(6, 5, 80, 60);
            ctx.clip();
        },
        rectB: ctx => {
            ctx.beginPath();
            ctx.rect(20.5, 14.25, 50, 40);
            ctx.clip();
        },
        rectC: ctx => {
            ctx.beginPath();
            ctx.rect(30, 0, 20, H);
            ctx.clip();
        },
        rectD: ctx => {
            ctx.beginPath();
            ctx.rect(75, 56, 15, 12); // disjoint from rectB
            ctx.clip();
        },
        outline: ctx => {
            ctx.beginPath();
            ctx.roundRect(4, 3, 84, 64, [12, 3, 16, 0]);
            ctx.clip();
        },
        circle: ctx => {
            ctx.beginPath();
            ctx.arc(48, 36, 26, 0, Math.PI * 2);
            ctx.clip();
        },
        starEvenodd: ctx => ctx.clip(starPath(46, 38, 34), 'evenodd')
    };

    // Draws made INSIDE a program: they warm the combined-mask cache of the state
    // they run in (fillStrokeRect, strokeLine and clearRect take one mask; a
    // 'copy' fill takes it too) and leave pixels the final draw must overwrite.
    function warmDraws(ctx, tint) {
        ctx.fillStyle = `rgb(${tint}, 60, 200)`;
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.lineWidth = 2;
        ctx.fillStrokeRect(10, 8, 60, 44);
        ctx.lineWidth = 3;
        ctx.strokeLine(2, 70, 94, 2);
        ctx.clearRect(40, 30, 12, 9);
        ctx.fillStyle = `rgba(${tint}, 200, 60, 0.5)`;
        ctx.fillRect(14, 20, 70, 30);
        ctx.globalCompositeOperation = 'copy';
        ctx.fillStyle = 'rgba(255, 128, 0, 0.6)';
        ctx.fillRect(50, 10, 20, 50);
        ctx.globalCompositeOperation = 'source-over';
    }

    // Final draws, each covering the whole surface and setting every pixel inside
    // the clip to a value that does not depend on what was there before.
    const FINAL_DRAWS = {
        'fillRect (rect + mask)': ctx => {
            ctx.fillStyle = 'rgb(200, 20, 90)';
            ctx.fillRect(-4, -4, W + 8, H + 8);
        },
        'drawImage (rect + mask)': ctx => {
            // Nearest-neighbour, so every covered pixel is an opaque texel (a
            // bilinear stretch has translucent edges that would blend with dest).
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(OPAQUE_2X2, -4, -4, W + 8, H + 8);
            ctx.imageSmoothingEnabled = true;
        },
        'fillStrokeRect (combined mask)': ctx => {
            ctx.fillStyle = 'rgb(20, 90, 200)';
            ctx.strokeStyle = 'rgb(0, 0, 0)';
            ctx.lineWidth = 2;
            ctx.fillStrokeRect(-4, -4, W + 8, H + 8);
        },
        'clearRect (combined mask)': ctx => {
            ctx.clearRect(0, 0, W, H);
        },
        'copy fillRect (canvas-wide, combined mask)': ctx => {
            ctx.globalCompositeOperation = 'copy';
            ctx.fillStyle = 'rgba(120, 220, 20, 0.7)';
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';
        },
        'shadowed fillRect (combined mask)': ctx => {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 3;
            ctx.fillStyle = 'rgb(240, 200, 0)';
            ctx.fillRect(-4, -4, W + 8, H + 8);
            ctx.shadowColor = 'rgba(0, 0, 0, 0)';
        }
    };

    function backdrop(ctx) {
        ctx.fillStyle = 'rgb(250, 248, 240)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgb(60, 60, 60)';
        for (let x = 0; x < W; x += 6) ctx.fillRect(x, 0, 3, H);
    }

    function render(oracle, body) {
        const previous = Ctx2D._disableTier0Clip;
        Ctx2D._disableTier0Clip = oracle;
        try {
            const canvas = SWCanvas.createCanvas(W, H);
            const ctx = canvas.getContext('2d');
            backdrop(ctx);
            body(ctx);
            return ctx.getImageData(0, 0, W, H).data;
        } finally {
            Ctx2D._disableTier0Clip = previous;
        }
    }

    function firstDiff(a, b) {
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                const p = i >> 2;
                return `(${p % W},${Math.floor(p / W)}) channel ${i & 3}: ${a[i]} vs ${b[i]}`;
            }
        }
        return null;
    }

    // Run `levels` (each a list of clip names): per level save(), warmDraws
    // (the state above, after save() - its cache is not in the snapshot), the
    // level's clips, warmDraws again (this level's own pair). Then restore()
    // down to `keep` levels and run the final draw.
    //
    // The reference is the same program cut to its first `keep` levels. The
    // levels it drops only ever drew inside the region the final draw then
    // overwrites, so the two renders are equal exactly when restore() brought
    // back the saved clip - a deeper state's mask or combined mask surviving the
    // restore() changes the final draw's footprint.
    function program(ctx, levels, keep, finalDraw) {
        for (let i = 0; i < levels.length; i++) {
            ctx.save();
            warmDraws(ctx, 30 + i * 50);
            for (const name of levels[i]) CLIPS[name](ctx);
            warmDraws(ctx, 60 + i * 50);
        }
        for (let i = levels.length; i > keep; i--) ctx.restore();
        finalDraw(ctx);
    }

    function assertProgram(label, levels) {
        for (const drawName of Object.keys(FINAL_DRAWS)) {
            const finalDraw = FINAL_DRAWS[drawName];
            for (let keep = 0; keep < levels.length; keep++) {
                for (const oracle of [false, true]) {
                    const got = render(oracle, ctx => program(ctx, levels, keep, finalDraw));
                    const want = render(oracle, ctx => program(ctx, levels.slice(0, keep), keep, finalDraw));
                    const diff = firstDiff(got, want);
                    if (diff) {
                        throw new Error(
                            `${label}, ${drawName}, restored to depth ${keep}${oracle ? ' (oracle)' : ''}: ` +
                                `clip after restore() is not the saved one - differs at ${diff}`
                        );
                    }
                }
                const model = render(false, ctx => program(ctx, levels, keep, finalDraw));
                const pure = render(true, ctx => program(ctx, levels, keep, finalDraw));
                const diff = firstDiff(model, pure);
                if (diff) {
                    throw new Error(
                        `${label}, ${drawName}, restored to depth ${keep}: rect + mask model differs from ` +
                            `the pure mask model at ${diff}`
                    );
                }
            }
        }
        log(`  ${label}: every restore() depth brings back the saved clip, === pure mask model`);
    }

    return { assertProgram, render, firstDiff, CLIPS, warmDraws, FINAL_DRAWS };
})();

test('Clip save/restore - nested programs restore exactly the saved clip, combined-mask cache never goes stale', () => {
    const { assertProgram } = ClipRestore074;
    // Fizzygum's shape: damage rect + outline, then a child rect.
    assertProgram('rect + outline / child rect', [['rectA', 'outline'], ['rectB']]);
    // A nested rect between masks, and a nested mask that a shared outer mask
    // must not see.
    assertProgram('outline / rect / circle mask', [['outline'], ['rectB'], ['circle']]);
    assertProgram('rect / outline + rect / evenodd star / rect', [
        ['rectA'],
        ['outline', 'rectC'],
        ['starEvenodd'],
        ['rectB']
    ]);
    // Masks only, then rects only.
    assertProgram('outline / circle / evenodd star', [['outline'], ['circle'], ['starEvenodd']]);
    assertProgram('rect / rect / rect', [['rectA'], ['rectB'], ['rectC']]);
    // A nested rect disjoint from the one above (an empty clip), then a mask
    // built inside the empty rect.
    assertProgram('outline + rect / empty rect / circle mask', [['outline', 'rectB'], ['rectD'], ['circle']]);
});

test('Clip save/restore - a clip() right after restore() drops the combined mask the restore brought back', () => {
    const { render, firstDiff, CLIPS, warmDraws, FINAL_DRAWS } = ClipRestore074;
    for (const drawName of Object.keys(FINAL_DRAWS)) {
        const finalDraw = FINAL_DRAWS[drawName];
        for (const oracle of [false, true]) {
            // restore() brings back the (outline, rectA) pair together with its
            // combined mask; the rectC clip at that same level shrinks the pair,
            // so the final draw must use outline ∧ rectA ∧ rectC, not the
            // restored cache. The nested state only draws inside that region.
            const sequence = withNested => ctx => {
                CLIPS.rectA(ctx);
                CLIPS.outline(ctx);
                warmDraws(ctx, 90);
                if (withNested) {
                    ctx.save();
                    CLIPS.rectC(ctx);
                    CLIPS.rectB(ctx);
                    warmDraws(ctx, 140);
                    ctx.restore();
                }
                warmDraws(ctx, 190);
                CLIPS.rectC(ctx);
                finalDraw(ctx);
            };
            const diff = firstDiff(render(oracle, sequence(true)), render(oracle, sequence(false)));
            if (diff) {
                throw new Error(`${drawName}${oracle ? ' (oracle)' : ''}: wrong clip after restore() + clip(), at ${diff}`);
            }
            if (!oracle) {
                const pure = firstDiff(render(false, sequence(true)), render(true, sequence(true)));
                if (pure) throw new Error(`${drawName}: rect + mask model differs from the pure mask model at ${pure}`);
            }
        }
    }
    log('  restore() + a same-level clip(): the final draw uses the new pair, === pure mask model');
});

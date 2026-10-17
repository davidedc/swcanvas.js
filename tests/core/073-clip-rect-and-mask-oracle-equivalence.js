// Test: clip as an immutable mask AND a rect - byte-identical to the pure mask model
// This file will be concatenated into the main test suite
//
// Context2D keeps the clip as an optional IMMUTABLE mask AND an always-tracked
// rect: a rect clip() only intersects the rect (it never touches the mask), a
// non-rect clip() rasterises its path only inside the current rect and ANDs the
// previous mask into a fresh mask, and every draw gets either the rect and the
// mask separately (clamp to the rect + per-pixel bit test) or ONE combined mask
// (buffer-only renderers, clearRect, canvas-wide composite ops, shadows).
// The oracle is the same scene under Context2D._disableTier0Clip = true: the
// pure mask model, every clip a full-surface mask and no rect tracked.
// Contract pinned here, for every scene:
//   1. the rect + mask render is byte-identical to the oracle render,
//   2. the scene is not vacuous: it paints, and turning its clips off changes it.
// Scenes: Fizzygum's window-corner paint order (damage rect -> rounded outline,
// uniform and per-corner radii -> per child save / rect clip / draws / restore)
// with every draw entry, opaque and alpha, at 240x180 and at Fizzygum's dpr-1
// surface size (1920x880); mask -> rect -> mask under nonzero and evenodd; a
// rotated rect clip; rect clips partly and fully off the surface; empty
// intersections; the canvas-wide composite ops, other non-source-over ops and
// shadows, each under mask + rect.

const ClipOracle073 = (() => {
    const Ctx2D = SWCanvas.Core.Context2D;
    const BACKGROUND = 'rgb(250, 248, 240)';

    // A 9x7 image mixing opaque, translucent and fully transparent texels.
    function makeImage() {
        const w = 9;
        const h = 7;
        const data = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const o = (y * w + x) * 4;
                data[o] = (x * 29 + 40) & 255;
                data[o + 1] = (y * 37 + 10) & 255;
                data[o + 2] = ((x + y) * 17 + 90) & 255;
                data[o + 3] = (x + y) % 5 === 0 ? 0 : (x * y) % 3 === 0 ? 140 : 255;
            }
        }
        return { width: w, height: h, data };
    }

    // Clip helpers handed to a scene. With `on` false every clip is skipped (the
    // path is still built and discarded), which yields the unclipped render the
    // non-vacuity check compares against.
    function makeClipper(ctx, on) {
        return {
            rect(x, y, w, h) {
                ctx.beginPath();
                ctx.rect(x, y, w, h);
                if (on) ctx.clip();
                ctx.beginPath();
            },
            roundRect(x, y, w, h, radii) {
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, radii);
                if (on) ctx.clip();
                ctx.beginPath();
            },
            path(path2d, rule) {
                if (on) ctx.clip(path2d, rule);
            },
            current() {
                if (on) ctx.clip(); // the current default path, nonzero
            }
        };
    }

    function render(W, H, scene, oracle, clipsOn) {
        const previous = Ctx2D._disableTier0Clip;
        Ctx2D._disableTier0Clip = oracle;
        try {
            const canvas = SWCanvas.createCanvas(W, H);
            const ctx = canvas.getContext('2d');
            ctx.textPixelDensity = 1;
            ctx.fillStyle = BACKGROUND;
            ctx.fillRect(0, 0, W, H);
            scene(ctx, makeClipper(ctx, clipsOn), W, H);
            return ctx.getImageData(0, 0, W, H).data;
        } finally {
            Ctx2D._disableTier0Clip = previous;
        }
    }

    function firstDiff(a, b, W) {
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                const p = i >> 2;
                return `(${p % W},${Math.floor(p / W)}) channel ${i & 3}: ${a[i]} vs ${b[i]}`;
            }
        }
        return null;
    }

    function countDiffPixels(a, b) {
        let n = 0;
        for (let i = 0; i < a.length; i += 4) {
            if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++;
        }
        return n;
    }

    function assertScene(label, W, H, scene) {
        const model = render(W, H, scene, false, true);
        const oracle = render(W, H, scene, true, true);
        const diff = firstDiff(model, oracle, W);
        if (diff) {
            throw new Error(`${label}: rect + mask model differs from the pure mask model at ${diff}`);
        }
        const blank = render(W, H, () => {}, false, true);
        const painted = countDiffPixels(model, blank);
        if (painted < 50) {
            throw new Error(`${label}: vacuous - only ${painted} pixels painted`);
        }
        const unclipped = render(W, H, scene, false, false);
        const clippedAway = countDiffPixels(model, unclipped);
        if (clippedAway === 0) {
            throw new Error(`${label}: vacuous - turning the clips off changes nothing`);
        }
        log(`  ${label}: === pure mask model (${painted} px painted, ${clippedAway} px decided by the clips)`);
    }

    // Every draw entry, each placed over box b (crossing its edges). `alt`
    // switches opaque <-> translucent paint so both arms of each entry run.
    const IMAGE = makeImage();
    const DRAWS = [
        function fillRect(ctx, b, alt) {
            ctx.fillStyle = alt ? 'rgba(200, 30, 40, 0.6)' : 'rgb(200, 30, 40)';
            ctx.fillRect(b.x - 3, b.y + b.h * 0.3, b.w * 0.8, b.h * 0.5);
        },
        function strokeRect1px(ctx, b, alt) {
            ctx.strokeStyle = alt ? 'rgba(20, 90, 200, 0.5)' : 'rgb(20, 90, 200)';
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.floor(b.x) - 2.5, Math.floor(b.y) + 1.5, Math.floor(b.w * 0.7), Math.floor(b.h * 0.6));
        },
        function strokeRectThick(ctx, b, alt) {
            ctx.strokeStyle = alt ? 'rgba(10, 160, 60, 0.55)' : 'rgb(10, 160, 60)';
            ctx.lineWidth = 3;
            ctx.strokeRect(b.x + 2, b.y - 2, b.w * 0.6, b.h * 0.7);
        },
        function strokeRectHairline(ctx, b) {
            ctx.strokeStyle = 'rgb(120, 0, 120)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w * 0.5, b.h * 0.5);
        },
        function strokeRectRotated(ctx, b, alt) {
            ctx.save();
            ctx.translate(b.x + b.w * 0.4, b.y + b.h * 0.5);
            ctx.rotate(0.4);
            ctx.strokeStyle = alt ? 'rgba(220, 120, 0, 0.6)' : 'rgb(220, 120, 0)';
            ctx.lineWidth = alt ? 2 : 1;
            ctx.strokeRect(-b.w * 0.4, -b.h * 0.3, b.w * 0.8, b.h * 0.6);
            ctx.restore();
        },
        function fillStrokeRect(ctx, b, alt) {
            ctx.fillStyle = alt ? 'rgba(250, 200, 0, 0.5)' : 'rgb(250, 200, 0)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 2;
            ctx.fillStrokeRect(b.x - 1, b.y + 2, b.w * 0.7, b.h * 0.6);
        },
        function fillStrokeRectRotated(ctx, b, alt) {
            ctx.save();
            ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.4);
            ctx.rotate(-0.3);
            ctx.fillStyle = alt ? 'rgba(0, 200, 200, 0.5)' : 'rgb(0, 200, 200)';
            ctx.strokeStyle = 'rgb(0, 60, 60)';
            ctx.lineWidth = 1;
            ctx.fillStrokeRect(-b.w * 0.35, -b.h * 0.3, b.w * 0.7, b.h * 0.6);
            ctx.restore();
        },
        function clearRect(ctx, b) {
            ctx.clearRect(b.x + 2, b.y + 1, b.w * 0.5, b.h * 0.45);
        },
        function fillPathNonzero(ctx, b, alt) {
            ctx.fillStyle = alt ? 'rgba(90, 40, 160, 0.6)' : 'rgb(90, 40, 160)';
            ctx.beginPath();
            ctx.moveTo(b.x - 4, b.y + b.h);
            ctx.lineTo(b.x + b.w * 0.5, b.y - 4);
            ctx.lineTo(b.x + b.w + 3, b.y + b.h * 0.8);
            ctx.closePath();
            ctx.fill();
        },
        function fillPathEvenodd(ctx, b, alt) {
            ctx.fillStyle = alt ? 'rgba(160, 60, 20, 0.55)' : 'rgb(160, 60, 20)';
            const cx = b.x + b.w * 0.5;
            const cy = b.y + b.h * 0.5;
            const r = Math.max(b.w, b.h) * 0.6;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
                const px = cx + r * Math.cos(a);
                const py = cy + r * Math.sin(a);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill('evenodd');
        },
        function strokePath(ctx, b, alt) {
            ctx.strokeStyle = alt ? 'rgba(30, 30, 30, 0.5)' : 'rgb(30, 30, 30)';
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(b.x - 5, b.y + 3);
            ctx.lineTo(b.x + b.w * 0.6, b.y + b.h * 0.9);
            ctx.lineTo(b.x + b.w + 4, b.y + b.h * 0.2);
            ctx.stroke();
            ctx.lineJoin = 'miter';
        },
        function fillRoundRectUniform(ctx, b, alt) {
            ctx.fillStyle = alt ? 'rgba(0, 120, 255, 0.5)' : 'rgb(0, 120, 255)';
            ctx.fillRoundRect(b.x - 2, b.y + 1, b.w * 0.7, b.h * 0.7, 5);
        },
        function fillRoundRectPerCorner(ctx, b, alt) {
            ctx.fillStyle = alt ? 'rgba(255, 0, 150, 0.5)' : 'rgb(255, 0, 150)';
            ctx.fillRoundRect(b.x + 1, b.y - 2, b.w * 0.8, b.h * 0.8, [6, 0, 9, 2]);
        },
        function strokeRoundRect1px(ctx, b, alt) {
            ctx.strokeStyle = alt ? 'rgba(0, 0, 0, 0.6)' : 'rgb(0, 0, 0)';
            ctx.lineWidth = 1;
            ctx.strokeRoundRect(Math.floor(b.x) + 0.5, Math.floor(b.y) - 1.5, Math.floor(b.w * 0.8), Math.floor(b.h * 0.7), [4, 8, 0, 3]);
        },
        function strokeRoundRectThick(ctx, b, alt) {
            ctx.strokeStyle = alt ? 'rgba(80, 160, 0, 0.6)' : 'rgb(80, 160, 0)';
            ctx.lineWidth = 3;
            ctx.strokeRoundRect(b.x - 3, b.y + 2, b.w * 0.75, b.h * 0.65, 6);
        },
        function fillStrokeRoundRect(ctx, b, alt) {
            ctx.fillStyle = alt ? 'rgba(255, 220, 120, 0.6)' : 'rgb(255, 220, 120)';
            ctx.strokeStyle = 'rgba(120, 60, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.fillStrokeRoundRect(b.x + 2, b.y + 2, b.w * 0.7, b.h * 0.7, [7, 3, 0, 5]);
        },
        function strokeRoundRectRotated(ctx, b, alt) {
            ctx.save();
            ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.5);
            ctx.rotate(0.6);
            ctx.strokeStyle = alt ? 'rgba(0, 0, 200, 0.6)' : 'rgb(0, 0, 200)';
            ctx.lineWidth = 2;
            ctx.strokeRoundRect(-b.w * 0.4, -b.h * 0.3, b.w * 0.8, b.h * 0.6, 4);
            ctx.fillStyle = 'rgba(0, 0, 200, 0.3)';
            ctx.fillStrokeRoundRect(-b.w * 0.2, -b.h * 0.15, b.w * 0.4, b.h * 0.3, 3);
            ctx.restore();
        },
        function arcs(ctx, b, alt) {
            const cx = b.x + b.w * 0.3;
            const cy = b.y + b.h * 0.4;
            const r = Math.min(b.w, b.h) * 0.5 + 3;
            ctx.fillStyle = alt ? 'rgba(200, 100, 50, 0.6)' : 'rgb(200, 100, 50)';
            ctx.fillArc(cx, cy, r, 0.2, 2.4);
            ctx.strokeStyle = alt ? 'rgba(50, 50, 50, 0.6)' : 'rgb(50, 50, 50)';
            ctx.lineWidth = 1;
            ctx.outerStrokeArc(cx + 4, cy - 2, r * 0.8, 3.0, 5.5);
            ctx.lineWidth = 3;
            ctx.outerStrokeArc(cx, cy, r + 3, 4.0, 6.0);
            ctx.lineWidth = 2;
            ctx.fillOuterStrokeArc(cx + b.w * 0.4, cy + 2, r * 0.6, 1.0, 4.5);
        },
        function circles(ctx, b, alt) {
            const cx = b.x + b.w * 0.6;
            const cy = b.y + b.h * 0.5;
            const r = Math.min(b.w, b.h) * 0.45 + 2;
            ctx.fillStyle = alt ? 'rgba(0, 150, 100, 0.55)' : 'rgb(0, 150, 100)';
            ctx.fillCircle(cx, cy, r);
            ctx.strokeStyle = alt ? 'rgba(100, 0, 0, 0.6)' : 'rgb(100, 0, 0)';
            ctx.lineWidth = 1;
            ctx.strokeCircle(cx - 3, cy + 2, r * 0.7);
            ctx.lineWidth = 3;
            ctx.strokeCircle(cx + 2, cy - 1, r + 2);
            ctx.lineWidth = 2;
            ctx.fillStrokeCircle(b.x + 2, b.y + 2, r * 0.5);
        },
        function lines(ctx, b, alt) {
            ctx.strokeStyle = alt ? 'rgba(0, 0, 0, 0.6)' : 'rgb(0, 0, 0)';
            ctx.lineWidth = 1;
            ctx.strokeLine(b.x - 6, b.y + 3, b.x + b.w + 6, b.y + 3);
            ctx.strokeLine(b.x - 4, b.y + b.h + 3, b.x + b.w + 2, b.y - 5);
            ctx.lineWidth = 4;
            ctx.strokeLine(b.x - 3, b.y - 3, b.x + b.w * 0.8, b.y + b.h + 2);
            ctx.lineWidth = 3;
            ctx.strokeLine(b.x + 2, b.y - 4, b.x + 2, b.y + b.h + 4);
        },
        function drawImages(ctx, b, alt) {
            ctx.globalAlpha = alt ? 0.7 : 1;
            ctx.drawImage(IMAGE, Math.floor(b.x) - 3, Math.floor(b.y) - 2);
            ctx.drawImage(IMAGE, b.x + b.w * 0.4, b.y + 1, b.w * 0.7, b.h * 0.8);
            ctx.save();
            ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.5);
            ctx.rotate(0.5);
            ctx.drawImage(IMAGE, -6, -5, 14, 11);
            ctx.restore();
            ctx.globalAlpha = 1;
        },
        function text(ctx, b, alt) {
            ctx.font = alt ? 'bold 16px Arial' : '16px Arial';
            ctx.fillStyle = alt ? 'rgba(0, 0, 160, 0.7)' : 'rgb(0, 0, 160)';
            ctx.fillText('Wg', Math.floor(b.x) - 4, Math.floor(b.y + b.h * 0.8));
            ctx.save();
            ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.5);
            ctx.rotate(0.3);
            ctx.fillText('Ab', -8, 6);
            ctx.restore();
        },
        function gradients(ctx, b, alt) {
            const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
            g.addColorStop(0, alt ? 'rgba(255, 0, 0, 0.6)' : 'rgb(255, 0, 0)');
            g.addColorStop(1, 'rgb(0, 0, 255)');
            ctx.fillStyle = g;
            ctx.fillRect(b.x - 2, b.y - 2, b.w * 0.8, b.h * 0.6);
            const rg = ctx.createRadialGradient(b.x + b.w * 0.6, b.y + b.h * 0.6, 1, b.x + b.w * 0.6, b.y + b.h * 0.6, b.w);
            rg.addColorStop(0, 'rgb(255, 255, 0)');
            rg.addColorStop(1, 'rgba(0, 120, 0, 0.5)');
            ctx.fillStyle = rg;
            ctx.beginPath();
            ctx.arc(b.x + b.w * 0.6, b.y + b.h * 0.6, Math.min(b.w, b.h) * 0.5 + 2, 0, Math.PI * 2);
            ctx.fill();
        },
        function patterns(ctx, b, alt) {
            ctx.fillStyle = ctx.createPattern(IMAGE, 'repeat');
            ctx.globalAlpha = alt ? 0.6 : 1;
            ctx.fillRect(b.x - 3, b.y + 1, b.w * 0.7, b.h * 0.7);
            ctx.save();
            ctx.translate(0.5, 0.25);
            ctx.fillRect(b.x + b.w * 0.5, b.y - 2, b.w * 0.6, b.h * 0.5);
            ctx.restore();
            ctx.globalAlpha = 1;
        },
        function stadium(ctx, b, alt) {
            ctx.fillStyle = alt ? 'rgba(120, 120, 255, 0.6)' : 'rgb(120, 120, 255)';
            ctx.fillStadium(b.x - 2, b.y + b.h * 0.2, b.w * 0.9, Math.max(4, b.h * 0.4));
        }
    ];

    // Fizzygum's window paint order: per corner piece, save + clip(damage rect)
    // + clip(rounded outline), then per child save + clip(child rect) + draws +
    // restore, then restore. Each child draws two entries (rotating through
    // DRAWS by `offset`), placed over its rect ∩ the damage rect, grown by 4px
    // so they cross both the child rect and the outline.
    function windowCorners(ctx, clip, win, radii, offset, draws = DRAWS) {
        const { x, y, w, h } = win;
        const pieceW = Math.round(w * 0.42);
        const pieceH = Math.round(h * 0.4);
        const damages = [
            { x: x - 6, y: y - 5, w: pieceW, h: pieceH },
            { x: x + w - pieceW + 7, y: y - 4, w: pieceW, h: pieceH },
            { x: x + w - pieceW + 5, y: y + h - pieceH + 6, w: pieceW, h: pieceH },
            { x: x - 5, y: y + h - pieceH + 4, w: pieceW, h: pieceH }
        ];
        const children = [
            { x: x, y: y, w: w, h: 22 }, // title bar
            { x: x + 3, y: y + 3, w: 16, h: 16 }, // close button
            { x: x + w - 19, y: y + 3, w: 16, h: 16 }, // collapse button
            { x: x, y: y + 22, w: Math.round(w * 0.3), h: h - 22 }, // left pane
            { x: x + Math.round(w * 0.3), y: y + 22, w: w - Math.round(w * 0.3), h: h - 36 }, // content
            { x: x, y: y + h - 14, w: w, h: 14 }, // status bar
            { x: x + w - 12, y: y + h - 12, w: 12, h: 12 }, // resize handle
            { x: x - 10, y: y + 30, w: 30, h: 40 } // a child that overflows the window
        ];
        let slot = offset;
        for (const d of damages) {
            ctx.save();
            clip.rect(d.x, d.y, d.w, d.h);
            clip.roundRect(x, y, w, h, radii);
            for (const c of children) {
                ctx.save();
                clip.rect(c.x, c.y, c.w, c.h);
                const x0 = Math.max(c.x, d.x);
                const y0 = Math.max(c.y, d.y);
                const x1 = Math.min(c.x + c.w, d.x + d.w);
                const y1 = Math.min(c.y + c.h, d.y + d.h);
                if (x1 > x0 && y1 > y0) {
                    const b = { x: x0 - 4, y: y0 - 4, w: x1 - x0 + 8, h: y1 - y0 + 8 };
                    draws[slot % draws.length](ctx, b, slot % 2 === 1);
                    draws[(slot + 11) % draws.length](ctx, b, slot % 3 === 0);
                    slot++;
                }
                ctx.restore();
            }
            ctx.restore();
        }
    }

    return { assertScene, windowCorners, DRAWS };
})();

test('Clip rect + immutable mask - Fizzygum window-corner pattern === pure mask model', () => {
    const { assertScene, windowCorners, DRAWS } = ClipOracle073;
    const radiiCases = [
        { label: 'uniform radius 8', radii: 8 },
        { label: 'per-corner radii [8,3,12,0]', radii: [8, 3, 12, 0] },
        { label: 'per-corner radii [0,10,4,7]', radii: [0, 10, 4, 7] }
    ];
    // Slots rotate through DRAWS, so across the offsets every entry lands in
    // every corner piece, opaque and translucent.
    for (let s = 0; s < radiiCases.length; s++) {
        for (let pass = 0; pass < 2; pass++) {
            const offset = s * 5 + pass * 13;
            assertScene(`240x180 window, ${radiiCases[s].label}, draw offset ${offset}`, 240, 180, (ctx, clip) =>
                windowCorners(ctx, clip, { x: 30, y: 25, w: 180, h: 130 }, radiiCases[s].radii, offset)
            );
        }
    }
    // One window per draw entry, every child drawing that entry.
    for (const draw of DRAWS) {
        assertScene(`entry ${draw.name}`, 120, 90, (ctx, clip) =>
            windowCorners(ctx, clip, { x: 12, y: 10, w: 96, h: 70 }, [8, 3, 12, 0], 0, [draw])
        );
    }
});

test('Clip rect + immutable mask - window pattern on a 1920x880 surface === pure mask model', () => {
    const { assertScene, windowCorners } = ClipOracle073;
    // Fizzygum's dpr-1 desktop size: a ~500x400 window mid-surface, and one
    // hanging off the bottom-right edge so damage rects and children leave the
    // surface.
    assertScene('1920x880, mid-surface window', 1920, 880, (ctx, clip) => {
        windowCorners(ctx, clip, { x: 700, y: 240, w: 500, h: 400 }, 8, 0);
        windowCorners(ctx, clip, { x: 1640, y: 700, w: 500, h: 400 }, [8, 3, 12, 0], 9);
    });
});

test('Clip rect + immutable mask - clip sequences, fill rules, off-surface and empty rects === pure mask model', () => {
    const { assertScene, DRAWS } = ClipOracle073;
    const W = 160;
    const H = 120;
    const all = (ctx, b) => {
        for (let k = 0; k < DRAWS.length; k++) DRAWS[k](ctx, b, k % 2 === 1);
    };
    const star = (cx, cy, r) => {
        const p = new SWCanvas.Core.SWPath2D();
        for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + (i * 6 * Math.PI) / 7;
            if (i === 0) p.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
            else p.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        p.closePath();
        return p;
    };
    const ring = (cx, cy, r0, r1) => {
        const p = new SWCanvas.Core.SWPath2D();
        p.arc(cx, cy, r1, 0, Math.PI * 2);
        p.closePath();
        p.moveTo(cx + r0, cy);
        p.arc(cx, cy, r0, 0, Math.PI * 2);
        p.closePath();
        return p;
    };
    for (const rule of ['nonzero', 'evenodd']) {
        assertScene(`mask -> rect -> mask (${rule})`, W, H, (ctx, clip) => {
            ctx.save();
            clip.path(star(80, 60, 58), rule);
            clip.rect(20, 14, 115, 90);
            clip.path(ring(78, 62, 18, 52), rule);
            all(ctx, { x: 20, y: 18, w: 120, h: 84 });
            ctx.restore();
        });
        assertScene(`rect -> mask -> rect -> mask -> rect (${rule})`, W, H, (ctx, clip) => {
            ctx.save();
            clip.rect(6, 4, 150, 110);
            clip.path(ring(80, 60, 10, 55), rule);
            clip.rect(30.5, 20.25, 100, 75.75); // fractional edges: ceil(v - 0.5) rounding
            clip.path(star(80, 58, 60), rule);
            clip.rect(40, 10, 90, 100);
            all(ctx, { x: 30, y: 20, w: 100, h: 80 });
            ctx.restore();
        });
    }
    assertScene('rotated (non-axis-aligned) rect clip between rect clips', W, H, (ctx, clip) => {
        ctx.save();
        clip.rect(10, 8, 140, 104);
        ctx.translate(80, 60);
        ctx.rotate(0.35);
        clip.rect(-55, -35, 110, 70);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        clip.rect(25, 15, 120, 90);
        all(ctx, { x: 20, y: 15, w: 120, h: 90 });
        ctx.restore();
    });
    assertScene('rect clips partly off the surface, around a mask', W, H, (ctx, clip) => {
        ctx.save();
        clip.rect(-30, -20, 110, 85);
        clip.roundRect(-10, -10, 100, 80, [12, 0, 16, 6]);
        all(ctx, { x: -5, y: -5, w: 80, h: 65 });
        ctx.restore();
        ctx.save();
        clip.roundRect(90, 50, 100, 100, 14);
        clip.rect(100, 60, 200, 200);
        all(ctx, { x: 95, y: 55, w: 70, h: 70 });
        ctx.restore();
    });
    assertScene('rect clip fully off the surface, then a mask and draws', W, H, (ctx, clip) => {
        ctx.save();
        clip.roundRect(10, 10, 100, 80, 10);
        all(ctx, { x: 10, y: 10, w: 100, h: 80 });
        ctx.save();
        clip.rect(W + 10, 5, 30, 30);
        clip.roundRect(W + 12, 6, 20, 20, 4);
        all(ctx, { x: 10, y: 10, w: 100, h: 80 });
        ctx.restore();
        ctx.save();
        clip.rect(-60, -50, 40, 30);
        all(ctx, { x: 10, y: 10, w: 100, h: 80 });
        ctx.restore();
        ctx.restore();
    });
    assertScene('empty rect intersections, with and without a mask', W, H, (ctx, clip) => {
        ctx.save();
        clip.rect(10, 10, 40, 40);
        all(ctx, { x: 10, y: 10, w: 40, h: 40 });
        ctx.save();
        clip.rect(60, 60, 30, 30); // disjoint -> empty
        all(ctx, { x: 10, y: 10, w: 80, h: 80 });
        clip.roundRect(0, 0, 100, 100, 20); // a mask built inside an empty rect
        all(ctx, { x: 10, y: 10, w: 80, h: 80 });
        ctx.restore();
        clip.roundRect(5, 5, 60, 60, [20, 0, 20, 0]);
        clip.rect(48, 10, 2, 40); // a 2px sliver
        clip.rect(49, 10, 0.4, 40); // collapses to zero columns
        all(ctx, { x: 10, y: 10, w: 40, h: 40 });
        ctx.restore();
        clip.rect(100, 70, 50, 40);
        all(ctx, { x: 100, y: 70, w: 50, h: 40 });
    });
    assertScene('current-path clips (moveTo/lineTo rect, arc) under a CTM', W, H, (ctx, clip) => {
        ctx.save();
        ctx.translate(3.5, 2.25);
        ctx.scale(1.25, 1.25);
        ctx.beginPath();
        ctx.moveTo(8, 6);
        ctx.lineTo(110, 6);
        ctx.lineTo(110, 84);
        ctx.lineTo(8, 84);
        ctx.closePath();
        clip.current(); // the current path, detected as a rect
        ctx.beginPath();
        ctx.arc(60, 45, 44, 0, Math.PI * 2);
        clip.current();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        all(ctx, { x: 10, y: 8, w: 140, h: 104 });
        ctx.restore();
    });
});

test('Clip rect + immutable mask - canvas-wide composites, other composites and shadows === pure mask model', () => {
    const { assertScene, DRAWS } = ClipOracle073;
    const W = 120;
    const H = 90;
    const backdrop = ctx => {
        ctx.fillStyle = 'rgb(40, 160, 220)';
        ctx.fillRect(0, 0, W, H / 2);
        ctx.fillStyle = 'rgba(220, 60, 60, 0.6)';
        ctx.fillRect(W / 3, 0, W / 3, H);
    };
    const underMaskAndRect = (ctx, clip, fn) => {
        ctx.save();
        clip.rect(8, 6, 104, 78);
        clip.roundRect(4, 2, 100, 80, [14, 4, 20, 0]);
        ctx.save();
        clip.rect(20, 12, 80, 64);
        fn();
        ctx.restore();
        ctx.restore();
    };
    const ops = ['copy', 'source-in', 'source-out', 'destination-in', 'destination-atop', 'destination-out', 'xor', 'lighter', 'source-atop'];
    for (const op of ops) {
        assertScene(`globalCompositeOperation = ${op}`, W, H, (ctx, clip) => {
            backdrop(ctx);
            underMaskAndRect(ctx, clip, () => {
                ctx.globalCompositeOperation = op;
                ctx.fillStyle = 'rgba(250, 210, 0, 0.8)';
                ctx.fillRect(30, 20, 50, 40);
                ctx.beginPath();
                ctx.arc(70, 50, 24, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgb(0, 0, 0)';
                ctx.lineWidth = 3;
                ctx.strokeRect(15.5, 15.5, 60, 50);
                DRAWS.find(d => d.name === 'drawImages')(ctx, { x: 40, y: 30, w: 30, h: 24 }, false);
                DRAWS.find(d => d.name === 'circles')(ctx, { x: 50, y: 40, w: 30, h: 24 }, true);
                ctx.globalCompositeOperation = 'source-over';
            });
        });
    }
    assertScene('shadows under mask + rect', W, H, (ctx, clip) => {
        backdrop(ctx);
        underMaskAndRect(ctx, clip, () => {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 4;
            for (let k = 0; k < DRAWS.length; k++) {
                DRAWS[k](ctx, { x: 26 + (k % 5) * 12, y: 16 + Math.floor(k / 5) * 11, w: 18, h: 14 }, k % 2 === 0);
            }
            ctx.shadowColor = 'rgba(0, 0, 0, 0)';
        });
    });
});

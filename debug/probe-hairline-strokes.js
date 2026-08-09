// Probe: HAIRLINE (sub-1px) strokes on the five direct stroke entries —
// strokeRect / strokeRoundRect / strokeCircle / outerStrokeArc / strokeLine —
// each measured three ways on the same geometry:
//
//   TODAY     the direct entry as it dispatches right now
//   GENERIC   the equivalent generic-path call (beginPath + ... + stroke),
//             which owns THE rule: Rasterizer._strokeInternal renders any
//             lineWidth < 1 at width 1.0 with subPixelOpacity = lineWidth
//   PROPOSED  the faint-1px call the new branch would make, emulated with
//             today's code as `lineWidth = 1/scale` (so the DEVICE width is
//             exactly 1, taking the existing exact-1px renderer) at
//             `globalAlpha = deviceWidth` — i.e. 1px geometry, opacity
//             proportional to the true device width
//
// under identity, scale(1.4) and scale(0.7) — plus rotate+scale for the two
// families that have a rotated branch (rect, roundRect).
//
// Questions this probe answers (see docs/plans/hairline-direct-strokes-plan.md
// §1.1 in the Fizzygum repo — it is the probe, not the plan's prose, that
// decides the per-shape baseline):
//   1. What does each entry ACTUALLY do below 1px today — faint, full-opacity,
//      or coverage-broken? (§1.1's table, re-measured.)
//   2. Does TODAY reach the generic pipeline (the path-based flag), i.e. is it
//      the slow-but-correct fall-through or a direct renderer?
//   3. Is PROPOSED a CLOSED outline at every transform (the transform
//      robustness the circle's device-space fallback lacks)?
//   4. Is PROPOSED's faintness the rule's product — one uniform level at
//      ~255*(1-deviceWidth) for a black stroke on white?
//   5. Where TODAY already renders faint (rect's fall-through, circle at
//      identity), how far is PROPOSED from it — the churn the change carries.
const SWCanvas = require('../dist/swcanvas.js');

const W = 48,
    H = 48;

function newCtx() {
    const canvas = SWCanvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, W, H);
    return ctx;
}

// Gray level per pixel (stroke is black on white, so level 255 = untouched,
// 0 = full-opacity black, anything between = the faint rule at work).
function levels(ctx) {
    const img = ctx.getImageData(0, 0, W, H);
    const g = [];
    for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) row.push(img.data[(y * W + x) * 4]);
        g.push(row);
    }
    return g;
}

function analyze(g) {
    const lv = new Map();
    let count = 0;
    const on = [];
    for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) {
            const v = g[y][x];
            const painted = v !== 255;
            row.push(painted);
            if (painted) {
                count++;
                lv.set(v, (lv.get(v) || 0) + 1);
            }
        }
        on.push(row);
    }
    // Outline continuity: painted pixels with fewer than 2 painted 8-neighbours.
    // A closed ring/outline has none; an open arc or a line has exactly its 2 ends.
    let loose = 0;
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            if (!on[y][x]) continue;
            let n = 0;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const yy = y + dy,
                        xx = x + dx;
                    if (yy >= 0 && yy < H && xx >= 0 && xx < W && on[yy][xx]) n++;
                }
            if (n < 2) loose++;
        }
    const sorted = [...lv.entries()].sort((a, b) => a[0] - b[0]);
    return { count, loose, levelSummary: sorted.map(([v, n]) => `${v}x${n}`).join(' '), nLevels: sorted.length };
}

function diffPixels(ga, gb) {
    let d = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ga[y][x] !== gb[y][x]) d++;
    return d;
}

// Run one drawing under one transform, reporting whether the generic path
// pipeline was reached.
function run(setTransform, draw) {
    SWCanvas.Core.Context2D.resetPathBasedFlag();
    const ctx = newCtx();
    ctx.save();
    setTransform(ctx);
    ctx.strokeStyle = 'rgb(0,0,0)';
    draw(ctx);
    ctx.restore();
    return { g: levels(ctx), pathBased: SWCanvas.Core.Context2D.wasPathBasedUsed() };
}

const LOGICAL_W = 0.5; // the Fizzygum hairline width (HandleAppearance's lineWidth 0.5)

// Each entry: how to draw it directly, and the equivalent generic-path call.
const ENTRIES = [
    {
        name: 'strokeRect',
        closed: true,
        direct: c => c.strokeRect(12, 12, 24, 24),
        generic: c => {
            c.beginPath();
            c.rect(12, 12, 24, 24);
            c.closePath();
            c.stroke();
        }
    },
    {
        name: 'strokeRoundRect',
        closed: true,
        direct: c => c.strokeRoundRect(12, 12, 24, 24, 6),
        // The compat context has no roundRect() path builder; an external
        // user-space SWPath2D is what strokeRoundRect's own fallback uses.
        generic: c => {
            const p = new SWCanvas.Core.SWPath2D();
            p.roundRect(12, 12, 24, 24, 6);
            c.stroke(p);
        }
    },
    {
        name: 'strokeCircle',
        closed: true,
        direct: c => c.strokeCircle(24, 24, 11),
        generic: c => {
            c.beginPath();
            c.arc(24, 24, 11, 0, 2 * Math.PI);
            c.stroke();
        }
    },
    {
        name: 'outerStrokeArc',
        closed: false,
        direct: c => c.outerStrokeArc(24, 24, 11, 0.3, 2.2),
        generic: c => {
            c.beginPath();
            c.arc(24, 24, 11, 0.3, 2.2);
            c.stroke();
        }
    },
    {
        name: 'strokeLine',
        closed: false,
        direct: c => c.strokeLine(10, 14, 38, 31),
        generic: c => {
            c.beginPath();
            c.moveTo(10, 14);
            c.lineTo(38, 31);
            c.stroke();
        }
    }
];

const TRANSFORMS = [
    { label: 'identity', scale: 1, apply: () => {} },
    { label: 'scale(1.4)', scale: 1.4, apply: c => c.scale(1.4, 1.4) },
    { label: 'scale(0.7)', scale: 0.7, apply: c => c.scale(0.7, 0.7) }
];

function report(label, r, expectLoose) {
    const a = analyze(r.g);
    const closure =
        a.count === 0 ? 'EMPTY' : a.loose <= expectLoose ? `closed(loose=${a.loose})` : `OPEN(loose=${a.loose})`;
    console.log(
        `    ${label.padEnd(9)} ${String(a.count).padStart(4)}px  ${closure.padEnd(16)} ` +
            `levels[${a.nLevels}]: ${a.levelSummary.length > 66 ? a.levelSummary.slice(0, 63) + '...' : a.levelSummary}` +
            `${r.pathBased ? '   <PATH-BASED>' : ''}`
    );
    return a;
}

console.log('############ 1. The five direct stroke entries at a sub-1px width');
console.log(`Stroke is black on white; logical lineWidth ${LOGICAL_W}.`);
console.log('PROPOSED = lineWidth 1/scale (device width exactly 1) at globalAlpha = device width.');
console.log('For a black stroke the rule predicts ONE level at round(255*(1-deviceWidth)).');

for (const e of ENTRIES) {
    for (const t of TRANSFORMS) {
        const deviceW = LOGICAL_W * t.scale;
        const predicted = Math.round(255 * (1 - deviceW));
        console.log(
            `\n=== ${e.name} @ ${t.label}  (logical lw ${LOGICAL_W} -> device ${deviceW.toFixed(3)}; ` +
                `rule predicts one level ~${predicted})`
        );
        const expectLoose = e.closed ? 0 : 2;

        const today = run(t.apply, c => {
            c.lineWidth = LOGICAL_W;
            e.direct(c);
        });
        const generic = run(t.apply, c => {
            c.lineWidth = LOGICAL_W;
            e.generic(c);
        });
        const proposed = run(t.apply, c => {
            c.lineWidth = 1 / t.scale;
            c.globalAlpha = deviceW;
            e.direct(c);
        });

        report('TODAY', today, expectLoose);
        report('GENERIC', generic, expectLoose);
        report('PROPOSED', proposed, expectLoose);
        console.log(
            `    diffs: today-vs-generic ${diffPixels(today.g, generic.g)}px, ` +
                `today-vs-proposed ${diffPixels(today.g, proposed.g)}px, ` +
                `generic-vs-proposed ${diffPixels(generic.g, proposed.g)}px`
        );
    }
}

// ---------------------------------------------------------------------------
// 2. The ROTATED branches (rect + roundRect have one; the others gate rotation
//    into the same uniform-scale direct path already covered above).
// ---------------------------------------------------------------------------
console.log('\n############ 2. Rotated branches (RectOpsRot / RoundedRectOpsRot)');
const ROT = {
    label: 'translate+rotate(0.3)+scale(1.2)',
    scale: 1.2,
    apply: c => {
        c.translate(24, 24);
        c.rotate(0.3);
        c.scale(1.2, 1.2);
    }
};
for (const e of ENTRIES.slice(0, 2)) {
    const deviceW = LOGICAL_W * ROT.scale;
    const predicted = Math.round(255 * (1 - deviceW));
    console.log(`\n=== ${e.name} @ ${ROT.label}  (device ${deviceW.toFixed(3)}; rule predicts ~${predicted})`);
    const rotDirect = c =>
        e.name === 'strokeRect' ? c.strokeRect(-12, -12, 24, 24) : c.strokeRoundRect(-12, -12, 24, 24, 6);
    const rotGeneric = c => {
        if (e.name === 'strokeRect') {
            c.beginPath();
            c.rect(-12, -12, 24, 24);
            c.closePath();
            c.stroke();
        } else {
            const p = new SWCanvas.Core.SWPath2D();
            p.roundRect(-12, -12, 24, 24, 6);
            c.stroke(p);
        }
    };
    const today = run(ROT.apply, c => {
        c.lineWidth = LOGICAL_W;
        rotDirect(c);
    });
    const generic = run(ROT.apply, c => {
        c.lineWidth = LOGICAL_W;
        rotGeneric(c);
    });
    const proposed = run(ROT.apply, c => {
        c.lineWidth = 1 / ROT.scale;
        c.globalAlpha = deviceW;
        rotDirect(c);
    });
    report('TODAY', today, 0);
    report('GENERIC', generic, 0);
    report('PROPOSED', proposed, 0);
    console.log(
        `    diffs: today-vs-generic ${diffPixels(today.g, generic.g)}px, ` +
            `today-vs-proposed ${diffPixels(today.g, proposed.g)}px`
    );
}

// ---------------------------------------------------------------------------
// 3. Faintness monotonicity: does the level track the width, per entry?
// ---------------------------------------------------------------------------
console.log('\n############ 3. PROPOSED faintness vs width (identity), per entry');
for (const e of ENTRIES) {
    const row = [];
    for (const w of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const r = run(
            () => {},
            c => {
                c.lineWidth = 1;
                c.globalAlpha = w;
                e.direct(c);
            }
        );
        const a = analyze(r.g);
        row.push(`w=${w}: ${a.nLevels === 1 ? a.levelSummary.split('x')[0] : `[${a.nLevels} levels]`} (${a.count}px)`);
    }
    console.log(`  ${e.name.padEnd(16)} ${row.join('  ')}`);
}

// ---------------------------------------------------------------------------
// 4. The Fizzygum case: the rotate-handle knob ring inside a scaled island.
//    44x44 handle, white ring r = min(w,h)/2 - 1 at lineWidth 0.5, on the
//    handle-face blue — the exact paint HandleAppearance makes today.
// ---------------------------------------------------------------------------
console.log('\n############ 4. The rotate-handle knob ring (HandleAppearance geometry)');
function handleRing(mode, scale) {
    SWCanvas.Core.Context2D.resetPathBasedFlag();
    const canvas = SWCanvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(60,90,160)';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.scale(scale, scale);
    const side = 44 / scale; // a 44-device-px handle at this scale
    const cx = side / 2,
        cy = side / 2,
        r = side / 2 - 1 / scale;
    ctx.strokeStyle = 'rgb(255,255,255)';
    if (mode === 'today-arc') {
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (mode === 'today-strokeCircle') {
        ctx.lineWidth = 0.5;
        ctx.strokeCircle(cx, cy, r);
    } else {
        ctx.lineWidth = 1 / scale;
        ctx.globalAlpha = 0.5 * scale;
        ctx.strokeCircle(cx, cy, r);
    }
    ctx.restore();
    const img = ctx.getImageData(0, 0, W, H);
    const g = [];
    for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) row.push(img.data[(y * W + x) * 4]);
        g.push(row);
    }
    // Painted = redder than the blue face's r=60
    let count = 0,
        loose = 0;
    const on = g.map(row => row.map(v => v > 62));
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            if (!on[y][x]) continue;
            count++;
            let n = 0;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const yy = y + dy,
                        xx = x + dx;
                    if (yy >= 0 && yy < H && xx >= 0 && xx < W && on[yy][xx]) n++;
                }
            if (n < 2) loose++;
        }
    return { count, loose, pathBased: SWCanvas.Core.Context2D.wasPathBasedUsed() };
}
for (const scale of [1, 0.7, 1.4]) {
    console.log(`  --- island scale ${scale}`);
    for (const mode of ['today-arc', 'today-strokeCircle', 'proposed-strokeCircle']) {
        const r = handleRing(mode, scale);
        console.log(
            `      ${mode.padEnd(22)} ${String(r.count).padStart(4)}px ring, ` +
                `${r.loose === 0 ? 'CLOSED' : `OPEN(loose=${r.loose})`}${r.pathBased ? '  <PATH-BASED>' : ''}`
        );
    }
}

// ---------------------------------------------------------------------------
// 5. THRESHOLD CONTINUITY — the question that decides which neighbour a
//    hairline should agree with. A hairline can land either where the
//    exact-1px DIRECT stroke lands (continuity across the 1px threshold: a
//    0.9px ring sits exactly where a 1px ring sits, only fainter) or where the
//    GENERIC sub-pixel stroke lands (continuity with the slow path). Where the
//    two already disagree at lw = 1 — which is TODAY's shipped behaviour for
//    every lw>=1 caller — they cannot both be satisfied.
// ---------------------------------------------------------------------------
console.log('\n############ 5. Threshold continuity at lw = 1 (device): direct vs generic, TODAY');
for (const e of ENTRIES) {
    for (const t of TRANSFORMS) {
        const direct1 = run(t.apply, c => {
            c.lineWidth = 1 / t.scale;
            e.direct(c);
        });
        const generic1 = run(t.apply, c => {
            c.lineWidth = 1 / t.scale;
            e.generic(c);
        });
        // And the faint end of the hairline branch: device width 0.999, which
        // must be positionally indistinguishable from the exact-1px stroke.
        const hair = run(t.apply, c => {
            c.lineWidth = 1 / t.scale;
            c.globalAlpha = 0.999;
            e.direct(c);
        });
        const ad = analyze(direct1.g),
            ag = analyze(generic1.g),
            ah = analyze(hair.g);
        // Compare pixel SETS (position), ignoring level.
        const setDiff = (ga, gb) => {
            let d = 0;
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((ga[y][x] !== 255) !== (gb[y][x] !== 255)) d++;
            return d;
        };
        console.log(
            `  ${e.name.padEnd(16)} @ ${t.label.padEnd(11)} direct1px ${String(ad.count).padStart(3)}px${
                direct1.pathBased ? '(path)' : '      '
            } generic1px ${String(ag.count).padStart(3)}px  ` +
                `position: direct-vs-generic ${String(setDiff(direct1.g, generic1.g)).padStart(3)}px, ` +
                `hairline(0.999)-vs-direct1px ${setDiff(hair.g, direct1.g)}px (${ah.count}px)`
        );
    }
}

console.log('\ndone.');

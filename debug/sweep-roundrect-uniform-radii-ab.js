// A/B sweep: every UNIFORM radii spelling must render exactly as a reference dist
// rendered the scalar radius - the byte-identity proof behind per-corner radii
// (DIRECT-RENDERING-SUMMARY.MD §9 entry 17). Seeded random cases over all roundRect
// entry points (fillRoundRect, strokeRoundRect, fillStrokeRoundRect, fillStadium,
// SWPath2D fill/stroke), CTM classes (identity, translations, uniform scales, the
// quarter turns, tilts, non-uniform scale, skew, a flip), tier-0 / bitmask /
// roundRect clips, line widths (hairline to thick), opacities, dashes and caps.
// The reference dist only reads scalars, so it renders `r` while the dist under test
// renders r, [r], [r,r], [r,r,r] or [r,r,r,r].
//
//   git show <ref>:dist/swcanvas.js > /tmp/ref-swcanvas.js     (never `git stash` here)
//   node debug/sweep-roundrect-uniform-radii-ab.js /tmp/ref-swcanvas.js dist/swcanvas.js [cases]
//
// Prints every differing case (first 15) and a summary; "diffs=0" is the pass.
const path = require('path');
const OLD = require(path.resolve(process.argv[2]));
const NEW = require(path.resolve(process.argv[3]));
const N = +(process.argv[4] || 20000);
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = a => a[Math.floor(rnd() * a.length)];
const W = 64,
    H = 56;
const transforms = [
    ['id', c => {}],
    ['tr', c => c.translate(0.5, 0.5)],
    ['trFrac', c => c.translate(3.3, -1.7)],
    ['s2', c => c.scale(2, 2)],
    [
        's1.5',
        c => {
            c.translate(2, 1);
            c.scale(1.5, 1.5);
        }
    ],
    [
        'r90',
        c => {
            c.translate(50, 4);
            c.rotate(Math.PI / 2);
        }
    ],
    [
        'r180',
        c => {
            c.translate(58, 50);
            c.rotate(Math.PI);
        }
    ],
    [
        'r270',
        c => {
            c.translate(4, 50);
            c.rotate(-Math.PI / 2);
        }
    ],
    [
        'r90s2',
        c => {
            c.translate(60, 2);
            c.rotate(Math.PI / 2);
            c.scale(1.4, 1.4);
        }
    ],
    [
        'r30',
        c => {
            c.translate(30, 2);
            c.rotate(Math.PI / 6);
        }
    ],
    [
        'r-50s1.2',
        c => {
            c.translate(8, 40);
            c.rotate(-0.9);
            c.scale(1.2, 1.2);
        }
    ],
    ['nonUni', c => c.scale(2, 1)],
    ['skew', c => c.transform(1, 0.2, 0.3, 1, 0, 0)],
    [
        'flipX',
        c => {
            c.translate(60, 0);
            c.scale(-1, 1);
        }
    ]
];
const clips = ['none', 'tier0', 'mask', 'roundclip'];
function render(lib, cs) {
    const surface = lib.Core.Surface(W, H);
    const ctx = new lib.Core.Context2D(surface);
    ctx.setFillStyle(255, 255, 255, 255);
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (cs.clip === 'tier0') {
        ctx.beginPath();
        ctx.rect(6, 5, 40, 30);
        ctx.clip();
    }
    if (cs.clip === 'mask') {
        ctx.beginPath();
        ctx.rect(6, 5, 40, 30);
        ctx.rect(6, 5, 40, 30);
        ctx.clip();
    }
    if (cs.clip === 'roundclip') {
        const p = new lib.Core.SWPath2D();
        p.roundRect(4, 3, 44, 34, 9);
        ctx.clip(p);
    }
    cs.xf[1](ctx);
    ctx.setFillStyle(...cs.fill);
    ctx.setStrokeStyle(...cs.stroke);
    ctx.lineWidth = cs.lw;
    ctx.globalAlpha = cs.ga;
    if (cs.dash) ctx.setLineDash([3, 2]);
    ctx.lineCap = cs.cap;
    const [x, y, w, h] = cs.geo;
    const radii = cs.spell(cs.r);
    try {
        switch (cs.entry) {
            case 'fill':
                ctx.fillRoundRect(x, y, w, h, radii);
                break;
            case 'stroke':
                ctx.strokeRoundRect(x, y, w, h, radii);
                break;
            case 'fused':
                ctx.fillStrokeRoundRect(x, y, w, h, radii);
                break;
            case 'stadium':
                ctx.fillStadium(x, y, w, h);
                break;
            case 'pathFill': {
                const p = new lib.Core.SWPath2D();
                p.roundRect(x, y, w, h, radii);
                ctx.fill(p);
                break;
            }
            case 'pathStroke': {
                const p = new lib.Core.SWPath2D();
                p.roundRect(x, y, w, h, radii);
                ctx.stroke(p);
                break;
            }
        }
    } catch (e) {
        return 'THROW:' + e.message;
    }
    ctx.restore();
    return Buffer.from(surface.data.buffer);
}
const spells = [
    ['n', r => r],
    ['[r]', r => [r]],
    ['[r,r]', r => [r, r]],
    ['[r,r,r]', r => [r, r, r]],
    ['[r,r,r,r]', r => [r, r, r, r]]
];
let diffs = 0,
    cases = 0,
    nonWhite = 0;
const byEntry = {};
for (let i = 0; i < N; i++) {
    const sp = pick(spells);
    const cs = {
        entry: pick(['fill', 'stroke', 'fused', 'stadium', 'pathFill', 'pathStroke', 'stroke', 'fused']),
        xf: pick(transforms),
        clip: pick(clips),
        geo: [
            pick([4, 4.5, 5.25, 7]),
            pick([3, 3.5, 6.7]),
            pick([1, 2, 3, 9, 20, 31, 40.5, 47]),
            pick([1, 2, 5, 11, 24, 30.5, 36])
        ],
        r: pick([0, 0.3, 0.5, 1, 1.5, 2, 3.5, 5, 7, 10, 15.5, 100]),
        lw: pick([0.5, 1, 1, 1.5, 2, 3, 6.5]),
        fill: pick([
            [0, 0, 255, 255],
            [0, 128, 0, 128],
            [0, 0, 0, 0]
        ]),
        stroke: pick([
            [255, 0, 0, 255],
            [255, 0, 0, 100],
            [0, 0, 0, 0]
        ]),
        ga: pick([1, 1, 0.6]),
        dash: rnd() < 0.15,
        cap: pick(['butt', 'butt', 'round', 'square']),
        spellName: sp[0],
        spell: sp[1]
    };
    // old dist only knew scalars: render the scalar there
    const oldOut = render(OLD, { ...cs, spell: r => r });
    const newOut = render(NEW, cs);
    cases++;
    const k = cs.entry + ' ' + cs.xf[0];
    byEntry[k] = (byEntry[k] || 0) + 1;
    const same = typeof oldOut === 'string' || typeof newOut === 'string' ? oldOut === newOut : oldOut.equals(newOut);
    if (typeof newOut !== 'string') {
        for (let j = 0; j < newOut.length; j += 4) {
            if (newOut[j] !== 255 || newOut[j + 1] !== 255 || newOut[j + 2] !== 255) {
                nonWhite++;
                break;
            }
        }
    }
    if (!same) {
        diffs++;
        if (diffs <= 15) {
            let n = 0,
                first = null;
            if (typeof oldOut !== 'string' && typeof newOut !== 'string')
                for (let j = 0; j < oldOut.length; j += 4)
                    if (oldOut.readUInt32LE(j) !== newOut.readUInt32LE(j)) {
                        n++;
                        if (!first) first = [(j / 4) % W, Math.floor(j / 4 / W)];
                    }
            console.log(
                'DIFF',
                JSON.stringify({
                    entry: cs.entry,
                    xf: cs.xf[0],
                    clip: cs.clip,
                    geo: cs.geo,
                    r: cs.r,
                    spell: cs.spellName,
                    lw: cs.lw,
                    fill: cs.fill,
                    stroke: cs.stroke,
                    ga: cs.ga,
                    dash: cs.dash,
                    cap: cs.cap
                }),
                typeof oldOut === 'string' ? oldOut : '',
                typeof newOut === 'string' ? newOut : '',
                'px',
                n,
                'first',
                first
            );
        }
    }
}
console.log(`cases=${cases} diffs=${diffs} (cases that drew something: ${nonWhite})`);
console.log('coverage (entry x transform):', Object.keys(byEntry).length, 'combos');

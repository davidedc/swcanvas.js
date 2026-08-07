// Probe: circle direct-path crisp contract — fillCircle / strokeCircle (1px and
// thick) across the coordinate-spelling grid (integer vs half-integer centers,
// integer vs .5 vs arbitrary-fractional radii), under identity vs scale(2) vs
// Fizzygum-style translate+uniform-scale transforms, A/B'd against the generic
// path pipeline (arc() + fill()/stroke()) on the same geometry.
//
// Questions this probe answers (see direct-shape-fastpaths-followups-plan.md P1):
//   1. Is the 1px stroke output single-width and closed, and is the shape
//      symmetric (x-mirror / y-mirror) at each spelling?
//   2. Do quadrant pixels show the QUADRANT_TRIG_EPSILON class of trig-noise
//      flooring? (CircleOps is Bresenham, not per-degree trig — expected no,
//      but the probe decides, not the expectation.)
//   3. What is the crisp idiom — which spelling puts a fill exactly inside an
//      integer box, and a 1px ring exactly inside the same box?
//   4. How far do the direct paths diverge from the generic path on the same
//      geometry (the P3 conversion's recapture blast radius, in miniature)?
const SWCanvas = require('../dist/swcanvas.js');

const W = 44,
    H = 44;

function newCtx() {
    const canvas = SWCanvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, W, H);
    return ctx;
}

function grid(ctx) {
    // 1 = red shape pixel, 0 = background
    const img = ctx.getImageData(0, 0, W, H);
    const g = [];
    for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            row.push(img.data[i + 1] < 128 ? 1 : 0); // any reddish coverage counts
        }
        g.push(row);
    }
    return g;
}

function bboxOf(g) {
    let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
            if (g[y][x]) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

function analyze(g) {
    const b = bboxOf(g);
    if (!b) return { empty: true };
    // Mirror symmetry within the bbox
    let xSym = true,
        ySym = true;
    for (let y = b.y0; y <= b.y1; y++)
        for (let x = b.x0; x <= b.x1; x++) {
            if (g[y][x] !== g[y][b.x1 - (x - b.x0)]) xSym = false;
            if (g[y][x] !== g[b.y1 - (y - b.y0)][x]) ySym = false;
        }
    // Ring closure: every ON pixel has >= 2 ON 8-neighbors (only meaningful for strokes)
    let openPixels = 0,
        count = 0;
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
            if (g[y][x]) {
                count++;
                let n = 0;
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++) {
                        if (!dx && !dy) continue;
                        const yy = y + dy,
                            xx = x + dx;
                        if (yy >= 0 && yy < H && xx >= 0 && xx < W && g[yy][xx]) n++;
                    }
                if (n < 2) openPixels++;
            }
    return {
        bbox: `[${b.x0}..${b.x1}]x[${b.y0}..${b.y1}]`,
        w: b.x1 - b.x0 + 1,
        h: b.y1 - b.y0 + 1,
        pixels: count,
        xSym,
        ySym,
        openPixels
    };
}

function dump(label, ctx, opts = {}) {
    const g = grid(ctx);
    const a = analyze(g);
    console.log(`\n=== ${label}`);
    if (a.empty) {
        console.log('    (empty)');
        return g;
    }
    console.log(
        `    bbox ${a.bbox} (${a.w}x${a.h}), ${a.pixels}px, xSym=${a.xSym} ySym=${a.ySym}` +
            (opts.ring ? `, openRingPixels=${a.openPixels}` : '')
    );
    if (!opts.quiet) {
        const b = bboxOf(g);
        const px0 = Math.max(0, b.x0 - 1),
            px1 = Math.min(W - 1, b.x1 + 1);
        for (let y = Math.max(0, b.y0 - 1); y <= Math.min(H - 1, b.y1 + 1); y++) {
            let row = '';
            for (let x = px0; x <= px1; x++) row += g[y][x] ? '#' : '.';
            console.log(String(y).padStart(3) + ' ' + row);
        }
    }
    return g;
}

function diffCount(g1, g2) {
    let d = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g1[y][x] !== g2[y][x]) d++;
    return d;
}

// ---------------------------------------------------------------------------
// 1. FILL — spelling grid at identity
// ---------------------------------------------------------------------------
console.log('############ 1. fillCircle spelling grid (identity transform)');
let ctx, gA, gB;

for (const [cx, cy, r] of [
    [20, 20, 8],
    [20.5, 20.5, 8],
    [20, 20, 8.5],
    [20.5, 20.5, 8.5],
    [20.25, 20.75, 8.75]
]) {
    ctx = newCtx();
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.fillCircle(cx, cy, r);
    gA = dump(`fillCircle(${cx}, ${cy}, r=${r})`, ctx);

    ctx = newCtx();
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fill();
    gB = dump(`generic arc()+fill same geometry`, ctx, { quiet: true });
    console.log(`    direct-vs-generic diff: ${diffCount(gA, gB)}px`);
}

// The crisp-box question: which fill spelling covers EXACTLY a 2r x 2r box?
console.log('\n############ 2. crisp-box: fill a circle inscribed in box [10,10)+(20x20)');
for (const [label, cx, cy, r] of [
    ['center (20,20) r=10       (integer center)', 20, 20, 10],
    ['center (20.5,20.5) r=10   (pixel-grid center of a 20-box at 10)', 20.5, 20.5, 10],
    ['center (20,20) r=9.5', 20, 20, 9.5],
    ['center (20.5,20.5) r=9.5', 20.5, 20.5, 9.5]
]) {
    ctx = newCtx();
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.fillCircle(cx, cy, r);
    const g = grid(ctx);
    const b = bboxOf(g);
    const exact = b && b.x0 === 10 && b.y0 === 10 && b.x1 === 29 && b.y1 === 29;
    console.log(
        `  ${label}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}] — ${exact ? 'EXACT [10..29]^2' : 'not the box'}`
    );
}

// ---------------------------------------------------------------------------
// 3. 1px STROKE — spelling grid at identity
// ---------------------------------------------------------------------------
console.log('\n############ 3. strokeCircle 1px spelling grid (identity)');
for (const [cx, cy, r] of [
    [20, 20, 8],
    [20.5, 20.5, 8],
    [20, 20, 8.5],
    [20.5, 20.5, 8.5],
    [20.25, 20.75, 8.75]
]) {
    ctx = newCtx();
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.lineWidth = 1;
    ctx.strokeCircle(cx, cy, r);
    gA = dump(`strokeCircle(${cx}, ${cy}, r=${r}) lw=1`, ctx, { ring: true });

    ctx = newCtx();
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
    gB = dump(`generic arc()+stroke same geometry`, ctx, { quiet: true, ring: true });
    console.log(`    direct-vs-generic diff: ${diffCount(gA, gB)}px`);
}

// Alpha variant junction check (the roundRect arc's alpha-gap class): same ring,
// semi-transparent — any pixel painted twice shows darker; any gap shows lighter.
console.log('\n############ 4. 1px stroke ALPHA overdraw/gap check (rgba 0.5)');
for (const [cx, cy, r] of [
    [20, 20, 8],
    [20.5, 20.5, 8],
    [20, 20, 8.5]
]) {
    ctx = newCtx();
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeCircle(cx, cy, r);
    const img = ctx.getImageData(0, 0, W, H);
    // Count distinct non-background alpha levels: 1 level = uniform coverage
    // (no overdraw, no gap-fills); >1 = some pixels blended twice.
    const levels = new Set();
    for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i + 1] < 250) levels.add(img.data[i + 1]);
    }
    console.log(
        `  strokeCircle(${cx},${cy},r=${r}) alpha=0.5: green levels = {${[...levels].sort((a, b) => a - b)}} ` +
            `${levels.size === 1 ? 'UNIFORM (no overdraw)' : 'NON-UNIFORM (overdraw or AA)'}`
    );
}

// ---------------------------------------------------------------------------
// 5. THICK STROKE — the annulus (title-bar ring geometry, scaled down)
// ---------------------------------------------------------------------------
console.log('\n############ 5. strokeCircle THICK (annulus) spelling grid');
for (const [cx, cy, r, lw] of [
    [20, 20, 14, 4],
    [20.5, 20.5, 14, 4],
    [20.5, 20.5, 13.5, 4],
    [21, 20, 13.6, 1.9] // _paintButtonRing-like fractional geometry (scaled)
]) {
    ctx = newCtx();
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.lineWidth = lw;
    ctx.strokeCircle(cx, cy, r);
    gA = dump(`strokeCircle(${cx}, ${cy}, r=${r}) lw=${lw}`, ctx, { ring: true });

    ctx = newCtx();
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
    gB = dump(`generic arc()+stroke same geometry`, ctx, { quiet: true, ring: true });
    console.log(`    direct-vs-generic diff: ${diffCount(gA, gB)}px`);
}

// ---------------------------------------------------------------------------
// 6. TRANSFORMS — Fizzygum's context shapes: integer translate + uniform scale
// ---------------------------------------------------------------------------
console.log('\n############ 6. transform equivalence (user-space call vs pre-scaled device call)');
function underTransform(setup, draw) {
    const c = newCtx();
    c.save();
    setup(c);
    draw(c);
    c.restore();
    return c;
}

// scale(2): fillCircle(10,10,4) should equal device-space fillCircle(20,20,8)
ctx = underTransform(
    c => c.scale(2, 2),
    c => {
        c.fillStyle = 'rgb(255,0,0)';
        c.fillCircle(10, 10, 4);
    }
);
gA = dump('scale(2) fillCircle(10,10,4)', ctx, { quiet: true });
ctx = newCtx();
ctx.fillStyle = 'rgb(255,0,0)';
ctx.fillCircle(20, 20, 8);
gB = dump('identity fillCircle(20,20,8)', ctx, { quiet: true });
console.log(`    scaled-vs-device diff: ${diffCount(gA, gB)}px (0 = transform is exact pre-multiplication)`);

// translate(3,2)+scale(2): stroke — Fizzygum's _beginLogicalPixelsBox shape
ctx = underTransform(
    c => {
        c.translate(3, 2);
        c.scale(2, 2);
    },
    c => {
        c.strokeStyle = 'rgb(255,0,0)';
        c.lineWidth = 2;
        c.strokeCircle(9, 9, 6);
    }
);
gA = dump('translate(3,2)+scale(2) strokeCircle(9,9,6) lw=2', ctx, { quiet: true, ring: true });
ctx = newCtx();
ctx.strokeStyle = 'rgb(255,0,0)';
ctx.lineWidth = 4;
ctx.strokeCircle(21, 20, 12);
gB = dump('identity strokeCircle(21,20,12) lw=4', ctx, { quiet: true, ring: true });
console.log(`    scaled-vs-device diff: ${diffCount(gA, gB)}px (0 = transform is exact pre-multiplication)`);

// NON-uniform scale — the documented hazard: uniformScale is a geometric mean,
// so the direct path draws a WRONG-RADIUS CIRCLE where an ellipse belongs.
ctx = underTransform(
    c => c.scale(2, 1),
    c => {
        c.fillStyle = 'rgb(255,0,0)';
        c.fillCircle(10, 20, 8);
    }
);
gA = dump('scale(2,1) fillCircle(10,20,8) — direct (WRONG: circle, not ellipse)', ctx, { quiet: true });
ctx = underTransform(
    c => c.scale(2, 1),
    c => {
        c.fillStyle = 'rgb(255,0,0)';
        c.beginPath();
        c.arc(10, 20, 8, 0, 2 * Math.PI);
        c.fill();
    }
);
gB = dump('scale(2,1) arc()+fill — generic (correct ellipse)', ctx, { quiet: true });
console.log(`    direct-vs-generic under NON-uniform scale: ${diffCount(gA, gB)}px (>0 expected — the hazard)`);

// ---------------------------------------------------------------------------
// 7. QUADRANT / CARDINAL pixel check — the QUADRANT_TRIG_EPSILON class
// ---------------------------------------------------------------------------
console.log('\n############ 7. cardinal-point extremes (trig-noise class check)');
// For a Bresenham renderer the four cardinal extremes should be exactly at
// center +/- r with no one-off flooring from cos/sin noise. Verify the bbox
// edges each touch the shape at the expected cardinal pixel(s).
for (const [cx, cy, r] of [
    [20, 20, 8],
    [20.5, 20.5, 8],
    [20, 20, 12]
]) {
    ctx = newCtx();
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.lineWidth = 1;
    ctx.strokeCircle(cx, cy, r);
    const g = grid(ctx);
    const b = bboxOf(g);
    // Where does each extreme row/column touch?
    const topXs = [],
        bottomXs = [],
        leftYs = [],
        rightYs = [];
    for (let x = 0; x < W; x++) {
        if (g[b.y0][x]) topXs.push(x);
        if (g[b.y1][x]) bottomXs.push(x);
    }
    for (let y = 0; y < H; y++) {
        if (g[y][b.x0]) leftYs.push(y);
        if (g[y][b.x1]) rightYs.push(y);
    }
    const fmt = a => (a.length > 5 ? `${a[0]}..${a[a.length - 1]} (${a.length})` : a.join(','));
    console.log(
        `  strokeCircle(${cx},${cy},r=${r}): top y=${b.y0} x=[${fmt(topXs)}], bottom y=${b.y1} x=[${fmt(
            bottomXs
        )}], left x=${b.x0} y=[${fmt(leftYs)}], right x=${b.x1} y=[${fmt(rightYs)}]`
    );
}

console.log('\ndone.');

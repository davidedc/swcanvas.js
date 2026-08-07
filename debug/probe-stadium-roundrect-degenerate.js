// Probe: is a STADIUM (capsule) just fillRoundRect at the degenerate radius
// r = min(w,h)/2? If RoundedRectOpsAA already produces the right pixels there,
// a fillStadium primitive is a thin Context2D entry point over it and inherits
// the whole transform/tier-0/fallback machinery for free.
//
// Measured questions:
//   1. SHAPE: at r = min(w,h)/2, does the fill cover exactly the w-by-h box,
//      with circular caps and no seam/notch where the caps meet? (Compare
//      against an analytically sampled ideal stadium, per-pixel, and report
//      the boundary-band disagreement separately from off-by-far errors.)
//   2. ODD SIZES: min(w,h) odd makes r fractional (x.5) - what does
//      normalizeRadius do to it, and how does the cap apex look?
//   3. ALPHA: one span per row means no double-blend - verify a single
//      blended level at alpha 0.5 (the property the two-circles+rect
//      composition CANNOT give, which is why the primitive exists at all).
//   4. A/B vs Fizzygum's current generic-path composition (two arc()s + rect,
//      single fill) - the P3 recapture blast radius in miniature.
//   5. Transforms: scale(2) pre-multiplication exactness (byte-compare vs the
//      device-space call), vertical AND horizontal orientation.
const SWCanvas = require('../dist/swcanvas.js');

const W = 70,
    H = 70;

function newCtx() {
    const canvas = SWCanvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, W, H);
    return ctx;
}

function grid(ctx) {
    const img = ctx.getImageData(0, 0, W, H);
    const g = [];
    for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            row.push(img.data[i + 1] < 128 ? 1 : 0);
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

// Ideal stadium membership for pixel (px,py) (pixel-center sampling): inside
// the rect body, or within r of a cap center.
function idealStadium(x, y, w, h, px, py) {
    const r = Math.min(w, h) / 2;
    const cx = px + 0.5,
        cy = py + 0.5;
    let c1, c2, bodyOk;
    if (h >= w) {
        c1 = [x + w / 2, y + r];
        c2 = [x + w / 2, y + h - r];
        bodyOk = cx >= x && cx < x + w && cy >= y + r && cy < y + h - r;
    } else {
        c1 = [x + r, y + h / 2];
        c2 = [x + w - r, y + h / 2];
        bodyOk = cy >= y && cy < y + h && cx >= x + r && cx < x + w - r;
    }
    if (bodyOk) return true;
    const d1 = Math.hypot(cx - c1[0], cy - c1[1]);
    const d2 = Math.hypot(cx - c2[0], cy - c2[1]);
    return d1 < r || d2 < r;
}

// Distance of pixel center from the ideal stadium OUTLINE (for classifying
// disagreements as boundary-band vs gross).
function outlineDistance(x, y, w, h, px, py) {
    const r = Math.min(w, h) / 2;
    const cx = px + 0.5,
        cy = py + 0.5;
    let axPts;
    if (h >= w) {
        axPts = [[x + w / 2, Math.min(Math.max(cy, y + r), y + h - r)]];
    } else {
        axPts = [[Math.min(Math.max(cx, x + r), x + w - r), y + h / 2]];
    }
    const [sx, sy] = axPts[0];
    return Math.abs(Math.hypot(cx - sx, cy - sy) - r);
}

function compareToIdeal(label, g, x, y, w, h) {
    let boundary = 0,
        gross = 0,
        grossAt = null;
    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const actual = !!g[py][px];
            const ideal = idealStadium(x, y, w, h, px, py);
            if (actual !== ideal) {
                if (outlineDistance(x, y, w, h, px, py) <= 0.71) boundary++;
                else {
                    gross++;
                    grossAt = grossAt || `(${px},${py})`;
                }
            }
        }
    }
    const b = bboxOf(g);
    const exactBox = b && b.x0 === x && b.y0 === y && b.x1 === x + w - 1 && b.y1 === y + h - 1;
    console.log(
        `  ${label}: bbox ${exactBox ? 'EXACT' : `[${b.x0}..${b.x1}]x[${b.y0}..${b.y1}] vs [${x}..${x + w - 1}]x[${y}..${y + h - 1}]`}, ` +
            `ideal-diff: ${boundary} boundary-band px, ${gross} gross px${grossAt ? ' first at ' + grossAt : ''}`
    );
    return { boundary, gross, exactBox };
}

function diffCount(g1, g2) {
    let d = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g1[y][x] !== g2[y][x]) d++;
    return d;
}

console.log('############ 1+2. fillRoundRect(x,y,w,h,min/2) vs ideal stadium');
const CASES = [
    // [x, y, w, h] - vertical (slider-like), horizontal, even and odd minor axis
    [10, 5, 20, 60],
    [5, 25, 60, 20],
    [10, 5, 21, 60], // odd minor -> r = 10.5
    [5, 25, 60, 21],
    [10, 10, 9, 40], // small odd
    [10, 20, 40, 8] // shallow horizontal
];
for (const [x, y, w, h] of CASES) {
    const r = Math.min(w, h) / 2;
    const ctx = newCtx();
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.fillRoundRect(x, y, w, h, r);
    const g = grid(ctx);
    compareToIdeal(`roundRect ${w}x${h} r=${r}`, g, x, y, w, h);
}

console.log('\n############ 3. alpha uniformity (0.5) - single-blend everywhere?');
for (const [x, y, w, h] of CASES) {
    const r = Math.min(w, h) / 2;
    const ctx = newCtx();
    ctx.fillStyle = 'rgba(255,0,0,0.5)';
    ctx.fillRoundRect(x, y, w, h, r);
    const img = ctx.getImageData(0, 0, W, H);
    const levels = new Set();
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 1] !== 255) levels.add(img.data[i + 1]);
    console.log(
        `  ${w}x${h} r=${r}: levels {${[...levels].sort((a, b) => a - b)}} ` +
            (levels.size === 1 ? 'UNIFORM' : 'NON-UNIFORM')
    );
}

console.log('\n############ 3b. the composition ALTERNATIVE at alpha 0.5 (why it was rejected)');
{
    // fillCircle + fillRect + fillCircle at alpha: double-blends the overlaps.
    const [x, y, w, h] = [10, 5, 20, 60];
    const r = w / 2;
    const ctx = newCtx();
    ctx.fillStyle = 'rgba(255,0,0,0.5)';
    ctx.fillCircle(x + r, y + r, r);
    ctx.fillCircle(x + r, y + h - r, r);
    ctx.fillRect(x, y + r, w, h - 2 * r);
    const img = ctx.getImageData(0, 0, W, H);
    const levels = new Set();
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 1] !== 255) levels.add(img.data[i + 1]);
    console.log(
        `  circle+rect+circle 20x60: levels {${[...levels].sort((a, b) => a - b)}} ` +
            (levels.size === 1 ? 'UNIFORM (?!)' : 'NON-UNIFORM - overlap double-blend, as expected')
    );
}

console.log('\n############ 4. A/B vs the current Fizzygum path composition (generic pipeline)');
for (const [x, y, w, h] of [
    [10, 5, 20, 60],
    [5, 25, 60, 20]
]) {
    const r = Math.min(w, h) / 2;
    const direct = newCtx();
    direct.fillStyle = 'rgb(255,0,0)';
    direct.fillRoundRect(x, y, w, h, r);
    const gA = grid(direct);

    // Fizzygum CircleBoxyAppearance: two full arc() circles + moveTo/lineTo
    // rect, one fill, centers rounded, rect floored.
    const generic = newCtx();
    generic.fillStyle = 'rgb(255,0,0)';
    generic.beginPath();
    let c1, c2, rect;
    if (h >= w) {
        c1 = [Math.round(x + w / 2), Math.round(y + r)];
        c2 = [Math.round(x + w / 2), Math.round(y + h - r)];
        rect = [x, y + r, w, h - 2 * r].map(Math.floor);
    } else {
        c1 = [Math.round(x + r), Math.round(y + h / 2)];
        c2 = [Math.round(x + w - r), Math.round(y + h / 2)];
        rect = [x + r, y, w - 2 * r, h].map(Math.floor);
    }
    generic.arc(c1[0], c1[1], r, 0, 2 * Math.PI);
    generic.arc(c2[0], c2[1], r, 0, 2 * Math.PI);
    generic.moveTo(rect[0], rect[1]);
    generic.lineTo(rect[0] + rect[2], rect[1]);
    generic.lineTo(rect[0] + rect[2], rect[1] + rect[3]);
    generic.lineTo(rect[0], rect[1] + rect[3]);
    generic.closePath();
    generic.fill();
    const gB = grid(generic);
    console.log(`  ${w}x${h}: direct-vs-generic diff ${diffCount(gA, gB)}px`);
}

console.log('\n############ 5. transform pre-multiplication exactness');
{
    const scaled = newCtx();
    scaled.save();
    scaled.translate(3, 2);
    scaled.scale(2, 2);
    scaled.fillStyle = 'rgb(255,0,0)';
    scaled.fillRoundRect(4, 2, 10, 30, 5);
    scaled.restore();
    const gA = grid(scaled);
    const device = newCtx();
    device.fillStyle = 'rgb(255,0,0)';
    device.fillRoundRect(11, 6, 20, 60, 10);
    const gB = grid(device);
    console.log(`  translate(3,2)+scale(2) vs device: diff ${diffCount(gA, gB)}px (0 = exact)`);
}

console.log('\ndone.');

// ---------------------------------------------------------------------------
// 6. THE ANSWER: the dedicated StadiumOps primitive (fillStadium) vs ideal
// ---------------------------------------------------------------------------
console.log('\n############ 6. fillStadium (StadiumOps) vs ideal stadium');
for (const [x, y, w, h] of CASES) {
    const ctx = newCtx();
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.fillStadium(x, y, w, h);
    compareToIdeal(`fillStadium ${w}x${h}`, grid(ctx), x, y, w, h);
}
console.log('\n############ 6b. fillStadium alpha uniformity');
for (const [x, y, w, h] of CASES) {
    const ctx = newCtx();
    ctx.fillStyle = 'rgba(255,0,0,0.5)';
    ctx.fillStadium(x, y, w, h);
    const img = ctx.getImageData(0, 0, W, H);
    const levels = new Set();
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 1] !== 255) levels.add(img.data[i + 1]);
    console.log(
        `  ${w}x${h}: levels {${[...levels].sort((a, b) => a - b)}} ` + (levels.size === 1 ? 'UNIFORM' : 'NON-UNIFORM')
    );
}
console.log('\n############ 6c. fillStadium square === fillCircle (byte compare)');
{
    const a = newCtx();
    a.fillStyle = 'rgb(255,0,0)';
    a.fillStadium(10, 10, 24, 24);
    const b = newCtx();
    b.fillStyle = 'rgb(255,0,0)';
    b.fillCircle(22, 22, 12);
    console.log(`  24x24 square stadium vs fillCircle r=12: diff ${diffCount(grid(a), grid(b))}px (0 = identical)`);
    const c = newCtx();
    c.fillStyle = 'rgb(255,0,0)';
    c.fillStadium(10, 10, 25, 25);
    const d = newCtx();
    d.fillStyle = 'rgb(255,0,0)';
    d.fillCircle(22.5, 22.5, 12.5);
    console.log(`  25x25 square stadium vs fillCircle r=12.5: diff ${diffCount(grid(c), grid(d))}px (0 = identical)`);
}
console.log('\n############ 6d. fillStadium transform exactness');
{
    const scaled = newCtx();
    scaled.save();
    scaled.translate(3, 2);
    scaled.scale(2, 2);
    scaled.fillStyle = 'rgb(255,0,0)';
    scaled.fillStadium(4, 2, 10, 30);
    scaled.restore();
    const device = newCtx();
    device.fillStyle = 'rgb(255,0,0)';
    device.fillStadium(11, 6, 20, 60);
    console.log(`  translate(3,2)+scale(2) vs device: diff ${diffCount(grid(scaled), grid(device))}px (0 = exact)`);
}

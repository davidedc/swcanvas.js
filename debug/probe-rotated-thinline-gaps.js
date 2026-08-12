#!/usr/bin/env node
// S1 spike for the bilinear rotated-composite plan (Fizzygum
// docs/plans/swcanvas-bilinear-rotated-composite-plan.md):
// thin features in a source bitmap disintegrate into dashes under SWCanvas's
// transformed drawImage because the non-axis-aligned path samples nearest-neighbor.
//
// Scenarios (mirroring the Fizzygum island composites):
//   A. 1px line, single rotation +30°        (a plainly rotated island)
//   B. 2px line, single rotation +30°        (control: width 2 > sqrt(2) cannot gap)
//   C. 2px line, rotate -30° into an intermediate canvas, then +30° onto the dest
//      (the compensating wrapper: net ~identity, TWO independent NN resamples)
// Each runs with an integer and a fractional translation (Fizzygum's island CTM
// carries a fractional figure origin).
//
// Expected under NN: gaps > 0 in A and C; B stays gap-free.
// Expected after the bilinear fix: zero gaps everywhere.
const SWCanvas = require('../dist/swcanvas.js');

const SRC_W = 32, SRC_H = 32;
const LINE_Y = 10;
const ANGLE = Math.PI / 6; // 30°
const DST_W = 110, DST_H = 110;

function makeLineSource(lineH) {
  const src = SWCanvas.createCanvas(SRC_W, SRC_H);
  const sctx = src.getContext('2d');
  sctx.fillStyle = 'rgba(0,0,0,1)';
  sctx.fillRect(0, LINE_Y, SRC_W, lineH);
  return src;
}

// Walk the line's centerline through `fwd` (source point -> dest device point),
// dedupe to device pixels, and count pixels with no ink (gaps).
function countGaps(img, fwd, lineH) {
  const seen = new Set();
  let gaps = 0, inked = 0;
  const gapList = [];
  for (let t = 2; t <= SRC_W - 2; t += 0.05) {
    const p = fwd(t, LINE_Y + lineH / 2);
    // a continuous point p lies inside device pixel floor(p) (pixel i covers [i, i+1))
    const dx = Math.floor(p.x), dy = Math.floor(p.y);
    const key = dx + ',' + dy;
    if (seen.has(key)) continue;
    seen.add(key);
    const o = (dy * DST_W + dx) * 4;
    const s = img.data[o] + img.data[o + 1] + img.data[o + 2];
    if (s < 3 * 200) inked++;
    else { gaps++; gapList.push(key); }
  }
  return { total: seen.size, inked, gaps, gapList };
}

function ascii(img, w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const o = (y * DST_W + x) * 4;
      const s = img.data[o] + img.data[o + 1] + img.data[o + 2];
      row += s < 300 ? '#' : (s < 700 ? '+' : '.');
    }
    rows.push(row);
  }
  return rows.join('\n');
}

function scenarioSingle(lineH, tx, ty, label) {
  const src = makeLineSource(lineH);
  const dst = SWCanvas.createCanvas(DST_W, DST_H);
  const ctx = dst.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, DST_W, DST_H);
  ctx.translate(tx, ty);
  ctx.rotate(ANGLE);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, DST_W, DST_H);
  const cos = Math.cos(ANGLE), sin = Math.sin(ANGLE);
  const fwd = (x, y) => ({ x: tx + x * cos - y * sin, y: ty + x * sin + y * cos });
  const r = countGaps(img, fwd, lineH);
  console.log(label + ': centerline px=' + r.total + ' inked=' + r.inked + ' GAPS=' + r.gaps +
    (r.gaps ? '  [' + r.gapList.slice(0, 8).join(' ') + (r.gapList.length > 8 ? ' …' : '') + ']' : ''));
  return { ...r, img };
}

function scenarioDouble(lineH, tx, ty, label) {
  // wrapper model: source --(-30°)--> mid buffer --(+30°)--> dest
  const src = makeLineSource(lineH);
  const MID_W = 90, MID_H = 90;
  const mid = SWCanvas.createCanvas(MID_W, MID_H);
  const mctx = mid.getContext('2d');
  const mtx = 8, mty = 30; // keep the -30°-rotated image on the mid surface
  mctx.translate(mtx, mty);
  mctx.rotate(-ANGLE);
  mctx.drawImage(src, 0, 0);

  const dst = SWCanvas.createCanvas(DST_W, DST_H);
  const ctx = dst.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, DST_W, DST_H);
  ctx.translate(tx, ty);
  ctx.rotate(ANGLE);
  ctx.drawImage(mid, 0, 0);
  const img = ctx.getImageData(0, 0, DST_W, DST_H);

  const c = Math.cos(ANGLE), s = Math.sin(ANGLE);
  const fwd = (x, y) => {
    const mx = mtx + x * c + y * s;      // rotate(-30): x' = x cos + y sin
    const my = mty - x * s + y * c;
    return { x: tx + mx * c - my * s, y: ty + mx * s + my * c };
  };
  const r = countGaps(img, fwd, lineH);
  console.log(label + ': centerline px=' + r.total + ' inked=' + r.inked + ' GAPS=' + r.gaps +
    (r.gaps ? '  [' + r.gapList.slice(0, 8).join(' ') + (r.gapList.length > 8 ? ' …' : '') + ']' : ''));
  return { ...r, img };
}

console.log('--- integer translation ---');
const a1 = scenarioSingle(1, 20, 12, 'A  1px single +30°          (int tx)');
const b1 = scenarioSingle(2, 20, 12, 'B  2px single +30°  control (int tx)');
const c1 = scenarioDouble(2, 12, 6, 'C  2px double -30/+30       (int tx)');
console.log('--- fractional translation ---');
const a2 = scenarioSingle(1, 20.37, 12.61, 'A\' 1px single +30°          (frac tx)');
const b2 = scenarioSingle(2, 20.37, 12.61, 'B\' 2px single +30°  control (frac tx)');
const c2 = scenarioDouble(2, 12.37, 6.61, 'C\' 2px double -30/+30       (frac tx)');

console.log('\nASCII of A (1px single +30°, int tx), top-left 64x44:');
console.log(ascii(a1.img, 64, 44));
console.log('\nASCII of C (2px double, int tx), top-left 80x60:');
console.log(ascii(c1.img, 80, 60));

const reproduced = (a1.gaps + a2.gaps + c1.gaps + c2.gaps) > 0;
console.log('\nS1 verdict: ' + (reproduced ? 'REPRODUCED (gaps at the SWCanvas layer)' : 'NOT reproduced'));
process.exit(reproduced ? 0 : 1);

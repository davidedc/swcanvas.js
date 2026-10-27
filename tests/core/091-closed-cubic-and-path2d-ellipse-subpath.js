// Test: a cubic whose two ends coincide is drawn; a Path2D subpath opened by ellipse() closes on itself
// This file will be concatenated into the main test suite
//
// 1. A cubic Bezier whose end point equals its start point (a loop, a teardrop) has a zero-length
//    chord but a real curve: it fills and strokes exactly like the same loop drawn as its two
//    halves (de Casteljau split at t = 0.5), in the current path and in a Path2D.
// 2. In a Path2D, an ellipse() that opens a subpath starts that subpath, as arc() does: closePath()
//    returns to the ellipse's own first point, never to (0, 0).

test('Closed cubic loop - drawn like its two halves', () => {
    const P = [[50.3, 60.6], [95.3, 30.6], [95.3, 98.6], [50.3, 60.6]];
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const p01 = mid(P[0], P[1]), p12 = mid(P[1], P[2]), p23 = mid(P[2], P[3]);
    const p012 = mid(p01, p12), p123 = mid(p12, p23), m = mid(p012, p123);
    for (const op of ['fill', 'stroke']) {
        const render = (halves) => {
            const canvas = SWCanvas.createCanvas(128, 128);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(P[0][0], P[0][1]);
            if (halves) {
                ctx.bezierCurveTo(p01[0], p01[1], p012[0], p012[1], m[0], m[1]);
                ctx.bezierCurveTo(p123[0], p123[1], p23[0], p23[1], P[3][0], P[3][1]);
            } else {
                ctx.bezierCurveTo(P[1][0], P[1][1], P[2][0], P[2][1], P[3][0], P[3][1]);
            }
            if (op === 'fill') ctx.fill();
            else ctx.stroke();
            return ctx.getImageData(0, 0, 128, 128).data;
        };
        const loop = render(false), halves = render(true);
        let painted = 0;
        for (let i = 3; i < loop.length; i += 4) if (loop[i] > 0) painted++;
        if (painted === 0) throw new Error(`${op} of a cubic whose ends coincide paints nothing`);
        for (let i = 3; i < loop.length; i += 4) {
            if ((loop[i] > 0) !== (halves[i] > 0)) {
                throw new Error(`${op} of the loop differs from its two halves at pixel (${(i >> 2) % 128},${Math.floor((i >> 2) / 128)})`);
            }
        }
    }
});

test('Path2D subpath opened by ellipse() - closePath returns to the ellipse start', () => {
    const canvas = SWCanvas.createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    const path = new SWCanvas.Core.SWPath2D();
    path.ellipse(60, 60, 6, 15, 0.4, 0, 1.5 * Math.PI, false);
    path.closePath();
    ctx.stroke(path);
    const d = ctx.getImageData(0, 0, 100, 100).data;
    for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
            if (d[(y * 100 + x) * 4 + 3] > 0) {
                throw new Error(`pixel (${x},${y}) painted: closePath() drew back to the origin, not to the ellipse's start`);
            }
        }
    }
});

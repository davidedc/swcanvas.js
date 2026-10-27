// Test: a quadratic Bezier whose ends coincide flattens (and a point-sized one draws nothing)
// This file will be concatenated into the main test suite
//
// A quadratic's flatness is its control point's distance from the chord. When the two ends
// coincide there is no chord: the distance is measured from the end point instead, so a curve
// whose three points coincide is a point - flat at once, drawing nothing - and one whose
// control point lies elsewhere (out and back) still flattens. fill(), stroke(), clip() and
// isPointInPath() all go through the flattener, on the current path and as a Path2D.

test('A quadratic whose ends coincide flattens', () => {
    for (const [label, cpx, cpy, strokePixels] of [
        ['three coincident points', 20, 20, false],
        ['out and back', 40, 30, true]
    ]) {
        for (const asPath2D of [false, true]) {
            for (const op of ['fill', 'stroke', 'clip', 'isPointInPath']) {
                const canvas = SWCanvas.createCanvas(64, 64);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                let path;
                if (asPath2D) {
                    path = new SWCanvas.Core.SWPath2D();
                    path.moveTo(20, 20);
                    path.quadraticCurveTo(cpx, cpy, 20, 20);
                } else {
                    ctx.beginPath();
                    ctx.moveTo(20, 20);
                    ctx.quadraticCurveTo(cpx, cpy, 20, 20);
                }
                const where = `${label}, ${asPath2D ? 'Path2D' : 'current path'}, ${op}`;
                try {
                    if (op === 'isPointInPath') {
                        if (asPath2D) ctx.isPointInPath(path, 30, 25);
                        else ctx.isPointInPath(30, 25);
                        continue;
                    }
                    if (op === 'clip') {
                        if (asPath2D) ctx.clip(path);
                        else ctx.clip();
                        ctx.fillRect(0, 0, 64, 64);
                    } else if (asPath2D) {
                        ctx[op](path);
                    } else {
                        ctx[op]();
                    }
                } catch (e) {
                    throw new Error(`${where}: throws ${e.constructor.name}: ${e.message}`);
                }
                const d = ctx.getImageData(0, 0, 64, 64).data;
                let painted = 0;
                for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
                const expectPixels = op === 'stroke' && strokePixels;
                if (expectPixels !== painted > 0) {
                    throw new Error(`${where}: painted ${painted} pixel(s), expected ${expectPixels ? 'some' : 'none'}`);
                }
            }
        }
    }
    log('  quadratics whose ends coincide flatten (fill, stroke, clip, isPointInPath)');
});

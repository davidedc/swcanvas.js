// Test: the direct line and rotated-rect stroke entries paint what stroke() of the same path paints
// This file will be concatenated into the main test suite
//
// strokeLine with butt caps and strokeRect under a rotation have direct rasterizers (thick lines
// as quads, exactly horizontal/vertical lines as rectangles). They cover the pixels whose centres
// lie in the stroke, under the half-open rule every filler uses, so each must paint exactly the
// pixels ctx.stroke() paints for the same line or rect: integer ends (the edges then pass through
// pixel corners and centres), ends that share a pixel row or column without being axis-aligned,
// exact horizontals and verticals, every width above the 1px thin-line convention, at scale 1 and 2.
// One canvas per scale and per entry is reused; a line is drawn, cleared and compared within its
// bounding box grown by 3 device pixels, a rect within the whole canvas.

test('strokeLine (butt) and rotated strokeRect paint what stroke() paints', () => {
    const S = 96;
    function firstDifference(a, b, x0, y0, w) {
        for (let i = 3; i < a.length; i += 4) {
            if ((a[i] > 0) !== (b[i] > 0)) return `pixel (${x0 + ((i >> 2) % w)},${y0 + Math.floor((i >> 2) / w)})`;
        }
        return null;
    }
    // A deterministic, evenly spread sequence in [0, 1) (golden-ratio steps), not a random one
    let phase = 0;
    const rnd = () => (phase = (phase + 0.6180339887498949) % 1);
    const lines = [];
    for (let a = -9; a <= 9; a += 4) {
        for (let b = 0; b <= 9; b += 3) lines.push([40 - a * 2, 40 - b * 2, 40 + a * 2, 40 + b * 2]);
    }
    for (let i = 0; i < 32; i++) {
        const x1 = 20 + rnd() * 50, y1 = 20 + rnd() * 50, ang = rnd() * 6.283, len = 3 + rnd() * 30;
        let x2 = x1 + Math.cos(ang) * len, y2 = y1 + Math.sin(ang) * len;
        if (i % 4 === 1) y2 = Math.floor(y1) + rnd() * 0.99; // same pixel row, not horizontal
        if (i % 4 === 2) x2 = Math.floor(x1) + rnd() * 0.99; // same pixel column, not vertical
        if (i % 8 === 3) y2 = y1; // exactly horizontal
        if (i % 8 === 7) x2 = x1; // exactly vertical
        lines.push([x1, y1, x2, y2]);
    }
    let checked = 0;
    for (const dev of [1, 2]) {
        const N = S * dev;
        const canvases = [0, 1].map(() => {
            const ctx = SWCanvas.createCanvas(N, N).getContext('2d');
            ctx.strokeStyle = '#000';
            return ctx;
        });
        // draws with each entry on its own canvas, the region cleared first (it holds the whole
        // stroke), and returns both reads of the region
        const both = (region, setup, direct, path) =>
            [direct, path].map((draw, k) => {
                const ctx = canvases[k];
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(region[0], region[1], region[2], region[3]);
                ctx.setTransform(dev, 0, 0, dev, 0, 0);
                setup(ctx);
                draw(ctx);
                return ctx.getImageData(region[0], region[1], region[2], region[3]).data;
            });
        for (const lw of [2, 3, 6, 11, 4.7]) {
            for (const [x1, y1, x2, y2] of lines) {
                const m = lw / 2 + 3 / dev;
                const left = Math.max(0, Math.floor((Math.min(x1, x2) - m) * dev));
                const top = Math.max(0, Math.floor((Math.min(y1, y2) - m) * dev));
                const right = Math.min(N, Math.ceil((Math.max(x1, x2) + m) * dev));
                const bottom = Math.min(N, Math.ceil((Math.max(y1, y2) + m) * dev));
                const [direct, path] = both(
                    [left, top, right - left, bottom - top],
                    (ctx) => {
                        ctx.lineWidth = lw;
                        ctx.lineCap = 'butt';
                    },
                    (ctx) => ctx.strokeLine(x1, y1, x2, y2),
                    (ctx) => {
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                );
                const diff = firstDifference(direct, path, left, top, right - left);
                if (diff) {
                    throw new Error(`strokeLine(${x1}, ${y1}, ${x2}, ${y2}) lineWidth ${lw} at scale ${dev}: ${diff} differs from stroke()`);
                }
                checked++;
            }
        }
        for (let i = 0; i < 20; i++) {
            const x = 20 + rnd() * 30, y = 20 + rnd() * 30, w = 5 + rnd() * 30, h = 5 + rnd() * 30;
            const ang = rnd() * 6.283, lw = 1.5 + rnd() * 8;
            const [direct, path] = both(
                [0, 0, N, N],
                (ctx) => {
                    ctx.translate(48, 48);
                    ctx.rotate(ang);
                    ctx.translate(-48, -48);
                    ctx.lineWidth = lw;
                },
                (ctx) => ctx.strokeRect(x, y, w, h),
                (ctx) => {
                    ctx.beginPath();
                    ctx.rect(x, y, w, h);
                    ctx.stroke();
                }
            );
            const diff = firstDifference(direct, path, 0, 0, N);
            if (diff) {
                throw new Error(`strokeRect(${x}, ${y}, ${w}, ${h}) rotated ${ang} lineWidth ${lw} at scale ${dev}: ${diff} differs from rect() + stroke()`);
            }
            checked++;
        }
    }
    log(`  ${checked} direct strokes identical to stroke()`);
});

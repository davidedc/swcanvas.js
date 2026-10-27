// Test: a round-capped segment is seamless - no unpainted pixel between its caps and its body
// This file will be concatenated into the main test suite
//
// A single round-capped segment is a convex capsule, so under pixel-center
// sampling every row and every column of what it paints is ONE unbroken run. A
// pixel left unpainted inside it lies on a seam: where a cap meets the body, two
// polygons share an edge (traversed opposite ways), and the filler must cross it
// at the same x from both sides or a pixel center on it falls between the two
// spans. Swept like an analog clock's hands: integer ends on a circle at 60
// angles, widths 4..8, two lengths, four face sizes.

test('Round-capped segment - seamless capsule', () => {
    function render(width, height, setup, paths) {
        const canvas = SWCanvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#000';
        setup(ctx);
        for (const subpaths of paths) {
            ctx.beginPath();
            for (const pts of subpaths) {
                pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
            }
            ctx.stroke();
        }
        return ctx.getImageData(0, 0, width, height).data;
    }

    let capsules = 0;
    for (const side of [40, 60, 80, 120]) {
        const C = side / 2 + 4;
        const W = 2 * C;
        for (let lw = 4; lw <= 8; lw++) {
            for (const len of [0.27, 0.37]) {
                for (let k = 0; k < 60; k++) {
                    const a = (k * 2 * Math.PI) / 60;
                    const tip = len * side;
                    const x2 = C + Math.round(tip * Math.sin(a));
                    const y2 = C + Math.round(-tip * Math.cos(a));
                    const d = render(
                        W,
                        W,
                        (ctx) => {
                            ctx.lineWidth = lw;
                            ctx.lineCap = 'round';
                        },
                        [[[[C, C], [x2, y2]]]]
                    );
                    const ink = (x, y) => d[(y * W + x) * 4] < 128;
                    for (let pass = 0; pass < 2; pass++) {
                        for (let u = 0; u < W; u++) {
                            let runs = 0;
                            let prev = false;
                            for (let v = 0; v < W; v++) {
                                const on = pass === 0 ? ink(v, u) : ink(u, v);
                                if (on && !prev) runs++;
                                prev = on;
                            }
                            if (runs > 1) {
                                throw new Error(
                                    `round-capped segment (${C},${C})-(${x2},${y2}) lw=${lw}: ${pass === 0 ? 'row' : 'column'} ` +
                                        `${u} paints ${runs} separate runs - an unpainted seam inside the capsule`
                                );
                            }
                        }
                    }
                    capsules++;
                }
            }
        }
    }
    log(`  ${capsules} capsules seamless`);
});

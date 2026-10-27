// Test: a round cap or round join stays within the flattening tolerance of its circle
// This file will be concatenated into the main test suite
//
// Round caps and round joins are arcs of radius lineWidth / 2 about the line's end or the joint,
// flattened into chords. Like a path's own arcs they get as many chords as keep every chord within
// a quarter device pixel of the circle, however wide the line and whatever the scale: so every
// pixel whose centre lies more than 0.26 px inside the circle (and outside the segment bodies,
// which are exact) is painted. Fixed 45-degree chords fall short by 0.076 * radius - 0.84 px for
// an 11 px radius.

test('Round caps and joins - within a quarter pixel of their circles', () => {
    let checked = 0;
    for (const dev of [1, 2]) {
        for (const lw of [4, 8, 12, 22, 40]) {
            const h = lw / 2;
            for (const kind of ['cap', 'join']) {
                for (const ang of [0, 0.3, 0.785, 1.2, 2.9]) {
                    const S = 4 * lw + 40;
                    const canvas = SWCanvas.createCanvas(S * dev, S * dev);
                    const ctx = canvas.getContext('2d');
                    if (dev === 2) ctx.scale(2, 2);
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = lw;
                    ctx.lineCap = kind === 'cap' ? 'round' : 'butt';
                    ctx.lineJoin = 'round';
                    const c = S / 2 + 0.3;
                    const ux = Math.cos(ang), uy = Math.sin(ang);
                    ctx.beginPath();
                    if (kind === 'cap') {
                        ctx.moveTo(c - ux * lw, c - uy * lw); // the cap sits at (c, c), the line comes from behind
                        ctx.lineTo(c, c);
                    } else {
                        ctx.moveTo(c - ux * lw, c - uy * lw); // a right-angle turn at (c, c)
                        ctx.lineTo(c, c);
                        ctx.lineTo(c - uy * lw, c + ux * lw);
                    }
                    ctx.stroke();
                    const N = S * dev;
                    const d = ctx.getImageData(0, 0, N, N).data;
                    for (let j = 0; j < N; j++) {
                        for (let i = 0; i < N; i++) {
                            const px = (i + 0.5) / dev - c, py = (j + 0.5) / dev - c;
                            const along = px * ux + py * uy; // past the end of the first segment
                            if (along <= 0) continue;
                            if (kind === 'join' && px * -uy + py * ux >= 0) continue; // inside the second body
                            if (Math.hypot(px, py) * dev > h * dev - 0.26) continue;
                            checked++;
                            if (d[(j * N + i) * 4 + 3] === 0) {
                                throw new Error(
                                    `round ${kind} lineWidth ${lw} at scale ${dev}, direction ${ang}: pixel (${i},${j}) lies ` +
                                        `${(h * dev - Math.hypot(px, py) * dev).toFixed(2)} device px inside the circle, unpainted`
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    log(`  ${checked} pixel centres inside round caps and joins painted`);
});

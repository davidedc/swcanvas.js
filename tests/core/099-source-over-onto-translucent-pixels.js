// Test: source-over and destination-over onto a partially transparent pixel
// follow Porter-Duff on every paint path
// This file will be concatenated into the main test suite
//
// SWCanvas surfaces hold straight RGBA, so compositing a translucent source S
// over a translucent destination D must weigh D's colour by D's own alpha:
// alpha = Sa + Da(1 - Sa), colour = (Sc Sa + Dc Da (1 - Sa)) / alpha. Checked
// against that formula, premultiplied (the colour each pixel contributes once
// composited), within 1.5 levels (the stored 8-bit result and the colour's own
// 8-bit components each round), for a grid of source and destination alphas,
// through fillRect, fill(), stroke(), drawImage, a pattern fill and
// destination-over.

test('source-over / destination-over onto translucent pixels follow Porter-Duff on every path', () => {
    const dstColour = [20, 200, 60];
    const srcColour = [230, 40, 180];

    function exact(sc, sa, dc, da) {
        const a = sa / 255;
        const b = da / 255;
        const outA = a + b * (1 - a);
        return [0, 1, 2].map(i => (sc[i] * a + dc[i] * b * (1 - a)) / outA).concat([outA * 255]);
    }

    function texel(c, a) {
        const canvas = SWCanvas.createCanvas(1, 1);
        const ctx = canvas.getContext('2d');
        const id = ctx.createImageData(1, 1);
        id.data[0] = c[0];
        id.data[1] = c[1];
        id.data[2] = c[2];
        id.data[3] = a;
        ctx.putImageData(id, 0, 0);
        return canvas;
    }

    const css = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a / 255})`;

    // The destination pixels, written exactly (straight RGBA).
    function fillData(ctx, c, a) {
        const id = ctx.createImageData(8, 8);
        for (let i = 0; i < id.data.length; i += 4) {
            id.data[i] = c[0];
            id.data[i + 1] = c[1];
            id.data[i + 2] = c[2];
            id.data[i + 3] = a;
        }
        return id;
    }
    const paths = {
        fillRect: (ctx, a) => {
            ctx.fillStyle = css(srcColour, a);
            ctx.fillRect(0, 0, 8, 8);
        },
        'fill()': (ctx, a) => {
            ctx.fillStyle = css(srcColour, a);
            ctx.beginPath();
            ctx.rect(0, 0, 8, 8);
            ctx.fill();
        },
        'stroke()': (ctx, a) => {
            ctx.strokeStyle = css(srcColour, a);
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(0, 4);
            ctx.lineTo(8, 4);
            ctx.stroke();
        },
        drawImage: (ctx, a) => {
            ctx.drawImage(texel(srcColour, a), 0, 0, 8, 8);
        },
        pattern: (ctx, a) => {
            ctx.fillStyle = ctx.createPattern(texel(srcColour, a), 'repeat');
            ctx.fillRect(0, 0, 8, 8);
        }
    };

    for (const name of Object.keys(paths)) {
        let worst = 0;
        let where = '';
        for (const da of [3, 40, 128, 220]) {
            for (const sa of [5, 64, 128, 200]) {
                const ctx = SWCanvas.createCanvas(8, 8).getContext('2d');
                ctx.putImageData(fillData(ctx, dstColour, da), 0, 0);
                paths[name](ctx, sa);
                const d = ctx.getImageData(4, 4, 1, 1).data;
                const e = exact(srcColour, sa, dstColour, da);
                for (let k = 0; k < 4; k++) {
                    const off = k < 3 ? Math.abs((d[k] * d[3]) / 255 - (e[k] * e[3]) / 255) : Math.abs(d[3] - e[3]);
                    if (off > worst) {
                        worst = off;
                        where = ` (Sa ${sa} over Da ${da}: got ${Array.from(d)}, exact ${e.map(Math.round)})`;
                    }
                }
            }
        }
        if (worst > 1.5) throw new Error(`${name}: ${worst.toFixed(1)} levels from Porter-Duff` + where);
    }

    // destination-over: the destination stays on top
    let worst = 0;
    for (const da of [3, 40, 128, 220]) {
        for (const sa of [5, 64, 128, 200]) {
            const ctx = SWCanvas.createCanvas(8, 8).getContext('2d');
            ctx.putImageData(fillData(ctx, dstColour, da), 0, 0);
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = css(srcColour, sa);
            ctx.fillRect(0, 0, 8, 8);
            const d = ctx.getImageData(4, 4, 1, 1).data;
            const e = exact(dstColour, da, srcColour, sa);
            for (let k = 0; k < 4; k++) {
                const off = k < 3 ? Math.abs((d[k] * d[3]) / 255 - (e[k] * e[3]) / 255) : Math.abs(d[3] - e[3]);
                worst = Math.max(worst, off);
            }
        }
    }
    if (worst > 1.5) throw new Error(`destination-over: ${worst.toFixed(1)} levels from Porter-Duff`);
});

// Test: Gradient fill of the current default path under a non-identity transform
// This file will be concatenated into the main test suite
//
// Regression guard. The current default path is recorded in DEVICE space (the CTM
// is baked into each path point at build time). fill() used to draw that path under
// IDENTITY, which starved a gradient/pattern fillStyle of the CTM: the paint source
// is specified in draw-time USER space and must be mapped to device space by the CTM
// (exactly like the path). The result was that a linear-gradient fill of a path drawn
// under scale()/translate() collapsed to (mostly) a single color stop, while the SAME
// gradient via fillRect() rendered correctly. fill() now maps the path back to user
// space and draws under the CTM (like stroke()), so path + paint share one transform.
//
// This test locks in two properties under a translate()+scale() CTM:
//   (1) beginPath()+rect()+fill()  ==  fillRect()   (paint parity, exact at interior px)
//   (2) the gradient actually VARIES down the fill (anti-collapse)

test('Linear gradient current-path fill matches fillRect under transform', () => {
    // Draw a vertical red->lime->blue gradient into a 100x100 box placed at (20,20)
    // and scaled 2x, once via fillRect (reference path) and once via the current
    // default path fill(). Sample an interior device column and compare.
    function render(useCurrentPathFill) {
        const canvas = SWCanvas.createCanvas(220, 220);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 220, 220);

        ctx.translate(20, 20);
        ctx.scale(2, 2); // local (0,0)-(100,100) -> device (20,20)-(220,220)

        const g = ctx.createLinearGradient(0, 0, 0, 100);
        g.addColorStop(0, 'red');
        g.addColorStop(0.5, 'lime');
        g.addColorStop(1, 'blue');
        ctx.fillStyle = g;

        if (useCurrentPathFill) {
            ctx.beginPath();
            ctx.rect(0, 0, 100, 100);
            ctx.fill();
        } else {
            ctx.fillRect(0, 0, 100, 100);
        }

        const surface = canvas._coreSurface;
        const px = (x, y) => {
            const o = (y * surface.stride) + (x * 4);
            return [surface.data[o], surface.data[o + 1], surface.data[o + 2]];
        };
        // Interior device column x=120 (local 50); interior rows (no AA on this column).
        const ys = [40, 90, 140, 190];
        return { surface, samples: ys.map(y => px(120, y)) };
    }

    const ref = render(false);           // fillRect reference
    const cur = render(true);            // current-path fill()

    savePNG(cur.surface, 'gradient-fill-path-under-transform.fill.png',
            'current-path gradient fill under transform', SWCanvas);
    savePNG(ref.surface, 'gradient-fill-path-under-transform.fillRect.png',
            'fillRect gradient reference under transform', SWCanvas);

    // (1) Paint parity: fill() must match fillRect() exactly at interior pixels.
    for (let i = 0; i < ref.samples.length; i++) {
        const a = ref.samples[i], b = cur.samples[i];
        for (let c = 0; c < 3; c++) {
            if (a[c] !== b[c]) {
                throw new Error(
                    `current-path fill() must equal fillRect() under a transform; ` +
                    `sample ${i} channel ${c}: fillRect=[${a}] fill=[${b}] ` +
                    `(gradient dropped the CTM in fill())`);
            }
        }
    }

    // (2) Anti-collapse: the gradient must vary strongly from top to bottom of the
    // fill (the bug collapsed the lower portion to a single stop).
    const top = cur.samples[0];                          // near red
    const bottom = cur.samples[cur.samples.length - 1];  // near blue
    if (top[0] - bottom[0] < 150) {
        throw new Error(`gradient did not vary down the fill: top=[${top}] bottom=[${bottom}] ` +
                        `(expected a red->blue ramp; a collapse means the CTM was dropped)`);
    }
    if (bottom[2] - top[2] < 150) {
        throw new Error(`gradient blue channel did not ramp up toward the bottom: ` +
                        `top=[${top}] bottom=[${bottom}]`);
    }

    // (3) Sanity: also exercise the pure-translate trigger (translation >= the
    // gradient's coordinate span used to push every device pixel past the gradient
    // and collapse to the first stop).
    const canvas = SWCanvas.createCanvas(200, 260);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 200, 260);
    ctx.translate(40, 150); // well beyond the gradient's 0..100 span
    const g = ctx.createLinearGradient(0, 0, 0, 100);
    g.addColorStop(0, 'red');
    g.addColorStop(1, 'blue');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.rect(0, 0, 100, 100);
    ctx.fill();
    const s = canvas._coreSurface;
    const at = (x, y) => { const o = (y * s.stride) + (x * 4); return [s.data[o], s.data[o + 1], s.data[o + 2]]; };
    const t = at(90, 150 + 5), bm = at(90, 150 + 95); // device rows near local top/bottom
    if (t[0] - bm[0] < 150 || bm[2] - t[2] < 150) {
        throw new Error(`gradient collapsed under pure translate: top=[${t}] bottom=[${bm}]`);
    }
});

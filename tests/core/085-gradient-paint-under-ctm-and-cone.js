// Test: gradients are evaluated in gradient (user) space under ANY CTM, and the
// radial gradient is the HTML5 two-circle cone
// This file will be concatenated into the main test suite
//
// HTML5: "the resulting gradient must then be transformed as described by the
// current transformation matrix when rendering" - the CTM maps the WHOLE
// gradient (radii, angles, isolines), not just its defining points. Contract
// pinned here:
//   1. TWINS: a gradient drawn under a CTM equals the same picture drawn under
//      identity with the CTM folded into the gradient's own coordinates
//      (radial under scale and rotation, focal radial under scale, linear
//      under uniform AND non-uniform scale, conic under rotation);
//   2. a radial gradient under a NON-uniform scale is an ellipse: points at the
//      same gradient-space distance from the centre share a colour along both
//      axes;
//   3. the radial cone: a point no circle r(w) >= 0 passes through stays
//      transparent black;
//   4. degenerate gradients (a zero-length linear line, two identical radial
//      circles) paint nothing - and creating them does not throw.
// Comparisons allow 1-3 levels: the twins sample the same function along two
// floating-point routes.

test('gradients under the CTM and the radial cone', () => {
    const W = 200;
    const H = 150;

    function stops(g) {
        g.addColorStop(0, 'rgba(255,200,0,0.9)');
        g.addColorStop(0.5, 'rgb(200,0,120)');
        g.addColorStop(1, 'rgba(0,80,255,0.2)');
        return g;
    }

    function render(draw) {
        const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
        draw(ctx);
        return ctx.getImageData(0, 0, W, H).data;
    }

    function maxDiff(a, b) {
        let max = 0;
        for (let i = 0; i < a.length; i++) {
            const d = Math.abs(a[i] - b[i]);
            if (d > max) max = d;
        }
        return max;
    }

    function assertTwins(label, withCtm, folded, tolerance) {
        const d = maxDiff(render(withCtm), render(folded));
        if (d > tolerance) {
            throw new Error(label + ': CTM render differs from its folded twin by ' + d + ' levels (tolerance ' + tolerance + ')');
        }
    }

    // 1. Twins
    assertTwins('radial under scale(2)',
        ctx => {
            ctx.scale(2, 2);
            ctx.fillStyle = stops(ctx.createRadialGradient(50, 37.5, 5, 50, 37.5, 35));
            ctx.fillRect(0, 0, W / 2, H / 2);
        },
        ctx => {
            ctx.fillStyle = stops(ctx.createRadialGradient(100, 75, 10, 100, 75, 70));
            ctx.fillRect(0, 0, W, H);
        }, 1);
    assertTwins('radial stroke under scale(2)',
        ctx => {
            ctx.scale(2, 2);
            ctx.strokeStyle = stops(ctx.createRadialGradient(50, 37.5, 5, 50, 37.5, 35));
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.arc(50, 37.5, 25, 0, Math.PI * 2);
            ctx.stroke();
        },
        ctx => {
            ctx.strokeStyle = stops(ctx.createRadialGradient(100, 75, 10, 100, 75, 70));
            ctx.lineWidth = 24;
            ctx.beginPath();
            ctx.arc(100, 75, 50, 0, Math.PI * 2);
            ctx.stroke();
        }, 1);
    assertTwins('focal radial under scale(2)',
        ctx => {
            ctx.scale(2, 2);
            ctx.fillStyle = stops(ctx.createRadialGradient(35, 30, 2.5, 50, 37.5, 35));
            ctx.fillRect(0, 0, W / 2, H / 2);
        },
        ctx => {
            ctx.fillStyle = stops(ctx.createRadialGradient(70, 60, 5, 100, 75, 70));
            ctx.fillRect(0, 0, W, H);
        }, 1);
    assertTwins('linear under scale(2)',
        ctx => {
            ctx.scale(2, 2);
            ctx.fillStyle = stops(ctx.createLinearGradient(10, 5, 90, 70));
            ctx.fillRect(0, 0, W / 2, H / 2);
        },
        ctx => {
            ctx.fillStyle = stops(ctx.createLinearGradient(20, 10, 180, 140));
            ctx.fillRect(0, 0, W, H);
        }, 1);
    {
        // linear under scale(2, 1): the image of a linear gradient is linear,
        // starting at M*p0 and running along M^-T*d, rescaled so t matches.
        const sx = 2;
        const sy = 1;
        const p0 = [10, 10];
        const p1 = [90, 140];
        const d = [p1[0] - p0[0], p1[1] - p0[1]];
        const len2 = d[0] * d[0] + d[1] * d[1];
        const g = [d[0] / sx / len2, d[1] / sy / len2]; // M^-T d / |d|^2
        const g2 = g[0] * g[0] + g[1] * g[1];
        const q0 = [p0[0] * sx, p0[1] * sy];
        const q1 = [q0[0] + g[0] / g2, q0[1] + g[1] / g2];
        assertTwins('linear under non-uniform scale(2, 1)',
            ctx => {
                ctx.scale(sx, sy);
                ctx.fillStyle = stops(ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]));
                ctx.fillRect(0, 0, W / sx, H / sy);
            },
            ctx => {
                ctx.fillStyle = stops(ctx.createLinearGradient(q0[0], q0[1], q1[0], q1[1]));
                ctx.fillRect(0, 0, W, H);
            }, 1);
    }
    assertTwins('conic under rotate(0.6)',
        ctx => {
            ctx.translate(100, 75);
            ctx.rotate(0.6);
            ctx.fillStyle = stops(ctx.createConicGradient(0.3, 0, 0));
            ctx.fillRect(-200, -200, 400, 400);
        },
        ctx => {
            ctx.fillStyle = stops(ctx.createConicGradient(0.9, 100, 75));
            ctx.fillRect(0, 0, W, H);
        }, 1);

    // 2. Radial under scale(2, 1) is an ellipse. Gradient centre at user
    // (50.25, 75.5): device pixel (100 + 2k, 75) and device pixel (100, 75 + k)
    // both sit k gradient-space units from it, sampled at their pixel centres.
    {
        const data = render(ctx => {
            ctx.scale(2, 1);
            ctx.fillStyle = stops(ctx.createRadialGradient(50.25, 75.5, 5, 50.25, 75.5, 60));
            ctx.fillRect(0, 0, W / 2, H);
        });
        for (let k = 8; k <= 48; k += 8) {
            const ox = (75 * W + 100 + 2 * k) * 4;
            const oy = ((75 + k) * W + 100) * 4;
            for (let c = 0; c < 4; c++) {
                const delta = Math.abs(data[ox + c] - data[oy + c]);
                if (delta > 3) {
                    throw new Error('radial under scale(2, 1): gradient distance ' + k + ' differs by ' + delta + ' levels between the x and y axes (expected an ellipse)');
                }
            }
        }
    }

    // 3. The radial cone: start circle (50,75) r10, end circle (150,75) r30.
    // (100, 5) lies on no circle with r >= 0 -> transparent; (10, 75), behind
    // the start circle on the axis, is reached only for w < 0 -> the first
    // stop; (150, 75), the end circle's centre, only for w > 1 -> the last stop.
    {
        const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
        ctx.fillStyle = stops(ctx.createRadialGradient(50, 75, 10, 150, 75, 30));
        ctx.fillRect(0, 0, W, H);
        assertEquals(ctx.getImageData(100, 5, 1, 1).data[3], 0, 'cone: (100,5) is outside the cone');
        assertEquals(ctx.getImageData(10, 75, 1, 1).data[3], 230, 'cone: behind the start circle = first stop alpha');
        assertEquals(ctx.getImageData(150, 75, 1, 1).data[3], 51, 'cone: end circle centre = last stop alpha');
    }

    // 4. Degenerate gradients paint nothing.
    {
        const ctx = SWCanvas.createCanvas(40, 40).getContext('2d');
        const lin = ctx.createLinearGradient(20, 20, 20, 20);
        lin.addColorStop(0, 'red');
        lin.addColorStop(1, 'blue');
        ctx.fillStyle = lin;
        ctx.fillRect(0, 0, 40, 40);
        assertEquals(ctx.getImageData(5, 5, 1, 1).data[3], 0, 'zero-length linear gradient paints nothing');

        let rad;
        try {
            rad = ctx.createRadialGradient(20, 20, 10, 20, 20, 10);
        } catch (e) {
            throw new Error('createRadialGradient with identical circles must not throw: ' + e.message);
        }
        rad.addColorStop(0, 'red');
        rad.addColorStop(1, 'blue');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, 40, 40);
        assertEquals(ctx.getImageData(20, 20, 1, 1).data[3], 0, 'identical radial circles paint nothing');
    }
});

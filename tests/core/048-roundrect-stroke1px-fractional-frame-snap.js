// Test: strokeRoundRect 1px - arbitrary fractional coordinates snap to one coherent frame
// This file will be concatenated into the main test suite
//
// Every 1px rounded-rect stroke derives ALL of its geometry (edge runs and
// corner centers) from one snapped device-pixel frame. Consequently any
// fractional spelling must render byte-identically to the integer spelling of
// the same frame - there is no coordinate at which edges and corners can snap
// to different lines. Fractions below .5 share the integer call's frame;
// fractions at .5 grow the frame by one (rightX/bottomY floor differently),
// which test 046 covers.

test('RoundRect stroke1px - fractional coordinates snap to the integer frame', () => {
    const W = 90;
    const H = 60;

    function renderStroke(x, y, w, h, r, alpha) {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        ctx.setStrokeStyle(255, 0, 0, alpha);
        ctx.lineWidth = 1;
        ctx.strokeRoundRect(x, y, w, h, r);
        return surface;
    }

    for (const alpha of [255, 128]) {
        for (const r of [1, 3, 5, 10]) {
            // 10.25/8.25: leftX=10, topY=8, rightX=floor(37.75)=37, bottomY=29 -
            // exactly the frame of the plain integer call.
            const frac = renderStroke(10.25, 8.25, 28, 22, r, alpha);
            const int_ = renderStroke(10, 8, 28, 22, r, alpha);
            for (let i = 0; i < frac.data.length; i++) {
                if (frac.data[i] !== int_.data[i]) {
                    const pixel = Math.floor(i / 4);
                    throw new Error(
                        `alpha=${alpha} r=${r}: fractional (.25) and integer spellings differ at ` +
                            `(${pixel % W},${Math.floor(pixel / W)})`
                    );
                }
            }
            log(`  alpha=${alpha} r=${r}: .25-fractional spelling === integer frame`);
        }
    }
});

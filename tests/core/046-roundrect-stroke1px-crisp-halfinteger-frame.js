// Test: strokeRoundRect 1px crisp rendering - half-integer (pixel-centered) frame contract
// This file will be concatenated into the main test suite
//
// The standard HTML5 crisp-1px-stroke idiom places the stroke path on *.5
// coordinates. The 1px rounded-rect fast path snaps the stroke onto one
// device-pixel frame (leftX/topY/rightX/bottomY) and derives BOTH the edge runs
// and the corner centers from it, so the corners join the edges exactly like
// they do for integer input. This test pins that contract:
//   1. exact enclosing bounds (the snapped frame, no stray pixels),
//   2. exactly 2 colors on the surface (background + stroke - crisp, no fringe),
//   3. closed single ring (every stroke pixel has >= 2 of 8 neighbors),
//   4. mirror symmetry in both axes (corners not lopsided),
//   5. frame equivalence: the half-integer spelling renders byte-identically
//      to the integer spelling that covers the same snapped frame.

test('RoundRect stroke1px crisp - half-integer frame contract', () => {
    const W = 90;
    const H = 60;

    function renderStroke(x, y, w, h, r) {
        const surface = SWCanvas.Core.Surface(W, H);
        const ctx = new SWCanvas.Core.Context2D(surface);
        ctx.setFillStyle(255, 255, 255, 255);
        ctx.fillRect(0, 0, W, H);
        ctx.setStrokeStyle(255, 0, 0, 255);
        ctx.lineWidth = 1;
        ctx.strokeRoundRect(x, y, w, h, r);
        return surface;
    }

    function strokePixelSet(surface) {
        const set = new Set();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                if (surface.data[o] === 255 && surface.data[o + 1] === 0) {
                    set.add(y * W + x);
                }
            }
        }
        return set;
    }

    for (const r of [1, 2, 3, 5, 8, 10]) {
        // Half-integer spelling: path on *.5, frame = cols 10..38, rows 8..30
        const surface = renderStroke(10.5, 8.5, 28, 22, r);
        const stroke = strokePixelSet(surface);

        // 1. Exact enclosing bounds - the snapped frame, nothing outside, all
        //    four frame lines reached (crisp alignment, no faint strays possible
        //    on this non-antialiased engine).
        let minX = W, maxX = -1, minY = H, maxY = -1;
        for (const p of stroke) {
            const px = p % W;
            const py = (p - px) / W;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        }
        if (minX !== 10 || maxX !== 38 || minY !== 8 || maxY !== 30) {
            throw new Error(
                `r=${r}: bounds (${minX}..${maxX}, ${minY}..${maxY}) != expected (10..38, 8..30)`
            );
        }

        // 2. Exactly 2 colors on the whole surface: white + pure stroke red.
        const colors = new Set();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const o = y * surface.stride + x * 4;
                colors.add(
                    (surface.data[o] << 16) | (surface.data[o + 1] << 8) | surface.data[o + 2]
                );
            }
        }
        if (colors.size !== 2) {
            throw new Error(`r=${r}: expected exactly 2 colors, found ${colors.size}`);
        }

        // 3. Closed ring: every stroke pixel has at least 2 stroke neighbors
        //    (8-connectivity). A single missing junction pixel leaves two pixels
        //    with only 1 neighbor, so this catches edge/corner tearing exactly.
        for (const p of stroke) {
            const px = p % W;
            const py = (p - px) / W;
            let neighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (stroke.has((py + dy) * W + (px + dx))) neighbors++;
                }
            }
            if (neighbors < 2) {
                throw new Error(
                    `r=${r}: stroke pixel (${px},${py}) has ${neighbors} neighbor(s) - ring is torn`
                );
            }
        }

        // 4. Mirror symmetry about the frame center (cols 10+38, rows 8+30):
        //    a corner arc snapped against a different line than its mirror twin
        //    shows up here immediately.
        for (const p of stroke) {
            const px = p % W;
            const py = (p - px) / W;
            if (!stroke.has(py * W + (48 - px))) {
                throw new Error(`r=${r}: (${px},${py}) breaks horizontal mirror symmetry`);
            }
            if (!stroke.has((38 - py) * W + px)) {
                throw new Error(`r=${r}: (${px},${py}) breaks vertical mirror symmetry`);
            }
        }

        // 5. Frame equivalence: integer spelling covering the same snapped frame
        //    (leftX 10, topY 8, rightX floor(10+29-0.5)=38, bottomY 30) must
        //    produce byte-identical output.
        const intSurface = renderStroke(10, 8, 29, 23, r);
        for (let i = 0; i < surface.data.length; i++) {
            if (surface.data[i] !== intSurface.data[i]) {
                const pixel = Math.floor(i / 4);
                throw new Error(
                    `r=${r}: half-integer and same-frame integer spellings differ at ` +
                        `(${pixel % W},${Math.floor(pixel / W)})`
                );
            }
        }

        log(`  r=${r}: bounds exact, 2 colors, closed ring, symmetric, frame-equivalent`);
    }

    const showcase = renderStroke(10.5, 8.5, 28, 22, 5);
    savePNG(showcase, 'roundrect-stroke1px-halfinteger-crisp.basic.png', 'half-integer crisp 1px rounded-rect stroke', SWCanvas);
});

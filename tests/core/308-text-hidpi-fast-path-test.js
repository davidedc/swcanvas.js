// Test: the HiDPI direct-blit fast path renders real density-2 glyph pixels.
// With ctx.scale(dpr,dpr) + textPixelDensity = dpr, the net transform is
// [dpr,0,0,dpr,e,f] → TextRenderer's fast path (uniform scale == atlas
// density), which blits straight to the backing surface with no intermediate
// buffer. The runner preloads Arial 16 at density 2 (font-assets/_smoke/), so
// glyph pixels are real, not placeholders. The backing surface is sized at
// physical pixels (CSS × dpr).

// Helper: count canvas pixels that differ from white (255,255,255,255).
function countNonWhitePixels(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255 || data[i + 3] !== 255) n++;
    }
    return n;
}

// Render "A" at the given density through the scale==density fast path and
// return the resulting ink-pixel count. dpr=1 takes the original
// identity-translate fast path; dpr=2 takes the generalized HiDPI fast path.
function inkForDensity(dpr) {
    const cssW = 40, cssH = 24;
    const canvas = SWCanvas.createCanvas(cssW * dpr, cssH * dpr);  // physical px
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, cssW * dpr, cssH * dpr);

    ctx.scale(dpr, dpr);            // [dpr,0,0,dpr,0,0] → fast path
    ctx.textPixelDensity = dpr;
    ctx.font = '16px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('A', 4, 18);

    return countNonWhitePixels(ctx, cssW * dpr, cssH * dpr);
}

test('density-2 fillText (scale == density) writes glyph pixels via the fast path', () => {
    const ink = inkForDensity(2);
    if (ink < 1) {
        throw new Error('Expected glyph pixels from density-2 fast-path fillText("A"); got ' + ink);
    }
});

test('density-2 fast-path glyph carries more ink than the density-1 glyph (correct atlas + scale)', () => {
    // Same logical "A" at 16px: density-2 renders from the 2×-resolution atlas
    // into a physical-pixel surface, so it has substantially more ink than the
    // density-1 render (~2× linear ≈ ~4× pixels). This confirms the fast path
    // actually uses the density-2 atlas and applies the density scale, rather
    // than falling back to the density-1 glyph at the wrong size.
    const ink1 = inkForDensity(1);
    const ink2 = inkForDensity(2);
    if (ink1 < 1) {
        throw new Error('Expected density-1 ink pixels as a baseline; got ' + ink1);
    }
    if (ink2 <= ink1) {
        throw new Error(`Expected density-2 ink (${ink2}) to exceed density-1 ink (${ink1})`);
    }
});

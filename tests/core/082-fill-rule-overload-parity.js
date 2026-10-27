// Test: the HTML5 (path?, fillRule?) overload of fill / clip / isPointInPath
// This file will be concatenated into the main test suite
//
// fill(), clip() and isPointInPath() share one HTML5 overload shape: an optional
// Path2D followed by an optional fill rule, where a LEADING string is the rule
// and an explicitly passed undefined means "omitted" (WebIDL). Contract pinned
// here, on BOTH API layers:
//   1. clip(rule) clips the current default path under that rule, exactly as
//      fill(rule) fills it (and as clip(path2d, rule) clips a Path2D);
//   2. an explicit undefined rule or path behaves as the omitted argument;
//   3. isPointInPath(x, y, undefined) is the (x, y, fillRule) form, not a
//      malformed (path, x, y);
//   4. a rule string other than 'evenodd' is LENIENT - it fills and clips
//      nonzero instead of throwing the TypeError WebIDL specifies.
// Fixture: two nested rects of the SAME winding, so nonzero covers the inner
// rect and evenodd leaves it as a hole.

test('fill/clip/isPointInPath (path?, fillRule?) overload parity', () => {
    const SIZE = 20;
    const HOLE = [10, 10]; // inside the inner rect
    const RING = [4, 4]; // between the two rects
    const OUT = [0, 0]; // outside both

    function nestedRects(target) {
        target.rect(2, 2, 16, 16);
        target.rect(6, 6, 8, 8);
    }

    function alphaAt(ctx, p) {
        return ctx.getImageData(p[0], p[1], 1, 1).data[3];
    }

    // Each case returns the HTML5 context after the operation; the expected
    // coverage is "hole painted?" (nonzero) or not (evenodd).
    function checkCoverage(label, ctx, holePainted) {
        assertEquals(alphaAt(ctx, RING), 255, label + ': ring must be painted');
        assertEquals(alphaAt(ctx, OUT), 0, label + ': outside must stay clear');
        assertEquals(alphaAt(ctx, HOLE), holePainted ? 255 : 0,
            label + ': hole must be ' + (holePainted ? 'painted (nonzero)' : 'clear (evenodd)'));
    }

    function fillCase(label, op, usePath2D, holePainted) {
        const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
        ctx.fillStyle = '#ff0000';
        let p;
        if (usePath2D) {
            p = new SWCanvas.Core.SWPath2D();
            nestedRects(p);
        } else {
            ctx.beginPath();
            nestedRects(ctx);
        }
        op(ctx, p);
        checkCoverage(label, ctx, holePainted);
    }

    function clipCase(label, op, usePath2D, holePainted) {
        const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
        let p;
        if (usePath2D) {
            p = new SWCanvas.Core.SWPath2D();
            nestedRects(p);
        } else {
            ctx.beginPath();
            nestedRects(ctx);
        }
        op(ctx, p);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, SIZE, SIZE);
        checkCoverage(label, ctx, holePainted);
    }

    // 1. fill vs clip, every overload, on the HTML5 facade
    fillCase('fill()', ctx => ctx.fill(), false, true);
    fillCase("fill('nonzero')", ctx => ctx.fill('nonzero'), false, true);
    fillCase("fill('evenodd')", ctx => ctx.fill('evenodd'), false, false);
    fillCase("fill(path2d, 'evenodd')", (ctx, p) => ctx.fill(p, 'evenodd'), true, false);
    clipCase('clip()', ctx => ctx.clip(), false, true);
    clipCase("clip('nonzero')", ctx => ctx.clip('nonzero'), false, true);
    clipCase("clip('evenodd')", ctx => ctx.clip('evenodd'), false, false);
    clipCase("clip(path2d, 'evenodd')", (ctx, p) => ctx.clip(p, 'evenodd'), true, false);

    // 2. explicit undefined == omitted
    fillCase('fill(undefined)', ctx => ctx.fill(undefined), false, true);
    fillCase('fill(path2d, undefined)', (ctx, p) => ctx.fill(p, undefined), true, true);
    clipCase('clip(undefined)', ctx => ctx.clip(undefined), false, true);
    clipCase('clip(path2d, undefined)', (ctx, p) => ctx.clip(p, undefined), true, true);

    // clip(rule) under a CTM: the current path is baked at construction time,
    // so the rule must apply to the baked geometry (no re-transform).
    {
        const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
        ctx.scale(2, 2);
        ctx.beginPath();
        ctx.rect(1, 1, 8, 8);
        ctx.rect(3, 3, 4, 4);
        ctx.clip('evenodd');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, SIZE, SIZE);
        checkCoverage("scale(2) + clip('evenodd')", ctx, false);
    }

    // 3. isPointInPath(x, y, undefined) is the (x, y, fillRule) form
    {
        const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
        ctx.beginPath();
        nestedRects(ctx);
        assertEquals(ctx.isPointInPath(HOLE[0], HOLE[1], undefined), true, 'isPointInPath(x, y, undefined) = nonzero');
        assertEquals(ctx.isPointInPath(HOLE[0], HOLE[1], 'evenodd'), false, "isPointInPath(x, y, 'evenodd')");
        const p = new SWCanvas.Core.SWPath2D();
        nestedRects(p);
        assertEquals(ctx.isPointInPath(p, HOLE[0], HOLE[1], undefined), true, 'isPointInPath(path2d, x, y, undefined)');
    }

    // 4. An unknown rule string fills and clips nonzero (lenient).
    fillCase("fill('bogus')", ctx => ctx.fill('bogus'), false, true);
    clipCase("clip('bogus')", ctx => ctx.clip('bogus'), false, true);
    clipCase("clip(path2d, 'bogus')", (ctx, p) => ctx.clip(p, 'bogus'), true, true);

    // Dual-API parity: the Core Context2D takes the same overloads.
    function coreAlpha(surface, p) {
        return surface.data[p[1] * surface.stride + p[0] * 4 + 3];
    }
    function coreCase(label, op, isClip, holePainted) {
        const surface = SWCanvas.Core.Surface(SIZE, SIZE);
        const core = new SWCanvas.Core.Context2D(surface);
        core.setFillStyle(255, 0, 0, 255);
        core.beginPath();
        nestedRects(core);
        op(core);
        if (isClip) core.fillRect(0, 0, SIZE, SIZE);
        assertEquals(coreAlpha(surface, RING), 255, 'Core ' + label + ': ring must be painted');
        assertEquals(coreAlpha(surface, OUT), 0, 'Core ' + label + ': outside must stay clear');
        assertEquals(coreAlpha(surface, HOLE), holePainted ? 255 : 0, 'Core ' + label + ': hole');
    }
    coreCase("clip('evenodd')", c => c.clip('evenodd'), true, false);
    coreCase("clip('nonzero')", c => c.clip('nonzero'), true, true);
    coreCase("fill('evenodd')", c => c.fill('evenodd'), false, false);
    coreCase('fill(undefined)', c => c.fill(undefined), false, true);
    coreCase("fill(undefined, 'evenodd')", c => c.fill(undefined, 'evenodd'), false, false);
});

// The smoke-font preload BOTH test runners call before the core and visual tests:
// tests/run-tests.js (Node) and tests/browser/index.html (the browser page).
//
// One font list, one fixture (font-assets/_smoke/, committed) and one success check,
// so the two environments render text from the same fonts by construction. Each runner
// names the fixture's location in its own terms (a filesystem path in Node, a URL relative
// to the page in the browser), and the font loader BitmapText registered for that
// environment reads it: QOI atlases in Node, the release WebP in the browser. The two
// decode to byte-identical atlas pixels (see scripts/build-smoke-fixture.js).

(function (global) {
    'use strict';

    // Every font in the fixture: font-assets/_smoke/smoke-set.json expanded. The Node
    // runner checks this list against the fixture's files, so neither can drift.
    const SMOKE_FONT_IDS = [
        'density-1-0-Arial-style-normal-weight-normal-size-16-0',
        'density-1-0-Arial-style-normal-weight-bold-size-16-0',
        'density-1-0-BitmapTextInvariant-style-normal-weight-normal-size-16-0',
        'density-2-0-Arial-style-normal-weight-normal-size-16-0',
        'density-2-0-Arial-style-normal-weight-bold-size-16-0',
        'density-2-0-BitmapTextInvariant-style-normal-weight-normal-size-16-0'
    ];

    // Loads every smoke font from fontDirectory (which must end in '/'), then throws
    // naming each font whose atlas did not arrive. BitmapText's loaders report a missing
    // atlas file with a console warning and render placeholder rectangles from then on,
    // so the check after the load is what makes a missing fixture fail the run.
    // options go to the loader (the browser passes { isFileProtocol }).
    async function preloadSmokeFonts(SWCanvas, fontDirectory, options) {
        SWCanvas.fonts._raw.BitmapText.setFontDirectory(fontDirectory);
        await Promise.all(SMOKE_FONT_IDS.map((id) => SWCanvas.fonts.load(id, options || {})));
        const missing = SMOKE_FONT_IDS.filter((id) => !SWCanvas.fonts.has(id));
        if (missing.length > 0) {
            throw new Error(`Smoke fonts not loaded from ${fontDirectory}: ${missing.join(', ')}`);
        }
    }

    const SmokeFonts = { SMOKE_FONT_IDS, preloadSmokeFonts };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SmokeFonts;
    } else {
        global.SmokeFonts = SmokeFonts;
    }
})(typeof window !== 'undefined' ? window : global);

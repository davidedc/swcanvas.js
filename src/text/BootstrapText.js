/**
 * BootstrapText — runtime configuration of vendored BitmapText.
 *
 * Wires BitmapText's canvas factory to SWCanvas's createCanvas (so the
 * colored-glyph staging canvas and the Node atlas-load canvas are both
 * SWCanvasElements — ImageLike-compatible with SWCanvas's drawImage), and
 * sets atlasFormat='imageData' (so atlases land as Uint8ClampedArray-backed
 * ImageLike instead of HTMLImageElement / canvas-mock-style canvases).
 *
 * setAtlasFormat's call-time contract: must run BEFORE the first loadFont /
 * BitmapText.a / registerAtlas call. This file is emitted at the very end of
 * dist/swcanvas.js (see build.sh Phase 4.7), which is the earliest any
 * SWCanvas consumer can reach BitmapText — so the contract is satisfied by
 * construction.
 *
 * The platform FontLoaders (BitmapTextFontLoaderBrowser / Node) self-register
 * via their own file footers; we don't wire `_fontLoader` here.
 */
class BootstrapText {
    static initialize(swcanvasNamespace) {
        if (typeof BitmapText === 'undefined') {
            throw new Error(
                'BootstrapText.initialize: BitmapText is not defined. ' +
                'Vendored BitmapText runtime must be concatenated before src/text/.'
            );
        }
        BitmapText.configure({
            canvasFactory: function () {
                return swcanvasNamespace.createCanvas(1, 1);
            },
            atlasFormat: 'imageData',
        });
    }
}

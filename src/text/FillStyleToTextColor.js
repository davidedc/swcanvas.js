/**
 * FillStyleToTextColor
 *
 * Adapts Core Context2D's _fillStyle (a Color, Gradient, or Pattern) into
 * BitmapText's TextProperties.textColor — a CSS color string.
 *
 * BitmapText doesn't render text through gradients/patterns; if fillStyle is
 * one of those, we fall back to opaque black with a console warning so the
 * caller sees text but is informed of the limitation.
 *
 * Alpha multiplication via globalAlpha happens in TextRenderer (passed
 * separately to BitmapText), not here.
 */
class FillStyleToTextColor {
    /**
     * @param {Color|Gradient|Pattern|null} fillStyle - Core context's _fillStyle
     * @returns {string} CSS color string suitable for TextProperties.textColor
     */
    static toCssColor(fillStyle) {
        if (!fillStyle || !(fillStyle instanceof Color)) {
            if (fillStyle) {
                console.warn(
                    'SWCanvas: gradient/pattern fillStyle is not supported for text; ' +
                    'falling back to opaque black.'
                );
            }
            return '#000000';
        }
        const r = fillStyle.r;
        const g = fillStyle.g;
        const b = fillStyle.b;
        const a = fillStyle.a;
        if (a === 255) {
            return '#' +
                r.toString(16).padStart(2, '0') +
                g.toString(16).padStart(2, '0') +
                b.toString(16).padStart(2, '0');
        }
        return 'rgba(' + r + ',' + g + ',' + b + ',' + (a / 255) + ')';
    }
}

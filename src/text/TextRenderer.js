/**
 * TextRenderer
 *
 * Bridge between SWCanvas's Core Context2D and BitmapText.drawTextFromAtlas.
 *
 * Two paths:
 *   - Fast path (identity-like transform): the current transform is just an
 *     integer translation (a=1, b=0, c=0, d=1, integer e/f). We pre-apply the
 *     translation to the user's coordinates and call BitmapText directly
 *     against the main context. BitmapText resets the transform to identity
 *     internally, then blits glyphs at our pre-translated coords — no
 *     intermediate buffer needed.
 *   - Slow path (rotated, scaled, or non-integer-translated transform): ask
 *     BitmapText for the exact ink bounding box via computeInkBoundingBox,
 *     render into an intermediate SWCanvasElement sized to that box, then
 *     drawImage the result onto the main context with the current transform
 *     applied.
 */
class TextRenderer {
    /**
     * @param {{style: string, weight: string, fontSize: number, fontFamily: string}|null} parsedFont
     * @param {number} pixelDensity
     * @returns {FontProperties|null}
     */
    static _toFontProperties(parsedFont, pixelDensity) {
        if (!parsedFont) return null;
        return new FontProperties(
            pixelDensity || 1,
            parsedFont.fontFamily,
            parsedFont.style,
            parsedFont.weight,
            parsedFont.fontSize
        );
    }

    static _toTextProperties(textAlign, textBaseline, textColor) {
        return new TextProperties({
            isKerningEnabled: true,
            textBaseline: textBaseline || 'alphabetic',
            textAlign: textAlign || 'start',
            textColor: textColor,
        });
    }

    /**
     * Fast-path eligibility check. The transform must be a pure integer
     * translation (no rotation, no skew, no scale, only integer offsets).
     * @param {Transform2D} t
     * @returns {boolean}
     */
    static _isIdentityLike(t) {
        return t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 &&
               Number.isInteger(t.e) && Number.isInteger(t.f);
    }

    /**
     * Render text at (x, y).
     *
     * @param {Context2D} coreCtx
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @returns {{rendered: boolean, status: object}}
     */
    static fillText(coreCtx, text, x, y) {
        const fontProps = TextRenderer._toFontProperties(coreCtx._font, coreCtx._textPixelDensity);
        if (!fontProps) {
            return { rendered: false, status: { code: 1 /* NO_METRICS */ } };
        }
        const textColor = FillStyleToTextColor.toCssColor(coreCtx._fillStyle);
        const userTextProps = TextRenderer._toTextProperties(
            coreCtx._textAlign, coreCtx._textBaseline, textColor
        );

        const t = coreCtx._transform;
        // Fast path requires density === 1. At density > 1 drawTextFromAtlas
        // would multiply x/y by N and draw glyphs at N× size against the main
        // surface — wrong logical coords AND size. The slow path's intermediate
        // + drawImage downsamples back to CSS pixels, preserving correctness.
        if (TextRenderer._isIdentityLike(t) && fontProps.pixelDensity === 1) {
            // Fast path: pre-apply the integer translation and call BitmapText
            // directly against the main context (which it'll reset to identity).
            return BitmapText.drawTextFromAtlas(
                coreCtx, text, x + t.e, y + t.f, fontProps, userTextProps
            );
        }

        // Slow path. BitmapText.computeInkBoundingBox returns the exact ink
        // rect in CSS pixels (accounting for the user's textAlign/textBaseline);
        // we allocate an intermediate of that size, draw at the offset that
        // lands ink at (0, 0), then blit with the user's transform.
        const ibb = BitmapText.computeInkBoundingBox(text, x, y, fontProps, userTextProps);
        if (!ibb || ibb.status.code !== 0 || !ibb.box) {
            return { rendered: false, status: (ibb && ibb.status) || { code: 1 } };
        }
        const box = ibb.box;

        // Empty / zero-extent text — nothing to draw.
        if (box.width === 0 || box.height === 0) {
            return { rendered: true, status: { code: 0 } };
        }

        const dpr   = fontProps.pixelDensity;
        const wPhys = Math.max(1, Math.ceil(box.width  * dpr));
        const hPhys = Math.max(1, Math.ceil(box.height * dpr));
        const intermediate = TextRenderer._makeIntermediate(wPhys, hPhys);
        const interCtx     = intermediate.getContext('2d');

        // (x - box.x, y - box.y) stays in CSS pixels — drawTextFromAtlas
        // multiplies by pixelDensity internally. Don't double-scale.
        BitmapText.drawTextFromAtlas(
            interCtx, text, x - box.x, y - box.y, fontProps, userTextProps
        );

        // Blit the intermediate. drawImage applies the current transform, so
        // rotation/scale are honoured.
        coreCtx.drawImage(
            intermediate, 0, 0, wPhys, hPhys,
            box.x, box.y, box.width, box.height
        );

        return { rendered: true, status: { code: 0 } };
    }

    static measureText(coreCtx, text) {
        const fontProps = TextRenderer._toFontProperties(coreCtx._font, coreCtx._textPixelDensity);
        if (!fontProps) return null;
        const textColor = FillStyleToTextColor.toCssColor(coreCtx._fillStyle);
        const textProps = TextRenderer._toTextProperties(
            coreCtx._textAlign, coreCtx._textBaseline, textColor
        );
        const result = BitmapText.measureText(text, fontProps, textProps);
        return result && result.metrics ? result.metrics : null;
    }

    /**
     * Allocate an SWCanvasElement-shaped intermediate buffer. The build wires
     * the createCanvas factory through BitmapText.setCanvasFactory; we mirror
     * it here so the slow path uses the same canvas class without reaching
     * across the module boundary.
     *
     * @private
     */
    static _makeIntermediate(w, h) {
        return new SWCanvasElement(w, h);
    }
}

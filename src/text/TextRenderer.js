/**
 * TextRenderer
 *
 * Bridge between SWCanvas's Core Context2D and BitmapText.drawTextFromAtlas.
 *
 * Two paths:
 *   - Fast path (axis-aligned, uniform scale == atlas density): the current
 *     transform is an axis-aligned uniform scale whose factor equals the
 *     font's pixelDensity, with an integer device-pixel translation
 *     (a = d = dpr, b = c = 0, integer e/f). BitmapText resets the transform
 *     to identity internally and applies pixelDensity itself by scaling
 *     coordinates and glyphs by dpr — so when the geometric scale already
 *     equals dpr, that internal scaling reproduces the transform exactly. We
 *     bake the translation back into the coords (divide by dpr, since
 *     BitmapText re-multiplies) and blit straight to the main context — no
 *     intermediate buffer. The original density-1 case (pure integer
 *     translation) is just dpr = 1.
 *   - Slow path (rotation, skew, or a scale that differs from the density):
 *     ask BitmapText for the exact ink bounding box via computeInkBoundingBox,
 *     render into an intermediate SWCanvasElement sized to box × dpr, then
 *     drawImage the result onto the main context with the current transform
 *     applied. This is the only path that can honour rotation/skew (BitmapText
 *     draws axis-aligned only) or a scale ≠ density (it confines the ×dpr
 *     sampling to the intermediate, keeping density a sampling detail rather
 *     than a layout multiplier).
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
        // BitmapText accepts only left/center/right; HTML5's 'start' and 'end'
        // need to be resolved. SWCanvas doesn't support RTL, so start→left,
        // end→right. Any other value is passed through (BitmapText will warn).
        const resolvedAlign =
            (textAlign === 'start' || !textAlign) ? 'left'  :
            (textAlign === 'end')                 ? 'right' :
            textAlign;
        return new TextProperties({
            isKerningEnabled: true,
            textBaseline: textBaseline || 'alphabetic',
            textAlign: resolvedAlign,
            textColor: textColor,
        });
    }

    /**
     * Fast-path (direct-blit) eligibility. The transform must be an
     * axis-aligned uniform scale whose factor equals the atlas density, with
     * an integer device-pixel translation: a = d = dpr, b = c = 0, integer
     * e/f. Under such a transform BitmapText's own internal ×dpr scaling
     * reproduces the geometric scale exactly, so we can blit directly to the
     * main surface and skip the intermediate buffer. The original density-1
     * fast path (pure integer translation) is the dpr = 1 case.
     *
     * Exact comparisons are intentional: a transform that drifts off these
     * values (e.g. float error after a rotate/unrotate) simply falls back to
     * the slow path — a safe, conservative miss. The integer e/f gate is kept
     * for crispness; at dpr > 1 the translate is integer device pixels, and
     * the e/dpr passed to BitmapText may be a half-integer CSS coordinate that
     * BitmapText snaps back onto the device grid.
     *
     * @param {Transform2D} t
     * @param {number} dpr  fontProperties.pixelDensity
     * @returns {boolean}
     */
    static _isDirectBlitEligible(t, dpr) {
        return t.b === 0 && t.c === 0 && t.a === dpr && t.d === dpr &&
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
        const dpr = fontProps.pixelDensity;
        // Fast path: axis-aligned, uniform scale == density, integer translate.
        // BitmapText resets the transform to identity and applies dpr itself by
        // scaling coords/glyphs by dpr, so a matching geometric scale is
        // reproduced for free. Bake the (device-pixel) translation back into
        // the coords — divide by dpr because BitmapText re-multiplies — and
        // blit straight to the main context. At dpr === 1 this is the original
        // pure-integer-translation fast path (e/dpr === e).
        if (TextRenderer._isDirectBlitEligible(t, dpr)) {
            return BitmapText.drawTextFromAtlas(
                coreCtx, text, x + t.e / dpr, y + t.f / dpr, fontProps, userTextProps
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

        const wPhys = Math.max(1, Math.ceil(box.width  * dpr));
        const hPhys = Math.max(1, Math.ceil(box.height * dpr));
        const intermediate = TextRenderer._makeIntermediate(wPhys, hPhys);
        const interCtx     = intermediate.getContext('2d');

        // (x - box.x, y - box.y) stays in CSS pixels — drawTextFromAtlas
        // multiplies by pixelDensity internally. Don't double-scale.
        const drawResult = BitmapText.drawTextFromAtlas(
            interCtx, text, x - box.x, y - box.y, fontProps, userTextProps
        );

        // Blit the intermediate. drawImage applies the current transform, so
        // rotation/scale are honoured.
        coreCtx.drawImage(
            intermediate, 0, 0, wPhys, hPhys,
            box.x, box.y, box.width, box.height
        );

        // Propagate the inner draw's status: the intermediate may have rendered
        // PLACEHOLDERS (NO_ATLAS / PARTIAL_ATLAS), and a caller watching for cold
        // draws (e.g. a host that repaints when atlases warm) must see that from
        // the transformed path exactly as it does from the direct-blit path —
        // swallowing it here made transformed placeholder text unobservable.
        return drawResult || { rendered: true, status: { code: 0 } };
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

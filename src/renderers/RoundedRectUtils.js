/**
 * RoundedRectUtils - Shared utilities for rounded rectangle rendering
 * Used by SWPath2D.roundRect, Context2D's roundRect entries, RoundedRectOpsAA
 * and RoundedRectOpsRot.
 *
 * CORNER RADII CONTRACT (HTML5 roundRect() semantics, CSS border-radius order):
 * a radii argument is a number or a list of 1-4 numbers, expanded to four
 * corner radii in the order [topLeft, topRight, bottomRight, bottomLeft]:
 *   r              → all four corners
 *   [r]            → all four corners
 *   [a, b]         → topLeft & bottomRight = a, topRight & bottomLeft = b
 *   [a, b, c]      → topLeft = a, topRight & bottomLeft = b, bottomRight = c
 *   [a, b, c, d]   → topLeft, topRight, bottomRight, bottomLeft
 * Radii that would overlap are scaled down PROPORTIONALLY (all four by one
 * factor), not clamped per corner. The one divergence from HTML5: corner radii
 * are circular only - a DOMPointInit ({x, y}, an elliptical corner) is rejected.
 * The "corner" here is a role of the rect's (x, y, width, height) arguments:
 * topLeft is the corner at (x, y), so a negative width or height mirrors which
 * VISUAL corner each radius lands on (exactly as HTML5 does).
 */
// Shared output of RoundedRectUtils.normalizeCornerRadii (see there).
const _rrCornerRadiiScratch = [0, 0, 0, 0];

class RoundedRectUtils {
    /**
     * Parse a radii argument, validating it exactly as HTML5 roundRect() does.
     * Unscaled: overlap scaling needs the rect's size (scaleCornerRadiiToFit).
     *
     * UNIFORM radii come back as ONE NUMBER - a scalar, or a list whose four
     * expanded corners are equal - so the common case carries no array through
     * the hot paths; only genuinely per-corner radii come back as an array.
     *
     * @param {number|number[]|undefined} radii - Corner radius, or a list of 1-4
     * @returns {number|number[]|null} The uniform radius; or per-corner
     *   [topLeft, topRight, bottomRight, bottomLeft]; or null when a radius is NaN
     *   or infinite (HTML5: the call draws nothing)
     * @throws {RangeError} if a list has fewer than 1 or more than 4 entries, or a
     *   radius is negative
     * @throws {TypeError} if a radius is an object (a DOMPointInit elliptical
     *   corner - not supported)
     */
    static parseCornerRadii(radii) {
        // Scalar fast path - every caller that does not use per-corner radii.
        if (typeof radii === 'number') {
            if (!isFinite(radii)) return null;
            if (radii < 0) throw RoundedRectUtils._negativeRadiusError(radii);
            return radii;
        }
        const list = Array.isArray(radii) ? radii : [radii];
        if (list.length < 1 || list.length > 4) {
            throw new RangeError(`${list.length} radii provided. Between one and four radii are necessary.`);
        }
        const values = new Array(list.length);
        for (let i = 0; i < list.length; i++) {
            const v = RoundedRectUtils._radiusValue(list[i]);
            if (!isFinite(v)) return null;
            if (v < 0) throw RoundedRectUtils._negativeRadiusError(v);
            values[i] = v;
        }
        let corners;
        switch (values.length) {
            case 1:
                return values[0];
            case 2:
                corners = [values[0], values[1], values[0], values[1]];
                break;
            case 3:
                corners = [values[0], values[1], values[2], values[1]];
                break;
            default:
                corners = values;
        }
        return RoundedRectUtils._isUniformList(corners) ? corners[0] : corners;
    }

    /**
     * Convert one radii entry the way WebIDL converts an `unrestricted double`:
     * absent (undefined/null) is 0, primitives go through Number().
     * @private
     */
    static _radiusValue(value) {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'object') {
            throw new TypeError(
                'roundRect radii must be numbers: elliptical {x, y} (DOMPointInit) corner radii are not supported'
            );
        }
        return Number(value);
    }

    /** @private */
    static _negativeRadiusError(value) {
        return new RangeError(`Radius value ${value} is negative.`);
    }

    /** @private */
    static _isUniformList(corners) {
        return corners[0] === corners[1] && corners[0] === corners[2] && corners[0] === corners[3];
    }

    /**
     * Scale corner radii so adjacent corners never overlap (HTML5 roundRect()
     * step "corner curves must not overlap"): if the radii on any side add up to
     * more than that side's length, ALL four shrink by the one factor that makes
     * the tightest side fit. Width/height are taken as magnitudes.
     *
     * A uniform radius is computed as min(r, |w|/2, |h|/2) - the same value in
     * exact arithmetic, but it reproduces the historical uniform clamp bit for
     * bit, where the product form could land one ulp off a .5 rounding boundary
     * downstream (the direct renderers round radii to integers).
     *
     * @param {number|number[]} corners - parseCornerRadii's result (non-null)
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @returns {number|number[]} The fitted radius / a new array of fitted radii
     */
    static scaleCornerRadiiToFit(corners, width, height) {
        const w = Math.abs(width);
        const h = Math.abs(height);
        if (typeof corners === 'number') {
            return Math.min(corners, w / 2, h / 2);
        }
        const tl = corners[0],
            tr = corners[1],
            br = corners[2],
            bl = corners[3];
        let scale = 1;
        const top = tl + tr;
        const right = tr + br;
        const bottom = br + bl;
        const left = bl + tl;
        if (top > 0) scale = Math.min(scale, w / top);
        if (right > 0) scale = Math.min(scale, h / right);
        if (bottom > 0) scale = Math.min(scale, w / bottom);
        if (left > 0) scale = Math.min(scale, h / left);
        if (scale >= 1) return [tl, tr, br, bl];
        return [tl * scale, tr * scale, br * scale, bl * scale];
    }

    /**
     * Device-pixel corner radii for the axis-aligned direct renderers: parse,
     * fit to the rect, then round each corner to an integer (the renderers' arcs
     * are integer-radius). For a uniform radius this is exactly the historical
     * round(min(r, w/2, h/2)).
     *
     * Returns a SHARED scratch array (no allocation per draw call): read the four
     * values out before the next call. Not drawable (non-finite) radii give zeros.
     *
     * @param {number|number[]} radii - Corner radius or list of 1-4 (see parseCornerRadii)
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @returns {number[]} Integer [topLeft, topRight, bottomRight, bottomLeft] (shared)
     */
    static normalizeCornerRadii(radii, width, height) {
        const out = _rrCornerRadiiScratch;
        const corners = RoundedRectUtils.parseCornerRadii(radii);
        if (corners === null) {
            out[0] = out[1] = out[2] = out[3] = 0;
            return out;
        }
        const fitted = RoundedRectUtils.scaleCornerRadiiToFit(corners, width, height);
        if (typeof fitted === 'number') {
            out[0] = out[1] = out[2] = out[3] = Math.round(fitted);
        } else {
            out[0] = Math.round(fitted[0]);
            out[1] = Math.round(fitted[1]);
            out[2] = Math.round(fitted[2]);
            out[3] = Math.round(fitted[3]);
        }
        return out;
    }

    /**
     * Normalize a UNIFORM radius for the rotated renderers, clamping it to half
     * the smaller dimension and rounding to an integer. RoundedRectOpsRot only
     * ever receives uniform radii: Context2D routes per-corner radii under a
     * non-axis-aligned rotation to the generic pipeline (see strokeRoundRect).
     *
     * @param {number} radius - Corner radius
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @returns {number} Normalized integer radius
     */
    static normalizeRadius(radius, width, height) {
        return Math.round(Math.min(radius || 0, width / 2, height / 2));
    }

    /**
     * Device-space corner radii for the axis-aligned direct renderers under an
     * axis-aligned SIMILARITY transform (a multiple of 90 degrees, uniform scale,
     * no reflection - Context2D's isUniformScale && isAxisAligned gate): scaled by
     * the transform, and - per-corner radii only - re-assigned to the device
     * corners they land on. The axis-aligned renderers draw a device-space box
     * whose width/height are swapped for a quarter turn, so the corners must be
     * cycled with it: a quarter turn clockwise (rotate(PI/2), +90 degrees in
     * canvas y-down space) moves the user top-left corner to the device
     * top-right, and so on around the rect.
     *
     * @param {number|number[]} corners - parseCornerRadii's result (non-null)
     * @param {Transform2D} transform - Axis-aligned, reflection-free, uniform CTM
     * @returns {number|number[]} Device-space radius / [topLeft, topRight, bottomRight, bottomLeft]
     */
    static deviceCornerRadii(corners, transform) {
        const scale = transform.scaleX;
        if (typeof corners === 'number') return corners * scale;
        // Quarter turns clockwise: 0 (a > 0), 1 (b > 0), 2 (a < 0), 3 (b < 0).
        let quarterTurns;
        if (transform.is90DegreeRotated) {
            quarterTurns = transform.b > 0 ? 1 : 3;
        } else {
            quarterTurns = transform.a > 0 ? 0 : 2;
        }
        // Device corner i shows user corner i - quarterTurns (clockwise order).
        const out = new Array(4);
        for (let i = 0; i < 4; i++) {
            out[i] = corners[(i - quarterTurns + 4) % 4] * scale;
        }
        return out;
    }

    /**
     * Get edge endpoint definitions for a rounded rectangle in local coordinates
     * (centered at origin). Used for perimeter generation in rotated rendering.
     *
     * @param {number} hw - Half-width
     * @param {number} hh - Half-height
     * @param {number} r - Corner radius
     * @returns {Array<{start: {x: number, y: number}, end: {x: number, y: number}}>}
     */
    static getEdgeEndpoints(hw, hh, r) {
        return [
            { start: { x: -hw + r, y: -hh }, end: { x: hw - r, y: -hh } }, // Top
            { start: { x: hw, y: -hh + r }, end: { x: hw, y: hh - r } }, // Right
            { start: { x: hw - r, y: hh }, end: { x: -hw + r, y: hh } }, // Bottom
            { start: { x: -hw, y: hh - r }, end: { x: -hw, y: -hh + r } } // Left
        ];
    }

    /**
     * Get corner arc definitions for a rounded rectangle in local coordinates
     * (centered at origin). Returns center points and angle ranges for each corner.
     *
     * @param {number} hw - Half-width
     * @param {number} hh - Half-height
     * @param {number} r - Corner radius
     * @returns {Array<{cx: number, cy: number, startAngle: number, endAngle: number}>}
     */
    static getCornerDefinitions(hw, hh, r) {
        return [
            { cx: -hw + r, cy: -hh + r, startAngle: Math.PI, endAngle: THREE_HALF_PI }, // Top-left
            { cx: hw - r, cy: -hh + r, startAngle: THREE_HALF_PI, endAngle: TAU }, // Top-right
            { cx: hw - r, cy: hh - r, startAngle: 0, endAngle: HALF_PI }, // Bottom-right
            { cx: -hw + r, cy: hh - r, startAngle: HALF_PI, endAngle: Math.PI } // Bottom-left
        ];
    }
}

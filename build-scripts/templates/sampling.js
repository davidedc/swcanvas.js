/**
 * Image-Sampling Templates - Filtering Image Texels
 *
 * These templates read an image; they write no pixel. The caller resolves where the taps fall
 * (its edge rule) and what a transparent sample does to its loop.
 *
 * Used by: Rasterizer drawImage's pixel loop, Pattern.filterAt (pattern paint)
 */

const SAMPLING_TEMPLATES = {
    /**
     * Bilinear filter of the four texels around a sample point - the tap arithmetic of every
     * filtered image draw (drawImage and pattern paint).
     * Filtered PREMULTIPLIED: source texels are straight RGBA and fully transparent texels carry
     * arbitrary RGB, so a straight-alpha lerp would bleed that RGB into edges (dark fringes). Each
     * texel's RGB is weighted by its alpha, accumulated, and un-premultiplied at the end. Plain
     * double arithmetic in a fixed accumulation order (00, 10, 01, 11) - byte-identical on V8 and
     * JSC.
     *
     * The caller applies its edge rule through the arguments: it resolves the tap columns/rows
     * (drawImage clamps to the edge texel, a pattern wraps a repeating axis), and passes the
     * per-axis weights (1 - fx, fx, 1 - fy, fy), zeroing the weight of a tap that reads nothing
     * (a pattern's non-repeating axis beyond the image). A zero-weight tap is never read.
     *
     * Every argument is a simple variable (each weight is read twice). No outer {} block: the
     * template's own __-prefixed constants live in the caller's block, so it is expanded at most
     * once per block.
     *
     * @param {Uint8ClampedArray} data - Straight RGBA texels
     * @param {number} width - Image width in texels
     * @param {number} tx0 - Column of the left taps
     * @param {number} tx1 - Column of the right taps
     * @param {number} ty0 - Row of the top taps
     * @param {number} ty1 - Row of the bottom taps
     * @param {number} wx0 - Weight of the left column
     * @param {number} wx1 - Weight of the right column
     * @param {number} wy0 - Weight of the top row
     * @param {number} wy1 - Weight of the bottom row
     * @param {*} outR - Assignable target of the filtered straight red (a variable or a property)
     * @param {*} outG - Of the filtered green
     * @param {*} outB - Of the filtered blue
     * @param {*} outA - Of the filtered alpha
     * @param {string} onTransparent - The statement run when every weighted tap is transparent
     *   (`continue` in a pixel loop, `return false` in a sampler); the outputs are then untouched
     */
    'FILTER_BILINEAR': {
        params: [
            'data',
            'width',
            'tx0',
            'tx1',
            'ty0',
            'ty1',
            'wx0',
            'wx1',
            'wy0',
            'wy1',
            'outR',
            'outG',
            'outB',
            'outA',
            'onTransparent'
        ],
        code: `const __w00 = {{wx0}} * {{wy0}};
const __w10 = {{wx1}} * {{wy0}};
const __w01 = {{wx0}} * {{wy1}};
const __w11 = {{wx1}} * {{wy1}};
let __aSum = 0;
let __rSum = 0;
let __gSum = 0;
let __bSum = 0;
if (__w00 !== 0) {
    const __o = ({{ty0}} * {{width}} + {{tx0}}) * 4;
    const __wa = __w00 * {{data}}[__o + 3];
    if (__wa !== 0) {
        __aSum += __wa;
        __rSum += __wa * {{data}}[__o];
        __gSum += __wa * {{data}}[__o + 1];
        __bSum += __wa * {{data}}[__o + 2];
    }
}
if (__w10 !== 0) {
    const __o = ({{ty0}} * {{width}} + {{tx1}}) * 4;
    const __wa = __w10 * {{data}}[__o + 3];
    if (__wa !== 0) {
        __aSum += __wa;
        __rSum += __wa * {{data}}[__o];
        __gSum += __wa * {{data}}[__o + 1];
        __bSum += __wa * {{data}}[__o + 2];
    }
}
if (__w01 !== 0) {
    const __o = ({{ty1}} * {{width}} + {{tx0}}) * 4;
    const __wa = __w01 * {{data}}[__o + 3];
    if (__wa !== 0) {
        __aSum += __wa;
        __rSum += __wa * {{data}}[__o];
        __gSum += __wa * {{data}}[__o + 1];
        __bSum += __wa * {{data}}[__o + 2];
    }
}
if (__w11 !== 0) {
    const __o = ({{ty1}} * {{width}} + {{tx1}}) * 4;
    const __wa = __w11 * {{data}}[__o + 3];
    if (__wa !== 0) {
        __aSum += __wa;
        __rSum += __wa * {{data}}[__o];
        __gSum += __wa * {{data}}[__o + 1];
        __bSum += __wa * {{data}}[__o + 2];
    }
}
if (__aSum === 0) {{onTransparent}};
// Un-premultiply back to straight RGBA (the alpha weights cancel out of the RGB average)
{{outR}} = Math.round(__rSum / __aSum);
{{outG}} = Math.round(__gSum / __aSum);
{{outB}} = Math.round(__bSum / __aSum);
{{outA}} = Math.round(__aSum);`
    }
};

module.exports = SAMPLING_TEMPLATES;

#!/usr/bin/env node
/**
 * Build-time preprocessor for inline marker expansion.
 *
 * This script expands inline markers of the form:
 *   /\*@inline:TEMPLATE_NAME(args)\*\/
 * into inlined code at build time, eliminating function call overhead in hot pixel loops.
 *
 * CLIPPING CONTRACT:
 * ------------------
 * Templates follow three contracts per ARCHITECTURE.md "Check Once, Check Correctly":
 *
 * Standard Templates (BLEND_ALPHA, SET_OPAQUE):
 * - Do NOT include clipping logic
 * - Caller checks clipBuffer BEFORE the marker (for span-based rendering)
 *
 * Clipped Templates (BLEND_ALPHA_CLIPPED, SET_OPAQUE_CLIPPED):
 * - Include clipping logic: if (!clipBuffer || bit-check)
 * - For per-pixel loops where clipping cannot be hoisted
 * - Bounds checking remains caller's responsibility
 *
 * Arc Templates (SET_OPAQUE_ARC_CLIPPED, BLEND_ALPHA_ARC_CLIPPED):
 * - Include angle range check + clipping logic
 * - Inline isAngleInRange logic (with Math.atan2) to eliminate function call overhead
 * - For arc-specific per-pixel loops where angle filtering is required
 * - TAU constant is inlined for performance
 *
 * All templates preserve the single-clipping-check invariant.
 *
 * Usage:
 *   node preprocess.js <input> [output]
 *
 * If output is omitted, writes to stdout.
 */

const fs = require('fs');
const path = require('path');

// Template definitions - single source of truth for pixel operations
// Three categories of templates:
// - Standard (BLEND_ALPHA, SET_OPAQUE): Caller checks clipping BEFORE marker
// - Clipped (_CLIPPED variants): Include clipping check for per-pixel loops
// - Arc (_ARC_CLIPPED variants): Include angle check + clipping for arc per-pixel loops
// See ARCHITECTURE.md "Check Once, Check Correctly" contract.
//
// PERFORMANCE NOTE: Templates are optimized for V8. Since all call sites pass simple
// variable names (not expressions), arguments are used directly without caching.
// This matches hand-written inline code structure for optimal V8 optimization.
const TEMPLATES = {
    /**
     * Porter-Duff source-over alpha blending for a single pixel.
     * Matches the hand-written inline code structure for optimal V8 optimization.
     *
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1), pre-multiplied with globalAlpha
     * @param {number} invAlpha - Inverse alpha (1 - alpha), pre-computed for efficiency
     */
    'BLEND_ALPHA': {
        params: ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha'],
        // No outer {} block - matches original hand-written inline code structure.
        // Use alpha directly 4 times (no caching) - all call sites pass simple variables.
        // No parentheses around pixelIndex - all call sites now pass simple variables.
        // No parentheses around invAlpha - all call sites pass simple variables.
        code: `const __off = {{pixelIndex}} * 4;
const __dstA = {{data}}[__off + 3] / 255;
const __dstAScaled = __dstA * {{invAlpha}};
const __outA = {{alpha}} + __dstAScaled;
if (__outA > 0) {
    const __blend = 1 / __outA;
    {{data}}[__off]     = ({{r}} * {{alpha}} + {{data}}[__off] * __dstAScaled) * __blend;
    {{data}}[__off + 1] = ({{g}} * {{alpha}} + {{data}}[__off + 1] * __dstAScaled) * __blend;
    {{data}}[__off + 2] = ({{b}} * {{alpha}} + {{data}}[__off + 2] * __dstAScaled) * __blend;
    {{data}}[__off + 3] = __outA * 255;
}`
    },

    /**
     * Direct 32-bit opaque pixel write.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     */
    'SET_OPAQUE': {
        params: ['data32', 'pixelIndex', 'packedColor'],
        code: `{{data32}}[{{pixelIndex}}] = {{packedColor}};`
    },

    /**
     * Direct 32-bit opaque pixel write with inline clipping check.
     * Use this in per-pixel loops where clipping cannot be hoisted to span level.
     *
     * Contract: Bounds checking is caller's responsibility. This template only checks clipping.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     */
    'SET_OPAQUE_CLIPPED': {
        params: ['data32', 'pixelIndex', 'packedColor', 'clipBuffer'],
        code: `if (!{{clipBuffer}} || ({{clipBuffer}}[{{pixelIndex}} >> 3] & (1 << ({{pixelIndex}} & 7)))) {
    {{data32}}[{{pixelIndex}}] = {{packedColor}};
}`
    },

    /**
     * Porter-Duff source-over alpha blending with inline clipping check.
     * Use this in per-pixel loops where clipping cannot be hoisted to span level.
     *
     * Contract: Bounds checking is caller's responsibility. This template only checks clipping.
     *
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1), pre-multiplied with globalAlpha
     * @param {number} invAlpha - Inverse alpha (1 - alpha), pre-computed for efficiency
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     */
    'BLEND_ALPHA_CLIPPED': {
        params: ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha', 'clipBuffer'],
        code: `if (!{{clipBuffer}} || ({{clipBuffer}}[{{pixelIndex}} >> 3] & (1 << ({{pixelIndex}} & 7)))) {
    const __off = {{pixelIndex}} * 4;
    const __dstA = {{data}}[__off + 3] / 255;
    const __dstAScaled = __dstA * {{invAlpha}};
    const __outA = {{alpha}} + __dstAScaled;
    if (__outA > 0) {
        const __blend = 1 / __outA;
        {{data}}[__off]     = ({{r}} * {{alpha}} + {{data}}[__off] * __dstAScaled) * __blend;
        {{data}}[__off + 1] = ({{g}} * {{alpha}} + {{data}}[__off + 1] * __dstAScaled) * __blend;
        {{data}}[__off + 2] = ({{b}} * {{alpha}} + {{data}}[__off + 2] * __dstAScaled) * __blend;
        {{data}}[__off + 3] = __outA * 255;
    }
}`
    },

    /**
     * Opaque pixel write for arc rendering with inline angle check + clipping.
     * Combines isAngleInRange logic with clipping and pixel write to eliminate function call overhead.
     *
     * TAU constant (6.283185307179586) is inlined for performance.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     * @param {number} dx - X offset from arc center
     * @param {number} dy - Y offset from arc center
     * @param {number} startAngle - Arc start angle in radians
     * @param {number} endAngle - Arc end angle in radians (must be > startAngle)
     */
    'SET_OPAQUE_ARC_CLIPPED': {
        params: ['data32', 'pixelIndex', 'packedColor', 'clipBuffer', 'dx', 'dy', 'startAngle', 'endAngle'],
        code: `{
    let __angle = Math.atan2({{dy}}, {{dx}});
    if (__angle < 0) __angle += 6.283185307179586;
    if (__angle < {{startAngle}}) __angle += 6.283185307179586;
    if (__angle >= {{startAngle}} && __angle <= {{endAngle}}) {
        if (!{{clipBuffer}} || ({{clipBuffer}}[{{pixelIndex}} >> 3] & (1 << ({{pixelIndex}} & 7)))) {
            {{data32}}[{{pixelIndex}}] = {{packedColor}};
        }
    }
}`
    },

    /**
     * Alpha blending for arc rendering with inline angle check + clipping.
     * Combines isAngleInRange logic with clipping and alpha blend to eliminate function call overhead.
     *
     * TAU constant (6.283185307179586) is inlined for performance.
     *
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1)
     * @param {number} invAlpha - Inverse alpha (1 - alpha)
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     * @param {number} dx - X offset from arc center
     * @param {number} dy - Y offset from arc center
     * @param {number} startAngle - Arc start angle in radians
     * @param {number} endAngle - Arc end angle in radians (must be > startAngle)
     */
    'BLEND_ALPHA_ARC_CLIPPED': {
        params: ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha', 'clipBuffer', 'dx', 'dy', 'startAngle', 'endAngle'],
        code: `{
    let __angle = Math.atan2({{dy}}, {{dx}});
    if (__angle < 0) __angle += 6.283185307179586;
    if (__angle < {{startAngle}}) __angle += 6.283185307179586;
    if (__angle >= {{startAngle}} && __angle <= {{endAngle}}) {
        if (!{{clipBuffer}} || ({{clipBuffer}}[{{pixelIndex}} >> 3] & (1 << ({{pixelIndex}} & 7)))) {
            const __off = {{pixelIndex}} * 4;
            const __dstA = {{data}}[__off + 3] / 255;
            const __dstAScaled = __dstA * {{invAlpha}};
            const __outA = {{alpha}} + __dstAScaled;
            if (__outA > 0) {
                const __blend = 1 / __outA;
                {{data}}[__off]     = ({{r}} * {{alpha}} + {{data}}[__off] * __dstAScaled) * __blend;
                {{data}}[__off + 1] = ({{g}} * {{alpha}} + {{data}}[__off + 1] * __dstAScaled) * __blend;
                {{data}}[__off + 2] = ({{b}} * {{alpha}} + {{data}}[__off + 2] * __dstAScaled) * __blend;
                {{data}}[__off + 3] = __outA * 255;
            }
        }
    }
}`
    },

    /**
     * Fast opaque pixel write for arc rendering using cross-product angle check + clipping.
     * Uses cross-product instead of atan2 for 10-50x faster angle checking.
     *
     * Cross-product logic: A point P is "left of" vector V if cross(V, P) >= 0
     * - afterStart = (startCos * py - startSin * px) >= 0
     * - beforeEnd = (endCos * py - endSin * px) <= 0
     * - Small arc (<180°): afterStart AND beforeEnd
     * - Large arc (>180°): afterStart OR beforeEnd
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     * @param {number} dx - X offset from arc center
     * @param {number} dy - Y offset from arc center
     * @param {number} startCos - cos(startAngle), precomputed
     * @param {number} startSin - sin(startAngle), precomputed
     * @param {number} endCos - cos(endAngle), precomputed
     * @param {number} endSin - sin(endAngle), precomputed
     * @param {boolean} isLargeArc - True if arc spans > 180°
     */
    'SET_OPAQUE_ARC_FAST_CLIPPED': {
        params: ['data32', 'pixelIndex', 'packedColor', 'clipBuffer', 'dx', 'dy', 'startCos', 'startSin', 'endCos', 'endSin', 'isLargeArc'],
        code: `{
    const __afterStart = ({{startCos}} * {{dy}} - {{startSin}} * {{dx}}) >= 0;
    const __beforeEnd = ({{endCos}} * {{dy}} - {{endSin}} * {{dx}}) <= 0;
    const __inRange = {{isLargeArc}} ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange) {
        if (!{{clipBuffer}} || ({{clipBuffer}}[{{pixelIndex}} >> 3] & (1 << ({{pixelIndex}} & 7)))) {
            {{data32}}[{{pixelIndex}}] = {{packedColor}};
        }
    }
}`
    },

    /**
     * Fast alpha blending for arc rendering using cross-product angle check + clipping.
     * Uses cross-product instead of atan2 for 10-50x faster angle checking.
     *
     * @param {Uint8Array|Uint8ClampedArray} data - 8-bit view of surface pixel data
     * @param {number} pixelIndex - Linear pixel index (y * width + x)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @param {number} alpha - Alpha as fraction (0-1)
     * @param {number} invAlpha - Inverse alpha (1 - alpha)
     * @param {Uint8Array|null} clipBuffer - Clip mask (null = no clipping)
     * @param {number} dx - X offset from arc center
     * @param {number} dy - Y offset from arc center
     * @param {number} startCos - cos(startAngle), precomputed
     * @param {number} startSin - sin(startAngle), precomputed
     * @param {number} endCos - cos(endAngle), precomputed
     * @param {number} endSin - sin(endAngle), precomputed
     * @param {boolean} isLargeArc - True if arc spans > 180°
     */
    'BLEND_ALPHA_ARC_FAST_CLIPPED': {
        params: ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha', 'clipBuffer', 'dx', 'dy', 'startCos', 'startSin', 'endCos', 'endSin', 'isLargeArc'],
        code: `{
    const __afterStart = ({{startCos}} * {{dy}} - {{startSin}} * {{dx}}) >= 0;
    const __beforeEnd = ({{endCos}} * {{dy}} - {{endSin}} * {{dx}}) <= 0;
    const __inRange = {{isLargeArc}} ? (__afterStart || __beforeEnd) : (__afterStart && __beforeEnd);
    if (__inRange) {
        if (!{{clipBuffer}} || ({{clipBuffer}}[{{pixelIndex}} >> 3] & (1 << ({{pixelIndex}} & 7)))) {
            const __off = {{pixelIndex}} * 4;
            const __dstA = {{data}}[__off + 3] / 255;
            const __dstAScaled = __dstA * {{invAlpha}};
            const __outA = {{alpha}} + __dstAScaled;
            if (__outA > 0) {
                const __blend = 1 / __outA;
                {{data}}[__off]     = ({{r}} * {{alpha}} + {{data}}[__off] * __dstAScaled) * __blend;
                {{data}}[__off + 1] = ({{g}} * {{alpha}} + {{data}}[__off + 1] * __dstAScaled) * __blend;
                {{data}}[__off + 2] = ({{b}} * {{alpha}} + {{data}}[__off + 2] * __dstAScaled) * __blend;
                {{data}}[__off + 3] = __outA * 255;
            }
        }
    }
}`
    }
};

// Marker pattern: /*@inline:TEMPLATE_NAME(arg1, arg2, ...)*/
// This regex captures the template name and then everything up to the closing */
// We parse the arguments separately to handle nested parentheses
const MARKER_REGEX = /\/\*@inline:(\w+)\(([\s\S]*?)\)\*\//g;

/**
 * Parse comma-separated arguments, handling nested parentheses in expressions.
 * @param {string} argsStr - The arguments string (without outer parens)
 * @returns {string[]} Array of trimmed argument strings
 */
function parseArgs(argsStr) {
    const args = [];
    let depth = 0;
    let current = '';

    for (const ch of argsStr) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }

    if (current.trim()) {
        args.push(current.trim());
    }

    return args;
}

/**
 * Expand a single inline marker into its template code.
 * @param {string} templateName - Name of the template to use
 * @param {string} argsStr - Comma-separated arguments string
 * @returns {string} Expanded code
 * @throws {Error} If template not found or argument count mismatch
 */
function expandMarker(templateName, argsStr) {
    const template = TEMPLATES[templateName];
    if (!template) {
        throw new Error(`Unknown template: ${templateName}`);
    }

    const args = parseArgs(argsStr);
    if (args.length !== template.params.length) {
        throw new Error(`${templateName} expects ${template.params.length} args, got ${args.length}: [${args.join(', ')}]`);
    }

    let code = template.code;
    template.params.forEach((param, i) => {
        // Use global replace to substitute all occurrences of the placeholder
        code = code.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), args[i]);
    });

    return code;
}

/**
 * Preprocess source code, expanding all inline markers.
 * @param {string} source - Source code with markers
 * @param {string} filename - Filename for error messages
 * @returns {string} Processed source with markers expanded
 */
function preprocess(source, filename) {
    return source.replace(MARKER_REGEX, (match, name, args) => {
        try {
            return expandMarker(name, args);
        } catch (e) {
            throw new Error(`Error in ${filename}: ${e.message}`);
        }
    });
}

/**
 * Check if a file contains any inline markers.
 * @param {string} source - Source code to check
 * @returns {boolean} True if markers found
 */
function hasMarkers(source) {
    return MARKER_REGEX.test(source);
}

// CLI entry point
if (require.main === module) {
    const [,, input, output] = process.argv;

    if (!input) {
        console.error('Usage: node preprocess.js <input> [output]');
        console.error('');
        console.error('Expands /*@inline:TEMPLATE(args)*/ markers in source files.');
        console.error('');
        console.error('Available templates:');
        for (const [name, template] of Object.entries(TEMPLATES)) {
            console.error(`  ${name}(${template.params.join(', ')})`);
        }
        process.exit(1);
    }

    try {
        const source = fs.readFileSync(input, 'utf8');
        const result = preprocess(source, input);

        if (output) {
            // Ensure output directory exists
            const outDir = path.dirname(output);
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            fs.writeFileSync(output, result);
        } else {
            process.stdout.write(result);
        }
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}

module.exports = { preprocess, TEMPLATES, hasMarkers, parseArgs, expandMarker };

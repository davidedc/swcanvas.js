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
 * Templates follow two contracts per ARCHITECTURE.md "Check Once, Check Correctly":
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
 * Both preserve the single-clipping-check invariant.
 *
 * Usage:
 *   node preprocess.js <input> [output]
 *
 * If output is omitted, writes to stdout.
 */

const fs = require('fs');
const path = require('path');

// Template definitions - single source of truth for pixel operations
// Two categories of templates:
// - Standard (BLEND_ALPHA, SET_OPAQUE): Caller checks clipping BEFORE marker
// - Clipped (_CLIPPED variants): Include clipping check for per-pixel loops
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

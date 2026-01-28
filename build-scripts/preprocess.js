#!/usr/bin/env node
/**
 * Build-time preprocessor for inline marker expansion.
 *
 * This script expands inline markers of the form:
 *   /\*@inline:TEMPLATE_NAME(args)\*\/
 * into inlined code at build time, eliminating function call overhead in hot pixel loops.
 *
 * CHAINED TEMPLATE EXPANSION:
 * ---------------------------
 * Templates can reference other templates via nested markers. The preprocessor performs
 * multi-pass expansion until no markers remain. Depth protection (default 10 passes)
 * prevents infinite loops from circular references.
 *
 * Template Hierarchy:
 *   Level 0 (Base):     SET_OPAQUE, BLEND_ALPHA
 *   Level 1 (Clipped):  *_CLIPPED → references Level 0
 *   Level 2 (Arc):      *_ARC_FAST_CLIPPED → references Level 1
 *
 * This architecture reduces template code by ~50% while maintaining identical output.
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
 * - Chain to base templates via nested markers
 *
 * Fast Arc Templates (SET_OPAQUE_ARC_FAST_CLIPPED, BLEND_ALPHA_ARC_FAST_CLIPPED):
 * - Include angle range check + bounds check + clipping logic
 * - Use cross-product instead of atan2 for 10-50x faster angle checking
 * - For arc-specific per-pixel loops where angle filtering is required
 * - Chain to clipped templates via nested markers
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

// Import templates from level-based module structure
// See templates/ directory for template definitions organized by hierarchy level
const TEMPLATES = require('./templates');

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
 * Supports chained/nested templates - templates can reference other templates
 * and will be expanded through multiple passes until no markers remain.
 *
 * @param {string} source - Source code with markers
 * @param {string} filename - Filename for error messages
 * @param {number} maxDepth - Maximum expansion depth (default 10, prevents infinite loops)
 * @returns {string} Processed source with markers expanded
 */
function preprocess(source, filename, maxDepth = 10) {
    let result = source;
    let depth = 0;

    while (depth < maxDepth) {
        // CRITICAL: Reset regex lastIndex before each pass
        MARKER_REGEX.lastIndex = 0;

        if (!MARKER_REGEX.test(result)) {
            break;  // No more markers
        }

        // Reset again after test() modified it
        MARKER_REGEX.lastIndex = 0;

        const previousResult = result;
        result = result.replace(MARKER_REGEX, (match, name, args) => {
            try {
                return expandMarker(name, args);
            } catch (e) {
                throw new Error(`Error in ${filename} (depth ${depth}): ${e.message}`);
            }
        });

        if (result === previousResult) {
            throw new Error(`Infinite loop detected in ${filename}: markers not expanding`);
        }

        depth++;
    }

    // Check for unexpanded markers after reaching max depth
    MARKER_REGEX.lastIndex = 0;
    if (MARKER_REGEX.test(result)) {
        throw new Error(`Max expansion depth (${maxDepth}) exceeded in ${filename}`);
    }

    return result;
}

/**
 * Check if a file contains any inline markers.
 * @param {string} source - Source code to check
 * @returns {boolean} True if markers found
 */
function hasMarkers(source) {
    MARKER_REGEX.lastIndex = 0;  // Reset before test (global regex)
    const result = MARKER_REGEX.test(source);
    MARKER_REGEX.lastIndex = 0;  // Reset after test for safety
    return result;
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

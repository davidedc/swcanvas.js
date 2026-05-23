/**
 * CssFontParser
 *
 * Parses a CSS-Canvas font shorthand into BitmapText.FontProperties.
 *
 * Supports the subset of the CSS font spec that BitmapText can actually render:
 *   [<style>] [<weight>] <size>px <family>
 *
 * where:
 *   - <style>  ∈ {normal, italic, oblique}      (default: normal)
 *   - <weight> ∈ {normal, bold, 100..900}        (default: normal)
 *   - <size>   is an integer or float, units 'px' only (no em/%, no line-height)
 *   - <family> is a single family name (quoted or unquoted). Comma-separated
 *              fallback lists are not supported — BitmapText needs one family.
 *
 * Examples that parse:
 *   "16px Arial"
 *   "bold 12px 'Courier New'"
 *   "italic bold 18px Georgia"
 *
 * Examples that throw:
 *   "16em Arial"                (non-px units)
 *   "16px Arial, sans-serif"    (fallback list)
 *   "small-caps 16px Arial"     (font-variant not supported)
 *
 * The parser is deliberately strict so unsupported inputs fail loudly rather
 * than producing misleading text. Callers (CanvasCompatibleContext2D.font
 * setter) should catch and ignore — HTML5 spec says invalid font strings are
 * silently ignored, leaving the previous value in place.
 */
class CssFontParser {
    /**
     * Parse a CSS font string. Returns a plain object with the fields needed
     * to construct a BitmapText.FontProperties — the caller does the actual
     * FontProperties construction (we don't depend on BitmapText here so this
     * file stays a pure utility).
     *
     * @param {string} cssFont - CSS font shorthand
     * @returns {{style: string, weight: string, fontSize: number, fontFamily: string}}
     * @throws {Error} if the string can't be parsed into the supported subset
     */
    static parse(cssFont) {
        if (typeof cssFont !== 'string') {
            throw new Error('CssFontParser.parse: expected string, got ' + typeof cssFont);
        }
        const input = cssFont.trim();
        if (!input) {
            throw new Error('CssFontParser.parse: empty font string');
        }

        // Find the px-size token. It marks the boundary between
        // optional style/weight (before) and family (after).
        // Regex: a number (int or decimal) followed by 'px', as a whole token.
        const sizeMatch = input.match(/(^|\s)(\d+(?:\.\d+)?)px(\s|$)/);
        if (!sizeMatch) {
            throw new Error(
                'CssFontParser.parse: no <size>px token in "' + cssFont + '". ' +
                'Only px units are supported.'
            );
        }
        const fontSize = parseFloat(sizeMatch[2]);
        const sizeStart = input.indexOf(sizeMatch[0]) + sizeMatch[1].length;
        const sizeEnd = sizeStart + sizeMatch[2].length + 2; // 2 = 'px'

        const beforeSize = input.slice(0, sizeStart).trim();
        const afterSize = input.slice(sizeEnd).trim();

        if (!afterSize) {
            throw new Error('CssFontParser.parse: missing font-family in "' + cssFont + '"');
        }
        if (afterSize.indexOf(',') !== -1) {
            throw new Error(
                'CssFontParser.parse: comma-separated font-family list is not supported; ' +
                'BitmapText needs a single family. Got "' + cssFont + '".'
            );
        }

        // Unquote family if needed.
        let fontFamily = afterSize;
        if ((fontFamily.startsWith('"') && fontFamily.endsWith('"')) ||
            (fontFamily.startsWith("'") && fontFamily.endsWith("'"))) {
            fontFamily = fontFamily.slice(1, -1);
        }

        // Parse the optional style/weight prefix.
        let style = 'normal';
        let weight = 'normal';
        if (beforeSize) {
            const tokens = beforeSize.split(/\s+/);
            for (const tok of tokens) {
                if (tok === 'italic' || tok === 'oblique') {
                    style = tok;
                } else if (tok === 'normal') {
                    // Either style or weight default; ignore.
                } else if (tok === 'bold' || tok === 'bolder' || tok === 'lighter') {
                    weight = tok === 'bold' ? 'bold' : 'normal';
                } else if (/^[1-9]00$/.test(tok)) {
                    weight = tok;
                } else {
                    throw new Error(
                        'CssFontParser.parse: unsupported font token "' + tok +
                        '" in "' + cssFont + '". Supported: italic, oblique, bold, ' +
                        'numeric weights 100..900.'
                    );
                }
            }
        }

        return { style: style, weight: weight, fontSize: fontSize, fontFamily: fontFamily };
    }

    /**
     * Format a parsed font shape back into canonical CSS shorthand.
     * Inverse of parse() over the supported subset; matches the HTML5
     * Canvas spec's "serialized form" rules for the `font` IDL getter:
     * default `style`/`weight` omitted, single-space separators, family
     * wrapped in double quotes when it contains whitespace or a comma.
     *
     * @param {{style: string, weight: string, fontSize: number, fontFamily: string}} parsed
     * @returns {string}
     */
    static format(parsed) {
        const parts = [];
        if (parsed.style !== 'normal') parts.push(parsed.style);
        if (parsed.weight !== 'normal') parts.push(parsed.weight);
        parts.push(String(parsed.fontSize) + 'px');
        parts.push(CssFontParser._formatFamily(parsed.fontFamily));
        return parts.join(' ');
    }

    static _formatFamily(name) {
        return /[\s,]/.test(name) ? '"' + name + '"' : name;
    }
}

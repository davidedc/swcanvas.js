/**
 * ColorParser for SWCanvas
 *
 * Parses CSS color strings into RGBA values for use with Core API.
 * Supports hex, RGB/RGBA functions, and named colors.
 * Includes caching for performance optimization.
 *
 * All colors are interpreted as sRGB (no gamma correction applied,
 * matching HTML5 Canvas behavior).
 */
class ColorParser {
    constructor() {
        this._cache = new Map();

        // CSS Color names to RGB mapping - Complete MDN specification
        this._namedColors = {
            // CSS Level 1 colors
            black: { r: 0, g: 0, b: 0 },
            silver: { r: 192, g: 192, b: 192 },
            gray: { r: 128, g: 128, b: 128 },
            white: { r: 255, g: 255, b: 255 },
            maroon: { r: 128, g: 0, b: 0 },
            red: { r: 255, g: 0, b: 0 },
            purple: { r: 128, g: 0, b: 128 },
            fuchsia: { r: 255, g: 0, b: 255 },
            green: { r: 0, g: 128, b: 0 },
            lime: { r: 0, g: 255, b: 0 },
            olive: { r: 128, g: 128, b: 0 },
            yellow: { r: 255, g: 255, b: 0 },
            navy: { r: 0, g: 0, b: 128 },
            blue: { r: 0, g: 0, b: 255 },
            teal: { r: 0, g: 128, b: 128 },
            aqua: { r: 0, g: 255, b: 255 },

            // CSS Level 2 (X11) colors
            aliceblue: { r: 240, g: 248, b: 255 },
            antiquewhite: { r: 250, g: 235, b: 215 },
            aquamarine: { r: 127, g: 255, b: 212 },
            azure: { r: 240, g: 255, b: 255 },
            beige: { r: 245, g: 245, b: 220 },
            bisque: { r: 255, g: 228, b: 196 },
            blanchedalmond: { r: 255, g: 235, b: 205 },
            blueviolet: { r: 138, g: 43, b: 226 },
            brown: { r: 165, g: 42, b: 42 },
            burlywood: { r: 222, g: 184, b: 135 },
            cadetblue: { r: 95, g: 158, b: 160 },
            chartreuse: { r: 127, g: 255, b: 0 },
            chocolate: { r: 210, g: 105, b: 30 },
            coral: { r: 255, g: 127, b: 80 },
            cornflowerblue: { r: 100, g: 149, b: 237 },
            cornsilk: { r: 255, g: 248, b: 220 },
            crimson: { r: 220, g: 20, b: 60 },
            cyan: { r: 0, g: 255, b: 255 }, // synonym of aqua
            darkblue: { r: 0, g: 0, b: 139 },
            darkcyan: { r: 0, g: 139, b: 139 },
            darkgoldenrod: { r: 184, g: 134, b: 11 },
            darkgray: { r: 169, g: 169, b: 169 },
            darkgreen: { r: 0, g: 100, b: 0 },
            darkgrey: { r: 169, g: 169, b: 169 }, // synonym of darkgray
            darkkhaki: { r: 189, g: 183, b: 107 },
            darkmagenta: { r: 139, g: 0, b: 139 },
            darkolivegreen: { r: 85, g: 107, b: 47 },
            darkorange: { r: 255, g: 140, b: 0 },
            darkorchid: { r: 153, g: 50, b: 204 },
            darkred: { r: 139, g: 0, b: 0 },
            darksalmon: { r: 233, g: 150, b: 122 },
            darkseagreen: { r: 143, g: 188, b: 143 },
            darkslateblue: { r: 72, g: 61, b: 139 },
            darkslategray: { r: 47, g: 79, b: 79 },
            darkslategrey: { r: 47, g: 79, b: 79 }, // synonym of darkslategray
            darkturquoise: { r: 0, g: 206, b: 209 },
            darkviolet: { r: 148, g: 0, b: 211 },
            deeppink: { r: 255, g: 20, b: 147 },
            deepskyblue: { r: 0, g: 191, b: 255 },
            dimgray: { r: 105, g: 105, b: 105 },
            dimgrey: { r: 105, g: 105, b: 105 }, // synonym of dimgray
            dodgerblue: { r: 30, g: 144, b: 255 },
            firebrick: { r: 178, g: 34, b: 34 },
            floralwhite: { r: 255, g: 250, b: 240 },
            forestgreen: { r: 34, g: 139, b: 34 },
            gainsboro: { r: 220, g: 220, b: 220 },
            ghostwhite: { r: 248, g: 248, b: 255 },
            gold: { r: 255, g: 215, b: 0 },
            goldenrod: { r: 218, g: 165, b: 32 },
            grey: { r: 128, g: 128, b: 128 }, // synonym of gray
            greenyellow: { r: 173, g: 255, b: 47 },
            honeydew: { r: 240, g: 255, b: 240 },
            hotpink: { r: 255, g: 105, b: 180 },
            indianred: { r: 205, g: 92, b: 92 },
            indigo: { r: 75, g: 0, b: 130 },
            ivory: { r: 255, g: 255, b: 240 },
            khaki: { r: 240, g: 230, b: 140 },
            lavender: { r: 230, g: 230, b: 250 },
            lavenderblush: { r: 255, g: 240, b: 245 },
            lawngreen: { r: 124, g: 252, b: 0 },
            lemonchiffon: { r: 255, g: 250, b: 205 },
            lightblue: { r: 173, g: 216, b: 230 },
            lightcoral: { r: 240, g: 128, b: 128 },
            lightcyan: { r: 224, g: 255, b: 255 },
            lightgoldenrodyellow: { r: 250, g: 250, b: 210 },
            lightgray: { r: 211, g: 211, b: 211 },
            lightgreen: { r: 144, g: 238, b: 144 },
            lightgrey: { r: 211, g: 211, b: 211 }, // synonym of lightgray
            lightpink: { r: 255, g: 182, b: 193 },
            lightsalmon: { r: 255, g: 160, b: 122 },
            lightseagreen: { r: 32, g: 178, b: 170 },
            lightskyblue: { r: 135, g: 206, b: 250 },
            lightslategray: { r: 119, g: 136, b: 153 },
            lightslategrey: { r: 119, g: 136, b: 153 }, // synonym of lightslategray
            lightsteelblue: { r: 176, g: 196, b: 222 },
            lightyellow: { r: 255, g: 255, b: 224 },
            limegreen: { r: 50, g: 205, b: 50 },
            linen: { r: 250, g: 240, b: 230 },
            magenta: { r: 255, g: 0, b: 255 }, // synonym of fuchsia
            mediumaquamarine: { r: 102, g: 205, b: 170 },
            mediumblue: { r: 0, g: 0, b: 205 },
            mediumorchid: { r: 186, g: 85, b: 211 },
            mediumpurple: { r: 147, g: 112, b: 219 },
            mediumseagreen: { r: 60, g: 179, b: 113 },
            mediumslateblue: { r: 123, g: 104, b: 238 },
            mediumspringgreen: { r: 0, g: 250, b: 154 },
            mediumturquoise: { r: 72, g: 209, b: 204 },
            mediumvioletred: { r: 199, g: 21, b: 133 },
            midnightblue: { r: 25, g: 25, b: 112 },
            mintcream: { r: 245, g: 255, b: 250 },
            mistyrose: { r: 255, g: 228, b: 225 },
            moccasin: { r: 255, g: 228, b: 181 },
            navajowhite: { r: 255, g: 222, b: 173 },
            oldlace: { r: 253, g: 245, b: 230 },
            olivedrab: { r: 107, g: 142, b: 35 },
            orange: { r: 255, g: 165, b: 0 },
            orangered: { r: 255, g: 69, b: 0 },
            orchid: { r: 218, g: 112, b: 214 },
            palegoldenrod: { r: 238, g: 232, b: 170 },
            palegreen: { r: 152, g: 251, b: 152 },
            paleturquoise: { r: 175, g: 238, b: 238 },
            palevioletred: { r: 219, g: 112, b: 147 },
            papayawhip: { r: 255, g: 239, b: 213 },
            peachpuff: { r: 255, g: 218, b: 185 },
            peru: { r: 205, g: 133, b: 63 },
            pink: { r: 255, g: 192, b: 203 },
            plum: { r: 221, g: 160, b: 221 },
            powderblue: { r: 176, g: 224, b: 230 },
            rebeccapurple: { r: 102, g: 51, b: 153 }, // CSS Level 4
            rosybrown: { r: 188, g: 143, b: 143 },
            royalblue: { r: 65, g: 105, b: 225 },
            saddlebrown: { r: 139, g: 69, b: 19 },
            salmon: { r: 250, g: 128, b: 114 },
            sandybrown: { r: 244, g: 164, b: 96 },
            seagreen: { r: 46, g: 139, b: 87 },
            seashell: { r: 255, g: 245, b: 238 },
            sienna: { r: 160, g: 82, b: 45 },
            skyblue: { r: 135, g: 206, b: 235 },
            slateblue: { r: 106, g: 90, b: 205 },
            slategray: { r: 112, g: 128, b: 144 },
            slategrey: { r: 112, g: 128, b: 144 }, // synonym of slategray
            snow: { r: 255, g: 250, b: 250 },
            springgreen: { r: 0, g: 255, b: 127 },
            steelblue: { r: 70, g: 130, b: 180 },
            tan: { r: 210, g: 180, b: 140 },
            thistle: { r: 216, g: 191, b: 216 },
            tomato: { r: 255, g: 99, b: 71 },
            turquoise: { r: 64, g: 224, b: 208 },
            violet: { r: 238, g: 130, b: 238 },
            wheat: { r: 245, g: 222, b: 179 },
            whitesmoke: { r: 245, g: 245, b: 245 },
            yellowgreen: { r: 154, g: 205, b: 50 }
        };
    }

    /**
     * Parse a CSS color string to RGBA values
     * @param {string} color - CSS color string
     * @returns {Object} {r, g, b, a} with values 0-255
     */
    parse(color) {
        // Check cache first
        if (this._cache.has(color)) {
            return this._cache.get(color);
        }

        let result;

        if (typeof color !== 'string') {
            result = { r: 0, g: 0, b: 0, a: 255 };
        } else {
            const trimmed = color.trim().toLowerCase();

            if (trimmed.startsWith('#')) {
                result = this._parseHex(trimmed);
            } else if (trimmed.startsWith('rgb')) {
                result = this._parseRGB(trimmed);
            } else if (trimmed.startsWith('hsl')) {
                result = this._parseHSL(trimmed);
            } else if (this._namedColors[trimmed]) {
                const named = this._namedColors[trimmed];
                result = { r: named.r, g: named.g, b: named.b, a: 255 };
            } else {
                // Unknown color - default to black
                result = { r: 0, g: 0, b: 0, a: 255 };
            }
        }

        // Cache the result
        this._cache.set(color, result);
        return result;
    }

    /**
     * Parse hex color (#RGB, #RRGGBB, #RRGGBBAA)
     * @private
     */
    _parseHex(hex) {
        // Remove the #
        hex = hex.substring(1);

        if (hex.length === 3) {
            // #RGB -> #RRGGBB
            hex = hex
                .split('')
                .map(c => c + c)
                .join('');
        }

        if (hex.length === 6) {
            // #RRGGBB
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return { r, g, b, a: 255 };
        } else if (hex.length === 8) {
            // #RRGGBBAA
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const a = parseInt(hex.substring(6, 8), 16);
            return { r, g, b, a };
        }

        // Invalid hex - default to black
        return { r: 0, g: 0, b: 0, a: 255 };
    }

    /**
     * Parse RGB/RGBA function notation
     * @private
     */
    _parseRGB(rgb) {
        // Extract the content inside parentheses
        const match = rgb.match(/rgba?\s*\(\s*([^)]+)\s*\)/);
        if (!match) {
            return { r: 0, g: 0, b: 0, a: 255 };
        }

        const parts = match[1].split(',').map(s => s.trim());

        if (parts.length < 3) {
            return { r: 0, g: 0, b: 0, a: 255 };
        }

        const r = Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0));
        const g = Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0));
        const b = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));

        let a = 255;
        if (parts.length >= 4) {
            const alpha = parseFloat(parts[3]);
            if (!isNaN(alpha)) {
                a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
            }
        }

        return { r, g, b, a };
    }

    /**
     * Parse HSL/HSLA function notation. Supports the comma form
     *   hsl(120, 70%, 32%)
     *   hsla(120, 70%, 32%, 0.5)
     * Hue is in degrees (modulo 360), saturation and lightness as 0-100%,
     * alpha as 0-1. Returns the same {r, g, b, a} shape (0-255 each) as the
     * other parsers.
     * @private
     */
    _parseHSL(hsl) {
        const match = hsl.match(/hsla?\s*\(\s*([^)]+)\s*\)/);
        if (!match) return { r: 0, g: 0, b: 0, a: 255 };
        const parts = match[1].split(',').map(s => s.trim());
        if (parts.length < 3 || parts.length > 4) return { r: 0, g: 0, b: 0, a: 255 };

        // Hue: number (degrees, normalized to [0, 360))
        let h = parseFloat(parts[0]);
        if (isNaN(h)) return { r: 0, g: 0, b: 0, a: 255 };
        h = ((h % 360) + 360) % 360 / 360;

        // Saturation, lightness: percentages
        const parsePct = (s) => {
            const v = parseFloat(s);
            return isNaN(v) ? 0 : Math.max(0, Math.min(100, v)) / 100;
        };
        const s = parsePct(parts[1]);
        const l = parsePct(parts[2]);

        // Alpha: optional, 0-1
        let a = 255;
        if (parts.length === 4) {
            const av = parseFloat(parts[3]);
            if (!isNaN(av)) a = Math.round(Math.max(0, Math.min(1, av)) * 255);
        }

        // Standard HSL → RGB conversion (CSS Color Module Level 3).
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
            a: a
        };
    }

    /**
     * Clear the color cache
     */
    clearCache() {
        this._cache.clear();
    }
}

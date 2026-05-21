/**
 * FontsNamespace — populates SWCanvas.fonts
 *
 * CSS-Font-Loading-API-shaped wrapper over BitmapText's static loader API.
 * Plus an escape hatch (`_raw`) exposing BitmapText internals for advanced
 * use — e.g., the LRU atlas demo, custom loaders.
 *
 * Build wiring: this file runs after BitmapText + the platform FontLoaders.
 * The actual attachment to the SWCanvas global happens in the build.sh
 * footer (see Phase 4.7), where SWCanvas's public surface is assembled.
 */
class FontsNamespace {
    /**
     * Load a font. Accepts either:
     *   - a BitmapText idString:  "density-1-0-Arial-style-normal-weight-normal-size-16-0"
     *   - a descriptor object:    { family, style?, weight?, size, pixelDensity? }
     *
     * @returns {Promise<void>}
     */
    static load(familyOrIdOrDescriptor, options) {
        const idString = FontsNamespace._toIdString(familyOrIdOrDescriptor, options);
        return BitmapText.loadFont(idString, options || {});
    }

    static has(familyOrIdOrDescriptor, options) {
        const idString = FontsNamespace._toIdString(familyOrIdOrDescriptor, options);
        // BitmapText.hasAtlas may return undefined for never-touched ids; force
        // boolean for a stable API.
        return !!BitmapText.hasAtlas(idString);
    }

    static unload(familyOrIdOrDescriptor, options) {
        const idString = FontsNamespace._toIdString(familyOrIdOrDescriptor, options);
        return BitmapText.unloadAtlas(idString);
    }

    /**
     * Convert any accepted input shape into a BitmapText idString.
     *
     * - String containing 'density-' and '-size-' → assumed to be an idString already
     * - Object { family, size, style?, weight?, pixelDensity? } → build via FontProperties
     * - String 'family-name' + options object → build via FontProperties
     */
    static _toIdString(input, options) {
        if (typeof input === 'string' &&
            input.indexOf('density-') === 0 &&
            input.indexOf('-size-') !== -1) {
            return input;
        }
        let family, style, weight, size, pixelDensity;
        if (typeof input === 'string') {
            family = input;
            options = options || {};
            style = options.style || 'normal';
            weight = options.weight || 'normal';
            size = options.size;
            pixelDensity = options.pixelDensity || 1;
        } else if (input && typeof input === 'object') {
            family = input.family;
            style = input.style || 'normal';
            weight = input.weight || 'normal';
            size = input.size;
            pixelDensity = input.pixelDensity || 1;
        }
        if (!family || size === undefined) {
            throw new Error(
                'SWCanvas.fonts: missing family or size. Pass an idString or ' +
                '{ family, size, style?, weight?, pixelDensity? }.'
            );
        }
        return new FontProperties(pixelDensity, family, style, weight, size).idString;
    }
}

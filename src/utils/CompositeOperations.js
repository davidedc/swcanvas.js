/**
 * CompositeOperations utility class for SWCanvas
 *
 * Centralized implementation of HTML5 Canvas globalCompositeOperation modes.
 * Provides optimized blending functions for various composite operations.
 * Supports full Porter-Duff compositing operations and follows Canvas 2D API spec.
 *
 * Supported operations:
 * - source-over (default) - Source drawn on top of destination
 * - destination-over - Source drawn behind destination
 * - source-atop - Source drawn only where destination exists
 * - destination-atop - Destination visible only where source exists
 * - source-in - Source visible only where destination exists
 * - destination-in - Destination visible only where source exists
 * - source-out - Source visible only where destination doesn't exist
 * - destination-out - Destination erased where source exists
 * - xor - Both visible except in overlap areas
 * - copy - Source replaces destination completely
 *
 * The implementation uses a dual rendering approach:
 * - Source-bounded operations (source-over, destination-over, destination-out, xor, source-atop) process only source-covered pixels
 * - Canvas-wide operations (destination-atop, source-in, destination-in, source-out, copy)
 *   use source coverage masks and full-region compositing to correctly handle pixels outside the source area
 */
class CompositeOperations {
    /**
     * Blend two pixels using the specified composite operation
     * @param {string} operation - Composite operation mode
     * @param {number} srcR - Source red (0-255)
     * @param {number} srcG - Source green (0-255)
     * @param {number} srcB - Source blue (0-255)
     * @param {number} srcA - Source alpha (0-255)
     * @param {number} dstR - Destination red (0-255)
     * @param {number} dstG - Destination green (0-255)
     * @param {number} dstB - Destination blue (0-255)
     * @param {number} dstA - Destination alpha (0-255)
     * @returns {Object} Result with {r, g, b, a} properties (0-255)
     */
    static blendPixel(operation, srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA) {
        // Early exit for transparent source
        if (srcA === 0) {
            switch (operation) {
                case 'destination-out':
                    // Transparent source erases nothing
                    return { r: dstR, g: dstG, b: dstB, a: dstA };
                case 'destination-atop':
                    // destination-atop: destination appears only where source exists
                    // No source means destination doesn't appear
                    return { r: 0, g: 0, b: 0, a: 0 };
                case 'source-in':
                case 'destination-in':
                    // No source to blend with
                    return { r: 0, g: 0, b: 0, a: 0 };
                case 'source-out':
                    // source-out: source appears only where destination doesn't exist
                    // No source means result is transparent regardless of destination
                    return { r: 0, g: 0, b: 0, a: 0 };
                case 'copy':
                    // Copy always replaces destination, even with transparent source
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                default:
                    // Transparent source doesn't change destination
                    return { r: dstR, g: dstG, b: dstB, a: dstA };
            }
        }

        // Early exit for transparent destination
        if (dstA === 0) {
            switch (operation) {
                case 'source-over':
                case 'destination-over':
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                case 'source-atop':
                case 'destination-out':
                case 'source-in':
                case 'destination-in':
                    // No destination to blend with
                    return { r: 0, g: 0, b: 0, a: 0 };
                case 'destination-atop':
                    // destination-atop: destination appears only where source exists
                    // No destination to show, so show source
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                case 'source-out':
                case 'xor':
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                case 'copy':
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                default:
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
            }
        }

        // Convert to normalized alpha values (0-1)
        const srcAlpha = srcA / 255;
        const dstAlpha = dstA / 255;

        let resultR, resultG, resultB, resultA;

        switch (operation) {
            case 'source-over':
                return CompositeOperations._sourceOver(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA);

            case 'destination-over':
                // Swap source and destination for destination-over
                return CompositeOperations._sourceOver(dstR, dstG, dstB, dstA, srcR, srcG, srcB, srcA);

            case 'source-atop':
                // Source appears only where destination exists
                // αo = αb, Co = αs × Cs + (1 - αs) × Cb
                // NOTE: This operation works correctly with the current architecture
                resultA = dstA; // Destination alpha
                if (dstA === 0) {
                    // No destination, source doesn't appear
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = Math.round(srcAlpha * srcR + (1 - srcAlpha) * dstR);
                resultG = Math.round(srcAlpha * srcG + (1 - srcAlpha) * dstG);
                resultB = Math.round(srcAlpha * srcB + (1 - srcAlpha) * dstB);
                break;

            case 'destination-atop':
                // Destination appears only where source exists
                // αo = αs, Co = αb × Cb + (1 - αb) × Cs
                resultA = srcA; // Source alpha
                if (srcA === 0) {
                    // No source, destination doesn't appear
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = Math.round(dstAlpha * dstR + (1 - dstAlpha) * srcR);
                resultG = Math.round(dstAlpha * dstG + (1 - dstAlpha) * srcG);
                resultB = Math.round(dstAlpha * dstB + (1 - dstAlpha) * srcB);
                break;

            case 'source-in':
                // Source visible only where destination exists
                // αo = αs × αb, Co = Cs
                resultA = Math.round(srcA * dstAlpha);
                if (resultA === 0) {
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = srcR;
                resultG = srcG;
                resultB = srcB;
                break;

            case 'destination-in':
                // Destination visible only where source exists
                // αo = αb × αs, Co = Cb
                resultA = Math.round(dstA * srcAlpha);
                if (resultA === 0) {
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = dstR;
                resultG = dstG;
                resultB = dstB;
                break;

            case 'source-out':
                // Source visible only where destination doesn't exist
                // αo = αs × (1 - αb), Co = Cs
                resultA = Math.round(srcA * (1 - dstAlpha));
                if (resultA === 0) {
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = srcR;
                resultG = srcG;
                resultB = srcB;
                break;

            case 'destination-out':
                // dst * (1 - srcAlpha)
                resultA = Math.round(dstA * (1 - srcAlpha));
                if (resultA === 0) {
                    return { r: 0, g: 0, b: 0, a: 0 };
                }
                resultR = dstR;
                resultG = dstG;
                resultB = dstB;
                break;

            case 'xor':
                // HTML5 Canvas XOR behavior:
                // - Source over transparent background: show source
                // - Transparent over destination: show destination
                // - Source over opaque destination: transparent (both disappear)

                if (srcAlpha === 0 && dstAlpha === 0) {
                    // Both transparent
                    return { r: 0, g: 0, b: 0, a: 0 };
                } else if (srcAlpha === 0) {
                    // No source - show destination unchanged
                    return { r: dstR, g: dstG, b: dstB, a: dstA };
                } else if (dstAlpha === 0) {
                    // Source over transparent background - show source
                    return { r: srcR, g: srcG, b: srcB, a: srcA };
                } else {
                    // Source over opaque destination - both disappear (XOR effect)
                    return { r: 0, g: 0, b: 0, a: 0 };
                }

            case 'copy':
                // Replace destination completely with source
                // αo = αs, Co = Cs
                return { r: srcR, g: srcG, b: srcB, a: srcA };

            default:
                // Default to source-over for unknown operations
                return CompositeOperations._sourceOver(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA);
        }

        // Clamp results to valid range
        return {
            r: Math.max(0, Math.min(255, Math.round(resultR))),
            g: Math.max(0, Math.min(255, Math.round(resultG))),
            b: Math.max(0, Math.min(255, Math.round(resultB))),
            a: Math.max(0, Math.min(255, Math.round(resultA)))
        };
    }

    /**
     * Optimized source-over implementation
     * @private
     */
    static _sourceOver(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA) {
        // Optimization for opaque source
        if (srcA === 255) {
            return { r: srcR, g: srcG, b: srcB, a: srcA };
        }

        // Standard source-over blending
        const srcAlpha = srcA / 255;
        const invSrcAlpha = 1 - srcAlpha;

        return {
            r: Math.round(srcR * srcAlpha + dstR * invSrcAlpha),
            g: Math.round(srcG * srcAlpha + dstG * invSrcAlpha),
            b: Math.round(srcB * srcAlpha + dstB * invSrcAlpha),
            a: Math.round(srcA + dstA * invSrcAlpha)
        };
    }

    /**
     * Get list of supported composite operations
     * @returns {string[]} Array of supported operation names
     */
    static getSupportedOperations() {
        return [
            'source-over',
            'destination-over',
            'source-atop',
            'destination-atop',
            'source-in',
            'destination-in',
            'source-out',
            'destination-out',
            'xor',
            'copy'
        ];
    }

    /**
     * Check if a composite operation is supported
     * @param {string} operation - Operation name to check
     * @returns {boolean} True if operation is supported
     */
    static isSupported(operation) {
        return CompositeOperations.getSupportedOperations().includes(operation);
    }
}

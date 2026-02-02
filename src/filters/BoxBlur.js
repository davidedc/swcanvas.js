/**
 * BoxBlur class for SWCanvas
 *
 * Implements multi-pass box blur using separable running sum approach for
 * efficient O(n) filtering. Multiple box blur passes approximate Gaussian blur
 * based on the Central Limit Theorem.
 *
 * An alternative Summed Area Table (SAT) implementation is also provided for
 * O(1) lookups at the cost of higher memory usage.
 *
 * This approach matches the reference implementation and provides good
 * performance characteristics for shadow blur effects.
 */
class BoxBlur {
    /**
     * Apply box blur to image data using multi-pass running sum approach
     * @param {Float32Array} data - Image data (alpha values 0-1)
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} blurRadius - Blur radius in pixels
     * @param {number} passes - Number of blur passes (default: 3)
     * @returns {Float32Array} Blurred image data
     */
    static blur(data, width, height, blurRadius, passes = 3) {
        // Validate parameters - internal assertions since BoxBlur is only called by ShadowBuffer
        if (IS_DEBUG) {
            if (!data || !(data instanceof Float32Array)) {
                throw new Error('BoxBlur requires Float32Array data');
            }
            if (typeof width !== 'number' || width <= 0 || typeof height !== 'number' || height <= 0) {
                throw new Error('BoxBlur width and height must be positive numbers');
            }
            if (data.length !== width * height) {
                throw new Error('BoxBlur data length must match width * height');
            }
            if (typeof blurRadius !== 'number' || blurRadius < 0) {
                throw new Error('BoxBlur radius must be a non-negative number');
            }
            if (typeof passes !== 'number' || passes < 1) {
                throw new Error('BoxBlur passes must be at least 1');
            }
        }

        // No blur needed for zero radius
        if (blurRadius === 0) {
            return new Float32Array(data); // Return copy
        }

        // Calculate equivalent box filter width for Gaussian approximation
        // Based on Central Limit Theorem: multiple box filters -> Gaussian
        const sigma = blurRadius / 2.0;
        const boxWidth = Math.floor(Math.max(Math.sqrt((12 * sigma * sigma) / passes + 1), 3));

        // Ensure odd width for symmetric filter
        const finalBoxWidth = boxWidth % 2 === 0 ? boxWidth + 1 : boxWidth;

        // Apply multiple blur passes
        let currentData = new Float32Array(data);

        for (let pass = 0; pass < passes; pass++) {
            currentData = BoxBlur._singleBoxBlurPass(currentData, width, height, finalBoxWidth);
        }

        return currentData;
    }

    /**
     * Apply single box blur pass using separable horizontal/vertical blurs
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} boxWidth - Box filter width (should be odd)
     * @returns {Float32Array} Blurred image data
     * @private
     */
    static _singleBoxBlurPass(data, width, height, boxWidth) {
        const halfBox = Math.floor(boxWidth / 2);

        // First pass: horizontal box blur
        const horizontalData = BoxBlur._horizontalBoxBlur(data, width, height, halfBox);

        // Second pass: vertical box blur on horizontally blurred data
        const verticalData = BoxBlur._verticalBoxBlur(horizontalData, width, height, halfBox);

        return verticalData;
    }

    /**
     * Apply horizontal box blur using running sum
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} radius - Half-width of box filter
     * @returns {Float32Array} Horizontally blurred data
     * @private
     */
    static _horizontalBoxBlur(data, width, height, radius) {
        const result = new Float32Array(data.length);

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;

            // Initialize running sum for first pixel
            let sum = 0;
            let count = 0;

            // Build initial sum
            for (let x = -radius; x <= radius; x++) {
                const srcX = Math.max(0, Math.min(width - 1, x));
                sum += data[rowOffset + srcX];
                count++;
            }

            result[rowOffset] = sum / count;

            // Slide the box across the row
            for (let x = 1; x < width; x++) {
                // Remove leftmost pixel from sum
                const leftX = Math.max(0, Math.min(width - 1, x - radius - 1));
                const rightX = Math.max(0, Math.min(width - 1, x + radius));

                if (x - radius - 1 >= 0) {
                    sum -= data[rowOffset + leftX];
                    count--;
                }

                if (x + radius < width) {
                    sum += data[rowOffset + rightX];
                    count++;
                }

                result[rowOffset + x] = sum / count;
            }
        }

        return result;
    }

    /**
     * Apply vertical box blur using running sum
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} radius - Half-height of box filter
     * @returns {Float32Array} Vertically blurred data
     * @private
     */
    static _verticalBoxBlur(data, width, height, radius) {
        const result = new Float32Array(data.length);

        for (let x = 0; x < width; x++) {
            // Initialize running sum for first pixel
            let sum = 0;
            let count = 0;

            // Build initial sum
            for (let y = -radius; y <= radius; y++) {
                const srcY = Math.max(0, Math.min(height - 1, y));
                sum += data[srcY * width + x];
                count++;
            }

            result[x] = sum / count;

            // Slide the box down the column
            for (let y = 1; y < height; y++) {
                // Remove topmost pixel from sum
                const topY = Math.max(0, Math.min(height - 1, y - radius - 1));
                const bottomY = Math.max(0, Math.min(height - 1, y + radius));

                if (y - radius - 1 >= 0) {
                    sum -= data[topY * width + x];
                    count--;
                }

                if (y + radius < height) {
                    sum += data[bottomY * width + x];
                    count++;
                }

                result[y * width + x] = sum / count;
            }
        }

        return result;
    }

    /**
     * Alternative implementation using full Summed Area Table
     * More memory intensive but demonstrates the SAT approach from reference
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} boxWidth - Box filter width
     * @returns {Float32Array} Blurred image data
     * @private
     */
    static _boxBlurWithSAT(data, width, height, boxWidth) {
        const halfBox = Math.floor(boxWidth / 2);

        // Build Summed Area Table
        const sat = BoxBlur._buildSAT(data, width, height);

        // Apply box filtering using SAT for O(1) lookups
        const result = new Float32Array(data.length);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate box bounds
                const x1 = Math.max(0, x - halfBox);
                const y1 = Math.max(0, y - halfBox);
                const x2 = Math.min(width - 1, x + halfBox);
                const y2 = Math.min(height - 1, y + halfBox);

                // Use SAT to calculate sum in O(1)
                const sum = BoxBlur._getSATSum(sat, width, x1, y1, x2, y2);
                const area = (x2 - x1 + 1) * (y2 - y1 + 1);

                result[y * width + x] = sum / area;
            }
        }

        return result;
    }

    /**
     * Build Summed Area Table for O(1) rectangular sum queries
     * @param {Float32Array} data - Input image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Float32Array} Summed Area Table
     * @private
     */
    static _buildSAT(data, width, height) {
        const sat = new Float32Array(width * height);

        // Fill first row
        sat[0] = data[0];
        for (let x = 1; x < width; x++) {
            sat[x] = data[x] + sat[x - 1];
        }

        // Fill remaining rows
        for (let y = 1; y < height; y++) {
            const rowOffset = y * width;
            const prevRowOffset = (y - 1) * width;

            // First column
            sat[rowOffset] = data[rowOffset] + sat[prevRowOffset];

            // Remaining columns
            for (let x = 1; x < width; x++) {
                sat[rowOffset + x] =
                    data[rowOffset + x] + sat[rowOffset + x - 1] + sat[prevRowOffset + x] - sat[prevRowOffset + x - 1];
            }
        }

        return sat;
    }

    /**
     * Get sum of rectangular region using SAT in O(1) time
     * @param {Float32Array} sat - Summed Area Table
     * @param {number} width - Image width
     * @param {number} x1 - Left boundary (inclusive)
     * @param {number} y1 - Top boundary (inclusive)
     * @param {number} x2 - Right boundary (inclusive)
     * @param {number} y2 - Bottom boundary (inclusive)
     * @returns {number} Sum of values in rectangle
     * @private
     */
    static _getSATSum(sat, width, x1, y1, x2, y2) {
        // Handle edge cases
        if (x1 > x2 || y1 > y2) return 0;

        const bottomRight = sat[y2 * width + x2];
        const topRight = y1 > 0 ? sat[(y1 - 1) * width + x2] : 0;
        const bottomLeft = x1 > 0 ? sat[y2 * width + (x1 - 1)] : 0;
        const topLeft = x1 > 0 && y1 > 0 ? sat[(y1 - 1) * width + (x1 - 1)] : 0;

        return bottomRight - topRight - bottomLeft + topLeft;
    }

    /**
     * Calculate optimal box width for Gaussian approximation
     * @param {number} sigma - Standard deviation of desired Gaussian
     * @param {number} passes - Number of box blur passes
     * @returns {number} Optimal box width (odd integer)
     */
    static calculateBoxWidth(sigma, passes) {
        const width = Math.floor(Math.sqrt((12 * sigma * sigma) / passes + 1));
        return width % 2 === 0 ? width + 1 : width;
    }
}

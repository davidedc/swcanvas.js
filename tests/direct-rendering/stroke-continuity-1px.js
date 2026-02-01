/**
 * 1px Stroke Continuity Checker
 *
 * Verifies that 1px closed strokes have no gaps using 8-connectivity analysis.
 * For continuous 1px strokes, every pixel should have at least 2 neighbors.
 *
 * @module stroke-continuity-1px
 */

/**
 * Checks that a 1px closed stroke has no discontinuities.
 * For a continuous closed 1px stroke, every pixel should have exactly 2 neighbors
 * (using 8-connectivity). A pixel with fewer than 2 neighbors indicates a gap.
 *
 * NOTE: This check only works for 1px strokes. Thicker strokes have interior
 * pixels with more than 2 neighbors.
 *
 * @param {Object} surface - Surface with data, width, height, stride
 * @param {number} r - Red component of stroke color (0-255)
 * @param {number} g - Green component of stroke color (0-255)
 * @param {number} b - Blue component of stroke color (0-255)
 * @param {number} [tolerance=0] - Color matching tolerance
 * @returns {{continuous: boolean, gaps: Array<{x: number, y: number, neighbors: number}>, totalPixels: number}}
 */
function check1pxClosedStrokeContinuity(surface, r, g, b, tolerance = 0) {
    const width = surface.width;
    const height = surface.height;
    const data = surface.data;
    const stride = surface.stride || width * 4;

    const gaps = [];
    let totalPixels = 0;

    // Helper to check if pixel matches stroke color
    const isStrokePixel = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        const idx = y * stride + x * 4;
        return Math.abs(data[idx] - r) <= tolerance &&
               Math.abs(data[idx + 1] - g) <= tolerance &&
               Math.abs(data[idx + 2] - b) <= tolerance &&
               data[idx + 3] > 0;
    };

    // Count 8-connected neighbors
    const countNeighbors = (x, y) => {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                if (isStrokePixel(x + dx, y + dy)) count++;
            }
        }
        return count;
    };

    // Check every stroke pixel
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isStrokePixel(x, y)) {
                totalPixels++;
                const neighbors = countNeighbors(x, y);
                if (neighbors < 2) {
                    gaps.push({ x, y, neighbors });
                }
            }
        }
    }

    return {
        continuous: gaps.length === 0,
        gaps,
        totalPixels
    };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        check1pxClosedStrokeContinuity
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.check1pxClosedStrokeContinuity = check1pxClosedStrokeContinuity;
}

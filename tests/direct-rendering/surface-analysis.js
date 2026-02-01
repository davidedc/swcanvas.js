/**
 * Surface Analysis
 *
 * Pixel-level analysis functions for rendered surfaces.
 * Includes bounds detection, color counting, and speckle detection.
 *
 * @module surface-analysis
 */

/**
 * Clamp checkData bounds to canvas dimensions.
 * When shapes extend beyond canvas edges, rendered pixels are clamped.
 * @param {Object} bounds - Object with topY, bottomY, leftX, rightX
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @returns {Object} Clamped bounds {topY, bottomY, leftX, rightX}
 */
function clampBoundsToCanvas(bounds, canvasWidth, canvasHeight) {
    return {
        topY: Math.max(0, Math.floor(bounds.topY)),
        bottomY: Math.min(canvasHeight - 1, Math.floor(bounds.bottomY)),
        leftX: Math.max(0, Math.floor(bounds.leftX)),
        rightX: Math.min(canvasWidth - 1, Math.floor(bounds.rightX))
    };
}

/**
 * Analyze surface for extreme bounds (leftmost, rightmost, topmost, bottommost non-background pixels)
 * @param {Object} surface - Surface with data, width, height, stride
 * @param {Object} backgroundColor - Background color {r, g, b, a}
 * @param {number} colorTolerance - Max difference from background to still be considered background (0-255)
 * @param {number} alphaThreshold - If background is transparent (a=0), pixels with alpha <= this value
 *                                  are treated as background regardless of RGB (handles AA ghost pixels)
 */
function analyzeExtremes(surface, backgroundColor = { r: 255, g: 255, b: 255, a: 255 }, colorTolerance = 0, alphaThreshold = 0) {
    let topY = surface.height;
    let bottomY = -1;
    let leftX = surface.width;
    let rightX = -1;

    for (let y = 0; y < surface.height; y++) {
        for (let x = 0; x < surface.width; x++) {
            const offset = y * surface.stride + x * 4;
            const r = surface.data[offset];
            const g = surface.data[offset + 1];
            const b = surface.data[offset + 2];
            const a = surface.data[offset + 3];

            // If background is transparent and pixel alpha is below threshold,
            // treat as background regardless of RGB (handles AA ghost pixels like rgba(0,0,255,8))
            if (backgroundColor.a === 0 && a <= alphaThreshold) {
                continue;  // Skip this pixel - it's effectively transparent
            }

            // Check if pixel differs from background (with tolerance)
            const rDiff = Math.abs(r - backgroundColor.r);
            const gDiff = Math.abs(g - backgroundColor.g);
            const bDiff = Math.abs(b - backgroundColor.b);
            const aDiff = Math.abs(a - backgroundColor.a);

            if (rDiff > colorTolerance || gDiff > colorTolerance ||
                bDiff > colorTolerance || aDiff > colorTolerance) {
                if (y < topY) topY = y;
                if (y > bottomY) bottomY = y;
                if (x < leftX) leftX = x;
                if (x > rightX) rightX = x;
            }
        }
    }

    return { topY, bottomY, leftX, rightX };
}

/**
 * Check that rendered shape has consistent width across all content rows
 * and consistent height across all content columns.
 * Detects issues like missing pixels on edges.
 * @param {Object} surface - Surface with data, width, height, stride
 * @param {Object} backgroundColor - Background color {r, g, b, a}
 * @returns {Object} { widthConsistent, heightConsistent, expectedWidth, minWidth, maxWidth,
 *                     expectedHeight, minHeight, maxHeight, issues: string[] }
 */
function checkDimensionConsistency(surface, backgroundColor = { r: 255, g: 255, b: 255, a: 255 }) {
    const issues = [];

    // First get overall bounds
    const extremes = analyzeExtremes(surface, backgroundColor);
    if (extremes.leftX >= surface.width || extremes.rightX < 0) {
        return { widthConsistent: true, heightConsistent: true, issues }; // No content
    }

    const expectedWidth = extremes.rightX - extremes.leftX + 1;
    const expectedHeight = extremes.bottomY - extremes.topY + 1;

    // Check width consistency (scan rows)
    let minRowWidth = expectedWidth, maxRowWidth = expectedWidth;
    let inconsistentWidthRow = null;

    for (let y = extremes.topY; y <= extremes.bottomY; y++) {
        let rowLeft = -1, rowRight = -1;
        for (let x = extremes.leftX; x <= extremes.rightX; x++) {
            const offset = y * surface.stride + x * 4;
            const isBackground =
                surface.data[offset] === backgroundColor.r &&
                surface.data[offset + 1] === backgroundColor.g &&
                surface.data[offset + 2] === backgroundColor.b &&
                surface.data[offset + 3] === backgroundColor.a;
            if (!isBackground) {
                if (rowLeft === -1) rowLeft = x;
                rowRight = x;
            }
        }
        if (rowLeft !== -1) {
            const rowWidth = rowRight - rowLeft + 1;
            if (rowWidth < minRowWidth) { minRowWidth = rowWidth; inconsistentWidthRow = y; }
            if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
        }
    }

    const widthConsistent = minRowWidth === maxRowWidth;
    if (!widthConsistent) {
        issues.push(`Width inconsistent: rows vary from ${minRowWidth} to ${maxRowWidth}px (Y=${inconsistentWidthRow})`);
    }

    // Check height consistency (scan columns)
    let minColHeight = expectedHeight, maxColHeight = expectedHeight;
    let inconsistentHeightCol = null;

    for (let x = extremes.leftX; x <= extremes.rightX; x++) {
        let colTop = -1, colBottom = -1;
        for (let y = extremes.topY; y <= extremes.bottomY; y++) {
            const offset = y * surface.stride + x * 4;
            const isBackground =
                surface.data[offset] === backgroundColor.r &&
                surface.data[offset + 1] === backgroundColor.g &&
                surface.data[offset + 2] === backgroundColor.b &&
                surface.data[offset + 3] === backgroundColor.a;
            if (!isBackground) {
                if (colTop === -1) colTop = y;
                colBottom = y;
            }
        }
        if (colTop !== -1) {
            const colHeight = colBottom - colTop + 1;
            if (colHeight < minColHeight) { minColHeight = colHeight; inconsistentHeightCol = x; }
            if (colHeight > maxColHeight) maxColHeight = colHeight;
        }
    }

    const heightConsistent = minColHeight === maxColHeight;
    if (!heightConsistent) {
        issues.push(`Height inconsistent: columns vary from ${minColHeight} to ${maxColHeight}px (X=${inconsistentHeightCol})`);
    }

    return {
        widthConsistent,
        heightConsistent,
        expectedWidth, minWidth: minRowWidth, maxWidth: maxRowWidth,
        expectedHeight, minHeight: minColHeight, maxHeight: maxColHeight,
        issues
    };
}

/**
 * Count unique colors in the surface
 */
function countUniqueColors(surface) {
    const colors = new Set();

    for (let y = 0; y < surface.height; y++) {
        for (let x = 0; x < surface.width; x++) {
            const offset = y * surface.stride + x * 4;
            const colorKey = `${surface.data[offset]},${surface.data[offset + 1]},${surface.data[offset + 2]},${surface.data[offset + 3]}`;
            colors.add(colorKey);
        }
    }

    return colors.size;
}

/**
 * Check for single-pixel speckles (isolated pixels that differ from their neighbors)
 */
function hasSpeckles(surface, maxSpeckleSize = 1) {
    let speckleCount = 0;

    for (let y = 1; y < surface.height - 1; y++) {
        for (let x = 1; x < surface.width - 1; x++) {
            const offset = y * surface.stride + x * 4;
            const pixel = [
                surface.data[offset],
                surface.data[offset + 1],
                surface.data[offset + 2],
                surface.data[offset + 3]
            ];

            // Check if all 4 neighbors are different
            const neighbors = [
                [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]
            ];

            let allDifferent = true;
            for (const [nx, ny] of neighbors) {
                const nOffset = ny * surface.stride + nx * 4;
                if (surface.data[nOffset] === pixel[0] &&
                    surface.data[nOffset + 1] === pixel[1] &&
                    surface.data[nOffset + 2] === pixel[2] &&
                    surface.data[nOffset + 3] === pixel[3]) {
                    allDifferent = false;
                    break;
                }
            }

            if (allDifferent && pixel[3] > 0) { // Non-transparent isolated pixel
                speckleCount++;
            }
        }
    }

    return speckleCount > 0;
}

/**
 * Count unique colors in the middle row of the surface
 * Skips transparent pixels (alpha === 0)
 * @param {Object} surface - Surface with data, width, height, stride
 * @returns {number} Count of unique non-transparent colors
 */
function countUniqueColorsInMiddleRow(surface) {
    const colors = new Set();
    const middleY = Math.floor(surface.height / 2);

    for (let x = 0; x < surface.width; x++) {
        const offset = middleY * surface.stride + x * 4;
        const a = surface.data[offset + 3];
        if (a === 0) continue; // Skip transparent pixels
        const colorKey = `${surface.data[offset]},${surface.data[offset + 1]},${surface.data[offset + 2]},${a}`;
        colors.add(colorKey);
    }

    return colors.size;
}

/**
 * Count unique colors in the middle column of the surface
 * Skips transparent pixels (alpha === 0)
 * @param {Object} surface - Surface with data, width, height, stride
 * @returns {number} Count of unique non-transparent colors
 */
function countUniqueColorsInMiddleColumn(surface) {
    const colors = new Set();
    const middleX = Math.floor(surface.width / 2);

    for (let y = 0; y < surface.height; y++) {
        const offset = y * surface.stride + middleX * 4;
        const a = surface.data[offset + 3];
        if (a === 0) continue; // Skip transparent pixels
        const colorKey = `${surface.data[offset]},${surface.data[offset + 1]},${surface.data[offset + 2]},${a}`;
        colors.add(colorKey);
    }

    return colors.size;
}

/**
 * Detect background color by sampling all 4 corners of the surface.
 * This handles cases where shapes cover some corners (e.g., shapes with negative coordinates).
 * @param {Object} surface - Surface with data, width, height, stride
 * @returns {Object} Background color {r, g, b, a}
 */
function detectBackgroundColor(surface) {
    const data = surface.data;
    const width = surface.width;
    const height = surface.height;
    const stride = surface.stride || width * 4;

    // Sample all 4 corners
    const corners = [
        0,                                          // top-left
        (width - 1) * 4,                            // top-right
        (height - 1) * stride,                      // bottom-left
        (height - 1) * stride + (width - 1) * 4    // bottom-right
    ];

    // Look for a corner that represents actual background
    for (const offset of corners) {
        const r = data[offset], g = data[offset + 1], b = data[offset + 2], a = data[offset + 3];

        if (a === 0) {
            // Found transparent corner - background is transparent
            return { r: 0, g: 0, b: 0, a: 0 };
        }
        if (r === 255 && g === 255 && b === 255 && a === 255) {
            // Found white corner - background is white
            return { r: 255, g: 255, b: 255, a: 255 };
        }
    }

    // Default to white if no definitive background found
    return { r: 255, g: 255, b: 255, a: 255 };
}

/**
 * Get adjusted expected color count based on background transparency.
 * If background is transparent, reduces expected count by 1 since transparent
 * pixels are not counted by countUniqueColors functions.
 * @param {number} configuredCount - The expected count from test config
 * @param {Object} surface - Surface with data array
 * @returns {number} Adjusted expected count
 */
function getAdjustedExpectedColorCount(configuredCount, surface) {
    const backgroundColor = detectBackgroundColor(surface);
    const backgroundIsTransparent = backgroundColor.a === 0;
    return configuredCount - (backgroundIsTransparent ? 1 : 0);
}

/**
 * Count speckles in the surface
 * A speckle is a pixel that differs from its neighbors when those neighbors match each other
 * @param {Object} surface - Surface with data, width, height, stride
 * @returns {{count: number, firstSpeckle: {x: number, y: number}|null}} Speckle count and first location
 */
function countSpeckles(surface) {
    let speckleCount = 0;
    let firstSpeckle = null;
    const data = surface.data;
    const width = surface.width;
    const stride = surface.stride;

    for (let y = 1; y < surface.height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const currentIdx = y * stride + x * 4;
            const leftIdx = y * stride + (x - 1) * 4;
            const rightIdx = y * stride + (x + 1) * 4;
            const topIdx = (y - 1) * stride + x * 4;
            const bottomIdx = (y + 1) * stride + x * 4;

            // Check if horizontal neighbors match
            const horizontalMatch =
                data[leftIdx] === data[rightIdx] &&
                data[leftIdx + 1] === data[rightIdx + 1] &&
                data[leftIdx + 2] === data[rightIdx + 2] &&
                data[leftIdx + 3] === data[rightIdx + 3];

            // Check if vertical neighbors match
            const verticalMatch =
                data[topIdx] === data[bottomIdx] &&
                data[topIdx + 1] === data[bottomIdx + 1] &&
                data[topIdx + 2] === data[bottomIdx + 2] &&
                data[topIdx + 3] === data[bottomIdx + 3];

            // Check if current pixel differs from neighbors
            const differentFromHorizontal =
                data[currentIdx] !== data[leftIdx] ||
                data[currentIdx + 1] !== data[leftIdx + 1] ||
                data[currentIdx + 2] !== data[leftIdx + 2] ||
                data[currentIdx + 3] !== data[leftIdx + 3];

            const differentFromVertical =
                data[currentIdx] !== data[topIdx] ||
                data[currentIdx + 1] !== data[topIdx + 1] ||
                data[currentIdx + 2] !== data[topIdx + 2] ||
                data[currentIdx + 3] !== data[topIdx + 3];

            if ((horizontalMatch && differentFromHorizontal) ||
                (verticalMatch && differentFromVertical)) {
                speckleCount++;
                if (!firstSpeckle) {
                    firstSpeckle = { x, y };
                }
            }
        }
    }

    return { count: speckleCount, firstSpeckle };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        clampBoundsToCanvas,
        analyzeExtremes,
        checkDimensionConsistency,
        countUniqueColors,
        countUniqueColorsInMiddleRow,
        countUniqueColorsInMiddleColumn,
        detectBackgroundColor,
        getAdjustedExpectedColorCount,
        hasSpeckles,
        countSpeckles
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.clampBoundsToCanvas = clampBoundsToCanvas;
    window.analyzeExtremes = analyzeExtremes;
    window.checkDimensionConsistency = checkDimensionConsistency;
    window.countUniqueColors = countUniqueColors;
    window.countUniqueColorsInMiddleRow = countUniqueColorsInMiddleRow;
    window.countUniqueColorsInMiddleColumn = countUniqueColorsInMiddleColumn;
    window.detectBackgroundColor = detectBackgroundColor;
    window.getAdjustedExpectedColorCount = getAdjustedExpectedColorCount;
    window.hasSpeckles = hasSpeckles;
    window.countSpeckles = countSpeckles;
}

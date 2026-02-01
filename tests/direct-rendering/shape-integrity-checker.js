/**
 * Shape Integrity Checker
 *
 * Universal validation for closed convex shapes (circles, rectangles, rounded rects).
 * Supports stroke-only, fill-only, and fill+stroke modes with pattern analysis.
 *
 * @module shape-integrity-checker
 */

// Node.js: import dependencies (browser uses window globals at call time)
let _nodeAnalyzeExtremes, _nodeDetectBackgroundColor, _nodeClassifyPixel;
let _nodeStandardStrokeColor, _nodeStandardFillColor;

if (typeof module !== 'undefined' && module.exports) {
    const surfaceAnalysis = require('./surface-analysis.js');
    const colorMatching = require('./color-matching.js');

    _nodeAnalyzeExtremes = surfaceAnalysis.analyzeExtremes;
    _nodeDetectBackgroundColor = surfaceAnalysis.detectBackgroundColor;
    _nodeClassifyPixel = colorMatching.classifyPixel;
    _nodeStandardStrokeColor = colorMatching.STANDARD_STROKE_COLOR;
    _nodeStandardFillColor = colorMatching.STANDARD_FILL_COLOR;
}

/**
 * Scans rows vertically and analyzes pixel patterns for stroke continuity.
 * Used by checkShapeIntegrity.
 * @private
 */
function scanVertically(surface, extremes, transitionPattern) {
    const { leftX, rightX, topY, bottomY } = extremes;
    const data = surface.data;
    const stride = surface.stride || surface.width * 4;

    // Scan each row from top to bottom
    for (let y = topY; y <= bottomY; y++) {
        // Track contiguous pixel groups in the current row
        const contiguousGroups = [];
        let currentGroup = null;

        // Scan this row from left to right
        for (let x = leftX; x <= rightX; x++) {
            const idx = y * stride + x * 4;
            const isPixelTransparent = data[idx + 3] === 0;

            if (!isPixelTransparent) {
                // Start a new group or extend current group
                if (currentGroup === null) {
                    currentGroup = { startX: x, endX: x };
                } else {
                    currentGroup.endX = x;
                }
            } else if (currentGroup !== null) {
                // End of a group
                contiguousGroups.push(currentGroup);
                currentGroup = null;
            }
        }

        // Add the last group if it exists
        if (currentGroup !== null) {
            contiguousGroups.push(currentGroup);
        }

        // Categorize the pattern for this row
        let rowPattern = '';
        if (contiguousGroups.length === 0) {
            rowPattern = 'empty';
        } else if (contiguousGroups.length === 1) {
            rowPattern = 'solid';
        } else if (contiguousGroups.length === 2) {
            rowPattern = 'sides';
        } else {
            rowPattern = 'fragmented';
        }

        // Add the pattern to our transition sequence (only if different from previous)
        if (transitionPattern.length === 0 || transitionPattern[transitionPattern.length - 1].pattern !== rowPattern) {
            transitionPattern.push({ pos: y, pattern: rowPattern, groupCount: contiguousGroups.length });
        }
    }
}

/**
 * Scans columns horizontally and analyzes pixel patterns for stroke continuity.
 * Used by checkShapeIntegrity.
 * @private
 */
function scanHorizontally(surface, extremes, transitionPattern) {
    const { leftX, rightX, topY, bottomY } = extremes;
    const data = surface.data;
    const stride = surface.stride || surface.width * 4;

    // Scan each column from left to right
    for (let x = leftX; x <= rightX; x++) {
        // Track contiguous pixel groups in the current column
        const contiguousGroups = [];
        let currentGroup = null;

        // Scan this column from top to bottom
        for (let y = topY; y <= bottomY; y++) {
            const idx = y * stride + x * 4;
            const isPixelTransparent = data[idx + 3] === 0;

            if (!isPixelTransparent) {
                // Start a new group or extend current group
                if (currentGroup === null) {
                    currentGroup = { startY: y, endY: y };
                } else {
                    currentGroup.endY = y;
                }
            } else if (currentGroup !== null) {
                // End of a group
                contiguousGroups.push(currentGroup);
                currentGroup = null;
            }
        }

        // Add the last group if it exists
        if (currentGroup !== null) {
            contiguousGroups.push(currentGroup);
        }

        // Categorize the pattern for this column
        let colPattern = '';
        if (contiguousGroups.length === 0) {
            colPattern = 'empty';
        } else if (contiguousGroups.length === 1) {
            colPattern = 'solid';
        } else if (contiguousGroups.length === 2) {
            colPattern = 'sides';
        } else {
            colPattern = 'fragmented';
        }

        // Add the pattern to our transition sequence (only if different from previous)
        if (transitionPattern.length === 0 || transitionPattern[transitionPattern.length - 1].pattern !== colPattern) {
            transitionPattern.push({ pos: x, pattern: colPattern, groupCount: contiguousGroups.length });
        }
    }
}

/**
 * Finds the extent (first and last non-transparent pixel) on a scanline.
 * @param {Object} surface - Surface with data, width, height, stride
 * @param {number} fixedCoord - The fixed coordinate (y for row scan, x for column scan)
 * @param {boolean} isVertical - true = scan row (varying x), false = scan column (varying y)
 * @param {Object} extremes - {leftX, rightX, topY, bottomY}
 * @returns {{first: number, last: number}} first/last index, or {-1, -1} if empty
 * @private
 */
function scanLineExtent(surface, fixedCoord, isVertical, extremes) {
    const { leftX, rightX, topY, bottomY } = extremes;
    const data = surface.data;
    const stride = surface.stride || surface.width * 4;

    const start = isVertical ? leftX : topY;
    const end = isVertical ? rightX : bottomY;

    let first = -1, last = -1;

    for (let i = start; i <= end; i++) {
        const x = isVertical ? i : fixedCoord;
        const y = isVertical ? fixedCoord : i;
        const idx = y * stride + x * 4;

        if (data[idx + 3] > 0) {
            if (first === -1) first = i;
            last = i;
        }
    }

    return { first, last };
}

/**
 * Verifies a scanline for gaps and optionally edge colors.
 * Used for fill-only and fill+stroke shape integrity checks.
 * @param {Object} surface - Surface with data, width, height, stride
 * @param {number} fixedCoord - The fixed coordinate (y for row scan, x for column scan)
 * @param {boolean} isVertical - true = scan row (varying x), false = scan column (varying y)
 * @param {Object} extremes - {leftX, rightX, topY, bottomY}
 * @param {Object} options - {checkEdges, strokeColor, fillColor, colorTolerance}
 * @param {string[]} issues - Array to push issues to
 * @private
 */
function verifyScanLine(surface, fixedCoord, isVertical, extremes, options, issues) {
    const { first, last } = scanLineExtent(surface, fixedCoord, isVertical, extremes);
    if (first === -1) return; // Empty scanline

    const data = surface.data;
    const stride = surface.stride || surface.width * 4;
    const _classifyPixel = _nodeClassifyPixel || (typeof window !== 'undefined' && window.classifyPixel);

    // Helper to get coordinates from index
    const getCoords = (i) => isVertical ? { x: i, y: fixedCoord } : { x: fixedCoord, y: i };

    // 1. Check for internal gaps (transparent pixels within shape)
    for (let i = first + 1; i < last; i++) {
        const { x, y } = getCoords(i);
        const idx = y * stride + x * 4;

        if (data[idx + 3] === 0) {
            issues.push(`Gap: transparent pixel at (${x}, ${y})`);
            return; // Fail fast - one gap per scanline is enough
        }
    }

    // 2. Check edge colors (if fill+stroke mode)
    if (options.checkEdges) {
        const { strokeColor, fillColor, colorTolerance } = options;

        const checkEdge = (i) => {
            const { x, y } = getCoords(i);
            const idx = y * stride + x * 4;
            const pixelType = _classifyPixel(
                data[idx], data[idx + 1], data[idx + 2],
                strokeColor, fillColor, colorTolerance
            );

            // Edge must be stroke or unknown (blend). Cannot be fill.
            if (pixelType === 'fill') {
                issues.push(`Fill overspill: extends past stroke at (${x}, ${y})`);
            }
        };

        checkEdge(first);
        checkEdge(last);
    }
}

/**
 * Validates the transition pattern sequence for stroke continuity.
 * Valid sequences are:
 * - solid only (small shape)
 * - solid → sides → solid (normal shape with caps and sides)
 * @private
 * @returns {{valid: boolean, issue: string|null}}
 */
function validateTransitionPattern(transitionPattern, isHorizontal) {
    const directionLabel = isHorizontal ? 'column' : 'row';
    let currentState = 'start';

    for (let i = 0; i < transitionPattern.length; i++) {
        const { pattern, pos, groupCount } = transitionPattern[i];

        switch (currentState) {
            case 'start':
                if (pattern === 'solid') {
                    currentState = 'firstCap';
                } else if (pattern === 'sides') {
                    // Large shapes may start with sides when first cap is outside canvas
                    currentState = 'sides';
                } else if (pattern === 'fragmented') {
                    return { valid: false, issue: `Fragmented pattern (${groupCount} groups) at ${directionLabel} ${pos}` };
                }
                break;

            case 'firstCap':
                if (pattern === 'sides') {
                    currentState = 'sides';
                } else if (pattern === 'fragmented') {
                    return { valid: false, issue: `Fragmented pattern (${groupCount} groups) at ${directionLabel} ${pos}` };
                } else if (pattern === 'empty') {
                    return { valid: false, issue: `Unexpected empty ${directionLabel} at ${pos}` };
                }
                // solid continues in firstCap
                break;

            case 'sides':
                if (pattern === 'solid') {
                    currentState = 'secondCap';
                } else if (pattern === 'fragmented') {
                    return { valid: false, issue: `Fragmented pattern (${groupCount} groups) at ${directionLabel} ${pos}` };
                } else if (pattern === 'empty') {
                    return { valid: false, issue: `Unexpected empty ${directionLabel} at ${pos}` };
                }
                // sides continues in sides
                break;

            case 'secondCap':
                if (pattern === 'sides') {
                    // Arc gap can create sides pattern in second cap - allow transition back to sides
                    currentState = 'sidesAfterSecondCap';
                } else if (pattern === 'fragmented') {
                    return { valid: false, issue: `Fragmented pattern (${groupCount} groups) in second cap at ${directionLabel} ${pos}` };
                } else if (pattern !== 'solid') {
                    return { valid: false, issue: `Expected solid pattern for second cap, got ${pattern} at ${directionLabel} ${pos}` };
                }
                // solid continues in secondCap
                break;

            case 'sidesAfterSecondCap':
                if (pattern === 'solid') {
                    currentState = 'finalCap';
                } else if (pattern === 'fragmented') {
                    return { valid: false, issue: `Fragmented pattern (${groupCount} groups) after second cap at ${directionLabel} ${pos}` };
                } else if (pattern === 'empty') {
                    return { valid: false, issue: `Unexpected empty ${directionLabel} at ${pos}` };
                }
                // sides continues
                break;

            case 'finalCap':
                if (pattern === 'sides') {
                    // Can have multiple gap crossings
                    currentState = 'sidesAfterSecondCap';
                } else if (pattern === 'fragmented') {
                    return { valid: false, issue: `Fragmented pattern (${groupCount} groups) in final cap at ${directionLabel} ${pos}` };
                } else if (pattern === 'empty') {
                    return { valid: false, issue: `Unexpected empty ${directionLabel} at ${pos}` };
                }
                // solid continues in finalCap
                break;
        }
    }

    // Check final state - must end in firstCap (small shape), sides (large shape clipped),
    // secondCap (normal shape), or finalCap (arc with gap)
    if (currentState !== 'firstCap' && currentState !== 'sides' &&
        currentState !== 'secondCap' && currentState !== 'finalCap') {
        return { valid: false, issue: 'Incomplete stroke pattern' };
    }

    return { valid: true, issue: null };
}

/**
 * Universal shape integrity check that works for:
 * - Stroke-only shapes (hasStroke: true, hasFill: false): checks for holes using pattern analysis
 * - Fill-only shapes (hasStroke: false, hasFill: true): checks for transparent gaps
 * - Fill+Stroke shapes (hasStroke: true, hasFill: true): checks for gaps AND verifies fill is contained within stroke
 *
 * Algorithm (stroke-only):
 * 1. Scans each row/column within shape extremes
 * 2. Categorizes each as: empty, solid (1 group), sides (2 groups), fragmented (3+ groups)
 * 3. Validates sequence: start → firstCap (solid) → sides → secondCap (solid)
 * 4. 'fragmented' pattern indicates gaps/holes
 *
 * Algorithm (fill-only):
 * 1. Scans each row/column within shape extremes
 * 2. Checks for transparent pixels within shape (gaps in fill)
 *
 * Algorithm (fill+stroke):
 * 1. Scans each row/column within shape extremes
 * 2. Checks for transparent pixels within shape (gaps between fill and stroke)
 * 3. Verifies outermost pixels are stroke color (fill must not overspill)
 *
 * LIMITATIONS: Only works for closed convex shapes (circles, rectangles, rounded rects).
 *
 * @param {Object} surface - Surface with data, width, height, stride
 * @param {Object} options - Configuration
 * @param {boolean} [options.hasStroke=true] - Whether shape has a stroke
 * @param {boolean} [options.hasFill=false] - Whether shape has a fill
 * @param {boolean} [options.verticalScan=true] - Scan rows
 * @param {boolean} [options.horizontalScan=true] - Scan columns
 * @param {number[]} [options.strokeColor] - [r, g, b] stroke color (default: standard red)
 * @param {number[]} [options.fillColor] - [r, g, b] fill color (default: standard blue)
 * @param {number} [options.colorTolerance=30] - Max color difference
 * @returns {{valid: boolean, issues: string[]}}
 */
function checkShapeIntegrity(surface, options = {}) {
    // Get dependencies from module scope or window (browser)
    const _STANDARD_STROKE_COLOR = _nodeStandardStrokeColor || (typeof window !== 'undefined' && window.STANDARD_STROKE_COLOR);
    const _STANDARD_FILL_COLOR = _nodeStandardFillColor || (typeof window !== 'undefined' && window.STANDARD_FILL_COLOR);
    const _detectBackgroundColor = _nodeDetectBackgroundColor || (typeof window !== 'undefined' && window.detectBackgroundColor);
    const _analyzeExtremes = _nodeAnalyzeExtremes || (typeof window !== 'undefined' && window.analyzeExtremes);

    const {
        hasStroke = true,
        hasFill = false,
        strokeColor = _STANDARD_STROKE_COLOR,
        fillColor = _STANDARD_FILL_COLOR,
        colorTolerance = 30,
        verticalScan = true,
        horizontalScan = true
    } = options;
    const issues = [];

    // Validate configuration
    if (!hasStroke && !hasFill) {
        issues.push('Invalid config: at least one of hasStroke or hasFill must be true');
        return { valid: false, issues };
    }

    // Auto-detect background color by sampling all corners
    const backgroundColor = _detectBackgroundColor(surface);

    // Get shape bounds using detected background
    const extremes = _analyzeExtremes(surface, backgroundColor);

    // If no non-background pixels found
    if (extremes.leftX >= surface.width || extremes.rightX < 0 ||
        extremes.topY >= surface.height || extremes.bottomY < 0) {
        issues.push('No non-background pixels found');
        return { valid: false, issues };
    }

    if (hasStroke && hasFill) {
        // Fill+Stroke mode: check for gaps AND verify edges are stroke color
        const scanOptions = { checkEdges: true, strokeColor, fillColor, colorTolerance };
        if (verticalScan) {
            for (let y = extremes.topY; y <= extremes.bottomY; y++) {
                verifyScanLine(surface, y, true, extremes, scanOptions, issues);
            }
        }
        if (horizontalScan) {
            for (let x = extremes.leftX; x <= extremes.rightX; x++) {
                verifyScanLine(surface, x, false, extremes, scanOptions, issues);
            }
        }
    } else if (hasStroke && !hasFill) {
        // Stroke-only mode: check for pattern fragmentation (holes)
        if (verticalScan) {
            const verticalPattern = [];
            scanVertically(surface, extremes, verticalPattern);
            const verticalResult = validateTransitionPattern(verticalPattern, false);
            if (!verticalResult.valid) {
                issues.push(`Vertical: ${verticalResult.issue}`);
            }
        }
        if (horizontalScan) {
            const horizontalPattern = [];
            scanHorizontally(surface, extremes, horizontalPattern);
            const horizontalResult = validateTransitionPattern(horizontalPattern, true);
            if (!horizontalResult.valid) {
                issues.push(`Horizontal: ${horizontalResult.issue}`);
            }
        }
    } else if (!hasStroke && hasFill) {
        // Fill-only mode: check for gaps only (no edge color check)
        const scanOptions = { checkEdges: false };
        if (verticalScan) {
            for (let y = extremes.topY; y <= extremes.bottomY; y++) {
                verifyScanLine(surface, y, true, extremes, scanOptions, issues);
            }
        }
        if (horizontalScan) {
            for (let x = extremes.leftX; x <= extremes.rightX; x++) {
                verifyScanLine(surface, x, false, extremes, scanOptions, issues);
            }
        }
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkShapeIntegrity
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.checkShapeIntegrity = checkShapeIntegrity;
}

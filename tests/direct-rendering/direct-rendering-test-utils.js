/**
 * Direct Rendering Test Utilities for SWCanvas
 *
 * Provides test registration, SeededRandom, and validation utilities
 * for testing direct shape APIs with direct rendering verification.
 */

// Test registry - stores all registered tests
const DIRECT_RENDERING_TESTS = [];

// Performance test registry - stores tests with perfName for performance testing
const DIRECT_RENDERING_PERF_REGISTRY = [];

/**
 * SeededRandom - Deterministic random number generator for reproducible tests
 * Uses Small Fast Counter (SFC) 32-bit implementation
 */
class SeededRandom {
    static #currentRandom = null;

    static seedWithInteger(seed) {
        // XOR the seed with a constant value
        seed = seed ^ 0xDEADBEEF;

        // Pad seed with Phi, Pi and E.
        this.#currentRandom = this.#sfc32(0x9E3779B9, 0x243F6A88, 0xB7E15162, seed);

        // Warm up the generator
        for (let i = 0; i < 15; i++) {
            this.#currentRandom();
        }
    }

    static getRandom() {
        if (!this.#currentRandom) {
            throw new Error('SeededRandom must be initialized with seedWithInteger before use');
        }
        return this.#currentRandom();
    }

    // Small Fast Counter (SFC) 32-bit implementation
    static #sfc32(a, b, c, d) {
        return function () {
            a |= 0; b |= 0; c |= 0; d |= 0;
            let t = (a + b | 0) + d | 0;
            d = d + 1 | 0;
            a = b ^ b >>> 9;
            b = c + (c << 3) | 0;
            c = (c << 21 | c >>> 11);
            c = c + t | 0;
            return (t >>> 0) / 4294967296;
        };
    }
}

/**
 * Get a random color for testing
 * @param {string} mode - 'opaque', 'semitransparent', 'semitransparent-light',
 *                        'semitransparent-visible', 'mixed', or 'mixed-visible'
 *   - 'semitransparent-visible': Guarantees color remains visible on white background
 *     with colorTolerance up to ~15 (at least one channel is dark enough after blending)
 * @returns {string} CSS color string
 */
function getRandomColor(mode = 'opaque') {
    const r = Math.floor(SeededRandom.getRandom() * 256);
    const g = Math.floor(SeededRandom.getRandom() * 256);
    const b = Math.floor(SeededRandom.getRandom() * 256);

    let alpha;
    switch (mode) {
        case 'opaque':
            return `rgb(${r}, ${g}, ${b})`;
        case 'semitransparent':
            // Alpha range 100-200 (out of 255) -> ~0.39-0.78
            alpha = (100 + Math.floor(SeededRandom.getRandom() * 101)) / 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        case 'semitransparent-light':
            // Alpha range 50-150 (out of 255) -> ~0.20-0.59
            alpha = (50 + Math.floor(SeededRandom.getRandom() * 101)) / 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        case 'mixed':
            // 50% chance opaque, 50% chance semitransparent
            if (SeededRandom.getRandom() < 0.5) {
                return `rgb(${r}, ${g}, ${b})`;
            } else {
                alpha = (100 + Math.floor(SeededRandom.getRandom() * 101)) / 255;
                return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
            }
        case 'semitransparent-visible':
            // Generates colors guaranteed to be visible on white background
            // with colorTolerance up to ~15
            // Ensures at least one channel is dark enough to remain visible after blending
            alpha = (100 + Math.floor(SeededRandom.getRandom() * 101)) / 255;  // 0.39-0.78

            // To guarantee visibility: at least one channel must be < 255 - tolerance/alpha
            // With tolerance=15 and alpha=0.39 (worst case): channel < 255 - 38.5 ≈ 216
            // We'll ensure the darkest channel is at most 200 for safety margin
            const maxForVisibility = 200;

            // Generate all three channels
            let rv = Math.floor(SeededRandom.getRandom() * 256);
            let gv = Math.floor(SeededRandom.getRandom() * 256);
            let bv = Math.floor(SeededRandom.getRandom() * 256);

            // Ensure at least one channel is dark enough
            const minChannel = Math.min(rv, gv, bv);
            if (minChannel > maxForVisibility) {
                // Pick a random channel to make dark
                const channelToFix = Math.floor(SeededRandom.getRandom() * 3);
                if (channelToFix === 0) rv = Math.floor(SeededRandom.getRandom() * (maxForVisibility + 1));
                else if (channelToFix === 1) gv = Math.floor(SeededRandom.getRandom() * (maxForVisibility + 1));
                else bv = Math.floor(SeededRandom.getRandom() * (maxForVisibility + 1));
            }

            return `rgba(${rv}, ${gv}, ${bv}, ${alpha.toFixed(2)})`;
        case 'mixed-visible':
            // 50% opaque, 50% semitransparent-visible
            if (SeededRandom.getRandom() < 0.5) {
                return `rgb(${r}, ${g}, ${b})`;
            } else {
                return getRandomColor('semitransparent-visible');
            }
        default:
            return `rgb(${r}, ${g}, ${b})`;
    }
}

/**
 * Get a random point within canvas bounds
 * @param {number} decimalPlaces - Number of decimal places (null for full precision)
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} margin - Margin from edges (default 100)
 * @returns {Object} Point with x, y coordinates
 */
function getRandomPoint(decimalPlaces = null, canvasWidth, canvasHeight, margin = 100) {
    const x = margin + SeededRandom.getRandom() * (canvasWidth - 2 * margin);
    const y = margin + SeededRandom.getRandom() * (canvasHeight - 2 * margin);

    if (decimalPlaces === null) {
        return { x, y };
    }

    return {
        x: Number(x.toFixed(decimalPlaces)),
        y: Number(y.toFixed(decimalPlaces))
    };
}

/**
 * Places a center point at pixel boundary (*.5 coordinates) relative to canvas center
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Center coordinates {centerX, centerY}
 */
function placeCloseToCenterAtPixel(width, height) {
    return {
        centerX: Math.floor(width / 2) + 0.5,
        centerY: Math.floor(height / 2) + 0.5
    };
}

/**
 * Places a center point at grid intersection (integer coordinates) relative to canvas center
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Center coordinates {centerX, centerY}
 */
function placeCloseToCenterAtGrid(width, height) {
    return {
        centerX: Math.floor(width / 2),
        centerY: Math.floor(height / 2)
    };
}

/**
 * Get a fully opaque random color
 * @returns {string} CSS color string
 */
function getRandomOpaqueColor() {
    const r = Math.floor(100 + SeededRandom.getRandom() * 155);
    const g = Math.floor(100 + SeededRandom.getRandom() * 155);
    const b = Math.floor(100 + SeededRandom.getRandom() * 155);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get a fully opaque random color guaranteed to be visible on white background
 * with colorTolerance up to ~15 (at least one channel is dark enough)
 * @returns {string} CSS color string
 */
function getRandomOpaqueVisibleColor() {
    // Generate channels in range 100-254
    let r = Math.floor(100 + SeededRandom.getRandom() * 155);
    let g = Math.floor(100 + SeededRandom.getRandom() * 155);
    let b = Math.floor(100 + SeededRandom.getRandom() * 155);

    // Ensure at least one channel is dark enough to be visible on white
    // With max 200, difference from white is at least 55 (well above typical tolerance 8-15)
    const maxForVisibility = 200;
    const minChannel = Math.min(r, g, b);

    if (minChannel > maxForVisibility) {
        // Pick a random channel to make darker
        const channelToFix = Math.floor(SeededRandom.getRandom() * 3);
        // Generate in range [100, maxForVisibility]
        const darkValue = Math.floor(100 + SeededRandom.getRandom() * (maxForVisibility - 100 + 1));
        if (channelToFix === 0) r = darkValue;
        else if (channelToFix === 1) g = darkValue;
        else b = darkValue;
    }

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Adjusts dimensions for crisp stroke rendering based on stroke width and center position.
 * For grid-centered shapes (integer coords) with odd strokeWidth: dimensions must be ODD.
 * For grid-centered shapes (integer coords) with even strokeWidth: dimensions must be EVEN.
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @param {number} strokeWidth - Width of the stroke
 * @param {Object} center - Center coordinates {x, y}
 * @returns {Object} Adjusted width and height {width, height}
 */
function adjustDimensionsForCrispStrokeRendering(width, height, strokeWidth, center) {
    let adjustedWidth = Math.floor(width);
    let adjustedHeight = Math.floor(height);

    // For center at grid points (integer coordinates)
    if (Number.isInteger(center.x)) {
        // Odd strokeWidth → odd dimension; Even strokeWidth → even dimension
        if (strokeWidth % 2 !== 0) {
            if (adjustedWidth % 2 === 0) adjustedWidth++;
        } else {
            if (adjustedWidth % 2 !== 0) adjustedWidth++;
        }
    }
    // For center at pixel centers (*.5 coordinates)
    else if (center.x % 1 === 0.5) {
        // Odd strokeWidth → even dimension; Even strokeWidth → odd dimension
        if (strokeWidth % 2 !== 0) {
            if (adjustedWidth % 2 !== 0) adjustedWidth++;
        } else {
            if (adjustedWidth % 2 === 0) adjustedWidth++;
        }
    }

    // Same logic for height/Y
    if (Number.isInteger(center.y)) {
        if (strokeWidth % 2 !== 0) {
            if (adjustedHeight % 2 === 0) adjustedHeight++;
        } else {
            if (adjustedHeight % 2 !== 0) adjustedHeight++;
        }
    } else if (center.y % 1 === 0.5) {
        if (strokeWidth % 2 !== 0) {
            if (adjustedHeight % 2 !== 0) adjustedHeight++;
        } else {
            if (adjustedHeight % 2 === 0) adjustedHeight++;
        }
    }

    return { width: adjustedWidth, height: adjustedHeight };
}

/**
 * Round point coordinates to integers
 * @param {Object} point - Point with x, y coordinates
 * @returns {Object} Rounded point
 */
function roundPoint(point) {
    return {
        x: Math.round(point.x),
        y: Math.round(point.y)
    };
}

/**
 * Ensures a value is at a half-point (.5) for crisp 1px stroke rendering.
 * For 1px strokes, the stroke center must be at .5 to render crisply.
 * @param {number} value - Any numeric value
 * @returns {number} Value adjusted to .5 (e.g., 165 → 165.5, 165.7 → 165.5)
 */
function ensureHalfPoint(value) {
    return Math.floor(value) + 0.5;
}

/**
 * Adjusts center coordinates for crisp 1px stroke rendering
 * For even width+height with 1px stroke, center should be on pixel center (*.5)
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @param {number} strokeWidth - Stroke width
 * @returns {Object} Adjusted center coordinates {x, y}
 */
function adjustCenterForCrispStrokeRendering(centerX, centerY, width, height, strokeWidth) {
    let adjX = centerX;
    let adjY = centerY;

    // For 1px stroke with even dimensions, shift to pixel center
    if (strokeWidth === 1) {
        if (width % 2 === 0 && Number.isInteger(centerX)) {
            adjX = centerX + 0.5;
        }
        if (height % 2 === 0 && Number.isInteger(centerY)) {
            adjY = centerY + 0.5;
        }
    }

    return { x: adjX, y: adjY };
}

/**
 * Calculate crisp fill and stroke rectangle parameters
 * Combines random dimension generation with crisp adjustment
 * @param {Object} options - Configuration options
 * @param {number} options.canvasWidth - Canvas width
 * @param {number} options.canvasHeight - Canvas height
 * @param {number} options.minWidth - Minimum rectangle width (default 50)
 * @param {number} options.maxWidth - Maximum rectangle width (default 400)
 * @param {number} options.minHeight - Minimum rectangle height (default 50)
 * @param {number} options.maxHeight - Maximum rectangle height (default 400)
 * @param {number} options.maxStrokeWidth - Maximum stroke width (default 10)
 * @param {boolean} options.ensureEvenStroke - Force even stroke width (default false)
 * @param {boolean} options.randomPosition - Use random positioning (default false)
 * @returns {Object} { center, adjustedDimensions, strokeWidth }
 */
function calculateCrispFillAndStrokeRectParams(options) {
    const {
        canvasWidth,
        canvasHeight,
        minWidth = 50,
        maxWidth = 400,
        minHeight = 50,
        maxHeight = 400,
        maxStrokeWidth = 10,
        ensureEvenStroke = false,
        randomPosition = false
    } = options;

    // SeededRandom Call 1: baseWidth
    const baseWidth = Math.round(minWidth + SeededRandom.getRandom() * (maxWidth - minWidth));
    // SeededRandom Call 2: baseHeight
    const baseHeight = Math.round(minHeight + SeededRandom.getRandom() * (maxHeight - minHeight));
    // SeededRandom Call 3: strokeWidth (optionally ensure even)
    let strokeWidth = Math.round(2 + SeededRandom.getRandom() * (maxStrokeWidth - 2));
    if (ensureEvenStroke && strokeWidth % 2 !== 0) {
        strokeWidth++;
    }
    // SeededRandom Call 4: center type (grid vs pixel)
    const atPixel = SeededRandom.getRandom() < 0.5;

    // Calculate center
    let center;
    if (randomPosition) {
        const randomPt = getRandomPoint(1, canvasWidth, canvasHeight);
        center = atPixel ? randomPt : roundPoint(randomPt);
    } else {
        center = atPixel
            ? placeCloseToCenterAtPixel(canvasWidth, canvasHeight)
            : placeCloseToCenterAtGrid(canvasWidth, canvasHeight);
        center = { x: center.centerX, y: center.centerY };
    }

    // Adjust dimensions for crisp rendering
    const adjusted = adjustDimensionsForCrispStrokeRendering(
        baseWidth, baseHeight, strokeWidth, center
    );

    return {
        center,
        adjustedDimensions: { width: adjusted.width, height: adjusted.height },
        strokeWidth
    };
}

/**
 * Calculates circle parameters with proper positioning and dimensions.
 *
 * @param {Object} options - Configuration options for circle creation
 * @param {number} options.canvasWidth - Canvas width
 * @param {number} options.canvasHeight - Canvas height
 * @param {number} options.minRadius - Minimum radius for the circle (default 8)
 * @param {number} options.maxRadius - Maximum radius for the circle (default 42)
 * @param {boolean} options.hasStroke - Whether the circle has a stroke (default false)
 * @param {number} options.minStrokeWidth - Minimum stroke width if hasStroke (default 1)
 * @param {number} options.maxStrokeWidth - Maximum stroke width if hasStroke (default 4)
 * @param {boolean} options.randomPosition - Whether to use random positioning (default true)
 * @param {number} options.marginX - Horizontal margin from canvas edges (default 60)
 * @param {number} options.marginY - Vertical margin from canvas edges (default 60)
 * @returns {Object} Calculated circle parameters: {centerX, centerY, radius, strokeWidth, finalDiameter, atPixel}
 */
function calculateCircleTestParameters(options) {
    const {
        canvasWidth,
        canvasHeight,
        minRadius = 8,
        maxRadius = 42,
        hasStroke = false,
        minStrokeWidth = 1,
        maxStrokeWidth = 4,
        randomPosition = true,
        marginX = 60,
        marginY = 60
    } = options;

    // Randomly choose between grid-centered and pixel-centered
    const atPixel = SeededRandom.getRandom() < 0.5;

    // Get initial center point
    let { centerX, centerY } = atPixel
        ? placeCloseToCenterAtPixel(canvasWidth, canvasHeight)
        : placeCloseToCenterAtGrid(canvasWidth, canvasHeight);

    // Calculate base diameter
    const diameter = Math.floor(minRadius * 2 + SeededRandom.getRandom() * (maxRadius * 2 - minRadius * 2));
    const baseRadius = diameter / 2;

    // Calculate stroke width
    const maxAllowedStrokeWidth = Math.floor(baseRadius / 1);
    const strokeWidth = hasStroke
        ? (minStrokeWidth + Math.floor(SeededRandom.getRandom() * Math.min(maxStrokeWidth - minStrokeWidth + 1, maxAllowedStrokeWidth)))
        : 0;

    // Handle random positioning if requested
    if (randomPosition) {
        const totalRadius = baseRadius + (strokeWidth / 2);

        // Calculate safe bounds
        const minX = Math.ceil(totalRadius + marginX);
        const maxX = Math.floor(canvasWidth - totalRadius - marginX);
        const minY = Math.ceil(totalRadius + marginY);
        const maxY = Math.floor(canvasHeight - totalRadius - marginY);

        // Adjust diameter if circle is too large
        let adjustedDiameter = diameter;
        if (maxX <= minX || maxY <= minY) {
            // Circle is too large, reduce diameter to 1/4 of canvas size
            adjustedDiameter = Math.min(
                Math.floor(canvasWidth / 4),
                Math.floor(canvasHeight / 4)
            );

            // Recalculate bounds with reduced diameter
            const newTotalRadius = (adjustedDiameter / 2) + (strokeWidth / 2);
            const newMinX = Math.ceil(newTotalRadius + marginX);
            const newMaxX = Math.floor(canvasWidth - newTotalRadius - marginX);
            const newMinY = Math.ceil(newTotalRadius + marginY);
            const newMaxY = Math.floor(canvasHeight - newTotalRadius - marginY);

            // Generate random position within new safe bounds
            centerX = newMinX + Math.floor(SeededRandom.getRandom() * (newMaxX - newMinX + 1));
            centerY = newMinY + Math.floor(SeededRandom.getRandom() * (newMaxY - newMinY + 1));
        } else {
            // Generate random position within original safe bounds
            centerX = minX + Math.floor(SeededRandom.getRandom() * (maxX - minX + 1));
            centerY = minY + Math.floor(SeededRandom.getRandom() * (maxY - minY + 1));
        }
    }

    // Adjust diameter for crisp circle rendering
    const adjustedDimensions = adjustDimensionsForCrispStrokeRendering(
        diameter, diameter, strokeWidth, { x: centerX, y: centerY }
    );
    const finalDiameter = adjustedDimensions.width;
    const radius = finalDiameter / 2;

    return {
        centerX,
        centerY,
        radius,
        strokeWidth,
        finalDiameter,
        atPixel
    };
}

/**
 * Generate arc angles with gap constrained to a single quadrant.
 * Ensures gap doesn't cross cardinal points (0°, 90°, 180°, 270°).
 * Gap is always ≤ 85° and completely within one quadrant.
 * @returns {Object} { startAngle, endAngle, gapQuadrant, gapSizeDeg }
 */
function generateConstrainedArcAngles() {
    const quadrantBases = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2];
    const gapQuadrant = Math.floor(SeededRandom.getRandom() * 4);
    const quadrantStart = quadrantBases[gapQuadrant];

    const margin = 5 * Math.PI / 180;  // 5° margin from quadrant edges
    const minGapSize = 30 * Math.PI / 180;  // 30° minimum gap
    const maxGapSize = 85 * Math.PI / 180;  // 85° maximum gap

    // Calculate available space for gap start (leaving room for minimum gap + margins)
    const availableForStart = Math.PI / 2 - margin * 2 - minGapSize;
    const gapStartOffset = margin + SeededRandom.getRandom() * Math.max(0, availableForStart);
    const gapStart = quadrantStart + gapStartOffset;

    // Constrain gap size to stay within quadrant
    const maxAllowedGap = Math.min(maxGapSize, quadrantStart + Math.PI / 2 - gapStart - margin);
    const gapSize = minGapSize + SeededRandom.getRandom() * Math.max(0, maxAllowedGap - minGapSize);
    const gapEnd = gapStart + gapSize;

    return {
        startAngle: gapEnd,
        endAngle: gapStart + Math.PI * 2,
        gapQuadrant,
        gapSizeDeg: gapSize * 180 / Math.PI
    };
}

/**
 * Calculate arc test parameters with gap constrained to a single quadrant.
 * Arc extends > 270° (3/4 circle) to include all cardinal points for extremes checks.
 * @param {Object} options - Same as calculateCircleTestParameters
 * @param {number} options.canvasWidth - Canvas width
 * @param {number} options.canvasHeight - Canvas height
 * @param {number} options.minRadius - Minimum radius (default 8)
 * @param {number} options.maxRadius - Maximum radius (default 42)
 * @param {boolean} options.hasStroke - Whether arc has stroke
 * @param {number} options.minStrokeWidth - Minimum stroke width (default 1)
 * @param {number} options.maxStrokeWidth - Maximum stroke width (default 4)
 * @param {boolean} options.randomPosition - Use random position vs centered
 * @param {number} options.marginX - Horizontal margin (default 60)
 * @param {number} options.marginY - Vertical margin (default 60)
 * @returns {Object} Circle params + {startAngle, endAngle, gapQuadrant, gapSizeDeg}
 */
function calculateArcTestParameters(options) {
    // Get base circle parameters
    const circleParams = calculateCircleTestParameters(options);

    // Generate arc angles with gap in single quadrant
    // Quadrant bases (screen coords, Y-down): Q1=0°, Q2=90°, Q3=180°, Q4=270°
    // (In standard math Y-up notation: Q4, Q3, Q2, Q1 respectively)
    const quadrantBases = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2];
    const gapQuadrant = Math.floor(SeededRandom.getRandom() * 4);
    const quadrantStart = quadrantBases[gapQuadrant];

    // Gap position within quadrant (with 5° margin from quadrant edges)
    const margin = 5 * Math.PI / 180; // 5 degrees in radians
    const maxGapSize = 85 * Math.PI / 180; // 85 degrees max gap
    const minGapSize = 30 * Math.PI / 180; // 30 degrees min gap

    // Calculate available space for gap start within quadrant
    // quadrant is 90° (PI/2), we need margin at start and space for gap at end
    const availableForStart = Math.PI / 2 - margin * 2 - minGapSize;
    const gapStartOffset = margin + SeededRandom.getRandom() * Math.max(0, availableForStart);
    const gapStart = quadrantStart + gapStartOffset;

    // Gap size: 30° to 85° (ensures arc > 275°), but must fit within quadrant
    const maxAllowedGap = Math.min(maxGapSize, quadrantStart + Math.PI / 2 - gapStart - margin);
    const gapSize = minGapSize + SeededRandom.getRandom() * Math.max(0, maxAllowedGap - minGapSize);
    const gapEnd = gapStart + gapSize;

    // Arc draws the non-gap portion: startAngle = gapEnd, endAngle = gapStart + 2π
    // This makes the arc go from gapEnd all the way around to gapStart
    return {
        ...circleParams,
        startAngle: gapEnd,
        endAngle: gapStart + Math.PI * 2,
        gapQuadrant,
        gapSizeDeg: gapSize * 180 / Math.PI
    };
}

/**
 * Calculates parameters for a single 90-degree FILL+STROKE arc spanning one quadrant.
 * Used for crisp 90° arc tests with fill and stroke rendered together.
 *
 * IMPORTANT: This function is for FILL+STROKE arcs, not stroke-only!
 *
 * For fill+stroke 90° arcs at cardinal angles:
 * - Fill radial edges are at x=centerX and y=centerY
 * - These must be INTEGER for crisp rendering
 * - Stroke edges must also align with pixel boundaries
 *
 * Constraints:
 * - center: ALWAYS INTEGER (for crisp fill radial edges)
 * - radius: half-integer (*.5) for odd strokeWidth, integer for even strokeWidth
 *
 * This ensures:
 * - Fill radial edges at integer x/y → crisp
 * - Stroke outer: center + radius + strokeWidth/2 = integer
 * - Stroke inner: center + radius - strokeWidth/2 = integer
 *
 * Example with odd strokeWidth = 1:
 *   center = (200, 150), radius = 65.5
 *   Stroke outer: 200 + 65.5 + 0.5 = 266 ✓
 *   Stroke inner: 200 + 65.5 - 0.5 = 265 ✓
 *   Fill radial edges: y=150, x=200 ✓
 *
 * Example with even strokeWidth = 2:
 *   center = (200, 150), radius = 66
 *   Stroke outer: 200 + 66 + 1 = 267 ✓
 *   Stroke inner: 200 + 66 - 1 = 265 ✓
 *   Fill radial edges: y=150, x=200 ✓
 *
 * @param {Object} options
 * @param {number} options.canvasWidth - Canvas width
 * @param {number} options.canvasHeight - Canvas height
 * @param {number} options.minDiameter - Minimum diameter (default 40)
 * @param {number} options.maxDiameter - Maximum diameter (default 200)
 * @param {number} options.strokeWidth - Stroke width (determines radius type)
 * @returns {Object} {centerX, centerY, radius, atPixel, quadrantIndex, quadrant, startAngle, endAngle, checkData}
 */
function calculate90DegFillStrokeArcParams(options) {
    const {
        canvasWidth,
        canvasHeight,
        minDiameter = 40,
        maxDiameter = 200,
        strokeWidth = 1
    } = options;

    // Step 1: For fill+stroke arcs, center must be INTEGER for crisp fill radial edges
    // The fill radial edges are at x=centerX and y=centerY (cardinal angles)
    const pos = placeCloseToCenterAtGrid(canvasWidth, canvasHeight);
    const centerX = pos.centerX;
    const centerY = pos.centerY;
    const atPixel = false; // Always grid-centered for fill+stroke arcs

    // Step 2: Generate radius based on strokeWidth parity
    // For integer center, stroke edges need: center ± (radius ± strokeWidth/2) = integer
    // - Odd sw (strokeWidth/2 = X.5): radius must be half-integer (*.5)
    // - Even sw (strokeWidth/2 = integer): radius must be integer
    const minRadius = minDiameter / 2;
    const maxRadius = maxDiameter / 2;
    const radiusRange = maxRadius - minRadius;
    const rawRadius = minRadius + SeededRandom.getRandom() * radiusRange;
    const radius = (strokeWidth % 2 !== 0)
        ? Math.floor(rawRadius) + 0.5  // Odd sw → half-integer radius
        : Math.round(rawRadius);        // Even sw → integer radius

    // Step 4: Select random quadrant
    const quadrantIndex = Math.floor(SeededRandom.getRandom() * 4);
    const quadrants = [
        { start: 0, end: Math.PI / 2, name: 'Q1 (0-90) [math: Q4]' },
        { start: Math.PI / 2, end: Math.PI, name: 'Q2 (90-180) [math: Q3]' },
        { start: Math.PI, end: Math.PI * 3 / 2, name: 'Q3 (180-270) [math: Q2]' },
        { start: Math.PI * 3 / 2, end: Math.PI * 2, name: 'Q4 (270-360) [math: Q1]' }
    ];
    const quadrant = quadrants[quadrantIndex];

    // Step 5: Calculate extent bounds based on quadrant
    const effectiveRadius = radius + strokeWidth / 2;
    const checkData = { effectiveRadius };

    switch (quadrantIndex) {
        case 0: // Q1: 0-90 (right, bottom)
            checkData.leftX = Math.floor(centerX);
            checkData.rightX = Math.floor(centerX + effectiveRadius);
            checkData.topY = Math.floor(centerY);
            checkData.bottomY = Math.floor(centerY + effectiveRadius);
            break;
        case 1: // Q2: 90-180 (left, bottom)
            checkData.leftX = Math.floor(centerX - effectiveRadius);
            checkData.rightX = Math.floor(centerX);
            checkData.topY = Math.floor(centerY);
            checkData.bottomY = Math.floor(centerY + effectiveRadius);
            break;
        case 2: // Q3: 180-270 (left, top)
            checkData.leftX = Math.floor(centerX - effectiveRadius);
            checkData.rightX = Math.floor(centerX);
            checkData.topY = Math.floor(centerY - effectiveRadius);
            checkData.bottomY = Math.floor(centerY);
            break;
        case 3: // Q4: 270-360 (right, top)
            checkData.leftX = Math.floor(centerX);
            checkData.rightX = Math.floor(centerX + effectiveRadius);
            checkData.topY = Math.floor(centerY - effectiveRadius);
            checkData.bottomY = Math.floor(centerY);
            break;
    }

    return {
        centerX,
        centerY,
        radius,  // Half-integer for odd sw, integer for even sw
        atPixel,
        quadrantIndex,
        quadrant,
        startAngle: quadrant.start,
        endAngle: quadrant.end,
        checkData
    };
}

/**
 * Register a direct rendering test
 * @param {string} name - Test name
 * @param {function} drawFunction - Function that draws the test
 * @param {string} category - Test category
 * @param {object} checks - Validation checks to perform
 * @param {object} metadata - Test metadata (include perfName for performance testing)
 */
function registerDirectRenderingTest(name, drawFunction, category, checks, metadata = {}) {
    DIRECT_RENDERING_TESTS.push({
        name,
        drawFunction,
        category,
        checks,
        metadata
    });

    // Also register for performance tests if performanceTestSupported is present
    // (only parametric tests in /perf-cases/ have this flag)
    if (metadata.performanceTestSupported) {
        DIRECT_RENDERING_PERF_REGISTRY.push({
            id: name,
            drawFunction: drawFunction,
            perfName: metadata.perfName,
            description: metadata.description || '',
            category: category,
            // Preserve full metadata for filtering (stroke/size/angle categories)
            metadata: metadata
        });
    }
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

// Standard colors for fill+stroke tests (from Color Standardization Guidelines)
const STANDARD_STROKE_COLOR = [255, 0, 0];  // Red
const STANDARD_FILL_COLOR = [0, 0, 255];    // Blue

/**
 * Performance test size categories for parametric benchmark generation.
 *
 * SWCanvas uses different algorithms based on stroke width:
 * - 0px: No-op (per HTML5 Canvas spec)
 * - 1px: Bresenham algorithm (fast, pixel-perfect)
 * - >1.5px: Thick stroke algorithms (SpanOps, QuadScanOps, annulus)
 *
 * Performance benchmarks must isolate these code paths.
 */
const PERF_SIZE_CATEGORIES = {
    /**
     * Stroke width categories (9 total)
     * - sw0: Zero stroke (no-op per HTML5 spec)
     * - sw1px: Bresenham 1px strokes
     * - swXXS-swXXL: Thick stroke algorithms
     */
    strokeWidth: {
        sw0:    { min: 0, max: 0, label: '0px (No Stroke)' },
        sw1px:  { min: 1, max: 1, label: '1px (Bresenham)' },
        swXXS:  { min: 2, max: 3, label: 'XXS Thick (2-3px)' },
        swXS:   { min: 3, max: 5, label: 'XS Thick (3-5px)' },
        swS:    { min: 5, max: 10, label: 'S Thick (5-10px)' },
        swM:    { min: 10, max: 20, label: 'M Thick (10-20px)' },
        swL:    { min: 20, max: 40, label: 'L Thick (20-40px)' },
        swXL:   { min: 40, max: 80, label: 'XL Thick (40-80px)' },
        swXXL:  { min: 80, max: 150, label: 'XXL Thick (80-150px)' }
    },

    /**
     * Shape size categories (7 total)
     * Applies to width/height for rectangles, diameter for circles
     */
    shapeSize: {
        szXXS:  { min: 2, max: 8, label: 'XXS (2-8px)' },
        szXS:   { min: 5, max: 15, label: 'XS (5-15px)' },
        szS:    { min: 16, max: 39, label: 'S (16-39px)' },
        szM:    { min: 40, max: 79, label: 'M (40-79px)' },
        szL:    { min: 80, max: 159, label: 'L (80-159px)' },
        szXL:   { min: 160, max: 300, label: 'XL (160-300px)' },
        szXXL:  { min: 300, max: 500, label: 'XXL (300-500px)' }
    },

    /**
     * Arc angle categories (4 total)
     * Controls the angular extent of arcs
     */
    arcAngle: {
        angS:   { min: 30, max: 90, label: 'Small (30-90°)' },
        angM:   { min: 90, max: 180, label: 'Medium (90-180°)' },
        angL:   { min: 180, max: 270, label: 'Large (180-270°)' },
        angXL:  { min: 270, max: 350, label: 'Nearly Full (270-350°)' }
    }
};

/**
 * Get a stroke width value from a category key.
 * @param {string} key - Stroke width category key (e.g., 'sw1px', 'swM')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @returns {number} Stroke width value
 */
function getStrokeWidthFromCategory(key, randomFn = Math.random) {
    const cat = PERF_SIZE_CATEGORIES.strokeWidth[key];
    if (!cat) throw new Error(`Unknown stroke width category: ${key}`);
    if (cat.min === cat.max) return cat.min;
    return cat.min + randomFn() * (cat.max - cat.min);
}

/**
 * Get a shape size value from a category key.
 * Returns a dimension value (width/height for rectangles, diameter for circles).
 * @param {string} key - Size category key (e.g., 'szS', 'szL')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @returns {number} Size value
 */
function getShapeSizeFromCategory(key, randomFn = Math.random) {
    const cat = PERF_SIZE_CATEGORIES.shapeSize[key];
    if (!cat) throw new Error(`Unknown shape size category: ${key}`);
    return cat.min + randomFn() * (cat.max - cat.min);
}

/**
 * Get a radius value from a shape size category.
 * Returns size / 2 for use with circles/arcs.
 * @param {string} key - Size category key (e.g., 'szS', 'szL')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @returns {number} Radius value
 */
function getRadiusFromShapeCategory(key, randomFn = Math.random) {
    return getShapeSizeFromCategory(key, randomFn) / 2;
}

/**
 * Get an arc angle (in radians) from an angle category key.
 * @param {string} key - Angle category key (e.g., 'angS', 'angM')
 * @param {function} randomFn - Random function returning 0-1 (default: Math.random)
 * @returns {number} Angle in radians
 */
function getArcAngleFromCategory(key, randomFn = Math.random) {
    const cat = PERF_SIZE_CATEGORIES.arcAngle[key];
    if (!cat) throw new Error(`Unknown arc angle category: ${key}`);
    const degrees = cat.min + randomFn() * (cat.max - cat.min);
    return degrees * Math.PI / 180;
}

/**
 * Compare two colors with tolerance.
 * For semi-transparent colors blended on transparent background,
 * use higher tolerance (30+) since RGB values shift during alpha blending.
 * @param {number[]} color1 - [r, g, b]
 * @param {number[]} color2 - [r, g, b]
 * @param {number} tolerance - Maximum allowed difference per channel (default: 30)
 * @returns {boolean} True if colors are within tolerance
 */
function colorsMatch(color1, color2, tolerance = 30) {
    const r1 = color1[0], g1 = color1[1], b1 = color1[2];
    const r2 = color2[0], g2 = color2[1], b2 = color2[2];
    return Math.abs(r1 - r2) <= tolerance &&
           Math.abs(g1 - g2) <= tolerance &&
           Math.abs(b1 - b2) <= tolerance;
}

/**
 * Classify a pixel as 'stroke', 'fill', or 'unknown' based on standard colors.
 * Works with both opaque and semi-transparent versions.
 * @param {number} r - Red component
 * @param {number} g - Green component
 * @param {number} b - Blue component
 * @param {number[]} strokeColor - [r, g, b] stroke color
 * @param {number[]} fillColor - [r, g, b] fill color
 * @param {number} tolerance - Color matching tolerance
 * @returns {string} 'stroke', 'fill', or 'unknown'
 */
function classifyPixel(r, g, b, strokeColor, fillColor, tolerance) {
    if (colorsMatch([r, g, b], strokeColor, tolerance)) return 'stroke';
    if (colorsMatch([r, g, b], fillColor, tolerance)) return 'fill';
    return 'unknown';
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

/**
 * Scans rows vertically and analyzes pixel patterns for stroke continuity.
 * Used by checkStrokePatternContinuity.
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
 * Used by checkStrokePatternContinuity.
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
            const pixelType = classifyPixel(
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
    const {
        hasStroke = true,
        hasFill = false,
        strokeColor = STANDARD_STROKE_COLOR,
        fillColor = STANDARD_FILL_COLOR,
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
    const backgroundColor = detectBackgroundColor(surface);

    // Get shape bounds using detected background
    const extremes = analyzeExtremes(surface, backgroundColor);

    // If no non-background pixels found
    if (extremes.leftX >= surface.width || extremes.rightX < 0 ||
        extremes.topY >= surface.height || extremes.bottomY < 0) {
        issues.push('No non-background pixels found');
        return { valid: false, issues };
    }

    if (hasStroke && hasFill) {
        // Fill+Stroke mode: check for gaps AND verify edges are stroke color
        const options = { checkEdges: true, strokeColor, fillColor, colorTolerance };
        if (verticalScan) {
            for (let y = extremes.topY; y <= extremes.bottomY; y++) {
                verifyScanLine(surface, y, true, extremes, options, issues);
            }
        }
        if (horizontalScan) {
            for (let x = extremes.leftX; x <= extremes.rightX; x++) {
                verifyScanLine(surface, x, false, extremes, options, issues);
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
        const options = { checkEdges: false };
        if (verticalScan) {
            for (let y = extremes.topY; y <= extremes.bottomY; y++) {
                verifyScanLine(surface, y, true, extremes, options, issues);
            }
        }
        if (horizontalScan) {
            for (let x = extremes.leftX; x <= extremes.rightX; x++) {
                verifyScanLine(surface, x, false, extremes, options, issues);
            }
        }
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

/**
 * Run all validation checks on a surface
 * Shared between Node.js and browser test runners for consistency.
 * @param {Object} surface - Surface with data, width, height, stride
 * @param {Object} checks - Checks configuration from test
 * @param {number} iterationNumber - Current iteration number (for skipOnIterations support)
 * @returns {Object} { passed: boolean, issues: string[], knownFailureIssues: string[] }
 */
function runValidationChecks(surface, checks, iterationNumber = 0) {
    const issues = [];
    const knownFailureIssues = [];

    // Total unique colors check (exactly N)
    if (checks.totalUniqueColors) {
        const isObject = typeof checks.totalUniqueColors === 'object';
        // Support both .expected and .count for backwards compatibility
        const expected = isObject
            ? (checks.totalUniqueColors.expected !== undefined
                ? checks.totalUniqueColors.expected
                : checks.totalUniqueColors.count)
            : checks.totalUniqueColors;
        const skipIterations = (isObject && checks.totalUniqueColors.skipOnIterations) || [];

        if (!skipIterations.includes(iterationNumber)) {
            const actual = countUniqueColors(surface);
            if (actual !== expected) {
                issues.push(`Unique colors: expected exactly ${expected}, got ${actual}`);
            }
        }
    }

    // Max unique colors check (at most N)
    if (checks.maxUniqueColors) {
        const actual = countUniqueColors(surface);
        if (actual > checks.maxUniqueColors) {
            issues.push(`Unique colors: ${actual} exceeds maximum of ${checks.maxUniqueColors}`);
        }
    }

    // Middle row unique colors
    if (checks.uniqueColors && checks.uniqueColors.middleRow) {
        const skipIterations = checks.uniqueColors.middleRow.skipOnIterations || [];
        if (!skipIterations.includes(iterationNumber)) {
            const expected = getAdjustedExpectedColorCount(checks.uniqueColors.middleRow.count, surface);
            const actual = countUniqueColorsInMiddleRow(surface);
            if (actual !== expected) {
                issues.push(`Middle row unique colors: ${actual} (expected ${expected})`);
            }
        }
    }

    // Middle column unique colors
    if (checks.uniqueColors && checks.uniqueColors.middleColumn) {
        const skipIterations = checks.uniqueColors.middleColumn.skipOnIterations || [];
        if (!skipIterations.includes(iterationNumber)) {
            const expected = getAdjustedExpectedColorCount(checks.uniqueColors.middleColumn.count, surface);
            const actual = countUniqueColorsInMiddleColumn(surface);
            if (actual !== expected) {
                issues.push(`Middle column unique colors: ${actual} (expected ${expected})`);
            }
        }
    }

    // Speckle checks
    if (checks.speckles === true || (checks.speckles && typeof checks.speckles === 'object')) {
        const skipIterations = (typeof checks.speckles === 'object' && checks.speckles.skipOnIterations) || [];

        if (!skipIterations.includes(iterationNumber)) {
            const expected = (typeof checks.speckles === 'object' && checks.speckles.expected !== undefined)
                ? checks.speckles.expected : 0;
            const maxSpeckles = typeof checks.speckles === 'object' ? checks.speckles.maxSpeckles : undefined;
            const isKnownFailure = typeof checks.speckles === 'object' && checks.speckles.knownFailure === true;
            const speckleResult = countSpeckles(surface);
            const speckleCount = speckleResult.count;

            const speckleCheckPassed = maxSpeckles !== undefined
                ? speckleCount <= maxSpeckles
                : speckleCount === expected;

            if (!speckleCheckPassed) {
                const firstInfo = speckleResult.firstSpeckle
                    ? ` (first at ${speckleResult.firstSpeckle.x},${speckleResult.firstSpeckle.y})`
                    : '';
                const expectedMsg = maxSpeckles !== undefined ? `≤${maxSpeckles}` : `${expected}`;
                const message = `Speckle count: ${speckleCount} (expected ${expectedMsg})${firstInfo}`;
                if (isKnownFailure) {
                    knownFailureIssues.push(message + ' [KNOWN]');
                } else {
                    issues.push(message);
                }
            }
        }
    } else if (checks.noSpeckles === true || checks.speckles === false) {
        if (hasSpeckles(surface)) {
            issues.push('Unexpected speckles found');
        }
    }

    // Dimension consistency check (stroke width/height uniformity)
    if (checks.dimensionConsistency) {
        const result = checkDimensionConsistency(surface);
        if (!result.widthConsistent || !result.heightConsistent) {
            issues.push(...result.issues);
        }
    }

    // 1px closed stroke 8-connectivity check
    // Config: stroke8Connectivity: { color: [r, g, b], tolerance?: number }
    // A continuous 1px stroke has every pixel with at least 2 neighbors (8-connectivity)
    // Pixels with 0 or 1 neighbors indicate gaps/discontinuities
    // NOTE: This check only works for 1px strokes.
    if (checks.stroke8Connectivity) {
        const config = checks.stroke8Connectivity;
        const [r, g, b] = config.color;
        const tolerance = config.tolerance || 0;
        const isKnownFailure = config.knownFailure === true;

        const result = check1pxClosedStrokeContinuity(surface, r, g, b, tolerance);

        if (!result.continuous) {
            const firstGap = result.gaps[0];
            const firstInfo = firstGap
                ? ` (first at ${firstGap.x},${firstGap.y} with ${firstGap.neighbors} neighbor(s))`
                : '';
            const message = `Stroke 8-connectivity: ${result.gaps.length} pixel(s) with <2 neighbors${firstInfo}`;
            if (isKnownFailure) {
                knownFailureIssues.push(message + ' [KNOWN]');
            } else {
                issues.push(message);
            }
        }
    }

    // Shape integrity check (universal: stroke-only, fill-only, or fill+stroke)
    // Config: shapeIntegrity: true | { hasStroke?, hasFill?, verticalScan?, horizontalScan?,
    //         strokeColor?, fillColor?, colorTolerance?, knownFailure?, skipOnIterations? }
    // NOTE: Only works for closed convex shapes (circles, rectangles, rounded rects)
    if (checks.shapeIntegrity) {
        const config = typeof checks.shapeIntegrity === 'object'
            ? checks.shapeIntegrity
            : {};
        const isKnownFailure = config.knownFailure === true;
        const skipIterations = config.skipOnIterations || [];

        if (!skipIterations.includes(iterationNumber)) {
            const result = checkShapeIntegrity(surface, {
                hasStroke: config.hasStroke !== false,
                hasFill: config.hasFill === true,
                verticalScan: config.verticalScan !== false,
                horizontalScan: config.horizontalScan !== false,
                strokeColor: config.strokeColor,
                fillColor: config.fillColor,
                colorTolerance: config.colorTolerance
            });

            if (!result.valid) {
                // Use appropriate label based on mode
                const hasStroke = config.hasStroke !== false;
                const hasFill = config.hasFill === true;
                let label;
                if (hasStroke && hasFill) {
                    label = 'Shape Boundary';
                } else if (hasStroke) {
                    label = 'Stroke Continuity';
                } else {
                    label = 'Fill Continuity';
                }

                for (const issue of result.issues) {
                    const message = `${label}: ${issue}`;
                    if (isKnownFailure) {
                        knownFailureIssues.push(message + ' [KNOWN]');
                    } else {
                        issues.push(message);
                    }
                }
            }
        }
    }

    return {
        passed: issues.length === 0,
        issues,
        knownFailureIssues
    };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DIRECT_RENDERING_TESTS,
        DIRECT_RENDERING_PERF_REGISTRY,
        SeededRandom,
        getRandomColor,
        getRandomOpaqueColor,
        getRandomOpaqueVisibleColor,
        getRandomPoint,
        placeCloseToCenterAtPixel,
        placeCloseToCenterAtGrid,
        adjustDimensionsForCrispStrokeRendering,
        roundPoint,
        ensureHalfPoint,
        adjustCenterForCrispStrokeRendering,
        calculateCrispFillAndStrokeRectParams,
        calculateCircleTestParameters,
        calculateArcTestParameters,
        calculate90DegFillStrokeArcParams,
        generateConstrainedArcAngles,
        registerDirectRenderingTest,
        analyzeExtremes,
        checkDimensionConsistency,
        countUniqueColors,
        countUniqueColorsInMiddleRow,
        countUniqueColorsInMiddleColumn,
        detectBackgroundColor,
        getAdjustedExpectedColorCount,
        countSpeckles,
        hasSpeckles,
        check1pxClosedStrokeContinuity,
        checkStroke8Connectivity: check1pxClosedStrokeContinuity, // Alias for renamed check
        checkShapeIntegrity,
        runValidationChecks,
        // Shape integrity check utilities
        STANDARD_STROKE_COLOR,
        STANDARD_FILL_COLOR,
        colorsMatch,
        classifyPixel,
        // Parametric performance test utilities
        PERF_SIZE_CATEGORIES,
        getStrokeWidthFromCategory,
        getShapeSizeFromCategory,
        getRadiusFromShapeCategory,
        getArcAngleFromCategory
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.DIRECT_RENDERING_TESTS = DIRECT_RENDERING_TESTS;
    window.DIRECT_RENDERING_PERF_REGISTRY = DIRECT_RENDERING_PERF_REGISTRY;
    window.SeededRandom = SeededRandom;
    window.getRandomColor = getRandomColor;
    window.getRandomOpaqueColor = getRandomOpaqueColor;
    window.getRandomOpaqueVisibleColor = getRandomOpaqueVisibleColor;
    window.getRandomPoint = getRandomPoint;
    window.placeCloseToCenterAtPixel = placeCloseToCenterAtPixel;
    window.placeCloseToCenterAtGrid = placeCloseToCenterAtGrid;
    window.adjustDimensionsForCrispStrokeRendering = adjustDimensionsForCrispStrokeRendering;
    window.roundPoint = roundPoint;
    window.ensureHalfPoint = ensureHalfPoint;
    window.adjustCenterForCrispStrokeRendering = adjustCenterForCrispStrokeRendering;
    window.calculateCrispFillAndStrokeRectParams = calculateCrispFillAndStrokeRectParams;
    window.calculateCircleTestParameters = calculateCircleTestParameters;
    window.calculateArcTestParameters = calculateArcTestParameters;
    window.calculate90DegFillStrokeArcParams = calculate90DegFillStrokeArcParams;
    window.generateConstrainedArcAngles = generateConstrainedArcAngles;
    window.registerDirectRenderingTest = registerDirectRenderingTest;
    window.analyzeExtremes = analyzeExtremes;
    window.checkDimensionConsistency = checkDimensionConsistency;
    window.countUniqueColors = countUniqueColors;
    window.countUniqueColorsInMiddleRow = countUniqueColorsInMiddleRow;
    window.countUniqueColorsInMiddleColumn = countUniqueColorsInMiddleColumn;
    window.detectBackgroundColor = detectBackgroundColor;
    window.getAdjustedExpectedColorCount = getAdjustedExpectedColorCount;
    window.countSpeckles = countSpeckles;
    window.hasSpeckles = hasSpeckles;
    window.check1pxClosedStrokeContinuity = check1pxClosedStrokeContinuity;
    window.checkStroke8Connectivity = check1pxClosedStrokeContinuity; // Alias for renamed check
    window.checkShapeIntegrity = checkShapeIntegrity;
    window.runValidationChecks = runValidationChecks;
    // Shape integrity check utilities
    window.STANDARD_STROKE_COLOR = STANDARD_STROKE_COLOR;
    window.STANDARD_FILL_COLOR = STANDARD_FILL_COLOR;
    window.colorsMatch = colorsMatch;
    window.classifyPixel = classifyPixel;
    // Parametric performance test utilities
    window.PERF_SIZE_CATEGORIES = PERF_SIZE_CATEGORIES;
    window.getStrokeWidthFromCategory = getStrokeWidthFromCategory;
    window.getShapeSizeFromCategory = getShapeSizeFromCategory;
    window.getRadiusFromShapeCategory = getRadiusFromShapeCategory;
    window.getArcAngleFromCategory = getArcAngleFromCategory;
}

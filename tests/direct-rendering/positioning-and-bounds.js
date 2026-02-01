/**
 * Positioning and Bounds Calculation Utilities for Direct Rendering Tests
 *
 * Provides functions for:
 * - Calculating test parameters (center, dimensions, angles)
 * - Calculating expected pixel bounds for extremes validation
 *
 * Note: The following are exposed as globals by the runner files:
 * - SeededRandom - Deterministic random number generator
 * - getRandomPoint - Random point generator (from direct-rendering-test-utils.js)
 */

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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

// ============================================================
// POSITIONING FUNCTIONS (calculate test parameters)
// ============================================================

/**
 * Places a center point at pixel boundary (*.5 coordinates) relative to canvas center
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Center coordinates {centerX, centerY}
 */
function calculateCenterAtPixel(width, height) {
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
function calculateCenterAtGrid(width, height) {
    return {
        centerX: Math.floor(width / 2),
        centerY: Math.floor(height / 2)
    };
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
function calculateCrispRectTestParams(options) {
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
            ? calculateCenterAtPixel(canvasWidth, canvasHeight)
            : calculateCenterAtGrid(canvasWidth, canvasHeight);
        center = { x: center.centerX, y: center.centerY };
    }

    // Adjust dimensions for crisp rendering
    const adjusted = adjustDimensionsForCrispStrokeRendering(
        baseWidth, baseHeight, strokeWidth, center
    );

    // Calculate top-left coordinates from center
    const x = center.x - adjusted.width / 2;
    const y = center.y - adjusted.height / 2;

    // Calculate bounds using formulas that match existing test manual formulas
    // These are the pixel bounds for stroke rendering (1px strokes from the edge)
    const checkData = {
        leftX: Math.floor(x),
        rightX: Math.floor(x + adjusted.width),
        topY: Math.floor(y),
        bottomY: Math.floor(y + adjusted.height)
    };

    return {
        center,
        adjustedDimensions: { width: adjusted.width, height: adjusted.height },
        strokeWidth,
        topLeft: { x, y },
        checkData
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
 * @param {string|null} options.fixedCenterType - Fixed center type: 'grid', 'pixel', or null for random (default null)
 * @returns {Object} Calculated circle parameters: {centerX, centerY, radius, strokeWidth, finalDiameter, atPixel}
 */
function calculateCircleTestParams(options) {
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
        marginY = 60,
        fixedCenterType = null
    } = options;

    // Choose between grid-centered and pixel-centered
    // Skip random call if center type is predetermined (preserves SeededRandom sequence)
    const atPixel = fixedCenterType !== null
        ? (fixedCenterType === 'pixel')
        : SeededRandom.getRandom() < 0.5;

    // Get initial center point
    let { centerX, centerY } = atPixel
        ? calculateCenterAtPixel(canvasWidth, canvasHeight)
        : calculateCenterAtGrid(canvasWidth, canvasHeight);

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

    // Calculate checkData for bounds validation
    // Use different formula for stroked vs filled shapes
    const checkData = hasStroke && strokeWidth > 0
        ? calculateStrokedCircleBounds(centerX, centerY, radius, strokeWidth)
        : calculateFilledCircleBounds(centerX, centerY, radius);

    return {
        centerX,
        centerY,
        radius,
        strokeWidth,
        finalDiameter,
        atPixel,
        checkData
    };
}

/**
 * Calculate arc test parameters with gap constrained to a single quadrant.
 * Arc extends > 270° (3/4 circle) to include all cardinal points for extremes checks.
 * @param {Object} options - Same as calculateCircleTestParams
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
 * @param {string|null} options.fixedCenterType - Fixed center type: 'grid', 'pixel', or null for random (default null)
 * @returns {Object} Circle params + {startAngle, endAngle, gapQuadrant, gapSizeDeg}
 */
function calculateArcTestParams(options) {
    // Get base circle parameters
    const circleParams = calculateCircleTestParams(options);

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
 * Calculate crisp line test parameters with proper bounds.
 *
 * For crisp axis-aligned lines:
 * - 1px stroke at X.5: occupies single pixel column/row
 * - 2px (even) stroke at integer: occupies pixels [coord-1, coord] (centered)
 *
 * Bounds formulas match existing test patterns:
 * - Vertical lines: leftX = rightX = pixelX, topY/bottomY from y coords - 1 on max
 * - Horizontal lines: topY = bottomY or [Y-1, Y], leftX/rightX from x coords - 1 on max
 *
 * @param {Object} options - Configuration options
 * @param {number} options.canvasWidth - Canvas width
 * @param {number} options.canvasHeight - Canvas height
 * @param {number} options.strokeWidth - Stroke width (1 or 2 for crisp lines)
 * @param {'vertical' | 'horizontal'} options.orientation - Line orientation
 * @param {number} options.minLength - Minimum line length (default 20)
 * @param {number} options.maxLength - Maximum line length (default 149)
 * @returns {Object} Line parameters including checkData
 */
function calculateLineTestParams(options) {
    const {
        canvasWidth,
        canvasHeight,
        strokeWidth = 1,
        orientation = 'vertical',
        minLength = 20,
        maxLength = 149
    } = options;

    // Generate random line length
    const lineLength = Math.floor(minLength + SeededRandom.getRandom() * (maxLength - minLength + 1));

    // Calculate center positions:
    // - For the perpendicular axis (where stroke extends): apply crisp centering based on strokeWidth parity
    //   - Odd strokeWidth (1px): position at X.5 for crisp single-pixel stroke
    //   - Even strokeWidth (2px): position at integer for crisp two-pixel stroke
    // - For the parallel axis (where line extends): use integer center for visual centering

    let x1, y1, x2, y2;
    let checkData;

    if (orientation === 'vertical') {
        // Vertical line: X is perpendicular (needs crisp), Y is parallel (needs integer center)
        const crispCenterX = strokeWidth % 2 === 1
            ? Math.floor(canvasWidth / 2) + 0.5
            : Math.floor(canvasWidth / 2);
        const centerY = Math.floor(canvasHeight / 2);  // Integer Y for centering line length

        const startY = Math.floor(centerY - lineLength / 2);
        const endY = startY + lineLength;

        x1 = crispCenterX;
        x2 = crispCenterX;
        y1 = startY;
        y2 = endY;

        // Randomly swap direction
        if (SeededRandom.getRandom() < 0.5) {
            [y1, y2] = [y2, y1];
        }

        // Bounds for vertical lines
        const pixelX = Math.floor(crispCenterX);
        if (strokeWidth === 1) {
            checkData = {
                topY: Math.min(y1, y2),
                bottomY: Math.max(y1, y2) - 1,  // Inclusive bottom bound
                leftX: pixelX,
                rightX: pixelX
            };
        } else {
            // 2px stroke centered at integer X spans [X-1, X]
            checkData = {
                topY: Math.min(y1, y2),
                bottomY: Math.max(y1, y2) - 1,
                leftX: pixelX - 1,
                rightX: pixelX
            };
        }
    } else {
        // Horizontal line: Y is perpendicular (needs crisp), X is parallel (needs integer center)
        const crispCenterY = strokeWidth % 2 === 1
            ? Math.floor(canvasHeight / 2) + 0.5
            : Math.floor(canvasHeight / 2);
        const centerX = Math.floor(canvasWidth / 2);  // Integer X for centering line length

        const startX = Math.floor(centerX - lineLength / 2);
        const endX = startX + lineLength;

        x1 = startX;
        x2 = endX;
        y1 = crispCenterY;
        y2 = crispCenterY;

        // Randomly swap direction
        if (SeededRandom.getRandom() < 0.5) {
            [x1, x2] = [x2, x1];
        }

        // Bounds for horizontal lines
        const pixelY = Math.floor(crispCenterY);
        if (strokeWidth === 1) {
            checkData = {
                topY: pixelY,
                bottomY: pixelY,
                leftX: Math.min(x1, x2),
                rightX: Math.max(x1, x2) - 1  // Inclusive right bound
            };
        } else {
            // 2px stroke centered at integer Y spans [Y-1, Y]
            checkData = {
                topY: pixelY - 1,
                bottomY: pixelY,
                leftX: Math.min(x1, x2),
                rightX: Math.max(x1, x2) - 1
            };
        }
    }

    return {
        x1, y1, x2, y2,
        strokeWidth,
        lineLength,
        orientation,
        checkData
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
function calculate90DegArcTestParams(options) {
    const {
        canvasWidth,
        canvasHeight,
        minDiameter = 40,
        maxDiameter = 200,
        strokeWidth = 1
    } = options;

    // Step 1: For fill+stroke arcs, center must be INTEGER for crisp fill radial edges
    // The fill radial edges are at x=centerX and y=centerY (cardinal angles)
    const pos = calculateCenterAtGrid(canvasWidth, canvasHeight);
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
    // The effectiveRadius is the distance from center to outer stroke edge.
    // For rendering, a pixel at position p is painted if its center (p + 0.5) is inside the shape.
    //
    // Pixel bounds calculation:
    // - Outer arc edges (at effectiveRadius from center):
    //   - Right/bottom: last painted pixel is floor(center + effectiveRadius - 0.5)
    //   - Left/top: first painted pixel is ceil(center - effectiveRadius - 0.5)
    // - Radial edges (at center, depending on quadrant orientation):
    //   - If fill extends TOWARD positive direction: first pixel is ceil(center - 0.5)
    //   - If fill extends TOWARD negative direction: last pixel is floor(center - 0.5)
    const effectiveRadius = radius + strokeWidth / 2;
    const checkData = { effectiveRadius };

    switch (quadrantIndex) {
        case 0: // Q1: 0-90 (right, bottom) - fill extends right (+X) and down (+Y) from center
            checkData.leftX = Math.ceil(centerX - 0.5);      // radial edge: fill goes right
            checkData.rightX = Math.floor(centerX + effectiveRadius - 0.5);  // arc edge
            checkData.topY = Math.ceil(centerY - 0.5);       // radial edge: fill goes down
            checkData.bottomY = Math.floor(centerY + effectiveRadius - 0.5); // arc edge
            break;
        case 1: // Q2: 90-180 (left, bottom) - fill extends left (-X) and down (+Y) from center
            checkData.leftX = Math.ceil(centerX - effectiveRadius - 0.5);    // arc edge
            checkData.rightX = Math.floor(centerX - 0.5);    // radial edge: fill goes left
            checkData.topY = Math.ceil(centerY - 0.5);       // radial edge: fill goes down
            checkData.bottomY = Math.floor(centerY + effectiveRadius - 0.5); // arc edge
            break;
        case 2: // Q3: 180-270 (left, top) - fill extends left (-X) and up (-Y) from center
            checkData.leftX = Math.ceil(centerX - effectiveRadius - 0.5);    // arc edge
            checkData.rightX = Math.floor(centerX - 0.5);    // radial edge: fill goes left
            checkData.topY = Math.ceil(centerY - effectiveRadius - 0.5);     // arc edge
            checkData.bottomY = Math.floor(centerY - 0.5);   // radial edge: fill goes up
            break;
        case 3: // Q4: 270-360 (right, top) - fill extends right (+X) and up (-Y) from center
            checkData.leftX = Math.ceil(centerX - 0.5);      // radial edge: fill goes right
            checkData.rightX = Math.floor(centerX + effectiveRadius - 0.5);  // arc edge
            checkData.topY = Math.ceil(centerY - effectiveRadius - 0.5);     // arc edge
            checkData.bottomY = Math.floor(centerY - 0.5);   // radial edge: fill goes up
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

// ============================================================
// BOUNDS FUNCTIONS (calculate pixel extremes)
// ============================================================

/**
 * Calculate pixel bounds for a filled circle or arc.
 * Uses pixel-center logic: a pixel at p is painted if (p + 0.5) is inside the shape.
 * @param {number} centerX - Circle center X
 * @param {number} centerY - Circle center Y
 * @param {number} radius - Circle radius
 * @returns {Object} {topY, bottomY, leftX, rightX}
 */
function calculateFilledCircleBounds(centerX, centerY, radius) {
    return {
        topY: Math.ceil(centerY - radius - 0.5),
        bottomY: Math.floor(centerY + radius - 0.5),
        leftX: Math.ceil(centerX - radius - 0.5),
        rightX: Math.floor(centerX + radius - 0.5)
    };
}

/**
 * Calculate pixel bounds for a stroked circle/arc.
 * Strokes have different bounds than fills due to pixel painting rules.
 * The -1 on right/bottom is required because stroke's last pixel is inside the edge.
 * @param {number} centerX - Circle center X
 * @param {number} centerY - Circle center Y
 * @param {number} radius - Circle radius (without stroke)
 * @param {number} strokeWidth - Stroke width
 * @returns {Object} {topY, bottomY, leftX, rightX}
 */
function calculateStrokedCircleBounds(centerX, centerY, radius, strokeWidth) {
    const effectiveRadius = radius + strokeWidth / 2;
    return {
        leftX: Math.floor(centerX - effectiveRadius),
        rightX: Math.floor(centerX + effectiveRadius - 1),
        topY: Math.floor(centerY - effectiveRadius),
        bottomY: Math.floor(centerY + effectiveRadius - 1)
    };
}

/**
 * Calculate pixel bounds for a filled rectangle (no stroke).
 * Simple formula: edges are at exact integer positions.
 * @param {number} x - Rectangle top-left X
 * @param {number} y - Rectangle top-left Y
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @returns {Object} {topY, bottomY, leftX, rightX}
 */
function calculateFilledRectBounds(x, y, width, height) {
    return {
        topY: y,
        bottomY: y + height - 1,
        leftX: x,
        rightX: x + width - 1
    };
}

/**
 * Calculate pixel bounds for a rectangle with optional stroke.
 * Uses pixel-center logic for consistent bounds calculation.
 * @param {number} x - Rectangle top-left X
 * @param {number} y - Rectangle top-left Y
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @param {number} strokeWidth - Stroke width (default 0 for fill-only)
 * @returns {Object} {topY, bottomY, leftX, rightX}
 */
function calculateStrokedRectBounds(x, y, width, height, strokeWidth = 0) {
    const halfStroke = strokeWidth / 2;
    const leftEdge = x - halfStroke;
    const rightEdge = x + width + halfStroke;
    const topEdge = y - halfStroke;
    const bottomEdge = y + height + halfStroke;

    return {
        topY: Math.ceil(topEdge - 0.5),
        bottomY: Math.floor(bottomEdge - 0.5),
        leftX: Math.ceil(leftEdge - 0.5),
        rightX: Math.floor(rightEdge - 0.5)
    };
}

/**
 * Calculate pixel bounds for a crisp stroked rectangle from top-left position and dimensions.
 * This is the authoritative bounds formula for axis-aligned crisp stroke rectangles.
 *
 * Used by tests that compute their own positioning but need consistent bounds.
 *
 * @param {number} x - Rectangle top-left X coordinate
 * @param {number} y - Rectangle top-left Y coordinate
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @returns {Object} {leftX, rightX, topY, bottomY} - Pixel bounds for extremes check
 */
function calculateCrispStrokedRectBounds(x, y, width, height) {
    return {
        leftX: Math.floor(x),
        rightX: Math.floor(x + width),
        topY: Math.floor(y),
        bottomY: Math.floor(y + height)
    };
}

/**
 * Calculate pixel bounds for a line.
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @param {number} strokeWidth - Line width (default 1)
 * @returns {Object} {topY, bottomY, leftX, rightX}
 */
function calculateStrokedLineBounds(x1, y1, x2, y2, strokeWidth = 1) {
    const halfStroke = strokeWidth / 2;
    const minX = Math.min(x1, x2) - halfStroke;
    const maxX = Math.max(x1, x2) + halfStroke;
    const minY = Math.min(y1, y2) - halfStroke;
    const maxY = Math.max(y1, y2) + halfStroke;

    return {
        topY: Math.ceil(minY - 0.5),
        bottomY: Math.floor(maxY - 0.5),
        leftX: Math.ceil(minX - 0.5),
        rightX: Math.floor(maxX - 0.5)
    };
}

/**
 * Aggregate multiple shape bounds into a single bounding box.
 * @param {Array<Object>} boundsArray - Array of {topY, bottomY, leftX, rightX}
 * @returns {Object} Combined {topY, bottomY, leftX, rightX}
 */
function calculateAggregateBounds(boundsArray) {
    if (boundsArray.length === 0) {
        return { topY: 0, bottomY: 0, leftX: 0, rightX: 0 };
    }

    let topY = Infinity, bottomY = -Infinity, leftX = Infinity, rightX = -Infinity;
    for (const bounds of boundsArray) {
        topY = Math.min(topY, bounds.topY);
        bottomY = Math.max(bottomY, bounds.bottomY);
        leftX = Math.min(leftX, bounds.leftX);
        rightX = Math.max(rightX, bounds.rightX);
    }
    return { topY, bottomY, leftX, rightX };
}

// ============================================================
// EXPORTS
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Helpers
        roundPoint,
        ensureHalfPoint,
        adjustDimensionsForCrispStrokeRendering,
        adjustCenterForCrispStrokeRendering,
        generateConstrainedArcAngles,
        // Positioning (new names)
        calculateCenterAtPixel,
        calculateCenterAtGrid,
        calculateCircleTestParams,
        calculateArcTestParams,
        calculateLineTestParams,
        calculateCrispRectTestParams,
        calculate90DegArcTestParams,
        // Bounds (new names)
        calculateFilledCircleBounds,
        calculateStrokedCircleBounds,
        calculateFilledRectBounds,
        calculateStrokedRectBounds,
        calculateCrispStrokedRectBounds,
        calculateStrokedLineBounds,
        calculateAggregateBounds,
        // Legacy aliases for backwards compatibility during transition
        // These map old names to new implementations
        placeCloseToCenterAtPixel: calculateCenterAtPixel,
        placeCloseToCenterAtGrid: calculateCenterAtGrid,
        calculateCircleTestParameters: calculateCircleTestParams,
        calculateArcTestParameters: calculateArcTestParams,
        calculateLineTestParameters: calculateLineTestParams,
        calculateCrispFillAndStrokeRectParams: calculateCrispRectTestParams,
        calculate90DegFillStrokeArcParams: calculate90DegArcTestParams,
        calculateCircleBounds: calculateFilledCircleBounds,
        calculateRectangleBounds: calculateStrokedRectBounds,
        calculateCrispStrokeRectBounds: calculateCrispStrokedRectBounds,
        calculateFillRectBounds: calculateFilledRectBounds,
        calculateLineBounds: calculateStrokedLineBounds,
        aggregateBounds: calculateAggregateBounds
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    // Helpers
    window.roundPoint = roundPoint;
    window.ensureHalfPoint = ensureHalfPoint;
    window.adjustDimensionsForCrispStrokeRendering = adjustDimensionsForCrispStrokeRendering;
    window.adjustCenterForCrispStrokeRendering = adjustCenterForCrispStrokeRendering;
    window.generateConstrainedArcAngles = generateConstrainedArcAngles;
    // Positioning (new names)
    window.calculateCenterAtPixel = calculateCenterAtPixel;
    window.calculateCenterAtGrid = calculateCenterAtGrid;
    window.calculateCircleTestParams = calculateCircleTestParams;
    window.calculateArcTestParams = calculateArcTestParams;
    window.calculateLineTestParams = calculateLineTestParams;
    window.calculateCrispRectTestParams = calculateCrispRectTestParams;
    window.calculate90DegArcTestParams = calculate90DegArcTestParams;
    // Bounds (new names)
    window.calculateFilledCircleBounds = calculateFilledCircleBounds;
    window.calculateStrokedCircleBounds = calculateStrokedCircleBounds;
    window.calculateFilledRectBounds = calculateFilledRectBounds;
    window.calculateStrokedRectBounds = calculateStrokedRectBounds;
    window.calculateCrispStrokedRectBounds = calculateCrispStrokedRectBounds;
    window.calculateStrokedLineBounds = calculateStrokedLineBounds;
    window.calculateAggregateBounds = calculateAggregateBounds;
    // Legacy aliases for backwards compatibility
    window.placeCloseToCenterAtPixel = calculateCenterAtPixel;
    window.placeCloseToCenterAtGrid = calculateCenterAtGrid;
    window.calculateCircleTestParameters = calculateCircleTestParams;
    window.calculateArcTestParameters = calculateArcTestParams;
    window.calculateLineTestParameters = calculateLineTestParams;
    window.calculateCrispFillAndStrokeRectParams = calculateCrispRectTestParams;
    window.calculate90DegFillStrokeArcParams = calculate90DegArcTestParams;
    window.calculateCircleBounds = calculateFilledCircleBounds;
    window.calculateRectangleBounds = calculateStrokedRectBounds;
    window.calculateCrispStrokeRectBounds = calculateCrispStrokedRectBounds;
    window.calculateFillRectBounds = calculateFilledRectBounds;
    window.calculateLineBounds = calculateStrokedLineBounds;
    window.aggregateBounds = calculateAggregateBounds;
}

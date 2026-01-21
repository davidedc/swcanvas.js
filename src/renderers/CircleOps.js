/**
 * CircleOps - Static methods for optimized circle rendering
 * Follows PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillCircle(), strokeCircle(), fillStrokeCircle()
 *
 * Path-based circles (beginPath() + arc() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * Algorithm notes: Uses a Bresenham circle variant with specific adjustments
 * (center offset, +1 boundary corrections) for correct extreme pixel rendering.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, PixelOps.blend_Alpha
 *
 * Layer 1 (Primitives):
 *   fill_Opaq, fill_Alpha              → SpanOps.fill_Opaq/fill_Alpha
 *   stroke1px_Opaq                     → Direct pixel writes (opaque)
 *   stroke1px_Alpha                    → PixelOps.blend_Alpha
 *   strokeThick_Any                    → SpanOps.fill_Opaq
 *   strokeThick_Alpha                  → SpanOps.fill_Alpha
 *
 * Layer 2 (Composites):
 *   fillStroke_Any                     → SpanOps.fill_Opaq/fill_Alpha
 *
 * MEMORY OPTIMIZATIONS:
 * - stroke1px_Alpha uses conditional deduplication (no Set allocation)
 *   via x!=y + cardinal point checks to prevent overdraw
 *
 * NAMING PATTERN: {operation}[Thickness]_{opacity}
 *   - Opaq = Opaque only, Alpha = Semi-transparent, Any = Handles both
 *   - (No orientation suffix - circles are rotation-invariant)
 */
class CircleOps {
    /**
     * Generate horizontal extents for each scanline of a circle using Bresenham
     * Uses Bresenham circle algorithm variant optimized for correct extreme pixel rendering
     * @param {number} radius - Circle radius (can be float)
     * @returns {object|null} { extents, intRadius, xOffset, yOffset } or null for invalid radius
     */
    static generateExtents(radius) {
        const intRadius = Math.floor(radius);
        if (intRadius < 0) return null;

        // Determine offsets for .5 radius case (affects boundary calculations)
        let xOffset = 0, yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            return { extents: [0], intRadius: 0, xOffset, yOffset };
        }

        // Bresenham initialization (midpoint circle algorithm variant)
        const extents = new Array(intRadius + 1).fill(0);
        let x = 0;
        let y = intRadius;
        let d = 3 - 2 * intRadius;

        while (x <= y) {
            // Record extents using max to handle octant overlap
            extents[y] = Math.max(extents[y], x);
            extents[x] = Math.max(extents[x], y);

            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }

        return { extents, intRadius, xOffset, yOffset };
    }

    /**
     * Optimized opaque circle fill using Bresenham scanlines with 32-bit packed writes
     * Uses Bresenham variant with pixel corrections for accurate rendering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Fill color (must be opaque, alpha=255)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fill_Opaq(surface, cx, cy, radius, color, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Generate extents with Bresenham algorithm
        const extentData = CircleOps.generateExtents(radius);
        if (!extentData) return;
        const { extents, intRadius, xOffset, yOffset } = extentData;

        // Center adjustment for pixel-perfect rendering
        const adjCenterX = Math.floor(cx - 0.5);
        const adjCenterY = Math.floor(cy - 0.5);

        // Fill scanlines - iterate through ALL rows (no skipping)
        for (let rel_y = 0; rel_y <= intRadius; rel_y++) {
            const max_rel_x = extents[rel_y];

            // +1 corrections on min boundaries for pixel accuracy
            const abs_x_min = adjCenterX - max_rel_x - xOffset + 1;
            const abs_x_max = adjCenterX + max_rel_x;
            const abs_y_bottom = adjCenterY + rel_y;
            const abs_y_top = adjCenterY - rel_y - yOffset + 1;

            const spanWidth = abs_x_max - abs_x_min + 1;

            // Draw bottom scanline
            if (abs_y_bottom >= 0 && abs_y_bottom < height) {
                SpanOps.fill_Opaq(data32, width, height, abs_x_min, abs_y_bottom, spanWidth, packedColor, clipBuffer);
            }

            // Draw top scanline (skip overdraw conditions)
            const drawTop = rel_y > 0 && !(rel_y === 1 && yOffset === 0);
            if (drawTop && abs_y_top >= 0 && abs_y_top < height) {
                SpanOps.fill_Opaq(data32, width, height, abs_x_min, abs_y_top, spanWidth, packedColor, clipBuffer);
            }
        }
    }

    /**
     * Optimized circle fill with alpha blending using Bresenham scanlines
     * Uses Bresenham variant with pixel corrections for accurate rendering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fill_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        // Calculate effective alpha (color alpha * global alpha)
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;

        const invAlpha = 1 - effectiveAlpha;
        const r = color.r;
        const g = color.g;
        const b = color.b;

        // Generate extents with Bresenham algorithm
        const extentData = CircleOps.generateExtents(radius);
        if (!extentData) return;
        const { extents, intRadius, xOffset, yOffset } = extentData;

        // Center adjustment for pixel-perfect rendering
        const adjCenterX = Math.floor(cx - 0.5);
        const adjCenterY = Math.floor(cy - 0.5);

        // Fill scanlines - iterate through ALL rows (no skipping)
        for (let rel_y = 0; rel_y <= intRadius; rel_y++) {
            const max_rel_x = extents[rel_y];

            // +1 corrections on min boundaries for pixel accuracy
            const abs_x_min = adjCenterX - max_rel_x - xOffset + 1;
            const abs_x_max = adjCenterX + max_rel_x;
            const abs_y_bottom = adjCenterY + rel_y;
            const abs_y_top = adjCenterY - rel_y - yOffset + 1;

            const spanWidth = abs_x_max - abs_x_min + 1;

            // Draw bottom scanline
            if (abs_y_bottom >= 0 && abs_y_bottom < height) {
                SpanOps.fill_Alpha(data, width, height, abs_x_min, abs_y_bottom, spanWidth,
                    r, g, b, effectiveAlpha, invAlpha, clipBuffer);
            }

            // Draw top scanline (skip overdraw conditions)
            const drawTop = rel_y > 0 && !(rel_y === 1 && yOffset === 0);
            if (drawTop && abs_y_top >= 0 && abs_y_top < height) {
                SpanOps.fill_Alpha(data, width, height, abs_x_min, abs_y_top, spanWidth,
                    r, g, b, effectiveAlpha, invAlpha, clipBuffer);
            }
        }
    }

    /**
     * Optimized 1px opaque circle stroke using Bresenham's algorithm
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Opaq(surface, cx, cy, radius, color, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Center calculation for stroke (standard Bresenham approach)
        const cX = Math.floor(cx);
        const cY = Math.floor(cy);
        const intRadius = Math.floor(radius);

        if (intRadius < 0) return;

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            if (radius >= 0) {
                const px = Math.round(cx);
                const py = Math.round(cy);
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const pos = py * width + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                        data32[pos] = packedColor;
                    }
                }
            }
            return;
        }

        // Determine offsets for .5 radius case
        let xOffset = 0, yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        // Bresenham circle algorithm
        let x = 0;
        let y = intRadius;
        let d = 3 - 2 * intRadius;

        while (x <= y) {
            // Calculate 8 symmetric points with offsets for top/left halves
            const p1x = cX + x, p1y = cY + y;                    // bottom-right
            const p2x = cX + y, p2y = cY + x;                    // bottom-right
            const p3x = cX + y, p3y = cY - x - yOffset;          // top-right
            const p4x = cX + x, p4y = cY - y - yOffset;          // top-right
            const p5x = cX - x - xOffset, p5y = cY - y - yOffset; // top-left
            const p6x = cX - y - xOffset, p6y = cY - x - yOffset; // top-left
            const p7x = cX - y - xOffset, p7y = cY + x;          // bottom-left
            const p8x = cX - x - xOffset, p8y = cY + y;          // bottom-left

            // Plot points with bounds checking
            if (p1x >= 0 && p1x < width && p1y >= 0 && p1y < height) {
                const pos = p1y * width + p1x;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }
            if (x !== y && p2x >= 0 && p2x < width && p2y >= 0 && p2y < height) {
                const pos = p2y * width + p2x;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }
            if (p3x >= 0 && p3x < width && p3y >= 0 && p3y < height) {
                const pos = p3y * width + p3x;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }
            if (p4x >= 0 && p4x < width && p4y >= 0 && p4y < height) {
                const pos = p4y * width + p4x;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }
            if (p5x >= 0 && p5x < width && p5y >= 0 && p5y < height) {
                const pos = p5y * width + p5x;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }
            if (x !== y && p6x >= 0 && p6x < width && p6y >= 0 && p6y < height) {
                const pos = p6y * width + p6x;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }
            if (p7x >= 0 && p7x < width && p7y >= 0 && p7y < height) {
                const pos = p7y * width + p7x;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }
            if (p8x >= 0 && p8x < width && p8y >= 0 && p8y < height) {
                const pos = p8y * width + p8x;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }

            // Update Bresenham state
            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }
    }

    /**
     * Optimized 1px semi-transparent circle stroke using Bresenham's algorithm
     * Uses Set to prevent overdraw for semi-transparent colors
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        // Center calculation for stroke (standard Bresenham approach)
        const cX = Math.floor(cx);
        const cY = Math.floor(cy);
        const intRadius = Math.floor(radius);

        if (intRadius < 0) return;

        // Handle zero radius (single pixel)
        if (intRadius === 0) {
            if (radius >= 0) {
                const px = Math.round(cx);
                const py = Math.round(cy);
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const pos = py * width + px;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
            }
            return;
        }

        // Determine offsets for .5 radius case
        let xOffset = 0, yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

        // Bresenham circle algorithm with conditional checks to prevent overdraw
        // (eliminates Set allocation by using geometric deduplication)
        let x = 0;
        let y = intRadius;
        let d = 3 - 2 * intRadius;

        while (x <= y) {
            // Calculate 8 symmetric points with offsets for top/left halves
            // Primary points (A, C, E, G) - always unique from each other
            const pAx = cX + x, pAy = cY + y;                       // bottom-right quadrant
            const pCx = cX + y, pCy = cY - x - yOffset;             // top-right quadrant
            const pEx = cX - x - xOffset, pEy = cY - y - yOffset;   // top-left quadrant
            const pGx = cX - y - xOffset, pGy = cY + x;             // bottom-left quadrant

            // Swapped points (B, D, F, H) - duplicate primaries when x == y
            const pBx = cX + y, pBy = cY + x;                       // duplicates A when x == y
            const pDx = cX + x, pDy = cY - y - yOffset;             // duplicates C when x == y
            const pFx = cX - y - xOffset, pFy = cY - x - yOffset;   // duplicates E when x == y
            const pHx = cX - x - xOffset, pHy = cY + y;             // duplicates G when x == y, also A when x == 0 && xOffset == 0

            // Draw primary points (always)
            if (pAx >= 0 && pAx < width && pAy >= 0 && pAy < height) {
                const pos = pAy * width + pAx;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }
            if (pCx >= 0 && pCx < width && pCy >= 0 && pCy < height) {
                const pos = pCy * width + pCx;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }
            if (pEx >= 0 && pEx < width && pEy >= 0 && pEy < height) {
                const pos = pEy * width + pEx;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }
            if (pGx >= 0 && pGx < width && pGy >= 0 && pGy < height) {
                const pos = pGy * width + pGx;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }

            // Draw swapped points only when x != y (they duplicate primaries on the diagonal)
            // Additional cardinal point checks: at x == 0, swapped points may duplicate primaries
            if (x !== y) {
                // B duplicates C at right cardinal when x == 0 && yOffset == 0
                if ((x !== 0 || yOffset !== 0) && pBx >= 0 && pBx < width && pBy >= 0 && pBy < height) {
                    const pos = pBy * width + pBx;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
                // D duplicates E at top cardinal when x == 0 && xOffset == 0
                if ((x !== 0 || xOffset !== 0) && pDx >= 0 && pDx < width && pDy >= 0 && pDy < height) {
                    const pos = pDy * width + pDx;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
                // F duplicates G at left cardinal when x == 0 && yOffset == 0
                if ((x !== 0 || yOffset !== 0) && pFx >= 0 && pFx < width && pFy >= 0 && pFy < height) {
                    const pos = pFy * width + pFx;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
                // H duplicates A at bottom cardinal when x == 0 && xOffset == 0
                if ((x !== 0 || xOffset !== 0) && pHx >= 0 && pHx < width && pHy >= 0 && pHy < height) {
                    const pos = pHy * width + pHx;
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
            }

            // Update Bresenham state
            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }
    }

    /**
     * Unified fill and stroke rendering for circles.
     * This method draws both fill and stroke in a single coordinated pass,
     * ensuring no gaps between fill and stroke boundaries.
     *
     * Optimized circle fill+stroke approach using:
     * - Uses single floating-point center (cx - 0.5) for both operations
     * - Uses analytical boundary detection (sqrt-based) instead of Bresenham extents
     * - Uses epsilon contraction (FILL_EPSILON) on fill boundaries to prevent speckles
     * - Renders fill first, then stroke on top (stroke covers any micro-gaps)
     *
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius (path radius)
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color
     * @param {Color} strokeColor - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fillStroke_Any(surface, cx, cy, radius, lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0;

        if (!hasFill && !hasStroke) return;

        // Single floating-point center for both fill and stroke
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate radii based on stroke width
        // The path radius is the center of the stroke
        // Inner radius = radius - lineWidth/2 (fill boundary / stroke inner edge)
        // Outer radius = radius + lineWidth/2 (stroke outer edge)
        // Fill extends to the path radius (center of stroke)
        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;
        const fillRadius = radius; // Path radius is the fill boundary

        // Calculate bounds
        const minY = Math.max(0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(width - 1, Math.ceil(cX + outerRadius + 1));

        // Skip if completely outside canvas
        if (minY > maxY || minX > maxX) return;

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;
        const fillRadiusSquared = fillRadius * fillRadius;

        // Determine rendering mode for fill
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;

        // Determine rendering mode for stroke
        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSquared) continue;

            // Calculate outer circle X intersections (stroke outer boundary)
            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

            // Calculate fill boundaries if this row intersects the fill area
            let leftFillX = -1;
            let rightFillX = -1;
            const fillDistSquared = fillRadiusSquared - dySquared;
            if (hasFill && fillDistSquared >= 0) {
                const fillXDist = Math.sqrt(fillDistSquared);
                // Epsilon contraction to prevent speckles at boundary
                leftFillX = Math.max(minX, Math.ceil(cX - fillXDist + FILL_EPSILON));
                rightFillX = Math.min(maxX, Math.floor(cX + fillXDist - FILL_EPSILON));
            }

            // Calculate inner circle boundaries (stroke inner boundary)
            let innerLeftX = outerRightX + 1; // Default: no inner circle intersection
            let innerRightX = outerLeftX - 1;
            if (innerRadius > 0 && dySquared <= innerRadiusSquared) {
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                innerLeftX = Math.floor(cX - innerXDist);
                innerRightX = Math.ceil(cX + innerXDist);
            }

            // STEP 1: Render fill first (if this row intersects the fill circle) via SpanOps
            if (hasFill && leftFillX >= 0 && leftFillX <= rightFillX) {
                const fillSpanLength = rightFillX - leftFillX + 1;
                if (fillIsOpaque) {
                    SpanOps.fill_Opaq(data32, width, height, leftFillX, y, fillSpanLength, fillPacked, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(data, width, height, leftFillX, y, fillSpanLength,
                        fillColor.r, fillColor.g, fillColor.b, fillEffectiveAlpha, fillInvAlpha, clipBuffer);
                }
            }

            // STEP 2: Render stroke on top (covers any micro-gaps) via SpanOps
            if (hasStroke) {
                // Helper function to render a stroke segment via SpanOps
                const renderStrokeSegment = (startX, endX) => {
                    if (startX > endX) return;
                    const spanLength = endX - startX + 1;
                    if (strokeIsOpaque) {
                        SpanOps.fill_Opaq(data32, width, height, startX, y, spanLength, strokePacked, clipBuffer);
                    } else {
                        SpanOps.fill_Alpha(data, width, height, startX, y, spanLength,
                            strokeColor.r, strokeColor.g, strokeColor.b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer);
                    }
                };

                if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                    // No inner circle intersection - draw entire stroke span
                    renderStrokeSegment(outerLeftX, outerRightX);
                } else {
                    // Intersects both inner and outer circles - draw left and right segments
                    renderStrokeSegment(outerLeftX, innerLeftX);
                    renderStrokeSegment(innerRightX, outerRightX);
                }
            }
        }
    }

    /**
     * Optimized thick stroke circle using scanline-based annulus rendering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: inline per-pixel for opaque, delegated to SpanOps for alpha)
     */
    static strokeThick_Any(surface, cx, cy, radius, lineWidth, color, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;

        // Calculate inner and outer radii for the stroke annulus
        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;

        // Use exact centers for Canvas coordinate alignment
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate bounds with safety margin
        const minY = Math.max(0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(width - 1, Math.ceil(cX + outerRadius + 1));

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;

        // Determine if opaque or needs alpha blending
        const isOpaque = color.a === 255 && globalAlpha >= 1.0;

        if (isOpaque) {
            const packedColor = Surface.packColor(color.r, color.g, color.b, 255);
            const data32 = surface.data32;

            // Process each scanline
            for (let y = minY; y <= maxY; y++) {
                const dy = y - cY;
                const dySquared = dy * dy;

                // Skip if outside outer circle
                if (dySquared > outerRadiusSquared) continue;

                // Calculate outer circle X intersections
                const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
                const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
                const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

                // Case: No inner circle intersection (draw full span)
                if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                    for (let x = outerLeftX; x <= outerRightX; x++) {
                        const pos = y * width + x;
                        if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                            data32[pos] = packedColor;
                        }
                    }
                } else {
                    // Case: Intersects both circles - draw left and right segments
                    const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                    const innerLeftX = Math.min(outerRightX, Math.floor(cX - innerXDist));
                    const innerRightX = Math.max(outerLeftX, Math.ceil(cX + innerXDist));

                    // Left segment
                    for (let x = outerLeftX; x <= innerLeftX; x++) {
                        const pos = y * width + x;
                        if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                            data32[pos] = packedColor;
                        }
                    }

                    // Right segment
                    for (let x = innerRightX; x <= outerRightX; x++) {
                        const pos = y * width + x;
                        if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                            data32[pos] = packedColor;
                        }
                    }
                }
            }
        } else {
            // Semi-transparent: use alpha blending path
            CircleOps.strokeThick_Alpha(surface, cx, cy, radius, lineWidth, color, globalAlpha, clipBuffer);
        }
    }

    /**
     * Thick stroke circle with alpha blending
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Circle radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static strokeThick_Alpha(surface, cx, cy, radius, lineWidth, color, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        const innerRadius = radius - lineWidth / 2;
        const outerRadius = radius + lineWidth / 2;
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        const minY = Math.max(0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius + 1));
        const minX = Math.max(0, Math.floor(cX - outerRadius - 1));
        const maxX = Math.min(width - 1, Math.ceil(cX + outerRadius + 1));

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius > 0 ? innerRadius * innerRadius : 0;

        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            if (dySquared > outerRadiusSquared) continue;

            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(minX, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(maxX, Math.floor(cX + outerXDist));

            if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                // No inner circle intersection - draw full span via SpanOps
                const spanLength = outerRightX - outerLeftX + 1;
                SpanOps.fill_Alpha(data, width, height, outerLeftX, y, spanLength, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
            } else {
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                const innerLeftX = Math.min(outerRightX, Math.floor(cX - innerXDist));
                const innerRightX = Math.max(outerLeftX, Math.ceil(cX + innerXDist));

                // Left segment via SpanOps
                const leftLen = innerLeftX - outerLeftX + 1;
                if (leftLen > 0) {
                    SpanOps.fill_Alpha(data, width, height, outerLeftX, y, leftLen, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
                }

                // Right segment via SpanOps
                const rightLen = outerRightX - innerRightX + 1;
                if (rightLen > 0) {
                    SpanOps.fill_Alpha(data, width, height, innerRightX, y, rightLen, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
                }
            }
        }
    }
}

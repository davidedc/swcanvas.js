/**
 * ArcOps - Static methods for optimized partial arc rendering
 * Follows CircleOps/PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillArc(), outerStrokeArc(), fillOuterStrokeArc()
 *
 * Path-based arcs (beginPath() + arc() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * Unlike CircleOps (which handles full circles), ArcOps handles partial arcs
 * by filtering pixels based on angle range using isAngleInRange().
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): CircleOps.generateExtents (for Bresenham data), PixelOps.blend_Alpha
 *
 * Layer 1 (Primitives - do atomic rendering):
 *   fill_Opaq, fill_Alpha (use CircleOps extents + angle filtering)
 *   stroke1px_Opaq, stroke1px_Alpha, stroke1px_Opaq_Exact
 *   strokeOuter_Opaq, strokeOuter_Alpha
 *
 * Layer 2 (Composites):
 *   fillStrokeOuter_Any → inline rendering (single-pass)
 *
 * NAMING PATTERN: {operation}[Thickness]_{opacity}
 *   - Opaq = Opaque only, Alpha = Semi-transparent, Any = Handles both
 *   - (No orientation suffix - arcs are defined by angles, not rotation)
 */
class ArcOps {
    /**
     * Check if the angle of point (px, py) relative to origin is within [startAngle, endAngle]
     * @param {number} px - X coordinate relative to center
     * @param {number} py - Y coordinate relative to center
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians (must be > startAngle after normalization)
     * @returns {boolean} True if point's angle is within the arc range
     */
    static isAngleInRange(px, py, startAngle, endAngle) {
        let angle = Math.atan2(py, px);
        if (angle < 0) angle += TAU;
        if (angle < startAngle) angle += TAU;
        return angle >= startAngle && angle <= endAngle;
    }

    /**
     * Normalize angles for consistent arc rendering
     * Ensures endAngle > startAngle and handles anticlockwise direction
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {boolean} anticlockwise - Direction flag
     * @returns {object} { start, end } normalized angles
     */
    static normalizeAngles(startAngle, endAngle, anticlockwise) {
        let start = startAngle;
        let end = endAngle;

        // Normalize to [0, TAU) range
        start = start % TAU;
        if (start < 0) start += TAU;
        end = end % TAU;
        if (end < 0) end += TAU;

        if (anticlockwise) {
            // Swap and adjust for anticlockwise
            const temp = start;
            start = end;
            end = temp;
        }

        // Ensure end > start
        if (end <= start) {
            end += TAU;
        }

        return { start, end };
    }

    /**
     * Fill an arc (pie slice) with opaque color - direct rendering
     * Uses CircleOps.generateExtents() for correct pixel coverage with angle filtering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Fill color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static fill_Opaq(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Use CircleOps.generateExtents for correct Bresenham-based pixel coverage
        const extentData = CircleOps.generateExtents(radius);
        if (!extentData) return;
        const { extents, intRadius, xOffset, yOffset } = extentData;

        // CircleOps center adjustment
        const adjCenterX = Math.floor(cx - 0.5);
        const adjCenterY = Math.floor(cy - 0.5);

        // Process each scanline using Bresenham extents
        for (let rel_y = 0; rel_y <= intRadius; rel_y++) {
            const max_rel_x = extents[rel_y];

            // Calculate absolute coordinates (same as CircleOps)
            const abs_x_min = adjCenterX - max_rel_x - xOffset + 1;
            const abs_x_max = adjCenterX + max_rel_x;
            const abs_y_bottom = adjCenterY + rel_y;
            const abs_y_top = adjCenterY - rel_y - yOffset + 1;

            // Process bottom half
            if (abs_y_bottom >= 0 && abs_y_bottom < height) {
                const dy = rel_y;
                for (let x = Math.max(0, abs_x_min); x <= Math.min(width - 1, abs_x_max); x++) {
                    const dx = x - adjCenterX;
                    const pos = abs_y_bottom * width + x;
                    /*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, packedColor, clipBuffer, dx, dy, startAngle, endAngle)*/
                }
            }

            // Process top half (skip overdraw conditions - same as CircleOps)
            const drawTop = rel_y > 0 && !(rel_y === 1 && yOffset === 0);
            if (drawTop && abs_y_top >= 0 && abs_y_top < height) {
                const dy = -rel_y;
                for (let x = Math.max(0, abs_x_min); x <= Math.min(width - 1, abs_x_max); x++) {
                    const dx = x - adjCenterX;
                    const pos = abs_y_top * width + x;
                    /*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, packedColor, clipBuffer, dx, dy, startAngle, endAngle)*/
                }
            }
        }
    }

    /**
     * Fill an arc (pie slice) with alpha blending
     * Uses CircleOps.generateExtents() for correct pixel coverage with angle filtering
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static fill_Alpha(surface, cx, cy, radius, startAngle, endAngle, color, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        // Use CircleOps.generateExtents for correct Bresenham-based pixel coverage
        const extentData = CircleOps.generateExtents(radius);
        if (!extentData) return;
        const { extents, intRadius, xOffset, yOffset } = extentData;

        // CircleOps center adjustment
        const adjCenterX = Math.floor(cx - 0.5);
        const adjCenterY = Math.floor(cy - 0.5);

        // Process each scanline using Bresenham extents
        for (let rel_y = 0; rel_y <= intRadius; rel_y++) {
            const max_rel_x = extents[rel_y];

            // Calculate absolute coordinates (same as CircleOps)
            const abs_x_min = adjCenterX - max_rel_x - xOffset + 1;
            const abs_x_max = adjCenterX + max_rel_x;
            const abs_y_bottom = adjCenterY + rel_y;
            const abs_y_top = adjCenterY - rel_y - yOffset + 1;

            // Process bottom half
            if (abs_y_bottom >= 0 && abs_y_bottom < height) {
                const dy = rel_y;
                for (let x = Math.max(0, abs_x_min); x <= Math.min(width - 1, abs_x_max); x++) {
                    const dx = x - adjCenterX;
                    const pos = abs_y_bottom * width + x;
                    /*@inline:BLEND_ALPHA_ARC_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer, dx, dy, startAngle, endAngle)*/
                }
            }

            // Process top half (skip overdraw conditions - same as CircleOps)
            const drawTop = rel_y > 0 && !(rel_y === 1 && yOffset === 0);
            if (drawTop && abs_y_top >= 0 && abs_y_top < height) {
                const dy = -rel_y;
                for (let x = Math.max(0, abs_x_min); x <= Math.min(width - 1, abs_x_max); x++) {
                    const dx = x - adjCenterX;
                    const pos = abs_y_top * width + x;
                    /*@inline:BLEND_ALPHA_ARC_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer, dx, dy, startAngle, endAngle)*/
                }
            }
        }
    }

    /**
     * Optimized 1px opaque arc stroke using Bresenham + direct writes
     * No Set, no thickness expansion - just angle-filtered Bresenham points
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Opaq(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Use same center calculation as CircleOps.stroke1pxOpaque()
        const adjCX = Math.floor(cx);
        const adjCY = Math.floor(cy);

        // Calculate offsets for fractional radii (same as CircleOps)
        let xOffset = 0, yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

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

        // Bresenham circle algorithm with angle filtering
        let bx = 0;
        let by = intRadius;
        let d = 3 - 2 * intRadius;

        while (by >= bx) {
            // 8 symmetric points with offset corrections (same pattern as CircleOps)
            const points = [
                [bx, by],                                    // bottom-right: no offset
                [by, bx],                                    // bottom-right: no offset
                [by, -bx - yOffset],                         // top-right: yOffset
                [bx, -by - yOffset],                         // top-right: yOffset
                [-bx - xOffset, -by - yOffset],              // top-left: both offsets
                [-by - xOffset, -bx - yOffset],              // top-left: both offsets
                [-by - xOffset, bx],                         // bottom-left: xOffset
                [-bx - xOffset, by]                          // bottom-left: xOffset
            ];

            for (const [px, py] of points) {
                // Only render if within angle range
                if (ArcOps.isAngleInRange(px, py, startAngle, endAngle)) {
                    const screenX = adjCX + px;
                    const screenY = adjCY + py;

                    if (screenX >= 0 && screenX < width && screenY >= 0 && screenY < height) {
                        const pos = screenY * width + screenX;
                        if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                            data32[pos] = packedColor;
                        }
                    }
                }
            }

            bx++;
            if (d > 0) {
                by--;
                d = d + 4 * (bx - by) + 10;
            } else {
                d = d + 4 * bx + 6;
            }
        }
    }

    /**
     * 1px opaque arc stroke using angle-based iteration with exact endpoint pixels.
     * Unlike Bresenham, this method guarantees pixels at exact start/end angles,
     * eliminating junction gaps with connected line segments.
     *
     * Use this when junction alignment is critical (e.g., rotated rounded rectangles)
     * where Bresenham's angular coverage gaps would cause discontinuities.
     *
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X (floating-point)
     * @param {number} cy - Center Y (floating-point)
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Opaq_Exact(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        // Hoist color packing
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // 1. Setup Arc Steps
        // Keep the safety factor to ensure continuous lines, but we will deduplicate writes later.
        const arcLength = radius * Math.abs(endAngle - startAngle);
        const numSteps = Math.max(Math.ceil(arcLength * 2), 8);
        const angleStep = (endAngle - startAngle) / numSteps;

        // 2. Optimization: Use Incremental Rotation (Rotation Matrix)
        // This removes Math.cos/sin from the hot loop, replacing them with multiplication.
        // x' = x*cos - y*sin
        // y' = x*sin + y*cos
        const cosStep = Math.cos(angleStep);
        const sinStep = Math.sin(angleStep);

        // Start position relative to center
        let x = radius * Math.cos(startAngle);
        let y = radius * Math.sin(startAngle);

        // 3. Optimization: Bounds Check Hoisting
        // If the entire circle is safely within the canvas, we can skip individual pixel bounds checks.
        // We use a conservative estimate for safety.
        const isSafe = (cx - radius >= 0) && (cx + radius < width) &&
            (cy - radius >= 0) && (cy + radius < height);

        // Track the last written pixel index to prevent overdraw (expensive memory writes)
        let lastPos = -1;

        for (let i = 0; i <= numSteps; i++) {
            // Force exact precision for the final point to satisfy "ExactEndpoints" requirement
            // (prevents floating point drift from the rotation matrix)
            if (i === numSteps) {
                x = radius * Math.cos(endAngle);
                y = radius * Math.sin(endAngle);
            }

            // Fast floor (Bitwise OR 0) matches Math.floor for positive numbers.
            // If your inputs can be negative (off-canvas), stick to Math.floor. 
            // We use Math.floor here to match the original LineOps consistency requirement.
            const px = Math.floor(cx + x);
            const py = Math.floor(cy + y);

            // 4. Optimization: Deduplication
            // Because numSteps is high (2x arcLength), we often hit the same pixel twice.
            // We calculate the linear position once and check if we just wrote to it.
            const pos = py * width + px;

            if (pos !== lastPos) {
                // Apply bounds check only if the circle isn't fully contained
                if (isSafe || (px >= 0 && px < width && py >= 0 && py < height)) {
                    // Clipping check
                    if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                        data32[pos] = packedColor;
                        lastPos = pos;
                    }
                }
            }

            // Apply rotation for next iteration (Incremental Trigonometry)
            const nextX = x * cosStep - y * sinStep;
            y = x * sinStep + y * cosStep;
            x = nextX;
        }
    }
    /**
     * Optimized 1px semi-transparent arc stroke using Bresenham + Set
     * Uses Set to prevent overdraw for correct alpha blending
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Alpha(surface, cx, cy, radius, startAngle, endAngle, color, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        // Use same center calculation as CircleOps.stroke1pxAlpha()
        const adjCX = Math.floor(cx);
        const adjCY = Math.floor(cy);

        // Calculate offsets for fractional radii (same as CircleOps)
        let xOffset = 0, yOffset = 0;
        if (radius > 0 && (radius * 2) % 2 === 1) {
            xOffset = 1;
            yOffset = 1;
        }

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

        // Collect unique pixels using Set (needed for alpha to prevent overdraw)
        const strokePixels = new Set();

        // Bresenham circle algorithm with angle filtering
        let bx = 0;
        let by = intRadius;
        let d = 3 - 2 * intRadius;

        while (by >= bx) {
            // 8 symmetric points with offset corrections (same pattern as CircleOps)
            const points = [
                [bx, by],                                    // bottom-right: no offset
                [by, bx],                                    // bottom-right: no offset
                [by, -bx - yOffset],                         // top-right: yOffset
                [bx, -by - yOffset],                         // top-right: yOffset
                [-bx - xOffset, -by - yOffset],              // top-left: both offsets
                [-by - xOffset, -bx - yOffset],              // top-left: both offsets
                [-by - xOffset, bx],                         // bottom-left: xOffset
                [-bx - xOffset, by]                          // bottom-left: xOffset
            ];

            for (const [px, py] of points) {
                if (ArcOps.isAngleInRange(px, py, startAngle, endAngle)) {
                    const screenX = adjCX + px;
                    const screenY = adjCY + py;

                    if (screenX >= 0 && screenX < width && screenY >= 0 && screenY < height) {
                        strokePixels.add(screenY * width + screenX);
                    }
                }
            }

            bx++;
            if (d > 0) {
                by--;
                d = d + 4 * (bx - by) + 10;
            } else {
                d = d + 4 * bx + 6;
            }
        }

        // Render collected pixels with alpha blending
        for (const pos of strokePixels) {
            if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
            }
        }
    }

    /**
     * Stroke outer arc with opaque color using scanline-based annulus algorithm
     * Produces smooth curved strokes by using inner/outer radius boundaries
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static strokeOuter_Opaq(surface, cx, cy, radius, startAngle, endAngle, lineWidth, color, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Use floating-point center like CircleOps.fillStroke() for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Handle zero/tiny radius (single pixel)
        if (radius < 1) {
            const px = Math.round(cx);
            const py = Math.round(cy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
                const pos = py * width + px;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    data32[pos] = packedColor;
                }
            }
            return;
        }

        // Annulus boundaries - stroke width distributed around the arc path
        const innerRadius = Math.max(0, radius - lineWidth / 2);
        const outerRadius = radius + lineWidth / 2;

        // Bounds
        const minY = Math.max(0, Math.floor(cY - outerRadius));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius));

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius * innerRadius;

        // Scanline iteration
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSquared) continue;

            // Outer circle X bounds for this scanline
            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(0, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(width - 1, Math.floor(cX + outerXDist));

            // Inner circle X bounds (the "hole" in the annulus)
            let innerLeftX = outerRightX + 1; // Default: no inner hole on this scanline
            let innerRightX = outerLeftX - 1;
            if (innerRadius > 0 && dySquared < innerRadiusSquared) {
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                innerLeftX = Math.floor(cX - innerXDist);
                innerRightX = Math.ceil(cX + innerXDist);
            }

            // Process left annulus segment (from outer left to inner left)
            const leftEnd = Math.min(innerLeftX, outerRightX);
            for (let x = outerLeftX; x <= leftEnd; x++) {
                const dx = x - cX;
                const pos = y * width + x;
                /*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, packedColor, clipBuffer, dx, dy, startAngle, endAngle)*/
            }

            // Process right annulus segment (from inner right to outer right)
            if (innerRadius > 0 && dySquared < innerRadiusSquared) {
                const rightStart = Math.max(innerRightX, outerLeftX);
                for (let x = rightStart; x <= outerRightX; x++) {
                    const dx = x - cX;
                    const pos = y * width + x;
                    /*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, packedColor, clipBuffer, dx, dy, startAngle, endAngle)*/
                }
            }
        }
    }

    /**
     * Stroke outer arc with alpha blending using scanline-based annulus algorithm
     * Produces smooth curved strokes by using inner/outer radius boundaries
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static strokeOuter_Alpha(surface, cx, cy, radius, startAngle, endAngle, lineWidth, color, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        // Use floating-point center like CircleOps.fillStroke() for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Handle zero/tiny radius (single pixel)
        if (radius < 1) {
            const px = Math.round(cx);
            const py = Math.round(cy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
                const pos = py * width + px;
                if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                }
            }
            return;
        }

        // Annulus boundaries - stroke width distributed around the arc path
        const innerRadius = Math.max(0, radius - lineWidth / 2);
        const outerRadius = radius + lineWidth / 2;

        // Bounds
        const minY = Math.max(0, Math.floor(cY - outerRadius));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius));

        const outerRadiusSquared = outerRadius * outerRadius;
        const innerRadiusSquared = innerRadius * innerRadius;

        // Scanline iteration
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSquared) continue;

            // Outer circle X bounds for this scanline
            const outerXDist = Math.sqrt(outerRadiusSquared - dySquared);
            const outerLeftX = Math.max(0, Math.ceil(cX - outerXDist));
            const outerRightX = Math.min(width - 1, Math.floor(cX + outerXDist));

            // Inner circle X bounds (the "hole" in the annulus)
            let innerLeftX = outerRightX + 1; // Default: no inner hole on this scanline
            let innerRightX = outerLeftX - 1;
            if (innerRadius > 0 && dySquared < innerRadiusSquared) {
                const innerXDist = Math.sqrt(innerRadiusSquared - dySquared);
                innerLeftX = Math.floor(cX - innerXDist);
                innerRightX = Math.ceil(cX + innerXDist);
            }

            // Process left annulus segment (from outer left to inner left)
            const leftEnd = Math.min(innerLeftX, outerRightX);
            for (let x = outerLeftX; x <= leftEnd; x++) {
                const dx = x - cX;
                const pos = y * width + x;
                /*@inline:BLEND_ALPHA_ARC_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer, dx, dy, startAngle, endAngle)*/
            }

            // Process right annulus segment (from inner right to outer right)
            if (innerRadius > 0 && dySquared < innerRadiusSquared) {
                const rightStart = Math.max(innerRightX, outerLeftX);
                for (let x = rightStart; x <= outerRightX; x++) {
                    const dx = x - cX;
                    const pos = y * width + x;
                    /*@inline:BLEND_ALPHA_ARC_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer, dx, dy, startAngle, endAngle)*/
                }
            }
        }
    }

    /**
     * Fill and stroke an arc in a unified pass using sqrt-based analytical boundaries.
     * Mirrors CircleOps.fillStroke() approach to prevent speckles between fill and stroke.
     * Uses epsilon contraction on fill boundaries to ensure clean fill/stroke interface.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius (path radius - center of stroke)
     * @param {number} startAngle - Start angle in radians (normalized)
     * @param {number} endAngle - End angle in radians (normalized, > startAngle)
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color (null/undefined for no fill)
     * @param {Color} strokeColor - Stroke color (null/undefined for no stroke)
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static fillStrokeOuter_Any(surface, cx, cy, radius, startAngle, endAngle, lineWidth,
        fillColor, strokeColor, globalAlpha, clipBuffer) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        // Single floating-point center for both fill and stroke (CircleOps.fillStroke approach)
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate radii based on stroke width
        // The path radius is the center of the stroke
        // Inner radius = radius - lineWidth/2 (fill boundary / stroke inner edge)
        // Outer radius = radius + lineWidth/2 (stroke outer edge)
        // Fill extends to the path radius (center of stroke)
        const innerRadius = hasStroke ? radius - lineWidth / 2 : radius;
        const outerRadius = hasStroke ? radius + lineWidth / 2 : radius;
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
                // Epsilon contraction to prevent speckles at boundary (CircleOps approach)
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

            // STEP 1: Render fill first (if this row intersects the fill circle)
            if (hasFill && leftFillX >= 0 && leftFillX <= rightFillX) {
                if (fillIsOpaque) {
                    for (let x = leftFillX; x <= rightFillX; x++) {
                        const dx = x - cX;
                        const pos = y * width + x;
                        /*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, fillPacked, clipBuffer, dx, dy, startAngle, endAngle)*/
                    }
                } else {
                    const fr = fillColor.r, fg = fillColor.g, fb = fillColor.b;
                    for (let x = leftFillX; x <= rightFillX; x++) {
                        const dx = x - cX;
                        const pos = y * width + x;
                        /*@inline:BLEND_ALPHA_ARC_CLIPPED(data, pos, fr, fg, fb, fillEffectiveAlpha, fillInvAlpha, clipBuffer, dx, dy, startAngle, endAngle)*/
                    }
                }
            }

            // STEP 2: Render stroke on top (covers any micro-gaps)
            if (hasStroke) {
                const sr = strokeColor.r, sg = strokeColor.g, sb = strokeColor.b;

                if (innerRadius <= 0 || dySquared > innerRadiusSquared) {
                    // No inner circle intersection - draw entire stroke span
                    for (let x = outerLeftX; x <= outerRightX; x++) {
                        const dx = x - cX;
                        const pos = y * width + x;
                        if (strokeIsOpaque) {
                            /*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, strokePacked, clipBuffer, dx, dy, startAngle, endAngle)*/
                        } else {
                            /*@inline:BLEND_ALPHA_ARC_CLIPPED(data, pos, sr, sg, sb, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer, dx, dy, startAngle, endAngle)*/
                        }
                    }
                } else {
                    // Intersects both inner and outer circles - draw left and right segments
                    for (let x = outerLeftX; x <= innerLeftX; x++) {
                        const dx = x - cX;
                        const pos = y * width + x;
                        if (strokeIsOpaque) {
                            /*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, strokePacked, clipBuffer, dx, dy, startAngle, endAngle)*/
                        } else {
                            /*@inline:BLEND_ALPHA_ARC_CLIPPED(data, pos, sr, sg, sb, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer, dx, dy, startAngle, endAngle)*/
                        }
                    }
                    for (let x = innerRightX; x <= outerRightX; x++) {
                        const dx = x - cX;
                        const pos = y * width + x;
                        if (strokeIsOpaque) {
                            /*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, strokePacked, clipBuffer, dx, dy, startAngle, endAngle)*/
                        } else {
                            /*@inline:BLEND_ALPHA_ARC_CLIPPED(data, pos, sr, sg, sb, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer, dx, dy, startAngle, endAngle)*/
                        }
                    }
                }
            }
        }
    }
}


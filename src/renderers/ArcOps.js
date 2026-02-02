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
 * by filtering pixels based on angle range using isAngleInRange_Fast() or
 * inline ARC_FAST_CLIPPED templates for per-pixel Bresenham rendering.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): CircleOps.generateExtents (for Bresenham data), inline markers
 *
 * Layer 1 (Primitives - do atomic rendering):
 *   fill_Opaq, fill_Alpha (use CircleOps extents + angle filtering via isAngleInRange_Fast)
 *   stroke1px_Opaq (uses SET_OPAQUE_ARC_FAST_CLIPPED inline template)
 *   stroke1px_Alpha (uses BLEND_ALPHA_ARC_FAST_CLIPPED inline template)
 *   stroke1px_Opaq_Exact (uses angle-based iteration for exact endpoints)
 *   strokeOuter_Opaq, strokeOuter_Alpha
 *
 * Layer 2 (Composites):
 *   fillStrokeOuter_Any → inline rendering (single-pass)
 *
 * MEMORY OPTIMIZATIONS:
 * - stroke1px_Opaq uses SET_OPAQUE_ARC_FAST_CLIPPED (angle+bounds+clipping in one template)
 * - stroke1px_Alpha uses BLEND_ALPHA_ARC_FAST_CLIPPED + conditional deduplication
 *   following CircleOps pattern: primary/swapped point checks prevent overdraw
 * - Module-level scratch buffer (_arcEventBuffer) for scanline events
 *
 * NAMING PATTERN: {operation}[Thickness]_{opacity}
 *   - Opaq = Opaque only, Alpha = Semi-transparent, Any = Handles both
 *   - (No orientation suffix - arcs are defined by angles, not rotation)
 */

// Module-level scratch buffer for scanline events - avoids per-scanline allocation
// Max 6 events: 2 outer + 2 inner + 2 rays (for strokeOuter)
// Max 4 events: 2 circle + 2 rays (for fill)
const _arcEventBuffer = new Float32Array(8);

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
     * Precompute arc parameters for fast cross-product angle checking.
     * Call once per arc, then use isAngleInRange_Fast for each pixel.
     *
     * @param {number} startAngle - Normalized start angle in radians
     * @param {number} endAngle - Normalized end angle in radians (must be > startAngle)
     * @returns {object} { startCos, startSin, endCos, endSin, isLargeArc, isFullCircle }
     */
    static getArcParams(startAngle, endAngle) {
        // Calculate arc span (endAngle is already > startAngle from normalizeAngles)
        const diff = endAngle - startAngle;

        return {
            startCos: Math.cos(startAngle),
            startSin: Math.sin(startAngle),
            endCos: Math.cos(endAngle),
            endSin: Math.sin(endAngle),
            isLargeArc: diff > Math.PI,
            isFullCircle: diff >= TAU - 1e-5
        };
    }

    /**
     * Fast angle check using cross-product (replaces atan2).
     * Uses the fact that cross(V, P) >= 0 means P is counter-clockwise from V.
     *
     * Cost: 4 multiplications, 2 subtractions, 2 comparisons
     * vs atan2: expensive transcendental function
     *
     * @param {number} px - X coordinate relative to arc center
     * @param {number} py - Y coordinate relative to arc center
     * @param {number} startCos - cos(startAngle)
     * @param {number} startSin - sin(startAngle)
     * @param {number} endCos - cos(endAngle)
     * @param {number} endSin - sin(endAngle)
     * @param {boolean} isLargeArc - True if arc spans > 180°
     * @returns {boolean} True if point's angle is within arc range
     */
    static isAngleInRange_Fast(px, py, startCos, startSin, endCos, endSin, isLargeArc) {
        // Cross product: V × P = Vx*Py - Vy*Px
        // P is counter-clockwise from V (i.e., "after" V going CCW) if cross >= 0
        const afterStart = startCos * py - startSin * px >= 0;
        const beforeEnd = endCos * py - endSin * px <= 0;

        // For small arcs (<180°): point must be after start AND before end
        // For large arcs (>180°): point must be after start OR before end
        return isLargeArc ? afterStart || beforeEnd : afterStart && beforeEnd;
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
     * In-place insertion sort for event buffer. Faster than native sort for N < 10.
     * @private
     * @param {Float32Array} buffer - Event buffer
     * @param {number} count - Number of elements to sort
     */
    static _sortEvents(buffer, count) {
        for (let i = 1; i < count; i++) {
            const val = buffer[i];
            let j = i - 1;
            while (j >= 0 && buffer[j] > val) {
                buffer[j + 1] = buffer[j];
                j--;
            }
            buffer[j + 1] = val;
        }
    }

    /**
     * Fill an arc (pie slice) with opaque color - direct rendering
     * Uses span-based scanline algorithm with cross-product angle checks.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Fill color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static fill_Opaq(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.fill_Opaq(surface, cx, cy, radius, color, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use floating-point center for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Bounds
        const minY = Math.max(0, Math.floor(cY - radius));
        const maxY = Math.min(height - 1, Math.ceil(cY + radius));

        const radiusSquared = radius * radius;

        // Precompute ray slopes for intersection calculation
        // x = dy * cos(angle) / sin(angle)  when sin(angle) != 0
        const startHasSlope = Math.abs(startSin) > 1e-10;
        const endHasSlope = Math.abs(endSin) > 1e-10;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside circle
            if (dySquared > radiusSquared) continue;

            // Circle intersection with this scanline
            const xDist = Math.sqrt(radiusSquared - dySquared);
            const circleLeft = cX - xDist;
            const circleRight = cX + xDist;

            // Collect events (boundary points): circle edges + ray intersections
            // Note: Do NOT add cX here - the center is interior, not a boundary
            // Uses module-level scratch buffer to avoid per-scanline allocation
            let evtCount = 0;
            _arcEventBuffer[evtCount++] = circleLeft;
            _arcEventBuffer[evtCount++] = circleRight;

            // Add start ray intersection if it crosses this scanline
            if (startHasSlope) {
                const startX = cX + dy * startSlope;
                if (startX >= circleLeft && startX <= circleRight) {
                    _arcEventBuffer[evtCount++] = startX;
                }
            } else if (Math.abs(dy) < 1e-10) {
                // Horizontal ray (sin=0), handle center scanline
                // Ray goes in direction of startCos (positive = right, negative = left)
                _arcEventBuffer[evtCount++] = startCos > 0 ? circleRight : circleLeft;
            }

            // Add end ray intersection if it crosses this scanline
            if (endHasSlope) {
                const endX = cX + dy * endSlope;
                if (endX >= circleLeft && endX <= circleRight) {
                    _arcEventBuffer[evtCount++] = endX;
                }
            } else if (Math.abs(dy) < 1e-10) {
                // Horizontal ray (sin=0), handle center scanline
                _arcEventBuffer[evtCount++] = endCos > 0 ? circleRight : circleLeft;
            }

            // Sort events by X using insertion sort (faster than native sort for N < 10)
            ArcOps._sortEvents(_arcEventBuffer, evtCount);

            // Process each segment between events
            for (let i = 0; i < evtCount - 1; i++) {
                const segLeft = _arcEventBuffer[i];
                const segRight = _arcEventBuffer[i + 1];

                // Skip degenerate segments
                if (segRight - segLeft < 0.5) continue;

                // Test midpoint
                const midX = (segLeft + segRight) / 2;
                const dx = midX - cX;

                // Check if midpoint is within arc angle range (fast cross-product check)
                if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) {
                    continue;
                }

                // Fill this segment via SpanOps
                // Use half-open interval [segLeft, segRight) to avoid double-including boundary pixels
                const xStart = Math.max(0, Math.ceil(segLeft));
                const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                const length = xEnd - xStart + 1;

                if (length > 0) {
                    SpanOps.fill_Opaq(data32, width, height, xStart, y, length, packedColor, clipBuffer);
                }
            }
        }
    }

    /**
     * Fill an arc (pie slice) with alpha blending
     * Uses span-based scanline algorithm with cross-product angle checks.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static fill_Alpha(surface, cx, cy, radius, startAngle, endAngle, color, globalAlpha, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.fill_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use floating-point center for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Bounds
        const minY = Math.max(0, Math.floor(cY - radius));
        const maxY = Math.min(height - 1, Math.ceil(cY + radius));

        const radiusSquared = radius * radius;

        // Precompute ray slopes for intersection calculation
        const startHasSlope = Math.abs(startSin) > 1e-10;
        const endHasSlope = Math.abs(endSin) > 1e-10;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside circle
            if (dySquared > radiusSquared) continue;

            // Circle intersection with this scanline
            const xDist = Math.sqrt(radiusSquared - dySquared);
            const circleLeft = cX - xDist;
            const circleRight = cX + xDist;

            // Collect events (boundary points): circle edges + ray intersections
            // Note: Do NOT add cX here - the center is interior, not a boundary
            // Uses module-level scratch buffer to avoid per-scanline allocation
            let evtCount = 0;
            _arcEventBuffer[evtCount++] = circleLeft;
            _arcEventBuffer[evtCount++] = circleRight;

            // Add start ray intersection if it crosses this scanline
            if (startHasSlope) {
                const startX = cX + dy * startSlope;
                if (startX >= circleLeft && startX <= circleRight) {
                    _arcEventBuffer[evtCount++] = startX;
                }
            } else if (Math.abs(dy) < 1e-10) {
                _arcEventBuffer[evtCount++] = startCos > 0 ? circleRight : circleLeft;
            }

            // Add end ray intersection if it crosses this scanline
            if (endHasSlope) {
                const endX = cX + dy * endSlope;
                if (endX >= circleLeft && endX <= circleRight) {
                    _arcEventBuffer[evtCount++] = endX;
                }
            } else if (Math.abs(dy) < 1e-10) {
                _arcEventBuffer[evtCount++] = endCos > 0 ? circleRight : circleLeft;
            }

            // Sort events by X using insertion sort (faster than native sort for N < 10)
            ArcOps._sortEvents(_arcEventBuffer, evtCount);

            // Process each segment between events
            for (let i = 0; i < evtCount - 1; i++) {
                const segLeft = _arcEventBuffer[i];
                const segRight = _arcEventBuffer[i + 1];

                // Skip degenerate segments
                if (segRight - segLeft < 0.5) continue;

                // Test midpoint
                const midX = (segLeft + segRight) / 2;
                const dx = midX - cX;

                // Check if midpoint is within arc angle range (fast cross-product check)
                if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) {
                    continue;
                }

                // Fill this segment via SpanOps
                // Use half-open interval [segLeft, segRight) to avoid double-including boundary pixels
                const xStart = Math.max(0, Math.ceil(segLeft));
                const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                const length = xEnd - xStart + 1;

                if (length > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        xStart,
                        y,
                        length,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            }
        }
    }

    /**
     * Optimized 1px opaque arc stroke using Bresenham + direct writes
     * Uses fast cross-product angle check instead of atan2.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_Opaq(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Precompute arc parameters for fast angle check
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.stroke1px_Opaq(surface, cx, cy, radius, color, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use same center calculation as CircleOps.stroke1pxOpaque()
        const adjCX = Math.floor(cx);
        const adjCY = Math.floor(cy);

        // Calculate offsets for fractional radii (same as CircleOps)
        let xOffset = 0,
            yOffset = 0;
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
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        data32[pos] = packedColor;
                    }
                }
            }
            return;
        }

        // Bresenham circle algorithm with fast angle filtering
        let bx = 0;
        let by = intRadius;
        let d = 3 - 2 * intRadius;

        while (by >= bx) {
            // 8 symmetric points with offset corrections (same pattern as CircleOps)
            const points = [
                [bx, by], // bottom-right: no offset
                [by, bx], // bottom-right: no offset
                [by, -bx - yOffset], // top-right: yOffset
                [bx, -by - yOffset], // top-right: yOffset
                [-bx - xOffset, -by - yOffset], // top-left: both offsets
                [-by - xOffset, -bx - yOffset], // top-left: both offsets
                [-by - xOffset, bx], // bottom-left: xOffset
                [-bx - xOffset, by] // bottom-left: xOffset
            ];

            for (const [px, py] of points) {
                const screenX = adjCX + px;
                const screenY = adjCY + py;
                /*@inline:SET_OPAQUE_ARC_FAST_CLIPPED(data32, packedColor, clipBuffer, px, py, startCos, startSin, endCos, endSin, isLargeArc, screenX, screenY, width, height)*/
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
    static stroke1px_Opaq_Exact(surface, cx, cy, radius, startAngle, endAngle, color, clipBuffer = null) {
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
        const isSafe = cx - radius >= 0 && cx + radius < width && cy - radius >= 0 && cy + radius < height;

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
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
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
     * Optimized 1px semi-transparent arc stroke using Bresenham with conditional deduplication.
     * Uses fast cross-product angle check via inline template. Prevents overdraw via
     * bx != by + cardinal point checks (same pattern as CircleOps.stroke1px_Alpha).
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
    static stroke1px_Alpha(surface, cx, cy, radius, startAngle, endAngle, color, globalAlpha, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Precompute arc parameters for fast angle check
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.stroke1px_Alpha(surface, cx, cy, radius, color, globalAlpha, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use same center calculation as CircleOps.stroke1pxAlpha()
        const adjCX = Math.floor(cx);
        const adjCY = Math.floor(cy);

        // Calculate offsets for fractional radii (same as CircleOps)
        let xOffset = 0,
            yOffset = 0;
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
                    if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                    }
                }
            }
            return;
        }

        // Bresenham circle algorithm with conditional checks to prevent overdraw
        // (eliminates Set allocation by using geometric deduplication - same pattern as CircleOps)
        let bx = 0;
        let by = intRadius;
        let d = 3 - 2 * intRadius;

        while (bx <= by) {
            // Calculate 8 symmetric points with offsets for top/left halves
            // Primary points (A, C, E, G) - always unique from each other
            // Note: Quadrant labels use screen coordinates (Y-down). In standard math (Y-up):
            // bottom-right = Q1, top-right = Q4, top-left = Q3, bottom-left = Q2
            const pAx = adjCX + bx,
                pAy = adjCY + by; // bottom-right quadrant (math: Q1)
            const pCx = adjCX + by,
                pCy = adjCY - bx - yOffset; // top-right quadrant (math: Q4)
            const pEx = adjCX - bx - xOffset,
                pEy = adjCY - by - yOffset; // top-left quadrant (math: Q3)
            const pGx = adjCX - by - xOffset,
                pGy = adjCY + bx; // bottom-left quadrant (math: Q2)

            // Swapped points (B, D, F, H) - duplicate primaries when bx == by
            const pBx = adjCX + by,
                pBy = adjCY + bx; // duplicates A when bx == by
            const pDx = adjCX + bx,
                pDy = adjCY - by - yOffset; // duplicates C when bx == by
            const pFx = adjCX - by - xOffset,
                pFy = adjCY - bx - yOffset; // duplicates E when bx == by
            const pHx = adjCX - bx - xOffset,
                pHy = adjCY + by; // duplicates G when bx == by

            // Draw primary points (always) - with angle filtering
            // Note: Quadrant labels use screen coordinates (Y-down). In standard math (Y-up):
            // bottom-right = Q1, top-right = Q4, top-left = Q3, bottom-left = Q2
            // Point A (bottom-right quadrant, math: Q1)
            /*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, effectiveAlpha, invAlpha, clipBuffer, bx, by, startCos, startSin, endCos, endSin, isLargeArc, pAx, pAy, width, height)*/
            // Point C (top-right quadrant, math: Q4)
            /*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, effectiveAlpha, invAlpha, clipBuffer, by, -bx - yOffset, startCos, startSin, endCos, endSin, isLargeArc, pCx, pCy, width, height)*/
            // Point E (top-left quadrant, math: Q3)
            /*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, effectiveAlpha, invAlpha, clipBuffer, -bx - xOffset, -by - yOffset, startCos, startSin, endCos, endSin, isLargeArc, pEx, pEy, width, height)*/
            // Point G (bottom-left quadrant, math: Q2)
            /*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, effectiveAlpha, invAlpha, clipBuffer, -by - xOffset, bx, startCos, startSin, endCos, endSin, isLargeArc, pGx, pGy, width, height)*/

            // Draw swapped points only when bx != by (they duplicate primaries on the diagonal)
            // Additional cardinal point checks: at bx == 0, swapped points may duplicate primaries
            if (bx !== by) {
                // Point B - duplicates C at right cardinal when bx == 0 && yOffset == 0
                if (bx !== 0 || yOffset !== 0) {
                    /*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, effectiveAlpha, invAlpha, clipBuffer, by, bx, startCos, startSin, endCos, endSin, isLargeArc, pBx, pBy, width, height)*/
                }
                // Point D - duplicates E at top cardinal when bx == 0 && xOffset == 0
                if (bx !== 0 || xOffset !== 0) {
                    /*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, effectiveAlpha, invAlpha, clipBuffer, bx, -by - yOffset, startCos, startSin, endCos, endSin, isLargeArc, pDx, pDy, width, height)*/
                }
                // Point F - duplicates G at left cardinal when bx == 0 && yOffset == 0
                if (bx !== 0 || yOffset !== 0) {
                    /*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, effectiveAlpha, invAlpha, clipBuffer, -by - xOffset, -bx - yOffset, startCos, startSin, endCos, endSin, isLargeArc, pFx, pFy, width, height)*/
                }
                // Point H - duplicates A at bottom cardinal when bx == 0 && xOffset == 0
                if (bx !== 0 || xOffset !== 0) {
                    /*@inline:BLEND_ALPHA_ARC_FAST_CLIPPED(data, r, g, b, effectiveAlpha, invAlpha, clipBuffer, -bx - xOffset, by, startCos, startSin, endCos, endSin, isLargeArc, pHx, pHy, width, height)*/
                }
            }

            // Update Bresenham state
            if (d < 0) {
                d = d + 4 * bx + 6;
            } else {
                d = d + 4 * (bx - by) + 10;
                by--;
            }
            bx++;
        }
    }

    /**
     * Stroke outer arc with opaque color using span-based scanline algorithm
     * Uses cross-product angle checks and SpanOps for optimal performance.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static strokeOuter_Opaq(surface, cx, cy, radius, startAngle, endAngle, lineWidth, color, clipBuffer = null) {
        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.strokeOuter_Opaq(surface, cx, cy, radius, lineWidth, color, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use floating-point center for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Handle zero/tiny radius (single pixel)
        if (radius < 1) {
            const px = Math.round(cx);
            const py = Math.round(cy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
                const pos = py * width + px;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
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

        const outerRadiusSq = outerRadius * outerRadius;
        const innerRadiusSq = innerRadius * innerRadius;

        // Precompute ray slopes for intersection calculation
        const startHasSlope = Math.abs(startSin) > 1e-10;
        const endHasSlope = Math.abs(endSin) > 1e-10;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSq) continue;

            // Outer circle intersection with this scanline
            const outerXDist = Math.sqrt(outerRadiusSq - dySquared);
            const outerLeft = cX - outerXDist;
            const outerRight = cX + outerXDist;

            // Inner circle intersection (if applicable)
            let innerLeft = outerRight + 1; // Default: no inner circle
            let innerRight = outerLeft - 1;
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                const innerXDist = Math.sqrt(innerRadiusSq - dySquared);
                innerLeft = cX - innerXDist;
                innerRight = cX + innerXDist;
            }

            // Collect events (boundary points)
            // Uses module-level scratch buffer to avoid per-scanline allocation
            let evtCount = 0;
            _arcEventBuffer[evtCount++] = outerLeft;
            _arcEventBuffer[evtCount++] = outerRight;

            // Add inner circle boundaries if they exist
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                _arcEventBuffer[evtCount++] = innerLeft;
                _arcEventBuffer[evtCount++] = innerRight;
            }

            // Add start ray intersection if it crosses this scanline
            if (startHasSlope) {
                const startX = cX + dy * startSlope;
                if (startX >= outerLeft && startX <= outerRight) {
                    _arcEventBuffer[evtCount++] = startX;
                }
            } else if (Math.abs(dy) < 1e-10) {
                // Horizontal ray (sin=0), handle center scanline
                _arcEventBuffer[evtCount++] = startCos > 0 ? outerRight : outerLeft;
            }

            // Add end ray intersection if it crosses this scanline
            if (endHasSlope) {
                const endX = cX + dy * endSlope;
                if (endX >= outerLeft && endX <= outerRight) {
                    _arcEventBuffer[evtCount++] = endX;
                }
            } else if (Math.abs(dy) < 1e-10) {
                _arcEventBuffer[evtCount++] = endCos > 0 ? outerRight : outerLeft;
            }

            // Sort events by X using insertion sort (faster than native sort for N < 10)
            ArcOps._sortEvents(_arcEventBuffer, evtCount);

            // Process each segment between events
            for (let i = 0; i < evtCount - 1; i++) {
                const segLeft = _arcEventBuffer[i];
                const segRight = _arcEventBuffer[i + 1];

                // Skip degenerate segments
                if (segRight - segLeft < 0.5) continue;

                // Test midpoint
                const midX = (segLeft + segRight) / 2;
                const dx = midX - cX;

                // Check if midpoint is within annulus (between inner and outer radii)
                const distSq = dx * dx + dySquared;
                if (distSq > outerRadiusSq || distSq < innerRadiusSq) continue;

                // Check if midpoint is within arc angle range (fast cross-product check)
                if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) {
                    continue;
                }

                // Fill this segment via SpanOps
                const xStart = Math.max(0, Math.ceil(segLeft));
                const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                const length = xEnd - xStart + 1;

                if (length > 0) {
                    SpanOps.fill_Opaq(data32, width, height, xStart, y, length, packedColor, clipBuffer);
                }
            }
        }
    }

    /**
     * Stroke outer arc with alpha blending using span-based scanline algorithm
     * Uses cross-product angle checks and SpanOps for optimal performance.
     * @param {Surface} surface - Target surface
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static strokeOuter_Alpha(
        surface,
        cx,
        cy,
        radius,
        startAngle,
        endAngle,
        lineWidth,
        color,
        globalAlpha,
        clipBuffer = null
    ) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.strokeOuter_Alpha(surface, cx, cy, radius, lineWidth, color, globalAlpha, clipBuffer);
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Use floating-point center for correct boundaries
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Handle zero/tiny radius (single pixel)
        if (radius < 1) {
            const px = Math.round(cx);
            const py = Math.round(cy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
                const pos = py * width + px;
                if (!clipBuffer || clipBuffer[pos >> 3] & (1 << (pos & 7))) {
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

        const outerRadiusSq = outerRadius * outerRadius;
        const innerRadiusSq = innerRadius * innerRadius;

        // Precompute ray slopes for intersection calculation
        const startHasSlope = Math.abs(startSin) > 1e-10;
        const endHasSlope = Math.abs(endSin) > 1e-10;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSq) continue;

            // Outer circle intersection with this scanline
            const outerXDist = Math.sqrt(outerRadiusSq - dySquared);
            const outerLeft = cX - outerXDist;
            const outerRight = cX + outerXDist;

            // Inner circle intersection (if applicable)
            let innerLeft = outerRight + 1; // Default: no inner circle
            let innerRight = outerLeft - 1;
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                const innerXDist = Math.sqrt(innerRadiusSq - dySquared);
                innerLeft = cX - innerXDist;
                innerRight = cX + innerXDist;
            }

            // Collect events (boundary points)
            // Uses module-level scratch buffer to avoid per-scanline allocation
            let evtCount = 0;
            _arcEventBuffer[evtCount++] = outerLeft;
            _arcEventBuffer[evtCount++] = outerRight;

            // Add inner circle boundaries if they exist
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                _arcEventBuffer[evtCount++] = innerLeft;
                _arcEventBuffer[evtCount++] = innerRight;
            }

            // Add start ray intersection if it crosses this scanline
            if (startHasSlope) {
                const startX = cX + dy * startSlope;
                if (startX >= outerLeft && startX <= outerRight) {
                    _arcEventBuffer[evtCount++] = startX;
                }
            } else if (Math.abs(dy) < 1e-10) {
                _arcEventBuffer[evtCount++] = startCos > 0 ? outerRight : outerLeft;
            }

            // Add end ray intersection if it crosses this scanline
            if (endHasSlope) {
                const endX = cX + dy * endSlope;
                if (endX >= outerLeft && endX <= outerRight) {
                    _arcEventBuffer[evtCount++] = endX;
                }
            } else if (Math.abs(dy) < 1e-10) {
                _arcEventBuffer[evtCount++] = endCos > 0 ? outerRight : outerLeft;
            }

            // Sort events by X using insertion sort (faster than native sort for N < 10)
            ArcOps._sortEvents(_arcEventBuffer, evtCount);

            // Process each segment between events
            for (let i = 0; i < evtCount - 1; i++) {
                const segLeft = _arcEventBuffer[i];
                const segRight = _arcEventBuffer[i + 1];

                // Skip degenerate segments
                if (segRight - segLeft < 0.5) continue;

                // Test midpoint
                const midX = (segLeft + segRight) / 2;
                const dx = midX - cX;

                // Check if midpoint is within annulus (between inner and outer radii)
                const distSq = dx * dx + dySquared;
                if (distSq > outerRadiusSq || distSq < innerRadiusSq) continue;

                // Check if midpoint is within arc angle range (fast cross-product check)
                if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) {
                    continue;
                }

                // Fill this segment via SpanOps
                const xStart = Math.max(0, Math.ceil(segLeft));
                const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                const length = xEnd - xStart + 1;

                if (length > 0) {
                    SpanOps.fill_Alpha(
                        data,
                        width,
                        height,
                        xStart,
                        y,
                        length,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            }
        }
    }

    /**
     * Fill and stroke an arc in a unified pass using span-based scanline algorithm.
     * Uses cross-product angle checks and SpanOps for optimal performance.
     * Mirrors CircleOps.fillStroke() approach to prevent speckles between fill and stroke.
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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled by SpanOps)
     */
    static fillStrokeOuter_Any(
        surface,
        cx,
        cy,
        radius,
        startAngle,
        endAngle,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer = null
    ) {
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        // Precompute arc parameters
        const params = ArcOps.getArcParams(startAngle, endAngle);

        // Fast path: full circle → delegate to CircleOps
        if (params.isFullCircle) {
            CircleOps.fillStroke_Any(
                surface,
                cx,
                cy,
                radius,
                lineWidth,
                fillColor,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
            return;
        }

        const { startCos, startSin, endCos, endSin, isLargeArc } = params;

        // Single floating-point center for both fill and stroke (CircleOps.fillStroke approach)
        const cX = cx - 0.5;
        const cY = cy - 0.5;

        // Calculate radii based on stroke width
        const innerRadius = hasStroke ? Math.max(0, radius - lineWidth / 2) : radius;
        const outerRadius = hasStroke ? radius + lineWidth / 2 : radius;
        const fillRadius = radius;

        // Calculate bounds
        const minY = Math.max(0, Math.floor(cY - outerRadius - 1));
        const maxY = Math.min(height - 1, Math.ceil(cY + outerRadius + 1));

        // Skip if completely outside canvas
        if (minY > maxY) return;

        const outerRadiusSq = outerRadius * outerRadius;
        const innerRadiusSq = innerRadius > 0 ? innerRadius * innerRadius : 0;
        const fillRadiusSq = fillRadius * fillRadius;

        // Determine rendering mode for fill
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;
        const fr = hasFill ? fillColor.r : 0,
            fg = hasFill ? fillColor.g : 0,
            fb = hasFill ? fillColor.b : 0;
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;

        // Determine rendering mode for stroke
        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;
        const sr = hasStroke ? strokeColor.r : 0,
            sg = hasStroke ? strokeColor.g : 0,
            sb = hasStroke ? strokeColor.b : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Precompute ray slopes for intersection calculation
        const startHasSlope = Math.abs(startSin) > 1e-10;
        const endHasSlope = Math.abs(endSin) > 1e-10;
        const startSlope = startHasSlope ? startCos / startSin : 0;
        const endSlope = endHasSlope ? endCos / endSin : 0;

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const dy = y - cY;
            const dySquared = dy * dy;

            // Skip if outside outer circle
            if (dySquared > outerRadiusSq) continue;

            // Outer circle intersection
            const outerXDist = Math.sqrt(outerRadiusSq - dySquared);
            const outerLeft = cX - outerXDist;
            const outerRight = cX + outerXDist;

            // Fill circle intersection
            let fillLeft = outerRight + 1,
                fillRight = outerLeft - 1;
            if (hasFill && dySquared <= fillRadiusSq) {
                const fillXDist = Math.sqrt(fillRadiusSq - dySquared);
                fillLeft = cX - fillXDist + FILL_EPSILON;
                fillRight = cX + fillXDist - FILL_EPSILON;
            }

            // Inner circle intersection (stroke inner boundary)
            let innerLeft = outerRight + 1,
                innerRight = outerLeft - 1;
            if (innerRadius > 0 && dySquared < innerRadiusSq) {
                const innerXDist = Math.sqrt(innerRadiusSq - dySquared);
                innerLeft = cX - innerXDist;
                innerRight = cX + innerXDist;
            }

            // Collect events for fill (pie shape)
            // Note: Do NOT add cX here - the center is interior, not a boundary
            // Uses module-level scratch buffer (reused for fill then stroke)
            if (hasFill && fillLeft <= fillRight) {
                let evtCount = 0;
                _arcEventBuffer[evtCount++] = fillLeft;
                _arcEventBuffer[evtCount++] = fillRight;

                // Add ray intersections within fill circle
                if (startHasSlope) {
                    const startX = cX + dy * startSlope;
                    if (startX >= fillLeft && startX <= fillRight) _arcEventBuffer[evtCount++] = startX;
                } else if (Math.abs(dy) < 1e-10) {
                    _arcEventBuffer[evtCount++] = startCos > 0 ? fillRight : fillLeft;
                }
                if (endHasSlope) {
                    const endX = cX + dy * endSlope;
                    if (endX >= fillLeft && endX <= fillRight) _arcEventBuffer[evtCount++] = endX;
                } else if (Math.abs(dy) < 1e-10) {
                    _arcEventBuffer[evtCount++] = endCos > 0 ? fillRight : fillLeft;
                }

                ArcOps._sortEvents(_arcEventBuffer, evtCount);

                // Process fill segments
                for (let i = 0; i < evtCount - 1; i++) {
                    const segLeft = _arcEventBuffer[i];
                    const segRight = _arcEventBuffer[i + 1];
                    if (segRight - segLeft < 0.5) continue;

                    const midX = (segLeft + segRight) / 2;
                    const dx = midX - cX;

                    if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) continue;

                    const xStart = Math.max(0, Math.ceil(segLeft));
                    const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                    const length = xEnd - xStart + 1;

                    if (length > 0) {
                        if (fillIsOpaque) {
                            SpanOps.fill_Opaq(data32, width, height, xStart, y, length, fillPacked, clipBuffer);
                        } else {
                            SpanOps.fill_Alpha(
                                data,
                                width,
                                height,
                                xStart,
                                y,
                                length,
                                fr,
                                fg,
                                fb,
                                fillEffectiveAlpha,
                                fillInvAlpha,
                                clipBuffer
                            );
                        }
                    }
                }
            }

            // Collect events for stroke (annulus shape)
            // Reuses same scratch buffer since fill is fully processed
            if (hasStroke) {
                let evtCount = 0;
                _arcEventBuffer[evtCount++] = outerLeft;
                _arcEventBuffer[evtCount++] = outerRight;
                if (innerRadius > 0 && dySquared < innerRadiusSq) {
                    _arcEventBuffer[evtCount++] = innerLeft;
                    _arcEventBuffer[evtCount++] = innerRight;
                }

                // Add ray intersections within stroke area
                if (startHasSlope) {
                    const startX = cX + dy * startSlope;
                    if (startX >= outerLeft && startX <= outerRight) _arcEventBuffer[evtCount++] = startX;
                } else if (Math.abs(dy) < 1e-10) {
                    _arcEventBuffer[evtCount++] = startCos > 0 ? outerRight : outerLeft;
                }
                if (endHasSlope) {
                    const endX = cX + dy * endSlope;
                    if (endX >= outerLeft && endX <= outerRight) _arcEventBuffer[evtCount++] = endX;
                } else if (Math.abs(dy) < 1e-10) {
                    _arcEventBuffer[evtCount++] = endCos > 0 ? outerRight : outerLeft;
                }

                ArcOps._sortEvents(_arcEventBuffer, evtCount);

                // Process stroke segments
                for (let i = 0; i < evtCount - 1; i++) {
                    const segLeft = _arcEventBuffer[i];
                    const segRight = _arcEventBuffer[i + 1];
                    if (segRight - segLeft < 0.5) continue;

                    const midX = (segLeft + segRight) / 2;
                    const dx = midX - cX;

                    // Check annulus bounds
                    const distSq = dx * dx + dySquared;
                    if (distSq > outerRadiusSq || distSq < innerRadiusSq) continue;

                    if (!ArcOps.isAngleInRange_Fast(dx, dy, startCos, startSin, endCos, endSin, isLargeArc)) continue;

                    const xStart = Math.max(0, Math.ceil(segLeft));
                    const xEnd = Math.min(width - 1, Math.ceil(segRight) - 1);
                    const length = xEnd - xStart + 1;

                    if (length > 0) {
                        if (strokeIsOpaque) {
                            SpanOps.fill_Opaq(data32, width, height, xStart, y, length, strokePacked, clipBuffer);
                        } else {
                            SpanOps.fill_Alpha(
                                data,
                                width,
                                height,
                                xStart,
                                y,
                                length,
                                sr,
                                sg,
                                sb,
                                strokeEffectiveAlpha,
                                strokeInvAlpha,
                                clipBuffer
                            );
                        }
                    }
                }
            }
        }
    }
}

/**
 * RoundedRectOpsAA - Static methods for optimized AXIS-ALIGNED rounded rectangle rendering
 * Follows the PolygonFiller/RectOpsAA/CircleOps/LineOps pattern.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillRoundRect(), strokeRoundRect(), fillStrokeRoundRect()
 *
 * Path-based rounded rectangles (beginPath() + roundRect() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * NOTE: Rotated rounded rectangle rendering is handled by RoundedRectOpsRot (called
 * directly by Context2D). This class only handles axis-aligned (AA) rounded rectangles.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Primitives - call SpanOps, fallback to RectOpsAA for radius=0):
 *   fill_AA_Opaq, fill_AA_Alpha          → SpanOps.fill_Opaq/fill_Alpha
 *   stroke1px_AA_Opaq                    → Direct pixel writes
 *   stroke1px_AA_Alpha                   → Inline BLEND_ALPHA marker
 *   strokeThick_AA_Opaq, strokeThick_AA_Alpha → SpanOps.fill_Opaq/fill_Alpha
 *
 * Layer 2 (Composites):
 *   fillStroke_AA_Any  → SpanOps.fill_Opaq/fill_Alpha (via renderFillSpan/renderStrokeSpan helpers)
 *
 * NAMING PATTERN: {operation}[Thickness]_{orientation}_{opacity}
 *   - Orientation: AA (axis-aligned)
 *   - Opacity: Opaq | Alpha | Any
 */
class RoundedRectOpsAA {
    // =========================================================================
    // Private Static Helpers
    // =========================================================================

    /**
     * Calculate X extent for rounded corner at a given scanline Y.
     * @param {number} py - Scanline Y coordinate
     * @param {number} rectX - Rectangle left X
     * @param {number} rectW - Rectangle width
     * @param {number} rectY - Rectangle top Y
     * @param {number} rectH - Rectangle height
     * @param {number} radius - Corner radius
     * @param {number} [epsilon=0] - Epsilon for inset calculation
     * @returns {{leftX: number, rightX: number}} X extent or {-1, -1} if outside
     * @private
     */
    static _getXExtent(py, rectX, rectW, rectY, rectH, radius, epsilon = 0) {
        if (py < rectY || py >= rectY + rectH) {
            return { leftX: -1, rightX: -1 };
        }
        if (radius <= 0) {
            return { leftX: rectX, rightX: rectX + rectW - 1 };
        }
        let leftX = rectX,
            rightX = rectX + rectW - 1;
        if (py < rectY + radius) {
            const dy = rectY + radius - py - 0.5;
            const dySquared = dy * dy,
                radiusSquared = radius * radius;
            if (dySquared < radiusSquared) {
                const dx = Math.sqrt(radiusSquared - dySquared);
                leftX = Math.ceil(rectX + radius - dx + epsilon);
                rightX = Math.floor(rectX + rectW - radius + dx - 1 - epsilon);
            } else {
                return { leftX: -1, rightX: -1 };
            }
        } else if (py >= rectY + rectH - radius) {
            const dy = py - (rectY + rectH - radius) + 0.5;
            const dySquared = dy * dy,
                radiusSquared = radius * radius;
            if (dySquared < radiusSquared) {
                const dx = Math.sqrt(radiusSquared - dySquared);
                leftX = Math.ceil(rectX + radius - dx + epsilon);
                rightX = Math.floor(rectX + rectW - radius + dx - 1 - epsilon);
            } else {
                return { leftX: -1, rightX: -1 };
            }
        }
        return { leftX, rightX };
    }

    // =========================================================================
    // Axis-Aligned Public Static Methods
    // =========================================================================

    /**
     * Direct rendering for 1px opaque stroke on axis-aligned rounded rectangle.
     * Uses direct pixel setting for corners via angle iteration and
     * horizontal/vertical line drawing for straight edges.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static stroke1px_AA_Opaq(surface, x, y, width, height, radii, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsAA.stroke1px_AA_Opaq(surface, x, y, width, height, color);
            return;
        }

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Snap the stroke onto one device-pixel frame up front, and derive BOTH the
        // edge runs and the corner centers from it. Edges and corners must share one
        // frame: deriving the corners from the raw (possibly fractional) rect instead
        // lets the pixel-centered crisp spelling (x/y at *.5 — the standard HTML5
        // 1px-stroke idiom) land its corner arcs one pixel inside the snapped edge
        // lines, doubling pixels at the junctions. For integer input every frame value
        // equals the raw arithmetic it replaces, so that rendering is unchanged.
        const leftX = Math.floor(x);
        const topY = Math.floor(y);
        const rightX = Math.floor(x + width - 0.5);
        const bottomY = Math.floor(y + height - 0.5);

        // Draw horizontal edges (top and bottom, excluding corners)

        // Top edge
        if (topY >= 0 && topY < surfaceHeight) {
            for (let xx = leftX + radius; xx < rightX + 1 - radius; xx++) {
                if (xx >= 0 && xx < surfaceWidth) {
                    const pos = topY * surfaceWidth + xx;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }
        // Bottom edge
        if (bottomY >= 0 && bottomY < surfaceHeight) {
            for (let xx = leftX + radius; xx < rightX + 1 - radius; xx++) {
                if (xx >= 0 && xx < surfaceWidth) {
                    const pos = bottomY * surfaceWidth + xx;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }

        // Draw vertical edges (left and right, excluding corners)

        // Left edge
        if (leftX >= 0 && leftX < surfaceWidth) {
            for (let yy = topY + radius; yy < bottomY + 1 - radius; yy++) {
                if (yy >= 0 && yy < surfaceHeight) {
                    const pos = yy * surfaceWidth + leftX;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }
        // Right edge
        if (rightX >= 0 && rightX < surfaceWidth) {
            for (let yy = topY + radius; yy < bottomY + 1 - radius; yy++) {
                if (yy >= 0 && yy < surfaceHeight) {
                    const pos = yy * surfaceWidth + rightX;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }

        // Draw corner arcs using angle iteration (Bresenham-style)
        // For a 1px stroke, we draw at radius - 0.5 to get proper pixel placement.
        // Each corner sweeps exactly one quadrant from startAngle, in a fixed 91-step
        // 1° iteration: a `angle <= endAngle` accumulation loop can skip the final
        // step to fp drift, and the quadrant endpoints are exactly the junction
        // pixels the edge runs above rely on. Math.cos/sin carry ~1e-16 noise at the
        // 90°-multiples (true value 0); with the integer frame-derived centers that
        // noise sits exactly on a floor() boundary and would shift the junction pixel
        // one unit — snap it to zero.
        const drawCorner = (cx, cy, startAngle) => {
            const sr = radius - 0.5;
            for (let i = 0; i <= 90; i++) {
                const angle = startAngle + i * DEG_TO_RAD;
                let c = Math.cos(angle);
                let s = Math.sin(angle);
                if (Math.abs(c) < QUADRANT_TRIG_EPSILON) c = 0;
                if (Math.abs(s) < QUADRANT_TRIG_EPSILON) s = 0;
                const px = Math.floor(cx + sr * c);
                const py = Math.floor(cy + sr * s);
                if (px >= 0 && px < surfaceWidth && py >= 0 && py < surfaceHeight) {
                    const pos = py * surfaceWidth + px;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        };

        // Top-left corner (180° to 270°)
        drawCorner(leftX + radius, topY + radius, Math.PI);
        // Top-right corner (270° to 360°)
        drawCorner(rightX + 1 - radius, topY + radius, THREE_HALF_PI);
        // Bottom-right corner (0° to 90°)
        drawCorner(rightX + 1 - radius, bottomY + 1 - radius, 0);
        // Bottom-left corner (90° to 180°)
        drawCorner(leftX + radius, bottomY + 1 - radius, HALF_PI);
    }

    /**
     * Direct rendering for 1px semi-transparent stroke on axis-aligned rounded rectangle.
     * Uses Set-based deduplication to prevent overdraw at edge-arc junctions.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static stroke1px_AA_Alpha(surface, x, y, width, height, radii, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsAA.stroke1px_AA_Alpha(surface, x, y, width, height, color, globalAlpha);
            return;
        }

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Snap the stroke onto one device-pixel frame up front, and derive the edge
        // runs AND the corner centers from it (same contract as stroke1px_AA_Opaq —
        // see the comment there). Sharing the frame matters even more here: the
        // shortened edges rely on the corners covering the junction pixels exactly,
        // so a corner center derived from a fractional raw rect does not just double
        // pixels — it leaves the junction pixels unpainted (visible gaps).
        const leftX = Math.floor(x);
        const topY = Math.floor(y);
        const rightX = Math.floor(x + width - 0.5);
        const bottomY = Math.floor(y + height - 0.5);

        // Edge shortening strategy: shorten edges by 1 pixel at each end to avoid
        // junction overlap with corners. Corners naturally cover junction pixels.
        // This eliminates the need for a Set to prevent overdraw at junctions.

        // Helper to blend a pixel directly
        const blendPixel = (px, py) => {
            if (px < 0 || px >= surfaceWidth || py < 0 || py >= surfaceHeight) return;
            const pixelIndex = py * surfaceWidth + px;
            if (clipBuffer) {
                const byteIndex = pixelIndex >> 3;
                const bitIndex = pixelIndex & 7;
                if (!(clipBuffer[byteIndex] & (1 << bitIndex))) return;
            }
            /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha)*/
        };

        // Draw horizontal edges (shortened by 1 pixel at each end to avoid junction overlap)
        const horzStart = leftX + radius + 1; // Skip left junction pixel
        const horzEnd = rightX + 1 - radius; // Stop before right junction pixel

        for (let xx = horzStart; xx < horzEnd; xx++) {
            blendPixel(xx, topY);
            blendPixel(xx, bottomY);
        }

        // Draw vertical edges (shortened by 1 pixel at each end to avoid junction overlap)
        const vertStart = topY + radius + 1; // Skip top junction pixel
        const vertEnd = bottomY + 1 - radius; // Stop before bottom junction pixel

        for (let yy = vertStart; yy < vertEnd; yy++) {
            blendPixel(leftX, yy);
            blendPixel(rightX, yy);
        }

        // Draw corner arcs with consecutive-duplicate tracking
        // Angle iteration can map multiple angles to the same pixel for small radii.
        // Since duplicates are always consecutive, tracking lastPos is sufficient.
        // Fixed 91-step quadrant sweep + quadrant-trig snap: see stroke1px_AA_Opaq —
        // here a missed quadrant endpoint is not overdraw slack but a junction GAP,
        // because the edges above deliberately stop one pixel short.
        const drawCorner = (cx, cy, startAngle) => {
            const sr = radius - 0.5;
            let lastPos = -1;
            for (let i = 0; i <= 90; i++) {
                const angle = startAngle + i * DEG_TO_RAD;
                let c = Math.cos(angle);
                let s = Math.sin(angle);
                if (Math.abs(c) < QUADRANT_TRIG_EPSILON) c = 0;
                if (Math.abs(s) < QUADRANT_TRIG_EPSILON) s = 0;
                const px = Math.floor(cx + sr * c);
                const py = Math.floor(cy + sr * s);
                if (px < 0 || px >= surfaceWidth || py < 0 || py >= surfaceHeight) continue;
                const pos = py * surfaceWidth + px;
                if (pos === lastPos) continue; // Skip consecutive duplicate
                lastPos = pos;
                if (clipBuffer) {
                    const byteIndex = pos >> 3;
                    const bitIndex = pos & 7;
                    if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                }
                /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
            }
        };

        // Top-left corner (180° to 270°)
        drawCorner(leftX + radius, topY + radius, Math.PI);
        // Top-right corner (270° to 360°)
        drawCorner(rightX + 1 - radius, topY + radius, THREE_HALF_PI);
        // Bottom-right corner (0° to 90°)
        drawCorner(rightX + 1 - radius, bottomY + 1 - radius, 0);
        // Bottom-left corner (90° to 180°)
        drawCorner(leftX + radius, bottomY + 1 - radius, HALF_PI);
    }

    /**
     * Direct rendering for opaque fill on axis-aligned rounded rectangle.
     * Uses scanline algorithm with 32-bit packed writes.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {Color} color - Fill color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static fill_AA_Opaq(surface, x, y, width, height, radii, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius
        if (radius <= 0) {
            RectOpsAA.fill_AA_Opaq(surface, x, y, width, height, color);
            return;
        }

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Calculate integer bounds
        const rectX = Math.floor(x);
        const rectY = Math.floor(y);
        const rectW = Math.floor(width);
        const rectH = Math.floor(height);

        // For each scanline
        for (let py = rectY; py < rectY + rectH; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            let leftX = rectX;
            let rightX = rectX + rectW - 1;

            // Adjust for rounded corners
            if (py < rectY + radius) {
                // Top corners - calculate x extent based on circle equation
                const cornerCenterY = rectY + radius;
                const dy = cornerCenterY - py - 0.5;
                const dySquared = dy * dy;
                const radiusSquared = radius * radius;

                if (dySquared < radiusSquared) {
                    const dx = Math.sqrt(radiusSquared - dySquared);
                    leftX = Math.ceil(rectX + radius - dx);
                    rightX = Math.floor(rectX + rectW - radius + dx - 1);
                } else {
                    continue; // Outside the rounded area
                }
            } else if (py >= rectY + rectH - radius) {
                // Bottom corners
                const cornerCenterY = rectY + rectH - radius;
                const dy = py - cornerCenterY + 0.5;
                const dySquared = dy * dy;
                const radiusSquared = radius * radius;

                if (dySquared < radiusSquared) {
                    const dx = Math.sqrt(radiusSquared - dySquared);
                    leftX = Math.ceil(rectX + radius - dx);
                    rightX = Math.floor(rectX + rectW - radius + dx - 1);
                } else {
                    continue; // Outside the rounded area
                }
            }

            // Clamp to surface bounds
            leftX = Math.max(0, leftX);
            rightX = Math.min(surfaceWidth - 1, rightX);

            if (leftX > rightX) continue;

            // Fill scanline
            const spanLength = rightX - leftX + 1;
            SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, leftX, py, spanLength, packedColor, clipBuffer);
        }
    }

    /**
     * Direct rendering for semi-transparent fill on axis-aligned rounded rectangle.
     * Uses scanline algorithm with alpha blending.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static fill_AA_Alpha(surface, x, y, width, height, radii, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius
        if (radius <= 0) {
            RectOpsAA.fill_AA_Alpha(surface, x, y, width, height, color, globalAlpha);
            return;
        }

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Calculate integer bounds
        const rectX = Math.floor(x);
        const rectY = Math.floor(y);
        const rectW = Math.floor(width);
        const rectH = Math.floor(height);

        // For each scanline
        for (let py = rectY; py < rectY + rectH; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            let leftX = rectX;
            let rightX = rectX + rectW - 1;

            // Adjust for rounded corners (same logic as fill_AA_Opaq)
            if (py < rectY + radius) {
                const cornerCenterY = rectY + radius;
                const dy = cornerCenterY - py - 0.5;
                const dySquared = dy * dy;
                const radiusSquared = radius * radius;

                if (dySquared < radiusSquared) {
                    const dx = Math.sqrt(radiusSquared - dySquared);
                    leftX = Math.ceil(rectX + radius - dx);
                    rightX = Math.floor(rectX + rectW - radius + dx - 1);
                } else {
                    continue;
                }
            } else if (py >= rectY + rectH - radius) {
                const cornerCenterY = rectY + rectH - radius;
                const dy = py - cornerCenterY + 0.5;
                const dySquared = dy * dy;
                const radiusSquared = radius * radius;

                if (dySquared < radiusSquared) {
                    const dx = Math.sqrt(radiusSquared - dySquared);
                    leftX = Math.ceil(rectX + radius - dx);
                    rightX = Math.floor(rectX + rectW - radius + dx - 1);
                } else {
                    continue;
                }
            }

            // Clamp to surface bounds
            leftX = Math.max(0, leftX);
            rightX = Math.min(surfaceWidth - 1, rightX);

            if (leftX > rightX) continue;

            // Fill scanline with alpha blending
            const spanLength = rightX - leftX + 1;
            SpanOps.fill_Alpha(
                data,
                surfaceWidth,
                surfaceHeight,
                leftX,
                py,
                spanLength,
                r,
                g,
                b,
                effectiveAlpha,
                invAlpha,
                clipBuffer
            );
        }
    }

    /**
     * Direct rendering for thick opaque stroke on axis-aligned rounded rectangle.
     * Uses scanline algorithm to fill the stroke region between inner and outer bounds.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static strokeThick_AA_Opaq(surface, x, y, width, height, radii, lineWidth, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsAA.strokeThick_AA_Opaq(surface, x, y, width, height, lineWidth, color, clipBuffer);
            return;
        }

        const halfStroke = lineWidth / 2;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Calculate outer and inner bounds
        const outerX = Math.floor(x - halfStroke);
        const outerY = Math.floor(y - halfStroke);
        const outerW = Math.ceil(width + lineWidth);
        const outerH = Math.ceil(height + lineWidth);
        const outerRadius = radius + halfStroke;

        const innerX = Math.floor(x + halfStroke);
        const innerY = Math.floor(y + halfStroke);
        const innerW = Math.floor(width - lineWidth);
        const innerH = Math.floor(height - lineWidth);
        const innerRadius = Math.max(0, radius - halfStroke);

        // For each scanline in the outer bounds
        for (let py = outerY; py < outerY + outerH; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            // Get outer extent
            const outer = RoundedRectOpsAA._getXExtent(py, outerX, outerW, outerY, outerH, outerRadius);
            if (outer.leftX < 0) continue; // Outside outer bounds

            // Clamp outer to surface
            const outerLeft = Math.max(0, outer.leftX);
            const outerRight = Math.min(surfaceWidth - 1, outer.rightX);
            if (outerLeft > outerRight) continue;

            // Check if we're in the inner region (hollow part)
            if (innerW > 0 && innerH > 0 && py >= innerY && py < innerY + innerH) {
                const inner = RoundedRectOpsAA._getXExtent(py, innerX, innerW, innerY, innerH, innerRadius);

                if (inner.leftX >= 0 && inner.rightX >= inner.leftX) {
                    // Draw left and right stroke spans around the inner region
                    const innerLeft = Math.max(0, inner.leftX);
                    const innerRight = Math.min(surfaceWidth - 1, inner.rightX);

                    // Left span: from outerLeft to just before innerLeft
                    if (outerLeft < innerLeft) {
                        const leftSpanLength = innerLeft - outerLeft;
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            outerLeft,
                            py,
                            leftSpanLength,
                            packedColor,
                            clipBuffer
                        );
                    }

                    // Right span: from just after innerRight to outerRight
                    if (innerRight < outerRight) {
                        const rightSpanStart = innerRight + 1;
                        const rightSpanLength = outerRight - innerRight;
                        SpanOps.fill_Opaq(
                            data32,
                            surfaceWidth,
                            surfaceHeight,
                            rightSpanStart,
                            py,
                            rightSpanLength,
                            packedColor,
                            clipBuffer
                        );
                    }
                } else {
                    // Inner region invalid at this Y, fill entire outer span
                    const spanLength = outerRight - outerLeft + 1;
                    SpanOps.fill_Opaq(
                        data32,
                        surfaceWidth,
                        surfaceHeight,
                        outerLeft,
                        py,
                        spanLength,
                        packedColor,
                        clipBuffer
                    );
                }
            } else {
                // Not in inner region, fill entire outer span
                const spanLength = outerRight - outerLeft + 1;
                SpanOps.fill_Opaq(
                    data32,
                    surfaceWidth,
                    surfaceHeight,
                    outerLeft,
                    py,
                    spanLength,
                    packedColor,
                    clipBuffer
                );
            }
        }
    }

    /**
     * Direct rendering for thick semi-transparent stroke on axis-aligned rounded rectangle.
     * Uses scanline algorithm with alpha blending.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static strokeThick_AA_Alpha(surface, x, y, width, height, radii, lineWidth, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to RectOps for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsAA.strokeThick_AA_Alpha(surface, x, y, width, height, lineWidth, color, globalAlpha, clipBuffer);
            return;
        }

        const halfStroke = lineWidth / 2;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Calculate outer and inner bounds
        const outerX = Math.floor(x - halfStroke);
        const outerY = Math.floor(y - halfStroke);
        const outerW = Math.ceil(width + lineWidth);
        const outerH = Math.ceil(height + lineWidth);
        const outerRadius = radius + halfStroke;

        const innerX = Math.floor(x + halfStroke);
        const innerY = Math.floor(y + halfStroke);
        const innerW = Math.floor(width - lineWidth);
        const innerH = Math.floor(height - lineWidth);
        const innerRadius = Math.max(0, radius - halfStroke);

        // For each scanline in the outer bounds
        for (let py = outerY; py < outerY + outerH; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            const outer = RoundedRectOpsAA._getXExtent(py, outerX, outerW, outerY, outerH, outerRadius);
            if (outer.leftX < 0) continue;

            const outerLeft = Math.max(0, outer.leftX);
            const outerRight = Math.min(surfaceWidth - 1, outer.rightX);
            if (outerLeft > outerRight) continue;

            if (innerW > 0 && innerH > 0 && py >= innerY && py < innerY + innerH) {
                const inner = RoundedRectOpsAA._getXExtent(py, innerX, innerW, innerY, innerH, innerRadius);

                if (inner.leftX >= 0 && inner.rightX >= inner.leftX) {
                    const innerLeft = Math.max(0, inner.leftX);
                    const innerRight = Math.min(surfaceWidth - 1, inner.rightX);

                    if (outerLeft < innerLeft) {
                        const leftSpanLength = innerLeft - outerLeft;
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            outerLeft,
                            py,
                            leftSpanLength,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }

                    if (innerRight < outerRight) {
                        const rightSpanStart = innerRight + 1;
                        const rightSpanLength = outerRight - innerRight;
                        SpanOps.fill_Alpha(
                            data,
                            surfaceWidth,
                            surfaceHeight,
                            rightSpanStart,
                            py,
                            rightSpanLength,
                            r,
                            g,
                            b,
                            effectiveAlpha,
                            invAlpha,
                            clipBuffer
                        );
                    }
                } else {
                    const spanLength = outerRight - outerLeft + 1;
                    SpanOps.fill_Alpha(
                        data,
                        surfaceWidth,
                        surfaceHeight,
                        outerLeft,
                        py,
                        spanLength,
                        r,
                        g,
                        b,
                        effectiveAlpha,
                        invAlpha,
                        clipBuffer
                    );
                }
            } else {
                const spanLength = outerRight - outerLeft + 1;
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    outerLeft,
                    py,
                    spanLength,
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

    /**
     * Unified fill and stroke rendering for rounded rectangles.
     * Draws both in a single coordinated pass to prevent fill/stroke gaps (speckles).
     * Fill is rendered first, then stroke is rendered on top.
     *
     * Fill extent strategy (per scanline):
     * - Thick semi-transparent stroke (lineWidth > 1): Fill to PATH extent so stroke
     *   can blend on top, creating proper 3-color overlap (background, fill, fill+stroke)
     * - 1px or opaque stroke: Fill to INNER extent (no meaningful overlap area for 1px;
     *   opaque stroke covers fill anyway)
     *
     * Key insight: All corner arcs (fill, outer stroke, inner stroke) must use the SAME
     * corner center point, just with different radii. This ensures pixel-perfect alignment.
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Top-left X coordinate
     * @param {number} y - Top-left Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius
     * @param {number} lineWidth - Stroke width
     * @param {Color|null} fillColor - Fill color (null to skip fill)
     * @param {Color|null} strokeColor - Stroke color (null to skip stroke)
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps or inline per-pixel)
     */
    static fillStroke_AA_Any(
        surface,
        x,
        y,
        width,
        height,
        radii,
        lineWidth,
        fillColor,
        strokeColor,
        globalAlpha,
        clipBuffer = null
    ) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        // Normalize radius
        const radius = RoundedRectUtils.normalizeRadius(radii, width, height);

        // Fallback to separate methods for zero radius
        if (radius <= 0) {
            if (hasFill) {
                if (fillColor.a === 255 && globalAlpha >= 1.0) {
                    RectOpsAA.fill_AA_Opaq(surface, x, y, width, height, fillColor);
                } else {
                    RectOpsAA.fill_AA_Alpha(surface, x, y, width, height, fillColor, globalAlpha);
                }
            }
            if (hasStroke) {
                if (strokeColor.a === 255 && globalAlpha >= 1.0) {
                    RectOpsAA.strokeThick_AA_Opaq(surface, x, y, width, height, lineWidth, strokeColor, clipBuffer);
                } else {
                    RectOpsAA.strokeThick_AA_Alpha(
                        surface,
                        x,
                        y,
                        width,
                        height,
                        lineWidth,
                        strokeColor,
                        globalAlpha,
                        clipBuffer
                    );
                }
            }
            return;
        }

        const halfStroke = lineWidth / 2;

        // Use PATH coordinates as reference for fill
        const pathX = Math.floor(x);
        const pathY = Math.floor(y);
        const pathW = Math.floor(width);
        const pathH = Math.floor(height);
        const pathRadius = radius;

        // Radii for different boundaries
        const outerRadius = pathRadius + halfStroke; // Stroke outer edge
        const innerRadius = Math.max(0, pathRadius - halfStroke); // Stroke inner edge

        // Calculate scan bounds - use original coordinates (not floored pathX/pathY)
        const scanMinY = Math.floor(y - halfStroke);
        const scanMaxY = Math.ceil(y + height + halfStroke);

        // Determine rendering modes
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;

        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Helper to render fill span via SpanOps
        const renderFillSpan = (startX, endX, py) => {
            if (startX > endX) return;
            const x0 = Math.max(0, startX);
            const x1 = Math.min(surfaceWidth - 1, endX);
            if (x0 > x1) return;
            const spanLength = x1 - x0 + 1;

            if (fillIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, py, spanLength, fillPacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    x0,
                    py,
                    spanLength,
                    fillColor.r,
                    fillColor.g,
                    fillColor.b,
                    fillEffectiveAlpha,
                    fillInvAlpha,
                    clipBuffer
                );
            }
        };

        // Helper to render stroke span via SpanOps
        const renderStrokeSpan = (startX, endX, py) => {
            if (startX > endX) return;
            const x0 = Math.max(0, startX);
            const x1 = Math.min(surfaceWidth - 1, endX);
            if (x0 > x1) return;
            const spanLength = x1 - x0 + 1;

            if (strokeIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, py, spanLength, strokePacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    x0,
                    py,
                    spanLength,
                    strokeColor.r,
                    strokeColor.g,
                    strokeColor.b,
                    strokeEffectiveAlpha,
                    strokeInvAlpha,
                    clipBuffer
                );
            }
        };

        // Calculate stroke bounds - use original coordinates (like strokeThick_AA_Opaq)
        // This avoids double-flooring which causes 1px shift when x/y have .5 fractional parts
        const outerRectX = Math.floor(x - halfStroke);
        const outerRectY = Math.floor(y - halfStroke);
        const outerRectW = Math.ceil(width + lineWidth);
        const outerRectH = Math.ceil(height + lineWidth);

        const innerRectX = Math.floor(x + halfStroke);
        const innerRectY = Math.floor(y + halfStroke);
        const innerRectW = Math.floor(width - lineWidth);
        const innerRectH = Math.floor(height - lineWidth);

        // Process each scanline in the scan bounds
        for (let py = scanMinY; py < scanMaxY; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            // Get outer stroke extent - uses calculated bounds from original coordinates
            const outerExtent = hasStroke
                ? RoundedRectOpsAA._getXExtent(py, outerRectX, outerRectW, outerRectY, outerRectH, outerRadius, 0)
                : { leftX: -1, rightX: -1 };

            // Get inner stroke extent - uses calculated bounds from original coordinates
            const innerExtent =
                hasStroke && innerRectH > 0
                    ? RoundedRectOpsAA._getXExtent(py, innerRectX, innerRectW, innerRectY, innerRectH, innerRadius, 0)
                    : { leftX: -1, rightX: -1 };

            // Determine fill extent based on stroke transparency
            let fillExtent = { leftX: -1, rightX: -1 };
            if (hasFill) {
                if (hasStroke) {
                    // Check if stroke is semi-transparent (needs overlap blending)
                    const strokeIsSemiTransparent = strokeEffectiveAlpha < 1.0;

                    if (strokeIsSemiTransparent && lineWidth > 1) {
                        // Thick semi-transparent stroke: fill to PATH extent
                        // Stroke will blend ON TOP of this fill for correct alpha overlap color
                        fillExtent = RoundedRectOpsAA._getXExtent(
                            py,
                            pathX,
                            pathW,
                            pathY,
                            pathH,
                            pathRadius,
                            FILL_EPSILON
                        );
                    } else {
                        // Opaque OR 1px semi-transparent: fill to inner extent
                        // (1px has no visible overlap area; opaque stroke covers fill anyway)
                        if (innerExtent.leftX >= 0 && innerExtent.rightX >= innerExtent.leftX) {
                            fillExtent.leftX = innerExtent.leftX;
                            fillExtent.rightX = innerExtent.rightX;
                        }
                    }
                } else {
                    // Fill-only: use standard fill extent calculation
                    fillExtent = RoundedRectOpsAA._getXExtent(py, pathX, pathW, pathY, pathH, pathRadius, FILL_EPSILON);
                }
            }

            // STEP 1: Render fill first (uses path extent or inner extent based on stroke type)
            if (hasFill && fillExtent.leftX >= 0 && fillExtent.leftX <= fillExtent.rightX) {
                renderFillSpan(fillExtent.leftX, fillExtent.rightX, py);
            }

            // STEP 2: Render stroke on top (covers any micro-gaps at boundary)
            if (hasStroke && outerExtent.leftX >= 0) {
                const outerLeft = Math.max(0, outerExtent.leftX);
                const outerRight = Math.min(surfaceWidth - 1, outerExtent.rightX);

                if (outerLeft <= outerRight) {
                    if (innerExtent.leftX >= 0 && innerExtent.rightX >= innerExtent.leftX) {
                        // Has inner region - draw left and right stroke segments
                        const innerLeft = Math.max(0, innerExtent.leftX);
                        const innerRight = Math.min(surfaceWidth - 1, innerExtent.rightX);

                        // Left stroke segment
                        if (outerLeft < innerLeft) {
                            renderStrokeSpan(outerLeft, innerLeft - 1, py);
                        }

                        // Right stroke segment
                        if (innerRight < outerRight) {
                            renderStrokeSpan(innerRight + 1, outerRight, py);
                        }
                    } else {
                        // No inner region - fill entire stroke span
                        renderStrokeSpan(outerLeft, outerRight, py);
                    }
                }
            }
        }
    }
}

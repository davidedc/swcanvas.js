/**
 * RectOpsAA - Static methods for optimized AXIS-ALIGNED rectangle rendering
 * Follows PolygonFiller pattern with static methods.
 *
 * Direct rendering is available exclusively via dedicated Context2D methods:
 * fillRect(), strokeRect()
 *
 * Path-based rectangles (beginPath() + rect() + fill()/stroke()) use the
 * generic polygon pipeline for consistent, predictable behavior.
 *
 * NOTE: Rotated rectangle rendering is handled by RectOpsRot (called directly
 * by Context2D). This class only handles axis-aligned (AA) rectangles.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha
 *
 * Layer 1 (Primitives - do atomic rendering):
 *   fill_AA_Opaq, fill_AA_Alpha
 *   stroke1px_AA_Opaq, stroke1px_AA_Alpha
 *   strokeThick_AA_Opaq, strokeThick_AA_Alpha
 *
 * Layer 2 (Composites - call SpanOps):
 *   fillStroke_AA_Any    → SpanOps (inline)
 *
 * NAMING PATTERN: {operation}[Thickness]_{orientation}_{opacity}
 *   - AA = Axis-Aligned
 *   - Opaq = Opaque only, Alpha = Semi-transparent, Any = Handles both
 */
class RectOpsAA {
    /**
     * Optimized 1px opaque rectangle stroke using direct pixel drawing
     * Matches Canvas grid-line to pixel-coordinate conversion
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_AA_Opaq(surface, x, y, width, height, color, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Tier-0 rect clip: clamp each edge's write extent + row/column guard to the
        // clip rect (already within surface bounds), skip the per-pixel bit test.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        // Calculate rectangle pixel bounds
        // For strokeRect(132.5, 126.5, 135, 47):
        // - Path spans (132.5, 126.5) to (267.5, 173.5)
        // - 1px stroke renders at: left=132, right=267, top=126, bottom=173
        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.floor(x + width);
        const bottom = Math.floor(y + height);

        // Draw top edge (horizontal): pixels from left to right (inclusive)
        if (top >= cy0 && top < cy1) {
            for (let px = Math.max(cx0, left); px <= Math.min(right, cx1 - 1); px++) {
                const pos = top * surfaceWidth + px;
                /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
            }
        }

        // Draw bottom edge (horizontal): pixels from left to right (inclusive)
        if (bottom >= cy0 && bottom < cy1) {
            for (let px = Math.max(cx0, left); px <= Math.min(right, cx1 - 1); px++) {
                const pos = bottom * surfaceWidth + px;
                /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
            }
        }

        // Draw left edge (vertical): skip corners (already drawn)
        if (left >= cx0 && left < cx1) {
            for (let py = Math.max(cy0, top + 1); py < Math.min(bottom, cy1); py++) {
                const pos = py * surfaceWidth + left;
                /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
            }
        }

        // Draw right edge (vertical): skip corners (already drawn)
        if (right >= cx0 && right < cx1) {
            for (let py = Math.max(cy0, top + 1); py < Math.min(bottom, cy1); py++) {
                const pos = py * surfaceWidth + right;
                /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
            }
        }
    }

    /**
     * Optimized 1px semi-transparent rectangle stroke using direct pixel drawing
     * Matches Canvas grid-line to pixel-coordinate conversion
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static stroke1px_AA_Alpha(surface, x, y, width, height, color, globalAlpha, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Tier-0 rect clip: clamp each edge's write extent + row/column guard.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        // Calculate rectangle pixel bounds
        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.floor(x + width);
        const bottom = Math.floor(y + height);

        // Draw top edge (horizontal): pixels from left to right (inclusive)
        if (top >= cy0 && top < cy1) {
            for (let px = Math.max(cx0, left); px <= Math.min(right, cx1 - 1); px++) {
                const pos = top * surfaceWidth + px;
                /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
            }
        }

        // Draw bottom edge (horizontal): pixels from left to right (inclusive)
        if (bottom >= cy0 && bottom < cy1) {
            for (let px = Math.max(cx0, left); px <= Math.min(right, cx1 - 1); px++) {
                const pos = bottom * surfaceWidth + px;
                /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
            }
        }

        // Draw left edge (vertical): skip corners (already drawn)
        if (left >= cx0 && left < cx1) {
            for (let py = Math.max(cy0, top + 1); py < Math.min(bottom, cy1); py++) {
                const pos = py * surfaceWidth + left;
                /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
            }
        }

        // Draw right edge (vertical): skip corners (already drawn)
        if (right >= cx0 && right < cx1) {
            for (let py = Math.max(cy0, top + 1); py < Math.min(bottom, cy1); py++) {
                const pos = py * surfaceWidth + right;
                /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
            }
        }
    }

    /**
     * Optimized thick stroke rectangle using direct pixel drawing
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static strokeThick_AA_Opaq(surface, x, y, width, height, lineWidth, color, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Tier-0 rect clip: clamp per-pixel guards to the clip rect, skip the bit test.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        const halfStroke = lineWidth / 2;

        // Calculate stroke geometry (edge centers)
        // Keep as floats - don't floor early for sub-pixel accuracy
        // and only floors when calculating actual pixel positions
        const left = x;
        const top = y;
        const right = x + width;
        const bottom = y + height;

        // Draw horizontal strokes (top and bottom edges with full thickness)
        for (let px = Math.floor(left - halfStroke); px < right + halfStroke; px++) {
            if (px < cx0 || px >= cx1) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Top edge
                const pyTop = Math.floor(top + t);
                if (pyTop >= cy0 && pyTop < cy1) {
                    const pos = pyTop * surfaceWidth + px;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
                // Bottom edge
                const pyBottom = Math.floor(bottom + t);
                if (pyBottom >= cy0 && pyBottom < cy1) {
                    const pos = pyBottom * surfaceWidth + px;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }

        // Draw vertical strokes (left and right edges, excluding corners already drawn)
        for (let py = Math.floor(top + halfStroke); py < bottom - halfStroke; py++) {
            if (py < cy0 || py >= cy1) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Left edge
                const pxLeft = Math.floor(left + t);
                if (pxLeft >= cx0 && pxLeft < cx1) {
                    const pos = py * surfaceWidth + pxLeft;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
                // Right edge
                const pxRight = Math.floor(right + t);
                if (pxRight >= cx0 && pxRight < cx1) {
                    const pos = py * surfaceWidth + pxRight;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }
    }

    /**
     * Optimized thick stroke rectangle with alpha blending
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: checked inline per-pixel)
     */
    static strokeThick_AA_Alpha(surface, x, y, width, height, lineWidth, color, globalAlpha, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Tier-0 rect clip: clamp per-pixel guards to the clip rect, skip the bit test.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        const halfStroke = lineWidth / 2;

        // Calculate stroke geometry (edge centers)
        // Keep as floats - don't floor early for sub-pixel accuracy
        // and only floors when calculating actual pixel positions
        const left = x;
        const top = y;
        const right = x + width;
        const bottom = y + height;

        // Draw horizontal strokes (top and bottom edges with full thickness)
        for (let px = Math.floor(left - halfStroke); px < right + halfStroke; px++) {
            if (px < cx0 || px >= cx1) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Top edge
                const pyTop = Math.floor(top + t);
                if (pyTop >= cy0 && pyTop < cy1) {
                    const pos = pyTop * surfaceWidth + px;
                    /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
                }
                // Bottom edge
                const pyBottom = Math.floor(bottom + t);
                if (pyBottom >= cy0 && pyBottom < cy1) {
                    const pos = pyBottom * surfaceWidth + px;
                    /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
                }
            }
        }

        // Calculate exact Y bounds to prevent corner overlap with non-integer geometry
        // The t loop iterates ceil(lineWidth) times, so the last t value is:
        const numTIterations = Math.ceil(lineWidth);
        const lastT = -halfStroke + numTIterations - 1;
        const topStrokeMaxY = Math.floor(top + lastT);
        const bottomStrokeMinY = Math.floor(bottom - halfStroke);

        // Draw vertical strokes (left and right edges, excluding corners)
        // Use px-based iteration to match horizontal stroke X coverage
        for (let py = topStrokeMaxY + 1; py < bottomStrokeMinY; py++) {
            if (py < cy0 || py >= cy1) continue;
            // Left edge
            for (let px = Math.floor(left - halfStroke); px < left + halfStroke; px++) {
                if (px >= cx0 && px < cx1) {
                    const pos = py * surfaceWidth + px;
                    /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
                }
            }
            // Right edge
            for (let px = Math.floor(right - halfStroke); px < right + halfStroke; px++) {
                if (px >= cx0 && px < cx1) {
                    const pos = py * surfaceWidth + px;
                    /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
                }
            }
        }
    }

    /**
     * Check if rotation angle is near axis-aligned (0°, 90°, 180°, 270°)
     * @param {number} angle - Rotation angle in radians
     * @returns {boolean} True if near axis-aligned
     */
    static isNearAxisAligned(angle) {
        const tolerance = ANGLE_TOLERANCE;
        const normalized = ((angle % TAU) + TAU) % TAU;
        return (
            Math.abs(normalized) < tolerance ||
            Math.abs(normalized - HALF_PI) < tolerance ||
            Math.abs(normalized - Math.PI) < tolerance ||
            Math.abs(normalized - THREE_HALF_PI) < tolerance ||
            Math.abs(normalized - TAU) < tolerance
        );
    }

    /**
     * Get adjusted dimensions for 90°/270° rotations (swap width/height)
     * @param {number} width - Original width
     * @param {number} height - Original height
     * @param {number} angle - Rotation angle in radians
     * @returns {{adjustedWidth: number, adjustedHeight: number}} Adjusted dimensions
     */
    static getRotatedDimensions(width, height, angle) {
        const tolerance = ANGLE_TOLERANCE;
        const normalized = ((angle % TAU) + TAU) % TAU;
        if (Math.abs(normalized - HALF_PI) < tolerance || Math.abs(normalized - THREE_HALF_PI) < tolerance) {
            return { adjustedWidth: height, adjustedHeight: width };
        }
        return { adjustedWidth: width, adjustedHeight: height };
    }

    /**
     * Optimized opaque rectangle fill using direct 32-bit pixel writes
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Color} color - Fill color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fill_AA_Opaq(surface, x, y, width, height, color, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Tier-0 rect clip: clamp the write extent to the clip rect (already within
        // surface bounds) and skip the per-pixel bit test — the rect exposes exactly
        // the mask's set pixels, so this is byte-identical. clipBuffer is null then.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.ceil(x + width);
        const bottom = Math.ceil(y + height);

        // Column span is invariant across rows -> hoist it.
        const rowLeft = Math.max(cx0, left);
        const rowRight = Math.min(right, cx1);
        const yStart = Math.max(cy0, top);
        const yEnd = Math.min(bottom, cy1);

        if (clipBuffer) {
            for (let py = yStart; py < yEnd; py++) {
                const base = py * surfaceWidth;
                for (let px = rowLeft; px < rowRight; px++) {
                    const pixelIndex = base + px;
                    const byteIndex = pixelIndex >> 3;
                    const bitIndex = pixelIndex & 7;
                    if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                    data32[pixelIndex] = packedColor;
                }
            }
        } else {
            // No clip mask: each row is a contiguous run of one packed color, so a native
            // TypedArray.fill beats the per-pixel loop (O1, docs/runtime-performance-optimization-plan.md
            // §5B). Byte-identical: same value, same [rowStart, rowStart+len) indices. Empty rows
            // (rowRight <= rowLeft) make fill a no-op.
            for (let py = yStart; py < yEnd; py++) {
                const rowStart = py * surfaceWidth + rowLeft;
                data32.fill(packedColor, rowStart, py * surfaceWidth + rowRight);
            }
        }
    }

    /**
     * Optimized alpha-blended rectangle fill
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fill_AA_Alpha(surface, x, y, width, height, color, globalAlpha, clipBuffer = null, clipRect = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r,
            g = color.g,
            b = color.b;

        // Tier-0 rect clip: clamp the write extent to the clip rect, skip the bit test.
        const cx0 = clipRect ? clipRect.x0 : 0;
        const cy0 = clipRect ? clipRect.y0 : 0;
        const cx1 = clipRect ? clipRect.x1 : surfaceWidth;
        const cy1 = clipRect ? clipRect.y1 : surfaceHeight;

        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.ceil(x + width);
        const bottom = Math.ceil(y + height);

        for (let py = Math.max(cy0, top); py < Math.min(bottom, cy1); py++) {
            for (let px = Math.max(cx0, left); px < Math.min(right, cx1); px++) {
                const pixelIndex = py * surfaceWidth + px;

                if (clipBuffer) {
                    const byteIndex = pixelIndex >> 3;
                    const bitIndex = pixelIndex & 7;
                    if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                }

                /*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, effectiveAlpha, invAlpha)*/
            }
        }
    }

    /**
     * Combined fill and stroke for rectangles - single-scan span-based rendering.
     * Uses fill-first ordering for correct semi-transparent stroke blending.
     *
     * For semi-transparent strokes: fill renders to PATH extent first, then stroke
     * renders on top and blends correctly with the fill underneath.
     *
     * For opaque strokes: fill renders to INNER extent (stroke covers overlap anyway).
     *
     * @param {Surface} surface - Target surface
     * @param {number} x - Rectangle X coordinate
     * @param {number} y - Rectangle Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} lineWidth - Stroke width in pixels
     * @param {Color} fillColor - Fill color (may be null)
     * @param {Color} strokeColor - Stroke color (may be null)
     * @param {number} globalAlpha - Context global alpha (0-1)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps)
     */
    static fillStroke_AA_Any(
        surface,
        x,
        y,
        width,
        height,
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

        const halfStroke = hasStroke ? lineWidth / 2 : 0;

        // Determine rendering modes
        const fillIsOpaque = hasFill && fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = hasFill ? (fillColor.a / 255) * globalAlpha : 0;
        const fillInvAlpha = 1 - fillEffectiveAlpha;

        const strokeIsOpaque = hasStroke && strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = hasStroke ? (strokeColor.a / 255) * globalAlpha : 0;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Key check: is stroke semi-transparent? (needs fill-first blending)
        const strokeIsSemiTransparent = hasStroke && !strokeIsOpaque;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // 1px stroke fast path: no overlap between fill and stroke
        // For lineWidth <= 1, strokeInner bounds don't overlap with stroke pixel positions
        const use1pxFastPath = hasStroke && hasFill && lineWidth <= 1;

        // Pre-compute composite color for overlap regions (stroke over fill)
        // Uses Porter-Duff source-over: stroke OVER fill
        // This eliminates overdraw by rendering overlap regions once with pre-composited color
        // Only use composite optimization for thick semi-transparent strokes
        // 1px strokes use the fast path above (no overlap, no composite needed)
        let compositeR = 0,
            compositeG = 0,
            compositeB = 0;
        let compositeAlpha = 0,
            compositeInvAlpha = 1;
        const useCompositeOptimization = strokeIsSemiTransparent && hasFill && !use1pxFastPath;

        if (useCompositeOptimization) {
            // Porter-Duff: outA = srcA + dstA * (1 - srcA)
            compositeAlpha = strokeEffectiveAlpha + fillEffectiveAlpha * (1 - strokeEffectiveAlpha);

            if (compositeAlpha > 0) {
                compositeInvAlpha = 1 - compositeAlpha;

                // Non-premultiplied RGB composite
                const fillContrib = (fillEffectiveAlpha * (1 - strokeEffectiveAlpha)) / compositeAlpha;
                const strokeContrib = strokeEffectiveAlpha / compositeAlpha;

                compositeR = Math.round(strokeColor.r * strokeContrib + fillColor.r * fillContrib);
                compositeG = Math.round(strokeColor.g * strokeContrib + fillColor.g * fillContrib);
                compositeB = Math.round(strokeColor.b * strokeContrib + fillColor.b * fillContrib);
            }
        }

        // Calculate bounds
        // Path bounds (fill boundary)
        const pathLeft = Math.floor(x);
        const pathTop = Math.floor(y);
        const pathRight = Math.ceil(x + width);
        const pathBottom = Math.ceil(y + height);

        // Stroke outer bounds (scan region when stroke present)
        const strokeOuterLeft = hasStroke ? Math.floor(x - halfStroke) : pathLeft;
        const strokeOuterTop = hasStroke ? Math.floor(y - halfStroke) : pathTop;
        const strokeOuterRight = hasStroke ? Math.ceil(x + width + halfStroke) : pathRight;
        const strokeOuterBottom = hasStroke ? Math.ceil(y + height + halfStroke) : pathBottom;

        // Stroke inner bounds (interior where no stroke is drawn)
        const strokeInnerLeft = hasStroke ? Math.ceil(x + halfStroke) : pathLeft;
        const strokeInnerTop = hasStroke ? Math.ceil(y + halfStroke) : pathTop;
        const strokeInnerRight = hasStroke ? Math.floor(x + width - halfStroke) : pathRight;
        const strokeInnerBottom = hasStroke ? Math.floor(y + height - halfStroke) : pathBottom;

        // Span rendering helpers
        const renderFillSpan = (left, right, py) => {
            const spanLeft = Math.max(0, left);
            const spanRight = Math.min(surfaceWidth, right);
            const length = spanRight - spanLeft;
            if (length <= 0) return;

            if (fillIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, spanLeft, py, length, fillPacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    spanLeft,
                    py,
                    length,
                    fillColor.r,
                    fillColor.g,
                    fillColor.b,
                    fillEffectiveAlpha,
                    fillInvAlpha,
                    clipBuffer
                );
            }
        };

        const renderStrokeSpan = (left, right, py) => {
            const spanLeft = Math.max(0, left);
            const spanRight = Math.min(surfaceWidth, right);
            const length = spanRight - spanLeft;
            if (length <= 0) return;

            if (strokeIsOpaque) {
                SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, spanLeft, py, length, strokePacked, clipBuffer);
            } else {
                SpanOps.fill_Alpha(
                    data,
                    surfaceWidth,
                    surfaceHeight,
                    spanLeft,
                    py,
                    length,
                    strokeColor.r,
                    strokeColor.g,
                    strokeColor.b,
                    strokeEffectiveAlpha,
                    strokeInvAlpha,
                    clipBuffer
                );
            }
        };

        // Composite span helper for pre-composited fill+stroke overlap regions
        const renderCompositeSpan = (left, right, py) => {
            const spanLeft = Math.max(0, left);
            const spanRight = Math.min(surfaceWidth, right);
            const length = spanRight - spanLeft;
            if (length <= 0) return;

            SpanOps.fill_Alpha(
                data,
                surfaceWidth,
                surfaceHeight,
                spanLeft,
                py,
                length,
                compositeR,
                compositeG,
                compositeB,
                compositeAlpha,
                compositeInvAlpha,
                clipBuffer
            );
        };

        // ============================================================
        // 1px STROKE FAST PATH
        // ============================================================
        // For 1px strokes, geometry ensures no overlap between fill inner extent and stroke pixels:
        // - Fill inner: [ceil(x + 0.5), floor(x + width - 0.5)]
        // - Stroke: floor(x) and floor(x + width)
        // This allows us to skip composite calculation and 5-segment overhead.
        if (use1pxFastPath) {
            // Calculate 1px stroke bounds (matches stroke1px_AA_* logic)
            const strokeLeft = Math.floor(x);
            const strokeTop = Math.floor(y);
            const strokeRight = Math.floor(x + width);
            const strokeBottom = Math.floor(y + height);

            // Fill inner rectangle (row-by-row with SpanOps)
            for (let py = Math.max(0, strokeInnerTop); py < Math.min(surfaceHeight, strokeInnerBottom); py++) {
                if (strokeInnerLeft < strokeInnerRight) {
                    renderFillSpan(strokeInnerLeft, strokeInnerRight, py);
                }
            }

            // Stroke using 4-edge direct pixel loops (reuses stroke1px_AA_* pattern)
            const r = strokeColor.r,
                g = strokeColor.g,
                b = strokeColor.b;

            if (strokeIsOpaque) {
                // Top edge (horizontal)
                if (strokeTop >= 0 && strokeTop < surfaceHeight) {
                    for (let px = Math.max(0, strokeLeft); px <= Math.min(strokeRight, surfaceWidth - 1); px++) {
                        const pos = strokeTop * surfaceWidth + px;
                        /*@inline:SET_OPAQUE_CLIPPED(data32, pos, strokePacked, clipBuffer)*/
                    }
                }

                // Bottom edge (horizontal)
                if (strokeBottom >= 0 && strokeBottom < surfaceHeight) {
                    for (let px = Math.max(0, strokeLeft); px <= Math.min(strokeRight, surfaceWidth - 1); px++) {
                        const pos = strokeBottom * surfaceWidth + px;
                        /*@inline:SET_OPAQUE_CLIPPED(data32, pos, strokePacked, clipBuffer)*/
                    }
                }

                // Left edge (vertical, skip corners)
                if (strokeLeft >= 0 && strokeLeft < surfaceWidth) {
                    for (let py = Math.max(0, strokeTop + 1); py < Math.min(strokeBottom, surfaceHeight); py++) {
                        const pos = py * surfaceWidth + strokeLeft;
                        /*@inline:SET_OPAQUE_CLIPPED(data32, pos, strokePacked, clipBuffer)*/
                    }
                }

                // Right edge (vertical, skip corners)
                if (strokeRight >= 0 && strokeRight < surfaceWidth) {
                    for (let py = Math.max(0, strokeTop + 1); py < Math.min(strokeBottom, surfaceHeight); py++) {
                        const pos = py * surfaceWidth + strokeRight;
                        /*@inline:SET_OPAQUE_CLIPPED(data32, pos, strokePacked, clipBuffer)*/
                    }
                }
            } else {
                // Semi-transparent 1px stroke
                // Top edge (horizontal)
                if (strokeTop >= 0 && strokeTop < surfaceHeight) {
                    for (let px = Math.max(0, strokeLeft); px <= Math.min(strokeRight, surfaceWidth - 1); px++) {
                        const pixelIndex = strokeTop * surfaceWidth + px;
                        /*@inline:BLEND_ALPHA_CLIPPED(data, pixelIndex, r, g, b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer)*/
                    }
                }

                // Bottom edge (horizontal)
                if (strokeBottom >= 0 && strokeBottom < surfaceHeight) {
                    for (let px = Math.max(0, strokeLeft); px <= Math.min(strokeRight, surfaceWidth - 1); px++) {
                        const pixelIndex = strokeBottom * surfaceWidth + px;
                        /*@inline:BLEND_ALPHA_CLIPPED(data, pixelIndex, r, g, b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer)*/
                    }
                }

                // Left edge (vertical, skip corners)
                if (strokeLeft >= 0 && strokeLeft < surfaceWidth) {
                    for (let py = Math.max(0, strokeTop + 1); py < Math.min(strokeBottom, surfaceHeight); py++) {
                        const pixelIndex = py * surfaceWidth + strokeLeft;
                        /*@inline:BLEND_ALPHA_CLIPPED(data, pixelIndex, r, g, b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer)*/
                    }
                }

                // Right edge (vertical, skip corners)
                if (strokeRight >= 0 && strokeRight < surfaceWidth) {
                    for (let py = Math.max(0, strokeTop + 1); py < Math.min(strokeBottom, surfaceHeight); py++) {
                        const pixelIndex = py * surfaceWidth + strokeRight;
                        /*@inline:BLEND_ALPHA_CLIPPED(data, pixelIndex, r, g, b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer)*/
                    }
                }
            }

            return; // Exit early - 1px fast path complete
        }

        // ============================================================
        // THICK STROKE PATH (5-segment or simple)
        // ============================================================
        // Single-pass scanline rendering
        for (let py = strokeOuterTop; py < strokeOuterBottom; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            const inVerticalStrokeZone = hasStroke && (py < strokeInnerTop || py >= strokeInnerBottom);

            if (inVerticalStrokeZone) {
                // Top/bottom stroke zones
                if (useCompositeOptimization && py >= pathTop && py < pathBottom) {
                    // Stroke zone overlaps fill: render 3 segments (no overdraw)
                    // Segment 1: stroke-only left of fill
                    if (strokeOuterLeft < pathLeft) {
                        renderStrokeSpan(strokeOuterLeft, pathLeft, py);
                    }
                    // Segment 2: composite where stroke overlaps fill
                    renderCompositeSpan(pathLeft, pathRight, py);
                    // Segment 3: stroke-only right of fill
                    if (pathRight < strokeOuterRight) {
                        renderStrokeSpan(pathRight, strokeOuterRight, py);
                    }
                } else if (hasStroke) {
                    // Pure stroke (no fill overlap) - full span
                    renderStrokeSpan(strokeOuterLeft, strokeOuterRight, py);
                }
            } else if (py >= pathTop && py < pathBottom) {
                // Interior rows

                if (useCompositeOptimization && hasStroke) {
                    // 5-segment rendering: zero overdraw
                    // Segment 1: stroke-only left
                    if (strokeOuterLeft < pathLeft) {
                        renderStrokeSpan(strokeOuterLeft, pathLeft, py);
                    }
                    // Segment 2: composite left (fill+stroke overlap)
                    if (pathLeft < strokeInnerLeft) {
                        renderCompositeSpan(pathLeft, strokeInnerLeft, py);
                    }
                    // Segment 3: fill-only center
                    if (hasFill && strokeInnerLeft < strokeInnerRight) {
                        renderFillSpan(strokeInnerLeft, strokeInnerRight, py);
                    }
                    // Segment 4: composite right (fill+stroke overlap)
                    if (strokeInnerRight < pathRight) {
                        renderCompositeSpan(strokeInnerRight, pathRight, py);
                    }
                    // Segment 5: stroke-only right
                    if (pathRight < strokeOuterRight) {
                        renderStrokeSpan(pathRight, strokeOuterRight, py);
                    }
                } else {
                    // Opaque stroke or fill-only: existing optimized path
                    if (hasFill) {
                        const fillLeft = hasStroke ? strokeInnerLeft : pathLeft;
                        const fillRight = hasStroke ? strokeInnerRight : pathRight;
                        if (fillLeft < fillRight) {
                            renderFillSpan(fillLeft, fillRight, py);
                        }
                    }
                    if (hasStroke) {
                        if (strokeOuterLeft < strokeInnerLeft) {
                            renderStrokeSpan(strokeOuterLeft, strokeInnerLeft, py);
                        }
                        if (strokeInnerRight < strokeOuterRight) {
                            renderStrokeSpan(strokeInnerRight, strokeOuterRight, py);
                        }
                    }
                }
            }
        }
    }
}

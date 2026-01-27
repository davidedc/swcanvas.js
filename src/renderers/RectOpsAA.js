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
    static stroke1px_AA_Opaq(surface, x, y, width, height, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Calculate rectangle pixel bounds
        // For strokeRect(132.5, 126.5, 135, 47):
        // - Path spans (132.5, 126.5) to (267.5, 173.5)
        // - 1px stroke renders at: left=132, right=267, top=126, bottom=173
        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.floor(x + width);
        const bottom = Math.floor(y + height);

        // Draw top edge (horizontal): pixels from left to right (inclusive)
        if (top >= 0 && top < surfaceHeight) {
            for (let px = Math.max(0, left); px <= Math.min(right, surfaceWidth - 1); px++) {
                const pos = top * surfaceWidth + px;
                /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
            }
        }

        // Draw bottom edge (horizontal): pixels from left to right (inclusive)
        if (bottom >= 0 && bottom < surfaceHeight) {
            for (let px = Math.max(0, left); px <= Math.min(right, surfaceWidth - 1); px++) {
                const pos = bottom * surfaceWidth + px;
                /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
            }
        }

        // Draw left edge (vertical): skip corners (already drawn)
        if (left >= 0 && left < surfaceWidth) {
            for (let py = Math.max(0, top + 1); py < Math.min(bottom, surfaceHeight); py++) {
                const pos = py * surfaceWidth + left;
                /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
            }
        }

        // Draw right edge (vertical): skip corners (already drawn)
        if (right >= 0 && right < surfaceWidth) {
            for (let py = Math.max(0, top + 1); py < Math.min(bottom, surfaceHeight); py++) {
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
    static stroke1px_AA_Alpha(surface, x, y, width, height, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        // Calculate rectangle pixel bounds
        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.floor(x + width);
        const bottom = Math.floor(y + height);

        // Draw top edge (horizontal): pixels from left to right (inclusive)
        if (top >= 0 && top < surfaceHeight) {
            for (let px = Math.max(0, left); px <= Math.min(right, surfaceWidth - 1); px++) {
                const pos = top * surfaceWidth + px;
                /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
            }
        }

        // Draw bottom edge (horizontal): pixels from left to right (inclusive)
        if (bottom >= 0 && bottom < surfaceHeight) {
            for (let px = Math.max(0, left); px <= Math.min(right, surfaceWidth - 1); px++) {
                const pos = bottom * surfaceWidth + px;
                /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
            }
        }

        // Draw left edge (vertical): skip corners (already drawn)
        if (left >= 0 && left < surfaceWidth) {
            for (let py = Math.max(0, top + 1); py < Math.min(bottom, surfaceHeight); py++) {
                const pos = py * surfaceWidth + left;
                /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
            }
        }

        // Draw right edge (vertical): skip corners (already drawn)
        if (right >= 0 && right < surfaceWidth) {
            for (let py = Math.max(0, top + 1); py < Math.min(bottom, surfaceHeight); py++) {
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
    static strokeThick_AA_Opaq(surface, x, y, width, height, lineWidth, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

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
            if (px < 0 || px >= surfaceWidth) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Top edge
                const pyTop = Math.floor(top + t);
                if (pyTop >= 0 && pyTop < surfaceHeight) {
                    const pos = pyTop * surfaceWidth + px;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
                // Bottom edge
                const pyBottom = Math.floor(bottom + t);
                if (pyBottom >= 0 && pyBottom < surfaceHeight) {
                    const pos = pyBottom * surfaceWidth + px;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
            }
        }

        // Draw vertical strokes (left and right edges, excluding corners already drawn)
        for (let py = Math.floor(top + halfStroke); py < bottom - halfStroke; py++) {
            if (py < 0 || py >= surfaceHeight) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Left edge
                const pxLeft = Math.floor(left + t);
                if (pxLeft >= 0 && pxLeft < surfaceWidth) {
                    const pos = py * surfaceWidth + pxLeft;
                    /*@inline:SET_OPAQUE_CLIPPED(data32, pos, packedColor, clipBuffer)*/
                }
                // Right edge
                const pxRight = Math.floor(right + t);
                if (pxRight >= 0 && pxRight < surfaceWidth) {
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
    static strokeThick_AA_Alpha(surface, x, y, width, height, lineWidth, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

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
            if (px < 0 || px >= surfaceWidth) continue;
            for (let t = -halfStroke; t < halfStroke; t++) {
                // Top edge
                const pyTop = Math.floor(top + t);
                if (pyTop >= 0 && pyTop < surfaceHeight) {
                    const pos = pyTop * surfaceWidth + px;
                    /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
                }
                // Bottom edge
                const pyBottom = Math.floor(bottom + t);
                if (pyBottom >= 0 && pyBottom < surfaceHeight) {
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
            if (py < 0 || py >= surfaceHeight) continue;
            // Left edge
            for (let px = Math.floor(left - halfStroke); px < left + halfStroke; px++) {
                if (px >= 0 && px < surfaceWidth) {
                    const pos = py * surfaceWidth + px;
                    /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, effectiveAlpha, invAlpha, clipBuffer)*/
                }
            }
            // Right edge
            for (let px = Math.floor(right - halfStroke); px < right + halfStroke; px++) {
                if (px >= 0 && px < surfaceWidth) {
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
        if (Math.abs(normalized - HALF_PI) < tolerance ||
            Math.abs(normalized - THREE_HALF_PI) < tolerance) {
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
    static fill_AA_Opaq(surface, x, y, width, height, color, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.ceil(x + width);
        const bottom = Math.ceil(y + height);

        for (let py = Math.max(0, top); py < Math.min(bottom, surfaceHeight); py++) {
            for (let px = Math.max(0, left); px < Math.min(right, surfaceWidth); px++) {
                const pixelIndex = py * surfaceWidth + px;

                if (clipBuffer) {
                    const byteIndex = pixelIndex >> 3;
                    const bitIndex = pixelIndex & 7;
                    if (!(clipBuffer[byteIndex] & (1 << bitIndex))) continue;
                }

                data32[pixelIndex] = packedColor;
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
    static fill_AA_Alpha(surface, x, y, width, height, color, globalAlpha, clipBuffer = null) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.ceil(x + width);
        const bottom = Math.ceil(y + height);

        for (let py = Math.max(0, top); py < Math.min(bottom, surfaceHeight); py++) {
            for (let px = Math.max(0, left); px < Math.min(right, surfaceWidth); px++) {
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
    static fillStroke_AA_Any(surface, x, y, width, height, lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer = null) {
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
                SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, spanLeft, py, length,
                    fillColor.r, fillColor.g, fillColor.b, fillEffectiveAlpha, fillInvAlpha, clipBuffer);
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
                SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, spanLeft, py, length,
                    strokeColor.r, strokeColor.g, strokeColor.b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer);
            }
        };

        // Single-pass scanline rendering
        for (let py = strokeOuterTop; py < strokeOuterBottom; py++) {
            if (py < 0 || py >= surfaceHeight) continue;

            const inVerticalStrokeZone = hasStroke && (py < strokeInnerTop || py >= strokeInnerBottom);

            // STEP 1: Render fill span FIRST
            // For semi-transparent stroke: fill to PATH extent (stroke will blend on top)
            // For opaque stroke: fill to INNER extent (stroke covers overlap, no point filling there)
            // For no stroke: fill to PATH extent
            // For semi-transparent strokes, also render fill in vertical stroke zones
            // so the top/bottom stroke can blend with the fill underneath
            const shouldRenderFill = hasFill && py >= pathTop && py < pathBottom &&
                (!inVerticalStrokeZone || strokeIsSemiTransparent);

            if (shouldRenderFill) {
                let fillLeft, fillRight;

                if (!hasStroke) {
                    // No stroke: fill entire path width
                    fillLeft = pathLeft;
                    fillRight = pathRight;
                } else if (strokeIsSemiTransparent) {
                    // Semi-transparent stroke: fill to PATH extent
                    // Stroke will blend with this fill for correct alpha blending
                    fillLeft = pathLeft;
                    fillRight = pathRight;
                } else {
                    // Opaque stroke: fill to INNER extent (stroke covers overlap anyway)
                    fillLeft = strokeInnerLeft;
                    fillRight = strokeInnerRight;
                }

                if (fillLeft < fillRight) {
                    renderFillSpan(fillLeft, fillRight, py);
                }
            }

            // STEP 2: Render stroke spans ON TOP
            if (hasStroke) {
                if (inVerticalStrokeZone) {
                    // Full horizontal stroke span (top or bottom edge)
                    renderStrokeSpan(strokeOuterLeft, strokeOuterRight, py);
                } else {
                    // Left and right stroke segments only
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

/**
 * RoundedRectOpsRot - Static methods for rotated rounded rectangle rendering
 * Provides rotated rendering separately from axis-aligned logic in RoundedRectOpsAA.
 *
 * This class is loaded BEFORE RoundedRectOpsAA and provides all rotated rounded rectangle
 * rendering implementations. Called directly by Context2D for rotated cases.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha
 *
 * Layer 1 (Helpers - used by rotated implementations):
 *   _normalizeRadius, _transform, _generateEdgePixels, _generateArcPixels, _generatePerimeter
 *
 * Layer 2 (Implementations - internal):
 *   _fill_Rot_Opaq, _fill_Rot_Alpha
 *   _stroke1px_Rot_Opaq, _stroke1px_Rot_Alpha
 *   _strokeThick_Rot_Opaq, _strokeThick_Rot_Alpha
 *
 * Layer 3 (Dispatchers):
 *   fill_Rot_Any       → _fill_Rot_Opaq / _fill_Rot_Alpha
 *   stroke_Rot_Any     → _stroke1px_Rot_* / _strokeThick_Rot_* + LineOps.stroke_Any
 *   fillStroke_Rot_Any → fill_Rot_Any + stroke_Rot_Any
 *
 * External dependencies:
 *   - RectOpsRot.fill_Rot_Any (fallback when radius=0)
 *   - RectOpsRot.stroke_Rot_Any (fallback when radius=0)
 *   - LineOps.stroke_Any (for straight edge strokes)
 *   - ArcOps.stroke1px_Opaq_Exact (for corner arc strokes)
 *   - SpanOps.fill_Opaq, SpanOps.fill_Alpha (for thick stroke fills)
 */
class RoundedRectOpsRot {
    // =========================================================================
    // Private Static Helpers
    // =========================================================================

    /**
     * Normalize radius for rounded rectangle, clamping to valid range.
     * @param {number|number[]} radii - Corner radius
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @returns {number} Normalized radius
     */
    static _normalizeRadius(radii, width, height) {
        let radius = Array.isArray(radii) ? radii[0] : (radii || 0);
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        return Math.round(Math.min(radius, Math.min(width, height) / 2));
    }

    /**
     * Transform local coordinates to screen coordinates using rotation matrix.
     * @param {number} localX - Local X coordinate
     * @param {number} localY - Local Y coordinate
     * @param {number} centerX - Center X in screen coordinates
     * @param {number} centerY - Center Y in screen coordinates
     * @param {number} cos - Cosine of rotation angle
     * @param {number} sin - Sine of rotation angle
     * @returns {{x: number, y: number}} Screen coordinates
     * @private
     */
    static _transform(localX, localY, centerX, centerY, cos, sin) {
        return {
            x: centerX + localX * cos - localY * sin,
            y: centerY + localX * sin + localY * cos
        };
    }

    /**
     * Generate edge pixels using Bresenham's line algorithm.
     * @param {number} x0 - Start X coordinate
     * @param {number} y0 - Start Y coordinate
     * @param {number} x1 - End X coordinate
     * @param {number} y1 - End Y coordinate
     * @param {function(number, number): void} recorder - Pixel recording callback
     * @private
     */
    static _generateEdgePixels(x0, y0, x1, y1, recorder) {
        const ix0 = Math.floor(x0), iy0 = Math.floor(y0);
        const ix1 = Math.floor(x1), iy1 = Math.floor(y1);
        const dx = Math.abs(ix1 - ix0), dy = Math.abs(iy1 - iy0);
        const sx = ix0 < ix1 ? 1 : -1, sy = iy0 < iy1 ? 1 : -1;
        let err = dx - dy, x = ix0, y = iy0;
        while (true) {
            recorder(x, y);
            if (x === ix1 && y === iy1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
    }

    /**
     * Generate arc pixels using angle-based iteration.
     * @param {number} cx - Center X coordinate
     * @param {number} cy - Center Y coordinate
     * @param {number} r - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {function(number, number): void} recorder - Pixel recording callback
     * @private
     */
    static _generateArcPixels(cx, cy, r, startAngle, endAngle, recorder) {
        if (r <= 0) return;
        const arcLength = r * Math.abs(endAngle - startAngle);
        const steps = Math.max(Math.ceil(arcLength), 8);
        const angleStep = (endAngle - startAngle) / steps;
        let lastPx = null, lastPy = null;
        for (let i = 0; i <= steps; i++) {
            const angle = startAngle + i * angleStep;
            const px = Math.floor(cx + r * Math.cos(angle));
            const py = Math.floor(cy + r * Math.sin(angle));
            if (px !== lastPx || py !== lastPy) {
                recorder(px, py);
                lastPx = px;
                lastPy = py;
            }
        }
    }

    /**
     * Generate perimeter pixels for a rounded rectangle.
     * @param {number} hw - Half-width
     * @param {number} hh - Half-height
     * @param {number} r - Corner radius
     * @param {function(number, number): void} recorder - Pixel recording callback
     * @param {number} centerX - Center X in screen coordinates
     * @param {number} centerY - Center Y in screen coordinates
     * @param {number} cos - Cosine of rotation angle
     * @param {number} sin - Sine of rotation angle
     * @param {number} rotation - Rotation angle in radians
     * @private
     */
    static _generatePerimeter(hw, hh, r, recorder, centerX, centerY, cos, sin, rotation) {
        const edges = [
            { start: { x: -hw + r, y: -hh }, end: { x: hw - r, y: -hh } },
            { start: { x: hw, y: -hh + r }, end: { x: hw, y: hh - r } },
            { start: { x: hw - r, y: hh }, end: { x: -hw + r, y: hh } },
            { start: { x: -hw, y: hh - r }, end: { x: -hw, y: -hh + r } }
        ];
        for (const edge of edges) {
            const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
            const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);
            const dx = end.x - start.x, dy = end.y - start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;
            RoundedRectOpsRot._generateEdgePixels(start.x, start.y, end.x, end.y, recorder);
        }
        const corners = [
            { cx: -hw + r, cy: -hh + r, startAngle: Math.PI, endAngle: THREE_HALF_PI },
            { cx: hw - r, cy: -hh + r, startAngle: THREE_HALF_PI, endAngle: TAU },
            { cx: hw - r, cy: hh - r, startAngle: 0, endAngle: HALF_PI },
            { cx: -hw + r, cy: hh - r, startAngle: HALF_PI, endAngle: Math.PI }
        ];
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            RoundedRectOpsRot._generateArcPixels(
                screenCenter.x, screenCenter.y, r,
                corner.startAngle + rotation, corner.endAngle + rotation, recorder
            );
        }
    }

    // =========================================================================
    // Fill Methods
    // =========================================================================

    /**
     * Direct rendering for filled rotated rounded rectangle.
     * Uses Edge Buffer Rasterization: generates perimeter into minX/maxX arrays,
     * then fills scanlines efficiently with data32.fill().
     *
     * Algorithm complexity: O(H + P + A) where H=height, P=perimeter, A=fill area.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static fill_Rot_Any(surface, centerX, centerY, width, height, radii, rotation, color, globalAlpha, clipBuffer = null) {
        // Normalize radius
        const radius = RoundedRectOpsRot._normalizeRadius(radii, width, height);

        // Fallback to RectOpsRot.fill_Rot_Any for zero radius
        if (radius <= 0) {
            RectOpsRot.fill_Rot_Any(surface, centerX, centerY, width, height, rotation, color, globalAlpha, clipBuffer);
            return;
        }

        const isOpaqueColor = color.a === 255 && globalAlpha >= 1.0;

        if (isOpaqueColor) {
            RoundedRectOpsRot._fill_Rot_Opaq(surface, centerX, centerY, width, height, radius, rotation, color, clipBuffer);
        } else if (color.a > 0) {
            RoundedRectOpsRot._fill_Rot_Alpha(surface, centerX, centerY, width, height, radius, rotation, color, globalAlpha, clipBuffer);
        }
    }

    /**
     * Internal: Opaque fill for rotated rounded rectangle using Edge Buffer Rasterization.
     *
     * Algorithm:
     * 1. Compute Y bounds from rotation angle (O(1))
     * 2. Allocate minX/maxX Int16Arrays sized to shape height
     * 3. Generate perimeter (edges + corner arcs), recording min/max X per row
     * 4. Fill scanlines using data32.fill() for each row
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Fill color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static _fill_Rot_Opaq(surface, centerX, centerY, width, height, radius, rotation, color, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Compute AABB height (exact formula for rotated rectangle)
        const boundingHeight = Math.abs(width * sin) + Math.abs(height * cos);

        // Clamp to canvas bounds BEFORE array allocation
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Allocate span arrays (Int16Array for memory efficiency)
        const minX = new Int16Array(spanCount);
        const maxX = new Int16Array(spanCount);
        minX.fill(surfaceWidth);  // Sentinel: larger than any valid x
        maxX.fill(-1);            // Sentinel: smaller than any valid x

        // Record perimeter pixel into span arrays
        const recordPixel = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < minX[row]) minX[row] = x;
            if (x > maxX[row]) maxX[row] = x;
        };

        // Edge endpoints in local space (centered at origin)
        const edges = [
            { start: { x: -hw + radius, y: -hh }, end: { x: hw - radius, y: -hh } },      // Top
            { start: { x: hw, y: -hh + radius }, end: { x: hw, y: hh - radius } },        // Right
            { start: { x: hw - radius, y: hh }, end: { x: -hw + radius, y: hh } },        // Bottom
            { start: { x: -hw, y: hh - radius }, end: { x: -hw, y: -hh + radius } }       // Left
        ];

        // Generate edge perimeter pixels
        for (const edge of edges) {
            const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
            const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);

            // Skip zero-length edges (radius = half width or height)
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;

            RoundedRectOpsRot._generateEdgePixels(start.x, start.y, end.x, end.y, recordPixel);
        }

        // Corner definitions (local center and angle range)
        const corners = [
            { cx: -hw + radius, cy: -hh + radius, startAngle: Math.PI, endAngle: THREE_HALF_PI },         // Top-left
            { cx: hw - radius, cy: -hh + radius, startAngle: THREE_HALF_PI, endAngle: TAU },      // Top-right
            { cx: hw - radius, cy: hh - radius, startAngle: 0, endAngle: HALF_PI },                 // Bottom-right
            { cx: -hw + radius, cy: hh - radius, startAngle: HALF_PI, endAngle: Math.PI }           // Bottom-left
        ];

        // Generate corner arc perimeter pixels
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            RoundedRectOpsRot._generateArcPixels(
                screenCenter.x, screenCenter.y,
                radius,
                corner.startAngle + rotation,
                corner.endAngle + rotation,
                recordPixel
            );
        }

        // Fill scanlines
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        if (!clipBuffer) {
            // Fast path: no clipping
            for (let row = 0; row < spanCount; row++) {
                const left = minX[row];
                const right = maxX[row];
                if (left > right) continue;

                const y = yMin + row;
                const x0 = Math.max(0, left);
                const x1 = Math.min(surfaceWidth - 1, right);

                if (x0 <= x1) {
                    const offset = y * surfaceWidth;
                    data32.fill(packedColor, offset + x0, offset + x1 + 1);
                }
            }
        } else {
            // Slower path: per-pixel clipping
            for (let row = 0; row < spanCount; row++) {
                const left = minX[row];
                const right = maxX[row];
                if (left > right) continue;

                const y = yMin + row;
                const x0 = Math.max(0, left);
                const x1 = Math.min(surfaceWidth - 1, right);

                for (let x = x0; x <= x1; x++) {
                    const pos = y * surfaceWidth + x;
                    if (clipBuffer[pos >> 3] & (1 << (pos & 7))) {
                        data32[pos] = packedColor;
                    }
                }
            }
        }
    }

    /**
     * Internal: Alpha fill for rotated rounded rectangle using Edge Buffer Rasterization.
     *
     * Same algorithm as _fill_Rot_Opaq but with alpha blending in the fill phase.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Fill color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static _fill_Rot_Alpha(surface, centerX, centerY, width, height, radius, rotation, color, globalAlpha, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;
        const hh = height / 2;

        // Compute AABB height
        const boundingHeight = Math.abs(width * sin) + Math.abs(height * cos);

        // Clamp to canvas bounds
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Allocate span arrays
        const minX = new Int16Array(spanCount);
        const maxX = new Int16Array(spanCount);
        minX.fill(surfaceWidth);
        maxX.fill(-1);

        const recordPixel = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < minX[row]) minX[row] = x;
            if (x > maxX[row]) maxX[row] = x;
        };

        // Edge endpoints
        const edges = [
            { start: { x: -hw + radius, y: -hh }, end: { x: hw - radius, y: -hh } },
            { start: { x: hw, y: -hh + radius }, end: { x: hw, y: hh - radius } },
            { start: { x: hw - radius, y: hh }, end: { x: -hw + radius, y: hh } },
            { start: { x: -hw, y: hh - radius }, end: { x: -hw, y: -hh + radius } }
        ];

        for (const edge of edges) {
            const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
            const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;
            RoundedRectOpsRot._generateEdgePixels(start.x, start.y, end.x, end.y, recordPixel);
        }

        // Corner definitions
        const corners = [
            { cx: -hw + radius, cy: -hh + radius, startAngle: Math.PI, endAngle: THREE_HALF_PI },
            { cx: hw - radius, cy: -hh + radius, startAngle: THREE_HALF_PI, endAngle: TAU },
            { cx: hw - radius, cy: hh - radius, startAngle: 0, endAngle: HALF_PI },
            { cx: -hw + radius, cy: hh - radius, startAngle: HALF_PI, endAngle: Math.PI }
        ];

        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            RoundedRectOpsRot._generateArcPixels(
                screenCenter.x, screenCenter.y,
                radius,
                corner.startAngle + rotation,
                corner.endAngle + rotation,
                recordPixel
            );
        }

        // Fill with alpha blending
        const r = color.r;
        const g = color.g;
        const b = color.b;
        const incomingAlpha = (color.a / 255) * globalAlpha;
        const inverseIncomingAlpha = 1 - incomingAlpha;

        for (let row = 0; row < spanCount; row++) {
            const left = minX[row];
            const right = maxX[row];
            if (left > right) continue;

            const y = yMin + row;
            const x0 = Math.max(0, left);
            const x1 = Math.min(surfaceWidth - 1, right);

            for (let x = x0; x <= x1; x++) {
                const pos = y * surfaceWidth + x;

                if (clipBuffer && !(clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                    continue;
                }

                const idx = pos * 4;
                const oldAlpha = data[idx + 3] / 255;
                const oldAlphaScaled = oldAlpha * inverseIncomingAlpha;
                const newAlpha = incomingAlpha + oldAlphaScaled;

                if (newAlpha > 0) {
                    const blendFactor = 1 / newAlpha;
                    data[idx] = (r * incomingAlpha + data[idx] * oldAlphaScaled) * blendFactor;
                    data[idx + 1] = (g * incomingAlpha + data[idx + 1] * oldAlphaScaled) * blendFactor;
                    data[idx + 2] = (b * incomingAlpha + data[idx + 2] * oldAlphaScaled) * blendFactor;
                    data[idx + 3] = newAlpha * 255;
                }
            }
        }
    }

    // =========================================================================
    // Stroke Methods
    // =========================================================================

    /**
     * Direct rendering for stroked rotated rounded rectangle.
     * Dispatches to appropriate sub-method based on lineWidth and opacity.
     *
     * Uses center-based coordinates (like RectOps.stroke_Rot_Any) since rotation
     * naturally occurs around the center point.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static stroke_Rot_Any(surface, centerX, centerY, width, height, radii, rotation, lineWidth, color, globalAlpha, clipBuffer = null) {
        // Normalize radius
        let radius = RoundedRectOpsRot._normalizeRadius(radii, width, height);

        // Fallback to RectOpsRot.stroke_Rot_Any for zero radius (rounded rect becomes regular rect)
        if (radius <= 0) {
            RectOpsRot.stroke_Rot_Any(surface, centerX, centerY, width, height, rotation, lineWidth, color, globalAlpha, clipBuffer);
            return;
        }

        const isOpaqueColor = color.a === 255 && globalAlpha >= 1.0;
        const isSemiTransparentColor = !isOpaqueColor && color.a > 0;

        // Handle 1px strokes
        if (lineWidth <= 1) {
            if (isOpaqueColor) {
                RoundedRectOpsRot._stroke1px_Rot_Opaq(surface, centerX, centerY, width, height, radius, rotation, color, clipBuffer);
            } else if (isSemiTransparentColor) {
                RoundedRectOpsRot._stroke1px_Rot_Alpha(surface, centerX, centerY, width, height, radius, rotation, color, globalAlpha, clipBuffer);
            }
            return;
        }

        // Handle thick strokes
        if (isSemiTransparentColor) {
            RoundedRectOpsRot._strokeThick_Rot_Alpha(surface, centerX, centerY, width, height, radius, rotation, lineWidth, color, globalAlpha, clipBuffer);
        } else if (isOpaqueColor) {
            RoundedRectOpsRot._strokeThick_Rot_Opaq(surface, centerX, centerY, width, height, radius, rotation, lineWidth, color, clipBuffer);
        }
    }

    /**
     * Internal: 1px opaque stroke for rotated rounded rectangle.
     * Uses hybrid approach: 4 straight edges via LineOps + 4 corner arcs via ArcOps.
     *
     * Since the stroke is opaque, overdraw at edge-arc junctions doesn't affect the result.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static _stroke1px_Rot_Opaq(surface, centerX, centerY, width, height, radius, rotation, color, clipBuffer) {
        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;   // half-width
        const hh = height / 2;  // half-height

        // Calculate 8 edge endpoints in local space, then transform to screen space
        // Local coordinates (centered at origin):
        // - Top edge: (-hw+radius, -hh) to (hw-radius, -hh)
        // - Right edge: (hw, -hh+radius) to (hw, hh-radius)
        // - Bottom edge: (hw-radius, hh) to (-hw+radius, hh)
        // - Left edge: (-hw, hh-radius) to (-hw, -hh+radius)

        const edgeEndpoints = [
            // Top edge
            { start: RoundedRectOpsRot._transform(-hw + radius, -hh, centerX, centerY, cos, sin), end: RoundedRectOpsRot._transform(hw - radius, -hh, centerX, centerY, cos, sin) },
            // Right edge
            { start: RoundedRectOpsRot._transform(hw, -hh + radius, centerX, centerY, cos, sin), end: RoundedRectOpsRot._transform(hw, hh - radius, centerX, centerY, cos, sin) },
            // Bottom edge
            { start: RoundedRectOpsRot._transform(hw - radius, hh, centerX, centerY, cos, sin), end: RoundedRectOpsRot._transform(-hw + radius, hh, centerX, centerY, cos, sin) },
            // Left edge
            { start: RoundedRectOpsRot._transform(-hw, hh - radius, centerX, centerY, cos, sin), end: RoundedRectOpsRot._transform(-hw, -hh + radius, centerX, centerY, cos, sin) }
        ];

        // Draw 4 straight edges via LineOps.stroke_Any
        for (const edge of edgeEndpoints) {
            // Skip zero-length edges (occurs when radius = half width or half height)
            // This prevents extra pixels at arc junction points
            const dx = edge.end.x - edge.start.x;
            const dy = edge.end.y - edge.start.y;
            const edgeLength = Math.sqrt(dx * dx + dy * dy);
            if (edgeLength < MIN_EDGE_LENGTH) continue;

            LineOps.stroke_Any(
                surface,
                edge.start.x, edge.start.y,
                edge.end.x, edge.end.y,
                1,              // lineWidth
                color,
                1.0,            // globalAlpha (already opaque)
                clipBuffer,
                true,           // isOpaqueColor
                false           // isSemiTransparentColor
            );
        }

        // Calculate 4 corner arc centers in local space, then transform to screen space
        // Local corner centers and their angle ranges:
        // - Top-left: (-hw+radius, -hh+radius), angles: π to 3π/2
        // - Top-right: (hw-radius, -hh+radius), angles: 3π/2 to 2π
        // - Bottom-right: (hw-radius, hh-radius), angles: 0 to π/2
        // - Bottom-left: (-hw+radius, hh-radius), angles: π/2 to π

        const corners = [
            { localCx: -hw + radius, localCy: -hh + radius, startAngle: Math.PI, endAngle: THREE_HALF_PI },         // Top-left
            { localCx: hw - radius, localCy: -hh + radius, startAngle: THREE_HALF_PI, endAngle: TAU },      // Top-right
            { localCx: hw - radius, localCy: hh - radius, startAngle: 0, endAngle: HALF_PI },                 // Bottom-right
            { localCx: -hw + radius, localCy: hh - radius, startAngle: HALF_PI, endAngle: Math.PI }           // Bottom-left
        ];

        // Draw 4 corner arcs
        // Arc angles shift by rotation when the shape is rotated
        // Always use angle-based iteration for rotated rounded rects to ensure junction alignment with the sides (or other corner if the side ends up being zero-length).
        // Bresenham has angular coverage gaps at any radius, which cause discontinuities.
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.localCx, corner.localCy, centerX, centerY, cos, sin);
            // Angle-based iteration with exact endpoints (guaranteed junction alignment)
            ArcOps.stroke1px_Opaq_Exact(
                surface,
                screenCenter.x, screenCenter.y,
                radius,
                corner.startAngle + rotation,
                corner.endAngle + rotation,
                color,
                clipBuffer
            );
        }
    }

    /**
     * Internal: 1px semi-transparent stroke for rotated rounded rectangle.
     * Uses hybrid approach: 4 straight edges + 4 corner arcs with Set deduplication
     * to prevent overdraw at edge-arc junctions (which would cause incorrect alpha blending).
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static _stroke1px_Rot_Alpha(surface, centerX, centerY, width, height, radius, rotation, color, globalAlpha, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha for blending
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = width / 2;   // half-width
        const hh = height / 2;  // half-height

        // Use Set to collect unique pixel positions (prevents overdraw at junctions)
        const strokePixels = new Set();

        // Calculate 8 edge endpoints in local space, then transform to screen space
        const edgeEndpoints = [
            // Top edge
            { start: RoundedRectOpsRot._transform(-hw + radius, -hh, centerX, centerY, cos, sin), end: RoundedRectOpsRot._transform(hw - radius, -hh, centerX, centerY, cos, sin) },
            // Right edge
            { start: RoundedRectOpsRot._transform(hw, -hh + radius, centerX, centerY, cos, sin), end: RoundedRectOpsRot._transform(hw, hh - radius, centerX, centerY, cos, sin) },
            // Bottom edge
            { start: RoundedRectOpsRot._transform(hw - radius, hh, centerX, centerY, cos, sin), end: RoundedRectOpsRot._transform(-hw + radius, hh, centerX, centerY, cos, sin) },
            // Left edge
            { start: RoundedRectOpsRot._transform(-hw, hh - radius, centerX, centerY, cos, sin), end: RoundedRectOpsRot._transform(-hw, -hh + radius, centerX, centerY, cos, sin) }
        ];

        // Collect edge pixels via Bresenham (inline to collect into Set)
        for (const edge of edgeEndpoints) {
            // Skip zero-length edges
            const dx = edge.end.x - edge.start.x;
            const dy = edge.end.y - edge.start.y;
            const edgeLength = Math.sqrt(dx * dx + dy * dy);
            if (edgeLength < MIN_EDGE_LENGTH) continue;

            const x1i = Math.floor(edge.start.x);
            const y1i = Math.floor(edge.start.y);
            const x2i = Math.floor(edge.end.x);
            const y2i = Math.floor(edge.end.y);

            // NOTE: No line shortening here! Unlike standalone lines, rounded rectangle
            // edges must draw their full length to meet corner arcs at junction points.
            // The Set handles any overdraw for correct alpha blending.

            const dxAbs = Math.abs(x2i - x1i);
            let dyAbs = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dxAbs - dyAbs;

            let x = x1i;
            let y = y1i;

            while (true) {
                if (x >= 0 && x < surfaceWidth && y >= 0 && y < surfaceHeight) {
                    strokePixels.add(y * surfaceWidth + x);
                }

                if (x === x2i && y === y2i) break;

                const e2 = 2 * err;
                if (e2 > -dyAbs) {
                    err -= dyAbs;
                    x += sx;
                }
                if (e2 < dxAbs) {
                    err += dxAbs;
                    y += sy;
                }
            }
        }

        // Calculate 4 corner arc centers and angles
        const corners = [
            { localCx: -hw + radius, localCy: -hh + radius, startAngle: Math.PI, endAngle: THREE_HALF_PI },         // Top-left
            { localCx: hw - radius, localCy: -hh + radius, startAngle: THREE_HALF_PI, endAngle: TAU },      // Top-right
            { localCx: hw - radius, localCy: hh - radius, startAngle: 0, endAngle: HALF_PI },                 // Bottom-right
            { localCx: -hw + radius, localCy: hh - radius, startAngle: HALF_PI, endAngle: Math.PI }           // Bottom-left
        ];

        // Collect corner arc pixels using angle-based iteration (same as stroke1px_AA_OpaqExactEndpoints)
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.localCx, corner.localCy, centerX, centerY, cos, sin);
            const cx = screenCenter.x;
            const cy = screenCenter.y;
            const startAngle = corner.startAngle + rotation;
            const endAngle = corner.endAngle + rotation;

            // Angle-based iteration for arc pixels
            const arcLength = radius * Math.abs(endAngle - startAngle);
            const numSteps = Math.max(Math.ceil(arcLength * 2), 8);
            const angleStep = (endAngle - startAngle) / numSteps;

            // Incremental rotation (avoid Math.cos/sin in loop)
            const cosStep = Math.cos(angleStep);
            const sinStep = Math.sin(angleStep);

            // Start position relative to center
            let ax = radius * Math.cos(startAngle);
            let ay = radius * Math.sin(startAngle);

            for (let i = 0; i <= numSteps; i++) {
                // Force exact precision for the final point
                if (i === numSteps) {
                    ax = radius * Math.cos(endAngle);
                    ay = radius * Math.sin(endAngle);
                }

                const px = Math.floor(cx + ax);
                const py = Math.floor(cy + ay);

                if (px >= 0 && px < surfaceWidth && py >= 0 && py < surfaceHeight) {
                    strokePixels.add(py * surfaceWidth + px);
                }

                // Apply rotation for next iteration
                const nextX = ax * cosStep - ay * sinStep;
                ay = ax * sinStep + ay * cosStep;
                ax = nextX;
            }
        }

        // Render all collected unique pixels with alpha blending
        for (const pos of strokePixels) {
            if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                const idx = pos * 4;
                const oldAlpha = data[idx + 3] / 255;
                const oldAlphaScaled = oldAlpha * invAlpha;
                const newAlpha = effectiveAlpha + oldAlphaScaled;
                if (newAlpha > 0) {
                    const blendFactor = 1 / newAlpha;
                    data[idx] = (r * effectiveAlpha + data[idx] * oldAlphaScaled) * blendFactor;
                    data[idx + 1] = (g * effectiveAlpha + data[idx + 1] * oldAlphaScaled) * blendFactor;
                    data[idx + 2] = (b * effectiveAlpha + data[idx + 2] * oldAlphaScaled) * blendFactor;
                    data[idx + 3] = newAlpha * 255;
                }
            }
        }
    }

    /**
     * Internal: Thick opaque stroke for rotated rounded rectangle.
     * Uses Dual Edge Buffer algorithm: generates outer and inner perimeters,
     * then fills the annulus between them per scanline.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static _strokeThick_Rot_Opaq(surface, centerX, centerY, width, height, radius, rotation, lineWidth, color, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        const halfStroke = lineWidth / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        // Outer dimensions (path expanded by halfStroke)
        const outerWidth = width + lineWidth;
        const outerHeight = height + lineWidth;
        const outerRadius = Math.min(radius + halfStroke, Math.min(outerWidth, outerHeight) / 2);
        const outerHW = outerWidth / 2;
        const outerHH = outerHeight / 2;

        // Inner dimensions (path contracted by halfStroke)
        const innerWidth = width - lineWidth;
        const innerHeight = height - lineWidth;
        const innerRadius = Math.max(0, radius - halfStroke);
        const innerHW = innerWidth / 2;
        const innerHH = innerHeight / 2;
        const hasInnerRect = innerWidth > 0 && innerHeight > 0;

        // Compute AABB height based on outer bounds
        const boundingHeight = Math.abs(outerWidth * sin) + Math.abs(outerHeight * cos);

        // Clamp to canvas bounds
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Allocate span arrays for outer perimeter
        const outerMinX = new Int16Array(spanCount);
        const outerMaxX = new Int16Array(spanCount);
        outerMinX.fill(surfaceWidth);
        outerMaxX.fill(-1);

        // Allocate span arrays for inner perimeter (if inner rect exists)
        const innerMinX = hasInnerRect ? new Int16Array(spanCount) : null;
        const innerMaxX = hasInnerRect ? new Int16Array(spanCount) : null;
        if (hasInnerRect) {
            innerMinX.fill(surfaceWidth);
            innerMaxX.fill(-1);
        }

        // Helper to record pixel to outer perimeter
        const recordOuter = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < outerMinX[row]) outerMinX[row] = x;
            if (x > outerMaxX[row]) outerMaxX[row] = x;
        };

        // Helper to record pixel to inner perimeter
        const recordInner = hasInnerRect ? (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < innerMinX[row]) innerMinX[row] = x;
            if (x > innerMaxX[row]) innerMaxX[row] = x;
        } : null;

        // Generate outer perimeter
        RoundedRectOpsRot._generatePerimeter(outerHW, outerHH, outerRadius, recordOuter, centerX, centerY, cos, sin, rotation);

        // Generate inner perimeter (if inner rect exists)
        if (hasInnerRect) {
            RoundedRectOpsRot._generatePerimeter(innerHW, innerHH, innerRadius, recordInner, centerX, centerY, cos, sin, rotation);
        }

        // Fill annulus per scanline
        for (let row = 0; row < spanCount; row++) {
            const outerLeft = outerMinX[row];
            const outerRight = outerMaxX[row];
            if (outerLeft > outerRight) continue;

            const y = yMin + row;

            if (hasInnerRect) {
                const innerLeft = innerMinX[row];
                const innerRight = innerMaxX[row];

                if (innerLeft <= innerRight) {
                    // Has inner hole: fill left span [outerLeft, innerLeft-1] and right span [innerRight+1, outerRight]
                    // Left span
                    const leftStart = Math.max(0, outerLeft);
                    const leftEnd = Math.min(surfaceWidth - 1, innerLeft - 1);
                    if (leftStart <= leftEnd) {
                        SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, leftStart, y, leftEnd - leftStart + 1, packedColor, clipBuffer);
                    }

                    // Right span
                    const rightStart = Math.max(0, innerRight + 1);
                    const rightEnd = Math.min(surfaceWidth - 1, outerRight);
                    if (rightStart <= rightEnd) {
                        SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, rightStart, y, rightEnd - rightStart + 1, packedColor, clipBuffer);
                    }
                } else {
                    // No inner hole on this row: fill entire outer span
                    const x0 = Math.max(0, outerLeft);
                    const x1 = Math.min(surfaceWidth - 1, outerRight);
                    if (x0 <= x1) {
                        SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, y, x1 - x0 + 1, packedColor, clipBuffer);
                    }
                }
            } else {
                // No inner rect: fill entire outer span (solid fill)
                const x0 = Math.max(0, outerLeft);
                const x1 = Math.min(surfaceWidth - 1, outerRight);
                if (x0 <= x1) {
                    SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, y, x1 - x0 + 1, packedColor, clipBuffer);
                }
            }
        }
    }

    /**
     * Internal: Thick semi-transparent stroke for rotated rounded rectangle.
     * Uses same Dual Edge Buffer algorithm as opaque, but with alpha blending.
     * The algorithm is inherently overdraw-free (each pixel visited exactly once).
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} color - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static _strokeThick_Rot_Alpha(surface, centerX, centerY, width, height, radius, rotation, lineWidth, color, globalAlpha, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;

        // Calculate effective alpha for blending
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        const halfStroke = lineWidth / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        // Outer dimensions (path expanded by halfStroke)
        const outerWidth = width + lineWidth;
        const outerHeight = height + lineWidth;
        const outerRadius = Math.min(radius + halfStroke, Math.min(outerWidth, outerHeight) / 2);
        const outerHW = outerWidth / 2;
        const outerHH = outerHeight / 2;

        // Inner dimensions (path contracted by halfStroke)
        const innerWidth = width - lineWidth;
        const innerHeight = height - lineWidth;
        const innerRadius = Math.max(0, radius - halfStroke);
        const innerHW = innerWidth / 2;
        const innerHH = innerHeight / 2;
        const hasInnerRect = innerWidth > 0 && innerHeight > 0;

        // Compute AABB height based on outer bounds
        const boundingHeight = Math.abs(outerWidth * sin) + Math.abs(outerHeight * cos);

        // Clamp to canvas bounds
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Allocate span arrays for outer perimeter
        const outerMinX = new Int16Array(spanCount);
        const outerMaxX = new Int16Array(spanCount);
        outerMinX.fill(surfaceWidth);
        outerMaxX.fill(-1);

        // Allocate span arrays for inner perimeter (if inner rect exists)
        const innerMinX = hasInnerRect ? new Int16Array(spanCount) : null;
        const innerMaxX = hasInnerRect ? new Int16Array(spanCount) : null;
        if (hasInnerRect) {
            innerMinX.fill(surfaceWidth);
            innerMaxX.fill(-1);
        }

        // Helper to record pixel to outer perimeter
        const recordOuter = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < outerMinX[row]) outerMinX[row] = x;
            if (x > outerMaxX[row]) outerMaxX[row] = x;
        };

        // Helper to record pixel to inner perimeter
        const recordInner = hasInnerRect ? (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < innerMinX[row]) innerMinX[row] = x;
            if (x > innerMaxX[row]) innerMaxX[row] = x;
        } : null;

        // Generate outer perimeter
        RoundedRectOpsRot._generatePerimeter(outerHW, outerHH, outerRadius, recordOuter, centerX, centerY, cos, sin, rotation);

        // Generate inner perimeter (if inner rect exists)
        if (hasInnerRect) {
            RoundedRectOpsRot._generatePerimeter(innerHW, innerHH, innerRadius, recordInner, centerX, centerY, cos, sin, rotation);
        }

        // Fill annulus per scanline with alpha blending
        for (let row = 0; row < spanCount; row++) {
            const outerLeft = outerMinX[row];
            const outerRight = outerMaxX[row];
            if (outerLeft > outerRight) continue;

            const y = yMin + row;

            // Helper to blend a span with alpha
            const blendSpan = (xStart, xEnd) => {
                const x0 = Math.max(0, xStart);
                const x1 = Math.min(surfaceWidth - 1, xEnd);
                for (let x = x0; x <= x1; x++) {
                    const pos = y * surfaceWidth + x;

                    if (clipBuffer && !(clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                        continue;
                    }

                    const idx = pos * 4;
                    const oldAlpha = data[idx + 3] / 255;
                    const oldAlphaScaled = oldAlpha * invAlpha;
                    const newAlpha = effectiveAlpha + oldAlphaScaled;

                    if (newAlpha > 0) {
                        const blendFactor = 1 / newAlpha;
                        data[idx] = (r * effectiveAlpha + data[idx] * oldAlphaScaled) * blendFactor;
                        data[idx + 1] = (g * effectiveAlpha + data[idx + 1] * oldAlphaScaled) * blendFactor;
                        data[idx + 2] = (b * effectiveAlpha + data[idx + 2] * oldAlphaScaled) * blendFactor;
                        data[idx + 3] = newAlpha * 255;
                    }
                }
            };

            if (hasInnerRect) {
                const innerLeft = innerMinX[row];
                const innerRight = innerMaxX[row];

                if (innerLeft <= innerRight) {
                    // Has inner hole: fill left span and right span
                    blendSpan(outerLeft, innerLeft - 1);
                    blendSpan(innerRight + 1, outerRight);
                } else {
                    // No inner hole on this row: fill entire outer span
                    blendSpan(outerLeft, outerRight);
                }
            } else {
                // No inner rect: fill entire outer span
                blendSpan(outerLeft, outerRight);
            }
        }
    }

    // =========================================================================
    // Combined Fill+Stroke
    // =========================================================================

    /**
     * Direct rendering for filled and stroked rotated rounded rectangle.
     * Combines fill and stroke operations with epsilon contraction to prevent boundary speckles.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color (null/undefined to skip fill)
     * @param {Color} strokeColor - Stroke color (null/undefined to skip stroke)
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Optional clip mask buffer
     */
    static fillStroke_Rot_Any(surface, centerX, centerY, width, height, radii, rotation, lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer = null) {
        // Fill first (with slight contraction to prevent speckles at fill/stroke boundary)
        if (fillColor && fillColor.a > 0) {
            RoundedRectOpsRot.fill_Rot_Any(
                surface,
                centerX, centerY,
                width - FILL_EPSILON, height - FILL_EPSILON,
                radii,
                rotation,
                fillColor,
                globalAlpha,
                clipBuffer
            );
        }

        // Stroke on top
        if (strokeColor && strokeColor.a > 0 && lineWidth > 0) {
            RoundedRectOpsRot.stroke_Rot_Any(
                surface,
                centerX, centerY,
                width, height,
                radii,
                rotation,
                lineWidth,
                strokeColor,
                globalAlpha,
                clipBuffer
            );
        }
    }
}

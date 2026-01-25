/**
 * RoundedRectOpsRot - Static methods for rotated rounded rectangle rendering
 * Provides rotated rendering separately from axis-aligned logic in RoundedRectOpsAA.
 *
 * This class is loaded BEFORE RoundedRectOpsAA and provides all rotated rounded rectangle
 * rendering implementations. Called directly by Context2D for rotated cases.
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): SpanOps.fill_Opaq, SpanOps.fill_Alpha, inline markers
 *
 * Layer 1 (Helpers - used by rotated implementations):
 *   _normalizeRadius, _transform, _generateEdgePixels, _generateArcPixels, _generatePerimeter
 *
 * Layer 2 (Implementations - internal):
 *   _fill_Rot_Opaq                → SpanOps.fill_Opaq
 *   _fill_Rot_Alpha               → SpanOps.fill_Alpha
 *   _stroke1px_Rot_Opaq           → Direct pixel writes
 *   _stroke1px_Rot_Alpha          → Inline BLEND_ALPHA marker (with lastPos tracking)
 *   _strokeThick_Rot_Opaq         → SpanOps.fill_Opaq
 *   _strokeThick_Rot_Alpha        → SpanOps.fill_Alpha
 *   _fillStroke_Rot_1px           → SpanOps.fill_Opaq/fill_Alpha + inline markers (double-generation)
 *   _fillStroke_Rot_Unified       → SpanOps.fill_Opaq/fill_Alpha
 *
 * Layer 3 (Dispatchers):
 *   fill_Rot_Any       → _fill_Rot_Opaq / _fill_Rot_Alpha
 *   stroke_Rot_Any     → _stroke1px_Rot_* / _strokeThick_Rot_*
 *   fillStroke_Rot_Any → _fillStroke_Rot_1px / _fillStroke_Rot_Unified
 *
 * External dependencies:
 *   - RectOpsRot.fill_Rot_Any (fallback when radius=0)
 *   - RectOpsRot.stroke_Rot_Any (fallback when radius=0)
 *   - ArcOps.stroke1px_Opaq_Exact (for corner arc strokes)
 *
 * MEMORY OPTIMIZATIONS:
 * ---------------------
 * - Module-level Int16Array buffer pool (_rrRotBufferPool) with growth-only strategy
 *   eliminates 10-20 allocations per call after initial warmup
 * - _stroke1px_Rot_Alpha uses global lastPos tracking across corners to prevent overdraw
 *   without Set allocation
 * - _fillStroke_Rot_1px uses double-generation: generates perimeter twice (bounds pass +
 *   render pass) instead of storing pixels in Set - CPU cycles are cheaper than hash ops
 *
 * Note: 1px stroke edges use inline Bresenham (no LineOps) to avoid line-shortening
 * that would create gaps at edge-arc junctions.
 *
 * Note: _fillStroke_Rot_1px includes assertion to catch axis-aligned cases that should
 * have been routed to RoundedRectOpsAA. Uses TRANSFORM_EPSILON (0.0001) aligned with
 * Transform2D.isAxisAligned for consistent threshold.
 */

// Module-level buffer pool for Int16Array span buffers (growth-only strategy)
// All functions share this pool since JavaScript is single-threaded.
const _rrRotBufferPool = {
    capacity: 0,
    // Fill buffers
    minX: null,
    maxX: null,
    // Stroke outer buffers
    outerMinX: null,
    outerMaxX: null,
    // Stroke inner buffers
    innerMinX: null,
    innerMaxX: null,
    // fillStroke stroke boundary buffers
    strokeMinX: null,
    strokeMaxX: null,
    // fillStroke fill buffers
    fillMinX: null,
    fillMaxX: null
};

/**
 * Ensure buffer pool has sufficient capacity (growth-only).
 * @param {number} spanCount - Required number of spans
 */
function _ensureRRRotBuffers(spanCount) {
    if (spanCount > _rrRotBufferPool.capacity) {
        // Grow with headroom to avoid frequent reallocations (2x or min 256)
        const newCapacity = Math.max(spanCount, _rrRotBufferPool.capacity * 2, 256);
        _rrRotBufferPool.minX = new Int16Array(newCapacity);
        _rrRotBufferPool.maxX = new Int16Array(newCapacity);
        _rrRotBufferPool.outerMinX = new Int16Array(newCapacity);
        _rrRotBufferPool.outerMaxX = new Int16Array(newCapacity);
        _rrRotBufferPool.innerMinX = new Int16Array(newCapacity);
        _rrRotBufferPool.innerMaxX = new Int16Array(newCapacity);
        _rrRotBufferPool.strokeMinX = new Int16Array(newCapacity);
        _rrRotBufferPool.strokeMaxX = new Int16Array(newCapacity);
        _rrRotBufferPool.fillMinX = new Int16Array(newCapacity);
        _rrRotBufferPool.fillMaxX = new Int16Array(newCapacity);
        _rrRotBufferPool.capacity = newCapacity;
    }
}

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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
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

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const minX = _rrRotBufferPool.minX;
        const maxX = _rrRotBufferPool.maxX;
        for (let i = 0; i < spanCount; i++) {
            minX[i] = surfaceWidth;  // Sentinel: larger than any valid x
            maxX[i] = -1;            // Sentinel: smaller than any valid x
        }

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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
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

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const minX = _rrRotBufferPool.minX;
        const maxX = _rrRotBufferPool.maxX;
        for (let i = 0; i < spanCount; i++) {
            minX[i] = surfaceWidth;
            maxX[i] = -1;
        }

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

        // Fill with alpha blending via SpanOps
        const effectiveAlpha = (color.a / 255) * globalAlpha;
        if (effectiveAlpha <= 0) return;
        const invAlpha = 1 - effectiveAlpha;
        const r = color.r, g = color.g, b = color.b;

        for (let row = 0; row < spanCount; row++) {
            const left = minX[row];
            const right = maxX[row];
            if (left > right) continue;

            const y = yMin + row;
            const x0 = Math.max(0, left);
            const x1 = Math.min(surfaceWidth - 1, right);

            if (x0 <= x1) {
                const spanLength = x1 - x0 + 1;
                SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, x0, y, spanLength, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
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
     * Uses hybrid approach: 4 straight edges via inline Bresenham + 4 corner arcs via ArcOps.
     *
     * Edges use inline Bresenham (not LineOps) to avoid line-shortening that would
     * create gaps at edge-arc junctions. Since stroke is opaque, overdraw is fine.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} color - Stroke color (must be opaque)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
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

        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data32 = surface.data32;
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);

        // Draw 4 straight edges via inline Bresenham (no shortening for perimeter edges)
        for (const edge of edgeEndpoints) {
            const dx = edge.end.x - edge.start.x;
            const dy = edge.end.y - edge.start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;

            const x1i = Math.floor(edge.start.x);
            const y1i = Math.floor(edge.start.y);
            const x2i = Math.floor(edge.end.x);
            const y2i = Math.floor(edge.end.y);

            // NOTE: No line shortening! Perimeter edges must meet arcs exactly.

            const dxAbs = Math.abs(x2i - x1i);
            const dyAbs = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dxAbs - dyAbs;
            let x = x1i, y = y1i;

            while (true) {
                if (x >= 0 && x < surfaceWidth && y >= 0 && y < surfaceHeight) {
                    const pixelIndex = y * surfaceWidth + x;
                    if (!clipBuffer || (clipBuffer[pixelIndex >> 3] & (1 << (pixelIndex & 7)))) {
                        data32[pixelIndex] = packedColor;
                    }
                }
                if (x === x2i && y === y2i) break;
                const e2 = 2 * err;
                if (e2 > -dyAbs) { err -= dyAbs; x += sx; }
                if (e2 < dxAbs) { err += dxAbs; y += sy; }
            }
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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
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

        // Define 4 corner arc centers and angles (needed first for junction calculation)
        const corners = [
            { localCx: -hw + radius, localCy: -hh + radius, startAngle: Math.PI, endAngle: THREE_HALF_PI },         // Top-left
            { localCx: hw - radius, localCy: -hh + radius, startAngle: THREE_HALF_PI, endAngle: TAU },      // Top-right
            { localCx: hw - radius, localCy: hh - radius, startAngle: 0, endAngle: HALF_PI },                 // Bottom-right
            { localCx: -hw + radius, localCy: hh - radius, startAngle: HALF_PI, endAngle: Math.PI }           // Bottom-left
        ];

        // Pre-compute junction pixels using the SAME math as corner rendering.
        // This ensures edges skip exactly the pixels that corners will draw.
        // CRITICAL: Store both integer (floored) and float coordinates.
        // Edge endpoints are DERIVED from these junction pixels, NOT computed separately!
        // This eliminates floating-point precision mismatches that cause overdraw.
        const junctionPixels = [];
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.localCx, corner.localCy, centerX, centerY, cos, sin);
            const cx = screenCenter.x;
            const cy = screenCenter.y;

            // Start junction (connects to previous edge's end)
            const startAngle = corner.startAngle + rotation;
            const startXf = cx + radius * Math.cos(startAngle);
            const startYf = cy + radius * Math.sin(startAngle);
            junctionPixels.push({
                x: Math.floor(startXf), y: Math.floor(startYf),
                xf: startXf, yf: startYf  // Float coords for edge length calculation
            });

            // End junction (connects to next edge's start)
            const endAngle = corner.endAngle + rotation;
            const endXf = cx + radius * Math.cos(endAngle);
            const endYf = cy + radius * Math.sin(endAngle);
            junctionPixels.push({
                x: Math.floor(endXf), y: Math.floor(endYf),
                xf: endXf, yf: endYf
            });
        }

        // DERIVE edge endpoints from junction pixels (DON'T compute separately!)
        // This guarantees Bresenham first/last pixels match junction pixels exactly.
        // Edge connectivity:
        // Edge 0 (Top): TL_end (1) → TR_start (2)
        // Edge 1 (Right): TR_end (3) → BR_start (4)
        // Edge 2 (Bottom): BR_end (5) → BL_start (6)
        // Edge 3 (Left): BL_end (7) → TL_start (0)
        const edgeEndpoints = [
            { start: junctionPixels[1], end: junctionPixels[2] },  // Top edge
            { start: junctionPixels[3], end: junctionPixels[4] },  // Right edge
            { start: junctionPixels[5], end: junctionPixels[6] },  // Bottom edge
            { start: junctionPixels[7], end: junctionPixels[0] }   // Left edge
        ];

        // Draw edge pixels via Bresenham, skipping junction pixels by coordinate match
        for (let edgeIndex = 0; edgeIndex < edgeEndpoints.length; edgeIndex++) {
            const edge = edgeEndpoints[edgeIndex];
            // Junction pixels to skip (same objects as edge start/end, guaranteed match!)
            const junc1 = edge.start;
            const junc2 = edge.end;

            // Skip zero-length edges (use float coords for accurate length)
            const dx = edge.end.xf - edge.start.xf;
            const dy = edge.end.yf - edge.start.yf;
            const edgeLength = Math.sqrt(dx * dx + dy * dy);
            if (edgeLength < MIN_EDGE_LENGTH) continue;

            // Use integer coords for Bresenham (same as junction pixels!)
            const x1i = edge.start.x;
            const y1i = edge.start.y;
            const x2i = edge.end.x;
            const y2i = edge.end.y;

            const dxAbs = Math.abs(x2i - x1i);
            const dyAbs = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1;
            const sy = y1i < y2i ? 1 : -1;
            let err = dxAbs - dyAbs;

            let x = x1i;
            let y = y1i;

            while (true) {
                const isLast = (x === x2i && y === y2i);

                // Skip if current pixel matches either junction pixel (corner will handle it)
                if (!((x === junc1.x && y === junc1.y) || (x === junc2.x && y === junc2.y))) {
                    if (x >= 0 && x < surfaceWidth && y >= 0 && y < surfaceHeight) {
                        const pos = y * surfaceWidth + x;
                        if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                            /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                        }
                    }
                }

                if (isLast) break;

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

        // Draw corner arc pixels with cross-corner duplicate tracking
        // Angle iteration can map multiple angles to the same pixel for small radii.
        // Additionally, adjacent corners may map their junction pixels to the same screen coordinate
        // (e.g., TR's END and BR's START may both be pixel (170,171)).
        // Using a global lastPos across ALL corners prevents overdraw in both cases:
        // 1. Consecutive duplicates within a single corner arc
        // 2. Corner END matching next corner's START (when they map to the same pixel)
        let globalLastPos = -1;

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
                    const pos = py * surfaceWidth + px;
                    // Skip consecutive duplicates (including cross-corner duplicates)
                    if (pos !== globalLastPos) {
                        globalLastPos = pos;
                        if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7)))) {
                            /*@inline:BLEND_ALPHA(data, pos, r, g, b, effectiveAlpha, invAlpha)*/
                        }
                    }
                }

                // Apply rotation for next iteration
                const nextX = ax * cosStep - ay * sinStep;
                ay = ax * sinStep + ay * cosStep;
                ax = nextX;
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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
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

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const outerMinX = _rrRotBufferPool.outerMinX;
        const outerMaxX = _rrRotBufferPool.outerMaxX;
        for (let i = 0; i < spanCount; i++) {
            outerMinX[i] = surfaceWidth;
            outerMaxX[i] = -1;
        }

        // Use pooled inner perimeter buffers (if inner rect exists)
        const innerMinX = hasInnerRect ? _rrRotBufferPool.innerMinX : null;
        const innerMaxX = hasInnerRect ? _rrRotBufferPool.innerMaxX : null;
        if (hasInnerRect) {
            for (let i = 0; i < spanCount; i++) {
                innerMinX[i] = surfaceWidth;
                innerMaxX[i] = -1;
            }
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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
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

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const outerMinX = _rrRotBufferPool.outerMinX;
        const outerMaxX = _rrRotBufferPool.outerMaxX;
        for (let i = 0; i < spanCount; i++) {
            outerMinX[i] = surfaceWidth;
            outerMaxX[i] = -1;
        }

        // Use pooled inner perimeter buffers (if inner rect exists)
        const innerMinX = hasInnerRect ? _rrRotBufferPool.innerMinX : null;
        const innerMaxX = hasInnerRect ? _rrRotBufferPool.innerMaxX : null;
        if (hasInnerRect) {
            for (let i = 0; i < spanCount; i++) {
                innerMinX[i] = surfaceWidth;
                innerMaxX[i] = -1;
            }
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

        // Fill annulus per scanline with alpha blending via SpanOps
        for (let row = 0; row < spanCount; row++) {
            const outerLeft = outerMinX[row];
            const outerRight = outerMaxX[row];
            if (outerLeft > outerRight) continue;

            const y = yMin + row;

            if (hasInnerRect) {
                const innerLeft = innerMinX[row];
                const innerRight = innerMaxX[row];

                if (innerLeft <= innerRight) {
                    // Has inner hole: fill left span and right span
                    const leftStart = Math.max(0, outerLeft);
                    const leftEnd = Math.min(surfaceWidth - 1, innerLeft - 1);
                    if (leftStart <= leftEnd) {
                        SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, leftStart, y, leftEnd - leftStart + 1, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
                    }

                    const rightStart = Math.max(0, innerRight + 1);
                    const rightEnd = Math.min(surfaceWidth - 1, outerRight);
                    if (rightStart <= rightEnd) {
                        SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, rightStart, y, rightEnd - rightStart + 1, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
                    }
                } else {
                    // No inner hole on this row: fill entire outer span
                    const x0 = Math.max(0, outerLeft);
                    const x1 = Math.min(surfaceWidth - 1, outerRight);
                    if (x0 <= x1) {
                        SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, x0, y, x1 - x0 + 1, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
                    }
                }
            } else {
                // No inner rect: fill entire outer span
                const x0 = Math.max(0, outerLeft);
                const x1 = Math.min(surfaceWidth - 1, outerRight);
                if (x0 <= x1) {
                    SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, x0, y, x1 - x0 + 1, r, g, b, effectiveAlpha, invAlpha, clipBuffer);
                }
            }
        }
    }

    // =========================================================================
    // Combined Fill+Stroke
    // =========================================================================

    /**
     * Direct rendering for filled and stroked rotated rounded rectangle.
     * Uses unified scanline rendering to ensure fill never extends past stroke.
     *
     * Algorithm: Generates all three boundaries (fill, stroke outer, stroke inner)
     * using the same perimeter generation algorithm, then processes each scanline
     * once, rendering fill first (clamped to stroke outer) then stroke on top.
     *
     * This approach solves the pixel divergence problem that occurred when fill
     * and stroke were rendered separately with different algorithms.
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
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static fillStroke_Rot_Any(surface, centerX, centerY, width, height, radii, rotation, lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer = null) {
        // Normalize radius
        const radius = RoundedRectOpsRot._normalizeRadius(radii, width, height);

        // Check what we need to draw
        const hasFill = fillColor && fillColor.a > 0;
        const hasStroke = strokeColor && strokeColor.a > 0 && lineWidth > 0;

        if (!hasFill && !hasStroke) return;

        // If no stroke, just do fill
        if (!hasStroke) {
            RoundedRectOpsRot.fill_Rot_Any(surface, centerX, centerY, width, height, radii, rotation, fillColor, globalAlpha, clipBuffer);
            return;
        }

        // If no fill, just do stroke
        if (!hasFill) {
            RoundedRectOpsRot.stroke_Rot_Any(surface, centerX, centerY, width, height, radii, rotation, lineWidth, strokeColor, globalAlpha, clipBuffer);
            return;
        }

        // Fallback to RectOpsRot for zero radius
        if (radius <= 0) {
            RectOpsRot.fillStroke_Rot_Any(surface, centerX, centerY, width, height, rotation, lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer);
            return;
        }

        // For 1px stroke, use special handling to ensure stroke is only on perimeter
        // For thick stroke (>1px), use unified scanline rendering
        if (lineWidth <= 1) {
            RoundedRectOpsRot._fillStroke_Rot_1px(
                surface, centerX, centerY, width, height, radius, rotation,
                fillColor, strokeColor, globalAlpha, clipBuffer
            );
        } else {
            RoundedRectOpsRot._fillStroke_Rot_Unified(
                surface, centerX, centerY, width, height, radius, rotation,
                lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer
            );
        }
    }

    /**
     * Internal: Fill+stroke for 1px stroke on rotated rounded rectangle.
     * Uses perimeter-clamped fill + Set-based stroke rendering.
     *
     * IMPORTANT: This method only handles non-axis-aligned (rotated) cases.
     * Includes assertion to catch routing errors - axis-aligned shapes should
     * use RoundedRectOpsAA.fillStroke_AA_Any() instead.
     *
     * For 1px stroke, the stroke is only the perimeter pixels (not a filled annulus).
     * We generate the stroke perimeter, use it to clamp fill, then render stroke pixels.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {Color} fillColor - Fill color
     * @param {Color} strokeColor - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _fillStroke_Rot_1px(surface, centerX, centerY, width, height, radius, rotation, fillColor, strokeColor, globalAlpha, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        // Assertion: This method should only be called for non-axis-aligned shapes.
        // If |sin| < TRANSFORM_EPSILON, the shape should have been routed to RoundedRectOpsAA.
        if (Math.abs(sin) < TRANSFORM_EPSILON) {
            throw new Error(`_fillStroke_Rot_1px called with axis-aligned rotation (sin=${sin}). ` +
                            `This should have been routed to RoundedRectOpsAA.`);
        }

        const hw = width / 2;
        const hh = height / 2;

        // Edge endpoints in local space
        const edges = [
            { start: { x: -hw + radius, y: -hh }, end: { x: hw - radius, y: -hh } },      // Top
            { start: { x: hw, y: -hh + radius }, end: { x: hw, y: hh - radius } },        // Right
            { start: { x: hw - radius, y: hh }, end: { x: -hw + radius, y: hh } },        // Bottom
            { start: { x: -hw, y: hh - radius }, end: { x: -hw, y: -hh + radius } }       // Left
        ];

        // Corner definitions
        const corners = [
            { cx: -hw + radius, cy: -hh + radius, startAngle: Math.PI, endAngle: THREE_HALF_PI },
            { cx: hw - radius, cy: -hh + radius, startAngle: THREE_HALF_PI, endAngle: TAU },
            { cx: hw - radius, cy: hh - radius, startAngle: 0, endAngle: HALF_PI },
            { cx: -hw + radius, cy: hh - radius, startAngle: HALF_PI, endAngle: Math.PI }
        ];

        // Calculate bounding box for fill
        const boundingHeight = Math.abs(width * sin) + Math.abs(height * cos);
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount > 0) {
            // Use pooled span arrays (growth-only buffer pool)
            _ensureRRRotBuffers(spanCount);
            const fillMinX = _rrRotBufferPool.fillMinX;
            const fillMaxX = _rrRotBufferPool.fillMaxX;
            const strokeMinX = _rrRotBufferPool.strokeMinX;
            const strokeMaxX = _rrRotBufferPool.strokeMaxX;

            for (let i = 0; i < spanCount; i++) {
                fillMinX[i] = surfaceWidth;
                fillMaxX[i] = -1;
                strokeMinX[i] = surfaceWidth;
                strokeMaxX[i] = -1;
            }

            // PASS 1: Generate stroke perimeter for bounds only (no Set allocation)
            // Record both fill bounds and stroke bounds
            const recordFill = (x, y) => {
                if (y < yMin || y > yMax) return;
                const row = y - yMin;
                if (x < fillMinX[row]) fillMinX[row] = x;
                if (x > fillMaxX[row]) fillMaxX[row] = x;
            };

            const recordStrokeBounds = (x, y) => {
                if (x < 0 || x >= surfaceWidth || y < 0 || y >= surfaceHeight) return;
                if (y < yMin || y > yMax) return;
                const row = y - yMin;
                if (x < strokeMinX[row]) strokeMinX[row] = x;
                if (x > strokeMaxX[row]) strokeMaxX[row] = x;
            };

            // Generate fill bounds using perimeter-based approach
            RoundedRectOpsRot._generatePerimeter(hw, hh, radius, recordFill, centerX, centerY, cos, sin, rotation);

            // Generate stroke bounds (PASS 1 of double-generation)
            for (const edge of edges) {
                const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
                const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);
                const dx = end.x - start.x, dy = end.y - start.y;
                if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;
                RoundedRectOpsRot._generateEdgePixels(start.x, start.y, end.x, end.y, recordStrokeBounds);
            }
            for (const corner of corners) {
                const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
                RoundedRectOpsRot._generateArcPixels(
                    screenCenter.x, screenCenter.y, radius,
                    corner.startAngle + rotation, corner.endAngle + rotation,
                    recordStrokeBounds
                );
            }

            // Clamp fill to stroke bounds to prevent overspill
            for (let row = 0; row < spanCount; row++) {
                if (strokeMaxX[row] >= 0) {
                    if (fillMaxX[row] > strokeMaxX[row]) fillMaxX[row] = strokeMaxX[row];
                    if (fillMinX[row] < strokeMinX[row]) fillMinX[row] = strokeMinX[row];
                }
            }

            // Determine fill rendering mode
            const fillIsOpaque = fillColor.a === 255 && globalAlpha >= 1.0;
            const fillEffectiveAlpha = (fillColor.a / 255) * globalAlpha;
            const fillInvAlpha = 1 - fillEffectiveAlpha;
            const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;

            // Render fill scanlines via SpanOps (fill clamped to stroke bounds to prevent overspill)
            for (let row = 0; row < spanCount; row++) {
                const y = yMin + row;
                const fillLeft = fillMinX[row];
                const fillRight = fillMaxX[row];

                if (fillLeft > fillRight) continue;

                const x0 = Math.max(0, fillLeft);
                const x1 = Math.min(surfaceWidth - 1, fillRight);

                if (x0 <= x1) {
                    const spanLength = x1 - x0 + 1;
                    if (fillIsOpaque) {
                        SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, y, spanLength, fillPacked, clipBuffer);
                    } else {
                        SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, x0, y, spanLength, fillColor.r, fillColor.g, fillColor.b, fillEffectiveAlpha, fillInvAlpha, clipBuffer);
                    }
                }
            }
        }

        // PASS 2: Render stroke on top (inline iteration, no closure/callback overhead)
        const strokeIsOpaque = strokeColor.a === 255 && globalAlpha >= 1.0;
        const strokeEffectiveAlpha = (strokeColor.a / 255) * globalAlpha;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Extract RGB for inline markers (required by BLEND_ALPHA_CLIPPED)
        const r = strokeColor.r, g = strokeColor.g, b = strokeColor.b;

        // For opaque strokes, direct rendering is safe (duplicates just overwrite same value)
        // For semi-transparent strokes, use lastPos tracking to prevent overdraw
        let lastPos = -1;

        // Render edges via inline Bresenham (no callback)
        for (const edge of edges) {
            const start = RoundedRectOpsRot._transform(edge.start.x, edge.start.y, centerX, centerY, cos, sin);
            const end = RoundedRectOpsRot._transform(edge.end.x, edge.end.y, centerX, centerY, cos, sin);
            const dx = end.x - start.x, dy = end.y - start.y;
            if (dx * dx + dy * dy < MIN_EDGE_LENGTH_SQUARED) continue;

            const x1i = Math.floor(start.x), y1i = Math.floor(start.y);
            const x2i = Math.floor(end.x), y2i = Math.floor(end.y);
            const dxAbs = Math.abs(x2i - x1i), dyAbs = Math.abs(y2i - y1i);
            const sx = x1i < x2i ? 1 : -1, sy = y1i < y2i ? 1 : -1;
            let err = dxAbs - dyAbs;
            let x = x1i, y = y1i;

            while (true) {
                if (x >= 0 && x < surfaceWidth && y >= 0 && y < surfaceHeight) {
                    const pos = y * surfaceWidth + x;
                    if (strokeIsOpaque) {
                        /*@inline:SET_OPAQUE_CLIPPED(data32, pos, strokePacked, clipBuffer)*/
                    } else {
                        if (pos !== lastPos) {
                            lastPos = pos;
                            /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer)*/
                        }
                    }
                }
                if (x === x2i && y === y2i) break;
                const e2 = 2 * err;
                if (e2 > -dyAbs) { err -= dyAbs; x += sx; }
                if (e2 < dxAbs) { err += dxAbs; y += sy; }
            }
        }

        // Render corners via inline arc iteration (matching _generateArcPixels parameters)
        for (const corner of corners) {
            const screenCenter = RoundedRectOpsRot._transform(corner.cx, corner.cy, centerX, centerY, cos, sin);
            const cx = screenCenter.x, cy = screenCenter.y;
            const startAngle = corner.startAngle + rotation;
            const endAngle = corner.endAngle + rotation;

            const arcLength = radius * Math.abs(endAngle - startAngle);
            const numSteps = Math.max(Math.ceil(arcLength), 8);
            const angleStep = (endAngle - startAngle) / numSteps;

            // Use per-arc pixel deduplication (matching _generateArcPixels behavior)
            let lastPx = null, lastPy = null;

            for (let i = 0; i <= numSteps; i++) {
                const angle = startAngle + i * angleStep;
                const px = Math.floor(cx + radius * Math.cos(angle));
                const py = Math.floor(cy + radius * Math.sin(angle));

                // Skip consecutive duplicates within this arc
                if (px === lastPx && py === lastPy) continue;
                lastPx = px;
                lastPy = py;

                if (px >= 0 && px < surfaceWidth && py >= 0 && py < surfaceHeight) {
                    const pos = py * surfaceWidth + px;
                    if (strokeIsOpaque) {
                        /*@inline:SET_OPAQUE_CLIPPED(data32, pos, strokePacked, clipBuffer)*/
                    } else {
                        if (pos !== lastPos) {
                            lastPos = pos;
                            /*@inline:BLEND_ALPHA_CLIPPED(data, pos, r, g, b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer)*/
                        }
                    }
                }
            }
        }
    }

    /**
     * Internal: Unified fill+stroke rendering for rotated rounded rectangle.
     * Generates all three boundaries (fill, stroke outer, stroke inner) using
     * the same perimeter algorithm, then renders fill and stroke per scanline.
     *
     * @param {Surface} surface - Target surface
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius (already normalized)
     * @param {number} rotation - Rotation angle in radians
     * @param {number} lineWidth - Stroke width
     * @param {Color} fillColor - Fill color
     * @param {Color} strokeColor - Stroke color
     * @param {number} globalAlpha - Global alpha value
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: delegated to SpanOps, QuadScanOps, or ArcOps)
     */
    static _fillStroke_Rot_Unified(surface, centerX, centerY, width, height, radius, rotation, lineWidth, fillColor, strokeColor, globalAlpha, clipBuffer) {
        const surfaceWidth = surface.width;
        const surfaceHeight = surface.height;
        const data = surface.data;
        const data32 = surface.data32;

        // Pre-compute rotation
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const halfStroke = lineWidth / 2;

        // Stroke outer dimensions (path expanded by halfStroke)
        const outerHW = (width + lineWidth) / 2;
        const outerHH = (height + lineWidth) / 2;
        const outerRadius = Math.min(radius + halfStroke, Math.min(width + lineWidth, height + lineWidth) / 2);

        // Stroke inner dimensions
        const innerWidth = width - lineWidth;
        const innerHeight = height - lineWidth;
        const innerHW = innerWidth / 2;
        const innerHH = innerHeight / 2;
        const innerRadius = Math.max(0, radius - halfStroke);
        const hasInnerRect = innerWidth > 0 && innerHeight > 0;

        // Check if stroke is opaque - determines if we need fill perimeter
        const strokeIsOpaque = strokeColor.a === 255 && globalAlpha >= 1.0;

        // Compute AABB height based on outer bounds (largest boundary)
        const outerWidth = outerHW * 2;
        const outerHeight = outerHH * 2;
        const boundingHeight = Math.abs(outerWidth * sin) + Math.abs(outerHeight * cos);

        // Clamp to canvas bounds
        const yMin = Math.max(0, Math.floor(centerY - boundingHeight / 2));
        const yMax = Math.min(surfaceHeight - 1, Math.ceil(centerY + boundingHeight / 2));
        const spanCount = yMax - yMin + 1;

        if (spanCount <= 0) return;

        // Use pooled span arrays (growth-only buffer pool)
        _ensureRRRotBuffers(spanCount);
        const outerMinX = _rrRotBufferPool.outerMinX;
        const outerMaxX = _rrRotBufferPool.outerMaxX;
        for (let i = 0; i < spanCount; i++) {
            outerMinX[i] = surfaceWidth;
            outerMaxX[i] = -1;
        }

        // Use pooled inner perimeter buffers (if inner rect exists)
        const innerMinX = hasInnerRect ? _rrRotBufferPool.innerMinX : null;
        const innerMaxX = hasInnerRect ? _rrRotBufferPool.innerMaxX : null;
        if (hasInnerRect) {
            for (let i = 0; i < spanCount; i++) {
                innerMinX[i] = surfaceWidth;
                innerMaxX[i] = -1;
            }
        }

        // For opaque strokes, reuse inner bounds for fill (stroke covers overlap region)
        // For semi-transparent strokes, need path boundary for correct 3-color overlap
        let fillMinX, fillMaxX;
        if (strokeIsOpaque) {
            // Opaque stroke: fill to inner boundary - stroke covers the rest
            fillMinX = hasInnerRect ? innerMinX : null;
            fillMaxX = hasInnerRect ? innerMaxX : null;
        } else {
            // Semi-transparent stroke: use pooled fill bounds at path boundary
            fillMinX = _rrRotBufferPool.fillMinX;
            fillMaxX = _rrRotBufferPool.fillMaxX;
            for (let i = 0; i < spanCount; i++) {
                fillMinX[i] = surfaceWidth;
                fillMaxX[i] = -1;
            }
        }

        // Create recorders for each perimeter
        const recordOuter = (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < outerMinX[row]) outerMinX[row] = x;
            if (x > outerMaxX[row]) outerMaxX[row] = x;
        };

        const recordInner = hasInnerRect ? (x, y) => {
            if (y < yMin || y > yMax) return;
            const row = y - yMin;
            if (x < innerMinX[row]) innerMinX[row] = x;
            if (x > innerMaxX[row]) innerMaxX[row] = x;
        } : null;

        // Generate outer and inner perimeters
        RoundedRectOpsRot._generatePerimeter(outerHW, outerHH, outerRadius, recordOuter, centerX, centerY, cos, sin, rotation);
        if (hasInnerRect) {
            RoundedRectOpsRot._generatePerimeter(innerHW, innerHH, innerRadius, recordInner, centerX, centerY, cos, sin, rotation);
        }

        // Generate fill perimeter only for semi-transparent strokes
        // Fill uses path dimensions directly (no contraction needed).
        // Since lineWidth > 1 (this method only handles thick strokes), stroke outer
        // extends by at least 0.5px beyond path on each side. Using the same
        // _generatePerimeter algorithm for both guarantees fill stays inside
        // outer bounds without explicit clamping.
        if (!strokeIsOpaque) {
            const fillHW = width / 2;
            const fillHH = height / 2;
            const fillRadius = radius;
            const recordFill = (x, y) => {
                if (y < yMin || y > yMax) return;
                const row = y - yMin;
                if (x < fillMinX[row]) fillMinX[row] = x;
                if (x > fillMaxX[row]) fillMaxX[row] = x;
            };
            RoundedRectOpsRot._generatePerimeter(fillHW, fillHH, fillRadius, recordFill, centerX, centerY, cos, sin, rotation);
        }

        // Determine rendering modes
        const fillIsOpaque = fillColor.a === 255 && globalAlpha >= 1.0;
        const fillEffectiveAlpha = (fillColor.a / 255) * globalAlpha;
        const fillInvAlpha = 1 - fillEffectiveAlpha;
        const strokeEffectiveAlpha = (strokeColor.a / 255) * globalAlpha;
        const strokeInvAlpha = 1 - strokeEffectiveAlpha;

        // Packed colors for opaque rendering
        const fillPacked = fillIsOpaque ? Surface.packColor(fillColor.r, fillColor.g, fillColor.b, 255) : 0;
        const strokePacked = strokeIsOpaque ? Surface.packColor(strokeColor.r, strokeColor.g, strokeColor.b, 255) : 0;

        // Render each scanline
        for (let row = 0; row < spanCount; row++) {
            const y = yMin + row;

            // Get outer stroke extent
            const outerLeft = outerMinX[row];
            const outerRight = outerMaxX[row];
            if (outerLeft > outerRight) continue;  // No pixels on this row

            // Get inner stroke extent
            const innerLeft = hasInnerRect ? innerMinX[row] : surfaceWidth;
            const innerRight = hasInnerRect ? innerMaxX[row] : -1;
            const hasInnerRegion = innerLeft <= innerRight;

            // Get fill extent
            // For opaque stroke with no inner rect, fillMinX/fillMaxX are null (stroke covers everything)
            const fillLeft = fillMinX ? fillMinX[row] : surfaceWidth;
            const fillRight = fillMaxX ? fillMaxX[row] : -1;

            // STEP 1: Render fill first via SpanOps
            if (fillLeft <= fillRight) {
                const x0 = Math.max(0, fillLeft);
                const x1 = Math.min(surfaceWidth - 1, fillRight);

                if (x0 <= x1) {
                    const spanLength = x1 - x0 + 1;
                    if (fillIsOpaque) {
                        SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, y, spanLength, fillPacked, clipBuffer);
                    } else {
                        SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, x0, y, spanLength, fillColor.r, fillColor.g, fillColor.b, fillEffectiveAlpha, fillInvAlpha, clipBuffer);
                    }
                }
            }

            // STEP 2: Render stroke on top (outer minus inner) via SpanOps
            const renderStrokeSegment = (startX, endX) => {
                if (startX > endX) return;
                const x0 = Math.max(0, startX);
                const x1 = Math.min(surfaceWidth - 1, endX);
                if (x0 > x1) return;
                const spanLength = x1 - x0 + 1;

                if (strokeIsOpaque) {
                    SpanOps.fill_Opaq(data32, surfaceWidth, surfaceHeight, x0, y, spanLength, strokePacked, clipBuffer);
                } else {
                    SpanOps.fill_Alpha(data, surfaceWidth, surfaceHeight, x0, y, spanLength, strokeColor.r, strokeColor.g, strokeColor.b, strokeEffectiveAlpha, strokeInvAlpha, clipBuffer);
                }
            };

            if (hasInnerRegion) {
                // Has inner hole: render left and right stroke segments
                renderStrokeSegment(outerLeft, innerLeft - 1);  // Left segment
                renderStrokeSegment(innerRight + 1, outerRight);  // Right segment
            } else {
                // No inner region: fill entire stroke span
                renderStrokeSegment(outerLeft, outerRight);
            }
        }
    }
}

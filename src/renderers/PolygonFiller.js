/**
 * PolygonFiller class for SWCanvas
 *
 * Implements scanline polygon filling with nonzero and evenodd winding rules.
 * Handles stencil-based clipping integration and premultiplied alpha blending.
 *
 * Provides dual rendering approaches:
 * - Optimized path: 32-bit packed writes for opaque solid colors
 * - Standard path: Full paint source support with gradients, patterns, compositing
 *
 * Converted from functional to class-based approach following OO best practices:
 * - Static methods for stateless operations
 * - Clear separation of scanline logic from pixel blending
 * - Immutable color handling with Color class integration
 */
class PolygonFiller {
    /**
     * Fill polygons using scanline algorithm with stencil-based clipping
     * Routes to optimized rendering when possible for optimal performance
     *
     * @param {Surface} surface - Target surface to render to
     * @param {Array} polygons - Array of polygons (each polygon is array of {x,y} points)
     * @param {Color|Gradient|Pattern} paintSource - Paint source to fill with
     * @param {string} fillRule - 'nonzero' or 'evenodd' winding rule
     * @param {Transform2D} transform - Transformation matrix to apply to polygons
     * @param {ClipMask|null} clipMask - Optional 1-bit stencil buffer for clipping
     * @param {number} globalAlpha - Global alpha value (0-1) for rendering operation
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation (default: 'source-over')
     * @param {SourceMask|null} sourceMask - Optional source coverage mask for canvas-wide compositing
     */
    static fillPolygons(
        surface,
        polygons,
        paintSource,
        fillRule,
        transform,
        clipMask,
        globalAlpha = 1.0,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null,
        clipRect = null
    ) {
        if (polygons.length === 0) return;
        if (IS_DEBUG) {
            if (!PolygonFiller._isValidPaintSource(paintSource)) {
                throw new Error('Paint source must be a Color, Gradient, or Pattern instance');
            }
        }

        // Tier-0 rect clip (S3): clipMask is null here; clipRect clamps the scanline
        // range (Y, via bounds) and each span (X) so the existing unclipped branches
        // draw exactly the mask's visible pixels. Byte-identical (Stage-1 proof).
        // Check if we can use direct rendering (opaque solid color with source-over)
        const canUseDirectRendering =
            paintSource instanceof Color &&
            paintSource.a === 255 &&
            globalAlpha >= 1.0 &&
            subPixelOpacity >= 1.0 &&
            composite === 'source-over' &&
            sourceMask === null;

        if (canUseDirectRendering) {
            PolygonFiller._fillPolygonsDirect(surface, polygons, paintSource, fillRule, transform, clipMask, clipRect);
        } else {
            PolygonFiller._fillPolygonsStandard(
                surface,
                polygons,
                paintSource,
                fillRule,
                transform,
                clipMask,
                globalAlpha,
                subPixelOpacity,
                composite,
                sourceMask,
                clipRect
            );
        }
    }

    /**
     * Direct rendering for opaque solid color fills with source-over compositing
     * Uses 32-bit packed writes and inline clip buffer access for maximum performance
     * @private
     */
    static _fillPolygonsDirect(surface, polygons, color, fillRule, transform, clipMask, clipRect = null) {
        // Pre-compute packed color outside hot loop
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);
        const data32 = surface.data32;
        const width = surface.width;
        const clipBuffer = clipMask ? clipMask.buffer : null;
        // Tier-0 rect clip: half-open [x0,x1)×[y0,y1); clamp span X and scanline Y.
        const clipX0 = clipRect ? clipRect.x0 : 0;
        const clipX1m1 = clipRect ? clipRect.x1 - 1 : (width - 1);

        // Transform all polygon vertices
        const transformedPolygons = polygons.map(poly => poly.map(point => transform.transformPoint(point)));

        // Find bounding box
        const bounds = PolygonFiller._calculateBounds(transformedPolygons, surface);
        let scanMinY = bounds.minY, scanMaxY = bounds.maxY;
        if (clipRect) {
            if (clipRect.y0 > scanMinY) scanMinY = clipRect.y0;
            if (clipRect.y1 - 1 < scanMaxY) scanMaxY = clipRect.y1 - 1;
        }

        // Process each scanline
        for (let y = scanMinY; y <= scanMaxY; y++) {
            // Find all intersections with this scanline
            const intersections = [];
            for (const poly of transformedPolygons) {
                PolygonFiller._findPolygonIntersections(poly, y + 0.5, intersections);
            }

            // Sort intersections by x coordinate
            intersections.sort((a, b) => a.x - b.x);

            // Fill spans using optimized rendering
            let windingNumber = 0;
            let inside = false;

            for (let i = 0; i < intersections.length; i++) {
                const intersection = intersections[i];
                const nextIntersection = intersections[i + 1];

                windingNumber += intersection.winding;

                if (fillRule === 'evenodd') {
                    inside = windingNumber % 2 !== 0;
                } else {
                    inside = windingNumber !== 0;
                }

                if (inside && nextIntersection) {
                    // Pixel-center sampling on X (see _fillClipMaskSpans for the
                    // full rationale): a column x is in span [left, right) iff
                    // its center x+0.5 is inside it (left <= x+0.5 < right). This
                    // is the opaque-solid-color fast path; the old
                    // ceil(left)..floor(right) inclusive endX made a path-filled
                    // rect 1px wider on the right than fillRect / clip / drawImage
                    // / HTML5.
                    let startX = Math.max(0, Math.ceil(intersection.x - 0.5));
                    let endX = Math.min(width - 1, Math.ceil(nextIntersection.x - 0.5) - 1);
                    // Tier-0 rect clip: clamp the span to the clip rect's X range;
                    // clipBuffer is null so the unclipped write branch below runs.
                    if (startX < clipX0) startX = clipX0;
                    if (endX > clipX1m1) endX = clipX1m1;

                    if (startX <= endX) {
                        // Direct span fill with 32-bit writes
                        let pixelIndex = y * width + startX;
                        const endIndex = y * width + endX + 1;

                        if (clipBuffer) {
                            // With clipping - use byte-level skip optimization
                            while (pixelIndex < endIndex) {
                                const byteIndex = pixelIndex >> 3;

                                // Skip fully clipped bytes (8 pixels at a time)
                                if (clipBuffer[byteIndex] === 0) {
                                    const nextByteBoundary = (byteIndex + 1) << 3;
                                    pixelIndex = Math.min(nextByteBoundary, endIndex);
                                    continue;
                                }

                                // Check individual pixel within partially visible byte
                                const bitIndex = pixelIndex & 7;
                                if (clipBuffer[byteIndex] & (1 << bitIndex)) {
                                    data32[pixelIndex] = packedColor;
                                }
                                pixelIndex++;
                            }
                        } else {
                            // No clipping - contiguous run of one packed color, so a native
                            // TypedArray.fill beats the per-pixel loop (O1,
                            // docs/runtime-performance-optimization-plan.md §5B). Byte-identical:
                            // same value, same [pixelIndex, endIndex) indices.
                            data32.fill(packedColor, pixelIndex, endIndex);
                        }
                    }
                }
            }
        }
    }

    /**
     * Standard path for all other cases (gradients, patterns, transparency, compositing)
     * @private
     */
    static _fillPolygonsStandard(
        surface,
        polygons,
        paintSource,
        fillRule,
        transform,
        clipMask,
        globalAlpha,
        subPixelOpacity,
        composite,
        sourceMask,
        clipRect = null
    ) {
        // Mark path-based rendering for testing (helps verify direct rendering is used when expected)
        // Check for Context2D existence since PolygonFiller may be used in isolation (e.g., unit tests)
        if (typeof Context2D !== 'undefined' && Context2D._markPathBasedRendering) {
            Context2D._markPathBasedRendering();
        }

        // Transform all polygon vertices
        const transformedPolygons = polygons.map(poly => poly.map(point => transform.transformPoint(point)));

        // Find bounding box for optimization
        const bounds = PolygonFiller._calculateBounds(transformedPolygons, surface);
        let scanMinY = bounds.minY, scanMaxY = bounds.maxY;
        if (clipRect) { // tier-0: only scanlines inside the clip rect's Y range
            if (clipRect.y0 > scanMinY) scanMinY = clipRect.y0;
            if (clipRect.y1 - 1 < scanMaxY) scanMaxY = clipRect.y1 - 1;
        }

        // Process each scanline
        for (let y = scanMinY; y <= scanMaxY; y++) {
            PolygonFiller._fillScanline(
                surface,
                y,
                transformedPolygons,
                paintSource,
                fillRule,
                clipMask,
                transform,
                globalAlpha,
                subPixelOpacity,
                composite,
                sourceMask,
                clipRect
            );
        }
    }

    /**
     * Calculate bounding box for transformed polygons
     * @param {Array} polygons - Transformed polygons
     * @param {Surface} surface - Target surface for bounds clamping
     * @returns {Object} {minY, maxY} bounds
     * @private
     */
    static _calculateBounds(polygons, surface) {
        let minY = Infinity,
            maxY = -Infinity;

        for (const poly of polygons) {
            for (const point of poly) {
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }
        }

        // Clamp to surface bounds
        return {
            minY: Math.max(0, Math.floor(minY)),
            maxY: Math.min(surface.height - 1, Math.ceil(maxY))
        };
    }

    /**
     * Fill a single scanline using polygon intersection and winding rules
     * @param {Surface} surface - Target surface
     * @param {number} y - Scanline y coordinate
     * @param {Array} polygons - Transformed polygons
     * @param {Color|Gradient|Pattern} paintSource - Paint source
     * @param {string} fillRule - Winding rule
     * @param {ClipMask|null} clipMask - Clipping mask
     * @param {Transform2D} transform - Canvas transform (for gradients/patterns)
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation
     * @param {SourceMask|null} sourceMask - Optional source coverage mask
     * @private
     */
    static _fillScanline(
        surface,
        y,
        polygons,
        paintSource,
        fillRule,
        clipMask,
        transform,
        globalAlpha,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null,
        clipRect = null
    ) {
        const intersections = [];

        // Find all intersections with this scanline
        for (const poly of polygons) {
            PolygonFiller._findPolygonIntersections(poly, y + 0.5, intersections);
        }

        // Sort intersections by x coordinate
        intersections.sort((a, b) => a.x - b.x);

        // Fill spans based on winding rule
        PolygonFiller._fillSpans(
            surface,
            y,
            intersections,
            paintSource,
            fillRule,
            clipMask,
            transform,
            globalAlpha,
            subPixelOpacity,
            composite,
            sourceMask,
            clipRect
        );
    }

    /**
     * Find intersections between a polygon and a horizontal scanline
     * @param {Array} polygon - Array of {x, y} points
     * @param {number} y - Scanline y coordinate
     * @param {Array} intersections - Array to append intersections to
     * @private
     */
    static _findPolygonIntersections(polygon, y, intersections) {
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];

            // Skip horizontal edges (avoid division by zero)
            if (Math.abs(p1.y - p2.y) < FLOAT_EPSILON) continue;

            // Check if scanline crosses this edge
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);

            if (y >= minY && y < maxY) {
                // Note: < maxY to avoid double-counting vertices
                // Calculate intersection point using linear interpolation
                const t = (y - p1.y) / (p2.y - p1.y);
                const x = p1.x + t * (p2.x - p1.x);

                // Determine winding direction
                const winding = p2.y > p1.y ? 1 : -1;

                intersections.push({ x: x, winding: winding });
            }
        }
    }

    /**
     * Fill spans on a scanline based on winding rule
     * @param {Surface} surface - Target surface
     * @param {number} y - Scanline y coordinate
     * @param {Array} intersections - Sorted intersections with winding info
     * @param {Color|Gradient|Pattern} paintSource - Paint source
     * @param {string} fillRule - 'evenodd' or 'nonzero'
     * @param {ClipMask|null} clipMask - Stencil clipping mask
     * @param {Transform2D} transform - Canvas transform (for gradients/patterns)
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation
     * @param {SourceMask|null} sourceMask - Optional source coverage mask
     * @private
     */
    static _fillSpans(
        surface,
        y,
        intersections,
        paintSource,
        fillRule,
        clipMask,
        transform,
        globalAlpha,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null,
        clipRect = null
    ) {
        if (intersections.length === 0) return;
        // Tier-0 rect clip: clamp each span's X to the clip rect (clipMask is null;
        // caller has already restricted Y to the rect). Byte-identical (Stage 1).
        const clipX0 = clipRect ? clipRect.x0 : 0;
        const clipX1m1 = clipRect ? clipRect.x1 - 1 : (surface.width - 1);

        let windingNumber = 0;
        let inside = false;

        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];
            const nextIntersection = intersections[i + 1];

            // Update winding number
            windingNumber += intersection.winding;

            // Determine if we're inside based on fill rule
            if (fillRule === 'evenodd') {
                inside = windingNumber % 2 !== 0;
            } else {
                // nonzero
                inside = windingNumber !== 0;
            }

            // Fill span if we're inside
            if (inside && nextIntersection) {
                // Pixel-center sampling on X (see _fillClipMaskSpans). This is
                // the standard path (patterns, gradients, alpha<255,
                // non-source-over): the old ceil(left)..floor(right) inclusive
                // endX made e.g. an unclipped desktop PATTERN fill reach one
                // column past the clipped morphs drawn over it. A column x is in
                // [left, right) iff left <= x+0.5 < right.
                let startX = Math.max(0, Math.ceil(intersection.x - 0.5));
                let endX = Math.min(surface.width - 1, Math.ceil(nextIntersection.x - 0.5) - 1);
                if (startX < clipX0) startX = clipX0;
                if (endX > clipX1m1) endX = clipX1m1;

                PolygonFiller._fillPixelSpan(
                    surface,
                    y,
                    startX,
                    endX,
                    paintSource,
                    clipMask,
                    transform,
                    globalAlpha,
                    subPixelOpacity,
                    composite,
                    sourceMask
                );
            }
        }
    }

    /**
     * Fill a horizontal span of pixels with paint source and alpha blending
     * @param {Surface} surface - Target surface
     * @param {number} y - Y coordinate
     * @param {number} startX - Start X coordinate (inclusive)
     * @param {number} endX - End X coordinate (inclusive)
     * @param {Color|Gradient|Pattern} paintSource - Paint source
     * @param {ClipMask|null} clipMask - Stencil clipping mask
     * @param {Transform2D} transform - Canvas transform (for gradients/patterns)
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation
     * @param {SourceMask|null} sourceMask - Optional source coverage mask to record coverage
     * @private
     */
    static _fillPixelSpan(
        surface,
        y,
        startX,
        endX,
        paintSource,
        clipMask,
        transform,
        globalAlpha,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null
    ) {
        // For a solid Color the paint evaluation is independent of pixel position,
        // so evaluate it ONCE per span rather than once per pixel (this loop is one
        // of the hottest paths). Gradients/patterns still evaluate per pixel below.
        // (x,y are ignored by _evaluatePaintSource's Color branch; startX is passed
        // only as a valid coordinate.)
        const solidColor = (paintSource instanceof Color)
            ? PolygonFiller._evaluatePaintSource(paintSource, startX, y, transform, globalAlpha, subPixelOpacity)
            : null;

        const data = surface.data;
        const stride = surface.stride;

        // S4 fast path: a solid Color under source-over (Fizzygum's ~entire fill
        // traffic). Blend in place with the source channels + alpha hoisted out of
        // the loop — no per-pixel {r,g,b,a} object and no string switch. This is
        // byte-identical to CompositeOperations.blendPixel's source-over path:
        //   srcA===0   -> dest unchanged (so a transparent span is a whole no-op)
        //   srcA===255 -> write source
        //   dstA===0   -> write source
        //   else       -> Math.round(src*a + dst*(1-a)) per channel, a = srcA/255
        // sourceMask is only ever set for canvas-wide (non-source-over) ops, so the
        // !sourceMask guard is belt-and-suspenders (source-over => sourceMask null).
        if (solidColor !== null && composite === 'source-over' && !sourceMask) {
            const sr = solidColor.r, sg = solidColor.g, sb = solidColor.b, sa = solidColor.a;
            if (sa === 0) return;
            const srcAlpha = sa / 255;
            const invSrcAlpha = 1 - srcAlpha;
            for (let x = startX; x <= endX; x++) {
                if (clipMask && clipMask.isPixelClipped(x, y)) continue;
                const offset = y * stride + x * 4;
                if (sa === 255) {
                    data[offset] = sr;
                    data[offset + 1] = sg;
                    data[offset + 2] = sb;
                    data[offset + 3] = 255;
                } else {
                    const dstA = data[offset + 3];
                    if (dstA === 0) {
                        data[offset] = sr;
                        data[offset + 1] = sg;
                        data[offset + 2] = sb;
                        data[offset + 3] = sa;
                    } else {
                        data[offset] = Math.round(sr * srcAlpha + data[offset] * invSrcAlpha);
                        data[offset + 1] = Math.round(sg * srcAlpha + data[offset + 1] * invSrcAlpha);
                        data[offset + 2] = Math.round(sb * srcAlpha + data[offset + 2] * invSrcAlpha);
                        data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                    }
                }
            }
            return;
        }

        // Pattern fast path (analogous to the S4 solid path). getColorForPixel
        // recomputes a matrix MULTIPLY + INVERSION and allocates a Color/Point PER
        // PIXEL, even though the device→pattern inverse is invariant across the fill
        // — the dominant cost of a patterned wallpaper. Hoist the inverse once,
        // sample by byte offset, and blend source-over in place with no per-pixel
        // allocation. Byte-identical to the general path below: same sample offset
        // (same hoisted inverse), same withGlobalAlpha alpha, and the same
        // source-over arithmetic as CompositeOperations.blendPixel.
        if (paintSource instanceof Pattern && composite === 'source-over' && !sourceMask) {
            const inv = paintSource.inverseForDevice(transform);
            const pdata = paintSource._imageData.data;

            // W2 — axis-aligned 1:1 integer 'repeat' mapping (the desktop wallpaper:
            // a device-space fill of a 'repeat' pattern under an integer translate).
            // The tile ROW is constant across the scanline and the tile COLUMN is an
            // integer that increments and wraps, so the per-pixel transform + modulo +
            // floor + clamp all disappear. Byte-identical to the general branch below:
            // for integer in-range coords _sampleOffset's floor/clamp are no-ops and
            // _repeatCoordinate(v,size) === ((v % size)+size)%size, which is exactly
            // the incrementing/wrapping column index here.
            if (inv !== null && inv.b === 0 && inv.c === 0 && inv.a === 1 && inv.d === 1 &&
                Number.isInteger(inv.e) && Number.isInteger(inv.f) &&
                paintSource._repetition === 'repeat') {
                const tw = paintSource._imageData.width;
                const th = paintSource._imageData.height;
                let ry = (y + inv.f) % th; if (ry < 0) ry += th;
                const rowBase = ry * tw * 4;
                let cx = (startX + inv.e) % tw; if (cx < 0) cx += tw;
                for (let x = startX; x <= endX; x++) {
                    if (!(clipMask && clipMask.isPixelClipped(x, y))) {
                        const so = rowBase + cx * 4;
                        let sa = Math.round(pdata[so + 3] * globalAlpha);
                        if (subPixelOpacity < 1.0) sa = Math.round(sa * subPixelOpacity);
                        if (sa !== 0) {
                            const sr = pdata[so], sg = pdata[so + 1], sb = pdata[so + 2];
                            const offset = y * stride + x * 4;
                            if (sa === 255) {
                                data[offset] = sr;
                                data[offset + 1] = sg;
                                data[offset + 2] = sb;
                                data[offset + 3] = 255;
                            } else {
                                const dstA = data[offset + 3];
                                if (dstA === 0) {
                                    data[offset] = sr;
                                    data[offset + 1] = sg;
                                    data[offset + 2] = sb;
                                    data[offset + 3] = sa;
                                } else {
                                    const srcAlpha = sa / 255;
                                    const invSrcAlpha = 1 - srcAlpha;
                                    data[offset] = Math.round(sr * srcAlpha + data[offset] * invSrcAlpha);
                                    data[offset + 1] = Math.round(sg * srcAlpha + data[offset + 1] * invSrcAlpha);
                                    data[offset + 2] = Math.round(sb * srcAlpha + data[offset + 2] * invSrcAlpha);
                                    data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                                }
                            }
                        }
                    }
                    if (++cx === tw) cx = 0; // advance the tile column, tracking device x
                }
                return;
            }

            // W1 — general hoisted-inverse pattern fill (rotated / scaled / fractional
            // translate / non-'repeat'): still one inversion per span, sampled by offset.
            for (let x = startX; x <= endX; x++) {
                if (clipMask && clipMask.isPixelClipped(x, y)) continue;
                const so = paintSource.sampleOffsetWithInverse(inv, x, y);
                if (so < 0) continue; // transparent sample → dest unchanged
                // withGlobalAlpha (+ sub-pixel opacity for thin strokes), matching
                // _evaluatePaintSource: alpha only, source channels untouched.
                let sa = Math.round(pdata[so + 3] * globalAlpha);
                if (subPixelOpacity < 1.0) sa = Math.round(sa * subPixelOpacity);
                if (sa === 0) continue;
                const sr = pdata[so], sg = pdata[so + 1], sb = pdata[so + 2];
                const offset = y * stride + x * 4;
                if (sa === 255) {
                    data[offset] = sr;
                    data[offset + 1] = sg;
                    data[offset + 2] = sb;
                    data[offset + 3] = 255;
                } else {
                    const dstA = data[offset + 3];
                    if (dstA === 0) {
                        data[offset] = sr;
                        data[offset + 1] = sg;
                        data[offset + 2] = sb;
                        data[offset + 3] = sa;
                    } else {
                        const srcAlpha = sa / 255;
                        const invSrcAlpha = 1 - srcAlpha;
                        data[offset] = Math.round(sr * srcAlpha + data[offset] * invSrcAlpha);
                        data[offset + 1] = Math.round(sg * srcAlpha + data[offset + 1] * invSrcAlpha);
                        data[offset + 2] = Math.round(sb * srcAlpha + data[offset + 2] * invSrcAlpha);
                        data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                    }
                }
            }
            return;
        }

        // General path: gradients/patterns, non-source-over, or canvas-wide (sourceMask) ops.
        for (let x = startX; x <= endX; x++) {
            // Check stencil buffer clipping
            if (clipMask && clipMask.isPixelClipped(x, y)) {
                continue; // Skip pixels clipped by stencil buffer
            }

            // Record source coverage if sourceMask is provided
            if (sourceMask) {
                sourceMask.setPixel(x, y, true);
                // For canvas-wide compositing operations, only build source mask - don't draw to surface
                continue;
            }

            // Evaluate paint source at pixel position (hoisted for solid colors)
            const pixelColor = solidColor !== null
                ? solidColor
                : PolygonFiller._evaluatePaintSource(
                    paintSource,
                    x,
                    y,
                    transform,
                    globalAlpha,
                    subPixelOpacity
                );

            const offset = y * stride + x * 4;
            PolygonFiller._blendPixel(surface, offset, pixelColor, composite);
        }
    }

    /**
     * Blend a color into a surface pixel using specified composite operation
     * @param {Surface} surface - Target surface
     * @param {number} offset - Byte offset in surface data
     * @param {Color} color - Source color to blend
     * @param {string} composite - Composite operation (default: 'source-over')
     * @private
     */
    static _blendPixel(surface, offset, color, composite = 'source-over') {
        // Get destination pixel
        const dstR = surface.data[offset];
        const dstG = surface.data[offset + 1];
        const dstB = surface.data[offset + 2];
        const dstA = surface.data[offset + 3];

        // Use CompositeOperations for blending
        const result = CompositeOperations.blendPixel(
            composite,
            color.r,
            color.g,
            color.b,
            color.a, // source
            dstR,
            dstG,
            dstB,
            dstA // destination
        );

        // Store result
        surface.data[offset] = result.r;
        surface.data[offset + 1] = result.g;
        surface.data[offset + 2] = result.b;
        surface.data[offset + 3] = result.a;
    }

    /**
     * Utility method to convert old-style RGBA array to Color instance
     * Maintains backward compatibility during transition
     * @param {Array} rgba - [r, g, b, a] array (0-255, non-premultiplied)
     * @returns {Color} Color instance
     */
    static colorFromRGBA(rgba) {
        return new Color(rgba[0], rgba[1], rgba[2], rgba[3], false);
    }

    /**
     * Debug method to visualize polygon bounds
     * @param {Array} polygons - Polygons to analyze
     * @returns {Object} Bounding box information
     */
    static getPolygonBounds(polygons) {
        if (polygons.length === 0) {
            return new Rectangle(0, 0, 0, 0);
        }

        const points = polygons.flat();
        return Rectangle.boundingBox(points.map(p => new Point(p.x, p.y)));
    }

    /**
     * Performance utility to count total vertices in polygon set
     * @param {Array} polygons - Polygons to count
     * @returns {number} Total vertex count
     */
    static countVertices(polygons) {
        return polygons.reduce((total, poly) => total + poly.length, 0);
    }

    /**
     * Validate paint source type
     * @param {*} paintSource - Object to validate
     * @returns {boolean} True if valid paint source
     * @private
     */
    static _isValidPaintSource(paintSource) {
        return (
            paintSource instanceof Color ||
            paintSource instanceof Gradient ||
            paintSource instanceof LinearGradient ||
            paintSource instanceof RadialGradient ||
            paintSource instanceof ConicGradient ||
            paintSource instanceof Pattern
        );
    }

    /**
     * Evaluate paint source at a pixel position
     * @param {Color|Gradient|Pattern} paintSource - Paint source to evaluate
     * @param {number} x - Pixel x coordinate
     * @param {number} y - Pixel y coordinate
     * @param {Transform2D} transform - Current canvas transform
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @returns {Color} Color for this pixel
     * @private
     */
    static _evaluatePaintSource(paintSource, x, y, transform, globalAlpha, subPixelOpacity = 1.0) {
        let color;
        if (paintSource instanceof Color) {
            color = paintSource;
        } else if (
            paintSource instanceof Gradient ||
            paintSource instanceof LinearGradient ||
            paintSource instanceof RadialGradient ||
            paintSource instanceof ConicGradient
        ) {
            color = paintSource.getColorForPixel(x, y, transform);
        } else if (paintSource instanceof Pattern) {
            color = paintSource.getColorForPixel(x, y, transform);
        } else {
            // Fallback to transparent black
            color = Color.transparent;
        }

        // Apply global alpha and sub-pixel opacity
        let resultColor = color.withGlobalAlpha(globalAlpha);

        // Apply sub-pixel opacity for thin strokes
        if (subPixelOpacity < 1.0) {
            const adjustedAlpha = Math.round(resultColor.a * subPixelOpacity);
            resultColor = new Color(
                resultColor.r,
                resultColor.g,
                resultColor.b,
                adjustedAlpha,
                resultColor.premultiplied
            );
        }

        return resultColor;
    }

    /**
     * Test if a point is inside a set of polygons using the specified fill rule
     * @param {number} x - X coordinate of the point
     * @param {number} y - Y coordinate of the point
     * @param {Array<Array<Object>>} polygons - Array of polygons, each polygon is array of {x, y} points
     * @param {string} fillRule - Fill rule: 'nonzero' or 'evenodd'
     * @returns {boolean} True if point is inside the polygon set
     * @static
     */
    static isPointInPolygons(x, y, polygons, fillRule = 'nonzero') {
        if (polygons.length === 0) return false;

        const epsilon = FLOAT_EPSILON;

        // First check if point is exactly on any edge (HTML5 Canvas inclusive behavior)
        for (const polygon of polygons) {
            if (polygon.length < 3) continue;

            for (let i = 0; i < polygon.length; i++) {
                const p1 = polygon[i];
                const p2 = polygon[(i + 1) % polygon.length];

                // Check if point lies on this edge
                if (PolygonFiller._isPointOnEdge(x, y, p1, p2, epsilon)) {
                    return true; // HTML5 Canvas treats points on edges as inside
                }
            }
        }

        let windingNumber = 0;

        // Cast horizontal ray from point to the right
        // Count intersections with polygon edges
        for (const polygon of polygons) {
            if (polygon.length < 3) continue; // Skip degenerate polygons

            for (let i = 0; i < polygon.length; i++) {
                const p1 = polygon[i];
                const p2 = polygon[(i + 1) % polygon.length];

                // Skip horizontal edges (no intersection with horizontal ray)
                if (Math.abs(p1.y - p2.y) < epsilon) continue;

                // Check if ray crosses this edge
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);

                // Ray is at y level, check if it intersects the edge
                if (y >= minY && y < maxY) {
                    // Note: < maxY to avoid double-counting vertices
                    // Calculate intersection point using linear interpolation
                    const t = (y - p1.y) / (p2.y - p1.y);
                    const intersectionX = p1.x + t * (p2.x - p1.x);

                    // Only count intersections to the right of our point
                    // Use >= to handle edge case where intersection is exactly at x
                    if (intersectionX >= x) {
                        // Determine winding direction
                        const winding = p2.y > p1.y ? 1 : -1;
                        windingNumber += winding;
                    }
                }
            }
        }

        // Apply fill rule to determine if point is inside
        if (fillRule === 'evenodd') {
            return windingNumber % 2 !== 0;
        } else {
            // nonzero
            return windingNumber !== 0;
        }
    }

    /**
     * Check if a point lies exactly on a line segment (edge)
     * @param {number} px - Point x coordinate
     * @param {number} py - Point y coordinate
     * @param {Object} p1 - First endpoint {x, y}
     * @param {Object} p2 - Second endpoint {x, y}
     * @param {number} epsilon - Tolerance for floating point comparison
     * @returns {boolean} True if point is on the edge
     * @private
     */
    static _isPointOnEdge(px, py, p1, p2, epsilon) {
        // Handle degenerate case where p1 and p2 are the same point
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const edgeLength = Math.sqrt(dx * dx + dy * dy);

        if (edgeLength < epsilon) {
            // Degenerate edge - check if point is at the same location
            return Math.abs(px - p1.x) < epsilon && Math.abs(py - p1.y) < epsilon;
        }

        // Vector from p1 to test point
        const dpx = px - p1.x;
        const dpy = py - p1.y;

        // Check if point is collinear with the edge using cross product
        const crossProduct = Math.abs(dpx * dy - dpy * dx);
        const lineDistanceThreshold = epsilon * edgeLength; // Scale epsilon by edge length
        if (crossProduct > lineDistanceThreshold) {
            return false; // Not on the line containing the edge
        }

        // Check if point is within the bounds of the edge segment
        const dotProduct = dpx * dx + dpy * dy;
        const lengthSquared = dx * dx + dy * dy;

        // Parameter t where point = p1 + t * (p2 - p1)
        // Point is on segment if 0 <= t <= 1
        const t = dotProduct / lengthSquared;
        return t >= -epsilon && t <= 1 + epsilon;
    }

    /**
     * Fill polygons directly into a ClipMask for clipping operations.
     * Uses scanline algorithm identical to surface filling, but writes to 1-bit stencil buffer.
     * This centralizes clip buffer filling logic that was previously duplicated in Context2D.
     *
     * @param {ClipMask} clipMask - Target clip mask to render to
     * @param {Array} polygons - Array of polygons (each polygon is array of {x,y} points)
     * @param {string} fillRule - 'nonzero' or 'evenodd' winding rule
     * @param {Transform2D} transform - Transformation matrix to apply to polygons
     */
    static fillPolygonsToClipMask(clipMask, polygons, fillRule, transform) {
        if (polygons.length === 0) return;

        const width = clipMask.width;
        const height = clipMask.height;

        // Transform all polygon vertices
        const transformedPolygons = polygons.map(poly => poly.map(point => transform.transformPoint(point)));

        // Find bounding box
        let minY = Infinity,
            maxY = -Infinity;
        for (const poly of transformedPolygons) {
            for (const point of poly) {
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }
        }

        // Clamp to clip mask bounds
        minY = Math.max(0, Math.floor(minY));
        maxY = Math.min(height - 1, Math.ceil(maxY));

        // Process each scanline
        for (let y = minY; y <= maxY; y++) {
            const intersections = [];

            // Find all intersections with this scanline (reuse existing method)
            for (const poly of transformedPolygons) {
                PolygonFiller._findPolygonIntersections(poly, y + 0.5, intersections);
            }

            // Sort intersections by x coordinate
            intersections.sort((a, b) => a.x - b.x);

            // Fill spans to clip mask
            PolygonFiller._fillClipMaskSpans(clipMask, y, intersections, fillRule, width);
        }
    }

    /**
     * Fill spans on a scanline into a ClipMask based on winding rule
     * @param {ClipMask} clipMask - Target clip mask
     * @param {number} y - Scanline y coordinate
     * @param {Array} intersections - Sorted intersections with winding info
     * @param {string} fillRule - 'evenodd' or 'nonzero'
     * @param {number} width - Surface width for bounds clamping
     * @private
     */
    static _fillClipMaskSpans(clipMask, y, intersections, fillRule, width) {
        if (intersections.length === 0) return;

        let windingNumber = 0;
        let inside = false;

        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];
            const nextIntersection = intersections[i + 1];

            // Update winding number
            windingNumber += intersection.winding;

            // Determine if we're inside based on fill rule
            if (fillRule === 'evenodd') {
                inside = windingNumber % 2 !== 0;
            } else {
                // nonzero
                inside = windingNumber !== 0;
            }

            // Fill span if we're inside
            if (inside && nextIntersection) {
                // Pixel-center sampling on X, to match the scanline's Y
                // convention: scanlines are sampled at y+0.5 with a half-open
                // [minY, maxY) edge test, so a column x belongs to the span
                // [left, right) iff its center x+0.5 lies inside it
                // (left <= x+0.5 < right). The previous ceil(left)..floor(right)
                // form with an INCLUSIVE endX over-included the right-edge
                // column for integer-aligned edges: a clip rect [5,25) exposed
                // column 25. That made dirty-rectangle clips one pixel too wide
                // on the right, so vector fills bled into the phantom column
                // while raster (drawImage/text) blits bounded by their own
                // extent did not — leaving 1px "streaks" of erased raster
                // content along the right edge of repainted regions.
                const startX = Math.max(0, Math.ceil(intersection.x - 0.5));
                const endX = Math.min(width - 1, Math.ceil(nextIntersection.x - 0.5) - 1);

                for (let x = startX; x <= endX; x++) {
                    clipMask.setPixel(x, y, true); // Set pixel to visible
                }
            }
        }
    }
}

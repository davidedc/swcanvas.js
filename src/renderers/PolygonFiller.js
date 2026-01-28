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
    static fillPolygons(surface, polygons, paintSource, fillRule, transform, clipMask, globalAlpha = 1.0, subPixelOpacity = 1.0, composite = 'source-over', sourceMask = null) {
        if (polygons.length === 0) return;
        if (IS_DEBUG) {
            if (!PolygonFiller._isValidPaintSource(paintSource)) {
                throw new Error('Paint source must be a Color, Gradient, or Pattern instance');
            }
        }

        // Check if we can use direct rendering (opaque solid color with source-over)
        const canUseDirectRendering =
            paintSource instanceof Color &&
            paintSource.a === 255 &&
            globalAlpha >= 1.0 &&
            subPixelOpacity >= 1.0 &&
            composite === 'source-over' &&
            sourceMask === null;

        if (canUseDirectRendering) {
            PolygonFiller._fillPolygonsDirect(surface, polygons, paintSource, fillRule, transform, clipMask);
        } else {
            PolygonFiller._fillPolygonsStandard(surface, polygons, paintSource, fillRule, transform, clipMask, globalAlpha, subPixelOpacity, composite, sourceMask);
        }
    }

    /**
     * Direct rendering for opaque solid color fills with source-over compositing
     * Uses 32-bit packed writes and inline clip buffer access for maximum performance
     * @private
     */
    static _fillPolygonsDirect(surface, polygons, color, fillRule, transform, clipMask) {
        // Pre-compute packed color outside hot loop
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);
        const data32 = surface.data32;
        const width = surface.width;
        const clipBuffer = clipMask ? clipMask.buffer : null;

        // Transform all polygon vertices
        const transformedPolygons = polygons.map(poly =>
            poly.map(point => transform.transformPoint(point))
        );

        // Find bounding box
        const bounds = PolygonFiller._calculateBounds(transformedPolygons, surface);

        // Process each scanline
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
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
                    inside = (windingNumber % 2) !== 0;
                } else {
                    inside = windingNumber !== 0;
                }

                if (inside && nextIntersection) {
                    const startX = Math.max(0, Math.ceil(intersection.x));
                    const endX = Math.min(width - 1, Math.floor(nextIntersection.x));

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
                            // No clipping - optimized path with direct 32-bit writes
                            for (; pixelIndex < endIndex; pixelIndex++) {
                                data32[pixelIndex] = packedColor;
                            }
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
    static _fillPolygonsStandard(surface, polygons, paintSource, fillRule, transform, clipMask, globalAlpha, subPixelOpacity, composite, sourceMask) {
        // Mark path-based rendering for testing (helps verify direct rendering is used when expected)
        // Check for Context2D existence since PolygonFiller may be used in isolation (e.g., unit tests)
        if (typeof Context2D !== 'undefined' && Context2D._markPathBasedRendering) {
            Context2D._markPathBasedRendering();
        }

        // Transform all polygon vertices
        const transformedPolygons = polygons.map(poly =>
            poly.map(point => transform.transformPoint(point))
        );

        // Find bounding box for optimization
        const bounds = PolygonFiller._calculateBounds(transformedPolygons, surface);

        // Process each scanline
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            PolygonFiller._fillScanline(
                surface, y, transformedPolygons, paintSource, fillRule, clipMask, transform, globalAlpha, subPixelOpacity, composite, sourceMask
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
        let minY = Infinity, maxY = -Infinity;

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
    static _fillScanline(surface, y, polygons, paintSource, fillRule, clipMask, transform, globalAlpha, subPixelOpacity = 1.0, composite = 'source-over', sourceMask = null) {
        const intersections = [];

        // Find all intersections with this scanline
        for (const poly of polygons) {
            PolygonFiller._findPolygonIntersections(poly, y + 0.5, intersections);
        }

        // Sort intersections by x coordinate
        intersections.sort((a, b) => a.x - b.x);

        // Fill spans based on winding rule
        PolygonFiller._fillSpans(surface, y, intersections, paintSource, fillRule, clipMask, transform, globalAlpha, subPixelOpacity, composite, sourceMask);
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

            if (y >= minY && y < maxY) { // Note: < maxY to avoid double-counting vertices
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
    static _fillSpans(surface, y, intersections, paintSource, fillRule, clipMask, transform, globalAlpha, subPixelOpacity = 1.0, composite = 'source-over', sourceMask = null) {
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
                inside = (windingNumber % 2) !== 0;
            } else { // nonzero
                inside = windingNumber !== 0;
            }

            // Fill span if we're inside
            if (inside && nextIntersection) {
                const startX = Math.max(0, Math.ceil(intersection.x));
                const endX = Math.min(surface.width - 1, Math.floor(nextIntersection.x));

                PolygonFiller._fillPixelSpan(
                    surface, y, startX, endX, paintSource, clipMask, transform, globalAlpha, subPixelOpacity, composite, sourceMask
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
    static _fillPixelSpan(surface, y, startX, endX, paintSource, clipMask, transform, globalAlpha, subPixelOpacity = 1.0, composite = 'source-over', sourceMask = null) {
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

            // Evaluate paint source at pixel position
            const pixelColor = PolygonFiller._evaluatePaintSource(paintSource, x, y, transform, globalAlpha, subPixelOpacity);

            const offset = y * surface.stride + x * 4;
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
            color.r, color.g, color.b, color.a,  // source
            dstR, dstG, dstB, dstA               // destination
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
        return paintSource instanceof Color ||
            paintSource instanceof Gradient ||
            paintSource instanceof LinearGradient ||
            paintSource instanceof RadialGradient ||
            paintSource instanceof ConicGradient ||
            paintSource instanceof Pattern;
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
        } else if (paintSource instanceof Gradient ||
            paintSource instanceof LinearGradient ||
            paintSource instanceof RadialGradient ||
            paintSource instanceof ConicGradient) {
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
            resultColor = new Color(resultColor.r, resultColor.g, resultColor.b, adjustedAlpha, resultColor.premultiplied);
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
                if (y >= minY && y < maxY) { // Note: < maxY to avoid double-counting vertices
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
            return (windingNumber % 2) !== 0;
        } else { // nonzero
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
        const transformedPolygons = polygons.map(poly =>
            poly.map(point => transform.transformPoint(point))
        );

        // Find bounding box
        let minY = Infinity, maxY = -Infinity;
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
                inside = (windingNumber % 2) !== 0;
            } else { // nonzero
                inside = windingNumber !== 0;
            }

            // Fill span if we're inside
            if (inside && nextIntersection) {
                const startX = Math.max(0, Math.ceil(intersection.x));
                const endX = Math.min(width - 1, Math.floor(nextIntersection.x));

                for (let x = startX; x <= endX; x++) {
                    clipMask.setPixel(x, y, true); // Set pixel to visible
                }
            }
        }
    }
}
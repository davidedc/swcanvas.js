/**
 * PolygonFiller class for SWCanvas
 *
 * Implements scanline polygon filling with nonzero and evenodd winding rules.
 * Handles stencil-based clipping integration and alpha blending onto the
 * surface's straight (non-premultiplied) RGBA.
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
    // The active-edge scan's scratch (_beginScan): grown on demand, shared by every fill
    static _scanScratch = null;

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
     * @param {{x0,y0,x1,y1}|null} clipRect - Optional half-open device clip rect
     * @param {{x: number, y: number}|null} origin - For a stroke's parts, the integer user point they
     *   are relative to (StrokeGenerator's anchor): they are then filled in their device frame
     *   (_toDeviceFrame). Null for absolute polygons, transformed as given
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
        clipRect = null,
        origin = null
    ) {
        if (polygons.length === 0) return;
        if (IS_DEBUG) {
            if (!PolygonFiller._isValidPaintSource(paintSource)) {
                throw new Error('Paint source must be a Color, Gradient, or Pattern instance');
            }
        }

        // Clip = clipMask AND clipRect (either may be null). clipRect clamps the
        // scanline range (Y, via bounds) and each span (X); any clipMask is then
        // still tested per pixel, so the pixels written are exactly mask ∧ rect.
        // Check if we can use direct rendering (opaque solid color with source-over)
        const canUseDirectRendering =
            paintSource instanceof Color &&
            paintSource.a === 255 &&
            globalAlpha >= 1.0 &&
            subPixelOpacity >= 1.0 &&
            composite === 'source-over' &&
            sourceMask === null;

        if (canUseDirectRendering) {
            PolygonFiller._fillPolygonsDirect(
                surface,
                polygons,
                paintSource,
                fillRule,
                transform,
                clipMask,
                clipRect,
                origin
            );
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
                clipRect,
                origin
            );
        }
    }

    /**
     * Where a shape anchored at the integer user point (ux, uy) lands in device space: the device
     * pixel (ox, oy) at or below the anchor's image and the remainder (rx, ry) in [0, 1), so that a
     * user point p of the shape lies at (ox, oy) + A (p - (ux, uy)) + (rx, ry), A being the
     * transform's linear part (see _toDeviceFrame)
     * @param {Transform2D} transform - User to device
     * @param {number} ux - Anchor x (an integer)
     * @param {number} uy - Anchor y (an integer)
     * @returns {{ox: number, oy: number, rx: number, ry: number}}
     */
    static deviceAnchor(transform, ux, uy) {
        const tx = transform.a * ux + transform.c * uy + transform.e;
        const ty = transform.b * ux + transform.d * uy + transform.f;
        let ox = Math.floor(tx);
        let oy = Math.floor(ty);
        if (!Number.isFinite(ox) || !Number.isFinite(oy)) {
            ox = 0;
            oy = 0;
        }
        return { ox, oy, rx: tx - ox, ry: ty - oy };
    }

    /**
     * A stroke's parts in its device FRAME: every vertex as its offset from the integer device
     * pixel (ox, oy) the stroke's integer user anchor lands at (deviceAnchor), computed from the
     * vertex's offset from that anchor - which is what the parts are already given as
     * (StrokeGenerator.generateStrokePolygons). A stroke moved by whole pixels, by a translate() or by
     * its own coordinates, is then computed from the same small numbers wherever it lands: its edges
     * cross every pixel centre the same way, so it covers the same pixels moved by the same whole
     * pixels - also at a TIE, a centre exactly on an edge, which the rounding of a vertex at the
     * stroke's absolute magnitude would otherwise decide. Device row y is frame row y - oy, and a
     * crossing x in the frame starts a run at column ox + ceil(x - 0.5).
     * @param {Array} polygons - The stroke's parts, relative to origin
     * @param {Transform2D} transform - User to device
     * @param {{x: number, y: number}} origin - The integer user point the parts are relative to
     * @returns {{polygons: Array, ox: number, oy: number}}
     * @private
     */
    static _toDeviceFrame(polygons, transform, origin) {
        const anchor = PolygonFiller.deviceAnchor(transform, origin.x, origin.y);
        const a = transform.a;
        const b = transform.b;
        const c = transform.c;
        const d = transform.d;
        const rx = anchor.rx;
        const ry = anchor.ry;
        const framed = new Array(polygons.length);
        for (let i = 0; i < polygons.length; i++) {
            const poly = polygons[i];
            const out = new Array(poly.length);
            for (let j = 0; j < poly.length; j++) {
                const px = poly[j].x;
                const py = poly[j].y;
                out[j] = { x: a * px + c * py + rx, y: b * px + d * py + ry };
            }
            framed[i] = out;
        }
        return { polygons: framed, ox: anchor.ox, oy: anchor.oy };
    }

    /**
     * Whether device point (x, y) is inside a stroke's parts (nonzero), decided in the device frame
     * the stroke is filled in (_toDeviceFrame), so the answer agrees with the stroke's pixels
     * @param {number} x - Device x
     * @param {number} y - Device y
     * @param {Array} polygons - The stroke's parts, relative to origin
     * @param {Transform2D} transform - User to device
     * @param {{x: number, y: number}} origin - The integer user point the parts are relative to
     * @returns {boolean} True if the point is inside the stroke
     */
    static isPointInStrokePolygons(x, y, polygons, transform, origin) {
        const frame = PolygonFiller._toDeviceFrame(polygons, transform, origin);
        return PolygonFiller.isPointInPolygons(x - frame.ox, y - frame.oy, frame.polygons, 'nonzero');
    }

    /**
     * Direct rendering for opaque solid color fills with source-over compositing
     * Uses 32-bit packed writes and inline clip buffer access for maximum performance
     * @private
     */
    static _fillPolygonsDirect(
        surface,
        polygons,
        color,
        fillRule,
        transform,
        clipMask,
        clipRect = null,
        origin = null
    ) {
        // Pre-compute packed color outside hot loop
        const packedColor = Surface.packColor(color.r, color.g, color.b, 255);
        const data32 = surface.data32;
        const width = surface.width;
        const clipBuffer = clipMask ? clipMask.buffer : null;
        // Clip rect: half-open [x0,x1)×[y0,y1); clamp span X and scanline Y.
        const clipX0 = clipRect ? clipRect.x0 : 0;
        const clipX1m1 = clipRect ? clipRect.x1 - 1 : (width - 1);

        // Transform all polygon vertices - a stroke's parts into its device frame, rows and columns
        // counted from (ox, oy) (_toDeviceFrame)
        const frame = origin === null ? null : PolygonFiller._toDeviceFrame(polygons, transform, origin);
        const transformedPolygons =
            frame === null ? polygons.map(poly => poly.map(point => transform.transformPoint(point))) : frame.polygons;
        const ox = frame === null ? 0 : frame.ox;
        const oy = frame === null ? 0 : frame.oy;

        // Find bounding box
        const bounds = PolygonFiller._calculateBounds(transformedPolygons, surface, oy);
        let scanMinY = bounds.minY, scanMaxY = bounds.maxY;
        if (clipRect) {
            if (clipRect.y0 > scanMinY) scanMinY = clipRect.y0;
            if (clipRect.y1 - 1 < scanMaxY) scanMaxY = clipRect.y1 - 1;
        }

        // Process each scanline: its crossings, sorted, from the active edges only
        const scan = PolygonFiller._beginScan(transformedPolygons, scanMinY - oy, scanMaxY - oy);
        const crossX = scan.cx;
        const crossW = scan.cw;
        for (let y = scanMinY; y <= scanMaxY; y++) {
            const count = PolygonFiller._scanRow(scan, y - oy);

            // Fill spans using optimized rendering
            let windingNumber = 0;
            let inside = false;

            for (let i = 0; i < count; i++) {
                windingNumber += crossW[i];

                if (fillRule === 'evenodd') {
                    inside = windingNumber % 2 !== 0;
                } else {
                    inside = windingNumber !== 0;
                }

                if (inside && i + 1 < count) {
                    // Pixel-center sampling on X (see _fillClipMaskSpans for the
                    // full rationale): a column x is in span [left, right) iff
                    // its center x+0.5 is inside it (left <= x+0.5 < right). This
                    // is the opaque-solid-color fast path; the old
                    // ceil(left)..floor(right) inclusive endX made a path-filled
                    // rect 1px wider on the right than fillRect / clip / drawImage
                    // / HTML5.
                    let startX = Math.max(0, ox + Math.ceil(crossX[i] - 0.5));
                    let endX = Math.min(width - 1, ox + Math.ceil(crossX[i + 1] - 0.5) - 1);
                    // Clip rect: clamp the span to the clip rect's X range; the
                    // clipBuffer (if any) is still tested per pixel below.
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
        clipRect = null,
        origin = null
    ) {
        // Mark path-based rendering for testing (helps verify direct rendering is used when expected)
        // Check for Context2D existence since PolygonFiller may be used in isolation (e.g., unit tests)
        if (typeof Context2D !== 'undefined' && Context2D._markPathBasedRendering) {
            Context2D._markPathBasedRendering();
        }

        // Transform all polygon vertices - a stroke's parts into its device frame, rows and columns
        // counted from (ox, oy) (_toDeviceFrame)
        const frame = origin === null ? null : PolygonFiller._toDeviceFrame(polygons, transform, origin);
        const transformedPolygons =
            frame === null ? polygons.map(poly => poly.map(point => transform.transformPoint(point))) : frame.polygons;
        const ox = frame === null ? 0 : frame.ox;
        const oy = frame === null ? 0 : frame.oy;

        // Find bounding box for optimization
        const bounds = PolygonFiller._calculateBounds(transformedPolygons, surface, oy);
        let scanMinY = bounds.minY, scanMaxY = bounds.maxY;
        if (clipRect) { // only scanlines inside the clip rect's Y range
            if (clipRect.y0 > scanMinY) scanMinY = clipRect.y0;
            if (clipRect.y1 - 1 < scanMaxY) scanMaxY = clipRect.y1 - 1;
        }

        // Process each scanline: its crossings, sorted, from the active edges only
        const scan = PolygonFiller._beginScan(transformedPolygons, scanMinY - oy, scanMaxY - oy);
        for (let y = scanMinY; y <= scanMaxY; y++) {
            PolygonFiller._fillSpans(
                surface,
                y,
                scan.cx,
                scan.cw,
                PolygonFiller._scanRow(scan, y - oy),
                paintSource,
                fillRule,
                clipMask,
                transform,
                globalAlpha,
                subPixelOpacity,
                composite,
                sourceMask,
                clipRect,
                ox
            );
        }
    }

    /**
     * Calculate bounding box for transformed polygons
     * @param {Array} polygons - Transformed polygons (a stroke's in its device frame)
     * @param {Surface} surface - Target surface for bounds clamping
     * @param {number} oy - The device row the polygons' y is counted from (0, or a frame's oy)
     * @returns {Object} {minY, maxY} bounds, device rows
     * @private
     */
    static _calculateBounds(polygons, surface, oy) {
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
            minY: Math.max(0, oy + Math.floor(minY)),
            maxY: Math.min(surface.height - 1, oy + Math.ceil(maxY))
        };
    }

    /**
     * Start an active-edge scan of device polygons over rows [y0, y1]. Every non-horizontal
     * edge goes into an edge table (structure of arrays, in polygon order then edge order) with
     * its UPPER end, its extent and its winding, and the table is ordered by the first row
     * whose sample y + 0.5 can reach the edge. An edge no row in [y0, y1] can cross is left
     * out. The scratch arrays are kept between calls and only ever grow.
     * @param {Array} polygons - Device-space polygons
     * @param {number} y0 - First row
     * @param {number} y1 - Last row
     * @returns {Object} The scan state, read by _scanRow
     * @private
     */
    static _beginScan(polygons, y0, y1) {
        let vertices = 0;
        for (const poly of polygons) vertices += poly.length;
        let scan = PolygonFiller._scanScratch;
        if (scan === null || scan.capacity < vertices) {
            let capacity = 64;
            while (capacity < vertices) capacity *= 2;
            scan = PolygonFiller._scanScratch = {
                capacity,
                ux: new Float64Array(capacity),
                uy: new Float64Array(capacity),
                ly: new Float64Array(capacity),
                dx: new Float64Array(capacity),
                dy: new Float64Array(capacity),
                w: new Int8Array(capacity),
                start: new Float64Array(capacity),
                keys: new Float64Array(capacity),
                order: new Int32Array(capacity),
                active: new Int32Array(capacity),
                waiting: new Int32Array(capacity),
                bx: new Float64Array(capacity),
                bw: new Int8Array(capacity),
                bi: new Int32Array(capacity),
                cx: new Float64Array(capacity),
                cw: new Int8Array(capacity),
                ci: new Int32Array(capacity),
                n: 0,
                next: 0,
                activeCount: 0,
                keptCount: 0
            };
        }
        const ux = scan.ux;
        const uy = scan.uy;
        const ly = scan.ly;
        const dx = scan.dx;
        const dy = scan.dy;
        const w = scan.w;
        const start = scan.start;
        const firstSample = y0 + 0.5;
        const lastSample = y1 + 0.5;
        let n = 0;
        for (const poly of polygons) {
            for (let i = 0; i < poly.length; i++) {
                const p1 = poly[i];
                const p2 = poly[(i + 1) % poly.length];
                // Skip exactly horizontal edges (no crossing, and a zero divisor). A merely
                // NEAR-horizontal one is the only edge covering its sliver [upper.y, lower.y), so a
                // scanline there needs its crossing: skipping it drops the whole row.
                if (p1.y === p2.y) continue;
                // The upper end, whichever way the polygon runs the edge, and the differences
                // _scanRow interpolates with
                let upper, lower;
                if (p2.y > p1.y) {
                    upper = p1;
                    lower = p2;
                    w[n] = 1;
                } else {
                    upper = p2;
                    lower = p1;
                    w[n] = -1;
                }
                // No sample in [y0 + 0.5, y1 + 0.5] lies in [upper.y, lower.y)
                if (lower.y <= firstSample || upper.y > lastSample) continue;
                ux[n] = upper.x;
                uy[n] = upper.y;
                ly[n] = lower.y;
                dx[n] = lower.x - upper.x;
                dy[n] = lower.y - upper.y;
                // floor(upper.y - 0.5) is never later than the first row whose sample reaches
                // the edge (rounding is monotonic), so the edge is active by then; _scanRow
                // still tests the exact half-open condition
                const first = Math.floor(upper.y - 0.5);
                start[n] = first < y0 ? y0 : first;
                n++;
            }
        }
        // Order by first row, ties by table position. A few edges (a rect has two): a stable
        // insertion sort; many: keys first * 2^k + index, sorted numerically
        const order = scan.order;
        if (n <= 32) {
            for (let e = 0; e < n; e++) {
                let j = e;
                while (j > 0 && start[order[j - 1]] > start[e]) {
                    order[j] = order[j - 1];
                    j--;
                }
                order[j] = e;
            }
        } else {
            let span = 1;
            while (span <= n) span *= 2;
            const keys = scan.keys;
            for (let e = 0; e < n; e++) keys[e] = (start[e] - y0) * span + e;
            const sorted = keys.subarray(0, n).sort();
            for (let e = 0; e < n; e++) order[e] = sorted[e] % span;
        }
        scan.n = n;
        scan.next = 0;
        scan.activeCount = 0;
        scan.keptCount = 0;
        return scan;
    }

    /**
     * The crossings of row y with the scanned edges, in scan.cx / scan.cw. The row is sampled at
     * y + 0.5 and an edge crosses it when upper.y <= y + 0.5 < lower.y: half-open, so a vertex
     * between two edges is counted once. The crossing is interpolated from the edge's UPPER end
     * whichever way the polygon runs it, so an edge two polygons share (each traversing it the
     * other way) crosses the row at the bit-identical x: their spans then meet exactly, with no
     * 1-ulp gap for a pixel center lying on the edge to fall into. The crossings are sorted by x
     * and, between equal x, by edge-table order.
     * Only the active edges are visited: those whose first row has come and whose lower end the
     * sample has not passed. The previous row's crossing edges come first, in that row's order,
     * so their insertion sort mostly confirms an order it already has; the edges reached just
     * now are sorted apart and merged in.
     * @param {Object} scan - The state _beginScan returned
     * @param {number} y - Row
     * @returns {number} How many crossings
     * @private
     */
    static _scanRow(scan, y) {
        const sample = y + 0.5;
        const ux = scan.ux;
        const uy = scan.uy;
        const ly = scan.ly;
        const dx = scan.dx;
        const dy = scan.dy;
        const w = scan.w;
        const active = scan.active;
        const order = scan.order;
        const start = scan.start;
        const cx = scan.cx;
        const cw = scan.cw;
        const ci = scan.ci;
        const n = scan.n;
        let next = scan.next;
        let activeCount = scan.activeCount;
        while (next < n && start[order[next]] <= y) active[activeCount++] = order[next++];
        scan.next = next;

        // Visit the active edges: drop the passed ones, set aside the ones not reached yet, insert
        // each crossing in (x, table position) order - the previous row's crossing edges into
        // cx/cw/ci, the late ones into bx/bw/bi
        const kept = scan.keptCount;
        const waiting = scan.waiting;
        const bx = scan.bx;
        const bw = scan.bw;
        const bi = scan.bi;
        let pending = 0;
        let count = 0;
        let late = 0;
        for (let k = 0; k < activeCount; k++) {
            const e = active[k];
            if (sample >= ly[e]) continue;
            if (sample < uy[e]) {
                waiting[pending++] = e;
                continue;
            }
            const x = ux[e] + ((sample - uy[e]) / dy[e]) * dx[e];
            if (k < kept) {
                let j = count;
                while (j > 0 && (cx[j - 1] > x || (cx[j - 1] === x && ci[j - 1] > e))) {
                    cx[j] = cx[j - 1];
                    cw[j] = cw[j - 1];
                    ci[j] = ci[j - 1];
                    j--;
                }
                cx[j] = x;
                cw[j] = w[e];
                ci[j] = e;
                count++;
            } else {
                let j = late;
                while (j > 0 && (bx[j - 1] > x || (bx[j - 1] === x && bi[j - 1] > e))) {
                    bx[j] = bx[j - 1];
                    bw[j] = bw[j - 1];
                    bi[j] = bi[j - 1];
                    j--;
                }
                bx[j] = x;
                bw[j] = w[e];
                bi[j] = e;
                late++;
            }
        }
        // Merge the late crossings in, from the back (cx has room for all of them)
        if (late > 0) {
            let a = count - 1;
            let b = late - 1;
            let out = count + late - 1;
            while (b >= 0) {
                if (a >= 0 && (cx[a] > bx[b] || (cx[a] === bx[b] && ci[a] > bi[b]))) {
                    cx[out] = cx[a];
                    cw[out] = cw[a];
                    ci[out] = ci[a];
                    a--;
                } else {
                    cx[out] = bx[b];
                    cw[out] = bw[b];
                    ci[out] = bi[b];
                    b--;
                }
                out--;
            }
            count += late;
        }
        // Next row visits this row's crossing edges in this row's order, then the waiting ones
        for (let j = 0; j < count; j++) active[j] = ci[j];
        for (let j = 0; j < pending; j++) active[count + j] = waiting[j];
        scan.activeCount = count + pending;
        scan.keptCount = count;
        return count;
    }

    /**
     * Fill spans on a scanline based on winding rule
     * @param {Surface} surface - Target surface
     * @param {number} y - Scanline y coordinate
     * @param {Float64Array} crossX - The row's crossings, sorted (see _scanRow)
     * @param {Int8Array} crossW - Their windings
     * @param {number} count - How many crossings
     * @param {Color|Gradient|Pattern} paintSource - Paint source
     * @param {string} fillRule - 'evenodd' or 'nonzero'
     * @param {ClipMask|null} clipMask - Stencil clipping mask
     * @param {Transform2D} transform - Canvas transform (for gradients/patterns)
     * @param {number} globalAlpha - Global alpha value (0-1)
     * @param {number} subPixelOpacity - Sub-pixel opacity for thin strokes (0-1)
     * @param {string} composite - Composite operation
     * @param {SourceMask|null} sourceMask - Optional source coverage mask
     * @param {{x0,y0,x1,y1}|null} clipRect - Optional half-open device clip rect
     * @param {number} ox - The device column crossX is counted from (0, or a frame's ox)
     * @private
     */
    static _fillSpans(
        surface,
        y,
        crossX,
        crossW,
        count,
        paintSource,
        fillRule,
        clipMask,
        transform,
        globalAlpha,
        subPixelOpacity = 1.0,
        composite = 'source-over',
        sourceMask = null,
        clipRect = null,
        ox = 0
    ) {
        if (count === 0) return;
        // Clip rect: clamp each span's X to the clip rect (the caller has already
        // restricted Y to it); any clipMask is still tested per pixel.
        const clipX0 = clipRect ? clipRect.x0 : 0;
        const clipX1m1 = clipRect ? clipRect.x1 - 1 : (surface.width - 1);

        let windingNumber = 0;
        let inside = false;

        for (let i = 0; i < count; i++) {
            // Update winding number
            windingNumber += crossW[i];

            // Determine if we're inside based on fill rule
            if (fillRule === 'evenodd') {
                inside = windingNumber % 2 !== 0;
            } else {
                // nonzero
                inside = windingNumber !== 0;
            }

            // Fill span if we're inside
            if (inside && i + 1 < count) {
                // Pixel-center sampling on X (see _fillClipMaskSpans). This is
                // the standard path (patterns, gradients, alpha<255,
                // non-source-over): the old ceil(left)..floor(right) inclusive
                // endX made e.g. an unclipped desktop PATTERN fill reach one
                // column past the clipped morphs drawn over it. A column x is in
                // [left, right) iff left <= x+0.5 < right.
                let startX = Math.max(0, ox + Math.ceil(crossX[i] - 0.5));
                let endX = Math.min(surface.width - 1, ox + Math.ceil(crossX[i + 1] - 0.5) - 1);
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
        //   dstA===255 -> Math.round(src*a + dst*(1-a)) per channel, a = srcA/255
        //   else       -> the same with dst weighted by its own alpha, over the
        //                 result alpha (Porter-Duff on straight RGBA)
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
                    } else if (dstA === 255) {
                        data[offset] = Math.round(sr * srcAlpha + data[offset] * invSrcAlpha);
                        data[offset + 1] = Math.round(sg * srcAlpha + data[offset + 1] * invSrcAlpha);
                        data[offset + 2] = Math.round(sb * srcAlpha + data[offset + 2] * invSrcAlpha);
                        data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                    } else {
                        // Both translucent: the destination's colour counts in proportion
                        // to its own alpha (Porter-Duff over straight RGBA).
                        const dstWeight = (dstA / 255) * invSrcAlpha;
                        const outAlpha = srcAlpha + dstWeight;
                        data[offset] = Math.round((sr * srcAlpha + data[offset] * dstWeight) / outAlpha);
                        data[offset + 1] = Math.round((sg * srcAlpha + data[offset + 1] * dstWeight) / outAlpha);
                        data[offset + 2] = Math.round((sb * srcAlpha + data[offset + 2] * dstWeight) / outAlpha);
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
            const map = paintSource.centreMapForDevice(transform);
            const pdata = paintSource._imageData.data;

            // W3 — the mapping RESAMPLES (rotation, skew or a non-unit step) under
            // imageSmoothingEnabled: the filtered arm, decided once per transform
            // (Pattern.isFilteredUnder). The general path below filters through
            // the same Pattern.filterAt; the alpha and source-over
            // arithmetic are W1's.
            if (paintSource.isFilteredUnder(transform)) {
                const texel = paintSource._sampling.texel;
                for (let x = startX; x <= endX; x++) {
                    if (clipMask && clipMask.isPixelClipped(x, y)) continue;
                    if (!paintSource.filterAt(map, x, y, texel)) continue; // transparent → dest unchanged
                    let sa = Math.round(texel.a * globalAlpha);
                    if (subPixelOpacity < 1.0) sa = Math.round(sa * subPixelOpacity);
                    if (sa === 0) continue;
                    const sr = texel.r;
                    const sg = texel.g;
                    const sb = texel.b;
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
                        } else if (dstA === 255) {
                            const srcAlpha = sa / 255;
                            const invSrcAlpha = 1 - srcAlpha;
                            data[offset] = Math.round(sr * srcAlpha + data[offset] * invSrcAlpha);
                            data[offset + 1] = Math.round(sg * srcAlpha + data[offset + 1] * invSrcAlpha);
                            data[offset + 2] = Math.round(sb * srcAlpha + data[offset + 2] * invSrcAlpha);
                            data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                        } else {
                            // Both translucent: the destination's colour counts in proportion
                            // to its own alpha (Porter-Duff over straight RGBA).
                            const srcAlpha = sa / 255;
                            const invSrcAlpha = 1 - srcAlpha;
                            const dstWeight = (dstA / 255) * invSrcAlpha;
                            const outAlpha = srcAlpha + dstWeight;
                            data[offset] = Math.round((sr * srcAlpha + data[offset] * dstWeight) / outAlpha);
                            data[offset + 1] = Math.round((sg * srcAlpha + data[offset + 1] * dstWeight) / outAlpha);
                            data[offset + 2] = Math.round((sb * srcAlpha + data[offset + 2] * dstWeight) / outAlpha);
                            data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                        }
                    }
                }
                return;
            }

            // W2 — axis-aligned 1:1 integer 'repeat' mapping (the desktop wallpaper:
            // a device-space fill of a 'repeat' pattern under an integer translate).
            // The tile ROW is constant across the scanline and the tile COLUMN is an
            // integer that increments and wraps, so the per-pixel transform + modulo +
            // floor + clamp all disappear. Byte-identical to the general branch below:
            // the pixel centre x + 0.5 + e floors to the same integer column, so
            // _sampleOffset's floor/clamp yield exactly the incrementing/wrapping
            // index here (_repeatCoordinate(v,size) === ((v % size)+size)%size).
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
                                } else if (dstA === 255) {
                                    const srcAlpha = sa / 255;
                                    const invSrcAlpha = 1 - srcAlpha;
                                    data[offset] = Math.round(sr * srcAlpha + data[offset] * invSrcAlpha);
                                    data[offset + 1] = Math.round(sg * srcAlpha + data[offset + 1] * invSrcAlpha);
                                    data[offset + 2] = Math.round(sb * srcAlpha + data[offset + 2] * invSrcAlpha);
                                    data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                                } else {
                                    // Both translucent: the destination's colour counts in proportion
                                    // to its own alpha (Porter-Duff over straight RGBA).
                                    const srcAlpha = sa / 255;
                                    const invSrcAlpha = 1 - srcAlpha;
                                    const dstWeight = (dstA / 255) * invSrcAlpha;
                                    const outAlpha = srcAlpha + dstWeight;
                                    data[offset] = Math.round((sr * srcAlpha + data[offset] * dstWeight) / outAlpha);
                                    data[offset + 1] = Math.round(
                                        (sg * srcAlpha + data[offset + 1] * dstWeight) / outAlpha
                                    );
                                    data[offset + 2] = Math.round(
                                        (sb * srcAlpha + data[offset + 2] * dstWeight) / outAlpha
                                    );
                                    data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                                }
                            }
                        }
                    }
                    if (++cx === tw) cx = 0; // advance the tile column, tracking device x
                }
                return;
            }

            // W1 — general hoisted-inverse nearest-neighbour pattern fill (fractional
            // translate / non-'repeat', or any mapping with smoothing off): still one
            // inversion per span, sampled by offset.
            for (let x = startX; x <= endX; x++) {
                if (clipMask && clipMask.isPixelClipped(x, y)) continue;
                const so = paintSource.sampleOffsetAt(map, x, y);
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
                    } else if (dstA === 255) {
                        const srcAlpha = sa / 255;
                        const invSrcAlpha = 1 - srcAlpha;
                        data[offset] = Math.round(sr * srcAlpha + data[offset] * invSrcAlpha);
                        data[offset + 1] = Math.round(sg * srcAlpha + data[offset + 1] * invSrcAlpha);
                        data[offset + 2] = Math.round(sb * srcAlpha + data[offset + 2] * invSrcAlpha);
                        data[offset + 3] = Math.round(sa + dstA * invSrcAlpha);
                    } else {
                        // Both translucent: the destination's colour counts in proportion
                        // to its own alpha (Porter-Duff over straight RGBA).
                        const srcAlpha = sa / 255;
                        const invSrcAlpha = 1 - srcAlpha;
                        const dstWeight = (dstA / 255) * invSrcAlpha;
                        const outAlpha = srcAlpha + dstWeight;
                        data[offset] = Math.round((sr * srcAlpha + data[offset] * dstWeight) / outAlpha);
                        data[offset + 1] = Math.round((sg * srcAlpha + data[offset + 1] * dstWeight) / outAlpha);
                        data[offset + 2] = Math.round((sb * srcAlpha + data[offset + 2] * dstWeight) / outAlpha);
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

                // Skip exactly horizontal edges (no intersection with horizontal ray); a
                // near-horizontal one still owns its sliver of y (see _beginScan)
                if (p1.y === p2.y) continue;

                // Check if ray crosses this edge
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);

                // Ray is at y level, check if it intersects the edge
                if (y >= minY && y < maxY) {
                    // Note: < maxY to avoid double-counting vertices
                    // Calculate intersection point using linear interpolation - from p1, in the
                    // polygon's own order (the fills interpolate from the upper end: _scanRow)
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
     * With `bound`, only pixels inside that half-open device rect are written:
     * scanlines outside [y0, y1) are never visited and every span is clamped to
     * [x0, x1). Span membership is decided per pixel center from the same sorted
     * intersections either way, so the bounded result is exactly the unbounded
     * one ANDed with the rect — the path is just never rasterised where the rect
     * would discard it (Context2D.clip passes its current clip rect here).
     *
     * @param {ClipMask} clipMask - Target clip mask to render to
     * @param {Array} polygons - Array of polygons (each polygon is array of {x,y} points)
     * @param {string} fillRule - 'nonzero' or 'evenodd' winding rule
     * @param {Transform2D} transform - Transformation matrix to apply to polygons
     * @param {{x0,y0,x1,y1}|null} [bound=null] - Optional half-open device rect,
     *   pre-clamped to the mask; null = the whole mask
     */
    static fillPolygonsToClipMask(clipMask, polygons, fillRule, transform, bound = null) {
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

        // Clamp to clip mask bounds (and to the optional bound's rows)
        minY = Math.max(0, Math.floor(minY));
        maxY = Math.min(height - 1, Math.ceil(maxY));
        let spanMinX = 0;
        let spanMaxX = width - 1;
        if (bound) {
            if (bound.y0 > minY) minY = bound.y0;
            if (bound.y1 - 1 < maxY) maxY = bound.y1 - 1;
            spanMinX = bound.x0;
            spanMaxX = bound.x1 - 1;
        }

        // Process each scanline: its crossings, sorted, from the active edges only (the same
        // scan as the surface fills)
        const scan = PolygonFiller._beginScan(transformedPolygons, minY, maxY);
        for (let y = minY; y <= maxY; y++) {
            const count = PolygonFiller._scanRow(scan, y);
            PolygonFiller._fillClipMaskSpans(clipMask, y, scan.cx, scan.cw, count, fillRule, spanMinX, spanMaxX);
        }
    }

    /**
     * Fill spans on a scanline into a ClipMask based on winding rule
     * @param {ClipMask} clipMask - Target clip mask
     * @param {number} y - Scanline y coordinate
     * @param {Float64Array} crossX - The row's crossings, sorted (see _scanRow)
     * @param {Int8Array} crossW - Their windings
     * @param {number} count - How many crossings
     * @param {string} fillRule - 'evenodd' or 'nonzero'
     * @param {number} minX - First writable column (0, or the bound's x0)
     * @param {number} maxX - Last writable column, inclusive (width - 1, or the bound's x1 - 1)
     * @private
     */
    static _fillClipMaskSpans(clipMask, y, crossX, crossW, count, fillRule, minX, maxX) {
        if (count === 0) return;

        let windingNumber = 0;
        let inside = false;

        for (let i = 0; i < count; i++) {
            // Update winding number
            windingNumber += crossW[i];

            // Determine if we're inside based on fill rule
            if (fillRule === 'evenodd') {
                inside = windingNumber % 2 !== 0;
            } else {
                // nonzero
                inside = windingNumber !== 0;
            }

            // Fill span if we're inside
            if (inside && i + 1 < count) {
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
                const startX = Math.max(minX, Math.ceil(crossX[i] - 0.5));
                const endX = Math.min(maxX, Math.ceil(crossX[i + 1] - 0.5) - 1);

                for (let x = startX; x <= endX; x++) {
                    clipMask.setPixel(x, y, true); // Set pixel to visible
                }
            }
        }
    }
}

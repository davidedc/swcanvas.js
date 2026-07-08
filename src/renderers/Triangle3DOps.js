/**
 * Triangle3DOps - Static methods for depth-tested 3D triangle rasterization
 *
 * Low-level screen-space primitives for software 3D rendering, in the spirit
 * of PICO-8's tline: callers run their own 3D pipeline (transform, cull,
 * near-plane clip, project) and hand this class screen-space vertices with
 * inverse depth. The depth test against a DepthBuffer makes interpenetrating
 * geometry render correctly with no polygon sorting.
 *
 * NOT part of the Context2D pipeline: these methods write directly to a
 * Surface + DepthBuffer and deliberately ignore canvas transform, composite
 * modes and paint sources. The optional clipBuffer parameter follows the
 * same convention as SpanOps (1 bit per pixel, 1 = visible, null = no clip).
 *
 * CALL HIERARCHY:
 * ---------------
 * Layer 0 (Foundation): zFlatSpan - depth-tested opaque horizontal span
 * Layer 1 (Primitives): fillTriangleZ - scanline-fills a triangle via zFlatSpan
 *
 * DEPTH CONVENTION (see DepthBuffer):
 * -----------------------------------
 * Vertices carry INVERSE camera-space depth (invZ = 1/z, z > 0 in front of
 * the camera). For a planar triangle 1/z is linear in screen space, so it is
 * interpolated linearly per pixel. Test is strictly greater-than: a pixel is
 * written iff its invZ is greater (nearer) than the stored value.
 *
 * VERTEX CONTRACT:
 * ----------------
 * Callers MUST near-clip geometry before projecting: all three vertices must
 * have z > 0 (invZ > 0, finite coordinates). Vertices may project outside
 * the surface - spans are clamped to surface bounds here.
 *
 * FILL RULE:
 * ----------
 * Samples at integer coordinates with half-open intervals (grid-line
 * convention, consistent with QuadScanOps/PolygonFiller): scanlines cover
 * ceil(yMin) <= y < ceil(yMax), columns cover ceil(xL) <= x < ceil(xR).
 * Adjacent triangles sharing an edge are watertight: no gaps, no
 * double-written pixels.
 *
 * OPACITY:
 * --------
 * packedColor is written as-is (32-bit store, no blending). Use
 * Surface.packColor(r, g, b, 255). Semi-transparent 3D geometry would
 * require depth-sorting and is out of scope for this primitive.
 */
class Triangle3DOps {
    /**
     * Depth-tested opaque horizontal span with linear inverse-depth stepping.
     *
     * BOUNDS CONTRACT (same as SpanOps): trusts the caller.
     *   1. y must be in [0, surfaceHeight)
     *   2. startX must be >= 0 and startX + length <= surfaceWidth
     *   3. length must be > 0
     *
     * CLIPPING CONTRACT: clipping is handled here when clipBuffer is
     * provided (byte-skip for fully clipped bytes, 8-pixel fast path for
     * fully visible bytes). Callers MUST NOT pre-check clipping.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {Float32Array} depthData - DepthBuffer.data (1/z per pixel)
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (integer, >= 0)
     * @param {number} y - Y coordinate of the span (integer, in [0, surfaceHeight))
     * @param {number} length - Span length in pixels (> 0)
     * @param {number} invZ0 - Inverse depth (1/z) at the first pixel
     * @param {number} dInvZdX - Inverse depth increment per pixel (plane gradient)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color (opaque; written without blending)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here; gates color AND depth writes)
     */
    static zFlatSpan(
        data32,
        depthData,
        surfaceWidth,
        surfaceHeight,
        startX,
        y,
        length,
        invZ0,
        dInvZdX,
        packedColor,
        clipBuffer
    ) {
        if (IS_DEBUG) {
            if (y < 0 || y >= surfaceHeight || !Number.isInteger(y)) {
                throw new Error(`Triangle3DOps.zFlatSpan: y out of bounds: y=${y}, surfaceHeight=${surfaceHeight}`);
            }
            if (startX < 0 || !Number.isInteger(startX)) {
                throw new Error(`Triangle3DOps.zFlatSpan: invalid startX=${startX}, must be integer >= 0`);
            }
            if (startX + length > surfaceWidth) {
                throw new Error(
                    `Triangle3DOps.zFlatSpan: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`Triangle3DOps.zFlatSpan: invalid length: ${length}, must be > 0`);
            }
            if (depthData.length !== surfaceWidth * surfaceHeight) {
                throw new Error('Triangle3DOps.zFlatSpan: depthData size does not match surface dimensions');
            }
        }

        let pixelIndex = y * surfaceWidth + startX;
        const endIndex = pixelIndex + length;
        let invZ = invZ0;

        if (clipBuffer) {
            // With clipping - byte-skip fully clipped bytes, fast-path fully
            // visible bytes (3D viewports clipped to a widget are mostly
            // visible, so the 0xFF path is the common one).
            while (pixelIndex < endIndex) {
                const byteIndex = pixelIndex >> 3;
                const bits = clipBuffer[byteIndex];

                if (bits === 0) {
                    // Skip to next byte boundary (up to 8 fully clipped pixels)
                    const step = Math.min(((byteIndex + 1) << 3) - pixelIndex, endIndex - pixelIndex);
                    pixelIndex += step;
                    invZ += step * dInvZdX;
                    continue;
                }

                if (bits === 0xff && (pixelIndex & 7) === 0 && pixelIndex + 8 <= endIndex) {
                    // Fully visible byte - 8 pixels without per-pixel clip tests
                    for (let k = 0; k < 8; k++) {
                        if (invZ > depthData[pixelIndex]) {
                            depthData[pixelIndex] = invZ;
                            data32[pixelIndex] = packedColor;
                        }
                        invZ += dInvZdX;
                        pixelIndex++;
                    }
                    continue;
                }

                // Partial byte - per-pixel test
                if (bits & (1 << (pixelIndex & 7))) {
                    if (invZ > depthData[pixelIndex]) {
                        depthData[pixelIndex] = invZ;
                        data32[pixelIndex] = packedColor;
                    }
                }
                invZ += dInvZdX;
                pixelIndex++;
            }
        } else {
            // No clipping - optimized path
            for (; pixelIndex < endIndex; pixelIndex++) {
                if (invZ > depthData[pixelIndex]) {
                    depthData[pixelIndex] = invZ;
                    data32[pixelIndex] = packedColor;
                }
                invZ += dInvZdX;
            }
        }
    }

    /**
     * Fill a screen-space triangle with depth testing (flat color).
     *
     * Vertices are (x, y, invZ) with invZ = 1/z in camera space (see class
     * docs). Winding order does not matter - backface culling is the
     * caller's job. Degenerate (zero-area) triangles are ignored.
     *
     * @param {Surface} surface - Target surface
     * @param {DepthBuffer} depthBuffer - Depth buffer (must match surface dimensions)
     * @param {number} x0 - Vertex 0 screen X
     * @param {number} y0 - Vertex 0 screen Y
     * @param {number} invZ0 - Vertex 0 inverse depth (1/z, > 0)
     * @param {number} x1 - Vertex 1 screen X
     * @param {number} y1 - Vertex 1 screen Y
     * @param {number} invZ1 - Vertex 1 inverse depth (1/z, > 0)
     * @param {number} x2 - Vertex 2 screen X
     * @param {number} y2 - Vertex 2 screen Y
     * @param {number} invZ2 - Vertex 2 inverse depth (1/z, > 0)
     * @param {number} packedColor - Pre-packed 32-bit RGBA color (opaque)
     * @param {Uint8Array|null} [clipBuffer=null] - Clip mask (CLIPPING: delegated to zFlatSpan)
     */
    static fillTriangleZ(
        surface,
        depthBuffer,
        x0,
        y0,
        invZ0,
        x1,
        y1,
        invZ1,
        x2,
        y2,
        invZ2,
        packedColor,
        clipBuffer = null
    ) {
        if (IS_DEBUG) {
            if (depthBuffer.width !== surface.width || depthBuffer.height !== surface.height) {
                throw new Error(
                    `Triangle3DOps.fillTriangleZ: depth buffer ${depthBuffer.width}×${depthBuffer.height} does not match surface ${surface.width}×${surface.height}`
                );
            }
            if (!(invZ0 > 0 && invZ1 > 0 && invZ2 > 0)) {
                throw new Error(
                    'Triangle3DOps.fillTriangleZ: all vertices must have invZ > 0 (near-clip before projecting)'
                );
            }
        }

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const depthData = depthBuffer.data;

        // Inverse-depth plane gradients (constant over the triangle since
        // 1/z is linear in screen space for planar geometry). area2 is the
        // doubled signed area; zero means degenerate.
        const bx = x1 - x0;
        const by = y1 - y0;
        const cx = x2 - x0;
        const cy = y2 - y0;
        const area2 = bx * cy - cx * by;
        if (area2 === 0) {
            return;
        }
        const invArea2 = 1 / area2;
        const dizB = invZ1 - invZ0;
        const dizC = invZ2 - invZ0;
        const dInvZdX = (dizB * cy - dizC * by) * invArea2;
        const dInvZdY = (bx * dizC - cx * dizB) * invArea2;

        // Sort vertices by Y (only x/y needed below; invZ comes from the plane)
        let xA = x0,
            yA = y0;
        let xB = x1,
            yB = y1;
        let xC = x2,
            yC = y2;
        let tmp;
        if (yA > yB) {
            tmp = xA;
            xA = xB;
            xB = tmp;
            tmp = yA;
            yA = yB;
            yB = tmp;
        }
        if (yA > yC) {
            tmp = xA;
            xA = xC;
            xC = tmp;
            tmp = yA;
            yA = yC;
            yC = tmp;
        }
        if (yB > yC) {
            tmp = xB;
            xB = xC;
            xC = tmp;
            tmp = yB;
            yB = yC;
            yC = tmp;
        }

        // Scanline range: half-open [ceil(yA), ceil(yC)), clamped to surface
        const yStart = Math.max(0, Math.ceil(yA));
        const yEnd = Math.min(height, Math.ceil(yC));
        if (yStart >= yEnd) {
            return;
        }

        // Edge slopes (dx per unit y). Long edge A->C always spans the full
        // Y range (yC > yA guaranteed: area2 !== 0 rules out all-equal Y).
        const slopeAC = (xC - xA) / (yC - yA);
        const slopeAB = yB !== yA ? (xB - xA) / (yB - yA) : 0; // unused when yB === yA
        const slopeBC = yC !== yB ? (xC - xB) / (yC - yB) : 0; // unused when yB === yC

        for (let y = yStart; y < yEnd; y++) {
            // X extents: long edge vs the active short edge (A->B covers
            // yA <= y < yB, B->C covers yB <= y < yC)
            let xL = xA + (y - yA) * slopeAC;
            let xR = y < yB ? xA + (y - yA) * slopeAB : xB + (y - yB) * slopeBC;
            if (xL > xR) {
                tmp = xL;
                xL = xR;
                xR = tmp;
            }

            // Half-open column range [ceil(xL), ceil(xR)), clamped
            const xs = Math.max(0, Math.ceil(xL));
            const xe = Math.min(width, Math.ceil(xR));
            const spanLength = xe - xs;
            if (spanLength <= 0) {
                continue;
            }

            // Inverse depth at the first pixel from the plane equation
            // (evaluated fresh per scanline - no incremental drift down edges)
            const invZRow = invZ0 + (xs - x0) * dInvZdX + (y - y0) * dInvZdY;

            Triangle3DOps.zFlatSpan(
                data32,
                depthData,
                width,
                height,
                xs,
                y,
                spanLength,
                invZRow,
                dInvZdX,
                packedColor,
                clipBuffer
            );
        }
    }

    /**
     * Depth-tested textured horizontal span with affine (u, v) stepping.
     *
     * The direct analog of PICO-8's tline: nearest-neighbor texel fetch with
     * per-pixel u/v increments and mask-based wrap-around addressing. The
     * texel is written AS-IS (32-bit store, no blending, no lighting); the
     * fetch is skipped entirely when the depth test rejects (early-z).
     *
     * BOUNDS CONTRACT: same as zFlatSpan (trusts the caller).
     * CLIPPING CONTRACT: same as zFlatSpan (handled here; gates color AND
     * depth writes; byte-skip + fully-visible fast paths).
     *
     * UV CONTRACT: texel units with u, v >= 0 (truncation via |0 is used,
     * which rounds toward zero — negative coordinates would wrap wrongly).
     * Wrapping is (u & uMask), (v & vMask) — the texture repeats.
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {Float32Array} depthData - DepthBuffer.data (1/z per pixel)
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (integer, >= 0)
     * @param {number} y - Y coordinate of the span (integer, in [0, surfaceHeight))
     * @param {number} length - Span length in pixels (> 0)
     * @param {number} invZ0 - Inverse depth (1/z) at the first pixel
     * @param {number} dInvZdX - Inverse depth increment per pixel
     * @param {number} u0 - Texture u (texels) at the first pixel
     * @param {number} dUdX - u increment per pixel (affine plane gradient)
     * @param {number} v0 - Texture v (texels) at the first pixel
     * @param {number} dVdX - v increment per pixel (affine plane gradient)
     * @param {Uint32Array} tex32 - Packed texels (Texture3D.data32)
     * @param {number} texShift - log2 of texture width (Texture3D.shift)
     * @param {number} uMask - Texture width - 1 (Texture3D.uMask)
     * @param {number} vMask - Texture height - 1 (Texture3D.vMask)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here)
     */
    static zTexturedSpan(
        data32,
        depthData,
        surfaceWidth,
        surfaceHeight,
        startX,
        y,
        length,
        invZ0,
        dInvZdX,
        u0,
        dUdX,
        v0,
        dVdX,
        tex32,
        texShift,
        uMask,
        vMask,
        clipBuffer
    ) {
        if (IS_DEBUG) {
            if (y < 0 || y >= surfaceHeight || !Number.isInteger(y)) {
                throw new Error(`Triangle3DOps.zTexturedSpan: y out of bounds: y=${y}, surfaceHeight=${surfaceHeight}`);
            }
            if (startX < 0 || !Number.isInteger(startX)) {
                throw new Error(`Triangle3DOps.zTexturedSpan: invalid startX=${startX}, must be integer >= 0`);
            }
            if (startX + length > surfaceWidth) {
                throw new Error(
                    `Triangle3DOps.zTexturedSpan: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`Triangle3DOps.zTexturedSpan: invalid length: ${length}, must be > 0`);
            }
            if (tex32.length !== (uMask + 1) * (vMask + 1)) {
                throw new Error('Triangle3DOps.zTexturedSpan: texture size does not match masks');
            }
        }

        let pixelIndex = y * surfaceWidth + startX;
        const endIndex = pixelIndex + length;
        let invZ = invZ0;

        // Sub-texel bias: see zTexturedSpanPersp (guards integer-boundary
        // texel flips from float rounding)
        let u = u0 + 9.5367431640625e-7;
        let v = v0 + 9.5367431640625e-7;

        if (clipBuffer) {
            // With clipping - same three paths as zFlatSpan
            while (pixelIndex < endIndex) {
                const byteIndex = pixelIndex >> 3;
                const bits = clipBuffer[byteIndex];

                if (bits === 0) {
                    const step = Math.min(((byteIndex + 1) << 3) - pixelIndex, endIndex - pixelIndex);
                    pixelIndex += step;
                    invZ += step * dInvZdX;
                    u += step * dUdX;
                    v += step * dVdX;
                    continue;
                }

                if (bits === 0xff && (pixelIndex & 7) === 0 && pixelIndex + 8 <= endIndex) {
                    for (let k = 0; k < 8; k++) {
                        if (invZ > depthData[pixelIndex]) {
                            depthData[pixelIndex] = invZ;
                            data32[pixelIndex] = tex32[(((v | 0) & vMask) << texShift) | ((u | 0) & uMask)];
                        }
                        invZ += dInvZdX;
                        u += dUdX;
                        v += dVdX;
                        pixelIndex++;
                    }
                    continue;
                }

                if (bits & (1 << (pixelIndex & 7))) {
                    if (invZ > depthData[pixelIndex]) {
                        depthData[pixelIndex] = invZ;
                        data32[pixelIndex] = tex32[(((v | 0) & vMask) << texShift) | ((u | 0) & uMask)];
                    }
                }
                invZ += dInvZdX;
                u += dUdX;
                v += dVdX;
                pixelIndex++;
            }
        } else {
            // No clipping - optimized path
            for (; pixelIndex < endIndex; pixelIndex++) {
                if (invZ > depthData[pixelIndex]) {
                    depthData[pixelIndex] = invZ;
                    data32[pixelIndex] = tex32[(((v | 0) & vMask) << texShift) | ((u | 0) & uMask)];
                }
                invZ += dInvZdX;
                u += dUdX;
                v += dVdX;
            }
        }
    }

    /**
     * Fill a screen-space triangle with depth testing and affine texture
     * mapping (nearest-neighbor, wrap-around).
     *
     * Vertices are (x, y, invZ, u, v): screen position, inverse camera-space
     * depth (see class docs) and texture coordinates in TEXEL units (not
     * normalized; u in [0, texture.width), v in [0, texture.height), both
     * >= 0). Interpolation is AFFINE in screen space — perspective-correct
     * mapping (interpolating u/z, v/z) is a planned follow-up; affine warp
     * is visible on large triangles at steep angles, classic PS1 style.
     *
     * @param {Surface} surface - Target surface
     * @param {DepthBuffer} depthBuffer - Depth buffer (must match surface dimensions)
     * @param {number} x0 - Vertex 0 screen X
     * @param {number} y0 - Vertex 0 screen Y
     * @param {number} invZ0 - Vertex 0 inverse depth (1/z, > 0)
     * @param {number} u0 - Vertex 0 texture u (texels)
     * @param {number} v0 - Vertex 0 texture v (texels)
     * @param {number} x1 - Vertex 1 screen X
     * @param {number} y1 - Vertex 1 screen Y
     * @param {number} invZ1 - Vertex 1 inverse depth (1/z, > 0)
     * @param {number} u1 - Vertex 1 texture u (texels)
     * @param {number} v1 - Vertex 1 texture v (texels)
     * @param {number} x2 - Vertex 2 screen X
     * @param {number} y2 - Vertex 2 screen Y
     * @param {number} invZ2 - Vertex 2 inverse depth (1/z, > 0)
     * @param {number} u2 - Vertex 2 texture u (texels)
     * @param {number} v2 - Vertex 2 texture v (texels)
     * @param {Texture3D} texture - Packed power-of-two texture
     * @param {Uint8Array|null} [clipBuffer=null] - Clip mask (CLIPPING: delegated to zTexturedSpan)
     */
    static fillTriangleTextured(
        surface,
        depthBuffer,
        x0,
        y0,
        invZ0,
        u0,
        v0,
        x1,
        y1,
        invZ1,
        u1,
        v1,
        x2,
        y2,
        invZ2,
        u2,
        v2,
        texture,
        clipBuffer = null
    ) {
        if (IS_DEBUG) {
            if (depthBuffer.width !== surface.width || depthBuffer.height !== surface.height) {
                throw new Error(
                    `Triangle3DOps.fillTriangleTextured: depth buffer ${depthBuffer.width}×${depthBuffer.height} does not match surface ${surface.width}×${surface.height}`
                );
            }
            if (!(invZ0 > 0 && invZ1 > 0 && invZ2 > 0)) {
                throw new Error(
                    'Triangle3DOps.fillTriangleTextured: all vertices must have invZ > 0 (near-clip before projecting)'
                );
            }
            if (!texture || !texture.data32) {
                throw new Error('Triangle3DOps.fillTriangleTextured: texture must be a Texture3D');
            }
        }

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const depthData = depthBuffer.data;
        const tex32 = texture.data32;
        const texShift = texture.shift;
        const uMask = texture.uMask;
        const vMask = texture.vMask;

        // Screen-space plane gradients for invZ, u and v (all linear in
        // screen space for the affine approximation; invZ exactly so)
        const bx = x1 - x0;
        const by = y1 - y0;
        const cx = x2 - x0;
        const cy = y2 - y0;
        const area2 = bx * cy - cx * by;
        if (area2 === 0) {
            return;
        }
        const invArea2 = 1 / area2;
        const dizB = invZ1 - invZ0;
        const dizC = invZ2 - invZ0;
        const dInvZdX = (dizB * cy - dizC * by) * invArea2;
        const dInvZdY = (bx * dizC - cx * dizB) * invArea2;
        const duB = u1 - u0;
        const duC = u2 - u0;
        const dUdX = (duB * cy - duC * by) * invArea2;
        const dUdY = (bx * duC - cx * duB) * invArea2;
        const dvB = v1 - v0;
        const dvC = v2 - v0;
        const dVdX = (dvB * cy - dvC * by) * invArea2;
        const dVdY = (bx * dvC - cx * dvB) * invArea2;

        // Sort vertices by Y (only x/y needed; invZ/u/v come from the planes)
        let xA = x0,
            yA = y0;
        let xB = x1,
            yB = y1;
        let xC = x2,
            yC = y2;
        let tmp;
        if (yA > yB) {
            tmp = xA;
            xA = xB;
            xB = tmp;
            tmp = yA;
            yA = yB;
            yB = tmp;
        }
        if (yA > yC) {
            tmp = xA;
            xA = xC;
            xC = tmp;
            tmp = yA;
            yA = yC;
            yC = tmp;
        }
        if (yB > yC) {
            tmp = xB;
            xB = xC;
            xC = tmp;
            tmp = yB;
            yB = yC;
            yC = tmp;
        }

        // Scanline range: half-open [ceil(yA), ceil(yC)), clamped to surface
        const yStart = Math.max(0, Math.ceil(yA));
        const yEnd = Math.min(height, Math.ceil(yC));
        if (yStart >= yEnd) {
            return;
        }

        const slopeAC = (xC - xA) / (yC - yA);
        const slopeAB = yB !== yA ? (xB - xA) / (yB - yA) : 0; // unused when yB === yA
        const slopeBC = yC !== yB ? (xC - xB) / (yC - yB) : 0; // unused when yB === yC

        for (let y = yStart; y < yEnd; y++) {
            let xL = xA + (y - yA) * slopeAC;
            let xR = y < yB ? xA + (y - yA) * slopeAB : xB + (y - yB) * slopeBC;
            if (xL > xR) {
                tmp = xL;
                xL = xR;
                xR = tmp;
            }

            const xs = Math.max(0, Math.ceil(xL));
            const xe = Math.min(width, Math.ceil(xR));
            const spanLength = xe - xs;
            if (spanLength <= 0) {
                continue;
            }

            // Row starts from the plane equations (no incremental drift)
            const dx = xs - x0;
            const dy = y - y0;
            const invZRow = invZ0 + dx * dInvZdX + dy * dInvZdY;
            const uRow = u0 + dx * dUdX + dy * dUdY;
            const vRow = v0 + dx * dVdX + dy * dVdY;

            Triangle3DOps.zTexturedSpan(
                data32,
                depthData,
                width,
                height,
                xs,
                y,
                spanLength,
                invZRow,
                dInvZdX,
                uRow,
                dUdX,
                vRow,
                dVdX,
                tex32,
                texShift,
                uMask,
                vMask,
                clipBuffer
            );
        }
    }

    /**
     * Depth-tested PERSPECTIVE-CORRECT textured horizontal span with flat
     * light modulation.
     *
     * Interpolates the screen-space-linear quantities 1/z, u/z and v/z and
     * recovers perspective-correct (u, v) by division at the endpoints of
     * every 16-pixel segment, stepping affinely inside each segment (the
     * classic subdivision scheme: 1 divide per 16 pixels instead of one per
     * pixel, with sub-texel error for typical geometry).
     *
     * Each texel is modulated by `intensity` (0..256 fixed-point). 256 is
     * EXACT identity and selects a copy-only inner loop (no per-pixel
     * multiplies) - pair it with Texture3D.litVariant() pre-modulated
     * textures for lit rendering at unlit speed. Modulated loops force
     * texel alpha to 255; the 256 copy path writes texels as-is (author
     * textures with alpha 255, same contract as zTexturedSpan).
     *
     * BOUNDS CONTRACT: same as zFlatSpan (trusts the caller).
     * CLIPPING CONTRACT: clipping handled here, gates color AND depth
     * writes. Per-pixel bit test only — the 16px segmentation caps what the
     * byte-run fast paths could save, so they are deliberately omitted.
     * UV CONTRACT: same as zTexturedSpan (texel units, wrap, u/z & v/z here).
     *
     * @param {Uint32Array} data32 - 32-bit view of surface pixel data
     * @param {Float32Array} depthData - DepthBuffer.data (1/z per pixel)
     * @param {number} surfaceWidth - Surface width in pixels
     * @param {number} surfaceHeight - Surface height in pixels
     * @param {number} startX - Starting X coordinate (integer, >= 0)
     * @param {number} y - Y coordinate of the span (integer, in [0, surfaceHeight))
     * @param {number} length - Span length in pixels (> 0)
     * @param {number} invZ0 - 1/z at the first pixel
     * @param {number} dInvZdX - 1/z increment per pixel (plane gradient)
     * @param {number} uz0 - u/z at the first pixel
     * @param {number} dUZdX - u/z increment per pixel (plane gradient)
     * @param {number} vz0 - v/z at the first pixel
     * @param {number} dVZdX - v/z increment per pixel (plane gradient)
     * @param {Uint32Array} tex32 - Packed texels (Texture3D.data32)
     * @param {number} texShift - log2 of texture width (Texture3D.shift)
     * @param {number} uMask - Texture width - 1 (Texture3D.uMask)
     * @param {number} vMask - Texture height - 1 (Texture3D.vMask)
     * @param {number} intensity - Flat light, 0..256 (256 = unmodulated)
     * @param {Uint8Array|null} clipBuffer - Clip mask (CLIPPING: handled here)
     */
    static zTexturedSpanPersp(
        data32,
        depthData,
        surfaceWidth,
        surfaceHeight,
        startX,
        y,
        length,
        invZ0,
        dInvZdX,
        uz0,
        dUZdX,
        vz0,
        dVZdX,
        tex32,
        texShift,
        uMask,
        vMask,
        intensity,
        clipBuffer,
        mips = null
    ) {
        if (IS_DEBUG) {
            if (y < 0 || y >= surfaceHeight || !Number.isInteger(y)) {
                throw new Error(
                    `Triangle3DOps.zTexturedSpanPersp: y out of bounds: y=${y}, surfaceHeight=${surfaceHeight}`
                );
            }
            if (startX < 0 || !Number.isInteger(startX)) {
                throw new Error(`Triangle3DOps.zTexturedSpanPersp: invalid startX=${startX}, must be integer >= 0`);
            }
            if (startX + length > surfaceWidth) {
                throw new Error(
                    `Triangle3DOps.zTexturedSpanPersp: span exceeds width: startX=${startX}, length=${length}, surfaceWidth=${surfaceWidth}`
                );
            }
            if (length <= 0) {
                throw new Error(`Triangle3DOps.zTexturedSpanPersp: invalid length: ${length}, must be > 0`);
            }
            if (!(intensity >= 0 && intensity <= 256)) {
                throw new Error(`Triangle3DOps.zTexturedSpanPersp: intensity must be in [0, 256], got ${intensity}`);
            }
        }

        // Segment length: 16 px by default; when 1/z barely changes across
        // the whole span (distant, view-aligned surfaces - the far-floor
        // profile) the affine approximation holds over much longer segments,
        // quartering the per-segment divides. With relative 1/z variation
        // under 2% the added UV error is orders of magnitude below a texel.
        const SEG = Math.abs(dInvZdX) * length < 0.02 * invZ0 ? 64 : 16;
        let pixelIndex = y * surfaceWidth + startX;
        let done = 0;

        // Perspective-correct u,v at the span start
        let invIz = 1 / invZ0;
        let uStart = uz0 * invIz;
        let vStart = vz0 * invIz;
        let invZ = invZ0;

        while (done < length) {
            const seg = length - done > SEG ? SEG : length - done;
            const doneEnd = done + seg;

            // Exact attribute values at the segment end (computed from the
            // span start each time - no drift across segments)
            const izEnd = invZ0 + doneEnd * dInvZdX;
            invIz = 1 / izEnd;
            const uEnd = (uz0 + doneEnd * dUZdX) * invIz;
            const vEnd = (vz0 + doneEnd * dVZdX) * invIz;

            // Affine steps within this segment
            const invSeg = 1 / seg;
            const dU = (uEnd - uStart) * invSeg;
            const dV = (vEnd - vStart) * invSeg;

            // Mip level for this segment from the texel-per-pixel step
            // (nearest level below; level-k coordinates are u >> lv, exact
            // for u >= 0). Without mips this collapses to level 0 and the
            // sampling shift below is by zero.
            let tex32L = tex32;
            let shiftL = texShift;
            let uMaskL = uMask;
            let vMaskL = vMask;
            let lv = 0;
            if (mips !== null) {
                const stepU = dU < 0 ? -dU : dU;
                const stepV = dV < 0 ? -dV : dV;
                const step = stepU > stepV ? stepU : stepV;
                if (step >= 2) {
                    lv = 31 - Math.clz32(step | 0);
                    if (lv >= mips.length) lv = mips.length - 1;
                    const L = mips[lv];
                    tex32L = L.data32;
                    shiftL = L.shift;
                    uMaskL = L.uMask;
                    vMaskL = L.vMask;
                }
            }

            // Sub-texel bias (2^-20 texel): affine endpoints computed with a
            // non-power-of-two 1/seg can land 1 ulp below an integer texel
            // boundary and flip the sampled texel; the bias is far above
            // accumulated float error and far below half a texel.
            let u = uStart + 9.5367431640625e-7;
            let v = vStart + 9.5367431640625e-7;
            const segEndIndex = pixelIndex + seg;

            // Four inner-loop variants: clip x modulation. intensity 256 is
            // exact identity, so the copy-only loops are lossless - callers
            // using Texture3D.litVariant() pre-modulated textures land there.
            if (intensity === 256) {
                if (clipBuffer) {
                    for (; pixelIndex < segEndIndex; pixelIndex++) {
                        if (clipBuffer[pixelIndex >> 3] & (1 << (pixelIndex & 7))) {
                            if (invZ > depthData[pixelIndex]) {
                                depthData[pixelIndex] = invZ;
                                data32[pixelIndex] =
                                    tex32L[((((v | 0) >> lv) & vMaskL) << shiftL) | (((u | 0) >> lv) & uMaskL)];
                            }
                        }
                        invZ += dInvZdX;
                        u += dU;
                        v += dV;
                    }
                } else {
                    for (; pixelIndex < segEndIndex; pixelIndex++) {
                        if (invZ > depthData[pixelIndex]) {
                            depthData[pixelIndex] = invZ;
                            data32[pixelIndex] =
                                tex32L[((((v | 0) >> lv) & vMaskL) << shiftL) | (((u | 0) >> lv) & uMaskL)];
                        }
                        invZ += dInvZdX;
                        u += dU;
                        v += dV;
                    }
                }
            } else if (clipBuffer) {
                for (; pixelIndex < segEndIndex; pixelIndex++) {
                    if (clipBuffer[pixelIndex >> 3] & (1 << (pixelIndex & 7))) {
                        if (invZ > depthData[pixelIndex]) {
                            depthData[pixelIndex] = invZ;
                            const texel = tex32L[((((v | 0) >> lv) & vMaskL) << shiftL) | (((u | 0) >> lv) & uMaskL)];
                            data32[pixelIndex] =
                                (0xff000000 |
                                    ((((((texel >> 16) & 0xff) * intensity) >> 8) & 0xff) << 16) |
                                    ((((((texel >> 8) & 0xff) * intensity) >> 8) & 0xff) << 8) |
                                    (((texel & 0xff) * intensity) >> 8)) >>>
                                0;
                        }
                    }
                    invZ += dInvZdX;
                    u += dU;
                    v += dV;
                }
            } else {
                for (; pixelIndex < segEndIndex; pixelIndex++) {
                    if (invZ > depthData[pixelIndex]) {
                        depthData[pixelIndex] = invZ;
                        const texel = tex32L[((((v | 0) >> lv) & vMaskL) << shiftL) | (((u | 0) >> lv) & uMaskL)];
                        data32[pixelIndex] =
                            (0xff000000 |
                                ((((((texel >> 16) & 0xff) * intensity) >> 8) & 0xff) << 16) |
                                ((((((texel >> 8) & 0xff) * intensity) >> 8) & 0xff) << 8) |
                                (((texel & 0xff) * intensity) >> 8)) >>>
                            0;
                    }
                    invZ += dInvZdX;
                    u += dU;
                    v += dV;
                }
            }

            uStart = uEnd;
            vStart = vEnd;
            done = doneEnd;
        }
    }

    /**
     * Fill a screen-space triangle with depth testing, PERSPECTIVE-CORRECT
     * texture mapping and flat light modulation.
     *
     * Same vertex layout as fillTriangleTextured — (x, y, invZ, u, v) with
     * texel-unit UVs — but u and v are interpolated perspective-correctly
     * (as u/z and v/z, re-divided every 16 pixels). Use this instead of the
     * affine variant when triangles are large or steeply angled; use the
     * affine one when texel-per-pixel density is high and speed matters.
     *
     * @param {Surface} surface - Target surface
     * @param {DepthBuffer} depthBuffer - Depth buffer (must match surface dimensions)
     * @param {number} x0 - Vertex 0 screen X
     * @param {number} y0 - Vertex 0 screen Y
     * @param {number} invZ0 - Vertex 0 inverse depth (1/z, > 0)
     * @param {number} u0 - Vertex 0 texture u (texels)
     * @param {number} v0 - Vertex 0 texture v (texels)
     * @param {number} x1 - Vertex 1 screen X
     * @param {number} y1 - Vertex 1 screen Y
     * @param {number} invZ1 - Vertex 1 inverse depth (1/z, > 0)
     * @param {number} u1 - Vertex 1 texture u (texels)
     * @param {number} v1 - Vertex 1 texture v (texels)
     * @param {number} x2 - Vertex 2 screen X
     * @param {number} y2 - Vertex 2 screen Y
     * @param {number} invZ2 - Vertex 2 inverse depth (1/z, > 0)
     * @param {number} u2 - Vertex 2 texture u (texels)
     * @param {number} v2 - Vertex 2 texture v (texels)
     * @param {Texture3D} texture - Packed power-of-two texture
     * @param {number} [intensity=256] - Flat light, 0..256 (256 = unmodulated)
     * @param {Uint8Array|null} [clipBuffer=null] - Clip mask (CLIPPING: delegated to zTexturedSpanPersp)
     */
    static fillTriangleTexturedPersp(
        surface,
        depthBuffer,
        x0,
        y0,
        invZ0,
        u0,
        v0,
        x1,
        y1,
        invZ1,
        u1,
        v1,
        x2,
        y2,
        invZ2,
        u2,
        v2,
        texture,
        intensity = 256,
        clipBuffer = null
    ) {
        if (IS_DEBUG) {
            if (depthBuffer.width !== surface.width || depthBuffer.height !== surface.height) {
                throw new Error(
                    `Triangle3DOps.fillTriangleTexturedPersp: depth buffer ${depthBuffer.width}×${depthBuffer.height} does not match surface ${surface.width}×${surface.height}`
                );
            }
            if (!(invZ0 > 0 && invZ1 > 0 && invZ2 > 0)) {
                throw new Error(
                    'Triangle3DOps.fillTriangleTexturedPersp: all vertices must have invZ > 0 (near-clip before projecting)'
                );
            }
            if (!texture || !texture.data32) {
                throw new Error('Triangle3DOps.fillTriangleTexturedPersp: texture must be a Texture3D');
            }
        }

        const width = surface.width;
        const height = surface.height;
        const data32 = surface.data32;
        const depthData = depthBuffer.data;
        const tex32 = texture.data32;
        const texShift = texture.shift;
        const uMask = texture.uMask;
        const vMask = texture.vMask;
        const mips = texture.mips || null;

        // Perspective-correct interpolants: u/z and v/z (linear in screen
        // space, like 1/z itself)
        const uz0 = u0 * invZ0;
        const uz1 = u1 * invZ1;
        const uz2 = u2 * invZ2;
        const vz0 = v0 * invZ0;
        const vz1 = v1 * invZ1;
        const vz2 = v2 * invZ2;

        const bx = x1 - x0;
        const by = y1 - y0;
        const cx = x2 - x0;
        const cy = y2 - y0;
        const area2 = bx * cy - cx * by;
        if (area2 === 0) {
            return;
        }
        const invArea2 = 1 / area2;
        const dizB = invZ1 - invZ0;
        const dizC = invZ2 - invZ0;
        const dInvZdX = (dizB * cy - dizC * by) * invArea2;
        const dInvZdY = (bx * dizC - cx * dizB) * invArea2;
        const duzB = uz1 - uz0;
        const duzC = uz2 - uz0;
        const dUZdX = (duzB * cy - duzC * by) * invArea2;
        const dUZdY = (bx * duzC - cx * duzB) * invArea2;
        const dvzB = vz1 - vz0;
        const dvzC = vz2 - vz0;
        const dVZdX = (dvzB * cy - dvzC * by) * invArea2;
        const dVZdY = (bx * dvzC - cx * dvzB) * invArea2;

        // Sort vertices by Y (only x/y needed; attributes come from planes)
        let xA = x0,
            yA = y0;
        let xB = x1,
            yB = y1;
        let xC = x2,
            yC = y2;
        let tmp;
        if (yA > yB) {
            tmp = xA;
            xA = xB;
            xB = tmp;
            tmp = yA;
            yA = yB;
            yB = tmp;
        }
        if (yA > yC) {
            tmp = xA;
            xA = xC;
            xC = tmp;
            tmp = yA;
            yA = yC;
            yC = tmp;
        }
        if (yB > yC) {
            tmp = xB;
            xB = xC;
            xC = tmp;
            tmp = yB;
            yB = yC;
            yC = tmp;
        }

        const yStart = Math.max(0, Math.ceil(yA));
        const yEnd = Math.min(height, Math.ceil(yC));
        if (yStart >= yEnd) {
            return;
        }

        const slopeAC = (xC - xA) / (yC - yA);
        const slopeAB = yB !== yA ? (xB - xA) / (yB - yA) : 0; // unused when yB === yA
        const slopeBC = yC !== yB ? (xC - xB) / (yC - yB) : 0; // unused when yB === yC

        for (let y = yStart; y < yEnd; y++) {
            let xL = xA + (y - yA) * slopeAC;
            let xR = y < yB ? xA + (y - yA) * slopeAB : xB + (y - yB) * slopeBC;
            if (xL > xR) {
                tmp = xL;
                xL = xR;
                xR = tmp;
            }

            const xs = Math.max(0, Math.ceil(xL));
            const xe = Math.min(width, Math.ceil(xR));
            const spanLength = xe - xs;
            if (spanLength <= 0) {
                continue;
            }

            const dx = xs - x0;
            const dy = y - y0;
            const invZRow = invZ0 + dx * dInvZdX + dy * dInvZdY;
            const uzRow = uz0 + dx * dUZdX + dy * dUZdY;
            const vzRow = vz0 + dx * dVZdX + dy * dVZdY;

            Triangle3DOps.zTexturedSpanPersp(
                data32,
                depthData,
                width,
                height,
                xs,
                y,
                spanLength,
                invZRow,
                dInvZdX,
                uzRow,
                dUZdX,
                vzRow,
                dVZdX,
                tex32,
                texShift,
                uMask,
                vMask,
                intensity,
                clipBuffer,
                mips
            );
        }
    }
}

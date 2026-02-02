/**
 * ShadowPipeline class for SWCanvas
 *
 * Encapsulates shadow rendering pipeline logic extracted from Rasterizer.
 * Provides static methods to handle shadow rendering with clear parameter passing.
 *
 * Design rationale:
 * - Static methods: No instance overhead, pure functions
 * - Explicit parameters: Clear data flow without global state
 * - Delegates to existing ShadowBuffer/BoxBlur for actual work
 * - Encapsulates state management for temporary rendering
 */
class ShadowPipeline {
    /**
     * Check if shadows are needed for the given operation state
     * @param {Object} currentOp - Current operation state
     * @returns {boolean} True if shadows should be rendered
     */
    static needsShadow(currentOp) {
        if (!currentOp) return false;

        return (
            currentOp.shadowColor.a > 0 &&
            (currentOp.shadowBlur > 0 || currentOp.shadowOffsetX !== 0 || currentOp.shadowOffsetY !== 0)
        );
    }

    /**
     * Render with shadow support - main shadow pipeline entry point
     * @param {Rasterizer} rasterizer - The rasterizer to use for rendering
     * @param {Function} renderFunc - Function that performs the actual rendering
     */
    static renderWithShadow(rasterizer, renderFunc) {
        if (!ShadowPipeline.needsShadow(rasterizer.currentOp)) {
            // No shadow needed - render normally
            renderFunc();
            return;
        }

        // Shadow pipeline:
        // 1. Create shadow buffer
        // 2. Render shape alpha to shadow buffer
        // 3. Apply blur to shadow buffer
        // 4. Composite shadow to surface
        // 5. Render actual shape on top

        const surface = rasterizer.surface;
        const op = rasterizer.currentOp;
        const maxBlurRadius = Math.ceil(op.shadowBlur);
        const shadowBuffer = new ShadowBuffer(surface.width, surface.height, maxBlurRadius);

        // Step 1: Render shape to shadow buffer
        ShadowPipeline._renderToShadowBuffer(rasterizer, shadowBuffer, renderFunc);

        // Step 2: Apply blur if needed
        let blurredShadow = shadowBuffer;
        if (op.shadowBlur > 0) {
            blurredShadow = ShadowPipeline._applyShadowBlur(shadowBuffer, op.shadowBlur);
        }

        // Step 3: Composite shadow to surface
        ShadowPipeline._compositeShadowToSurface(
            surface,
            blurredShadow,
            op.shadowColor,
            op.shadowOffsetX,
            op.shadowOffsetY,
            op.globalAlpha,
            op.clipMask
        );

        // Step 4: Render actual shape on top
        renderFunc();
    }

    /**
     * Render shape alpha to shadow buffer
     * @param {Rasterizer} rasterizer - The rasterizer to use
     * @param {ShadowBuffer} shadowBuffer - Target shadow buffer
     * @param {Function} renderFunc - Function that performs the actual rendering
     * @private
     */
    static _renderToShadowBuffer(rasterizer, shadowBuffer, renderFunc) {
        const surface = rasterizer.surface;

        // Create a temporary surface to capture the shape
        const tempSurface = new Surface(surface.width, surface.height);

        // Create operation copy without shadow (to prevent infinite recursion)
        const opCopy = Object.assign({}, rasterizer.currentOp);
        opCopy.shadowColor = Color.transparent;
        opCopy.shadowBlur = 0;
        opCopy.shadowOffsetX = 0;
        opCopy.shadowOffsetY = 0;

        // Temporarily swap surface and operation state
        // This is necessary because renderFunc is bound to the original rasterizer
        const originalSurface = rasterizer._surface;
        const originalOp = rasterizer._currentOp;
        rasterizer._surface = tempSurface;
        rasterizer._currentOp = opCopy;

        try {
            renderFunc();
        } finally {
            // Restore original state
            rasterizer._surface = originalSurface;
            rasterizer._currentOp = originalOp;
        }

        // Extract alpha from temp surface to shadow buffer
        ShadowPipeline._extractAlphaToShadowBuffer(tempSurface, shadowBuffer);
    }

    /**
     * Extract alpha channel from surface to shadow buffer
     * @param {Surface} surface - Source surface
     * @param {ShadowBuffer} shadowBuffer - Target shadow buffer
     * @private
     */
    static _extractAlphaToShadowBuffer(surface, shadowBuffer) {
        for (let y = 0; y < surface.height; y++) {
            for (let x = 0; x < surface.width; x++) {
                const offset = y * surface.stride + x * 4;
                const alpha = surface.data[offset + 3] / 255.0; // Normalize to 0-1

                if (alpha > 0) {
                    shadowBuffer.addAlpha(x, y, alpha);
                }
            }
        }
    }

    /**
     * Apply blur to shadow buffer
     * @param {ShadowBuffer} shadowBuffer - Shadow buffer to blur
     * @param {number} blurRadius - Blur radius
     * @returns {ShadowBuffer} New blurred shadow buffer
     * @private
     */
    static _applyShadowBlur(shadowBuffer, blurRadius) {
        // Convert shadow buffer to dense array for blur processing
        const denseData = shadowBuffer.toDenseArray();

        if (denseData.width === 0 || denseData.height === 0) {
            return shadowBuffer; // Nothing to blur
        }

        // Apply box blur
        const blurredData = BoxBlur.blur(denseData.data, denseData.width, denseData.height, blurRadius);

        // Create new shadow buffer with blurred data
        const blurredBuffer = new ShadowBuffer(
            shadowBuffer.originalWidth,
            shadowBuffer.originalHeight,
            Math.ceil(blurRadius)
        );
        blurredBuffer.fromDenseArray(
            blurredData,
            denseData.width,
            denseData.height,
            denseData.offsetX,
            denseData.offsetY
        );

        return blurredBuffer;
    }

    /**
     * Composite shadow buffer to surface
     * @param {Surface} surface - Target surface
     * @param {ShadowBuffer} shadowBuffer - Shadow buffer to composite
     * @param {Color} shadowColor - Shadow color
     * @param {number} offsetX - Shadow X offset
     * @param {number} offsetY - Shadow Y offset
     * @param {number} globalAlpha - Global alpha value
     * @param {ClipMask} clipMask - Clipping mask (can be null)
     * @private
     */
    static _compositeShadowToSurface(surface, shadowBuffer, shadowColor, offsetX, offsetY, globalAlpha, clipMask) {
        // Apply global alpha to shadow color
        const effectiveShadowColor = shadowColor.withGlobalAlpha(globalAlpha);

        // Iterate over shadow pixels and composite to surface
        for (const pixel of shadowBuffer.getPixels()) {
            // Convert from extended buffer coordinates to surface coordinates
            const surfaceX = Math.round(pixel.x - shadowBuffer.extendedOffsetX + offsetX);
            const surfaceY = Math.round(pixel.y - shadowBuffer.extendedOffsetY + offsetY);

            // Bounds check
            if (surfaceX < 0 || surfaceX >= surface.width || surfaceY < 0 || surfaceY >= surface.height) {
                continue;
            }

            // Check clipping
            if (clipMask && clipMask.isPixelClipped(surfaceX, surfaceY)) {
                continue;
            }

            // Calculate final shadow alpha
            // The 8x multiplier compensates for alpha dilution caused by box blur averaging.
            // When blur spreads a single pixel over a larger area, the average alpha drops
            // significantly. The multiplier restores visual intensity to match HTML5 Canvas.
            const BLUR_DILUTION_COMPENSATION = 8;
            const finalShadowAlpha = Math.min(
                255,
                Math.round(pixel.alpha * effectiveShadowColor.a * BLUR_DILUTION_COMPENSATION)
            );

            if (finalShadowAlpha <= 0) continue;

            // Get surface pixel
            const offset = surfaceY * surface.stride + surfaceX * 4;
            const dstR = surface.data[offset];
            const dstG = surface.data[offset + 1];
            const dstB = surface.data[offset + 2];
            const dstA = surface.data[offset + 3];

            // Composite shadow (always uses source-over blending per HTML5 spec)
            const result = CompositeOperations.blendPixel(
                'source-over',
                effectiveShadowColor.r,
                effectiveShadowColor.g,
                effectiveShadowColor.b,
                finalShadowAlpha,
                dstR,
                dstG,
                dstB,
                dstA
            );

            // Write result
            surface.data[offset] = result.r;
            surface.data[offset + 1] = result.g;
            surface.data[offset + 2] = result.b;
            surface.data[offset + 3] = result.a;
        }
    }
}

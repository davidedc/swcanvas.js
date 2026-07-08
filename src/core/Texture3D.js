/**
 * Texture3D class for SWCanvas
 *
 * Packed texture for the 3D rasterization primitives (Triangle3DOps).
 * Converts an ImageLike ({width, height, data: RGBA Uint8ClampedArray})
 * into a Uint32Array of pre-packed pixels in the same little-endian ABGR
 * word order as Surface.data32, so a textured span writes texels with a
 * single 32-bit store (no per-pixel packing or channel shuffling).
 *
 * Constraints:
 * - Width and height MUST be powers of two. Sampling uses mask-based
 *   wrap-around addressing: texelIndex = ((v & vMask) << shift) | (u & uMask),
 *   which makes out-of-range coordinates repeat the texture at zero cost.
 * - Sampling is nearest-neighbor (consistent with the rest of SWCanvas —
 *   Pattern and drawImage are nearest-neighbor too).
 * - Texel alpha is written to the surface AS-IS by the 3D primitives (no
 *   blending); for normal opaque rendering author textures with alpha 255.
 *
 * UV convention (see Triangle3DOps): texel units, not normalized [0,1] —
 * u in [0, width), v in [0, height). Multiply normalized coordinates by
 * width/height before passing them in.
 */
class Texture3D {
    /**
     * Create a packed texture from an ImageLike
     * @param {Object} imageLike - {width, height, data} with RGBA data
     *   (data.length === width * height * 4), e.g. an ImageData
     */
    constructor(imageLike) {
        const width = imageLike.width;
        const height = imageLike.height;
        const data = imageLike.data;

        if (typeof width !== 'number' || width <= 0 || (width & (width - 1)) !== 0) {
            throw new Error(`Texture3D width must be a positive power of two, got ${width}`);
        }
        if (typeof height !== 'number' || height <= 0 || (height & (height - 1)) !== 0) {
            throw new Error(`Texture3D height must be a positive power of two, got ${height}`);
        }
        if (!data || data.length !== width * height * 4) {
            throw new Error(
                `Texture3D data must be RGBA with length width*height*4 (${width * height * 4}), got ${data ? data.length : 'none'}`
            );
        }

        // Make dimensions and addressing constants immutable
        Object.defineProperty(this, 'width', { value: width, writable: false });
        Object.defineProperty(this, 'height', { value: height, writable: false });
        /** Horizontal wrap mask (width - 1) */
        Object.defineProperty(this, 'uMask', { value: width - 1, writable: false });
        /** Vertical wrap mask (height - 1) */
        Object.defineProperty(this, 'vMask', { value: height - 1, writable: false });
        /** Row shift (log2(width)) for index computation */
        Object.defineProperty(this, 'shift', { value: Math.log2(width), writable: false });

        /**
         * Packed texels, same word order as Surface.data32.
         * Direct access for hot loops (dual-access pattern).
         * @type {Uint32Array}
         */
        this.data32 = new Uint32Array(width * height);
        for (let i = 0, p = 0; i < this.data32.length; i++, p += 4) {
            this.data32[i] = ((data[p + 3] << 24) | (data[p + 2] << 16) | (data[p + 1] << 8) | data[p]) >>> 0;
        }
    }

    /**
     * Get a pre-modulated ("lit") variant of this texture for a flat light
     * intensity, so hot span loops can copy texels instead of modulating
     * per pixel (Quake surface-cache idea, one intensity per whole face).
     *
     * Intensity is quantized to 32 steps (multiples of 8) and variants are
     * built lazily and cached, so repeated frames with stable lighting cost
     * nothing. Memory: up to 32 x texture size on heavily-varied lighting.
     *
     * Exactness: intensities that quantize to 256 return THIS texture
     * (identity, zero error). Other levels modulate each channel exactly
     * like the rasterizer would: (c * quantizedIntensity) >> 8. The only
     * approximation versus per-pixel modulation is the quantization step
     * (max 1/32 of full brightness), invisible for flat-shaded lighting.
     *
     * @param {number} intensity - Flat light, 0..256 (Triangle3DOps convention)
     * @returns {Texture3D|Object} A texture-like {data32, shift, uMask, vMask,
     *   width, height} sharing this texture's dimensions - pass to the
     *   textured fill methods with intensity 256
     */
    litVariant(intensity) {
        // Quantize to the nearest multiple of 8 (33 levels, 0..256)
        let level = (intensity + 4) >> 3;
        if (level < 0) level = 0;
        if (level > 32) level = 32;
        if (level === 32) {
            return this;
        }

        if (!this._litVariants) {
            this._litVariants = new Array(32);
        }
        let variant = this._litVariants[level];
        if (!variant) {
            const q = level << 3;
            variant = {
                width: this.width,
                height: this.height,
                uMask: this.uMask,
                vMask: this.vMask,
                shift: this.shift,
                data32: Texture3D._modulate(this.data32, q)
            };
            // Propagate the mip chain (if built) so lit rendering stays
            // minification-aware; level 0 shares the variant's own pixels
            if (this.mips) {
                variant.mips = this.mips.map((mipLevel, k) => ({
                    width: mipLevel.width,
                    height: mipLevel.height,
                    uMask: mipLevel.uMask,
                    vMask: mipLevel.vMask,
                    shift: mipLevel.shift,
                    data32: k === 0 ? variant.data32 : Texture3D._modulate(mipLevel.data32, q)
                }));
            }
            this._litVariants[level] = variant;
        }
        return variant;
    }

    /**
     * Modulate packed texels by a fixed-point intensity, exactly as the
     * rasterizer's per-pixel path would: (channel * q) >> 8, alpha kept.
     * @param {Uint32Array} src - Packed source texels
     * @param {number} q - Intensity 0..256
     * @returns {Uint32Array} New modulated texel array
     */
    static _modulate(src, q) {
        const lit = new Uint32Array(src.length);
        for (let i = 0; i < src.length; i++) {
            const texel = src[i];
            lit[i] =
                ((texel & 0xff000000) |
                    ((((((texel >> 16) & 0xff) * q) >> 8) & 0xff) << 16) |
                    ((((((texel >> 8) & 0xff) * q) >> 8) & 0xff) << 8) |
                    (((texel & 0xff) * q) >> 8)) >>>
                0;
        }
        return lit;
    }

    /**
     * Build the mip chain for minification-aware sampling by the
     * perspective-correct textured span (opt-in; adds ~33% memory).
     *
     * Levels halve each dimension (minimum 1) down to 1x1, box-filtered
     * (2x2 average with rounding). Power-of-two dimensions stay power-of-two
     * so wrap addressing keeps working at every level. Any cached lit
     * variants are invalidated so they rebuild with mips included - call
     * buildMips() right after construction, before rendering.
     *
     * @returns {Texture3D} this (chainable)
     */
    buildMips() {
        if (this.mips) {
            return this;
        }
        const levels = [
            {
                width: this.width,
                height: this.height,
                uMask: this.uMask,
                vMask: this.vMask,
                shift: this.shift,
                data32: this.data32
            }
        ];
        let prev = levels[0];
        while (prev.width > 1 || prev.height > 1) {
            const w = Math.max(1, prev.width >> 1);
            const h = Math.max(1, prev.height >> 1);
            const data32 = new Uint32Array(w * h);
            for (let y = 0; y < h; y++) {
                const y0 = Math.min(prev.height - 1, y * 2);
                const y1 = Math.min(prev.height - 1, y * 2 + 1);
                for (let x = 0; x < w; x++) {
                    const x0 = Math.min(prev.width - 1, x * 2);
                    const x1 = Math.min(prev.width - 1, x * 2 + 1);
                    const a = prev.data32[y0 * prev.width + x0];
                    const b = prev.data32[y0 * prev.width + x1];
                    const c = prev.data32[y1 * prev.width + x0];
                    const d = prev.data32[y1 * prev.width + x1];
                    data32[y * w + x] =
                        (((((a >>> 24) + (b >>> 24) + (c >>> 24) + (d >>> 24) + 2) >> 2) << 24) |
                            (((((a >> 16) & 0xff) + ((b >> 16) & 0xff) + ((c >> 16) & 0xff) + ((d >> 16) & 0xff) + 2) >>
                                2) <<
                                16) |
                            (((((a >> 8) & 0xff) + ((b >> 8) & 0xff) + ((c >> 8) & 0xff) + ((d >> 8) & 0xff) + 2) >>
                                2) <<
                                8) |
                            (((a & 0xff) + (b & 0xff) + (c & 0xff) + (d & 0xff) + 2) >> 2)) >>>
                        0;
                }
            }
            const level = {
                width: w,
                height: h,
                uMask: w - 1,
                vMask: h - 1,
                shift: Math.log2(w),
                data32: data32
            };
            levels.push(level);
            prev = level;
        }
        this.mips = levels;
        this._litVariants = null;
        return this;
    }

    /**
     * Get memory usage in bytes (base texture plus any cached lit variants)
     * @returns {number} Memory usage of the packed texture
     */
    getMemoryUsage() {
        let total = this.data32.byteLength;
        if (this._litVariants) {
            for (let i = 0; i < this._litVariants.length; i++) {
                if (this._litVariants[i]) total += this._litVariants[i].data32.byteLength;
            }
        }
        return total;
    }

    /**
     * String representation for debugging
     * @returns {string} Texture3D description
     */
    toString() {
        const memoryKB = (this.getMemoryUsage() / 1024).toFixed(1);
        return `Texture3D(${this.width}×${this.height}, ${memoryKB}KB)`;
    }
}

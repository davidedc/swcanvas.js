/**
 * ImageProcessor class for SWCanvas
 *
 * Handles ImageLike interface validation and format conversions.
 * Provides static methods following Joshua Bloch's principle of
 * using static methods for stateless utility operations.
 */
class ImageProcessor {
    /**
     * Validate and convert ImageLike object to standardized RGBA format
     * @param {Object} imageLike - ImageLike object to validate and convert
     * @returns {Object} Validated and converted image data
     */
    static validateAndConvert(imageLike) {
        ImageProcessor._validateImageLike(imageLike);

        const expectedRGBLength = imageLike.width * imageLike.height * 3;
        const expectedRGBALength = imageLike.width * imageLike.height * 4;

        if (imageLike.data.length === expectedRGBLength) {
            return ImageProcessor._convertRGBToRGBA(imageLike);
        } else if (imageLike.data.length === expectedRGBALength) {
            // Already RGBA - return as-is with validation
            return {
                width: imageLike.width,
                height: imageLike.height,
                data: imageLike.data
            };
        } else {
            throw new Error(
                `ImageLike data length (${imageLike.data.length}) must match ` +
                    `width*height*3 (${expectedRGBLength}) for RGB or ` +
                    `width*height*4 (${expectedRGBALength}) for RGBA`
            );
        }
    }

    /**
     * Validate basic ImageLike interface properties
     * @param {Object} imageLike - Object to validate
     * @private
     */
    static _validateImageLike(imageLike) {
        Validators.defined(imageLike, 'ImageLike');
        Validators.positiveInteger(imageLike.width, 'ImageLike width');
        Validators.positiveInteger(imageLike.height, 'ImageLike height');
        Validators.instanceOf(imageLike.data, Uint8ClampedArray, 'ImageLike data');

        // Additional validation for reasonable limits
        const maxDimension = 16384;
        if (imageLike.width > maxDimension || imageLike.height > maxDimension) {
            throw new Error(`ImageLike dimensions must be ≤ ${maxDimension}x${maxDimension}`);
        }
    }

    /**
     * Convert RGB image data to RGBA format
     * @param {Object} rgbImage - RGB ImageLike object
     * @returns {Object} RGBA ImageLike object
     * @private
     */
    static _convertRGBToRGBA(rgbImage) {
        const expectedRGBALength = rgbImage.width * rgbImage.height * 4;
        const rgbaData = new Uint8ClampedArray(expectedRGBALength);

        // RGB to RGBA conversion - append alpha = 255 to each pixel
        for (let i = 0; i < rgbImage.width * rgbImage.height; i++) {
            const rgbOffset = i * 3;
            const rgbaOffset = i * 4;

            rgbaData[rgbaOffset] = rgbImage.data[rgbOffset]; // R
            rgbaData[rgbaOffset + 1] = rgbImage.data[rgbOffset + 1]; // G
            rgbaData[rgbaOffset + 2] = rgbImage.data[rgbOffset + 2]; // B
            rgbaData[rgbaOffset + 3] = 255; // A = fully opaque
        }

        return {
            width: rgbImage.width,
            height: rgbImage.height,
            data: rgbaData
        };
    }

    /**
     * Convert Surface to ImageLike format
     * @param {Surface} surface - Surface to convert
     * @returns {Object} ImageLike representation of surface
     */
    static surfaceToImageLike(surface) {
        Validators.defined(surface, 'Surface');
        Validators.defined(surface.width, 'Surface.width');
        Validators.defined(surface.height, 'Surface.height');
        Validators.defined(surface.data, 'Surface.data');

        return {
            width: surface.width,
            height: surface.height,
            data: new Uint8ClampedArray(surface.data) // Create copy for safety
        };
    }

    /**
     * Create a blank ImageLike object filled with specified color
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {Color|Array} fillColor - Color to fill with (Color instance or RGBA array)
     * @returns {Object} ImageLike object
     */
    static createBlankImage(width, height, fillColor = [0, 0, 0, 255]) {
        Validators.positiveInteger(width, 'width');
        Validators.positiveInteger(height, 'height');

        const numPixels = width * height;
        const data = new Uint8ClampedArray(numPixels * 4);

        // Determine RGBA values
        let r, g, b, a;
        if (fillColor instanceof Color) {
            const rgba = fillColor.toRGBA();
            r = rgba[0];
            g = rgba[1];
            b = rgba[2];
            a = rgba[3];
        } else if (Array.isArray(fillColor) && fillColor.length >= 4) {
            r = fillColor[0];
            g = fillColor[1];
            b = fillColor[2];
            a = fillColor[3];
        } else {
            throw new Error('fillColor must be a Color instance or RGBA array');
        }

        // Fill image with specified color
        for (let i = 0; i < numPixels; i++) {
            const offset = i * 4;
            data[offset] = r;
            data[offset + 1] = g;
            data[offset + 2] = b;
            data[offset + 3] = a;
        }

        return {
            width,
            height,
            data
        };
    }

    /**
     * Extract a rectangular region from an ImageLike object
     * @param {Object} source - Source ImageLike object
     * @param {number} x - Source x coordinate
     * @param {number} y - Source y coordinate
     * @param {number} width - Region width
     * @param {number} height - Region height
     * @returns {Object} New ImageLike object containing the extracted region
     */
    static extractRegion(source, x, y, width, height) {
        const validated = ImageProcessor.validateAndConvert(source);

        // Validate extraction bounds
        if (x < 0 || y < 0 || x + width > validated.width || y + height > validated.height) {
            throw new Error('Extraction region exceeds source image bounds');
        }

        if (width <= 0 || height <= 0) {
            throw new Error('Extraction region dimensions must be positive');
        }

        const extractedData = new Uint8ClampedArray(width * height * 4);

        // Copy pixel data row by row
        for (let row = 0; row < height; row++) {
            const sourceRowStart = ((y + row) * validated.width + x) * 4;
            const destRowStart = row * width * 4;
            const rowLength = width * 4;

            extractedData.set(validated.data.subarray(sourceRowStart, sourceRowStart + rowLength), destRowStart);
        }

        return {
            width,
            height,
            data: extractedData
        };
    }

    /**
     * Scale an ImageLike object using nearest-neighbor interpolation
     * @param {Object} source - Source ImageLike object
     * @param {number} newWidth - Target width
     * @param {number} newHeight - Target height
     * @returns {Object} Scaled ImageLike object
     */
    static scaleImage(source, newWidth, newHeight) {
        const validated = ImageProcessor.validateAndConvert(source);

        Validators.positiveInteger(newWidth, 'newWidth');
        Validators.positiveInteger(newHeight, 'newHeight');

        const scaledData = new Uint8ClampedArray(newWidth * newHeight * 4);
        const scaleX = validated.width / newWidth;
        const scaleY = validated.height / newHeight;

        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                // Nearest-neighbor sampling
                const sourceX = Math.floor(x * scaleX);
                const sourceY = Math.floor(y * scaleY);

                // Clamp to source bounds (shouldn't be necessary with correct scaling)
                const clampedX = Math.min(sourceX, validated.width - 1);
                const clampedY = Math.min(sourceY, validated.height - 1);

                const sourceOffset = (clampedY * validated.width + clampedX) * 4;
                const destOffset = (y * newWidth + x) * 4;

                // Copy RGBA values
                scaledData[destOffset] = validated.data[sourceOffset];
                scaledData[destOffset + 1] = validated.data[sourceOffset + 1];
                scaledData[destOffset + 2] = validated.data[sourceOffset + 2];
                scaledData[destOffset + 3] = validated.data[sourceOffset + 3];
            }
        }

        return {
            width: newWidth,
            height: newHeight,
            data: scaledData
        };
    }

    /**
     * Check if an object conforms to the ImageLike interface
     * @param {*} obj - Object to check
     * @returns {boolean} True if object is ImageLike-compatible
     */
    static isImageLike(obj) {
        try {
            ImageProcessor._validateImageLike(obj);

            const expectedRGBLength = obj.width * obj.height * 3;
            const expectedRGBALength = obj.width * obj.height * 4;

            return obj.data.length === expectedRGBLength || obj.data.length === expectedRGBALength;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get information about an ImageLike object
     * @param {Object} imageLike - ImageLike object to analyze
     * @returns {Object} Information about the image
     */
    static getImageInfo(imageLike) {
        const validated = ImageProcessor.validateAndConvert(imageLike);
        const isRGB = imageLike.data.length === imageLike.width * imageLike.height * 3;

        return {
            width: validated.width,
            height: validated.height,
            pixelCount: validated.width * validated.height,
            format: isRGB ? 'RGB' : 'RGBA',
            dataSize: validated.data.length,
            bytesPerPixel: isRGB ? 3 : 4,
            memoryUsage: validated.data.byteLength
        };
    }

    /**
     * Convert HTMLCanvasElement to ImageLike format
     * @param {HTMLCanvasElement} canvas - HTML canvas element to convert
     * @returns {Object} ImageLike representation of canvas
     */
    static fromCanvas(canvas) {
        Validators.defined(canvas, 'Canvas');
        Validators.number(canvas.width, 'Canvas.width');
        Validators.number(canvas.height, 'Canvas.height');

        if (!canvas.getContext || typeof canvas.getContext !== 'function') {
            throw new Error('Canvas must have getContext method');
        }

        try {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            return {
                width: canvas.width,
                height: canvas.height,
                data: new Uint8ClampedArray(imageData.data)
            };
        } catch (error) {
            throw new Error(`Failed to extract canvas data: ${error.message}`);
        }
    }
}

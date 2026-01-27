/**
 * BitBuffer class for SWCanvas
 * 
 * A utility class for managing 1-bit per pixel data structures.
 * Used as a composition component by ClipMask and SourceMask to eliminate
 * code duplication while maintaining clear separation of concerns.
 * 
 * Following Joshua Bloch's principle: "Favor composition over inheritance" (Item 18)
 * 
 * Memory Layout:
 * - Each pixel is represented by 1 bit
 * - Bits are packed into Uint8Array (8 pixels per byte)
 * - Memory usage: width × height ÷ 8 bytes
 */
class BitBuffer {
    /**
     * Create a BitBuffer
     * @param {number} width - Buffer width in pixels
     * @param {number} height - Buffer height in pixels
     * @param {number} defaultValue - Default bit value (0 or 1)
     */
    constructor(width, height, defaultValue = 0) {
        // Validate parameters
        Validators.positiveInteger(width, 'BitBuffer width');
        Validators.positiveInteger(height, 'BitBuffer height');

        if (defaultValue !== 0 && defaultValue !== 1) {
            throw new Error('BitBuffer defaultValue must be 0 or 1');
        }

        this._width = width;
        this._height = height;
        this._numPixels = width * height;
        this._numBytes = Math.ceil(this._numPixels / 8);
        this._defaultValue = defaultValue;
        
        // Create buffer and initialize to default value
        this._buffer = new Uint8Array(this._numBytes);
        this._initializeToDefault();
        
        // Make dimensions immutable
        Object.defineProperty(this, 'width', { value: width, writable: false });
        Object.defineProperty(this, 'height', { value: height, writable: false });
    }
    
    /**
     * Initialize buffer to default value
     * @private
     */
    _initializeToDefault() {
        if (this._defaultValue === 1) {
            // Initialize to all 1s
            this._buffer.fill(0xFF);
            
            // Handle partial last byte if width*height is not divisible by 8
            const remainderBits = this._numPixels % 8;
            if (remainderBits !== 0) {
                const lastByteIndex = this._numBytes - 1;
                const lastByteMask = (1 << remainderBits) - 1;
                this._buffer[lastByteIndex] = lastByteMask;
            }
        } else {
            // Initialize to all 0s (default for Uint8Array)
            this._buffer.fill(0);
        }
    }
    
    /**
     * Get bit value for a pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if bit is 1, false if bit is 0
     */
    getPixel(x, y) {
        // Bounds checking
        if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
            return false; // Out of bounds pixels return 0
        }
        
        const pixelIndex = y * this._width + x;
        return this._getBit(pixelIndex) === 1;
    }
    
    /**
     * Set bit value for a pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {boolean} value - True to set bit to 1, false to set to 0
     */
    setPixel(x, y, value) {
        // Bounds checking
        if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
            return; // Ignore out of bounds
        }
        
        const pixelIndex = y * this._width + x;
        this._setBit(pixelIndex, value ? 1 : 0);
    }
    
    /**
     * Clear all bits (set to 0)
     */
    clear() {
        this._buffer.fill(0);
    }
    
    /**
     * Fill all bits (set to 1)
     */
    fill() {
        this._buffer.fill(0xFF);
        
        // Handle partial last byte
        const remainderBits = this._numPixels % 8;
        if (remainderBits !== 0) {
            const lastByteIndex = this._numBytes - 1;
            const lastByteMask = (1 << remainderBits) - 1;
            this._buffer[lastByteIndex] = lastByteMask;
        }
    }
    
    /**
     * Reset buffer to its default value
     */
    reset() {
        this._initializeToDefault();
    }
    
    /**
     * Perform bitwise AND with another BitBuffer
     * @param {BitBuffer} other - Other BitBuffer to AND with
     */
    and(other) {
        /*@assert:if (!(other instanceof BitBuffer)) {
            throw new Error('Argument must be a BitBuffer instance');
        }*/

        /*@assert:if (other._width !== this._width || other._height !== this._height) {
            throw new Error('BitBuffer dimensions must match for AND operation');
        }*/

        // Perform bitwise AND on each byte
        for (let i = 0; i < this._numBytes; i++) {
            this._buffer[i] &= other._buffer[i];
        }
    }
    
    /**
     * Copy data from another BitBuffer
     * @param {BitBuffer} other - Source BitBuffer to copy from
     */
    copyFrom(other) {
        /*@assert:if (!(other instanceof BitBuffer)) {
            throw new Error('Argument must be a BitBuffer instance');
        }*/

        /*@assert:if (other._width !== this._width || other._height !== this._height) {
            throw new Error('BitBuffer dimensions must match for copy operation');
        }*/

        this._buffer.set(other._buffer);
    }
    
    /**
     * Check if buffer is completely filled (all 1s)
     * @returns {boolean} True if all bits are 1
     */
    isFull() {
        // Quick check: if all bytes are 0xFF except possibly the last one
        for (let i = 0; i < this._numBytes - 1; i++) {
            if (this._buffer[i] !== 0xFF) {
                return false;
            }
        }
        
        // Check last byte accounting for partial bits
        const remainderBits = this._numPixels % 8;
        if (remainderBits === 0) {
            return this._buffer[this._numBytes - 1] === 0xFF;
        } else {
            const lastByteMask = (1 << remainderBits) - 1;
            return this._buffer[this._numBytes - 1] === lastByteMask;
        }
    }
    
    /**
     * Check if buffer is completely empty (all 0s)
     * @returns {boolean} True if all bits are 0
     */
    isEmpty() {
        for (let i = 0; i < this._numBytes; i++) {
            if (this._buffer[i] !== 0) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Get memory usage in bytes
     * @returns {number} Memory usage of the buffer
     */
    getMemoryUsage() {
        return this._buffer.byteLength;
    }
    
    /**
     * Get bit value at linear pixel index
     * @param {number} pixelIndex - Linear pixel index
     * @returns {number} 0 or 1
     * @private
     */
    _getBit(pixelIndex) {
        const byteIndex = Math.floor(pixelIndex / 8);
        const bitIndex = pixelIndex % 8;
        
        if (byteIndex >= this._buffer.length) {
            return 0; // Out of bounds pixels return 0
        }
        
        return (this._buffer[byteIndex] & (1 << bitIndex)) !== 0 ? 1 : 0;
    }
    
    /**
     * Set bit value at linear pixel index
     * @param {number} pixelIndex - Linear pixel index
     * @param {number} value - 0 or 1
     * @private
     */
    _setBit(pixelIndex, value) {
        const byteIndex = Math.floor(pixelIndex / 8);
        const bitIndex = pixelIndex % 8;
        
        if (byteIndex >= this._buffer.length) {
            return; // Ignore out of bounds
        }
        
        if (value) {
            this._buffer[byteIndex] |= (1 << bitIndex);
        } else {
            this._buffer[byteIndex] &= ~(1 << bitIndex);
        }
    }
    
    /**
     * String representation for debugging
     * @returns {string} BitBuffer description
     */
    toString() {
        const memoryKB = (this.getMemoryUsage() / 1024).toFixed(2);
        const state = this.isEmpty() ? 'empty' : this.isFull() ? 'full' : 'mixed';
        return `BitBuffer(${this._width}×${this._height}, ${memoryKB}KB, ${state})`;
    }
    
    /**
     * Check equality with another BitBuffer
     * @param {BitBuffer} other - Other BitBuffer to compare
     * @returns {boolean} True if buffers are identical
     */
    equals(other) {
        if (!(other instanceof BitBuffer)) {
            return false;
        }
        
        if (other._width !== this._width || other._height !== this._height) {
            return false;
        }
        
        // Compare buffer contents
        for (let i = 0; i < this._numBytes; i++) {
            if (this._buffer[i] !== other._buffer[i]) {
                return false;
            }
        }
        
        return true;
    }
}
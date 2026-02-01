/**
 * SeededRandom - Deterministic random number generator for reproducible tests
 *
 * Uses Small Fast Counter (SFC) 32-bit implementation for high-quality
 * random numbers with deterministic sequences from a given seed.
 *
 * @module seeded-random
 */

/**
 * SeededRandom - Deterministic random number generator for reproducible tests
 * Uses Small Fast Counter (SFC) 32-bit implementation
 */
class SeededRandom {
    static #currentRandom = null;

    static seedWithInteger(seed) {
        // XOR the seed with a constant value
        seed = seed ^ 0xDEADBEEF;

        // Pad seed with Phi, Pi and E.
        this.#currentRandom = this.#sfc32(0x9E3779B9, 0x243F6A88, 0xB7E15162, seed);

        // Warm up the generator
        for (let i = 0; i < 15; i++) {
            this.#currentRandom();
        }
    }

    static getRandom() {
        if (!this.#currentRandom) {
            throw new Error('SeededRandom must be initialized with seedWithInteger before use');
        }
        return this.#currentRandom();
    }

    // Small Fast Counter (SFC) 32-bit implementation
    static #sfc32(a, b, c, d) {
        return function () {
            a |= 0; b |= 0; c |= 0; d |= 0;
            let t = (a + b | 0) + d | 0;
            d = d + 1 | 0;
            a = b ^ b >>> 9;
            b = c + (c << 3) | 0;
            c = (c << 21 | c >>> 11);
            c = c + t | 0;
            return (t >>> 0) / 4294967296;
        };
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SeededRandom };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.SeededRandom = SeededRandom;
}

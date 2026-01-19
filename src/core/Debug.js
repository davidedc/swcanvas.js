/**
 * Debug - Development utilities for SWCanvas
 *
 * These utilities are completely stripped in production builds by Terser.
 * The build script uses: --compress drop_console=true,drop_debugger=true,dead_code=true
 *
 * Enable debug mode in development:
 *   globalThis.__SWCANVAS_DEBUG__ = true;
 *   // Then load SWCanvas
 *
 * Debug mode provides:
 *   - Runtime assertions for contract verification
 *   - Debug logging for tracing execution
 *   - Clipping invariant validation
 */

/**
 * Check if debug mode is enabled.
 * @type {boolean}
 */
const IS_DEBUG = typeof globalThis !== 'undefined' &&
                 globalThis.__SWCANVAS_DEBUG__ === true;

/**
 * Assert a condition is true (development only).
 *
 * In production builds, this function is completely stripped by Terser's
 * dead code elimination since IS_DEBUG will be false and the early return
 * makes the rest unreachable.
 *
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message if condition fails
 */
function assertDebug(condition, message) {
    if (!IS_DEBUG) return;
    if (!condition) {
        console.error(`[SWCanvas] Assertion failed: ${message}`);
        debugger;
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Log a debug message (development only).
 *
 * Stripped in production builds.
 *
 * @param {string} message - Message to log
 */
function debugLog(message) {
    if (!IS_DEBUG) return;
    console.log(`[SWCanvas Debug] ${message}`);
}

/**
 * Log a debug warning (development only).
 *
 * Stripped in production builds.
 *
 * @param {string} message - Warning message to log
 */
function debugWarn(message) {
    if (!IS_DEBUG) return;
    console.warn(`[SWCanvas Debug] ${message}`);
}

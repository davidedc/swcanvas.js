/**
 * Validators class for SWCanvas
 *
 * Public API parameter validation utilities.
 * These validations REMAIN in production builds to ensure correct API usage.
 *
 * Following Joshua Bloch's principle of providing clear, descriptive error messages
 * to help users understand and fix invalid input.
 */
class Validators {
    /**
     * Validate that value is a number (not NaN)
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static number(value, name) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`${name} must be a valid number`);
        }
    }

    /**
     * Validate that value is a finite number
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static finiteNumber(value, name) {
        if (typeof value !== 'number' || !isFinite(value)) {
            throw new Error(`${name} must be a finite number`);
        }
    }

    /**
     * Validate that value is a non-negative number
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static nonNegative(value, name) {
        Validators.number(value, name);
        if (value < 0) {
            throw new Error(`${name} must be non-negative`);
        }
    }

    /**
     * Validate that value is a positive integer
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static positiveInteger(value, name) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
            throw new Error(`${name} must be a positive integer`);
        }
    }

    /**
     * Validate that value is a non-negative integer
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static nonNegativeInteger(value, name) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new Error(`${name} must be a non-negative integer`);
        }
    }

    /**
     * Validate that value is within a specified range
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     * @param {number} min - Minimum allowed value (inclusive)
     * @param {number} max - Maximum allowed value (inclusive)
     */
    static range(value, name, min, max) {
        Validators.number(value, name);
        if (value < min || value > max) {
            throw new Error(`${name} must be between ${min} and ${max}`);
        }
    }

    /**
     * Validate that value is a valid color component (0-255)
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static colorComponent(value, name) {
        if (typeof value !== 'number' || value < 0 || value > 255) {
            throw new Error(`${name} must be in range 0-255`);
        }
    }

    /**
     * Validate that value is a normalized value (0-1)
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static normalizedValue(value, name) {
        Validators.number(value, name);
        if (value < 0 || value > 1) {
            throw new Error(`${name} must be between 0 and 1`);
        }
    }

    /**
     * Validate rectangle parameters (all must be numbers)
     * @param {*} x - X coordinate
     * @param {*} y - Y coordinate
     * @param {*} width - Width
     * @param {*} height - Height
     */
    static rectParams(x, y, width, height) {
        if (typeof x !== 'number' || typeof y !== 'number' ||
            typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle parameters must be numbers');
        }
    }

    /**
     * Validate that rectangle dimensions are finite
     * @param {*} x - X coordinate
     * @param {*} y - Y coordinate
     * @param {*} width - Width
     * @param {*} height - Height
     */
    static rectParamsFinite(x, y, width, height) {
        if (typeof x !== 'number' || typeof y !== 'number' ||
            typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Rectangle parameters must be numbers');
        }
        if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height)) {
            throw new Error('Rectangle parameters must be finite numbers');
        }
    }

    /**
     * Validate that value is a string
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static string(value, name) {
        if (typeof value !== 'string') {
            throw new Error(`${name} must be a string`);
        }
    }

    /**
     * Validate that value is an array
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static array(value, name) {
        if (!Array.isArray(value)) {
            throw new Error(`${name} must be an array`);
        }
    }

    /**
     * Validate that value is an instance of a specified class
     * @param {*} value - Value to validate
     * @param {Function} expectedClass - Expected class constructor
     * @param {string} name - Parameter name for error message
     */
    static instanceOf(value, expectedClass, name) {
        if (!(value instanceof expectedClass)) {
            throw new Error(`${name} must be an instance of ${expectedClass.name}`);
        }
    }

    /**
     * Validate that value is defined (not null or undefined)
     * @param {*} value - Value to validate
     * @param {string} name - Parameter name for error message
     */
    static defined(value, name) {
        if (value === null || value === undefined) {
            throw new Error(`${name} must be defined`);
        }
    }
}

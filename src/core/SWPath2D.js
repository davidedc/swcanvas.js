/**
 * SWPath2D - Path command recorder for 2D drawing operations
 *
 * Records path commands (moveTo, lineTo, arc, bezierCurveTo, etc.) for later
 * execution. Used for defining shapes that can be filled, stroked, or used as
 * clip regions. Compatible with HTML5 Canvas Path2D API.
 */
class SWPath2D {
    constructor() {
        this.commands = [];
    }

    closePath() {
        this.commands.push({ type: 'closePath' });
    }

    moveTo(x, y) {
        this.commands.push({ type: 'moveTo', x: x, y: y });
    }

    lineTo(x, y) {
        this.commands.push({ type: 'lineTo', x: x, y: y });
    }

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        this.commands.push({
            type: 'bezierCurveTo',
            cp1x: cp1x,
            cp1y: cp1y,
            cp2x: cp2x,
            cp2y: cp2y,
            x: x,
            y: y
        });
    }

    quadraticCurveTo(cpx, cpy, x, y) {
        this.commands.push({
            type: 'quadraticCurveTo',
            cpx: cpx,
            cpy: cpy,
            x: x,
            y: y
        });
    }

    rect(x, y, w, h) {
        this.moveTo(x, y);
        this.lineTo(x + w, y);
        this.lineTo(x + w, y + h);
        this.lineTo(x, y + h);
        this.closePath();
    }

    /**
     * Adds a rounded rectangle subpath to the current path.
     * Follows the HTML5 Canvas roundRect() specification.
     * @param {number} x - X coordinate of the rectangle's top-left corner
     * @param {number} y - Y coordinate of the rectangle's top-left corner
     * @param {number} width - Width of the rectangle
     * @param {number} height - Height of the rectangle
     * @param {number|number[]} radii - Corner radius (single value or array)
     */
    roundRect(x, y, width, height, radii) {
        // Normalize radii to a single value for simplicity
        // HTML5 Canvas spec allows array of up to 4 values, but we simplify to single radius
        let radius = Array.isArray(radii) ? radii[0] : radii || 0;

        // Clamp radius to half the smaller dimension
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;

        // Handle zero or negative radius - just draw a regular rect
        if (radius <= 0) {
            this.rect(x, y, width, height);
            return;
        }

        // Build path using arcTo for rounded corners
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + radius, y, radius);
        this.closePath();
    }

    arc(x, y, radius, startAngle, endAngle, counterclockwise) {
        this.commands.push({
            type: 'arc',
            x: x,
            y: y,
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle,
            counterclockwise: !!counterclockwise
        });
    }

    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
        this.commands.push({
            type: 'ellipse',
            x: x,
            y: y,
            radiusX: radiusX,
            radiusY: radiusY,
            rotation: rotation,
            startAngle: startAngle,
            endAngle: endAngle,
            counterclockwise: !!counterclockwise
        });
    }

    arcTo(x1, y1, x2, y2, radius) {
        if (
            typeof x1 !== 'number' ||
            typeof y1 !== 'number' ||
            typeof x2 !== 'number' ||
            typeof y2 !== 'number' ||
            typeof radius !== 'number'
        ) {
            const error = new TypeError('All parameters must be numbers');
            error.message = 'TypeError: ' + error.message;
            throw error;
        }

        if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2) || !isFinite(radius)) {
            const error = new TypeError('All parameters must be finite numbers');
            error.message = 'TypeError: ' + error.message;
            throw error;
        }

        if (radius < 0) {
            const error = new Error('IndexSizeError');
            error.name = 'IndexSizeError';
            throw error;
        }

        this.commands.push({
            type: 'arcTo',
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            radius: radius
        });
    }
}

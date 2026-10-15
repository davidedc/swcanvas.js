/**
 * SWPath2D - Path command recorder for 2D drawing operations
 *
 * Records path commands (moveTo, lineTo, arc, bezierCurveTo, etc.) for later
 * execution. Used for defining shapes that can be filled, stroked, or used as
 * clip regions. Compatible with HTML5 Canvas Path2D API.
 *
 * SWPath2D is a pure recorder with no knowledge of any transform — the COORDINATE
 * SPACE of its commands is the responsibility of whoever owns the instance:
 *   - An external Path2D (user code) stores USER-space coordinates and is
 *     transform-independent: the rasterizer applies the draw-time CTM to it.
 *   - Context2D._currentPath (the context's current default path) stores
 *     DEVICE-space coordinates: Context2D bakes the CTM into every coordinate at
 *     build time (see Context2D's path methods) and draws it under IDENTITY.
 * Do not bake or transform coordinates here; that would corrupt external Path2D.
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
     * Adds a rounded rectangle subpath, per HTML5 Canvas roundRect(): per-corner
     * radii in CSS border-radius order, proportionally scaled down when they
     * would overlap (RoundedRectUtils documents the full radii contract). Like
     * HTML5, a non-finite coordinate or radius adds nothing, a negative radius or
     * a list of other than 1-4 radii throws RangeError, and the current point
     * afterwards is (x, y). The one divergence: elliptical ({x, y}) corner radii
     * are rejected with a TypeError.
     * @param {number} x - X coordinate of the rectangle's top-left corner
     * @param {number} y - Y coordinate of the rectangle's top-left corner
     * @param {number} width - Width of the rectangle
     * @param {number} height - Height of the rectangle
     * @param {number|number[]} [radii=0] - Corner radius, or a list of 1-4 corner radii
     */
    roundRect(x, y, width, height, radii) {
        x = +x;
        y = +y;
        width = +width;
        height = +height;
        if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height)) return;
        const corners = RoundedRectUtils.parseCornerRadii(radii);
        if (corners === null) return;
        SWPath2D.appendRoundRect(this, x, y, width, height, corners);
        // HTML5: the current point after roundRect() is (x, y), on a new subpath.
        this.moveTo(x, y);
    }

    /**
     * Emit a rounded rectangle subpath through `sink`'s moveTo/arcTo/rect/
     * closePath - the one geometry shared by SWPath2D.roundRect (user-space
     * recording), Context2D.roundRect (whose own path methods bake the CTM) and
     * the roundRect entries' generic fallbacks. Corners are arcTo corners; a
     * zero-radius corner is arcTo's degenerate lineTo-the-corner, i.e. square.
     * Ends on the closed subpath: the path METHODS then move the current point to
     * (x, y) as HTML5 specifies, which a private one-shot fallback path needs not.
     * @param {{moveTo: Function, arcTo: Function, rect: Function, closePath: Function}} sink
     * @param {number} x - Rectangle x (finite)
     * @param {number} y - Rectangle y (finite)
     * @param {number} width - Rectangle width (finite, may be negative)
     * @param {number} height - Rectangle height (finite, may be negative)
     * @param {number|number[]} corners - RoundedRectUtils.parseCornerRadii's (non-null) result
     */
    static appendRoundRect(sink, x, y, width, height, corners) {
        const fitted = RoundedRectUtils.scaleCornerRadiiToFit(corners, width, height);
        let tl, tr, br, bl;
        if (typeof fitted === 'number') {
            tl = tr = br = bl = fitted;
        } else {
            tl = fitted[0];
            tr = fitted[1];
            br = fitted[2];
            bl = fitted[3];
        }

        // No rounding at all - a plain rect (which also leaves the current point at (x, y)).
        if (tl <= 0 && tr <= 0 && br <= 0 && bl <= 0) {
            sink.rect(x, y, width, height);
            return;
        }

        // A negative width mirrors the rect about its (x, y) corner, so the top-left
        // tangent point steps inward along the top edge's actual direction. (Every
        // other tangent point is implied by arcTo's two lines.)
        const sx = width < 0 ? -1 : 1;

        sink.moveTo(x + sx * tl, y);
        sink.arcTo(x + width, y, x + width, y + height, tr);
        sink.arcTo(x + width, y + height, x, y + height, br);
        sink.arcTo(x, y + height, x, y, bl);
        sink.arcTo(x, y, x + sx * tl, y, tl);
        sink.closePath();
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

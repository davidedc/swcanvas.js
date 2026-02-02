/**
 * RoundedRectUtils - Shared utilities for rounded rectangle rendering
 * Used by both RoundedRectOpsAA and RoundedRectOpsRot.
 */
class RoundedRectUtils {
    /**
     * Normalize radius for rounded rectangle, clamping to valid range.
     * Handles array input (only first element used) and ensures radius
     * doesn't exceed half of either dimension.
     *
     * @param {number|number[]} radii - Corner radius (single value or array)
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @returns {number} Normalized integer radius
     */
    static normalizeRadius(radii, width, height) {
        let radius = Array.isArray(radii) ? radii[0] : radii || 0;
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        return Math.round(Math.min(radius, Math.min(width, height) / 2));
    }

    /**
     * Get edge endpoint definitions for a rounded rectangle in local coordinates
     * (centered at origin). Used for perimeter generation in rotated rendering.
     *
     * @param {number} hw - Half-width
     * @param {number} hh - Half-height
     * @param {number} r - Corner radius
     * @returns {Array<{start: {x: number, y: number}, end: {x: number, y: number}}>}
     */
    static getEdgeEndpoints(hw, hh, r) {
        return [
            { start: { x: -hw + r, y: -hh }, end: { x: hw - r, y: -hh } }, // Top
            { start: { x: hw, y: -hh + r }, end: { x: hw, y: hh - r } }, // Right
            { start: { x: hw - r, y: hh }, end: { x: -hw + r, y: hh } }, // Bottom
            { start: { x: -hw, y: hh - r }, end: { x: -hw, y: -hh + r } } // Left
        ];
    }

    /**
     * Get corner arc definitions for a rounded rectangle in local coordinates
     * (centered at origin). Returns center points and angle ranges for each corner.
     *
     * @param {number} hw - Half-width
     * @param {number} hh - Half-height
     * @param {number} r - Corner radius
     * @returns {Array<{cx: number, cy: number, startAngle: number, endAngle: number}>}
     */
    static getCornerDefinitions(hw, hh, r) {
        return [
            { cx: -hw + r, cy: -hh + r, startAngle: Math.PI, endAngle: THREE_HALF_PI }, // Top-left
            { cx: hw - r, cy: -hh + r, startAngle: THREE_HALF_PI, endAngle: TAU }, // Top-right
            { cx: hw - r, cy: hh - r, startAngle: 0, endAngle: HALF_PI }, // Bottom-right
            { cx: -hw + r, cy: hh - r, startAngle: HALF_PI, endAngle: Math.PI } // Bottom-left
        ];
    }
}

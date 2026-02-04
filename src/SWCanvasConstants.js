/**
 * Centralized constants for SWCanvas.
 * Loaded first in build order - available to all modules.
 *
 * DESIGN PRINCIPLE:
 * The purpose of extracting magic numbers is to give semantic meaning to values
 * that would otherwise be opaque. A constant should answer "what is this value's
 * PURPOSE?" not just "what is this value?"
 *
 * Examples:
 * - FILL_EPSILON = 0.0001      → Good: the name explains WHY this threshold exists
 * - TAU = 2 * Math.PI          → Good: represents "one full turn", a distinct concept
 * - PI = Math.PI               → Bad: just an alias, Math.PI is already perfectly clear
 *
 * We intentionally use Math.PI directly throughout the codebase because it is
 * universally recognized, self-documenting JavaScript.
 */
class SWCanvasConstants {
    // ═══════════════════════════════════════════════════════════════════════
    // CORE GEOMETRY CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    /** Floating-point near-zero threshold for degenerate case detection */
    static FLOAT_EPSILON = 1e-10;

    /** Epsilon for axis-aligned detection in transforms (~0.057 degrees) */
    static TRANSFORM_EPSILON = 0.0001;

    // ═══════════════════════════════════════════════════════════════════════
    // ANGLE CONSTANTS (radians)
    // ═══════════════════════════════════════════════════════════════════════

    /** Full circle: 2π radians (360°) */
    static TAU = 2 * Math.PI;

    /** Quarter turn: π/2 radians (90°) */
    static HALF_PI = Math.PI / 2;

    /** Three-quarter turn: 3π/2 radians (270°) */
    static THREE_HALF_PI = 1.5 * Math.PI;

    /** Eighth turn: π/4 radians (45°) */
    static QUARTER_PI = Math.PI / 4;

    /** Degrees to radians conversion factor: π/180 */
    static DEG_TO_RAD = Math.PI / 180;

    // ═══════════════════════════════════════════════════════════════════════
    // RENDERING TOLERANCES
    // ═══════════════════════════════════════════════════════════════════════

    /** Epsilon for fill boundary contraction to prevent speckles */
    static FILL_EPSILON = 0.0001;

    /** Tolerance for detecting effective 1px strokes */
    static STROKE_1PX_TOLERANCE = 0.001;

    /** Tolerance for axis-aligned rotation detection */
    static ANGLE_TOLERANCE = 0.001;

    /** Tolerance for detecting full circle arcs (arc span ≈ 2π) */
    static ARC_FULLCIRCLE_TOLERANCE = 1e-5;

    /** Minimum edge length worth processing */
    static MIN_EDGE_LENGTH = 0.5;

    /** Minimum edge length squared (for distance comparisons) */
    static MIN_EDGE_LENGTH_SQUARED = 0.25;

    /** Curve flattening tolerance for deterministic behavior */
    static PATH_FLATTENING_TOLERANCE = 0.25;

    // ═══════════════════════════════════════════════════════════════════════
    // LINE/STROKE THRESHOLDS
    // ═══════════════════════════════════════════════════════════════════════

    /** Threshold for thin line vs thick line rendering */
    static THIN_LINE_THRESHOLD = 1.5;

    /** Default miter limit ratio */
    static DEFAULT_MITER_LIMIT = 10.0;
}

// File-scope aliases for zero-overhead access (inlined by JIT compilers)
const FLOAT_EPSILON = SWCanvasConstants.FLOAT_EPSILON;
const TRANSFORM_EPSILON = SWCanvasConstants.TRANSFORM_EPSILON;
const TAU = SWCanvasConstants.TAU;
const HALF_PI = SWCanvasConstants.HALF_PI;
const THREE_HALF_PI = SWCanvasConstants.THREE_HALF_PI;
const QUARTER_PI = SWCanvasConstants.QUARTER_PI;
const DEG_TO_RAD = SWCanvasConstants.DEG_TO_RAD;
const FILL_EPSILON = SWCanvasConstants.FILL_EPSILON;
const STROKE_1PX_TOLERANCE = SWCanvasConstants.STROKE_1PX_TOLERANCE;
const ANGLE_TOLERANCE = SWCanvasConstants.ANGLE_TOLERANCE;
const ARC_FULLCIRCLE_TOLERANCE = SWCanvasConstants.ARC_FULLCIRCLE_TOLERANCE;
const MIN_EDGE_LENGTH = SWCanvasConstants.MIN_EDGE_LENGTH;
const MIN_EDGE_LENGTH_SQUARED = SWCanvasConstants.MIN_EDGE_LENGTH_SQUARED;
const PATH_FLATTENING_TOLERANCE = SWCanvasConstants.PATH_FLATTENING_TOLERANCE;
const THIN_LINE_THRESHOLD = SWCanvasConstants.THIN_LINE_THRESHOLD;
const DEFAULT_MITER_LIMIT = SWCanvasConstants.DEFAULT_MITER_LIMIT;

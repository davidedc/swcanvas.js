/**
 * StrokeGenerator class for SWCanvas
 *
 * Implements geometric stroke generation that converts paths into filled polygons
 * representing stroke geometry. Handles all join types (miter, round, bevel) and
 * cap types (butt, round, square) with proper miter limit handling.
 *
 * Converted from functional to class-based approach following OO best practices:
 * - Static methods for stateless stroke generation
 * - Clear separation of segment, join, and cap generation
 * - Immutable stroke properties with validation
 */
class StrokeGenerator {
    /**
     * Generate stroke polygons for a path with given stroke properties
     * @param {Path2D} path - Path to stroke
     * @param {Object} strokeProps - Stroke properties
     * @param {number} [deviceScale=1] - Device pixels per path unit (the transform's larger axis
     *   scale): round joins and caps are flattened for the size they are drawn at
     * @returns {Array<Array<Point>>} Array of stroke polygons
     */
    static generateStrokePolygons(path, strokeProps, deviceScale = 1) {
        const validatedProps = StrokeGenerator._validateStrokeProperties(strokeProps);
        validatedProps.deviceScale = deviceScale;

        if (validatedProps.lineWidth <= 0) return [];

        // Flatten path to get line segments
        const pathPolygons = PathFlattener.flattenPath(path);

        // Apply dash pattern if specified
        const dashedPolygons = StrokeGenerator._applyDashPattern(pathPolygons, validatedProps);

        const strokePolygons = [];

        for (const polygon of dashedPolygons) {
            if (polygon.length < 2) continue;

            const strokeParts = StrokeGenerator._generateStrokeForPolygon(polygon, validatedProps);
            strokePolygons.push(...strokeParts);
        }

        return strokePolygons;
    }

    /**
     * Validate and normalize stroke properties
     * @param {Object} props - Stroke properties to validate
     * @returns {Object} Validated properties
     * @private
     */
    static _validateStrokeProperties(props) {
        const defaults = {
            lineWidth: 1.0,
            lineJoin: 'miter',
            lineCap: 'butt',
            miterLimit: DEFAULT_MITER_LIMIT,
            lineDash: [],
            lineDashOffset: 0
        };

        const validated = { ...defaults, ...props };

        if (IS_DEBUG) {
            if (validated.lineWidth < 0) {
                throw new Error('lineWidth must not be negative');
            }
            if (!['miter', 'round', 'bevel'].includes(validated.lineJoin)) {
                throw new Error('Invalid lineJoin');
            }
            if (!['butt', 'round', 'square'].includes(validated.lineCap)) {
                throw new Error('Invalid lineCap');
            }
            if (validated.miterLimit <= 0) {
                throw new Error('miterLimit must be positive');
            }
        }

        return validated;
    }

    /**
     * Apply dash pattern to path polygons
     * @param {Array<Array>} pathPolygons - Original path polygons
     * @param {Object} strokeProps - Stroke properties including dash settings
     * @returns {Array<Array>} Dashed polygons (only visible segments)
     * @private
     */
    static _applyDashPattern(pathPolygons, strokeProps) {
        if (!strokeProps.lineDash || strokeProps.lineDash.length === 0) {
            return pathPolygons; // No dashing - return original polygons
        }

        const dashedPolygons = [];

        for (const polygon of pathPolygons) {
            if (polygon.length < 2) continue;

            const dashedSegments = StrokeGenerator._dashPolygon(
                polygon,
                strokeProps.lineDash,
                strokeProps.lineDashOffset
            );

            dashedPolygons.push(...dashedSegments);
        }

        return dashedPolygons;
    }

    /**
     * Apply dash pattern to a single polygon
     * @param {Array} points - Array of {x, y} points
     * @param {Array<number>} lineDash - Dash pattern array
     * @param {number} lineDashOffset - Starting offset
     * @returns {Array<Array>} Array of dashed polygon segments
     * @private
     */
    static _dashPolygon(points, lineDash, lineDashOffset) {
        if (points.length < 2) return [];

        const dashedSegments = [];
        const patternLength = lineDash.reduce((sum, segment) => sum + segment, 0);

        if (patternLength <= 0) {
            return [points]; // Invalid pattern - return original
        }

        // Normalize offset to be within pattern bounds
        let normalizedOffset = lineDashOffset % patternLength;
        if (normalizedOffset < 0) {
            normalizedOffset += patternLength;
        }

        let patternPosition = normalizedOffset;
        let patternIndex = 0;
        let isDash = true; // Start with assuming we're in a dash

        // Find starting pattern index and dash/gap state
        let tempPos = 0;
        for (let i = 0; i < lineDash.length; i++) {
            if (tempPos + lineDash[i] > normalizedOffset) {
                patternIndex = i;
                patternPosition = normalizedOffset - tempPos;
                isDash = i % 2 === 0; // Even indices are dashes, odd are gaps
                break;
            }
            tempPos += lineDash[i];
        }

        let currentSegment = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const segmentLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

            if (segmentLength === 0) continue; // Skip zero-length segments

            const segmentProcessed = StrokeGenerator._processSegmentWithDash(
                p1,
                p2,
                segmentLength,
                lineDash,
                patternIndex,
                patternPosition,
                isDash,
                currentSegment,
                dashedSegments
            );

            // Update state for next segment
            patternIndex = segmentProcessed.patternIndex;
            patternPosition = segmentProcessed.patternPosition;
            isDash = segmentProcessed.isDash;
            currentSegment = segmentProcessed.currentSegment;
        }

        // Add any remaining segment
        if (currentSegment.length > 1) {
            dashedSegments.push(currentSegment);
        }

        return dashedSegments;
    }

    /**
     * Process a single line segment with dash pattern
     * @param {Object} p1 - Start point {x, y}
     * @param {Object} p2 - End point {x, y}
     * @param {number} segmentLength - Length of segment
     * @param {Array<number>} lineDash - Dash pattern
     * @param {number} patternIndex - Current pattern index
     * @param {number} patternPosition - Position within current pattern segment
     * @param {boolean} isDash - Whether currently in dash or gap
     * @param {Array} currentSegment - Current dash segment being built
     * @param {Array} dashedSegments - Array to add completed segments to
     * @returns {Object} Updated state
     * @private
     */
    static _processSegmentWithDash(
        p1,
        p2,
        segmentLength,
        lineDash,
        patternIndex,
        patternPosition,
        isDash,
        currentSegment,
        dashedSegments
    ) {
        let remainingLength = segmentLength;

        // Add start point to current segment if we're in a dash
        if (isDash && currentSegment.length === 0) {
            currentSegment.push({ x: p1.x, y: p1.y });
        }

        while (remainingLength > 0) {
            const currentPatternSegment = lineDash[patternIndex];
            const remainingInPattern = currentPatternSegment - patternPosition;
            const distanceToUse = Math.min(remainingLength, remainingInPattern);

            // Calculate intermediate point
            const t = (segmentLength - remainingLength + distanceToUse) / segmentLength;
            const intermediatePoint = {
                x: p1.x + t * (p2.x - p1.x),
                y: p1.y + t * (p2.y - p1.y)
            };

            if (isDash) {
                currentSegment.push({ x: intermediatePoint.x, y: intermediatePoint.y });
            }

            remainingLength -= distanceToUse;
            patternPosition += distanceToUse;

            // Check if we've completed current pattern segment
            if (patternPosition >= currentPatternSegment) {
                if (isDash && currentSegment.length > 1) {
                    dashedSegments.push(currentSegment);
                    currentSegment = [];
                }

                // Move to next pattern segment
                patternIndex = (patternIndex + 1) % lineDash.length;
                patternPosition = 0;
                isDash = !isDash;

                // Start new segment if entering dash
                if (isDash && remainingLength > 0) {
                    currentSegment = [{ x: intermediatePoint.x, y: intermediatePoint.y }];
                }
            }
        }

        return {
            patternIndex: patternIndex,
            patternPosition: patternPosition,
            isDash: isDash,
            currentSegment: currentSegment
        };
    }

    /**
     * Generate stroke geometry for a single polygon (subpath)
     * @param {Array} points - Array of {x, y} points
     * @param {Object} strokeProps - Validated stroke properties
     * @returns {Array} Array of stroke polygon parts
     * @private
     */
    static _generateStrokeForPolygon(points, strokeProps) {
        if (points.length < 2) return [];

        const strokeParts = [];
        const halfWidth = strokeProps.lineWidth / 2;

        // Determine if this is a closed path
        const isClosed = StrokeGenerator._isPathClosed(points);

        // Generate segment bodies with geometric info
        const segments = StrokeGenerator._generateSegments(points, halfWidth);
        if (segments.length === 0) return [];

        // Generate joins between adjacent segments
        StrokeGenerator._generateJoins(segments, strokeParts, strokeProps, isClosed);

        // Generate caps for open paths
        if (!isClosed && segments.length > 0) {
            StrokeGenerator._generateCaps(segments, strokeParts, strokeProps, halfWidth);
        }

        // Add segment bodies to stroke parts - last, as a join marks the end edges it shares
        // with them (_bodyOutline)
        for (const segment of segments) {
            strokeParts.push(StrokeGenerator._bodyOutline(segment));
        }

        return strokeParts;
    }

    /**
     * Check if path is closed (first and last points are very close)
     * @param {Array} points - Path points
     * @returns {boolean} True if path is closed
     * @private
     */
    static _isPathClosed(points) {
        return (
            points.length > 2 &&
            Math.abs(points[0].x - points[points.length - 1].x) < FLOAT_EPSILON &&
            Math.abs(points[0].y - points[points.length - 1].y) < FLOAT_EPSILON
        );
    }

    /**
     * Generate segment data with geometric information
     * @param {Array} points - Path points
     * @param {number} halfWidth - Half of line width
     * @returns {Array} Array of segment objects with body and geometry
     * @private
     */
    static _generateSegments(points, halfWidth) {
        const segments = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = new Point(points[i].x, points[i].y);
            const p2 = new Point(points[i + 1].x, points[i + 1].y);

            // Skip zero-length segments
            const length = p1.distanceTo(p2);
            if (length < FLOAT_EPSILON) continue;

            const segment = StrokeGenerator._createSegment(p1, p2, halfWidth, length);
            segments.push(segment);
        }

        return segments;
    }

    /**
     * Create a segment object with body and geometry
     * @param {Point} p1 - Start point
     * @param {Point} p2 - End point
     * @param {number} halfWidth - Half line width
     * @param {number} length - Segment length
     * @returns {Object} Segment object
     * @private
     */
    static _createSegment(p1, p2, halfWidth, length) {
        // Calculate unit vectors
        const direction = p2.subtract(p1).scale(1 / length);
        const normal = new Point(-direction.y, direction.x); // Perpendicular

        // Generate rectangular body for segment
        const body = [
            p1.add(normal.scale(halfWidth)).toObject(),
            p2.add(normal.scale(halfWidth)).toObject(),
            p2.add(normal.scale(-halfWidth)).toObject(),
            p1.add(normal.scale(-halfWidth)).toObject()
        ];

        return {
            body: body,
            p1: p1,
            p2: p2,
            tangent: direction,
            normal: normal,
            length: length,
            startJoin: null, // the join point on the start edge, when a join attaches there
            endJoin: null // the join point on the end edge, when a join attaches there
        };
    }

    /**
     * A segment's body as filled: its four corners, with the join point inserted on each end
     * edge a join attaches to. Every join polygon has edges from the join point to the outer
     * (or inner) corners, i.e. along HALF of the body's end edge; with the join point a vertex
     * of the body too, join and body share those half edges with the same two endpoints, which
     * the filler crosses at the bit-identical x from both sides - no gap for a pixel center on
     * the seam to fall into, where the full edge and its half could round 1 ulp apart.
     * @param {Object} seg - Segment
     * @returns {Array<Object>} The body polygon
     * @private
     */
    static _bodyOutline(seg) {
        const b = seg.body;
        if (seg.startJoin === null && seg.endJoin === null) return b;
        const outline = [b[0], b[1]];
        if (seg.endJoin !== null) outline.push(seg.endJoin.toObject());
        outline.push(b[2], b[3]);
        if (seg.startJoin !== null) outline.push(seg.startJoin.toObject());
        return outline;
    }

    /**
     * Generate joins between segments
     * @param {Array} segments - Array of segments
     * @param {Array} strokeParts - Array to append join polygons to
     * @param {Object} strokeProps - Stroke properties
     * @param {boolean} isClosed - Whether path is closed
     * @private
     */
    static _generateJoins(segments, strokeParts, strokeProps, isClosed) {
        // Joins between adjacent segments
        for (let i = 0; i < segments.length - 1; i++) {
            const seg1 = segments[i];
            const seg2 = segments[i + 1];
            const joinPolygons = StrokeGenerator._generateJoin(seg1, seg2, strokeProps);
            strokeParts.push(...joinPolygons);
            seg1.endJoin = seg2.p1;
            seg2.startJoin = seg2.p1;
        }

        // Handle closed path joining (last segment to first segment)
        if (isClosed && segments.length > 1) {
            const lastSeg = segments[segments.length - 1];
            const firstSeg = segments[0];
            const joinPolygons = StrokeGenerator._generateJoin(lastSeg, firstSeg, strokeProps);
            strokeParts.push(...joinPolygons);
            lastSeg.endJoin = firstSeg.p1;
            firstSeg.startJoin = firstSeg.p1;
        }
    }

    /**
     * Generate join geometry between two segments
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Object} strokeProps - Stroke properties
     * @returns {Array} Array of join polygons
     * @private
     */
    static _generateJoin(seg1, seg2, strokeProps) {
        const joinPoint = seg2.p1; // Connection point

        // Calculate cross product to determine turn direction
        const cross = seg1.tangent.cross(seg2.tangent);

        // Check for 180-degree turn (parallel segments)
        if (Math.abs(cross) < FLOAT_EPSILON) {
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint, strokeProps.lineWidth / 2);
        }

        // Generate appropriate join type
        switch (strokeProps.lineJoin) {
            case 'miter':
                return StrokeGenerator._generateMiterJoin(seg1, seg2, joinPoint, strokeProps.miterLimit);
            case 'round':
                return StrokeGenerator._generateRoundJoin(seg1, seg2, joinPoint, strokeProps.deviceScale);
            case 'bevel':
            default:
                return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint, strokeProps.lineWidth / 2);
        }
    }

    /**
     * Whether a miter or bevel join needs its INNER triangle [joinPoint, inner2, inner1] - the
     * inner half of the connecting area between the two bodies' end edges. Every point of that
     * triangle is within both bodies' widths, lies some b behind seg1's end edge and some f
     * ahead of seg2's start edge, with b + f <= halfWidth * |sin(turn)| (0 at joinPoint, the
     * whole amount along inner1-inner2), so it is inside seg1's body where b <= seg1.length or
     * inside seg2's where f <= seg2.length. Whenever seg1.length + seg2.length reaches
     * halfWidth * |sin(turn)| the two bodies therefore cover the whole triangle, and a part
     * inside parts wound the same way adds nothing to a nonzero fill. Only two segments shorter
     * than that together (a thick stroke on a tightly flattened curve, short polyline segments)
     * leave some of it bare, and there it is emitted. (The round join relies on the bodies
     * alone, as these joins then do.)
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {number} halfWidth - Half line width
     * @param {number} cross - seg1.tangent x seg2.tangent, = +/-sin(turn)
     * @returns {boolean} True if the two bodies leave part of the inner triangle uncovered
     * @private
     */
    static _innerTriangleUncovered(seg1, seg2, halfWidth, cross) {
        return seg1.length + seg2.length < halfWidth * Math.abs(cross);
    }

    /**
     * Generate miter join with miter limit checking
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Point} joinPoint - Join point
     * @param {number} miterLimit - Miter limit
     * @returns {Array} Array of join polygons
     * @private
     */
    static _generateMiterJoin(seg1, seg2, joinPoint, miterLimit) {
        // Calculate half width from segment body (same as original)
        const halfWidth =
            Math.sqrt(Math.pow(seg1.body[0].x - seg1.body[3].x, 2) + Math.pow(seg1.body[0].y - seg1.body[3].y, 2)) / 2;

        // Determine which sides are on the outside of the turn
        const cross = seg1.tangent.cross(seg2.tangent);

        let outer1, outer2;
        if (cross > 0) {
            // Left turn - right sides are outer
            outer1 = seg1.body[2]; // Right side of seg1 end
            outer2 = seg2.body[3]; // Right side of seg2 start
        } else {
            // Right turn - left sides are outer
            outer1 = seg1.body[1]; // Left side of seg1 end
            outer2 = seg2.body[0]; // Left side of seg2 start
        }

        // Calculate miter point (intersection of extended outer edges)
        // Extend seg1's outer edge forward
        const seg1Extended = {
            x: outer1.x + seg1.tangent.x * 100,
            y: outer1.y + seg1.tangent.y * 100
        };
        // Extend seg2's outer edge backward
        const seg2Extended = {
            x: outer2.x - seg2.tangent.x * 100,
            y: outer2.y - seg2.tangent.y * 100
        };

        const miterPoint = StrokeGenerator._lineIntersection(outer1, seg1Extended, outer2, seg2Extended);

        if (!miterPoint) {
            // Fallback to bevel if no intersection
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint, halfWidth);
        }

        // Check miter limit
        const miterLength = Math.sqrt(
            Math.pow(miterPoint.x - joinPoint.x, 2) + Math.pow(miterPoint.y - joinPoint.y, 2)
        );
        const miterRatio = miterLength / halfWidth;

        if (miterRatio > miterLimit) {
            // Exceeds miter limit - use bevel
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint, halfWidth);
        }

        // The connecting area [outer1, outer2, inner2, inner1] is two triangles meeting at the
        // join point (its long edges cross there, so as one polygon its halves would wind
        // opposite ways): the outer one joins the miter triangle into one convex kite; the
        // inner one is emitted only where no body covers it (_innerTriangleUncovered)
        const jp = joinPoint.toObject();
        const kite = StrokeGenerator._windLikeBodies([jp, outer1, miterPoint, outer2]);
        if (!StrokeGenerator._innerTriangleUncovered(seg1, seg2, halfWidth, cross)) {
            return [kite];
        }
        let inner1, inner2;
        if (cross > 0) {
            // Left turn - left sides are inner
            inner1 = seg1.body[1]; // Left side of seg1 end
            inner2 = seg2.body[0]; // Left side of seg2 start
        } else {
            // Right turn - right sides are inner
            inner1 = seg1.body[2]; // Right side of seg1 end
            inner2 = seg2.body[3]; // Right side of seg2 start
        }
        return [kite, StrokeGenerator._windLikeBodies([jp, inner2, inner1])];
    }

    /**
     * Generate bevel join
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Point} joinPoint - Join point
     * @param {number} halfWidth - Half line width (decides whether the inner triangle is needed)
     * @returns {Array} The bevel triangle, plus the inner triangle where no body covers it
     * @private
     */
    static _generateBevelJoin(seg1, seg2, joinPoint, halfWidth) {
        const cross = seg1.tangent.cross(seg2.tangent);
        const outerSides = StrokeGenerator._getOuterSides(seg1, seg2, cross);

        // [outer1, outer2, inner2, inner1] is two triangles meeting at the join point (its long
        // edges cross there - see _generateMiterJoin): the outer one is the bevel, the inner one
        // is emitted only where no body covers it (_innerTriangleUncovered)
        const jp = joinPoint.toObject();
        const bevel = StrokeGenerator._windLikeBodies([jp, outerSides.outer1, outerSides.outer2]);
        if (!StrokeGenerator._innerTriangleUncovered(seg1, seg2, halfWidth, cross)) {
            return [bevel];
        }
        const innerSides = StrokeGenerator._getInnerSides(seg1, seg2, cross);
        return [bevel, StrokeGenerator._windLikeBodies([jp, innerSides.inner2, innerSides.inner1])];
    }

    /**
     * Generate round join as ONE pie polygon [joinPoint, outer1, rim..., outer2] whose rim ends
     * are the bodies' own corner objects: its two straight sides are the outer halves of the
     * bodies' end edges, with the same endpoints as the bodies' (_bodyOutline), so no sliver
     * opens between join and body for a pixel center on the seam to fall into
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Point} joinPoint - Join point
     * @param {number} deviceScale - Device pixels per unit (see _roundSegments)
     * @returns {Array} The pie polygon
     * @private
     */
    static _generateRoundJoin(seg1, seg2, joinPoint, deviceScale) {
        // Calculate half width from segment body (distance between top and bottom edges)
        const halfWidth =
            Math.sqrt(Math.pow(seg1.body[0].x - seg1.body[3].x, 2) + Math.pow(seg1.body[0].y - seg1.body[3].y, 2)) / 2;

        // Determine which sides are on the outside of the turn
        const cross = seg1.tangent.cross(seg2.tangent);

        let outer1, outer2;
        if (cross > 0) {
            // Left turn - right sides are outer
            outer1 = seg1.body[2]; // Right side of seg1 end
            outer2 = seg2.body[3]; // Right side of seg2 start
        } else {
            // Right turn - left sides are outer
            outer1 = seg1.body[1]; // Left side of seg1 end
            outer2 = seg2.body[0]; // Left side of seg2 start
        }

        // Calculate angles
        const angle1 = Math.atan2(outer1.y - joinPoint.y, outer1.x - joinPoint.x);
        const angle2 = Math.atan2(outer2.y - joinPoint.y, outer2.x - joinPoint.x);

        let startAngle = angle1;
        let endAngle = angle2;

        // Normalize angles to go the correct way around (from original implementation)
        let angleDiff = endAngle - startAngle;
        if (angleDiff > Math.PI) {
            angleDiff -= TAU;
        } else if (angleDiff < -Math.PI) {
            angleDiff += TAU;
        }

        // We want to go the convex way (positive turn)
        const swapped = angleDiff < 0;
        if (swapped) {
            // Swap to go positive direction
            const temp = startAngle;
            startAngle = endAngle;
            endAngle = temp;
            angleDiff = -angleDiff;
        }

        const segments = StrokeGenerator._roundSegments(angleDiff, halfWidth, deviceScale);
        const angleStep = angleDiff / segments;

        // The rim from startAngle; its two ends are the corners themselves
        const pie = [joinPoint.toObject()];
        for (let i = 0; i <= segments; i++) {
            const a = startAngle + i * angleStep;
            pie.push({
                x: joinPoint.x + halfWidth * Math.cos(a),
                y: joinPoint.y + halfWidth * Math.sin(a)
            });
        }
        pie[1] = swapped ? outer2 : outer1;
        pie[segments + 1] = swapped ? outer1 : outer2;

        return [StrokeGenerator._windLikeBodies(pie)];
    }

    /**
     * How many chords flatten a round join's or cap's arc of `angle` radians and radius
     * `halfWidth`, drawn at `deviceScale` device pixels per unit: as many as keep every chord
     * within PATH_FLATTENING_TOLERANCE device pixels of the circle (like a path's own arcs,
     * Context2D._arcSegmentCount), and never fewer than one per quarter-PI (nor than 2) - so
     * small round parts keep their shape and large ones stay round. Both quotients go through
     * PathFlattener.segmentCount, so the rounding noise of an angle read back from
     * position-dependent corners (a right angle's 2 + noise) cannot add a chord.
     * @param {number} angle - Arc angle in radians (non-negative)
     * @param {number} halfWidth - Arc radius in path units
     * @param {number} deviceScale - Device pixels per path unit
     * @returns {number} Chord count
     * @private
     */
    static _roundSegments(angle, halfWidth, deviceScale) {
        const quarters = PathFlattener.segmentCount(angle / QUARTER_PI);
        const radius = Math.max(halfWidth * deviceScale, TRANSFORM_EPSILON);
        let maxAngleStep = 2 * Math.acos(Math.max(0, 1 - PATH_FLATTENING_TOLERANCE / radius));
        if (!(maxAngleStep > TRANSFORM_EPSILON)) maxAngleStep = TRANSFORM_EPSILON;
        const byTolerance = PathFlattener.segmentCount(angle / maxAngleStep);
        return Math.max(2, quarters, byTolerance);
    }

    /**
     * Generate caps for open paths
     * @param {Array} segments - Array of segments
     * @param {Array} strokeParts - Array to append cap polygons to
     * @param {Object} strokeProps - Stroke properties
     * @param {number} halfWidth - Half line width
     * @private
     */
    static _generateCaps(segments, strokeParts, strokeProps, halfWidth) {
        // Start cap (closing on the first body's start edge, body[3] -> body[0])
        const firstSeg = segments[0];
        const startCaps = StrokeGenerator._generateCap(
            firstSeg.p1,
            firstSeg.tangent,
            halfWidth,
            strokeProps.lineCap,
            true,
            firstSeg.body[0],
            firstSeg.body[3],
            strokeProps.deviceScale
        );
        if (startCaps) {
            strokeParts.push(...(Array.isArray(startCaps[0]) ? startCaps : [startCaps]));
        }

        // End cap (closing on the last body's end edge, body[1] -> body[2])
        const lastSeg = segments[segments.length - 1];
        const endCaps = StrokeGenerator._generateCap(
            lastSeg.p2,
            lastSeg.tangent,
            halfWidth,
            strokeProps.lineCap,
            false,
            lastSeg.body[1],
            lastSeg.body[2],
            strokeProps.deviceScale
        );
        if (endCaps) {
            strokeParts.push(...(Array.isArray(endCaps[0]) ? endCaps : [endCaps]));
        }
    }

    /**
     * Generate cap geometry
     * @param {Point} point - Cap point
     * @param {Point} tangent - Tangent direction
     * @param {number} halfWidth - Half line width
     * @param {string} lineCap - Cap type
     * @param {boolean} isStart - Whether this is start cap
     * @param {Object} plusCorner - The body's corner at point + normal * halfWidth
     * @param {Object} minusCorner - The body's corner at point - normal * halfWidth
     * @param {number} deviceScale - Device pixels per unit (see _roundSegments)
     * @returns {Array|null} Cap polygons or null for butt caps
     * @private
     */
    static _generateCap(point, tangent, halfWidth, lineCap, isStart, plusCorner, minusCorner, deviceScale) {
        const normal = new Point(-tangent.y, tangent.x);

        switch (lineCap) {
            case 'square':
                return StrokeGenerator._generateSquareCap(point, tangent, normal, halfWidth, isStart);
            case 'round':
                return StrokeGenerator._generateRoundCap(
                    point,
                    normal,
                    halfWidth,
                    isStart,
                    plusCorner,
                    minusCorner,
                    deviceScale
                );
            case 'butt':
            default:
                return null; // No cap geometry needed
        }
    }

    /**
     * Generate square cap
     * @param {Point} point - Cap center point
     * @param {Point} tangent - Tangent direction
     * @param {Point} normal - Normal direction
     * @param {number} halfWidth - Half line width
     * @param {boolean} isStart - Whether this is start cap
     * @returns {Array} Square cap polygon
     * @private
     */
    static _generateSquareCap(point, tangent, normal, halfWidth, isStart) {
        const extension = isStart ? point.subtract(tangent.scale(halfWidth)) : point.add(tangent.scale(halfWidth));

        return [
            StrokeGenerator._windLikeBodies([
                extension.add(normal.scale(halfWidth)).toObject(),
                extension.subtract(normal.scale(halfWidth)).toObject(),
                point.subtract(normal.scale(halfWidth)).toObject(),
                point.add(normal.scale(halfWidth)).toObject()
            ])
        ];
    }

    /**
     * Generate round cap as ONE half-disc polygon whose diameter IS the body's end edge: its two
     * ends are the body's own corner objects, so cap and body meet along one edge with the same
     * two endpoints - not along two separately computed lines, and with no fan edges inside the
     * cap - leaving no sliver between them for a pixel center on the seam to fall into.
     * @param {Point} point - Cap center point
     * @param {Point} normal - Normal direction
     * @param {number} halfWidth - Half line width
     * @param {boolean} isStart - Whether this is start cap
     * @param {Object} plusCorner - The body's corner at point + normal * halfWidth
     * @param {Object} minusCorner - The body's corner at point - normal * halfWidth
     * @param {number} deviceScale - Device pixels per unit (see _roundSegments)
     * @returns {Array} One polygon
     * @private
     */
    static _generateRoundCap(point, normal, halfWidth, isStart, plusCorner, minusCorner, deviceScale) {
        const startAngle = Math.atan2(normal.y, normal.x);
        const rim = StrokeGenerator._generateArcRim(
            point,
            halfWidth,
            startAngle,
            startAngle + Math.PI * (isStart ? 1 : -1),
            deviceScale
        );
        rim[0] = plusCorner;
        rim[rim.length - 1] = minusCorner;
        return [StrokeGenerator._windLikeBodies(rim)];
    }

    // Helper methods

    /**
     * Get outer edge points for join calculation
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {number} cross - Cross product
     * @returns {Object} {outer1, outer2}
     * @private
     */
    static _getOuterSides(seg1, seg2, cross) {
        if (cross > 0) {
            // Left turn - right sides are outer
            return {
                outer1: seg1.body[2], // Right side of seg1 end
                outer2: seg2.body[3] // Right side of seg2 start
            };
        } else {
            // Right turn - left sides are outer
            return {
                outer1: seg1.body[1], // Left side of seg1 end
                outer2: seg2.body[0] // Left side of seg2 start
            };
        }
    }

    /**
     * Get inner edge points for join calculation
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {number} cross - Cross product
     * @returns {Object} {inner1, inner2}
     * @private
     */
    static _getInnerSides(seg1, seg2, cross) {
        if (cross > 0) {
            // Left turn - left sides are inner
            return {
                inner1: seg1.body[1], // Left side of seg1 end
                inner2: seg2.body[0] // Left side of seg2 start
            };
        } else {
            // Right turn - right sides are inner
            return {
                inner1: seg1.body[2], // Right side of seg1 end
                inner2: seg2.body[3] // Right side of seg2 start
            };
        }
    }

    /**
     * Calculate intersection of two lines defined by points
     * @param {Object} p1 - First line point 1
     * @param {Object} p2 - First line point 2
     * @param {Object} p3 - Second line point 1
     * @param {Object} p4 - Second line point 2
     * @returns {Object|null} Intersection point or null if parallel
     * @private
     */
    static _lineIntersection(p1, p2, p3, p4) {
        const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);

        if (Math.abs(denom) < FLOAT_EPSILON) {
            return null; // Lines are parallel
        }

        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;

        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y)
        };
    }

    /**
     * The rim of an arc as its flattened points p(a0) ... p(an), a0 = startAngle, an = endAngle
     * (a round cap closes it with the diameter)
     * @param {Point} center - Arc center
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {number} deviceScale - Device pixels per unit (see _roundSegments)
     * @returns {Array<Object>} The rim points {x, y}
     * @private
     */
    static _generateArcRim(center, radius, startAngle, endAngle, deviceScale) {
        let angleDiff = endAngle - startAngle;

        // Normalize angle difference. The epsilon tolerance is essential for round
        // CAPS: a cap requests a sweep of exactly +/-PI (a half circle) in a known
        // direction. Without the tolerance, FP rounding of the caller's angles can
        // make angleDiff land at -PI-eps (or +PI+eps), which the naive wrap flips to
        // +PI-eps — reversing the sweep so the half-disc is generated on the WRONG
        // side (into the line body) and the outward dome silently disappears. Which
        // rotations trip this is essentially random, so caps drop out at scattered
        // angles and any size. Tolerating a hair past +/-PI preserves the requested
        // direction; the extra fraction of a degree of sweep is harmless.
        while (angleDiff > Math.PI + FLOAT_EPSILON) angleDiff -= TAU;
        while (angleDiff < -Math.PI - FLOAT_EPSILON) angleDiff += TAU;

        // A cap's half turn is exactly 4 quarter-PIs up to the rounding of startAngle +/- PI.
        const segments = StrokeGenerator._roundSegments(Math.abs(angleDiff), radius, deviceScale);
        const angleStep = angleDiff / segments;

        const rim = [];
        for (let i = 0; i <= segments; i++) {
            const a = startAngle + i * angleStep;
            rim.push({
                x: center.x + radius * Math.cos(a),
                y: center.y + radius * Math.sin(a)
            });
        }

        return rim;
    }

    /**
     * Wind a stroke part the way every segment body winds, reversing it in place if needed.
     * A stroke covers the union of its swept parts (the HTML spec's traced path is "the edge of
     * the areas that would be covered" by the swept line), and SWCanvas fills the parts together
     * under the nonzero rule: a part wound against the others subtracts instead of adding, so
     * where it overlaps another part of the same stroke() - a round or square cap on a crossing
     * line, a join on a short neighbour - the overlap sums to winding 0 and is left unpainted.
     * A body [p1+n, p2+n, p2-n, p1-n] (n = the tangent turned +90deg) has a negative signed area
     * (shoelace sum); the decision reads the whole polygon's signed area, not one corner's, so a
     * near-collinear first corner (a kite at a near-straight join) cannot flip it. The sum is
     * taken relative to the first point, so a small part far from the origin keeps its sign.
     * @param {Array<Object>} poly - Simple polygon points {x, y} (a part: 3 to ~6 points)
     * @returns {Array<Object>} The same array, wound like the bodies
     * @private
     */
    static _windLikeBodies(poly) {
        const x0 = poly[0].x,
            y0 = poly[0].y;
        let twiceArea = 0;
        for (let i = 1, n = poly.length - 1; i < n; i++) {
            const p = poly[i],
                q = poly[i + 1];
            twiceArea += (p.x - x0) * (q.y - y0) - (q.x - x0) * (p.y - y0);
        }
        if (twiceArea > 0) poly.reverse();
        return poly;
    }
}

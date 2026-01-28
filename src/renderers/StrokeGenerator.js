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
     * @returns {Array<Array<Point>>} Array of stroke polygons
     */
    static generateStrokePolygons(path, strokeProps) {
        const validatedProps = StrokeGenerator._validateStrokeProperties(strokeProps);
        
        if (validatedProps.lineWidth <= 0) return [];
        
        // Flatten path to get line segments
        const pathPolygons = PathFlattener.flattenPath(path);
        
        // Apply dash pattern if specified
        const dashedPolygons = StrokeGenerator._applyDashPattern(pathPolygons, validatedProps);
        
        const strokePolygons = [];
        
        for (const polygon of dashedPolygons) {
            if (polygon.length < 2) continue;
            
            const strokeParts = StrokeGenerator._generateStrokeForPolygon(
                polygon, validatedProps
            );
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
        
        let currentDistance = 0;
        let patternPosition = normalizedOffset;
        let patternIndex = 0;
        let isDash = true; // Start with assuming we're in a dash
        
        // Find starting pattern index and dash/gap state
        let tempPos = 0;
        for (let i = 0; i < lineDash.length; i++) {
            if (tempPos + lineDash[i] > normalizedOffset) {
                patternIndex = i;
                patternPosition = normalizedOffset - tempPos;
                isDash = (i % 2 === 0); // Even indices are dashes, odd are gaps
                break;
            }
            tempPos += lineDash[i];
        }
        
        let currentSegment = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            
            const segmentLength = Math.sqrt(
                Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
            );
            
            if (segmentLength === 0) continue; // Skip zero-length segments
            
            const segmentProcessed = StrokeGenerator._processSegmentWithDash(
                p1, p2, segmentLength, lineDash, patternIndex, patternPosition, 
                isDash, currentSegment, dashedSegments
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
    static _processSegmentWithDash(p1, p2, segmentLength, lineDash, patternIndex, patternPosition, isDash, currentSegment, dashedSegments) {
        let remainingLength = segmentLength;
        let currentPoint = p1;
        
        // Add start point to current segment if we're in a dash
        if (isDash && currentSegment.length === 0) {
            currentSegment.push({x: p1.x, y: p1.y});
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
                currentSegment.push({x: intermediatePoint.x, y: intermediatePoint.y});
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
                    currentSegment = [{x: intermediatePoint.x, y: intermediatePoint.y}];
                }
            }
            
            currentPoint = intermediatePoint;
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
        
        // Add segment bodies to stroke parts
        for (const segment of segments) {
            strokeParts.push(segment.body);
        }
        
        // Generate joins between adjacent segments
        StrokeGenerator._generateJoins(segments, strokeParts, strokeProps, isClosed);
        
        // Generate caps for open paths
        if (!isClosed && segments.length > 0) {
            StrokeGenerator._generateCaps(segments, strokeParts, strokeProps, halfWidth);
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
        return points.length > 2 && 
               Math.abs(points[0].x - points[points.length - 1].x) < FLOAT_EPSILON &&
               Math.abs(points[0].y - points[points.length - 1].y) < FLOAT_EPSILON;
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
            length: length
        };
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
        }
        
        // Handle closed path joining (last segment to first segment)
        if (isClosed && segments.length > 1) {
            const lastSeg = segments[segments.length - 1];
            const firstSeg = segments[0];
            const joinPolygons = StrokeGenerator._generateJoin(lastSeg, firstSeg, strokeProps);
            strokeParts.push(...joinPolygons);
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
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint);
        }
        
        // Generate appropriate join type
        switch (strokeProps.lineJoin) {
            case 'miter':
                return StrokeGenerator._generateMiterJoin(seg1, seg2, joinPoint, strokeProps.miterLimit);
            case 'round':
                return StrokeGenerator._generateRoundJoin(seg1, seg2, joinPoint);
            case 'bevel':
            default:
                return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint);
        }
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
        const halfWidth = Math.sqrt(
            Math.pow(seg1.body[0].x - seg1.body[3].x, 2) + 
            Math.pow(seg1.body[0].y - seg1.body[3].y, 2)
        ) / 2;
        
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
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint);
        }
        
        // Check miter limit
        const miterLength = Math.sqrt(
            Math.pow(miterPoint.x - joinPoint.x, 2) + 
            Math.pow(miterPoint.y - joinPoint.y, 2)
        );
        const miterRatio = miterLength / halfWidth;
        
        if (miterRatio > miterLimit) {
            // Exceeds miter limit - use bevel
            return StrokeGenerator._generateBevelJoin(seg1, seg2, joinPoint);
        }
        
        // For miter join, we need to fill both the miter triangle and the inner area
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
        
        // Create miter triangle and inner quadrilateral
        return [
            [outer1, miterPoint, outer2],  // Miter triangle
            [outer1, outer2, inner2, inner1]  // Inner connecting area
        ];
    }
    
    /**
     * Generate bevel join
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Point} joinPoint - Join point
     * @returns {Array} Array containing single bevel polygon
     * @private
     */
    static _generateBevelJoin(seg1, seg2, joinPoint) {
        const cross = seg1.tangent.cross(seg2.tangent);
        const outerSides = StrokeGenerator._getOuterSides(seg1, seg2, cross);
        const innerSides = StrokeGenerator._getInnerSides(seg1, seg2, cross);
        
        return [[
            outerSides.outer1, outerSides.outer2, 
            innerSides.inner2, innerSides.inner1
        ]];
    }
    
    /**
     * Generate round join
     * @param {Object} seg1 - First segment
     * @param {Object} seg2 - Second segment
     * @param {Point} joinPoint - Join point
     * @returns {Array} Array of triangular fan polygons
     * @private
     */
    static _generateRoundJoin(seg1, seg2, joinPoint) {
        // Calculate half width from segment body (distance between top and bottom edges)
        const halfWidth = Math.sqrt(
            Math.pow(seg1.body[0].x - seg1.body[3].x, 2) + 
            Math.pow(seg1.body[0].y - seg1.body[3].y, 2)
        ) / 2;
        
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
        if (angleDiff < 0) {
            // Swap to go positive direction
            const temp = startAngle;
            startAngle = endAngle;
            endAngle = temp;
            angleDiff = -angleDiff;
        }
        
        const segments = Math.max(2, Math.ceil(angleDiff / (QUARTER_PI))); // At least 2 segments
        const angleStep = angleDiff / segments;
        
        const triangles = [];
        for (let i = 0; i < segments; i++) {
            const a1 = startAngle + i * angleStep;
            const a2 = startAngle + (i + 1) * angleStep;
            
            const p1 = {
                x: joinPoint.x + halfWidth * Math.cos(a1),
                y: joinPoint.y + halfWidth * Math.sin(a1)
            };
            const p2 = {
                x: joinPoint.x + halfWidth * Math.cos(a2),
                y: joinPoint.y + halfWidth * Math.sin(a2)
            };
            
            triangles.push([joinPoint.toObject(), p1, p2]);
        }
        
        return triangles;
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
        // Start cap
        const startCaps = StrokeGenerator._generateCap(
            segments[0].p1, segments[0].tangent, halfWidth, strokeProps.lineCap, true
        );
        if (startCaps) {
            strokeParts.push(...(Array.isArray(startCaps[0]) ? startCaps : [startCaps]));
        }
        
        // End cap
        const lastSeg = segments[segments.length - 1];
        const endCaps = StrokeGenerator._generateCap(
            lastSeg.p2, lastSeg.tangent, halfWidth, strokeProps.lineCap, false
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
     * @returns {Array|null} Cap polygons or null for butt caps
     * @private
     */
    static _generateCap(point, tangent, halfWidth, lineCap, isStart) {
        const normal = new Point(-tangent.y, tangent.x);
        
        switch (lineCap) {
            case 'square':
                return StrokeGenerator._generateSquareCap(point, tangent, normal, halfWidth, isStart);
            case 'round':
                return StrokeGenerator._generateRoundCap(point, normal, halfWidth, isStart);
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
        const extension = isStart ? 
            point.subtract(tangent.scale(halfWidth)) :
            point.add(tangent.scale(halfWidth));
        
        return [[
            extension.add(normal.scale(halfWidth)).toObject(),
            extension.subtract(normal.scale(halfWidth)).toObject(),
            point.subtract(normal.scale(halfWidth)).toObject(),
            point.add(normal.scale(halfWidth)).toObject()
        ]];
    }
    
    /**
     * Generate round cap as semicircular fan
     * @param {Point} point - Cap center point
     * @param {Point} normal - Normal direction
     * @param {number} halfWidth - Half line width
     * @param {boolean} isStart - Whether this is start cap
     * @returns {Array} Array of triangular fan segments
     * @private
     */
    static _generateRoundCap(point, normal, halfWidth, isStart) {
        const startAngle = Math.atan2(normal.y, normal.x);
        return StrokeGenerator._generateArcFan(
            point, halfWidth, startAngle, startAngle + Math.PI * (isStart ? 1 : -1)
        );
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
                outer2: seg2.body[3]  // Right side of seg2 start
            };
        } else {
            // Right turn - left sides are outer
            return {
                outer1: seg1.body[1], // Left side of seg1 end
                outer2: seg2.body[0]  // Left side of seg2 start
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
                inner2: seg2.body[0]  // Left side of seg2 start
            };
        } else {
            // Right turn - right sides are inner
            return {
                inner1: seg1.body[2], // Right side of seg1 end
                inner2: seg2.body[3]  // Right side of seg2 start
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
     * Generate triangular fan for arcs (used by round joins and caps)
     * @param {Point} center - Arc center
     * @param {number} radius - Arc radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @returns {Array} Array of triangles
     * @private
     */
    static _generateArcFan(center, radius, startAngle, endAngle) {
        let angleDiff = endAngle - startAngle;
        
        // Normalize angle difference
        while (angleDiff > Math.PI) angleDiff -= TAU;
        while (angleDiff < -Math.PI) angleDiff += TAU;
        
        const absAngle = Math.abs(angleDiff);
        const segments = Math.max(2, Math.ceil(absAngle / (QUARTER_PI)));
        const angleStep = angleDiff / segments;
        
        const triangles = [];
        for (let i = 0; i < segments; i++) {
            const a1 = startAngle + i * angleStep;
            const a2 = startAngle + (i + 1) * angleStep;
            
            const p1 = {
                x: center.x + radius * Math.cos(a1),
                y: center.y + radius * Math.sin(a1)
            };
            const p2 = {
                x: center.x + radius * Math.cos(a2),
                y: center.y + radius * Math.sin(a2)
            };
            
            triangles.push([center.toObject(), p1, p2]);
        }
        
        return triangles;
    }
}
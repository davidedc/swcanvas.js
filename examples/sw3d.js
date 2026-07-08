/**
 * SW3D — a minimal software 3D engine over the SWCanvas Core primitives
 * (DepthBuffer + Triangle3DOps). This is the userland "engine layer": SWCanvas
 * itself only provides depth-tested screen-space triangles/spans (in the
 * spirit of PICO-8's tline); everything scene-related lives here.
 *
 * Pipeline per mesh (flat-shaded, per-face lighting, like the classic PICO-8
 * engines — but z-buffered, so interpenetrating geometry is exact):
 *
 *   model rotation + translation -> camera space -> bounding-sphere reject
 *   -> per face: backface cull -> Lambert intensity -> near-plane clip
 *   (Sutherland-Hodgman with UV interpolation) -> perspective projection
 *   -> Triangle3DOps.fillTriangleZ / fillTriangleTexturedPersp
 *
 * Conventions: right-handed, +x right, +y up, +z forward (away from camera);
 * camera looks along +z. Faces use OUTWARD winding (right-hand rule normals).
 *
 * Works in Node (module.exports) and the browser (global SW3D).
 */
(function (global) {
    'use strict';

    // ---------------------------------------------------------------- math

    /** Row-major 3x3 rotation matrix from euler angles (applied z*y*x). */
    function mat3FromEuler(ax, ay, az) {
        var sx = Math.sin(ax),
            cx = Math.cos(ax);
        var sy = Math.sin(ay),
            cy = Math.cos(ay);
        var sz = Math.sin(az),
            cz = Math.cos(az);
        return [
            cz * cy,
            cz * sy * sx - sz * cx,
            cz * sy * cx + sz * sx,
            sz * cy,
            sz * sy * sx + cz * cx,
            sz * sy * cx - cz * sx,
            -sy,
            cy * sx,
            cy * cx
        ];
    }

    function mat3Transpose(m) {
        return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
    }

    function mat3Mul(a, b) {
        return [
            a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
            a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
            a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
            a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
            a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
            a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
            a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
            a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
            a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
        ];
    }

    function mat3MulVec(m, x, y, z, out) {
        out[0] = m[0] * x + m[1] * y + m[2] * z;
        out[1] = m[3] * x + m[4] * y + m[5] * z;
        out[2] = m[6] * x + m[7] * y + m[8] * z;
        return out;
    }

    // ---------------------------------------------------------------- mesh

    /**
     * Build a mesh.
     * @param {Object} def
     * @param {number[]} def.positions - flat [x,y,z, x,y,z, ...]
     * @param {Object[]} def.faces - {v: [i,j,k] or [i,j,k,l] (outward winding),
     *   color: [r,g,b]} and optionally {texture: Texture3D, uv: [[u,v],...] per
     *   face vertex, texel units}
     * @returns {Object} mesh
     */
    function makeMesh(def) {
        var positions = new Float64Array(def.positions);
        var n = positions.length / 3;
        var radius = 0;
        for (var i = 0; i < n; i++) {
            var d =
                positions[i * 3] * positions[i * 3] +
                positions[i * 3 + 1] * positions[i * 3 + 1] +
                positions[i * 3 + 2] * positions[i * 3 + 2];
            if (d > radius) radius = d;
        }
        return {
            positions: positions,
            vertexCount: n,
            faces: def.faces,
            radius: Math.sqrt(radius)
        };
    }

    // Unit-cube corners (half-size 1) and outward-wound quad faces — the same
    // tables the cubes demo uses, kept here so consumers need no scene file.
    var BOX_CORNERS = [
        [-1, -1, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [-1, 1, 1]
    ];
    var BOX_FACES = [
        [0, 3, 2, 1], // front  (-z)
        [4, 5, 6, 7], // back   (+z)
        [0, 4, 7, 3], // left   (-x)
        [1, 2, 6, 5], // right  (+x)
        [3, 7, 6, 2], // top    (+y)
        [0, 1, 5, 4] // bottom (-y)
    ];

    /**
     * Build a flat-shaded axis-aligned box mesh centered at the origin.
     * @param {number} [size=1] - edge length
     * @param {number[]} [color=[200,200,200]] - [r,g,b], applied to every face
     */
    function makeBoxMesh(size, color) {
        var h = (size === undefined ? 1 : size) * 0.5;
        var col = color || [200, 200, 200];
        var positions = [];
        for (var i = 0; i < 8; i++) {
            positions.push(BOX_CORNERS[i][0] * h, BOX_CORNERS[i][1] * h, BOX_CORNERS[i][2] * h);
        }
        var faces = [];
        for (var f = 0; f < BOX_FACES.length; f++) {
            faces.push({ v: BOX_FACES[f], color: col });
        }
        return makeMesh({ positions: positions, faces: faces });
    }

    /**
     * Build a flat-shaded UV sphere centered at the origin, outward-wound.
     * @param {number} [radius=0.5]
     * @param {number} [bandsH=12] - longitude segments (around +y)
     * @param {number} [bandsV=8] - latitude bands (pole to pole)
     * @param {number[]} [color=[200,200,200]] - [r,g,b], applied to every face
     */
    function makeSphereMesh(radius, bandsH, bandsV, color) {
        radius = radius === undefined ? 0.5 : radius;
        bandsH = bandsH || 12;
        bandsV = bandsV || 8;
        var col = color || [200, 200, 200];
        var positions = [];
        // (bandsV+1) rings x (bandsH+1) verts, seam column duplicated so the
        // longitude wrap needs no modulo. Pole rings collapse to a point.
        for (var i = 0; i <= bandsV; i++) {
            var theta = (Math.PI * i) / bandsV; // 0 = north (+y), PI = south (-y)
            var st = Math.sin(theta);
            var ct = Math.cos(theta);
            for (var j = 0; j <= bandsH; j++) {
                var phi = (2 * Math.PI * j) / bandsH;
                positions.push(radius * st * Math.cos(phi), radius * ct, radius * st * Math.sin(phi));
            }
        }
        var stride = bandsH + 1;
        var faces = [];
        for (i = 0; i < bandsV; i++) {
            for (j = 0; j < bandsH; j++) {
                var a = i * stride + j;
                var b = i * stride + (j + 1);
                var c = (i + 1) * stride + (j + 1);
                var d = (i + 1) * stride + j;
                if (i === 0) {
                    // north cap triangle (a,b degenerate at the pole)
                    faces.push({ v: [a, c, d], color: col });
                } else if (i === bandsV - 1) {
                    // south cap triangle (c,d degenerate at the pole)
                    faces.push({ v: [a, b, c], color: col });
                } else {
                    faces.push({ v: [a, b, c, d], color: col });
                }
            }
        }
        return makeMesh({ positions: positions, faces: faces });
    }

    // -------------------------------------------------------------- engine

    /**
     * Create an engine bound to a render size.
     * @param {Object} SWCanvas - the SWCanvas module/global
     * @param {Object} opts - {width, height, focal?, znear?, light?, ambient?, diffuse?}
     */
    function makeEngine(SWCanvas, opts) {
        var Triangle3DOps = SWCanvas.Core.Triangle3DOps;

        var width = opts.width;
        var height = opts.height;
        var cx = width * 0.5;
        var cy = height * 0.5;
        var focal = opts.focal || height * 1.1;
        var znear = opts.znear || 0.1;
        var ambient = opts.ambient !== undefined ? opts.ambient : 0.3;
        var diffuse = opts.diffuse !== undefined ? opts.diffuse : 0.7;

        // Camera state
        var camPos = [0, 0, 0];
        var viewRot = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // world -> camera rotation

        // Light: world-space direction TOWARD the light; camera-space copy
        var lightWorld = opts.light || [-0.45, 0.6, -0.66];
        (function () {
            var l = Math.sqrt(lightWorld[0] * lightWorld[0] + lightWorld[1] * lightWorld[1] + lightWorld[2] * lightWorld[2]);
            lightWorld = [lightWorld[0] / l, lightWorld[1] / l, lightWorld[2] / l];
        })();
        var lightCam = lightWorld.slice();

        // Scratch buffers, grown to the largest mesh seen
        var camX = new Float64Array(64);
        var camY = new Float64Array(64);
        var camZ = new Float64Array(64);
        var scratch = [0, 0, 0];

        // Near-clip scratch: a triangle/quad clipped by one plane has <= 5 verts
        var clipX = new Float64Array(5),
            clipY = new Float64Array(5),
            clipZ = new Float64Array(5),
            clipU = new Float64Array(5),
            clipV = new Float64Array(5);

        function packColor(r, g, b) {
            return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
        }

        function ensureCapacity(n) {
            if (camX.length < n) {
                camX = new Float64Array(n);
                camY = new Float64Array(n);
                camZ = new Float64Array(n);
            }
        }

        /**
         * Position the camera.
         * @param {number[]} pos - world position [x,y,z]
         * @param {number[]|number} rot - 3x3 camera orientation matrix, or yaw
         *   (rotation about +y) as a number
         */
        function setCamera(pos, rot) {
            camPos[0] = pos[0];
            camPos[1] = pos[1];
            camPos[2] = pos[2];
            var m = typeof rot === 'number' ? mat3FromEuler(0, rot, 0) : rot;
            viewRot = mat3Transpose(m);
            mat3MulVec(viewRot, lightWorld[0], lightWorld[1], lightWorld[2], lightCam);
        }

        /**
         * Draw a mesh. Interpenetration with anything already drawn is
         * handled by the depth buffer - draw order does not matter.
         * @param {Object} target - Surface or {width, height, data32}
         * @param {DepthBuffer} depthBuffer
         * @param {Object} mesh - from makeMesh
         * @param {number[]} position - world position
         * @param {number[]|number[]} rotation - 3x3 matrix or [ax, ay, az] euler
         * @param {Uint8Array|null} [clipBuffer]
         * @returns {number} triangles emitted
         */
        function drawMesh(target, depthBuffer, mesh, position, rotation, clipBuffer) {
            clipBuffer = clipBuffer || null;

            // Resolve the model linear map. A 9-element array is a general
            // row-major 3x3 (may carry scale / shear / mirror); a 3-element
            // array is euler angles -> a pure rotation (radiusScale 1, det > 0).
            var modelRot, radiusScale, mirrored;
            if (rotation.length === 9) {
                modelRot = rotation;
                var mr = modelRot;
                // The bounding-sphere radius must grow with how much the matrix
                // stretches space, else a scaled-up mesh is wrongly rejected
                // (gap 1). Max column norm = the largest per-axis stretch; exact
                // for rotation*scale, conservative for shear.
                var cn0 = Math.sqrt(mr[0] * mr[0] + mr[3] * mr[3] + mr[6] * mr[6]);
                var cn1 = Math.sqrt(mr[1] * mr[1] + mr[4] * mr[4] + mr[7] * mr[7]);
                var cn2 = Math.sqrt(mr[2] * mr[2] + mr[5] * mr[5] + mr[8] * mr[8]);
                radiusScale = cn0 > cn1 ? (cn0 > cn2 ? cn0 : cn2) : cn1 > cn2 ? cn1 : cn2;
                // A negative determinant (mirror / negative scale, which LCL's
                // `scale -1` produces) flips triangle winding and would invert
                // the backface test (gap 2). Reverse each face's winding below.
                var det =
                    mr[0] * (mr[4] * mr[8] - mr[5] * mr[7]) -
                    mr[1] * (mr[3] * mr[8] - mr[5] * mr[6]) +
                    mr[2] * (mr[3] * mr[7] - mr[4] * mr[6]);
                mirrored = det < 0;
            } else {
                modelRot = mat3FromEuler(rotation[0], rotation[1], rotation[2]);
                radiusScale = 1;
                mirrored = false;
            }
            var effRadius = mesh.radius * radiusScale;

            // model -> camera rotation and translation
            var M = mat3Mul(viewRot, modelRot);
            mat3MulVec(
                viewRot,
                position[0] - camPos[0],
                position[1] - camPos[1],
                position[2] - camPos[2],
                scratch
            );
            var tx = scratch[0],
                ty = scratch[1],
                tz = scratch[2];

            // Bounding-sphere rejects: entirely behind the near plane, or
            // entirely outside the view cone (conservative screen-bounds test)
            if (tz + effRadius < znear) return 0;
            if (tz - effRadius > znear) {
                var rProj = (effRadius * focal) / (tz - effRadius);
                var pcx = cx + (tx * focal) / tz;
                var pcy = cy - (ty * focal) / tz;
                if (pcx + rProj < 0 || pcx - rProj > width || pcy + rProj < 0 || pcy - rProj > height) return 0;
            }

            var nv = mesh.vertexCount;
            ensureCapacity(nv);
            var P = mesh.positions;
            for (var i = 0; i < nv; i++) {
                var px = P[i * 3],
                    py = P[i * 3 + 1],
                    pz = P[i * 3 + 2];
                camX[i] = M[0] * px + M[1] * py + M[2] * pz + tx;
                camY[i] = M[3] * px + M[4] * py + M[5] * pz + ty;
                camZ[i] = M[6] * px + M[7] * py + M[8] * pz + tz;
            }

            var emitted = 0;
            var faces = mesh.faces;
            for (var f = 0; f < faces.length; f++) {
                var face = faces[f];
                var vi = face.v;
                var count = vi.length;
                // Winding-corrected slots: keep vertex 0 as the fan apex and
                // reverse the rest when the model matrix mirrors (gap 2), so
                // the normal below and the emitted fan stay outward-wound.
                var s1 = mirrored ? count - 1 : 1;
                var s2 = mirrored ? count - 2 : 2;
                var i0 = vi[0],
                    i1 = vi[s1],
                    i2 = vi[s2];

                // Backface cull: outward normal vs view vector (camera at origin)
                var e1x = camX[i1] - camX[i0],
                    e1y = camY[i1] - camY[i0],
                    e1z = camZ[i1] - camZ[i0];
                var e2x = camX[i2] - camX[i0],
                    e2y = camY[i2] - camY[i0],
                    e2z = camZ[i2] - camZ[i0];
                var nx = e1y * e2z - e1z * e2y;
                var ny = e1z * e2x - e1x * e2z;
                var nz = e1x * e2y - e1y * e2x;
                if (nx * camX[i0] + ny * camY[i0] + nz * camZ[i0] >= 0) continue;

                // Flat Lambert
                var nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
                var lambert = (nx * lightCam[0] + ny * lightCam[1] + nz * lightCam[2]) * nl;
                var intensity = ambient + diffuse * Math.max(0, lambert);
                if (intensity > 1) intensity = 1;

                // Gather the face polygon (3 or 4 verts) into clip scratch,
                // in winding-corrected order (see s1/s2 above)
                var uv = face.uv;
                for (var k = 0; k < count; k++) {
                    var srcSlot = mirrored && k > 0 ? count - k : k;
                    var idx = vi[srcSlot];
                    clipX[k] = camX[idx];
                    clipY[k] = camY[idx];
                    clipZ[k] = camZ[idx];
                    if (uv) {
                        clipU[k] = uv[srcSlot][0];
                        clipV[k] = uv[srcSlot][1];
                    }
                }

                // Near-plane clip (Sutherland-Hodgman, z >= znear keeps)
                var needClip = false;
                var behind = 0;
                for (k = 0; k < count; k++) {
                    if (clipZ[k] < znear) behind++;
                }
                if (behind === count) continue;
                if (behind > 0) {
                    count = clipPolyNear(count, znear, !!uv);
                    if (count < 3) continue;
                    needClip = true;
                }

                // Project and emit a triangle fan
                emitted += emitFan(
                    target,
                    depthBuffer,
                    count,
                    face,
                    intensity,
                    clipBuffer
                );
                if (needClip) {
                    // scratch was overwritten by the clipper; nothing to restore
                }
            }
            return emitted;
        }

        // Clip the polygon in clip scratch against z = znear; returns new count
        function clipPolyNear(count, zn, hasUV) {
            // Output into temp arrays then copy back (max count+1 verts)
            var ox = [],
                oy = [],
                oz = [],
                ou = [],
                ov = [];
            var jPrev = count - 1;
            for (var j = 0; j < count; j++) {
                var zP = clipZ[jPrev],
                    zC = clipZ[j];
                var inP = zP >= zn,
                    inC = zC >= zn;
                if (inC !== inP) {
                    var t = (zn - zP) / (zC - zP);
                    ox.push(clipX[jPrev] + t * (clipX[j] - clipX[jPrev]));
                    oy.push(clipY[jPrev] + t * (clipY[j] - clipY[jPrev]));
                    oz.push(zn);
                    if (hasUV) {
                        ou.push(clipU[jPrev] + t * (clipU[j] - clipU[jPrev]));
                        ov.push(clipV[jPrev] + t * (clipV[j] - clipV[jPrev]));
                    }
                }
                if (inC) {
                    ox.push(clipX[j]);
                    oy.push(clipY[j]);
                    oz.push(clipZ[j]);
                    if (hasUV) {
                        ou.push(clipU[j]);
                        ov.push(clipV[j]);
                    }
                }
                jPrev = j;
            }
            for (j = 0; j < ox.length; j++) {
                clipX[j] = ox[j];
                clipY[j] = oy[j];
                clipZ[j] = oz[j];
                if (hasUV) {
                    clipU[j] = ou[j];
                    clipV[j] = ov[j];
                }
            }
            return ox.length;
        }

        // Project clip scratch verts and emit fan triangles for the face
        var prX = new Float64Array(5),
            prY = new Float64Array(5),
            prIZ = new Float64Array(5);

        function emitFan(target, depthBuffer, count, face, intensity, clipBuffer) {
            for (var k = 0; k < count; k++) {
                var iz = 1 / clipZ[k];
                prX[k] = cx + clipX[k] * focal * iz;
                prY[k] = cy - clipY[k] * focal * iz;
                prIZ[k] = iz;
            }
            var emitted = 0;
            if (face.texture) {
                // Pre-modulated texture variant + copy-only span fast path:
                // lit rendering at unlit speed (intensity quantized to 1/32)
                var lit = Math.min(256, (intensity * 256) | 0);
                var litTex = face.texture;
                if (litTex.litVariant) {
                    litTex = litTex.litVariant(lit);
                    lit = 256; // variant already carries the (quantized) brightness
                }
                for (k = 2; k < count; k++) {
                    Triangle3DOps.fillTriangleTexturedPersp(
                        target,
                        depthBuffer,
                        prX[0],
                        prY[0],
                        prIZ[0],
                        clipU[0],
                        clipV[0],
                        prX[k - 1],
                        prY[k - 1],
                        prIZ[k - 1],
                        clipU[k - 1],
                        clipV[k - 1],
                        prX[k],
                        prY[k],
                        prIZ[k],
                        clipU[k],
                        clipV[k],
                        litTex,
                        lit,
                        clipBuffer
                    );
                    emitted++;
                }
            } else {
                var c = face.color;
                var packed = packColor((c[0] * intensity) | 0, (c[1] * intensity) | 0, (c[2] * intensity) | 0);
                for (k = 2; k < count; k++) {
                    Triangle3DOps.fillTriangleZ(
                        target,
                        depthBuffer,
                        prX[0],
                        prY[0],
                        prIZ[0],
                        prX[k - 1],
                        prY[k - 1],
                        prIZ[k - 1],
                        prX[k],
                        prY[k],
                        prIZ[k],
                        packed,
                        clipBuffer
                    );
                    emitted++;
                }
            }
            return emitted;
        }

        return {
            width: width,
            height: height,
            znear: znear,
            setCamera: setCamera,
            drawMesh: drawMesh,
            packColor: packColor
        };
    }

    var SW3D = {
        makeEngine: makeEngine,
        makeMesh: makeMesh,
        makeBoxMesh: makeBoxMesh,
        makeSphereMesh: makeSphereMesh,
        mat3FromEuler: mat3FromEuler,
        mat3Transpose: mat3Transpose,
        mat3Mul: mat3Mul
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SW3D;
    } else {
        global.SW3D = SW3D;
    }
})(typeof window !== 'undefined' ? window : globalThis);

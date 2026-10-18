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
 * A second path, for large or animated meshes (makeTriMesh / drawTriMesh /
 * resolve), takes GL / glTF / three.js conventions instead (camera looking
 * down its -z, counter-clockwise front faces, 3x4 matrices), and typed-array
 * indexed triangles:
 *
 *   per mesh: model x view -> bounding-sphere and normal-cone rejects ->
 *   per-vertex transform + projection (perspective, or orthographic for
 *   shadow maps) -> per face: screen-space cull -> colour, or an id with the
 *   quantized N.L ('id' mode) -> Triangle3DOps.fillTriangleZ (near-clipped
 *   faces go through a 3D clipper)
 *
 * resolve() then runs once per pixel over an id buffer, like a deferred
 * fragment shader: palette lookup with a lit / shadow tone (toon shading),
 * a shadow-map test, outlines on id and depth edges, fog, and a background.
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

        // ------------------------------------------- triangle-mesh path (GL)
        //
        // drawTriMesh draws makeTriMesh meshes. It uses the GL conventions
        // described at makeTriMesh (camera looks down its own -z), with its
        // own view matrix (setView) and light (setLightDir), separate from
        // the polygon path's setCamera.
        //
        // Projection: perspective (focal, znear, optional zfar), or
        // orthographic when opts.projection === 'orthographic' (for shadow
        // maps): screen = centre + camera xy * orthoScale pixels per unit, and
        // the depth value is (orthoFar + camera z) instead of 1/z. It is
        // affine in the position, so Triangle3DOps' linear interpolation is
        // exact, and larger still means nearer. Geometry must lie less than
        // orthoFar units in front of the camera.
        var orthographic = opts.projection === 'orthographic';
        var orthoScale = opts.orthoScale || (opts.orthoHalfHeight ? cy / opts.orthoHalfHeight : 1);
        var orthoFar = opts.orthoFar || 1000;
        var zfar = opts.zfar || Infinity;

        var glView = mat34Identity(new Float64Array(12));
        var glLightCam = [0, 0, 1];
        var mvScratch = new Float64Array(12);

        // Per-vertex scratch, grown to the largest mesh seen: camera-space
        // position, and projected screen position + depth value (0 = behind
        // the near plane / beyond orthoFar)
        var tvx = new Float64Array(64),
            tvy = new Float64Array(64),
            tvz = new Float64Array(64);
        var tsx = new Float64Array(64),
            tsy = new Float64Array(64),
            tsz = new Float64Array(64);

        function ensureTriCapacity(n) {
            if (tvx.length < n) {
                tvx = new Float64Array(n);
                tvy = new Float64Array(n);
                tvz = new Float64Array(n);
                tsx = new Float64Array(n);
                tsy = new Float64Array(n);
                tsz = new Float64Array(n);
            }
        }

        function updateGlLight() {
            var v = glView;
            glLightCam[0] = v[0] * lightWorld[0] + v[1] * lightWorld[1] + v[2] * lightWorld[2];
            glLightCam[1] = v[4] * lightWorld[0] + v[5] * lightWorld[1] + v[6] * lightWorld[2];
            glLightCam[2] = v[8] * lightWorld[0] + v[9] * lightWorld[1] + v[10] * lightWorld[2];
        }

        /**
         * Set the triangle-mesh view: a 3x4 world -> camera matrix (see
         * lookAt). The camera looks down its -z axis.
         */
        function setView(view) {
            for (var i = 0; i < 12; i++) glView[i] = view[i];
            updateGlLight();
        }

        /** Set the world-space direction TOWARD the light (normalized here). */
        function setLightDir(dir) {
            var l = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
            lightWorld = [dir[0] / l, dir[1] / l, dir[2] / l];
            mat3MulVec(viewRot, lightWorld[0], lightWorld[1], lightWorld[2], lightCam);
            updateGlLight();
        }

        // Is a camera-space sphere (centre x,y,z; radius r) possibly visible?
        function sphereInView(x, y, z, r) {
            if (orthographic) {
                if (-z - r > orthoFar) return false;
                var sr = r * orthoScale;
                var px = cx + x * orthoScale;
                var py = cy - y * orthoScale;
                return !(px + sr < 0 || px - sr > width || py + sr < 0 || py - sr > height);
            }
            var d = -z;
            if (d + r < znear || d - r > zfar) return false;
            if (d - r > znear) {
                var rProj = (r * focal) / (d - r);
                var pcx = cx + (x * focal) / d;
                var pcy = cy - (y * focal) / d;
                if (pcx + rProj < 0 || pcx - rProj > width || pcy + rProj < 0 || pcy - rProj > height) return false;
            }
            return true;
        }

        /**
         * Draw a triangle mesh (from makeTriMesh).
         * @param {Object} target - Surface or {width, height, data32}
         * @param {DepthBuffer} depthBuffer - same size as target
         * @param {Object} mesh - from makeTriMesh
         * @param {number[]|null} model - 3x4 model -> world matrix, or null
         *   for world-space positions
         * @param {Object} [options]
         * @param {string} [options.mode='color'] - 'color': faceColors with
         *   Lambert (ambient + diffuse * max(0, N.L)); 'id': writes
         *   (faceIds[f] << 6) | ndl into the target, where ndl is N.L
         *   quantized from [-1, 1] to 0..63 — the input of resolve(); 'depth':
         *   depth only (for shadow maps; the target still receives zeros)
         * @param {string} [options.cull='back'] - 'back', 'front' or 'none'
         * @param {Uint8Array|null} [options.clipBuffer]
         * @returns {number} triangles emitted
         */
        function drawTriMesh(target, depthBuffer, mesh, model, options) {
            var o = options || {};
            var mode = o.mode === 'id' ? 1 : o.mode === 'depth' ? 2 : 0;
            var cullSign = o.cull === 'none' ? 0 : o.cull === 'front' ? -1 : 1;
            var clipBuffer = o.clipBuffer || null;

            var m = model ? mat34Mul(glView, model, mvScratch) : glView;
            var scale = 1;
            var mirrored = false;
            if (model) {
                scale = maxColumnNorm(model);
                mirrored = det3(model) < 0;
            }

            // Bounding-sphere reject
            var c = mesh.center;
            var ccx = m[0] * c[0] + m[1] * c[1] + m[2] * c[2] + m[3];
            var ccy = m[4] * c[0] + m[5] * c[1] + m[6] * c[2] + m[7];
            var ccz = m[8] * c[0] + m[9] * c[1] + m[10] * c[2] + m[11];
            var r = mesh.radius * scale;
            if (!sphereInView(ccx, ccy, ccz, r)) return 0;

            // Normal-cone reject: every face of the mesh faces away from the
            // camera (see makeTriMesh). Only for back-face culling and
            // rotation-only models, where the cone stays a cone.
            if (cullSign === 1 && mesh.coneSin <= 1 && !mirrored && Math.abs(scale - 1) < 1e-6) {
                var a = mesh.coneAxis;
                var ax = m[0] * a[0] + m[1] * a[1] + m[2] * a[2];
                var ay = m[4] * a[0] + m[5] * a[1] + m[6] * a[2];
                var az = m[8] * a[0] + m[9] * a[1] + m[10] * a[2];
                if (orthographic) {
                    // view direction is (0, 0, -1)
                    if (-az >= mesh.coneSin) return 0;
                } else {
                    var dist = Math.sqrt(ccx * ccx + ccy * ccy + ccz * ccz);
                    if (ccx * ax + ccy * ay + ccz * az >= mesh.coneSin * (dist + r) + r) return 0;
                }
            }

            // Transform and project the vertices
            var nv = mesh.vertexCount;
            ensureTriCapacity(nv);
            var P = mesh.positions;
            var m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
            var m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
            var m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
            var i, px, py, pz, x, y, z, iz;
            for (i = 0; i < nv; i++) {
                px = P[i * 3];
                py = P[i * 3 + 1];
                pz = P[i * 3 + 2];
                x = m0 * px + m1 * py + m2 * pz + m3;
                y = m4 * px + m5 * py + m6 * pz + m7;
                z = m8 * px + m9 * py + m10 * pz + m11;
                tvx[i] = x;
                tvy[i] = y;
                tvz[i] = z;
                if (orthographic) {
                    tsx[i] = cx + x * orthoScale;
                    tsy[i] = cy - y * orthoScale;
                    iz = orthoFar + z;
                    tsz[i] = iz > 0 ? iz : 0;
                } else if (-z >= znear) {
                    iz = -1 / z;
                    tsx[i] = cx + x * focal * iz;
                    tsy[i] = cy - y * focal * iz;
                    tsz[i] = iz;
                } else {
                    tsz[i] = 0;
                }
            }

            var I = mesh.indices;
            var faceColors = mesh.faceColors;
            var faceIds = mesh.faceIds;
            var lx = glLightCam[0], ly = glLightCam[1], lz = glLightCam[2];
            var nf = mesh.faceCount;
            var emitted = 0;
            var W = width, H = height;
            for (var f = 0; f < nf; f++) {
                var i0 = I[f * 3];
                var i1 = I[f * 3 + 1];
                var i2 = I[f * 3 + 2];
                if (mirrored) {
                    var t = i1;
                    i1 = i2;
                    i2 = t;
                }
                var z0 = tsz[i0], z1 = tsz[i1], z2 = tsz[i2];
                var inFront = z0 > 0 && z1 > 0 && z2 > 0;
                var sx0, sy0, sx1, sy1, sx2, sy2;
                if (inFront) {
                    sx0 = tsx[i0];
                    sy0 = tsy[i0];
                    sx1 = tsx[i1];
                    sy1 = tsy[i1];
                    sx2 = tsx[i2];
                    sy2 = tsy[i2];
                    // Screen-space cull: counter-clockwise front faces turn
                    // clockwise on the y-down screen (negative signed area)
                    var area = (sx1 - sx0) * (sy2 - sy0) - (sy1 - sy0) * (sx2 - sx0);
                    if (area === 0 || (cullSign !== 0 && area * cullSign > 0)) continue;
                    // Off-screen and sample-free rejects (cheaper than the call)
                    var minX = sx0 < sx1 ? (sx0 < sx2 ? sx0 : sx2) : sx1 < sx2 ? sx1 : sx2;
                    var maxX = sx0 > sx1 ? (sx0 > sx2 ? sx0 : sx2) : sx1 > sx2 ? sx1 : sx2;
                    if (maxX < 0 || minX >= W || Math.ceil(minX) >= Math.ceil(maxX)) continue;
                    var minY = sy0 < sy1 ? (sy0 < sy2 ? sy0 : sy2) : sy1 < sy2 ? sy1 : sy2;
                    var maxY = sy0 > sy1 ? (sy0 > sy2 ? sy0 : sy2) : sy1 > sy2 ? sy1 : sy2;
                    if (maxY < 0 || minY >= H || Math.ceil(minY) >= Math.ceil(maxY)) continue;
                } else if (orthographic || (z0 === 0 && z1 === 0 && z2 === 0)) {
                    continue; // beyond orthoFar, or wholly behind the near plane
                }

                // Face colour / id (camera-space normal for Lambert)
                var packed = 0;
                if (mode !== 2) {
                    var e1x = tvx[i1] - tvx[i0], e1y = tvy[i1] - tvy[i0], e1z = tvz[i1] - tvz[i0];
                    var e2x = tvx[i2] - tvx[i0], e2y = tvy[i2] - tvy[i0], e2z = tvz[i2] - tvz[i0];
                    var nx = e1y * e2z - e1z * e2y;
                    var ny = e1z * e2x - e1x * e2z;
                    var nz = e1x * e2y - e1y * e2x;
                    var nlen = Math.sqrt(nx * nx + ny * ny + nz * nz);
                    var ndl = nlen > 0 ? (nx * lx + ny * ly + nz * lz) / nlen : 0;
                    if (mode === 1) {
                        var q = ((ndl + 1) * 32) | 0;
                        packed = ((faceIds[f] << 6) | (q > 63 ? 63 : q < 0 ? 0 : q)) >>> 0;
                    } else {
                        var intensity = ambient + diffuse * (ndl > 0 ? ndl : 0);
                        if (intensity > 1) intensity = 1;
                        var fc = faceColors ? faceColors[f] : 0xffc8c8c8;
                        packed = packColor(
                            ((fc & 0xff) * intensity) | 0,
                            (((fc >>> 8) & 0xff) * intensity) | 0,
                            (((fc >>> 16) & 0xff) * intensity) | 0
                        );
                    }
                }

                if (inFront) {
                    Triangle3DOps.fillTriangleZ(
                        target, depthBuffer,
                        sx0, sy0, z0, sx1, sy1, z1, sx2, sy2, z2,
                        packed, clipBuffer
                    );
                    emitted++;
                } else {
                    emitted += drawTriClipped(target, depthBuffer, i0, i1, i2, cullSign, packed, clipBuffer);
                }
            }
            return emitted;
        }

        // Near-clip (perspective) a triangle whose camera-space vertices are
        // in tvx/tvy/tvz, then project and fan-fill it
        var gx = new Float64Array(4), gy = new Float64Array(4), gd = new Float64Array(4);
        var hx = new Float64Array(4), hy = new Float64Array(4), hz = new Float64Array(4);
        function drawTriClipped(target, depthBuffer, i0, i1, i2, cullSign, packed, clipBuffer) {
            // Cull in 3D: the normal faces the camera (at the origin) iff
            // n . v0 < 0
            if (cullSign !== 0) {
                var e1x = tvx[i1] - tvx[i0], e1y = tvy[i1] - tvy[i0], e1z = tvz[i1] - tvz[i0];
                var e2x = tvx[i2] - tvx[i0], e2y = tvy[i2] - tvy[i0], e2z = tvz[i2] - tvz[i0];
                var s =
                    (e1y * e2z - e1z * e2y) * tvx[i0] +
                    (e1z * e2x - e1x * e2z) * tvy[i0] +
                    (e1x * e2y - e1y * e2x) * tvz[i0];
                if (s * cullSign >= 0) return 0;
            }
            var idx = [i0, i1, i2];
            var n = 0;
            for (var k = 0; k < 3; k++) {
                var a = idx[k], b = idx[(k + 1) % 3];
                var da = -tvz[a], db = -tvz[b];
                var inA = da >= znear, inB = db >= znear;
                if (inA) {
                    gx[n] = tvx[a];
                    gy[n] = tvy[a];
                    gd[n] = da;
                    n++;
                }
                if (inA !== inB) {
                    var t = (znear - da) / (db - da);
                    gx[n] = tvx[a] + t * (tvx[b] - tvx[a]);
                    gy[n] = tvy[a] + t * (tvy[b] - tvy[a]);
                    gd[n] = znear;
                    n++;
                }
            }
            if (n < 3) return 0;
            for (k = 0; k < n; k++) {
                var iz = 1 / gd[k];
                hx[k] = cx + gx[k] * focal * iz;
                hy[k] = cy - gy[k] * focal * iz;
                hz[k] = iz;
            }
            for (k = 2; k < n; k++) {
                Triangle3DOps.fillTriangleZ(
                    target, depthBuffer,
                    hx[0], hy[0], hz[0], hx[k - 1], hy[k - 1], hz[k - 1], hx[k], hy[k], hz[k],
                    packed, clipBuffer
                );
            }
            return n - 2;
        }

        /**
         * Draw point sprites: camera-facing squares cut out by a mask, like
         * GL point sprites with an alpha-tested texture (leaves, particles).
         * Each sprite is centred on a world point, has a half-size in world
         * units and a rotation in the image plane, and writes one value at
         * one depth, its centre's: a flat card. Depth-tested and written
         * like drawTriMesh.
         *
         * @param {Object} target - Surface or {width, height, data32}
         * @param {DepthBuffer} depthBuffer
         * @param {Object} sprites - {count,
         *   positions: Float32Array (3 per sprite, world),
         *   size: Float32Array (half-size, world units),
         *   angle: Float32Array (rotation, radians),
         *   values: Uint32Array (a colour, or in 'id' mode a face id),
         *   normals: Float32Array (3 per sprite, unit; for 'id' and cull),
         *   shape: Uint8Array (index into options.masks; default 0),
         *   center, radius: a world bounding sphere (optional; the whole set
         *   is skipped when it is out of view)}
         * @param {Object} options
         * @param {Object[]} options.masks - [{width, height, data:
         *   Uint8Array, non-zero inside}], sampled nearest; from
         *   SW3D.makeSpriteMask, at the level that suits the sprite's size
         * @param {string} [options.mode='color'] - 'color'; 'id':
         *   (value << 6) | the sprite normal's N.L quantized as in
         *   drawTriMesh; 'depth': depth only
         * @param {number} [options.cull] - skip sprites whose normal makes
         *   N.V below this with the direction to the viewer (e.g. -0.3)
         * @param {number} [options.push=0] - world units to move each card
         *   away from the viewer before the depth test (negative: toward it)
         * @returns {number} sprites drawn
         */
        function drawSprites(target, depthBuffer, sprites, options) {
            var o = options || {};
            var mode = o.mode === 'id' ? 1 : o.mode === 'depth' ? 2 : 0;
            var masks = o.masks;
            var cull = o.cull !== undefined ? o.cull : -Infinity;
            var push = o.push || 0;
            var out = target.data32, D = depthBuffer.data;
            var W = width, H = height;
            var P = sprites.positions, S = sprites.size, A = sprites.angle, V = sprites.values;
            var N = sprites.normals || null, shape = sprites.shape || null;
            var m = glView;
            var bc = sprites.center;
            if (bc && !sphereInView(
                m[0] * bc[0] + m[1] * bc[1] + m[2] * bc[2] + m[3],
                m[4] * bc[0] + m[5] * bc[1] + m[6] * bc[2] + m[7],
                m[8] * bc[0] + m[9] * bc[1] + m[10] * bc[2] + m[11],
                sprites.radius
            )) return 0;
            var lx = glLightCam[0], ly = glLightCam[1], lz = glLightCam[2];
            var drawn = 0;
            for (var s = 0; s < sprites.count; s++) {
                var px = P[s * 3], py = P[s * 3 + 1], pz = P[s * 3 + 2];
                var x = m[0] * px + m[1] * py + m[2] * pz + m[3];
                var y = m[4] * px + m[5] * py + m[6] * pz + m[7];
                var z = m[8] * px + m[9] * py + m[10] * pz + m[11];
                if (!orthographic && -z < znear) continue;
                var ndl = 0;
                if (N !== null) {
                    var nx = N[s * 3], ny = N[s * 3 + 1], nz = N[s * 3 + 2];
                    var cnx = m[0] * nx + m[1] * ny + m[2] * nz;
                    var cny = m[4] * nx + m[5] * ny + m[6] * nz;
                    var cnz = m[8] * nx + m[9] * ny + m[10] * nz;
                    // N.V: toward the viewer is +z (orthographic) or -p
                    var nv = orthographic ? cnz : -(cnx * x + cny * y + cnz * z) / Math.sqrt(x * x + y * y + z * z);
                    if (nv < cull) continue;
                    ndl = cnx * lx + cny * ly + cnz * lz;
                }
                var size = S[s];
                var R, sx, sy, iz;
                if (orthographic) {
                    R = size * orthoScale;
                    sx = cx + x * orthoScale;
                    sy = cy - y * orthoScale;
                    iz = orthoFar + z - push;
                } else {
                    var f = focal / -z;
                    R = size * f;
                    sx = cx + x * f;
                    sy = cy - y * f;
                    iz = 1 / (push - z);
                }
                var c = Math.cos(A[s]), sn = Math.sin(A[s]);
                var E = R * ((c < 0 ? -c : c) + (sn < 0 ? -sn : sn));
                var x0 = Math.ceil(sx - E - 0.5), x1 = Math.floor(sx + E - 0.5);
                var y0 = Math.ceil(sy - E - 0.5), y1 = Math.floor(sy + E - 0.5);
                if (x0 < 0) x0 = 0;
                if (y0 < 0) y0 = 0;
                if (x1 >= W) x1 = W - 1;
                if (y1 >= H) y1 = H - 1;
                if (x0 > x1 || y0 > y1) continue;
                var mask = masks[shape !== null ? shape[s] : 0];
                var levels = mask.levels;
                if (levels) {
                    // the coarsest level with at least a texel per pixel
                    var l = 0;
                    while (l + 1 < levels.length && levels[l + 1].width >= 2 * R) l++;
                    mask = levels[l];
                }
                var mw = mask.width, mh = mask.height, md = mask.data;
                // mask coordinates step linearly along a row
                var kx = (mw * 0.5) / R, ky = (mh * 0.5) / R;
                var ux = c * kx, vx = -sn * ky; // per pixel in x
                var uy = sn * kx, vy = c * ky; // per pixel in y
                var value = mode === 1
                    ? ((V[s] << 6) | Math.min(63, Math.max(0, ((ndl + 1) * 32) | 0))) >>> 0
                    : V[s];
                var hit = false;
                for (var yy = y0; yy <= y1; yy++) {
                    var dy = yy + 0.5 - sy, dx = x0 + 0.5 - sx;
                    var u = dx * ux + dy * uy + mw * 0.5;
                    var v = dx * vx + dy * vy + mh * 0.5;
                    // only the run of this row inside the (rotated) card
                    var t0 = 0, t1 = x1 - x0;
                    if (ux > 0) { t0 = Math.max(t0, Math.floor(-u / ux)); t1 = Math.min(t1, Math.ceil((mw - u) / ux)); }
                    else if (ux < 0) { t0 = Math.max(t0, Math.floor((mw - u) / ux)); t1 = Math.min(t1, Math.ceil(-u / ux)); }
                    if (vx > 0) { t0 = Math.max(t0, Math.floor(-v / vx)); t1 = Math.min(t1, Math.ceil((mh - v) / vx)); }
                    else if (vx < 0) { t0 = Math.max(t0, Math.floor((mh - v) / vx)); t1 = Math.min(t1, Math.ceil(-v / vx)); }
                    if (t0 > t1) continue;
                    u += ux * t0;
                    v += vx * t0;
                    var i = yy * W + x0 + t0;
                    for (var t = t0; t <= t1; t++, i++, u += ux, v += vx) {
                        if (u < 0 || v < 0 || u >= mw || v >= mh) continue;
                        if (md[(v | 0) * mw + (u | 0)] === 0 || iz <= D[i]) continue;
                        D[i] = iz;
                        if (mode !== 2) out[i] = value;
                        hit = true;
                    }
                }
                if (hit) drawn++;
            }
            return drawn;
        }

        /**
         * Paint a sky dome onto the pixels where nothing was drawn (ids 0),
         * after resolve(): a scalar field (clouds, say) mapped on a sphere
         * around the camera, and the colour of the row wherever the field
         * reaches a threshold. Each pixel looks where its view ray leaves the
         * sphere; the texture coordinates there are three.js SphereGeometry's,
         * after `rotation`: u = atan2(z, -x) / 2pi around y, v = 1 - acos(y) / pi
         * (1 at the top). They are computed exactly every `step` pixels and
         * interpolated between, so a pixel costs one bilinear field sample.
         * Perspective engines only.
         *
         * @param {Object} target - Surface or {width, height, data32}
         * @param {Uint32Array} ids - the id buffer (0: nothing drawn)
         * @param {Object} dome
         * @param {number[]} dome.center - world centre of the sphere
         * @param {number} dome.radius - the camera must be inside
         * @param {number[]} [dome.rotation] - 3x3 row-major, world -> sphere
         * @param {Object} dome.field - {width, height, data: Uint8Array},
         *   covering u (wrapping) and v once, row 0 at v = 0
         * @param {number} dome.threshold - field level (0..255) for colour
         * @param {Uint32Array} dome.rows - a packed colour per pixel row
         * @param {number} [dome.step=8] - grid spacing in pixels
         * @returns {number} pixels painted
         */
        function drawDome(target, ids, dome) {
            var W = width, H = height, out = target.data32;
            var step = dome.step || 8;
            var F = dome.field, FW = F.width, FH = F.height, FD = F.data;
            var thr = dome.threshold, rows = dome.rows;
            var rot = dome.rotation || [1, 0, 0, 0, 1, 0, 0, 0, 1];
            var m = glView, C = dome.center, R2 = dome.radius * dome.radius;
            // the camera in world space (eye = -R^T t), relative to the centre
            var ox = -(m[0] * m[3] + m[4] * m[7] + m[8] * m[11]) - C[0];
            var oy = -(m[1] * m[3] + m[5] * m[7] + m[9] * m[11]) - C[1];
            var oz = -(m[2] * m[3] + m[6] * m[7] + m[10] * m[11]) - C[2];
            var c2 = ox * ox + oy * oy + oz * oz - R2;
            // texture coordinates at the grid nodes
            var GW = Math.ceil(W / step) + 1, GH = Math.ceil(H / step) + 1;
            var gu = new Float64Array(GW * GH), gv = new Float64Array(GW * GH);
            for (var gy = 0; gy < GH; gy++) {
                for (var gx = 0; gx < GW; gx++) {
                    // camera-space ray, then world (R^T d)
                    var cxr = (gx * step + 0.5 - cx) / focal, cyr = -(gy * step + 0.5 - cy) / focal;
                    var dx = m[0] * cxr + m[4] * cyr - m[8];
                    var dy = m[1] * cxr + m[5] * cyr - m[9];
                    var dz = m[2] * cxr + m[6] * cyr - m[10];
                    var dl = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
                    dx *= dl; dy *= dl; dz *= dl;
                    var b = ox * dx + oy * dy + oz * dz;
                    var t = -b + Math.sqrt(Math.max(0, b * b - c2));
                    var px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
                    var lx = rot[0] * px + rot[1] * py + rot[2] * pz;
                    var ly = rot[3] * px + rot[4] * py + rot[5] * pz;
                    var lz = rot[6] * px + rot[7] * py + rot[8] * pz;
                    var ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
                    var u = Math.atan2(lz, -lx) / (2 * Math.PI);
                    gu[gy * GW + gx] = u < 0 ? u + 1 : u;
                    gv[gy * GW + gx] = 1 - Math.acos(Math.max(-1, Math.min(1, ly / ll))) / Math.PI;
                }
            }
            var painted = 0;
            for (var y = 0; y < H; y++) {
                var row = y * W, color = rows[y];
                var cy0 = (y / step) | 0, fy = (y - cy0 * step) / step;
                for (var cxc = 0; cxc * step < W; cxc++) {
                    var xs = cxc * step, xe = Math.min(W, xs + step);
                    // any empty pixel in this run?
                    var k = row + xs, any = false;
                    for (var q = xs; q < xe; q++, k++) if (ids[k] === 0) { any = true; break; }
                    if (!any) continue;
                    var n00 = cy0 * GW + cxc, n10 = n00 + 1, n01 = n00 + GW, n11 = n01 + 1;
                    var u00 = gu[n00], u10 = gu[n10], u01 = gu[n01], u11 = gu[n11];
                    // unwrap u across the seam
                    if (u10 - u00 > 0.5) u10 -= 1; else if (u00 - u10 > 0.5) u10 += 1;
                    if (u01 - u00 > 0.5) u01 -= 1; else if (u00 - u01 > 0.5) u01 += 1;
                    if (u11 - u00 > 0.5) u11 -= 1; else if (u00 - u11 > 0.5) u11 += 1;
                    var uL = u00 + (u01 - u00) * fy, uR = u10 + (u11 - u10) * fy;
                    var vL = gv[n00] + (gv[n01] - gv[n00]) * fy, vR = gv[n10] + (gv[n11] - gv[n10]) * fy;
                    var du = (uR - uL) / step, dv = (vR - vL) / step;
                    for (var x = xs, i = row + xs; x < xe; x++, i++) {
                        if (ids[i] !== 0) continue;
                        var tx = (x - xs);
                        // bilinear field sample (texel centres at +0.5), u wraps
                        var fu = (uL + du * tx) * FW - 0.5, fv = (vL + dv * tx) * FH - 0.5;
                        var x0 = Math.floor(fu), y0 = Math.floor(fv);
                        var ax = fu - x0, ay = fv - y0;
                        x0 = ((x0 % FW) + FW) % FW;
                        var x1 = x0 + 1 === FW ? 0 : x0 + 1;
                        var y1 = y0 + 1;
                        if (y0 < 0) y0 = 0;
                        if (y1 >= FH) y1 = FH - 1;
                        if (y0 >= FH) y0 = FH - 1;
                        var r0 = y0 * FW, r1 = y1 * FW;
                        var top = FD[r0 + x0] + (FD[r0 + x1] - FD[r0 + x0]) * ax;
                        var bot = FD[r1 + x0] + (FD[r1 + x1] - FD[r1 + x0]) * ax;
                        if (top + (bot - top) * ay >= thr) {
                            out[i] = color;
                            painted++;
                        }
                    }
                }
            }
            return painted;
        }

        /**
         * The affine map from THIS engine's camera space to `light`'s screen
         * space (pixel x, pixel y, depth value), for resolve()'s shadow test.
         * `light` must be an orthographic engine; both views must be set.
         */
        function shadowTransformTo(light) {
            // camera space -> world (inverse view) -> light camera -> light screen
            var invView = mat34Invert(glView, new Float64Array(12));
            var lv = mat34Mul(light.getView(), invView, new Float64Array(12));
            var s = light.orthoScale;
            return [
                lv[0] * s, lv[1] * s, lv[2] * s, lv[3] * s + light.width * 0.5,
                -lv[4] * s, -lv[5] * s, -lv[6] * s, -lv[7] * s + light.height * 0.5,
                lv[8], lv[9], lv[10], lv[11] + light.orthoFar
            ];
        }

        return {
            width: width,
            height: height,
            znear: znear,
            focal: focal,
            orthographic: orthographic,
            orthoScale: orthoScale,
            orthoFar: orthoFar,
            setCamera: setCamera,
            drawMesh: drawMesh,
            packColor: packColor,
            setView: setView,
            getView: function () {
                return glView;
            },
            setLightDir: setLightDir,
            drawTriMesh: drawTriMesh,
            drawSprites: drawSprites,
            drawDome: drawDome,
            shadowTransformTo: shadowTransformTo
        };
    }

    // ------------------------------------------------- 3x4 affine matrices
    //
    // Row-major 12-element arrays: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]

    function mat34Identity(out) {
        out = out || new Float64Array(12);
        for (var i = 0; i < 12; i++) out[i] = 0;
        out[0] = out[5] = out[10] = 1;
        return out;
    }

    /** out = a * b (apply b, then a). out may alias a or b. */
    function mat34Mul(a, b, out) {
        out = out || new Float64Array(12);
        var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
        var a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7];
        var a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11];
        var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
        var b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7];
        var b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11];
        out[0] = a0 * b0 + a1 * b4 + a2 * b8;
        out[1] = a0 * b1 + a1 * b5 + a2 * b9;
        out[2] = a0 * b2 + a1 * b6 + a2 * b10;
        out[3] = a0 * b3 + a1 * b7 + a2 * b11 + a3;
        out[4] = a4 * b0 + a5 * b4 + a6 * b8;
        out[5] = a4 * b1 + a5 * b5 + a6 * b9;
        out[6] = a4 * b2 + a5 * b6 + a6 * b10;
        out[7] = a4 * b3 + a5 * b7 + a6 * b11 + a7;
        out[8] = a8 * b0 + a9 * b4 + a10 * b8;
        out[9] = a8 * b1 + a9 * b5 + a10 * b9;
        out[10] = a8 * b2 + a9 * b6 + a10 * b10;
        out[11] = a8 * b3 + a9 * b7 + a10 * b11 + a11;
        return out;
    }

    /** Inverse of an affine 3x4 matrix (throws if singular). */
    function mat34Invert(m, out) {
        out = out || new Float64Array(12);
        var a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], k = m[10];
        var A = e * k - f * h, B = f * g - d * k, C = d * h - e * g;
        var det = a * A + b * B + c * C;
        if (det === 0) throw new Error('SW3D.mat34Invert: singular matrix');
        var id = 1 / det;
        var r0 = A * id, r1 = (c * h - b * k) * id, r2 = (b * f - c * e) * id;
        var r4 = B * id, r5 = (a * k - c * g) * id, r6 = (c * d - a * f) * id;
        var r8 = C * id, r9 = (b * g - a * h) * id, r10 = (a * e - b * d) * id;
        var tx = m[3], ty = m[7], tz = m[11];
        out[0] = r0; out[1] = r1; out[2] = r2; out[3] = -(r0 * tx + r1 * ty + r2 * tz);
        out[4] = r4; out[5] = r5; out[6] = r6; out[7] = -(r4 * tx + r5 * ty + r6 * tz);
        out[8] = r8; out[9] = r9; out[10] = r10; out[11] = -(r8 * tx + r9 * ty + r10 * tz);
        return out;
    }

    /**
     * Model matrix from translation, rotation quaternion (x, y, z, w) and
     * scale, applied scale, then rotation, then translation.
     */
    function mat34Compose(p, q, s, out) {
        out = out || new Float64Array(12);
        var x = q[0], y = q[1], z = q[2], w = q[3];
        var sx = s ? s[0] : 1, sy = s ? s[1] : 1, sz = s ? s[2] : 1;
        var x2 = x + x, y2 = y + y, z2 = z + z;
        var xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
        var wx = w * x2, wy = w * y2, wz = w * z2;
        out[0] = (1 - (yy + zz)) * sx; out[1] = (xy - wz) * sy; out[2] = (xz + wy) * sz; out[3] = p[0];
        out[4] = (xy + wz) * sx; out[5] = (1 - (xx + zz)) * sy; out[6] = (yz - wx) * sz; out[7] = p[1];
        out[8] = (xz - wy) * sx; out[9] = (yz + wx) * sy; out[10] = (1 - (xx + yy)) * sz; out[11] = p[2];
        return out;
    }

    /**
     * View matrix (world -> camera) for a camera at `eye` looking at
     * `target`, with `up` as the approximate up direction. The camera looks
     * down its -z axis (GL convention).
     */
    function lookAt(eye, target, up, out) {
        out = out || new Float64Array(12);
        var zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
        var l = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
        zx /= l; zy /= l; zz /= l;
        var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
        l = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
        xx /= l; xy /= l; xz /= l;
        var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
        out[0] = xx; out[1] = xy; out[2] = xz; out[3] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
        out[4] = yx; out[5] = yy; out[6] = yz; out[7] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
        out[8] = zx; out[9] = zy; out[10] = zz; out[11] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
        return out;
    }

    function maxColumnNorm(m) {
        var c0 = Math.sqrt(m[0] * m[0] + m[4] * m[4] + m[8] * m[8]);
        var c1 = Math.sqrt(m[1] * m[1] + m[5] * m[5] + m[9] * m[9]);
        var c2 = Math.sqrt(m[2] * m[2] + m[6] * m[6] + m[10] * m[10]);
        return c0 > c1 ? (c0 > c2 ? c0 : c2) : c1 > c2 ? c1 : c2;
    }

    function det3(m) {
        return (
            m[0] * (m[5] * m[10] - m[6] * m[9]) -
            m[1] * (m[4] * m[10] - m[6] * m[8]) +
            m[2] * (m[4] * m[9] - m[5] * m[8])
        );
    }

    // ------------------------------------------------------- triangle meshes

    /**
     * Build an indexed triangle mesh from typed arrays: the compact form for
     * large or animated geometry, drawn with engine.drawTriMesh.
     *
     * Conventions follow OpenGL / glTF / three.js, so their data works
     * unchanged: right-handed coordinates and counter-clockwise front faces
     * (the right-hand-rule normal points outward).
     *
     * @param {Object} def
     * @param {Float32Array|number[]} def.positions - [x,y,z, ...]
     * @param {Uint32Array|Uint16Array|number[]} def.indices - 3 per triangle
     * @param {Uint32Array} [def.faceColors] - per triangle, packed like
     *   Surface.data32 (engine.packColor) — for drawTriMesh mode 'color'
     * @param {Uint32Array} [def.faceIds] - per triangle, 1 .. 2^26-1 — for
     *   mode 'id' (0 is reserved for "no geometry")
     * @param {boolean} [def.cone=false] - compute a normal cone, so a mesh
     *   whose faces all point away from the camera is rejected whole (use
     *   for static chunks of a larger model; re-run after editing positions)
     * @returns {Object} mesh — positions are live: after changing them (e.g.
     *   skinning) call updateTriMeshBounds
     */
    function makeTriMesh(def) {
        var positions = def.positions instanceof Float32Array ? def.positions : new Float32Array(def.positions);
        var indices =
            def.indices instanceof Uint32Array || def.indices instanceof Uint16Array
                ? def.indices
                : new Uint32Array(def.indices);
        var mesh = {
            isTriMesh: true,
            positions: positions,
            indices: indices,
            vertexCount: positions.length / 3,
            faceCount: indices.length / 3,
            faceColors: def.faceColors || null,
            faceIds: def.faceIds || null,
            center: [0, 0, 0],
            radius: 0,
            coneAxis: [0, 0, 1],
            coneSin: 2 // > 1: no cone
        };
        updateTriMeshBounds(mesh);
        if (def.cone) computeTriMeshCone(mesh);
        return mesh;
    }

    /** Recompute the bounding sphere (box centre, max distance) after editing positions. */
    function updateTriMeshBounds(mesh) {
        var P = mesh.positions;
        var n = mesh.vertexCount;
        if (n === 0) return mesh;
        var x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
        var i;
        for (i = 0; i < n; i++) {
            var x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            if (z < z0) z0 = z;
            if (z > z1) z1 = z;
        }
        var cxm = (x0 + x1) * 0.5, cym = (y0 + y1) * 0.5, czm = (z0 + z1) * 0.5;
        var r2 = 0;
        for (i = 0; i < n; i++) {
            var dx = P[i * 3] - cxm, dy = P[i * 3 + 1] - cym, dz = P[i * 3 + 2] - czm;
            var d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > r2) r2 = d2;
        }
        mesh.center[0] = cxm;
        mesh.center[1] = cym;
        mesh.center[2] = czm;
        mesh.radius = Math.sqrt(r2);
        return mesh;
    }

    /**
     * Normal cone: axis a and sin(alpha), where alpha bounds the angle
     * between a and every face normal. All faces point away from an eye e if
     * dot(c - e, a) >= sin(alpha) * (|c - e| + r) + r, for the bounding
     * sphere (c, r): then for any point p in it, the angle between a and
     * p - e is at most 90 deg - alpha, so no normal points toward e. When
     * the faces span 90 deg or more there is no cone (coneSin = 2).
     */
    function computeTriMeshCone(mesh) {
        var P = mesh.positions, I = mesh.indices, nf = mesh.faceCount;
        var normals = new Float64Array(nf * 3);
        var sx = 0, sy = 0, sz = 0;
        var f;
        for (f = 0; f < nf; f++) {
            var i0 = I[f * 3] * 3, i1 = I[f * 3 + 1] * 3, i2 = I[f * 3 + 2] * 3;
            var e1x = P[i1] - P[i0], e1y = P[i1 + 1] - P[i0 + 1], e1z = P[i1 + 2] - P[i0 + 2];
            var e2x = P[i2] - P[i0], e2y = P[i2 + 1] - P[i0 + 1], e2z = P[i2 + 2] - P[i0 + 2];
            var nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
            var l = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (l > 0) {
                nx /= l; ny /= l; nz /= l;
            }
            normals[f * 3] = nx;
            normals[f * 3 + 1] = ny;
            normals[f * 3 + 2] = nz;
            sx += nx; sy += ny; sz += nz;
        }
        var sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
        mesh.coneSin = 2;
        if (sl === 0) return mesh;
        sx /= sl; sy /= sl; sz /= sl;
        var minDot = 1;
        for (f = 0; f < nf; f++) {
            var d = normals[f * 3] * sx + normals[f * 3 + 1] * sy + normals[f * 3 + 2] * sz;
            if (d < minDot) minDot = d;
        }
        if (minDot <= 0) return mesh;
        mesh.coneAxis[0] = sx;
        mesh.coneAxis[1] = sy;
        mesh.coneAxis[2] = sz;
        mesh.coneSin = Math.sqrt(1 - minDot * minDot);
        return mesh;
    }

    /**
     * A sprite mask for drawSprites, with a chain of halved levels (a texel
     * is set when at least half of the 2x2 texels under it are), so a
     * sprite samples a level close to its size on screen. Like mipmaps,
     * this keeps small sprites from twinkling as they move.
     * @param {number} width
     * @param {number} height
     * @param {Uint8Array} data - non-zero inside
     */
    function makeSpriteMask(width, height, data) {
        var levels = [{ width: width, height: height, data: data }];
        var w = width, h = height, d = data;
        while (w > 1 && h > 1) {
            var w2 = w >> 1, h2 = h >> 1, d2 = new Uint8Array(w2 * h2);
            for (var y = 0; y < h2; y++) {
                for (var x = 0; x < w2; x++) {
                    var i = y * 2 * w + x * 2;
                    var n = (d[i] ? 1 : 0) + (d[i + 1] ? 1 : 0) + (d[i + w] ? 1 : 0) + (d[i + w + 1] ? 1 : 0);
                    d2[y * w2 + x] = n >= 2 ? 1 : 0;
                }
            }
            levels.push({ width: w2, height: h2, data: d2 });
            w = w2; h = h2; d = d2;
        }
        return { width: width, height: height, data: data, levels: levels };
    }

    // ------------------------------------------------------- resolve (pixels)

    /**
     * The per-pixel pass after drawTriMesh(..., {mode: 'id'}): turns an id
     * buffer into colours, like a deferred-shading fragment shader. Per pixel:
     *
     *   id 0 (nothing drawn)  -> background
     *   else entry = id >>> 6, ndl = id & 63 (N.L, see drawTriMesh)
     *     lit = ndl >= palette.threshold[entry], and, when params.shadow is
     *       given, the pixel is not in that shadow map's shadow
     *     colour = lit ? palette.lit[entry] : palette.shadow[entry], or,
     *       with params.night, on the night side of a spherical world (the
     *       light below the pixel's horizon), palette.night[entry]
     *     outline: if the right or lower neighbour belongs to a different
     *       palette.group, or its depth differs by more than
     *       outline.depthRatio (unless palette.noDepthEdges[entry] is set),
     *       the pixel takes outline colour (fading out between
     *       outline.fadeNear and outline.fadeFar camera units, if set)
     *     fog: mixed toward fog.color by camera depth z: linearly between
     *       fog.near and fog.far, or, with fog.density, exponentially squared
     *       (1 - exp(-(density * z)^2), like three.js FogExp2)
     *
     * Two-tone lit / shadow colours give a toon look; the shadow map adds
     * cast shadows to the same tone. The night side adds a third.
     *
     * @param {Object} target - Surface or {width, height, data32}: output
     * @param {Uint32Array} ids - the id buffer (same size)
     * @param {DepthBuffer} depthBuffer - the depth the ids were drawn with
     * @param {Object} engine - the (perspective) engine that drew them
     * @param {Object} params
     * @param {Object} params.palette - {lit: Uint32Array, shadow: Uint32Array,
     *   threshold: Uint8Array (0..63; 32 is N.L = 0), group: Int32Array|null,
     *   night: Uint32Array (optional, for params.night),
     *   noDepthEdges: Uint8Array (optional; 1: no depth-edge outlines within
     *   the entry's group, e.g. foliage made of overlapping cards, so only
     *   the group's silhouette is outlined)}
     * @param {number|Uint32Array} params.background - packed colour, or one
     *   packed colour per row
     * @param {Object} [params.fog] - {color: [r,g,b], near, far} or
     *   {color: [r,g,b], density} (camera units)
     * @param {Object} [params.outline] - {color: packed, depthRatio: 0.15,
     *   fadeNear, fadeFar, width: 1}; with width w > 1 each edge pixel also
     *   marks the w - 1 pixels before it in its row and in its column, so
     *   lines are w pixels wide
     * @param {Object} [params.night] - {center, dir, below}: a world point
     *   (the sphere's centre), the unit world direction toward the light, and
     *   a level: a pixel at world position p is in the night when
     *   dot(normalize(p - center), dir) < below (the sine of the light's
     *   elevation there), whatever its N.L. Needs palette.night
     * @param {Object} [params.shadow] - {depth: DepthBuffer drawn by an
     *   orthographic engine, transform: engine.shadowTransformTo(light),
     *   bias: depth units (default 0.05)}
     * @param {Object} [params.surface] - surfaces shaded per pixel, like
     *   water: {entries: Uint8Array (1 for the palette entries shaded),
     *   depth: the DepthBuffer as it was before the surfaces were drawn (the
     *   scene behind them), shade: function (sx, sy, sz, wx, wy, wz, entry,
     *   night) returning a packed colour, given the camera-space points of
     *   the scene behind (s) and of the surface (w), and whether the pixel is
     *   on the night side}. Fog applies to the result as usual. Surface
     *   pixels take no outline, and their neighbours see through them: they
     *   test depth edges against the scene behind and skip the group test.
     */
    var resolveEdges = null; // resolve's wide-outline marks, reused between calls
    function resolve(target, ids, depthBuffer, engine, params) {
        var W = target.width, H = target.height;
        var out = target.data32, D = depthBuffer.data;
        var pal = params.palette;
        var litC = pal.lit, shadowC = pal.shadow, thr = pal.threshold, group = pal.group || null;
        var noDepthEdges = pal.noDepthEdges || null;
        var nightC = pal.night || null;
        // the sphere's centre and the light direction, in camera space
        var nt = nightC !== null && params.night ? params.night : null;
        var ncx = 0, ncy = 0, ncz = 0, ndx = 0, ndy = 0, ndz = 0, nBelow = 0;
        if (nt) {
            var V = engine.getView(), nc = nt.center, nd = nt.dir;
            ncx = V[0] * nc[0] + V[1] * nc[1] + V[2] * nc[2] + V[3];
            ncy = V[4] * nc[0] + V[5] * nc[1] + V[6] * nc[2] + V[7];
            ncz = V[8] * nc[0] + V[9] * nc[1] + V[10] * nc[2] + V[11];
            ndx = V[0] * nd[0] + V[1] * nd[1] + V[2] * nd[2];
            ndy = V[4] * nd[0] + V[5] * nd[1] + V[6] * nd[2];
            ndz = V[8] * nd[0] + V[9] * nd[1] + V[10] * nd[2];
            nBelow = nt.below;
        }
        var bg = params.background;
        var bgRows = typeof bg === 'number' ? null : bg;
        var cxp = engine.width * 0.5, cyp = engine.height * 0.5, invFocal = 1 / engine.focal;

        var fog = params.fog || null;
        var fogR = 0, fogG = 0, fogB = 0, fogNear = 0, fogInvRange = 0, fogDensity = 0;
        if (fog) {
            fogR = fog.color[0]; fogG = fog.color[1]; fogB = fog.color[2];
            if (fog.density) {
                fogDensity = fog.density;
                // below this depth the exp2 fog is under 1/512: skip it
                fogNear = Math.sqrt(-Math.log(1 - 1 / 512)) / fogDensity;
            } else {
                fogNear = fog.near;
                fogInvRange = 1 / Math.max(1e-6, fog.far - fog.near);
            }
        }
        var ol = params.outline || null;
        var olColor = ol ? ol.color : 0;
        var olRatio = ol ? (ol.depthRatio !== undefined ? ol.depthRatio : 0.15) : 0;
        var olFadeNear = ol && ol.fadeFar ? ol.fadeNear || 0 : Infinity;
        var olFadeFar = ol && ol.fadeFar ? ol.fadeFar : Infinity;
        var olR = olColor & 0xff, olG = (olColor >>> 8) & 0xff, olB = (olColor >>> 16) & 0xff;
        var olWidth = ol && ol.width > 1 ? Math.round(ol.width) : 1;

        var sf = params.surface || null;
        var sfEntries = sf ? sf.entries : null, SD = sf ? sf.depth.data : null, shade = sf ? sf.shade : null;

        var sh = params.shadow || null;
        var smap = null, smw = 0, smh = 0, T = null, bias = 0;
        if (sh) {
            smap = sh.depth.data;
            smw = sh.depth.width;
            smh = sh.depth.height;
            T = sh.transform;
            bias = sh.bias !== undefined ? sh.bias : 0.05;
        }

        // Is pixel i (entry e, depth invZ) on an edge: does its right or lower
        // neighbour belong to another group, or lie at another depth?
        function edgeAt(i, x, y, e, invZ) {
            var edge = false;
            // past the group test, the neighbour is in the same group
            var depthEdges = noDepthEdges === null || noDepthEdges[e] === 0;
            if (x + 1 < W) {
                var idR = ids[i + 1];
                if (sfEntries !== null && idR !== 0 && sfEntries[idR >>> 6] === 1) {
                    edge = depthEdges && Math.abs(SD[i + 1] - invZ) > olRatio * invZ;
                } else {
                    edge = idR === 0 || (group !== null && group[idR >>> 6] !== group[e]) ||
                        (depthEdges && Math.abs(D[i + 1] - invZ) > olRatio * invZ);
                }
            }
            if (!edge && y + 1 < H) {
                var idD = ids[i + W];
                if (sfEntries !== null && idD !== 0 && sfEntries[idD >>> 6] === 1) {
                    edge = depthEdges && Math.abs(SD[i + W] - invZ) > olRatio * invZ;
                } else {
                    edge = idD === 0 || (group !== null && group[idD >>> 6] !== group[e]) ||
                        (depthEdges && Math.abs(D[i + W] - invZ) > olRatio * invZ);
                }
            }
            return edge;
        }

        // Wide outlines: the 1-pixel edges first (bit 1), then each marks the
        // olWidth - 1 pixels before it in its row (bit 2) and its column (bit 4)
        var wide = null;
        if (ol !== null && olWidth > 1) {
            if (!resolveEdges || resolveEdges.length < W * H) resolveEdges = new Uint8Array(W * H);
            wide = resolveEdges;
            for (var ey = 0; ey < H; ey++) {
                for (var ex = 0, ei = ey * W; ex < W; ex++, ei++) {
                    var eid = ids[ei], ee = eid >>> 6;
                    wide[ei] = eid !== 0 && !(sfEntries !== null && sfEntries[ee] === 1) && edgeAt(ei, ex, ey, ee, D[ei]) ? 1 : 0;
                }
            }
            for (var ry = 0; ry < H; ry++) {
                for (var rx = W - 1, ri = ry * W + W - 1, run = 0; rx >= 0; rx--, ri--) {
                    if (wide[ri] & 1) run = olWidth;
                    else if (run > 0) wide[ri] |= 2;
                    if (run > 0) run--;
                }
            }
            for (var cx2 = 0; cx2 < W; cx2++) {
                for (var cy2 = H - 1, ci = cy2 * W + cx2, crun = 0; cy2 >= 0; cy2--, ci -= W) {
                    if (wide[ci] & 1) crun = olWidth;
                    else if (crun > 0) wide[ci] |= 4;
                    if (crun > 0) crun--;
                }
            }
        }

        for (var y = 0; y < H; y++) {
            var row = y * W;
            var bgColor = bgRows ? bgRows[y] : bg;
            var cyRel = (cyp - y) * invFocal;
            for (var x = 0; x < W; x++) {
                var i = row + x;
                var id = ids[i];
                if (id === 0) {
                    out[i] = bgColor;
                    continue;
                }
                var e = id >>> 6;
                var lit = (id & 63) >= thr[e];
                var invZ = D[i];
                var z = 1 / invZ;
                var dark = false;
                if (nt !== null) {
                    // the light's height above the horizon at this pixel
                    var qx = (x - cxp) * invFocal * z - ncx, qy = cyRel * z - ncy, qz = -z - ncz;
                    var h = qx * ndx + qy * ndy + qz * ndz;
                    if (h < nBelow * Math.sqrt(qx * qx + qy * qy + qz * qz)) {
                        dark = true;
                        lit = false;
                    }
                }
                var surface = sfEntries !== null && sfEntries[e] === 1;
                if (lit && smap !== null && !surface) {
                    // camera-space position of the sample, then light space
                    var X = (x - cxp) * invFocal * z, Y = cyRel * z, Z = -z;
                    var tx = T[0] * X + T[1] * Y + T[2] * Z + T[3];
                    var ty = T[4] * X + T[5] * Y + T[6] * Z + T[7];
                    if (tx >= 0 && ty >= 0 && tx < smw && ty < smh) {
                        var tv = T[8] * X + T[9] * Y + T[10] * Z + T[11];
                        if (smap[(ty | 0) * smw + (tx | 0)] > tv + bias) lit = false;
                    }
                }
                var color;
                if (surface) {
                    var sz = 1 / SD[i], cxr = (x - cxp) * invFocal;
                    color = shade(cxr * sz, cyRel * sz, -sz, cxr * z, cyRel * z, -z, e, dark);
                } else {
                    color = lit ? litC[e] : dark ? nightC[e] : shadowC[e];
                }
                if (ol !== null && !surface) {
                    var edge = wide !== null ? wide[i] !== 0 : edgeAt(i, x, y, e, invZ);
                    if (edge && z < olFadeFar) {
                        if (z <= olFadeNear) {
                            color = olColor;
                        } else {
                            var a = 1 - (z - olFadeNear) / (olFadeFar - olFadeNear);
                            var cr = color & 0xff, cg = (color >>> 8) & 0xff, cb = (color >>> 16) & 0xff;
                            color = (0xff000000 |
                                (((cb + (olB - cb) * a) | 0) << 16) |
                                (((cg + (olG - cg) * a) | 0) << 8) |
                                ((cr + (olR - cr) * a) | 0)) >>> 0;
                        }
                    }
                }
                if (fog !== null && z > fogNear) {
                    var t;
                    if (fogDensity) {
                        var dz = fogDensity * z;
                        t = 1 - Math.exp(-dz * dz);
                    } else {
                        t = (z - fogNear) * fogInvRange;
                        if (t > 1) t = 1;
                    }
                    var r = color & 0xff, g = (color >>> 8) & 0xff, b = (color >>> 16) & 0xff;
                    color = (0xff000000 |
                        (((b + (fogB - b) * t) | 0) << 16) |
                        (((g + (fogG - g) * t) | 0) << 8) |
                        ((r + (fogR - r) * t) | 0)) >>> 0;
                }
                out[i] = color;
            }
        }
    }

    var SW3D = {
        makeEngine: makeEngine,
        makeMesh: makeMesh,
        makeBoxMesh: makeBoxMesh,
        makeSphereMesh: makeSphereMesh,
        mat3FromEuler: mat3FromEuler,
        mat3Transpose: mat3Transpose,
        mat3Mul: mat3Mul,
        makeTriMesh: makeTriMesh,
        updateTriMeshBounds: updateTriMeshBounds,
        computeTriMeshCone: computeTriMeshCone,
        makeSpriteMask: makeSpriteMask,
        resolve: resolve,
        lookAt: lookAt,
        mat34Identity: mat34Identity,
        mat34Mul: mat34Mul,
        mat34Invert: mat34Invert,
        mat34Compose: mat34Compose
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SW3D;
    } else {
        global.SW3D = SW3D;
    }
})(typeof window !== 'undefined' ? window : globalThis);

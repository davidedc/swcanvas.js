/**
 * Interpenetrating-cubes demo scene for the SWCanvas 3D primitives
 * (DepthBuffer + Triangle3DOps).
 *
 * Two flat-shaded cubes rotate through each other. Because every pixel is
 * depth-tested (1/z in a DepthBuffer), the intersection between the cubes is
 * rendered exactly — no polygon sorting, no BSP. This is the case the
 * classic painter's-algorithm engines cannot draw correctly.
 *
 * Pipeline per frame (all in this file — SWCanvas only provides the
 * screen-space primitives, in the spirit of PICO-8's tline):
 *   rotate/translate to camera space -> backface cull -> per-face Lambert
 *   lighting -> perspective projection -> Triangle3DOps.fillTriangleZ
 *
 * Works in both Node (module.exports) and the browser (global CubesScene).
 */
(function (global) {
    'use strict';

    // Cube corner offsets (unit half-size), see face table below
    var CORNERS = [
        [-1, -1, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [-1, 1, 1]
    ];

    // Quad faces with outward winding (right-hand rule normals)
    var FACES = [
        [0, 3, 2, 1], // front  (-z, toward camera)
        [4, 5, 6, 7], // back   (+z)
        [0, 4, 7, 3], // left   (-x)
        [1, 2, 6, 5], // right  (+x)
        [3, 7, 6, 2], // top    (+y)
        [0, 1, 5, 4] // bottom (-y)
    ];

    /**
     * Create the demo scene.
     * @param {Object} SWCanvas - the SWCanvas module/global
     * @param {number} width - render width in pixels
     * @param {number} height - render height in pixels
     * @param {number} [backgroundPacked] - packed 32-bit RGBA background
     *   (e.g. 0x00000000 for a fully transparent background so the scene
     *   can be composited over other content); defaults to opaque dark blue
     * @returns {Object} scene with render(surface, depthBuffer, timeSeconds)
     */
    function makeCubesScene(SWCanvas, width, height, backgroundPacked) {
        var Triangle3DOps = SWCanvas.Core.Triangle3DOps;
        // Same layout as Surface.packColor (little-endian ABGR word), opaque
        function packColor(r, g, b) {
            return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
        }

        var cx = width * 0.5;
        var cy = height * 0.5;
        var focal = height * 1.1;

        // Light direction in camera space (towards the light), normalized
        var lx = -0.45,
            ly = 0.6,
            lz = -0.66;
        var ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
        lx /= ll;
        ly /= ll;
        lz /= ll;

        var AMBIENT = 0.3;
        var DIFFUSE = 0.7;

        // Procedural 128x128 texture for the second cube: blue checker with
        // a uniform border (which also hides any wrap seam) and an orange
        // orientation marker so the per-face UV mapping is visually checkable
        var demoTexture = (function () {
            var SIZE = 128;
            var data = new Uint8ClampedArray(SIZE * SIZE * 4);
            for (var y = 0; y < SIZE; y++) {
                for (var x = 0; x < SIZE; x++) {
                    var r, g, b;
                    if (((x >> 4) + (y >> 4)) & 1) {
                        r = 96;
                        g = 130;
                        b = 180;
                    } else {
                        r = 58;
                        g = 80;
                        b = 116;
                    }
                    if (x % 16 === 0 || y % 16 === 0) {
                        r = 44;
                        g = 60;
                        b = 88;
                    }
                    if (x >= 12 && x < 44 && y >= 12 && y < 44) {
                        r = 235;
                        g = 140;
                        b = 60;
                    }
                    if (x < 4 || y < 4 || x >= SIZE - 4 || y >= SIZE - 4) {
                        r = 24;
                        g = 32;
                        b = 48;
                    }
                    var i = (y * SIZE + x) * 4;
                    data[i] = r;
                    data[i + 1] = g;
                    data[i + 2] = b;
                    data[i + 3] = 255;
                }
            }
            return new SWCanvas.Core.Texture3D({ width: SIZE, height: SIZE, data: data });
        })();

        // Per-face UV corners in texel units (matches FACES quad order).
        // 127.999 instead of 128 so the far edge never wraps to texel 0.
        var UV_T = 127.999;
        var FACE_UV = [
            [0, 0],
            [UV_T, 0],
            [UV_T, UV_T],
            [0, UV_T]
        ];

        var cubes = [
            { half: 1.0, center: [-0.35, 0.0, 4.0], rgb: [231, 76, 60], speed: [0.5, 0.8, 0.3] },
            { half: 0.8, center: [0.5, 0.1, 4.05], rgb: [52, 152, 219], speed: [-0.7, 0.45, 0.9], texture: demoTexture }
        ];

        // Scratch: camera-space vertices (8 per cube), projected (x,y,invZ)
        var camX = new Float64Array(8);
        var camY = new Float64Array(8);
        var camZ = new Float64Array(8);
        var scrX = new Float64Array(8);
        var scrY = new Float64Array(8);
        var scrIZ = new Float64Array(8);

        var bgPacked = backgroundPacked === undefined ? packColor(24, 26, 34) : backgroundPacked >>> 0;

        function renderCube(surface, depthBuffer, cube, t, clipBuffer) {
            var ax = t * cube.speed[0];
            var ay = t * cube.speed[1];
            var az = t * cube.speed[2];

            // Rotation matrix R = Rz * Ry * Rx (row-major m[row][col] flattened)
            var sx = Math.sin(ax),
                cxr = Math.cos(ax);
            var sy = Math.sin(ay),
                cyr = Math.cos(ay);
            var sz = Math.sin(az),
                czr = Math.cos(az);

            var m00 = czr * cyr,
                m01 = czr * sy * sx - sz * cxr,
                m02 = czr * sy * cxr + sz * sx;
            var m10 = sz * cyr,
                m11 = sz * sy * sx + czr * cxr,
                m12 = sz * sy * cxr - czr * sx;
            var m20 = -sy,
                m21 = cyr * sx,
                m22 = cyr * cxr;

            var h = cube.half;
            var tx = cube.center[0],
                ty = cube.center[1],
                tz = cube.center[2];

            for (var i = 0; i < 8; i++) {
                var vx = CORNERS[i][0] * h;
                var vy = CORNERS[i][1] * h;
                var vz = CORNERS[i][2] * h;
                var wx = m00 * vx + m01 * vy + m02 * vz + tx;
                var wy = m10 * vx + m11 * vy + m12 * vz + ty;
                var wz = m20 * vx + m21 * vy + m22 * vz + tz;
                camX[i] = wx;
                camY[i] = wy;
                camZ[i] = wz;
                var iz = 1 / wz;
                scrX[i] = cx + wx * focal * iz;
                scrY[i] = cy - wy * focal * iz;
                scrIZ[i] = iz;
            }

            var baseR = cube.rgb[0],
                baseG = cube.rgb[1],
                baseB = cube.rgb[2];

            for (var f = 0; f < 6; f++) {
                var q = FACES[f];
                var i0 = q[0],
                    i1 = q[1],
                    i2 = q[2],
                    i3 = q[3];

                // Face normal in camera space (outward by winding)
                var e1x = camX[i1] - camX[i0],
                    e1y = camY[i1] - camY[i0],
                    e1z = camZ[i1] - camZ[i0];
                var e2x = camX[i2] - camX[i0],
                    e2y = camY[i2] - camY[i0],
                    e2z = camZ[i2] - camZ[i0];
                var nx = e1y * e2z - e1z * e2y;
                var ny = e1z * e2x - e1x * e2z;
                var nz = e1x * e2y - e1y * e2x;

                // Backface cull: camera is at the origin, so the view vector
                // to the face is the vertex position itself
                if (nx * camX[i0] + ny * camY[i0] + nz * camZ[i0] >= 0) {
                    continue;
                }

                // Flat Lambert shading (modulates both flat and textured faces)
                var nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
                var lambert = (nx * lx + ny * ly + nz * lz) * nl;
                var intensity = AMBIENT + DIFFUSE * Math.max(0, lambert);

                if (cube.texture) {
                    // Perspective-correct textured, lit per face
                    var lit = Math.min(256, (intensity * 256) | 0);
                    Triangle3DOps.fillTriangleTexturedPersp(
                        surface,
                        depthBuffer,
                        scrX[i0],
                        scrY[i0],
                        scrIZ[i0],
                        FACE_UV[0][0],
                        FACE_UV[0][1],
                        scrX[i1],
                        scrY[i1],
                        scrIZ[i1],
                        FACE_UV[1][0],
                        FACE_UV[1][1],
                        scrX[i2],
                        scrY[i2],
                        scrIZ[i2],
                        FACE_UV[2][0],
                        FACE_UV[2][1],
                        cube.texture,
                        lit,
                        clipBuffer
                    );
                    Triangle3DOps.fillTriangleTexturedPersp(
                        surface,
                        depthBuffer,
                        scrX[i0],
                        scrY[i0],
                        scrIZ[i0],
                        FACE_UV[0][0],
                        FACE_UV[0][1],
                        scrX[i2],
                        scrY[i2],
                        scrIZ[i2],
                        FACE_UV[2][0],
                        FACE_UV[2][1],
                        scrX[i3],
                        scrY[i3],
                        scrIZ[i3],
                        FACE_UV[3][0],
                        FACE_UV[3][1],
                        cube.texture,
                        lit,
                        clipBuffer
                    );
                    continue;
                }
                var packed = packColor((baseR * intensity) | 0, (baseG * intensity) | 0, (baseB * intensity) | 0);

                // Quad -> two triangles, same winding
                Triangle3DOps.fillTriangleZ(
                    surface,
                    depthBuffer,
                    scrX[i0],
                    scrY[i0],
                    scrIZ[i0],
                    scrX[i1],
                    scrY[i1],
                    scrIZ[i1],
                    scrX[i2],
                    scrY[i2],
                    scrIZ[i2],
                    packed,
                    clipBuffer
                );
                Triangle3DOps.fillTriangleZ(
                    surface,
                    depthBuffer,
                    scrX[i0],
                    scrY[i0],
                    scrIZ[i0],
                    scrX[i2],
                    scrY[i2],
                    scrIZ[i2],
                    scrX[i3],
                    scrY[i3],
                    scrIZ[i3],
                    packed,
                    clipBuffer
                );
            }
        }

        return {
            width: width,
            height: height,
            /**
             * Render one frame.
             * @param {Surface} surface - target (must be width x height)
             * @param {DepthBuffer} depthBuffer - depth buffer (same size)
             * @param {number} t - time in seconds (drives rotation)
             * @param {Uint8Array|null} [clipBuffer] - optional clip mask
             */
            render: function (surface, depthBuffer, t, clipBuffer) {
                surface.data32.fill(bgPacked);
                depthBuffer.clear();
                for (var i = 0; i < cubes.length; i++) {
                    renderCube(surface, depthBuffer, cubes[i], t, clipBuffer || null);
                }
            }
        };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { makeCubesScene: makeCubesScene };
    } else {
        global.CubesScene = { makeCubesScene: makeCubesScene };
    }
})(typeof window !== 'undefined' ? window : globalThis);

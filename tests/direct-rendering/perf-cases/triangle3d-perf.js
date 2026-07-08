/**
 * 3D Primitive Performance Tests (Triangle3DOps + DepthBuffer + Texture3D)
 *
 * Hand-registered (not via registerParametricPerfTests: the parametric
 * generator's stroke/operation grid is 2D-specific). Grid:
 * - 4 fill modes isolating the four span code paths:
 *   flat          fillTriangleZ (zFlatSpan)
 *   tex-affine    fillTriangleTextured (zTexturedSpan, unlit)
 *   tex-persp     fillTriangleTexturedPersp, intensity 256 (copy fast path)
 *   tex-persp-mod fillTriangleTexturedPersp, intensity 200 (modulated path)
 * - 3 triangle sizes: szS 24px, szM 96px, szL 288px (legs of a right
 *   triangle) - small isolates per-triangle overhead, large isolates span
 *   throughput.
 *
 * Depth behavior: the depth buffer is cleared once per draw call and each
 * instance uses a strictly increasing 1/z, so every pixel PASSES the depth
 * test and is written - worst-case (full write) cost, deterministic.
 *
 * Browser comparison harness note: these tests are SWCanvas-only (there is
 * no native-canvas equivalent of a depth-tested triangle). On a context
 * without a Core surface (native HTML5 canvas) the draw function is a no-op.
 */

(function () {
    'use strict';

    var SIZES = { szS: 24, szM: 96, szL: 288 };
    var MODES = ['flat', 'tex-affine', 'tex-persp', 'tex-persp-mod', 'tex-persp-flatz'];

    // Lazy per-surface depth buffers (the harness reuses one canvas per test)
    var depthBuffers = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var texture = null;
    var PACKED_COLOR = (0xff000000 | (60 << 16) | (96 << 8) | 224) >>> 0;

    function getCore() {
        var ns = typeof SWCanvas !== 'undefined' ? SWCanvas : null;
        return ns && ns.Core && ns.Core.Triangle3DOps ? ns.Core : null;
    }

    function getSurface(ctx) {
        var canvas = ctx.canvas;
        if (!canvas) return null;
        return canvas.surface || canvas._surface || null;
    }

    function getDepthBuffer(Core, surface) {
        var db = depthBuffers.get(surface);
        if (!db || db.width !== surface.width || db.height !== surface.height) {
            db = new Core.DepthBuffer(surface.width, surface.height);
            depthBuffers.set(surface, db);
        }
        return db;
    }

    function getTexture(Core) {
        if (!texture) {
            var S = 128;
            var data = new Uint8ClampedArray(S * S * 4);
            for (var y = 0; y < S; y++) {
                for (var x = 0; x < S; x++) {
                    var t = ((x >> 4) + (y >> 4)) & 1;
                    var i = (y * S + x) * 4;
                    data[i] = t ? 200 : 60;
                    data[i + 1] = t ? 150 : 90;
                    data[i + 2] = t ? 80 : 160;
                    data[i + 3] = 255;
                }
            }
            texture = new Core.Texture3D({ width: S, height: S, data: data });
        }
        return texture;
    }

    function makeDrawFunction(mode, size) {
        return function (ctx, instances) {
            var Core = getCore();
            var surface = getSurface(ctx);
            if (!Core || !surface) return null; // native canvas: no-op

            var T = Core.Triangle3DOps;
            var depth = getDepthBuffer(Core, surface);
            depth.clear();

            var tex = mode === 'flat' ? null : getTexture(Core);
            var numToDraw = instances && instances > 0 ? instances : 1;
            var maxX = surface.width - size - 1;
            var maxY = surface.height - size - 1;

            for (var i = 0; i < numToDraw; i++) {
                var x = SeededRandom.getRandom() * maxX;
                var y = SeededRandom.getRandom() * maxY;
                var iz = 0.0002 * (i + 1); // strictly increasing: always passes

                if (mode === 'flat') {
                    T.fillTriangleZ(surface, depth, x, y, iz, x + size, y, iz, x, y + size, iz, PACKED_COLOR, null);
                } else if (mode === 'tex-affine') {
                    T.fillTriangleTextured(
                        surface, depth,
                        x, y, iz, 0, 0,
                        x + size, y, iz, size, 0,
                        x, y + size, iz, 0, size,
                        tex, null
                    );
                } else {
                    // Perspective-correct. Regular modes get strong depth
                    // variation so the per-segment divides do real work;
                    // 'flatz' has near-constant depth (the far-away-floor
                    // profile that adaptive segmentation targets).
                    var izFar = mode === 'tex-persp-flatz' ? iz * 0.985 : iz * 0.5;
                    var intensity = mode === 'tex-persp-mod' ? 200 : 256;
                    T.fillTriangleTexturedPersp(
                        surface, depth,
                        x, y, iz, 0, 0,
                        x + size, y, izFar, size, 0,
                        x, y + size, iz, 0, size,
                        tex, intensity, null
                    );
                }
            }
            return null;
        };
    }

    for (var m = 0; m < MODES.length; m++) {
        for (var sizeKey in SIZES) {
            var mode = MODES[m];
            var size = SIZES[sizeKey];
            var testId = 'triangle3d-perf--' + mode + '--sw0--' + sizeKey;
            var perfName = 'Triangle3D ' + mode + ': ' + sizeKey + ' (' + size + 'px)';

            registerDirectRenderingTest(
                testId,
                (function (fn) {
                    // Wrapper matches the harness call shape (ctx, iteration, instances)
                    return function (ctx, iterationNumber, instances) {
                        return fn(ctx, instances);
                    };
                })(makeDrawFunction(mode, size)),
                'triangle3d',
                {}, // No visual checks for perf-only tests
                {
                    perfName: perfName,
                    performanceTestSupported: true,
                    description: 'Performance test: ' + perfName,
                    strokeCategory: 'sw0',
                    sizeCategory: sizeKey,
                    operation: 'fill-opaque'
                }
            );
        }
    }
})();

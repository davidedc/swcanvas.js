/**
 * Fox scene — port of the first scene of Electric Gryphon's PICO-8 3D demo
 * (rotating fox with dynamic per-face lighting) to the SW3D engine over
 * SWCanvas, extended with a perspective-textured ground plane and the
 * pyramid/column models from the same demo.
 *
 * Acceptance-test intent: real mesh (338 triangles), per-face dynamic
 * Lambert, textured ground exercising perspective correction across a large
 * plane, and a camera orbit that dips close to geometry so the near-plane
 * clipper does real work every orbit.
 *
 * Works in Node (module.exports) and the browser (global FoxScene).
 */
(function (global) {
    'use strict';

    function makeFoxScene(SWCanvas, SW3D, GryphonModels, width, height) {
        var engine = SW3D.makeEngine(SWCanvas, {
            width: width,
            height: height,
            znear: 0.15,
            light: [-0.35, 0.8, -0.5],
            ambient: 0.25,
            diffuse: 0.75
        });

        function scaled(model, s) {
            var p = model.positions.slice();
            for (var i = 0; i < p.length; i++) p[i] *= s;
            return p;
        }

        function solidMesh(model, scale, color) {
            return SW3D.makeMesh({
                positions: scaled(model, scale),
                faces: model.faces.map(function (v) {
                    return { v: v, color: color };
                })
            });
        }

        // Gryphon model units are large (fox ~12 units tall, columns ~17):
        // scale to a human-ish scene where the ground plane is at y = -2.2
        var fox = solidMesh(GryphonModels.decode('fox'), 0.22, [226, 88, 52]);
        var pyramid = solidMesh(GryphonModels.decode('pyramid'), 0.3, [250, 190, 80]);
        var column = solidMesh(GryphonModels.decode('column'), 0.28, [185, 180, 172]);

        // Checkered ground texture (uniform border color hides wrap seams)
        var groundTex = (function () {
            var S = 128;
            var data = new Uint8ClampedArray(S * S * 4);
            for (var y = 0; y < S; y++) {
                for (var x = 0; x < S; x++) {
                    var t = ((x >> 5) + (y >> 5)) & 1;
                    var r = t ? 62 : 44,
                        g = t ? 84 : 62,
                        b = t ? 68 : 52;
                    if (x % 32 === 0 || y % 32 === 0) {
                        r = 34;
                        g = 46;
                        b = 40;
                    }
                    var i = (y * S + x) * 4;
                    data[i] = r;
                    data[i + 1] = g;
                    data[i + 2] = b;
                    data[i + 3] = 255;
                }
            }
            // buildMips: distant floor spans sample coarser levels -> no
            // horizon shimmer, better cache locality
            return new SWCanvas.Core.Texture3D({ width: S, height: S, data: data }).buildMips();
        })();

        // One big quad, +y normal (outward winding seen from above),
        // UVs span 8 texture repeats via wrap addressing
        var G = 20, GY = -2.2, REP = 8 * 128;
        var ground = SW3D.makeMesh({
            positions: [-G, GY, -G, -G, GY, G, G, GY, G, G, GY, -G],
            faces: [
                {
                    v: [0, 1, 2, 3],
                    color: [255, 255, 255],
                    texture: groundTex,
                    uv: [
                        [0, 0],
                        [0, REP],
                        [REP, REP],
                        [REP, 0]
                    ]
                }
            ]
        });

        var target = [0, -0.9, 0]; // fox mid-height (base sits on the ground)

        return {
            width: width,
            height: height,
            engine: engine,
            /**
             * Render one frame.
             * @param {Object} surface - Surface or {width,height,data32}
             * @param {DepthBuffer} depthBuffer
             * @param {number} t - seconds
             * @param {Uint8Array|null} [clipBuffer]
             * @returns {number} triangles drawn
             */
            render: function (surface, depthBuffer, t, clipBuffer) {
                surface.data32.fill((0xff000000 | (46 << 16) | (30 << 8) | 22) >>> 0);
                depthBuffer.clear();

                // Camera orbit that breathes in and out - at its closest it
                // passes through the column ring so near clipping is exercised
                var a = t * 0.22;
                var r = 6.5 + 3.0 * Math.sin(t * 0.35);
                var pos = [target[0] + r * Math.sin(a), 0.7 + 0.7 * Math.sin(t * 0.5), target[2] + r * Math.cos(a)];
                var dx = target[0] - pos[0],
                    dy = target[1] - pos[1],
                    dz = target[2] - pos[2];
                var yaw = Math.atan2(dx, dz);
                var pitch = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
                engine.setCamera(pos, SW3D.mat3FromEuler(pitch, yaw, 0));

                // Rough front-to-back object order: with a z-buffer the order
                // is free to choose, and near-to-far maximizes early depth
                // rejects (distant pixels fail the test before fetching and
                // lighting texels). The big ground plane goes last for the
                // same reason - it is behind everything that overlaps it.
                var draws = [{ mesh: fox, pos: [0, GY, 0], rot: [0, t * 0.5, 0] }];
                for (var i = 0; i < 5; i++) {
                    var pa = (i / 5) * Math.PI * 2 + t * 0.4;
                    draws.push({
                        mesh: pyramid,
                        pos: [4.2 * Math.sin(pa), -0.5 + 0.8 * Math.sin(t * 0.9 + i), 4.2 * Math.cos(pa)],
                        rot: [t * 0.7 + i, t * 0.9, t * 0.5]
                    });
                    var ca = (i / 5) * Math.PI * 2 + 0.63;
                    draws.push({
                        mesh: column,
                        pos: [6.5 * Math.sin(ca), GY, 6.5 * Math.cos(ca)],
                        rot: [0, ca, 0]
                    });
                }
                for (i = 0; i < draws.length; i++) {
                    var d = draws[i];
                    var ddx = d.pos[0] - pos[0],
                        ddy = d.pos[1] - pos[1],
                        ddz = d.pos[2] - pos[2];
                    d.distSq = ddx * ddx + ddy * ddy + ddz * ddz;
                }
                draws.sort(function (a, b) {
                    return a.distSq - b.distSq;
                });

                var tris = 0;
                for (i = 0; i < draws.length; i++) {
                    tris += engine.drawMesh(surface, depthBuffer, draws[i].mesh, draws[i].pos, draws[i].rot, clipBuffer);
                }
                tris += engine.drawMesh(surface, depthBuffer, ground, [0, 0, 0], [0, 0, 0], clipBuffer);
                return tris;
            }
        };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { makeFoxScene: makeFoxScene };
    } else {
        global.FoxScene = { makeFoxScene: makeFoxScene };
    }
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single rotated (tilted) rounded rectangle with PER-CORNER radii, opaque fill and a random 2-40px opaque stroke. Per-corner radii under a non-axis-aligned rotation take the GENERIC pipeline (the rotated direct family is uniform-radius only), so this case pins that the fallback draws them whole.
 *
 *
 * ---
 *
 * | Facet                  | Value          | Reason
 * |------------------------|----------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects  | The test draws and registers itself as a 'rounded-rects' test.
 * | Count                  | single         | One shape in visual regression mode.
 * | SizeCategory           | random         | Width 60-139, height 60-119.
 * | FillStyle              | opaque         | Fill color is `rgb(0, 0, 255)`.
 * | StrokeStyle            | opaque         | Stroke color is `rgb(255, 0, 0)`.
 * | StrokeThickness        | 2-40px         | Stroke width is a random integer in [2, 40].
 * | Layout                 | centered       | The shape is placed near the canvas center.
 * | CenteredAt             | random         | The center is jittered by up to +/-20px.
 * | EdgeAlignment          | not-crisp      | The shape is rotated by a random angle.
 * | Orientation            | rotated        | A random rotation via `ctx.rotate()`.
 * | ArcAngleExtent         | N/A            | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | per-corner     | A radii list is picked per iteration: rounded top/square bottom, one corner, a diagonal pair, three values, or four independent values (zeros included).
 * | ContextTranslation     | none           | (The translate to the shape's center is part of drawing a rotated shape, not a test variable.)
 * | ContextRotation        | none           | (The rotation is the shape's orientation facet.)
 * | ContextScaling         | none           | The test does not use `ctx.scale()`.
 * | Clipped on shape       | none           | The test does not involve clipping.
 * | Clipped on shape count | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a      | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a            | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a   | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - allowPathBasedRendering: per-corner radii under a tilt are DESIGNED to take the generic path
 *   (DIRECT-RENDERING-SUMMARY.MD §9 entry 17); tests/core/071 pins the dispatch itself.
 */

function drawTest(ctx, iterationNumber, instances) {
    // Seeded per-corner radii, cycling through the shapes per-corner callers use.
    // (Nested: case files share one global scope in the browser.)
    function pickCornerRadii(maxR) {
        const r = () => Math.round(SeededRandom.getRandom() * maxR);
        const pattern = Math.floor(SeededRandom.getRandom() * 5);
        if (pattern === 0) {
            const a = r();
            return [a, a, 0, 0]; // rounded top, square bottom (a window title bar)
        }
        if (pattern === 1) {
            const radii = [0, 0, 0, 0];
            radii[Math.floor(SeededRandom.getRandom() * 4)] = r(); // one rounded corner
            return radii;
        }
        if (pattern === 2) return [r(), r()]; // diagonal pairs
        if (pattern === 3) return [r(), r(), r()];
        return [0, 1, 2, 3].map(() => (SeededRandom.getRandom() < 0.3 ? 0 : r()));
    }

    const isPerformanceRun = instances !== null && instances > 0;
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    function drawRotatedRoundRect(context, centerX, centerY, w, h, radii, angle, lw) {
        context.save();
        context.translate(centerX, centerY);
        context.rotate(angle);
        context.fillStyle = 'rgb(0, 0, 255)';
        context.strokeStyle = 'rgb(255, 0, 0)';
        context.lineWidth = lw;
        context.fillStrokeRoundRect(-w / 2, -h / 2, w, h, radii);
        context.restore();
    }

    if (isPerformanceRun) {
        for (let i = 0; i < instances; i++) {
            const w = 60 + Math.floor(SeededRandom.getRandom() * 60);
            const h = 60 + Math.floor(SeededRandom.getRandom() * 50);
            const radii = pickCornerRadii(Math.min(w, h) * 0.4);
            const angle = SeededRandom.getRandom() * Math.PI * 2;
            const lw = 3 + Math.floor(SeededRandom.getRandom() * 8);
            drawRotatedRoundRect(
                ctx,
                SeededRandom.getRandom() * canvasWidth,
                SeededRandom.getRandom() * canvasHeight,
                w,
                h,
                radii,
                angle,
                lw
            );
        }
        return null;
    }

    const width = 60 + Math.floor(SeededRandom.getRandom() * 80);
    const height = 60 + Math.floor(SeededRandom.getRandom() * 60);
    const radii = pickCornerRadii(Math.min(width, height) * 0.4);
    const rotation = SeededRandom.getRandom() * Math.PI * 2;
    const lineWidth = 2 + Math.floor(SeededRandom.getRandom() * 39);
    const cx = canvasWidth / 2 + (SeededRandom.getRandom() - 0.5) * 40;
    const cy = canvasHeight / 2 + (SeededRandom.getRandom() - 0.5) * 40;

    drawRotatedRoundRect(ctx, cx, cy, width, height, radii, rotation, lineWidth);

    return {
        logs: [
            `Shape: center=(${cx.toFixed(1)},${cy.toFixed(1)}), size=${width}x${height}, radii=${JSON.stringify(radii)}, angle=${Math.round((rotation * 180) / Math.PI)}`,
            `Fill: rgb(0, 0, 255), Stroke: rgb(255, 0, 0), lineWidth=${lineWidth}`
        ]
    };
}

registerDirectRenderingTest(
    'roundrect-sgl-szRand-fOpaq-sOpaq-sw2-40px-lytCenter-cenRand-edgeNotCrisp-ornRot-rrrCorner',
    drawTest,
    'rounded-rects',
    {
        extremes: false,
        allowPathBasedRendering: true,
        shapeIntegrity: { hasFill: true, hasStroke: true }
    },
    {
        title: 'Single Rotated Per-Corner Rounded Rectangle - Fill + 2-40px Stroke (Generic Path)',
        description: 'Tests that per-corner radii under a non-axis-aligned rotation render whole through the generic pipeline (opaque fill, random 2-40px opaque stroke).',
    }
);

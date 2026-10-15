/**
 * TEST SUMMARY:
 * =================
 *
 * Description: Tests a single 1px semi-transparent stroked rounded rectangle with PER-CORNER radii, crisp, centered at a grid point or a pixel center. Pins single-blend junctions through mixed rounded and square corners.
 *
 *
 * ---
 *
 * | Facet                  | Value              | Reason
 * |------------------------|--------------------|-----------------------------------------------------------------------------------------------------
 * | Shape category         | rounded-rects      | The test draws and registers itself as a 'rounded-rects' test.
 * | Count                  | single             | The test draws a single shape instance in its primary visual regression mode.
 * | SizeCategory           | mixed              | Rect dimensions are randomized in [20, 149], spanning size categories S, M, and L.
 * | FillStyle              | none               | The test only calls `ctx.strokeRoundRect()` and does not apply a fill.
 * | StrokeStyle            | semitransparent    | The stroke color is `rgba(255, 0, 0, 0.5)`.
 * | StrokeThickness        | 1px                | `ctx.lineWidth` is hardcoded to 1.
 * | Layout                 | centered           | The shape is positioned relative to the canvas center.
 * | CenteredAt             | mixed-pixel-grid   | The center is on a grid point or a pixel center, 50/50 per axis.
 * | EdgeAlignment          | crisp              | The rect's x/y are snapped to *.5 with `ensureHalfPoint()`.
 * | Orientation            | square             | The rectangle is axis-aligned with no rotation.
 * | ArcAngleExtent         | N/A                | This facet is not applicable to rectangle shapes.
 * | RoundRectRadius        | per-corner         | A radii list is picked per iteration: rounded top/square bottom, one corner, a diagonal pair, three values, or four independent values (zeros included).
 * | ContextTranslation     | none               | The test does not use `ctx.translate()`.
 * | ContextRotation        | none               | The test does not use `ctx.rotate()`.
 * | ContextScaling         | none               | The test does not use `ctx.scale()`.
 * | Clipped on shape       | none               | The test does not involve clipping.
 * | Clipped on shape count | n/a                | Not applicable as there is no clipping.
 * | Clipped on shape arrangement | n/a          | Not applicable as there is no clipping.
 * | Clipped on shape size  | n/a                | Not applicable as there is no clipping.
 * | Clipped on shape edge alignment | n/a       | Not applicable as there is no clipping.
 *
 * ---
 *
 * UNCAPTURED ASPECTS IN FILENAME / FACETS ABOVE:
 * ----------------------------------------------
 * - `totalUniqueColors: 2` is the single-blend check: a junction pixel blended twice would add a darker colour.
 */

registerDirectRenderingTest(
    'roundrect-sgl-szMix-fNone-sSemi-sw1px-lytCenter-cenMixPG-edgeCrisp-ornAxial-rrrCorner',
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

        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Random integer dimensions (20-149px spans S, M, L sizes)
        const width = Math.floor(20 + SeededRandom.getRandom() * 130);
        const height = Math.floor(20 + SeededRandom.getRandom() * 130);

        const radii = pickCornerRadii(Math.min(width, height) * 0.4);

        // Grid or pixel centre, per axis
        const centerX = Math.floor(canvasWidth / 2) + (SeededRandom.getRandom() < 0.5 ? 0.5 : 0);
        const centerY = Math.floor(canvasHeight / 2) + (SeededRandom.getRandom() < 0.5 ? 0.5 : 0);

        // x,y at .5 for crisp 1px strokes
        const x = ensureHalfPoint(centerX - width / 2);
        const y = ensureHalfPoint(centerY - height / 2);

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 1;

        ctx.strokeRoundRect(x, y, width, height, radii);

        return {
            logs: [
                `Semi-transparent 1px per-corner rounded rect at (${x}, ${y}) size ${width}x${height}, radii=${JSON.stringify(radii)}`
            ],
            checkData: calculateStrokedRectBounds(x, y, width, height, 1)
        };
    },
    'rounded-rects',
    {
        extremes: true,
        totalUniqueColors: 2,
        shapeIntegrity: true,
        stroke8Connectivity: { color: [255, 128, 128], tolerance: 10 }
    },
    {
        title: 'Single 1px Semi-Transparent Stroked Per-Corner Rounded Rectangle (Crisp, Mixed P/G Centering)',
        description: 'Tests crisp, single-blend rendering of a 1px semi-transparent stroked rounded rectangle with per-corner radii (square corners included).',
    }
);

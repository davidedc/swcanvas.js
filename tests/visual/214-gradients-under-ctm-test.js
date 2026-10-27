// Test: radial, conic and linear gradients under non-trivial CTMs, plus the
// radial two-circle cone (focal and non-nested circles), and patterns under
// rotation, fractional scale and translation, sampled nearest-neighbour
// (smoothing off) and filtered (smoothing on)
// This file will be concatenated into the main visual test suite

registerVisualTest('gradients-under-ctm', {
    name: 'Gradients and patterns under scale / rotation / skew, and the radial cone',
    width: 360,
    height: 480,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 360, 480);

        function stops(g) {
            g.addColorStop(0, 'rgb(255, 200, 0)');
            g.addColorStop(0.5, 'rgb(200, 0, 120)');
            g.addColorStop(1, 'rgba(0, 80, 255, 0.4)');
            return g;
        }

        // Each cell is 120x120 at (col*120, row*120); every gradient is
        // defined in the cell's own (transformed) user space.
        function cell(col, row, paint) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(col * 120 + 2, row * 120 + 2, 116, 116);
            ctx.clip();
            ctx.translate(col * 120 + 60, row * 120 + 60);
            paint();
            ctx.restore();
        }

        // Row 1: radial under non-uniform scale (an ellipse), radial under
        // rotate + non-uniform scale, conic under rotation.
        cell(0, 0, () => {
            ctx.scale(2, 1);
            ctx.fillStyle = stops(ctx.createRadialGradient(0, 0, 4, 0, 0, 28));
            ctx.fillRect(-30, -60, 60, 120);
        });
        cell(1, 0, () => {
            ctx.rotate(Math.PI / 6);
            ctx.scale(1.8, 0.8);
            ctx.fillStyle = stops(ctx.createRadialGradient(0, 0, 4, 0, 0, 30));
            ctx.fillRect(-90, -150, 180, 300);
        });
        cell(2, 0, () => {
            ctx.rotate(0.7);
            ctx.fillStyle = stops(ctx.createConicGradient(0, 0, 0));
            ctx.fillRect(-90, -90, 180, 180);
        });

        // Row 2: focal radial, non-nested circles (the cone), linear under skew.
        cell(0, 1, () => {
            ctx.fillStyle = stops(ctx.createRadialGradient(-20, -15, 3, 0, 0, 55));
            ctx.fillRect(-60, -60, 120, 120);
        });
        cell(1, 1, () => {
            ctx.fillStyle = stops(ctx.createRadialGradient(-35, 0, 8, 30, 0, 22));
            ctx.fillRect(-60, -60, 120, 120);
        });
        cell(2, 1, () => {
            ctx.transform(1, 0, 0.8, 1, 0, 0);
            ctx.fillStyle = stops(ctx.createLinearGradient(-40, -40, 40, 40));
            ctx.fillRect(-120, -60, 240, 120);
        });

        // Row 3: an 8x8 checkerboard pattern under a rotation with a fractional
        // scale, under a fractional scale and translation, and 'no-repeat'
        // under a rotation. Smoothing off: each pixel takes the texel its
        // centre maps to.
        const tile = createTestImage(8, 8, 'checkerboard', ctx);
        ctx.imageSmoothingEnabled = false;
        cell(0, 2, () => {
            ctx.rotate(0.45);
            ctx.scale(2.3, 2.3);
            ctx.fillStyle = ctx.createPattern(tile, 'repeat');
            ctx.fillRect(-40, -40, 80, 80);
        });
        cell(1, 2, () => {
            // No pixel centre lands exactly on a texel edge (an exact tie can
            // round either way in either engine).
            ctx.translate(0.35, 0.65);
            ctx.scale(1.7, 2.9);
            ctx.fillStyle = ctx.createPattern(tile, 'repeat');
            ctx.fillRect(-40, -40, 80, 80);
        });
        cell(2, 2, () => {
            ctx.rotate(-0.5);
            ctx.scale(5.5, 5.5);
            ctx.fillStyle = ctx.createPattern(tile, 'no-repeat');
            ctx.fillRect(-20, -20, 40, 40);
        });

        // Row 4: row 3's patterns with smoothing on. Every mapping here
        // resamples, so the pattern is filtered bilinearly (drawImage's rule):
        // 'repeat' wraps its filter taps across the tile seams, and the
        // 'no-repeat' image fades to transparent over half a texel at its
        // border.
        ctx.imageSmoothingEnabled = true;
        cell(0, 3, () => {
            ctx.rotate(0.45);
            ctx.scale(2.3, 2.3);
            ctx.fillStyle = ctx.createPattern(tile, 'repeat');
            ctx.fillRect(-40, -40, 80, 80);
        });
        cell(1, 3, () => {
            ctx.translate(0.35, 0.65);
            ctx.scale(1.7, 2.9);
            ctx.fillStyle = ctx.createPattern(tile, 'repeat');
            ctx.fillRect(-40, -40, 80, 80);
        });
        cell(2, 3, () => {
            ctx.rotate(-0.5);
            ctx.scale(5.5, 5.5);
            ctx.fillStyle = ctx.createPattern(tile, 'no-repeat');
            ctx.fillRect(-20, -20, 40, 40);
        });
    }
});

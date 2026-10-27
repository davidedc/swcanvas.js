// Test: clip() with an explicit fill rule - the rule-only and Path2D overloads
// This file will be concatenated into the main visual test suite

registerVisualTest('clip-fill-rule-evenodd', {
    name: 'clip(fillRule) and clip(path, fillRule) - nonzero vs evenodd',
    width: 320,
    height: 170,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 320, 170);

        // Two nested same-winding rects + a star: nonzero keeps the inner rect
        // and the star's core, evenodd cuts both out.
        function ring(target, x, y) {
            target.rect(x, y, 60, 60);
            target.rect(x + 15, y + 15, 30, 30);
        }
        function star(target, cx, cy) {
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                const x = cx + Math.cos(angle) * 30;
                const y = cy + Math.sin(angle) * 30;
                if (i === 0) target.moveTo(x, y);
                else target.lineTo(x, y);
            }
            target.closePath();
        }
        function paintUnderClip(x, y) {
            ctx.fillStyle = 'steelblue';
            ctx.fillRect(x - 5, y - 5, 70, 70);
            ctx.fillStyle = 'orange';
            ctx.fillRect(x + 20, y - 5, 20, 70);
        }

        const rules = ['nonzero', 'evenodd'];
        rules.forEach((rule, i) => {
            // Row 1: the current default path, clip(rule)
            const x = 15 + i * 80;
            ctx.save();
            ctx.beginPath();
            ring(ctx, x, 15);
            ctx.clip(rule);
            paintUnderClip(x, 15);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            star(ctx, x + 175, 45);
            ctx.clip(rule);
            paintUnderClip(x + 145, 15);
            ctx.restore();

            // Row 2: a Path2D, clip(path, rule)
            const ringPath = createCompatiblePath2D(ctx);
            ring(ringPath, x, 95);
            ctx.save();
            ctx.clip(ringPath, rule);
            paintUnderClip(x, 95);
            ctx.restore();

            const starPath = createCompatiblePath2D(ctx);
            star(starPath, x + 175, 125);
            ctx.save();
            ctx.clip(starPath, rule);
            paintUnderClip(x + 145, 95);
            ctx.restore();
        });
    }
});

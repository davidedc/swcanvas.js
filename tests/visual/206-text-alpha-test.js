// Test: text with globalAlpha — four lines of black text fading from fully
// opaque to mostly transparent. Verifies alpha integrates with the
// per-glyph composite path.

registerVisualTest('text-alpha', {
    name: 'Text with globalAlpha 1.0, 0.75, 0.5, 0.25',
    width: 200, height: 160,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 160);

        ctx.font = '16px Arial';
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'top';

        const alphas = [1.0, 0.75, 0.5, 0.25];
        for (let i = 0; i < alphas.length; i++) {
            ctx.save();
            ctx.globalAlpha = alphas[i];
            ctx.fillText('alpha ' + alphas[i].toFixed(2), 10, 10 + i * 35);
            ctx.restore();
        }
    }
});

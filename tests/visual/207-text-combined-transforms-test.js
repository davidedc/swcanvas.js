// Test: combined transforms — text rendered through a translate + rotate +
// scale stack with a non-black fill (forces the per-glyph composite recolor
// slow path on top of the intermediate-buffer transform path).

registerVisualTest('text-combined-transforms', {
    name: 'Text with combined translate + rotate + scale + colored fill',
    width: 300, height: 200,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 300, 200);

        ctx.font = 'bold 16px Arial';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        ctx.save();
        ctx.translate(150, 100);
        ctx.rotate(-15 * Math.PI / 180);
        ctx.scale(1.5, 1.5);
        ctx.fillStyle = '#0066cc';
        ctx.fillText('Combined', 0, -10);
        ctx.fillStyle = '#cc0066';
        ctx.fillText('Transforms', 0, 10);
        ctx.restore();
    }
});

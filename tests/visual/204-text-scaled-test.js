// Test: scaled text — exercises the TextRenderer slow path with non-uniform
// and uniform scale. The atlas is rasterised at 16px; ctx.scale stretches the
// intermediate buffer at drawImage time via SWCanvas's blit.

registerVisualTest('text-scaled', {
    name: 'Text scaled with ctx.scale at factors 1x, 1.5x, 2x',
    width: 360, height: 160,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 360, 160);

        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textBaseline = 'top';

        ctx.save();
        ctx.fillText('scale 1x', 10, 10);
        ctx.restore();

        ctx.save();
        ctx.translate(10, 40);
        ctx.scale(1.5, 1.5);
        ctx.fillText('scale 1.5x', 0, 0);
        ctx.restore();

        ctx.save();
        ctx.translate(10, 90);
        ctx.scale(2, 2);
        ctx.fillText('scale 2x', 0, 0);
        ctx.restore();
    }
});

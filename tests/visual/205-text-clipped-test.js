// Test: clipped text — a circular clip region constrains the rendered glyphs.
// Multiple horizontal lines of text are drawn; only the portions inside the
// circle should be visible. Exercises the clip/text interaction in the
// rasteriser's drawImage path.

registerVisualTest('text-clipped', {
    name: 'Text rendered with a circular clip region',
    width: 240, height: 160,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 240, 160);

        ctx.save();
        ctx.beginPath();
        ctx.arc(120, 80, 60, 0, 2 * Math.PI);
        ctx.clip();

        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        // Repeating string so something is visible across most of the clip
        // ellipse regardless of where the centre lands.
        for (let y = 25; y <= 145; y += 20) {
            ctx.fillText('clip-clip-clip-clip', 120, y);
        }
        ctx.restore();
    }
});

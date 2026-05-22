// Test: rotated text — exercises the TextRenderer slow path with rotation.
// Multiple labels at different angles around a common centre, each rendered
// via translate → rotate → fillText.

registerVisualTest('text-rotated', {
    name: 'Rotated text at 0, 30, 60, 90, 120, 150, 180 degrees',
    width: 280, height: 280,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 280, 280);

        ctx.font = '16px Arial';
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        const cx = 140, cy = 140;
        const angles = [0, 30, 60, 90, 120, 150, 180];
        for (let i = 0; i < angles.length; i++) {
            const deg = angles[i];
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(deg * Math.PI / 180);
            ctx.fillText(deg + ' deg', 10, 0);
            ctx.restore();
        }
    }
});

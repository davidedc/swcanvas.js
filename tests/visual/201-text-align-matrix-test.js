// Test: textAlign matrix — left / center / right anchored at the same x.
// A vertical guide line marks the anchor x; each label is anchored to it.

registerVisualTest('text-align-matrix', {
    name: 'textAlign: left, center, right at the same anchor x',
    width: 300, height: 120,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 300, 120);

        // Vertical guide line at the anchor x.
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(150, 0);
        ctx.lineTo(150, 120);
        ctx.stroke();

        ctx.font = '16px Arial';
        ctx.fillStyle = 'black';

        ctx.textAlign = 'left';
        ctx.fillText('left', 150, 30);

        ctx.textAlign = 'center';
        ctx.fillText('center', 150, 60);

        ctx.textAlign = 'right';
        ctx.fillText('right', 150, 90);
    }
});

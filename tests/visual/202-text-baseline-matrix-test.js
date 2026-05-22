// Test: textBaseline matrix — top, hanging, middle, alphabetic, ideographic,
// bottom. A horizontal guide line marks the anchor y; each label is anchored
// to it (so different baselines produce text at different y positions).

registerVisualTest('text-baseline-matrix', {
    name: 'textBaseline: top, hanging, middle, alphabetic, ideographic, bottom',
    width: 510, height: 80,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 510, 80);

        // Horizontal guide line at the anchor y.
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(510, 40);
        ctx.stroke();

        ctx.font = '16px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';

        const baselines = ['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'];
        for (let i = 0; i < baselines.length; i++) {
            ctx.textBaseline = baselines[i];
            ctx.fillText(baselines[i], 10 + i * 84, 40);
        }
    }
});

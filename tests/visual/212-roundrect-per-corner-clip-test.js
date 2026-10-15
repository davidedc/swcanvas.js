// Test: roundRect per-corner radii - clipping AT a per-corner roundRect, and being clipped
// This file will be concatenated into the main visual test suite
//
// Left: a per-corner roundRect used as the clip region (stripes are drawn through
// it, then its outline is stroked on top - the stripes must end exactly at the
// outline). Middle: a per-corner roundRect clipped BY a circle. Right: the
// intersection of a rect clip and a per-corner roundRect clip.

registerVisualTest('roundrect-per-corner-clip', {
    name: 'roundRect per-corner radii - as a clip region, and clipped',
    width: 420,
    height: 170,
    draw: function (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 420, 170);

        function stripes(x0, y0, w, h, color) {
            ctx.fillStyle = color;
            for (let i = -h; i < w; i += 12) {
                ctx.beginPath();
                ctx.moveTo(x0 + i, y0 + h);
                ctx.lineTo(x0 + i + h, y0);
                ctx.lineTo(x0 + i + h + 6, y0);
                ctx.lineTo(x0 + i + 6, y0 + h);
                ctx.closePath();
                ctx.fill();
            }
        }

        // 1. Clip AT a per-corner roundRect.
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(15, 20, 120, 130, [50, 0, 30, 10]);
        ctx.clip();
        stripes(0, 0, 150, 170, 'rgb(60, 140, 220)');
        ctx.restore();
        ctx.strokeStyle = 'rgb(0, 40, 100)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(15.5, 20.5, 119, 129, [50, 0, 30, 10]);
        ctx.stroke();

        // 2. A per-corner roundRect clipped by a circle.
        ctx.save();
        ctx.beginPath();
        ctx.arc(210, 85, 62, 0, 2 * Math.PI);
        ctx.clip();
        ctx.fillStyle = 'rgb(255, 200, 120)';
        ctx.strokeStyle = 'rgb(170, 70, 0)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(160, 40, 130, 110, [36, 36, 0, 0]);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 3. Rect clip intersected with a per-corner roundRect clip.
        ctx.save();
        ctx.beginPath();
        ctx.rect(300, 30, 70, 120);
        ctx.clip();
        ctx.beginPath();
        ctx.roundRect(320, 15, 85, 100, [0, 40, 0, 40]);
        ctx.clip();
        stripes(290, 0, 130, 170, 'rgb(220, 60, 120)');
        ctx.restore();
    }
});

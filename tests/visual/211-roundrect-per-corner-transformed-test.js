// Test: roundRect per-corner radii under transforms, thick strokes and negative sizes
// This file will be concatenated into the main visual test suite
//
// The corner radii belong to the USER-space rect, so the CTM carries each rounded
// corner along with it: under quarter turns the rounded corners rotate around the
// box, under a tilt they tilt with it, and under a non-uniform scale they become
// elliptical. A negative width or height mirrors the rect about (x, y), and the
// radii stay attached to the corners as named from (x, y) - exactly as HTML5.

registerVisualTest('roundrect-per-corner-transformed', {
    name: 'roundRect per-corner radii - quarter turns, tilt, non-uniform scale, negative size',
    width: 400,
    height: 250,
    draw: function (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 400, 250);

        const radii = [22, 6, 0, 12]; // every corner different

        function shape(fill, stroke, lineWidth) {
            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.roundRect(-40, -25, 80, 50, radii);
            ctx.fill();
            ctx.stroke();
        }

        // Quarter turns 0, 90, 180, 270 degrees.
        for (let k = 0; k < 4; k++) {
            ctx.save();
            ctx.translate(60 + k * 95, 60);
            ctx.rotate((k * Math.PI) / 2);
            shape('rgb(255, 210, 160)', 'rgb(180, 80, 0)', 2);
            ctx.restore();
        }

        // Tilted, with a thick semi-transparent stroke.
        ctx.save();
        ctx.translate(70, 175);
        ctx.rotate(0.45);
        shape('rgba(120, 200, 120, 0.8)', 'rgba(0, 90, 0, 0.6)', 6);
        ctx.restore();

        // Non-uniform scale: elliptical corners.
        ctx.save();
        ctx.translate(195, 175);
        ctx.scale(1.3, 0.7);
        shape('rgb(200, 180, 255)', 'rgb(80, 40, 160)', 2);
        ctx.restore();

        // Negative width: the rect extends LEFT of x, and radii[0] rounds the corner at
        // (x, y) - the visual top-RIGHT. Negative height likewise flips vertically.
        ctx.fillStyle = 'rgb(255, 170, 190)';
        ctx.strokeStyle = 'rgb(160, 0, 40)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(330.5, 145.5, -60, 40, [18, 0, 0, 0]);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(340.5, 235.5, 50, -40, [18, 0, 0, 0]);
        ctx.fill();
        ctx.stroke();
    }
});

// Test: Thick strokes on tight curves - every join kind covers the curve's inner side
// This file will be concatenated into the main visual test suite

registerVisualTest('tight-curve-strokes-join-inner-side', {
    name: 'Tight curves stroked thick - round, miter and bevel joins cover the inner side',
    width: 330, height: 510,
    // A curve is stroked as the polyline it flattens to, with a join at every vertex. Stroked
    // 30 px wide around a radius of 1-2 px, consecutive segments are far too short for their
    // bodies to cover the inner side of their joins, so the joins must: rows are arc, ellipse,
    // bezierCurveTo hairpin, quadraticCurveTo hairpin and arcTo corner; columns are lineJoin
    // round, miter and bevel. The three cells of a row must show the same solid inner side.
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 330, 510);

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 30;
        ctx.lineCap = 'butt';

        const curves = [
            (x, y) => ctx.arc(x, y, 2, 0.3, 0.3 + 1.6 * Math.PI, false),
            (x, y) => ctx.ellipse(x, y, 1, 2.5, 0.4, 0.2, 0.2 + 1.7 * Math.PI, false),
            (x, y) => {
                ctx.moveTo(x - 2, y - 3);
                ctx.bezierCurveTo(x + 3, y - 3, x + 3, y + 3, x - 2, y + 3);
            },
            (x, y) => {
                ctx.moveTo(x - 2, y - 3);
                ctx.quadraticCurveTo(x + 5, y, x - 2, y + 3);
            },
            (x, y) => {
                ctx.moveTo(x - 9, y + 2);
                ctx.arcTo(x + 0.7, y - 0.3, x - 2, y + 8, 1);
                ctx.lineTo(x - 2, y + 8);
            }
        ];
        const joins = ['round', 'miter', 'bevel'];

        for (let row = 0; row < curves.length; row++) {
            for (let col = 0; col < joins.length; col++) {
                ctx.lineJoin = joins[col];
                ctx.beginPath();
                curves[row](55.37 + col * 110, 50.37 + row * 100);
                ctx.stroke();
            }
        }
    }
});

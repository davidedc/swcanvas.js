// Test: roundRect per-corner radii - every radii form, square corners, overlap scaling
// This file will be concatenated into the main visual test suite
//
// The standard roundRect() path method with HTML5 radii (CSS border-radius order:
// [topLeft, topRight, bottomRight, bottomLeft], shorter lists expanded). Each cell
// is a fill plus a crisp 1px stroke of the same radii. The bottom row ends with the
// window composition this feature exists for: a uniformly rounded window body with
// a title bar rounded only at the top.

registerVisualTest('roundrect-per-corner-radii', {
    name: 'roundRect per-corner radii - list forms, square corners, overlap scaling',
    width: 420,
    height: 230,
    draw: function (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 420, 230);

        const cases = [
            12, // all four
            [20, 4], // TL & BR = 20, TR & BL = 4
            [20, 8, 0], // TL = 20, TR & BL = 8, BR = 0
            [22, 12, 6, 0], // one radius per corner
            [16, 16, 0, 0], // rounded top, square bottom
            [0, 0, 16, 16], // square top, rounded bottom
            [0, 26, 0, 26], // diagonal pair
            [120, 0, 0, 0], // overflows: scaled down to fit (to 64 here, the box height)
            [80, 80, 80, 80] // overflows uniformly: fully round ends
        ];
        cases.forEach((radii, i) => {
            const col = i % 5;
            const row = Math.floor(i / 5);
            const x = 12 + col * 81;
            const y = 12 + row * 104;
            ctx.fillStyle = 'rgb(170, 195, 255)';
            ctx.beginPath();
            ctx.roundRect(x, y, 66, 64, radii);
            ctx.fill();
            ctx.strokeStyle = 'rgb(20, 40, 160)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(x + 0.5, y + 0.5, 65, 63, radii);
            ctx.stroke();
        });

        // The window: body rounded all round, title bar rounded only at the top.
        const wx = 336;
        const wy = 116;
        ctx.fillStyle = 'rgb(240, 240, 240)';
        ctx.beginPath();
        ctx.roundRect(wx, wy, 72, 100, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgb(120, 120, 120)';
        ctx.beginPath();
        ctx.roundRect(wx + 0.5, wy + 0.5, 71, 99, 8);
        ctx.stroke();
        ctx.fillStyle = 'rgb(70, 110, 200)';
        ctx.beginPath();
        ctx.roundRect(wx, wy, 72, 18, [8, 8, 0, 0]);
        ctx.fill();
        ctx.strokeStyle = 'rgb(30, 50, 120)';
        ctx.beginPath();
        ctx.roundRect(wx + 0.5, wy + 0.5, 71, 17, [8, 8, 0, 0]);
        ctx.stroke();
    }
});

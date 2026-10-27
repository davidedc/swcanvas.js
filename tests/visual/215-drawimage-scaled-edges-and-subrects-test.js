// Test: drawImage smoothing at the image edges and across source sub-rects
// This file will be concatenated into the main visual test suite

registerVisualTest('drawimage-scaled-edges-and-subrects', {
    name: 'drawImage scaled - opaque edges, sub-rect neighbours, parts == whole',
    width: 330,
    height: 230,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 330, 230);

        // Opaque test images: a 16x10 colour ramp, a 12x8 bordered tile and the
        // 30x30 overlapping-squares sheet.
        const ramp = createTestImage(16, 10, 'gradient', ctx);
        const bordered = createTestImage(12, 8, 'border', ctx);
        const sheet = createTestImage(30, 30, 'overlapping-squares', ctx);

        // Row 1: the ramp scaled up 6x (opaque to its edges), the same ramp as
        // two abutting halves (must match the whole), and under ctx.scale(5).
        ctx.drawImage(ramp, 10, 10, 96, 60);
        ctx.drawImage(ramp, 0, 0, 8, 10, 116, 10, 48, 60);
        ctx.drawImage(ramp, 8, 0, 8, 10, 164, 10, 48, 60);
        ctx.save();
        ctx.scale(5, 5);
        ctx.drawImage(ramp, 45, 2);
        ctx.restore();

        // Row 2: the bordered tile scaled up whole (the border reaches the
        // edges), and its interior alone as a sub-rect (the border texels just
        // outside the sub-rect blend into its edges); then sub-rects of the
        // sheet straddling its colour boundaries.
        ctx.drawImage(bordered, 10, 90, 72, 48);
        ctx.drawImage(bordered, 1, 1, 10, 6, 92, 90, 72, 48);
        ctx.drawImage(sheet, 5, 5, 10, 10, 174, 90, 48, 48);
        ctx.drawImage(sheet, 12, 12, 12, 12, 232, 90, 48, 48);

        // Row 3: a rotated, scaled-up ramp and two non-integer down-scales.
        ctx.save();
        ctx.translate(70, 190);
        ctx.rotate(0.35);
        ctx.drawImage(ramp, -40, -25, 80, 50);
        ctx.restore();
        ctx.drawImage(ramp, 150, 165, 11, 7);
        ctx.drawImage(sheet, 200, 160, 21, 21);
    }
});

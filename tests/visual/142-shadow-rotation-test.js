// Test: Shadow Rotation Test
// Tests shadow functionality with rotated and transformed shapes.
// Verifies shadow offset direction is correct under transformations.

registerVisualTest('shadow-rotation-test', {
    name: 'Shadow Rotation Test',
    width: 200, height: 200,
    // Unified drawing function that works with both canvas types
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);

        // Test 1: Rotated rectangle with shadow
        ctx.save();
        ctx.translate(50, 50);
        ctx.rotate(Math.PI / 6); // 30 degrees

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 6;
        ctx.shadowOffsetY = 6;

        ctx.fillStyle = 'red';
        ctx.fillRect(-20, -15, 40, 30);
        ctx.restore();

        // Test 2: Scaled rectangle with shadow
        ctx.save();
        ctx.translate(140, 50);
        ctx.scale(1.5, 0.8);

        ctx.shadowColor = 'rgba(0, 100, 0, 0.4)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        ctx.fillStyle = 'blue';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.restore();

        // Test 3: Rotated + scaled shape with shadow
        ctx.save();
        ctx.translate(50, 140);
        ctx.rotate(-Math.PI / 4); // -45 degrees
        ctx.scale(1.2, 1.2);

        ctx.shadowColor = 'rgba(200, 0, 200, 0.45)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = -4;
        ctx.shadowOffsetY = 7;

        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        // Test 4: Skewed rectangle with shadow
        ctx.save();
        ctx.translate(145, 135);
        ctx.transform(1, 0.3, 0.2, 1, 0, 0); // skew transform

        ctx.shadowColor = 'rgba(100, 50, 0, 0.5)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = 'orange';
        ctx.fillRect(-20, -15, 40, 30);
        ctx.restore();
    }
});

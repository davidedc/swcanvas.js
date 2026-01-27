// Test: Shadow Clipping Test
// Tests shadow functionality with clip paths to verify shadows respect clipping regions.

registerVisualTest('shadow-clipping-test', {
    name: 'Shadow Clipping Test',
    width: 200, height: 200,
    // Unified drawing function that works with both canvas types
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);

        // Test 1: Rectangle with shadow, clipped to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(50, 50, 35, 0, 2 * Math.PI);
        ctx.clip();

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;

        ctx.fillStyle = 'blue';
        ctx.fillRect(20, 20, 60, 60);
        ctx.restore();

        // Test 2: Circle with shadow, clipped to rectangle
        ctx.save();
        ctx.beginPath();
        ctx.rect(110, 20, 70, 60);
        ctx.clip();

        ctx.shadowColor = 'rgba(255, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = -5;
        ctx.shadowOffsetY = 8;

        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(145, 50, 30, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        // Test 3: Shadow with no blur, clipped to diagonal path
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(20, 100);
        ctx.lineTo(80, 100);
        ctx.lineTo(80, 180);
        ctx.lineTo(20, 180);
        ctx.closePath();
        ctx.clip();

        ctx.shadowColor = 'rgba(128, 0, 128, 0.6)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 8;
        ctx.shadowOffsetY = -5;

        ctx.fillStyle = 'orange';
        ctx.fillRect(30, 120, 40, 40);
        ctx.restore();

        // Test 4: Stroked path with shadow inside clip region
        ctx.save();
        ctx.beginPath();
        ctx.arc(145, 140, 40, 0, 2 * Math.PI);
        ctx.clip();

        ctx.shadowColor = 'rgba(0, 100, 200, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        ctx.strokeStyle = 'magenta';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.rect(115, 110, 60, 60);
        ctx.stroke();
        ctx.restore();
    }
});

// Test: Shadow Large Blur Test
// Tests edge cases with large blur radius (30+) to verify blur algorithm handles them correctly.

registerVisualTest('shadow-large-blur-test', {
    name: 'Shadow Large Blur Test',
    width: 200, height: 200,
    // Unified drawing function that works with both canvas types
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);

        // Test 1: Very large blur (30px) on small rectangle
        ctx.shadowColor = 'rgba(0, 0, 100, 0.4)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillStyle = 'red';
        ctx.fillRect(30, 30, 30, 30);

        // Test 2: Large blur (25px) with offset
        ctx.shadowColor = 'rgba(100, 0, 0, 0.35)';
        ctx.shadowBlur = 25;
        ctx.shadowOffsetX = 8;
        ctx.shadowOffsetY = 8;

        ctx.fillStyle = 'blue';
        ctx.fillRect(130, 30, 35, 35);

        // Test 3: Large blur (35px) on circle
        ctx.shadowColor = 'rgba(0, 100, 0, 0.3)';
        ctx.shadowBlur = 35;
        ctx.shadowOffsetX = -5;
        ctx.shadowOffsetY = 5;

        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.arc(55, 140, 20, 0, 2 * Math.PI);
        ctx.fill();

        // Test 4: Large blur on stroked path
        ctx.shadowColor = 'rgba(100, 0, 100, 0.3)';
        ctx.shadowBlur = 28;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        ctx.strokeStyle = 'green';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.rect(115, 110, 50, 50);
        ctx.stroke();

        // Reset shadow to disable for cleanup
        ctx.shadowColor = 'transparent';
    }
});

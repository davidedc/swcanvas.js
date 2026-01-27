// Test: Shadow Gradient Test
// Tests shadow functionality with gradient-filled shapes.

registerVisualTest('shadow-gradient-test', {
    name: 'Shadow Gradient Test',
    width: 200, height: 200,
    // Unified drawing function that works with both canvas types
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);

        // Test 1: Linear gradient rectangle with shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        var linearGradient = ctx.createLinearGradient(15, 15, 85, 75);
        linearGradient.addColorStop(0, 'red');
        linearGradient.addColorStop(1, 'yellow');
        ctx.fillStyle = linearGradient;
        ctx.fillRect(15, 15, 70, 60);

        // Test 2: Radial gradient circle with shadow
        ctx.shadowColor = 'rgba(0, 0, 150, 0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = -4;
        ctx.shadowOffsetY = 6;

        var radialGradient = ctx.createRadialGradient(145, 45, 5, 145, 45, 35);
        radialGradient.addColorStop(0, 'white');
        radialGradient.addColorStop(0.5, 'blue');
        radialGradient.addColorStop(1, 'darkblue');
        ctx.fillStyle = radialGradient;
        ctx.beginPath();
        ctx.arc(145, 45, 35, 0, 2 * Math.PI);
        ctx.fill();

        // Test 3: Linear gradient with multiple stops, no blur shadow
        ctx.shadowColor = 'rgba(100, 0, 100, 0.6)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 8;
        ctx.shadowOffsetY = -5;

        var multiGradient = ctx.createLinearGradient(15, 110, 85, 110);
        multiGradient.addColorStop(0, 'green');
        multiGradient.addColorStop(0.5, 'cyan');
        multiGradient.addColorStop(1, 'blue');
        ctx.fillStyle = multiGradient;
        ctx.fillRect(15, 110, 70, 50);

        // Test 4: Radial gradient with large blur shadow
        ctx.shadowColor = 'rgba(200, 100, 0, 0.35)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        var orangeGradient = ctx.createRadialGradient(145, 145, 0, 145, 145, 40);
        orangeGradient.addColorStop(0, 'yellow');
        orangeGradient.addColorStop(1, 'darkorange');
        ctx.fillStyle = orangeGradient;
        ctx.fillRect(105, 105, 80, 80);
    }
});

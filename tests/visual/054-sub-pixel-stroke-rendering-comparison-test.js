// Test: Sub-pixel stroke rendering comparison
// This file will be concatenated into the main visual test suite

registerVisualTest('subpixel-strokes', {
    name: 'Sub-pixel Stroke Rendering',
    width: 600,
    height: 400,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 600, 400);
        
        // Test different stroke widths
        const strokeWidths = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
        const colors = ['red', 'blue', 'green', 'purple', 'orange', 'brown', 'pink'];
        
        // Horizontal lines
        for (let i = 0; i < strokeWidths.length; i++) {
            ctx.strokeStyle = colors[i];
            ctx.lineWidth = strokeWidths[i];
            ctx.beginPath();
            ctx.moveTo(50, 50 + i * 30);
            ctx.lineTo(200, 50 + i * 30);
            ctx.stroke();
            
            // Label the width. Probe the canvas type, not ctx.fillText —
            // both SWCanvas's compat layer and HTML5 Canvas define fillText,
            // but only HTML5 will draw text without an asset bundle loaded.
            ctx.fillStyle = 'black';
            const isHTML5 = typeof HTMLCanvasElement !== 'undefined'
                         && canvas instanceof HTMLCanvasElement;
            if (isHTML5) {
                // HTML5Canvas: use fillText for readable labels in the browser view
                ctx.font = '10px Arial';
                ctx.fillText(strokeWidths[i].toString(), 10, 55 + i * 30);
            } else {
                // SWCanvas: use a small rect to indicate width (no font assets in tests)
                ctx.fillRect(20, 45 + i * 30, 2, strokeWidths[i] * 10 + 2);
            }
        }
        
        // Vertical lines
        for (let i = 0; i < strokeWidths.length; i++) {
            ctx.strokeStyle = colors[i];
            ctx.lineWidth = strokeWidths[i];
            ctx.beginPath();
            ctx.moveTo(250 + i * 30, 50);
            ctx.lineTo(250 + i * 30, 200);
            ctx.stroke();
        }
        
        // Diagonal lines
        for (let i = 0; i < strokeWidths.length; i++) {
            ctx.strokeStyle = colors[i];
            ctx.lineWidth = strokeWidths[i];
            ctx.beginPath();
            ctx.moveTo(50 + i * 25, 250);
            ctx.lineTo(150 + i * 25, 350);
            ctx.stroke();
        }
        
        // Rectangles
        for (let i = 0; i < strokeWidths.length; i++) {
            ctx.strokeStyle = colors[i];
            ctx.lineWidth = strokeWidths[i];
            ctx.beginPath();
            ctx.rect(300 + (i % 4) * 60, 250 + Math.floor(i / 4) * 60, 40, 40);
            ctx.stroke();
        }
        
        // Circles
        for (let i = 0; i < strokeWidths.length; i++) {
            ctx.strokeStyle = colors[i];
            ctx.lineWidth = strokeWidths[i];
            ctx.beginPath();
            ctx.arc(500, 70 + i * 40, 15, 0, 2 * Math.PI);
            ctx.stroke();
        }
    },
});
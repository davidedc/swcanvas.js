// Test: Basic fillText — different fonts, colors, and an invariant character.
// Smoke fixture provides Arial regular + bold + BitmapTextInvariant, all at
// size 16 density-1. Text in this file stays at size 16 so the smoke set has
// matching atlases (any other size hits NO_METRICS, no pixels written).

registerVisualTest('text-basic', {
    name: 'Basic fillText: regular, bold, colored, invariant character',
    width: 300, height: 140,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 300, 140);

        ctx.font = '16px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText('Hello, World!', 10, 25);

        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#003388';
        ctx.fillText('Hello, World! (bold)', 10, 55);

        ctx.font = '16px Arial';
        ctx.fillStyle = '#aa2222';
        ctx.fillText('Red — slow path (recolor)', 10, 85);

        // The smiley auto-redirects to BitmapTextInvariant at the same
        // size+density via the FONT_INVARIANT_CHARS mapping.
        ctx.font = '16px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText('Smiley ☺ via invariant atlas', 10, 115);
    }
});

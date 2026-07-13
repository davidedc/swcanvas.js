// Test: Linear gradient filling the current default path under a transform
// This file will be concatenated into the main visual test suite
//
// Regression guard (see also core test 045). A linear-gradient fillStyle applied to
// the current default path (beginPath()+rect()+fill()) under a scale()/translate()
// CTM must render the full gradient, identically to the same gradient via fillRect().
// Before the fix, fill() drew the device-space path under IDENTITY and dropped the CTM
// for the paint source, collapsing the gradient toward a single color stop. This test
// draws the two side by side; SWCanvas is compared against the HTML5 reference.

registerVisualTest('linear-gradient-path-fill-under-transform', {
    name: 'Linear gradient - current-path fill vs fillRect under transform',
    width: 300, height: 180,
    draw: function(canvas) {
        const ctx = canvas.getContext('2d');

        // Light background
        ctx.fillStyle = 'rgb(240,240,240)';
        ctx.fillRect(0, 0, 300, 180);

        // LEFT: gradient via fillRect (reference path), under translate + scale.
        ctx.save();
        ctx.translate(20, 25);
        ctx.scale(1.3, 1.3);
        const gL = ctx.createLinearGradient(0, 0, 0, 100);
        gL.addColorStop(0, 'red');
        gL.addColorStop(0.5, 'lime');
        gL.addColorStop(1, 'blue');
        ctx.fillStyle = gL;
        ctx.fillRect(0, 0, 90, 100);
        ctx.restore();

        // RIGHT: same gradient via the current default path fill(), same CTM shape.
        ctx.save();
        ctx.translate(170, 25);
        ctx.scale(1.3, 1.3);
        const gR = ctx.createLinearGradient(0, 0, 0, 100);
        gR.addColorStop(0, 'red');
        gR.addColorStop(0.5, 'lime');
        gR.addColorStop(1, 'blue');
        ctx.fillStyle = gR;
        ctx.beginPath();
        ctx.rect(0, 0, 90, 100);
        ctx.fill();
        ctx.restore();
    }
});

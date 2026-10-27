#!/usr/bin/env node
// Debug the complex XOR test to see if purple rectangle appears
const SWCanvas = require('../dist/swcanvas.js');
const saveDebugImage = require('./save-debug-image.js');

console.log('=== Complex XOR Test Verification ===\n');

// Recreate the complex XOR test from the visual comparison
const canvas = SWCanvas.createCanvas(300, 200);
const ctx = canvas.getContext('2d');

// White background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 300, 200);
console.log('1. Drew white background');

// Draw the destination shapes (same as original test)
ctx.fillStyle = 'red';
ctx.beginPath();
ctx.arc(80, 70, 25, 0, Math.PI * 2);
ctx.fill();
console.log('2. Drew red circle');

ctx.fillStyle = 'blue';
ctx.fillRect(120, 45, 50, 50);
console.log('3. Drew blue square');

ctx.fillStyle = 'yellow';
ctx.beginPath();
ctx.moveTo(75, 120);
ctx.lineTo(125, 120);
ctx.lineTo(100, 160);
ctx.closePath();
ctx.fill();
console.log('4. Drew yellow triangle');

// Switch to XOR and draw the purple rectangle that should appear in bottom right
ctx.globalCompositeOperation = 'xor';
console.log('5. Switched to XOR');

// The purple rectangle that was missing before
ctx.fillStyle = 'purple';
ctx.fillRect(140, 60, 60, 20); // This should appear in bottom right area
console.log('6. Drew purple rectangle with XOR');

function checkPixel(x, y, label) {
    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b, a] = imageData.data;
    console.log(`   ${label} (${x},${y}): R=${r}, G=${g}, B=${b}, A=${a}`);
    return {r, g, b, a};
}

console.log('\n7. Checking key areas:');
const redArea = checkPixel(80, 70, 'Red circle (should be unchanged)');
const blueOnly = checkPixel(130, 70, 'Blue square only area (should be blue)');
const purpleOverBlue = checkPixel(150, 70, 'Purple over blue (should be transparent)');
const purpleOverWhite = checkPixel(180, 70, 'Purple over white (should be purple!)');
const yellowArea = checkPixel(100, 140, 'Yellow triangle (should be unchanged)');

// Save debug image
const surface = canvas._coreSurface;
const pngData = SWCanvas.Core.PngEncoder.encode(surface);
console.log('8. Saved ' + saveDebugImage('debug-complex-xor-fixed.basic.png', pngData));

console.log('\n=== VERIFICATION ===');
console.log('Key test: Purple rectangle over white background');
console.log(`Purple over white result: R=${purpleOverWhite.r}, G=${purpleOverWhite.g}, B=${purpleOverWhite.b}, A=${purpleOverWhite.a}`);

if (purpleOverWhite.r > 100 && purpleOverWhite.b > 100 && purpleOverWhite.g < 100) {
    console.log('🎉 SUCCESS: Purple rectangle now appears over white background!');
    console.log('The complex XOR test should now match HTML5 Canvas behavior.');
} else if (purpleOverWhite.a === 0) {
    console.log('❌ Still broken: Purple over white is transparent');
} else {
    console.log(`? Unexpected result: R=${purpleOverWhite.r}, G=${purpleOverWhite.g}, B=${purpleOverWhite.b}`);
}

console.log('\nOther areas:');
console.log(`- Red circle: ${redArea.r > 200 ? 'RED ✓' : 'CHANGED'}`);
console.log(`- Blue only: ${blueOnly.b > 200 ? 'BLUE ✓' : 'CHANGED'}`);  
console.log(`- Purple over blue: ${purpleOverBlue.a === 0 ? 'TRANSPARENT ✓' : 'NOT TRANSPARENT'}`);
console.log(`- Yellow triangle: ${yellowArea.g > 200 ? 'YELLOW ✓' : 'CHANGED'}`);
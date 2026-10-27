#!/usr/bin/env node
// Debug the simple XOR test case step by step
const SWCanvas = require('../dist/swcanvas.js');
const saveDebugImage = require('./save-debug-image.js');

console.log('=== Simple XOR Debug: Blue Square + Red Circle ===\n');

// Recreate the exact same test
const canvas = SWCanvas.createCanvas(200, 150);
const ctx = canvas.getContext('2d');

// White background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 200, 150);
console.log('1. Drew white background');

// Draw blue square as destination
ctx.fillStyle = 'blue';
ctx.fillRect(50, 40, 60, 60);
console.log('2. Drew blue square (50,40) size 60x60');

function checkPixel(x, y, label) {
    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b, a] = imageData.data;
    console.log(`   ${label} (${x},${y}): R=${r}, G=${g}, B=${b}, A=${a}`);
    return {r, g, b, a};
}

console.log('\n3. After drawing blue square:');
checkPixel(40, 70, 'Left of square (white bg)');
checkPixel(80, 70, 'Center of square (blue)');
checkPixel(120, 70, 'Right of square (white bg)');

// Switch to XOR and draw red circle
ctx.globalCompositeOperation = 'xor';
console.log('\n4. Switched to XOR composite operation');

ctx.fillStyle = 'red';
ctx.beginPath();
ctx.arc(100, 70, 35, 0, Math.PI * 2);
ctx.fill();
console.log('5. Drew red circle at (100,70) radius 35 with XOR');

console.log('\n6. After XOR operation:');
const leftBg = checkPixel(40, 70, 'Left background (white, no changes expected)');
const blueOnly = checkPixel(70, 70, 'Blue only area (should be blue)');
const overlap = checkPixel(85, 70, 'Blue+Red overlap (should be transparent)'); 
const redOnly = checkPixel(120, 70, 'Red only area (should be red!)');
const rightBg = checkPixel(150, 70, 'Right background (white, no changes)');

// Save debug image
const surface = canvas._coreSurface;
const pngData = SWCanvas.Core.PngEncoder.encode(surface);
console.log('\n7. Saved ' + saveDebugImage('debug-simple-xor-analysis.basic.png', pngData));

console.log('\n=== ANALYSIS ===');
console.log('Expected results for proper XOR:');
console.log('- Left background: Should remain white (no XOR source over it)');
console.log('- Blue only area: Should remain blue (destination only)');
console.log('- Overlap area: Should be transparent (XOR cancellation)');
console.log('- Red only area: Should be red (source only) ← KEY TEST');
console.log('- Right background: Should remain white (no XOR source over it)');

console.log('\nActual results:');
console.log(`- Left background: ${leftBg.r === 255 && leftBg.g === 255 && leftBg.b === 255 ? 'WHITE ✓' : 'WRONG'}`);
console.log(`- Blue only area: ${blueOnly.b > 200 && blueOnly.r < 50 ? 'BLUE ✓' : 'WRONG'}`);
console.log(`- Overlap area: ${overlap.a === 0 ? 'TRANSPARENT ✓' : 'NOT TRANSPARENT'}`);
console.log(`- Red only area: ${redOnly.r > 200 && redOnly.g < 50 && redOnly.b < 50 ? 'RED ✓' : 'NOT RED ← BUG!'}`);
console.log(`- Right background: ${rightBg.r === 255 && rightBg.g === 255 && rightBg.b === 255 ? 'WHITE ✓' : 'WRONG'}`);

if (redOnly.r < 200 || redOnly.g > 50 || redOnly.b > 50) {
    console.log('\n🚨 CRITICAL BUG IDENTIFIED: Red-only area is not showing red!');
    console.log(`Red-only pixel: R=${redOnly.r}, G=${redOnly.g}, B=${redOnly.b}, A=${redOnly.a}`);
    console.log('This confirms the purple rectangle issue in the complex test.');
    
    // Test the specific BlendPixel call
    console.log('\n=== Testing BlendPixel Directly ===');
    const testResult = SWCanvas.Core.CompositeOperations.blendPixel(
        'xor',
        255, 0, 0, 255,    // Red source
        255, 255, 255, 255  // White destination (background)
    );
    console.log(`Red XOR White: R=${testResult.r}, G=${testResult.g}, B=${testResult.b}, A=${testResult.a}`);
    console.log('Expected: Should show red or some visible color, not transparent!');
}

console.log('\n=== ROOT CAUSE ANALYSIS ===');
console.log('The issue is clear: XOR over white background becomes transparent.');
console.log('But it should show the source color when source exists and destination is just background.');
console.log('This suggests the current XOR logic treats ALL opaque destinations the same.');
console.log('But HTML5 Canvas might distinguish background from explicitly drawn shapes.');
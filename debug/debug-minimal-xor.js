const SWCanvas = require('../dist/swcanvas.js');
const saveDebugImage = require('./save-debug-image.js');

console.log('=== MINIMAL XOR CORNER DEBUG ===');

// Create the exact same test case as the new minimal test
const surface = SWCanvas.Core.Surface(150, 150);
const ctx = new SWCanvas.Core.Context2D(surface);

// White background
ctx.setFillStyle(255, 255, 255, 255);
ctx.fillRect(0, 0, 150, 150);

console.log('1. White background set');

// Blue square from (30,30) to (90,90) 
ctx.setFillStyle(0, 0, 255, 255);
ctx.fillRect(30, 30, 60, 60);

console.log('2. Blue square drawn at (30,30) size 60x60');

// Switch to XOR
ctx.globalCompositeOperation = 'xor';
console.log('3. Switched to XOR composite operation');

// Red circle center (75,45), radius 25
ctx.setFillStyle(255, 0, 0, 255);
ctx.beginPath();
ctx.arc(75, 45, 25, 0, Math.PI * 2);
ctx.fill();

console.log('4. Red circle drawn at center (75,45) radius 25');

// Analyze key pixels
console.log('\n=== PIXEL ANALYSIS ===');

// Expected regions:
// Blue square: (30,30) to (90,90)
// Red circle: center (75,45) radius 25 → roughly (50,20) to (100,70)
// Overlap: roughly (50,30) to (90,70)

const testPoints = [
    // Background (should be white)
    [10, 10, 'Background'],
    
    // Blue square only (should be blue)
    [40, 80, 'Blue only (bottom-left of square)'],
    
    // Red circle only (should be red)  
    [60, 25, 'Red only (top of circle)'],
    
    // Overlap area (should be white/transparent)
    [70, 40, 'Overlap center'],
    [85, 50, 'Overlap right'],
    [55, 35, 'Overlap left'],
];

testPoints.forEach(([x, y, description]) => {
    const offset = y * surface.stride + x * 4;
    const r = surface.data[offset];
    const g = surface.data[offset + 1]; 
    const b = surface.data[offset + 2];
    const a = surface.data[offset + 3];
    
    let colorDesc;
    if (r === 255 && g === 255 && b === 255) {
        colorDesc = 'WHITE';
    } else if (r === 0 && g === 0 && b === 255) {
        colorDesc = 'BLUE';
    } else if (r === 255 && g === 0 && b === 0) {
        colorDesc = 'RED';
    } else {
        colorDesc = `RGB(${r},${g},${b})`;
    }
    
    console.log(`Pixel (${x},${y}) - ${description}: ${colorDesc} (A=${a})`);
});

// Save debug image
const pngData = SWCanvas.Core.PngEncoder.encode(surface);
console.log('\n✅ Debug image saved: ' + saveDebugImage('debug-minimal-xor.basic.png', pngData));

console.log('\n=== EXPECTED vs ACTUAL ===');
console.log('Expected:');
console.log('- Background: WHITE');
console.log('- Blue only areas: BLUE');  
console.log('- Red only areas: RED');
console.log('- Overlap areas: WHITE (transparent, showing background)');
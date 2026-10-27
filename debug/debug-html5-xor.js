const SWCanvas = require('../dist/swcanvas.js');
const saveDebugImage = require('./save-debug-image.js');

console.log('=== HTML5 CANVAS-COMPATIBLE XOR DEBUG ===');

// Test the HTML5-compatible API with same coordinates as minimal test
const canvas = SWCanvas.createCanvas(150, 150);
const ctx = canvas.getContext('2d');

// White background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 150, 150);
console.log('1. White background set');

// Blue square
ctx.fillStyle = 'blue';
ctx.fillRect(30, 30, 60, 60);
console.log('2. Blue square drawn at (30,30) size 60x60');

// XOR red circle
ctx.globalCompositeOperation = 'xor';
ctx.fillStyle = 'red';
ctx.beginPath();
ctx.arc(75, 45, 25, 0, Math.PI * 2);
ctx.fill();
console.log('3. Red circle drawn with XOR operation');

// Access underlying surface for pixel analysis
const surface = canvas._coreSurface;

console.log('\n=== PIXEL ANALYSIS (HTML5 API) ===');
const testPoints = [
    [10, 10, 'Background'],
    [40, 80, 'Blue only'], 
    [60, 25, 'Red only'],
    [70, 40, 'Overlap center'],
    [85, 50, 'Overlap right'],
    [55, 35, 'Overlap left'],
];

testPoints.forEach(([x, y, description]) => {
    const imageData = ctx.getImageData(x, y, 1, 1);
    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];
    const a = imageData.data[3];
    
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

// Also check raw surface data
console.log('\n=== RAW SURFACE DATA ===');
testPoints.forEach(([x, y, description]) => {
    const offset = y * surface.stride + x * 4;
    const r = surface.data[offset];
    const g = surface.data[offset + 1]; 
    const b = surface.data[offset + 2];
    const a = surface.data[offset + 3];
    console.log(`Raw (${x},${y}): R=${r} G=${g} B=${b} A=${a}`);
});

// Save HTML5 API result
const pngData = SWCanvas.Core.PngEncoder.encode(surface);
console.log('\n✅ HTML5 API debug image saved: ' + saveDebugImage('debug-html5-xor.basic.png', pngData));
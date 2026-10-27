const SWCanvas = require('../dist/swcanvas.js');
const saveDebugImage = require('./save-debug-image.js');

console.log('=== COPY OPERATION COLOR DEBUG ===');

// Test the specific orange color from the copy test
const canvas = SWCanvas.createCanvas(100, 100);
const ctx = canvas.getContext('2d');

// White background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 100, 100);

// Purple base (like in the test)
ctx.fillStyle = 'rgba(128, 0, 128, 0.7)';
ctx.fillRect(20, 20, 60, 60);

console.log('1. Purple base rectangle set');

// Use copy operation with orange
ctx.globalCompositeOperation = 'copy';
ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
ctx.fillRect(40, 40, 20, 20);

console.log('2. Orange copy rectangle applied');

// Check the exact color values
const imageData = ctx.getImageData(50, 50, 1, 1);
const r = imageData.data[0];
const g = imageData.data[1];
const b = imageData.data[2];
const a = imageData.data[3];

console.log(`\nResult pixel (50,50): R=${r} G=${g} B=${b} A=${a}`);
console.log(`Expected: R=255 G=165 B=0 A=127 (50% of 255)`);

// Check if color parsing is correct
console.log('\n=== COLOR PARSING TEST ===');

// Test color parsing directly
const testColors = [
    'rgba(255, 165, 0, 0.5)',
    'rgba(255, 165, 0, 1.0)',
    '#ffa500',
    'orange'
];

testColors.forEach(color => {
    const tempCanvas = SWCanvas.createCanvas(10, 10);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = color;
    tempCtx.fillRect(0, 0, 10, 10);
    
    const testData = tempCtx.getImageData(5, 5, 1, 1);
    const tr = testData.data[0];
    const tg = testData.data[1];  
    const tb = testData.data[2];
    const ta = testData.data[3];
    
    console.log(`Color '${color}' → R=${tr} G=${tg} B=${tb} A=${ta}`);
});

// Save debug image
const surface = canvas._coreSurface;
const pngData = SWCanvas.Core.PngEncoder.encode(surface);
console.log('\n✅ Debug image saved: ' + saveDebugImage('debug-copy-color.basic.png', pngData));
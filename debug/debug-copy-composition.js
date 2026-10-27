const SWCanvas = require('../dist/swcanvas.js');
const saveDebugImage = require('./save-debug-image.js');

console.log('=== COPY COMPOSITION ANALYSIS ===');

// Recreate the exact test scenario
const canvas = SWCanvas.createCanvas(300, 200);
const ctx = canvas.getContext('2d');

// White background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 300, 200);

// Purple base rectangle (rgba(128, 0, 128, 0.7))
ctx.fillStyle = 'rgba(128, 0, 128, 0.7)';
ctx.fillRect(10, 160, 40, 30);

console.log('Step 1: Purple base rectangle');

// Check what the purple looks like when composited over white
let imageData = ctx.getImageData(30, 175, 1, 1);
let r = imageData.data[0];
let g = imageData.data[1];
let b = imageData.data[2];
let a = imageData.data[3];
console.log(`Purple over white: R=${r} G=${g} B=${b} A=${a}`);

// Apply copy operation with orange
ctx.globalCompositeOperation = 'copy';
ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
ctx.fillRect(20, 170, 20, 10);

console.log('Step 2: Orange copy operation applied');

// Check the result
imageData = ctx.getImageData(30, 175, 1, 1);
r = imageData.data[0];
g = imageData.data[1];
b = imageData.data[2];
a = imageData.data[3];
console.log(`After copy: R=${r} G=${g} B=${b} A=${a}`);

// What should this look like when the semi-transparent orange is composited over white?
console.log('\n=== EXPECTED COMPOSITION ===');

// Manual calculation: rgba(255, 165, 0, 0.5) over white background
// Formula: result = source * source_alpha + dest * (1 - source_alpha)
const srcR = 255, srcG = 165, srcB = 0, srcA = 0.5;
const dstR = 255, dstG = 255, dstB = 255; // white background

const expectedR = Math.round(srcR * srcA + dstR * (1 - srcA));
const expectedG = Math.round(srcG * srcA + dstG * (1 - srcA));
const expectedB = Math.round(srcB * srcA + dstB * (1 - srcA));

console.log(`Expected final color when viewed: R=${expectedR} G=${expectedG} B=${expectedB}`);
console.log('This should look like a light orange/peachy color, not bright orange');

// Compare with bright orange
console.log('\nBright orange would be: R=255 G=165 B=0');
console.log(`Our result should be: R=${expectedR} G=${expectedG} B=${expectedB}`);

// Test the copy operation vs source-over for comparison
const testCanvas = SWCanvas.createCanvas(200, 100);
const testCtx = testCanvas.getContext('2d');

// Left side: copy operation (current behavior)
testCtx.fillStyle = 'white';
testCtx.fillRect(0, 0, 200, 100);
testCtx.fillStyle = 'rgba(128, 0, 128, 0.7)';
testCtx.fillRect(10, 10, 80, 80);
testCtx.globalCompositeOperation = 'copy';
testCtx.fillStyle = 'rgba(255, 165, 0, 0.5)';
testCtx.fillRect(30, 30, 40, 40);

// Right side: source-over for comparison
testCtx.globalCompositeOperation = 'source-over';
testCtx.fillStyle = 'rgba(128, 0, 128, 0.7)';
testCtx.fillRect(110, 10, 80, 80);
testCtx.fillStyle = 'rgba(255, 165, 0, 0.5)';
testCtx.fillRect(130, 30, 40, 40);

// Save comparison
const testSurface = testCanvas._coreSurface;
const testPngData = SWCanvas.Core.PngEncoder.encode(testSurface);
console.log('\n✅ Comparison image saved: ' + saveDebugImage('debug-copy-vs-sourceover.basic.png', testPngData));

// Check both results
const copyResult = testCtx.getImageData(50, 50, 1, 1);
const sourceOverResult = testCtx.getImageData(150, 50, 1, 1);

console.log(`\nCopy result: R=${copyResult.data[0]} G=${copyResult.data[1]} B=${copyResult.data[2]} A=${copyResult.data[3]}`);
console.log(`Source-over result: R=${sourceOverResult.data[0]} G=${sourceOverResult.data[1]} B=${sourceOverResult.data[2]} A=${sourceOverResult.data[3]}`);
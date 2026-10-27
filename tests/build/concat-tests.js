#!/usr/bin/env node

// Build script to concatenate modular test files into single test suites

const fs = require('fs');
const path = require('path');

function getTestFiles(dir) {
    if (!fs.existsSync(dir)) {
        console.log(`Directory ${dir} does not exist`);
        return [];
    }
    
    const files = fs.readdirSync(dir)
        .filter(file => file.endsWith('.js') && /^\d{3}-/.test(file))
        .sort((a, b) => {
            const numA = parseInt(a.substring(0, 3));
            const numB = parseInt(b.substring(0, 3));
            return numA - numB;
        });
    
    return files.map(file => path.join(dir, file));
}

function buildCoreTests() {
    console.log('Building core functionality tests...');
    
    const testFiles = getTestFiles('tests/core');
    console.log(`Found ${testFiles.length} core test files`);
    
    if (testFiles.length === 0) {
        console.log('No core test files found');
        return;
    }
    
    // Build the concatenated content with static header
    let concatenated = `// Core Functionality Tests
// Comprehensive test suite for SWCanvas API correctness
// Tests fundamental operations, edge cases, and mathematical accuracy

(function(global) {
    'use strict';
    
    // Simple test framework for Node.js and browser compatibility.
    // total = passed + failed + skipped.length, set when the run ends.
    const testResults = { passed: 0, failed: 0, total: 0, failures: [], skipped: [], savedPNGs: [] };

    // What a test can require of its environment (testRequiring). Only the DOM
    // splits the two runners: an element image source (an HTMLImageElement, an
    // HTMLVideoElement, an ImageBitmap) exists only where there is a DOM, and
    // SWCanvas's refusal of one only where there is none. Every other test runs
    // in both, and none may assume either.
    const ENVIRONMENT = {
        'dom': typeof document !== 'undefined',
        'no-dom': typeof document === 'undefined'
    };

    function assertEquals(actual, expected, message) {
        if (actual !== expected) {
            const error = message || \`Expected \${expected}, got \${actual}\`;
            throw new Error(error);
        }
    }
    
    function assertThrows(fn, expectedMessage) {
        try {
            fn();
            throw new Error('Expected function to throw an error');
        } catch (error) {
            if (expectedMessage && !error.message.includes(expectedMessage)) {
                throw new Error(\`Expected error message to contain '\${expectedMessage}', got '\${error.message}'\`);
            }
        }
    }
    
    function test(testName, testFunction) {
        try {
            testFunction();
            testResults.passed++;
            console.log(\`✓ \${testName}\`);
        } catch (error) {
            testResults.failed++;
            testResults.failures.push({ name: testName, message: error.message });
            console.log(\`✗ \${testName}\`);
            console.log(\`  \${error.message}\`);
        }
    }
    
    // A test of something only one environment has. Where the capability is
    // missing the test is SKIPPED: listed in testResults.skipped and logged with
    // the capability it needs, never counted as passed. The other runner runs it.
    function testRequiring(capability, testName, testFunction) {
        if (!(capability in ENVIRONMENT)) {
            throw new Error(\`testRequiring: unknown capability '\${capability}' (known: \${Object.keys(ENVIRONMENT).join(', ')})\`);
        }
        if (!ENVIRONMENT[capability]) {
            testResults.skipped.push(testName);
            console.log(\`- \${testName} [skipped: needs \${capability}]\`);
            return;
        }
        test(testName, testFunction);
    }

    function log(message) {
        console.log(\`  \${message}\`);
    }
    
    // Helper function to save PNG files. Node.js only: in the browser it does
    // nothing. A failed save throws, failing the test that called it, and each
    // file written is recorded in testResults.savedPNGs for the runner's
    // orphan check.
    function savePNG(surface, filename, description, SWCanvas) {
        if (typeof require !== 'function') {
            return;
        }
        const pngData = SWCanvas.Core.PngEncoder.encode(surface);
        const fs = require('fs');
        const path = require('path');

        // Create output directory if it doesn't exist
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, filename);
        // Convert ArrayBuffer to Buffer for Node.js
        const buffer = Buffer.from(pngData);
        fs.writeFileSync(filePath, buffer);
        testResults.savedPNGs.push(filename);
        console.log(\`  Saved \${description}: \${filePath}\`);
    }
    
    // Core functionality tests - run all tests
    function runSharedTests(SWCanvas) {
        console.log('Running SWCanvas Shared Test Suite...\\n');
        
`;

    // Simply concatenate all test files with proper indentation
    testFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`Adding ${path.basename(filePath)}`);
        
        // Add the entire file content with proper indentation
        const indentedContent = content.split('\n')
            .map(line => line ? `        ${line}` : '')
            .join('\n');
        
        concatenated += indentedContent + '\n\n';
    });
    
    // Static footer
    concatenated += `        testResults.total = testResults.passed + testResults.failed + testResults.skipped.length;
        return testResults;
    }
    
    // Export for both Node.js and browser
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            runSharedTests: runSharedTests
        };
    } else {
        global.CoreFunctionalityTests = {
            runSharedTests: runSharedTests
        };
    }
    
})(typeof window !== "undefined" ? window : global);`;
    
    // Write the built file
    const outputFile = 'tests/dist/core-functionality-tests.js';
    fs.writeFileSync(outputFile, concatenated);
    console.log(`Built ${outputFile} with ${testFiles.length} tests`);
}

function buildVisualTests() {
    console.log('Building visual rendering tests...');
    
    const testFiles = getTestFiles('tests/visual');
    console.log(`Found ${testFiles.length} visual test files`);
    
    if (testFiles.length === 0) {
        console.log('No visual test files found');
        return;
    }
    
    // Build with static header
    let concatenated = `// Visual Test Registry
// Shared drawing logic for both Node.js and browser testing
// Each test defines drawing operations that work on both SWCanvas and HTML5 Canvas

(function(global) {
    'use strict';
    
    // Visual test registry using standard HTML5 Canvas API

    // Registry of visual tests
    const visualTests = {};

    // Helper function to create temporary canvases for unified API
    function createTempCanvas(width = 300, height = 150) {
        if (typeof document !== 'undefined') {
            // Browser environment - create HTML5 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            return canvas;
        } else if (typeof SWCanvas !== 'undefined' && SWCanvas.createCanvas) {
            // Node.js environment with SWCanvas - create SWCanvas
            return SWCanvas.createCanvas(width, height);
        } else {
            // Fallback - create a basic canvas-like object for testing
            throw new Error('No canvas creation method available');
        }
    }

    // Helper function to render SWCanvas to HTML5 Canvas (for browser use)
    function renderSWCanvasToHTML5(swSurface, html5Canvas) {
        if (!html5Canvas || !html5Canvas.getContext) return;
        
        const ctx = html5Canvas.getContext('2d');
        const imageData = ctx.createImageData(swSurface.width, swSurface.height);
        
        // Copy pixel data with proper unpremultiplication
        for (let i = 0; i < swSurface.data.length; i += 4) {
            const r = swSurface.data[i];
            const g = swSurface.data[i + 1];
            const b = swSurface.data[i + 2];
            const a = swSurface.data[i + 3];
            
            // SWCanvas Surface data is already non-premultiplied, just copy directly
            // HTML5 ImageData expects non-premultiplied RGBA
            imageData.data[i] = r;
            imageData.data[i + 1] = g;  
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = a;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    // Helper function to create test patterns (always RGBA)
    function createTestPattern(width, height, pattern) {
        const image = {
            width: width,
            height: height,
            data: new Uint8ClampedArray(width * height * 4) // Always RGBA
        };
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                
                switch (pattern) {
                    case 'checkerboard':
                        const isEven = (x + y) % 2 === 0;
                        image.data[i] = isEven ? 255 : 0;     // R
                        image.data[i + 1] = isEven ? 0 : 255; // G  
                        image.data[i + 2] = 0;                // B
                        image.data[i + 3] = 255;              // A
                        break;
                        
                    case 'gradient':
                        image.data[i] = Math.floor((x / width) * 255);     // R
                        image.data[i + 1] = Math.floor((y / height) * 255); // G
                        image.data[i + 2] = 128;                           // B
                        image.data[i + 3] = 255;                           // A
                        break;
                        
                    case 'border':
                        const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
                        image.data[i] = isBorder ? 255 : 100;     // R
                        image.data[i + 1] = isBorder ? 255 : 150; // G
                        image.data[i + 2] = isBorder ? 0 : 200;   // B
                        image.data[i + 3] = 255;                  // A
                        break;
                        
                    case 'alpha':
                        image.data[i] = 255;                      // R
                        image.data[i + 1] = 0;                    // G
                        image.data[i + 2] = 0;                    // B
                        image.data[i + 3] = Math.floor((x / width) * 255); // A gradient
                        break;
                        
                    case 'rgbtest':
                        // RGBA pattern that simulates what an RGB conversion would look like
                        image.data[i] = x < width / 2 ? 255 : 0;     // R
                        image.data[i + 1] = y < height / 2 ? 255 : 0; // G
                        image.data[i + 2] = (x + y) % 2 ? 255 : 0;   // B
                        image.data[i + 3] = 255;                     // A (full opacity)
                        break;
                        
                    case 'overlapping-squares':
                        // Complex pattern: Red background with yellow and blue overlapping squares
                        if (x >= 5 && x < 15 && y >= 5 && y < 15) {
                            // Yellow square (5,5) to (15,15)
                            image.data[i] = 255;     // R
                            image.data[i + 1] = 255; // G
                            image.data[i + 2] = 0;   // B
                            image.data[i + 3] = 255; // A
                        } else if (x >= 10 && x < 30 && y >= 10 && y < 30) {
                            // Blue square (10,10) to (30,30)
                            image.data[i] = 0;       // R
                            image.data[i + 1] = 0;   // G
                            image.data[i + 2] = 255; // B
                            image.data[i + 3] = 255; // A
                        } else {
                            // Red background
                            image.data[i] = 255;     // R
                            image.data[i + 1] = 0;   // G
                            image.data[i + 2] = 0;   // B
                            image.data[i + 3] = 255; // A
                        }
                        break;
                }
            }
        }
        
        return image;
    }

    // Helper function to create test images for different canvas implementations
    // 
    // This function has divergent code paths due to fundamental API incompatibility:
    // - Native HTML5 Canvas drawImage() only accepts DOM elements (HTMLCanvasElement, HTMLImageElement, etc.)
    // - SWCanvas drawImage() accepts DOM elements PLUS ImageLike objects ({width, height, data})
    // 
    // The helper detects the environment and provides the appropriate object type:
    // - For native HTML5 Canvas in browser: Convert ImageLike to HTMLCanvasElement (required by W3C spec)
    // - For SWCanvas: Return ImageLike directly (efficient, no conversion needed)
    // 
    // This divergence cannot be eliminated without either:
    // 1. Limiting SWCanvas to only accept DOM elements (losing ImageLike convenience)
    // 2. Modifying browser Canvas API (impossible)
    function createTestImage(width, height, pattern, ctx) {
        const imagelike = createTestPattern(width, height, pattern);
        
        // For HTML5 Canvas, create a temporary canvas element
        // Detection: !ctx._core (not SWCanvas) && document exists (browser environment)
        if (!ctx._core && typeof document !== 'undefined') {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            const imageData = tempCtx.createImageData(width, height);
            // Always RGBA data - copy directly
            imageData.data.set(imagelike.data);
            
            tempCtx.putImageData(imageData, 0, 0);
            return tempCanvas;
        }
        
        // For SWCanvas, return the ImageLike object directly
        return imagelike;
    }

    // Helper function to create Path2D objects compatible with both environments
    //
    // This function bridges the fundamental incompatibility between:
    // - Native HTML5 Canvas: Requires browser's built-in Path2D class
    // - SWCanvas: Uses its own Path2D implementation
    //
    // The issue: Browser Canvas API strictly type-checks Path2D arguments and rejects
    // duck-typed objects, even if they have the same interface. This helper detects
    // the environment and creates the appropriate Path2D type.
    //
    // This divergence exists because:
    // 1. Browsers enforce strict instanceof checks for Path2D in native code
    // 2. SWCanvas implements its own Path2D for cross-platform consistency
    // 3. There's no way to make SWCanvas's Path2D pass browser's instanceof check
    //
    // Detection method: SWCanvas contexts have a _core property, HTML5 contexts don't
    function createCompatiblePath2D(ctx) {
        // Detection: Check if we're using SWCanvas or native HTML5 Canvas
        if (ctx._core) {
            // SWCanvas context (has _core property)
            // Use SWCanvas's SWPath2D implementation
            return new SWCanvas.Core.SWPath2D();
        } else if (typeof window !== 'undefined' && window.Path2D) {
            // Browser environment with native HTML5 Canvas
            // Use browser's native Path2D class
            return new window.Path2D();
        } else {
            // Fallback - should not happen in normal use
            throw new Error('No Path2D implementation available');
        }
    }

    // Helper function to register a visual test with unified API
    function registerVisualTest(testName, testConfig) {
        // Store the original config
        visualTests[testName] = testConfig;
        
        // If it has a unified draw function, create the legacy functions for compatibility
        if (testConfig.draw && typeof testConfig.draw === 'function' && !testConfig.drawSWCanvas) {
            testConfig.drawSWCanvas = function(SWCanvas) {
                const canvas = SWCanvas.createCanvas(testConfig.width || 300, testConfig.height || 150);
                testConfig.draw(canvas);
                return canvas._coreSurface;
            };
            
            testConfig.drawHTML5Canvas = function(html5Canvas) {
                testConfig.draw(html5Canvas);
            };
        }
    }

`;

    // Simply concatenate all test files with proper indentation
    testFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`Adding ${path.basename(filePath)}`);
        
        // Add the entire file content with proper indentation
        const indentedContent = content.split('\n')
            .map(line => line ? `    ${line}` : '')
            .join('\n');
        
        concatenated += indentedContent + '\n\n';
    });
    
    // Static footer
    concatenated += `    const VisualRenderingTests = {
        getTests: function() { return visualTests; },
        getTest: function(name) { return visualTests[name]; },
        renderSWCanvasToHTML5: renderSWCanvasToHTML5,
        
        // Run a visual test and return both canvases for comparison
        runVisualTest: function(testName, SWCanvas, html5Canvas) {
            const test = visualTests[testName];
            if (!test) throw new Error('Visual test not found: ' + testName);
            
            // Draw on SWCanvas
            const surface = test.drawSWCanvas(SWCanvas);
            
            // Draw on HTML5 Canvas 
            test.drawHTML5Canvas(html5Canvas);
            
            return { surface: surface, html5Canvas: html5Canvas };
        }
    };

    // Universal module definition (UMD) pattern
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js
        module.exports = VisualRenderingTests;
    } else {
        // Browser
        global.VisualRenderingTests = VisualRenderingTests;
    }

})(typeof window !== "undefined" ? window : global);`;
    
    // Write the built file
    const outputFile = 'tests/dist/visual-rendering-tests.js';
    fs.writeFileSync(outputFile, concatenated);
    console.log(`Built ${outputFile} with ${testFiles.length} tests`);
}

// Main execution
console.log('SWCanvas Test Concatenation Build');
console.log('=================================');

buildCoreTests();
buildVisualTests();

console.log('Build complete!');